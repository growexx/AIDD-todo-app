import { Logger } from '@nestjs/common';
import mongoose from 'mongoose';
import {
  getAllPermissionCodes,
  getAllPermissionCodesWithWildcards,
  PERMISSIONS,
} from './rbac.registry';
import { PermissionSchema } from './schemas/permission.schema';
import { RoleSchema } from './schemas/role.schema';
import { UserRoleSchema } from './schemas/user-role.schema';
import { UserSchema } from '../auth/schemas/user.schema';

const logger = new Logger('RbacSeed');

const DEFAULT_ADMIN_ROLE = process.env.DEFAULT_ADMIN_ROLE || 'super-admin';

export interface SeedRbacOptions {
  mongoUri?: string;
  /** Comma-separated emails to assign the super-admin role to (optional). */
  superAdminEmails?: string;
}

/**
 * Idempotent RBAC seed. Safe to run multiple times.
 * If mongoUri is provided, connects before seeding and disconnects after.
 */
export async function seedRbac(options: SeedRbacOptions = {}): Promise<void> {
  const { mongoUri, superAdminEmails } = options;
  const emailsEnv = superAdminEmails ?? process.env.SEED_SUPER_ADMIN_EMAILS;
  let disconnect = false;

  if (mongoUri) {
    await mongoose.connect(mongoUri);
    disconnect = true;
  }

  const Permission = mongoose.models.Permission ?? mongoose.model('Permission', PermissionSchema);
  const Role = mongoose.models.Role ?? mongoose.model('Role', RoleSchema);
  const UserRole = mongoose.models.UserRole ?? mongoose.model('UserRole', UserRoleSchema);

  try {
    // 1. Upsert all permission codes (including wildcard)
    const allCodes = getAllPermissionCodesWithWildcards();
    for (const code of allCodes) {
      await Permission.findOneAndUpdate(
        { code },
        { code, description: code === PERMISSIONS.GLOBAL_WILDCARD ? 'Full access (super-admin only)' : '' },
        { upsert: true, new: true },
      );
    }
    logger.log(`Upserted ${allCodes.length} permissions`);

    // 2. Upsert super-admin role
    const superAdmin = await Role.findOneAndUpdate(
      { name: DEFAULT_ADMIN_ROLE },
      { name: DEFAULT_ADMIN_ROLE, description: 'Full system access' },
      { upsert: true, new: true },
    );
    logger.log(`Upserted role: ${DEFAULT_ADMIN_ROLE}`);

    // 3. Assign *:* to super-admin
    const wildcardPerm = await Permission.findOne({ code: PERMISSIONS.GLOBAL_WILDCARD }).exec();
    if (wildcardPerm && superAdmin) {
      await Role.findOneAndUpdate(
        { _id: superAdmin._id },
        { $addToSet: { permissions: wildcardPerm._id } },
        { new: true },
      );
    }
    logger.log(`Assigned *:* to ${DEFAULT_ADMIN_ROLE}`);

    // 4. Upsert rbac-admin role
    const rbacAdmin = await Role.findOneAndUpdate(
      { name: 'rbac-admin' },
      { name: 'rbac-admin', description: 'RBAC management only' },
      { upsert: true, new: true },
    );
    logger.log('Upserted role: rbac-admin');

    // 5. Assign all non-wildcard RBAC permissions to rbac-admin
    const standardCodes = getAllPermissionCodes();
    const permIds: mongoose.Types.ObjectId[] = [];
    for (const code of standardCodes) {
      const p = await Permission.findOne({ code }).exec();
      if (p) permIds.push(p._id);
    }
    if (rbacAdmin && permIds.length > 0) {
      await Role.findOneAndUpdate(
        { _id: rbacAdmin._id },
        { $addToSet: { permissions: { $each: permIds } } },
        { new: true },
      );
    }
    logger.log(`Assigned ${standardCodes.length} permissions to rbac-admin`);

    // 6. Optionally assign super-admin role to existing users by email
    if (superAdmin?._id && emailsEnv?.trim()) {
      const User = mongoose.models.User ?? mongoose.model('User', UserSchema);
      const emails = emailsEnv.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
      for (const email of emails) {
        const user = await User.findOne({ email }).select('_id').lean().exec();
        if (!user) {
          logger.warn(`User not found for email: ${email}`);
          continue;
        }
        const userId = (user._id as mongoose.Types.ObjectId).toString();
        await UserRole.findOneAndUpdate(
          { userId, roleId: superAdmin._id },
          { userId, roleId: superAdmin._id, assignedAt: new Date() },
          { upsert: true },
        );
        logger.log(`Assigned ${DEFAULT_ADMIN_ROLE} to ${email}`);
      }
    }
  } catch (err) {
    logger.error('seedRbac failed', err);
    throw err;
  } finally {
    if (disconnect) {
      await mongoose.disconnect();
    }
  }
}

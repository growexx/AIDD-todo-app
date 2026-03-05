import { Logger } from '@nestjs/common';
import mongoose from 'mongoose';
import {
  getAllPermissionCodesWithWildcards,
  PERMISSIONS,
} from './rbac.registry';
import { PermissionSchema } from './schemas/permission.schema';
import { RoleSchema } from './schemas/role.schema';
import { UserRoleSchema } from './schemas/user-role.schema';
import { UserSchema } from '../auth/schemas/user.schema';

const logger = new Logger('RbacSeed');

const DEFAULT_ADMIN_ROLE = process.env.DEFAULT_ADMIN_ROLE || 'super-admin';
const DEFAULT_USER_ROLE = process.env.DEFAULT_USER_ROLE || 'user';

/** Permissions for admin role: full RBAC UI access (roles, permissions, user-role assignment), no admin:* (no manage admin accounts). */
const ADMIN_PERMISSION_CODES = [
  PERMISSIONS.ROLE_CREATE,
  PERMISSIONS.ROLE_VIEW,
  PERMISSIONS.ROLE_UPDATE,
  PERMISSIONS.ROLE_DELETE,
  PERMISSIONS.ROLE_ASSIGN,
  PERMISSIONS.ROLE_REVOKE,
  PERMISSIONS.PERMISSION_VIEW,
  PERMISSIONS.PERMISSION_MANAGE,
  PERMISSIONS.USER_VIEW_PERMISSIONS,
  PERMISSIONS.USER_CREATE,
  PERMISSIONS.USER_VIEW,
  PERMISSIONS.USER_UPDATE,
  PERMISSIONS.USER_DELETE,
  PERMISSIONS.TASK_CREATE,
  PERMISSIONS.TASK_VIEW,
  PERMISSIONS.TASK_UPDATE,
  PERMISSIONS.TASK_DELETE,
  PERMISSIONS.TASK_UPDATE_STATUS,
  PERMISSIONS.OWN_PROFILE_VIEW,
  PERMISSIONS.OWN_PROFILE_UPDATE,
  PERMISSIONS.OWN_TASK_VIEW,
  PERMISSIONS.OWN_TASK_CREATE,
  PERMISSIONS.OWN_TASK_UPDATE,
];

const MANAGER_PERMISSION_CODES = [
  PERMISSIONS.TASK_VIEW,
  PERMISSIONS.TASK_UPDATE_STATUS,
  PERMISSIONS.OWN_PROFILE_VIEW,
  PERMISSIONS.OWN_PROFILE_UPDATE,
  PERMISSIONS.OWN_TASK_VIEW,
  PERMISSIONS.OWN_TASK_CREATE,
  PERMISSIONS.OWN_TASK_UPDATE,
];

const USER_PERMISSION_CODES = [
  PERMISSIONS.USER_VIEW_PERMISSIONS, // so users can load their own permissions for PermissionProvider
  PERMISSIONS.OWN_PROFILE_VIEW,
  PERMISSIONS.OWN_PROFILE_UPDATE,
  PERMISSIONS.OWN_TASK_VIEW,
  PERMISSIONS.OWN_TASK_CREATE,
  PERMISSIONS.OWN_TASK_UPDATE,
];

export interface SeedRbacOptions {
  mongoUri?: string;
  /** Comma-separated emails to assign the super-admin role to (optional). */
  superAdminEmails?: string;
  /** Comma-separated emails to assign the admin role to (optional). */
  adminEmails?: string;
  /** Comma-separated emails to assign the manager role to (optional). */
  managerEmails?: string;
  /** User model for default-role back-fill. If omitted, back-fill is skipped. */
  userModel?: mongoose.Model<{ _id: mongoose.Types.ObjectId }>;
  batchSize?: number;
}

/**
 * Idempotent RBAC seed. Safe to run multiple times.
 * Creates 4 roles: super-admin, admin, manager, user (user is default).
 * Optionally back-fills default role to existing users with no role.
 */
export async function seedRbac(options: SeedRbacOptions = {}): Promise<void> {
  const {
    mongoUri,
    superAdminEmails,
    adminEmails,
    managerEmails,
    userModel,
    batchSize = 100,
  } = options;
  const superAdminEmailsEnv = superAdminEmails ?? process.env.SEED_SUPER_ADMIN_EMAILS;
  const adminEmailsEnv = adminEmails ?? process.env.SEED_ADMIN_EMAILS;
  const managerEmailsEnv = managerEmails ?? process.env.SEED_MANAGER_EMAILS;
  let disconnect = false;

  if (mongoUri) {
    await mongoose.connect(mongoUri);
    disconnect = true;
  }

  const Permission = mongoose.models.Permission ?? mongoose.model('Permission', PermissionSchema);
  const Role = mongoose.models.Role ?? mongoose.model('Role', RoleSchema);
  const UserRole = mongoose.models.UserRole ?? mongoose.model('UserRole', UserRoleSchema);
  const User = userModel ?? (mongoose.models.User ?? mongoose.model('User', UserSchema));

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
    logger.log(`Seeded ${allCodes.length} permissions.`);

    // 2. Upsert four roles (super-admin, admin, manager, user)
    const [superAdmin, admin, manager, userRole] = await Promise.all([
      Role.findOneAndUpdate(
        { name: DEFAULT_ADMIN_ROLE },
        {
          name: DEFAULT_ADMIN_ROLE,
          description: 'Full system access including admin and role management',
          isDefault: false,
        },
        { upsert: true, new: true },
      ),
      Role.findOneAndUpdate(
        { name: 'admin' },
        {
          name: 'admin',
          description: 'Full application access. Cannot create or manage admin/super-admin accounts.',
          isDefault: false,
        },
        { upsert: true, new: true },
      ),
      Role.findOneAndUpdate(
        { name: 'manager' },
        {
          name: 'manager',
          description: 'Can update task status. Cannot create users or manage accounts.',
          isDefault: false,
        },
        { upsert: true, new: true },
      ),
      Role.findOneAndUpdate(
        { name: DEFAULT_USER_ROLE },
        {
          name: DEFAULT_USER_ROLE,
          description: 'Standard user. Read/write access to own resources only.',
          isDefault: true,
        },
        { upsert: true, new: true },
      ),
    ]);

    // 3. Enforce single default: unset others, set user
    await Role.updateMany(
      { isDefault: true, name: { $ne: DEFAULT_USER_ROLE } },
      { $set: { isDefault: false } },
    ).exec();
    if (userRole) {
      await Role.findByIdAndUpdate(userRole._id, { $set: { isDefault: true } }).exec();
    }
    logger.log(`Default role set to: ${DEFAULT_USER_ROLE}.`);

    // 4. Assign permissions to each role
    const wildcardPerm = await Permission.findOne({ code: PERMISSIONS.GLOBAL_WILDCARD }).exec();
    if (wildcardPerm && superAdmin) {
      await Role.findByIdAndUpdate(superAdmin._id, { $addToSet: { permissions: wildcardPerm._id } }).exec();
    }
    logger.log(`Assigned *:* to ${DEFAULT_ADMIN_ROLE}.`);

    for (const code of ADMIN_PERMISSION_CODES) {
      const p = await Permission.findOne({ code }).exec();
      if (p && admin) {
        await Role.findByIdAndUpdate(admin._id, { $addToSet: { permissions: p._id } }).exec();
      }
    }
    logger.log(`Assigned permissions to admin.`);

    for (const code of MANAGER_PERMISSION_CODES) {
      const p = await Permission.findOne({ code }).exec();
      if (p && manager) {
        await Role.findByIdAndUpdate(manager._id, { $addToSet: { permissions: p._id } }).exec();
      }
    }
    logger.log(`Assigned permissions to manager.`);

    for (const code of USER_PERMISSION_CODES) {
      const p = await Permission.findOne({ code }).exec();
      if (p && userRole) {
        await Role.findByIdAndUpdate(userRole._id, { $addToSet: { permissions: p._id } }).exec();
      }
    }
    logger.log(`Assigned permissions to ${DEFAULT_USER_ROLE}.`);

    const assignRoleByEmails = async (
      roleDoc: { _id: mongoose.Types.ObjectId } | null,
      emailsStr: string | undefined,
      roleLabel: string,
    ) => {
      if (!roleDoc?._id || !emailsStr?.trim()) return;
      const emails = emailsStr.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
      for (const email of emails) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const user = await (User as any).findOne({ email }).select('_id').lean().exec();
        if (!user) {
          logger.warn(`User not found for email: ${email}`);
          continue;
        }
        const userId = (user._id as mongoose.Types.ObjectId).toString();
        await UserRole.findOneAndUpdate(
          { userId, roleId: roleDoc._id },
          { userId, roleId: roleDoc._id, assignedAt: new Date(), isBackfilled: false },
          { upsert: true },
        );
        logger.log(`Assigned ${roleLabel} to ${email}`);
      }
    };

    // 5. Assign roles to users by email (super-admin, admin, manager)
    await assignRoleByEmails(superAdmin, superAdminEmailsEnv, DEFAULT_ADMIN_ROLE);
    await assignRoleByEmails(admin, adminEmailsEnv, 'admin');
    await assignRoleByEmails(manager, managerEmailsEnv, 'manager');

    // 6. Default role back-fill: assign user role to all users with no role
    if (userRole?._id) {
      let assignedUserIds = await UserRole.distinct('userId').exec();
      let processed = 0;
      let backfilled = 0;
      for (;;) {
        const excluded = assignedUserIds.map((id) => new mongoose.Types.ObjectId(id));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const batch = await (User as any).find(excluded.length ? { _id: { $nin: excluded } } : {})
          .select('_id')
          .limit(batchSize)
          .lean()
          .exec();
        if (batch.length === 0) break;
        const ops = batch.map((u: { _id: mongoose.Types.ObjectId }) => ({
          updateOne: {
            filter: { userId: u._id.toString(), roleId: userRole._id },
            update: {
              $setOnInsert: {
                userId: u._id.toString(),
                roleId: userRole._id,
                assignedAt: new Date(),
                isBackfilled: true,
              },
            },
            upsert: true,
          },
        }));
        const result = await UserRole.bulkWrite(ops as never, { ordered: false });
        backfilled += result.upsertedCount ?? 0;
        processed += batch.length;
        assignedUserIds = await UserRole.distinct('userId').exec();
      }
      logger.log(`Back-fill complete. Processed: ${processed}. Newly assigned: ${backfilled}.`);
    }

    logger.log('RBAC seed complete.');
  } catch (err) {
    logger.error('seedRbac failed', err);
    throw err;
  } finally {
    if (disconnect) {
      await mongoose.disconnect();
    }
  }
}

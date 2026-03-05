import { Injectable, Optional, Inject } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Role, RoleDocument } from './schemas/role.schema';
import { Permission, PermissionDocument } from './schemas/permission.schema';
import { UserRole, UserRoleDocument } from './schemas/user-role.schema';
import { RbacException } from './errors/rbac.exception';
import { RBAC_ERROR_CODES } from './errors/rbac.exception';
import { HttpStatus } from '@nestjs/common';
import { isValidPermissionCode } from './rbac.registry';
import { escapeForRegex } from './utils/regex-escape';

export interface RbacConfig {
  userExistsValidator?: (userId: string) => Promise<boolean>;
  redisClient?: { get: (k: string) => Promise<string | null>; set: (k: string, v: string, px?: number) => Promise<unknown>; del: (k: string) => Promise<unknown> };
  cacheTtlSeconds?: number;
}

export interface ListOptions {
  page?: number;
  limit?: number;
  search?: string;
}

export interface ListResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

const MAX_LIMIT = 200;

export const RBAC_CONFIG = 'RBAC_CONFIG';

@Injectable()
export class RbacService {
  constructor(
    @InjectModel(Role.name) private roleModel: Model<RoleDocument>,
    @InjectModel(Permission.name) private permissionModel: Model<PermissionDocument>,
    @InjectModel(UserRole.name) private userRoleModel: Model<UserRoleDocument>,
    @Optional() @InjectModel('User') private userModel?: Model<{ _id: Types.ObjectId }>,
    @Optional() @Inject(RBAC_CONFIG) config: RbacConfig = {},
  ) {
    this.config = config ?? {};
  }
  private config: RbacConfig = {};

  /** Clamp limit and resolve page/limit for list methods. */
  private normalizeListOptions(opts: ListOptions): { page: number; limit: number; skip: number; search?: string } {
    const page = Math.max(1, opts.page ?? 1);
    const limit = Math.min(MAX_LIMIT, Math.max(1, opts.limit ?? 20));
    const skip = (page - 1) * limit;
    return { page, limit, skip, search: opts.search?.trim() || undefined };
  }

  async createRole(payload: { name: string; description?: string }): Promise<RoleDocument> {
    const name = payload.name?.trim();
    if (!name) {
      throw new RbacException(HttpStatus.BAD_REQUEST, RBAC_ERROR_CODES.VALIDATION_ERROR, 'Role name is required');
    }
    const existing = await this.roleModel.findOne({ name }).exec();
    if (existing) {
      throw new RbacException(HttpStatus.CONFLICT, RBAC_ERROR_CODES.CONFLICT, 'Role name already exists');
    }
    const role = await this.roleModel.create({ name, description: payload.description?.trim() ?? '' });
    return role as RoleDocument;
  }

  async getRoleById(id: string): Promise<RoleDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new RbacException(HttpStatus.NOT_FOUND, RBAC_ERROR_CODES.NOT_FOUND, 'Role not found');
    }
    const role = await this.roleModel
      .findById(id)
      .populate('permissions')
      .exec();
    if (!role) {
      throw new RbacException(HttpStatus.NOT_FOUND, RBAC_ERROR_CODES.NOT_FOUND, 'Role not found');
    }
    return role as RoleDocument;
  }

  async listRoles(opts: ListOptions): Promise<ListResult<RoleDocument>> {
    const { page, limit, skip, search } = this.normalizeListOptions(opts);
    const filter: Record<string, unknown> = {};
    if (search) {
      const escaped = escapeForRegex(search);
      filter.name = { $regex: escaped, $options: 'i' };
    }
    const [data, total] = await Promise.all([
      this.roleModel
        .find(filter)
        .lean()
        .skip(skip)
        .limit(limit)
        .sort({ name: 1 })
        .exec(),
      this.roleModel.countDocuments(filter).exec(),
    ]);
    return { data: data as RoleDocument[], total, page, limit };
  }

  async updateRole(
    id: string,
    payload: { name?: string; description?: string; isDefault?: boolean },
  ): Promise<RoleDocument> {
    const role = await this.roleModel.findById(id).exec();
    if (!role) {
      throw new RbacException(HttpStatus.NOT_FOUND, RBAC_ERROR_CODES.NOT_FOUND, 'Role not found');
    }
    if (payload.name !== undefined) {
      const name = payload.name?.trim();
      if (!name) {
        throw new RbacException(HttpStatus.BAD_REQUEST, RBAC_ERROR_CODES.VALIDATION_ERROR, 'Role name cannot be empty');
      }
      const existing = await this.roleModel.findOne({ name, _id: { $ne: id } }).exec();
      if (existing) {
        throw new RbacException(HttpStatus.CONFLICT, RBAC_ERROR_CODES.CONFLICT, 'Role name already taken');
      }
      role.name = name;
    }
    if (payload.description !== undefined) {
      role.description = payload.description?.trim() ?? '';
    }
    if (payload.isDefault === true) {
      await this.roleModel.updateMany({ isDefault: true, _id: { $ne: id } }, { $set: { isDefault: false } }).exec();
      role.isDefault = true;
    } else if (payload.isDefault === false) {
      role.isDefault = false;
    }
    await role.save();
    return this.getRoleById(id);
  }

  async deleteRole(id: string): Promise<void> {
    const role = await this.roleModel.findById(id).exec();
    if (!role) {
      throw new RbacException(HttpStatus.NOT_FOUND, RBAC_ERROR_CODES.NOT_FOUND, 'Role not found');
    }
    if (role.isDefault) {
      throw new RbacException(
        HttpStatus.CONFLICT,
        RBAC_ERROR_CODES.CONFLICT,
        'Cannot delete the default user role. Assign a different default role first.',
      );
    }
    await this.userRoleModel.deleteMany({ roleId: role._id }).exec();
    await this.roleModel.findByIdAndDelete(id).exec();
    this.invalidateUserPermissionsCacheForRole(id).catch((err) =>
      this.logWarning('Redis invalidation after deleteRole', err),
    );
  }

  async listPermissions(opts: ListOptions): Promise<ListResult<PermissionDocument>> {
    const { page, limit, skip, search } = this.normalizeListOptions(opts);
    const filter: Record<string, unknown> = {};
    if (search) {
      const escaped = escapeForRegex(search);
      filter.code = { $regex: escaped, $options: 'i' };
    }
    const [data, total] = await Promise.all([
      this.permissionModel
        .find(filter)
        .lean()
        .skip(skip)
        .limit(limit)
        .sort({ code: 1 })
        .exec(),
      this.permissionModel.countDocuments(filter).exec(),
    ]);
    return { data: data as PermissionDocument[], total, page, limit };
  }

  getPermissionByCode(code: string): Promise<PermissionDocument | null> {
    return this.permissionModel.findOne({ code: code.trim() }).exec() as Promise<PermissionDocument | null>;
  }

  async addPermissionToRole(roleId: string, permissionCode: string): Promise<RoleDocument> {
    if (!isValidPermissionCode(permissionCode)) {
      throw new RbacException(
        HttpStatus.BAD_REQUEST,
        RBAC_ERROR_CODES.INVALID_PERMISSION_FORMAT,
        'Invalid permission code format',
      );
    }
    const permission = await this.getPermissionByCode(permissionCode.trim());
    if (!permission) {
      throw new RbacException(HttpStatus.NOT_FOUND, RBAC_ERROR_CODES.NOT_FOUND, 'Permission not found');
    }
    const role = await this.roleModel.findById(roleId).exec();
    if (!role) {
      throw new RbacException(HttpStatus.NOT_FOUND, RBAC_ERROR_CODES.NOT_FOUND, 'Role not found');
    }
    await this.roleModel
      .findByIdAndUpdate(roleId, { $addToSet: { permissions: permission._id } }, { new: true })
      .exec();
    await this.invalidateUserPermissionsCacheForRole(roleId).catch((err) =>
      this.logWarning('Redis invalidation after addPermissionToRole', err),
    );
    return this.getRoleById(roleId);
  }

  async removePermissionFromRole(roleId: string, permissionId: string): Promise<void> {
    const role = await this.roleModel.findById(roleId).exec();
    if (!role) {
      throw new RbacException(HttpStatus.NOT_FOUND, RBAC_ERROR_CODES.NOT_FOUND, 'Role not found');
    }
    const permId = new Types.ObjectId(permissionId);
    if (!role.permissions.some((p) => (p as Types.ObjectId).equals(permId))) {
      throw new RbacException(HttpStatus.NOT_FOUND, RBAC_ERROR_CODES.NOT_FOUND, 'Permission not linked to role');
    }
    await this.roleModel.findByIdAndUpdate(roleId, { $pull: { permissions: permId } }).exec();
    await this.invalidateUserPermissionsCacheForRole(roleId).catch((err) =>
      this.logWarning('Redis invalidation after removePermissionFromRole', err),
    );
  }

  async assignRoleToUser(userId: string, roleId: string): Promise<void> {
    if (!userId || typeof userId !== 'string' || !userId.trim()) {
      throw new RbacException(HttpStatus.BAD_REQUEST, RBAC_ERROR_CODES.VALIDATION_ERROR, 'User ID is required');
    }
    const uid = userId.trim();
    if (this.config.userExistsValidator) {
      const exists = await this.config.userExistsValidator(uid);
      if (!exists) {
        throw new RbacException(HttpStatus.NOT_FOUND, RBAC_ERROR_CODES.NOT_FOUND, 'User not found');
      }
    }
    const role = await this.roleModel.findById(roleId).exec();
    if (!role) {
      throw new RbacException(HttpStatus.NOT_FOUND, RBAC_ERROR_CODES.NOT_FOUND, 'Role not found');
    }
    await this.userRoleModel.findOneAndUpdate(
      { userId: uid, roleId: role._id },
      { $set: { userId: uid, roleId: role._id, assignedAt: new Date() } },
      { upsert: true },
    );
    await this.invalidateUserPermissionsCache(uid).catch((err) =>
      this.logWarning('Redis invalidation after assignRoleToUser', err),
    );
  }

  async removeRoleFromUser(userId: string, roleId: string): Promise<void> {
    const role = await this.roleModel.findById(roleId).exec();
    if (!role) {
      throw new RbacException(HttpStatus.NOT_FOUND, RBAC_ERROR_CODES.NOT_FOUND, 'Role not found');
    }
    const deleted = await this.userRoleModel.findOneAndDelete({ userId: userId.trim(), roleId: role._id }).exec();
    if (!deleted) {
      throw new RbacException(HttpStatus.NOT_FOUND, RBAC_ERROR_CODES.NOT_FOUND, 'User-role assignment not found');
    }
    await this.invalidateUserPermissionsCache(userId.trim()).catch((err) =>
      this.logWarning('Redis invalidation after removeRoleFromUser', err),
    );
  }

  async getUserRoles(userId: string): Promise<RoleDocument[]> {
    const userRoles = await this.userRoleModel
      .find({ userId: userId.trim() })
      .populate({ path: 'roleId', populate: { path: 'permissions' } })
      .lean()
      .exec();
    const roles = userRoles
      .map((ur) => (ur as unknown as { roleId: RoleDocument }).roleId)
      .filter((r): r is RoleDocument => r != null);
    return roles;
  }

  async getUserPermissions(userId: string): Promise<string[]> {
    const roles = await this.getUserRoles(userId);
    const permissionIds = new Set<Types.ObjectId>();
    for (const r of roles) {
      for (const p of r.permissions || []) {
        // When populated, p is a full document; otherwise ObjectId
        const id = p && typeof p === 'object' && '_id' in (p as object)
          ? (p as { _id: Types.ObjectId })._id
          : (p as Types.ObjectId);
        permissionIds.add(id);
      }
    }
    if (permissionIds.size === 0) return [];
    const permissions = await this.permissionModel.find({ _id: { $in: Array.from(permissionIds) } }).exec();
    const codes = permissions.map((p) => p.code) as string[];
    return [...new Set(codes)];
  }

  /** Get all userIds assigned to a role (for Role Detail Page). */
  async getUsersByRole(roleId: string): Promise<{ userId: string }[]> {
    if (!Types.ObjectId.isValid(roleId)) {
      throw new RbacException(HttpStatus.NOT_FOUND, RBAC_ERROR_CODES.NOT_FOUND, 'Role not found');
    }
    const role = await this.roleModel.findById(roleId).exec();
    if (!role) {
      throw new RbacException(HttpStatus.NOT_FOUND, RBAC_ERROR_CODES.NOT_FOUND, 'Role not found');
    }
    const list = await this.userRoleModel.find({ roleId: role._id }).select('userId').lean().exec();
    return list.map((ur) => ({ userId: ur.userId }));
  }

  /** Get the role with isDefault: true, or null. */
  async getDefaultRole(): Promise<RoleDocument | null> {
    return this.roleModel.findOne({ isDefault: true }).exec() as Promise<RoleDocument | null>;
  }

  /**
   * Assign the default role (isDefault: true) to all users who have no role in UserRole.
   * Idempotent. Requires userModel to be injected.
   */
  async backfillDefaultRole(options: { batchSize?: number } = {}): Promise<{
    processed: number;
    backfilled: number;
    skipped: number;
  }> {
    if (!this.userModel) {
      throw new RbacException(
        HttpStatus.NOT_IMPLEMENTED,
        RBAC_ERROR_CODES.NOT_IMPLEMENTED,
        'User model not configured for back-fill',
      );
    }
    const defaultRole = await this.getDefaultRole();
    if (!defaultRole) {
      throw new RbacException(
        HttpStatus.NOT_FOUND,
        RBAC_ERROR_CODES.NOT_FOUND,
        'No default role (isDefault: true) found',
      );
    }
    const batchSize = Math.min(500, Math.max(1, options.batchSize ?? 100));
    let assignedUserIds = await this.userRoleModel.distinct('userId').exec();
    const skipped = assignedUserIds.length;
    let processed = 0;
    let backfilled = 0;
    const toObjectId = (id: string) => new Types.ObjectId(id);
    for (;;) {
      const excluded = assignedUserIds.length ? assignedUserIds.map(toObjectId) : [];
      const batch = await this.userModel!
        .find(excluded.length ? { _id: { $nin: excluded } } : {})
        .select('_id')
        .limit(batchSize)
        .lean()
        .exec();
      if (batch.length === 0) break;
      const ops = batch.map((u: { _id: Types.ObjectId }) => ({
        updateOne: {
          filter: { userId: u._id.toString(), roleId: defaultRole._id },
          update: {
            $setOnInsert: {
              userId: u._id.toString(),
              roleId: defaultRole._id,
              assignedAt: new Date(),
              isBackfilled: true,
            },
          },
          upsert: true,
        },
      }));
      const result = await this.userRoleModel.bulkWrite(ops as never, { ordered: false });
      backfilled += result.upsertedCount ?? 0;
      processed += batch.length;
      assignedUserIds = await this.userRoleModel.distinct('userId').exec();
    }
    return { processed, backfilled, skipped };
  }

  private logWarning(msg: string, err: unknown): void {
    if (this.config.redisClient) {
      // eslint-disable-next-line no-console
      console.warn(`[RBAC] ${msg}:`, err);
    }
  }

  private async invalidateUserPermissionsCache(userId: string): Promise<void> {
    const client = this.config.redisClient;
    if (!client) return;
    try {
      await client.del(`rbac:permissions:${userId}`);
    } catch {
      // already logged in logWarning
    }
  }

  private async invalidateUserPermissionsCacheForRole(roleId: string): Promise<void> {
    const client = this.config.redisClient;
    if (!client) return;
    try {
      const userRoles = await this.userRoleModel.find({ roleId }).select('userId').lean().exec();
      for (const ur of userRoles) {
        await client.del(`rbac:permissions:${ur.userId}`);
      }
    } catch {
      // already logged
    }
  }
}

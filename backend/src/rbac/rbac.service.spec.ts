import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { RbacService } from './rbac.service';
import { Role } from './schemas/role.schema';
import { Permission } from './schemas/permission.schema';
import { UserRole } from './schemas/user-role.schema';
import { RbacException } from './errors/rbac.exception';
import { RBAC_CONFIG } from './rbac.service';

const mockRoleDoc = {
  _id: new Types.ObjectId(),
  name: 'admin',
  description: 'Admin role',
  isDefault: false,
  permissions: [],
  save: jest.fn().mockResolvedValue(true),
};

const mockPermissionDoc = {
  _id: new Types.ObjectId(),
  code: 'role:create',
  description: 'Create roles',
};

describe('RbacService', () => {
  let service: RbacService;
  let roleModel: { findOne: jest.Mock; find: jest.Mock; findById: jest.Mock; findByIdAndUpdate: jest.Mock; findByIdAndDelete: jest.Mock; create: jest.Mock; countDocuments: jest.Mock; updateMany: jest.Mock };
  let permissionModel: { find: jest.Mock; findOne: jest.Mock; countDocuments: jest.Mock };
  let userRoleModel: { find: jest.Mock; findOneAndUpdate: jest.Mock; findOneAndDelete: jest.Mock; deleteMany: jest.Mock; distinct: jest.Mock; bulkWrite: jest.Mock };

  beforeEach(async () => {
    const mockExec = jest.fn().mockResolvedValue([]);
    const chain = {
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      exec: mockExec,
    };
    const roleFindReturn = { populate: jest.fn().mockReturnValue(chain), lean: jest.fn().mockReturnValue(chain) };
    roleModel = {
      findOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
      find: jest.fn().mockReturnValue(roleFindReturn),
      findById: jest.fn().mockReturnValue({ populate: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }) }),
      findByIdAndUpdate: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(mockRoleDoc) }),
      findByIdAndDelete: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(mockRoleDoc) }),
      create: jest.fn().mockResolvedValue(mockRoleDoc),
      countDocuments: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(0) }),
      updateMany: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({}) }),
    };
    const permChain = {
      skip: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      sort: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue([]),
    };
    permissionModel = {
      find: jest.fn().mockReturnValue({ lean: jest.fn().mockReturnValue(permChain) }),
      findOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
      countDocuments: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(0) }),
    };
    userRoleModel = {
      find: jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({ lean: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }) }),
        select: jest.fn().mockReturnValue({ lean: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }) }),
      }),
      findOneAndUpdate: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({}) }),
      findOneAndDelete: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }),
      deleteMany: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({}) }),
      distinct: jest.fn().mockResolvedValue([]),
      bulkWrite: jest.fn().mockResolvedValue({ upsertedCount: 0 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RbacService,
        { provide: getModelToken(Role.name), useValue: roleModel },
        { provide: getModelToken(Permission.name), useValue: permissionModel },
        { provide: getModelToken(UserRole.name), useValue: userRoleModel },
        { provide: getModelToken('User'), useValue: null },
        { provide: RBAC_CONFIG, useValue: {} },
      ],
    }).compile();

    service = module.get<RbacService>(RbacService);
    jest.clearAllMocks();
  });

  describe('createRole', () => {
    it('creates role on success', async () => {
      roleModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
      roleModel.create.mockResolvedValue(mockRoleDoc);
      const result = await service.createRole({ name: 'admin', description: 'Admin' });
      expect(result).toBeDefined();
      expect(roleModel.create).toHaveBeenCalledWith(expect.objectContaining({ name: 'admin' }));
    });

    it('throws CONFLICT when name exists', async () => {
      roleModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(mockRoleDoc) });
      await expect(service.createRole({ name: 'admin' })).rejects.toThrow(RbacException);
    });

    it('throws VALIDATION_ERROR when name is empty', async () => {
      await expect(service.createRole({ name: '  ' })).rejects.toThrow(RbacException);
    });
  });

  describe('getRoleById', () => {
    it('returns role when found', async () => {
      const populated = { ...mockRoleDoc, permissions: [mockPermissionDoc] };
      roleModel.findById.mockReturnValue({ populate: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(populated) }) });
      const result = await service.getRoleById(mockRoleDoc._id.toString());
      expect(result).toEqual(populated);
    });

    it('throws NOT_FOUND when role does not exist', async () => {
      roleModel.findById.mockReturnValue({ populate: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) }) });
      await expect(service.getRoleById(mockRoleDoc._id.toString())).rejects.toThrow(RbacException);
    });

    it('throws NOT_FOUND for invalid ObjectId', async () => {
      await expect(service.getRoleById('invalid')).rejects.toThrow(RbacException);
    });
  });

  describe('listRoles', () => {
    it('returns paginated result', async () => {
      const data = [mockRoleDoc];
      const execMock = jest.fn().mockResolvedValue(data);
      roleModel.find.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          sort: jest.fn().mockReturnThis(),
          exec: execMock,
        }),
        populate: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }),
      });
      roleModel.countDocuments.mockReturnValue({ exec: jest.fn().mockResolvedValue(1) });
      const result = await service.listRoles({ page: 1, limit: 20 });
      expect(result.data).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('applies search filter when search is provided', async () => {
      roleModel.find.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          sort: jest.fn().mockReturnThis(),
          exec: jest.fn().mockResolvedValue([]),
        }),
        populate: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }),
      });
      roleModel.countDocuments.mockReturnValue({ exec: jest.fn().mockResolvedValue(0) });
      await service.listRoles({ page: 1, limit: 10, search: 'admin' });
      expect(roleModel.find).toHaveBeenCalledWith(expect.objectContaining({ name: expect.any(Object) }));
    });
  });

  describe('deleteRole', () => {
    it('throws CONFLICT when role is default', async () => {
      roleModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue({ ...mockRoleDoc, isDefault: true }) });
      await expect(service.deleteRole(mockRoleDoc._id.toString())).rejects.toThrow(RbacException);
    });

    it('deletes role and user-role refs when not default', async () => {
      roleModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(mockRoleDoc) });
      await service.deleteRole(mockRoleDoc._id.toString());
      expect(userRoleModel.deleteMany).toHaveBeenCalled();
      expect(roleModel.findByIdAndDelete).toHaveBeenCalled();
    });
  });

  describe('updateRole', () => {
    it('updates role and returns refreshed role', async () => {
      const updated = { ...mockRoleDoc, name: 'editor', description: 'Editor role' };
      roleModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue({
          ...mockRoleDoc,
          name: 'admin',
          description: '',
          save: jest.fn().mockResolvedValue(undefined),
        }),
      });
      roleModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
      roleModel.updateMany.mockReturnValue({ exec: jest.fn().mockResolvedValue({}) });
      roleModel.findById.mockReturnValueOnce({
        exec: jest.fn().mockResolvedValue({
          ...mockRoleDoc,
          name: 'admin',
          save: jest.fn().mockResolvedValue(undefined),
        }),
      });
      roleModel.findById.mockReturnValueOnce({
        populate: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(updated) }),
      });
      const result = await service.updateRole(mockRoleDoc._id.toString(), {
        name: 'editor',
        description: 'Editor role',
      });
      expect(result).toEqual(updated);
    });

    it('throws NOT_FOUND when role does not exist', async () => {
      roleModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
      await expect(
        service.updateRole(mockRoleDoc._id.toString(), { name: 'editor' }),
      ).rejects.toThrow(RbacException);
    });
  });

  describe('listPermissions', () => {
    it('returns paginated permissions', async () => {
      permissionModel.find.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          sort: jest.fn().mockReturnThis(),
          exec: jest.fn().mockResolvedValue([mockPermissionDoc]),
        }),
      });
      permissionModel.countDocuments.mockReturnValue({ exec: jest.fn().mockResolvedValue(1) });
      const result = await service.listPermissions({ page: 1, limit: 20 });
      expect(result.data).toBeDefined();
      expect(result.total).toBe(1);
    });

    it('applies search filter when search is provided', async () => {
      permissionModel.find.mockReturnValue({
        lean: jest.fn().mockReturnValue({
          skip: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          sort: jest.fn().mockReturnThis(),
          exec: jest.fn().mockResolvedValue([]),
        }),
      });
      permissionModel.countDocuments.mockReturnValue({ exec: jest.fn().mockResolvedValue(0) });
      await service.listPermissions({ page: 1, limit: 10, search: 'role:' });
      expect(permissionModel.find).toHaveBeenCalledWith(expect.objectContaining({ code: expect.any(Object) }));
    });
  });

  describe('getPermissionByCode', () => {
    it('returns permission when found', async () => {
      permissionModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(mockPermissionDoc) });
      const result = await service.getPermissionByCode('role:create');
      expect(result).toEqual(mockPermissionDoc);
    });

    it('returns null when not found', async () => {
      permissionModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
      const result = await service.getPermissionByCode('unknown:code');
      expect(result).toBeNull();
    });
  });

  describe('addPermissionToRole', () => {
    it('adds permission and returns role', async () => {
      const populated = { ...mockRoleDoc, permissions: [mockPermissionDoc] };
      permissionModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(mockPermissionDoc) });
      roleModel.findById
        .mockReturnValueOnce({ exec: jest.fn().mockResolvedValue(mockRoleDoc) })
        .mockReturnValueOnce({ populate: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(populated) }) });
      roleModel.findByIdAndUpdate.mockReturnValue({ exec: jest.fn().mockResolvedValue(mockRoleDoc) });
      const result = await service.addPermissionToRole(mockRoleDoc._id.toString(), 'role:create');
      expect(result).toEqual(populated);
      expect(roleModel.findByIdAndUpdate).toHaveBeenCalled();
    });

    it('throws INVALID_PERMISSION_FORMAT for bad code', async () => {
      await expect(service.addPermissionToRole(mockRoleDoc._id.toString(), 'bad')).rejects.toThrow(RbacException);
    });

    it('throws NOT_FOUND when permission does not exist', async () => {
      permissionModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
      await expect(service.addPermissionToRole(mockRoleDoc._id.toString(), 'role:create')).rejects.toThrow(
        RbacException,
      );
    });

    it('throws NOT_FOUND when role does not exist', async () => {
      permissionModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(mockPermissionDoc) });
      roleModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
      await expect(service.addPermissionToRole(mockRoleDoc._id.toString(), 'role:create')).rejects.toThrow(
        RbacException,
      );
    });
  });

  describe('removePermissionFromRole', () => {
    it('removes permission', async () => {
      const roleWithPerms = { ...mockRoleDoc, permissions: [mockPermissionDoc._id] };
      roleModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(roleWithPerms) });
      roleModel.findByIdAndUpdate.mockReturnValue({ exec: jest.fn().mockResolvedValue({}) });
      await service.removePermissionFromRole(mockRoleDoc._id.toString(), mockPermissionDoc._id.toString());
      expect(roleModel.findByIdAndUpdate).toHaveBeenCalledWith(
        mockRoleDoc._id.toString(),
        expect.objectContaining({ $pull: expect.any(Object) }),
      );
    });

    it('throws NOT_FOUND when role does not exist', async () => {
      roleModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
      await expect(
        service.removePermissionFromRole(mockRoleDoc._id.toString(), mockPermissionDoc._id.toString()),
      ).rejects.toThrow(RbacException);
    });

    it('throws NOT_FOUND when permission not linked to role', async () => {
      roleModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue({ ...mockRoleDoc, permissions: [] }) });
      await expect(
        service.removePermissionFromRole(mockRoleDoc._id.toString(), mockPermissionDoc._id.toString()),
      ).rejects.toThrow(RbacException);
    });
  });

  describe('assignRoleToUser', () => {
    it('assigns role to user', async () => {
      roleModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(mockRoleDoc) });
      userRoleModel.findOneAndUpdate.mockReturnValue({ exec: jest.fn().mockResolvedValue({}) });
      await service.assignRoleToUser('user1', mockRoleDoc._id.toString());
      expect(userRoleModel.findOneAndUpdate).toHaveBeenCalled();
    });

    it('throws VALIDATION_ERROR when userId is empty', async () => {
      await expect(service.assignRoleToUser('  ', mockRoleDoc._id.toString())).rejects.toThrow(RbacException);
    });

    it('throws NOT_FOUND when userExistsValidator returns false', async () => {
      const moduleWithValidator = await Test.createTestingModule({
        providers: [
          RbacService,
          { provide: getModelToken(Role.name), useValue: roleModel },
          { provide: getModelToken(Permission.name), useValue: permissionModel },
          { provide: getModelToken(UserRole.name), useValue: userRoleModel },
          { provide: getModelToken('User'), useValue: null },
          {
            provide: RBAC_CONFIG,
            useValue: { userExistsValidator: jest.fn().mockResolvedValue(false) },
          },
        ],
      }).compile();
      const svc = moduleWithValidator.get<RbacService>(RbacService);
      roleModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(mockRoleDoc) });
      await expect(svc.assignRoleToUser('user1', mockRoleDoc._id.toString())).rejects.toThrow(RbacException);
    });

    it('throws NOT_FOUND when role does not exist', async () => {
      roleModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
      await expect(service.assignRoleToUser('user1', mockRoleDoc._id.toString())).rejects.toThrow(RbacException);
    });
  });

  describe('removeRoleFromUser', () => {
    it('removes role from user', async () => {
      roleModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(mockRoleDoc) });
      userRoleModel.findOneAndDelete.mockReturnValue({ exec: jest.fn().mockResolvedValue({}) });
      await service.removeRoleFromUser('user1', mockRoleDoc._id.toString());
      expect(userRoleModel.findOneAndDelete).toHaveBeenCalled();
    });

    it('throws NOT_FOUND when role does not exist', async () => {
      roleModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
      await expect(service.removeRoleFromUser('user1', mockRoleDoc._id.toString())).rejects.toThrow(RbacException);
    });

    it('throws NOT_FOUND when user-role assignment not found', async () => {
      roleModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(mockRoleDoc) });
      userRoleModel.findOneAndDelete.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
      await expect(service.removeRoleFromUser('user1', mockRoleDoc._id.toString())).rejects.toThrow(RbacException);
    });
  });

  describe('getUserRoles', () => {
    it('returns roles for user', async () => {
      const roleDoc = { ...mockRoleDoc, permissions: [mockPermissionDoc] };
      userRoleModel.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([{ roleId: roleDoc }]),
          }),
        }),
      });
      const result = await service.getUserRoles('user1');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(roleDoc);
    });
  });

  describe('getUserPermissions', () => {
    it('returns empty array when user has no roles', async () => {
      userRoleModel.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }),
        }),
        select: jest.fn().mockReturnValue({ lean: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }) }),
      });
      const result = await service.getUserPermissions('user1');
      expect(result).toEqual([]);
    });

    it('returns deduplicated permission codes when user has roles', async () => {
      const roleWithPerms = { ...mockRoleDoc, permissions: [mockPermissionDoc] };
      userRoleModel.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([{ roleId: roleWithPerms }]),
          }),
        }),
        select: jest.fn().mockReturnValue({ lean: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }) }),
      });
      permissionModel.find.mockReturnValue({ exec: jest.fn().mockResolvedValue([mockPermissionDoc]) });
      const result = await service.getUserPermissions('user1');
      expect(result).toContain('role:create');
    });
  });

  describe('getUsersByRole', () => {
    it('returns userIds for role', async () => {
      roleModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(mockRoleDoc) });
      userRoleModel.find.mockReturnValue({
        select: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({
            exec: jest.fn().mockResolvedValue([{ userId: 'u1' }, { userId: 'u2' }]),
          }),
        }),
      });
      const result = await service.getUsersByRole(mockRoleDoc._id.toString());
      expect(result).toEqual([{ userId: 'u1' }, { userId: 'u2' }]);
    });

    it('throws NOT_FOUND for invalid roleId', async () => {
      await expect(service.getUsersByRole('invalid')).rejects.toThrow(RbacException);
    });

    it('throws NOT_FOUND when role does not exist', async () => {
      roleModel.findById.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
      await expect(service.getUsersByRole(mockRoleDoc._id.toString())).rejects.toThrow(RbacException);
    });
  });

  describe('getDefaultRole', () => {
    it('returns role when default exists', async () => {
      const defaultRole = { ...mockRoleDoc, isDefault: true };
      roleModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(defaultRole) });
      const result = await service.getDefaultRole();
      expect(result).toEqual(defaultRole);
    });

    it('returns null when no default role', async () => {
      roleModel.findOne.mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
      const result = await service.getDefaultRole();
      expect(result).toBeNull();
    });
  });

  describe('getUserPermissions', () => {
    it('returns empty array when user has no roles', async () => {
      userRoleModel.find.mockReturnValue({
        populate: jest.fn().mockReturnValue({
          lean: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue([]) }),
        }),
      });
      const result = await service.getUserPermissions('user1');
      expect(result).toEqual([]);
    });
  });

  describe('backfillDefaultRole', () => {
    it('throws NOT_IMPLEMENTED when userModel not configured', async () => {
      await expect(service.backfillDefaultRole()).rejects.toThrow(RbacException);
    });
  });
});

import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { Role, RoleSchema } from './schemas/role.schema';
import { Permission, PermissionSchema } from './schemas/permission.schema';
import { UserRole, UserRoleSchema } from './schemas/user-role.schema';
import { RbacService, RbacConfig, RBAC_CONFIG } from './rbac.service';
import { RbacController } from './rbac.controller';
import { PermissionsAttachmentGuard } from './guards/permissions-attachment.guard';
import { RequirePermissionGuard } from './guards/require-permission.guard';
import { createCachedPermissionFetcher } from './rbac.cache';
import { getRedisClient } from '../common/lib/redis';
import { RBAC_PERMISSION_FETCHER } from './constants';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Role.name, schema: RoleSchema },
      { name: Permission.name, schema: PermissionSchema },
      { name: UserRole.name, schema: UserRoleSchema },
    ]),
  ],
  controllers: [RbacController],
  providers: [
    RbacService,
    {
      provide: RBAC_CONFIG,
      useFactory: (): RbacConfig => ({}),
    },
    {
      provide: RBAC_PERMISSION_FETCHER,
      useFactory: (rbacService: RbacService, config: ConfigService) => {
        const redis = getRedisClient();
        const ttl = config.get<number>('REDIS_CACHE_TTL_SECONDS', 300);
        return createCachedPermissionFetcher(rbacService, redis, ttl);
      },
      inject: [RbacService, ConfigService],
    },
    PermissionsAttachmentGuard,
    RequirePermissionGuard,
  ],
  exports: [RbacService],
})
export class RbacModule {}

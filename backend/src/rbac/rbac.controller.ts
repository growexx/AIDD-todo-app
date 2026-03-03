import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RbacService } from './rbac.service';
import { PermissionsAttachmentGuard } from './guards/permissions-attachment.guard';
import { RequirePermissionGuard } from './guards/require-permission.guard';
import { RequirePermission } from './decorators/require-permission.decorator';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { ListQueryDto } from './dto/list-query.dto';
import { AddPermissionDto } from './dto/add-permission.dto';
import { AssignRoleDto } from './dto/assign-role.dto';
import { PERMISSIONS } from './rbac.registry';
import { RbacException, RBAC_ERROR_CODES } from './errors/rbac.exception';

interface RequestWithUser extends Request {
  user: { userId: string; email?: string };
}

@ApiTags('RBAC')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, PermissionsAttachmentGuard, RequirePermissionGuard)
@Controller(process.env.API_PREFIX || 'api/rbac')
export class RbacController {
  constructor(private readonly rbacService: RbacService) {}

  @Post('roles')
  @RequirePermission(PERMISSIONS.ROLE_CREATE)
  @ApiOperation({ summary: 'Create a role' })
  @ApiResponse({ status: 201, description: 'Role created' })
  @ApiResponse({ status: 401, description: 'Unauthenticated' })
  @ApiResponse({ status: 403, description: 'Permission denied' })
  async createRole(@Body() dto: CreateRoleDto) {
    const role = await this.rbacService.createRole({
      name: dto.name,
      description: dto.description,
    });
    return role;
  }

  @Get('roles')
  @RequirePermission(PERMISSIONS.ROLE_VIEW)
  @ApiOperation({ summary: 'List roles with pagination' })
  @ApiResponse({ status: 200, description: 'Paginated roles' })
  async listRoles(@Query() query: ListQueryDto) {
    const result = await this.rbacService.listRoles({
      page: query.page,
      limit: query.limit,
      search: query.search,
    });
    return { data: result.data, meta: { page: result.page, limit: result.limit, total: result.total } };
  }

  @Get('roles/:id')
  @RequirePermission(PERMISSIONS.ROLE_VIEW)
  @ApiOperation({ summary: 'Get role by ID with permissions' })
  @ApiResponse({ status: 200, description: 'Role with permissions' })
  @ApiResponse({ status: 404, description: 'Role not found' })
  async getRole(@Param('id') id: string) {
    return this.rbacService.getRoleById(id);
  }

  @Patch('roles/:id')
  @RequirePermission(PERMISSIONS.ROLE_UPDATE)
  @ApiOperation({ summary: 'Update a role' })
  @ApiResponse({ status: 200, description: 'Role updated' })
  @ApiResponse({ status: 404, description: 'Role not found' })
  @ApiResponse({ status: 409, description: 'Name already taken' })
  async updateRole(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.rbacService.updateRole(id, { name: dto.name, description: dto.description });
  }

  @Delete('roles/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission(PERMISSIONS.ROLE_DELETE)
  @ApiOperation({ summary: 'Delete a role' })
  @ApiResponse({ status: 204, description: 'Role deleted' })
  @ApiResponse({ status: 404, description: 'Role not found' })
  async deleteRole(@Param('id') id: string) {
    await this.rbacService.deleteRole(id);
  }

  @Post('roles/:id/permissions')
  @RequirePermission(PERMISSIONS.PERMISSION_MANAGE)
  @ApiOperation({ summary: 'Add permission to role' })
  @ApiResponse({ status: 200, description: 'Role updated' })
  @ApiResponse({ status: 404, description: 'Role or permission not found' })
  async addPermissionToRole(@Param('id') id: string, @Body() dto: AddPermissionDto) {
    return this.rbacService.addPermissionToRole(id, dto.permissionCode);
  }

  @Delete('roles/:id/permissions/:permissionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission(PERMISSIONS.PERMISSION_MANAGE)
  @ApiOperation({ summary: 'Remove permission from role' })
  @ApiResponse({ status: 204, description: 'Permission removed' })
  @ApiResponse({ status: 404, description: 'Not found' })
  async removePermissionFromRole(
    @Param('id') id: string,
    @Param('permissionId') permissionId: string,
  ) {
    await this.rbacService.removePermissionFromRole(id, permissionId);
  }

  @Get('permissions')
  @RequirePermission(PERMISSIONS.PERMISSION_VIEW)
  @ApiOperation({ summary: 'List permissions with pagination' })
  @ApiResponse({ status: 200, description: 'Paginated permissions' })
  async listPermissions(@Query() query: ListQueryDto) {
    const result = await this.rbacService.listPermissions({
      page: query.page,
      limit: query.limit,
      search: query.search,
    });
    return { data: result.data, meta: { page: result.page, limit: result.limit, total: result.total } };
  }

  @Post('users/:id/roles')
  @RequirePermission(PERMISSIONS.ROLE_ASSIGN)
  @ApiOperation({ summary: 'Assign role to user' })
  @ApiResponse({ status: 200, description: 'Role assigned' })
  @ApiResponse({ status: 404, description: 'User or role not found' })
  async assignRoleToUser(@Param('id') id: string, @Body() dto: AssignRoleDto) {
    let roleId = dto.roleId;
    if (!roleId && dto.roleName) {
      const role = await this.rbacService.listRoles({ search: dto.roleName, limit: 1 });
      const match = role.data.find((r) => r.name === dto.roleName?.trim());
      if (!match) {
        throw new RbacException(HttpStatus.NOT_FOUND, RBAC_ERROR_CODES.NOT_FOUND, 'Role not found');
      }
      roleId = match._id.toString();
    }
    if (!roleId) {
      throw new RbacException(
        HttpStatus.BAD_REQUEST,
        RBAC_ERROR_CODES.VALIDATION_ERROR,
        'roleId or roleName is required',
      );
    }
    await this.rbacService.assignRoleToUser(id, roleId);
    return { assigned: true };
  }

  @Delete('users/:id/roles/:roleId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission(PERMISSIONS.ROLE_REVOKE)
  @ApiOperation({ summary: 'Revoke role from user' })
  @ApiResponse({ status: 204, description: 'Role revoked' })
  @ApiResponse({ status: 404, description: 'User-role link not found' })
  async removeRoleFromUser(@Param('id') id: string, @Param('roleId') roleId: string) {
    await this.rbacService.removeRoleFromUser(id, roleId);
  }

  @Get('users/:id/roles')
  @RequirePermission(PERMISSIONS.ROLE_VIEW)
  @ApiOperation({ summary: 'Get all roles for a user' })
  @ApiResponse({ status: 200, description: 'List of roles with permissions' })
  async getUserRoles(@Param('id') id: string) {
    const roles = await this.rbacService.getUserRoles(id);
    return { data: roles };
  }

  @Get('users/:id/permissions')
  @RequirePermission(PERMISSIONS.USER_VIEW_PERMISSIONS)
  @ApiOperation({ summary: 'Get aggregated permissions for a user' })
  @ApiResponse({ status: 200, description: 'userId and permissions array' })
  async getUserPermissions(@Param('id') id: string) {
    if (!id?.trim()) {
      throw new RbacException(
        HttpStatus.BAD_REQUEST,
        RBAC_ERROR_CODES.VALIDATION_ERROR,
        'User ID is required',
      );
    }
    const permissions = await this.rbacService.getUserPermissions(id.trim());
    return { userId: id.trim(), permissions };
  }
}

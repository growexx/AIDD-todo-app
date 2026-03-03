import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, Matches } from 'class-validator';

const PERMISSION_REGEX =
  /^(\*:\*|[a-z][a-z0-9_-]*:\*|[a-z][a-z0-9_-]*:[a-z][a-z0-9_-]*)$/;

export class AddPermissionDto {
  @ApiProperty({ example: 'role:create' })
  @IsString()
  @IsNotEmpty()
  @Matches(PERMISSION_REGEX, { message: 'Invalid permission code format' })
  permissionCode: string;
}

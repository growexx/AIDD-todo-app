import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsMongoId, IsString, IsNotEmpty } from 'class-validator';

export class AssignRoleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsMongoId()
  roleId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  roleName?: string;
}

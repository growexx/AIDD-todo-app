import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Length } from 'class-validator';

export class VerifyMfaDto {
  @ApiProperty({ example: 'eyJhbGc...', description: 'Temporary token from login when requiresMfa' })
  @IsOptional()
  @IsString()
  tempToken?: string;

  @ApiProperty({ example: 'eyJhbGc...', deprecated: true, description: 'Use tempToken' })
  @IsOptional()
  @IsString()
  mfaPendingToken?: string;

  @ApiProperty({ example: '123456', description: '6-digit TOTP or backup code' })
  @IsString()
  @IsNotEmpty()
  @Length(6, 10)
  code: string;
}

import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length } from 'class-validator';

export class VerifyMfaDto {
  @ApiProperty({ example: 'eyJhbGc...' })
  @IsString()
  @IsNotEmpty()
  mfaPendingToken: string;

  @ApiProperty({ example: '123456', description: '6-digit TOTP or backup code' })
  @IsString()
  @IsNotEmpty()
  @Length(6, 10)
  code: string;
}

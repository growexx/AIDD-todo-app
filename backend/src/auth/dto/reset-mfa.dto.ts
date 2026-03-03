import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class ResetMfaDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  token: string;
}

import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

/**
 * DTO for login request body.
 */
export class LoginDto {
  @ApiProperty({ example: 'alice@todoapp.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'Alice@123' })
  @IsString()
  @IsNotEmpty()
  password: string;
}

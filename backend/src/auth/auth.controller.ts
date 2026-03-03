import {
  Controller,
  Post,
  Get,
  Body,
  Req,
  UseGuards,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { VerifyMfaDto } from './dto/verify-mfa.dto';
import { MfaConfirmDto } from './dto/mfa-confirm.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ResetMfaDto } from './dto/reset-mfa.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import type { RequestWithUser } from './types';

const ACCOUNT_LOCKED_MESSAGE =
  'Account locked. Check your email for reset instructions.';
const INVALID_CREDENTIALS_MESSAGE = 'Invalid credentials';

@ApiTags('Auth')
@Controller('api/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @UseGuards(ThrottlerGuard)
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({ status: 200, description: 'Login successful or requires MFA' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 403, description: 'Account locked' })
  @ApiResponse({ status: 429, description: 'Too Many Requests' })
  async login(@Body() dto: LoginDto) {
    const result = await this.authService.login(dto.email, dto.password);

    if (result === null) {
      throw new UnauthorizedException(INVALID_CREDENTIALS_MESSAGE);
    }
    if (result === 'locked') {
      throw new ForbiddenException(ACCOUNT_LOCKED_MESSAGE);
    }

    return result;
  }

  @Post('verify-mfa')
  @UseGuards(ThrottlerGuard)
  @ApiOperation({ summary: 'Verify TOTP or backup code after login when MFA is enabled' })
  @ApiResponse({ status: 200, description: 'MFA verified; returns token and user' })
  @ApiResponse({ status: 401, description: 'Invalid or expired session / code' })
  async verifyMfa(@Body() dto: VerifyMfaDto) {
    const result = await this.authService.verifyMfa(dto.mfaPendingToken, dto.code);
    if (!result || result === 'locked' || 'requiresMfa' in result) {
      throw new UnauthorizedException('Invalid verification code');
    }
    return result;
  }

  @Post('mfa/setup')
  @UseGuards(ThrottlerGuard, JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Start MFA setup; returns QR URI and backup codes' })
  @ApiResponse({ status: 200, description: 'QR and backup codes' })
  @ApiResponse({ status: 401, description: 'Unauthorised' })
  async mfaSetup(@Req() req: RequestWithUser) {
    return this.authService.mfaSetup(req.user.userId);
  }

  @Post('mfa/confirm')
  @UseGuards(ThrottlerGuard, JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Confirm MFA with one TOTP code' })
  @ApiResponse({ status: 200, description: 'MFA enabled' })
  @ApiResponse({ status: 401, description: 'Invalid code' })
  async mfaConfirm(@Req() req: RequestWithUser, @Body() dto: MfaConfirmDto) {
    await this.authService.mfaConfirm(req.user.userId, dto.code);
    return { message: 'MFA enabled' };
  }

  @Get('mfa/status')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user MFA status' })
  @ApiResponse({ status: 200, description: 'mfaEnabled boolean' })
  async mfaStatus(@Req() req: RequestWithUser) {
    return this.authService.getMfaStatus(req.user.userId);
  }

  @Post('reset-password')
  @UseGuards(ThrottlerGuard)
  @ApiOperation({ summary: 'Reset password using token from email' })
  @ApiResponse({ status: 200, description: 'Password reset' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto.token, dto.newPassword);
    return { message: 'Password reset successfully' };
  }

  @Post('reset-mfa')
  @UseGuards(ThrottlerGuard)
  @ApiOperation({ summary: 'Reset MFA using token from email' })
  @ApiResponse({ status: 200, description: 'MFA reset' })
  @ApiResponse({ status: 400, description: 'Invalid or expired token' })
  async resetMfa(@Body() dto: ResetMfaDto) {
    await this.authService.resetMfa(dto.token);
    return { message: 'MFA reset successfully' };
  }
}

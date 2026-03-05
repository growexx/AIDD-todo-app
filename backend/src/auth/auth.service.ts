import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import { User, UserDocument } from './schemas/user.schema';
import { EmailService } from './email.service';
import {
  encryptMfaSecret,
  decryptMfaSecret,
  generateResetToken,
  hashResetToken,
} from './crypto.util';
import {
  MAX_FAILED_ATTEMPTS,
  DEFAULT_LOCKOUT_MINUTES,
  RESET_TOKEN_TTL_HOURS,
  TEMP_JWT_TTL,
} from '../common/constants/auth.constants';

const MFA_SETUP_PENDING_EXPIRY_MS = 10 * 60 * 1000; // 10 min
const BACKUP_CODES_COUNT = 8;
const BACKUP_CODE_LENGTH = 8;

export type LoginResult =
  | { access_token: string; user: { id: string; name: string; email: string } }
  | { requiresMfa: true; mfaPendingToken: string }
  | 'locked'
  | null;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
  ) {}

  private getMaxFailedAttempts(): number {
    return Number(this.configService.get('MAX_FAILED_ATTEMPTS')) || MAX_FAILED_ATTEMPTS;
  }

  private getLockoutDurationMinutes(): number {
    return Number(this.configService.get('LOCKOUT_DURATION_MINUTES')) || DEFAULT_LOCKOUT_MINUTES;
  }

  private getFrontendUrl(): string {
    return this.configService.get('FRONTEND_URL') || 'http://localhost:3000';
  }

  private getMfaEncryptionKey(): string {
    const key = this.configService.get<string>('MFA_ENCRYPTION_KEY');
    if (!key || key.length !== 64) {
      throw new BadRequestException('MFA_ENCRYPTION_KEY must be 64 hex characters');
    }
    return key;
  }

  private isLocked(user: UserDocument): boolean {
    const until = user.lockedUntil;
    return !!until && new Date(until).getTime() > Date.now();
  }

  /**
   * Validates email and password; returns user document or null. Does not check lockout.
   */
  async validateUser(email: string, password: string): Promise<UserDocument | null> {
    const user = await this.userModel
      .findOne({ email })
      .select('+password +failedLoginAttempts +lockedUntil');
    if (!user) return null;
    const match = await user.comparePassword(password);
    if (!match) return null;
    return user;
  }

  /**
   * Find user by email (for login flow to increment failed attempts or check locked).
   * Input is DTO-validated; raw user string not interpolated into query.
   */
  async findUserByEmailForLogin(email: string): Promise<UserDocument | null> {
    return this.userModel
      .findOne({ email: email.toLowerCase().trim() })
      .select('+password +failedLoginAttempts +lockedUntil +mfaEnabled +mfaSecret')
      .exec();
  }

  /**
   * Full login flow: locked -> 403, invalid -> increment/lock+email or 401, valid+MFA -> mfaPendingToken, valid -> JWT.
   * Throws UnauthorizedException / ForbiddenException; never returns null for flow clarity when using spec-aligned API.
   */
  async login(email: string, password: string): Promise<LoginResult> {
    const user = await this.findUserByEmailForLogin(email);
    if (!user) {
      this.logger.warn('Login failed — user not found', { email });
      throw new UnauthorizedException('Invalid email or password');
    }

    if (this.isLocked(user)) {
      this.logger.warn('Login attempt on locked account', { email: user.email });
      throw new ForbiddenException(
        'Account locked. Check your email for reset instructions.',
      );
    }

    const passwordValid = await user.comparePassword(password);
    if (!passwordValid) {
      await this.handleFailedLogin(user);
      this.logger.warn('Failed login attempt', {
        email: user.email,
        attempts: user.failedLoginAttempts,
      });
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.mfaEnabled) {
      const mfaPendingToken = this.jwtService.sign(
        {
          sub: user._id.toString(),
          email: user.email,
          mfaPending: true,
        },
        {
          expiresIn: this.configService.get('TEMP_JWT_TTL') ?? TEMP_JWT_TTL,
          secret: this.configService.get<string>('JWT_SECRET'),
        } as JwtSignOptions,
      );
      return { requiresMfa: true, mfaPendingToken };
    }

    await this.clearLockout(user._id);
    return this.issueToken(user);
  }

  /**
   * On failed password: increment attempts; on 5th failure set lockout, store SHA-256 reset token, send email (fire-and-forget).
   */
  private async handleFailedLogin(user: UserDocument): Promise<void> {
    const max = this.getMaxFailedAttempts();
    const attempts = (user.failedLoginAttempts ?? 0) + 1;
    user.failedLoginAttempts = attempts;
    if (attempts >= max) {
      const lockoutMs = this.getLockoutDurationMinutes() * 60 * 1000;
      user.lockedUntil = new Date(Date.now() + lockoutMs);
      const rawToken = generateResetToken();
      const tokenHash = hashResetToken(rawToken);
      const expiryHours = Number(this.configService.get('RESET_TOKEN_TTL_HOURS')) || RESET_TOKEN_TTL_HOURS;
      const expiry = new Date(Date.now() + expiryHours * 60 * 60 * 1000);
      user.passwordResetToken = tokenHash;
      user.passwordResetTokenExpiry = expiry;
      user.mfaResetToken = tokenHash;
      user.mfaResetTokenExpiry = expiry;
      await user.save();
      const frontendUrl = this.getFrontendUrl();
      const resetLink = `${frontendUrl}/reset-account?token=${rawToken}`;
      this.emailService
        .sendAccountLockedEmail(user.email, resetLink)
        .catch((err: Error) => this.logger.error('Email failed', err.message));
      throw new ForbiddenException(
        'Account locked. Check your email for reset instructions.',
      );
    }
    await user.save();
  }

  private async clearLockout(userId: Types.ObjectId): Promise<void> {
    await this.userModel.updateOne(
      { _id: userId },
      { $set: { failedLoginAttempts: 0 }, $unset: { lockedUntil: 1 } },
    );
  }

  private issueToken(user: UserDocument): {
    access_token: string;
    user: { id: string; name: string; email: string };
  } {
    const payload = { email: user.email, sub: user._id.toString() };
    const access_token = this.jwtService.sign(payload, {
      expiresIn: this.configService.get('JWT_EXPIRES_IN') as string,
    } as JwtSignOptions);
    return {
      access_token,
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
      },
    };
  }

  /**
   * Verify MFA code (TOTP or backup) and issue full JWT.
   */
  async verifyMfa(mfaPendingToken: string, code: string): Promise<LoginResult> {
    let payload: { sub: string; email: string; mfaPending?: boolean };
    try {
      payload = this.jwtService.verify<typeof payload>(mfaPendingToken);
    } catch {
      throw new UnauthorizedException('Invalid or expired verification session. Please log in again.');
    }
    if (!payload.mfaPending || !payload.sub) {
      throw new UnauthorizedException('Invalid verification session.');
    }

    const user = await this.userModel
      .findById(payload.sub)
      .select('+mfaSecret +mfaBackupCodes +failedLoginAttempts +lockedUntil');
    if (!user) throw new UnauthorizedException('Invalid verification code');

    const key = this.getMfaEncryptionKey();
    const secretDecrypted = user.mfaSecret
      ? decryptMfaSecret(user.mfaSecret, key)
      : null;

    let valid = false;
    if (secretDecrypted) {
      valid = speakeasy.totp.verify({
        secret: secretDecrypted,
        encoding: 'base32',
        token: code,
        window: 1,
      });
    }
    if (!valid && user.mfaBackupCodes?.length) {
      for (const entry of user.mfaBackupCodes) {
        if (entry.used) continue;
        const match = await bcrypt.compare(code, entry.codeHash);
        if (match) {
          entry.used = true;
          valid = true;
          break;
        }
      }
      if (valid) await user.save();
    }

    if (!valid) {
      throw new UnauthorizedException('Invalid verification code');
    }

    await this.clearLockout(user._id);
    return this.issueToken(user);
  }

  /**
   * Start MFA setup: generate secret, store pending, return QR URI and backup codes.
   */
  async mfaSetup(userId: string): Promise<{
    qrUri: string;
    qrDataUrl: string;
    backupCodes: string[];
    secret: string;
  }> {
    const user = await this.userModel.findById(userId).select('+mfaSecretPending +mfaSecretPendingExpiry').exec();
    if (!user) throw new UnauthorizedException('User not found');
    if (user.mfaEnabled) throw new BadRequestException('MFA is already enabled');

    const secret = speakeasy.generateSecret({
      name: `TodoApp (${user.email})`,
      length: 20,
    });
    const key = this.getMfaEncryptionKey();
    const encrypted = encryptMfaSecret(secret.base32, key);

    const backupCodes: string[] = [];
    const backupHashes: { codeHash: string; used: boolean }[] = [];
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    for (let i = 0; i < BACKUP_CODES_COUNT; i++) {
      let code = '';
      for (let j = 0; j < BACKUP_CODE_LENGTH; j++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      backupCodes.push(code);
      backupHashes.push({
        codeHash: await bcrypt.hash(code, 10),
        used: false,
      });
    }

    user.mfaSecretPending = encrypted;
    user.mfaSecretPendingExpiry = new Date(Date.now() + MFA_SETUP_PENDING_EXPIRY_MS);
    user.mfaBackupCodes = backupHashes;
    await user.save();

    const qrUri = secret.otpauth_url!;
    const qrDataUrl = await QRCode.toDataURL(qrUri);

    return {
      qrUri,
      qrDataUrl,
      backupCodes,
      secret: secret.base32,
    };
  }

  /**
   * Confirm MFA setup with one TOTP code; enable MFA and persist secret.
   */
  async mfaConfirm(userId: string, code: string): Promise<void> {
    const user = await this.userModel
      .findById(userId)
      .select('+mfaSecretPending +mfaSecretPendingExpiry')
      .exec();
    if (!user) throw new UnauthorizedException('User not found');
    if (!user.mfaSecretPending || !user.mfaSecretPendingExpiry) {
      throw new BadRequestException('No MFA setup in progress. Start setup first.');
    }
    if (new Date(user.mfaSecretPendingExpiry).getTime() < Date.now()) {
      user.mfaSecretPending = undefined;
      user.mfaSecretPendingExpiry = undefined;
      await user.save();
      throw new BadRequestException('MFA setup expired. Please start again.');
    }

    const key = this.getMfaEncryptionKey();
    const secret = decryptMfaSecret(user.mfaSecretPending, key);
    const valid = speakeasy.totp.verify({
      secret,
      encoding: 'base32',
      token: code,
      window: 1,
    });
    if (!valid) {
      throw new UnauthorizedException('Invalid verification code');
    }

    user.mfaSecret = user.mfaSecretPending;
    user.mfaEnabled = true;
    user.mfaSecretPending = undefined;
    user.mfaSecretPendingExpiry = undefined;
    await user.save();
  }

  /**
   * Reset password using token from email; clear lockout.
   * Input is DTO-validated; query uses SHA-256 hash of token, not raw user input.
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    const tokenHash = hashResetToken(token);
    const target = await this.userModel
      .findOne({
        passwordResetToken: tokenHash,
        passwordResetTokenExpiry: { $gt: new Date() },
      })
      .select('+password +passwordResetToken +passwordResetTokenExpiry')
      .exec();
    if (!target) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    target.password = newPassword;
    target.passwordResetToken = undefined;
    target.passwordResetTokenExpiry = undefined;
    target.failedLoginAttempts = 0;
    target.lockedUntil = undefined;
    await target.save();
    this.logger.log('Password reset successful', { userId: target._id.toString() });
  }

  /**
   * Reset MFA using token from email link (same token as password reset).
   * Input is DTO-validated; query uses SHA-256 hash of token, not raw user input.
   */
  async resetMfa(token: string): Promise<void> {
    const tokenHash = hashResetToken(token);
    const target = await this.userModel
      .findOne({
        mfaResetToken: tokenHash,
        mfaResetTokenExpiry: { $gt: new Date() },
      })
      .select('+mfaResetToken +mfaResetTokenExpiry')
      .exec();
    if (!target) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    target.mfaEnabled = false;
    target.mfaSecret = undefined;
    target.mfaBackupCodes = undefined;
    target.mfaSecretPending = undefined;
    target.mfaSecretPendingExpiry = undefined;
    target.mfaResetToken = undefined;
    target.mfaResetTokenExpiry = undefined;
    await target.save();
    this.logger.log('MFA reset successful', { userId: target._id.toString() });
  }

  /**
   * Return current user's MFA status (for settings page).
   */
  async getMfaStatus(userId: string): Promise<{ mfaEnabled: boolean }> {
    const user = await this.userModel.findById(userId).select('mfaEnabled').exec();
    if (!user) throw new UnauthorizedException('User not found');
    return { mfaEnabled: !!user.mfaEnabled };
  }
}

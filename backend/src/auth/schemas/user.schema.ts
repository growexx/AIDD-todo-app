import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import * as bcrypt from 'bcryptjs';

export type UserDocument = User & Document & {
  comparePassword(candidate: string): Promise<boolean>;
};

/** Single backup code entry: hashed value and whether it has been used. */
export interface MfaBackupCodeEntry {
  codeHash: string;
  used: boolean;
}

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, trim: true, minlength: 2, maxlength: 50 })
  name: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true, select: false })
  password: string;

  @Prop({ default: Date.now })
  createdAt: Date;

  /** MFA */
  @Prop({ default: false })
  mfaEnabled: boolean;

  /** Encrypted TOTP secret; only set when mfaEnabled is true. */
  @Prop({ select: false })
  mfaSecret?: string;

  /** Temporary encrypted secret during MFA setup; cleared after confirm or expiry. */
  @Prop({ select: false })
  mfaSecretPending?: string;

  @Prop({ default: undefined })
  mfaSecretPendingExpiry?: Date;

  /** Hashed backup codes; single-use. */
  @Prop({ type: [{ codeHash: String, used: Boolean }], default: undefined, select: false })
  mfaBackupCodes?: MfaBackupCodeEntry[];

  /** Lockout */
  @Prop({ default: 0 })
  failedLoginAttempts: number;

  @Prop({ default: undefined })
  lockedUntil?: Date;

  /** Reset tokens (single-use, time-limited) */
  @Prop({ select: false })
  passwordResetToken?: string;

  @Prop({ default: undefined })
  passwordResetTokenExpiry?: Date;

  @Prop({ select: false })
  mfaResetToken?: string;

  @Prop({ default: undefined })
  mfaResetTokenExpiry?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
});

UserSchema.methods.comparePassword = function (candidate: string): Promise<boolean> {
  return bcrypt.compare(candidate, this.password);
};

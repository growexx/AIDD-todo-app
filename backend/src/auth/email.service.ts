import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

const LOCKED_SUBJECT = 'Account locked – reset your password and MFA';
const LOCKED_BODY_TEMPLATE = `Your account has been locked after {{max_failed_attempts}} failed login attempts. Use the link below to reset your password and MFA. This link expires in 1 hour.

{{reset_link}}

If you did not request this, please secure your account.`;

@Injectable()
export class EmailService {
  private transporter: Transporter | null = null;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('SMTP_HOST');
    const port = this.configService.get<number>('SMTP_PORT');
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');
    if (host && port !== undefined) {
      this.transporter = nodemailer.createTransport({
        host,
        port: Number(port),
        secure: port === 465,
        auth: user && pass ? { user, pass } : undefined,
      });
    }
  }

  /**
   * Send "account locked" email with reset link. No-op if SMTP is not configured.
   */
  async sendAccountLockedEmail(to: string, resetLink: string): Promise<void> {
    const maxAttempts = this.configService.get<number>('MAX_FAILED_ATTEMPTS') ?? 5;
    const body = LOCKED_BODY_TEMPLATE
      .replace('{{max_failed_attempts}}', String(maxAttempts))
      .replace('{{reset_link}}', resetLink);

    await this.sendMail({
      to,
      subject: LOCKED_SUBJECT,
      text: body,
      html: body.replace(/\n/g, '<br>'),
    });
  }

  private async sendMail(options: {
    to: string;
    subject: string;
    text: string;
    html?: string;
  }): Promise<void> {
    const from =
      this.configService.get<string>('SMTP_FROM') ??
      this.configService.get<string>('SMTP_USER') ??
      'noreply@todoapp.local';

    if (!this.transporter) {
      if (this.configService.get('NODE_ENV') !== 'production') {
        // eslint-disable-next-line no-console
        console.log('[EmailService] No SMTP configured. Would send:', {
          from,
          to: options.to,
          subject: options.subject,
        });
      }
      return;
    }

    await this.transporter.sendMail({
      from,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html ?? options.text,
    });
  }
}

import { Injectable } from '@nestjs/common';
import nodemailer from 'nodemailer';

@Injectable()
export class MailService {
  async sendOtp(to: string, code: string, purpose: 'verify' | 'reset'): Promise<void> {
    const user = process.env.GMAIL_USER?.trim();
    const pass = process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, '');
    if (!user || !pass) throw new Error('Gmail SMTP is not configured');

    const transport = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user, pass },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 10000,
      disableFileAccess: true,
      disableUrlAccess: true,
    });
    const action = purpose === 'verify' ? 'xác minh email' : 'đặt lại mật khẩu';
    try {
      await transport.sendMail({
        from: `May Day <${user}>`,
        to,
        subject: `Mã ${action} May Day`,
        text: `Mã ${action} May Day của bạn là ${code}. Mã có hiệu lực 10 phút. Nếu bạn không yêu cầu, hãy bỏ qua email này.`,
      });
    } finally {
      transport.close();
    }
  }
}

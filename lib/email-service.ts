import nodemailer from 'nodemailer';
import { Guest, Wedding, WeddingFunction } from './types';
import { formatDate } from './whatsapp';

export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
}

/**
 * Service to handle email operations using Nodemailer
 */
export class EmailService {
  /**
   * Creates a transporter from the given SMTP config or falls back to env vars
   */
  private static createTransporter(config?: SmtpConfig) {
    const host = config?.host || process.env.SMTP_HOST;
    const port = config?.port || parseInt(process.env.SMTP_PORT || '587');
    const user = config?.user || process.env.SMTP_USER;
    const pass = config?.pass || process.env.SMTP_PASS;

    return nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
  }

  /**
   * Formats the wedding functions list for the email body
   */
  private static formatFunctions(guest: Guest, functions: WeddingFunction[]): string {
    return functions
      .filter((f) => guest.function_ids.includes(f.id))
      .map((f) => `• ${f.name}: ${formatDate(f.date)} at ${f.venue_name}`)
      .join('\n');
  }

  /**
   * Generates the personalized email content
   */
  private static generateContent(guest: Guest, wedding: Wedding, functions: WeddingFunction[]) {
    const guestFunctions = this.formatFunctions(guest, functions);
    const rsvpLink = `${process.env.NEXT_PUBLIC_BASE_URL}/invite/${guest.invite_token}/rsvp`;

    const subject = `Invitation: Wedding of ${wedding.bride_name} & ${wedding.groom_name}`;
    const text = `Hi ${guest.name},

You're invited to ${wedding.bride_name} & ${wedding.groom_name}'s wedding celebrations!

Your Events:
${guestFunctions}

Please RSVP here:
${rsvpLink}

We look forward to celebrating with you!

Best,
${wedding.wedding_name} Team`;

    const html = `
      <div style="font-family: sans-serif; line-height: 1.6; color: #333;">
        <h2>Hi ${guest.name},</h2>
        <p>You're invited to <strong>${wedding.bride_name} & ${wedding.groom_name}'s</strong> wedding celebrations!</p>
        
        <h3>Your Events:</h3>
        <ul style="list-style-type: none; padding-left: 0;">
          ${functions
            .filter((f) => guest.function_ids.includes(f.id))
            .map((f) => `<li style="margin-bottom: 10px;"><strong>${f.name}</strong>: ${formatDate(f.date)} at ${f.venue_name}</li>`)
            .join('')}
        </ul>

        <div style="margin: 30px 0;">
          <a href="${rsvpLink}" style="background-color: #be185d; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">RSVP Now</a>
        </div>

        <p>We look forward to celebrating with you!</p>
        <p>Best,<br><strong>${wedding.wedding_name} Team</strong></p>
      </div>
    `;

    return { subject, text, html };
  }

  /**
   * Sends a personalized email to a single guest
   * Accepts optional SmtpConfig for per-user credentials
   */
  public static async sendInvitation(guest: Guest, wedding: Wedding, functions: WeddingFunction[], smtpConfig?: SmtpConfig) {
    if (!guest.email) {
      throw new Error(`Email address missing for guest: ${guest.name}`);
    }

    const { subject, text, html } = this.generateContent(guest, wedding, functions);
    const transporter = this.createTransporter(smtpConfig);
    const fromEmail = smtpConfig?.user || process.env.SMTP_FROM || process.env.SMTP_USER;

    return await transporter.sendMail({
      from: fromEmail,
      to: guest.email,
      subject,
      text,
      html,
    });
  }
}

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
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Wedding Invitation</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #fdfaf8; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="table-layout: fixed;">
          <tr>
            <td align="center" style="padding: 40px 20px;">
              <!-- Main Card -->
              <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 10px 40px rgba(0,0,0,0.05); border: 1px solid #f0e6e0;">
                
                <!-- Hero Header -->
                <tr>
                  <td align="center" style="padding: 60px 40px 40px 40px; background: linear-gradient(135deg, #fff7f6 0%, #ffffff 100%);">
                    <div style="font-size: 14px; font-weight: 800; color: #be185d; text-transform: uppercase; letter-spacing: 3px; margin-bottom: 20px;">Invitation</div>
                    <h1 style="margin: 0; font-size: 32px; color: #1e293b; font-weight: 900; letter-spacing: -1px; line-height: 1.2;">
                      ${wedding.bride_name} <span style="color: #be185d;">&</span> ${wedding.groom_name}
                    </h1>
                    <div style="margin-top: 15px; height: 2px; width: 40px; background-color: #be185d; display: inline-block;"></div>
                  </td>
                </tr>

                <!-- Content Body -->
                <tr>
                  <td style="padding: 0 40px 40px 40px; text-align: center;">
                    <p style="font-size: 18px; color: #475569; margin: 0 0 32px 0; line-height: 1.6;">
                      Hi <strong>${guest.name}</strong>, we are delighted to invite you to join us in celebrating our wedding!
                    </p>

                    <!-- Events Section -->
                    <div style="background-color: #fcf8f6; border-radius: 20px; padding: 32px; text-align: left; margin-bottom: 40px;">
                      <h3 style="margin: 0 0 20px 0; font-size: 16px; color: #1e293b; font-weight: 800; text-transform: uppercase; letter-spacing: 1px;">Your Guest Itinerary</h3>
                      
                      <table border="0" cellpadding="0" cellspacing="0" width="100%">
                        ${functions
                          .filter((f) => guest.function_ids.includes(f.id))
                          .map((f, idx, arr) => `
                            <tr>
                              <td style="padding: ${idx === 0 ? '0' : '20px'} 0; border-top: ${idx === 0 ? 'none' : '1px solid #efe4dd'};">
                                <div style="font-size: 16px; font-weight: 700; color: #1e293b; margin-bottom: 4px;">${f.name}</div>
                                <div style="font-size: 14px; color: #64748b; font-weight: 500; display: flex; align-items: center; gap: 8px;">
                                  <span style="color: #be185d;">📅</span> ${formatDate(f.date)}
                                </div>
                                <div style="font-size: 14px; color: #64748b; font-weight: 500; margin-top: 4px;">
                                  <span style="color: #be185d;">📍</span> ${f.venue_name}
                                </div>
                              </td>
                            </tr>
                          `).join('')}
                      </table>
                    </div>

                    <!-- RSVP Button -->
                    <table border="0" cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td align="center">
                          <a href="${rsvpLink}" style="display: inline-block; background-color: #be185d; color: #ffffff; padding: 20px 48px; border-radius: 16px; text-decoration: none; font-size: 16px; font-weight: 800; box-shadow: 0 10px 20px rgba(190, 24, 93, 0.2); transition: all 0.3s ease;">
                            Kindly RSVP Here
                          </a>
                        </td>
                      </tr>
                    </table>

                    <p style="margin-top: 40px; font-size: 14px; color: #94a3b8; font-weight: 500;">
                      We look forward to sharing this special day with you!
                    </p>
                  </td>
                </tr>

                <!-- Footer Branding -->
                <tr>
                  <td align="center" style="padding: 32px; background-color: #f8fafc; border-top: 1px solid #f1f5f9;">
                    <div style="font-size: 12px; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 1px;">
                      From the desk of <strong>${wedding.wedding_name}</strong>
                    </div>
                    <div style="font-size: 11px; color: #94a3b8; margin-top: 8px;">
                      Powered by WedSync • Premium Wedding Management
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
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

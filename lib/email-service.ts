import nodemailer from 'nodemailer';
import { Guest, Wedding, WeddingFunction } from './types';
import { formatDate } from './whatsapp';

const translations = {
  en: {
    invitationHeader: "You are Cordially Invited",
    groom_and_bride: "&",
    weddingCelebration: "Wedding Celebration",
    dear: "Dear",
    requestPleasure: "We request the pleasure of your company at the wedding celebrations of our children.",
    viewInvite: "View Invitation & RSVP",
    orScanQR: "Or scan the QR code on your card",
    fromDeskOf: "From the desk of",
    poweredBy: "Powered by WedSync • Premium Wedding Management"
  },
  hi: {
    invitationHeader: "आप सादर आमंत्रित हैं",
    groom_and_bride: "और",
    weddingCelebration: "विवाह समारोह",
    dear: "प्रिय",
    requestPleasure: "हम अपने बच्चों के विवाह उत्सव में आपकी उपस्थिति का आनंद लेने का अनुरोध करते हैं।",
    viewInvite: "निमंत्रण और RSVP देखें",
    orScanQR: "या अपने कार्ड पर QR कोड स्कैन करें",
    fromDeskOf: "की ओर से",
    poweredBy: "WedSync द्वारा संचालित • प्रीमियम विवाह प्रबंधन"
  }
};

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
  private static generateContent(
    guest: Guest,
    wedding: Wedding,
    functions: WeddingFunction[]
  ): { subject: string; text: string; html: string } {
    const locale = (guest as any).locale || 'en';
    const t = translations[locale as 'en' | 'hi'] || translations.en;
    const inviteUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/${locale}/invite/${guest.invite_token}`;
    
    // Theme-specific styles and structures
    const templateId = wedding.template_id || 'royal';
    
    const themes: Record<string, { bg: string, cardBg: string, accent: string, text: string, textSecondary: string }> = {
      royal: {
        bg: '#570000',
        cardBg: '#3d0000',
        accent: '#e9c349',
        text: '#ffffff',
        textSecondary: 'rgba(233,195,73,0.7)',
      },
      minimal: {
        bg: '#f9f9f9',
        cardBg: '#ffffff',
        accent: '#8a4853',
        text: '#1a1c1c',
        textSecondary: '#524345',
      },
      floral: {
        bg: '#faf9f6',
        cardBg: '#ffffff',
        accent: '#7b5455',
        text: '#1a1c1a',
        textSecondary: '#4f4443',
      },
      dark: {
        bg: '#0b141f',
        cardBg: '#18202c',
        accent: '#f2ca50',
        text: '#dae3f3',
        textSecondary: '#7f735a',
      },
      bohemian: {
        bg: '#fdf9f4',
        cardBg: '#f1ede8',
        accent: '#914730',
        text: '#1c1c19',
        textSecondary: '#54433e',
      }
    };

    const theme = themes[templateId] || themes.royal;

    const guestFunctionsHtml = functions
      .filter((f) => guest.function_ids.includes(f.id))
      .map(
        (f) => `
      <div style="margin-bottom: 25px; padding-bottom: 25px; border-bottom: 1px solid ${theme.accent}20;">
        <p style="text-transform: uppercase; letter-spacing: 3px; font-size: 10px; font-weight: 700; color: ${theme.accent}; margin: 0 0 8px 0;">${f.name}</p>
        <p style="font-size: 18px; color: ${theme.text}; margin: 0 0 5px 0;">${new Date(f.date).toLocaleDateString(locale === 'hi' ? 'hi-IN' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
        <p style="font-size: 13px; color: ${theme.textSecondary}; margin: 0;">${f.time} onwards • ${f.venue_name}</p>
      </div>`
      )
      .join("");

    const subject = `Invitation: Wedding of ${wedding.bride_name} & ${wedding.groom_name}`;
    const text = `Hi ${guest.name}, You're invited to ${wedding.bride_name} & ${wedding.groom_name}'s wedding! View details and RSVP here: ${inviteUrl}`;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <link href="https://fonts.googleapis.com/css2?family=Great+Vibes&family=Inter:wght@300;400;700&display=swap" rel="stylesheet">
        </head>
        <body style="margin: 0; padding: 0; font-family: 'Inter', sans-serif; background-color: ${theme.bg}; color: ${theme.text}; line-height: 1.6;">
          <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: ${theme.bg};">
            <tr>
              <td align="center" style="padding: 40px 20px;">
                <table width="100%" max-width="500" border="0" cellspacing="0" cellpadding="0" style="background-color: ${theme.cardBg}; border-radius: 12px; border-top: 4px solid ${theme.accent}; max-width: 500px; box-shadow: 0 20px 40px rgba(0,0,0,0.2);">
                  <tr>
                    <td style="padding: 50px 40px;">
                      <div style="text-align: center; margin-bottom: 40px;">
                        <p style="text-transform: uppercase; letter-spacing: 5px; font-size: 10px; color: ${theme.textSecondary}; margin-bottom: 20px;">${t.invitationHeader || 'You are Cordially Invited'}</p>
                        <h1 style="font-family: 'Great Vibes', cursive, serif; font-size: 42px; color: ${theme.text}; font-weight: normal; margin: 0;">${wedding.bride_name}</h1>
                        <div style="margin: 15px 0; color: ${theme.accent}; font-weight: 300; letter-spacing: 3px;">&amp;</div>
                        <h1 style="font-family: 'Great Vibes', cursive, serif; font-size: 42px; color: ${theme.text}; font-weight: normal; margin: 0;">${wedding.groom_name}</h1>
                        <p style="text-transform: uppercase; letter-spacing: 6px; font-size: 9px; color: ${theme.textSecondary}; margin-top: 20px;">Wedding Celebration</p>
                      </div>

                      <div style="text-align: center; margin-bottom: 40px; padding: 25px; border: 1px solid ${theme.accent}30; border-radius: 8px;">
                        <p style="font-size: 16px; margin: 0;">${t.dear} <span style="font-weight: 700; color: ${theme.text};">${guest.name}</span>,</p>
                        <p style="font-size: 13px; color: ${theme.textSecondary}; font-style: italic; margin-top: 10px; margin-bottom: 0;">${t.requestPleasure}</p>
                      </div>

                      <div style="text-align: center; margin-bottom: 40px;">
                        ${guestFunctionsHtml}
                      </div>

                      <div style="text-align: center;">
                        <a href="${inviteUrl}" style="display: inline-block; background: ${theme.accent}; color: ${theme.cardBg}; padding: 18px 40px; text-decoration: none; border-radius: 4px; font-weight: 700; font-size: 13px; text-transform: uppercase; letter-spacing: 3px;">${t.viewInvite || 'View Invitation & RSVP'}</a>
                      </div>
                    </td>
                  </tr>
                </table>
                <div style="text-align: center; margin-top: 30px;">
                  <p style="font-size: 9px; text-transform: uppercase; letter-spacing: 3px; color: ${theme.textSecondary};">Experience by <span style="font-weight: 700; color: ${theme.accent};">WedSync</span></p>
                </div>
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
  public static async sendInvitation(guest: Guest, wedding: Wedding, functions: WeddingFunction[], smtpConfig?: SmtpConfig, decryptedEmail?: string) {
    const recipientEmail = decryptedEmail || guest.email;
    if (!recipientEmail) {
      throw new Error(`Email address missing for guest: ${guest.name}`);
    }

    const { subject, text, html } = this.generateContent(guest, wedding, functions);
    const transporter = this.createTransporter(smtpConfig);
    const fromEmail = smtpConfig?.user || process.env.SMTP_FROM || process.env.SMTP_USER;

    return await transporter.sendMail({
      from: fromEmail,
      to: recipientEmail,
      subject,
      text,
      html,
    });
  }
}

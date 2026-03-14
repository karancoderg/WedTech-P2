import { Guest, Wedding, WeddingFunction } from './types';
import { formatDate } from './whatsapp';

/**
 * Generate a personalized Email body for a single guest
 */
export function generateEmailMessage(
  guest: Guest,
  wedding: Wedding,
  functions: WeddingFunction[]
): { subject: string; body: string } {
  const guestFunctions = functions
    .filter((f) => guest.function_ids.includes(f.id))
    .map((f) => `• ${f.name}: ${formatDate(f.date)} at ${f.venue_name}`)
    .join('\n');

  const subject = `Invitation: Wedding of ${wedding.bride_name} & ${wedding.groom_name}`;
  const body = `Hi ${guest.name},\n\nYou're invited to ${wedding.bride_name} & ${wedding.groom_name}'s wedding celebrations!\n\nYour Events:\n${guestFunctions}\n\nPlease RSVP here:\n${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/invite/${guest.invite_token}\n\nWe look forward to celebrating with you!\n\nBest,\n${wedding.wedding_name} Team`;

  return { subject, body };
}

/**
 * Generate a mailto link for a single guest
 */
export function generateEmailLink(
  guest: Guest,
  wedding: Wedding,
  functions: WeddingFunction[]
): string {
  const { subject, body } = generateEmailMessage(guest, wedding, functions);
  const email = guest.email || '';
  return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

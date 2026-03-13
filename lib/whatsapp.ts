import { Guest, Wedding, WeddingFunction } from './types';

/**
 * Format a date for display
 */
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Normalize phone number to international format
 */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  return `+${digits}`;
}

/**
 * Generate a personalized WhatsApp deep link for a single guest
 */
export function generateWhatsAppMessage(
  guest: Guest,
  wedding: Wedding,
  functions: WeddingFunction[]
): string {
  const guestFunctions = functions
    .filter((f) => guest.function_ids.includes(f.id))
    .map((f) => `${f.name} on ${formatDate(f.date)} at ${f.venue_name}`)
    .join('\n• ');

  return `Hi ${guest.name}! 🎊\n\n` +
    `You're invited to ${wedding.bride_name} & ${wedding.groom_name}'s wedding celebrations.\n\n` +
    `*Your Events:*\n• ${guestFunctions}\n\n` +
    `Please RSVP here 👇\n` +
    `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/invite/${guest.invite_token}\n\n` +
    `We look forward to celebrating with you! 🙏`;
}

/**
 * Generate a personalized WhatsApp deep link for a single guest
 */
export function generateWhatsAppLink(
  guest: Guest,
  wedding: Wedding,
  functions: WeddingFunction[]
): string {
  const message = generateWhatsAppMessage(guest, wedding, functions);
  const phone = normalizePhone(guest.phone).replace('+', '');
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

/**
 * Generate a reminder message link for pending guests
 */
export function generateReminderLink(
  guest: Guest,
  wedding: Wedding
): string {
  const message =
    `Hi ${guest.name}! 💌\n\n` +
    `A gentle reminder to RSVP for ${wedding.bride_name} & ${wedding.groom_name}'s wedding.\n\n` +
    `Please confirm your attendance here 👇\n` +
    `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/invite/${guest.invite_token}\n\n` +
    `We'd love to have you! 🙏`;

  const phone = normalizePhone(guest.phone).replace('+', '');
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

/**
 * Get days until a date
 */
export function daysUntil(dateStr: string): number {
  const now = new Date();
  const target = new Date(dateStr);
  const diff = target.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

/**
 * Generate Google Calendar link
 */
export function generateGoogleCalendarLink(
  func: WeddingFunction,
  wedding: Wedding
): string {
  const startDate = new Date(func.date);
  const endDate = new Date(startDate.getTime() + 3 * 60 * 60 * 1000); // 3 hours

  const formatCalDate = (d: Date) =>
    d.toISOString().replace(/-|:|\.\d{3}/g, '');

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
    `${wedding.bride_name} & ${wedding.groom_name}'s ${func.name}`
  )}&dates=${formatCalDate(startDate)}/${formatCalDate(endDate)}&location=${encodeURIComponent(
    func.venue_name + (func.venue_address ? `, ${func.venue_address}` : '')
  )}&details=${encodeURIComponent(
    `${func.name} - ${wedding.wedding_name}`
  )}`;
}

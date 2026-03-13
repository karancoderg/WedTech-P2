import { TemplateConfig } from './types';

export const TEMPLATE_CONFIGS: TemplateConfig[] = [
  {
    id: 'floral',
    name: 'Floral Garden',
    bgClass: 'bg-[#FDF4E3]',
    textClass: 'text-[#C05621]',
    accentClass: 'border-[#C05621]',
    description: 'Romantic botanical theme with warm ivory tones',
  },
  {
    id: 'royal',
    name: 'Royal Mandap',
    bgClass: 'bg-[#1C1033]',
    textClass: 'text-[#F5D78E]',
    accentClass: 'border-[#8B1A4A]',
    description: 'Grand luxurious theme with deep plum and gold',
  },
  {
    id: 'minimal',
    name: 'Modern Minimal',
    bgClass: 'bg-white',
    textClass: 'text-[#1C1C1E]',
    accentClass: 'border-[#B45309]',
    description: 'Contemporary clean design with gold accents',
  },
];

export const FUNCTION_SUGGESTIONS = [
  'Mehendi', 'Sangeet', 'Haldi', 'Reception', 'Baraat', 'Wedding Ceremony',
];

export const DIETARY_OPTIONS = [
  { value: 'veg', label: '🥦 Veg', emoji: '🥦' },
  { value: 'jain', label: 'Jain', emoji: '🌿' },
  { value: 'non-veg', label: '🍗 Non-Veg', emoji: '🍗' },
] as const;

export const GUEST_TAGS = [
  'vip', 'outstation', 'family', 'friend', 'colleague',
] as const;

export const SIDE_OPTIONS = [
  { value: 'bride', label: "Bride's Side" },
  { value: 'groom', label: "Groom's Side" },
  { value: 'both', label: 'Both Sides' },
] as const;

export const NAV_ITEMS = [
  { label: 'Dashboard', href: '/dashboard', icon: 'LayoutDashboard' },
  { label: 'Guests', href: '/guests', icon: 'Users' },
  { label: 'Invites', href: '/invites', icon: 'Mail' },
  { label: 'Analytics', href: '/analytics', icon: 'BarChart3' },
  { label: 'Check-In', href: '/checkin', icon: 'QrCode' },
] as const;

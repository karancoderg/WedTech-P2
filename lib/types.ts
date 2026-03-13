// ============================================================
// WedSync — TypeScript Type Definitions
// ============================================================

export interface Wedding {
  id: string;
  planner_id: string;
  wedding_name: string;
  bride_name: string;
  groom_name: string;
  wedding_date: string;
  cover_photo_url: string | null;
  template_id: 'floral' | 'royal' | 'minimal';
  total_guests: number;
  total_confirmed: number;
  total_declined: number;
  total_pending: number;
  total_pax: number;
  created_at: string;
  updated_at: string;
}

export interface WeddingFunction {
  id: string;
  wedding_id: string;
  name: string;
  date: string;
  time: string;
  venue_name: string;
  venue_address: string | null;
  maps_url: string | null;
  sort_order: number;
  confirmed: number;
  declined: number;
  pending: number;
  total_pax: number;
  dietary_veg: number;
  dietary_jain: number;
  dietary_nonveg: number;
  accommodation_needed: number;
  created_at: string;
}

export interface Guest {
  id: string;
  wedding_id: string;
  name: string;
  phone: string;
  email: string | null;
  side: 'bride' | 'groom' | 'both';
  tags: string[];
  function_ids: string[];
  invite_token: string;
  invite_sent_at: string | null;
  overall_status: 'pending' | 'confirmed' | 'declined' | 'partial';
  imported_via: 'csv' | 'manual';
  created_at: string;
}

export interface RSVP {
  id: string;
  wedding_id: string;
  guest_id: string;
  function_id: string;
  invite_token: string;
  status: 'pending' | 'confirmed' | 'declined';
  plus_ones: number;
  children: number;
  total_pax: number;
  dietary_preference: 'veg' | 'jain' | 'non-veg' | null;
  needs_accommodation: boolean;
  responded_at: string | null;
  checked_in: boolean;
  checked_in_at: string | null;
  created_at: string;
}

export interface InviteToken {
  token: string;
  wedding_id: string;
  guest_id: string;
  function_ids: string[];
  used: boolean;
  created_at: string;
}

// Form types
export interface CreateWeddingForm {
  weddingName: string;
  brideName: string;
  groomName: string;
  weddingDate: string;
  templateId: 'floral' | 'royal' | 'minimal';
  functions: CreateFunctionForm[];
}

export interface CreateFunctionForm {
  name: string;
  date: string;
  time: string;
  venueName: string;
  venueAddress?: string;
  mapsUrl?: string;
}

export interface RSVPSubmission {
  inviteToken: string;
  responses: {
    functionId: string;
    status: 'confirmed' | 'declined';
    plusOnes: number;
    children: number;
    dietaryPreference: 'veg' | 'jain' | 'non-veg' | null;
    needsAccommodation: boolean;
  }[];
}

// Invite page data (resolved from token)
export interface InviteData {
  wedding: Wedding;
  guest: Guest;
  functions: WeddingFunction[];
  rsvps: RSVP[];
}

// Template config
export interface TemplateConfig {
  id: string;
  name: string;
  bgClass: string;
  textClass: string;
  accentClass: string;
  bgImage?: string;
  description: string;
}

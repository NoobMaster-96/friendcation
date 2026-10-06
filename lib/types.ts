export type UserProfile = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  avatar_url: string | null;
  referral_code: string;
  referred_by: string | null;
  /** ISO 4217 — the default currency for a trip's first expense (migration 0011). */
  home_currency: string;
  created_at: string;
};

export type Trip = {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  created_by: string | null;
  invite_code: string | null;
  created_at: string;
};

export type TripMemberChip = { id: string; initial: string };

export type TripListItem = Trip & {
  role: string;
  members: TripMemberChip[];
  memberCount: number;
};

export type ItemType = 'personal' | 'shared';

export type ItineraryListItem = {
  id: string;
  trip_id: string;
  title: string;
  location_name: string | null;
  start_time: string | null;
  end_time: string | null;
  notes: string | null;
  item_type: ItemType;
  created_by: string | null;
  creatorName: string | null;
  /** The item's tagged people (itinerary_item_participants). */
  participants: ItineraryParticipant[];
  attachmentCount: number;
};

export type ExpenseListItem = {
  id: string;
  description: string;
  amount: number;
  currency: string;
  paid_by: string | null;
  payerName: string | null;
  expense_date: string | null;
  /** Each member's share, in integer minor units of `currency` (paise, cents…). */
  splits: { userId: string; shareMinor: number }[];
};

export type MemberLocation = {
  userId: string;
  name: string;
  sharingEnabled: boolean;
  updatedAt: string | null;
  latitude: number | null;
  longitude: number | null;
};

export type ItineraryParticipant = { userId: string; name: string; initials: string };

export type ItineraryAttachment = {
  id: string;
  fileName: string;
  fileType: 'pdf' | 'image';
  filePath: string;
};

export type ItineraryItemDetail = {
  id: string;
  tripId: string;
  title: string;
  startTime: string | null;
  endTime: string | null;
  notes: string | null;
  itemType: ItemType;
  createdBy: string | null;
  participantIds: string[];
  participants: ItineraryParticipant[];
  attachments: ItineraryAttachment[];
};

/** A file chosen in the picker, pending upload. */
export type PickedFile = {
  uri: string;
  name: string;
  fileType: 'pdf' | 'image';
  mimeType: string;
  base64?: string | null;
};

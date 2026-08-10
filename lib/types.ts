export type UserProfile = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  avatar_url: string | null;
  referral_code: string;
  referred_by: string | null;
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
};

export type MemberLocation = {
  userId: string;
  name: string;
  sharingEnabled: boolean;
  updatedAt: string | null;
  latitude: number | null;
  longitude: number | null;
};

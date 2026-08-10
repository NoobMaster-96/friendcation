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

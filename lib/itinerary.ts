import { supabase } from './supabase';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import type {
  ItineraryAttachment,
  ItineraryItemDetail,
  ItineraryListItem,
  ItineraryParticipant,
  PickedFile,
} from './types';

const ATTACHMENT_BUCKET = 'itinerary-attachments';

const COLUMNS =
  'id,trip_id,title,location_name,start_time,end_time,notes,item_type,created_by,' +
  'creator:user_profiles!created_by(first_name),' +
  'itinerary_item_participants(user_id, user_profiles(first_name)),' +
  'itinerary_attachments(count)';

export async function listItinerary(tripId: string): Promise<ItineraryListItem[]> {
  const { data, error } = await supabase
    .from('itinerary_items')
    .select(COLUMNS)
    .eq('trip_id', tripId)
    .order('start_time', { ascending: true, nullsFirst: false });
  if (error) throw error;

  return (data ?? []).map((r: any) => {
    const creator = Array.isArray(r.creator) ? r.creator[0] : r.creator;
    const attachmentCount = Array.isArray(r.itinerary_attachments)
      ? r.itinerary_attachments[0]?.count ?? 0
      : 0;
    const participantRows: any[] = Array.isArray(r.itinerary_item_participants)
      ? r.itinerary_item_participants
      : [];
    const participantIds: string[] = [];
    const participantNames: string[] = [];
    for (const p of participantRows) {
      const prof = Array.isArray(p.user_profiles) ? p.user_profiles[0] : p.user_profiles;
      participantIds.push(p.user_id);
      participantNames.push(prof?.first_name ?? 'Member');
    }
    return {
      id: r.id,
      trip_id: r.trip_id,
      title: r.title,
      location_name: r.location_name,
      start_time: r.start_time,
      end_time: r.end_time,
      notes: r.notes,
      item_type: r.item_type,
      created_by: r.created_by,
      creatorName: creator?.first_name ?? null,
      participantIds,
      participantNames,
      attachmentCount,
    };
  });
}

/** True when now falls within [start_time, end_time]. Needs both bounds. */
export function isNowItem(item: ItineraryListItem, now: Date = new Date()): boolean {
  if (!item.start_time || !item.end_time) return false;
  const start = new Date(item.start_time).getTime();
  const end = new Date(item.end_time).getTime();
  const t = now.getTime();
  return start <= t && t <= end;
}

/** "3:00 PM", "Tomorrow, 9:00 AM", "Aug 22, 7:30 PM" (relative to `now`). */
export function formatItemTime(startISO: string | null, now: Date = new Date()): string {
  if (!startISO) return 'Anytime';
  const d = new Date(startISO);
  const time = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dayDiff = Math.round((startOfDay(d) - startOfDay(now)) / 86_400_000);
  if (dayDiff === 0) return time;
  if (dayDiff === 1) return `Tomorrow, ${time}`;
  if (dayDiff === -1) return `Yesterday, ${time}`;
  const date = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `${date}, ${time}`;
}

// ============================================================
// Item create / update / detail (participants = the "People")
// ============================================================

export type ItineraryItemInput = {
  title: string;
  startTime: string; // ISO
  endTime: string; // ISO
  participantIds: string[];
};

/** item_type heuristic: a single participant is a personal item, else shared. */
function itemTypeFor(participantIds: string[]): 'personal' | 'shared' {
  return participantIds.length === 1 ? 'personal' : 'shared';
}

export async function setParticipants(itemId: string, ids: string[]): Promise<void> {
  // Delete-all-then-reinsert (same pattern the doc recommends for expense splits).
  const del = await supabase
    .from('itinerary_item_participants')
    .delete()
    .eq('itinerary_item_id', itemId);
  if (del.error) throw del.error;
  if (ids.length) {
    const rows = ids.map((uid) => ({ itinerary_item_id: itemId, user_id: uid }));
    const ins = await supabase.from('itinerary_item_participants').insert(rows);
    if (ins.error) throw ins.error;
  }
}

export async function createItineraryItem(
  tripId: string,
  createdBy: string,
  input: ItineraryItemInput
): Promise<string> {
  const { data, error } = await supabase
    .from('itinerary_items')
    .insert({
      trip_id: tripId,
      title: input.title.trim(),
      start_time: input.startTime,
      end_time: input.endTime,
      item_type: itemTypeFor(input.participantIds),
      created_by: createdBy,
    })
    .select('id')
    .single();
  if (error) throw error;
  const id = data.id as string;
  await setParticipants(id, input.participantIds);
  return id;
}

export async function updateItineraryItem(
  itemId: string,
  input: ItineraryItemInput
): Promise<void> {
  const { error } = await supabase
    .from('itinerary_items')
    .update({
      title: input.title.trim(),
      start_time: input.startTime,
      end_time: input.endTime,
      item_type: itemTypeFor(input.participantIds),
    })
    .eq('id', itemId);
  if (error) throw error;
  await setParticipants(itemId, input.participantIds);
}

export async function deleteItineraryItem(itemId: string): Promise<void> {
  const { error } = await supabase.from('itinerary_items').delete().eq('id', itemId);
  if (error) throw error;
}

export async function getItineraryItemDetail(itemId: string): Promise<ItineraryItemDetail> {
  const { data, error } = await supabase
    .from('itinerary_items')
    .select(
      'id,trip_id,title,start_time,end_time,notes,item_type,created_by,' +
        'itinerary_item_participants(user_id, user_profiles(first_name, last_name)),' +
        'itinerary_attachments(id, file_name, file_type, file_url)'
    )
    .eq('id', itemId)
    .single();
  if (error) throw error;
  const row = data as any;

  const participants: ItineraryParticipant[] = (row.itinerary_item_participants ?? []).map(
    (r: any) => {
      const p = Array.isArray(r.user_profiles) ? r.user_profiles[0] : r.user_profiles;
      const first = p?.first_name?.trim() ?? '';
      const last = p?.last_name?.trim() ?? '';
      return {
        userId: r.user_id,
        name: `${first} ${last}`.trim() || 'Member',
        initials: ((first[0] ?? '') + (last[0] ?? '')).toUpperCase() || '?',
      };
    }
  );

  const attachments: ItineraryAttachment[] = (row.itinerary_attachments ?? []).map((a: any) => ({
    id: a.id,
    fileName: a.file_name,
    fileType: a.file_type,
    filePath: a.file_url,
  }));

  return {
    id: row.id,
    tripId: row.trip_id,
    title: row.title,
    startTime: row.start_time,
    endTime: row.end_time,
    notes: row.notes,
    itemType: row.item_type,
    createdBy: row.created_by,
    participantIds: participants.map((p) => p.userId),
    participants,
    attachments,
  };
}

// ============================================================
// Attachments (Supabase Storage: private itinerary-attachments bucket)
// ============================================================

export async function uploadAttachment(
  tripId: string,
  itemId: string,
  file: PickedFile,
  uploadedBy: string
): Promise<void> {
  const base64 =
    file.base64 ??
    (await FileSystem.readAsStringAsync(file.uri, { encoding: FileSystem.EncodingType.Base64 }));
  const bytes = decode(base64);

  const safeName = file.name.replace(/[^\w.\-]+/g, '_');
  const path = `${tripId}/${itemId}/${Date.now()}-${safeName}`;

  const { error: upErr } = await supabase.storage
    .from(ATTACHMENT_BUCKET)
    .upload(path, bytes, { contentType: file.mimeType, upsert: false });
  if (upErr) throw upErr;

  const { error: rowErr } = await supabase.from('itinerary_attachments').insert({
    itinerary_item_id: itemId,
    file_url: path,
    file_name: file.name,
    file_type: file.fileType,
    uploaded_by: uploadedBy,
  });
  if (rowErr) throw rowErr;
}

export async function deleteAttachment(attachment: ItineraryAttachment): Promise<void> {
  await supabase.storage.from(ATTACHMENT_BUCKET).remove([attachment.filePath]);
  const { error } = await supabase
    .from('itinerary_attachments')
    .delete()
    .eq('id', attachment.id);
  if (error) throw error;
}

export async function getAttachmentUrl(path: string): Promise<string | null> {
  const { data } = await supabase.storage
    .from(ATTACHMENT_BUCKET)
    .createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}

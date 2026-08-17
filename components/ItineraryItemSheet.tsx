import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  createItineraryItem,
  deleteAttachment,
  updateItineraryItem,
  uploadAttachment,
} from '../lib/itinerary';
import type { ItineraryAttachment, ItineraryItemDetail, PickedFile } from '../lib/types';
import type { TripMember } from '../lib/members';
import { TextField } from './TextField';
import { DateTimeField } from './DateTimeField';
import { MemberChips } from './MemberChips';
import { Button } from './Button';
import { colors, fonts, radius, spacing } from '../lib/theme';

type Props = {
  visible: boolean;
  mode: 'create' | 'edit';
  tripId: string;
  userId: string;
  members: TripMember[];
  item?: ItineraryItemDetail | null;
  onClose: () => void;
  onSaved: () => void;
};

const DEFAULT_DURATION_MS = 60 * 60 * 1000;

export function ItineraryItemSheet({
  visible,
  mode,
  tripId,
  userId,
  members,
  item,
  onClose,
  onSaved,
}: Props) {
  const insets = useSafeAreaInsets();

  const [title, setTitle] = useState('');
  const [when, setWhen] = useState<Date | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [existing, setExisting] = useState<ItineraryAttachment[]>([]);
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  const [pending, setPending] = useState<PickedFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    if (mode === 'edit' && item) {
      setTitle(item.title);
      setWhen(item.startTime ? new Date(item.startTime) : new Date());
      setSelectedIds(item.participantIds);
      setExisting(item.attachments);
    } else {
      setTitle('');
      setWhen(new Date());
      setSelectedIds([userId]);
      setExisting([]);
    }
    setRemovedIds([]);
    setPending([]);
    setError(null);
  }, [visible, mode, item, userId]);

  const toggle = (id: string) =>
    setSelectedIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  const selectAll = () =>
    setSelectedIds((ids) =>
      ids.length === members.length ? [] : members.map((m) => m.userId)
    );

  const pickImage = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      base64: true,
    });
    if (!res.canceled && res.assets[0]) {
      const a = res.assets[0];
      setPending((p) => [
        ...p,
        {
          uri: a.uri,
          name: a.fileName ?? `image-${Date.now()}.jpg`,
          fileType: 'image',
          mimeType: a.mimeType ?? 'image/jpeg',
          base64: a.base64 ?? null,
        },
      ]);
    }
  };

  const pickDoc = async () => {
    const res = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
    });
    if (!res.canceled && res.assets[0]) {
      const a = res.assets[0];
      setPending((p) => [
        ...p,
        {
          uri: a.uri,
          name: a.name,
          fileType: 'pdf',
          mimeType: a.mimeType ?? 'application/pdf',
          base64: null,
        },
      ]);
    }
  };

  const onAttach = () => {
    Alert.alert('Attach file', 'Add a PDF or an image.', [
      { text: 'Photo / image', onPress: pickImage },
      { text: 'PDF document', onPress: pickDoc },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const visibleExisting = existing.filter((a) => !removedIds.includes(a.id));

  const onSave = async () => {
    setError(null);
    if (!title.trim()) {
      setError('Give the item a title.');
      return;
    }
    if (!when) {
      setError('Pick a time.');
      return;
    }
    const input = {
      title,
      startTime: when.toISOString(),
      endTime: new Date(when.getTime() + DEFAULT_DURATION_MS).toISOString(),
      participantIds: selectedIds,
    };

    setSaving(true);
    let itemId: string;
    try {
      if (mode === 'edit' && item) {
        itemId = item.id;
        await updateItineraryItem(itemId, input);
      } else {
        itemId = await createItineraryItem(tripId, userId, input);
      }
    } catch (e) {
      setSaving(false);
      setError(e instanceof Error ? e.message : 'Could not save the item.');
      return;
    }

    let attachmentError: string | null = null;
    try {
      for (const id of removedIds) {
        const att = existing.find((a) => a.id === id);
        if (att) await deleteAttachment(att);
      }
      for (const file of pending) {
        await uploadAttachment(tripId, itemId, file, userId);
      }
    } catch (e) {
      attachmentError = e instanceof Error ? e.message : 'Unknown error.';
    }

    setSaving(false);
    onSaved();
    onClose();
    if (attachmentError) {
      Alert.alert('Item saved', `But attachments didn’t sync: ${attachmentError}`);
    }
  };

  const attachLabel = mode === 'edit' ? 'Attach another file' : 'Attach PDF or image';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
          <ScrollView
            style={styles.scroll}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.title}>{mode === 'edit' ? 'Edit item' : 'New itinerary item'}</Text>

            <TextField
              label="Title"
              value={title}
              onChangeText={setTitle}
              placeholder="e.g. Canal boat tour"
              autoCapitalize="sentences"
            />

            <DateTimeField label="Time" value={when} onChange={setWhen} />

            <Text style={styles.sectionLabel}>People</Text>
            <View style={styles.chips}>
              <MemberChips
                members={members}
                selectedIds={selectedIds}
                onToggle={toggle}
                onSelectAll={selectAll}
              />
            </View>

            <Text style={styles.sectionLabel}>Attachments</Text>
            {visibleExisting.map((a) => (
              <AttachmentPill
                key={a.id}
                icon={a.fileType === 'pdf' ? 'document-text-outline' : 'image-outline'}
                name={a.fileName}
                onRemove={() => setRemovedIds((r) => [...r, a.id])}
              />
            ))}
            {pending.map((f, i) => (
              <AttachmentPill
                key={`p-${i}`}
                icon={f.fileType === 'pdf' ? 'document-text-outline' : 'image-outline'}
                name={f.name}
                onRemove={() => setPending((p) => p.filter((_, idx) => idx !== i))}
              />
            ))}
            <Pressable
              onPress={onAttach}
              accessibilityRole="button"
              style={({ pressed }) => [styles.dashed, pressed && styles.pressed]}
            >
              <Ionicons name="add" size={18} color={colors.textSecondary} />
              <Text style={styles.dashedText}>{attachLabel}</Text>
            </Pressable>

            {error ? <Text style={styles.error}>{error}</Text> : null}
          </ScrollView>

          <View style={styles.actions}>
            <Button label="Cancel" variant="secondary" onPress={onClose} style={styles.action} />
            <Button
              label={mode === 'edit' ? 'Save' : 'Add item'}
              onPress={onSave}
              loading={saving}
              style={styles.action}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function AttachmentPill({
  icon,
  name,
  onRemove,
}: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  name: string;
  onRemove: () => void;
}) {
  return (
    <View style={styles.pill}>
      <Ionicons name={icon} size={18} color={colors.text} />
      <Text style={styles.pillName} numberOfLines={1}>
        {name}
      </Text>
      <Pressable onPress={onRemove} hitSlop={8} accessibilityRole="button" accessibilityLabel="Remove file">
        <Ionicons name="close" size={18} color={colors.textSecondary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(43,36,29,0.35)',
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    maxHeight: '88%',
  },
  scroll: { flexShrink: 1 },
  title: { fontSize: 20, fontFamily: fonts.bold, color: colors.text, marginBottom: spacing.lg },
  sectionLabel: {
    fontSize: 15,
    fontFamily: fonts.medium,
    color: colors.text,
    marginBottom: 10,
    marginTop: 4,
  },
  chips: { marginBottom: 16 },
  dashed: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 52,
    borderRadius: 24,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.borderStrong,
    marginTop: 4,
  },
  dashedText: { fontSize: 15, fontFamily: fonts.medium, color: colors.textSecondary },
  pressed: { opacity: 0.85 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 52,
    borderRadius: 24,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  pillName: { flex: 1, fontSize: 14, fontFamily: fonts.medium, color: colors.text },
  error: { marginTop: spacing.md, fontSize: 13, fontFamily: fonts.regular, color: colors.danger },
  actions: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  action: { flex: 1 },
});

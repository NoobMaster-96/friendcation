import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatItemTime, getItineraryItemDetail } from '../lib/itinerary';
import type { ItineraryAttachment, ItineraryItemDetail } from '../lib/types';
import type { TripMember } from '../lib/members';
import { MemberChips } from './MemberChips';
import { AttachmentViewer } from './AttachmentViewer';
import { Button } from './Button';
import { makeStyles, useTheme } from '../context/ThemeContext';
import { fonts, spacing } from '../lib/theme';

type Props = {
  visible: boolean;
  itemId: string | null;
  members: TripMember[];
  onClose: () => void;
  onEdit: (detail: ItineraryItemDetail) => void;
};

export function ItineraryDetailSheet({ visible, itemId, members, onClose, onEdit }: Props) {
  const { colors } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const [detail, setDetail] = useState<ItineraryItemDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewerAttachment, setViewerAttachment] = useState<ItineraryAttachment | null>(null);

  useEffect(() => {
    if (!visible || !itemId) return;
    let active = true;
    setLoading(true);
    setDetail(null);
    getItineraryItemDetail(itemId)
      .then((d) => {
        if (active) setDetail(d);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [visible, itemId]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
          {loading || !detail ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.text} />
            </View>
          ) : (
            <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
              <View style={styles.header}>
                <View style={styles.headerText}>
                  <Text style={styles.title}>{detail.title}</Text>
                  <Text style={styles.subtitle}>{formatItemTime(detail.startTime)}</Text>
                </View>
                <Pressable
                  onPress={() => onEdit(detail)}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="Edit item"
                  style={({ pressed }) => [styles.editBtn, pressed && styles.pressed]}
                >
                  <Ionicons name="create-outline" size={20} color={colors.text} />
                </Pressable>
              </View>

              {detail.participants.length ? (
                <>
                  <Text style={styles.sectionLabel}>People</Text>
                  <View style={styles.chips}>
                    <MemberChips members={members} selectedIds={detail.participantIds} readOnly />
                  </View>
                </>
              ) : null}

              {detail.attachments.length ? (
                <>
                  <Text style={styles.sectionLabel}>Attachments</Text>
                  {detail.attachments.map((a) => (
                    <Pressable
                      key={a.id}
                      onPress={() => setViewerAttachment(a)}
                      accessibilityRole="button"
                      style={({ pressed }) => [styles.pill, pressed && styles.pressed]}
                    >
                      <Ionicons
                        name={a.fileType === 'pdf' ? 'document-text-outline' : 'image-outline'}
                        size={18}
                        color={colors.text}
                      />
                      <Text style={styles.pillName} numberOfLines={1}>
                        {a.fileName}
                      </Text>
                      <Ionicons name="open-outline" size={16} color={colors.textSecondary} />
                    </Pressable>
                  ))}
                </>
              ) : null}
            </ScrollView>
          )}

          <Button label="Close" variant="secondary" onPress={onClose} style={styles.close} />
        </View>
        <AttachmentViewer
          attachment={viewerAttachment}
          onClose={() => setViewerAttachment(null)}
        />
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((colors) => ({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.scrim,
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    maxHeight: '85%',
  },
  scroll: { flexShrink: 1 },
  center: { paddingVertical: spacing.xl, alignItems: 'center' },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  headerText: { flex: 1 },
  title: { fontSize: 24, lineHeight: 30, fontFamily: fonts.bold, color: colors.text },
  subtitle: { marginTop: 4, fontSize: 14, fontFamily: fonts.regular, color: colors.textSecondary },
  editBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
  sectionLabel: {
    fontSize: 13,
    fontFamily: fonts.semibold,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: spacing.lg,
    marginBottom: 10,
  },
  chips: { marginBottom: 4 },
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
  close: { marginTop: spacing.md },
}));

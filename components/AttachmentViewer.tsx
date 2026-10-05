import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getAttachmentUrl } from '../lib/itinerary';
import type { ItineraryAttachment } from '../lib/types';
import { fonts } from '../lib/theme';

type Props = {
  attachment: ItineraryAttachment | null;
  onClose: () => void;
};

/** Full-screen in-app viewer: native Image for photos, WebView for PDFs. */
export function AttachmentViewer({ attachment, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imgLoading, setImgLoading] = useState(false);

  useEffect(() => {
    if (!attachment) {
      setUrl(null);
      return;
    }
    let active = true;
    setLoading(true);
    setError(null);
    setUrl(null);
    getAttachmentUrl(attachment.filePath)
      .then((u) => {
        if (!active) return;
        if (u) setUrl(u);
        else setError('The file link could not be generated.');
      })
      .catch((e) => {
        if (active) setError(e instanceof Error ? e.message : 'Could not load the file.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [attachment]);

  const isImage = attachment?.fileType === 'image';
  // Android WebView can't render PDFs directly; wrap in the Google viewer.
  const pdfSource =
    url && Platform.OS === 'android'
      ? { uri: `https://docs.google.com/gview?embedded=1&url=${encodeURIComponent(url)}` }
      : url
        ? { uri: url }
        : undefined;

  return (
    <Modal visible={!!attachment} animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <Text style={styles.name} numberOfLines={1}>
            {attachment?.fileName ?? ''}
          </Text>
          <View style={styles.headerActions}>
            {url ? (
              <Pressable
                onPress={() => Linking.openURL(url)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Open externally"
              >
                <Ionicons name="open-outline" size={22} color="#fff" />
              </Pressable>
            ) : null}
            <Pressable onPress={onClose} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close">
              <Ionicons name="close" size={26} color="#fff" />
            </Pressable>
          </View>
        </View>

        <View style={styles.body}>
          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator color="#fff" />
            </View>
          ) : error ? (
            <View style={styles.center}>
              <Text style={styles.error}>{error}</Text>
            </View>
          ) : url && isImage ? (
            <View style={styles.fill}>
              <Image
                source={{ uri: url }}
                style={styles.image}
                resizeMode="contain"
                onLoadStart={() => setImgLoading(true)}
                onLoad={() => setImgLoading(false)}
                onError={() => {
                  setImgLoading(false);
                  setError('This image could not be displayed.');
                }}
              />
              {imgLoading ? (
                <View style={styles.webLoading}>
                  <ActivityIndicator color="#fff" />
                </View>
              ) : null}
            </View>
          ) : pdfSource ? (
            // The WebView wraps itself in a container that has flex but no width;
            // containerStyle must stretch it or the PDF collapses to zero width.
            <WebView
              source={pdfSource}
              style={styles.web}
              containerStyle={styles.fill}
              startInLoadingState
              renderLoading={() => (
                <View style={styles.webLoading}>
                  <ActivityIndicator color="#fff" />
                </View>
              )}
              onError={() => setError('This file could not be displayed.')}
              onHttpError={(e) =>
                setError(`This file could not be loaded (HTTP ${e.nativeEvent.statusCode}).`)
              }
            />
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0e0b07' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 16,
  },
  name: { flex: 1, color: '#fff', fontSize: 15, fontFamily: fonts.semibold },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 18 },
  body: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  fill: { flex: 1, width: '100%', backgroundColor: '#0e0b07' },
  web: { flex: 1, backgroundColor: '#0e0b07' },
  image: { flex: 1, width: '100%' },
  webLoading: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0e0b07',
  },
  error: { color: '#fff', fontSize: 14, fontFamily: fonts.regular, paddingHorizontal: 32, textAlign: 'center' },
});

import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from './store';
import type { TikTokSound } from './tiktok';
import { C, Chip, Cover, NamePrompt } from './ui';

/** Shown when a TikTok is shared to the app: pick a name + playlists, then download. */
export function AddSoundModal() {
  const { draft, playlists, view, cancelDraft, retryDraft } = useStore();
  const sound = draft?.sound;
  return (
    <Modal visible={!!draft} animationType="slide" onRequestClose={cancelDraft} statusBarTranslucent>
      <SafeAreaView style={st.root} edges={['top', 'bottom']}>
        <View style={st.header}>
          <Pressable onPress={cancelDraft} hitSlop={12}>
            <Ionicons name="close" size={26} color={C.text} />
          </Pressable>
          <Text style={st.headerTitle}>Add sound</Text>
          <View style={{ width: 26 }} />
        </View>

        {draft?.status === 'loading' && (
          <View style={st.center}>
            <ActivityIndicator color={C.cyan} size="large" />
            <Text style={st.dim}>Getting the sound from TikTok…</Text>
          </View>
        )}

        {draft?.status === 'error' && (
          <View style={st.center}>
            <Ionicons name="alert-circle-outline" size={48} color={C.pink} />
            <Text style={[st.dim, { textAlign: 'center' }]}>{draft.error}</Text>
            <Pressable style={st.secondaryBtn} onPress={retryDraft}>
              <Text style={st.secondaryText}>Try again</Text>
            </Pressable>
          </View>
        )}

        {draft?.status === 'ready' && sound && (
          <ReadyForm
            key={draft.key}
            sound={sound}
            initialSelected={view && playlists.some((p) => p.id === view) ? [view] : []}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

function ReadyForm({ sound, initialSelected }: { sound: TikTokSound; initialSelected: string[] }) {
  const { playlists, tracks, confirmDraft, createPlaylist } = useStore();
  const [title, setTitle] = useState(sound.contains?.title || sound.title);
  const [artist, setArtist] = useState(sound.contains?.artist || (sound.original ? '' : sound.artist));
  const [selected, setSelected] = useState<string[]>(initialSelected);
  const [newOpen, setNewOpen] = useState(false);

  const already = tracks.find((t) => t.id === sound.musicId);
  const togglePl = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  const suggestions = Array.from(
    new Set(
      [sound.contains?.title, sound.title, sound.videoDesc?.split('#')[0]?.trim().slice(0, 60)].filter(
        (x): x is string => !!x && x.length > 1
      )
    )
  );

  return (
    <>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <ScrollView contentContainerStyle={st.body} keyboardShouldPersistTaps="handled">
              <View style={st.soundCard}>
                <Cover uri={sound.coverUrl} size={72} radius={12} />
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={st.soundTitle} numberOfLines={2}>
                    {sound.title}
                  </Text>
                  <Text style={st.dim} numberOfLines={1}>
                    {[sound.artist, sound.videoAuthor && `@${sound.videoAuthor}`].filter(Boolean).join(' · ')}
                  </Text>
                </View>
              </View>

              {sound.contains && (
                <View style={st.contains}>
                  <Ionicons name="musical-notes" size={18} color={C.cyan} />
                  <View style={{ flex: 1 }}>
                    <Text style={st.containsLabel}>Contains</Text>
                    <Text style={st.containsText} numberOfLines={2}>
                      {sound.contains.title}
                      {sound.contains.artist ? ` – ${sound.contains.artist}` : ''}
                    </Text>
                  </View>
                </View>
              )}

              {already && (
                <Text style={st.note}>
                  This sound is already in your library as “{already.title}”. Saving will update it.
                </Text>
              )}

              <Text style={st.label}>Name</Text>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="Sound name"
                placeholderTextColor={C.dim}
                style={st.input}
              />
              {suggestions.length > 1 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.row}>
                  {suggestions.map((sg) => (
                    <Chip key={sg} label={sg} active={title === sg} onPress={() => setTitle(sg)} />
                  ))}
                </ScrollView>
              )}

              <Text style={st.label}>Artist (optional)</Text>
              <TextInput
                value={artist}
                onChangeText={setArtist}
                placeholder="Artist"
                placeholderTextColor={C.dim}
                style={st.input}
              />

              <Text style={st.label}>Add to playlists</Text>
              <View style={st.wrap}>
                {playlists.map((p) => (
                  <Chip
                    key={p.id}
                    label={p.name}
                    icon={selected.includes(p.id) ? 'checkmark' : 'list'}
                    active={selected.includes(p.id)}
                    onPress={() => togglePl(p.id)}
                  />
                ))}
                <Chip label="New playlist" icon="add" onPress={() => setNewOpen(true)} />
              </View>
              {!playlists.length && (
                <Text style={st.dimSmall}>Optional — the sound always goes to All songs.</Text>
              )}
            </ScrollView>

            <View style={st.footer}>
              <Pressable
                style={[st.primaryBtn, !title.trim() && { opacity: 0.4 }]}
                disabled={!title.trim()}
                onPress={() => confirmDraft({ title, artist, playlistIds: selected })}
              >
                <Ionicons name="download-outline" size={20} color="#fff" />
                <Text style={st.primaryText}>Download & play</Text>
              </Pressable>
            </View>
          </KeyboardAvoidingView>
        )
        <NamePrompt
          visible={newOpen}
          title="New playlist"
          placeholder="Playlist name"
          confirmLabel="Create"
          onCancel={() => setNewOpen(false)}
          onSubmit={(name) => {
            const id = createPlaylist(name);
            setSelected((s) => [...s, id]);
            setNewOpen(false);
          }}
        />
    </>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { color: C.text, fontSize: 17, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 32 },
  body: { padding: 20, gap: 10, paddingBottom: 40 },
  soundCard: { flexDirection: 'row', gap: 14, alignItems: 'center', backgroundColor: C.card, padding: 12, borderRadius: 16 },
  soundTitle: { color: C.text, fontSize: 16, fontWeight: '700' },
  contains: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(37,244,238,0.35)', backgroundColor: 'rgba(37,244,238,0.07)' },
  containsLabel: { color: C.cyan, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  containsText: { color: C.text, fontSize: 14, fontWeight: '600', marginTop: 2 },
  note: { color: C.dim, fontSize: 12, fontStyle: 'italic' },
  label: { color: C.dim, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 12 },
  input: { backgroundColor: C.card, color: C.text, borderRadius: 12, paddingHorizontal: 14, height: 48, fontSize: 15, borderWidth: 1, borderColor: C.line },
  row: { gap: 8, paddingVertical: 2 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dim: { color: C.dim, fontSize: 13 },
  dimSmall: { color: C.dim, fontSize: 12 },
  footer: { padding: 16, borderTopWidth: 1, borderColor: C.line },
  primaryBtn: { height: 54, borderRadius: 27, backgroundColor: C.pink, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  secondaryBtn: { paddingHorizontal: 22, height: 44, borderRadius: 22, borderWidth: 1, borderColor: C.line, justifyContent: 'center' },
  secondaryText: { color: C.text, fontWeight: '600' },
});

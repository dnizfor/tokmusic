import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { ShareIntentProvider, useShareIntentContext } from 'expo-share-intent';
import { StoreProvider, useStore } from './src/store';
import { findTikTokUrl } from './src/tiktok';
import type { Playlist, Track } from './src/library';
import { C, Chip, ConfirmDialog, Cover, NamePrompt, Sheet, SheetItem } from './src/ui';
import { AddSoundModal } from './src/AddSoundModal';
import { Onboarding } from './src/Onboarding';

export default function App() {
  return (
    <ShareIntentProvider>
      <SafeAreaProvider>
        <StoreProvider>
          <StatusBar style="light" />
          <Main />
        </StoreProvider>
      </SafeAreaProvider>
    </ShareIntentProvider>
  );
}

/** Catches links shared from TikTok and opens the "Add sound" screen. */
function useIncomingShares() {
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntentContext();
  const { openShare } = useStore();
  const [notTikTok, setNotTikTok] = useState(false);
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (!hasShareIntent) return;
    const raw = shareIntent.webUrl || shareIntent.text || '';
    const url = findTikTokUrl(raw);
    resetShareIntent();
    if (!url) {
      setNotTikTok(true);
      return;
    }
    if (handled.current === url) return;
    handled.current = url;
    setNotTikTok(false);
    openShare(url);
  }, [hasShareIntent, shareIntent, resetShareIntent, openShare]);

  return { notTikTok, clear: () => setNotTikTok(false) };
}

type PromptState =
  | { kind: 'newPlaylist'; addTrackId?: string }
  | { kind: 'renamePlaylist'; playlist: Playlist }
  | { kind: 'renameTrack'; track: Track }
  | null;

function Main() {
  const {
    tracks, playlists, view, setView, visibleTracks, pending, draft, current, play, dismissPending,
    onboarded, finishOnboarding, showOnboarding, createPlaylist, renamePlaylist, deletePlaylist,
    renameTrack, addToPlaylist, deleteTrack,
  } = useStore();
  const { notTikTok, clear } = useIncomingShares();
  const [trackMenu, setTrackMenu] = useState<Track | null>(null);
  const [plMenu, setPlMenu] = useState<Playlist | null>(null);
  const [prompt, setPrompt] = useState<PromptState>(null);
  const [confirm, setConfirm] = useState<
    { kind: 'track'; track: Track } | { kind: 'playlist'; playlist: Playlist } | null
  >(null);

  const activePl = playlists.find((p) => p.id === view) ?? null;

  const confirmDeletePlaylist = (p: Playlist) => setConfirm({ kind: 'playlist', playlist: p });

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      <View style={s.header}>
        <Text style={s.logo}>
          Tok <Text style={{ color: C.pink }}>Music</Text>
        </Text>
        <Pressable hitSlop={10} onPress={showOnboarding}>
          <Ionicons name="help-circle-outline" size={24} color={C.dim} />
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.chips}
        style={{ flexGrow: 0 }}
      >
        <Chip label={`All songs · ${tracks.length}`} active={!view} onPress={() => setView(null)} />
        {playlists.map((p) => (
          <Chip
            key={p.id}
            label={`${p.name} · ${p.trackIds.filter((id) => tracks.some((t) => t.id === id)).length}`}
            active={view === p.id}
            onPress={() => setView(p.id)}
            onLongPress={() => setPlMenu(p)}
          />
        ))}
        <Chip label="New playlist" icon="add" onPress={() => setPrompt({ kind: 'newPlaylist' })} />
      </ScrollView>

      {activePl && (
        <View style={s.plHeader}>
          <Text style={s.plTitle} numberOfLines={1}>
            {activePl.name}
          </Text>
          <Pressable
            style={[s.plPlay, !visibleTracks.length && { opacity: 0.4 }]}
            disabled={!visibleTracks.length}
            onPress={() => visibleTracks[0] && play(visibleTracks[0], visibleTracks)}
          >
            <Ionicons name="play" size={16} color="#fff" />
            <Text style={s.plPlayText}>Play</Text>
          </Pressable>
          <Pressable hitSlop={10} onPress={() => setPlMenu(activePl)}>
            <Ionicons name="ellipsis-horizontal" size={22} color={C.dim} />
          </Pressable>
        </View>
      )}

      {notTikTok && (
        <Pressable style={[s.banner, { borderColor: C.pink }]} onPress={clear}>
          <Text style={s.bannerText}>The shared content has no TikTok link. Only TikTok is supported for now.</Text>
        </Pressable>
      )}

      {pending.map((p) => (
        <View key={p.key} style={[s.banner, p.error && { borderColor: C.pink }]}>
          {p.error ? <Ionicons name="alert-circle" size={18} color={C.pink} /> : <ActivityIndicator color={C.cyan} />}
          <Text style={s.bannerText} numberOfLines={2}>
            {p.error ?? `Downloading "${p.label}"…`}
          </Text>
          {p.error && (
            <Pressable onPress={() => dismissPending(p.key)} hitSlop={10}>
              <Ionicons name="close" size={18} color={C.dim} />
            </Pressable>
          )}
        </View>
      ))}

      <FlatList
        data={visibleTracks}
        keyExtractor={(t) => t.id}
        contentContainerStyle={{ paddingBottom: 220, paddingTop: 4 }}
        ListEmptyComponent={activePl ? <EmptyPlaylist /> : <Empty onHelp={showOnboarding} />}
        renderItem={({ item }) => (
          <Row
            t={item}
            active={current?.id === item.id}
            onPress={() => play(item, visibleTracks)}
            onMore={() => setTrackMenu(item)}
          />
        )}
      />

      <PlayerBar />

      {/* Track actions */}
      <TrackSheet
        key={trackMenu?.id ?? 'none'}
        track={trackMenu}
        onClose={() => setTrackMenu(null)}
        onRename={(t) => {
          setTrackMenu(null);
          setPrompt({ kind: 'renameTrack', track: t });
        }}
        onNewPlaylist={(t) => {
          setTrackMenu(null);
          setPrompt({ kind: 'newPlaylist', addTrackId: t.id });
        }}
        onDelete={(t) => {
          setTrackMenu(null);
          setConfirm({ kind: 'track', track: t });
        }}
      />

      <ConfirmDialog
        visible={!!confirm}
        title={confirm?.kind === 'playlist' ? 'Delete playlist?' : 'Delete sound?'}
        message={
          confirm?.kind === 'playlist'
            ? `"${confirm.playlist.name}" will be deleted. Its sounds stay in All songs.`
            : confirm?.kind === 'track'
              ? `"${confirm.track.title}" will be removed from your library and phone.`
              : undefined
        }
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm?.kind === 'playlist') deletePlaylist(confirm.playlist.id);
          else if (confirm?.kind === 'track') deleteTrack(confirm.track);
          setConfirm(null);
        }}
      />

      {/* Playlist actions */}
      <Sheet visible={!!plMenu} onClose={() => setPlMenu(null)} title={plMenu?.name}>
        <SheetItem
          icon="create-outline"
          label="Rename"
          onPress={() => {
            const p = plMenu!;
            setPlMenu(null);
            setPrompt({ kind: 'renamePlaylist', playlist: p });
          }}
        />
        <SheetItem
          icon="trash-outline"
          label="Delete playlist"
          danger
          onPress={() => {
            const p = plMenu!;
            setPlMenu(null);
            confirmDeletePlaylist(p);
          }}
        />
      </Sheet>

      <NamePrompt
        visible={!!prompt}
        title={
          prompt?.kind === 'renameTrack' ? 'Rename sound' : prompt?.kind === 'renamePlaylist' ? 'Rename playlist' : 'New playlist'
        }
        initial={
          prompt?.kind === 'renameTrack' ? prompt.track.title : prompt?.kind === 'renamePlaylist' ? prompt.playlist.name : ''
        }
        placeholder={prompt?.kind === 'renameTrack' ? 'Sound name' : 'Playlist name'}
        confirmLabel={prompt?.kind === 'newPlaylist' ? 'Create' : 'Save'}
        onCancel={() => setPrompt(null)}
        onSubmit={(v) => {
          if (prompt?.kind === 'renameTrack') renameTrack(prompt.track.id, v);
          else if (prompt?.kind === 'renamePlaylist') renamePlaylist(prompt.playlist.id, v);
          else if (prompt?.kind === 'newPlaylist') {
            const id = createPlaylist(v);
            if (prompt.addTrackId) addToPlaylist(id, prompt.addTrackId);
            else setView(id);
          }
          setPrompt(null);
        }}
      />

      <AddSoundModal />
      <Onboarding visible={onboarded === false && !draft} onDone={finishOnboarding} />
    </SafeAreaView>
  );
}

function TrackSheet({
  track,
  onClose,
  onRename,
  onNewPlaylist,
  onDelete,
}: {
  track: Track | null;
  onClose: () => void;
  onRename: (t: Track) => void;
  onNewPlaylist: (t: Track) => void;
  onDelete: (t: Track) => void;
}) {
  const { playlists, view, addToPlaylist, removeFromPlaylist } = useStore();
  const [picking, setPicking] = useState(false);
  if (!track) return <Sheet visible={false} onClose={onClose}>{null}</Sheet>;

  const inView = view ? playlists.find((p) => p.id === view) : undefined;

  const confirmDelete = () => onDelete(track);

  return (
    <Sheet visible onClose={onClose} title={picking ? 'Add to playlist' : track.title}>
      {picking ? (
        <ScrollView style={{ maxHeight: 420 }}>
          {playlists.map((p) => {
            const has = p.trackIds.includes(track.id);
            return (
              <SheetItem
                key={p.id}
                icon={has ? 'checkmark-circle' : 'ellipse-outline'}
                label={p.name}
                onPress={() => (has ? removeFromPlaylist(p.id, track.id) : addToPlaylist(p.id, track.id))}
              />
            );
          })}
          <SheetItem icon="add" label="New playlist" onPress={() => onNewPlaylist(track)} />
          <SheetItem icon="checkmark" label="Done" onPress={onClose} />
        </ScrollView>
      ) : (
        <>
          {track.contains && (
            <View style={s.sheetContains}>
              <Ionicons name="musical-notes" size={14} color={C.cyan} />
              <Text style={s.sheetContainsText} numberOfLines={1}>
                Contains: {track.contains.title}
                {track.contains.artist ? ` – ${track.contains.artist}` : ''}
              </Text>
            </View>
          )}
          <SheetItem icon="list" label="Add to playlist" onPress={() => setPicking(true)} />
          {inView && (
            <SheetItem
              icon="remove-circle-outline"
              label={`Remove from "${inView.name}"`}
              onPress={() => {
                removeFromPlaylist(inView.id, track.id);
                onClose();
              }}
            />
          )}
          <SheetItem icon="create-outline" label="Rename" onPress={() => onRename(track)} />
          <SheetItem
            icon="logo-tiktok"
            label="Open in TikTok"
            onPress={() => {
              onClose();
              Linking.openURL(track.videoUrl);
            }}
          />
          <SheetItem icon="trash-outline" label="Delete" danger onPress={confirmDelete} />
        </>
      )}
    </Sheet>
  );
}

function Empty({ onHelp }: { onHelp: () => void }) {
  return (
    <View style={s.empty}>
      <Ionicons name="musical-notes-outline" size={48} color={C.line} />
      <Text style={s.emptyTitle}>No sounds yet</Text>
      <Text style={s.emptyText}>
        In TikTok, tap Share → More → Tok Music on any video.{'\n'}
        Name it, pick a playlist, and it starts looping.
      </Text>
      <Pressable style={s.helpBtn} onPress={onHelp}>
        <Text style={s.helpText}>How it works</Text>
      </Pressable>
    </View>
  );
}

function EmptyPlaylist() {
  return (
    <View style={s.empty}>
      <Ionicons name="list-outline" size={48} color={C.line} />
      <Text style={s.emptyTitle}>This playlist is empty</Text>
      <Text style={s.emptyText}>
        Tap ⋯ on any sound in All songs and choose "Add to playlist", or pick this playlist when you share a new
        sound from TikTok.
      </Text>
    </View>
  );
}

function Row({ t, active, onPress, onMore }: { t: Track; active: boolean; onPress: () => void; onMore: () => void }) {
  const sub = t.contains
    ? `♪ ${t.contains.title}${t.contains.artist ? ` – ${t.contains.artist}` : ''}`
    : [t.artist, t.videoAuthor && `@${t.videoAuthor}`].filter(Boolean).join(' · ');
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onMore}
      style={({ pressed }) => [s.row, active && s.rowActive, pressed && { opacity: 0.7 }]}
    >
      <Cover uri={t.coverUri} size={52} />
      <View style={{ flex: 1 }}>
        <Text style={[s.title, active && { color: C.cyan }]} numberOfLines={1}>
          {t.title}
        </Text>
        <Text style={s.meta} numberOfLines={1}>
          {sub}
        </Text>
      </View>
      <Pressable hitSlop={12} onPress={onMore} style={{ padding: 4 }}>
        <Ionicons name="ellipsis-vertical" size={18} color={C.dim} />
      </Pressable>
    </Pressable>
  );
}

function fmt(sec: number) {
  if (!isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const ss = Math.floor(sec % 60);
  return `${m}:${ss.toString().padStart(2, '0')}`;
}

function PlayerBar() {
  const { current, playing, position, duration, repeat, toggle, next, prev, seek, setRepeat } = useStore();
  const [w, setW] = useState(1);
  if (!current) return null;
  const pct = duration ? Math.min(1, position / duration) : 0;

  const onSeek = (e: GestureResponderEvent) => {
    if (!duration) return;
    seek((e.nativeEvent.locationX / w) * duration);
  };

  return (
    <SafeAreaView edges={['bottom']} style={s.player}>
      <View style={s.playerTop}>
        <Cover uri={current.coverUri} size={48} />
        <View style={{ flex: 1 }}>
          <Text style={s.title} numberOfLines={1}>
            {current.title}
          </Text>
          <Text style={s.meta} numberOfLines={1}>
            {current.artist || current.contains?.artist || `@${current.videoAuthor}`}
          </Text>
        </View>
      </View>

      <Pressable
        onPress={onSeek}
        onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width || 1)}
        style={s.trackHit}
      >
        <View style={s.track}>
          <View style={[s.fill, { width: `${pct * 100}%` }]} />
        </View>
      </Pressable>
      <View style={s.times}>
        <Text style={s.time}>{fmt(position)}</Text>
        <Text style={s.time}>{fmt(duration)}</Text>
      </View>

      <View style={s.controls}>
        <Pressable hitSlop={10} onPress={() => setRepeat(repeat === 'one' ? 'all' : 'one')} style={s.repeatBtn}>
          <Ionicons name="repeat" size={22} color={C.cyan} />
          {repeat === 'one' && <Text style={s.repeatOne}>1</Text>}
        </Pressable>
        <Pressable hitSlop={10} onPress={prev}>
          <Ionicons name="play-skip-back" size={26} color={C.text} />
        </Pressable>
        <Pressable onPress={toggle} style={s.playBtn}>
          <Ionicons name={playing ? 'pause' : 'play'} size={30} color="#fff" style={!playing && { marginLeft: 3 }} />
        </Pressable>
        <Pressable hitSlop={10} onPress={next}>
          <Ionicons name="play-skip-forward" size={26} color={C.text} />
        </Pressable>
        <Text style={s.modeLabel}>{repeat === 'one' ? 'Loop one' : 'Playlist'}</Text>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8, paddingBottom: 10 },
  logo: { color: C.text, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  chips: { gap: 8, paddingHorizontal: 16, paddingBottom: 10 },
  plHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 8 },
  plTitle: { color: C.text, fontSize: 20, fontWeight: '800', flex: 1 },
  plPlay: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.pink, paddingHorizontal: 14, height: 32, borderRadius: 16 },
  plPlayText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  banner: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginBottom: 8, padding: 12, borderRadius: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.line },
  bannerText: { color: C.text, fontSize: 13, flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginHorizontal: 12, paddingHorizontal: 8, paddingVertical: 8, borderRadius: 12 },
  rowActive: { backgroundColor: C.card },
  title: { color: C.text, fontSize: 15, fontWeight: '600' },
  meta: { color: C.dim, fontSize: 12, marginTop: 2 },
  empty: { alignItems: 'center', paddingTop: 70, paddingHorizontal: 40, gap: 10 },
  emptyTitle: { color: C.text, fontSize: 17, fontWeight: '700' },
  emptyText: { color: C.dim, fontSize: 13, textAlign: 'center', lineHeight: 19 },
  helpBtn: { marginTop: 8, paddingHorizontal: 20, height: 40, borderRadius: 20, borderWidth: 1, borderColor: C.line, justifyContent: 'center' },
  helpText: { color: C.text, fontWeight: '600' },
  sheetContains: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 20, paddingBottom: 6 },
  sheetContainsText: { color: C.cyan, fontSize: 13, flex: 1 },
  player: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: C.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingHorizontal: 18, paddingTop: 14, borderTopWidth: 1, borderColor: C.line },
  playerTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  trackHit: { paddingVertical: 10, marginTop: 6 },
  track: { height: 4, borderRadius: 2, backgroundColor: C.line, overflow: 'hidden' },
  fill: { height: 4, backgroundColor: C.pink },
  times: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -4 },
  time: { color: C.dim, fontSize: 11, fontVariant: ['tabular-nums'] },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 6, paddingTop: 6, paddingBottom: 10 },
  playBtn: { width: 58, height: 58, borderRadius: 29, backgroundColor: C.pink, alignItems: 'center', justifyContent: 'center' },
  repeatBtn: { width: 44, alignItems: 'center' },
  repeatOne: { position: 'absolute', top: -6, right: 6, color: C.cyan, fontSize: 10, fontWeight: '800' },
  modeLabel: { width: 54, color: C.dim, fontSize: 11, textAlign: 'center' },
});

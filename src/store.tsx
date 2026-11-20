import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import {
  deleteTrackFiles,
  downloadTrack,
  getOnboarded,
  loadPlaylists,
  loadTracks,
  savePlaylists,
  saveTracks,
  setOnboarded,
  type Playlist,
  type Track,
} from './library';
import { getTikTokSound, type TikTokSound } from './tiktok';

export type RepeatMode = 'one' | 'all';
export type Pending = { key: string; label: string; error?: string };

/** A shared TikTok link waiting for the user to name it and pick playlists. */
export type Draft = {
  key: string;
  url: string;
  status: 'loading' | 'ready' | 'error';
  sound?: TikTokSound;
  error?: string;
};

type Ctx = {
  tracks: Track[];
  playlists: Playlist[];
  view: string | null; // selected playlist id, null = all songs
  setView: (id: string | null) => void;
  visibleTracks: Track[];
  pending: Pending[];
  draft: Draft | null;
  onboarded: boolean | null;
  finishOnboarding: () => void;
  showOnboarding: () => void;
  current: Track | null;
  playing: boolean;
  position: number;
  duration: number;
  repeat: RepeatMode;
  openShare: (url: string) => void;
  retryDraft: () => void;
  cancelDraft: () => void;
  confirmDraft: (opts: { title: string; artist: string; playlistIds: string[] }) => void;
  play: (t: Track, queue?: Track[]) => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  seek: (sec: number) => void;
  setRepeat: (m: RepeatMode) => void;
  renameTrack: (id: string, title: string) => void;
  deleteTrack: (t: Track) => void;
  createPlaylist: (name: string) => string;
  renamePlaylist: (id: string, name: string) => void;
  deletePlaylist: (id: string) => void;
  addToPlaylist: (playlistId: string, trackId: string) => void;
  removeFromPlaylist: (playlistId: string, trackId: string) => void;
  dismissPending: (key: string) => void;
};

const StoreCtx = createContext<Ctx | null>(null);
export const useStore = () => {
  const c = useContext(StoreCtx);
  if (!c) throw new Error('StoreProvider missing');
  return c;
};

let sharedPlayer: AudioPlayer | null = null;
function getPlayer() {
  if (!sharedPlayer) sharedPlayer = createAudioPlayer(null, { updateInterval: 250 });
  return sharedPlayer;
}

const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [view, setView] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [onboarded, setOnboardedState] = useState<boolean | null>(null);
  const [current, setCurrent] = useState<Track | null>(null);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [repeat, setRepeatState] = useState<RepeatMode>('one');

  const tracksRef = useRef(tracks);
  tracksRef.current = tracks;
  const playlistsRef = useRef(playlists);
  playlistsRef.current = playlists;
  const currentRef = useRef(current);
  currentRef.current = current;
  const repeatRef = useRef(repeat);
  repeatRef.current = repeat;
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const queueRef = useRef<string[]>([]); // track ids the player steps through

  const player = getPlayer();

  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'doNotMix',
    }).catch(() => {});
    loadTracks().then(setTracks);
    loadPlaylists().then(setPlaylists);
    getOnboarded().then(setOnboardedState);
  }, []);

  const persistTracks = useCallback((list: Track[]) => {
    tracksRef.current = list;
    setTracks(list);
    saveTracks(list).catch(() => {});
  }, []);

  const persistPlaylists = useCallback((list: Playlist[]) => {
    playlistsRef.current = list;
    setPlaylists(list);
    savePlaylists(list).catch(() => {});
  }, []);

  const tracksOf = useCallback((pid: string | null): Track[] => {
    const all = tracksRef.current;
    if (!pid) return all;
    const pl = playlistsRef.current.find((p) => p.id === pid);
    if (!pl) return all;
    const byId = new Map(all.map((t) => [t.id, t]));
    return pl.trackIds.map((id) => byId.get(id)).filter(Boolean) as Track[];
  }, []);

  const play = useCallback(
    (t: Track, queue?: Track[]) => {
      if (queue) queueRef.current = queue.map((x) => x.id);
      else if (!queueRef.current.includes(t.id)) queueRef.current = tracksRef.current.map((x) => x.id);
      player.replace({ uri: t.fileUri });
      player.loop = repeatRef.current === 'one';
      player.play();
      setCurrent(t);
      setPosition(0);
      try {
        player.setActiveForLockScreen(true, {
          title: t.title,
          artist: t.artist || t.contains?.artist || t.videoAuthor,
          artworkUrl: t.coverUri ?? undefined,
        });
      } catch {}
    },
    [player]
  );

  const step = useCallback(
    (dir: 1 | -1) => {
      const byId = new Map(tracksRef.current.map((t) => [t.id, t]));
      let list = queueRef.current.map((id) => byId.get(id)).filter(Boolean) as Track[];
      if (!list.length) list = tracksRef.current;
      if (!list.length) return;
      const cur = currentRef.current;
      const i = cur ? list.findIndex((t) => t.id === cur.id) : -1;
      play(list[(i + dir + list.length) % list.length], list);
    },
    [play]
  );

  useEffect(() => {
    const sub = player.addListener('playbackStatusUpdate', (s) => {
      setPlaying(s.playing);
      setPosition(s.currentTime);
      if (s.duration) setDuration(s.duration);
      if (s.didJustFinish && repeatRef.current === 'all') step(1);
    });
    return () => sub.remove();
  }, [player, step]);

  // ---- Share flow: link -> details screen -> download ----

  const fetchDraft = useCallback((key: string, url: string) => {
    getTikTokSound(url)
      .then((sound) => {
        if (draftRef.current?.key !== key) return;
        setDraft({ key, url, status: 'ready', sound });
      })
      .catch((e: any) => {
        if (draftRef.current?.key !== key) return;
        setDraft({ key, url, status: 'error', error: e?.message ?? 'Something went wrong' });
      });
  }, []);

  const openShare = useCallback(
    (url: string) => {
      const key = uid();
      const d: Draft = { key, url, status: 'loading' };
      draftRef.current = d;
      setDraft(d);
      fetchDraft(key, url);
    },
    [fetchDraft]
  );

  const retryDraft = useCallback(() => {
    const d = draftRef.current;
    if (d) openShare(d.url);
  }, [openShare]);

  const cancelDraft = useCallback(() => {
    draftRef.current = null;
    setDraft(null);
  }, []);

  const addToPlaylists = useCallback(
    (trackId: string, ids: string[]) => {
      if (!ids.length) return;
      persistPlaylists(
        playlistsRef.current.map((p) =>
          ids.includes(p.id) && !p.trackIds.includes(trackId) ? { ...p, trackIds: [trackId, ...p.trackIds] } : p
        )
      );
    },
    [persistPlaylists]
  );

  const confirmDraft = useCallback(
    ({ title, artist, playlistIds }: { title: string; artist: string; playlistIds: string[] }) => {
      const d = draftRef.current;
      if (!d?.sound) return;
      const sound = d.sound;
      draftRef.current = null;
      setDraft(null);
      const key = d.key;
      setPending((p) => [{ key, label: title || sound.title }, ...p]);
      (async () => {
        try {
          const t = await downloadTrack(sound, { title, artist });
          const existing = tracksRef.current.find((x) => x.id === t.id);
          const keep = existing ? { ...t, addedAt: existing.addedAt } : t;
          persistTracks([keep, ...tracksRef.current.filter((x) => x.id !== t.id)]);
          addToPlaylists(keep.id, playlistIds);
          setPending((p) => p.filter((x) => x.key !== key));
          // Start looping right away, inside the first chosen playlist if any
          const pid = playlistIds[0] ?? null;
          play(keep, tracksOf(pid));
        } catch (e: any) {
          setPending((p) =>
            p.map((x) => (x.key === key ? { ...x, error: e?.message ?? 'Download failed' } : x))
          );
        }
      })();
    },
    [persistTracks, addToPlaylists, play, tracksOf]
  );

  // ---- Player controls ----

  const toggle = useCallback(() => {
    if (!currentRef.current) {
      const list = tracksOf(view);
      if (list[0]) play(list[0], list);
      return;
    }
    if (player.playing) player.pause();
    else player.play();
  }, [player, play, tracksOf, view]);

  const setRepeat = useCallback(
    (m: RepeatMode) => {
      setRepeatState(m);
      player.loop = m === 'one';
    },
    [player]
  );

  // ---- Library / playlists ----

  const renameTrack = useCallback(
    (id: string, title: string) => {
      const name = title.trim();
      if (!name) return;
      persistTracks(tracksRef.current.map((t) => (t.id === id ? { ...t, title: name } : t)));
      if (currentRef.current?.id === id) setCurrent((c) => (c ? { ...c, title: name } : c));
    },
    [persistTracks]
  );

  const deleteTrack = useCallback(
    (t: Track) => {
      if (currentRef.current?.id === t.id) {
        player.pause();
        try {
          player.clearLockScreenControls();
        } catch {}
        setCurrent(null);
      }
      deleteTrackFiles(t);
      persistTracks(tracksRef.current.filter((x) => x.id !== t.id));
      persistPlaylists(
        playlistsRef.current.map((p) => ({ ...p, trackIds: p.trackIds.filter((id) => id !== t.id) }))
      );
    },
    [persistTracks, persistPlaylists, player]
  );

  const createPlaylist = useCallback(
    (name: string) => {
      const id = uid();
      persistPlaylists([
        ...playlistsRef.current,
        { id, name: name.trim() || 'New playlist', trackIds: [], createdAt: Date.now() },
      ]);
      return id;
    },
    [persistPlaylists]
  );

  const renamePlaylist = useCallback(
    (id: string, name: string) => {
      if (!name.trim()) return;
      persistPlaylists(playlistsRef.current.map((p) => (p.id === id ? { ...p, name: name.trim() } : p)));
    },
    [persistPlaylists]
  );

  const deletePlaylist = useCallback(
    (id: string) => {
      persistPlaylists(playlistsRef.current.filter((p) => p.id !== id));
      setView((v) => (v === id ? null : v));
    },
    [persistPlaylists]
  );

  const addToPlaylist = useCallback(
    (pid: string, tid: string) => addToPlaylists(tid, [pid]),
    [addToPlaylists]
  );

  const removeFromPlaylist = useCallback(
    (pid: string, tid: string) => {
      persistPlaylists(
        playlistsRef.current.map((p) => (p.id === pid ? { ...p, trackIds: p.trackIds.filter((x) => x !== tid) } : p))
      );
    },
    [persistPlaylists]
  );

  const visibleTracks = useMemo(() => {
    if (!view) return tracks;
    const pl = playlists.find((p) => p.id === view);
    if (!pl) return tracks;
    const byId = new Map(tracks.map((t) => [t.id, t]));
    return pl.trackIds.map((id) => byId.get(id)).filter(Boolean) as Track[];
  }, [tracks, playlists, view]);

  const value = useMemo<Ctx>(
    () => ({
      tracks,
      playlists,
      view,
      setView,
      visibleTracks,
      pending,
      draft,
      onboarded,
      finishOnboarding: () => {
        setOnboardedState(true);
        setOnboarded();
      },
      showOnboarding: () => setOnboardedState(false),
      current,
      playing,
      position,
      duration,
      repeat,
      openShare,
      retryDraft,
      cancelDraft,
      confirmDraft,
      play,
      toggle,
      next: () => step(1),
      prev: () => step(-1),
      seek: (sec) => player.seekTo(sec).catch(() => {}),
      setRepeat,
      renameTrack,
      deleteTrack,
      createPlaylist,
      renamePlaylist,
      deletePlaylist,
      addToPlaylist,
      removeFromPlaylist,
      dismissPending: (key) => setPending((p) => p.filter((x) => x.key !== key)),
    }),
    [
      tracks, playlists, view, visibleTracks, pending, draft, onboarded, current, playing, position, duration,
      repeat, openShare, retryDraft, cancelDraft, confirmDraft, play, toggle, step, player, setRepeat,
      renameTrack, deleteTrack, createPlaylist, renamePlaylist, deletePlaylist, addToPlaylist, removeFromPlaylist,
    ]
  );

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}

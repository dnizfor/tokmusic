import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';
import type { Contains, TikTokSound } from './tiktok';

export type Track = {
  id: string; // = TikTok music id (the same sound is never added twice)
  title: string; // display name (chosen by the user before download)
  artist: string;
  soundTitle?: string; // original TikTok sound name
  soundAuthor?: string;
  contains?: Contains | null; // "Contains: …" song, if TikTok shows one
  original: boolean;
  duration: number;
  videoUrl: string;
  videoAuthor: string;
  videoDesc: string;
  fileUri: string;
  coverUri: string | null;
  addedAt: number;
};

export type Playlist = {
  id: string;
  name: string;
  trackIds: string[];
  createdAt: number;
};

const KEY = 'tokmusic.tracks.v1';
const PL_KEY = 'tokmusic.playlists.v1';
const ONBOARD_KEY = 'tokmusic.onboarded.v1';

function soundsDir(): Directory {
  const dir = new Directory(Paths.document, 'sounds');
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

export async function loadTracks(): Promise<Track[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const list: Track[] = raw ? JSON.parse(raw) : [];
    // Drop entries whose file is gone
    return list.filter((t) => {
      try {
        return new File(t.fileUri).exists;
      } catch {
        return false;
      }
    });
  } catch {
    return [];
  }
}

export async function saveTracks(list: Track[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(list));
}

export async function loadPlaylists(): Promise<Playlist[]> {
  try {
    const raw = await AsyncStorage.getItem(PL_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function savePlaylists(list: Playlist[]): Promise<void> {
  await AsyncStorage.setItem(PL_KEY, JSON.stringify(list));
}

export async function getOnboarded(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(ONBOARD_KEY)) === '1';
  } catch {
    return false;
  }
}

export async function setOnboarded(): Promise<void> {
  await AsyncStorage.setItem(ONBOARD_KEY, '1').catch(() => {});
}

function safeName(s: string): string {
  return s.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 60);
}

/** Downloads the sound file and its cover to the phone. */
export async function downloadTrack(
  s: TikTokSound,
  meta: { title: string; artist: string }
): Promise<Track> {
  const dir = soundsDir();
  const base = safeName(s.musicId);

  const audioFile = new File(dir, `${base}.${s.audioExt}`);
  await File.downloadFileAsync(s.audioUrl, audioFile, {
    idempotent: true,
    headers: { Referer: 'https://www.tiktok.com/', 'User-Agent': 'Mozilla/5.0' },
  });

  // Cover links expire after a few days, so the cover is downloaded too.
  let coverUri: string | null = null;
  if (s.coverUrl) {
    try {
      const coverFile = new File(dir, `${base}.jpg`);
      await File.downloadFileAsync(s.coverUrl, coverFile, { idempotent: true });
      coverUri = coverFile.uri;
    } catch {
      coverUri = null;
    }
  }

  return {
    id: s.musicId,
    title: meta.title.trim() || s.contains?.title || s.title,
    artist: meta.artist.trim(),
    soundTitle: s.title,
    soundAuthor: s.artist,
    contains: s.contains,
    original: s.original,
    duration: s.duration,
    videoUrl: s.videoUrl,
    videoAuthor: s.videoAuthor,
    videoDesc: s.videoDesc,
    fileUri: audioFile.uri,
    coverUri,
    addedAt: Date.now(),
  };
}

export function deleteTrackFiles(t: Track) {
  for (const uri of [t.fileUri, t.coverUri]) {
    if (!uri) continue;
    try {
      const f = new File(uri);
      if (f.exists) f.delete();
    } catch {}
  }
}

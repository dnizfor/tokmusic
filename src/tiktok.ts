/**
 * TikTok link -> sound info.
 * Everything runs on the phone; no server.
 *  1) First the TikTok page itself is read (embedded JSON).
 *  2) If TikTok blocks it, tikwm.com's public API is tried.
 *  "Contains" (the commercial song inside an original sound) comes from the
 *  page's tt2dsp field: Apple Music id -> iTunes lookup, or Spotify id -> oEmbed.
 */

/** The song TikTok shows as "Contains: …" under an original sound. */
export type Contains = { title: string; artist: string };

export type TikTokSound = {
  videoId: string;
  videoUrl: string; // full link of the shared video
  videoDesc: string;
  videoAuthor: string;
  musicId: string;
  title: string; // sound name
  artist: string;
  original: boolean; // "original sound" mu
  duration: number; // saniye (bilinmiyorsa 0)
  coverUrl: string | null;
  audioUrl: string; // indirilecek dosya
  audioExt: 'mp3' | 'mp4'; // mp4 = no music file, use the video itself (only audio is played)
  contains: Contains | null;
};

const DESKTOP_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const TIKTOK_URL_RE = /https?:\/\/(?:[\w-]+\.)?tiktok\.com\/[^\s"'<>]+/i;

/** Extracts the TikTok link from shared text ("Check this out! https://vt.tiktok.com/xyz/"). */
export function findTikTokUrl(text: string | null | undefined): string | null {
  if (!text) return null;
  const m = text.match(TIKTOK_URL_RE);
  return m ? m[0].replace(/[).,!]+$/, '') : null;
}

function withTimeout(ms: number): { signal: AbortSignal; done: () => void } {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  return { signal: c.signal, done: () => clearTimeout(t) };
}

/** Expands vt.tiktok.com / vm.tiktok.com short links. */
async function resolveUrl(url: string): Promise<string> {
  if (/\/(video|photo)\/\d+/.test(url)) return url;
  const { signal, done } = withTimeout(10000);
  try {
    const res = await fetch(url, { headers: { 'User-Agent': DESKTOP_UA }, signal });
    return res.url || url;
  } catch {
    return url;
  } finally {
    done();
  }
}

function videoIdFrom(url: string): string | null {
  const m = url.match(/\/(?:video|photo)\/(\d+)/);
  return m ? m[1] : null;
}

function cleanUrl(url: string): string {
  return url.split('?')[0];
}

async function getJson(url: string): Promise<any | null> {
  const { signal, done } = withTimeout(8000);
  try {
    const res = await fetch(url, { signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    done();
  }
}

/** Finds the "Contains: song – artist" info of a TikTok sound, if any. */
async function lookupContains(music: any): Promise<Contains | null> {
  // Explicit fields, if TikTok ever sends them
  const ms = music?.matchedSong ?? music?.matched_song;
  if (ms?.title) return { title: String(ms.title), artist: String(ms.author ?? ms.authorName ?? '') };

  const infos: any[] = music?.tt2dsp?.tt_to_dsp_song_infos ?? [];
  const apple = infos.find((i) => Number(i?.Platform) === 1 && i?.SongId);
  if (apple) {
    for (const country of ['us', 'tr', 'gb']) {
      const j = await getJson(`https://itunes.apple.com/lookup?id=${encodeURIComponent(apple.SongId)}&country=${country}`);
      const r = j?.results?.[0];
      if (r?.trackName) return { title: String(r.trackName), artist: String(r.artistName ?? '') };
    }
  }
  const spotify = infos.find((i) => Number(i?.Platform) === 3 && i?.SongId);
  if (spotify) {
    const j = await getJson(
      `https://open.spotify.com/oembed?url=${encodeURIComponent(`https://open.spotify.com/track/${spotify.SongId}`)}`
    );
    if (j?.title) return { title: String(j.title), artist: '' };
  }
  return null;
}

/** 1) Directly from the TikTok page. */
async function fromTikTokPage(url: string): Promise<TikTokSound | null> {
  const { signal, done } = withTimeout(10000);
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': DESKTOP_UA, 'Accept-Language': 'en-US,en;q=0.9' },
      signal,
    });
    const html = await res.text();
    const m = html.match(
      /<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/
    );
    if (!m) return null;
    const scope = JSON.parse(m[1])?.__DEFAULT_SCOPE__;
    const item = scope?.['webapp.video-detail']?.itemInfo?.itemStruct;
    const music = item?.music;
    if (!item || !music) return null;

    const musicUrl: string | undefined = music.playUrl;
    // The video URL needs cookies, so this path is only used when a music file exists.
    if (!musicUrl) return null;

    const finalUrl = cleanUrl(res.url || url);
    return {
      videoId: String(item.id),
      videoUrl: finalUrl,
      videoDesc: item.desc ?? '',
      videoAuthor: item.author?.uniqueId ?? '',
      musicId: String(music.id ?? item.id),
      title: music.title || 'Unknown sound',
      artist: music.authorName || '',
      original: !!music.original,
      duration: Number(music.duration) || 0,
      coverUrl: music.coverLarge || music.coverMedium || music.coverThumb || null,
      audioUrl: musicUrl,
      audioExt: 'mp3',
      contains: await lookupContains(music),
    };
  } catch {
    return null;
  } finally {
    done();
  }
}

/** 2) Fallback: tikwm.com API. */
async function fromTikwm(url: string): Promise<TikTokSound | null> {
  const { signal, done } = withTimeout(20000);
  try {
    const body = `url=${encodeURIComponent(url)}&hd=0`;
    const res = await fetch('https://www.tikwm.com/api/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal,
    });
    const json = await res.json();
    if (json?.code !== 0 || !json.data) return null;
    const d = json.data;
    const mi = d.music_info ?? {};
    const abs = (u?: string) => (u && u.startsWith('/') ? `https://www.tikwm.com${u}` : u);
    const musicUrl = abs(mi.play || d.music);
    const videoUrl = abs(d.play);
    const audioUrl = musicUrl || videoUrl;
    if (!audioUrl) return null;
    const vid = String(d.id ?? videoIdFrom(url) ?? Date.now());
    const author = d.author?.unique_id ?? '';
    return {
      videoId: vid,
      videoUrl: author ? `https://www.tiktok.com/@${author}/video/${vid}` : cleanUrl(url),
      videoDesc: d.title ?? '',
      videoAuthor: author,
      musicId: String(mi.id ?? vid),
      title: mi.title || 'Unknown sound',
      artist: mi.author || '',
      original: !!mi.original,
      duration: Number(mi.duration) || Number(d.duration) || 0,
      coverUrl: abs(mi.cover) || abs(d.cover) || null,
      audioUrl,
      audioExt: musicUrl ? 'mp3' : 'mp4',
      contains: null,
    };
  } catch {
    return null;
  } finally {
    done();
  }
}

export async function getTikTokSound(sharedUrl: string): Promise<TikTokSound> {
  const url = await resolveUrl(sharedUrl);
  const direct = await fromTikTokPage(url);
  if (direct) return direct;
  const viaApi = await fromTikwm(url);
  if (viaApi) return viaApi;
  throw new Error("Couldn't get the sound of this TikTok. The video may be private or deleted.");
}

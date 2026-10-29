import { loadConfig } from "../config/env";
import { AppError, ValidationError } from "../errors";
import { ElevenLabsClient } from "../integrations/elevenlabs/client";
import type { RemoteVoice } from "../integrations/elevenlabs/schemas";
import { fromRemote } from "./service";

export interface VoiceInfo {
  voiceId: string; name: string; category: string | null; description: string | null; previewUrl: string | null;
  labels: Record<string, string>; languages: string[];
}
export interface VoiceQuery { search?: string; language?: string; category?: string; pageToken?: string }
export interface VoicePage { voices: VoiceInfo[]; nextPageToken: string | null; hasMore: boolean; filteredByLanguage: boolean }

const TTL_MS = 60_000;
const cache = globalThis as unknown as { __voiceCache?: Map<string, { at: number; page: VoicePage }> };
const client = () => { const e = loadConfig().elevenlabs; return new ElevenLabsClient({ apiKey: e.apiKey, baseUrl: e.baseUrl, timeoutMs: 20000 }); };

export function normalizeVoice(v: RemoteVoice): VoiceInfo {
  const labels = Object.fromEntries(Object.entries(v.labels ?? {}).filter(([, x]) => typeof x === "string") as [string, string][]);
  const langs = new Set<string>();
  for (const l of v.verified_languages ?? []) { const code = l.language ?? l.locale; if (code) langs.add(code.toLowerCase()); }
  if (labels.language) langs.add(labels.language.toLowerCase());
  return { voiceId: v.voice_id, name: v.name ?? v.voice_id, category: v.category ?? null, description: v.description ?? null, previewUrl: v.preview_url ?? null, labels, languages: [...langs] };
}

/** Lists voices from ElevenLabs. Cached briefly per query. The language filter applies to the metadata the API returned. */
export async function listVoices(q: VoiceQuery, remote: Pick<ElevenLabsClient, "listVoices"> = client()): Promise<VoicePage> {
  const key = JSON.stringify([q.search ?? "", q.category ?? "", q.pageToken ?? ""]);
  const hit = cache.__voiceCache?.get(key);
  let page = hit && Date.now() - hit.at < TTL_MS ? hit.page : undefined;
  if (!page) {
    try {
      const res = await remote.listVoices({ search: q.search, category: q.category, pageToken: q.pageToken, pageSize: 30 });
      page = { voices: res.voices.map(normalizeVoice), nextPageToken: res.next_page_token ?? null, hasMore: Boolean(res.has_more), filteredByLanguage: false };
    } catch (err) { throw fromRemote(err); }
    (cache.__voiceCache ??= new Map()).set(key, { at: Date.now(), page });
  }
  if (q.language) {
    const want = q.language.toLowerCase();
    return { ...page, filteredByLanguage: true, voices: page.voices.filter((v) => v.languages.some((l) => l === want || l.startsWith(`${want}-`))) };
  }
  return page;
}

export async function previewVoice(voiceId: string, text: string, remote: Pick<ElevenLabsClient, "textToSpeech"> = client()) {
  if (!/^[A-Za-z0-9_-]{6,64}$/.test(voiceId)) throw new ValidationError("Invalid voice id.", { voiceId: ["Invalid voice id."] });
  const t = text.trim();
  if (!t) throw new ValidationError("Enter the text to speak.", { text: ["Required."] });
  if (t.length > 300) throw new ValidationError("Preview text is limited to 300 characters.", { text: ["Must be 300 characters or fewer."] });
  try { return await remote.textToSpeech(voiceId, t, loadConfig().elevenlabs.previewModel); }
  catch (err) { if (err instanceof AppError) throw err; throw fromRemote(err); }
}

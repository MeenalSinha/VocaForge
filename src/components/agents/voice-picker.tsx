"use client";

import { Play, Search } from "lucide-react";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, Spinner } from "@/components/ui/feedback";
import { Input } from "@/components/ui/form";
import { ApiError, api } from "@/lib/api";
import type { VoiceInfo, VoicePage } from "@/server/agents/voices";

export function VoicePicker({ value, onSelect, previewText }: { value?: string; onSelect: (voiceId: string | undefined) => void; previewText: string }) {
  const [voices, setVoices] = React.useState<VoiceInfo[]>([]);
  const [next, setNext] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [language, setLanguage] = React.useState("");
  const [note, setNote] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const audio = React.useRef<HTMLAudioElement | null>(null);

  const load = React.useCallback(async (opts: { search: string; language: string; pageToken?: string }) => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams();
      if (opts.search) q.set("search", opts.search);
      if (opts.language) q.set("language", opts.language);
      if (opts.pageToken) q.set("pageToken", opts.pageToken);
      const page = await api<VoicePage>(`/api/voices?${q}`);
      const list = Array.isArray(page?.voices) ? page.voices : [];
      setVoices((v) => (opts.pageToken ? [...v, ...list] : list));
      setNext(page?.nextPageToken ?? null);
    } catch (err) {
      setVoices([]);
      setError(err instanceof ApiError ? err.message : "Voices could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => { void load({ search: "", language: "" }); }, [load]);

  async function preview(v: VoiceInfo) {
    setBusyId(v.voiceId);
    setNote(null);
    try {
      const res = await fetch(`/api/voices/${encodeURIComponent(v.voiceId)}/preview`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: previewText.slice(0, 300) }) });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new ApiError(body?.error?.message ?? "Preview failed.", body?.error?.code ?? "unknown");
      }
      const url = URL.createObjectURL(await res.blob());
      if (audio.current) { audio.current.src = url; await audio.current.play(); }
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Preview failed.");
    } finally {
      setBusyId(null);
    }
  }

  const selected = voices.find((v) => v.voiceId === value);

  return (
    <div className="space-y-3">
      <form role="search" className="flex flex-wrap items-end gap-2" onSubmit={(e) => { e.preventDefault(); void load({ search, language }); }}>
        <div className="min-w-48 flex-1">
          <label htmlFor="voice-search" className="mb-1.5 block text-sm font-medium">Search voices</label>
          <Input id="voice-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name or description" />
        </div>
        <div className="w-32">
          <label htmlFor="voice-language" className="mb-1.5 block text-sm font-medium">Language</label>
          <Input id="voice-language" value={language} onChange={(e) => setLanguage(e.target.value)} placeholder="e.g. hi" />
        </div>
        <Button type="submit" variant="secondary"><Search className="h-4 w-4" aria-hidden />Search</Button>
      </form>
      {language && <p className="text-xs text-muted">The language filter applies to the language details ElevenLabs returned for each voice. Voices without language details are hidden.</p>}

      <p className="text-sm" aria-live="polite">
        {value ? <>Selected voice: <strong>{selected?.name ?? "(not in the list below)"}</strong> <span className="font-mono text-xs text-muted">{value}</span> <Button variant="ghost" size="sm" onClick={() => onSelect(undefined)}>Clear</Button></> : "No voice selected. ElevenLabs will use its default voice for the agent."}
      </p>

      {loading && voices.length === 0 && <Spinner label="Loading voices from ElevenLabs" />}
      {error && <Alert tone="danger" title="Voices are unavailable">{error}</Alert>}
      {note && <Alert tone="warning" title="Preview failed">{note}</Alert>}
      {!loading && !error && voices.length === 0 && <p className="text-sm text-muted">ElevenLabs returned no voices for this search.</p>}

      <ul className="grid gap-2 sm:grid-cols-2">
        {voices.map((v) => (
          <li key={v.voiceId} className={`rounded-md border p-3 ${v.voiceId === value ? "border-accent bg-accent-soft" : "bg-surface"}`}>
            <div className="flex items-start justify-between gap-2">
              <p className="font-medium">{v.name}</p>
              {v.category && <Badge>{v.category}</Badge>}
            </div>
            {v.description && <p className="mt-1 line-clamp-2 text-xs text-muted">{v.description}</p>}
            {Object.keys(v.labels).length > 0 && <p className="mt-1 text-xs text-muted">{Object.entries(v.labels).map(([k, x]) => `${k}: ${x}`).join(", ")}</p>}
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant={v.voiceId === value ? "primary" : "secondary"} onClick={() => onSelect(v.voiceId)} aria-pressed={v.voiceId === value}>{v.voiceId === value ? "Selected" : "Select"}</Button>
              <Button size="sm" variant="ghost" loading={busyId === v.voiceId} onClick={() => preview(v)} title="Generates speech with ElevenLabs using your welcome message. Uses text-to-speech characters."><Play className="h-3.5 w-3.5" aria-hidden />Preview</Button>
              {v.previewUrl && <Button size="sm" variant="ghost" onClick={() => { if (audio.current) { audio.current.src = v.previewUrl!; void audio.current.play(); } }}>Play sample</Button>}
            </div>
          </li>
        ))}
      </ul>
      {next && <Button variant="secondary" onClick={() => load({ search, language, pageToken: next })} loading={loading}>Load more voices</Button>}
      <audio ref={audio} className="hidden" />
    </div>
  );
}

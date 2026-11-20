/**
 * SRT / VTT export & import helpers.
 */

import type { SubtitleCue, SubtitleStyle } from './types';

function pad(n: number, w = 2) {
  return String(Math.floor(n)).padStart(w, '0');
}

export function formatSrtTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.round((sec % 1) * 1000);
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
}

export function formatVttTime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  const ms = Math.round((sec % 1) * 1000);
  return `${pad(h)}:${pad(m)}:${pad(s)}.${pad(ms, 3)}`;
}

export function cuesToSRT(cues: SubtitleCue[]): string {
  const sorted = [...cues].sort((a, b) => a.start - b.start);
  return sorted
    .map((c, i) => {
      const text = c.text.replace(/\r/g, '').trim();
      return `${i + 1}\n${formatSrtTime(c.start)} --> ${formatSrtTime(c.end)}\n${text}\n`;
    })
    .join('\n');
}

export function cuesToVTT(cues: SubtitleCue[], style?: SubtitleStyle): string {
  const sorted = [...cues].sort((a, b) => a.start - b.start);
  let header = 'WEBVTT\n\n';
  if (style) {
    header += `STYLE\n::cue {\n  color: ${style.color};\n  font-family: ${style.fontFamily};\n}\n\n`;
  }
  return (
    header +
    sorted
      .map((c) => {
        const text = c.text.replace(/\r/g, '').trim();
        return `${formatVttTime(c.start)} --> ${formatVttTime(c.end)}\n${text}\n`;
      })
      .join('\n')
  );
}

export function parseSRT(content: string, language: SubtitleCue['language'] = 'fr'): SubtitleCue[] {
  const blocks = content.replace(/\r/g, '').trim().split(/\n\n+/);
  const cues: SubtitleCue[] = [];
  for (const block of blocks) {
    const lines = block.split('\n').filter(Boolean);
    if (lines.length < 2) continue;
    const timeLine = lines.find((l) => l.includes('-->')) || lines[1];
    const m = timeLine.match(
      /(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})\s*-->\s*(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})/
    );
    if (!m) continue;
    const toSec = (h: string, mi: string, s: string, ms: string) =>
      +h * 3600 + +mi * 60 + +s + parseInt(ms.padEnd(3, '0'), 10) / 1000;
    const start = toSec(m[1], m[2], m[3], m[4]);
    const end = toSec(m[5], m[6], m[7], m[8]);
    const timeIdx = lines.indexOf(timeLine);
    const text = lines.slice(timeIdx + 1).join('\n');
    cues.push({
      id: `cue-${Math.random().toString(36).slice(2, 10)}`,
      start,
      end,
      text,
      language,
    });
  }
  return cues;
}

export function downloadText(filename: string, content: string, mime = 'text/plain') {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

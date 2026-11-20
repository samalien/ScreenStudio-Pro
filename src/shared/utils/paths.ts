/**
 * Path helpers – pure functions, no Node dependency so usable in renderer too.
 */

export function sanitizeFileName(name: string): string {
  return name
  // eslint-disable-next-line no-control-regex -- intentional strip of control characters
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 200) || 'untitled';
}

export function ensureExtension(filePath: string, ext: string): string {
  const e = ext.startsWith('.') ? ext : `.${ext}`;
  if (filePath.toLowerCase().endsWith(e.toLowerCase())) return filePath;
  return filePath + e;
}

export function joinUrl(...parts: string[]): string {
  return parts
    .map((p, i) => {
      if (i === 0) return p.replace(/\/+$/, '');
      return p.replace(/^\/+|\/+$/g, '');
    })
    .filter(Boolean)
    .join('/');
}

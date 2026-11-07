import path from 'node:path';

export function staticCacheControl(filename) {
  if (path.basename(path.dirname(filename)) === 'assets' && /-[\w-]{8,}\.(?:js|css|woff2?)$/.test(path.basename(filename))) {
    return 'public, max-age=31536000, immutable';
  }
  if (/\.html$/i.test(filename)) return 'no-cache';
  return 'public, max-age=3600';
}

/**
 * Dev-only: when bridge uses `apps/demo-export` as DIORAMA project root it writes GLBs
 * under `demo-export/public`, while this shell serves `web/public`. Serve `/assets/**`
 * from demo-export/public when missing from web/public so `useGLTF` requests succeed.
 */
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';

function stripSearchHash(url?: string): string | undefined {
  if (!url) return undefined;
  const noHash = url.split('#')[0];
  const noSearch = noHash?.split('?')[0];
  return noSearch;
}

function safeFileUnder(baseDir: string, urlPathSlash: string): string | null {
  const trimmed = decodeURIComponent(urlPathSlash.replace(/^\/+/, '').replace(/\0/g, ''));
  const base = path.resolve(baseDir);
  const candidate = path.resolve(path.join(base, trimmed));
  if (candidate !== base && !candidate.startsWith(base + path.sep)) return null;
  return candidate;
}

function sendFile(res: ServerResponse, absPath: string): void {
  const ext = path.extname(absPath).toLowerCase();
  const type =
    ext === '.glb'
      ? 'model/gltf-binary'
      : ext === '.gltf'
        ? 'model/gltf+json'
        : 'application/octet-stream';
  res.setHeader('Content-Type', type);
  res.statusCode = 200;
  createReadStream(absPath).pipe(res);
}

export function dioramaDemoExportAssetFallback(options: {
  webPublicDir: string;
  demoExportPublicDir: string;
}): Plugin {
  return {
    name: 'diorama-demo-export-asset-fallback',
    enforce: 'pre',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req: IncomingMessage, res: ServerResponse, next: () => void) => {
        if (req.method !== 'GET') return next();
        const pathname = stripSearchHash(req.url);
        if (pathname === undefined || !pathname.startsWith('/assets/')) return next();

        const primary = safeFileUnder(options.webPublicDir, pathname);
        const fallback = safeFileUnder(options.demoExportPublicDir, pathname);
        if (primary === null || fallback === null) return next();

        try {
          if (existsSync(primary) && statSync(primary).isFile()) return next();

          if (existsSync(fallback) && statSync(fallback).isFile()) {
            sendFile(res, fallback);
            return;
          }
        } catch {
          // ignore and defer
        }
        next();
      });
    },
  };
}

// Adapts the pure save API (saveApi.ts) to Vite dev and preview servers
// (intents/45-save-api, spec B1): the API starts and stops with the game, on
// the same host and port. It listens wherever Vite does ("localhost" by
// default). Storage only; no game rule lives here.
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Connect, Plugin } from 'vite';
import { fileSaveFs, savesDir } from './fileSaveFs';
import { MAX_BODY_BYTES, handleSaveApi, type SaveFs } from './saveApi';

function header(request: IncomingMessage, name: string): string | undefined {
  const value = request.headers[name];
  return Array.isArray(value) ? value[0] : value;
}

/** Reads the body up to the cap; past it, stops keeping data and reports "too large". */
function readBody(request: IncomingMessage): Promise<{ body: string; tooLarge: boolean }> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let tooLarge = false;
    request.on('data', (chunk: Buffer) => {
      if (tooLarge) return;
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        tooLarge = true;
        chunks.length = 0;
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => resolve({ body: Buffer.concat(chunks).toString('utf8'), tooLarge }));
    request.on('error', reject);
  });
}

function send(response: ServerResponse, status: number, body?: unknown): void {
  response.statusCode = status;
  response.setHeader('Cache-Control', 'no-store');
  if (body === undefined) {
    response.end();
    return;
  }
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify(body));
}

export function saveApiMiddleware(fs: () => SaveFs): Connect.NextHandleFunction {
  return (request, response, next) => {
    const url = request.url ?? '';
    if (!url.startsWith('/api/')) return next();
    void (async () => {
      try {
        const { body, tooLarge } = await readBody(request);
        const result = await handleSaveApi(
          {
            method: request.method ?? 'GET',
            url,
            origin: header(request, 'origin'),
            host: header(request, 'host'),
            body,
            bodyTooLarge: tooLarge,
          },
          fs(),
        );
        send(response, result.status, result.body);
      } catch {
        send(response, 500, { error: 'Storage error' });
      }
    })();
  };
}

export function saveApiPlugin(): Plugin {
  // The folder depends on the project root, known only once Vite resolved its config.
  let dir = '';
  const handler = saveApiMiddleware(() => fileSaveFs(dir));
  return {
    name: 'heraklios-save-api',
    configResolved(config) {
      dir = savesDir(config.root);
    },
    configureServer(server) {
      server.middlewares.use(handler);
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler);
    },
  };
}

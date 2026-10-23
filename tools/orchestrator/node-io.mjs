// The real seams behind server.mjs (spec §52 B1, B2): a runner that calls
// execFile on an argument array (never a shell), a file system, and the
// node:http adapter. Thin glue with no decisions in it; everything it carries
// is unit-tested through server.mjs with fakes, so this file is not.
import { execFile } from 'node:child_process';
import { access, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';

const MAX_BODY = 64 * 1024;

/** `run(file, args, {cwd})` resolves `{code, stdout, stderr}` and never rejects. No shell, no console window. */
export const realRunner = {
  run(file, args, { cwd }) {
    return new Promise((resolve) => {
      execFile(file, args, { cwd, encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024 }, (error, stdout, stderr) => {
        if (!error) return resolve({ code: 0, stdout, stderr });
        const code = typeof error.code === 'number' ? error.code : 1;
        resolve({ code, stdout: stdout ?? '', stderr: stderr || error.message });
      });
    });
  },
};

export const realFs = {
  async readFile(path) {
    try {
      return await readFile(path, 'utf8');
    } catch {
      return null;
    }
  },
  async writeFile(path, text) {
    await writeFile(path, text, 'utf8');
  },
  async exists(path) {
    try {
      await access(path);
      return true;
    } catch {
      return false;
    }
  },
};

function readBody(req) {
  return new Promise((resolve) => {
    let body = '';
    let tooLarge = false;
    req.on('data', (chunk) => {
      if (tooLarge) return;
      body += chunk;
      if (body.length > MAX_BODY) {
        tooLarge = true;
        body = '';
      }
    });
    req.on('end', () => resolve({ body, tooLarge }));
    req.on('error', () => resolve({ body: '', tooLarge }));
  });
}

async function respond(handler, req, res) {
  const { body, tooLarge } = await readBody(req);
  const result = await handler({
    method: req.method,
    url: req.url ?? '/',
    host: req.headers.host,
    origin: req.headers.origin,
    body,
    bodyTooLarge: tooLarge,
  });
  if (result.sse) {
    res.writeHead(result.status, result.headers);
    const off = result.sse((entry) => res.write(`data: ${JSON.stringify(entry)}\n\n`));
    res.on('close', off);
    return;
  }
  res.writeHead(result.status, result.headers);
  res.end(req.method === 'HEAD' ? undefined : result.body);
}

/** Listens on 127.0.0.1 only (spec B2) and resolves the server once it is up. */
export function serve(handler, port) {
  const server = createServer((req, res) => {
    respond(handler, req, res).catch(() => {
      if (!res.headersSent) res.writeHead(500);
      res.end();
    });
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => resolve(server));
  });
}

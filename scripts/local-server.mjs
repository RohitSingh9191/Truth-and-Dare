// Only for `npm run dev`: runs the review page (/admin) and /api/batch on this computer, so
// suggestions, feedback and ratings can be tried before the site is on Netlify.
// Data is kept in .local-data/store.json (not uploaded to GitHub). The live site uses
// netlify/functions/ with Netlify Blobs instead.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { handleBatch } from '../server/api.js';
import { handleAdmin } from '../server/admin.js';

const FILE = '.local-data/store.json';

/** Works like a Netlify Blobs store, saved in a file. */
function fileStore() {
  let data = {};
  try { data = JSON.parse(readFileSync(FILE, 'utf8')); } catch { /* starts empty */ }
  const persist = () => {
    mkdirSync(dirname(FILE), { recursive: true });
    writeFileSync(FILE, JSON.stringify(data, null, 1));
  };
  return {
    async get(key, opts) {
      const v = data[key];
      if (v === undefined) return null;
      return opts?.type === 'json' ? JSON.parse(v) : v;
    },
    async setJSON(key, value) { data[key] = JSON.stringify(value); persist(); },
    async delete(key) { delete data[key]; persist(); },
    async list({ prefix = '' } = {}) {
      return { blobs: Object.keys(data).filter((k) => k.startsWith(prefix)).sort().map((key) => ({ key })) };
    },
  };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

export function localServer() {
  return {
    name: 'truthspin-local-server',
    apply: 'serve',
    configureServer(server) {
      const store = fileStore();
      const password = process.env.ADMIN_PASSWORD || 'truthspin';
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const api = url.pathname === '/api/batch';
        const admin = url.pathname === '/admin' || url.pathname.startsWith('/admin/');
        if (!api && !admin) return next();
        try {
          const headers = new Headers();
          for (const k of ['authorization', 'content-type', 'content-length', 'origin']) {
            if (req.headers[k]) headers.set(k, req.headers[k]);
          }
          const body = ['GET', 'HEAD'].includes(req.method) ? undefined : await readBody(req);
          const request = new Request(url, { method: req.method, headers, body });
          const response = api
            ? await handleBatch(request, { store })
            : await handleAdmin(request, {
              store,
              env: { ADMIN_PASSWORD: password, ADMIN_USER: process.env.ADMIN_USER },
              loadCards: async (level) => JSON.parse(readFileSync(`public/q/${level}.json`, 'utf8')).cards,
            });
          res.statusCode = response.status;
          response.headers.forEach((v, k) => res.setHeader(k, v));
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch (e) {
          next(e);
        }
      });
      server.httpServer?.once('listening', () => {
        setTimeout(() => server.config.logger.info(`  ➜  Review page: /admin  (local password: ${password})`), 50);
      });
    },
  };
}

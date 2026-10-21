// Netlify Function: the owner's review page at /admin (see server/admin.js).
import { getStore } from '@netlify/blobs';
import { handleAdmin } from '../../server/admin.js';

export default (request) => handleAdmin(request, {
  store: getStore({ name: 'truthspin', consistency: 'strong' }),
  env: { ADMIN_PASSWORD: process.env.ADMIN_PASSWORD, ADMIN_USER: process.env.ADMIN_USER },
  // Card texts come from the game's own question files.
  loadCards: async (level) => (await (await fetch(new URL(`/q/${level}.json`, request.url))).json()).cards,
});

export const config = { path: ['/admin', '/admin/*'] };

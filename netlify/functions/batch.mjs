// Netlify Function: POST /api/batch (see server/api.js).
import { getStore } from '@netlify/blobs';
import { handleBatch } from '../../server/api.js';

export default (request) => handleBatch(request, {
  store: getStore({ name: 'truthspin', consistency: 'strong' }),
  env: { TURNSTILE_SECRET: process.env.TURNSTILE_SECRET },
});

export const config = { path: '/api/batch' };

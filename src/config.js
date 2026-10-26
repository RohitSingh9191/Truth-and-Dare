// Settings the owner fills in before launch (see LAUNCH.md). Empty values switch the
// feature off, so the game still works without them.

export const CONFIG = {
  // GoatCounter site code, e.g. 'truthndare' for https://truthndare.goatcounter.com
  goatcounter: '',
  // Optional Cloudflare Turnstile site key (public). Empty: no spam check, which is fine to start with.
  turnstileSiteKey: '',
  // Where ratings, suggestions and feedback are sent (a Netlify Function, see netlify/functions/).
  api: '/api/batch',
  // Shown on the About page for people who want a reply.
  contactEmail: 'codewithrohitsingh@gmail.com',
  version: __APP_VERSION__,
};

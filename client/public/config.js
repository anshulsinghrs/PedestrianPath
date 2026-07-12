// Runtime configuration for the PathGuard frontend.
//
// This file ships as static content next to index.html. You can edit it
// AFTER deploy to point the frontend at a different backend without
// rebuilding the bundle — useful when:
//
//   - You forked the repo and don't want to manage a GitHub Actions
//     secret just to flip one URL.
//   - You need to swap staging/prod backends without a redeploy.
//
// Resolution order for the API base URL (first non-empty wins):
//
//   1. window.__PATHGUARD_CONFIG__.apiUrl   (this file, runtime override)
//   2. import.meta.env.VITE_API_URL         (baked at build time)
//   3. ''                                   (same-origin; only works
//                                            behind the Vite dev proxy
//                                            on localhost)
//
// If you're hosting on GitHub Pages and seeing 405 Method Not Allowed
// on POSTs, set `apiUrl` below to your Render service URL (no trailing
// slash) and re-deploy or just edit this file in the published site:
//
//   window.__PATHGUARD_CONFIG__ = {
//     apiUrl: 'https://pathguard-api.onrender.com',
//   };
//
// The GitHub Pages workflow will overwrite this file with the value of
// the VITE_API_URL secret if one is set, so editing here is optional
// when you use the standard deploy path.
window.__PATHGUARD_CONFIG__ = {
  apiUrl: "https://pathguard-api-19il.onrender.com",
};

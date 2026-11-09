const STUDIO_URL = 'https://oakedge-a800.tail34c76d.ts.net/studio';
const origin = new URL(STUDIO_URL).origin;
function isStudioURL(value) {
  try { const url = new URL(value); return url.origin === origin && ['/studio', '/studio/'].includes(url.pathname); }
  catch { return false; }
}
function externalURL(value) {
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null; }
  catch { return null; }
}
function allowedPermission(permission) { return ['media', 'notifications', 'clipboard-sanitized-write'].includes(permission); }
module.exports = { STUDIO_URL, isStudioURL, externalURL, allowedPermission };

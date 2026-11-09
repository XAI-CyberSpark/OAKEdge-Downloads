const test = require('node:test');
const assert = require('node:assert/strict');
const {STUDIO_URL, isStudioURL, externalURL, allowedPermission} = require('./policy.cjs');
test('only the OAKEdge studio receives application permissions', () => {
  assert.equal(isStudioURL(STUDIO_URL), true);
  for (const url of ['https://example.com/studio','https://oakedge-a800.tail34c76d.ts.net/download','http://oakedge-a800.tail34c76d.ts.net/studio','file:///etc/passwd','data:text/html,test']) assert.equal(isStudioURL(url), false);
  assert.ok(allowedPermission('media') && allowedPermission('notifications'));
  assert.ok(!allowedPermission('display-capture') && !allowedPermission('clipboard-read'));
});
test('external links never open local files or executable URL schemes', () => {
  assert.ok(externalURL('https://huggingface.co/org/model'));
  for (const url of ['file:///tmp/script','javascript:alert(1)','https://user:password@example.com/','data:text/plain,a']) assert.equal(externalURL(url), null);
});

const test = require('node:test');
const assert = require('node:assert/strict');

const { guildWindowOptions } = require('../src/window-options');

const profile = { name: 'House of Haku', icon: '/tmp/houseofhaku.png' };

test('guild windows auto-hide the application menu without weakening security', () => {
  const options = guildWindowOptions({ profile });
  assert.equal(options.autoHideMenuBar, true);
  assert.equal(options.title, 'House of Haku');
  assert.equal(options.icon, '/tmp/houseofhaku.png');
  assert.deepEqual(options.webPreferences, {
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    webSecurity: true,
    allowRunningInsecureContent: false,
    spellcheck: true,
  });
});

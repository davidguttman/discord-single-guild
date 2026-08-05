const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');

const { createUpdater } = require('../src/updater');

class FakeUpdater extends EventEmitter {
  async checkForUpdates() {}
  quitAndInstall() {
    this.quitCalled = true;
  }
}

test('Later keeps the downloaded update queued for installation on normal quit', async () => {
  const autoUpdater = new FakeUpdater();
  const prompts = [];
  const updater = createUpdater({
    app: { isPackaged: true, getVersion: () => '1.0.0' },
    appImage: '/tmp/app.AppImage',
    autoUpdater,
    dialog: {
      showMessageBox: async (options) => {
        prompts.push(options);
        return { response: 1 };
      },
    },
    platform: 'linux',
  });

  assert.equal(updater.supported, true);
  assert.equal(autoUpdater.autoDownload, true);
  assert.equal(autoUpdater.autoInstallOnAppQuit, true);
  autoUpdater.emit('update-downloaded', { version: '1.1.0' });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(autoUpdater.quitCalled, undefined);
  assert.match(prompts[0].detail, /install automatically when you normally quit/i);
});

test('Restart now invokes quitAndInstall', async () => {
  const autoUpdater = new FakeUpdater();
  createUpdater({
    app: { isPackaged: true, getVersion: () => '1.0.0' },
    appImage: '/tmp/app.AppImage',
    autoUpdater,
    dialog: { showMessageBox: async () => ({ response: 0 }) },
    platform: 'linux',
  });
  autoUpdater.emit('update-downloaded', { version: '1.1.0' });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(autoUpdater.quitCalled, true);
});

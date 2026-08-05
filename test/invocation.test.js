const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const {
  forwardedInvocationContext,
  resolveInvocationPath,
  validateAppImageSource,
} = require('../src/invocation');

test('forwarded invocation keeps the invoking AppImage and Electron-provided working directory', () => {
  const context = forwardedInvocationContext(
    { appImage: '/downloads/new version.AppImage', cwd: '/untrusted' },
    '/home/test/invocation',
  );
  assert.deepEqual(context, {
    appImage: '/downloads/new version.AppImage',
    cwd: '/home/test/invocation',
  });
  assert.equal(resolveInvocationPath('./icon.png', context), '/home/test/invocation/icon.png');
});

test('AppImage source must be an absolute existing regular AppImage file', async (context) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'discord-invocation-'));
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  const appImage = path.join(root, 'download.AppImage');
  await fs.writeFile(appImage, 'new app');
  assert.equal(await validateAppImageSource(appImage), appImage);
  await assert.rejects(validateAppImageSource('relative.AppImage'), /absolute/i);
  await assert.rejects(validateAppImageSource(path.join(root, 'missing.AppImage')), /no longer exists/i);
  await assert.rejects(validateAppImageSource(root), /AppImage file/i);
  const wrongExtension = path.join(root, 'download.bin');
  await fs.writeFile(wrongExtension, 'not named AppImage');
  await assert.rejects(validateAppImageSource(wrongExtension), /AppImage file/i);
});

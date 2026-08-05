const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const {
  MAX_ICON_BYTES,
  fetchHttpsIcon,
  installProfile,
  ProfileStore,
} = require('../src/profiles');

const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);

test('installs one safe profile without deleting unrelated user files', async (context) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'discord-single-guild-test-'));
  context.after(() => fs.rm(root, { recursive: true, force: true }));

  const home = path.join(root, 'home with spaces');
  const assetsDir = path.join(root, 'assets');
  const appImage = path.join(root, 'downloaded.AppImage');
  const unrelated = path.join(home, '.local', 'opt', 'discord-single-guild', 'keep-me.txt');
  await fs.mkdir(assetsDir, { recursive: true });
  await fs.mkdir(path.dirname(unrelated), { recursive: true });
  await fs.writeFile(appImage, 'appimage');
  await fs.writeFile(path.join(assetsDir, 'discord-cyan.png'), 'png');
  await fs.writeFile(unrelated, 'unrelated');

  const store = new ProfileStore(path.join(home, '.config', 'discord-single-guild', 'profiles.json'));
  const result = await installProfile({
    appImage,
    assetsDir,
    color: 'cyan',
    guild: '123456789012345678',
    home,
    name: 'My / Guild',
    store,
  });

  assert.equal(result.profile.id, 'my-guild');
  assert.equal(await fs.readFile(unrelated, 'utf8'), 'unrelated');
  assert.equal(await fs.readFile(result.installedAppImage, 'utf8'), 'appimage');
  const desktop = await fs.readFile(result.desktopFile, 'utf8');
  assert.match(desktop, /"--profile=my-guild"/);
  assert.match(desktop, /Exec=".*home with spaces.*discord-single-guild\.AppImage"/);
  assert.deepEqual(await store.get('my-guild'), result.profile);
});

test('install rejects a non-AppImage environment without touching the home directory', async () => {
  const home = path.join(os.tmpdir(), `discord-single-guild-missing-${process.pid}-${Date.now()}`);
  const store = new ProfileStore(path.join(home, 'profiles.json'));
  await assert.rejects(
    installProfile({ assetsDir: home, guild: '@me', home, name: 'Discord', store }),
    /packaged AppImage/i,
  );
  await assert.rejects(fs.stat(home), { code: 'ENOENT' });
});

test('forwarded install copies the invoking AppImage and resolves its relative icon from invoking cwd', async (context) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'discord-forwarded-install-'));
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  const home = path.join(root, 'home');
  const invokingCwd = path.join(root, 'download folder');
  const invokingAppImage = path.join(invokingCwd, 'discord-new.AppImage');
  await fs.mkdir(invokingCwd, { recursive: true });
  await fs.writeFile(invokingAppImage, 'new downloaded version');
  await fs.writeFile(path.join(invokingCwd, 'relative.png'), PNG_BYTES);

  const store = new ProfileStore(path.join(home, '.config', 'discord-single-guild', 'profiles.json'));
  const result = await installProfile({
    appImage: invokingAppImage,
    assetsDir: path.join(root, 'unused'),
    guild: '@me',
    home,
    icon: './relative.png',
    name: 'Forwarded',
    store,
    workingDirectory: invokingCwd,
  });

  assert.equal(await fs.readFile(result.installedAppImage, 'utf8'), 'new downloaded version');
  assert.deepEqual(await fs.readFile(result.profile.icon), PNG_BYTES);
});

test('concurrent forwarded installs are serialized so profiles are not lost', async (context) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'discord-concurrent-install-'));
  context.after(() => fs.rm(root, { recursive: true, force: true }));
  const home = path.join(root, 'home');
  const assetsDir = path.join(root, 'assets');
  const first = path.join(root, 'first.AppImage');
  const second = path.join(root, 'second.AppImage');
  await fs.mkdir(assetsDir, { recursive: true });
  await fs.writeFile(path.join(assetsDir, 'discord-cyan.png'), PNG_BYTES);
  await fs.writeFile(path.join(assetsDir, 'discord-red.png'), PNG_BYTES);
  await fs.writeFile(first, 'first');
  await fs.writeFile(second, 'second');
  const store = new ProfileStore(path.join(home, '.config', 'discord-single-guild', 'profiles.json'));

  await Promise.all([
    installProfile({ appImage: first, assetsDir, color: 'cyan', guild: '@me', home, name: 'First', store }),
    installProfile({ appImage: second, assetsDir, color: 'red', guild: '@me', home, name: 'Second', store }),
  ]);

  assert.deepEqual((await store.list()).map(({ id }) => id), ['first', 'second']);
  assert.equal(
    await fs.readFile(path.join(home, '.local/opt/discord-single-guild/discord-single-guild.AppImage'), 'utf8'),
    'second',
  );
});

test('remote icon download enforces HTTPS redirects, raster type, signature, timeout, and streaming cap', async () => {
  const good = await fetchHttpsIcon('https://cdn.discordapp.com/icon.png', {
    fetchImpl: async () => new Response(PNG_BYTES, { headers: { 'content-type': 'image/png' } }),
  });
  assert.deepEqual(good.bytes, PNG_BYTES);

  await assert.rejects(
    fetchHttpsIcon('https://cdn.discordapp.com/icon.png', {
      fetchImpl: async () => new Response(null, { status: 302, headers: { location: 'http://evil/icon.png' } }),
    }),
    /HTTPS at every redirect/i,
  );
  await assert.rejects(
    fetchHttpsIcon('https://cdn.discordapp.com/icon.png', {
      fetchImpl: async () => new Response('<svg></svg>', { headers: { 'content-type': 'image/svg+xml' } }),
    }),
    /PNG, JPEG, or WebP/i,
  );
  await assert.rejects(
    fetchHttpsIcon('https://cdn.discordapp.com/icon.png', {
      fetchImpl: async () => new Response('not png', { headers: { 'content-type': 'image/png' } }),
    }),
    /signature/i,
  );
  await assert.rejects(
    fetchHttpsIcon('https://cdn.discordapp.com/icon.png', {
      fetchImpl: async (_url, { signal }) => new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason), { once: true });
      }),
      timeoutMs: 5,
    }),
    /timed out/i,
  );

  const oversizedBody = new ReadableStream({
    start(controller) {
      controller.enqueue(PNG_BYTES);
      controller.enqueue(Buffer.alloc(MAX_ICON_BYTES));
      controller.close();
    },
  });
  await assert.rejects(
    fetchHttpsIcon('https://cdn.discordapp.com/icon.png', {
      fetchImpl: async () => new Response(oversizedBody, { headers: { 'content-type': 'image/png' } }),
    }),
    /larger than 8 MB/i,
  );
});

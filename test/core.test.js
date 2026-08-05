const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
  desktopEntry,
  discordGuildUrl,
  isAllowedDiscordNavigation,
  normalizeGuildId,
  quoteDesktopExecArg,
  sanitizeUserAgent,
  slugifyProfileName,
} = require('../src/core');

test('normalizes valid Discord guild targets', () => {
  assert.equal(normalizeGuildId('@me'), '@me');
  assert.equal(normalizeGuildId(' 123456789012345678 '), '123456789012345678');
});

test('rejects malformed Discord guild targets', () => {
  for (const value of ['', 'me', '123', '1234567890123456x', '123456789012345678901']) {
    assert.throws(() => normalizeGuildId(value), /guild/i);
  }
});

test('builds the dedicated Discord guild URL', () => {
  assert.equal(discordGuildUrl('@me'), 'https://discord.com/channels/@me');
  assert.equal(
    discordGuildUrl('123456789012345678'),
    'https://discord.com/channels/123456789012345678',
  );
});

test('only permits top-level navigation on the canonical Discord origin', () => {
  assert.equal(isAllowedDiscordNavigation('https://discord.com/login'), true);
  assert.equal(isAllowedDiscordNavigation('https://discord.com/channels/@me'), true);
  assert.equal(isAllowedDiscordNavigation('https://support.discord.com/hc/en-us'), false);
  assert.equal(isAllowedDiscordNavigation('https://discord.com.evil.example/'), false);
  assert.equal(isAllowedDiscordNavigation('javascript:alert(1)'), false);
});

test('removes Electron and app tokens without changing bundled Chromium', () => {
  const original =
    'Mozilla/5.0 Chrome/142.0.7444.175 Safari/537.36 Electron/43.3.0 discord-single-guild/1.0.0';
  const result = sanitizeUserAgent(original);
  assert.equal(result, 'Mozilla/5.0 Chrome/142.0.7444.175 Safari/537.36');
  assert.match(result, /Chrome\/142\.0\.7444\.175/);
});

test('creates safe, stable profile slugs', () => {
  assert.equal(slugifyProfileName(' My Team / Guild '), 'my-team-guild');
  assert.equal(slugifyProfileName('../../'), 'discord');
  assert.equal(slugifyProfileName('Café Crew'), 'cafe-crew');
});

test('desktop entry quotes executable arguments and removes control characters', () => {
  const entry = desktopEntry({
    name: 'My\nGuild',
    executable: '/home/test user/.local/opt/discord-single-guild/app.AppImage',
    profileId: 'my-guild',
    icon: '/home/test user/.local/share/icons/my guild.png',
  });

  assert.match(entry, /^Name=My Guild$/m);
  assert.match(
    entry,
    /^Exec="\/home\/test user\/\.local\/opt\/discord-single-guild\/app\.AppImage" "--" "--profile=my-guild"$/m,
  );
  assert.match(entry, /^Icon=\/home\/test user\/\.local\/share\/icons\/my guild\.png$/m);
  assert.doesNotMatch(entry, /\.\.\//);
});

test('desktop entries apply both string and Exec escaping to special path characters', () => {
  const entry = desktopEntry({
    name: 'Guild \\ 100%',
    executable: '/home/space user/100%/Discord "quoted" $cash `tick` \\ App.AppImage',
    profileId: 'guild-100',
    icon: '/home/100%/icon \\ file.png',
  });

  assert.match(entry, /^Name=Guild \\\\ 100%$/m);
  assert.match(entry, /^Comment=Discord focused on Guild \\\\ 100%$/m);
  assert.equal(
    entry.match(/^Exec=.*$/m)[0],
    'Exec="/home/space user/100%%/Discord \\\\"quoted\\\\" \\\\$cash \\\\`tick\\\\` \\\\\\\\ App.AppImage" "--" "--profile=guild-100"',
  );
  assert.match(entry, /^Icon=\/home\/100%\/icon \\\\ file\.png$/m);
  assert.doesNotMatch(entry.match(/^Exec=.*$/m)[0], /(^|[^%])%([^%]|$)/);
});

test('desktop Exec argument escaping handles quotes, shell metacharacters, and backslashes', () => {
  assert.equal(
    quoteDesktopExecArg('space % "quote" $cash `tick` \\slash'),
    '"space %% \\\\"quote\\\\" \\\\$cash \\\\`tick\\\\` \\\\\\\\slash"',
  );
});

test('desktop-file-validate accepts generated entries with escaped Exec arguments', (context) => {
  const probe = spawnSync('desktop-file-validate', ['--version'], { encoding: 'utf8' });
  if (probe.error?.code === 'ENOENT') {
    context.skip('desktop-file-validate is not installed');
    return;
  }

  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'discord-desktop-entry-'));
  context.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const fixture = path.join(directory, 'discord-special.desktop');
  const executable = '/home/space user/100%/Discord "quoted" $cash `tick` \\ App.AppImage';
  const specialArgument = '--fixture=space % "quote" $cash `tick` \\slash';
  const entry = desktopEntry({
    name: 'Guild \\ 100%',
    executable,
    profileId: 'guild-100',
    icon: '/home/space user/100%/icon \\ file.png',
  }).replace(
    /^Exec=.*$/m,
    `Exec=${[executable, specialArgument].map(quoteDesktopExecArg).join(' ')}`,
  );
  fs.writeFileSync(fixture, entry);

  const validation = spawnSync('desktop-file-validate', [fixture], { encoding: 'utf8' });
  assert.equal(validation.status, 0, validation.stderr || validation.stdout);
});

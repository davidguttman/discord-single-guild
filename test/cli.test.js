const test = require('node:test');
const assert = require('node:assert/strict');

const { appArguments, forwardedAppArguments, helpText, parseCli } = require('../src/cli');

test('parses familiar profile and install options', () => {
  assert.deepEqual(
    parseCli([
      '--name',
      'My Guild',
      '--guild=123456789012345678',
      '--color',
      'cyan',
      '--install',
    ]),
    {
      name: 'My Guild',
      guild: '123456789012345678',
      color: 'cyan',
      install: true,
    },
  );
});

test('parses saved profile launchers', () => {
  assert.deepEqual(parseCli(['--profile=my-guild']), { profile: 'my-guild' });
});

test('extracts app options after Chromium switch termination', () => {
  assert.deepEqual(
    appArguments(
      [
        '/opt/discord-single-guild.AppImage',
        '--allow-file-access-from-files',
        '--',
        '--profile=houseofhaku',
      ],
      true,
    ),
    ['--profile=houseofhaku'],
  );
});

test('keeps strict app option validation after the Chromium boundary', () => {
  const argv = appArguments(
    ['/opt/discord-single-guild.AppImage', '--allow-file-access-from-files', '--', '--profiel=x'],
    true,
  );
  assert.throws(() => parseCli(argv), /unknown option/i);
});

test('second-instance parsing uses exact app arguments forwarded through additionalData', () => {
  const chromiumMutatedArgv = [
    '/opt/discord-single-guild.AppImage',
    '--allow-file-access-from-files',
    '--original-process-start-time=12345',
    '--profile=wrong-after-reordering',
  ];
  assert.deepEqual(
    forwardedAppArguments(chromiumMutatedArgv, true, {
      appArguments: ['--profile=houseofhaku'],
    }),
    ['--profile=houseofhaku'],
  );
});

test('supports legacy profile launchers when Chromium switches are mixed into argv', () => {
  assert.deepEqual(
    appArguments(
      [
        '/opt/discord-single-guild.AppImage',
        '--profile=houseofhaku',
        '--allow-file-access-from-files',
      ],
      true,
    ),
    ['--profile=houseofhaku'],
  );
});

test('rejects unknown, missing, and conflicting options', () => {
  assert.throws(() => parseCli(['--wat']), /unknown option/i);
  assert.throws(() => parseCli(['--guild']), /requires a value/i);
  assert.throws(() => parseCli(['--icon', 'a.png', '--color', 'red']), /either --icon or --color/i);
});

test('help documents the migration-friendly interface', () => {
  const help = helpText('discord-single-guild');
  for (const option of ['--name', '--guild', '--icon', '--color', '--install', '--profile']) {
    assert.match(help, new RegExp(option));
  }
  assert.match(help, /@me/);
});

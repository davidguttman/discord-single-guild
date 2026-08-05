const test = require('node:test');
const assert = require('node:assert/strict');

const { helpText, parseCli } = require('../src/cli');

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

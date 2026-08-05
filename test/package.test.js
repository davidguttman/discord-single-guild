const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

test('package manifest contains reproducible runtime, test, and AppImage release configuration', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.equal(packageJson.scripts.start, 'electron .');
  assert.equal(packageJson.scripts.test, 'node --test');
  assert.match(packageJson.scripts.dist, /electron-builder.*AppImage/);
  assert.equal(packageJson.devDependencies.electron, '43.3.0');
  assert.equal(packageJson.devDependencies['electron-builder'], '26.15.7');
  assert.deepEqual(packageJson.build.files, ['src/**/*', 'package.json']);
  assert.deepEqual(
    packageJson.build.extraResources.map(({ from, to }) => [from, to]),
    [
      ['hide-sidebar.css', 'injections/hide-sidebar.css'],
      ['inject.js', 'injections/inject.js'],
      ['icons', 'icons'],
    ],
  );
  assert.deepEqual(packageJson.build.publish, {
    provider: 'github',
    owner: 'davidguttman',
    repo: 'discord-single-guild',
    releaseType: 'release',
  });
});

test('all configured packaged resources exist in the source tree', () => {
  const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  for (const resource of packageJson.build.extraResources) {
    assert.equal(fs.existsSync(path.join(root, resource.from)), true, `${resource.from} is missing`);
  }
  for (const color of ['blurple', 'pink', 'red', 'yellow', 'green', 'cyan']) {
    assert.equal(fs.existsSync(path.join(root, 'icons', `discord-${color}.png`)), true);
  }
});

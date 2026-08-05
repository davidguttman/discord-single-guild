const test = require('node:test');
const assert = require('node:assert/strict');

const { createPermissionPolicy, mediaTypesFromDetails } = require('../src/permissions');

test('only low-risk Discord permissions are automatic', async () => {
  const policy = createPermissionPolicy({ promptMedia: async () => true });
  assert.equal(policy.check('notifications', 'https://discord.com/channels/@me'), true);
  assert.equal(policy.check('media', 'https://discord.com/channels/@me', { mediaTypes: ['audio'] }), false);
  assert.equal(await policy.request('notifications', 'https://evil.example/'), false);
  assert.equal(await policy.request('geolocation', 'https://discord.com/'), false);
});

test('media grants are prompted per type and origin then remembered for the run', async () => {
  const prompts = [];
  const policy = createPermissionPolicy({
    promptMedia: async (request) => {
      prompts.push(request);
      return true;
    },
  });
  const url = 'https://discord.com/channels/@me';
  assert.equal(await policy.request('media', url, { mediaTypes: ['audio'] }), true);
  assert.equal(policy.check('media', url, { mediaTypes: ['audio'] }), true);
  assert.equal(policy.check('media', url, { mediaTypes: ['video'] }), false);
  assert.equal(await policy.request('media', url, { mediaTypes: ['audio', 'video'] }), true);
  assert.deepEqual(prompts, [
    { origin: 'https://discord.com', type: 'microphone' },
    { origin: 'https://discord.com', type: 'camera' },
  ]);
});

test('denying one requested media type does not grant it or later types', async () => {
  const prompts = [];
  const policy = createPermissionPolicy({
    promptMedia: async ({ type }) => {
      prompts.push(type);
      return type !== 'microphone';
    },
  });
  assert.equal(
    await policy.request('media', 'https://discord.com/', { mediaTypes: ['audio', 'video'] }),
    false,
  );
  assert.deepEqual(prompts, ['microphone']);
  assert.deepEqual(mediaTypesFromDetails({}), ['microphone', 'camera']);
});

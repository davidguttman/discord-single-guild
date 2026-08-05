const test = require('node:test');
const assert = require('node:assert/strict');

const {
  isAuthenticationPopupUrl,
  isAuthenticationProviderUrl,
  isDiscordAuthenticationUrl,
  isDiscordUrl,
} = require('../src/navigation');

test('authentication popup allowlist is narrow and permits Discord callbacks', () => {
  assert.equal(isAuthenticationProviderUrl('https://accounts.google.com/o/oauth2/v2/auth'), true);
  assert.equal(isAuthenticationProviderUrl('https://appleid.apple.com/auth/authorize'), true);
  assert.equal(isAuthenticationProviderUrl('https://newassets.hcaptcha.com/captcha/v1/challenge.js'), true);
  assert.equal(isDiscordAuthenticationUrl('https://discord.com/oauth2/authorize?client_id=1'), true);
  assert.equal(isDiscordAuthenticationUrl('https://discord.com/channels/@me'), false);
  assert.equal(isAuthenticationPopupUrl('https://discord.com/login/callback'), true);
  assert.equal(isAuthenticationPopupUrl('https://discord.com/channels/@me'), false);
  assert.equal(isDiscordUrl('https://discord.com/channels/@me'), true);
  for (const url of [
    'https://accounts.google.com.evil.example/',
    'https://discord.com/login-evil',
    'https://support.discord.com/',
    'https://example.com/login',
    'http://accounts.google.com/',
  ]) {
    assert.equal(isAuthenticationPopupUrl(url), false, url);
  }
});

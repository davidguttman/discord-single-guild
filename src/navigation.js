const DISCORD_HOST = 'discord.com';

// Discord's current desktop login flow uses these exact identity/captcha hosts.
// Keep this list explicit rather than accepting arbitrary subdomains.
const AUTH_POPUP_HOSTS = new Set([
  'accounts.google.com',
  'appleid.apple.com',
  'accounts.hcaptcha.com',
  'hcaptcha.com',
  'newassets.hcaptcha.com',
]);

function parseHttpsUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    return url.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

function isDiscordUrl(rawUrl) {
  return parseHttpsUrl(rawUrl)?.hostname === DISCORD_HOST;
}

function isDiscordAuthenticationUrl(rawUrl) {
  const url = parseHttpsUrl(rawUrl);
  if (!url || url.hostname !== DISCORD_HOST) return false;
  if (['/login', '/register'].includes(url.pathname)) return true;
  return [
    '/login/',
    '/register/',
    '/oauth2/',
    '/api/oauth2/',
    '/api/v9/auth/',
    '/api/v10/auth/',
    '/auth/',
  ].some((prefix) => url.pathname.startsWith(prefix));
}

function isAuthenticationProviderUrl(rawUrl) {
  const url = parseHttpsUrl(rawUrl);
  return Boolean(url && AUTH_POPUP_HOSTS.has(url.hostname));
}

function isAuthenticationPopupUrl(rawUrl) {
  return isDiscordAuthenticationUrl(rawUrl) || isAuthenticationProviderUrl(rawUrl);
}

function externalProtocolAllowed(rawUrl) {
  try {
    return ['https:', 'http:', 'mailto:'].includes(new URL(rawUrl).protocol);
  } catch {
    return false;
  }
}

module.exports = {
  AUTH_POPUP_HOSTS,
  externalProtocolAllowed,
  isAuthenticationPopupUrl,
  isAuthenticationProviderUrl,
  isDiscordAuthenticationUrl,
  isDiscordUrl,
};

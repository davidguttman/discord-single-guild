const { isDiscordUrl } = require('./navigation');

const AUTOMATIC_DISCORD_PERMISSIONS = new Set([
  'clipboard-sanitized-write',
  'fullscreen',
  'notifications',
]);

function mediaTypesFromDetails(details = {}) {
  const requested = Array.isArray(details.mediaTypes)
    ? details.mediaTypes
    : details.mediaType
      ? [details.mediaType]
      : [];
  const types = new Set();
  for (const type of requested) {
    if (type === 'audio') types.add('microphone');
    if (type === 'video') types.add('camera');
  }
  // Electron can omit mediaTypes. Treat that as two separate possible grants,
  // never as blanket permission for all future media requests.
  return types.size ? [...types] : ['microphone', 'camera'];
}

function createPermissionPolicy({ promptMedia }) {
  const mediaGrants = new Set();
  const grantKey = (origin, type) => `${origin}\n${type}`;

  function originFor(rawUrl) {
    try {
      return new URL(rawUrl).origin;
    } catch {
      return null;
    }
  }

  function check(permission, requestingUrl, details = {}) {
    if (!isDiscordUrl(requestingUrl)) return false;
    if (AUTOMATIC_DISCORD_PERMISSIONS.has(permission)) return true;
    if (permission !== 'media') return false;
    const origin = originFor(requestingUrl);
    if (!origin) return false;
    return mediaTypesFromDetails(details).every((type) => mediaGrants.has(grantKey(origin, type)));
  }

  async function request(permission, requestingUrl, details = {}) {
    if (!isDiscordUrl(requestingUrl)) return false;
    if (AUTOMATIC_DISCORD_PERMISSIONS.has(permission)) return true;
    if (permission !== 'media') return false;

    const origin = originFor(requestingUrl);
    if (!origin) return false;
    for (const type of mediaTypesFromDetails(details)) {
      const key = grantKey(origin, type);
      if (mediaGrants.has(key)) continue;
      if (!(await promptMedia({ origin, type }))) return false;
      mediaGrants.add(key);
    }
    return true;
  }

  return { check, request };
}

module.exports = { AUTOMATIC_DISCORD_PERMISSIONS, createPermissionPolicy, mediaTypesFromDetails };

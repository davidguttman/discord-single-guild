const path = require('node:path');
const { isDiscordUrl } = require('./navigation');

const GUILD_ID_PATTERN = /^\d{17,20}$/;
const PROFILE_ID_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;
const COLORS = new Set(['blurple', 'pink', 'red', 'yellow', 'green', 'cyan']);

function normalizeGuildId(value = '@me') {
  const guild = String(value).trim();
  if (guild === '@me' || GUILD_ID_PATTERN.test(guild)) return guild;
  throw new Error('Guild must be @me or a 17–20 digit Discord guild ID.');
}

function normalizeProfileName(value = 'Discord') {
  const name = String(value).replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!name) throw new Error('Profile name must not be empty.');
  if (name.length > 80) throw new Error('Profile name must be 80 characters or fewer.');
  return name;
}

function normalizeColor(value = 'blurple') {
  const color = String(value).trim().toLowerCase();
  if (!COLORS.has(color)) {
    throw new Error(`Color must be one of: ${[...COLORS].join(', ')}.`);
  }
  return color;
}

function slugifyProfileName(value) {
  const normalized = String(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
    .replace(/-+$/g, '');
  return normalized || 'discord';
}

function normalizeProfileId(value) {
  const profileId = String(value).trim();
  if (!PROFILE_ID_PATTERN.test(profileId)) throw new Error('Invalid saved profile ID.');
  return profileId;
}

function discordGuildUrl(guild) {
  return `https://discord.com/channels/${normalizeGuildId(guild)}`;
}

function isAllowedDiscordNavigation(rawUrl) {
  return isDiscordUrl(rawUrl);
}

function sanitizeUserAgent(userAgent) {
  return String(userAgent)
    .replace(/\s+(?:Electron|discord-single-guild|DiscordSingleGuild)\/[^\s]+/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function escapeDesktopString(value) {
  return String(value)
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
    .replace(/\u0000/g, '')
    .trim();
}

function quoteDesktopExecArg(value) {
  // Exec arguments have two escape layers. First apply the quoting grammar,
  // then serialize that quoted argument as a desktop-entry string value.
  // This makes a literal backslash four backslashes in the file and the
  // quote/backtick/dollar escapes two backslashes, as required by the spec.
  const quoted = String(value)
    .replace(/%/g, '%%')
    .replace(/([\\"`$])/g, '\\$1');
  return escapeDesktopString(`"${quoted}"`);
}

function desktopEntry({ name, executable, profileId, icon }) {
  const safeName = normalizeProfileName(name);
  const safeProfileId = normalizeProfileId(profileId);
  const safeExecutable = path.resolve(executable);
  const safeIcon = path.resolve(icon);
  const exec = [safeExecutable, `--profile=${safeProfileId}`].map(quoteDesktopExecArg).join(' ');

  return [
    '[Desktop Entry]',
    'Version=1.0',
    'Type=Application',
    `Name=${escapeDesktopString(safeName)}`,
    `Comment=${escapeDesktopString(`Discord focused on ${safeName}`)}`,
    `Exec=${exec}`,
    `Icon=${escapeDesktopString(safeIcon)}`,
    'Terminal=false',
    'Categories=Network;InstantMessaging;',
    'StartupWMClass=discord-single-guild',
    '',
  ].join('\n');
}

module.exports = {
  COLORS,
  desktopEntry,
  discordGuildUrl,
  escapeDesktopString,
  isAllowedDiscordNavigation,
  normalizeColor,
  normalizeGuildId,
  normalizeProfileId,
  normalizeProfileName,
  quoteDesktopExecArg,
  sanitizeUserAgent,
  slugifyProfileName,
};

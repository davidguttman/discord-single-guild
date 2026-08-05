const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');

const {
  desktopEntry,
  normalizeColor,
  normalizeGuildId,
  normalizeProfileId,
  normalizeProfileName,
  slugifyProfileName,
} = require('./core');
const { resolveInvocationPath, validateAppImageSource } = require('./invocation');

const MAX_ICON_BYTES = 8 * 1024 * 1024;
const ICON_DOWNLOAD_TIMEOUT_MS = 15_000;
const MAX_REDIRECTS = 5;
const RASTER_CONTENT_TYPES = new Map([
  ['image/png', '.png'],
  ['image/jpeg', '.jpg'],
  ['image/webp', '.webp'],
]);
let installChain = Promise.resolve();

function uniqueTemporaryPath(file) {
  return `${file}.tmp-${process.pid}-${Date.now()}-${crypto.randomUUID()}`;
}

async function writeAtomic(file, contents, mode = 0o600) {
  await fs.mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  const temporary = uniqueTemporaryPath(file);
  try {
    await fs.writeFile(temporary, contents, { mode });
    await fs.rename(temporary, file);
  } catch (error) {
    await fs.rm(temporary, { force: true }).catch(() => {});
    throw error;
  }
}

class ProfileStore {
  constructor(file) {
    this.file = file;
  }

  async loadData() {
    try {
      const parsed = JSON.parse(await fs.readFile(this.file, 'utf8'));
      if (parsed?.version !== 1 || typeof parsed.profiles !== 'object' || !parsed.profiles) {
        throw new Error('Unsupported profiles file format.');
      }
      return parsed;
    } catch (error) {
      if (error.code === 'ENOENT') return { version: 1, profiles: {} };
      throw new Error(`Could not read saved profiles: ${error.message}`);
    }
  }

  async list() {
    const data = await this.loadData();
    return Object.values(data.profiles).sort((left, right) => left.name.localeCompare(right.name));
  }

  async get(profileId) {
    const data = await this.loadData();
    return data.profiles[normalizeProfileId(profileId)] || null;
  }

  async save(profile) {
    const data = await this.loadData();
    data.profiles[normalizeProfileId(profile.id)] = profile;
    await writeAtomic(this.file, `${JSON.stringify(data, null, 2)}\n`);
    return profile;
  }
}

function rasterTypeFromSignature(bytes) {
  if (
    bytes.length >= 8 &&
    bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) return 'image/png';
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString('ascii') === 'RIFF' &&
    bytes.subarray(8, 12).toString('ascii') === 'WEBP'
  ) return 'image/webp';
  return null;
}

async function copyLocalIcon(source, destinationBase, workingDirectory) {
  const absoluteSource = resolveInvocationPath(source, { cwd: workingDirectory });
  const stat = await fs.stat(absoluteSource);
  if (!stat.isFile()) throw new Error(`Icon is not a file: ${source}`);
  if (stat.size > MAX_ICON_BYTES) throw new Error('Icon is larger than 8 MB.');
  const extension = path.extname(absoluteSource).toLowerCase();
  const normalizedExtension = extension === '.jpeg' ? '.jpg' : extension;
  if (!['.png', '.jpg', '.webp'].includes(normalizedExtension)) {
    throw new Error('Local icons must be PNG, JPEG, or WebP files.');
  }
  const destination = `${destinationBase}${normalizedExtension}`;
  const temporary = uniqueTemporaryPath(destination);
  try {
    await fs.copyFile(absoluteSource, temporary);
    await fs.rename(temporary, destination);
  } catch (error) {
    await fs.rm(temporary, { force: true }).catch(() => {});
    throw error;
  }
  return destination;
}

async function fetchHttpsIcon(source, { fetchImpl = fetch, timeoutMs = ICON_DOWNLOAD_TIMEOUT_MS } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('Icon download timed out.')), timeoutMs);
  timer.unref?.();
  let current = new URL(source);

  try {
    for (let redirects = 0; redirects <= MAX_REDIRECTS; redirects += 1) {
      if (current.protocol !== 'https:') throw new Error('Remote icons must use HTTPS at every redirect.');
      const response = await fetchImpl(current, { redirect: 'manual', signal: controller.signal });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        if (!location) throw new Error('Icon download redirect did not include a location.');
        if (redirects === MAX_REDIRECTS) throw new Error('Icon download exceeded the redirect limit.');
        await response.body?.cancel().catch(() => {});
        current = new URL(location, current);
        continue;
      }
      if (!response.ok) throw new Error(`Icon download failed with HTTP ${response.status}.`);

      const contentType = response.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase() || '';
      if (!RASTER_CONTENT_TYPES.has(contentType)) {
        throw new Error('Remote icons must be PNG, JPEG, or WebP images.');
      }
      const declaredSize = Number(response.headers.get('content-length') || 0);
      if (Number.isFinite(declaredSize) && declaredSize > MAX_ICON_BYTES) {
        throw new Error('Icon is larger than 8 MB.');
      }
      if (!response.body) throw new Error('Icon download returned an empty response body.');

      const chunks = [];
      let total = 0;
      for await (const chunk of response.body) {
        const bytes = Buffer.from(chunk);
        total += bytes.length;
        if (total > MAX_ICON_BYTES) {
          controller.abort();
          throw new Error('Icon is larger than 8 MB.');
        }
        chunks.push(bytes);
      }
      const bytes = Buffer.concat(chunks, total);
      const signatureType = rasterTypeFromSignature(bytes);
      if (!signatureType || signatureType !== contentType) {
        throw new Error('Icon file signature does not match its declared raster image type.');
      }
      return { bytes, contentType, finalUrl: current.toString() };
    }
    throw new Error('Icon download exceeded the redirect limit.');
  } catch (error) {
    if (controller.signal.aborted && error.name === 'AbortError') {
      throw new Error('Icon download timed out.');
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function downloadIcon(source, destinationBase, options = {}) {
  const url = new URL(source);
  if (url.protocol !== 'https:') throw new Error('Remote icons must use HTTPS.');
  const { bytes, contentType } = await fetchHttpsIcon(url, options);
  const destination = `${destinationBase}${RASTER_CONTENT_TYPES.get(contentType)}`;
  const temporary = uniqueTemporaryPath(destination);
  try {
    await fs.writeFile(temporary, bytes, { mode: 0o644 });
    await fs.rename(temporary, destination);
  } catch (error) {
    await fs.rm(temporary, { force: true }).catch(() => {});
    throw error;
  }
  return destination;
}

async function installProfileUnlocked({
  appImage,
  assetsDir,
  color,
  fetchImpl,
  guild,
  home,
  icon,
  name,
  store,
  workingDirectory = process.cwd(),
}) {
  const validatedAppImage = await validateAppImageSource(appImage);
  const safeName = normalizeProfileName(name || 'Discord');
  const safeGuild = normalizeGuildId(guild || '@me');
  const profileId = slugifyProfileName(safeName);
  const existingProfile = await store.get(profileId);
  if (existingProfile && existingProfile.name !== safeName) {
    throw new Error(
      `The profile name "${safeName}" conflicts with the saved profile "${existingProfile.name}". Choose a more distinct name.`,
    );
  }
  const installDir = path.join(home, '.local', 'opt', 'discord-single-guild');
  const installedAppImage = path.join(installDir, 'discord-single-guild.AppImage');
  const iconDir = path.join(home, '.local', 'share', 'icons', 'discord-single-guild');
  const desktopDir = path.join(home, '.local', 'share', 'applications');
  const desktopFile = path.join(desktopDir, `discord-single-guild-${profileId}.desktop`);

  await fs.mkdir(installDir, { recursive: true, mode: 0o700 });
  await fs.mkdir(iconDir, { recursive: true, mode: 0o700 });
  await fs.mkdir(desktopDir, { recursive: true, mode: 0o700 });

  if (path.resolve(validatedAppImage) !== path.resolve(installedAppImage)) {
    const temporaryAppImage = uniqueTemporaryPath(installedAppImage);
    try {
      await fs.copyFile(validatedAppImage, temporaryAppImage);
      await fs.chmod(temporaryAppImage, 0o755);
      await fs.rename(temporaryAppImage, installedAppImage);
    } catch (error) {
      await fs.rm(temporaryAppImage, { force: true }).catch(() => {});
      throw error;
    }
  } else {
    await fs.chmod(installedAppImage, 0o755);
  }

  const destinationBase = path.join(iconDir, profileId);
  let installedIcon;
  if (icon && /^[a-z][a-z0-9+.-]*:/i.test(icon) && !/^https:/i.test(icon)) {
    throw new Error('Remote icons must use HTTPS.');
  }
  if (icon && /^https:/i.test(icon)) {
    installedIcon = await downloadIcon(icon, destinationBase, { fetchImpl });
  } else if (icon) {
    installedIcon = await copyLocalIcon(icon, destinationBase, workingDirectory);
  } else {
    const safeColor = normalizeColor(color || 'blurple');
    installedIcon = await copyLocalIcon(
      path.join(assetsDir, `discord-${safeColor}.png`),
      destinationBase,
      workingDirectory,
    );
  }

  const profile = { id: profileId, name: safeName, guild: safeGuild, icon: installedIcon };
  await store.save(profile);
  await writeAtomic(
    desktopFile,
    desktopEntry({ name: safeName, executable: installedAppImage, profileId, icon: installedIcon }),
    0o644,
  );

  return { desktopFile, installedAppImage, profile };
}

function installProfile(options) {
  const operation = installChain.then(() => installProfileUnlocked(options));
  installChain = operation.catch(() => {});
  return operation;
}

module.exports = {
  MAX_ICON_BYTES,
  ProfileStore,
  downloadIcon,
  fetchHttpsIcon,
  installProfile,
  rasterTypeFromSignature,
  writeAtomic,
};

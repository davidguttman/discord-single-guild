const fs = require('node:fs/promises');
const path = require('node:path');

function invocationContext({ appImage, cwd = process.cwd() } = {}) {
  return {
    appImage: typeof appImage === 'string' ? appImage : null,
    cwd: path.resolve(cwd),
  };
}

function forwardedInvocationContext(additionalData, workingDirectory) {
  return invocationContext({
    appImage: additionalData?.appImage,
    cwd: workingDirectory || process.cwd(),
  });
}

function resolveInvocationPath(value, context) {
  return path.resolve(context?.cwd || process.cwd(), value);
}

async function validateAppImageSource(candidate) {
  if (!candidate) {
    throw new Error('--install is available from a packaged AppImage. Build one with npm run dist first.');
  }
  if (!path.isAbsolute(candidate)) throw new Error('The invoking AppImage path must be absolute.');
  if (!candidate.endsWith('.AppImage')) throw new Error('The install source must be an AppImage file.');

  let stat;
  try {
    stat = await fs.stat(candidate);
  } catch (error) {
    if (error.code === 'ENOENT') throw new Error(`The invoking AppImage no longer exists: ${candidate}`);
    throw error;
  }
  if (!stat.isFile()) throw new Error(`The invoking AppImage is not a regular file: ${candidate}`);
  return candidate;
}

module.exports = {
  forwardedInvocationContext,
  invocationContext,
  resolveInvocationPath,
  validateAppImageSource,
};

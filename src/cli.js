const VALUE_OPTIONS = new Set(['--name', '--guild', '--icon', '--color', '--profile']);
const FLAG_OPTIONS = new Set(['--install', '--help', '-h', '--version', '-v']);

function readValue(argv, index, option) {
  const argument = argv[index];
  const equals = argument.indexOf('=');
  if (equals !== -1) {
    const value = argument.slice(equals + 1);
    if (!value) throw new Error(`${option} requires a value.`);
    return { value, consumed: 0 };
  }
  const value = argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`${option} requires a value.`);
  return { value, consumed: 1 };
}

function parseCli(argv) {
  const result = {};

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument.startsWith('-')) continue;

    if (argument === '--install') {
      result.install = true;
      continue;
    }
    if (argument === '--help' || argument === '-h') {
      result.help = true;
      continue;
    }
    if (argument === '--version' || argument === '-v') {
      result.version = true;
      continue;
    }

    const option = argument.split('=', 1)[0];
    if (!VALUE_OPTIONS.has(option)) {
      throw new Error(`Unknown option: ${argument}`);
    }
    const { value, consumed } = readValue(argv, index, option);
    result[option.slice(2)] = value;
    index += consumed;
  }

  if (result.icon && result.color) throw new Error('Use either --icon or --color, not both.');
  if (result.profile && (result.name || result.guild || result.icon || result.color || result.install)) {
    throw new Error('--profile cannot be combined with profile creation or --install options.');
  }
  return result;
}

function helpText(command = 'discord-single-guild') {
  return `Discord Single Guild

Usage:
  ${command} [options]

Options:
  --name NAME       Profile/window name (default: Discord)
  --guild ID        Guild ID, or @me for direct messages (default: @me)
  --icon PATH|URL   Local icon or HTTPS icon URL (used when installing)
  --color COLOR     Bundled icon: blurple, pink, red, yellow, green, cyan
  --install         Copy this AppImage into ~/.local/opt and save a launcher
  --profile ID      Open an already-saved profile (used by desktop launchers)
  --help, -h        Show this help
  --version, -v     Show the app version

Examples:
  ${command} --name "My Server" --guild 123456789012345678
  ${command} --name "My Server" --guild 123456789012345678 --color cyan --install
`;
}

function legacyProfileLauncherArguments(argv) {
  const profileArguments = argv.filter((argument) => argument.startsWith('--profile='));
  if (profileArguments.length !== 1) return argv;

  const profileArgument = profileArguments[0];
  const hasOtherAppOption = argv.some((argument) => {
    if (argument === profileArgument) return false;
    return FLAG_OPTIONS.has(argument) || VALUE_OPTIONS.has(argument.split('=', 1)[0]);
  });
  return hasOtherAppOption ? argv : [profileArgument];
}

function appArguments(argv, isPackaged) {
  const argumentsAfterExecutable = argv.slice(isPackaged ? 1 : 2);
  const chromiumBoundary = argumentsAfterExecutable.indexOf('--');
  if (chromiumBoundary !== -1) return argumentsAfterExecutable.slice(chromiumBoundary + 1);

  // v1.0.1 launchers had exactly one app-owned --profile= argument and no
  // Chromium boundary. Preserve that shape while new launchers use `--`.
  return legacyProfileLauncherArguments(argumentsAfterExecutable);
}

function forwardedAppArguments(argv, isPackaged, additionalData) {
  if (
    Array.isArray(additionalData?.appArguments) &&
    additionalData.appArguments.every((argument) => typeof argument === 'string')
  ) {
    return [...additionalData.appArguments];
  }
  return appArguments(argv, isPackaged);
}

module.exports = { appArguments, forwardedAppArguments, helpText, parseCli };

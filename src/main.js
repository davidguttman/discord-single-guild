const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { app, BrowserWindow, dialog, Menu, session, shell } = require('electron');

const { appArguments, forwardedAppArguments, helpText, parseCli } = require('./cli');
const {
  discordGuildUrl,
  normalizeColor,
  normalizeGuildId,
  normalizeProfileId,
  normalizeProfileName,
  sanitizeUserAgent,
  slugifyProfileName,
} = require('./core');
const {
  forwardedInvocationContext,
  invocationContext,
  resolveInvocationPath,
} = require('./invocation');
const { InstallQueue } = require('./install-queue');
const {
  externalProtocolAllowed,
  isAuthenticationPopupUrl,
  isAuthenticationProviderUrl,
  isDiscordAuthenticationUrl,
  isDiscordUrl,
} = require('./navigation');
const { createPermissionPolicy } = require('./permissions');
const { installProfile, ProfileStore } = require('./profiles');
const { createUpdater } = require('./updater');
const { guildWindowOptions } = require('./window-options');

app.setName('Discord Single Guild');
if (process.platform === 'linux') app.setDesktopName('discord-single-guild.desktop');
app.setPath('userData', path.join(app.getPath('appData'), 'discord-single-guild'));

const windows = new Map();
const windowsShowingLoadError = new WeakSet();
let profileStore;
let updater;
let bundledCss = '';
let bundledJavaScript = '';
let isQuitting = false;
const installQueue = new InstallQueue({
  onIdle: () => {
    if (!isQuitting && windows.size === 0) app.quit();
  },
});

function assetPath(...parts) {
  const root = app.isPackaged ? process.resourcesPath : path.join(__dirname, '..');
  return path.join(root, ...parts);
}

function injectionPath(file) {
  return app.isPackaged ? assetPath('injections', file) : assetPath(file);
}

function parseProcessArguments(argv = process.argv, additionalData) {
  const argvForApp = additionalData
    ? forwardedAppArguments(argv, app.isPackaged, additionalData)
    : appArguments(argv, app.isPackaged);
  return parseCli(argvForApp);
}

function openExternal(rawUrl) {
  if (externalProtocolAllowed(rawUrl)) {
    void shell.openExternal(rawUrl).catch((error) => console.error('Could not open external URL:', error));
  }
}

async function promptForMediaPermission({ origin, type }) {
  const result = await dialog.showMessageBox({
    type: 'question',
    title: `Allow ${type}?`,
    message: `Discord wants to use your ${type}.`,
    detail: `Requesting origin: ${origin}\n\nThis choice is remembered until the app exits.`,
    buttons: [`Allow ${type}`, 'Deny'],
    defaultId: 1,
    cancelId: 1,
    noLink: true,
  });
  return result.response === 0;
}

function configureSession() {
  const sharedSession = session.defaultSession;
  sharedSession.setUserAgent(sanitizeUserAgent(sharedSession.getUserAgent()));
  const policy = createPermissionPolicy({ promptMedia: promptForMediaPermission });

  sharedSession.setPermissionCheckHandler((_webContents, permission, requestingOrigin, details) =>
    policy.check(permission, requestingOrigin, details),
  );
  sharedSession.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const requestingUrl = details.requestingUrl || webContents.getURL();
    void policy.request(permission, requestingUrl, details).then(callback).catch((error) => {
      console.error('Permission prompt failed:', error);
      callback(false);
    });
  });
}

async function injectBundledAssets(webContents) {
  if (webContents.isDestroyed()) return;
  try {
    if (bundledCss) {
      const cssInjection = `(() => {
        const id = 'discord-single-guild-css';
        let style = document.getElementById(id);
        if (!style) {
          style = document.createElement('style');
          style.id = id;
          (document.head || document.documentElement).appendChild(style);
        }
        style.textContent = ${JSON.stringify(bundledCss)};
      })()`;
      await webContents.executeJavaScript(cssInjection);
    }
    if (bundledJavaScript.trim()) await webContents.executeJavaScript(bundledJavaScript);
  } catch (error) {
    if (!webContents.isDestroyed()) console.error('Bundled injection failed:', error);
  }
}

async function loadUrlCaught(target, url) {
  try {
    await target.loadURL(url);
  } catch (error) {
    // did-fail-load owns user-facing recovery. ERR_ABORTED is normal when a
    // redirect/navigation replaces an in-flight load.
    if (error.code !== 'ERR_ABORTED' && error.errno !== -3) {
      console.error(`Could not load ${url}:`, error);
    }
  }
}

async function handleLoadFailure(window, errorCode, errorDescription, validatedURL) {
  if (window.isDestroyed() || errorCode === -3 || windowsShowingLoadError.has(window)) return;
  windowsShowingLoadError.add(window);
  window.show();
  if (process.env.DISCORD_SINGLE_GUILD_SMOKE_TEST === '1') {
    console.error(`Smoke load failed: ${errorDescription} (${errorCode}) ${validatedURL}`);
    app.exit(1);
    return;
  }
  try {
    const result = await dialog.showMessageBox(window, {
      type: 'error',
      title: 'Discord failed to load',
      message: 'Discord could not be loaded.',
      detail: `${errorDescription} (${errorCode})\n${validatedURL || 'No URL was reported.'}`,
      buttons: ['Retry', 'Close window'],
      defaultId: 0,
      cancelId: 1,
      noLink: true,
    });
    if (window.isDestroyed()) return;
    if (result.response === 0) {
      void loadUrlCaught(window, validatedURL || 'https://discord.com/channels/@me');
    } else {
      window.close();
    }
  } finally {
    windowsShowingLoadError.delete(window);
  }
}

function attachLoadFailureHandling(window) {
  window.webContents.on(
    'did-fail-load',
    (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
      if (!isMainFrame) return;
      void handleLoadFailure(window, errorCode, errorDescription, validatedURL).catch((error) => {
        console.error('Could not show load failure dialog:', error);
        if (!window.isDestroyed()) window.show();
      });
    },
  );
}

function securePopupPreferences(sharedSession) {
  return {
    session: sharedSession,
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
    webSecurity: true,
    allowRunningInsecureContent: false,
    spellcheck: true,
  };
}

function installAuthenticationPopupGuards(popup) {
  const { webContents } = popup;
  const guardNavigation = (event, url) => {
    if (isAuthenticationPopupUrl(url)) return;
    event.preventDefault();
    openExternal(url);
  };
  webContents.on('will-navigate', guardNavigation);
  webContents.on('will-redirect', guardNavigation);
  webContents.setWindowOpenHandler(({ url }) => {
    if (isAuthenticationPopupUrl(url)) {
      setImmediate(() => void loadUrlCaught(webContents, url));
    } else {
      openExternal(url);
    }
    return { action: 'deny' };
  });
  webContents.on('did-create-window', (child) => installAuthenticationPopupGuards(child));
  attachLoadFailureHandling(popup);
}

function installNavigationGuards(window) {
  const { webContents } = window;

  webContents.setWindowOpenHandler(({ url }) => {
    if (isDiscordAuthenticationUrl(url) || isAuthenticationProviderUrl(url)) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          show: true,
          autoHideMenuBar: true,
          webPreferences: securePopupPreferences(webContents.session),
        },
      };
    }
    if (isDiscordUrl(url)) {
      setImmediate(() => void loadUrlCaught(webContents, url));
      return { action: 'deny' };
    }
    openExternal(url);
    return { action: 'deny' };
  });

  webContents.on('did-create-window', (popup) => installAuthenticationPopupGuards(popup));

  const guardNavigation = (event, url) => {
    if (isDiscordUrl(url)) return;
    event.preventDefault();
    openExternal(url);
  };
  webContents.on('will-navigate', guardNavigation);
  webContents.on('will-redirect', guardNavigation);
}

async function runSmokeAssertions(webContents) {
  await injectBundledAssets(webContents);
  const result = await webContents.executeJavaScript(`({
    hasCss: Boolean(document.getElementById('discord-single-guild-css')),
    hasBundledJavaScript: window.__discordSingleGuildInjected === true,
    userAgent: navigator.userAgent,
  })`);
  const passed =
    result.hasCss &&
    result.hasBundledJavaScript &&
    /\bChrome\/\d+/.test(result.userAgent) &&
    !/\b(?:Electron|discord-single-guild)\//i.test(result.userAgent);
  console.log(`SMOKE_RESULT=${JSON.stringify({ ...result, passed })}`);
  app.exit(passed ? 0 : 1);
}

function createGuildWindow(profile) {
  const existing = windows.get(profile.id);
  if (existing && !existing.isDestroyed()) {
    if (existing.isMinimized()) existing.restore();
    existing.show();
    existing.focus();
    const target = discordGuildUrl(profile.guild);
    if (!existing.webContents.getURL().startsWith(target)) void loadUrlCaught(existing, target);
    return existing;
  }

  const window = new BrowserWindow(
    guildWindowOptions({
      profile,
      defaultIcon: assetPath('icons', 'discord-blurple.png'),
    }),
  );

  window.setTitle(profile.name);
  window.setProgressBar(-1);
  window.webContents.on('page-title-updated', (event) => {
    event.preventDefault();
    window.setTitle(profile.name);
  });
  window.webContents.on('dom-ready', () => void injectBundledAssets(window.webContents));
  window.webContents.on('did-navigate-in-page', () => void injectBundledAssets(window.webContents));
  window.webContents.on('did-finish-load', () => {
    if (process.env.DISCORD_SINGLE_GUILD_SMOKE_TEST === '1') {
      void runSmokeAssertions(window.webContents).catch((error) => {
        console.error('Smoke test failed:', error);
        app.exit(1);
      });
    } else if (!window.isDestroyed()) {
      window.show();
    }
  });
  window.webContents.on('render-process-gone', (_event, details) => {
    console.error(`Discord renderer exited: ${details.reason} (${details.exitCode})`);
  });
  window.on('closed', () => windows.delete(profile.id));

  installNavigationGuards(window);
  attachLoadFailureHandling(window);
  windows.set(profile.id, window);
  void loadUrlCaught(window, discordGuildUrl(profile.guild));
  return window;
}

async function profileFromOptions(options, context) {
  if (options.profile) {
    const saved = await profileStore.get(normalizeProfileId(options.profile));
    if (!saved) throw new Error(`No saved profile named "${options.profile}".`);
    return saved;
  }

  const name = normalizeProfileName(options.name || 'Discord');
  const guild = normalizeGuildId(options.guild || '@me');
  const color = normalizeColor(options.color || 'blurple');
  let icon;
  if (options.icon && /^https:/i.test(options.icon)) {
    throw new Error('HTTPS icon URLs are copied with --install; use a local icon for a one-off launch.');
  }
  if (options.icon && /^[a-z][a-z0-9+.-]*:/i.test(options.icon)) {
    throw new Error('Remote icons must use HTTPS.');
  }
  if (options.icon) {
    icon = resolveInvocationPath(options.icon, context);
    if (!fs.statSync(icon).isFile()) throw new Error(`Icon is not a file: ${options.icon}`);
  }
  if (!icon) icon = assetPath('icons', `discord-${color}.png`);
  return { id: slugifyProfileName(name), name, guild, icon };
}

async function handleOptions(options, context) {
  if (options.help) {
    process.stdout.write(helpText(path.basename(process.execPath)));
    return;
  }
  if (options.version) {
    process.stdout.write(`${app.getVersion()}\n`);
    return;
  }

  if (options.install) {
    const hadOpenWindows = windows.size > 0;
    return installQueue.enqueue(async () => {
      const result = await installProfile({
        appImage: context.appImage,
        assetsDir: assetPath('icons'),
        color: options.color,
        guild: options.guild,
        home: os.homedir(),
        icon: options.icon,
        name: options.name,
        store: profileStore,
        workingDirectory: context.cwd,
      });
      buildMenu();
      if (process.env.DISCORD_SINGLE_GUILD_SMOKE_TEST !== '1') {
        await dialog.showMessageBox({
          type: 'info',
          title: 'Profile installed',
          message: `${result.profile.name} is ready in your application launcher.`,
          detail: `AppImage: ${result.installedAppImage}\nLauncher: ${result.desktopFile}`,
        });
      }
      if (hadOpenWindows) createGuildWindow(result.profile);
    });
  }

  if (Object.keys(options).length === 0) {
    const savedProfiles = await profileStore.list();
    if (savedProfiles.length > 0) {
      createGuildWindow(savedProfiles[0]);
      return;
    }
  }
  createGuildWindow(await profileFromOptions(options, context));
}

async function reportArgumentError(error) {
  console.error(error.message);
  await dialog.showMessageBox({
    type: 'error',
    title: 'Discord Single Guild',
    message: error.message,
    detail: 'Run with --help to see supported options.',
  });
}

function buildMenu() {
  void profileStore.list().then((profiles) => {
    const profileItems = profiles.length
      ? profiles.map((profile) => ({ label: profile.name, click: () => createGuildWindow(profile) }))
      : [{ label: 'No saved profiles', enabled: false }];

    const menu = Menu.buildFromTemplate([
      {
        label: 'File',
        submenu: [
          { label: 'Saved Profiles', submenu: profileItems },
          { type: 'separator' },
          { label: 'Check for Updates…', click: () => void updater.check({ manual: true }) },
          { type: 'separator' },
          { role: 'quit' },
        ],
      },
      {
        label: 'View',
        submenu: [
          { role: 'reload' },
          { role: 'forceReload' },
          { type: 'separator' },
          { role: 'resetZoom' },
          { role: 'zoomIn' },
          { role: 'zoomOut' },
          { type: 'separator' },
          { role: 'togglefullscreen' },
        ],
      },
      {
        label: 'Help',
        submenu: [
          {
            label: 'Project on GitHub',
            click: () => void shell.openExternal('https://github.com/davidguttman/discord-single-guild')
              .catch((error) => console.error('Could not open project URL:', error)),
          },
        ],
      },
    ]);
    Menu.setApplicationMenu(menu);
  }).catch((error) => console.error('Could not build menu:', error));
}

const initialAppArguments = appArguments(process.argv, app.isPackaged);
let initialOptions = {};
let fatalCliError = null;
try {
  initialOptions = parseCli(initialAppArguments);
} catch (error) {
  fatalCliError = error;
  console.error(`${error.message}\n\n${helpText(path.basename(process.execPath))}`);
}

const initialContext = invocationContext({ appImage: process.env.APPIMAGE, cwd: process.cwd() });
const wantsImmediateExit = Boolean(fatalCliError || initialOptions.help || initialOptions.version);
const hasSingleInstanceLock =
  wantsImmediateExit ||
  app.requestSingleInstanceLock({ ...initialContext, appArguments: initialAppArguments });
if (!hasSingleInstanceLock) app.quit();

if (!wantsImmediateExit) {
  app.on('second-instance', (_event, argv, workingDirectory, additionalData) => {
    const context = forwardedInvocationContext(additionalData, workingDirectory);
    try {
      const options = parseProcessArguments(argv, additionalData);
      void handleOptions(options, context).catch(reportArgumentError);
    } catch (error) {
      void reportArgumentError(error);
    }
  });
}

app.on('before-quit', () => {
  isQuitting = true;
});
app.on('window-all-closed', () => {
  if (!isQuitting) installQueue.requestIdleCheck();
});
app.on('activate', () => {
  const firstWindow = [...windows.values()].find((window) => !window.isDestroyed());
  if (firstWindow) firstWindow.show();
  else void handleOptions({}, invocationContext()).catch(reportArgumentError);
});

app.whenReady().then(async () => {
  profileStore = new ProfileStore(path.join(app.getPath('userData'), 'profiles.json'));
  updater = createUpdater();
  bundledCss = fs.readFileSync(injectionPath('hide-sidebar.css'), 'utf8');
  const bundledInjectionPath = injectionPath('inject.js');
  bundledJavaScript = fs.existsSync(bundledInjectionPath)
    ? fs.readFileSync(bundledInjectionPath, 'utf8')
    : '';
  configureSession();
  buildMenu();

  if (wantsImmediateExit) {
    if (fatalCliError) app.exit(2);
    else {
      await handleOptions(initialOptions, initialContext);
      app.quit();
    }
    return;
  }

  await handleOptions(initialOptions, initialContext);
  updater.scheduleInitialCheck();
}).catch(async (error) => {
  console.error(error);
  if (app.isReady()) await reportArgumentError(error);
  app.exit(1);
});

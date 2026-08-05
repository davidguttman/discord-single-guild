const electron = require('electron');
const electronUpdater = require('electron-updater');

function createUpdater(dependencies = {}) {
  const app = dependencies.app || electron.app;
  const dialog = dependencies.dialog || electron.dialog;
  const autoUpdater = dependencies.autoUpdater || electronUpdater.autoUpdater;
  const scheduleTimeout = dependencies.setTimeout || setTimeout;
  const platform = dependencies.platform || process.platform;
  const appImage = dependencies.appImage === undefined ? process.env.APPIMAGE : dependencies.appImage;
  const supported = app.isPackaged && platform === 'linux' && Boolean(appImage);
  let manualCheck = false;
  let checking = false;
  let restartPromptShown = false;

  autoUpdater.autoDownload = true;
  // electron-updater installs a downloaded AppImage during a normal application
  // quit. Choosing Later therefore defers installation without discarding it.
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.logger = console;

  autoUpdater.on('checking-for-update', () => {
    checking = true;
  });
  autoUpdater.on('update-available', () => {
    checking = false;
  });
  autoUpdater.on('update-not-available', async () => {
    checking = false;
    if (manualCheck) {
      manualCheck = false;
      await dialog.showMessageBox({
        type: 'info',
        title: 'No updates available',
        message: `Discord Single Guild ${app.getVersion()} is up to date.`,
      });
    }
  });
  autoUpdater.on('error', async (error) => {
    checking = false;
    console.error('Update check failed:', error);
    if (manualCheck) {
      manualCheck = false;
      await dialog.showMessageBox({
        type: 'warning',
        title: 'Update check failed',
        message: 'Could not check GitHub Releases for an update.',
        detail: error.message,
      });
    }
  });
  autoUpdater.on('update-downloaded', async (info) => {
    checking = false;
    manualCheck = false;
    if (restartPromptShown) return;
    restartPromptShown = true;
    const result = await dialog.showMessageBox({
      type: 'info',
      title: 'Update ready',
      message: `Discord Single Guild ${info.version} is ready to install.`,
      detail: 'Restart now, or choose Later to install automatically when you normally quit the app.',
      buttons: ['Restart now', 'Later'],
      defaultId: 0,
      cancelId: 1,
    });
    if (result.response === 0) autoUpdater.quitAndInstall(false, true);
  });

  async function check({ manual = false } = {}) {
    if (!supported) {
      if (manual) {
        await dialog.showMessageBox({
          type: 'info',
          title: 'Updates unavailable here',
          message: 'Automatic updates are available in installed AppImage builds.',
          detail: 'Development runs and unpackaged builds skip update checks.',
        });
      }
      return false;
    }
    if (checking) return true;
    manualCheck = manual;
    try {
      await autoUpdater.checkForUpdates();
      return true;
    } catch (error) {
      console.error('Update check rejected:', error);
      return false;
    }
  }

  function scheduleInitialCheck() {
    if (!supported) return;
    const timer = scheduleTimeout(() => void check(), 10_000);
    timer.unref?.();
  }

  return { check, scheduleInitialCheck, supported };
}

module.exports = { createUpdater };

function guildWindowOptions({ profile, defaultIcon }) {
  return {
    width: 1240,
    height: 850,
    minWidth: 720,
    minHeight: 500,
    title: profile.name,
    icon: profile.icon || defaultIcon,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      spellcheck: true,
    },
  };
}

module.exports = { guildWindowOptions };

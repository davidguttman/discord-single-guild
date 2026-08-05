# Discord Single Guild

A small, maintained Electron app for keeping one Discord guild in its own focused window. It uses the Chromium version bundled with the current Electron release instead of Nativefier's obsolete browser runtime.

## What it does

- Opens directly at `https://discord.com/channels/<guild-id>` (or `@me`).
- Injects the bundled [`hide-sidebar.css`](hide-sidebar.css) after loads and Discord in-app navigations.
- Supports optional, executable **bundled-only** customization in [`inject.js`](inject.js); no JavaScript is fetched remotely.
- Keeps Discord cookies and login state in one persistent Electron session.
- Saves multiple named guild profiles and desktop launchers. Launching a second profile asks the existing Electron process to open or focus that profile's window, so profiles share one login.
- Removes Electron/app product tokens from the user agent while preserving the real bundled Chromium version.
- Checks GitHub Releases for AppImage updates. Downloaded updates can restart immediately or install on the next normal app quit.

## Install a release (recommended)

Download the latest `discord-single-guild-…AppImage` from this repository's GitHub Releases page, then:

```bash
chmod +x discord-single-guild-*.AppImage
./discord-single-guild-*.AppImage \
  --name "My Server" \
  --guild 123456789012345678 \
  --color cyan \
  --install
```

`--install` copies the AppImage to:

```text
~/.local/opt/discord-single-guild/discord-single-guild.AppImage
```

It also saves the profile and creates only that profile's files under:

```text
~/.local/share/applications/discord-single-guild-<profile>.desktop
~/.local/share/icons/discord-single-guild/<profile>.<extension>
```

Log in to Discord once. Every saved profile uses the same persistent session.

### Profile options

```text
--name NAME       Profile/window name (default: Discord)
--guild ID        A 17–20 digit Discord guild ID, or @me (default: @me)
--icon PATH|URL   A local or HTTPS PNG/JPEG/WebP icon, copied during installation
--color COLOR     blurple, pink, red, yellow, green, or cyan
--install         Install/copy this AppImage and create the profile launcher
--profile ID      Open a saved profile (normally used by desktop launchers)
--help, -h        Show complete command help
--version, -v     Show the app version
```

Use either `--icon` or `--color`, not both. Remote icons must remain HTTPS through redirects, pass size/time limits, and contain a valid PNG, JPEG, or WebP signature. Re-running `--install` with the same name updates that profile and its launcher without deleting unrelated files.

Examples:

```bash
# Guild with a bundled icon color
./discord-single-guild-*.AppImage \
  --name "Work Discord" \
  --guild 123456789012345678 \
  --color red \
  --install

# Direct messages with a local icon
./discord-single-guild-*.AppImage \
  --name "Discord DMs" \
  --guild @me \
  --icon ./dm-icon.png \
  --install

# A Discord CDN icon URL also works at install time
./discord-single-guild-*.AppImage \
  --name "Community" \
  --guild 123456789012345678 \
  --icon 'https://cdn.discordapp.com/icons/ID/HASH.webp' \
  --install
```

Find a guild ID by enabling Discord Developer Mode, right-clicking the server, and choosing **Copy Server ID**, or by copying the guild number from a `discord.com/channels/GUILD_ID/...` URL.

## Updates

Installed AppImage builds check GitHub Releases shortly after startup. When an update finishes downloading, the app offers **Restart now** or **Later**. **Later** keeps the update queued and installs it when you normally quit the app; it never interrupts the current session with a silent restart. Use **File → Check for Updates…** to check manually.

Update checks are intentionally skipped in development, unpackaged builds, and Linux runs that are not executing as an AppImage. For updates to work, release assets must include the AppImage (with its embedded block map) and `latest-linux.yml`; the tag workflow publishes them through `electron-builder`.

## Migrating from the Nativefier version

Nativefier is no longer a dependency and old Nativefier-generated app directories are not updated in place.

1. Install this AppImage and recreate each old launcher with the same `--name`, `--guild`, and icon/color options.
2. Log in once in the new app. Nativefier cookies are not copied because importing an old browser profile would be brittle and unsafe.
3. Confirm every new launcher opens the expected guild.
4. Remove old Nativefier application directories and launchers manually. The new installer does not delete them or any other unrelated files.

[`build.sh`](build.sh) now builds this Electron app and passes the familiar options to the resulting AppImage. It prints an explicit Nativefier migration message rather than silently producing an old wrapper.

## Development

Requires Node.js 22.12 or newer.

```bash
npm ci
npm test
npm start -- --name "Development" --guild @me
npm run dist
```

The AppImage is written to `dist/`. To run the old convenience flow:

```bash
./build.sh --name "My Server" --guild 123456789012345678 --install
# or only build and test:
./build.sh --build-only
```

Security-sensitive Electron defaults live in [`src/main.js`](src/main.js): renderer Node integration is disabled, context isolation and sandboxing are enabled, unexpected top-level navigation is denied, and ordinary external links open through the system browser. Low-risk permissions are automatically allowed only for `discord.com`; microphone and camera access are prompted separately and remembered only until exit. Google, Apple, and hCaptcha authentication popups use the same persistent session with secure renderer settings, are restricted to the exact hosts listed in [`src/navigation.js`](src/navigation.js) plus narrow Discord authentication routes and callbacks to `discord.com`, and cannot browse arbitrary popup destinations.

### Bundled injection

- Edit `hide-sidebar.css` for CSS customization.
- Edit `inject.js` only when executable page-world behavior is necessary.
- `inject.js` may run again after Discord's client-side navigation, so keep it idempotent.
- Both files are copied into the release at build time. Do not add remote script loading.

## Maintainer release process

1. Update `version` in `package.json` and `package-lock.json` using SemVer.
2. Run `npm ci`, `npm test`, `npm audit`, and `npm run dist` locally; run the packaged smoke check on a graphical Linux session when available.
3. Commit the version and release changes.
4. Tag the commit with the matching version and push the tag:

   ```bash
   git tag v1.2.3
   git push origin v1.2.3
   ```

5. `.github/workflows/release.yml` first requires the pushed tag to exactly equal `v<package.version>`, then tests and runs `electron-builder --publish always` with the repository `GITHUB_TOKEN`. Verify the GitHub Release contains the AppImage and `latest-linux.yml`; the AppImage block map is embedded in the binary.

The repository configured for publishing and automatic updates is `davidguttman/discord-single-guild`.

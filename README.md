# Discord Single Guild

Standalone Discord web app that shows only one server (no guild sidebar).

## Features

- Hides the guild/server sidebar completely (no gap)
- Hides user status panel at bottom
- Use your server's actual icon (or pick a color variant)
- Accepts guild ID as argument for easy multi-server setup
- Fixes high-DPI scaling issues
- `--install` flag creates .desktop file for app launchers

## Requirements

- Node.js / npm
- nativefier (`npm install -g nativefier`)
- ImageMagick (optional, for converting webp icons)

## Quick Start

```bash
# Using the server's icon (right-click server icon in Discord → Copy Image Link)
./build.sh --name "MyServer" --guild "YOUR_GUILD_ID" --icon "https://cdn.discordapp.com/icons/..." --install

# Or use a color variant
./build.sh --name "MyServer" --guild "YOUR_GUILD_ID" --color cyan --install
```

## Options

| Option | Description |
|--------|-------------|
| `--name NAME` | App name (default: DiscordGuild) |
| `--guild ID` | Default guild ID (default: @me) |
| `--icon PATH` | Custom icon - local file or URL |
| `--color COLOR` | Fallback icon color (see below) |
| `--install` | Install to ~/.local/opt and create .desktop file |

## Getting Your Server Icon

1. Open Discord
2. Right-click the server icon in the sidebar
3. Click "Copy Image Link"
4. Use that URL with `--icon`

## Icon Colors (fallback)

If you don't want to use the server icon:

| Color | Description |
|-------|-------------|
| `blurple` | Original Discord blue-violet |
| `pink` | Magenta/fuchsia |
| `red` | Coral red |
| `yellow` | Gold/yellow |
| `green` | Lime green |
| `cyan` | Turquoise/cyan |

## Examples

```bash
# With server icon URL
./build.sh --name "MyServer" \
  --guild "123456789012345678" \
  --icon "https://cdn.discordapp.com/icons/123/abc.webp" \
  --install

# With local icon file
./build.sh --name "MyServer" --icon ./my-icon.png --install

# With color fallback
./build.sh --name "WorkDiscord" --color red --install
```

## Installation Paths

When using `--install`:
- App: `~/.local/opt/APP_NAME/`
- Desktop file: `~/.local/share/applications/APP_NAME.desktop`
- Icon: `~/.local/share/icons/APP_NAME.png`

## Finding Guild IDs

1. Open Discord in browser
2. Navigate to the server
3. Copy the first number from the URL: `discord.com/channels/GUILD_ID/...`

## How It Works

Uses [nativefier](https://github.com/nativefier/nativefier) to wrap Discord web in Electron, then injects CSS to hide the guild sidebar using stable `aria-label` selectors (not Discord's hashed class names that change with updates).

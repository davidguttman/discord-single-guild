# Discord Single Guild

Standalone Discord web app that shows only one server (no guild sidebar).

## Features

- Hides the guild/server sidebar completely (no gap)
- Hides user status panel at bottom
- Accepts guild ID as argument for easy multi-server setup
- 6 icon color variants to distinguish between apps
- Fixes high-DPI scaling issues
- `--install` flag creates .desktop file for app launchers

## Requirements

- Node.js / npm
- nativefier (`npm install -g nativefier`)

## Quick Start

```bash
./build.sh --name "MyServer" --guild "YOUR_GUILD_ID" --color cyan --install
```

This builds the app, installs it to `~/.local/opt/`, and creates a .desktop file so you can launch it from walker/rofi/etc.

## Options

| Option | Description |
|--------|-------------|
| `--name NAME` | App name (default: DiscordGuild) |
| `--guild ID` | Default guild ID (default: @me) |
| `--color COLOR` | Icon color (see below) |
| `--install` | Install to ~/.local/opt and create .desktop file |

## Icon Colors

| Color | Preview |
|-------|---------|
| `blurple` | Original Discord blue-violet |
| `pink` | Magenta/fuchsia |
| `red` | Coral red |
| `yellow` | Gold/yellow |
| `green` | Lime green |
| `cyan` | Turquoise/cyan |

## Examples

```bash
# Install a server with cyan icon
./build.sh --name "MyServer" --guild "123456789012345678" --color cyan --install

# Install work server with red icon
./build.sh --name "WorkDiscord" --guild "234567890123456789" --color red --install

# Build only (no install)
./build.sh --name "TestApp" --color green
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

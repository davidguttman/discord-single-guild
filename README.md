# Discord Single Guild

Standalone Discord web app that shows only one server (no guild sidebar).

## Features

- Hides the guild/server sidebar completely (no gap)
- Hides user status panel at bottom
- Accepts guild ID as argument for easy multi-server setup
- 6 icon color variants to distinguish between apps
- Fixes high-DPI scaling issues

## Requirements

- Node.js / npm
- nativefier (`npm install -g nativefier`)

## Build

```bash
./build.sh --name "AppName" --guild "GUILD_ID" --color COLOR
```

### Options

| Option | Description |
|--------|-------------|
| `--name NAME` | App name (default: DiscordGuild) |
| `--guild ID` | Default guild ID (default: @me) |
| `--color COLOR` | Icon color (see below) |

### Icon Colors

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
# Single server with cyan icon
./build.sh --name "HouseOfHaku" --guild "1460071718444994726" --color cyan

# Work server with red icon
./build.sh --name "WorkDiscord" --guild "123456789" --color red

# Gaming server with green icon  
./build.sh --name "GamingDiscord" --guild "987654321" --color green
```

## Usage

```bash
# Launch with default guild
./build/HouseOfHaku-linux-x64/launch.sh

# Override guild at runtime
./build/HouseOfHaku-linux-x64/launch.sh 9876543210
```

## Finding Guild IDs

1. Open Discord in browser
2. Navigate to the server
3. Copy the first number from the URL: `discord.com/channels/GUILD_ID/...`

## How It Works

Uses [nativefier](https://github.com/nativefier/nativefier) to wrap Discord web in Electron, then injects CSS to hide the guild sidebar using stable `aria-label` selectors (not Discord's hashed class names that change with updates).

### CSS Selectors Used

```css
nav[aria-label="Servers sidebar"]           /* The guild list */
div[data-collapsed]:has(nav[...])           /* Parent container */
section[aria-label="User status..."]        /* Bottom status bar */
```

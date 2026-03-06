# Discord Single Guild

Standalone Discord web app that shows only one server (no guild sidebar).

## Features

- Hides the guild/server sidebar completely (no gap)
- Hides user status panel at bottom
- Accepts guild ID as argument for easy multi-server setup
- Fixes high-DPI scaling issues

## Requirements

- Node.js / npm
- nativefier (`npm install -g nativefier`)

## Build

```bash
# Basic build
./build.sh

# Custom app name
./build.sh "MyDiscord"

# Custom app name + default guild
./build.sh "HouseOfHaku" "1460071718444994726"
```

## Usage

```bash
# Launch with specific guild
./build/DiscordGuild-linux-x64/launch.sh 1460071718444994726

# Or use the app name you specified
./build/HouseOfHaku-linux-x64/launch.sh
```

## Finding Guild IDs

1. Open Discord in browser
2. Navigate to the server
3. Copy the first number from the URL: `discord.com/channels/GUILD_ID/...`

## Multiple Servers

Build separate apps for each server:

```bash
./build.sh "WorkDiscord" "123456789"
./build.sh "GamingDiscord" "987654321"
```

## How It Works

Uses [nativefier](https://github.com/nativefier/nativefier) to wrap Discord web in Electron, then injects CSS to hide the guild sidebar using stable `aria-label` selectors (not Discord's hashed class names that change with updates).

### CSS Selectors Used

```css
nav[aria-label="Servers sidebar"]           /* The guild list */
div[data-collapsed]:has(nav[...])           /* Parent container */
section[aria-label="User status..."]        /* Bottom status bar */
```

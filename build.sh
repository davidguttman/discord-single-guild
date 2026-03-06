#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Defaults
APP_NAME="DiscordGuild"
DEFAULT_GUILD=""
ICON_COLOR="blurple"

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --name)
      APP_NAME="$2"
      shift 2
      ;;
    --guild)
      DEFAULT_GUILD="$2"
      shift 2
      ;;
    --color)
      ICON_COLOR="$2"
      shift 2
      ;;
    --help|-h)
      echo "Usage: ./build.sh [options]"
      echo ""
      echo "Options:"
      echo "  --name NAME     App name (default: DiscordGuild)"
      echo "  --guild ID      Default guild ID (default: @me)"
      echo "  --color COLOR   Icon color: blurple, pink, red, yellow, green, cyan"
      echo ""
      echo "Example:"
      echo "  ./build.sh --name HouseOfHaku --guild 1460071718444994726 --color cyan"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

ICON_PATH="$SCRIPT_DIR/icons/discord-${ICON_COLOR}.png"
if [ ! -f "$ICON_PATH" ]; then
  echo "Error: Icon not found: $ICON_PATH"
  echo "Available colors: blurple, pink, red, yellow, green, cyan"
  exit 1
fi

echo "Building $APP_NAME with $ICON_COLOR icon..."

# Build with nativefier
npx nativefier \
  --name "$APP_NAME" \
  --icon "$ICON_PATH" \
  --inject "$SCRIPT_DIR/hide-sidebar.css" \
  --single-instance \
  --tray \
  --counter \
  "https://discord.com/channels/@me" \
  "$SCRIPT_DIR/build"

# Find the output directory
OUTPUT_DIR=$(find "$SCRIPT_DIR/build" -maxdepth 1 -type d -name "$APP_NAME-*" | head -1)

if [ -z "$OUTPUT_DIR" ]; then
  echo "Error: Build failed - output directory not found"
  exit 1
fi

# Create launcher script
cat > "$OUTPUT_DIR/launch.sh" << LAUNCHER
#!/bin/bash
DIR="\$(cd "\$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
GUILD="\${1:-DEFAULT_GUILD_PLACEHOLDER}"
exec "\$DIR/$APP_NAME" --force-device-scale-factor=1 "https://discord.com/channels/\$GUILD"
LAUNCHER

# Replace placeholder with actual default guild if provided
if [ -n "$DEFAULT_GUILD" ]; then
  sed -i "s/DEFAULT_GUILD_PLACEHOLDER/$DEFAULT_GUILD/" "$OUTPUT_DIR/launch.sh"
else
  sed -i "s/DEFAULT_GUILD_PLACEHOLDER/@me/" "$OUTPUT_DIR/launch.sh"
fi

chmod +x "$OUTPUT_DIR/launch.sh"

echo ""
echo "✓ Built: $OUTPUT_DIR"
echo ""
echo "Usage:"
echo "  $OUTPUT_DIR/launch.sh [guild_id]"

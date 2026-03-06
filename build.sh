#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_NAME="${1:-DiscordGuild}"
DEFAULT_GUILD="${2:-}"

echo "Building $APP_NAME..."

# Build with nativefier
npx nativefier \
  --name "$APP_NAME" \
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
echo ""
echo "Example:"
echo "  $OUTPUT_DIR/launch.sh 1460071718444994726"

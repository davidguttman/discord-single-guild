#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Defaults
APP_NAME="DiscordGuild"
DEFAULT_GUILD=""
ICON_COLOR=""
ICON_PATH=""
INSTALL=false

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
    --icon)
      ICON_PATH="$2"
      shift 2
      ;;
    --install)
      INSTALL=true
      shift
      ;;
    --help|-h)
      echo "Usage: ./build.sh [options]"
      echo ""
      echo "Options:"
      echo "  --name NAME     App name (default: DiscordGuild)"
      echo "  --guild ID      Default guild ID (default: @me)"
      echo "  --icon PATH     Custom icon (local path or URL)"
      echo "  --color COLOR   Fallback icon color: blurple, pink, red, yellow, green, cyan"
      echo "  --install       Install to ~/.local/opt and create .desktop file"
      echo ""
      echo "Example:"
      echo "  ./build.sh --name MyServer --guild 123456789012345678 --icon ./server-icon.png --install"
      echo "  ./build.sh --name MyServer --icon https://cdn.discordapp.com/icons/ID/HASH.webp --install"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Resolve icon
RESOLVED_ICON=""
if [ -n "$ICON_PATH" ]; then
  if [[ "$ICON_PATH" == http* ]]; then
    # Download URL
    echo "Downloading icon..."
    TEMP_ICON="$SCRIPT_DIR/build/temp-icon.png"
    mkdir -p "$SCRIPT_DIR/build"
    curl -sL "$ICON_PATH" -o "$TEMP_ICON"
    # Convert to PNG if needed (webp, etc)
    if command -v magick &> /dev/null; then
      magick "$TEMP_ICON" -resize 256x256 "$TEMP_ICON.png"
      mv "$TEMP_ICON.png" "$TEMP_ICON"
    fi
    RESOLVED_ICON="$TEMP_ICON"
  elif [ -f "$ICON_PATH" ]; then
    RESOLVED_ICON="$ICON_PATH"
  else
    echo "Error: Icon not found: $ICON_PATH"
    exit 1
  fi
elif [ -n "$ICON_COLOR" ]; then
  RESOLVED_ICON="$SCRIPT_DIR/icons/discord-${ICON_COLOR}.png"
  if [ ! -f "$RESOLVED_ICON" ]; then
    echo "Error: Color icon not found: $RESOLVED_ICON"
    echo "Available colors: blurple, pink, red, yellow, green, cyan"
    exit 1
  fi
else
  # Default to blurple
  RESOLVED_ICON="$SCRIPT_DIR/icons/discord-blurple.png"
fi

echo "Building $APP_NAME..."

# Clean previous build with same name
rm -rf "$SCRIPT_DIR/build/$APP_NAME-"*

# Build with nativefier
npx nativefier \
  --name "$APP_NAME" \
  --icon "$RESOLVED_ICON" \
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
if [ -n "$DEFAULT_GUILD" ]; then
  GUILD_DEFAULT="$DEFAULT_GUILD"
else
  GUILD_DEFAULT="@me"
fi

cat > "$OUTPUT_DIR/launch.sh" << LAUNCHER
#!/bin/bash
DIR="\$(cd "\$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
GUILD="\${1:-$GUILD_DEFAULT}"
exec "\$DIR/$APP_NAME" --force-device-scale-factor=1 "https://discord.com/channels/\$GUILD"
LAUNCHER

chmod +x "$OUTPUT_DIR/launch.sh"

echo ""
echo "✓ Built: $OUTPUT_DIR"

# Install if requested
if [ "$INSTALL" = true ]; then
  INSTALL_DIR="$HOME/.local/opt/$APP_NAME"
  DESKTOP_FILE="$HOME/.local/share/applications/$APP_NAME.desktop"
  ICON_INSTALL="$HOME/.local/share/icons/$APP_NAME.png"
  
  echo ""
  echo "Installing to $INSTALL_DIR..."
  
  # Remove old installation
  rm -rf "$INSTALL_DIR"
  
  # Move to opt
  mv "$OUTPUT_DIR" "$INSTALL_DIR"
  
  # Copy icon
  mkdir -p "$HOME/.local/share/icons"
  cp "$RESOLVED_ICON" "$ICON_INSTALL"
  
  # Create .desktop file
  cat > "$DESKTOP_FILE" << DESKTOP
[Desktop Entry]
Name=$APP_NAME
Comment=Discord Single Guild
Exec=$INSTALL_DIR/launch.sh
Icon=$ICON_INSTALL
Terminal=false
Type=Application
Categories=Network;InstantMessaging;
StartupWMClass=$APP_NAME
DESKTOP

  echo "✓ Installed: $INSTALL_DIR"
  echo "✓ Desktop file: $DESKTOP_FILE"
  echo ""
  echo "You can now launch '$APP_NAME' from your app launcher!"
else
  echo ""
  echo "Usage:"
  echo "  $OUTPUT_DIR/launch.sh [guild_id]"
  echo ""
  echo "To install system-wide, run with --install"
fi

# Cleanup temp icon
rm -f "$SCRIPT_DIR/build/temp-icon.png"

#!/bin/bash
set -e

REPO="Nabwinsaud/terminal-chat"
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)

if [ "$ARCH" = "x86_64" ]; then
  ARCH="x64"
elif [ "$ARCH" = "arm64" ] || [ "$ARCH" = "aarch64" ]; then
  ARCH="arm64"
else
  echo "Unsupported architecture: $ARCH"
  exit 1
fi

BINARY="terminal-chat-$OS-$ARCH"
URL="https://github.com/$REPO/releases/latest/download/$BINARY"

# Install to user directory (no sudo needed)
INSTALL_DIR="$HOME/.local/bin"

echo "Downloading $BINARY..."
curl -L --progress-bar -o terminal-chat "$URL"
chmod +x terminal-chat

# Create install directory
mkdir -p "$INSTALL_DIR"

# Check if already installed (for updates)
if [ -f "$INSTALL_DIR/terminal-chat" ]; then
    echo "Updating existing installation..."
fi

echo "Installing to $INSTALL_DIR..."
mv terminal-chat "$INSTALL_DIR/terminal-chat"

# Add to PATH if not already there
if [[ ":$PATH:" != *":$INSTALL_DIR:"* ]]; then
    echo ""
    echo "⚠️  Add to your shell profile (~/.bashrc, ~/.zshrc, etc.):"
    echo "    export PATH=\"\$HOME/.local/bin:\$PATH\""
    echo ""
fi

echo "✓ Success! Run 'terminal-chat' to start."

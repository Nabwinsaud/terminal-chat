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

echo "Downloading $BINARY..."
curl -fsSL --progress-bar -o terminal-chat "$URL"
chmod +x terminal-chat

INSTALL_DIR="/usr/local/bin"

# Try to create install directory if it doesn't exist
if [ ! -d "$INSTALL_DIR" ]; then
    echo "Creating $INSTALL_DIR..."
    if mkdir -p "$INSTALL_DIR" 2>/dev/null; then
        echo "Created $INSTALL_DIR"
    else
        echo "Creating $INSTALL_DIR requires sudo..."
        sudo mkdir -p "$INSTALL_DIR"
    fi
fi

echo "Installing to $INSTALL_DIR..."
if mv terminal-chat "$INSTALL_DIR/terminal-chat" 2>/dev/null; then
    echo "Installed without sudo"
else
    echo "Installation requires sudo permissions..."
    sudo mv terminal-chat "$INSTALL_DIR/terminal-chat"
fi

echo "✓ Success! Run 'terminal-chat' to start."

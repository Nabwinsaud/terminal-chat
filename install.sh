#!/bin/bash
set -e

REPO="nabwinsaud/terminal-chat"
OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)

if [ "$ARCH" == "x86_64" ]; then
  ARCH="x64"
elif [ "$ARCH" == "arm64" ] || [ "$ARCH" == "aarch64" ]; then
  ARCH="arm64"
else
  echo "Unsupported architecture: $ARCH"
  exit 1
fi

BINARY="terminal-chat-$OS-$ARCH"
URL="https://github.com/$REPO/releases/latest/download/$BINARY"

echo "Downloading $BINARY..."
curl -fsSL -o terminal-chat "$URL"
chmod +x terminal-chat

echo "Installing to /usr/local/bin..."
if [ -w /usr/local/bin ]; then
    mv terminal-chat /usr/local/bin/terminal-chat
else
    sudo mv terminal-chat /usr/local/bin/terminal-chat
fi

echo "Success! Run 'terminal-chat' to start."

# P2P Terminal Chat

A secure, peer-to-peer terminal chat application built with Bun, TypeScript, and raw TCP/UDP sockets.

![Terminal Chat Demo](<img width="1470" height="956" alt="image" src="https://github.com/user-attachments/assets/1081f2e3-bec5-410d-90bf-768b55af64d7" />)

## Features

- 🔒 **End-to-End Encryption**: Uses ECDH (secp256k1) key exchange and AES-256-CBC encryption for all Direct Messages.
- 📡 **Zero-Config Discovery**: Automatically finds peers on your local network using UDP Multicast.
- 💬 **Real-time Messaging**: Instant broadcast messages and private DMs.
- ⌨️ **Rich Terminal UI**: Beautiful interface with typing indicators, user presence, and command autocomplete.
- 🚀 **High Performance**: Built on Bun for lightning-fast startup and execution.

## Installation

### Quick Install (macOS & Linux)
You can install the latest binary release with a single command:

```bash
curl -fsSL https://raw.githubusercontent.com/nabwinsaud/terminal-chat/main/install.sh | sh
```

### Windows (PowerShell)
```powershell
iwr -useb https://raw.githubusercontent.com/Nabwinsaud/terminal-chat/main/install.ps1 | iex
```

### Manual Build
If you prefer to build from source:

1. Install [Bun](https://bun.sh)
2. Clone the repository:
   ```bash
   git clone https://github.com/nabwinsaud/terminal-chat.git
   cd terminal-chat
   ```
3. Install dependencies:
   ```bash
   bun install
   ```
4. Run the chat:
   ```bash
   bun run chat.ts
   ```

## Usage

Start the application:
```bash
terminal-chat
# or if running from source
bun run chat.ts
```

### Commands

- `/help` - Show available commands
- `/users` - List all connected peers
- `/dm <username> <message>` - Send an encrypted private message
  - *Tip: Press Tab to autocomplete usernames!*
- `/quit` - Exit the chat

## How It Works

### Discovery
The application uses UDP Multicast on port `54321` to announce presence and query for other peers. When a peer is found, a direct WebSocket connection is established.

### Encryption
1. **Key Generation**: On startup, each client generates an ephemeral ECDH key pair (secp256k1).
2. **Key Exchange**: Public keys are exchanged during the initial handshake.
3. **Shared Secret**: When sending a DM, a shared secret is derived using ECDH.
4. **Encryption**: Messages are encrypted using AES-256-CBC with a unique IV for each message.

### Architecture
- **Server**: Each client runs a WebSocket server to accept incoming connections.
- **Client**: Connects to other peers' WebSocket servers.
- **UI**: Handles input/output using raw terminal mode for a responsive experience.

## License
MIT

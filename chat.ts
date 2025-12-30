import { intro, outro, text, select, spinner, log, cancel } from '@clack/prompts';
import chalk from 'chalk';
import { Discovery } from './discovery';
import { ChatServer } from './server';
import { ChatClient } from './client';
import { Crypto } from './crypto';
import { TerminalUI } from './ui';

interface Peer {
  id: string;
  username: string;
  ip: string;
  port: number;
  publicKey: string;
  lastSeen: number;
}

interface Message {
  type: 'broadcast' | 'dm' | 'typing' | 'presence';
  from: string;
  to?: string;
  content: string;
  timestamp: number;
  encrypted?: boolean;
  senderPublicKey?: string;
}

class P2PChat {
  private discovery!: Discovery;
  private server: ChatServer;
  private client: ChatClient;
  private crypto: Crypto;
  private ui: TerminalUI;
  private peers: Map<string, Peer> = new Map();
  private username: string;
  private port: number = 9876;

  constructor(username: string) {
    this.username = username;
    this.crypto = new Crypto();
    this.ui = new TerminalUI(username);
    
    // Note: Discovery will be created in startServices() after we know the actual port
    this.server = new ChatServer(this.port);
    this.client = new ChatClient();
  }

  private setupEventHandlers() {
    this.discovery.on('peer-found', (peer: Peer) => {
      this.peers.set(peer.id, peer);
      this.ui.updatePeers(Array.from(this.peers.values()));
      this.ui.showNotification(`Found peer: ${peer.username} (${peer.ip})`);
      this.client.connectToPeer(peer);
    });

    this.discovery.on('peer-lost', (peerId: string) => {
      const peer = this.peers.get(peerId);
      if (peer) {
        this.ui.showNotification(`${peer.username} left`);
        this.peers.delete(peerId);
        this.ui.updatePeers(Array.from(this.peers.values()));
      }
    });

    this.server.on('message', (msg: Message) => {
      this.handleIncomingMessage(msg);
    });

    this.ui.on('input', (input: string) => {
      this.handleUserInput(input);
    });

    this.ui.on('typing', () => {
      this.broadcastTyping();
    });
  }

  private handleIncomingMessage(msg: Message) {
    switch (msg.type) {
      case 'broadcast':
        this.ui.showMessage(msg.from, msg.content);
        break;
      
      case 'dm':
        try {
          if (!msg.senderPublicKey) {
            throw new Error('Missing sender public key');
          }
          const decrypted = this.crypto.decrypt(msg.content, msg.senderPublicKey);
          this.ui.showDirectMessage(msg.from, decrypted);
        } catch (err) {
          this.ui.showDirectMessage(msg.from, '[Decryption Failed]');
        }
        break;
      
      case 'typing':
        this.ui.showTypingIndicator(msg.from);
        break;
      
      case 'presence':
        this.ui.showNotification(`${msg.from} ${msg.content}`);
        break;
    }
  }

  private handleUserInput(input: string) {
    if (input.startsWith('/')) {
      this.handleCommand(input);
    } else {
      this.sendBroadcast(input);
    }
  }

  private handleCommand(cmd: string) {
    const [command, ...args] = cmd.slice(1).split(' ');
    
    switch (command) {
      case 'help':
        this.ui.showHelp();
        break;
      
      case 'users':
        this.ui.showPeerList(Array.from(this.peers.values()));
        break;
      
      case 'dm':
        const [target, ...msgParts] = args;
        if (!target) {
          this.ui.showError('Usage: /dm <user> <message>');
          break;
        }
        const message = msgParts.join(' ');
        if (!message) {
          this.ui.showError('Please provide a message: /dm <user> <message>');
          break;
        }
        this.sendDirectMessage(target, message);
        break;
      
      case 'quit':
        this.shutdown();
        break;
      
      default:
        this.ui.showError(`Unknown command: ${command}`);
    }
  }

  private sendBroadcast(content: string) {
    const msg: Message = {
      type: 'broadcast',
      from: this.username,
      content,
      timestamp: Date.now()
    };
    
    this.client.broadcast(msg, Array.from(this.peers.values()));
    this.ui.showMessage(this.username, content);
  }

  private sendDirectMessage(targetUsername: string, content: string) {
    const peer = Array.from(this.peers.values())
      .find(p => p.username === targetUsername);
    
    if (!peer) {
      this.ui.showError(`User ${targetUsername} not found`);
      return;
    }

    const encrypted = this.crypto.encrypt(content, peer.publicKey);
    const msg: Message = {
      type: 'dm',
      from: this.username,
      to: peer.id,
      content: encrypted,
      timestamp: Date.now(),
      encrypted: true,
      senderPublicKey: this.crypto.publicKey
    };

    this.client.sendTo(peer, msg);
    this.ui.showDirectMessage('you', content, targetUsername);
  }

  private broadcastTyping() {
    const msg: Message = {
      type: 'typing',
      from: this.username,
      content: '',
      timestamp: Date.now()
    };
    
    this.client.broadcast(msg, Array.from(this.peers.values()));
  }

  async startServices() {
    await this.server.start();
    
    // Update port if it changed
    this.port = this.server.getPort();
    
    // Start discovery with the actual port we're using
    this.discovery = new Discovery(this.username, this.port, this.crypto.publicKey);
    
    // Setup event handlers AFTER creating discovery (important!)
    this.setupEventHandlers();
    
    await this.discovery.start();
  }

  async startUI() {
    await this.ui.start();
  }

  private shutdown() {
    this.ui.showNotification('Goodbye!');
    this.discovery.stop();
    this.server.stop();
    this.ui.stop();
    process.exit(0);
  }
}

// Entry point
console.clear();
intro(chalk.bgCyan(chalk.black(' P2P Terminal Chat ')));

const username = await text({
  message: 'Enter your username:',
  placeholder: 'Alice',
  validate: (value) => {
    if (!value) return 'Username is required';
    if (value.length > 20) return 'Username must be 20 characters or less';
  }
}) as string;

if (!username || typeof username === 'symbol') {
  cancel('Setup cancelled');
  process.exit(0);
}

const s = spinner();
s.start('Starting chat...');

const chat = new P2PChat(username);

// Start server and discovery (no stdin needed)
await chat.startServices();

// Stop spinner to release stdin
s.stop('Ready!');

// Small delay to ensure terminal is ready for new input handler
await new Promise(resolve => setTimeout(resolve, 50));

// Now start UI which will take over stdin
await chat.startUI();

// ui.ts - Beautiful Terminal UI with proper Bun compatibility
import chalk from 'chalk';
import { EventEmitter } from 'events';
import * as readline from 'readline';

interface Peer {
  id: string;
  username: string;
  ip: string;
  port: number;
  publicKey: string;
  lastSeen: number;
}

export class TerminalUI extends EventEmitter {
  private username: string;
  private rl: readline.Interface | null = null;
  private typingTimer?: Timer;
  private typingUsers: Set<string> = new Set();
  private messageHistory: Array<{type: string, from: string, content: string, time: Date}> = [];
  private running: boolean = false;

  constructor(username: string) {
    super();
    this.username = username;
  }

  async start() {
    console.log('\n' + chalk.bgBlue(chalk.white(' Chat Started ')) + '\n');
    console.log(chalk.dim('Commands: /help /users /dm <user> <msg> /quit\n'));
    
    this.running = true;
    
    // Ensure stdin is resumed (important after @clack/prompts releases it)
    if (typeof process.stdin.resume === 'function') {
      process.stdin.resume();
    }
    
    // Create readline with proper configuration for Bun
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: process.stdin.isTTY ?? true
    });

    // Set up prompt handling
    this.setupReadline();
    
    // Show initial prompt
    this.showPrompt();
  }

  private setupReadline() {
    if (!this.rl) return;

    this.rl.on('line', (line: string) => {
      const trimmed = line.trim();
      if (trimmed) {
        this.emit('input', trimmed);
      }
      this.showPrompt();
    });

    this.rl.on('close', () => {
      this.running = false;
      this.emit('quit');
    });

    // Handle SIGINT gracefully
    this.rl.on('SIGINT', () => {
      console.log('\n');
      this.running = false;
      this.emit('quit');
      process.exit(0);
    });
  }

  private showPrompt() {
    if (this.running) {
      process.stdout.write(chalk.cyan('> '));
    }
  }

  showMessage(from: string, content: string) {
    this.clearTypingIndicators();
    
    const time = new Date().toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    
    const isOwnMessage = from === this.username;
    const color = isOwnMessage ? chalk.cyan : (this.getUserColor(from) ?? chalk.white);
    
    this.messageHistory.push({ type: 'message', from, content, time: new Date() });
    
    console.log(
      chalk.dim(`[${time}]`) + ' ' +
      color.bold(from) + 
      chalk.dim(':') + ' ' +
      content
    );
    
    this.showPrompt();
  }

  showDirectMessage(from: string, content: string, to?: string) {
    this.clearTypingIndicators();
    
    const time = new Date().toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
    
    const isOutgoing = from === 'you';
    
    if (isOutgoing) {
      console.log(
        chalk.dim(`[${time}]`) + ' ' +
        chalk.magenta.bold('📩 DM to ') + 
        chalk.yellow.bold(to) + 
        chalk.dim(':') + ' ' +
        chalk.italic(content)
      );
    } else {
      const userColor = this.getUserColor(from) ?? chalk.white;
      console.log(
        chalk.dim(`[${time}]`) + ' ' +
        chalk.magenta.bold('📨 DM from ') + 
        userColor.bold(from) + 
        chalk.dim(':') + ' ' +
        chalk.italic(content)
      );
    }
    
    this.showPrompt();
  }

  showNotification(message: string) {
    console.log(chalk.yellow('• ') + chalk.dim(message));
    this.showPrompt();
  }

  showError(message: string) {
    console.log(chalk.red('✗ ') + chalk.red(message));
    this.showPrompt();
  }

  private peers: Peer[] = [];

  updatePeers(peers: Peer[]) {
    this.peers = peers;
  }

  private completer(line: string): [string[], string] {
    const commands = ['/help', '/users', '/dm', '/quit'];
    
    // Autocomplete usernames for /dm
    // Match "/dm" followed by spaces and a partial username (no spaces in username)
    // The $ anchor ensures we stop autocompleting once a space follows the username (message start)
    const dmMatch = line.match(/^\/dm\s+([^\s]*)$/);
    
    if (dmMatch) {
      const partial = dmMatch[1] || '';
      const usernames = this.peers.map(p => p.username);
      const hits = usernames.filter(u => u.startsWith(partial));
      
      if (hits.length > 0) {
        // Normalize to single space: "/dm <user> "
        return [hits.map(h => `/dm ${h} `), line];
      }
      // If no hits, return empty to prevent falling back to command completion
      return [[], line];
    }
    
    // Only autocomplete if line starts with /
    if (!line.startsWith('/')) {
      return [[], line];
    }
    
    const hits = commands.filter((cmd) => cmd.startsWith(line));
    
    // Show all completions if none found
    return [hits.length ? hits : commands, line];
  }  

  showTypingIndicator(username: string) {
    this.typingUsers.add(username);
    
    // Clear existing timer
    if (this.typingTimer) {
      clearTimeout(this.typingTimer);
    }
    
    // Show typing indicator
    this.renderTypingIndicators();
    
    // Auto-clear after 3 seconds
    this.typingTimer = setTimeout(() => {
      this.typingUsers.delete(username);
      this.clearTypingIndicators();
    }, 3000);
  }

  private renderTypingIndicators() {
    if (this.typingUsers.size === 0) return;
    
    const users = Array.from(this.typingUsers);
    const usersText = users.length === 1 
      ? users[0] 
      : users.length === 2 
        ? users.join(' and ')
        : `${users.slice(0, -1).join(', ')} and ${users[users.length - 1]}`;
    
    readline.cursorTo(process.stdout, 0);
    process.stdout.write(
      chalk.dim(`💬 ${usersText} ${users.length === 1 ? 'is' : 'are'} typing...`)
    );
  }

  private clearTypingIndicators() {
    if (this.typingUsers.size > 0) {
      readline.cursorTo(process.stdout, 0);
      readline.clearLine(process.stdout, 0);
      this.typingUsers.clear();
    }
  }

  showPeerList(peers: Peer[]) {
    console.log('\n' + chalk.bgBlue(chalk.white(' Active Users ')) + '\n');
    
    if (peers.length === 0) {
      console.log(chalk.dim('  No other users connected'));
    } else {
      peers.forEach(peer => {
        const timeSince = Date.now() - peer.lastSeen;
        const status = timeSince < 10000 ? chalk.green('●') : chalk.yellow('●');
        const userColor = this.getUserColor(peer.username) ?? chalk.white;
        console.log(
          `  ${status} ${userColor.bold(peer.username)} ` +
          chalk.dim(`(${peer.ip})`)
        );
      });
    }
    
    console.log('');
    this.showPrompt();
  }

  showHelp() {
    const commands = [
      { cmd: '/help', desc: 'Show this help message' },
      { cmd: '/users', desc: 'List all connected users' },
      { cmd: '/dm <user> <message>', desc: 'Send a direct message' },
      { cmd: '/quit', desc: 'Exit the chat' }
    ];

    console.log('\n' + chalk.bgBlue(chalk.white(' Available Commands ')) + '\n');
    
    commands.forEach(({ cmd, desc }) => {
      console.log(
        '  ' + chalk.cyan.bold(cmd.padEnd(25)) + 
        chalk.dim(desc)
      );
    });
    
    console.log('');
    this.showPrompt();
  }

  private getUserColor(username: string) {
    // Generate consistent color for each user based on username hash
    const colors = [
      chalk.blue,
      chalk.green,
      chalk.yellow,
      chalk.magenta,
      chalk.red,
      chalk.cyan,
      chalk.white
    ];
    
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
      hash = username.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    return colors[Math.abs(hash) % colors.length] ?? chalk.white;
  }

  stop() {
    this.running = false;
    if (this.rl) {
      this.rl.close();
    }
  }
}

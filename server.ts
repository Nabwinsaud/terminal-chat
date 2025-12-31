import { EventEmitter } from 'events';
import { type ServerWebSocket } from 'bun';

interface Message {
  type: 'broadcast' | 'dm' | 'typing' | 'presence';
  from: string;
  to?: string;
  content: string;
  timestamp: number;
  encrypted?: boolean;
  senderPublicKey?: string;
}

interface WebSocketData {
  peerId: string;
  username: string;
}

export class ChatServer extends EventEmitter {
  private port: number;
  private server?: ReturnType<typeof Bun.serve>;
  private connections: Map<string, ServerWebSocket<WebSocketData>> = new Map();

  constructor(port: number) {
    super();
    this.port = port;
  }

  async start() {
    let attempts = 0;
    const maxAttempts = 10;
    
    while (attempts < maxAttempts) {
      try {
        this.server = Bun.serve({
          port: this.port,
          fetch: this.handleRequest.bind(this),
          websocket: {
            maxPayloadLength: 16 * 1024 * 1024, // 16MB
            idleTimeout: 120,
            backpressureLimit: 1024 * 1024, // 1MB
            closeOnBackpressureLimit: false,
            open: this.handleOpen.bind(this),
            message: this.handleMessage.bind(this),
            close: this.handleClose.bind(this),
            drain: (ws) => {
              console.log('WebSocket backpressure relieved');
            }
          }
        });

        console.log(`Chat server listening on ws://0.0.0.0:${this.port}`);
        return;
      } catch (err: any) {
        if (err.code === 'EADDRINUSE') {
          console.log(`Port ${this.port} is in use, trying ${this.port + 1}...`);
          this.port++;
          attempts++;
        } else {
          throw err;
        }
      } 
    }

  }

  private handleRequest(req: Request) {
    const url = new URL(req.url);
    
    // Upgrade to WebSocket
    if (url.pathname === '/chat') {
      const upgraded = this.server?.upgrade(req, {
        data: {
          peerId: url.searchParams.get('id') || 'unknown',
          username: url.searchParams.get('username') || 'Anonymous'
        }
      });

      if (upgraded) {
        return undefined; // Connection upgraded
      }
      
      return new Response('WebSocket upgrade failed', { status: 500 });
    }

    // Health check endpoint
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({
        status: 'ok',
        connections: this.connections.size,
        uptime: process.uptime()
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response('Not found', { status: 404 });
  }

  private handleOpen(ws: ServerWebSocket<WebSocketData>) {
    const { peerId, username } = ws.data;
    console.log(`Connection opened: ${username} (${peerId})`);
    
    this.connections.set(peerId, ws);

    // Send welcome message
    ws.send(JSON.stringify({
      type: 'system',
      content: 'Connected to chat server',
      timestamp: Date.now()
    }));

    // Notify about new connection
    this.emit('peer-connected', { peerId, username });
  }

  private handleMessage(ws: ServerWebSocket<WebSocketData>, message: string | Buffer) {
    try {
      const msg: Message = JSON.parse(message.toString());
      
      // Validate message
      if (!msg.type || !msg.from) {
        console.error('Invalid message format');
        return;
      }

      // Emit message event for processing
      this.emit('message', msg);

      // For DMs, forward only to recipient
      if (msg.type === 'dm' && msg.to) {
        const recipient = this.connections.get(msg.to);
        if (recipient && recipient.readyState === 1) {
          recipient.send(JSON.stringify(msg));
        }
      }
    } catch (err) {
      console.error('Failed to handle message:', err);
    }
  }

  getPort():number{
    return this.port
  }

  private handleClose(ws: ServerWebSocket<WebSocketData>, code: number, reason: string) {
    const { peerId, username } = ws.data;
    console.log(`Connection closed: ${username} (${peerId})`);
    
    this.connections.delete(peerId);
    
    this.emit('peer-disconnected', { peerId, username });
  }

  broadcast(message: Message, excludePeerId?: string) {
    const payload = JSON.stringify(message);
    
    for (const [peerId, ws] of this.connections.entries()) {
      if (peerId !== excludePeerId && ws.readyState === 1) {
        ws.send(payload);
      }
    }
  }

  sendTo(peerId: string, message: Message) {
    const ws = this.connections.get(peerId);
    if (ws && ws.readyState === 1) {
      ws.send(JSON.stringify(message));
    }
  }

  stop() {
    // Close all connections
    for (const ws of this.connections.values()) {
      ws.close(1000, 'Server shutting down');
    }
    
    this.connections.clear();

    // Stop server
    if (this.server) {
      this.server.stop();
    }
  }

  getConnectionCount(): number {
    return this.connections.size;
  }

  isConnected(peerId: string): boolean {
    const ws = this.connections.get(peerId);
    return ws !== undefined && ws.readyState === 1;
  }
}

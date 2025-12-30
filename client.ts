import { EventEmitter } from 'events';

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

export class ChatClient extends EventEmitter {
  private connections: Map<string, WebSocket> = new Map();
  private reconnectTimers: Map<string, Timer> = new Map();
  private maxReconnectAttempts = 5;
  private reconnectDelay = 2000;

  async connectToPeer(peer: Peer): Promise<void> {
    if (this.connections.has(peer.id)) {
      return;
    }

    const url = `ws://${peer.ip}:${peer.port}/chat?id=${peer.id}&username=${peer.username}`;

    try {
      const ws = new WebSocket(url);

      ws.onopen = () => {
        console.log(`Connected to peer: ${peer.username}`);
        this.connections.set(peer.id, ws);
        
        // Clear reconnect timer if exists
        const timer = this.reconnectTimers.get(peer.id);
        if (timer) {
          clearTimeout(timer);
          this.reconnectTimers.delete(peer.id);
        }

        this.emit('peer-connected', peer);
      };

      ws.onmessage = (event) => {
        try {
          const message: Message = JSON.parse(event.data);
          this.emit('message', message);
        } catch (err) {
          console.error('Failed to parse message:', err);
        }
      };

      ws.onerror = (error) => {
        console.error(`Connection error with ${peer.username}:`, error);
      };

      ws.onclose = () => {
        console.log(`Disconnected from peer: ${peer.username}`);
        this.connections.delete(peer.id);
        this.emit('peer-disconnected', peer);
        
        // Attempt to reconnect
        this.scheduleReconnect(peer);
      };
    } catch (err) {
      console.error(`Failed to connect to ${peer.username}:`, err);
      this.scheduleReconnect(peer);
    }
  }

  private scheduleReconnect(peer: Peer, attempt: number = 0) {
    if (attempt >= this.maxReconnectAttempts) {
      console.log(`Max reconnect attempts reached for ${peer.username}`);
      return;
    }

    const delay = this.reconnectDelay * Math.pow(2, attempt); // Exponential backoff
    
    const timer = setTimeout(() => {
      console.log(`Reconnecting to ${peer.username} (attempt ${attempt + 1}/${this.maxReconnectAttempts})`);
      this.connectToPeer(peer).catch(() => {
        this.scheduleReconnect(peer, attempt + 1);
      });
    }, delay);

    this.reconnectTimers.set(peer.id, timer);
  }

  sendTo(peer: Peer, message: Message) {
    const ws = this.connections.get(peer.id);
    
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.error(`Cannot send message: not connected to ${peer.username}`);
      return;
    }

    try {
      ws.send(JSON.stringify(message));
    } catch (err) {
      console.error(`Failed to send message to ${peer.username}:`, err);
    }
  }

  broadcast(message: Message, peers: Peer[]) {
    let sentCount = 0;
    
    for (const peer of peers) {
      const ws = this.connections.get(peer.id);
      
      if (ws && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify(message));
          sentCount++;
        } catch (err) {
          console.error(`Failed to send message to ${peer.username}:`, err);
        }
      }
    }

    if (sentCount === 0 && peers.length > 0) {
      console.warn('Message not delivered: no active connections');
    }
  }

  disconnect(peerId: string) {
    const ws = this.connections.get(peerId);
    if (ws) {
      ws.close();
      this.connections.delete(peerId);
    }

    const timer = this.reconnectTimers.get(peerId);
    if (timer) {
      clearTimeout(timer);
      this.reconnectTimers.delete(peerId);
    }
  }

  disconnectAll() {
    for (const ws of this.connections.values()) {
      ws.close();
    }
    this.connections.clear();

    for (const timer of this.reconnectTimers.values()) {
      clearTimeout(timer);
    }
    this.reconnectTimers.clear();
  }

  isConnected(peerId: string): boolean {
    const ws = this.connections.get(peerId);
    return ws !== undefined && ws.readyState === WebSocket.OPEN;
  }

  getConnectionCount(): number {
    let count = 0;
    for (const ws of this.connections.values()) {
      if (ws.readyState === WebSocket.OPEN) {
        count++;
      }
    }
    return count;
  }
}

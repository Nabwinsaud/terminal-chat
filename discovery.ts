// discovery.ts - UDP Multicast for LAN peer discovery
import { EventEmitter } from 'events';
import dgram from 'dgram';
import os from 'os';

interface Peer {
  id: string;
  username: string;
  ip: string;
  port: number;
  publicKey: string;
  lastSeen: number;
}

interface DiscoveryMessage {
  type: 'announce' | 'query';
  id: string;
  username: string;
  ip: string;
  port: number;
  publicKey: string;
  timestamp: number;
}

export class Discovery extends EventEmitter {
  private socket: dgram.Socket;
  private multicastAddress = '239.255.255.250'; // Local network multicast
  private multicastPort = 54321;
  private username: string;
  private port: number;
  private publicKey: string;
  private myId: string;
  private myIp: string;
  private peers: Map<string, Peer> = new Map();
  private announceInterval?: Timer;
  private cleanupInterval?: Timer;

  constructor(username: string, port: number, publicKey: string) {
    super();
    this.username = username;
    this.port = port;
    this.publicKey = publicKey;
    this.myId = this.generateId();
    this.myIp = this.getLocalIp();
    this.socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private getLocalIp(): string {
    const interfaces = os.networkInterfaces();
    
    // Prefer non-internal IPv4 addresses
    for (const name of Object.keys(interfaces)) {
      const iface = interfaces[name];
      if (!iface) continue;
      
      for (const addr of iface) {
        if (addr.family === 'IPv4' && !addr.internal) {
          return addr.address;
        }
      }
    }
    
    return '127.0.0.1';
  }

  async start() {
    return new Promise<void>((resolve, reject) => {
      this.socket.on('error', (err) => {
        console.error('Discovery socket error:', err);
        reject(err);
      });

      this.socket.on('message', (msg, rinfo) => {
        this.handleMessage(msg, rinfo);
      });

      this.socket.on('listening', () => {
        const address = this.socket.address();
        console.log(`Discovery listening on ${address.address}:${address.port}`);
        
        // Join multicast group
        try {
          this.socket.addMembership(this.multicastAddress);
          this.socket.setMulticastTTL(128);
          this.socket.setMulticastLoopback(true);
        } catch (err) {
          console.error('Failed to join multicast group:', err);
        }
        
        // Start announcing presence
        this.startAnnouncing();
        
        // Send initial query
        this.sendQuery();
        
        // Cleanup old peers periodically
        this.startCleanup();
        
        resolve();
      });

      this.socket.bind(this.multicastPort);
    });
  }

  private handleMessage(msg: Buffer, rinfo: dgram.RemoteInfo) {
    try {
      const data: DiscoveryMessage = JSON.parse(msg.toString());
      
      // Ignore own messages
      if (data.id === this.myId) return;
      
      // Update or add peer
      const peer: Peer = {
        id: data.id,
        username: data.username,
        ip: data.ip,
        port: data.port,
        publicKey: data.publicKey,
        lastSeen: Date.now()
      };

      const isNewPeer = !this.peers.has(data.id);
      this.peers.set(data.id, peer);

      if (isNewPeer) {
        this.emit('peer-found', peer);
        
        // If this was a query, respond with our announcement
        if (data.type === 'query') {
          setTimeout(() => this.announce(), Math.random() * 1000);
        }
      }
    } catch (err) {
      console.error('Failed to parse discovery message:', err);
    }
  }

  private announce() {
    const message: DiscoveryMessage = {
      type: 'announce',
      id: this.myId,
      username: this.username,
      ip: this.myIp,
      port: this.port,
      publicKey: this.publicKey,
      timestamp: Date.now()
    };

    const buffer = Buffer.from(JSON.stringify(message));
    this.socket.send(buffer, 0, buffer.length, this.multicastPort, this.multicastAddress);
  }

  private sendQuery() {
    const message: DiscoveryMessage = {
      type: 'query',
      id: this.myId,
      username: this.username,
      ip: this.myIp,
      port: this.port,
      publicKey: this.publicKey,
      timestamp: Date.now()
    };

    const buffer = Buffer.from(JSON.stringify(message));
    this.socket.send(buffer, 0, buffer.length, this.multicastPort, this.multicastAddress);
  }

  private startAnnouncing() {
    // Announce every 5 seconds
    this.announceInterval = setInterval(() => {
      this.announce();
    }, 5000);

    // Announce immediately
    this.announce();
  }

  private startCleanup() {
    // Check for stale peers every 10 seconds
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      const timeout = 15000; // 15 seconds

      for (const [id, peer] of this.peers.entries()) {
        if (now - peer.lastSeen > timeout) {
          this.peers.delete(id);
          this.emit('peer-lost', id);
        }
      }
    }, 10000);
  }

  stop() {
    if (this.announceInterval) {
      clearInterval(this.announceInterval);
    }
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    try {
      this.socket.dropMembership(this.multicastAddress);
    } catch (err) {
      // Ignore errors
    }

    this.socket.close();
  }

  getPeers(): Peer[] {
    return Array.from(this.peers.values());
  }
}

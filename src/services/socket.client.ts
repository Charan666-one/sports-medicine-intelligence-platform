import { io, Socket } from 'socket.io-client';

class SocketClient {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();

  connect() {
    if (this.socket?.connected) return;

    // In AI Studio, the socket connects back to the same host
    this.socket = io({
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      console.log('🔌 Connected to Intelligence Gateway');
    });

    this.socket.on('disconnect', () => {
      console.log('🔌 Disconnected from Intelligence Gateway');
    });

    this.socket.onAny((event, ...args) => {
      console.log(`🔌 Event received: ${event}`, args[0]);
      const eventListeners = this.listeners.get(event);
      if (eventListeners) {
        eventListeners.forEach(cb => cb(args[0]));
      }
    });

    return this.socket;
  }

  subscribe(event: string, callback: (data: any) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)?.add(callback);
    
    return () => {
      this.listeners.get(event)?.delete(callback);
    };
  }

  joinAthlete(athleteId: string) {
    if (this.socket) {
      this.socket.emit('join:athlete', athleteId);
    }
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

export const socketClient = new SocketClient();

import { Server as SocketServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import { logger } from '../utils/logger.js';

export class SocketService {
  private static io: SocketServer | null = null;
  private static userCount = 0;

  static init(server: HttpServer) {
    this.io = new SocketServer(server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      },
      // Ensure it works in the AI Studio iframe environment
      transports: ['websocket', 'polling']
    });

    this.io.on('connection', (socket) => {
      this.userCount++;
      this.emit('system:users', { count: this.userCount });
      logger.info(`🔌 Client connected: ${socket.id} (Total: ${this.userCount})`);

      socket.on('disconnect', () => {
        this.userCount = Math.max(0, this.userCount - 1);
        this.emit('system:users', { count: this.userCount });
        logger.info(`🔌 Client disconnected: ${socket.id} (Total: ${this.userCount})`);
      });

      // Join specific athlete rooms if needed for targeted updates
      socket.on('join:athlete', (athleteId: string) => {
        socket.join(`athlete:${athleteId}`);
        logger.info(`🔌 Client ${socket.id} joined athlete:${athleteId}`);
      });
    });

    return this.io;
  }

  static emit(event: string, data: any) {
    if (!this.io) {
      logger.warn('Socket.io not initialized. Event not sent:', event);
      return;
    }
    this.io.emit(event, data);
  }

  static emitToAthlete(athleteId: string, event: string, data: any) {
    if (!this.io) return;
    this.io.to(`athlete:${athleteId}`).emit(event, data);
  }

  /**
   * High-level events
   */
  static emitAnomaly(data: any) {
    this.emit('anomaly:detected', data);
    this.emitActivity({
      type: 'ANOMALY',
      message: `Critical anomaly detected for athlete: ${data.athleteName || 'Unknown'}`,
      severity: 'CRITICAL',
      data
    });
  }

  static emitAlert(data: any) {
    this.emit('alert:created', data);
  }

  static emitActivity(data: any) {
    this.emit('activity:stream', {
      ...data,
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toISOString()
    });
  }

  static emitPipeline(athleteId: string, stage: string, status: string, data: any = {}) {
    this.emit('pipeline:update', {
      athleteId,
      stage,
      status,
      timestamp: new Date().toISOString(),
      ...data
    });
  }

  static emitAIScan(data: any) {
    this.emit('ai:scan_completed', data);
    this.emitActivity({
      type: 'AI_SCAN',
      message: `AI Intelligence scan completed for ${data.athleteName}`,
      severity: 'INFO',
      data
    });
  }
}

import { Server as SocketServer } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { Redis } from 'ioredis';
import { logger } from '../utils/logger.js';
import { config, corsOrigins } from '../config/index.js';
import { createRedisConnection } from '../queues/connection.js';

const REALTIME_CHANNEL = 'nexus:realtime';

/**
 * Realtime event gateway.
 *
 * Runs in two roles depending on the process:
 *   - API process: `init(server)` attaches a Socket.IO server; `emit()` pushes
 *     directly to connected clients.
 *   - Worker process (Phase 3 async ingestion): has no HTTP server or connected
 *     clients of its own. `initPublisher()` instead opens a Redis publisher so
 *     `emit()` transparently forwards events over Redis pub/sub to the API
 *     process, which relays them to clients. Every existing `emit*` call site
 *     (AIEngineService, controllers, the ingestion pipeline) works unmodified
 *     in both processes because they all funnel through `emit()`.
 */
export class SocketService {
  private static io: SocketServer | null = null;
  private static redisPub: Redis | null = null;
  private static userCount = 0;

  static init(server: HttpServer) {
    this.io = new SocketServer(server, {
      cors: {
        origin: corsOrigins,
        methods: ["GET", "POST"],
        credentials: true,
      },
      transports: ['websocket', 'polling']
    });

    // Authenticate every socket connection with the same JWT as the REST API.
    this.io.use((socket, next) => {
      const token = (socket.handshake.auth as any)?.token as string | undefined;
      if (!token) return next(new Error('Unauthorized: missing token'));
      try {
        const decoded = jwt.verify(token, config.JWT_SECRET) as { id: string; role?: string };
        (socket.data as any).user = decoded;
        next();
      } catch {
        next(new Error('Unauthorized: invalid token'));
      }
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

    // Relay events published by worker processes to connected clients.
    this.initSubscriber();

    return this.io;
  }

  /**
   * Call from a non-API process (e.g. the ingestion worker) that needs to emit
   * realtime events but has no Socket.IO server of its own. Events are
   * published over Redis and relayed by the API process's subscriber.
   */
  static initPublisher() {
    if (this.redisPub) return;
    this.redisPub = createRedisConnection();
    this.redisPub.on('error', (err) => logger.error('Realtime publisher Redis error', err));
  }

  private static initSubscriber() {
    const sub = createRedisConnection();
    sub.on('error', (err) => logger.error('Realtime subscriber Redis error', err));
    sub.subscribe(REALTIME_CHANNEL).catch((err) => logger.error('Failed to subscribe to realtime channel', err));
    sub.on('message', (_channel, message) => {
      try {
        const { event, data } = JSON.parse(message);
        this.io?.emit(event, data);
      } catch (err) {
        logger.error('Failed to relay realtime event from Redis', err);
      }
    });
  }

  static async closeBridge() {
    await this.redisPub?.quit().catch(() => undefined);
  }

  static emit(event: string, data: any) {
    if (this.io) {
      this.io.emit(event, data);
      return;
    }
    if (this.redisPub) {
      this.redisPub.publish(REALTIME_CHANNEL, JSON.stringify({ event, data })).catch((err) => {
        logger.error(`Failed to publish realtime event "${event}"`, err);
      });
      return;
    }
    logger.warn('Socket.io not initialized. Event not sent:', event);
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

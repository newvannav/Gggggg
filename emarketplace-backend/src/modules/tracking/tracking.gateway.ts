import { Logger, OnModuleInit } from '@nestjs/common';
import {
  ConnectedSocket,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedError } from '../../common/errors/domain-errors';
import { AuthPrincipal } from '../../common/auth/auth-principal.interface';
import { UserRole } from '../../generated/prisma';
import { TrackingService } from './tracking.service';

interface JoinRoomPayload {
  orderId: number;
}

/**
 * Socket.IO gateway for per-order tracking rooms.
 *
 * Clients (customer apps, vendor dashboards) connect to namespace `/tracking`
 * with `?token=<jwt>` (browsers cannot set Authorization headers on the WS
 * handshake), then emit `join` with the order id they want to follow.
 * All frames are pushed server-side by TrackingService.broadcast().
 */
@WebSocketGateway({ namespace: '/tracking', cors: { origin: process.env.CORS_ORIGIN ?? '*' } })
export class TrackingGateway implements OnGatewayConnection, OnModuleInit {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(TrackingGateway.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly tracking: TrackingService,
  ) {}

  onModuleInit(): void {
    // Hand the live server to the service so REST writes broadcast instantly.
    this.tracking.setSocketServer(this.server);
  }

  handleConnection(socket: Socket): void {
    const token = (socket.handshake.query['token'] as string | undefined) ?? undefined;
    if (!token) {
      socket.emit('error', { errorCode: 'UNAUTHORIZED', message: 'Missing token query param' });
      socket.disconnect(true);
      return;
    }
    let principal: AuthPrincipal;
    try {
      const payload = this.jwt.verify<Record<string, unknown>>(token);
      principal = this.toPrincipal(payload);
    } catch {
      socket.emit('error', { errorCode: 'UNAUTHORIZED', message: 'Invalid or expired access token' });
      socket.disconnect(true);
      return;
    }
    (socket.data as { principal?: AuthPrincipal }).principal = principal;
    this.logger.log(`WS connected: user=${principal.userId} role=${principal.role} sid=${socket.id}`);
  }

  @SubscribeMessage('join')
  handleJoin(@ConnectedSocket() socket: Socket, payload: JoinRoomPayload): { joined: string } | never {
    const principal = (socket.data as { principal?: AuthPrincipal }).principal;
    if (!principal) {
      throw new UnauthorizedError('Socket not authenticated');
    }
    if (!Number.isInteger(payload?.orderId) || payload.orderId <= 0) {
      throw new UnauthorizedError('Invalid orderId payload');
    }
    const room = `order-${payload.orderId}`;
    socket.join(room);
    this.logger.log(`user=${principal.userId} joined ${room}`);
    return { joined: room };
  }

  @SubscribeMessage('leave')
  handleLeave(@ConnectedSocket() socket: Socket, payload: JoinRoomPayload): { left: string } {
    const room = `order-${payload.orderId}`;
    socket.leave(room);
    return { left: room };
  }

  private toPrincipal(payload: Record<string, unknown>): AuthPrincipal {
    const sub = payload['sub'];
    const role = payload['role'];
    const email = payload['email'];
    const shopId = payload['shopId'];
    if (typeof sub !== 'number' || typeof role !== 'string' || typeof email !== 'string') {
      throw new UnauthorizedError('Malformed token claims');
    }
    if (role === UserRole.CUSTOMER && !(sub >= 1)) {
      throw new UnauthorizedError('Malformed token claims');
    }
    return {
      userId: sub,
      role: role as AuthPrincipal['role'],
      email,
      ...(typeof shopId === 'number' ? { shopId } : {}),
    };
  }
}

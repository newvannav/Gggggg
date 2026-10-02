"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var TrackingGateway_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TrackingGateway = void 0;
const common_1 = require("@nestjs/common");
const websockets_1 = require("@nestjs/websockets");
const socket_io_1 = require("socket.io");
const jwt_1 = require("@nestjs/jwt");
const domain_errors_1 = require("../../common/errors/domain-errors");
const prisma_1 = require("../../generated/prisma");
const tracking_service_1 = require("./tracking.service");
let TrackingGateway = TrackingGateway_1 = class TrackingGateway {
    jwt;
    tracking;
    server;
    logger = new common_1.Logger(TrackingGateway_1.name);
    constructor(jwt, tracking) {
        this.jwt = jwt;
        this.tracking = tracking;
    }
    onModuleInit() {
        this.tracking.setSocketServer(this.server);
    }
    handleConnection(socket) {
        const token = socket.handshake.query['token'] ?? undefined;
        if (!token) {
            socket.emit('error', { errorCode: 'UNAUTHORIZED', message: 'Missing token query param' });
            socket.disconnect(true);
            return;
        }
        let principal;
        try {
            const payload = this.jwt.verify(token);
            principal = this.toPrincipal(payload);
        }
        catch {
            socket.emit('error', { errorCode: 'UNAUTHORIZED', message: 'Invalid or expired access token' });
            socket.disconnect(true);
            return;
        }
        socket.data.principal = principal;
        this.logger.log(`WS connected: user=${principal.userId} role=${principal.role} sid=${socket.id}`);
    }
    handleJoin(socket, payload) {
        const principal = socket.data.principal;
        if (!principal) {
            throw new domain_errors_1.UnauthorizedError('Socket not authenticated');
        }
        if (!Number.isInteger(payload?.orderId) || payload.orderId <= 0) {
            throw new domain_errors_1.UnauthorizedError('Invalid orderId payload');
        }
        const room = `order-${payload.orderId}`;
        socket.join(room);
        this.logger.log(`user=${principal.userId} joined ${room}`);
        return { joined: room };
    }
    handleLeave(socket, payload) {
        const room = `order-${payload.orderId}`;
        socket.leave(room);
        return { left: room };
    }
    toPrincipal(payload) {
        const sub = payload['sub'];
        const role = payload['role'];
        const email = payload['email'];
        const shopId = payload['shopId'];
        if (typeof sub !== 'number' || typeof role !== 'string' || typeof email !== 'string') {
            throw new domain_errors_1.UnauthorizedError('Malformed token claims');
        }
        if (role === prisma_1.UserRole.CUSTOMER && !(sub >= 1)) {
            throw new domain_errors_1.UnauthorizedError('Malformed token claims');
        }
        return {
            userId: sub,
            role: role,
            email,
            ...(typeof shopId === 'number' ? { shopId } : {}),
        };
    }
};
exports.TrackingGateway = TrackingGateway;
__decorate([
    (0, websockets_1.WebSocketServer)(),
    __metadata("design:type", socket_io_1.Server)
], TrackingGateway.prototype, "server", void 0);
__decorate([
    (0, websockets_1.SubscribeMessage)('join'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Object)
], TrackingGateway.prototype, "handleJoin", null);
__decorate([
    (0, websockets_1.SubscribeMessage)('leave'),
    __param(0, (0, websockets_1.ConnectedSocket)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [socket_io_1.Socket, Object]),
    __metadata("design:returntype", Object)
], TrackingGateway.prototype, "handleLeave", null);
exports.TrackingGateway = TrackingGateway = TrackingGateway_1 = __decorate([
    (0, websockets_1.WebSocketGateway)({ namespace: '/tracking', cors: { origin: process.env.CORS_ORIGIN ?? '*' } }),
    __metadata("design:paramtypes", [jwt_1.JwtService,
        tracking_service_1.TrackingService])
], TrackingGateway);
//# sourceMappingURL=tracking.gateway.js.map
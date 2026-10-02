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
Object.defineProperty(exports, "__esModule", { value: true });
exports.JwtAuthGuard = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const domain_errors_1 = require("../errors/domain-errors");
let JwtAuthGuard = class JwtAuthGuard {
    jwtService;
    constructor(jwtService) {
        this.jwtService = jwtService;
    }
    async canActivate(context) {
        const request = context.switchToHttp().getRequest();
        const token = this.extractToken(request);
        if (!token) {
            throw new domain_errors_1.UnauthorizedError('Missing Authorization bearer token');
        }
        let payload;
        try {
            payload = await this.jwtService.verifyAsync(token);
        }
        catch {
            throw new domain_errors_1.UnauthorizedError('Invalid or expired access token');
        }
        const principal = this.toPrincipal(payload);
        request.user = principal;
        return true;
    }
    extractToken(request) {
        const [scheme, value] = (request.headers.authorization ?? '').split(' ');
        return scheme === 'Bearer' && value ? value : undefined;
    }
    toPrincipal(payload) {
        const sub = payload['sub'];
        const role = payload['role'];
        const email = payload['email'];
        const shopId = payload['shopId'];
        if (typeof sub !== 'number' || typeof role !== 'string' || typeof email !== 'string') {
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
exports.JwtAuthGuard = JwtAuthGuard;
exports.JwtAuthGuard = JwtAuthGuard = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [jwt_1.JwtService])
], JwtAuthGuard);
//# sourceMappingURL=jwt-auth.guard.js.map
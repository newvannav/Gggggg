import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';
import { UnauthorizedError } from '../errors/domain-errors';
import { AuthPrincipal } from './auth-principal.interface';

/**
 * Verifies the `Authorization: Bearer <jwt>` header and attaches a typed
 * AuthPrincipal to req.user. Downstream role guards / services read
 * `req.user.userId` and `req.user.role` — never raw token claims.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);

    if (!token) {
      throw new UnauthorizedError('Missing Authorization bearer token');
    }

    let payload: Record<string, unknown>;
    try {
      payload = await this.jwtService.verifyAsync<Record<string, unknown>>(token);
    } catch {
      throw new UnauthorizedError('Invalid or expired access token');
    }

    const principal = this.toPrincipal(payload);
    request.user = principal;
    return true;
  }

  private extractToken(request: Request): string | undefined {
    const [scheme, value] = (request.headers.authorization ?? '').split(' ');
    return scheme === 'Bearer' && value ? value : undefined;
  }

  private toPrincipal(payload: Record<string, unknown>): AuthPrincipal {
    const sub = payload['sub'];
    const role = payload['role'];
    const email = payload['email'];
    const shopId = payload['shopId'];

    if (typeof sub !== 'number' || typeof role !== 'string' || typeof email !== 'string') {
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

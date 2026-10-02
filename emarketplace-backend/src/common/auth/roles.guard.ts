import { CanActivate, ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { UserRole } from '../../generated/prisma';
import { ForbiddenError, UnauthorizedError } from '../errors/domain-errors';

export const ROLES_KEY = 'roles';

/** @Roles(UserRole.VENDOR) — restrict a route (or handler) to enumerated roles. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) {
      return true; // no @Roles metadata -> auth-only route
    }

    const request = context.switchToHttp().getRequest<Request>();
    const principal = request.user;

    if (!principal) {
      throw new UnauthorizedError();
    }

    if (!required.includes(principal.role as UserRole)) {
      throw new ForbiddenError(
        `Requires role ${required.join(' | ')} but token has ${principal.role}`,
      );
    }

    return true;
  }
}

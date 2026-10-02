import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { AuthPrincipal } from './auth-principal.interface';
import { UnauthorizedError } from '../errors/domain-errors';

/**
 * Typed accessor for the JWT principal:
 *   (@CurrentUser() user: AuthPrincipal)         -> whole principal
 *   (@CurrentUser('userId') userId: number)      -> single field
 */
export const CurrentUser = createParamDecorator(
  (field: keyof AuthPrincipal | undefined, ctx: ExecutionContext): AuthPrincipal | AuthPrincipal[keyof AuthPrincipal] => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const principal = request.user;

    if (!principal) {
      throw new UnauthorizedError('Authenticated principal missing from request');
    }

    return field === undefined ? principal : principal[field];
  },
);

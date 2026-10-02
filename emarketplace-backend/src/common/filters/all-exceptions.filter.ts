import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { Prisma } from '../../generated/prisma';
import { DomainError } from '../errors/domain-errors';

/**
 * Global exception filter.
 * - DomainErrors pass through with their { errorCode, message, details } body.
 * - Known Prisma errors map to sane HTTP codes without leaking SQL.
 * - HttpExceptions keep their status/body.
 * - Anything else becomes a sanitized 500 + logged with stack.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    let status: number = HttpStatus.INTERNAL_SERVER_ERROR;
    let body: Record<string, unknown> = {
      errorCode: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred',
    };

    if (exception instanceof DomainError) {
      status = exception.getStatus();
      body = exception.getResponse() as Record<string, unknown>;
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const mapped = this.mapPrismaError(exception);
      status = mapped.status;
      body = mapped.body;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      body = typeof res === 'string' ? { errorCode: 'HTTP_ERROR', message: res } : (res as Record<string, unknown>);
    } else if (exception instanceof SyntaxError) {
      status = HttpStatus.BAD_REQUEST;
      body = { errorCode: 'MALFORMED_JSON', message: 'Request body is not valid JSON' };
    } else {
      this.logger.error(
        exception instanceof Error ? exception.stack ?? exception.message : String(exception),
      );
    }

    if (status >= 500) {
      this.logger.error(
        `Unhandled error on ${ctx.getRequest<Record<string, unknown>>()?.url ?? 'unknown'}: ${status}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    response.status(status).json({ ...body, statusCode: status, timestamp: new Date().toISOString() });
  }

  private mapPrismaError(error: InstanceType<typeof Prisma.PrismaClientKnownRequestError>): {
    status: number;
    body: Record<string, unknown>;
  } {
    switch (error.code) {
      case 'P2002': // unique constraint
        return {
          status: HttpStatus.CONFLICT,
          body: { errorCode: 'DUPLICATE_RESOURCE', message: 'A record with these unique fields already exists' },
        };
      case 'P2025': // record not found
        return {
          status: HttpStatus.NOT_FOUND,
          body: { errorCode: 'RESOURCE_NOT_FOUND', message: 'The referenced record was not found' },
        };
      case 'P2003': // FK constraint
        return {
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          body: { errorCode: 'RELATED_RECORD_MISSING', message: 'A referenced record does not exist' },
        };
      default:
        return {
          status: HttpStatus.INTERNAL_SERVER_ERROR,
          body: { errorCode: 'DATABASE_ERROR', message: 'A database error occurred' },
        };
    }
  }
}

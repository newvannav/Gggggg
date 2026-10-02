"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var AllExceptionsFilter_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AllExceptionsFilter = void 0;
const common_1 = require("@nestjs/common");
const prisma_1 = require("../../generated/prisma");
const domain_errors_1 = require("../errors/domain-errors");
let AllExceptionsFilter = AllExceptionsFilter_1 = class AllExceptionsFilter {
    logger = new common_1.Logger(AllExceptionsFilter_1.name);
    catch(exception, host) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse();
        let status = common_1.HttpStatus.INTERNAL_SERVER_ERROR;
        let body = {
            errorCode: 'INTERNAL_ERROR',
            message: 'An unexpected error occurred',
        };
        if (exception instanceof domain_errors_1.DomainError) {
            status = exception.getStatus();
            body = exception.getResponse();
        }
        else if (exception instanceof prisma_1.Prisma.PrismaClientKnownRequestError) {
            const mapped = this.mapPrismaError(exception);
            status = mapped.status;
            body = mapped.body;
        }
        else if (exception instanceof common_1.HttpException) {
            status = exception.getStatus();
            const res = exception.getResponse();
            body = typeof res === 'string' ? { errorCode: 'HTTP_ERROR', message: res } : res;
        }
        else if (exception instanceof SyntaxError) {
            status = common_1.HttpStatus.BAD_REQUEST;
            body = { errorCode: 'MALFORMED_JSON', message: 'Request body is not valid JSON' };
        }
        else {
            this.logger.error(exception instanceof Error ? exception.stack ?? exception.message : String(exception));
        }
        if (status >= 500) {
            this.logger.error(`Unhandled error on ${ctx.getRequest()?.url ?? 'unknown'}: ${status}`, exception instanceof Error ? exception.stack : undefined);
        }
        response.status(status).json({ ...body, statusCode: status, timestamp: new Date().toISOString() });
    }
    mapPrismaError(error) {
        switch (error.code) {
            case 'P2002':
                return {
                    status: common_1.HttpStatus.CONFLICT,
                    body: { errorCode: 'DUPLICATE_RESOURCE', message: 'A record with these unique fields already exists' },
                };
            case 'P2025':
                return {
                    status: common_1.HttpStatus.NOT_FOUND,
                    body: { errorCode: 'RESOURCE_NOT_FOUND', message: 'The referenced record was not found' },
                };
            case 'P2003':
                return {
                    status: common_1.HttpStatus.UNPROCESSABLE_ENTITY,
                    body: { errorCode: 'RELATED_RECORD_MISSING', message: 'A referenced record does not exist' },
                };
            default:
                return {
                    status: common_1.HttpStatus.INTERNAL_SERVER_ERROR,
                    body: { errorCode: 'DATABASE_ERROR', message: 'A database error occurred' },
                };
        }
    }
};
exports.AllExceptionsFilter = AllExceptionsFilter;
exports.AllExceptionsFilter = AllExceptionsFilter = AllExceptionsFilter_1 = __decorate([
    (0, common_1.Catch)()
], AllExceptionsFilter);
//# sourceMappingURL=all-exceptions.filter.js.map
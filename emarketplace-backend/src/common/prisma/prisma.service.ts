import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '../../generated/prisma';

/**
 * Thin wrapper around the generated PrismaClient.
 * - Connects eagerly on module init so boot fails fast on DB misconfiguration.
 * - Disconnects cleanly on shutdown for zero-downtime deploys.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    super({
      log:
        process.env.NODE_ENV === 'development'
          ? (['query', 'info', 'warn', 'error'] as const)
          : (['warn', 'error'] as const),
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}

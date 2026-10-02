import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ClassSerializerInterceptor } from '@nestjs/common';
import { loadAppConfig } from './config/app.config';
import { PrismaModule } from './common/prisma/prisma.module';
import { PricingModule } from './domain/pricing.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { GeolocationModule } from './modules/geolocation/geolocation.module';
import { OrdersModule } from './modules/orders/orders.module';
import { TrackingModule } from './modules/tracking/tracking.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [loadAppConfig],
    }),
    // JwtModule registered globally so guards/gateways can inject JwtService.
    JwtModule.registerAsync({
      global: true,
      useFactory: () => ({ secret: process.env.JWT_SECRET }),
    }),
    PrismaModule,
    PricingModule,
    GeolocationModule,
    OrdersModule,
    TrackingModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: ClassSerializerInterceptor },
  ],
})
export class AppModule {}

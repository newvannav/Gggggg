import { Module } from '@nestjs/common';
import { ShopHoursService } from '../../domain/shop-hours/shop-hours.service';
import { OrdersController } from './orders.controller';
import { OrdersRepository } from './orders.repository';
import { OrdersService } from './orders.service';

@Module({
  controllers: [OrdersController],
  providers: [OrdersRepository, OrdersService, ShopHoursService],
  exports: [OrdersService],
})
export class OrdersModule {}

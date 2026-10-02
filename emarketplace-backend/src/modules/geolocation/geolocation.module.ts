import { Module } from '@nestjs/common';
import { ShopHoursService } from '../../domain/shop-hours/shop-hours.service';
import { PricingModule } from '../../domain/pricing.module';
import { ShopDiscoveryController } from './shop-discovery.controller';
import { ShopDiscoveryRepository } from './shop-discovery.repository';
import { ShopDiscoveryService } from './shop-discovery.service';

@Module({
  imports: [PricingModule],
  controllers: [ShopDiscoveryController],
  providers: [ShopDiscoveryRepository, ShopDiscoveryService, ShopHoursService],
  exports: [ShopDiscoveryService],
})
export class GeolocationModule {}

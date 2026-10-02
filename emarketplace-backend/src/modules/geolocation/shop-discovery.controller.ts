import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { AuthPrincipal } from '../../common/auth/auth-principal.interface';
import { DeliveryQuoteRequestDto } from './dto/delivery-quote-request.dto';
import { NearbyShopsQueryDto } from './dto/nearby-shops-query.dto';
import { ShopDiscoveryService } from './shop-discovery.service';
import { NearbyShopResponseDto } from './shop-discovery.types';

/**
 * GEOLOCATION & SHOP DISCOVERY.
 *
 * GET  /shops/nearby         — radius search + dynamic delivery quotes.
 * POST /shops/delivery-quote — fee/ETA preview for an explicit origin->shop pair
 *                              (used by cart checkout screens before order placement).
 */
@Controller('shops')
@UseGuards(JwtAuthGuard)
export class ShopDiscoveryController {
  constructor(private readonly discovery: ShopDiscoveryService) {}

  @Get('nearby')
  @HttpCode(HttpStatus.OK)
  async nearby(@Query() query: NearbyShopsQueryDto): Promise<NearbyShopResponseDto[]> {
    return this.discovery.findNearby(query);
  }

  @Post('delivery-quote')
  @HttpCode(HttpStatus.OK)
  async deliveryQuote(
    @CurrentUser() _user: AuthPrincipal,
    @Body() body: DeliveryQuoteRequestDto,
  ): Promise<{ distanceKm: number; deliveryFee: string; etaMinutes: number }> {
    const quote = await this.discovery.quoteToShop(
      { latitude: body.userLocation.latitude, longitude: body.userLocation.longitude },
      body.shopId,
    );
    return {
      distanceKm: quote.distanceKm,
      deliveryFee: quote.fee.toString(),
      etaMinutes: quote.etaMinutes,
    };
  }
}

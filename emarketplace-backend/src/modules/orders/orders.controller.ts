import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../../common/auth/roles.guard';
import { AuthPrincipal } from '../../common/auth/auth-principal.interface';
import { UserRole } from '../../generated/prisma';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrdersService } from './orders.service';
import { PlacedOrderResult } from './order.types';

/**
 * MULTI-VENDOR ORDER PLACEMENT.
 * POST /orders — atomic transactional creation (see OrdersService.placeOrder).
 */
@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async placeOrder(
    @Body() dto: CreateOrderDto,
    @CurrentUser() user: AuthPrincipal,
  ): Promise<PlacedOrderResult> {
    return this.orders.placeOrder(user, dto);
  }
}

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';
import { Roles, RolesGuard } from '../../common/auth/roles.guard';
import { AuthPrincipal } from '../../common/auth/auth-principal.interface';
import { OrderStatus, UserRole } from '../../generated/prisma';
import { DriverLocationUpdateDto } from './dto/driver-location-update.dto';
import { OrderStatusTransitionDto } from './dto/order-status-transition.dto';
import { TrackingService } from './tracking.service';
import { DriverTrackingAck, TrackingStatusEvent } from './tracking.types';

/**
 * REST surface of the real-time delivery module.
 * The websocket fan-out happens inside TrackingService.broadcast(); these
 * endpoints are the write path (drivers) and the cold-start read path
 * (customer app bootstraps the map via GET before the socket takes over).
 */
@Controller('orders')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TrackingController {
  constructor(private readonly tracking: TrackingService) {}

  /** Assigned driver pushes a live GPS fix. Role-gated + ownership-checked in-service. */
  @Patch(':id/tracking')
  @Roles(UserRole.DRIVER, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async updateTracking(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DriverLocationUpdateDto,
    @CurrentUser() user: AuthPrincipal,
  ): Promise<DriverTrackingAck> {
    return this.tracking.updateDriverLocation(BigInt(id), dto, user);
  }

  /** Vendor workflow transitions (ACCEPTED_BY_SHOP / PREPARING / AWAITING_PICKUP…)
   *  and driver transitions (OUT_FOR_DELIVERY / DELIVERED). */
  @Patch(':id/status')
  @Roles(UserRole.VENDOR, UserRole.DRIVER, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async transition(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: OrderStatusTransitionDto,
    @CurrentUser() user: AuthPrincipal,
  ): Promise<TrackingStatusEvent> {
    return this.tracking.transitionStatus(BigInt(id), dto.status as OrderStatus, user);
  }

  /** Cold-start snapshot for customer & driver tracking screens. */
  @Get(':id/tracking')
  @HttpCode(HttpStatus.OK)
  async snapshot(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser() user: AuthPrincipal,
  ) {
    return this.tracking.getTrackingSnapshot(BigInt(id), user);
  }
}

import { IsEnum } from 'class-validator';
import { OrderStatus } from '../../../generated/prisma';

/** Body for PATCH /orders/:id/status (vendor & driver workflow transitions). */
export class OrderStatusTransitionDto {
  @IsEnum(OrderStatus, { message: 'status must be a valid OrderStatus enum value' })
  status!: OrderStatus;
}

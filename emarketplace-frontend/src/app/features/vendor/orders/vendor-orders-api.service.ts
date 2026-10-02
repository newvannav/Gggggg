import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { OrderStatus } from '../../../shared/models/domain.models';

export interface VendorOrderSummary {
  readonly id: string;
  readonly orderNumber: string;
  readonly status: OrderStatus;
  readonly totalAmount: number;
  readonly netVendorPayout: number;
  readonly placedAt: string;
  readonly customerName: string;
}

/**
 * Vendor portal API. All routes are guarded server-side by the VENDOR role —
 * the client merely mirrors them; a non-vendor token gets 403 from the backend.
 */
@Injectable({ providedIn: 'root' })
export class VendorOrdersApiService {
  private readonly http = inject(HttpClient);

  public list(status: OrderStatus | 'ALL', page: number): Observable<readonly VendorOrderSummary[]> {
    let params = new HttpParams().set('page', String(page)).set('limit', '25');
    if (status !== 'ALL') params = params.set('status', status);
    return this.http.get<readonly VendorOrderSummary[]>('/v1/vendor/orders', { params });
  }

  /** PATCH /v1/vendor/orders/:id/accept — moves PENDING → ACCEPTED_BY_SHOP + timeline entry. */
  public accept(orderId: string): Observable<VendorOrderSummary> {
    return this.http.post<VendorOrderSummary>(`/v1/vendor/orders/${orderId}/accept`, {});
  }

  public transition(orderId: string, to: Extract<OrderStatus, 'PREPARING' | 'AWAITING_PICKUP'>): Observable<VendorOrderSummary> {
    return this.http.patch<VendorOrderSummary>(`/v1/vendor/orders/${orderId}/status`, { to });
  }

  /** Operating hours editor — blocked for non-vendors by the JWT role guard. */
  public updateOperatingHours(
    shopId: number,
    hours: ReadonlyArray<{ dayOfWeek: number; opensAt: string; closesAt: string; isClosed: boolean }>,
  ): Observable<unknown> {
    return this.http.put(`/v1/vendor/shops/${shopId}/operating-hours`, { hours });
  }
}

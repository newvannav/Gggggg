import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { VendorOrderSummary, VendorOrdersApiService } from '../orders/vendor-orders-api.service';

@Component({
  selector: 'app-vendor-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DatePipe],
  template: `
    <div class="dash">
      <header class="dash__tabs">
        @for (tab of tabs; track tab) {
          <button
            type="button"
            class="tab"
            [class.tab--active]="activeTab() === tab"
            (click)="selectTab(tab)"
          >{{ label(tab) }}</button>
        }
      </header>

      <main class="dash__list">
        @for (order of orders(); track order.id) {
          <article class="order-row">
            <div>
              <strong>#{{ order.orderNumber }}</strong>
              <span>{{ order.customerName }} · {{ order.placedAt | date: 'MMM d, HH:mm' }}</span>
            </div>
            <div class="money">
              <span>${{ order.totalAmount.toFixed(2) }}</span>
              <em>payout ${{ order.netVendorPayout.toFixed(2) }}</em>
            </div>
            <div class="actions">
              @if (order.status === 'PENDING') {
                <button type="button" (click)="accept(order)">Accept</button>
              } @else if (order.status === 'ACCEPTED_BY_SHOP') {
                <button type="button" (click)="transition(order, 'PREPARING')">Start preparing</button>
              } @else if (order.status === 'PREPARING') {
                <button type="button" (click)="transition(order, 'AWAITING_PICKUP')">Ready for pickup</button>
              } @else {
                <span class="badge">{{ label(order.status) }}</span>
              }
            </div>
          </article>
        } @empty {
          <p>No orders in this state.</p>
        }
      </main>
    </div>
  `,
  styles: `
    .dash { display: grid; grid-template-rows: auto 1fr; height: 100%; }
    .dash__tabs { display: flex; gap: 6px; padding: 10px 16px; border-bottom: 1px solid #e3e7ec; overflow-x: auto; }
    .tab { border: 0; background: #eef1f5; border-radius: 999px; padding: 7px 14px; font-weight: 600; cursor: pointer; white-space: nowrap; }
    .tab--active { background: #101418; color: #fff; }
    .dash__list { overflow-y: auto; padding: 12px 16px; display: flex; flex-direction: column; gap: 8px; }
    .order-row { display: grid; grid-template-columns: 1fr auto auto; gap: 16px; align-items: center; border: 1px solid #e3e7ec; border-radius: 12px; padding: 12px 14px; }
    .order-row span { display: block; font-size: 12px; color: #5b6470; }
    .money { text-align: right; }
    .money em { display: block; font-style: normal; font-size: 12px; color: #0b6b3a; }
    .actions button { border: 0; background: #29d38a; color: #06231a; border-radius: 8px; padding: 8px 12px; font-weight: 600; cursor: pointer; }
    .badge { font-size: 12px; color: #5b6470; }
  `,
})
export class VendorDashboardComponent implements OnInit {
  private readonly api = inject(VendorOrdersApiService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly tabs = ['ALL', 'PENDING', 'ACCEPTED_BY_SHOP', 'PREPARING', 'AWAITING_PICKUP'] as const;
  protected readonly activeTab = signal<'ALL' | 'PENDING' | 'ACCEPTED_BY_SHOP' | 'PREPARING' | 'AWAITING_PICKUP'>('PENDING');
  protected readonly orders = signal<readonly VendorOrderSummary[]>([]);

  ngOnInit(): void {
    this.reload();
  }

  protected selectTab(tab: (typeof this.tabs)[number]): void {
    this.activeTab.set(tab);
    this.reload();
  }

  protected accept(order: VendorOrderSummary): void {
    this.api.accept(order.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.reload());
  }

  protected transition(order: VendorOrderSummary, to: 'PREPARING' | 'AWAITING_PICKUP'): void {
    this.api.transition(order.id, to).pipe(takeUntilDestroyed(this.destroyRef)).subscribe(() => this.reload());
  }

  protected label(tab: string): string {
    return tab === 'ALL' ? 'All' : tab.replaceAll('_', ' ');
  }

  private reload(): void {
    this.api
      .list(this.activeTab(), 1)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((rows) => this.orders.set(rows));
  }
}

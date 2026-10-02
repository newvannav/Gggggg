import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { UpdateNotificationComponent } from './shared/components/update-notification/update-notification.component';
import { ToastService } from './shared/services/toast.service';
import { CartStore } from './features/customer/cart/cart-store.service';
import { MultiVendorCartError } from './features/customer/cart/cart-store.service';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, UpdateNotificationComponent],
  template: `
    <div class="shell">
      <nav class="shell__cart" aria-label="Cart summary">
        <span>🛒 {{ cart.itemCount() }} item(s) — ${{ cart.subtotal().toFixed(2) }}</span>
        @if (cart.shop(); as shop) {
          <em>{{ shop.name }}</em>
        }
      </nav>
      <router-outlet />
      <app-update-notification />
    </div>
  `,
  styles: `
    .shell { display: flex; flex-direction: column; height: 100dvh; }
    .shell__cart { display: flex; gap: 12px; align-items: center; padding: 8px 16px; background: #101418; color: #fff; font-size: 13px; }
    .shell__cart em { opacity: .7; font-style: normal; margin-left: auto; }
  `,
})
export class AppComponent {
  protected readonly cart = inject(CartStore);
  private readonly toast = inject(ToastService);

  constructor() {
    // Global safety net: any component that lets a MultiVendorCartError bubble
    // gets surfaced as an explicit blocking toast rather than a console warn.
    window.addEventListener('error', (event) => {
      if (event.error instanceof MultiVendorCartError) {
        this.toast.warning(event.error.message);
        event.preventDefault();
      }
    });
  }
}

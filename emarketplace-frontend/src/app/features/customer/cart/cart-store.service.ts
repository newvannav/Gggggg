import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ProductDto, ShopDto, CartLine } from '../../../shared/models/domain.models';

/** Thrown when a customer attempts to mix products from separate vendors. */
export class MultiVendorCartError extends Error {
  constructor(public readonly attemptedShopId: number, public readonly lockedShopId: number) {
    super(
      `Your cart contains items from shop #${lockedShopId}. Each order ships from a single vendor — clear the cart or remove existing items before adding shop #${attemptedShopId}.`,
    );
    this.name = 'MultiVendorCartError';
  }
}

export class InsufficientStockError extends Error {
  constructor(public readonly productName: string, public readonly available: number) {
    super(`Only ${available} × "${productName}" left in stock.`);
    this.name = 'InsufficientStockError';
  }
}

interface PersistedCart {
  readonly lockedShop: Pick<ShopDto, 'id' | 'name'> | null;
  readonly lines: readonly CartLine[];
}

const STORAGE_KEY = 'emarket.cart.v1';

/**
 * Signal-based global cart store (NgRx-lite). Deliberately NOT NgRx because the
 * cart is the only truly global client state; everything server-owned (shops,
 * orders) lives in feature services with their own signals. The hard invariant:
 * one cart === one vendor shop. Violations throw MultiVendorCartError which the
 * UI catches and renders as an explicit blocking dialog, never a silent no-op.
 */
@Injectable({ providedIn: 'root' })
export class CartStore {
  private readonly router = inject(Router);

  private readonly _shop = signal<Pick<ShopDto, 'id' | 'name'> | null>(null);
  private readonly _lines = signal<readonly CartLine[]>([]);

  public readonly shop = this._shop.asReadonly();
  public readonly lines = this._lines.asReadonly();

  public readonly isEmpty = computed(() => this._lines().length === 0);
  public readonly itemCount = computed(() => this._lines().reduce((sum, l) => sum + l.quantity, 0));
  public readonly subtotal = computed(() =>
    this.round2(this._lines().reduce((sum, l) => sum + l.unitPrice * l.quantity, 0)),
  );
  /** Minimum-order gate for checkout CTA; fed by the locked shop's threshold. */
  public minimumOrderAmount = signal<number>(0);

  public readonly meetsMinimum = computed(() => this.subtotal() >= this.minimumOrderAmount());

  constructor() {
    this.hydrate();
  }

  /** Add product/variant to cart. Enforces single-vendor lock + stock ceiling. */
  public addLine(shop: Pick<ShopDto, 'id' | 'name'>, product: ProductDto, variantId: string | null, quantity: number): void {
    if (this._shop() !== null && this._shop()!.id !== shop.id) {
      throw new MultiVendorCartError(shop.id, this._shop()!.id);
    }

    const variant = variantId === null ? null : product.variants.find((v) => v.id === variantId) ?? null;
    if (variantId !== null && !variant) {
      throw new Error(`Variant ${variantId} not found on product ${product.id}`);
    }

    const unitPrice = this.round2(product.basePrice + (variant?.priceOffset ?? 0));
    const maxQuantity = product.trackInventory ? (variant ? (variant.allowBackorder ? Infinity : variant.stockQuantity) : Number.POSITIVE_INFINITY) : Number.POSITIVE_INFINITY;

    const existing = this._lines().find((l) => l.productId === product.id && l.variantId === variantId);
    const targetQty = (existing?.quantity ?? 0) + quantity;

    if (Number.isFinite(maxQuantity) && targetQty > maxQuantity) {
      throw new InsufficientStockError(variant ? `${product.name} · ${variant.name}` : product.name, maxQuantity);
    }

    if (existing) {
      this._lines.update((lines) =>
        lines.map((l) => (l.lineId === existing.lineId ? { ...l, quantity: targetQty, unitPrice, maxQuantity } : l)),
      );
    } else {
      const line: CartLine = {
        lineId: crypto.randomUUID(),
        productId: product.id,
        variantId,
        shopId: shop.id,
        productNameSnapshot: product.name,
        variantNameSnapshot: variant?.name ?? null,
        imageUrl: variant?.imageUrl ?? product.imageUrl,
        unitPrice,
        quantity,
        maxQuantity,
      };
      this._lines.update((lines) => [...lines, line]);
    }

    this._shop.set(shop);
    this.minimumOrderAmount.set(shop.id === this._shop()?.id ? this.minimumOrderAmount() : 0);
    this.persist();
  }

  public setQuantity(lineId: string, quantity: number): void {
    const line = this._lines().find((l) => l.lineId === lineId);
    if (!line) return;
    if (quantity <= 0) {
      this.removeLine(lineId);
      return;
    }
    if (Number.isFinite(line.maxQuantity) && quantity > line.maxQuantity) {
      throw new InsufficientStockError(line.productNameSnapshot, line.maxQuantity);
    }
    this._lines.update((lines) => lines.map((l) => (l.lineId === lineId ? { ...l, quantity } : l)));
    this.persist();
  }

  public removeLine(lineId: string): void {
    this._lines.update((lines) => lines.filter((l) => l.lineId !== lineId));
    if (this._lines().length === 0) this._shop.set(null);
    this.persist();
  }

  public clear(): void {
    this._shop.set(null);
    this._lines.set([]);
    this.minimumOrderAmount.set(0);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* private-mode Safari */
    }
  }

  /** Called after successful POST /orders — wipes local state and routes to tracking. */
  public checkoutCompleted(orderId: string): void {
    this.clear();
    void this.router.navigate(['/customer/orders', orderId, 'track']);
  }

  private hydrate(): void {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch {
      return;
    }
    if (!raw) return;
    try {
      const data = JSON.parse(raw) as PersistedCart;
      this._shop.set(data.lockedShop);
      this._lines.set(data.lines);
    } catch {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  private persist(): void {
    try {
      const payload: PersistedCart = { lockedShop: this._shop(), lines: this._lines() };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      /* quota / private mode — cart stays in-memory */
    }
  }

  private round2(n: number): number {
    return Math.round(n * 100) / 100;
  }
}

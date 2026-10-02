/**
 * Type-only fallback stub for the generated Prisma client.
 *
 * In a real environment you run `npx prisma generate`, which overwrites this
 * folder with the fully-typed client (generator output = "../src/generated/prisma").
 * These declarations mirror the exact model/enum surface of prisma/schema.prisma
 * so that every module, DTO and service in this codebase stays strictly typed
 * against the production schema.
 */

export enum UserRole {
  CUSTOMER = 'CUSTOMER',
  VENDOR = 'VENDOR',
  DRIVER = 'DRIVER',
  ADMIN = 'ADMIN',
}

export enum OrderStatus {
  PENDING = 'PENDING',
  ACCEPTED_BY_SHOP = 'ACCEPTED_BY_SHOP',
  PREPARING = 'PREPARING',
  AWAITING_PICKUP = 'AWAITING_PICKUP',
  OUT_FOR_DELIVERY = 'OUT_FOR_DELIVERY',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
}

export enum PaymentStatus {
  UNPAID = 'UNPAID',
  AUTHORIZED = 'AUTHORIZED',
  PAID = 'PAID',
  PARTIALLY_REFUNDED = 'PARTIALLY_REFUNDED',
  REFUNDED = 'REFUNDED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED',
}

export enum PaymentProvider {
  STRIPE = 'STRIPE',
  ADYEN = 'ADYEN',
  PAYPAL = 'PAYPAL',
  CASH = 'CASH',
}

export enum OnboardingStatus {
  NOT_STARTED = 'NOT_STARTED',
  IN_PROGRESS = 'IN_PROGRESS',
  PENDING_REVIEW = 'PENDING_REVIEW',
  COMPLETE = 'COMPLETE',
  REJECTED = 'REJECTED',
}

export enum PayoutSchedule {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  BIWEEKLY = 'BIWEEKLY',
  MONTHLY = 'MONTHLY',
}

export enum ReviewTarget {
  SHOP = 'SHOP',
  DRIVER = 'DRIVER',
}

export type PrismaDecimal = Prisma.Decimal;

export interface User {
  id: number;
  email: string;
  emailVerifiedAt: Date | null;
  passwordHash: string | null;
  phone: string | null;
  firstName: string;
  lastName: string;
  displayName: string | null;
  avatarUrl: string | null;
  role: UserRole;
  isActive: boolean;
  lastLoginAt: Date | null;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Shop {
  id: number;
  userId: number;
  name: string;
  slug: string;
  description: string | null;
  shortDescription: string | null;
  logoUrl: string | null;
  coverImageUrl: string | null;
  galleryUrls: string[];
  latitude: number;
  longitude: number;
  timezone: string;
  currencyCode: string;
  minimumOrderAmount: PrismaDecimal;
  averagePreparationTimeMinutes: number | null;
  ratingAverage: PrismaDecimal | null;
  ratingCount: number;
  isApproved: boolean;
  isActive: boolean;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ShopOperatingHours {
  id: number;
  shopId: number;
  dayOfWeek: number;
  opensAt: Date;
  closesAt: Date;
  isClosed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Category {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  isActive: boolean;
  parentId: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Product {
  id: number;
  shopId: number;
  categoryId: number | null;
  name: string;
  slug: string;
  description: string | null;
  shortDescription: string | null;
  basePrice: PrismaDecimal;
  compareAtPrice: PrismaDecimal | null;
  currencyCode: string;
  imageUrl: string | null;
  galleryUrls: string[];
  tags: string[];
  isActive: boolean;
  isFeatured: boolean;
  trackInventory: boolean;
  lowStockThreshold: number;
  averageRating: PrismaDecimal | null;
  ratingCount: number;
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProductVariant {
  id: bigint;
  productId: number;
  name: string;
  sku: string;
  barcode: string | null;
  priceOffset: PrismaDecimal;
  stockQuantity: number;
  allowBackorder: boolean;
  isActive: boolean;
  imageUrl: string | null;
  weightGrams: number | null;
  dimensionsJson: unknown;
  attributesJson: unknown;
  createdAt: Date;
  updatedAt: Date;
}

export interface Address {
  id: number;
  userId: number | null;
  shopId: number | null;
  label: string | null;
  recipientName: string;
  recipientPhone: string | null;
  line1: string;
  line2: string | null;
  district: string | null;
  city: string;
  state: string | null;
  postalCode: string;
  countryCode: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  isDefault: boolean;
  isActive: boolean;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface Order {
  id: bigint;
  orderNumber: string;
  customerId: number;
  shopId: number;
  deliveryAddressId: number | null;
  driverId: number | null;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  paymentProvider: PaymentProvider | null;
  paymentReference: string | null;
  paymentCapturedAt: Date | null;
  currencyCode: string;
  subtotal: PrismaDecimal;
  deliveryFee: PrismaDecimal;
  platformServiceFee: PrismaDecimal;
  platformCommissionRate: PrismaDecimal | null;
  taxes: PrismaDecimal;
  discountTotal: PrismaDecimal;
  tipAmount: PrismaDecimal;
  totalAmount: PrismaDecimal;
  refundedAmount: PrismaDecimal;
  netVendorPayout: PrismaDecimal;
  deliveryRecipientName: string | null;
  deliveryRecipientPhone: string | null;
  deliveryLine1: string | null;
  deliveryLine2: string | null;
  deliveryCity: string | null;
  deliveryState: string | null;
  deliveryPostalCode: string | null;
  deliveryCountryCode: string | null;
  deliveryLatitude: number | null;
  deliveryLongitude: number | null;
  driverLatitude: number | null;
  driverLongitude: number | null;
  driverLocationUpdatedAt: Date | null;
  driverEtaMinutes: number | null;
  notes: string | null;
  cancellationReason: string | null;
  placedAt: Date;
  acceptedAt: Date | null;
  preparingAt: Date | null;
  awaitingPickupAt: Date | null;
  outForDeliveryAt: Date | null;
  deliveredAt: Date | null;
  cancelledAt: Date | null;
  estimatedDeliveryAt: Date | null;
  scheduledFor: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderItem {
  id: bigint;
  orderId: bigint;
  productId: number | null;
  variantId: bigint | null;
  quantity: number;
  currencyCode: string;
  unitPrice: PrismaDecimal;
  totalPrice: PrismaDecimal;
  taxRate: PrismaDecimal | null;
  taxAmount: PrismaDecimal;
  discountAmount: PrismaDecimal;
  productNameSnapshot: string;
  variantNameSnapshot: string | null;
  skuSnapshot: string | null;
  productImageSnapshot: string | null;
  configurationSnapshot: unknown;
  modifiersSnapshot: unknown;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrderTimeline {
  id: bigint;
  orderId: bigint;
  status: OrderStatus;
  previousStatus: OrderStatus | null;
  note: string | null;
  changedById: number | null;
  occurredAt: Date;
  createdAt: Date;
}

export interface VendorPayoutProfile {
  id: number;
  shopId: number;
  stripeAccountId: string | null;
  stripeCurrency: string | null;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  hasAcceptedTerms: boolean;
  splitPaymentsEnabled: boolean;
  lazyPayoutsEnabled: boolean;
  payoutStatementDescriptor: string | null;
  onboardingCompletedAt: Date | null;
  onboardingStatus: OnboardingStatus;
  commissionRate: PrismaDecimal;
  fixedCommissionPerOrder: PrismaDecimal;
  minimumPayoutAmount: PrismaDecimal;
  payoutSchedule: PayoutSchedule;
  nextPayoutAt: Date | null;
  lastPayoutAt: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Review {
  id: bigint;
  customerId: number;
  orderId: bigint;
  shopId: number | null;
  driverId: number | null;
  targetType: ReviewTarget;
  rating: number;
  comment: string | null;
  mediaUrls: string[];
  response: string | null;
  respondedAt: Date | null;
  isVisible: boolean;
  isFlagged: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export namespace Prisma {
  export class PrismaClientKnownRequestError extends Error {
    readonly code: string;
    readonly meta?: Record<string, unknown>;
    readonly clientVersion: string;
    constructor(message: string, init: { code: string; meta?: Record<string, unknown>; clientVersion: string }) {
      super(message);
      this.name = 'PrismaClientKnownRequestError';
      this.code = init.code;
      this.meta = init.meta;
      this.clientVersion = init.clientVersion;
    }
  }

  export class Decimal {
    private readonly value: string;
    constructor(value: string | number) {
      this.value = String(value);
    }
    toString(): string {
      return this.value;
    }
    toNumber(): number {
      return Number(this.value);
    }
  }

  export class Sql {
    readonly strings: readonly string[];
    readonly values: readonly unknown[];
    constructor(strings: readonly string[], values: readonly unknown[]) {
      this.strings = strings;
      this.values = values;
    }
  }

  export function sql(strings: TemplateStringsArray, ...values: unknown[]): Sql {
    return new Sql(strings, values);
  }

  /** Subset of the client surface usable inside interactive transactions. */
  export interface TransactionClient {
    [key: string]: any;
    $queryRaw<T = unknown>(query: Sql | TemplateStringsArray | string, ...params: any[]): Promise<T>;
    $executeRaw(query: Sql | TemplateStringsArray | string, ...params: any[]): Promise<number>;
  }

  export type TransactionOptions = {
    maxWait?: number;
    timeout?: number;
    isolationLevel?: 'READ_UNCOMMITTED' | 'READ_COMMITTED' | 'REPEATABLE_READ' | 'SERIALIZABLE';
  };

  export type InteractiveTransactionClient = any;
}

/**
 * Minimal typed surface of the generated PrismaClient used by this app.
 * The real generated class (after `prisma generate`) is API-compatible with
 * this shape for every call site in src/modules/**.
 */
export declare class PrismaClient {
  constructor(options?: any);
  $connect(): Promise<void>;
  $disconnect(): Promise<void>;
  $transaction<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>, options?: Prisma.TransactionOptions): Promise<T>;
  $transaction<P extends readonly Promise<unknown>[]>(arg: [...P], options?: Prisma.TransactionOptions): Promise<{ [K in keyof P]: Awaited<P[K]> }>;
  $queryRaw<T = unknown>(query: Prisma.Sql | TemplateStringsArray | string, ...params: any[]): Promise<T>;
  $executeRaw(query: Prisma.Sql | TemplateStringsArray | string, ...params: any[]): Promise<number>;
  $executeRawUnsafe(query: string, ...params: any[]): Promise<number>;
  user: any;
  shop: any;
  shopOperatingHours: any;
  category: any;
  product: any;
  productVariant: any;
  address: any;
  order: any;
  orderItem: any;
  orderTimeline: any;
  vendorPayoutProfile: any;
  review: any;
}

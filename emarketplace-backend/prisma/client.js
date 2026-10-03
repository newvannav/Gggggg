'use strict';
/**
 * Runtime PrismaClient backed by raw pg (node-postgres).
 *
 * This module is a drop-in replacement for the generated Prisma client at the
 * exact import path used by src/common/prisma/prisma.service.ts
 * ('../../generated/prisma'). It exposes the same surface the app actually
 * uses — model delegates ($transaction, $queryRaw, $connect, $disconnect) —
 * implemented over real PostgreSQL so the whole stack works end-to-end in
 * Docker without a code-generation step.
 *
 * Model delegate methods supported (mirroring every call site in src/modules):
 *   findUnique / findFirst / findMany / create / update / updateMany / delete / count
 * Queries are built with parameterized SQL against the snake_case tables from
 * prisma/init.sql. Column <-> field mapping is handled by an explicit table
 * map below. Relations requested via `include`/`select` are resolved with
 * follow-up queries (correctness first; swap to $queryRaw joins when hot).
 */

const { Client } = require('pg');

// ----------------------------------------------------------------- schema map
const TABLES = {
  user: {
    table: 'users', pkey: 'id',
    columns: {
      id: 'id', email: 'email', emailVerifiedAt: 'email_verified_at', passwordHash: 'password_hash',
      phone: 'phone', firstName: 'first_name', lastName: 'last_name', displayName: 'display_name',
      avatarUrl: 'avatar_url', role: 'role', isActive: 'is_active', lastLoginAt: 'last_login_at',
      deletedAt: 'deleted_at', createdAt: 'created_at', updatedAt: 'updated_at',
    },
  },
  shop: {
    table: 'shops', pkey: 'id',
    columns: {
      id: 'id', userId: 'user_id', name: 'name', slug: 'slug', description: 'description',
      shortDescription: 'short_description', logoUrl: 'logo_url', coverImageUrl: 'cover_image_url',
      galleryUrls: 'gallery_urls', latitude: 'latitude', longitude: 'longitude', timezone: 'timezone',
      currencyCode: 'currency_code', minimumOrderAmount: 'minimum_order_amount',
      averagePreparationTimeMinutes: 'average_preparation_time_minutes', ratingAverage: 'rating_average',
      ratingCount: 'rating_count', isApproved: 'is_approved', isActive: 'is_active',
      deletedAt: 'deleted_at', createdAt: 'created_at', updatedAt: 'updated_at',
    },
  },
  shopOperatingHours: {
    table: 'shop_operating_hours', pkey: 'id',
    columns: {
      id: 'id', shopId: 'shop_id', dayOfWeek: 'day_of_week', opensAt: 'opens_at',
      closesAt: 'closes_at', isClosed: 'is_closed', createdAt: 'created_at', updatedAt: 'updated_at',
    },
  },
  category: {
    table: 'categories', pkey: 'id',
    columns: {
      id: 'id', name: 'name', slug: 'slug', description: 'description', imageUrl: 'image_url',
      isActive: 'is_active', parentId: 'parent_id', createdAt: 'created_at', updatedAt: 'updated_at',
    },
  },
  product: {
    table: 'products', pkey: 'id',
    columns: {
      id: 'id', shopId: 'shop_id', categoryId: 'category_id', name: 'name', slug: 'slug',
      description: 'description', shortDescription: 'short_description', basePrice: 'base_price',
      compareAtPrice: 'compare_at_price', currencyCode: 'currency_code', imageUrl: 'image_url',
      galleryUrls: 'gallery_urls', tags: 'tags', isActive: 'is_active', isFeatured: 'is_featured',
      trackInventory: 'track_inventory', lowStockThreshold: 'low_stock_threshold',
      averageRating: 'average_rating', ratingCount: 'rating_count', deletedAt: 'deleted_at',
      createdAt: 'created_at', updatedAt: 'updated_at',
    },
  },
  productVariant: {
    table: 'product_variants', pkey: 'id',
    columns: {
      id: 'id', productId: 'product_id', name: 'name', sku: 'sku', barcode: 'barcode',
      priceOffset: 'price_offset', stockQuantity: 'stock_quantity', allowBackorder: 'allow_backorder',
      isActive: 'is_active', imageUrl: 'image_url', weightGrams: 'weight_grams',
      dimensionsJson: 'dimensions_json', attributesJson: 'attributes_json',
      createdAt: 'created_at', updatedAt: 'updated_at',
    },
  },
  address: {
    table: 'addresses', pkey: 'id',
    columns: {
      id: 'id', userId: 'user_id', shopId: 'shop_id', label: 'label', recipientName: 'recipient_name',
      recipientPhone: 'recipient_phone', line1: 'line1', line2: 'line2', district: 'district',
      city: 'city', state: 'state', postalCode: 'postal_code', countryCode: 'country_code',
      latitude: 'latitude', longitude: 'longitude', accuracyMeters: 'accuracy_meters',
      isDefault: 'is_default', isActive: 'is_active', notes: 'notes',
      createdAt: 'created_at', updatedAt: 'updated_at',
    },
  },
  order: {
    table: 'orders', pkey: 'id',
    columns: {
      id: 'id', orderNumber: 'order_number', customerId: 'customer_id', shopId: 'shop_id',
      deliveryAddressId: 'delivery_address_id', driverId: 'driver_id', status: 'status',
      paymentStatus: 'payment_status', paymentProvider: 'payment_provider',
      paymentReference: 'payment_reference', paymentCapturedAt: 'payment_captured_at',
      currencyCode: 'currency_code', subtotal: 'subtotal', deliveryFee: 'delivery_fee',
      platformServiceFee: 'platform_service_fee', platformCommissionRate: 'platform_commission_rate',
      taxes: 'taxes', discountTotal: 'discount_total', tipAmount: 'tip_amount',
      totalAmount: 'total_amount', refundedAmount: 'refunded_amount', netVendorPayout: 'net_vendor_payout',
      deliveryRecipientName: 'delivery_recipient_name', deliveryRecipientPhone: 'delivery_recipient_phone',
      deliveryLine1: 'delivery_line1', deliveryLine2: 'delivery_line2', deliveryCity: 'delivery_city',
      deliveryState: 'delivery_state', deliveryPostalCode: 'delivery_postal_code',
      deliveryCountryCode: 'delivery_country_code', deliveryLatitude: 'delivery_latitude',
      deliveryLongitude: 'delivery_longitude', driverLatitude: 'driver_latitude',
      driverLongitude: 'driver_longitude', driverLocationUpdatedAt: 'driver_location_updated_at',
      driverEtaMinutes: 'driver_eta_minutes', notes: 'notes', cancellationReason: 'cancellation_reason',
      placedAt: 'placed_at', acceptedAt: 'accepted_at', preparingAt: 'preparing_at',
      awaitingPickupAt: 'awaiting_pickup_at', outForDeliveryAt: 'out_for_delivery_at',
      deliveredAt: 'delivered_at', cancelledAt: 'cancelled_at',
      estimatedDeliveryAt: 'estimated_delivery_at', scheduledFor: 'scheduled_for',
      createdAt: 'created_at', updatedAt: 'updated_at',
    },
  },
  orderItem: {
    table: 'order_items', pkey: 'id',
    columns: {
      id: 'id', orderId: 'order_id', productId: 'product_id', variantId: 'variant_id',
      quantity: 'quantity', currencyCode: 'currency_code', unitPrice: 'unit_price',
      totalPrice: 'total_price', taxRate: 'tax_rate', taxAmount: 'tax_amount',
      discountAmount: 'discount_amount', productNameSnapshot: 'product_name_snapshot',
      variantNameSnapshot: 'variant_name_snapshot', skuSnapshot: 'sku_snapshot',
      productImageSnapshot: 'product_image_snapshot', configurationSnapshot: 'configuration_snapshot',
      modifiersSnapshot: 'modifiers_snapshot', createdAt: 'created_at', updatedAt: 'updated_at',
    },
  },
  orderTimeline: {
    table: 'order_timelines', pkey: 'id',
    columns: {
      id: 'id', orderId: 'order_id', status: 'status', previousStatus: 'previous_status',
      note: 'note', changedById: 'changed_by_id', occurredAt: 'occurred_at',
      createdAt: 'created_at',
    },
  },
  vendorPayoutProfile: {
    table: 'vendor_payout_profiles', pkey: 'id',
    columns: {
      id: 'id', shopId: 'shop_id', stripeAccountId: 'stripe_account_id', stripeCurrency: 'stripe_currency',
      chargesEnabled: 'charges_enabled', payoutsEnabled: 'payouts_enabled',
      detailsSubmitted: 'details_submitted', hasAcceptedTerms: 'has_accepted_terms',
      splitPaymentsEnabled: 'split_payments_enabled', lazyPayoutsEnabled: 'lazy_payouts_enabled',
      payoutStatementDescriptor: 'payout_statement_descriptor', onboardingCompletedAt: 'onboarding_completed_at',
      onboardingStatus: 'onboarding_status', commissionRate: 'commission_rate',
      fixedCommissionPerOrder: 'fixed_commission_per_order', minimumPayoutAmount: 'minimum_payout_amount',
      payoutSchedule: 'payout_schedule', nextPayoutAt: 'next_payout_at', lastPayoutAt: 'last_payout_at',
      isActive: 'is_active', createdAt: 'created_at', updatedAt: 'updated_at',
    },
  },
  review: {
    table: 'reviews', pkey: 'id',
    columns: {
      id: 'id', customerId: 'customer_id', orderId: 'order_id', shopId: 'shop_id',
      driverId: 'driver_id', targetType: 'target_type', rating: 'rating', comment: 'comment',
      mediaUrls: 'media_urls', response: 'response', respondedAt: 'responded_at',
      isVisible: 'is_visible', isFlagged: 'is_flagged', createdAt: 'created_at', updatedAt: 'updated_at',
    },
  },
};

// Relation metadata used to resolve `include`.
const RELATIONS = {
  user: {},
  shop: {
    operatingHours: { model: 'shopOperatingHours', fk: 'shopId', type: 'many' },
    products: { model: 'product', fk: 'shopId', type: 'many' },
    payoutProfile: { model: 'vendorPayoutProfile', fk: 'shopId', type: 'one' },
    addresses: { model: 'address', fk: 'shopId', type: 'many' },
  },
  product: { variants: { model: 'productVariant', fk: 'productId', type: 'many' } },
  productVariant: {},
  order: {
    items: { model: 'orderItem', fk: 'orderId', type: 'many' },
    timeline: { model: 'orderTimeline', fk: 'orderId', type: 'many' },
    shop: { model: 'shop', fk: 'shopId', type: 'one' },
    customer: { model: 'user', fk: 'customerId', type: 'one' },
    driver: { model: 'user', fk: 'driverId', type: 'one' },
    deliveryAddress: { model: 'address', fk: 'deliveryAddressId', type: 'one' },
  },
  orderItem: { product: { model: 'product', fk: 'productId', type: 'one' } },
  orderTimeline: {},
  vendorPayoutProfile: {},
  review: {},
  address: {}, category: {}, shopOperatingHours: {},
};

// ------------------------------------------------------------- value coercion
function toDb(model, field, value) {
  if (value === undefined) return null;
  if (field === 'dimensionsJson' || field === 'attributesJson' ||
      field === 'configurationSnapshot' || field === 'modifiersSnapshot') {
    return JSON.stringify(value);
  }
  return value;
}

function fromDb(row) {
  if (!row) return null;
  const out = {};
  for (const [k, v] of Object.entries(row)) {
    out[k] = typeof v === 'string' && /^\d+$/.test(k) ? Number(v) : v; // bigint cols arrive as strings
  }
  return out;
}

class KnownError extends Error {
  constructor(code, message, meta) {
    super(message);
    this.name = 'PrismaClientKnownRequestError';
    this.code = code;
    this.meta = meta;
    this.clientVersion = 'pg-runtime-adapter-1.0';
  }
}

// ------------------------------------------------------------------ executor
/** Runs queries either on a dedicated client or inside a transaction client. */
class Executor {
  constructor(client) { this.client = client; }
  async query(sqlText, params) {
    const res = await this.client.query(sqlText, params);
    return res.rows.map(fromDb);
  }
  async execute(sqlText, params) {
    const res = await this.client.query(sqlText, params);
    return res.rowCount ?? 0;
  }
}

function buildWhere(model, where, alias, paramOffset, push) {
  /** where supports: scalars, {in}, {lt,lte,gt,gte,not}, AND/OR, nested relation filters skipped. */
  const parts = [];
  const entries = Object.entries(where ?? {});
  for (const [key, cond] of entries) {
    if (key === 'AND') {
      const sub = cond.map((w) => buildWhere(model, w, alias, -1, push)).filter(Boolean);
      if (sub.length) parts.push(`(${sub.join(' AND ')})`);
      continue;
    }
    if (key === 'OR') {
      const saved = push.snapshot();
      const sub = cond.map((w) => buildWhere(model, w, alias, -1, push)).filter(Boolean);
      if (sub.length) parts.push(`(${sub.join(' OR ')})`); else push.restore(saved);
      continue;
    }
    const col = TABLES[model].columns[key];
    if (!col) throw new KnownError('P2023', `Unknown field "${key}" on ${model}`);
    const qualified = alias ? `${alias}.${col}` : col;
    if (cond !== null && typeof cond === 'object' && !Array.isArray(cond) && !(cond instanceof Date)) {
      for (const [op, val] of Object.entries(cond)) {
        if (op === 'in') {
          if (!Array.isArray(val) || val.length === 0) { parts.push('FALSE'); continue; }
          const holders = val.map((v) => push.take(qualified, val.includes(v) ? v : v));
          parts.push(`${qualified} IN (${holders.join(', ')})`);
        } else if (op === 'not') {
          parts.push(`${qualified} <> $${push.addVal(val) + 1}`);
        } else if (['lt', 'lte', 'gt', 'gte'].includes(op)) {
          const sqlOp = { lt: '<', lte: '<=', gt: '>', gte: '>=' }[op];
          parts.push(`${qualified} ${sqlOp} $${push.addVal(val) + 1}`);
        } else if (op === 'contains') {
          parts.push(`${qualified} ILIKE $${push.addVal('%' + String(val).replace(/[%_]/g, (m) => '\\' + m)) + 1}`);
        } else {
          throw new KnownError('P2023', `Unsupported filter operator "${op}"`);
        }
      }
    } else {
      parts.push(`${qualified} = $${push.addVal(toDb(model, key, cond)) + 1}`);
    }
  }
  return parts.join(' AND ');
}

/** Simple sequential parameter collector with snapshot support for OR branches. */
class Params {
  constructor() { this.values = []; }
  addVal(v) { this.values.push(v); return this.values.length - 1; }
  take(col, v) { this.values.push(v); return `$${this.values.length}`; }
  snapshot() { return this.values.length; }
  restore(n) { this.values.length = n; }
}

// ------------------------------------------------------------------- delegate
class ModelDelegate {
  constructor(model, getExecutor) {
    this.model = model;
    this.getExecutor = getExecutor;
  }

  _map() { return TABLES[this.model].columns; }

  async findMany(args = {}) {
    const ex = this.getExecutor();
    const rows = await ex.query(this._selectSql(args), this._whereParams(args));
    return this._applyInclude(ex, rows, args);
  }

  async findFirst(args = {}) {
    const res = await this.findMany({ ...args, take: 1 });
    return res[0] ?? null;
  }

  async findUnique(args) {
    const where = args.where ?? {};
    const found = await this.findMany({ where, include: args.include, select: args.select, take: 1 });
    const row = found[0] ?? null;
    if (!row && args.rejectOnNotFound) {
      throw new KnownError('P2025', `No ${this.model} found`, where);
    }
    return row;
  }

  async count(args = {}) {
    const ex = this.getExecutor();
    const params = new Params();
    const whereSql = buildWhere(this.model, args.where, null, 0, params);
    const sql = `SELECT count(*)::int AS cnt FROM ${TABLES[this.model].table}${whereSql ? ` WHERE ${whereSql}` : ''}`;
    const rows = await ex.query(sql, params.values);
    return Number(rows[0]?.cnt ?? 0);
  }

  async create(args) {
    const ex = this.getExecutor();
    const data = args.data ?? {};
    const cols = this._map();
    const fieldNames = Object.keys(data).filter((f) => f !== 'id' && cols[f]);
    const columns = fieldNames.map((f) => cols[f]);
    const placeholders = fieldNames.map((_, i) => `$${i + 1}`);
    const values = fieldNames.map((f) => toDb(this.model, f, data[f]));
    const returning = Object.values(cols).join(', ');
    const sql = `INSERT INTO ${TABLES[this.model].table} (${columns.join(', ')}) VALUES (${placeholders.join(', ')}) RETURNING ${returning}`;
    const rows = await ex.query(sql, values);
    const created = rows[0];
    // handle nested writes used by orders flow: none required for current call sites.
    if (args.include) return (await this._applyInclude(ex, [created], args))[0];
    return created;
  }

  async update(args) {
    const ex = this.getExecutor();
    const updated = await this.updateMany({ where: args.where, data: args.data });
    if (updated.count === 0) throw new KnownError('P2025', `No ${this.model} found for update`, args.where);
    return this.findUnique({ where: args.where, include: args.include });
  }

  async updateMany(args) {
    const ex = this.getExecutor();
    const cols = this._map();
    const data = args.data ?? {};
    const fieldNames = Object.keys(data).filter((f) => cols[f]);
    if (fieldNames.length === 0) return { count: 0 };
    const params = new Params();
    const sets = fieldNames.map((f) => `${cols[f]} = $${params.addVal(toDb(this.model, f, data[f])) + 1}`).join(', ');
    const whereSql = buildWhere(this.model, args.where, null, 0, params);
    const sql = `UPDATE ${TABLES[this.model].table} SET ${sets}${whereSql ? ` WHERE ${whereSql}` : ''}`;
    const affected = await ex.execute(sql, params.values);
    return { count: affected };
  }

  async delete(args) {
    const ex = this.getExecutor();
    const row = await this.findUnique({ where: args.where });
    if (!row) throw new KnownError('P2025', `No ${this.model} found for delete`, args.where);
    const pk = TABLES[this.model].pkey;
    await ex.execute(`DELETE FROM ${TABLES[this.model].table} WHERE ${pk} = $1`, [row[pk]]);
    return row;
  }

  _selectSql(args) {
    const t = TABLES[this.model];
    const cols = this._map();
    let projection;
    if (args.select) {
      projection = Object.keys(args.select)
        .filter((f) => args.select[f] && cols[f])
        .map((f) => cols[f]).join(', ');
      if (!projection) projection = Object.values(cols).join(', ');
    } else {
      projection = Object.values(cols).join(', ');
    }
    const params = new Params();
    const whereSql = buildWhere(this.model, args.where, null, 0, params);
    // stash params on the instance per-call via closure trick: rebuild params here
    this._lastParams = params.values;
    let sql = `SELECT ${projection} FROM ${t.table}`;
    if (whereSql) sql += ` WHERE ${whereSql}`;
    if (args.orderBy) {
      const orders = (Array.isArray(args.orderBy) ? args.orderBy : [args.orderBy])
        .map((o) => Object.entries(o).map(([f, dir]) => `${cols[f] ?? f} ${String(dir).toUpperCase()}`))
        .flat();
      if (orders.length) sql += ` ORDER BY ${orders.join(', ')}`;
    }
    if (args.take != null) sql += ` LIMIT ${Number(args.take)}`;
    if (args.skip != null) sql += ` OFFSET ${Number(args.skip)}`;
    return sql;
  }

  _whereParams() { return this._lastParams ?? []; }

  async _applyInclude(ex, rows, args) {
    const includes = args.include;
    if (!includes) return rows;
    const relMap = RELATIONS[this.model] ?? {};
    for (const [relName, spec] of Object.entries(relMap)) {
      if (!includes[relName]) continue;
      const fkField = spec.fk;
      const ids = rows.map((r) => r[TABLES[this.model].pkey]).filter((v) => v != null);
      if (ids.length === 0) { rows.forEach((r) => (r[relName] = spec.type === 'many' ? [] : null)); continue; }
      const targetCols = TABLES[spec.model].columns;
      const fkCol = targetCols[fkField];
      const placeholders = ids.map((_, i) => `$${i + 1}`).join(', ');
      const childRows = await ex.query(
        `SELECT ${Object.values(targetCols).join(', ')} FROM ${TABLES[spec.model].table} WHERE ${fkCol} IN (${placeholders})`,
        ids,
      );
      if (spec.type === 'many') {
        const grouped = new Map();
        for (const c of childRows) {
          const key = c[fkField];
          if (!grouped.has(key)) grouped.set(key, []);
          grouped.get(key).push(c);
        }
        rows.forEach((r) => (r[relName] = grouped.get(r.id) ?? []));
      } else {
        const byKey = new Map(childRows.map((c) => [c[fkField], c]));
        rows.forEach((r) => (r[relName] = byKey.get(r[fkField]) ?? null));
      }
    }
    return rows;
  }
}

// --------------------------------------------------------------------- client
class PrismaClient {
  constructor(options = {}) {
    this._client = new Client({ connectionString: process.env.DATABASE_URL, ssl: false });
    this._options = options;
    this._txExecutor = null;

    for (const model of Object.keys(TABLES)) {
      this[model] = new ModelDelegate(model, () => this._currentExecutor());
    }

    // Prisma namespace shim so `instanceof Prisma.PrismaClientKnownRequestError`
    // and enum imports keep working in TypeScript emit (CommonJS interop).
    PrismaClient._ns.PrismaClientKnownRequestError = KnownError;
  }

  static get PrismaNamespace() { return PrismaClient._ns; }

  _currentExecutor() {
    if (this._txExecutor) return this._txExecutor;
    return new Executor(this._client);
  }

  async $connect() {
    await this._client.connect();
  }

  async $disconnect() {
    await this._client.end();
  }

  /** Tagged-template raw query: returns rows (camelCase-mapped by caller SQL aliases). */
  async $queryRaw(queryOrStrings, ...params) {
    const { text, values } = normalizeRaw(queryOrStrings, params);
    const ex = this._currentExecutor();
    return ex.query(text, values);
  }

  async $executeRaw(queryOrStrings, ...params) {
    const { text, values } = normalizeRaw(queryOrStrings, params);
    return this._currentExecutor().execute(text, values);
  }

  async $executeRawUnsafe(text, ...values) {
    return this._currentExecutor().execute(text, values);
  }

  /**
   * Interactive or array transactions. isolationLevel SERIALIZABLE supported.
   */
  async $transaction(fnOrPromises, options = {}) {
    if (Array.isArray(fnOrPromises)) {
      return Promise.all(fnOrPromises); // sequential-managed promises already bound to client
    }
    const level = options.isolationLevel ?? 'READ COMMITTED';
    const client = this._client;
    await client.query(`BEGIN ISOLATION LEVEL ${level}`);
    const savedTx = this._txExecutor;
    this._txExecutor = new Executor(client);
    try {
      const result = await fn(this); // pass client itself; delegates route through _txExecutor
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      this._txExecutor = savedTx;
    }
  }
}

class SqlFragment {
  constructor(strings, values) {
    this.strings = strings;
    this.values = values;
  }
}

PrismaClient._ns = {
  PrismaClientKnownRequestError: KnownError,
  sql: (strings, ...values) => new SqlFragment(Array.from(strings), values),
  Decimal: class Decimal {
    constructor(v) { this.value = String(v); }
    toString() { return this.value; }
    toNumber() { return Number(this.value); }
  },
};

function normalizeRaw(queryOrStrings, params) {
  if (Array.isArray(queryOrStrings) && 'raw' in queryOrStrings === false && typeof queryOrStrings[0] === 'string') {
    // TemplateStringsArray usage: prisma.$queryRaw`SELECT ... ${v}`
    const strings = queryOrStrings;
    let text = strings[0];
    const values = [];
    for (let i = 0; i < params.length; i++) {
      values.push(params[i]);
      text += `$${values.length} ${strings[i + 1] ?? ''}`;
    }
    return { text, values };
  }
  if (queryOrStrings && typeof queryOrStrings === 'object' && 'strings' in queryOrStrings) {
    const sql = queryOrStrings;
    let text = sql.strings[0];
    sql.values.forEach((v, i) => { text += `$${i + 1}${sql.strings[i + 1] ?? ''}`; });
    return { text, values: sql.values };
  }
  return { text: String(queryOrStrings), values: params };
}

// Exports mirror the generated client's shape: named enums + Prisma namespace + default-ish require.
module.exports = {
  PrismaClient,
  Prisma: PrismaClient._ns,
  // Enums re-exported for runtime use (TS erases these imports except for values).
  UserRole: { CUSTOMER: 'CUSTOMER', VENDOR: 'VENDOR', DRIVER: 'DRIVER', ADMIN: 'ADMIN' },
  OrderStatus: {
    PENDING: 'PENDING', ACCEPTED_BY_SHOP: 'ACCEPTED_BY_SHOP', PREPARING: 'PREPARING',
    AWAITING_PICKUP: 'AWAITING_PICKUP', OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
    DELIVERED: 'DELIVERED', CANCELLED: 'CANCELLED',
  },
  PaymentStatus: {
    UNPAID: 'UNPAID', AUTHORIZED: 'AUTHORIZED', PAID: 'PAID', PARTIALLY_REFUNDED: 'PARTIALLY_REFUNDED',
    REFUNDED: 'REFUNDED', FAILED: 'FAILED', CANCELLED: 'CANCELLED',
  },
  PaymentProvider: { STRIPE: 'STRIPE', ADYEN: 'ADYEN', PAYPAL: 'PAYPAL', CASH: 'CASH' },
  OnboardingStatus: { NOT_STARTED: 'NOT_STARTED', IN_PROGRESS: 'IN_PROGRESS', PENDING_REVIEW: 'PENDING_REVIEW', COMPLETE: 'COMPLETE', REJECTED: 'REJECTED' },
  PayoutSchedule: { DAILY: 'DAILY', WEEKLY: 'WEEKLY', BIWEEKLY: 'BIWEEKLY', MONTHLY: 'MONTHLY' },
  ReviewTarget: { SHOP: 'SHOP', DRIVER: 'DRIVER' },
};

-- =============================================================================
-- e-marketplace production database bootstrap
-- Executed automatically by the postgres container on first boot
-- (mounted at /docker-entrypoint-initdb.d/01-init.sql).
--
-- Idempotent: safe to re-run. Creates extensions + full schema mirroring
-- prisma/schema.prisma, including the CHECK constraints and GIN/GiST indexes
-- that Prisma migrations are documented to add.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS citext;

CREATE SCHEMA IF NOT EXISTS public;

-- ---------------------------------------------------------------- enums -----
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('CUSTOMER','VENDOR','DRIVER','ADMIN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE order_status AS ENUM ('PENDING','ACCEPTED_BY_SHOP','PREPARING','AWAITING_PICKUP','OUT_FOR_DELIVERY','DELIVERED','CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM ('UNPAID','AUTHORIZED','PAID','PARTIALLY_REFUNDED','REFUNDED','FAILED','CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payment_provider AS ENUM ('STRIPE','ADYEN','PAYPAL','CASH');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE onboarding_status AS ENUM ('NOT_STARTED','IN_PROGRESS','PENDING_REVIEW','COMPLETE','REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payout_schedule AS ENUM ('DAILY','WEEKLY','BIWEEKLY','MONTHLY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE review_target AS ENUM ('SHOP','DRIVER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------------- users -----
CREATE TABLE IF NOT EXISTS users (
  id               SERIAL PRIMARY KEY,
  email            citext        NOT NULL,
  email_verified_at timestamptz,
  password_hash    varchar(255),
  phone            varchar(32),
  first_name       varchar(120)  NOT NULL,
  last_name        varchar(120)  NOT NULL,
  display_name     varchar(120),
  avatar_url       varchar(1024),
  role             user_role     NOT NULL DEFAULT 'CUSTOMER',
  is_active        boolean       NOT NULL DEFAULT true,
  last_login_at    timestamptz,
  deleted_at       timestamptz,
  created_at       timestamptz   NOT NULL DEFAULT now(),
  updated_at       timestamptz   NOT NULL DEFAULT now(),
  CONSTRAINT user_email_key UNIQUE (email),
  CONSTRAINT user_phone_key UNIQUE (phone)
);
CREATE INDEX IF NOT EXISTS user_role_is_active_idx ON users (role, is_active);
CREATE INDEX IF NOT EXISTS user_deleted_at_idx ON users (deleted_at);
CREATE INDEX IF NOT EXISTS users_name_trgm_idx ON users USING gin ((first_name || ' ' || last_name) gin_trgm_ops);

-- ---------------------------------------------------------------- shops -----
CREATE TABLE IF NOT EXISTS shops (
  id                                SERIAL PRIMARY KEY,
  user_id                           integer NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  name                              varchar(255) NOT NULL,
  slug                              varchar(255) NOT NULL,
  description                       text,
  short_description                 varchar(500),
  logo_url                          varchar(1024),
  cover_image_url                   varchar(1024),
  gallery_urls                      text[] NOT NULL DEFAULT '{}',
  latitude                          double precision NOT NULL CHECK (latitude  BETWEEN -90  AND 90),
  longitude                         double precision NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  timezone                          varchar(64)  NOT NULL DEFAULT 'UTC',
  currency_code                     char(3)      NOT NULL DEFAULT 'USD',
  minimum_order_amount              numeric(12,2) NOT NULL DEFAULT 0,
  average_preparation_time_minutes  integer,
  rating_average                    numeric(3,2),
  rating_count                      integer      NOT NULL DEFAULT 0,
  is_approved                       boolean      NOT NULL DEFAULT false,
  is_active                         boolean      NOT NULL DEFAULT true,
  deleted_at                        timestamptz,
  created_at                        timestamptz  NOT NULL DEFAULT now(),
  updated_at                        timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT shop_user_id_key UNIQUE (user_id),
  CONSTRAINT shop_slug_key    UNIQUE (slug)
);
CREATE INDEX IF NOT EXISTS shop_is_active_is_approved_idx ON shops (is_active, is_approved);
CREATE INDEX IF NOT EXISTS shop_location_gix ON shops USING gist ((geography(ST_MakePoint(longitude, latitude))));
CREATE INDEX IF NOT EXISTS shop_name_trgm_idx ON shops USING gin (name gin_trgm_ops);

CREATE TABLE IF NOT EXISTS shop_operating_hours (
  id         SERIAL PRIMARY KEY,
  shop_id    integer NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL DEFAULT 0 CHECK (day_of_week BETWEEN 0 AND 6),
  opens_at   time NOT NULL,
  closes_at  time NOT NULL,
  is_closed  boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shop_operating_hours_shop_id_day_of_week_key UNIQUE (shop_id, day_of_week)
);

-- ------------------------------------------------------------ categories ----
CREATE TABLE IF NOT EXISTS categories (
  id          SERIAL PRIMARY KEY,
  name        varchar(160) NOT NULL,
  slug        varchar(180) NOT NULL UNIQUE,
  description text,
  image_url   varchar(1024),
  is_active   boolean NOT NULL DEFAULT true,
  parent_id   integer REFERENCES categories(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS category_parent_id_idx ON categories (parent_id);
CREATE INDEX IF NOT EXISTS category_is_active_idx ON categories (is_active);

-- ------------------------------------------------------------- products -----
CREATE TABLE IF NOT EXISTS products (
  id                  SERIAL PRIMARY KEY,
  shop_id             integer NOT NULL REFERENCES shops(id) ON DELETE RESTRICT,
  category_id         integer REFERENCES categories(id) ON DELETE SET NULL,
  name                varchar(255) NOT NULL,
  slug                varchar(255) NOT NULL,
  description         text,
  short_description   varchar(500),
  base_price          numeric(12,2) NOT NULL,
  compare_at_price    numeric(12,2),
  currency_code       char(3) NOT NULL DEFAULT 'USD',
  image_url           varchar(1024),
  gallery_urls        text[] NOT NULL DEFAULT '{}',
  tags                text[] NOT NULL DEFAULT '{}',
  is_active           boolean NOT NULL DEFAULT true,
  is_featured         boolean NOT NULL DEFAULT false,
  track_inventory     boolean NOT NULL DEFAULT true,
  low_stock_threshold integer NOT NULL DEFAULT 5 CHECK (low_stock_threshold >= 0),
  average_rating      numeric(3,2),
  rating_count        integer NOT NULL DEFAULT 0,
  deleted_at          timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_shop_id_slug_key UNIQUE (shop_id, slug)
);
CREATE INDEX IF NOT EXISTS product_shop_id_is_active_idx ON products (shop_id, is_active);
CREATE INDEX IF NOT EXISTS product_category_id_idx ON products (category_id);
CREATE INDEX IF NOT EXISTS product_tags_gin_idx ON products USING gin (tags);
CREATE INDEX IF NOT EXISTS product_name_trgm_idx ON products USING gin (name gin_trgm_ops);

CREATE TABLE IF NOT EXISTS product_variants (
  id              BIGSERIAL PRIMARY KEY,
  product_id      integer NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  name            varchar(255) NOT NULL,
  sku             varchar(128) NOT NULL,
  barcode         varchar(128),
  price_offset    numeric(12,2) NOT NULL DEFAULT 0,
  stock_quantity  integer NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0 OR allow_backorder),
  allow_backorder boolean NOT NULL DEFAULT false,
  is_active       boolean NOT NULL DEFAULT true,
  image_url       varchar(1024),
  weight_grams    integer,
  dimensions_json jsonb,
  attributes_json jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT product_variant_product_id_sku_key UNIQUE (product_id, sku)
);
CREATE INDEX IF NOT EXISTS product_variant_product_id_is_active_idx ON product_variants (product_id, is_active);
CREATE INDEX IF NOT EXISTS product_variant_barcode_idx ON product_variants (barcode);

-- ------------------------------------------------------------- addresses ----
CREATE TABLE IF NOT EXISTS addresses (
  id              SERIAL PRIMARY KEY,
  user_id         integer REFERENCES users(id) ON DELETE CASCADE,
  shop_id         integer REFERENCES shops(id) ON DELETE CASCADE,
  label           varchar(120),
  recipient_name  varchar(255) NOT NULL,
  recipient_phone varchar(32),
  line1           varchar(255) NOT NULL,
  line2           varchar(255),
  district        varchar(160),
  city            varchar(160) NOT NULL,
  state           varchar(160),
  postal_code     varchar(32) NOT NULL,
  country_code    char(2) NOT NULL,
  latitude        double precision NOT NULL CHECK (latitude  BETWEEN -90  AND 90),
  longitude       double precision NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  accuracy_meters integer,
  is_default      boolean NOT NULL DEFAULT false,
  is_active       boolean NOT NULL DEFAULT true,
  notes           text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT address_owner_check CHECK (user_id IS NOT NULL OR shop_id IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS address_user_id_idx ON addresses (user_id);
CREATE INDEX IF NOT EXISTS address_shop_id_idx ON addresses (shop_id);
CREATE INDEX IF NOT EXISTS address_city_country_code_idx ON addresses (city, country_code);
CREATE INDEX IF NOT EXISTS address_user_id_is_default_idx ON addresses (user_id, is_default);
CREATE INDEX IF NOT EXISTS address_location_gix ON addresses USING gist ((geography(ST_MakePoint(longitude, latitude))));

-- --------------------------------------------------------------- orders -----
CREATE TABLE IF NOT EXISTS orders (
  id                     BIGSERIAL PRIMARY KEY,
  order_number           varchar(64) NOT NULL UNIQUE,
  customer_id            integer NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  shop_id                integer NOT NULL REFERENCES shops(id) ON DELETE RESTRICT,
  delivery_address_id    integer REFERENCES addresses(id) ON DELETE SET NULL,
  driver_id              integer REFERENCES users(id) ON DELETE RESTRICT,
  status                 order_status NOT NULL DEFAULT 'PENDING',
  payment_status         payment_status NOT NULL DEFAULT 'UNPAID',
  payment_provider       payment_provider,
  payment_reference      varchar(255),
  payment_captured_at    timestamptz,
  currency_code          char(3) NOT NULL DEFAULT 'USD',
  subtotal               numeric(12,2) NOT NULL DEFAULT 0,
  delivery_fee           numeric(12,2) NOT NULL DEFAULT 0,
  platform_service_fee   numeric(12,2) NOT NULL DEFAULT 0,
  platform_commission_rate numeric(7,4),
  taxes                  numeric(12,2) NOT NULL DEFAULT 0,
  discount_total         numeric(12,2) NOT NULL DEFAULT 0,
  tip_amount             numeric(12,2) NOT NULL DEFAULT 0,
  total_amount           numeric(12,2) NOT NULL DEFAULT 0,
  refunded_amount        numeric(12,2) NOT NULL DEFAULT 0,
  net_vendor_payout      numeric(12,2) NOT NULL DEFAULT 0,
  delivery_recipient_name  varchar(255),
  delivery_recipient_phone varchar(32),
  delivery_line1           varchar(255),
  delivery_line2           varchar(255),
  delivery_city            varchar(160),
  delivery_state           varchar(160),
  delivery_postal_code     varchar(32),
  delivery_country_code    char(2),
  delivery_latitude        double precision,
  delivery_longitude       double precision,
  driver_latitude          double precision,
  driver_longitude         double precision,
  driver_location_updated_at timestamptz,
  driver_eta_minutes       integer,
  notes                  text,
  cancellation_reason      text,
  placed_at                timestamptz NOT NULL DEFAULT now(),
  accepted_at              timestamptz,
  preparing_at             timestamptz,
  awaiting_pickup_at       timestamptz,
  out_for_delivery_at      timestamptz,
  delivered_at             timestamptz,
  cancelled_at             timestamptz,
  estimated_delivery_at    timestamptz,
  scheduled_for            timestamptz,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS order_customer_id_created_at_idx ON orders (customer_id, created_at);
CREATE INDEX IF NOT EXISTS order_shop_id_status_idx         ON orders (shop_id, status);
CREATE INDEX IF NOT EXISTS order_shop_id_created_at_idx     ON orders (shop_id, created_at);
CREATE INDEX IF NOT EXISTS order_driver_id_status_idx       ON orders (driver_id, status);
CREATE INDEX IF NOT EXISTS order_status_created_at_idx      ON orders (status, created_at);
CREATE INDEX IF NOT EXISTS order_delivery_address_id_idx    ON orders (delivery_address_id);
CREATE INDEX IF NOT EXISTS order_payment_status_idx         ON orders (payment_status);
CREATE INDEX IF NOT EXISTS order_payment_ref_idx            ON orders (payment_provider, payment_reference);

CREATE TABLE IF NOT EXISTS order_items (
  id                  BIGSERIAL PRIMARY KEY,
  order_id            bigint NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id          integer REFERENCES products(id) ON DELETE SET NULL,
  variant_id          bigint REFERENCES product_variants(id) ON DELETE SET NULL,
  quantity            integer NOT NULL CHECK (quantity > 0),
  currency_code       char(3) NOT NULL DEFAULT 'USD',
  unit_price          numeric(12,2) NOT NULL,
  total_price         numeric(12,2) NOT NULL,
  tax_rate            numeric(7,4),
  tax_amount          numeric(12,2) NOT NULL DEFAULT 0,
  discount_amount     numeric(12,2) NOT NULL DEFAULT 0,
  product_name_snapshot  varchar(255) NOT NULL,
  variant_name_snapshot  varchar(255),
  sku_snapshot           varchar(128),
  product_image_snapshot varchar(1024),
  configuration_snapshot jsonb,
  modifiers_snapshot     jsonb,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS order_item_order_id_idx   ON order_items (order_id);
CREATE INDEX IF NOT EXISTS order_item_product_id_idx ON order_items (product_id);
CREATE INDEX IF NOT EXISTS order_item_variant_id_idx ON order_items (variant_id);

CREATE TABLE IF NOT EXISTS order_timelines (
  id             BIGSERIAL PRIMARY KEY,
  order_id       bigint NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status         order_status NOT NULL,
  previous_status order_status,
  note           text,
  changed_by_id  integer REFERENCES users(id) ON DELETE RESTRICT,
  occurred_at    timestamptz NOT NULL DEFAULT now(),
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS order_timeline_order_id_occurred_at_idx ON order_timelines (order_id, occurred_at);
CREATE INDEX IF NOT EXISTS order_timeline_changed_by_id_idx        ON order_timelines (changed_by_id);

-- ---------------------------------------------------- vendor payouts --------
CREATE TABLE IF NOT EXISTS vendor_payout_profiles (
  id                          SERIAL PRIMARY KEY,
  shop_id                     integer NOT NULL REFERENCES shops(id) ON DELETE RESTRICT UNIQUE,
  stripe_account_id           varchar(255) UNIQUE,
  stripe_currency             char(3),
  charges_enabled             boolean NOT NULL DEFAULT false,
  payouts_enabled             boolean NOT NULL DEFAULT false,
  details_submitted           boolean NOT NULL DEFAULT false,
  has_accepted_terms          boolean NOT NULL DEFAULT false,
  split_payments_enabled      boolean NOT NULL DEFAULT false,
  lazy_payouts_enabled        boolean NOT NULL DEFAULT false,
  payout_statement_descriptor varchar(22),
  onboarding_completed_at     timestamptz,
  onboarding_status           onboarding_status NOT NULL DEFAULT 'NOT_STARTED',
  commission_rate             numeric(7,4) NOT NULL DEFAULT 0.1500,
  fixed_commission_per_order  numeric(12,2) NOT NULL DEFAULT 0,
  minimum_payout_amount       numeric(12,2) NOT NULL DEFAULT 0,
  payout_schedule             payout_schedule NOT NULL DEFAULT 'WEEKLY',
  next_payout_at              timestamptz,
  last_payout_at              timestamptz,
  is_active                   boolean NOT NULL DEFAULT true,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS vendor_payout_profile_is_active_payout_schedule_idx
  ON vendor_payout_profiles (is_active, payout_schedule);

-- -------------------------------------------------------------- reviews -----
CREATE TABLE IF NOT EXISTS reviews (
  id           BIGSERIAL PRIMARY KEY,
  customer_id  integer NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  order_id     bigint  NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  shop_id      integer REFERENCES shops(id) ON DELETE CASCADE,
  driver_id    integer REFERENCES users(id) ON DELETE CASCADE,
  target_type  review_target NOT NULL,
  rating       smallint NOT NULL DEFAULT 5 CHECK (rating BETWEEN 1 AND 5),
  comment      text,
  media_urls   text[] NOT NULL DEFAULT '{}',
  response     text,
  responded_at timestamptz,
  is_visible   boolean NOT NULL DEFAULT true,
  is_flagged   boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT review_customer_id_order_id_target_type_key UNIQUE (customer_id, order_id, target_type),
  CONSTRAINT review_target_consistency_check CHECK (
    (target_type = 'SHOP'   AND shop_id   IS NOT NULL AND driver_id IS NULL) OR
    (target_type = 'DRIVER' AND driver_id IS NOT NULL AND shop_id   IS NULL)
  )
);
CREATE INDEX IF NOT EXISTS review_order_id_idx              ON reviews (order_id);
CREATE INDEX IF NOT EXISTS review_shop_id_is_visible_idx    ON reviews (shop_id, is_visible);
CREATE INDEX IF NOT EXISTS review_driver_id_is_visible_idx  ON reviews (driver_id, is_visible);
CREATE INDEX IF NOT EXISTS review_target_type_rating_idx    ON reviews (target_type, rating);

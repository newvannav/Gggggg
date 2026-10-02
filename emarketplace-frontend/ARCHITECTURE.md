# Multi-Vendor Location-Based E-Marketplace — Angular PWA Blueprint

Angular v17+ · standalone components · zoneless signals · @angular/google-maps · rxjs/webSocket.
Companion backend: `/workspace/emarketplace-backend` (NestJS + Prisma, schema as provided).

---

## 1. System Directory & File Tree (single workspace, core/shared/features)

```
emarketplace-frontend/
├── ngsw-config.json                      # §2 production service-worker config
├── src/
│   ├── environments/
│   │   └── environment.ts                # API base URL, Maps keys, WS endpoint
│   └── app/
│       ├── main.ts                       # bootstrapApplication(AppComponent, appConfig)
│       ├── app.config.ts                 # §5 providers: router, SW, HTTP interceptors, Maps token
│       ├── app.component.ts              # shell: cart bar, <router-outlet>, update prompt host
│       ├── core/                         # singleton layer — imported once, never feature-coupled
│       │   ├── pwa/pwa-update.service.ts               # SwUpdate lifecycle + forced hydration reload
│       │   ├── geolocation/geolocation.service.ts      # RxJS navigator.geolocation wrapper (watch/getCurrent)
│       │   ├── config/google-maps.config.ts            # GOOGLE_MAPS_CONFIG token + marker/cluster types
│       │   ├── auth/                                   # AuthService (JWT), role model {id, role} from req.user
│       │   └── interceptors/auth.interceptor.ts        # Bearer attach on /v1/* only
│       ├── shared/                       # dumb/reusable layer — no feature imports allowed
│       │   ├── models/domain.models.ts               # ShopDto/ProductDto/CartLine/OrderTrackingSnapshot ↔ Prisma
│       │   ├── services/toast.service.ts             # signal toast bus
│       │   ├── components/update-notification/…      # bottom-sheet "new version ready" prompt
│       │   └── components/google-map/shop-map.component.ts   # <google-map> wrapper (§4)
│       └── features/                     # three persona silos; lazy-loaded via route `loadComponent`
│           ├── customer/
│           │   ├── discovery/     shop-api.service.ts (GET /v1/shops/nearby) + discovery-page.component.ts
│           │   ├── shops/         shop-detail / product list (add-to-cart entry points)
│           │   ├── cart/          cart-store.service.ts (§6 — single-vendor lock)
│           │   ├── checkout/      POST /v1/orders caller; financial snapshot renderer
│           │   └── tracking/      driver-tracking-socket.service.ts (§7 WS) + order-tracking.component.ts
│           ├── vendor/
│           │   ├── dashboard/     vendor-dashboard.component.ts (order kanban)
│           │   ├── catalog/       product CRUD screens
│           │   ├── orders/        vendor-orders-api.service.ts (accept/PREPARING/AWAITING_PICKUP)
│           │   └── hours/         operating-hours editor (PATCH guarded VENDOR-only server-side)
│           └── driver/
│               ├── jobs/          driver-jobs.component.ts (dispatch board + map)
│               └── delivery/      driver-dispatch.service.ts (§8 GPS heartbeat → PATCH tracking)
```

**Dependency rule:** `features → shared → core`. ESLint boundary enforcement via
`@angular-eslint` + `import/no-restricted-paths`: no cross-persona imports
(e.g. vendor code must never import from `features/customer`), no feature → other-feature imports.

---

## 2. `ngsw-config.json` — Production Service Worker (file included above)

Key decisions:

| Group | Mode | Rationale |
|---|---|---|
| `app` | **prefetch/prefetch** | index.html + hashed bundles pre-cached at install → instant cold start, offline shell |
| `assets` | **lazy/prefetch** | icons/fonts/images fetched on first use, then prefetched on idle — keeps install payload small for mobile data plans |
| `pricing-inventory-freshness` | **freshness**, maxAge 60 s, timeout 5 s | price/stock/nearby/tracking endpoints must never serve stale money data; if network beats the 5 s timeout we always go to origin |
| `shop-profiles-performance` | **performance**, maxAge 6 h | shop metadata changes rarely; cache-first with conservative growth protects quota |
| `user-session` | freshness, 5 m | `/auth/me`, addresses — short-lived personalization cache so a logged-in customer still sees their cart context offline |

⚠️ The SW caches *unauthenticated* GETs only in practice: our API responses for
personalized routes carry `Cache-Control: no-store` set by the Nest backend, which
ngsw honors — this is the documented contract between the two repos.

---

## 3. `PwaUpdateService` (`core/pwa/pwa-update.service.ts`)

- Subscribes `SwUpdate.versionUpdates` filtered to `VERSION_READY` → flips a
  **signal** (`state = 'pending'`) that `UpdateNotificationComponent` renders as
  a bottom sheet ("A new version is ready — Update now / Later").
- Hourly `checkForUpdate()` drift detection + immediate boot check, all outside
  the Angular zone.
- `applyUpdate()` → `activateUpdate()` → `document.location.reload()` — the
  forced hydration pass so the new `index.html` and hashed chunks take over atomically.
- Graceful degradation: disabled SW (dev mode) short-circuits everything; failed
  activation falls back to re-prompting later rather than breaking the session.

---

## 4. Geolocation + Google Maps Layer

**`GeolocationService`** (`core/geolocation/`):
- `getCurrentPosition()` one-shot high-accuracy Observable; `watch()` continuous
  multicast (`shareReplay(1, refCount)`) so discovery map, nearby-query loop and
  driver heartbeat share **one** OS-level watch.
- Permission denial is modeled as state (`status: 'denied'`) + human-readable
  `error$` — UI shows an inline pill instead of throwing.
- Transient failures (POSITION_UNAVAILABLE/TIMEOUT) self-heal with a 5 s re-arm.

**`ShopMapComponent` `<google-map>`** (`shared/components/google-map/`):
- Inputs: `points` (shop markers w/ custom logo icons), `destination` (delivery pin);
  Output: `shopBannerClicked` when a customer taps the info-window banner.
- **Bounding-box grid clustering**: cell size = tile-size/3 scaled by zoom; buckets
  collapse into numbered bubbles when zoomed out, expand on tap (`expandCluster`).
- `pushDriverUpdate(lat, lng)` public API — buffers raw WS coordinates and lerps
  the marker toward the newest fix at ~20 fps (no per-packet snapping/jitter).
- Config injected via `GOOGLE_MAPS_CONFIG` token (apiKey + Map ID for AdvancedMarkerElement).

---

## 5. State Management Strategy

**Chosen: Angular Signals store services (not NgRx).** Justification: only the
cart is genuinely global client-owned state; server data lives in feature-scoped
signals. A full NgRx store would add boilerplate without payoff at this scale —
the pattern below migrates to NgRx mechanically if action-log/devtools requirements appear.

**`CartStore`** (`features/customer/cart/`):
- Invariant **one cart = one vendor shop**: `addLine()` throws
  `MultiVendorCartError(attemptedShopId, lockedShopId)` when mixing stores;
  `AppComponent` traps it globally into a blocking toast. Checkout sends a single-shop order.
- Computed signals: `subtotal`, `itemCount`, `meetsMinimum` (vs `Shop.minimumOrderAmount`).
- Stock ceiling enforced client-side from `ProductVariant.stockQuantity` unless
  `allowBackorder` (`InsufficientStockError`) — the backend transaction remains the source of truth.
- localStorage persistence with private-mode-safe fallbacks; BigInt ids kept as strings.

---

## 6. Real-Time Driver Tracking (customer side)

**`DriverTrackingSocketService`**: `rxjs/webSocket` subject per order id against
`wss://host/ws/tracking?orderId=:id&token=` (JWT via query param — browsers can't
set headers on WS handshakes; the Nest gateway verifies it before joining the room).
Exponential-backoff retry (1 s → 30 s cap), replay-last frame so late subscribers
never miss the current position. All frames handled **outside the zone**; OnPush +
signals keep render cost O(changed markers).

**`OrderTrackingComponent`**: REST bootstrap (`GET /orders/:id/tracking`) for the
authoritative snapshot, then merges streamed `LOCATION_UPDATE`/`STATUS_CHANGE`
frames into the same signal, piping coordinates into `map.pushDriverUpdate()` for
smooth interpolation, plus ETA/status/ticker UI.

---

## 7. Driver Portal Heartbeat

**`DriverDispatchService`**: while `ON_DELIVERY`, buffers the freshest GPS fix and
`PATCH /v1/driver/orders/:id/tracking` every 5 s with `{currentDriverLat, currentDriverLng}`.
403 (role/session) or 409 (order left deliverable status) stops the loop with an
explicit toast; transient network errors simply retry next tick.

---

## 8. Security & Routing Model

- Lazy `loadComponent` routes per persona; JWT attached by `authInterceptor` only to `/v1/*`.
- Role gates are **server-authoritative** (VENDOR-only hours/order edits, DRIVER-only tracking PATCH);
  the client mirrors them for UX, never trusts them.
- Zoneless change detection enabled app-wide — WS/GPS callbacks flow through signals only.

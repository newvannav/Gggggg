import { ApplicationConfig, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter, withComponentInputBinding, withViewTransitions } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { provideServiceWorker } from '@angular/service-worker';
import { GOOGLE_MAPS_CONFIG } from './core/config/google-maps.config';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { environment } from '../environments/environment';

export const appConfig: ApplicationConfig = {
  providers: [
    // Zoneless: the app is signal-driven; WebSockets/geolocation callbacks never
    // need zone.js piggy-backing and this measurably cuts long-tasks on tracking.
    provideZonelessChangeDetection(),
    provideRouter(
      [
        {
          path: 'customer',
          title: 'Marketplace',
          loadComponent: () => import('./features/customer/discovery/discovery-page.component').then((m) => m.DiscoveryPageComponent),
        },
        {
          path: 'customer/orders/:orderId/track',
          title: 'Live delivery tracking',
          loadComponent: () => import('./features/customer/tracking/order-tracking.component').then((m) => m.OrderTrackingComponent),
        },
        {
          path: 'vendor/orders',
          title: 'Vendor orders',
          loadComponent: () => import('./features/vendor/dashboard/vendor-dashboard.component').then((m) => m.VendorDashboardComponent),
        },
        {
          path: 'driver',
          title: 'Driver portal',
          loadComponent: () => import('./features/driver/jobs/driver-jobs.component').then((m) => m.DriverJobsComponent),
        },
        { path: '', pathMatch: 'full', redirectTo: 'customer' },
        { path: '**', redirectTo: 'customer' },
      ],
      withComponentInputBinding(),
      withViewTransitions(),
    ),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
    {
      provide: GOOGLE_MAPS_CONFIG,
      useValue: {
        apiKey: environment.googleMapsApiKey,
        mapsId: environment.googleMapsId,
        languageCode: 'en',
        regionCode: 'US',
      },
    },
    provideServiceWorker('ngsw-worker.js', {
      enabled: environment.production,
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};

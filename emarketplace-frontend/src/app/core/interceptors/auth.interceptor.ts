import { HttpInterceptorFn } from '@angular/common/http';

/**
 * Attaches the JWT issued by POST /v1/auth/login to every API call. The token
 * lives in localStorage behind a tiny accessor so the auth feature owns writes;
 * this interceptor only reads. WebSocket handshakes carry the token as a query
 * param instead (browsers cannot set headers on WS), see DriverTrackingSocketService.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Never leak the marketplace token to Google Maps static requests or 3rd parties.
  const isApiCall = req.url.startsWith('/v1/');
  if (!isApiCall) return next(req);

  let token: string | null = null;
  try {
    token = localStorage.getItem('emarket.jwt');
  } catch {
    token = null;
  }

  const authed = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;
  return next(authed);
};

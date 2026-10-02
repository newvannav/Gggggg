/**
 * Strongly-typed JWT auth principal attached to every authenticated request.
 * Populated by JwtAuthGuard after signature + expiry validation.
 */
export interface AuthPrincipal {
  /** users.id (Int per schema) */
  readonly userId: number;
  readonly role: 'CUSTOMER' | 'VENDOR' | 'DRIVER' | 'ADMIN';
  readonly email: string;
  /** shops.id — present only for VENDOR principals (joined at token issue or lookup) */
  readonly shopId?: number;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthPrincipal;
    }
  }
}

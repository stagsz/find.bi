/**
 * Express type augmentations for authenticated requests.
 *
 * Extends the Express Request interface to include the authenticated
 * user after successful Passport JWT authentication.
 */

import type { AuthenticatedUser } from '../config/passport.config.js';

declare global {
  namespace Express {
    interface User extends AuthenticatedUser {}

    interface Request {
      user?: User;
    }
  }
}

export {};

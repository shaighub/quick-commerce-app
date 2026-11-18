import type { AuthPrincipal } from '../domain/auth.js';

declare module 'express-serve-static-core' {
  interface Request {
    auth?: AuthPrincipal;
  }
}

export {};

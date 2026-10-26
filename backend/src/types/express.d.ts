import type { PublicCustomer } from "../services/auth.service.js";

declare global {
  namespace Express {
    interface Request {
      customer?: PublicCustomer;
      admin?: PublicCustomer;
    }
  }
}

export {};
import "fastify";
import type { preValidationHookHandler } from "fastify";

// Add custom decorators/types to Fastify
declare module "fastify" {
  interface FastifyInstance {
    authenticate: preValidationHookHandler;
  }
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: {
      id: string;
      email: string;
    };
    user: {
      id: string;
      email: string;
      iat?: number;
    };
  }
}

import "fastify";
import type { preValidationHookHandler } from "fastify";
import { Server } from "socket.io"; // <--- Import Server type

declare module "fastify" {
  interface FastifyInstance {
    authenticate: preValidationHookHandler;
    io: Server; // <--- Manually declare io
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
import "fastify";
import type { preValidationHookHandler } from "fastify";
import { Server } from "socket.io";

declare module "fastify" {
  interface FastifyInstance {
    authenticate: preValidationHookHandler;
    io: Server;
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
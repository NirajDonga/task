import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import jwt from '@fastify/jwt';
import { connectDB } from './db';
import { authRoutes } from './routes/auth';
import { uploadRoutes } from './routes/upload'; // <--- 1. Import uploadRoutes
import type { FastifyReply, FastifyRequest } from 'fastify';

const fastify = Fastify({ logger: true });

// Plugins
fastify.register(cors, { origin: '*' });
fastify.register(multipart);
fastify.register(jwt, { secret: 'supersecret-key' });

// 2. DEFINE THE AUTHENTICATE DECORATOR HERE
fastify.decorate("authenticate", async function (request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.send(err);
  }
});

// Routes
fastify.register(authRoutes);
fastify.register(uploadRoutes); // <--- 3. Register the upload routes

const start = async () => {
  try {
    await connectDB();
    await fastify.listen({ port: 3001, host: '0.0.0.0' });
    console.log('🚀 API running on http://localhost:3001');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import jwt from '@fastify/jwt';
import fastifyStatic from '@fastify/static'; 
import path from 'path'; 
import { connectDB } from './db';
import { authRoutes } from './routes/auth';
import { uploadRoutes } from './routes/upload';
import type { FastifyReply, FastifyRequest } from 'fastify';

const fastify = Fastify({ logger: true });

// 1. Plugins
fastify.register(cors, { origin: '*' });
fastify.register(multipart);
fastify.register(jwt, { secret: 'supersecret-key' });

// 2. REGISTER STATIC FILES (Crucial for thumbnails)
fastify.register(fastifyStatic, {
  root: path.join(__dirname, '../../uploads'),
  prefix: '/uploads/', // Access files via http://localhost:3001/uploads/filename.png
});

// 3. Authenticate Decorator
fastify.decorate("authenticate", async function (request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.send(err);
  }
});

// 4. Routes
fastify.register(authRoutes);
fastify.register(uploadRoutes);

const start = async () => {
  try {
    await connectDB();
    await fastify.listen({ port: 3001, host: '0.0.0.0' });
    console.log('API running on http://localhost:3001');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
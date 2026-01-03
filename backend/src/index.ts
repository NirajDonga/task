import Fastify, { FastifyRequest, FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import jwt from '@fastify/jwt';
import fastifyStatic from '@fastify/static';
import fastifySocketIO from 'fastify-socket.io';
import path from 'path';
import { QueueEvents } from 'bullmq';
import { config } from './config';
import { connectDB } from './db';
import { authRoutes } from './routes/auth';
import { uploadRoutes } from './routes/upload';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

const fastify = Fastify({ logger: true });

// FIX: REGISTER MULTIPART WITH LIMITS BEFORE OTHER PLUGINS
fastify.register(multipart, {
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  }
});

fastify.register(cors, { origin: config.corsOrigin });

fastify.register(jwt, { secret: config.jwtSecret });

fastify.register(fastifyStatic, {
  root: path.isAbsolute(config.uploadsDir)
    ? config.uploadsDir
    : path.join(process.cwd(), config.uploadsDir),
  prefix: '/uploads/',
});

// Note: fastifySocketIO registration is moved to start() function
// to wait for Redis connections.

fastify.decorate("authenticate", async function (request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.send(err);
  }
});

fastify.register(authRoutes);
fastify.register(uploadRoutes);

const queueEvents = new QueueEvents('thumbnail-generation', {
  connection: { 
    host: config.redis.host,
    port: config.redis.port,
  }
});

fastify.ready().then(() => {
  queueEvents.on('completed', ({ jobId, returnvalue }) => {
    // Check if io exists to be safe, though it should be ready by now
    if (fastify.io) {
      fastify.io.emit('job-completed', { 
        jobId, 
        status: 'completed', 
        ...(returnvalue as any) 
      });
    }
  });

  queueEvents.on('failed', ({ jobId, failedReason }) => {
    if (fastify.io) {
      fastify.io.emit('job-failed', { jobId, status: 'failed', reason: failedReason });
    }
  });
});

const start = async () => {
  try {
    await connectDB();

    // 1. Create Redis Clients for the Adapter
    const pubClient = createClient({ url: `redis://${config.redis.host}:${config.redis.port}` });
    const subClient = pubClient.duplicate();

    // 2. Connect to Redis
    await Promise.all([pubClient.connect(), subClient.connect()]);

    // 3. Register Socket.IO with the Redis Adapter
    await fastify.register(fastifySocketIO, {
      cors: { origin: "*" },
      adapter: createAdapter(pubClient, subClient)
    });

    // 4. Start the server
    await fastify.listen({ port: config.port, host: '0.0.0.0' });
    console.log(`API & Socket running on http://localhost:${config.port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
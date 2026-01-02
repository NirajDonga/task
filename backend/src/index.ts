import Fastify, { FastifyRequest, FastifyReply } from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import jwt from '@fastify/jwt';
import fastifyStatic from '@fastify/static';
import fastifySocketIO from 'fastify-socket.io';
import path from 'path';
import { QueueEvents } from 'bullmq';
import { connectDB } from './db';
import { authRoutes } from './routes/auth';
import { uploadRoutes } from './routes/upload';

const fastify = Fastify({ logger: true });

// 1. Plugins
fastify.register(cors, { origin: '*' });
fastify.register(multipart);
fastify.register(jwt, { secret: 'supersecret-key' });

// 2. Serve Static Files
fastify.register(fastifyStatic, {
  root: path.join(__dirname, '../../uploads'),
  prefix: '/uploads/',
});

// 3. Register Socket.io
fastify.register(fastifySocketIO, {
  cors: { origin: "*" } 
});

// 4. Authenticate Decorator
fastify.decorate("authenticate", async function (request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.send(err);
  }
});

// 5. Routes
fastify.register(authRoutes);
fastify.register(uploadRoutes);

// 6. Real-Time Logic
const queueEvents = new QueueEvents('thumbnail-generation', {
  connection: { host: 'localhost', port: 6379 }
});

fastify.ready().then(() => {
  queueEvents.on('completed', ({ jobId, returnvalue }) => {
    // 👇 FIX: Cast returnvalue as any to allow spreading
    fastify.io.emit('job-completed', { 
      jobId, 
      status: 'completed', 
      ...(returnvalue as any) 
    });
  });

  queueEvents.on('failed', ({ jobId, failedReason }) => {
    fastify.io.emit('job-failed', { jobId, status: 'failed', reason: failedReason });
  });
});

const start = async () => {
  try {
    await connectDB();
    await fastify.listen({ port: 3001, host: '0.0.0.0' });
    console.log('🚀 API & Socket running on http://localhost:3001');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
import Fastify from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import jwt from '@fastify/jwt';
import { connectDB } from './db';
import { authRoutes } from './routes/auth'; 

const fastify = Fastify({ logger: true });

fastify.register(cors, { origin: '*' });
fastify.register(multipart);
fastify.register(jwt, { secret: 'supersecret-key' });

fastify.register(authRoutes); 

const start = async () => {
  try {
    await connectDB();
    await fastify.listen({ port: 3001, host: '0.0.0.0' });
    console.log('API running on http://localhost:3001');
  } 
  catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
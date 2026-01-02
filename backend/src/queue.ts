import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { config } from './config';

const connection = new IORedis({
  host: config.redis.host,
  port: config.redis.port,
  maxRetriesPerRequest: null,
});

export const thumbnailQueue = new Queue('thumbnail-generation', { connection });
import { Worker, DelayedError } from 'bullmq';
import IORedis from 'ioredis';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import ffmpeg from "fluent-ffmpeg";
import { Job } from './models/Job';
import mongoose from 'mongoose';
import { config } from './config';

const connection = new IORedis({
  host: config.redis.host,
  port: config.redis.port,
  maxRetriesPerRequest: null,
});

mongoose.connect(config.mongoUri)
  .then(() => console.log('Worker connected to MongoDB'))
  .catch(err => console.error('Worker DB connection error:', err));

console.log('Worker started, listening for jobs...');

const worker = new Worker('thumbnail-generation', async (job) => {
  const { jobId, userId, filePath, mimeType } = job.data;
  
  const userLockKey = `lock:user:${userId}`;
  
  const isLocked = await connection.set(userLockKey, 'locked', 'PX', 60000, 'NX');

  if (!isLocked) {
    await job.moveToDelayed(Date.now() + 2000, job.token);
    throw new DelayedError(); 
  }

  try {
    console.log(`Processing Job ${jobId} for User ${userId}`);
    await Job.findByIdAndUpdate(jobId, { status: 'processing' });

    const outputFilename = `thumb-${path.basename(filePath, path.extname(filePath))}.png`;
    const outputPath = path.join(path.dirname(filePath), outputFilename);

    if (mimeType.startsWith('image/')) {
      await sharp(filePath)
        .resize(128, 128) 
        .toFile(outputPath);
    } 
    else if (mimeType.startsWith('video/')) {
      await new Promise((resolve, reject) => {
        ffmpeg(filePath)
          .screenshots({
            count: 1,
            folder: path.dirname(filePath),
            filename: outputFilename,
            size: '128x128'
          })
          .on('end', resolve)
          .on('error', reject);
      });
    }

    await Job.findByIdAndUpdate(jobId, { 
      status: 'completed', 
      thumbnailUrl: `/uploads/${outputFilename}` 
    });
    
    console.log(`Job ${jobId} Completed`);

    return { thumbnailUrl: `/uploads/${outputFilename}` };

  } catch (error) {
    console.error(`Job ${jobId} Failed:`, error);
    await Job.findByIdAndUpdate(jobId, { status: 'failed' });
    
    throw error;
  } finally {
    await connection.del(userLockKey);
  }

}, { 
  connection,
  concurrency: 5 
});

export default worker;
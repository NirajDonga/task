import { Worker, DelayedError } from 'bullmq';
import IORedis from 'ioredis';
import path from 'path';
import sharp from 'sharp';
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static"; 
import { path as ffprobePath } from "ffprobe-static";

import { Job } from './models/Job';
import mongoose from 'mongoose';
import { config } from './config';
// import { thumbnailQueue, conversionQueue } from './queue';

if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath as any);
} else {
  console.error("Failed to find ffmpeg-static path");
}

if (ffprobePath) {
  ffmpeg.setFfprobePath(ffprobePath);
} else {
  console.error("Failed to find ffprobe-static path");
}

const connection = new IORedis({
  host: config.redis.host,
  port: config.redis.port,
  maxRetriesPerRequest: null,
});

mongoose.connect(config.mongoUri)
  .then(() => console.log('Worker connected to MongoDB'))
  .catch(err => console.error('Worker DB connection error:', err));

console.log('Worker started, listening for jobs...');

const thumbnailWorker = new Worker('thumbnail-generation', async (job) => {
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
      const metadata = await new Promise<any>((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, data) => {
          if (err) reject(err);
          else resolve(data);
        });
      });

      const duration = metadata.format.duration || 0;
      const midPoint = duration / 2; 

      console.log(`Video duration: ${duration}s, taking screenshot at: ${midPoint}s`);

      await new Promise((resolve, reject) => {
        ffmpeg(filePath)
          .screenshots({
            count: 1,
            timemarks: [midPoint], 
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

const conversionWorker = new Worker('media-conversion', async (job) => {
  const { jobId, userId, filePath, mimeType } = job.data;
  const userLockKey = `lock:user:${userId}`;
  
  const isLocked = await connection.set(userLockKey, 'locked', 'PX', 60000, 'NX');
  if (!isLocked) {
    await job.moveToDelayed(Date.now() + 2000, job.token);
    throw new DelayedError(); 
  }

  try {
    console.log(`Processing Conversion Job ${jobId}`);
    await Job.findByIdAndUpdate(jobId, { status: 'processing' });

    const isImage = mimeType.startsWith('image/');
    const ext = isImage ? 'webp' : 'webm';
    const outputFilename = `converted-${path.basename(filePath, path.extname(filePath))}.${ext}`;
    const outputPath = path.join(path.dirname(filePath), outputFilename);

    if (isImage) {
      // Convert Image to WebP
      await sharp(filePath)
        .toFormat('webp')
        .toFile(outputPath);
    } 
    else if (mimeType.startsWith('video/')) {
      // Convert Video to WebM
      await new Promise((resolve, reject) => {
        ffmpeg(filePath)
          .output(outputPath)
          .format('webm')
          .videoCodec('libvpx-vp9') 
          .audioCodec('libopus')
          .on('end', resolve)
          .on('error', reject)
          .run();
      });
    }

    const fileUrl = `/uploads/${outputFilename}`;

    await Job.findByIdAndUpdate(jobId, { 
      status: 'completed', 
      convertedUrl: fileUrl 
    });
    
    return { convertedUrl: fileUrl, jobId };

  } catch (error) {
    console.error(`Conversion Job ${jobId} Failed:`, error);
    await Job.findByIdAndUpdate(jobId, { status: 'failed' });
    throw error;
  } finally {
    await connection.del(userLockKey);
  }
}, { connection, concurrency: 2 });

export default { thumbnailWorker, conversionWorker };
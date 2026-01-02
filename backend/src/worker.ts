import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import ffmpeg from "fluent-ffmpeg";
import { Job } from './models/Job';
import mongoose from 'mongoose';

const connection = new IORedis({
  host: 'localhost', 
  port: 6379,
  maxRetriesPerRequest: null,
});

mongoose.connect('mongodb://localhost:27017/thumbnail-app');

console.log('Worker started, listening for jobs...');

const worker = new Worker('thumbnail-generation', async (job) => {
  const { jobId, filePath, mimeType } = job.data;
  console.log(`Processing Job ${jobId}`);

  await Job.findByIdAndUpdate(jobId, { status: 'processing' });

  try {
    const outputFilename = `thumb-${path.basename(filePath, path.extname(filePath))}.png`;
    const outputPath = path.join(path.dirname(filePath), outputFilename);

    if (mimeType.startsWith('image/')) {
      await sharp(filePath)
        .resize(200, 200)
        .toFile(outputPath);
    } 
    else if (mimeType.startsWith('video/')) {
      await new Promise((resolve, reject) => {
        ffmpeg(filePath)
          .screenshots({
            count: 1,
            folder: path.dirname(filePath),
            filename: outputFilename,
            size: '200x200'
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

  } catch (error) {
    console.error(`Job ${jobId} Failed:`, error);
    await Job.findByIdAndUpdate(jobId, { status: 'failed' });
  }

}, { connection });

export default worker;
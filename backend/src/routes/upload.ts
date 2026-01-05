import { FastifyInstance } from 'fastify';
import fs from 'fs';
import path from 'path';
import util from 'util';
import { pipeline } from 'stream';
import { Job } from '../models/Job';
import { thumbnailQueue, conversionQueue } from '../queue';

const pump = util.promisify(pipeline);

export async function uploadRoutes(fastify: FastifyInstance) {
  
  const uploadDir = path.join(__dirname, '../../uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  // Route 1: Thumbnail Upload
  fastify.post('/upload', {
    preValidation: [fastify.authenticate] 
  }, async (request, reply) => {
    
    const parts = request.parts();
    const jobsCreated = [];
    let hasFiles = false;

    for await (const part of parts) {
      if (part.type === 'file') {
        hasFiles = true;
        const filename = `${Date.now()}-${Math.round(Math.random() * 1000)}-${part.filename}`;
        const savePath = path.join(uploadDir, filename);
  
        await pump(part.file, fs.createWriteStream(savePath));
        const userId = request.user.id;

        const job = await Job.create({
          userId,
          originalName: part.filename,
          filePath: savePath,
          mimeType: part.mimetype,
          type: 'thumbnail',
          status: 'queued'
        });

        await thumbnailQueue.add('generate-thumbnail', {
          jobId: job._id.toString(),
          userId: userId.toString(),
          filePath: savePath,
          mimeType: part.mimetype
        }, {
          jobId: job._id.toString() 
        });

        jobsCreated.push({ jobId: job._id, originalName: part.filename });
      }
    }

    if (!hasFiles) return reply.code(400).send({ message: 'No files uploaded' });
    return { message: 'Files uploaded', jobs: jobsCreated };
  });

  // Route 2: Get Jobs
  fastify.get('/jobs', {
    preValidation: [fastify.authenticate]
  }, async (request) => {
    const userId = request.user.id;
    const jobs = await Job.find({ userId }).sort({ createdAt: -1 });
    return jobs;
  });

  // Route 3: Media Conversion (POST) - This handles the actual upload
  fastify.post('/convert', {
    preValidation: [fastify.authenticate] 
  }, async (request, reply) => {
    const parts = request.parts();
    const jobsCreated = [];
    let hasFiles = false;

    for await (const part of parts) {
      if (part.type === 'file') {
        hasFiles = true;
        const filename = `${Date.now()}-${Math.round(Math.random() * 1000)}-${part.filename}`;
        const savePath = path.join(uploadDir, filename);
  
        await pump(part.file, fs.createWriteStream(savePath));
        const userId = request.user.id;

        const job = await Job.create({
          userId,
          originalName: part.filename,
          filePath: savePath,
          mimeType: part.mimetype,
          type: 'conversion', 
          status: 'queued'
        });

        await conversionQueue.add('convert-media', {
          jobId: job._id.toString(),
          userId: userId.toString(),
          filePath: savePath,
          mimeType: part.mimetype
        }, { jobId: job._id.toString() });

        jobsCreated.push({ jobId: job._id, originalName: part.filename });
      }
    }

    if (!hasFiles) return reply.code(400).send({ message: 'No files uploaded' });
    return { message: 'Conversion started', jobs: jobsCreated };  
  });

  // Route 4: Media Conversion Check (GET) - NEW! 
  // This fixes the "Route not found" error if you visit the link in the browser.
  fastify.get('/convert', async (request, reply) => {
    return { message: "Converter API is running. Use POST to upload files." };
  });
}
import { FastifyInstance } from 'fastify';
import fs from 'fs';
import path from 'path';
import util from 'util';
import { pipeline } from 'stream';
import { Job } from '../models/Job';
import { thumbnailQueue } from '../queue';
import { config } from '../config';

const pump = util.promisify(pipeline);

export async function uploadRoutes(fastify: FastifyInstance) {
  
  const uploadDir = path.isAbsolute(config.uploadsDir)
    ? config.uploadsDir
    : path.join(process.cwd(), config.uploadsDir);
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  fastify.post('/upload', {
    preValidation: [fastify.authenticate] 
  }, async (request, reply) => {
    
    const data = await request.file();
    if (!data) {
      return reply.code(400).send({ message: 'No file uploaded' });
    }

    const filename = `${Date.now()}-${data.filename}`;
    const savePath = path.join(uploadDir, filename);
    await pump(data.file, fs.createWriteStream(savePath));

    const userId = request.user.id;
    
    const job = await Job.create({
      userId,
      originalName: data.filename,
      filePath: savePath,
      mimeType: data.mimetype,
      status: 'queued'
    });

    await thumbnailQueue.add('generate-thumbnail', {
      jobId: job._id.toString(),
      filePath: savePath,
      mimeType: data.mimetype
    });

    return { message: 'File uploaded', jobId: job._id };
  });

  fastify.get('/jobs', {
    preValidation: [fastify.authenticate]
  }, async (request) => {
    const userId = request.user.id;
    const jobs = await Job.find({ userId }).sort({ createdAt: -1 });
    return jobs;
  });
}
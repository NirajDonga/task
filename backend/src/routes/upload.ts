import { FastifyInstance } from 'fastify';
import fs from 'fs';
import path from 'path';
import util from 'util';
import { pipeline } from 'stream';
import { Job } from '../models/Job';
import { thumbnailQueue } from '../queue';

const pump = util.promisify(pipeline);

export async function uploadRoutes(fastify: FastifyInstance) {
  
  const uploadDir = path.join(__dirname, '../../uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

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

        jobsCreated.push({ 
          jobId: job._id, 
          originalName: part.filename 
        });
      } else {
        console.log(`Skipping non-file field: ${part.fieldname}`);
      }
    }

    if (!hasFiles) {
      return reply.code(400).send({ message: 'No files uploaded' });
    }

    return { message: 'Files uploaded', jobs: jobsCreated };
  });

  fastify.get('/jobs', {
    preValidation: [fastify.authenticate]
  }, async (request) => {
    const userId = request.user.id;
    const jobs = await Job.find({ userId }).sort({ createdAt: -1 });
    return jobs;
  });
}
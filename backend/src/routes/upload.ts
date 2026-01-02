import { FastifyInstance } from 'fastify';
import fs from 'fs';
import path from 'path';
import util from 'util'; // <--- CORRECTED LINE
import { pipeline } from 'stream';
import { Job } from '../models/Job';
import { thumbnailQueue } from '../queue';

const pump = util.promisify(pipeline);

export async function uploadRoutes(fastify: FastifyInstance) {
  
  // Create 'uploads' folder if it doesn't exist
  const uploadDir = path.join(__dirname, '../../uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  fastify.post('/upload', {
    // 1. Protect this route (User must be logged in)
    preValidation: [fastify.authenticate] 
  }, async (request, reply) => {
    
    // 2. Get the file from the request
    const data = await request.file();
    if (!data) {
      return reply.code(400).send({ message: 'No file uploaded' });
    }

    // 3. Save file to disk
    const filename = `${Date.now()}-${data.filename}`;
    const savePath = path.join(uploadDir, filename);
    await pump(data.file, fs.createWriteStream(savePath));

    // 4. Create Job in Database
    const userId = request.user.id;
    
    const job = await Job.create({
      userId,
      originalName: data.filename,
      filePath: savePath,
      mimeType: data.mimetype,
      status: 'queued'
    });

    // 5. Add to BullMQ Queue
    await thumbnailQueue.add('generate-thumbnail', {
      jobId: job._id.toString(),
      filePath: savePath,
      mimeType: data.mimetype
    });

    return { message: 'File uploaded', jobId: job._id };
  });

  // GET route to fetch all jobs for the dashboard
  fastify.get('/jobs', {
    preValidation: [fastify.authenticate]
  }, async (request) => {
    const userId = request.user.id;
    const jobs = await Job.find({ userId }).sort({ createdAt: -1 });
    return jobs;
  });
}
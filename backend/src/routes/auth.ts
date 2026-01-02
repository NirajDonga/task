import { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { User } from '../models/User';

export async function authRoutes(fastify: FastifyInstance) {
  
  fastify.post('/signup', async (request, reply) => {
    const { email, password } = request.body as any;

    const existing = await User.findOne({ email });
    if (existing) {
      return reply.code(400).send({ message: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ email, password: hashedPassword });
    
    return { message: 'User created', userId: user._id };
  });

  fastify.post('/login', async (request, reply) => {
    const { email, password } = request.body as any;

    const user = await User.findOne({ email });
    if (!user) {
      return reply.code(401).send({ message: 'Invalid email or password' });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return reply.code(401).send({ message: 'Invalid email or password' });
    }

    const token = fastify.jwt.sign({ id: user._id.toString(), email: user.email });

    return { token };
  });
}
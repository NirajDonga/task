import 'dotenv/config';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optionalEnv(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

function optionalInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid integer for environment variable ${name}: ${raw}`);
  }
  return parsed;
}

export const config = {
  nodeEnv: optionalEnv('NODE_ENV', 'development'),
  port: optionalInt('PORT', 3001),
  corsOrigin: optionalEnv('CORS_ORIGIN', '*'),

  jwtSecret: requireEnv('JWT_SECRET'),

  mongoUri: requireEnv('MONGO_URI'),

  redis: {
    host: requireEnv('REDIS_HOST'),
    port: optionalInt('REDIS_PORT', 6379),
  },

  uploadsDir: optionalEnv('UPLOADS_DIR', 'uploads'),
};

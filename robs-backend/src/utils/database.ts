import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { logger } from '@/utils/logger';

declare global {
  var __prisma: PrismaClient | undefined;
}

// Setup driver adapter for Prisma 7
const databaseUrl = process.env.DATABASE_URL?.replace(/^"|"$/g, '').trim();

if (!databaseUrl) {
  logger.error('DATABASE_URL is not defined in environment variables');
} else {
  logger.info(`DATABASE_URL connection string: ${databaseUrl.replace(/:[^:@]*@/, ':****@')}`);
}

const pool = new Pool({ connectionString: databaseUrl });

pool.query('SELECT 1')
  .then(() => logger.info('✅ Direct PG Pool connection successful'))
  .catch(err => logger.error('❌ Direct PG Pool connection failed:', err));
const adapter = new PrismaPg(pool);

// Prevent multiple instances of Prisma Client in development
const prisma = globalThis.__prisma || new PrismaClient({
  adapter,
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],

} as any);

if (process.env.NODE_ENV === 'development') {
  globalThis.__prisma = prisma;
}

// Database connection helper
export const connectDatabase = async (): Promise<void> => {
  try {
    await prisma.$connect();
    logger.info('Database connected successfully');

    // Validate connection is actually working
    await prisma.$queryRaw`SELECT 1`;
    logger.info('✅ Database readiness check passed');
  } catch (error) {
    console.error('❌ FATAL: Database connection failed:', error); // Ensure visibility
    logger.error('❌ Database connection failed:', error);
    logger.error('-> Check if your database container is running');
    logger.error('-> Verify DATABASE_URL in .env');
    logger.error('-> Ensure database server is accessible');
    process.exit(1);
  }
};

// Database disconnection helper
export const disconnectDatabase = async (): Promise<void> => {
  try {
    await prisma.$disconnect();
    logger.info('Database disconnected successfully');
  } catch (error) {
    logger.error('Database disconnection failed:', error);
  }
};

// Health check helper
export const checkDatabaseHealth = async (): Promise<boolean> => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    logger.error('Database health check failed:', error);
    return false;
  }
};

export default prisma;

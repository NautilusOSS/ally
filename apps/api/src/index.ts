import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from 'dotenv';
import { quoteRoutes } from './routes/quote';
import { healthRoutes } from './routes/health';

// Load environment variables
config();

const fastify = Fastify({
  logger: true,
});

// Register CORS
fastify.register(cors, {
  origin: true,
});

// Register routes
fastify.register(quoteRoutes, { prefix: '/api' });
fastify.register(healthRoutes, { prefix: '/api' });

const start = async () => {
  try {
    const port = parseInt(process.env.API_PORT || '3001');
    await fastify.listen({ port, host: '0.0.0.0' });
    console.log(`🚀 Ally API server running on port ${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();

import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { Router } from '@ally/sdk';

const router = new Router();

interface QuoteParams {
  from: string;
  to: string;
  amount: string;
  slippageBps?: string;
}

export async function quoteRoutes(fastify: FastifyInstance) {
  fastify.get<{
    Querystring: QuoteParams;
  }>('/quote', async (request: FastifyRequest<{ Querystring: QuoteParams }>, reply: FastifyReply) => {
    try {
      const { from, to, amount, slippageBps = '50' } = request.query;

      // Validate required parameters
      if (!from || !to || !amount) {
        return reply.status(400).send({
          error: 'Missing required parameters: from, to, amount',
        });
      }

      // Validate amount is a positive number
      const amountNum = parseFloat(amount);
      if (isNaN(amountNum) || amountNum <= 0) {
        return reply.status(400).send({
          error: 'Amount must be a positive number',
        });
      }

      // Validate slippage
      const slippageNum = parseInt(slippageBps);
      if (isNaN(slippageNum) || slippageNum < 0 || slippageNum > 10000) {
        return reply.status(400).send({
          error: 'Slippage must be between 0 and 10000 basis points',
        });
      }

      // Get the best quote
      const quote = await router.getBestQuote(from, to, amount, slippageNum);

      return reply.send(quote);
    } catch (error) {
      fastify.log.error(error);
      
      if (error instanceof Error) {
        return reply.status(400).send({
          error: error.message,
        });
      }
      
      return reply.status(500).send({
        error: 'Internal server error',
      });
    }
  });
}

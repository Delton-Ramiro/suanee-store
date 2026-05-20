import fp from 'fastify-plugin'
import rateLimit from '@fastify/rate-limit'
import type { FastifyInstance } from 'fastify'
import { redis } from '../lib/redis.js'

export default fp(async function rateLimitPlugin(fastify: FastifyInstance) {
  fastify.register(rateLimit, {
    global: true,
    max: 300,
    timeWindow: '1 minute',
    redis,
    keyGenerator: (req) => {
      return req.headers['x-forwarded-for']?.toString() ?? req.ip
    },
    errorResponseBuilder: () => ({
      error: 'Too many requests',
      statusCode: 429,
    }),
  })
})

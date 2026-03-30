import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { Redis } = await import('@upstash/redis');
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;

    if (!url || !token) {
      return res.status(200).json({
        status: 'no-redis',
        hasUrl: !!url,
        hasToken: !!token,
        envKeys: Object.keys(process.env).filter(k => k.includes('UPSTASH') || k.includes('REDIS')),
      });
    }

    const redis = new Redis({ url, token });

    // If ?fix=1 is passed, delete the bad key
    if (req.query.fix === '1') {
      await redis.del('campaigns:index');
      return res.status(200).json({ status: 'fixed', message: 'Deleted campaigns:index key' });
    }

    const keyType = await redis.type('campaigns:index');
    const ping = await redis.ping();

    return res.status(200).json({ status: 'ok', ping, keyType, redisUrl: url.substring(0, 30) + '...' });
  } catch (error) {
    return res.status(200).json({
      status: 'error',
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack?.split('\n').slice(0, 5) : undefined,
    });
  }
}

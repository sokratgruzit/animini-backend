import { Router } from 'express';
import { authMiddleware } from '../middleware/auth-middleware';
import { eventService } from '../services/event-service';

const router = Router();

/**
 * SSE Connection Endpoint
 */
router.get('/subscribe', authMiddleware, (req: any, res) => {
  // 1. Set explicit headers to disable all forms of buffering
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no', // Critical for Nginx / Proxies
    'Transfer-Encoding': 'chunked',
  });

  // 2. Immediate flush to "open" the stream for the browser
  res.write(': ok\n\n');

  // Optional: Send initial connection event to confirm it works
  res.write(`data: ${JSON.stringify({ type: 'CONNECTED', data: true })}\n\n`);

  // 3. Keep-alive heartbeat
  const keepAlive = setInterval(() => {
    res.write(': keep-alive\n\n');

    // Some environments require manual flush
    if ((res as any).flush) (res as any).flush();
  }, 30000);

  // 4. Register connection
  eventService.addConnection(req.userId, res);

  // 5. Clean up
  res.on('close', () => {
    clearInterval(keepAlive);
    res.end();
  });
});

export default router;

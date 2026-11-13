import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { apiRouter } from './server/routes/api';
import path from 'path';
import { fileURLToPath } from 'url';
import { appDb } from './server/db/sqlite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createApp() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Convert body-parser parse errors to JSON so the API never returns HTML error pages
  app.use((err: any, req: any, res: any, next: any) => {
    if (err?.type === 'entity.parse.failed' || err?.status === 400 || err?.statusCode === 400) {
      return res.status(400).json({
        error: 'Malformed JSON request body',
        detail: err?.message || 'Invalid JSON',
        path: req.originalUrl,
      });
    }
    next(err);
  });

  // Mount API endpoints
  app.use('/api/v1', apiRouter);

  return app;
}

async function startServer() {
  const app = createApp();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  const isProd = process.env.NODE_ENV === 'production';

  // Ensure database is initialized and seeded before serving
  try {
    const assetCount = appDb.selectOne<{ c: number }>('SELECT COUNT(*) AS c FROM assets')!.c;
    console.log(`[HengSeng Agent] Database initialized: ${assetCount} assets in SQLite store.`);
  } catch (err) {
    console.error('[HengSeng Agent] Database initialization warning:', (err as Error)?.message || err);
  }

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);

    app.get('/', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'index.html'));
    });
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'index.html'));
    });
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('/', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[HengSeng Agent] Server listening on http://0.0.0.0:${PORT}`);
    console.log(`[HengSeng Agent] REST API mounted at http://0.0.0.0:${PORT}/api/v1`);
  });

  app.use((err: any, req: any, res: any, next: any) => {
    console.error(`[HengSeng Agent] Request error on ${req.method} ${req.originalUrl}:`, err?.message || err);
    if (res.headersSent) return next(err);
    const status =
      err?.type === 'entity.parse.failed' || err?.status === 400 || err?.statusCode === 400
        ? 400
        : err?.status || err?.statusCode || 500;
    res.status(status).json({
      error: status === 400 ? 'Malformed JSON request body' : 'Internal server error',
      detail: err?.message || 'Unknown error',
      path: req.originalUrl,
    });
  });
}

export { createApp, startServer };

// Only start listening when run directly (not when imported by tests)
if (import.meta.main) {
  startServer().catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}

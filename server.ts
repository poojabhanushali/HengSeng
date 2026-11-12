import express from 'express';
import { createServer as createViteServer } from 'vite';
import { apiRouter } from './server/routes/api';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  const isProd = process.env.NODE_ENV === 'production';

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Mount API endpoints
  app.use('/api/v1', apiRouter);

  if (!isProd) {
    // Development mode: Vite middleware
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);

    // Root route: serve the SPA entry point explicitly so GET / always resolves
    app.get('/', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'index.html'));
    });
    // SPA fallback: serve index.html for all non-API routes so page refreshes work
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'index.html'));
    });
  } else {
    // Production mode: static files
    app.use(express.static(path.resolve(__dirname, 'dist')));
    // Root route: serve the SPA entry point explicitly so GET / always resolves
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

  // Centralized error handler: unexpected route/handler failures return JSON, never an HTML stack trace
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
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

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

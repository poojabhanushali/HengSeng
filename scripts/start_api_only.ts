import { createApp } from '../server.ts';
const app = createApp();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`API-only server listening on http://0.0.0.0:${PORT}`);
});

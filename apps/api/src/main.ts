import express from 'express';

const app = express();
const port = process.env.PORT || 4000;

app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'hazop-api' });
});

app.get('/', (_req, res) => {
  res.json({ message: 'HazOp Assistant API' });
});

app.listen(port, () => {
  console.log(`API server running on port ${port}`);
});

export default app;

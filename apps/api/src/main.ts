import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.routes.js';
import usersRoutes from './routes/users.routes.js';
import adminRoutes from './routes/admin.routes.js';
import projectsRoutes from './routes/projects.routes.js';
import documentsRoutes from './routes/documents.routes.js';
import nodesRoutes from './routes/nodes.routes.js';
import guideWordsRoutes from './routes/guide-words.routes.js';
import preparedCausesRoutes from './routes/prepared-causes.routes.js';
import preparedConsequencesRoutes from './routes/prepared-consequences.routes.js';
import preparedSafeguardsRoutes from './routes/prepared-safeguards.routes.js';
import preparedRecommendationsRoutes from './routes/prepared-recommendations.routes.js';
import analysesRoutes from './routes/analyses.routes.js';
import entriesRoutes from './routes/entries.routes.js';
import { configurePassport, initializePassport } from './config/passport.config.js';

// Load .env from project root (two levels up from this file)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '..', '..', '..', '.env') });

const app = express();
const port = process.env.PORT || 4000;

// Enable CORS for frontend requests
// In development, allow all localhost origins
const corsOrigin = process.env.NODE_ENV === 'production'
  ? process.env.FRONTEND_URL
  : /^http:\/\/localhost:\d+$/;

app.use(cors({
  origin: corsOrigin,
  credentials: true,
}));

app.use(express.json());

// Initialize Passport JWT authentication (only if JWT keys are configured)
if (process.env.JWT_PRIVATE_KEY && process.env.JWT_PUBLIC_KEY) {
  configurePassport();
  app.use(initializePassport());
}

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'hazop-api' });
});

// API info endpoint
app.get('/', (_req, res) => {
  res.json({ message: 'HazOp Assistant API' });
});

// Authentication routes
app.use('/auth', authRoutes);

// User routes
app.use('/users', usersRoutes);

// Admin routes
app.use('/admin', adminRoutes);

// Project routes
app.use('/projects', projectsRoutes);

// Document routes
app.use('/documents', documentsRoutes);

// Node routes
app.use('/nodes', nodesRoutes);

// Guide Words routes
app.use('/guide-words', guideWordsRoutes);

// Prepared Causes routes
app.use('/prepared-causes', preparedCausesRoutes);

// Prepared Consequences routes
app.use('/prepared-consequences', preparedConsequencesRoutes);

// Prepared Safeguards routes
app.use('/prepared-safeguards', preparedSafeguardsRoutes);

// Prepared Recommendations routes
app.use('/prepared-recommendations', preparedRecommendationsRoutes);

// Analyses routes
app.use('/analyses', analysesRoutes);

// Entries routes
app.use('/entries', entriesRoutes);

// Only start the server when this file is run directly (not imported for testing)
const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);
if (isMainModule) {
  app.listen(port, () => {
    console.log(`API server running on port ${port}`);
  });
}

export default app;

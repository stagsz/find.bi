import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createServer } from 'http';
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
import sessionsRoutes from './routes/sessions.routes.js';
import reportsRoutes from './routes/reports.routes.js';
import templatesRoutes from './routes/templates.routes.js';
import { configurePassport, initializePassport } from './config/passport.config.js';
import { getWebSocketService } from './services/websocket.service.js';
import { metricsMiddleware, getMetrics, getMetricsContentType, requestLogger } from './middleware/index.js';
import { performHealthCheck, checkReadiness, checkLiveness } from './services/health.service.js';
import { setupSwagger } from './config/swagger.config.js';
import log from './utils/logger.js';

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

// Prometheus metrics middleware - must be early in the chain
app.use(metricsMiddleware);

// Request logging middleware
app.use(requestLogger);

app.use(express.json());

// Initialize Passport JWT authentication (only if JWT keys are configured)
if (process.env.JWT_PRIVATE_KEY && process.env.JWT_PUBLIC_KEY) {
  configurePassport();
  app.use(initializePassport());
}

// Health check endpoints

/**
 * Comprehensive health check - checks all service dependencies.
 * Returns 200 if healthy/degraded, 503 if unhealthy.
 */
app.get('/health', async (_req, res) => {
  try {
    const health = await performHealthCheck();
    const statusCode = health.status === 'unhealthy' ? 503 : 200;
    res.status(statusCode).json(health);
  } catch (error) {
    log.error('Health check failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(503).json({
      status: 'unhealthy',
      version: process.env.npm_package_version || '0.0.1',
      timestamp: new Date().toISOString(),
      services: [],
      uptime: 0,
    });
  }
});

/**
 * Readiness probe - can the service accept traffic?
 * Used by Kubernetes/Docker to determine if service should receive traffic.
 * Returns 200 if ready, 503 if not ready.
 */
app.get('/health/ready', async (_req, res) => {
  try {
    const readiness = await checkReadiness();
    const statusCode = readiness.ready ? 200 : 503;
    res.status(statusCode).json(readiness);
  } catch (error) {
    log.error('Readiness check failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    res.status(503).json({
      ready: false,
      status: 'unhealthy',
      checks: [],
    });
  }
});

/**
 * Liveness probe - is the service alive?
 * Used by Kubernetes/Docker to determine if service should be restarted.
 * Returns 200 if alive.
 */
app.get('/health/live', (_req, res) => {
  const liveness = checkLiveness();
  res.status(200).json(liveness);
});

// Prometheus metrics endpoint
app.get('/metrics', async (_req, res) => {
  try {
    res.set('Content-Type', getMetricsContentType());
    res.end(await getMetrics());
  } catch (error) {
    res.status(500).end(String(error));
  }
});

// API info endpoint
app.get('/', (_req, res) => {
  res.json({ message: 'HazOp Assistant API' });
});

// Swagger API documentation
setupSwagger(app);

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

// Sessions routes (collaboration)
app.use('/sessions', sessionsRoutes);

// Reports routes
app.use('/reports', reportsRoutes);

// Templates routes
app.use('/templates', templatesRoutes);

// Create HTTP server from Express app (required for Socket.io)
const httpServer = createServer(app);

// Initialize WebSocket server when running as main module
async function startServer() {
  // Initialize WebSocket service with JWT authentication
  if (process.env.JWT_PRIVATE_KEY && process.env.JWT_PUBLIC_KEY) {
    const wsService = getWebSocketService();
    await wsService.initialize(httpServer);
    log.info('WebSocket server attached to HTTP server');
  }

  httpServer.listen(port, () => {
    log.info('API server started', { port, env: process.env.NODE_ENV || 'development' });
  });
}

// Only start the server when this file is run directly (not imported for testing)
const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);
if (isMainModule) {
  startServer().catch((error) => {
    log.error('Failed to start server', { error: error instanceof Error ? error.message : String(error), stack: error instanceof Error ? error.stack : undefined });
    process.exit(1);
  });
}

// Export both app and httpServer for testing
export default app;
export { httpServer };

/**
 * Winston structured logging utility for the HazOp API.
 *
 * Provides centralized logging with:
 * - Structured JSON format for production (machine-parseable)
 * - Colorized console format for development (human-readable)
 * - Log levels: error, warn, info, http, debug
 * - Automatic timestamp and metadata enrichment
 * - Child loggers for service-specific context
 * - Optional Loki integration for log aggregation
 */

import winston from 'winston';
import http from 'http';

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

/**
 * Log levels in order of severity (lowest number = highest severity).
 */
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

/**
 * Colors for each log level in development.
 */
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'cyan',
};

winston.addColors(colors);

/**
 * Get the current log level based on environment.
 * Production defaults to 'info', development defaults to 'debug'.
 */
function getLogLevel(): string {
  const env = process.env.NODE_ENV || 'development';
  const level = process.env.LOG_LEVEL;

  if (level) {
    return level;
  }

  return env === 'production' ? 'info' : 'debug';
}

/**
 * Development format: colorized, human-readable output.
 */
const devFormat = combine(
  colorize({ all: true }),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  errors({ stack: true }),
  printf(({ level, message, timestamp, service, requestId, ...meta }) => {
    const serviceStr = service ? `[${service}]` : '';
    const requestIdStr = requestId ? `[${requestId}]` : '';
    const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';

    return `${timestamp} ${level} ${serviceStr}${requestIdStr} ${message}${metaStr}`;
  })
);

/**
 * Production format: structured JSON for log aggregation systems (Loki, etc.).
 */
const prodFormat = combine(
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSSZ' }),
  errors({ stack: true }),
  json()
);

/**
 * Loki transport configuration.
 * Pushes logs directly to Loki HTTP API when LOKI_HOST is configured.
 */
interface LokiConfig {
  host: string;
  labels: Record<string, string>;
  batchSize: number;
  batchInterval: number;
}

interface LokiTransportOptions extends winston.transport.TransportStreamOptions {
  lokiConfig: LokiConfig;
}

/**
 * Custom Loki transport for Winston.
 * Batches logs and pushes them to Loki's HTTP push API.
 */
class LokiTransport extends winston.Transport {
  private config: LokiConfig;
  private batch: Array<{ timestamp: string; line: string }> = [];
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(options: LokiTransportOptions) {
    super(options);
    this.config = options.lokiConfig;
  }

  log(info: winston.Logform.TransformableInfo, callback: () => void): void {
    // Format log entry for Loki
    const timestamp = (Date.now() * 1000000).toString(); // Nanoseconds
    const line = JSON.stringify({
      level: info.level,
      message: info.message,
      ...info,
    });

    this.batch.push({ timestamp, line });

    // Schedule batch flush
    if (!this.timer) {
      this.timer = setTimeout(() => this.flush(), this.config.batchInterval);
    }

    // Flush if batch is full
    if (this.batch.length >= this.config.batchSize) {
      this.flush();
    }

    callback();
  }

  private flush(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    if (this.batch.length === 0) {
      return;
    }

    const entries = this.batch.splice(0, this.batch.length);
    const payload = JSON.stringify({
      streams: [
        {
          stream: this.config.labels,
          values: entries.map((e) => [e.timestamp, e.line]),
        },
      ],
    });

    // Parse Loki URL
    const url = new URL(this.config.host);
    const options: http.RequestOptions = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: '/loki/api/v1/push',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
    };

    const req = http.request(options, (res) => {
      if (res.statusCode && res.statusCode >= 400) {
        // Log to stderr to avoid infinite loop
        process.stderr.write(`Loki push failed: ${res.statusCode}\n`);
      }
    });

    req.on('error', (err) => {
      // Log to stderr to avoid infinite loop
      process.stderr.write(`Loki push error: ${err.message}\n`);
    });

    req.write(payload);
    req.end();
  }

  close(): void {
    this.flush();
  }
}

/**
 * Determine which format to use based on environment.
 */
function getFormat() {
  const env = process.env.NODE_ENV || 'development';
  return env === 'production' ? prodFormat : devFormat;
}

/**
 * Build transports array based on configuration.
 */
function buildTransports(): winston.transport[] {
  const transports: winston.transport[] = [new winston.transports.Console()];

  // Add Loki transport if configured
  const lokiHost = process.env.LOKI_HOST;
  if (lokiHost) {
    const lokiTransport = new LokiTransport({
      lokiConfig: {
        host: lokiHost,
        labels: {
          app: 'hazop-api',
          env: process.env.NODE_ENV || 'development',
        },
        batchSize: parseInt(process.env.LOKI_BATCH_SIZE || '10', 10),
        batchInterval: parseInt(process.env.LOKI_BATCH_INTERVAL || '1000', 10),
      },
    });
    transports.push(lokiTransport);
  }

  return transports;
}

/**
 * Create the main Winston logger instance.
 */
const logger = winston.createLogger({
  level: getLogLevel(),
  levels,
  format: getFormat(),
  defaultMeta: { service: 'hazop-api' },
  transports: buildTransports(),
  exitOnError: false,
});

/**
 * Logger interface for type safety.
 */
export interface Logger {
  error(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  http(message: string, meta?: Record<string, unknown>): void;
  debug(message: string, meta?: Record<string, unknown>): void;
  child(meta: Record<string, unknown>): Logger;
}

/**
 * Wrap Winston logger to provide a cleaner interface.
 */
function wrapLogger(winstonLogger: winston.Logger): Logger {
  return {
    error: (message: string, meta?: Record<string, unknown>) => {
      winstonLogger.error(message, meta);
    },
    warn: (message: string, meta?: Record<string, unknown>) => {
      winstonLogger.warn(message, meta);
    },
    info: (message: string, meta?: Record<string, unknown>) => {
      winstonLogger.info(message, meta);
    },
    http: (message: string, meta?: Record<string, unknown>) => {
      winstonLogger.log('http', message, meta);
    },
    debug: (message: string, meta?: Record<string, unknown>) => {
      winstonLogger.debug(message, meta);
    },
    child: (meta: Record<string, unknown>): Logger => {
      return wrapLogger(winstonLogger.child(meta));
    },
  };
}

/**
 * Export the wrapped logger instance.
 */
export const log = wrapLogger(logger);

/**
 * Create a child logger with additional context (e.g., service name, request ID).
 *
 * @example
 * const authLogger = createLogger({ service: 'auth' });
 * authLogger.info('User logged in', { userId: '123' });
 */
export function createLogger(meta: Record<string, unknown>): Logger {
  return log.child(meta);
}

export default log;

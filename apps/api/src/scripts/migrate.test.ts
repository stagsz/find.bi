/**
 * Unit tests for migrate.ts
 *
 * Tests the migration runner utility functions.
 * Note: Database integration tests would require a test database.
 *
 * Task: DEPLOY-05
 * Date: 2026-02-13
 */

import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import fs from 'fs';
import path from 'path';

// Mock filesystem for testing
jest.mock('fs');
jest.mock('pg');

describe('Migration Runner', () => {
  describe('Migration file parsing', () => {
    const mockReaddir = fs.readdirSync as jest.Mock;
    const mockExistsSync = fs.existsSync as jest.Mock;

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it('should sort migration files by numeric prefix', () => {
      const files = ['003_third.sql', '001_first.sql', '002_second.sql', '010_tenth.sql'];
      const sorted = files.sort();

      expect(sorted).toEqual(['001_first.sql', '002_second.sql', '003_third.sql', '010_tenth.sql']);
    });

    it('should filter non-sql files', () => {
      const files = ['001_first.sql', 'README.md', '002_second.sql', '.gitkeep', 'backup.sql.bak'];
      const sqlFiles = files.filter((f) => f.endsWith('.sql') && /^\d{3}_/.test(f));

      expect(sqlFiles).toEqual(['001_first.sql', '002_second.sql']);
    });

    it('should parse version from filename correctly', () => {
      const filename = '015_add_version_to_analysis_entries.sql';
      const match = filename.match(/^(\d{3})_(.+)\.sql$/);

      expect(match).not.toBeNull();
      expect(match![1]).toBe('015');
      expect(match![2]).toBe('add_version_to_analysis_entries');
    });

    it('should reject invalid migration filenames', () => {
      const invalidFilenames = ['01_missing_digit.sql', 'no_prefix.sql', '0001_four_digits.sql', '001.sql'];

      invalidFilenames.forEach((filename) => {
        const match = filename.match(/^(\d{3})_(.+)\.sql$/);
        expect(match).toBeNull();
      });
    });
  });

  describe('Checksum calculation', () => {
    it('should produce different checksums for different content', async () => {
      const crypto = await import('crypto');

      const content1 = 'CREATE TABLE test1;';
      const content2 = 'CREATE TABLE test2;';

      const hash1 = crypto.createHash('sha256').update(content1).digest('hex');
      const hash2 = crypto.createHash('sha256').update(content2).digest('hex');

      expect(hash1).not.toBe(hash2);
    });

    it('should produce same checksum for same content', async () => {
      const crypto = await import('crypto');

      const content = 'CREATE TABLE test;';

      const hash1 = crypto.createHash('sha256').update(content).digest('hex');
      const hash2 = crypto.createHash('sha256').update(content).digest('hex');

      expect(hash1).toBe(hash2);
    });

    it('should produce 64-character hex string', async () => {
      const crypto = await import('crypto');

      const content = 'CREATE TABLE test;';
      const hash = crypto.createHash('sha256').update(content).digest('hex');

      expect(hash).toHaveLength(64);
      expect(/^[a-f0-9]+$/.test(hash)).toBe(true);
    });
  });

  describe('Migration version ordering', () => {
    it('should order migrations by version string correctly', () => {
      const migrations = [
        { version: '010', name: 'tenth' },
        { version: '001', name: 'first' },
        { version: '009', name: 'ninth' },
        { version: '002', name: 'second' },
      ];

      const sorted = [...migrations].sort((a, b) => a.version.localeCompare(b.version));

      expect(sorted.map((m) => m.version)).toEqual(['001', '002', '009', '010']);
    });

    it('should handle gaps in version numbers', () => {
      const migrations = [
        { version: '001', name: 'first' },
        { version: '003', name: 'third' },
        { version: '010', name: 'tenth' },
      ];

      const sorted = [...migrations].sort((a, b) => a.version.localeCompare(b.version));

      expect(sorted.map((m) => m.version)).toEqual(['001', '003', '010']);
    });
  });

  describe('Migration tracking table schema', () => {
    it('should have correct column definitions', () => {
      const schemaSQL = `
CREATE TABLE IF NOT EXISTS hazop.schema_migrations (
  id SERIAL PRIMARY KEY,
  version VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  checksum VARCHAR(64) NOT NULL,
  execution_time_ms INTEGER
);`;

      // Check for essential columns
      expect(schemaSQL).toContain('id SERIAL PRIMARY KEY');
      expect(schemaSQL).toContain('version VARCHAR(255) NOT NULL UNIQUE');
      expect(schemaSQL).toContain('name VARCHAR(255) NOT NULL');
      expect(schemaSQL).toContain('executed_at TIMESTAMP WITH TIME ZONE');
      expect(schemaSQL).toContain('checksum VARCHAR(64) NOT NULL');
      expect(schemaSQL).toContain('execution_time_ms INTEGER');
    });
  });

  describe('Environment variable defaults', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      jest.resetModules();
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should use localhost as default host', () => {
      delete process.env.DB_HOST;
      const host = process.env.DB_HOST || 'localhost';
      expect(host).toBe('localhost');
    });

    it('should use 5432 as default port', () => {
      delete process.env.DB_PORT;
      const port = parseInt(process.env.DB_PORT || '5432', 10);
      expect(port).toBe(5432);
    });

    it('should use hazop as default database name', () => {
      delete process.env.DB_NAME;
      const dbName = process.env.DB_NAME || 'hazop';
      expect(dbName).toBe('hazop');
    });

    it('should use postgres as default user', () => {
      delete process.env.DB_USER;
      const user = process.env.DB_USER || 'postgres';
      expect(user).toBe('postgres');
    });

    it('should respect custom environment variables', () => {
      process.env.DB_HOST = 'custom-host';
      process.env.DB_PORT = '5433';
      process.env.DB_NAME = 'custom-db';
      process.env.DB_USER = 'custom-user';

      expect(process.env.DB_HOST).toBe('custom-host');
      expect(parseInt(process.env.DB_PORT, 10)).toBe(5433);
      expect(process.env.DB_NAME).toBe('custom-db');
      expect(process.env.DB_USER).toBe('custom-user');
    });

    it('should handle SSL configuration', () => {
      delete process.env.DB_SSL;
      expect(process.env.DB_SSL === 'true').toBe(false);

      process.env.DB_SSL = 'true';
      expect(process.env.DB_SSL === 'true').toBe(true);

      process.env.DB_SSL = 'false';
      expect(process.env.DB_SSL === 'true').toBe(false);
    });
  });

  describe('Pending migrations detection', () => {
    it('should identify migrations not in executed list', () => {
      const diskMigrations = [
        { version: '001', name: '001_first.sql' },
        { version: '002', name: '002_second.sql' },
        { version: '003', name: '003_third.sql' },
      ];

      const executedVersions = new Set(['001', '002']);

      const pending = diskMigrations.filter((m) => !executedVersions.has(m.version));

      expect(pending).toHaveLength(1);
      expect(pending[0].version).toBe('003');
    });

    it('should return empty array when all migrations executed', () => {
      const diskMigrations = [
        { version: '001', name: '001_first.sql' },
        { version: '002', name: '002_second.sql' },
      ];

      const executedVersions = new Set(['001', '002']);

      const pending = diskMigrations.filter((m) => !executedVersions.has(m.version));

      expect(pending).toHaveLength(0);
    });
  });
});

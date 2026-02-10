/**
 * Tests for file upload middleware.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import express, { type Express, type Response } from 'express';
import request from 'supertest';
import {
  uploadPID,
  handleMulterError,
  validatePIDUpload,
  getFileExtension,
  isValidMimeType,
  isValidExtension,
  validateMimeTypeMatchesExtension,
  VALID_EXTENSIONS,
  MAX_FILE_SIZE,
} from './upload.middleware.js';

describe('Upload Middleware', () => {
  describe('getFileExtension', () => {
    it('should extract lowercase extension from filename', () => {
      expect(getFileExtension('document.pdf')).toBe('.pdf');
      expect(getFileExtension('image.PNG')).toBe('.png');
      expect(getFileExtension('drawing.DWG')).toBe('.dwg');
      expect(getFileExtension('photo.JPEG')).toBe('.jpeg');
    });

    it('should handle filenames with multiple dots', () => {
      expect(getFileExtension('my.document.file.pdf')).toBe('.pdf');
      expect(getFileExtension('version.2.0.png')).toBe('.png');
    });

    it('should return empty string for filenames without extension', () => {
      expect(getFileExtension('noextension')).toBe('');
      expect(getFileExtension('Makefile')).toBe('');
    });

    it('should handle filenames starting with dot', () => {
      expect(getFileExtension('.gitignore')).toBe('.gitignore');
      expect(getFileExtension('.hidden.pdf')).toBe('.pdf');
    });
  });

  describe('isValidMimeType', () => {
    it('should return true for valid P&ID MIME types', () => {
      expect(isValidMimeType('application/pdf')).toBe(true);
      expect(isValidMimeType('image/png')).toBe(true);
      expect(isValidMimeType('image/jpeg')).toBe(true);
      expect(isValidMimeType('application/acad')).toBe(true);
      expect(isValidMimeType('application/x-acad')).toBe(true);
      expect(isValidMimeType('application/dwg')).toBe(true);
      expect(isValidMimeType('image/vnd.dwg')).toBe(true);
    });

    it('should return false for invalid MIME types', () => {
      expect(isValidMimeType('application/octet-stream')).toBe(false);
      expect(isValidMimeType('text/plain')).toBe(false);
      expect(isValidMimeType('image/gif')).toBe(false);
      expect(isValidMimeType('application/zip')).toBe(false);
      expect(isValidMimeType('video/mp4')).toBe(false);
    });
  });

  describe('isValidExtension', () => {
    it('should return true for valid P&ID extensions', () => {
      expect(isValidExtension('.pdf')).toBe(true);
      expect(isValidExtension('.png')).toBe(true);
      expect(isValidExtension('.jpg')).toBe(true);
      expect(isValidExtension('.jpeg')).toBe(true);
      expect(isValidExtension('.dwg')).toBe(true);
    });

    it('should be case insensitive', () => {
      expect(isValidExtension('.PDF')).toBe(true);
      expect(isValidExtension('.Png')).toBe(true);
      expect(isValidExtension('.DWG')).toBe(true);
    });

    it('should return false for invalid extensions', () => {
      expect(isValidExtension('.gif')).toBe(false);
      expect(isValidExtension('.doc')).toBe(false);
      expect(isValidExtension('.txt')).toBe(false);
      expect(isValidExtension('.exe')).toBe(false);
      expect(isValidExtension('')).toBe(false);
    });
  });

  describe('validateMimeTypeMatchesExtension', () => {
    it('should return true for matching MIME type and extension (PDF)', () => {
      expect(validateMimeTypeMatchesExtension('application/pdf', '.pdf')).toBe(true);
    });

    it('should return true for matching MIME type and extension (PNG)', () => {
      expect(validateMimeTypeMatchesExtension('image/png', '.png')).toBe(true);
    });

    it('should return true for matching MIME type and extension (JPG/JPEG)', () => {
      expect(validateMimeTypeMatchesExtension('image/jpeg', '.jpg')).toBe(true);
      expect(validateMimeTypeMatchesExtension('image/jpeg', '.jpeg')).toBe(true);
    });

    it('should return true for matching MIME type and extension (DWG variants)', () => {
      expect(validateMimeTypeMatchesExtension('application/acad', '.dwg')).toBe(true);
      expect(validateMimeTypeMatchesExtension('application/x-acad', '.dwg')).toBe(true);
      expect(validateMimeTypeMatchesExtension('application/dwg', '.dwg')).toBe(true);
      expect(validateMimeTypeMatchesExtension('image/vnd.dwg', '.dwg')).toBe(true);
    });

    it('should return true for DWG with octet-stream (browser fallback)', () => {
      expect(validateMimeTypeMatchesExtension('application/octet-stream', '.dwg')).toBe(true);
    });

    it('should be case insensitive for extension', () => {
      expect(validateMimeTypeMatchesExtension('application/pdf', '.PDF')).toBe(true);
      expect(validateMimeTypeMatchesExtension('image/png', '.PNG')).toBe(true);
    });

    it('should return false for mismatched MIME type and extension', () => {
      expect(validateMimeTypeMatchesExtension('application/pdf', '.png')).toBe(false);
      expect(validateMimeTypeMatchesExtension('image/png', '.pdf')).toBe(false);
      expect(validateMimeTypeMatchesExtension('image/jpeg', '.png')).toBe(false);
    });

    it('should return false for invalid extension', () => {
      expect(validateMimeTypeMatchesExtension('application/pdf', '.txt')).toBe(false);
      expect(validateMimeTypeMatchesExtension('image/png', '.gif')).toBe(false);
    });

    it('should return false for octet-stream with non-DWG extension', () => {
      expect(validateMimeTypeMatchesExtension('application/octet-stream', '.pdf')).toBe(false);
      expect(validateMimeTypeMatchesExtension('application/octet-stream', '.png')).toBe(false);
    });
  });

  describe('VALID_EXTENSIONS constant', () => {
    it('should include all expected extensions', () => {
      expect(VALID_EXTENSIONS).toContain('.pdf');
      expect(VALID_EXTENSIONS).toContain('.png');
      expect(VALID_EXTENSIONS).toContain('.jpg');
      expect(VALID_EXTENSIONS).toContain('.jpeg');
      expect(VALID_EXTENSIONS).toContain('.dwg');
    });

    it('should have exactly 5 extensions', () => {
      expect(VALID_EXTENSIONS.length).toBe(5);
    });
  });

  describe('MAX_FILE_SIZE constant', () => {
    it('should be 50MB', () => {
      expect(MAX_FILE_SIZE).toBe(50 * 1024 * 1024);
    });
  });

  describe('Express Integration', () => {
    let app: Express;

    beforeEach(() => {
      app = express();
      app.use(express.json());

      // Test route with upload middleware
      app.post(
        '/upload',
        uploadPID.single('file'),
        handleMulterError,
        validatePIDUpload,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (req: any, res: Response) => {
          res.json({
            success: true,
            data: {
              filename: req.file?.originalname,
              mimeType: req.file?.mimetype,
              size: req.file?.size,
              uploadMeta: req.body._uploadMeta,
            },
          });
        }
      );

      // Error handler for multer errors
      app.use(handleMulterError);
    });

    describe('validatePIDUpload middleware', () => {
      it('should return 400 when no file is uploaded', async () => {
        const response = await request(app)
          .post('/upload')
          .send({});

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('FILE_REQUIRED');
        expect(response.body.error.message).toContain('file is required');
      });
    });

    describe('successful uploads', () => {
      it('should accept PDF files', async () => {
        const pdfContent = Buffer.from('%PDF-1.4 test content');

        const response = await request(app)
          .post('/upload')
          .attach('file', pdfContent, {
            filename: 'test.pdf',
            contentType: 'application/pdf',
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.filename).toBe('test.pdf');
        expect(response.body.data.mimeType).toBe('application/pdf');
        expect(response.body.data.uploadMeta.extension).toBe('.pdf');
      });

      it('should accept PNG files', async () => {
        const pngContent = Buffer.from('PNG test content');

        const response = await request(app)
          .post('/upload')
          .attach('file', pngContent, {
            filename: 'diagram.png',
            contentType: 'image/png',
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.filename).toBe('diagram.png');
        expect(response.body.data.mimeType).toBe('image/png');
      });

      it('should accept JPG files', async () => {
        const jpgContent = Buffer.from('JPEG test content');

        const response = await request(app)
          .post('/upload')
          .attach('file', jpgContent, {
            filename: 'photo.jpg',
            contentType: 'image/jpeg',
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.filename).toBe('photo.jpg');
        expect(response.body.data.mimeType).toBe('image/jpeg');
      });

      it('should accept JPEG files', async () => {
        const jpgContent = Buffer.from('JPEG test content');

        const response = await request(app)
          .post('/upload')
          .attach('file', jpgContent, {
            filename: 'photo.jpeg',
            contentType: 'image/jpeg',
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.filename).toBe('photo.jpeg');
      });

      it('should accept DWG files with application/acad MIME type', async () => {
        const dwgContent = Buffer.from('DWG test content');

        const response = await request(app)
          .post('/upload')
          .attach('file', dwgContent, {
            filename: 'drawing.dwg',
            contentType: 'application/acad',
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.filename).toBe('drawing.dwg');
      });

      it('should accept DWG files with application/octet-stream (browser fallback)', async () => {
        const dwgContent = Buffer.from('DWG test content');

        const response = await request(app)
          .post('/upload')
          .attach('file', dwgContent, {
            filename: 'drawing.dwg',
            contentType: 'application/octet-stream',
          });

        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
        expect(response.body.data.filename).toBe('drawing.dwg');
        // Should normalize MIME type
        expect(response.body.data.uploadMeta.mimeType).toBe('application/acad');
      });

      it('should populate uploadMeta with file information', async () => {
        const pdfContent = Buffer.from('%PDF-1.4 test content here');

        const response = await request(app)
          .post('/upload')
          .attach('file', pdfContent, {
            filename: 'document.pdf',
            contentType: 'application/pdf',
          });

        expect(response.status).toBe(200);
        expect(response.body.data.uploadMeta).toEqual({
          originalFilename: 'document.pdf',
          mimeType: 'application/pdf',
          fileSize: pdfContent.length,
          extension: '.pdf',
        });
      });
    });

    describe('rejected uploads', () => {
      it('should reject files with invalid extension', async () => {
        const content = Buffer.from('text content');

        const response = await request(app)
          .post('/upload')
          .attach('file', content, {
            filename: 'document.txt',
            contentType: 'text/plain',
          });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('FILE_UPLOAD_ERROR');
        expect(response.body.error.message).toContain('Supported formats');
      });

      it('should reject files with mismatched MIME type and extension', async () => {
        const content = Buffer.from('test content');

        const response = await request(app)
          .post('/upload')
          .attach('file', content, {
            filename: 'document.pdf',
            contentType: 'image/png', // Wrong MIME type for .pdf
          });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        expect(response.body.error.code).toBe('FILE_UPLOAD_ERROR');
      });

      it('should reject GIF files', async () => {
        const content = Buffer.from('GIF89a');

        const response = await request(app)
          .post('/upload')
          .attach('file', content, {
            filename: 'animation.gif',
            contentType: 'image/gif',
          });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
      });

      it('should reject executable files', async () => {
        const content = Buffer.from('MZ executable');

        const response = await request(app)
          .post('/upload')
          .attach('file', content, {
            filename: 'program.exe',
            contentType: 'application/x-msdownload',
          });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
      });

      it('should reject ZIP files', async () => {
        const content = Buffer.from('PK zip content');

        const response = await request(app)
          .post('/upload')
          .attach('file', content, {
            filename: 'archive.zip',
            contentType: 'application/zip',
          });

        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
      });
    });

    describe('file field name', () => {
      it('should require file field to be named "file"', async () => {
        const pdfContent = Buffer.from('%PDF-1.4 test content');

        const response = await request(app)
          .post('/upload')
          .attach('wrongfield', pdfContent, {
            filename: 'test.pdf',
            contentType: 'application/pdf',
          });

        // Multer rejects unexpected fields
        expect(response.status).toBe(400);
        expect(response.body.success).toBe(false);
        // Multer treats wrong field name as unexpected file
        expect(response.body.error.code).toBe('FILE_UPLOAD_ERROR');
      });
    });
  });
});

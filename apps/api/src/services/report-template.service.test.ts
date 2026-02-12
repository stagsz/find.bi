/**
 * Tests for Report Template Service.
 *
 * These tests mock the database pool to test the service logic
 * without requiring a real PostgreSQL connection.
 */

import {
  createTemplate,
  findTemplateById,
  listTemplates,
  updateTemplate,
  archiveTemplate,
  deleteTemplate,
  getActiveTemplates,
  getTemplatesByFormat,
  templateIsActive,
  templateSupportsFormat,
  countTemplates,
  generateTemplateStoragePath,
  validateSupportedFormats,
  validateNonEmptyFormats,
} from './report-template.service.js';

// Mock the database config module
const mockQuery = jest.fn();
jest.mock('../config/database.config.js', () => ({
  getPool: jest.fn(() => ({
    query: mockQuery,
  })),
}));

describe('Report Template Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('validateSupportedFormats', () => {
    it('should return true for valid formats', () => {
      expect(validateSupportedFormats(['pdf'])).toBe(true);
      expect(validateSupportedFormats(['word', 'pdf'])).toBe(true);
      expect(validateSupportedFormats(['pdf', 'word', 'excel', 'powerpoint'])).toBe(true);
    });

    it('should return false for invalid formats', () => {
      expect(validateSupportedFormats(['invalid'])).toBe(false);
      expect(validateSupportedFormats(['pdf', 'invalid'])).toBe(false);
      expect(validateSupportedFormats(['doc'])).toBe(false);
    });

    it('should return true for empty array', () => {
      expect(validateSupportedFormats([])).toBe(true);
    });
  });

  describe('validateNonEmptyFormats', () => {
    it('should return true for non-empty array', () => {
      expect(validateNonEmptyFormats(['pdf'])).toBe(true);
      expect(validateNonEmptyFormats(['pdf', 'word'])).toBe(true);
    });

    it('should return false for empty array', () => {
      expect(validateNonEmptyFormats([])).toBe(false);
    });
  });

  describe('generateTemplateStoragePath', () => {
    it('should generate a path with extension', () => {
      const path = generateTemplateStoragePath('template.docx');
      expect(path).toMatch(/^templates\/[a-f0-9-]+\.docx$/);
    });

    it('should generate a path without extension for files without extension', () => {
      const path = generateTemplateStoragePath('template');
      expect(path).toMatch(/^templates\/[a-f0-9-]+$/);
    });

    it('should lowercase the extension', () => {
      const path = generateTemplateStoragePath('template.DOCX');
      expect(path).toMatch(/\.docx$/);
    });

    it('should handle multiple dots in filename', () => {
      const path = generateTemplateStoragePath('report.template.v2.xlsx');
      expect(path).toMatch(/\.xlsx$/);
    });
  });

  describe('createTemplate', () => {
    const mockCreatorId = 'user-123';
    const mockTemplateRow = {
      id: 'template-456',
      name: 'Test Template',
      description: 'A test template',
      template_path: 'templates/test.docx',
      supported_formats: ['pdf', 'word'],
      is_active: true,
      created_by_id: 'user-123',
      created_at: new Date('2026-02-12'),
      updated_at: new Date('2026-02-12'),
    };

    const mockTemplateWithCreator = {
      ...mockTemplateRow,
      created_by_name: 'Test User',
      created_by_email: 'test@example.com',
    };

    it('should create a template with valid data', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [mockTemplateRow] }) // INSERT
        .mockResolvedValueOnce({ rows: [mockTemplateWithCreator] }); // findTemplateById

      const result = await createTemplate(mockCreatorId, {
        name: 'Test Template',
        description: 'A test template',
        templatePath: 'templates/test.docx',
        supportedFormats: ['pdf', 'word'],
      });

      expect(result.name).toBe('Test Template');
      expect(result.description).toBe('A test template');
      expect(result.supportedFormats).toEqual(['pdf', 'word']);
      expect(result.isActive).toBe(true);
      expect(result.createdByName).toBe('Test User');
    });

    it('should throw error for empty name', async () => {
      await expect(
        createTemplate(mockCreatorId, {
          name: '',
          templatePath: 'templates/test.docx',
          supportedFormats: ['pdf'],
        })
      ).rejects.toThrow('Template name cannot be empty');
    });

    it('should throw error for empty template path', async () => {
      await expect(
        createTemplate(mockCreatorId, {
          name: 'Test',
          templatePath: '',
          supportedFormats: ['pdf'],
        })
      ).rejects.toThrow('Template path cannot be empty');
    });

    it('should throw error for empty supported formats', async () => {
      await expect(
        createTemplate(mockCreatorId, {
          name: 'Test',
          templatePath: 'templates/test.docx',
          supportedFormats: [],
        })
      ).rejects.toThrow('Supported formats cannot be empty');
    });

    it('should throw error for invalid format', async () => {
      await expect(
        createTemplate(mockCreatorId, {
          name: 'Test',
          templatePath: 'templates/test.docx',
          supportedFormats: ['invalid' as 'pdf'],
        })
      ).rejects.toThrow('Invalid format in supported formats');
    });

    it('should trim name and description', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [mockTemplateRow] })
        .mockResolvedValueOnce({ rows: [mockTemplateWithCreator] });

      await createTemplate(mockCreatorId, {
        name: '  Test Template  ',
        description: '  A test template  ',
        templatePath: 'templates/test.docx',
        supportedFormats: ['pdf'],
      });

      const insertCall = mockQuery.mock.calls[0];
      expect(insertCall[1][1]).toBe('Test Template');
      expect(insertCall[1][2]).toBe('A test template');
    });
  });

  describe('findTemplateById', () => {
    it('should return template when found', async () => {
      const mockRow = {
        id: 'template-123',
        name: 'Test Template',
        description: 'Description',
        template_path: 'templates/test.docx',
        supported_formats: ['pdf'],
        is_active: true,
        created_by_id: 'user-123',
        created_at: new Date(),
        updated_at: new Date(),
        created_by_name: 'Test User',
        created_by_email: 'test@example.com',
      };

      mockQuery.mockResolvedValueOnce({ rows: [mockRow] });

      const result = await findTemplateById('template-123');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('template-123');
      expect(result?.name).toBe('Test Template');
      expect(result?.createdByName).toBe('Test User');
    });

    it('should return null when not found', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await findTemplateById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('listTemplates', () => {
    const mockTemplates = [
      {
        id: 'template-1',
        name: 'Template 1',
        description: null,
        template_path: 'templates/1.docx',
        supported_formats: ['pdf', 'word'],
        is_active: true,
        created_by_id: 'user-1',
        created_at: new Date(),
        updated_at: new Date(),
        created_by_name: 'User 1',
        created_by_email: 'user1@example.com',
      },
      {
        id: 'template-2',
        name: 'Template 2',
        description: 'Second template',
        template_path: 'templates/2.xlsx',
        supported_formats: ['excel'],
        is_active: true,
        created_by_id: 'user-2',
        created_at: new Date(),
        updated_at: new Date(),
        created_by_name: 'User 2',
        created_by_email: 'user2@example.com',
      },
    ];

    it('should list templates without filters', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '2' }] }) // count query
        .mockResolvedValueOnce({ rows: mockTemplates }); // select query

      const result = await listTemplates();

      expect(result.total).toBe(2);
      expect(result.templates).toHaveLength(2);
      expect(result.templates[0].id).toBe('template-1');
    });

    it('should filter by isActive', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [mockTemplates[0]] });

      const result = await listTemplates({ isActive: true });

      expect(result.total).toBe(1);
      const whereClause = mockQuery.mock.calls[0][0];
      expect(whereClause).toContain('t.is_active = $1');
    });

    it('should filter by format', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: [mockTemplates[1]] });

      const result = await listTemplates({ format: 'excel' });

      expect(result.total).toBe(1);
      const whereClause = mockQuery.mock.calls[0][0];
      expect(whereClause).toContain('supported_formats @>');
    });

    it('should apply pagination', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '50' }] })
        .mockResolvedValueOnce({ rows: mockTemplates });

      await listTemplates({ page: 2, limit: 10 });

      const selectQuery = mockQuery.mock.calls[1][0];
      expect(selectQuery).toContain('LIMIT');
      expect(selectQuery).toContain('OFFSET');
      const params = mockQuery.mock.calls[1][1];
      expect(params).toContain(10); // limit
      expect(params).toContain(10); // offset (page 2 with limit 10)
    });

    it('should enforce maximum limit', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '200' }] })
        .mockResolvedValueOnce({ rows: mockTemplates });

      await listTemplates({ limit: 200 });

      const params = mockQuery.mock.calls[1][1];
      expect(params[0]).toBe(100); // max limit enforced
    });
  });

  describe('updateTemplate', () => {
    const mockUpdatedRow = {
      id: 'template-123',
      name: 'Updated Name',
      description: 'Updated description',
      template_path: 'templates/updated.docx',
      supported_formats: ['pdf', 'excel'],
      is_active: true,
      created_by_id: 'user-123',
      created_at: new Date(),
      updated_at: new Date(),
    };

    const mockUpdatedWithCreator = {
      ...mockUpdatedRow,
      created_by_name: 'Test User',
      created_by_email: 'test@example.com',
    };

    it('should update name', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [mockUpdatedRow] })
        .mockResolvedValueOnce({ rows: [mockUpdatedWithCreator] });

      const result = await updateTemplate('template-123', { name: 'Updated Name' });

      expect(result?.name).toBe('Updated Name');
      const updateQuery = mockQuery.mock.calls[0][0];
      expect(updateQuery).toContain('name = $1');
    });

    it('should update multiple fields', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [mockUpdatedRow] })
        .mockResolvedValueOnce({ rows: [mockUpdatedWithCreator] });

      await updateTemplate('template-123', {
        name: 'New Name',
        description: 'New description',
        isActive: false,
      });

      const updateQuery = mockQuery.mock.calls[0][0];
      expect(updateQuery).toContain('name =');
      expect(updateQuery).toContain('description =');
      expect(updateQuery).toContain('is_active =');
    });

    it('should return existing template when no fields provided', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [mockUpdatedWithCreator] });

      const result = await updateTemplate('template-123', {});

      expect(result).not.toBeNull();
      // Should only call findTemplateById, not UPDATE
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });

    it('should return null for non-existent template', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await updateTemplate('non-existent', { name: 'New Name' });

      expect(result).toBeNull();
    });

    it('should throw error for empty name', async () => {
      await expect(
        updateTemplate('template-123', { name: '' })
      ).rejects.toThrow('Template name cannot be empty');
    });

    it('should throw error for empty template path', async () => {
      await expect(
        updateTemplate('template-123', { templatePath: '' })
      ).rejects.toThrow('Template path cannot be empty');
    });

    it('should throw error for invalid format', async () => {
      await expect(
        updateTemplate('template-123', { supportedFormats: ['invalid' as 'pdf'] })
      ).rejects.toThrow('Invalid format in supported formats');
    });

    it('should allow setting description to null', async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [mockUpdatedRow] })
        .mockResolvedValueOnce({ rows: [mockUpdatedWithCreator] });

      await updateTemplate('template-123', { description: null });

      const params = mockQuery.mock.calls[0][1];
      expect(params[0]).toBeNull();
    });
  });

  describe('archiveTemplate', () => {
    it('should archive active template', async () => {
      mockQuery.mockResolvedValueOnce({ rowCount: 1 });

      const result = await archiveTemplate('template-123');

      expect(result).toBe(true);
      const query = mockQuery.mock.calls[0][0];
      expect(query).toContain('is_active = false');
      expect(query).toContain('WHERE id = $1 AND is_active = true');
    });

    it('should return false for non-existent template', async () => {
      mockQuery.mockResolvedValueOnce({ rowCount: 0 });

      const result = await archiveTemplate('non-existent');

      expect(result).toBe(false);
    });

    it('should return false for already archived template', async () => {
      mockQuery.mockResolvedValueOnce({ rowCount: 0 });

      const result = await archiveTemplate('already-archived');

      expect(result).toBe(false);
    });
  });

  describe('deleteTemplate', () => {
    it('should delete template', async () => {
      mockQuery.mockResolvedValueOnce({ rowCount: 1 });

      const result = await deleteTemplate('template-123');

      expect(result).toBe(true);
      const query = mockQuery.mock.calls[0][0];
      expect(query).toContain('DELETE FROM hazop.report_templates');
    });

    it('should return false for non-existent template', async () => {
      mockQuery.mockResolvedValueOnce({ rowCount: 0 });

      const result = await deleteTemplate('non-existent');

      expect(result).toBe(false);
    });
  });

  describe('getActiveTemplates', () => {
    it('should return only active templates', async () => {
      const mockActiveTemplates = [
        {
          id: 'template-1',
          name: 'Active 1',
          description: null,
          template_path: 'templates/1.docx',
          supported_formats: ['pdf'],
          is_active: true,
          created_by_id: 'user-1',
          created_at: new Date(),
          updated_at: new Date(),
          created_by_name: 'User 1',
          created_by_email: 'user1@example.com',
        },
      ];

      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: mockActiveTemplates });

      const result = await getActiveTemplates();

      expect(result).toHaveLength(1);
      expect(result[0].isActive).toBe(true);

      // Verify isActive filter was applied
      const countQuery = mockQuery.mock.calls[0][0];
      expect(countQuery).toContain('is_active');
    });
  });

  describe('getTemplatesByFormat', () => {
    it('should return templates supporting the format', async () => {
      const mockPdfTemplates = [
        {
          id: 'template-1',
          name: 'PDF Template',
          description: null,
          template_path: 'templates/1.docx',
          supported_formats: ['pdf', 'word'],
          is_active: true,
          created_by_id: 'user-1',
          created_at: new Date(),
          updated_at: new Date(),
          created_by_name: 'User 1',
          created_by_email: 'user1@example.com',
        },
      ];

      mockQuery
        .mockResolvedValueOnce({ rows: [{ count: '1' }] })
        .mockResolvedValueOnce({ rows: mockPdfTemplates });

      const result = await getTemplatesByFormat('pdf');

      expect(result).toHaveLength(1);
      expect(result[0].supportedFormats).toContain('pdf');
    });
  });

  describe('templateIsActive', () => {
    it('should return true for active template', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ is_active: true }] });

      const result = await templateIsActive('template-123');

      expect(result).toBe(true);
    });

    it('should return false for inactive template', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ is_active: false }] });

      const result = await templateIsActive('template-123');

      expect(result).toBe(false);
    });

    it('should return false for non-existent template', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await templateIsActive('non-existent');

      expect(result).toBe(false);
    });
  });

  describe('templateSupportsFormat', () => {
    it('should return true when format is supported', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ supports: true }] });

      const result = await templateSupportsFormat('template-123', 'pdf');

      expect(result).toBe(true);
    });

    it('should return false when format is not supported', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [{ supports: false }] });

      const result = await templateSupportsFormat('template-123', 'excel');

      expect(result).toBe(false);
    });

    it('should return false for non-existent template', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await templateSupportsFormat('non-existent', 'pdf');

      expect(result).toBe(false);
    });
  });

  describe('countTemplates', () => {
    it('should return counts for active and inactive templates', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [
          { is_active: true, count: '10' },
          { is_active: false, count: '3' },
        ],
      });

      const result = await countTemplates();

      expect(result.active).toBe(10);
      expect(result.inactive).toBe(3);
    });

    it('should return zeros when no templates exist', async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const result = await countTemplates();

      expect(result.active).toBe(0);
      expect(result.inactive).toBe(0);
    });

    it('should handle only active templates', async () => {
      mockQuery.mockResolvedValueOnce({
        rows: [{ is_active: true, count: '5' }],
      });

      const result = await countTemplates();

      expect(result.active).toBe(5);
      expect(result.inactive).toBe(0);
    });
  });
});

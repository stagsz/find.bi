/**
 * OpenAPI/Swagger configuration for HazOp Assistant API.
 *
 * This module configures swagger-jsdoc to generate OpenAPI 3.0 documentation
 * from JSDoc comments and provides the Express middleware for serving the
 * Swagger UI documentation interface.
 *
 * API documentation is available at:
 * - /api-docs - Swagger UI interactive documentation
 * - /api-docs.json - Raw OpenAPI JSON specification
 */

import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import type { Express } from 'express';

/**
 * OpenAPI specification options.
 */
const swaggerOptions: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'HazOp Assistant API',
      version: '1.0.0',
      description: `
## Overview

The HazOp Assistant API provides endpoints for conducting Hazard and Operability Studies (HazOps)
in the process industry. The system guides engineers through established HazOps methodology while
automating documentation, risk assessment, and compliance validation.

## Key Features

- **P&ID Management**: Upload, view, and manage Piping & Instrumentation Diagrams
- **HazOps Analysis**: Conduct node-by-node analysis using standard guide words
- **Risk Assessment**: Calculate risk using severity × likelihood × detectability methodology
- **LOPA Validation**: Layers of Protection Analysis validation
- **Compliance**: Cross-reference findings against regulatory standards (IEC 61511, ISO 31000, OSHA PSM, etc.)
- **Reports**: Generate professional reports in Word, PDF, Excel, and PowerPoint formats
- **Real-time Collaboration**: Collaborate on analyses with team members in real-time

## Authentication

Most endpoints require JWT Bearer token authentication. Obtain tokens via:
- \`POST /auth/login\` - Authenticate with email/password
- \`POST /auth/register\` - Create a new user account
- \`POST /auth/refresh\` - Refresh access token

Include the access token in the Authorization header:
\`\`\`
Authorization: Bearer <access_token>
\`\`\`

## Rate Limiting

API requests are rate limited to prevent abuse. If you exceed the rate limit,
you will receive a 429 Too Many Requests response.

## Error Handling

All errors follow a consistent format with error codes for programmatic handling.
See the Error Response schema for details.
      `,
      contact: {
        name: 'HazOp Assistant Support',
        email: 'support@hazop-assistant.com',
      },
      license: {
        name: 'Proprietary',
      },
    },
    servers: [
      {
        url: 'http://localhost:4000',
        description: 'Development server',
      },
      {
        url: '{protocol}://{host}',
        description: 'Custom server',
        variables: {
          protocol: {
            enum: ['http', 'https'],
            default: 'https',
          },
          host: {
            default: 'api.hazop-assistant.com',
            description: 'API host',
          },
        },
      },
    ],
    tags: [
      {
        name: 'Health',
        description: 'Health check and monitoring endpoints',
      },
      {
        name: 'Authentication',
        description: 'User authentication and token management',
      },
      {
        name: 'Users',
        description: 'User profile management',
      },
      {
        name: 'Admin',
        description: 'Administrator user management (requires admin role)',
      },
      {
        name: 'Projects',
        description: 'HazOps project management',
      },
      {
        name: 'Documents',
        description: 'P&ID document management',
      },
      {
        name: 'Nodes',
        description: 'Analysis node management on P&ID documents',
      },
      {
        name: 'Guide Words',
        description: 'Standard HazOps guide word reference data',
      },
      {
        name: 'Prepared Answers',
        description: 'Pre-configured answer menus for causes, consequences, safeguards, and recommendations',
      },
      {
        name: 'Analyses',
        description: 'HazOps analysis session management',
      },
      {
        name: 'Entries',
        description: 'Analysis entry management (deviation, risk assessment, LOPA)',
      },
      {
        name: 'Collaboration',
        description: 'Real-time collaboration sessions',
      },
      {
        name: 'Reports',
        description: 'Report generation and templates',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT access token obtained from /auth/login or /auth/register',
        },
      },
      schemas: {
        // Error Response Schema
        ErrorResponse: {
          type: 'object',
          required: ['success', 'error'],
          properties: {
            success: {
              type: 'boolean',
              enum: [false],
              example: false,
            },
            error: {
              type: 'object',
              required: ['code', 'message'],
              properties: {
                code: {
                  type: 'string',
                  enum: [
                    'VALIDATION_ERROR',
                    'AUTHENTICATION_ERROR',
                    'AUTHORIZATION_ERROR',
                    'NOT_FOUND',
                    'CONFLICT',
                    'RATE_LIMITED',
                    'INTERNAL_ERROR',
                    'SERVICE_UNAVAILABLE',
                  ],
                  description: 'Error code for programmatic handling',
                },
                message: {
                  type: 'string',
                  description: 'Human-readable error message',
                },
                errors: {
                  type: 'array',
                  description: 'Field-level validation errors',
                  items: {
                    type: 'object',
                    properties: {
                      field: { type: 'string' },
                      message: { type: 'string' },
                      code: { type: 'string' },
                    },
                  },
                },
                requestId: {
                  type: 'string',
                  description: 'Request ID for debugging',
                },
              },
            },
          },
        },

        // Pagination Schema
        PaginationMeta: {
          type: 'object',
          properties: {
            page: { type: 'integer', minimum: 1, example: 1 },
            limit: { type: 'integer', minimum: 1, maximum: 100, example: 20 },
            total: { type: 'integer', minimum: 0, example: 150 },
            totalPages: { type: 'integer', minimum: 0, example: 8 },
            hasNextPage: { type: 'boolean', example: true },
            hasPrevPage: { type: 'boolean', example: false },
          },
        },

        // User Schemas
        UserRole: {
          type: 'string',
          enum: ['administrator', 'lead_analyst', 'analyst', 'viewer'],
          description: `
- administrator: Full system access, user management
- lead_analyst: Project management, analysis review/approval
- analyst: Conduct HazOps analyses, create reports
- viewer: Read-only access to projects and reports
          `,
        },
        User: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid', example: '123e4567-e89b-12d3-a456-426614174000' },
            email: { type: 'string', format: 'email', example: 'john.doe@company.com' },
            name: { type: 'string', example: 'John Doe' },
            role: { $ref: '#/components/schemas/UserRole' },
            organization: { type: 'string', example: 'Acme Chemical Corp' },
            isActive: { type: 'boolean', example: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },

        // Token Schemas
        TokenPair: {
          type: 'object',
          properties: {
            accessToken: { type: 'string', description: 'JWT access token' },
            refreshToken: { type: 'string', description: 'JWT refresh token' },
            expiresIn: { type: 'integer', description: 'Access token expiry in seconds', example: 900 },
            tokenType: { type: 'string', enum: ['Bearer'], example: 'Bearer' },
          },
        },

        // Project Schemas
        ProjectStatus: {
          type: 'string',
          enum: ['planning', 'active', 'review', 'completed', 'archived'],
          description: `
- planning: Initial setup, P&ID upload
- active: Analysis in progress
- review: Analysis complete, awaiting approval
- completed: Approved and finalized
- archived: Historical record
          `,
        },
        ProjectMemberRole: {
          type: 'string',
          enum: ['owner', 'lead', 'member', 'viewer'],
          description: `
- owner: Project creator, full control
- lead: Can manage analysis and team
- member: Can contribute to analysis
- viewer: Read-only access
          `,
        },
        Project: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string', example: 'Ethylene Plant HazOps Study' },
            description: { type: 'string', example: 'Comprehensive HazOps analysis of the ethylene production facility' },
            status: { $ref: '#/components/schemas/ProjectStatus' },
            organization: { type: 'string', example: 'Acme Chemical Corp' },
            createdById: { type: 'string', format: 'uuid' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        ProjectWithCreator: {
          allOf: [
            { $ref: '#/components/schemas/Project' },
            {
              type: 'object',
              properties: {
                createdByName: { type: 'string', example: 'John Doe' },
                createdByEmail: { type: 'string', format: 'email' },
              },
            },
          ],
        },
        ProjectMember: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            projectId: { type: 'string', format: 'uuid' },
            userId: { type: 'string', format: 'uuid' },
            role: { $ref: '#/components/schemas/ProjectMemberRole' },
            joinedAt: { type: 'string', format: 'date-time' },
            userName: { type: 'string' },
            userEmail: { type: 'string', format: 'email' },
          },
        },

        // Document Schemas
        PIDDocumentStatus: {
          type: 'string',
          enum: ['pending', 'processing', 'ready', 'failed'],
          description: 'Processing status of the P&ID document',
        },
        PIDDocument: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            projectId: { type: 'string', format: 'uuid' },
            filename: { type: 'string', example: 'P&ID-001-Rev3.pdf' },
            originalFilename: { type: 'string' },
            mimeType: { type: 'string', example: 'application/pdf' },
            fileSize: { type: 'integer', description: 'File size in bytes' },
            storagePath: { type: 'string' },
            processingStatus: { $ref: '#/components/schemas/PIDDocumentStatus' },
            metadata: { type: 'object', nullable: true },
            uploadedById: { type: 'string', format: 'uuid' },
            uploadedAt: { type: 'string', format: 'date-time' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },

        // Node Schemas
        EquipmentType: {
          type: 'string',
          enum: ['pump', 'valve', 'reactor', 'heat_exchanger', 'tank', 'pipe', 'other'],
          description: 'Type of process equipment',
        },
        AnalysisNode: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            documentId: { type: 'string', format: 'uuid' },
            nodeIdentifier: { type: 'string', example: 'P-101', description: 'User-defined node identifier' },
            description: { type: 'string', example: 'Main feed pump', nullable: true },
            equipmentType: { $ref: '#/components/schemas/EquipmentType' },
            positionX: { type: 'number', description: 'X coordinate on P&ID' },
            positionY: { type: 'number', description: 'Y coordinate on P&ID' },
            width: { type: 'number', description: 'Node width on P&ID' },
            height: { type: 'number', description: 'Node height on P&ID' },
            metadata: { type: 'object', nullable: true },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },

        // Guide Word Schemas
        GuideWord: {
          type: 'string',
          enum: ['no', 'more', 'less', 'reverse', 'early', 'late', 'other_than'],
          description: `Standard HazOps guide words:
- no: Complete negation (e.g., no flow)
- more: Quantitative increase (e.g., more pressure)
- less: Quantitative decrease (e.g., less temperature)
- reverse: Opposite direction (e.g., reverse flow)
- early: Earlier than intended
- late: Later than intended
- other_than: Qualitative deviation (e.g., wrong composition)
          `,
        },
        GuideWordDefinition: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            label: { type: 'string' },
            description: { type: 'string' },
            applicableParameters: {
              type: 'array',
              items: { type: 'string' },
              example: ['flow', 'pressure', 'temperature', 'level'],
            },
          },
        },

        // Analysis Schemas
        AnalysisStatus: {
          type: 'string',
          enum: ['draft', 'in_review', 'approved', 'rejected'],
          description: `
- draft: Analysis in progress
- in_review: Submitted for lead analyst review
- approved: Reviewed and approved
- rejected: Rejected, needs revision
          `,
        },
        HazopsAnalysis: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            projectId: { type: 'string', format: 'uuid' },
            documentId: { type: 'string', format: 'uuid' },
            name: { type: 'string', example: 'Feed Section Analysis' },
            description: { type: 'string', nullable: true },
            status: { $ref: '#/components/schemas/AnalysisStatus' },
            leadAnalystId: { type: 'string', format: 'uuid' },
            createdById: { type: 'string', format: 'uuid' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
            submittedAt: { type: 'string', format: 'date-time', nullable: true },
            approvedAt: { type: 'string', format: 'date-time', nullable: true },
            approvedById: { type: 'string', format: 'uuid', nullable: true },
          },
        },
        HazopsAnalysisWithDetails: {
          allOf: [
            { $ref: '#/components/schemas/HazopsAnalysis' },
            {
              type: 'object',
              properties: {
                documentName: { type: 'string' },
                leadAnalystName: { type: 'string' },
                leadAnalystEmail: { type: 'string', format: 'email' },
                createdByName: { type: 'string' },
                totalNodes: { type: 'integer' },
                analyzedNodes: { type: 'integer' },
                totalEntries: { type: 'integer' },
                highRiskCount: { type: 'integer' },
                mediumRiskCount: { type: 'integer' },
                lowRiskCount: { type: 'integer' },
              },
            },
          ],
        },

        // Risk Schemas
        SeverityLevel: {
          type: 'integer',
          enum: [1, 2, 3, 4, 5],
          description: `
1 - Negligible: No injury, minimal equipment damage
2 - Minor: First aid injury, minor equipment damage
3 - Moderate: Lost workday injury, moderate equipment damage
4 - Major: Permanent disability, major equipment damage
5 - Catastrophic: Fatality, major environmental disaster
          `,
        },
        LikelihoodLevel: {
          type: 'integer',
          enum: [1, 2, 3, 4, 5],
          description: `
1 - Rare: Unlikely during plant lifetime
2 - Unlikely: Could occur once in plant lifetime
3 - Possible: Could occur several times in plant lifetime
4 - Likely: Expected multiple times per year
5 - Almost Certain: Expected frequently
          `,
        },
        DetectabilityLevel: {
          type: 'integer',
          enum: [1, 2, 3, 4, 5],
          description: `
1 - Almost Certain: Will almost certainly be detected
2 - High: Good chance of detection
3 - Moderate: May or may not be detected
4 - Low: Unlikely to be detected
5 - Undetectable: No means of detection
          `,
        },
        RiskLevel: {
          type: 'string',
          enum: ['low', 'medium', 'high'],
          description: 'Risk classification based on score: Low (1-20), Medium (21-60), High (61-125)',
        },
        RiskRanking: {
          type: 'object',
          properties: {
            severity: { $ref: '#/components/schemas/SeverityLevel' },
            likelihood: { $ref: '#/components/schemas/LikelihoodLevel' },
            detectability: { $ref: '#/components/schemas/DetectabilityLevel' },
            riskScore: { type: 'integer', minimum: 1, maximum: 125, description: 'Severity × Likelihood × Detectability' },
            riskLevel: { $ref: '#/components/schemas/RiskLevel' },
          },
        },

        // Analysis Entry Schema
        AnalysisEntry: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            analysisId: { type: 'string', format: 'uuid' },
            nodeId: { type: 'string', format: 'uuid' },
            guideWord: { $ref: '#/components/schemas/GuideWord' },
            parameter: { type: 'string', example: 'flow' },
            deviation: { type: 'string', example: 'No flow through the main feed line' },
            causes: {
              type: 'array',
              items: { type: 'string' },
              example: ['Pump failure', 'Blocked line', 'Valve closed in error'],
            },
            consequences: {
              type: 'array',
              items: { type: 'string' },
              example: ['Production shutdown', 'Downstream equipment damage'],
            },
            safeguards: {
              type: 'array',
              items: { type: 'string' },
              example: ['Low flow alarm', 'Backup pump', 'Operator rounds'],
            },
            recommendations: {
              type: 'array',
              items: { type: 'string' },
              example: ['Install redundant flow transmitter', 'Add emergency bypass'],
            },
            riskRanking: {
              allOf: [{ $ref: '#/components/schemas/RiskRanking' }],
              nullable: true,
            },
            notes: { type: 'string', nullable: true },
            createdById: { type: 'string', format: 'uuid' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        AnalysisEntryWithNode: {
          allOf: [
            { $ref: '#/components/schemas/AnalysisEntry' },
            {
              type: 'object',
              properties: {
                nodeIdentifier: { type: 'string' },
                nodeDescription: { type: 'string', nullable: true },
                nodeEquipmentType: { $ref: '#/components/schemas/EquipmentType' },
              },
            },
          ],
        },

        // LOPA Schemas
        SafetyIntegrityLevel: {
          type: 'string',
          enum: ['SIL_1', 'SIL_2', 'SIL_3', 'SIL_4'],
          description: 'Safety Integrity Level per IEC 61511',
        },
        IPLType: {
          type: 'string',
          enum: ['bpcs', 'alarm', 'sis', 'relief', 'mechanical', 'human'],
          description: 'Type of Independent Protection Layer',
        },
        LOPAAnalysis: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            entryId: { type: 'string', format: 'uuid' },
            initiatingEventFrequency: { type: 'number', description: 'Events per year' },
            targetMitigatedFrequency: { type: 'number', description: 'Target frequency per year' },
            ipls: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  type: { $ref: '#/components/schemas/IPLType' },
                  pfd: { type: 'number', description: 'Probability of Failure on Demand' },
                  isIndependent: { type: 'boolean' },
                },
              },
            },
            calculatedFrequency: { type: 'number' },
            riskReductionFactor: { type: 'number' },
            gapExists: { type: 'boolean' },
            requiredSIL: { $ref: '#/components/schemas/SafetyIntegrityLevel', nullable: true },
            recommendations: { type: 'array', items: { type: 'string' } },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },

        // Compliance Schemas
        RegulatoryStandard: {
          type: 'string',
          enum: ['IEC_61511', 'ISO_31000', 'ISO_9001', 'ATEX_DSEAR', 'PED', 'OSHA_PSM', 'EPA_RMP', 'SEVESO_III'],
          description: 'Regulatory standard identifier',
        },
        ComplianceStatus: {
          type: 'string',
          enum: ['compliant', 'non_compliant', 'partial', 'not_applicable'],
        },
        ComplianceSummary: {
          type: 'object',
          properties: {
            standard: { $ref: '#/components/schemas/RegulatoryStandard' },
            standardName: { type: 'string' },
            status: { $ref: '#/components/schemas/ComplianceStatus' },
            compliancePercentage: { type: 'number' },
            totalRequirements: { type: 'integer' },
            metRequirements: { type: 'integer' },
            issues: { type: 'array', items: { type: 'string' } },
          },
        },

        // Report Schemas
        ReportFormat: {
          type: 'string',
          enum: ['pdf', 'word', 'excel', 'powerpoint'],
        },
        ReportStatus: {
          type: 'string',
          enum: ['pending', 'processing', 'completed', 'failed'],
        },
        Report: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            projectId: { type: 'string', format: 'uuid' },
            analysisId: { type: 'string', format: 'uuid' },
            name: { type: 'string' },
            format: { $ref: '#/components/schemas/ReportFormat' },
            template: { type: 'string' },
            status: { $ref: '#/components/schemas/ReportStatus' },
            storagePath: { type: 'string', nullable: true },
            fileSize: { type: 'integer', nullable: true },
            requestedById: { type: 'string', format: 'uuid' },
            requestedAt: { type: 'string', format: 'date-time' },
            generatedAt: { type: 'string', format: 'date-time', nullable: true },
            errorMessage: { type: 'string', nullable: true },
          },
        },
        ReportTemplate: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            description: { type: 'string' },
            supportedFormats: {
              type: 'array',
              items: { $ref: '#/components/schemas/ReportFormat' },
            },
            isDefault: { type: 'boolean' },
          },
        },

        // Collaboration Schemas
        CollaborationSession: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            analysisId: { type: 'string', format: 'uuid' },
            status: { type: 'string', enum: ['active', 'ended'] },
            startedById: { type: 'string', format: 'uuid' },
            startedAt: { type: 'string', format: 'date-time' },
            endedAt: { type: 'string', format: 'date-time', nullable: true },
            participants: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  userId: { type: 'string', format: 'uuid' },
                  userName: { type: 'string' },
                  joinedAt: { type: 'string', format: 'date-time' },
                  isActive: { type: 'boolean' },
                },
              },
            },
          },
        },

        // Health Schemas
        HealthStatus: {
          type: 'string',
          enum: ['healthy', 'degraded', 'unhealthy'],
        },
        HealthCheckResponse: {
          type: 'object',
          properties: {
            status: { $ref: '#/components/schemas/HealthStatus' },
            version: { type: 'string' },
            timestamp: { type: 'string', format: 'date-time' },
            uptime: { type: 'number', description: 'Uptime in seconds' },
            services: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  status: { $ref: '#/components/schemas/HealthStatus' },
                  responseTime: { type: 'number', description: 'Response time in ms' },
                  message: { type: 'string' },
                },
              },
            },
          },
        },

        // Prepared Answer Schemas
        PreparedCause: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            text: { type: 'string' },
            category: { type: 'string' },
            equipmentTypes: {
              type: 'array',
              items: { $ref: '#/components/schemas/EquipmentType' },
            },
            guideWords: {
              type: 'array',
              items: { $ref: '#/components/schemas/GuideWord' },
            },
          },
        },
        PreparedConsequence: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            text: { type: 'string' },
            category: { type: 'string' },
            severity: { type: 'string', enum: ['low', 'medium', 'high'] },
            equipmentTypes: {
              type: 'array',
              items: { $ref: '#/components/schemas/EquipmentType' },
            },
          },
        },
        PreparedSafeguard: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            text: { type: 'string' },
            category: { type: 'string' },
            effectiveness: { type: 'string', enum: ['low', 'medium', 'high'] },
            equipmentTypes: {
              type: 'array',
              items: { $ref: '#/components/schemas/EquipmentType' },
            },
          },
        },
        PreparedRecommendation: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            text: { type: 'string' },
            category: { type: 'string' },
            priority: { type: 'string', enum: ['low', 'medium', 'high'] },
            equipmentTypes: {
              type: 'array',
              items: { $ref: '#/components/schemas/EquipmentType' },
            },
          },
        },
      },
      responses: {
        UnauthorizedError: {
          description: 'Authentication required or invalid token',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              example: {
                success: false,
                error: {
                  code: 'AUTHENTICATION_ERROR',
                  message: 'Invalid or expired access token',
                },
              },
            },
          },
        },
        ForbiddenError: {
          description: 'Insufficient permissions',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              example: {
                success: false,
                error: {
                  code: 'AUTHORIZATION_ERROR',
                  message: 'You do not have permission to perform this action',
                },
              },
            },
          },
        },
        NotFoundError: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              example: {
                success: false,
                error: {
                  code: 'NOT_FOUND',
                  message: 'The requested resource was not found',
                },
              },
            },
          },
        },
        ValidationError: {
          description: 'Validation error',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              example: {
                success: false,
                error: {
                  code: 'VALIDATION_ERROR',
                  message: 'Validation failed',
                  errors: [
                    { field: 'email', message: 'Invalid email format', code: 'INVALID_FORMAT' },
                  ],
                },
              },
            },
          },
        },
        InternalError: {
          description: 'Internal server error',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              example: {
                success: false,
                error: {
                  code: 'INTERNAL_ERROR',
                  message: 'An unexpected error occurred',
                },
              },
            },
          },
        },
      },
      parameters: {
        pageParam: {
          name: 'page',
          in: 'query',
          description: 'Page number (1-based)',
          schema: { type: 'integer', minimum: 1, default: 1 },
        },
        limitParam: {
          name: 'limit',
          in: 'query',
          description: 'Items per page',
          schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
        },
        sortOrderParam: {
          name: 'sortOrder',
          in: 'query',
          description: 'Sort order',
          schema: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
        },
        searchParam: {
          name: 'search',
          in: 'query',
          description: 'Search query string',
          schema: { type: 'string' },
        },
        projectIdParam: {
          name: 'id',
          in: 'path',
          required: true,
          description: 'Project UUID',
          schema: { type: 'string', format: 'uuid' },
        },
        documentIdParam: {
          name: 'id',
          in: 'path',
          required: true,
          description: 'Document UUID',
          schema: { type: 'string', format: 'uuid' },
        },
        analysisIdParam: {
          name: 'id',
          in: 'path',
          required: true,
          description: 'Analysis UUID',
          schema: { type: 'string', format: 'uuid' },
        },
        entryIdParam: {
          name: 'id',
          in: 'path',
          required: true,
          description: 'Entry UUID',
          schema: { type: 'string', format: 'uuid' },
        },
        nodeIdParam: {
          name: 'id',
          in: 'path',
          required: true,
          description: 'Node UUID',
          schema: { type: 'string', format: 'uuid' },
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ['./src/routes/*.ts', './src/docs/*.yaml'],
};

/**
 * Generate OpenAPI specification from JSDoc comments and options.
 */
export const swaggerSpec = swaggerJsdoc(swaggerOptions);

/**
 * Set up Swagger UI documentation endpoint on Express app.
 *
 * @param app - Express application instance
 */
export function setupSwagger(app: Express): void {
  // Swagger UI endpoint
  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      customCss: '.swagger-ui .topbar { display: none }',
      customSiteTitle: 'HazOp Assistant API Documentation',
      swaggerOptions: {
        persistAuthorization: true,
        docExpansion: 'none',
        filter: true,
        showExtensions: true,
        showCommonExtensions: true,
        syntaxHighlight: {
          activate: true,
          theme: 'monokai',
        },
      },
    })
  );

  // Raw OpenAPI JSON endpoint
  app.get('/api-docs.json', (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });
}

-- Migration: 005_create_analysis_nodes_table
-- Description: Create analysis_nodes table for P&ID node definitions
-- Task: DB-05
-- Date: 2026-02-09

-- Set search path to use the hazop schema
SET search_path TO hazop, public;

-- ============================================================================
-- ANALYSIS_NODES TABLE
-- ============================================================================
-- Stores analysis nodes that represent equipment items on P&ID documents.
-- Each node is placed at specific coordinates on the P&ID and can be
-- referenced in HazOps analysis entries. Nodes are the fundamental unit
-- of analysis - each guide word deviation is analyzed per node.

CREATE TABLE analysis_nodes (
    -- Primary key
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Foreign key to pid_documents table
    document_id UUID NOT NULL,

    -- User-defined node identifier (e.g., "P-101", "V-200", "R-100")
    -- Must be unique within the same document
    node_id VARCHAR(50) NOT NULL,

    -- Descriptive name/purpose of the node
    description VARCHAR(500) NOT NULL,

    -- Type of equipment (uses equipment_type enum from 001_create_enum_types)
    equipment_type equipment_type NOT NULL DEFAULT 'other',

    -- Position on P&ID as percentage of document dimensions (0-100)
    -- Using DECIMAL for precision in coordinate positioning
    x_coordinate DECIMAL(6, 3) NOT NULL CHECK (x_coordinate >= 0 AND x_coordinate <= 100),
    y_coordinate DECIMAL(6, 3) NOT NULL CHECK (y_coordinate >= 0 AND y_coordinate <= 100),

    -- User who created this node
    created_by_id UUID NOT NULL,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- ========================================================================
    -- CONSTRAINTS
    -- ========================================================================

    -- Foreign key to pid_documents - cascade delete when document is deleted
    CONSTRAINT analysis_nodes_fk_document FOREIGN KEY (document_id)
        REFERENCES pid_documents(id) ON DELETE CASCADE ON UPDATE CASCADE,

    -- Foreign key to users - restrict deletion if user has created nodes
    CONSTRAINT analysis_nodes_fk_created_by FOREIGN KEY (created_by_id)
        REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,

    -- Node ID must be unique within the same document
    CONSTRAINT analysis_nodes_unique_node_id_per_document
        UNIQUE (document_id, node_id)
);

-- ============================================================================
-- TABLE AND COLUMN COMMENTS
-- ============================================================================

COMMENT ON TABLE analysis_nodes IS
    'Stores equipment nodes identified on P&ID documents for HazOps analysis. '
    'Each node represents a piece of equipment (pump, valve, reactor, etc.) '
    'that can be analyzed using guide words to identify potential hazards.';

COMMENT ON COLUMN analysis_nodes.id IS
    'Unique identifier (UUID) for the analysis node';

COMMENT ON COLUMN analysis_nodes.document_id IS
    'Foreign key reference to the P&ID document this node belongs to';

COMMENT ON COLUMN analysis_nodes.node_id IS
    'User-defined identifier for the node (e.g., P-101 for Pump 101). '
    'Must be unique within the same document.';

COMMENT ON COLUMN analysis_nodes.description IS
    'Human-readable description of the node and its purpose';

COMMENT ON COLUMN analysis_nodes.equipment_type IS
    'Type of equipment: pump, valve, reactor, heat_exchanger, pipe, tank, or other';

COMMENT ON COLUMN analysis_nodes.x_coordinate IS
    'Horizontal position on P&ID as percentage of document width (0-100)';

COMMENT ON COLUMN analysis_nodes.y_coordinate IS
    'Vertical position on P&ID as percentage of document height (0-100)';

COMMENT ON COLUMN analysis_nodes.created_by_id IS
    'Foreign key reference to the user who created this node';

COMMENT ON COLUMN analysis_nodes.created_at IS
    'Timestamp when the node was created';

COMMENT ON COLUMN analysis_nodes.updated_at IS
    'Timestamp when the node was last updated';

-- ============================================================================
-- PERFORMANCE INDEXES
-- ============================================================================

-- Index for querying nodes by document (most common query)
CREATE INDEX idx_analysis_nodes_document_id
    ON analysis_nodes (document_id);

-- Index for filtering by equipment type
CREATE INDEX idx_analysis_nodes_equipment_type
    ON analysis_nodes (equipment_type);

-- Index for querying nodes created by a specific user
CREATE INDEX idx_analysis_nodes_created_by_id
    ON analysis_nodes (created_by_id);

-- Composite index for document + equipment type queries
CREATE INDEX idx_analysis_nodes_document_equipment
    ON analysis_nodes (document_id, equipment_type);

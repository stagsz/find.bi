/**
 * Report request form component for generating HazOps reports.
 *
 * This form allows users to configure and submit report generation requests:
 * - Select analysis, format, and template (required)
 * - Optional custom report name
 * - Advanced options for customizing report content:
 *   - Include/exclude sections (risk matrix, compliance, LOPA, etc.)
 *   - Filter by risk levels
 *   - Custom title and footer text
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  Select,
  TextInput,
  Textarea,
  Button,
  Alert,
  Checkbox,
  MultiSelect,
  Collapse,
} from '@mantine/core';
import type {
  ReportFormat,
  ReportParameters,
  HazopsAnalysisWithDetails,
  ReportTemplateWithCreator,
  ApiError,
} from '@hazop/types';
import { REPORT_FORMAT_LABELS } from '@hazop/types';
import { reportsService } from '../../services/reports.service';

// ============================================================================
// Types
// ============================================================================

/**
 * Props for the ReportRequestForm component.
 */
export interface ReportRequestFormProps {
  /** ID of the project to generate report for */
  projectId: string;

  /** Available analyses to choose from */
  analyses: HazopsAnalysisWithDetails[];

  /** Available templates to choose from */
  templates: ReportTemplateWithCreator[];

  /** Callback when report generation is successfully started */
  onReportRequested: (reportId: string) => void;

  /** Optional: Disable form interactions */
  disabled?: boolean;
}

/**
 * Risk level filter options.
 */
const RISK_LEVEL_OPTIONS = [
  { value: 'low', label: 'Low Risk' },
  { value: 'medium', label: 'Medium Risk' },
  { value: 'high', label: 'High Risk' },
];

// ============================================================================
// Component
// ============================================================================

/**
 * ReportRequestForm component.
 *
 * Provides a comprehensive form for configuring and submitting report
 * generation requests. Includes basic selections (analysis, format, template)
 * and advanced customization options.
 */
export function ReportRequestForm({
  projectId,
  analyses,
  templates,
  onReportRequested,
  disabled = false,
}: ReportRequestFormProps) {
  // Basic form state
  const [selectedAnalysis, setSelectedAnalysis] = useState<string | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<ReportFormat | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [reportName, setReportName] = useState('');

  // Advanced options state (ReportParameters)
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [includeRiskMatrix, setIncludeRiskMatrix] = useState(true);
  const [includeCompliance, setIncludeCompliance] = useState(true);
  const [includeLopa, setIncludeLopa] = useState(true);
  const [includePidImages, setIncludePidImages] = useState(true);
  const [includeNodeCoordinates, setIncludeNodeCoordinates] = useState(false);
  const [includeNotes, setIncludeNotes] = useState(true);
  const [includeRecommendations, setIncludeRecommendations] = useState(true);
  const [riskLevelFilter, setRiskLevelFilter] = useState<string[]>([]);
  const [customTitle, setCustomTitle] = useState('');
  const [customFooter, setCustomFooter] = useState('');

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Filter templates based on selected format.
   */
  const filteredTemplates = useMemo(() => {
    if (!selectedFormat) return templates;
    return templates.filter((t) => t.supportedFormats.includes(selectedFormat));
  }, [templates, selectedFormat]);

  /**
   * Reset template selection when format changes and template is incompatible.
   */
  useEffect(() => {
    if (selectedTemplate && selectedFormat) {
      const currentTemplate = templates.find((t) => t.id === selectedTemplate);
      if (currentTemplate && !currentTemplate.supportedFormats.includes(selectedFormat)) {
        setSelectedTemplate(null);
      }
    }
  }, [selectedFormat, selectedTemplate, templates]);

  /**
   * Check if form is valid for submission.
   */
  const isFormValid = useMemo(() => {
    return Boolean(selectedAnalysis && selectedFormat && selectedTemplate);
  }, [selectedAnalysis, selectedFormat, selectedTemplate]);

  /**
   * Build report parameters from form state.
   */
  const buildParameters = useCallback((): ReportParameters | undefined => {
    // Only include parameters if any have been customized
    const hasCustomization =
      !includeRiskMatrix ||
      !includeCompliance ||
      !includeLopa ||
      !includePidImages ||
      includeNodeCoordinates ||
      !includeNotes ||
      !includeRecommendations ||
      riskLevelFilter.length > 0 ||
      customTitle.trim() ||
      customFooter.trim();

    if (!hasCustomization) return undefined;

    const params: ReportParameters = {};

    // Include/exclude options (only set if non-default)
    if (!includeRiskMatrix) params.includeRiskMatrix = false;
    if (!includeCompliance) params.includeCompliance = false;
    if (!includeLopa) params.includeLopa = false;
    if (!includePidImages) params.includePidImages = false;
    if (includeNodeCoordinates) params.includeNodeCoordinates = true;
    if (!includeNotes) params.includeNotes = false;
    if (!includeRecommendations) params.includeRecommendations = false;

    // Filters
    if (riskLevelFilter.length > 0) {
      params.riskLevelFilter = riskLevelFilter as ('low' | 'medium' | 'high')[];
    }

    // Custom text
    if (customTitle.trim()) params.customTitle = customTitle.trim();
    if (customFooter.trim()) params.customFooter = customFooter.trim();

    return params;
  }, [
    includeRiskMatrix,
    includeCompliance,
    includeLopa,
    includePidImages,
    includeNodeCoordinates,
    includeNotes,
    includeRecommendations,
    riskLevelFilter,
    customTitle,
    customFooter,
  ]);

  /**
   * Handle form submission.
   */
  const handleSubmit = useCallback(async () => {
    if (!isFormValid || !selectedAnalysis || !selectedFormat || !selectedTemplate) {
      setError('Please select an analysis, format, and template');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    const parameters = buildParameters();

    const result = await reportsService.createReport(projectId, {
      analysisId: selectedAnalysis,
      format: selectedFormat,
      template: selectedTemplate,
      name: reportName.trim() || undefined,
      parameters,
    });

    setIsSubmitting(false);

    if (result.success && result.data) {
      // Reset form
      setSelectedAnalysis(null);
      setSelectedFormat(null);
      setSelectedTemplate(null);
      setReportName('');
      setShowAdvanced(false);
      resetAdvancedOptions();

      onReportRequested(result.data.reportId);
    } else {
      setError(result.error?.message || 'Failed to start report generation');
    }
  }, [
    isFormValid,
    selectedAnalysis,
    selectedFormat,
    selectedTemplate,
    reportName,
    projectId,
    buildParameters,
    onReportRequested,
  ]);

  /**
   * Reset advanced options to defaults.
   */
  const resetAdvancedOptions = () => {
    setIncludeRiskMatrix(true);
    setIncludeCompliance(true);
    setIncludeLopa(true);
    setIncludePidImages(true);
    setIncludeNodeCoordinates(false);
    setIncludeNotes(true);
    setIncludeRecommendations(true);
    setRiskLevelFilter([]);
    setCustomTitle('');
    setCustomFooter('');
  };

  /**
   * Format options for the Select dropdown.
   */
  const formatOptions = [
    { value: 'pdf', label: REPORT_FORMAT_LABELS.pdf },
    { value: 'word', label: REPORT_FORMAT_LABELS.word },
    { value: 'excel', label: REPORT_FORMAT_LABELS.excel },
    { value: 'powerpoint', label: REPORT_FORMAT_LABELS.powerpoint },
  ];

  /**
   * Analysis options for the Select dropdown.
   */
  const analysisOptions = analyses.map((a) => ({
    value: a.id,
    label: `${a.name} (${a.status})`,
  }));

  /**
   * Template options for the Select dropdown.
   */
  const templateOptions = filteredTemplates.map((t) => ({
    value: t.id,
    label: t.name,
    description: t.description || undefined,
  }));

  return (
    <div className="bg-white border border-slate-200 rounded p-6">
      <h2 className="text-sm font-semibold text-slate-900 uppercase tracking-wide mb-6">
        New Report Request
      </h2>

      {error && (
        <Alert
          color="red"
          mb="md"
          onClose={() => setError(null)}
          withCloseButton
          styles={{ root: { borderRadius: '4px' } }}
        >
          {error}
        </Alert>
      )}

      {/* Basic Options Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Analysis Selection */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Analysis <span className="text-red-500">*</span>
          </label>
          <Select
            placeholder="Select an analysis"
            data={analysisOptions}
            value={selectedAnalysis}
            onChange={setSelectedAnalysis}
            disabled={disabled || isSubmitting || analyses.length === 0}
            styles={{
              input: {
                borderRadius: '4px',
                '&:focus': { borderColor: '#1e40af' },
              },
            }}
          />
          {analyses.length === 0 && (
            <p className="text-xs text-slate-500 mt-1">
              No approved or in-review analyses available
            </p>
          )}
        </div>

        {/* Format Selection */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Output Format <span className="text-red-500">*</span>
          </label>
          <Select
            placeholder="Select format"
            data={formatOptions}
            value={selectedFormat}
            onChange={(value) => setSelectedFormat(value as ReportFormat)}
            disabled={disabled || isSubmitting}
            styles={{
              input: {
                borderRadius: '4px',
                '&:focus': { borderColor: '#1e40af' },
              },
            }}
          />
        </div>

        {/* Template Selection */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Template <span className="text-red-500">*</span>
          </label>
          <Select
            placeholder="Select a template"
            data={templateOptions}
            value={selectedTemplate}
            onChange={setSelectedTemplate}
            disabled={disabled || isSubmitting || !selectedFormat || filteredTemplates.length === 0}
            styles={{
              input: {
                borderRadius: '4px',
                '&:focus': { borderColor: '#1e40af' },
              },
            }}
          />
          {selectedFormat && filteredTemplates.length === 0 && (
            <p className="text-xs text-slate-500 mt-1">
              No templates available for this format
            </p>
          )}
        </div>

        {/* Report Name */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Report Name
          </label>
          <TextInput
            placeholder="Optional custom name"
            value={reportName}
            onChange={(e) => setReportName(e.target.value)}
            disabled={disabled || isSubmitting}
            styles={{
              input: {
                borderRadius: '4px',
                '&:focus': { borderColor: '#1e40af' },
              },
            }}
          />
          <p className="text-xs text-slate-500 mt-1">
            Leave blank to use default naming
          </p>
        </div>
      </div>

      {/* Advanced Options Toggle */}
      <div className="mt-6 pt-6 border-t border-slate-200">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 transition-colors"
          disabled={disabled || isSubmitting}
        >
          <svg
            className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-90' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span className="font-medium">Advanced Options</span>
          {showAdvanced && (
            <span className="text-slate-400 font-normal">(customize report content)</span>
          )}
        </button>

        <Collapse in={showAdvanced}>
          <div className="mt-4 pl-6">
            {/* Content Sections */}
            <div className="mb-6">
              <h3 className="text-sm font-medium text-slate-700 mb-3">Include Sections</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Checkbox
                  label="Risk Matrix"
                  checked={includeRiskMatrix}
                  onChange={(e) => setIncludeRiskMatrix(e.currentTarget.checked)}
                  disabled={disabled || isSubmitting}
                  styles={{
                    input: { borderRadius: '4px' },
                    label: { fontSize: '0.875rem', color: '#475569' },
                  }}
                />
                <Checkbox
                  label="Compliance"
                  checked={includeCompliance}
                  onChange={(e) => setIncludeCompliance(e.currentTarget.checked)}
                  disabled={disabled || isSubmitting}
                  styles={{
                    input: { borderRadius: '4px' },
                    label: { fontSize: '0.875rem', color: '#475569' },
                  }}
                />
                <Checkbox
                  label="LOPA Analysis"
                  checked={includeLopa}
                  onChange={(e) => setIncludeLopa(e.currentTarget.checked)}
                  disabled={disabled || isSubmitting}
                  styles={{
                    input: { borderRadius: '4px' },
                    label: { fontSize: '0.875rem', color: '#475569' },
                  }}
                />
                <Checkbox
                  label="P&ID Images"
                  checked={includePidImages}
                  onChange={(e) => setIncludePidImages(e.currentTarget.checked)}
                  disabled={disabled || isSubmitting}
                  styles={{
                    input: { borderRadius: '4px' },
                    label: { fontSize: '0.875rem', color: '#475569' },
                  }}
                />
                <Checkbox
                  label="Node Coordinates"
                  checked={includeNodeCoordinates}
                  onChange={(e) => setIncludeNodeCoordinates(e.currentTarget.checked)}
                  disabled={disabled || isSubmitting}
                  styles={{
                    input: { borderRadius: '4px' },
                    label: { fontSize: '0.875rem', color: '#475569' },
                  }}
                />
                <Checkbox
                  label="Notes"
                  checked={includeNotes}
                  onChange={(e) => setIncludeNotes(e.currentTarget.checked)}
                  disabled={disabled || isSubmitting}
                  styles={{
                    input: { borderRadius: '4px' },
                    label: { fontSize: '0.875rem', color: '#475569' },
                  }}
                />
                <Checkbox
                  label="Recommendations"
                  checked={includeRecommendations}
                  onChange={(e) => setIncludeRecommendations(e.currentTarget.checked)}
                  disabled={disabled || isSubmitting}
                  styles={{
                    input: { borderRadius: '4px' },
                    label: { fontSize: '0.875rem', color: '#475569' },
                  }}
                />
              </div>
            </div>

            {/* Risk Level Filter */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Filter by Risk Level
              </label>
              <MultiSelect
                placeholder="All risk levels (no filter)"
                data={RISK_LEVEL_OPTIONS}
                value={riskLevelFilter}
                onChange={setRiskLevelFilter}
                disabled={disabled || isSubmitting}
                clearable
                styles={{
                  input: {
                    borderRadius: '4px',
                    '&:focus-within': { borderColor: '#1e40af' },
                  },
                }}
              />
              <p className="text-xs text-slate-500 mt-1">
                Leave empty to include all risk levels
              </p>
            </div>

            {/* Custom Text Section */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Custom Title */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Custom Title
                </label>
                <TextInput
                  placeholder="Override default report title"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  disabled={disabled || isSubmitting}
                  styles={{
                    input: {
                      borderRadius: '4px',
                      '&:focus': { borderColor: '#1e40af' },
                    },
                  }}
                />
              </div>

              {/* Custom Footer */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Custom Footer
                </label>
                <Textarea
                  placeholder="Add custom footer text"
                  value={customFooter}
                  onChange={(e) => setCustomFooter(e.target.value)}
                  disabled={disabled || isSubmitting}
                  minRows={1}
                  maxRows={3}
                  styles={{
                    input: {
                      borderRadius: '4px',
                      '&:focus': { borderColor: '#1e40af' },
                    },
                  }}
                />
              </div>
            </div>

            {/* Reset Advanced Options */}
            <div className="mt-4">
              <button
                type="button"
                onClick={resetAdvancedOptions}
                className="text-xs text-slate-500 hover:text-slate-700 underline"
                disabled={disabled || isSubmitting}
              >
                Reset to defaults
              </button>
            </div>
          </div>
        </Collapse>
      </div>

      {/* Submit Button */}
      <div className="mt-6 pt-6 border-t border-slate-200">
        <Button
          onClick={handleSubmit}
          loading={isSubmitting}
          disabled={disabled || !isFormValid}
          styles={{
            root: {
              borderRadius: '4px',
              backgroundColor: '#1e40af',
              '&:hover': { backgroundColor: '#1e3a8a' },
              '&:disabled': { backgroundColor: '#94a3b8' },
            },
          }}
        >
          Generate Report
        </Button>
      </div>
    </div>
  );
}

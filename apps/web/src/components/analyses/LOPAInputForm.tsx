/**
 * LOPA (Layers of Protection Analysis) input form component.
 *
 * Allows users to create a LOPA analysis for a HazOps analysis entry.
 * This form collects:
 * - Scenario description and consequence
 * - Initiating event (category, description, frequency)
 * - Independent Protection Layers (IPLs)
 * - Target frequency
 *
 * The form performs LOPA calculation on submit and displays results.
 */

import { useState, useCallback, useMemo } from 'react';
import {
  TextInput,
  Textarea,
  Select,
  NumberInput,
  Button,
  Alert,
  Checkbox,
  ActionIcon,
  Tooltip,
  Loader,
} from '@mantine/core';
import type { AnalysisEntry, ApiError, SeverityLevel } from '@hazop/types';
import {
  INITIATING_EVENT_CATEGORIES,
  INITIATING_EVENT_CATEGORY_LABELS,
  TYPICAL_INITIATING_EVENT_FREQUENCIES,
  IPL_TYPES,
  IPL_TYPE_LABELS,
  IPL_TYPE_DESCRIPTIONS,
  IPL_TYPICAL_PFD,
  SAFETY_INTEGRITY_LEVELS,
  SIL_LABELS,
  SIL_TYPICAL_PFD,
  SEVERITY_TO_TARGET_FREQUENCY,
  type InitiatingEventCategory,
  type IPLType,
  type SafetyIntegrityLevel,
} from '@hazop/types';
import { lopaService, type CreateIPLInput, type CreateLOPAPayload } from '../../services/lopa.service';

/**
 * Props for the LOPAInputForm component.
 */
export interface LOPAInputFormProps {
  /** The analysis entry to create LOPA for */
  entry: AnalysisEntry;

  /** Severity level from the entry's risk ranking (required for LOPA) */
  severity: SeverityLevel;

  /** Callback when LOPA is successfully created */
  onSuccess?: () => void;

  /** Callback when the form is cancelled */
  onCancel?: () => void;

  /** Whether the form is disabled */
  disabled?: boolean;
}

/**
 * Local IPL state with client-side ID for list management.
 */
interface LocalIPL extends CreateIPLInput {
  clientId: string;
}

/**
 * Generate a unique client ID for IPL list management.
 */
function generateClientId(): string {
  return `ipl-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Format a frequency value in scientific notation.
 */
function formatFrequency(value: number): string {
  if (value >= 1) {
    return value.toFixed(1);
  }
  return value.toExponential(1);
}

/**
 * LOPA input form for creating Layers of Protection Analysis.
 */
export function LOPAInputForm({
  entry,
  severity,
  onSuccess,
  onCancel,
  disabled = false,
}: LOPAInputFormProps) {
  // Form state
  const [scenarioDescription, setScenarioDescription] = useState(
    `${entry.deviation} at ${entry.parameter}`
  );
  const [consequence, setConsequence] = useState(
    entry.consequences.length > 0 ? entry.consequences[0] : ''
  );
  const [initiatingEventCategory, setInitiatingEventCategory] = useState<InitiatingEventCategory | null>(null);
  const [initiatingEventDescription, setInitiatingEventDescription] = useState('');
  const [initiatingEventFrequency, setInitiatingEventFrequency] = useState<number | ''>(0.1);
  const [targetFrequency, setTargetFrequency] = useState<number | ''>(
    SEVERITY_TO_TARGET_FREQUENCY[severity]
  );
  const [notes, setNotes] = useState('');

  // IPLs state
  const [ipls, setIpls] = useState<LocalIPL[]>([]);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);

  /**
   * Get suggested frequency based on initiating event category.
   */
  const suggestedFrequency = useMemo(() => {
    if (!initiatingEventCategory) return null;
    return TYPICAL_INITIATING_EVENT_FREQUENCIES[initiatingEventCategory];
  }, [initiatingEventCategory]);

  /**
   * Calculate total Risk Reduction Factor from IPLs.
   */
  const totalRRF = useMemo(() => {
    if (ipls.length === 0) return 1;
    return ipls.reduce((acc, ipl) => acc * (1 / ipl.pfd), 1);
  }, [ipls]);

  /**
   * Calculate estimated mitigated event likelihood.
   */
  const estimatedMEL = useMemo(() => {
    if (typeof initiatingEventFrequency !== 'number' || initiatingEventFrequency <= 0) return null;
    return initiatingEventFrequency / totalRRF;
  }, [initiatingEventFrequency, totalRRF]);

  /**
   * Check if estimated MEL meets target frequency.
   */
  const meetsTarget = useMemo(() => {
    if (estimatedMEL === null || typeof targetFrequency !== 'number') return null;
    return estimatedMEL <= targetFrequency;
  }, [estimatedMEL, targetFrequency]);

  /**
   * Add a new IPL to the list.
   */
  const handleAddIPL = useCallback(() => {
    const newIPL: LocalIPL = {
      clientId: generateClientId(),
      type: 'basic_process_control',
      name: '',
      description: '',
      pfd: 0.1,
      independentOfInitiator: true,
      independentOfOtherIPLs: true,
    };
    setIpls((prev) => [...prev, newIPL]);
  }, []);

  /**
   * Remove an IPL from the list.
   */
  const handleRemoveIPL = useCallback((clientId: string) => {
    setIpls((prev) => prev.filter((ipl) => ipl.clientId !== clientId));
  }, []);

  /**
   * Update an IPL field.
   */
  const handleUpdateIPL = useCallback(<K extends keyof LocalIPL>(
    clientId: string,
    field: K,
    value: LocalIPL[K]
  ) => {
    setIpls((prev) =>
      prev.map((ipl) =>
        ipl.clientId === clientId ? { ...ipl, [field]: value } : ipl
      )
    );
  }, []);

  /**
   * Handle IPL type change - update PFD to typical value.
   */
  const handleIPLTypeChange = useCallback((clientId: string, type: IPLType) => {
    setIpls((prev) =>
      prev.map((ipl) =>
        ipl.clientId === clientId
          ? { ...ipl, type, pfd: IPL_TYPICAL_PFD[type] }
          : ipl
      )
    );
  }, []);

  /**
   * Handle initiating event category change.
   */
  const handleCategoryChange = useCallback((value: string | null) => {
    if (value) {
      const category = value as InitiatingEventCategory;
      setInitiatingEventCategory(category);
      // Update frequency to typical value
      setInitiatingEventFrequency(TYPICAL_INITIATING_EVENT_FREQUENCIES[category].typical);
    } else {
      setInitiatingEventCategory(null);
    }
  }, []);

  /**
   * Apply suggested frequency from category.
   */
  const handleApplySuggestedFrequency = useCallback(() => {
    if (suggestedFrequency) {
      setInitiatingEventFrequency(suggestedFrequency.typical);
    }
  }, [suggestedFrequency]);

  /**
   * Validate the form before submission.
   */
  const validateForm = useCallback((): string[] => {
    const errors: string[] = [];

    if (!scenarioDescription.trim()) {
      errors.push('Scenario description is required');
    }
    if (!consequence.trim()) {
      errors.push('Consequence is required');
    }
    if (!initiatingEventCategory) {
      errors.push('Initiating event category is required');
    }
    if (!initiatingEventDescription.trim()) {
      errors.push('Initiating event description is required');
    }
    if (typeof initiatingEventFrequency !== 'number' || initiatingEventFrequency <= 0) {
      errors.push('Initiating event frequency must be a positive number');
    }
    if (typeof targetFrequency !== 'number' || targetFrequency <= 0) {
      errors.push('Target frequency must be a positive number');
    }
    if (typeof initiatingEventFrequency === 'number' && typeof targetFrequency === 'number' &&
        targetFrequency >= initiatingEventFrequency) {
      errors.push('Target frequency must be less than initiating event frequency');
    }

    // Validate IPLs
    for (const ipl of ipls) {
      if (!ipl.name.trim()) {
        errors.push(`IPL name is required for all protection layers`);
        break;
      }
      if (ipl.pfd <= 0 || ipl.pfd > 1) {
        errors.push(`IPL PFD must be between 0 and 1`);
        break;
      }
      if (ipl.type === 'safety_instrumented_function' && !ipl.sil) {
        errors.push(`SIL level is required for Safety Instrumented Functions`);
        break;
      }
    }

    return errors;
  }, [scenarioDescription, consequence, initiatingEventCategory, initiatingEventDescription, initiatingEventFrequency, targetFrequency, ipls]);

  /**
   * Handle form submission.
   */
  const handleSubmit = useCallback(async () => {
    // Validate form
    const validationErrors = validateForm();
    if (validationErrors.length > 0) {
      setError({
        code: 'VALIDATION_ERROR',
        message: validationErrors.join('. '),
      });
      return;
    }

    setIsSubmitting(true);
    setError(null);

    // Build payload (remove clientId from IPLs)
    const payload: CreateLOPAPayload = {
      scenarioDescription: scenarioDescription.trim(),
      consequence: consequence.trim(),
      initiatingEventCategory: initiatingEventCategory!,
      initiatingEventDescription: initiatingEventDescription.trim(),
      initiatingEventFrequency: initiatingEventFrequency as number,
      ipls: ipls.map(({ clientId, ...ipl }) => ipl),
      targetFrequency: targetFrequency as number,
      notes: notes.trim() || undefined,
    };

    const result = await lopaService.createLOPA(entry.id, payload);

    setIsSubmitting(false);

    if (result.success) {
      onSuccess?.();
    } else {
      setError(result.error || { code: 'UNKNOWN', message: 'Failed to create LOPA analysis' });
    }
  }, [validateForm, scenarioDescription, consequence, initiatingEventCategory, initiatingEventDescription, initiatingEventFrequency, ipls, targetFrequency, notes, entry.id, onSuccess]);

  // Initiating event category options
  const categoryOptions = INITIATING_EVENT_CATEGORIES.map((cat) => ({
    value: cat,
    label: INITIATING_EVENT_CATEGORY_LABELS[cat],
  }));

  // IPL type options
  const iplTypeOptions = IPL_TYPES.map((type) => ({
    value: type,
    label: IPL_TYPE_LABELS[type],
  }));

  // SIL options
  const silOptions = SAFETY_INTEGRITY_LEVELS.map((sil) => ({
    value: String(sil),
    label: SIL_LABELS[sil],
  }));

  return (
    <div className="lopa-input-form space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-sm font-semibold text-slate-900">LOPA Analysis</h3>
        <p className="text-xs text-slate-500 mt-1">
          Layers of Protection Analysis for risk reduction verification
        </p>
      </div>

      {/* Error Display */}
      {error && (
        <Alert
          color="red"
          variant="light"
          styles={{ root: { borderRadius: '4px' } }}
          withCloseButton
          onClose={() => setError(null)}
        >
          {error.message}
        </Alert>
      )}

      {/* Section: Scenario */}
      <div className="space-y-3">
        <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">
          Scenario Description
        </div>

        <Textarea
          label="Scenario"
          description="Describe the hazardous scenario being analyzed"
          value={scenarioDescription}
          onChange={(e) => setScenarioDescription(e.target.value)}
          disabled={disabled || isSubmitting}
          required
          minRows={2}
          styles={{
            input: { borderRadius: '4px' },
            label: { fontSize: '0.75rem', fontWeight: 500, color: '#334155' },
            description: { fontSize: '0.7rem' },
          }}
        />

        <Textarea
          label="Consequence"
          description="The potential outcome if the scenario occurs"
          value={consequence}
          onChange={(e) => setConsequence(e.target.value)}
          disabled={disabled || isSubmitting}
          required
          minRows={2}
          styles={{
            input: { borderRadius: '4px' },
            label: { fontSize: '0.75rem', fontWeight: 500, color: '#334155' },
            description: { fontSize: '0.7rem' },
          }}
        />
      </div>

      {/* Section: Initiating Event */}
      <div className="space-y-3">
        <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">
          Initiating Event
        </div>

        <Select
          label="Category"
          description="Type of event that initiates the scenario"
          placeholder="Select category"
          data={categoryOptions}
          value={initiatingEventCategory}
          onChange={handleCategoryChange}
          disabled={disabled || isSubmitting}
          required
          styles={{
            input: { borderRadius: '4px' },
            label: { fontSize: '0.75rem', fontWeight: 500, color: '#334155' },
            description: { fontSize: '0.7rem' },
          }}
        />

        <TextInput
          label="Description"
          description="Specific description of the initiating event"
          placeholder="e.g., Pump seal failure, Operator error during startup"
          value={initiatingEventDescription}
          onChange={(e) => setInitiatingEventDescription(e.target.value)}
          disabled={disabled || isSubmitting}
          required
          styles={{
            input: { borderRadius: '4px' },
            label: { fontSize: '0.75rem', fontWeight: 500, color: '#334155' },
            description: { fontSize: '0.7rem' },
          }}
        />

        <div>
          <NumberInput
            label="Frequency (per year)"
            description="Estimated frequency of the initiating event"
            value={initiatingEventFrequency}
            onChange={(value) => setInitiatingEventFrequency(value === '' ? '' : Number(value))}
            disabled={disabled || isSubmitting}
            required
            min={0.0000001}
            max={100}
            step={0.01}
            decimalScale={6}
            styles={{
              input: { borderRadius: '4px' },
              label: { fontSize: '0.75rem', fontWeight: 500, color: '#334155' },
              description: { fontSize: '0.7rem' },
            }}
          />
          {suggestedFrequency && (
            <div className="mt-1 flex items-center gap-2">
              <span className="text-xs text-slate-500">
                Typical: {formatFrequency(suggestedFrequency.typical)}/yr
                ({suggestedFrequency.description})
              </span>
              <button
                type="button"
                onClick={handleApplySuggestedFrequency}
                className="text-xs text-blue-700 hover:text-blue-800 underline"
                disabled={disabled || isSubmitting}
              >
                Apply
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Section: Target Frequency */}
      <div className="space-y-3">
        <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">
          Target Frequency
        </div>

        <NumberInput
          label="Target Mitigated Event Likelihood (per year)"
          description={`Based on severity level ${severity}, target is ${formatFrequency(SEVERITY_TO_TARGET_FREQUENCY[severity])}/yr`}
          value={targetFrequency}
          onChange={(value) => setTargetFrequency(value === '' ? '' : Number(value))}
          disabled={disabled || isSubmitting}
          required
          min={0.0000001}
          max={1}
          step={0.000001}
          decimalScale={8}
          styles={{
            input: { borderRadius: '4px' },
            label: { fontSize: '0.75rem', fontWeight: 500, color: '#334155' },
            description: { fontSize: '0.7rem' },
          }}
        />
      </div>

      {/* Section: IPLs */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wide">
            Independent Protection Layers ({ipls.length})
          </div>
          <Button
            variant="light"
            color="blue"
            size="xs"
            onClick={handleAddIPL}
            disabled={disabled || isSubmitting}
            styles={{ root: { borderRadius: '4px' } }}
          >
            Add IPL
          </Button>
        </div>

        {ipls.length === 0 ? (
          <div className="text-center py-6 bg-slate-50 rounded border border-slate-200">
            <p className="text-sm text-slate-500">No protection layers added yet.</p>
            <p className="text-xs text-slate-400 mt-1">
              Click "Add IPL" to add independent protection layers.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {ipls.map((ipl, index) => (
              <IPLEditor
                key={ipl.clientId}
                ipl={ipl}
                index={index}
                iplTypeOptions={iplTypeOptions}
                silOptions={silOptions}
                disabled={disabled || isSubmitting}
                onUpdate={(field, value) => handleUpdateIPL(ipl.clientId, field, value)}
                onTypeChange={(type) => handleIPLTypeChange(ipl.clientId, type)}
                onRemove={() => handleRemoveIPL(ipl.clientId)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Section: Preliminary Results */}
      {ipls.length > 0 && typeof initiatingEventFrequency === 'number' && initiatingEventFrequency > 0 && (
        <div className="bg-slate-50 rounded border border-slate-200 p-4">
          <div className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">
            Preliminary Calculation
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-slate-500">Total RRF:</span>
              <span className="ml-2 font-mono font-medium text-slate-900">
                {totalRRF.toFixed(0)}
              </span>
            </div>
            <div>
              <span className="text-slate-500">Estimated MEL:</span>
              <span className="ml-2 font-mono font-medium text-slate-900">
                {estimatedMEL !== null ? formatFrequency(estimatedMEL) : '-'}/yr
              </span>
            </div>
            {meetsTarget !== null && (
              <div className="col-span-2">
                <span className="text-slate-500">Status:</span>
                <span
                  className={`ml-2 font-medium ${
                    meetsTarget ? 'text-green-700' : 'text-red-700'
                  }`}
                >
                  {meetsTarget ? 'Meets target frequency' : 'Does NOT meet target frequency'}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Section: Notes */}
      <div className="space-y-3">
        <Textarea
          label="Notes (Optional)"
          description="Additional notes, assumptions, or justifications"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={disabled || isSubmitting}
          minRows={2}
          styles={{
            input: { borderRadius: '4px' },
            label: { fontSize: '0.75rem', fontWeight: 500, color: '#334155' },
            description: { fontSize: '0.7rem' },
          }}
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
        {onCancel && (
          <Button
            variant="subtle"
            color="gray"
            onClick={onCancel}
            disabled={isSubmitting}
            styles={{ root: { borderRadius: '4px' } }}
          >
            Cancel
          </Button>
        )}
        <Button
          variant="filled"
          color="blue"
          onClick={handleSubmit}
          disabled={disabled || isSubmitting}
          loading={isSubmitting}
          styles={{ root: { borderRadius: '4px' } }}
        >
          Create LOPA Analysis
        </Button>
      </div>
    </div>
  );
}

/**
 * Props for the IPL editor component.
 */
interface IPLEditorProps {
  ipl: LocalIPL;
  index: number;
  iplTypeOptions: { value: string; label: string }[];
  silOptions: { value: string; label: string }[];
  disabled: boolean;
  onUpdate: <K extends keyof LocalIPL>(field: K, value: LocalIPL[K]) => void;
  onTypeChange: (type: IPLType) => void;
  onRemove: () => void;
}

/**
 * Editor for a single IPL.
 */
function IPLEditor({
  ipl,
  index,
  iplTypeOptions,
  silOptions,
  disabled,
  onUpdate,
  onTypeChange,
  onRemove,
}: IPLEditorProps) {
  const rrf = 1 / ipl.pfd;
  const typeDescription = IPL_TYPE_DESCRIPTIONS[ipl.type];

  return (
    <div className="border border-slate-200 rounded p-4 bg-white">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-slate-500">IPL {index + 1}</span>
        <Tooltip label="Remove IPL">
          <ActionIcon
            variant="subtle"
            color="red"
            size="sm"
            onClick={onRemove}
            disabled={disabled}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.519.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
            </svg>
          </ActionIcon>
        </Tooltip>
      </div>

      {/* Fields */}
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <Select
            label="Type"
            placeholder="Select IPL type"
            data={iplTypeOptions}
            value={ipl.type}
            onChange={(value) => value && onTypeChange(value as IPLType)}
            disabled={disabled}
            required
            size="xs"
            styles={{
              input: { borderRadius: '4px' },
              label: { fontSize: '0.7rem', fontWeight: 500, color: '#334155' },
            }}
          />
          {typeDescription && (
            <p className="text-xs text-slate-400 mt-1">{typeDescription}</p>
          )}
        </div>

        <TextInput
          label="Name/Tag"
          placeholder="e.g., LAHH-101, PSV-102"
          value={ipl.name}
          onChange={(e) => onUpdate('name', e.target.value)}
          disabled={disabled}
          required
          size="xs"
          styles={{
            input: { borderRadius: '4px' },
            label: { fontSize: '0.7rem', fontWeight: 500, color: '#334155' },
          }}
        />

        <NumberInput
          label="PFD"
          description={`RRF: ${rrf.toFixed(0)}`}
          value={ipl.pfd}
          onChange={(value) => onUpdate('pfd', typeof value === 'number' ? value : 0.1)}
          disabled={disabled}
          required
          min={0.00001}
          max={1}
          step={0.001}
          decimalScale={5}
          size="xs"
          styles={{
            input: { borderRadius: '4px' },
            label: { fontSize: '0.7rem', fontWeight: 500, color: '#334155' },
            description: { fontSize: '0.65rem' },
          }}
        />

        {/* SIL selector for SIF */}
        {ipl.type === 'safety_instrumented_function' && (
          <Select
            label="SIL Level"
            placeholder="Select SIL"
            data={silOptions}
            value={ipl.sil ? String(ipl.sil) : null}
            onChange={(value) => {
              if (value) {
                const sil = parseInt(value, 10) as SafetyIntegrityLevel;
                onUpdate('sil', sil);
                // Update PFD to typical for SIL
                onUpdate('pfd', SIL_TYPICAL_PFD[sil]);
              }
            }}
            disabled={disabled}
            required
            size="xs"
            styles={{
              input: { borderRadius: '4px' },
              label: { fontSize: '0.7rem', fontWeight: 500, color: '#334155' },
            }}
          />
        )}

        <div className="col-span-2">
          <TextInput
            label="Description"
            placeholder="Brief description of how the IPL provides protection"
            value={ipl.description}
            onChange={(e) => onUpdate('description', e.target.value)}
            disabled={disabled}
            size="xs"
            styles={{
              input: { borderRadius: '4px' },
              label: { fontSize: '0.7rem', fontWeight: 500, color: '#334155' },
            }}
          />
        </div>

        <div className="col-span-2 flex flex-wrap gap-4">
          <Checkbox
            label="Independent of initiator"
            checked={ipl.independentOfInitiator}
            onChange={(e) => onUpdate('independentOfInitiator', e.target.checked)}
            disabled={disabled}
            size="xs"
            styles={{
              label: { fontSize: '0.75rem', color: '#334155' },
            }}
          />
          <Checkbox
            label="Independent of other IPLs"
            checked={ipl.independentOfOtherIPLs}
            onChange={(e) => onUpdate('independentOfOtherIPLs', e.target.checked)}
            disabled={disabled}
            size="xs"
            styles={{
              label: { fontSize: '0.75rem', color: '#334155' },
            }}
          />
        </div>
      </div>
    </div>
  );
}

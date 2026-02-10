/**
 * Prepared Causes service.
 *
 * Provides configurable templates for causes in HazOps analysis.
 * Causes are organized by equipment type and guide word to help analysts
 * quickly select relevant causes for deviations.
 *
 * Industry-standard cause categories include:
 * - Equipment failure modes
 * - Human factors and operator error
 * - Control system failures
 * - Utility failures
 * - Process upsets
 * - External factors
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  GuideWord,
  EquipmentType,
  PreparedAnswer,
  PreparedAnswerTemplate,
  PreparedAnswersResponse,
  PreparedAnswersFilteredResponse,
  PreparedAnswersQuery,
} from '@hazop/types';
import { EQUIPMENT_TYPES, GUIDE_WORDS } from '@hazop/types';

// ============================================================================
// Cause Templates by Category
// ============================================================================

/**
 * Equipment failure causes - applicable to specific equipment types
 */
const EQUIPMENT_FAILURE_CAUSES: PreparedAnswerTemplate[] = [
  // Pump-specific causes
  {
    text: 'Pump mechanical failure',
    description: 'Bearing failure, seal failure, impeller damage, or shaft breakage',
    equipmentTypes: ['pump'],
    guideWords: ['no', 'less'],
    isCommon: true,
  },
  {
    text: 'Pump cavitation',
    description: 'Insufficient NPSH causing vapor bubbles to form and collapse',
    equipmentTypes: ['pump'],
    guideWords: ['less', 'no'],
    isCommon: true,
  },
  {
    text: 'Pump motor failure',
    description: 'Electrical motor burnout, overheating, or winding failure',
    equipmentTypes: ['pump'],
    guideWords: ['no'],
    isCommon: true,
  },
  {
    text: 'Pump running dry',
    description: 'Loss of suction due to low level in feed tank or blocked suction line',
    equipmentTypes: ['pump'],
    guideWords: ['no', 'less'],
  },
  {
    text: 'Pump impeller wear',
    description: 'Gradual degradation of impeller causing reduced efficiency',
    equipmentTypes: ['pump'],
    guideWords: ['less'],
  },
  {
    text: 'Pump running in reverse',
    description: 'Incorrect motor wiring or VFD configuration causing reverse rotation',
    equipmentTypes: ['pump'],
    guideWords: ['reverse'],
    isCommon: true,
  },

  // Valve-specific causes
  {
    text: 'Valve stuck closed',
    description: 'Mechanical binding, actuator failure, or debris preventing opening',
    equipmentTypes: ['valve'],
    guideWords: ['no'],
    isCommon: true,
  },
  {
    text: 'Valve stuck open',
    description: 'Actuator failure, stem breakage, or seat erosion',
    equipmentTypes: ['valve'],
    guideWords: ['more'],
    isCommon: true,
  },
  {
    text: 'Valve passing (internal leakage)',
    description: 'Seat wear or damage allowing flow when closed',
    equipmentTypes: ['valve'],
    guideWords: ['more', 'reverse'],
  },
  {
    text: 'Valve actuator failure',
    description: 'Pneumatic diaphragm rupture, hydraulic leak, or motor failure',
    equipmentTypes: ['valve'],
    guideWords: ['no', 'less', 'more'],
    isCommon: true,
  },
  {
    text: 'Valve positioner malfunction',
    description: 'Incorrect signal interpretation or calibration drift',
    equipmentTypes: ['valve'],
    guideWords: ['more', 'less'],
  },
  {
    text: 'Check valve failure',
    description: 'Disc stuck open or damaged allowing reverse flow',
    equipmentTypes: ['valve'],
    guideWords: ['reverse'],
    isCommon: true,
  },

  // Reactor-specific causes
  {
    text: 'Catalyst deactivation',
    description: 'Poisoning, fouling, or thermal degradation of catalyst',
    equipmentTypes: ['reactor'],
    guideWords: ['no', 'less', 'late'],
  },
  {
    text: 'Runaway reaction',
    description: 'Loss of temperature control causing exothermic reaction to accelerate',
    equipmentTypes: ['reactor'],
    guideWords: ['more', 'early'],
    isCommon: true,
  },
  {
    text: 'Reactor fouling',
    description: 'Buildup of deposits on reactor surfaces reducing efficiency',
    equipmentTypes: ['reactor'],
    guideWords: ['less'],
  },
  {
    text: 'Wrong reactant ratio',
    description: 'Incorrect feed ratio causing incomplete or side reactions',
    equipmentTypes: ['reactor'],
    guideWords: ['other_than'],
    isCommon: true,
  },
  {
    text: 'Reaction quenched prematurely',
    description: 'Excessive cooling or inhibitor addition stopping reaction',
    equipmentTypes: ['reactor'],
    guideWords: ['no', 'late'],
  },

  // Heat exchanger-specific causes
  {
    text: 'Tube leak',
    description: 'Corrosion, erosion, or mechanical failure causing cross-contamination',
    equipmentTypes: ['heat_exchanger'],
    guideWords: ['other_than'],
    isCommon: true,
  },
  {
    text: 'Fouling/scaling',
    description: 'Deposits reducing heat transfer efficiency',
    equipmentTypes: ['heat_exchanger'],
    guideWords: ['less', 'more'],
    isCommon: true,
  },
  {
    text: 'Tube bundle blocked',
    description: 'Debris or deposits blocking tubes causing reduced flow',
    equipmentTypes: ['heat_exchanger'],
    guideWords: ['no', 'less'],
  },
  {
    text: 'Shell side bypass',
    description: 'Baffle damage or erosion allowing fluid to bypass tube bundle',
    equipmentTypes: ['heat_exchanger'],
    guideWords: ['less'],
  },

  // Tank-specific causes
  {
    text: 'Tank overflow',
    description: 'Level control failure or high feed rate causing tank to overflow',
    equipmentTypes: ['tank'],
    guideWords: ['more'],
    isCommon: true,
  },
  {
    text: 'Tank run dry',
    description: 'Level control failure or excessive withdrawal depleting contents',
    equipmentTypes: ['tank'],
    guideWords: ['no', 'less'],
    isCommon: true,
  },
  {
    text: 'Tank corrosion/leak',
    description: 'Material degradation causing loss of containment',
    equipmentTypes: ['tank'],
    guideWords: ['less', 'other_than'],
  },
  {
    text: 'Tank stratification',
    description: 'Density differences causing layering of contents',
    equipmentTypes: ['tank'],
    guideWords: ['other_than'],
  },

  // Pipe-specific causes
  {
    text: 'Pipe blockage',
    description: 'Debris, solidification, or scale buildup restricting flow',
    equipmentTypes: ['pipe'],
    guideWords: ['no', 'less'],
    isCommon: true,
  },
  {
    text: 'Pipe rupture',
    description: 'Corrosion, erosion, fatigue, or overpressure causing failure',
    equipmentTypes: ['pipe'],
    guideWords: ['no', 'less', 'other_than'],
    isCommon: true,
  },
  {
    text: 'Pipe leak (external)',
    description: 'Flange leak, valve packing leak, or small hole',
    equipmentTypes: ['pipe'],
    guideWords: ['less'],
  },
  {
    text: 'Pipe freezing',
    description: 'Low ambient temperature causing contents to solidify',
    equipmentTypes: ['pipe'],
    guideWords: ['no'],
  },
  {
    text: 'Thermal expansion stress',
    description: 'Temperature changes causing pipe stress or failure',
    equipmentTypes: ['pipe'],
    guideWords: ['other_than'],
  },
];

/**
 * Control system failure causes - applicable across equipment types
 */
const CONTROL_SYSTEM_CAUSES: PreparedAnswerTemplate[] = [
  {
    text: 'Sensor failure (high)',
    description: 'Transmitter fails high, causing incorrect control action',
    guideWords: ['more'],
    isCommon: true,
  },
  {
    text: 'Sensor failure (low)',
    description: 'Transmitter fails low, causing incorrect control action',
    guideWords: ['less', 'no'],
    isCommon: true,
  },
  {
    text: 'Sensor out of calibration',
    description: 'Drift or incorrect calibration causing inaccurate readings',
    guideWords: ['more', 'less'],
  },
  {
    text: 'Controller malfunction',
    description: 'PLC, DCS, or loop controller hardware/software failure',
    guideWords: ['no', 'more', 'less'],
    isCommon: true,
  },
  {
    text: 'Control valve failure',
    description: 'Final control element fails to respond to control signal',
    guideWords: ['no', 'more', 'less'],
  },
  {
    text: 'Incorrect setpoint',
    description: 'Operator or system error in setpoint configuration',
    guideWords: ['more', 'less', 'early', 'late'],
  },
  {
    text: 'Signal cable fault',
    description: 'Broken wire, short circuit, or cable damage',
    guideWords: ['no'],
  },
  {
    text: 'I/O module failure',
    description: 'Input/output card malfunction in control system',
    guideWords: ['no'],
  },
  {
    text: 'Interlock bypassed',
    description: 'Safety interlock disabled for maintenance or troubleshooting',
    guideWords: ['more', 'less', 'other_than'],
    isCommon: true,
  },
  {
    text: 'Software bug',
    description: 'Programming error in control logic',
    guideWords: ['other_than', 'early', 'late'],
  },
  {
    text: 'Timing relay failure',
    description: 'Timer malfunction affecting sequence timing',
    guideWords: ['early', 'late'],
  },
];

/**
 * Human factors and operator error causes
 */
const HUMAN_FACTORS_CAUSES: PreparedAnswerTemplate[] = [
  {
    text: 'Operator error - incorrect valve lineup',
    description: 'Wrong valve position during startup, shutdown, or operation',
    isCommon: true,
  },
  {
    text: 'Operator error - incorrect procedure',
    description: 'Deviation from standard operating procedure',
    guideWords: ['other_than'],
    isCommon: true,
  },
  {
    text: 'Operator error - missed alarm',
    description: 'Failure to respond to alarm condition',
    guideWords: ['more', 'less', 'late'],
  },
  {
    text: 'Maintenance error',
    description: 'Incorrect installation, assembly, or repair during maintenance',
    guideWords: ['other_than', 'reverse'],
    isCommon: true,
  },
  {
    text: 'Inadequate training',
    description: 'Operator lacks knowledge to respond correctly',
    guideWords: ['other_than'],
  },
  {
    text: 'Communication failure',
    description: 'Miscommunication during shift handover or between operators',
    guideWords: ['other_than', 'early', 'late'],
  },
  {
    text: 'Fatigue/distraction',
    description: 'Operator impaired by fatigue, stress, or distractions',
    guideWords: ['late', 'other_than'],
  },
  {
    text: 'Wrong chemical added',
    description: 'Incorrect material or grade used',
    guideWords: ['other_than'],
    isCommon: true,
  },
  {
    text: 'Premature action',
    description: 'Operator initiates action before conditions are ready',
    guideWords: ['early'],
  },
  {
    text: 'Delayed action',
    description: 'Operator delays required action',
    guideWords: ['late'],
  },
];

/**
 * Utility failure causes
 */
const UTILITY_FAILURE_CAUSES: PreparedAnswerTemplate[] = [
  {
    text: 'Power failure',
    description: 'Loss of electrical supply to equipment or controls',
    guideWords: ['no'],
    isCommon: true,
  },
  {
    text: 'Instrument air failure',
    description: 'Loss of compressed air supply to pneumatic equipment',
    guideWords: ['no'],
    isCommon: true,
  },
  {
    text: 'Cooling water failure',
    description: 'Loss of cooling water supply or low pressure',
    guideWords: ['no', 'less', 'more'],
    isCommon: true,
  },
  {
    text: 'Steam supply failure',
    description: 'Loss of steam header pressure or supply',
    guideWords: ['no', 'less'],
  },
  {
    text: 'Nitrogen supply failure',
    description: 'Loss of nitrogen for blanketing or inerting',
    guideWords: ['no', 'less'],
  },
  {
    text: 'Fuel gas failure',
    description: 'Loss of fuel gas supply to burners or heaters',
    guideWords: ['no', 'less'],
  },
  {
    text: 'Hydraulic supply failure',
    description: 'Loss of hydraulic pressure for actuators',
    guideWords: ['no'],
  },
  {
    text: 'UPS/backup power failure',
    description: 'Uninterruptible power supply fails during main power outage',
    guideWords: ['no'],
  },
];

/**
 * Process upset causes
 */
const PROCESS_UPSET_CAUSES: PreparedAnswerTemplate[] = [
  {
    text: 'Upstream process upset',
    description: 'Disturbance from preceding unit affecting feed conditions',
    isCommon: true,
  },
  {
    text: 'Downstream process upset',
    description: 'Backpressure or flow restriction from downstream unit',
    guideWords: ['more', 'less', 'no'],
  },
  {
    text: 'Feed composition change',
    description: 'Variation in feedstock quality or composition',
    guideWords: ['other_than', 'more', 'less'],
    isCommon: true,
  },
  {
    text: 'Feed rate variation',
    description: 'Fluctuation in feed flow rate from supply',
    guideWords: ['more', 'less'],
  },
  {
    text: 'Temperature excursion',
    description: 'Process temperature deviates from normal range',
    guideWords: ['more', 'less'],
  },
  {
    text: 'Pressure excursion',
    description: 'Process pressure deviates from normal range',
    guideWords: ['more', 'less'],
  },
  {
    text: 'Phase separation',
    description: 'Unexpected separation of liquid phases or gas evolution',
    guideWords: ['other_than'],
  },
  {
    text: 'Polymerization/solidification',
    description: 'Unwanted polymerization or solidification of process material',
    guideWords: ['no', 'less', 'other_than'],
  },
  {
    text: 'Contamination',
    description: 'Introduction of unwanted material into process',
    guideWords: ['other_than'],
    isCommon: true,
  },
];

/**
 * External factors causes
 */
const EXTERNAL_FACTORS_CAUSES: PreparedAnswerTemplate[] = [
  {
    text: 'Extreme weather - high temperature',
    description: 'Ambient temperature above design limits',
    guideWords: ['more'],
  },
  {
    text: 'Extreme weather - low temperature',
    description: 'Ambient temperature below design limits (freezing)',
    guideWords: ['less', 'no'],
  },
  {
    text: 'Lightning strike',
    description: 'Direct or induced lightning damage',
    guideWords: ['no', 'other_than'],
  },
  {
    text: 'Flooding',
    description: 'Inundation from heavy rain, storm surge, or river flooding',
    guideWords: ['no', 'other_than'],
  },
  {
    text: 'Seismic event',
    description: 'Earthquake causing structural damage or misalignment',
    guideWords: ['other_than'],
  },
  {
    text: 'External fire/explosion',
    description: 'Fire or explosion from adjacent unit or external source',
    guideWords: ['more', 'other_than'],
  },
  {
    text: 'Vehicle impact',
    description: 'Collision damage from vehicle or mobile equipment',
    guideWords: ['other_than'],
  },
  {
    text: 'Third-party interference',
    description: 'Damage from construction, excavation, or unauthorized access',
    guideWords: ['other_than'],
  },
];

// ============================================================================
// Combined Cause Templates
// ============================================================================

const ALL_CAUSE_TEMPLATES: PreparedAnswerTemplate[] = [
  ...EQUIPMENT_FAILURE_CAUSES,
  ...CONTROL_SYSTEM_CAUSES,
  ...HUMAN_FACTORS_CAUSES,
  ...UTILITY_FAILURE_CAUSES,
  ...PROCESS_UPSET_CAUSES,
  ...EXTERNAL_FACTORS_CAUSES,
];

// ============================================================================
// Generated Prepared Answers
// ============================================================================

/**
 * Convert templates to prepared answers with generated IDs.
 */
function templatesToPreparedAnswers(templates: PreparedAnswerTemplate[]): PreparedAnswer[] {
  return templates.map((template, index) => ({
    id: uuidv4(),
    text: template.text,
    description: template.description,
    applicableEquipmentTypes: template.equipmentTypes ?? [],
    applicableGuideWords: template.guideWords ?? [],
    isCommon: template.isCommon ?? false,
    sortOrder: template.isCommon ? index : index + 1000, // Common answers first
  }));
}

// Pre-generated answers for consistent IDs within a session
let cachedAnswers: PreparedAnswer[] | null = null;

function getAllCauseAnswers(): PreparedAnswer[] {
  if (!cachedAnswers) {
    cachedAnswers = templatesToPreparedAnswers(ALL_CAUSE_TEMPLATES);
  }
  return cachedAnswers;
}

// ============================================================================
// Service Functions
// ============================================================================

/**
 * Get all prepared causes.
 *
 * @returns All prepared cause answers
 */
export function getAllPreparedCauses(): PreparedAnswersResponse {
  const answers = getAllCauseAnswers();

  return {
    category: 'cause',
    answers: answers.sort((a, b) => a.sortOrder - b.sortOrder),
    count: answers.length,
  };
}

/**
 * Get prepared causes filtered by context.
 *
 * @param query - Filter parameters
 * @returns Filtered prepared causes
 */
export function getPreparedCausesFiltered(
  query: PreparedAnswersQuery
): PreparedAnswersFilteredResponse {
  let answers = getAllCauseAnswers();

  // Filter by equipment type
  if (query.equipmentType) {
    const equipmentType = query.equipmentType;
    answers = answers.filter(
      (a) =>
        a.applicableEquipmentTypes.length === 0 ||
        a.applicableEquipmentTypes.includes(equipmentType)
    );
  }

  // Filter by guide word
  if (query.guideWord) {
    const guideWord = query.guideWord;
    answers = answers.filter(
      (a) =>
        a.applicableGuideWords.length === 0 ||
        a.applicableGuideWords.includes(guideWord)
    );
  }

  // Filter by common only
  if (query.commonOnly) {
    answers = answers.filter((a) => a.isCommon);
  }

  // Filter by search text
  if (query.search) {
    const searchLower = query.search.toLowerCase();
    answers = answers.filter(
      (a) =>
        a.text.toLowerCase().includes(searchLower) ||
        (a.description && a.description.toLowerCase().includes(searchLower))
    );
  }

  return {
    category: 'cause',
    answers: answers.sort((a, b) => a.sortOrder - b.sortOrder),
    count: answers.length,
    equipmentType: query.equipmentType ?? null,
    guideWord: query.guideWord ?? null,
  };
}

/**
 * Get prepared causes for a specific equipment type.
 *
 * @param equipmentType - The equipment type to filter by
 * @returns Prepared causes applicable to the equipment type
 */
export function getPreparedCausesForEquipmentType(
  equipmentType: EquipmentType
): PreparedAnswersFilteredResponse {
  return getPreparedCausesFiltered({ equipmentType });
}

/**
 * Get prepared causes for a specific guide word.
 *
 * @param guideWord - The guide word to filter by
 * @returns Prepared causes applicable to the guide word
 */
export function getPreparedCausesForGuideWord(
  guideWord: GuideWord
): PreparedAnswersFilteredResponse {
  return getPreparedCausesFiltered({ guideWord });
}

/**
 * Get prepared causes for a specific equipment type and guide word combination.
 *
 * @param equipmentType - The equipment type to filter by
 * @param guideWord - The guide word to filter by
 * @returns Prepared causes applicable to both filters
 */
export function getPreparedCausesForContext(
  equipmentType: EquipmentType,
  guideWord: GuideWord
): PreparedAnswersFilteredResponse {
  return getPreparedCausesFiltered({ equipmentType, guideWord });
}

/**
 * Search prepared causes by text.
 *
 * @param searchText - Text to search for in cause text and description
 * @returns Matching prepared causes
 */
export function searchPreparedCauses(searchText: string): PreparedAnswersResponse {
  const result = getPreparedCausesFiltered({ search: searchText });
  return {
    category: result.category,
    answers: result.answers,
    count: result.count,
  };
}

/**
 * Get common/recommended prepared causes.
 *
 * @returns Only common/recommended causes
 */
export function getCommonPreparedCauses(): PreparedAnswersResponse {
  const result = getPreparedCausesFiltered({ commonOnly: true });
  return {
    category: result.category,
    answers: result.answers,
    count: result.count,
  };
}

/**
 * Validate if a string is a valid equipment type.
 *
 * @param value - The value to validate
 * @returns True if valid equipment type
 */
export function isValidEquipmentType(value: string): value is EquipmentType {
  return (EQUIPMENT_TYPES as readonly string[]).includes(value);
}

/**
 * Validate if a string is a valid guide word.
 *
 * @param value - The value to validate
 * @returns True if valid guide word
 */
export function isValidGuideWord(value: string): value is GuideWord {
  return (GUIDE_WORDS as readonly string[]).includes(value);
}

/**
 * Get a prepared cause by ID.
 *
 * @param id - The prepared answer ID
 * @returns The prepared cause, or null if not found
 */
export function getPreparedCauseById(id: string): PreparedAnswer | null {
  const answers = getAllCauseAnswers();
  return answers.find((a) => a.id === id) ?? null;
}

/**
 * Get statistics about prepared causes.
 *
 * @returns Statistics including counts by equipment type and guide word
 */
export function getPreparedCauseStats(): {
  totalCount: number;
  commonCount: number;
  byEquipmentType: Record<EquipmentType, number>;
  byGuideWord: Record<GuideWord, number>;
  universalCount: number;
} {
  const answers = getAllCauseAnswers();

  const byEquipmentType = {} as Record<EquipmentType, number>;
  const byGuideWord = {} as Record<GuideWord, number>;

  for (const eqType of EQUIPMENT_TYPES) {
    byEquipmentType[eqType] = answers.filter(
      (a) =>
        a.applicableEquipmentTypes.length === 0 ||
        a.applicableEquipmentTypes.includes(eqType)
    ).length;
  }

  for (const gw of GUIDE_WORDS) {
    byGuideWord[gw] = answers.filter(
      (a) =>
        a.applicableGuideWords.length === 0 ||
        a.applicableGuideWords.includes(gw)
    ).length;
  }

  return {
    totalCount: answers.length,
    commonCount: answers.filter((a) => a.isCommon).length,
    byEquipmentType,
    byGuideWord,
    universalCount: answers.filter(
      (a) =>
        a.applicableEquipmentTypes.length === 0 &&
        a.applicableGuideWords.length === 0
    ).length,
  };
}

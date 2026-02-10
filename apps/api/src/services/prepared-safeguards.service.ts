/**
 * Prepared Safeguards service.
 *
 * Provides configurable templates for safeguards in HazOps analysis.
 * Safeguards are organized by equipment type and guide word to help analysts
 * quickly select relevant existing safeguards for deviations.
 *
 * Industry-standard safeguard categories include:
 * - Basic Process Control System (BPCS)
 * - Safety Instrumented Systems (SIS)
 * - Relief devices and venting
 * - Mechanical safeguards
 * - Administrative controls
 * - Passive safeguards
 * - Detection and alarm systems
 * - Emergency response
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
// Safeguard Templates by Category
// ============================================================================

/**
 * Basic Process Control System (BPCS) safeguards
 */
const BPCS_SAFEGUARDS: PreparedAnswerTemplate[] = [
  {
    text: 'Level control loop (LIC)',
    description: 'Automatic level control to maintain vessel levels within operating range',
    equipmentTypes: ['tank', 'reactor'],
    guideWords: ['more', 'less'],
    isCommon: true,
  },
  {
    text: 'Pressure control loop (PIC)',
    description: 'Automatic pressure control to maintain system pressure within limits',
    equipmentTypes: ['reactor', 'tank', 'heat_exchanger'],
    guideWords: ['more', 'less'],
    isCommon: true,
  },
  {
    text: 'Temperature control loop (TIC)',
    description: 'Automatic temperature control for heating/cooling systems',
    equipmentTypes: ['reactor', 'heat_exchanger'],
    guideWords: ['more', 'less'],
    isCommon: true,
  },
  {
    text: 'Flow control loop (FIC)',
    description: 'Automatic flow control to maintain process flow rates',
    equipmentTypes: ['pump', 'valve', 'pipe'],
    guideWords: ['more', 'less', 'no'],
    isCommon: true,
  },
  {
    text: 'Ratio control',
    description: 'Maintains correct proportions of multiple feed streams',
    equipmentTypes: ['reactor'],
    guideWords: ['other_than'],
  },
  {
    text: 'Cascade control',
    description: 'Primary-secondary control for improved response to disturbances',
    guideWords: ['more', 'less'],
  },
  {
    text: 'Feedforward control',
    description: 'Anticipatory control based on measured disturbances',
    guideWords: ['more', 'less'],
  },
  {
    text: 'Split-range control',
    description: 'Single controller output controlling multiple final elements',
    guideWords: ['more', 'less'],
  },
];

/**
 * Safety Instrumented Systems (SIS) safeguards
 */
const SIS_SAFEGUARDS: PreparedAnswerTemplate[] = [
  {
    text: 'High level shutdown (LSHH)',
    description: 'Trips process on high-high level to prevent overflow',
    equipmentTypes: ['tank', 'reactor'],
    guideWords: ['more'],
    isCommon: true,
  },
  {
    text: 'Low level shutdown (LSLL)',
    description: 'Trips process on low-low level to prevent pump damage or loss of seal',
    equipmentTypes: ['tank', 'pump'],
    guideWords: ['no', 'less'],
    isCommon: true,
  },
  {
    text: 'High pressure shutdown (PSHH)',
    description: 'Trips process on high-high pressure to prevent overpressure',
    equipmentTypes: ['reactor', 'tank', 'heat_exchanger'],
    guideWords: ['more'],
    isCommon: true,
  },
  {
    text: 'Low pressure shutdown (PSLL)',
    description: 'Trips process on low-low pressure to prevent vacuum or loss of containment',
    equipmentTypes: ['reactor', 'tank'],
    guideWords: ['less'],
  },
  {
    text: 'High temperature shutdown (TSHH)',
    description: 'Trips process on high-high temperature to prevent thermal damage',
    equipmentTypes: ['reactor', 'heat_exchanger'],
    guideWords: ['more'],
    isCommon: true,
  },
  {
    text: 'Low temperature shutdown (TSLL)',
    description: 'Trips process on low-low temperature to prevent freezing or material failure',
    equipmentTypes: ['pipe', 'tank'],
    guideWords: ['less'],
  },
  {
    text: 'High flow shutdown (FSHH)',
    description: 'Trips process on high-high flow to prevent downstream flooding',
    equipmentTypes: ['pump', 'valve', 'pipe'],
    guideWords: ['more'],
  },
  {
    text: 'Low flow shutdown (FSLL)',
    description: 'Trips pump on low-low flow to prevent damage from deadheading',
    equipmentTypes: ['pump'],
    guideWords: ['no', 'less'],
    isCommon: true,
  },
  {
    text: 'Emergency shutdown valve (ESV/SDV)',
    description: 'Automatically closes to isolate hazardous inventory',
    guideWords: ['more', 'other_than'],
    isCommon: true,
  },
  {
    text: 'Emergency depressuring valve (BDV)',
    description: 'Rapidly depressures equipment to safe level on demand',
    equipmentTypes: ['reactor', 'tank'],
    guideWords: ['more'],
  },
  {
    text: 'Emergency isolation valve (EIV)',
    description: 'Isolates sections of plant during emergency',
    guideWords: ['more', 'other_than'],
  },
  {
    text: 'Fire & gas detection system',
    description: 'Detects fire or gas release and initiates protective action',
    guideWords: ['other_than'],
    isCommon: true,
  },
  {
    text: 'Vibration trip (pump/compressor)',
    description: 'Trips rotating equipment on high vibration to prevent damage',
    equipmentTypes: ['pump'],
    guideWords: ['other_than'],
  },
  {
    text: 'Interlock system',
    description: 'Prevents hazardous operations based on permissive conditions',
    isCommon: true,
  },
];

/**
 * Relief devices and venting safeguards
 */
const RELIEF_SAFEGUARDS: PreparedAnswerTemplate[] = [
  {
    text: 'Pressure safety valve (PSV)',
    description: 'Automatically relieves overpressure to flare or atmosphere',
    equipmentTypes: ['reactor', 'tank', 'heat_exchanger', 'pipe'],
    guideWords: ['more'],
    isCommon: true,
  },
  {
    text: 'Rupture disc',
    description: 'Bursting disc for rapid pressure relief or PSV isolation',
    equipmentTypes: ['reactor', 'tank'],
    guideWords: ['more'],
    isCommon: true,
  },
  {
    text: 'Vacuum relief valve',
    description: 'Prevents vacuum collapse of vessel by admitting air or nitrogen',
    equipmentTypes: ['tank'],
    guideWords: ['less'],
    isCommon: true,
  },
  {
    text: 'Conservation vent (pressure/vacuum)',
    description: 'Combined pressure/vacuum relief for atmospheric tanks',
    equipmentTypes: ['tank'],
    guideWords: ['more', 'less'],
  },
  {
    text: 'Thermal relief valve',
    description: 'Relieves pressure from blocked-in liquid thermal expansion',
    equipmentTypes: ['pipe', 'heat_exchanger'],
    guideWords: ['more'],
  },
  {
    text: 'Flare system',
    description: 'Safely combusts relieved gases at elevated stack',
    guideWords: ['more', 'other_than'],
    isCommon: true,
  },
  {
    text: 'Vent to atmosphere',
    description: 'Safe atmospheric discharge for non-toxic, non-flammable gases',
    guideWords: ['more'],
  },
  {
    text: 'Blowdown drum/knockout drum',
    description: 'Separates liquid from gas in relief streams before flare',
    guideWords: ['more'],
  },
];

/**
 * Mechanical safeguards
 */
const MECHANICAL_SAFEGUARDS: PreparedAnswerTemplate[] = [
  {
    text: 'Check valve (non-return valve)',
    description: 'Prevents reverse flow in piping system',
    equipmentTypes: ['pipe', 'pump'],
    guideWords: ['reverse'],
    isCommon: true,
  },
  {
    text: 'Excess flow valve',
    description: 'Automatically closes on high flow rate indicating line rupture',
    equipmentTypes: ['pipe'],
    guideWords: ['more'],
  },
  {
    text: 'Restriction orifice',
    description: 'Limits maximum flow rate in a line',
    equipmentTypes: ['pipe'],
    guideWords: ['more'],
    isCommon: true,
  },
  {
    text: 'Flow limiting device',
    description: 'Mechanical device that limits flow to safe rate',
    equipmentTypes: ['pipe'],
    guideWords: ['more'],
  },
  {
    text: 'Locked open valve (LOV)',
    description: 'Valve locked in open position to ensure flow path',
    equipmentTypes: ['valve'],
    guideWords: ['no'],
  },
  {
    text: 'Locked closed valve (LCV)',
    description: 'Valve locked in closed position to prevent inadvertent opening',
    equipmentTypes: ['valve'],
    guideWords: ['more', 'other_than'],
  },
  {
    text: 'Car-sealed valve position',
    description: 'Valve position secured with seal requiring deliberate breaking',
    equipmentTypes: ['valve'],
  },
  {
    text: 'Double block and bleed',
    description: 'Two isolation valves with bleed between for positive isolation',
    equipmentTypes: ['valve', 'pipe'],
    guideWords: ['other_than'],
  },
  {
    text: 'Equipment design margin',
    description: 'Equipment rated above maximum expected operating conditions',
    guideWords: ['more'],
  },
  {
    text: 'Corrosion allowance',
    description: 'Extra wall thickness to account for material degradation',
    guideWords: ['other_than'],
  },
  {
    text: 'Heat tracing/insulation',
    description: 'Maintains temperature to prevent freezing or viscosity problems',
    equipmentTypes: ['pipe', 'tank'],
    guideWords: ['less', 'no'],
    isCommon: true,
  },
  {
    text: 'Flame arrestor',
    description: 'Prevents flame propagation into equipment or tanks',
    equipmentTypes: ['tank'],
    guideWords: ['other_than'],
  },
  {
    text: 'Detonation arrestor',
    description: 'Stops detonation wave propagation in piping',
    equipmentTypes: ['pipe'],
    guideWords: ['other_than'],
  },
];

/**
 * Administrative controls and procedures
 */
const ADMINISTRATIVE_SAFEGUARDS: PreparedAnswerTemplate[] = [
  {
    text: 'Standard Operating Procedure (SOP)',
    description: 'Written procedures for normal operations, startup, and shutdown',
    isCommon: true,
  },
  {
    text: 'Permit to Work system',
    description: 'Formal authorization for non-routine work activities',
    isCommon: true,
  },
  {
    text: 'Lock-out/Tag-out (LOTO) procedure',
    description: 'Energy isolation procedure for maintenance activities',
    isCommon: true,
  },
  {
    text: 'Management of Change (MOC) procedure',
    description: 'Formal review of process changes before implementation',
    guideWords: ['other_than'],
    isCommon: true,
  },
  {
    text: 'Operator training and certification',
    description: 'Formal training program with competency verification',
    isCommon: true,
  },
  {
    text: 'Routine inspection program',
    description: 'Scheduled inspection of critical equipment',
  },
  {
    text: 'Preventive maintenance program',
    description: 'Scheduled maintenance to prevent equipment failure',
  },
  {
    text: 'Pre-startup safety review (PSSR)',
    description: 'Formal review before initial startup or restart after changes',
  },
  {
    text: 'Shift handover procedure',
    description: 'Formal communication of process status at shift change',
    guideWords: ['other_than', 'early', 'late'],
  },
  {
    text: 'Emergency response procedure',
    description: 'Written procedures for emergency situations',
    isCommon: true,
  },
  {
    text: 'Batch sheet/recipe management',
    description: 'Controlled documentation for batch operations',
    equipmentTypes: ['reactor'],
    guideWords: ['other_than'],
  },
  {
    text: 'Material verification procedure',
    description: 'Procedure to verify correct materials before use',
    guideWords: ['other_than'],
  },
];

/**
 * Passive safeguards (inherently safe design)
 */
const PASSIVE_SAFEGUARDS: PreparedAnswerTemplate[] = [
  {
    text: 'Containment dike/bund',
    description: 'Secondary containment to capture spills and leaks',
    equipmentTypes: ['tank'],
    guideWords: ['other_than'],
    isCommon: true,
  },
  {
    text: 'Firewall/blast wall',
    description: 'Physical barrier to contain fire or blast effects',
    guideWords: ['other_than'],
  },
  {
    text: 'Drainage system',
    description: 'Engineered drainage to direct spills to safe location',
    guideWords: ['other_than'],
  },
  {
    text: 'Ventilation system',
    description: 'Maintains air quality and prevents accumulation of hazardous gases',
    guideWords: ['other_than'],
  },
  {
    text: 'Explosion venting panels',
    description: 'Weak panels that fail first to direct explosion effects',
    guideWords: ['more'],
  },
  {
    text: 'Separation distance',
    description: 'Physical spacing between hazardous equipment',
    guideWords: ['other_than'],
  },
  {
    text: 'Material of construction selection',
    description: 'Equipment materials compatible with process conditions',
    guideWords: ['other_than'],
  },
  {
    text: 'Inherent design limitation',
    description: 'Process design that limits inventory or energy content',
    guideWords: ['more'],
  },
  {
    text: 'Fail-safe valve position',
    description: 'Control valve designed to fail to safe position',
    equipmentTypes: ['valve'],
    guideWords: ['no', 'more', 'less'],
    isCommon: true,
  },
  {
    text: 'Inert gas blanketing',
    description: 'Nitrogen or other inert gas to prevent flammable atmosphere',
    equipmentTypes: ['tank', 'reactor'],
    guideWords: ['other_than'],
    isCommon: true,
  },
];

/**
 * Detection and alarm systems
 */
const DETECTION_ALARM_SAFEGUARDS: PreparedAnswerTemplate[] = [
  {
    text: 'High level alarm (LAH)',
    description: 'Alerts operator to high level condition',
    equipmentTypes: ['tank', 'reactor'],
    guideWords: ['more'],
    isCommon: true,
  },
  {
    text: 'Low level alarm (LAL)',
    description: 'Alerts operator to low level condition',
    equipmentTypes: ['tank', 'pump'],
    guideWords: ['less', 'no'],
    isCommon: true,
  },
  {
    text: 'High pressure alarm (PAH)',
    description: 'Alerts operator to high pressure condition',
    equipmentTypes: ['reactor', 'tank', 'heat_exchanger'],
    guideWords: ['more'],
    isCommon: true,
  },
  {
    text: 'Low pressure alarm (PAL)',
    description: 'Alerts operator to low pressure condition',
    equipmentTypes: ['reactor', 'tank'],
    guideWords: ['less'],
  },
  {
    text: 'High temperature alarm (TAH)',
    description: 'Alerts operator to high temperature condition',
    equipmentTypes: ['reactor', 'heat_exchanger'],
    guideWords: ['more'],
    isCommon: true,
  },
  {
    text: 'Low temperature alarm (TAL)',
    description: 'Alerts operator to low temperature condition',
    equipmentTypes: ['reactor', 'heat_exchanger', 'pipe'],
    guideWords: ['less'],
  },
  {
    text: 'High flow alarm (FAH)',
    description: 'Alerts operator to high flow condition',
    equipmentTypes: ['pump', 'pipe'],
    guideWords: ['more'],
  },
  {
    text: 'Low flow alarm (FAL)',
    description: 'Alerts operator to low or no flow condition',
    equipmentTypes: ['pump', 'pipe'],
    guideWords: ['less', 'no'],
    isCommon: true,
  },
  {
    text: 'Gas detector',
    description: 'Detects presence of flammable or toxic gases',
    guideWords: ['other_than'],
    isCommon: true,
  },
  {
    text: 'Fire detector (smoke/heat/flame)',
    description: 'Detects fire conditions and activates alarm',
    guideWords: ['other_than'],
    isCommon: true,
  },
  {
    text: 'Toxic gas detector',
    description: 'Detects hazardous concentrations of toxic gases',
    guideWords: ['other_than'],
  },
  {
    text: 'Oxygen deficiency detector',
    description: 'Alerts to low oxygen conditions in confined spaces',
    guideWords: ['other_than'],
  },
  {
    text: 'Leak detection system',
    description: 'Detects product leaks from tanks, pipes, or equipment',
    equipmentTypes: ['tank', 'pipe'],
    guideWords: ['other_than'],
  },
  {
    text: 'CCTV monitoring',
    description: 'Visual monitoring of critical process areas',
  },
];

/**
 * Emergency response safeguards
 */
const EMERGENCY_RESPONSE_SAFEGUARDS: PreparedAnswerTemplate[] = [
  {
    text: 'Deluge/water spray system',
    description: 'Fixed water spray for fire cooling or suppression',
    guideWords: ['more', 'other_than'],
    isCommon: true,
  },
  {
    text: 'Foam fire suppression system',
    description: 'Fixed foam system for flammable liquid fires',
    guideWords: ['other_than'],
  },
  {
    text: 'Dry chemical suppression system',
    description: 'Fixed dry chemical system for fire suppression',
    guideWords: ['other_than'],
  },
  {
    text: 'CO2 suppression system',
    description: 'Fixed carbon dioxide fire suppression',
    guideWords: ['other_than'],
  },
  {
    text: 'Fire hydrants/monitors',
    description: 'Manual firefighting capability',
    guideWords: ['other_than'],
  },
  {
    text: 'Emergency shower/eyewash',
    description: 'Personnel decontamination stations',
    guideWords: ['other_than'],
  },
  {
    text: 'Escape routes and assembly points',
    description: 'Designated evacuation paths and muster locations',
  },
  {
    text: 'Emergency response equipment',
    description: 'Spill kits, fire extinguishers, PPE caches',
    guideWords: ['other_than'],
  },
  {
    text: 'On-site emergency response team',
    description: 'Trained personnel for emergency response',
  },
  {
    text: 'Emergency communication system',
    description: 'PA system, alarms, and communication devices',
  },
];

/**
 * Equipment-specific safeguards
 */
const EQUIPMENT_SPECIFIC_SAFEGUARDS: PreparedAnswerTemplate[] = [
  // Pump safeguards
  {
    text: 'Minimum flow bypass',
    description: 'Recirculation line to prevent pump deadheading',
    equipmentTypes: ['pump'],
    guideWords: ['less', 'no'],
    isCommon: true,
  },
  {
    text: 'Pump motor overload protection',
    description: 'Electrical protection against motor overload',
    equipmentTypes: ['pump'],
    guideWords: ['more'],
  },
  {
    text: 'Pump dry-run protection',
    description: 'Trip or alarm on loss of pump suction',
    equipmentTypes: ['pump'],
    guideWords: ['no'],
    isCommon: true,
  },
  {
    text: 'Standby/spare pump',
    description: 'Redundant pump for critical service',
    equipmentTypes: ['pump'],
    guideWords: ['no'],
    isCommon: true,
  },

  // Reactor safeguards
  {
    text: 'Reactor dump/quench system',
    description: 'Emergency system to stop runaway reaction',
    equipmentTypes: ['reactor'],
    guideWords: ['more', 'early'],
    isCommon: true,
  },
  {
    text: 'Reactor agitator interlock',
    description: 'Prevents operation without proper mixing',
    equipmentTypes: ['reactor'],
    guideWords: ['other_than'],
  },
  {
    text: 'Cooling system redundancy',
    description: 'Backup cooling for critical reactor temperature control',
    equipmentTypes: ['reactor', 'heat_exchanger'],
    guideWords: ['more'],
  },

  // Heat exchanger safeguards
  {
    text: 'Tube rupture protection',
    description: 'Design provisions for tube leak/rupture scenario',
    equipmentTypes: ['heat_exchanger'],
    guideWords: ['other_than'],
  },
  {
    text: 'High shell pressure trip',
    description: 'Trip on high pressure indicating tube rupture',
    equipmentTypes: ['heat_exchanger'],
    guideWords: ['more', 'other_than'],
  },

  // Tank safeguards
  {
    text: 'Independent high level switch',
    description: 'Separate high level device from control system level',
    equipmentTypes: ['tank'],
    guideWords: ['more'],
    isCommon: true,
  },
  {
    text: 'Overflow line to safe location',
    description: 'Dedicated overflow routing to prevent spills',
    equipmentTypes: ['tank'],
    guideWords: ['more'],
  },
  {
    text: 'Tank gauging system',
    description: 'Independent level measurement for inventory management',
    equipmentTypes: ['tank'],
    guideWords: ['more', 'less'],
  },
];

// ============================================================================
// Combined Safeguard Templates
// ============================================================================

const ALL_SAFEGUARD_TEMPLATES: PreparedAnswerTemplate[] = [
  ...BPCS_SAFEGUARDS,
  ...SIS_SAFEGUARDS,
  ...RELIEF_SAFEGUARDS,
  ...MECHANICAL_SAFEGUARDS,
  ...ADMINISTRATIVE_SAFEGUARDS,
  ...PASSIVE_SAFEGUARDS,
  ...DETECTION_ALARM_SAFEGUARDS,
  ...EMERGENCY_RESPONSE_SAFEGUARDS,
  ...EQUIPMENT_SPECIFIC_SAFEGUARDS,
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

function getAllSafeguardAnswers(): PreparedAnswer[] {
  if (!cachedAnswers) {
    cachedAnswers = templatesToPreparedAnswers(ALL_SAFEGUARD_TEMPLATES);
  }
  return cachedAnswers;
}

// ============================================================================
// Service Functions
// ============================================================================

/**
 * Get all prepared safeguards.
 *
 * @returns All prepared safeguard answers
 */
export function getAllPreparedSafeguards(): PreparedAnswersResponse {
  const answers = getAllSafeguardAnswers();

  return {
    category: 'safeguard',
    answers: answers.sort((a, b) => a.sortOrder - b.sortOrder),
    count: answers.length,
  };
}

/**
 * Get prepared safeguards filtered by context.
 *
 * @param query - Filter parameters
 * @returns Filtered prepared safeguards
 */
export function getPreparedSafeguardsFiltered(
  query: PreparedAnswersQuery
): PreparedAnswersFilteredResponse {
  let answers = getAllSafeguardAnswers();

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
    category: 'safeguard',
    answers: answers.sort((a, b) => a.sortOrder - b.sortOrder),
    count: answers.length,
    equipmentType: query.equipmentType ?? null,
    guideWord: query.guideWord ?? null,
  };
}

/**
 * Get prepared safeguards for a specific equipment type.
 *
 * @param equipmentType - The equipment type to filter by
 * @returns Prepared safeguards applicable to the equipment type
 */
export function getPreparedSafeguardsForEquipmentType(
  equipmentType: EquipmentType
): PreparedAnswersFilteredResponse {
  return getPreparedSafeguardsFiltered({ equipmentType });
}

/**
 * Get prepared safeguards for a specific guide word.
 *
 * @param guideWord - The guide word to filter by
 * @returns Prepared safeguards applicable to the guide word
 */
export function getPreparedSafeguardsForGuideWord(
  guideWord: GuideWord
): PreparedAnswersFilteredResponse {
  return getPreparedSafeguardsFiltered({ guideWord });
}

/**
 * Get prepared safeguards for a specific equipment type and guide word combination.
 *
 * @param equipmentType - The equipment type to filter by
 * @param guideWord - The guide word to filter by
 * @returns Prepared safeguards applicable to both filters
 */
export function getPreparedSafeguardsForContext(
  equipmentType: EquipmentType,
  guideWord: GuideWord
): PreparedAnswersFilteredResponse {
  return getPreparedSafeguardsFiltered({ equipmentType, guideWord });
}

/**
 * Search prepared safeguards by text.
 *
 * @param searchText - Text to search for in safeguard text and description
 * @returns Matching prepared safeguards
 */
export function searchPreparedSafeguards(searchText: string): PreparedAnswersResponse {
  const result = getPreparedSafeguardsFiltered({ search: searchText });
  return {
    category: result.category,
    answers: result.answers,
    count: result.count,
  };
}

/**
 * Get common/recommended prepared safeguards.
 *
 * @returns Only common/recommended safeguards
 */
export function getCommonPreparedSafeguards(): PreparedAnswersResponse {
  const result = getPreparedSafeguardsFiltered({ commonOnly: true });
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
 * Get a prepared safeguard by ID.
 *
 * @param id - The prepared answer ID
 * @returns The prepared safeguard, or null if not found
 */
export function getPreparedSafeguardById(id: string): PreparedAnswer | null {
  const answers = getAllSafeguardAnswers();
  return answers.find((a) => a.id === id) ?? null;
}

/**
 * Get statistics about prepared safeguards.
 *
 * @returns Statistics including counts by equipment type and guide word
 */
export function getPreparedSafeguardStats(): {
  totalCount: number;
  commonCount: number;
  byEquipmentType: Record<EquipmentType, number>;
  byGuideWord: Record<GuideWord, number>;
  universalCount: number;
} {
  const answers = getAllSafeguardAnswers();

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

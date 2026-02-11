/**
 * Regulatory Standards Database Service.
 *
 * Provides an in-memory database of regulatory standards relevant to HazOps analysis.
 * This service contains comprehensive information about IEC 61511, ISO 31000, ISO 9001,
 * and other standards, including their clauses and HazOps relevance.
 *
 * The data is static and represents regulatory requirements that rarely change.
 * Future versions may store this in PostgreSQL for easier updates.
 *
 * Task: COMP-01
 */

import type {
  RegulatoryStandard,
  RegulatoryStandardId,
  RegulatoryClause,
  RegulatoryCategory,
  RegulatoryJurisdiction,
  HazopsRelevanceArea,
  ListRegulatoryStandardsQuery,
} from '@hazop/types';

// ============================================================================
// IEC 61511 - Functional Safety for Process Industries
// ============================================================================

/**
 * IEC 61511 clauses relevant to HazOps analysis.
 */
const IEC_61511_CLAUSES: RegulatoryClause[] = [
  {
    id: '8.1',
    title: 'Hazard and risk assessment - Objectives',
    description:
      'Hazard and risk assessment shall be carried out for the process and its associated BPCS ' +
      'to identify hazards and hazardous events, the sequence of events leading to the hazardous event, ' +
      'the process risks, and the requirements for risk reduction.',
    keywords: ['hazard', 'risk assessment', 'process risk', 'risk reduction'],
    mandatory: true,
    hazopsRelevance: ['hazard_identification', 'risk_assessment'],
  },
  {
    id: '8.1.1',
    title: 'General requirements for hazard and risk assessment',
    description:
      'A hazard and risk assessment technique shall be applied. HAZOP is cited as an appropriate ' +
      'technique for identifying hazards in process industries.',
    keywords: ['HAZOP', 'hazard identification', 'risk assessment technique'],
    mandatory: true,
    parentClauseId: '8.1',
    hazopsRelevance: ['hazard_identification', 'methodology'],
  },
  {
    id: '8.1.2',
    title: 'Required competencies for hazard and risk assessment',
    description:
      'Personnel carrying out the hazard and risk assessment shall have the necessary competencies. ' +
      'The team shall include expertise in process engineering, operations, safety, and instrumentation.',
    keywords: ['competency', 'team composition', 'qualifications'],
    mandatory: true,
    parentClauseId: '8.1',
    hazopsRelevance: ['team_composition'],
  },
  {
    id: '8.2',
    title: 'Hazard and risk assessment methods',
    description:
      'Qualitative or quantitative methods shall be used for hazard and risk assessment. ' +
      'The methods include HAZOP, FMEA, fault tree analysis, and other recognized techniques.',
    keywords: ['HAZOP', 'FMEA', 'fault tree', 'qualitative', 'quantitative'],
    mandatory: true,
    hazopsRelevance: ['methodology', 'risk_assessment'],
  },
  {
    id: '9',
    title: 'SIS safety requirements specification',
    description:
      'The SIS safety requirements specification shall be derived from the hazard and risk assessment. ' +
      'This includes functional requirements, SIL requirements, and test requirements.',
    keywords: ['SIS', 'safety requirements', 'SIL', 'specification'],
    mandatory: true,
    hazopsRelevance: ['sil_determination', 'safeguards'],
  },
  {
    id: '9.2',
    title: 'Safety Integrity Level determination',
    description:
      'The SIL shall be determined using an appropriate method such as risk graph, risk matrix, ' +
      'or LOPA (Layers of Protection Analysis).',
    keywords: ['SIL', 'risk graph', 'risk matrix', 'LOPA'],
    mandatory: true,
    parentClauseId: '9',
    hazopsRelevance: ['sil_determination', 'lopa', 'risk_ranking'],
  },
  {
    id: '9.3',
    title: 'Safety requirements allocation',
    description:
      'Safety requirements shall be allocated to the SIS subsystems. The allocation shall consider ' +
      'hardware fault tolerance, systematic capability, and architectural constraints.',
    keywords: ['allocation', 'subsystems', 'fault tolerance', 'architecture'],
    mandatory: true,
    parentClauseId: '9',
    hazopsRelevance: ['safeguards', 'sil_determination'],
  },
  {
    id: '11',
    title: 'SIS design and engineering',
    description:
      'The SIS shall be designed to achieve the required SIL. Design shall consider ' +
      'hardware, software, application program, and human factors.',
    keywords: ['design', 'engineering', 'hardware', 'software'],
    mandatory: true,
    hazopsRelevance: ['safeguards'],
  },
  {
    id: '15',
    title: 'SIS operation and maintenance',
    description:
      'Procedures shall be in place for operation and maintenance of the SIS to maintain ' +
      'its functional safety throughout its lifetime.',
    keywords: ['operation', 'maintenance', 'procedures'],
    mandatory: true,
    hazopsRelevance: ['follow_up', 'safeguards'],
  },
  {
    id: '16',
    title: 'SIS modification',
    description:
      'Any modification to the SIS shall be subject to management of change procedures. ' +
      'The impact on functional safety shall be assessed.',
    keywords: ['modification', 'change management', 'MOC'],
    mandatory: true,
    hazopsRelevance: ['management_of_change'],
  },
  {
    id: '17',
    title: 'SIS decommissioning',
    description:
      'Decommissioning of SIS shall follow defined procedures to ensure safety is maintained.',
    keywords: ['decommissioning', 'removal'],
    mandatory: true,
    hazopsRelevance: ['follow_up'],
  },
  {
    id: 'Annex_A',
    title: 'LOPA (Layers of Protection Analysis)',
    description:
      'Informative annex describing LOPA methodology for SIL determination. Includes guidance on ' +
      'initiating events, IPLs, target mitigated event likelihood, and gap analysis.',
    keywords: ['LOPA', 'IPL', 'initiating event', 'target frequency'],
    mandatory: false,
    hazopsRelevance: ['lopa', 'sil_determination', 'risk_assessment'],
  },
];

/**
 * IEC 61511 standard definition.
 */
const IEC_61511: RegulatoryStandard = {
  id: 'IEC_61511',
  name: 'IEC 61511',
  title: 'Functional safety - Safety instrumented systems for the process industry sector',
  description:
    'International standard for safety instrumented systems (SIS) in the process industry. ' +
    'Covers the lifecycle of SIS from concept through decommissioning, including ' +
    'hazard and risk assessment, SIL determination, and verification.',
  category: 'functional_safety',
  jurisdiction: 'international',
  version: 'Ed. 2.1',
  year: 2017,
  issuingBody: 'International Electrotechnical Commission (IEC)',
  url: 'https://webstore.iec.ch/publication/61928',
  mandatory: true,
  relatedStandards: ['ISO_31000', 'OSHA_PSM'],
  relevantClauses: IEC_61511_CLAUSES,
};

// ============================================================================
// ISO 31000 - Risk Management Guidelines
// ============================================================================

/**
 * ISO 31000 clauses relevant to HazOps analysis.
 */
const ISO_31000_CLAUSES: RegulatoryClause[] = [
  {
    id: '4',
    title: 'Principles',
    description:
      'Risk management should be integrated, structured, comprehensive, customized, inclusive, ' +
      'dynamic, use best available information, consider human and cultural factors, and be ' +
      'subject to continual improvement.',
    keywords: ['principles', 'integrated', 'comprehensive', 'continual improvement'],
    mandatory: true,
    hazopsRelevance: ['methodology'],
  },
  {
    id: '5',
    title: 'Framework',
    description:
      'The purpose of the risk management framework is to assist the organization in integrating ' +
      'risk management into significant activities and functions.',
    keywords: ['framework', 'integration', 'organization'],
    mandatory: true,
    hazopsRelevance: ['methodology', 'documentation'],
  },
  {
    id: '5.4',
    title: 'Integration',
    description:
      'Integrating risk management into an organization is a dynamic and iterative process, ' +
      'and should be customized to the needs and culture of the organization.',
    keywords: ['integration', 'dynamic', 'iterative'],
    mandatory: true,
    parentClauseId: '5',
    hazopsRelevance: ['methodology'],
  },
  {
    id: '5.5',
    title: 'Design',
    description:
      'When designing the framework for managing risk, the organization should examine and understand ' +
      'its external and internal context.',
    keywords: ['design', 'context', 'external', 'internal'],
    mandatory: true,
    parentClauseId: '5',
    hazopsRelevance: ['methodology'],
  },
  {
    id: '6',
    title: 'Process',
    description:
      'The risk management process involves communication and consultation, establishing context, ' +
      'risk assessment, risk treatment, monitoring and review, and recording and reporting.',
    keywords: ['process', 'risk assessment', 'risk treatment', 'monitoring'],
    mandatory: true,
    hazopsRelevance: ['methodology', 'risk_assessment'],
  },
  {
    id: '6.3',
    title: 'Scope, context and criteria',
    description:
      'The organization should define the scope of its risk management activities, along with ' +
      'the external and internal context and the risk criteria.',
    keywords: ['scope', 'context', 'criteria'],
    mandatory: true,
    parentClauseId: '6',
    hazopsRelevance: ['methodology'],
  },
  {
    id: '6.4',
    title: 'Risk assessment',
    description:
      'Risk assessment is the overall process of risk identification, risk analysis and risk evaluation.',
    keywords: ['risk assessment', 'identification', 'analysis', 'evaluation'],
    mandatory: true,
    parentClauseId: '6',
    hazopsRelevance: ['risk_assessment', 'hazard_identification'],
  },
  {
    id: '6.4.2',
    title: 'Risk identification',
    description:
      'The purpose of risk identification is to find, recognize and describe risks that might help ' +
      'or prevent an organization achieving its objectives.',
    keywords: ['risk identification', 'objectives'],
    mandatory: true,
    parentClauseId: '6.4',
    hazopsRelevance: ['hazard_identification'],
  },
  {
    id: '6.4.3',
    title: 'Risk analysis',
    description:
      'The purpose of risk analysis is to comprehend the nature of risk and its characteristics ' +
      'including the level of risk. Risk analysis involves consideration of causes and sources of risk, ' +
      'consequences, and likelihood.',
    keywords: ['risk analysis', 'causes', 'consequences', 'likelihood'],
    mandatory: true,
    parentClauseId: '6.4',
    hazopsRelevance: ['risk_assessment', 'risk_ranking'],
  },
  {
    id: '6.4.4',
    title: 'Risk evaluation',
    description:
      'The purpose of risk evaluation is to support decisions. Risk evaluation involves comparing ' +
      'the results of the risk analysis with the established risk criteria.',
    keywords: ['risk evaluation', 'decisions', 'criteria'],
    mandatory: true,
    parentClauseId: '6.4',
    hazopsRelevance: ['risk_ranking'],
  },
  {
    id: '6.5',
    title: 'Risk treatment',
    description:
      'Risk treatment involves selecting and implementing options for addressing risk. ' +
      'Options include avoiding, taking or increasing risk, removing sources, changing likelihood ' +
      'or consequences, sharing risk, and retaining risk.',
    keywords: ['risk treatment', 'mitigation', 'options'],
    mandatory: true,
    parentClauseId: '6',
    hazopsRelevance: ['recommendations', 'safeguards'],
  },
  {
    id: '6.6',
    title: 'Monitoring and review',
    description:
      'Monitoring and review should take place in all stages of the process. Monitoring and review ' +
      'includes planning, gathering and analyzing information, recording results and providing feedback.',
    keywords: ['monitoring', 'review', 'feedback'],
    mandatory: true,
    parentClauseId: '6',
    hazopsRelevance: ['follow_up'],
  },
  {
    id: '6.7',
    title: 'Recording and reporting',
    description:
      'The risk management process and its outcomes should be documented and reported through ' +
      'appropriate mechanisms.',
    keywords: ['recording', 'reporting', 'documentation'],
    mandatory: true,
    parentClauseId: '6',
    hazopsRelevance: ['documentation'],
  },
];

/**
 * ISO 31000 standard definition.
 */
const ISO_31000: RegulatoryStandard = {
  id: 'ISO_31000',
  name: 'ISO 31000',
  title: 'Risk management - Guidelines',
  description:
    'International standard providing guidelines for managing risk faced by organizations. ' +
    'Establishes principles, framework, and process for risk management applicable to ' +
    'any type of risk regardless of cause or consequence.',
  category: 'risk_management',
  jurisdiction: 'international',
  version: '2018',
  year: 2018,
  issuingBody: 'International Organization for Standardization (ISO)',
  url: 'https://www.iso.org/standard/65694.html',
  mandatory: false,
  relatedStandards: ['IEC_61511', 'ISO_9001'],
  relevantClauses: ISO_31000_CLAUSES,
};

// ============================================================================
// ISO 9001 - Quality Management Systems
// ============================================================================

/**
 * ISO 9001 clauses relevant to HazOps analysis.
 */
const ISO_9001_CLAUSES: RegulatoryClause[] = [
  {
    id: '4.1',
    title: 'Understanding the organization and its context',
    description:
      'The organization shall determine external and internal issues that are relevant to its purpose ' +
      'and its strategic direction and that affect its ability to achieve the intended results.',
    keywords: ['context', 'issues', 'strategic direction'],
    mandatory: true,
    hazopsRelevance: ['methodology'],
  },
  {
    id: '4.4',
    title: 'Quality management system and its processes',
    description:
      'The organization shall establish, implement, maintain and continually improve a quality ' +
      'management system, including the processes needed and their interactions.',
    keywords: ['QMS', 'processes', 'continual improvement'],
    mandatory: true,
    hazopsRelevance: ['methodology', 'documentation'],
  },
  {
    id: '6.1',
    title: 'Actions to address risks and opportunities',
    description:
      'When planning for the quality management system, the organization shall consider risks and ' +
      'opportunities that need to be addressed to ensure the QMS can achieve its intended results.',
    keywords: ['risks', 'opportunities', 'planning'],
    mandatory: true,
    hazopsRelevance: ['risk_assessment', 'hazard_identification'],
  },
  {
    id: '6.1.1',
    title: 'Risk-based thinking',
    description:
      'The organization shall plan actions to address risks and opportunities. The organization shall ' +
      'plan how to integrate and implement the actions into its QMS processes.',
    keywords: ['risk-based thinking', 'actions', 'implementation'],
    mandatory: true,
    parentClauseId: '6.1',
    hazopsRelevance: ['risk_assessment', 'recommendations'],
  },
  {
    id: '7.1.6',
    title: 'Organizational knowledge',
    description:
      'The organization shall determine the knowledge necessary for the operation of its processes ' +
      'and to achieve conformity of products and services.',
    keywords: ['knowledge', 'competence', 'lessons learned'],
    mandatory: true,
    hazopsRelevance: ['team_composition', 'documentation'],
  },
  {
    id: '7.2',
    title: 'Competence',
    description:
      'The organization shall determine the necessary competence of persons doing work under its control ' +
      'that affects the performance and effectiveness of the QMS.',
    keywords: ['competence', 'training', 'qualification'],
    mandatory: true,
    hazopsRelevance: ['team_composition'],
  },
  {
    id: '7.5',
    title: 'Documented information',
    description:
      'The organizations QMS shall include documented information required by ISO 9001 and ' +
      'determined by the organization as being necessary for the effectiveness of the QMS.',
    keywords: ['documentation', 'records', 'information'],
    mandatory: true,
    hazopsRelevance: ['documentation'],
  },
  {
    id: '8.1',
    title: 'Operational planning and control',
    description:
      'The organization shall plan, implement and control the processes needed to meet requirements ' +
      'for the provision of products and services.',
    keywords: ['operational planning', 'control', 'processes'],
    mandatory: true,
    hazopsRelevance: ['methodology', 'safeguards'],
  },
  {
    id: '8.3',
    title: 'Design and development of products and services',
    description:
      'The organization shall establish, implement and maintain a design and development process ' +
      'that is appropriate to ensure the subsequent provision of products and services.',
    keywords: ['design', 'development', 'products', 'services'],
    mandatory: true,
    hazopsRelevance: ['methodology'],
  },
  {
    id: '8.3.3',
    title: 'Design and development inputs',
    description:
      'The organization shall determine the requirements essential for the specific types of products ' +
      'and services to be designed and developed, including statutory and regulatory requirements.',
    keywords: ['design inputs', 'requirements', 'regulatory'],
    mandatory: true,
    parentClauseId: '8.3',
    hazopsRelevance: ['hazard_identification'],
  },
  {
    id: '8.5.6',
    title: 'Control of changes',
    description:
      'The organization shall review and control changes for production or service provision to ensure ' +
      'continuing conformity with requirements.',
    keywords: ['change control', 'MOC', 'conformity'],
    mandatory: true,
    hazopsRelevance: ['management_of_change'],
  },
  {
    id: '9.1',
    title: 'Monitoring, measurement, analysis and evaluation',
    description:
      'The organization shall determine what needs to be monitored and measured, the methods for ' +
      'monitoring, measurement, analysis and evaluation.',
    keywords: ['monitoring', 'measurement', 'analysis', 'evaluation'],
    mandatory: true,
    hazopsRelevance: ['follow_up', 'risk_assessment'],
  },
  {
    id: '10.2',
    title: 'Nonconformity and corrective action',
    description:
      'When a nonconformity occurs, the organization shall react to the nonconformity, evaluate the ' +
      'need for action to eliminate the causes, implement any action needed, review effectiveness.',
    keywords: ['nonconformity', 'corrective action', 'root cause'],
    mandatory: true,
    hazopsRelevance: ['recommendations', 'follow_up'],
  },
  {
    id: '10.3',
    title: 'Continual improvement',
    description:
      'The organization shall continually improve the suitability, adequacy and effectiveness of the QMS.',
    keywords: ['continual improvement', 'effectiveness'],
    mandatory: true,
    hazopsRelevance: ['follow_up', 'methodology'],
  },
];

/**
 * ISO 9001 standard definition.
 */
const ISO_9001: RegulatoryStandard = {
  id: 'ISO_9001',
  name: 'ISO 9001',
  title: 'Quality management systems - Requirements',
  description:
    'International standard for quality management systems. Specifies requirements for ' +
    'organizations to demonstrate ability to consistently provide products/services ' +
    'meeting customer and regulatory requirements.',
  category: 'quality_management',
  jurisdiction: 'international',
  version: '2015',
  year: 2015,
  issuingBody: 'International Organization for Standardization (ISO)',
  url: 'https://www.iso.org/standard/62085.html',
  mandatory: false,
  relatedStandards: ['ISO_31000'],
  relevantClauses: ISO_9001_CLAUSES,
};

// ============================================================================
// ATEX/DSEAR - Explosive Atmospheres Directives
// ============================================================================

/**
 * ATEX/DSEAR clauses relevant to HazOps analysis.
 *
 * ATEX covers two EU directives:
 * - ATEX 2014/34/EU (Equipment Directive): Equipment for explosive atmospheres
 * - ATEX 1999/92/EC (Workplace Directive): Worker protection
 *
 * DSEAR (Dangerous Substances and Explosive Atmospheres Regulations 2002)
 * is the UK implementation of ATEX 1999/92/EC.
 *
 * These regulations are critical for HazOps in process industries handling
 * flammable gases, vapors, mists, or combustible dusts.
 */
const ATEX_DSEAR_CLAUSES: RegulatoryClause[] = [
  // DSEAR/ATEX 1999/92/EC - Risk Assessment Requirements
  {
    id: 'DSEAR-5',
    title: 'Risk assessment',
    description:
      'Where a dangerous substance is or may be present, the employer shall assess the risks arising ' +
      'from that substance. The assessment shall include consideration of the hazardous properties ' +
      'of the substance, circumstances of work including quantity, processes, and control measures.',
    keywords: ['risk assessment', 'dangerous substance', 'hazardous properties', 'control measures'],
    mandatory: true,
    hazopsRelevance: ['hazard_identification', 'risk_assessment'],
  },
  {
    id: 'DSEAR-5.1',
    title: 'Risk assessment - Hazardous properties',
    description:
      'The risk assessment shall consider the hazardous properties of the dangerous substance, ' +
      'including flammability, explosivity, and reactivity.',
    keywords: ['flammability', 'explosivity', 'reactivity', 'hazardous properties'],
    mandatory: true,
    parentClauseId: 'DSEAR-5',
    hazopsRelevance: ['hazard_identification'],
  },
  {
    id: 'DSEAR-5.2',
    title: 'Risk assessment - Work circumstances',
    description:
      'The risk assessment shall consider the circumstances of work, including work processes ' +
      'and activities, quantities of dangerous substances, and interaction between substances.',
    keywords: ['work processes', 'quantities', 'interaction', 'activities'],
    mandatory: true,
    parentClauseId: 'DSEAR-5',
    hazopsRelevance: ['hazard_identification', 'methodology'],
  },
  {
    id: 'DSEAR-5.3',
    title: 'Risk assessment - Ignition sources',
    description:
      'The risk assessment shall identify potential ignition sources, including electrical equipment, ' +
      'hot surfaces, static electricity, and mechanical sparks.',
    keywords: ['ignition sources', 'electrical', 'static electricity', 'hot surfaces', 'sparks'],
    mandatory: true,
    parentClauseId: 'DSEAR-5',
    hazopsRelevance: ['hazard_identification', 'risk_assessment'],
  },
  // Zone Classification
  {
    id: 'DSEAR-7',
    title: 'Hazardous area classification (zoning)',
    description:
      'The employer shall classify hazardous places into zones on the basis of the frequency and ' +
      'duration of explosive atmospheres. Zone 0/20 (continuous), Zone 1/21 (likely), Zone 2/22 (unlikely).',
    keywords: ['zone', 'classification', 'explosive atmosphere', 'Zone 0', 'Zone 1', 'Zone 2'],
    mandatory: true,
    hazopsRelevance: ['hazard_identification', 'risk_ranking'],
  },
  {
    id: 'DSEAR-7.1',
    title: 'Zone 0/20 - Continuous explosive atmosphere',
    description:
      'A place in which an explosive atmosphere is present continuously or for long periods or frequently. ' +
      'Zone 0 for gases/vapors, Zone 20 for dusts. Equipment must be Category 1 certified.',
    keywords: ['Zone 0', 'Zone 20', 'continuous', 'Category 1', 'permanent hazard'],
    mandatory: true,
    parentClauseId: 'DSEAR-7',
    hazopsRelevance: ['hazard_identification', 'safeguards'],
  },
  {
    id: 'DSEAR-7.2',
    title: 'Zone 1/21 - Likely explosive atmosphere',
    description:
      'A place in which an explosive atmosphere is likely to occur occasionally in normal operation. ' +
      'Zone 1 for gases/vapors, Zone 21 for dusts. Equipment must be Category 2 or higher certified.',
    keywords: ['Zone 1', 'Zone 21', 'occasionally', 'Category 2', 'likely hazard'],
    mandatory: true,
    parentClauseId: 'DSEAR-7',
    hazopsRelevance: ['hazard_identification', 'safeguards'],
  },
  {
    id: 'DSEAR-7.3',
    title: 'Zone 2/22 - Unlikely explosive atmosphere',
    description:
      'A place in which an explosive atmosphere is not likely to occur in normal operation but, ' +
      'if it does, will persist for a short period only. Zone 2 for gases/vapors, Zone 22 for dusts. ' +
      'Equipment must be Category 3 or higher certified.',
    keywords: ['Zone 2', 'Zone 22', 'unlikely', 'Category 3', 'abnormal operation'],
    mandatory: true,
    parentClauseId: 'DSEAR-7',
    hazopsRelevance: ['hazard_identification', 'safeguards'],
  },
  // Control Measures
  {
    id: 'DSEAR-6',
    title: 'Elimination and reduction of risks',
    description:
      'The employer shall ensure that risks are eliminated or reduced so far as is reasonably practicable. ' +
      'This includes substitution, engineering controls, control of sources of ignition, and mitigation.',
    keywords: ['elimination', 'reduction', 'substitution', 'engineering controls', 'mitigation'],
    mandatory: true,
    hazopsRelevance: ['safeguards', 'recommendations'],
  },
  {
    id: 'DSEAR-6.1',
    title: 'Prevention hierarchy - Substitution',
    description:
      'Where reasonably practicable, replace the dangerous substance with a substance or process ' +
      'which eliminates or reduces the risk.',
    keywords: ['substitution', 'replacement', 'eliminate', 'hierarchy of controls'],
    mandatory: true,
    parentClauseId: 'DSEAR-6',
    hazopsRelevance: ['recommendations', 'safeguards'],
  },
  {
    id: 'DSEAR-6.2',
    title: 'Prevention hierarchy - Reduce quantity',
    description:
      'Reduce to a minimum the quantity of dangerous substances to the minimum necessary for the work.',
    keywords: ['quantity', 'minimize', 'inventory reduction'],
    mandatory: true,
    parentClauseId: 'DSEAR-6',
    hazopsRelevance: ['recommendations', 'safeguards'],
  },
  {
    id: 'DSEAR-6.3',
    title: 'Prevention hierarchy - Avoid release',
    description:
      'Avoid the release of dangerous substances, or if release cannot be prevented, prevent the ' +
      'formation of explosive atmospheres.',
    keywords: ['avoid release', 'containment', 'prevention', 'explosive atmosphere formation'],
    mandatory: true,
    parentClauseId: 'DSEAR-6',
    hazopsRelevance: ['safeguards', 'recommendations'],
  },
  {
    id: 'DSEAR-6.4',
    title: 'Prevention hierarchy - Control ignition sources',
    description:
      'Control sources of ignition including static electricity discharges using appropriate equipment, ' +
      'bonding, grounding, and work procedures.',
    keywords: ['ignition control', 'static electricity', 'bonding', 'grounding', 'work procedures'],
    mandatory: true,
    parentClauseId: 'DSEAR-6',
    hazopsRelevance: ['safeguards'],
  },
  {
    id: 'DSEAR-6.5',
    title: 'Mitigation measures',
    description:
      'Where prevention is not possible, mitigate the detrimental effects of an explosion to ensure ' +
      'health and safety of employees. This includes explosion relief, suppression, and containment.',
    keywords: ['mitigation', 'explosion relief', 'suppression', 'containment', 'venting'],
    mandatory: true,
    parentClauseId: 'DSEAR-6',
    hazopsRelevance: ['safeguards', 'recommendations'],
  },
  // Equipment Requirements
  {
    id: 'DSEAR-8',
    title: 'Equipment for hazardous areas',
    description:
      'Equipment and protective systems in hazardous areas shall be selected on the basis of ATEX ' +
      'equipment groups and categories corresponding to the zone classification.',
    keywords: ['equipment selection', 'ATEX', 'categories', 'groups', 'Ex-rating'],
    mandatory: true,
    hazopsRelevance: ['safeguards'],
  },
  {
    id: 'ATEX-Annex-I',
    title: 'Essential health and safety requirements (EHSR)',
    description:
      'ATEX 2014/34/EU Annex II specifies Essential Health and Safety Requirements for equipment ' +
      'intended for use in explosive atmospheres, including ignition hazard assessment and protection.',
    keywords: ['EHSR', 'essential requirements', 'Annex II', 'ignition hazard'],
    mandatory: true,
    hazopsRelevance: ['safeguards', 'methodology'],
  },
  // Documentation
  {
    id: 'DSEAR-9',
    title: 'Explosion Protection Document',
    description:
      'The employer shall prepare an Explosion Protection Document (EPD) setting out the findings ' +
      'of the risk assessment, measures taken, classification of zones, and equipment requirements.',
    keywords: ['EPD', 'explosion protection document', 'documentation', 'findings'],
    mandatory: true,
    hazopsRelevance: ['documentation'],
  },
  {
    id: 'DSEAR-9.1',
    title: 'EPD content - Hazards identified',
    description:
      'The Explosion Protection Document shall describe the hazards that have been identified ' +
      'and include the risk assessment results.',
    keywords: ['hazards identified', 'risk assessment results', 'EPD content'],
    mandatory: true,
    parentClauseId: 'DSEAR-9',
    hazopsRelevance: ['documentation', 'hazard_identification'],
  },
  {
    id: 'DSEAR-9.2',
    title: 'EPD content - Protective measures',
    description:
      'The Explosion Protection Document shall describe the measures which have been taken or will be taken ' +
      'to comply with the regulations.',
    keywords: ['protective measures', 'compliance', 'EPD content'],
    mandatory: true,
    parentClauseId: 'DSEAR-9',
    hazopsRelevance: ['documentation', 'safeguards'],
  },
  {
    id: 'DSEAR-9.3',
    title: 'EPD content - Zone classification',
    description:
      'The Explosion Protection Document shall include the classification of hazardous places into zones.',
    keywords: ['zone classification', 'hazardous places', 'EPD content'],
    mandatory: true,
    parentClauseId: 'DSEAR-9',
    hazopsRelevance: ['documentation'],
  },
  // Coordination and Review
  {
    id: 'DSEAR-11',
    title: 'Co-ordination',
    description:
      'Where two or more employers share a workplace, each shall co-operate with the others to comply ' +
      'with the regulations and share relevant information about explosion risks.',
    keywords: ['co-ordination', 'shared workplace', 'information sharing'],
    mandatory: true,
    hazopsRelevance: ['team_composition', 'methodology'],
  },
  {
    id: 'DSEAR-5.4',
    title: 'Review of risk assessment',
    description:
      'The risk assessment shall be reviewed regularly and immediately if there is reason to suspect ' +
      'it is no longer valid or there has been a significant change.',
    keywords: ['review', 'reassessment', 'change', 'validity'],
    mandatory: true,
    parentClauseId: 'DSEAR-5',
    hazopsRelevance: ['follow_up', 'management_of_change'],
  },
];

/**
 * ATEX/DSEAR standard definition.
 */
const ATEX_DSEAR: RegulatoryStandard = {
  id: 'ATEX_DSEAR',
  name: 'ATEX/DSEAR',
  title: 'Equipment and protective systems for explosive atmospheres',
  description:
    'European directives covering equipment and protective systems for use in explosive ' +
    'atmospheres, and workplace protection. ATEX 2014/34/EU (Equipment Directive) covers ' +
    'equipment certification, ATEX 1999/92/EC (Workplace Directive) covers worker protection. ' +
    'DSEAR (Dangerous Substances and Explosive Atmospheres Regulations 2002) is the UK ' +
    'implementation of ATEX 1999/92/EC.',
  category: 'explosive_atmospheres',
  jurisdiction: 'european_union',
  version: 'ATEX 2014/34/EU, DSEAR 2002 (amended 2015)',
  year: 2014,
  issuingBody: 'European Commission / UK HSE',
  url: 'https://www.hse.gov.uk/fireandexplosion/dsear.htm',
  mandatory: true,
  relatedStandards: ['IEC_61511', 'SEVESO_III'],
  relevantClauses: ATEX_DSEAR_CLAUSES,
};

// ============================================================================
// PED - Pressure Equipment Directive
// ============================================================================

/**
 * PED (Pressure Equipment Directive 2014/68/EU) clauses relevant to HazOps analysis.
 *
 * The PED applies to the design, manufacture, and conformity assessment of
 * pressure equipment and assemblies with a maximum allowable pressure greater
 * than 0.5 bar. It is critical for HazOps in process industries involving
 * pressure vessels, piping, safety accessories, and pressure accessories.
 *
 * Key aspects covered:
 * - Classification of pressure equipment by category (I-IV)
 * - Essential Safety Requirements (ESR)
 * - Conformity assessment procedures
 * - Materials requirements
 * - Safety devices
 * - Documentation and CE marking
 */
const PED_CLAUSES: RegulatoryClause[] = [
  // Scope and Classification
  {
    id: 'PED-Art-1',
    title: 'Subject matter and scope',
    description:
      'The directive applies to the design, manufacture, and conformity assessment of pressure equipment ' +
      'and assemblies with a maximum allowable pressure (PS) greater than 0.5 bar. Includes vessels, piping, ' +
      'safety accessories, and pressure accessories.',
    keywords: ['scope', 'pressure equipment', 'maximum allowable pressure', 'PS', 'assemblies'],
    mandatory: true,
    hazopsRelevance: ['methodology', 'hazard_identification'],
  },
  {
    id: 'PED-Art-4',
    title: 'Classification of pressure equipment',
    description:
      'Pressure equipment shall be classified into categories I, II, III, or IV according to ascending ' +
      'level of hazard. Classification is based on maximum allowable pressure, volume (for vessels) or ' +
      'nominal size (for piping), and group of fluids (Group 1: dangerous, Group 2: other).',
    keywords: ['classification', 'category', 'hazard level', 'Group 1', 'Group 2', 'fluid group'],
    mandatory: true,
    hazopsRelevance: ['risk_ranking', 'hazard_identification'],
  },
  {
    id: 'PED-Art-4.1',
    title: 'Fluid groups',
    description:
      'Fluids are divided into two groups. Group 1 comprises dangerous fluids: explosives, extremely flammable, ' +
      'highly flammable, flammable (under certain conditions), very toxic, toxic, and oxidizing. ' +
      'Group 2 comprises all other fluids not referred to in Group 1.',
    keywords: ['fluid group', 'dangerous fluids', 'flammable', 'toxic', 'oxidizing', 'Group 1', 'Group 2'],
    mandatory: true,
    parentClauseId: 'PED-Art-4',
    hazopsRelevance: ['hazard_identification', 'risk_ranking'],
  },
  {
    id: 'PED-Art-4.2',
    title: 'Category determination tables',
    description:
      'Annex II provides conformity assessment tables based on equipment type (vessels, piping), fluid group, ' +
      'and the product of PS × V (for vessels) or PS × DN (for piping). Higher categories require more ' +
      'stringent conformity assessment procedures.',
    keywords: ['Annex II', 'conformity assessment', 'PS×V', 'PS×DN', 'category tables'],
    mandatory: true,
    parentClauseId: 'PED-Art-4',
    hazopsRelevance: ['risk_ranking', 'methodology'],
  },
  // Essential Safety Requirements (Annex I)
  {
    id: 'PED-Annex-I',
    title: 'Essential Safety Requirements (ESR)',
    description:
      'Annex I sets out the essential safety requirements that must be met by pressure equipment and assemblies. ' +
      'Manufacturers must analyze hazards, design and construct to eliminate or reduce hazards, apply protective ' +
      'measures, and inform users of residual hazards.',
    keywords: ['ESR', 'essential safety requirements', 'Annex I', 'hazard analysis', 'protective measures'],
    mandatory: true,
    hazopsRelevance: ['hazard_identification', 'safeguards', 'risk_assessment'],
  },
  {
    id: 'PED-Annex-I-1',
    title: 'General - Hazard analysis',
    description:
      'The manufacturer shall carry out a suitable hazard analysis to identify all hazards applicable to the ' +
      'equipment due to pressure. The equipment shall then be designed and constructed taking into account ' +
      'the analysis.',
    keywords: ['hazard analysis', 'pressure hazards', 'design', 'construction'],
    mandatory: true,
    parentClauseId: 'PED-Annex-I',
    hazopsRelevance: ['hazard_identification', 'risk_assessment'],
  },
  {
    id: 'PED-Annex-I-2.1',
    title: 'Design for adequate strength',
    description:
      'Pressure equipment shall be designed for loadings appropriate to intended use and reasonably foreseeable ' +
      'conditions. Factors include internal/external pressure, ambient and operational temperatures, static ' +
      'pressure and mass of contents, traffic, wind and earthquake loads, reaction forces, and fatigue.',
    keywords: ['design', 'strength', 'loadings', 'pressure', 'temperature', 'fatigue', 'earthquake'],
    mandatory: true,
    parentClauseId: 'PED-Annex-I',
    hazopsRelevance: ['hazard_identification', 'safeguards'],
  },
  {
    id: 'PED-Annex-I-2.2',
    title: 'Design for safe handling and operation',
    description:
      'Provisions must be made for safe handling during manufacture, transport, and installation. Equipment shall ' +
      'have adequate vents and drains, allow access for inspection, and have means for safe operation throughout ' +
      'its life cycle.',
    keywords: ['safe handling', 'operation', 'vents', 'drains', 'inspection access', 'maintenance'],
    mandatory: true,
    parentClauseId: 'PED-Annex-I',
    hazopsRelevance: ['safeguards', 'methodology'],
  },
  {
    id: 'PED-Annex-I-2.3',
    title: 'Means of examination',
    description:
      'Pressure equipment shall be designed so that all necessary examinations can be carried out to ensure ' +
      'safety. Internal inspections must be possible. Where appropriate, other means must be provided to ' +
      'ensure safe condition.',
    keywords: ['examination', 'inspection', 'internal inspection', 'condition monitoring'],
    mandatory: true,
    parentClauseId: 'PED-Annex-I',
    hazopsRelevance: ['safeguards', 'follow_up'],
  },
  {
    id: 'PED-Annex-I-2.4',
    title: 'Means of draining and venting',
    description:
      'Adequate means shall be provided for draining and venting of pressure equipment where necessary to ' +
      'avoid harmful effects such as water hammer, vacuum collapse, corrosion, and uncontrolled chemical reactions.',
    keywords: ['draining', 'venting', 'water hammer', 'vacuum', 'corrosion', 'chemical reactions'],
    mandatory: true,
    parentClauseId: 'PED-Annex-I',
    hazopsRelevance: ['safeguards', 'hazard_identification'],
  },
  {
    id: 'PED-Annex-I-2.5',
    title: 'Protection against exceeding allowable limits',
    description:
      'Where operating conditions could exceed allowable limits, pressure equipment shall be fitted with ' +
      'or provision made for protective devices, unless the equipment is protected by other protective ' +
      'devices within an assembly.',
    keywords: ['overpressure protection', 'allowable limits', 'protective devices', 'safety devices'],
    mandatory: true,
    parentClauseId: 'PED-Annex-I',
    hazopsRelevance: ['safeguards', 'risk_assessment'],
  },
  // Safety Accessories
  {
    id: 'PED-Annex-I-2.10',
    title: 'Safety accessories',
    description:
      'Safety accessories shall be designed and constructed to be reliable and suitable for intended use. ' +
      'They must take account of maintenance and testing requirements where relevant.',
    keywords: ['safety accessories', 'reliability', 'maintenance', 'testing'],
    mandatory: true,
    parentClauseId: 'PED-Annex-I',
    hazopsRelevance: ['safeguards', 'follow_up'],
  },
  {
    id: 'PED-Annex-I-2.11.1',
    title: 'Pressure limiting devices',
    description:
      'Pressure limiting devices shall be designed so that pressure will not permanently exceed the maximum ' +
      'allowable pressure (PS). However, a short duration pressure surge is permissible where appropriate, ' +
      'limited to 10% of PS.',
    keywords: ['pressure limiting', 'pressure relief', 'PS', 'surge', 'overpressure'],
    mandatory: true,
    parentClauseId: 'PED-Annex-I-2.10',
    hazopsRelevance: ['safeguards'],
  },
  {
    id: 'PED-Annex-I-2.11.2',
    title: 'Temperature monitoring devices',
    description:
      'Temperature monitoring devices must have adequate response time for safety, taking account of the ' +
      'design of the pressure equipment.',
    keywords: ['temperature monitoring', 'response time', 'safety instruments'],
    mandatory: true,
    parentClauseId: 'PED-Annex-I-2.10',
    hazopsRelevance: ['safeguards'],
  },
  // External Fire
  {
    id: 'PED-Annex-I-2.12',
    title: 'External fire',
    description:
      'Where necessary, pressure equipment shall be designed and, where appropriate, equipped with suitable ' +
      'accessories or provision made for them, to meet damage limitation requirements in the event of ' +
      'external fire, having particular regard to intended use.',
    keywords: ['external fire', 'fire protection', 'damage limitation', 'fire relief'],
    mandatory: true,
    parentClauseId: 'PED-Annex-I',
    hazopsRelevance: ['safeguards', 'hazard_identification'],
  },
  // Materials
  {
    id: 'PED-Annex-I-4',
    title: 'Materials',
    description:
      'Materials used in the manufacture of pressure equipment shall be suitable for such application during ' +
      'the foreseeable life of the equipment. Materials must have appropriate properties, adequate chemical ' +
      'resistance, not be significantly affected by ageing, and be suitable for intended processing procedures.',
    keywords: ['materials', 'suitability', 'chemical resistance', 'ageing', 'processing'],
    mandatory: true,
    parentClauseId: 'PED-Annex-I',
    hazopsRelevance: ['safeguards', 'hazard_identification'],
  },
  {
    id: 'PED-Annex-I-4.1',
    title: 'Material properties',
    description:
      'The material shall have properties appropriate to all reasonably foreseeable operating conditions and ' +
      'test conditions. It shall be sufficiently ductile and tough, chemically resistant to the fluid, and ' +
      'not significantly affected by ageing.',
    keywords: ['ductility', 'toughness', 'chemical resistance', 'operating conditions', 'material selection'],
    mandatory: true,
    parentClauseId: 'PED-Annex-I-4',
    hazopsRelevance: ['hazard_identification', 'safeguards'],
  },
  // Manufacture and Assembly
  {
    id: 'PED-Annex-I-3',
    title: 'Manufacturing',
    description:
      'The manufacturer shall ensure that the provisions made at the design stage are properly implemented ' +
      'and adequate manufacturing techniques and procedures are used. Includes welding, heat treatment, ' +
      'and traceability.',
    keywords: ['manufacturing', 'welding', 'heat treatment', 'traceability', 'quality control'],
    mandatory: true,
    parentClauseId: 'PED-Annex-I',
    hazopsRelevance: ['methodology', 'safeguards'],
  },
  {
    id: 'PED-Annex-I-3.1.2',
    title: 'Permanent joints',
    description:
      'Permanent joints and adjacent zones shall be free from surface and internal defects detrimental to ' +
      'equipment safety. Welded joints shall be made by suitably qualified welders using approved procedures.',
    keywords: ['permanent joints', 'welding', 'defects', 'qualified welders', 'welding procedures'],
    mandatory: true,
    parentClauseId: 'PED-Annex-I-3',
    hazopsRelevance: ['safeguards', 'methodology'],
  },
  {
    id: 'PED-Annex-I-3.1.3',
    title: 'Non-destructive tests',
    description:
      'Non-destructive tests of permanent joints shall be carried out by suitably qualified personnel. ' +
      'For pressure equipment in categories III and IV, the personnel shall have been approved by a ' +
      'third-party organization.',
    keywords: ['NDT', 'non-destructive testing', 'qualification', 'third party', 'inspection'],
    mandatory: true,
    parentClauseId: 'PED-Annex-I-3',
    hazopsRelevance: ['methodology', 'follow_up'],
  },
  // Final Assessment and Testing
  {
    id: 'PED-Annex-I-3.2',
    title: 'Final assessment',
    description:
      'Pressure equipment shall undergo final assessment including examination of internal and external ' +
      'surfaces, review of documentation, and a proof test (normally hydrostatic) at a pressure ' +
      'corresponding to 1.25 to 1.43 times PS.',
    keywords: ['final assessment', 'proof test', 'hydrostatic test', 'visual examination'],
    mandatory: true,
    parentClauseId: 'PED-Annex-I-3',
    hazopsRelevance: ['methodology', 'follow_up'],
  },
  // Documentation
  {
    id: 'PED-Annex-I-3.3',
    title: 'Marking and labelling',
    description:
      'Pressure equipment shall bear CE marking and information including manufacturer identification, year ' +
      'of manufacture, equipment identification, essential maximum/minimum allowable limits, pressure (PS), ' +
      'temperature limits, volume/nominal size.',
    keywords: ['CE marking', 'labelling', 'identification', 'traceability', 'nameplate'],
    mandatory: true,
    parentClauseId: 'PED-Annex-I-3',
    hazopsRelevance: ['documentation'],
  },
  {
    id: 'PED-Annex-I-3.4',
    title: 'Operating instructions',
    description:
      'Pressure equipment shall be accompanied by instructions containing all necessary safety information ' +
      'for putting into service, use, maintenance, inspection, adjustment, and dismantling.',
    keywords: ['operating instructions', 'safety information', 'maintenance', 'user manual'],
    mandatory: true,
    parentClauseId: 'PED-Annex-I-3',
    hazopsRelevance: ['documentation', 'follow_up'],
  },
  // Technical Documentation
  {
    id: 'PED-Annex-III',
    title: 'Technical documentation',
    description:
      'The manufacturer shall draw up technical documentation enabling conformity assessment and including: ' +
      'general description, design and manufacturing drawings, calculations, descriptions of solutions adopted ' +
      'to meet ESR, test reports, and relevant elements of the quality assurance system.',
    keywords: ['technical documentation', 'design drawings', 'calculations', 'test reports', 'conformity'],
    mandatory: true,
    hazopsRelevance: ['documentation'],
  },
  // Conformity Assessment
  {
    id: 'PED-Art-14',
    title: 'Conformity assessment procedures',
    description:
      'Pressure equipment shall be subject to conformity assessment procedures per Annex III. Category I ' +
      'allows self-certification; Categories II-IV require increasing involvement of Notified Bodies ' +
      '(module combinations A2, B+D, B+F, G, H, H1).',
    keywords: ['conformity assessment', 'Notified Body', 'modules', 'certification', 'category'],
    mandatory: true,
    hazopsRelevance: ['methodology', 'documentation'],
  },
  // Assemblies
  {
    id: 'PED-Art-2.6',
    title: 'Assemblies',
    description:
      'An assembly is several pieces of pressure equipment assembled by a manufacturer to constitute an ' +
      'integrated and functional whole. Assemblies must be designed so the various elements are suitably ' +
      'integrated and safe, with at least one item of equipment subject to PED.',
    keywords: ['assembly', 'integration', 'functional whole', 'system'],
    mandatory: true,
    hazopsRelevance: ['methodology', 'hazard_identification'],
  },
  // HazOps-specific Requirements
  {
    id: 'PED-HazOps-1',
    title: 'Pressure hazard identification in HazOps',
    description:
      'During HazOps analysis of pressure equipment, systematically consider: overpressure scenarios, ' +
      'vacuum conditions, thermal expansion, blocked outlets, loss of cooling, runaway reactions, ' +
      'hydraulic hammer, and external fire exposure.',
    keywords: ['HazOps', 'overpressure', 'vacuum', 'thermal expansion', 'blocked outlet', 'runaway reaction'],
    mandatory: false,
    hazopsRelevance: ['hazard_identification', 'risk_assessment'],
  },
  {
    id: 'PED-HazOps-2',
    title: 'Safeguards for pressure equipment',
    description:
      'Typical safeguards for pressure equipment hazards include: pressure relief valves (PRVs), ' +
      'rupture discs, pressure indicators, level indicators, temperature indicators, high-pressure ' +
      'interlocks, process control systems, and emergency shutdown systems.',
    keywords: ['PRV', 'rupture disc', 'pressure relief', 'interlock', 'safeguards', 'ESD'],
    mandatory: false,
    hazopsRelevance: ['safeguards', 'recommendations'],
  },
];

/**
 * PED standard definition.
 */
const PED: RegulatoryStandard = {
  id: 'PED',
  name: 'Pressure Equipment Directive (PED)',
  title: 'Pressure Equipment Directive 2014/68/EU',
  description:
    'European directive for pressure equipment and assemblies with maximum allowable ' +
    'pressure > 0.5 bar. Covers design, manufacture, and conformity assessment of ' +
    'pressure vessels, piping, safety accessories, and pressure accessories. ' +
    'Equipment is categorized I-IV based on hazard level, with conformity assessment ' +
    'procedures ranging from self-certification to full Notified Body involvement.',
  category: 'pressure_equipment',
  jurisdiction: 'european_union',
  version: '2014/68/EU',
  year: 2014,
  issuingBody: 'European Parliament and Council',
  url: 'https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX%3A32014L0068',
  mandatory: true,
  relatedStandards: ['IEC_61511', 'ATEX_DSEAR', 'SEVESO_III'],
  relevantClauses: PED_CLAUSES,
};

// ============================================================================
// OSHA PSM - Process Safety Management
// ============================================================================

/**
 * OSHA PSM (29 CFR 1910.119) clauses relevant to HazOps analysis.
 *
 * OSHA's Process Safety Management standard applies to processes involving
 * highly hazardous chemicals (HHCs) above threshold quantities. It is the
 * primary US federal regulation for process safety and specifically requires
 * Process Hazard Analysis (PHA) such as HazOps.
 *
 * Key coverage areas:
 * - Employee participation
 * - Process Safety Information (PSI)
 * - Process Hazard Analysis (PHA)
 * - Operating procedures
 * - Training
 * - Contractors
 * - Pre-startup safety review
 * - Mechanical integrity
 * - Hot work permit
 * - Management of change (MOC)
 * - Incident investigation
 * - Emergency planning
 * - Compliance audits
 * - Trade secrets
 *
 * Task: COMP-04
 */
const OSHA_PSM_CLAUSES: RegulatoryClause[] = [
  // Scope and Application
  {
    id: 'PSM-1910.119(a)',
    title: 'Application',
    description:
      'This standard applies to processes involving a chemical at or above threshold quantities ' +
      'specified in Appendix A, processes involving flammable liquids or gases on site in one location ' +
      'in quantities of 10,000 pounds or more, and processes involving highly hazardous chemicals.',
    keywords: ['scope', 'application', 'threshold quantity', 'highly hazardous chemicals', 'HHC', 'flammable'],
    mandatory: true,
    hazopsRelevance: ['methodology', 'hazard_identification'],
  },
  // Employee Participation
  {
    id: 'PSM-1910.119(c)',
    title: 'Employee participation',
    description:
      'Employers shall develop a written plan of action regarding employee participation and shall ' +
      'consult with employees and their representatives on the conduct and development of process hazard ' +
      'analyses and other elements of process safety management.',
    keywords: ['employee participation', 'consultation', 'representatives', 'involvement'],
    mandatory: true,
    hazopsRelevance: ['team_composition', 'methodology'],
  },
  {
    id: 'PSM-1910.119(c)(1)',
    title: 'Written plan for employee participation',
    description:
      'Employers shall develop a written plan of action regarding the implementation of the employee ' +
      'participation required by this standard.',
    keywords: ['written plan', 'employee participation', 'action plan'],
    mandatory: true,
    parentClauseId: 'PSM-1910.119(c)',
    hazopsRelevance: ['documentation', 'team_composition'],
  },
  {
    id: 'PSM-1910.119(c)(2)',
    title: 'Employee access to PHA information',
    description:
      'Employers shall provide employees and their representatives access to process hazard analyses ' +
      'and to all other information required to be developed under this standard.',
    keywords: ['access', 'PHA', 'information', 'employees', 'representatives'],
    mandatory: true,
    parentClauseId: 'PSM-1910.119(c)',
    hazopsRelevance: ['documentation'],
  },
  // Process Safety Information (PSI)
  {
    id: 'PSM-1910.119(d)',
    title: 'Process Safety Information',
    description:
      'The employer shall complete a compilation of written process safety information before conducting ' +
      'any process hazard analysis. The compilation shall include information pertaining to the hazards ' +
      'of highly hazardous chemicals, technology of the process, and equipment in the process.',
    keywords: ['PSI', 'process safety information', 'compilation', 'hazards', 'technology', 'equipment'],
    mandatory: true,
    hazopsRelevance: ['documentation', 'hazard_identification', 'methodology'],
  },
  {
    id: 'PSM-1910.119(d)(1)',
    title: 'PSI - Hazards of highly hazardous chemicals',
    description:
      'Process safety information shall include information on the hazards of the highly hazardous chemicals ' +
      'used or produced by the process: toxicity, permissible exposure limits, physical data, reactivity data, ' +
      'corrosivity data, thermal and chemical stability, and hazardous effects of inadvertent mixing.',
    keywords: ['chemical hazards', 'toxicity', 'PEL', 'reactivity', 'corrosivity', 'stability', 'mixing hazards'],
    mandatory: true,
    parentClauseId: 'PSM-1910.119(d)',
    hazopsRelevance: ['hazard_identification'],
  },
  {
    id: 'PSM-1910.119(d)(2)',
    title: 'PSI - Technology of the process',
    description:
      'Process safety information shall include information concerning the technology of the process: ' +
      'block flow diagram or simplified process flow diagram, process chemistry, maximum intended inventory, ' +
      'safe upper and lower limits for temperature, pressure, flow, and composition, and consequences of deviation.',
    keywords: ['process technology', 'PFD', 'block diagram', 'chemistry', 'inventory', 'safe limits', 'deviation'],
    mandatory: true,
    parentClauseId: 'PSM-1910.119(d)',
    hazopsRelevance: ['hazard_identification', 'methodology'],
  },
  {
    id: 'PSM-1910.119(d)(3)',
    title: 'PSI - Equipment in the process',
    description:
      'Process safety information shall include information on equipment in the process: materials of construction, ' +
      'P&IDs, electrical classification, relief system design and design basis, ventilation system design, ' +
      'design codes and standards employed, material and energy balances, and safety systems.',
    keywords: ['equipment', 'P&ID', 'materials of construction', 'relief system', 'electrical classification', 'safety systems'],
    mandatory: true,
    parentClauseId: 'PSM-1910.119(d)',
    hazopsRelevance: ['hazard_identification', 'safeguards', 'documentation'],
  },
  // Process Hazard Analysis (PHA) - Core HazOps Requirements
  {
    id: 'PSM-1910.119(e)',
    title: 'Process Hazard Analysis',
    description:
      'The employer shall perform an initial process hazard analysis (PHA) on processes covered by this standard. ' +
      'The PHA shall be appropriate to the complexity of the process and shall identify, evaluate, and control ' +
      'the hazards involved in the process.',
    keywords: ['PHA', 'process hazard analysis', 'HAZOP', 'hazard identification', 'risk assessment'],
    mandatory: true,
    hazopsRelevance: ['hazard_identification', 'risk_assessment', 'methodology'],
  },
  {
    id: 'PSM-1910.119(e)(1)',
    title: 'PHA priority order',
    description:
      'The employer shall determine and document the priority order for conducting process hazard analyses ' +
      'based on: extent of the process hazards, number of potentially affected employees, age of the process, ' +
      'and operating history of the process.',
    keywords: ['priority', 'scheduling', 'hazard extent', 'affected employees', 'process age', 'operating history'],
    mandatory: true,
    parentClauseId: 'PSM-1910.119(e)',
    hazopsRelevance: ['methodology'],
  },
  {
    id: 'PSM-1910.119(e)(2)',
    title: 'PHA methodology selection',
    description:
      'The employer shall use one or more of the following methods: What-If, Checklist, What-If/Checklist, ' +
      'Hazard and Operability Study (HAZOP), Failure Mode and Effects Analysis (FMEA), Fault Tree Analysis, ' +
      'or an appropriate equivalent methodology.',
    keywords: ['HAZOP', 'What-If', 'checklist', 'FMEA', 'fault tree', 'methodology selection'],
    mandatory: true,
    parentClauseId: 'PSM-1910.119(e)',
    hazopsRelevance: ['methodology'],
  },
  {
    id: 'PSM-1910.119(e)(3)',
    title: 'PHA required content',
    description:
      'The PHA shall address: the hazards of the process, identification of previous incidents with likely ' +
      'potential for catastrophic consequences, engineering and administrative controls applicable to the hazards, ' +
      'consequences of failure of engineering and administrative controls, facility siting, human factors, and ' +
      'a qualitative evaluation of possible safety and health effects on employees.',
    keywords: ['hazards', 'incidents', 'engineering controls', 'administrative controls', 'consequences', 'facility siting', 'human factors'],
    mandatory: true,
    parentClauseId: 'PSM-1910.119(e)',
    hazopsRelevance: ['hazard_identification', 'risk_assessment', 'safeguards'],
  },
  {
    id: 'PSM-1910.119(e)(4)',
    title: 'PHA team requirements',
    description:
      'The PHA shall be performed by a team with expertise in engineering and process operations, and shall ' +
      'include at least one employee who has experience and knowledge specific to the process being evaluated, ' +
      'and one member who is knowledgeable in the specific PHA methodology being used.',
    keywords: ['team', 'expertise', 'engineering', 'operations', 'process knowledge', 'methodology knowledge'],
    mandatory: true,
    parentClauseId: 'PSM-1910.119(e)',
    hazopsRelevance: ['team_composition'],
  },
  {
    id: 'PSM-1910.119(e)(5)',
    title: 'PHA recommendations and resolution',
    description:
      'The employer shall establish a system to promptly address the team\'s findings and recommendations; ' +
      'assure that the recommendations are resolved in a timely manner and that the resolution is documented; ' +
      'document what actions are to be taken; complete actions as soon as possible; and communicate the actions ' +
      'to operating, maintenance, and other employees whose work assignments are in the process.',
    keywords: ['recommendations', 'resolution', 'action tracking', 'documentation', 'communication', 'timely manner'],
    mandatory: true,
    parentClauseId: 'PSM-1910.119(e)',
    hazopsRelevance: ['recommendations', 'follow_up', 'documentation'],
  },
  {
    id: 'PSM-1910.119(e)(6)',
    title: 'PHA update and revalidation',
    description:
      'At least every five (5) years after the initial process hazard analysis, the PHA shall be updated ' +
      'and revalidated by a team meeting the team requirements to assure that the PHA is consistent with ' +
      'the current process.',
    keywords: ['update', 'revalidation', 'five years', 'periodic review', 'current process'],
    mandatory: true,
    parentClauseId: 'PSM-1910.119(e)',
    hazopsRelevance: ['follow_up', 'methodology'],
  },
  {
    id: 'PSM-1910.119(e)(7)',
    title: 'PHA documentation retention',
    description:
      'Employers shall retain process hazard analyses and updates or revalidations for each process covered ' +
      'by this standard, as well as the documented resolution of recommendations, for the life of the process.',
    keywords: ['retention', 'documentation', 'life of process', 'records', 'resolution documentation'],
    mandatory: true,
    parentClauseId: 'PSM-1910.119(e)',
    hazopsRelevance: ['documentation'],
  },
  // Operating Procedures
  {
    id: 'PSM-1910.119(f)',
    title: 'Operating procedures',
    description:
      'The employer shall develop and implement written operating procedures that provide clear instructions ' +
      'for safely conducting activities involved in each covered process. The procedures shall address steps ' +
      'for each operating phase, operating limits, safety and health considerations, and safety systems.',
    keywords: ['operating procedures', 'SOPs', 'instructions', 'operating limits', 'safety systems'],
    mandatory: true,
    hazopsRelevance: ['safeguards', 'documentation'],
  },
  {
    id: 'PSM-1910.119(f)(1)',
    title: 'Operating procedures content',
    description:
      'Operating procedures shall include steps for initial startup, normal operations, temporary operations, ' +
      'emergency shutdown (including conditions requiring shutdown and assignment of shutdown responsibility), ' +
      'emergency operations, normal shutdown, and startup following turnaround or emergency shutdown.',
    keywords: ['startup', 'shutdown', 'emergency', 'normal operations', 'temporary operations', 'turnaround'],
    mandatory: true,
    parentClauseId: 'PSM-1910.119(f)',
    hazopsRelevance: ['safeguards', 'methodology'],
  },
  {
    id: 'PSM-1910.119(f)(2)',
    title: 'Operating limits',
    description:
      'Operating procedures shall include operating limits covering consequences of deviation, steps to correct ' +
      'or avoid deviation, and safety systems and their functions.',
    keywords: ['operating limits', 'deviation', 'consequences', 'correction', 'safety systems'],
    mandatory: true,
    parentClauseId: 'PSM-1910.119(f)',
    hazopsRelevance: ['hazard_identification', 'safeguards'],
  },
  {
    id: 'PSM-1910.119(f)(3)',
    title: 'Safety and health considerations',
    description:
      'Operating procedures shall address safety and health considerations including properties and hazards of ' +
      'chemicals, precautions to prevent exposure, control measures, quality control, and any special or unique hazards.',
    keywords: ['safety', 'health', 'chemical hazards', 'exposure', 'precautions', 'control measures'],
    mandatory: true,
    parentClauseId: 'PSM-1910.119(f)',
    hazopsRelevance: ['safeguards', 'hazard_identification'],
  },
  {
    id: 'PSM-1910.119(f)(4)',
    title: 'Operating procedures review',
    description:
      'The employer shall certify annually that the operating procedures are current and accurate. ' +
      'Operating procedures shall be readily accessible to employees who work in or maintain a process.',
    keywords: ['annual certification', 'current', 'accurate', 'accessible', 'review'],
    mandatory: true,
    parentClauseId: 'PSM-1910.119(f)',
    hazopsRelevance: ['follow_up', 'documentation'],
  },
  // Training
  {
    id: 'PSM-1910.119(g)',
    title: 'Training',
    description:
      'Initial training: Each employee presently involved in operating a process, and each new employee shall ' +
      'be trained in an overview of the process and in the operating procedures. The training shall include ' +
      'emphasis on specific safety and health hazards, emergency operations, and safe work practices.',
    keywords: ['training', 'initial training', 'operating procedures', 'safety hazards', 'emergency operations'],
    mandatory: true,
    hazopsRelevance: ['team_composition', 'safeguards'],
  },
  {
    id: 'PSM-1910.119(g)(1)',
    title: 'Refresher training',
    description:
      'Refresher training shall be provided at least every three years, and more often if necessary, to each ' +
      'employee involved in operating a process to assure that the employee understands and adheres to the ' +
      'current operating procedures of the process.',
    keywords: ['refresher training', 'three years', 'periodic', 'current procedures'],
    mandatory: true,
    parentClauseId: 'PSM-1910.119(g)',
    hazopsRelevance: ['follow_up', 'team_composition'],
  },
  {
    id: 'PSM-1910.119(g)(3)',
    title: 'Training documentation',
    description:
      'The employer shall prepare a record containing the identity of the employee, date of training, and ' +
      'means used to verify that the employee understood the training.',
    keywords: ['training records', 'documentation', 'verification', 'employee identity'],
    mandatory: true,
    parentClauseId: 'PSM-1910.119(g)',
    hazopsRelevance: ['documentation'],
  },
  // Contractors
  {
    id: 'PSM-1910.119(h)',
    title: 'Contractors',
    description:
      'Applies to contractors performing maintenance, repair, turnaround, major renovation, or specialty work ' +
      'on or adjacent to a covered process. The employer shall inform contract employers of known potential ' +
      'fire, explosion, or toxic release hazards and applicable provisions of the emergency action plan.',
    keywords: ['contractors', 'maintenance', 'repair', 'turnaround', 'hazard information', 'emergency plan'],
    mandatory: true,
    hazopsRelevance: ['team_composition', 'safeguards'],
  },
  {
    id: 'PSM-1910.119(h)(2)',
    title: 'Contract employer responsibilities',
    description:
      'Contract employers shall assure their employees are trained in work practices necessary to safely ' +
      'perform their jobs, instructed in known potential hazards, and follow safety rules of the facility.',
    keywords: ['contract employer', 'training', 'work practices', 'hazards', 'safety rules'],
    mandatory: true,
    parentClauseId: 'PSM-1910.119(h)',
    hazopsRelevance: ['team_composition'],
  },
  // Pre-Startup Safety Review (PSSR)
  {
    id: 'PSM-1910.119(i)',
    title: 'Pre-startup safety review',
    description:
      'The employer shall perform a pre-startup safety review for new facilities and for modified facilities ' +
      'when the modification is significant enough to require a change in the process safety information. ' +
      'The PSSR shall confirm that construction and equipment are in accordance with design specifications.',
    keywords: ['PSSR', 'pre-startup', 'safety review', 'new facilities', 'modifications', 'design specifications'],
    mandatory: true,
    hazopsRelevance: ['follow_up', 'safeguards'],
  },
  {
    id: 'PSM-1910.119(i)(2)',
    title: 'PSSR content requirements',
    description:
      'The pre-startup safety review shall confirm that: construction and equipment are in accordance with design ' +
      'specifications; safety, operating, maintenance, and emergency procedures are in place and adequate; ' +
      'a PHA has been performed for new facilities and recommendations resolved; and training is complete.',
    keywords: ['PSSR checklist', 'design verification', 'procedures in place', 'PHA complete', 'training complete'],
    mandatory: true,
    parentClauseId: 'PSM-1910.119(i)',
    hazopsRelevance: ['follow_up', 'methodology'],
  },
  // Mechanical Integrity
  {
    id: 'PSM-1910.119(j)',
    title: 'Mechanical integrity',
    description:
      'The employer shall establish and implement written procedures to maintain the ongoing integrity of ' +
      'process equipment. Equipment covered includes pressure vessels and storage tanks, piping systems, ' +
      'relief and vent systems, emergency shutdown systems, controls and pumps.',
    keywords: ['mechanical integrity', 'equipment', 'pressure vessels', 'piping', 'relief systems', 'controls'],
    mandatory: true,
    hazopsRelevance: ['safeguards', 'follow_up'],
  },
  {
    id: 'PSM-1910.119(j)(2)',
    title: 'Written procedures for mechanical integrity',
    description:
      'The employer shall establish and implement written procedures to maintain the ongoing integrity of ' +
      'process equipment covering training for process maintenance activities, inspection and testing ' +
      'procedures, and equipment deficiencies.',
    keywords: ['maintenance procedures', 'inspection', 'testing', 'deficiencies', 'written procedures'],
    mandatory: true,
    parentClauseId: 'PSM-1910.119(j)',
    hazopsRelevance: ['documentation', 'follow_up'],
  },
  {
    id: 'PSM-1910.119(j)(4)',
    title: 'Inspection and testing',
    description:
      'Inspections and tests shall be performed on process equipment using procedures that follow recognized ' +
      'and generally accepted good engineering practices. The frequency of inspections and tests shall be ' +
      'consistent with applicable manufacturers\' recommendations, good engineering practices, and prior ' +
      'operating experience.',
    keywords: ['inspection', 'testing', 'frequency', 'manufacturers recommendations', 'good engineering practices'],
    mandatory: true,
    parentClauseId: 'PSM-1910.119(j)',
    hazopsRelevance: ['safeguards', 'follow_up'],
  },
  {
    id: 'PSM-1910.119(j)(5)',
    title: 'Equipment deficiencies',
    description:
      'The employer shall correct deficiencies in equipment that are outside acceptable limits before further ' +
      'use, or in a safe and timely manner when necessary means are taken to assure safe operation.',
    keywords: ['deficiencies', 'correction', 'acceptable limits', 'safe operation', 'timely'],
    mandatory: true,
    parentClauseId: 'PSM-1910.119(j)',
    hazopsRelevance: ['safeguards', 'recommendations'],
  },
  {
    id: 'PSM-1910.119(j)(6)',
    title: 'Quality assurance for equipment',
    description:
      'In construction of new plants and equipment, the employer shall assure that equipment as fabricated ' +
      'is suitable for the process application. Appropriate checks and inspections shall be performed.',
    keywords: ['quality assurance', 'fabrication', 'suitability', 'new plants', 'equipment verification'],
    mandatory: true,
    parentClauseId: 'PSM-1910.119(j)',
    hazopsRelevance: ['safeguards'],
  },
  // Hot Work Permit
  {
    id: 'PSM-1910.119(k)',
    title: 'Hot work permit',
    description:
      'The employer shall issue a hot work permit for hot work operations conducted on or near a covered process. ' +
      'The permit shall document that fire prevention and protection requirements in 29 CFR 1910.252(a) have ' +
      'been implemented prior to beginning the hot work operations.',
    keywords: ['hot work', 'permit', 'fire prevention', 'welding', 'cutting', 'burning'],
    mandatory: true,
    hazopsRelevance: ['safeguards', 'hazard_identification'],
  },
  // Management of Change (MOC)
  {
    id: 'PSM-1910.119(l)',
    title: 'Management of change',
    description:
      'The employer shall establish and implement written procedures to manage changes (except replacement in kind) ' +
      'to process chemicals, technology, equipment, and procedures; and changes to facilities that affect a ' +
      'covered process.',
    keywords: ['MOC', 'management of change', 'change management', 'procedures', 'technology', 'equipment'],
    mandatory: true,
    hazopsRelevance: ['management_of_change'],
  },
  {
    id: 'PSM-1910.119(l)(2)',
    title: 'MOC procedures content',
    description:
      'Procedures shall assure that the following considerations are addressed prior to any change: the technical ' +
      'basis for the proposed change; impact of change on safety and health; modifications to operating procedures; ' +
      'necessary time period for the change; and authorization requirements for the proposed change.',
    keywords: ['technical basis', 'safety impact', 'health impact', 'operating procedures', 'authorization'],
    mandatory: true,
    parentClauseId: 'PSM-1910.119(l)',
    hazopsRelevance: ['management_of_change', 'risk_assessment'],
  },
  {
    id: 'PSM-1910.119(l)(3)',
    title: 'MOC training and communication',
    description:
      'Employees involved in operating a process and maintenance and contract employees whose job tasks will be ' +
      'affected by a change in the process shall be informed of, and trained in, the change prior to startup ' +
      'of the process or affected part of the process.',
    keywords: ['training', 'communication', 'affected employees', 'change notification', 'startup'],
    mandatory: true,
    parentClauseId: 'PSM-1910.119(l)',
    hazopsRelevance: ['management_of_change', 'team_composition'],
  },
  {
    id: 'PSM-1910.119(l)(4)',
    title: 'MOC documentation updates',
    description:
      'If a change covered by this paragraph results in a change in process safety information, operating procedures, ' +
      'or practices, such information shall be updated accordingly.',
    keywords: ['documentation update', 'PSI update', 'procedures update', 'change impact'],
    mandatory: true,
    parentClauseId: 'PSM-1910.119(l)',
    hazopsRelevance: ['management_of_change', 'documentation'],
  },
  // Incident Investigation
  {
    id: 'PSM-1910.119(m)',
    title: 'Incident investigation',
    description:
      'The employer shall investigate each incident which resulted in, or could reasonably have resulted in, ' +
      'a catastrophic release of highly hazardous chemical in the workplace. An incident investigation shall ' +
      'be initiated as promptly as possible, but not later than 48 hours following the incident.',
    keywords: ['incident investigation', 'catastrophic release', '48 hours', 'near miss', 'investigation'],
    mandatory: true,
    hazopsRelevance: ['follow_up', 'hazard_identification'],
  },
  {
    id: 'PSM-1910.119(m)(3)',
    title: 'Incident investigation team',
    description:
      'An incident investigation team shall be established and consist of at least one person knowledgeable ' +
      'in the process involved, including a contract employee if the incident involved work of the contractor, ' +
      'and other persons with appropriate knowledge and experience to thoroughly investigate and analyze the incident.',
    keywords: ['investigation team', 'process knowledge', 'contractor involvement', 'expertise'],
    mandatory: true,
    parentClauseId: 'PSM-1910.119(m)',
    hazopsRelevance: ['team_composition'],
  },
  {
    id: 'PSM-1910.119(m)(4)',
    title: 'Incident investigation report',
    description:
      'A report shall be prepared at the conclusion of the investigation including: date of incident, date ' +
      'investigation began, description of incident, factors that contributed to the incident, and any ' +
      'recommendations resulting from the investigation.',
    keywords: ['incident report', 'contributing factors', 'recommendations', 'investigation report'],
    mandatory: true,
    parentClauseId: 'PSM-1910.119(m)',
    hazopsRelevance: ['documentation', 'recommendations'],
  },
  {
    id: 'PSM-1910.119(m)(6)',
    title: 'Incident investigation follow-up',
    description:
      'The employer shall establish a system to promptly address and resolve the incident report findings and ' +
      'recommendations. Resolutions and corrective actions shall be documented.',
    keywords: ['follow-up', 'resolution', 'corrective actions', 'recommendations tracking'],
    mandatory: true,
    parentClauseId: 'PSM-1910.119(m)',
    hazopsRelevance: ['follow_up', 'recommendations'],
  },
  {
    id: 'PSM-1910.119(m)(7)',
    title: 'Incident investigation retention',
    description:
      'The report shall be reviewed with all affected personnel whose job tasks are relevant to the incident ' +
      'findings. Incident investigation reports shall be retained for five years.',
    keywords: ['retention', 'five years', 'review', 'affected personnel'],
    mandatory: true,
    parentClauseId: 'PSM-1910.119(m)',
    hazopsRelevance: ['documentation', 'follow_up'],
  },
  // Emergency Planning and Response
  {
    id: 'PSM-1910.119(n)',
    title: 'Emergency planning and response',
    description:
      'The employer shall establish and implement an emergency action plan for the entire plant in accordance ' +
      'with the provisions of 29 CFR 1910.38. The plan shall include procedures for handling small releases ' +
      'and must address emergency medical treatment.',
    keywords: ['emergency plan', 'emergency response', 'small releases', 'medical treatment', 'action plan'],
    mandatory: true,
    hazopsRelevance: ['safeguards', 'recommendations'],
  },
  // Compliance Audits
  {
    id: 'PSM-1910.119(o)',
    title: 'Compliance audits',
    description:
      'Employers shall certify that they have evaluated compliance with the provisions of this section at least ' +
      'every three years to verify that the procedures and practices developed under this standard are adequate ' +
      'and are being followed.',
    keywords: ['compliance audit', 'three years', 'certification', 'verification', 'evaluation'],
    mandatory: true,
    hazopsRelevance: ['follow_up', 'methodology'],
  },
  {
    id: 'PSM-1910.119(o)(2)',
    title: 'Compliance audit team',
    description:
      'The compliance audit shall be conducted by at least one person knowledgeable in the process.',
    keywords: ['audit team', 'process knowledge', 'auditor qualifications'],
    mandatory: true,
    parentClauseId: 'PSM-1910.119(o)',
    hazopsRelevance: ['team_composition'],
  },
  {
    id: 'PSM-1910.119(o)(3)',
    title: 'Compliance audit report and follow-up',
    description:
      'A report of the findings of the audit shall be developed. The employer shall promptly determine and ' +
      'document an appropriate response to each finding, and document deficiencies that have been corrected.',
    keywords: ['audit report', 'findings', 'response', 'deficiency correction', 'documentation'],
    mandatory: true,
    parentClauseId: 'PSM-1910.119(o)',
    hazopsRelevance: ['documentation', 'follow_up'],
  },
  {
    id: 'PSM-1910.119(o)(4)',
    title: 'Compliance audit retention',
    description:
      'The employer shall retain the two most recent compliance audit reports.',
    keywords: ['audit retention', 'two most recent', 'records'],
    mandatory: true,
    parentClauseId: 'PSM-1910.119(o)',
    hazopsRelevance: ['documentation'],
  },
  // Trade Secrets
  {
    id: 'PSM-1910.119(p)',
    title: 'Trade secrets',
    description:
      'Employers shall make all information necessary to comply with this section available to persons responsible ' +
      'for compiling PSI, developing the PHA, developing operating procedures, conducting incident investigations, ' +
      'emergency planning, and compliance audits without regard to possible trade secret status of such information.',
    keywords: ['trade secrets', 'information access', 'confidentiality', 'disclosure'],
    mandatory: true,
    hazopsRelevance: ['documentation', 'methodology'],
  },
  // HazOps-specific Guidance
  {
    id: 'PSM-HazOps-1',
    title: 'OSHA PSM HazOps requirements summary',
    description:
      'When conducting HazOps under OSHA PSM: use an appropriate methodology (HAZOP explicitly listed), include ' +
      'team members with process-specific knowledge and methodology expertise, address hazards, previous incidents, ' +
      'engineering/administrative controls, consequences of control failure, facility siting, and human factors.',
    keywords: ['HazOps', 'HAZOP', 'PSM requirements', 'team composition', 'methodology', 'content requirements'],
    mandatory: false,
    hazopsRelevance: ['hazard_identification', 'methodology', 'team_composition'],
  },
  {
    id: 'PSM-HazOps-2',
    title: 'PSM safeguards documentation',
    description:
      'Typical safeguards identified during PSM HazOps include: safety instrumented systems (SIS), basic process ' +
      'control systems (BPCS), relief devices, mechanical interlocks, administrative controls, operating procedures, ' +
      'emergency shutdown systems, alarms, and human intervention.',
    keywords: ['safeguards', 'SIS', 'BPCS', 'relief', 'interlocks', 'ESD', 'alarms'],
    mandatory: false,
    hazopsRelevance: ['safeguards', 'recommendations'],
  },
  {
    id: 'PSM-HazOps-3',
    title: 'PSM deviation scenarios',
    description:
      'Common deviation scenarios to consider in PSM HazOps: loss of containment, runaway reactions, overpressure, ' +
      'underpressure/vacuum, high/low temperature, high/low flow, reverse flow, composition upset, utility failures, ' +
      'and loss of cooling or heating.',
    keywords: ['deviation', 'loss of containment', 'runaway reaction', 'overpressure', 'flow upset', 'utility failure'],
    mandatory: false,
    hazopsRelevance: ['hazard_identification', 'risk_assessment'],
  },
];

/**
 * OSHA PSM standard definition.
 */
const OSHA_PSM: RegulatoryStandard = {
  id: 'OSHA_PSM',
  name: 'OSHA PSM',
  title: 'Process Safety Management of Highly Hazardous Chemicals (29 CFR 1910.119)',
  description:
    'US federal OSHA standard for preventing or minimizing consequences of catastrophic releases ' +
    'of highly hazardous chemicals. Applies to processes involving chemicals at or above threshold ' +
    'quantities listed in Appendix A, or flammable liquids/gases in quantities of 10,000 pounds or more. ' +
    'Requires comprehensive process safety management including Process Hazard Analysis (PHA) using ' +
    'methods such as HAZOP, management of change, mechanical integrity, and incident investigation.',
  category: 'process_safety',
  jurisdiction: 'united_states',
  version: '1992 (amended)',
  year: 1992,
  issuingBody: 'Occupational Safety and Health Administration (OSHA)',
  url: 'https://www.osha.gov/laws-regs/regulations/standardnumber/1910/1910.119',
  mandatory: true,
  relatedStandards: ['IEC_61511', 'EPA_RMP', 'ISO_31000'],
  relevantClauses: OSHA_PSM_CLAUSES,
};

// ============================================================================
// EPA RMP - Risk Management Program (40 CFR Part 68)
// ============================================================================

/**
 * EPA RMP clauses relevant to HazOps analysis.
 * EPA Risk Management Program (40 CFR Part 68) - Chemical Accident Prevention Provisions
 *
 * Task: COMP-05
 */
const EPA_RMP_CLAUSES: RegulatoryClause[] = [
  // Subpart A - General
  {
    id: 'RMP-68.3',
    title: 'Definitions',
    description:
      'Key definitions for the RMP rule including covered process, regulated substance, threshold quantity, ' +
      'stationary source, and worst-case release scenario. Understanding these definitions is critical for ' +
      'determining applicability and conducting proper hazard assessments.',
    keywords: ['definitions', 'covered process', 'regulated substance', 'threshold quantity', 'stationary source'],
    mandatory: true,
    hazopsRelevance: ['methodology'],
  },
  {
    id: 'RMP-68.10',
    title: 'Applicability',
    description:
      'A stationary source that has more than a threshold quantity of a regulated substance in a process ' +
      'shall comply with this part. Covers both toxic and flammable substances listed in 40 CFR 68.130.',
    keywords: ['applicability', 'threshold quantity', 'toxic substances', 'flammable substances', 'covered source'],
    mandatory: true,
    hazopsRelevance: ['methodology'],
  },
  {
    id: 'RMP-68.12',
    title: 'General requirements',
    description:
      'The owner or operator shall submit a single RMP, ensure compliance with all applicable requirements, ' +
      'register, and implement the prevention program. Program level (1, 2, or 3) is determined by ' +
      'process characteristics and accident history.',
    keywords: ['general requirements', 'RMP submission', 'program level', 'registration', 'prevention program'],
    mandatory: true,
    hazopsRelevance: ['documentation', 'methodology'],
  },
  // Subpart B - Hazard Assessment
  {
    id: 'RMP-68.20',
    title: 'Applicability of hazard assessment',
    description:
      'The owner or operator shall prepare a worst-case release scenario analysis and shall document ' +
      'five-year accident history. Programs 2 and 3 also require alternative release scenario analysis.',
    keywords: ['hazard assessment', 'worst-case scenario', 'five-year history', 'alternative scenarios'],
    mandatory: true,
    hazopsRelevance: ['hazard_identification', 'risk_assessment'],
  },
  {
    id: 'RMP-68.22',
    title: 'Offsite consequence analysis parameters',
    description:
      'Defines parameters for conducting offsite consequence analysis including reference tables, ' +
      'EPA guidance, and modeling requirements. Analysis must consider endpoints for toxic and ' +
      'flammable substances and distances to public receptors.',
    keywords: ['offsite analysis', 'consequence analysis', 'endpoints', 'toxic concentration', 'overpressure'],
    mandatory: true,
    hazopsRelevance: ['risk_assessment', 'methodology'],
  },
  {
    id: 'RMP-68.25',
    title: 'Worst-case release scenario analysis',
    description:
      'Analysis of release of the largest quantity of regulated substance from a vessel or process line ' +
      'failure that results in the greatest distance to an endpoint. Must consider administrative controls ' +
      'and passive mitigation, but not active mitigation.',
    keywords: ['worst-case', 'largest quantity', 'endpoint distance', 'passive mitigation', 'vessel failure'],
    mandatory: true,
    hazopsRelevance: ['hazard_identification', 'risk_assessment'],
  },
  {
    id: 'RMP-68.28',
    title: 'Alternative release scenario analysis',
    description:
      'For Programs 2 and 3, analysis of more likely release scenarios considering transfer hose failures, ' +
      'process vessel failures, piping failures, and overfilling. Must identify populations potentially ' +
      'affected and environmental receptors.',
    keywords: ['alternative scenario', 'likely release', 'transfer hose', 'piping failure', 'environmental receptors'],
    mandatory: true,
    hazopsRelevance: ['hazard_identification', 'risk_assessment'],
  },
  {
    id: 'RMP-68.30',
    title: 'Defining offsite impacts - Loss of control',
    description:
      'Analysis shall consider loss of administrative controls as well as equipment failures that could ' +
      'result in release of regulated substances. Impact zones must be mapped.',
    keywords: ['offsite impact', 'loss of control', 'equipment failure', 'impact zones', 'mapping'],
    mandatory: true,
    hazopsRelevance: ['hazard_identification', 'risk_assessment'],
  },
  {
    id: 'RMP-68.33',
    title: 'Five-year accident history',
    description:
      'Document all accidental releases from covered processes that resulted in deaths, injuries, ' +
      'significant property damage, evacuations, sheltering in place, or environmental damage. ' +
      'Must include date, quantity released, duration, weather conditions, onsite and offsite impacts.',
    keywords: ['accident history', 'five-year', 'accidental releases', 'injuries', 'evacuations', 'environmental damage'],
    mandatory: true,
    hazopsRelevance: ['hazard_identification', 'documentation'],
  },
  {
    id: 'RMP-68.36',
    title: 'Review and update of hazard assessment',
    description:
      'The owner or operator shall review and update the hazard assessment at least once every five years. ' +
      'Offsite consequence analysis must be updated when a new worst-case scenario is identified or ' +
      'significant changes occur to the process.',
    keywords: ['review', 'update', 'five years', 'revalidation', 'process changes'],
    mandatory: true,
    hazopsRelevance: ['follow_up', 'methodology'],
  },
  // Subpart C - Program 2 Prevention Program
  {
    id: 'RMP-68.48',
    title: 'Safety information (Program 2)',
    description:
      'For Program 2 processes, the owner or operator shall compile and maintain safety information ' +
      'including material safety data sheets, maximum intended inventory, safe upper and lower limits ' +
      'for process parameters, and equipment specifications.',
    keywords: ['safety information', 'MSDS', 'inventory', 'process limits', 'equipment specs', 'Program 2'],
    mandatory: true,
    hazopsRelevance: ['documentation', 'hazard_identification'],
  },
  {
    id: 'RMP-68.50',
    title: 'Hazard review (Program 2)',
    description:
      'Conduct a review of hazards associated with the regulated substances, process, and procedures. ' +
      'The review shall identify hazards, previous incidents, engineering and administrative controls, ' +
      'and consequences of failure of controls. Appropriate checklist or similar methodology required.',
    keywords: ['hazard review', 'Program 2', 'checklist', 'hazard identification', 'control failure', 'previous incidents'],
    mandatory: true,
    hazopsRelevance: ['hazard_identification', 'risk_assessment', 'methodology'],
  },
  {
    id: 'RMP-68.52',
    title: 'Operating procedures (Program 2)',
    description:
      'Prepare written operating procedures that provide clear instructions for safely conducting ' +
      'activities. Procedures must include steps for startup, normal operations, temporary operations, ' +
      'emergency shutdown, and normal shutdown.',
    keywords: ['operating procedures', 'written procedures', 'startup', 'shutdown', 'emergency operations'],
    mandatory: true,
    hazopsRelevance: ['documentation', 'safeguards'],
  },
  {
    id: 'RMP-68.54',
    title: 'Training (Program 2)',
    description:
      'Train all employees involved in operating a process in overview of the process and operating ' +
      'procedures. Refresher training at least every three years. Documentation of training required.',
    keywords: ['training', 'Program 2', 'refresher training', 'three years', 'operating procedures'],
    mandatory: true,
    hazopsRelevance: ['team_composition', 'documentation'],
  },
  {
    id: 'RMP-68.56',
    title: 'Maintenance (Program 2)',
    description:
      'Prepare and implement procedures to maintain the ongoing mechanical integrity of the process ' +
      'equipment. Maintain equipment in accordance with industry standards and manufacturer guidance.',
    keywords: ['maintenance', 'mechanical integrity', 'Program 2', 'equipment maintenance', 'industry standards'],
    mandatory: true,
    hazopsRelevance: ['safeguards', 'follow_up'],
  },
  {
    id: 'RMP-68.58',
    title: 'Compliance audits (Program 2)',
    description:
      'Certify that at least every three years a compliance audit has been conducted to verify ' +
      'procedures and practices are adequate and being followed. Develop a report and address findings.',
    keywords: ['compliance audit', 'three years', 'Program 2', 'certification', 'verification'],
    mandatory: true,
    hazopsRelevance: ['follow_up', 'methodology'],
  },
  {
    id: 'RMP-68.60',
    title: 'Incident investigation (Program 2)',
    description:
      'Investigate each incident that resulted in, or could reasonably have resulted in, a catastrophic ' +
      'release within 48 hours. Document findings and implement recommendations.',
    keywords: ['incident investigation', 'Program 2', '48 hours', 'catastrophic release', 'recommendations'],
    mandatory: true,
    hazopsRelevance: ['follow_up', 'hazard_identification'],
  },
  // Subpart D - Program 3 Prevention Program
  {
    id: 'RMP-68.65',
    title: 'Process safety information (Program 3)',
    description:
      'Compile written process safety information before conducting a PHA. Information shall include ' +
      'hazards of the substances, process technology, and equipment. Pertinent MSDS information required.',
    keywords: ['process safety information', 'PSI', 'Program 3', 'MSDS', 'technology', 'equipment information'],
    mandatory: true,
    hazopsRelevance: ['documentation', 'hazard_identification'],
  },
  {
    id: 'RMP-68.67',
    title: 'Process hazard analysis (Program 3)',
    description:
      'Perform an initial PHA on all covered processes using an appropriate methodology such as What-If, ' +
      'Checklist, What-If/Checklist, HAZOP, FMEA, Fault Tree, or equivalent. The PHA team must include ' +
      'expertise in engineering, process operations, and the PHA methodology being used.',
    keywords: ['PHA', 'process hazard analysis', 'HAZOP', 'FMEA', 'fault tree', 'What-If', 'team expertise'],
    mandatory: true,
    hazopsRelevance: ['hazard_identification', 'methodology', 'team_composition'],
  },
  {
    id: 'RMP-68.67(c)',
    title: 'PHA scope and content',
    description:
      'The PHA shall address hazards of the process, previous incidents with catastrophic potential, ' +
      'engineering and administrative controls and their interrelationships, consequences of control ' +
      'failure, facility siting, human factors, and qualitative evaluation of safeguards.',
    keywords: ['PHA scope', 'hazards', 'incidents', 'controls', 'siting', 'human factors', 'safeguards evaluation'],
    mandatory: true,
    parentClauseId: 'RMP-68.67',
    hazopsRelevance: ['hazard_identification', 'risk_assessment', 'safeguards'],
  },
  {
    id: 'RMP-68.67(d)',
    title: 'PHA recommendations and follow-up',
    description:
      'The PHA shall address findings and recommendations. The owner shall establish a system to ' +
      'promptly address findings, document actions taken, and resolve recommendations in a timely manner.',
    keywords: ['PHA recommendations', 'findings', 'resolution', 'corrective actions', 'timely'],
    mandatory: true,
    parentClauseId: 'RMP-68.67',
    hazopsRelevance: ['recommendations', 'follow_up'],
  },
  {
    id: 'RMP-68.67(e)',
    title: 'PHA update and revalidation',
    description:
      'The PHA shall be updated and revalidated at least every five years. Each PHA update shall ' +
      'address all recommendations from the previous PHA that have not been resolved.',
    keywords: ['PHA update', 'revalidation', 'five years', 'previous recommendations', 'resolution tracking'],
    mandatory: true,
    parentClauseId: 'RMP-68.67',
    hazopsRelevance: ['follow_up', 'methodology'],
  },
  {
    id: 'RMP-68.67(f)',
    title: 'PHA retention',
    description:
      'The owner or operator shall retain PHAs and updates for each process for the life of the process.',
    keywords: ['retention', 'life of process', 'PHA records', 'documentation'],
    mandatory: true,
    parentClauseId: 'RMP-68.67',
    hazopsRelevance: ['documentation'],
  },
  {
    id: 'RMP-68.69',
    title: 'Operating procedures (Program 3)',
    description:
      'Develop and implement written operating procedures that provide clear instructions for safely ' +
      'conducting activities. Procedures shall address operating limits, safety and health considerations, ' +
      'safety systems, and emergency operations including shutdown.',
    keywords: ['operating procedures', 'Program 3', 'operating limits', 'safety systems', 'emergency shutdown'],
    mandatory: true,
    hazopsRelevance: ['documentation', 'safeguards'],
  },
  {
    id: 'RMP-68.71',
    title: 'Training (Program 3)',
    description:
      'Train each employee presently involved in operating a process and each employee before being ' +
      'involved in a newly assigned process. Training must include overview of the process, operating ' +
      'procedures, safety procedures, and emergency procedures. Refresher training at least every three years.',
    keywords: ['training', 'Program 3', 'employee training', 'safety procedures', 'refresher', 'three years'],
    mandatory: true,
    hazopsRelevance: ['team_composition', 'documentation'],
  },
  {
    id: 'RMP-68.73',
    title: 'Mechanical integrity (Program 3)',
    description:
      'Establish and implement written procedures to maintain ongoing integrity of process equipment ' +
      'including pressure vessels, storage tanks, piping systems, relief and vent systems, emergency ' +
      'shutdown systems, controls, and pumps. Inspections and tests per recognized and generally ' +
      'accepted good engineering practices.',
    keywords: ['mechanical integrity', 'Program 3', 'pressure vessels', 'piping', 'relief systems', 'inspections'],
    mandatory: true,
    hazopsRelevance: ['safeguards', 'follow_up'],
  },
  {
    id: 'RMP-68.75',
    title: 'Management of change (Program 3)',
    description:
      'Establish and implement written procedures to manage changes to process chemicals, technology, ' +
      'equipment, and procedures. Changes must be reviewed for impact on safety and health and ' +
      'documented before implementation.',
    keywords: ['management of change', 'MOC', 'Program 3', 'change procedures', 'safety impact'],
    mandatory: true,
    hazopsRelevance: ['management_of_change'],
  },
  {
    id: 'RMP-68.75(c)',
    title: 'MOC procedure requirements',
    description:
      'MOC procedures shall assure: technical basis for the proposed change, impact on safety and health, ' +
      'modifications to operating procedures, necessary time period, and authorization requirements.',
    keywords: ['MOC requirements', 'technical basis', 'safety impact', 'authorization', 'procedure modifications'],
    mandatory: true,
    parentClauseId: 'RMP-68.75',
    hazopsRelevance: ['management_of_change', 'risk_assessment'],
  },
  {
    id: 'RMP-68.77',
    title: 'Pre-startup review (Program 3)',
    description:
      'Perform a pre-startup safety review for new and significantly modified stationary sources. Review ' +
      'shall confirm construction and equipment are in accordance with design specifications, safety, ' +
      'operating, maintenance, and emergency procedures are in place, and a PHA has been performed.',
    keywords: ['pre-startup review', 'PSSR', 'Program 3', 'new facilities', 'modified facilities', 'design specifications'],
    mandatory: true,
    hazopsRelevance: ['follow_up', 'methodology'],
  },
  {
    id: 'RMP-68.79',
    title: 'Compliance audits (Program 3)',
    description:
      'Certify at least every three years that a compliance audit has been conducted to verify ' +
      'procedures and practices are adequate and being followed. Audit by at least one person ' +
      'knowledgeable in the process. Respond to findings and document deficiency corrections.',
    keywords: ['compliance audit', 'Program 3', 'three years', 'audit team', 'findings', 'corrective actions'],
    mandatory: true,
    hazopsRelevance: ['follow_up', 'methodology'],
  },
  {
    id: 'RMP-68.81',
    title: 'Incident investigation (Program 3)',
    description:
      'Investigate each incident that resulted in, or could reasonably have resulted in, a catastrophic ' +
      'release. Investigation must begin within 48 hours, include investigation team, document findings, ' +
      'and address recommendations. Retain reports for five years.',
    keywords: ['incident investigation', 'Program 3', '48 hours', 'investigation team', 'findings', 'five years'],
    mandatory: true,
    hazopsRelevance: ['follow_up', 'hazard_identification'],
  },
  {
    id: 'RMP-68.83',
    title: 'Employee participation (Program 3)',
    description:
      'Develop a written plan of action for employee participation. Employees must be consulted on ' +
      'conduct and development of PHAs and development of other elements. Access to hazard information ' +
      'and trade secret provisions.',
    keywords: ['employee participation', 'Program 3', 'consultation', 'PHA involvement', 'access to information'],
    mandatory: true,
    hazopsRelevance: ['team_composition', 'methodology'],
  },
  {
    id: 'RMP-68.85',
    title: 'Hot work permit (Program 3)',
    description:
      'Issue a permit for hot work operations conducted on or near a covered process. Permit shall ' +
      'document that fire prevention and protection requirements have been implemented.',
    keywords: ['hot work', 'permit', 'Program 3', 'fire prevention', 'welding', 'cutting'],
    mandatory: true,
    hazopsRelevance: ['safeguards', 'hazard_identification'],
  },
  {
    id: 'RMP-68.87',
    title: 'Contractors (Program 3)',
    description:
      'Develop and implement procedures for contract employees performing maintenance, repair, turnaround, ' +
      'or specialty work on or adjacent to covered processes. Ensure contractor safety performance ' +
      'and provide hazard information.',
    keywords: ['contractors', 'Program 3', 'contract employees', 'maintenance', 'safety performance'],
    mandatory: true,
    hazopsRelevance: ['team_composition', 'documentation'],
  },
  // Subpart E - Emergency Response
  {
    id: 'RMP-68.90',
    title: 'Applicability of emergency response',
    description:
      'The owner or operator shall comply with emergency response requirements if employees will respond ' +
      'to releases. Alternatively, may elect to be a non-responding stationary source if properly coordinated ' +
      'with local emergency responders.',
    keywords: ['emergency response', 'applicability', 'responding source', 'non-responding', 'local responders'],
    mandatory: true,
    hazopsRelevance: ['safeguards', 'methodology'],
  },
  {
    id: 'RMP-68.93',
    title: 'Emergency response program (responding sources)',
    description:
      'Develop and implement an emergency response program including emergency action plan, procedures for ' +
      'informing the public and emergency responders, documentation of first aid and emergency medical treatment, ' +
      'and procedures for emergency equipment use and inspection.',
    keywords: ['emergency response program', 'emergency action plan', 'public notification', 'first aid', 'emergency equipment'],
    mandatory: true,
    hazopsRelevance: ['safeguards', 'recommendations'],
  },
  {
    id: 'RMP-68.95',
    title: 'Emergency response exercises',
    description:
      'Conduct exercises to evaluate the emergency response program. Notification exercises annually, ' +
      'tabletop exercises annually, and field exercises at least once every ten years (or coordination ' +
      'with local authorities).',
    keywords: ['emergency exercises', 'drills', 'tabletop', 'field exercises', 'notification exercises'],
    mandatory: true,
    hazopsRelevance: ['follow_up', 'safeguards'],
  },
  {
    id: 'RMP-68.96',
    title: 'Emergency response program (non-responding sources)',
    description:
      'For stationary sources that will not respond to releases, establish response actions for employees, ' +
      'procedures for informing public and responders, and coordination with local emergency planning ' +
      'committee (LEPC).',
    keywords: ['non-responding', 'LEPC coordination', 'public notification', 'local response'],
    mandatory: true,
    hazopsRelevance: ['safeguards', 'documentation'],
  },
  // Subpart G - Risk Management Plan
  {
    id: 'RMP-68.150',
    title: 'Submission',
    description:
      'Submit a single RMP for the stationary source to a central point specified by EPA. Initial submission ' +
      'and updates required. RMP must be submitted in the method specified by EPA.',
    keywords: ['RMP submission', 'EPA reporting', 'central point', 'registration'],
    mandatory: true,
    hazopsRelevance: ['documentation'],
  },
  {
    id: 'RMP-68.155',
    title: 'Executive summary',
    description:
      'The RMP shall include an executive summary that provides a brief description of the accidental release ' +
      'prevention and emergency response policies, stationary source description, regulated substances, ' +
      'worst-case scenario summary, five-year accident history, and emergency response program summary.',
    keywords: ['executive summary', 'RMP contents', 'prevention policy', 'source description', 'accident history'],
    mandatory: true,
    hazopsRelevance: ['documentation'],
  },
  {
    id: 'RMP-68.160',
    title: 'Registration',
    description:
      'Complete registration including facility identification, regulatory applicability, owner/operator ' +
      'information, emergency contact, and NAICS codes for covered processes.',
    keywords: ['registration', 'facility ID', 'NAICS codes', 'emergency contact', 'regulatory applicability'],
    mandatory: true,
    hazopsRelevance: ['documentation'],
  },
  {
    id: 'RMP-68.165',
    title: 'Offsite consequence analysis',
    description:
      'The RMP shall include the results of offsite consequence analysis for all covered processes, ' +
      'including worst-case scenarios and alternative release scenarios as applicable by program level.',
    keywords: ['offsite consequence', 'RMP contents', 'worst-case', 'alternative scenarios'],
    mandatory: true,
    hazopsRelevance: ['documentation', 'risk_assessment'],
  },
  {
    id: 'RMP-68.168',
    title: 'Five-year accident history submission',
    description:
      'The RMP shall include the five-year accident history for each covered process including all ' +
      'required details about releases, impacts, and response actions.',
    keywords: ['accident history', 'RMP contents', 'release details', 'impacts'],
    mandatory: true,
    hazopsRelevance: ['documentation', 'hazard_identification'],
  },
  {
    id: 'RMP-68.170',
    title: 'Prevention program submission',
    description:
      'The RMP shall include a description of the prevention program including NAICS code, SIC code, ' +
      'chemical information, process description, and dates of most recent PHA/hazard review, compliance ' +
      'audit, and incident investigation.',
    keywords: ['prevention program', 'RMP contents', 'PHA dates', 'audit dates', 'process description'],
    mandatory: true,
    hazopsRelevance: ['documentation', 'methodology'],
  },
  {
    id: 'RMP-68.175',
    title: 'Emergency response program submission',
    description:
      'The RMP shall include information about the emergency response program including whether facility ' +
      'is a responding or non-responding source, LEPC coordination, and exercise dates.',
    keywords: ['emergency program', 'RMP contents', 'LEPC', 'exercise dates', 'response coordination'],
    mandatory: true,
    hazopsRelevance: ['documentation', 'safeguards'],
  },
  {
    id: 'RMP-68.180',
    title: 'Certification',
    description:
      'The RMP shall include a certification by the owner or operator that the information provided is ' +
      'accurate, the facility has complied with all requirements, and actions have been taken consistent ' +
      'with the risk management program.',
    keywords: ['certification', 'owner certification', 'compliance', 'accuracy'],
    mandatory: true,
    hazopsRelevance: ['documentation'],
  },
  {
    id: 'RMP-68.190',
    title: 'Updates',
    description:
      'Update the RMP within five years of initial submission and no later than the date on which a new ' +
      'regulated substance is first in a covered process. Update required when significant changes occur, ' +
      'and corrections required within one month of discovery of errors.',
    keywords: ['RMP update', 'five years', 'new substances', 'significant changes', 'corrections'],
    mandatory: true,
    hazopsRelevance: ['documentation', 'follow_up'],
  },
  // HazOps-specific guidance for EPA RMP
  {
    id: 'RMP-HazOps-1',
    title: 'EPA RMP HazOps requirements summary',
    description:
      'When conducting HazOps for EPA RMP compliance: For Program 3 processes, a full PHA using HAZOP or ' +
      'equivalent methodology is required. Team must include expertise in process operations, engineering, ' +
      'and PHA methodology. Must address offsite consequences and environmental receptors.',
    keywords: ['HazOps', 'HAZOP', 'EPA requirements', 'PHA', 'team composition', 'offsite consequences'],
    mandatory: false,
    hazopsRelevance: ['hazard_identification', 'methodology', 'team_composition'],
  },
  {
    id: 'RMP-HazOps-2',
    title: 'EPA RMP offsite impact considerations',
    description:
      'HazOps for EPA RMP must consider impacts beyond facility boundaries including: populations in ' +
      'residential areas, schools, hospitals, commercial/industrial areas, public assembly areas, ' +
      'and environmental receptors (parks, wildlife areas, waterways).',
    keywords: ['offsite impact', 'public receptors', 'environmental receptors', 'populations', 'community impact'],
    mandatory: false,
    hazopsRelevance: ['hazard_identification', 'risk_assessment'],
  },
  {
    id: 'RMP-HazOps-3',
    title: 'EPA RMP safeguards documentation',
    description:
      'Typical safeguards for EPA RMP HazOps include: containment systems (dikes, drainage), detection ' +
      'systems (monitors, alarms), mitigation systems (scrubbers, flares, sprays), administrative ' +
      'controls, and emergency response equipment.',
    keywords: ['safeguards', 'containment', 'detection', 'mitigation', 'scrubbers', 'flares', 'emergency equipment'],
    mandatory: false,
    hazopsRelevance: ['safeguards', 'recommendations'],
  },
  {
    id: 'RMP-HazOps-4',
    title: 'EPA RMP worst-case and alternative scenarios',
    description:
      'HazOps deviations should inform both worst-case and alternative release scenario analyses. ' +
      'Worst-case: total release of largest vessel contents. Alternative: more likely scenarios ' +
      'such as hose failures, pump seal failures, operator errors, equipment failures.',
    keywords: ['worst-case', 'alternative scenario', 'hose failure', 'seal failure', 'operator error', 'scenario analysis'],
    mandatory: false,
    hazopsRelevance: ['hazard_identification', 'risk_assessment'],
  },
  {
    id: 'RMP-HazOps-5',
    title: 'EPA RMP integration with OSHA PSM',
    description:
      'Many facilities subject to EPA RMP are also subject to OSHA PSM. HazOps can satisfy PHA ' +
      'requirements of both regulations when properly documented. Ensure both PSI and offsite ' +
      'consequence requirements are addressed.',
    keywords: ['PSM integration', 'dual compliance', 'OSHA', 'EPA', 'regulatory overlap'],
    mandatory: false,
    hazopsRelevance: ['methodology', 'documentation'],
  },
];

/**
 * EPA RMP standard definition.
 */
const EPA_RMP: RegulatoryStandard = {
  id: 'EPA_RMP',
  name: 'EPA RMP',
  title: 'Chemical Accident Prevention Provisions (40 CFR Part 68)',
  description:
    'US federal EPA regulation requiring facilities using extremely hazardous substances at or above ' +
    'threshold quantities to develop and implement Risk Management Programs. Applies to processes ' +
    'containing substances listed in 40 CFR 68.130 including toxic and flammable substances. ' +
    'Program levels (1, 2, or 3) based on process complexity, accident history, and proximity to ' +
    'public receptors. Requires hazard assessment, prevention programs, and emergency response.',
  category: 'environmental',
  jurisdiction: 'united_states',
  version: 'Amendments through 2024',
  year: 1996,
  issuingBody: 'Environmental Protection Agency (EPA)',
  url: 'https://www.ecfr.gov/current/title-40/chapter-I/subchapter-C/part-68',
  mandatory: true,
  relatedStandards: ['OSHA_PSM', 'IEC_61511', 'ISO_31000'],
  relevantClauses: EPA_RMP_CLAUSES,
};

// ============================================================================
// Standards Database
// ============================================================================

/**
 * Complete database of all regulatory standards.
 */
const REGULATORY_STANDARDS_DATABASE: Map<RegulatoryStandardId, RegulatoryStandard> = new Map([
  ['IEC_61511', IEC_61511],
  ['ISO_31000', ISO_31000],
  ['ISO_9001', ISO_9001],
  ['ATEX_DSEAR', ATEX_DSEAR],
  ['PED', PED],
  ['OSHA_PSM', OSHA_PSM],
  ['EPA_RMP', EPA_RMP],
]);

// ============================================================================
// Service Functions
// ============================================================================

/**
 * Get all regulatory standards.
 *
 * @returns Array of all regulatory standards
 */
export function getAllRegulatoryStandards(): RegulatoryStandard[] {
  return Array.from(REGULATORY_STANDARDS_DATABASE.values());
}

/**
 * Get a regulatory standard by ID.
 *
 * @param id - The standard ID
 * @returns The regulatory standard, or null if not found
 */
export function getRegulatoryStandardById(id: RegulatoryStandardId): RegulatoryStandard | null {
  return REGULATORY_STANDARDS_DATABASE.get(id) ?? null;
}

/**
 * Get regulatory standards filtered by query parameters.
 *
 * @param query - Filter parameters
 * @returns Array of matching standards
 */
export function getRegulatoryStandards(query: ListRegulatoryStandardsQuery = {}): RegulatoryStandard[] {
  let standards = getAllRegulatoryStandards();

  // Filter by category
  if (query.category) {
    standards = standards.filter((s) => s.category === query.category);
  }

  // Filter by jurisdiction
  if (query.jurisdiction) {
    standards = standards.filter((s) => s.jurisdiction === query.jurisdiction);
  }

  // Filter by mandatory status
  if (query.mandatory !== undefined) {
    standards = standards.filter((s) => s.mandatory === query.mandatory);
  }

  // Filter by relevance area
  if (query.relevanceArea) {
    standards = standards.filter((s) =>
      s.relevantClauses.some((clause) =>
        clause.hazopsRelevance.includes(query.relevanceArea as HazopsRelevanceArea)
      )
    );
  }

  return standards;
}

/**
 * Get all standard IDs in the database.
 *
 * @returns Array of standard IDs
 */
export function getAvailableStandardIds(): RegulatoryStandardId[] {
  return Array.from(REGULATORY_STANDARDS_DATABASE.keys());
}

/**
 * Check if a standard exists in the database.
 *
 * @param id - The standard ID to check
 * @returns True if the standard exists
 */
export function isStandardAvailable(id: RegulatoryStandardId): boolean {
  return REGULATORY_STANDARDS_DATABASE.has(id);
}

/**
 * Get clauses for a specific standard.
 *
 * @param standardId - The standard ID
 * @returns Array of clauses, or empty array if standard not found
 */
export function getStandardClauses(standardId: RegulatoryStandardId): RegulatoryClause[] {
  const standard = REGULATORY_STANDARDS_DATABASE.get(standardId);
  return standard?.relevantClauses ?? [];
}

/**
 * Get a specific clause by standard ID and clause ID.
 *
 * @param standardId - The standard ID
 * @param clauseId - The clause ID
 * @returns The clause, or null if not found
 */
export function getClauseById(
  standardId: RegulatoryStandardId,
  clauseId: string
): RegulatoryClause | null {
  const clauses = getStandardClauses(standardId);
  return clauses.find((c) => c.id === clauseId) ?? null;
}

/**
 * Get clauses relevant to a specific HazOps area.
 *
 * @param relevanceArea - The HazOps relevance area
 * @returns Array of tuples [standardId, clause] for all matching clauses
 */
export function getClausesByRelevanceArea(
  relevanceArea: HazopsRelevanceArea
): Array<{ standardId: RegulatoryStandardId; clause: RegulatoryClause }> {
  const results: Array<{ standardId: RegulatoryStandardId; clause: RegulatoryClause }> = [];

  for (const [standardId, standard] of REGULATORY_STANDARDS_DATABASE) {
    for (const clause of standard.relevantClauses) {
      if (clause.hazopsRelevance.includes(relevanceArea)) {
        results.push({ standardId, clause });
      }
    }
  }

  return results;
}

/**
 * Get mandatory clauses for a standard.
 *
 * @param standardId - The standard ID
 * @returns Array of mandatory clauses
 */
export function getMandatoryClauses(standardId: RegulatoryStandardId): RegulatoryClause[] {
  return getStandardClauses(standardId).filter((c) => c.mandatory);
}

/**
 * Search clauses by keyword.
 *
 * @param keyword - The keyword to search for (case-insensitive)
 * @returns Array of matching clauses with their standard IDs
 */
export function searchClauses(
  keyword: string
): Array<{ standardId: RegulatoryStandardId; clause: RegulatoryClause }> {
  const lowerKeyword = keyword.toLowerCase();
  const results: Array<{ standardId: RegulatoryStandardId; clause: RegulatoryClause }> = [];

  for (const [standardId, standard] of REGULATORY_STANDARDS_DATABASE) {
    for (const clause of standard.relevantClauses) {
      const matchesKeywords = clause.keywords.some((k) =>
        k.toLowerCase().includes(lowerKeyword)
      );
      const matchesTitle = clause.title.toLowerCase().includes(lowerKeyword);
      const matchesDescription = clause.description.toLowerCase().includes(lowerKeyword);

      if (matchesKeywords || matchesTitle || matchesDescription) {
        results.push({ standardId, clause });
      }
    }
  }

  return results;
}

/**
 * Get standards by category.
 *
 * @param category - The regulatory category
 * @returns Array of standards in that category
 */
export function getStandardsByCategory(category: RegulatoryCategory): RegulatoryStandard[] {
  return getAllRegulatoryStandards().filter((s) => s.category === category);
}

/**
 * Get standards by jurisdiction.
 *
 * @param jurisdiction - The regulatory jurisdiction
 * @returns Array of standards in that jurisdiction
 */
export function getStandardsByJurisdiction(
  jurisdiction: RegulatoryJurisdiction
): RegulatoryStandard[] {
  return getAllRegulatoryStandards().filter((s) => s.jurisdiction === jurisdiction);
}

/**
 * Get related standards for a given standard.
 *
 * @param standardId - The standard ID
 * @returns Array of related standards
 */
export function getRelatedStandards(standardId: RegulatoryStandardId): RegulatoryStandard[] {
  const standard = REGULATORY_STANDARDS_DATABASE.get(standardId);
  if (!standard) {
    return [];
  }

  return standard.relatedStandards
    .map((id) => REGULATORY_STANDARDS_DATABASE.get(id))
    .filter((s): s is RegulatoryStandard => s !== undefined);
}

/**
 * Get summary statistics for the standards database.
 *
 * @returns Object with database statistics
 */
export function getDatabaseStats(): {
  totalStandards: number;
  totalClauses: number;
  mandatoryStandards: number;
  standardsByCategory: Record<RegulatoryCategory, number>;
  standardsByJurisdiction: Record<RegulatoryJurisdiction, number>;
} {
  const standards = getAllRegulatoryStandards();
  const totalClauses = standards.reduce((sum, s) => sum + s.relevantClauses.length, 0);
  const mandatoryStandards = standards.filter((s) => s.mandatory).length;

  const standardsByCategory: Record<string, number> = {};
  const standardsByJurisdiction: Record<string, number> = {};

  for (const standard of standards) {
    standardsByCategory[standard.category] = (standardsByCategory[standard.category] ?? 0) + 1;
    standardsByJurisdiction[standard.jurisdiction] =
      (standardsByJurisdiction[standard.jurisdiction] ?? 0) + 1;
  }

  return {
    totalStandards: standards.length,
    totalClauses,
    mandatoryStandards,
    standardsByCategory: standardsByCategory as Record<RegulatoryCategory, number>,
    standardsByJurisdiction: standardsByJurisdiction as Record<RegulatoryJurisdiction, number>,
  };
}

/**
 * Get clauses organized by HazOps relevance area.
 *
 * @param standardId - The standard ID (optional, all standards if not provided)
 * @returns Map of relevance areas to clauses
 */
export function getClausesByRelevance(
  standardId?: RegulatoryStandardId
): Map<HazopsRelevanceArea, Array<{ standardId: RegulatoryStandardId; clause: RegulatoryClause }>> {
  const result = new Map<
    HazopsRelevanceArea,
    Array<{ standardId: RegulatoryStandardId; clause: RegulatoryClause }>
  >();

  const standards = standardId
    ? [REGULATORY_STANDARDS_DATABASE.get(standardId)].filter(
        (s): s is RegulatoryStandard => s !== undefined
      )
    : getAllRegulatoryStandards();

  for (const standard of standards) {
    for (const clause of standard.relevantClauses) {
      for (const area of clause.hazopsRelevance) {
        if (!result.has(area)) {
          result.set(area, []);
        }
        result.get(area)!.push({ standardId: standard.id, clause });
      }
    }
  }

  return result;
}

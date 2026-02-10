/**
 * Unit tests for guide-words.service.ts
 *
 * Tests the guide word helper functions and validation.
 */

import { describe, it, expect } from '@jest/globals';
import {
  getAllGuideWords,
  getGuideWordByValue,
  isValidGuideWord,
  getGuideWordsForParameter,
  getAllParameters,
  getGuideWordLabel,
  getGuideWordDescription,
} from './guide-words.service.js';

describe('Guide Words Service', () => {
  describe('getAllGuideWords', () => {
    it('should return all 7 guide words', () => {
      const result = getAllGuideWords();

      expect(result.count).toBe(7);
      expect(result.guideWords).toHaveLength(7);
    });

    it('should include all standard guide word values', () => {
      const result = getAllGuideWords();
      const values = result.guideWords.map((gw) => gw.value);

      expect(values).toContain('no');
      expect(values).toContain('more');
      expect(values).toContain('less');
      expect(values).toContain('reverse');
      expect(values).toContain('early');
      expect(values).toContain('late');
      expect(values).toContain('other_than');
    });

    it('should include complete metadata for each guide word', () => {
      const result = getAllGuideWords();

      result.guideWords.forEach((gw) => {
        expect(gw.value).toBeDefined();
        expect(typeof gw.value).toBe('string');

        expect(gw.label).toBeDefined();
        expect(typeof gw.label).toBe('string');
        expect(gw.label.length).toBeGreaterThan(0);

        expect(gw.description).toBeDefined();
        expect(typeof gw.description).toBe('string');
        expect(gw.description.length).toBeGreaterThan(0);

        expect(gw.applicableParameters).toBeDefined();
        expect(Array.isArray(gw.applicableParameters)).toBe(true);
        expect(gw.applicableParameters.length).toBeGreaterThan(0);

        expect(gw.exampleDeviations).toBeDefined();
        expect(Array.isArray(gw.exampleDeviations)).toBe(true);
        expect(gw.exampleDeviations.length).toBeGreaterThan(0);
      });
    });
  });

  describe('getGuideWordByValue', () => {
    it('should return guide word definition for valid value', () => {
      const result = getGuideWordByValue('no');

      expect(result).not.toBeNull();
      expect(result!.value).toBe('no');
      expect(result!.label).toBe('No');
      expect(result!.description).toContain('negation');
    });

    it('should return null for invalid value', () => {
      const result = getGuideWordByValue('invalid');

      expect(result).toBeNull();
    });

    it('should handle other_than correctly', () => {
      const result = getGuideWordByValue('other_than');

      expect(result).not.toBeNull();
      expect(result!.value).toBe('other_than');
      expect(result!.label).toBe('Other Than');
    });

    it('should return null for empty string', () => {
      const result = getGuideWordByValue('');

      expect(result).toBeNull();
    });

    it('should be case-sensitive', () => {
      // Guide words are lowercase
      const result1 = getGuideWordByValue('NO');
      const result2 = getGuideWordByValue('No');

      expect(result1).toBeNull();
      expect(result2).toBeNull();
    });
  });

  describe('isValidGuideWord', () => {
    it('should return true for valid guide words', () => {
      expect(isValidGuideWord('no')).toBe(true);
      expect(isValidGuideWord('more')).toBe(true);
      expect(isValidGuideWord('less')).toBe(true);
      expect(isValidGuideWord('reverse')).toBe(true);
      expect(isValidGuideWord('early')).toBe(true);
      expect(isValidGuideWord('late')).toBe(true);
      expect(isValidGuideWord('other_than')).toBe(true);
    });

    it('should return false for invalid values', () => {
      expect(isValidGuideWord('invalid')).toBe(false);
      expect(isValidGuideWord('')).toBe(false);
      expect(isValidGuideWord('NO')).toBe(false);
      expect(isValidGuideWord('other')).toBe(false);
      expect(isValidGuideWord('otherthan')).toBe(false);
    });
  });

  describe('getGuideWordsForParameter', () => {
    it('should return guide words for flow parameter', () => {
      const result = getGuideWordsForParameter('flow');
      const values = result.map((gw) => gw.value);

      expect(values).toContain('no');
      expect(values).toContain('more');
      expect(values).toContain('less');
      expect(values).toContain('reverse');
    });

    it('should return guide words for composition parameter', () => {
      const result = getGuideWordsForParameter('composition');
      const values = result.map((gw) => gw.value);

      expect(values).toContain('other_than');
    });

    it('should return guide words for reaction parameter', () => {
      const result = getGuideWordsForParameter('reaction');
      const values = result.map((gw) => gw.value);

      expect(values).toContain('no');
      expect(values).toContain('reverse');
      expect(values).toContain('early');
      expect(values).toContain('late');
    });

    it('should be case-insensitive', () => {
      const result1 = getGuideWordsForParameter('FLOW');
      const result2 = getGuideWordsForParameter('Flow');
      const result3 = getGuideWordsForParameter('flow');

      expect(result1.length).toBe(result2.length);
      expect(result2.length).toBe(result3.length);
    });

    it('should return empty array for unknown parameter', () => {
      const result = getGuideWordsForParameter('unknown');

      expect(result).toEqual([]);
    });
  });

  describe('getAllParameters', () => {
    it('should return a list of parameters', () => {
      const result = getAllParameters();

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it('should include common process parameters', () => {
      const result = getAllParameters();

      expect(result).toContain('flow');
      expect(result).toContain('pressure');
      expect(result).toContain('temperature');
      expect(result).toContain('level');
    });

    it('should return sorted parameters', () => {
      const result = getAllParameters();
      const sorted = [...result].sort();

      expect(result).toEqual(sorted);
    });

    it('should not contain duplicates', () => {
      const result = getAllParameters();
      const unique = [...new Set(result)];

      expect(result.length).toBe(unique.length);
    });
  });

  describe('getGuideWordLabel', () => {
    it('should return label for valid guide word', () => {
      expect(getGuideWordLabel('no')).toBe('No');
      expect(getGuideWordLabel('more')).toBe('More');
      expect(getGuideWordLabel('other_than')).toBe('Other Than');
    });

    it('should return null for invalid guide word', () => {
      expect(getGuideWordLabel('invalid')).toBeNull();
      expect(getGuideWordLabel('')).toBeNull();
    });
  });

  describe('getGuideWordDescription', () => {
    it('should return description for valid guide word', () => {
      const desc = getGuideWordDescription('no');

      expect(desc).not.toBeNull();
      expect(desc).toContain('negation');
    });

    it('should return null for invalid guide word', () => {
      expect(getGuideWordDescription('invalid')).toBeNull();
      expect(getGuideWordDescription('')).toBeNull();
    });
  });
});

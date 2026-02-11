import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  RiskScoreBadge,
  RiskScoreCompact,
  RiskLevelBadge,
  getRiskLevelFromScore,
} from './RiskScoreBadge';
import { RISK_LEVEL_LABELS, RISK_THRESHOLDS } from '@hazop/types';
import type { RiskLevel } from '@hazop/types';

describe('getRiskLevelFromScore', () => {
  describe('returns correct risk level for boundary values', () => {
    it('returns "low" for score 1', () => {
      expect(getRiskLevelFromScore(1)).toBe('low');
    });

    it('returns "low" for score 20 (upper boundary)', () => {
      expect(getRiskLevelFromScore(20)).toBe('low');
    });

    it('returns "medium" for score 21 (lower boundary)', () => {
      expect(getRiskLevelFromScore(21)).toBe('medium');
    });

    it('returns "medium" for score 60 (upper boundary)', () => {
      expect(getRiskLevelFromScore(60)).toBe('medium');
    });

    it('returns "high" for score 61 (lower boundary)', () => {
      expect(getRiskLevelFromScore(61)).toBe('high');
    });

    it('returns "high" for score 125 (maximum)', () => {
      expect(getRiskLevelFromScore(125)).toBe('high');
    });
  });

  describe('returns correct risk level for mid-range values', () => {
    it('returns "low" for score 10', () => {
      expect(getRiskLevelFromScore(10)).toBe('low');
    });

    it('returns "medium" for score 40', () => {
      expect(getRiskLevelFromScore(40)).toBe('medium');
    });

    it('returns "high" for score 100', () => {
      expect(getRiskLevelFromScore(100)).toBe('high');
    });
  });
});

describe('RiskScoreBadge', () => {
  describe('rendering', () => {
    it('renders the risk score', () => {
      render(<RiskScoreBadge riskScore={42} />);
      expect(screen.getByText('42')).toBeInTheDocument();
    });

    it('renders the risk level label', () => {
      render(<RiskScoreBadge riskScore={42} />);
      expect(screen.getByText('Medium Risk')).toBeInTheDocument();
    });

    it('hides label when showLabel is false', () => {
      render(<RiskScoreBadge riskScore={42} showLabel={false} />);
      expect(screen.getByText('42')).toBeInTheDocument();
      expect(screen.queryByText('Medium Risk')).not.toBeInTheDocument();
    });

    it('hides score when showScore is false', () => {
      render(<RiskScoreBadge riskScore={42} showScore={false} />);
      expect(screen.queryByText('42')).not.toBeInTheDocument();
      expect(screen.getByText('Medium Risk')).toBeInTheDocument();
    });

    it('uses provided riskLevel when available', () => {
      render(<RiskScoreBadge riskScore={10} riskLevel="high" />);
      expect(screen.getByText('High Risk')).toBeInTheDocument();
    });

    it('derives riskLevel from score when not provided', () => {
      render(<RiskScoreBadge riskScore={10} />);
      expect(screen.getByText('Low Risk')).toBeInTheDocument();
    });
  });

  describe('color coding', () => {
    it('applies green styling for low risk scores', () => {
      const { container } = render(<RiskScoreBadge riskScore={15} />);
      const badge = container.firstChild as HTMLElement;
      expect(badge.className).toContain('bg-green-50');
      expect(badge.className).toContain('text-green-800');
    });

    it('applies amber styling for medium risk scores', () => {
      const { container } = render(<RiskScoreBadge riskScore={40} />);
      const badge = container.firstChild as HTMLElement;
      expect(badge.className).toContain('bg-amber-50');
      expect(badge.className).toContain('text-amber-800');
    });

    it('applies red styling for high risk scores', () => {
      const { container } = render(<RiskScoreBadge riskScore={80} />);
      const badge = container.firstChild as HTMLElement;
      expect(badge.className).toContain('bg-red-50');
      expect(badge.className).toContain('text-red-800');
    });
  });

  describe('size variants', () => {
    it('applies xs size classes', () => {
      const { container } = render(<RiskScoreBadge riskScore={42} size="xs" />);
      const badge = container.firstChild as HTMLElement;
      expect(badge.className).toContain('px-1.5');
    });

    it('applies sm size classes (default)', () => {
      const { container } = render(<RiskScoreBadge riskScore={42} />);
      const badge = container.firstChild as HTMLElement;
      expect(badge.className).toContain('px-2');
    });

    it('applies md size classes', () => {
      const { container } = render(<RiskScoreBadge riskScore={42} size="md" />);
      const badge = container.firstChild as HTMLElement;
      expect(badge.className).toContain('px-2.5');
    });

    it('applies lg size classes', () => {
      const { container } = render(<RiskScoreBadge riskScore={42} size="lg" />);
      const badge = container.firstChild as HTMLElement;
      expect(badge.className).toContain('px-3');
    });
  });

  describe('custom className', () => {
    it('appends custom className to badge', () => {
      const { container } = render(<RiskScoreBadge riskScore={42} className="custom-class" />);
      const badge = container.firstChild as HTMLElement;
      expect(badge.className).toContain('custom-class');
    });
  });

  describe('all risk levels', () => {
    const riskLevels: RiskLevel[] = ['low', 'medium', 'high'];

    it.each(riskLevels)('renders %s risk level correctly', (level) => {
      const score = level === 'low' ? 10 : level === 'medium' ? 40 : 80;
      render(<RiskScoreBadge riskScore={score} />);
      expect(screen.getByText(RISK_LEVEL_LABELS[level])).toBeInTheDocument();
      expect(screen.getByText(String(score))).toBeInTheDocument();
    });
  });
});

describe('RiskScoreCompact', () => {
  describe('rendering', () => {
    it('renders the risk score', () => {
      render(<RiskScoreCompact riskScore={42} />);
      expect(screen.getByText('42')).toBeInTheDocument();
    });

    it('renders colored dot indicator', () => {
      const { container } = render(<RiskScoreCompact riskScore={42} />);
      const dot = container.querySelector('.rounded-full');
      expect(dot).toBeInTheDocument();
    });

    it('uses provided riskLevel when available', () => {
      const { container } = render(<RiskScoreCompact riskScore={10} riskLevel="high" />);
      const text = container.querySelector('.text-red-800');
      expect(text).toBeInTheDocument();
    });
  });

  describe('color coding', () => {
    it('applies green styling for low risk', () => {
      const { container } = render(<RiskScoreCompact riskScore={15} />);
      const text = container.querySelector('.text-green-800');
      expect(text).toBeInTheDocument();
    });

    it('applies amber styling for medium risk', () => {
      const { container } = render(<RiskScoreCompact riskScore={40} />);
      const text = container.querySelector('.text-amber-800');
      expect(text).toBeInTheDocument();
    });

    it('applies red styling for high risk', () => {
      const { container } = render(<RiskScoreCompact riskScore={80} />);
      const text = container.querySelector('.text-red-800');
      expect(text).toBeInTheDocument();
    });
  });

  describe('size variants', () => {
    it('applies xs size classes', () => {
      const { container } = render(<RiskScoreCompact riskScore={42} size="xs" />);
      const text = container.querySelector('.text-xs');
      expect(text).toBeInTheDocument();
    });

    it('applies sm size classes (default)', () => {
      const { container } = render(<RiskScoreCompact riskScore={42} />);
      const text = container.querySelector('.text-sm');
      expect(text).toBeInTheDocument();
    });

    it('applies md size classes', () => {
      const { container } = render(<RiskScoreCompact riskScore={42} size="md" />);
      const text = container.querySelector('.text-base');
      expect(text).toBeInTheDocument();
    });
  });
});

describe('RiskLevelBadge', () => {
  describe('rendering', () => {
    it('renders the risk level label', () => {
      render(<RiskLevelBadge riskLevel="medium" />);
      expect(screen.getByText('Medium Risk')).toBeInTheDocument();
    });
  });

  describe('color coding', () => {
    it('applies green styling for low risk', () => {
      const { container } = render(<RiskLevelBadge riskLevel="low" />);
      const badge = container.firstChild as HTMLElement;
      expect(badge.className).toContain('bg-green-50');
      expect(badge.className).toContain('text-green-800');
    });

    it('applies amber styling for medium risk', () => {
      const { container } = render(<RiskLevelBadge riskLevel="medium" />);
      const badge = container.firstChild as HTMLElement;
      expect(badge.className).toContain('bg-amber-50');
      expect(badge.className).toContain('text-amber-800');
    });

    it('applies red styling for high risk', () => {
      const { container } = render(<RiskLevelBadge riskLevel="high" />);
      const badge = container.firstChild as HTMLElement;
      expect(badge.className).toContain('bg-red-50');
      expect(badge.className).toContain('text-red-800');
    });
  });

  describe('size variants', () => {
    it('applies xs size classes', () => {
      const { container } = render(<RiskLevelBadge riskLevel="low" size="xs" />);
      const badge = container.firstChild as HTMLElement;
      expect(badge.className).toContain('px-1.5');
    });

    it('applies sm size classes (default)', () => {
      const { container } = render(<RiskLevelBadge riskLevel="low" />);
      const badge = container.firstChild as HTMLElement;
      expect(badge.className).toContain('px-2');
    });

    it('applies md size classes', () => {
      const { container } = render(<RiskLevelBadge riskLevel="low" size="md" />);
      const badge = container.firstChild as HTMLElement;
      expect(badge.className).toContain('px-2.5');
    });

    it('applies lg size classes', () => {
      const { container } = render(<RiskLevelBadge riskLevel="low" size="lg" />);
      const badge = container.firstChild as HTMLElement;
      expect(badge.className).toContain('px-3');
    });
  });

  describe('all risk levels', () => {
    const riskLevels: RiskLevel[] = ['low', 'medium', 'high'];

    it.each(riskLevels)('renders %s risk level badge correctly', (level) => {
      render(<RiskLevelBadge riskLevel={level} />);
      expect(screen.getByText(RISK_LEVEL_LABELS[level])).toBeInTheDocument();
    });
  });
});

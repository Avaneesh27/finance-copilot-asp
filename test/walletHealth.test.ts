import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildHealthScore } from '../src/services/security/scoring';
import type { GoPlusTokenData, GoPlusAddressData } from '../src/services/security/goplus';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const cleanTokenData: GoPlusTokenData = {
  is_open_source: '1',
  is_honeypot: '0',
  honeypot_with_same_creator: '0',
  is_blacklisted: '0',
  holders: [{ address: '0xabc', balance: '1000', percent: '0.05', is_contract: 0, tag: '', is_locked: 0 }],
  dex: [{ name: 'Uniswap V2', liquidity: '2000000', pair: '0xpair' }],
};

const cleanAddressData: GoPlusAddressData = {
  blackmail_activities: '0',
  cybercrime: '0',
  darkweb_transactions: '0',
  financial_crime: '0',
  gas_abuse: '0',
  honeypot_related_address: '0',
  malicious_contract_creation: '0',
  money_laundering: '0',
  number_of_malicious_contracts_created: '0',
  phishing_activities: '0',
  reinit: '0',
  stealing_attack: '0',
};

const honeypotTokenData: GoPlusTokenData = {
  ...cleanTokenData,
  is_honeypot: '1',
};

const highConcentrationTokenData: GoPlusTokenData = {
  ...cleanTokenData,
  holders: [{ address: '0xwhale', balance: '900000', percent: '0.30', is_contract: 0, tag: '', is_locked: 0 }],
};

const maliciousAddressData: GoPlusAddressData = {
  ...cleanAddressData,
  cybercrime: '1',
  phishing_activities: '1',
  money_laundering: '1',
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('buildHealthScore', () => {
  it('clean token + clean address → score ≥ 75 and riskLevel low', () => {
    const result = buildHealthScore(cleanTokenData, cleanAddressData);

    expect(result.score).toBeGreaterThanOrEqual(75);
    expect(result.riskLevel).toBe('low');
    expect(result.partial).toBe(false);
    expect(result.factors.length).toBeGreaterThan(0);
    expect(result.recommendation).toBeTruthy();
  });

  it('honeypot token → score ≤ 20 and riskLevel critical', () => {
    const result = buildHealthScore(honeypotTokenData, cleanAddressData);

    expect(result.score).toBeLessThanOrEqual(20);
    expect(result.riskLevel).toBe('critical');
    const honeypotFactor = result.factors.find((f) => f.name === 'honeypot_check');
    expect(honeypotFactor?.status).toBe('fail');
    expect(result.recommendation).toMatch(/AVOID|honeypot/i);
  });

  it('high holder concentration → holder_concentration factor status warning or fail', () => {
    const result = buildHealthScore(highConcentrationTokenData, cleanAddressData);

    const factor = result.factors.find((f) => f.name === 'holder_concentration');
    expect(factor).toBeDefined();
    expect(['warning', 'fail']).toContain(factor?.status);
    expect(factor?.topHolderPct).toBeGreaterThan(25);
  });

  it('null tokenData + valid addressData → partial true, still returns a score', () => {
    const result = buildHealthScore(null, cleanAddressData);

    expect(result.partial).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    // At minimum, malicious_approval_exposure and blacklist_status factors should be present
    const factorNames = result.factors.map((f) => f.name);
    expect(factorNames).toContain('malicious_approval_exposure');
  });

  it('malicious address flags → malicious_approval_exposure status fail', () => {
    const result = buildHealthScore(cleanTokenData, maliciousAddressData);

    const factor = result.factors.find((f) => f.name === 'malicious_approval_exposure');
    expect(factor).toBeDefined();
    expect(factor?.status).toBe('fail');
    expect(factor?.count).toBeGreaterThan(2);
  });

  it('both null → partial true, score between 0-100', () => {
    const result = buildHealthScore(null, null);

    expect(result.partial).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
  });

  it('score always in 0-100 range', () => {
    const results = [
      buildHealthScore(cleanTokenData, cleanAddressData),
      buildHealthScore(honeypotTokenData, maliciousAddressData),
      buildHealthScore(null, null),
      buildHealthScore(highConcentrationTokenData, cleanAddressData),
    ];
    for (const r of results) {
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(100);
    }
  });
});

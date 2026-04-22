/**
 * Feature Flags - Phase 1A
 *
 * Central registry for all feature flags used to gate new functionality
 * during the MLM/Consultant/Education rollout. Flags default to OFF.
 *
 * Reading order:
 *   1. process.env.FF_<UPPER_FLAG_NAME> (explicit override, '1'|'true' enables)
 *   2. default value defined below
 *
 * IMPORTANT:
 *   - No code path in Phase 1A consumes these flags yet.
 *   - They exist so Phase 1B / 2 / 3 / 4 can toggle behavior without
 *     code changes (safe rollout / rollback).
 *   - Do NOT read process.env lazily inside request handlers in hot paths;
 *     import `featureFlags` once at module load.
 */

export type FeatureFlagName =
  | 'consultant.enabled'
  | 'mlm.enabled'
  | 'education.enabled'
  | 'auth.activeTenantId'
  | 'auth.switchTenant'
  | 'rbac.newMiddleware';

const DEFAULTS: Record<FeatureFlagName, boolean> = {
  'consultant.enabled': false,
  'mlm.enabled': false,
  'education.enabled': false,
  'auth.activeTenantId': false,
  'auth.switchTenant': false,
  'rbac.newMiddleware': false,
};

function envKey(flag: FeatureFlagName): string {
  return `FF_${flag.toUpperCase().replace(/\./g, '_')}`;
}

function readFlag(flag: FeatureFlagName): boolean {
  const raw = process.env[envKey(flag)];
  if (raw === undefined || raw === '') return DEFAULTS[flag];
  return raw === '1' || raw.toLowerCase() === 'true';
}

export const featureFlags: Record<FeatureFlagName, boolean> = {
  'consultant.enabled': readFlag('consultant.enabled'),
  'mlm.enabled': readFlag('mlm.enabled'),
  'education.enabled': readFlag('education.enabled'),
  'auth.activeTenantId': readFlag('auth.activeTenantId'),
  'auth.switchTenant': readFlag('auth.switchTenant'),
  'rbac.newMiddleware': readFlag('rbac.newMiddleware'),
};

export function isFeatureEnabled(flag: FeatureFlagName): boolean {
  return featureFlags[flag] === true;
}

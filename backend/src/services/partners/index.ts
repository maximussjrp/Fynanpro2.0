/**
 * Partners — barrel export (Fase 0.2, dormente).
 *
 * ⚠️ NÃO importar este módulo a partir de `main.ts`, `routes/`, `jobs/` ou
 * qualquer caminho de runtime de produção. A Fase 0.2 só expõe lógica para
 * testes. Toggle em prod via `FF_PARTNERS_*` (default OFF).
 */

export * from './types';
export * from './slug-generator';
export * from './partner-audit.logger';
export { buildKycService, type KycService, type KycServiceDeps } from './kyc.service';
export {
  buildReferralLinkService,
  type ReferralLinkService,
  type ReferralLinkServiceDeps,
  type ReferralLinkRow,
} from './referral-link.service';

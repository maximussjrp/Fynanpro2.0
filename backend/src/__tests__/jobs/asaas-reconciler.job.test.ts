/**
 * C5.4 — asaas-reconciler.job: startup guard tests (exigência 2).
 *
 * Garante que uma combinação inválida (MODE=autofix sem FF_..._AUTOFIX=true)
 * aborta o startup do job com ReconcilerAutofixGuardError,
 * **mesmo** quando FF_ASAAS_RECONCILER_ENABLED=false. A intenção é que
 * uma configuração inconsistente seja capturada em deploy, não quando a flag
 * for ligada.
 */

import {
  startAsaasReconcilerJob,
  stopAsaasReconcilerJob,
} from '../../jobs/asaas-reconciler.job';
import { ReconcilerAutofixGuardError } from '../../services/asaas/reconciler.config';

function withEnv(
  vars: Record<string, string | undefined>,
  fn: () => void,
): void {
  const keys = [
    'FF_ASAAS_RECONCILER_ENABLED',
    'FF_ASAAS_RECONCILER_MODE',
    'FF_ASAAS_RECONCILER_AUTOFIX',
    'ASAAS_API_KEY',
    'ASAAS_SANDBOX',
  ];
  const snapshot: Record<string, string | undefined> = {};
  for (const k of keys) snapshot[k] = process.env[k];
  for (const [k, v] of Object.entries(vars)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  try {
    fn();
  } finally {
    for (const k of keys) {
      if (snapshot[k] === undefined) delete process.env[k];
      else process.env[k] = snapshot[k];
    }
    stopAsaasReconcilerJob();
  }
}

describe('startAsaasReconcilerJob — startup guard (exigência 2)', () => {
  it('MODE=autofix sem FF_ASAAS_RECONCILER_AUTOFIX=true ABORTA startup', () => {
    withEnv(
      {
        FF_ASAAS_RECONCILER_ENABLED: 'false',
        FF_ASAAS_RECONCILER_MODE: 'autofix',
        FF_ASAAS_RECONCILER_AUTOFIX: undefined,
      },
      () => {
        expect(() => startAsaasReconcilerJob()).toThrow(ReconcilerAutofixGuardError);
      },
    );
  });

  it('MODE=autofix + AUTOFIX=false também ABORTA', () => {
    withEnv(
      {
        FF_ASAAS_RECONCILER_ENABLED: 'false',
        FF_ASAAS_RECONCILER_MODE: 'autofix',
        FF_ASAAS_RECONCILER_AUTOFIX: 'false',
      },
      () => {
        expect(() => startAsaasReconcilerJob()).toThrow(ReconcilerAutofixGuardError);
      },
    );
  });

  it('MODE=shadow (default) com FF off: não inicia, sem throw', () => {
    withEnv(
      {
        FF_ASAAS_RECONCILER_ENABLED: 'false',
        FF_ASAAS_RECONCILER_MODE: 'shadow',
        FF_ASAAS_RECONCILER_AUTOFIX: undefined,
      },
      () => {
        const out = startAsaasReconcilerJob();
        expect(out.started).toBe(false);
        expect(out.reason).toBe('flag_off');
      },
    );
  });

  it('MODE=dryrun com FF off: não inicia, sem throw', () => {
    withEnv(
      {
        FF_ASAAS_RECONCILER_ENABLED: 'false',
        FF_ASAAS_RECONCILER_MODE: 'dryrun',
      },
      () => {
        const out = startAsaasReconcilerJob();
        expect(out.started).toBe(false);
        expect(out.reason).toBe('flag_off');
      },
    );
  });

  it('FF on + sem ASAAS_API_KEY → não inicia (no_api_key)', () => {
    withEnv(
      {
        FF_ASAAS_RECONCILER_ENABLED: 'true',
        FF_ASAAS_RECONCILER_MODE: 'shadow',
        ASAAS_API_KEY: undefined,
      },
      () => {
        const out = startAsaasReconcilerJob();
        expect(out.started).toBe(false);
        expect(out.reason).toBe('no_api_key');
      },
    );
  });
});

import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const originalCwd = process.cwd();
const originalAk = process.env.ALIBABA_CLOUD_ACCESS_KEY_ID;
const originalSk = process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET;

afterEach(() => {
  process.chdir(originalCwd);
  if (originalAk === undefined) {
    delete process.env.ALIBABA_CLOUD_ACCESS_KEY_ID;
  } else {
    process.env.ALIBABA_CLOUD_ACCESS_KEY_ID = originalAk;
  }
  if (originalSk === undefined) {
    delete process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET;
  } else {
    process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET = originalSk;
  }
  vi.resetModules();
});

describe('env loading', () => {
  it('uses values from the project .env even when parent env has AK/SK', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'crew-env-'));
    try {
      writeFileSync(
        join(dir, '.env'),
        [
          'ALIBABA_CLOUD_ACCESS_KEY_ID=file-ak',
          'ALIBABA_CLOUD_ACCESS_KEY_SECRET=file-sk',
        ].join('\n'),
      );
      process.env.ALIBABA_CLOUD_ACCESS_KEY_ID = 'parent-ak';
      process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET = 'parent-sk';
      process.chdir(dir);

      vi.resetModules();
      const { getAKSK } = await import('./env');

      expect(getAKSK()).toEqual({ ak: 'file-ak', sk: 'file-sk' });
    } finally {
      rmSync(dir, { force: true, recursive: true });
    }
  });
});

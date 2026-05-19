import { config } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

const candidates = [
  resolve(process.cwd(), '.env'),
  resolve(process.cwd(), '../.env'),
];

for (const p of candidates) {
  if (existsSync(p)) {
    config({ path: p, override: true });
    console.log(`Loaded .env from ${p}`);
    break;
  }
}

export function getAKSK(): { ak: string; sk: string } {
  const ak = process.env.ALIBABA_CLOUD_ACCESS_KEY_ID?.trim() ?? '';
  const sk = process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET?.trim() ?? '';
  if (!ak || !sk) {
    throw new Error(
      'Missing ALIBABA_CLOUD_ACCESS_KEY_ID or ALIBABA_CLOUD_ACCESS_KEY_SECRET in .env',
    );
  }
  return { ak, sk };
}

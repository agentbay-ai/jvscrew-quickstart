import crypto from 'node:crypto';

function percentEncode(s: string): string {
  return encodeURIComponent(s)
    .replace(/\+/g, '%20')
    .replace(/\*/g, '%2A')
    .replace(/~/g, '%7E');
}

function nowUTC(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

export function signV1(
  params: Record<string, string>,
  secretKey: string,
): string {
  const sorted = Object.keys(params)
    .filter((k) => k !== 'Signature')
    .sort();

  const canonical = sorted
    .map((k) => `${percentEncode(k)}=${percentEncode(params[k])}`)
    .join('&');

  const stringToSign = `POST&${percentEncode('/')}&${percentEncode(canonical)}`;
  const key = `${secretKey}&`;
  const hmac = crypto.createHmac('sha1', key);
  hmac.update(stringToSign);
  return hmac.digest('base64');
}

export function buildSignedParams(
  action: string,
  accessKeyId: string,
  secretKey: string,
  extraParams: Record<string, string> = {},
): Record<string, string> {
  const params: Record<string, string> = {
    Format: 'JSON',
    Version: '2026-03-11',
    AccessKeyId: accessKeyId,
    SignatureMethod: 'HMAC-SHA1',
    Timestamp: nowUTC(),
    SignatureVersion: '1.0',
    SignatureNonce: crypto.randomUUID(),
    Action: action,
    // Prod RegionId: cn-shanghai
    RegionId: 'cn-hangzhou',
    ...extraParams,
  };
  params.Signature = signV1(params, secretKey);
  return params;
}

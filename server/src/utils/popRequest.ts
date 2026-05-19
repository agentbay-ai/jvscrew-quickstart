import { buildSignedParams } from './sign.js';
import { getAKSK } from './env.js';

const ENDPOINT = 'https://wuyingai.cn-shanghai.aliyuncs.com';

export interface PopResponse {
  [key: string]: unknown;
  RequestId?: string;
  Code?: string;
  Message?: string;
  Success?: boolean;
}

export async function popRequest(
  action: string,
  extraParams: Record<string, string> = {},
): Promise<PopResponse> {
  const { ak, sk } = getAKSK();
  const params = buildSignedParams(action, ak, sk, extraParams);
  const qs = new URLSearchParams(params).toString();

  const startTime = Date.now();
  const response = await fetch(`${ENDPOINT}/?${qs}`, {
    method: 'POST',
    headers: { Accept: 'application/json' },
  });
  const elapsed = Date.now() - startTime;
  const data: PopResponse = await response.json();

  const logEntry = {
    action,
    params: extraParams,
    status: response.status,
    elapsed: `${elapsed}ms`,
    requestId: data.RequestId ?? '-',
    code: data.Code,
    message: data.Message,
  };

  const isSuccess = response.ok && (!data.Code || ['200', 'ok', 'Success'].includes(data.Code));
  if (isSuccess) {
    console.log(`[POP] ${action} OK`, JSON.stringify(logEntry));
  } else {
    console.error(`[POP] ${action} FAILED`, JSON.stringify(logEntry));
  }

  return data;
}

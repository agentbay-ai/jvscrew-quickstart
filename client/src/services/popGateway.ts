import { useAuthStore } from '../stores/authStore';

const JVS_ENDPOINT = '/jvs';
const API_VERSION = '2026-03-11';

function nowUTC(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function jwtJsonUrl(token: string, templateId?: string): string {
  const params = new URLSearchParams({
    Authorization: `Bearer ${token}`,
    Format: 'JSON',
  });
  if (templateId) params.set('TemplateId', templateId);
  return `${JVS_ENDPOINT}/?${params.toString()}`;
}

function templateIdFromBody(body: object): string | undefined {
  const templateId = (body as { TemplateId?: unknown }).TemplateId;
  return typeof templateId === 'string' && templateId ? templateId : undefined;
}

export function popJsonHeaders(action: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'x-acs-version': API_VERSION,
    'x-acs-action': action,
    'x-acs-date': nowUTC(),
  };
}

export async function popGatewayJson<T>(
  token: string,
  action: string,
  body: object,
): Promise<T> {
  const templateId = templateIdFromBody(body);
  let res = await fetch(jwtJsonUrl(token, templateId), {
    method: 'POST',
    headers: popJsonHeaders(action),
    body: JSON.stringify(body),
  });

  if (res.status === 401) {
    const freshToken = await useAuthStore.getState().refreshAccessToken();
    if (freshToken && freshToken !== token) {
      res = await fetch(jwtJsonUrl(freshToken, templateId), {
        method: 'POST',
        headers: popJsonHeaders(action),
        body: JSON.stringify(body),
      });
    }
  }

  const data = (await res.json()) as T & { Success?: boolean; Message?: string; Code?: string };
  if (!res.ok || data.Success === false) {
    throw new Error(data.Message || data.Code || `API error: ${res.status}`);
  }
  return data;
}

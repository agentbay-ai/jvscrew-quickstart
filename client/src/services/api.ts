import type {
  AgentEnvVarInput,
  AgentEnvVarSummary,
  AuthConfig,
  DeleteAgentEnvVarResponse,
  GetAgentEnvVarResponse,
  ListSkillPreferencesResponse,
  ListSkillsResponse,
  ListTemplatesResponse,
  ListUserSkillsResponse,
  SessionItem,
  SessionMessage,
  SetAgentEnvVarResponse,
  SetSkillPreferenceResponse,
  SkillPreference,
  SkillPreferenceAction,
  TemplateDetailResponse,
  TemplateItem,
} from '../types/api';

import { useAuthStore } from '../stores/authStore';

const JVS_ENDPOINT = '/jvs';
const API_VERSION = '2026-03-11';

function nowUTC(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function jwtHeaders(action: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'x-acs-version': API_VERSION,
    'x-acs-action': action,
    'x-acs-date': nowUTC(),
  };
}

function jwtQuery(token: string, templateId?: string): string {
  const params = new URLSearchParams({
    Authorization: `Bearer ${token}`,
  });
  if (templateId) params.set('TemplateId', templateId);
  return params.toString();
}

async function jwtFetch(
  action: string,
  body: unknown,
  token: string,
  templateId?: string,
): Promise<Response> {
  const qs = jwtQuery(token, templateId);
  const res = await fetch(`${JVS_ENDPOINT}/?${qs}`, {
    method: 'POST',
    headers: jwtHeaders(action),
    body: JSON.stringify(body),
  });

  if (res.status === 401) {
    const freshToken = await useAuthStore.getState().refreshAccessToken();
    if (freshToken && freshToken !== token) {
      const retryQs = jwtQuery(freshToken, templateId);
      return fetch(`${JVS_ENDPOINT}/?${retryQs}`, {
        method: 'POST',
        headers: jwtHeaders(action),
        body: JSON.stringify(body),
      });
    }
  }

  return res;
}

export async function getAccessToken(externalUserId: string) {
  const res = await fetch('/api/auth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ externalUserId }),
  });
  return res.json();
}

function normalizeTemplateItem(item: Record<string, unknown>): TemplateItem {
  return {
    TenantId: String(item.TenantId ?? item.tenant_id ?? ''),
    TemplateId: String(item.TemplateId ?? item.template_id ?? ''),
    TemplateKey: String(item.TemplateKey ?? item.template_key ?? ''),
  };
}

export async function listTemplates(): Promise<ListTemplatesResponse> {
  const res = await fetch('/api/templates/list', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  const data = await res.json();
  if (!res.ok || data.Success === false) {
    throw new Error(data.Message || data.Code || 'Failed to list templates');
  }
  return {
    ...data,
    Items: Array.isArray(data.Items)
      ? data.Items.map((item: Record<string, unknown>) => normalizeTemplateItem(item))
      : [],
  };
}

export async function getTemplate(templateId: string): Promise<TemplateDetailResponse> {
  const res = await fetch('/api/templates/get', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ templateId }),
  });
  const data = await res.json();
  if (!res.ok || data.Success === false) {
    throw new Error(data.Message || data.Code || 'Failed to get template');
  }
  return data;
}

export async function listSessions(
  token: string,
  externalUserId: string,
  templateId?: string,
): Promise<SessionItem[]> {
  const res = await jwtFetch('ListSessions', { ExternalUserId: externalUserId }, token, templateId);
  const data = await res.json();
  return data.Chats ?? [];
}

export async function listSessionHistory(
  token: string,
  sessionId: string,
  externalUserId: string,
  templateId?: string,
): Promise<SessionMessage[]> {
  const res = await jwtFetch('ListSessionHistory', { SessionId: sessionId, ExternalUserId: externalUserId }, token, templateId);
  const data = await res.json();
  return data.Messages ?? [];
}

export async function stopSession(
  token: string,
  sessionId: string,
  templateId?: string,
): Promise<boolean> {
  const res = await jwtFetch('StopSession', { SessionId: sessionId }, token, templateId);
  const data = await res.json();
  return data.Stopped ?? false;
}

export async function deleteSession(
  token: string,
  sessionId: string,
  templateId?: string,
): Promise<boolean> {
  const res = await jwtFetch('DeleteSession', { SessionId: sessionId }, token, templateId);
  const data = await res.json();
  return data.Deleted ?? false;
}

export async function listSkills(
  type: 'builtin' | 'market',
  templateId?: string,
): Promise<ListSkillsResponse> {
  const res = await fetch('/api/skills/list', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, templateId }),
  });
  const data = await res.json();
  if (!res.ok || data.Success === false) {
    throw new Error(data.Message || data.Code || 'Failed to list skills');
  }
  return {
    ...data,
    Skills: Array.isArray(data.Skills) ? data.Skills : [],
  };
}

export async function listSkillPreferencesPage(
  token: string,
  templateId?: string,
  nextToken?: string,
): Promise<ListSkillPreferencesResponse> {
  const body: Record<string, unknown> = { MaxResults: 100 };
  if (nextToken) body.NextToken = nextToken;
  const res = await jwtFetch('ListSkillPreferences', body, token, templateId);
  const data = await res.json();
  if (!res.ok || data.Success === false) {
    throw new Error(data.Message || data.Code || 'Failed to list skill preferences');
  }
  return {
    ...data,
    SkillPreferences: Array.isArray(data.SkillPreferences) ? data.SkillPreferences : [],
  };
}

export async function listAllSkillPreferences(
  token: string,
  templateId?: string,
): Promise<SkillPreference[]> {
  const out: SkillPreference[] = [];
  let nextToken: string | undefined;
  do {
    const page = await listSkillPreferencesPage(token, templateId, nextToken);
    out.push(...page.SkillPreferences);
    nextToken = page.NextToken && page.NextToken.length > 0 ? page.NextToken : undefined;
  } while (nextToken);
  return out;
}

export async function setSkillPreference(
  token: string,
  skillId: string,
  preference: SkillPreferenceAction,
  templateId?: string,
): Promise<SetSkillPreferenceResponse> {
  const res = await jwtFetch(
    'SetSkillPreference',
    { SkillId: skillId, Preference: preference },
    token,
    templateId,
  );
  const data = await res.json();
  if (!res.ok || data.Success === false) {
    throw new Error(data.Message || data.Code || 'Failed to set skill preference');
  }
  return data;
}

export async function getAgentEnvVarsPage(
  token: string,
  templateId?: string,
  nextToken?: string,
): Promise<GetAgentEnvVarResponse> {
  const body: Record<string, unknown> = { MaxResults: 100 };
  if (nextToken) body.NextToken = nextToken;
  const res = await jwtFetch('GetAgentEnvVarForUser', body, token, templateId);
  const data = await res.json();
  if (!res.ok || data.Success === false) {
    throw new Error(data.Message || data.Code || 'Failed to fetch env vars');
  }
  return {
    ...data,
    Variables: Array.isArray(data.Variables) ? data.Variables : [],
  };
}

export async function listAllAgentEnvVars(
  token: string,
  templateId?: string,
): Promise<AgentEnvVarSummary[]> {
  const out: AgentEnvVarSummary[] = [];
  let nextToken: string | undefined;
  do {
    const page = await getAgentEnvVarsPage(token, templateId, nextToken);
    out.push(...page.Variables);
    nextToken = page.NextToken && page.NextToken.length > 0 ? page.NextToken : undefined;
  } while (nextToken);
  return out;
}

export async function setAgentEnvVars(
  token: string,
  variables: AgentEnvVarInput[],
  templateId?: string,
): Promise<SetAgentEnvVarResponse> {
  const res = await jwtFetch(
    'SetAgentEnvVarForUser',
    { Variables: variables },
    token,
    templateId,
  );
  const data = await res.json();
  if (!res.ok || data.Success === false) {
    throw new Error(data.Message || data.Code || 'Failed to set env vars');
  }
  return data;
}

export async function deleteAgentEnvVars(
  token: string,
  variableKeys: string[],
  templateId?: string,
): Promise<DeleteAgentEnvVarResponse> {
  const res = await jwtFetch(
    'DeleteAgentEnvVarForUser',
    { VariableKeys: variableKeys },
    token,
    templateId,
  );
  const data = await res.json();
  if (!res.ok || data.Success === false) {
    throw new Error(data.Message || data.Code || 'Failed to delete env vars');
  }
  return data;
}

export async function listUserSkills(
  externalUserId: string,
  templateId?: string,
): Promise<ListUserSkillsResponse> {
  const res = await fetch('/api/skills/user-list', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ externalUserId, templateId }),
  });
  const data = await res.json();
  if (!res.ok || data.Success === false) {
    throw new Error(data.Message || data.Code || 'Failed to list user skills');
  }
  return {
    ...data,
    Skills: Array.isArray(data.Skills) ? data.Skills : [],
  };
}

export async function getFileUploadUrl(
  config: AuthConfig,
  fileName: string,
) {
  const res = await fetch('/api/file/upload-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      externalUserId: config.externalUserId,
      fileName,
      templateId: config.templateId,
    }),
  });
  return res.json();
}

function parseUploadHeadersHint(uploadHeadersHint?: string): Record<string, string> | undefined {
  if (!uploadHeadersHint?.trim()) return undefined;
  try {
    const parsed = JSON.parse(uploadHeadersHint) as Record<string, unknown>;
    const headers = Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, string] => (
        typeof entry[1] === 'string'
      )),
    );
    return Object.keys(headers).length > 0 ? headers : undefined;
  } catch {
    return undefined;
  }
}

export async function uploadFileToOSS(
  uploadUrl: string,
  file: File,
  uploadHeadersHint?: string,
) {
  const headers = parseUploadHeadersHint(uploadHeadersHint);
  await fetch(uploadUrl, {
    method: 'PUT',
    body: file,
    ...(headers ? { headers } : {}),
  });
}

export async function listUserMcps(
  token: string,
  templateId?: string,
  source: import('../types/api').McpSourceFilter = 'all',
  maxResults = 50,
): Promise<import('../types/api').ListUserMcpsResponse> {
  const items: import('../types/api').McpItem[] = [];
  let nextToken: string | undefined;
  do {
    const body: Record<string, unknown> = { Source: source, MaxResults: maxResults };
    if (nextToken) body.NextToken = nextToken;
    const res = await jwtFetch('ListUserMcps', body, token, templateId);
    const data = await res.json();
    if (!res.ok || data.Success === false) {
      throw new Error(data.Message || data.Code || 'Failed to list MCPs');
    }
    if (Array.isArray(data.Mcps)) items.push(...data.Mcps);
    nextToken = data.NextToken && data.NextToken.length > 0 ? data.NextToken : undefined;
  } while (nextToken);
  return { Success: true, Mcps: items, MaxResults: maxResults };
}

export async function setUserMcpPreference(
  token: string,
  mcpId: string,
  preference: import('../types/api').McpPreference,
  templateId?: string,
) {
  const res = await jwtFetch(
    'SetUserMcpPreference',
    { McpId: mcpId, Preference: preference },
    token,
    templateId,
  );
  const data = await res.json();
  if (!res.ok || data.Success === false) {
    throw new Error(data.Message || data.Code || 'Failed to set MCP preference');
  }
  return data;
}

export async function setUserMcpCredential(
  token: string,
  mcpId: string,
  headers: Record<string, string>,
  templateId?: string,
) {
  const res = await jwtFetch(
    'SetUserMcpCredential',
    { McpId: mcpId, Headers: headers },
    token,
    templateId,
  );
  const data = await res.json();
  if (!res.ok || data.Success === false) {
    throw new Error(data.Message || data.Code || 'Failed to set MCP credential');
  }
  return data;
}

export async function clearUserMcpCredential(
  token: string,
  mcpId: string,
  templateId?: string,
) {
  const res = await jwtFetch(
    'ClearUserMcpCredential',
    { McpId: mcpId },
    token,
    templateId,
  );
  const data = await res.json();
  if (!res.ok || data.Success === false) {
    throw new Error(data.Message || data.Code || 'Failed to clear MCP credential');
  }
  return data;
}

export async function createUserMcp(
  token: string,
  payload: import('../types/api').CreateUserMcpInput,
  templateId?: string,
): Promise<import('../types/api').UserMcpDetail> {
  const res = await jwtFetch('CreateUserMcp', payload, token, templateId);
  const data = await res.json();
  if (!res.ok || data.Success === false) {
    throw new Error(data.Message || data.Code || 'Failed to create user MCP');
  }
  return data;
}

export async function updateUserMcp(
  token: string,
  mcpId: string,
  partial: import('../types/api').UpdateUserMcpInput,
  templateId?: string,
): Promise<import('../types/api').UserMcpDetail> {
  const res = await jwtFetch(
    'UpdateUserMcp',
    { McpId: mcpId, ...partial },
    token,
    templateId,
  );
  const data = await res.json();
  if (!res.ok || data.Success === false) {
    throw new Error(data.Message || data.Code || 'Failed to update user MCP');
  }
  return data;
}

export async function deleteUserMcp(
  token: string,
  mcpId: string,
  templateId?: string,
) {
  const res = await jwtFetch('DeleteUserMcp', { McpId: mcpId }, token, templateId);
  const data = await res.json();
  if (!res.ok || data.Success === false) {
    throw new Error(data.Message || data.Code || 'Failed to delete user MCP');
  }
  return data;
}

export async function getUserMcp(
  token: string,
  mcpId: string,
  templateId?: string,
): Promise<import('../types/api').UserMcpDetail> {
  const res = await jwtFetch('GetUserMcp', { McpId: mcpId }, token, templateId);
  const data = await res.json();
  if (!res.ok || data.Success === false) {
    throw new Error(data.Message || data.Code || 'Failed to get user MCP');
  }
  return data;
}

export async function warmWorkspace(
  token: string,
  templateId?: string,
): Promise<{ Success: boolean; Status?: string; Code?: string; Message?: string }> {
  const res = await jwtFetch('WarmWorkspace', {}, token, templateId);
  return res.json();
}

export async function syncContext(config: AuthConfig, fileKey: string) {
  const res = await fetch('/api/file/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      externalUserId: config.externalUserId,
      fileKey,
      templateId: config.templateId,
    }),
  });
  return res.json();
}

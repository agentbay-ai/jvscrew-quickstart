export interface AuthConfig {
  externalUserId: string;
  templateId?: string;
  templateName?: string;
}

export interface ExpertTemplate {
  id: string;
  name: string;
  description?: string;
  avatar?: string;
  status?: 'online' | 'creating' | 'offline';
  tags?: string[];
  createdAt?: string;
  templateId?: string;
  templateKey?: string;
  tenantId?: string;
}

export interface TokenResponse {
  Success: boolean;
  Code: string;
  Message?: string;
  HttpStatusCode: number;
  RequestId: string;
  AccessToken?: string;
}

export interface ChatMessage {
  Role: 'user' | 'assistant' | 'system' | 'tool';
  Content: ChatContent[];
}

export interface ChatContent {
  Type: 'text' | 'image' | 'file';
  Text?: string;
  ImageUrl?: string;
  FileUrl?: string;
}

export interface UploadedFileInput {
  name: string;
  sandboxPath: string;
}

export interface SSEEvent {
  Object: 'response' | 'message' | 'content' | 'error';
  Id?: string;
  SessionId?: string;
  SequenceNumber?: string;
  Status?: string;
  Type?: string;
  Role?: string;
  Text?: string;
  Content?: ChatContent[];
  Data?: Record<string, unknown>;
  CreatedAt?: string;
}

export interface SessionItem {
  Id: string;
  Name: string;
  SessionId: string;
  UserId: string;
  Channel: string;
  CreatedAt: string;
  UpdatedAt: string;
  Meta: Record<string, unknown>;
}

export interface SessionMessage {
  Id: string;
  Role: string;
  Type: string;
  Object: string;
  Status: string;
  Error?: string;
  SequenceNumber?: string;
  Content: SessionMessageContent[];
  Metadata: Record<string, unknown>;
}

export interface SessionMessageContent {
  Object: string;
  Status: string;
  Error?: string;
  MsgId: string;
  Text: string;
  Data?: string;
  SequenceNumber?: string;
}

export interface FileUploadResponse {
  Success: boolean;
  Code: string;
  HttpStatusCode: number;
  RequestId: string;
  UploadUrl: string;
  UploadHeadersHint?: string;
  SandboxPath: string;
  FileKey: string;
}

export interface TemplateItem {
  TenantId: string;
  TemplateId: string;
  TemplateKey: string;
}

export interface ListTemplatesResponse {
  Success: boolean;
  Code?: string;
  Message?: string;
  HttpStatusCode?: number;
  RequestId?: string;
  Items: TemplateItem[];
  AccessDeniedDetail?: string;
}

export interface TemplateEnabledSkill {
  Type?: string;
  SkillId: string;
}

export interface TemplateMcpClient {
  Name?: string;
  Description?: string;
  Enabled?: string | boolean;
  Transport?: string;
  Url?: string;
  Timeout?: number;
  Headers?: Record<string, unknown>;
}

export interface TemplateChannelItem {
  ChannelInstanceId?: string;
  Enabled?: boolean;
  ChannelType?: string;
  Settings?: Record<string, unknown>;
  ChannelKey?: string;
  Name?: string;
}

export interface TemplateWorkspaceFile {
  Path: string;
  Version?: number;
  Content?: string;
}

export interface TemplateDetailResponse {
  Success: boolean;
  Code?: string;
  Message?: string;
  CreatedAt?: string;
  UpdatedAt?: string;
  ProviderPolicy?: {
    Version?: number;
    UpdatedAt?: string;
    ActiveLlm?: {
      ProviderId?: string;
      Model?: string;
    };
  };
  Channels?: {
    Items?: TemplateChannelItem[];
  };
  Template?: {
    TemplateKey?: string;
  };
  ModelTier?: string;
  TenantId?: string;
  Skills?: {
    Enabled?: TemplateEnabledSkill[];
  };
  Object?: string;
  Id?: string;
  Mcp?: {
    Clients?: TemplateMcpClient[];
  };
  TemplateId?: string;
  Workspace?: {
    Files?: TemplateWorkspaceFile[];
  };
  AccessDeniedDetail?: string;
}

export interface SkillItem {
  SkillId: string;
  SkillName: string;
  Description: string;
  Icon: string;
  Enabled: boolean;
  SkillStatus: string;
  GmtModified: string;
}

export interface ListSkillsResponse {
  Success: boolean;
  Code?: string;
  Message?: string;
  Skills: SkillItem[];
  TotalCount: string;
}

export interface UserSkill {
  id: string;
  name: string;
  description: string;
}

export interface ListUserSkillsResponse {
  Success: boolean;
  Code?: string;
  Message?: string;
  Skills: UserSkill[];
}

export type SkillPreferenceValue = 'Enabled' | 'Disabled';
export type SkillPreferenceAction = SkillPreferenceValue | 'Default';

export interface SkillPreference {
  SkillId: string;
  UserPreference: SkillPreferenceValue;
  UpdatedAt?: string;
}

export interface ListSkillPreferencesResponse {
  Success: boolean;
  Code?: string;
  Message?: string;
  SkillPreferences: SkillPreference[];
  NextToken?: string;
}

export interface SetSkillPreferenceResponse {
  Success: boolean;
  Code?: string;
  Message?: string;
  SkillId: string;
  UserPreference: SkillPreferenceAction;
}

export interface AgentEnvVarSummary {
  Key: string;
  Description?: string;
  UpdatedAt?: string;
}

export interface AgentEnvVarInput {
  Key: string;
  Value: string;
  Description?: string;
}

export interface GetAgentEnvVarResponse {
  Success: boolean;
  Code?: string;
  Message?: string;
  Variables: AgentEnvVarSummary[];
  NextToken?: string;
}

export interface SetAgentEnvVarResponse {
  Success: boolean;
  Code?: string;
  Message?: string;
  ProcessedKey: string[];
}

export interface DeleteAgentEnvVarResponse {
  Success: boolean;
  Code?: string;
  Message?: string;
  DeletedKeys: string[];
}

export interface ToolCallInfo {
  name: string;
  status: 'calling' | 'completed';
  input?: string;
  output?: string;
}

export interface DisplayMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  reasoning?: string;
  isStreaming?: boolean;
  timestamp: number;
  files?: { name: string; url: string }[];
  toolCalls?: ToolCallInfo[];
}

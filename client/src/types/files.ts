export interface WorkspaceFile {
  FileName: string;
  FilePath: string;
  FileType: 'file' | 'directory';
  Size: number;
  ModifiedAt?: string;
}

export interface ListWorkspaceFilesResponse {
  Success: boolean;
  Code?: string;
  Path: string;
  TotalCount: number;
  PageSize: number;
  PageNumber: number;
  Files: WorkspaceFile[];
}

export interface DownloadUrlResponse {
  Success: boolean;
  DownloadUrl: string;
  ExpiresInSeconds: number;
  FileName: string;
  FileSize: number;
}

export interface SyncResponse {
  Success: boolean;
  SyncStatus: 'completed' | 'no_active_session';
}

export interface ClearedWorkspace {
  TemplateId: string;
  Status: 'cleared' | 'failed';
  Error?: string | null;
}

export interface ClearWorkspaceResponse {
  Success: boolean;
  Code?: string;
  Message?: string;
  ExternalUserId: string;
  ClearedCount: number;
  FailedCount: number;
  Workspaces: ClearedWorkspace[];
}

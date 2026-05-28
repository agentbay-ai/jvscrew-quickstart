import type {
  ClearWorkspaceResponse,
  DeleteFileResponse,
  DownloadUrlResponse,
  ListWorkspaceFilesResponse,
  SyncResponse,
  UploadUrlResponse,
} from '../types/files';

export async function listWorkspaceFiles(params: {
  externalUserId: string;
  path?: string;
  pageSize?: number;
  pageNumber?: number;
  templateId?: string;
}): Promise<ListWorkspaceFilesResponse> {
  const res = await fetch('/api/files/list', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok || data.Success === false) {
    throw new Error(data.Message || data.Code || `API error: ${res.status}`);
  }
  console.log('[listWorkspaceFiles] raw response:', JSON.stringify(data, null, 2));
  if (data.Files?.length) {
    console.log('[listWorkspaceFiles] first file fields:', Object.keys(data.Files[0]), data.Files[0]);
  }
  const files = data.Files ?? [];
  return {
    Success: true,
    Path: data.Path ?? params.path ?? '/',
    TotalCount: data.TotalCount ?? files.length,
    PageSize: data.MaxResults ?? data.PageSize ?? params.pageSize ?? 50,
    PageNumber: data.PageNumber ?? params.pageNumber ?? 1,
    Files: files,
  };
}

export async function syncWorkspaceFiles(params: {
  externalUserId: string;
  templateId?: string;
}): Promise<SyncResponse> {
  const res = await fetch('/api/files/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok || data.Success === false) {
    throw new Error(data.Message || data.Code || `API error: ${res.status}`);
  }
  return {
    Success: true,
    SyncStatus: data.SyncStatus ?? 'completed',
  };
}

export async function getWorkspaceFileDownloadUrl(params: {
  filePath: string;
  externalUserId?: string;
  templateId?: string;
}): Promise<DownloadUrlResponse> {
  const filePath = params.filePath.startsWith('/') ? params.filePath : `/${params.filePath}`;
  const res = await fetch('/api/files/download-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...params, filePath }),
  });
  const data = await res.json();
  if (!res.ok || data.Success === false || (data.Code && data.Code !== '200' && data.Code !== 'ok')) {
    throw new Error(data.Message || data.Code || `API error: ${res.status}`);
  }
  return data;
}

export async function getWorkspaceFileUploadUrl(params: {
  externalUserId: string;
  filePath: string;
  templateId?: string;
}): Promise<UploadUrlResponse> {
  const res = await fetch('/api/files/upload-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok || data.Success === false) {
    throw new Error(data.Message || data.Code || `API error: ${res.status}`);
  }
  return data;
}

export async function deleteWorkspaceFile(params: {
  externalUserId: string;
  filePath: string;
  templateId?: string;
}): Promise<DeleteFileResponse> {
  const res = await fetch('/api/files/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok || data.Success === false) {
    throw new Error(data.Message || data.Code || `API error: ${res.status}`);
  }
  return data;
}

export async function putFileToPresignedUrl(
  uploadUrl: string,
  file: File,
  headers?: Record<string, string>,
): Promise<void> {
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    body: file,
    ...(headers ? { headers } : {}),
  });
  if (!res.ok) {
    throw new Error(`Upload failed: HTTP ${res.status}`);
  }
}

export async function clearUserWorkspace(params: {
  externalUserId: string;
  templateId?: string;
}): Promise<ClearWorkspaceResponse> {
  const res = await fetch('/api/files/clear', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok || data.Success === false || (data.Code && data.Code !== '200' && data.Code !== 'ok')) {
    throw new Error(data.Message || data.Code || `API error: ${res.status}`);
  }
  return {
    Success: true,
    Code: data.Code,
    ExternalUserId: data.ExternalUserId,
    ClearedCount: data.ClearedCount ?? 0,
    FailedCount: data.FailedCount ?? 0,
    Workspaces: Array.isArray(data.Workspaces) ? data.Workspaces : [],
  };
}

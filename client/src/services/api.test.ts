import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getFileUploadUrl,
  getTemplate,
  listTemplates,
  syncContext,
  uploadFileToOSS,
} from './api';

function mockFetch(data: unknown) {
  const fetchMock = vi.fn(async () => ({
    ok: true,
    json: async () => data,
  })) as unknown as typeof fetch;
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock as unknown as ReturnType<typeof vi.fn>;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('api services', () => {
  it('lists templates through the server AK/SK proxy and normalizes template fields', async () => {
    const fetchMock = mockFetch({
      Success: true,
      Code: '200',
      Items: [
        {
          tenant_id: 'tenant-1',
          template_id: 'template-1',
          template_key: 'daily-news',
        },
      ],
    });

    const result = await listTemplates();

    expect(result.Items).toEqual([
      {
        TenantId: 'tenant-1',
        TemplateId: 'template-1',
        TemplateKey: 'daily-news',
      },
    ]);
    expect(fetchMock).toHaveBeenCalledWith('/api/templates/list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
  });

  it('gets template detail through the server AK/SK proxy', async () => {
    const fetchMock = mockFetch({
      Success: true,
      Code: '200',
      TemplateId: 'template-1',
      Skills: { Enabled: [{ Type: 'builtin', SkillId: 'builtin:search' }] },
    });

    const result = await getTemplate('template-1');

    expect(result.TemplateId).toBe('template-1');
    expect(result.Skills?.Enabled).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/templates/get', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ templateId: 'template-1' }),
    });
  });

  it('passes the selected template id to file upload and sync requests', async () => {
    const fetchMock = mockFetch({ Success: true });
    const config = {
      externalUserId: 'user-1',
      templateId: 'template-1',
      templateName: '助理Agent',
    };

    await getFileUploadUrl(config, 'report.pdf');
    await syncContext(config, 'uploads/report.pdf');

    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/file/upload-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        externalUserId: 'user-1',
        fileName: 'report.pdf',
        templateId: 'template-1',
      }),
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/file/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        externalUserId: 'user-1',
        fileKey: 'uploads/report.pdf',
        templateId: 'template-1',
      }),
    });
  });

  it('passes upload header hints when uploading the file to OSS', async () => {
    const fetchMock = mockFetch({ Success: true });
    const upload = uploadFileToOSS as unknown as (
      uploadUrl: string,
      file: Blob,
      uploadHeadersHint?: string,
    ) => Promise<void>;

    await upload(
      'https://oss.example/upload',
      new Blob(['hello']),
      '{"x-oss-meta-source":"jvs"}',
    );

    expect(fetchMock).toHaveBeenCalledWith('https://oss.example/upload', {
      method: 'PUT',
      body: expect.any(Blob),
      headers: {
        'x-oss-meta-source': 'jvs',
      },
    });
  });
});

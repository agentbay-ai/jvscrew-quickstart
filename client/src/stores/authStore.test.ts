import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from './authStore';

function mockFetch() {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({ Success: true, AccessToken: 'jwt-token' }),
    })
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        Success: true,
        Items: [
          {
            tenant_id: 'tenant-1',
            template_id: 'template-default',
            template_key: '默认Agent模板',
          },
        ],
      }),
    }) as unknown as typeof fetch;
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock as unknown as ReturnType<typeof vi.fn>;
}

afterEach(() => {
  useAuthStore.getState().logout();
  vi.unstubAllGlobals();
});

describe('auth store', () => {
  it('selects the first tenant template by default after login', async () => {
    const fetchMock = mockFetch();

    await useAuthStore.getState().login('user-1');

    expect(useAuthStore.getState().config).toMatchObject({
      externalUserId: 'user-1',
      templateId: 'template-default',
      templateName: '默认Agent模板',
    });
    expect(useAuthStore.getState().selectedExpert).toMatchObject({
      id: 'template-default',
      name: '默认Agent模板',
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/auth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        externalUserId: 'user-1',
      }),
    });
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/templates/list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
  });

  it('can refresh the access token for the current user without reloading templates', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ Success: true, AccessToken: 'fresh-token' }),
    })) as unknown as typeof fetch;
    vi.stubGlobal('fetch', fetchMock);
    useAuthStore.setState({
      config: {
        externalUserId: 'user-1',
        templateId: 'template-default',
        templateName: '默认Agent模板',
      },
      accessToken: 'old-token',
      isAuthenticated: true,
    });

    const token = await useAuthStore.getState().refreshAccessToken();

    expect(token).toBe('fresh-token');
    expect(useAuthStore.getState().accessToken).toBe('fresh-token');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ externalUserId: 'user-1' }),
    });
  });
});

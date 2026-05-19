import { describe, expect, it, vi } from 'vitest';
import { listSessions } from '../services/api';
import { loadSessionsForConfig } from './useSession';

vi.mock('../services/api', () => ({
  listSessions: vi.fn(async () => []),
}));

describe('useSession helpers', () => {
  it('loads sessions with a fresh token and the selected template id', async () => {
    const refreshAccessToken = vi.fn(async () => 'fresh-token');

    await loadSessionsForConfig(
      {
        externalUserId: 'user-1',
        templateId: 'template-b',
        templateName: 'Template B',
      },
      refreshAccessToken,
    );

    expect(refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(listSessions).toHaveBeenCalledWith(
      'fresh-token',
      'user-1',
      'template-b',
    );
  });
});

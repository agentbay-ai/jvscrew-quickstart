import { Router } from 'express';
import { popRequest } from '../utils/popRequest.js';

const router = Router();

router.post('/list', async (req, res) => {
  try {
    const { type = 'builtin', templateId, pageNumber, pageSize } = req.body;

    const extra: Record<string, string> = { Type: type };
    if (templateId) extra.TemplateId = templateId;
    if (pageNumber) extra.PageNumber = String(pageNumber);
    if (pageSize) extra.PageSize = String(pageSize);

    const data = await popRequest('ListSkills', extra);
    res.json(data);
  } catch (err) {
    res.status(500).json({
      Success: false,
      Message: err instanceof Error ? err.message : 'Internal error',
    });
  }
});

interface UserSkillEntry {
  id: string;
  name: string;
  description: string;
}

interface WorkspaceFileEntry {
  FileName?: string;
  fileName?: string;
  FileType?: string;
  fileType?: string;
}

function parseSkillFrontmatter(content: string): { name?: string; description?: string } {
  const match = content.match(/^---\s*\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return {};
  const result: { name?: string; description?: string } = {};
  for (const rawLine of match[1].split(/\r?\n/)) {
    const idx = rawLine.indexOf(':');
    if (idx === -1) continue;
    const key = rawLine.slice(0, idx).trim().toLowerCase();
    const value = rawLine.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
    if (key === 'name') result.name = value;
    else if (key === 'description') result.description = value;
  }
  return result;
}

async function fetchText(url: string): Promise<string | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    return await r.text();
  } catch {
    return null;
  }
}

router.post('/user-list', async (req, res) => {
  try {
    const { externalUserId, templateId } = req.body as {
      externalUserId?: string;
      templateId?: string;
    };

    if (!externalUserId) {
      return res.status(400).json({ Success: false, Message: 'externalUserId is required' });
    }

    const common: Record<string, string> = { ExternalUserId: externalUserId };
    if (templateId) common.TemplateId = templateId;

    // Step 1: best-effort sync (ok if there's no active sandbox)
    try {
      await popRequest('SyncWorkspaceFiles', common);
    } catch {
      /* ignore — Context snapshot is still usable */
    }

    // Step 2: list active_skills/
    const listResp = await popRequest('ListWorkspaceFiles', {
      ...common,
      Path: 'active_skills',
      PageSize: '200',
    });

    const rawFiles = (listResp.Files ?? (listResp as Record<string, unknown>).files ?? []) as WorkspaceFileEntry[];
    const allDirs = rawFiles
      .filter((f) => (f.FileType ?? f.fileType) === 'directory')
      .map((f) => f.FileName ?? f.fileName ?? '')
      .filter((name): name is string => !!name);

    if (allDirs.length === 0) {
      return res.json({ Success: true, Skills: [] as UserSkillEntry[] });
    }

    // Step 3: read .managed_skills.json (optional)
    const managedNames = new Set<string>();
    try {
      const managedDl = await popRequest('GetWorkspaceFileDownloadUrl', {
        ...common,
        FilePath: '/active_skills/.managed_skills.json',
      });
      const downloadUrl = managedDl.DownloadUrl as string | undefined;
      if (downloadUrl) {
        const content = await fetchText(downloadUrl);
        if (content) {
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed)) {
            for (const name of parsed) if (typeof name === 'string') managedNames.add(name);
          }
        }
      }
    } catch {
      /* manifest missing — treat all dirs as user skills */
    }

    // Step 4: filter user-created directories
    const userDirs = allDirs.filter((d) => !managedNames.has(d) && !d.startsWith('.'));

    // Step 5: concurrent SKILL.md reads
    const skills: UserSkillEntry[] = await Promise.all(
      userDirs.map(async (dir): Promise<UserSkillEntry> => {
        try {
          const dl = await popRequest('GetWorkspaceFileDownloadUrl', {
            ...common,
            FilePath: `/active_skills/${dir}/SKILL.md`,
          });
          const downloadUrl = dl.DownloadUrl as string | undefined;
          if (!downloadUrl) return { id: dir, name: dir, description: '' };
          const content = await fetchText(downloadUrl);
          if (!content) return { id: dir, name: dir, description: '' };
          const meta = parseSkillFrontmatter(content);
          return {
            id: dir,
            name: meta.name || dir,
            description: meta.description || '',
          };
        } catch {
          return { id: dir, name: dir, description: '' };
        }
      }),
    );

    res.json({ Success: true, Skills: skills });
  } catch (err) {
    res.status(500).json({
      Success: false,
      Message: err instanceof Error ? err.message : 'Internal error',
    });
  }
});

export default router;

import { Router } from 'express';
import { popRequest } from '../utils/popRequest.js';

const router = Router();

router.post('/list', async (req, res) => {
  try {
    const { externalUserId, path, pageSize, pageNumber, templateId } = req.body;

    const extra: Record<string, string> = {};
    if (externalUserId) extra.ExternalUserId = externalUserId;
    if (path) extra.Path = path;
    if (templateId) extra.TemplateId = templateId;
    if (pageNumber) extra.PageNumber = String(pageNumber);
    if (pageSize) extra.PageSize = String(pageSize);

    const data = await popRequest('ListWorkspaceFiles', extra);
    res.json(data);
  } catch (err) {
    res.status(500).json({
      Success: false,
      Message: err instanceof Error ? err.message : 'Internal error',
    });
  }
});

router.post('/sync', async (req, res) => {
  try {
    const { externalUserId, templateId } = req.body;

    const extra: Record<string, string> = {};
    if (externalUserId) extra.ExternalUserId = externalUserId;
    if (templateId) extra.TemplateId = templateId;

    const data = await popRequest('SyncWorkspaceFiles', extra);
    res.json(data);
  } catch (err) {
    res.status(500).json({
      Success: false,
      Message: err instanceof Error ? err.message : 'Internal error',
    });
  }
});

router.post('/download-url', async (req, res) => {
  try {
    const { externalUserId, filePath, templateId } = req.body;

    const extra: Record<string, string> = {};
    if (externalUserId) extra.ExternalUserId = externalUserId;
    if (filePath) extra.FilePath = filePath;
    if (templateId) extra.TemplateId = templateId;

    const data = await popRequest('GetWorkspaceFileDownloadUrl', extra);
    res.json(data);
  } catch (err) {
    res.status(500).json({
      Success: false,
      Message: err instanceof Error ? err.message : 'Internal error',
    });
  }
});

export default router;

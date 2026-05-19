import { Router } from 'express';
import { popRequest } from '../utils/popRequest.js';

const router = Router();

router.post('/upload-url', async (req, res) => {
  const { externalUserId, fileName, templateId } = req.body ?? {};
  if (!externalUserId || !fileName) {
    res.status(400).json({ Success: false, Message: 'Missing required fields' });
    return;
  }

  try {
    const extra: Record<string, string> = {
      ExternalUserId: externalUserId,
      FileName: fileName,
    };
    if (templateId) extra.TemplateId = templateId;

    const data = await popRequest('GetChatFileUploadUrl', extra);
    res.json(data);
  } catch (err) {
    res.status(500).json({
      Success: false,
      Message: err instanceof Error ? err.message : 'Internal error',
    });
  }
});

router.post('/sync', async (req, res) => {
  const { externalUserId, fileKey, templateId } = req.body ?? {};
  if (!externalUserId || !fileKey) {
    res.status(400).json({ Success: false, Message: 'Missing required fields' });
    return;
  }

  try {
    const extra: Record<string, string> = {
      ExternalUserId: externalUserId,
      FileKey: fileKey,
    };
    if (templateId) extra.TemplateId = templateId;

    const data = await popRequest('SyncContext', extra);
    res.json(data);
  } catch (err) {
    res.status(500).json({
      Success: false,
      Message: err instanceof Error ? err.message : 'Internal error',
    });
  }
});

export default router;

import { Router } from 'express';
import { popRequest } from '../utils/popRequest.js';

const router = Router();

router.post('/list', async (_req, res) => {
  try {
    const data = await popRequest('ListTemplates');
    res.json(data);
  } catch (err) {
    res.status(500).json({
      Success: false,
      Message: err instanceof Error ? err.message : 'Internal error',
    });
  }
});

router.post('/get', async (req, res) => {
  const templateId = req.body?.templateId || req.body?.TemplateId;
  if (!templateId) {
    res.status(400).json({ Success: false, Message: 'Missing TemplateId' });
    return;
  }

  try {
    const data = await popRequest('GetTemplate', { TemplateId: String(templateId) });
    res.json(data);
  } catch (err) {
    res.status(500).json({
      Success: false,
      Message: err instanceof Error ? err.message : 'Internal error',
    });
  }
});

export default router;

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

export default router;

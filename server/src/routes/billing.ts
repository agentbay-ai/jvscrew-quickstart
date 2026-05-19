import { Router } from 'express';
import { popRequest } from '../utils/popRequest.js';

const router = Router();

router.post('/overview', async (_req, res) => {
  try {
    const data = await popRequest('GetBillingOverview');
    res.json(data);
  } catch (err) {
    res.status(500).json({
      Success: false,
      Message: err instanceof Error ? err.message : 'Internal error',
    });
  }
});

router.post('/user-consumption', async (req, res) => {
  const { externalUserIds, pageSize, pageNumber } = req.body ?? {};

  try {
    const extra: Record<string, string> = {};
    if (externalUserIds) extra.ExternalUserIds = externalUserIds;
    if (pageSize) extra.PageSize = String(pageSize);
    if (pageNumber) extra.PageNumber = String(pageNumber);

    const data = await popRequest('ListUserConsumption', extra);
    res.json(data);
  } catch (err) {
    res.status(500).json({
      Success: false,
      Message: err instanceof Error ? err.message : 'Internal error',
    });
  }
});

export default router;

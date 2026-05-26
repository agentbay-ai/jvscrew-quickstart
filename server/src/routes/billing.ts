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

router.post('/user-records', async (req, res) => {
  const { externalUserId, templateId, fromDate, toDate, pageSize, pageNumber } = req.body ?? {};

  if (!externalUserId) {
    return res.status(400).json({ Success: false, Message: 'externalUserId is required' });
  }
  if (!fromDate || !toDate) {
    return res.status(400).json({ Success: false, Message: 'fromDate and toDate are required' });
  }

  try {
    const extra: Record<string, string> = {
      ExternalUserId: externalUserId,
      FromDate: fromDate,
      ToDate: toDate,
    };
    if (templateId) extra.TemplateId = templateId;
    if (pageSize) extra.PageSize = String(pageSize);
    if (pageNumber) extra.PageNumber = String(pageNumber);

    const data = await popRequest('GetUserCreditRecords', extra);
    res.json(data);
  } catch (err) {
    res.status(500).json({
      Success: false,
      Message: err instanceof Error ? err.message : 'Internal error',
    });
  }
});

export default router;

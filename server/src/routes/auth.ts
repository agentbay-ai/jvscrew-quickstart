import { Router } from 'express';
import { popRequest } from '../utils/popRequest.js';

const router = Router();

router.post('/token', async (req, res) => {
  const { externalUserId } = req.body ?? {};
  if (!externalUserId) {
    res.status(400).json({ Success: false, Message: 'Missing externalUserId' });
    return;
  }

  try {
    const data = await popRequest('GetAccessToken', { ExternalUserId: externalUserId });
    res.json(data);
  } catch (err) {
    res.status(500).json({
      Success: false,
      Message: err instanceof Error ? err.message : 'Internal error',
    });
  }
});

export default router;

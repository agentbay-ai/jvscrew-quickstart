import { Router } from 'express';
import { popRequest } from '../utils/popRequest.js';

const router = Router();

router.post('/qrcode/create', async (req, res) => {
  try {
    const { externalUserId, templateId, channelType = 'wechat' } = req.body;

    if (!externalUserId) {
      return res.status(400).json({ Success: false, Message: 'externalUserId is required' });
    }
    if (!templateId) {
      return res.status(400).json({ Success: false, Message: 'templateId is required' });
    }

    const data = await popRequest('CreateChannelInstanceQrCode', {
      ChannelType: channelType,
      TemplateId: templateId,
      ExternalUserId: externalUserId,
    });
    res.json(data);
  } catch (err) {
    res.status(500).json({
      Success: false,
      Message: err instanceof Error ? err.message : 'Internal error',
    });
  }
});

router.post('/qrcode/describe', async (req, res) => {
  try {
    const { sessionKey } = req.body;

    if (!sessionKey) {
      return res.status(400).json({ Success: false, Message: 'sessionKey is required' });
    }

    const data = await popRequest('DescribeChannelInstanceQrCode', {
      SessionKey: sessionKey,
    });
    res.json(data);
  } catch (err) {
    res.status(500).json({
      Success: false,
      Message: err instanceof Error ? err.message : 'Internal error',
    });
  }
});

router.post('/list', async (req, res) => {
  try {
    const { channelType, templateId, externalUserId, status, pageSize, pageNumber } = req.body;
    const extra: Record<string, string> = {};
    if (channelType) extra.ChannelType = channelType;
    if (templateId) extra.TemplateId = templateId;
    if (externalUserId) extra.ExternalUserId = externalUserId;
    if (status) extra.Status = status;
    if (pageSize) extra.PageSize = String(pageSize);
    if (pageNumber) extra.PageNumber = String(pageNumber);

    const data = await popRequest('ListChannelInstances', extra);
    res.json(data);
  } catch (err) {
    res.status(500).json({
      Success: false,
      Message: err instanceof Error ? err.message : 'Internal error',
    });
  }
});

export default router;

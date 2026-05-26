import type {
  ChannelType,
  CreateChannelQrCodeResponse,
  DescribeChannelQrCodeResponse,
} from '../types/channels';

export async function createWechatQrCode(params: {
  externalUserId: string;
  templateId: string;
  channelType?: ChannelType;
}): Promise<CreateChannelQrCodeResponse> {
  const res = await fetch('/api/channels/qrcode/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok || data.Success === false) {
    throw new Error(data.Message || data.Code || `API error: ${res.status}`);
  }
  return data;
}

export async function describeWechatQrCode(
  sessionKey: string,
): Promise<DescribeChannelQrCodeResponse> {
  const res = await fetch('/api/channels/qrcode/describe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionKey }),
  });
  const data = await res.json();
  if (!res.ok || data.Success === false) {
    throw new Error(data.Message || data.Code || `API error: ${res.status}`);
  }
  return data;
}

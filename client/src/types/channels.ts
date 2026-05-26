export type ChannelType = 'wechat';
export type QrCodeStatus = 'waiting' | 'scanned' | 'confirmed' | 'expired';

export interface CreateChannelQrCodeResponse {
  Success: boolean;
  Code?: string;
  Message?: string;
  SessionKey: string;
  QrcodeImgUrl?: string;
  QrcodeImgBase64: string;
  ExpiresAt: number;
}

export interface DescribeChannelQrCodeResponse {
  Success: boolean;
  Code?: string;
  Message?: string;
  Status: QrCodeStatus;
  ChannelInstanceId?: string | null;
  ErrCode?: string | null;
  ErrMsg?: string | null;
  ExpiresAt: number;
}

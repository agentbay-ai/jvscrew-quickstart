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

export type ChannelInstanceStatus = 'enabled' | 'disabled' | 'expired';

export interface ChannelInstanceItem {
  ChannelInstanceId: string;
  TenantId?: number;
  TemplateId: string;
  ExternalUserId: string;
  ChannelType: ChannelType;
  Name?: string;
  Status: ChannelInstanceStatus;
  GmtCreate?: string;
  GmtModified?: string;
}

export interface ListChannelInstancesResponse {
  Success: boolean;
  Code?: string;
  Message?: string;
  Channels: ChannelInstanceItem[];
  TotalCount: number;
  PageSize: number;
  PageNumber: number;
}

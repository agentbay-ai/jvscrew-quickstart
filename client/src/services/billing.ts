import type {
  GetUserCreditRecordsResponse,
  ListUserConsumptionResponse,
  UserConsumption,
} from '../types/billing';

export async function getMyConsumption(externalUserId: string): Promise<UserConsumption | null> {
  const res = await fetch('/api/billing/user-consumption', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ externalUserIds: externalUserId, pageSize: 1, pageNumber: 1 }),
  });
  const data: ListUserConsumptionResponse = await res.json();
  if (!res.ok || data.Success === false) {
    throw new Error(data.Message || data.Code || `API error: ${res.status}`);
  }
  const users = Array.isArray(data.Users) ? data.Users : [];
  return users.find((u) => u.ExternalUserId === externalUserId) ?? users[0] ?? null;
}

export async function getMyCreditRecords(params: {
  externalUserId: string;
  fromDate: string;
  toDate: string;
  templateId?: string;
  pageSize?: number;
  pageNumber?: number;
}): Promise<GetUserCreditRecordsResponse> {
  const res = await fetch('/api/billing/user-records', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok || data.Success === false) {
    throw new Error(data.Message || data.Code || `API error: ${res.status}`);
  }
  return {
    ...data,
    Records: Array.isArray(data.Records) ? data.Records : [],
  };
}

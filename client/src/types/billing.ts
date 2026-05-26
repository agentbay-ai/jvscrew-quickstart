export interface UserConsumption {
  UserId: string;
  ExternalUserId: string;
  InstanceId?: string;
  MonthlyCredit: number;
  MonthlySessions: number;
  MonthlyDurationHours: number;
  MonthlyDurationMinutes: number;
}

export interface ListUserConsumptionResponse {
  Success: boolean;
  Code?: string;
  Message?: string;
  Users: UserConsumption[];
  TotalCount: number;
  PageSize: number;
  PageNumber: number;
}

export interface CreditRecord {
  TraceId: string;
  SessionId: string;
  TemplateId?: string | null;
  CreditAmount: number;
  DurationMs: number;
  CreatedAt: string;
}

export interface GetUserCreditRecordsResponse {
  Success: boolean;
  Code?: string;
  Message?: string;
  UserId: string;
  ExternalUserId: string;
  FromDate: string;
  ToDate: string;
  TotalCredit: number;
  TotalCount: number;
  TotalSessionCount: number;
  TotalDurationMs: number;
  PageSize: number;
  PageNumber: number;
  Records: CreditRecord[];
}

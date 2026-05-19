export interface Schedule {
  Type: 'cron' | 'interval';
  Expr: string;
  Timezone: string;
}

export interface Sink {
  Sink: string;
  Channel: string;
  ChannelInstanceId: string;
  TargetUserId: string;
  TargetSessionId: string;
  Meta: Record<string, unknown>;
}

export interface ScheduledTask {
  TaskId: string;
  TemplateId: string;
  ExternalUserId: string;
  Name: string;
  Status: 'active' | 'paused' | 'running' | 'failed';
  Instruction: string;
  Schedule: Schedule;
  Sinks: Sink[];
  NextRunAt?: string;
  LastRunAt?: string;
  LastError?: string;
  CreatedAt: string;
  UpdatedAt: string;
}

export interface TaskRun {
  RunId: string;
  TaskId: string;
  TemplateId: string;
  ExternalUserId: string;
  Status: 'running' | 'succeeded' | 'failed';
  ResultPayload?: string;
  ErrorMessage?: string;
  PushSink?: string;
  PushStatus?: string;
  StartedAt: string;
  FinishedAt?: string;
  CreatedAt: string;
}

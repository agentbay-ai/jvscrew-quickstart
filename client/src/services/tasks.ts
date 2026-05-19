import type { ScheduledTask, TaskRun, Schedule, Sink } from '../types/tasks';
import { popGatewayJson } from './popGateway';

export interface ScheduledTaskPayload {
  Name: string;
  Instruction: string;
  Schedule: Schedule;
  ExternalUserId?: string;
  TemplateId?: string;
  Sinks?: Sink[];
}

export interface UpdateScheduledTaskPayload extends ScheduledTaskPayload {
  TaskId: string;
}

export async function createScheduledTask(
  token: string,
  params: ScheduledTaskPayload,
): Promise<ScheduledTask> {
  return popGatewayJson<ScheduledTask>(token, 'CreateScheduledTask', params);
}

export async function updateScheduledTask(
  token: string,
  params: UpdateScheduledTaskPayload,
): Promise<ScheduledTask> {
  return popGatewayJson<ScheduledTask>(token, 'UpdateScheduledTask', {
    TaskId: params.TaskId,
    Name: params.Name,
    Instruction: params.Instruction,
    Schedule: params.Schedule,
    ExternalUserId: params.ExternalUserId,
    TemplateId: params.TemplateId,
    Sinks: params.Sinks,
  });
}

export async function listScheduledTasks(
  token: string,
  params?: { ExternalUserId?: string; TemplateId?: string; PageNumber?: number; PageSize?: number },
): Promise<{ Tasks: ScheduledTask[]; TotalCount: number; PageNumber: number; PageSize: number }> {
  const body = params ?? {};
  const data = await popGatewayJson<{
    Tasks?: ScheduledTask[];
    TotalCount?: number;
    PageNumber?: number;
    PageSize?: number;
  }>(token, 'ListScheduledTasks', body);
  return {
    Tasks: data.Tasks ?? [],
    TotalCount: data.TotalCount ?? 0,
    PageNumber: data.PageNumber ?? params?.PageNumber ?? 1,
    PageSize: data.PageSize ?? params?.PageSize ?? 20,
  };
}

export async function deleteScheduledTask(
  token: string,
  taskId: string,
): Promise<boolean> {
  const data = await popGatewayJson<{ Deleted?: boolean }>(
    token,
    'DeleteScheduledTask',
    { TaskId: taskId },
  );
  return data.Deleted ?? false;
}

export async function listScheduledTaskRuns(
  token: string,
  params?: {
    ExternalUserId?: string;
    TaskId?: string;
    TemplateId?: string;
    Since?: number;
    PageSize?: number;
    Cursor?: string;
  },
): Promise<{ Runs: TaskRun[]; NextCursor?: string }> {
  const data = await popGatewayJson<{ Runs?: TaskRun[]; NextCursor?: string }>(
    token,
    'ListScheduledTaskRuns',
    params ?? {},
  );
  return { Runs: data.Runs ?? [], NextCursor: data.NextCursor ?? undefined };
}

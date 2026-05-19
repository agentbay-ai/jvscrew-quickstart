import type { Schedule } from '../types/tasks';

export type ScheduleFrequency = 'daily' | 'weekly' | 'interval';
export type IntervalUnit = 'm' | 'h' | 'd';

export interface ScheduleFormState {
  frequency: ScheduleFrequency;
  time: string;
  weekdays: number[];
  intervalValue: number;
  intervalUnit: IntervalUnit;
  timezone: string;
}

const WEEKDAY_LABELS: Record<number, string> = {
  1: '周一',
  2: '周二',
  3: '周三',
  4: '周四',
  5: '周五',
  6: '周六',
  0: '周日',
};

const UNIT_LABELS: Record<IntervalUnit, string> = {
  m: '分钟',
  h: '小时',
  d: '天',
};

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function parseTime(time: string): { hour: number; minute: number } {
  const [hourRaw, minuteRaw] = time.split(':');
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return { hour: 9, minute: 0 };
  }
  return { hour, minute };
}

function formatTime(hour: string | number, minute: string | number): string {
  return `${pad2(Number(hour))}:${pad2(Number(minute))}`;
}

function normalizeWeekdays(days: number[]): number[] {
  return Array.from(new Set(days))
    .filter((day) => day >= 0 && day <= 6)
    .sort((a, b) => {
      const aa = a === 0 ? 7 : a;
      const bb = b === 0 ? 7 : b;
      return aa - bb;
    });
}

function weekdayExpr(days: number[]): string {
  const normalized = normalizeWeekdays(days);
  if (normalized.length === 0) return '1-5';
  if (normalized.join(',') === '1,2,3,4,5') return '1-5';
  if (normalized.join(',') === '1,2,3,4,5,6,0') return '*';
  return normalized.join(',');
}

function labelsFromWeekdayExpr(expr: string): string {
  if (expr === '*') return '每天';
  const days = expr.includes('-')
    ? expandWeekdayRange(expr)
    : expr.split(',').map((item) => Number(item.trim()));
  return normalizeWeekdays(days).map((day) => WEEKDAY_LABELS[day]).join('、');
}

function expandWeekdayRange(expr: string): number[] {
  const [startRaw, endRaw] = expr.split('-');
  const start = Number(startRaw);
  const end = Number(endRaw);
  if (!Number.isInteger(start) || !Number.isInteger(end)) return [];
  const days: number[] = [];
  for (let day = start; day <= end; day += 1) {
    days.push(day % 7);
  }
  return days;
}

export function getDefaultScheduleForm(): ScheduleFormState {
  return {
    frequency: 'daily',
    time: '09:00',
    weekdays: [1, 2, 3, 4, 5],
    intervalValue: 10,
    intervalUnit: 'm',
    timezone: 'Asia/Shanghai',
  };
}

export function buildSchedule(form: ScheduleFormState): Schedule {
  if (form.frequency === 'interval') {
    return {
      Type: 'interval',
      Expr: `${form.intervalValue}${form.intervalUnit}`,
      Timezone: form.timezone,
    };
  }

  const { hour, minute } = parseTime(form.time);
  if (form.frequency === 'weekly') {
    return {
      Type: 'cron',
      Expr: `${minute} ${hour} * * ${weekdayExpr(form.weekdays)}`,
      Timezone: form.timezone,
    };
  }

  return {
    Type: 'cron',
    Expr: `${minute} ${hour} * * *`,
    Timezone: form.timezone,
  };
}

function parseCronStep(field: string): { isStep: boolean; step: number; base: number } {
  const stepMatch = field.match(/^(\d+|\*)\/(\d+)$/);
  if (stepMatch) {
    return { isStep: true, step: Number(stepMatch[2]), base: stepMatch[1] === '*' ? 0 : Number(stepMatch[1]) };
  }
  if (field === '*') {
    return { isStep: true, step: 1, base: 0 };
  }
  return { isStep: false, step: 0, base: Number(field) };
}

function describeCronAsInterval(minute: string, hour: string): string | null {
  const minParsed = parseCronStep(minute);
  const hourParsed = parseCronStep(hour);

  if (minParsed.isStep && minParsed.step > 1 && (hour === '*' || hourParsed.isStep)) {
    return `每 ${minParsed.step} 分钟`;
  }
  if (hourParsed.isStep && hourParsed.step > 1 && minute.match(/^\d+$/)) {
    return `每 ${hourParsed.step} 小时`;
  }
  return null;
}

export function describeSchedule(schedule: Schedule): string {
  if (schedule.Type === 'interval') {
    const match = schedule.Expr.match(/^(\d+)([mhd])$/);
    if (!match) return schedule.Expr;
    return `每 ${match[1]} ${UNIT_LABELS[match[2] as IntervalUnit]}`;
  }

  const parts = schedule.Expr.split(/\s+/);
  if (parts.length < 5) return `${schedule.Expr} (${schedule.Timezone})`;
  const [minute, hour, dayOfMonth, month, weekday] = parts;

  const intervalDesc = describeCronAsInterval(minute, hour);
  if (intervalDesc) {
    if (dayOfMonth === '*' && month === '*' && weekday !== '*') {
      return `${intervalDesc} (${labelsFromWeekdayExpr(weekday)})`;
    }
    return intervalDesc;
  }

  const h = Number(hour);
  const m = Number(minute);
  if (Number.isNaN(h) || Number.isNaN(m)) {
    return `${schedule.Expr} (${schedule.Timezone})`;
  }
  const time = formatTime(h, m);

  if (dayOfMonth === '*' && month === '*' && weekday === '*') {
    return `每天 ${time}`;
  }
  if (dayOfMonth === '*' && month === '*') {
    return `每周 ${labelsFromWeekdayExpr(weekday)} ${time}`;
  }
  if (dayOfMonth !== '*' && month !== '*') {
    return `每年 ${pad2(Number(month))}-${pad2(Number(dayOfMonth))} ${time}`;
  }
  return `${schedule.Expr} (${schedule.Timezone})`;
}

export function getScheduleTitle(form: ScheduleFormState): string {
  if (form.frequency === 'interval') {
    return `每${form.intervalValue}${UNIT_LABELS[form.intervalUnit]}`;
  }
  if (form.frequency === 'weekly') {
    return `每周${labelsFromWeekdayExpr(weekdayExpr(form.weekdays))} ${form.time}`;
  }
  return `每天${form.time}`;
}

export function formFromSchedule(schedule?: Schedule): ScheduleFormState {
  const form = getDefaultScheduleForm();
  if (!schedule) return form;

  form.timezone = schedule.Timezone || form.timezone;
  if (schedule.Type === 'interval') {
    const match = schedule.Expr.match(/^(\d+)([mhd])$/);
    if (match) {
      form.frequency = 'interval';
      form.intervalValue = Number(match[1]);
      form.intervalUnit = match[2] as IntervalUnit;
    }
    return form;
  }

  const parts = schedule.Expr.split(/\s+/);
  if (parts.length < 5) return form;
  const [minute, hour, dayOfMonth, month, weekday] = parts;

  const minParsed = parseCronStep(minute);
  const hourParsed = parseCronStep(hour);

  if (minParsed.isStep && minParsed.step > 1 && (hour === '*' || (hourParsed.isStep && hourParsed.step === 1))) {
    form.frequency = 'interval';
    form.intervalValue = minParsed.step;
    form.intervalUnit = 'm';
    return form;
  }
  if (hourParsed.isStep && hourParsed.step > 1) {
    form.frequency = 'interval';
    form.intervalValue = hourParsed.step;
    form.intervalUnit = 'h';
    return form;
  }

  const h = Number(hour);
  const m = Number(minute);
  if (!Number.isNaN(h) && !Number.isNaN(m)) {
    form.time = formatTime(h, m);
  }

  if (dayOfMonth === '*' && month === '*' && weekday === '*') {
    form.frequency = 'daily';
    return form;
  }
  if (dayOfMonth === '*' && month === '*') {
    form.frequency = 'weekly';
    form.weekdays = weekday.includes('-')
      ? expandWeekdayRange(weekday)
      : weekday.split(',').map((day) => Number(day.trim()));
    return form;
  }
  return form;
}

export function validateScheduleForm(form: ScheduleFormState): string | null {
  if (form.frequency === 'weekly' && form.weekdays.length === 0) {
    return '请选择至少一个星期';
  }
  if (form.frequency === 'interval') {
    const max = form.intervalUnit === 'd' ? 10 : 60;
    if (form.intervalUnit === 'm' && form.intervalValue < 10) {
      return '分钟间隔不能小于 10';
    }
    if (form.intervalValue < 1 || form.intervalValue > max) {
      return `时间间隔范围为 1-${max}`;
    }
  }
  return null;
}

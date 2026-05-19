import { describe, expect, it } from 'vitest';
import {
  buildSchedule,
  describeSchedule,
  getDefaultScheduleForm,
  getScheduleTitle,
  validateScheduleForm,
} from './schedule';

describe('schedule helpers', () => {
  it('builds a daily cron schedule from form state', () => {
    const form = getDefaultScheduleForm();
    form.frequency = 'daily';
    form.time = '09:00';

    expect(buildSchedule(form)).toEqual({
      Type: 'cron',
      Expr: '0 9 * * *',
      Timezone: 'Asia/Shanghai',
    });
    expect(describeSchedule(buildSchedule(form))).toBe('每天 09:00');
  });

  it('builds a weekly cron schedule with selected weekdays', () => {
    const form = getDefaultScheduleForm();
    form.frequency = 'weekly';
    form.time = '09:00';
    form.weekdays = [1, 2, 3, 4, 5];

    expect(buildSchedule(form).Expr).toBe('0 9 * * 1-5');
    expect(describeSchedule(buildSchedule(form))).toBe('每周 周一、周二、周三、周四、周五 09:00');
  });

  it('builds an interval schedule', () => {
    const form = getDefaultScheduleForm();
    form.frequency = 'interval';
    form.intervalValue = 6;
    form.intervalUnit = 'h';

    expect(buildSchedule(form)).toEqual({
      Type: 'interval',
      Expr: '6h',
      Timezone: 'Asia/Shanghai',
    });
    expect(describeSchedule(buildSchedule(form))).toBe('每 6 小时');
  });

  it('only accepts minute intervals from 10 minutes and above', () => {
    const form = getDefaultScheduleForm();
    form.frequency = 'interval';
    form.intervalUnit = 'm';
    form.intervalValue = 9;

    expect(validateScheduleForm(form)).toBe('分钟间隔不能小于 10');

    form.intervalValue = 10;
    expect(validateScheduleForm(form)).toBeNull();
    expect(buildSchedule(form).Expr).toBe('10m');
    expect(getScheduleTitle(form)).toBe('每10分钟');
  });
});

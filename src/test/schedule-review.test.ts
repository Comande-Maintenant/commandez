import { afterEach, describe, expect, it, vi } from 'vitest';
import { canPlaceOrder, checkRestaurantAvailability } from '@/lib/schedule';
import type { DbRestaurant } from '@/types/database';
const day = (day: number, slots: Array<[string, string]>, enabled = true) => ({ day, enabled, slots: slots.map(([open, close]) => ({ open, close })) });
const restaurant = (schedule: unknown[], extra = {}) => ({ availability_mode: 'auto', is_open: false, is_accepting_orders: true, schedule, ...extra }) as DbRestaurant;
const at = (iso: string) => { vi.useFakeTimers(); vi.setSystemTime(new Date(iso)); };
afterEach(() => vi.useRealTimers());
describe('restaurant local schedule independent of visitor timezone', () => {
  it('opens before midnight for a 22:00–02:00 service', () => {
    at('2026-10-02T21:00:00Z'); // Friday 23:00 Paris
    expect(checkRestaurantAvailability(restaurant([day(5, [['22:00', '02:00']])]))).toMatchObject({ isOpen: true, currentCloseTime: '02:00' });
  });
  it('carries Friday night into a disabled Saturday and closes exactly at 02:00', () => {
    const resto = restaurant([day(5, [['22:00', '02:00']]), day(6, [], false)]);
    at('2026-10-02T23:00:00Z'); // Saturday 01:00 Paris
    expect(canPlaceOrder(resto).canOrder).toBe(true);
    at('2026-10-03T00:00:00Z');
    expect(checkRestaurantAvailability(resto).isOpen).toBe(false);
  });
  it('carries Sunday night into Monday', () => {
    at('2026-10-04T23:00:00Z');
    expect(checkRestaurantAvailability(restaurant([day(0, [['22:00', '02:00']])])).isOpen).toBe(true);
  });
  it('sorts remaining and next-day slots before choosing the next opening', () => {
    at('2026-10-02T08:00:00Z');
    const resto = restaurant([day(5, [['19:00', '22:00'], ['12:00', '14:00']]), day(6, [['18:00', '22:00'], ['11:00', '14:00']])]);
    expect(checkRestaurantAvailability(resto)).toMatchObject({ nextOpenInfo: { isToday: true, time: '12:00' }, todaySlots: [{ open: '12:00', close: '14:00' }, { open: '19:00', close: '22:00' }] });
    at('2026-10-02T21:00:00Z');
    expect(checkRestaurantAvailability(resto).nextOpenInfo).toEqual({ isToday: false, dayIndex: 6, time: '11:00' });
  });
  it('uses 24:00 as the end boundary without carrying it into the next day', () => {
    const resto = restaurant([day(5, [['00:00', '24:00']])]);
    at('2026-10-02T21:59:00Z');
    expect(checkRestaurantAvailability(resto).isOpen).toBe(true);
    at('2026-10-02T22:00:00Z');
    expect(checkRestaurantAvailability(resto).isOpen).toBe(false);
  });
  it('uses a configured establishment timezone, including the previous local day', () => {
    at('2026-10-02T01:30:00Z'); // Thursday 21:30 New York
    expect(checkRestaurantAvailability(restaurant([day(4, [['20:00', '23:00']])], { time_zone: 'America/New_York' })).isOpen).toBe(true);
  });
  it('defaults invalid or missing timezones to Paris, including daylight savings transition', () => {
    at('2026-10-25T01:30:00Z'); // Sunday 02:30 Paris after DST fallback
    const schedule = [day(0, [['02:00', '03:00']])];
    expect(checkRestaurantAvailability(restaurant(schedule)).isOpen).toBe(true);
    expect(checkRestaurantAvailability(restaurant(schedule, { time_zone: 'invalid-zone' })).isOpen).toBe(true);
  });
  it('ignores invalid time slots and never mutates the supplied schedule', () => {
    at('2026-10-02T08:00:00Z');
    const schedule = [day(5, [['29:00', '30:00'], ['19:00', '22:00'], ['12:00', '14:00'], ['12:00', '12:00']])];
    const before = JSON.stringify(schedule);
    expect(checkRestaurantAvailability(restaurant(schedule)).nextOpenInfo?.time).toBe('12:00');
    expect(JSON.stringify(schedule)).toBe(before);
  });
  it('preserves manual, always, empty-schedule, demo and accepting switch semantics', () => {
    at('2026-10-02T08:00:00Z');
    expect(checkRestaurantAvailability(restaurant([], { is_open: true })).isOpen).toBe(true);
    expect(checkRestaurantAvailability(restaurant([day(5, [['00:00', '24:00']])], { availability_mode: 'manual' })).isOpen).toBe(false);
    expect(checkRestaurantAvailability(restaurant([], { availability_mode: 'always' })).isOpen).toBe(true);
    expect(canPlaceOrder(restaurant([], { is_demo: true, is_accepting_orders: false })).canOrder).toBe(true);
    expect(canPlaceOrder(restaurant([], { availability_mode: 'always', is_accepting_orders: false }))).toEqual({ canOrder: false, reason: 'schedule.not_accepting' });
  });
});

import { describe, expect, it } from 'vitest';
import { parseGoogleSchedule } from '@/utils/parse-google-hours';
describe('Imported Google opening hours', () => {
  it('supports compact 24-hour ranges and midday breaks', () => {
    const schedule = parseGoogleSchedule(['lundi: 11:00-14:30, 17:30-22:30']);
    expect(schedule.find((day) => day.day === 1)).toEqual({ day: 1, enabled: true, slots: [{ open: '11:00', close: '14:30' }, { open: '17:30', close: '22:30' }] });
  });
  it('keeps restaurants marked open 24 hours open', () => {
    expect(parseGoogleSchedule(['Monday: Open 24 hours'])[1]).toEqual({ day: 1, enabled: true, slots: [{ open: '00:00', close: '24:00' }] });
    expect(parseGoogleSchedule(['lundi: Ouvert 24h/24'])[1].enabled).toBe(true);
  });
  it('keeps separate lunch/dinner slots with English AM/PM and narrow spaces', () => {
    expect(parseGoogleSchedule(['Monday: 11:00\u202fAM\u2009–\u20092:30\u202fPM, 5:30\u2009–\u200910:30\u202fPM'])[1].slots).toEqual([{ open: '11:00', close: '14:30' }, { open: '17:30', close: '22:30' }]);
  });
});

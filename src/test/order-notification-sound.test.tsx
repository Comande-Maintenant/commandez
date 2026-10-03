import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useNotificationSound } from '@/hooks/useNotificationSound';

beforeEach(() => {
  vi.useFakeTimers(); localStorage.clear();
  vi.spyOn(HTMLMediaElement.prototype, 'load').mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue();
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); });

describe('merchant order sound', () => {
  it('keeps the visual notification blinking while the tab is hidden', async () => {
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    const { result } = renderHook(() => useNotificationSound());
    await act(async () => result.current.play());
    await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
    expect(document.title).toBe('Nouvelle commande !');
  });

  it('muting immediately stops a pending repeated alert', async () => {
    const { result } = renderHook(() => useNotificationSound());
    await act(async () => result.current.play());
    expect(result.current.isRepeating).toBe(true);
    const plays = vi.mocked(HTMLMediaElement.prototype.play).mock.calls.length;
    act(() => result.current.setMuted(true));
    expect(result.current.isRepeating).toBe(false);
    await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalledTimes(plays);
  });

  it('recovers a malformed stored volume instead of throwing during order receipt', async () => {
    localStorage.setItem('dashboard-notification-volume', 'broken');
    const { result } = renderHook(() => useNotificationSound());
    expect(result.current.volume).toBe(70);
    await act(async () => result.current.play());
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();
    act(() => result.current.setVolume(200));
    expect(result.current.volume).toBe(100);
  });
});

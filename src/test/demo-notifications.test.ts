import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks=vi.hoisted(()=>({native:vi.fn(()=>true),check:vi.fn(),request:vi.fn(),cancel:vi.fn(),schedule:vi.fn()}));
vi.mock('@/lib/native',()=>({isNative:mocks.native}));
vi.mock('@capacitor/local-notifications',()=>({LocalNotifications:{checkPermissions:mocks.check,requestPermissions:mocks.request,cancel:mocks.cancel,schedule:mocks.schedule}}));
import { scheduleDemoNotification } from '@/services/demo-notifications';
const message={title:'CommandeIci · Demo',body:'Sample order'};
beforeEach(()=>{vi.clearAllMocks();mocks.native.mockReturnValue(true);mocks.check.mockResolvedValue({display:'granted'});mocks.cancel.mockResolvedValue({});mocks.schedule.mockResolvedValue({});});
describe('explicit local demo notification',()=>{
 it('never asks a browser for native permission',async()=>{mocks.native.mockReturnValue(false);expect(await scheduleDemoNotification(message)).toBe('browser');expect(mocks.check).not.toHaveBeenCalled();});
 it('does not schedule after permission is refused',async()=>{mocks.check.mockResolvedValue({display:'denied'});expect(await scheduleDemoNotification(message)).toBe('denied');expect(mocks.request).not.toHaveBeenCalled();expect(mocks.schedule).not.toHaveBeenCalled();});
 it('requests permission only when needed and refuses a denied response',async()=>{mocks.check.mockResolvedValue({display:'prompt'});mocks.request.mockResolvedValue({display:'denied'});expect(await scheduleDemoNotification(message)).toBe('denied');expect(mocks.request).toHaveBeenCalledTimes(1);expect(mocks.schedule).not.toHaveBeenCalled();});
 it('replaces its previous one-shot without touching real notifications or customer data',async()=>{const started=Date.now();expect(await scheduleDemoNotification(message)).toBe('scheduled');const notification=mocks.schedule.mock.calls[0][0].notifications[0];expect(notification).toMatchObject({title:message.title,body:message.body,extra:{demo:true}});expect(notification.schedule.at.getTime()).toBeGreaterThanOrEqual(started+10000);expect(mocks.cancel).toHaveBeenCalledWith({notifications:[{id:notification.id}]});expect(mocks.request).not.toHaveBeenCalled();expect(notification).not.toHaveProperty('repeats');});
});

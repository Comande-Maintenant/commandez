import { describe, expect, it, vi } from 'vitest';
import { createNativeBilling, nativePurchasesEnabled } from '@/services/native-billing';

const first = '00000000-0000-4000-8000-000000000001';
const second = '00000000-0000-4000-8000-000000000002';
const mockSDK = () => ({
  configure: vi.fn().mockResolvedValue(undefined),
  logIn: vi.fn().mockResolvedValue({}),
  logOut: vi.fn().mockResolvedValue({}),
  getCustomerInfo: vi.fn().mockResolvedValue({ customerInfo: { entitlements: { active: {} } } }),
});

describe('native billing during the free launch', () => {
  it('never enables purchases, including after 2027', () => {
    expect(nativePurchasesEnabled()).toBe(false);
  });
  it('does not create guest customers or initialize on web / missing Apple key', async () => {
    for (const config of [{ native: false, apiKey: 'appl_test' }, { native: true, apiKey: '' }, { native: true, apiKey: 'test_test' }]) {
      const sdk = mockSDK();
      const billing = createNativeBilling({ ...config, sdk });
      await billing.sync(first);
      expect(sdk.configure).not.toHaveBeenCalled();
    }
    const sdk = mockSDK();
    await createNativeBilling({ native: true, apiKey: 'appl_test', sdk }).sync(null);
    expect(sdk.configure).not.toHaveBeenCalled();
  });
  it('identifies customers by auth UUID only and reads state without presenting purchases', async () => {
    const sdk = mockSDK();
    const billing = createNativeBilling({ native: true, apiKey: 'appl_test', sdk });
    await billing.sync(first);
    expect(sdk.configure).toHaveBeenCalledWith(expect.objectContaining({ apiKey: 'appl_test', appUserID: first, automaticDeviceIdentifierCollectionEnabled: false, shouldShowInAppMessagesAutomatically: false }));
    await billing.sync(first);
    expect(sdk.configure).toHaveBeenCalledTimes(1);
    expect(sdk.logIn).not.toHaveBeenCalled();
    expect(sdk.getCustomerInfo).toHaveBeenCalledTimes(2);
  });
  it('serializes account changes and logs out before switching accounts', async () => {
    const sdk = mockSDK();
    const billing = createNativeBilling({ native: true, apiKey: 'appl_test', sdk });
    await Promise.all([billing.sync(first), billing.sync(second), billing.sync(null)]);
    expect(sdk.logIn).toHaveBeenCalledWith({ appUserID: second });
    expect(sdk.logOut).toHaveBeenCalledTimes(2);
    expect(sdk.logOut.mock.invocationCallOrder[0]).toBeLessThan(sdk.logIn.mock.invocationCallOrder[0]);
    expect(sdk.logIn.mock.invocationCallOrder[0]).toBeLessThan(sdk.logOut.mock.invocationCallOrder[1]);
  });
  it('does not send an email or arbitrary identifier to RevenueCat', async () => {
    const sdk = mockSDK();
    const billing = createNativeBilling({ native: true, apiKey: 'appl_test', sdk });
    await billing.sync('someone@example.com');
    expect(sdk.configure).not.toHaveBeenCalled();
  });
  it('keeps free access on SDK failures and retries configuration on the next session event', async () => {
    const sdk = mockSDK();
    sdk.configure.mockRejectedValueOnce(new Error('offline'));
    const billing = createNativeBilling({ native: true, apiKey: 'appl_test', sdk });
    await expect(billing.sync(first)).resolves.toBe('unavailable');
    await expect(billing.sync(first)).resolves.toBe('connected');
    expect(sdk.configure).toHaveBeenCalledTimes(2);
  });
  it('does not attach a second account if isolation via logOut failed', async () => {
    const sdk = mockSDK();
    const billing = createNativeBilling({ native: true, apiKey: 'appl_test', sdk });
    await billing.sync(first);
    sdk.logOut.mockRejectedValueOnce(new Error('offline'));
    expect(await billing.sync(second)).toBe('unavailable');
    expect(sdk.logIn).not.toHaveBeenCalled();
    await billing.sync(second);
    expect(sdk.logIn).toHaveBeenCalledWith({ appUserID: second });
  });
});

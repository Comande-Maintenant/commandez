import { Purchases, type PurchasesConfiguration } from '@revenuecat/purchases-capacitor';
import { Capacitor } from '@capacitor/core';

// A future paid launch requires a new release and an explicit subscription.
// Time, remote offerings and customer entitlements cannot enable a purchase.
export const nativePurchasesEnabled = (): false => false;

interface BillingSDK {
  configure(configuration: PurchasesConfiguration): Promise<void>;
  logIn(options: { appUserID: string }): Promise<unknown>;
  logOut(): Promise<unknown>;
  getCustomerInfo(): Promise<unknown>;
}

export function createNativeBilling({ native, apiKey, sdk }: { native: boolean; apiKey: string; sdk: BillingSDK }) {
  let configured = false;
  let currentUser: string | null = null;
  let queue: Promise<unknown> = Promise.resolve();
  const enabled = native && apiKey.startsWith('appl_');
  const validUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  const sync = (userID: string | null): Promise<'connected' | 'idle' | 'unavailable'> => {
    const run = async (): Promise<'connected' | 'idle' | 'unavailable'> => {
      if (!enabled || (userID !== null && !validUUID.test(userID))) return 'idle';
      try {
        if (!configured) {
          if (!userID) return 'idle';
          await sdk.configure({
            apiKey, appUserID: userID,
            automaticDeviceIdentifierCollectionEnabled: false,
            shouldShowInAppMessagesAutomatically: false,
            diagnosticsEnabled: false,
            useExternalPurchaseCustomLinks: false,
          });
          configured = true;
          currentUser = userID;
        } else if (userID !== currentUser) {
          // Reset SDK cache before associating another auth account. No linking
          // of unrelated accounts or adoption of an old account's purchases.
          if (currentUser) {
            await sdk.logOut();
            currentUser = null;
          }
          if (userID) {
            await sdk.logIn({ appUserID: userID });
            currentUser = userID;
          }
        }
        if (!userID) return 'idle';
        await sdk.getCustomerInfo();
        return 'connected';
      } catch {
        // Auth and the free app never wait for or depend on billing success.
        // Another session/resume/network event retries without a crash.
        return 'unavailable';
      }
    };
    const pending = queue.then(run, run);
    queue = pending;
    return pending;
  };
  return { sync };
}

export const nativeBilling = createNativeBilling({
  native: Capacitor.getPlatform() === 'ios',
  apiKey: import.meta.env.VITE_REVENUECAT_IOS_API_KEY || '',
  sdk: Purchases,
});

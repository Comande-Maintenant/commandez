export type PushStatus = 'idle' | 'prompt' | 'denied' | 'enabling' | 'enabled' | 'error';
type Handle = { remove(): Promise<void> };
interface PushSDK {
  checkPermissions(): Promise<{ receive: string }>;
  requestPermissions(): Promise<{ receive: string }>;
  register(): Promise<void>;
  unregister(): Promise<void>;
  removeAllDeliveredNotifications(): Promise<void>;
  addListener(event: 'registration', callback: (event: { value: string }) => void): Promise<Handle>;
  addListener(event: 'registrationError', callback: (event: { error: string }) => void): Promise<Handle>;
}
interface Options {
  native: boolean;
  environment: 'production' | 'sandbox';
  sdk: PushSDK;
  register(token: string, environment: string): Promise<void>;
  revoke(token: string): Promise<void>;
  storage: { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void>; removeItem(key: string): Promise<void> };
  onChange(status: PushStatus): void;
}
const tokenKey = 'commandeici_push_token';
const validToken = (value: string) => /^[a-f0-9]{64,200}$/i.test(value);
export function createNativePush(options: Options) {
  let user: string | null = null;
  let state: PushStatus = 'idle';
  let initialized = false;
  let suspended = false;
  let allowed = false;
  let registrationTimer: ReturnType<typeof setTimeout> | undefined;
  const clearRegistrationTimer = () => { if (registrationTimer) clearTimeout(registrationTimer); registrationTimer = undefined; };
  const requestRegistration = async () => {
    clearRegistrationTimer();
    registrationTimer = setTimeout(() => { if (user && !suspended && state === 'enabling') set('error'); }, 20000);
    await options.sdk.register();
  };
  let queue: Promise<unknown> = Promise.resolve();
  const handles: Handle[] = [];
  const set = (value: PushStatus) => { state = value; options.onChange(value); };
  const serial = <T>(run: () => Promise<T>): Promise<T> => {
    const result = queue.then(run, run); queue = result; return result;
  };
  const saveToken = (value: string) => serial(async () => {
    if (!user || suspended || !allowed || !validToken(value)) return;
    clearRegistrationTimer();
    try {
      await options.storage.setItem(tokenKey, value);
      await options.register(value, options.environment);
      if (user && !suspended) set('enabled');
    } catch { set('error'); }
  });
  const init = async () => {
    if (initialized) return;
    const registration = await options.sdk.addListener('registration', event => saveToken(event.value));
    try {
      const error = await options.sdk.addListener('registrationError', () => { if (user && !suspended) { clearRegistrationTimer(); set('error'); } });
      handles.push(registration, error); initialized = true;
    } catch (error) { await registration.remove(); throw error; }
  };
  const suspend = () => {
    // Stop accepting late registration events immediately, even if another
    // registration/request is in flight. Server revocation uses the old session.
    suspended = true; allowed = false; clearRegistrationTimer(); set('idle');
    return serial(async () => {
      if (!options.native) return;
      await options.sdk.unregister();
      await options.sdk.removeAllDeliveredNotifications();
      const token = await options.storage.getItem(tokenKey);
      if (token && validToken(token)) await options.revoke(token);
      await options.storage.removeItem(tokenKey);
      user = null;
    });
  };
  return {
    status: () => state,
    sync: (nextUser: string | null) => {
      if (!nextUser) { suspended = true; allowed = false; clearRegistrationTimer(); }
      return serial(async () => {
      if (!options.native) return;
      if (!nextUser) {
        if (initialized) { await options.sdk.unregister(); await options.sdk.removeAllDeliveredNotifications(); }
        user = null; allowed = false; set('idle'); return;
      }
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(nextUser)) return;
      if (user !== nextUser) {
        if (user) { await options.sdk.unregister(); await options.sdk.removeAllDeliveredNotifications(); }
        user = nextUser; suspended = false; allowed = false;
      }
      try {
        await init();
        const permission = await options.sdk.checkPermissions();
        allowed = permission.receive === 'granted';
        if (allowed && !suspended) { set('enabling'); await requestRegistration(); }
        else set(permission.receive === 'denied' ? 'denied' : 'prompt');
      } catch { set('error'); }
    }); },
    enable: () => serial(async () => {
      if (!options.native || !user || suspended) return;
      try {
        await init(); set('enabling');
        const permission = await options.sdk.requestPermissions();
        if (suspended || !user) return;
        allowed = permission.receive === 'granted';
        if (allowed) await requestRegistration();
        else set('denied');
      } catch { set('error'); }
    }),
    suspend,
    dispose: () => serial(async () => { clearRegistrationTimer(); for (const handle of handles.splice(0)) await handle.remove(); initialized = false; }),
  };
}
export function notificationRoute(data: Record<string, unknown>, ownedSlugs: string[]): string | null {
  const slug = data.restaurant_slug;
  if (data.type !== 'new_order' || typeof slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || !ownedSlugs.includes(slug)) return null;
  return `/admin/${slug}?view=cuisine`;
}

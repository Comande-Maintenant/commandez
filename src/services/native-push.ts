export type PushStatus = 'idle' | 'prompt' | 'denied' | 'enabling' | 'enabled' | 'error';
export interface PushInstallation { id: string; secret: string }
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
  installation(create: boolean): Promise<PushInstallation | null>;
  initialize(installation: PushInstallation, signal: AbortSignal): Promise<void>;
  resetInstallation(): Promise<void>;
  register(token: string, environment: string, installation: PushInstallation, signal: AbortSignal): Promise<void>;
  revoke(installation: PushInstallation, signal: AbortSignal): Promise<void>;
  storage: { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void>; removeItem(key: string): Promise<void> };
  onChange(status: PushStatus): void;
}
const tokenKey = 'commandeici_push_token';
const validToken = (value: string) => /^[a-f0-9]{64,200}$/i.test(value);
const validUser = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
// Abort the HTTP request as well as releasing the client queue. Server RPCs
// also impose a statement deadline; an unconfirmed operation never looks ready.
async function bounded<T>(operation: (signal: AbortSignal) => Promise<T>, milliseconds = 10000): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  try {
    return await Promise.race([operation(controller.signal), new Promise<never>((_, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(new Error('Notification connection timed out')); }, milliseconds);
    })]);
  } finally { clearTimeout(timer!); }
}
export function createNativePush(options: Options) {
  let user: string | null = null;
  let desiredUser: string | null = null;
  let needsCleanup = false;
  let state: PushStatus = 'idle';
  let initialized = false;
  let suspended = false;
  let allowed = false;
  let generation = 0;
  let authorizedGeneration: number | null = null;
  let registrationTimer: ReturnType<typeof setTimeout> | undefined;
  let queue: Promise<unknown> = Promise.resolve();
  const handles: Handle[] = [];
  const set = (value: PushStatus) => { state = value; options.onChange(value); };
  const clearTimer = () => { if (registrationTimer) clearTimeout(registrationTimer); registrationTimer = undefined; };
  const serial = <T>(run: () => Promise<T>): Promise<T> => {
    const result = queue.then(run, run); queue = result; return result;
  };
  const requestRegistration = async () => {
    clearTimer(); authorizedGeneration = null;
    registrationTimer = setTimeout(() => { if (user && !suspended && state === 'enabling') set('error'); }, 20000);
    const current = generation;
    const identity = await bounded(() => options.installation(true));
    if (!identity) throw new Error('Device identity unavailable');
    await bounded(signal => options.initialize(identity, signal));
    if (current !== generation || suspended || !user) return;
    authorizedGeneration = current;
    await bounded(() => options.sdk.register());
  };
  const saveToken = (value: string) => serial(async () => {
    if (!user || suspended || !allowed || authorizedGeneration !== generation || !validToken(value)) return;
    const current = generation;
    clearTimer();
    try {
      const installation = await bounded(() => options.installation(true));
      if (!installation) throw new Error('Device identity unavailable');
      await bounded(() => options.storage.setItem(tokenKey, value));
      await bounded(signal => options.register(value, options.environment, installation, signal));
      if (user && !suspended && current === generation) set('enabled');
    } catch { if (current === generation && !suspended) set('error'); }
  });
  const init = async () => {
    if (initialized) return;
    const registration = await bounded(() => options.sdk.addListener('registration', event => saveToken(event.value)));
    try {
      const error = await bounded(() => options.sdk.addListener('registrationError', () => {
        if (user && !suspended) { clearTimer(); set('error'); }
      }));
      handles.push(registration, error); initialized = true;
    } catch (error) { await registration.remove(); throw error; }
  };
  const cleanup = async () => {
    needsCleanup = true; authorizedGeneration = null;
    let failure: unknown;
    let installation: PushInstallation | null = null;
    try { installation = await bounded(() => options.installation(false)); } catch (error) { failure = error; }
    if (installation) {
      try { await bounded(signal => options.revoke(installation!, signal)); } catch (error) { failure ??= error; }
    }
    // Each cleanup is attempted independently: losing network must not prevent
    // iOS unregistration, and an iOS error must not leave the server lease active.
    if (initialized || installation) {
      try { await bounded(() => options.sdk.unregister()); } catch (error) { failure ??= error; }
      try { await bounded(() => options.sdk.removeAllDeliveredNotifications()); } catch (error) { failure ??= error; }
    }
    if (failure) throw failure;
    await bounded(() => options.storage.removeItem(tokenKey));
    await bounded(() => options.resetInstallation());
    needsCleanup = false;
  };
  const suspend = () => {
    suspended = true; allowed = false; generation++; clearTimer(); set('idle');
    return serial(async () => {
      if (!options.native) return;
      try { await cleanup(); user = null; }
      catch (error) { suspended = false; set('error'); throw error; }
    });
  };
  return {
    status: () => state,
    sync: (nextUser: string | null) => {
      if (nextUser && !validUser(nextUser)) return Promise.resolve();
      desiredUser = nextUser;
      if (!nextUser) { suspended = true; allowed = false; generation++; clearTimer(); }
      return serial(async () => {
        if (!options.native || (nextUser && !validUser(nextUser))) return;
        try {
          if (!nextUser) { await cleanup(); user = null; set('idle'); return; }
          if (user !== nextUser || needsCleanup) {
            generation++;
            await cleanup();
            user = nextUser; suspended = false; allowed = false;
          }
          await init();
          const permission = await bounded(() => options.sdk.checkPermissions());
          allowed = permission.receive === 'granted';
          if (allowed && !suspended) { set('enabling'); await requestRegistration(); }
          else set(permission.receive === 'denied' ? 'denied' : 'prompt');
        } catch { suspended = false; set('error'); }
      });
    },
    enable: () => serial(async () => {
      if (!options.native || !desiredUser || suspended) return;
      try {
        if (needsCleanup || user !== desiredUser) {
          generation++; await cleanup(); user = desiredUser; allowed = false;
        }
        await init(); set('enabling');
        const permission = await options.sdk.requestPermissions();
        if (suspended || !user) return;
        allowed = permission.receive === 'granted';
        if (allowed) await requestRegistration(); else set('denied');
      } catch { set('error'); }
    }),
    suspend,
    dispose: () => serial(async () => { clearTimer(); for (const handle of handles.splice(0)) await handle.remove(); initialized = false; }),
  };
}
export function notificationRoute(data: Record<string, unknown>, ownedSlugs: string[]): string | null {
  const slug = data.restaurant_slug;
  if (data.type !== 'new_order' || typeof slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || !ownedSlugs.includes(slug)) return null;
  return `/admin/${slug}?view=cuisine`;
}

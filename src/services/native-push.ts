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
  const isCurrent = (current: number, identity: string | null) => current === generation && identity === desiredUser;
  const requestRegistration = async () => {
    clearTimer(); authorizedGeneration = null;
    const current = generation;
    const identityUser = user;
    registrationTimer = setTimeout(() => { if (isCurrent(current, identityUser) && user && !suspended && state === 'enabling') set('error'); }, 20000);
    const identity = await bounded(() => options.installation(true));
    if (!isCurrent(current, identityUser) || suspended || !user) return;
    if (!identity) throw new Error('Device identity unavailable');
    await bounded(signal => options.initialize(identity, signal));
    if (!isCurrent(current, identityUser) || suspended || !user) return;
    authorizedGeneration = current;
    await bounded(() => options.sdk.register());
  };
  const saveToken = (value: string) => {
    const current = generation;
    const identityUser = user;
    return serial(async () => {
      if (!isCurrent(current, identityUser) || !user || suspended || !allowed || authorizedGeneration !== generation || !validToken(value)) return;
      clearTimer();
      try {
        const installation = await bounded(() => options.installation(true));
        if (!isCurrent(current, identityUser) || suspended) return;
        if (!installation) throw new Error('Device identity unavailable');
        await bounded(() => options.storage.setItem(tokenKey, value));
        if (!isCurrent(current, identityUser) || suspended) return;
        await bounded(signal => options.register(value, options.environment, installation, signal));
        if (isCurrent(current, identityUser) && user && !suspended) set('enabled');
      } catch { if (isCurrent(current, identityUser) && !suspended) set('error'); }
    });
  };
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
    const current = generation;
    return serial(async () => {
      if (!options.native) return;
      try { await cleanup(); user = null; }
      catch (error) { if (current === generation) { suspended = false; set('error'); } throw error; }
    });
  };
  return {
    status: () => state,
    sync: (nextUser: string | null) => {
      if (nextUser && !validUser(nextUser)) return Promise.resolve();
      // Identity changes invalidate in-flight work before it can complete. The
      // queue still revokes the previous installation before starting the next.
      if (nextUser !== desiredUser || !nextUser) {
        suspended = true; allowed = false; authorizedGeneration = null;
        needsCleanup = true;
        generation++; clearTimer();
        if (options.native) set('idle');
      }
      desiredUser = nextUser;
      const current = generation;
      return serial(async () => {
        if (!options.native || !isCurrent(current, nextUser)) return;
        try {
          if (!nextUser) { await cleanup(); user = null; set('idle'); return; }
          if (user !== nextUser || needsCleanup || suspended) {
            await cleanup();
            if (!isCurrent(current, nextUser)) return;
            user = nextUser; suspended = false; allowed = false;
          }
          await init();
          if (!isCurrent(current, nextUser)) return;
          const permission = await bounded(() => options.sdk.checkPermissions());
          if (!isCurrent(current, nextUser)) return;
          allowed = permission.receive === 'granted';
          if (allowed && !suspended) { set('enabling'); await requestRegistration(); }
          else set(permission.receive === 'denied' ? 'denied' : 'prompt');
        } catch { if (isCurrent(current, nextUser)) { suspended = false; set('error'); } }
      });
    },
    enable: () => {
      const current = generation;
      const identityUser = desiredUser;
      return serial(async () => {
        if (!options.native || !identityUser || suspended || !isCurrent(current, identityUser)) return;
        try {
          if (needsCleanup || user !== identityUser) {
            await cleanup();
            if (!isCurrent(current, identityUser)) return;
            user = identityUser; allowed = false;
          }
          await init();
          if (!isCurrent(current, identityUser)) return;
          set('enabling');
          const permission = await options.sdk.requestPermissions();
          if (!isCurrent(current, identityUser) || suspended || !user) return;
          allowed = permission.receive === 'granted';
          if (allowed) await requestRegistration(); else set('denied');
        } catch { if (isCurrent(current, identityUser) && !suspended) set('error'); }
      });
    },
    suspend,
    dispose: () => serial(async () => { clearTimer(); for (const handle of handles.splice(0)) await handle.remove(); initialized = false; }),
  };
}
export function notificationRoute(data: Record<string, unknown>, ownedSlugs: string[]): string | null {
  const slug = data.restaurant_slug;
  if (data.type !== 'new_order' || typeof slug !== 'string' || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || !ownedSlugs.includes(slug)) return null;
  return `/admin/${slug}?view=cuisine`;
}

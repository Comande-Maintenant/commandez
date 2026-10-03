import { LocalNotifications } from '@capacitor/local-notifications';
import { isNative } from '@/lib/native';
export type DemoNotificationResult = 'scheduled' | 'denied' | 'browser';
// Deliberately local, one shot, no APNs registration and no restaurant identity.
// The delay lets the tester lock the iPhone before the banner arrives.
export async function scheduleDemoNotification(message: {title:string;body:string}): Promise<DemoNotificationResult> {
  if (!isNative()) return 'browser';
  let permission=await LocalNotifications.checkPermissions();
  if(permission.display==='prompt')permission=await LocalNotifications.requestPermissions();
  if(permission.display!=='granted')return 'denied';
  const id=1701003;
  await LocalNotifications.cancel({notifications:[{id}]});
  await LocalNotifications.schedule({notifications:[{id,title:message.title,body:message.body,sound:'default',schedule:{at:new Date(Date.now()+10000)},extra:{demo:true}}]});
  return 'scheduled';
}

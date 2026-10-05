import type { CapacitorConfig } from '@capacitor/cli';
const config: CapacitorConfig = {
  appId: 'com.commandeici.app',
  appName: 'CommandeIci',
  webDir: 'dist',
  loggingBehavior: 'none',
  ios: { contentInset: 'never', preferredContentMode: 'mobile' },
  plugins: { Keyboard: { resize: 'native' }, PushNotifications: { presentationOptions: ['badge', 'sound', 'alert'] } },
};
export default config;

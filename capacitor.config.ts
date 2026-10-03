import type { CapacitorConfig } from '@capacitor/cli';
const config: CapacitorConfig = {
  appId: 'com.commandeici.app',
  appName: 'CommandeIci',
  webDir: 'dist',
  loggingBehavior: 'none',
  ios: { contentInset: 'automatic', preferredContentMode: 'mobile' },
  plugins: { Keyboard: { resize: 'body' }, PushNotifications: { presentationOptions: ['badge'] } },
};
export default config;

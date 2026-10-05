import { createContext, useContext } from 'react';
// Web routes and components rendered outside the native lifecycle are already ready.
export const NativeLaunchContext = createContext(true);
export const useNativeLaunchReady = () => useContext(NativeLaunchContext);

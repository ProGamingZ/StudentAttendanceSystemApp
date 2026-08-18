import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';
import { syncQueue } from '../services/syncService';

export const useNetworkSync = () => {
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      // @ts-ignore
      setIsOnline(state.isConnected);
      if (state.isConnected) {
        syncQueue(); 
      }
    });
    return () => unsubscribe();
  }, []);

  return isOnline;
};
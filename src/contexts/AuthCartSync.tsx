import React, { useEffect, useRef } from 'react';
import { useAuth } from './AuthContext';
import { useCart } from './CartContext';

interface AuthCartSyncProps {
  children: React.ReactNode;
}

// Component to synchronize auth state with cart mode
export const AuthCartSync: React.FC<AuthCartSyncProps> = ({ children }) => {
  const { isGuest, isLoading } = useAuth();
  const { switchToGuestMode, switchToAuthMode } = useCart();
  const lastSyncState = useRef<{ isGuest: boolean | null; synced: boolean }>({ 
    isGuest: null, 
    synced: false 
  });

  useEffect(() => {
    if (!isLoading && (!lastSyncState.current.synced || lastSyncState.current.isGuest !== isGuest)) {
      if (isGuest) {
        console.log('🛒 Switching to guest cart mode');
        switchToGuestMode();
      } else {
        console.log('🛒 Switching to authenticated cart mode');
        switchToAuthMode();
      }
      
      lastSyncState.current = { isGuest, synced: true };
    }
  }, [isGuest, isLoading]);

  return <>{children}</>;
};

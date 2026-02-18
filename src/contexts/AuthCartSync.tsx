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
    console.log('[AuthCartSync] Effect triggered - isGuest:', isGuest, 'isLoading:', isLoading, 'lastSync:', lastSyncState.current);
    
    if (isLoading) {
      console.log('[AuthCartSync] Still loading, skipping sync');
      return;
    }
    
    // Only sync if this is the first sync OR if guest status actually changed
    const needsSync = !lastSyncState.current.synced || lastSyncState.current.isGuest !== isGuest;
    
    if (needsSync) {
      console.log('[AuthCartSync] Guest status changed, syncing cart mode...');
      if (isGuest) {
        console.log('🛒 Switching to guest cart mode');
        switchToGuestMode();
      } else {
        console.log('🛒 Switching to authenticated cart mode');
        switchToAuthMode();
      }
      
      lastSyncState.current = { isGuest, synced: true };
    } else {
      console.log('[AuthCartSync] No sync needed');
    }
  }, [isGuest, isLoading]);

  return <>{children}</>;
};

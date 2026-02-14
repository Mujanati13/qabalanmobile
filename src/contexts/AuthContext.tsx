import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import ApiService, { User, LoginCredentials, RegisterData } from '../services/apiService';
import notificationService from '../services/notificationService';
import guestOrderService from '../services/guestOrderService';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isGuest: boolean;
  pendingProfileCompletion: boolean;
  setPendingProfileCompletion: (value: boolean) => void;
  login: (credentials: LoginCredentials) => Promise<{ success: boolean; message: string }>;
  register: (data: RegisterData) => Promise<{ success: boolean; message: string; requiresVerification?: boolean }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateUser: (userData: User) => void;
  continueAsGuest: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);
  const [pendingProfileCompletion, setPendingProfileCompletion] = useState(false);

  useEffect(() => {
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    try {
      setIsLoading(true);
      const currentUser = await ApiService.getCurrentUser();
      
      if (currentUser && ApiService.isAuthenticated()) {
        setUser(currentUser);
        setIsGuest(false);
        
        // Register any pending FCM token for already authenticated users
        try {
          await notificationService.registerPendingToken();
        } catch (error) {
          console.log('⚠️ Failed to register pending FCM token:', error);
        }
      } else {
        // Clear any stale data
        await ApiService.logout();
        setUser(null);
        // Don't set isGuest to true here - let user choose
      }
    } catch (error) {
      console.error('Auth initialization error:', error);
      setUser(null);
      setIsGuest(false);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (credentials: LoginCredentials): Promise<{ success: boolean; message: string }> => {
    try {
      // Don't set isLoading here to prevent navigation changes during login
      const response = await ApiService.login(credentials);
      
      if (response.success && response.data?.user) {
        setUser(response.data.user);
        
        // Register any pending FCM token after successful login
        try {
          await notificationService.registerPendingToken();
        } catch (error) {
          console.error('Failed to register FCM token after login:', error);
        }
        
        return { success: true, message: 'Login successful' };
      } else {
        return { success: false, message: response.message || 'Login failed' };
      }
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, message: 'Network error. Please try again.' };
    }
  };

  const register = async (data: RegisterData): Promise<{ success: boolean; message: string; requiresVerification?: boolean }> => {
    try {
      setIsLoading(true);
      const response = await ApiService.register(data);
      
      if (response.success) {
        return { 
          success: true, 
          message: response.message,
          requiresVerification: response.data?.verification_required 
        };
      } else {
        return { success: false, message: response.message || 'Registration failed' };
      }
    } catch (error) {
      console.error('Registration error:', error);
      return { success: false, message: 'Network error. Please try again.' };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    try {
      setIsLoading(true);
      
      // Clear FCM token before logout
      try {
        await notificationService.clearToken();
      } catch (error) {
        console.error('Failed to clear FCM token during logout:', error);
      }
      
      // Clear guest session data if user was in guest mode
      if (isGuest) {
        try {
          await guestOrderService.clearGuestSession();
          console.log('✅ Guest session data cleared on logout');
        } catch (error) {
          console.error('❌ Failed to clear guest session data:', error);
        }
      }
      
      await ApiService.logout();
      setUser(null);
      setIsGuest(false);
    } catch (error) {
      console.error('Logout error:', error);
      // Still clear user state even if logout request fails
      setUser(null);
      setIsGuest(false);
    } finally {
      setIsLoading(false);
    }
  };

  const continueAsGuest = (): void => {
    setIsGuest(true);
    setUser(null);
    setIsLoading(false);
  };

  const refreshUser = async (): Promise<void> => {
    try {
      const currentUser = await ApiService.getCurrentUser();
      setUser(currentUser);
    } catch (error) {
      console.error('Refresh user error:', error);
    }
  };

  const updateUser = (userData: User): void => {
    setUser(userData);
  };

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user && ApiService.isAuthenticated(),
    isGuest,
    pendingProfileCompletion,
    setPendingProfileCompletion,
    login,
    register,
    logout,
    refreshUser,
    updateUser,
    continueAsGuest,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

import AsyncStorage from '@react-native-async-storage/async-storage';
import ApiService from './apiService';

// Use the same base URL as ApiService (already includes /api)
const API_BASE_URL = 'https://apiv2.qabalanbakery.com/api';

export interface PaymentSession {
  sessionId: string;
  paymentUrl: string;
  orderId: string;
  amount?: number;
  currency?: string;
  checkoutUrl?: string;
  checkoutScript?: string;
  returnUrl?: string;
  cancelUrl?: string;
  successIndicator?: string | null;
}

export interface PaymentResult {
  success: boolean;
  orderId?: string;
  transactionId?: string;
  error?: string;
  session?: PaymentSession;
}

class PaymentService {
  private async getAuthToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem('authToken');
    } catch (error) {
      console.error('Error getting auth token:', error);
      return null;
    }
  }

  /**
   * Create MPGS payment session for mobile app
   */
  async createMPGSPaymentSession(orderId: string, amount?: number): Promise<PaymentSession> {
    try {
      const token = await this.getAuthToken();
      const url = `${API_BASE_URL}/payments/mpgs/mobile/session`;

      console.log('🔐 Creating MPGS payment session...');
      console.log('📍 API_BASE_URL constant:', API_BASE_URL);
      console.log('📍 Full URL:', url);
      console.log('📦 Order ID:', orderId);
      console.log('💰 Amount:', amount);
      console.log('🔑 Has auth token:', !!token);

      const body: Record<string, any> = { orderId };
      if (typeof amount === 'number' && !Number.isNaN(amount)) {
        body.amount = Number(amount.toFixed(2));
      }

      console.log('📤 Request body:', JSON.stringify(body));

      // Test basic connectivity first
      console.log('🔍 Testing connectivity to server...');
      try {
        const testResponse = await fetch('https://apiv2.qabalanbakery.com/api/health', {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
        });
        console.log('✅ Health check status:', testResponse.status);
      } catch (testError) {
        console.error('❌ Health check failed:', testError);
      }

      console.log('🚀 Attempting payment session request...');
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
        body: JSON.stringify(body),
      });

      console.log('📥 Response status:', response.status);
      console.log('📥 Response ok:', response.ok);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ HTTP error response:', errorText);
        throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
      }

      const data = await response.json();
      console.log('📄 Response data:', data);

      if (!data.success) {
        throw new Error(data.error || 'Failed to create payment session');
      }

      return {
        sessionId: data.sessionId,
        paymentUrl: data.paymentUrl,
        orderId: String(data.orderId || orderId),
        amount: typeof data.amount === 'number' ? data.amount : undefined,
        currency: data.currency,
        checkoutUrl: data.checkoutUrl,
        checkoutScript: data.checkoutScript,
        returnUrl: data.returnUrl,
        cancelUrl: data.cancelUrl,
        successIndicator: data.successIndicator ?? null,
      };
    } catch (error) {
      console.error('💥 Error creating MPGS payment session:', error);
      console.error('💥 Error details:', {
        message: (error as any)?.message,
        name: (error as any)?.name,
        stack: (error as any)?.stack?.substring(0, 200)
      });
      throw error;
    }
  }

  /**
   * Check payment status after user returns from payment page
   */
  async checkPaymentStatus(orderId: string): Promise<PaymentResult> {
    try {
      const token = await this.getAuthToken();
      
      const response = await fetch(`${API_BASE_URL}/payments/mpgs/payment/status?orders_id=${orderId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { 'Authorization': `Bearer ${token}` }),
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      return {
        success: data.success || false,
        orderId: data.orderId,
        transactionId: data.transactionId,
        error: data.error
      };
    } catch (error) {
      console.error('Error checking payment status:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Manually verify payment with gateway and update database
   * Use this after payment completion to ensure status is synced
   */
  async verifyPayment(orderId: string): Promise<PaymentResult> {
    try {
      const token = await this.getAuthToken();
      
      if (!token) {
        throw new Error('Authentication required');
      }

      console.log('🔍 Verifying payment for order:', orderId);
      
      const response = await fetch(`${API_BASE_URL}/payments/mpgs/payment/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ orderId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      console.log('✅ Verification result:', data);
      
      return {
        success: data.success || false,
        orderId: data.orderId,
        transactionId: data.transactionId,
        error: data.error
      };
    } catch (error) {
      console.error('❌ Error verifying payment:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Verification failed'
      };
    }
  }

  /**
   * Process card payment flow
   */
  async processCardPayment(orderId: string, amount?: number): Promise<PaymentResult> {
    try {
      console.log('Creating MPGS payment session for order:', orderId);
      const session = await this.createMPGSPaymentSession(orderId, amount);

      return {
        success: true,
        orderId: session.orderId,
        transactionId: session.sessionId,
        session,
      };
    } catch (error) {
      console.error('Error processing card payment:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Payment failed'
      };
    }
  }
}

export default new PaymentService();

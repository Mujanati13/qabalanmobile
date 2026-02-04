import AsyncStorage from '@react-native-async-storage/async-storage';
import ApiService from './apiService';

// Use the same base URL as ApiService to ensure tokens/users match the same backend
const API_BASE_URL = `https://apiv2.qabalanbakery.com/api`;

export interface SupportTicket {
  id: number;
  ticket_number: string;
  subject: string;
  message: string;
  category: 'complaint' | 'inquiry' | 'order_issue';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  user_id: number;
  order_id?: number;
  assigned_to?: number;
  rating?: number;
  created_at: string;
  updated_at: string;
  user?: {
    first_name: string;
    last_name: string;
    email: string;
  };
  order?: {
    id: number;
    order_number: string;
    total_amount: number;
    status: string;
  };
  replies?: SupportReply[];
  attachments?: SupportAttachment[];
}

export interface SupportReply {
  id: number;
  ticket_id: number;
  user_id?: number;
  admin_id?: number;
  message: string;
  is_internal_note: boolean;
  created_at: string;
  user?: {
    first_name: string;
    last_name: string;
    user_type: string;
  };
  attachments?: SupportAttachment[];
}

export interface SupportAttachment {
  id: number;
  ticket_id?: number;
  reply_id?: number;
  file_name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  created_at: string;
}

export interface CreateTicketData {
  subject: string;
  message: string;
  category: 'complaint' | 'inquiry' | 'order_issue';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  order_id?: number;
}

class SupportService {
  private async getAuthToken(): Promise<string | null> {
    try {
  // Prefer ApiService accessor to keep in sync with in-memory token
  const token = await ApiService.getAccessToken();
  if (token) return token;
  // Fallback to direct AsyncStorage read
  return await AsyncStorage.getItem('accessToken');
    } catch (error) {
      console.error('Error getting auth token:', error);
      return null;
    }
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    try {
      const token = await this.getAuthToken();
      const headers: any = {
        'Content-Type': 'application/json',
        ...options.headers,
      };

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = (errorData as any).message || `HTTP error! status: ${response.status}`;
        throw new Error(errorMessage);
      }

      return await response.json();
    } catch (error) {
      // Only log unexpected errors, not known missing endpoints
      if (error instanceof Error && 
          (endpoint.includes('/mark-read') || endpoint.includes('/rate')) &&
          error.message.includes('Route not found')) {
        // Silently handle known missing endpoints
        throw error;
      }
      
      console.error('API request failed:', error);
      throw error;
    }
  }

  private async makeFormDataRequest(endpoint: string, formData: FormData): Promise<any> {
    try {
      const token = await this.getAuthToken();
      console.log('🔑 Token retrieved for FormData request:', token ? 'Token found' : 'No token');
      
      const headers: any = {};

      if (token) {
        headers.Authorization = `Bearer ${token}`;
        console.log('✅ Authorization header added');
      } else {
        console.log('❌ No token available - request will fail');
        throw new Error('Access token required');
      }

      console.log(`🌐 Making FormData request to: ${API_BASE_URL}${endpoint}`);
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers,
        body: formData,
      });

      console.log(`📊 Response status: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        const errorText = await response.text();
        console.log('❌ Error response body:', errorText);
        
        let errorData = {};
        try {
          errorData = JSON.parse(errorText);
        } catch (e) {
          console.log('⚠️  Response is not valid JSON');
        }
        
        // Handle specific error types
        if (response.status === 413) {
          throw new Error('File too large. Please select a smaller image (max 10MB) or compress your image.');
        } else if (response.status === 422) {
          throw new Error('Invalid file type. Only images (JPG, PNG, GIF) and documents (PDF, DOC, TXT) are allowed.');
        } else if (response.status === 401) {
          throw new Error('Session expired. Please log in again.');
        } else if (response.status === 500) {
          throw new Error('Server error. Please try again later.');
        }
        
        throw new Error((errorData as any).message || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ FormData request successful:', result);
      return result;
    } catch (error) {
      console.error('Form data request failed:', error);
      throw error;
    }
  }

  // Get support categories
  async getCategories(): Promise<{ value: string; label: string }[]> {
    try {
      const response = await this.makeRequest('/support/categories');
      return response.data || [
        { value: 'complaint', label: 'Complaint' },
        { value: 'inquiry', label: 'Inquiry' },
        { value: 'order_issue', label: 'Order Issue' },
      ];
    } catch (error) {
      console.error('Error fetching categories:', error);
      // Return default categories if API fails
      return [
        { value: 'complaint', label: 'Complaint' },
        { value: 'inquiry', label: 'Inquiry' },
        { value: 'order_issue', label: 'Order Issue' },
      ];
    }
  }

  // Get user's tickets
  async getMyTickets(filters: {
    status?: string;
    category?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<{ tickets: SupportTicket[]; pagination: any }> {
    const queryParams = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, value.toString());
      }
    });

    const endpoint = `/support/tickets${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response = await this.makeRequest(endpoint);
    
    // Handle different response structures
    const tickets = response.data.tickets || response.data || [];
    const pagination = response.data.pagination || {};
    
    console.log('🎫 Retrieved tickets:', tickets.length, 'tickets');
    
    return {
      tickets,
      pagination,
    };
  }

  // Get ticket details with replies
  async getTicketDetails(ticketId: number): Promise<SupportTicket> {
    try {
      const response = await this.makeRequest(`/support/tickets/${ticketId}`);
      console.log('🎫 Ticket details response:', response);
      
      // Handle different response structures from backend
      const responseData = response.data.data || response.data || response;
      const ticketData = responseData.ticket || responseData;
      const replies = responseData.replies || [];
      const attachments = responseData.attachments || [];
      
      if (!ticketData || !ticketData.id) {
        console.error('❌ Invalid ticket data structure:', response.data);
        throw new Error('Invalid ticket data received');
      }
      
      // Combine ticket data with replies and attachments
      const fullTicketData = {
        ...ticketData,
        replies,
        attachments
      };
      
      console.log('✅ Parsed ticket data:', {
        id: fullTicketData.id,
        subject: fullTicketData.subject,
        status: fullTicketData.status,
        repliesCount: replies.length,
        attachmentsCount: attachments.length
      });
      
      return fullTicketData;
    } catch (error) {
      console.error('Error getting ticket details:', error);
      throw error;
    }
  }

  // Create new ticket
  async createTicket(
    ticketData: CreateTicketData,
    attachments: { uri: string; name: string; type: string }[] = []
  ): Promise<SupportTicket> {
    try {
      console.log('🎫 SupportService: Creating ticket with data:', JSON.stringify(ticketData, null, 2));
      
      // If no attachments, use JSON request for better compatibility
      if (!attachments || attachments.length === 0) {
        console.log('📝 No attachments, using JSON request for better compatibility');
        const response = await this.makeRequest('/support/tickets', {
          method: 'POST',
          body: JSON.stringify(ticketData)
        });
        console.log('✅ Ticket created successfully with JSON:', response.data);
        return response.data;
      }
      
      // If attachments exist, use FormData
      console.log('📎 Attachments present, using FormData request');
      const formData = new FormData();
      
      // Add ticket data
      Object.entries(ticketData).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          console.log(`📝 Adding field to FormData: ${key} = ${value} (${typeof value})`);
          formData.append(key, value.toString());
        } else {
          console.log(`⚠️  Skipping field (null/undefined): ${key} = ${value}`);
        }
      });

      // Add attachments
      attachments.forEach((file, index) => {
        console.log(`📎 Adding attachment ${index + 1}:`, file.name);
        formData.append('attachments', {
          uri: file.uri,
          name: file.name,
          type: file.type,
          // React Native requires this specific format for file uploads
        } as any);
      });

      console.log('🚀 Making FormData request to /support/tickets');
      const response = await this.makeFormDataRequest('/support/tickets', formData);
      console.log('✅ Ticket created successfully with FormData:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error creating ticket:', error);
      throw error;
    }
  }

  // Add reply to ticket
  async addReply(
    ticketId: number,
    message: string,
    attachments: { uri: string; name: string; type: string }[] = []
  ): Promise<SupportReply> {
    try {
      console.log('💬 Adding reply to ticket', ticketId, 'with message:', message);
      
      // If no attachments, use JSON request for better compatibility
      if (!attachments || attachments.length === 0) {
        console.log('📝 No attachments, using JSON request for reply');
        const response = await this.makeRequest(`/support/tickets/${ticketId}/replies`, {
          method: 'POST',
          body: JSON.stringify({ message })
        });
        console.log('✅ Reply added successfully with JSON:', response.data);
        return response.data;
      }
      
      // If attachments exist, use FormData
      console.log('📎 Attachments present, using FormData request for reply');
      const formData = new FormData();
      formData.append('message', message);

      // Add attachments
      attachments.forEach((file, index) => {
        console.log(`📎 Adding attachment ${index + 1} to reply:`, file.name);
        formData.append('attachments', {
          uri: file.uri,
          name: file.name,
          type: file.type,
        } as any);
      });

      const response = await this.makeFormDataRequest(`/support/tickets/${ticketId}/replies`, formData);
      console.log('✅ Reply added successfully with FormData:', response.data);
      return response.data;
    } catch (error) {
      console.error('Error adding reply:', error);
      throw error;
    }
  }

  // Mark ticket as read by customer
  async markTicketAsRead(ticketId: number): Promise<void> {
    try {
      // Note: This endpoint may not exist on all backend versions
      // If it fails, we'll just continue silently
      await this.makeRequest(`/support/tickets/${ticketId}/mark-read`, {
        method: 'POST',
      });
      console.log('✅ Ticket marked as read');
    } catch (error: any) {
      // Check if it's a "route not found" error - this is expected for many backends
      if (error.message && (error.message.includes('Route not found') || error.message.includes('mark-read'))) {
        // Completely silent for this expected case - no logging to avoid console spam
        return;
      }
      
      // For other unexpected errors, log but don't throw to avoid breaking the ticket details flow
      console.log('⚠️  Could not mark ticket as read (non-critical):', error.message);
    }
  }

  // Rate support ticket
  async rateTicket(ticketId: number, rating: number, feedback?: string): Promise<void> {
    try {
      await this.makeRequest(`/support/tickets/${ticketId}/rate`, {
        method: 'POST',
        body: JSON.stringify({ rating, feedback }),
      });
    } catch (error) {
      // Handle gracefully if the endpoint doesn't exist - this is expected for many backends
      if (error instanceof Error && (error.message.includes('Route not found') || error.message.includes('/rate'))) {
        // Completely silent for this expected case - no logging to avoid console spam
        return;
      }
      
      // For other unexpected errors, log but don't throw to avoid breaking the rating flow
      console.log('⚠️  Could not rate ticket (non-critical):', error instanceof Error ? error.message : error);
    }
  }

  // Get user's orders for ticket linking
  async getUserOrders(): Promise<any[]> {
    try {
      const response = await this.makeRequest('/orders');
      return response.data || [];
    } catch (error) {
      console.error('Error fetching user orders:', error);
      return [];
    }
  }

  // Upload attachment (for manual upload)
  async uploadAttachment(file: { uri: string; name: string; type: string }): Promise<string> {
    try {
      const formData = new FormData();
      formData.append('file', {
        uri: file.uri,
        name: file.name,
        type: file.type,
      } as any);

      const response = await this.makeFormDataRequest('/support/upload', formData);
      return response.data.filePath;
    } catch (error) {
      console.error('Error uploading attachment:', error);
      throw error;
    }
  }

  // Format file size for display
  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // Get status color for UI
  getStatusColor(status: string): string {
    const colors = {
      open: '#1890ff',
      in_progress: '#faad14',
      resolved: '#52c41a',
      closed: '#8c8c8c',
    };
    return colors[status as keyof typeof colors] || '#8c8c8c';
  }

  // Get priority color for UI
  getPriorityColor(priority: string): string {
    const colors = {
      low: '#52c41a',
      medium: '#faad14',
      high: '#ff7875',
      urgent: '#ff4d4f',
    };
    return colors[priority as keyof typeof colors] || '#faad14';
  }

  // Get category icon for UI
  getCategoryIcon(category: string): string {
    const icons = {
      complaint: 'alert-circle',
      inquiry: 'help-circle',
      order_issue: 'shopping-cart',
    };
    return icons[category as keyof typeof icons] || 'help-circle';
  }
}

export default new SupportService();

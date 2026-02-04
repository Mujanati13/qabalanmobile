import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  FlatList,
  I18nManager,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';
import Icon from 'react-native-vector-icons/Ionicons';
// import DocumentPicker from '@react-native-documents/picker';
import { launchImageLibrary, MediaType, PhotoQuality } from 'react-native-image-picker';
import supportService, { CreateTicketData } from '../services/supportService';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { formatCurrency } from '../utils/currency';

interface Order {
  id: number;
  order_number: string;
  total_amount: number;
  order_status: string;
  created_at: string;
}

interface AttachmentFile {
  uri: string;
  name: string;
  type: string;
  size?: number;
}

type RootStackParamList = {
  CreateTicket: {
    orderId?: number;
  };
};

type CreateTicketRouteProp = RouteProp<RootStackParamList, 'CreateTicket'>;

interface CategoryOption {
  value: 'complaint' | 'inquiry' | 'order_issue';
  icon: string;
  color: string;
  labelKey: string;
}

interface PriorityOption {
  value: 'low' | 'medium' | 'high' | 'urgent';
  color: string;
  labelKey: string;
}

const CATEGORY_OPTIONS: CategoryOption[] = [
  { value: 'complaint', icon: 'alert-circle', color: '#ff4d4f', labelKey: 'support.categories.complaint' },
  { value: 'inquiry', icon: 'help-circle', color: '#1890ff', labelKey: 'support.categories.inquiry' },
  { value: 'order_issue', icon: 'shopping-cart', color: '#faad14', labelKey: 'support.categories.orderIssue' },
];

const PRIORITY_OPTIONS: PriorityOption[] = [
  { value: 'low', color: '#52c41a', labelKey: 'support.priorities.low' },
  { value: 'medium', color: '#faad14', labelKey: 'support.priorities.medium' },
  { value: 'high', color: '#ff7875', labelKey: 'support.priorities.high' },
  { value: 'urgent', color: '#ff4d4f', labelKey: 'support.priorities.urgent' },
];

const CreateTicketScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<CreateTicketRouteProp>();
  const { t } = useTranslation();
  const { user } = useAuth();
  const isRTL = false; // Override to force LTR

  // Safe currency formatting function
  const formatAmount = (amount: unknown): string => {
  return formatCurrency(amount, { isRTL });
  };

  // Form state
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState<'complaint' | 'inquiry' | 'order_issue'>('inquiry');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);

  // Validation state
  const [subjectError, setSubjectError] = useState('');
  const [messageError, setMessageError] = useState('');

  // UI state
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState<Order[]>([]);
  const categories = CATEGORY_OPTIONS;
  const priorities = PRIORITY_OPTIONS;
  const [showOrderPicker, setShowOrderPicker] = useState(false);

  useEffect(() => {
    fetchUserOrders();
    
    // If navigated from order details, pre-select the order
    if (route.params?.orderId) {
      // Set category to order_issue by default when coming from order
      setCategory('order_issue');
    }
  }, [route.params]);

  const fetchUserOrders = async () => {
    try {
      const userOrders = await supportService.getUserOrders();
      setOrders(userOrders);
      
      // Auto-select order if passed from navigation
      if (route.params?.orderId) {
        const preSelectedOrder = userOrders.find(order => order.id === route.params.orderId);
        if (preSelectedOrder) {
          setSelectedOrder(preSelectedOrder);
        }
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
    }
  };

  // Validation helper functions
  const getWordCount = (text: string): number => {
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
  };

  const validateSubject = (text: string): { isValid: boolean; message: string } => {
    const trimmed = text.trim();
    if (!trimmed) {
      return { isValid: false, message: t('support.subjectRequired') };
    }
    if (trimmed.length < 5) {
      return { isValid: false, message: t('support.subjectMinLength') };
    }
    if (trimmed.length > 255) {
      return { isValid: false, message: t('support.subjectMaxLength') };
    }
    
    const wordCount = getWordCount(trimmed);
    if (wordCount < 2) {
      return { isValid: false, message: t('support.subjectMinWords', { count: wordCount }) };
    }
    
    return { isValid: true, message: '' };
  };

  const validateMessage = (text: string): { isValid: boolean; message: string } => {
    const trimmed = text.trim();
    if (!trimmed) {
      return { isValid: false, message: t('support.messageRequired') };
    }
    if (trimmed.length < 10) {
      return { isValid: false, message: t('support.messageMinLength') };
    }
    if (trimmed.length > 5000) {
      return { isValid: false, message: t('support.messageMaxLength') };
    }
    
    const wordCount = getWordCount(trimmed);
    if (wordCount < 4) {
      return { isValid: false, message: t('support.messageMinWords', { count: wordCount }) };
    }
    
    return { isValid: true, message: '' };
  };

  // Input change handlers with validation
  const handleSubjectChange = (text: string) => {
    setSubject(text);
    const validation = validateSubject(text);
    setSubjectError(validation.isValid ? '' : validation.message);
  };

  const handleMessageChange = (text: string) => {
    setMessage(text);
    const validation = validateMessage(text);
    setMessageError(validation.isValid ? '' : validation.message);
  };

  const handleSubmit = async () => {
    // Comprehensive validation
    const subjectValidation = validateSubject(subject);
    if (!subjectValidation.isValid) {
      Alert.alert(t('support.subjectErrorTitle'), subjectValidation.message);
      return;
    }

    const messageValidation = validateMessage(message);
    if (!messageValidation.isValid) {
      Alert.alert(t('support.messageErrorTitle'), messageValidation.message);
      return;
    }

    if (category === 'order_issue' && !selectedOrder) {
      Alert.alert(
        t('support.orderRequiredTitle'), 
        t('support.orderRequiredMessage')
      );
      return;
    }

    // Check attachment size limits
    const maxFileSize = 10 * 1024 * 1024; // 10MB (updated to match backend)
    const oversizedFiles = attachments.filter(file => file.size && file.size > maxFileSize);
    if (oversizedFiles.length > 0) {
      Alert.alert(
        t('support.fileSizeErrorTitle'),
        t('support.fileSizeErrorMessage', { files: oversizedFiles.map(f => f.name).join(', ') })
      );
      return;
    }

    setLoading(true);

    try {
      const ticketData: CreateTicketData = {
        subject: subject.trim(),
        message: message.trim(),
        category,
        priority,
        order_id: selectedOrder?.id,
      };

      console.log('🎫 Creating ticket with data:', ticketData);
      const ticket = await supportService.createTicket(ticketData, attachments);
      
      Alert.alert(
        t('support.ticketCreatedTitle'),
        t('support.ticketCreatedMessage', { ticketNumber: ticket.ticket_number }),
        [
          {
            text: t('support.viewTickets'),
            onPress: () => {
              navigation.goBack();
              navigation.navigate('SupportTickets' as never);
            },
          },
          {
            text: t('common.ok'),
            onPress: () => navigation.goBack(),
            style: 'cancel',
          },
        ]
      );
    } catch (error: any) {
      console.error('Error creating ticket:', error);
      
      // Enhanced error handling
      let errorTitleKey = 'support.genericErrorTitle';
      let errorMessageKey = 'support.genericErrorMessage';
      let errorDetails: string | undefined;

      if (error.message) {
        if (error.message.includes('Validation failed')) {
          errorTitleKey = 'support.validationErrorTitle';
          errorMessageKey = 'support.validationErrorMessage';
        } else if (error.message.includes('Network')) {
          errorTitleKey = 'support.networkErrorTitle';
          errorMessageKey = 'support.networkErrorMessage';
        } else if (error.message.includes('Access token required') || error.message.includes('Invalid token')) {
          errorTitleKey = 'support.authErrorTitle';
          errorMessageKey = 'support.authErrorMessage';
        } else if (error.message.includes('Server error') || error.message.includes('500')) {
          errorTitleKey = 'support.serverErrorTitle';
          errorMessageKey = 'support.serverErrorMessage';
        } else {
          errorMessageKey = 'support.genericErrorMessageWithDetails';
          errorDetails = error.message;
        }
      }

      Alert.alert(
        t(errorTitleKey),
        t(errorMessageKey, errorDetails ? { details: errorDetails } : undefined),
        [
          {
            text: t('common.tryAgain'),
            onPress: () => {},
          },
          {
            text: t('common.cancel'),
            style: 'cancel',
          },
        ]
      );
    } finally {
      setLoading(false);
    }
  };

  const pickDocument = async () => {
    try {
      // DocumentPicker functionality temporarily disabled due to compatibility issues
  Alert.alert(t('common.info'), t('support.documentPickerUnavailable'));
      return;
      
      // const result = await DocumentPicker.pick({
      //   type: [DocumentPicker.types.allFiles],
      //   allowMultiSelection: true,
      // });

      // const newFiles = result.map(file => ({
      //   uri: file.uri,
      //   name: file.name || 'document',
      //   type: file.type || 'application/octet-stream',
      //   size: file.size || undefined,
      // }));

      // setAttachments(prev => [...prev, ...newFiles]);
    } catch (error) {
      // if (!DocumentPicker.isCancel(error)) {
        console.error('Error picking document:', error);
  Alert.alert(t('common.error'), t('support.documentPickFailed'));
      // }
    }
  };

  const pickImage = () => {
    const options = {
      mediaType: 'photo' as MediaType,
      quality: 0.6 as PhotoQuality, // Reduced from 0.8 to 0.6 for smaller file sizes
      allowsEditing: true,
      maxWidth: 1920, // Limit image width to reduce file size
      maxHeight: 1920, // Limit image height to reduce file size
    };

    launchImageLibrary(options, (response) => {
      if (response.didCancel || response.errorMessage) {
        return;
      }

      if (response.assets && response.assets[0]) {
        const asset = response.assets[0];
        const newFile: AttachmentFile = {
          uri: asset.uri!,
          name: asset.fileName || 'image.jpg',
          type: asset.type || 'image/jpeg',
          size: asset.fileSize,
        };

        setAttachments(prev => [...prev, newFile]);
      }
    });
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  const renderOrderItem = ({ item }: { item: Order }) => (
    <TouchableOpacity
      style={[
        styles.orderItem,
        selectedOrder?.id === item.id && styles.selectedOrderItem,
      ]}
      onPress={() => {
        setSelectedOrder(item);
        setShowOrderPicker(false);
      }}
    >
      <View style={styles.orderHeader}>
        <Text style={styles.orderNumber}>#{item.order_number}</Text>
  <Text style={styles.orderAmount}>{formatAmount(item.total_amount)}</Text>
      </View>
      <View style={styles.orderDetails}>
        <Text style={styles.orderStatus}>{item.order_status}</Text>
        <Text style={styles.orderDate}>
          {new Date(item.created_at).toLocaleDateString()}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderAttachment = ({ item, index }: { item: AttachmentFile; index: number }) => (
    <View style={styles.attachmentItem}>
      <Icon name="document" size={20} color="#666" />
      <View style={styles.attachmentInfo}>
        <Text style={styles.attachmentName} numberOfLines={1}>
          {item.name}
        </Text>
        {item.size && (
          <Text style={styles.attachmentSize}>
            {supportService.formatFileSize(item.size)}
          </Text>
        )}
      </View>
      <TouchableOpacity
        style={styles.removeAttachment}
        onPress={() => removeAttachment(index)}
      >
        <Icon name="close-circle" size={20} color="#ff4d4f" />
      </TouchableOpacity>
    </View>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name={isRTL ? 'arrow-forward' : 'arrow-back'} size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.title}>{t('support.createSupportTicket')}</Text>
      </View>

      {/* Category Selection */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('support.categoryRequired')}</Text>
        <View style={styles.categoryGrid}>
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat.value}
              style={[
                styles.categoryItem,
                category === cat.value && { ...styles.selectedCategoryItem, borderColor: cat.color },
              ]}
              onPress={() => setCategory(cat.value as any)}
            >
              <Icon
                name={cat.icon}
                size={24}
                color={category === cat.value ? cat.color : '#666'}
              />
              <Text
                style={[
                  styles.categoryLabel,
                  category === cat.value && { color: cat.color },
                ]}
              >
                {t(cat.labelKey)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Priority Selection */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('support.priorityLabel')}</Text>
        <View style={styles.priorityContainer}>
          {priorities.map((pri) => (
            <TouchableOpacity
              key={pri.value}
              style={[
                styles.priorityItem,
                priority === pri.value && { backgroundColor: pri.color + '20', borderColor: pri.color },
              ]}
              onPress={() => setPriority(pri.value as any)}
            >
              <Text
                style={[
                  styles.priorityLabel,
                  priority === pri.value && { color: pri.color },
                ]}
              >
                {t(pri.labelKey)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Order Selection (for order issues) */}
      {category === 'order_issue' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('support.relatedOrderRequired')}</Text>
          <TouchableOpacity
            style={styles.orderSelector}
            onPress={() => setShowOrderPicker(true)}
          >
            {selectedOrder ? (
              <View style={styles.selectedOrderDisplay}>
                <Text style={styles.selectedOrderText}>
                  #{selectedOrder.order_number} - {formatAmount(selectedOrder.total_amount)}
                </Text>
                <Text style={styles.selectedOrderSubtext}>
                  {selectedOrder.order_status} • {new Date(selectedOrder.created_at).toLocaleDateString()}
                </Text>
              </View>
            ) : (
              <Text style={styles.orderSelectorPlaceholder}>{t('support.selectOrderPlaceholder')}</Text>
            )}
            <Icon name="chevron-down" size={20} color="#666" />
          </TouchableOpacity>
        </View>
      )}

      {/* Subject Input */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('support.subjectRequiredLabel')}</Text>
        <TextInput
          style={[styles.textInput, subjectError ? styles.textInputError : null]}
          value={subject}
          onChangeText={handleSubjectChange}
          placeholder={t('support.subjectPlaceholder')}
          placeholderTextColor="#999"
          maxLength={255}
        />
        <View style={styles.inputFooter}>
          <Text style={styles.characterCount}>
            {t('support.subjectCounter', {
              current: subject.length,
              max: 255,
              words: getWordCount(subject),
              minWords: 2,
            })}
          </Text>
        </View>
        {subjectError ? (
          <Text style={styles.errorText}>{subjectError}</Text>
        ) : null}
      </View>

      {/* Message Input */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('support.messageRequiredLabel')}</Text>
        <TextInput
          style={[styles.textInput, styles.messageInput, messageError ? styles.textInputError : null]}
          value={message}
          onChangeText={handleMessageChange}
          placeholder={t('support.messagePlaceholder')}
          placeholderTextColor="#999"
          multiline
          numberOfLines={6}
          textAlignVertical="top"
          maxLength={5000}
        />
        <View style={styles.inputFooter}>
          <Text style={styles.characterCount}>
            {t('support.messageCounter', {
              current: message.length,
              max: 5000,
              words: getWordCount(message),
              minWords: 4,
            })}
          </Text>
        </View>
        {messageError ? (
          <Text style={styles.errorText}>{messageError}</Text>
        ) : null}
      </View>

      {/* Attachments */}
      {/* HIDDEN: Document upload functionality 
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('support.attachments')}</Text>
        <View style={styles.attachmentButtons}>
          <TouchableOpacity style={styles.attachmentButton} onPress={pickDocument}>
            <Icon name="document" size={20} color="#1890ff" />
            <Text style={styles.attachmentButtonText}>{t('support.addDocument')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.attachmentButton} onPress={pickImage}>
            <Icon name="camera" size={20} color="#1890ff" />
            <Text style={styles.attachmentButtonText}>{t('support.addPhoto')}</Text>
          </TouchableOpacity>
        </View>

        {attachments.length > 0 && (
          <FlatList
            data={attachments}
            renderItem={renderAttachment}
            keyExtractor={(item, index) => index.toString()}
            style={styles.attachmentsList}
          />
        )}
      </View>
      */}

      {/* Submit Button */}
      <TouchableOpacity
        style={[
          styles.submitButton, 
          (loading || subjectError || messageError) && styles.submitButtonDisabled
        ]}
        onPress={handleSubmit}
        disabled={loading || !!subjectError || !!messageError}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <>
            <Icon name="send" size={20} color="#fff" />
            <Text style={styles.submitButtonText}>{t('support.createTicket')}</Text>
          </>
        )}
      </TouchableOpacity>

      {/* Order Picker Modal */}
      <Modal
        visible={showOrderPicker}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowOrderPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('support.selectOrder')}</Text>
              <TouchableOpacity onPress={() => setShowOrderPicker(false)}>
                <Icon name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            <FlatList
              data={orders}
              renderItem={renderOrderItem}
              keyExtractor={(item) => item.id.toString()}
              style={styles.ordersList}
              showsVerticalScrollIndicator={false}
            />
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  contentContainer: {
    paddingBottom: 30,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e8e8e8',
  },
  backButton: {
    marginRight: 16,
    padding: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  section: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 16,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  categoryItem: {
    width: '30%',
    aspectRatio: 1,
    borderWidth: 2,
    borderColor: '#e8e8e8',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  selectedCategoryItem: {
    backgroundColor: '#f6ffed',
  },
  categoryLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
  },
  priorityContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  priorityItem: {
    flex: 1,
    marginHorizontal: 4,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#e8e8e8',
    borderRadius: 6,
    alignItems: 'center',
  },
  priorityLabel: {
    fontSize: 14,
    color: '#666',
  },
  orderSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#e8e8e8',
    borderRadius: 8,
    padding: 12,
    backgroundColor: '#fff',
  },
  selectedOrderDisplay: {
    flex: 1,
  },
  selectedOrderText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  selectedOrderSubtext: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  orderSelectorPlaceholder: {
    fontSize: 14,
    color: '#999',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#e8e8e8',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    color: '#333',
    backgroundColor: '#fff',
  },
  messageInput: {
    height: 120,
    textAlignVertical: 'top',
  },
  characterCount: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
    marginTop: 4,
  },
  attachmentButtons: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  attachmentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f9ff',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#1890ff',
  },
  attachmentButtonText: {
    fontSize: 14,
    color: '#1890ff',
    marginLeft: 6,
  },
  attachmentsList: {
    maxHeight: 200,
  },
  attachmentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    backgroundColor: '#f9f9f9',
    borderRadius: 6,
    marginBottom: 8,
  },
  attachmentInfo: {
    flex: 1,
    marginLeft: 8,
  },
  attachmentName: {
    fontSize: 14,
    color: '#333',
  },
  attachmentSize: {
    fontSize: 12,
    color: '#666',
  },
  removeAttachment: {
    padding: 4,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1890ff',
    margin: 16,
    paddingVertical: 16,
    borderRadius: 8,
  },
  submitButtonDisabled: {
    backgroundColor: '#ccc',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginLeft: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e8e8e8',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  ordersList: {
    padding: 16,
  },
  orderItem: {
    padding: 12,
    borderWidth: 1,
    borderColor: '#e8e8e8',
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  selectedOrderItem: {
    borderColor: '#1890ff',
    backgroundColor: '#f0f9ff',
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  orderNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  orderAmount: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1890ff',
  },
  orderDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderStatus: {
    fontSize: 12,
    color: '#666',
    textTransform: 'capitalize',
  },
  orderDate: {
    fontSize: 12,
    color: '#666',
  },
  textInputError: {
    borderColor: '#ff4d4f',
    borderWidth: 2,
  },
  inputFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  errorText: {
    fontSize: 12,
    color: '#ff4d4f',
    marginTop: 4,
    marginBottom: 8,
  },
});

export default CreateTicketScreen;

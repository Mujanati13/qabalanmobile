import React, { useState } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Text,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import Colors from '../../theme/colors';
import { Typography, Spacing, BorderRadius, Shadow } from '../../theme';

interface SearchBarProps {
  placeholder?: string;
  value?: string;
  onChangeText?: (text: string) => void;
  onSearch?: (text: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  disabled?: boolean;
  showFilterButton?: boolean;
  onFilterPress?: () => void;
  autoFocus?: boolean;
}

const SearchBar: React.FC<SearchBarProps> = ({
  placeholder = 'Search...',
  value = '',
  onChangeText,
  onSearch,
  onFocus,
  onBlur,
  disabled = false,
  showFilterButton = false,
  onFilterPress,
  autoFocus = false,
}) => {
  const [internalValue, setInternalValue] = useState(value);
  const [isFocused, setIsFocused] = useState(false);

  const handleChangeText = (text: string) => {
    setInternalValue(text);
    onChangeText?.(text);
  };

  const handleSearch = () => {
    onSearch?.(internalValue);
  };

  const handleFocus = () => {
    setIsFocused(true);
    onFocus?.();
  };

  const handleBlur = () => {
    setIsFocused(false);
    onBlur?.();
  };

  const handleClear = () => {
    setInternalValue('');
    onChangeText?.('');
    onSearch?.('');
  };

  return (
    <View style={[
      styles.container,
      isFocused && styles.focusedContainer,
      disabled && styles.disabledContainer
    ]}>
      <Icon 
        name="search-outline" 
        size={20} 
        color={isFocused ? Colors.primary : Colors.textHint} 
        style={styles.searchIcon}
      />
      
      <TextInput
        style={[
          styles.input,
          disabled && styles.disabledInput,
          { textAlign: 'left', writingDirection: 'ltr' }
        ]}
        placeholder={placeholder}
        placeholderTextColor={Colors.textHint}
        value={internalValue}
        onChangeText={handleChangeText}
        onSubmitEditing={handleSearch}
        onFocus={handleFocus}
        onBlur={handleBlur}
        editable={!disabled}
        autoFocus={autoFocus}
        returnKeyType="search"
      />

      {internalValue.length > 0 && (
        <TouchableOpacity
          style={styles.clearButton}
          onPress={handleClear}
          activeOpacity={0.7}
        >
          <Icon 
            name="close-circle" 
            size={20} 
            color={Colors.textHint} 
          />
        </TouchableOpacity>
      )}

      {showFilterButton && (
        <TouchableOpacity
          style={styles.filterButton}
          onPress={onFilterPress}
          activeOpacity={0.7}
        >
          <Icon 
            name="options-outline" 
            size={20} 
            color={Colors.primary} 
          />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    paddingHorizontal: Spacing.base,
    paddingVertical: Platform.OS === 'ios' ? Spacing.md : Spacing.sm,
    ...Shadow.sm,
  },
  focusedContainer: {
    borderColor: Colors.primary,
    ...Shadow.base,
  },
  disabledContainer: {
    backgroundColor: Colors.backgroundDark,
    opacity: 0.6,
  },
  searchIcon: {
    marginRight: Spacing.sm,
  },
  input: {
    flex: 1,
    fontSize: Typography.fontSize.md,
    fontFamily: Typography.fontFamily.regular,
    color: Colors.textPrimary,
    padding: 0, // Remove default padding
  },
  disabledInput: {
    color: Colors.textHint,
  },
  clearButton: {
    marginLeft: Spacing.sm,
    padding: Spacing.xs,
  },
  filterButton: {
    marginLeft: Spacing.sm,
    padding: Spacing.xs,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.backgroundLight,
  },
});

export default SearchBar;

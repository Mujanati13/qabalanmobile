import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import Colors from '../../theme/colors';
import { Typography, Spacing, BorderRadius, Shadow } from '../../theme';

interface HeaderProps {
  title: string;
  showBackButton?: boolean;
  onBackPress?: () => void;
  rightComponent?: React.ReactNode;
  backgroundColor?: string;
  textColor?: string;
  showShadow?: boolean;
  statusBarStyle?: 'dark-content' | 'light-content';
}

const Header: React.FC<HeaderProps> = ({
  title,
  showBackButton = false,
  onBackPress,
  rightComponent,
  backgroundColor = Colors.background,
  textColor = Colors.textPrimary,
  showShadow = true,
  statusBarStyle = 'dark-content',
}) => {
  return (
    <>
      <StatusBar 
        barStyle={statusBarStyle} 
        backgroundColor={backgroundColor} 
        translucent={false}
      />
      <SafeAreaView style={[styles.container, { backgroundColor }]}>
        <View style={[
          styles.header, 
          { backgroundColor },
          showShadow && Shadow.sm
        ]}>
          {/* Left Section */}
          <View style={styles.leftSection}>
            {showBackButton && (
              <TouchableOpacity
                style={styles.backButton}
                onPress={onBackPress}
                activeOpacity={0.7}
              >
                <Icon 
                  name="chevron-back" 
                  size={24} 
                  color={textColor} 
                />
              </TouchableOpacity>
            )}
          </View>

          {/* Title Section */}
          <View style={styles.titleSection}>
            <Text 
              style={[styles.title, { color: textColor }]} 
              numberOfLines={1}
            >
              {title}
            </Text>
          </View>

          {/* Right Section */}
          <View style={styles.rightSection}>
            {rightComponent}
          </View>
        </View>
      </SafeAreaView>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.base,
    paddingVertical: Spacing.md,
    minHeight: 56,
  },
  leftSection: {
    width: 40,
    alignItems: 'flex-start',
  },
  titleSection: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
  },
  rightSection: {
    width: 40,
    alignItems: 'flex-end',
  },
  backButton: {
    padding: Spacing.xs,
    borderRadius: BorderRadius.sm,
  },
  title: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semibold,
    fontFamily: Typography.fontFamily.medium,
    textAlign: 'center',
  },
});

export default Header;

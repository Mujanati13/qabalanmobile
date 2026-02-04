import React from 'react';
import {
  View,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import Colors from '../../theme/colors';
import { Spacing, BorderRadius, Shadow } from '../../theme';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  padding?: keyof typeof Spacing;
  elevation?: 'none' | 'sm' | 'base' | 'md' | 'lg' | 'xl';
  borderRadius?: keyof typeof BorderRadius;
}

const Card: React.FC<CardProps> = ({
  children,
  style,
  padding = 'base',
  elevation = 'base',
  borderRadius = 'md',
}) => {
  const cardStyle: ViewStyle = {
    backgroundColor: Colors.backgroundCard,
    borderRadius: BorderRadius[borderRadius],
    padding: Spacing[padding],
    ...(elevation !== 'none' && Shadow[elevation]),
  };

  return (
    <View style={[cardStyle, style]}>
      {children}
    </View>
  );
};

export default Card;

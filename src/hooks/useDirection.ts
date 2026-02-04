import { useMemo } from 'react';
import { TextStyle, ViewStyle, ImageStyle, I18nManager } from 'react-native';

type LogicalStyle = ViewStyle | TextStyle | ImageStyle;

type DirectionHelpers = {
  isRTL: boolean;
  writingDirection: TextStyle['writingDirection'];
  textAlign: TextStyle['textAlign'];
  start: 'left' | 'right';
  end: 'left' | 'right';
  flexRow: ViewStyle['flexDirection'];
  flexRowReverse: ViewStyle['flexDirection'];
  containerDirection: ViewStyle;
  apply: <T extends LogicalStyle>(style: T, rtlOverrides?: Partial<T>, ltrOverrides?: Partial<T>) => Array<T | Partial<T>>;
  pick: <T>(values: { ltr: T; rtl: T }) => T;
};

export const useDirection = (): DirectionHelpers => {
  // Use I18nManager to detect RTL
  // This will be true for Arabic and false for English
  const isRTL = I18nManager.isRTL;

  console.log('[useDirection] I18nManager.isRTL:', isRTL);

  return useMemo(() => {
    const apply = <T extends LogicalStyle>(
      style: T,
      rtlOverrides: Partial<T> = {},
      ltrOverrides: Partial<T> = {},
    ): Array<T | Partial<T>> => {
      return isRTL ? [style, rtlOverrides] : [style, ltrOverrides];
    };

    const containerDirection: ViewStyle = {
      flexDirection: 'column',
      direction: isRTL ? ('rtl' as const) : ('ltr' as const),
    };

    return {
      isRTL,
      writingDirection: isRTL ? ('rtl' as const) : ('ltr' as const),
      textAlign: isRTL ? ('right' as const) : ('left' as const),
      start: isRTL ? 'right' : 'left',
      end: isRTL ? 'left' : 'right',
      flexRow: isRTL ? ('row-reverse' as const) : ('row' as const),
      flexRowReverse: isRTL ? ('row' as const) : ('row-reverse' as const),
      containerDirection,
      apply,
      pick: <T>(values: { ltr: T; rtl: T }) => (isRTL ? values.rtl : values.ltr),
    };
  }, [isRTL]);
};

export default useDirection;

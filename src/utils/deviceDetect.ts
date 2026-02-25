import { Dimensions, Platform } from 'react-native';

const { width, height } = Dimensions.get('window');

// iPhone XS / X / 11 Pro: 375×812 logical points
const isIPhoneXS =
  Platform.OS === 'ios' &&
  ((width === 375 && height === 812) || (width === 812 && height === 375));

export { isIPhoneXS };

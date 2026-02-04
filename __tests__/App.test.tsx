/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('react-native', () => {
  const actual = jest.requireActual('react-native');
  let rtl = false;
  const settingsStore = new Map<string, any>();

  const SettingsMock = {
    get: jest.fn((key: string) => settingsStore.get(key)),
    set: jest.fn((values: Record<string, any>) => {
      Object.entries(values).forEach(([k, v]) => settingsStore.set(k, v));
    }),
  };

  const I18nManagerMock: any = {
    ...actual.I18nManager,
    allowRTL: jest.fn(),
    forceRTL: jest.fn((value: boolean) => {
      rtl = value;
    }),
    swapLeftAndRightInRTL: jest.fn(),
  };

  Object.defineProperty(I18nManagerMock, 'isRTL', {
    get: () => rtl,
    set: (value: boolean) => {
      rtl = value;
    },
  });

  return {
    ...actual,
    Settings: SettingsMock,
    I18nManager: I18nManagerMock,
  };
});

jest.mock('react-native-restart', () => ({
  Restart: jest.fn(),
}));

jest.mock('react-native-permissions', () => ({
  PERMISSIONS: {
    IOS: {},
    ANDROID: {},
  },
  RESULTS: {
    UNAVAILABLE: 'unavailable',
    DENIED: 'denied',
    LIMITED: 'limited',
    GRANTED: 'granted',
    BLOCKED: 'blocked',
  },
  check: jest.fn(() => Promise.resolve('granted')),
  request: jest.fn(() => Promise.resolve('granted')),
  openSettings: jest.fn(() => Promise.resolve()),
}));

jest.mock('@react-native-firebase/app', () => ({
  getApp: jest.fn(() => ({
    options: {},
  })),
}));

jest.mock('@react-native-firebase/messaging', () => ({
  __esModule: true,
  default: {
    AuthorizationStatus: {
      AUTHORIZED: 'authorized',
      PROVISIONAL: 'provisional',
    },
  },
  getMessaging: jest.fn(() => ({
    requestPermission: jest.fn(() => Promise.resolve('authorized')),
    getToken: jest.fn(() => Promise.resolve('mock-token')),
    onMessage: jest.fn(() => jest.fn()),
    onTokenRefresh: jest.fn(),
    onNotificationOpenedApp: jest.fn(),
    getInitialNotification: jest.fn(() => Promise.resolve(null)),
  })),
}));

jest.mock('../src/services/notificationService', () => ({
  __esModule: true,
  default: {
    requestPermission: jest.fn(() => Promise.resolve(true)),
    initialize: jest.fn(() => Promise.resolve()),
    checkForMissedNotifications: jest.fn(),
    registerPendingToken: jest.fn(),
    setCurrentUserId: jest.fn(),
  },
}));

jest.mock('../src/services/localNotificationService', () => ({
  __esModule: true,
  default: {
    configure: jest.fn(),
    checkInitialNotification: jest.fn(),
    showNotification: jest.fn(),
  },
}));

import App from '../App';

test('renders correctly', async () => {
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<App />);
  });
});

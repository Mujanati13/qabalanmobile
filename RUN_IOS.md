# Running on iOS

## Prerequisites

### 1. Install Dependencies
```bash
npm install
# or
yarn install
```

### 2. Install CocoaPods Dependencies
```bash
cd ios
pod install
cd ..
```

## Running the App

### Option 1: Using npm/yarn (Recommended)
```bash
npm run ios
# or
yarn ios
```

### Option 2: Run on Specific Simulator
```bash
# iPhone 15 Pro
npx react-native run-ios --simulator="iPhone 15 Pro"

# iPhone 14
npx react-native run-ios --simulator="iPhone 14"

# iPad
npx react-native run-ios --simulator="iPad Pro (12.9-inch)"
```

### Option 3: Run on Physical Device
```bash
npx react-native run-ios --device "Your iPhone Name"
```

### Option 4: Using Xcode
1. Open `ios/mobileapp.xcworkspace` in Xcode (NOT .xcodeproj)
2. Select your target device/simulator
3. Click the Run button (▶️) or press `Cmd + R`

## Common Issues & Solutions

### Pod Install Fails
```bash
cd ios
pod deintegrate
pod install
cd ..
```

### Build Fails - Clean Build
```bash
cd ios
xcodebuild clean
cd ..
```

### Metro Bundler Issues
```bash
# Clear Metro cache
npx react-native start --reset-cache
```

### Full Clean & Rebuild
```bash
# Clean everything
rm -rf node_modules
rm -rf ios/Pods
rm -rf ios/build
npm install
cd ios && pod install && cd ..

# Run
npm run ios
```

### Xcode Build Error
1. Open Xcode: `ios/mobileapp.xcworkspace`
2. Product → Clean Build Folder (Shift + Cmd + K)
3. Product → Build (Cmd + B)

## Development

### Enable Live Reload
1. Shake device or press `Cmd + D` in simulator
2. Select "Enable Live Reload" or "Enable Fast Refresh"

### Debug Menu
- Simulator: Press `Cmd + D`
- Device: Shake the device

### View Logs
```bash
# React Native logs
npx react-native log-ios

# All iOS logs
xcrun simctl spawn booted log stream --level=debug
```

## Build for Production

### Create Release Build
```bash
# Using Xcode (Recommended)
# 1. Open ios/mobileapp.xcworkspace
# 2. Select "Any iOS Device" as target
# 3. Product → Archive
# 4. Follow the archive process

# Or using command line
npx react-native run-ios --configuration Release
```

## Simulator Management

### List Available Simulators
```bash
xcrun simctl list devices
```

### Open Simulator App
```bash
open -a Simulator
```

### Reset Simulator
```bash
xcrun simctl erase all
```

## Troubleshooting

### Error: "No bundle URL present"
```bash
rm -rf ios/build
npm start -- --reset-cache
```

### Error: "Unable to boot device"
```bash
# Quit Simulator and run:
xcrun simctl shutdown all
xcrun simctl erase all
```

### Error: Command PhaseScriptExecution failed
```bash
cd ios
pod deintegrate
rm -rf Pods Podfile.lock
pod install
cd ..
```

## System Requirements

- macOS (Monterey 12.0 or later recommended)
- Xcode 14.0 or later
- CocoaPods 1.11.0 or later
- Node.js 16.0 or later
- iOS Simulator or physical iOS device (iOS 13.0+)

## Quick Reference

```bash
# Install and run
npm install && cd ios && pod install && cd .. && npm run ios

# Clean and run
rm -rf node_modules ios/Pods && npm install && cd ios && pod install && cd .. && npm run ios

# Run with cache reset
npm start -- --reset-cache
# In new terminal:
npm run ios
```

//
//  NotificationBridge.m
//  mobileapp
//

#import "NotificationBridge.h"

#if __has_include(<RNCPushNotificationIOS/RNCPushNotificationIOS.h>)
#import <RNCPushNotificationIOS/RNCPushNotificationIOS.h>
#else
#import "RNCPushNotificationIOS.h"
#endif

@implementation NotificationBridge

+ (void)didRegisterForRemoteNotificationsWithDeviceToken:(NSData *)deviceToken {
  [RNCPushNotificationIOS didRegisterForRemoteNotificationsWithDeviceToken:deviceToken];
}

+ (void)didFailToRegisterForRemoteNotificationsWithError:(NSError *)error {
  [RNCPushNotificationIOS didFailToRegisterForRemoteNotificationsWithError:error];
}

+ (void)didReceiveRemoteNotification:(NSDictionary *)userInfo fetchCompletionHandler:(void (^)(UIBackgroundFetchResult))completionHandler {
  [RNCPushNotificationIOS didReceiveRemoteNotification:userInfo fetchCompletionHandler:completionHandler];
}

+ (void)didReceiveNotificationResponse:(UNNotificationResponse *)response {
  [RNCPushNotificationIOS didReceive:response];
}

@end

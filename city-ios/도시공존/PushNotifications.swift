import UIKit
import UserNotifications
import WebKit

func handleSubscribeTouch(message: WKScriptMessage) { }
func handleFCMToken() { }
func handlePushPermission() {
    UNUserNotificationCenter.current().getNotificationSettings { settings in
        switch settings.authorizationStatus {
        case .notDetermined:
            UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound]) { success, _ in
                DispatchQueue.main.async {
                    if success { UIApplication.shared.registerForRemoteNotifications() }
                }
            }
        default:
            break
        }
    }
}
func handlePushState() { }

func sendPushToWebView(userInfo: [AnyHashable: Any]) { }
func sendPushClickToWebView(userInfo: [AnyHashable: Any]) { }

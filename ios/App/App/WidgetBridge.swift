import Capacitor
import WidgetKit

/// Hands today's numbers to the home screen widgets through the shared App Group.
@objc(WidgetBridgePlugin)
public class WidgetBridgePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "WidgetBridgePlugin"
    public let jsName = "WidgetBridge"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "update", returnType: CAPPluginReturnPromise)
    ]

    static let appGroup = "group.com.forkful.app"

    @objc func update(_ call: CAPPluginCall) {
        guard let snapshot = call.getString("snapshot") else {
            call.reject("Missing snapshot")
            return
        }
        UserDefaults(suiteName: WidgetBridgePlugin.appGroup)?.set(snapshot, forKey: "snapshot")
        WidgetCenter.shared.reloadAllTimelines()
        call.resolve()
    }
}

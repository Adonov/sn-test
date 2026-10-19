import Capacitor

/// Registers the plugins that live in the app itself (not in an npm package).
class MainViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(WidgetBridgePlugin())
    }
}

import Capacitor

class CommandeIciViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(SecureSessionPlugin())
    }
}

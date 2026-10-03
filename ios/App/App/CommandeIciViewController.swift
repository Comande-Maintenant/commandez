import Capacitor
import WebKit

class CommandeIciViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(SecureSessionPlugin())
        bridge?.registerPluginInstance(FileExportPlugin())
        #if DEBUG
        // The UI test isolates the native export from the first-run guide.
        if ProcessInfo.processInfo.environment["COMMANDEICI_QA_QR"] == "1" {
            let script = "localStorage.setItem('cm_onboarding_done_demo', 'true'); localStorage.setItem('cm_onboarding_done_antalya-kebab-moneteau', 'true'); history.replaceState(null, '', '/admin/demo?view=qrcodes&lang=fr'); window.dispatchEvent(new PopStateEvent('popstate'));"
            webView?.configuration.userContentController.addUserScript(WKUserScript(source: script, injectionTime: .atDocumentEnd, forMainFrameOnly: true))
        }
        if ProcessInfo.processInfo.environment["COMMANDEICI_QA_DEMO"] == "1" {
            let script = "localStorage.setItem('cm_onboarding_done_demo', 'true'); localStorage.setItem('cm_onboarding_done_antalya-kebab-moneteau', 'true'); history.replaceState(null, '', '/admin/demo?view=cuisine&lang=fr'); window.dispatchEvent(new PopStateEvent('popstate'));"
            webView?.configuration.userContentController.addUserScript(WKUserScript(source: script, injectionTime: .atDocumentEnd, forMainFrameOnly: true))
        }
        if ProcessInfo.processInfo.environment["COMMANDEICI_QA_MENU"] == "1" {
            let script = "history.replaceState(null, '', '/demo?lang=fr'); window.dispatchEvent(new PopStateEvent('popstate'));"
            webView?.configuration.userContentController.addUserScript(WKUserScript(source: script, injectionTime: .atDocumentEnd, forMainFrameOnly: true))
        }
        #endif
    }
}

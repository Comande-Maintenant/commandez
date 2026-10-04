import UIKit
import WebKit

@main
final class ColdReference: UIResponder, UIApplicationDelegate, WKNavigationDelegate, WKScriptMessageHandler {
    private var window: UIWindow?
    private var webView: WKWebView?
    private let started = ProcessInfo.processInfo.systemUptime
    private var observations: [[String: Any]] = []

    private func record(_ event: String) {
        observations.append(["event": event, "uptime": ProcessInfo.processInfo.systemUptime,
            "milliseconds": (ProcessInfo.processInfo.systemUptime - started) * 1000,
            "pid": ProcessInfo.processInfo.processIdentifier,
            "utc": ISO8601DateFormatter().string(from: Date())])
        let file = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask)[0].appendingPathComponent("reference.json")
        try? JSONSerialization.data(withJSONObject: observations).write(to: file, options: .atomic)
    }

    func application(_ application: UIApplication, didFinishLaunchingWithOptions options: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        record("native-start")
        let configuration = WKWebViewConfiguration()
        configuration.userContentController.add(self, name: "referenceReady")
        let web = WKWebView(frame: UIScreen.main.bounds, configuration: configuration)
        web.navigationDelegate = self
        let controller = UIViewController()
        controller.view = web
        let screen = UIWindow(frame: UIScreen.main.bounds)
        screen.rootViewController = controller
        screen.makeKeyAndVisible()
        window = screen
        webView = web
        record("load-requested")
        web.loadHTMLString("""
          <html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head>
          <body style="margin:24px;background:white"><button style="min-height:44px;font-size:18px">Reference ready</button>
          <script>requestAnimationFrame(()=>requestAnimationFrame(()=>window.webkit.messageHandlers.referenceReady.postMessage('ready')))</script>
          </body></html>
          """, baseURL: nil)
        return true
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) { record("navigation-finished") }
    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.body as? String == "ready" else { return }
        record("document-frame-ready")
    }
}

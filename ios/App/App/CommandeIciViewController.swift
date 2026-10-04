import Capacitor
import WebKit
import UIKit

class CommandeIciViewController: CAPBridgeViewController {
    private let openingMinimumDuration: TimeInterval = 2.0
    private var openingCover: UIView?
    private var openingLogo: UIImageView?
    private var openingStarted: CFTimeInterval?
    private var openingObservation: NSKeyValueObservation?

    override func viewDidLoad() {
        super.viewDidLoad()
        let cover = UIView()
        cover.backgroundColor = .white
        cover.isAccessibilityElement = true
        cover.accessibilityLabel = "Commandeici"
        cover.accessibilityIdentifier = "commandeici-opening"
        cover.accessibilityViewIsModal = true
        cover.translatesAutoresizingMaskIntoConstraints = false
        let logo = UIImageView(image: UIImage(named: "LaunchMark"))
        logo.contentMode = .scaleAspectFit
        logo.translatesAutoresizingMaskIntoConstraints = false
        let wordmark = UILabel()
        wordmark.font = .systemFont(ofSize: 32, weight: .heavy)
        wordmark.textAlignment = .center
        wordmark.translatesAutoresizingMaskIntoConstraints = false
        let name = NSMutableAttributedString(string: "Commandeici", attributes: [.foregroundColor: UIColor(red: 0, green: 45/255, blue: 25/255, alpha: 1)])
        name.addAttribute(.foregroundColor, value: UIColor(red: 36/255, green: 133/255, blue: 30/255, alpha: 1), range: NSRange(location: 8, length: 3))
        wordmark.attributedText = name
        cover.addSubview(logo)
        cover.addSubview(wordmark)
        view.addSubview(cover)
        NSLayoutConstraint.activate([
            cover.leadingAnchor.constraint(equalTo: view.leadingAnchor), cover.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            cover.topAnchor.constraint(equalTo: view.topAnchor), cover.bottomAnchor.constraint(equalTo: view.bottomAnchor),
            logo.centerXAnchor.constraint(equalTo: cover.centerXAnchor), logo.centerYAnchor.constraint(equalTo: cover.centerYAnchor, constant: -34),
            logo.widthAnchor.constraint(equalToConstant: 176), logo.heightAnchor.constraint(equalToConstant: 176),
            wordmark.centerXAnchor.constraint(equalTo: cover.centerXAnchor), wordmark.centerYAnchor.constraint(equalTo: cover.centerYAnchor, constant: 86),
            wordmark.leadingAnchor.constraint(greaterThanOrEqualTo: cover.leadingAnchor, constant: 24),
            wordmark.trailingAnchor.constraint(lessThanOrEqualTo: cover.trailingAnchor, constant: -24)
        ])
        openingCover = cover
        openingLogo = logo
        webView?.accessibilityElementsHidden = true
        openingObservation = webView?.observe(\.isLoading, options: [.new]) { [weak self] _, _ in
            DispatchQueue.main.async { self?.dismissOpeningWhenReady() }
        }
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        guard openingStarted == nil, openingCover != nil else { return }
        // Start after the first native presentation, while WK loads underneath.
        DispatchQueue.main.async { [weak self] in
            guard let self, let logo = self.openingLogo else { return }
            self.openingStarted = CACurrentMediaTime()
            if !UIAccessibility.isReduceMotionEnabled {
                UIView.animateKeyframes(withDuration: 1.8, delay: 0, options: [.calculationModeCubic]) {
                    UIView.addKeyframe(withRelativeStartTime: 0, relativeDuration: 0.45) { logo.transform = CGAffineTransform(scaleX: 1.025, y: 1.025) }
                    UIView.addKeyframe(withRelativeStartTime: 0.45, relativeDuration: 0.55) { logo.transform = .identity }
                }
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + self.openingMinimumDuration) { [weak self] in self?.dismissOpeningWhenReady() }
            // Let the normal application show its recovery state if WK stalls.
            DispatchQueue.main.asyncAfter(deadline: .now() + 8) { [weak self] in self?.dismissOpeningWhenReady(force: true) }
        }
    }

    private func dismissOpeningWhenReady(force: Bool = false) {
        guard let cover = openingCover, let started = openingStarted,
              CACurrentMediaTime() - started >= openingMinimumDuration,
              force || webView?.isLoading != true else { return }
        openingCover = nil
        openingObservation = nil
        #if DEBUG
        // Simulator evidence records actual cover visibility, never user data.
        let evidence: [String: Any] = ["visibleSeconds": CACurrentMediaTime() - started, "reduceMotion": UIAccessibility.isReduceMotionEnabled, "forcedRecovery": force]
        if let directory = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first,
           let data = try? JSONSerialization.data(withJSONObject: evidence) {
            try? data.write(to: directory.appendingPathComponent("opening-evidence.json"), options: .atomic)
        }
        #endif
        UIView.animate(withDuration: UIAccessibility.isReduceMotionEnabled ? 0 : 0.24, animations: { cover.alpha = 0 }) { [weak self] _ in
            cover.removeFromSuperview()
            self?.webView?.accessibilityElementsHidden = false
            UIAccessibility.post(notification: .screenChanged, argument: nil)
        }
    }

    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(SecureSessionPlugin())
        bridge?.registerPluginInstance(FileExportPlugin())
        #if DEBUG
        if ProcessInfo.processInfo.environment["COMMANDEICI_QA_MENU"] == "1" {
            // Status-only boundary evidence for cold simulator starts. No URLs,
            // query strings, headers, response bodies or session values are saved.
            webView?.configuration.userContentController.add(QAReadinessHandler(), name: "qaReadiness")
            let diagnostic = """
            (() => {
              const original = window.fetch;
              const allowed = ['/rest/v1/rpc/get_public_restaurant_by_slug', '/rest/v1/menu_items'];
              window.fetch = function(...args) {
                let path;
                try { path = new URL(typeof args[0] === 'string' ? args[0] : args[0].url).pathname; } catch {}
                if (!allowed.includes(path)) return original.apply(this, args);
                const started = performance.now();
                const record = (event, status = 0) => window.webkit.messageHandlers.qaReadiness.postMessage({path,event,status,milliseconds:performance.now()-started});
                record('start');
                return original.apply(this, args).then(response => {record('finish',response.status); return response;}, error => {record('error'); throw error;});
              };
            })();
            """
            webView?.configuration.userContentController.addUserScript(WKUserScript(source: diagnostic, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        }
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

#if DEBUG
private final class QAReadinessHandler: NSObject, WKScriptMessageHandler {
    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let record = message.body as? [String: Any],
              let path = record["path"] as? String,
              ["/rest/v1/rpc/get_public_restaurant_by_slug", "/rest/v1/menu_items"].contains(path),
              let event = record["event"] as? String, ["start", "finish", "error"].contains(event),
              let status = record["status"] as? Int, let duration = record["milliseconds"] as? Double else { return }
        NativeQAReadiness.record(["boundary": path, "event": event, "status": status, "milliseconds": duration])
    }
}

enum NativeQAReadiness {
    private static let lock = NSLock()
    static func record(_ fields: [String: Any]) {
        guard ProcessInfo.processInfo.environment["COMMANDEICI_QA_MENU"] == "1",
              let directory = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first else { return }
        lock.lock()
        defer { lock.unlock() }
        var entry = fields
        entry["uptime"] = ProcessInfo.processInfo.systemUptime
        guard var bytes = try? JSONSerialization.data(withJSONObject: entry) else { return }
        bytes.append(10)
        let file = directory.appendingPathComponent("qa-readiness.ndjson")
        if !FileManager.default.fileExists(atPath: file.path) { FileManager.default.createFile(atPath: file.path, contents: nil) }
        guard let handle = try? FileHandle(forWritingTo: file) else { return }
        defer { try? handle.close() }
        do { try handle.seekToEnd(); try handle.write(contentsOf: bytes) } catch {}
    }
}
#endif

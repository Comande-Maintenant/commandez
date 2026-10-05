import Capacitor
import WebKit
import UIKit

class CommandeIciViewController: CAPBridgeViewController {
    private var openingCover: UIView?
    private var openingLogo: UIImageView?
    private var openingStarted: CFTimeInterval?
    private var openingObservation: NSKeyValueObservation?
    private var openingPolicy = OpeningRecoveryPolicy()
    private var openingContentReady = false
    private var openingTimer: Timer?
    private var openingRecovery: UIAlertController?

    override func viewDidLoad() {
        #if DEBUG
        NativeQAReadiness.record(["boundary": "native-view", "event": "start"])
        #endif
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
            DispatchQueue.main.async { self?.checkOpeningContent() }
        }
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        guard openingStarted == nil, openingCover != nil else { return }
        // Start after the first native presentation, while WK loads underneath.
        DispatchQueue.main.async { [weak self] in
            guard let self, let logo = self.openingLogo else { return }
            self.openingStarted = CACurrentMediaTime()
            #if DEBUG
            NativeQAReadiness.record(["boundary": "opening", "event": "start", "accessibilityHidden": self.webView?.accessibilityElementsHidden ?? false])
            #endif
            if !UIAccessibility.isReduceMotionEnabled {
                UIView.animateKeyframes(withDuration: 1.8, delay: 0, options: [.calculationModeCubic]) {
                    UIView.addKeyframe(withRelativeStartTime: 0, relativeDuration: 0.45) { logo.transform = CGAffineTransform(scaleX: 1.025, y: 1.025) }
                    UIView.addKeyframe(withRelativeStartTime: 0.45, relativeDuration: 0.55) { logo.transform = .identity }
                }
            }
            self.startOpeningTimer()
            self.checkOpeningContent()
        }
    }

    private func checkOpeningContent() {
        guard openingCover != nil, !openingContentReady, webView?.isLoading != true,
              let expected = bridge?.config.localURL, let actual = webView?.url,
              actual.scheme == expected.scheme, actual.host == expected.host,
              actual.port == expected.port else { return }
        webView?.evaluateJavaScript("Boolean(document.getElementById('root')?.childElementCount)") { [weak self] result, _ in
            guard result as? Bool == true else { return }
            self?.openingContentReady = true
            self?.advanceOpening()
        }
    }

    fileprivate func receiveOpeningReady(_ message: WKScriptMessage) {
        guard message.frameInfo.isMainFrame, message.body as? String == "ready",
              let expected = bridge?.config.localURL, let actual = message.frameInfo.request.url,
              actual.scheme == expected.scheme, actual.host == expected.host,
              actual.port == expected.port else { return }
        openingContentReady = true
        #if DEBUG
        NativeQAReadiness.record(["boundary": "opening-content", "event": "ready"])
        #endif
        advanceOpening()
    }

    private func advanceOpening() {
        guard openingCover != nil, let started = openingStarted else { return }
        let elapsed = CACurrentMediaTime() - started
        let action = openingPolicy.advance(elapsed: elapsed, contentReady: openingContentReady)
        switch action {
        case .wait: break
        case .dismiss: dismissOpening()
        case .reload: reloadOpening()
        case .recover: showOpeningRecovery()
        }
    }

    private func startOpeningTimer() {
        openingTimer?.invalidate()
        openingTimer = Timer.scheduledTimer(withTimeInterval: 0.25, repeats: true) { [weak self] _ in
            self?.advanceOpening()
        }
    }

    private func reloadOpening() {
        openingRecovery = nil
        startOpeningTimer()
        #if DEBUG
        NativeQAReadiness.record(["boundary": "opening", "event": "reload"])
        #endif
        // Capacitor retains its delegate, local origin and persisted session.
        loadWebView()
    }

    private func showOpeningRecovery() {
        guard openingCover != nil else { return }
        openingTimer?.invalidate()
        openingTimer = nil
        let french = Locale.preferredLanguages.first?.hasPrefix("fr") == true
        let recovery = UIAlertController(
            title: "Commandeici",
            message: french ? "L’ouverture prend plus de temps que prévu." : "Opening is taking longer than expected.",
            preferredStyle: .alert
        )
        recovery.addAction(UIAlertAction(title: french ? "Réessayer" : "Try again", style: .default) { [weak self] _ in
            self?.retryOpening()
        })
        openingRecovery = recovery
        present(recovery, animated: !UIAccessibility.isReduceMotionEnabled)
        #if DEBUG
        NativeQAReadiness.record(["boundary": "opening", "event": "recover"])
        #endif
    }

    @objc private func retryOpening() {
        guard let started = openingStarted,
              openingPolicy.retry(elapsed: CACurrentMediaTime() - started) == .reload else { return }
        reloadOpening()
    }

    private func dismissOpening() {
        guard let cover = openingCover, let started = openingStarted else { return }
        openingTimer?.invalidate()
        openingTimer = nil
        openingRecovery?.dismiss(animated: false)
        openingRecovery = nil
        openingCover = nil
        openingObservation = nil
        #if DEBUG
        NativeQAReadiness.record(["boundary": "opening", "event": "dismiss", "forcedRecovery": false, "accessibilityHidden": webView?.accessibilityElementsHidden ?? false, "milliseconds": (CACurrentMediaTime() - started) * 1000])
        // Simulator evidence records actual cover visibility, never user data.
        let evidence: [String: Any] = ["visibleSeconds": CACurrentMediaTime() - started, "reduceMotion": UIAccessibility.isReduceMotionEnabled, "forcedRecovery": false]
        if let directory = FileManager.default.urls(for: .documentDirectory, in: .userDomainMask).first,
           let data = try? JSONSerialization.data(withJSONObject: evidence) {
            try? data.write(to: directory.appendingPathComponent("opening-evidence.json"), options: .atomic)
        }
        #endif
        UIView.animate(withDuration: UIAccessibility.isReduceMotionEnabled ? 0 : 0.24, animations: { cover.alpha = 0 }) { [weak self] _ in
            cover.removeFromSuperview()
            self?.webView?.accessibilityElementsHidden = false
            #if DEBUG
            NativeQAReadiness.record(["boundary": "opening", "event": "finish", "accessibilityHidden": self?.webView?.accessibilityElementsHidden ?? false])
            #endif
            UIAccessibility.post(notification: .screenChanged, argument: nil)
        }
    }

    override func capacitorDidLoad() {
        bridge?.registerPluginInstance(SecureSessionPlugin())
        bridge?.registerPluginInstance(FileExportPlugin())
        let content = webView?.configuration.userContentController
        content?.add(OpeningReadinessHandler(owner: self), name: "openingReadiness")
        let readiness = """
        (() => {
          const observer = new MutationObserver(report);
          function report() {
            if (document.getElementById('root')?.childElementCount > 0) {
              window.webkit.messageHandlers.openingReadiness.postMessage('ready');
              observer.disconnect();
            }
          }
          observer.observe(document, {childList:true,subtree:true});
          report();
        })();
        """
        content?.addUserScript(WKUserScript(source: readiness, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        #if DEBUG
        NativeQAReadiness.record(["boundary": "native-bridge", "event": "ready"])
        if ProcessInfo.processInfo.environment["COMMANDEICI_QA_MENU"] == "1" {
            // Status-only boundary evidence for cold simulator starts. No URLs,
            // query strings, headers, response bodies or session values are saved.
            webView?.configuration.userContentController.add(QAReadinessHandler(), name: "qaReadiness")
            let diagnostic = """
            (() => {
              const report = (path, event, status = 0) => window.webkit.messageHandlers.qaReadiness.postMessage({path,event,status,milliseconds:performance.now()});
              report('/qa/document', 'start');
              document.addEventListener('DOMContentLoaded', () => report('/qa/document', 'finish'), {once:true});
              const observer = new MutationObserver(() => {
                if (document.getElementById('root')?.childElementCount > 0) {
                  report('/qa/root-content', 'finish'); observer.disconnect();
                }
              });
              observer.observe(document, {childList:true,subtree:true});
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

private final class OpeningReadinessHandler: NSObject, WKScriptMessageHandler {
    private weak var owner: CommandeIciViewController?
    init(owner: CommandeIciViewController) { self.owner = owner }
    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        owner?.receiveOpeningReady(message)
    }
}

#if DEBUG
private final class QAReadinessHandler: NSObject, WKScriptMessageHandler {
    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let record = message.body as? [String: Any],
              let path = record["path"] as? String,
              ["/rest/v1/rpc/get_public_restaurant_by_slug", "/rest/v1/menu_items", "/qa/document", "/qa/root-content"].contains(path),
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
        entry["pid"] = ProcessInfo.processInfo.processIdentifier
        entry["utc"] = ISO8601DateFormatter().string(from: Date())
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

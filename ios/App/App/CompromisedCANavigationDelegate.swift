import Foundation
import WebKit

/// Adds only the compromised-root rejection; forwards all existing Capacitor navigation callbacks.
final class CompromisedCANavigationDelegate: NSObject, WKNavigationDelegate {
    private let original: (any WKNavigationDelegate)?

    init(original: (any WKNavigationDelegate)?) {
        self.original = original
        super.init()
    }

    override func responds(to selector: Selector!) -> Bool {
        super.responds(to: selector) || (original?.responds(to: selector) ?? false)
    }

    override func forwardingTarget(for selector: Selector!) -> Any? {
        if original?.responds(to: selector) == true { return original }
        return super.forwardingTarget(for: selector)
    }

    func webView(_ webView: WKWebView, didReceive challenge: URLAuthenticationChallenge,
                 completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void) {
        if challenge.protectionSpace.authenticationMethod == NSURLAuthenticationMethodServerTrust {
            guard let trust = challenge.protectionSpace.serverTrust, !CompromisedCATrustPolicy.mustReject(trust) else {
                completionHandler(.cancelAuthenticationChallenge, nil)
                return
            }
        }
        if let original,
           original.responds(to: #selector(WKNavigationDelegate.webView(_:didReceive:completionHandler:))) {
            original.webView?(webView, didReceive: challenge, completionHandler: completionHandler)
        } else {
            completionHandler(.performDefaultHandling, nil)
        }
    }
}

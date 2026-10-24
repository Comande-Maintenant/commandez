import Foundation
import Security
import CryptoKit

/// Rejects the four compromised eMudhra roots while retaining normal platform TLS validation.
/// The certificate hashes are public SHA-256 DER fingerprints, not leaf/SPKI pins.
enum CompromisedCATrustPolicy {
    static let blockedCertificateSHA256: Set<String> = [
        "7dd78d5f4f13459a83dff9abbba62edbaf6f2d102bf257fd712f4d9f2746ed8d",
        "f2edaaff3d9b701fb4d14c9f285f8c0bad90fc3bcc1fa07d47f4718edaba34a5",
        "d7a7a0fb5d7e2731d771e9484ebcdef71d5f0c3e0a2948782bc83ee0ea699ef4",
        "86a1ecba089c4a8d3bbe2734c612ba341d813e043cf9e8a862cd5c57a36bbe6b"
    ]

    static func mustReject(_ trust: SecTrust) -> Bool {
        // Build the evaluated chain, including its selected anchor. Keep its existing hostname/policies.
        _ = SecTrustEvaluateWithError(trust, nil)
        guard let chain = SecTrustCopyCertificateChain(trust) as? [SecCertificate], !chain.isEmpty else {
            return true
        }
        return chain.contains { certificate in
            let data = SecCertificateCopyData(certificate) as Data
            let fingerprint = SHA256.hash(data: data).map { String(format: "%02x", $0) }.joined()
            return blockedCertificateSHA256.contains(fingerprint)
        }
    }
}

final class CompromisedCATrustSessionDelegate: NSObject, URLSessionDelegate, @unchecked Sendable {
    func urlSession(_ session: URLSession, didReceive challenge: URLAuthenticationChallenge,
                    completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void) {
        guard challenge.protectionSpace.authenticationMethod == NSURLAuthenticationMethodServerTrust else {
            completionHandler(.performDefaultHandling, nil)
            return
        }
        guard let trust = challenge.protectionSpace.serverTrust, !CompromisedCATrustPolicy.mustReject(trust) else {
            completionHandler(.cancelAuthenticationChallenge, nil)
            return
        }
        completionHandler(.performDefaultHandling, nil)
    }
}

enum ProtectedHTTPS {
    static let session = URLSession(configuration: .default,
                                    delegate: CompromisedCATrustSessionDelegate(), delegateQueue: nil)
}

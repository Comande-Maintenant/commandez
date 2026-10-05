import Capacitor
import Security
import UIKit

@objc(SecureSessionPlugin)
public class SecureSessionPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SecureSessionPlugin"
    public let jsName = "SecureSession"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "get", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "set", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "remove", returnType: CAPPluginReturnPromise)
    ]
    private let service = "com.commandeici.app.session"
    private func query(_ key: String) -> [String: Any] {
        return [kSecClass as String: kSecClassGenericPassword,
                kSecAttrService as String: service, kSecAttrAccount as String: key]
    }
    private func key(_ call: CAPPluginCall) -> String? {
        guard let value = call.getString("key"), value == "commandeici_auth" || value.hasPrefix("commandeici_auth-") || ["commandeici_push_token", "commandeici_push_installation_id", "commandeici_push_installation_secret"].contains(value) else {
            call.reject("Invalid session key"); return nil
        }
        return value
    }
    @objc func get(_ call: CAPPluginCall) {
        guard let key = key(call) else { return }
        var request = query(key)
        request[kSecReturnData as String] = true
        request[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: CFTypeRef?
        #if DEBUG
        let started = ProcessInfo.processInfo.systemUptime
        NativeQAReadiness.record(["boundary": "secure-session-read", "event": "start"])
        #endif
        let status = SecItemCopyMatching(request as CFDictionary, &result)
        #if DEBUG
        NativeQAReadiness.record(["boundary": "secure-session-read", "event": "finish", "status": Int(status), "milliseconds": (ProcessInfo.processInfo.systemUptime - started) * 1000])
        #endif
        if status == errSecItemNotFound { call.resolve(["value": NSNull()]); return }
        guard status == errSecSuccess, let data = result as? Data, let value = String(data: data, encoding: .utf8) else {
            call.reject("Session read failed", String(status)); return
        }
        call.resolve(["value": value])
    }
    @objc func set(_ call: CAPPluginCall) {
        guard let key = key(call), let value = call.getString("value"), let data = value.data(using: .utf8) else { call.reject("Invalid session"); return }
        let request = query(key)
        let attributes: [String: Any] = [kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly]
        var status = SecItemUpdate(request as CFDictionary, attributes as CFDictionary)
        if status == errSecItemNotFound {
            var insertion = request
            for (key, value) in attributes { insertion[key] = value }
            status = SecItemAdd(insertion as CFDictionary, nil)
        }
        guard status == errSecSuccess else { call.reject("Session write failed", String(status)); return }
        call.resolve()
    }
    @objc func remove(_ call: CAPPluginCall) {
        guard let key = key(call) else { return }
        let status = SecItemDelete(query(key) as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else { call.reject("Session removal failed", String(status)); return }
        call.resolve()
    }
}

// Public QR/PDF exports use a share sheet because WKWebView does not support
// the web application's anchor downloads. Files are isolated and removed when
// the sheet closes, including cancellation and export failures.
@objc(FileExportPlugin)
public class FileExportPlugin: CAPPlugin, CAPBridgedPlugin {
    private var exportInProgress = false
    public let identifier = "FileExportPlugin"
    public let jsName = "FileExport"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "share", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openExternalUrl", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "openNotificationSettings", returnType: CAPPluginReturnPromise)
    ]

    @objc func openNotificationSettings(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let url = URL(string: UIApplication.openSettingsURLString) else {
                call.reject("Settings unavailable"); return
            }
            UIApplication.shared.open(url, options: [:]) { opened in
                if opened { call.resolve() } else { call.reject("Settings unavailable") }
            }
        }
    }

    @objc func openExternalUrl(_ call: CAPPluginCall) {
        guard let input = call.getString("url"), let parts = URLComponents(string: input),
              parts.scheme?.lowercased() == "https", let host = parts.host, !host.isEmpty,
              parts.user == nil, parts.password == nil, parts.port == nil || parts.port == 443,
              let url = parts.url else {
            call.reject("Invalid external URL"); return
        }
        DispatchQueue.main.async {
            UIApplication.shared.open(url, options: [:]) { opened in
                if opened { call.resolve() }
                else { call.reject("External browser unavailable") }
            }
        }
    }

    @objc func share(_ call: CAPPluginCall) {
        let extensions = ["image/png": ".png", "image/svg+xml": ".svg", "application/pdf": ".pdf"]
        guard let filename = call.getString("filename"),
              filename.range(of: "^[a-zA-Z0-9][a-zA-Z0-9._-]{0,199}$", options: .regularExpression) != nil,
              let mimeType = call.getString("mimeType"), let suffix = extensions[mimeType], filename.hasSuffix(suffix),
              let base64 = call.getString("base64"), base64.utf8.count <= 28 * 1024 * 1024,
              let data = Data(base64Encoded: base64), !data.isEmpty, data.count <= 20 * 1024 * 1024 else {
            call.reject("Invalid export file"); return
        }
        let directory = FileManager.default.temporaryDirectory
            .appendingPathComponent("commandeici-exports", isDirectory: true)
            .appendingPathComponent(UUID().uuidString, isDirectory: true)
        let url = directory.appendingPathComponent(filename, isDirectory: false)
        do {
            try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
            try data.write(to: url, options: .atomic)
        } catch {
            try? FileManager.default.removeItem(at: directory)
            call.reject("File export failed"); return
        }
        DispatchQueue.main.async { [weak self] in
            guard let controller = self?.bridge?.viewController, controller.viewIfLoaded?.window != nil else {
                try? FileManager.default.removeItem(at: directory)
                call.reject("File export unavailable"); return
            }
            guard self?.exportInProgress == false else {
                try? FileManager.default.removeItem(at: directory)
                call.reject("File export already in progress"); return
            }
            self?.exportInProgress = true
            let presenter = controller.presentedViewController ?? controller
            let activity = UIActivityViewController(activityItems: [url], applicationActivities: nil)
            activity.completionWithItemsHandler = { _, completed, _, error in
                self?.exportInProgress = false
                try? FileManager.default.removeItem(at: directory)
                if error != nil { call.reject("File export failed") }
                else { call.resolve(["completed": completed]) }
            }
            if let popover = activity.popoverPresentationController {
                popover.sourceView = presenter.view
                popover.sourceRect = CGRect(x: presenter.view.bounds.midX, y: presenter.view.bounds.midY, width: 0, height: 0)
                popover.permittedArrowDirections = []
            }
            presenter.present(activity, animated: true)
        }
    }
}

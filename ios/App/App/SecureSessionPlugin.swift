import Capacitor
import Security

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
        guard let value = call.getString("key"), value == "commandeici_auth" || value.hasPrefix("commandeici_auth-") else {
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
        let status = SecItemCopyMatching(request as CFDictionary, &result)
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

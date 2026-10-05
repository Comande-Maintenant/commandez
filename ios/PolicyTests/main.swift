import Foundation

@main enum OpeningPolicyChecks {
    static func main() {
        var failures = 0
        func expect(_ actual: OpeningRecoveryPolicy.Action, _ expected: OpeningRecoveryPolicy.Action, _ name: String) {
            if actual != expected { failures += 1; print("FAIL: \(name): \(actual) expected \(expected)") }
            else { print("PASS: \(name)") }
        }
        var fast = OpeningRecoveryPolicy()
        expect(fast.advance(elapsed: 1.99, contentReady: true), .wait, "two-second minimum")
        expect(fast.advance(elapsed: 2, contentReady: true), .dismiss, "ready content presented")
        expect(fast.advance(elapsed: 100, contentReady: false), .wait, "never reload presented UI")
        var cold = OpeningRecoveryPolicy()
        expect(cold.retry(elapsed: 1), .wait, "manual retry only in recovery")
        expect(cold.advance(elapsed: 7.99, contentReady: false), .wait, "do not expose empty WK")
        expect(cold.advance(elapsed: 8, contentReady: false), .reload, "one initial local reload")
        expect(cold.advance(elapsed: 9, contentReady: false), .wait, "no repeated automatic reload")
        expect(cold.advance(elapsed: 17.99, contentReady: false), .wait, "bounded reload grace")
        expect(cold.advance(elapsed: 18, contentReady: false), .recover, "accessible recovery required")
        expect(cold.advance(elapsed: 19, contentReady: false), .wait, "no repeated recovery event")
        expect(cold.retry(elapsed: 20), .reload, "explicit manual retry")
        expect(cold.advance(elapsed: 29.99, contentReady: false), .wait, "manual retry no automatic reload")
        expect(cold.advance(elapsed: 30, contentReady: false), .recover, "manual retry bounded")
        expect(cold.advance(elapsed: 31, contentReady: true), .dismiss, "late readiness releases recovery")
        expect(cold.retry(elapsed: 32), .wait, "retry forbidden after content presented")
        var delayed = OpeningRecoveryPolicy()
        expect(delayed.advance(elapsed: 8.5, contentReady: false), .reload, "delayed native callback reloads once")
        expect(delayed.advance(elapsed: 18, contentReady: false), .wait, "recovery grants ten seconds after actual reload")
        expect(delayed.advance(elapsed: 18.5, contentReady: false), .recover, "delayed reload remains bounded")
        if failures > 0 { print("\(failures) failed"); exit(1) }
        print("18 opening policy checks passed")
    }
}

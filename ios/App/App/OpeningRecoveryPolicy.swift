import Foundation

// Initial presentation only; never reload an interactive application.
struct OpeningRecoveryPolicy {
    enum Action: Equatable { case wait, dismiss, reload, recover }
    private(set) var finished = false
    private var reloaded = false
    private var recovering = false
    private var recoveryDeadline: TimeInterval = 18

    mutating func advance(elapsed: TimeInterval, contentReady: Bool) -> Action {
        guard !finished else { return .wait }
        if contentReady && elapsed >= 2 {
            finished = true
            return .dismiss
        }
        if !reloaded && elapsed >= 8 {
            reloaded = true
            recoveryDeadline = elapsed + 10
            return .reload
        }
        if elapsed >= recoveryDeadline && !recovering {
            recovering = true
            return .recover
        }
        return .wait
    }

    mutating func retry(elapsed: TimeInterval) -> Action {
        guard recovering && !finished else { return .wait }
        recovering = false
        reloaded = true
        recoveryDeadline = elapsed + 10
        return .reload
    }
}

import XCTest
final class CommandeIciUITests: XCTestCase {
    func testNativeStartupAndRegistration() {
        continueAfterFailure = false
        let app = XCUIApplication()
        app.launch()
        let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        for name in ["Ouvrir", "Open", "Annuler", "Cancel"] {
            if springboard.buttons[name].exists { springboard.buttons[name].tap(); break }
        }
        XCTAssertTrue(app.webViews.firstMatch.waitForExistence(timeout: 15))
        let create = app.webViews.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'page'")).firstMatch
        XCTAssertTrue(create.waitForExistence(timeout: 15))
        create.tap()
        XCTAssertTrue(app.webViews.textFields.firstMatch.waitForExistence(timeout: 10))
        XCTAssertTrue(app.webViews.secureTextFields.firstMatch.exists)
        let shot = XCTAttachment(screenshot: app.screenshot()); shot.name = "Inscription iOS"; shot.lifetime = .keepAlways; add(shot)
    }
}

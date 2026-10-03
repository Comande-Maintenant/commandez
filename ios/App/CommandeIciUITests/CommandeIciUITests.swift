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
        let create = app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'page'")).firstMatch
        XCTAssertTrue(create.waitForExistence(timeout: 15))
        create.tap()
        XCTAssertTrue(app.webViews.textFields.firstMatch.waitForExistence(timeout: 10))
        XCTAssertTrue(app.webViews.secureTextFields.firstMatch.exists)
        let shot = XCTAttachment(screenshot: app.screenshot()); shot.name = "Inscription iOS"; shot.lifetime = .keepAlways; add(shot)
    }

    func testNativeDemoQRCodeShareSheet() {
        continueAfterFailure = false
        let app = XCUIApplication()
        app.launchEnvironment["COMMANDEICI_QA_QR"] = "1"
        app.launch()
        XCTAssertTrue(app.webViews.firstMatch.waitForExistence(timeout: 15))
        let png = app.buttons["PNG"].firstMatch
        XCTAssertTrue(png.waitForExistence(timeout: 10))
        png.tap()
        XCTAssertTrue(app.otherElements["ActivityListView"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.otherElements.matching(NSPredicate(format: "label CONTAINS 'Image PNG'")).firstMatch.exists)
        if let more = app.cells.matching(identifier: "Plus").allElementsBoundByIndex.last { more.tap() }
        let save = app.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS[c] 'Fichiers' OR label CONTAINS[c] 'Save to Files'")).firstMatch
        XCTAssertTrue(save.waitForExistence(timeout: 10), app.debugDescription)
        let shot = XCTAttachment(screenshot: app.screenshot()); shot.name = "QR PNG partage iOS"; shot.lifetime = .keepAlways; add(shot)
    }
}

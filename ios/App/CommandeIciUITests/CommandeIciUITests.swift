import XCTest
final class CommandeIciUITests: XCTestCase {
    func testNativeStartupAndRegistration() {
        continueAfterFailure = false
        let app = XCUIApplication()
        app.launchEnvironment = [:]
        app.launchArguments = []
        app.launch()
        let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        for name in ["Ouvrir", "Open", "Annuler", "Cancel"] {
            if springboard.buttons[name].exists { springboard.buttons[name].tap(); break }
        }
        XCTAssertTrue(app.webViews.firstMatch.waitForExistence(timeout: 15))
        let create = app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'page'")).firstMatch
        XCTAssertTrue(create.waitForExistence(timeout: 15))
        XCTAssertGreaterThanOrEqual(create.frame.minY, 50, "Header must clear the iPhone status bar")
        create.tap()
        XCTAssertTrue(app.webViews.textFields.firstMatch.waitForExistence(timeout: 10), app.debugDescription)
        XCTAssertTrue(app.webViews.secureTextFields.firstMatch.exists)
        let header = app.links["commandeici"].firstMatch
        let accountStep = app.staticTexts["Compte"].firstMatch
        XCTAssertTrue(header.exists && accountStep.exists, app.debugDescription)
        XCTAssertLessThanOrEqual(header.frame.maxY, accountStep.frame.minY, "Signup steps must stay below the header")
        let shot = XCTAttachment(screenshot: app.screenshot()); shot.name = "Inscription iOS"; shot.lifetime = .keepAlways; add(shot)
    }

    func testNativeDemoQRCodeShareSheet() {
        continueAfterFailure = false
        let app = XCUIApplication()
        app.launchEnvironment = [:]
        app.launchArguments = []
        app.launchEnvironment["COMMANDEICI_QA_QR"] = "1"
        app.launch()
        XCTAssertTrue(app.webViews.firstMatch.waitForExistence(timeout: 15))
        let png = app.buttons["PNG"].firstMatch
        XCTAssertTrue(png.waitForExistence(timeout: 10), app.debugDescription)
        png.tap()
        XCTAssertTrue(app.otherElements["ActivityListView"].waitForExistence(timeout: 10))
        XCTAssertTrue(app.otherElements.matching(NSPredicate(format: "label CONTAINS 'Image PNG'")).firstMatch.exists)
        let save = app.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS[c] 'Fichiers' OR label CONTAINS[c] 'Save to Files'")).firstMatch
        if !save.isHittable { app.otherElements["ActivityListView"].swipeUp() }
        XCTAssertTrue(save.waitForExistence(timeout: 10), app.debugDescription)
        let shot = XCTAttachment(screenshot: app.screenshot()); shot.name = "QR PNG partage iOS"; shot.lifetime = .keepAlways; add(shot)
    }
    func testNativeDemoPublicLinkCopy() {
        continueAfterFailure = false
        let app = XCUIApplication()
        app.launchEnvironment = [:]
        app.launchArguments = []
        app.launchEnvironment["COMMANDEICI_QA_QR"] = "1"
        app.launch()
        let copy = app.buttons["Copier"].firstMatch
        let ready = copy.waitForExistence(timeout: 15)
        if !ready {
            let shot = XCTAttachment(screenshot: app.screenshot()); shot.name = "QR test route failure"; shot.lifetime = .keepAlways; add(shot)
        }
        XCTAssertTrue(ready, app.debugDescription)
        copy.tap()
        XCTAssertTrue(app.buttons["Copie !"].firstMatch.waitForExistence(timeout: 3), app.debugDescription)
    }


    func testNativeDemoOrderAndNotification() {
        continueAfterFailure = false
        let app = XCUIApplication()
        app.launchEnvironment = [:]
        app.launchArguments = []
        app.launchEnvironment["COMMANDEICI_QA_DEMO"] = "1"
        app.launch()
        let receive = app.buttons["Recevoir une commande"].firstMatch
        XCTAssertTrue(receive.waitForExistence(timeout: 20), app.debugDescription)
        receive.tap()
        let view = app.buttons["Voir la commande"].firstMatch
        XCTAssertTrue(view.waitForExistence(timeout: 5), app.debugDescription)
        view.tap()
        let accept = app.buttons.matching(NSPredicate(format: "label CONTAINS[c] 'Accepter'")).firstMatch
        XCTAssertTrue(accept.waitForExistence(timeout: 5), app.debugDescription)
        accept.tap()
        let close = app.buttons["Fermer"].firstMatch
        if close.waitForExistence(timeout: 3) { close.tap() }
        let test = app.buttons["Tester la notification iOS"].firstMatch
        XCTAssertTrue(test.waitForExistence(timeout: 5), app.debugDescription)
        test.tap()
        let springboard = XCUIApplication(bundleIdentifier: "com.apple.springboard")
        let allow = springboard.buttons.matching(NSPredicate(format: "label == 'Autoriser' OR label == 'Allow'")).firstMatch
        if allow.waitForExistence(timeout: 3) { allow.tap() }
        XCUIDevice.shared.press(.home)
        let banner = springboard.staticTexts["CommandeIci · Démonstration"].firstMatch
        XCTAssertTrue(banner.waitForExistence(timeout: 15), springboard.debugDescription)
        let shot = XCTAttachment(screenshot: springboard.screenshot())
        shot.name = "Notification iOS locale de demonstration"
        shot.lifetime = .keepAlways
        add(shot)
    }

    func testNativeMenuVisuals() {
        continueAfterFailure = false
        let app = XCUIApplication()
        app.launchEnvironment = [:]
        app.launchArguments = []
        app.launchEnvironment["COMMANDEICI_QA_MENU"] = "1"
        app.launch()
        XCTAssertTrue(app.webViews.firstMatch.waitForExistence(timeout: 15))
        let create = app.links.matching(NSPredicate(format: "label CONTAINS[c] 'page restaurant'")).firstMatch
        XCTAssertTrue(create.waitForExistence(timeout: 15), app.debugDescription)
        XCTAssertGreaterThanOrEqual(create.frame.minY, 50, "Demo banner must clear the iPhone status bar")
        let image = app.buttons.matching(NSPredicate(format: "label BEGINSWITH 'Kebab' AND label CONTAINS 'Illustration'")).firstMatch
        XCTAssertTrue(image.waitForExistence(timeout: 15), app.debugDescription)
        if !image.isHittable { app.swipeUp() }
        XCTAssertTrue(image.isHittable, app.debugDescription)
        let shot = XCTAttachment(screenshot: app.screenshot())
        shot.name = "Carte visuelle native iOS"
        shot.lifetime = .keepAlways
        add(shot)
    }

    func testNativeCustomerCartClearsHomeIndicator() {
        continueAfterFailure = false
        let app = XCUIApplication()
        app.launchEnvironment = ["COMMANDEICI_QA_MENU": "1"]
        app.launchArguments = []
        app.launch()
        let kebab = app.buttons.matching(NSPredicate(format: "label BEGINSWITH 'Kebab' AND label CONTAINS 'Illustration'")).firstMatch
        XCTAssertTrue(kebab.waitForExistence(timeout: 15), app.debugDescription)
        if !kebab.isHittable { app.swipeUp() }
        kebab.tap()
        let full = app.buttons["Complet"].firstMatch
        XCTAssertTrue(full.waitForExistence(timeout: 5), app.debugDescription)
        full.tap()
        for _ in 0..<3 {
            let next = app.buttons["Suivant"].firstMatch
            XCTAssertTrue(next.waitForExistence(timeout: 5), app.debugDescription)
            next.tap()
        }
        let addButton = app.buttons.matching(NSPredicate(format: "label BEGINSWITH 'Ajouter à la commande'")).firstMatch
        XCTAssertTrue(addButton.waitForExistence(timeout: 5), app.debugDescription)
        addButton.tap()
        let cart = app.buttons.matching(NSPredicate(format: "label CONTAINS 'Voir la commande'")).firstMatch
        XCTAssertTrue(cart.waitForExistence(timeout: 5), app.debugDescription)
        let clear = NSPredicate { object, _ in
            guard let button = object as? XCUIElement else { return false }
            return button.frame.maxY <= app.frame.height - 34
        }
        let settled = expectation(for: clear, evaluatedWith: cart)
        let result = XCTWaiter.wait(for: [settled], timeout: 3)
        XCTAssertEqual(result, .completed, "Cart action must stay above the 34-point home indicator")
        cart.tap()
        let checkout = app.buttons.matching(NSPredicate(format: "label BEGINSWITH 'Commander'")).firstMatch
        XCTAssertTrue(checkout.waitForExistence(timeout: 5), app.debugDescription)
        XCTAssertLessThanOrEqual(checkout.frame.maxY, app.frame.height - 34)
        XCTAssertGreaterThanOrEqual(app.staticTexts["Votre commande"].firstMatch.frame.minY, 50)
        let shot = XCTAttachment(screenshot: app.screenshot()); shot.name = "Panier client iOS"; shot.lifetime = .keepAlways; add(shot)
    }
}

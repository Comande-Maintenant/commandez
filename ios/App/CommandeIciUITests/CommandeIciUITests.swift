import XCTest
final class CommandeIciUITests: XCTestCase {
    func testNativeRegistrationKeyboardKeepsActionsReachable() {
        continueAfterFailure = false
        let app = XCUIApplication()
        app.launchEnvironment = [:]
        app.launchArguments = []
        app.launch()
        let create = app.buttons["Créer ma page gratuitement"].firstMatch
        XCTAssertTrue(create.waitForExistence(timeout: 15), app.debugDescription)
        create.tap()
        let email = app.webViews.textFields.firstMatch
        XCTAssertTrue(email.waitForExistence(timeout: 10), app.debugDescription)
        XCTAssertGreaterThanOrEqual(email.frame.height, 44)
        email.tap()
        email.typeText("audit@example.invalid")
        let keyboard = app.keyboards.firstMatch
        XCTAssertTrue(keyboard.waitForExistence(timeout: 5), app.debugDescription)
        let assistant = app.otherElements["SystemInputAssistantView"].firstMatch
        func keyboardTop() -> CGFloat { assistant.exists ? min(assistant.frame.minY, keyboard.frame.minY) : keyboard.frame.minY }
        XCTAssertLessThanOrEqual(email.frame.maxY, keyboardTop())
        let submit = app.buttons["Créer mon compte"].firstMatch
        for _ in 0..<4 {
            if submit.isHittable && (!keyboard.exists || submit.frame.maxY <= keyboardTop()) { break }
            let screen = app.coordinate(withNormalizedOffset: CGVector(dx: 0, dy: 0))
            let bottom = keyboard.exists ? keyboardTop() - 24 : app.frame.maxY - 80
            let start = screen.withOffset(CGVector(dx: app.frame.midX, dy: bottom))
            let end = screen.withOffset(CGVector(dx: app.frame.midX, dy: max(120, bottom - 280)))
            start.press(forDuration: 0.05, thenDragTo: end)
        }
        XCTAssertTrue(submit.isHittable, app.debugDescription)
        XCTAssertTrue(keyboard.exists, "Keyboard-open layout must be verified before capture")
        XCTAssertLessThanOrEqual(submit.frame.maxY, keyboardTop())
        let shot = XCTAttachment(screenshot: app.screenshot()); shot.name = "Inscription clavier et action accessibles"; shot.lifetime = .keepAlways; add(shot)
    }
    func testNativeReadyOrderKeepsCashierActionClearOfNavigation() {
        continueAfterFailure = false
        let app = XCUIApplication()
        app.launchEnvironment = ["COMMANDEICI_QA_DEMO": "1"]
        app.launchArguments = []
        app.launch()
        let receive = app.buttons["Recevoir une commande"].firstMatch
        XCTAssertTrue(receive.waitForExistence(timeout: 15), app.debugDescription)
        receive.tap()
        let view = app.buttons["Voir la commande"].firstMatch
        XCTAssertTrue(view.waitForExistence(timeout: 5), app.debugDescription); view.tap()
        let accept = app.buttons["Accepter la commande"].firstMatch
        XCTAssertTrue(accept.waitForExistence(timeout: 5), app.debugDescription); accept.tap()
        let close = app.buttons["Fermer"].firstMatch
        if close.waitForExistence(timeout: 2) { close.tap() }
        let ready = app.buttons["Prête"].firstMatch
        XCTAssertTrue(ready.waitForExistence(timeout: 5), app.debugDescription)
        for _ in 0..<4 { if ready.isHittable { break }; app.webViews.firstMatch.swipeUp() }
        ready.tap()
        let cash = app.buttons.matching(NSPredicate(format: "label CONTAINS 'Caisse'")).firstMatch
        XCTAssertTrue(cash.waitForExistence(timeout: 5), app.debugDescription)
        XCTAssertTrue(cash.label.contains("1"), cash.label); cash.tap()
        let collect = app.buttons["Encaisse"].firstMatch
        XCTAssertTrue(collect.waitForExistence(timeout: 5), app.debugDescription)
        for _ in 0..<4 { if collect.isHittable && collect.frame.maxY <= cash.frame.minY { break }; app.webViews.firstMatch.swipeUp() }
        XCTAssertTrue(collect.isHittable, app.debugDescription)
        XCTAssertLessThanOrEqual(collect.frame.maxY, cash.frame.minY)
        let shot = XCTAttachment(screenshot: app.screenshot()); shot.name = "Caisse action au-dessus de navigation"; shot.lifetime = .keepAlways; add(shot)
        collect.tap()
        XCTAssertFalse(cash.label.contains("1"), cash.label)
    }

    func testNativeHistoryAlwaysHasAnExit() {
        continueAfterFailure = false
        let app = XCUIApplication()
        app.launchArguments = []
        app.launchEnvironment = ["COMMANDEICI_QA_DEMO": "1"]
        app.launch()
        let history = app.buttons["Historique (24h)"].firstMatch
        XCTAssertTrue(history.waitForExistence(timeout: 15), app.debugDescription)
        history.tap()
        let back = app.buttons["Retour"].firstMatch
        let close = app.buttons["Fermer"].firstMatch
        XCTAssertTrue(back.waitForExistence(timeout: 5), app.debugDescription)
        XCTAssertTrue(back.isHittable && close.isHittable, app.debugDescription)
        XCTAssertGreaterThanOrEqual(back.frame.height, 44)
        let shot = XCTAttachment(screenshot: app.screenshot()); shot.name = "Historique avec sorties permanentes"; shot.lifetime = .keepAlways; add(shot)
        back.tap()
        XCTAssertTrue(app.buttons["Recevoir une commande"].firstMatch.waitForExistence(timeout: 5), app.debugDescription)
    }
    func testNativeGroceryDemo() { checkCommerceDemo(name: "Épicerie", product: "Panier de saison") }
    func testNativeFloristDemo() { checkCommerceDemo(name: "Fleuriste", product: "Bouquet de saison") }
    private func checkCommerceDemo(name: String, product: String) {
        continueAfterFailure = false
        let app = XCUIApplication()
        app.launchEnvironment = [:]
        app.launchArguments = []
        app.launch()
        let discover = app.buttons["Tester sans créer de compte"].firstMatch
        XCTAssertTrue(discover.waitForExistence(timeout: 15), app.debugDescription)
        XCTAssertFalse(app.otherElements["commandeici-opening"].exists, "Opening must leave the application accessible")
        discover.tap()
        let sector = app.links.matching(NSPredicate(format: "label CONTAINS %@", name)).firstMatch
        XCTAssertTrue(sector.waitForExistence(timeout: 10), app.debugDescription)
        sector.tap()
        let addButton = app.buttons.matching(NSPredicate(format: "label == %@ OR label == %@", "Ajouter " + product, "Choisir " + product)).firstMatch
        XCTAssertTrue(addButton.waitForExistence(timeout: 10), app.debugDescription)
        for _ in 0..<5 { if addButton.isHittable { break }; app.swipeUp() }
        addButton.tap()
        let confirmProduct = app.buttons.matching(NSPredicate(format: "label BEGINSWITH 'Ajouter au panier'")).firstMatch
        XCTAssertTrue(confirmProduct.waitForExistence(timeout: 5), app.debugDescription)
        confirmProduct.tap()
        let basket = app.buttons.matching(NSPredicate(format: "label BEGINSWITH 'Voir mon panier'")).firstMatch
        XCTAssertTrue(basket.waitForExistence(timeout: 5), app.debugDescription)
        basket.tap()
        let simulate = app.buttons.matching(NSPredicate(format: "label BEGINSWITH 'Simuler la commande'")).firstMatch
        XCTAssertTrue(simulate.waitForExistence(timeout: 5), app.debugDescription)
        XCTAssertLessThanOrEqual(simulate.frame.maxY, app.frame.height - 34)
        simulate.tap()
        for label in ["Préparer la commande", "Marquer comme prête"] {
            let action = app.buttons[label].firstMatch
            XCTAssertTrue(action.waitForExistence(timeout: 5), app.debugDescription)
            for _ in 0..<4 { if action.isHittable { break }; app.swipeUp() }
            action.tap()
        }
        let cash = app.buttons.matching(NSPredicate(format: "label CONTAINS 'Caisse'")).firstMatch
        XCTAssertTrue(cash.waitForExistence(timeout: 5), app.debugDescription)
        cash.tap()
        let collect = app.buttons["Commande retirée"].firstMatch
        XCTAssertTrue(collect.waitForExistence(timeout: 5), app.debugDescription)
        for _ in 0..<4 { if collect.isHittable { break }; app.swipeUp() }
        collect.tap()
        let signup = app.links["Créer ma page gratuitement"].firstMatch
        XCTAssertTrue(signup.waitForExistence(timeout: 5), app.debugDescription)
        let shot = XCTAttachment(screenshot: app.screenshot()); shot.name = name + " commande locale retirée"; shot.lifetime = .keepAlways; add(shot)
    }

    func testNativeFirstLaunchInvitesDemo() {
        continueAfterFailure = false
        let app = XCUIApplication()
        app.launchEnvironment = [:]
        app.launchArguments = []
        app.launch()
        let demo = app.buttons["Tester sans créer de compte"].firstMatch
        XCTAssertTrue(demo.waitForExistence(timeout: 15), app.debugDescription)
        XCTAssertTrue(demo.isHittable, "Primary demo action must be available on first launch")
        demo.tap()
        let restaurant = app.links.matching(NSPredicate(format: "label CONTAINS 'Restauration'")).firstMatch
        XCTAssertTrue(restaurant.waitForExistence(timeout: 10), app.debugDescription)
        restaurant.tap()
        let receive = app.buttons["Recevoir une commande"].firstMatch
        XCTAssertTrue(receive.waitForExistence(timeout: 15), app.debugDescription)
        XCTAssertTrue(receive.isHittable, "The inline guide must leave its first action accessible")
        let shot = XCTAttachment(screenshot: app.screenshot()); shot.name = "Découverte et guide démo iOS"; shot.lifetime = .keepAlways; add(shot)
    }

    func testNativeMenuSearchAndClear() {
        continueAfterFailure = false
        let app = XCUIApplication()
        app.launchEnvironment = ["COMMANDEICI_QA_MENU": "1"]
        app.launchArguments = []
        app.launch()
        let field = app.webViews.searchFields.firstMatch
        XCTAssertTrue(field.waitForExistence(timeout: 15), app.debugDescription)
        if !field.isHittable { app.swipeUp() }
        field.tap()
        // iOS may present its own first-use bilingual keyboard guide. Its
        // modal consumes the first outside tap, including a tap on Clear.
        let keyboardGuide = app.buttons.matching(NSPredicate(format: "label == 'Continue' OR label == 'Continuer'")).firstMatch
        if keyboardGuide.waitForExistence(timeout: 1) { keyboardGuide.tap() }
        field.typeText("zzzz-no-product")
        XCTAssertTrue(app.staticTexts["Aucun plat trouvé. Essayez un autre mot."].firstMatch.waitForExistence(timeout: 5), app.debugDescription)
        // There is also a reset action below the empty-result text. With
        // the keyboard open, AX can order that covered action first. Select
        // the clear control on the input row instead.
        let clearActions = app.buttons.matching(identifier: "Effacer la recherche").allElementsBoundByIndex
        guard let clear = clearActions.first(where: { abs($0.frame.midY - field.frame.midY) < 4 }) else {
            XCTFail("The search row must expose its clear action"); return
        }
        XCTAssertTrue(clear.isHittable, app.debugDescription)
        clear.tap()
        // WK exposes a truncated placeholder as AX value when a field is empty.
        // The cleared state removes its action and restores the actual products.
        let cleared = expectation(for: NSPredicate(format: "exists == false"), evaluatedWith: clear)
        XCTAssertEqual(XCTWaiter.wait(for: [cleared], timeout: 3), .completed, "Clear must leave an empty search")
        XCTAssertFalse((field.value as? String ?? "").contains("zzzz-no-product"))
        XCTAssertTrue(app.buttons.matching(NSPredicate(format: "label BEGINSWITH 'Kebab' AND label CONTAINS 'Illustration'")).firstMatch.waitForExistence(timeout: 5), app.debugDescription)
        let shot = XCTAttachment(screenshot: app.screenshot()); shot.name = "Recherche carte iOS"; shot.lifetime = .keepAlways; add(shot)
    }

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
        let file = app.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS 'qr-antalya-kebab-moneteau.png'")).firstMatch
        XCTAssertTrue(file.waitForExistence(timeout: 10), app.debugDescription)
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
        // A cart persisted by a previous journey must remain fully reachable.
        let cart = app.buttons.matching(NSPredicate(format: "label CONTAINS 'Voir la commande'")).firstMatch
        if cart.exists {
            let settled = NSPredicate { _, _ in
                cart.isHittable && cart.frame.maxY <= app.frame.height - 34
            }
            expectation(for: settled, evaluatedWith: cart)
            waitForExpectations(timeout: 5)
            XCTAssertGreaterThanOrEqual(cart.frame.height, 44)
        }
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
        app.terminate()
        app.launch()
        XCTAssertTrue(cart.waitForExistence(timeout: 15), "The customer's cart must survive reopening the menu")
        let restored = expectation(for: clear, evaluatedWith: cart)
        XCTAssertEqual(XCTWaiter.wait(for: [restored], timeout: 5), .completed)
        XCTAssertTrue(cart.isHittable)
        cart.tap()
        let checkout = app.buttons.matching(NSPredicate(format: "label BEGINSWITH 'Commander'")).firstMatch
        XCTAssertTrue(checkout.waitForExistence(timeout: 5), app.debugDescription)
        XCTAssertLessThanOrEqual(checkout.frame.maxY, app.frame.height - 34)
        XCTAssertGreaterThanOrEqual(app.staticTexts["Votre commande"].firstMatch.frame.minY, 50)
        let shot = XCTAttachment(screenshot: app.screenshot()); shot.name = "Panier client iOS"; shot.lifetime = .keepAlways; add(shot)
    }

    func testNativeTacosWithOneMeat() {
        checkNativeMeatSelection(product: "Tacos", base: "Tacos Normal", meats: ["Kebab"], price: "8.00")
    }

    func testNativeAssietteWithTwoMeats() {
        checkNativeMeatSelection(product: "Assiette", base: "Grande assiette", meats: ["Kebab", "Poulet"], price: "13.00")
    }

    private func checkNativeMeatSelection(product: String, base: String, meats: [String], price: String) {
        continueAfterFailure = false
        let app = XCUIApplication()
        app.launchEnvironment = ["COMMANDEICI_QA_MENU": "1"]
        app.launchArguments = []
        app.launch()
        let card = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@ AND label CONTAINS 'Illustration'", product)).firstMatch
        XCTAssertTrue(card.waitForExistence(timeout: 15), app.debugDescription)
        for _ in 0..<6 { if card.isHittable { break }; app.swipeUp() }
        card.tap()
        let size = app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@", base)).firstMatch
        XCTAssertTrue(size.waitForExistence(timeout: 5), app.debugDescription)
        size.tap()
        let next = app.buttons["Suivant"].firstMatch
        XCTAssertTrue(next.waitForExistence(timeout: 5), app.debugDescription)
        XCTAssertFalse(next.isEnabled)
        for meat in meats {
            app.buttons.matching(NSPredicate(format: "label BEGINSWITH %@ AND NOT label CONTAINS 'Illustration'", meat)).firstMatch.tap()
        }
        XCTAssertTrue(next.isEnabled)
        next.tap()
        let addButton = app.buttons.matching(NSPredicate(format: "label BEGINSWITH 'Ajouter à la commande'")).firstMatch
        for _ in 0..<10 {
            if addButton.exists { break }
            let full = app.buttons["Complet"].firstMatch
            if full.exists { full.tap() } else { XCTAssertTrue(next.isEnabled, app.debugDescription); next.tap() }
        }
        XCTAssertTrue(addButton.waitForExistence(timeout: 5), app.debugDescription)
        XCTAssertTrue(addButton.label.contains(price + " €"), addButton.label)
        let shot = XCTAttachment(screenshot: app.screenshot()); shot.name = product + " prix et viandes iOS"; shot.lifetime = .keepAlways; add(shot)
        addButton.tap()
        XCTAssertTrue(app.buttons.matching(NSPredicate(format: "label CONTAINS 'Voir la commande'")).firstMatch.waitForExistence(timeout: 5), app.debugDescription)
    }
}

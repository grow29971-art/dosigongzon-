import UIKit
import WebKit
import AuthenticationServices
import CryptoKit

var gWebView: WKWebView!

@objc(ViewController)
class ViewController: UIViewController, WKNavigationDelegate, WKScriptMessageHandler,
                      ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {

    @IBOutlet weak var loadingView: UIView!
    @IBOutlet weak var progressView: UIProgressView!
    @IBOutlet weak var connectionProblemView: UIImageView!
    @IBOutlet weak var webviewView: UIView!


    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .white

        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []

        let onboardingScript = WKUserScript(
            source: "try{localStorage.setItem('dosigongzon_onboarded','true');}catch(e){}",
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        )
        config.userContentController.addUserScript(onboardingScript)
        config.userContentController.add(self, name: "nativeAppleSignIn")

        gWebView = WKWebView(frame: view.bounds, configuration: config)
        gWebView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        gWebView.backgroundColor = .white
        gWebView.scrollView.backgroundColor = .white
        gWebView.navigationDelegate = self
        gWebView.uiDelegate = self
        if #available(iOS 15.0, *) {
            gWebView.underPageBackgroundColor = .white
        }
        gWebView.customUserAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1 PWAShell"

        if let host = URL(string: "https://dosigongzon.com")?.host,
           let cookie = HTTPCookie(properties: [
               .domain: host,
               .path: "/",
               .name: "app-platform",
               .value: "iOS App Store",
               .expires: NSDate(timeIntervalSinceNow: 31556926)
           ]) {
            gWebView.configuration.websiteDataStore.httpCookieStore.setCookie(cookie)
        }

        view.addSubview(gWebView)
        gWebView.load(URLRequest(url: URL(string: "https://dosigongzon.com?ios=1")!))
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        loadingView?.isHidden = true
    }

    // MARK: - WKScriptMessageHandler
    // JS(lib/native-apple-signin.ts)가 window.webkit.messageHandlers.nativeAppleSignIn.postMessage(null) 로 호출.
    // WKWebView 안에서 Apple OAuth 리다이렉트를 돌리면 무한 로딩(App Store 반려 2.1(a), 2026-07-05)이라
    // 네이티브 ASAuthorizationController로 identityToken을 받아 JS로 넘기고, JS가 Supabase signInWithIdToken을 한다.
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "nativeAppleSignIn" else { return }
        DispatchQueue.main.async { [weak self] in
            self?.startNativeAppleSignIn()
        }
    }

    private var currentNonce: String?

    private func startNativeAppleSignIn() {
        let nonce = Self.randomNonce()
        currentNonce = nonce
        let request = ASAuthorizationAppleIDProvider().createRequest()
        request.requestedScopes = [.fullName, .email]
        request.nonce = Self.sha256(nonce)  // Apple에는 해시를, Supabase에는 원문을 보낸다
        let controller = ASAuthorizationController(authorizationRequests: [request])
        controller.delegate = self
        controller.presentationContextProvider = self
        controller.performRequests()
    }

    private static func randomNonce(length: Int = 32) -> String {
        let charset = Array("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-._")
        var result = ""
        var remaining = length
        while remaining > 0 {
            var random: UInt8 = 0
            let status = SecRandomCopyBytes(kSecRandomDefault, 1, &random)
            if status != errSecSuccess { fatalError("SecRandomCopyBytes failed: \(status)") }
            if random < charset.count {
                result.append(charset[Int(random)])
                remaining -= 1
            }
        }
        return result
    }

    private static func sha256(_ input: String) -> String {
        let hashed = SHA256.hash(data: Data(input.utf8))
        return hashed.compactMap { String(format: "%02x", $0) }.joined()
    }

    private func jsString(_ s: String) -> String {
        return s.replacingOccurrences(of: "\\", with: "\\\\").replacingOccurrences(of: "'", with: "\\'")
    }

    private func reportAppleError(_ msg: String) {
        gWebView.evaluateJavaScript("window.__appleSignInError && window.__appleSignInError('\(jsString(msg))')", completionHandler: nil)
    }

    // MARK: - ASAuthorizationControllerDelegate
    func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
              let tokenData = credential.identityToken,
              let token = String(data: tokenData, encoding: .utf8),
              let nonce = currentNonce else {
            reportAppleError("no_identity_token")
            return
        }
        currentNonce = nil
        gWebView.evaluateJavaScript(
            "window.__appleSignInSuccess && window.__appleSignInSuccess('\(jsString(token))', '\(jsString(nonce))')",
            completionHandler: nil
        )
    }

    func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        currentNonce = nil
        let code = (error as? ASAuthorizationError)?.code.rawValue ?? -1
        // 1001 = canceled — JS 쪽에서 "1001"/"cancel"로 구분해 에러 표시를 생략한다
        reportAppleError("apple_auth_error \(code): \(error.localizedDescription)")
    }

    // MARK: - ASAuthorizationControllerPresentationContextProviding
    func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        return view.window!
    }
}

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

    private var currentNonce: String?

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .white

        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true

        // 온보딩 스킵
        let onboardingScript = WKUserScript(
            source: "try{localStorage.setItem('dosigongzon_onboarded','true');}catch(e){}",
            injectionTime: .atDocumentStart,
            forMainFrameOnly: true
        )
        config.userContentController.addUserScript(onboardingScript)

        // 웹에서 네이티브 Apple Sign In 요청 수신
        config.userContentController.add(self, name: "nativeAppleSignIn")

        gWebView = WKWebView(frame: view.bounds, configuration: config)
        gWebView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        gWebView.backgroundColor = .white
        gWebView.scrollView.backgroundColor = .white
        gWebView.navigationDelegate = self
        if #available(iOS 15.0, *) {
            gWebView.underPageBackgroundColor = .white
        }
        gWebView.customUserAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1 PWAShell"

        // 플랫폼 쿠키
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
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "nativeAppleSignIn" else { return }
        startNativeAppleSignIn()
    }

    // MARK: - Native Sign in with Apple
    private func startNativeAppleSignIn() {
        let nonce = randomNonceString()
        currentNonce = nonce

        let request = ASAuthorizationAppleIDProvider().createRequest()
        request.requestedScopes = [.fullName, .email]
        request.nonce = sha256(nonce)

        let controller = ASAuthorizationController(authorizationRequests: [request])
        controller.delegate = self
        controller.presentationContextProvider = self
        controller.performRequests()
    }

    // MARK: - ASAuthorizationControllerDelegate
    func authorizationController(controller: ASAuthorizationController,
                                 didCompleteWithAuthorization authorization: ASAuthorization) {
        guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
              let tokenData = credential.identityToken,
              let identityToken = String(data: tokenData, encoding: .utf8),
              let nonce = currentNonce else {
            gWebView.evaluateJavaScript("window.__appleSignInError('credential_error')", completionHandler: nil)
            return
        }
        let escapedToken = identityToken
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "'", with: "\\'")
        let escapedNonce = nonce
            .replacingOccurrences(of: "\\", with: "\\\\")
            .replacingOccurrences(of: "'", with: "\\'")
        gWebView.evaluateJavaScript("window.__appleSignInSuccess('\(escapedToken)','\(escapedNonce)')",
                                    completionHandler: nil)
    }

    func authorizationController(controller: ASAuthorizationController,
                                 didCompleteWithError error: Error) {
        let msg = error.localizedDescription.replacingOccurrences(of: "'", with: "\\'")
        gWebView.evaluateJavaScript("window.__appleSignInError('\(msg)')", completionHandler: nil)
    }

    // MARK: - ASAuthorizationControllerPresentationContextProviding
    func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        return view.window!
    }

    // MARK: - Helpers
    private func randomNonceString(length: Int = 32) -> String {
        var randomBytes = [UInt8](repeating: 0, count: length)
        _ = SecRandomCopyBytes(kSecRandomDefault, randomBytes.count, &randomBytes)
        let charset = Array("0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._")
        return String(randomBytes.map { charset[Int($0) % charset.count] })
    }

    private func sha256(_ input: String) -> String {
        let data = Data(input.utf8)
        let hash = SHA256.hash(data: data)
        return hash.compactMap { String(format: "%02x", $0) }.joined()
    }
}

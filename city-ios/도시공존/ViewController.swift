import UIKit
import WebKit
import AuthenticationServices

var gWebView: WKWebView!

@objc(ViewController)
class ViewController: UIViewController, WKNavigationDelegate, WKScriptMessageHandler,
                      ASWebAuthenticationPresentationContextProviding {

    @IBOutlet weak var loadingView: UIView!
    @IBOutlet weak var progressView: UIProgressView!
    @IBOutlet weak var connectionProblemView: UIImageView!
    @IBOutlet weak var webviewView: UIView!

    private var authSession: ASWebAuthenticationSession?

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .white

        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true

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
    // JS가 window.webkit.messageHandlers.nativeAppleSignIn.postMessage(oauthUrl) 로 호출
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard message.name == "nativeAppleSignIn",
              let urlString = message.body as? String,
              let url = URL(string: urlString) else { return }

        DispatchQueue.main.async { [weak self] in
            guard let self = self else { return }
            self.authSession = ASWebAuthenticationSession(
                url: url,
                callbackURLScheme: "dosigongzon"
            ) { callbackURL, error in
                DispatchQueue.main.async {
                    if let callbackURL = callbackURL {
                        let escaped = callbackURL.absoluteString
                            .replacingOccurrences(of: "\\", with: "\\\\")
                            .replacingOccurrences(of: "'", with: "\\'")
                        gWebView.evaluateJavaScript("window.__appleOAuthCallback('\(escaped)')", completionHandler: nil)
                    } else {
                        let msg = (error?.localizedDescription ?? "cancelled")
                            .replacingOccurrences(of: "'", with: "\\'")
                        gWebView.evaluateJavaScript("window.__appleSignInError('\(msg)')", completionHandler: nil)
                    }
                }
            }
            self.authSession?.presentationContextProvider = self
            self.authSession?.prefersEphemeralWebBrowserSession = false
            self.authSession?.start()
        }
    }

    // MARK: - ASWebAuthenticationPresentationContextProviding
    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
        return view.window!
    }
}

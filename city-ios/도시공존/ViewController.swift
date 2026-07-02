import UIKit
import WebKit

var gWebView: WKWebView!

@objc(ViewController)
class ViewController: UIViewController, WKNavigationDelegate {

    @IBOutlet weak var loadingView: UIView!
    @IBOutlet weak var progressView: UIProgressView!
    @IBOutlet weak var connectionProblemView: UIImageView!
    @IBOutlet weak var webviewView: UIView!

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

        gWebView = WKWebView(frame: view.bounds, configuration: config)
        gWebView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        gWebView.backgroundColor = .white
        gWebView.scrollView.backgroundColor = .white
        gWebView.navigationDelegate = self
        if #available(iOS 15.0, *) {
            gWebView.underPageBackgroundColor = .white
        }
        // PWAShell 포함 UA → 웹앱이 iOS 앱임을 감지해 온보딩 스킵
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
        gWebView.load(URLRequest(url: URL(string: "https://dosigongzon.com")!))
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        loadingView?.isHidden = true
    }
}

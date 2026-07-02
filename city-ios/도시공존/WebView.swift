import UIKit
import WebKit
import SafariServices

func calcWebviewFrame(webviewView: UIView, toolbarView: UIToolbar?) -> CGRect {
    return CGRect(x: 0, y: 0, width: webviewView.frame.width, height: webviewView.frame.height)
}

extension ViewController: WKUIDelegate {
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if navigationAction.targetFrame == nil {
            webView.load(navigationAction.request)
        }
        return nil
    }

    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        // iframe 등 서브프레임은 모두 허용 (Turnstile, 카카오맵 등 외부 위젯)
        if navigationAction.targetFrame?.isMainFrame == false {
            decisionHandler(.allow)
            return
        }
        guard let url = navigationAction.request.url else {
            decisionHandler(.cancel)
            return
        }
        // 앱 도메인 + OAuth 공급자는 WKWebView 안에서 처리
        // (SFSafariViewController로 보내면 localStorage가 달라 PKCE 검증 실패)
        let inAppHosts = ["dosigongzon.com", "supabase.co",
                          "accounts.google.com", "kauth.kakao.com", "accounts.kakao.com"]
        if url.scheme == "about" || inAppHosts.contains(where: { url.host?.contains($0) == true }) {
            decisionHandler(.allow)
            return
        }
        decisionHandler(.cancel)
        if ["http", "https"].contains(url.scheme ?? "") {
            let safari = SFSafariViewController(url: url)
            present(safari, animated: true)
        } else if UIApplication.shared.canOpenURL(url) {
            UIApplication.shared.open(url)
        }
    }
}

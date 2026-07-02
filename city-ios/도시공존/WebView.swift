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
        guard let url = navigationAction.request.url else {
            decisionHandler(.cancel)
            return
        }
        if url.scheme == "about" || url.host?.contains("dosigongzon.com") == true {
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

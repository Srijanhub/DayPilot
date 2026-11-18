import Cocoa
import WebKit
import AVFoundation

class AppDelegate: NSObject, NSApplicationDelegate, NSWindowDelegate, WKUIDelegate, WKNavigationDelegate {
    var window: NSWindow!
    var webView: WKWebView!

    func applicationDidFinishLaunching(_ notification: Notification) {
        // Explicitly trigger macOS System Microphone Permission Prompt
        if #available(macOS 10.14, *) {
            let status = AVCaptureDevice.authorizationStatus(for: .audio)
            if status == .notDetermined {
                AVCaptureDevice.requestAccess(for: .audio) { granted in
                    NSLog("[DayPilot] System microphone permission result: \(granted)")
                }
            }
        }
        let screenRect = NSScreen.main?.visibleFrame ?? NSRect(x: 0, y: 0, width: 1280, height: 800)
        let windowWidth: CGFloat = min(1280, screenRect.width * 0.9)
        let windowHeight: CGFloat = min(840, screenRect.height * 0.9)
        let windowRect = NSRect(
            x: (screenRect.width - windowWidth) / 2 + screenRect.origin.x,
            y: (screenRect.height - windowHeight) / 2 + screenRect.origin.y,
            width: windowWidth,
            height: windowHeight
        )

        let styleMask: NSWindow.StyleMask = [
            .titled,
            .closable,
            .miniaturizable,
            .resizable,
            .fullSizeContentView
        ]

        window = NSWindow(
            contentRect: windowRect,
            styleMask: styleMask,
            backing: .buffered,
            defer: false
        )

        window.title = "DayPilot — Flight Deck"
        window.titlebarAppearsTransparent = true
        window.titleVisibility = .hidden
        window.appearance = NSAppearance(named: .darkAqua)
        window.backgroundColor = NSColor(red: 0.05, green: 0.05, blue: 0.07, alpha: 1.0)
        window.isMovableByWindowBackground = true
        window.minSize = NSSize(width: 960, height: 600)
        window.collectionBehavior = [.fullScreenPrimary, .fullScreenAllowsTiling]
        window.delegate = self

        // WebKit Configuration
        let config = WKWebViewConfiguration()
        config.preferences.setValue(true, forKey: "developerExtrasEnabled")
        
        webView = WKWebView(frame: window.contentView!.bounds, configuration: config)
        webView.autoresizingMask = [.width, .height]
        webView.setValue(false, forKey: "drawsBackground") // Transparent background while loading
        webView.uiDelegate = self
        webView.navigationDelegate = self

        window.contentView!.addSubview(webView)
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)

        // Load Next.js App
        if let url = URL(string: "http://localhost:3000") {
            let request = URLRequest(url: url)
            webView.load(request)
        }
    }

    @available(macOS 12.0, *)
    func webView(_ webView: WKWebView, requestMediaCapturePermissionFor origin: WKSecurityOrigin, initiatedByFrame frame: WKFrameInfo, type: WKMediaCaptureType, decisionHandler: @escaping (WKPermissionDecision) -> Void) {
        decisionHandler(.grant)
    }

    // Specifically opens external links in Opera GX as default browser
    private func openInOperaGX(url: URL) {
        if let operaUrl = NSWorkspace.shared.urlForApplication(withBundleIdentifier: "com.operasoftware.OperaGX") {
            let config = NSWorkspace.OpenConfiguration()
            NSWorkspace.shared.open([url], withApplicationAt: operaUrl, configuration: config, completionHandler: nil)
        } else {
            let proc = Process()
            proc.executableURL = URL(fileURLWithPath: "/usr/bin/open")
            proc.arguments = ["-a", "Opera GX", url.absoluteString]
            try? proc.run()
        }
    }

    // Opens <a target="_blank"> links in Opera GX
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = navigationAction.request.url {
            openInOperaGX(url: url)
        }
        return nil
    }

    // Opens external links in Opera GX rather than navigating away inside the Flight Deck
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        if let url = navigationAction.request.url {
            if let host = url.host, (host == "localhost" || host == "127.0.0.1") {
                decisionHandler(.allow)
                return
            }

            if navigationAction.navigationType == .linkActivated || navigationAction.targetFrame == nil {
                openInOperaGX(url: url)
                decisionHandler(.cancel)
                return
            }
        }
        decisionHandler(.allow)
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool {
        return true
    }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.setActivationPolicy(.regular)
app.run()

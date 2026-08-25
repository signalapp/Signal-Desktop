import Foundation
import SwiftUI
import Translation

// Anchor view: an otherwise-invisible SwiftUI view whose only job is to host
// the `.translationPresentation` modifier, which is a SwiftUI-only API (no
// AppKit equivalent) that pops the system Translate UI — the same UI Safari
// and Notes show — anchored to this view's position on screen.
@available(macOS 15.0, *)
private struct TranslateAnchorView: View {
    @State var isPresented: Bool = true
    let text: String
    let onDismiss: () -> Void

    var body: some View {
        Color.clear
            .frame(width: 1, height: 1)
            .translationPresentation(isPresented: $isPresented, text: text)
            .onChange(of: isPresented) { _, newValue in
                if !newValue {
                    onDismiss()
                }
            }
    }
}

@objc
public class TranslateCode: NSObject {
    private static var window: NSWindow?
    private static var closedCallback: (() -> Void)?

    @objc
    public static func isAvailable() -> Bool {
        if #available(macOS 15.0, *) {
            return true
        }
        return false
    }

    @objc
    public static func setClosedCallback(_ callback: @escaping () -> Void) {
        closedCallback = callback
    }

    @objc
    public static func showTranslation(forText text: String) -> Void {
        guard #available(macOS 15.0, *) else { return }
        guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }

        closeExistingWindow()

        let mouseLocation = NSEvent.mouseLocation
        let view = TranslateAnchorView(text: text, onDismiss: {
            closeExistingWindow()
            closedCallback?()
        })
        let hostingView = NSHostingView(rootView: view)
        hostingView.frame = NSRect(x: 0, y: 0, width: 1, height: 1)

        // A 1x1 borderless, non-activating, transparent panel. It exists only
        // to give the SwiftUI translationPresentation popover a screen anchor
        // near the user's selection/click — it is never itself visible.
        let panel = NSPanel(
            contentRect: NSRect(x: mouseLocation.x, y: mouseLocation.y, width: 1, height: 1),
            styleMask: [.borderless, .nonactivatingPanel],
            backing: .buffered,
            defer: false
        )
        panel.isOpaque = false
        panel.backgroundColor = .clear
        panel.hasShadow = false
        panel.level = .popUpMenu
        panel.contentView = hostingView
        panel.orderFrontRegardless()

        window = panel
    }

    private static func closeExistingWindow() {
        window?.orderOut(nil)
        window = nil
    }
}

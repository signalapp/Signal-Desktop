import Foundation
import Translation
import NaturalLanguage

// Headless batch translation — no popover, no SwiftUI view required. This is
// deliberately macOS 26+ only: `TranslationSession.init(installedSource:target:)`
// (the non-SwiftUI-hosted way to get a session) was introduced in macOS 26,
// not macOS 15 like the presentation-popover API in TranslateCode.swift.
//
// Confirmed by direct compiler check (not docs, which are wrong on this):
// `init(installedSource:target:)` is NON-throwing. Failure to translate
// (e.g. models not installed) surfaces later, from `translations(from:)`.
//
// Confirmed by a standalone spike: this hangs indefinitely — no error, no
// timeout — if there's no live NSApplication run loop to receive the XPC
// reply from the system Translation daemon. Electron's main process always
// has one, so this is a non-issue in Signal, but it's why this must never be
// called from a bare script/test without a running NSApplication.
@available(macOS 26.0, *)
private actor SessionRegistry {
    private struct Entry {
        let session: TranslationSession
        var lastUsed: Date
    }

    static let shared = SessionRegistry()

    private var entries: [String: Entry] = [:]
    private let maxEntries = 3
    private let idleTimeout: TimeInterval = 5 * 60
    private var evictionTask: Task<Void, Never>?

    private func key(_ source: String, _ target: String) -> String {
        "\(source)->\(target)"
    }

    func session(source: String, target: String) -> TranslationSession {
        let k = key(source, target)
        if var entry = entries[k] {
            entry.lastUsed = Date()
            entries[k] = entry
            return entry.session
        }

        if entries.count >= maxEntries {
            evictOldest()
        }

        let session = TranslationSession(
            installedSource: Locale.Language(identifier: source),
            target: Locale.Language(identifier: target)
        )
        entries[k] = Entry(session: session, lastUsed: Date())
        startEvictionLoopIfNeeded()
        return session
    }

    private func evictOldest() {
        guard let oldest = entries.min(by: { $0.value.lastUsed < $1.value.lastUsed }) else {
            return
        }
        entries.removeValue(forKey: oldest.key)
    }

    private func startEvictionLoopIfNeeded() {
        guard evictionTask == nil else { return }
        evictionTask = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 60 * 1_000_000_000)
                guard let self, !Task.isCancelled else { return }
                await self.evictIdle()
            }
        }
    }

    private func evictIdle() {
        let now = Date()
        entries = entries.filter { now.timeIntervalSince($0.value.lastUsed) < idleTimeout }
    }

    func shutdown() {
        evictionTask?.cancel()
        evictionTask = nil
        entries.removeAll()
    }
}

@objc
public class TranslateSession: NSObject {
    @objc
    public static func isBatchAvailable() -> Bool {
        if #available(macOS 26.0, *) {
            return true
        }
        return false
    }

    // Synchronous — NLLanguageRecognizer does its work locally and fast
    // enough not to need the async bridge. Returns "" for undetermined.
    @objc
    public static func detectLanguages(_ texts: [String]) -> [String] {
        return texts.map { text in
            let recognizer = NLLanguageRecognizer()
            recognizer.processString(text)
            return recognizer.dominantLanguage?.rawValue ?? ""
        }
    }

    @objc
    public static func checkAvailability(
        source: String,
        target: String,
        completion: @escaping (String) -> Void
    ) {
        guard #available(macOS 26.0, *) else {
            completion("unsupportedOS")
            return
        }
        Task {
            let availability = LanguageAvailability()
            let status = await availability.status(
                from: Locale.Language(identifier: source),
                to: Locale.Language(identifier: target)
            )
            switch status {
            case .installed:
                completion("installed")
            case .supported:
                completion("supported")
            case .unsupported:
                completion("unsupported")
            @unknown default:
                completion("unsupported")
            }
        }
    }

    // texts, sourceLangs are parallel arrays — one detected source language
    // per text, since a batch may span languages and the framework only
    // translates within one source→target pair per session. Grouping by
    // source language is the JS layer's job (TranslateBridge just forwards
    // one already-grouped batch at a time); this keeps the Swift/ObjC++
    // boundary simple — one source, one target, N texts, N results in order.
    @objc
    public static func translateBatch(
        source: String,
        target: String,
        texts: [String],
        completion: @escaping (Bool, [String], String) -> Void
    ) {
        guard #available(macOS 26.0, *) else {
            completion(false, [], "unsupportedOS")
            return
        }
        guard !texts.isEmpty else {
            completion(true, [], "")
            return
        }

        Task {
            do {
                // Pre-flight check: the single most common real-world failure
                // is "the language pack isn't downloaded yet", which is a
                // known, actionable state — not a generic error. Catching it
                // here (rather than letting translations(from:) throw a
                // generic "Unable to Translate") lets the UI say something
                // useful instead of an unretryable dead-end error.
                let availability = LanguageAvailability()
                let status = await availability.status(
                    from: Locale.Language(identifier: source),
                    to: Locale.Language(identifier: target)
                )
                switch status {
                case .installed:
                    break
                case .supported:
                    completion(false, [], "languageNotInstalled")
                    return
                case .unsupported:
                    completion(false, [], "unsupportedLanguagePair")
                    return
                @unknown default:
                    completion(false, [], "unsupportedLanguagePair")
                    return
                }

                let session = await SessionRegistry.shared.session(source: source, target: target)
                let requests = texts.enumerated().map { index, text in
                    TranslationSession.Request(sourceText: text, clientIdentifier: "\(index)")
                }
                let responses = try await session.translations(from: requests)

                // translations(from:) is documented to return results in
                // request order, but we key by clientIdentifier anyway
                // rather than trust ordering blindly — cheap insurance
                // against a future SDK behavior change.
                var byId: [String: String] = [:]
                for response in responses {
                    if let id = response.clientIdentifier {
                        byId[id] = response.targetText
                    }
                }
                let ordered = (0..<texts.count).map { byId["\($0)"] ?? texts[$0] }
                completion(true, ordered, "")
            } catch {
                // TranslationError does have an internal `cause` (visible via
                // reflection: e.g. `.unsupportedSourceLanguage` — verified by
                // triggering a real error with an unsupported language pair),
                // but it is NOT public API — the compiler rejects `error.cause`.
                // Relying on Mirror(reflecting:) to read a private field would
                // be more fragile than useful (undocumented, can change any
                // SDK release). So: one generic code, plus the real
                // localizedDescription for logs/telemetry. The JS layer
                // should treat every batch failure uniformly ("translation
                // failed, try again") until Apple exposes this properly.
                completion(false, [], "translationFailed: \(error.localizedDescription)")
            }
        }
    }

    @objc
    public static func shutdown() {
        guard #available(macOS 26.0, *) else { return }
        Task {
            await SessionRegistry.shared.shutdown()
        }
    }
}

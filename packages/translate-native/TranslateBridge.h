#ifndef TranslateBridge_h
#define TranslateBridge_h
#import <Foundation/Foundation.h>

@interface TranslateBridge : NSObject
// --- Popover (selection-based, macOS 15+) ---
// NO on macOS < 15 (Sequoia) — the Translation framework doesn't exist there.
+ (BOOL)isAvailable;
// Shows the native system translate popover for the given text, anchored
// near the current mouse location.
+ (void)showTranslationForText:(NSString*)text;
+ (void)setClosedCallback:(void(^)(void))callback;

// --- Headless batch translation (inline per-message, macOS 26+) ---
// NO on macOS < 26 — TranslationSession's non-SwiftUI-hosted initializer
// doesn't exist there. Distinct from isAvailable above on purpose: the
// popover and the batch API have different OS floors.
+ (BOOL)isBatchAvailable;
// Best-effort language detection, one tag (or "") per input string. Fast,
// synchronous, local — no session/model needed.
+ (NSArray<NSString*>*)detectLanguagesForTexts:(NSArray<NSString*>*)texts;
// status is one of: "installed", "supported", "unsupported", "unsupportedOS".
+ (void)checkAvailabilityFromSource:(NSString*)source
                              target:(NSString*)target
                          completion:(void(^)(NSString* status))completion;
// Translates all of `texts` from `source` to `target` in one native call.
// completion(ok, translatedTexts, errorCode) — translatedTexts is empty and
// errorCode is non-empty when ok is NO.
+ (void)translateBatchFromSource:(NSString*)source
                           target:(NSString*)target
                            texts:(NSArray<NSString*>*)texts
                       completion:(void(^)(BOOL ok, NSArray<NSString*>* translatedTexts, NSString* errorCode))completion;
// Cancels idle sessions and stops the eviction loop. Safe to call multiple
// times. Does not affect the popover path.
+ (void)shutdownBatchSessions;
@end

#endif

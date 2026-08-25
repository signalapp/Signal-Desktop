#import "TranslateBridge.h"
#import "translate_addon-Swift.h"
#import <Foundation/Foundation.h>

@implementation TranslateBridge

static void (^closedCallback)(void);

+ (BOOL)isAvailable {
    return [TranslateCode isAvailable];
}

+ (void)showTranslationForText:(NSString*)text {
    [TranslateCode showTranslationForText:text];
}

+ (void)setClosedCallback:(void(^)(void))callback {
    closedCallback = callback;
    [TranslateCode setClosedCallback:callback];
}

+ (BOOL)isBatchAvailable {
    return [TranslateSession isBatchAvailable];
}

+ (NSArray<NSString*>*)detectLanguagesForTexts:(NSArray<NSString*>*)texts {
    return [TranslateSession detectLanguages:texts];
}

+ (void)checkAvailabilityFromSource:(NSString*)source
                              target:(NSString*)target
                          completion:(void(^)(NSString* status))completion {
    [TranslateSession checkAvailabilityWithSource:source target:target completion:completion];
}

+ (void)translateBatchFromSource:(NSString*)source
                           target:(NSString*)target
                            texts:(NSArray<NSString*>*)texts
                       completion:(void(^)(BOOL ok, NSArray<NSString*>* translatedTexts, NSString* errorCode))completion {
    [TranslateSession translateBatchWithSource:source target:target texts:texts completion:completion];
}

+ (void)shutdownBatchSessions {
    [TranslateSession shutdown];
}

@end

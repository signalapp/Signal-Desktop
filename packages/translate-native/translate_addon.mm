#import <Foundation/Foundation.h>
#import "TranslateBridge.h"
#include <napi.h>
#include <atomic>
#include <string>
#include <unordered_map>
#include <vector>

namespace {

enum class CallbackKind { Closed, CheckAvailabilityResult, TranslateBatchResult };

struct CallbackData {
    CallbackKind kind;
    uint64_t requestId = 0;
    bool ok = false;
    std::vector<std::string> texts;
    std::string errorCode;
    std::string status;
};

NSArray<NSString*>* ToNSStringArray(const Napi::Array& arr) {
    NSMutableArray<NSString*>* result = [NSMutableArray arrayWithCapacity:arr.Length()];
    for (uint32_t i = 0; i < arr.Length(); i++) {
        std::string s = arr.Get(i).As<Napi::String>().Utf8Value();
        // stringWithUTF8String: returns nil on invalid UTF-8. Bridging nil
        // into Swift's non-optional String parameters (TranslateSession's
        // source/target/texts) is a Swift runtime trap, not a catchable
        // exception — and this runs unsandboxed in the Electron main
        // process, so that would kill the whole app. Fall back to an empty
        // string rather than ever pass nil across the bridge.
        NSString* value = [NSString stringWithUTF8String:s.c_str()];
        [result addObject:(value ?: @"")];
    }
    return result;
}

std::vector<std::string> ToStdStringVector(NSArray<NSString*>* arr) {
    std::vector<std::string> result;
    result.reserve(arr.count);
    for (NSString* s in arr) {
        result.push_back(std::string([s UTF8String]));
    }
    return result;
}

} // namespace

class TranslateAddon : public Napi::ObjectWrap<TranslateAddon> {
public:
    static Napi::Object Init(Napi::Env env, Napi::Object exports) {
        Napi::Function func = DefineClass(env, "TranslateAddon", {
            InstanceMethod("isAvailable", &TranslateAddon::IsAvailable),
            InstanceMethod("showTranslation", &TranslateAddon::ShowTranslation),
            InstanceMethod("isBatchAvailable", &TranslateAddon::IsBatchAvailable),
            InstanceMethod("detectLanguages", &TranslateAddon::DetectLanguages),
            InstanceMethod("checkAvailability", &TranslateAddon::CheckAvailability),
            InstanceMethod("translateBatch", &TranslateAddon::TranslateBatch),
            InstanceMethod("on", &TranslateAddon::On),
            InstanceMethod("destroy", &TranslateAddon::Destroy)
        });
        Napi::FunctionReference* constructor = new Napi::FunctionReference();
        *constructor = Napi::Persistent(func);
        env.SetInstanceData(constructor);
        exports.Set("TranslateAddon", func);
        return exports;
    }

    TranslateAddon(const Napi::CallbackInfo& info)
        : Napi::ObjectWrap<TranslateAddon>(info)
        , env_(info.Env())
        , emitter(Napi::Persistent(Napi::Object::New(info.Env())))
        , callbacks(Napi::Persistent(Napi::Object::New(info.Env())))
        , tsfn_(nullptr)
        , nextRequestId_(1)
        , destroyed_(false) {
        // napi_create_threadsafe_function wants a plain napi_threadsafe_function*
        // out-param — std::atomic<T> isn't guaranteed layout-compatible with
        // T for a raw C API, so populate a local raw handle first and store
        // it into the atomic member afterward.
        napi_threadsafe_function rawTsfn = nullptr;
        napi_status status = napi_create_threadsafe_function(
            env_,
            nullptr,
            nullptr,
            Napi::String::New(env_, "TranslateCallback"),
            0,
            1,
            nullptr,
            nullptr,
            this,
            &TranslateAddon::CallJs,
            &rawTsfn
        );
        if (status != napi_ok) {
            Napi::Error::New(env_, "Failed to create threadsafe function")
                .ThrowAsJavaScriptException();
            return;
        }
        tsfn_.store(rawTsfn);

        // Starts unreffed: the threadsafe function must never by itself keep
        // the Node event loop (and therefore the whole Electron app) alive.
        // We ref/unref it around actual in-flight work (see AddPending /
        // RemovePending below). This is what makes the old quit-hang bug
        // structurally impossible rather than dependent on every call site
        // remembering to call destroy() before quit.
        napi_unref_threadsafe_function(env_, rawTsfn);

        [TranslateBridge setClosedCallback:^{
            auto* data = new CallbackData();
            data->kind = CallbackKind::Closed;
            // Single atomic load into a local — checking and then separately
            // re-reading tsfn_ would itself be a new TOCTOU race.
            napi_threadsafe_function fn = tsfn_.load();
            if (fn != nullptr) {
                napi_call_threadsafe_function(fn, data, napi_tsfn_nonblocking);
            } else {
                delete data;
            }
        }];
    }

private:
    Napi::Env env_;
    Napi::ObjectReference emitter;
    Napi::ObjectReference callbacks;
    // Atomic because ObjC completion blocks read tsfn_ from an arbitrary
    // Apple-internal background/XPC thread, while Destroy() writes it on the
    // JS thread — a plain pointer read/write across threads with no
    // synchronization is a data race (undefined behavior), not just a
    // theoretical concern given translation calls can be in flight at quit.
    std::atomic<napi_threadsafe_function> tsfn_;
    std::unordered_map<uint64_t, Napi::Promise::Deferred> pending_;
    uint64_t nextRequestId_;
    std::atomic<bool> destroyed_;

    // All AddPending/RemovePending calls happen on the JS thread (AddPending
    // from a synchronously-entered NAPI method; RemovePending from CallJs,
    // which NAPI guarantees runs on the JS thread) — no lock needed.
    uint64_t AddPending(Napi::Promise::Deferred deferred) {
        uint64_t id = nextRequestId_++;
        if (pending_.empty()) {
            napi_ref_threadsafe_function(env_, tsfn_);
        }
        pending_.emplace(id, std::move(deferred));
        return id;
    }

    bool RemovePending(uint64_t id, Napi::Promise::Deferred* out) {
        auto it = pending_.find(id);
        if (it == pending_.end()) return false;
        *out = std::move(it->second);
        pending_.erase(it);
        if (pending_.empty() && tsfn_ != nullptr) {
            napi_unref_threadsafe_function(env_, tsfn_);
        }
        return true;
    }

    static void CallJs(napi_env env, napi_value js_callback, void* context, void* raw) {
        auto* addon = static_cast<TranslateAddon*>(context);
        auto* data = static_cast<CallbackData*>(raw);
        if (!data) return;
        std::unique_ptr<CallbackData> cleanup(data);
        if (!addon || !env) return;

        Napi::Env napi_env(env);
        Napi::HandleScope scope(napi_env);

        try {
            switch (data->kind) {
                case CallbackKind::Closed: {
                    auto callback = addon->callbacks.Value().Get("closed").As<Napi::Function>();
                    if (callback.IsFunction()) {
                        callback.Call(addon->emitter.Value(), {});
                    }
                    break;
                }
                case CallbackKind::CheckAvailabilityResult: {
                    Napi::Promise::Deferred deferred(napi_env);
                    if (addon->RemovePending(data->requestId, &deferred)) {
                        deferred.Resolve(Napi::String::New(napi_env, data->status));
                    }
                    break;
                }
                case CallbackKind::TranslateBatchResult: {
                    Napi::Promise::Deferred deferred(napi_env);
                    if (addon->RemovePending(data->requestId, &deferred)) {
                        if (data->ok) {
                            Napi::Array arr = Napi::Array::New(napi_env, data->texts.size());
                            for (size_t i = 0; i < data->texts.size(); i++) {
                                arr.Set((uint32_t)i, Napi::String::New(napi_env, data->texts[i]));
                            }
                            deferred.Resolve(arr);
                        } else {
                            deferred.Reject(Napi::Error::New(napi_env, data->errorCode).Value());
                        }
                    }
                    break;
                }
            }
        } catch (...) {
            // Never let an exception escape the threadsafe-function
            // callback — it runs on the main Node event loop turn and an
            // unwind here would be unrecoverable.
        }
    }

    Napi::Value IsAvailable(const Napi::CallbackInfo& info) {
        return Napi::Boolean::New(info.Env(), [TranslateBridge isAvailable]);
    }

    Napi::Value ShowTranslation(const Napi::CallbackInfo& info) {
        Napi::Env env = info.Env();
        if (info.Length() < 1 || !info[0].IsString()) {
            Napi::TypeError::New(env, "Expected a string").ThrowAsJavaScriptException();
            return env.Undefined();
        }
        std::string text = info[0].As<Napi::String>().Utf8Value();
        @try {
            NSString* nsText = [NSString stringWithUTF8String:text.c_str()] ?: @"";
            [TranslateBridge showTranslationForText:nsText];
        } @catch (NSException* exception) {
            Napi::Error::New(env, [exception.reason UTF8String] ?: "showTranslation failed")
                .ThrowAsJavaScriptException();
        }
        return env.Undefined();
    }

    Napi::Value IsBatchAvailable(const Napi::CallbackInfo& info) {
        return Napi::Boolean::New(info.Env(), [TranslateBridge isBatchAvailable]);
    }

    Napi::Value DetectLanguages(const Napi::CallbackInfo& info) {
        Napi::Env env = info.Env();
        if (info.Length() < 1 || !info[0].IsArray()) {
            Napi::TypeError::New(env, "Expected an array of strings").ThrowAsJavaScriptException();
            return env.Undefined();
        }
        @try {
            NSArray<NSString*>* texts = ToNSStringArray(info[0].As<Napi::Array>());
            NSArray<NSString*>* langs = [TranslateBridge detectLanguagesForTexts:texts];
            std::vector<std::string> result = ToStdStringVector(langs);
            Napi::Array arr = Napi::Array::New(env, result.size());
            for (size_t i = 0; i < result.size(); i++) {
                arr.Set((uint32_t)i, Napi::String::New(env, result[i]));
            }
            return arr;
        } @catch (NSException* exception) {
            Napi::Error::New(env, [exception.reason UTF8String] ?: "detectLanguages failed")
                .ThrowAsJavaScriptException();
            return env.Undefined();
        }
    }

    Napi::Value CheckAvailability(const Napi::CallbackInfo& info) {
        Napi::Env env = info.Env();
        auto deferred = Napi::Promise::Deferred::New(env);
        Napi::Promise promise = deferred.Promise();

        if (destroyed_) {
            deferred.Reject(Napi::Error::New(env, "destroyed").Value());
            return promise;
        }
        if (info.Length() < 2 || !info[0].IsString() || !info[1].IsString()) {
            deferred.Reject(
                Napi::TypeError::New(env, "Expected (source: string, target: string)").Value());
            return promise;
        }

        std::string source = info[0].As<Napi::String>().Utf8Value();
        std::string target = info[1].As<Napi::String>().Utf8Value();
        uint64_t requestId = AddPending(std::move(deferred));

        NSString* nsSource = [NSString stringWithUTF8String:source.c_str()] ?: @"";
        NSString* nsTarget = [NSString stringWithUTF8String:target.c_str()] ?: @"";

        [TranslateBridge checkAvailabilityFromSource:nsSource
                                               target:nsTarget
                                           completion:^(NSString* status) {
            auto* data = new CallbackData();
            data->kind = CallbackKind::CheckAvailabilityResult;
            data->requestId = requestId;
            data->status = std::string([status UTF8String]);
            napi_threadsafe_function fn = tsfn_.load();
            if (fn != nullptr) {
                napi_call_threadsafe_function(fn, data, napi_tsfn_nonblocking);
            } else {
                delete data;
            }
        }];

        return promise;
    }

    Napi::Value TranslateBatch(const Napi::CallbackInfo& info) {
        Napi::Env env = info.Env();
        auto deferred = Napi::Promise::Deferred::New(env);
        Napi::Promise promise = deferred.Promise();

        if (destroyed_) {
            deferred.Reject(Napi::Error::New(env, "destroyed").Value());
            return promise;
        }
        if (info.Length() < 3 || !info[0].IsString() || !info[1].IsString() || !info[2].IsArray()) {
            deferred.Reject(Napi::TypeError::New(
                env, "Expected (source: string, target: string, texts: string[])").Value());
            return promise;
        }

        std::string source = info[0].As<Napi::String>().Utf8Value();
        std::string target = info[1].As<Napi::String>().Utf8Value();
        NSArray<NSString*>* texts = ToNSStringArray(info[2].As<Napi::Array>());
        uint64_t requestId = AddPending(std::move(deferred));

        NSString* nsSource = [NSString stringWithUTF8String:source.c_str()] ?: @"";
        NSString* nsTarget = [NSString stringWithUTF8String:target.c_str()] ?: @"";

        [TranslateBridge translateBatchFromSource:nsSource
                                            target:nsTarget
                                             texts:texts
                                        completion:^(BOOL ok, NSArray<NSString*>* translatedTexts, NSString* errorCode) {
            auto* data = new CallbackData();
            data->kind = CallbackKind::TranslateBatchResult;
            data->requestId = requestId;
            data->ok = ok;
            if (ok) {
                data->texts = ToStdStringVector(translatedTexts);
            } else {
                data->errorCode = std::string([errorCode UTF8String]);
            }
            napi_threadsafe_function fn = tsfn_.load();
            if (fn != nullptr) {
                napi_call_threadsafe_function(fn, data, napi_tsfn_nonblocking);
            } else {
                delete data;
            }
        }];

        return promise;
    }

    Napi::Value On(const Napi::CallbackInfo& info) {
        Napi::Env env = info.Env();
        if (info.Length() < 2 || !info[0].IsString() || !info[1].IsFunction()) {
            Napi::TypeError::New(env, "Expected (eventName: string, callback: function)")
                .ThrowAsJavaScriptException();
            return env.Undefined();
        }
        callbacks.Value().Set(info[0].As<Napi::String>(), info[1].As<Napi::Function>());
        return env.Undefined();
    }

    Napi::Value Destroy(const Napi::CallbackInfo& info) {
        Napi::Env env = info.Env();
        if (destroyed_) {
            return env.Undefined();
        }
        destroyed_ = true;

        // Reject every in-flight promise rather than leaving it dangling
        // across shutdown.
        for (auto& [id, deferred] : pending_) {
            deferred.Reject(Napi::Error::New(env, "destroyed").Value());
        }
        bool hadPending = !pending_.empty();
        pending_.clear();

        if (tsfn_ != nullptr) {
            if (hadPending) {
                // We had reffed the tsfn for the in-flight work; drop that
                // ref before releasing so counts stay balanced.
                napi_unref_threadsafe_function(env_, tsfn_);
            }
            napi_release_threadsafe_function(tsfn_, napi_tsfn_abort);
            tsfn_ = nullptr;
        }

        @try {
            [TranslateBridge shutdownBatchSessions];
        } @catch (...) {
        }

        return env.Undefined();
    }
};

Napi::Object Init(Napi::Env env, Napi::Object exports) {
    return TranslateAddon::Init(env, exports);
}

NODE_API_MODULE(translate_addon, Init)

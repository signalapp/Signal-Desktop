// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

#include <mutex>

#include <AVFAudio/AVFAudio.h>

#include "napi.h"

struct InstanceData {
  std::mutex mutex;
  Napi::ThreadSafeFunction on_change;
};

API_AVAILABLE(macos(14.0))
static Napi::Value GetIsMuted(const Napi::CallbackInfo& info) {
  return Napi::Boolean::New(info.Env(),
                            AVAudioApplication.sharedInstance.inputMuted);
}

API_AVAILABLE(macos(14.0))
static void SetIsMuted(const Napi::CallbackInfo& info) {
  auto value = info[0].As<Napi::Boolean>();
  assert(value.IsBoolean());

  NSError* err = nil;
  BOOL muted = value.Value() ? YES : NO;
  auto res = [AVAudioApplication.sharedInstance setInputMuted:muted error:&err];
  if (!res || err != nil) {
    Napi::Error::New(info.Env(), err.localizedDescription.UTF8String)
        .ThrowAsJavaScriptException();
    return;
  }
}

API_AVAILABLE(macos(14.0))
static void OnIsMutedChange(const Napi::CallbackInfo& info) {
  auto env = info.Env();

  auto callback = info[0].As<Napi::Function>();
  assert(callback.IsFunction());

  auto data = env.GetInstanceData<InstanceData>();
  {
    std::lock_guard<std::mutex> guard(data->mutex);
    data->on_change = Napi::ThreadSafeFunction::New(
        env, callback, "mute-state-change.onChange", 1, 1);
    data->on_change.Unref(env);
  }
}

static void FinalizeInstance(Napi::Env env, InstanceData* data) {
  if (@available(macos 14.0, *)) {
    [AVAudioApplication.sharedInstance setInputMuteStateChangeHandler:nil
                                                                error:nil];
  }
  delete data;
}

API_AVAILABLE(macos(14.0))
static void Init(Napi::Env env) {
  auto instanceData = new InstanceData();
  env.SetInstanceData<InstanceData, FinalizeInstance>(instanceData);

  NSError* err = nil;
  auto res = [AVAudioApplication.sharedInstance
      setInputMuteStateChangeHandler:^(BOOL muted) {
        std::lock_guard<std::mutex> guard(instanceData->mutex);
        instanceData->on_change.BlockingCall(
            ^(Napi::Env env, Napi::Function fn) {
              fn.Call({});
            });
        return YES;
      }
                               error:&err];
  if (!res || err != nil) {
    Napi::Error::New(env, err.localizedDescription.UTF8String)
        .ThrowAsJavaScriptException();
    return;
  }

  // Setup the observer, otherwise the callback above is never called
  [NSNotificationCenter.defaultCenter
      addObserverForName:AVAudioApplicationInputMuteStateChangeNotification
                  object:nil
                   queue:nil
              usingBlock:^(NSNotification*){
              }];
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  if (@available(macos 14.0, *)) {
    exports["getIsMuted"] = Napi::Function::New(env, &GetIsMuted);
    exports["setIsMuted"] = Napi::Function::New(env, &SetIsMuted);
    exports["onIsMutedChange"] = Napi::Function::New(env, &OnIsMutedChange);

    Init(env);
  }
  return exports;
}

NODE_API_MODULE(mute - state - change, Init)

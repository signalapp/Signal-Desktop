#include <assert.h>
#include <windows.h>
#include <winrt/windows.foundation.metadata.h>
#include <winrt/windows.security.credentials.ui.h>

#include "hour_cycle.h"
#include "napi.h"

using namespace winrt;
using namespace Windows::Security::Credentials::UI;
using namespace Windows::Foundation;

Napi::Value FromHResult(Napi::Env env, HRESULT err) {
  static char buf[1024];

  snprintf(buf, sizeof(buf), "Windows error code: %d", err);
  return Napi::Error::New(env, buf).Value();
}

static inline std::string ConvertAvailability(
    UserConsentVerifierAvailability availability) {
  switch (availability) {
    case UserConsentVerifierAvailability::Available:
      return "available";
    case UserConsentVerifierAvailability::DeviceBusy:
      return "deviceBusy";
    case UserConsentVerifierAvailability::DeviceNotPresent:
      return "deviceNotPresent";
    case UserConsentVerifierAvailability::DisabledByPolicy:
      return "disabledByPolicy";
    case UserConsentVerifierAvailability::NotConfiguredForUser:
      return "notConfiguredForUser";
    default:
      return "unknown";
  }
}

static inline std::string ConvertVerificationResult(
    UserConsentVerificationResult result) {
  switch (result) {
    case UserConsentVerificationResult::Verified:
      return "verified";
    case UserConsentVerificationResult::DeviceBusy:
      return "deviceBusy";
    case UserConsentVerificationResult::DeviceNotPresent:
      return "deviceNotPresent";
    case UserConsentVerificationResult::DisabledByPolicy:
      return "disabledByPolicy";
    case UserConsentVerificationResult::NotConfiguredForUser:
      return "notConfiguredForUser";
    case UserConsentVerificationResult::RetriesExhausted:
      return "retriesExhausted";
    case UserConsentVerificationResult::Canceled:
      return "canceled";
    default:
      return "unknown";
  }
}

void CheckAvailability(const Napi::CallbackInfo& info) {
  auto env = info.Env();

  auto callback = info[0].As<Napi::Function>();
  if (!callback.IsFunction()) {
    NAPI_THROW(Napi::Error::New(env, "First argument must be a function"),
               Napi::Value());
  }

  auto tsfn = Napi::ThreadSafeFunction::New(
      env, callback, "windows-ucv.checkAvailability", 0, 1);

  auto op = UserConsentVerifier::CheckAvailabilityAsync();
  op.Completed([tsfn](IAsyncOperation<UserConsentVerifierAvailability> info,
                      AsyncStatus status) {
    auto res = tsfn.BlockingCall([info, status](auto env, auto jsCallback) {
      std::string result;
      if (status == AsyncStatus::Completed) {
        result = ConvertAvailability(info.GetResults());
      } else if (status == AsyncStatus::Canceled) {
        result = "canceled";
      } else if (status == AsyncStatus::Error) {
        jsCallback.Call({FromHResult(env, info.ErrorCode())});
        return;
      } else {
        result = "error";
      }

      jsCallback.Call({Napi::String::New(env, result)});
    });
    assert(res == napi_ok);

    tsfn.Release();
  });
}

void RequestVerification(const Napi::CallbackInfo& info) {
  auto env = info.Env();

  auto msg = info[0].As<Napi::String>();
  if (!msg.IsString()) {
    NAPI_THROW(Napi::Error::New(env, "First argument must be a string"),
               Napi::Value());
  }

  auto callback = info[1].As<Napi::Function>();
  if (!callback.IsFunction()) {
    NAPI_THROW(Napi::Error::New(env, "Second argument must be a function"),
               Napi::Value());
  }

  auto utf8 = msg.Utf8Value();
  auto hstring = winrt::to_hstring(utf8);

  auto tsfn = Napi::ThreadSafeFunction::New(
      env, callback, "windows-ucv.requestVerification", 0, 1);

  auto op = UserConsentVerifier::RequestVerificationAsync(hstring);
  op.Completed([tsfn](IAsyncOperation<UserConsentVerificationResult> info,
                      AsyncStatus status) {
    auto res = tsfn.BlockingCall([info, status](auto env, auto jsCallback) {
      std::string result;
      if (status == AsyncStatus::Completed) {
        result = ConvertVerificationResult(info.GetResults());
      } else if (status == AsyncStatus::Canceled) {
        result = "canceled";
      } else if (status == AsyncStatus::Error) {
        jsCallback.Call({FromHResult(env, info.ErrorCode())});
        return;
      } else {
        result = "error";
      }

      jsCallback.Call({Napi::String::New(env, result)});
    });
    assert(res == napi_ok);

    tsfn.Release();
  });
}

Napi::Value GetHourCyclePreference(const Napi::CallbackInfo& info) {
  return Napi::String::New(info.Env(),
                          GetUserHourCyclePreference(GetLocaleInfoEx));
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set(Napi::String::New(env, "checkAvailability"),
              Napi::Function::New(env, CheckAvailability));
  exports.Set(Napi::String::New(env, "requestVerification"),
              Napi::Function::New(env, RequestVerification));
  exports.Set(Napi::String::New(env, "getHourCyclePreference"),
              Napi::Function::New(env, GetHourCyclePreference));
  return exports;
}

NODE_API_MODULE(windows - ucv, Init)

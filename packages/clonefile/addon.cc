// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

#include <assert.h>
#include <sys/attr.h>
#include <sys/clonefile.h>
#include <sys/errno.h>

#include "napi.h"

static void Clonefile(const Napi::CallbackInfo& info) {
  auto src = info[0].As<Napi::String>();
  assert(src.IsString());
  auto dst = info[1].As<Napi::String>();
  assert(dst.IsString());

  auto src_utf8 = src.Utf8Value();
  auto dst_utf8 = dst.Utf8Value();

  int err = clonefile(src_utf8.c_str(), dst_utf8.c_str(), CLONE_ACL);
  if (err != 0) {
    static char buf[1024];
    snprintf(buf, sizeof(buf), "Operation failed, errno=%d", errno);
    Napi::Error::New(info.Env(), buf).ThrowAsJavaScriptException();
    return;
  }
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports["clonefile"] = Napi::Function::New(env, &Clonefile);
  return exports;
}

NODE_API_MODULE(clonefile, Init)

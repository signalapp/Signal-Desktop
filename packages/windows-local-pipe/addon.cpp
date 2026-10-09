// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

// A minimal named pipe server for local IPC that libuv cannot provide:
//
// - every pipe instance carries a DACL that grants access to the current
//   user's SID only (libuv's default also grants Everyone and ANONYMOUS
//   LOGON read access), and
// - PIPE_REJECT_REMOTE_CLIENTS, so connections over SMB are refused by the
//   kernel, and
// - FILE_FLAG_FIRST_PIPE_INSTANCE, so listening fails if anyone already owns
//   the name.
//
// Each accepted connection gets one I/O thread doing overlapped reads and
// writes; events go back to JavaScript through a ThreadSafeFunction. Only
// raw bytes cross this boundary; all protocol handling stays in JavaScript.

#include <windows.h>
#include <sddl.h>

#include <deque>
#include <memory>
#include <mutex>
#include <string>
#include <thread>
#include <utility>
#include <vector>

#include "napi.h"

namespace {

constexpr DWORD kBufferSize = 64 * 1024;

std::string FormatError(const char* what, DWORD code) {
  return std::string(what) + " failed with Windows error " +
         std::to_string(code);
}

// Security descriptor granting GENERIC_ALL to the current user and nobody
// else. "P" protects the DACL from inheritance.
PSECURITY_DESCRIPTOR CreateUserOnlySecurityDescriptor(DWORD* error) {
  HANDLE token = nullptr;
  if (!OpenProcessToken(GetCurrentProcess(), TOKEN_QUERY, &token)) {
    *error = GetLastError();
    return nullptr;
  }
  DWORD size = 0;
  GetTokenInformation(token, TokenUser, nullptr, 0, &size);
  std::vector<BYTE> buffer(size);
  if (size == 0 || !GetTokenInformation(token, TokenUser, buffer.data(), size,
                                        &size)) {
    *error = GetLastError();
    CloseHandle(token);
    return nullptr;
  }
  CloseHandle(token);

  auto* user = reinterpret_cast<TOKEN_USER*>(buffer.data());
  LPWSTR sid = nullptr;
  if (!ConvertSidToStringSidW(user->User.Sid, &sid)) {
    *error = GetLastError();
    return nullptr;
  }
  std::wstring sddl = L"D:P(A;;GA;;;";
  sddl += sid;
  sddl += L")";
  LocalFree(sid);

  PSECURITY_DESCRIPTOR descriptor = nullptr;
  if (!ConvertStringSecurityDescriptorToSecurityDescriptorW(
          sddl.c_str(), SDDL_REVISION_1, &descriptor, nullptr)) {
    *error = GetLastError();
    return nullptr;
  }
  return descriptor;
}

// Events delivered to JavaScript.
enum class EventType {
  Listening,
  Connection,
  Data,
  End,
  WriteDone,
  Error,
  Closed,
};

const char* EventName(EventType type) {
  switch (type) {
    case EventType::Listening:
      return "listening";
    case EventType::Connection:
      return "connection";
    case EventType::Data:
      return "data";
    case EventType::End:
      return "end";
    case EventType::WriteDone:
      return "writeDone";
    case EventType::Error:
      return "error";
    case EventType::Closed:
      return "closed";
  }
  return "unknown";
}

struct Event {
  EventType type;
  std::vector<uint8_t> data;
  uint32_t write_id = 0;
  DWORD code = 0;
  std::string message;
  HANDLE pipe = INVALID_HANDLE_VALUE;
  ULONG client_pid = 0;
};

// Owns a connected pipe handle until a PipeConnection takes it.
struct PendingPipe {
  HANDLE pipe;
  ~PendingPipe() {
    if (pipe != INVALID_HANDLE_VALUE) {
      CloseHandle(pipe);
    }
  }
};

void CallJs(Napi::Env env, Napi::Function callback, std::nullptr_t*,
            Event* event) {
  std::unique_ptr<Event> owned(event);
  if (env == nullptr || callback.IsEmpty()) {
    if (owned->pipe != INVALID_HANDLE_VALUE) {
      CloseHandle(owned->pipe);
    }
    return;
  }

  Napi::Value payload = env.Undefined();
  switch (owned->type) {
    case EventType::Data:
      payload = Napi::Buffer<uint8_t>::Copy(env, owned->data.data(),
                                            owned->data.size());
      break;
    case EventType::WriteDone: {
      auto result = Napi::Object::New(env);
      result.Set("id", owned->write_id);
      result.Set("code", static_cast<double>(owned->code));
      payload = result;
      break;
    }
    case EventType::Error: {
      auto error = Napi::Error::New(env, owned->message);
      error.Set("code", static_cast<double>(owned->code));
      payload = error.Value();
      break;
    }
    case EventType::Connection: {
      auto result = Napi::Object::New(env);
      result.Set("pipe", Napi::External<PendingPipe>::New(
                             env, new PendingPipe{owned->pipe},
                             [](Napi::Env, PendingPipe* pending) {
                               delete pending;
                             }));
      result.Set("clientProcessId", static_cast<double>(owned->client_pid));
      owned->pipe = INVALID_HANDLE_VALUE;
      payload = result;
      break;
    }
    default:
      break;
  }
  callback.Call({Napi::String::New(env, EventName(owned->type)), payload});
}

using EventSink = Napi::TypedThreadSafeFunction<std::nullptr_t, Event, CallJs>;

// ---------------------------------------------------------------------------
// Connection

struct ConnectionState {
  HANDLE pipe = INVALID_HANDLE_VALUE;
  HANDLE wake = nullptr;  // auto-reset; signalled on new writes and close
  std::mutex mutex;
  std::deque<std::pair<uint32_t, std::vector<uint8_t>>> writes;
  bool reading = true;
  bool closing = false;
  EventSink sink;

  void Post(Event* event) {
    if (sink.NonBlockingCall(event) != napi_ok) {
      delete event;
    }
  }
};

void RunConnection(std::shared_ptr<ConnectionState> state) {
  OVERLAPPED read_ov = {};
  OVERLAPPED write_ov = {};
  read_ov.hEvent = CreateEventW(nullptr, TRUE, FALSE, nullptr);
  write_ov.hEvent = CreateEventW(nullptr, TRUE, FALSE, nullptr);

  std::vector<uint8_t> read_buffer(kBufferSize);
  bool read_pending = false;
  bool write_pending = false;
  bool eof = false;
  std::pair<uint32_t, std::vector<uint8_t>> current_write;
  DWORD fatal_error = 0;
  const char* fatal_what = nullptr;

  while (fatal_error == 0) {
    bool want_read;
    bool closing;
    {
      std::lock_guard<std::mutex> lock(state->mutex);
      closing = state->closing;
      want_read = state->reading && !eof;
      if (!closing && !write_pending && !state->writes.empty()) {
        current_write = std::move(state->writes.front());
        state->writes.pop_front();
        if (!WriteFile(state->pipe, current_write.second.data(),
                       static_cast<DWORD>(current_write.second.size()),
                       nullptr, &write_ov) &&
            GetLastError() != ERROR_IO_PENDING) {
          fatal_error = GetLastError();
          fatal_what = "WriteFile";
          break;
        }
        write_pending = true;
      }
    }
    if (closing) {
      break;
    }

    if (want_read && !read_pending) {
      if (!ReadFile(state->pipe, read_buffer.data(), kBufferSize, nullptr,
                    &read_ov)) {
        DWORD error = GetLastError();
        if (error == ERROR_BROKEN_PIPE) {
          eof = true;
          state->Post(new Event{EventType::End});
          continue;
        }
        if (error != ERROR_IO_PENDING) {
          fatal_error = error;
          fatal_what = "ReadFile";
          break;
        }
      }
      read_pending = true;
    }

    HANDLE handles[3];
    DWORD count = 0;
    handles[count++] = state->wake;
    if (read_pending) {
      handles[count++] = read_ov.hEvent;
    }
    if (write_pending) {
      handles[count++] = write_ov.hEvent;
    }
    WaitForMultipleObjects(count, handles, FALSE, INFINITE);

    if (read_pending && WaitForSingleObject(read_ov.hEvent, 0) == WAIT_OBJECT_0) {
      read_pending = false;
      DWORD transferred = 0;
      if (GetOverlappedResult(state->pipe, &read_ov, &transferred, FALSE)) {
        if (transferred > 0) {
          auto* event = new Event{EventType::Data};
          event->data.assign(read_buffer.begin(),
                             read_buffer.begin() + transferred);
          state->Post(event);
        }
      } else {
        DWORD error = GetLastError();
        if (error == ERROR_BROKEN_PIPE) {
          eof = true;
          state->Post(new Event{EventType::End});
        } else if (error != ERROR_OPERATION_ABORTED) {
          fatal_error = error;
          fatal_what = "ReadFile";
        }
      }
    }

    if (write_pending &&
        WaitForSingleObject(write_ov.hEvent, 0) == WAIT_OBJECT_0) {
      write_pending = false;
      DWORD transferred = 0;
      auto* event = new Event{EventType::WriteDone};
      event->write_id = current_write.first;
      if (!GetOverlappedResult(state->pipe, &write_ov, &transferred, FALSE)) {
        event->code = GetLastError();
      }
      state->Post(event);
      current_write.second.clear();
    }
  }

  // Tear down: cancel anything in flight and wait for it to finish so the
  // OVERLAPPED structures and buffers outlive the I/O.
  CancelIoEx(state->pipe, nullptr);
  DWORD ignored = 0;
  if (read_pending) {
    GetOverlappedResult(state->pipe, &read_ov, &ignored, TRUE);
  }
  if (write_pending) {
    GetOverlappedResult(state->pipe, &write_ov, &ignored, TRUE);
    auto* event = new Event{EventType::WriteDone};
    event->write_id = current_write.first;
    event->code = ERROR_OPERATION_ABORTED;
    state->Post(event);
  }
  {
    std::lock_guard<std::mutex> lock(state->mutex);
    for (auto& write : state->writes) {
      auto* event = new Event{EventType::WriteDone};
      event->write_id = write.first;
      event->code = ERROR_OPERATION_ABORTED;
      state->Post(event);
    }
    state->writes.clear();
  }

  if (fatal_error != 0) {
    auto* event = new Event{EventType::Error};
    event->code = fatal_error;
    event->message = FormatError(fatal_what, fatal_error);
    state->Post(event);
  }

  // No DisconnectNamedPipe: it would discard data the client has not read
  // yet (for example a final error response). Closing our handle lets the
  // client drain the buffer and then see ERROR_BROKEN_PIPE.
  CloseHandle(state->pipe);
  state->pipe = INVALID_HANDLE_VALUE;
  CloseHandle(read_ov.hEvent);
  CloseHandle(write_ov.hEvent);

  state->Post(new Event{EventType::Closed});
  state->sink.Release();
}

class PipeConnection : public Napi::ObjectWrap<PipeConnection> {
 public:
  static Napi::Function Init(Napi::Env env) {
    return DefineClass(env, "PipeConnection",
                       {
                           InstanceMethod("write", &PipeConnection::Write),
                           InstanceMethod("setReading",
                                          &PipeConnection::SetReading),
                           InstanceMethod("close", &PipeConnection::Close),
                       });
  }

  // new PipeConnection(pendingPipe, onEvent)
  explicit PipeConnection(const Napi::CallbackInfo& info)
      : Napi::ObjectWrap<PipeConnection>(info) {
    auto env = info.Env();
    if (info.Length() != 2 || !info[0].IsExternal() || !info[1].IsFunction()) {
      throw Napi::TypeError::New(env, "Expected (pipe, onEvent)");
    }
    auto* pending = info[0].As<Napi::External<PendingPipe>>().Data();
    if (pending->pipe == INVALID_HANDLE_VALUE) {
      throw Napi::Error::New(env, "Pipe already taken");
    }

    state_ = std::make_shared<ConnectionState>();
    state_->wake = CreateEventW(nullptr, FALSE, FALSE, nullptr);
    if (state_->wake == nullptr) {
      throw Napi::Error::New(env, FormatError("CreateEvent", GetLastError()));
    }
    state_->pipe = pending->pipe;
    pending->pipe = INVALID_HANDLE_VALUE;
    state_->sink = EventSink::New(env, info[1].As<Napi::Function>(),
                                  "windows-local-pipe connection", 0, 1);

    std::thread(RunConnection, state_).detach();
  }

  ~PipeConnection() override {
    if (state_) {
      Signal(true);
    }
  }

 private:
  void Signal(bool close) {
    {
      std::lock_guard<std::mutex> lock(state_->mutex);
      if (close) {
        state_->closing = true;
      }
    }
    SetEvent(state_->wake);
  }

  // write(buffer, id)
  void Write(const Napi::CallbackInfo& info) {
    auto env = info.Env();
    if (info.Length() != 2 || !info[0].IsBuffer() || !info[1].IsNumber()) {
      throw Napi::TypeError::New(env, "Expected (buffer, id)");
    }
    auto buffer = info[0].As<Napi::Buffer<uint8_t>>();
    uint32_t id = info[1].As<Napi::Number>().Uint32Value();
    {
      std::lock_guard<std::mutex> lock(state_->mutex);
      if (state_->closing) {
        throw Napi::Error::New(env, "Connection is closed");
      }
      state_->writes.emplace_back(
          id, std::vector<uint8_t>(buffer.Data(),
                                   buffer.Data() + buffer.Length()));
    }
    SetEvent(state_->wake);
  }

  // setReading(boolean): flow control from the JavaScript stream.
  void SetReading(const Napi::CallbackInfo& info) {
    bool reading = info.Length() > 0 && info[0].ToBoolean().Value();
    {
      std::lock_guard<std::mutex> lock(state_->mutex);
      state_->reading = reading;
    }
    SetEvent(state_->wake);
  }

  void Close(const Napi::CallbackInfo&) { Signal(true); }

  std::shared_ptr<ConnectionState> state_;
};

// ---------------------------------------------------------------------------
// Server

struct ServerState {
  std::wstring name;
  PSECURITY_DESCRIPTOR descriptor = nullptr;
  HANDLE stop = nullptr;  // manual-reset
  EventSink sink;

  void Post(Event* event) {
    if (sink.NonBlockingCall(event) != napi_ok) {
      if (event->pipe != INVALID_HANDLE_VALUE) {
        CloseHandle(event->pipe);
      }
      delete event;
    }
  }

  ~ServerState() {
    if (descriptor != nullptr) {
      LocalFree(descriptor);
    }
    if (stop != nullptr) {
      CloseHandle(stop);
    }
  }
};

void PostError(ServerState* state, const char* what, DWORD code) {
  auto* event = new Event{EventType::Error};
  event->code = code;
  event->message = FormatError(what, code);
  state->Post(event);
}

void RunServer(std::shared_ptr<ServerState> state) {
  SECURITY_ATTRIBUTES attributes = {};
  attributes.nLength = sizeof(attributes);
  attributes.lpSecurityDescriptor = state->descriptor;
  attributes.bInheritHandle = FALSE;

  OVERLAPPED connect_ov = {};
  connect_ov.hEvent = CreateEventW(nullptr, TRUE, FALSE, nullptr);

  bool first = true;
  while (WaitForSingleObject(state->stop, 0) != WAIT_OBJECT_0) {
    DWORD open_mode = PIPE_ACCESS_DUPLEX | FILE_FLAG_OVERLAPPED;
    if (first) {
      open_mode |= FILE_FLAG_FIRST_PIPE_INSTANCE;
    }
    HANDLE pipe = CreateNamedPipeW(
        state->name.c_str(), open_mode,
        PIPE_TYPE_BYTE | PIPE_READMODE_BYTE | PIPE_WAIT |
            PIPE_REJECT_REMOTE_CLIENTS,
        PIPE_UNLIMITED_INSTANCES, kBufferSize, kBufferSize, 0, &attributes);
    if (pipe == INVALID_HANDLE_VALUE) {
      PostError(state.get(), "CreateNamedPipe", GetLastError());
      break;
    }
    if (first) {
      first = false;
      state->Post(new Event{EventType::Listening});
    }

    ResetEvent(connect_ov.hEvent);
    bool connected = ConnectNamedPipe(pipe, &connect_ov) != FALSE;
    DWORD error = connected ? ERROR_SUCCESS : GetLastError();
    if (!connected && error == ERROR_IO_PENDING) {
      HANDLE handles[2] = {state->stop, connect_ov.hEvent};
      DWORD which = WaitForMultipleObjects(2, handles, FALSE, INFINITE);
      DWORD ignored = 0;
      if (which == WAIT_OBJECT_0) {
        CancelIoEx(pipe, &connect_ov);
        GetOverlappedResult(pipe, &connect_ov, &ignored, TRUE);
        CloseHandle(pipe);
        break;
      }
      connected =
          GetOverlappedResult(pipe, &connect_ov, &ignored, FALSE) != FALSE;
      error = connected ? ERROR_SUCCESS : GetLastError();
    } else if (!connected && error == ERROR_PIPE_CONNECTED) {
      connected = true;
    }

    if (!connected) {
      // The client went away before we saw it; try again with a new
      // instance.
      CloseHandle(pipe);
      continue;
    }

    auto* event = new Event{EventType::Connection};
    event->pipe = pipe;
    GetNamedPipeClientProcessId(pipe, &event->client_pid);
    state->Post(event);
  }

  CloseHandle(connect_ov.hEvent);
  state->Post(new Event{EventType::Closed});
  state->sink.Release();
}

class PipeServer : public Napi::ObjectWrap<PipeServer> {
 public:
  static Napi::Function Init(Napi::Env env) {
    return DefineClass(env, "PipeServer",
                       {
                           InstanceMethod("close", &PipeServer::Close),
                       });
  }

  // new PipeServer(name, onEvent): starts listening immediately. The first
  // event is either "listening" or "error".
  explicit PipeServer(const Napi::CallbackInfo& info)
      : Napi::ObjectWrap<PipeServer>(info) {
    auto env = info.Env();
    if (info.Length() != 2 || !info[0].IsString() || !info[1].IsFunction()) {
      throw Napi::TypeError::New(env, "Expected (name, onEvent)");
    }
    std::u16string name = info[0].As<Napi::String>().Utf16Value();
    if (name.rfind(u"\\\\.\\pipe\\", 0) != 0) {
      throw Napi::Error::New(env, "Pipe name must start with \\\\.\\pipe\\");
    }

    state_ = std::make_shared<ServerState>();
    state_->name.assign(name.begin(), name.end());
    DWORD error = 0;
    state_->descriptor = CreateUserOnlySecurityDescriptor(&error);
    if (state_->descriptor == nullptr) {
      throw Napi::Error::New(env, FormatError("Security descriptor", error));
    }
    state_->stop = CreateEventW(nullptr, TRUE, FALSE, nullptr);
    if (state_->stop == nullptr) {
      throw Napi::Error::New(env, FormatError("CreateEvent", GetLastError()));
    }
    state_->sink = EventSink::New(env, info[1].As<Napi::Function>(),
                                  "windows-local-pipe server", 0, 1);

    std::thread(RunServer, state_).detach();
  }

  ~PipeServer() override {
    if (state_) {
      SetEvent(state_->stop);
    }
  }

 private:
  void Close(const Napi::CallbackInfo&) { SetEvent(state_->stop); }

  std::shared_ptr<ServerState> state_;
};

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set("PipeServer", PipeServer::Init(env));
  exports.Set("PipeConnection", PipeConnection::Init(env));
  return exports;
}

}  // namespace

NODE_API_MODULE(NODE_GYP_MODULE_NAME, Init)

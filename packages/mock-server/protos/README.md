# Protobufs

Files in this directory:

| Dir                       | Copied from    |
| ------------------------- | -------------- |
| `.`                       | [desktop][0]   |
| `server`                  | [server][1]    |
| `server/org/signal/chat`  | [libsignal][2] |
| `server/google/rpc`       | [libsignal][2] |
| `server/TextSecure.proto` | [libsignal][2] |
| `server/google.proto`     | [google][3]    |

The libsignal protos are pulled from the currently installed version of
libsignal. To update them, run `pnpm run sync-grpc-protos`

Protopiler doesn't resolve imports, so the `google.protobuf` types these protos
use are copied into `server/google.proto`.

[0]: https://github.com/signalapp/Signal-Desktop/tree/main/protos
[1]: https://github.com/signalapp/Signal-Server/tree/main/service/src/main/proto
[2]: https://github.com/signalapp/libsignal/tree/main/rust/net/grpc/proto
[3]: https://github.com/protocolbuffers/protobuf/tree/main/src/google/protobuf

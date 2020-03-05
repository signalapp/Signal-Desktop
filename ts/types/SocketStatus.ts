// Maps to values found here: https://developer.mozilla.org/en-US/docs/Web/API/WebSocket/readyState
// which are returned by libtextsecure's MessageReceiver
export enum SocketStatus {
  CONNECTING,
  OPEN,
  CLOSING,
  CLOSED,
}

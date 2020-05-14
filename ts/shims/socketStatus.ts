export function getSocketStatus() {
  const { getSocketStatus: getMessageReceiverStatus } = window;

  return getMessageReceiverStatus();
}

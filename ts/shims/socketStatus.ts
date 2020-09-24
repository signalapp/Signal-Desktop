export function getSocketStatus(): number {
  const { getSocketStatus: getMessageReceiverStatus } = window;

  return getMessageReceiverStatus();
}

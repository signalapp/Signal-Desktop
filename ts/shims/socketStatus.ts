interface ShimmedWindow extends Window {
  getSocketStatus: () => number;
}

const unknownWindow = window as unknown;
const shimmedWindow = unknownWindow as ShimmedWindow;

export function getSocketStatus() {
  const { getSocketStatus: getMessageReceiverStatus } = shimmedWindow;

  return getMessageReceiverStatus();
}

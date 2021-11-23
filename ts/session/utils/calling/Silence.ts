const maxWidth = 1920;
const maxHeight = 1080;

const silence = () => {
  const ctx = new AudioContext();
  const oscillator = ctx.createOscillator();
  const dst = oscillator.connect(ctx.createMediaStreamDestination());
  oscillator.start();
  return Object.assign((dst as any).stream.getAudioTracks()[0], { enabled: false });
};

const black = () => {
  const canvas = Object.assign(document.createElement('canvas'), {
    width: maxWidth,
    height: maxHeight,
  });
  canvas.getContext('2d')?.fillRect(0, 0, maxWidth, maxHeight);
  const stream = (canvas as any).captureStream();
  return Object.assign(stream.getVideoTracks()[0], { enabled: false });
};

export const getBlackSilenceMediaStream = () => {
  return new MediaStream([black(), silence()]);
};

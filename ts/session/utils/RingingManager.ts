const sound = './fixtures/ringing.mp3';

let currentlyRinging = false;

let ringingAudio: HTMLAudioElement | undefined;

function stopRinging() {
  if (ringingAudio) {
    ringingAudio.pause();
  }
}

function startRinging() {
  if (!ringingAudio) {
    ringingAudio = new Audio(sound);
    ringingAudio.loop = true;
  }
  void ringingAudio.play();
}

export function setIsRinging(isRinging: boolean) {
  if (!currentlyRinging && isRinging) {
    startRinging();
    currentlyRinging = true;
  } else if (currentlyRinging && !isRinging) {
    stopRinging();
    currentlyRinging = false;
  }
}

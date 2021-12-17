const sound = './sound/ringing.mp3';

let currentlyRinging = false;

let ringingAudio: HTMLAudioElement | undefined;

function stopRinging() {
  if (ringingAudio) {
    ringingAudio.pause();
    ringingAudio.srcObject = null;
  }
}

function startRinging() {
  if (!ringingAudio) {
    ringingAudio = new Audio(sound);
    ringingAudio.loop = true;
    ringingAudio.volume = 0.6;
  }
  void ringingAudio.play().catch(window.log.info);
}

export function getIsRinging() {
  return currentlyRinging;
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

import { Sound, SoundOpts } from './Sound';

async function playSound(howlProps: SoundOpts): Promise<Sound | undefined> {
  const canPlayTone = await window.getCallRingtoneNotification();

  if (!canPlayTone) {
    return;
  }

  const tone = new Sound(howlProps);
  await tone.play();

  return tone;
}

class CallingTones {
  private ringtone?: Sound;

  async playEndCall() {
    await playSound({
      src: 'sounds/navigation-cancel.ogg',
    });
  }

  async playRingtone() {
    if (this.ringtone) {
      this.stopRingtone();
    }

    this.ringtone = await playSound({
      loop: true,
      src: 'sounds/ringtone_minimal.ogg',
    });
  }

  stopRingtone() {
    if (this.ringtone) {
      this.ringtone.stop();
      this.ringtone = undefined;
    }
  }
}

export const callingTones = new CallingTones();

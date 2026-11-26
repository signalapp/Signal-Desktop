// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { LocalizerType } from '../types/Util.std.ts';
import type { AudioDevicePref } from '../types/Calling.std.ts';
import { AxoItem } from '../axo/items/AxoItem.dom.tsx';
import { AxoSwitchItem } from '../axo/items/AxoSwitchItem.dom.tsx';
import { tw } from '../axo/tw.dom.tsx';
import { AUDIO_LEVEL_INTERVAL_MS } from '../calling/constants.std.ts';
import { truncateAudioLevel } from '../calling/truncateAudioLevel.std.ts';
import {
  findBrowserAudioDeviceId,
  getPeakAudioLevel,
} from '../calling/findBrowserAudioDevice.std.ts';
import { Sound, SoundType } from '../util/Sound.std.ts';
import { createLogger } from '../logging/log.std.ts';
import * as Errors from '../types/errors.std.ts';
import { drop } from '../util/drop.std.ts';

const log = createLogger('CallingDeviceTestItems');

const ANALYSER_FFT_SIZE = 2048;

export type MicrophoneTestStatus =
  | 'idle'
  | 'running'
  | 'permission-denied'
  | 'failed';

export type CallingDeviceTestItemsProps = Readonly<{
  i18n: LocalizerType;
  selectedMicrophone: AudioDevicePref;
  selectedSpeaker: AudioDevicePref;
  requestMicrophoneAccess: () => Promise<boolean>;
  // For storybook and tests
  initialMicrophoneTestStatus?: MicrophoneTestStatus;
  initialAudioLevel?: number;
}>;

async function getBrowserAudioDeviceId(
  kind: 'audioinput' | 'audiooutput',
  preferred: AudioDevicePref
): Promise<{ deviceId: string | undefined; isFallback: boolean }> {
  const browserDevices = await navigator.mediaDevices.enumerateDevices();
  return findBrowserAudioDeviceId({ kind, preferred, browserDevices });
}

function getDeviceName(pref: AudioDevicePref): string | undefined {
  return pref.type === 'specificDevice' ? pref.device.name : undefined;
}

function MicrophoneLevelMeter({
  i18n,
  audioLevel,
}: Readonly<{ i18n: LocalizerType; audioLevel: number }>): ReactNode {
  const percent = Math.round(audioLevel * 100);
  return (
    <div
      role="meter"
      aria-label={i18n('icu:Preferences__test-microphone--level')}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className={tw('h-1.5 w-24 overflow-hidden rounded-full bg-secondary')}
    >
      <div
        className={tw('h-full rounded-full bg-accent transition-[width]')}
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

export function CallingDeviceTestItems({
  i18n,
  selectedMicrophone,
  selectedSpeaker,
  requestMicrophoneAccess,
  initialMicrophoneTestStatus = 'idle',
  initialAudioLevel = 0,
}: CallingDeviceTestItemsProps): ReactNode {
  const [microphoneStatus, setMicrophoneStatus] =
    useState<MicrophoneTestStatus>(initialMicrophoneTestStatus);
  const [isMicrophoneTestOn, setIsMicrophoneTestOn] = useState(
    initialMicrophoneTestStatus === 'running'
  );
  const [audioLevel, setAudioLevel] = useState(initialAudioLevel);
  const [isMicrophoneFallback, setIsMicrophoneFallback] = useState(false);

  const [isPlayingTestSound, setIsPlayingTestSound] = useState(false);
  const [isSpeakerFallback, setIsSpeakerFallback] = useState(false);
  const testSoundRef = useRef<HTMLAudioElement | null>(null);

  // Microphone test: capture from the selected input and show its level.
  // Everything is torn down when the toggle is turned off, the selected
  // microphone changes, or the settings page is closed (unmount).
  useEffect(() => {
    if (!isMicrophoneTestOn || initialMicrophoneTestStatus !== 'idle') {
      return;
    }

    let isCancelled = false;
    let stream: MediaStream | undefined;
    let context: AudioContext | undefined;
    let interval: ReturnType<typeof setInterval> | undefined;

    async function start(): Promise<void> {
      const hasAccess = await requestMicrophoneAccess();
      if (isCancelled) {
        return;
      }
      if (!hasAccess) {
        setMicrophoneStatus('permission-denied');
        setIsMicrophoneTestOn(false);
        return;
      }

      try {
        const { deviceId, isFallback } = await getBrowserAudioDeviceId(
          'audioinput',
          selectedMicrophone
        );
        const newStream = await navigator.mediaDevices.getUserMedia({
          audio: deviceId != null ? { deviceId: { exact: deviceId } } : true,
          video: false,
        });
        if (isCancelled) {
          newStream.getTracks().forEach(track => track.stop());
          return;
        }
        stream = newStream;
        setIsMicrophoneFallback(isFallback);

        context = new AudioContext();
        const source = context.createMediaStreamSource(newStream);
        const analyser = context.createAnalyser();
        analyser.fftSize = ANALYSER_FFT_SIZE;
        source.connect(analyser);

        const samples = new Float32Array(analyser.fftSize);
        interval = setInterval(() => {
          analyser.getFloatTimeDomainData(samples);
          setAudioLevel(truncateAudioLevel(getPeakAudioLevel(samples)));
        }, AUDIO_LEVEL_INTERVAL_MS);

        setMicrophoneStatus('running');
      } catch (error) {
        if (isCancelled) {
          return;
        }
        log.warn('Microphone test failed', Errors.toLogFormat(error));
        const isDenied =
          error instanceof DOMException &&
          (error.name === 'NotAllowedError' || error.name === 'SecurityError');
        setMicrophoneStatus(isDenied ? 'permission-denied' : 'failed');
        setIsMicrophoneTestOn(false);
      }
    }

    drop(start());

    return () => {
      isCancelled = true;
      if (interval != null) {
        clearInterval(interval);
      }
      stream?.getTracks().forEach(track => track.stop());
      drop(context?.close());
      setAudioLevel(0);
    };
  }, [
    isMicrophoneTestOn,
    selectedMicrophone,
    requestMicrophoneAccess,
    initialMicrophoneTestStatus,
  ]);

  const handleMicrophoneTestChange = useCallback((checked: boolean) => {
    setIsMicrophoneTestOn(checked);
    setMicrophoneStatus('idle');
    setIsMicrophoneFallback(false);
  }, []);

  const stopTestSound = useCallback(() => {
    const audio = testSoundRef.current;
    testSoundRef.current = null;
    if (audio != null) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }
    setIsPlayingTestSound(false);
  }, []);

  // Speaker test: play a bundled sound on the selected output.
  const playTestSound = useCallback(async () => {
    stopTestSound();

    const audio = new Audio(Sound.getSrc(SoundType.Ringtone));
    testSoundRef.current = audio;
    setIsPlayingTestSound(true);

    try {
      const { deviceId, isFallback } = await getBrowserAudioDeviceId(
        'audiooutput',
        selectedSpeaker
      );
      setIsSpeakerFallback(isFallback);
      if (deviceId != null) {
        await audio.setSinkId(deviceId);
      }
    } catch (error) {
      log.warn('Failed to select output device', Errors.toLogFormat(error));
      setIsSpeakerFallback(true);
    }

    if (testSoundRef.current !== audio) {
      return;
    }

    audio.addEventListener('ended', () => {
      if (testSoundRef.current === audio) {
        stopTestSound();
      }
    });

    try {
      await audio.play();
    } catch (error) {
      log.warn('Failed to play test sound', Errors.toLogFormat(error));
      if (testSoundRef.current === audio) {
        stopTestSound();
      }
    }
  }, [selectedSpeaker, stopTestSound]);

  // Stop the sound when the settings page is closed
  useEffect(() => {
    return () => {
      stopTestSound();
    };
  }, [stopTestSound]);

  let microphoneDescription: ReactNode;
  if (microphoneStatus === 'permission-denied') {
    microphoneDescription = i18n(
      'icu:Preferences__test-microphone--permission-denied'
    );
  } else if (microphoneStatus === 'failed') {
    microphoneDescription = i18n('icu:Preferences__test-microphone--failed');
  } else if (isMicrophoneFallback) {
    microphoneDescription = i18n('icu:Preferences__test-device--fallback', {
      deviceName: getDeviceName(selectedMicrophone) ?? '',
    });
  } else {
    microphoneDescription = i18n(
      'icu:Preferences__test-microphone--description'
    );
  }

  return (
    <>
      <AxoSwitchItem.Root
        label={i18n('icu:Preferences__test-microphone')}
        description={microphoneDescription}
        checked={isMicrophoneTestOn}
        onCheckedChange={handleMicrophoneTestChange}
      />
      {isMicrophoneTestOn && (
        <AxoItem.Root>
          <AxoItem.Content>
            <AxoItem.Label>
              {i18n('icu:Preferences__test-microphone--level')}
            </AxoItem.Label>
            <AxoItem.Accessory>
              <MicrophoneLevelMeter i18n={i18n} audioLevel={audioLevel} />
            </AxoItem.Accessory>
          </AxoItem.Content>
        </AxoItem.Root>
      )}
      <AxoItem.Root>
        <AxoItem.Content>
          <AxoItem.Label>
            {i18n('icu:Preferences__test-speakers')}
          </AxoItem.Label>
          {isSpeakerFallback && (
            <AxoItem.Description>
              {i18n('icu:Preferences__test-device--fallback', {
                deviceName: getDeviceName(selectedSpeaker) ?? '',
              })}
            </AxoItem.Description>
          )}
          <AxoItem.Accessory>
            <AxoItem.Action
              variant="subtle-secondary"
              onClick={
                isPlayingTestSound ? stopTestSound : () => drop(playTestSound())
              }
            >
              {isPlayingTestSound
                ? i18n('icu:Preferences__test-speakers--stop')
                : i18n('icu:Preferences__test-speakers--play')}
            </AxoItem.Action>
          </AxoItem.Accessory>
        </AxoItem.Content>
      </AxoItem.Root>
    </>
  );
}

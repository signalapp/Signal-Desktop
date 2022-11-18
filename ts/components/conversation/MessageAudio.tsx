// Copyright 2021-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useCallback, useRef, useEffect, useState } from 'react';
import type { RefObject, ReactNode } from 'react';
import classNames from 'classnames';
import { noop } from 'lodash';
import { animated, useSpring } from '@react-spring/web';

import type { LocalizerType } from '../../types/Util';
import type { AttachmentType } from '../../types/Attachment';
import { isDownloaded } from '../../types/Attachment';
import type { DirectionType, MessageStatusType } from './Message';

import type { ComputePeaksResult } from '../GlobalAudioContext';
import { MessageMetadata } from './MessageMetadata';
import * as log from '../../logging/log';
import type { ActiveAudioPlayerStateType } from '../../state/ducks/audioPlayer';

export type OwnProps = Readonly<{
  active: ActiveAudioPlayerStateType | undefined;
  buttonRef: RefObject<HTMLButtonElement>;
  renderingContext: string;
  i18n: LocalizerType;
  attachment: AttachmentType;
  collapseMetadata: boolean;
  withContentAbove: boolean;
  withContentBelow: boolean;

  // Message properties. Many are needed for rendering metadata
  direction: DirectionType;
  expirationLength?: number;
  expirationTimestamp?: number;
  id: string;
  conversationId: string;
  played: boolean;
  showMessageDetail: (id: string) => void;
  status?: MessageStatusType;
  textPending?: boolean;
  timestamp: number;
  kickOffAttachmentDownload(): void;
  onCorrupted(): void;
  computePeaks(url: string, barCount: number): Promise<ComputePeaksResult>;
}>;

export type DispatchProps = Readonly<{
  loadAndPlayMessageAudio: (
    id: string,
    url: string,
    context: string,
    position: number,
    isConsecutive: boolean
  ) => void;
  setCurrentTime: (currentTime: number) => void;
  setPlaybackRate: (conversationId: string, rate: number) => void;
  setIsPlaying: (value: boolean) => void;
}>;

export type Props = OwnProps & DispatchProps;

type ButtonProps = {
  i18n: LocalizerType;
  variant: 'play' | 'playback-rate';
  mod?: string;
  label: string;
  visible?: boolean;
  animateClick?: boolean;
  onClick: () => void;
  onMouseDown?: () => void;
  onMouseUp?: () => void;
  children?: ReactNode;
};

enum State {
  NotDownloaded = 'NotDownloaded',
  Pending = 'Pending',
  Computing = 'Computing',
  Normal = 'Normal',
}

// Constants

const CSS_BASE = 'module-message__audio-attachment';
const BAR_COUNT = 47;
const BAR_NOT_DOWNLOADED_HEIGHT = 2;
const BAR_MIN_HEIGHT = 4;
const BAR_MAX_HEIGHT = 20;

const REWIND_BAR_COUNT = 2;

// Increments for keyboard audio seek (in seconds)
const SMALL_INCREMENT = 1;
const BIG_INCREMENT = 5;

const PLAYBACK_RATES = [1, 1.5, 2, 0.5];

const SPRING_CONFIG = {
  mass: 0.5,
  tension: 350,
  friction: 20,
  velocity: 0.01,
};

const DOT_DIV_WIDTH = 14;

// Utils

const timeToText = (time: number): string => {
  const hours = Math.floor(time / 3600);
  let minutes = Math.floor((time % 3600) / 60).toString();
  let seconds = Math.floor(time % 60).toString();

  if (hours !== 0 && minutes.length < 2) {
    minutes = `0${minutes}`;
  }

  if (seconds.length < 2) {
    seconds = `0${seconds}`;
  }

  return hours ? `${hours}:${minutes}:${seconds}` : `${minutes}:${seconds}`;
};

/**
 * Handles animations, key events, and stoping event propagation
 * for play button and playback rate button
 */
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function ButtonInner(props, ref) {
    const {
      i18n,
      variant,
      mod,
      label,
      children,
      onClick,
      visible = true,
      animateClick = true,
    } = props;
    const [isDown, setIsDown] = useState(false);

    const [animProps] = useSpring(
      {
        config: SPRING_CONFIG,
        to:
          isDown && animateClick ? { scale: 1.3 } : { scale: visible ? 1 : 0 },
      },
      [visible, isDown, animateClick]
    );

    // Clicking button toggle playback
    const onButtonClick = useCallback(
      (event: React.MouseEvent) => {
        event.stopPropagation();
        event.preventDefault();

        onClick();
      },
      [onClick]
    );

    // Keyboard playback toggle
    const onButtonKeyDown = useCallback(
      (event: React.KeyboardEvent) => {
        if (event.key !== 'Enter' && event.key !== 'Space') {
          return;
        }
        event.stopPropagation();
        event.preventDefault();

        onClick();
      },
      [onClick]
    );

    return (
      <animated.div style={animProps}>
        <button
          type="button"
          ref={ref}
          className={classNames(
            `${CSS_BASE}__${variant}-button`,
            mod ? `${CSS_BASE}__${variant}-button--${mod}` : undefined
          )}
          onClick={onButtonClick}
          onKeyDown={onButtonKeyDown}
          onMouseDown={() => setIsDown(true)}
          onMouseUp={() => setIsDown(false)}
          onMouseLeave={() => setIsDown(false)}
          tabIndex={0}
          aria-label={i18n(label)}
        >
          {children}
        </button>
      </animated.div>
    );
  }
);

function PlayedDot({
  played,
  onHide,
}: {
  played: boolean;
  onHide: () => void;
}) {
  const start = played ? 1 : 0;
  const end = played ? 0 : 1;

  const [animProps] = useSpring(
    {
      config: SPRING_CONFIG,
      from: { scale: start, opacity: start, width: start },
      to: { scale: end, opacity: end, width: end * DOT_DIV_WIDTH },
      onRest: () => {
        if (played) {
          onHide();
        }
      },
    },
    [played]
  );

  return (
    <animated.div
      style={animProps}
      aria-hidden="true"
      className={classNames(
        `${CSS_BASE}__dot`,
        `${CSS_BASE}__dot--${played ? 'played' : 'unplayed'}`
      )}
    />
  );
}

/**
 * Display message audio attachment along with its waveform, duration, and
 * toggle Play/Pause button.
 *
 * A global audio player is used for playback and access is managed by the
 * `activeAudioID` and `activeAudioContext` properties. Whenever both
 * `activeAudioID` and `activeAudioContext` are equal to `id` and `context`
 * respectively the instance of the `MessageAudio` assumes the ownership of the
 * `Audio` instance and fully manages it.
 *
 * `context` is required for displaying separate MessageAudio instances in
 * MessageDetails and Message React components.
 */
export function MessageAudio(props: Props): JSX.Element {
  const {
    active,
    buttonRef,
    i18n,
    renderingContext,
    attachment,
    collapseMetadata,
    conversationId,
    withContentAbove,
    withContentBelow,

    direction,
    expirationLength,
    expirationTimestamp,
    id,
    played,
    showMessageDetail,
    status,
    textPending,
    timestamp,

    kickOffAttachmentDownload,
    onCorrupted,
    computePeaks,
    setPlaybackRate,
    loadAndPlayMessageAudio,
    setCurrentTime,
    setIsPlaying,
  } = props;

  const waveformRef = useRef<HTMLDivElement | null>(null);

  const isPlaying = active?.playing ?? false;

  const [isPlayedDotVisible, setIsPlayedDotVisible] = React.useState(!played);

  // if it's playing, use the duration passed as props as it might
  // change during loading/playback (?)
  // NOTE: Avoid division by zero
  const activeDuration =
    active?.duration && !Number.isNaN(active.duration)
      ? active.duration
      : undefined;
  const [duration, setDuration] = useState(activeDuration ?? 1e-23);

  const [hasPeaks, setHasPeaks] = useState(false);
  const [peaks, setPeaks] = useState<ReadonlyArray<number>>(
    new Array(BAR_COUNT).fill(0)
  );

  let state: State;

  if (attachment.pending) {
    state = State.Pending;
  } else if (!isDownloaded(attachment)) {
    state = State.NotDownloaded;
  } else if (!hasPeaks) {
    state = State.Computing;
  } else {
    state = State.Normal;
  }

  // This effect loads audio file and computes its RMS peak for displaying the
  // waveform.
  useEffect(() => {
    if (state !== State.Computing) {
      return noop;
    }

    log.info('MessageAudio: loading audio and computing waveform');

    let canceled = false;

    (async () => {
      try {
        if (!attachment.url) {
          throw new Error(
            'Expected attachment url in the MessageAudio with ' +
              `state: ${state}`
          );
        }

        const { peaks: newPeaks, duration: newDuration } = await computePeaks(
          attachment.url,
          BAR_COUNT
        );
        if (canceled) {
          return;
        }
        setPeaks(newPeaks);
        setHasPeaks(true);
        setDuration(Math.max(newDuration, 1e-23));
      } catch (err) {
        log.error(
          'MessageAudio: computePeaks error, marking as corrupted',
          err
        );

        onCorrupted();
      }
    })();

    return () => {
      canceled = true;
    };
  }, [
    attachment,
    computePeaks,
    setDuration,
    setPeaks,
    setHasPeaks,
    onCorrupted,
    state,
  ]);

  const toggleIsPlaying = () => {
    if (!isPlaying) {
      if (!attachment.url) {
        throw new Error(
          'Expected attachment url in the MessageAudio with ' +
            `state: ${state}`
        );
      }

      if (active) {
        setIsPlaying(true);
      } else {
        loadAndPlayMessageAudio(id, attachment.url, renderingContext, 0, false);
      }
    } else {
      // stop
      setIsPlaying(false);
    }
  };

  // Clicking waveform moves playback head position and starts playback.
  const onWaveformClick = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    if (state !== State.Normal) {
      return;
    }
    if (!waveformRef.current) {
      return;
    }

    const boundingRect = waveformRef.current.getBoundingClientRect();
    let progress = (event.pageX - boundingRect.left) / boundingRect.width;

    if (progress <= REWIND_BAR_COUNT / BAR_COUNT) {
      progress = 0;
    }

    if (attachment.url) {
      loadAndPlayMessageAudio(
        id,
        attachment.url,
        renderingContext,
        progress,
        false
      );
    } else {
      log.warn('Waveform clicked on attachment with no url');
    }
  };

  // Keyboard navigation for waveform. Pressing keys moves playback head
  // forward/backwards.
  const onWaveformKeyDown = (event: React.KeyboardEvent) => {
    let increment: number;
    if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
      increment = +SMALL_INCREMENT;
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
      increment = -SMALL_INCREMENT;
    } else if (event.key === 'PageUp') {
      increment = +BIG_INCREMENT;
    } else if (event.key === 'PageDown') {
      increment = -BIG_INCREMENT;
    } else {
      // We don't handle other keys
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    // There is no audio to rewind
    if (!active) {
      return;
    }

    setCurrentTime(
      Math.min(
        Number.isNaN(duration) ? Infinity : duration,
        Math.max(0, active.currentTime + increment)
      )
    );

    if (!isPlaying) {
      toggleIsPlaying();
    }
  };

  const currentTimeOrZero = active?.currentTime ?? 0;

  const peakPosition = peaks.length * (currentTimeOrZero / duration);

  const waveform = (
    <div
      ref={waveformRef}
      className={`${CSS_BASE}__waveform`}
      onClick={onWaveformClick}
      onKeyDown={onWaveformKeyDown}
      tabIndex={0}
      role="slider"
      aria-label={i18n('MessageAudio--slider')}
      aria-orientation="horizontal"
      aria-valuenow={currentTimeOrZero}
      aria-valuemin={0}
      aria-valuemax={duration}
      aria-valuetext={timeToText(currentTimeOrZero)}
    >
      {peaks.map((peak, i) => {
        let height = Math.max(BAR_MIN_HEIGHT, BAR_MAX_HEIGHT * peak);
        if (state !== State.Normal) {
          height = BAR_NOT_DOWNLOADED_HEIGHT;
        }

        const highlight = i < peakPosition;

        // Use maximum height for current audio position
        if (highlight && i + 1 >= peakPosition) {
          height = BAR_MAX_HEIGHT;
        }

        const key = i;

        return (
          <div
            className={classNames([
              `${CSS_BASE}__waveform__bar`,
              highlight ? `${CSS_BASE}__waveform__bar--active` : null,
            ])}
            key={key}
            style={{ height }}
          />
        );
      })}
    </div>
  );

  let button: React.ReactElement;
  if (state === State.Pending || state === State.Computing) {
    // Not really a button, but who cares?
    button = (
      <div
        className={classNames(
          `${CSS_BASE}__spinner`,
          `${CSS_BASE}__spinner--pending`
        )}
        title={i18n('MessageAudio--pending')}
      />
    );
  } else if (state === State.NotDownloaded) {
    button = (
      <Button
        ref={buttonRef}
        i18n={i18n}
        variant="play"
        mod="download"
        label="MessageAudio--download"
        animateClick={false}
        onClick={kickOffAttachmentDownload}
      />
    );
  } else {
    // State.Normal
    button = (
      <Button
        ref={buttonRef}
        i18n={i18n}
        variant="play"
        mod={isPlaying ? 'pause' : 'play'}
        label={isPlaying ? 'MessageAudio--pause' : 'MessageAudio--play'}
        animateClick={false}
        onClick={toggleIsPlaying}
      />
    );
  }

  const countDown = Math.max(0, duration - (active?.currentTime ?? 0));

  const nextPlaybackRate = (currentRate: number): number => {
    // cycle through the rates
    return PLAYBACK_RATES[
      (PLAYBACK_RATES.indexOf(currentRate) + 1) % PLAYBACK_RATES.length
    ];
  };

  const playbackRateLabels: { [key: number]: string } = {
    1: i18n('MessageAudio--playbackRate1'),
    1.5: i18n('MessageAudio--playbackRate1p5'),
    2: i18n('MessageAudio--playbackRate2'),
    0.5: i18n('MessageAudio--playbackRatep5'),
  };

  const metadata = (
    <div className={`${CSS_BASE}__metadata`}>
      <div
        aria-hidden="true"
        className={classNames(
          `${CSS_BASE}__countdown`,
          `${CSS_BASE}__countdown--${played ? 'played' : 'unplayed'}`
        )}
      >
        {timeToText(countDown)}
      </div>

      <div className={`${CSS_BASE}__controls`}>
        <PlayedDot
          played={played}
          onHide={() => setIsPlayedDotVisible(false)}
        />
        <Button
          variant="playback-rate"
          i18n={i18n}
          label={(active && playbackRateLabels[active.playbackRate]) ?? ''}
          visible={isPlaying && (!played || !isPlayedDotVisible)}
          onClick={() => {
            if (active) {
              setPlaybackRate(
                conversationId,
                nextPlaybackRate(active.playbackRate)
              );
            }
          }}
        >
          {active && playbackRateLabels[active.playbackRate]}
        </Button>
      </div>

      {!withContentBelow && !collapseMetadata && (
        <MessageMetadata
          direction={direction}
          expirationLength={expirationLength}
          expirationTimestamp={expirationTimestamp}
          hasText={withContentBelow}
          i18n={i18n}
          id={id}
          isShowingImage={false}
          isSticker={false}
          isTapToViewExpired={false}
          showMessageDetail={showMessageDetail}
          status={status}
          textPending={textPending}
          timestamp={timestamp}
        />
      )}
    </div>
  );

  return (
    <div
      className={classNames(
        CSS_BASE,
        `${CSS_BASE}--${direction}`,
        withContentBelow ? `${CSS_BASE}--with-content-below` : null,
        withContentAbove ? `${CSS_BASE}--with-content-above` : null
      )}
    >
      <div className={`${CSS_BASE}__button-and-waveform`}>
        {button}
        {waveform}
      </div>
      {metadata}
    </div>
  );
}

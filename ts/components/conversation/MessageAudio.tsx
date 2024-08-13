// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useCallback } from 'react';
import type { RefObject } from 'react';
import classNames from 'classnames';
import { noop } from 'lodash';
import { animated, useSpring } from '@react-spring/web';

import type { LocalizerType } from '../../types/Util';
import type { AttachmentType } from '../../types/Attachment';
import type { PushPanelForConversationActionType } from '../../state/ducks/conversations';
import { isDownloaded } from '../../types/Attachment';
import type { DirectionType, MessageStatusType } from './Message';

import type { ComputePeaksResult } from '../VoiceNotesPlaybackContext';
import { MessageMetadata } from './MessageMetadata';
import * as log from '../../logging/log';
import type { ActiveAudioPlayerStateType } from '../../state/ducks/audioPlayer';
import { PlaybackRateButton } from '../PlaybackRateButton';
import { PlaybackButton } from '../PlaybackButton';
import { WaveformScrubber } from './WaveformScrubber';
import { useComputePeaks } from '../../hooks/useComputePeaks';
import { durationToPlaybackText } from '../../util/durationToPlaybackText';
import { shouldNeverBeCalled } from '../../util/shouldNeverBeCalled';

export type OwnProps = Readonly<{
  active:
    | Pick<
        ActiveAudioPlayerStateType,
        'currentTime' | 'duration' | 'playing' | 'playbackRate'
      >
    | undefined;
  buttonRef: RefObject<HTMLButtonElement>;
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
  played: boolean;
  status?: MessageStatusType;
  textPending?: boolean;
  timestamp: number;
  kickOffAttachmentDownload(): void;
  onCorrupted(): void;
  computePeaks(url: string, barCount: number): Promise<ComputePeaksResult>;
  onPlayMessage: (id: string, position: number) => void;
}>;

export type DispatchProps = Readonly<{
  pushPanelForConversation: PushPanelForConversationActionType;
  setPosition: (positionAsRatio: number) => void;
  setPlaybackRate: (rate: number) => void;
  setIsPlaying: (value: boolean) => void;
}>;

export type Props = OwnProps & DispatchProps;

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

const SPRING_CONFIG = {
  mass: 0.5,
  tension: 350,
  friction: 20,
  velocity: 0.01,
};

const DOT_DIV_WIDTH = 14;

function PlayedDot({
  played,
  onHide,
}: {
  played: boolean;
  onHide: () => void;
}) {
  const start = played ? 1 : 0;
  const end = played ? 0 : 1;

  // eslint-disable-next-line react-hooks/exhaustive-deps -- FIXME
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
 * `active.content.current.id` and the `active.content.context` properties. Whenever both
 * are equal to `id` and `context` respectively the instance of the `MessageAudio`
 * assumes the ownership of the `Audio` instance and fully manages it.
 *
 * `context` is required for displaying separate MessageAudio instances in
 * MessageDetails and Message React components.
 */
export function MessageAudio(props: Props): JSX.Element {
  const {
    active,
    buttonRef,
    i18n,
    attachment,
    collapseMetadata,
    withContentAbove,
    withContentBelow,

    direction,
    expirationLength,
    expirationTimestamp,
    id,
    played,
    status,
    textPending,
    timestamp,

    kickOffAttachmentDownload,
    onCorrupted,
    setPlaybackRate,
    onPlayMessage,
    pushPanelForConversation,
    setPosition,
    setIsPlaying,
  } = props;

  const isPlaying = active?.playing ?? false;

  const [isPlayedDotVisible, setIsPlayedDotVisible] = React.useState(!played);

  const audioUrl = isDownloaded(attachment) ? attachment.url : undefined;

  const { duration, hasPeaks, peaks } = useComputePeaks({
    audioUrl,
    activeDuration: active?.duration,
    barCount: BAR_COUNT,
    onCorrupted,
  });

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

  const toggleIsPlaying = useCallback(() => {
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
        onPlayMessage(id, 0);
      }
    } else {
      setIsPlaying(false);
    }
  }, [
    isPlaying,
    attachment.url,
    active,
    state,
    setIsPlaying,
    id,
    onPlayMessage,
  ]);

  const currentTimeOrZero = active?.currentTime ?? 0;

  const updatePosition = useCallback(
    (newPosition: number) => {
      if (active) {
        setPosition(newPosition);
        if (!active.playing) {
          setIsPlaying(true);
        }
        return;
      }

      if (attachment.url) {
        onPlayMessage(id, newPosition);
      } else {
        log.warn('Waveform clicked on attachment with no url');
      }
    },
    [active, attachment.url, id, onPlayMessage, setIsPlaying, setPosition]
  );

  const handleWaveformClick = useCallback(
    (positionAsRatio: number) => {
      if (state !== State.Normal) {
        return;
      }

      updatePosition(positionAsRatio);
    },
    [state, updatePosition]
  );

  const handleWaveformScrub = useCallback(
    (amountInSeconds: number) => {
      const currentPosition = currentTimeOrZero / duration;
      const positionIncrement = amountInSeconds / duration;

      updatePosition(
        Math.min(Math.max(0, currentPosition + positionIncrement), duration)
      );
    },
    [currentTimeOrZero, duration, updatePosition]
  );

  const waveform = (
    <WaveformScrubber
      i18n={i18n}
      peaks={peaks}
      duration={duration}
      currentTime={currentTimeOrZero}
      barMinHeight={
        state !== State.Normal ? BAR_NOT_DOWNLOADED_HEIGHT : BAR_MIN_HEIGHT
      }
      barMaxHeight={BAR_MAX_HEIGHT}
      onClick={handleWaveformClick}
      onScrub={handleWaveformScrub}
    />
  );

  let button: React.ReactElement;
  if (state === State.Pending || state === State.Computing) {
    // Not really a button, but who cares?
    button = (
      <PlaybackButton
        variant="message"
        mod="pending"
        onClick={noop}
        label={i18n('icu:MessageAudio--pending')}
        context={direction}
      />
    );
  } else if (state === State.NotDownloaded) {
    button = (
      <PlaybackButton
        ref={buttonRef}
        variant="message"
        mod="download"
        label={i18n('icu:MessageAudio--download')}
        onClick={kickOffAttachmentDownload}
        context={direction}
      />
    );
  } else {
    // State.Normal
    button = (
      <PlaybackButton
        ref={buttonRef}
        variant="message"
        mod={isPlaying ? 'pause' : 'play'}
        label={
          isPlaying
            ? i18n('icu:MessageAudio--pause')
            : i18n('icu:MessageAudio--play')
        }
        onClick={toggleIsPlaying}
        context={direction}
      />
    );
  }

  const countDown = Math.max(0, duration - (active?.currentTime ?? 0));

  const metadata = (
    <div className={`${CSS_BASE}__metadata`}>
      <div
        aria-hidden="true"
        className={classNames(
          `${CSS_BASE}__countdown`,
          `${CSS_BASE}__countdown--${played ? 'played' : 'unplayed'}`
        )}
      >
        {durationToPlaybackText(countDown)}
      </div>

      <div className={`${CSS_BASE}__controls`}>
        <PlayedDot
          played={played}
          onHide={() => setIsPlayedDotVisible(false)}
        />

        <PlaybackRateButton
          i18n={i18n}
          variant={`message-${direction}`}
          playbackRate={active?.playbackRate}
          visible={isPlaying && (!played || !isPlayedDotVisible)}
          onClick={() => {
            if (active) {
              setPlaybackRate(
                PlaybackRateButton.nextPlaybackRate(active.playbackRate)
              );
            }
          }}
        />
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
          pushPanelForConversation={pushPanelForConversation}
          retryMessageSend={shouldNeverBeCalled}
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

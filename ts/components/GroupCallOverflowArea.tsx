// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactElement } from 'react';
import React, { useRef, useState, useEffect } from 'react';
import classNames from 'classnames';
import type { VideoFrameSource } from '@signalapp/ringrtc';
import type { LocalizerType } from '../types/Util';
import type { GroupCallRemoteParticipantType } from '../types/Calling';
import { GroupCallRemoteParticipant } from './GroupCallRemoteParticipant';
import type { CallingImageDataCache } from './CallManager';

const OVERFLOW_SCROLLED_TO_EDGE_THRESHOLD = 20;
const OVERFLOW_SCROLL_BUTTON_RATIO = 0.75;

// This should be an integer, as sub-pixel widths can cause performance issues.
export const OVERFLOW_PARTICIPANT_WIDTH = 107;

export type PropsType = {
  getFrameBuffer: () => Buffer;
  getGroupCallVideoFrameSource: (demuxId: number) => VideoFrameSource;
  i18n: LocalizerType;
  imageDataCache: React.RefObject<CallingImageDataCache>;
  isCallReconnecting: boolean;
  joinedAt: number | null;
  onClickRaisedHand?: () => void;
  onParticipantVisibilityChanged: (
    demuxId: number,
    isVisible: boolean
  ) => unknown;
  overflowedParticipants: ReadonlyArray<GroupCallRemoteParticipantType>;
  remoteAudioLevels: Map<number, number>;
  remoteParticipantsCount: number;
};

export function GroupCallOverflowArea({
  getFrameBuffer,
  getGroupCallVideoFrameSource,
  imageDataCache,
  i18n,
  isCallReconnecting,
  joinedAt,
  onClickRaisedHand,
  onParticipantVisibilityChanged,
  overflowedParticipants,
  remoteAudioLevels,
  remoteParticipantsCount,
}: PropsType): JSX.Element | null {
  const overflowRef = useRef<HTMLDivElement | null>(null);
  const [overflowScrollTop, setOverflowScrollTop] = useState(0);

  // This assumes that these values will change along with re-renders. If that's not true,
  //   we should add these values to the component's state.
  let visibleHeight: number;
  let scrollMax: number;
  if (overflowRef.current) {
    visibleHeight = overflowRef.current.clientHeight;
    scrollMax = overflowRef.current.scrollHeight - visibleHeight;
  } else {
    visibleHeight = 0;
    scrollMax = 0;
  }

  const hasOverflowedParticipants = Boolean(overflowedParticipants.length);

  useEffect(() => {
    // If there aren't any overflowed participants, we want to clear the scroll position
    //   so we don't hold onto stale values.
    if (!hasOverflowedParticipants) {
      setOverflowScrollTop(0);
    }
  }, [hasOverflowedParticipants]);

  if (!hasOverflowedParticipants) {
    return null;
  }

  const isScrolledToTop =
    overflowScrollTop < OVERFLOW_SCROLLED_TO_EDGE_THRESHOLD;
  const isScrolledToBottom =
    overflowScrollTop > scrollMax - OVERFLOW_SCROLLED_TO_EDGE_THRESHOLD;

  return (
    <div
      className="module-ongoing-call__participants__overflow"
      style={{
        // This width could live in CSS but we put it here to avoid having to keep two
        //   values in sync.
        width: OVERFLOW_PARTICIPANT_WIDTH,
      }}
    >
      <OverflowAreaScrollMarker
        i18n={i18n}
        isHidden={isScrolledToTop}
        onClick={() => {
          const el = overflowRef.current;
          if (!el) {
            return;
          }
          el.scrollTo({
            top: Math.max(
              el.scrollTop - visibleHeight * OVERFLOW_SCROLL_BUTTON_RATIO,
              0
            ),
            left: 0,
            behavior: 'smooth',
          });
        }}
        placement="top"
      />
      <div
        className="module-ongoing-call__participants__overflow__inner"
        ref={overflowRef}
        onScroll={() => {
          // Ideally this would use `event.target.scrollTop`, but that does not seem to be
          //   available, so we use the ref.
          const el = overflowRef.current;
          if (!el) {
            return;
          }
          setOverflowScrollTop(el.scrollTop);
        }}
      >
        {overflowedParticipants.map(remoteParticipant => (
          <GroupCallRemoteParticipant
            key={remoteParticipant.demuxId}
            getFrameBuffer={getFrameBuffer}
            getGroupCallVideoFrameSource={getGroupCallVideoFrameSource}
            imageDataCache={imageDataCache}
            i18n={i18n}
            audioLevel={remoteAudioLevels.get(remoteParticipant.demuxId) ?? 0}
            onClickRaisedHand={onClickRaisedHand}
            onVisibilityChanged={onParticipantVisibilityChanged}
            width={OVERFLOW_PARTICIPANT_WIDTH}
            height={Math.floor(
              OVERFLOW_PARTICIPANT_WIDTH / remoteParticipant.videoAspectRatio
            )}
            remoteParticipant={remoteParticipant}
            remoteParticipantsCount={remoteParticipantsCount}
            isActiveSpeakerInSpeakerView={false}
            isCallReconnecting={isCallReconnecting}
            isInOverflow
            joinedAt={joinedAt}
          />
        ))}
      </div>
      <OverflowAreaScrollMarker
        i18n={i18n}
        isHidden={isScrolledToBottom}
        onClick={() => {
          const el = overflowRef.current;
          if (!el) {
            return;
          }
          el.scrollTo({
            top: Math.min(
              el.scrollTop + visibleHeight * OVERFLOW_SCROLL_BUTTON_RATIO,
              scrollMax
            ),
            left: 0,
            behavior: 'smooth',
          });
        }}
        placement="bottom"
      />
    </div>
  );
}

function OverflowAreaScrollMarker({
  i18n,
  isHidden,
  onClick,
  placement,
}: {
  i18n: LocalizerType;
  isHidden: boolean;
  onClick: () => void;
  placement: 'top' | 'bottom';
}): ReactElement {
  const baseClassName =
    'module-ongoing-call__participants__overflow__scroll-marker';

  return (
    <div
      className={classNames(baseClassName, `${baseClassName}--${placement}`, {
        [`${baseClassName}--hidden`]: isHidden,
      })}
    >
      <button
        type="button"
        className={`${baseClassName}__button`}
        onClick={onClick}
        aria-label={
          placement === 'top'
            ? i18n('icu:calling__overflow__scroll-up')
            : i18n('icu:calling__overflow__scroll-down')
        }
      />
    </div>
  );
}

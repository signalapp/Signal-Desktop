// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import { animated, useSpring } from '@react-spring/web';

import { Avatar, AvatarSize } from './Avatar';
import { ContactName } from './conversation/ContactName';
import type { ConversationsByDemuxIdType } from '../types/Calling';
import type { ServiceIdString } from '../types/ServiceId';
import type { LocalizerType } from '../types/Util';
import type { ConversationType } from '../state/ducks/conversations';
import { ModalHost } from './ModalHost';
import { drop } from '../util/drop';
import * as log from '../logging/log';
import { usePrevious } from '../hooks/usePrevious';
import { useReducedMotion } from '../hooks/useReducedMotion';

export type PropsType = {
  readonly i18n: LocalizerType;
  readonly onClose: () => void;
  readonly onLowerMyHand: () => void;
  readonly localDemuxId: number | undefined;
  readonly conversationsByDemuxId: ConversationsByDemuxIdType;
  readonly raisedHands: Set<number>;
  readonly localHandRaised: boolean;
};

export function CallingRaisedHandsList({
  i18n,
  onClose,
  onLowerMyHand,
  localDemuxId,
  conversationsByDemuxId,
  raisedHands,
  localHandRaised,
}: PropsType): JSX.Element | null {
  const ourServiceId: ServiceIdString | undefined = localDemuxId
    ? conversationsByDemuxId.get(localDemuxId)?.serviceId
    : undefined;

  const participants = React.useMemo<Array<ConversationType>>(() => {
    const serviceIds: Set<ServiceIdString> = new Set();
    const conversations: Array<ConversationType> = [];
    raisedHands.forEach(demuxId => {
      const conversation = conversationsByDemuxId.get(demuxId);
      if (!conversation) {
        log.warn(
          'CallingRaisedHandsList: Failed to get conversationsByDemuxId for demuxId',
          { demuxId }
        );
        return;
      }

      const { serviceId } = conversation;
      if (serviceId) {
        if (serviceIds.has(serviceId)) {
          return;
        }

        serviceIds.add(serviceId);
      }

      conversations.push(conversation);
    });
    return conversations;
  }, [raisedHands, conversationsByDemuxId]);

  return (
    <ModalHost
      modalName="CallingRaisedHandsList"
      moduleClassName="CallingRaisedHandsList"
      onClose={onClose}
    >
      <div className="CallingRaisedHandsList module-calling-participants-list">
        <div className="module-calling-participants-list__header">
          <div className="module-calling-participants-list__title">
            {i18n('icu:CallingRaisedHandsList__Title', {
              count: participants.length,
            })}
            {participants.length > 1 ? (
              <span className="CallingRaisedHandsList__TitleHint">
                {' '}
                {i18n('icu:CallingRaisedHandsList__TitleHint')}
              </span>
            ) : null}
          </div>
          <button
            type="button"
            className="module-calling-participants-list__close"
            onClick={onClose}
            tabIndex={0}
            aria-label={i18n('icu:close')}
          />
        </div>
        <ul className="module-calling-participants-list__list">
          {participants.map((participant: ConversationType, index: number) => (
            <li
              className="module-calling-participants-list__contact"
              key={participant.serviceId ?? index}
            >
              <div className="CallingRaisedHandsList__AvatarAndName module-calling-participants-list__avatar-and-name">
                <Avatar
                  acceptedMessageRequest={participant.acceptedMessageRequest}
                  avatarUrl={participant.avatarUrl}
                  badge={undefined}
                  color={participant.color}
                  conversationType="direct"
                  i18n={i18n}
                  isMe={participant.isMe}
                  profileName={participant.profileName}
                  title={participant.title}
                  sharedGroupNames={participant.sharedGroupNames}
                  size={AvatarSize.THIRTY_TWO}
                />
                {ourServiceId && participant.serviceId === ourServiceId ? (
                  <span className="module-calling-participants-list__name">
                    {i18n('icu:you')}
                  </span>
                ) : (
                  <ContactName
                    module="module-calling-participants-list__name"
                    title={participant.title}
                  />
                )}
              </div>
              {localHandRaised &&
                ourServiceId &&
                participant.serviceId === ourServiceId && (
                  <button
                    className="CallingRaisedHandsList__LowerMyHandLink"
                    type="button"
                    onClick={onLowerMyHand}
                  >
                    {i18n('icu:CallControls__RaiseHands--lower')}
                  </button>
                )}
              <div className="module-calling-participants-list__status-icon CallingRaisedHandsList__NameHandIcon" />
            </li>
          ))}
        </ul>
      </div>
    </ModalHost>
  );
}

const BUTTON_OPACITY_SPRING_CONFIG = {
  mass: 1,
  tension: 210,
  friction: 20,
  precision: 0.01,
  clamp: true,
} as const;

const BUTTON_SCALE_SPRING_CONFIG = {
  mass: 1.5,
  tension: 230,
  friction: 8,
  precision: 0.02,
  velocity: 0.0025,
} as const;

export type CallingRaisedHandsListButtonPropsType = {
  i18n: LocalizerType;
  raisedHandsCount: number;
  syncedLocalHandRaised: boolean;
  onClick: () => void;
};

export function CallingRaisedHandsListButton({
  i18n,
  syncedLocalHandRaised,
  raisedHandsCount,
  onClick,
}: CallingRaisedHandsListButtonPropsType): JSX.Element | null {
  const [isVisible, setIsVisible] = React.useState(raisedHandsCount > 0);

  const reducedMotion = useReducedMotion();

  // eslint-disable-next-line react-hooks/exhaustive-deps -- FIXME
  const [opacitySpringProps, opacitySpringApi] = useSpring(
    {
      from: { opacity: 0 },
      to: { opacity: 1 },
      config: BUTTON_OPACITY_SPRING_CONFIG,
    },
    []
  );
  // eslint-disable-next-line react-hooks/exhaustive-deps -- FIXME
  const [scaleSpringProps, scaleSpringApi] = useSpring(
    {
      immediate: reducedMotion,
      from: { scale: 0.9 },
      to: { scale: 1 },
      config: BUTTON_SCALE_SPRING_CONFIG,
    },
    []
  );

  const prevRaisedHandsCount = usePrevious(raisedHandsCount, raisedHandsCount);
  const prevSyncedLocalHandRaised = usePrevious(
    syncedLocalHandRaised,
    syncedLocalHandRaised
  );

  React.useEffect(() => {
    if (raisedHandsCount > prevRaisedHandsCount) {
      setIsVisible(true);
      opacitySpringApi.stop();
      drop(Promise.all(opacitySpringApi.start({ opacity: 1 })));
      scaleSpringApi.stop();
      drop(
        Promise.all(
          scaleSpringApi.start({
            from: { scale: 0.99 },
            to: { scale: 1 },
            config: { velocity: 0.0025 },
          })
        )
      );
    } else if (raisedHandsCount === 0) {
      opacitySpringApi.stop();
      drop(
        Promise.all(
          opacitySpringApi.start({
            to: { opacity: 0 },
            onRest: () => {
              if (!raisedHandsCount) {
                setIsVisible(false);
              }
            },
          })
        )
      );
    }
  }, [
    raisedHandsCount,
    prevRaisedHandsCount,
    opacitySpringApi,
    scaleSpringApi,
    setIsVisible,
  ]);

  if (!isVisible) {
    return null;
  }

  // When the last hands are lowered, maintain the last count while fading out to prevent
  // abrupt label changes.
  let shownSyncedLocalHandRaised: boolean = syncedLocalHandRaised;
  let shownRaisedHandsCount: number = raisedHandsCount;
  if (raisedHandsCount === 0 && prevRaisedHandsCount) {
    shownRaisedHandsCount = prevRaisedHandsCount;
    shownSyncedLocalHandRaised = prevSyncedLocalHandRaised;
  }

  return (
    <animated.button
      className="CallingRaisedHandsList__Button"
      onClick={onClick}
      style={{ ...opacitySpringProps, ...scaleSpringProps }}
      type="button"
    >
      <span className="CallingRaisedHandsList__ButtonIcon" />
      {shownSyncedLocalHandRaised ? (
        <>
          {i18n('icu:you')}
          {shownRaisedHandsCount > 1 &&
            ` + ${String(shownRaisedHandsCount - 1)}`}
        </>
      ) : (
        shownRaisedHandsCount
      )}
    </animated.button>
  );
}

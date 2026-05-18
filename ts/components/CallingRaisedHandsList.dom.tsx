// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useEffect, useRef, useMemo, useState, type JSX } from 'react';
import { animated, useSpring } from '@react-spring/web';

import { Avatar, AvatarSize } from './Avatar.dom.tsx';
import { ContactName } from './conversation/ContactName.dom.tsx';
import type { ConversationsByDemuxIdType } from '../types/Calling.std.ts';
import type { ServiceIdString } from '../types/ServiceId.std.ts';
import type { LocalizerType } from '../types/Util.std.ts';
import { ModalHost } from './ModalHost.dom.tsx';
import { drop } from '../util/drop.std.ts';
import { createLogger } from '../logging/log.std.ts';
import { usePrevious, usePreviousEffect } from '../hooks/usePrevious.std.ts';
import { useReducedMotion } from '../hooks/useReducedMotion.dom.ts';
import { CallingStatusIndicatorHandRaised } from './CallingStatusIndicatorHandRaised.dom.tsx';
import { tw } from '../axo/tw.dom.tsx';

const log = createLogger('CallingRaisedHandsList');

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

  // Filter by unique serviceId, in case participants are on multiple devices
  const raisedHandsForDisplay = useMemo<Array<number>>(() => {
    const serviceIdsSeen = new Set<ServiceIdString>();
    const resultDemuxIds: Array<number> = [];
    raisedHands.forEach(demuxId => {
      const conversation = conversationsByDemuxId.get(demuxId);
      if (!conversation) {
        log.warn('Failed to get conversationsByDemuxId for demuxId', {
          demuxId,
        });
        return;
      }

      const { serviceId } = conversation;
      if (serviceId) {
        if (serviceIdsSeen.has(serviceId)) {
          return;
        }

        serviceIdsSeen.add(serviceId);
      }

      resultDemuxIds.push(demuxId);
    });
    return resultDemuxIds;
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
              count: raisedHandsForDisplay.length,
            })}
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
          {raisedHandsForDisplay.map((demuxId: number, index: number) => {
            const conversation = conversationsByDemuxId.get(demuxId);
            if (!conversation) {
              return null;
            }

            return (
              <li
                className="module-calling-participants-list__contact"
                key={conversation.serviceId ?? index}
              >
                <div className="CallingRaisedHandsList__AvatarAndName module-calling-participants-list__avatar-and-name">
                  <Avatar
                    avatarPlaceholderGradient={
                      conversation.avatarPlaceholderGradient
                    }
                    avatarUrl={conversation.avatarUrl}
                    badge={undefined}
                    color={conversation.color}
                    conversationType="direct"
                    hasAvatar={conversation.hasAvatar}
                    i18n={i18n}
                    profileName={conversation.profileName}
                    title={conversation.title}
                    size={AvatarSize.THIRTY_SIX}
                  />
                  {ourServiceId && conversation.serviceId === ourServiceId ? (
                    <span className="module-calling-participants-list__name">
                      {i18n('icu:you')}
                    </span>
                  ) : (
                    <ContactName
                      module="module-calling-participants-list__name"
                      title={conversation.title}
                    />
                  )}
                </div>
                <span className={tw('me-1')} />
                {localHandRaised &&
                  ourServiceId &&
                  conversation.serviceId === ourServiceId && (
                    <button
                      className="CallingRaisedHandsList__LowerMyHandLink"
                      type="button"
                      onClick={onLowerMyHand}
                    >
                      {i18n('icu:CallControls__RaiseHands--lower')}
                    </button>
                  )}
                <CallingStatusIndicatorHandRaised
                  isOnlyHandRaised={raisedHandsForDisplay.length === 1}
                  raisedHandOrder={index}
                />
                <span className={tw('me-2')} />
              </li>
            );
          })}
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
  const [isVisible, setIsVisible] = useState(raisedHandsCount > 0);

  const reducedMotion = useReducedMotion();

  // oxlint-disable-next-line react-hooks/exhaustive-deps -- FIXME
  const [opacitySpringProps, opacitySpringApi] = useSpring(
    {
      from: { opacity: 0 },
      to: { opacity: 1 },
      config: BUTTON_OPACITY_SPRING_CONFIG,
    },
    []
  );
  // oxlint-disable-next-line react-hooks/exhaustive-deps -- FIXME
  const [scaleSpringProps, scaleSpringApi] = useSpring(
    {
      immediate: reducedMotion,
      from: { scale: 0.9 },
      to: { scale: 1 },
      config: BUTTON_SCALE_SPRING_CONFIG,
    },
    []
  );

  const prevRaisedHandsCount = usePrevious(raisedHandsCount) ?? 0;
  const prevSyncedLocalHandRaised = usePreviousEffect(
    syncedLocalHandRaised,
    syncedLocalHandRaised
  );

  const prevShownRaisedHandsCountRef = useRef<number>(raisedHandsCount);
  const prevShownSyncedLocalHandRaisedRef = useRef<boolean>(
    syncedLocalHandRaised
  );

  // Bouncy effect
  useEffect(() => {
    if (raisedHandsCount > prevRaisedHandsCount) {
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
    }
  }, [raisedHandsCount, prevRaisedHandsCount, scaleSpringApi]);

  useEffect(() => {
    if (raisedHandsCount === prevRaisedHandsCount) {
      return;
    }

    opacitySpringApi.stop();
    if (raisedHandsCount > 0) {
      setIsVisible(true);
      drop(
        Promise.all(
          opacitySpringApi.start({
            from: { opacity: opacitySpringProps.opacity },
            to: { opacity: 1 },
          })
        )
      );
    } else {
      drop(
        Promise.all(
          opacitySpringApi.start({
            from: { opacity: opacitySpringProps.opacity },
            to: { opacity: 0 },
            onResolve: ({ cancelled }) => {
              if (!cancelled) {
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
    opacitySpringProps.opacity,
    setIsVisible,
  ]);

  useEffect(() => {
    if (isVisible && raisedHandsCount === 0 && prevRaisedHandsCount > 0) {
      prevShownRaisedHandsCountRef.current = prevRaisedHandsCount;
      prevShownSyncedLocalHandRaisedRef.current = prevSyncedLocalHandRaised;
    }
  }, [
    isVisible,
    prevRaisedHandsCount,
    prevSyncedLocalHandRaised,
    raisedHandsCount,
  ]);

  if (!isVisible) {
    return null;
  }

  // When the last hands are lowered, maintain the last count while fading out to prevent
  // abrupt label changes.
  let shownSyncedLocalHandRaised: boolean = syncedLocalHandRaised;
  let shownRaisedHandsCount: number = raisedHandsCount;
  if (raisedHandsCount === 0) {
    if (prevRaisedHandsCount > 0) {
      shownRaisedHandsCount = prevRaisedHandsCount;
      shownSyncedLocalHandRaised = prevSyncedLocalHandRaised;
    } else {
      shownRaisedHandsCount = prevShownRaisedHandsCountRef.current;
      shownSyncedLocalHandRaised = prevShownSyncedLocalHandRaisedRef.current;
    }
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

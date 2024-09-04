// Copyright 2018 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactElement } from 'react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import classNames from 'classnames';
import { animated, useSpring } from '@react-spring/web';

import { TypingAnimation } from './TypingAnimation';
import { Avatar } from '../Avatar';

import type { LocalizerType, ThemeType } from '../../types/Util';
import type { ConversationType } from '../../state/ducks/conversations';
import type { PreferredBadgeSelectorType } from '../../state/selectors/badges';
import { drop } from '../../util/drop';
import { useReducedMotion } from '../../hooks/useReducedMotion';

const MAX_AVATARS_COUNT = 3;

type TypingContactType = Pick<
  ConversationType,
  | 'acceptedMessageRequest'
  | 'avatarUrl'
  | 'badges'
  | 'color'
  | 'id'
  | 'isMe'
  | 'phoneNumber'
  | 'profileName'
  | 'sharedGroupNames'
  | 'title'
>;

export type TypingBubblePropsType = {
  conversationId: string;
  conversationType: 'group' | 'direct';
  typingContactIdTimestamps: Record<string, number>;
  lastItemAuthorId: string | undefined;
  lastItemTimestamp: number | undefined;
  getConversation: (id: string) => ConversationType;
  getPreferredBadge: PreferredBadgeSelectorType;
  showContactModal: (contactId: string, conversationId?: string) => void;
  i18n: LocalizerType;
  theme: ThemeType;
};

const SPRING_CONFIG = {
  mass: 1,
  tension: 439,
  friction: 42,
  precision: 0,
  velocity: 0,
};

const AVATAR_ANIMATION_PROPS: Record<'visible' | 'hidden', object> = {
  visible: {
    opacity: 1,
    width: '28px',
    x: '0px',
    top: '0px',
  },
  hidden: {
    opacity: 0.5,
    width: '4px', // Match value of module-message__typing-avatar margin-inline-start
    x: '12px',
    top: '34px',
  },
};

function TypingBubbleAvatar({
  conversationId,
  contact,
  visible,
  shouldAnimate,
  getPreferredBadge,
  onContactExit,
  showContactModal,
  i18n,
  theme,
}: {
  conversationId: string;
  contact: TypingContactType | undefined;
  visible: boolean;
  shouldAnimate: boolean;
  getPreferredBadge: PreferredBadgeSelectorType;
  onContactExit: (id: string | undefined) => void;
  showContactModal: (contactId: string, conversationId?: string) => void;
  i18n: LocalizerType;
  theme: ThemeType;
}): ReactElement | null {
  const reducedMotion = useReducedMotion();
  // eslint-disable-next-line react-hooks/exhaustive-deps -- FIXME
  const [springProps, springApi] = useSpring(
    {
      immediate: reducedMotion,
      config: SPRING_CONFIG,
      from: shouldAnimate
        ? AVATAR_ANIMATION_PROPS[visible ? 'hidden' : 'visible']
        : {},
      to: AVATAR_ANIMATION_PROPS[visible ? 'visible' : 'hidden'],
      onRest: () => {
        if (!visible) {
          onContactExit(contact?.id);
        }
      },
    },
    [visible]
  );

  useEffect(() => {
    springApi.stop();
    drop(
      Promise.all(
        springApi.start(AVATAR_ANIMATION_PROPS[visible ? 'visible' : 'hidden'])
      )
    );
  }, [visible, springApi]);

  if (!contact) {
    return null;
  }

  return (
    <animated.div className="module-message__typing-avatar" style={springProps}>
      <Avatar
        acceptedMessageRequest={contact.acceptedMessageRequest}
        avatarUrl={contact.avatarUrl}
        badge={getPreferredBadge(contact.badges)}
        color={contact.color}
        conversationType="direct"
        i18n={i18n}
        isMe={contact.isMe}
        onClick={event => {
          event.stopPropagation();
          event.preventDefault();
          showContactModal(contact.id, conversationId);
        }}
        phoneNumber={contact.phoneNumber}
        profileName={contact.profileName}
        theme={theme}
        title={contact.title}
        sharedGroupNames={contact.sharedGroupNames}
        size={28}
      />
    </animated.div>
  );
}

function TypingBubbleGroupAvatars({
  conversationId,
  typingContactIds,
  shouldAnimate,
  getConversation,
  getPreferredBadge,
  showContactModal,
  i18n,
  theme,
}: Pick<
  TypingBubblePropsType,
  | 'conversationId'
  | 'getConversation'
  | 'getPreferredBadge'
  | 'showContactModal'
  | 'i18n'
  | 'theme'
> & {
  typingContactIds: ReadonlyArray<string>;
  shouldAnimate: boolean;
}): ReactElement {
  const [allContactsById, setAllContactsById] = useState<
    Map<string, TypingContactType>
  >(new Map());

  const onContactExit = useCallback((id: string | undefined) => {
    if (!id) {
      return;
    }

    setAllContactsById(prevMap => {
      const map = new Map([...prevMap]);
      map.delete(id);
      return map;
    });
  }, []);

  const visibleContactIds: Set<string> = useMemo(() => {
    const set = new Set<string>();
    for (const id of typingContactIds) {
      set.add(id);
    }
    return set;
  }, [typingContactIds]);

  useEffect(() => {
    setAllContactsById(prevMap => {
      const map = new Map([...prevMap]);
      for (const id of typingContactIds) {
        map.set(id, getConversation(id));
      }
      return map;
    });
  }, [typingContactIds, getConversation]);

  const typingContactsOverflowCount = Math.max(
    typingContactIds.length - MAX_AVATARS_COUNT,
    0
  );

  // Avatars are rendered Right-to-Left so the leftmost avatars can render on top.
  return (
    <div className="module-message__author-avatar-container module-message__author-avatar-container--typing">
      <div className="module-message__typing-avatar-spacer" />
      {typingContactsOverflowCount > 0 && (
        <div
          className="module-message__typing-avatar module-message__typing-avatar--overflow-count
        "
        >
          <div
            aria-label={i18n('icu:TypingBubble__avatar--overflow-count', {
              count: typingContactsOverflowCount,
            })}
            className="module-Avatar"
          >
            <div className="module-Avatar__contents">
              <div aria-hidden="true" className="module-Avatar__label">
                +{typingContactsOverflowCount}
              </div>
            </div>
          </div>
        </div>
      )}
      {[...allContactsById.keys()]
        .slice(-1 * MAX_AVATARS_COUNT)
        .map(contactId => (
          <TypingBubbleAvatar
            key={contactId}
            conversationId={conversationId}
            contact={allContactsById.get(contactId)}
            getPreferredBadge={getPreferredBadge}
            showContactModal={showContactModal}
            onContactExit={onContactExit}
            i18n={i18n}
            theme={theme}
            visible={visibleContactIds.has(contactId)}
            shouldAnimate={shouldAnimate}
          />
        ))}
    </div>
  );
}

const OUTER_DIV_ANIMATION_PROPS: Record<'visible' | 'hidden', object> = {
  visible: { height: '44px' },
  hidden: { height: '0px' },
};
const BUBBLE_ANIMATION_PROPS: Record<'visible' | 'hidden', object> = {
  visible: {
    opacity: 1,
    top: '0px',
  },
  hidden: {
    opacity: 0.5,
    top: '30px',
  },
};

export function TypingBubble({
  conversationId,
  conversationType,
  typingContactIdTimestamps,
  lastItemAuthorId,
  lastItemTimestamp,
  getConversation,
  getPreferredBadge,
  showContactModal,
  i18n,
  theme,
}: TypingBubblePropsType): ReactElement | null {
  const [isVisible, setIsVisible] = useState(false);

  const typingContactIds = useMemo(
    () => Object.keys(typingContactIdTimestamps),
    [typingContactIdTimestamps]
  );
  const [shouldAnimate, setShouldAnimate] = useState(false);
  const prevTypingContactIds = React.useRef<
    ReadonlyArray<string> | undefined
  >();
  const isSomeoneTyping = useMemo(
    () => typingContactIds.length > 0,
    [typingContactIds]
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps -- FIXME
  const [outerDivStyle, outerDivSpringApi] = useSpring(
    {
      to: OUTER_DIV_ANIMATION_PROPS[isSomeoneTyping ? 'visible' : 'hidden'],
      config: SPRING_CONFIG,
    },
    [isSomeoneTyping]
  );
  // eslint-disable-next-line react-hooks/exhaustive-deps -- FIXME
  const [typingAnimationStyle, typingAnimationSpringApi] = useSpring(
    {
      to: BUBBLE_ANIMATION_PROPS[isSomeoneTyping ? 'visible' : 'hidden'],
      config: SPRING_CONFIG,
      onRest: () => {
        if (!isSomeoneTyping) {
          setIsVisible(false);
        }
      },
    },
    [isSomeoneTyping]
  );

  useEffect(() => {
    // When typing stops, stay visible to allow time to animate out the bubble.
    if (isSomeoneTyping) {
      setIsVisible(true);
    }
    typingAnimationSpringApi.stop();
    drop(
      Promise.all(
        typingAnimationSpringApi.start(
          BUBBLE_ANIMATION_PROPS[isSomeoneTyping ? 'visible' : 'hidden']
        )
      )
    );
    outerDivSpringApi.stop();
    drop(
      Promise.all(
        outerDivSpringApi.start(
          OUTER_DIV_ANIMATION_PROPS[isSomeoneTyping ? 'visible' : 'hidden']
        )
      )
    );
  }, [isSomeoneTyping, typingAnimationSpringApi, outerDivSpringApi]);

  // When only one person is typing and they just sent a new message, then instantly
  // hide the bubble without animation to seamlessly transition to their new message.
  useEffect(() => {
    if (
      typingContactIds.length !== 1 ||
      !lastItemAuthorId ||
      !lastItemTimestamp
    ) {
      return;
    }

    const lastTypingContactId = typingContactIds[0];
    const lastTypingTimestamp = typingContactIdTimestamps[lastTypingContactId];
    if (
      lastItemAuthorId === lastTypingContactId &&
      lastItemTimestamp > lastTypingTimestamp
    ) {
      setIsVisible(false);
    }
  }, [
    lastItemAuthorId,
    lastItemTimestamp,
    typingContactIds,
    typingContactIdTimestamps,
  ]);

  // Only animate when the user observes a change in typing contacts, not when first
  // switching to a conversation.
  useEffect(() => {
    if (shouldAnimate) {
      return;
    }

    if (!prevTypingContactIds.current) {
      prevTypingContactIds.current = typingContactIds;
      return;
    }

    if (prevTypingContactIds.current !== typingContactIds) {
      setShouldAnimate(true);
    }
  }, [shouldAnimate, typingContactIds]);

  if (!isVisible) {
    return null;
  }

  const isGroup = conversationType === 'group';

  return (
    <animated.div
      className="module-timeline__typing-bubble-container"
      style={outerDivStyle}
    >
      <animated.div
        className={classNames(
          'module-message',
          'module-message--incoming',
          'module-message--typing-bubble',
          isGroup ? 'module-message--group' : null
        )}
        style={outerDivStyle}
      >
        {isGroup && (
          <TypingBubbleGroupAvatars
            conversationId={conversationId}
            typingContactIds={typingContactIds}
            shouldAnimate={shouldAnimate}
            getConversation={getConversation}
            getPreferredBadge={getPreferredBadge}
            showContactModal={showContactModal}
            i18n={i18n}
            theme={theme}
          />
        )}
        <div className="module-message__container-outer module-message__container-outer--typing-bubble">
          <animated.div
            className={classNames(
              'module-message__container',
              'module-message__container--incoming'
            )}
            style={typingAnimationStyle}
          >
            <div className="module-message__typing-animation-container">
              <TypingAnimation color="light" i18n={i18n} />
            </div>
          </animated.div>
        </div>
      </animated.div>
    </animated.div>
  );
}

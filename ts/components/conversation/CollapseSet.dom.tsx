// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import classNames from 'classnames';

import type { RefObject } from 'react';

import { MessageInteractivity } from './Message.dom.js';
import { format } from '../../util/expirationTimer.std.js';
import { strictAssert } from '../../util/assert.std.js';
import { missingCaseError } from '../../util/missingCaseError.std.js';
import { AxoSymbol } from '../../axo/AxoSymbol.dom.js';
import { tw } from '../../axo/tw.dom.js';
import { AxoButton } from '../../axo/AxoButton.dom.js';

import type { WidthBreakpoint } from '../_util.std.js';
import type {
  CollapsedMessage,
  CollapseSet,
} from '../../state/smart/Timeline.preload.js';
import type { RenderItemProps } from '../../state/smart/TimelineItem.preload.js';
import type { LocalizerType } from '../../types/I18N.std.js';
import type { TargetedMessageType } from '../../state/selectors/conversations.dom.js';

export type Props = CollapseSet & {
  containerElementRef: RefObject<HTMLElement | null>;
  containerWidthBreakpoint: WidthBreakpoint;
  conversationId: string;
  i18n: LocalizerType;
  isBlocked: boolean;
  isGroup: boolean;
  renderItem: (props: RenderItemProps) => React.JSX.Element;
  targetedMessage: TargetedMessageType | undefined;
};

export function CollapseSetViewer(props: Props): React.JSX.Element {
  strictAssert(
    props.type !== 'none',
    "CollapseSetViewer should never render a 'none' set"
  );

  const {
    containerElementRef,
    containerWidthBreakpoint,
    conversationId,
    isBlocked,
    isGroup,
    messages,
    renderItem,
    targetedMessage,
  } = props;
  const [isExpanded, setIsExpanded] = useState(false);
  const [messageCache, setMessageCache] = useState<
    Record<string, CollapsedMessage>
  >({});
  const previousTargetedMessage = useRef<TargetedMessageType>(undefined);

  useEffect(() => {
    if (!targetedMessage) {
      previousTargetedMessage.current = undefined;
      return;
    }

    const match = messages.find(message => message.id === targetedMessage.id);

    if (
      match &&
      (targetedMessage.id !== previousTargetedMessage.current?.id ||
        targetedMessage.counter !== previousTargetedMessage.current?.counter)
    ) {
      setIsExpanded(true);
    }

    previousTargetedMessage.current = targetedMessage;
  }, [messages, setIsExpanded, targetedMessage]);

  // We want to capture the initial unseen value of every message we see
  useLayoutEffect(() => {
    const newCache = { ...messageCache };
    let hasChanged = false;

    messages?.forEach(message => {
      if (newCache[message.id] != null) {
        return;
      }

      hasChanged = true;
      newCache[message.id] = message;
    });

    if (hasChanged) {
      setMessageCache(newCache);
    }
  }, [messages, messageCache, setMessageCache]);

  // Inner messages will never count as an oldest timeline item
  const isOldestTimelineItem = false;

  let oldestOriginallyUnseenIndex;
  const max = messages?.length;
  for (let i = 0; i < max; i += 1) {
    const message = messages[i];
    strictAssert(
      message,
      'CollapseSet finding oldestOriginallyUnseenIndex in messages'
    );
    if (messageCache[message.id]?.isUnseen) {
      oldestOriginallyUnseenIndex = i;
      break;
    }
  }

  // We only want to show the button if we have at least two items
  const shouldShowButton =
    oldestOriginallyUnseenIndex === undefined ||
    oldestOriginallyUnseenIndex > 1;
  const shouldShowPassThrough =
    !shouldShowButton ||
    (oldestOriginallyUnseenIndex && oldestOriginallyUnseenIndex < max);

  const collapsedMessages = messages.slice(
    0,
    !shouldShowButton ? 0 : oldestOriginallyUnseenIndex
  );
  let collapsedCount = collapsedMessages.length;
  collapsedMessages.forEach(message => {
    collapsedCount += message.extraItems ?? 0;
  });

  const passThroughMessages = messages.slice(
    !shouldShowButton ? 0 : oldestOriginallyUnseenIndex
  );

  const transparencyRef = React.useRef<HTMLDivElement>(null);

  return (
    <div>
      {shouldShowButton ? (
        <div className={tw('my-2.5 text-center')}>
          <CollapseSetButton
            {...props}
            count={collapsedCount}
            isExpanded={isExpanded}
            onClick={() => {
              setIsExpanded(value => !value);
            }}
          />
        </div>
      ) : undefined}
      <div
        className={classNames(
          'CollapseSet__height-container',
          isExpanded ? 'CollapseSet__height-container--expanded' : undefined
        )}
        style={{
          maxHeight: isExpanded
            ? `${transparencyRef.current?.clientHeight ?? 5000}px`
            : undefined,
        }}
      >
        <div
          ref={transparencyRef}
          onTransitionEnd={() => {
            const expandedClass =
              'CollapseSet__transparency-container--expanded';
            const ref = transparencyRef.current;
            if (!ref) {
              return;
            }

            if (ref.classList.contains(expandedClass)) {
              ref.classList.remove(expandedClass);
            } else {
              ref.classList.add(expandedClass);
            }
          }}
          className={classNames('CollapseSet__transparency-container')}
          style={{
            opacity: isExpanded ? '1' : undefined,
          }}
        >
          {shouldShowButton ? (
            <>
              {collapsedMessages.map((child, index) => {
                const previousMessage = messages[index - 1];
                const nextMessage = messages[index + 1];
                const indexItem = {
                  type: 'none' as const,
                  id: child.id,
                  messages: undefined,
                };

                return (
                  <div
                    data-message-id={child.id}
                    role="listitem"
                    key={child.id}
                  >
                    {renderItem({
                      containerElementRef,
                      containerWidthBreakpoint,
                      conversationId,
                      interactivity: isExpanded
                        ? MessageInteractivity.Normal
                        : MessageInteractivity.Hidden,
                      isBlocked,
                      isGroup,
                      isOldestTimelineItem,
                      item: indexItem,
                      nextMessageId: nextMessage?.id,
                      previousMessageId: previousMessage?.id,
                      unreadIndicatorPlacement: undefined,
                    })}
                  </div>
                );
              })}
            </>
          ) : undefined}
        </div>
      </div>
      {shouldShowPassThrough
        ? passThroughMessages.map((child, index) => {
            const previousMessage = passThroughMessages[index - 1];
            const nextMessage = passThroughMessages[index + 1];
            const indexItem = {
              type: 'none' as const,
              id: child.id,
              messages: undefined,
            };

            return (
              <div data-message-id={child.id} role="listitem" key={child.id}>
                {renderItem({
                  containerElementRef,
                  containerWidthBreakpoint,
                  conversationId,
                  interactivity: MessageInteractivity.Normal,
                  isBlocked,
                  isGroup,
                  isOldestTimelineItem,
                  item: indexItem,
                  nextMessageId: nextMessage?.id,
                  previousMessageId: previousMessage?.id,
                  unreadIndicatorPlacement: undefined,
                })}
              </div>
            );
          })
        : undefined}
    </div>
  );
}

function CollapseSetButton(
  props: CollapseSet & {
    count: number;
    isExpanded: boolean;
    isGroup: boolean;
    i18n: LocalizerType;
    onClick: () => unknown;
  }
): React.JSX.Element {
  const { count, i18n, isExpanded, onClick, type } = props;

  let leadingIcon;
  let text;

  strictAssert(
    type !== 'none',
    "CollapseSetViewer should never render a 'none' set"
  );

  // Note: no need for labels for these icons, since they have full text descriptions
  if (type === 'group-updates') {
    if (props.isGroup) {
      leadingIcon = <AxoSymbol.InlineGlyph symbol="group" label={null} />;
      text = i18n('icu:collapsedGroupUpdates', { count });
    } else {
      leadingIcon = (
        <AxoSymbol.InlineGlyph symbol="message-thread" label={null} />
      );
      text = i18n('icu:collapsedChatUpdates', { count });
    }
  } else if (type === 'timer-changes') {
    leadingIcon = <AxoSymbol.InlineGlyph symbol="timer" label={null} />;
    if (props.endingState) {
      text = i18n('icu:collapsedTimerChanges', {
        count,
        endingState: format(i18n, props.endingState),
      });
    } else {
      text = i18n('icu:collapsedTimerChanges--disabled', {
        count,
      });
    }
  } else if (type === 'call-events') {
    leadingIcon = <AxoSymbol.InlineGlyph symbol="phone" label={null} />;
    text = i18n('icu:collapsedCallEvents', { count });
  } else {
    throw missingCaseError(type);
  }

  const trailingIcon = isExpanded ? (
    <AxoSymbol.InlineGlyph
      symbol="chevron-up"
      label={i18n('icu:collapsedItems--expanded')}
    />
  ) : (
    <AxoSymbol.InlineGlyph
      symbol="chevron-down"
      label={i18n('icu:collapsedItems--collapsed')}
    />
  );

  return (
    <AxoButton.Root size="lg" variant="secondary" onClick={onClick}>
      <div className={tw('font-semibold text-label-secondary')}>
        {leadingIcon} {text} {trailingIcon}
      </div>
    </AxoButton.Root>
  );
}

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
import { MessageContextMenu } from './MessageContextMenu.dom.js';

import type { WidthBreakpoint } from '../_util.std.js';
import type {
  CollapsedMessage,
  CollapseSet,
} from '../../util/CollapseSet.std.js';
import type { RenderItemProps } from '../../state/smart/TimelineItem.preload.js';
import type { LocalizerType } from '../../types/I18N.std.js';
import type { TargetedMessageType } from '../../state/selectors/conversations.dom.js';
import type { DeleteMessagesPropsType } from '../../state/ducks/globalModals.preload.js';
import { I18n } from '../I18n.dom.js';

export type Props = CollapseSet & {
  containerElementRef: RefObject<HTMLElement | null>;
  containerWidthBreakpoint: WidthBreakpoint;
  conversationId: string;
  i18n: LocalizerType;
  isBlocked: boolean;
  isGroup: boolean;
  isSelectMode: boolean;
  renderItem: (props: RenderItemProps) => React.JSX.Element;
  targetedMessage: TargetedMessageType | undefined;
  toggleDeleteMessagesModal: (props: DeleteMessagesPropsType) => void;
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
    toggleDeleteMessagesModal,
  } = props;
  const [isExpanded, setIsExpanded] = useState(false);
  const [messageCache, setMessageCache] = useState<
    Record<string, CollapsedMessage>
  >({});
  const previousTargetedMessage = useRef<TargetedMessageType>(undefined);
  const [isAnimating, setIsAnimating] = useState<boolean>(false);

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
  let collapsedCount = 0;
  let collapsedDayCount = 1;

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

    collapsedCount += 1 + (message.extraItems ?? 0);
    collapsedDayCount += message.atDateBoundary ? 1 : 0;
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
  const passThroughMessages = messages.slice(
    !shouldShowButton ? 0 : oldestOriginallyUnseenIndex
  );

  return (
    <div>
      {shouldShowButton ? (
        <div className={tw('my-2.5 text-center')}>
          <CollapseSetButton
            {...props}
            count={collapsedCount}
            dayCount={collapsedDayCount}
            isExpanded={isExpanded}
            onClick={() => {
              setIsAnimating(true);
              setIsExpanded(value => !value);
            }}
            onDelete={() => {
              toggleDeleteMessagesModal({
                conversationId,
                messageIds: collapsedMessages.map(item => item.id),
              });
            }}
          />
        </div>
      ) : undefined}
      <div
        className={classNames(
          'CollapseSet__height-container',
          isExpanded ? 'CollapseSet__height-container--expanded' : undefined
        )}
        onTransitionEnd={event => {
          if (event.propertyName === 'height') {
            setIsAnimating(false);
          }
        }}
      >
        <div
          className={classNames(
            'CollapseSet__transparency-container',
            isExpanded
              ? 'CollapseSet__transparency-container--expanded'
              : undefined
          )}
        >
          {shouldShowButton && (isExpanded || isAnimating) ? (
            <>
              {collapsedMessages.map((child, index) => {
                const previousMessage = messages[index - 1];
                const nextMessage = messages[index + 1];
                const indexItem = {
                  type: 'none' as const,
                  id: child.id,
                  dayCount: undefined,
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
              dayCount: undefined,
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
    dayCount: number;
    isExpanded: boolean;
    isGroup: boolean;
    isSelectMode: boolean;
    i18n: LocalizerType;
    onClick: () => unknown;
    onDelete: () => unknown;
  }
): React.JSX.Element {
  const { count, dayCount, i18n, isExpanded, onClick, onDelete, type } = props;

  strictAssert(
    type !== 'none',
    "CollapseSetButton should never render a 'none' set"
  );

  let leadingIcon;
  let text;

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

  if (dayCount > 1) {
    text = i18n('icu:multidayCollapse__container', {
      containerDescription: text,
      dayCountSummary: i18n('icu:multidayCollapse__dayCountSummary', {
        dayCount,
      }),
    });
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
    <MessageContextMenu
      renderer="AxoContextMenu"
      disabled={props.isSelectMode}
      i18n={i18n}
      onDeleteMessage={onDelete}
      shouldShowAdditional={false}
      onDebugMessage={null}
      onDownload={null}
      onEdit={null}
      onReplyToMessage={null}
      onReact={null}
      onEndPoll={null}
      onRetryMessageSend={null}
      onRetryDeleteForEveryone={null}
      onCopy={null}
      onSelect={null}
      onForward={null}
      onMoreInfo={null}
      onPinMessage={null}
      onUnpinMessage={null}
    >
      <AxoButton.Root size="md" variant="secondary" onClick={onClick}>
        <div className={tw('font-semibold text-label-secondary')}>
          <I18n
            id="icu:collapsedContainer"
            i18n={i18n}
            components={{
              leadingIcon,
              text,
              trailingIcon,
            }}
          />
        </div>
      </AxoButton.Root>
    </MessageContextMenu>
  );
}

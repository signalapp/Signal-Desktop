// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React, {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import classNames from 'classnames';

import type { RefObject } from 'react';

import { MessageInteractivity } from './Message.dom.tsx';
import { format } from '../../util/expirationTimer.std.ts';
import { strictAssert } from '../../util/assert.std.ts';
import { missingCaseError } from '../../util/missingCaseError.std.ts';
import type { AxoSymbol } from '../../axo/AxoSymbol.dom.tsx';
import { tw } from '../../axo/tw.dom.tsx';
import { AxoButton } from '../../axo/AxoButton.dom.tsx';
import { MessageContextMenu } from './MessageContextMenu.dom.tsx';

import type { WidthBreakpoint } from '../_util.std.ts';
import type {
  CollapsedMessage,
  CollapseSet,
} from '../../util/CollapseSet.std.ts';
import type { RenderItemProps } from '../../state/smart/TimelineItem.preload.tsx';
import type { LocalizerType } from '../../types/I18N.std.ts';
import type { TargetedMessageType } from '../../state/selectors/conversations.dom.ts';
import type { DeleteMessagesPropsType } from '../../state/ducks/globalModals.preload.ts';

export type Props = CollapseSet & {
  containerElementRef: RefObject<HTMLElement | null>;
  containerWidthBreakpoint: WidthBreakpoint;
  conversationId: string;
  i18n: LocalizerType;
  isBlocked: boolean;
  isGroup: boolean;
  isSelectMode: boolean;
  isSelected: boolean;
  renderItem: (props: RenderItemProps) => React.JSX.Element;
  targetedMessage: TargetedMessageType | undefined;
  toggleDeleteMessagesModal: (props: DeleteMessagesPropsType) => void;
  toggleSelectMessage: (
    conversationId: string,
    messageId: string,
    shift: boolean,
    selected: boolean
  ) => void;
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
    isSelected,
    messages,
    renderItem,
    targetedMessage,
    toggleDeleteMessagesModal,
    toggleSelectMessage,
  } = props;
  const [isExpanded, setIsExpanded] = useState(false);
  const [messageCache, setMessageCache] = useState<
    Record<string, CollapsedMessage>
  >({});
  const previousTargetedMessage = useRef<TargetedMessageType>(undefined);
  const [isAnimating, setIsAnimating] = useState<boolean>(false);
  const disclosureContentId = useId();

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

  const ariaSetSize = messages.length;
  const messagesWithAria = messages.map((message, index) => {
    return { ...message, ariaSetSize, ariaPosInSet: index + 1 };
  });

  const collapsedMessages = messagesWithAria.slice(
    0,
    !shouldShowButton ? 0 : oldestOriginallyUnseenIndex
  );
  const passThroughMessages = messagesWithAria.slice(
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
            disclosureContentId={disclosureContentId}
            onClick={() => {
              if (isSelected) {
                return;
              }

              setIsAnimating(true);
              setIsExpanded(value => !value);
            }}
            onDelete={() => {
              toggleDeleteMessagesModal({
                conversationId,
                messageIds: collapsedMessages.map(item => item.id),
              });
            }}
            onSelect={() => {
              collapsedMessages.forEach(message => {
                toggleSelectMessage(conversationId, message.id, false, true);
              });
            }}
          />
        </div>
      ) : undefined}
      <div role="list" id={disclosureContentId}>
        <div
          className={classNames(
            'CollapseSet__height-container',
            isSelected || isExpanded
              ? 'CollapseSet__height-container--expanded'
              : undefined
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
              isSelected || isExpanded
                ? 'CollapseSet__transparency-container--expanded'
                : undefined
            )}
          >
            {shouldShowButton && (isSelected || isExpanded || isAnimating) ? (
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
                      aria-setsize={child.ariaSetSize}
                      aria-posinset={child.ariaPosInSet}
                    >
                      {renderItem({
                        containerElementRef,
                        containerWidthBreakpoint,
                        conversationId,
                        interactivity:
                          isSelected || isExpanded
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
                <div
                  data-message-id={child.id}
                  role="listitem"
                  key={child.id}
                  aria-setsize={child.ariaSetSize}
                  aria-posinset={child.ariaPosInSet}
                >
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
    </div>
  );
}

function CollapseSetButton(
  props: CollapseSet & {
    count: number;
    dayCount: number;
    disclosureContentId: string;
    isExpanded: boolean;
    isGroup: boolean;
    isSelectMode: boolean;
    isSelected: boolean;
    i18n: LocalizerType;
    onClick: () => unknown;
    onDelete: () => unknown;
    onSelect: () => unknown;
  }
): React.JSX.Element {
  const {
    count,
    dayCount,
    disclosureContentId,
    i18n,
    isExpanded,
    isSelected,
    onClick,
    onDelete,
    type,
  } = props;

  strictAssert(
    type !== 'none',
    "CollapseSetButton should never render a 'none' set"
  );

  let symbol: AxoSymbol.InlineGlyphName;
  let text: string;

  // Note: no need for labels for these icons, since they have full text descriptions
  if (type === 'group-updates') {
    if (props.isGroup) {
      symbol = 'group';
      text = i18n('icu:collapsedGroupUpdates', { count });
    } else {
      symbol = 'message-thread';
      text = i18n('icu:collapsedChatUpdates', { count });
    }
  } else if (type === 'timer-changes') {
    symbol = 'timer';
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
    symbol = 'phone';
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

  let arrow: AxoButton.Arrow | null;
  let ariaExpanded: boolean | null;
  if (isSelected) {
    arrow = null;
    ariaExpanded = null;
  } else if (isExpanded) {
    arrow = 'collapse';
    ariaExpanded = true;
  } else {
    arrow = 'expand';
    ariaExpanded = false;
  }

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
      onSelect={props.onSelect}
      onForward={null}
      onMoreInfo={null}
      onPinMessage={null}
      onUnpinMessage={null}
    >
      <AxoButton.Root
        size="md"
        variant="secondary"
        arrow={arrow}
        symbol={symbol}
        aria-expanded={ariaExpanded}
        aria-controls={disclosureContentId}
        onClick={onClick}
      >
        {text}
      </AxoButton.Root>
    </MessageContextMenu>
  );
}

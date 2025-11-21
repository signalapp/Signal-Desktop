// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ForwardedRef, ReactNode } from 'react';
import React, {
  forwardRef,
  Fragment,
  memo,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useLayoutEffect } from '@react-aria/utils';
import type { LocalizerType } from '../../../types/I18N.std.js';
import type { ConversationType } from '../../../state/ducks/conversations.preload.js';
import type { PinnedMessage } from '../../../types/PinnedMessage.std.js';
import type { SmartTimelineItemProps } from '../../../state/smart/TimelineItem.preload.js';
import { WidthBreakpoint } from '../../_util.std.js';
import { AxoScrollArea } from '../../../axo/AxoScrollArea.dom.js';
import {
  createScrollerLock,
  ScrollerLockContext,
} from '../../../hooks/useScrollLock.dom.js';
import { getWidthBreakpoint } from '../../../util/timelineUtil.std.js';
import { strictAssert } from '../../../util/assert.std.js';
import { useSizeObserver } from '../../../hooks/useSizeObserver.dom.js';
import { MessageInteractivity } from '../Message.dom.js';
import { tw } from '../../../axo/tw.dom.js';
import { AxoButton } from '../../../axo/AxoButton.dom.js';

export type PinnedMessagesPanelProps = Readonly<{
  i18n: LocalizerType;
  conversation: ConversationType;
  pinnedMessages: ReadonlyArray<PinnedMessage>;
  renderTimelineItem: (props: SmartTimelineItemProps) => JSX.Element;
}>;

export const PinnedMessagesPanel = memo(function PinnedMessagesPanel(
  props: PinnedMessagesPanelProps
) {
  const { i18n } = props;
  const containerElementRef = useRef<HTMLDivElement>(null);
  const [containerWidthBreakpoint, setContainerWidthBreakpoint] = useState(
    WidthBreakpoint.Wide
  );

  useLayoutEffect(() => {
    strictAssert(containerElementRef.current, 'Missing container ref');
    const container = containerElementRef.current;
    setContainerWidthBreakpoint(getWidthBreakpoint(container.offsetWidth));
  }, []);

  useSizeObserver(containerElementRef, size => {
    setContainerWidthBreakpoint(getWidthBreakpoint(size.width));
  });

  return (
    <div className={tw('flex h-full flex-col')}>
      <ScrollArea ref={containerElementRef}>
        {props.pinnedMessages.map((pinnedMessage, pinnedMessageIndex) => {
          const next = props.pinnedMessages[pinnedMessageIndex + 1];
          const prev = props.pinnedMessages[pinnedMessageIndex - 1];
          return (
            <Fragment key={pinnedMessage.id}>
              {props.renderTimelineItem({
                containerElementRef,
                containerWidthBreakpoint,
                conversationId: props.conversation.id,
                interactivity: MessageInteractivity.Embed,
                isBlocked: props.conversation.isBlocked ?? false,
                isGroup: props.conversation.type === 'group',
                isOldestTimelineItem: pinnedMessageIndex === 0,
                messageId: pinnedMessage.messageId,
                nextMessageId: next?.messageId,
                previousMessageId: prev?.messageId,
                unreadIndicatorPlacement: undefined,
              })}
            </Fragment>
          );
        })}
      </ScrollArea>
      <div className={tw('flex items-center justify-center p-2.5')}>
        <AxoButton.Root variant="borderless-primary" size="lg">
          {i18n('icu:PinnedMessagesPanel__UnpinAllMessages')}
        </AxoButton.Root>
      </div>
    </div>
  );
});

const ScrollArea = forwardRef(function ScrollArea(
  props: { children: ReactNode },
  ref: ForwardedRef<HTMLDivElement>
) {
  const scrollerLock = useMemo(() => {
    return createScrollerLock('PinnedMessagesPanel', () => {
      // noop - we probably don't need to do anything here because the only
      // thing that can happen is the pinned messages getting removed/added
    });
  }, []);

  return (
    <AxoScrollArea.Root scrollbarWidth="wide">
      <AxoScrollArea.Hint edge="top" />
      <AxoScrollArea.Hint edge="bottom" />
      <AxoScrollArea.Viewport>
        <AxoScrollArea.Content>
          <div ref={ref}>
            <ScrollerLockContext.Provider value={scrollerLock}>
              {props.children}
            </ScrollerLockContext.Provider>
          </div>
        </AxoScrollArea.Content>
      </AxoScrollArea.Viewport>
    </AxoScrollArea.Root>
  );
});

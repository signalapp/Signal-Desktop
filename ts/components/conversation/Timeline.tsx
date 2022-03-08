// Copyright 2019-2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { first, get, isNumber, last, pick, throttle } from 'lodash';
import classNames from 'classnames';
import type { ReactChild, ReactNode, RefObject } from 'react';
import React from 'react';
import { createSelector } from 'reselect';
import Measure from 'react-measure';

import { ScrollDownButton } from './ScrollDownButton';

import type { AssertProps, LocalizerType, ThemeType } from '../../types/Util';
import type { ConversationType } from '../../state/ducks/conversations';
import type { PreferredBadgeSelectorType } from '../../state/selectors/badges';
import { assert, strictAssert } from '../../util/assert';
import { missingCaseError } from '../../util/missingCaseError';
import { clearTimeoutIfNecessary } from '../../util/clearTimeoutIfNecessary';
import { WidthBreakpoint } from '../_util';

import type { PropsActions as MessageActionsType } from './Message';
import type { PropsActions as UnsupportedMessageActionsType } from './UnsupportedMessage';
import type { PropsActionsType as ChatSessionRefreshedNotificationActionsType } from './ChatSessionRefreshedNotification';
import { ErrorBoundary } from './ErrorBoundary';
import type { PropsActions as SafetyNumberActionsType } from './SafetyNumberNotification';
import { Intl } from '../Intl';
import { TimelineWarning } from './TimelineWarning';
import { TimelineWarnings } from './TimelineWarnings';
import { NewlyCreatedGroupInvitedContactsDialog } from '../NewlyCreatedGroupInvitedContactsDialog';
import { ContactSpoofingType } from '../../util/contactSpoofing';
import { ContactSpoofingReviewDialog } from './ContactSpoofingReviewDialog';
import type { GroupNameCollisionsWithIdsByTitle } from '../../util/groupMemberNameCollisions';
import { hasUnacknowledgedCollisions } from '../../util/groupMemberNameCollisions';
import { TimelineFloatingHeader } from './TimelineFloatingHeader';
import {
  getWidthBreakpoint,
  UnreadIndicatorPlacement,
} from '../../util/timelineUtil';
import {
  getScrollBottom,
  scrollToBottom,
  setScrollBottom,
} from '../../util/scrollUtil';
import { LastSeenIndicator } from './LastSeenIndicator';

const AT_BOTTOM_THRESHOLD = 15;
const MIN_ROW_HEIGHT = 18;
const SCROLL_DOWN_BUTTON_THRESHOLD = 8;

export type WarningType =
  | {
      type: ContactSpoofingType.DirectConversationWithSameTitle;
      safeConversation: ConversationType;
    }
  | {
      type: ContactSpoofingType.MultipleGroupMembersWithSameTitle;
      acknowledgedGroupNameCollisions: GroupNameCollisionsWithIdsByTitle;
      groupNameCollisions: GroupNameCollisionsWithIdsByTitle;
    };

export type ContactSpoofingReviewPropType =
  | {
      type: ContactSpoofingType.DirectConversationWithSameTitle;
      possiblyUnsafeConversation: ConversationType;
      safeConversation: ConversationType;
    }
  | {
      type: ContactSpoofingType.MultipleGroupMembersWithSameTitle;
      collisionInfoByTitle: Record<
        string,
        Array<{
          oldName?: string;
          conversation: ConversationType;
        }>
      >;
    };

export type PropsDataType = {
  haveNewest: boolean;
  haveOldest: boolean;
  isLoadingMessages: boolean;
  isNearBottom?: boolean;
  items: ReadonlyArray<string>;
  oldestUnreadIndex?: number;
  scrollToIndex?: number;
  scrollToIndexCounter: number;
  totalUnread: number;
};

type PropsHousekeepingType = {
  id: string;
  areWeAdmin?: boolean;
  isConversationSelected: boolean;
  isGroupV1AndDisabled?: boolean;
  isIncomingMessageRequest: boolean;
  typingContactId?: string;
  unreadCount?: number;

  selectedMessageId?: string;
  invitedContactsForNewlyCreatedGroup: Array<ConversationType>;

  warning?: WarningType;
  contactSpoofingReview?: ContactSpoofingReviewPropType;

  discardMessages: (
    _: Readonly<{ conversationId: string; numberToKeepAtBottom: number }>
  ) => void;
  getTimestampForMessage: (messageId: string) => undefined | number;
  getPreferredBadge: PreferredBadgeSelectorType;
  i18n: LocalizerType;
  theme: ThemeType;

  renderItem: (props: {
    actionProps: PropsActionsType;
    containerElementRef: RefObject<HTMLElement>;
    containerWidthBreakpoint: WidthBreakpoint;
    conversationId: string;
    isOldestTimelineItem: boolean;
    messageId: string;
    nextMessageId: undefined | string;
    previousMessageId: undefined | string;
    unreadIndicatorPlacement: undefined | UnreadIndicatorPlacement;
  }) => JSX.Element;
  renderHeroRow: (
    id: string,
    unblurAvatar: () => void,
    updateSharedGroups: () => unknown
  ) => JSX.Element;
  renderTypingBubble: (id: string) => JSX.Element;
};

export type PropsActionsType = {
  acknowledgeGroupMemberNameCollisions: (
    groupNameCollisions: Readonly<GroupNameCollisionsWithIdsByTitle>
  ) => void;
  clearInvitedUuidsForNewlyCreatedGroup: () => void;
  closeContactSpoofingReview: () => void;
  setIsNearBottom: (conversationId: string, isNearBottom: boolean) => unknown;
  reviewGroupMemberNameCollision: (groupConversationId: string) => void;
  reviewMessageRequestNameCollision: (
    _: Readonly<{
      safeConversationId: string;
    }>
  ) => void;

  learnMoreAboutDeliveryIssue: () => unknown;
  loadAndScroll: (messageId: string) => unknown;
  loadOlderMessages: (messageId: string) => unknown;
  loadNewerMessages: (messageId: string) => unknown;
  loadNewestMessages: (messageId: string, setFocus?: boolean) => unknown;
  markMessageRead: (messageId: string) => unknown;
  onBlock: (conversationId: string) => unknown;
  onBlockAndReportSpam: (conversationId: string) => unknown;
  onDelete: (conversationId: string) => unknown;
  onUnblock: (conversationId: string) => unknown;
  peekGroupCallForTheFirstTime: (conversationId: string) => unknown;
  removeMember: (conversationId: string) => unknown;
  selectMessage: (messageId: string, conversationId: string) => unknown;
  clearSelectedMessage: () => unknown;
  unblurAvatar: () => void;
  updateSharedGroups: () => unknown;
} & MessageActionsType &
  SafetyNumberActionsType &
  UnsupportedMessageActionsType &
  ChatSessionRefreshedNotificationActionsType;

export type PropsType = PropsDataType &
  PropsHousekeepingType &
  PropsActionsType;

type StateType = {
  hasDismissedDirectContactSpoofingWarning: boolean;
  hasRecentlyScrolled: boolean;
  lastMeasuredWarningHeight: number;
  newestFullyVisibleMessageId?: string;
  oldestPartiallyVisibleMessageId?: string;
  widthBreakpoint: WidthBreakpoint;
};

const scrollToUnreadIndicator = Symbol('scrollToUnreadIndicator');

type SnapshotType =
  | null
  | typeof scrollToUnreadIndicator
  | { scrollToIndex: number }
  | { scrollTop: number }
  | { scrollBottom: number };

const getActions = createSelector(
  // It is expensive to pick so many properties out of the `props` object so we
  // use `createSelector` to memoize them by the last seen `props` object.
  (props: PropsType) => props,

  (props: PropsType): PropsActionsType => {
    const unsafe = pick(props, [
      'acknowledgeGroupMemberNameCollisions',
      'clearInvitedUuidsForNewlyCreatedGroup',
      'closeContactSpoofingReview',
      'setIsNearBottom',
      'reviewGroupMemberNameCollision',
      'reviewMessageRequestNameCollision',
      'learnMoreAboutDeliveryIssue',
      'loadAndScroll',
      'loadOlderMessages',
      'loadNewerMessages',
      'loadNewestMessages',
      'markMessageRead',
      'markViewed',
      'onBlock',
      'onBlockAndReportSpam',
      'onDelete',
      'onUnblock',
      'peekGroupCallForTheFirstTime',
      'removeMember',
      'selectMessage',
      'clearSelectedMessage',
      'unblurAvatar',
      'updateSharedGroups',

      'doubleCheckMissingQuoteReference',
      'checkForAccount',
      'reactToMessage',
      'replyToMessage',
      'retryDeleteForEveryone',
      'retrySend',
      'showForwardMessageModal',
      'deleteMessage',
      'deleteMessageForEveryone',
      'showMessageDetail',
      'openConversation',
      'showContactDetail',
      'showContactModal',
      'kickOffAttachmentDownload',
      'markAttachmentAsCorrupted',
      'messageExpanded',
      'showVisualAttachment',
      'downloadAttachment',
      'displayTapToViewMessage',
      'openLink',
      'scrollToQuotedMessage',
      'showExpiredIncomingTapToViewToast',
      'showExpiredOutgoingTapToViewToast',

      'showIdentity',

      'downloadNewVersion',

      'contactSupport',
    ]);

    const safe: AssertProps<PropsActionsType, typeof unsafe> = unsafe;

    return safe;
  }
);

export class Timeline extends React.Component<
  PropsType,
  StateType,
  SnapshotType
> {
  private readonly containerRef = React.createRef<HTMLDivElement>();
  private readonly messagesRef = React.createRef<HTMLDivElement>();
  private readonly lastSeenIndicatorRef = React.createRef<HTMLDivElement>();
  private intersectionObserver?: IntersectionObserver;
  private messagesResizeObserver?: ResizeObserver;

  // This is a best guess. It will likely be overridden when the timeline is measured.
  private maxVisibleRows = Math.ceil(window.innerHeight / MIN_ROW_HEIGHT);

  private hasRecentlyScrolledTimeout?: NodeJS.Timeout;
  private delayedPeekTimeout?: NodeJS.Timeout;

  override state: StateType = {
    hasRecentlyScrolled: true,
    hasDismissedDirectContactSpoofingWarning: false,

    // These may be swiftly overridden.
    lastMeasuredWarningHeight: 0,
    widthBreakpoint: WidthBreakpoint.Wide,
  };

  private onScroll = (): void => {
    const { id, setIsNearBottom } = this.props;

    setIsNearBottom(id, this.isAtBottom());

    this.setState(oldState =>
      // `onScroll` is called frequently, so it's performance-sensitive. We try our best
      //   to return `null` from this updater because [that won't cause a re-render][0].
      //
      // [0]: https://github.com/facebook/react/blob/29b7b775f2ecf878eaf605be959d959030598b07/packages/react-reconciler/src/ReactUpdateQueue.js#L401-L404
      oldState.hasRecentlyScrolled ? null : { hasRecentlyScrolled: true }
    );
    clearTimeoutIfNecessary(this.hasRecentlyScrolledTimeout);
    this.hasRecentlyScrolledTimeout = setTimeout(() => {
      this.setState({ hasRecentlyScrolled: false });
    }, 3000);
  };

  private scrollToItemIndex(itemIndex: number): void {
    this.messagesRef.current
      ?.querySelector(`[data-item-index="${itemIndex}"]`)
      ?.scrollIntoViewIfNeeded();
  }

  private scrollToBottom = (setFocus?: boolean): void => {
    const { selectMessage, id, items } = this.props;

    if (setFocus && items && items.length > 0) {
      const lastIndex = items.length - 1;
      const lastMessageId = items[lastIndex];
      selectMessage(lastMessageId, id);
    } else {
      const containerEl = this.containerRef.current;
      if (containerEl) {
        scrollToBottom(containerEl);
      }
    }
  };

  private onClickScrollDownButton = (): void => {
    this.scrollDown(false);
  };

  private scrollDown = (setFocus?: boolean): void => {
    const {
      haveNewest,
      id,
      isLoadingMessages,
      items,
      loadNewestMessages,
      oldestUnreadIndex,
      selectMessage,
    } = this.props;
    const { newestFullyVisibleMessageId } = this.state;

    if (!items || items.length < 1) {
      return;
    }

    if (isLoadingMessages) {
      this.scrollToBottom(setFocus);
      return;
    }

    if (
      newestFullyVisibleMessageId &&
      isNumber(oldestUnreadIndex) &&
      items.findIndex(item => item === newestFullyVisibleMessageId) <
        oldestUnreadIndex
    ) {
      if (setFocus) {
        const messageId = items[oldestUnreadIndex];
        selectMessage(messageId, id);
      } else {
        this.scrollToItemIndex(oldestUnreadIndex);
      }
    } else if (haveNewest) {
      this.scrollToBottom(setFocus);
    } else {
      const lastId = last(items);
      if (lastId) {
        loadNewestMessages(lastId, setFocus);
      }
    }
  };

  private isAtBottom(): boolean {
    const containerEl = this.containerRef.current;
    return Boolean(
      containerEl && getScrollBottom(containerEl) <= AT_BOTTOM_THRESHOLD
    );
  }

  /**
   * Re-initialize our `IntersectionObserver`. This replaces the old observer because (1)
   * we don't want stale references to old props (2) we care about the order of the
   * `IntersectionObserverEntry`s.
   *
   * This isn't the only way to solve this problem. For example, we could have a single
   * observer for the lifetime of the component and update it intelligently. This approach
   * seems to work, though!
   */
  private updateIntersectionObserver(): void {
    const containerEl = this.containerRef.current;
    const messagesEl = this.messagesRef.current;
    if (!containerEl || !messagesEl) {
      return;
    }

    const {
      haveNewest,
      haveOldest,
      isLoadingMessages,
      items,
      loadNewerMessages,
      loadOlderMessages,
    } = this.props;

    this.intersectionObserver?.disconnect();

    // Keys are message IDs. Values are intersection ratios.
    const visibleMessages = new Map<string, number>();

    const intersectionObserverCallback: IntersectionObserverCallback =
      entries => {
        entries.forEach(entry => {
          const { intersectionRatio, target } = entry;
          const {
            dataset: { messageId },
          } = target as HTMLElement;
          if (!messageId) {
            return;
          }
          visibleMessages.set(messageId, intersectionRatio);
        });

        let oldestPartiallyVisibleMessageId: undefined | string;
        let newestFullyVisibleMessageId: undefined | string;

        for (const [messageId, intersectionRatio] of visibleMessages) {
          if (intersectionRatio > 0 && !oldestPartiallyVisibleMessageId) {
            oldestPartiallyVisibleMessageId = messageId;
          }
          if (intersectionRatio >= 1) {
            newestFullyVisibleMessageId = messageId;
          }
        }

        this.setState({
          oldestPartiallyVisibleMessageId,
          newestFullyVisibleMessageId,
        });

        if (newestFullyVisibleMessageId) {
          this.markNewestFullyVisibleMessageRead();

          if (
            !isLoadingMessages &&
            !haveNewest &&
            newestFullyVisibleMessageId === last(items)
          ) {
            loadNewerMessages(newestFullyVisibleMessageId);
          }
        }

        if (
          !isLoadingMessages &&
          !haveOldest &&
          oldestPartiallyVisibleMessageId &&
          oldestPartiallyVisibleMessageId === items[0]
        ) {
          loadOlderMessages(oldestPartiallyVisibleMessageId);
        }
      };

    this.intersectionObserver = new IntersectionObserver(
      intersectionObserverCallback,
      {
        root: containerEl,
        threshold: [0, 1],
      }
    );

    for (const child of messagesEl.children) {
      if ((child as HTMLElement).dataset.messageId) {
        this.intersectionObserver.observe(child);
      }
    }
  }

  private markNewestFullyVisibleMessageRead = throttle(
    (): void => {
      const { markMessageRead } = this.props;
      const { newestFullyVisibleMessageId } = this.state;
      if (newestFullyVisibleMessageId) {
        markMessageRead(newestFullyVisibleMessageId);
      }
    },
    500,
    { leading: false }
  );

  public override componentDidMount(): void {
    const containerEl = this.containerRef.current;
    const messagesEl = this.messagesRef.current;
    strictAssert(
      containerEl && messagesEl,
      '<Timeline> mounted without some refs'
    );

    // This observer is necessary to keep the scroll position locked to the bottom when
    //   messages change height without "telling" the timeline about it. This can happen
    //   if messages animate their height, if reactions are changed, etc.
    //
    // We do this synchronously (i.e., without react-measure) to avoid jitter.
    this.messagesResizeObserver = new ResizeObserver(() => {
      const { haveNewest } = this.props;
      if (haveNewest && this.isAtBottom()) {
        scrollToBottom(containerEl);
      }
    });
    this.messagesResizeObserver.observe(messagesEl);

    this.updateIntersectionObserver();

    window.registerForActive(this.markNewestFullyVisibleMessageRead);

    this.delayedPeekTimeout = setTimeout(() => {
      const { id, peekGroupCallForTheFirstTime } = this.props;
      peekGroupCallForTheFirstTime(id);
    }, 500);
  }

  public override componentWillUnmount(): void {
    const { delayedPeekTimeout } = this;

    window.unregisterForActive(this.markNewestFullyVisibleMessageRead);

    this.messagesResizeObserver?.disconnect();
    this.intersectionObserver?.disconnect();

    clearTimeoutIfNecessary(delayedPeekTimeout);
  }

  public override getSnapshotBeforeUpdate(
    prevProps: Readonly<PropsType>
  ): SnapshotType {
    const containerEl = this.containerRef.current;
    if (!containerEl) {
      return null;
    }

    const {
      isLoadingMessages: wasLoadingMessages,
      items: oldItems,
      scrollToIndexCounter: oldScrollToIndexCounter,
      typingContactId: oldTypingContactId,
    } = prevProps;
    const {
      isIncomingMessageRequest,
      isLoadingMessages,
      items: newItems,
      oldestUnreadIndex,
      scrollToIndex,
      scrollToIndexCounter: newScrollToIndexCounter,
      typingContactId,
    } = this.props;

    const isDoingInitialLoad = isLoadingMessages && newItems.length === 0;
    const wasDoingInitialLoad = wasLoadingMessages && oldItems.length === 0;
    const justFinishedInitialLoad = wasDoingInitialLoad && !isDoingInitialLoad;

    if (isDoingInitialLoad) {
      return null;
    }

    if (
      isNumber(scrollToIndex) &&
      (oldScrollToIndexCounter !== newScrollToIndexCounter ||
        justFinishedInitialLoad)
    ) {
      return { scrollToIndex };
    }

    if (justFinishedInitialLoad) {
      if (isIncomingMessageRequest) {
        return { scrollTop: 0 };
      }
      if (isNumber(oldestUnreadIndex)) {
        return scrollToUnreadIndicator;
      }
      return { scrollBottom: 0 };
    }

    if (
      Boolean(typingContactId) !== Boolean(oldTypingContactId) &&
      this.isAtBottom()
    ) {
      return { scrollBottom: 0 };
    }

    // This method assumes that item operations happen one at a time. For example, items
    //   are not added and removed in the same render pass.
    if (oldItems.length === newItems.length) {
      return null;
    }

    let scrollAnchor: 'top' | 'bottom';
    if (this.isAtBottom()) {
      const justLoadedAPage = wasLoadingMessages && !isLoadingMessages;
      scrollAnchor = justLoadedAPage ? 'top' : 'bottom';
    } else {
      scrollAnchor = last(oldItems) !== last(newItems) ? 'top' : 'bottom';
    }

    return scrollAnchor === 'top'
      ? { scrollTop: containerEl.scrollTop }
      : { scrollBottom: getScrollBottom(containerEl) };
  }

  public override componentDidUpdate(
    prevProps: Readonly<PropsType>,
    _prevState: Readonly<StateType>,
    snapshot: Readonly<SnapshotType>
  ): void {
    const { items: oldItems } = prevProps;
    const { discardMessages, id, items: newItems } = this.props;

    const containerEl = this.containerRef.current;
    if (containerEl && snapshot) {
      if (snapshot === scrollToUnreadIndicator) {
        const lastSeenIndicatorEl = this.lastSeenIndicatorRef.current;
        if (lastSeenIndicatorEl) {
          lastSeenIndicatorEl.scrollIntoView();
        } else {
          scrollToBottom(containerEl);
          assert(
            false,
            '<Timeline> expected a last seen indicator but it was not found'
          );
        }
      } else if ('scrollToIndex' in snapshot) {
        this.scrollToItemIndex(snapshot.scrollToIndex);
      } else if ('scrollTop' in snapshot) {
        containerEl.scrollTop = snapshot.scrollTop;
      } else {
        setScrollBottom(containerEl, snapshot.scrollBottom);
      }
    }

    if (oldItems.length !== newItems.length) {
      this.updateIntersectionObserver();

      // This condition is somewhat arbitrary.
      const shouldDiscardOlderMessages: boolean =
        this.isAtBottom() && newItems.length >= this.maxVisibleRows * 1.5;
      if (shouldDiscardOlderMessages) {
        discardMessages({
          conversationId: id,
          numberToKeepAtBottom: this.maxVisibleRows,
        });
      }
    }
  }

  private handleBlur = (event: React.FocusEvent): void => {
    const { clearSelectedMessage } = this.props;

    const { currentTarget } = event;

    // Thanks to https://gist.github.com/pstoica/4323d3e6e37e8a23dd59
    setTimeout(() => {
      // If focus moved to one of our portals, we do not clear the selected
      // message so that focus stays inside the portal. We need to be careful
      // to not create colliding keyboard shortcuts between selected messages
      // and our portals!
      const portals = Array.from(
        document.querySelectorAll('body > div:not(.inbox)')
      );
      if (portals.some(el => el.contains(document.activeElement))) {
        return;
      }

      if (!currentTarget.contains(document.activeElement)) {
        clearSelectedMessage();
      }
    }, 0);
  };

  private handleKeyDown = (
    event: React.KeyboardEvent<HTMLDivElement>
  ): void => {
    const { selectMessage, selectedMessageId, items, id } = this.props;
    const commandKey = get(window, 'platform') === 'darwin' && event.metaKey;
    const controlKey = get(window, 'platform') !== 'darwin' && event.ctrlKey;
    const commandOrCtrl = commandKey || controlKey;

    if (!items || items.length < 1) {
      return;
    }

    if (selectedMessageId && !commandOrCtrl && event.key === 'ArrowUp') {
      const selectedMessageIndex = items.findIndex(
        item => item === selectedMessageId
      );
      if (selectedMessageIndex < 0) {
        return;
      }

      const targetIndex = selectedMessageIndex - 1;
      if (targetIndex < 0) {
        return;
      }

      const messageId = items[targetIndex];
      selectMessage(messageId, id);

      event.preventDefault();
      event.stopPropagation();

      return;
    }

    if (selectedMessageId && !commandOrCtrl && event.key === 'ArrowDown') {
      const selectedMessageIndex = items.findIndex(
        item => item === selectedMessageId
      );
      if (selectedMessageIndex < 0) {
        return;
      }

      const targetIndex = selectedMessageIndex + 1;
      if (targetIndex >= items.length) {
        return;
      }

      const messageId = items[targetIndex];
      selectMessage(messageId, id);

      event.preventDefault();
      event.stopPropagation();

      return;
    }

    if (commandOrCtrl && event.key === 'ArrowUp') {
      const firstMessageId = first(items);
      if (firstMessageId) {
        selectMessage(firstMessageId, id);
        event.preventDefault();
        event.stopPropagation();
      }
      return;
    }

    if (commandOrCtrl && event.key === 'ArrowDown') {
      this.scrollDown(true);
      event.preventDefault();
      event.stopPropagation();
    }
  };

  public override render(): JSX.Element | null {
    const {
      acknowledgeGroupMemberNameCollisions,
      areWeAdmin,
      clearInvitedUuidsForNewlyCreatedGroup,
      closeContactSpoofingReview,
      contactSpoofingReview,
      getPreferredBadge,
      getTimestampForMessage,
      haveNewest,
      haveOldest,
      i18n,
      id,
      invitedContactsForNewlyCreatedGroup,
      isConversationSelected,
      isGroupV1AndDisabled,
      isLoadingMessages,
      items,
      oldestUnreadIndex,
      onBlock,
      onBlockAndReportSpam,
      onDelete,
      onUnblock,
      removeMember,
      renderHeroRow,
      renderItem,
      renderTypingBubble,
      reviewGroupMemberNameCollision,
      reviewMessageRequestNameCollision,
      showContactModal,
      theme,
      totalUnread,
      typingContactId,
      unblurAvatar,
      unreadCount,
      updateSharedGroups,
    } = this.props;
    const {
      hasRecentlyScrolled,
      lastMeasuredWarningHeight,
      newestFullyVisibleMessageId,
      oldestPartiallyVisibleMessageId,
      widthBreakpoint,
    } = this.state;

    // As a performance optimization, we don't need to render anything if this
    //   conversation isn't the active one.
    if (!isConversationSelected) {
      return null;
    }

    const areThereAnyMessages = items.length > 0;
    const areAnyMessagesUnread = Boolean(unreadCount);
    const areAnyMessagesBelowCurrentPosition =
      !haveNewest ||
      Boolean(
        newestFullyVisibleMessageId &&
          newestFullyVisibleMessageId !== last(items)
      );
    const areSomeMessagesBelowCurrentPosition =
      !haveNewest ||
      (newestFullyVisibleMessageId &&
        !items
          .slice(-SCROLL_DOWN_BUTTON_THRESHOLD)
          .includes(newestFullyVisibleMessageId));

    const areUnreadBelowCurrentPosition = Boolean(
      areThereAnyMessages &&
        areAnyMessagesUnread &&
        areAnyMessagesBelowCurrentPosition
    );
    const shouldShowScrollDownButton = Boolean(
      areThereAnyMessages &&
        (areUnreadBelowCurrentPosition || areSomeMessagesBelowCurrentPosition)
    );

    const actionProps = getActions(this.props);

    let floatingHeader: ReactNode;
    // It's possible that a message was removed from `items` but we still have its ID in
    //   state. `getTimestampForMessage` might return undefined in that case.
    const oldestPartiallyVisibleMessageTimestamp =
      oldestPartiallyVisibleMessageId
        ? getTimestampForMessage(oldestPartiallyVisibleMessageId)
        : undefined;
    if (
      oldestPartiallyVisibleMessageId &&
      oldestPartiallyVisibleMessageTimestamp
    ) {
      floatingHeader = (
        <TimelineFloatingHeader
          i18n={i18n}
          isLoading={isLoadingMessages}
          style={
            lastMeasuredWarningHeight
              ? { marginTop: lastMeasuredWarningHeight }
              : undefined
          }
          timestamp={oldestPartiallyVisibleMessageTimestamp}
          visible={
            (hasRecentlyScrolled || isLoadingMessages) &&
            (!haveOldest || oldestPartiallyVisibleMessageId !== items[0])
          }
        />
      );
    }

    const messageNodes: Array<ReactChild> = [];
    for (let itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
      const previousItemIndex = itemIndex - 1;
      const nextItemIndex = itemIndex + 1;

      const previousMessageId: undefined | string = items[previousItemIndex];
      const nextMessageId: undefined | string = items[nextItemIndex];
      const messageId = items[itemIndex];

      if (!messageId) {
        assert(
          false,
          '<Timeline> iterated through items and got an empty message ID'
        );
        continue;
      }

      let unreadIndicatorPlacement: undefined | UnreadIndicatorPlacement;
      if (oldestUnreadIndex === itemIndex) {
        unreadIndicatorPlacement = UnreadIndicatorPlacement.JustAbove;
        messageNodes.push(
          <LastSeenIndicator
            key="last seen indicator"
            count={totalUnread}
            i18n={i18n}
            ref={this.lastSeenIndicatorRef}
          />
        );
      } else if (oldestUnreadIndex === nextItemIndex) {
        unreadIndicatorPlacement = UnreadIndicatorPlacement.JustBelow;
      }

      messageNodes.push(
        <div
          key={messageId}
          data-item-index={itemIndex}
          data-message-id={messageId}
        >
          <ErrorBoundary i18n={i18n} showDebugLog={showDebugLog}>
            {renderItem({
              actionProps,
              containerElementRef: this.containerRef,
              containerWidthBreakpoint: widthBreakpoint,
              conversationId: id,
              isOldestTimelineItem: haveOldest && itemIndex === 0,
              messageId,
              nextMessageId,
              previousMessageId,
              unreadIndicatorPlacement,
            })}
          </ErrorBoundary>
        </div>
      );
    }

    const warning = Timeline.getWarning(this.props, this.state);
    let timelineWarning: ReactNode;
    if (warning) {
      let text: ReactChild;
      let onClose: () => void;
      switch (warning.type) {
        case ContactSpoofingType.DirectConversationWithSameTitle:
          text = (
            <Intl
              i18n={i18n}
              id="ContactSpoofing__same-name"
              components={{
                link: (
                  <TimelineWarning.Link
                    onClick={() => {
                      reviewMessageRequestNameCollision({
                        safeConversationId: warning.safeConversation.id,
                      });
                    }}
                  >
                    {i18n('ContactSpoofing__same-name__link')}
                  </TimelineWarning.Link>
                ),
              }}
            />
          );
          onClose = () => {
            this.setState({
              hasDismissedDirectContactSpoofingWarning: true,
            });
          };
          break;
        case ContactSpoofingType.MultipleGroupMembersWithSameTitle: {
          const { groupNameCollisions } = warning;
          text = (
            <Intl
              i18n={i18n}
              id="ContactSpoofing__same-name-in-group"
              components={{
                count: Object.values(groupNameCollisions)
                  .reduce(
                    (result, conversations) => result + conversations.length,
                    0
                  )
                  .toString(),
                link: (
                  <TimelineWarning.Link
                    onClick={() => {
                      reviewGroupMemberNameCollision(id);
                    }}
                  >
                    {i18n('ContactSpoofing__same-name-in-group__link')}
                  </TimelineWarning.Link>
                ),
              }}
            />
          );
          onClose = () => {
            acknowledgeGroupMemberNameCollisions(groupNameCollisions);
          };
          break;
        }
        default:
          throw missingCaseError(warning);
      }

      timelineWarning = (
        <Measure
          bounds
          onResize={({ bounds }) => {
            if (!bounds) {
              assert(false, 'We should be measuring the bounds');
              return;
            }
            this.setState({ lastMeasuredWarningHeight: bounds.height });
          }}
        >
          {({ measureRef }) => (
            <TimelineWarnings ref={measureRef}>
              <TimelineWarning i18n={i18n} onClose={onClose}>
                <TimelineWarning.IconContainer>
                  <TimelineWarning.GenericIcon />
                </TimelineWarning.IconContainer>
                <TimelineWarning.Text>{text}</TimelineWarning.Text>
              </TimelineWarning>
            </TimelineWarnings>
          )}
        </Measure>
      );
    }

    let contactSpoofingReviewDialog: ReactNode;
    if (contactSpoofingReview) {
      const commonProps = {
        getPreferredBadge,
        i18n,
        onBlock,
        onBlockAndReportSpam,
        onClose: closeContactSpoofingReview,
        onDelete,
        onShowContactModal: showContactModal,
        onUnblock,
        removeMember,
        theme,
      };

      switch (contactSpoofingReview.type) {
        case ContactSpoofingType.DirectConversationWithSameTitle:
          contactSpoofingReviewDialog = (
            <ContactSpoofingReviewDialog
              {...commonProps}
              type={ContactSpoofingType.DirectConversationWithSameTitle}
              possiblyUnsafeConversation={
                contactSpoofingReview.possiblyUnsafeConversation
              }
              safeConversation={contactSpoofingReview.safeConversation}
            />
          );
          break;
        case ContactSpoofingType.MultipleGroupMembersWithSameTitle:
          contactSpoofingReviewDialog = (
            <ContactSpoofingReviewDialog
              {...commonProps}
              type={ContactSpoofingType.MultipleGroupMembersWithSameTitle}
              areWeAdmin={Boolean(areWeAdmin)}
              collisionInfoByTitle={contactSpoofingReview.collisionInfoByTitle}
            />
          );
          break;
        default:
          throw missingCaseError(contactSpoofingReview);
      }
    }

    return (
      <>
        <Measure
          bounds
          onResize={({ bounds }) => {
            const { isNearBottom } = this.props;

            strictAssert(bounds, 'We should be measuring the bounds');

            this.setState({
              widthBreakpoint: getWidthBreakpoint(bounds.width),
            });

            this.maxVisibleRows = Math.ceil(bounds.height / MIN_ROW_HEIGHT);

            const containerEl = this.containerRef.current;
            if (containerEl && isNearBottom) {
              scrollToBottom(containerEl);
            }
          }}
        >
          {({ measureRef }) => (
            <div
              className={classNames(
                'module-timeline',
                isGroupV1AndDisabled ? 'module-timeline--disabled' : null,
                `module-timeline--width-${widthBreakpoint}`
              )}
              role="presentation"
              tabIndex={-1}
              onBlur={this.handleBlur}
              onKeyDown={this.handleKeyDown}
              ref={measureRef}
            >
              {timelineWarning}

              {floatingHeader}

              <div
                className="module-timeline__messages__container"
                onScroll={this.onScroll}
                ref={this.containerRef}
              >
                <div
                  className="module-timeline__messages"
                  ref={this.messagesRef}
                >
                  {haveOldest && (
                    <>
                      {Timeline.getWarning(this.props, this.state) && (
                        <div style={{ height: lastMeasuredWarningHeight }} />
                      )}
                      {renderHeroRow(id, unblurAvatar, updateSharedGroups)}
                    </>
                  )}

                  {messageNodes}

                  {typingContactId && renderTypingBubble(id)}
                </div>
              </div>

              {shouldShowScrollDownButton ? (
                <ScrollDownButton
                  conversationId={id}
                  withNewMessages={areUnreadBelowCurrentPosition}
                  scrollDown={this.onClickScrollDownButton}
                  i18n={i18n}
                />
              ) : null}
            </div>
          )}
        </Measure>

        {Boolean(invitedContactsForNewlyCreatedGroup.length) && (
          <NewlyCreatedGroupInvitedContactsDialog
            contacts={invitedContactsForNewlyCreatedGroup}
            getPreferredBadge={getPreferredBadge}
            i18n={i18n}
            onClose={clearInvitedUuidsForNewlyCreatedGroup}
            theme={theme}
          />
        )}

        {contactSpoofingReviewDialog}
      </>
    );
  }

  private static getWarning(
    { warning }: PropsType,
    state: StateType
  ): undefined | WarningType {
    if (!warning) {
      return undefined;
    }

    switch (warning.type) {
      case ContactSpoofingType.DirectConversationWithSameTitle: {
        const { hasDismissedDirectContactSpoofingWarning } = state;
        return hasDismissedDirectContactSpoofingWarning ? undefined : warning;
      }
      case ContactSpoofingType.MultipleGroupMembersWithSameTitle:
        return hasUnacknowledgedCollisions(
          warning.acknowledgedGroupNameCollisions,
          warning.groupNameCollisions
        )
          ? warning
          : undefined;
      default:
        throw missingCaseError(warning);
    }
  }
}

function showDebugLog() {
  window.showDebugLog();
}

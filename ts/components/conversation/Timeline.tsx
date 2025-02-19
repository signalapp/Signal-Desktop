// Copyright 2019 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { first, get, isNumber, last, throttle } from 'lodash';
import classNames from 'classnames';
import type { ReactChild, ReactNode, RefObject, UIEvent } from 'react';
import React from 'react';

import type { ReadonlyDeep } from 'type-fest';
import { ScrollDownButton, ScrollDownButtonVariant } from './ScrollDownButton';

import type { LocalizerType, ThemeType } from '../../types/Util';
import type { ConversationType } from '../../state/ducks/conversations';
import type { PreferredBadgeSelectorType } from '../../state/selectors/badges';
import { assertDev, strictAssert } from '../../util/assert';
import { missingCaseError } from '../../util/missingCaseError';
import { clearTimeoutIfNecessary } from '../../util/clearTimeoutIfNecessary';
import { WidthBreakpoint } from '../_util';

import { ErrorBoundary } from './ErrorBoundary';
import { I18n } from '../I18n';
import { TimelineWarning } from './TimelineWarning';
import { TimelineWarnings } from './TimelineWarnings';
import { NewlyCreatedGroupInvitedContactsDialog } from '../NewlyCreatedGroupInvitedContactsDialog';
import { ContactSpoofingType } from '../../util/contactSpoofing';
import type { PropsType as SmartContactSpoofingReviewDialogPropsType } from '../../state/smart/ContactSpoofingReviewDialog';
import type { GroupNameCollisionsWithIdsByTitle } from '../../util/groupMemberNameCollisions';
import { hasUnacknowledgedCollisions } from '../../util/groupMemberNameCollisions';
import { TimelineFloatingHeader } from './TimelineFloatingHeader';
import {
  getScrollAnchorBeforeUpdate,
  getWidthBreakpoint,
  ScrollAnchor,
  TimelineMessageLoadingState,
  UnreadIndicatorPlacement,
} from '../../util/timelineUtil';
import {
  getScrollBottom,
  scrollToBottom,
  setScrollBottom,
} from '../../util/scrollUtil';
import { LastSeenIndicator } from './LastSeenIndicator';
import { MINUTE } from '../../util/durations';
import { SizeObserver } from '../../hooks/useSizeObserver';
import {
  createScrollerLock,
  ScrollerLockContext,
} from '../../hooks/useScrollLock';

const AT_BOTTOM_THRESHOLD = 15;
const AT_BOTTOM_DETECTOR_STYLE = { height: AT_BOTTOM_THRESHOLD };

const MIN_ROW_HEIGHT = 18;
const SCROLL_DOWN_BUTTON_THRESHOLD = 8;
const LOAD_NEWER_THRESHOLD = 5;

export type WarningType = ReadonlyDeep<
  | {
      type: ContactSpoofingType.DirectConversationWithSameTitle;
      safeConversationId: string;
    }
  | {
      type: ContactSpoofingType.MultipleGroupMembersWithSameTitle;
      acknowledgedGroupNameCollisions: GroupNameCollisionsWithIdsByTitle;
      groupNameCollisions: GroupNameCollisionsWithIdsByTitle;
    }
>;

export type PropsDataType = {
  haveNewest: boolean;
  haveOldest: boolean;
  messageChangeCounter: number;
  messageLoadingState: TimelineMessageLoadingState | null;
  isNearBottom: boolean | null;
  items: ReadonlyArray<string>;
  oldestUnseenIndex: number | null;
  scrollToIndex: number | null;
  scrollToIndexCounter: number;
  totalUnseen: number;
};

type PropsHousekeepingType = {
  id: string;
  isBlocked: boolean;
  isConversationSelected: boolean;
  isGroupV1AndDisabled?: boolean;
  isIncomingMessageRequest: boolean;
  isSomeoneTyping: boolean;
  unreadCount?: number;
  unreadMentionsCount?: number;
  conversationType: 'direct' | 'group';

  targetedMessageId?: string;
  invitedContactsForNewlyCreatedGroup: Array<ConversationType>;
  selectedMessageId?: string;
  shouldShowMiniPlayer: boolean;

  warning?: WarningType;
  hasContactSpoofingReview: boolean | undefined;

  discardMessages: (
    _: Readonly<
      | {
          conversationId: string;
          numberToKeepAtBottom: number;
        }
      | { conversationId: string; numberToKeepAtTop: number }
    >
  ) => void;
  getTimestampForMessage: (messageId: string) => undefined | number;
  getPreferredBadge: PreferredBadgeSelectorType;
  i18n: LocalizerType;
  theme: ThemeType;

  updateVisibleMessages?: (messageIds: Array<string>) => void;
  renderCollidingAvatars: (_: {
    conversationIds: ReadonlyArray<string>;
  }) => JSX.Element;
  renderContactSpoofingReviewDialog: (
    props: SmartContactSpoofingReviewDialogPropsType
  ) => JSX.Element;
  renderHeroRow: (id: string) => JSX.Element;
  renderItem: (props: {
    containerElementRef: RefObject<HTMLElement>;
    containerWidthBreakpoint: WidthBreakpoint;
    conversationId: string;
    isBlocked: boolean;
    isGroup: boolean;
    isOldestTimelineItem: boolean;
    messageId: string;
    nextMessageId: undefined | string;
    previousMessageId: undefined | string;
    unreadIndicatorPlacement: undefined | UnreadIndicatorPlacement;
  }) => JSX.Element;
  renderMiniPlayer: (options: { shouldFlow: boolean }) => JSX.Element;
  renderTypingBubble: (id: string) => JSX.Element;
};

export type PropsActionsType = {
  // From Backbone
  acknowledgeGroupMemberNameCollisions: (
    conversationId: string,
    groupNameCollisions: ReadonlyDeep<GroupNameCollisionsWithIdsByTitle>
  ) => void;
  clearInvitedServiceIdsForNewlyCreatedGroup: () => void;
  clearTargetedMessage: () => unknown;
  closeContactSpoofingReview: () => void;
  loadOlderMessages: (conversationId: string, messageId: string) => unknown;
  loadNewerMessages: (conversationId: string, messageId: string) => unknown;
  loadNewestMessages: (
    conversationId: string,
    messageId: string,
    setFocus?: boolean
  ) => unknown;
  markMessageRead: (conversationId: string, messageId: string) => unknown;
  targetMessage: (messageId: string, conversationId: string) => unknown;
  setIsNearBottom: (conversationId: string, isNearBottom: boolean) => unknown;
  peekGroupCallForTheFirstTime: (conversationId: string) => unknown;
  peekGroupCallIfItHasMembers: (conversationId: string) => unknown;
  reviewConversationNameCollision: () => void;
  scrollToOldestUnreadMention: (conversationId: string) => unknown;
};

export type PropsType = PropsDataType &
  PropsHousekeepingType &
  PropsActionsType;

type StateType = {
  scrollLocked: boolean;
  scrollLockHeight: number | undefined;
  hasDismissedDirectContactSpoofingWarning: boolean;
  hasRecentlyScrolled: boolean;
  lastMeasuredWarningHeight: number;
  newestBottomVisibleMessageId?: string;
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

export class Timeline extends React.Component<
  PropsType,
  StateType,
  SnapshotType
> {
  readonly #containerRef = React.createRef<HTMLDivElement>();
  readonly #messagesRef = React.createRef<HTMLDivElement>();
  readonly #atBottomDetectorRef = React.createRef<HTMLDivElement>();
  readonly #lastSeenIndicatorRef = React.createRef<HTMLDivElement>();
  #intersectionObserver?: IntersectionObserver;

  // This is a best guess. It will likely be overridden when the timeline is measured.
  #maxVisibleRows = Math.ceil(window.innerHeight / MIN_ROW_HEIGHT);

  #hasRecentlyScrolledTimeout?: NodeJS.Timeout;
  #delayedPeekTimeout?: NodeJS.Timeout;
  #peekInterval?: NodeJS.Timeout;

  // eslint-disable-next-line react/state-in-constructor
  override state: StateType = {
    scrollLocked: false,
    scrollLockHeight: undefined,
    hasRecentlyScrolled: true,
    hasDismissedDirectContactSpoofingWarning: false,

    // These may be swiftly overridden.
    lastMeasuredWarningHeight: 0,
    widthBreakpoint: WidthBreakpoint.Wide,
  };

  #onScrollLockChange = (): void => {
    const scrollLocked = this.#scrollerLock.isLocked();
    this.setState(() => {
      // Prevent scroll due to elements shrinking or disappearing (e.g. typing indicators)
      const scrollLockHeight = scrollLocked
        ? this.#messagesRef.current?.getBoundingClientRect().height
        : undefined;
      return {
        scrollLocked,
        scrollLockHeight,
      };
    });
  };

  #scrollerLock = createScrollerLock('Timeline', this.#onScrollLockChange);

  #onScroll = (event: UIEvent): void => {
    // When content is removed from the viewport, such as typing indicators leaving
    // or messages being edited smaller or deleted, scroll events are generated and
    // they are marked as user-generated (isTrusted === true). Actual user generated
    // scroll events with movement must scroll a nonbottom state at some point.
    const isAtBottom = this.#isAtBottom();
    if (event.isTrusted && !isAtBottom) {
      this.#scrollerLock.onUserInterrupt('onScroll');
    }

    // hasRecentlyScrolled is used to show the floating date header, which we only
    // want to show when scrolling through history or on conversation first open.
    // Checking bottom prevents new messages and typing from showing the header.
    if (!this.state.hasRecentlyScrolled && this.#isAtBottom()) {
      return;
    }

    this.setState(oldState =>
      // `onScroll` is called frequently, so it's performance-sensitive. We try our best
      //   to return `null` from this updater because [that won't cause a re-render][0].
      //
      // [0]: https://github.com/facebook/react/blob/29b7b775f2ecf878eaf605be959d959030598b07/packages/react-reconciler/src/ReactUpdateQueue.js#L401-L404
      oldState.hasRecentlyScrolled ? null : { hasRecentlyScrolled: true }
    );
    clearTimeoutIfNecessary(this.#hasRecentlyScrolledTimeout);
    this.#hasRecentlyScrolledTimeout = setTimeout(() => {
      this.setState({ hasRecentlyScrolled: false });
    }, 3000);
  };

  #scrollToItemIndex(itemIndex: number): void {
    if (this.#scrollerLock.isLocked()) {
      return;
    }

    this.#messagesRef.current
      ?.querySelector(`[data-item-index="${itemIndex}"]`)
      ?.scrollIntoViewIfNeeded();
  }

  #scrollToBottom = (setFocus?: boolean): void => {
    if (this.#scrollerLock.isLocked()) {
      return;
    }

    const { targetMessage, id, items } = this.props;

    if (setFocus && items && items.length > 0) {
      const lastIndex = items.length - 1;
      const lastMessageId = items[lastIndex];
      targetMessage(lastMessageId, id);
    } else {
      const containerEl = this.#containerRef.current;
      if (containerEl) {
        scrollToBottom(containerEl);
      }
    }
  };

  #onClickScrollDownButton = (): void => {
    this.#scrollerLock.onUserInterrupt('onClickScrollDownButton');
    this.#scrollDown(false);
  };

  #scrollDown = (setFocus?: boolean): void => {
    if (this.#scrollerLock.isLocked()) {
      return;
    }

    const {
      haveNewest,
      id,
      items,
      loadNewestMessages,
      messageLoadingState,
      oldestUnseenIndex,
      targetMessage,
    } = this.props;
    const { newestBottomVisibleMessageId } = this.state;

    if (!items || items.length < 1) {
      return;
    }

    if (messageLoadingState) {
      this.#scrollToBottom(setFocus);
      return;
    }

    if (
      newestBottomVisibleMessageId &&
      isNumber(oldestUnseenIndex) &&
      items.findIndex(item => item === newestBottomVisibleMessageId) <
        oldestUnseenIndex
    ) {
      if (setFocus) {
        const messageId = items[oldestUnseenIndex];
        targetMessage(messageId, id);
      } else {
        this.#scrollToItemIndex(oldestUnseenIndex);
      }
    } else if (haveNewest) {
      this.#scrollToBottom(setFocus);
    } else {
      const lastId = last(items);
      if (lastId) {
        loadNewestMessages(id, lastId, setFocus);
      }
    }
  };

  #isAtBottom(): boolean {
    const containerEl = this.#containerRef.current;
    if (!containerEl) {
      return false;
    }
    const isScrolledNearBottom =
      getScrollBottom(containerEl) <= AT_BOTTOM_THRESHOLD;
    const hasScrollbars = containerEl.clientHeight < containerEl.scrollHeight;
    return isScrolledNearBottom || !hasScrollbars;
  }

  #updateIntersectionObserver(): void {
    const containerEl = this.#containerRef.current;
    const messagesEl = this.#messagesRef.current;
    const atBottomDetectorEl = this.#atBottomDetectorRef.current;
    if (!containerEl || !messagesEl || !atBottomDetectorEl) {
      return;
    }

    const {
      haveNewest,
      haveOldest,
      id,
      items,
      loadNewerMessages,
      loadOlderMessages,
      messageLoadingState,
      setIsNearBottom,
    } = this.props;

    // We re-initialize the `IntersectionObserver`. We don't want stale references to old
    //   props, and we care about the order of `IntersectionObserverEntry`s. (We could do
    //   this another way, but this approach works.)
    this.#intersectionObserver?.disconnect();

    const intersectionRatios = new Map<Element, number>();

    this.props.updateVisibleMessages?.([]);
    const intersectionObserverCallback: IntersectionObserverCallback =
      entries => {
        // The first time this callback is called, we'll get entries in observation order
        //   (which should match DOM order). We don't want to delete anything from our map
        //   because we don't want the order to change at all.
        entries.forEach(entry => {
          intersectionRatios.set(entry.target, entry.intersectionRatio);
        });

        let newIsNearBottom = false;
        let oldestPartiallyVisible: undefined | Element;
        let newestPartiallyVisible: undefined | Element;
        let newestFullyVisible: undefined | Element;
        const visibleMessageIds: Array<string> = [];
        for (const [element, intersectionRatio] of intersectionRatios) {
          if (intersectionRatio === 0) {
            continue;
          }

          const messageId = getMessageIdFromElement(element);
          if (messageId) {
            visibleMessageIds.push(messageId);
          }
          // We use this "at bottom detector" for two reasons, both for performance. It's
          //   usually faster to use an `IntersectionObserver` instead of a scroll event,
          //   and we want to do that here.
          //
          // 1. We can determine whether we're near the bottom without `onScroll`
          // 2. We need this information when deciding whether the bottom of the last
          //    message is visible. We want to get an intersection observer event when the
          //    bottom of the container comes into view.
          if (element === atBottomDetectorEl) {
            newIsNearBottom = true;
          } else {
            oldestPartiallyVisible = oldestPartiallyVisible || element;
            newestPartiallyVisible = element;
            if (intersectionRatio === 1) {
              newestFullyVisible = element;
            }
          }
        }

        this.props.updateVisibleMessages?.(visibleMessageIds);

        // If a message is fully visible, then you can see its bottom. If not, there's a
        //   very tall message around. We assume you can see the bottom of a message if
        //   (1) another message is partly visible right below it, or (2) you're near the
        //   bottom of the scrollable container.
        let newestBottomVisible: undefined | Element;
        if (newestFullyVisible) {
          newestBottomVisible = newestFullyVisible;
        } else if (
          newIsNearBottom ||
          newestPartiallyVisible !== oldestPartiallyVisible
        ) {
          newestBottomVisible = oldestPartiallyVisible;
        }

        const oldestPartiallyVisibleMessageId = getMessageIdFromElement(
          oldestPartiallyVisible
        );
        const newestBottomVisibleMessageId =
          getMessageIdFromElement(newestBottomVisible);

        this.setState({
          oldestPartiallyVisibleMessageId,
          newestBottomVisibleMessageId,
        });

        setIsNearBottom(id, newIsNearBottom);

        if (newestBottomVisibleMessageId) {
          this.#markNewestBottomVisibleMessageRead();

          const rowIndex = getRowIndexFromElement(newestBottomVisible);
          const maxRowIndex = items.length - 1;

          if (
            !messageLoadingState &&
            !haveNewest &&
            isNumber(rowIndex) &&
            maxRowIndex >= 0 &&
            rowIndex >= maxRowIndex - LOAD_NEWER_THRESHOLD
          ) {
            loadNewerMessages(id, newestBottomVisibleMessageId);
          }
        }

        if (
          !messageLoadingState &&
          !haveOldest &&
          oldestPartiallyVisibleMessageId &&
          oldestPartiallyVisibleMessageId === items[0]
        ) {
          loadOlderMessages(id, oldestPartiallyVisibleMessageId);
        }
      };

    this.#intersectionObserver = new IntersectionObserver(
      (entries, observer) => {
        assertDev(
          this.#intersectionObserver === observer,
          'observer.disconnect() should prevent callbacks from firing'
        );

        // Observer was updated from under us
        if (this.#intersectionObserver !== observer) {
          return;
        }

        intersectionObserverCallback(entries, observer);
      },
      {
        root: containerEl,
        threshold: [0, 1],
      }
    );

    for (const child of messagesEl.children) {
      if ((child as HTMLElement).dataset.messageId) {
        this.#intersectionObserver.observe(child);
      }
    }
    this.#intersectionObserver.observe(atBottomDetectorEl);
  }

  #markNewestBottomVisibleMessageRead = throttle((): void => {
    const { id, markMessageRead } = this.props;
    const { newestBottomVisibleMessageId } = this.state;
    if (newestBottomVisibleMessageId) {
      markMessageRead(id, newestBottomVisibleMessageId);
    }
  }, 500);

  #setupGroupCallPeekTimeouts(): void {
    this.#cleanupGroupCallPeekTimeouts();

    this.#delayedPeekTimeout = setTimeout(() => {
      const { id, peekGroupCallForTheFirstTime } = this.props;
      this.#delayedPeekTimeout = undefined;
      peekGroupCallForTheFirstTime(id);
    }, 500);

    this.#peekInterval = setInterval(() => {
      const { id, peekGroupCallIfItHasMembers } = this.props;
      peekGroupCallIfItHasMembers(id);
    }, MINUTE);
  }

  #cleanupGroupCallPeekTimeouts(): void {
    const peekInterval = this.#peekInterval;
    const delayedPeekTimeout = this.#delayedPeekTimeout;

    clearTimeoutIfNecessary(delayedPeekTimeout);
    this.#delayedPeekTimeout = undefined;

    if (peekInterval) {
      clearInterval(peekInterval);
      this.#peekInterval = undefined;
    }
  }

  public override componentDidMount(): void {
    const containerEl = this.#containerRef.current;
    const messagesEl = this.#messagesRef.current;
    const { conversationType, isConversationSelected } = this.props;
    strictAssert(
      // We don't render anything unless the conversation is selected
      (containerEl && messagesEl) || !isConversationSelected,
      '<Timeline> mounted without some refs'
    );

    this.#updateIntersectionObserver();

    window.SignalContext.activeWindowService.registerForActive(
      this.#markNewestBottomVisibleMessageRead
    );

    if (conversationType === 'group') {
      this.#setupGroupCallPeekTimeouts();
    }
  }

  public override componentWillUnmount(): void {
    window.SignalContext.activeWindowService.unregisterForActive(
      this.#markNewestBottomVisibleMessageRead
    );

    this.#intersectionObserver?.disconnect();
    this.#cleanupGroupCallPeekTimeouts();
    this.props.updateVisibleMessages?.([]);
  }

  public override getSnapshotBeforeUpdate(
    prevProps: Readonly<PropsType>
  ): SnapshotType {
    const containerEl = this.#containerRef.current;
    if (!containerEl) {
      return null;
    }

    const { props } = this;
    const { scrollToIndex } = props;

    const scrollAnchor = getScrollAnchorBeforeUpdate(
      prevProps,
      props,
      this.#isAtBottom()
    );

    switch (scrollAnchor) {
      case ScrollAnchor.ChangeNothing:
        return null;
      case ScrollAnchor.ScrollToBottom:
        return { scrollBottom: 0 };
      case ScrollAnchor.ScrollToIndex:
        if (scrollToIndex == null) {
          assertDev(
            false,
            '<Timeline> got "scroll to index" scroll anchor, but no index'
          );
          return null;
        }
        return { scrollToIndex };
      case ScrollAnchor.ScrollToUnreadIndicator:
        return scrollToUnreadIndicator;
      case ScrollAnchor.Top:
        return { scrollTop: containerEl.scrollTop };
      case ScrollAnchor.Bottom:
        return { scrollBottom: getScrollBottom(containerEl) };
      default:
        throw missingCaseError(scrollAnchor);
    }
  }

  public override componentDidUpdate(
    prevProps: Readonly<PropsType>,
    _prevState: Readonly<StateType>,
    snapshot: Readonly<SnapshotType>
  ): void {
    const {
      conversationType: previousConversationType,
      items: oldItems,
      messageChangeCounter: previousMessageChangeCounter,
      messageLoadingState: previousMessageLoadingState,
    } = prevProps;
    const {
      conversationType,
      discardMessages,
      id,
      items: newItems,
      messageChangeCounter,
      messageLoadingState,
    } = this.props;

    const containerEl = this.#containerRef.current;
    if (!this.#scrollerLock.isLocked() && containerEl && snapshot) {
      if (snapshot === scrollToUnreadIndicator) {
        const lastSeenIndicatorEl = this.#lastSeenIndicatorRef.current;
        if (lastSeenIndicatorEl) {
          lastSeenIndicatorEl.scrollIntoView();
        } else {
          scrollToBottom(containerEl);
          assertDev(
            false,
            '<Timeline> expected a last seen indicator but it was not found'
          );
        }
      } else if ('scrollToIndex' in snapshot) {
        this.#scrollToItemIndex(snapshot.scrollToIndex);
      } else if ('scrollTop' in snapshot) {
        containerEl.scrollTop = snapshot.scrollTop;
      } else {
        setScrollBottom(containerEl, snapshot.scrollBottom);
      }
    }

    // We know that all items will be in order and that items can only be added at either
    // end, so we can check for equality without checking each item in the array
    const haveItemsChanged =
      oldItems.length !== newItems.length ||
      oldItems.at(0) !== newItems.at(0) ||
      oldItems.at(-1) !== newItems.at(-1);

    if (haveItemsChanged) {
      this.#updateIntersectionObserver();

      // This condition is somewhat arbitrary.
      const numberToKeepAtBottom = this.#maxVisibleRows * 2;
      const shouldDiscardOlderMessages: boolean =
        this.#isAtBottom() && newItems.length > numberToKeepAtBottom;
      if (shouldDiscardOlderMessages) {
        discardMessages({
          conversationId: id,
          numberToKeepAtBottom,
        });
      }

      const loadingStateThatJustFinished:
        | undefined
        | TimelineMessageLoadingState =
        !messageLoadingState && previousMessageLoadingState
          ? previousMessageLoadingState
          : undefined;
      const numberToKeepAtTop = this.#maxVisibleRows * 5;
      const shouldDiscardNewerMessages: boolean =
        !this.#isAtBottom() &&
        loadingStateThatJustFinished ===
          TimelineMessageLoadingState.LoadingOlderMessages &&
        newItems.length > numberToKeepAtTop;

      if (shouldDiscardNewerMessages) {
        discardMessages({
          conversationId: id,
          numberToKeepAtTop,
        });
      }
    }
    if (previousMessageChangeCounter !== messageChangeCounter) {
      this.#markNewestBottomVisibleMessageRead();
    }

    if (previousConversationType !== conversationType) {
      this.#cleanupGroupCallPeekTimeouts();
      if (conversationType === 'group') {
        this.#setupGroupCallPeekTimeouts();
      }
    }
  }

  #handleBlur = (event: React.FocusEvent): void => {
    const { clearTargetedMessage } = this.props;

    const { currentTarget } = event;

    // Thanks to https://gist.github.com/pstoica/4323d3e6e37e8a23dd59
    setTimeout(() => {
      // If focus moved to one of our portals, we do not clear the targeted
      // message so that focus stays inside the portal. We need to be careful
      // to not create colliding keyboard shortcuts between targeted messages
      // and our portals!
      const portals = Array.from(
        document.querySelectorAll('body > div:not(.inbox)')
      );
      if (portals.some(el => el.contains(document.activeElement))) {
        return;
      }

      if (!currentTarget.contains(document.activeElement)) {
        clearTargetedMessage();
      }
    }, 0);
  };

  #handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    const { targetMessage, targetedMessageId, items, id } = this.props;
    const commandKey = get(window, 'platform') === 'darwin' && event.metaKey;
    const controlKey = get(window, 'platform') !== 'darwin' && event.ctrlKey;
    const commandOrCtrl = commandKey || controlKey;

    if (!items || items.length < 1) {
      return;
    }

    if (
      targetedMessageId &&
      !commandOrCtrl &&
      (event.key === 'ArrowUp' || event.key === 'PageUp')
    ) {
      const targetedMessageIndex = items.findIndex(
        item => item === targetedMessageId
      );
      if (targetedMessageIndex < 0) {
        return;
      }

      const indexIncrement = event.key === 'PageUp' ? 10 : 1;
      const targetIndex = targetedMessageIndex - indexIncrement;
      if (targetIndex < 0) {
        return;
      }

      const messageId = items[targetIndex];
      targetMessage(messageId, id);

      event.preventDefault();
      event.stopPropagation();

      return;
    }

    if (
      targetedMessageId &&
      !commandOrCtrl &&
      (event.key === 'ArrowDown' || event.key === 'PageDown')
    ) {
      const targetedMessageIndex = items.findIndex(
        item => item === targetedMessageId
      );
      if (targetedMessageIndex < 0) {
        return;
      }

      const indexIncrement = event.key === 'PageDown' ? 10 : 1;
      const targetIndex = targetedMessageIndex + indexIncrement;
      if (targetIndex >= items.length) {
        return;
      }

      const messageId = items[targetIndex];
      targetMessage(messageId, id);

      event.preventDefault();
      event.stopPropagation();

      return;
    }

    if (event.key === 'Home' || (commandOrCtrl && event.key === 'ArrowUp')) {
      const firstMessageId = first(items);
      if (firstMessageId) {
        targetMessage(firstMessageId, id);
        event.preventDefault();
        event.stopPropagation();
      }
      return;
    }

    if (event.key === 'End' || (commandOrCtrl && event.key === 'ArrowDown')) {
      this.#scrollDown(true);
      event.preventDefault();
      event.stopPropagation();
    }
  };

  public override render(): JSX.Element | null {
    const {
      acknowledgeGroupMemberNameCollisions,
      clearInvitedServiceIdsForNewlyCreatedGroup,
      closeContactSpoofingReview,
      conversationType,
      hasContactSpoofingReview,
      getPreferredBadge,
      getTimestampForMessage,
      haveNewest,
      haveOldest,
      i18n,
      id,
      invitedContactsForNewlyCreatedGroup,
      isBlocked,
      isConversationSelected,
      isGroupV1AndDisabled,
      items,
      messageLoadingState,
      oldestUnseenIndex,
      renderCollidingAvatars,
      renderContactSpoofingReviewDialog,
      renderHeroRow,
      renderItem,
      renderMiniPlayer,
      renderTypingBubble,
      reviewConversationNameCollision,
      scrollToOldestUnreadMention,
      shouldShowMiniPlayer,
      theme,
      totalUnseen,
      unreadCount,
      unreadMentionsCount,
    } = this.props;
    const {
      scrollLocked,
      scrollLockHeight,
      hasRecentlyScrolled,
      lastMeasuredWarningHeight,
      newestBottomVisibleMessageId,
      oldestPartiallyVisibleMessageId,
      widthBreakpoint,
    } = this.state;

    // As a performance optimization, we don't need to render anything if this
    //   conversation isn't the active one.
    if (!isConversationSelected) {
      return null;
    }

    const isGroup = conversationType === 'group';
    const areThereAnyMessages = items.length > 0;
    const areAnyMessagesUnread = Boolean(unreadCount);
    const areAnyMessagesBelowCurrentPosition =
      !haveNewest ||
      Boolean(
        newestBottomVisibleMessageId &&
          newestBottomVisibleMessageId !== last(items)
      );
    const areSomeMessagesBelowCurrentPosition =
      !haveNewest ||
      (newestBottomVisibleMessageId &&
        !items
          .slice(-SCROLL_DOWN_BUTTON_THRESHOLD)
          .includes(newestBottomVisibleMessageId));

    const areUnreadBelowCurrentPosition = Boolean(
      areThereAnyMessages &&
        areAnyMessagesUnread &&
        areAnyMessagesBelowCurrentPosition
    );
    const shouldShowScrollDownButtons = Boolean(
      areThereAnyMessages &&
        (areUnreadBelowCurrentPosition || areSomeMessagesBelowCurrentPosition)
    );

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
      const isLoadingMessages = Boolean(messageLoadingState);
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
        assertDev(
          false,
          '<Timeline> iterated through items and got an empty message ID'
        );
        continue;
      }

      let unreadIndicatorPlacement: undefined | UnreadIndicatorPlacement;
      if (oldestUnseenIndex === itemIndex) {
        unreadIndicatorPlacement = UnreadIndicatorPlacement.JustAbove;
        messageNodes.push(
          <LastSeenIndicator
            key="last seen indicator"
            count={totalUnseen}
            i18n={i18n}
            ref={this.#lastSeenIndicatorRef}
          />
        );
      } else if (oldestUnseenIndex === nextItemIndex) {
        unreadIndicatorPlacement = UnreadIndicatorPlacement.JustBelow;
      }

      messageNodes.push(
        <div
          key={messageId}
          className={
            itemIndex === items.length - 1
              ? 'module-timeline__last-message'
              : undefined
          }
          data-supertab={
            oldestUnseenIndex === itemIndex ||
            (!oldestUnseenIndex && itemIndex === items.length - 1)
          }
          data-item-index={itemIndex}
          data-message-id={messageId}
          role="listitem"
        >
          <ErrorBoundary i18n={i18n} showDebugLog={showDebugLog}>
            {renderItem({
              containerElementRef: this.#containerRef,
              containerWidthBreakpoint: widthBreakpoint,
              conversationId: id,
              isBlocked,
              isGroup,
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
    let headerElements: ReactNode;
    if (warning || shouldShowMiniPlayer) {
      let text: ReactChild | undefined;
      let icon: ReactChild | undefined;
      let onClose: () => void;
      if (warning) {
        icon = (
          <TimelineWarning.IconContainer>
            <TimelineWarning.GenericIcon />
          </TimelineWarning.IconContainer>
        );
        switch (warning.type) {
          case ContactSpoofingType.DirectConversationWithSameTitle:
            text = (
              <I18n
                i18n={i18n}
                id="icu:ContactSpoofing__same-name--link"
                components={{
                  // This is a render props, not a component
                  // eslint-disable-next-line react/no-unstable-nested-components
                  reviewRequestLink: parts => (
                    <TimelineWarning.Link
                      onClick={reviewConversationNameCollision}
                    >
                      {parts}
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
            const numberOfSharedNames = Object.keys(groupNameCollisions).length;
            const reviewRequestLink = (
              parts: Array<string | JSX.Element>
            ): JSX.Element => (
              <TimelineWarning.Link onClick={reviewConversationNameCollision}>
                {parts}
              </TimelineWarning.Link>
            );
            if (numberOfSharedNames === 1) {
              const [conversationIds] = [...Object.values(groupNameCollisions)];
              if (conversationIds.length >= 2) {
                icon = (
                  <TimelineWarning.CustomInfo>
                    {renderCollidingAvatars({ conversationIds })}
                  </TimelineWarning.CustomInfo>
                );
              }
              text = (
                <I18n
                  i18n={i18n}
                  id="icu:ContactSpoofing__same-name-in-group--link"
                  components={{
                    count: conversationIds.length,
                    reviewRequestLink,
                  }}
                />
              );
            } else {
              text = (
                <I18n
                  i18n={i18n}
                  id="icu:ContactSpoofing__same-names-in-group--link"
                  components={{
                    count: numberOfSharedNames,
                    reviewRequestLink,
                  }}
                />
              );
            }
            onClose = () => {
              acknowledgeGroupMemberNameCollisions(id, groupNameCollisions);
            };
            break;
          }
          default:
            throw missingCaseError(warning);
        }
      }

      headerElements = (
        <SizeObserver
          onSizeChange={size => {
            this.setState({ lastMeasuredWarningHeight: size.height });
          }}
        >
          {measureRef => (
            <TimelineWarnings ref={measureRef}>
              {renderMiniPlayer({ shouldFlow: true })}
              {text && (
                <TimelineWarning i18n={i18n} onClose={onClose}>
                  {icon}
                  <TimelineWarning.Text>{text}</TimelineWarning.Text>
                </TimelineWarning>
              )}
            </TimelineWarnings>
          )}
        </SizeObserver>
      );
    }

    let contactSpoofingReviewDialog: ReactNode;
    if (hasContactSpoofingReview) {
      contactSpoofingReviewDialog = renderContactSpoofingReviewDialog({
        conversationId: id,
        onClose: closeContactSpoofingReview,
      });
    }

    return (
      <ScrollerLockContext.Provider value={this.#scrollerLock}>
        <SizeObserver
          onSizeChange={size => {
            const { isNearBottom } = this.props;

            this.setState({
              widthBreakpoint: getWidthBreakpoint(size.width),
            });

            this.#maxVisibleRows = Math.ceil(size.height / MIN_ROW_HEIGHT);

            const containerEl = this.#containerRef.current;
            if (containerEl && isNearBottom) {
              scrollToBottom(containerEl);
            }
          }}
        >
          {ref => (
            <div
              className={classNames(
                'module-timeline',
                isGroupV1AndDisabled ? 'module-timeline--disabled' : null,
                `module-timeline--width-${widthBreakpoint}`
              )}
              role="presentation"
              tabIndex={-1}
              onBlur={this.#handleBlur}
              onKeyDown={this.#handleKeyDown}
              ref={ref}
            >
              {headerElements}

              {floatingHeader}

              <main
                className="module-timeline__messages__container"
                onScroll={this.#onScroll}
                ref={this.#containerRef}
              >
                <div
                  className={classNames(
                    'module-timeline__messages',
                    haveNewest && 'module-timeline__messages--have-newest',
                    haveOldest && 'module-timeline__messages--have-oldest',
                    scrollLocked && 'module-timeline__messages--scroll-locked'
                  )}
                  ref={this.#messagesRef}
                  role="list"
                  style={
                    scrollLockHeight
                      ? { flexBasis: scrollLockHeight }
                      : undefined
                  }
                >
                  {haveOldest && (
                    <>
                      {Timeline.getWarning(this.props, this.state) && (
                        <div style={{ height: lastMeasuredWarningHeight }} />
                      )}
                      {renderHeroRow(id)}
                    </>
                  )}

                  {messageNodes}

                  {haveNewest && renderTypingBubble(id)}

                  <div
                    className="module-timeline__messages__at-bottom-detector"
                    ref={this.#atBottomDetectorRef}
                    style={AT_BOTTOM_DETECTOR_STYLE}
                  />
                </div>
              </main>
              {shouldShowScrollDownButtons ? (
                <div className="module-timeline__scrolldown-buttons">
                  {unreadMentionsCount ? (
                    <ScrollDownButton
                      variant={ScrollDownButtonVariant.UNREAD_MENTIONS}
                      count={unreadMentionsCount}
                      onClick={() => scrollToOldestUnreadMention(id)}
                      i18n={i18n}
                    />
                  ) : null}

                  <ScrollDownButton
                    variant={ScrollDownButtonVariant.UNREAD_MESSAGES}
                    count={areUnreadBelowCurrentPosition ? unreadCount : 0}
                    onClick={this.#onClickScrollDownButton}
                    i18n={i18n}
                  />
                </div>
              ) : null}
            </div>
          )}
        </SizeObserver>

        {Boolean(invitedContactsForNewlyCreatedGroup.length) && (
          <NewlyCreatedGroupInvitedContactsDialog
            contacts={invitedContactsForNewlyCreatedGroup}
            getPreferredBadge={getPreferredBadge}
            i18n={i18n}
            onClose={clearInvitedServiceIdsForNewlyCreatedGroup}
            theme={theme}
          />
        )}

        {contactSpoofingReviewDialog}
      </ScrollerLockContext.Provider>
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

function getMessageIdFromElement(
  element: undefined | Element
): undefined | string {
  return element instanceof HTMLElement ? element.dataset.messageId : undefined;
}

function getRowIndexFromElement(
  element: undefined | Element
): undefined | number {
  return element instanceof HTMLElement && element.dataset.itemIndex
    ? parseInt(element.dataset.itemIndex, 10)
    : undefined;
}

function showDebugLog() {
  window.IPC.showDebugLog();
}

// Copyright 2019-2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { debounce, get, isNumber } from 'lodash';
import classNames from 'classnames';
import React, { CSSProperties } from 'react';
import {
  AutoSizer,
  CellMeasurer,
  CellMeasurerCache,
  List,
  Grid,
} from 'react-virtualized';

import { ScrollDownButton } from './ScrollDownButton';

import { GlobalAudioProvider } from '../GlobalAudioContext';

import { LocalizerType } from '../../types/Util';
import { ConversationType } from '../../state/ducks/conversations';

import { PropsActions as MessageActionsType } from './Message';
import { PropsActions as SafetyNumberActionsType } from './SafetyNumberNotification';
import { NewlyCreatedGroupInvitedContactsDialog } from '../NewlyCreatedGroupInvitedContactsDialog';

const AT_BOTTOM_THRESHOLD = 15;
const NEAR_BOTTOM_THRESHOLD = 15;
const AT_TOP_THRESHOLD = 10;
const LOAD_MORE_THRESHOLD = 30;
const SCROLL_DOWN_BUTTON_THRESHOLD = 8;
export const LOAD_COUNTDOWN = 1;

export type PropsDataType = {
  haveNewest: boolean;
  haveOldest: boolean;
  isLoadingMessages: boolean;
  isNearBottom?: boolean;
  items: Array<string>;
  loadCountdownStart?: number;
  messageHeightChangeIndex?: number;
  oldestUnreadIndex?: number;
  resetCounter: number;
  scrollToIndex?: number;
  scrollToIndexCounter: number;
  totalUnread: number;
};

type PropsHousekeepingType = {
  id: string;
  unreadCount?: number;
  typingContact?: unknown;
  isGroupV1AndDisabled?: boolean;

  selectedMessageId?: string;
  invitedContactsForNewlyCreatedGroup: Array<ConversationType>;

  i18n: LocalizerType;

  renderItem: (
    id: string,
    conversationId: string,
    actions: Record<string, unknown>
  ) => JSX.Element;
  renderLastSeenIndicator: (id: string) => JSX.Element;
  renderHeroRow: (
    id: string,
    resizeHeroRow: () => unknown,
    updateSharedGroups: () => unknown
  ) => JSX.Element;
  renderLoadingRow: (id: string) => JSX.Element;
  renderTypingBubble: (id: string) => JSX.Element;
};

type PropsActionsType = {
  clearChangedMessages: (conversationId: string) => unknown;
  clearInvitedConversationsForNewlyCreatedGroup: () => void;
  setLoadCountdownStart: (
    conversationId: string,
    loadCountdownStart?: number
  ) => unknown;
  setIsNearBottom: (conversationId: string, isNearBottom: boolean) => unknown;

  loadAndScroll: (messageId: string) => unknown;
  loadOlderMessages: (messageId: string) => unknown;
  loadNewerMessages: (messageId: string) => unknown;
  loadNewestMessages: (messageId: string, setFocus?: boolean) => unknown;
  markMessageRead: (messageId: string) => unknown;
  selectMessage: (messageId: string, conversationId: string) => unknown;
  clearSelectedMessage: () => unknown;
  updateSharedGroups: () => unknown;
} & MessageActionsType &
  SafetyNumberActionsType;

export type PropsType = PropsDataType &
  PropsHousekeepingType &
  PropsActionsType;

// from https://github.com/bvaughn/react-virtualized/blob/fb3484ed5dcc41bffae8eab029126c0fb8f7abc0/source/List/types.js#L5
type RowRendererParamsType = {
  index: number;
  isScrolling: boolean;
  isVisible: boolean;
  key: string;
  parent: Record<string, unknown>;
  style: CSSProperties;
};
type OnScrollParamsType = {
  scrollTop: number;
  clientHeight: number;
  scrollHeight: number;

  clientWidth: number;
  scrollWidth?: number;
  scrollLeft?: number;
  scrollToColumn?: number;
  _hasScrolledToColumnTarget?: boolean;
  scrollToRow?: number;
  _hasScrolledToRowTarget?: boolean;
};

type VisibleRowsType = {
  newest?: {
    id: string;
    offsetTop: number;
    row: number;
  };
  oldest?: {
    id: string;
    offsetTop: number;
    row: number;
  };
};

type StateType = {
  atBottom: boolean;
  atTop: boolean;
  oneTimeScrollRow?: number;

  prevPropScrollToIndex?: number;
  prevPropScrollToIndexCounter?: number;
  propScrollToIndex?: number;

  shouldShowScrollDownButton: boolean;
  areUnreadBelowCurrentPosition: boolean;
};

export class Timeline extends React.PureComponent<PropsType, StateType> {
  public cellSizeCache = new CellMeasurerCache({
    defaultHeight: 64,
    fixedWidth: true,
  });

  public mostRecentWidth = 0;

  public mostRecentHeight = 0;

  public offsetFromBottom: number | undefined = 0;

  public resizeFlag = false;

  public listRef = React.createRef<List>();

  public visibleRows: VisibleRowsType | undefined;

  public loadCountdownTimeout: NodeJS.Timeout | null = null;

  constructor(props: PropsType) {
    super(props);

    const { scrollToIndex } = this.props;
    const oneTimeScrollRow = this.getLastSeenIndicatorRow();

    this.state = {
      atBottom: true,
      atTop: false,
      oneTimeScrollRow,
      propScrollToIndex: scrollToIndex,
      prevPropScrollToIndex: scrollToIndex,
      shouldShowScrollDownButton: false,
      areUnreadBelowCurrentPosition: false,
    };
  }

  public static getDerivedStateFromProps(
    props: PropsType,
    state: StateType
  ): StateType {
    if (
      isNumber(props.scrollToIndex) &&
      (props.scrollToIndex !== state.prevPropScrollToIndex ||
        props.scrollToIndexCounter !== state.prevPropScrollToIndexCounter)
    ) {
      return {
        ...state,
        propScrollToIndex: props.scrollToIndex,
        prevPropScrollToIndex: props.scrollToIndex,
        prevPropScrollToIndexCounter: props.scrollToIndexCounter,
      };
    }

    return state;
  }

  public getList = (): List | null => {
    if (!this.listRef) {
      return null;
    }

    const { current } = this.listRef;

    return current;
  };

  public getGrid = (): Grid | undefined => {
    const list = this.getList();
    if (!list) {
      return;
    }

    // eslint-disable-next-line consistent-return
    return list.Grid;
  };

  public getScrollContainer = (): HTMLDivElement | undefined => {
    // We're using an internal variable (_scrollingContainer)) here,
    // so cannot rely on the public type.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const grid: any = this.getGrid();
    if (!grid) {
      return;
    }

    // eslint-disable-next-line consistent-return
    return grid._scrollingContainer as HTMLDivElement;
  };

  public scrollToRow = (row: number): void => {
    const list = this.getList();
    if (!list) {
      return;
    }

    list.scrollToRow(row);
  };

  public recomputeRowHeights = (row?: number): void => {
    const list = this.getList();
    if (!list) {
      return;
    }

    list.recomputeRowHeights(row);
  };

  public onHeightOnlyChange = (): void => {
    const grid = this.getGrid();
    const scrollContainer = this.getScrollContainer();
    if (!grid || !scrollContainer) {
      return;
    }

    if (!isNumber(this.offsetFromBottom)) {
      return;
    }

    const { clientHeight, scrollHeight, scrollTop } = scrollContainer;
    const newOffsetFromBottom = Math.max(
      0,
      scrollHeight - clientHeight - scrollTop
    );
    const delta = newOffsetFromBottom - this.offsetFromBottom;

    // TODO: DESKTOP-687
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (grid as any).scrollToPosition({
      scrollTop: scrollContainer.scrollTop + delta,
    });
  };

  public resize = (row?: number): void => {
    this.offsetFromBottom = undefined;
    this.resizeFlag = false;
    if (isNumber(row) && row > 0) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      this.cellSizeCache.clearPlus(row, 0);
    } else {
      this.cellSizeCache.clearAll();
    }

    this.recomputeRowHeights(row || 0);
  };

  public resizeHeroRow = (): void => {
    this.resize(0);
  };

  public onScroll = (data: OnScrollParamsType): void => {
    // Ignore scroll events generated as react-virtualized recursively scrolls and
    //   re-measures to get us where we want to go.
    if (
      isNumber(data.scrollToRow) &&
      data.scrollToRow >= 0 &&
      !data._hasScrolledToRowTarget
    ) {
      return;
    }

    // Sometimes react-virtualized ends up with some incorrect math - we've scrolled below
    //  what should be possible. In this case, we leave everything the same and ask
    //  react-virtualized to try again. Without this, we'll set atBottom to true and
    //  pop the user back down to the bottom.
    const { clientHeight, scrollHeight, scrollTop } = data;
    if (scrollTop + clientHeight > scrollHeight) {
      return;
    }

    this.updateScrollMetrics(data);
    this.updateWithVisibleRows();
  };

  public updateScrollMetrics = debounce(
    (data: OnScrollParamsType) => {
      const { clientHeight, clientWidth, scrollHeight, scrollTop } = data;

      if (clientHeight <= 0 || scrollHeight <= 0) {
        return;
      }

      const {
        haveNewest,
        haveOldest,
        id,
        setIsNearBottom,
        setLoadCountdownStart,
      } = this.props;

      if (
        this.mostRecentHeight &&
        clientHeight !== this.mostRecentHeight &&
        this.mostRecentWidth &&
        clientWidth === this.mostRecentWidth
      ) {
        this.onHeightOnlyChange();
      }

      // If we've scrolled, we want to reset these
      const oneTimeScrollRow = undefined;
      const propScrollToIndex = undefined;

      this.offsetFromBottom = Math.max(
        0,
        scrollHeight - clientHeight - scrollTop
      );

      const atBottom =
        haveNewest && this.offsetFromBottom <= AT_BOTTOM_THRESHOLD;
      const isNearBottom =
        haveNewest && this.offsetFromBottom <= NEAR_BOTTOM_THRESHOLD;
      const atTop = scrollTop <= AT_TOP_THRESHOLD;
      const loadCountdownStart = atTop && !haveOldest ? Date.now() : undefined;

      if (this.loadCountdownTimeout) {
        clearTimeout(this.loadCountdownTimeout);
        this.loadCountdownTimeout = null;
      }
      if (isNumber(loadCountdownStart)) {
        this.loadCountdownTimeout = setTimeout(
          this.loadOlderMessages,
          LOAD_COUNTDOWN
        );
      }

      // Variable collision
      // eslint-disable-next-line react/destructuring-assignment
      if (loadCountdownStart !== this.props.loadCountdownStart) {
        setLoadCountdownStart(id, loadCountdownStart);
      }

      // Variable collision
      // eslint-disable-next-line react/destructuring-assignment
      if (isNearBottom !== this.props.isNearBottom) {
        setIsNearBottom(id, isNearBottom);
      }

      this.setState({
        atBottom,
        atTop,
        oneTimeScrollRow,
        propScrollToIndex,
      });
    },
    50,
    { maxWait: 50 }
  );

  public updateVisibleRows = (): void => {
    let newest;
    let oldest;

    const scrollContainer = this.getScrollContainer();
    if (!scrollContainer) {
      return;
    }

    if (scrollContainer.clientHeight === 0) {
      return;
    }

    const visibleTop = scrollContainer.scrollTop;
    const visibleBottom = visibleTop + scrollContainer.clientHeight;

    const innerScrollContainer = scrollContainer.children[0];
    if (!innerScrollContainer) {
      return;
    }

    const { children } = innerScrollContainer;

    for (let i = children.length - 1; i >= 0; i -= 1) {
      const child = children[i] as HTMLDivElement;
      const { id, offsetTop, offsetHeight } = child;

      if (!id) {
        continue;
      }

      const bottom = offsetTop + offsetHeight;

      if (bottom - AT_BOTTOM_THRESHOLD <= visibleBottom) {
        const row = parseInt(child.getAttribute('data-row') || '-1', 10);
        newest = { offsetTop, row, id };

        break;
      }
    }

    const max = children.length;
    for (let i = 0; i < max; i += 1) {
      const child = children[i] as HTMLDivElement;
      const { offsetTop, id } = child;

      if (!id) {
        continue;
      }

      if (offsetTop + AT_TOP_THRESHOLD >= visibleTop) {
        const row = parseInt(child.getAttribute('data-row') || '-1', 10);
        oldest = { offsetTop, row, id };

        break;
      }
    }

    this.visibleRows = { newest, oldest };
  };

  public updateWithVisibleRows = debounce(
    () => {
      const {
        unreadCount,
        haveNewest,
        isLoadingMessages,
        items,
        loadNewerMessages,
        markMessageRead,
      } = this.props;

      if (!items || items.length < 1) {
        return;
      }

      this.updateVisibleRows();
      if (!this.visibleRows) {
        return;
      }

      const { newest } = this.visibleRows;
      if (!newest || !newest.id) {
        return;
      }

      markMessageRead(newest.id);

      const rowCount = this.getRowCount();

      const lastId = items[items.length - 1];
      if (
        !isLoadingMessages &&
        !haveNewest &&
        newest.row > rowCount - LOAD_MORE_THRESHOLD
      ) {
        loadNewerMessages(lastId);
      }

      const lastIndex = items.length - 1;
      const lastItemRow = this.fromItemIndexToRow(lastIndex);
      const areUnreadBelowCurrentPosition = Boolean(
        isNumber(unreadCount) &&
          unreadCount > 0 &&
          (!haveNewest || newest.row < lastItemRow)
      );

      const shouldShowScrollDownButton = Boolean(
        !haveNewest ||
          areUnreadBelowCurrentPosition ||
          newest.row < rowCount - SCROLL_DOWN_BUTTON_THRESHOLD
      );

      this.setState({
        shouldShowScrollDownButton,
        areUnreadBelowCurrentPosition,
      });
    },
    500,
    { maxWait: 500 }
  );

  public loadOlderMessages = (): void => {
    const {
      haveOldest,
      isLoadingMessages,
      items,
      loadOlderMessages,
    } = this.props;

    if (this.loadCountdownTimeout) {
      clearTimeout(this.loadCountdownTimeout);
      this.loadCountdownTimeout = null;
    }

    if (isLoadingMessages || haveOldest || !items || items.length < 1) {
      return;
    }

    const oldestId = items[0];
    loadOlderMessages(oldestId);
  };

  public rowRenderer = ({
    index,
    key,
    parent,
    style,
  }: RowRendererParamsType): JSX.Element => {
    const {
      id,
      haveOldest,
      items,
      renderItem,
      renderHeroRow,
      renderLoadingRow,
      renderLastSeenIndicator,
      renderTypingBubble,
      updateSharedGroups,
    } = this.props;

    const styleWithWidth = {
      ...style,
      width: `${this.mostRecentWidth}px`,
    };
    const row = index;
    const oldestUnreadRow = this.getLastSeenIndicatorRow();
    const typingBubbleRow = this.getTypingBubbleRow();
    let rowContents;

    if (haveOldest && row === 0) {
      rowContents = (
        <div data-row={row} style={styleWithWidth} role="row">
          {renderHeroRow(id, this.resizeHeroRow, updateSharedGroups)}
        </div>
      );
    } else if (!haveOldest && row === 0) {
      rowContents = (
        <div data-row={row} style={styleWithWidth} role="row">
          {renderLoadingRow(id)}
        </div>
      );
    } else if (oldestUnreadRow === row) {
      rowContents = (
        <div data-row={row} style={styleWithWidth} role="row">
          {renderLastSeenIndicator(id)}
        </div>
      );
    } else if (typingBubbleRow === row) {
      rowContents = (
        <div
          data-row={row}
          className="module-timeline__message-container"
          style={styleWithWidth}
          role="row"
        >
          {renderTypingBubble(id)}
        </div>
      );
    } else {
      const itemIndex = this.fromRowToItemIndex(row);
      if (typeof itemIndex !== 'number') {
        throw new Error(
          `Attempted to render item with undefined index - row ${row}`
        );
      }
      const messageId = items[itemIndex];
      rowContents = (
        <div
          id={messageId}
          data-row={row}
          className="module-timeline__message-container"
          style={styleWithWidth}
          role="row"
        >
          {renderItem(messageId, id, this.props)}
        </div>
      );
    }

    return (
      <CellMeasurer
        cache={this.cellSizeCache}
        columnIndex={0}
        key={key}
        parent={parent}
        rowIndex={index}
        width={this.mostRecentWidth}
      >
        {rowContents}
      </CellMeasurer>
    );
  };

  public fromItemIndexToRow(index: number): number {
    const { oldestUnreadIndex } = this.props;

    // We will always render either the hero row or the loading row
    let addition = 1;

    if (isNumber(oldestUnreadIndex) && index >= oldestUnreadIndex) {
      addition += 1;
    }

    return index + addition;
  }

  public getRowCount(): number {
    const { oldestUnreadIndex, typingContact } = this.props;
    const { items } = this.props;
    const itemsCount = items && items.length ? items.length : 0;

    // We will always render either the hero row or the loading row
    let extraRows = 1;

    if (isNumber(oldestUnreadIndex)) {
      extraRows += 1;
    }

    if (typingContact) {
      extraRows += 1;
    }

    return itemsCount + extraRows;
  }

  public fromRowToItemIndex(
    row: number,
    props?: PropsType
  ): number | undefined {
    const { items } = props || this.props;

    // We will always render either the hero row or the loading row
    let subtraction = 1;

    const oldestUnreadRow = this.getLastSeenIndicatorRow();
    if (isNumber(oldestUnreadRow) && row > oldestUnreadRow) {
      subtraction += 1;
    }

    const index = row - subtraction;
    if (index < 0 || index >= items.length) {
      return;
    }

    // eslint-disable-next-line consistent-return
    return index;
  }

  public getLastSeenIndicatorRow(props?: PropsType): number | undefined {
    const { oldestUnreadIndex } = props || this.props;
    if (!isNumber(oldestUnreadIndex)) {
      return;
    }

    // eslint-disable-next-line consistent-return
    return this.fromItemIndexToRow(oldestUnreadIndex) - 1;
  }

  public getTypingBubbleRow(): number | undefined {
    const { items } = this.props;
    if (!items || items.length < 0) {
      return;
    }

    const last = items.length - 1;

    // eslint-disable-next-line consistent-return
    return this.fromItemIndexToRow(last) + 1;
  }

  public onScrollToMessage = (messageId: string): void => {
    const { isLoadingMessages, items, loadAndScroll } = this.props;
    const index = items.findIndex(item => item === messageId);

    if (index >= 0) {
      const row = this.fromItemIndexToRow(index);
      this.setState({
        oneTimeScrollRow: row,
      });
    }

    if (!isLoadingMessages) {
      loadAndScroll(messageId);
    }
  };

  public scrollToBottom = (setFocus?: boolean): void => {
    const { selectMessage, id, items } = this.props;

    if (setFocus && items && items.length > 0) {
      const lastIndex = items.length - 1;
      const lastMessageId = items[lastIndex];
      selectMessage(lastMessageId, id);
    }

    this.setState({
      propScrollToIndex: undefined,
      oneTimeScrollRow: undefined,
      atBottom: true,
    });
  };

  public onClickScrollDownButton = (): void => {
    this.scrollDown(false);
  };

  public scrollDown = (setFocus?: boolean): void => {
    const {
      haveNewest,
      id,
      isLoadingMessages,
      items,
      loadNewestMessages,
      oldestUnreadIndex,
      selectMessage,
    } = this.props;
    if (!items || items.length < 1) {
      return;
    }

    const lastId = items[items.length - 1];
    const lastSeenIndicatorRow = this.getLastSeenIndicatorRow();

    if (!this.visibleRows) {
      if (haveNewest) {
        this.scrollToBottom(setFocus);
      } else if (!isLoadingMessages) {
        loadNewestMessages(lastId, setFocus);
      }

      return;
    }

    const { newest } = this.visibleRows;

    if (
      newest &&
      isNumber(lastSeenIndicatorRow) &&
      newest.row < lastSeenIndicatorRow
    ) {
      if (setFocus && isNumber(oldestUnreadIndex)) {
        const messageId = items[oldestUnreadIndex];
        selectMessage(messageId, id);
      }
      this.setState({
        oneTimeScrollRow: lastSeenIndicatorRow,
      });
    } else if (haveNewest) {
      this.scrollToBottom(setFocus);
    } else if (!isLoadingMessages) {
      loadNewestMessages(lastId, setFocus);
    }
  };

  public componentDidMount(): void {
    this.updateWithVisibleRows();
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    window.registerForActive(this.updateWithVisibleRows);
  }

  public componentWillUnmount(): void {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    window.unregisterForActive(this.updateWithVisibleRows);
  }

  public componentDidUpdate(prevProps: PropsType): void {
    const {
      id,
      clearChangedMessages,
      items,
      messageHeightChangeIndex,
      oldestUnreadIndex,
      resetCounter,
      scrollToIndex,
      typingContact,
    } = this.props;

    // There are a number of situations which can necessitate that we forget about row
    //   heights previously calculated. We reset the minimum number of rows to minimize
    //   unexpected changes to the scroll position. Those changes happen because
    //   react-virtualized doesn't know what to expect (variable row heights) when it
    //   renders, so it does have a fixed row it's attempting to scroll to, and you ask it
    //   to render a given point it space, it will do pretty random things.

    if (
      !prevProps.items ||
      prevProps.items.length === 0 ||
      resetCounter !== prevProps.resetCounter
    ) {
      if (prevProps.items && prevProps.items.length > 0) {
        this.resize();
      }

      const oneTimeScrollRow = this.getLastSeenIndicatorRow();
      // TODO: DESKTOP-688
      // eslint-disable-next-line react/no-did-update-set-state
      this.setState({
        oneTimeScrollRow,
        atBottom: true,
        propScrollToIndex: scrollToIndex,
        prevPropScrollToIndex: scrollToIndex,
      });

      return;
    }

    if (
      items &&
      items.length > 0 &&
      prevProps.items &&
      prevProps.items.length > 0 &&
      items !== prevProps.items
    ) {
      const { atTop } = this.state;

      if (atTop) {
        const oldFirstIndex = 0;
        const oldFirstId = prevProps.items[oldFirstIndex];

        const newFirstIndex = items.findIndex(item => item === oldFirstId);
        if (newFirstIndex < 0) {
          this.resize();

          return;
        }

        const newRow = this.fromItemIndexToRow(newFirstIndex);
        const delta = newFirstIndex - oldFirstIndex;
        if (delta > 0) {
          // We're loading more new messages at the top; we want to stay at the top
          this.resize();
          // TODO: DESKTOP-688
          // eslint-disable-next-line react/no-did-update-set-state
          this.setState({ oneTimeScrollRow: newRow });

          return;
        }
      }

      // We continue on after our atTop check; because if we're not loading new messages
      //   we still have to check for all the other situations which might require a
      //   resize.

      const oldLastIndex = prevProps.items.length - 1;
      const oldLastId = prevProps.items[oldLastIndex];

      const newLastIndex = items.findIndex(item => item === oldLastId);
      if (newLastIndex < 0) {
        this.resize();

        return;
      }

      const indexDelta = newLastIndex - oldLastIndex;

      // If we've just added to the end of the list, then the index of the last id's
      //   index won't have changed, and we can rely on List's detection that items is
      //   different for the necessary re-render.
      if (indexDelta === 0) {
        if (typingContact || prevProps.typingContact) {
          // The last row will be off, because it was previously the typing indicator
          const rowCount = this.getRowCount();
          this.resize(rowCount - 2);
        }

        // no resize because we just add to the end
        return;
      }

      this.resize();

      return;
    }

    if (this.resizeFlag) {
      this.resize();

      return;
    }

    if (oldestUnreadIndex !== prevProps.oldestUnreadIndex) {
      const prevRow = this.getLastSeenIndicatorRow(prevProps);
      const newRow = this.getLastSeenIndicatorRow();
      const rowCount = this.getRowCount();
      const lastRow = rowCount - 1;

      const targetRow = Math.min(
        isNumber(prevRow) ? prevRow : lastRow,
        isNumber(newRow) ? newRow : lastRow
      );
      this.resize(targetRow);

      return;
    }

    if (isNumber(messageHeightChangeIndex)) {
      const rowIndex = this.fromItemIndexToRow(messageHeightChangeIndex);
      this.resize(rowIndex);
      clearChangedMessages(id);

      return;
    }

    if (Boolean(typingContact) !== Boolean(prevProps.typingContact)) {
      const rowCount = this.getRowCount();
      this.resize(rowCount - 2);

      return;
    }

    this.updateWithVisibleRows();
  }

  public getScrollTarget = (): number | undefined => {
    const { oneTimeScrollRow, atBottom, propScrollToIndex } = this.state;

    const rowCount = this.getRowCount();
    const targetMessage = isNumber(propScrollToIndex)
      ? this.fromItemIndexToRow(propScrollToIndex)
      : undefined;
    const scrollToBottom = atBottom ? rowCount - 1 : undefined;

    if (isNumber(targetMessage)) {
      return targetMessage;
    }

    if (isNumber(oneTimeScrollRow)) {
      return oneTimeScrollRow;
    }

    return scrollToBottom;
  };

  public handleBlur = (event: React.FocusEvent): void => {
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

  public handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
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
      this.setState({ oneTimeScrollRow: 0 });

      const firstMessageId = items[0];
      selectMessage(firstMessageId, id);

      event.preventDefault();
      event.stopPropagation();

      return;
    }

    if (commandOrCtrl && event.key === 'ArrowDown') {
      this.scrollDown(true);

      event.preventDefault();
      event.stopPropagation();
    }
  };

  public render(): JSX.Element | null {
    const {
      clearInvitedConversationsForNewlyCreatedGroup,
      i18n,
      id,
      items,
      isGroupV1AndDisabled,
      invitedContactsForNewlyCreatedGroup,
    } = this.props;
    const {
      shouldShowScrollDownButton,
      areUnreadBelowCurrentPosition,
    } = this.state;

    const rowCount = this.getRowCount();
    const scrollToIndex = this.getScrollTarget();

    if (!items || rowCount === 0) {
      return null;
    }

    const autoSizer = (
      <AutoSizer>
        {({ height, width }) => {
          if (this.mostRecentWidth && this.mostRecentWidth !== width) {
            this.resizeFlag = true;

            setTimeout(this.resize, 0);
          } else if (
            this.mostRecentHeight &&
            this.mostRecentHeight !== height
          ) {
            setTimeout(this.onHeightOnlyChange, 0);
          }

          this.mostRecentWidth = width;
          this.mostRecentHeight = height;

          return (
            <List
              deferredMeasurementCache={this.cellSizeCache}
              height={height}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              onScroll={this.onScroll as any}
              overscanRowCount={10}
              ref={this.listRef}
              rowCount={rowCount}
              rowHeight={this.cellSizeCache.rowHeight}
              rowRenderer={this.rowRenderer}
              scrollToAlignment="start"
              scrollToIndex={scrollToIndex}
              tabIndex={-1}
              width={width}
            />
          );
        }}
      </AutoSizer>
    );

    return (
      <>
        <div
          className={classNames(
            'module-timeline',
            isGroupV1AndDisabled ? 'module-timeline--disabled' : null
          )}
          role="presentation"
          tabIndex={-1}
          onBlur={this.handleBlur}
          onKeyDown={this.handleKeyDown}
        >
          <GlobalAudioProvider conversationId={id}>
            {autoSizer}
          </GlobalAudioProvider>
          {shouldShowScrollDownButton ? (
            <ScrollDownButton
              conversationId={id}
              withNewMessages={areUnreadBelowCurrentPosition}
              scrollDown={this.onClickScrollDownButton}
              i18n={i18n}
            />
          ) : null}
        </div>

        {Boolean(invitedContactsForNewlyCreatedGroup.length) && (
          <NewlyCreatedGroupInvitedContactsDialog
            contacts={invitedContactsForNewlyCreatedGroup}
            i18n={i18n}
            onClose={clearInvitedConversationsForNewlyCreatedGroup}
          />
        )}
      </>
    );
  }
}

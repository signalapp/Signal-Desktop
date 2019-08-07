import { debounce, isNumber } from 'lodash';
import React from 'react';
import {
  AutoSizer,
  CellMeasurer,
  CellMeasurerCache,
  List,
} from 'react-virtualized';

import { ScrollDownButton } from './ScrollDownButton';

import { LocalizerType } from '../../types/Util';

import { PropsActions as MessageActionsType } from './Message';
import { PropsActions as SafetyNumberActionsType } from './SafetyNumberNotification';

const AT_BOTTOM_THRESHOLD = 1;
const NEAR_BOTTOM_THRESHOLD = 15;
const AT_TOP_THRESHOLD = 10;
const LOAD_MORE_THRESHOLD = 30;
const SCROLL_DOWN_BUTTON_THRESHOLD = 8;
export const LOAD_COUNTDOWN = 2 * 1000;

export type PropsDataType = {
  haveNewest: boolean;
  haveOldest: boolean;
  isLoadingMessages: boolean;
  items: Array<string>;
  loadCountdownStart?: number;
  messageHeightChanges: boolean;
  oldestUnreadIndex?: number;
  resetCounter: number;
  scrollToIndex?: number;
  scrollToIndexCounter: number;
  totalUnread: number;
};

type PropsHousekeepingType = {
  id: string;
  unreadCount?: number;
  typingContact?: Object;

  i18n: LocalizerType;

  renderItem: (id: string, actions: Object) => JSX.Element;
  renderLastSeenIndicator: (id: string) => JSX.Element;
  renderLoadingRow: (id: string) => JSX.Element;
  renderTypingBubble: (id: string) => JSX.Element;
};

type PropsActionsType = {
  clearChangedMessages: (conversationId: string) => unknown;
  setLoadCountdownStart: (
    conversationId: string,
    loadCountdownStart?: number
  ) => unknown;
  setIsNearBottom: (conversationId: string, isNearBottom: boolean) => unknown;

  loadAndScroll: (messageId: string) => unknown;
  loadOlderMessages: (messageId: string) => unknown;
  loadNewerMessages: (messageId: string) => unknown;
  loadNewestMessages: (messageId: string) => unknown;
  markMessageRead: (messageId: string, forceFocus?: boolean) => unknown;
} & MessageActionsType &
  SafetyNumberActionsType;

type Props = PropsDataType & PropsHousekeepingType & PropsActionsType;

// from https://github.com/bvaughn/react-virtualized/blob/fb3484ed5dcc41bffae8eab029126c0fb8f7abc0/source/List/types.js#L5
type RowRendererParamsType = {
  index: number;
  isScrolling: boolean;
  isVisible: boolean;
  key: string;
  parent: Object;
  style: Object;
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

type State = {
  atBottom: boolean;
  atTop: boolean;
  oneTimeScrollRow?: number;

  prevPropScrollToIndex?: number;
  prevPropScrollToIndexCounter?: number;
  propScrollToIndex?: number;

  shouldShowScrollDownButton: boolean;
  areUnreadBelowCurrentPosition: boolean;
};

export class Timeline extends React.PureComponent<Props, State> {
  public cellSizeCache = new CellMeasurerCache({
    defaultHeight: 64,
    fixedWidth: true,
  });
  public mostRecentWidth = 0;
  public mostRecentHeight = 0;
  public offsetFromBottom: number | undefined = 0;
  public resizeAllFlag = false;
  public listRef = React.createRef<any>();
  public visibleRows: VisibleRowsType | undefined;
  public loadCountdownTimeout: any;

  constructor(props: Props) {
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

  public static getDerivedStateFromProps(props: Props, state: State): State {
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

  public getList = () => {
    if (!this.listRef) {
      return;
    }

    const { current } = this.listRef;

    return current;
  };

  public getGrid = () => {
    const list = this.getList();
    if (!list) {
      return;
    }

    return list.Grid;
  };

  public getScrollContainer = () => {
    const grid = this.getGrid();
    if (!grid) {
      return;
    }

    return grid._scrollingContainer as HTMLDivElement;
  };

  public scrollToRow = (row: number) => {
    const list = this.getList();
    if (!list) {
      return;
    }

    list.scrollToRow(row);
  };

  public recomputeRowHeights = (row?: number) => {
    const list = this.getList();
    if (!list) {
      return;
    }

    list.recomputeRowHeights(row);
  };

  public onHeightOnlyChange = () => {
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

    grid.scrollToPosition({ scrollTop: scrollContainer.scrollTop + delta });
  };

  public resizeAll = () => {
    this.offsetFromBottom = undefined;
    this.resizeAllFlag = false;
    this.cellSizeCache.clearAll();

    const rowCount = this.getRowCount();
    this.recomputeRowHeights(rowCount - 1);
  };

  public onScroll = (data: OnScrollParamsType) => {
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
      this.resizeAll();

      return;
    }

    this.updateScrollMetrics(data);
    this.updateWithVisibleRows();
  };

  // tslint:disable-next-line member-ordering
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

      if (loadCountdownStart !== this.props.loadCountdownStart) {
        setLoadCountdownStart(id, loadCountdownStart);
      }

      setIsNearBottom(id, isNearBottom);

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

  public updateVisibleRows = () => {
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

  // tslint:disable-next-line member-ordering cyclomatic-complexity
  public updateWithVisibleRows = debounce(
    (forceFocus?: boolean) => {
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

      markMessageRead(newest.id, forceFocus);

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

  public loadOlderMessages = () => {
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
  }: RowRendererParamsType) => {
    const {
      id,
      haveOldest,
      items,
      renderItem,
      renderLoadingRow,
      renderLastSeenIndicator,
      renderTypingBubble,
    } = this.props;

    const row = index;
    const oldestUnreadRow = this.getLastSeenIndicatorRow();
    const typingBubbleRow = this.getTypingBubbleRow();
    let rowContents;

    if (!haveOldest && row === 0) {
      rowContents = (
        <div data-row={row} style={style}>
          {renderLoadingRow(id)}
        </div>
      );
    } else if (oldestUnreadRow === row) {
      rowContents = (
        <div data-row={row} style={style}>
          {renderLastSeenIndicator(id)}
        </div>
      );
    } else if (typingBubbleRow === row) {
      rowContents = (
        <div
          data-row={row}
          className="module-timeline__message-container"
          style={style}
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
          style={style}
        >
          {renderItem(messageId, this.props)}
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

  public fromItemIndexToRow(index: number) {
    const { haveOldest, oldestUnreadIndex } = this.props;

    let addition = 0;

    if (!haveOldest) {
      addition += 1;
    }

    if (isNumber(oldestUnreadIndex) && index >= oldestUnreadIndex) {
      addition += 1;
    }

    return index + addition;
  }

  public getRowCount() {
    const { haveOldest, oldestUnreadIndex, typingContact } = this.props;
    const { items } = this.props;

    if (!items || items.length < 1) {
      return 0;
    }

    let extraRows = 0;

    if (!haveOldest) {
      extraRows += 1;
    }

    if (isNumber(oldestUnreadIndex)) {
      extraRows += 1;
    }

    if (typingContact) {
      extraRows += 1;
    }

    return items.length + extraRows;
  }

  public fromRowToItemIndex(row: number): number | undefined {
    const { haveOldest, items } = this.props;

    let subtraction = 0;

    if (!haveOldest) {
      subtraction += 1;
    }

    const oldestUnreadRow = this.getLastSeenIndicatorRow();
    if (isNumber(oldestUnreadRow) && row > oldestUnreadRow) {
      subtraction += 1;
    }

    const index = row - subtraction;
    if (index < 0 || index >= items.length) {
      return;
    }

    return index;
  }

  public getLastSeenIndicatorRow() {
    const { oldestUnreadIndex } = this.props;
    if (!isNumber(oldestUnreadIndex)) {
      return;
    }

    return this.fromItemIndexToRow(oldestUnreadIndex) - 1;
  }

  public getTypingBubbleRow() {
    const { items } = this.props;
    if (!items || items.length < 0) {
      return;
    }

    const last = items.length - 1;

    return this.fromItemIndexToRow(last) + 1;
  }

  public onScrollToMessage = (messageId: string) => {
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

  public scrollToBottom = () => {
    this.setState({
      propScrollToIndex: undefined,
      oneTimeScrollRow: undefined,
      atBottom: true,
    });
  };

  public onClickScrollDownButton = () => {
    const {
      haveNewest,
      isLoadingMessages,
      items,
      loadNewestMessages,
    } = this.props;
    const lastId = items[items.length - 1];
    const lastSeenIndicatorRow = this.getLastSeenIndicatorRow();

    if (!this.visibleRows) {
      if (haveNewest) {
        this.scrollToBottom();
      } else if (!isLoadingMessages) {
        loadNewestMessages(lastId);
      }

      return;
    }

    const { newest } = this.visibleRows;

    if (
      newest &&
      isNumber(lastSeenIndicatorRow) &&
      newest.row < lastSeenIndicatorRow
    ) {
      this.setState({
        oneTimeScrollRow: lastSeenIndicatorRow,
      });
    } else if (haveNewest) {
      this.scrollToBottom();
    } else if (!isLoadingMessages) {
      loadNewestMessages(lastId);
    }
  };

  public componentDidMount() {
    this.updateWithVisibleRows();
    // @ts-ignore
    window.registerForFocus(this.forceFocusVisibleRowUpdate);
  }

  public componentWillUnmount() {
    // @ts-ignore
    window.unregisterForFocus(this.forceFocusVisibleRowUpdate);
  }

  public forceFocusVisibleRowUpdate = () => {
    const forceFocus = true;
    this.updateWithVisibleRows(forceFocus);
  };

  public componentDidUpdate(prevProps: Props) {
    const {
      id,
      clearChangedMessages,
      items,
      messageHeightChanges,
      oldestUnreadIndex,
      resetCounter,
      scrollToIndex,
      typingContact,
    } = this.props;

    // There are a number of situations which can necessitate that we drop our row height
    //   cache and start over. It can cause the scroll position to do weird things, so we
    //   try to minimize those situations. In some cases we could reset a smaller set
    //   of cached row data, but we currently don't have an API for that. We'd need to
    //   create it.
    if (
      !prevProps.items ||
      prevProps.items.length === 0 ||
      resetCounter !== prevProps.resetCounter
    ) {
      const oneTimeScrollRow = this.getLastSeenIndicatorRow();
      this.setState({
        oneTimeScrollRow,
        atBottom: true,
        propScrollToIndex: scrollToIndex,
        prevPropScrollToIndex: scrollToIndex,
      });

      if (prevProps.items && prevProps.items.length > 0) {
        this.resizeAll();
      }
    } else if (!typingContact && prevProps.typingContact) {
      this.resizeAll();
    } else if (oldestUnreadIndex !== prevProps.oldestUnreadIndex) {
      this.resizeAll();
    } else if (
      items &&
      items.length > 0 &&
      prevProps.items &&
      prevProps.items.length > 0 &&
      items !== prevProps.items
    ) {
      if (this.state.atTop) {
        const oldFirstIndex = 0;
        const oldFirstId = prevProps.items[oldFirstIndex];

        const newIndex = items.findIndex(item => item === oldFirstId);
        if (newIndex < 0) {
          this.resizeAll();

          return;
        }

        const newRow = this.fromItemIndexToRow(newIndex);
        this.resizeAll();
        this.setState({ oneTimeScrollRow: newRow });
      } else {
        const oldLastIndex = prevProps.items.length - 1;
        const oldLastId = prevProps.items[oldLastIndex];

        const newIndex = items.findIndex(item => item === oldLastId);
        if (newIndex < 0) {
          this.resizeAll();

          return;
        }

        const indexDelta = newIndex - oldLastIndex;

        // If we've just added to the end of the list, then the index of the last id's
        //   index won't have changed, and we can rely on List's detection that items is
        //   different for the necessary re-render.
        if (indexDelta !== 0) {
          this.resizeAll();
        }
      }
    } else if (messageHeightChanges) {
      this.resizeAll();
      clearChangedMessages(id);
    } else if (this.resizeAllFlag) {
      this.resizeAll();
    } else {
      this.updateWithVisibleRows();
    }
  }

  public getScrollTarget = () => {
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

  public render() {
    const { i18n, id, items } = this.props;
    const {
      shouldShowScrollDownButton,
      areUnreadBelowCurrentPosition,
    } = this.state;

    if (!items || items.length < 1) {
      return null;
    }

    const rowCount = this.getRowCount();
    const scrollToIndex = this.getScrollTarget();

    return (
      <div className="module-timeline">
        <AutoSizer>
          {({ height, width }) => {
            if (this.mostRecentWidth && this.mostRecentWidth !== width) {
              this.resizeAllFlag = true;

              setTimeout(this.resizeAll, 0);
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
                onScroll={this.onScroll as any}
                overscanRowCount={10}
                ref={this.listRef}
                rowCount={rowCount}
                rowHeight={this.cellSizeCache.rowHeight}
                rowRenderer={this.rowRenderer}
                scrollToAlignment="start"
                scrollToIndex={scrollToIndex}
                width={width}
              />
            );
          }}
        </AutoSizer>
        {shouldShowScrollDownButton ? (
          <ScrollDownButton
            conversationId={id}
            withNewMessages={areUnreadBelowCurrentPosition}
            scrollDown={this.onClickScrollDownButton}
            i18n={i18n}
          />
        ) : null}
      </div>
    );
  }
}

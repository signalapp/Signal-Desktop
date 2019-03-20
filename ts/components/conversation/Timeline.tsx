import React from 'react';
import {
  AutoSizer,
  CellMeasurer,
  CellMeasurerCache,
  List,
} from 'react-virtualized';

import { LocalizerType } from '../../types/Util';

import { PropsActions as MessageActionsType } from './Message';
import { PropsActions as SafetyNumberActionsType } from './SafetyNumberNotification';

type PropsData = {
  items: Array<string>;

  renderItem: (id: string) => JSX.Element;
};

type PropsHousekeeping = {
  i18n: LocalizerType;
};

type PropsActions = MessageActionsType & SafetyNumberActionsType;

type Props = PropsData & PropsHousekeeping & PropsActions;

// from https://github.com/bvaughn/react-virtualized/blob/fb3484ed5dcc41bffae8eab029126c0fb8f7abc0/source/List/types.js#L5
type RowRendererParamsType = {
  index: number;
  isScrolling: boolean;
  isVisible: boolean;
  key: string;
  parent: Object;
  style: Object;
};

export class Timeline extends React.PureComponent<Props> {
  public cellSizeCache = new CellMeasurerCache({
    defaultHeight: 85,
    fixedWidth: true,
  });
  public mostRecentWidth = 0;
  public resizeAllFlag = false;
  public listRef = React.createRef<any>();

  public componentDidUpdate(prevProps: Props) {
    if (this.resizeAllFlag) {
      this.resizeAllFlag = false;
      this.cellSizeCache.clearAll();
      this.recomputeRowHeights();
    } else if (this.props.items !== prevProps.items) {
      const index = prevProps.items.length;
      this.cellSizeCache.clear(index, 0);
      this.recomputeRowHeights(index);
    }
  }

  public resizeAll = () => {
    this.resizeAllFlag = false;
    this.cellSizeCache.clearAll();
  };

  public recomputeRowHeights = (index?: number) => {
    if (this.listRef && this.listRef) {
      this.listRef.current.recomputeRowHeights(index);
    }
  };

  public rowRenderer = ({
    index,
    key,
    parent,
    style,
  }: RowRendererParamsType) => {
    const { items, renderItem } = this.props;
    const messageId = items[index];

    return (
      <CellMeasurer
        cache={this.cellSizeCache}
        columnIndex={0}
        key={key}
        parent={parent}
        rowIndex={index}
        width={this.mostRecentWidth}
      >
        <div className="module-timeline__message-container" style={style}>
          {renderItem(messageId)}
        </div>
      </CellMeasurer>
    );
  };

  public render() {
    const { items } = this.props;

    return (
      <div className="module-timeline">
        <AutoSizer>
          {({ height, width }) => {
            if (this.mostRecentWidth && this.mostRecentWidth !== width) {
              this.resizeAllFlag = true;

              setTimeout(this.resizeAll, 0);
            }

            this.mostRecentWidth = width;

            return (
              <List
                deferredMeasurementCache={this.cellSizeCache}
                height={height}
                // This also registers us with parent InfiniteLoader
                // onRowsRendered={onRowsRendered}
                overscanRowCount={0}
                ref={this.listRef}
                rowCount={items.length}
                rowHeight={this.cellSizeCache.rowHeight}
                rowRenderer={this.rowRenderer}
                width={width}
              />
            );
          }}
        </AutoSizer>
      </div>
    );
  }
}

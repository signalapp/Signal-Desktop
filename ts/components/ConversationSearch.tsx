import React, { CSSProperties } from 'react';
import Measure, { BoundingRect, MeasuredComponentProps } from 'react-measure';
import { debounce } from 'lodash';
import { List } from 'react-virtualized';
import { ConversationType } from '../sql/Interface';
import { LocalizerType } from '../types/Util';
import { ConversationListItem } from './ConversationListItem';

type RowRendererParamsType = {
  index: number;
  isScrolling: boolean;
  isVisible: boolean;
  key: string;
  parent: Record<string, unknown>;
  style: CSSProperties;
};

export type Props = {
  caption?: string;
  searchTerm?: string;
  width?: string;
  height?: string;
  i18n: LocalizerType;
  onConversationSelected: (conversationId: string) => void;
  searchConversationsFn: (
    query?: string,
    options?: { limit?: number }
  ) => Promise<Array<ConversationType>>;
};

interface State {
  conversations: Array<ConversationType>;
}

const styles = {
  conversationSearchContainer: {
    position: 'relative',
    display: 'inline-flex',
    flexDirection: 'column',
    justifyContent: 'center',
  } as React.CSSProperties,
  conversationSearchCaption: {
    textAlign: 'center',
    color: 'white',
    padding: '1em',
    paddingLeft: '3em',
    paddingRight: '3em',
    backgroundColor: 'rgba(192, 192, 192, .20)',
  } as React.CSSProperties,
  conversationSearchInput: {
    position: 'relative',
    paddingLeft: '15px',
    paddingRight: '15px',
    paddingTop: '10px',
    paddingBottom: '10px',
  } as React.CSSProperties,
  conversationSearchResults: {
    flexGrow: 1,
  } as React.CSSProperties,
};

const defaultWidth = '380px';

export class ConversationSearch extends React.PureComponent<Props, State> {
  private readonly inputRef = React.createRef<HTMLInputElement>();

  public constructor(props: Props) {
    super(props);

    this.state = {
      conversations: [],
    };
  }

  public componentDidMount = async (): Promise<void> => {
    const { searchConversationsFn: search } = this.props;
    const conversations = await search();
    this.setState({ conversations });
  };

  private readonly searchConversations = debounce(
    async (searchTerm: string): Promise<void> => {
      const { searchConversationsFn: search } = this.props;
      if (search) {
        const conversations = await search(searchTerm);
        this.setState({ conversations });
      }
    },
    200
  );

  private readonly focusInput = (): void => {
    if (this.inputRef.current) {
      this.inputRef.current.focus();
    }
  };

  private readonly renderList = ({
    height,
    width,
  }: BoundingRect): JSX.Element | Array<JSX.Element> | null => {
    const { i18n, onConversationSelected } = this.props;
    const { conversations } = this.state;

    if (!conversations) {
      return null;
    }

    const renderRow = ({
      index,
      key,
      style,
    }: RowRendererParamsType): JSX.Element => {
      const conversation = conversations[index];
      return (
        <div
          key={key}
          className="module-left-pane__conversation-container"
          style={style}
        >
          <ConversationListItem
            id={conversation.id}
            {...conversation}
            onClick={onConversationSelected}
            i18n={i18n}
          />
        </div>
      );
    };

    // Note: conversations is not a known prop for List, but it is required to ensure that
    //   it re-renders when our conversation data changes. Otherwise it would just render
    //   on startup and scroll.
    return (
      <div
        aria-live="polite"
        className="module-left-pane__list"
        key={0}
        role="group"
        tabIndex={-1}
      >
        <List
          className="module-left-pane__virtual-list"
          conversations={conversations}
          height={height || 0}
          rowCount={conversations.length}
          rowHeight={68}
          rowRenderer={renderRow}
          tabIndex={-1}
          width={width || 0}
        />
      </div>
    );
  };

  public render = (): JSX.Element => {
    const { searchTerm, caption, width, height } = this.props;
    const containerStyle = {
      ...styles.conversationSearchContainer,
      width: width || defaultWidth,
      height,
    };

    return (
      <div
        style={containerStyle}
        className="module-conversation-search__background"
      >
        {caption ? (
          <div style={styles.conversationSearchCaption}>{caption}</div>
        ) : null}
        <div style={styles.conversationSearchInput}>
          {/* eslint-disable-next-line jsx-a11y/control-has-associated-label */}
          <button
            className="module-conversation-search__search__icon"
            onClick={this.focusInput}
            tabIndex={-1}
            type="button"
          />
          <input
            type="text"
            ref={this.inputRef}
            className="module-main-header__search__input"
            style={{ maxWidth: '100%' }}
            placeholder="search"
            dir="auto"
            value={searchTerm}
            onChange={async ev =>
              this.searchConversations(ev.currentTarget.value)
            }
          />
        </div>
        <Measure bounds>
          {({ contentRect, measureRef }: MeasuredComponentProps) => (
            <div style={styles.conversationSearchResults} ref={measureRef}>
              {/* tslint:disable-next-line:no-non-null-assertion */}
              {this.renderList(contentRect.bounds!)}
            </div>
          )}
        </Measure>
      </div>
    );
  };
}

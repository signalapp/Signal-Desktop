import React from 'react';

import { PropsData as ConversationListItemPropsType } from '../ConversationListItem';
import { PropsData as SearchResultsProps } from '../SearchResults';
import { debounce } from 'lodash';
import { cleanSearchTerm } from '../../util/cleanSearchTerm';
import { SearchOptions } from '../../types/Search';
import { LeftPane, RowRendererParamsType } from '../LeftPane';
import { SessionButton, SessionButtonType, SessionButtonColor } from './SessionButton';
import { AutoSizer, List } from 'react-virtualized';

export interface Props {
  searchTerm: string;
  isSecondaryDevice: boolean;

  conversations?: Array<ConversationListItemPropsType>;

  searchResults?: SearchResultsProps;

  updateSearchTerm: (searchTerm: string) => void;
  search: (query: string, options: SearchOptions) => void;
  openConversationInternal: (id: string, messageId?: string) => void;
  clearSearch: () => void;
}

export class LeftPaneContactSection extends React.Component<Props, any> {
  private readonly debouncedSearch: (searchTerm: string) => void;

  public constructor(props: Props) {
    super(props);
    this.state = {
      showAddContactView: false,
      selectedTab: 0,
    };

    this.debouncedSearch = debounce(this.search.bind(this), 20);
    this.handleTabSelected = this.handleTabSelected.bind(this);
  }

  public componentWillUnmount() {
    this.updateSearch('');
  }

  public handleTabSelected(tabType: number) {
    this.setState({selectedTab: tabType});
  }

  public renderHeader(): JSX.Element|undefined {
    const labels = [window.i18n('contactsHeader'), window.i18n('lists')];
    return LeftPane.renderHeader(labels, this.handleTabSelected, undefined, null);
  }

  public render(): JSX.Element {
    return (
      <div className="left-pane-contact-section">
        {this.renderHeader()}
        {this.state.showAddContactView || this.renderContacts()}
      </div>
    );
  }

  private renderContacts() {
    return (
      <div className="left-pane-contact-content">
        {this.renderList()}
        {this.renderBottomButtons()}
        </div>);
  }

  private renderBottomButtons(): JSX.Element {
    const { selectedTab } = this.state;
    const edit = window.i18n('edit');
    const addContact = window.i18n('addContact');
    const createGroup = window.i18n('createGroup');
    return (
      <div className="left-pane-contact-bottom-buttons">
        <SessionButton text={edit} buttonType={SessionButtonType.SquareOutline}  buttonColor={SessionButtonColor.White}/>
        {selectedTab === 0 ? <SessionButton text={addContact} buttonType={SessionButtonType.SquareOutline} buttonColor={SessionButtonColor.Green}/> :
          <SessionButton text={createGroup} buttonType={SessionButtonType.Square} buttonColor={SessionButtonColor.Green}/>}
      </div>
    )
  }

  public getCurrentConversations():
    | Array<ConversationListItemPropsType>
    | undefined {
    const { conversations } = this.props;

    let conversationList = conversations;
    if (conversationList !== undefined) {
      conversationList = conversationList.filter(
        conversation => !conversation.isSecondary
      );
    }

    return conversationList;
  }

  private renderList() {
    // const conversations = this.getCurrentConversations();

    // if (!conversations) {
    //   throw new Error(
    //     'render: must provided conversations if no search results are provided'
    //   );
    // }

    // const length = conversations.length;
    // const listKey = 0;

    // Note: conversations is not a known prop for List, but it is required to ensure that
    //   it re-renders when our conversation data changes. Otherwise it would just render
    //   on startup and scroll.
    const list = (
      <div className="module-left-pane__list" key={0}>
          <AutoSizer>
            {({ height, width }) => (
              <List
                className="module-left-pane__virtual-list"
                height={height}
                rowCount={length}
                rowHeight={64}
                rowRenderer={this.renderRow}
                width={width}
                autoHeight={true}
              />
            )}
            </AutoSizer>
      </div>
    );

    return [list];
  }


  public renderRow = ({
    // index,
    // key,
    // style,
  }: RowRendererParamsType): JSX.Element|undefined => {
  //   const { openConversationInternal } = this.props;

  //   const conversations = this.getCurrentConversations();

  //   if (!conversations) {
  //     throw new Error('renderRow: Tried to render without conversations');
  //   }

  //   const conversation = conversations[index];

  //   return (
  //     <ConversationListItem
  //       key={key}
  //       style={style}
  //       {...conversation}
  //       onClick={openConversationInternal}
  //       i18n={window.i18n}
  //     />
  //   );
    return undefined;
   };

  

  public updateSearch(searchTerm: string) {
    const { updateSearchTerm, clearSearch } = this.props;

    if (!searchTerm) {
      clearSearch();

      return;
    }
    // reset our pubKeyPasted, we can either have a pasted sessionID or a sessionID got from a search
    this.setState({ pubKeyPasted: '' }, () => {
      window.Session.emptyContentEditableDivs();
    });

    if (updateSearchTerm) {
      updateSearchTerm(searchTerm);
    }

    if (searchTerm.length < 2) {
      return;
    }

    const cleanedTerm = cleanSearchTerm(searchTerm);
    if (!cleanedTerm) {
      return;
    }

    this.debouncedSearch(cleanedTerm);
  }

  public clearSearch() {
    this.props.clearSearch();
    //this.setFocus();
  }

  public search() {
    const { search } = this.props;
    const { searchTerm, isSecondaryDevice } = this.props;

    if (search) {
      search(searchTerm, {
        noteToSelf: window.i18n('noteToSelf').toLowerCase(),
        ourNumber: window.textsecure.storage.user.getNumber(),
        regionCode: '',
        isSecondaryDevice,
      });
    }
  }
}

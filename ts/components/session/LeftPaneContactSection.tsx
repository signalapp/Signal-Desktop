import React from 'react';

import {
  ConversationListItem,
  PropsData as ConversationListItemPropsType,
} from '../ConversationListItem';
import { PropsData as SearchResultsProps } from '../SearchResults';
import { debounce } from 'lodash';
import { cleanSearchTerm } from '../../util/cleanSearchTerm';
import { SearchOptions } from '../../types/Search';
import { LeftPane, RowRendererParamsType } from '../LeftPane';
import {
  SessionButton,
  SessionButtonColor,
  SessionButtonType,
} from './SessionButton';
import { AutoSizer, List } from 'react-virtualized';
import { validateNumber } from '../../types/PhoneNumber';
import { ConversationType } from '../../state/ducks/conversations';
import {
  SessionClosableOverlay,
  SessionClosableOverlayType,
} from './SessionClosableOverlay';
import { MainViewController } from '../MainViewController';

export interface Props {
  searchTerm: string;
  isSecondaryDevice: boolean;

  conversations: Array<ConversationListItemPropsType>;
  contacts: Array<ConversationType>;

  searchResults?: SearchResultsProps;

  updateSearchTerm: (searchTerm: string) => void;
  search: (query: string, options: SearchOptions) => void;
  openConversationInternal: (id: string, messageId?: string) => void;
  clearSearch: () => void;
}

interface State {
  showAddContactView: boolean;
  selectedTab: number;
  addContactRecipientID: string;
  pubKeyPasted: string;
}

export class LeftPaneContactSection extends React.Component<Props, State> {
  private readonly debouncedSearch: (searchTerm: string) => void;

  public constructor(props: Props) {
    super(props);
    this.state = {
      showAddContactView: false,
      selectedTab: 0,
      addContactRecipientID: '',
      pubKeyPasted: '',
    };

    this.debouncedSearch = debounce(this.search.bind(this), 20);
    this.handleTabSelected = this.handleTabSelected.bind(this);
    this.handleToggleOverlay = this.handleToggleOverlay.bind(this);
    this.handleOnAddContact = this.handleOnAddContact.bind(this);
    this.handleRecipientSessionIDChanged = this.handleRecipientSessionIDChanged.bind(
      this
    );
  }

  public componentWillUnmount() {
    this.updateSearch('');
    this.setState({ addContactRecipientID: '' });
  }

  public handleTabSelected(tabType: number) {
    this.setState({ selectedTab: tabType, showAddContactView: false });
  }

  public renderHeader(): JSX.Element | undefined {
    const labels = [window.i18n('contactsHeader')];

    return LeftPane.RENDER_HEADER(
      labels,
      this.handleTabSelected,
      undefined,
      undefined,
      undefined,
      undefined
    );
  }

  public componentDidMount() {
    MainViewController.renderMessageView();
  }

  public componentDidUpdate() {
    MainViewController.renderMessageView();
  }

  public render(): JSX.Element {
    return (
      <div className="left-pane-contact-section">
        {this.renderHeader()}
        {this.state.showAddContactView
          ? this.renderClosableOverlay()
          : this.renderContacts()}
      </div>
    );
  }


  public renderRow = ({
    index,
    key,
    style,
  }: RowRendererParamsType): JSX.Element | undefined => {
    const contacts = this.getDirectContactsOnly();
    const item = contacts[index];

    return (
      <ConversationListItem
        key={key}
        style={style}
        {...item}
        i18n={window.i18n}
        onClick={this.props.openConversationInternal}
      />
    );
  };

  public updateSearch(searchTerm: string) {
    const { updateSearchTerm, clearSearch } = this.props;

    if (!searchTerm) {
      clearSearch();

      return;
    }

    this.setState({ pubKeyPasted: '' });

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

  private renderClosableOverlay() {
    return (
      <SessionClosableOverlay
        overlayMode={SessionClosableOverlayType.Contact}
        onChangeSessionID={this.handleRecipientSessionIDChanged}
        onCloseClick={this.handleToggleOverlay}
        onButtonClick={this.handleOnAddContact}
      />
    );
  }

  private handleToggleOverlay() {
    this.setState((prevState: { showAddContactView: boolean }) => ({
      showAddContactView: !prevState.showAddContactView,
    }));
  }


  private handleOnAddContact() {
    const sessionID = this.state.addContactRecipientID.trim();
    const error = validateNumber(sessionID, window.i18n);

    if (error) {
      window.pushToast({
        title: error,
        type: 'error',
        id: 'addContact',
      });
    } else {
      window.Whisper.events.trigger('showConversation', sessionID);
    }
  }

  private handleRecipientSessionIDChanged(value: string) {
    this.setState({ addContactRecipientID: value });
  }

  private renderContacts() {
    return (
      <div className="left-pane-contact-content">
        {this.renderList()}
        {this.renderBottomButtons()}
      </div>
    );
  }

  private renderBottomButtons(): JSX.Element {
    const { selectedTab } = this.state;
    const edit = window.i18n('edit');
    const addContact = window.i18n('addContact');
    const createGroup = window.i18n('createGroup');
    const showEditButton = false;

    return (
      <div className="left-pane-contact-bottom-buttons">
        {showEditButton && (
          <SessionButton
            text={edit}
            buttonType={SessionButtonType.SquareOutline}
            buttonColor={SessionButtonColor.White}
          />
        )}
        {selectedTab === 0 ? (
          <SessionButton
            text={addContact}
            buttonType={SessionButtonType.SquareOutline}
            buttonColor={SessionButtonColor.Green}
            onClick={this.handleToggleOverlay}
          />
        ) : (
          <SessionButton
            text={createGroup}
            buttonType={SessionButtonType.SquareOutline}
            buttonColor={SessionButtonColor.Green}
            onClick={this.handleToggleOverlay}
          />
        )}
      </div>
    );
  }

  private getDirectContactsOnly() {
    return this.props.contacts.filter(f => f.type === 'direct');
  }

  private renderList() {
    const contacts = this.getDirectContactsOnly();
    const length = Number(contacts.length);

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
}

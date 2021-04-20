import React from 'react';

import { ConversationListItemWithDetails } from '../ConversationListItem';
import { RowRendererParamsType } from '../LeftPane';
import {
  SessionButton,
  SessionButtonColor,
  SessionButtonType,
} from './SessionButton';
import { AutoSizer, List } from 'react-virtualized';
import { ConversationType as ReduxConversationType } from '../../state/ducks/conversations';
import {
  SessionClosableOverlay,
  SessionClosableOverlayType,
} from './SessionClosableOverlay';
import { ToastUtils } from '../../session/utils';
import { DefaultTheme } from 'styled-components';
import { LeftPaneSectionHeader } from './LeftPaneSectionHeader';
import { ConversationController } from '../../session/conversations';
import { PubKey } from '../../session/types';
import { ConversationType } from '../../models/conversation';

export interface Props {
  directContacts: Array<ReduxConversationType>;
  theme: DefaultTheme;
  openConversationExternal: (id: string, messageId?: string) => void;
}

interface State {
  showAddContactView: boolean;
  addContactRecipientID: string;
  pubKeyPasted: string;
}

export class LeftPaneContactSection extends React.Component<Props, State> {
  public constructor(props: Props) {
    super(props);
    this.state = {
      showAddContactView: false,
      addContactRecipientID: '',
      pubKeyPasted: '',
    };

    this.handleToggleOverlay = this.handleToggleOverlay.bind(this);
    this.handleOnAddContact = this.handleOnAddContact.bind(this);
    this.handleRecipientSessionIDChanged = this.handleRecipientSessionIDChanged.bind(
      this
    );
    this.closeOverlay = this.closeOverlay.bind(this);
  }

  public componentDidMount() {
    window.Whisper.events.on('calculatingPoW', this.closeOverlay);
  }

  public componentWillUnmount() {
    this.setState({ addContactRecipientID: '' });
    window.Whisper.events.off('calculatingPoW', this.closeOverlay);
  }

  public renderHeader(): JSX.Element | undefined {
    return (
      <LeftPaneSectionHeader
        label={window.i18n('contactsHeader')}
        theme={this.props.theme}
      />
    );
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
    const { directContacts } = this.props;
    const item = directContacts[index];

    return (
      <ConversationListItemWithDetails
        key={item.id}
        style={style}
        {...item}
        i18n={window.i18n}
        onClick={this.props.openConversationExternal}
      />
    );
  };

  private renderClosableOverlay() {
    return (
      <SessionClosableOverlay
        overlayMode={SessionClosableOverlayType.Contact}
        onChangeSessionID={this.handleRecipientSessionIDChanged}
        onCloseClick={this.handleToggleOverlay}
        onButtonClick={this.handleOnAddContact}
        theme={this.props.theme}
      />
    );
  }

  private closeOverlay({ pubKey }: { pubKey: string }) {
    if (this.state.addContactRecipientID === pubKey) {
      this.setState({ showAddContactView: false, addContactRecipientID: '' });
    }
  }

  private handleToggleOverlay() {
    this.setState((prevState: { showAddContactView: boolean }) => ({
      showAddContactView: !prevState.showAddContactView,
    }));
  }

  private handleOnAddContact() {
    const sessionID = this.state.addContactRecipientID.trim();
    const error = PubKey.validateWithError(sessionID, window.i18n);

    if (error) {
      ToastUtils.pushToastError('addContact', error);
    } else {
      void ConversationController.getInstance()
        .getOrCreateAndWait(sessionID, ConversationType.PRIVATE)
        .then(() => {
          this.props.openConversationExternal(sessionID);
        });
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
    const addContact = window.i18n('addContact');

    return (
      <div className="left-pane-contact-bottom-buttons">
        <SessionButton
          text={addContact}
          buttonType={SessionButtonType.SquareOutline}
          buttonColor={SessionButtonColor.Green}
          onClick={this.handleToggleOverlay}
        />
      </div>
    );
  }

  private renderList() {
    const { directContacts } = this.props;
    const length = Number(directContacts.length);

    const list = (
      <div className="module-left-pane__list" key={0}>
        <AutoSizer>
          {({ height, width }) => (
            <List
              className="module-left-pane__virtual-list"
              height={height}
              directContacts={directContacts} // needed for change in props refresh
              rowCount={length}
              rowHeight={64}
              rowRenderer={this.renderRow}
              width={width}
              autoHeight={false}
            />
          )}
        </AutoSizer>
      </div>
    );

    return [list];
  }
}

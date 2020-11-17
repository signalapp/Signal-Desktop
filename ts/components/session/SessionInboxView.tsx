import React from 'react';
import { Provider } from 'react-redux';
import { bindActionCreators } from 'redux';
import { getMessageQueue } from '../../session';
import { createStore } from '../../state/createStore';
import { actions as conversationActions } from '../../state/ducks/conversations';
import { actions as userActions } from '../../state/ducks/user';
import { SmartLeftPane } from '../../state/smart/LeftPane';
import { SmartSessionConversation } from '../../state/smart/SessionConversation';
import {
  SessionSettingCategory,
  SettingsView,
} from './settings/SessionSettings';

// Workaround: A react component's required properties are filtering up through connect()
//   https://github.com/DefinitelyTyped/DefinitelyTyped/issues/31363
const FilteredLeftPane = SmartLeftPane as any;
const FilteredSessionConversation = SmartSessionConversation as any;

type Props = {
  focusedSection: number;
};

type State = {
  isInitialLoadComplete: boolean;
  settingsCategory?: SessionSettingCategory;
  isExpired: boolean;
};

// tslint:disable: react-a11y-img-has-alt

export class SessionInboxView extends React.Component<Props, State> {
  private store: any;

  constructor(props: any) {
    super(props);
    this.state = {
      isInitialLoadComplete: false,
      settingsCategory: undefined,
      isExpired: false,
    };

    this.fetchHandleMessageSentData = this.fetchHandleMessageSentData.bind(
      this
    );
    this.handleMessageSentFailure = this.handleMessageSentFailure.bind(this);
    this.handleMessageSentSuccess = this.handleMessageSentSuccess.bind(this);
    this.showSessionSettingsCategory = this.showSessionSettingsCategory.bind(
      this
    );
    this.showSessionViewConversation = this.showSessionViewConversation.bind(
      this
    );

    void this.setupLeftPane();

    // not reactified yet. this is a callback called once we were able to check for expiration of this Session version
    window.extension.expired((expired: boolean) => {
      if (expired) {
        this.setState({
          isExpired: true,
        });
      }
    });
  }

  public render() {
    if (!this.state.isInitialLoadComplete) {
      return <></>;
    }

    const { settingsCategory } = this.state;

    const isSettingsView = settingsCategory !== undefined;
    return (
      <Provider store={this.store}>
        <div className="gutter">
          <div className="network-status-container" />
          {this.renderLeftPane()}
        </div>
        {isSettingsView
          ? this.renderSettings()
          : this.renderSessionConversation()}
      </Provider>
    );
  }

  private renderLeftPane() {
    return (
      <FilteredLeftPane
        showSessionSettingsCategory={this.showSessionSettingsCategory}
        showSessionViewConversation={this.showSessionViewConversation}
        settingsCategory={this.state.settingsCategory}
        isExpired={this.state.isExpired}
      />
    );
  }

  private renderSettings() {
    const isSecondaryDevice = !!window.textsecure.storage.get(
      'isSecondaryDevice'
    );
    const category =
      this.state.settingsCategory || SessionSettingCategory.Appearance;

    return (
      <SettingsView isSecondaryDevice={isSecondaryDevice} category={category} />
    );
  }

  private renderSessionConversation() {
    return (
      <div className="session-conversation">
        <FilteredSessionConversation />
      </div>
    );
  }

  private async fetchHandleMessageSentData(m: any) {
    // nobody is listening to this freshly fetched message .trigger calls
    const tmpMsg = await window.Signal.Data.getMessageById(m.identifier, {
      Message: window.Whisper.Message,
    });

    if (!tmpMsg) {
      return null;
    }

    // find the corresponding conversation of this message
    const conv = window.ConversationController.get(
      tmpMsg.get('conversationId')
    );

    if (!conv) {
      return null;
    }

    const msg = window.MessageController._get()[m.identifier];

    if (!msg || !msg.message) {
      return null;
    }

    return { msg: msg.message };
  }

  private async handleMessageSentSuccess(
    sentMessage: any,
    wrappedEnvelope: any
  ) {
    const fetchedData = await this.fetchHandleMessageSentData(sentMessage);
    if (!fetchedData) {
      return;
    }
    const { msg } = fetchedData;

    msg.handleMessageSentSuccess(sentMessage, wrappedEnvelope);
  }

  private async handleMessageSentFailure(sentMessage: any, error: any) {
    const fetchedData = await this.fetchHandleMessageSentData(sentMessage);
    if (!fetchedData) {
      return;
    }
    const { msg } = fetchedData;

    await msg.handleMessageSentFailure(sentMessage, error);
  }

  private async setupLeftPane() {
    // Here we set up a full redux store with initial state for our LeftPane Root
    const convoCollection = window.getConversations();
    const conversations = convoCollection.map(
      (conversation: any) => conversation.cachedProps
    );

    const filledConversations = conversations.map(async (conv: any) => {
      const messages = await window.getMessagesByKey(conv.id);
      return { ...conv, messages };
    });

    const fullFilledConversations = await Promise.all(filledConversations);

    const initialState = {
      conversations: {
        conversationLookup: window.Signal.Util.makeLookup(
          fullFilledConversations,
          'id'
        ),
      },
      user: {
        regionCode: window.storage.get('regionCode'),
        ourNumber:
          window.storage.get('primaryDevicePubKey') ||
          window.textsecure.storage.user.getNumber(),
        isSecondaryDevice: !!window.storage.get('isSecondaryDevice'),
        i18n: window.i18n,
      },
      section: {
        focusedSection: 1,
      },
    };

    this.store = createStore(initialState);
    window.inboxStore = this.store;

    // Enables our redux store to be updated by backbone events in the outside world
    const {
      messageExpired,
      messageAdded,
      messageChanged,
      messageDeleted,
    } = bindActionCreators(conversationActions, this.store.dispatch);
    window.actionsCreators = conversationActions;
    const { userChanged } = bindActionCreators(
      userActions,
      this.store.dispatch
    );

    this.fetchHandleMessageSentData = this.fetchHandleMessageSentData.bind(
      this
    );
    this.handleMessageSentFailure = this.handleMessageSentFailure.bind(this);
    this.handleMessageSentSuccess = this.handleMessageSentSuccess.bind(this);

    getMessageQueue().events.addListener(
      'success',
      this.handleMessageSentSuccess
    );

    getMessageQueue().events.addListener('fail', this.handleMessageSentFailure);

    window.Whisper.events.on('messageExpired', messageExpired);
    window.Whisper.events.on('messageChanged', messageChanged);
    window.Whisper.events.on('messageAdded', messageAdded);
    window.Whisper.events.on('messageDeleted', messageDeleted);
    window.Whisper.events.on('userChanged', userChanged);

    this.setState({ isInitialLoadComplete: true });
  }

  private showSessionSettingsCategory(category: SessionSettingCategory) {
    this.setState({ settingsCategory: category });
  }

  private showSessionViewConversation() {
    this.setState({ settingsCategory: undefined });
  }
}

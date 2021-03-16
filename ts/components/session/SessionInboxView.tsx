import React from 'react';
import { Provider } from 'react-redux';
import { bindActionCreators } from 'redux';
import { ConversationModel } from '../../models/conversation';
import { ConversationController } from '../../session/conversations';
import { UserUtils } from '../../session/utils';
import { createStore } from '../../state/createStore';
import { actions as conversationActions } from '../../state/ducks/conversations';
import { makeLookup } from '../../util';
import { LeftPane } from '../LeftPane';
import { SessionMainPanel } from '../SessionMainPanel';

// Workaround: A react component's required properties are filtering up through connect()
//   https://github.com/DefinitelyTyped/DefinitelyTyped/issues/31363

type State = {
  isInitialLoadComplete: boolean;
  isExpired: boolean;
};

export class SessionInboxView extends React.Component<any, State> {
  private store: any;

  constructor(props: any) {
    super(props);
    this.state = {
      isInitialLoadComplete: false,
      isExpired: false,
    };

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

    return (
      <Provider store={this.store}>
        <div className="gutter">
          <div className="network-status-container" />
          {this.renderLeftPane()}
        </div>
        <SessionMainPanel />
      </Provider>
    );
  }

  private renderLeftPane() {
    return <LeftPane isExpired={this.state.isExpired} />;
  }

  private async setupLeftPane() {
    // Here we set up a full redux store with initial state for our LeftPane Root
    const convoCollection = ConversationController.getInstance().getConversations();
    const conversations = convoCollection.map(
      (conversation: ConversationModel) => conversation.getProps()
    );

    const filledConversations = conversations.map((conv: any) => {
      return { ...conv, messages: [] };
    });

    const fullFilledConversations = await Promise.all(filledConversations);

    const initialState = {
      conversations: {
        conversationLookup: makeLookup(fullFilledConversations, 'id'),
      },
      user: {
        ourPrimary: window.storage.get('primaryDevicePubKey'),
        ourNumber: UserUtils.getOurPubKeyStrFromCache(),
        i18n: window.i18n,
      },
      section: {
        focusedSection: 1,
      },
    };

    this.store = createStore(initialState);
    window.inboxStore = this.store;

    // Enables our redux store to be updated by backbone events in the outside world
    const { messageExpired } = bindActionCreators(
      conversationActions,
      this.store.dispatch
    );
    window.actionsCreators = conversationActions;

    // messageExpired is currently inboked fropm js. So we link it to Redux that way
    window.Whisper.events.on('messageExpired', messageExpired);

    this.setState({ isInitialLoadComplete: true });
  }
}

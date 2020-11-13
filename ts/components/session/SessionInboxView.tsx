import React from 'react';
import { Provider } from 'react-redux';
import { bindActionCreators } from 'redux';
import { getMessageQueue } from '../../session';
import { createStore } from '../../state/createStore';
import { StateType } from '../../state/reducer';
import { SmartLeftPane } from '../../state/smart/LeftPane';
import { SmartSessionConversation } from '../../state/smart/SessionConversation';
import { SessionSettingCategory, SettingsView } from './settings/SessionSettings';

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
};

// tslint:disable: react-a11y-img-has-alt


export class SessionInboxView extends React.Component<Props, State> {
    private store: any;

    constructor(props: any) {
        super(props);
        this.state = {
          isInitialLoadComplete: false,
          settingsCategory: undefined,
        };

        // Inbox
        const inboxCollection = window.getInboxCollection();
        this.fetchHandleMessageSentData = this.fetchHandleMessageSentData.bind(
            this
        );
        this.handleMessageSentFailure = this.handleMessageSentFailure.bind(this);
      this.handleMessageSentSuccess = this.handleMessageSentSuccess.bind(this);
      this.showSessionSettingsCategory = this.showSessionSettingsCategory.bind(this);
      this.showSessionViewConversation = this.showSessionViewConversation.bind(this);

        void this.setupLeftPane();

      // ConversationCollection
    //   this.listenTo(inboxCollection, 'messageError', () => {
        // if (this.networkStatusView) {
        //   this.networkStatusView.render();
        // }
    //   });

    // this.networkStatusView = new Whisper.NetworkStatusView();
    // this.$el
    //   .find('.network-status-container')
    //   .append(this.networkStatusView.render().el);

    // extension.expired(expired => {
    //   if (expired) {
    //     const banner = new Whisper.ExpiredAlertBanner().render();
    //     banner.$el.prependTo(this.$el);
    //     this.$el.addClass('expired');
    //   }
    // });
    }


    public render() {
        if (!this.state.isInitialLoadComplete) {
            return <></>;
        }

      const isSettingsView = this.state.settingsCategory !== undefined;
        return (
          <Provider store={this.store}>
              <div className="gutter">
              <div className="network-status-container"/>
              {this.renderLeftPane()}
            </div>
              {isSettingsView ? this.renderSettings() : this.renderSessionConversation()}
          </Provider>
      );    }

  private renderLeftPane() {
    return (
      <FilteredLeftPane
        showSessionSettingsCategory={this.showSessionSettingsCategory}
        showSessionViewConversation={this.showSessionViewConversation}
        settingsCategory={this.state.settingsCategory}
      />
    );
  }

  private renderSettings() {
    const isSecondaryDevice = !!window.textsecure.storage.get('isSecondaryDevice');
    const category = this.state.settingsCategory || SessionSettingCategory.Appearance;

    return (
      <SettingsView
        isSecondaryDevice={isSecondaryDevice}
        category={category}
      />
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

        // then, find in this conversation the very same message
        // const msg = conv.messageCollection.models.find(
        //   convMsg => convMsg.id === tmpMsg.id
        // );
        const msg = window.MessageController._get()[m.identifier];

        if (!msg || !msg.message) {
          return null;
        }

        return { msg: msg.message };
      }

      private async handleMessageSentSuccess(sentMessage: any, wrappedEnvelope: any) {
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
          conversationAdded,
          conversationChanged,
          conversationRemoved,
          removeAllConversations,
          messageExpired,
          openConversationExternal,
        } = bindActionCreators(
          window.Signal.State.Ducks.conversations.actions,
          this.store.dispatch
        );
        const { userChanged } = bindActionCreators(
          window.Signal.State.Ducks.user.actions,
          this.store.dispatch
        );
        const { messageChanged } = bindActionCreators(
          window.Signal.State.Ducks.messages.actions,
          this.store.dispatch
        );

        // this.openConversationAction = openConversationExternal;

        this.fetchHandleMessageSentData = this.fetchHandleMessageSentData.bind(
          this
        );
        this.handleMessageSentFailure = this.handleMessageSentFailure.bind(this);
        this.handleMessageSentSuccess = this.handleMessageSentSuccess.bind(this);

        // this.listenTo(convoCollection, 'remove', conversation => {
        //   const { id } = conversation || {};
        //   conversationRemoved(id);
        // });
        // this.listenTo(convoCollection, 'add', conversation => {
        //   const { id, cachedProps } = conversation || {};
        //   conversationAdded(id, cachedProps);
        // });
        // this.listenTo(convoCollection, 'change', conversation => {
        //   const { id, cachedProps } = conversation || {};
        //   conversationChanged(id, cachedProps);
        // });
        // this.listenTo(convoCollection, 'reset', removeAllConversations);

        getMessageQueue()
          .events.addListener('success', this.handleMessageSentSuccess);

        getMessageQueue()
          .events.addListener('fail', this.handleMessageSentFailure);

        window.Whisper.events.on('messageExpired', messageExpired);
        window.Whisper.events.on('messageChanged', messageChanged);
        window.Whisper.events.on('userChanged', userChanged);

        // Finally, add it to the DOM
        // this.$('.left-pane-placeholder').append(this.leftPaneView.el);
        this.setState({ isInitialLoadComplete: true });
      }

  private showSessionSettingsCategory(category: SessionSettingCategory) {
    this.setState({ settingsCategory: category });
  }

  private showSessionViewConversation() {
    this.setState({ settingsCategory: undefined });
  }
}

import React from 'react';
import { Provider } from 'react-redux';
import { LeftPane } from './leftpane/LeftPane';

// tslint:disable-next-line: no-submodule-imports
import { PersistGate } from 'redux-persist/integration/react';
import { persistStore } from 'redux-persist';
import { getConversationController } from '../session/conversations';
import { UserUtils } from '../session/utils';
import { initialCallState } from '../state/ducks/call';
import {
  getEmptyConversationState,
  openConversationWithMessages,
} from '../state/ducks/conversations';
import { initialDefaultRoomState } from '../state/ducks/defaultRooms';
import { initialModalState } from '../state/ducks/modalDialog';
import { initialOnionPathState } from '../state/ducks/onion';
import { initialSearchState } from '../state/ducks/search';
import { initialSectionState } from '../state/ducks/section';
import { getEmptyStagedAttachmentsState } from '../state/ducks/stagedAttachments';
import { initialThemeState } from '../state/ducks/theme';
import { TimerOptionsArray } from '../state/ducks/timerOptions';
import { initialUserConfigState } from '../state/ducks/userConfig';
import { StateType } from '../state/reducer';
import { makeLookup } from '../util';
import { SessionMainPanel } from './SessionMainPanel';
import { createStore } from '../state/createStore';
import { ExpirationTimerOptions } from '../util/expiringMessages';

// Workaround: A react component's required properties are filtering up through connect()
//   https://github.com/DefinitelyTyped/DefinitelyTyped/issues/31363

type State = {
  isInitialLoadComplete: boolean;
};

export class SessionInboxView extends React.Component<any, State> {
  private store: any;

  constructor(props: any) {
    super(props);
    this.state = {
      isInitialLoadComplete: false,
    };
  }

  public componentDidMount() {
    this.setupLeftPane();
  }

  public render() {
    if (!this.state.isInitialLoadComplete) {
      return null;
    }

    const persistor = persistStore(this.store);
    window.persistStore = persistor;

    return (
      <Provider store={this.store}>
        <PersistGate loading={null} persistor={persistor}>
          <div className="gutter">
            <div className="network-status-container" />
            {this.renderLeftPane()}
          </div>
          <SessionMainPanel />
        </PersistGate>
      </Provider>
    );
  }

  private renderLeftPane() {
    return <LeftPane />;
  }

  private setupLeftPane() {
    // Here we set up a full redux store with initial state for our LeftPane Root
    const conversations = getConversationController()
      .getConversations()
      .map(conversation => conversation.getConversationModelProps());

    const timerOptions: TimerOptionsArray = ExpirationTimerOptions.getTimerSecondsWithName();

    const initialState: StateType = {
      conversations: {
        ...getEmptyConversationState(),
        conversationLookup: makeLookup(conversations, 'id'),
      },
      user: {
        ourNumber: UserUtils.getOurPubKeyStrFromCache(),
      },
      section: initialSectionState,
      defaultRooms: initialDefaultRoomState,
      search: initialSearchState,
      theme: initialThemeState,
      onionPaths: initialOnionPathState,
      modals: initialModalState,
      userConfig: initialUserConfigState,
      timerOptions: {
        timerOptions,
      },
      stagedAttachments: getEmptyStagedAttachmentsState(),
      call: initialCallState,
    };

    this.store = createStore(initialState);
    window.inboxStore = this.store;

    window.openConversationWithMessages = openConversationWithMessages;

    this.setState({ isInitialLoadComplete: true });
  }
}

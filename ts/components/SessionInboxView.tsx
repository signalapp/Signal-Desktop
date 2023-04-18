import React, { useEffect } from 'react';
import { Provider } from 'react-redux';
import { LeftPane } from './leftpane/LeftPane';

// tslint:disable-next-line: no-submodule-imports
import { persistStore } from 'redux-persist';
import { PersistGate } from 'redux-persist/integration/react';
import { getConversationController } from '../session/conversations';
import { UserUtils } from '../session/utils';
import { createStore } from '../state/createStore';
import { initialCallState } from '../state/ducks/call';
import {
  getEmptyConversationState,
  openConversationWithMessages,
} from '../state/ducks/conversations';
import { initialDefaultRoomState } from '../state/ducks/defaultRooms';
import { initialModalState } from '../state/ducks/modalDialog';
import { initialOnionPathState } from '../state/ducks/onion';
import { initialPrimaryColorState } from '../state/ducks/primaryColor';
import { initialSearchState } from '../state/ducks/search';
import { initialSectionState } from '../state/ducks/section';
import { getEmptyStagedAttachmentsState } from '../state/ducks/stagedAttachments';
import { initialThemeState } from '../state/ducks/theme';
import { TimerOptionsArray } from '../state/ducks/timerOptions';
import { initialUserConfigState } from '../state/ducks/userConfig';
import { StateType } from '../state/reducer';
import { makeLookup } from '../util';
import { ExpirationTimerOptions } from '../util/expiringMessages';
import { SessionMainPanel } from './SessionMainPanel';

// moment does not support es-419 correctly (and cause white screen on app start)
import moment from 'moment';
import styled from 'styled-components';
import { initialSogsRoomInfoState } from '../state/ducks/sogsRoomInfo';

// Default to the locale from env. It will be overridden if moment
// does not recognize it with what moment knows which is the closest.
// i.e. es-419 will return 'es'.
// We just need to use what we got from moment in getLocale on the updateLocale below
moment.locale((window.i18n as any).getLocale());

// Workaround: A react component's required properties are filtering up through connect()
//   https://github.com/DefinitelyTyped/DefinitelyTyped/issues/31363
import useUpdate from 'react-use/lib/useUpdate';

const StyledGutter = styled.div`
  width: 380px !important;
  transition: none;
`;

function createSessionInboxStore() {
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
    primaryColor: initialPrimaryColorState,
    onionPaths: initialOnionPathState,
    modals: initialModalState,
    userConfig: initialUserConfigState,
    timerOptions: {
      timerOptions,
    },
    stagedAttachments: getEmptyStagedAttachmentsState(),
    call: initialCallState,
    sogsRoomInfo: initialSogsRoomInfoState,
  };

  return createStore(initialState);
}

function setupLeftPane(forceUpdateInboxComponent: () => void) {
  window.openConversationWithMessages = openConversationWithMessages;
  window.inboxStore = createSessionInboxStore();
  forceUpdateInboxComponent();
}

export const SessionInboxView = () => {
  const update = useUpdate();
  // run only on mount
  useEffect(() => setupLeftPane(update), []);

  if (!window.inboxStore) {
    return null;
  }

  const persistor = persistStore(window.inboxStore);
  window.persistStore = persistor;

  return (
    <div className="inbox index">
      <Provider store={window.inboxStore}>
        <PersistGate loading={null} persistor={persistor}>
          <StyledGutter>
            <LeftPane />
          </StyledGutter>
          <SessionMainPanel />
        </PersistGate>
      </Provider>
    </div>
  );
};

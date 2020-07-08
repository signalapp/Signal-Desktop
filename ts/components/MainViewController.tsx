import React from 'react';
import ReactDOM from 'react-dom';

import {
  SessionSettingCategory,
  SettingsView,
} from './session/settings/SessionSettings';

export const MainViewController = {
  joinChannelStateManager,
  createClosedGroup,
  renderMessageView,
  renderSettingsView,
};

import { ContactType } from './session/SessionMemberListItem';

export class MessageView extends React.Component {
  public render() {
    return (
      <div className="conversation-stack">
        <div className="conversation placeholder">
          <div className="conversation-header" />
          <div className="container">
            <div className="content">
              <img
                src="images/session/full-logo.svg"
                className="session-full-logo"
                alt="full-brand-logo"
              />
            </div>
          </div>
        </div>
      </div>
    );
  }
}

// /////////////////////////////////////
// //////////// Management /////////////
// /////////////////////////////////////

function joinChannelStateManager(
  thisRef: any,
  serverURL: string,
  onSuccess?: any
) {
  // Any component that uses this function MUST have the keys [loading, connectSuccess]
  // in their State

  // TODO: Make this not hard coded
  const channelId = 1;
  thisRef.setState({ loading: true });
  const connectionResult = window.attemptConnection(serverURL, channelId);

  // Give 5s maximum for promise to revole. Else, throw error.
  const connectionTimeout = setTimeout(() => {
    if (!thisRef.state.connectSuccess) {
      thisRef.setState({ loading: false });
      window.pushToast({
        title: window.i18n('connectToServerFail'),
        type: 'error',
        id: 'connectToServerFail',
      });

      return;
    }
  }, window.CONSTANTS.MAX_CONNECTION_DURATION);

  connectionResult
    .then(() => {
      clearTimeout(connectionTimeout);

      if (thisRef.state.loading) {
        thisRef.setState({
          connectSuccess: true,
          loading: false,
        });
        window.pushToast({
          title: window.i18n('connectToServerSuccess'),
          id: 'connectToServerSuccess',
          type: 'success',
        });

        if (onSuccess) {
          onSuccess();
        }
      }
    })
    .catch((connectionError: string) => {
      clearTimeout(connectionTimeout);
      thisRef.setState({
        connectSuccess: true,
        loading: false,
      });
      window.pushToast({
        title: connectionError,
        id: 'connectToServerFail',
        type: 'error',
      });

      return false;
    });

  return true;
}

async function createClosedGroup(
  groupName: string,
  groupMembers: Array<ContactType>,
  senderKeys: boolean,
  onSuccess: any
) {
  // Validate groupName and groupMembers length
  if (
    groupName.length === 0 ||
    groupName.length > window.CONSTANTS.MAX_GROUP_NAME_LENGTH
  ) {
    window.pushToast({
      title: window.i18n(
        'invalidGroupName',
        window.CONSTANTS.MAX_GROUP_NAME_LENGTH
      ),
      type: 'error',
      id: 'invalidGroupName',
    });

    return;
  }

  // >= because we add ourself as a member after this. so a 10 group is already invalid as it will be 11 with ourself
  if (
    groupMembers.length === 0 ||
    groupMembers.length >= window.CONSTANTS.SMALL_GROUP_SIZE_LIMIT
  ) {
    window.pushToast({
      title: window.i18n(
        'invalidGroupSize',
        window.CONSTANTS.SMALL_GROUP_SIZE_LIMIT
      ),
      type: 'error',
      id: 'invalidGroupSize',
    });

    return;
  }

  const groupMemberIds = groupMembers.map(m => m.id);

  if (senderKeys) {
    await window.createMediumSizeGroup(groupName, groupMemberIds);
  } else {
    await window.doCreateGroup(groupName, groupMemberIds);
  }

  if (onSuccess) {
    onSuccess();
  }

  return true;
}

// /////////////////////////////////////
// ///////////// Rendering /////////////
// /////////////////////////////////////

function renderMessageView() {
  if (document.getElementById('main-view')) {
    ReactDOM.render(<MessageView />, document.getElementById('main-view'));
  }
}

function renderSettingsView(category: SessionSettingCategory) {
  // tslint:disable-next-line: no-backbone-get-set-outside-model
  const isSecondaryDevice = !!window.textsecure.storage.get(
    'isSecondaryDevice'
  );
  if (document.getElementById('main-view')) {
    ReactDOM.render(
      <SettingsView
        category={category}
        isSecondaryDevice={isSecondaryDevice}
      />,
      document.getElementById('main-view')
    );
  }
}

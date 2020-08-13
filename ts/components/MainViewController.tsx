import React from 'react';
import ReactDOM from 'react-dom';

import {
  SessionSettingCategory,
  SettingsView,
} from './session/settings/SessionSettings';

import { createLegacyGroup, createMediumGroup } from '../session/medium_group';

export const MainViewController = {
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

async function createClosedGroup(
  groupName: string,
  groupMembers: Array<ContactType>,
  senderKeys: boolean,
  onSuccess: any
) {
  // Validate groupName and groupMembers length
  if (groupName.length === 0) {
    window.pushToast({
      title: window.i18n('invalidGroupNameTooShort'),
      type: 'error',
      id: 'invalidGroupName',
    });

    return;
  } else if (groupName.length > window.CONSTANTS.MAX_GROUP_NAME_LENGTH) {
    window.pushToast({
      title: window.i18n('invalidGroupNameTooLong'),
      type: 'error',
      id: 'invalidGroupName',
    });

    return;
  }

  // >= because we add ourself as a member AFTER this. so a 10 group is already invalid as it will be 11 with ourself
  // the same is valid with groups count <= 1

  if (groupMembers.length <= 1) {
    window.pushToast({
      title: window.i18n('pickClosedGroupMember'),
      type: 'error',
      id: 'pickClosedGroupMember',
    });

    return;
  } else if (groupMembers.length >= window.CONSTANTS.SMALL_GROUP_SIZE_LIMIT) {
    window.pushToast({
      title: window.i18n('closedGroupMaxSize'),
      type: 'error',
      id: 'closedGroupMaxSize',
    });

    return;
  }

  const groupMemberIds = groupMembers.map(m => m.id);

  if (senderKeys) {
    await createMediumGroup(groupName, groupMemberIds);
  } else {
    await createLegacyGroup(groupName, groupMemberIds);
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

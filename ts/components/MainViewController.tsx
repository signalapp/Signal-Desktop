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
import { ToastUtils } from '../session/utils';

export class MessageView extends React.Component {
  public render() {
    return (
      <div className="conversation-stack">
        <div className="conversation placeholder">
          <div className="conversation-header" />
          <div className="container">
            <div className="content session-full-logo">
              <img
                src="images/session/brand.svg"
                className="session-brand-logo"
                alt="full-brand-logo"
              />
              <img
                src="images/session/session-text.svg"
                className="session-text-logo"
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
  onSuccess: any
) {
  // Validate groupName and groupMembers length
  if (groupName.length === 0) {
    ToastUtils.pushToastError(
      'invalidGroupName',
      window.i18n('invalidGroupNameTooShort')
    );

    return;
  } else if (groupName.length > window.CONSTANTS.MAX_GROUP_NAME_LENGTH) {
    ToastUtils.pushToastError(
      'invalidGroupName',
      window.i18n('invalidGroupNameTooLong')
    );
    return;
  }

  // >= because we add ourself as a member AFTER this. so a 10 group is already invalid as it will be 11 with ourself
  // the same is valid with groups count < 1

  if (groupMembers.length < 1) {
    ToastUtils.pushToastError(
      'pickClosedGroupMember',
      window.i18n('pickClosedGroupMember')
    );
    return;
  } else if (groupMembers.length >= window.CONSTANTS.MEDIUM_GROUP_SIZE_LIMIT) {
    ToastUtils.pushToastError(
      'closedGroupMaxSize',
      window.i18n('closedGroupMaxSize')
    );
    return;
  }

  const groupMemberIds = groupMembers.map(m => m.id);

  if (window.lokiFeatureFlags.enableSenderKeys) {
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

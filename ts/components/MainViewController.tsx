import React from 'react';

import { ToastUtils } from '../session/utils';
import { createClosedGroup as createClosedGroupV2 } from '../receiver/closedGroups';
import { VALIDATION } from '../session/constants';

export class MessageView extends React.Component {
  public render() {
    return (
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
    );
  }
}

// /////////////////////////////////////
// //////////// Management /////////////
// /////////////////////////////////////

/**
 * Returns true if the group was indead created
 */
async function createClosedGroup(
  groupName: string,
  groupMemberIds: Array<string>
): Promise<boolean> {
  // Validate groupName and groupMembers length
  if (groupName.length === 0) {
    ToastUtils.pushToastError('invalidGroupName', window.i18n('invalidGroupNameTooShort'));

    return false;
  } else if (groupName.length > VALIDATION.MAX_GROUP_NAME_LENGTH) {
    ToastUtils.pushToastError('invalidGroupName', window.i18n('invalidGroupNameTooLong'));
    return false;
  }

  // >= because we add ourself as a member AFTER this. so a 10 group is already invalid as it will be 11 with ourself
  // the same is valid with groups count < 1

  if (groupMemberIds.length < 1) {
    ToastUtils.pushToastError('pickClosedGroupMember', window.i18n('pickClosedGroupMember'));
    return false;
  } else if (groupMemberIds.length >= VALIDATION.CLOSED_GROUP_SIZE_LIMIT) {
    ToastUtils.pushToastError('closedGroupMaxSize', window.i18n('closedGroupMaxSize'));
    return false;
  }

  await createClosedGroupV2(groupName, groupMemberIds);

  return true;
}

export const MainViewController = {
  createClosedGroup,
};

// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import type { LocalizerType } from '../../types/Util';

export type PropsType = {
  i18n: LocalizerType;
  onCancelJoinRequest: () => unknown;
};

export const GroupV2PendingApprovalActions = ({
  i18n,
  onCancelJoinRequest,
}: PropsType): JSX.Element => {
  return (
    <div className="module-group-v2-pending-approval-actions">
      <p className="module-group-v2-pending-approval-actions__message">
        {i18n('GroupV2--join--requested')}
      </p>
      <div className="module-group-v2-pending-approval-actions__buttons">
        <button
          type="button"
          onClick={onCancelJoinRequest}
          tabIndex={0}
          className="module-group-v2-pending-approval-actions__buttons__button"
        >
          {i18n('GroupV2--join--cancel-request-to-join')}
        </button>
      </div>
    </div>
  );
};

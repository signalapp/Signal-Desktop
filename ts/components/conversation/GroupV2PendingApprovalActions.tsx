// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import * as React from 'react';
import type { LocalizerType } from '../../types/Util.std.js';
import { ConfirmationDialog } from '../ConfirmationDialog.dom.js';

export type PropsType = {
  conversationId: string;
  i18n: LocalizerType;
  cancelJoinRequest: (conversationId: string) => unknown;
};

export function GroupV2PendingApprovalActions({
  cancelJoinRequest,
  conversationId,
  i18n,
}: PropsType): JSX.Element {
  const [isConfirming, setIsConfirming] = React.useState(false);

  return (
    <div className="module-group-v2-pending-approval-actions">
      <p className="module-group-v2-pending-approval-actions__message">
        {i18n('icu:GroupV2--join--requested')}
      </p>
      <div className="module-group-v2-pending-approval-actions__buttons">
        <button
          type="button"
          onClick={() => setIsConfirming(true)}
          tabIndex={0}
          className="module-group-v2-pending-approval-actions__buttons__button"
        >
          {i18n('icu:GroupV2--join--cancel-request-to-join')}
        </button>
      </div>
      {isConfirming ? (
        <ConfirmationDialog
          actions={[
            {
              text: i18n('icu:GroupV2--join--cancel-request-to-join--yes'),
              style: 'negative',
              action: () => cancelJoinRequest(conversationId),
            },
          ]}
          cancelText={i18n('icu:GroupV2--join--cancel-request-to-join--no')}
          dialogName="GroupV2CancelRequestToJoin"
          i18n={i18n}
          onClose={() => setIsConfirming(false)}
        >
          {i18n('icu:GroupV2--join--cancel-request-to-join--confirmation')}
        </ConfirmationDialog>
      ) : undefined}
    </div>
  );
}

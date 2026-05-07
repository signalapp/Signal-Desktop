// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useState, type JSX } from 'react';
import type { LocalizerType } from '../../types/Util.std.ts';
import { AxoConfirmDialog } from '../../axo/AxoConfirmDialog.dom.tsx';

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
  const [isConfirming, setIsConfirming] = useState(false);

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
      <AxoConfirmDialog.Root
        open={isConfirming}
        onOpenChange={setIsConfirming}
        // @ts-expect-error ConfirmationDialog migration: Needs title
        title={null}
        description={i18n(
          'icu:GroupV2--join--cancel-request-to-join--confirmation'
        )}
      >
        <AxoConfirmDialog.Cancel>
          {i18n('icu:GroupV2--join--cancel-request-to-join--no')}
        </AxoConfirmDialog.Cancel>
        <AxoConfirmDialog.Action
          variant="destructive"
          onClick={() => cancelJoinRequest(conversationId)}
        >
          {i18n('icu:GroupV2--join--cancel-request-to-join--yes')}
        </AxoConfirmDialog.Action>
      </AxoConfirmDialog.Root>
    </div>
  );
}

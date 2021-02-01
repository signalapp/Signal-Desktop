// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

import { LocalizerType } from '../../../types/Util';
import { ConfirmationModal } from '../../ConfirmationModal';

import { PanelRow } from './PanelRow';
import { PanelSection } from './PanelSection';
import { ConversationDetailsIcon } from './ConversationDetailsIcon';

export type Props = {
  conversationTitle: string;
  onBlockAndDelete: () => void;
  onDelete: () => void;
  i18n: LocalizerType;
};

export const ConversationDetailsActions: React.ComponentType<Props> = ({
  conversationTitle,
  onBlockAndDelete,
  onDelete,
  i18n,
}) => {
  const [confirmingLeave, setConfirmingLeave] = React.useState<boolean>(false);
  const [confirmingBlock, setConfirmingBlock] = React.useState<boolean>(false);

  return (
    <>
      <PanelSection>
        <PanelRow
          onClick={() => setConfirmingLeave(true)}
          icon={
            <ConversationDetailsIcon
              ariaLabel={i18n('ConversationDetailsActions--leave-group')}
              icon="leave"
            />
          }
          label={
            <div className="module-conversation-details__leave-group">
              {i18n('ConversationDetailsActions--leave-group')}
            </div>
          }
        />
        <PanelRow
          onClick={() => setConfirmingBlock(true)}
          icon={
            <ConversationDetailsIcon
              ariaLabel={i18n('ConversationDetailsActions--block-group')}
              icon="block"
            />
          }
          label={
            <div className="module-conversation-details__block-group">
              {i18n('ConversationDetailsActions--block-group')}
            </div>
          }
        />
      </PanelSection>

      {confirmingLeave && (
        <ConfirmationModal
          actions={[
            {
              text: i18n(
                'ConversationDetailsActions--leave-group-modal-confirm'
              ),
              action: onDelete,
              style: 'affirmative',
            },
          ]}
          i18n={i18n}
          onClose={() => setConfirmingLeave(false)}
          title={i18n('ConversationDetailsActions--leave-group-modal-title')}
        >
          {i18n('ConversationDetailsActions--leave-group-modal-content')}
        </ConfirmationModal>
      )}

      {confirmingBlock && (
        <ConfirmationModal
          actions={[
            {
              text: i18n(
                'ConversationDetailsActions--block-group-modal-confirm'
              ),
              action: onBlockAndDelete,
              style: 'affirmative',
            },
          ]}
          i18n={i18n}
          onClose={() => setConfirmingBlock(false)}
          title={i18n('ConversationDetailsActions--block-group-modal-title', [
            conversationTitle,
          ])}
        >
          {i18n('ConversationDetailsActions--block-group-modal-content')}
        </ConfirmationModal>
      )}
    </>
  );
};

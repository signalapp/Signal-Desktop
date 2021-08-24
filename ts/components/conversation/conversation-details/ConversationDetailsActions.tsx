// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';
import classNames from 'classnames';

import { LocalizerType } from '../../../types/Util';
import { ConfirmationDialog } from '../../ConfirmationDialog';
import { Tooltip, TooltipPlacement } from '../../Tooltip';

import { PanelRow } from './PanelRow';
import { PanelSection } from './PanelSection';
import { ConversationDetailsIcon } from './ConversationDetailsIcon';

export type Props = {
  cannotLeaveBecauseYouAreLastAdmin: boolean;
  conversationTitle: string;
  onBlock: () => void;
  onLeave: () => void;
  i18n: LocalizerType;
};

export const ConversationDetailsActions: React.ComponentType<Props> = ({
  cannotLeaveBecauseYouAreLastAdmin,
  conversationTitle,
  onBlock,
  onLeave,
  i18n,
}) => {
  const [confirmingLeave, setConfirmingLeave] = React.useState<boolean>(false);
  const [confirmingBlock, setConfirmingBlock] = React.useState<boolean>(false);

  let leaveGroupNode = (
    <PanelRow
      disabled={cannotLeaveBecauseYouAreLastAdmin}
      onClick={() => setConfirmingLeave(true)}
      icon={
        <ConversationDetailsIcon
          ariaLabel={i18n('ConversationDetailsActions--leave-group')}
          disabled={cannotLeaveBecauseYouAreLastAdmin}
          icon="leave"
        />
      }
      label={
        <div
          className={classNames(
            'module-conversation-details__leave-group',
            cannotLeaveBecauseYouAreLastAdmin &&
              'module-conversation-details__leave-group--disabled'
          )}
        >
          {i18n('ConversationDetailsActions--leave-group')}
        </div>
      }
    />
  );
  if (cannotLeaveBecauseYouAreLastAdmin) {
    leaveGroupNode = (
      <Tooltip
        content={i18n(
          'ConversationDetailsActions--leave-group-must-choose-new-admin'
        )}
        direction={TooltipPlacement.Top}
      >
        {leaveGroupNode}
      </Tooltip>
    );
  }

  return (
    <>
      <PanelSection>
        {leaveGroupNode}
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
        <ConfirmationDialog
          actions={[
            {
              text: i18n(
                'ConversationDetailsActions--leave-group-modal-confirm'
              ),
              action: onLeave,
              style: 'affirmative',
            },
          ]}
          i18n={i18n}
          onClose={() => setConfirmingLeave(false)}
          title={i18n('ConversationDetailsActions--leave-group-modal-title')}
        >
          {i18n('ConversationDetailsActions--leave-group-modal-content')}
        </ConfirmationDialog>
      )}

      {confirmingBlock && (
        <ConfirmationDialog
          actions={[
            {
              text: i18n(
                'ConversationDetailsActions--block-group-modal-confirm'
              ),
              action: onBlock,
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
        </ConfirmationDialog>
      )}
    </>
  );
};

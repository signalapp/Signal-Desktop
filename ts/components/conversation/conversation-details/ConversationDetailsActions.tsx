// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from 'react';
import React, { useState } from 'react';
import classNames from 'classnames';

import type { LocalizerType } from '../../../types/Util';
import { ConfirmationDialog } from '../../ConfirmationDialog';
import { Tooltip, TooltipPlacement } from '../../Tooltip';

import { PanelRow } from './PanelRow';
import { PanelSection } from './PanelSection';
import { ConversationDetailsIcon, IconType } from './ConversationDetailsIcon';

export type Props = {
  cannotLeaveBecauseYouAreLastAdmin: boolean;
  conversationTitle: string;
  i18n: LocalizerType;
  isBlocked: boolean;
  isGroup: boolean;
  left: boolean;
  onBlock: () => void;
  onLeave: () => void;
  onUnblock: () => void;
};

export const ConversationDetailsActions: React.ComponentType<Props> = ({
  cannotLeaveBecauseYouAreLastAdmin,
  conversationTitle,
  i18n,
  isBlocked,
  isGroup,
  left,
  onBlock,
  onLeave,
  onUnblock,
}) => {
  const [confirmLeave, gLeave] = useState<boolean>(false);
  const [confirmGroupBlock, gGroupBlock] = useState<boolean>(false);
  const [confirmGroupUnblock, gGroupUnblock] = useState<boolean>(false);
  const [confirmDirectBlock, gDirectBlock] = useState<boolean>(false);
  const [confirmDirectUnblock, gDirectUnblock] = useState<boolean>(false);

  let leaveGroupNode: ReactNode;
  if (isGroup && !left) {
    leaveGroupNode = (
      <PanelRow
        disabled={cannotLeaveBecauseYouAreLastAdmin}
        onClick={() => gLeave(true)}
        icon={
          <ConversationDetailsIcon
            ariaLabel={i18n('ConversationDetailsActions--leave-group')}
            disabled={cannotLeaveBecauseYouAreLastAdmin}
            icon={IconType.leave}
          />
        }
        label={
          <div
            className={classNames(
              'ConversationDetails__leave-group',
              cannotLeaveBecauseYouAreLastAdmin &&
                'ConversationDetails__leave-group--disabled'
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
  }

  let blockNode: ReactNode;
  if (isGroup && !isBlocked) {
    blockNode = (
      <PanelRow
        disabled={cannotLeaveBecauseYouAreLastAdmin}
        onClick={() => gGroupBlock(true)}
        icon={
          <ConversationDetailsIcon
            ariaLabel={i18n('ConversationDetailsActions--block-group')}
            icon={IconType.block}
          />
        }
        label={
          <div className="ConversationDetails__block-group">
            {i18n('ConversationDetailsActions--block-group')}
          </div>
        }
      />
    );
  } else if (isGroup && isBlocked) {
    blockNode = (
      <PanelRow
        onClick={() => gGroupUnblock(true)}
        icon={
          <ConversationDetailsIcon
            ariaLabel={i18n('ConversationDetailsActions--unblock-group')}
            icon={IconType.unblock}
          />
        }
        label={
          <div className="ConversationDetails__unblock-group">
            {i18n('ConversationDetailsActions--unblock-group')}
          </div>
        }
      />
    );
  } else {
    const label = isBlocked
      ? i18n('MessageRequests--unblock')
      : i18n('MessageRequests--block');
    blockNode = (
      <PanelRow
        onClick={() => (isBlocked ? gDirectUnblock(true) : gDirectBlock(true))}
        icon={
          <ConversationDetailsIcon
            ariaLabel={label}
            icon={isBlocked ? IconType.unblock : IconType.block}
          />
        }
        label={
          <div
            className={
              isBlocked
                ? 'ConversationDetails__unblock-group'
                : 'ConversationDetails__block-group'
            }
          >
            {label}
          </div>
        }
      />
    );
  }

  if (cannotLeaveBecauseYouAreLastAdmin) {
    blockNode = (
      <Tooltip
        content={i18n(
          'ConversationDetailsActions--leave-group-must-choose-new-admin'
        )}
        direction={TooltipPlacement.Top}
      >
        {blockNode}
      </Tooltip>
    );
  }

  return (
    <>
      <PanelSection>
        {leaveGroupNode}
        {blockNode}
      </PanelSection>
      {confirmLeave && (
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
          onClose={() => gLeave(false)}
          title={i18n('ConversationDetailsActions--leave-group-modal-title')}
        >
          {i18n('ConversationDetailsActions--leave-group-modal-content')}
        </ConfirmationDialog>
      )}

      {confirmGroupBlock && (
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
          onClose={() => gGroupBlock(false)}
          title={i18n('ConversationDetailsActions--block-group-modal-title', [
            conversationTitle,
          ])}
        >
          {i18n('ConversationDetailsActions--block-group-modal-content')}
        </ConfirmationDialog>
      )}
      {confirmGroupUnblock && (
        <ConfirmationDialog
          actions={[
            {
              text: i18n(
                'ConversationDetailsActions--unblock-group-modal-confirm'
              ),
              action: onUnblock,
              style: 'affirmative',
            },
          ]}
          i18n={i18n}
          onClose={() => gGroupUnblock(false)}
          title={i18n('ConversationDetailsActions--unblock-group-modal-title', [
            conversationTitle,
          ])}
        >
          {i18n('ConversationDetailsActions--unblock-group-modal-content')}
        </ConfirmationDialog>
      )}

      {confirmDirectBlock && (
        <ConfirmationDialog
          actions={[
            {
              text: i18n('MessageRequests--block'),
              action: onBlock,
              style: 'affirmative',
            },
          ]}
          i18n={i18n}
          onClose={() => gDirectBlock(false)}
          title={i18n('MessageRequests--block-direct-confirm-title', [
            conversationTitle,
          ])}
        >
          {i18n('MessageRequests--block-direct-confirm-body')}
        </ConfirmationDialog>
      )}
      {confirmDirectUnblock && (
        <ConfirmationDialog
          actions={[
            {
              text: i18n('MessageRequests--unblock'),
              action: onUnblock,
              style: 'affirmative',
            },
          ]}
          i18n={i18n}
          onClose={() => gDirectUnblock(false)}
          title={i18n('MessageRequests--unblock-direct-confirm-title', [
            conversationTitle,
          ])}
        >
          {i18n('MessageRequests--unblock-direct-confirm-body')}
        </ConfirmationDialog>
      )}
    </>
  );
};

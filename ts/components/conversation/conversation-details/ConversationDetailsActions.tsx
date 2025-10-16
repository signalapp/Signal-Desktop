// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from 'react';
import React, { useState } from 'react';
import classNames from 'classnames';

import type { LocalizerType } from '../../../types/Util.std.js';
import { ConfirmationDialog } from '../../ConfirmationDialog.dom.js';
import { Tooltip, TooltipPlacement } from '../../Tooltip.dom.js';

import { PanelRow } from './PanelRow.dom.js';
import { PanelSection } from './PanelSection.dom.js';
import {
  ConversationDetailsIcon,
  IconType,
} from './ConversationDetailsIcon.dom.js';

export type Props = {
  acceptConversation: (id: string) => void;
  blockConversation: (id: string) => void;
  cannotLeaveBecauseYouAreLastAdmin: boolean;
  conversationId: string;
  conversationTitle: string;
  i18n: LocalizerType;
  isBlocked: boolean;
  isGroup: boolean;
  left: boolean;
  onLeave: () => void;
};

export function ConversationDetailsActions({
  acceptConversation,
  blockConversation,
  cannotLeaveBecauseYouAreLastAdmin,
  conversationId,
  conversationTitle,
  i18n,
  isBlocked,
  isGroup,
  left,
  onLeave,
}: Props): JSX.Element {
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
            ariaLabel={i18n('icu:ConversationDetailsActions--leave-group')}
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
            {i18n('icu:ConversationDetailsActions--leave-group')}
          </div>
        }
      />
    );
    if (cannotLeaveBecauseYouAreLastAdmin) {
      leaveGroupNode = (
        <Tooltip
          content={i18n(
            'icu:ConversationDetailsActions--leave-group-must-choose-new-admin'
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
            ariaLabel={i18n('icu:ConversationDetailsActions--block-group')}
            icon={IconType.block}
          />
        }
        label={
          <div className="ConversationDetails__block-group">
            {i18n('icu:ConversationDetailsActions--block-group')}
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
            ariaLabel={i18n('icu:ConversationDetailsActions--unblock-group')}
            icon={IconType.unblock}
          />
        }
        label={
          <div className="ConversationDetails__unblock-group">
            {i18n('icu:ConversationDetailsActions--unblock-group')}
          </div>
        }
      />
    );
  } else {
    const label = isBlocked
      ? i18n('icu:MessageRequests--unblock')
      : i18n('icu:MessageRequests--block');
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
          'icu:ConversationDetailsActions--leave-group-must-choose-new-admin'
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
          dialogName="ConversationDetailsAction.confirmLeave"
          actions={[
            {
              text: i18n(
                'icu:ConversationDetailsActions--leave-group-modal-confirm'
              ),
              action: onLeave,
              style: 'affirmative',
            },
          ]}
          i18n={i18n}
          onClose={() => gLeave(false)}
          title={i18n(
            'icu:ConversationDetailsActions--leave-group-modal-title'
          )}
        >
          {i18n('icu:ConversationDetailsActions--leave-group-modal-content')}
        </ConfirmationDialog>
      )}

      {confirmGroupBlock && (
        <ConfirmationDialog
          dialogName="ConversationDetailsAction.confirmBlock"
          actions={[
            {
              text: i18n(
                'icu:ConversationDetailsActions--block-group-modal-confirm'
              ),
              action: () => blockConversation(conversationId),
              style: 'affirmative',
            },
          ]}
          i18n={i18n}
          onClose={() => gGroupBlock(false)}
          title={i18n(
            'icu:ConversationDetailsActions--block-group-modal-title',
            {
              groupName: conversationTitle,
            }
          )}
        >
          {i18n('icu:ConversationDetailsActions--block-group-modal-content')}
        </ConfirmationDialog>
      )}
      {confirmGroupUnblock && (
        <ConfirmationDialog
          dialogName="ConversationDetailsAction.confirmUnblock"
          actions={[
            {
              text: i18n(
                'icu:ConversationDetailsActions--unblock-group-modal-confirm'
              ),
              action: () => acceptConversation(conversationId),
              style: 'affirmative',
            },
          ]}
          i18n={i18n}
          onClose={() => gGroupUnblock(false)}
          title={i18n(
            'icu:ConversationDetailsActions--unblock-group-modal-title',
            {
              groupName: conversationTitle,
            }
          )}
        >
          {i18n('icu:ConversationDetailsActions--unblock-group-modal-body')}
        </ConfirmationDialog>
      )}

      {confirmDirectBlock && (
        <ConfirmationDialog
          dialogName="ConversationDetailsAction.confirmDirectBlock"
          actions={[
            {
              text: i18n('icu:MessageRequests--block'),
              action: () => blockConversation(conversationId),
              style: 'affirmative',
            },
          ]}
          i18n={i18n}
          onClose={() => gDirectBlock(false)}
          title={i18n('icu:MessageRequests--block-direct-confirm-title', {
            title: conversationTitle,
          })}
        >
          {i18n('icu:MessageRequests--block-direct-confirm-body')}
        </ConfirmationDialog>
      )}
      {confirmDirectUnblock && (
        <ConfirmationDialog
          dialogName="ConversationDetailsAction.confirmDirectUnblock"
          actions={[
            {
              text: i18n('icu:MessageRequests--unblock'),
              action: () => acceptConversation(conversationId),
              style: 'affirmative',
            },
          ]}
          i18n={i18n}
          onClose={() => gDirectUnblock(false)}
          title={i18n('icu:MessageRequests--unblock-direct-confirm-title', {
            name: conversationTitle,
          })}
        >
          {i18n('icu:MessageRequests--unblock-direct-confirm-body')}
        </ConfirmationDialog>
      )}
    </>
  );
}

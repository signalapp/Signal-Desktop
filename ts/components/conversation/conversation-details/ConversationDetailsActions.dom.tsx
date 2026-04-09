// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode } from 'react';
import React, { useState } from 'react';
import classNames from 'classnames';

import type { LocalizerType } from '../../../types/Util.std.ts';
import { ConfirmationDialog } from '../../ConfirmationDialog.dom.tsx';
import { Tooltip, TooltipPlacement } from '../../Tooltip.dom.tsx';

import { PanelRow } from './PanelRow.dom.tsx';
import { PanelSection } from './PanelSection.dom.tsx';
import {
  ConversationDetailsIcon,
  IconType,
} from './ConversationDetailsIcon.dom.tsx';
import { DeleteMessagesConfirmationDialog } from '../../DeleteMessagesConfirmationDialog.dom.tsx';

export type Props = {
  acceptConversation: (id: string) => void;
  blockConversation: (id: string) => void;
  canTerminateGroup: boolean;
  cannotLeaveBecauseYouAreLastAdmin: boolean;
  conversationId: string;
  conversationTitle: string;
  i18n: LocalizerType;
  isArchived: boolean;
  isBlocked: boolean;
  isGroup: boolean;
  isGroupTerminated: boolean;
  isSignalConversation: boolean;
  left: boolean;
  onArchive: () => void;
  onDelete: () => void;
  onUnarchive: () => void;
  onLeave: () => void;
  onReportSpam: () => void;
  onReportSpamAndBlock: () => void;
  onTerminateGroup: () => void;
};

export function ConversationDetailsActions({
  acceptConversation,
  blockConversation,
  cannotLeaveBecauseYouAreLastAdmin,
  canTerminateGroup,
  conversationId,
  conversationTitle,
  i18n,
  isArchived,
  isBlocked,
  isGroup,
  isGroupTerminated,
  isSignalConversation,
  left,
  onArchive,
  onDelete,
  onUnarchive,
  onLeave,
  onReportSpamAndBlock,
  onReportSpam,
  onTerminateGroup,
}: Props): React.JSX.Element {
  const [confirmLeave, gLeave] = useState<boolean>(false);
  const [confirmGroupBlock, gGroupBlock] = useState<boolean>(false);
  const [confirmGroupUnblock, gGroupUnblock] = useState<boolean>(false);
  const [confirmDirectBlock, gDirectBlock] = useState<boolean>(false);
  const [confirmDirectUnblock, gDirectUnblock] = useState<boolean>(false);
  const [confirmReportSpam, gConfirmReportSpam] = useState<boolean>(false);
  const [promptTerminateGroup, gPromptTerminateGroup] =
    useState<boolean>(false);
  const [confirmTerminateGroup, gConfirmTerminateGroup] =
    useState<boolean>(false);
  const [confirmGroupDelete, gGroupDelete] = useState<boolean>(false);

  let leaveGroupNode: ReactNode;
  if (isGroup && !left && !isGroupTerminated) {
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
  if (isGroup && !isBlocked && !isGroupTerminated) {
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
  } else if (isGroup && isBlocked && !isGroupTerminated) {
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
  } else if (!isGroup) {
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

  let reportSpamNode: ReactNode;
  if (!isSignalConversation) {
    reportSpamNode = (
      <PanelRow
        onClick={() => gConfirmReportSpam(true)}
        icon={
          <ConversationDetailsIcon
            ariaLabel={i18n('icu:ConversationDetailsActions--report-spam')}
            icon={IconType.spam}
          />
        }
        label={
          <div className="ConversationDetails__report-spam">
            {i18n('icu:ConversationDetailsActions--report-spam')}
          </div>
        }
      />
    );
  }

  let terminateGroupNode: ReactNode;
  if (canTerminateGroup) {
    terminateGroupNode = (
      <PanelRow
        onClick={() => gPromptTerminateGroup(true)}
        icon={
          <ConversationDetailsIcon
            ariaLabel={i18n('icu:ConversationDetailsActions--terminate-group')}
            icon={IconType.terminate}
          />
        }
        label={
          <div className={classNames('ConversationDetails__terminate-group')}>
            {i18n('icu:ConversationDetailsActions--terminate-group')}
          </div>
        }
      />
    );
  }

  let archiveNode: ReactNode;
  if (isGroupTerminated) {
    if (isArchived) {
      archiveNode = (
        <PanelRow
          onClick={onUnarchive}
          icon={
            <ConversationDetailsIcon
              ariaLabel={i18n('icu:ConversationDetailsActions--unarchive')}
              icon={IconType.archive}
            />
          }
          label={
            <div className={classNames('ConversationDetails__unarchive')}>
              {i18n('icu:ConversationDetailsActions--unarchive')}
            </div>
          }
        />
      );
    } else {
      archiveNode = (
        <PanelRow
          onClick={onArchive}
          icon={
            <ConversationDetailsIcon
              ariaLabel={i18n('icu:ConversationDetailsActions--archive')}
              icon={IconType.archive}
            />
          }
          label={
            <div className={classNames('ConversationDetails__archive')}>
              {i18n('icu:ConversationDetailsActions--archive')}
            </div>
          }
        />
      );
    }
  }

  const deleteNode = isGroupTerminated ? (
    <PanelRow
      onClick={() => gGroupDelete(true)}
      icon={
        <ConversationDetailsIcon
          ariaLabel={i18n('icu:ConversationDetailsActions--delete')}
          icon={IconType.delete}
        />
      }
      label={
        <div className={classNames('ConversationDetails__delete')}>
          {i18n('icu:ConversationDetailsActions--delete')}
        </div>
      }
    />
  ) : null;

  return (
    <>
      <PanelSection>
        {leaveGroupNode}
        {blockNode}
        {archiveNode}
        {deleteNode}
        {reportSpamNode}
      </PanelSection>
      {terminateGroupNode && <PanelSection>{terminateGroupNode}</PanelSection>}
      {confirmLeave && (
        <ConfirmationDialog
          dialogName="ConversationDetailsAction.confirmLeave"
          actions={[
            {
              text: i18n(
                'icu:ConversationDetailsActions--leave-group-modal-confirm'
              ),
              action: onLeave,
              style: 'negative',
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
              style: 'negative',
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
              style: 'negative',
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
              style: 'negative',
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

      {confirmReportSpam && (
        <ConfirmationDialog
          dialogName="ConversationDetailsAction.confirmSpam"
          actions={[
            {
              text: i18n(
                'icu:ConversationDetailsActions--report-spam-modal-report-spam'
              ),
              action: onReportSpam,
              style: 'negative',
            },
            ...(isBlocked
              ? []
              : ([
                  {
                    text: i18n(
                      'icu:ConversationDetailsActions--report-spam-modal-report-and-block'
                    ),
                    action: onReportSpamAndBlock,
                    style: 'negative',
                  },
                ] as const)),
          ]}
          i18n={i18n}
          onClose={() => gConfirmReportSpam(false)}
          title={i18n('icu:MessageRequests--ReportAndMaybeBlockModal-title')}
        >
          {isGroup
            ? i18n(
                'icu:ConversationDetailsActions--report-spam-modal-content-group'
              )
            : i18n(
                'icu:ConversationDetailsActions--report-spam-modal-content-direct'
              )}
        </ConfirmationDialog>
      )}

      {promptTerminateGroup && (
        <ConfirmationDialog
          dialogName="ConversationDetailsAction.promptTerminateGroup"
          actions={[
            {
              text: i18n(
                'icu:ConversationDetailsActions--terminate-group-modal-confirm'
              ),
              action: () => gConfirmTerminateGroup(true),
              style: 'negative',
            },
          ]}
          i18n={i18n}
          onClose={() => gPromptTerminateGroup(false)}
          title={i18n(
            'icu:ConversationDetailsActions--prompt-terminate-group-modal-title',
            {
              groupName: conversationTitle,
            }
          )}
        >
          {i18n(
            'icu:ConversationDetailsActions--prompt-terminate-group-modal-content'
          )}
        </ConfirmationDialog>
      )}

      {confirmTerminateGroup && (
        <ConfirmationDialog
          dialogName="ConversationDetailsAction.confirmTerminateGroup"
          actions={[
            {
              text: i18n(
                'icu:ConversationDetailsActions--terminate-group-modal-confirm'
              ),
              action: onTerminateGroup,
              style: 'negative',
            },
          ]}
          i18n={i18n}
          onClose={() => gConfirmTerminateGroup(false)}
        >
          {i18n(
            'icu:ConversationDetailsActions--confirm-terminate-group-confirm-modal-content'
          )}
        </ConfirmationDialog>
      )}

      {confirmGroupDelete && (
        <DeleteMessagesConfirmationDialog
          i18n={i18n}
          onDestroyMessages={() => {
            gGroupDelete(false);
            onDelete();
          }}
          onClose={() => {
            gGroupDelete(false);
          }}
        />
      )}
    </>
  );
}

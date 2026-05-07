// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { ReactNode, JSX } from 'react';
import { useState } from 'react';
import classNames from 'classnames';
import type { LocalizerType } from '../../../types/Util.std.ts';
import { Tooltip, TooltipPlacement } from '../../Tooltip.dom.tsx';
import { PanelRow } from './PanelRow.dom.tsx';
import { PanelSection } from './PanelSection.dom.tsx';
import {
  ConversationDetailsIcon,
  IconType,
} from './ConversationDetailsIcon.dom.tsx';
import { DeleteMessagesConfirmationDialog } from '../../DeleteMessagesConfirmationDialog.dom.tsx';
import { AxoConfirmDialog } from '../../../axo/AxoConfirmDialog.dom.tsx';

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
}: Props): JSX.Element {
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
      <AxoConfirmDialog.Root
        open={confirmLeave}
        onOpenChange={gLeave}
        title={i18n('icu:ConversationDetailsActions--leave-group-modal-title')}
        description={i18n(
          'icu:ConversationDetailsActions--leave-group-modal-content'
        )}
      >
        <AxoConfirmDialog.Cancel />
        <AxoConfirmDialog.Action variant="destructive" onClick={onLeave}>
          {i18n('icu:ConversationDetailsActions--leave-group-modal-confirm')}
        </AxoConfirmDialog.Action>
      </AxoConfirmDialog.Root>

      <AxoConfirmDialog.Root
        open={confirmGroupBlock}
        onOpenChange={gGroupBlock}
        title={i18n('icu:ConversationDetailsActions--block-group-modal-title', {
          groupName: conversationTitle,
        })}
        description={i18n(
          'icu:ConversationDetailsActions--block-group-modal-content'
        )}
      >
        <AxoConfirmDialog.Cancel />
        <AxoConfirmDialog.Action
          variant="destructive"
          onClick={() => blockConversation(conversationId)}
        >
          {i18n('icu:ConversationDetailsActions--block-group-modal-confirm')}
        </AxoConfirmDialog.Action>
      </AxoConfirmDialog.Root>

      <AxoConfirmDialog.Root
        open={confirmGroupUnblock}
        onOpenChange={gGroupUnblock}
        title={i18n(
          'icu:ConversationDetailsActions--unblock-group-modal-title',
          {
            groupName: conversationTitle,
          }
        )}
        description={i18n(
          'icu:ConversationDetailsActions--unblock-group-modal-body'
        )}
      >
        <AxoConfirmDialog.Cancel />
        <AxoConfirmDialog.Action
          variant="destructive"
          onClick={() => acceptConversation(conversationId)}
        >
          {i18n('icu:ConversationDetailsActions--unblock-group-modal-confirm')}
        </AxoConfirmDialog.Action>
      </AxoConfirmDialog.Root>

      <AxoConfirmDialog.Root
        open={confirmDirectBlock}
        onOpenChange={gDirectBlock}
        title={i18n('icu:MessageRequests--block-direct-confirm-title', {
          title: conversationTitle,
        })}
        description={i18n('icu:MessageRequests--block-direct-confirm-body')}
      >
        <AxoConfirmDialog.Cancel />
        <AxoConfirmDialog.Action
          variant="destructive"
          onClick={() => blockConversation(conversationId)}
        >
          {i18n('icu:MessageRequests--block')}
        </AxoConfirmDialog.Action>
      </AxoConfirmDialog.Root>

      <AxoConfirmDialog.Root
        open={confirmDirectUnblock}
        onOpenChange={gDirectUnblock}
        title={i18n('icu:MessageRequests--unblock-direct-confirm-title', {
          name: conversationTitle,
        })}
        description={i18n('icu:MessageRequests--unblock-direct-confirm-body')}
      >
        <AxoConfirmDialog.Cancel />
        <AxoConfirmDialog.Action
          variant="primary"
          onClick={() => acceptConversation(conversationId)}
        >
          {i18n('icu:MessageRequests--unblock')}
        </AxoConfirmDialog.Action>
      </AxoConfirmDialog.Root>

      <AxoConfirmDialog.Root
        open={confirmReportSpam}
        onOpenChange={gConfirmReportSpam}
        title={i18n('icu:MessageRequests--ReportAndMaybeBlockModal-title')}
        description={
          isGroup
            ? i18n(
                'icu:ConversationDetailsActions--report-spam-modal-content-group'
              )
            : i18n(
                'icu:ConversationDetailsActions--report-spam-modal-content-direct'
              )
        }
      >
        <AxoConfirmDialog.Cancel />
        <AxoConfirmDialog.Action variant="destructive" onClick={onReportSpam}>
          {i18n(
            'icu:ConversationDetailsActions--report-spam-modal-report-spam'
          )}
        </AxoConfirmDialog.Action>
        {!isBlocked && (
          <AxoConfirmDialog.Action
            variant="destructive"
            onClick={onReportSpamAndBlock}
          >
            {i18n(
              'icu:ConversationDetailsActions--report-spam-modal-report-and-block'
            )}
          </AxoConfirmDialog.Action>
        )}
      </AxoConfirmDialog.Root>

      <AxoConfirmDialog.Root
        open={promptTerminateGroup}
        onOpenChange={gPromptTerminateGroup}
        title={i18n(
          'icu:ConversationDetailsActions--prompt-terminate-group-modal-title',
          {
            groupName: conversationTitle,
          }
        )}
        description={i18n(
          'icu:ConversationDetailsActions--prompt-terminate-group-modal-content'
        )}
      >
        <AxoConfirmDialog.Cancel />
        <AxoConfirmDialog.Action
          variant="destructive"
          onClick={() => gConfirmTerminateGroup(true)}
        >
          {i18n(
            'icu:ConversationDetailsActions--terminate-group-modal-confirm'
          )}
        </AxoConfirmDialog.Action>
      </AxoConfirmDialog.Root>

      <AxoConfirmDialog.Root
        open={confirmTerminateGroup}
        onOpenChange={gConfirmTerminateGroup}
        // @ts-expect-error ConfirmationDialog migration: Needs title
        title={null}
        description={i18n(
          'icu:ConversationDetailsActions--confirm-terminate-group-confirm-modal-content'
        )}
      >
        <AxoConfirmDialog.Cancel />
        <AxoConfirmDialog.Action
          variant="destructive"
          onClick={onTerminateGroup}
        >
          {i18n(
            'icu:ConversationDetailsActions--terminate-group-modal-confirm'
          )}
        </AxoConfirmDialog.Action>
      </AxoConfirmDialog.Root>

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

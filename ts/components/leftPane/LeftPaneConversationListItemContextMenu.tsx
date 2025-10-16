// Copyright 2025 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { FC, ReactNode } from 'react';
import React, { memo, useCallback, useMemo, useState } from 'react';
import { AxoContextMenu } from '../../axo/AxoContextMenu.dom.js';
import type { LocalizerType } from '../../types/I18N.std.js';
import type { ConversationType } from '../../state/ducks/conversations.preload.js';
import { isConversationUnread } from '../../util/isConversationUnread.std.js';
import {
  Environment,
  getEnvironment,
  isMockEnvironment,
} from '../../environment.std.js';
import { isAlpha } from '../../util/version.std.js';
import { drop } from '../../util/drop.std.js';
import { DeleteMessagesConfirmationDialog } from '../DeleteMessagesConfirmationDialog.dom.js';
import { getMuteOptions } from '../../util/getMuteOptions.std.js';

function isEnabled() {
  const env = getEnvironment();

  if (
    env === Environment.Development ||
    env === Environment.Test ||
    isMockEnvironment()
  ) {
    return true;
  }

  const version = window.getVersion?.();

  if (version != null) {
    if (isAlpha(version)) {
      return true;
    }
  }

  return false;
}

export type LeftPaneConversationListItemContextMenuProps = Readonly<{
  i18n: LocalizerType;
  conversation: ConversationType;
  onMarkUnread: (conversationId: string) => void;
  onMarkRead: (conversationId: string) => void;
  onPin: (conversationId: string) => void;
  onUnpin: (conversationId: string) => void;
  onUpdateMute: (conversationId: string, muteExpiresAt: number) => void;
  onArchive: (conversationId: string) => void;
  onUnarchive: (conversationId: string) => void;
  onDelete: (conversationId: string) => void;
  localDeleteWarningShown: boolean;
  setLocalDeleteWarningShown: () => void;
  children: ReactNode;
}>;

export const LeftPaneConversationListItemContextMenu: FC<LeftPaneConversationListItemContextMenuProps> =
  memo(function ConversationListItemContextMenu(props) {
    const {
      i18n,
      conversation,
      onMarkUnread,
      onMarkRead,
      onPin,
      onUnpin,
      onUpdateMute,
      onArchive,
      onUnarchive,
      onDelete,
    } = props;

    const { id: conversationId, muteExpiresAt } = conversation;

    const muteOptions = useMemo(() => {
      return getMuteOptions(muteExpiresAt, i18n);
    }, [muteExpiresAt, i18n]);

    const [showConfirmDeleteDialog, setShowConfirmDeleteDialog] =
      useState(false);

    const handleOpenConfirmDeleteDialog = useCallback(() => {
      setShowConfirmDeleteDialog(true);
    }, []);

    const handleCloseConfirmDeleteDialog = useCallback(() => {
      setShowConfirmDeleteDialog(false);
    }, []);

    const isUnread = useMemo(() => {
      return isConversationUnread(conversation);
    }, [conversation]);

    const handleMarkUnread = useCallback(() => {
      onMarkUnread(conversationId);
    }, [onMarkUnread, conversationId]);

    const handleMarkRead = useCallback(() => {
      onMarkRead(conversationId);
    }, [onMarkRead, conversationId]);

    const handlePin = useCallback(() => {
      onPin(conversationId);
    }, [onPin, conversationId]);

    const handleUnpin = useCallback(() => {
      onUnpin(conversationId);
    }, [onUnpin, conversationId]);

    const handleUpdateMute = useCallback(
      (value: number) => {
        onUpdateMute(conversationId, value);
      },
      [onUpdateMute, conversationId]
    );

    const handleArchive = useCallback(() => {
      onArchive(conversationId);
    }, [onArchive, conversationId]);

    const handleUnarchive = useCallback(() => {
      onUnarchive(conversationId);
    }, [onUnarchive, conversationId]);

    const handleDelete = useCallback(() => {
      onDelete(conversationId);
    }, [onDelete, conversationId]);

    return (
      <>
        <AxoContextMenu.Root>
          <AxoContextMenu.Trigger>{props.children}</AxoContextMenu.Trigger>
          <AxoContextMenu.Content>
            {isUnread && (
              <AxoContextMenu.Item
                symbol="message-check"
                onSelect={handleMarkRead}
              >
                {i18n('icu:markRead')}
              </AxoContextMenu.Item>
            )}
            {!isUnread && !conversation.markedUnread && (
              <AxoContextMenu.Item
                symbol="message-badge"
                onSelect={handleMarkUnread}
              >
                {i18n('icu:markUnread')}
              </AxoContextMenu.Item>
            )}
            {!conversation.isPinned && (
              <AxoContextMenu.Item symbol="pin" onSelect={handlePin}>
                {i18n('icu:pinConversation')}
              </AxoContextMenu.Item>
            )}
            {conversation.isPinned && (
              <AxoContextMenu.Item symbol="pin-slash" onSelect={handleUnpin}>
                {i18n('icu:unpinConversation')}
              </AxoContextMenu.Item>
            )}
            <AxoContextMenu.Sub>
              <AxoContextMenu.SubTrigger symbol="bell-slash">
                {i18n('icu:muteNotificationsTitle')}
              </AxoContextMenu.SubTrigger>
              <AxoContextMenu.SubContent>
                {muteOptions.map(muteOption => {
                  return (
                    <ContextMenuMuteNotificationsItem
                      key={muteOption.value}
                      value={muteOption.value}
                      disabled={muteOption.disabled}
                      onSelect={handleUpdateMute}
                    >
                      {muteOption.name}
                    </ContextMenuMuteNotificationsItem>
                  );
                })}
              </AxoContextMenu.SubContent>
            </AxoContextMenu.Sub>
            {!conversation.isArchived && (
              <AxoContextMenu.Item symbol="archive" onSelect={handleArchive}>
                {i18n('icu:archiveConversation')}
              </AxoContextMenu.Item>
            )}
            {conversation.isArchived && (
              <AxoContextMenu.Item
                symbol="archive-up"
                onSelect={handleUnarchive}
              >
                {i18n('icu:moveConversationToInbox')}
              </AxoContextMenu.Item>
            )}
            <AxoContextMenu.Item
              symbol="trash"
              onSelect={handleOpenConfirmDeleteDialog}
            >
              {i18n('icu:deleteConversation')}
            </AxoContextMenu.Item>
            {isEnabled() && (
              <>
                <AxoContextMenu.Separator />
                <AxoContextMenu.Group>
                  <AxoContextMenu.Label>Internal</AxoContextMenu.Label>
                  <ContextMenuCopyTextItem value={conversation.id}>
                    Copy Conversation ID
                  </ContextMenuCopyTextItem>
                  {conversation.serviceId != null && (
                    <ContextMenuCopyTextItem value={conversation.serviceId}>
                      Copy Service ID
                    </ContextMenuCopyTextItem>
                  )}
                  {conversation.pni != null && (
                    <ContextMenuCopyTextItem value={conversation.pni}>
                      Copy PNI
                    </ContextMenuCopyTextItem>
                  )}
                  {conversation.groupId != null && (
                    <ContextMenuCopyTextItem value={conversation.groupId}>
                      Copy Group ID
                    </ContextMenuCopyTextItem>
                  )}
                  {conversation.e164 != null && (
                    <ContextMenuCopyTextItem value={conversation.e164}>
                      Copy E164
                    </ContextMenuCopyTextItem>
                  )}
                </AxoContextMenu.Group>
              </>
            )}
          </AxoContextMenu.Content>
        </AxoContextMenu.Root>
        {showConfirmDeleteDialog && (
          <DeleteMessagesConfirmationDialog
            i18n={i18n}
            localDeleteWarningShown={props.localDeleteWarningShown}
            onDestroyMessages={handleDelete}
            onClose={handleCloseConfirmDeleteDialog}
            setLocalDeleteWarningShown={props.setLocalDeleteWarningShown}
          />
        )}
      </>
    );
  });

function ContextMenuMuteNotificationsItem(props: {
  disabled?: boolean;
  value: number;
  onSelect: (value: number) => void;
  children: ReactNode;
}): JSX.Element {
  const { value, onSelect } = props;
  const handleSelect = useCallback(() => {
    onSelect(value);
  }, [onSelect, value]);
  return (
    <AxoContextMenu.Item disabled={props.disabled} onSelect={handleSelect}>
      {props.children}
    </AxoContextMenu.Item>
  );
}

function ContextMenuCopyTextItem(props: {
  value: string;
  children: ReactNode;
}): JSX.Element {
  const { value } = props;

  const handleSelect = useCallback((): void => {
    drop(window.navigator.clipboard.writeText(value));
  }, [value]);

  return (
    <AxoContextMenu.Item symbol="copy" onSelect={handleSelect}>
      {props.children}
    </AxoContextMenu.Item>
  );
}

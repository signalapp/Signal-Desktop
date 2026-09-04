// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import type { ReactNode } from 'react';
import { useState } from 'react';
import type { ConversationType } from '../../../state/ducks/conversations.preload.ts';
import type { LocalizerType } from '../../../types/Util.std.ts';
import { SignalService as Proto } from '../../../protobuf/index.std.ts';
import { copyGroupLink } from '../../../util/copyLinksWithToast.dom.ts';
import { drop } from '../../../util/drop.std.ts';
import { AxoConfirmDialog } from '../../../axo/AxoConfirmDialog.dom.tsx';
import { AxoContainer } from '../../../axo/AxoContainer.dom.tsx';
import { AxoList } from '../../../axo/items/AxoList.dom.tsx';
import { AxoItem } from '../../../axo/items/AxoItem.dom.tsx';
import { AxoSwitchItem } from '../../../axo/items/AxoSwitchItem.dom.tsx';
import { AxoClickableItem } from '../../../axo/items/AxoClickableItem.dom.tsx';

const AccessControlEnum = Proto.AccessControl.AccessRequired;

export type PropsDataType = {
  conversation?: ConversationType;
  i18n: LocalizerType;
  isAdmin: boolean;
};

export type PropsType = PropsDataType & {
  changeHasGroupLink: (conversationId: string, value: boolean) => unknown;
  generateNewGroupLink: (conversationId: string) => unknown;
  setAccessControlAddFromInviteLinkSetting: (
    conversationId: string,
    value: boolean
  ) => unknown;
};

export function GroupLinkManagement({
  changeHasGroupLink,
  conversation,
  generateNewGroupLink,
  i18n,
  isAdmin,
  setAccessControlAddFromInviteLinkSetting,
}: PropsType): ReactNode {
  if (conversation === undefined) {
    throw new Error('GroupLinkManagement rendered without a conversation');
  }

  const membersNeedAdminApproval =
    conversation.accessControlAddFromInviteLink ===
    AccessControlEnum.ADMINISTRATOR;

  const hasGroupLink =
    conversation.groupLink != null &&
    conversation.accessControlAddFromInviteLink !==
      AccessControlEnum.UNSATISFIABLE;

  let groupLinkInfo: ReactNode;
  if (hasGroupLink) {
    groupLinkInfo = (
      <button
        type="button"
        className="ConversationDetails__panel-row__group-link"
        aria-label={i18n('icu:GroupLinkManagement__CopyGroupLinkButtonLabel')}
        onClick={() => {
          drop(copyGroupLink(conversation.groupLink ?? ''));
        }}
      >
        {conversation.groupLink}
      </button>
    );
  }

  const [hasGenerateNewLinkDialog, setHasGenerateNewLinkDialog] =
    useState(false);

  return (
    <AxoContainer.Root>
      <AxoConfirmDialog.Root
        open={hasGenerateNewLinkDialog}
        onOpenChange={setHasGenerateNewLinkDialog}
        title={i18n('icu:GroupLinkManagement--confirm-reset')}
        // @ts-expect-error ConfirmationDialog migration: Needs description
        description={null}
      >
        <AxoConfirmDialog.Cancel />
        <AxoConfirmDialog.Action
          variant="strong-destructive"
          onClick={() => {
            generateNewGroupLink(conversation.id);
          }}
        >
          {i18n('icu:GroupLinkManagement--reset')}
        </AxoConfirmDialog.Action>
      </AxoConfirmDialog.Root>

      <AxoList.Group>
        <List>
          <AxoSwitchItem.Root
            label={i18n('icu:ConversationDetails--group-link')}
            description={groupLinkInfo}
            checked={hasGroupLink}
            onCheckedChange={checked => {
              changeHasGroupLink(conversation.id, checked);
            }}
          />
        </List>

        {hasGroupLink && (
          <List>
            <AxoClickableItem.Root
              symbol="copy"
              label={i18n('icu:GroupLinkManagement--share')}
              onClick={() => {
                if (conversation.groupLink) {
                  drop(copyGroupLink(conversation.groupLink));
                }
              }}
            />

            <AxoClickableItem.Root
              symbol="arrow-clockwise"
              label={i18n('icu:GroupLinkManagement--reset')}
              onClick={() => setHasGenerateNewLinkDialog(true)}
            />
          </List>
        )}

        {hasGroupLink && isAdmin && (
          <List>
            <AxoSwitchItem.Root
              label={i18n('icu:GroupLinkManagement--approve-label')}
              description={i18n('icu:GroupLinkManagement--approve-info')}
              checked={membersNeedAdminApproval}
              onCheckedChange={checked => {
                setAccessControlAddFromInviteLinkSetting(
                  conversation.id,
                  checked
                );
              }}
            />
          </List>
        )}
      </AxoList.Group>
    </AxoContainer.Root>
  );
}

type ListProps = Readonly<{
  children: ReactNode;
}>;

function List(props: ListProps) {
  return (
    <AxoList.Root>
      <AxoList.Body>
        <AxoItem.Group>{props.children}</AxoItem.Group>
      </AxoList.Body>
    </AxoList.Root>
  );
}

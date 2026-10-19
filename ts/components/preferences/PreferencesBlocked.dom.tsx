// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { useState } from 'react';
import moment from 'moment';
import { isNumber } from 'lodash';

import type { JSX } from 'react';

import { AxoContactList } from '../../axo/items/AxoContactList.dom.tsx';
import { AxoList } from '../../axo/items/AxoList.dom.tsx';
import { AxoPanel } from '../../axo/AxoPanel.dom.tsx';
import { AxoClickableItem } from '../../axo/items/AxoClickableItem.dom.tsx';
import { Avatar, AvatarSize } from '../Avatar.dom.tsx';
import { shouldNeverBeCalled } from '../../util/shouldNeverBeCalled.std.ts';
import { PreferencesList } from './PreferencesList.dom.tsx';
import {
  MessageRequestActionsConfirmation,
  MessageRequestState,
} from '../conversation/MessageRequestActionsConfirmation.dom.tsx';
import { PreferencesBlockChooserDialog } from './PreferencesBlockChooserDialog.dom.tsx';

import type { LocalizerType } from '../../types/I18N.std.ts';
import type { ConversationType } from '../../state/ducks/conversations.preload.ts';
import type { PreferredBadgeSelectorType } from '../../state/selectors/badges.preload.ts';
import type { ThemeType } from '../../types/Util.std.ts';
import type { BlockedConversation } from '../../state/selectors/blocked.dom.ts';
import { isSignalConversation } from '../../util/isSignalConversation.dom.ts';

export type Props = {
  blockedContacts: ReadonlyArray<BlockedConversation>;
  blockedGroups: ReadonlyArray<BlockedConversation>;
  conversationsNotBlocked: ReadonlyArray<ConversationType>;
  getPreferredBadge: PreferredBadgeSelectorType;
  goBack: () => void;
  i18n: LocalizerType;
  onBlock: (conversationId: string) => void;
  onUnblock: (conversationId: string) => void;
  theme: ThemeType;
};

export function PreferencesBlocked({
  blockedContacts,
  blockedGroups,
  conversationsNotBlocked,
  getPreferredBadge,
  goBack,
  i18n,
  onBlock,
  onUnblock,
  theme,
}: Props): JSX.Element {
  const [showConfirmUnblockDialogFor, setShowConfirmUnblockDialogFor] =
    useState<ConversationType | undefined>(undefined);
  const [showFindContactToBlockDialog, setShowFindContactToBlockDialog] =
    useState(false);

  const page = (
    <AxoList.Group>
      <PreferencesList
        footerDescription={i18n('icu:Preferences--blocked-users--description')}
      >
        <AxoClickableItem.Root
          label={i18n('icu:Preferences--add-blocked')}
          arrow="next"
          onClick={() => {
            setShowFindContactToBlockDialog(true);
          }}
        />
      </PreferencesList>
      {blockedContacts.length > 0 ? (
        <BlockedSection
          getPreferredBadge={getPreferredBadge}
          i18n={i18n}
          items={blockedContacts}
          onClick={conversation => setShowConfirmUnblockDialogFor(conversation)}
          theme={theme}
          title={i18n('icu:Preferences--blocked-users')}
        />
      ) : undefined}
      {blockedGroups.length > 0 ? (
        <BlockedSection
          getPreferredBadge={getPreferredBadge}
          i18n={i18n}
          items={blockedGroups}
          onClick={conversation => setShowConfirmUnblockDialogFor(conversation)}
          theme={theme}
          title={i18n('icu:Preferences--blocked-groups')}
        />
      ) : undefined}
    </AxoList.Group>
  );

  return (
    <AxoPanel.Root>
      <AxoPanel.Header>
        <AxoPanel.Back onClick={() => goBack()} />
        <AxoPanel.Label>{i18n('icu:Preferences--blocked')}</AxoPanel.Label>
      </AxoPanel.Header>
      <AxoPanel.Content>{page}</AxoPanel.Content>

      <PreferencesBlockChooserDialog
        conversations={conversationsNotBlocked}
        i18n={i18n}
        onBlock={onBlock}
        onClose={() => setShowFindContactToBlockDialog(false)}
        open={showFindContactToBlockDialog}
        preferredBadgeSelector={getPreferredBadge}
        theme={theme}
        title={i18n('icu:Preferences--add-blocked')}
      />

      <MessageRequestActionsConfirmation
        addedByName={null}
        conversationId={showConfirmUnblockDialogFor?.id ?? ''}
        conversationType={showConfirmUnblockDialogFor?.type ?? 'direct'}
        conversationName={showConfirmUnblockDialogFor}
        isBlocked
        isSignalConversation={
          showConfirmUnblockDialogFor
            ? isSignalConversation(showConfirmUnblockDialogFor)
            : false
        }
        isReported={false}
        acceptConversation={onUnblock}
        i18n={i18n}
        state={
          showConfirmUnblockDialogFor
            ? MessageRequestState.unblocking
            : MessageRequestState.default
        }
        onChangeState={state => {
          if (state === MessageRequestState.default) {
            setShowConfirmUnblockDialogFor(undefined);
          }
        }}
        // Should never be called!
        blockAndReportSpam={shouldNeverBeCalled}
        blockConversation={onBlock}
        reportSpam={shouldNeverBeCalled}
        deleteConversation={shouldNeverBeCalled}
      />
    </AxoPanel.Root>
  );
}

function BlockedSection({
  getPreferredBadge,
  i18n,
  items,
  theme,
  title,
  onClick,
}: {
  getPreferredBadge: PreferredBadgeSelectorType;
  i18n: LocalizerType;
  items: ReadonlyArray<BlockedConversation>;
  theme: ThemeType;
  title: string;
  onClick: (conversation: ConversationType) => void;
}) {
  return (
    <AxoContactList.Root title={title}>
      {items.map(({ conversation, blockedAt }) => {
        const description =
          isNumber(blockedAt) && blockedAt > 0
            ? i18n('icu:Preferences--blocked--blocked-on', {
                blockedAt: moment(blockedAt).format('ll'),
              })
            : undefined;

        return (
          <AxoContactList.Item
            key={conversation.id}
            avatar={
              <Avatar
                conversationType={conversation.type}
                badge={getPreferredBadge(conversation.badges)}
                i18n={i18n}
                size={AvatarSize.THIRTY_SIX}
                theme={theme}
                {...conversation}
              />
            }
            title={conversation.title}
            description={description}
            onClick={() => {
              onClick(conversation);
            }}
          />
        );
      })}
    </AxoContactList.Root>
  );
}

// Copyright 2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import type { JSX, ReactElement } from 'react';
import type { LocalizerType } from '../../../../types/Util.std.ts';
import { assertDev } from '../../../../util/assert.std.ts';
import type { ConversationType } from '../../../../state/ducks/conversations.preload.ts';
import { RequestState } from '../util.std.ts';
import { I18n } from '../../../I18n.dom.tsx';
import { ContactName } from '../../ContactName.dom.tsx';
import { UserText } from '../../../UserText.dom.tsx';
import { AxoConfirmDialog } from '../../../../axo/AxoConfirmDialog.dom.tsx';

export type StatePropsType = {
  groupTitle: string;
  i18n: LocalizerType;
  makeRequest: () => void;
  onClose: () => void;
  requestState: RequestState;
  selectedContacts: ReadonlyArray<ConversationType>;
};

type PropsType = StatePropsType;

export function ConfirmAdditionsModal({
  groupTitle,
  i18n,
  makeRequest,
  onClose,
  requestState,
  selectedContacts,
}: PropsType): JSX.Element {
  const firstContact = selectedContacts[0];
  assertDev(
    firstContact,
    'Expected at least one conversation to be selected but none were picked'
  );

  const groupTitleNode: JSX.Element = <UserText text={groupTitle} />;

  let title: ReactElement;
  if (selectedContacts.length === 1) {
    title = (
      <I18n
        i18n={i18n}
        id="icu:AddGroupMembersModal--confirm-title--one"
        components={{
          person: <ContactName title={firstContact.title} />,
          group: groupTitleNode,
        }}
      />
    );
  } else {
    title = (
      <I18n
        i18n={i18n}
        id="icu:AddGroupMembersModal--confirm-title--many"
        components={{
          count: selectedContacts.length,
          group: groupTitleNode,
        }}
      />
    );
  }

  let description: string;
  if (requestState === RequestState.InactiveWithError) {
    description = i18n('icu:updateGroupAttributes__error-message');
  } else {
    // @ts-expect-error ConfirmationDialog migration: Needs description
    description = null;
  }

  return (
    <AxoConfirmDialog.Root
      open
      onOpenChange={onClose}
      title={title}
      description={description}
    >
      <AxoConfirmDialog.Cancel />
      <AxoConfirmDialog.Action
        variant="primary"
        pending={requestState === RequestState.Active}
        onClick={makeRequest}
      >
        {selectedContacts.length === 1
          ? i18n('icu:AddGroupMembersModal--confirm-button--one')
          : i18n('icu:AddGroupMembersModal--confirm-button--many')}
      </AxoConfirmDialog.Action>
    </AxoConfirmDialog.Root>
  );
}

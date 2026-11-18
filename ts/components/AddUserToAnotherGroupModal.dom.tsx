// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import lodash from 'lodash';
import classNames from 'classnames';
import { useCallback, useState, useMemo, useEffect, type JSX } from 'react';
import type { ListRowProps } from 'react-virtualized';

import type { ConversationType } from '../state/ducks/conversations.preload.ts';
import type { LocalizerType } from '../types/Util.std.ts';
import { ToastType } from '../types/Toast.std.ts';
import { filterAndSortConversations } from '../util/filterAndSortConversations.std.ts';
import type { GroupListItemConversationType } from './conversationList/GroupListItem.dom.tsx';
import {
  DisabledReason,
  GroupListItem,
} from './conversationList/GroupListItem.dom.tsx';
import { AxoDialog } from '../axo/dialogs/AxoDialog.dom.tsx';
import { AxoSearchField } from '../axo/fields/AxoSearchField.dom.tsx';
import { tw } from '../axo/tw.dom.tsx';
import { ListView } from './ListView.dom.tsx';
import { ListTile } from './ListTile.dom.tsx';
import type { ShowToastAction } from '../state/ducks/toast.dom.ts';
import { SizeObserver } from '../hooks/useSizeObserver.dom.tsx';
import { strictAssert } from '../util/assert.std.ts';
import { AxoConfirmDialog } from '../axo/dialogs/AxoConfirmDialog.dom.tsx';

const { pick } = lodash;

type OwnProps = {
  i18n: LocalizerType;
  contact: Pick<ConversationType, 'id' | 'title' | 'serviceId' | 'pni'>;
  candidateConversations: ReadonlyArray<ConversationType>;
  regionCode: string | undefined;
};

type DispatchProps = {
  toggleAddUserToAnotherGroupModal: (contactId?: string) => void;
  addMembersToGroup: (
    conversationId: string,
    contactIds: Array<string>,
    opts: {
      onSuccess?: () => unknown;
      onFailure?: () => unknown;
    }
  ) => void;
  showToast: ShowToastAction;
};

export type Props = OwnProps & DispatchProps;

export function AddUserToAnotherGroupModal({
  i18n,
  contact,
  toggleAddUserToAnotherGroupModal,
  addMembersToGroup,
  showToast,
  candidateConversations,
  regionCode,
}: Props): JSX.Element | null {
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredConversations, setFilteredConversations] = useState(
    filterAndSortConversations(candidateConversations, '', undefined)
  );

  const [selectedGroupId, setSelectedGroupId] = useState<undefined | string>(
    undefined
  );

  const groupLookup: Map<string, ConversationType> = useMemo(() => {
    const map = new Map();
    candidateConversations.forEach(conversation => {
      map.set(conversation.id, conversation);
    });
    return map;
  }, [candidateConversations]);

  const normalizedSearchTerm = searchTerm.trim();

  useEffect(() => {
    const timeout = setTimeout(() => {
      setFilteredConversations(
        filterAndSortConversations(
          candidateConversations,
          normalizedSearchTerm,
          regionCode
        )
      );
    }, 200);
    return () => {
      clearTimeout(timeout);
    };
  }, [
    candidateConversations,
    normalizedSearchTerm,
    setFilteredConversations,
    regionCode,
  ]);

  const selectedGroup = selectedGroupId
    ? groupLookup.get(selectedGroupId)
    : undefined;

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        toggleAddUserToAnotherGroupModal(undefined);
      }
    },
    [toggleAddUserToAnotherGroupModal]
  );

  const handleGetRow = useCallback(
    (idx: number): GroupListItemConversationType => {
      const convo = filteredConversations[idx];
      strictAssert(convo, 'Missing conversation');

      // these are always populated in the case of a group
      const memberships = convo.memberships ?? [];
      const pendingApprovalMemberships = convo.pendingApprovalMemberships ?? [];
      const pendingMemberships = convo.pendingMemberships ?? [];
      const membersCount = convo.membersCount ?? 0;

      let disabledReason;

      if (memberships.some(c => c.aci === contact.serviceId)) {
        disabledReason = DisabledReason.AlreadyMember;
      } else if (
        pendingApprovalMemberships.some(c => c.aci === contact.serviceId) ||
        pendingMemberships.some(c => c.serviceId === contact.serviceId) ||
        pendingMemberships.some(c => c.serviceId === contact.pni)
      ) {
        disabledReason = DisabledReason.Pending;
      }

      return {
        ...pick(convo, 'id', 'avatarUrl', 'title', 'hasAvatar', 'color'),
        memberships,
        membersCount,
        disabledReason,
      };
    },
    [filteredConversations, contact]
  );

  const renderGroupListItem = useCallback(
    ({ key, index, style }: ListRowProps) => {
      const group = handleGetRow(index);
      return (
        <div key={key} style={style}>
          <GroupListItem
            i18n={i18n}
            group={group}
            onSelectGroup={setSelectedGroupId}
          />
        </div>
      );
    },
    [i18n, handleGetRow]
  );

  const handleCalculateRowHeight = useCallback(
    () => ListTile.heightCompact,
    []
  );

  return (
    <AxoDialog.Root open onOpenChange={handleOpenChange}>
      <AxoDialog.Content size="md" escape="cancel-is-noop">
        <AxoDialog.Header>
          <AxoDialog.Title>
            {i18n('icu:AddUserToAnotherGroupModal__title')}
          </AxoDialog.Title>
          <AxoDialog.Close />
        </AxoDialog.Header>
        <AxoDialog.Search>
          <AxoSearchField.Root value={searchTerm} onValueChange={setSearchTerm}>
            <AxoSearchField.Icon />
            <AxoSearchField.Input
              placeholder={i18n(
                'icu:AddUserToAnotherGroupModal__search-placeholder'
              )}
              autoFocus
            />
            <AxoSearchField.Clear />
          </AxoSearchField.Root>
        </AxoDialog.Search>
        <AxoDialog.Body
          scrollbarWidth="none"
          // ListView has its own scroll container
          padding="deprecated-only-scrollbar-gutter"
        >
          <SizeObserver>
            {(ref, size) => {
              return (
                <div
                  ref={ref}
                  className={classNames(
                    'AddUserToAnotherGroupModal',
                    tw('h-110 w-full')
                  )}
                >
                  {size != null && !size.hidden && (
                    <ListView
                      width={size.width}
                      height={size.height}
                      rowCount={filteredConversations.length}
                      calculateRowHeight={handleCalculateRowHeight}
                      rowRenderer={renderGroupListItem}
                    />
                  )}
                </div>
              );
            }}
          </SizeObserver>
        </AxoDialog.Body>
      </AxoDialog.Content>

      {selectedGroupId && selectedGroup && (
        <AxoConfirmDialog.Root
          open
          onOpenChange={() => setSelectedGroupId(undefined)}
          title={i18n('icu:AddUserToAnotherGroupModal__confirm-title')}
          description={i18n('icu:AddUserToAnotherGroupModal__confirm-message', {
            contact: contact.title,
            group: selectedGroup.title,
          })}
        >
          <AxoConfirmDialog.Cancel />
          <AxoConfirmDialog.Action
            variant="strong-primary"
            onClick={() => {
              showToast({
                toastType: ToastType.AddingUserToGroup,
                parameters: {
                  contact: contact.title,
                },
              });
              addMembersToGroup(selectedGroupId, [contact.id], {
                onSuccess: () => {
                  showToast({
                    toastType: ToastType.UserAddedToGroup,
                    parameters: {
                      contact: contact.title,
                      group: selectedGroup.title,
                    },
                  });
                },
              });
              toggleAddUserToAnotherGroupModal(undefined);
            }}
          >
            {i18n('icu:AddUserToAnotherGroupModal__confirm-add')}
          </AxoConfirmDialog.Action>
        </AxoConfirmDialog.Root>
      )}
    </AxoDialog.Root>
  );
}

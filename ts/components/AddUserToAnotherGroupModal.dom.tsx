// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import lodash from 'lodash';
import {
  useCallback,
  useState,
  useMemo,
  useEffect,
  type JSX,
  type ChangeEvent,
} from 'react';
import type { ListRowProps } from 'react-virtualized';

import type { ConversationType } from '../state/ducks/conversations.preload.ts';
import type { LocalizerType } from '../types/Util.std.ts';
import { ToastType } from '../types/Toast.dom.tsx';
import { filterAndSortConversations } from '../util/filterAndSortConversations.std.ts';
import type { GroupListItemConversationType } from './conversationList/GroupListItem.dom.tsx';
import {
  DisabledReason,
  GroupListItem,
} from './conversationList/GroupListItem.dom.tsx';
import { Modal } from './Modal.dom.tsx';
import { SearchInput } from './SearchInput.dom.tsx';
import { useRestoreFocus } from '../hooks/useRestoreFocus.dom.ts';
import { ListView } from './ListView.dom.tsx';
import { ListTile } from './ListTile.dom.tsx';
import type { ShowToastAction } from '../state/ducks/toast.preload.ts';
import { SizeObserver } from '../hooks/useSizeObserver.dom.tsx';
import { strictAssert } from '../util/assert.std.ts';
import { AxoConfirmDialog } from '../axo/AxoConfirmDialog.dom.tsx';

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

  const [inputRef] = useRestoreFocus();

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

  const handleSearchInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      setSearchTerm(event.target.value);
    },
    [setSearchTerm]
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
    <>
      {!selectedGroup && (
        <Modal
          modalName="AddUserToAnotherGroupModal"
          hasXButton
          i18n={i18n}
          onClose={toggleAddUserToAnotherGroupModal}
          title={i18n('icu:AddUserToAnotherGroupModal__title')}
          moduleClassName="AddUserToAnotherGroupModal"
          padded={false}
        >
          <div className="AddUserToAnotherGroupModal__main-body">
            <SearchInput
              i18n={i18n}
              placeholder={i18n(
                'icu:AddUserToAnotherGroupModal__search-placeholder'
              )}
              onChange={handleSearchInputChange}
              ref={inputRef}
              value={searchTerm}
            />
            <SizeObserver>
              {(ref, size) => {
                return (
                  <div
                    className="AddUserToAnotherGroupModal__list-wrapper"
                    ref={ref}
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
          </div>
        </Modal>
      )}

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
            variant="primary"
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
    </>
  );
}

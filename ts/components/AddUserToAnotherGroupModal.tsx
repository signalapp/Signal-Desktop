// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { pick } from 'lodash';
import React, { useCallback } from 'react';
import type { MeasuredComponentProps } from 'react-measure';
import Measure from 'react-measure';
import type { ListRowProps } from 'react-virtualized';

import type { ConversationType } from '../state/ducks/conversations';
import type { LocalizerType, ThemeType } from '../types/Util';
import { ToastType } from '../types/Toast';
import { filterAndSortConversationsByRecent } from '../util/filterAndSortConversations';
import { ConfirmationDialog } from './ConfirmationDialog';
import type { GroupListItemConversationType } from './conversationList/GroupListItem';
import {
  DisabledReason,
  GroupListItem,
} from './conversationList/GroupListItem';
import { Modal } from './Modal';
import { SearchInput } from './SearchInput';
import { useRestoreFocus } from '../hooks/useRestoreFocus';
import { ListView } from './ListView';
import { ListTile } from './ListTile';
import type { ShowToastAction } from '../state/ducks/toast';

type OwnProps = {
  i18n: LocalizerType;
  theme: ThemeType;
  contact: Pick<ConversationType, 'id' | 'title' | 'uuid'>;
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
  const [searchTerm, setSearchTerm] = React.useState('');
  const [filteredConversations, setFilteredConversations] = React.useState(
    filterAndSortConversationsByRecent(candidateConversations, '', undefined)
  );

  const [selectedGroupId, setSelectedGroupId] = React.useState<
    undefined | string
  >(undefined);

  const groupLookup: Map<string, ConversationType> = React.useMemo(() => {
    const map = new Map();
    candidateConversations.forEach(conversation => {
      map.set(conversation.id, conversation);
    });
    return map;
  }, [candidateConversations]);

  const [inputRef] = useRestoreFocus();

  const normalizedSearchTerm = searchTerm.trim();

  React.useEffect(() => {
    const timeout = setTimeout(() => {
      setFilteredConversations(
        filterAndSortConversationsByRecent(
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

  const handleSearchInputChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      setSearchTerm(event.target.value);
    },
    [setSearchTerm]
  );

  const handleGetRow = React.useCallback(
    (idx: number): GroupListItemConversationType => {
      const convo = filteredConversations[idx];

      // these are always populated in the case of a group
      const memberships = convo.memberships ?? [];
      const pendingApprovalMemberships = convo.pendingApprovalMemberships ?? [];
      const pendingMemberships = convo.pendingMemberships ?? [];
      const membersCount = convo.membersCount ?? 0;

      let disabledReason;

      if (memberships.some(c => c.uuid === contact.uuid)) {
        disabledReason = DisabledReason.AlreadyMember;
      } else if (
        pendingApprovalMemberships.some(c => c.uuid === contact.uuid) ||
        pendingMemberships.some(c => c.uuid === contact.uuid)
      ) {
        disabledReason = DisabledReason.Pending;
      }

      return {
        ...pick(convo, 'id', 'avatarPath', 'title', 'unblurredAvatarPath'),
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
              placeholder={i18n('icu:contactSearchPlaceholder')}
              onChange={handleSearchInputChange}
              ref={inputRef}
              value={searchTerm}
            />

            <Measure bounds>
              {({ contentRect, measureRef }: MeasuredComponentProps) => {
                // Though `width` and `height` are required properties, we want to be
                // careful in case the caller sends bogus data. Notably, react-measure's
                // types seem to be inaccurate.
                const { width = 100, height = 100 } = contentRect.bounds || {};
                if (!width || !height) {
                  return null;
                }

                return (
                  <div
                    className="AddUserToAnotherGroupModal__list-wrapper"
                    ref={measureRef}
                  >
                    <ListView
                      width={width}
                      height={height}
                      rowCount={filteredConversations.length}
                      calculateRowHeight={handleCalculateRowHeight}
                      rowRenderer={renderGroupListItem}
                    />
                  </div>
                );
              }}
            </Measure>
          </div>
        </Modal>
      )}

      {selectedGroupId && selectedGroup && (
        <ConfirmationDialog
          dialogName="AddUserToAnotherGroupModal__confirm"
          title={i18n('icu:AddUserToAnotherGroupModal__confirm-title')}
          i18n={i18n}
          onClose={() => setSelectedGroupId(undefined)}
          actions={[
            {
              text: i18n('icu:AddUserToAnotherGroupModal__confirm-add'),
              style: 'affirmative',
              action: () => {
                showToast({
                  toastType: ToastType.AddingUserToGroup,
                  parameters: {
                    contact: contact.title,
                  },
                });
                addMembersToGroup(selectedGroupId, [contact.id], {
                  onSuccess: () =>
                    showToast({
                      toastType: ToastType.UserAddedToGroup,
                      parameters: {
                        contact: contact.title,
                        group: selectedGroup.title,
                      },
                    }),
                });
                toggleAddUserToAnotherGroupModal(undefined);
              },
            },
          ]}
        >
          {i18n('icu:AddUserToAnotherGroupModal__confirm-message', {
            contact: contact.title,
            group: selectedGroup.title,
          })}
        </ConfirmationDialog>
      )}
    </>
  );
}

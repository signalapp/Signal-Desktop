// Copyright 2022 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { noop, pick } from 'lodash';
import React from 'react';
import type { MeasuredComponentProps } from 'react-measure';
import Measure from 'react-measure';

import type { ConversationType } from '../state/ducks/conversations';
import type {
  LocalizerType,
  ReplacementValuesType,
  ThemeType,
} from '../types/Util';
import { ToastType } from '../state/ducks/toast';
import { filterAndSortConversationsByRecent } from '../util/filterAndSortConversations';
import { ConfirmationDialog } from './ConfirmationDialog';
import type { Row } from './ConversationList';
import { ConversationList, RowType } from './ConversationList';
import { DisabledReason } from './conversationList/GroupListItem';
import { Modal } from './Modal';
import { SearchInput } from './SearchInput';
import { useRestoreFocus } from '../hooks/useRestoreFocus';

type OwnProps = {
  i18n: LocalizerType;
  theme: ThemeType;
  contact: Pick<ConversationType, 'id' | 'title' | 'uuid'>;
  candidateConversations: ReadonlyArray<ConversationType>;
  regionCode: string | undefined;
};

type DispatchProps = {
  toggleAddUserToAnotherGroupModal: (contactId?: string) => void;
  addMemberToGroup: (
    conversationId: string,
    contactId: string,
    onComplete: () => void
  ) => void;
  showToast: (toastType: ToastType, parameters?: ReplacementValuesType) => void;
};

export type Props = OwnProps & DispatchProps;

export function AddUserToAnotherGroupModal({
  i18n,
  theme,
  contact,
  toggleAddUserToAnotherGroupModal,
  addMemberToGroup,
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
    (idx: number): Row | undefined => {
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
        type: RowType.SelectSingleGroup,
        group: {
          ...pick(convo, 'id', 'avatarPath', 'title', 'unblurredAvatarPath'),
          memberships,
          membersCount,
          disabledReason,
        },
      };
    },
    [filteredConversations, contact]
  );

  return (
    <>
      {!selectedGroup && (
        <Modal
          modalName="AddUserToAnotherGroupModal"
          hasXButton
          i18n={i18n}
          onClose={toggleAddUserToAnotherGroupModal}
          title={i18n('AddUserToAnotherGroupModal__title')}
          moduleClassName="AddUserToAnotherGroupModal"
          padded={false}
        >
          <div className="AddUserToAnotherGroupModal__main-body">
            <SearchInput
              i18n={i18n}
              placeholder={i18n('contactSearchPlaceholder')}
              onChange={handleSearchInputChange}
              ref={inputRef}
              value={searchTerm}
            />

            <Measure bounds>
              {({ contentRect, measureRef }: MeasuredComponentProps) => (
                <div
                  className="AddUserToAnotherGroupModal__list-wrapper"
                  ref={measureRef}
                >
                  <ConversationList
                    dimensions={contentRect.bounds}
                    rowCount={filteredConversations.length}
                    getRow={handleGetRow}
                    shouldRecomputeRowHeights={false}
                    showConversation={noop}
                    getPreferredBadge={() => undefined}
                    i18n={i18n}
                    theme={theme}
                    onClickArchiveButton={noop}
                    onClickContactCheckbox={noop}
                    onSelectConversation={setSelectedGroupId}
                    showChooseGroupMembers={noop}
                    lookupConversationWithoutUuid={async _ => undefined}
                    showUserNotFoundModal={noop}
                    setIsFetchingUUID={noop}
                  />
                </div>
              )}
            </Measure>
          </div>
        </Modal>
      )}

      {selectedGroupId && selectedGroup && (
        <ConfirmationDialog
          dialogName="AddUserToAnotherGroupModal__confirm"
          title={i18n('AddUserToAnotherGroupModal__confirm-title')}
          i18n={i18n}
          onClose={() => setSelectedGroupId(undefined)}
          actions={[
            {
              text: i18n('AddUserToAnotherGroupModal__confirm-add'),
              style: 'affirmative',
              action: () => {
                showToast(ToastType.AddingUserToGroup, {
                  contact: contact.title,
                });
                addMemberToGroup(selectedGroupId, contact.id, () =>
                  showToast(ToastType.UserAddedToGroup, {
                    contact: contact.title,
                    group: selectedGroup.title,
                  })
                );
                toggleAddUserToAnotherGroupModal(undefined);
              },
            },
          ]}
        >
          {i18n('AddUserToAnotherGroupModal__confirm-message', {
            contact: contact.title,
            group: selectedGroup.title,
          })}
        </ConfirmationDialog>
      )}
    </>
  );
}

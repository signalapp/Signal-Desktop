import { useState } from 'react';

import { useDispatch, useSelector } from 'react-redux';
import useKey from 'react-use/lib/useKey';
import styled from 'styled-components';

import { isEmpty } from 'lodash';
import { SessionButton } from '../../basic/SessionButton';
import { SessionSpinner } from '../../loading';

import { useSet } from '../../../hooks/useSet';
import { VALIDATION } from '../../../session/constants';
import { createClosedGroup } from '../../../session/conversations/createClosedGroup';
import { clearSearch } from '../../../state/ducks/search';
import { resetLeftOverlayMode } from '../../../state/ducks/section';
import { getPrivateContactsPubkeys } from '../../../state/selectors/conversations';
import {
  getSearchResultsContactOnly,
  getSearchTerm,
  isSearching,
} from '../../../state/selectors/search';
import { MemberListItem } from '../../MemberListItem';
import { SessionSearchInput } from '../../SessionSearchInput';
import { Flex } from '../../basic/Flex';
import { SpacerLG, SpacerMD } from '../../basic/Text';
import { SessionInput } from '../../inputs';
import { StyledLeftPaneOverlay } from './OverlayMessage';
import LIBSESSION_CONSTANTS from '../../../session/utils/libsession/libsession_constants';

const StyledMemberListNoContacts = styled.div`
  text-align: center;
  padding: 20px;
`;

const StyledNoResults = styled.div`
  width: 100%;
  padding: var(--margins-xl) var(--margins-sm);
  text-align: center;
`;

const StyledGroupMemberListContainer = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  width: 100%;
  overflow-x: hidden;
  overflow-y: auto;

  border-top: 1px solid var(--border-color);
  border-bottom: 1px solid var(--border-color);

  &::-webkit-scrollbar-track {
    background-color: var(--background-secondary-color);
  }
`;

const NoContacts = () => {
  return (
    <StyledMemberListNoContacts>{window.i18n('noContactsForGroup')}</StyledMemberListNoContacts>
  );
};

/**
 * Makes some validity check and return true if the group was indead created
 */
async function createClosedGroupWithErrorHandling(
  groupName: string,
  groupMemberIds: Array<string>,
  onError: (error: string) => void
): Promise<boolean> {
  // Validate groupName and groupMembers length
  if (groupName.length === 0) {
    onError(window.i18n('invalidGroupNameTooShort'));
    return false;
  }
  if (groupName.length > LIBSESSION_CONSTANTS.BASE_GROUP_MAX_NAME_LENGTH) {
    onError(window.i18n('invalidGroupNameTooLong'));
    return false;
  }

  // >= because we add ourself as a member AFTER this. so a 10 group is already invalid as it will be 11 with ourself
  // the same is valid with groups count < 1

  if (groupMemberIds.length < 1) {
    onError(window.i18n('pickClosedGroupMember'));
    return false;
  }
  if (groupMemberIds.length >= VALIDATION.CLOSED_GROUP_SIZE_LIMIT) {
    onError(window.i18n('closedGroupMaxSize'));
    return false;
  }

  await createClosedGroup(groupName, groupMemberIds, window.sessionFeatureFlags.useClosedGroupV3);

  return true;
}

export const OverlayClosedGroup = () => {
  const dispatch = useDispatch();
  const privateContactsPubkeys = useSelector(getPrivateContactsPubkeys);
  const [groupName, setGroupName] = useState('');
  const [groupNameError, setGroupNameError] = useState<string | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  const {
    uniqueValues: selectedMemberIds,
    addTo: addToSelected,
    removeFrom: removeFromSelected,
  } = useSet<string>([]);
  const isSearch = useSelector(isSearching);
  const searchTerm = useSelector(getSearchTerm);
  const searchResultContactsOnly = useSelector(getSearchResultsContactOnly);

  function closeOverlay() {
    dispatch(clearSearch());
    dispatch(resetLeftOverlayMode());
  }

  async function onEnterPressed() {
    setGroupNameError(undefined);
    if (loading) {
      window?.log?.warn('Closed group creation already in progress');
      return;
    }
    setLoading(true);
    const groupCreated = await createClosedGroupWithErrorHandling(
      groupName,
      selectedMemberIds,
      setGroupNameError
    );
    if (groupCreated) {
      closeOverlay();
      return;
    }
    setLoading(false);
  }

  useKey('Escape', closeOverlay);

  const contactsToRender = isSearch ? searchResultContactsOnly : privateContactsPubkeys;

  const noContactsForClosedGroup = isEmpty(searchTerm) && contactsToRender.length === 0;

  const disableCreateButton = loading || (!selectedMemberIds.length && !groupName.length);

  return (
    <StyledLeftPaneOverlay
      container={true}
      flexDirection={'column'}
      flexGrow={1}
      alignItems={'center'}
    >
      <Flex
        container={true}
        width={'100%'}
        flexDirection="column"
        alignItems="center"
        padding={'var(--margins-md)'}
      >
        <SessionInput
          autoFocus={true}
          type="text"
          placeholder={window.i18n('createClosedGroupPlaceholder')}
          value={groupName}
          onValueChanged={setGroupName}
          onEnterPressed={onEnterPressed}
          error={groupNameError}
          maxLength={LIBSESSION_CONSTANTS.BASE_GROUP_MAX_NAME_LENGTH}
          textSize="md"
          centerText={true}
          monospaced={true}
          isTextArea={true}
          inputDataTestId="new-closed-group-name"
          editable={!loading}
        />
        <SpacerMD />
        <SessionSpinner loading={loading} />
        <SpacerLG />
      </Flex>

      <SessionSearchInput />
      <StyledGroupMemberListContainer>
        {noContactsForClosedGroup ? (
          <NoContacts />
        ) : searchTerm && !contactsToRender.length ? (
          <StyledNoResults>{window.i18n('noSearchResults', [searchTerm])}</StyledNoResults>
        ) : (
          contactsToRender.map((pubkey: string) => (
            <MemberListItem
              key={`member-list-${pubkey}`}
              pubkey={pubkey}
              isSelected={selectedMemberIds.includes(pubkey)}
              onSelect={addToSelected}
              onUnselect={removeFromSelected}
              disabled={loading}
            />
          ))
        )}
      </StyledGroupMemberListContainer>

      <SpacerLG style={{ flexShrink: 0 }} />
      <Flex container={true} width={'100%'} flexDirection="column" padding={'var(--margins-md)'}>
        <SessionButton
          text={window.i18n('create')}
          disabled={disableCreateButton}
          onClick={onEnterPressed}
          dataTestId="next-button"
          margin="auto 0 0" // just to keep that button at the bottom of the overlay (even with an empty list)
        />
      </Flex>
      <SpacerLG />
    </StyledLeftPaneOverlay>
  );
};

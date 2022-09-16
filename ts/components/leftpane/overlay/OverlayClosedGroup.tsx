import React, { useState } from 'react';

import { useDispatch, useSelector } from 'react-redux';

import { SessionButton2 } from '../../basic/SessionButton2';
import { SessionIdEditable } from '../../basic/SessionIdEditable';
import { SessionSpinner } from '../../basic/SessionSpinner';
import { MemberListItem } from '../../MemberListItem';
import { OverlayHeader } from './OverlayHeader';
// tslint:disable: no-submodule-imports use-simple-attributes

import { resetOverlayMode } from '../../../state/ducks/section';
import { getPrivateContactsPubkeys } from '../../../state/selectors/conversations';
import { SpacerLG } from '../../basic/Text';
import { MainViewController } from '../../MainViewController';
import useKey from 'react-use/lib/useKey';
import styled from 'styled-components';
import { SessionSearchInput } from '../../SessionSearchInput';
import { getSearchResults, isSearching } from '../../../state/selectors/search';
import { useSet } from '../../../hooks/useSet';
import { VALIDATION } from '../../../session/constants';

const StyledMemberListNoContacts = styled.div`
  font-family: var(--font-font-mono);
  background: var(--background-secondary-color);
  text-align: center;
  padding: 20px;
`;

const StyledGroupMemberListContainer = styled.div`
  padding: 2px 0px;
  width: 100%;
  max-height: 400px;
  overflow-y: auto;
  border: var(--border-color);
`;

const NoContacts = () => {
  return (
    <StyledMemberListNoContacts>{window.i18n('noContactsForGroup')}</StyledMemberListNoContacts>
  );
};

export const OverlayClosedGroup = () => {
  const dispatch = useDispatch();
  const privateContactsPubkeys = useSelector(getPrivateContactsPubkeys);
  const [groupName, setGroupName] = useState('');
  const [loading, setLoading] = useState(false);
  const {
    uniqueValues: selectedMemberIds,
    addTo: addToSelected,
    removeFrom: removeFromSelected,
  } = useSet<string>([]);

  function closeOverlay() {
    dispatch(resetOverlayMode());
  }

  async function onEnterPressed() {
    if (loading) {
      window?.log?.warn('Closed group creation already in progress');
      return;
    }
    setLoading(true);
    const groupCreated = await MainViewController.createClosedGroup(groupName, selectedMemberIds);
    if (groupCreated) {
      closeOverlay();
      return;
    }
    setLoading(false);
  }

  useKey('Escape', closeOverlay);

  const title = window.i18n('createGroup');
  const buttonText = window.i18n('create');
  const subtitle = window.i18n('createClosedGroupNamePrompt');
  const placeholder = window.i18n('createClosedGroupPlaceholder');

  const noContactsForClosedGroup = privateContactsPubkeys.length === 0;

  const isSearch = useSelector(isSearching);
  const searchResultsSelected = useSelector(getSearchResults);
  const searchResults = isSearch ? searchResultsSelected : undefined;
  let sharedWithResults: Array<string> = [];

  if (searchResults && searchResults.contactsAndGroups.length) {
    sharedWithResults = searchResults.contactsAndGroups
      .filter(convo => convo.isPrivate)
      .map(convo => convo.id);
  }
  const contactsToRender = isSearch ? sharedWithResults : privateContactsPubkeys;

  const disableCreateButton = !selectedMemberIds.length && !groupName.length;

  return (
    <div className="module-left-pane-overlay">
      <OverlayHeader title={title} subtitle={subtitle} />
      <div className="create-group-name-input">
        <SessionIdEditable
          editable={!noContactsForClosedGroup}
          placeholder={placeholder}
          value={groupName}
          isGroup={true}
          maxLength={VALIDATION.MAX_GROUP_NAME_LENGTH}
          onChange={setGroupName}
          onPressEnter={onEnterPressed}
          dataTestId="new-closed-group-name"
        />
      </div>

      <SessionSpinner loading={loading} />

      <SpacerLG />
      <SessionSearchInput />

      <StyledGroupMemberListContainer>
        {noContactsForClosedGroup ? (
          <NoContacts />
        ) : (
          <div className="group-member-list__selection">
            {contactsToRender.map((memberPubkey: string) => (
              <MemberListItem
                pubkey={memberPubkey}
                isSelected={selectedMemberIds.some(m => m === memberPubkey)}
                key={memberPubkey}
                onSelect={addToSelected}
                onUnselect={removeFromSelected}
              />
            ))}
          </div>
        )}
      </StyledGroupMemberListContainer>

      <SpacerLG style={{ flexShrink: 0 }} />

      <SessionButton2
        text={buttonText}
        disabled={disableCreateButton}
        onClick={onEnterPressed}
        dataTestId="next-button"
        margin="auto 0 var(--margins-lg) 0 " // just to keep that button at the bottom of the overlay (even with an empty list)
      />
    </div>
  );
};

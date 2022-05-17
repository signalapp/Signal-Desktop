import React, { useState } from 'react';

import { useDispatch, useSelector } from 'react-redux';

import { SessionButton, SessionButtonColor, SessionButtonType } from '../../basic/SessionButton';
import { SessionIdEditable } from '../../basic/SessionIdEditable';
import { SessionSpinner } from '../../basic/SessionSpinner';
import { MemberListItem } from '../../MemberListItem';
import { OverlayHeader } from './OverlayHeader';
// tslint:disable: no-submodule-imports use-simple-attributes

import { setOverlayMode } from '../../../state/ducks/section';
import { getPrivateContactsPubkeys } from '../../../state/selectors/conversations';
import { SpacerLG } from '../../basic/Text';
import { MainViewController } from '../../MainViewController';
import useKey from 'react-use/lib/useKey';

export const OverlayClosedGroup = () => {
  const dispatch = useDispatch();
  const privateContactsPubkeys = useSelector(getPrivateContactsPubkeys);
  // FIXME autofocus inputref on mount
  const [groupName, setGroupName] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedMemberIds, setSelectedMemberIds] = useState<Array<string>>([]);

  function closeOverlay() {
    dispatch(setOverlayMode(undefined));
  }

  function handleSelectMember(memberId: string) {
    if (selectedMemberIds.includes(memberId)) {
      return;
    }

    setSelectedMemberIds([...selectedMemberIds, memberId]);
  }

  function handleUnselectMember(unselectId: string) {
    setSelectedMemberIds(
      selectedMemberIds.filter(id => {
        return id !== unselectId;
      })
    );
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

  const title = window.i18n('newClosedGroup');
  const buttonText = window.i18n('done');
  const subtitle = window.i18n('createClosedGroupNamePrompt');
  const placeholder = window.i18n('createClosedGroupPlaceholder');

  const noContactsForClosedGroup = privateContactsPubkeys.length === 0;

  return (
    <div className="module-left-pane-overlay">
      <OverlayHeader title={title} subtitle={subtitle} />
      <div className="create-group-name-input">
        <SessionIdEditable
          editable={!noContactsForClosedGroup}
          placeholder={placeholder}
          value={groupName}
          isGroup={true}
          maxLength={100}
          onChange={setGroupName}
          onPressEnter={onEnterPressed}
          dataTestId="new-closed-group-name"
        />
      </div>

      <SessionSpinner loading={loading} />

      <SpacerLG />
      <div className="group-member-list__container">
        {noContactsForClosedGroup ? (
          <div className="group-member-list__no-contacts">{window.i18n('noContactsForGroup')}</div>
        ) : (
          <div className="group-member-list__selection">
            {privateContactsPubkeys.map((memberPubkey: string) => (
              <MemberListItem
                pubkey={memberPubkey}
                isSelected={selectedMemberIds.some(m => m === memberPubkey)}
                key={memberPubkey}
                onSelect={selectedMember => {
                  handleSelectMember(selectedMember);
                }}
                onUnselect={unselectedMember => {
                  handleUnselectMember(unselectedMember);
                }}
              />
            ))}
          </div>
        )}
      </div>

      <SpacerLG />

      <SessionButton
        buttonColor={SessionButtonColor.Green}
        buttonType={SessionButtonType.BrandOutline}
        text={buttonText}
        disabled={noContactsForClosedGroup}
        onClick={onEnterPressed}
        dataTestId="next-button"
      />
    </div>
  );
};

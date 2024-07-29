import React, { useState } from 'react';

import useUpdate from 'react-use/lib/useUpdate';
import styled from 'styled-components';
import { useSet } from '../../hooks/useSet';
import { ToastUtils } from '../../session/utils';
import { BlockedNumberController } from '../../util';
import { SessionButton, SessionButtonColor } from '../basic/SessionButton';
import { SpacerLG, SpacerSM } from '../basic/Text';
import { SessionIconButton } from '../icon';
import { MemberListItem } from '../MemberListItem';
import { SessionSettingsItemWrapper, SettingsTitleAndDescription } from './SessionSettingListItem';

const BlockedEntriesContainer = styled.div`
  display: flex;
  flex-direction: column;
  flex: 1;
  width: 100%;
`;

const BlockedEntriesRoundedContainer = styled.div`
  background: var(--background-secondary-color);
  border: 1px solid var(--border-color);
  border-radius: 16px;
  padding: var(--margins-lg);
  margin: 0 var(--margins-lg);
`;

const BlockedContactListTitle = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const BlockedContactListTitleButtons = styled.div`
  display: flex;
  align-items: center;
  min-height: 34px; // height of the unblock button
`;

export const StyledBlockedSettingItem = styled.div<{ clickable: boolean; expanded: boolean }>`
  font-size: var(--font-size-md);
  cursor: ${props => (props.clickable ? 'pointer' : 'unset')};
  ${props => props.expanded && 'padding-bottom: var(--margins-lg);'}
`;

const BlockedEntries = (props: {
  blockedNumbers: Array<string>;
  selectedIds: Array<string>;
  addToSelected: (id: string) => void;
  removeFromSelected: (id: string) => void;
}) => {
  const { addToSelected, blockedNumbers, removeFromSelected, selectedIds } = props;
  return (
    <BlockedEntriesRoundedContainer>
      <BlockedEntriesContainer>
        {blockedNumbers.map(blockedEntry => {
          return (
            <MemberListItem
              pubkey={blockedEntry}
              isSelected={selectedIds.includes(blockedEntry)}
              key={blockedEntry}
              onSelect={addToSelected}
              onUnselect={removeFromSelected}
              disableBg={true}
            />
          );
        })}
      </BlockedEntriesContainer>
    </BlockedEntriesRoundedContainer>
  );
};

const NoBlockedContacts = () => {
  return <div>{window.i18n('noBlockedContacts')}</div>;
};

export const BlockedContactsList = () => {
  const [expanded, setExpanded] = useState(false);
  const {
    uniqueValues: selectedIds,
    addTo: addToSelected,
    removeFrom: removeFromSelected,
    empty: emptySelected,
  } = useSet<string>([]);

  const forceUpdate = useUpdate();

  const hasAtLeastOneSelected = Boolean(selectedIds.length);
  const blockedNumbers = BlockedNumberController.getBlockedNumbers();
  const noBlockedNumbers = !blockedNumbers.length;

  function toggleUnblockList() {
    if (blockedNumbers.length) {
      setExpanded(!expanded);
    }
  }

  async function unBlockThoseUsers() {
    if (selectedIds.length) {
      await BlockedNumberController.unblockAll(selectedIds);
      emptySelected();
      ToastUtils.pushToastSuccess('unblocked', window.i18n('unblocked'));
      forceUpdate();
    }
  }

  return (
    <SessionSettingsItemWrapper inline={false}>
      <StyledBlockedSettingItem
        clickable={!noBlockedNumbers}
        expanded={!noBlockedNumbers && expanded}
      >
        <BlockedContactListTitle onClick={toggleUnblockList}>
          <SettingsTitleAndDescription title={window.i18n('blockedSettingsTitle')} />
          {noBlockedNumbers ? (
            <NoBlockedContacts />
          ) : (
            <BlockedContactListTitleButtons>
              {hasAtLeastOneSelected && expanded ? (
                <SessionButton
                  buttonColor={SessionButtonColor.Danger}
                  text={window.i18n('unblock')}
                  onClick={unBlockThoseUsers}
                  dataTestId="unblock-button-settings-screen"
                />
              ) : null}
              <SpacerLG />
              <SessionIconButton
                iconSize={'large'}
                iconType={'chevron'}
                onClick={toggleUnblockList}
                iconRotation={expanded ? 0 : 180}
                dataTestId="reveal-blocked-user-settings"
              />
            </BlockedContactListTitleButtons>
          )}
        </BlockedContactListTitle>
      </StyledBlockedSettingItem>
      {expanded && !noBlockedNumbers ? (
        <>
          <BlockedEntries
            blockedNumbers={blockedNumbers}
            selectedIds={selectedIds}
            addToSelected={addToSelected}
            removeFromSelected={removeFromSelected}
          />
          <SpacerSM />
        </>
      ) : null}
    </SessionSettingsItemWrapper>
  );
};

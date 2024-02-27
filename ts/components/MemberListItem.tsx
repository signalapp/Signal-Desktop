import React from 'react';
import styled from 'styled-components';

import { Avatar, AvatarSize, CrownIcon } from './avatar/Avatar';
import { useNicknameOrProfileNameOrShortenedPubkey } from '../hooks/useParamSelector';
import { SessionRadio } from './basic/SessionRadio';

const AvatarContainer = styled.div`
  position: relative;
`;

const AvatarItem = (props: { memberPubkey: string; isAdmin: boolean }) => {
  const { memberPubkey, isAdmin } = props;
  return (
    <AvatarContainer>
      <Avatar size={AvatarSize.XS} pubkey={memberPubkey} />
      {isAdmin && <CrownIcon />}
    </AvatarContainer>
  );
};

const StyledSessionMemberItem = styled.button<{
  inMentions?: boolean;
  zombie?: boolean;
  selected?: boolean;
  disableBg?: boolean;
}>`
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  flex-grow: 1;
  font-family: var(--font-default);
  padding: 0px var(--margins-sm);
  height: ${props => (props.inMentions ? '40px' : '50px')};
  width: 100%;
  transition: var(--default-duration);
  opacity: ${props => (props.zombie ? 0.5 : 1)};
  background-color: ${props =>
    !props.disableBg && props.selected
      ? 'var(--conversation-tab-background-selected-color) !important'
      : null};

  :not(:last-child) {
    border-bottom: 1px solid var(--border-color);
  }
`;

const StyledInfo = styled.div`
  display: flex;
  align-items: center;
  min-width: 0;
`;

const StyledName = styled.span`
  font-weight: bold;
  margin-inline-start: var(--margins-md);
  margin-inline-end: var(--margins-md);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const StyledCheckContainer = styled.div`
  display: flex;
  align-items: center;
`;

export const MemberListItem = (props: {
  pubkey: string;
  isSelected: boolean;
  // this bool is used to make a zombie appear with less opacity than a normal member
  isZombie?: boolean;
  inMentions?: boolean; // set to true if we are rendering members but in the Mentions picker
  disableBg?: boolean;
  isAdmin?: boolean; // if true,  we add a small crown on top of their avatar
  onSelect?: (pubkey: string) => void;
  onUnselect?: (pubkey: string) => void;
  dataTestId?: string;
}) => {
  const {
    isSelected,
    pubkey,
    isZombie,
    isAdmin,
    onSelect,
    onUnselect,
    inMentions,
    disableBg,
    dataTestId,
  } = props;

  const memberName = useNicknameOrProfileNameOrShortenedPubkey(pubkey);

  return (
    <StyledSessionMemberItem
      onClick={() => {
        // eslint-disable-next-line no-unused-expressions
        isSelected ? onUnselect?.(pubkey) : onSelect?.(pubkey);
      }}
      style={
        !inMentions && !disableBg
          ? {
              backgroundColor: 'var(--background-primary-color)',
            }
          : {}
      }
      data-testid={dataTestId}
      zombie={isZombie}
      inMentions={inMentions}
      selected={isSelected}
      disableBg={disableBg}
    >
      <StyledInfo>
        <AvatarItem memberPubkey={pubkey} isAdmin={isAdmin || false} />
        <StyledName>{memberName}</StyledName>
      </StyledInfo>

      {!inMentions && (
        <StyledCheckContainer>
          <SessionRadio active={isSelected} value={pubkey} inputName={pubkey} label="" />
        </StyledCheckContainer>
      )}
    </StyledSessionMemberItem>
  );
};

import React from 'react';
import { Avatar, AvatarSize, CrownIcon } from './avatar/Avatar';
import { useConversationUsernameOrShorten } from '../hooks/useParamSelector';
import styled from 'styled-components';
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
    props.selected && 'var(--color-conversation-item-selected) !important'};

  :not(:last-child) {
    border-bottom: var(--border-session);
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

  const memberName = useConversationUsernameOrShorten(pubkey);

  return (
    // tslint:disable-next-line: use-simple-attributes
    <StyledSessionMemberItem
      onClick={() => {
        isSelected ? onUnselect?.(pubkey) : onSelect?.(pubkey);
      }}
      style={
        !inMentions && !disableBg
          ? {
              backgroundColor: 'var(--color-cell-background)',
            }
          : {}
      }
      data-testid={dataTestId}
      zombie={isZombie}
      inMentions={inMentions}
      selected={isSelected}
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

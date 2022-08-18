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

const StyledSessionMemberItem = styled.div<{
  inMentions?: boolean;
  zombie?: boolean;
  selected?: boolean;
}>`
  cursor: pointer;
  flex-shrink: 0;
  font-family: var(--font-default);
  padding: 0px var(--margins-sm);
  height: ${props => (props.inMentions ? '40px' : '50px')};
  display: flex;
  justify-content: space-between;
  transition: var(--default-duration);

  opacity: ${props => (props.zombie ? 0.5 : 1)};

  :not(:last-child) {
    border-bottom: var(--border-session);
  }

  background-color: ${props =>
    props.selected ? 'var(--color-conversation-item-selected) !important' : null};
`;

const StyledInfo = styled.div`
  display: flex;
  align-items: center;
`;

const StyledName = styled.span`
  font-weight: bold;
  margin-inline-start: var(--margins-md);
  margin-inline-end: var(--margins-md);
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
        !inMentions
          ? {
              backgroundColor: 'var(--color-cell-background)',
            }
          : {}
      }
      role="button"
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
          <SessionRadio active={isSelected} value="tet" inputName="wewee" label="" />
        </StyledCheckContainer>
      )}
    </StyledSessionMemberItem>
  );
};

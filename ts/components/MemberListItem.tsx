import styled from 'styled-components';

import { useNicknameOrProfileNameOrShortenedPubkey } from '../hooks/useParamSelector';
import { Avatar, AvatarSize, CrownIcon } from './avatar/Avatar';
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
  withBorder?: boolean;
}>`
  cursor: ${props => (props.disabled ? 'not-allowed' : 'pointer')};
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
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

  ${props => props.inMentions && 'max-width: 300px;'}
  ${props =>
    props.withBorder &&
    `&:not(button:last-child) {
    border-bottom: 1px solid var(--border-color);
  }`}

  &:hover {
    background-color: var(--conversation-tab-background-hover-color);
  }
`;

const StyledInfo = styled.div`
  display: flex;
  align-items: center;
  min-width: 0;
`;

const StyledName = styled.span<{ maxName?: string }>`
  font-weight: bold;
  margin-inline-start: var(--margins-md);
  margin-inline-end: var(--margins-md);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  ${props => props.maxName && `max-width: ${props.maxName};`}
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
  withBorder?: boolean;
  maxNameWidth?: string;
  isAdmin?: boolean; // if true,  we add a small crown on top of their avatar
  onSelect?: (pubkey: string) => void;
  onUnselect?: (pubkey: string) => void;
  disabled?: boolean;
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
    withBorder = true,
    maxNameWidth,
    disabled,
    dataTestId,
  } = props;

  const memberName = useNicknameOrProfileNameOrShortenedPubkey(pubkey);

  return (
    <StyledSessionMemberItem
      onClick={() => {
        // eslint-disable-next-line no-unused-expressions
        isSelected ? onUnselect?.(pubkey) : onSelect?.(pubkey);
      }}
      data-testid={dataTestId}
      zombie={isZombie}
      inMentions={inMentions}
      selected={isSelected}
      disableBg={disableBg}
      withBorder={withBorder}
      disabled={disabled}
    >
      <StyledInfo>
        <AvatarItem memberPubkey={pubkey} isAdmin={isAdmin || false} />
        <StyledName maxName={maxNameWidth}>{memberName}</StyledName>
      </StyledInfo>

      {!inMentions && (
        <StyledCheckContainer>
          <SessionRadio active={isSelected} value={pubkey} inputName={pubkey} label="" />
        </StyledCheckContainer>
      )}
    </StyledSessionMemberItem>
  );
};

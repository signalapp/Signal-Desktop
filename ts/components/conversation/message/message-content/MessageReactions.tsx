import { isEmpty, isEqual } from 'lodash';
import React, { useEffect, useState } from 'react';
import styled from 'styled-components';
import { useIsDetailMessageView } from '../../../../contexts/isDetailViewContext';
import { useMessageReactsPropsById } from '../../../../hooks/useParamSelector';
import { MessageRenderingProps } from '../../../../models/messageType';
import { REACT_LIMIT } from '../../../../session/constants';
import { useSelectedIsGroupOrCommunity } from '../../../../state/selectors/selectedConversation';
import { SortedReactionList } from '../../../../types/Reaction';
import { nativeEmojiData } from '../../../../util/emoji';
import { Flex } from '../../../basic/Flex';
import { SessionIcon } from '../../../icon';
import { Reaction, ReactionProps } from '../reactions/Reaction';
import { StyledPopupContainer } from '../reactions/ReactionPopup';

export const popupXDefault = -81;
export const popupYDefault = -90;

export const StyledMessageReactionsContainer = styled(Flex)<{
  x: number;
  y: number;
  noAvatar: boolean;
}>`
  ${StyledPopupContainer} {
    position: absolute;
    top: ${props => `${props.y}px;`};
    left: ${props => `${props.x}px;`};
  }

  // MessageAvatar width + margin-inline-end
  ${props => !props.noAvatar && 'margin-inline-start: var(--width-avatar-group-msg-list);'}
`;

export const StyledMessageReactions = styled(Flex)<{ fullWidth: boolean }>`
  ${props => (props.fullWidth ? '' : 'max-width: 640px;')}
`;

const StyledReactionOverflow = styled.button`
  display: flex;
  flex-direction: row-reverse;
  justify-content: flex-start;
  align-items: center;

  border: none;
  margin-right: 4px;
  margin-bottom: var(--margins-sm);

  span {
    background-color: var(--message-bubbles-received-background-color);
    border: 1px solid var(--border-color);
    border-radius: 50%;
    overflow: hidden;
    margin-right: -9px;
    padding: 1px 4.5px;
  }
`;

const StyledReadLess = styled.span`
  font-size: var(--font-size-xs);
  margin-top: 8px;
  cursor: pointer;
  svg {
    margin-right: 5px;
  }
`;

type ReactionsProps = Omit<ReactionProps, 'emoji'>;

const Reactions = (props: ReactionsProps) => {
  const { messageId, reactions, inModal } = props;
  return (
    <StyledMessageReactions
      container={true}
      flexWrap={inModal ? 'nowrap' : 'wrap'}
      alignItems={'center'}
      fullWidth={inModal}
    >
      {reactions.map(([emoji, _]) => (
        <Reaction key={`${messageId}-${emoji}`} emoji={emoji} {...props} />
      ))}
    </StyledMessageReactions>
  );
};

interface ExpandReactionsProps extends ReactionsProps {
  handleExpand: () => void;
}

const CompressedReactions = (props: ExpandReactionsProps) => {
  const { messageId, reactions, inModal, handleExpand } = props;
  return (
    <StyledMessageReactions
      container={true}
      flexWrap={inModal ? 'nowrap' : 'wrap'}
      alignItems={'center'}
      fullWidth={true}
    >
      {reactions.slice(0, 4).map(([emoji, _]) => (
        <Reaction key={`${messageId}-${emoji}`} emoji={emoji} {...props} />
      ))}
      <StyledReactionOverflow onClick={handleExpand}>
        {reactions
          .slice(4, 7)
          .reverse()
          .map(([emoji, _]) => {
            return (
              <span
                key={`${messageId}-${emoji}`}
                role={'img'}
                aria-label={
                  nativeEmojiData?.ariaLabels ? nativeEmojiData.ariaLabels[emoji] : undefined
                }
              >
                {emoji}
              </span>
            );
          })}
      </StyledReactionOverflow>
    </StyledMessageReactions>
  );
};

const ExpandedReactions = (props: ExpandReactionsProps) => {
  const { handleExpand } = props;
  return (
    <Flex container={true} flexDirection={'column'} alignItems={'center'} margin="4px 0 0">
      <Reactions {...props} />
      <StyledReadLess onClick={handleExpand}>
        <SessionIcon iconType="chevron" iconSize="medium" iconRotation={180} />
        {window.i18n('expandedReactionsText')}
      </StyledReadLess>
    </Flex>
  );
};

export type MessageReactsSelectorProps = Pick<
  MessageRenderingProps,
  'convoId' | 'serverId' | 'reacts' | 'sortedReacts'
>;

type Props = {
  messageId: string;
  hasReactLimit?: boolean;
  onClick: (emoji: string) => void;
  popupReaction?: string;
  setPopupReaction?: (emoji: string) => void;
  onPopupClick?: () => void;
  inModal?: boolean;
  onSelected?: (emoji: string) => boolean;
  noAvatar: boolean;
};

export const MessageReactions = (props: Props) => {
  const isDetailView = useIsDetailMessageView();

  const {
    messageId,
    hasReactLimit = true,
    onClick,
    popupReaction,
    setPopupReaction,
    onPopupClick,
    inModal = false,
    onSelected,
    noAvatar,
  } = props;
  const [reactions, setReactions] = useState<SortedReactionList>([]);

  const [isExpanded, setIsExpanded] = useState(false);
  const handleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  const [popupX, setPopupX] = useState(popupXDefault);
  const [popupY, setPopupY] = useState(popupYDefault);

  const msgProps = useMessageReactsPropsById(messageId);

  const inGroup = useSelectedIsGroupOrCommunity();

  useEffect(() => {
    if (msgProps?.sortedReacts && !isEqual(reactions, msgProps?.sortedReacts)) {
      setReactions(msgProps?.sortedReacts);
    }

    if (!isEmpty(reactions) && isEmpty(msgProps?.sortedReacts)) {
      setReactions([]);
    }
  }, [msgProps?.sortedReacts, reactions]);

  if (!msgProps) {
    return null;
  }

  const { sortedReacts } = msgProps;

  if (!sortedReacts || !sortedReacts.length) {
    return null;
  }

  const reactionsProps = {
    messageId,
    reactions,
    inModal,
    inGroup,
    handlePopupX: setPopupX,
    handlePopupY: setPopupY,
    onClick: !isDetailView ? onClick : undefined,
    popupReaction,
    onSelected,
    handlePopupReaction: !isDetailView ? setPopupReaction : undefined,
    handlePopupClick: onPopupClick,
  };

  const ExtendedReactions = isExpanded ? ExpandedReactions : CompressedReactions;

  return (
    <StyledMessageReactionsContainer
      container={true}
      flexDirection={'column'}
      justifyContent={'center'}
      alignItems={inModal ? 'flex-start' : 'center'}
      x={popupX}
      y={popupY}
      noAvatar={noAvatar}
    >
      {sortedReacts &&
        sortedReacts?.length !== 0 &&
        (!hasReactLimit || sortedReacts.length <= REACT_LIMIT ? (
          <Reactions {...reactionsProps} />
        ) : (
          <ExtendedReactions handleExpand={handleExpand} {...reactionsProps} />
        ))}
    </StyledMessageReactionsContainer>
  );
};

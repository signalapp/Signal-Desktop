import React, { ReactElement, useEffect, useState } from 'react';
import styled from 'styled-components';
import { MessageRenderingProps } from '../../../../models/messageType';
import { isEmpty, isEqual } from 'lodash';
import { SortedReactionList } from '../../../../types/Reaction';
import { StyledPopupContainer } from '../reactions/ReactionPopup';
import { Flex } from '../../../basic/Flex';
import { nativeEmojiData } from '../../../../util/emoji';
import { Reaction, ReactionProps } from '../reactions/Reaction';
import { SessionIcon } from '../../../icon';
import { useMessageReactsPropsById } from '../../../../hooks/useParamSelector';
import { getSelectedConversationIsGroup } from '../../../../state/selectors/conversations';
import { useSelector } from 'react-redux';

export const popupXDefault = -81;
export const popupYDefault = -90;

const StyledMessageReactionsContainer = styled(Flex)<{ x: number; y: number }>`
  div:first-child {
    margin-left: 1.7rem;
  }
  ${StyledPopupContainer} {
    position: absolute;
    top: ${props => `${props.y}px;`};
    left: ${props => `${props.x}px;`};
  }
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

const Reactions = (props: ReactionsProps): ReactElement => {
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

const CompressedReactions = (props: ExpandReactionsProps): ReactElement => {
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

const ExpandedReactions = (props: ExpandReactionsProps): ReactElement => {
  const { handleExpand } = props;
  return (
    <>
      <Reactions {...props} />
      <StyledReadLess onClick={handleExpand}>
        <SessionIcon iconType="chevron" iconSize="medium" iconRotation={180} />
        {window.i18n('expandedReactionsText')}
      </StyledReadLess>
    </>
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
};

export const MessageReactions = (props: Props): ReactElement => {
  const {
    messageId,
    hasReactLimit = true,
    onClick,
    popupReaction,
    setPopupReaction,
    onPopupClick,
    inModal = false,
    onSelected,
  } = props;
  const [reactions, setReactions] = useState<SortedReactionList>([]);

  const [isExpanded, setIsExpanded] = useState(false);
  const handleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  const [popupX, setPopupX] = useState(popupXDefault);
  const [popupY, setPopupY] = useState(popupYDefault);

  const msgProps = useMessageReactsPropsById(messageId);

  const inGroup = useSelector(getSelectedConversationIsGroup);

  useEffect(() => {
    if (msgProps?.sortedReacts && !isEqual(reactions, msgProps?.sortedReacts)) {
      setReactions(msgProps?.sortedReacts);
    }

    if (!isEmpty(reactions) && isEmpty(msgProps?.sortedReacts)) {
      setReactions([]);
    }
  }, [msgProps?.sortedReacts, reactions]);

  if (!msgProps) {
    return <></>;
  }

  const { sortedReacts } = msgProps;

  const reactLimit = 6;

  const reactionsProps = {
    messageId,
    reactions,
    inModal,
    inGroup,
    handlePopupX: setPopupX,
    handlePopupY: setPopupY,
    onClick,
    popupReaction,
    onSelected,
    handlePopupReaction: setPopupReaction,
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
    >
      {sortedReacts &&
        sortedReacts?.length !== 0 &&
        (!hasReactLimit || sortedReacts.length <= reactLimit ? (
          <Reactions {...reactionsProps} />
        ) : (
          <ExtendedReactions handleExpand={handleExpand} {...reactionsProps} />
        ))}
    </StyledMessageReactionsContainer>
  );
};

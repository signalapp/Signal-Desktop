import React, { ReactElement, useRef, useState } from 'react';
import { useMouse } from 'react-use';
import styled from 'styled-components';
import { isUsAnySogsFromCache } from '../../../../session/apis/open_group_api/sogsv3/knownBlindedkeys';
import { UserUtils } from '../../../../session/utils';
import { useIsMessageSelectionMode } from '../../../../state/selectors/selectedConversation';
import { SortedReactionList } from '../../../../types/Reaction';
import { abbreviateNumber } from '../../../../util/abbreviateNumber';
import { nativeEmojiData } from '../../../../util/emoji';
import { popupXDefault, popupYDefault } from '../message-content/MessageReactions';
import { POPUP_WIDTH, ReactionPopup, TipPosition } from './ReactionPopup';

const StyledReaction = styled.button<{ selected: boolean; inModal: boolean; showCount: boolean }>`
  display: flex;
  justify-content: ${props => (props.showCount ? 'flex-start' : 'center')};
  align-items: center;

  background-color: var(--message-bubbles-received-background-color);
  border-width: 1px;
  border-style: solid;
  border-color: ${props => (props.selected ? 'var(--primary-color)' : 'var(--transparent-color)')};
  border-radius: 11px;
  box-sizing: border-box;
  padding: 0 7px;
  margin: 0 4px var(--margins-sm);
  height: 24px;
  min-width: ${props => (props.showCount ? '48px' : '24px')};

  span {
    width: 100%;
  }
`;

const StyledReactionContainer = styled.div<{
  inModal: boolean;
}>`
  position: relative;
  ${props => props.inModal && 'white-space: nowrap; margin-right: 8px;'}
`;

export type ReactionProps = {
  emoji: string;
  messageId: string;
  reactions: SortedReactionList;
  inModal: boolean;
  inGroup: boolean;
  handlePopupX: (x: number) => void;
  handlePopupY: (y: number) => void;
  onClick: (emoji: string) => void;
  popupReaction?: string;
  onSelected?: (emoji: string) => boolean;
  handlePopupReaction?: (emoji: string) => void;
  handlePopupClick?: () => void;
};

export const Reaction = (props: ReactionProps): ReactElement => {
  const {
    emoji,
    messageId,
    reactions,
    inModal,
    inGroup,
    handlePopupX,
    handlePopupY,
    onClick,
    popupReaction,
    onSelected,
    handlePopupReaction,
    handlePopupClick,
  } = props;

  const isMessageSelection = useIsMessageSelectionMode();
  const reactionsMap = (reactions && Object.fromEntries(reactions)) || {};
  const senders = reactionsMap[emoji]?.senders || [];
  const count = reactionsMap[emoji]?.count;
  const showCount = count !== undefined && (count > 1 || inGroup);

  const reactionRef = useRef<HTMLDivElement>(null);
  const { docX, elW } = useMouse(reactionRef);

  const gutterWidth = 380; // TODOLATER make this a variable which can be shared in CSS and JS
  const tooltipMidPoint = POPUP_WIDTH / 2; // px
  const [tooltipPosition, setTooltipPosition] = useState<TipPosition>('center');

  const me = UserUtils.getOurPubKeyStrFromCache();
  const isBlindedMe =
    senders && senders.length > 0 && senders.filter(isUsAnySogsFromCache).length > 0;

  const selected = () => {
    if (onSelected) {
      return onSelected(emoji);
    }

    return senders && senders.length > 0 && (senders.includes(me) || isBlindedMe);
  };

  const handleReactionClick = () => {
    if (!isMessageSelection) {
      onClick(emoji);
    }
  };

  return (
    <StyledReactionContainer ref={reactionRef} inModal={inModal}>
      <StyledReaction
        showCount={showCount}
        selected={selected()}
        inModal={inModal}
        onClick={handleReactionClick}
        onMouseEnter={() => {
          if (inGroup && !isMessageSelection) {
            const { innerWidth: windowWidth } = window;
            if (handlePopupReaction) {
              // overflow on far right means we shift left
              if (docX + elW + tooltipMidPoint > windowWidth) {
                handlePopupX(Math.abs(popupXDefault) * 1.5 * -1);
                setTooltipPosition('right');
                // overflow onto conversations means we lock to the right
              } else if (docX - elW <= gutterWidth + tooltipMidPoint) {
                const offset = -12.5;
                handlePopupX(offset);
                setTooltipPosition('left');
              } else {
                handlePopupX(popupXDefault);
                setTooltipPosition('center');
              }

              handlePopupReaction(emoji);
            }
          }
        }}
      >
        <span
          role={'img'}
          aria-label={nativeEmojiData?.ariaLabels ? nativeEmojiData.ariaLabels[emoji] : undefined}
        >
          {emoji}
          {showCount && `\u00A0\u00A0${abbreviateNumber(count)}`}
        </span>
      </StyledReaction>
      {inGroup && popupReaction && popupReaction === emoji && (
        <ReactionPopup
          messageId={messageId}
          emoji={popupReaction}
          count={reactionsMap[popupReaction]?.count}
          senders={reactionsMap[popupReaction]?.senders}
          tooltipPosition={tooltipPosition}
          onClick={() => {
            if (handlePopupReaction) {
              handlePopupReaction('');
            }
            handlePopupX(popupXDefault);
            handlePopupY(popupYDefault);
            setTooltipPosition('center');
            if (handlePopupClick) {
              handlePopupClick();
            }
          }}
        />
      )}
    </StyledReactionContainer>
  );
};

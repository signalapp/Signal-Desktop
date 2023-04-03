import React from 'react';
import styled, { CSSProperties } from 'styled-components';
import { Flex } from '../../basic/Flex';
import { SessionIconButton } from '../../icon';

export const StyledSubtitleContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  margin: 0 auto;
  min-width: 230px;

  div:first-child {
    span:last-child {
      margin-bottom: 0;
    }
  }
`;

const StyledSubtitleDot = styled.span<{ active: boolean }>`
  border-radius: 50%;
  background-color: ${props =>
    props.active ? 'var(--text-primary-color)' : 'var(--text-secondary-color)'};

  height: 5px;
  width: 5px;
  margin: 0 2px;
`;

const SubtitleDotMenu = ({
  options,
  selectedOptionIndex,
  style,
}: {
  options: Array<string | null>;
  selectedOptionIndex: number;
  style: CSSProperties;
}) => (
  <Flex container={true} alignItems={'center'} style={style}>
    {options.map((option, index) => {
      if (!option) {
        return null;
      }

      return (
        <StyledSubtitleDot
          key={`subtitleDotMenu-${index}`}
          active={selectedOptionIndex === index}
        />
      );
    })}
  </Flex>
);

type ConversationHeaderSubitleProps = {
  subtitles: Array<string>;
  currentIndex: number;
  setCurrentIndex: (index: number) => void;
  onClickFunction: () => void;
  showDisappearingMessageIcon: boolean;
};

export const ConversationHeaderSubitle = (props: ConversationHeaderSubitleProps) => {
  const {
    subtitles,
    currentIndex,
    setCurrentIndex,
    onClickFunction,
    showDisappearingMessageIcon,
  } = props;

  const handleTitleCycle = (direction: 1 | -1) => {
    let newIndex = currentIndex + direction;
    if (newIndex > subtitles.length - 1) {
      newIndex = 0;
    }

    if (newIndex < 0) {
      newIndex = subtitles.length - 1;
    }

    if (subtitles[newIndex]) {
      setCurrentIndex(newIndex);
    }
  };

  return (
    <StyledSubtitleContainer>
      <Flex
        container={true}
        flexDirection={'row'}
        justifyContent={subtitles.length < 2 ? 'center' : 'space-between'}
        alignItems={'center'}
        width={'100%'}
      >
        <SessionIconButton
          iconColor={'var(--button-icon-stroke-selected-color)'}
          iconSize={'small'}
          iconType="chevron"
          iconRotation={90}
          margin={'0 3px 0 0'}
          onClick={() => {
            handleTitleCycle(-1);
          }}
          isHidden={subtitles.length < 2}
          tabIndex={0}
        />
        {showDisappearingMessageIcon && (
          <SessionIconButton
            iconColor={'var(--button-icon-stroke-selected-color)'}
            iconSize={'tiny'}
            iconType="timer50"
            margin={'0 var(--margins-xs) 0 0'}
          />
        )}
        <span
          className="module-conversation-header__title-text"
          onKeyPress={(e: any) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onClickFunction();
            }
          }}
          tabIndex={0}
        >
          {subtitles[currentIndex]}
        </span>
        <SessionIconButton
          iconColor={'var(--button-icon-stroke-selected-color)'}
          iconSize={'small'}
          iconType="chevron"
          iconRotation={270}
          margin={'0 0 0 3px'}
          onClick={() => {
            handleTitleCycle(1);
          }}
          isHidden={subtitles.length < 2}
          tabIndex={0}
        />
      </Flex>
      <SubtitleDotMenu
        options={subtitles}
        selectedOptionIndex={currentIndex}
        style={{ display: subtitles.length < 2 ? 'none' : undefined, margin: '8px 0' }}
      />
    </StyledSubtitleContainer>
  );
};

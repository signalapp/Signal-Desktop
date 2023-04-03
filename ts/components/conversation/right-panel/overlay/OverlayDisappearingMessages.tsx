import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import styled from 'styled-components';
import { setDisappearingMessagesByConvoId } from '../../../../interactions/conversationInteractions';
import { closeRightPanel } from '../../../../state/ducks/conversations';
import { resetRightOverlayMode } from '../../../../state/ducks/section';
import { getSelectedConversationKey } from '../../../../state/selectors/conversations';
import { getTimerOptions } from '../../../../state/selectors/timerOptions';
import { Flex } from '../../../basic/Flex';
import { SessionButton } from '../../../basic/SessionButton';
import { SpacerLG } from '../../../basic/Text';
import { PanelButtonGroup } from '../../../buttons';
import { PanelLabel } from '../../../buttons/PanelButton';
import { PanelRadioButton } from '../../../buttons/PanelRadioButton';
import { SessionIconButton } from '../../../icon';

const StyledScrollContainer = styled.div`
  width: 100%;
  height: 100%;
  overflow: hidden auto;
`;

const StyledContainer = styled(Flex)`
  width: 100%;

  .session-button {
    font-weight: 500;
    min-width: 90px;
    width: fit-content;
    margin: 35px auto 0;
  }
`;

const StyledTitle = styled.h2`
  font-family: var(--font-default);
  text-align: center;
  margin-top: 0px;
  margin-bottom: 0px;
`;

const StyledSubTitle = styled.h3`
  font-family: var(--font-default);
  font-size: 11px;
  font-weight: 400;
  text-align: center;
  padding-top: 0px;
  margin-top: 0;
`;

type HeaderProps = {
  title: string;
  subtitle: string;
};

const Header = (props: HeaderProps) => {
  const { title, subtitle } = props;
  const dispatch = useDispatch();

  return (
    <Flex container={true} width={'100%'} padding={'32px var(--margins-lg) var(--margins-md)'}>
      <SessionIconButton
        iconSize={'medium'}
        iconType={'chevron'}
        iconRotation={90}
        onClick={() => {
          dispatch(resetRightOverlayMode());
        }}
      />
      <Flex
        container={true}
        flexDirection={'column'}
        justifyContent={'flex-start'}
        alignItems={'center'}
        width={'100%'}
        margin={'-5px auto auto'}
      >
        <StyledTitle>{title}</StyledTitle>
        <StyledSubTitle>{subtitle}</StyledSubTitle>
      </Flex>
      <SessionIconButton
        iconSize={'tiny'}
        iconType={'exit'}
        onClick={() => {
          dispatch(closeRightPanel());
          dispatch(resetRightOverlayMode());
        }}
      />
    </Flex>
  );
};

type TimerOptionsProps = {
  options: Array<any>;
  selected: number;
  setSelected: (value: number) => void;
};

const TimeOptions = (props: TimerOptionsProps) => {
  const { options, selected, setSelected } = props;

  return (
    <>
      <PanelLabel>{window.i18n('timer')}</PanelLabel>
      <PanelButtonGroup>
        {options.map((option: any) => (
          <PanelRadioButton
            key={option.name}
            text={option.name}
            value={option.name}
            isSelected={selected === option.value}
            onSelect={() => {
              setSelected(option.value);
            }}
            disableBg={true}
          />
        ))}
      </PanelButtonGroup>
    </>
  );
};

export const OverlayDisappearingMessages = () => {
  const selectedConversationKey = useSelector(getSelectedConversationKey);
  const timerOptions = useSelector(getTimerOptions).timerOptions;

  const [timeSelected, setTimeSelected] = useState(timerOptions[0].value);

  return (
    <StyledScrollContainer>
      <StyledContainer container={true} flexDirection={'column'} alignItems={'center'}>
        <Header
          title={window.i18n('disappearingMessages')}
          subtitle={window.i18n('disappearingMessagesSubtitle')}
        />
        <TimeOptions options={timerOptions} selected={timeSelected} setSelected={setTimeSelected} />
        <SessionButton
          onClick={async () => {
            if (selectedConversationKey) {
              await setDisappearingMessagesByConvoId(selectedConversationKey, timeSelected);
            }
          }}
        >
          {window.i18n('set')}
        </SessionButton>
        <SpacerLG />
      </StyledContainer>
    </StyledScrollContainer>
  );
};

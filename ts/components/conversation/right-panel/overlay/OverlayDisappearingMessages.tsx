import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import styled from 'styled-components';
import { setDisappearingMessagesByConvoId } from '../../../../interactions/conversationInteractions';
import { closeRightPanel } from '../../../../state/ducks/conversations';
import { resetRightOverlayMode } from '../../../../state/ducks/section';
import { getSelectedConversationKey } from '../../../../state/selectors/conversations';
import { Flex } from '../../../basic/Flex';
import { SessionButton } from '../../../basic/SessionButton';
import { SpacerLG, SpacerXL } from '../../../basic/Text';
import { PanelButtonGroup } from '../../../buttons';
import { PanelLabel } from '../../../buttons/PanelButton';
import { PanelRadioButton } from '../../../buttons/PanelRadioButton';
import { SessionIconButton } from '../../../icon';
import {
  getSelectedConversationExpirationModes,
  getSelectedConversationExpirationSettings,
} from '../../../../state/selectors/conversations';
import { DisappearingMessageConversationType } from '../../../../util/expiringMessages';
import { TimerOptionsArray } from '../../../../state/ducks/timerOptions';
import { useTimerOptionsByMode } from '../../../../hooks/useParamSelector';
import { isEmpty } from 'lodash';

const StyledScrollContainer = styled.div`
  width: 100%;
  height: 100%;
  overflow: hidden auto;
`;

const StyledContainer = styled(Flex)`
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

type DisappearingModesProps = {
  options: Array<DisappearingMessageConversationType>;
  selected?: DisappearingMessageConversationType;
  setSelected: (value: string) => void;
};

const DisappearingModes = (props: DisappearingModesProps) => {
  const { options, selected, setSelected } = props;
  return (
    <>
      <PanelLabel>{window.i18n('disappearingMessagesModeLabel')}</PanelLabel>
      <PanelButtonGroup>
        {options.map((option: DisappearingMessageConversationType) => {
          const optionI18n =
            option === 'off'
              ? window.i18n('disappearingMessagesModeOff')
              : option === 'deleteAfterRead'
              ? window.i18n('disappearingMessagesModeAfterRead')
              : window.i18n('disappearingMessagesModeAfterSend');

          const subtitleI18n =
            option === 'deleteAfterRead'
              ? window.i18n('disappearingMessagesModeAfterReadSubtitle')
              : option === 'deleteAfterSend'
              ? window.i18n('disappearingMessagesModeAfterSendSubtitle')
              : undefined;

          return (
            <PanelRadioButton
              key={option}
              text={optionI18n}
              subtitle={subtitleI18n}
              value={option}
              isSelected={selected === option}
              onSelect={() => {
                setSelected(option);
              }}
              disableBg={true}
            />
          );
        })}
      </PanelButtonGroup>
    </>
  );
};

type TimerOptionsProps = {
  options: TimerOptionsArray | null;
  selected?: number;
  setSelected: (value: number) => void;
};

const TimeOptions = (props: TimerOptionsProps) => {
  const { options, selected, setSelected } = props;

  if (!options || isEmpty(options)) {
    return null;
  }

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
  const dispatch = useDispatch();
  const selectedConversationKey = useSelector(getSelectedConversationKey);
  const disappearingModeOptions = useSelector(getSelectedConversationExpirationModes);

  const convoProps = useSelector(getSelectedConversationExpirationSettings);

  if (!convoProps) {
    return null;
  }

  const [modeSelected, setModeSelected] = useState(convoProps.expirationType);
  const [timeSelected, setTimeSelected] = useState(convoProps.expireTimer);
  const timerOptions = useTimerOptionsByMode(modeSelected);

  useEffect(() => {
    if (modeSelected !== convoProps.expirationType) {
      setModeSelected(convoProps.expirationType);
    }
    if (timeSelected !== convoProps.expireTimer) {
      setTimeSelected(convoProps.expireTimer);
    }
  }, [convoProps.expirationType, convoProps.expireTimer]);

  return (
    <StyledScrollContainer>
      <StyledContainer container={true} flexDirection={'column'} alignItems={'center'}>
        <Header
          title={window.i18n('disappearingMessages')}
          subtitle={window.i18n('disappearingMessagesSubtitle')}
        />
        <DisappearingModes
          options={disappearingModeOptions}
          selected={modeSelected}
          setSelected={setModeSelected}
        />
        {modeSelected !== 'off' && (
          <>
            <SpacerLG />
            <TimeOptions
              options={timerOptions}
              selected={timeSelected}
              setSelected={setTimeSelected}
            />
          </>
        )}
        <SessionButton
          onClick={async () => {
            if (selectedConversationKey && modeSelected && timeSelected) {
              await setDisappearingMessagesByConvoId(
                selectedConversationKey,
                modeSelected,
                timeSelected
              );
              dispatch(closeRightPanel());
              dispatch(resetRightOverlayMode());
            }
          }}
        >
          {window.i18n('set')}
        </SessionButton>
        <SpacerLG />
        <SpacerXL />
      </StyledContainer>
    </StyledScrollContainer>
  );
};

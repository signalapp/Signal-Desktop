import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import styled from 'styled-components';
import { setDisappearingMessagesByConvoId } from '../../../../interactions/conversationInteractions';
import { resetRightOverlayMode } from '../../../../state/ducks/section';
import { getSelectedConversationKey } from '../../../../state/selectors/conversations';
import { getTimerOptions } from '../../../../state/selectors/timerOptions';
import { SessionButton } from '../../../basic/SessionButton';
import { PanelButtonGroup } from '../../../buttons';
import { PanelRadioButton } from '../../../buttons/PanelRadioButton';

const StyledContainer = styled.div`
  width: 100%;

  .session-button {
    font-weight: 500;
    min-width: 90px;
    width: fit-content;
    margin: 35px auto 0;
  }
`;

type TimerOptionsProps = {
  options: any[];
  selected: number;
  setSelected: (value: number) => void;
};

const TimeOptions = (props: TimerOptionsProps) => {
  const { options, selected, setSelected } = props;

  return (
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
  );
};

export const OverlayDisappearingMessages = () => {
  const dispatch = useDispatch();
  const selectedConversationKey = useSelector(getSelectedConversationKey);
  const timerOptions = useSelector(getTimerOptions).timerOptions;

  const [selected, setSelected] = useState(timerOptions[0].value);

  return (
    <StyledContainer>
      <div
        onClick={() => {
          dispatch(resetRightOverlayMode());
        }}
      >
        TODO
      </div>
      <TimeOptions options={timerOptions} selected={selected} setSelected={setSelected} />
      <SessionButton
        onClick={() => {
          if (selectedConversationKey) {
            void setDisappearingMessagesByConvoId(selectedConversationKey, selected);
          }
        }}
      >
        {window.i18n('set')}
      </SessionButton>
    </StyledContainer>
  );
};

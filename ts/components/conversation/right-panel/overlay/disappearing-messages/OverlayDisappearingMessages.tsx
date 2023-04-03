import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import styled from 'styled-components';
import { setDisappearingMessagesByConvoId } from '../../../../../interactions/conversationInteractions';
import { closeRightPanel } from '../../../../../state/ducks/conversations';
import { resetRightOverlayMode } from '../../../../../state/ducks/section';
import { Flex } from '../../../../basic/Flex';
import { SessionButton } from '../../../../basic/SessionButton';
import { SpacerLG, SpacerXL } from '../../../../basic/Text';
import {
  getSelectedConversationExpirationModes,
  getSelectedConversationExpirationModesWithLegacy,
  getSelectedConversationExpirationSettings,
  getSelectedConversationKey,
} from '../../../../../state/selectors/conversations';
import { DEFAULT_TIMER_OPTION } from '../../../../../util/expiringMessages';
import { useTimerOptionsByMode } from '../../../../../hooks/useParamSelector';
import { Header } from './Header';
import { DisappearingModes } from './DisappearingModes';
import { TimeOptions } from './TimeOptions';

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

const StyledNonAdminDescription = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  margin: 0 var(--margins-lg);
  color: var(--text-secondary-color);
  font-size: var(--font-size-xs);
  text-align: center;
  line-height: 15px;
`;

type OverlayDisappearingMessagesProps = { unlockNewModes: boolean };

export const OverlayDisappearingMessages = (props: OverlayDisappearingMessagesProps) => {
  const { unlockNewModes } = props;
  const dispatch = useDispatch();
  const selectedConversationKey = useSelector(getSelectedConversationKey);
  const disappearingModeOptions = useSelector(
    unlockNewModes
      ? getSelectedConversationExpirationModes
      : getSelectedConversationExpirationModesWithLegacy
  );

  // NOTE if there is only 'off' and one disappearing message mode then we trigger single mode
  const singleMode =
    disappearingModeOptions['off'] !== undefined &&
    Object.keys(disappearingModeOptions).length === 2
      ? Object.keys(disappearingModeOptions)[1]
      : undefined;
  const hasOnlyOneMode = Boolean(singleMode && singleMode.length > 0);

  const convoProps = useSelector(getSelectedConversationExpirationSettings);

  if (!convoProps) {
    return null;
  }

  const { isGroup, weAreAdmin } = convoProps;

  const [modeSelected, setModeSelected] = useState(convoProps.expirationType);
  const [timeSelected, setTimeSelected] = useState(
    convoProps.expireTimer && convoProps.expireTimer > -1
      ? convoProps.expireTimer
      : isGroup
      ? DEFAULT_TIMER_OPTION.GROUP
      : DEFAULT_TIMER_OPTION.PRIVATE_CONVERSATION
  );

  // TODO verify that this if fine compared to updating in the useEffect
  const timerOptions = useTimerOptionsByMode(modeSelected, hasOnlyOneMode);

  const handleSetMode = async () => {
    if (hasOnlyOneMode) {
      if (selectedConversationKey && singleMode) {
        await setDisappearingMessagesByConvoId(
          selectedConversationKey,
          timeSelected === 0 ? 'off' : singleMode,
          timeSelected
        );
        dispatch(closeRightPanel());
        dispatch(resetRightOverlayMode());
      }
    } else {
      if (selectedConversationKey && modeSelected && timeSelected) {
        await setDisappearingMessagesByConvoId(selectedConversationKey, modeSelected, timeSelected);
        dispatch(closeRightPanel());
        dispatch(resetRightOverlayMode());
      }
    }
  };

  useEffect(() => {
    if (modeSelected !== convoProps.expirationType) {
      setModeSelected(convoProps.expirationType);
    }
    if (convoProps.expireTimer && timeSelected !== convoProps.expireTimer) {
      setTimeSelected(convoProps.expireTimer);
    }
  }, [convoProps.expirationType, convoProps.expireTimer]);

  return (
    <StyledScrollContainer>
      <StyledContainer container={true} flexDirection={'column'} alignItems={'center'}>
        <Header
          title={window.i18n('disappearingMessages')}
          subtitle={
            singleMode === 'deleteAfterRead'
              ? window.i18n('disappearingMessagesModeAfterReadSubtitle')
              : singleMode === 'deleteAfterSend'
              ? window.i18n('disappearingMessagesModeAfterSendSubtitle')
              : window.i18n('settingAppliesToEveryone')
          }
        />
        <DisappearingModes
          options={disappearingModeOptions}
          selected={modeSelected}
          setSelected={setModeSelected}
          hasOnlyOneMode={hasOnlyOneMode}
        />
        {(hasOnlyOneMode || modeSelected !== 'off') && (
          <>
            {!hasOnlyOneMode && <SpacerLG />}
            <TimeOptions
              options={timerOptions}
              selected={timeSelected}
              setSelected={setTimeSelected}
              hasOnlyOneMode={hasOnlyOneMode}
              disabled={
                singleMode
                  ? disappearingModeOptions[singleMode]
                  : modeSelected
                  ? disappearingModeOptions[modeSelected]
                  : undefined
              }
            />
          </>
        )}
        {isGroup && !weAreAdmin && (
          <>
            <SpacerLG />
            <StyledNonAdminDescription>
              {window.i18n('settingAppliesToEveryone')}
              <br />
              {window.i18n('onlyGroupAdminsCanChange')}
            </StyledNonAdminDescription>
          </>
        )}
        <SessionButton
          onClick={handleSetMode}
          disabled={
            singleMode
              ? disappearingModeOptions[singleMode]
              : modeSelected
              ? disappearingModeOptions[modeSelected]
              : undefined
          }
        >
          {window.i18n('set')}
        </SessionButton>
        <SpacerLG />
        <SpacerXL />
      </StyledContainer>
    </StyledScrollContainer>
  );
};

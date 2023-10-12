import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import styled from 'styled-components';
import { useTimerOptionsByMode } from '../../../../../hooks/useParamSelector';
import { setDisappearingMessagesByConvoId } from '../../../../../interactions/conversationInteractions';
import { TimerOptions } from '../../../../../session/disappearing_messages/timerOptions';
import { DisappearingMessageConversationModeType } from '../../../../../session/disappearing_messages/types';
import { closeRightPanel } from '../../../../../state/ducks/conversations';
import { resetRightOverlayMode } from '../../../../../state/ducks/section';
import {
  getSelectedConversationExpirationModes,
  useSelectedConversationDisappearingMode,
  useSelectedConversationKey,
  useSelectedExpireTimer,
  useSelectedIsGroup,
  useSelectedIsNoteToSelf,
  useSelectedWeAreAdmin,
} from '../../../../../state/selectors/selectedConversation';
import { ReleasedFeatures } from '../../../../../util/releaseFeature';
import { Flex } from '../../../../basic/Flex';
import { SessionButton } from '../../../../basic/SessionButton';
import { SpacerLG, SpacerXL } from '../../../../basic/Text';
import { DisappearingModes } from './DisappearingModes';
import { Header } from './Header';
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

// TODO legacy messages support will be removed in a future release
function loadDefaultTimeValue(
  modeSelected: DisappearingMessageConversationModeType | undefined,
  hasOnlyOneMode: boolean
) {
  // NOTE if there is only 1 disappearing message mode available the default state is that it is turned off
  if (hasOnlyOneMode) {
    return 0;
  }

  return modeSelected !== 'off'
    ? modeSelected !== 'legacy'
      ? modeSelected === 'deleteAfterSend'
        ? TimerOptions.DEFAULT_OPTIONS.DELETE_AFTER_SEND
        : TimerOptions.DEFAULT_OPTIONS.DELETE_AFTER_READ
      : TimerOptions.DEFAULT_OPTIONS.LEGACY
    : 0;
}

export type PropsForExpirationSettings = {
  expirationMode: DisappearingMessageConversationModeType | undefined;
  expireTimer: number | undefined;
  isGroup: boolean | undefined;
  weAreAdmin: boolean | undefined;
};

export const OverlayDisappearingMessages = () => {
  const dispatch = useDispatch();
  const selectedConversationKey = useSelectedConversationKey();
  const disappearingModeOptions = useSelector(getSelectedConversationExpirationModes);

  // NOTE if there is only 'off' and one disappearing message mode then we trigger single mode
  const singleMode: DisappearingMessageConversationModeType | undefined =
    disappearingModeOptions &&
    disappearingModeOptions.off !== undefined &&
    Object.keys(disappearingModeOptions).length === 2
      ? (Object.keys(disappearingModeOptions)[1] as DisappearingMessageConversationModeType)
      : undefined;
  const hasOnlyOneMode = Boolean(singleMode && singleMode.length > 0);

  const isMe = useSelectedIsNoteToSelf();
  const isGroup = useSelectedIsGroup();
  const expirationMode = useSelectedConversationDisappearingMode();
  const expireTimer = useSelectedExpireTimer();
  const weAreAdmin = useSelectedWeAreAdmin();

  const [modeSelected, setModeSelected] = useState<
    DisappearingMessageConversationModeType | undefined
  >(hasOnlyOneMode ? singleMode : expirationMode);

  const [timeSelected, setTimeSelected] = useState(expireTimer || 0);
  const timerOptions = useTimerOptionsByMode(modeSelected, hasOnlyOneMode);

  const isV2Released = ReleasedFeatures.isDisappearMessageV2FeatureReleasedCached();

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
      return;
    }
    if (selectedConversationKey && modeSelected) {
      await setDisappearingMessagesByConvoId(selectedConversationKey, modeSelected, timeSelected);
      dispatch(closeRightPanel());
      dispatch(resetRightOverlayMode());
    }
  };

  const handleSetTime = (value: number) => {
    setTimeSelected(value);
  };

  useEffect(() => {
    if (!isV2Released) {
      setModeSelected(
        expirationMode === 'deleteAfterRead' || expirationMode === 'deleteAfterSend'
          ? 'legacy'
          : expirationMode
      );
    }
  }, [expirationMode, isV2Released]);

  // TODO legacy messages support will be removed in a future release
  useEffect(() => {
    if (isV2Released && modeSelected === 'legacy') {
      const newModeSelected = isMe || isGroup ? 'deleteAfterSend' : 'deleteAfterRead';
      const newTimeSelected = loadDefaultTimeValue(newModeSelected, hasOnlyOneMode);

      if (selectedConversationKey) {
        void setDisappearingMessagesByConvoId(
          selectedConversationKey,
          newModeSelected,
          newTimeSelected
        );
        dispatch(closeRightPanel());
        dispatch(resetRightOverlayMode());
      }
    }
  }, [
    dispatch,
    hasOnlyOneMode,
    isGroup,
    isMe,
    isV2Released,
    modeSelected,
    selectedConversationKey,
  ]);

  useEffect(() => {
    // NOTE loads a time value from the conversation model or the default
    handleSetTime(
      expireTimer !== undefined && expireTimer > -1
        ? expireTimer
        : loadDefaultTimeValue(modeSelected, hasOnlyOneMode)
    );
  }, [expireTimer, hasOnlyOneMode, modeSelected]);

  // useEffect(() => {
  //   window.log.debug(
  //     `WIP: OverlayDisappearingMessages: \nmodeSelected ${modeSelected} \nsingleMode ${singleMode} \ntimeSelected ${timeSelected} \ntimerOptions ${JSON.stringify(
  //       timerOptions.map(option => option.name)
  //     )}`
  //   );
  // }, [modeSelected, timeSelected]);

  if (!disappearingModeOptions) {
    return null;
  }

  if (!selectedConversationKey) {
    return null;
  }

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
              setSelected={handleSetTime}
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
        {isGroup && isV2Released && !weAreAdmin && (
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
          dataTestId={'disappear-set-button'}
        >
          {window.i18n('set')}
        </SessionButton>
        <SpacerLG />
        <SpacerXL />
      </StyledContainer>
    </StyledScrollContainer>
  );
};

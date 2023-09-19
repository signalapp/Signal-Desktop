import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import styled from 'styled-components';
import { useTimerOptionsByMode } from '../../../../../hooks/useParamSelector';
import { setDisappearingMessagesByConvoId } from '../../../../../interactions/conversationInteractions';
import { closeRightPanel } from '../../../../../state/ducks/conversations';
import { resetRightOverlayMode } from '../../../../../state/ducks/section';
import {
  getSelectedConversationExpirationModes,
  useSelectedConversationKey,
  useSelectedConversationExpirationType,
  useSelectedExpireTimer,
  useSelectedIsGroup,
  useSelectedWeAreAdmin,
} from '../../../../../state/selectors/selectedConversation';
import {
  DEFAULT_TIMER_OPTION,
  DisappearingMessageConversationType,
} from '../../../../../util/expiringMessages';
import { Flex } from '../../../../basic/Flex';
import { SessionButton } from '../../../../basic/SessionButton';
import { SpacerLG, SpacerXL } from '../../../../basic/Text';
import { DisappearingModes } from './DisappearingModes';
import { Header } from './Header';
import { TimeOptions } from './TimeOptions';
import { ReleasedFeatures } from '../../../../../util/releaseFeature';

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
function loadDefaultTimeValue(modeSelected: DisappearingMessageConversationType | undefined) {
  return modeSelected !== 'off'
    ? modeSelected !== 'legacy'
      ? modeSelected === 'deleteAfterSend'
        ? DEFAULT_TIMER_OPTION.DELETE_AFTER_SEND
        : DEFAULT_TIMER_OPTION.DELETE_AFTER_READ
      : DEFAULT_TIMER_OPTION.LEGACY
    : 0;
}

export type PropsForExpirationSettings = {
  expirationType: DisappearingMessageConversationType | undefined;
  expireTimer: number | undefined;
  isGroup: boolean | undefined;
  weAreAdmin: boolean | undefined;
};

export const OverlayDisappearingMessages = () => {
  const dispatch = useDispatch();
  const selectedConversationKey = useSelectedConversationKey();
  const disappearingModeOptions = useSelector(getSelectedConversationExpirationModes);

  // NOTE if there is only 'off' and one disappearing message mode then we trigger single mode
  const singleMode: DisappearingMessageConversationType | undefined =
    disappearingModeOptions &&
    disappearingModeOptions.off !== undefined &&
    Object.keys(disappearingModeOptions).length === 2
      ? (Object.keys(disappearingModeOptions)[1] as DisappearingMessageConversationType)
      : undefined;
  const hasOnlyOneMode = Boolean(singleMode && singleMode.length > 0);

  const isGroup = useSelectedIsGroup();
  const expirationType = useSelectedConversationExpirationType();
  const expireTimer = useSelectedExpireTimer();
  const weAreAdmin = useSelectedWeAreAdmin();

  const [modeSelected, setModeSelected] = useState<DisappearingMessageConversationType | undefined>(
    hasOnlyOneMode ? singleMode : expirationType
  );

  const [timeSelected, setTimeSelected] = useState(expireTimer || 0);
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
    if (!ReleasedFeatures.isDisappearMessageV2FeatureReleasedCached()) {
      setModeSelected(
        expirationType === 'deleteAfterRead' || expirationType === 'deleteAfterSend'
          ? 'legacy'
          : expirationType
      );
    }
  }, [expirationType]);

  useEffect(() => {
    // NOTE loads a time value from the conversation model or the default
    handleSetTime(
      expireTimer && expireTimer > -1 ? expireTimer : loadDefaultTimeValue(modeSelected)
    );
  }, [expireTimer, modeSelected]);

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

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
  useSelectedIsGroupOrCommunity,
  useSelectedWeAreAdmin,
} from '../../../../../state/selectors/selectedConversation';
import { ReleasedFeatures } from '../../../../../util/releaseFeature';
import { Flex } from '../../../../basic/Flex';
import { SessionButton } from '../../../../basic/SessionButton';
import { SpacerLG } from '../../../../basic/Text';
import { Header, HeaderSubtitle, HeaderTitle, StyledScrollContainer } from '../components';
import { DisappearingModes } from './DisappearingModes';
import { TimeOptions } from './TimeOptions';

const ButtonSpacer = styled.div`
  height: 80px;
`;

const StyledButtonContainer = styled.div`
  background: linear-gradient(0deg, var(--background-primary-color), transparent);
  position: absolute;
  width: 100%;
  bottom: 0px;

  .session-button {
    font-weight: 500;
    min-width: 90px;
    width: fit-content;
    margin: 35px auto 10px;
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

/** if there is only one disappearing message mode and 'off' enabled then we trigger single mode UI */
function useSingleMode(disappearingModeOptions: any) {
  const singleMode: DisappearingMessageConversationModeType | undefined =
    disappearingModeOptions &&
    disappearingModeOptions.off !== undefined &&
    Object.keys(disappearingModeOptions).length === 2
      ? (Object.keys(disappearingModeOptions)[1] as DisappearingMessageConversationModeType)
      : undefined;
  const hasOnlyOneMode = Boolean(singleMode && singleMode.length > 0);

  return { singleMode, hasOnlyOneMode };
}

// TODO legacy messages support will be removed in a future release
function useLegacyModeBeforeV2Release(
  isV2Released: boolean,
  expirationMode: DisappearingMessageConversationModeType | undefined,
  setModeSelected: (mode: DisappearingMessageConversationModeType | undefined) => void
) {
  useEffect(() => {
    if (!isV2Released) {
      setModeSelected(
        expirationMode === 'deleteAfterRead' || expirationMode === 'deleteAfterSend'
          ? 'legacy'
          : expirationMode
      );
    }
  }, [expirationMode, isV2Released, setModeSelected]);
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
  const { singleMode, hasOnlyOneMode } = useSingleMode(disappearingModeOptions);

  const isGroup = useSelectedIsGroupOrCommunity();
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

  useLegacyModeBeforeV2Release(isV2Released, expirationMode, setModeSelected);

  useEffect(() => {
    // NOTE loads a time value from the conversation model or the default
    setTimeSelected(
      expireTimer !== undefined && expireTimer > -1
        ? expireTimer
        : loadDefaultTimeValue(modeSelected, hasOnlyOneMode)
    );
  }, [expireTimer, hasOnlyOneMode, modeSelected]);

  if (!disappearingModeOptions) {
    return null;
  }

  if (!selectedConversationKey) {
    return null;
  }

  return (
    <StyledScrollContainer>
      <Flex container={true} flexDirection={'column'} alignItems={'center'}>
        <Header>
          <HeaderTitle>{window.i18n('disappearingMessages')}</HeaderTitle>
          <HeaderSubtitle>
            {singleMode === 'deleteAfterRead'
              ? window.i18n('disappearingMessagesModeAfterReadSubtitle')
              : singleMode === 'deleteAfterSend'
                ? window.i18n('disappearingMessagesModeAfterSendSubtitle')
                : window.i18n('settingAppliesToYourMessages')}
          </HeaderSubtitle>
        </Header>
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
        <ButtonSpacer />

        <StyledButtonContainer>
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
        </StyledButtonContainer>
      </Flex>
    </StyledScrollContainer>
  );
};

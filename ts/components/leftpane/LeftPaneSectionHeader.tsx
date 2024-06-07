import { useDispatch, useSelector } from 'react-redux';
import styled from 'styled-components';
import { clearSearch } from '../../state/ducks/search';
import {
  SectionType,
  setLeftOverlayMode,
  showLeftPaneSection,
  showSettingsSection,
} from '../../state/ducks/section';
import { disableRecoveryPhrasePrompt } from '../../state/ducks/userConfig';
import { getFocusedSection, getLeftOverlayMode } from '../../state/selectors/section';
import { useHideRecoveryPasswordEnabled } from '../../state/selectors/settings';
import { getTheme } from '../../state/selectors/theme';
import { getShowRecoveryPhrasePrompt } from '../../state/selectors/userConfig';
import { isSignWithRecoveryPhrase } from '../../util/storage';
import { Flex } from '../basic/Flex';
import { SessionButton } from '../basic/SessionButton';
import { SpacerMD, SpacerSM } from '../basic/Text';
import { MenuButton } from '../buttons';
import { SessionIcon, SessionIconButton } from '../icon';

const StyledLeftPaneSectionHeader = styled(Flex)`
  height: var(--main-view-header-height);
  padding-inline-end: 7px;
  transition: var(--default-duration);
`;

const SectionTitle = styled.h1`
  padding-top: var(--margins-xs);
  flex-grow: 1;
  color: var(--text-primary-color);
`;

const StyledProgressBarContainer = styled.div`
  width: 100%;
  height: 5px;
  flex-direction: row;
  background: var(--border-color);
`;

const StyledProgressBarInner = styled.div`
  background: var(--primary-color);
  width: 100%;
  transition: width var(--default-duration) ease-in;
  height: 100%;
`;

const StyledBanner = styled(Flex)`
  p {
    padding: 0;
    margin: 0;
    line-height: 1.2;
  }

  p:nth-child(2) {
    font-size: 12px;
  }

  .session-button {
    width: 100%;
  }

  svg {
    margin-top: -3px;
    margin-left: var(--margins-xs);
  }
`;

const StyledBannerTitle = styled.p`
  font-size: var(--font-size-h4);
  font-weight: 500;
  line-height: 1;
`;

const StyledLeftPaneBanner = styled.div`
  background: var(--background-secondary-color);
  display: flex;
  flex-direction: column;
  border-bottom: 1px solid var(--border-color);
`;

export const LeftPaneBanner = () => {
  const theme = useSelector(getTheme);
  const section = useSelector(getFocusedSection);
  const isSignInWithRecoveryPhrase = isSignWithRecoveryPhrase();
  const hideRecoveryPassword = useHideRecoveryPasswordEnabled();

  const dispatch = useDispatch();

  const showRecoveryPhraseModal = () => {
    dispatch(disableRecoveryPhrasePrompt());
    dispatch(showLeftPaneSection(SectionType.Settings));
    dispatch(showSettingsSection('recoveryPassword'));
  };

  if (section !== SectionType.Message || isSignInWithRecoveryPhrase || hideRecoveryPassword) {
    return null;
  }

  return (
    <StyledLeftPaneBanner>
      <StyledProgressBarContainer>
        <StyledProgressBarInner />
      </StyledProgressBarContainer>
      <StyledBanner
        container={true}
        width={'100%'}
        flexDirection="column"
        alignItems={'flex-start'}
        padding={'var(--margins-md)'}
      >
        <Flex container={true} width={'100%'} alignItems="flex-start">
          <StyledBannerTitle>{window.i18n('saveRecoveryPassword')}</StyledBannerTitle>
          <SessionIcon
            iconType={theme.includes('dark') ? 'recoveryPasswordFill' : 'recoveryPasswordOutline'}
            iconSize="medium"
            iconColor="var(--text-primary-color)"
          />
        </Flex>
        <p>{window.i18n('saveRecoveryPasswordDescription')}</p>
        <SpacerMD />
        <SessionButton
          ariaLabel="Reveal recovery phrase button"
          text={window.i18n('continue')}
          onClick={showRecoveryPhraseModal}
          dataTestId="reveal-recovery-phrase"
        />
      </StyledBanner>
    </StyledLeftPaneBanner>
  );
};

export const LeftPaneSectionHeader = () => {
  const showRecoveryPhrasePrompt = useSelector(getShowRecoveryPhrasePrompt);
  const focusedSection = useSelector(getFocusedSection);
  const leftOverlayMode = useSelector(getLeftOverlayMode);

  const dispatch = useDispatch();
  const returnToActionChooser = () => {
    if (leftOverlayMode === 'closed-group') {
      dispatch(clearSearch());
    }
    dispatch(setLeftOverlayMode('choose-action'));
  };

  let label: string | undefined;

  const isMessageSection = focusedSection === SectionType.Message;

  let leftOverlayHeading = '';

  switch (leftOverlayMode) {
    case 'open-group':
      leftOverlayHeading = window.i18n('joinOpenGroup');
      break;
    case 'closed-group':
      leftOverlayHeading = window.i18n('createGroup');
      break;
    case 'message':
      leftOverlayHeading = window.i18n('newMessage');
      break;
    case 'message-requests':
      leftOverlayHeading = window.i18n('messageRequests');
      break;
    case 'invite-a-friend':
      leftOverlayHeading = window.i18n('sessionInviteAFriend');
      break;
    case 'choose-action':
    default:
      leftOverlayHeading = window.i18n('messagesHeader');
  }

  switch (focusedSection) {
    case SectionType.Settings:
      label = window.i18n('settingsHeader');
      break;
    case SectionType.Message:
      label = leftOverlayHeading;
      break;
    default:
  }

  return (
    <Flex flexDirection="column">
      <StyledLeftPaneSectionHeader
        container={true}
        flexDirection="row"
        justifyContent="space-between"
        alignItems="center"
      >
        {leftOverlayMode &&
        leftOverlayMode !== 'choose-action' &&
        leftOverlayMode !== 'message-requests' ? (
          <SessionIconButton
            ariaLabel="Back button"
            iconSize="medium"
            iconType="chevron"
            iconRotation={90}
            onClick={returnToActionChooser}
            dataTestId="back-button"
          />
        ) : (
          <SpacerSM />
        )}
        <SectionTitle>{label}</SectionTitle>
        {isMessageSection && <MenuButton />}
      </StyledLeftPaneSectionHeader>
      {showRecoveryPhrasePrompt && <LeftPaneBanner />}
    </Flex>
  );
};

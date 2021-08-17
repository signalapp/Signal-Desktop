import React, { useState } from 'react';
import classNames from 'classnames';
import { SessionIcon, SessionIconSize, SessionIconType } from './icon';
import styled, { DefaultTheme, useTheme } from 'styled-components';
import { SessionButton, SessionButtonType } from './SessionButton';
import { Constants } from '../../session';
import { UserUtils } from '../../session/utils';
import { useDispatch, useSelector } from 'react-redux';
import { disableRecoveryPhrasePrompt } from '../../state/ducks/userConfig';
import { getShowRecoveryPhrasePrompt } from '../../state/selectors/userConfig';
import { recoveryPhraseModal } from '../../state/ducks/modalDialog';
import { Flex } from '../basic/Flex';

const Tab = ({
  isSelected,
  label,
  onSelect,
  type,
}: {
  isSelected: boolean;
  label: string;
  onSelect?: (event: number) => void;
  type: number;
}) => {
  const handleClick = onSelect
    ? () => {
        onSelect(type);
      }
    : undefined;

  return (
    <h1
      className={classNames('module-left-pane__title', isSelected ? 'active' : null)}
      onClick={handleClick}
      role="button"
    >
      {label}
    </h1>
  );
};

type Props = {
  label?: string;
  buttonIcon?: SessionIconType;
  buttonClicked?: any;
};

export const LeftPaneSectionHeader = (props: Props) => {
  const { label, buttonIcon, buttonClicked } = props;
  const theme = useTheme();
  const showRecoveryPhrasePrompt = useSelector(getShowRecoveryPhrasePrompt);

  return (
    <Flex flexDirection={'column'}>
      <div className="module-left-pane__header">
        {label && <Tab label={label} type={0} isSelected={true} key={label} />}
        {buttonIcon && (
          <SessionButton onClick={buttonClicked} key="compose" theme={theme}>
            <SessionIcon
              iconType={buttonIcon}
              iconSize={SessionIconSize.Small}
              iconColor="white"
              theme={theme}
            />
          </SessionButton>
        )}
      </div>
      {showRecoveryPhrasePrompt && <LeftPaneBanner />}
    </Flex>
  );
};

export const LeftPaneBanner = () => {
  const [completion, setCompletion] = useState(90);
  const [bodyText, setBodyText] = useState(window.i18n('recoveryPhraseRevealMessage'));
  const [buttonText, setButtonText] = useState(window.i18n('recoveryPhraseRevealButtonText'));
  const [recoveryPhraseHidden, setRecoveryPhraseHidden] = useState(true);
  const [isCompleted, setIsCompleted] = useState(false);
  const [bannerTitle, setBannerTitle] = useState(window.i18n('recoveryPhraseSecureTitle'));
  const recoveryPhrase = UserUtils.getCurrentRecoveryPhrase();
  const secondsBeforeRemoval = 2 * 1000;
  const completionText = `${completion}%`;

  const dispatch = useDispatch();

  const showRecoveryPhraseModal = () => {
    dispatch(
      recoveryPhraseModal({
        onClickOk: () => {
          setCompletion(100);
          setBannerTitle(window.i18n('recoveryPhraseCompleteTitle'));
          setBodyText('');
          setRecoveryPhraseHidden(true);
          setIsCompleted(true);

          // remove banner after a small delay
          setTimeout(() => {
            dispatch(disableRecoveryPhrasePrompt());
          }, secondsBeforeRemoval);
        },
      })
    );
  };

  const BannerInner = () => {
    return (
      <StyledBannerInner>
        <p>{bodyText}</p>
        {!recoveryPhraseHidden && (
          <StyledRecoveryPhrase theme={theme} className="left-pane-banner___phrase">
            {recoveryPhrase}
          </StyledRecoveryPhrase>
        )}
        {!isCompleted && (
          <SessionButton
            buttonType={SessionButtonType.Default}
            text={buttonText}
            onClick={showRecoveryPhraseModal}
          />
        )}
      </StyledBannerInner>
    );
  };

  const theme = useTheme();

  return (
    <StyledLeftPaneBanner border={useTheme().colors.sessionBorder} isCompleted={isCompleted}>
      <StyledProgressBarContainer>
        <StyledProgressBarInner color={Constants.UI.COLORS.GREEN} width={`${completion}%`} />
      </StyledProgressBarContainer>
      <StyledBannerTitle theme={theme}>
        {bannerTitle} <span>{completionText}</span>
      </StyledBannerTitle>
      <Flex
        flexDirection={'column'}
        justifyContent={'space-between'}
        padding={`${Constants.UI.SPACING.marginSm}`}
      >
        <BannerInner />
      </Flex>
    </StyledLeftPaneBanner>
  );
};

interface StyledProgressBarContainerProps {
  theme: DefaultTheme;
}
const StyledProgressBarContainer = styled.div`
  width: 100%;
  height: 5px;
  flex-direction: row;
  background: ${(p: StyledProgressBarContainerProps) => p.theme.colors.sessionBorderColor};
`;

interface StyledProgressBarProps {
  width: string;
  color?: string;
}

const StyledProgressBarInner = styled.div`
  background: ${(p: StyledProgressBarProps) => p.color};
  width: ${(p: StyledProgressBarProps) => p.width};
  transition: width 0.5s ease-in;
  height: 100%;
`;

interface StyledBannerTitle {
  theme: DefaultTheme;
}
export const StyledBannerTitle = styled.div`
  line-height: 1.3;
  font-size: ${(p: StyledBannerTitle) => p.theme.common.fonts.md};
  font-weight: bold;
  margin: ${Constants.UI.SPACING.marginSm} ${Constants.UI.SPACING.marginSm} 0
    ${Constants.UI.SPACING.marginSm};

  span {
    color: ${(p: StyledBannerTitle) => p.theme.colors.textAccent};
  }
`;

interface StyledLeftPaneBannerProps {
  isCompleted?: boolean;
  border: string;
  theme: DefaultTheme;
}
export const StyledLeftPaneBanner = styled.div`
  background: ${(p: StyledLeftPaneBannerProps) => p.theme.colors.recoveryPhraseBannerBackground};
  display: flex;
  flex-direction: column;
  border-bottom: ${(p: StyledLeftPaneBannerProps) => p.border};
  opacity: 1;
  transition: opacity 2s;
  ${(p: StyledLeftPaneBannerProps) =>
    p.isCompleted === true
      ? `
      opacity: 0;
    `
      : null}
`;

const StyledBannerInner = styled.div`
  p {
    margin: 0;
  }

  .left-pane-banner___phrase {
    margin-top: ${Constants.UI.SPACING.marginMd};
  }

  .session-button {
    margin-top: ${Constants.UI.SPACING.marginSm};
  }
`;

interface StyledRecoveryPhraseProps {
  theme: DefaultTheme;
}
const StyledRecoveryPhrase = styled.p`
  margin: ${Constants.UI.SPACING.marginXs};
  border-radius: 5px;
  padding: 5px;
  border: ${(props: StyledRecoveryPhraseProps) => props.theme.colors.sessionBorderHighContrast};
`;

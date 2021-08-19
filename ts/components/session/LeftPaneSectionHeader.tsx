import React from 'react';
import classNames from 'classnames';
import { SessionIcon, SessionIconSize, SessionIconType } from './icon';
import styled, { useTheme } from 'styled-components';
import { SessionButton, SessionButtonType } from './SessionButton';
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
    <Flex flexDirection="column">
      <div className="module-left-pane__header">
        {label && <Tab label={label} type={0} isSelected={true} key={label} />}
        {buttonIcon && (
          <SessionButton onClick={buttonClicked} key="compose">
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
  const dispatch = useDispatch();

  const showRecoveryPhraseModal = () => {
    dispatch(
      recoveryPhraseModal({
        onClickOk: () => {
          dispatch(disableRecoveryPhrasePrompt());
        },
      })
    );
  };

  const BannerInner = () => {
    return (
      <StyledBannerInner>
        <p>{window.i18n('recoveryPhraseRevealMessage')}</p>
        <SessionButton
          buttonType={SessionButtonType.Default}
          text={window.i18n('recoveryPhraseRevealButtonText')}
          onClick={showRecoveryPhraseModal}
        />
      </StyledBannerInner>
    );
  };

  const theme = useTheme();

  return (
    <StyledLeftPaneBanner>
      <StyledProgressBarContainer>
        <StyledProgressBarInner />
      </StyledProgressBarContainer>
      <StyledBannerTitle>
        {window.i18n('recoveryPhraseSecureTitle')} <span>90%</span>
      </StyledBannerTitle>
      <Flex
        flexDirection="column"
        justifyContent="space-between"
        padding={`${theme.common.margins.sm}`}
      >
        <BannerInner />
      </Flex>
    </StyledLeftPaneBanner>
  );
};

const StyledProgressBarContainer = styled.div`
  width: 100%;
  height: 5px;
  flex-direction: row;
  background: ${p => p.theme.colors.sessionBorderColor};
`;

const StyledProgressBarInner = styled.div`
  background: ${p => p.theme.colors.accent};
  width: 90%;
  transition: width 0.5s ease-in;
  height: 100%;
`;

export const StyledBannerTitle = styled.div`
  line-height: 1.3;
  font-size: ${p => p.theme.common.fonts.md};
  font-weight: bold;
  margin: ${p => p.theme.common.margins.sm} ${p => p.theme.common.margins.sm} 0
    ${p => p.theme.common.margins.sm};

  span {
    color: ${p => p.theme.colors.textAccent};
  }
`;

export const StyledLeftPaneBanner = styled.div`
  background: ${p => p.theme.colors.recoveryPhraseBannerBackground};
  display: flex;
  flex-direction: column;
  border-bottom: ${p => p.theme.colors.sessionBorder};
`;

const StyledBannerInner = styled.div`
  p {
    margin: 0;
  }

  .left-pane-banner___phrase {
    margin-top: ${props => props.theme.common.margins.md};
  }

  .session-button {
    margin-top: ${props => props.theme.common.margins.sm};
  }
`;

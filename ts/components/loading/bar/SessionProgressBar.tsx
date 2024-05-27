import { motion } from 'framer-motion';
import styled from 'styled-components';
import { THEME_GLOBALS } from '../../../themes/globals';
import { Flex } from '../../basic/Flex';
import { SpacerMD, SpacerXL } from '../../basic/Text';

const ProgressContainer = styled.div<{ color: string }>`
  background: ${({ color }) => color};
  border-radius: 10px;
  overflow: hidden;
`;

const Progress = styled(motion.div)<{ color: string }>`
  background: ${({ color }) => color};
  border-radius: 10px;
  height: 17px;
`;

const StyledText = styled.span`
  margin: 0;
`;

const StyledTitle = styled(StyledText)`
  font-size: 26px;
  font-weight: 700;
`;

type Props = {
  /** a percentage value */
  initialValue: number;
  /** a percentage value */
  progress: number;
  color?: string;
  backgroundColor?: string;
  margin?: string;
  /** pixels is preferred */
  width?: string;
  title?: string;
  subtitle?: string;
  showPercentage?: boolean;
};

export function SessionProgressBar(props: Props) {
  const {
    initialValue,
    progress,
    width = '100%',
    backgroundColor = 'var(--border-color)',
    color = 'var(--primary-color)',
    margin,
    title,
    subtitle,
    showPercentage,
  } = props;

  return (
    <Flex
      container={true}
      width={width}
      flexDirection={'column'}
      alignItems={'flex-start'}
      margin={margin}
    >
      {title ? (
        <>
          <StyledTitle>{title}</StyledTitle>
          <SpacerMD />
        </>
      ) : null}
      <Flex container={true} width={width} justifyContent="space-between" alignItems="center">
        {subtitle ? <StyledText>{subtitle}</StyledText> : null}
        {showPercentage ? <StyledText>{Math.floor(progress)}%</StyledText> : null}
      </Flex>
      {subtitle || showPercentage ? <SpacerXL /> : null}
      <ProgressContainer
        aria-label="Loading animation"
        color={backgroundColor}
        style={{ width }}
        data-testid="loading-animation"
      >
        <Progress
          color={color}
          initial={{ width: `${initialValue}%` }}
          animate={{ width: `${progress}%` }}
          transition={{
            duration: THEME_GLOBALS['--duration-progress-bar'],
          }}
        />
      </ProgressContainer>
    </Flex>
  );
}

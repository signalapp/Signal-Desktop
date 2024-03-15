import { motion } from 'framer-motion';
import { ReactNode } from 'react';
import styled from 'styled-components';

type OnboardContainerProps = {
  animate?: boolean;
  children: ReactNode;
  key: string;
  direction: 'left' | 'right';
};

export const OnboardContainer = (props: OnboardContainerProps) => {
  const { animate = false, children, key, direction: _direction } = props;
  const OnboardContainerInner = styled(motion.div)`
    width: 100%;
  `;

  const direction = _direction === 'left' ? -1 : 1;

  const fadeSlideVariants = {
    initial: { x: 50 * direction, opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: { x: -50 * direction, opacity: 0 },
  };

  return (
    <OnboardContainerInner
      key={key}
      variants={animate ? fadeSlideVariants : undefined}
      initial={'initial'}
      animate={'animate'}
      exit={'exit'}
      transition={{ duration: 0.5 }}
    >
      {children}
    </OnboardContainerInner>
  );
};

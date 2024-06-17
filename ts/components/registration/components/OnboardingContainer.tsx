import { motion } from 'framer-motion';
import { ReactNode } from 'react';
import styled from 'styled-components';

const OnboardContainerInner = styled(motion.div)`
  width: 100%;
`;

const fadeSlideVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

type OnboardContainerProps = {
  animate?: boolean;
  children: ReactNode;
  key: string;
};

export const OnboardContainer = (props: OnboardContainerProps) => {
  const { animate = false, children, key } = props;

  return (
    <OnboardContainerInner
      key={key}
      variants={animate ? fadeSlideVariants : undefined}
      initial={'initial'}
      animate={'animate'}
      exit={'exit'}
      transition={{ duration: 1 }}
    >
      {children}
    </OnboardContainerInner>
  );
};

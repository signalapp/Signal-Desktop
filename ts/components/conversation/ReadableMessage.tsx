import React from 'react';
import { useFocus } from '../../hooks/useFocus';
import { InView, useInView } from 'react-intersection-observer';

type ReadableMessageProps = {
  children: React.ReactNode;
  id: string;
  className: string;
  onChange: (inView: boolean) => void;
  onContextMenu: (e: any) => void;
};

export const ReadableMessage = (props: ReadableMessageProps) => {
  const { onChange } = props;
  useFocus(onChange);

  return (
    <InView {...props} as="div" threshold={0.5} delay={20} triggerOnce={false}>
      {props.children}
    </InView>
  );
};

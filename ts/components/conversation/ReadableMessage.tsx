import React from 'react';
import { useFocus } from '../../hooks/useFocus';
import { InView } from 'react-intersection-observer';

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
    <InView {...props} as="div" threshold={1} delay={200} triggerOnce={true}>
      {props.children}
    </InView>
  );
};

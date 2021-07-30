import React from 'react';
import { useFocus } from '../../hooks/useFocus';
import { InView } from 'react-intersection-observer';

type ReadableMessageProps = {
  children: React.ReactNode;
  messageId: string;
  className: string;
  onChange: (inView: boolean) => void;
  onContextMenu: (e: any) => void;
};

export const ReadableMessage = (props: ReadableMessageProps) => {
  const { onChange, messageId, onContextMenu, className } = props;
  useFocus(onChange);

  return (
    <InView
      id={`msg-${messageId}`}
      onContextMenu={onContextMenu}
      className={className}
      as="div"
      threshold={0.5}
      delay={100}
      onChange={onChange}
      triggerOnce={false}
    >
      {props.children}
    </InView>
  );
};

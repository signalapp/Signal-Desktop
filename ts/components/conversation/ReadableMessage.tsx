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
  /*const { ref, inView, entry } = useInView({
    threshold: 1,
    delay: 200,
    triggerOnce: true,
    trackVisibility: true,
  });

  const { onChange } = props;
  useFocus(() => onChange(inView));

  return (
    <div ref={ref} id={props.id} onContextMenu={props.onContextMenu} className={props.className} onChange={onChange}>
      {props.children}
    </div>
  )*/

  const { onChange } = props;
  useFocus(onChange);

  return (
    <InView {...props} as="div" threshold={1} delay={200} triggerOnce={false}>
      {props.children}
    </InView>
  );
};

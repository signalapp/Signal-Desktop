import React, { useEffect, useRef } from 'react';
import * as Backbone from 'backbone';

type PropsType = {
  View: typeof Backbone.View;
  className?: string;
};

export const BackboneHost = ({ View, className }: PropsType): JSX.Element => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<Backbone.View | undefined>(undefined);

  useEffect(() => {
    const view = new View({
      el: hostRef.current,
    });

    viewRef.current = view;

    return () => {
      if (!viewRef || !viewRef.current) {
        return;
      }

      viewRef.current.remove();
      viewRef.current = undefined;
    };
  }, [View]);

  return (
    <div>
      <div className={className} ref={hostRef} />
    </div>
  );
};

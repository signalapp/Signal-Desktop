import React, { useEffect, useRef } from 'react';
import * as Backbone from 'backbone';

type InboxViewType = Backbone.View & {
  onEmpty?: () => void;
};

type InboxViewOptionsType = Backbone.ViewOptions & {
  initialLoadComplete: boolean;
  window: typeof window;
};

export type PropsType = {
  hasInitialLoadCompleted: boolean;
};

export const Inbox = ({ hasInitialLoadCompleted }: PropsType): JSX.Element => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<InboxViewType | undefined>(undefined);

  useEffect(() => {
    const viewOptions: InboxViewOptionsType = {
      el: hostRef.current,
      initialLoadComplete: false,
      window,
    };
    const view = new window.Whisper.InboxView(viewOptions);

    viewRef.current = view;

    return () => {
      // [`Backbone.View.prototype.remove`][0] removes the DOM element and stops listening
      //   to event listeners. Because React will do the first, we only want to do the
      //   second.
      // [0]: https://github.com/jashkenas/backbone/blob/153dc41616a1f2663e4a86b705fefd412ecb4a7a/backbone.js#L1336-L1342
      viewRef.current?.stopListening();
      viewRef.current = undefined;
    };
  }, []);

  useEffect(() => {
    if (hasInitialLoadCompleted && viewRef.current && viewRef.current.onEmpty) {
      viewRef.current.onEmpty();
    }
  }, [hasInitialLoadCompleted, viewRef]);

  return <div className="inbox index" ref={hostRef} />;
};

import React from 'react';

export const useInterval = (callback: any, delay: number | null) => {
  const savedCallback = React.useRef<any>();

  React.useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  React.useEffect(() => {
    function tick() {
      if (savedCallback && savedCallback.current && savedCallback.current) {
        savedCallback.current();
      }
    }
    if (delay !== null) {
      const id = global.setInterval(tick, delay);
      tick();
      return () => {
        global.clearInterval(id);
      };
    }
    return;
  }, [delay]);
};

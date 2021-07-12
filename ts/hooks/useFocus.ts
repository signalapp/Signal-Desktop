import { useEffect } from 'react';

export const useFocus = (action: (param: any) => void) => {
  useEffect(() => {
    window.addEventListener('focus', action);
    return () => {
      window.removeEventListener('focus', action);
    };
  });
};

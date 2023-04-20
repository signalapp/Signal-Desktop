// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import React from 'react';

const makeApi = (classes?: Array<string>) => ({
  createRoot: () => {
    const div = document.createElement('div');

    if (classes) {
      classes.forEach(theme => {
        div.classList.add(theme);
      });
    }

    document.body.appendChild(div);

    return div;
  },
  removeRoot: (root: HTMLElement) => {
    document.body.removeChild(root);
  },
});

export const PopperRootContext = React.createContext(makeApi());

export type ClassyProviderProps = {
  classes?: Array<string>;
  children?: React.ReactNode;
};

export function ClassyProvider({
  classes,
  children,
}: ClassyProviderProps): JSX.Element {
  const api = React.useMemo(() => makeApi(classes), [classes]);

  return (
    <PopperRootContext.Provider value={api}>
      {children}
    </PopperRootContext.Provider>
  );
}

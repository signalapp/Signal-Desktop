import * as React from 'react';

const makeApi = (themes?: Array<string>) => ({
  createRoot: () => {
    const div = document.createElement('div');

    if (themes) {
      themes.forEach(theme => {
        div.classList.add(`${theme}-theme`);
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

export type ThemedProviderProps = {
  themes?: Array<string>;
  children?: React.ReactChildren;
};

export const ThemedProvider: React.FunctionComponent<ThemedProviderProps> = ({
  themes,
  children,
}) => {
  const api = React.useMemo(() => makeApi(themes), [themes]);

  return (
    <PopperRootContext.Provider value={api}>
      {children}
    </PopperRootContext.Provider>
  );
};

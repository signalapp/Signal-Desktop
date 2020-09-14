import React from 'react';
import { Provider } from 'react-redux';

import { Store } from 'redux';

import { SmartShortcutGuideModal } from '../smart/ShortcutGuideModal';

// Workaround: A react component's required properties are filtering up through connect()
//   https://github.com/DefinitelyTyped/DefinitelyTyped/issues/31363
/* eslint-disable @typescript-eslint/no-explicit-any */
const FilteredShortcutGuideModal = SmartShortcutGuideModal as any;
/* eslint-enable @typescript-eslint/no-explicit-any */

export const createShortcutGuideModal = (
  store: Store,
  props: Record<string, unknown>
): React.ReactElement => (
  <Provider store={store}>
    <FilteredShortcutGuideModal {...props} />
  </Provider>
);

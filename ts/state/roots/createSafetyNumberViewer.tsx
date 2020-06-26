import React from 'react';
import { Provider } from 'react-redux';

import { Store } from 'redux';

import { SmartSafetyNumberViewer } from '../smart/SafetyNumberViewer';

// Workaround: A react component's required properties are filtering up through connect()
//   https://github.com/DefinitelyTyped/DefinitelyTyped/issues/31363
const FilteredSafetyNumberViewer = SmartSafetyNumberViewer as any;

type Props = {
  contactID: string;
  onClose?: () => void;
};

export const createSafetyNumberViewer = (store: Store, props: Props) => (
  <Provider store={store}>
    <FilteredSafetyNumberViewer {...props} />
  </Provider>
);

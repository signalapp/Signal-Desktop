
// import { expect } from 'chai';
// import * as sinon from 'sinon';
// import { TestUtils } from '../../test-utils';
// import { PairingAuthorisation } from '../../../../js/modules/data';
// import { MultiDeviceProtocol } from '../../../session/protocols';
// import { PubKey } from '../../../session/types';
// import { UserUtil } from '../../../util';
// import { StringUtils } from '../../../session/utils';

import { Common } from './common';

// tslint:disable: no-import-side-effect

// import './registration_test';
// import './open_group_test';
// import './add_contacts_test';
import './link_device_test';
// import './closed_group_test';
// import './message_functions_test';
// import './settings_test';
// import'./message_sync_test';
// import './sender_keys_test';

before(async () => {
  // start the app once before all tests to get the platform-dependent
  // path of user data and store it to common.USER_DATA_ROOT_FOLDER
  const app1 = await Common.startApp();
  const ret = await app1.electron.remote.app.getPath(
    'appData'
  ) as any;
  Common.USER_DATA_ROOT_FOLDER = ret;

  await Common.stopApp(app1);
});

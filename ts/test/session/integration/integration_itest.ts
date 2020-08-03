import { Common } from './common';

// tslint:disable: no-import-side-effect no-invalid-this await-promise

import './registration_itest';
import './open_group_itest';
import './add_contacts_itest';
import './link_device_itest';
// import './closed_group_itest';
// import './message_functions_itest';
// import './settings_itest';
// import'./message_sync_itest';
// import './sender_keys_itest';

before(async function() {
  // start the app once before all tests to get the platform-dependent
  // path of user data and store it to common.USER_DATA_ROOT_FOLDER
  this.timeout(60000);
  this.slow(20000);
  const app1 = await Common.startApp();
  const ret = await app1.electron.remote.app.getPath('appData');
  Common.USER_DATA_ROOT_FOLDER = ret;

  await Common.stopApp(app1);
});

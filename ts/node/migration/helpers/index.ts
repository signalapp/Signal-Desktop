/* eslint-disable max-len */
/*
When doing migrations that relate to libsession we cannot share useful functions between migrations because the typings for libsession can change between versions.

To fix this, we now put these "helper" functions in a migration number specific file that can be trusted to have the correct typings and values for that version of libsession.

In order for this to work, any properties on an object type exported from libsession need to be optional. This is because we cannot guarantee that the value will exist on the object in the version of libsession that we are migrating from.

Any helper functions that are exported from a helper file must run checkTargetMigration(version, targetVersion); on the first line to confirm that the helper function is being referenced within the correct migration. It will throw an error otherwise.
*/
/* eslint-enable max-len */

import { V31 } from './v31';
import { V33 } from './v33';
import { V34 } from './v34';

const MIGRATION_HELPERS = {
  V31,
  V33,
  V34,
};

export default MIGRATION_HELPERS;

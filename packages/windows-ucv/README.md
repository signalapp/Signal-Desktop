<!-- Copyright 2026 Signal Messenger, LLC -->
<!-- SPDX-License-Identifier: AGPL-3.0-only -->

# @signalapp/windows-ucv

[![npm](https://img.shields.io/npm/v/@signalapp/windows-ucv)](https://www.npmjs.com/package/@signalapp/windows-ucv)

## Installation

```sh
npm install @signalapp/windows-ucv
```

## Usage

```js
import { checkAvailability, requestVerification } from '@signalapp/windows-ucv';

console.log(await checkAvailability());
console.log(await requestVerification('message'));
```

See https://learn.microsoft.com/en-us/uwp/api/windows.security.credentials.ui.userconsentverifier.requestverificationasync?view=winrt-26100

### Hour-cycle preference

```js
import { getHourCyclePreference } from '@signalapp/windows-ucv';

console.log(getHourCyclePreference()); // '12', '24', or 'unknown'
```

Reads the current user's Windows **short time** format, including user overrides.
Quoted literals and alternative formats do not affect the result. Returns
`'unknown'` if the Windows query fails or the preferred pattern has no unambiguous
hour cycle. Calling this function on another platform throws an error.

Signal reads this preference at startup. Restart Signal after changing Windows
regional settings. This controls the hour cycle, not the full Windows pattern;
Signal continues to localize separators and AM/PM labels itself.

### Native tests

From a Visual Studio Developer Command Prompt, run `pnpm run test:native` in this
package. Tests cover custom patterns and API failures without changing Windows
settings.

For application verification, restart Signal with each configuration below and
check message timestamps and timestamp tooltips at 18:42, midnight, and noon:

| Regional format         | Short time | Long time    | Expected hour cycle |
| ----------------------- | ---------- | ------------ | ------------------- |
| English (United States) | `HH:mm`    | `h:mm:ss tt` | 24-hour             |
| German                  | `h:mm tt`  | `HH:mm:ss`   | 12-hour             |

Restore the original regional settings after testing.

## License

Copyright 2025 Signal Messenger, LLC

Licensed under the GNU AGPLv3: https://www.gnu.org/licenses/agpl-3.0.html

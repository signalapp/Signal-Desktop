// Copyright 2020 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import semver from 'semver';

type RemoteVersion = {
  'min-version': string;
  iso8601: string;
};

export function parseRemoteClientExpiration(
  remoteExpirationValue: string
): number | null {
  const remoteVersions = JSON.parse(remoteExpirationValue) || [];
  const ourVersion = window.getVersion();

  return remoteVersions.reduce(
    (acc: number | null, remoteVersion: RemoteVersion) => {
      const minVersion = remoteVersion['min-version'];
      const { iso8601 } = remoteVersion;

      if (semver.gt(minVersion, ourVersion)) {
        const timestamp = new Date(iso8601).getTime();

        if (!acc) {
          return timestamp;
        }

        return timestamp < acc ? timestamp : acc;
      }

      return acc;
    },
    null
  );
}

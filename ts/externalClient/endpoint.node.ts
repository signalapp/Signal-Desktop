// Copyright 2026 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only

import { createHash } from 'node:crypto';
import { chmod, lstat, mkdir, unlink } from 'node:fs/promises';
import { join } from 'node:path';

// Where the external-client listener lives. The name is derived from the
// userData path so that separate Signal profiles (production, beta,
// development) never share an endpoint. Discovery is a convenience for
// clients; it is never a trust signal.

export type EndpointType =
  | Readonly<{ kind: 'pipe'; path: string }>
  | Readonly<{ kind: 'socket'; path: string; directory: string }>;

class EndpointError extends Error {
  override name = 'EndpointError';
}

// sun_path is 104 bytes on macOS and 108 on Linux, including the NUL.
const MAX_SOCKET_PATH_BYTES = 103;

function getEndpointId(userDataPath: string, username: string): string {
  return createHash('sha256')
    .update(userDataPath)
    .update('\0')
    .update(username)
    .digest('hex')
    .slice(0, 16);
}

export function getExternalClientEndpoint({
  platform,
  userDataPath,
  username,
  runtimeDir,
}: {
  platform: NodeJS.Platform;
  userDataPath: string;
  username: string;
  runtimeDir: string | undefined;
}): EndpointType {
  const id = getEndpointId(userDataPath, username);

  if (platform === 'win32') {
    return {
      kind: 'pipe',
      path: `\\\\.\\pipe\\signal-desktop-external-client-${id}`,
    };
  }

  const directory =
    platform === 'linux' && runtimeDir
      ? join(runtimeDir, 'signal-desktop')
      : join(userDataPath, 'external-client');
  const path = join(directory, `${id}.sock`);
  if (Buffer.byteLength(path) > MAX_SOCKET_PATH_BYTES) {
    throw new EndpointError('Socket path is too long for this platform');
  }
  return { kind: 'socket', path, directory };
}

// Makes the socket directory safe to bind in: it must be a real directory
// owned by us and not accessible to anyone else. Removes a stale socket left
// by a previous run, but refuses to touch anything that is not our socket.
export async function prepareEndpoint(endpoint: EndpointType): Promise<void> {
  if (endpoint.kind === 'pipe') {
    return;
  }

  const uid = process.getuid?.();
  if (uid === undefined) {
    throw new EndpointError('Unix sockets require a POSIX platform');
  }

  try {
    await mkdir(endpoint.directory, { mode: 0o700 });
  } catch (error) {
    if (error.code !== 'EEXIST') {
      throw error;
    }
  }

  const dirStat = await lstat(endpoint.directory);
  if (dirStat.isSymbolicLink() || !dirStat.isDirectory()) {
    throw new EndpointError('Endpoint directory is not a directory');
  }
  if (dirStat.uid !== uid) {
    throw new EndpointError('Endpoint directory is owned by another user');
  }
  // oxlint-disable-next-line no-bitwise
  if ((dirStat.mode & 0o077) !== 0) {
    await chmod(endpoint.directory, 0o700);
  }

  let socketStat;
  try {
    socketStat = await lstat(endpoint.path);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return;
    }
    throw error;
  }
  if (!socketStat.isSocket() || socketStat.uid !== uid) {
    throw new EndpointError('Endpoint path exists and is not our socket');
  }
  await unlink(endpoint.path);
}

export async function secureBoundEndpoint(
  endpoint: EndpointType
): Promise<void> {
  if (endpoint.kind === 'socket') {
    await chmod(endpoint.path, 0o600);
  }
}

export async function cleanupEndpoint(endpoint: EndpointType): Promise<void> {
  if (endpoint.kind === 'pipe') {
    return;
  }
  try {
    const stat = await lstat(endpoint.path);
    if (stat.isSocket() && stat.uid === process.getuid?.()) {
      await unlink(endpoint.path);
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

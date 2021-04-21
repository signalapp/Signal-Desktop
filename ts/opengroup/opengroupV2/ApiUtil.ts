export const defaultServer = 'https://sessionopengroup.com';
export const defaultServerPublicKey =
  '658d29b91892a2389505596b135e76a53db6e11d613a51dbd3d0816adffb231b';

export type OpenGroupV2Request = {
  method: 'GET' | 'POST' | 'DELETE' | 'PUT';
  room: string;
  server: string;
  endpoint: string;
  // queryParams are used for post or get, but not the same way
  queryParams?: Record<string, string>;
  headers?: Record<string, string>;
  isAuthRequired: boolean;
  // Always `true` under normal circumstances. You might want to disable this when running over Lokinet.
  useOnionRouting?: boolean;
};

export type OpenGroupV2Info = {
  id: string;
  name: string;
  imageId?: string;
};

/**
 * Try to build an full url and check it for validity.
 * @returns null if the check failed. the built URL otherwise
 */
export const buildUrl = (request: OpenGroupV2Request): URL | null => {
  let rawURL = `${request.server}/${request.endpoint}`;
  if (request.method === 'GET') {
    const entries = Object.entries(request.queryParams || {});

    if (entries.length) {
      const queryString = entries
        .map(([key, value]) => `${key}=${value}`)
        .join('&');
      rawURL += `?${queryString}`;
    }
  }
  // this just check that the URL is valid
  try {
    return new URL(`${rawURL}`);
  } catch (error) {
    return null;
  }
};

/**
 * Map of serverUrl to roomId to list of moderators as a Set
 */
export const cachedModerators: Map<
  string,
  Map<string, Set<string>>
> = new Map();

export const setCachedModerators = (
  serverUrl: string,
  roomId: string,
  newModerators: Array<string>
) => {
  const allRoomsMods = cachedModerators.get(serverUrl);
  if (!allRoomsMods) {
    cachedModerators.set(serverUrl, new Map());
  }
  // tslint:disable: no-non-null-assertion
  if (!allRoomsMods!.get(roomId)) {
    allRoomsMods!.set(roomId, new Set());
  }
  newModerators.forEach(m => {
    allRoomsMods!.get(roomId)?.add(m);
  });
};

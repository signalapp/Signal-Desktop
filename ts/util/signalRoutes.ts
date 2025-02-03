// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import 'urlpattern-polyfill';
// We need to use the Node.js version of `URL` because chromium's `URL` doesn't
// support custom protocols correctly.
import { URL as NodeURL } from 'url';
import { z } from 'zod';
import { strictAssert } from './assert';
import * as log from '../logging/log';
import * as Errors from '../types/errors';
import { parsePartial, parseUnknown, safeParseUnknown } from './schemas';

function toUrl(input: URL | string): URL | null {
  if (input instanceof URL) {
    return input;
  }
  try {
    return new NodeURL(input) as URL;
  } catch {
    return null;
  }
}

/**
 * List of protocols that are used by Signal routes.
 */
const SignalRouteProtocols = ['https:', 'sgnl:', 'signalcaptcha:'] as const;

/**
 * List of hostnames that are used by Signal routes.
 * This doesn't include app-only routes like `linkdevice` or `verify`.
 */
const SignalRouteHostnames = [
  'signal.me',
  'signal.group',
  'signal.link',
  'signal.art',
] as const;

/**
 * Type to help maintain {@link SignalRouteHostnames}, real hostnames should go there.
 */
type AllHostnamePatterns =
  | (typeof SignalRouteHostnames)[number]
  | 'verify'
  | 'linkdevice'
  | 'addstickers'
  | 'art-auth'
  | 'joingroup'
  | 'show-conversation'
  | 'start-call-lobby'
  | 'show-window'
  | 'cancel-presenting'
  | ':captchaId(.+)'
  | '';

/**
 * Uses the `URLPattern` syntax to match URLs.
 */
type PatternString = string & { __pattern?: never };

type PatternInput = {
  hash?: PatternString;
  search?: PatternString;
};

type URLMatcher = (input: URL) => URLPatternResult | null;

function _pattern(
  protocol: (typeof SignalRouteProtocols)[number],
  hostname: AllHostnamePatterns,
  pathname: PatternString,
  init: PatternInput
): URLMatcher {
  strictAssert(protocol.endsWith(':'), 'protocol must end with `:`');
  strictAssert(!hostname.endsWith('/'), 'hostname must not end with `/`');
  strictAssert(
    !(hostname === '' && pathname !== ''),
    'hostname cannot be empty string if pathname is not empty string'
  );
  strictAssert(
    !pathname.endsWith('/'),
    'pathname trailing slash must be optional `{/}?`'
  );
  const urlPattern = new URLPattern({
    username: '',
    password: '',
    port: '',
    // any of these can be patterns
    hostname,
    pathname,
    search: init.search ?? '',
    hash: init.hash ?? '',
  } satisfies Omit<Required<URLPatternInit>, 'baseURL' | 'protocol'>);
  return function match(input) {
    const url = toUrl(input);
    if (url == null) {
      return null;
    }
    // We need to check protocol separately because `URL` and `URLPattern` don't
    // properly support custom protocols
    if (url.protocol !== protocol) {
      return null;
    }
    return urlPattern.exec(url);
  };
}

type PartialNullable<T> = {
  [P in keyof T]?: T[P] | null;
};

type RouteConfig<Args extends object> = {
  patterns: Array<URLMatcher>;
  schema: z.ZodType<Args>;
  parse(result: URLPatternResult, url: URL): PartialNullable<Args>;
  toWebUrl?(args: Args): URL;
  toAppUrl?(args: Args): URL;
};

type SignalRoute<Key extends string, Args extends object> = {
  isMatch(input: URL | string): boolean;
  fromUrl(input: URL | string): RouteResult<Key, Args> | null;
  toWebUrl(args: Args): URL;
  toAppUrl(args: Args): URL;
};

type RouteResult<Key extends string, Args extends object> = {
  key: Key;
  args: Args;
};

let _routeCount = 0;

function _route<Key extends string, Args extends object>(
  key: Key,
  config: RouteConfig<Args>
): SignalRoute<Key, Args> {
  _routeCount += 1;
  return {
    isMatch(input) {
      const url = toUrl(input);
      if (url == null) {
        return false;
      }
      return config.patterns.some(matcher => {
        return matcher(url) != null;
      });
    },
    fromUrl(input) {
      const url = toUrl(input);
      if (url == null) {
        return null;
      }
      for (const matcher of config.patterns) {
        const result = matcher(url);
        if (result) {
          let rawArgs;
          try {
            rawArgs = config.parse(result, url);
          } catch (error) {
            log.error(
              `Failed to parse route ${key} from URL ${url.toString()}`,
              Errors.toLogFormat(error)
            );
            return null;
          }
          const parseResult = safeParseUnknown(
            config.schema,
            rawArgs as unknown
          );
          if (parseResult.success) {
            const args = parseResult.data;
            return {
              key,
              args,
            };
          }
          log.error(
            `Failed to parse route ${key} from URL ${url.toString()}`,
            parseResult.error.format()
          );
          return null;
        }
      }
      return null;
    },
    toWebUrl(args) {
      if (config.toWebUrl) {
        return config.toWebUrl(parseUnknown(config.schema, args as unknown));
      }
      throw new Error('Route does not support web URLs');
    },
    toAppUrl(args) {
      if (config.toAppUrl) {
        return config.toAppUrl(parseUnknown(config.schema, args as unknown));
      }
      throw new Error('Route does not support app URLs');
    },
  };
}

const paramSchema = z.string().min(1);

/**
 * signal.me by phone number
 * @example
 * ```ts
 * contactByPhoneNumberRoute.toWebUrl({
 * 	 phoneNumber: "+1234567890",
 * })
 * // URL { "https://signal.me/#p/+1234567890" }
 * ```
 */
export const contactByPhoneNumberRoute = _route('contactByPhoneNumber', {
  patterns: [
    _pattern('https:', 'signal.me', '{/}?', { hash: 'p/:phoneNumber' }),
    _pattern('sgnl:', 'signal.me', '{/}?', { hash: 'p/:phoneNumber' }),
  ],
  schema: z.object({
    phoneNumber: paramSchema, // E164 (with +)
  }),
  parse(result) {
    return {
      phoneNumber: parsePartial(paramSchema, result.hash.groups.phoneNumber),
    };
  },
  toWebUrl(args) {
    return new URL(`https://signal.me/#p/${args.phoneNumber}`);
  },
  toAppUrl(args) {
    return new URL(`sgnl://signal.me/#p/${args.phoneNumber}`);
  },
});

/**
 * signal.me by encrypted username
 * @example
 * ```ts
 * contactByEncryptedUsernameRoute.toWebUrl({
 *   encryptedUsername: "123",
 * })
 * // URL { "https://signal.me/#eu/123" }
 * ```
 */
export const contactByEncryptedUsernameRoute = _route(
  'contactByEncryptedUsername',
  {
    patterns: [
      _pattern('https:', 'signal.me', '{/}?', {
        hash: 'eu/:encryptedUsername',
      }),
      _pattern('sgnl:', 'signal.me', '{/}?', { hash: 'eu/:encryptedUsername' }),
    ],
    schema: z.object({
      encryptedUsername: paramSchema, // base64url (32 bytes of entropy + 16 bytes of big-endian UUID)
    }),
    parse(result) {
      return {
        encryptedUsername: result.hash.groups.encryptedUsername,
      };
    },
    toWebUrl(args) {
      return new URL(`https://signal.me/#eu/${args.encryptedUsername}`);
    },
    toAppUrl(args) {
      return new URL(`sgnl://signal.me/#eu/${args.encryptedUsername}`);
    },
  }
);

/**
 * Group invites
 * @example
 * ```ts
 * groupInvitesRoute.toWebUrl({
 *   inviteCode: "123",
 * })
 * // URL { "https://signal.group/#123" }
 * ```
 */
export const groupInvitesRoute = _route('groupInvites', {
  patterns: [
    _pattern('https:', 'signal.group', '{/}?', {
      hash: ':inviteCode([^\\/]+)',
    }),
    _pattern('sgnl:', 'signal.group', '{/}?', {
      hash: ':inviteCode([^\\/]+)',
    }),
    _pattern('sgnl:', 'joingroup', '{/}?', { hash: ':inviteCode([^\\/]+)' }),
  ],
  schema: z.object({
    inviteCode: paramSchema, // base64url (GroupInviteLink proto)
  }),
  parse(result) {
    return {
      inviteCode: result.hash.groups.inviteCode,
    };
  },
  toWebUrl(args) {
    return new URL(`https://signal.group/#${args.inviteCode}`);
  },
  toAppUrl(args) {
    return new URL(`sgnl://signal.group/#${args.inviteCode}`);
  },
});

/**
 * Device linking QR code
 * @example
 * ```ts
 * linkDeviceRoute.toAppUrl({
 *   uuid: "123",
 *   pubKey: "abc",
 *   capabilities: "backuo"
 * })
 * // URL { "sgnl://linkdevice?uuid=123&pub_key=abc&capabilities=backup" }
 * ```
 */
export const linkDeviceRoute = _route('linkDevice', {
  patterns: [_pattern('sgnl:', 'linkdevice', '{/}?', { search: ':params' })],
  schema: z.object({
    uuid: paramSchema, // base64url?
    pubKey: paramSchema, // percent-encoded base64 (with padding) of PublicKey with type byte included
    capabilities: paramSchema.array(), // comma-separated list of capabilities
  }),
  parse(result) {
    const params = new URLSearchParams(result.search.groups.params);
    return {
      uuid: params.get('uuid'),
      pubKey: params.get('pub_key'),
      capabilities: params.get('capabilities')?.split(',') ?? [],
    };
  },
  toAppUrl(args) {
    const params = new URLSearchParams({
      uuid: args.uuid,
      pub_key: args.pubKey,
      capabilities: args.capabilities.join(','),
    });
    return new URL(`sgnl://linkdevice?${params.toString()}`);
  },
});

/**
 * Captchas
 * @example
 * ```ts
 * captchaRoute.toAppUrl({
 *   captchaId: "123",
 * })
 * // URL { "signalcaptcha://123" }
 * ```
 */
export const captchaRoute = _route('captcha', {
  // needs `(.+)` to capture `.` in hostname
  patterns: [_pattern('signalcaptcha:', ':captchaId(.+)', '{/}?', {})],
  schema: z.object({
    captchaId: paramSchema, // opaque
  }),
  parse(_result, url) {
    return {
      captchaId: url.hostname,
    };
  },
  toAppUrl(args) {
    return new URL(`signalcaptcha://${args.captchaId}`);
  },
});

/**
 * Join a call with a link.
 * @example
 * ```ts
 * linkCallRoute.toWebUrl({
 *   key: "123",
 * })
 * // URL { "https://signal.link/call#key=123" }
 */
export const linkCallRoute = _route('linkCall', {
  patterns: [
    _pattern('https:', 'signal.link', '/call{/}?', { hash: ':params' }),
    _pattern('sgnl:', 'signal.link', '/call{/}?', { hash: ':params' }),
  ],
  schema: z.object({
    key: paramSchema, // ConsonantBase16
  }),
  parse(result) {
    const params = new URLSearchParams(result.hash.groups.params);
    return {
      key: params.get('key'),
    };
  },
  toWebUrl(args) {
    const params = new URLSearchParams({ key: args.key });
    return new URL(`https://signal.link/call/#${params.toString()}`);
  },
  toAppUrl(args) {
    const params = new URLSearchParams({ key: args.key });
    return new URL(`sgnl://signal.link/call/#${params.toString()}`);
  },
});

/**
 * Sticker packs
 * @example
 * ```ts
 * artAddStickersRoute.toWebUrl({
 *   packId: "123",
 *   packKey: "abc",
 * })
 * // URL { "https://signal.art/addstickers#pack_id=123&pack_key=abc" }
 * ```
 */
export const artAddStickersRoute = _route('artAddStickers', {
  patterns: [
    _pattern('https:', 'signal.art', '/addstickers{/}?', { hash: ':params' }),
    _pattern('sgnl:', 'addstickers', '{/}?', { search: ':params' }),
  ],
  schema: z.object({
    packId: paramSchema, // hexadecimal
    packKey: paramSchema, // hexadecimal
  }),
  parse(result) {
    const params = new URLSearchParams(
      result.hash.groups.params ?? result.search.groups.params
    );
    return {
      packId: params.get('pack_id'),
      packKey: params.get('pack_key'),
    };
  },
  toWebUrl(args) {
    const params = new URLSearchParams({
      pack_id: args.packId,
      pack_key: args.packKey,
    });
    return new URL(`https://signal.art/addstickers#${params.toString()}`);
  },
  toAppUrl(args) {
    const params = new URLSearchParams({
      pack_id: args.packId,
      pack_key: args.packKey,
    });
    return new URL(`sgnl://addstickers?${params.toString()}`);
  },
});

/**
 * Show a conversation
 * @example
 * ```ts
 * showConversationRoute.toAppUrl({
 *   token: 'abc',
 * })
 * // URL { "sgnl://show-conversation?token=abc" }
 * ```
 */
export const showConversationRoute = _route('showConversation', {
  patterns: [
    _pattern('sgnl:', 'show-conversation', '{/}?', { search: ':params' }),
  ],
  schema: z.object({
    token: paramSchema,
  }),
  parse(result) {
    const params = new URLSearchParams(result.search.groups.params);
    return {
      token: params.get('token'),
    };
  },
  toAppUrl(args) {
    const params = new URLSearchParams({ token: args.token });
    return new URL(`sgnl://show-conversation?${params.toString()}`);
  },
});

/**
 * Start a call lobby
 * @example
 * ```ts
 * startCallLobbyRoute.toAppUrl({
 *   token: "123",
 * })
 * // URL { "sgnl://start-call-lobby?token=123" }
 * ```
 */
export const startCallLobbyRoute = _route('startCallLobby', {
  patterns: [
    _pattern('sgnl:', 'start-call-lobby', '{/}?', { search: ':params' }),
  ],
  schema: z.object({
    token: paramSchema,
  }),
  parse(result) {
    const params = new URLSearchParams(result.search.groups.params);
    return {
      token: params.get('token'),
    };
  },
  toAppUrl(args) {
    const params = new URLSearchParams({ token: args.token });
    return new URL(`sgnl://start-call-lobby?${params.toString()}`);
  },
});

/**
 * Show window
 * @example
 * ```ts
 * showWindowRoute.toAppUrl({})
 * // URL { "sgnl://show-window" }
 */
export const showWindowRoute = _route('showWindow', {
  patterns: [_pattern('sgnl:', 'show-window', '{/}?', {})],
  schema: z.object({}),
  parse() {
    return {};
  },
  toAppUrl() {
    return new URL('sgnl://show-window');
  },
});

/**
 * Set is presenting
 * @example
 * ```ts
 * cancelPresentingRoute.toAppUrl({})
 * // URL { "sgnl://cancel-presenting" }
 * ```
 */
export const cancelPresentingRoute = _route('cancelPresenting', {
  patterns: [_pattern('sgnl:', 'cancel-presenting', '{/}?', {})],
  schema: z.object({}),
  parse() {
    return {};
  },
  toAppUrl() {
    return new URL('sgnl://cancel-presenting');
  },
});

/**
 * Should include all routes for matching purposes.
 * @internal
 */
const _allSignalRoutes = [
  contactByPhoneNumberRoute,
  contactByEncryptedUsernameRoute,
  groupInvitesRoute,
  linkDeviceRoute,
  captchaRoute,
  linkCallRoute,
  artAddStickersRoute,
  showConversationRoute,
  startCallLobbyRoute,
  showWindowRoute,
  cancelPresentingRoute,
] as const;

strictAssert(
  _allSignalRoutes.length === _routeCount,
  'Forgot to add route to routes list'
);

/**
 * A parsed route with the `key` of the route and its parsed `args`.
 * @example
 * ```ts
 * parseSignalRoute(new URL("https://signal.me/#p/+1234567890"))
 * // {
 * //   key: "contactByPhoneNumber",
 * //   args: { phoneNumber: "+1234567890" },
 * // }
 * ```
 */
export type ParsedSignalRoute = NonNullable<
  ReturnType<(typeof _allSignalRoutes)[number]['fromUrl']>
>;

/** @internal */
type MatchedSignalRoute = {
  route: SignalRoute<string, object>;
  parsed: ParsedSignalRoute;
};

/** @internal */
function _matchSignalRoute(input: URL | string): MatchedSignalRoute | null {
  const url = toUrl(input);
  if (url == null) {
    return null;
  }
  for (const route of _allSignalRoutes) {
    const parsed = route.fromUrl(url);
    if (parsed != null) {
      return { route, parsed };
    }
  }
  return null;
}

/** @internal */
function _normalizeUrl(url: URL | string): URL | null {
  const newUrl = toUrl(url);
  if (newUrl == null) {
    return null;
  }
  newUrl.port = '';
  newUrl.username = '';
  newUrl.password = '';
  if (newUrl.protocol === 'http:') {
    newUrl.protocol = 'https:';
  }
  return newUrl;
}

/**
 * Check if a URL matches a route.
 * @example
 * ```ts
 * isSignalRoute(new URL("https://signal.me/#p/+1234567890")) // true
 * isSignalRoute(new URL("sgnl://signal.me/#p/+1234567890")) // true
 * isSignalRoute(new URL("https://signal.me")) // false
 * isSignalRoute(new URL("https://example.com")) // false
 * ```
 */
export function isSignalRoute(input: URL | string): boolean {
  return _matchSignalRoute(input) != null;
}

/**
 * Maybe parse a URL into a matching route with the 'key' of the route and its
 * parsed args.
 * If it we can't match it to a route, return null.
 * @example
 * ```ts
 * parseSignalRoute(new URL("https://signal.me/#p/+1234567890"))
 * // { key: "contactByPhoneNumber", args: { phoneNumber: "+1234567890" } }
 * parseSignalRoute(new URL("sgnl://signal.me/#p/+1234567890"))
 * // { key: "contactByPhoneNumber", args: { phoneNumber: "+1234567890" } }
 * parseSignalRoute(new URL("https://example.com"))
 * // null
 * ```
 */
export function parseSignalRoute(
  input: URL | string
): ParsedSignalRoute | null {
  return _matchSignalRoute(input)?.parsed ?? null;
}

/**
 * Maybe normalize a URL into a matching route URL.
 * If it we can't match it to a route, return null.
 * @example
 * ```ts
 * toSignalRouteUrl(new URL("http://username:password@signal.me/#p/+1234567890"))
 * // URL { "https://signal.me/#p/+1234567890" }
 * toSignalRouteUrl(new URL("sgnl://signal.me/#p/+1234567890"))
 * // URL { "sgnl://signal.me/#p/+1234567890" }
 * toSignalRouteUrl(new URL("https://example.com"))
 * // null
 * ```
 */
export function toSignalRouteUrl(input: URL | string): URL | null {
  const normalizedUrl = _normalizeUrl(input);
  if (normalizedUrl == null) {
    return null;
  }
  return _matchSignalRoute(normalizedUrl) != null ? normalizedUrl : null;
}

/**
 * Maybe normalize a URL into a matching route **App** URL.
 * If it we can't match it to a route, return null.
 * @example
 * ```ts
 * toSignalRouteAppUrl(new URL("https://signal.me/#p/+1234567890"))
 * // URL { "sgnl://signal.me/#p/+1234567890" }
 * toSignalRouteAppUrl(new URL("https://example.com"))
 * // null
 * ```
 */
export function toSignalRouteAppUrl(input: URL | string): URL | null {
  const normalizedUrl = _normalizeUrl(input);
  if (normalizedUrl == null) {
    return null;
  }
  const match = _matchSignalRoute(normalizedUrl);
  try {
    return match?.route.toAppUrl(match.parsed.args) ?? null;
  } catch {
    return null;
  }
}

/**
 * Maybe normalize a URL into a matching route **Web** URL.
 * If it we can't match it to a route, return null.
 * @example
 * ```ts
 * toSignalRouteWebUrl(new URL("sgnl://signal.me/#p/+1234567890"))
 * // URL { "https://signal.me/#p/+1234567890" }
 * toSignalRouteWebUrl(new URL("https://example.com"))
 * // null
 * ```
 */
export function toSignalRouteWebUrl(input: URL | string): URL | null {
  const normalizedUrl = _normalizeUrl(input);
  if (normalizedUrl == null) {
    return null;
  }
  const match = _matchSignalRoute(normalizedUrl);
  try {
    return match?.route.toWebUrl(match.parsed.args) ?? null;
  } catch {
    return null;
  }
}

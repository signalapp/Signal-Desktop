// Copyright 2023 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
import { assert } from 'chai';
import type { ParsedSignalRoute } from '../../util/signalRoutes';
import {
  isSignalRoute,
  parseSignalRoute,
  toSignalRouteAppUrl,
  toSignalRouteUrl,
  toSignalRouteWebUrl,
} from '../../util/signalRoutes';

describe('signalRoutes', () => {
  type CheckConfig = {
    hasAppUrl: boolean;
    hasWebUrl: boolean;
    isRoute: boolean;
  };

  function createCheck(options: Partial<CheckConfig> = {}) {
    const config: CheckConfig = {
      hasAppUrl: true,
      hasWebUrl: true,
      isRoute: true,
      ...options,
    };
    // Different than `isRoute` because of normalization
    const hasRouteUrl = config.hasAppUrl || config.hasWebUrl;
    return function check(input: string, expected: ParsedSignalRoute | null) {
      const url = new URL(input);
      assert.deepEqual(parseSignalRoute(url), expected);
      assert.deepEqual(isSignalRoute(url), config.isRoute);
      assert.deepEqual(toSignalRouteUrl(url) != null, hasRouteUrl);
      assert.deepEqual(toSignalRouteAppUrl(url) != null, config.hasAppUrl);
      assert.deepEqual(toSignalRouteWebUrl(url) != null, config.hasWebUrl);
    };
  }

  it('nonsense', () => {
    const check = createCheck({
      isRoute: false,
      hasAppUrl: false,
      hasWebUrl: false,
    });
    // Charles Entertainment Cheese, what are you doing here?
    check('https://www.chuckecheese.com/#p/+1234567890', null);
    // Non-route signal urls
    check('https://signal.me', null);
    check('sgnl://signal.me/#p', null);
    check('sgnl://signal.me/#p/', null);
    check('sgnl://signal.me/p/+1234567890', null);
    check('https://signal.me/?p/+1234567890', null);
  });

  it('normalize', () => {
    const check = createCheck({ isRoute: false, hasAppUrl: true });
    check('http://username:password@signal.me:8888/#p/+1234567890', null);
  });

  it('contactByPhoneNumber', () => {
    const result: ParsedSignalRoute = {
      key: 'contactByPhoneNumber',
      args: { phoneNumber: '+1234567890' },
    };
    const check = createCheck();
    check('https://signal.me/#p/+1234567890', result);
    check('https://signal.me#p/+1234567890', result);
    check('sgnl://signal.me/#p/+1234567890', result);
    check('sgnl://signal.me#p/+1234567890', result);
  });

  it('contactByEncryptedUsername', () => {
    const result: ParsedSignalRoute = {
      key: 'contactByEncryptedUsername',
      args: { encryptedUsername: 'foobar' },
    };
    const check = createCheck();
    check('https://signal.me/#eu/foobar', result);
    check('https://signal.me#eu/foobar', result);
    check('sgnl://signal.me/#eu/foobar', result);
    check('sgnl://signal.me#eu/foobar', result);
  });

  it('groupInvites', () => {
    const result: ParsedSignalRoute = {
      key: 'groupInvites',
      args: { inviteCode: 'foobar' },
    };
    const check = createCheck();
    check('https://signal.group/#foobar', result);
    check('https://signal.group#foobar', result);
    check('sgnl://signal.group/#foobar', result);
    check('sgnl://signal.group#foobar', result);
    check('sgnl://joingroup/#foobar', result);
    check('sgnl://joingroup#foobar', result);
  });

  it('linkDevice', () => {
    const result: ParsedSignalRoute = {
      key: 'linkDevice',
      args: { uuid: 'foo', pubKey: 'bar' },
    };
    const check = createCheck({ hasWebUrl: false });
    check('sgnl://linkdevice/?uuid=foo&pub_key=bar', result);
    check('sgnl://linkdevice?uuid=foo&pub_key=bar', result);
  });

  it('captcha', () => {
    const captchaId =
      'signal-hcaptcha.foo-bar_baz.challenge.foo-bar_baz.foo-bar_baz';
    const result: ParsedSignalRoute = {
      key: 'captcha',
      args: { captchaId },
    };
    const check = createCheck({ hasWebUrl: false });
    check(`signalcaptcha://${captchaId}`, result);
  });

  it('linkCall', () => {
    const result: ParsedSignalRoute = {
      key: 'linkCall',
      args: { key: 'foobar' },
    };
    const check = createCheck();
    check('https://signal.link/call/#key=foobar', result);
    check('https://signal.link/call#key=foobar', result);
    check('sgnl://signal.link/call/#key=foobar', result);
    check('sgnl://signal.link/call#key=foobar', result);
  });

  it('artAuth', () => {
    const result: ParsedSignalRoute = {
      key: 'artAuth',
      args: { token: 'foo', pubKey: 'bar' },
    };
    const check = createCheck({ hasWebUrl: false });
    check('sgnl://art-auth/?token=foo&pub_key=bar', result);
    check('sgnl://art-auth?token=foo&pub_key=bar', result);
  });

  it('artAddStickers', () => {
    const result: ParsedSignalRoute = {
      key: 'artAddStickers',
      args: { packId: 'foo', packKey: 'bar' },
    };
    const check = createCheck();
    check('https://signal.art/addstickers/#pack_id=foo&pack_key=bar', result);
    check('https://signal.art/addstickers#pack_id=foo&pack_key=bar', result);
    check('sgnl://addstickers/?pack_id=foo&pack_key=bar', result);
    check('sgnl://addstickers?pack_id=foo&pack_key=bar', result);
  });

  it('showConversation', () => {
    const check = createCheck({ isRoute: true, hasWebUrl: false });
    const args1 = 'conversationId=abc';
    const args2 = 'conversationId=abc&messageId=def';
    const args3 = 'conversationId=abc&messageId=def&storyId=ghi';
    const result1: ParsedSignalRoute = {
      key: 'showConversation',
      args: { conversationId: 'abc', messageId: null, storyId: null },
    };
    const result2: ParsedSignalRoute = {
      key: 'showConversation',
      args: { conversationId: 'abc', messageId: 'def', storyId: null },
    };
    const result3: ParsedSignalRoute = {
      key: 'showConversation',
      args: { conversationId: 'abc', messageId: 'def', storyId: 'ghi' },
    };
    check(`sgnl://show-conversation/?${args1}`, result1);
    check(`sgnl://show-conversation?${args1}`, result1);
    check(`sgnl://show-conversation/?${args2}`, result2);
    check(`sgnl://show-conversation?${args2}`, result2);
    check(`sgnl://show-conversation/?${args3}`, result3);
    check(`sgnl://show-conversation?${args3}`, result3);
  });

  it('startCallLobby', () => {
    const result: ParsedSignalRoute = {
      key: 'startCallLobby',
      args: { conversationId: 'abc' },
    };
    const check = createCheck({ isRoute: true, hasWebUrl: false });
    check('sgnl://start-call-lobby/?conversationId=abc', result);
    check('sgnl://start-call-lobby?conversationId=abc', result);
  });

  it('showWindow', () => {
    const result: ParsedSignalRoute = {
      key: 'showWindow',
      args: {},
    };
    const check = createCheck({ isRoute: true, hasWebUrl: false });
    check('sgnl://show-window/', result);
    check('sgnl://show-window', result);
  });

  it('setIsPresenting', () => {
    const result: ParsedSignalRoute = {
      key: 'setIsPresenting',
      args: {},
    };
    const check = createCheck({ isRoute: true, hasWebUrl: false });
    check('sgnl://set-is-presenting/', result);
    check('sgnl://set-is-presenting', result);
  });
});

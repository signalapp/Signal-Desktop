"use strict";
// Copyright 2017-2021 Signal Messenger, LLC
// SPDX-License-Identifier: AGPL-3.0-only
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SystemTraySettingCache = void 0;
const log = __importStar(require("../ts/logging/log"));
const SystemTraySetting_1 = require("../ts/types/SystemTraySetting");
const Settings_1 = require("../ts/types/Settings");
/**
 * A small helper class to get and cache the `system-tray-setting` preference in the main
 * process.
 */
class SystemTraySettingCache {
    constructor(sql, argv, appVersion) {
        this.sql = sql;
        this.argv = argv;
        this.appVersion = appVersion;
    }
    async get() {
        if (this.cachedValue !== undefined) {
            return this.cachedValue;
        }
        this.getPromise = this.getPromise || this.doFirstGet();
        return this.getPromise;
    }
    set(value) {
        this.cachedValue = value;
    }
    async doFirstGet() {
        let result;
        // These command line flags are not officially supported, but many users rely on them.
        //   Be careful when removing them or making changes.
        if (this.argv.some(arg => arg === '--start-in-tray')) {
            result = SystemTraySetting_1.SystemTraySetting.MinimizeToAndStartInSystemTray;
            log.info(`getSystemTraySetting saw --start-in-tray flag. Returning ${result}`);
        }
        else if (this.argv.some(arg => arg === '--use-tray-icon')) {
            result = SystemTraySetting_1.SystemTraySetting.MinimizeToSystemTray;
            log.info(`getSystemTraySetting saw --use-tray-icon flag. Returning ${result}`);
        }
        else if (Settings_1.isSystemTraySupported(this.appVersion)) {
            const { value } = (await this.sql.sqlCall('getItemById', [
                'system-tray-setting',
            ])) || { value: undefined };
            if (value !== undefined) {
                result = SystemTraySetting_1.parseSystemTraySetting(value);
                log.info(`getSystemTraySetting returning value from database, ${result}`);
            }
            else {
                result = SystemTraySetting_1.SystemTraySetting.DoNotUseSystemTray;
                log.info(`getSystemTraySetting got no value from database, returning ${result}`);
            }
        }
        else {
            result = SystemTraySetting_1.SystemTraySetting.DoNotUseSystemTray;
            log.info(`getSystemTraySetting had no flags and did no DB lookups. Returning ${result}`);
        }
        // If there's a value in the cache, someone has updated the value "out from under us",
        //   so we should return that because it's newer.
        this.cachedValue =
            this.cachedValue === undefined ? result : this.cachedValue;
        return this.cachedValue;
    }
}
exports.SystemTraySettingCache = SystemTraySettingCache;

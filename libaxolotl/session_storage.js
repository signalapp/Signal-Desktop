/* vim: ts=4:sw=4
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Lesser General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */
;(function() {

'use strict';
window.axolotl = window.axolotl || {};

var RecipientRecord = function(identityKey, registrationId) {
    this._sessions = {};
    this.identityKey = identityKey !== undefined ? getString(identityKey) : null;
    this.registrationId = registrationId;

    if (this.registrationId === undefined || typeof this.registrationId !== "number")
        this.registrationId = null;
};

RecipientRecord.prototype.serialize = function() {
    return textsecure.utils.jsonThing({sessions: this._sessions, registrationId: this.registrationId, identityKey: this.identityKey});
}

RecipientRecord.prototype.deserialize = function(serialized) {
    var data = JSON.parse(serialized);
    this._sessions = data.sessions;
    if (this._sessions === undefined || this._sessions === null || typeof this._sessions !== "object" || Array.isArray(this._sessions))
        throw new Error("Error deserializing RecipientRecord");
    this.identityKey = data.identityKey;
    this.registrationId = data.registrationId;
    if (this.identityKey === undefined || this.registrationId === undefined)
        throw new Error("Error deserializing RecipientRecord");
}

RecipientRecord.prototype.haveOpenSession = function() {
    return this.registrationId !== null;
}

window.axolotl.sessions = {
    RecipientRecord: RecipientRecord,
};

})();

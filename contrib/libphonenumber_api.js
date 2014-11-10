/**
 * @license
 * Copyright (C) 2014 codedust.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

goog.require('i18n.phonenumbers.PhoneNumberFormat');
goog.require('i18n.phonenumbers.PhoneNumberUtil');

var libphonenumber = function(){
	var self = {};
	
	var phoneUtil = i18n.phonenumbers.PhoneNumberUtil.getInstance();
	
	self.parse = function(phoneNumber, regionCode) {
		try {
			return phoneUtil.parse(phoneNumber, regionCode);
		} catch (e) {
			throw e;
		}
	};
	
	self.getCountryCodeForRegion = function(regionCode){
		return phoneUtil.getCountryCodeForRegion(regionCode);
	};
	
	self.getRegionCodeForCountryCode = function(countryCallingCode){
		return phoneUtil.getRegionCodeForCountryCode(countryCallingCode);
	};
	
	self.getRegionCodeForNumber = function(number){
		return phoneUtil.getRegionCodeForNumber(number);
	};
	
	self.isValidNumber = function(number){
		return phoneUtil.isValidNumber(number);
	};
	
	self.isValidNumberForRegion = function(number, regionCode){
		return phoneUtil.isValidNumberForRegion(number, regionCode);
	};
	
	self.PhoneNumberFormat = i18n.phonenumbers.PhoneNumberFormat;
	
	self.format = function(number, numberFormat){
		return phoneUtil.format(number, numberFormat);
	};
	
	return self;
}();

goog.exportSymbol('libphonenumber.parse', libphonenumber.parse);
goog.exportSymbol('libphonenumber.getCountryCodeForRegion', libphonenumber.getCountryCodeForRegion);
goog.exportSymbol('libphonenumber.getRegionCodeForCountryCode', libphonenumber.getRegionCodeForCountryCode);
goog.exportSymbol('libphonenumber.getRegionCodeForNumber', libphonenumber.getRegionCodeForNumber);
goog.exportSymbol('libphonenumber.isValidNumber', libphonenumber.isValidNumber);
goog.exportSymbol('libphonenumber.isValidNumberForRegion', libphonenumber.isValidNumberForRegion);
goog.exportSymbol('libphonenumber.PhoneNumberFormat', libphonenumber.PhoneNumberFormat);
goog.exportSymbol('libphonenumber.PhoneNumberFormat.E164', libphonenumber.PhoneNumberFormat.E164);
goog.exportSymbol('libphonenumber.PhoneNumberFormat.INTERNATIONAL', libphonenumber.PhoneNumberFormat.INTERNATIONAL);
goog.exportSymbol('libphonenumber.PhoneNumberFormat.NATIONAL', libphonenumber.PhoneNumberFormat.NATIONAL);
goog.exportSymbol('libphonenumber.PhoneNumberFormat.RFC3966', libphonenumber.PhoneNumberFormat.RFC3966);
goog.exportSymbol('libphonenumber.format', libphonenumber.format);

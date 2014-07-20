/*
 * Copyright (c) 2013 Matt Corallo
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

#include "curve25519-donna.h"

#include <ppapi/cpp/instance.h>
#include <ppapi/cpp/module.h>
#include <ppapi/cpp/var.h>
#include <ppapi/cpp/var_dictionary.h>
#include <ppapi/cpp/var_array_buffer.h>

#include <string.h>

const unsigned char basepoint[32] = {9};

class Curve25519Instance : public pp::Instance {
public:
	explicit Curve25519Instance(PP_Instance instance) : pp::Instance(instance) {}

	virtual void HandleMessage(const pp::Var& var_message) {
		if (!var_message.is_dictionary())
			return; // Go away broken client

		pp::VarDictionary dictionary(var_message);
		pp::VarArrayBuffer privArrBuff(dictionary.Get("priv"));
		if (privArrBuff.is_null() || privArrBuff.ByteLength() != 32)
			return; // Go away broken client
		unsigned char* priv = static_cast<unsigned char*>(privArrBuff.Map());

		pp::VarArrayBuffer resBuffer(32);
		unsigned char* res = static_cast<unsigned char*>(resBuffer.Map());

		std::string command = dictionary.Get("command").AsString();
		if (command == "bytesToPriv") {
			memcpy(res, priv, 32);
			res[0] &= 248;
			res[31] &= 127;
			res[31] |= 64;
		} else if (command == "privToPub") {
			curve25519_donna(res, priv, basepoint);
		} else if (command == "ECDHE") {
			pp::VarArrayBuffer pubArrBuff(dictionary.Get("pub"));
			if (!pubArrBuff.is_null() && pubArrBuff.ByteLength() == 32) {
				unsigned char* pub = static_cast<unsigned char*>(pubArrBuff.Map());
				curve25519_donna(res, priv, pub);
				pubArrBuff.Unmap();
			}
		}

		resBuffer.Unmap();
		privArrBuff.Unmap();

		pp::VarDictionary returnMessage;
		returnMessage.Set("call_id", dictionary.Get("call_id").AsInt());
		returnMessage.Set("res", resBuffer);
		PostMessage(returnMessage);
	}
};

class Curve25519Module : public pp::Module {
public:
	Curve25519Module() : pp::Module() {}

	virtual pp::Instance* CreateInstance(PP_Instance instance) {
		return new Curve25519Instance(instance);
	}
};

namespace pp {
Module* CreateModule() {
	return new Curve25519Module();
}
}

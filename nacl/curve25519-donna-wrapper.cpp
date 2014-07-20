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
#include "ed25519/additions/curve_sigs.h"

#include <ppapi/cpp/instance.h>
#include <ppapi/cpp/module.h>
#include <ppapi/cpp/var.h>
#include <ppapi/cpp/var_dictionary.h>
#include <ppapi/cpp/var_array_buffer.h>

#include <string.h>

const unsigned char basepoint[32] = {9};

template<int Length>
class AutoArrayBufferObject {
private:
	pp::VarArrayBuffer buf;
	unsigned char* map;
public:
	AutoArrayBufferObject(pp::Var v) : buf(v), map(NULL) {}

	unsigned char *Get() {
		if (map)
			return map;

		if (buf.is_null())
			return NULL;
		if (Length > 0 && buf.ByteLength() != Length)
			return NULL;

		map = static_cast<unsigned char*>(buf.Map());
		return map;
	}

	long GetLength() {
		return buf.is_null() ? -1 : buf.ByteLength();
	}

	~AutoArrayBufferObject() {
		if (map)
			buf.Unmap();
	}
};

class Curve25519Instance : public pp::Instance {
public:
	explicit Curve25519Instance(PP_Instance instance) : pp::Instance(instance) {}

	virtual void HandleMessage(const pp::Var& var_message) {
		if (!var_message.is_dictionary())
			return; // Go away broken client

		pp::VarDictionary dictionary(var_message);
		std::string command = dictionary.Get("command").AsString();

		pp::VarDictionary returnMessage;

		pp::VarArrayBuffer resBuffer(64);
		unsigned char* res = static_cast<unsigned char*>(resBuffer.Map());

		if (command == "bytesToPriv") {
			AutoArrayBufferObject<32> priv(dictionary.Get("priv"));
			if (!priv.Get())
				return; // Go away broken client

			memcpy(res, priv.Get(), 32);
			res[0] &= 248;
			res[31] &= 127;
			res[31] |= 64;
		} else if (command == "privToPub") {
			AutoArrayBufferObject<32> priv(dictionary.Get("priv"));
			if (!priv.Get())
				return; // Go away broken client

			curve25519_donna(res, priv.Get(), basepoint);
		} else if (command == "ECDHE") {
			AutoArrayBufferObject<32> priv(dictionary.Get("priv"));
			AutoArrayBufferObject<32> pub(dictionary.Get("pub"));
			if (!priv.Get() || !pub.Get())
				return; // Go away broken client

			curve25519_donna(res, priv.Get(), pub.Get());
		} else if (command == "Ed25519Sign") {
			AutoArrayBufferObject<32> priv(dictionary.Get("priv"));
			AutoArrayBufferObject<-1> msg(dictionary.Get("msg"));
			if (!priv.Get() || !msg.Get())
				return; // Go away broken client

			curve25519_sign(res, priv.Get(), msg.Get(), msg.GetLength());
		}

		resBuffer.Unmap();

		if (command != "Ed25519Verify")
			returnMessage.Set("res", resBuffer);
		else {
			AutoArrayBufferObject<32> pub(dictionary.Get("pub"));
			AutoArrayBufferObject<-1> msg(dictionary.Get("msg"));
			AutoArrayBufferObject<64> sig(dictionary.Get("sig"));
			if (!pub.Get() || !msg.Get() || !sig.Get())
				return; // Go away broken client

			bool res = curve25519_verify(sig.Get(), pub.Get(), msg.Get(), msg.GetLength()) == 0;

			returnMessage.Set("res", res);
		}

		returnMessage.Set("call_id", dictionary.Get("call_id").AsInt());
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

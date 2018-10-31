// Copyright 2010 The Emscripten Authors.  All rights reserved.
// Emscripten is available under two separate licenses, the MIT license and the
// University of Illinois/NCSA Open Source License.  Both these licenses can be
// found in the LICENSE file.

// The Module object: Our interface to the outside world. We import
// and export values on it. There are various ways Module can be used:
// 1. Not defined. We create it here
// 2. A function parameter, function(Module) { ..generated code.. }
// 3. pre-run appended it, var Module = {}; ..generated code..
// 4. External script tag defines var Module.
// We need to check if Module already exists (e.g. case 3 above).
// Substitution will be replaced with actual code on later stage of the build,
// this way Closure Compiler will not mangle it (e.g. case 4. above).
// Note that if you want to run closure, and also to use Module
// after the generated code, you will need to define   var Module = {};
// before the code. Then that object will be used in the code, and you
// can continue to use Module afterwards as well.
var Module = typeof Module !== 'undefined' ? Module : {};

// --pre-jses are emitted after the Module integration code, so that they can
// refer to Module (if they choose; they can also define Module)
// {{PRE_JSES}}

// Sometimes an existing Module object exists with properties
// meant to overwrite the default module functionality. Here
// we collect those properties and reapply _after_ we configure
// the current environment's defaults to avoid having to be so
// defensive during initialization.
var moduleOverrides = {};
var key;
for (key in Module) {
  if (Module.hasOwnProperty(key)) {
    moduleOverrides[key] = Module[key];
  }
}

Module['arguments'] = [];
Module['thisProgram'] = './this.program';
Module['quit'] = function(status, toThrow) {
  throw toThrow;
};
Module['preRun'] = [];
Module['postRun'] = [];

// Determine the runtime environment we are in. You can customize this by
// setting the ENVIRONMENT setting at compile time (see settings.js).

var ENVIRONMENT_IS_WEB = false;
var ENVIRONMENT_IS_WORKER = false;
var ENVIRONMENT_IS_NODE = true;
var ENVIRONMENT_IS_SHELL = false;

if (Module['ENVIRONMENT']) {
  throw new Error('Module.ENVIRONMENT has been deprecated. To force the environment, use the ENVIRONMENT compile-time option (for example, -s ENVIRONMENT=web or -s ENVIRONMENT=node)');
}

// Three configurations we can be running in:
// 1) We could be the application main() thread running in the main JS UI thread. (ENVIRONMENT_IS_WORKER == false and ENVIRONMENT_IS_PTHREAD == false)
// 2) We could be the application main() thread proxied to worker. (with Emscripten -s PROXY_TO_WORKER=1) (ENVIRONMENT_IS_WORKER == true, ENVIRONMENT_IS_PTHREAD == false)
// 3) We could be an application pthread running in a worker. (ENVIRONMENT_IS_WORKER == true and ENVIRONMENT_IS_PTHREAD == true)

// `/` should be present at the end if `scriptDirectory` is not empty
var scriptDirectory = '';
function locateFile(path) {
  if (Module['locateFile']) {
    return Module['locateFile'](path, scriptDirectory);
  } else {
    return scriptDirectory + path;
  }
}

if (ENVIRONMENT_IS_NODE) {
  scriptDirectory = __dirname + '/';
  if (!(typeof process === 'object' && typeof require === 'function')) throw new Error('not compiled for this environment (did you build to HTML and try to run it not on the web, or set ENVIRONMENT to something - like node - and run it someplace else - like on the web?)');

  // Expose functionality in the same simple way that the shells work
  // Note that we pollute the global namespace here, otherwise we break in node
  var nodeFS;
  var nodePath;

  Module['read'] = function shell_read(filename, binary) {
    var ret;
    ret = tryParseAsDataURI(filename);
    if (!ret) {
      if (!nodeFS) nodeFS = require('fs');
      if (!nodePath) nodePath = require('path');
      filename = nodePath['normalize'](filename);
      ret = nodeFS['readFileSync'](filename);
    }
    return binary ? ret : ret.toString();
  };

  Module['readBinary'] = function readBinary(filename) {
    var ret = Module['read'](filename, true);
    if (!ret.buffer) {
      ret = new Uint8Array(ret);
    }
    assert(ret.buffer);
    return ret;
  };

  if (process['argv'].length > 1) {
    Module['thisProgram'] = process['argv'][1].replace(/\\/g, '/');
  }

  Module['arguments'] = process['argv'].slice(2);

  if (typeof module !== 'undefined') {
    module['exports'] = Module;
  }

  process['on']('uncaughtException', function(ex) {
    // suppress ExitStatus exceptions from showing an error
    if (!(ex instanceof ExitStatus)) {
      throw ex;
    }
  });
  // Currently node will swallow unhandled rejections, but this behavior is
  // deprecated, and in the future it will exit with error status.
  process['on']('unhandledRejection', abort);

  Module['quit'] = function(status) {
    process['exit'](status);
  };

  Module['inspect'] = function () { return '[Emscripten Module object]'; };
} else
{
  throw new Error('environment detection error');
}

// Set up the out() and err() hooks, which are how we can print to stdout or
// stderr, respectively.
// If the user provided Module.print or printErr, use that. Otherwise,
// console.log is checked first, as 'print' on the web will open a print dialogue
// printErr is preferable to console.warn (works better in shells)
// bind(console) is necessary to fix IE/Edge closed dev tools panel behavior.
var out = Module['print'] || (typeof console !== 'undefined' ? console.log.bind(console) : (typeof print !== 'undefined' ? print : null));
var err = Module['printErr'] || (typeof printErr !== 'undefined' ? printErr : ((typeof console !== 'undefined' && console.warn.bind(console)) || out));

// Merge back in the overrides
for (key in moduleOverrides) {
  if (moduleOverrides.hasOwnProperty(key)) {
    Module[key] = moduleOverrides[key];
  }
}
// Free the object hierarchy contained in the overrides, this lets the GC
// reclaim data used e.g. in memoryInitializerRequest, which is a large typed array.
moduleOverrides = undefined;

// perform assertions in shell.js after we set up out() and err(), as otherwise if an assertion fails it cannot print the message
assert(typeof Module['memoryInitializerPrefixURL'] === 'undefined', 'Module.memoryInitializerPrefixURL option was removed, use Module.locateFile instead');
assert(typeof Module['pthreadMainPrefixURL'] === 'undefined', 'Module.pthreadMainPrefixURL option was removed, use Module.locateFile instead');
assert(typeof Module['cdInitializerPrefixURL'] === 'undefined', 'Module.cdInitializerPrefixURL option was removed, use Module.locateFile instead');
assert(typeof Module['filePackagePrefixURL'] === 'undefined', 'Module.filePackagePrefixURL option was removed, use Module.locateFile instead');



// Copyright 2017 The Emscripten Authors.  All rights reserved.
// Emscripten is available under two separate licenses, the MIT license and the
// University of Illinois/NCSA Open Source License.  Both these licenses can be
// found in the LICENSE file.

// {{PREAMBLE_ADDITIONS}}

var STACK_ALIGN = 16;

// stack management, and other functionality that is provided by the compiled code,
// should not be used before it is ready
stackSave = stackRestore = stackAlloc = setTempRet0 = getTempRet0 = function() {
  abort('cannot use the stack before compiled code is ready to run, and has provided stack access');
};

function staticAlloc(size) {
  assert(!staticSealed);
  var ret = STATICTOP;
  STATICTOP = (STATICTOP + size + 15) & -16;
  assert(STATICTOP < TOTAL_MEMORY, 'not enough memory for static allocation - increase TOTAL_MEMORY');
  return ret;
}

function dynamicAlloc(size) {
  assert(DYNAMICTOP_PTR);
  var ret = HEAP32[DYNAMICTOP_PTR>>2];
  var end = (ret + size + 15) & -16;
  HEAP32[DYNAMICTOP_PTR>>2] = end;
  if (end >= TOTAL_MEMORY) {
    var success = enlargeMemory();
    if (!success) {
      HEAP32[DYNAMICTOP_PTR>>2] = ret;
      return 0;
    }
  }
  return ret;
}

function alignMemory(size, factor) {
  if (!factor) factor = STACK_ALIGN; // stack alignment (16-byte) by default
  var ret = size = Math.ceil(size / factor) * factor;
  return ret;
}

function getNativeTypeSize(type) {
  switch (type) {
    case 'i1': case 'i8': return 1;
    case 'i16': return 2;
    case 'i32': return 4;
    case 'i64': return 8;
    case 'float': return 4;
    case 'double': return 8;
    default: {
      if (type[type.length-1] === '*') {
        return 4; // A pointer
      } else if (type[0] === 'i') {
        var bits = parseInt(type.substr(1));
        assert(bits % 8 === 0);
        return bits / 8;
      } else {
        return 0;
      }
    }
  }
}

function warnOnce(text) {
  if (!warnOnce.shown) warnOnce.shown = {};
  if (!warnOnce.shown[text]) {
    warnOnce.shown[text] = 1;
    err(text);
  }
}

var asm2wasmImports = { // special asm2wasm imports
    "f64-rem": function(x, y) {
        return x % y;
    },
    "debugger": function() {
        debugger;
    }
};



var jsCallStartIndex = 1;
var functionPointers = new Array(0);

// 'sig' parameter is only used on LLVM wasm backend
function addFunction(func, sig) {
  if (typeof sig === 'undefined') {
    err('warning: addFunction(): You should provide a wasm function signature string as a second argument. This is not necessary for asm.js and asm2wasm, but is required for the LLVM wasm backend, so it is recommended for full portability.');
  }
  var base = 0;
  for (var i = base; i < base + 0; i++) {
    if (!functionPointers[i]) {
      functionPointers[i] = func;
      return jsCallStartIndex + i;
    }
  }
  throw 'Finished up all reserved function pointers. Use a higher value for RESERVED_FUNCTION_POINTERS.';
}

function removeFunction(index) {
  functionPointers[index-jsCallStartIndex] = null;
}

var funcWrappers = {};

function getFuncWrapper(func, sig) {
  if (!func) return; // on null pointer, return undefined
  assert(sig);
  if (!funcWrappers[sig]) {
    funcWrappers[sig] = {};
  }
  var sigCache = funcWrappers[sig];
  if (!sigCache[func]) {
    // optimize away arguments usage in common cases
    if (sig.length === 1) {
      sigCache[func] = function dynCall_wrapper() {
        return dynCall(sig, func);
      };
    } else if (sig.length === 2) {
      sigCache[func] = function dynCall_wrapper(arg) {
        return dynCall(sig, func, [arg]);
      };
    } else {
      // general case
      sigCache[func] = function dynCall_wrapper() {
        return dynCall(sig, func, Array.prototype.slice.call(arguments));
      };
    }
  }
  return sigCache[func];
}


function makeBigInt(low, high, unsigned) {
  return unsigned ? ((+((low>>>0)))+((+((high>>>0)))*4294967296.0)) : ((+((low>>>0)))+((+((high|0)))*4294967296.0));
}

function dynCall(sig, ptr, args) {
  if (args && args.length) {
    assert(args.length == sig.length-1);
    assert(('dynCall_' + sig) in Module, 'bad function pointer type - no table for sig \'' + sig + '\'');
    return Module['dynCall_' + sig].apply(null, [ptr].concat(args));
  } else {
    assert(sig.length == 1);
    assert(('dynCall_' + sig) in Module, 'bad function pointer type - no table for sig \'' + sig + '\'');
    return Module['dynCall_' + sig].call(null, ptr);
  }
}


function getCompilerSetting(name) {
  throw 'You must build with -s RETAIN_COMPILER_SETTINGS=1 for getCompilerSetting or emscripten_get_compiler_setting to work';
}

var Runtime = {
  // FIXME backwards compatibility layer for ports. Support some Runtime.*
  //       for now, fix it there, then remove it from here. That way we
  //       can minimize any period of breakage.
  dynCall: dynCall, // for SDL2 port
  // helpful errors
  getTempRet0: function() { abort('getTempRet0() is now a top-level function, after removing the Runtime object. Remove "Runtime."') },
  staticAlloc: function() { abort('staticAlloc() is now a top-level function, after removing the Runtime object. Remove "Runtime."') },
  stackAlloc: function() { abort('stackAlloc() is now a top-level function, after removing the Runtime object. Remove "Runtime."') },
};

// The address globals begin at. Very low in memory, for code size and optimization opportunities.
// Above 0 is static memory, starting with globals.
// Then the stack.
// Then 'dynamic' memory for sbrk.
var GLOBAL_BASE = 8;


// === Preamble library stuff ===

// Documentation for the public APIs defined in this file must be updated in:
//    site/source/docs/api_reference/preamble.js.rst
// A prebuilt local version of the documentation is available at:
//    site/build/text/docs/api_reference/preamble.js.txt
// You can also build docs locally as HTML or other formats in site/
// An online HTML version (which may be of a different version of Emscripten)
//    is up at http://kripken.github.io/emscripten-site/docs/api_reference/preamble.js.html



//========================================
// Runtime essentials
//========================================

// whether we are quitting the application. no code should run after this.
// set in exit() and abort()
var ABORT = false;

// set by exit() and abort().  Passed to 'onExit' handler.
// NOTE: This is also used as the process return code code in shell environments
// but only when noExitRuntime is false.
var EXITSTATUS = 0;

/** @type {function(*, string=)} */
function assert(condition, text) {
  if (!condition) {
    abort('Assertion failed: ' + text);
  }
}

var globalScope = this;

// Returns the C function with a specified identifier (for C++, you need to do manual name mangling)
function getCFunc(ident) {
  var func = Module['_' + ident]; // closure exported function
  assert(func, 'Cannot call unknown function ' + ident + ', make sure it is exported');
  return func;
}

var JSfuncs = {
  // Helpers for cwrap -- it can't refer to Runtime directly because it might
  // be renamed by closure, instead it calls JSfuncs['stackSave'].body to find
  // out what the minified function name is.
  'stackSave': function() {
    stackSave()
  },
  'stackRestore': function() {
    stackRestore()
  },
  // type conversion from js to c
  'arrayToC' : function(arr) {
    var ret = stackAlloc(arr.length);
    writeArrayToMemory(arr, ret);
    return ret;
  },
  'stringToC' : function(str) {
    var ret = 0;
    if (str !== null && str !== undefined && str !== 0) { // null string
      // at most 4 bytes per UTF-8 code point, +1 for the trailing '\0'
      var len = (str.length << 2) + 1;
      ret = stackAlloc(len);
      stringToUTF8(str, ret, len);
    }
    return ret;
  }
};

// For fast lookup of conversion functions
var toC = {
  'string': JSfuncs['stringToC'], 'array': JSfuncs['arrayToC']
};


// C calling interface.
function ccall(ident, returnType, argTypes, args, opts) {
  function convertReturnValue(ret) {
    if (returnType === 'string') return Pointer_stringify(ret);
    if (returnType === 'boolean') return Boolean(ret);
    return ret;
  }

  var func = getCFunc(ident);
  var cArgs = [];
  var stack = 0;
  assert(returnType !== 'array', 'Return type should not be "array".');
  if (args) {
    for (var i = 0; i < args.length; i++) {
      var converter = toC[argTypes[i]];
      if (converter) {
        if (stack === 0) stack = stackSave();
        cArgs[i] = converter(args[i]);
      } else {
        cArgs[i] = args[i];
      }
    }
  }
  var ret = func.apply(null, cArgs);
  ret = convertReturnValue(ret);
  if (stack !== 0) stackRestore(stack);
  return ret;
}

function cwrap(ident, returnType, argTypes, opts) {
  return function() {
    return ccall(ident, returnType, argTypes, arguments, opts);
  }
}

/** @type {function(number, number, string, boolean=)} */
function setValue(ptr, value, type, noSafe) {
  type = type || 'i8';
  if (type.charAt(type.length-1) === '*') type = 'i32'; // pointers are 32-bit
    switch(type) {
      case 'i1': HEAP8[((ptr)>>0)]=value; break;
      case 'i8': HEAP8[((ptr)>>0)]=value; break;
      case 'i16': HEAP16[((ptr)>>1)]=value; break;
      case 'i32': HEAP32[((ptr)>>2)]=value; break;
      case 'i64': (tempI64 = [value>>>0,(tempDouble=value,(+(Math_abs(tempDouble))) >= 1.0 ? (tempDouble > 0.0 ? ((Math_min((+(Math_floor((tempDouble)/4294967296.0))), 4294967295.0))|0)>>>0 : (~~((+(Math_ceil((tempDouble - +(((~~(tempDouble)))>>>0))/4294967296.0)))))>>>0) : 0)],HEAP32[((ptr)>>2)]=tempI64[0],HEAP32[(((ptr)+(4))>>2)]=tempI64[1]); break;
      case 'float': HEAPF32[((ptr)>>2)]=value; break;
      case 'double': HEAPF64[((ptr)>>3)]=value; break;
      default: abort('invalid type for setValue: ' + type);
    }
}

/** @type {function(number, string, boolean=)} */
function getValue(ptr, type, noSafe) {
  type = type || 'i8';
  if (type.charAt(type.length-1) === '*') type = 'i32'; // pointers are 32-bit
    switch(type) {
      case 'i1': return HEAP8[((ptr)>>0)];
      case 'i8': return HEAP8[((ptr)>>0)];
      case 'i16': return HEAP16[((ptr)>>1)];
      case 'i32': return HEAP32[((ptr)>>2)];
      case 'i64': return HEAP32[((ptr)>>2)];
      case 'float': return HEAPF32[((ptr)>>2)];
      case 'double': return HEAPF64[((ptr)>>3)];
      default: abort('invalid type for getValue: ' + type);
    }
  return null;
}

var ALLOC_NORMAL = 0; // Tries to use _malloc()
var ALLOC_STACK = 1; // Lives for the duration of the current function call
var ALLOC_STATIC = 2; // Cannot be freed
var ALLOC_DYNAMIC = 3; // Cannot be freed except through sbrk
var ALLOC_NONE = 4; // Do not allocate

// allocate(): This is for internal use. You can use it yourself as well, but the interface
//             is a little tricky (see docs right below). The reason is that it is optimized
//             for multiple syntaxes to save space in generated code. So you should
//             normally not use allocate(), and instead allocate memory using _malloc(),
//             initialize it with setValue(), and so forth.
// @slab: An array of data, or a number. If a number, then the size of the block to allocate,
//        in *bytes* (note that this is sometimes confusing: the next parameter does not
//        affect this!)
// @types: Either an array of types, one for each byte (or 0 if no type at that position),
//         or a single type which is used for the entire block. This only matters if there
//         is initial data - if @slab is a number, then this does not matter at all and is
//         ignored.
// @allocator: How to allocate memory, see ALLOC_*
/** @type {function((TypedArray|Array<number>|number), string, number, number=)} */
function allocate(slab, types, allocator, ptr) {
  var zeroinit, size;
  if (typeof slab === 'number') {
    zeroinit = true;
    size = slab;
  } else {
    zeroinit = false;
    size = slab.length;
  }

  var singleType = typeof types === 'string' ? types : null;

  var ret;
  if (allocator == ALLOC_NONE) {
    ret = ptr;
  } else {
    ret = [typeof _malloc === 'function' ? _malloc : staticAlloc, stackAlloc, staticAlloc, dynamicAlloc][allocator === undefined ? ALLOC_STATIC : allocator](Math.max(size, singleType ? 1 : types.length));
  }

  if (zeroinit) {
    var stop;
    ptr = ret;
    assert((ret & 3) == 0);
    stop = ret + (size & ~3);
    for (; ptr < stop; ptr += 4) {
      HEAP32[((ptr)>>2)]=0;
    }
    stop = ret + size;
    while (ptr < stop) {
      HEAP8[((ptr++)>>0)]=0;
    }
    return ret;
  }

  if (singleType === 'i8') {
    if (slab.subarray || slab.slice) {
      HEAPU8.set(/** @type {!Uint8Array} */ (slab), ret);
    } else {
      HEAPU8.set(new Uint8Array(slab), ret);
    }
    return ret;
  }

  var i = 0, type, typeSize, previousType;
  while (i < size) {
    var curr = slab[i];

    type = singleType || types[i];
    if (type === 0) {
      i++;
      continue;
    }
    assert(type, 'Must know what type to store in allocate!');

    if (type == 'i64') type = 'i32'; // special case: we have one i32 here, and one i32 later

    setValue(ret+i, curr, type);

    // no need to look up size unless type changes, so cache it
    if (previousType !== type) {
      typeSize = getNativeTypeSize(type);
      previousType = type;
    }
    i += typeSize;
  }

  return ret;
}

// Allocate memory during any stage of startup - static memory early on, dynamic memory later, malloc when ready
function getMemory(size) {
  if (!staticSealed) return staticAlloc(size);
  if (!runtimeInitialized) return dynamicAlloc(size);
  return _malloc(size);
}

/** @type {function(number, number=)} */
function Pointer_stringify(ptr, length) {
  if (length === 0 || !ptr) return '';
  // Find the length, and check for UTF while doing so
  var hasUtf = 0;
  var t;
  var i = 0;
  while (1) {
    assert(ptr + i < TOTAL_MEMORY);
    t = HEAPU8[(((ptr)+(i))>>0)];
    hasUtf |= t;
    if (t == 0 && !length) break;
    i++;
    if (length && i == length) break;
  }
  if (!length) length = i;

  var ret = '';

  if (hasUtf < 128) {
    var MAX_CHUNK = 1024; // split up into chunks, because .apply on a huge string can overflow the stack
    var curr;
    while (length > 0) {
      curr = String.fromCharCode.apply(String, HEAPU8.subarray(ptr, ptr + Math.min(length, MAX_CHUNK)));
      ret = ret ? ret + curr : curr;
      ptr += MAX_CHUNK;
      length -= MAX_CHUNK;
    }
    return ret;
  }
  return UTF8ToString(ptr);
}

// Given a pointer 'ptr' to a null-terminated ASCII-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

function AsciiToString(ptr) {
  var str = '';
  while (1) {
    var ch = HEAP8[((ptr++)>>0)];
    if (!ch) return str;
    str += String.fromCharCode(ch);
  }
}

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in ASCII form. The copy will require at most str.length+1 bytes of space in the HEAP.

function stringToAscii(str, outPtr) {
  return writeAsciiToMemory(str, outPtr, false);
}

// Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the given array that contains uint8 values, returns
// a copy of that string as a Javascript String object.

var UTF8Decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf8') : undefined;
function UTF8ArrayToString(u8Array, idx) {
  var endPtr = idx;
  // TextDecoder needs to know the byte length in advance, it doesn't stop on null terminator by itself.
  // Also, use the length info to avoid running tiny strings through TextDecoder, since .subarray() allocates garbage.
  while (u8Array[endPtr]) ++endPtr;

  if (endPtr - idx > 16 && u8Array.subarray && UTF8Decoder) {
    return UTF8Decoder.decode(u8Array.subarray(idx, endPtr));
  } else {
    var u0, u1, u2, u3, u4, u5;

    var str = '';
    while (1) {
      // For UTF8 byte structure, see:
      // http://en.wikipedia.org/wiki/UTF-8#Description
      // https://www.ietf.org/rfc/rfc2279.txt
      // https://tools.ietf.org/html/rfc3629
      u0 = u8Array[idx++];
      if (!u0) return str;
      if (!(u0 & 0x80)) { str += String.fromCharCode(u0); continue; }
      u1 = u8Array[idx++] & 63;
      if ((u0 & 0xE0) == 0xC0) { str += String.fromCharCode(((u0 & 31) << 6) | u1); continue; }
      u2 = u8Array[idx++] & 63;
      if ((u0 & 0xF0) == 0xE0) {
        u0 = ((u0 & 15) << 12) | (u1 << 6) | u2;
      } else {
        u3 = u8Array[idx++] & 63;
        if ((u0 & 0xF8) == 0xF0) {
          u0 = ((u0 & 7) << 18) | (u1 << 12) | (u2 << 6) | u3;
        } else {
          u4 = u8Array[idx++] & 63;
          if ((u0 & 0xFC) == 0xF8) {
            u0 = ((u0 & 3) << 24) | (u1 << 18) | (u2 << 12) | (u3 << 6) | u4;
          } else {
            u5 = u8Array[idx++] & 63;
            u0 = ((u0 & 1) << 30) | (u1 << 24) | (u2 << 18) | (u3 << 12) | (u4 << 6) | u5;
          }
        }
      }
      if (u0 < 0x10000) {
        str += String.fromCharCode(u0);
      } else {
        var ch = u0 - 0x10000;
        str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
      }
    }
  }
}

// Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

function UTF8ToString(ptr) {
  return UTF8ArrayToString(HEAPU8,ptr);
}

// Copies the given Javascript String object 'str' to the given byte array at address 'outIdx',
// encoded in UTF8 form and null-terminated. The copy will require at most str.length*4+1 bytes of space in the HEAP.
// Use the function lengthBytesUTF8 to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outU8Array: the array to copy to. Each index in this array is assumed to be one 8-byte element.
//   outIdx: The starting offset in the array to begin the copying.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array.
//                    This count should include the null terminator,
//                    i.e. if maxBytesToWrite=1, only the null terminator will be written and nothing else.
//                    maxBytesToWrite=0 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF8Array(str, outU8Array, outIdx, maxBytesToWrite) {
  if (!(maxBytesToWrite > 0)) // Parameter maxBytesToWrite is not optional. Negative values, 0, null, undefined and false each don't write out any bytes.
    return 0;

  var startIdx = outIdx;
  var endIdx = outIdx + maxBytesToWrite - 1; // -1 for string null terminator.
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! So decode UTF16->UTF32->UTF8.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    // For UTF8 byte structure, see http://en.wikipedia.org/wiki/UTF-8#Description and https://www.ietf.org/rfc/rfc2279.txt and https://tools.ietf.org/html/rfc3629
    var u = str.charCodeAt(i); // possibly a lead surrogate
    if (u >= 0xD800 && u <= 0xDFFF) {
      var u1 = str.charCodeAt(++i);
      u = 0x10000 + ((u & 0x3FF) << 10) | (u1 & 0x3FF);
    }
    if (u <= 0x7F) {
      if (outIdx >= endIdx) break;
      outU8Array[outIdx++] = u;
    } else if (u <= 0x7FF) {
      if (outIdx + 1 >= endIdx) break;
      outU8Array[outIdx++] = 0xC0 | (u >> 6);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0xFFFF) {
      if (outIdx + 2 >= endIdx) break;
      outU8Array[outIdx++] = 0xE0 | (u >> 12);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0x1FFFFF) {
      if (outIdx + 3 >= endIdx) break;
      outU8Array[outIdx++] = 0xF0 | (u >> 18);
      outU8Array[outIdx++] = 0x80 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0x3FFFFFF) {
      if (outIdx + 4 >= endIdx) break;
      outU8Array[outIdx++] = 0xF8 | (u >> 24);
      outU8Array[outIdx++] = 0x80 | ((u >> 18) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else {
      if (outIdx + 5 >= endIdx) break;
      outU8Array[outIdx++] = 0xFC | (u >> 30);
      outU8Array[outIdx++] = 0x80 | ((u >> 24) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 18) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    }
  }
  // Null-terminate the pointer to the buffer.
  outU8Array[outIdx] = 0;
  return outIdx - startIdx;
}

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF8 form. The copy will require at most str.length*4+1 bytes of space in the HEAP.
// Use the function lengthBytesUTF8 to compute the exact number of bytes (excluding null terminator) that this function will write.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF8(str, outPtr, maxBytesToWrite) {
  assert(typeof maxBytesToWrite == 'number', 'stringToUTF8(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!');
  return stringToUTF8Array(str, HEAPU8,outPtr, maxBytesToWrite);
}

// Returns the number of bytes the given Javascript string takes if encoded as a UTF8 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF8(str) {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! So decode UTF16->UTF32->UTF8.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var u = str.charCodeAt(i); // possibly a lead surrogate
    if (u >= 0xD800 && u <= 0xDFFF) u = 0x10000 + ((u & 0x3FF) << 10) | (str.charCodeAt(++i) & 0x3FF);
    if (u <= 0x7F) {
      ++len;
    } else if (u <= 0x7FF) {
      len += 2;
    } else if (u <= 0xFFFF) {
      len += 3;
    } else if (u <= 0x1FFFFF) {
      len += 4;
    } else if (u <= 0x3FFFFFF) {
      len += 5;
    } else {
      len += 6;
    }
  }
  return len;
}

// Given a pointer 'ptr' to a null-terminated UTF16LE-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

var UTF16Decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-16le') : undefined;
function UTF16ToString(ptr) {
  assert(ptr % 2 == 0, 'Pointer passed to UTF16ToString must be aligned to two bytes!');
  var endPtr = ptr;
  // TextDecoder needs to know the byte length in advance, it doesn't stop on null terminator by itself.
  // Also, use the length info to avoid running tiny strings through TextDecoder, since .subarray() allocates garbage.
  var idx = endPtr >> 1;
  while (HEAP16[idx]) ++idx;
  endPtr = idx << 1;

  if (endPtr - ptr > 32 && UTF16Decoder) {
    return UTF16Decoder.decode(HEAPU8.subarray(ptr, endPtr));
  } else {
    var i = 0;

    var str = '';
    while (1) {
      var codeUnit = HEAP16[(((ptr)+(i*2))>>1)];
      if (codeUnit == 0) return str;
      ++i;
      // fromCharCode constructs a character from a UTF-16 code unit, so we can pass the UTF16 string right through.
      str += String.fromCharCode(codeUnit);
    }
  }
}

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF16 form. The copy will require at most str.length*4+2 bytes of space in the HEAP.
// Use the function lengthBytesUTF16() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outPtr: Byte address in Emscripten HEAP where to write the string to.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null
//                    terminator, i.e. if maxBytesToWrite=2, only the null terminator will be written and nothing else.
//                    maxBytesToWrite<2 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF16(str, outPtr, maxBytesToWrite) {
  assert(outPtr % 2 == 0, 'Pointer passed to stringToUTF16 must be aligned to two bytes!');
  assert(typeof maxBytesToWrite == 'number', 'stringToUTF16(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!');
  // Backwards compatibility: if max bytes is not specified, assume unsafe unbounded write is allowed.
  if (maxBytesToWrite === undefined) {
    maxBytesToWrite = 0x7FFFFFFF;
  }
  if (maxBytesToWrite < 2) return 0;
  maxBytesToWrite -= 2; // Null terminator.
  var startPtr = outPtr;
  var numCharsToWrite = (maxBytesToWrite < str.length*2) ? (maxBytesToWrite / 2) : str.length;
  for (var i = 0; i < numCharsToWrite; ++i) {
    // charCodeAt returns a UTF-16 encoded code unit, so it can be directly written to the HEAP.
    var codeUnit = str.charCodeAt(i); // possibly a lead surrogate
    HEAP16[((outPtr)>>1)]=codeUnit;
    outPtr += 2;
  }
  // Null-terminate the pointer to the HEAP.
  HEAP16[((outPtr)>>1)]=0;
  return outPtr - startPtr;
}

// Returns the number of bytes the given Javascript string takes if encoded as a UTF16 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF16(str) {
  return str.length*2;
}

function UTF32ToString(ptr) {
  assert(ptr % 4 == 0, 'Pointer passed to UTF32ToString must be aligned to four bytes!');
  var i = 0;

  var str = '';
  while (1) {
    var utf32 = HEAP32[(((ptr)+(i*4))>>2)];
    if (utf32 == 0)
      return str;
    ++i;
    // Gotcha: fromCharCode constructs a character from a UTF-16 encoded code (pair), not from a Unicode code point! So encode the code point to UTF-16 for constructing.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    if (utf32 >= 0x10000) {
      var ch = utf32 - 0x10000;
      str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
    } else {
      str += String.fromCharCode(utf32);
    }
  }
}

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF32 form. The copy will require at most str.length*4+4 bytes of space in the HEAP.
// Use the function lengthBytesUTF32() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outPtr: Byte address in Emscripten HEAP where to write the string to.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null
//                    terminator, i.e. if maxBytesToWrite=4, only the null terminator will be written and nothing else.
//                    maxBytesToWrite<4 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF32(str, outPtr, maxBytesToWrite) {
  assert(outPtr % 4 == 0, 'Pointer passed to stringToUTF32 must be aligned to four bytes!');
  assert(typeof maxBytesToWrite == 'number', 'stringToUTF32(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!');
  // Backwards compatibility: if max bytes is not specified, assume unsafe unbounded write is allowed.
  if (maxBytesToWrite === undefined) {
    maxBytesToWrite = 0x7FFFFFFF;
  }
  if (maxBytesToWrite < 4) return 0;
  var startPtr = outPtr;
  var endPtr = startPtr + maxBytesToWrite - 4;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! We must decode the string to UTF-32 to the heap.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var codeUnit = str.charCodeAt(i); // possibly a lead surrogate
    if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) {
      var trailSurrogate = str.charCodeAt(++i);
      codeUnit = 0x10000 + ((codeUnit & 0x3FF) << 10) | (trailSurrogate & 0x3FF);
    }
    HEAP32[((outPtr)>>2)]=codeUnit;
    outPtr += 4;
    if (outPtr + 4 > endPtr) break;
  }
  // Null-terminate the pointer to the HEAP.
  HEAP32[((outPtr)>>2)]=0;
  return outPtr - startPtr;
}

// Returns the number of bytes the given Javascript string takes if encoded as a UTF16 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF32(str) {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! We must decode the string to UTF-32 to the heap.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var codeUnit = str.charCodeAt(i);
    if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) ++i; // possibly a lead surrogate, so skip over the tail surrogate.
    len += 4;
  }

  return len;
}

// Allocate heap space for a JS string, and write it there.
// It is the responsibility of the caller to free() that memory.
function allocateUTF8(str) {
  var size = lengthBytesUTF8(str) + 1;
  var ret = _malloc(size);
  if (ret) stringToUTF8Array(str, HEAP8, ret, size);
  return ret;
}

// Allocate stack space for a JS string, and write it there.
function allocateUTF8OnStack(str) {
  var size = lengthBytesUTF8(str) + 1;
  var ret = stackAlloc(size);
  stringToUTF8Array(str, HEAP8, ret, size);
  return ret;
}

function demangle(func) {
  warnOnce('warning: build with  -s DEMANGLE_SUPPORT=1  to link in libcxxabi demangling');
  return func;
}

function demangleAll(text) {
  var regex =
    /__Z[\w\d_]+/g;
  return text.replace(regex,
    function(x) {
      var y = demangle(x);
      return x === y ? x : (y + ' [' + x + ']');
    });
}

function jsStackTrace() {
  var err = new Error();
  if (!err.stack) {
    // IE10+ special cases: It does have callstack info, but it is only populated if an Error object is thrown,
    // so try that as a special-case.
    try {
      throw new Error(0);
    } catch(e) {
      err = e;
    }
    if (!err.stack) {
      return '(no stack trace available)';
    }
  }
  return err.stack.toString();
}

function stackTrace() {
  var js = jsStackTrace();
  if (Module['extraStackTrace']) js += '\n' + Module['extraStackTrace']();
  return demangleAll(js);
}

// Memory management

var PAGE_SIZE = 16384;
var WASM_PAGE_SIZE = 65536;
var ASMJS_PAGE_SIZE = 16777216;
var MIN_TOTAL_MEMORY = 16777216;

function alignUp(x, multiple) {
  if (x % multiple > 0) {
    x += multiple - (x % multiple);
  }
  return x;
}

var HEAP,
/** @type {ArrayBuffer} */
  buffer,
/** @type {Int8Array} */
  HEAP8,
/** @type {Uint8Array} */
  HEAPU8,
/** @type {Int16Array} */
  HEAP16,
/** @type {Uint16Array} */
  HEAPU16,
/** @type {Int32Array} */
  HEAP32,
/** @type {Uint32Array} */
  HEAPU32,
/** @type {Float32Array} */
  HEAPF32,
/** @type {Float64Array} */
  HEAPF64;

function updateGlobalBuffer(buf) {
  Module['buffer'] = buffer = buf;
}

function updateGlobalBufferViews() {
  Module['HEAP8'] = HEAP8 = new Int8Array(buffer);
  Module['HEAP16'] = HEAP16 = new Int16Array(buffer);
  Module['HEAP32'] = HEAP32 = new Int32Array(buffer);
  Module['HEAPU8'] = HEAPU8 = new Uint8Array(buffer);
  Module['HEAPU16'] = HEAPU16 = new Uint16Array(buffer);
  Module['HEAPU32'] = HEAPU32 = new Uint32Array(buffer);
  Module['HEAPF32'] = HEAPF32 = new Float32Array(buffer);
  Module['HEAPF64'] = HEAPF64 = new Float64Array(buffer);
}

var STATIC_BASE, STATICTOP, staticSealed; // static area
var STACK_BASE, STACKTOP, STACK_MAX; // stack area
var DYNAMIC_BASE, DYNAMICTOP_PTR; // dynamic area handled by sbrk

  STATIC_BASE = STATICTOP = STACK_BASE = STACKTOP = STACK_MAX = DYNAMIC_BASE = DYNAMICTOP_PTR = 0;
  staticSealed = false;


// Initializes the stack cookie. Called at the startup of main and at the startup of each thread in pthreads mode.
function writeStackCookie() {
  assert((STACK_MAX & 3) == 0);
  HEAPU32[(STACK_MAX >> 2)-1] = 0x02135467;
  HEAPU32[(STACK_MAX >> 2)-2] = 0x89BACDFE;
}

function checkStackCookie() {
  if (HEAPU32[(STACK_MAX >> 2)-1] != 0x02135467 || HEAPU32[(STACK_MAX >> 2)-2] != 0x89BACDFE) {
    abort('Stack overflow! Stack cookie has been overwritten, expected hex dwords 0x89BACDFE and 0x02135467, but received 0x' + HEAPU32[(STACK_MAX >> 2)-2].toString(16) + ' ' + HEAPU32[(STACK_MAX >> 2)-1].toString(16));
  }
  // Also test the global address 0 for integrity. This check is not compatible with SAFE_SPLIT_MEMORY though, since that mode already tests all address 0 accesses on its own.
  if (HEAP32[0] !== 0x63736d65 /* 'emsc' */) throw 'Runtime error: The application has corrupted its heap memory area (address zero)!';
}

function abortStackOverflow(allocSize) {
  abort('Stack overflow! Attempted to allocate ' + allocSize + ' bytes on the stack, but stack has only ' + (STACK_MAX - stackSave() + allocSize) + ' bytes available!');
}


function abortOnCannotGrowMemory() {
  abort('Cannot enlarge memory arrays. Either (1) compile with  -s TOTAL_MEMORY=X  with X higher than the current value ' + TOTAL_MEMORY + ', (2) compile with  -s ALLOW_MEMORY_GROWTH=1  which allows increasing the size at runtime but prevents some optimizations, (3) set Module.TOTAL_MEMORY to a higher value before the program runs, or (4) if you want malloc to return NULL (0) instead of this abort, compile with  -s ABORTING_MALLOC=0 ');
}


function enlargeMemory() {
  abortOnCannotGrowMemory();
}


var TOTAL_STACK = Module['TOTAL_STACK'] || 5242880;
var TOTAL_MEMORY = Module['TOTAL_MEMORY'] || 16777216;
if (TOTAL_MEMORY < TOTAL_STACK) err('TOTAL_MEMORY should be larger than TOTAL_STACK, was ' + TOTAL_MEMORY + '! (TOTAL_STACK=' + TOTAL_STACK + ')');

// Initialize the runtime's memory
// check for full engine support (use string 'subarray' to avoid closure compiler confusion)
assert(typeof Int32Array !== 'undefined' && typeof Float64Array !== 'undefined' && Int32Array.prototype.subarray !== undefined && Int32Array.prototype.set !== undefined,
       'JS engine does not provide full typed array support');



// Use a provided buffer, if there is one, or else allocate a new one
if (Module['buffer']) {
  buffer = Module['buffer'];
  assert(buffer.byteLength === TOTAL_MEMORY, 'provided buffer should be ' + TOTAL_MEMORY + ' bytes, but it is ' + buffer.byteLength);
} else {
  // Use a WebAssembly memory where available
  {
    buffer = new ArrayBuffer(TOTAL_MEMORY);
  }
  assert(buffer.byteLength === TOTAL_MEMORY);
  Module['buffer'] = buffer;
}
updateGlobalBufferViews();


function getTotalMemory() {
  return TOTAL_MEMORY;
}

// Endianness check (note: assumes compiler arch was little-endian)
  HEAP32[0] = 0x63736d65; /* 'emsc' */
HEAP16[1] = 0x6373;
if (HEAPU8[2] !== 0x73 || HEAPU8[3] !== 0x63) throw 'Runtime error: expected the system to be little-endian!';

function callRuntimeCallbacks(callbacks) {
  while(callbacks.length > 0) {
    var callback = callbacks.shift();
    if (typeof callback == 'function') {
      callback();
      continue;
    }
    var func = callback.func;
    if (typeof func === 'number') {
      if (callback.arg === undefined) {
        Module['dynCall_v'](func);
      } else {
        Module['dynCall_vi'](func, callback.arg);
      }
    } else {
      func(callback.arg === undefined ? null : callback.arg);
    }
  }
}

var __ATPRERUN__  = []; // functions called before the runtime is initialized
var __ATINIT__    = []; // functions called during startup
var __ATMAIN__    = []; // functions called when main() is to be run
var __ATEXIT__    = []; // functions called during shutdown
var __ATPOSTRUN__ = []; // functions called after the main() is called

var runtimeInitialized = false;
var runtimeExited = false;


function preRun() {
  // compatibility - merge in anything from Module['preRun'] at this time
  if (Module['preRun']) {
    if (typeof Module['preRun'] == 'function') Module['preRun'] = [Module['preRun']];
    while (Module['preRun'].length) {
      addOnPreRun(Module['preRun'].shift());
    }
  }
  callRuntimeCallbacks(__ATPRERUN__);
}

function ensureInitRuntime() {
  checkStackCookie();
  if (runtimeInitialized) return;
  runtimeInitialized = true;
  callRuntimeCallbacks(__ATINIT__);
}

function preMain() {
  checkStackCookie();
  callRuntimeCallbacks(__ATMAIN__);
}

function exitRuntime() {
  checkStackCookie();
  callRuntimeCallbacks(__ATEXIT__);
  runtimeExited = true;
}

function postRun() {
  checkStackCookie();
  // compatibility - merge in anything from Module['postRun'] at this time
  if (Module['postRun']) {
    if (typeof Module['postRun'] == 'function') Module['postRun'] = [Module['postRun']];
    while (Module['postRun'].length) {
      addOnPostRun(Module['postRun'].shift());
    }
  }
  callRuntimeCallbacks(__ATPOSTRUN__);
}

function addOnPreRun(cb) {
  __ATPRERUN__.unshift(cb);
}

function addOnInit(cb) {
  __ATINIT__.unshift(cb);
}

function addOnPreMain(cb) {
  __ATMAIN__.unshift(cb);
}

function addOnExit(cb) {
  __ATEXIT__.unshift(cb);
}

function addOnPostRun(cb) {
  __ATPOSTRUN__.unshift(cb);
}

// Deprecated: This function should not be called because it is unsafe and does not provide
// a maximum length limit of how many bytes it is allowed to write. Prefer calling the
// function stringToUTF8Array() instead, which takes in a maximum length that can be used
// to be secure from out of bounds writes.
/** @deprecated */
function writeStringToMemory(string, buffer, dontAddNull) {
  warnOnce('writeStringToMemory is deprecated and should not be called! Use stringToUTF8() instead!');

  var /** @type {number} */ lastChar, /** @type {number} */ end;
  if (dontAddNull) {
    // stringToUTF8Array always appends null. If we don't want to do that, remember the
    // character that existed at the location where the null will be placed, and restore
    // that after the write (below).
    end = buffer + lengthBytesUTF8(string);
    lastChar = HEAP8[end];
  }
  stringToUTF8(string, buffer, Infinity);
  if (dontAddNull) HEAP8[end] = lastChar; // Restore the value under the null character.
}

function writeArrayToMemory(array, buffer) {
  assert(array.length >= 0, 'writeArrayToMemory array must have a length (should be an array or typed array)')
  HEAP8.set(array, buffer);
}

function writeAsciiToMemory(str, buffer, dontAddNull) {
  for (var i = 0; i < str.length; ++i) {
    assert(str.charCodeAt(i) === str.charCodeAt(i)&0xff);
    HEAP8[((buffer++)>>0)]=str.charCodeAt(i);
  }
  // Null-terminate the pointer to the HEAP.
  if (!dontAddNull) HEAP8[((buffer)>>0)]=0;
}

function unSign(value, bits, ignore) {
  if (value >= 0) {
    return value;
  }
  return bits <= 32 ? 2*Math.abs(1 << (bits-1)) + value // Need some trickery, since if bits == 32, we are right at the limit of the bits JS uses in bitshifts
                    : Math.pow(2, bits)         + value;
}
function reSign(value, bits, ignore) {
  if (value <= 0) {
    return value;
  }
  var half = bits <= 32 ? Math.abs(1 << (bits-1)) // abs is needed if bits == 32
                        : Math.pow(2, bits-1);
  if (value >= half && (bits <= 32 || value > half)) { // for huge values, we can hit the precision limit and always get true here. so don't do that
                                                       // but, in general there is no perfect solution here. With 64-bit ints, we get rounding and errors
                                                       // TODO: In i64 mode 1, resign the two parts separately and safely
    value = -2*half + value; // Cannot bitshift half, as it may be at the limit of the bits JS uses in bitshifts
  }
  return value;
}

assert(Math['imul'] && Math['fround'] && Math['clz32'] && Math['trunc'], 'this is a legacy browser, build with LEGACY_VM_SUPPORT');

var Math_abs = Math.abs;
var Math_cos = Math.cos;
var Math_sin = Math.sin;
var Math_tan = Math.tan;
var Math_acos = Math.acos;
var Math_asin = Math.asin;
var Math_atan = Math.atan;
var Math_atan2 = Math.atan2;
var Math_exp = Math.exp;
var Math_log = Math.log;
var Math_sqrt = Math.sqrt;
var Math_ceil = Math.ceil;
var Math_floor = Math.floor;
var Math_pow = Math.pow;
var Math_imul = Math.imul;
var Math_fround = Math.fround;
var Math_round = Math.round;
var Math_min = Math.min;
var Math_max = Math.max;
var Math_clz32 = Math.clz32;
var Math_trunc = Math.trunc;

// A counter of dependencies for calling run(). If we need to
// do asynchronous work before running, increment this and
// decrement it. Incrementing must happen in a place like
// Module.preRun (used by emcc to add file preloading).
// Note that you can add dependencies in preRun, even though
// it happens right before run - run will be postponed until
// the dependencies are met.
var runDependencies = 0;
var runDependencyWatcher = null;
var dependenciesFulfilled = null; // overridden to take different actions when all run dependencies are fulfilled
var runDependencyTracking = {};

function getUniqueRunDependency(id) {
  var orig = id;
  while (1) {
    if (!runDependencyTracking[id]) return id;
    id = orig + Math.random();
  }
  return id;
}

function addRunDependency(id) {
  runDependencies++;
  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }
  if (id) {
    assert(!runDependencyTracking[id]);
    runDependencyTracking[id] = 1;
    if (runDependencyWatcher === null && typeof setInterval !== 'undefined') {
      // Check for missing dependencies every few seconds
      runDependencyWatcher = setInterval(function() {
        if (ABORT) {
          clearInterval(runDependencyWatcher);
          runDependencyWatcher = null;
          return;
        }
        var shown = false;
        for (var dep in runDependencyTracking) {
          if (!shown) {
            shown = true;
            err('still waiting on run dependencies:');
          }
          err('dependency: ' + dep);
        }
        if (shown) {
          err('(end of list)');
        }
      }, 10000);
    }
  } else {
    err('warning: run dependency added without ID');
  }
}

function removeRunDependency(id) {
  runDependencies--;
  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }
  if (id) {
    assert(runDependencyTracking[id]);
    delete runDependencyTracking[id];
  } else {
    err('warning: run dependency removed without ID');
  }
  if (runDependencies == 0) {
    if (runDependencyWatcher !== null) {
      clearInterval(runDependencyWatcher);
      runDependencyWatcher = null;
    }
    if (dependenciesFulfilled) {
      var callback = dependenciesFulfilled;
      dependenciesFulfilled = null;
      callback(); // can add another dependenciesFulfilled
    }
  }
}

Module["preloadedImages"] = {}; // maps url to image data
Module["preloadedAudios"] = {}; // maps url to audio data



var memoryInitializer = null;



var /* show errors on likely calls to FS when it was not included */ FS = {
  error: function() {
    abort('Filesystem support (FS) was not included. The problem is that you are using files from JS, but files were not used from C/C++, so filesystem support was not auto-included. You can force-include filesystem support with  -s FORCE_FILESYSTEM=1');
  },
  init: function() { FS.error() },
  createDataFile: function() { FS.error() },
  createPreloadedFile: function() { FS.error() },
  createLazyFile: function() { FS.error() },
  open: function() { FS.error() },
  mkdev: function() { FS.error() },
  registerDevice: function() { FS.error() },
  analyzePath: function() { FS.error() },
  loadFilesFromDB: function() { FS.error() },

  ErrnoError: function ErrnoError() { FS.error() },
};
Module['FS_createDataFile'] = FS.createDataFile;
Module['FS_createPreloadedFile'] = FS.createPreloadedFile;



// Copyright 2017 The Emscripten Authors.  All rights reserved.
// Emscripten is available under two separate licenses, the MIT license and the
// University of Illinois/NCSA Open Source License.  Both these licenses can be
// found in the LICENSE file.

// Prefix of data URIs emitted by SINGLE_FILE and related options.
var dataURIPrefix = 'data:application/octet-stream;base64,';

// Indicates whether filename is a base64 data URI.
function isDataURI(filename) {
  return String.prototype.startsWith ?
      filename.startsWith(dataURIPrefix) :
      filename.indexOf(dataURIPrefix) === 0;
}





// === Body ===

var ASM_CONSTS = [];





STATIC_BASE = GLOBAL_BASE;

STATICTOP = STATIC_BASE + 1696;
/* global initializers */  __ATINIT__.push();


memoryInitializer = "data:application/octet-stream;base64,AAAAAAAAAAAFAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAAAAwAAAJgAAAAABAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAK/////wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEA==";





/* no memory initializer */
var tempDoublePtr = STATICTOP; STATICTOP += 16;

assert(tempDoublePtr % 8 == 0);

function copyTempFloat(ptr) { // functions, because inlining this code increases code size too much

  HEAP8[tempDoublePtr] = HEAP8[ptr];

  HEAP8[tempDoublePtr+1] = HEAP8[ptr+1];

  HEAP8[tempDoublePtr+2] = HEAP8[ptr+2];

  HEAP8[tempDoublePtr+3] = HEAP8[ptr+3];

}

function copyTempDouble(ptr) {

  HEAP8[tempDoublePtr] = HEAP8[ptr];

  HEAP8[tempDoublePtr+1] = HEAP8[ptr+1];

  HEAP8[tempDoublePtr+2] = HEAP8[ptr+2];

  HEAP8[tempDoublePtr+3] = HEAP8[ptr+3];

  HEAP8[tempDoublePtr+4] = HEAP8[ptr+4];

  HEAP8[tempDoublePtr+5] = HEAP8[ptr+5];

  HEAP8[tempDoublePtr+6] = HEAP8[ptr+6];

  HEAP8[tempDoublePtr+7] = HEAP8[ptr+7];

}

// {{PRE_LIBRARY}}


  function ___lock() {}

  
    

  
  var SYSCALLS={buffers:[null,[],[]],printChar:function (stream, curr) {
        var buffer = SYSCALLS.buffers[stream];
        assert(buffer);
        if (curr === 0 || curr === 10) {
          (stream === 1 ? out : err)(UTF8ArrayToString(buffer, 0));
          buffer.length = 0;
        } else {
          buffer.push(curr);
        }
      },varargs:0,get:function (varargs) {
        SYSCALLS.varargs += 4;
        var ret = HEAP32[(((SYSCALLS.varargs)-(4))>>2)];
        return ret;
      },getStr:function () {
        var ret = Pointer_stringify(SYSCALLS.get());
        return ret;
      },get64:function () {
        var low = SYSCALLS.get(), high = SYSCALLS.get();
        if (low >= 0) assert(high === 0);
        else assert(high === -1);
        return low;
      },getZero:function () {
        assert(SYSCALLS.get() === 0);
      }};function ___syscall140(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // llseek
      var stream = SYSCALLS.getStreamFromFD(), offset_high = SYSCALLS.get(), offset_low = SYSCALLS.get(), result = SYSCALLS.get(), whence = SYSCALLS.get();
      // NOTE: offset_high is unused - Emscripten's off_t is 32-bit
      var offset = offset_low;
      FS.llseek(stream, offset, whence);
      HEAP32[((result)>>2)]=stream.position;
      if (stream.getdents && offset === 0 && whence === 0) stream.getdents = null; // reset readdir state
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  
  function flush_NO_FILESYSTEM() {
      // flush anything remaining in the buffers during shutdown
      var fflush = Module["_fflush"];
      if (fflush) fflush(0);
      var buffers = SYSCALLS.buffers;
      if (buffers[1].length) SYSCALLS.printChar(1, 10);
      if (buffers[2].length) SYSCALLS.printChar(2, 10);
    }function ___syscall146(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // writev
      // hack to support printf in FILESYSTEM=0
      var stream = SYSCALLS.get(), iov = SYSCALLS.get(), iovcnt = SYSCALLS.get();
      var ret = 0;
      for (var i = 0; i < iovcnt; i++) {
        var ptr = HEAP32[(((iov)+(i*8))>>2)];
        var len = HEAP32[(((iov)+(i*8 + 4))>>2)];
        for (var j = 0; j < len; j++) {
          SYSCALLS.printChar(stream, HEAPU8[ptr+j]);
        }
        ret += len;
      }
      return ret;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___syscall54(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // ioctl
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___syscall6(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // close
      var stream = SYSCALLS.getStreamFromFD();
      FS.close(stream);
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___unlock() {}

   

   

   

   

   

  
  function _emscripten_memcpy_big(dest, src, num) {
      HEAPU8.set(HEAPU8.subarray(src, src+num), dest);
      return dest;
    } 

   

  
  function ___setErrNo(value) {
      if (Module['___errno_location']) HEAP32[((Module['___errno_location']())>>2)]=value;
      else err('failed to set errno from JS');
      return value;
    } 
DYNAMICTOP_PTR = staticAlloc(4);

STACK_BASE = STACKTOP = alignMemory(STATICTOP);

STACK_MAX = STACK_BASE + TOTAL_STACK;

DYNAMIC_BASE = alignMemory(STACK_MAX);

HEAP32[DYNAMICTOP_PTR>>2] = DYNAMIC_BASE;

staticSealed = true; // seal the static portion of memory

assert(DYNAMIC_BASE < TOTAL_MEMORY, "TOTAL_MEMORY not big enough for stack");

var ASSERTIONS = true;

// Copyright 2017 The Emscripten Authors.  All rights reserved.
// Emscripten is available under two separate licenses, the MIT license and the
// University of Illinois/NCSA Open Source License.  Both these licenses can be
// found in the LICENSE file.

/** @type {function(string, boolean=, number=)} */
function intArrayFromString(stringy, dontAddNull, length) {
  var len = length > 0 ? length : lengthBytesUTF8(stringy)+1;
  var u8array = new Array(len);
  var numBytesWritten = stringToUTF8Array(stringy, u8array, 0, u8array.length);
  if (dontAddNull) u8array.length = numBytesWritten;
  return u8array;
}

function intArrayToString(array) {
  var ret = [];
  for (var i = 0; i < array.length; i++) {
    var chr = array[i];
    if (chr > 0xFF) {
      if (ASSERTIONS) {
        assert(false, 'Character code ' + chr + ' (' + String.fromCharCode(chr) + ')  at offset ' + i + ' not in 0x00-0xFF.');
      }
      chr &= 0xFF;
    }
    ret.push(String.fromCharCode(chr));
  }
  return ret.join('');
}


// Copied from https://github.com/strophe/strophejs/blob/e06d027/src/polyfills.js#L149

// This code was written by Tyler Akins and has been placed in the
// public domain.  It would be nice if you left this header intact.
// Base64 code from Tyler Akins -- http://rumkin.com

/**
 * Decodes a base64 string.
 * @param {String} input The string to decode.
 */
var decodeBase64 = typeof atob === 'function' ? atob : function (input) {
  var keyStr = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

  var output = '';
  var chr1, chr2, chr3;
  var enc1, enc2, enc3, enc4;
  var i = 0;
  // remove all characters that are not A-Z, a-z, 0-9, +, /, or =
  input = input.replace(/[^A-Za-z0-9\+\/\=]/g, '');
  do {
    enc1 = keyStr.indexOf(input.charAt(i++));
    enc2 = keyStr.indexOf(input.charAt(i++));
    enc3 = keyStr.indexOf(input.charAt(i++));
    enc4 = keyStr.indexOf(input.charAt(i++));

    chr1 = (enc1 << 2) | (enc2 >> 4);
    chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
    chr3 = ((enc3 & 3) << 6) | enc4;

    output = output + String.fromCharCode(chr1);

    if (enc3 !== 64) {
      output = output + String.fromCharCode(chr2);
    }
    if (enc4 !== 64) {
      output = output + String.fromCharCode(chr3);
    }
  } while (i < input.length);
  return output;
};

// Converts a string of base64 into a byte array.
// Throws error on invalid input.
function intArrayFromBase64(s) {
  if (typeof ENVIRONMENT_IS_NODE === 'boolean' && ENVIRONMENT_IS_NODE) {
    var buf;
    try {
      buf = Buffer.from(s, 'base64');
    } catch (_) {
      buf = new Buffer(s, 'base64');
    }
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  }

  try {
    var decoded = decodeBase64(s);
    var bytes = new Uint8Array(decoded.length);
    for (var i = 0 ; i < decoded.length ; ++i) {
      bytes[i] = decoded.charCodeAt(i);
    }
    return bytes;
  } catch (_) {
    throw new Error('Converting base64 string to bytes failed.');
  }
}

// If filename is a base64 data URI, parses and returns data (Buffer on node,
// Uint8Array otherwise). If filename is not a base64 data URI, returns undefined.
function tryParseAsDataURI(filename) {
  if (!isDataURI(filename)) {
    return;
  }

  return intArrayFromBase64(filename.slice(dataURIPrefix.length));
}



function nullFunc_ii(x) { err("Invalid function pointer called with signature 'ii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  err("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_iiii(x) { err("Invalid function pointer called with signature 'iiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  err("Build with ASSERTIONS=2 for more info.");abort(x) }

function invoke_ii(index,a1) {
  var sp = stackSave();
  try {
    return Module["dynCall_ii"](index,a1);
  } catch(e) {
    stackRestore(sp);
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_iiii(index,a1,a2,a3) {
  var sp = stackSave();
  try {
    return Module["dynCall_iiii"](index,a1,a2,a3);
  } catch(e) {
    stackRestore(sp);
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

Module.asmGlobalArg = { "Math": Math, "Int8Array": Int8Array, "Int16Array": Int16Array, "Int32Array": Int32Array, "Uint8Array": Uint8Array, "Uint16Array": Uint16Array, "Uint32Array": Uint32Array, "Float32Array": Float32Array, "Float64Array": Float64Array, "NaN": NaN, "Infinity": Infinity };

Module.asmLibraryArg = { "abort": abort, "assert": assert, "enlargeMemory": enlargeMemory, "getTotalMemory": getTotalMemory, "abortOnCannotGrowMemory": abortOnCannotGrowMemory, "abortStackOverflow": abortStackOverflow, "nullFunc_ii": nullFunc_ii, "nullFunc_iiii": nullFunc_iiii, "invoke_ii": invoke_ii, "invoke_iiii": invoke_iiii, "___lock": ___lock, "___setErrNo": ___setErrNo, "___syscall140": ___syscall140, "___syscall146": ___syscall146, "___syscall54": ___syscall54, "___syscall6": ___syscall6, "___unlock": ___unlock, "_emscripten_memcpy_big": _emscripten_memcpy_big, "flush_NO_FILESYSTEM": flush_NO_FILESYSTEM, "DYNAMICTOP_PTR": DYNAMICTOP_PTR, "tempDoublePtr": tempDoublePtr, "STACKTOP": STACKTOP, "STACK_MAX": STACK_MAX };
// EMSCRIPTEN_START_ASM
var asm = (/** @suppress {uselessCode} */ function(global, env, buffer) {
'almost asm';


  var HEAP8 = new global.Int8Array(buffer);
  var HEAP16 = new global.Int16Array(buffer);
  var HEAP32 = new global.Int32Array(buffer);
  var HEAPU8 = new global.Uint8Array(buffer);
  var HEAPU16 = new global.Uint16Array(buffer);
  var HEAPU32 = new global.Uint32Array(buffer);
  var HEAPF32 = new global.Float32Array(buffer);
  var HEAPF64 = new global.Float64Array(buffer);

  var DYNAMICTOP_PTR=env.DYNAMICTOP_PTR|0;
  var tempDoublePtr=env.tempDoublePtr|0;
  var STACKTOP=env.STACKTOP|0;
  var STACK_MAX=env.STACK_MAX|0;

  var __THREW__ = 0;
  var threwValue = 0;
  var setjmpId = 0;
  var undef = 0;
  var nan = global.NaN, inf = global.Infinity;
  var tempInt = 0, tempBigInt = 0, tempBigIntS = 0, tempValue = 0, tempDouble = 0.0;
var tempRet0 = 0;

  var Math_floor=global.Math.floor;
  var Math_abs=global.Math.abs;
  var Math_sqrt=global.Math.sqrt;
  var Math_pow=global.Math.pow;
  var Math_cos=global.Math.cos;
  var Math_sin=global.Math.sin;
  var Math_tan=global.Math.tan;
  var Math_acos=global.Math.acos;
  var Math_asin=global.Math.asin;
  var Math_atan=global.Math.atan;
  var Math_atan2=global.Math.atan2;
  var Math_exp=global.Math.exp;
  var Math_log=global.Math.log;
  var Math_ceil=global.Math.ceil;
  var Math_imul=global.Math.imul;
  var Math_min=global.Math.min;
  var Math_max=global.Math.max;
  var Math_clz32=global.Math.clz32;
  var abort=env.abort;
  var assert=env.assert;
  var enlargeMemory=env.enlargeMemory;
  var getTotalMemory=env.getTotalMemory;
  var abortOnCannotGrowMemory=env.abortOnCannotGrowMemory;
  var abortStackOverflow=env.abortStackOverflow;
  var nullFunc_ii=env.nullFunc_ii;
  var nullFunc_iiii=env.nullFunc_iiii;
  var invoke_ii=env.invoke_ii;
  var invoke_iiii=env.invoke_iiii;
  var ___lock=env.___lock;
  var ___setErrNo=env.___setErrNo;
  var ___syscall140=env.___syscall140;
  var ___syscall146=env.___syscall146;
  var ___syscall54=env.___syscall54;
  var ___syscall6=env.___syscall6;
  var ___unlock=env.___unlock;
  var _emscripten_memcpy_big=env._emscripten_memcpy_big;
  var flush_NO_FILESYSTEM=env.flush_NO_FILESYSTEM;
  var tempFloat = 0.0;

// EMSCRIPTEN_START_FUNCS

function stackAlloc(size) {
  size = size|0;
  var ret = 0;
  ret = STACKTOP;
  STACKTOP = (STACKTOP + size)|0;
  STACKTOP = (STACKTOP + 15)&-16;
    if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(size|0);

  return ret|0;
}
function stackSave() {
  return STACKTOP|0;
}
function stackRestore(top) {
  top = top|0;
  STACKTOP = top;
}
function establishStackSpace(stackBase, stackMax) {
  stackBase = stackBase|0;
  stackMax = stackMax|0;
  STACKTOP = stackBase;
  STACK_MAX = stackMax;
}
function setThrew(threw, value) {
  threw = threw|0;
  value = value|0;
  if ((__THREW__|0) == 0) {
    __THREW__ = threw;
    threwValue = value;
  }
}

function setTempRet0(value) {
  value = value|0;
  tempRet0 = value;
}
function getTempRet0() {
  return tempRet0|0;
}

function _load_3($0) {
 $0 = $0|0;
 var $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0;
 var $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0;
 var $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $2 = sp;
 $1 = $0;
 $3 = $1;
 $4 = HEAP8[$3>>0]|0;
 $5 = $4&255;
 $6 = $2;
 $7 = $6;
 HEAP32[$7>>2] = $5;
 $8 = (($6) + 4)|0;
 $9 = $8;
 HEAP32[$9>>2] = 0;
 $10 = $1;
 $11 = ((($10)) + 1|0);
 $12 = HEAP8[$11>>0]|0;
 $13 = $12&255;
 $14 = (_bitshift64Shl(($13|0),0,8)|0);
 $15 = tempRet0;
 $16 = $2;
 $17 = $16;
 $18 = HEAP32[$17>>2]|0;
 $19 = (($16) + 4)|0;
 $20 = $19;
 $21 = HEAP32[$20>>2]|0;
 $22 = $18 | $14;
 $23 = $21 | $15;
 $24 = $2;
 $25 = $24;
 HEAP32[$25>>2] = $22;
 $26 = (($24) + 4)|0;
 $27 = $26;
 HEAP32[$27>>2] = $23;
 $28 = $1;
 $29 = ((($28)) + 2|0);
 $30 = HEAP8[$29>>0]|0;
 $31 = $30&255;
 $32 = (_bitshift64Shl(($31|0),0,16)|0);
 $33 = tempRet0;
 $34 = $2;
 $35 = $34;
 $36 = HEAP32[$35>>2]|0;
 $37 = (($34) + 4)|0;
 $38 = $37;
 $39 = HEAP32[$38>>2]|0;
 $40 = $36 | $32;
 $41 = $39 | $33;
 $42 = $2;
 $43 = $42;
 HEAP32[$43>>2] = $40;
 $44 = (($42) + 4)|0;
 $45 = $44;
 HEAP32[$45>>2] = $41;
 $46 = $2;
 $47 = $46;
 $48 = HEAP32[$47>>2]|0;
 $49 = (($46) + 4)|0;
 $50 = $49;
 $51 = HEAP32[$50>>2]|0;
 tempRet0 = ($51);
 STACKTOP = sp;return ($48|0);
}
function _load_4($0) {
 $0 = $0|0;
 var $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0;
 var $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0;
 var $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0;
 var $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $2 = sp;
 $1 = $0;
 $3 = $1;
 $4 = HEAP8[$3>>0]|0;
 $5 = $4&255;
 $6 = $2;
 $7 = $6;
 HEAP32[$7>>2] = $5;
 $8 = (($6) + 4)|0;
 $9 = $8;
 HEAP32[$9>>2] = 0;
 $10 = $1;
 $11 = ((($10)) + 1|0);
 $12 = HEAP8[$11>>0]|0;
 $13 = $12&255;
 $14 = (_bitshift64Shl(($13|0),0,8)|0);
 $15 = tempRet0;
 $16 = $2;
 $17 = $16;
 $18 = HEAP32[$17>>2]|0;
 $19 = (($16) + 4)|0;
 $20 = $19;
 $21 = HEAP32[$20>>2]|0;
 $22 = $18 | $14;
 $23 = $21 | $15;
 $24 = $2;
 $25 = $24;
 HEAP32[$25>>2] = $22;
 $26 = (($24) + 4)|0;
 $27 = $26;
 HEAP32[$27>>2] = $23;
 $28 = $1;
 $29 = ((($28)) + 2|0);
 $30 = HEAP8[$29>>0]|0;
 $31 = $30&255;
 $32 = (_bitshift64Shl(($31|0),0,16)|0);
 $33 = tempRet0;
 $34 = $2;
 $35 = $34;
 $36 = HEAP32[$35>>2]|0;
 $37 = (($34) + 4)|0;
 $38 = $37;
 $39 = HEAP32[$38>>2]|0;
 $40 = $36 | $32;
 $41 = $39 | $33;
 $42 = $2;
 $43 = $42;
 HEAP32[$43>>2] = $40;
 $44 = (($42) + 4)|0;
 $45 = $44;
 HEAP32[$45>>2] = $41;
 $46 = $1;
 $47 = ((($46)) + 3|0);
 $48 = HEAP8[$47>>0]|0;
 $49 = $48&255;
 $50 = (_bitshift64Shl(($49|0),0,24)|0);
 $51 = tempRet0;
 $52 = $2;
 $53 = $52;
 $54 = HEAP32[$53>>2]|0;
 $55 = (($52) + 4)|0;
 $56 = $55;
 $57 = HEAP32[$56>>2]|0;
 $58 = $54 | $50;
 $59 = $57 | $51;
 $60 = $2;
 $61 = $60;
 HEAP32[$61>>2] = $58;
 $62 = (($60) + 4)|0;
 $63 = $62;
 HEAP32[$63>>2] = $59;
 $64 = $2;
 $65 = $64;
 $66 = HEAP32[$65>>2]|0;
 $67 = (($64) + 4)|0;
 $68 = $67;
 $69 = HEAP32[$68>>2]|0;
 tempRet0 = ($69);
 STACKTOP = sp;return ($66|0);
}
function _sc_reduce32($0) {
 $0 = $0|0;
 var $1 = 0, $10 = 0, $100 = 0, $1000 = 0, $1001 = 0, $1002 = 0, $1003 = 0, $1004 = 0, $1005 = 0, $1006 = 0, $1007 = 0, $1008 = 0, $1009 = 0, $101 = 0, $1010 = 0, $1011 = 0, $1012 = 0, $1013 = 0, $1014 = 0, $1015 = 0;
 var $1016 = 0, $1017 = 0, $1018 = 0, $1019 = 0, $102 = 0, $1020 = 0, $1021 = 0, $1022 = 0, $1023 = 0, $1024 = 0, $1025 = 0, $1026 = 0, $1027 = 0, $1028 = 0, $1029 = 0, $103 = 0, $1030 = 0, $1031 = 0, $1032 = 0, $1033 = 0;
 var $1034 = 0, $1035 = 0, $1036 = 0, $1037 = 0, $1038 = 0, $1039 = 0, $104 = 0, $1040 = 0, $1041 = 0, $1042 = 0, $1043 = 0, $1044 = 0, $1045 = 0, $1046 = 0, $1047 = 0, $1048 = 0, $1049 = 0, $105 = 0, $1050 = 0, $1051 = 0;
 var $1052 = 0, $1053 = 0, $1054 = 0, $1055 = 0, $1056 = 0, $1057 = 0, $1058 = 0, $1059 = 0, $106 = 0, $1060 = 0, $1061 = 0, $1062 = 0, $1063 = 0, $1064 = 0, $1065 = 0, $1066 = 0, $1067 = 0, $1068 = 0, $1069 = 0, $107 = 0;
 var $1070 = 0, $1071 = 0, $1072 = 0, $1073 = 0, $1074 = 0, $1075 = 0, $1076 = 0, $1077 = 0, $1078 = 0, $1079 = 0, $108 = 0, $1080 = 0, $1081 = 0, $1082 = 0, $1083 = 0, $1084 = 0, $1085 = 0, $1086 = 0, $1087 = 0, $1088 = 0;
 var $1089 = 0, $109 = 0, $1090 = 0, $1091 = 0, $1092 = 0, $1093 = 0, $1094 = 0, $1095 = 0, $1096 = 0, $1097 = 0, $1098 = 0, $1099 = 0, $11 = 0, $110 = 0, $1100 = 0, $1101 = 0, $1102 = 0, $1103 = 0, $1104 = 0, $1105 = 0;
 var $1106 = 0, $1107 = 0, $1108 = 0, $1109 = 0, $111 = 0, $1110 = 0, $1111 = 0, $1112 = 0, $1113 = 0, $1114 = 0, $1115 = 0, $1116 = 0, $1117 = 0, $1118 = 0, $1119 = 0, $112 = 0, $1120 = 0, $1121 = 0, $1122 = 0, $1123 = 0;
 var $1124 = 0, $1125 = 0, $1126 = 0, $1127 = 0, $1128 = 0, $1129 = 0, $113 = 0, $1130 = 0, $1131 = 0, $1132 = 0, $1133 = 0, $1134 = 0, $1135 = 0, $1136 = 0, $1137 = 0, $1138 = 0, $1139 = 0, $114 = 0, $1140 = 0, $1141 = 0;
 var $1142 = 0, $1143 = 0, $1144 = 0, $1145 = 0, $1146 = 0, $1147 = 0, $1148 = 0, $1149 = 0, $115 = 0, $1150 = 0, $1151 = 0, $1152 = 0, $1153 = 0, $1154 = 0, $1155 = 0, $1156 = 0, $1157 = 0, $1158 = 0, $1159 = 0, $116 = 0;
 var $1160 = 0, $1161 = 0, $1162 = 0, $1163 = 0, $1164 = 0, $1165 = 0, $1166 = 0, $1167 = 0, $1168 = 0, $1169 = 0, $117 = 0, $1170 = 0, $1171 = 0, $1172 = 0, $1173 = 0, $1174 = 0, $1175 = 0, $1176 = 0, $1177 = 0, $1178 = 0;
 var $1179 = 0, $118 = 0, $1180 = 0, $1181 = 0, $1182 = 0, $1183 = 0, $1184 = 0, $1185 = 0, $1186 = 0, $1187 = 0, $1188 = 0, $1189 = 0, $119 = 0, $1190 = 0, $1191 = 0, $1192 = 0, $1193 = 0, $1194 = 0, $1195 = 0, $1196 = 0;
 var $1197 = 0, $1198 = 0, $1199 = 0, $12 = 0, $120 = 0, $1200 = 0, $1201 = 0, $1202 = 0, $1203 = 0, $1204 = 0, $1205 = 0, $1206 = 0, $1207 = 0, $1208 = 0, $1209 = 0, $121 = 0, $1210 = 0, $1211 = 0, $1212 = 0, $1213 = 0;
 var $1214 = 0, $1215 = 0, $1216 = 0, $1217 = 0, $1218 = 0, $1219 = 0, $122 = 0, $1220 = 0, $1221 = 0, $1222 = 0, $1223 = 0, $1224 = 0, $1225 = 0, $1226 = 0, $1227 = 0, $1228 = 0, $1229 = 0, $123 = 0, $1230 = 0, $1231 = 0;
 var $1232 = 0, $1233 = 0, $1234 = 0, $1235 = 0, $1236 = 0, $1237 = 0, $1238 = 0, $1239 = 0, $124 = 0, $1240 = 0, $1241 = 0, $1242 = 0, $1243 = 0, $1244 = 0, $1245 = 0, $1246 = 0, $1247 = 0, $1248 = 0, $1249 = 0, $125 = 0;
 var $1250 = 0, $1251 = 0, $1252 = 0, $1253 = 0, $1254 = 0, $1255 = 0, $1256 = 0, $1257 = 0, $1258 = 0, $1259 = 0, $126 = 0, $1260 = 0, $1261 = 0, $1262 = 0, $1263 = 0, $1264 = 0, $1265 = 0, $1266 = 0, $1267 = 0, $1268 = 0;
 var $1269 = 0, $127 = 0, $1270 = 0, $1271 = 0, $1272 = 0, $1273 = 0, $1274 = 0, $1275 = 0, $1276 = 0, $1277 = 0, $1278 = 0, $1279 = 0, $128 = 0, $1280 = 0, $1281 = 0, $1282 = 0, $1283 = 0, $1284 = 0, $1285 = 0, $1286 = 0;
 var $1287 = 0, $1288 = 0, $1289 = 0, $129 = 0, $1290 = 0, $1291 = 0, $1292 = 0, $1293 = 0, $1294 = 0, $1295 = 0, $1296 = 0, $1297 = 0, $1298 = 0, $1299 = 0, $13 = 0, $130 = 0, $1300 = 0, $1301 = 0, $1302 = 0, $1303 = 0;
 var $1304 = 0, $1305 = 0, $1306 = 0, $1307 = 0, $1308 = 0, $1309 = 0, $131 = 0, $1310 = 0, $1311 = 0, $1312 = 0, $1313 = 0, $1314 = 0, $1315 = 0, $1316 = 0, $1317 = 0, $1318 = 0, $1319 = 0, $132 = 0, $1320 = 0, $1321 = 0;
 var $1322 = 0, $1323 = 0, $1324 = 0, $1325 = 0, $1326 = 0, $1327 = 0, $1328 = 0, $1329 = 0, $133 = 0, $1330 = 0, $1331 = 0, $1332 = 0, $1333 = 0, $1334 = 0, $1335 = 0, $1336 = 0, $1337 = 0, $1338 = 0, $1339 = 0, $134 = 0;
 var $1340 = 0, $1341 = 0, $1342 = 0, $1343 = 0, $1344 = 0, $1345 = 0, $1346 = 0, $1347 = 0, $1348 = 0, $1349 = 0, $135 = 0, $1350 = 0, $1351 = 0, $1352 = 0, $1353 = 0, $1354 = 0, $1355 = 0, $1356 = 0, $1357 = 0, $1358 = 0;
 var $1359 = 0, $136 = 0, $1360 = 0, $1361 = 0, $1362 = 0, $1363 = 0, $1364 = 0, $1365 = 0, $1366 = 0, $1367 = 0, $1368 = 0, $1369 = 0, $137 = 0, $1370 = 0, $1371 = 0, $1372 = 0, $1373 = 0, $1374 = 0, $1375 = 0, $1376 = 0;
 var $1377 = 0, $1378 = 0, $1379 = 0, $138 = 0, $1380 = 0, $1381 = 0, $1382 = 0, $1383 = 0, $1384 = 0, $1385 = 0, $1386 = 0, $1387 = 0, $1388 = 0, $1389 = 0, $139 = 0, $1390 = 0, $1391 = 0, $1392 = 0, $1393 = 0, $1394 = 0;
 var $1395 = 0, $1396 = 0, $1397 = 0, $1398 = 0, $1399 = 0, $14 = 0, $140 = 0, $1400 = 0, $1401 = 0, $1402 = 0, $1403 = 0, $1404 = 0, $1405 = 0, $1406 = 0, $1407 = 0, $1408 = 0, $1409 = 0, $141 = 0, $1410 = 0, $1411 = 0;
 var $1412 = 0, $1413 = 0, $1414 = 0, $1415 = 0, $1416 = 0, $1417 = 0, $1418 = 0, $1419 = 0, $142 = 0, $1420 = 0, $1421 = 0, $1422 = 0, $1423 = 0, $1424 = 0, $1425 = 0, $1426 = 0, $1427 = 0, $1428 = 0, $1429 = 0, $143 = 0;
 var $1430 = 0, $1431 = 0, $1432 = 0, $1433 = 0, $1434 = 0, $1435 = 0, $1436 = 0, $1437 = 0, $1438 = 0, $1439 = 0, $144 = 0, $1440 = 0, $1441 = 0, $1442 = 0, $1443 = 0, $1444 = 0, $1445 = 0, $1446 = 0, $1447 = 0, $1448 = 0;
 var $1449 = 0, $145 = 0, $1450 = 0, $1451 = 0, $1452 = 0, $1453 = 0, $1454 = 0, $1455 = 0, $1456 = 0, $1457 = 0, $1458 = 0, $1459 = 0, $146 = 0, $1460 = 0, $1461 = 0, $1462 = 0, $1463 = 0, $1464 = 0, $1465 = 0, $1466 = 0;
 var $1467 = 0, $1468 = 0, $1469 = 0, $147 = 0, $1470 = 0, $1471 = 0, $1472 = 0, $1473 = 0, $1474 = 0, $1475 = 0, $1476 = 0, $1477 = 0, $1478 = 0, $1479 = 0, $148 = 0, $1480 = 0, $1481 = 0, $1482 = 0, $1483 = 0, $1484 = 0;
 var $1485 = 0, $1486 = 0, $1487 = 0, $1488 = 0, $1489 = 0, $149 = 0, $1490 = 0, $1491 = 0, $1492 = 0, $1493 = 0, $1494 = 0, $1495 = 0, $1496 = 0, $1497 = 0, $1498 = 0, $1499 = 0, $15 = 0, $150 = 0, $1500 = 0, $1501 = 0;
 var $1502 = 0, $1503 = 0, $1504 = 0, $1505 = 0, $1506 = 0, $1507 = 0, $1508 = 0, $1509 = 0, $151 = 0, $1510 = 0, $1511 = 0, $1512 = 0, $1513 = 0, $1514 = 0, $1515 = 0, $1516 = 0, $1517 = 0, $1518 = 0, $1519 = 0, $152 = 0;
 var $1520 = 0, $1521 = 0, $1522 = 0, $1523 = 0, $1524 = 0, $1525 = 0, $1526 = 0, $1527 = 0, $1528 = 0, $1529 = 0, $153 = 0, $1530 = 0, $1531 = 0, $1532 = 0, $1533 = 0, $1534 = 0, $1535 = 0, $1536 = 0, $1537 = 0, $1538 = 0;
 var $1539 = 0, $154 = 0, $1540 = 0, $1541 = 0, $1542 = 0, $1543 = 0, $1544 = 0, $1545 = 0, $1546 = 0, $1547 = 0, $1548 = 0, $1549 = 0, $155 = 0, $1550 = 0, $1551 = 0, $1552 = 0, $1553 = 0, $1554 = 0, $1555 = 0, $1556 = 0;
 var $1557 = 0, $1558 = 0, $1559 = 0, $156 = 0, $1560 = 0, $1561 = 0, $1562 = 0, $1563 = 0, $1564 = 0, $1565 = 0, $1566 = 0, $1567 = 0, $1568 = 0, $1569 = 0, $157 = 0, $1570 = 0, $1571 = 0, $1572 = 0, $1573 = 0, $1574 = 0;
 var $1575 = 0, $1576 = 0, $1577 = 0, $1578 = 0, $1579 = 0, $158 = 0, $1580 = 0, $1581 = 0, $1582 = 0, $1583 = 0, $1584 = 0, $1585 = 0, $1586 = 0, $1587 = 0, $1588 = 0, $1589 = 0, $159 = 0, $1590 = 0, $1591 = 0, $1592 = 0;
 var $1593 = 0, $1594 = 0, $1595 = 0, $1596 = 0, $1597 = 0, $1598 = 0, $1599 = 0, $16 = 0, $160 = 0, $1600 = 0, $1601 = 0, $1602 = 0, $1603 = 0, $1604 = 0, $1605 = 0, $1606 = 0, $1607 = 0, $1608 = 0, $1609 = 0, $161 = 0;
 var $1610 = 0, $1611 = 0, $1612 = 0, $1613 = 0, $1614 = 0, $1615 = 0, $1616 = 0, $1617 = 0, $1618 = 0, $1619 = 0, $162 = 0, $1620 = 0, $1621 = 0, $1622 = 0, $1623 = 0, $1624 = 0, $1625 = 0, $1626 = 0, $1627 = 0, $1628 = 0;
 var $1629 = 0, $163 = 0, $1630 = 0, $1631 = 0, $1632 = 0, $1633 = 0, $1634 = 0, $1635 = 0, $1636 = 0, $1637 = 0, $1638 = 0, $1639 = 0, $164 = 0, $1640 = 0, $1641 = 0, $1642 = 0, $1643 = 0, $1644 = 0, $1645 = 0, $1646 = 0;
 var $1647 = 0, $1648 = 0, $1649 = 0, $165 = 0, $1650 = 0, $1651 = 0, $1652 = 0, $1653 = 0, $1654 = 0, $1655 = 0, $1656 = 0, $1657 = 0, $1658 = 0, $1659 = 0, $166 = 0, $1660 = 0, $1661 = 0, $1662 = 0, $1663 = 0, $1664 = 0;
 var $1665 = 0, $1666 = 0, $1667 = 0, $1668 = 0, $1669 = 0, $167 = 0, $1670 = 0, $1671 = 0, $1672 = 0, $1673 = 0, $1674 = 0, $1675 = 0, $1676 = 0, $1677 = 0, $1678 = 0, $1679 = 0, $168 = 0, $1680 = 0, $1681 = 0, $1682 = 0;
 var $1683 = 0, $1684 = 0, $1685 = 0, $1686 = 0, $1687 = 0, $1688 = 0, $1689 = 0, $169 = 0, $1690 = 0, $1691 = 0, $1692 = 0, $1693 = 0, $1694 = 0, $1695 = 0, $1696 = 0, $1697 = 0, $1698 = 0, $1699 = 0, $17 = 0, $170 = 0;
 var $1700 = 0, $1701 = 0, $1702 = 0, $1703 = 0, $1704 = 0, $1705 = 0, $1706 = 0, $1707 = 0, $1708 = 0, $1709 = 0, $171 = 0, $1710 = 0, $1711 = 0, $1712 = 0, $1713 = 0, $1714 = 0, $1715 = 0, $1716 = 0, $1717 = 0, $1718 = 0;
 var $1719 = 0, $172 = 0, $1720 = 0, $1721 = 0, $1722 = 0, $1723 = 0, $1724 = 0, $1725 = 0, $1726 = 0, $1727 = 0, $1728 = 0, $1729 = 0, $173 = 0, $1730 = 0, $1731 = 0, $1732 = 0, $1733 = 0, $1734 = 0, $1735 = 0, $1736 = 0;
 var $1737 = 0, $1738 = 0, $1739 = 0, $174 = 0, $1740 = 0, $1741 = 0, $1742 = 0, $1743 = 0, $1744 = 0, $1745 = 0, $1746 = 0, $1747 = 0, $1748 = 0, $1749 = 0, $175 = 0, $1750 = 0, $1751 = 0, $1752 = 0, $1753 = 0, $1754 = 0;
 var $1755 = 0, $1756 = 0, $1757 = 0, $1758 = 0, $1759 = 0, $176 = 0, $1760 = 0, $1761 = 0, $1762 = 0, $1763 = 0, $1764 = 0, $1765 = 0, $1766 = 0, $1767 = 0, $1768 = 0, $1769 = 0, $177 = 0, $1770 = 0, $1771 = 0, $1772 = 0;
 var $1773 = 0, $1774 = 0, $1775 = 0, $1776 = 0, $1777 = 0, $1778 = 0, $1779 = 0, $178 = 0, $1780 = 0, $1781 = 0, $1782 = 0, $1783 = 0, $1784 = 0, $1785 = 0, $1786 = 0, $1787 = 0, $1788 = 0, $1789 = 0, $179 = 0, $1790 = 0;
 var $1791 = 0, $1792 = 0, $1793 = 0, $1794 = 0, $1795 = 0, $1796 = 0, $1797 = 0, $1798 = 0, $1799 = 0, $18 = 0, $180 = 0, $1800 = 0, $1801 = 0, $1802 = 0, $1803 = 0, $1804 = 0, $1805 = 0, $1806 = 0, $1807 = 0, $1808 = 0;
 var $1809 = 0, $181 = 0, $1810 = 0, $1811 = 0, $1812 = 0, $1813 = 0, $1814 = 0, $1815 = 0, $1816 = 0, $1817 = 0, $1818 = 0, $1819 = 0, $182 = 0, $1820 = 0, $1821 = 0, $1822 = 0, $1823 = 0, $1824 = 0, $1825 = 0, $1826 = 0;
 var $1827 = 0, $1828 = 0, $1829 = 0, $183 = 0, $1830 = 0, $1831 = 0, $1832 = 0, $1833 = 0, $1834 = 0, $1835 = 0, $1836 = 0, $1837 = 0, $1838 = 0, $1839 = 0, $184 = 0, $1840 = 0, $1841 = 0, $1842 = 0, $1843 = 0, $1844 = 0;
 var $1845 = 0, $1846 = 0, $1847 = 0, $1848 = 0, $1849 = 0, $185 = 0, $1850 = 0, $1851 = 0, $1852 = 0, $1853 = 0, $1854 = 0, $1855 = 0, $1856 = 0, $1857 = 0, $1858 = 0, $1859 = 0, $186 = 0, $1860 = 0, $1861 = 0, $1862 = 0;
 var $1863 = 0, $1864 = 0, $1865 = 0, $1866 = 0, $1867 = 0, $1868 = 0, $1869 = 0, $187 = 0, $1870 = 0, $1871 = 0, $1872 = 0, $1873 = 0, $1874 = 0, $1875 = 0, $1876 = 0, $1877 = 0, $1878 = 0, $1879 = 0, $188 = 0, $1880 = 0;
 var $1881 = 0, $1882 = 0, $1883 = 0, $1884 = 0, $1885 = 0, $1886 = 0, $1887 = 0, $1888 = 0, $1889 = 0, $189 = 0, $1890 = 0, $1891 = 0, $1892 = 0, $1893 = 0, $1894 = 0, $1895 = 0, $1896 = 0, $1897 = 0, $1898 = 0, $1899 = 0;
 var $19 = 0, $190 = 0, $1900 = 0, $1901 = 0, $1902 = 0, $1903 = 0, $1904 = 0, $1905 = 0, $1906 = 0, $1907 = 0, $1908 = 0, $1909 = 0, $191 = 0, $1910 = 0, $1911 = 0, $1912 = 0, $1913 = 0, $1914 = 0, $1915 = 0, $1916 = 0;
 var $1917 = 0, $1918 = 0, $1919 = 0, $192 = 0, $1920 = 0, $1921 = 0, $1922 = 0, $1923 = 0, $1924 = 0, $1925 = 0, $1926 = 0, $1927 = 0, $1928 = 0, $1929 = 0, $193 = 0, $1930 = 0, $1931 = 0, $1932 = 0, $1933 = 0, $1934 = 0;
 var $1935 = 0, $1936 = 0, $1937 = 0, $1938 = 0, $1939 = 0, $194 = 0, $1940 = 0, $1941 = 0, $1942 = 0, $1943 = 0, $1944 = 0, $1945 = 0, $1946 = 0, $1947 = 0, $1948 = 0, $1949 = 0, $195 = 0, $1950 = 0, $1951 = 0, $1952 = 0;
 var $1953 = 0, $1954 = 0, $1955 = 0, $1956 = 0, $1957 = 0, $1958 = 0, $1959 = 0, $196 = 0, $1960 = 0, $1961 = 0, $1962 = 0, $1963 = 0, $1964 = 0, $1965 = 0, $1966 = 0, $1967 = 0, $1968 = 0, $1969 = 0, $197 = 0, $1970 = 0;
 var $1971 = 0, $1972 = 0, $1973 = 0, $1974 = 0, $1975 = 0, $1976 = 0, $1977 = 0, $1978 = 0, $1979 = 0, $198 = 0, $1980 = 0, $1981 = 0, $1982 = 0, $1983 = 0, $1984 = 0, $1985 = 0, $1986 = 0, $1987 = 0, $1988 = 0, $1989 = 0;
 var $199 = 0, $1990 = 0, $1991 = 0, $1992 = 0, $1993 = 0, $1994 = 0, $1995 = 0, $1996 = 0, $1997 = 0, $1998 = 0, $1999 = 0, $2 = 0, $20 = 0, $200 = 0, $2000 = 0, $2001 = 0, $2002 = 0, $2003 = 0, $2004 = 0, $2005 = 0;
 var $2006 = 0, $2007 = 0, $2008 = 0, $2009 = 0, $201 = 0, $2010 = 0, $2011 = 0, $2012 = 0, $2013 = 0, $2014 = 0, $2015 = 0, $2016 = 0, $2017 = 0, $2018 = 0, $2019 = 0, $202 = 0, $2020 = 0, $2021 = 0, $2022 = 0, $2023 = 0;
 var $2024 = 0, $2025 = 0, $2026 = 0, $2027 = 0, $2028 = 0, $2029 = 0, $203 = 0, $2030 = 0, $2031 = 0, $2032 = 0, $2033 = 0, $2034 = 0, $2035 = 0, $2036 = 0, $2037 = 0, $2038 = 0, $2039 = 0, $204 = 0, $2040 = 0, $2041 = 0;
 var $2042 = 0, $2043 = 0, $2044 = 0, $2045 = 0, $2046 = 0, $2047 = 0, $2048 = 0, $2049 = 0, $205 = 0, $2050 = 0, $2051 = 0, $2052 = 0, $2053 = 0, $2054 = 0, $2055 = 0, $2056 = 0, $2057 = 0, $2058 = 0, $2059 = 0, $206 = 0;
 var $2060 = 0, $2061 = 0, $2062 = 0, $2063 = 0, $2064 = 0, $2065 = 0, $2066 = 0, $2067 = 0, $2068 = 0, $2069 = 0, $207 = 0, $2070 = 0, $2071 = 0, $2072 = 0, $2073 = 0, $2074 = 0, $2075 = 0, $2076 = 0, $2077 = 0, $2078 = 0;
 var $2079 = 0, $208 = 0, $2080 = 0, $2081 = 0, $2082 = 0, $2083 = 0, $2084 = 0, $2085 = 0, $2086 = 0, $2087 = 0, $2088 = 0, $2089 = 0, $209 = 0, $2090 = 0, $2091 = 0, $2092 = 0, $2093 = 0, $2094 = 0, $2095 = 0, $2096 = 0;
 var $2097 = 0, $2098 = 0, $2099 = 0, $21 = 0, $210 = 0, $2100 = 0, $2101 = 0, $2102 = 0, $2103 = 0, $2104 = 0, $2105 = 0, $2106 = 0, $2107 = 0, $2108 = 0, $2109 = 0, $211 = 0, $2110 = 0, $2111 = 0, $2112 = 0, $2113 = 0;
 var $2114 = 0, $2115 = 0, $2116 = 0, $2117 = 0, $2118 = 0, $2119 = 0, $212 = 0, $2120 = 0, $2121 = 0, $2122 = 0, $2123 = 0, $2124 = 0, $2125 = 0, $2126 = 0, $2127 = 0, $2128 = 0, $2129 = 0, $213 = 0, $2130 = 0, $2131 = 0;
 var $2132 = 0, $2133 = 0, $2134 = 0, $2135 = 0, $2136 = 0, $2137 = 0, $2138 = 0, $2139 = 0, $214 = 0, $2140 = 0, $2141 = 0, $2142 = 0, $2143 = 0, $2144 = 0, $2145 = 0, $2146 = 0, $2147 = 0, $2148 = 0, $2149 = 0, $215 = 0;
 var $2150 = 0, $2151 = 0, $2152 = 0, $2153 = 0, $2154 = 0, $2155 = 0, $2156 = 0, $2157 = 0, $2158 = 0, $2159 = 0, $216 = 0, $2160 = 0, $2161 = 0, $2162 = 0, $2163 = 0, $2164 = 0, $2165 = 0, $2166 = 0, $2167 = 0, $2168 = 0;
 var $2169 = 0, $217 = 0, $2170 = 0, $2171 = 0, $2172 = 0, $2173 = 0, $2174 = 0, $2175 = 0, $2176 = 0, $2177 = 0, $2178 = 0, $2179 = 0, $218 = 0, $2180 = 0, $2181 = 0, $2182 = 0, $2183 = 0, $2184 = 0, $2185 = 0, $2186 = 0;
 var $2187 = 0, $2188 = 0, $2189 = 0, $219 = 0, $2190 = 0, $2191 = 0, $2192 = 0, $2193 = 0, $2194 = 0, $2195 = 0, $2196 = 0, $2197 = 0, $2198 = 0, $2199 = 0, $22 = 0, $220 = 0, $2200 = 0, $2201 = 0, $2202 = 0, $2203 = 0;
 var $2204 = 0, $2205 = 0, $2206 = 0, $2207 = 0, $2208 = 0, $2209 = 0, $221 = 0, $2210 = 0, $2211 = 0, $2212 = 0, $2213 = 0, $2214 = 0, $2215 = 0, $2216 = 0, $2217 = 0, $2218 = 0, $2219 = 0, $222 = 0, $2220 = 0, $2221 = 0;
 var $2222 = 0, $2223 = 0, $2224 = 0, $2225 = 0, $2226 = 0, $2227 = 0, $2228 = 0, $2229 = 0, $223 = 0, $2230 = 0, $2231 = 0, $2232 = 0, $2233 = 0, $2234 = 0, $2235 = 0, $2236 = 0, $2237 = 0, $2238 = 0, $2239 = 0, $224 = 0;
 var $2240 = 0, $2241 = 0, $2242 = 0, $2243 = 0, $2244 = 0, $2245 = 0, $2246 = 0, $2247 = 0, $2248 = 0, $2249 = 0, $225 = 0, $2250 = 0, $2251 = 0, $2252 = 0, $2253 = 0, $2254 = 0, $2255 = 0, $2256 = 0, $2257 = 0, $2258 = 0;
 var $2259 = 0, $226 = 0, $2260 = 0, $2261 = 0, $2262 = 0, $2263 = 0, $2264 = 0, $2265 = 0, $2266 = 0, $2267 = 0, $2268 = 0, $2269 = 0, $227 = 0, $2270 = 0, $2271 = 0, $2272 = 0, $2273 = 0, $2274 = 0, $2275 = 0, $2276 = 0;
 var $2277 = 0, $2278 = 0, $2279 = 0, $228 = 0, $2280 = 0, $2281 = 0, $2282 = 0, $2283 = 0, $2284 = 0, $2285 = 0, $2286 = 0, $2287 = 0, $2288 = 0, $2289 = 0, $229 = 0, $2290 = 0, $2291 = 0, $2292 = 0, $2293 = 0, $2294 = 0;
 var $2295 = 0, $2296 = 0, $2297 = 0, $2298 = 0, $2299 = 0, $23 = 0, $230 = 0, $2300 = 0, $2301 = 0, $2302 = 0, $2303 = 0, $2304 = 0, $2305 = 0, $2306 = 0, $2307 = 0, $2308 = 0, $2309 = 0, $231 = 0, $2310 = 0, $2311 = 0;
 var $2312 = 0, $2313 = 0, $2314 = 0, $2315 = 0, $2316 = 0, $2317 = 0, $2318 = 0, $2319 = 0, $232 = 0, $2320 = 0, $2321 = 0, $2322 = 0, $2323 = 0, $2324 = 0, $2325 = 0, $2326 = 0, $2327 = 0, $2328 = 0, $2329 = 0, $233 = 0;
 var $2330 = 0, $2331 = 0, $2332 = 0, $2333 = 0, $2334 = 0, $2335 = 0, $2336 = 0, $2337 = 0, $2338 = 0, $2339 = 0, $234 = 0, $2340 = 0, $2341 = 0, $2342 = 0, $2343 = 0, $2344 = 0, $2345 = 0, $2346 = 0, $2347 = 0, $2348 = 0;
 var $2349 = 0, $235 = 0, $2350 = 0, $2351 = 0, $2352 = 0, $2353 = 0, $2354 = 0, $2355 = 0, $2356 = 0, $2357 = 0, $2358 = 0, $2359 = 0, $236 = 0, $2360 = 0, $2361 = 0, $2362 = 0, $2363 = 0, $2364 = 0, $2365 = 0, $2366 = 0;
 var $2367 = 0, $2368 = 0, $2369 = 0, $237 = 0, $2370 = 0, $2371 = 0, $2372 = 0, $2373 = 0, $2374 = 0, $2375 = 0, $2376 = 0, $2377 = 0, $2378 = 0, $2379 = 0, $238 = 0, $2380 = 0, $2381 = 0, $2382 = 0, $2383 = 0, $2384 = 0;
 var $2385 = 0, $2386 = 0, $2387 = 0, $2388 = 0, $2389 = 0, $239 = 0, $2390 = 0, $2391 = 0, $2392 = 0, $2393 = 0, $2394 = 0, $2395 = 0, $2396 = 0, $2397 = 0, $2398 = 0, $2399 = 0, $24 = 0, $240 = 0, $2400 = 0, $2401 = 0;
 var $2402 = 0, $2403 = 0, $2404 = 0, $2405 = 0, $2406 = 0, $2407 = 0, $2408 = 0, $2409 = 0, $241 = 0, $2410 = 0, $2411 = 0, $2412 = 0, $2413 = 0, $2414 = 0, $2415 = 0, $2416 = 0, $2417 = 0, $2418 = 0, $2419 = 0, $242 = 0;
 var $2420 = 0, $2421 = 0, $2422 = 0, $2423 = 0, $2424 = 0, $2425 = 0, $2426 = 0, $2427 = 0, $2428 = 0, $2429 = 0, $243 = 0, $2430 = 0, $2431 = 0, $2432 = 0, $2433 = 0, $2434 = 0, $2435 = 0, $2436 = 0, $2437 = 0, $2438 = 0;
 var $2439 = 0, $244 = 0, $2440 = 0, $2441 = 0, $2442 = 0, $2443 = 0, $2444 = 0, $2445 = 0, $2446 = 0, $2447 = 0, $2448 = 0, $2449 = 0, $245 = 0, $2450 = 0, $2451 = 0, $2452 = 0, $2453 = 0, $2454 = 0, $2455 = 0, $2456 = 0;
 var $2457 = 0, $2458 = 0, $2459 = 0, $246 = 0, $2460 = 0, $2461 = 0, $2462 = 0, $2463 = 0, $2464 = 0, $2465 = 0, $2466 = 0, $2467 = 0, $2468 = 0, $2469 = 0, $247 = 0, $2470 = 0, $2471 = 0, $2472 = 0, $2473 = 0, $2474 = 0;
 var $2475 = 0, $2476 = 0, $2477 = 0, $2478 = 0, $2479 = 0, $248 = 0, $2480 = 0, $2481 = 0, $2482 = 0, $2483 = 0, $2484 = 0, $2485 = 0, $2486 = 0, $2487 = 0, $2488 = 0, $2489 = 0, $249 = 0, $2490 = 0, $2491 = 0, $2492 = 0;
 var $2493 = 0, $2494 = 0, $2495 = 0, $2496 = 0, $2497 = 0, $2498 = 0, $2499 = 0, $25 = 0, $250 = 0, $2500 = 0, $2501 = 0, $2502 = 0, $2503 = 0, $2504 = 0, $2505 = 0, $2506 = 0, $2507 = 0, $2508 = 0, $2509 = 0, $251 = 0;
 var $2510 = 0, $2511 = 0, $2512 = 0, $2513 = 0, $2514 = 0, $2515 = 0, $2516 = 0, $2517 = 0, $2518 = 0, $2519 = 0, $252 = 0, $2520 = 0, $2521 = 0, $2522 = 0, $2523 = 0, $2524 = 0, $2525 = 0, $2526 = 0, $2527 = 0, $2528 = 0;
 var $2529 = 0, $253 = 0, $2530 = 0, $2531 = 0, $2532 = 0, $2533 = 0, $2534 = 0, $2535 = 0, $2536 = 0, $2537 = 0, $2538 = 0, $2539 = 0, $254 = 0, $2540 = 0, $2541 = 0, $2542 = 0, $2543 = 0, $2544 = 0, $2545 = 0, $2546 = 0;
 var $2547 = 0, $2548 = 0, $2549 = 0, $255 = 0, $2550 = 0, $2551 = 0, $2552 = 0, $2553 = 0, $2554 = 0, $2555 = 0, $2556 = 0, $2557 = 0, $2558 = 0, $2559 = 0, $256 = 0, $2560 = 0, $2561 = 0, $2562 = 0, $2563 = 0, $2564 = 0;
 var $2565 = 0, $2566 = 0, $2567 = 0, $2568 = 0, $2569 = 0, $257 = 0, $2570 = 0, $2571 = 0, $2572 = 0, $2573 = 0, $2574 = 0, $2575 = 0, $2576 = 0, $2577 = 0, $2578 = 0, $2579 = 0, $258 = 0, $2580 = 0, $2581 = 0, $2582 = 0;
 var $2583 = 0, $2584 = 0, $2585 = 0, $2586 = 0, $2587 = 0, $2588 = 0, $2589 = 0, $259 = 0, $2590 = 0, $2591 = 0, $2592 = 0, $2593 = 0, $2594 = 0, $2595 = 0, $2596 = 0, $2597 = 0, $2598 = 0, $2599 = 0, $26 = 0, $260 = 0;
 var $2600 = 0, $2601 = 0, $2602 = 0, $2603 = 0, $2604 = 0, $2605 = 0, $2606 = 0, $2607 = 0, $2608 = 0, $2609 = 0, $261 = 0, $2610 = 0, $2611 = 0, $2612 = 0, $2613 = 0, $2614 = 0, $2615 = 0, $262 = 0, $263 = 0, $264 = 0;
 var $265 = 0, $266 = 0, $267 = 0, $268 = 0, $269 = 0, $27 = 0, $270 = 0, $271 = 0, $272 = 0, $273 = 0, $274 = 0, $275 = 0, $276 = 0, $277 = 0, $278 = 0, $279 = 0, $28 = 0, $280 = 0, $281 = 0, $282 = 0;
 var $283 = 0, $284 = 0, $285 = 0, $286 = 0, $287 = 0, $288 = 0, $289 = 0, $29 = 0, $290 = 0, $291 = 0, $292 = 0, $293 = 0, $294 = 0, $295 = 0, $296 = 0, $297 = 0, $298 = 0, $299 = 0, $3 = 0, $30 = 0;
 var $300 = 0, $301 = 0, $302 = 0, $303 = 0, $304 = 0, $305 = 0, $306 = 0, $307 = 0, $308 = 0, $309 = 0, $31 = 0, $310 = 0, $311 = 0, $312 = 0, $313 = 0, $314 = 0, $315 = 0, $316 = 0, $317 = 0, $318 = 0;
 var $319 = 0, $32 = 0, $320 = 0, $321 = 0, $322 = 0, $323 = 0, $324 = 0, $325 = 0, $326 = 0, $327 = 0, $328 = 0, $329 = 0, $33 = 0, $330 = 0, $331 = 0, $332 = 0, $333 = 0, $334 = 0, $335 = 0, $336 = 0;
 var $337 = 0, $338 = 0, $339 = 0, $34 = 0, $340 = 0, $341 = 0, $342 = 0, $343 = 0, $344 = 0, $345 = 0, $346 = 0, $347 = 0, $348 = 0, $349 = 0, $35 = 0, $350 = 0, $351 = 0, $352 = 0, $353 = 0, $354 = 0;
 var $355 = 0, $356 = 0, $357 = 0, $358 = 0, $359 = 0, $36 = 0, $360 = 0, $361 = 0, $362 = 0, $363 = 0, $364 = 0, $365 = 0, $366 = 0, $367 = 0, $368 = 0, $369 = 0, $37 = 0, $370 = 0, $371 = 0, $372 = 0;
 var $373 = 0, $374 = 0, $375 = 0, $376 = 0, $377 = 0, $378 = 0, $379 = 0, $38 = 0, $380 = 0, $381 = 0, $382 = 0, $383 = 0, $384 = 0, $385 = 0, $386 = 0, $387 = 0, $388 = 0, $389 = 0, $39 = 0, $390 = 0;
 var $391 = 0, $392 = 0, $393 = 0, $394 = 0, $395 = 0, $396 = 0, $397 = 0, $398 = 0, $399 = 0, $4 = 0, $40 = 0, $400 = 0, $401 = 0, $402 = 0, $403 = 0, $404 = 0, $405 = 0, $406 = 0, $407 = 0, $408 = 0;
 var $409 = 0, $41 = 0, $410 = 0, $411 = 0, $412 = 0, $413 = 0, $414 = 0, $415 = 0, $416 = 0, $417 = 0, $418 = 0, $419 = 0, $42 = 0, $420 = 0, $421 = 0, $422 = 0, $423 = 0, $424 = 0, $425 = 0, $426 = 0;
 var $427 = 0, $428 = 0, $429 = 0, $43 = 0, $430 = 0, $431 = 0, $432 = 0, $433 = 0, $434 = 0, $435 = 0, $436 = 0, $437 = 0, $438 = 0, $439 = 0, $44 = 0, $440 = 0, $441 = 0, $442 = 0, $443 = 0, $444 = 0;
 var $445 = 0, $446 = 0, $447 = 0, $448 = 0, $449 = 0, $45 = 0, $450 = 0, $451 = 0, $452 = 0, $453 = 0, $454 = 0, $455 = 0, $456 = 0, $457 = 0, $458 = 0, $459 = 0, $46 = 0, $460 = 0, $461 = 0, $462 = 0;
 var $463 = 0, $464 = 0, $465 = 0, $466 = 0, $467 = 0, $468 = 0, $469 = 0, $47 = 0, $470 = 0, $471 = 0, $472 = 0, $473 = 0, $474 = 0, $475 = 0, $476 = 0, $477 = 0, $478 = 0, $479 = 0, $48 = 0, $480 = 0;
 var $481 = 0, $482 = 0, $483 = 0, $484 = 0, $485 = 0, $486 = 0, $487 = 0, $488 = 0, $489 = 0, $49 = 0, $490 = 0, $491 = 0, $492 = 0, $493 = 0, $494 = 0, $495 = 0, $496 = 0, $497 = 0, $498 = 0, $499 = 0;
 var $5 = 0, $50 = 0, $500 = 0, $501 = 0, $502 = 0, $503 = 0, $504 = 0, $505 = 0, $506 = 0, $507 = 0, $508 = 0, $509 = 0, $51 = 0, $510 = 0, $511 = 0, $512 = 0, $513 = 0, $514 = 0, $515 = 0, $516 = 0;
 var $517 = 0, $518 = 0, $519 = 0, $52 = 0, $520 = 0, $521 = 0, $522 = 0, $523 = 0, $524 = 0, $525 = 0, $526 = 0, $527 = 0, $528 = 0, $529 = 0, $53 = 0, $530 = 0, $531 = 0, $532 = 0, $533 = 0, $534 = 0;
 var $535 = 0, $536 = 0, $537 = 0, $538 = 0, $539 = 0, $54 = 0, $540 = 0, $541 = 0, $542 = 0, $543 = 0, $544 = 0, $545 = 0, $546 = 0, $547 = 0, $548 = 0, $549 = 0, $55 = 0, $550 = 0, $551 = 0, $552 = 0;
 var $553 = 0, $554 = 0, $555 = 0, $556 = 0, $557 = 0, $558 = 0, $559 = 0, $56 = 0, $560 = 0, $561 = 0, $562 = 0, $563 = 0, $564 = 0, $565 = 0, $566 = 0, $567 = 0, $568 = 0, $569 = 0, $57 = 0, $570 = 0;
 var $571 = 0, $572 = 0, $573 = 0, $574 = 0, $575 = 0, $576 = 0, $577 = 0, $578 = 0, $579 = 0, $58 = 0, $580 = 0, $581 = 0, $582 = 0, $583 = 0, $584 = 0, $585 = 0, $586 = 0, $587 = 0, $588 = 0, $589 = 0;
 var $59 = 0, $590 = 0, $591 = 0, $592 = 0, $593 = 0, $594 = 0, $595 = 0, $596 = 0, $597 = 0, $598 = 0, $599 = 0, $6 = 0, $60 = 0, $600 = 0, $601 = 0, $602 = 0, $603 = 0, $604 = 0, $605 = 0, $606 = 0;
 var $607 = 0, $608 = 0, $609 = 0, $61 = 0, $610 = 0, $611 = 0, $612 = 0, $613 = 0, $614 = 0, $615 = 0, $616 = 0, $617 = 0, $618 = 0, $619 = 0, $62 = 0, $620 = 0, $621 = 0, $622 = 0, $623 = 0, $624 = 0;
 var $625 = 0, $626 = 0, $627 = 0, $628 = 0, $629 = 0, $63 = 0, $630 = 0, $631 = 0, $632 = 0, $633 = 0, $634 = 0, $635 = 0, $636 = 0, $637 = 0, $638 = 0, $639 = 0, $64 = 0, $640 = 0, $641 = 0, $642 = 0;
 var $643 = 0, $644 = 0, $645 = 0, $646 = 0, $647 = 0, $648 = 0, $649 = 0, $65 = 0, $650 = 0, $651 = 0, $652 = 0, $653 = 0, $654 = 0, $655 = 0, $656 = 0, $657 = 0, $658 = 0, $659 = 0, $66 = 0, $660 = 0;
 var $661 = 0, $662 = 0, $663 = 0, $664 = 0, $665 = 0, $666 = 0, $667 = 0, $668 = 0, $669 = 0, $67 = 0, $670 = 0, $671 = 0, $672 = 0, $673 = 0, $674 = 0, $675 = 0, $676 = 0, $677 = 0, $678 = 0, $679 = 0;
 var $68 = 0, $680 = 0, $681 = 0, $682 = 0, $683 = 0, $684 = 0, $685 = 0, $686 = 0, $687 = 0, $688 = 0, $689 = 0, $69 = 0, $690 = 0, $691 = 0, $692 = 0, $693 = 0, $694 = 0, $695 = 0, $696 = 0, $697 = 0;
 var $698 = 0, $699 = 0, $7 = 0, $70 = 0, $700 = 0, $701 = 0, $702 = 0, $703 = 0, $704 = 0, $705 = 0, $706 = 0, $707 = 0, $708 = 0, $709 = 0, $71 = 0, $710 = 0, $711 = 0, $712 = 0, $713 = 0, $714 = 0;
 var $715 = 0, $716 = 0, $717 = 0, $718 = 0, $719 = 0, $72 = 0, $720 = 0, $721 = 0, $722 = 0, $723 = 0, $724 = 0, $725 = 0, $726 = 0, $727 = 0, $728 = 0, $729 = 0, $73 = 0, $730 = 0, $731 = 0, $732 = 0;
 var $733 = 0, $734 = 0, $735 = 0, $736 = 0, $737 = 0, $738 = 0, $739 = 0, $74 = 0, $740 = 0, $741 = 0, $742 = 0, $743 = 0, $744 = 0, $745 = 0, $746 = 0, $747 = 0, $748 = 0, $749 = 0, $75 = 0, $750 = 0;
 var $751 = 0, $752 = 0, $753 = 0, $754 = 0, $755 = 0, $756 = 0, $757 = 0, $758 = 0, $759 = 0, $76 = 0, $760 = 0, $761 = 0, $762 = 0, $763 = 0, $764 = 0, $765 = 0, $766 = 0, $767 = 0, $768 = 0, $769 = 0;
 var $77 = 0, $770 = 0, $771 = 0, $772 = 0, $773 = 0, $774 = 0, $775 = 0, $776 = 0, $777 = 0, $778 = 0, $779 = 0, $78 = 0, $780 = 0, $781 = 0, $782 = 0, $783 = 0, $784 = 0, $785 = 0, $786 = 0, $787 = 0;
 var $788 = 0, $789 = 0, $79 = 0, $790 = 0, $791 = 0, $792 = 0, $793 = 0, $794 = 0, $795 = 0, $796 = 0, $797 = 0, $798 = 0, $799 = 0, $8 = 0, $80 = 0, $800 = 0, $801 = 0, $802 = 0, $803 = 0, $804 = 0;
 var $805 = 0, $806 = 0, $807 = 0, $808 = 0, $809 = 0, $81 = 0, $810 = 0, $811 = 0, $812 = 0, $813 = 0, $814 = 0, $815 = 0, $816 = 0, $817 = 0, $818 = 0, $819 = 0, $82 = 0, $820 = 0, $821 = 0, $822 = 0;
 var $823 = 0, $824 = 0, $825 = 0, $826 = 0, $827 = 0, $828 = 0, $829 = 0, $83 = 0, $830 = 0, $831 = 0, $832 = 0, $833 = 0, $834 = 0, $835 = 0, $836 = 0, $837 = 0, $838 = 0, $839 = 0, $84 = 0, $840 = 0;
 var $841 = 0, $842 = 0, $843 = 0, $844 = 0, $845 = 0, $846 = 0, $847 = 0, $848 = 0, $849 = 0, $85 = 0, $850 = 0, $851 = 0, $852 = 0, $853 = 0, $854 = 0, $855 = 0, $856 = 0, $857 = 0, $858 = 0, $859 = 0;
 var $86 = 0, $860 = 0, $861 = 0, $862 = 0, $863 = 0, $864 = 0, $865 = 0, $866 = 0, $867 = 0, $868 = 0, $869 = 0, $87 = 0, $870 = 0, $871 = 0, $872 = 0, $873 = 0, $874 = 0, $875 = 0, $876 = 0, $877 = 0;
 var $878 = 0, $879 = 0, $88 = 0, $880 = 0, $881 = 0, $882 = 0, $883 = 0, $884 = 0, $885 = 0, $886 = 0, $887 = 0, $888 = 0, $889 = 0, $89 = 0, $890 = 0, $891 = 0, $892 = 0, $893 = 0, $894 = 0, $895 = 0;
 var $896 = 0, $897 = 0, $898 = 0, $899 = 0, $9 = 0, $90 = 0, $900 = 0, $901 = 0, $902 = 0, $903 = 0, $904 = 0, $905 = 0, $906 = 0, $907 = 0, $908 = 0, $909 = 0, $91 = 0, $910 = 0, $911 = 0, $912 = 0;
 var $913 = 0, $914 = 0, $915 = 0, $916 = 0, $917 = 0, $918 = 0, $919 = 0, $92 = 0, $920 = 0, $921 = 0, $922 = 0, $923 = 0, $924 = 0, $925 = 0, $926 = 0, $927 = 0, $928 = 0, $929 = 0, $93 = 0, $930 = 0;
 var $931 = 0, $932 = 0, $933 = 0, $934 = 0, $935 = 0, $936 = 0, $937 = 0, $938 = 0, $939 = 0, $94 = 0, $940 = 0, $941 = 0, $942 = 0, $943 = 0, $944 = 0, $945 = 0, $946 = 0, $947 = 0, $948 = 0, $949 = 0;
 var $95 = 0, $950 = 0, $951 = 0, $952 = 0, $953 = 0, $954 = 0, $955 = 0, $956 = 0, $957 = 0, $958 = 0, $959 = 0, $96 = 0, $960 = 0, $961 = 0, $962 = 0, $963 = 0, $964 = 0, $965 = 0, $966 = 0, $967 = 0;
 var $968 = 0, $969 = 0, $97 = 0, $970 = 0, $971 = 0, $972 = 0, $973 = 0, $974 = 0, $975 = 0, $976 = 0, $977 = 0, $978 = 0, $979 = 0, $98 = 0, $980 = 0, $981 = 0, $982 = 0, $983 = 0, $984 = 0, $985 = 0;
 var $986 = 0, $987 = 0, $988 = 0, $989 = 0, $99 = 0, $990 = 0, $991 = 0, $992 = 0, $993 = 0, $994 = 0, $995 = 0, $996 = 0, $997 = 0, $998 = 0, $999 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 208|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(208|0);
 $2 = sp + 192|0;
 $3 = sp + 184|0;
 $4 = sp + 176|0;
 $5 = sp + 168|0;
 $6 = sp + 160|0;
 $7 = sp + 152|0;
 $8 = sp + 144|0;
 $9 = sp + 136|0;
 $10 = sp + 128|0;
 $11 = sp + 120|0;
 $12 = sp + 112|0;
 $13 = sp + 104|0;
 $14 = sp + 96|0;
 $15 = sp + 88|0;
 $16 = sp + 80|0;
 $17 = sp + 72|0;
 $18 = sp + 64|0;
 $19 = sp + 56|0;
 $20 = sp + 48|0;
 $21 = sp + 40|0;
 $22 = sp + 32|0;
 $23 = sp + 24|0;
 $24 = sp + 16|0;
 $25 = sp + 8|0;
 $26 = sp;
 $1 = $0;
 $27 = $1;
 $28 = (_load_3($27)|0);
 $29 = tempRet0;
 $30 = 2097151 & $28;
 $31 = $2;
 $32 = $31;
 HEAP32[$32>>2] = $30;
 $33 = (($31) + 4)|0;
 $34 = $33;
 HEAP32[$34>>2] = 0;
 $35 = $1;
 $36 = ((($35)) + 2|0);
 $37 = (_load_4($36)|0);
 $38 = tempRet0;
 $39 = (_bitshift64Lshr(($37|0),($38|0),5)|0);
 $40 = tempRet0;
 $41 = 2097151 & $39;
 $42 = $3;
 $43 = $42;
 HEAP32[$43>>2] = $41;
 $44 = (($42) + 4)|0;
 $45 = $44;
 HEAP32[$45>>2] = 0;
 $46 = $1;
 $47 = ((($46)) + 5|0);
 $48 = (_load_3($47)|0);
 $49 = tempRet0;
 $50 = (_bitshift64Lshr(($48|0),($49|0),2)|0);
 $51 = tempRet0;
 $52 = 2097151 & $50;
 $53 = $4;
 $54 = $53;
 HEAP32[$54>>2] = $52;
 $55 = (($53) + 4)|0;
 $56 = $55;
 HEAP32[$56>>2] = 0;
 $57 = $1;
 $58 = ((($57)) + 7|0);
 $59 = (_load_4($58)|0);
 $60 = tempRet0;
 $61 = (_bitshift64Lshr(($59|0),($60|0),7)|0);
 $62 = tempRet0;
 $63 = 2097151 & $61;
 $64 = $5;
 $65 = $64;
 HEAP32[$65>>2] = $63;
 $66 = (($64) + 4)|0;
 $67 = $66;
 HEAP32[$67>>2] = 0;
 $68 = $1;
 $69 = ((($68)) + 10|0);
 $70 = (_load_4($69)|0);
 $71 = tempRet0;
 $72 = (_bitshift64Lshr(($70|0),($71|0),4)|0);
 $73 = tempRet0;
 $74 = 2097151 & $72;
 $75 = $6;
 $76 = $75;
 HEAP32[$76>>2] = $74;
 $77 = (($75) + 4)|0;
 $78 = $77;
 HEAP32[$78>>2] = 0;
 $79 = $1;
 $80 = ((($79)) + 13|0);
 $81 = (_load_3($80)|0);
 $82 = tempRet0;
 $83 = (_bitshift64Lshr(($81|0),($82|0),1)|0);
 $84 = tempRet0;
 $85 = 2097151 & $83;
 $86 = $7;
 $87 = $86;
 HEAP32[$87>>2] = $85;
 $88 = (($86) + 4)|0;
 $89 = $88;
 HEAP32[$89>>2] = 0;
 $90 = $1;
 $91 = ((($90)) + 15|0);
 $92 = (_load_4($91)|0);
 $93 = tempRet0;
 $94 = (_bitshift64Lshr(($92|0),($93|0),6)|0);
 $95 = tempRet0;
 $96 = 2097151 & $94;
 $97 = $8;
 $98 = $97;
 HEAP32[$98>>2] = $96;
 $99 = (($97) + 4)|0;
 $100 = $99;
 HEAP32[$100>>2] = 0;
 $101 = $1;
 $102 = ((($101)) + 18|0);
 $103 = (_load_3($102)|0);
 $104 = tempRet0;
 $105 = (_bitshift64Lshr(($103|0),($104|0),3)|0);
 $106 = tempRet0;
 $107 = 2097151 & $105;
 $108 = $9;
 $109 = $108;
 HEAP32[$109>>2] = $107;
 $110 = (($108) + 4)|0;
 $111 = $110;
 HEAP32[$111>>2] = 0;
 $112 = $1;
 $113 = ((($112)) + 21|0);
 $114 = (_load_3($113)|0);
 $115 = tempRet0;
 $116 = 2097151 & $114;
 $117 = $10;
 $118 = $117;
 HEAP32[$118>>2] = $116;
 $119 = (($117) + 4)|0;
 $120 = $119;
 HEAP32[$120>>2] = 0;
 $121 = $1;
 $122 = ((($121)) + 23|0);
 $123 = (_load_4($122)|0);
 $124 = tempRet0;
 $125 = (_bitshift64Lshr(($123|0),($124|0),5)|0);
 $126 = tempRet0;
 $127 = 2097151 & $125;
 $128 = $11;
 $129 = $128;
 HEAP32[$129>>2] = $127;
 $130 = (($128) + 4)|0;
 $131 = $130;
 HEAP32[$131>>2] = 0;
 $132 = $1;
 $133 = ((($132)) + 26|0);
 $134 = (_load_3($133)|0);
 $135 = tempRet0;
 $136 = (_bitshift64Lshr(($134|0),($135|0),2)|0);
 $137 = tempRet0;
 $138 = 2097151 & $136;
 $139 = $12;
 $140 = $139;
 HEAP32[$140>>2] = $138;
 $141 = (($139) + 4)|0;
 $142 = $141;
 HEAP32[$142>>2] = 0;
 $143 = $1;
 $144 = ((($143)) + 28|0);
 $145 = (_load_4($144)|0);
 $146 = tempRet0;
 $147 = (_bitshift64Lshr(($145|0),($146|0),7)|0);
 $148 = tempRet0;
 $149 = $13;
 $150 = $149;
 HEAP32[$150>>2] = $147;
 $151 = (($149) + 4)|0;
 $152 = $151;
 HEAP32[$152>>2] = $148;
 $153 = $14;
 $154 = $153;
 HEAP32[$154>>2] = 0;
 $155 = (($153) + 4)|0;
 $156 = $155;
 HEAP32[$156>>2] = 0;
 $157 = $2;
 $158 = $157;
 $159 = HEAP32[$158>>2]|0;
 $160 = (($157) + 4)|0;
 $161 = $160;
 $162 = HEAP32[$161>>2]|0;
 $163 = (_i64Add(($159|0),($162|0),1048576,0)|0);
 $164 = tempRet0;
 $165 = (_bitshift64Ashr(($163|0),($164|0),21)|0);
 $166 = tempRet0;
 $167 = $15;
 $168 = $167;
 HEAP32[$168>>2] = $165;
 $169 = (($167) + 4)|0;
 $170 = $169;
 HEAP32[$170>>2] = $166;
 $171 = $15;
 $172 = $171;
 $173 = HEAP32[$172>>2]|0;
 $174 = (($171) + 4)|0;
 $175 = $174;
 $176 = HEAP32[$175>>2]|0;
 $177 = $3;
 $178 = $177;
 $179 = HEAP32[$178>>2]|0;
 $180 = (($177) + 4)|0;
 $181 = $180;
 $182 = HEAP32[$181>>2]|0;
 $183 = (_i64Add(($179|0),($182|0),($173|0),($176|0))|0);
 $184 = tempRet0;
 $185 = $3;
 $186 = $185;
 HEAP32[$186>>2] = $183;
 $187 = (($185) + 4)|0;
 $188 = $187;
 HEAP32[$188>>2] = $184;
 $189 = $15;
 $190 = $189;
 $191 = HEAP32[$190>>2]|0;
 $192 = (($189) + 4)|0;
 $193 = $192;
 $194 = HEAP32[$193>>2]|0;
 $195 = (_bitshift64Shl(($191|0),($194|0),21)|0);
 $196 = tempRet0;
 $197 = $2;
 $198 = $197;
 $199 = HEAP32[$198>>2]|0;
 $200 = (($197) + 4)|0;
 $201 = $200;
 $202 = HEAP32[$201>>2]|0;
 $203 = (_i64Subtract(($199|0),($202|0),($195|0),($196|0))|0);
 $204 = tempRet0;
 $205 = $2;
 $206 = $205;
 HEAP32[$206>>2] = $203;
 $207 = (($205) + 4)|0;
 $208 = $207;
 HEAP32[$208>>2] = $204;
 $209 = $4;
 $210 = $209;
 $211 = HEAP32[$210>>2]|0;
 $212 = (($209) + 4)|0;
 $213 = $212;
 $214 = HEAP32[$213>>2]|0;
 $215 = (_i64Add(($211|0),($214|0),1048576,0)|0);
 $216 = tempRet0;
 $217 = (_bitshift64Ashr(($215|0),($216|0),21)|0);
 $218 = tempRet0;
 $219 = $17;
 $220 = $219;
 HEAP32[$220>>2] = $217;
 $221 = (($219) + 4)|0;
 $222 = $221;
 HEAP32[$222>>2] = $218;
 $223 = $17;
 $224 = $223;
 $225 = HEAP32[$224>>2]|0;
 $226 = (($223) + 4)|0;
 $227 = $226;
 $228 = HEAP32[$227>>2]|0;
 $229 = $5;
 $230 = $229;
 $231 = HEAP32[$230>>2]|0;
 $232 = (($229) + 4)|0;
 $233 = $232;
 $234 = HEAP32[$233>>2]|0;
 $235 = (_i64Add(($231|0),($234|0),($225|0),($228|0))|0);
 $236 = tempRet0;
 $237 = $5;
 $238 = $237;
 HEAP32[$238>>2] = $235;
 $239 = (($237) + 4)|0;
 $240 = $239;
 HEAP32[$240>>2] = $236;
 $241 = $17;
 $242 = $241;
 $243 = HEAP32[$242>>2]|0;
 $244 = (($241) + 4)|0;
 $245 = $244;
 $246 = HEAP32[$245>>2]|0;
 $247 = (_bitshift64Shl(($243|0),($246|0),21)|0);
 $248 = tempRet0;
 $249 = $4;
 $250 = $249;
 $251 = HEAP32[$250>>2]|0;
 $252 = (($249) + 4)|0;
 $253 = $252;
 $254 = HEAP32[$253>>2]|0;
 $255 = (_i64Subtract(($251|0),($254|0),($247|0),($248|0))|0);
 $256 = tempRet0;
 $257 = $4;
 $258 = $257;
 HEAP32[$258>>2] = $255;
 $259 = (($257) + 4)|0;
 $260 = $259;
 HEAP32[$260>>2] = $256;
 $261 = $6;
 $262 = $261;
 $263 = HEAP32[$262>>2]|0;
 $264 = (($261) + 4)|0;
 $265 = $264;
 $266 = HEAP32[$265>>2]|0;
 $267 = (_i64Add(($263|0),($266|0),1048576,0)|0);
 $268 = tempRet0;
 $269 = (_bitshift64Ashr(($267|0),($268|0),21)|0);
 $270 = tempRet0;
 $271 = $19;
 $272 = $271;
 HEAP32[$272>>2] = $269;
 $273 = (($271) + 4)|0;
 $274 = $273;
 HEAP32[$274>>2] = $270;
 $275 = $19;
 $276 = $275;
 $277 = HEAP32[$276>>2]|0;
 $278 = (($275) + 4)|0;
 $279 = $278;
 $280 = HEAP32[$279>>2]|0;
 $281 = $7;
 $282 = $281;
 $283 = HEAP32[$282>>2]|0;
 $284 = (($281) + 4)|0;
 $285 = $284;
 $286 = HEAP32[$285>>2]|0;
 $287 = (_i64Add(($283|0),($286|0),($277|0),($280|0))|0);
 $288 = tempRet0;
 $289 = $7;
 $290 = $289;
 HEAP32[$290>>2] = $287;
 $291 = (($289) + 4)|0;
 $292 = $291;
 HEAP32[$292>>2] = $288;
 $293 = $19;
 $294 = $293;
 $295 = HEAP32[$294>>2]|0;
 $296 = (($293) + 4)|0;
 $297 = $296;
 $298 = HEAP32[$297>>2]|0;
 $299 = (_bitshift64Shl(($295|0),($298|0),21)|0);
 $300 = tempRet0;
 $301 = $6;
 $302 = $301;
 $303 = HEAP32[$302>>2]|0;
 $304 = (($301) + 4)|0;
 $305 = $304;
 $306 = HEAP32[$305>>2]|0;
 $307 = (_i64Subtract(($303|0),($306|0),($299|0),($300|0))|0);
 $308 = tempRet0;
 $309 = $6;
 $310 = $309;
 HEAP32[$310>>2] = $307;
 $311 = (($309) + 4)|0;
 $312 = $311;
 HEAP32[$312>>2] = $308;
 $313 = $8;
 $314 = $313;
 $315 = HEAP32[$314>>2]|0;
 $316 = (($313) + 4)|0;
 $317 = $316;
 $318 = HEAP32[$317>>2]|0;
 $319 = (_i64Add(($315|0),($318|0),1048576,0)|0);
 $320 = tempRet0;
 $321 = (_bitshift64Ashr(($319|0),($320|0),21)|0);
 $322 = tempRet0;
 $323 = $21;
 $324 = $323;
 HEAP32[$324>>2] = $321;
 $325 = (($323) + 4)|0;
 $326 = $325;
 HEAP32[$326>>2] = $322;
 $327 = $21;
 $328 = $327;
 $329 = HEAP32[$328>>2]|0;
 $330 = (($327) + 4)|0;
 $331 = $330;
 $332 = HEAP32[$331>>2]|0;
 $333 = $9;
 $334 = $333;
 $335 = HEAP32[$334>>2]|0;
 $336 = (($333) + 4)|0;
 $337 = $336;
 $338 = HEAP32[$337>>2]|0;
 $339 = (_i64Add(($335|0),($338|0),($329|0),($332|0))|0);
 $340 = tempRet0;
 $341 = $9;
 $342 = $341;
 HEAP32[$342>>2] = $339;
 $343 = (($341) + 4)|0;
 $344 = $343;
 HEAP32[$344>>2] = $340;
 $345 = $21;
 $346 = $345;
 $347 = HEAP32[$346>>2]|0;
 $348 = (($345) + 4)|0;
 $349 = $348;
 $350 = HEAP32[$349>>2]|0;
 $351 = (_bitshift64Shl(($347|0),($350|0),21)|0);
 $352 = tempRet0;
 $353 = $8;
 $354 = $353;
 $355 = HEAP32[$354>>2]|0;
 $356 = (($353) + 4)|0;
 $357 = $356;
 $358 = HEAP32[$357>>2]|0;
 $359 = (_i64Subtract(($355|0),($358|0),($351|0),($352|0))|0);
 $360 = tempRet0;
 $361 = $8;
 $362 = $361;
 HEAP32[$362>>2] = $359;
 $363 = (($361) + 4)|0;
 $364 = $363;
 HEAP32[$364>>2] = $360;
 $365 = $10;
 $366 = $365;
 $367 = HEAP32[$366>>2]|0;
 $368 = (($365) + 4)|0;
 $369 = $368;
 $370 = HEAP32[$369>>2]|0;
 $371 = (_i64Add(($367|0),($370|0),1048576,0)|0);
 $372 = tempRet0;
 $373 = (_bitshift64Ashr(($371|0),($372|0),21)|0);
 $374 = tempRet0;
 $375 = $23;
 $376 = $375;
 HEAP32[$376>>2] = $373;
 $377 = (($375) + 4)|0;
 $378 = $377;
 HEAP32[$378>>2] = $374;
 $379 = $23;
 $380 = $379;
 $381 = HEAP32[$380>>2]|0;
 $382 = (($379) + 4)|0;
 $383 = $382;
 $384 = HEAP32[$383>>2]|0;
 $385 = $11;
 $386 = $385;
 $387 = HEAP32[$386>>2]|0;
 $388 = (($385) + 4)|0;
 $389 = $388;
 $390 = HEAP32[$389>>2]|0;
 $391 = (_i64Add(($387|0),($390|0),($381|0),($384|0))|0);
 $392 = tempRet0;
 $393 = $11;
 $394 = $393;
 HEAP32[$394>>2] = $391;
 $395 = (($393) + 4)|0;
 $396 = $395;
 HEAP32[$396>>2] = $392;
 $397 = $23;
 $398 = $397;
 $399 = HEAP32[$398>>2]|0;
 $400 = (($397) + 4)|0;
 $401 = $400;
 $402 = HEAP32[$401>>2]|0;
 $403 = (_bitshift64Shl(($399|0),($402|0),21)|0);
 $404 = tempRet0;
 $405 = $10;
 $406 = $405;
 $407 = HEAP32[$406>>2]|0;
 $408 = (($405) + 4)|0;
 $409 = $408;
 $410 = HEAP32[$409>>2]|0;
 $411 = (_i64Subtract(($407|0),($410|0),($403|0),($404|0))|0);
 $412 = tempRet0;
 $413 = $10;
 $414 = $413;
 HEAP32[$414>>2] = $411;
 $415 = (($413) + 4)|0;
 $416 = $415;
 HEAP32[$416>>2] = $412;
 $417 = $12;
 $418 = $417;
 $419 = HEAP32[$418>>2]|0;
 $420 = (($417) + 4)|0;
 $421 = $420;
 $422 = HEAP32[$421>>2]|0;
 $423 = (_i64Add(($419|0),($422|0),1048576,0)|0);
 $424 = tempRet0;
 $425 = (_bitshift64Ashr(($423|0),($424|0),21)|0);
 $426 = tempRet0;
 $427 = $25;
 $428 = $427;
 HEAP32[$428>>2] = $425;
 $429 = (($427) + 4)|0;
 $430 = $429;
 HEAP32[$430>>2] = $426;
 $431 = $25;
 $432 = $431;
 $433 = HEAP32[$432>>2]|0;
 $434 = (($431) + 4)|0;
 $435 = $434;
 $436 = HEAP32[$435>>2]|0;
 $437 = $13;
 $438 = $437;
 $439 = HEAP32[$438>>2]|0;
 $440 = (($437) + 4)|0;
 $441 = $440;
 $442 = HEAP32[$441>>2]|0;
 $443 = (_i64Add(($439|0),($442|0),($433|0),($436|0))|0);
 $444 = tempRet0;
 $445 = $13;
 $446 = $445;
 HEAP32[$446>>2] = $443;
 $447 = (($445) + 4)|0;
 $448 = $447;
 HEAP32[$448>>2] = $444;
 $449 = $25;
 $450 = $449;
 $451 = HEAP32[$450>>2]|0;
 $452 = (($449) + 4)|0;
 $453 = $452;
 $454 = HEAP32[$453>>2]|0;
 $455 = (_bitshift64Shl(($451|0),($454|0),21)|0);
 $456 = tempRet0;
 $457 = $12;
 $458 = $457;
 $459 = HEAP32[$458>>2]|0;
 $460 = (($457) + 4)|0;
 $461 = $460;
 $462 = HEAP32[$461>>2]|0;
 $463 = (_i64Subtract(($459|0),($462|0),($455|0),($456|0))|0);
 $464 = tempRet0;
 $465 = $12;
 $466 = $465;
 HEAP32[$466>>2] = $463;
 $467 = (($465) + 4)|0;
 $468 = $467;
 HEAP32[$468>>2] = $464;
 $469 = $3;
 $470 = $469;
 $471 = HEAP32[$470>>2]|0;
 $472 = (($469) + 4)|0;
 $473 = $472;
 $474 = HEAP32[$473>>2]|0;
 $475 = (_i64Add(($471|0),($474|0),1048576,0)|0);
 $476 = tempRet0;
 $477 = (_bitshift64Ashr(($475|0),($476|0),21)|0);
 $478 = tempRet0;
 $479 = $16;
 $480 = $479;
 HEAP32[$480>>2] = $477;
 $481 = (($479) + 4)|0;
 $482 = $481;
 HEAP32[$482>>2] = $478;
 $483 = $16;
 $484 = $483;
 $485 = HEAP32[$484>>2]|0;
 $486 = (($483) + 4)|0;
 $487 = $486;
 $488 = HEAP32[$487>>2]|0;
 $489 = $4;
 $490 = $489;
 $491 = HEAP32[$490>>2]|0;
 $492 = (($489) + 4)|0;
 $493 = $492;
 $494 = HEAP32[$493>>2]|0;
 $495 = (_i64Add(($491|0),($494|0),($485|0),($488|0))|0);
 $496 = tempRet0;
 $497 = $4;
 $498 = $497;
 HEAP32[$498>>2] = $495;
 $499 = (($497) + 4)|0;
 $500 = $499;
 HEAP32[$500>>2] = $496;
 $501 = $16;
 $502 = $501;
 $503 = HEAP32[$502>>2]|0;
 $504 = (($501) + 4)|0;
 $505 = $504;
 $506 = HEAP32[$505>>2]|0;
 $507 = (_bitshift64Shl(($503|0),($506|0),21)|0);
 $508 = tempRet0;
 $509 = $3;
 $510 = $509;
 $511 = HEAP32[$510>>2]|0;
 $512 = (($509) + 4)|0;
 $513 = $512;
 $514 = HEAP32[$513>>2]|0;
 $515 = (_i64Subtract(($511|0),($514|0),($507|0),($508|0))|0);
 $516 = tempRet0;
 $517 = $3;
 $518 = $517;
 HEAP32[$518>>2] = $515;
 $519 = (($517) + 4)|0;
 $520 = $519;
 HEAP32[$520>>2] = $516;
 $521 = $5;
 $522 = $521;
 $523 = HEAP32[$522>>2]|0;
 $524 = (($521) + 4)|0;
 $525 = $524;
 $526 = HEAP32[$525>>2]|0;
 $527 = (_i64Add(($523|0),($526|0),1048576,0)|0);
 $528 = tempRet0;
 $529 = (_bitshift64Ashr(($527|0),($528|0),21)|0);
 $530 = tempRet0;
 $531 = $18;
 $532 = $531;
 HEAP32[$532>>2] = $529;
 $533 = (($531) + 4)|0;
 $534 = $533;
 HEAP32[$534>>2] = $530;
 $535 = $18;
 $536 = $535;
 $537 = HEAP32[$536>>2]|0;
 $538 = (($535) + 4)|0;
 $539 = $538;
 $540 = HEAP32[$539>>2]|0;
 $541 = $6;
 $542 = $541;
 $543 = HEAP32[$542>>2]|0;
 $544 = (($541) + 4)|0;
 $545 = $544;
 $546 = HEAP32[$545>>2]|0;
 $547 = (_i64Add(($543|0),($546|0),($537|0),($540|0))|0);
 $548 = tempRet0;
 $549 = $6;
 $550 = $549;
 HEAP32[$550>>2] = $547;
 $551 = (($549) + 4)|0;
 $552 = $551;
 HEAP32[$552>>2] = $548;
 $553 = $18;
 $554 = $553;
 $555 = HEAP32[$554>>2]|0;
 $556 = (($553) + 4)|0;
 $557 = $556;
 $558 = HEAP32[$557>>2]|0;
 $559 = (_bitshift64Shl(($555|0),($558|0),21)|0);
 $560 = tempRet0;
 $561 = $5;
 $562 = $561;
 $563 = HEAP32[$562>>2]|0;
 $564 = (($561) + 4)|0;
 $565 = $564;
 $566 = HEAP32[$565>>2]|0;
 $567 = (_i64Subtract(($563|0),($566|0),($559|0),($560|0))|0);
 $568 = tempRet0;
 $569 = $5;
 $570 = $569;
 HEAP32[$570>>2] = $567;
 $571 = (($569) + 4)|0;
 $572 = $571;
 HEAP32[$572>>2] = $568;
 $573 = $7;
 $574 = $573;
 $575 = HEAP32[$574>>2]|0;
 $576 = (($573) + 4)|0;
 $577 = $576;
 $578 = HEAP32[$577>>2]|0;
 $579 = (_i64Add(($575|0),($578|0),1048576,0)|0);
 $580 = tempRet0;
 $581 = (_bitshift64Ashr(($579|0),($580|0),21)|0);
 $582 = tempRet0;
 $583 = $20;
 $584 = $583;
 HEAP32[$584>>2] = $581;
 $585 = (($583) + 4)|0;
 $586 = $585;
 HEAP32[$586>>2] = $582;
 $587 = $20;
 $588 = $587;
 $589 = HEAP32[$588>>2]|0;
 $590 = (($587) + 4)|0;
 $591 = $590;
 $592 = HEAP32[$591>>2]|0;
 $593 = $8;
 $594 = $593;
 $595 = HEAP32[$594>>2]|0;
 $596 = (($593) + 4)|0;
 $597 = $596;
 $598 = HEAP32[$597>>2]|0;
 $599 = (_i64Add(($595|0),($598|0),($589|0),($592|0))|0);
 $600 = tempRet0;
 $601 = $8;
 $602 = $601;
 HEAP32[$602>>2] = $599;
 $603 = (($601) + 4)|0;
 $604 = $603;
 HEAP32[$604>>2] = $600;
 $605 = $20;
 $606 = $605;
 $607 = HEAP32[$606>>2]|0;
 $608 = (($605) + 4)|0;
 $609 = $608;
 $610 = HEAP32[$609>>2]|0;
 $611 = (_bitshift64Shl(($607|0),($610|0),21)|0);
 $612 = tempRet0;
 $613 = $7;
 $614 = $613;
 $615 = HEAP32[$614>>2]|0;
 $616 = (($613) + 4)|0;
 $617 = $616;
 $618 = HEAP32[$617>>2]|0;
 $619 = (_i64Subtract(($615|0),($618|0),($611|0),($612|0))|0);
 $620 = tempRet0;
 $621 = $7;
 $622 = $621;
 HEAP32[$622>>2] = $619;
 $623 = (($621) + 4)|0;
 $624 = $623;
 HEAP32[$624>>2] = $620;
 $625 = $9;
 $626 = $625;
 $627 = HEAP32[$626>>2]|0;
 $628 = (($625) + 4)|0;
 $629 = $628;
 $630 = HEAP32[$629>>2]|0;
 $631 = (_i64Add(($627|0),($630|0),1048576,0)|0);
 $632 = tempRet0;
 $633 = (_bitshift64Ashr(($631|0),($632|0),21)|0);
 $634 = tempRet0;
 $635 = $22;
 $636 = $635;
 HEAP32[$636>>2] = $633;
 $637 = (($635) + 4)|0;
 $638 = $637;
 HEAP32[$638>>2] = $634;
 $639 = $22;
 $640 = $639;
 $641 = HEAP32[$640>>2]|0;
 $642 = (($639) + 4)|0;
 $643 = $642;
 $644 = HEAP32[$643>>2]|0;
 $645 = $10;
 $646 = $645;
 $647 = HEAP32[$646>>2]|0;
 $648 = (($645) + 4)|0;
 $649 = $648;
 $650 = HEAP32[$649>>2]|0;
 $651 = (_i64Add(($647|0),($650|0),($641|0),($644|0))|0);
 $652 = tempRet0;
 $653 = $10;
 $654 = $653;
 HEAP32[$654>>2] = $651;
 $655 = (($653) + 4)|0;
 $656 = $655;
 HEAP32[$656>>2] = $652;
 $657 = $22;
 $658 = $657;
 $659 = HEAP32[$658>>2]|0;
 $660 = (($657) + 4)|0;
 $661 = $660;
 $662 = HEAP32[$661>>2]|0;
 $663 = (_bitshift64Shl(($659|0),($662|0),21)|0);
 $664 = tempRet0;
 $665 = $9;
 $666 = $665;
 $667 = HEAP32[$666>>2]|0;
 $668 = (($665) + 4)|0;
 $669 = $668;
 $670 = HEAP32[$669>>2]|0;
 $671 = (_i64Subtract(($667|0),($670|0),($663|0),($664|0))|0);
 $672 = tempRet0;
 $673 = $9;
 $674 = $673;
 HEAP32[$674>>2] = $671;
 $675 = (($673) + 4)|0;
 $676 = $675;
 HEAP32[$676>>2] = $672;
 $677 = $11;
 $678 = $677;
 $679 = HEAP32[$678>>2]|0;
 $680 = (($677) + 4)|0;
 $681 = $680;
 $682 = HEAP32[$681>>2]|0;
 $683 = (_i64Add(($679|0),($682|0),1048576,0)|0);
 $684 = tempRet0;
 $685 = (_bitshift64Ashr(($683|0),($684|0),21)|0);
 $686 = tempRet0;
 $687 = $24;
 $688 = $687;
 HEAP32[$688>>2] = $685;
 $689 = (($687) + 4)|0;
 $690 = $689;
 HEAP32[$690>>2] = $686;
 $691 = $24;
 $692 = $691;
 $693 = HEAP32[$692>>2]|0;
 $694 = (($691) + 4)|0;
 $695 = $694;
 $696 = HEAP32[$695>>2]|0;
 $697 = $12;
 $698 = $697;
 $699 = HEAP32[$698>>2]|0;
 $700 = (($697) + 4)|0;
 $701 = $700;
 $702 = HEAP32[$701>>2]|0;
 $703 = (_i64Add(($699|0),($702|0),($693|0),($696|0))|0);
 $704 = tempRet0;
 $705 = $12;
 $706 = $705;
 HEAP32[$706>>2] = $703;
 $707 = (($705) + 4)|0;
 $708 = $707;
 HEAP32[$708>>2] = $704;
 $709 = $24;
 $710 = $709;
 $711 = HEAP32[$710>>2]|0;
 $712 = (($709) + 4)|0;
 $713 = $712;
 $714 = HEAP32[$713>>2]|0;
 $715 = (_bitshift64Shl(($711|0),($714|0),21)|0);
 $716 = tempRet0;
 $717 = $11;
 $718 = $717;
 $719 = HEAP32[$718>>2]|0;
 $720 = (($717) + 4)|0;
 $721 = $720;
 $722 = HEAP32[$721>>2]|0;
 $723 = (_i64Subtract(($719|0),($722|0),($715|0),($716|0))|0);
 $724 = tempRet0;
 $725 = $11;
 $726 = $725;
 HEAP32[$726>>2] = $723;
 $727 = (($725) + 4)|0;
 $728 = $727;
 HEAP32[$728>>2] = $724;
 $729 = $13;
 $730 = $729;
 $731 = HEAP32[$730>>2]|0;
 $732 = (($729) + 4)|0;
 $733 = $732;
 $734 = HEAP32[$733>>2]|0;
 $735 = (_i64Add(($731|0),($734|0),1048576,0)|0);
 $736 = tempRet0;
 $737 = (_bitshift64Ashr(($735|0),($736|0),21)|0);
 $738 = tempRet0;
 $739 = $26;
 $740 = $739;
 HEAP32[$740>>2] = $737;
 $741 = (($739) + 4)|0;
 $742 = $741;
 HEAP32[$742>>2] = $738;
 $743 = $26;
 $744 = $743;
 $745 = HEAP32[$744>>2]|0;
 $746 = (($743) + 4)|0;
 $747 = $746;
 $748 = HEAP32[$747>>2]|0;
 $749 = $14;
 $750 = $749;
 $751 = HEAP32[$750>>2]|0;
 $752 = (($749) + 4)|0;
 $753 = $752;
 $754 = HEAP32[$753>>2]|0;
 $755 = (_i64Add(($751|0),($754|0),($745|0),($748|0))|0);
 $756 = tempRet0;
 $757 = $14;
 $758 = $757;
 HEAP32[$758>>2] = $755;
 $759 = (($757) + 4)|0;
 $760 = $759;
 HEAP32[$760>>2] = $756;
 $761 = $26;
 $762 = $761;
 $763 = HEAP32[$762>>2]|0;
 $764 = (($761) + 4)|0;
 $765 = $764;
 $766 = HEAP32[$765>>2]|0;
 $767 = (_bitshift64Shl(($763|0),($766|0),21)|0);
 $768 = tempRet0;
 $769 = $13;
 $770 = $769;
 $771 = HEAP32[$770>>2]|0;
 $772 = (($769) + 4)|0;
 $773 = $772;
 $774 = HEAP32[$773>>2]|0;
 $775 = (_i64Subtract(($771|0),($774|0),($767|0),($768|0))|0);
 $776 = tempRet0;
 $777 = $13;
 $778 = $777;
 HEAP32[$778>>2] = $775;
 $779 = (($777) + 4)|0;
 $780 = $779;
 HEAP32[$780>>2] = $776;
 $781 = $14;
 $782 = $781;
 $783 = HEAP32[$782>>2]|0;
 $784 = (($781) + 4)|0;
 $785 = $784;
 $786 = HEAP32[$785>>2]|0;
 $787 = (___muldi3(($783|0),($786|0),666643,0)|0);
 $788 = tempRet0;
 $789 = $2;
 $790 = $789;
 $791 = HEAP32[$790>>2]|0;
 $792 = (($789) + 4)|0;
 $793 = $792;
 $794 = HEAP32[$793>>2]|0;
 $795 = (_i64Add(($791|0),($794|0),($787|0),($788|0))|0);
 $796 = tempRet0;
 $797 = $2;
 $798 = $797;
 HEAP32[$798>>2] = $795;
 $799 = (($797) + 4)|0;
 $800 = $799;
 HEAP32[$800>>2] = $796;
 $801 = $14;
 $802 = $801;
 $803 = HEAP32[$802>>2]|0;
 $804 = (($801) + 4)|0;
 $805 = $804;
 $806 = HEAP32[$805>>2]|0;
 $807 = (___muldi3(($803|0),($806|0),470296,0)|0);
 $808 = tempRet0;
 $809 = $3;
 $810 = $809;
 $811 = HEAP32[$810>>2]|0;
 $812 = (($809) + 4)|0;
 $813 = $812;
 $814 = HEAP32[$813>>2]|0;
 $815 = (_i64Add(($811|0),($814|0),($807|0),($808|0))|0);
 $816 = tempRet0;
 $817 = $3;
 $818 = $817;
 HEAP32[$818>>2] = $815;
 $819 = (($817) + 4)|0;
 $820 = $819;
 HEAP32[$820>>2] = $816;
 $821 = $14;
 $822 = $821;
 $823 = HEAP32[$822>>2]|0;
 $824 = (($821) + 4)|0;
 $825 = $824;
 $826 = HEAP32[$825>>2]|0;
 $827 = (___muldi3(($823|0),($826|0),654183,0)|0);
 $828 = tempRet0;
 $829 = $4;
 $830 = $829;
 $831 = HEAP32[$830>>2]|0;
 $832 = (($829) + 4)|0;
 $833 = $832;
 $834 = HEAP32[$833>>2]|0;
 $835 = (_i64Add(($831|0),($834|0),($827|0),($828|0))|0);
 $836 = tempRet0;
 $837 = $4;
 $838 = $837;
 HEAP32[$838>>2] = $835;
 $839 = (($837) + 4)|0;
 $840 = $839;
 HEAP32[$840>>2] = $836;
 $841 = $14;
 $842 = $841;
 $843 = HEAP32[$842>>2]|0;
 $844 = (($841) + 4)|0;
 $845 = $844;
 $846 = HEAP32[$845>>2]|0;
 $847 = (___muldi3(($843|0),($846|0),997805,0)|0);
 $848 = tempRet0;
 $849 = $5;
 $850 = $849;
 $851 = HEAP32[$850>>2]|0;
 $852 = (($849) + 4)|0;
 $853 = $852;
 $854 = HEAP32[$853>>2]|0;
 $855 = (_i64Subtract(($851|0),($854|0),($847|0),($848|0))|0);
 $856 = tempRet0;
 $857 = $5;
 $858 = $857;
 HEAP32[$858>>2] = $855;
 $859 = (($857) + 4)|0;
 $860 = $859;
 HEAP32[$860>>2] = $856;
 $861 = $14;
 $862 = $861;
 $863 = HEAP32[$862>>2]|0;
 $864 = (($861) + 4)|0;
 $865 = $864;
 $866 = HEAP32[$865>>2]|0;
 $867 = (___muldi3(($863|0),($866|0),136657,0)|0);
 $868 = tempRet0;
 $869 = $6;
 $870 = $869;
 $871 = HEAP32[$870>>2]|0;
 $872 = (($869) + 4)|0;
 $873 = $872;
 $874 = HEAP32[$873>>2]|0;
 $875 = (_i64Add(($871|0),($874|0),($867|0),($868|0))|0);
 $876 = tempRet0;
 $877 = $6;
 $878 = $877;
 HEAP32[$878>>2] = $875;
 $879 = (($877) + 4)|0;
 $880 = $879;
 HEAP32[$880>>2] = $876;
 $881 = $14;
 $882 = $881;
 $883 = HEAP32[$882>>2]|0;
 $884 = (($881) + 4)|0;
 $885 = $884;
 $886 = HEAP32[$885>>2]|0;
 $887 = (___muldi3(($883|0),($886|0),683901,0)|0);
 $888 = tempRet0;
 $889 = $7;
 $890 = $889;
 $891 = HEAP32[$890>>2]|0;
 $892 = (($889) + 4)|0;
 $893 = $892;
 $894 = HEAP32[$893>>2]|0;
 $895 = (_i64Subtract(($891|0),($894|0),($887|0),($888|0))|0);
 $896 = tempRet0;
 $897 = $7;
 $898 = $897;
 HEAP32[$898>>2] = $895;
 $899 = (($897) + 4)|0;
 $900 = $899;
 HEAP32[$900>>2] = $896;
 $901 = $14;
 $902 = $901;
 HEAP32[$902>>2] = 0;
 $903 = (($901) + 4)|0;
 $904 = $903;
 HEAP32[$904>>2] = 0;
 $905 = $2;
 $906 = $905;
 $907 = HEAP32[$906>>2]|0;
 $908 = (($905) + 4)|0;
 $909 = $908;
 $910 = HEAP32[$909>>2]|0;
 $911 = (_bitshift64Ashr(($907|0),($910|0),21)|0);
 $912 = tempRet0;
 $913 = $15;
 $914 = $913;
 HEAP32[$914>>2] = $911;
 $915 = (($913) + 4)|0;
 $916 = $915;
 HEAP32[$916>>2] = $912;
 $917 = $15;
 $918 = $917;
 $919 = HEAP32[$918>>2]|0;
 $920 = (($917) + 4)|0;
 $921 = $920;
 $922 = HEAP32[$921>>2]|0;
 $923 = $3;
 $924 = $923;
 $925 = HEAP32[$924>>2]|0;
 $926 = (($923) + 4)|0;
 $927 = $926;
 $928 = HEAP32[$927>>2]|0;
 $929 = (_i64Add(($925|0),($928|0),($919|0),($922|0))|0);
 $930 = tempRet0;
 $931 = $3;
 $932 = $931;
 HEAP32[$932>>2] = $929;
 $933 = (($931) + 4)|0;
 $934 = $933;
 HEAP32[$934>>2] = $930;
 $935 = $15;
 $936 = $935;
 $937 = HEAP32[$936>>2]|0;
 $938 = (($935) + 4)|0;
 $939 = $938;
 $940 = HEAP32[$939>>2]|0;
 $941 = (_bitshift64Shl(($937|0),($940|0),21)|0);
 $942 = tempRet0;
 $943 = $2;
 $944 = $943;
 $945 = HEAP32[$944>>2]|0;
 $946 = (($943) + 4)|0;
 $947 = $946;
 $948 = HEAP32[$947>>2]|0;
 $949 = (_i64Subtract(($945|0),($948|0),($941|0),($942|0))|0);
 $950 = tempRet0;
 $951 = $2;
 $952 = $951;
 HEAP32[$952>>2] = $949;
 $953 = (($951) + 4)|0;
 $954 = $953;
 HEAP32[$954>>2] = $950;
 $955 = $3;
 $956 = $955;
 $957 = HEAP32[$956>>2]|0;
 $958 = (($955) + 4)|0;
 $959 = $958;
 $960 = HEAP32[$959>>2]|0;
 $961 = (_bitshift64Ashr(($957|0),($960|0),21)|0);
 $962 = tempRet0;
 $963 = $16;
 $964 = $963;
 HEAP32[$964>>2] = $961;
 $965 = (($963) + 4)|0;
 $966 = $965;
 HEAP32[$966>>2] = $962;
 $967 = $16;
 $968 = $967;
 $969 = HEAP32[$968>>2]|0;
 $970 = (($967) + 4)|0;
 $971 = $970;
 $972 = HEAP32[$971>>2]|0;
 $973 = $4;
 $974 = $973;
 $975 = HEAP32[$974>>2]|0;
 $976 = (($973) + 4)|0;
 $977 = $976;
 $978 = HEAP32[$977>>2]|0;
 $979 = (_i64Add(($975|0),($978|0),($969|0),($972|0))|0);
 $980 = tempRet0;
 $981 = $4;
 $982 = $981;
 HEAP32[$982>>2] = $979;
 $983 = (($981) + 4)|0;
 $984 = $983;
 HEAP32[$984>>2] = $980;
 $985 = $16;
 $986 = $985;
 $987 = HEAP32[$986>>2]|0;
 $988 = (($985) + 4)|0;
 $989 = $988;
 $990 = HEAP32[$989>>2]|0;
 $991 = (_bitshift64Shl(($987|0),($990|0),21)|0);
 $992 = tempRet0;
 $993 = $3;
 $994 = $993;
 $995 = HEAP32[$994>>2]|0;
 $996 = (($993) + 4)|0;
 $997 = $996;
 $998 = HEAP32[$997>>2]|0;
 $999 = (_i64Subtract(($995|0),($998|0),($991|0),($992|0))|0);
 $1000 = tempRet0;
 $1001 = $3;
 $1002 = $1001;
 HEAP32[$1002>>2] = $999;
 $1003 = (($1001) + 4)|0;
 $1004 = $1003;
 HEAP32[$1004>>2] = $1000;
 $1005 = $4;
 $1006 = $1005;
 $1007 = HEAP32[$1006>>2]|0;
 $1008 = (($1005) + 4)|0;
 $1009 = $1008;
 $1010 = HEAP32[$1009>>2]|0;
 $1011 = (_bitshift64Ashr(($1007|0),($1010|0),21)|0);
 $1012 = tempRet0;
 $1013 = $17;
 $1014 = $1013;
 HEAP32[$1014>>2] = $1011;
 $1015 = (($1013) + 4)|0;
 $1016 = $1015;
 HEAP32[$1016>>2] = $1012;
 $1017 = $17;
 $1018 = $1017;
 $1019 = HEAP32[$1018>>2]|0;
 $1020 = (($1017) + 4)|0;
 $1021 = $1020;
 $1022 = HEAP32[$1021>>2]|0;
 $1023 = $5;
 $1024 = $1023;
 $1025 = HEAP32[$1024>>2]|0;
 $1026 = (($1023) + 4)|0;
 $1027 = $1026;
 $1028 = HEAP32[$1027>>2]|0;
 $1029 = (_i64Add(($1025|0),($1028|0),($1019|0),($1022|0))|0);
 $1030 = tempRet0;
 $1031 = $5;
 $1032 = $1031;
 HEAP32[$1032>>2] = $1029;
 $1033 = (($1031) + 4)|0;
 $1034 = $1033;
 HEAP32[$1034>>2] = $1030;
 $1035 = $17;
 $1036 = $1035;
 $1037 = HEAP32[$1036>>2]|0;
 $1038 = (($1035) + 4)|0;
 $1039 = $1038;
 $1040 = HEAP32[$1039>>2]|0;
 $1041 = (_bitshift64Shl(($1037|0),($1040|0),21)|0);
 $1042 = tempRet0;
 $1043 = $4;
 $1044 = $1043;
 $1045 = HEAP32[$1044>>2]|0;
 $1046 = (($1043) + 4)|0;
 $1047 = $1046;
 $1048 = HEAP32[$1047>>2]|0;
 $1049 = (_i64Subtract(($1045|0),($1048|0),($1041|0),($1042|0))|0);
 $1050 = tempRet0;
 $1051 = $4;
 $1052 = $1051;
 HEAP32[$1052>>2] = $1049;
 $1053 = (($1051) + 4)|0;
 $1054 = $1053;
 HEAP32[$1054>>2] = $1050;
 $1055 = $5;
 $1056 = $1055;
 $1057 = HEAP32[$1056>>2]|0;
 $1058 = (($1055) + 4)|0;
 $1059 = $1058;
 $1060 = HEAP32[$1059>>2]|0;
 $1061 = (_bitshift64Ashr(($1057|0),($1060|0),21)|0);
 $1062 = tempRet0;
 $1063 = $18;
 $1064 = $1063;
 HEAP32[$1064>>2] = $1061;
 $1065 = (($1063) + 4)|0;
 $1066 = $1065;
 HEAP32[$1066>>2] = $1062;
 $1067 = $18;
 $1068 = $1067;
 $1069 = HEAP32[$1068>>2]|0;
 $1070 = (($1067) + 4)|0;
 $1071 = $1070;
 $1072 = HEAP32[$1071>>2]|0;
 $1073 = $6;
 $1074 = $1073;
 $1075 = HEAP32[$1074>>2]|0;
 $1076 = (($1073) + 4)|0;
 $1077 = $1076;
 $1078 = HEAP32[$1077>>2]|0;
 $1079 = (_i64Add(($1075|0),($1078|0),($1069|0),($1072|0))|0);
 $1080 = tempRet0;
 $1081 = $6;
 $1082 = $1081;
 HEAP32[$1082>>2] = $1079;
 $1083 = (($1081) + 4)|0;
 $1084 = $1083;
 HEAP32[$1084>>2] = $1080;
 $1085 = $18;
 $1086 = $1085;
 $1087 = HEAP32[$1086>>2]|0;
 $1088 = (($1085) + 4)|0;
 $1089 = $1088;
 $1090 = HEAP32[$1089>>2]|0;
 $1091 = (_bitshift64Shl(($1087|0),($1090|0),21)|0);
 $1092 = tempRet0;
 $1093 = $5;
 $1094 = $1093;
 $1095 = HEAP32[$1094>>2]|0;
 $1096 = (($1093) + 4)|0;
 $1097 = $1096;
 $1098 = HEAP32[$1097>>2]|0;
 $1099 = (_i64Subtract(($1095|0),($1098|0),($1091|0),($1092|0))|0);
 $1100 = tempRet0;
 $1101 = $5;
 $1102 = $1101;
 HEAP32[$1102>>2] = $1099;
 $1103 = (($1101) + 4)|0;
 $1104 = $1103;
 HEAP32[$1104>>2] = $1100;
 $1105 = $6;
 $1106 = $1105;
 $1107 = HEAP32[$1106>>2]|0;
 $1108 = (($1105) + 4)|0;
 $1109 = $1108;
 $1110 = HEAP32[$1109>>2]|0;
 $1111 = (_bitshift64Ashr(($1107|0),($1110|0),21)|0);
 $1112 = tempRet0;
 $1113 = $19;
 $1114 = $1113;
 HEAP32[$1114>>2] = $1111;
 $1115 = (($1113) + 4)|0;
 $1116 = $1115;
 HEAP32[$1116>>2] = $1112;
 $1117 = $19;
 $1118 = $1117;
 $1119 = HEAP32[$1118>>2]|0;
 $1120 = (($1117) + 4)|0;
 $1121 = $1120;
 $1122 = HEAP32[$1121>>2]|0;
 $1123 = $7;
 $1124 = $1123;
 $1125 = HEAP32[$1124>>2]|0;
 $1126 = (($1123) + 4)|0;
 $1127 = $1126;
 $1128 = HEAP32[$1127>>2]|0;
 $1129 = (_i64Add(($1125|0),($1128|0),($1119|0),($1122|0))|0);
 $1130 = tempRet0;
 $1131 = $7;
 $1132 = $1131;
 HEAP32[$1132>>2] = $1129;
 $1133 = (($1131) + 4)|0;
 $1134 = $1133;
 HEAP32[$1134>>2] = $1130;
 $1135 = $19;
 $1136 = $1135;
 $1137 = HEAP32[$1136>>2]|0;
 $1138 = (($1135) + 4)|0;
 $1139 = $1138;
 $1140 = HEAP32[$1139>>2]|0;
 $1141 = (_bitshift64Shl(($1137|0),($1140|0),21)|0);
 $1142 = tempRet0;
 $1143 = $6;
 $1144 = $1143;
 $1145 = HEAP32[$1144>>2]|0;
 $1146 = (($1143) + 4)|0;
 $1147 = $1146;
 $1148 = HEAP32[$1147>>2]|0;
 $1149 = (_i64Subtract(($1145|0),($1148|0),($1141|0),($1142|0))|0);
 $1150 = tempRet0;
 $1151 = $6;
 $1152 = $1151;
 HEAP32[$1152>>2] = $1149;
 $1153 = (($1151) + 4)|0;
 $1154 = $1153;
 HEAP32[$1154>>2] = $1150;
 $1155 = $7;
 $1156 = $1155;
 $1157 = HEAP32[$1156>>2]|0;
 $1158 = (($1155) + 4)|0;
 $1159 = $1158;
 $1160 = HEAP32[$1159>>2]|0;
 $1161 = (_bitshift64Ashr(($1157|0),($1160|0),21)|0);
 $1162 = tempRet0;
 $1163 = $20;
 $1164 = $1163;
 HEAP32[$1164>>2] = $1161;
 $1165 = (($1163) + 4)|0;
 $1166 = $1165;
 HEAP32[$1166>>2] = $1162;
 $1167 = $20;
 $1168 = $1167;
 $1169 = HEAP32[$1168>>2]|0;
 $1170 = (($1167) + 4)|0;
 $1171 = $1170;
 $1172 = HEAP32[$1171>>2]|0;
 $1173 = $8;
 $1174 = $1173;
 $1175 = HEAP32[$1174>>2]|0;
 $1176 = (($1173) + 4)|0;
 $1177 = $1176;
 $1178 = HEAP32[$1177>>2]|0;
 $1179 = (_i64Add(($1175|0),($1178|0),($1169|0),($1172|0))|0);
 $1180 = tempRet0;
 $1181 = $8;
 $1182 = $1181;
 HEAP32[$1182>>2] = $1179;
 $1183 = (($1181) + 4)|0;
 $1184 = $1183;
 HEAP32[$1184>>2] = $1180;
 $1185 = $20;
 $1186 = $1185;
 $1187 = HEAP32[$1186>>2]|0;
 $1188 = (($1185) + 4)|0;
 $1189 = $1188;
 $1190 = HEAP32[$1189>>2]|0;
 $1191 = (_bitshift64Shl(($1187|0),($1190|0),21)|0);
 $1192 = tempRet0;
 $1193 = $7;
 $1194 = $1193;
 $1195 = HEAP32[$1194>>2]|0;
 $1196 = (($1193) + 4)|0;
 $1197 = $1196;
 $1198 = HEAP32[$1197>>2]|0;
 $1199 = (_i64Subtract(($1195|0),($1198|0),($1191|0),($1192|0))|0);
 $1200 = tempRet0;
 $1201 = $7;
 $1202 = $1201;
 HEAP32[$1202>>2] = $1199;
 $1203 = (($1201) + 4)|0;
 $1204 = $1203;
 HEAP32[$1204>>2] = $1200;
 $1205 = $8;
 $1206 = $1205;
 $1207 = HEAP32[$1206>>2]|0;
 $1208 = (($1205) + 4)|0;
 $1209 = $1208;
 $1210 = HEAP32[$1209>>2]|0;
 $1211 = (_bitshift64Ashr(($1207|0),($1210|0),21)|0);
 $1212 = tempRet0;
 $1213 = $21;
 $1214 = $1213;
 HEAP32[$1214>>2] = $1211;
 $1215 = (($1213) + 4)|0;
 $1216 = $1215;
 HEAP32[$1216>>2] = $1212;
 $1217 = $21;
 $1218 = $1217;
 $1219 = HEAP32[$1218>>2]|0;
 $1220 = (($1217) + 4)|0;
 $1221 = $1220;
 $1222 = HEAP32[$1221>>2]|0;
 $1223 = $9;
 $1224 = $1223;
 $1225 = HEAP32[$1224>>2]|0;
 $1226 = (($1223) + 4)|0;
 $1227 = $1226;
 $1228 = HEAP32[$1227>>2]|0;
 $1229 = (_i64Add(($1225|0),($1228|0),($1219|0),($1222|0))|0);
 $1230 = tempRet0;
 $1231 = $9;
 $1232 = $1231;
 HEAP32[$1232>>2] = $1229;
 $1233 = (($1231) + 4)|0;
 $1234 = $1233;
 HEAP32[$1234>>2] = $1230;
 $1235 = $21;
 $1236 = $1235;
 $1237 = HEAP32[$1236>>2]|0;
 $1238 = (($1235) + 4)|0;
 $1239 = $1238;
 $1240 = HEAP32[$1239>>2]|0;
 $1241 = (_bitshift64Shl(($1237|0),($1240|0),21)|0);
 $1242 = tempRet0;
 $1243 = $8;
 $1244 = $1243;
 $1245 = HEAP32[$1244>>2]|0;
 $1246 = (($1243) + 4)|0;
 $1247 = $1246;
 $1248 = HEAP32[$1247>>2]|0;
 $1249 = (_i64Subtract(($1245|0),($1248|0),($1241|0),($1242|0))|0);
 $1250 = tempRet0;
 $1251 = $8;
 $1252 = $1251;
 HEAP32[$1252>>2] = $1249;
 $1253 = (($1251) + 4)|0;
 $1254 = $1253;
 HEAP32[$1254>>2] = $1250;
 $1255 = $9;
 $1256 = $1255;
 $1257 = HEAP32[$1256>>2]|0;
 $1258 = (($1255) + 4)|0;
 $1259 = $1258;
 $1260 = HEAP32[$1259>>2]|0;
 $1261 = (_bitshift64Ashr(($1257|0),($1260|0),21)|0);
 $1262 = tempRet0;
 $1263 = $22;
 $1264 = $1263;
 HEAP32[$1264>>2] = $1261;
 $1265 = (($1263) + 4)|0;
 $1266 = $1265;
 HEAP32[$1266>>2] = $1262;
 $1267 = $22;
 $1268 = $1267;
 $1269 = HEAP32[$1268>>2]|0;
 $1270 = (($1267) + 4)|0;
 $1271 = $1270;
 $1272 = HEAP32[$1271>>2]|0;
 $1273 = $10;
 $1274 = $1273;
 $1275 = HEAP32[$1274>>2]|0;
 $1276 = (($1273) + 4)|0;
 $1277 = $1276;
 $1278 = HEAP32[$1277>>2]|0;
 $1279 = (_i64Add(($1275|0),($1278|0),($1269|0),($1272|0))|0);
 $1280 = tempRet0;
 $1281 = $10;
 $1282 = $1281;
 HEAP32[$1282>>2] = $1279;
 $1283 = (($1281) + 4)|0;
 $1284 = $1283;
 HEAP32[$1284>>2] = $1280;
 $1285 = $22;
 $1286 = $1285;
 $1287 = HEAP32[$1286>>2]|0;
 $1288 = (($1285) + 4)|0;
 $1289 = $1288;
 $1290 = HEAP32[$1289>>2]|0;
 $1291 = (_bitshift64Shl(($1287|0),($1290|0),21)|0);
 $1292 = tempRet0;
 $1293 = $9;
 $1294 = $1293;
 $1295 = HEAP32[$1294>>2]|0;
 $1296 = (($1293) + 4)|0;
 $1297 = $1296;
 $1298 = HEAP32[$1297>>2]|0;
 $1299 = (_i64Subtract(($1295|0),($1298|0),($1291|0),($1292|0))|0);
 $1300 = tempRet0;
 $1301 = $9;
 $1302 = $1301;
 HEAP32[$1302>>2] = $1299;
 $1303 = (($1301) + 4)|0;
 $1304 = $1303;
 HEAP32[$1304>>2] = $1300;
 $1305 = $10;
 $1306 = $1305;
 $1307 = HEAP32[$1306>>2]|0;
 $1308 = (($1305) + 4)|0;
 $1309 = $1308;
 $1310 = HEAP32[$1309>>2]|0;
 $1311 = (_bitshift64Ashr(($1307|0),($1310|0),21)|0);
 $1312 = tempRet0;
 $1313 = $23;
 $1314 = $1313;
 HEAP32[$1314>>2] = $1311;
 $1315 = (($1313) + 4)|0;
 $1316 = $1315;
 HEAP32[$1316>>2] = $1312;
 $1317 = $23;
 $1318 = $1317;
 $1319 = HEAP32[$1318>>2]|0;
 $1320 = (($1317) + 4)|0;
 $1321 = $1320;
 $1322 = HEAP32[$1321>>2]|0;
 $1323 = $11;
 $1324 = $1323;
 $1325 = HEAP32[$1324>>2]|0;
 $1326 = (($1323) + 4)|0;
 $1327 = $1326;
 $1328 = HEAP32[$1327>>2]|0;
 $1329 = (_i64Add(($1325|0),($1328|0),($1319|0),($1322|0))|0);
 $1330 = tempRet0;
 $1331 = $11;
 $1332 = $1331;
 HEAP32[$1332>>2] = $1329;
 $1333 = (($1331) + 4)|0;
 $1334 = $1333;
 HEAP32[$1334>>2] = $1330;
 $1335 = $23;
 $1336 = $1335;
 $1337 = HEAP32[$1336>>2]|0;
 $1338 = (($1335) + 4)|0;
 $1339 = $1338;
 $1340 = HEAP32[$1339>>2]|0;
 $1341 = (_bitshift64Shl(($1337|0),($1340|0),21)|0);
 $1342 = tempRet0;
 $1343 = $10;
 $1344 = $1343;
 $1345 = HEAP32[$1344>>2]|0;
 $1346 = (($1343) + 4)|0;
 $1347 = $1346;
 $1348 = HEAP32[$1347>>2]|0;
 $1349 = (_i64Subtract(($1345|0),($1348|0),($1341|0),($1342|0))|0);
 $1350 = tempRet0;
 $1351 = $10;
 $1352 = $1351;
 HEAP32[$1352>>2] = $1349;
 $1353 = (($1351) + 4)|0;
 $1354 = $1353;
 HEAP32[$1354>>2] = $1350;
 $1355 = $11;
 $1356 = $1355;
 $1357 = HEAP32[$1356>>2]|0;
 $1358 = (($1355) + 4)|0;
 $1359 = $1358;
 $1360 = HEAP32[$1359>>2]|0;
 $1361 = (_bitshift64Ashr(($1357|0),($1360|0),21)|0);
 $1362 = tempRet0;
 $1363 = $24;
 $1364 = $1363;
 HEAP32[$1364>>2] = $1361;
 $1365 = (($1363) + 4)|0;
 $1366 = $1365;
 HEAP32[$1366>>2] = $1362;
 $1367 = $24;
 $1368 = $1367;
 $1369 = HEAP32[$1368>>2]|0;
 $1370 = (($1367) + 4)|0;
 $1371 = $1370;
 $1372 = HEAP32[$1371>>2]|0;
 $1373 = $12;
 $1374 = $1373;
 $1375 = HEAP32[$1374>>2]|0;
 $1376 = (($1373) + 4)|0;
 $1377 = $1376;
 $1378 = HEAP32[$1377>>2]|0;
 $1379 = (_i64Add(($1375|0),($1378|0),($1369|0),($1372|0))|0);
 $1380 = tempRet0;
 $1381 = $12;
 $1382 = $1381;
 HEAP32[$1382>>2] = $1379;
 $1383 = (($1381) + 4)|0;
 $1384 = $1383;
 HEAP32[$1384>>2] = $1380;
 $1385 = $24;
 $1386 = $1385;
 $1387 = HEAP32[$1386>>2]|0;
 $1388 = (($1385) + 4)|0;
 $1389 = $1388;
 $1390 = HEAP32[$1389>>2]|0;
 $1391 = (_bitshift64Shl(($1387|0),($1390|0),21)|0);
 $1392 = tempRet0;
 $1393 = $11;
 $1394 = $1393;
 $1395 = HEAP32[$1394>>2]|0;
 $1396 = (($1393) + 4)|0;
 $1397 = $1396;
 $1398 = HEAP32[$1397>>2]|0;
 $1399 = (_i64Subtract(($1395|0),($1398|0),($1391|0),($1392|0))|0);
 $1400 = tempRet0;
 $1401 = $11;
 $1402 = $1401;
 HEAP32[$1402>>2] = $1399;
 $1403 = (($1401) + 4)|0;
 $1404 = $1403;
 HEAP32[$1404>>2] = $1400;
 $1405 = $12;
 $1406 = $1405;
 $1407 = HEAP32[$1406>>2]|0;
 $1408 = (($1405) + 4)|0;
 $1409 = $1408;
 $1410 = HEAP32[$1409>>2]|0;
 $1411 = (_bitshift64Ashr(($1407|0),($1410|0),21)|0);
 $1412 = tempRet0;
 $1413 = $25;
 $1414 = $1413;
 HEAP32[$1414>>2] = $1411;
 $1415 = (($1413) + 4)|0;
 $1416 = $1415;
 HEAP32[$1416>>2] = $1412;
 $1417 = $25;
 $1418 = $1417;
 $1419 = HEAP32[$1418>>2]|0;
 $1420 = (($1417) + 4)|0;
 $1421 = $1420;
 $1422 = HEAP32[$1421>>2]|0;
 $1423 = $13;
 $1424 = $1423;
 $1425 = HEAP32[$1424>>2]|0;
 $1426 = (($1423) + 4)|0;
 $1427 = $1426;
 $1428 = HEAP32[$1427>>2]|0;
 $1429 = (_i64Add(($1425|0),($1428|0),($1419|0),($1422|0))|0);
 $1430 = tempRet0;
 $1431 = $13;
 $1432 = $1431;
 HEAP32[$1432>>2] = $1429;
 $1433 = (($1431) + 4)|0;
 $1434 = $1433;
 HEAP32[$1434>>2] = $1430;
 $1435 = $25;
 $1436 = $1435;
 $1437 = HEAP32[$1436>>2]|0;
 $1438 = (($1435) + 4)|0;
 $1439 = $1438;
 $1440 = HEAP32[$1439>>2]|0;
 $1441 = (_bitshift64Shl(($1437|0),($1440|0),21)|0);
 $1442 = tempRet0;
 $1443 = $12;
 $1444 = $1443;
 $1445 = HEAP32[$1444>>2]|0;
 $1446 = (($1443) + 4)|0;
 $1447 = $1446;
 $1448 = HEAP32[$1447>>2]|0;
 $1449 = (_i64Subtract(($1445|0),($1448|0),($1441|0),($1442|0))|0);
 $1450 = tempRet0;
 $1451 = $12;
 $1452 = $1451;
 HEAP32[$1452>>2] = $1449;
 $1453 = (($1451) + 4)|0;
 $1454 = $1453;
 HEAP32[$1454>>2] = $1450;
 $1455 = $13;
 $1456 = $1455;
 $1457 = HEAP32[$1456>>2]|0;
 $1458 = (($1455) + 4)|0;
 $1459 = $1458;
 $1460 = HEAP32[$1459>>2]|0;
 $1461 = (_bitshift64Ashr(($1457|0),($1460|0),21)|0);
 $1462 = tempRet0;
 $1463 = $26;
 $1464 = $1463;
 HEAP32[$1464>>2] = $1461;
 $1465 = (($1463) + 4)|0;
 $1466 = $1465;
 HEAP32[$1466>>2] = $1462;
 $1467 = $26;
 $1468 = $1467;
 $1469 = HEAP32[$1468>>2]|0;
 $1470 = (($1467) + 4)|0;
 $1471 = $1470;
 $1472 = HEAP32[$1471>>2]|0;
 $1473 = $14;
 $1474 = $1473;
 $1475 = HEAP32[$1474>>2]|0;
 $1476 = (($1473) + 4)|0;
 $1477 = $1476;
 $1478 = HEAP32[$1477>>2]|0;
 $1479 = (_i64Add(($1475|0),($1478|0),($1469|0),($1472|0))|0);
 $1480 = tempRet0;
 $1481 = $14;
 $1482 = $1481;
 HEAP32[$1482>>2] = $1479;
 $1483 = (($1481) + 4)|0;
 $1484 = $1483;
 HEAP32[$1484>>2] = $1480;
 $1485 = $26;
 $1486 = $1485;
 $1487 = HEAP32[$1486>>2]|0;
 $1488 = (($1485) + 4)|0;
 $1489 = $1488;
 $1490 = HEAP32[$1489>>2]|0;
 $1491 = (_bitshift64Shl(($1487|0),($1490|0),21)|0);
 $1492 = tempRet0;
 $1493 = $13;
 $1494 = $1493;
 $1495 = HEAP32[$1494>>2]|0;
 $1496 = (($1493) + 4)|0;
 $1497 = $1496;
 $1498 = HEAP32[$1497>>2]|0;
 $1499 = (_i64Subtract(($1495|0),($1498|0),($1491|0),($1492|0))|0);
 $1500 = tempRet0;
 $1501 = $13;
 $1502 = $1501;
 HEAP32[$1502>>2] = $1499;
 $1503 = (($1501) + 4)|0;
 $1504 = $1503;
 HEAP32[$1504>>2] = $1500;
 $1505 = $14;
 $1506 = $1505;
 $1507 = HEAP32[$1506>>2]|0;
 $1508 = (($1505) + 4)|0;
 $1509 = $1508;
 $1510 = HEAP32[$1509>>2]|0;
 $1511 = (___muldi3(($1507|0),($1510|0),666643,0)|0);
 $1512 = tempRet0;
 $1513 = $2;
 $1514 = $1513;
 $1515 = HEAP32[$1514>>2]|0;
 $1516 = (($1513) + 4)|0;
 $1517 = $1516;
 $1518 = HEAP32[$1517>>2]|0;
 $1519 = (_i64Add(($1515|0),($1518|0),($1511|0),($1512|0))|0);
 $1520 = tempRet0;
 $1521 = $2;
 $1522 = $1521;
 HEAP32[$1522>>2] = $1519;
 $1523 = (($1521) + 4)|0;
 $1524 = $1523;
 HEAP32[$1524>>2] = $1520;
 $1525 = $14;
 $1526 = $1525;
 $1527 = HEAP32[$1526>>2]|0;
 $1528 = (($1525) + 4)|0;
 $1529 = $1528;
 $1530 = HEAP32[$1529>>2]|0;
 $1531 = (___muldi3(($1527|0),($1530|0),470296,0)|0);
 $1532 = tempRet0;
 $1533 = $3;
 $1534 = $1533;
 $1535 = HEAP32[$1534>>2]|0;
 $1536 = (($1533) + 4)|0;
 $1537 = $1536;
 $1538 = HEAP32[$1537>>2]|0;
 $1539 = (_i64Add(($1535|0),($1538|0),($1531|0),($1532|0))|0);
 $1540 = tempRet0;
 $1541 = $3;
 $1542 = $1541;
 HEAP32[$1542>>2] = $1539;
 $1543 = (($1541) + 4)|0;
 $1544 = $1543;
 HEAP32[$1544>>2] = $1540;
 $1545 = $14;
 $1546 = $1545;
 $1547 = HEAP32[$1546>>2]|0;
 $1548 = (($1545) + 4)|0;
 $1549 = $1548;
 $1550 = HEAP32[$1549>>2]|0;
 $1551 = (___muldi3(($1547|0),($1550|0),654183,0)|0);
 $1552 = tempRet0;
 $1553 = $4;
 $1554 = $1553;
 $1555 = HEAP32[$1554>>2]|0;
 $1556 = (($1553) + 4)|0;
 $1557 = $1556;
 $1558 = HEAP32[$1557>>2]|0;
 $1559 = (_i64Add(($1555|0),($1558|0),($1551|0),($1552|0))|0);
 $1560 = tempRet0;
 $1561 = $4;
 $1562 = $1561;
 HEAP32[$1562>>2] = $1559;
 $1563 = (($1561) + 4)|0;
 $1564 = $1563;
 HEAP32[$1564>>2] = $1560;
 $1565 = $14;
 $1566 = $1565;
 $1567 = HEAP32[$1566>>2]|0;
 $1568 = (($1565) + 4)|0;
 $1569 = $1568;
 $1570 = HEAP32[$1569>>2]|0;
 $1571 = (___muldi3(($1567|0),($1570|0),997805,0)|0);
 $1572 = tempRet0;
 $1573 = $5;
 $1574 = $1573;
 $1575 = HEAP32[$1574>>2]|0;
 $1576 = (($1573) + 4)|0;
 $1577 = $1576;
 $1578 = HEAP32[$1577>>2]|0;
 $1579 = (_i64Subtract(($1575|0),($1578|0),($1571|0),($1572|0))|0);
 $1580 = tempRet0;
 $1581 = $5;
 $1582 = $1581;
 HEAP32[$1582>>2] = $1579;
 $1583 = (($1581) + 4)|0;
 $1584 = $1583;
 HEAP32[$1584>>2] = $1580;
 $1585 = $14;
 $1586 = $1585;
 $1587 = HEAP32[$1586>>2]|0;
 $1588 = (($1585) + 4)|0;
 $1589 = $1588;
 $1590 = HEAP32[$1589>>2]|0;
 $1591 = (___muldi3(($1587|0),($1590|0),136657,0)|0);
 $1592 = tempRet0;
 $1593 = $6;
 $1594 = $1593;
 $1595 = HEAP32[$1594>>2]|0;
 $1596 = (($1593) + 4)|0;
 $1597 = $1596;
 $1598 = HEAP32[$1597>>2]|0;
 $1599 = (_i64Add(($1595|0),($1598|0),($1591|0),($1592|0))|0);
 $1600 = tempRet0;
 $1601 = $6;
 $1602 = $1601;
 HEAP32[$1602>>2] = $1599;
 $1603 = (($1601) + 4)|0;
 $1604 = $1603;
 HEAP32[$1604>>2] = $1600;
 $1605 = $14;
 $1606 = $1605;
 $1607 = HEAP32[$1606>>2]|0;
 $1608 = (($1605) + 4)|0;
 $1609 = $1608;
 $1610 = HEAP32[$1609>>2]|0;
 $1611 = (___muldi3(($1607|0),($1610|0),683901,0)|0);
 $1612 = tempRet0;
 $1613 = $7;
 $1614 = $1613;
 $1615 = HEAP32[$1614>>2]|0;
 $1616 = (($1613) + 4)|0;
 $1617 = $1616;
 $1618 = HEAP32[$1617>>2]|0;
 $1619 = (_i64Subtract(($1615|0),($1618|0),($1611|0),($1612|0))|0);
 $1620 = tempRet0;
 $1621 = $7;
 $1622 = $1621;
 HEAP32[$1622>>2] = $1619;
 $1623 = (($1621) + 4)|0;
 $1624 = $1623;
 HEAP32[$1624>>2] = $1620;
 $1625 = $2;
 $1626 = $1625;
 $1627 = HEAP32[$1626>>2]|0;
 $1628 = (($1625) + 4)|0;
 $1629 = $1628;
 $1630 = HEAP32[$1629>>2]|0;
 $1631 = (_bitshift64Ashr(($1627|0),($1630|0),21)|0);
 $1632 = tempRet0;
 $1633 = $15;
 $1634 = $1633;
 HEAP32[$1634>>2] = $1631;
 $1635 = (($1633) + 4)|0;
 $1636 = $1635;
 HEAP32[$1636>>2] = $1632;
 $1637 = $15;
 $1638 = $1637;
 $1639 = HEAP32[$1638>>2]|0;
 $1640 = (($1637) + 4)|0;
 $1641 = $1640;
 $1642 = HEAP32[$1641>>2]|0;
 $1643 = $3;
 $1644 = $1643;
 $1645 = HEAP32[$1644>>2]|0;
 $1646 = (($1643) + 4)|0;
 $1647 = $1646;
 $1648 = HEAP32[$1647>>2]|0;
 $1649 = (_i64Add(($1645|0),($1648|0),($1639|0),($1642|0))|0);
 $1650 = tempRet0;
 $1651 = $3;
 $1652 = $1651;
 HEAP32[$1652>>2] = $1649;
 $1653 = (($1651) + 4)|0;
 $1654 = $1653;
 HEAP32[$1654>>2] = $1650;
 $1655 = $15;
 $1656 = $1655;
 $1657 = HEAP32[$1656>>2]|0;
 $1658 = (($1655) + 4)|0;
 $1659 = $1658;
 $1660 = HEAP32[$1659>>2]|0;
 $1661 = (_bitshift64Shl(($1657|0),($1660|0),21)|0);
 $1662 = tempRet0;
 $1663 = $2;
 $1664 = $1663;
 $1665 = HEAP32[$1664>>2]|0;
 $1666 = (($1663) + 4)|0;
 $1667 = $1666;
 $1668 = HEAP32[$1667>>2]|0;
 $1669 = (_i64Subtract(($1665|0),($1668|0),($1661|0),($1662|0))|0);
 $1670 = tempRet0;
 $1671 = $2;
 $1672 = $1671;
 HEAP32[$1672>>2] = $1669;
 $1673 = (($1671) + 4)|0;
 $1674 = $1673;
 HEAP32[$1674>>2] = $1670;
 $1675 = $3;
 $1676 = $1675;
 $1677 = HEAP32[$1676>>2]|0;
 $1678 = (($1675) + 4)|0;
 $1679 = $1678;
 $1680 = HEAP32[$1679>>2]|0;
 $1681 = (_bitshift64Ashr(($1677|0),($1680|0),21)|0);
 $1682 = tempRet0;
 $1683 = $16;
 $1684 = $1683;
 HEAP32[$1684>>2] = $1681;
 $1685 = (($1683) + 4)|0;
 $1686 = $1685;
 HEAP32[$1686>>2] = $1682;
 $1687 = $16;
 $1688 = $1687;
 $1689 = HEAP32[$1688>>2]|0;
 $1690 = (($1687) + 4)|0;
 $1691 = $1690;
 $1692 = HEAP32[$1691>>2]|0;
 $1693 = $4;
 $1694 = $1693;
 $1695 = HEAP32[$1694>>2]|0;
 $1696 = (($1693) + 4)|0;
 $1697 = $1696;
 $1698 = HEAP32[$1697>>2]|0;
 $1699 = (_i64Add(($1695|0),($1698|0),($1689|0),($1692|0))|0);
 $1700 = tempRet0;
 $1701 = $4;
 $1702 = $1701;
 HEAP32[$1702>>2] = $1699;
 $1703 = (($1701) + 4)|0;
 $1704 = $1703;
 HEAP32[$1704>>2] = $1700;
 $1705 = $16;
 $1706 = $1705;
 $1707 = HEAP32[$1706>>2]|0;
 $1708 = (($1705) + 4)|0;
 $1709 = $1708;
 $1710 = HEAP32[$1709>>2]|0;
 $1711 = (_bitshift64Shl(($1707|0),($1710|0),21)|0);
 $1712 = tempRet0;
 $1713 = $3;
 $1714 = $1713;
 $1715 = HEAP32[$1714>>2]|0;
 $1716 = (($1713) + 4)|0;
 $1717 = $1716;
 $1718 = HEAP32[$1717>>2]|0;
 $1719 = (_i64Subtract(($1715|0),($1718|0),($1711|0),($1712|0))|0);
 $1720 = tempRet0;
 $1721 = $3;
 $1722 = $1721;
 HEAP32[$1722>>2] = $1719;
 $1723 = (($1721) + 4)|0;
 $1724 = $1723;
 HEAP32[$1724>>2] = $1720;
 $1725 = $4;
 $1726 = $1725;
 $1727 = HEAP32[$1726>>2]|0;
 $1728 = (($1725) + 4)|0;
 $1729 = $1728;
 $1730 = HEAP32[$1729>>2]|0;
 $1731 = (_bitshift64Ashr(($1727|0),($1730|0),21)|0);
 $1732 = tempRet0;
 $1733 = $17;
 $1734 = $1733;
 HEAP32[$1734>>2] = $1731;
 $1735 = (($1733) + 4)|0;
 $1736 = $1735;
 HEAP32[$1736>>2] = $1732;
 $1737 = $17;
 $1738 = $1737;
 $1739 = HEAP32[$1738>>2]|0;
 $1740 = (($1737) + 4)|0;
 $1741 = $1740;
 $1742 = HEAP32[$1741>>2]|0;
 $1743 = $5;
 $1744 = $1743;
 $1745 = HEAP32[$1744>>2]|0;
 $1746 = (($1743) + 4)|0;
 $1747 = $1746;
 $1748 = HEAP32[$1747>>2]|0;
 $1749 = (_i64Add(($1745|0),($1748|0),($1739|0),($1742|0))|0);
 $1750 = tempRet0;
 $1751 = $5;
 $1752 = $1751;
 HEAP32[$1752>>2] = $1749;
 $1753 = (($1751) + 4)|0;
 $1754 = $1753;
 HEAP32[$1754>>2] = $1750;
 $1755 = $17;
 $1756 = $1755;
 $1757 = HEAP32[$1756>>2]|0;
 $1758 = (($1755) + 4)|0;
 $1759 = $1758;
 $1760 = HEAP32[$1759>>2]|0;
 $1761 = (_bitshift64Shl(($1757|0),($1760|0),21)|0);
 $1762 = tempRet0;
 $1763 = $4;
 $1764 = $1763;
 $1765 = HEAP32[$1764>>2]|0;
 $1766 = (($1763) + 4)|0;
 $1767 = $1766;
 $1768 = HEAP32[$1767>>2]|0;
 $1769 = (_i64Subtract(($1765|0),($1768|0),($1761|0),($1762|0))|0);
 $1770 = tempRet0;
 $1771 = $4;
 $1772 = $1771;
 HEAP32[$1772>>2] = $1769;
 $1773 = (($1771) + 4)|0;
 $1774 = $1773;
 HEAP32[$1774>>2] = $1770;
 $1775 = $5;
 $1776 = $1775;
 $1777 = HEAP32[$1776>>2]|0;
 $1778 = (($1775) + 4)|0;
 $1779 = $1778;
 $1780 = HEAP32[$1779>>2]|0;
 $1781 = (_bitshift64Ashr(($1777|0),($1780|0),21)|0);
 $1782 = tempRet0;
 $1783 = $18;
 $1784 = $1783;
 HEAP32[$1784>>2] = $1781;
 $1785 = (($1783) + 4)|0;
 $1786 = $1785;
 HEAP32[$1786>>2] = $1782;
 $1787 = $18;
 $1788 = $1787;
 $1789 = HEAP32[$1788>>2]|0;
 $1790 = (($1787) + 4)|0;
 $1791 = $1790;
 $1792 = HEAP32[$1791>>2]|0;
 $1793 = $6;
 $1794 = $1793;
 $1795 = HEAP32[$1794>>2]|0;
 $1796 = (($1793) + 4)|0;
 $1797 = $1796;
 $1798 = HEAP32[$1797>>2]|0;
 $1799 = (_i64Add(($1795|0),($1798|0),($1789|0),($1792|0))|0);
 $1800 = tempRet0;
 $1801 = $6;
 $1802 = $1801;
 HEAP32[$1802>>2] = $1799;
 $1803 = (($1801) + 4)|0;
 $1804 = $1803;
 HEAP32[$1804>>2] = $1800;
 $1805 = $18;
 $1806 = $1805;
 $1807 = HEAP32[$1806>>2]|0;
 $1808 = (($1805) + 4)|0;
 $1809 = $1808;
 $1810 = HEAP32[$1809>>2]|0;
 $1811 = (_bitshift64Shl(($1807|0),($1810|0),21)|0);
 $1812 = tempRet0;
 $1813 = $5;
 $1814 = $1813;
 $1815 = HEAP32[$1814>>2]|0;
 $1816 = (($1813) + 4)|0;
 $1817 = $1816;
 $1818 = HEAP32[$1817>>2]|0;
 $1819 = (_i64Subtract(($1815|0),($1818|0),($1811|0),($1812|0))|0);
 $1820 = tempRet0;
 $1821 = $5;
 $1822 = $1821;
 HEAP32[$1822>>2] = $1819;
 $1823 = (($1821) + 4)|0;
 $1824 = $1823;
 HEAP32[$1824>>2] = $1820;
 $1825 = $6;
 $1826 = $1825;
 $1827 = HEAP32[$1826>>2]|0;
 $1828 = (($1825) + 4)|0;
 $1829 = $1828;
 $1830 = HEAP32[$1829>>2]|0;
 $1831 = (_bitshift64Ashr(($1827|0),($1830|0),21)|0);
 $1832 = tempRet0;
 $1833 = $19;
 $1834 = $1833;
 HEAP32[$1834>>2] = $1831;
 $1835 = (($1833) + 4)|0;
 $1836 = $1835;
 HEAP32[$1836>>2] = $1832;
 $1837 = $19;
 $1838 = $1837;
 $1839 = HEAP32[$1838>>2]|0;
 $1840 = (($1837) + 4)|0;
 $1841 = $1840;
 $1842 = HEAP32[$1841>>2]|0;
 $1843 = $7;
 $1844 = $1843;
 $1845 = HEAP32[$1844>>2]|0;
 $1846 = (($1843) + 4)|0;
 $1847 = $1846;
 $1848 = HEAP32[$1847>>2]|0;
 $1849 = (_i64Add(($1845|0),($1848|0),($1839|0),($1842|0))|0);
 $1850 = tempRet0;
 $1851 = $7;
 $1852 = $1851;
 HEAP32[$1852>>2] = $1849;
 $1853 = (($1851) + 4)|0;
 $1854 = $1853;
 HEAP32[$1854>>2] = $1850;
 $1855 = $19;
 $1856 = $1855;
 $1857 = HEAP32[$1856>>2]|0;
 $1858 = (($1855) + 4)|0;
 $1859 = $1858;
 $1860 = HEAP32[$1859>>2]|0;
 $1861 = (_bitshift64Shl(($1857|0),($1860|0),21)|0);
 $1862 = tempRet0;
 $1863 = $6;
 $1864 = $1863;
 $1865 = HEAP32[$1864>>2]|0;
 $1866 = (($1863) + 4)|0;
 $1867 = $1866;
 $1868 = HEAP32[$1867>>2]|0;
 $1869 = (_i64Subtract(($1865|0),($1868|0),($1861|0),($1862|0))|0);
 $1870 = tempRet0;
 $1871 = $6;
 $1872 = $1871;
 HEAP32[$1872>>2] = $1869;
 $1873 = (($1871) + 4)|0;
 $1874 = $1873;
 HEAP32[$1874>>2] = $1870;
 $1875 = $7;
 $1876 = $1875;
 $1877 = HEAP32[$1876>>2]|0;
 $1878 = (($1875) + 4)|0;
 $1879 = $1878;
 $1880 = HEAP32[$1879>>2]|0;
 $1881 = (_bitshift64Ashr(($1877|0),($1880|0),21)|0);
 $1882 = tempRet0;
 $1883 = $20;
 $1884 = $1883;
 HEAP32[$1884>>2] = $1881;
 $1885 = (($1883) + 4)|0;
 $1886 = $1885;
 HEAP32[$1886>>2] = $1882;
 $1887 = $20;
 $1888 = $1887;
 $1889 = HEAP32[$1888>>2]|0;
 $1890 = (($1887) + 4)|0;
 $1891 = $1890;
 $1892 = HEAP32[$1891>>2]|0;
 $1893 = $8;
 $1894 = $1893;
 $1895 = HEAP32[$1894>>2]|0;
 $1896 = (($1893) + 4)|0;
 $1897 = $1896;
 $1898 = HEAP32[$1897>>2]|0;
 $1899 = (_i64Add(($1895|0),($1898|0),($1889|0),($1892|0))|0);
 $1900 = tempRet0;
 $1901 = $8;
 $1902 = $1901;
 HEAP32[$1902>>2] = $1899;
 $1903 = (($1901) + 4)|0;
 $1904 = $1903;
 HEAP32[$1904>>2] = $1900;
 $1905 = $20;
 $1906 = $1905;
 $1907 = HEAP32[$1906>>2]|0;
 $1908 = (($1905) + 4)|0;
 $1909 = $1908;
 $1910 = HEAP32[$1909>>2]|0;
 $1911 = (_bitshift64Shl(($1907|0),($1910|0),21)|0);
 $1912 = tempRet0;
 $1913 = $7;
 $1914 = $1913;
 $1915 = HEAP32[$1914>>2]|0;
 $1916 = (($1913) + 4)|0;
 $1917 = $1916;
 $1918 = HEAP32[$1917>>2]|0;
 $1919 = (_i64Subtract(($1915|0),($1918|0),($1911|0),($1912|0))|0);
 $1920 = tempRet0;
 $1921 = $7;
 $1922 = $1921;
 HEAP32[$1922>>2] = $1919;
 $1923 = (($1921) + 4)|0;
 $1924 = $1923;
 HEAP32[$1924>>2] = $1920;
 $1925 = $8;
 $1926 = $1925;
 $1927 = HEAP32[$1926>>2]|0;
 $1928 = (($1925) + 4)|0;
 $1929 = $1928;
 $1930 = HEAP32[$1929>>2]|0;
 $1931 = (_bitshift64Ashr(($1927|0),($1930|0),21)|0);
 $1932 = tempRet0;
 $1933 = $21;
 $1934 = $1933;
 HEAP32[$1934>>2] = $1931;
 $1935 = (($1933) + 4)|0;
 $1936 = $1935;
 HEAP32[$1936>>2] = $1932;
 $1937 = $21;
 $1938 = $1937;
 $1939 = HEAP32[$1938>>2]|0;
 $1940 = (($1937) + 4)|0;
 $1941 = $1940;
 $1942 = HEAP32[$1941>>2]|0;
 $1943 = $9;
 $1944 = $1943;
 $1945 = HEAP32[$1944>>2]|0;
 $1946 = (($1943) + 4)|0;
 $1947 = $1946;
 $1948 = HEAP32[$1947>>2]|0;
 $1949 = (_i64Add(($1945|0),($1948|0),($1939|0),($1942|0))|0);
 $1950 = tempRet0;
 $1951 = $9;
 $1952 = $1951;
 HEAP32[$1952>>2] = $1949;
 $1953 = (($1951) + 4)|0;
 $1954 = $1953;
 HEAP32[$1954>>2] = $1950;
 $1955 = $21;
 $1956 = $1955;
 $1957 = HEAP32[$1956>>2]|0;
 $1958 = (($1955) + 4)|0;
 $1959 = $1958;
 $1960 = HEAP32[$1959>>2]|0;
 $1961 = (_bitshift64Shl(($1957|0),($1960|0),21)|0);
 $1962 = tempRet0;
 $1963 = $8;
 $1964 = $1963;
 $1965 = HEAP32[$1964>>2]|0;
 $1966 = (($1963) + 4)|0;
 $1967 = $1966;
 $1968 = HEAP32[$1967>>2]|0;
 $1969 = (_i64Subtract(($1965|0),($1968|0),($1961|0),($1962|0))|0);
 $1970 = tempRet0;
 $1971 = $8;
 $1972 = $1971;
 HEAP32[$1972>>2] = $1969;
 $1973 = (($1971) + 4)|0;
 $1974 = $1973;
 HEAP32[$1974>>2] = $1970;
 $1975 = $9;
 $1976 = $1975;
 $1977 = HEAP32[$1976>>2]|0;
 $1978 = (($1975) + 4)|0;
 $1979 = $1978;
 $1980 = HEAP32[$1979>>2]|0;
 $1981 = (_bitshift64Ashr(($1977|0),($1980|0),21)|0);
 $1982 = tempRet0;
 $1983 = $22;
 $1984 = $1983;
 HEAP32[$1984>>2] = $1981;
 $1985 = (($1983) + 4)|0;
 $1986 = $1985;
 HEAP32[$1986>>2] = $1982;
 $1987 = $22;
 $1988 = $1987;
 $1989 = HEAP32[$1988>>2]|0;
 $1990 = (($1987) + 4)|0;
 $1991 = $1990;
 $1992 = HEAP32[$1991>>2]|0;
 $1993 = $10;
 $1994 = $1993;
 $1995 = HEAP32[$1994>>2]|0;
 $1996 = (($1993) + 4)|0;
 $1997 = $1996;
 $1998 = HEAP32[$1997>>2]|0;
 $1999 = (_i64Add(($1995|0),($1998|0),($1989|0),($1992|0))|0);
 $2000 = tempRet0;
 $2001 = $10;
 $2002 = $2001;
 HEAP32[$2002>>2] = $1999;
 $2003 = (($2001) + 4)|0;
 $2004 = $2003;
 HEAP32[$2004>>2] = $2000;
 $2005 = $22;
 $2006 = $2005;
 $2007 = HEAP32[$2006>>2]|0;
 $2008 = (($2005) + 4)|0;
 $2009 = $2008;
 $2010 = HEAP32[$2009>>2]|0;
 $2011 = (_bitshift64Shl(($2007|0),($2010|0),21)|0);
 $2012 = tempRet0;
 $2013 = $9;
 $2014 = $2013;
 $2015 = HEAP32[$2014>>2]|0;
 $2016 = (($2013) + 4)|0;
 $2017 = $2016;
 $2018 = HEAP32[$2017>>2]|0;
 $2019 = (_i64Subtract(($2015|0),($2018|0),($2011|0),($2012|0))|0);
 $2020 = tempRet0;
 $2021 = $9;
 $2022 = $2021;
 HEAP32[$2022>>2] = $2019;
 $2023 = (($2021) + 4)|0;
 $2024 = $2023;
 HEAP32[$2024>>2] = $2020;
 $2025 = $10;
 $2026 = $2025;
 $2027 = HEAP32[$2026>>2]|0;
 $2028 = (($2025) + 4)|0;
 $2029 = $2028;
 $2030 = HEAP32[$2029>>2]|0;
 $2031 = (_bitshift64Ashr(($2027|0),($2030|0),21)|0);
 $2032 = tempRet0;
 $2033 = $23;
 $2034 = $2033;
 HEAP32[$2034>>2] = $2031;
 $2035 = (($2033) + 4)|0;
 $2036 = $2035;
 HEAP32[$2036>>2] = $2032;
 $2037 = $23;
 $2038 = $2037;
 $2039 = HEAP32[$2038>>2]|0;
 $2040 = (($2037) + 4)|0;
 $2041 = $2040;
 $2042 = HEAP32[$2041>>2]|0;
 $2043 = $11;
 $2044 = $2043;
 $2045 = HEAP32[$2044>>2]|0;
 $2046 = (($2043) + 4)|0;
 $2047 = $2046;
 $2048 = HEAP32[$2047>>2]|0;
 $2049 = (_i64Add(($2045|0),($2048|0),($2039|0),($2042|0))|0);
 $2050 = tempRet0;
 $2051 = $11;
 $2052 = $2051;
 HEAP32[$2052>>2] = $2049;
 $2053 = (($2051) + 4)|0;
 $2054 = $2053;
 HEAP32[$2054>>2] = $2050;
 $2055 = $23;
 $2056 = $2055;
 $2057 = HEAP32[$2056>>2]|0;
 $2058 = (($2055) + 4)|0;
 $2059 = $2058;
 $2060 = HEAP32[$2059>>2]|0;
 $2061 = (_bitshift64Shl(($2057|0),($2060|0),21)|0);
 $2062 = tempRet0;
 $2063 = $10;
 $2064 = $2063;
 $2065 = HEAP32[$2064>>2]|0;
 $2066 = (($2063) + 4)|0;
 $2067 = $2066;
 $2068 = HEAP32[$2067>>2]|0;
 $2069 = (_i64Subtract(($2065|0),($2068|0),($2061|0),($2062|0))|0);
 $2070 = tempRet0;
 $2071 = $10;
 $2072 = $2071;
 HEAP32[$2072>>2] = $2069;
 $2073 = (($2071) + 4)|0;
 $2074 = $2073;
 HEAP32[$2074>>2] = $2070;
 $2075 = $11;
 $2076 = $2075;
 $2077 = HEAP32[$2076>>2]|0;
 $2078 = (($2075) + 4)|0;
 $2079 = $2078;
 $2080 = HEAP32[$2079>>2]|0;
 $2081 = (_bitshift64Ashr(($2077|0),($2080|0),21)|0);
 $2082 = tempRet0;
 $2083 = $24;
 $2084 = $2083;
 HEAP32[$2084>>2] = $2081;
 $2085 = (($2083) + 4)|0;
 $2086 = $2085;
 HEAP32[$2086>>2] = $2082;
 $2087 = $24;
 $2088 = $2087;
 $2089 = HEAP32[$2088>>2]|0;
 $2090 = (($2087) + 4)|0;
 $2091 = $2090;
 $2092 = HEAP32[$2091>>2]|0;
 $2093 = $12;
 $2094 = $2093;
 $2095 = HEAP32[$2094>>2]|0;
 $2096 = (($2093) + 4)|0;
 $2097 = $2096;
 $2098 = HEAP32[$2097>>2]|0;
 $2099 = (_i64Add(($2095|0),($2098|0),($2089|0),($2092|0))|0);
 $2100 = tempRet0;
 $2101 = $12;
 $2102 = $2101;
 HEAP32[$2102>>2] = $2099;
 $2103 = (($2101) + 4)|0;
 $2104 = $2103;
 HEAP32[$2104>>2] = $2100;
 $2105 = $24;
 $2106 = $2105;
 $2107 = HEAP32[$2106>>2]|0;
 $2108 = (($2105) + 4)|0;
 $2109 = $2108;
 $2110 = HEAP32[$2109>>2]|0;
 $2111 = (_bitshift64Shl(($2107|0),($2110|0),21)|0);
 $2112 = tempRet0;
 $2113 = $11;
 $2114 = $2113;
 $2115 = HEAP32[$2114>>2]|0;
 $2116 = (($2113) + 4)|0;
 $2117 = $2116;
 $2118 = HEAP32[$2117>>2]|0;
 $2119 = (_i64Subtract(($2115|0),($2118|0),($2111|0),($2112|0))|0);
 $2120 = tempRet0;
 $2121 = $11;
 $2122 = $2121;
 HEAP32[$2122>>2] = $2119;
 $2123 = (($2121) + 4)|0;
 $2124 = $2123;
 HEAP32[$2124>>2] = $2120;
 $2125 = $12;
 $2126 = $2125;
 $2127 = HEAP32[$2126>>2]|0;
 $2128 = (($2125) + 4)|0;
 $2129 = $2128;
 $2130 = HEAP32[$2129>>2]|0;
 $2131 = (_bitshift64Ashr(($2127|0),($2130|0),21)|0);
 $2132 = tempRet0;
 $2133 = $25;
 $2134 = $2133;
 HEAP32[$2134>>2] = $2131;
 $2135 = (($2133) + 4)|0;
 $2136 = $2135;
 HEAP32[$2136>>2] = $2132;
 $2137 = $25;
 $2138 = $2137;
 $2139 = HEAP32[$2138>>2]|0;
 $2140 = (($2137) + 4)|0;
 $2141 = $2140;
 $2142 = HEAP32[$2141>>2]|0;
 $2143 = $13;
 $2144 = $2143;
 $2145 = HEAP32[$2144>>2]|0;
 $2146 = (($2143) + 4)|0;
 $2147 = $2146;
 $2148 = HEAP32[$2147>>2]|0;
 $2149 = (_i64Add(($2145|0),($2148|0),($2139|0),($2142|0))|0);
 $2150 = tempRet0;
 $2151 = $13;
 $2152 = $2151;
 HEAP32[$2152>>2] = $2149;
 $2153 = (($2151) + 4)|0;
 $2154 = $2153;
 HEAP32[$2154>>2] = $2150;
 $2155 = $25;
 $2156 = $2155;
 $2157 = HEAP32[$2156>>2]|0;
 $2158 = (($2155) + 4)|0;
 $2159 = $2158;
 $2160 = HEAP32[$2159>>2]|0;
 $2161 = (_bitshift64Shl(($2157|0),($2160|0),21)|0);
 $2162 = tempRet0;
 $2163 = $12;
 $2164 = $2163;
 $2165 = HEAP32[$2164>>2]|0;
 $2166 = (($2163) + 4)|0;
 $2167 = $2166;
 $2168 = HEAP32[$2167>>2]|0;
 $2169 = (_i64Subtract(($2165|0),($2168|0),($2161|0),($2162|0))|0);
 $2170 = tempRet0;
 $2171 = $12;
 $2172 = $2171;
 HEAP32[$2172>>2] = $2169;
 $2173 = (($2171) + 4)|0;
 $2174 = $2173;
 HEAP32[$2174>>2] = $2170;
 $2175 = $2;
 $2176 = $2175;
 $2177 = HEAP32[$2176>>2]|0;
 $2178 = (($2175) + 4)|0;
 $2179 = $2178;
 $2180 = HEAP32[$2179>>2]|0;
 $2181 = (_bitshift64Ashr(($2177|0),($2180|0),0)|0);
 $2182 = tempRet0;
 $2183 = $2181&255;
 $2184 = $1;
 HEAP8[$2184>>0] = $2183;
 $2185 = $2;
 $2186 = $2185;
 $2187 = HEAP32[$2186>>2]|0;
 $2188 = (($2185) + 4)|0;
 $2189 = $2188;
 $2190 = HEAP32[$2189>>2]|0;
 $2191 = (_bitshift64Ashr(($2187|0),($2190|0),8)|0);
 $2192 = tempRet0;
 $2193 = $2191&255;
 $2194 = $1;
 $2195 = ((($2194)) + 1|0);
 HEAP8[$2195>>0] = $2193;
 $2196 = $2;
 $2197 = $2196;
 $2198 = HEAP32[$2197>>2]|0;
 $2199 = (($2196) + 4)|0;
 $2200 = $2199;
 $2201 = HEAP32[$2200>>2]|0;
 $2202 = (_bitshift64Ashr(($2198|0),($2201|0),16)|0);
 $2203 = tempRet0;
 $2204 = $3;
 $2205 = $2204;
 $2206 = HEAP32[$2205>>2]|0;
 $2207 = (($2204) + 4)|0;
 $2208 = $2207;
 $2209 = HEAP32[$2208>>2]|0;
 $2210 = (_bitshift64Shl(($2206|0),($2209|0),5)|0);
 $2211 = tempRet0;
 $2212 = $2202 | $2210;
 $2203 | $2211;
 $2213 = $2212&255;
 $2214 = $1;
 $2215 = ((($2214)) + 2|0);
 HEAP8[$2215>>0] = $2213;
 $2216 = $3;
 $2217 = $2216;
 $2218 = HEAP32[$2217>>2]|0;
 $2219 = (($2216) + 4)|0;
 $2220 = $2219;
 $2221 = HEAP32[$2220>>2]|0;
 $2222 = (_bitshift64Ashr(($2218|0),($2221|0),3)|0);
 $2223 = tempRet0;
 $2224 = $2222&255;
 $2225 = $1;
 $2226 = ((($2225)) + 3|0);
 HEAP8[$2226>>0] = $2224;
 $2227 = $3;
 $2228 = $2227;
 $2229 = HEAP32[$2228>>2]|0;
 $2230 = (($2227) + 4)|0;
 $2231 = $2230;
 $2232 = HEAP32[$2231>>2]|0;
 $2233 = (_bitshift64Ashr(($2229|0),($2232|0),11)|0);
 $2234 = tempRet0;
 $2235 = $2233&255;
 $2236 = $1;
 $2237 = ((($2236)) + 4|0);
 HEAP8[$2237>>0] = $2235;
 $2238 = $3;
 $2239 = $2238;
 $2240 = HEAP32[$2239>>2]|0;
 $2241 = (($2238) + 4)|0;
 $2242 = $2241;
 $2243 = HEAP32[$2242>>2]|0;
 $2244 = (_bitshift64Ashr(($2240|0),($2243|0),19)|0);
 $2245 = tempRet0;
 $2246 = $4;
 $2247 = $2246;
 $2248 = HEAP32[$2247>>2]|0;
 $2249 = (($2246) + 4)|0;
 $2250 = $2249;
 $2251 = HEAP32[$2250>>2]|0;
 $2252 = (_bitshift64Shl(($2248|0),($2251|0),2)|0);
 $2253 = tempRet0;
 $2254 = $2244 | $2252;
 $2245 | $2253;
 $2255 = $2254&255;
 $2256 = $1;
 $2257 = ((($2256)) + 5|0);
 HEAP8[$2257>>0] = $2255;
 $2258 = $4;
 $2259 = $2258;
 $2260 = HEAP32[$2259>>2]|0;
 $2261 = (($2258) + 4)|0;
 $2262 = $2261;
 $2263 = HEAP32[$2262>>2]|0;
 $2264 = (_bitshift64Ashr(($2260|0),($2263|0),6)|0);
 $2265 = tempRet0;
 $2266 = $2264&255;
 $2267 = $1;
 $2268 = ((($2267)) + 6|0);
 HEAP8[$2268>>0] = $2266;
 $2269 = $4;
 $2270 = $2269;
 $2271 = HEAP32[$2270>>2]|0;
 $2272 = (($2269) + 4)|0;
 $2273 = $2272;
 $2274 = HEAP32[$2273>>2]|0;
 $2275 = (_bitshift64Ashr(($2271|0),($2274|0),14)|0);
 $2276 = tempRet0;
 $2277 = $5;
 $2278 = $2277;
 $2279 = HEAP32[$2278>>2]|0;
 $2280 = (($2277) + 4)|0;
 $2281 = $2280;
 $2282 = HEAP32[$2281>>2]|0;
 $2283 = (_bitshift64Shl(($2279|0),($2282|0),7)|0);
 $2284 = tempRet0;
 $2285 = $2275 | $2283;
 $2276 | $2284;
 $2286 = $2285&255;
 $2287 = $1;
 $2288 = ((($2287)) + 7|0);
 HEAP8[$2288>>0] = $2286;
 $2289 = $5;
 $2290 = $2289;
 $2291 = HEAP32[$2290>>2]|0;
 $2292 = (($2289) + 4)|0;
 $2293 = $2292;
 $2294 = HEAP32[$2293>>2]|0;
 $2295 = (_bitshift64Ashr(($2291|0),($2294|0),1)|0);
 $2296 = tempRet0;
 $2297 = $2295&255;
 $2298 = $1;
 $2299 = ((($2298)) + 8|0);
 HEAP8[$2299>>0] = $2297;
 $2300 = $5;
 $2301 = $2300;
 $2302 = HEAP32[$2301>>2]|0;
 $2303 = (($2300) + 4)|0;
 $2304 = $2303;
 $2305 = HEAP32[$2304>>2]|0;
 $2306 = (_bitshift64Ashr(($2302|0),($2305|0),9)|0);
 $2307 = tempRet0;
 $2308 = $2306&255;
 $2309 = $1;
 $2310 = ((($2309)) + 9|0);
 HEAP8[$2310>>0] = $2308;
 $2311 = $5;
 $2312 = $2311;
 $2313 = HEAP32[$2312>>2]|0;
 $2314 = (($2311) + 4)|0;
 $2315 = $2314;
 $2316 = HEAP32[$2315>>2]|0;
 $2317 = (_bitshift64Ashr(($2313|0),($2316|0),17)|0);
 $2318 = tempRet0;
 $2319 = $6;
 $2320 = $2319;
 $2321 = HEAP32[$2320>>2]|0;
 $2322 = (($2319) + 4)|0;
 $2323 = $2322;
 $2324 = HEAP32[$2323>>2]|0;
 $2325 = (_bitshift64Shl(($2321|0),($2324|0),4)|0);
 $2326 = tempRet0;
 $2327 = $2317 | $2325;
 $2318 | $2326;
 $2328 = $2327&255;
 $2329 = $1;
 $2330 = ((($2329)) + 10|0);
 HEAP8[$2330>>0] = $2328;
 $2331 = $6;
 $2332 = $2331;
 $2333 = HEAP32[$2332>>2]|0;
 $2334 = (($2331) + 4)|0;
 $2335 = $2334;
 $2336 = HEAP32[$2335>>2]|0;
 $2337 = (_bitshift64Ashr(($2333|0),($2336|0),4)|0);
 $2338 = tempRet0;
 $2339 = $2337&255;
 $2340 = $1;
 $2341 = ((($2340)) + 11|0);
 HEAP8[$2341>>0] = $2339;
 $2342 = $6;
 $2343 = $2342;
 $2344 = HEAP32[$2343>>2]|0;
 $2345 = (($2342) + 4)|0;
 $2346 = $2345;
 $2347 = HEAP32[$2346>>2]|0;
 $2348 = (_bitshift64Ashr(($2344|0),($2347|0),12)|0);
 $2349 = tempRet0;
 $2350 = $2348&255;
 $2351 = $1;
 $2352 = ((($2351)) + 12|0);
 HEAP8[$2352>>0] = $2350;
 $2353 = $6;
 $2354 = $2353;
 $2355 = HEAP32[$2354>>2]|0;
 $2356 = (($2353) + 4)|0;
 $2357 = $2356;
 $2358 = HEAP32[$2357>>2]|0;
 $2359 = (_bitshift64Ashr(($2355|0),($2358|0),20)|0);
 $2360 = tempRet0;
 $2361 = $7;
 $2362 = $2361;
 $2363 = HEAP32[$2362>>2]|0;
 $2364 = (($2361) + 4)|0;
 $2365 = $2364;
 $2366 = HEAP32[$2365>>2]|0;
 $2367 = (_bitshift64Shl(($2363|0),($2366|0),1)|0);
 $2368 = tempRet0;
 $2369 = $2359 | $2367;
 $2360 | $2368;
 $2370 = $2369&255;
 $2371 = $1;
 $2372 = ((($2371)) + 13|0);
 HEAP8[$2372>>0] = $2370;
 $2373 = $7;
 $2374 = $2373;
 $2375 = HEAP32[$2374>>2]|0;
 $2376 = (($2373) + 4)|0;
 $2377 = $2376;
 $2378 = HEAP32[$2377>>2]|0;
 $2379 = (_bitshift64Ashr(($2375|0),($2378|0),7)|0);
 $2380 = tempRet0;
 $2381 = $2379&255;
 $2382 = $1;
 $2383 = ((($2382)) + 14|0);
 HEAP8[$2383>>0] = $2381;
 $2384 = $7;
 $2385 = $2384;
 $2386 = HEAP32[$2385>>2]|0;
 $2387 = (($2384) + 4)|0;
 $2388 = $2387;
 $2389 = HEAP32[$2388>>2]|0;
 $2390 = (_bitshift64Ashr(($2386|0),($2389|0),15)|0);
 $2391 = tempRet0;
 $2392 = $8;
 $2393 = $2392;
 $2394 = HEAP32[$2393>>2]|0;
 $2395 = (($2392) + 4)|0;
 $2396 = $2395;
 $2397 = HEAP32[$2396>>2]|0;
 $2398 = (_bitshift64Shl(($2394|0),($2397|0),6)|0);
 $2399 = tempRet0;
 $2400 = $2390 | $2398;
 $2391 | $2399;
 $2401 = $2400&255;
 $2402 = $1;
 $2403 = ((($2402)) + 15|0);
 HEAP8[$2403>>0] = $2401;
 $2404 = $8;
 $2405 = $2404;
 $2406 = HEAP32[$2405>>2]|0;
 $2407 = (($2404) + 4)|0;
 $2408 = $2407;
 $2409 = HEAP32[$2408>>2]|0;
 $2410 = (_bitshift64Ashr(($2406|0),($2409|0),2)|0);
 $2411 = tempRet0;
 $2412 = $2410&255;
 $2413 = $1;
 $2414 = ((($2413)) + 16|0);
 HEAP8[$2414>>0] = $2412;
 $2415 = $8;
 $2416 = $2415;
 $2417 = HEAP32[$2416>>2]|0;
 $2418 = (($2415) + 4)|0;
 $2419 = $2418;
 $2420 = HEAP32[$2419>>2]|0;
 $2421 = (_bitshift64Ashr(($2417|0),($2420|0),10)|0);
 $2422 = tempRet0;
 $2423 = $2421&255;
 $2424 = $1;
 $2425 = ((($2424)) + 17|0);
 HEAP8[$2425>>0] = $2423;
 $2426 = $8;
 $2427 = $2426;
 $2428 = HEAP32[$2427>>2]|0;
 $2429 = (($2426) + 4)|0;
 $2430 = $2429;
 $2431 = HEAP32[$2430>>2]|0;
 $2432 = (_bitshift64Ashr(($2428|0),($2431|0),18)|0);
 $2433 = tempRet0;
 $2434 = $9;
 $2435 = $2434;
 $2436 = HEAP32[$2435>>2]|0;
 $2437 = (($2434) + 4)|0;
 $2438 = $2437;
 $2439 = HEAP32[$2438>>2]|0;
 $2440 = (_bitshift64Shl(($2436|0),($2439|0),3)|0);
 $2441 = tempRet0;
 $2442 = $2432 | $2440;
 $2433 | $2441;
 $2443 = $2442&255;
 $2444 = $1;
 $2445 = ((($2444)) + 18|0);
 HEAP8[$2445>>0] = $2443;
 $2446 = $9;
 $2447 = $2446;
 $2448 = HEAP32[$2447>>2]|0;
 $2449 = (($2446) + 4)|0;
 $2450 = $2449;
 $2451 = HEAP32[$2450>>2]|0;
 $2452 = (_bitshift64Ashr(($2448|0),($2451|0),5)|0);
 $2453 = tempRet0;
 $2454 = $2452&255;
 $2455 = $1;
 $2456 = ((($2455)) + 19|0);
 HEAP8[$2456>>0] = $2454;
 $2457 = $9;
 $2458 = $2457;
 $2459 = HEAP32[$2458>>2]|0;
 $2460 = (($2457) + 4)|0;
 $2461 = $2460;
 $2462 = HEAP32[$2461>>2]|0;
 $2463 = (_bitshift64Ashr(($2459|0),($2462|0),13)|0);
 $2464 = tempRet0;
 $2465 = $2463&255;
 $2466 = $1;
 $2467 = ((($2466)) + 20|0);
 HEAP8[$2467>>0] = $2465;
 $2468 = $10;
 $2469 = $2468;
 $2470 = HEAP32[$2469>>2]|0;
 $2471 = (($2468) + 4)|0;
 $2472 = $2471;
 $2473 = HEAP32[$2472>>2]|0;
 $2474 = (_bitshift64Ashr(($2470|0),($2473|0),0)|0);
 $2475 = tempRet0;
 $2476 = $2474&255;
 $2477 = $1;
 $2478 = ((($2477)) + 21|0);
 HEAP8[$2478>>0] = $2476;
 $2479 = $10;
 $2480 = $2479;
 $2481 = HEAP32[$2480>>2]|0;
 $2482 = (($2479) + 4)|0;
 $2483 = $2482;
 $2484 = HEAP32[$2483>>2]|0;
 $2485 = (_bitshift64Ashr(($2481|0),($2484|0),8)|0);
 $2486 = tempRet0;
 $2487 = $2485&255;
 $2488 = $1;
 $2489 = ((($2488)) + 22|0);
 HEAP8[$2489>>0] = $2487;
 $2490 = $10;
 $2491 = $2490;
 $2492 = HEAP32[$2491>>2]|0;
 $2493 = (($2490) + 4)|0;
 $2494 = $2493;
 $2495 = HEAP32[$2494>>2]|0;
 $2496 = (_bitshift64Ashr(($2492|0),($2495|0),16)|0);
 $2497 = tempRet0;
 $2498 = $11;
 $2499 = $2498;
 $2500 = HEAP32[$2499>>2]|0;
 $2501 = (($2498) + 4)|0;
 $2502 = $2501;
 $2503 = HEAP32[$2502>>2]|0;
 $2504 = (_bitshift64Shl(($2500|0),($2503|0),5)|0);
 $2505 = tempRet0;
 $2506 = $2496 | $2504;
 $2497 | $2505;
 $2507 = $2506&255;
 $2508 = $1;
 $2509 = ((($2508)) + 23|0);
 HEAP8[$2509>>0] = $2507;
 $2510 = $11;
 $2511 = $2510;
 $2512 = HEAP32[$2511>>2]|0;
 $2513 = (($2510) + 4)|0;
 $2514 = $2513;
 $2515 = HEAP32[$2514>>2]|0;
 $2516 = (_bitshift64Ashr(($2512|0),($2515|0),3)|0);
 $2517 = tempRet0;
 $2518 = $2516&255;
 $2519 = $1;
 $2520 = ((($2519)) + 24|0);
 HEAP8[$2520>>0] = $2518;
 $2521 = $11;
 $2522 = $2521;
 $2523 = HEAP32[$2522>>2]|0;
 $2524 = (($2521) + 4)|0;
 $2525 = $2524;
 $2526 = HEAP32[$2525>>2]|0;
 $2527 = (_bitshift64Ashr(($2523|0),($2526|0),11)|0);
 $2528 = tempRet0;
 $2529 = $2527&255;
 $2530 = $1;
 $2531 = ((($2530)) + 25|0);
 HEAP8[$2531>>0] = $2529;
 $2532 = $11;
 $2533 = $2532;
 $2534 = HEAP32[$2533>>2]|0;
 $2535 = (($2532) + 4)|0;
 $2536 = $2535;
 $2537 = HEAP32[$2536>>2]|0;
 $2538 = (_bitshift64Ashr(($2534|0),($2537|0),19)|0);
 $2539 = tempRet0;
 $2540 = $12;
 $2541 = $2540;
 $2542 = HEAP32[$2541>>2]|0;
 $2543 = (($2540) + 4)|0;
 $2544 = $2543;
 $2545 = HEAP32[$2544>>2]|0;
 $2546 = (_bitshift64Shl(($2542|0),($2545|0),2)|0);
 $2547 = tempRet0;
 $2548 = $2538 | $2546;
 $2539 | $2547;
 $2549 = $2548&255;
 $2550 = $1;
 $2551 = ((($2550)) + 26|0);
 HEAP8[$2551>>0] = $2549;
 $2552 = $12;
 $2553 = $2552;
 $2554 = HEAP32[$2553>>2]|0;
 $2555 = (($2552) + 4)|0;
 $2556 = $2555;
 $2557 = HEAP32[$2556>>2]|0;
 $2558 = (_bitshift64Ashr(($2554|0),($2557|0),6)|0);
 $2559 = tempRet0;
 $2560 = $2558&255;
 $2561 = $1;
 $2562 = ((($2561)) + 27|0);
 HEAP8[$2562>>0] = $2560;
 $2563 = $12;
 $2564 = $2563;
 $2565 = HEAP32[$2564>>2]|0;
 $2566 = (($2563) + 4)|0;
 $2567 = $2566;
 $2568 = HEAP32[$2567>>2]|0;
 $2569 = (_bitshift64Ashr(($2565|0),($2568|0),14)|0);
 $2570 = tempRet0;
 $2571 = $13;
 $2572 = $2571;
 $2573 = HEAP32[$2572>>2]|0;
 $2574 = (($2571) + 4)|0;
 $2575 = $2574;
 $2576 = HEAP32[$2575>>2]|0;
 $2577 = (_bitshift64Shl(($2573|0),($2576|0),7)|0);
 $2578 = tempRet0;
 $2579 = $2569 | $2577;
 $2570 | $2578;
 $2580 = $2579&255;
 $2581 = $1;
 $2582 = ((($2581)) + 28|0);
 HEAP8[$2582>>0] = $2580;
 $2583 = $13;
 $2584 = $2583;
 $2585 = HEAP32[$2584>>2]|0;
 $2586 = (($2583) + 4)|0;
 $2587 = $2586;
 $2588 = HEAP32[$2587>>2]|0;
 $2589 = (_bitshift64Ashr(($2585|0),($2588|0),1)|0);
 $2590 = tempRet0;
 $2591 = $2589&255;
 $2592 = $1;
 $2593 = ((($2592)) + 29|0);
 HEAP8[$2593>>0] = $2591;
 $2594 = $13;
 $2595 = $2594;
 $2596 = HEAP32[$2595>>2]|0;
 $2597 = (($2594) + 4)|0;
 $2598 = $2597;
 $2599 = HEAP32[$2598>>2]|0;
 $2600 = (_bitshift64Ashr(($2596|0),($2599|0),9)|0);
 $2601 = tempRet0;
 $2602 = $2600&255;
 $2603 = $1;
 $2604 = ((($2603)) + 30|0);
 HEAP8[$2604>>0] = $2602;
 $2605 = $13;
 $2606 = $2605;
 $2607 = HEAP32[$2606>>2]|0;
 $2608 = (($2605) + 4)|0;
 $2609 = $2608;
 $2610 = HEAP32[$2609>>2]|0;
 $2611 = (_bitshift64Ashr(($2607|0),($2610|0),17)|0);
 $2612 = tempRet0;
 $2613 = $2611&255;
 $2614 = $1;
 $2615 = ((($2614)) + 31|0);
 HEAP8[$2615>>0] = $2613;
 STACKTOP = sp;return;
}
function _malloc($0) {
 $0 = $0|0;
 var $$0 = 0, $$0$i = 0, $$0$i$i = 0, $$0$i$i$i = 0, $$0$i20$i = 0, $$0169$i = 0, $$0170$i = 0, $$0171$i = 0, $$0192 = 0, $$0194 = 0, $$02014$i$i = 0, $$0202$lcssa$i$i = 0, $$02023$i$i = 0, $$0206$i$i = 0, $$0207$i$i = 0, $$024372$i = 0, $$0259$i$i = 0, $$02604$i$i = 0, $$0261$lcssa$i$i = 0, $$02613$i$i = 0;
 var $$0267$i$i = 0, $$0268$i$i = 0, $$0318$i = 0, $$032012$i = 0, $$0321$lcssa$i = 0, $$032111$i = 0, $$0323$i = 0, $$0329$i = 0, $$0335$i = 0, $$0336$i = 0, $$0338$i = 0, $$0339$i = 0, $$0344$i = 0, $$1174$i = 0, $$1174$i$be = 0, $$1174$i$ph = 0, $$1176$i = 0, $$1176$i$be = 0, $$1176$i$ph = 0, $$124471$i = 0;
 var $$1263$i$i = 0, $$1263$i$i$be = 0, $$1263$i$i$ph = 0, $$1265$i$i = 0, $$1265$i$i$be = 0, $$1265$i$i$ph = 0, $$1319$i = 0, $$1324$i = 0, $$1340$i = 0, $$1346$i = 0, $$1346$i$be = 0, $$1346$i$ph = 0, $$1350$i = 0, $$1350$i$be = 0, $$1350$i$ph = 0, $$2234243136$i = 0, $$2247$ph$i = 0, $$2253$ph$i = 0, $$2331$i = 0, $$3$i = 0;
 var $$3$i$i = 0, $$3$i198 = 0, $$3$i198211 = 0, $$3326$i = 0, $$3348$i = 0, $$4$lcssa$i = 0, $$415$i = 0, $$415$i$ph = 0, $$4236$i = 0, $$4327$lcssa$i = 0, $$432714$i = 0, $$432714$i$ph = 0, $$4333$i = 0, $$533413$i = 0, $$533413$i$ph = 0, $$723947$i = 0, $$748$i = 0, $$pre = 0, $$pre$i = 0, $$pre$i$i = 0;
 var $$pre$i16$i = 0, $$pre$i195 = 0, $$pre$i204 = 0, $$pre$phi$i$iZ2D = 0, $$pre$phi$i17$iZ2D = 0, $$pre$phi$i205Z2D = 0, $$pre$phi$iZ2D = 0, $$pre$phiZ2D = 0, $$sink = 0, $$sink320 = 0, $$sink321 = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0;
 var $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0;
 var $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0;
 var $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0;
 var $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0;
 var $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0, $189 = 0, $19 = 0, $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0;
 var $198 = 0, $199 = 0, $2 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0, $206 = 0, $207 = 0, $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0;
 var $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0, $222 = 0, $223 = 0, $224 = 0, $225 = 0, $226 = 0, $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0, $232 = 0;
 var $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0, $241 = 0, $242 = 0, $243 = 0, $244 = 0, $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0, $25 = 0, $250 = 0;
 var $251 = 0, $252 = 0, $253 = 0, $254 = 0, $255 = 0, $256 = 0, $257 = 0, $258 = 0, $259 = 0, $26 = 0, $260 = 0, $261 = 0, $262 = 0, $263 = 0, $264 = 0, $265 = 0, $266 = 0, $267 = 0, $268 = 0, $269 = 0;
 var $27 = 0, $270 = 0, $271 = 0, $272 = 0, $273 = 0, $274 = 0, $275 = 0, $276 = 0, $277 = 0, $278 = 0, $279 = 0, $28 = 0, $280 = 0, $281 = 0, $282 = 0, $283 = 0, $284 = 0, $285 = 0, $286 = 0, $287 = 0;
 var $288 = 0, $289 = 0, $29 = 0, $290 = 0, $291 = 0, $292 = 0, $293 = 0, $294 = 0, $295 = 0, $296 = 0, $297 = 0, $298 = 0, $299 = 0, $3 = 0, $30 = 0, $300 = 0, $301 = 0, $302 = 0, $303 = 0, $304 = 0;
 var $305 = 0, $306 = 0, $307 = 0, $308 = 0, $309 = 0, $31 = 0, $310 = 0, $311 = 0, $312 = 0, $313 = 0, $314 = 0, $315 = 0, $316 = 0, $317 = 0, $318 = 0, $319 = 0, $32 = 0, $320 = 0, $321 = 0, $322 = 0;
 var $323 = 0, $324 = 0, $325 = 0, $326 = 0, $327 = 0, $328 = 0, $329 = 0, $33 = 0, $330 = 0, $331 = 0, $332 = 0, $333 = 0, $334 = 0, $335 = 0, $336 = 0, $337 = 0, $338 = 0, $339 = 0, $34 = 0, $340 = 0;
 var $341 = 0, $342 = 0, $343 = 0, $344 = 0, $345 = 0, $346 = 0, $347 = 0, $348 = 0, $349 = 0, $35 = 0, $350 = 0, $351 = 0, $352 = 0, $353 = 0, $354 = 0, $355 = 0, $356 = 0, $357 = 0, $358 = 0, $359 = 0;
 var $36 = 0, $360 = 0, $361 = 0, $362 = 0, $363 = 0, $364 = 0, $365 = 0, $366 = 0, $367 = 0, $368 = 0, $369 = 0, $37 = 0, $370 = 0, $371 = 0, $372 = 0, $373 = 0, $374 = 0, $375 = 0, $376 = 0, $377 = 0;
 var $378 = 0, $379 = 0, $38 = 0, $380 = 0, $381 = 0, $382 = 0, $383 = 0, $384 = 0, $385 = 0, $386 = 0, $387 = 0, $388 = 0, $389 = 0, $39 = 0, $390 = 0, $391 = 0, $392 = 0, $393 = 0, $394 = 0, $395 = 0;
 var $396 = 0, $397 = 0, $398 = 0, $399 = 0, $4 = 0, $40 = 0, $400 = 0, $401 = 0, $402 = 0, $403 = 0, $404 = 0, $405 = 0, $406 = 0, $407 = 0, $408 = 0, $409 = 0, $41 = 0, $410 = 0, $411 = 0, $412 = 0;
 var $413 = 0, $414 = 0, $415 = 0, $416 = 0, $417 = 0, $418 = 0, $419 = 0, $42 = 0, $420 = 0, $421 = 0, $422 = 0, $423 = 0, $424 = 0, $425 = 0, $426 = 0, $427 = 0, $428 = 0, $429 = 0, $43 = 0, $430 = 0;
 var $431 = 0, $432 = 0, $433 = 0, $434 = 0, $435 = 0, $436 = 0, $437 = 0, $438 = 0, $439 = 0, $44 = 0, $440 = 0, $441 = 0, $442 = 0, $443 = 0, $444 = 0, $445 = 0, $446 = 0, $447 = 0, $448 = 0, $449 = 0;
 var $45 = 0, $450 = 0, $451 = 0, $452 = 0, $453 = 0, $454 = 0, $455 = 0, $456 = 0, $457 = 0, $458 = 0, $459 = 0, $46 = 0, $460 = 0, $461 = 0, $462 = 0, $463 = 0, $464 = 0, $465 = 0, $466 = 0, $467 = 0;
 var $468 = 0, $469 = 0, $47 = 0, $470 = 0, $471 = 0, $472 = 0, $473 = 0, $474 = 0, $475 = 0, $476 = 0, $477 = 0, $478 = 0, $479 = 0, $48 = 0, $480 = 0, $481 = 0, $482 = 0, $483 = 0, $484 = 0, $485 = 0;
 var $486 = 0, $487 = 0, $488 = 0, $489 = 0, $49 = 0, $490 = 0, $491 = 0, $492 = 0, $493 = 0, $494 = 0, $495 = 0, $496 = 0, $497 = 0, $498 = 0, $499 = 0, $5 = 0, $50 = 0, $500 = 0, $501 = 0, $502 = 0;
 var $503 = 0, $504 = 0, $505 = 0, $506 = 0, $507 = 0, $508 = 0, $509 = 0, $51 = 0, $510 = 0, $511 = 0, $512 = 0, $513 = 0, $514 = 0, $515 = 0, $516 = 0, $517 = 0, $518 = 0, $519 = 0, $52 = 0, $520 = 0;
 var $521 = 0, $522 = 0, $523 = 0, $524 = 0, $525 = 0, $526 = 0, $527 = 0, $528 = 0, $529 = 0, $53 = 0, $530 = 0, $531 = 0, $532 = 0, $533 = 0, $534 = 0, $535 = 0, $536 = 0, $537 = 0, $538 = 0, $539 = 0;
 var $54 = 0, $540 = 0, $541 = 0, $542 = 0, $543 = 0, $544 = 0, $545 = 0, $546 = 0, $547 = 0, $548 = 0, $549 = 0, $55 = 0, $550 = 0, $551 = 0, $552 = 0, $553 = 0, $554 = 0, $555 = 0, $556 = 0, $557 = 0;
 var $558 = 0, $559 = 0, $56 = 0, $560 = 0, $561 = 0, $562 = 0, $563 = 0, $564 = 0, $565 = 0, $566 = 0, $567 = 0, $568 = 0, $569 = 0, $57 = 0, $570 = 0, $571 = 0, $572 = 0, $573 = 0, $574 = 0, $575 = 0;
 var $576 = 0, $577 = 0, $578 = 0, $579 = 0, $58 = 0, $580 = 0, $581 = 0, $582 = 0, $583 = 0, $584 = 0, $585 = 0, $586 = 0, $587 = 0, $588 = 0, $589 = 0, $59 = 0, $590 = 0, $591 = 0, $592 = 0, $593 = 0;
 var $594 = 0, $595 = 0, $596 = 0, $597 = 0, $598 = 0, $599 = 0, $6 = 0, $60 = 0, $600 = 0, $601 = 0, $602 = 0, $603 = 0, $604 = 0, $605 = 0, $606 = 0, $607 = 0, $608 = 0, $609 = 0, $61 = 0, $610 = 0;
 var $611 = 0, $612 = 0, $613 = 0, $614 = 0, $615 = 0, $616 = 0, $617 = 0, $618 = 0, $619 = 0, $62 = 0, $620 = 0, $621 = 0, $622 = 0, $623 = 0, $624 = 0, $625 = 0, $626 = 0, $627 = 0, $628 = 0, $629 = 0;
 var $63 = 0, $630 = 0, $631 = 0, $632 = 0, $633 = 0, $634 = 0, $635 = 0, $636 = 0, $637 = 0, $638 = 0, $639 = 0, $64 = 0, $640 = 0, $641 = 0, $642 = 0, $643 = 0, $644 = 0, $645 = 0, $646 = 0, $647 = 0;
 var $648 = 0, $649 = 0, $65 = 0, $650 = 0, $651 = 0, $652 = 0, $653 = 0, $654 = 0, $655 = 0, $656 = 0, $657 = 0, $658 = 0, $659 = 0, $66 = 0, $660 = 0, $661 = 0, $662 = 0, $663 = 0, $664 = 0, $665 = 0;
 var $666 = 0, $667 = 0, $668 = 0, $669 = 0, $67 = 0, $670 = 0, $671 = 0, $672 = 0, $673 = 0, $674 = 0, $675 = 0, $676 = 0, $677 = 0, $678 = 0, $679 = 0, $68 = 0, $680 = 0, $681 = 0, $682 = 0, $683 = 0;
 var $684 = 0, $685 = 0, $686 = 0, $687 = 0, $688 = 0, $689 = 0, $69 = 0, $690 = 0, $691 = 0, $692 = 0, $693 = 0, $694 = 0, $695 = 0, $696 = 0, $697 = 0, $698 = 0, $699 = 0, $7 = 0, $70 = 0, $700 = 0;
 var $701 = 0, $702 = 0, $703 = 0, $704 = 0, $705 = 0, $706 = 0, $707 = 0, $708 = 0, $709 = 0, $71 = 0, $710 = 0, $711 = 0, $712 = 0, $713 = 0, $714 = 0, $715 = 0, $716 = 0, $717 = 0, $718 = 0, $719 = 0;
 var $72 = 0, $720 = 0, $721 = 0, $722 = 0, $723 = 0, $724 = 0, $725 = 0, $726 = 0, $727 = 0, $728 = 0, $729 = 0, $73 = 0, $730 = 0, $731 = 0, $732 = 0, $733 = 0, $734 = 0, $735 = 0, $736 = 0, $737 = 0;
 var $738 = 0, $739 = 0, $74 = 0, $740 = 0, $741 = 0, $742 = 0, $743 = 0, $744 = 0, $745 = 0, $746 = 0, $747 = 0, $748 = 0, $749 = 0, $75 = 0, $750 = 0, $751 = 0, $752 = 0, $753 = 0, $754 = 0, $755 = 0;
 var $756 = 0, $757 = 0, $758 = 0, $759 = 0, $76 = 0, $760 = 0, $761 = 0, $762 = 0, $763 = 0, $764 = 0, $765 = 0, $766 = 0, $767 = 0, $768 = 0, $769 = 0, $77 = 0, $770 = 0, $771 = 0, $772 = 0, $773 = 0;
 var $774 = 0, $775 = 0, $776 = 0, $777 = 0, $778 = 0, $779 = 0, $78 = 0, $780 = 0, $781 = 0, $782 = 0, $783 = 0, $784 = 0, $785 = 0, $786 = 0, $787 = 0, $788 = 0, $789 = 0, $79 = 0, $790 = 0, $791 = 0;
 var $792 = 0, $793 = 0, $794 = 0, $795 = 0, $796 = 0, $797 = 0, $798 = 0, $799 = 0, $8 = 0, $80 = 0, $800 = 0, $801 = 0, $802 = 0, $803 = 0, $804 = 0, $805 = 0, $806 = 0, $807 = 0, $808 = 0, $809 = 0;
 var $81 = 0, $810 = 0, $811 = 0, $812 = 0, $813 = 0, $814 = 0, $815 = 0, $816 = 0, $817 = 0, $818 = 0, $819 = 0, $82 = 0, $820 = 0, $821 = 0, $822 = 0, $823 = 0, $824 = 0, $825 = 0, $826 = 0, $827 = 0;
 var $828 = 0, $829 = 0, $83 = 0, $830 = 0, $831 = 0, $832 = 0, $833 = 0, $834 = 0, $835 = 0, $836 = 0, $837 = 0, $838 = 0, $839 = 0, $84 = 0, $840 = 0, $841 = 0, $842 = 0, $843 = 0, $844 = 0, $845 = 0;
 var $846 = 0, $847 = 0, $848 = 0, $849 = 0, $85 = 0, $850 = 0, $851 = 0, $852 = 0, $853 = 0, $854 = 0, $855 = 0, $856 = 0, $857 = 0, $858 = 0, $859 = 0, $86 = 0, $860 = 0, $861 = 0, $862 = 0, $863 = 0;
 var $864 = 0, $865 = 0, $866 = 0, $867 = 0, $868 = 0, $869 = 0, $87 = 0, $870 = 0, $871 = 0, $872 = 0, $873 = 0, $874 = 0, $875 = 0, $876 = 0, $877 = 0, $878 = 0, $879 = 0, $88 = 0, $880 = 0, $881 = 0;
 var $882 = 0, $883 = 0, $884 = 0, $885 = 0, $886 = 0, $887 = 0, $888 = 0, $889 = 0, $89 = 0, $890 = 0, $891 = 0, $892 = 0, $893 = 0, $894 = 0, $895 = 0, $896 = 0, $897 = 0, $898 = 0, $899 = 0, $9 = 0;
 var $90 = 0, $900 = 0, $901 = 0, $902 = 0, $903 = 0, $904 = 0, $905 = 0, $906 = 0, $907 = 0, $908 = 0, $909 = 0, $91 = 0, $910 = 0, $911 = 0, $912 = 0, $913 = 0, $914 = 0, $915 = 0, $916 = 0, $917 = 0;
 var $918 = 0, $919 = 0, $92 = 0, $920 = 0, $921 = 0, $922 = 0, $923 = 0, $924 = 0, $925 = 0, $926 = 0, $927 = 0, $928 = 0, $929 = 0, $93 = 0, $930 = 0, $931 = 0, $932 = 0, $933 = 0, $934 = 0, $935 = 0;
 var $936 = 0, $937 = 0, $938 = 0, $939 = 0, $94 = 0, $940 = 0, $941 = 0, $942 = 0, $943 = 0, $944 = 0, $945 = 0, $946 = 0, $947 = 0, $948 = 0, $949 = 0, $95 = 0, $950 = 0, $951 = 0, $952 = 0, $953 = 0;
 var $954 = 0, $955 = 0, $956 = 0, $957 = 0, $958 = 0, $959 = 0, $96 = 0, $960 = 0, $961 = 0, $962 = 0, $963 = 0, $964 = 0, $965 = 0, $966 = 0, $967 = 0, $968 = 0, $969 = 0, $97 = 0, $970 = 0, $971 = 0;
 var $972 = 0, $973 = 0, $974 = 0, $975 = 0, $976 = 0, $977 = 0, $978 = 0, $979 = 0, $98 = 0, $99 = 0, $cond$i = 0, $cond$i$i = 0, $cond$i203 = 0, $not$$i = 0, $or$cond$i = 0, $or$cond$i199 = 0, $or$cond1$i = 0, $or$cond1$i197 = 0, $or$cond11$i = 0, $or$cond2$i = 0;
 var $or$cond5$i = 0, $or$cond50$i = 0, $or$cond51$i = 0, $or$cond6$i = 0, $or$cond7$i = 0, $or$cond8$i = 0, $or$cond8$not$i = 0, $spec$select$i = 0, $spec$select$i201 = 0, $spec$select1$i = 0, $spec$select2$i = 0, $spec$select4$i = 0, $spec$select49$i = 0, $spec$select9$i = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = sp;
 $2 = ($0>>>0)<(245);
 do {
  if ($2) {
   $3 = ($0>>>0)<(11);
   $4 = (($0) + 11)|0;
   $5 = $4 & -8;
   $6 = $3 ? 16 : $5;
   $7 = $6 >>> 3;
   $8 = HEAP32[296]|0;
   $9 = $8 >>> $7;
   $10 = $9 & 3;
   $11 = ($10|0)==(0);
   if (!($11)) {
    $12 = $9 & 1;
    $13 = $12 ^ 1;
    $14 = (($13) + ($7))|0;
    $15 = $14 << 1;
    $16 = (1224 + ($15<<2)|0);
    $17 = ((($16)) + 8|0);
    $18 = HEAP32[$17>>2]|0;
    $19 = ((($18)) + 8|0);
    $20 = HEAP32[$19>>2]|0;
    $21 = ($20|0)==($16|0);
    if ($21) {
     $22 = 1 << $14;
     $23 = $22 ^ -1;
     $24 = $8 & $23;
     HEAP32[296] = $24;
    } else {
     $25 = ((($20)) + 12|0);
     HEAP32[$25>>2] = $16;
     HEAP32[$17>>2] = $20;
    }
    $26 = $14 << 3;
    $27 = $26 | 3;
    $28 = ((($18)) + 4|0);
    HEAP32[$28>>2] = $27;
    $29 = (($18) + ($26)|0);
    $30 = ((($29)) + 4|0);
    $31 = HEAP32[$30>>2]|0;
    $32 = $31 | 1;
    HEAP32[$30>>2] = $32;
    $$0 = $19;
    STACKTOP = sp;return ($$0|0);
   }
   $33 = HEAP32[(1192)>>2]|0;
   $34 = ($6>>>0)>($33>>>0);
   if ($34) {
    $35 = ($9|0)==(0);
    if (!($35)) {
     $36 = $9 << $7;
     $37 = 2 << $7;
     $38 = (0 - ($37))|0;
     $39 = $37 | $38;
     $40 = $36 & $39;
     $41 = (0 - ($40))|0;
     $42 = $40 & $41;
     $43 = (($42) + -1)|0;
     $44 = $43 >>> 12;
     $45 = $44 & 16;
     $46 = $43 >>> $45;
     $47 = $46 >>> 5;
     $48 = $47 & 8;
     $49 = $48 | $45;
     $50 = $46 >>> $48;
     $51 = $50 >>> 2;
     $52 = $51 & 4;
     $53 = $49 | $52;
     $54 = $50 >>> $52;
     $55 = $54 >>> 1;
     $56 = $55 & 2;
     $57 = $53 | $56;
     $58 = $54 >>> $56;
     $59 = $58 >>> 1;
     $60 = $59 & 1;
     $61 = $57 | $60;
     $62 = $58 >>> $60;
     $63 = (($61) + ($62))|0;
     $64 = $63 << 1;
     $65 = (1224 + ($64<<2)|0);
     $66 = ((($65)) + 8|0);
     $67 = HEAP32[$66>>2]|0;
     $68 = ((($67)) + 8|0);
     $69 = HEAP32[$68>>2]|0;
     $70 = ($69|0)==($65|0);
     if ($70) {
      $71 = 1 << $63;
      $72 = $71 ^ -1;
      $73 = $8 & $72;
      HEAP32[296] = $73;
      $90 = $73;
     } else {
      $74 = ((($69)) + 12|0);
      HEAP32[$74>>2] = $65;
      HEAP32[$66>>2] = $69;
      $90 = $8;
     }
     $75 = $63 << 3;
     $76 = (($75) - ($6))|0;
     $77 = $6 | 3;
     $78 = ((($67)) + 4|0);
     HEAP32[$78>>2] = $77;
     $79 = (($67) + ($6)|0);
     $80 = $76 | 1;
     $81 = ((($79)) + 4|0);
     HEAP32[$81>>2] = $80;
     $82 = (($67) + ($75)|0);
     HEAP32[$82>>2] = $76;
     $83 = ($33|0)==(0);
     if (!($83)) {
      $84 = HEAP32[(1204)>>2]|0;
      $85 = $33 >>> 3;
      $86 = $85 << 1;
      $87 = (1224 + ($86<<2)|0);
      $88 = 1 << $85;
      $89 = $90 & $88;
      $91 = ($89|0)==(0);
      if ($91) {
       $92 = $90 | $88;
       HEAP32[296] = $92;
       $$pre = ((($87)) + 8|0);
       $$0194 = $87;$$pre$phiZ2D = $$pre;
      } else {
       $93 = ((($87)) + 8|0);
       $94 = HEAP32[$93>>2]|0;
       $$0194 = $94;$$pre$phiZ2D = $93;
      }
      HEAP32[$$pre$phiZ2D>>2] = $84;
      $95 = ((($$0194)) + 12|0);
      HEAP32[$95>>2] = $84;
      $96 = ((($84)) + 8|0);
      HEAP32[$96>>2] = $$0194;
      $97 = ((($84)) + 12|0);
      HEAP32[$97>>2] = $87;
     }
     HEAP32[(1192)>>2] = $76;
     HEAP32[(1204)>>2] = $79;
     $$0 = $68;
     STACKTOP = sp;return ($$0|0);
    }
    $98 = HEAP32[(1188)>>2]|0;
    $99 = ($98|0)==(0);
    if ($99) {
     $$0192 = $6;
    } else {
     $100 = (0 - ($98))|0;
     $101 = $98 & $100;
     $102 = (($101) + -1)|0;
     $103 = $102 >>> 12;
     $104 = $103 & 16;
     $105 = $102 >>> $104;
     $106 = $105 >>> 5;
     $107 = $106 & 8;
     $108 = $107 | $104;
     $109 = $105 >>> $107;
     $110 = $109 >>> 2;
     $111 = $110 & 4;
     $112 = $108 | $111;
     $113 = $109 >>> $111;
     $114 = $113 >>> 1;
     $115 = $114 & 2;
     $116 = $112 | $115;
     $117 = $113 >>> $115;
     $118 = $117 >>> 1;
     $119 = $118 & 1;
     $120 = $116 | $119;
     $121 = $117 >>> $119;
     $122 = (($120) + ($121))|0;
     $123 = (1488 + ($122<<2)|0);
     $124 = HEAP32[$123>>2]|0;
     $125 = ((($124)) + 4|0);
     $126 = HEAP32[$125>>2]|0;
     $127 = $126 & -8;
     $128 = (($127) - ($6))|0;
     $$0169$i = $124;$$0170$i = $124;$$0171$i = $128;
     while(1) {
      $129 = ((($$0169$i)) + 16|0);
      $130 = HEAP32[$129>>2]|0;
      $131 = ($130|0)==(0|0);
      if ($131) {
       $132 = ((($$0169$i)) + 20|0);
       $133 = HEAP32[$132>>2]|0;
       $134 = ($133|0)==(0|0);
       if ($134) {
        break;
       } else {
        $136 = $133;
       }
      } else {
       $136 = $130;
      }
      $135 = ((($136)) + 4|0);
      $137 = HEAP32[$135>>2]|0;
      $138 = $137 & -8;
      $139 = (($138) - ($6))|0;
      $140 = ($139>>>0)<($$0171$i>>>0);
      $spec$select$i = $140 ? $139 : $$0171$i;
      $spec$select1$i = $140 ? $136 : $$0170$i;
      $$0169$i = $136;$$0170$i = $spec$select1$i;$$0171$i = $spec$select$i;
     }
     $141 = (($$0170$i) + ($6)|0);
     $142 = ($141>>>0)>($$0170$i>>>0);
     if ($142) {
      $143 = ((($$0170$i)) + 24|0);
      $144 = HEAP32[$143>>2]|0;
      $145 = ((($$0170$i)) + 12|0);
      $146 = HEAP32[$145>>2]|0;
      $147 = ($146|0)==($$0170$i|0);
      do {
       if ($147) {
        $152 = ((($$0170$i)) + 20|0);
        $153 = HEAP32[$152>>2]|0;
        $154 = ($153|0)==(0|0);
        if ($154) {
         $155 = ((($$0170$i)) + 16|0);
         $156 = HEAP32[$155>>2]|0;
         $157 = ($156|0)==(0|0);
         if ($157) {
          $$3$i = 0;
          break;
         } else {
          $$1174$i$ph = $156;$$1176$i$ph = $155;
         }
        } else {
         $$1174$i$ph = $153;$$1176$i$ph = $152;
        }
        $$1174$i = $$1174$i$ph;$$1176$i = $$1176$i$ph;
        while(1) {
         $158 = ((($$1174$i)) + 20|0);
         $159 = HEAP32[$158>>2]|0;
         $160 = ($159|0)==(0|0);
         if ($160) {
          $161 = ((($$1174$i)) + 16|0);
          $162 = HEAP32[$161>>2]|0;
          $163 = ($162|0)==(0|0);
          if ($163) {
           break;
          } else {
           $$1174$i$be = $162;$$1176$i$be = $161;
          }
         } else {
          $$1174$i$be = $159;$$1176$i$be = $158;
         }
         $$1174$i = $$1174$i$be;$$1176$i = $$1176$i$be;
        }
        HEAP32[$$1176$i>>2] = 0;
        $$3$i = $$1174$i;
       } else {
        $148 = ((($$0170$i)) + 8|0);
        $149 = HEAP32[$148>>2]|0;
        $150 = ((($149)) + 12|0);
        HEAP32[$150>>2] = $146;
        $151 = ((($146)) + 8|0);
        HEAP32[$151>>2] = $149;
        $$3$i = $146;
       }
      } while(0);
      $164 = ($144|0)==(0|0);
      do {
       if (!($164)) {
        $165 = ((($$0170$i)) + 28|0);
        $166 = HEAP32[$165>>2]|0;
        $167 = (1488 + ($166<<2)|0);
        $168 = HEAP32[$167>>2]|0;
        $169 = ($$0170$i|0)==($168|0);
        if ($169) {
         HEAP32[$167>>2] = $$3$i;
         $cond$i = ($$3$i|0)==(0|0);
         if ($cond$i) {
          $170 = 1 << $166;
          $171 = $170 ^ -1;
          $172 = $98 & $171;
          HEAP32[(1188)>>2] = $172;
          break;
         }
        } else {
         $173 = ((($144)) + 16|0);
         $174 = HEAP32[$173>>2]|0;
         $175 = ($174|0)==($$0170$i|0);
         $176 = ((($144)) + 20|0);
         $$sink = $175 ? $173 : $176;
         HEAP32[$$sink>>2] = $$3$i;
         $177 = ($$3$i|0)==(0|0);
         if ($177) {
          break;
         }
        }
        $178 = ((($$3$i)) + 24|0);
        HEAP32[$178>>2] = $144;
        $179 = ((($$0170$i)) + 16|0);
        $180 = HEAP32[$179>>2]|0;
        $181 = ($180|0)==(0|0);
        if (!($181)) {
         $182 = ((($$3$i)) + 16|0);
         HEAP32[$182>>2] = $180;
         $183 = ((($180)) + 24|0);
         HEAP32[$183>>2] = $$3$i;
        }
        $184 = ((($$0170$i)) + 20|0);
        $185 = HEAP32[$184>>2]|0;
        $186 = ($185|0)==(0|0);
        if (!($186)) {
         $187 = ((($$3$i)) + 20|0);
         HEAP32[$187>>2] = $185;
         $188 = ((($185)) + 24|0);
         HEAP32[$188>>2] = $$3$i;
        }
       }
      } while(0);
      $189 = ($$0171$i>>>0)<(16);
      if ($189) {
       $190 = (($$0171$i) + ($6))|0;
       $191 = $190 | 3;
       $192 = ((($$0170$i)) + 4|0);
       HEAP32[$192>>2] = $191;
       $193 = (($$0170$i) + ($190)|0);
       $194 = ((($193)) + 4|0);
       $195 = HEAP32[$194>>2]|0;
       $196 = $195 | 1;
       HEAP32[$194>>2] = $196;
      } else {
       $197 = $6 | 3;
       $198 = ((($$0170$i)) + 4|0);
       HEAP32[$198>>2] = $197;
       $199 = $$0171$i | 1;
       $200 = ((($141)) + 4|0);
       HEAP32[$200>>2] = $199;
       $201 = (($141) + ($$0171$i)|0);
       HEAP32[$201>>2] = $$0171$i;
       $202 = ($33|0)==(0);
       if (!($202)) {
        $203 = HEAP32[(1204)>>2]|0;
        $204 = $33 >>> 3;
        $205 = $204 << 1;
        $206 = (1224 + ($205<<2)|0);
        $207 = 1 << $204;
        $208 = $207 & $8;
        $209 = ($208|0)==(0);
        if ($209) {
         $210 = $207 | $8;
         HEAP32[296] = $210;
         $$pre$i = ((($206)) + 8|0);
         $$0$i = $206;$$pre$phi$iZ2D = $$pre$i;
        } else {
         $211 = ((($206)) + 8|0);
         $212 = HEAP32[$211>>2]|0;
         $$0$i = $212;$$pre$phi$iZ2D = $211;
        }
        HEAP32[$$pre$phi$iZ2D>>2] = $203;
        $213 = ((($$0$i)) + 12|0);
        HEAP32[$213>>2] = $203;
        $214 = ((($203)) + 8|0);
        HEAP32[$214>>2] = $$0$i;
        $215 = ((($203)) + 12|0);
        HEAP32[$215>>2] = $206;
       }
       HEAP32[(1192)>>2] = $$0171$i;
       HEAP32[(1204)>>2] = $141;
      }
      $216 = ((($$0170$i)) + 8|0);
      $$0 = $216;
      STACKTOP = sp;return ($$0|0);
     } else {
      $$0192 = $6;
     }
    }
   } else {
    $$0192 = $6;
   }
  } else {
   $217 = ($0>>>0)>(4294967231);
   if ($217) {
    $$0192 = -1;
   } else {
    $218 = (($0) + 11)|0;
    $219 = $218 & -8;
    $220 = HEAP32[(1188)>>2]|0;
    $221 = ($220|0)==(0);
    if ($221) {
     $$0192 = $219;
    } else {
     $222 = (0 - ($219))|0;
     $223 = $218 >>> 8;
     $224 = ($223|0)==(0);
     if ($224) {
      $$0335$i = 0;
     } else {
      $225 = ($219>>>0)>(16777215);
      if ($225) {
       $$0335$i = 31;
      } else {
       $226 = (($223) + 1048320)|0;
       $227 = $226 >>> 16;
       $228 = $227 & 8;
       $229 = $223 << $228;
       $230 = (($229) + 520192)|0;
       $231 = $230 >>> 16;
       $232 = $231 & 4;
       $233 = $232 | $228;
       $234 = $229 << $232;
       $235 = (($234) + 245760)|0;
       $236 = $235 >>> 16;
       $237 = $236 & 2;
       $238 = $233 | $237;
       $239 = (14 - ($238))|0;
       $240 = $234 << $237;
       $241 = $240 >>> 15;
       $242 = (($239) + ($241))|0;
       $243 = $242 << 1;
       $244 = (($242) + 7)|0;
       $245 = $219 >>> $244;
       $246 = $245 & 1;
       $247 = $246 | $243;
       $$0335$i = $247;
      }
     }
     $248 = (1488 + ($$0335$i<<2)|0);
     $249 = HEAP32[$248>>2]|0;
     $250 = ($249|0)==(0|0);
     L79: do {
      if ($250) {
       $$2331$i = 0;$$3$i198 = 0;$$3326$i = $222;
       label = 61;
      } else {
       $251 = ($$0335$i|0)==(31);
       $252 = $$0335$i >>> 1;
       $253 = (25 - ($252))|0;
       $254 = $251 ? 0 : $253;
       $255 = $219 << $254;
       $$0318$i = 0;$$0323$i = $222;$$0329$i = $249;$$0336$i = $255;$$0339$i = 0;
       while(1) {
        $256 = ((($$0329$i)) + 4|0);
        $257 = HEAP32[$256>>2]|0;
        $258 = $257 & -8;
        $259 = (($258) - ($219))|0;
        $260 = ($259>>>0)<($$0323$i>>>0);
        if ($260) {
         $261 = ($259|0)==(0);
         if ($261) {
          $$415$i$ph = $$0329$i;$$432714$i$ph = 0;$$533413$i$ph = $$0329$i;
          label = 65;
          break L79;
         } else {
          $$1319$i = $$0329$i;$$1324$i = $259;
         }
        } else {
         $$1319$i = $$0318$i;$$1324$i = $$0323$i;
        }
        $262 = ((($$0329$i)) + 20|0);
        $263 = HEAP32[$262>>2]|0;
        $264 = $$0336$i >>> 31;
        $265 = (((($$0329$i)) + 16|0) + ($264<<2)|0);
        $266 = HEAP32[$265>>2]|0;
        $267 = ($263|0)==(0|0);
        $268 = ($263|0)==($266|0);
        $or$cond1$i197 = $267 | $268;
        $$1340$i = $or$cond1$i197 ? $$0339$i : $263;
        $269 = ($266|0)==(0|0);
        $spec$select4$i = $$0336$i << 1;
        if ($269) {
         $$2331$i = $$1340$i;$$3$i198 = $$1319$i;$$3326$i = $$1324$i;
         label = 61;
         break;
        } else {
         $$0318$i = $$1319$i;$$0323$i = $$1324$i;$$0329$i = $266;$$0336$i = $spec$select4$i;$$0339$i = $$1340$i;
        }
       }
      }
     } while(0);
     if ((label|0) == 61) {
      $270 = ($$2331$i|0)==(0|0);
      $271 = ($$3$i198|0)==(0|0);
      $or$cond$i199 = $270 & $271;
      if ($or$cond$i199) {
       $272 = 2 << $$0335$i;
       $273 = (0 - ($272))|0;
       $274 = $272 | $273;
       $275 = $274 & $220;
       $276 = ($275|0)==(0);
       if ($276) {
        $$0192 = $219;
        break;
       }
       $277 = (0 - ($275))|0;
       $278 = $275 & $277;
       $279 = (($278) + -1)|0;
       $280 = $279 >>> 12;
       $281 = $280 & 16;
       $282 = $279 >>> $281;
       $283 = $282 >>> 5;
       $284 = $283 & 8;
       $285 = $284 | $281;
       $286 = $282 >>> $284;
       $287 = $286 >>> 2;
       $288 = $287 & 4;
       $289 = $285 | $288;
       $290 = $286 >>> $288;
       $291 = $290 >>> 1;
       $292 = $291 & 2;
       $293 = $289 | $292;
       $294 = $290 >>> $292;
       $295 = $294 >>> 1;
       $296 = $295 & 1;
       $297 = $293 | $296;
       $298 = $294 >>> $296;
       $299 = (($297) + ($298))|0;
       $300 = (1488 + ($299<<2)|0);
       $301 = HEAP32[$300>>2]|0;
       $$3$i198211 = 0;$$4333$i = $301;
      } else {
       $$3$i198211 = $$3$i198;$$4333$i = $$2331$i;
      }
      $302 = ($$4333$i|0)==(0|0);
      if ($302) {
       $$4$lcssa$i = $$3$i198211;$$4327$lcssa$i = $$3326$i;
      } else {
       $$415$i$ph = $$3$i198211;$$432714$i$ph = $$3326$i;$$533413$i$ph = $$4333$i;
       label = 65;
      }
     }
     if ((label|0) == 65) {
      $$415$i = $$415$i$ph;$$432714$i = $$432714$i$ph;$$533413$i = $$533413$i$ph;
      while(1) {
       $303 = ((($$533413$i)) + 4|0);
       $304 = HEAP32[$303>>2]|0;
       $305 = $304 & -8;
       $306 = (($305) - ($219))|0;
       $307 = ($306>>>0)<($$432714$i>>>0);
       $spec$select$i201 = $307 ? $306 : $$432714$i;
       $spec$select2$i = $307 ? $$533413$i : $$415$i;
       $308 = ((($$533413$i)) + 16|0);
       $309 = HEAP32[$308>>2]|0;
       $310 = ($309|0)==(0|0);
       if ($310) {
        $311 = ((($$533413$i)) + 20|0);
        $312 = HEAP32[$311>>2]|0;
        $314 = $312;
       } else {
        $314 = $309;
       }
       $313 = ($314|0)==(0|0);
       if ($313) {
        $$4$lcssa$i = $spec$select2$i;$$4327$lcssa$i = $spec$select$i201;
        break;
       } else {
        $$415$i = $spec$select2$i;$$432714$i = $spec$select$i201;$$533413$i = $314;
       }
      }
     }
     $315 = ($$4$lcssa$i|0)==(0|0);
     if ($315) {
      $$0192 = $219;
     } else {
      $316 = HEAP32[(1192)>>2]|0;
      $317 = (($316) - ($219))|0;
      $318 = ($$4327$lcssa$i>>>0)<($317>>>0);
      if ($318) {
       $319 = (($$4$lcssa$i) + ($219)|0);
       $320 = ($319>>>0)>($$4$lcssa$i>>>0);
       if ($320) {
        $321 = ((($$4$lcssa$i)) + 24|0);
        $322 = HEAP32[$321>>2]|0;
        $323 = ((($$4$lcssa$i)) + 12|0);
        $324 = HEAP32[$323>>2]|0;
        $325 = ($324|0)==($$4$lcssa$i|0);
        do {
         if ($325) {
          $330 = ((($$4$lcssa$i)) + 20|0);
          $331 = HEAP32[$330>>2]|0;
          $332 = ($331|0)==(0|0);
          if ($332) {
           $333 = ((($$4$lcssa$i)) + 16|0);
           $334 = HEAP32[$333>>2]|0;
           $335 = ($334|0)==(0|0);
           if ($335) {
            $$3348$i = 0;
            break;
           } else {
            $$1346$i$ph = $334;$$1350$i$ph = $333;
           }
          } else {
           $$1346$i$ph = $331;$$1350$i$ph = $330;
          }
          $$1346$i = $$1346$i$ph;$$1350$i = $$1350$i$ph;
          while(1) {
           $336 = ((($$1346$i)) + 20|0);
           $337 = HEAP32[$336>>2]|0;
           $338 = ($337|0)==(0|0);
           if ($338) {
            $339 = ((($$1346$i)) + 16|0);
            $340 = HEAP32[$339>>2]|0;
            $341 = ($340|0)==(0|0);
            if ($341) {
             break;
            } else {
             $$1346$i$be = $340;$$1350$i$be = $339;
            }
           } else {
            $$1346$i$be = $337;$$1350$i$be = $336;
           }
           $$1346$i = $$1346$i$be;$$1350$i = $$1350$i$be;
          }
          HEAP32[$$1350$i>>2] = 0;
          $$3348$i = $$1346$i;
         } else {
          $326 = ((($$4$lcssa$i)) + 8|0);
          $327 = HEAP32[$326>>2]|0;
          $328 = ((($327)) + 12|0);
          HEAP32[$328>>2] = $324;
          $329 = ((($324)) + 8|0);
          HEAP32[$329>>2] = $327;
          $$3348$i = $324;
         }
        } while(0);
        $342 = ($322|0)==(0|0);
        do {
         if ($342) {
          $425 = $220;
         } else {
          $343 = ((($$4$lcssa$i)) + 28|0);
          $344 = HEAP32[$343>>2]|0;
          $345 = (1488 + ($344<<2)|0);
          $346 = HEAP32[$345>>2]|0;
          $347 = ($$4$lcssa$i|0)==($346|0);
          if ($347) {
           HEAP32[$345>>2] = $$3348$i;
           $cond$i203 = ($$3348$i|0)==(0|0);
           if ($cond$i203) {
            $348 = 1 << $344;
            $349 = $348 ^ -1;
            $350 = $220 & $349;
            HEAP32[(1188)>>2] = $350;
            $425 = $350;
            break;
           }
          } else {
           $351 = ((($322)) + 16|0);
           $352 = HEAP32[$351>>2]|0;
           $353 = ($352|0)==($$4$lcssa$i|0);
           $354 = ((($322)) + 20|0);
           $$sink320 = $353 ? $351 : $354;
           HEAP32[$$sink320>>2] = $$3348$i;
           $355 = ($$3348$i|0)==(0|0);
           if ($355) {
            $425 = $220;
            break;
           }
          }
          $356 = ((($$3348$i)) + 24|0);
          HEAP32[$356>>2] = $322;
          $357 = ((($$4$lcssa$i)) + 16|0);
          $358 = HEAP32[$357>>2]|0;
          $359 = ($358|0)==(0|0);
          if (!($359)) {
           $360 = ((($$3348$i)) + 16|0);
           HEAP32[$360>>2] = $358;
           $361 = ((($358)) + 24|0);
           HEAP32[$361>>2] = $$3348$i;
          }
          $362 = ((($$4$lcssa$i)) + 20|0);
          $363 = HEAP32[$362>>2]|0;
          $364 = ($363|0)==(0|0);
          if ($364) {
           $425 = $220;
          } else {
           $365 = ((($$3348$i)) + 20|0);
           HEAP32[$365>>2] = $363;
           $366 = ((($363)) + 24|0);
           HEAP32[$366>>2] = $$3348$i;
           $425 = $220;
          }
         }
        } while(0);
        $367 = ($$4327$lcssa$i>>>0)<(16);
        L128: do {
         if ($367) {
          $368 = (($$4327$lcssa$i) + ($219))|0;
          $369 = $368 | 3;
          $370 = ((($$4$lcssa$i)) + 4|0);
          HEAP32[$370>>2] = $369;
          $371 = (($$4$lcssa$i) + ($368)|0);
          $372 = ((($371)) + 4|0);
          $373 = HEAP32[$372>>2]|0;
          $374 = $373 | 1;
          HEAP32[$372>>2] = $374;
         } else {
          $375 = $219 | 3;
          $376 = ((($$4$lcssa$i)) + 4|0);
          HEAP32[$376>>2] = $375;
          $377 = $$4327$lcssa$i | 1;
          $378 = ((($319)) + 4|0);
          HEAP32[$378>>2] = $377;
          $379 = (($319) + ($$4327$lcssa$i)|0);
          HEAP32[$379>>2] = $$4327$lcssa$i;
          $380 = $$4327$lcssa$i >>> 3;
          $381 = ($$4327$lcssa$i>>>0)<(256);
          if ($381) {
           $382 = $380 << 1;
           $383 = (1224 + ($382<<2)|0);
           $384 = HEAP32[296]|0;
           $385 = 1 << $380;
           $386 = $384 & $385;
           $387 = ($386|0)==(0);
           if ($387) {
            $388 = $384 | $385;
            HEAP32[296] = $388;
            $$pre$i204 = ((($383)) + 8|0);
            $$0344$i = $383;$$pre$phi$i205Z2D = $$pre$i204;
           } else {
            $389 = ((($383)) + 8|0);
            $390 = HEAP32[$389>>2]|0;
            $$0344$i = $390;$$pre$phi$i205Z2D = $389;
           }
           HEAP32[$$pre$phi$i205Z2D>>2] = $319;
           $391 = ((($$0344$i)) + 12|0);
           HEAP32[$391>>2] = $319;
           $392 = ((($319)) + 8|0);
           HEAP32[$392>>2] = $$0344$i;
           $393 = ((($319)) + 12|0);
           HEAP32[$393>>2] = $383;
           break;
          }
          $394 = $$4327$lcssa$i >>> 8;
          $395 = ($394|0)==(0);
          if ($395) {
           $$0338$i = 0;
          } else {
           $396 = ($$4327$lcssa$i>>>0)>(16777215);
           if ($396) {
            $$0338$i = 31;
           } else {
            $397 = (($394) + 1048320)|0;
            $398 = $397 >>> 16;
            $399 = $398 & 8;
            $400 = $394 << $399;
            $401 = (($400) + 520192)|0;
            $402 = $401 >>> 16;
            $403 = $402 & 4;
            $404 = $403 | $399;
            $405 = $400 << $403;
            $406 = (($405) + 245760)|0;
            $407 = $406 >>> 16;
            $408 = $407 & 2;
            $409 = $404 | $408;
            $410 = (14 - ($409))|0;
            $411 = $405 << $408;
            $412 = $411 >>> 15;
            $413 = (($410) + ($412))|0;
            $414 = $413 << 1;
            $415 = (($413) + 7)|0;
            $416 = $$4327$lcssa$i >>> $415;
            $417 = $416 & 1;
            $418 = $417 | $414;
            $$0338$i = $418;
           }
          }
          $419 = (1488 + ($$0338$i<<2)|0);
          $420 = ((($319)) + 28|0);
          HEAP32[$420>>2] = $$0338$i;
          $421 = ((($319)) + 16|0);
          $422 = ((($421)) + 4|0);
          HEAP32[$422>>2] = 0;
          HEAP32[$421>>2] = 0;
          $423 = 1 << $$0338$i;
          $424 = $425 & $423;
          $426 = ($424|0)==(0);
          if ($426) {
           $427 = $425 | $423;
           HEAP32[(1188)>>2] = $427;
           HEAP32[$419>>2] = $319;
           $428 = ((($319)) + 24|0);
           HEAP32[$428>>2] = $419;
           $429 = ((($319)) + 12|0);
           HEAP32[$429>>2] = $319;
           $430 = ((($319)) + 8|0);
           HEAP32[$430>>2] = $319;
           break;
          }
          $431 = HEAP32[$419>>2]|0;
          $432 = ((($431)) + 4|0);
          $433 = HEAP32[$432>>2]|0;
          $434 = $433 & -8;
          $435 = ($434|0)==($$4327$lcssa$i|0);
          L145: do {
           if ($435) {
            $$0321$lcssa$i = $431;
           } else {
            $436 = ($$0338$i|0)==(31);
            $437 = $$0338$i >>> 1;
            $438 = (25 - ($437))|0;
            $439 = $436 ? 0 : $438;
            $440 = $$4327$lcssa$i << $439;
            $$032012$i = $440;$$032111$i = $431;
            while(1) {
             $447 = $$032012$i >>> 31;
             $448 = (((($$032111$i)) + 16|0) + ($447<<2)|0);
             $443 = HEAP32[$448>>2]|0;
             $449 = ($443|0)==(0|0);
             if ($449) {
              break;
             }
             $441 = $$032012$i << 1;
             $442 = ((($443)) + 4|0);
             $444 = HEAP32[$442>>2]|0;
             $445 = $444 & -8;
             $446 = ($445|0)==($$4327$lcssa$i|0);
             if ($446) {
              $$0321$lcssa$i = $443;
              break L145;
             } else {
              $$032012$i = $441;$$032111$i = $443;
             }
            }
            HEAP32[$448>>2] = $319;
            $450 = ((($319)) + 24|0);
            HEAP32[$450>>2] = $$032111$i;
            $451 = ((($319)) + 12|0);
            HEAP32[$451>>2] = $319;
            $452 = ((($319)) + 8|0);
            HEAP32[$452>>2] = $319;
            break L128;
           }
          } while(0);
          $453 = ((($$0321$lcssa$i)) + 8|0);
          $454 = HEAP32[$453>>2]|0;
          $455 = ((($454)) + 12|0);
          HEAP32[$455>>2] = $319;
          HEAP32[$453>>2] = $319;
          $456 = ((($319)) + 8|0);
          HEAP32[$456>>2] = $454;
          $457 = ((($319)) + 12|0);
          HEAP32[$457>>2] = $$0321$lcssa$i;
          $458 = ((($319)) + 24|0);
          HEAP32[$458>>2] = 0;
         }
        } while(0);
        $459 = ((($$4$lcssa$i)) + 8|0);
        $$0 = $459;
        STACKTOP = sp;return ($$0|0);
       } else {
        $$0192 = $219;
       }
      } else {
       $$0192 = $219;
      }
     }
    }
   }
  }
 } while(0);
 $460 = HEAP32[(1192)>>2]|0;
 $461 = ($460>>>0)<($$0192>>>0);
 if (!($461)) {
  $462 = (($460) - ($$0192))|0;
  $463 = HEAP32[(1204)>>2]|0;
  $464 = ($462>>>0)>(15);
  if ($464) {
   $465 = (($463) + ($$0192)|0);
   HEAP32[(1204)>>2] = $465;
   HEAP32[(1192)>>2] = $462;
   $466 = $462 | 1;
   $467 = ((($465)) + 4|0);
   HEAP32[$467>>2] = $466;
   $468 = (($463) + ($460)|0);
   HEAP32[$468>>2] = $462;
   $469 = $$0192 | 3;
   $470 = ((($463)) + 4|0);
   HEAP32[$470>>2] = $469;
  } else {
   HEAP32[(1192)>>2] = 0;
   HEAP32[(1204)>>2] = 0;
   $471 = $460 | 3;
   $472 = ((($463)) + 4|0);
   HEAP32[$472>>2] = $471;
   $473 = (($463) + ($460)|0);
   $474 = ((($473)) + 4|0);
   $475 = HEAP32[$474>>2]|0;
   $476 = $475 | 1;
   HEAP32[$474>>2] = $476;
  }
  $477 = ((($463)) + 8|0);
  $$0 = $477;
  STACKTOP = sp;return ($$0|0);
 }
 $478 = HEAP32[(1196)>>2]|0;
 $479 = ($478>>>0)>($$0192>>>0);
 if ($479) {
  $480 = (($478) - ($$0192))|0;
  HEAP32[(1196)>>2] = $480;
  $481 = HEAP32[(1208)>>2]|0;
  $482 = (($481) + ($$0192)|0);
  HEAP32[(1208)>>2] = $482;
  $483 = $480 | 1;
  $484 = ((($482)) + 4|0);
  HEAP32[$484>>2] = $483;
  $485 = $$0192 | 3;
  $486 = ((($481)) + 4|0);
  HEAP32[$486>>2] = $485;
  $487 = ((($481)) + 8|0);
  $$0 = $487;
  STACKTOP = sp;return ($$0|0);
 }
 $488 = HEAP32[414]|0;
 $489 = ($488|0)==(0);
 if ($489) {
  HEAP32[(1664)>>2] = 4096;
  HEAP32[(1660)>>2] = 4096;
  HEAP32[(1668)>>2] = -1;
  HEAP32[(1672)>>2] = -1;
  HEAP32[(1676)>>2] = 0;
  HEAP32[(1628)>>2] = 0;
  $490 = $1;
  $491 = $490 & -16;
  $492 = $491 ^ 1431655768;
  HEAP32[414] = $492;
  $496 = 4096;
 } else {
  $$pre$i195 = HEAP32[(1664)>>2]|0;
  $496 = $$pre$i195;
 }
 $493 = (($$0192) + 48)|0;
 $494 = (($$0192) + 47)|0;
 $495 = (($496) + ($494))|0;
 $497 = (0 - ($496))|0;
 $498 = $495 & $497;
 $499 = ($498>>>0)>($$0192>>>0);
 if (!($499)) {
  $$0 = 0;
  STACKTOP = sp;return ($$0|0);
 }
 $500 = HEAP32[(1624)>>2]|0;
 $501 = ($500|0)==(0);
 if (!($501)) {
  $502 = HEAP32[(1616)>>2]|0;
  $503 = (($502) + ($498))|0;
  $504 = ($503>>>0)<=($502>>>0);
  $505 = ($503>>>0)>($500>>>0);
  $or$cond1$i = $504 | $505;
  if ($or$cond1$i) {
   $$0 = 0;
   STACKTOP = sp;return ($$0|0);
  }
 }
 $506 = HEAP32[(1628)>>2]|0;
 $507 = $506 & 4;
 $508 = ($507|0)==(0);
 L178: do {
  if ($508) {
   $509 = HEAP32[(1208)>>2]|0;
   $510 = ($509|0)==(0|0);
   L180: do {
    if ($510) {
     label = 128;
    } else {
     $$0$i20$i = (1632);
     while(1) {
      $511 = HEAP32[$$0$i20$i>>2]|0;
      $512 = ($511>>>0)>($509>>>0);
      if (!($512)) {
       $513 = ((($$0$i20$i)) + 4|0);
       $514 = HEAP32[$513>>2]|0;
       $515 = (($511) + ($514)|0);
       $516 = ($515>>>0)>($509>>>0);
       if ($516) {
        break;
       }
      }
      $517 = ((($$0$i20$i)) + 8|0);
      $518 = HEAP32[$517>>2]|0;
      $519 = ($518|0)==(0|0);
      if ($519) {
       label = 128;
       break L180;
      } else {
       $$0$i20$i = $518;
      }
     }
     $542 = (($495) - ($478))|0;
     $543 = $542 & $497;
     $544 = ($543>>>0)<(2147483647);
     if ($544) {
      $545 = ((($$0$i20$i)) + 4|0);
      $546 = (_sbrk(($543|0))|0);
      $547 = HEAP32[$$0$i20$i>>2]|0;
      $548 = HEAP32[$545>>2]|0;
      $549 = (($547) + ($548)|0);
      $550 = ($546|0)==($549|0);
      if ($550) {
       $551 = ($546|0)==((-1)|0);
       if ($551) {
        $$2234243136$i = $543;
       } else {
        $$723947$i = $543;$$748$i = $546;
        label = 145;
        break L178;
       }
      } else {
       $$2247$ph$i = $546;$$2253$ph$i = $543;
       label = 136;
      }
     } else {
      $$2234243136$i = 0;
     }
    }
   } while(0);
   do {
    if ((label|0) == 128) {
     $520 = (_sbrk(0)|0);
     $521 = ($520|0)==((-1)|0);
     if ($521) {
      $$2234243136$i = 0;
     } else {
      $522 = $520;
      $523 = HEAP32[(1660)>>2]|0;
      $524 = (($523) + -1)|0;
      $525 = $524 & $522;
      $526 = ($525|0)==(0);
      $527 = (($524) + ($522))|0;
      $528 = (0 - ($523))|0;
      $529 = $527 & $528;
      $530 = (($529) - ($522))|0;
      $531 = $526 ? 0 : $530;
      $spec$select49$i = (($531) + ($498))|0;
      $532 = HEAP32[(1616)>>2]|0;
      $533 = (($spec$select49$i) + ($532))|0;
      $534 = ($spec$select49$i>>>0)>($$0192>>>0);
      $535 = ($spec$select49$i>>>0)<(2147483647);
      $or$cond$i = $534 & $535;
      if ($or$cond$i) {
       $536 = HEAP32[(1624)>>2]|0;
       $537 = ($536|0)==(0);
       if (!($537)) {
        $538 = ($533>>>0)<=($532>>>0);
        $539 = ($533>>>0)>($536>>>0);
        $or$cond2$i = $538 | $539;
        if ($or$cond2$i) {
         $$2234243136$i = 0;
         break;
        }
       }
       $540 = (_sbrk(($spec$select49$i|0))|0);
       $541 = ($540|0)==($520|0);
       if ($541) {
        $$723947$i = $spec$select49$i;$$748$i = $520;
        label = 145;
        break L178;
       } else {
        $$2247$ph$i = $540;$$2253$ph$i = $spec$select49$i;
        label = 136;
       }
      } else {
       $$2234243136$i = 0;
      }
     }
    }
   } while(0);
   do {
    if ((label|0) == 136) {
     $552 = (0 - ($$2253$ph$i))|0;
     $553 = ($$2247$ph$i|0)!=((-1)|0);
     $554 = ($$2253$ph$i>>>0)<(2147483647);
     $or$cond7$i = $554 & $553;
     $555 = ($493>>>0)>($$2253$ph$i>>>0);
     $or$cond6$i = $555 & $or$cond7$i;
     if (!($or$cond6$i)) {
      $565 = ($$2247$ph$i|0)==((-1)|0);
      if ($565) {
       $$2234243136$i = 0;
       break;
      } else {
       $$723947$i = $$2253$ph$i;$$748$i = $$2247$ph$i;
       label = 145;
       break L178;
      }
     }
     $556 = HEAP32[(1664)>>2]|0;
     $557 = (($494) - ($$2253$ph$i))|0;
     $558 = (($557) + ($556))|0;
     $559 = (0 - ($556))|0;
     $560 = $558 & $559;
     $561 = ($560>>>0)<(2147483647);
     if (!($561)) {
      $$723947$i = $$2253$ph$i;$$748$i = $$2247$ph$i;
      label = 145;
      break L178;
     }
     $562 = (_sbrk(($560|0))|0);
     $563 = ($562|0)==((-1)|0);
     if ($563) {
      (_sbrk(($552|0))|0);
      $$2234243136$i = 0;
      break;
     } else {
      $564 = (($560) + ($$2253$ph$i))|0;
      $$723947$i = $564;$$748$i = $$2247$ph$i;
      label = 145;
      break L178;
     }
    }
   } while(0);
   $566 = HEAP32[(1628)>>2]|0;
   $567 = $566 | 4;
   HEAP32[(1628)>>2] = $567;
   $$4236$i = $$2234243136$i;
   label = 143;
  } else {
   $$4236$i = 0;
   label = 143;
  }
 } while(0);
 if ((label|0) == 143) {
  $568 = ($498>>>0)<(2147483647);
  if ($568) {
   $569 = (_sbrk(($498|0))|0);
   $570 = (_sbrk(0)|0);
   $571 = ($569|0)!=((-1)|0);
   $572 = ($570|0)!=((-1)|0);
   $or$cond5$i = $571 & $572;
   $573 = ($569>>>0)<($570>>>0);
   $or$cond8$i = $573 & $or$cond5$i;
   $574 = $570;
   $575 = $569;
   $576 = (($574) - ($575))|0;
   $577 = (($$0192) + 40)|0;
   $578 = ($576>>>0)>($577>>>0);
   $spec$select9$i = $578 ? $576 : $$4236$i;
   $or$cond8$not$i = $or$cond8$i ^ 1;
   $579 = ($569|0)==((-1)|0);
   $not$$i = $578 ^ 1;
   $580 = $579 | $not$$i;
   $or$cond50$i = $580 | $or$cond8$not$i;
   if (!($or$cond50$i)) {
    $$723947$i = $spec$select9$i;$$748$i = $569;
    label = 145;
   }
  }
 }
 if ((label|0) == 145) {
  $581 = HEAP32[(1616)>>2]|0;
  $582 = (($581) + ($$723947$i))|0;
  HEAP32[(1616)>>2] = $582;
  $583 = HEAP32[(1620)>>2]|0;
  $584 = ($582>>>0)>($583>>>0);
  if ($584) {
   HEAP32[(1620)>>2] = $582;
  }
  $585 = HEAP32[(1208)>>2]|0;
  $586 = ($585|0)==(0|0);
  L215: do {
   if ($586) {
    $587 = HEAP32[(1200)>>2]|0;
    $588 = ($587|0)==(0|0);
    $589 = ($$748$i>>>0)<($587>>>0);
    $or$cond11$i = $588 | $589;
    if ($or$cond11$i) {
     HEAP32[(1200)>>2] = $$748$i;
    }
    HEAP32[(1632)>>2] = $$748$i;
    HEAP32[(1636)>>2] = $$723947$i;
    HEAP32[(1644)>>2] = 0;
    $590 = HEAP32[414]|0;
    HEAP32[(1220)>>2] = $590;
    HEAP32[(1216)>>2] = -1;
    HEAP32[(1236)>>2] = (1224);
    HEAP32[(1232)>>2] = (1224);
    HEAP32[(1244)>>2] = (1232);
    HEAP32[(1240)>>2] = (1232);
    HEAP32[(1252)>>2] = (1240);
    HEAP32[(1248)>>2] = (1240);
    HEAP32[(1260)>>2] = (1248);
    HEAP32[(1256)>>2] = (1248);
    HEAP32[(1268)>>2] = (1256);
    HEAP32[(1264)>>2] = (1256);
    HEAP32[(1276)>>2] = (1264);
    HEAP32[(1272)>>2] = (1264);
    HEAP32[(1284)>>2] = (1272);
    HEAP32[(1280)>>2] = (1272);
    HEAP32[(1292)>>2] = (1280);
    HEAP32[(1288)>>2] = (1280);
    HEAP32[(1300)>>2] = (1288);
    HEAP32[(1296)>>2] = (1288);
    HEAP32[(1308)>>2] = (1296);
    HEAP32[(1304)>>2] = (1296);
    HEAP32[(1316)>>2] = (1304);
    HEAP32[(1312)>>2] = (1304);
    HEAP32[(1324)>>2] = (1312);
    HEAP32[(1320)>>2] = (1312);
    HEAP32[(1332)>>2] = (1320);
    HEAP32[(1328)>>2] = (1320);
    HEAP32[(1340)>>2] = (1328);
    HEAP32[(1336)>>2] = (1328);
    HEAP32[(1348)>>2] = (1336);
    HEAP32[(1344)>>2] = (1336);
    HEAP32[(1356)>>2] = (1344);
    HEAP32[(1352)>>2] = (1344);
    HEAP32[(1364)>>2] = (1352);
    HEAP32[(1360)>>2] = (1352);
    HEAP32[(1372)>>2] = (1360);
    HEAP32[(1368)>>2] = (1360);
    HEAP32[(1380)>>2] = (1368);
    HEAP32[(1376)>>2] = (1368);
    HEAP32[(1388)>>2] = (1376);
    HEAP32[(1384)>>2] = (1376);
    HEAP32[(1396)>>2] = (1384);
    HEAP32[(1392)>>2] = (1384);
    HEAP32[(1404)>>2] = (1392);
    HEAP32[(1400)>>2] = (1392);
    HEAP32[(1412)>>2] = (1400);
    HEAP32[(1408)>>2] = (1400);
    HEAP32[(1420)>>2] = (1408);
    HEAP32[(1416)>>2] = (1408);
    HEAP32[(1428)>>2] = (1416);
    HEAP32[(1424)>>2] = (1416);
    HEAP32[(1436)>>2] = (1424);
    HEAP32[(1432)>>2] = (1424);
    HEAP32[(1444)>>2] = (1432);
    HEAP32[(1440)>>2] = (1432);
    HEAP32[(1452)>>2] = (1440);
    HEAP32[(1448)>>2] = (1440);
    HEAP32[(1460)>>2] = (1448);
    HEAP32[(1456)>>2] = (1448);
    HEAP32[(1468)>>2] = (1456);
    HEAP32[(1464)>>2] = (1456);
    HEAP32[(1476)>>2] = (1464);
    HEAP32[(1472)>>2] = (1464);
    HEAP32[(1484)>>2] = (1472);
    HEAP32[(1480)>>2] = (1472);
    $591 = (($$723947$i) + -40)|0;
    $592 = ((($$748$i)) + 8|0);
    $593 = $592;
    $594 = $593 & 7;
    $595 = ($594|0)==(0);
    $596 = (0 - ($593))|0;
    $597 = $596 & 7;
    $598 = $595 ? 0 : $597;
    $599 = (($$748$i) + ($598)|0);
    $600 = (($591) - ($598))|0;
    HEAP32[(1208)>>2] = $599;
    HEAP32[(1196)>>2] = $600;
    $601 = $600 | 1;
    $602 = ((($599)) + 4|0);
    HEAP32[$602>>2] = $601;
    $603 = (($$748$i) + ($591)|0);
    $604 = ((($603)) + 4|0);
    HEAP32[$604>>2] = 40;
    $605 = HEAP32[(1672)>>2]|0;
    HEAP32[(1212)>>2] = $605;
   } else {
    $$024372$i = (1632);
    while(1) {
     $606 = HEAP32[$$024372$i>>2]|0;
     $607 = ((($$024372$i)) + 4|0);
     $608 = HEAP32[$607>>2]|0;
     $609 = (($606) + ($608)|0);
     $610 = ($$748$i|0)==($609|0);
     if ($610) {
      label = 154;
      break;
     }
     $611 = ((($$024372$i)) + 8|0);
     $612 = HEAP32[$611>>2]|0;
     $613 = ($612|0)==(0|0);
     if ($613) {
      break;
     } else {
      $$024372$i = $612;
     }
    }
    if ((label|0) == 154) {
     $614 = ((($$024372$i)) + 4|0);
     $615 = ((($$024372$i)) + 12|0);
     $616 = HEAP32[$615>>2]|0;
     $617 = $616 & 8;
     $618 = ($617|0)==(0);
     if ($618) {
      $619 = ($606>>>0)<=($585>>>0);
      $620 = ($$748$i>>>0)>($585>>>0);
      $or$cond51$i = $620 & $619;
      if ($or$cond51$i) {
       $621 = (($608) + ($$723947$i))|0;
       HEAP32[$614>>2] = $621;
       $622 = HEAP32[(1196)>>2]|0;
       $623 = (($622) + ($$723947$i))|0;
       $624 = ((($585)) + 8|0);
       $625 = $624;
       $626 = $625 & 7;
       $627 = ($626|0)==(0);
       $628 = (0 - ($625))|0;
       $629 = $628 & 7;
       $630 = $627 ? 0 : $629;
       $631 = (($585) + ($630)|0);
       $632 = (($623) - ($630))|0;
       HEAP32[(1208)>>2] = $631;
       HEAP32[(1196)>>2] = $632;
       $633 = $632 | 1;
       $634 = ((($631)) + 4|0);
       HEAP32[$634>>2] = $633;
       $635 = (($585) + ($623)|0);
       $636 = ((($635)) + 4|0);
       HEAP32[$636>>2] = 40;
       $637 = HEAP32[(1672)>>2]|0;
       HEAP32[(1212)>>2] = $637;
       break;
      }
     }
    }
    $638 = HEAP32[(1200)>>2]|0;
    $639 = ($$748$i>>>0)<($638>>>0);
    if ($639) {
     HEAP32[(1200)>>2] = $$748$i;
    }
    $640 = (($$748$i) + ($$723947$i)|0);
    $$124471$i = (1632);
    while(1) {
     $641 = HEAP32[$$124471$i>>2]|0;
     $642 = ($641|0)==($640|0);
     if ($642) {
      label = 162;
      break;
     }
     $643 = ((($$124471$i)) + 8|0);
     $644 = HEAP32[$643>>2]|0;
     $645 = ($644|0)==(0|0);
     if ($645) {
      break;
     } else {
      $$124471$i = $644;
     }
    }
    if ((label|0) == 162) {
     $646 = ((($$124471$i)) + 12|0);
     $647 = HEAP32[$646>>2]|0;
     $648 = $647 & 8;
     $649 = ($648|0)==(0);
     if ($649) {
      HEAP32[$$124471$i>>2] = $$748$i;
      $650 = ((($$124471$i)) + 4|0);
      $651 = HEAP32[$650>>2]|0;
      $652 = (($651) + ($$723947$i))|0;
      HEAP32[$650>>2] = $652;
      $653 = ((($$748$i)) + 8|0);
      $654 = $653;
      $655 = $654 & 7;
      $656 = ($655|0)==(0);
      $657 = (0 - ($654))|0;
      $658 = $657 & 7;
      $659 = $656 ? 0 : $658;
      $660 = (($$748$i) + ($659)|0);
      $661 = ((($640)) + 8|0);
      $662 = $661;
      $663 = $662 & 7;
      $664 = ($663|0)==(0);
      $665 = (0 - ($662))|0;
      $666 = $665 & 7;
      $667 = $664 ? 0 : $666;
      $668 = (($640) + ($667)|0);
      $669 = $668;
      $670 = $660;
      $671 = (($669) - ($670))|0;
      $672 = (($660) + ($$0192)|0);
      $673 = (($671) - ($$0192))|0;
      $674 = $$0192 | 3;
      $675 = ((($660)) + 4|0);
      HEAP32[$675>>2] = $674;
      $676 = ($585|0)==($668|0);
      L238: do {
       if ($676) {
        $677 = HEAP32[(1196)>>2]|0;
        $678 = (($677) + ($673))|0;
        HEAP32[(1196)>>2] = $678;
        HEAP32[(1208)>>2] = $672;
        $679 = $678 | 1;
        $680 = ((($672)) + 4|0);
        HEAP32[$680>>2] = $679;
       } else {
        $681 = HEAP32[(1204)>>2]|0;
        $682 = ($681|0)==($668|0);
        if ($682) {
         $683 = HEAP32[(1192)>>2]|0;
         $684 = (($683) + ($673))|0;
         HEAP32[(1192)>>2] = $684;
         HEAP32[(1204)>>2] = $672;
         $685 = $684 | 1;
         $686 = ((($672)) + 4|0);
         HEAP32[$686>>2] = $685;
         $687 = (($672) + ($684)|0);
         HEAP32[$687>>2] = $684;
         break;
        }
        $688 = ((($668)) + 4|0);
        $689 = HEAP32[$688>>2]|0;
        $690 = $689 & 3;
        $691 = ($690|0)==(1);
        if ($691) {
         $692 = $689 & -8;
         $693 = $689 >>> 3;
         $694 = ($689>>>0)<(256);
         L246: do {
          if ($694) {
           $695 = ((($668)) + 8|0);
           $696 = HEAP32[$695>>2]|0;
           $697 = ((($668)) + 12|0);
           $698 = HEAP32[$697>>2]|0;
           $699 = ($698|0)==($696|0);
           if ($699) {
            $700 = 1 << $693;
            $701 = $700 ^ -1;
            $702 = HEAP32[296]|0;
            $703 = $702 & $701;
            HEAP32[296] = $703;
            break;
           } else {
            $704 = ((($696)) + 12|0);
            HEAP32[$704>>2] = $698;
            $705 = ((($698)) + 8|0);
            HEAP32[$705>>2] = $696;
            break;
           }
          } else {
           $706 = ((($668)) + 24|0);
           $707 = HEAP32[$706>>2]|0;
           $708 = ((($668)) + 12|0);
           $709 = HEAP32[$708>>2]|0;
           $710 = ($709|0)==($668|0);
           do {
            if ($710) {
             $715 = ((($668)) + 16|0);
             $716 = ((($715)) + 4|0);
             $717 = HEAP32[$716>>2]|0;
             $718 = ($717|0)==(0|0);
             if ($718) {
              $719 = HEAP32[$715>>2]|0;
              $720 = ($719|0)==(0|0);
              if ($720) {
               $$3$i$i = 0;
               break;
              } else {
               $$1263$i$i$ph = $719;$$1265$i$i$ph = $715;
              }
             } else {
              $$1263$i$i$ph = $717;$$1265$i$i$ph = $716;
             }
             $$1263$i$i = $$1263$i$i$ph;$$1265$i$i = $$1265$i$i$ph;
             while(1) {
              $721 = ((($$1263$i$i)) + 20|0);
              $722 = HEAP32[$721>>2]|0;
              $723 = ($722|0)==(0|0);
              if ($723) {
               $724 = ((($$1263$i$i)) + 16|0);
               $725 = HEAP32[$724>>2]|0;
               $726 = ($725|0)==(0|0);
               if ($726) {
                break;
               } else {
                $$1263$i$i$be = $725;$$1265$i$i$be = $724;
               }
              } else {
               $$1263$i$i$be = $722;$$1265$i$i$be = $721;
              }
              $$1263$i$i = $$1263$i$i$be;$$1265$i$i = $$1265$i$i$be;
             }
             HEAP32[$$1265$i$i>>2] = 0;
             $$3$i$i = $$1263$i$i;
            } else {
             $711 = ((($668)) + 8|0);
             $712 = HEAP32[$711>>2]|0;
             $713 = ((($712)) + 12|0);
             HEAP32[$713>>2] = $709;
             $714 = ((($709)) + 8|0);
             HEAP32[$714>>2] = $712;
             $$3$i$i = $709;
            }
           } while(0);
           $727 = ($707|0)==(0|0);
           if ($727) {
            break;
           }
           $728 = ((($668)) + 28|0);
           $729 = HEAP32[$728>>2]|0;
           $730 = (1488 + ($729<<2)|0);
           $731 = HEAP32[$730>>2]|0;
           $732 = ($731|0)==($668|0);
           do {
            if ($732) {
             HEAP32[$730>>2] = $$3$i$i;
             $cond$i$i = ($$3$i$i|0)==(0|0);
             if (!($cond$i$i)) {
              break;
             }
             $733 = 1 << $729;
             $734 = $733 ^ -1;
             $735 = HEAP32[(1188)>>2]|0;
             $736 = $735 & $734;
             HEAP32[(1188)>>2] = $736;
             break L246;
            } else {
             $737 = ((($707)) + 16|0);
             $738 = HEAP32[$737>>2]|0;
             $739 = ($738|0)==($668|0);
             $740 = ((($707)) + 20|0);
             $$sink321 = $739 ? $737 : $740;
             HEAP32[$$sink321>>2] = $$3$i$i;
             $741 = ($$3$i$i|0)==(0|0);
             if ($741) {
              break L246;
             }
            }
           } while(0);
           $742 = ((($$3$i$i)) + 24|0);
           HEAP32[$742>>2] = $707;
           $743 = ((($668)) + 16|0);
           $744 = HEAP32[$743>>2]|0;
           $745 = ($744|0)==(0|0);
           if (!($745)) {
            $746 = ((($$3$i$i)) + 16|0);
            HEAP32[$746>>2] = $744;
            $747 = ((($744)) + 24|0);
            HEAP32[$747>>2] = $$3$i$i;
           }
           $748 = ((($743)) + 4|0);
           $749 = HEAP32[$748>>2]|0;
           $750 = ($749|0)==(0|0);
           if ($750) {
            break;
           }
           $751 = ((($$3$i$i)) + 20|0);
           HEAP32[$751>>2] = $749;
           $752 = ((($749)) + 24|0);
           HEAP32[$752>>2] = $$3$i$i;
          }
         } while(0);
         $753 = (($668) + ($692)|0);
         $754 = (($692) + ($673))|0;
         $$0$i$i = $753;$$0259$i$i = $754;
        } else {
         $$0$i$i = $668;$$0259$i$i = $673;
        }
        $755 = ((($$0$i$i)) + 4|0);
        $756 = HEAP32[$755>>2]|0;
        $757 = $756 & -2;
        HEAP32[$755>>2] = $757;
        $758 = $$0259$i$i | 1;
        $759 = ((($672)) + 4|0);
        HEAP32[$759>>2] = $758;
        $760 = (($672) + ($$0259$i$i)|0);
        HEAP32[$760>>2] = $$0259$i$i;
        $761 = $$0259$i$i >>> 3;
        $762 = ($$0259$i$i>>>0)<(256);
        if ($762) {
         $763 = $761 << 1;
         $764 = (1224 + ($763<<2)|0);
         $765 = HEAP32[296]|0;
         $766 = 1 << $761;
         $767 = $765 & $766;
         $768 = ($767|0)==(0);
         if ($768) {
          $769 = $765 | $766;
          HEAP32[296] = $769;
          $$pre$i16$i = ((($764)) + 8|0);
          $$0267$i$i = $764;$$pre$phi$i17$iZ2D = $$pre$i16$i;
         } else {
          $770 = ((($764)) + 8|0);
          $771 = HEAP32[$770>>2]|0;
          $$0267$i$i = $771;$$pre$phi$i17$iZ2D = $770;
         }
         HEAP32[$$pre$phi$i17$iZ2D>>2] = $672;
         $772 = ((($$0267$i$i)) + 12|0);
         HEAP32[$772>>2] = $672;
         $773 = ((($672)) + 8|0);
         HEAP32[$773>>2] = $$0267$i$i;
         $774 = ((($672)) + 12|0);
         HEAP32[$774>>2] = $764;
         break;
        }
        $775 = $$0259$i$i >>> 8;
        $776 = ($775|0)==(0);
        do {
         if ($776) {
          $$0268$i$i = 0;
         } else {
          $777 = ($$0259$i$i>>>0)>(16777215);
          if ($777) {
           $$0268$i$i = 31;
           break;
          }
          $778 = (($775) + 1048320)|0;
          $779 = $778 >>> 16;
          $780 = $779 & 8;
          $781 = $775 << $780;
          $782 = (($781) + 520192)|0;
          $783 = $782 >>> 16;
          $784 = $783 & 4;
          $785 = $784 | $780;
          $786 = $781 << $784;
          $787 = (($786) + 245760)|0;
          $788 = $787 >>> 16;
          $789 = $788 & 2;
          $790 = $785 | $789;
          $791 = (14 - ($790))|0;
          $792 = $786 << $789;
          $793 = $792 >>> 15;
          $794 = (($791) + ($793))|0;
          $795 = $794 << 1;
          $796 = (($794) + 7)|0;
          $797 = $$0259$i$i >>> $796;
          $798 = $797 & 1;
          $799 = $798 | $795;
          $$0268$i$i = $799;
         }
        } while(0);
        $800 = (1488 + ($$0268$i$i<<2)|0);
        $801 = ((($672)) + 28|0);
        HEAP32[$801>>2] = $$0268$i$i;
        $802 = ((($672)) + 16|0);
        $803 = ((($802)) + 4|0);
        HEAP32[$803>>2] = 0;
        HEAP32[$802>>2] = 0;
        $804 = HEAP32[(1188)>>2]|0;
        $805 = 1 << $$0268$i$i;
        $806 = $804 & $805;
        $807 = ($806|0)==(0);
        if ($807) {
         $808 = $804 | $805;
         HEAP32[(1188)>>2] = $808;
         HEAP32[$800>>2] = $672;
         $809 = ((($672)) + 24|0);
         HEAP32[$809>>2] = $800;
         $810 = ((($672)) + 12|0);
         HEAP32[$810>>2] = $672;
         $811 = ((($672)) + 8|0);
         HEAP32[$811>>2] = $672;
         break;
        }
        $812 = HEAP32[$800>>2]|0;
        $813 = ((($812)) + 4|0);
        $814 = HEAP32[$813>>2]|0;
        $815 = $814 & -8;
        $816 = ($815|0)==($$0259$i$i|0);
        L291: do {
         if ($816) {
          $$0261$lcssa$i$i = $812;
         } else {
          $817 = ($$0268$i$i|0)==(31);
          $818 = $$0268$i$i >>> 1;
          $819 = (25 - ($818))|0;
          $820 = $817 ? 0 : $819;
          $821 = $$0259$i$i << $820;
          $$02604$i$i = $821;$$02613$i$i = $812;
          while(1) {
           $828 = $$02604$i$i >>> 31;
           $829 = (((($$02613$i$i)) + 16|0) + ($828<<2)|0);
           $824 = HEAP32[$829>>2]|0;
           $830 = ($824|0)==(0|0);
           if ($830) {
            break;
           }
           $822 = $$02604$i$i << 1;
           $823 = ((($824)) + 4|0);
           $825 = HEAP32[$823>>2]|0;
           $826 = $825 & -8;
           $827 = ($826|0)==($$0259$i$i|0);
           if ($827) {
            $$0261$lcssa$i$i = $824;
            break L291;
           } else {
            $$02604$i$i = $822;$$02613$i$i = $824;
           }
          }
          HEAP32[$829>>2] = $672;
          $831 = ((($672)) + 24|0);
          HEAP32[$831>>2] = $$02613$i$i;
          $832 = ((($672)) + 12|0);
          HEAP32[$832>>2] = $672;
          $833 = ((($672)) + 8|0);
          HEAP32[$833>>2] = $672;
          break L238;
         }
        } while(0);
        $834 = ((($$0261$lcssa$i$i)) + 8|0);
        $835 = HEAP32[$834>>2]|0;
        $836 = ((($835)) + 12|0);
        HEAP32[$836>>2] = $672;
        HEAP32[$834>>2] = $672;
        $837 = ((($672)) + 8|0);
        HEAP32[$837>>2] = $835;
        $838 = ((($672)) + 12|0);
        HEAP32[$838>>2] = $$0261$lcssa$i$i;
        $839 = ((($672)) + 24|0);
        HEAP32[$839>>2] = 0;
       }
      } while(0);
      $968 = ((($660)) + 8|0);
      $$0 = $968;
      STACKTOP = sp;return ($$0|0);
     }
    }
    $$0$i$i$i = (1632);
    while(1) {
     $840 = HEAP32[$$0$i$i$i>>2]|0;
     $841 = ($840>>>0)>($585>>>0);
     if (!($841)) {
      $842 = ((($$0$i$i$i)) + 4|0);
      $843 = HEAP32[$842>>2]|0;
      $844 = (($840) + ($843)|0);
      $845 = ($844>>>0)>($585>>>0);
      if ($845) {
       break;
      }
     }
     $846 = ((($$0$i$i$i)) + 8|0);
     $847 = HEAP32[$846>>2]|0;
     $$0$i$i$i = $847;
    }
    $848 = ((($844)) + -47|0);
    $849 = ((($848)) + 8|0);
    $850 = $849;
    $851 = $850 & 7;
    $852 = ($851|0)==(0);
    $853 = (0 - ($850))|0;
    $854 = $853 & 7;
    $855 = $852 ? 0 : $854;
    $856 = (($848) + ($855)|0);
    $857 = ((($585)) + 16|0);
    $858 = ($856>>>0)<($857>>>0);
    $859 = $858 ? $585 : $856;
    $860 = ((($859)) + 8|0);
    $861 = ((($859)) + 24|0);
    $862 = (($$723947$i) + -40)|0;
    $863 = ((($$748$i)) + 8|0);
    $864 = $863;
    $865 = $864 & 7;
    $866 = ($865|0)==(0);
    $867 = (0 - ($864))|0;
    $868 = $867 & 7;
    $869 = $866 ? 0 : $868;
    $870 = (($$748$i) + ($869)|0);
    $871 = (($862) - ($869))|0;
    HEAP32[(1208)>>2] = $870;
    HEAP32[(1196)>>2] = $871;
    $872 = $871 | 1;
    $873 = ((($870)) + 4|0);
    HEAP32[$873>>2] = $872;
    $874 = (($$748$i) + ($862)|0);
    $875 = ((($874)) + 4|0);
    HEAP32[$875>>2] = 40;
    $876 = HEAP32[(1672)>>2]|0;
    HEAP32[(1212)>>2] = $876;
    $877 = ((($859)) + 4|0);
    HEAP32[$877>>2] = 27;
    ;HEAP32[$860>>2]=HEAP32[(1632)>>2]|0;HEAP32[$860+4>>2]=HEAP32[(1632)+4>>2]|0;HEAP32[$860+8>>2]=HEAP32[(1632)+8>>2]|0;HEAP32[$860+12>>2]=HEAP32[(1632)+12>>2]|0;
    HEAP32[(1632)>>2] = $$748$i;
    HEAP32[(1636)>>2] = $$723947$i;
    HEAP32[(1644)>>2] = 0;
    HEAP32[(1640)>>2] = $860;
    $879 = $861;
    while(1) {
     $878 = ((($879)) + 4|0);
     HEAP32[$878>>2] = 7;
     $880 = ((($879)) + 8|0);
     $881 = ($880>>>0)<($844>>>0);
     if ($881) {
      $879 = $878;
     } else {
      break;
     }
    }
    $882 = ($859|0)==($585|0);
    if (!($882)) {
     $883 = $859;
     $884 = $585;
     $885 = (($883) - ($884))|0;
     $886 = HEAP32[$877>>2]|0;
     $887 = $886 & -2;
     HEAP32[$877>>2] = $887;
     $888 = $885 | 1;
     $889 = ((($585)) + 4|0);
     HEAP32[$889>>2] = $888;
     HEAP32[$859>>2] = $885;
     $890 = $885 >>> 3;
     $891 = ($885>>>0)<(256);
     if ($891) {
      $892 = $890 << 1;
      $893 = (1224 + ($892<<2)|0);
      $894 = HEAP32[296]|0;
      $895 = 1 << $890;
      $896 = $894 & $895;
      $897 = ($896|0)==(0);
      if ($897) {
       $898 = $894 | $895;
       HEAP32[296] = $898;
       $$pre$i$i = ((($893)) + 8|0);
       $$0206$i$i = $893;$$pre$phi$i$iZ2D = $$pre$i$i;
      } else {
       $899 = ((($893)) + 8|0);
       $900 = HEAP32[$899>>2]|0;
       $$0206$i$i = $900;$$pre$phi$i$iZ2D = $899;
      }
      HEAP32[$$pre$phi$i$iZ2D>>2] = $585;
      $901 = ((($$0206$i$i)) + 12|0);
      HEAP32[$901>>2] = $585;
      $902 = ((($585)) + 8|0);
      HEAP32[$902>>2] = $$0206$i$i;
      $903 = ((($585)) + 12|0);
      HEAP32[$903>>2] = $893;
      break;
     }
     $904 = $885 >>> 8;
     $905 = ($904|0)==(0);
     if ($905) {
      $$0207$i$i = 0;
     } else {
      $906 = ($885>>>0)>(16777215);
      if ($906) {
       $$0207$i$i = 31;
      } else {
       $907 = (($904) + 1048320)|0;
       $908 = $907 >>> 16;
       $909 = $908 & 8;
       $910 = $904 << $909;
       $911 = (($910) + 520192)|0;
       $912 = $911 >>> 16;
       $913 = $912 & 4;
       $914 = $913 | $909;
       $915 = $910 << $913;
       $916 = (($915) + 245760)|0;
       $917 = $916 >>> 16;
       $918 = $917 & 2;
       $919 = $914 | $918;
       $920 = (14 - ($919))|0;
       $921 = $915 << $918;
       $922 = $921 >>> 15;
       $923 = (($920) + ($922))|0;
       $924 = $923 << 1;
       $925 = (($923) + 7)|0;
       $926 = $885 >>> $925;
       $927 = $926 & 1;
       $928 = $927 | $924;
       $$0207$i$i = $928;
      }
     }
     $929 = (1488 + ($$0207$i$i<<2)|0);
     $930 = ((($585)) + 28|0);
     HEAP32[$930>>2] = $$0207$i$i;
     $931 = ((($585)) + 20|0);
     HEAP32[$931>>2] = 0;
     HEAP32[$857>>2] = 0;
     $932 = HEAP32[(1188)>>2]|0;
     $933 = 1 << $$0207$i$i;
     $934 = $932 & $933;
     $935 = ($934|0)==(0);
     if ($935) {
      $936 = $932 | $933;
      HEAP32[(1188)>>2] = $936;
      HEAP32[$929>>2] = $585;
      $937 = ((($585)) + 24|0);
      HEAP32[$937>>2] = $929;
      $938 = ((($585)) + 12|0);
      HEAP32[$938>>2] = $585;
      $939 = ((($585)) + 8|0);
      HEAP32[$939>>2] = $585;
      break;
     }
     $940 = HEAP32[$929>>2]|0;
     $941 = ((($940)) + 4|0);
     $942 = HEAP32[$941>>2]|0;
     $943 = $942 & -8;
     $944 = ($943|0)==($885|0);
     L325: do {
      if ($944) {
       $$0202$lcssa$i$i = $940;
      } else {
       $945 = ($$0207$i$i|0)==(31);
       $946 = $$0207$i$i >>> 1;
       $947 = (25 - ($946))|0;
       $948 = $945 ? 0 : $947;
       $949 = $885 << $948;
       $$02014$i$i = $949;$$02023$i$i = $940;
       while(1) {
        $956 = $$02014$i$i >>> 31;
        $957 = (((($$02023$i$i)) + 16|0) + ($956<<2)|0);
        $952 = HEAP32[$957>>2]|0;
        $958 = ($952|0)==(0|0);
        if ($958) {
         break;
        }
        $950 = $$02014$i$i << 1;
        $951 = ((($952)) + 4|0);
        $953 = HEAP32[$951>>2]|0;
        $954 = $953 & -8;
        $955 = ($954|0)==($885|0);
        if ($955) {
         $$0202$lcssa$i$i = $952;
         break L325;
        } else {
         $$02014$i$i = $950;$$02023$i$i = $952;
        }
       }
       HEAP32[$957>>2] = $585;
       $959 = ((($585)) + 24|0);
       HEAP32[$959>>2] = $$02023$i$i;
       $960 = ((($585)) + 12|0);
       HEAP32[$960>>2] = $585;
       $961 = ((($585)) + 8|0);
       HEAP32[$961>>2] = $585;
       break L215;
      }
     } while(0);
     $962 = ((($$0202$lcssa$i$i)) + 8|0);
     $963 = HEAP32[$962>>2]|0;
     $964 = ((($963)) + 12|0);
     HEAP32[$964>>2] = $585;
     HEAP32[$962>>2] = $585;
     $965 = ((($585)) + 8|0);
     HEAP32[$965>>2] = $963;
     $966 = ((($585)) + 12|0);
     HEAP32[$966>>2] = $$0202$lcssa$i$i;
     $967 = ((($585)) + 24|0);
     HEAP32[$967>>2] = 0;
    }
   }
  } while(0);
  $969 = HEAP32[(1196)>>2]|0;
  $970 = ($969>>>0)>($$0192>>>0);
  if ($970) {
   $971 = (($969) - ($$0192))|0;
   HEAP32[(1196)>>2] = $971;
   $972 = HEAP32[(1208)>>2]|0;
   $973 = (($972) + ($$0192)|0);
   HEAP32[(1208)>>2] = $973;
   $974 = $971 | 1;
   $975 = ((($973)) + 4|0);
   HEAP32[$975>>2] = $974;
   $976 = $$0192 | 3;
   $977 = ((($972)) + 4|0);
   HEAP32[$977>>2] = $976;
   $978 = ((($972)) + 8|0);
   $$0 = $978;
   STACKTOP = sp;return ($$0|0);
  }
 }
 $979 = (___errno_location()|0);
 HEAP32[$979>>2] = 12;
 $$0 = 0;
 STACKTOP = sp;return ($$0|0);
}
function _free($0) {
 $0 = $0|0;
 var $$0194$i = 0, $$0194$in$i = 0, $$0346381 = 0, $$0347$lcssa = 0, $$0347380 = 0, $$0359 = 0, $$0366 = 0, $$1 = 0, $$1345 = 0, $$1350 = 0, $$1350$be = 0, $$1350$ph = 0, $$1353 = 0, $$1353$be = 0, $$1353$ph = 0, $$1361 = 0, $$1361$be = 0, $$1361$ph = 0, $$1365 = 0, $$1365$be = 0;
 var $$1365$ph = 0, $$2 = 0, $$3 = 0, $$3363 = 0, $$pre = 0, $$pre$phiZ2D = 0, $$sink = 0, $$sink395 = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0;
 var $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0;
 var $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0;
 var $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0;
 var $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0;
 var $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0, $189 = 0, $19 = 0, $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $2 = 0;
 var $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0, $206 = 0, $207 = 0, $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0;
 var $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0, $222 = 0, $223 = 0, $224 = 0, $225 = 0, $226 = 0, $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0, $232 = 0, $233 = 0, $234 = 0, $235 = 0;
 var $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0, $241 = 0, $242 = 0, $243 = 0, $244 = 0, $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0, $25 = 0, $250 = 0, $251 = 0, $252 = 0, $253 = 0;
 var $254 = 0, $255 = 0, $256 = 0, $257 = 0, $258 = 0, $259 = 0, $26 = 0, $260 = 0, $261 = 0, $262 = 0, $263 = 0, $264 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0;
 var $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0;
 var $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0;
 var $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0;
 var $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, $cond371 = 0, $cond372 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ($0|0)==(0|0);
 if ($1) {
  return;
 }
 $2 = ((($0)) + -8|0);
 $3 = HEAP32[(1200)>>2]|0;
 $4 = ((($0)) + -4|0);
 $5 = HEAP32[$4>>2]|0;
 $6 = $5 & -8;
 $7 = (($2) + ($6)|0);
 $8 = $5 & 1;
 $9 = ($8|0)==(0);
 do {
  if ($9) {
   $10 = HEAP32[$2>>2]|0;
   $11 = $5 & 3;
   $12 = ($11|0)==(0);
   if ($12) {
    return;
   }
   $13 = (0 - ($10))|0;
   $14 = (($2) + ($13)|0);
   $15 = (($10) + ($6))|0;
   $16 = ($14>>>0)<($3>>>0);
   if ($16) {
    return;
   }
   $17 = HEAP32[(1204)>>2]|0;
   $18 = ($17|0)==($14|0);
   if ($18) {
    $79 = ((($7)) + 4|0);
    $80 = HEAP32[$79>>2]|0;
    $81 = $80 & 3;
    $82 = ($81|0)==(3);
    if (!($82)) {
     $$1 = $14;$$1345 = $15;$88 = $14;
     break;
    }
    $83 = (($14) + ($15)|0);
    $84 = ((($14)) + 4|0);
    $85 = $15 | 1;
    $86 = $80 & -2;
    HEAP32[(1192)>>2] = $15;
    HEAP32[$79>>2] = $86;
    HEAP32[$84>>2] = $85;
    HEAP32[$83>>2] = $15;
    return;
   }
   $19 = $10 >>> 3;
   $20 = ($10>>>0)<(256);
   if ($20) {
    $21 = ((($14)) + 8|0);
    $22 = HEAP32[$21>>2]|0;
    $23 = ((($14)) + 12|0);
    $24 = HEAP32[$23>>2]|0;
    $25 = ($24|0)==($22|0);
    if ($25) {
     $26 = 1 << $19;
     $27 = $26 ^ -1;
     $28 = HEAP32[296]|0;
     $29 = $28 & $27;
     HEAP32[296] = $29;
     $$1 = $14;$$1345 = $15;$88 = $14;
     break;
    } else {
     $30 = ((($22)) + 12|0);
     HEAP32[$30>>2] = $24;
     $31 = ((($24)) + 8|0);
     HEAP32[$31>>2] = $22;
     $$1 = $14;$$1345 = $15;$88 = $14;
     break;
    }
   }
   $32 = ((($14)) + 24|0);
   $33 = HEAP32[$32>>2]|0;
   $34 = ((($14)) + 12|0);
   $35 = HEAP32[$34>>2]|0;
   $36 = ($35|0)==($14|0);
   do {
    if ($36) {
     $41 = ((($14)) + 16|0);
     $42 = ((($41)) + 4|0);
     $43 = HEAP32[$42>>2]|0;
     $44 = ($43|0)==(0|0);
     if ($44) {
      $45 = HEAP32[$41>>2]|0;
      $46 = ($45|0)==(0|0);
      if ($46) {
       $$3 = 0;
       break;
      } else {
       $$1350$ph = $45;$$1353$ph = $41;
      }
     } else {
      $$1350$ph = $43;$$1353$ph = $42;
     }
     $$1350 = $$1350$ph;$$1353 = $$1353$ph;
     while(1) {
      $47 = ((($$1350)) + 20|0);
      $48 = HEAP32[$47>>2]|0;
      $49 = ($48|0)==(0|0);
      if ($49) {
       $50 = ((($$1350)) + 16|0);
       $51 = HEAP32[$50>>2]|0;
       $52 = ($51|0)==(0|0);
       if ($52) {
        break;
       } else {
        $$1350$be = $51;$$1353$be = $50;
       }
      } else {
       $$1350$be = $48;$$1353$be = $47;
      }
      $$1350 = $$1350$be;$$1353 = $$1353$be;
     }
     HEAP32[$$1353>>2] = 0;
     $$3 = $$1350;
    } else {
     $37 = ((($14)) + 8|0);
     $38 = HEAP32[$37>>2]|0;
     $39 = ((($38)) + 12|0);
     HEAP32[$39>>2] = $35;
     $40 = ((($35)) + 8|0);
     HEAP32[$40>>2] = $38;
     $$3 = $35;
    }
   } while(0);
   $53 = ($33|0)==(0|0);
   if ($53) {
    $$1 = $14;$$1345 = $15;$88 = $14;
   } else {
    $54 = ((($14)) + 28|0);
    $55 = HEAP32[$54>>2]|0;
    $56 = (1488 + ($55<<2)|0);
    $57 = HEAP32[$56>>2]|0;
    $58 = ($57|0)==($14|0);
    if ($58) {
     HEAP32[$56>>2] = $$3;
     $cond371 = ($$3|0)==(0|0);
     if ($cond371) {
      $59 = 1 << $55;
      $60 = $59 ^ -1;
      $61 = HEAP32[(1188)>>2]|0;
      $62 = $61 & $60;
      HEAP32[(1188)>>2] = $62;
      $$1 = $14;$$1345 = $15;$88 = $14;
      break;
     }
    } else {
     $63 = ((($33)) + 16|0);
     $64 = HEAP32[$63>>2]|0;
     $65 = ($64|0)==($14|0);
     $66 = ((($33)) + 20|0);
     $$sink = $65 ? $63 : $66;
     HEAP32[$$sink>>2] = $$3;
     $67 = ($$3|0)==(0|0);
     if ($67) {
      $$1 = $14;$$1345 = $15;$88 = $14;
      break;
     }
    }
    $68 = ((($$3)) + 24|0);
    HEAP32[$68>>2] = $33;
    $69 = ((($14)) + 16|0);
    $70 = HEAP32[$69>>2]|0;
    $71 = ($70|0)==(0|0);
    if (!($71)) {
     $72 = ((($$3)) + 16|0);
     HEAP32[$72>>2] = $70;
     $73 = ((($70)) + 24|0);
     HEAP32[$73>>2] = $$3;
    }
    $74 = ((($69)) + 4|0);
    $75 = HEAP32[$74>>2]|0;
    $76 = ($75|0)==(0|0);
    if ($76) {
     $$1 = $14;$$1345 = $15;$88 = $14;
    } else {
     $77 = ((($$3)) + 20|0);
     HEAP32[$77>>2] = $75;
     $78 = ((($75)) + 24|0);
     HEAP32[$78>>2] = $$3;
     $$1 = $14;$$1345 = $15;$88 = $14;
    }
   }
  } else {
   $$1 = $2;$$1345 = $6;$88 = $2;
  }
 } while(0);
 $87 = ($88>>>0)<($7>>>0);
 if (!($87)) {
  return;
 }
 $89 = ((($7)) + 4|0);
 $90 = HEAP32[$89>>2]|0;
 $91 = $90 & 1;
 $92 = ($91|0)==(0);
 if ($92) {
  return;
 }
 $93 = $90 & 2;
 $94 = ($93|0)==(0);
 if ($94) {
  $95 = HEAP32[(1208)>>2]|0;
  $96 = ($95|0)==($7|0);
  if ($96) {
   $97 = HEAP32[(1196)>>2]|0;
   $98 = (($97) + ($$1345))|0;
   HEAP32[(1196)>>2] = $98;
   HEAP32[(1208)>>2] = $$1;
   $99 = $98 | 1;
   $100 = ((($$1)) + 4|0);
   HEAP32[$100>>2] = $99;
   $101 = HEAP32[(1204)>>2]|0;
   $102 = ($$1|0)==($101|0);
   if (!($102)) {
    return;
   }
   HEAP32[(1204)>>2] = 0;
   HEAP32[(1192)>>2] = 0;
   return;
  }
  $103 = HEAP32[(1204)>>2]|0;
  $104 = ($103|0)==($7|0);
  if ($104) {
   $105 = HEAP32[(1192)>>2]|0;
   $106 = (($105) + ($$1345))|0;
   HEAP32[(1192)>>2] = $106;
   HEAP32[(1204)>>2] = $88;
   $107 = $106 | 1;
   $108 = ((($$1)) + 4|0);
   HEAP32[$108>>2] = $107;
   $109 = (($88) + ($106)|0);
   HEAP32[$109>>2] = $106;
   return;
  }
  $110 = $90 & -8;
  $111 = (($110) + ($$1345))|0;
  $112 = $90 >>> 3;
  $113 = ($90>>>0)<(256);
  do {
   if ($113) {
    $114 = ((($7)) + 8|0);
    $115 = HEAP32[$114>>2]|0;
    $116 = ((($7)) + 12|0);
    $117 = HEAP32[$116>>2]|0;
    $118 = ($117|0)==($115|0);
    if ($118) {
     $119 = 1 << $112;
     $120 = $119 ^ -1;
     $121 = HEAP32[296]|0;
     $122 = $121 & $120;
     HEAP32[296] = $122;
     break;
    } else {
     $123 = ((($115)) + 12|0);
     HEAP32[$123>>2] = $117;
     $124 = ((($117)) + 8|0);
     HEAP32[$124>>2] = $115;
     break;
    }
   } else {
    $125 = ((($7)) + 24|0);
    $126 = HEAP32[$125>>2]|0;
    $127 = ((($7)) + 12|0);
    $128 = HEAP32[$127>>2]|0;
    $129 = ($128|0)==($7|0);
    do {
     if ($129) {
      $134 = ((($7)) + 16|0);
      $135 = ((($134)) + 4|0);
      $136 = HEAP32[$135>>2]|0;
      $137 = ($136|0)==(0|0);
      if ($137) {
       $138 = HEAP32[$134>>2]|0;
       $139 = ($138|0)==(0|0);
       if ($139) {
        $$3363 = 0;
        break;
       } else {
        $$1361$ph = $138;$$1365$ph = $134;
       }
      } else {
       $$1361$ph = $136;$$1365$ph = $135;
      }
      $$1361 = $$1361$ph;$$1365 = $$1365$ph;
      while(1) {
       $140 = ((($$1361)) + 20|0);
       $141 = HEAP32[$140>>2]|0;
       $142 = ($141|0)==(0|0);
       if ($142) {
        $143 = ((($$1361)) + 16|0);
        $144 = HEAP32[$143>>2]|0;
        $145 = ($144|0)==(0|0);
        if ($145) {
         break;
        } else {
         $$1361$be = $144;$$1365$be = $143;
        }
       } else {
        $$1361$be = $141;$$1365$be = $140;
       }
       $$1361 = $$1361$be;$$1365 = $$1365$be;
      }
      HEAP32[$$1365>>2] = 0;
      $$3363 = $$1361;
     } else {
      $130 = ((($7)) + 8|0);
      $131 = HEAP32[$130>>2]|0;
      $132 = ((($131)) + 12|0);
      HEAP32[$132>>2] = $128;
      $133 = ((($128)) + 8|0);
      HEAP32[$133>>2] = $131;
      $$3363 = $128;
     }
    } while(0);
    $146 = ($126|0)==(0|0);
    if (!($146)) {
     $147 = ((($7)) + 28|0);
     $148 = HEAP32[$147>>2]|0;
     $149 = (1488 + ($148<<2)|0);
     $150 = HEAP32[$149>>2]|0;
     $151 = ($150|0)==($7|0);
     if ($151) {
      HEAP32[$149>>2] = $$3363;
      $cond372 = ($$3363|0)==(0|0);
      if ($cond372) {
       $152 = 1 << $148;
       $153 = $152 ^ -1;
       $154 = HEAP32[(1188)>>2]|0;
       $155 = $154 & $153;
       HEAP32[(1188)>>2] = $155;
       break;
      }
     } else {
      $156 = ((($126)) + 16|0);
      $157 = HEAP32[$156>>2]|0;
      $158 = ($157|0)==($7|0);
      $159 = ((($126)) + 20|0);
      $$sink395 = $158 ? $156 : $159;
      HEAP32[$$sink395>>2] = $$3363;
      $160 = ($$3363|0)==(0|0);
      if ($160) {
       break;
      }
     }
     $161 = ((($$3363)) + 24|0);
     HEAP32[$161>>2] = $126;
     $162 = ((($7)) + 16|0);
     $163 = HEAP32[$162>>2]|0;
     $164 = ($163|0)==(0|0);
     if (!($164)) {
      $165 = ((($$3363)) + 16|0);
      HEAP32[$165>>2] = $163;
      $166 = ((($163)) + 24|0);
      HEAP32[$166>>2] = $$3363;
     }
     $167 = ((($162)) + 4|0);
     $168 = HEAP32[$167>>2]|0;
     $169 = ($168|0)==(0|0);
     if (!($169)) {
      $170 = ((($$3363)) + 20|0);
      HEAP32[$170>>2] = $168;
      $171 = ((($168)) + 24|0);
      HEAP32[$171>>2] = $$3363;
     }
    }
   }
  } while(0);
  $172 = $111 | 1;
  $173 = ((($$1)) + 4|0);
  HEAP32[$173>>2] = $172;
  $174 = (($88) + ($111)|0);
  HEAP32[$174>>2] = $111;
  $175 = HEAP32[(1204)>>2]|0;
  $176 = ($$1|0)==($175|0);
  if ($176) {
   HEAP32[(1192)>>2] = $111;
   return;
  } else {
   $$2 = $111;
  }
 } else {
  $177 = $90 & -2;
  HEAP32[$89>>2] = $177;
  $178 = $$1345 | 1;
  $179 = ((($$1)) + 4|0);
  HEAP32[$179>>2] = $178;
  $180 = (($88) + ($$1345)|0);
  HEAP32[$180>>2] = $$1345;
  $$2 = $$1345;
 }
 $181 = $$2 >>> 3;
 $182 = ($$2>>>0)<(256);
 if ($182) {
  $183 = $181 << 1;
  $184 = (1224 + ($183<<2)|0);
  $185 = HEAP32[296]|0;
  $186 = 1 << $181;
  $187 = $185 & $186;
  $188 = ($187|0)==(0);
  if ($188) {
   $189 = $185 | $186;
   HEAP32[296] = $189;
   $$pre = ((($184)) + 8|0);
   $$0366 = $184;$$pre$phiZ2D = $$pre;
  } else {
   $190 = ((($184)) + 8|0);
   $191 = HEAP32[$190>>2]|0;
   $$0366 = $191;$$pre$phiZ2D = $190;
  }
  HEAP32[$$pre$phiZ2D>>2] = $$1;
  $192 = ((($$0366)) + 12|0);
  HEAP32[$192>>2] = $$1;
  $193 = ((($$1)) + 8|0);
  HEAP32[$193>>2] = $$0366;
  $194 = ((($$1)) + 12|0);
  HEAP32[$194>>2] = $184;
  return;
 }
 $195 = $$2 >>> 8;
 $196 = ($195|0)==(0);
 if ($196) {
  $$0359 = 0;
 } else {
  $197 = ($$2>>>0)>(16777215);
  if ($197) {
   $$0359 = 31;
  } else {
   $198 = (($195) + 1048320)|0;
   $199 = $198 >>> 16;
   $200 = $199 & 8;
   $201 = $195 << $200;
   $202 = (($201) + 520192)|0;
   $203 = $202 >>> 16;
   $204 = $203 & 4;
   $205 = $204 | $200;
   $206 = $201 << $204;
   $207 = (($206) + 245760)|0;
   $208 = $207 >>> 16;
   $209 = $208 & 2;
   $210 = $205 | $209;
   $211 = (14 - ($210))|0;
   $212 = $206 << $209;
   $213 = $212 >>> 15;
   $214 = (($211) + ($213))|0;
   $215 = $214 << 1;
   $216 = (($214) + 7)|0;
   $217 = $$2 >>> $216;
   $218 = $217 & 1;
   $219 = $218 | $215;
   $$0359 = $219;
  }
 }
 $220 = (1488 + ($$0359<<2)|0);
 $221 = ((($$1)) + 28|0);
 HEAP32[$221>>2] = $$0359;
 $222 = ((($$1)) + 16|0);
 $223 = ((($$1)) + 20|0);
 HEAP32[$223>>2] = 0;
 HEAP32[$222>>2] = 0;
 $224 = HEAP32[(1188)>>2]|0;
 $225 = 1 << $$0359;
 $226 = $224 & $225;
 $227 = ($226|0)==(0);
 L112: do {
  if ($227) {
   $228 = $224 | $225;
   HEAP32[(1188)>>2] = $228;
   HEAP32[$220>>2] = $$1;
   $229 = ((($$1)) + 24|0);
   HEAP32[$229>>2] = $220;
   $230 = ((($$1)) + 12|0);
   HEAP32[$230>>2] = $$1;
   $231 = ((($$1)) + 8|0);
   HEAP32[$231>>2] = $$1;
  } else {
   $232 = HEAP32[$220>>2]|0;
   $233 = ((($232)) + 4|0);
   $234 = HEAP32[$233>>2]|0;
   $235 = $234 & -8;
   $236 = ($235|0)==($$2|0);
   L115: do {
    if ($236) {
     $$0347$lcssa = $232;
    } else {
     $237 = ($$0359|0)==(31);
     $238 = $$0359 >>> 1;
     $239 = (25 - ($238))|0;
     $240 = $237 ? 0 : $239;
     $241 = $$2 << $240;
     $$0346381 = $241;$$0347380 = $232;
     while(1) {
      $248 = $$0346381 >>> 31;
      $249 = (((($$0347380)) + 16|0) + ($248<<2)|0);
      $244 = HEAP32[$249>>2]|0;
      $250 = ($244|0)==(0|0);
      if ($250) {
       break;
      }
      $242 = $$0346381 << 1;
      $243 = ((($244)) + 4|0);
      $245 = HEAP32[$243>>2]|0;
      $246 = $245 & -8;
      $247 = ($246|0)==($$2|0);
      if ($247) {
       $$0347$lcssa = $244;
       break L115;
      } else {
       $$0346381 = $242;$$0347380 = $244;
      }
     }
     HEAP32[$249>>2] = $$1;
     $251 = ((($$1)) + 24|0);
     HEAP32[$251>>2] = $$0347380;
     $252 = ((($$1)) + 12|0);
     HEAP32[$252>>2] = $$1;
     $253 = ((($$1)) + 8|0);
     HEAP32[$253>>2] = $$1;
     break L112;
    }
   } while(0);
   $254 = ((($$0347$lcssa)) + 8|0);
   $255 = HEAP32[$254>>2]|0;
   $256 = ((($255)) + 12|0);
   HEAP32[$256>>2] = $$1;
   HEAP32[$254>>2] = $$1;
   $257 = ((($$1)) + 8|0);
   HEAP32[$257>>2] = $255;
   $258 = ((($$1)) + 12|0);
   HEAP32[$258>>2] = $$0347$lcssa;
   $259 = ((($$1)) + 24|0);
   HEAP32[$259>>2] = 0;
  }
 } while(0);
 $260 = HEAP32[(1216)>>2]|0;
 $261 = (($260) + -1)|0;
 HEAP32[(1216)>>2] = $261;
 $262 = ($261|0)==(0);
 if (!($262)) {
  return;
 }
 $$0194$in$i = (1640);
 while(1) {
  $$0194$i = HEAP32[$$0194$in$i>>2]|0;
  $263 = ($$0194$i|0)==(0|0);
  $264 = ((($$0194$i)) + 8|0);
  if ($263) {
   break;
  } else {
   $$0194$in$i = $264;
  }
 }
 HEAP32[(1216)>>2] = -1;
 return;
}
function ___stdio_close($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $vararg_buffer = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $vararg_buffer = sp;
 $1 = ((($0)) + 60|0);
 $2 = HEAP32[$1>>2]|0;
 $3 = (_dummy($2)|0);
 HEAP32[$vararg_buffer>>2] = $3;
 $4 = (___syscall6(6,($vararg_buffer|0))|0);
 $5 = (___syscall_ret($4)|0);
 STACKTOP = sp;return ($5|0);
}
function ___stdio_write($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$0 = 0, $$04756 = 0, $$04855 = 0, $$04954 = 0, $$051 = 0, $$1 = 0, $$150 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0;
 var $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0;
 var $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $vararg_buffer = 0, $vararg_buffer3 = 0, $vararg_ptr1 = 0, $vararg_ptr2 = 0;
 var $vararg_ptr6 = 0, $vararg_ptr7 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(48|0);
 $vararg_buffer3 = sp + 32|0;
 $vararg_buffer = sp + 16|0;
 $3 = sp;
 $4 = ((($0)) + 28|0);
 $5 = HEAP32[$4>>2]|0;
 HEAP32[$3>>2] = $5;
 $6 = ((($3)) + 4|0);
 $7 = ((($0)) + 20|0);
 $8 = HEAP32[$7>>2]|0;
 $9 = (($8) - ($5))|0;
 HEAP32[$6>>2] = $9;
 $10 = ((($3)) + 8|0);
 HEAP32[$10>>2] = $1;
 $11 = ((($3)) + 12|0);
 HEAP32[$11>>2] = $2;
 $12 = (($9) + ($2))|0;
 $13 = ((($0)) + 60|0);
 $14 = HEAP32[$13>>2]|0;
 $15 = $3;
 HEAP32[$vararg_buffer>>2] = $14;
 $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
 HEAP32[$vararg_ptr1>>2] = $15;
 $vararg_ptr2 = ((($vararg_buffer)) + 8|0);
 HEAP32[$vararg_ptr2>>2] = 2;
 $16 = (___syscall146(146,($vararg_buffer|0))|0);
 $17 = (___syscall_ret($16)|0);
 $18 = ($12|0)==($17|0);
 L1: do {
  if ($18) {
   label = 3;
  } else {
   $$04756 = 2;$$04855 = $12;$$04954 = $3;$27 = $17;
   while(1) {
    $26 = ($27|0)<(0);
    if ($26) {
     break;
    }
    $35 = (($$04855) - ($27))|0;
    $36 = ((($$04954)) + 4|0);
    $37 = HEAP32[$36>>2]|0;
    $38 = ($27>>>0)>($37>>>0);
    $39 = ((($$04954)) + 8|0);
    $$150 = $38 ? $39 : $$04954;
    $40 = $38 << 31 >> 31;
    $$1 = (($$04756) + ($40))|0;
    $41 = $38 ? $37 : 0;
    $$0 = (($27) - ($41))|0;
    $42 = HEAP32[$$150>>2]|0;
    $43 = (($42) + ($$0)|0);
    HEAP32[$$150>>2] = $43;
    $44 = ((($$150)) + 4|0);
    $45 = HEAP32[$44>>2]|0;
    $46 = (($45) - ($$0))|0;
    HEAP32[$44>>2] = $46;
    $47 = HEAP32[$13>>2]|0;
    $48 = $$150;
    HEAP32[$vararg_buffer3>>2] = $47;
    $vararg_ptr6 = ((($vararg_buffer3)) + 4|0);
    HEAP32[$vararg_ptr6>>2] = $48;
    $vararg_ptr7 = ((($vararg_buffer3)) + 8|0);
    HEAP32[$vararg_ptr7>>2] = $$1;
    $49 = (___syscall146(146,($vararg_buffer3|0))|0);
    $50 = (___syscall_ret($49)|0);
    $51 = ($35|0)==($50|0);
    if ($51) {
     label = 3;
     break L1;
    } else {
     $$04756 = $$1;$$04855 = $35;$$04954 = $$150;$27 = $50;
    }
   }
   $28 = ((($0)) + 16|0);
   HEAP32[$28>>2] = 0;
   HEAP32[$4>>2] = 0;
   HEAP32[$7>>2] = 0;
   $29 = HEAP32[$0>>2]|0;
   $30 = $29 | 32;
   HEAP32[$0>>2] = $30;
   $31 = ($$04756|0)==(2);
   if ($31) {
    $$051 = 0;
   } else {
    $32 = ((($$04954)) + 4|0);
    $33 = HEAP32[$32>>2]|0;
    $34 = (($2) - ($33))|0;
    $$051 = $34;
   }
  }
 } while(0);
 if ((label|0) == 3) {
  $19 = ((($0)) + 44|0);
  $20 = HEAP32[$19>>2]|0;
  $21 = ((($0)) + 48|0);
  $22 = HEAP32[$21>>2]|0;
  $23 = (($20) + ($22)|0);
  $24 = ((($0)) + 16|0);
  HEAP32[$24>>2] = $23;
  $25 = $20;
  HEAP32[$4>>2] = $25;
  HEAP32[$7>>2] = $25;
  $$051 = $2;
 }
 STACKTOP = sp;return ($$051|0);
}
function ___stdio_seek($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$pre = 0, $10 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $vararg_buffer = 0, $vararg_ptr1 = 0, $vararg_ptr2 = 0, $vararg_ptr3 = 0, $vararg_ptr4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(32|0);
 $vararg_buffer = sp;
 $3 = sp + 20|0;
 $4 = ((($0)) + 60|0);
 $5 = HEAP32[$4>>2]|0;
 $6 = $3;
 HEAP32[$vararg_buffer>>2] = $5;
 $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
 HEAP32[$vararg_ptr1>>2] = 0;
 $vararg_ptr2 = ((($vararg_buffer)) + 8|0);
 HEAP32[$vararg_ptr2>>2] = $1;
 $vararg_ptr3 = ((($vararg_buffer)) + 12|0);
 HEAP32[$vararg_ptr3>>2] = $6;
 $vararg_ptr4 = ((($vararg_buffer)) + 16|0);
 HEAP32[$vararg_ptr4>>2] = $2;
 $7 = (___syscall140(140,($vararg_buffer|0))|0);
 $8 = (___syscall_ret($7)|0);
 $9 = ($8|0)<(0);
 if ($9) {
  HEAP32[$3>>2] = -1;
  $10 = -1;
 } else {
  $$pre = HEAP32[$3>>2]|0;
  $10 = $$pre;
 }
 STACKTOP = sp;return ($10|0);
}
function ___syscall_ret($0) {
 $0 = $0|0;
 var $$0 = 0, $1 = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ($0>>>0)>(4294963200);
 if ($1) {
  $2 = (0 - ($0))|0;
  $3 = (___errno_location()|0);
  HEAP32[$3>>2] = $2;
  $$0 = -1;
 } else {
  $$0 = $0;
 }
 return ($$0|0);
}
function ___errno_location() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (1680|0);
}
function _dummy($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return ($0|0);
}
function ___stdout_write($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $vararg_buffer = 0, $vararg_ptr1 = 0, $vararg_ptr2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(32|0);
 $vararg_buffer = sp;
 $3 = sp + 16|0;
 $4 = ((($0)) + 36|0);
 HEAP32[$4>>2] = 4;
 $5 = HEAP32[$0>>2]|0;
 $6 = $5 & 64;
 $7 = ($6|0)==(0);
 if ($7) {
  $8 = ((($0)) + 60|0);
  $9 = HEAP32[$8>>2]|0;
  $10 = $3;
  HEAP32[$vararg_buffer>>2] = $9;
  $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
  HEAP32[$vararg_ptr1>>2] = 21523;
  $vararg_ptr2 = ((($vararg_buffer)) + 8|0);
  HEAP32[$vararg_ptr2>>2] = $10;
  $11 = (___syscall54(54,($vararg_buffer|0))|0);
  $12 = ($11|0)==(0);
  if (!($12)) {
   $13 = ((($0)) + 75|0);
   HEAP8[$13>>0] = -1;
  }
 }
 $14 = (___stdio_write($0,$1,$2)|0);
 STACKTOP = sp;return ($14|0);
}
function ___unlockfile($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return;
}
function ___lockfile($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return 0;
}
function ___ofl_lock() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 ___lock((1684|0));
 return (1692|0);
}
function ___ofl_unlock() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 ___unlock((1684|0));
 return;
}
function _fflush($0) {
 $0 = $0|0;
 var $$0 = 0, $$023 = 0, $$02325 = 0, $$02327 = 0, $$024$lcssa = 0, $$02426 = 0, $$1 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0;
 var $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $phitmp = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ($0|0)==(0|0);
 do {
  if ($1) {
   $8 = HEAP32[35]|0;
   $9 = ($8|0)==(0|0);
   if ($9) {
    $29 = 0;
   } else {
    $10 = HEAP32[35]|0;
    $11 = (_fflush($10)|0);
    $29 = $11;
   }
   $12 = (___ofl_lock()|0);
   $$02325 = HEAP32[$12>>2]|0;
   $13 = ($$02325|0)==(0|0);
   if ($13) {
    $$024$lcssa = $29;
   } else {
    $$02327 = $$02325;$$02426 = $29;
    while(1) {
     $14 = ((($$02327)) + 76|0);
     $15 = HEAP32[$14>>2]|0;
     $16 = ($15|0)>(-1);
     if ($16) {
      $17 = (___lockfile($$02327)|0);
      $26 = $17;
     } else {
      $26 = 0;
     }
     $18 = ((($$02327)) + 20|0);
     $19 = HEAP32[$18>>2]|0;
     $20 = ((($$02327)) + 28|0);
     $21 = HEAP32[$20>>2]|0;
     $22 = ($19>>>0)>($21>>>0);
     if ($22) {
      $23 = (___fflush_unlocked($$02327)|0);
      $24 = $23 | $$02426;
      $$1 = $24;
     } else {
      $$1 = $$02426;
     }
     $25 = ($26|0)==(0);
     if (!($25)) {
      ___unlockfile($$02327);
     }
     $27 = ((($$02327)) + 56|0);
     $$023 = HEAP32[$27>>2]|0;
     $28 = ($$023|0)==(0|0);
     if ($28) {
      $$024$lcssa = $$1;
      break;
     } else {
      $$02327 = $$023;$$02426 = $$1;
     }
    }
   }
   ___ofl_unlock();
   $$0 = $$024$lcssa;
  } else {
   $2 = ((($0)) + 76|0);
   $3 = HEAP32[$2>>2]|0;
   $4 = ($3|0)>(-1);
   if (!($4)) {
    $5 = (___fflush_unlocked($0)|0);
    $$0 = $5;
    break;
   }
   $6 = (___lockfile($0)|0);
   $phitmp = ($6|0)==(0);
   $7 = (___fflush_unlocked($0)|0);
   if ($phitmp) {
    $$0 = $7;
   } else {
    ___unlockfile($0);
    $$0 = $7;
   }
  }
 } while(0);
 return ($$0|0);
}
function ___fflush_unlocked($0) {
 $0 = $0|0;
 var $$0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0;
 var $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ((($0)) + 20|0);
 $2 = HEAP32[$1>>2]|0;
 $3 = ((($0)) + 28|0);
 $4 = HEAP32[$3>>2]|0;
 $5 = ($2>>>0)>($4>>>0);
 if ($5) {
  $6 = ((($0)) + 36|0);
  $7 = HEAP32[$6>>2]|0;
  (FUNCTION_TABLE_iiii[$7 & 7]($0,0,0)|0);
  $8 = HEAP32[$1>>2]|0;
  $9 = ($8|0)==(0|0);
  if ($9) {
   $$0 = -1;
  } else {
   label = 3;
  }
 } else {
  label = 3;
 }
 if ((label|0) == 3) {
  $10 = ((($0)) + 4|0);
  $11 = HEAP32[$10>>2]|0;
  $12 = ((($0)) + 8|0);
  $13 = HEAP32[$12>>2]|0;
  $14 = ($11>>>0)<($13>>>0);
  if ($14) {
   $15 = $11;
   $16 = $13;
   $17 = (($15) - ($16))|0;
   $18 = ((($0)) + 40|0);
   $19 = HEAP32[$18>>2]|0;
   (FUNCTION_TABLE_iiii[$19 & 7]($0,$17,1)|0);
  }
  $20 = ((($0)) + 16|0);
  HEAP32[$20>>2] = 0;
  HEAP32[$3>>2] = 0;
  HEAP32[$1>>2] = 0;
  HEAP32[$12>>2] = 0;
  HEAP32[$10>>2] = 0;
  $$0 = 0;
 }
 return ($$0|0);
}
function runPostSets() {
}
function ___muldsi3($a, $b) {
    $a = $a | 0;
    $b = $b | 0;
    var $1 = 0, $2 = 0, $3 = 0, $6 = 0, $8 = 0, $11 = 0, $12 = 0;
    $1 = $a & 65535;
    $2 = $b & 65535;
    $3 = Math_imul($2, $1) | 0;
    $6 = $a >>> 16;
    $8 = ($3 >>> 16) + (Math_imul($2, $6) | 0) | 0;
    $11 = $b >>> 16;
    $12 = Math_imul($11, $1) | 0;
    return (tempRet0 = (($8 >>> 16) + (Math_imul($11, $6) | 0) | 0) + ((($8 & 65535) + $12 | 0) >>> 16) | 0, 0 | ($8 + $12 << 16 | $3 & 65535)) | 0;
}
function ___muldi3($a$0, $a$1, $b$0, $b$1) {
    $a$0 = $a$0 | 0;
    $a$1 = $a$1 | 0;
    $b$0 = $b$0 | 0;
    $b$1 = $b$1 | 0;
    var $x_sroa_0_0_extract_trunc = 0, $y_sroa_0_0_extract_trunc = 0, $1$0 = 0, $1$1 = 0, $2 = 0;
    $x_sroa_0_0_extract_trunc = $a$0;
    $y_sroa_0_0_extract_trunc = $b$0;
    $1$0 = ___muldsi3($x_sroa_0_0_extract_trunc, $y_sroa_0_0_extract_trunc) | 0;
    $1$1 = tempRet0;
    $2 = Math_imul($a$1, $y_sroa_0_0_extract_trunc) | 0;
    return (tempRet0 = ((Math_imul($b$1, $x_sroa_0_0_extract_trunc) | 0) + $2 | 0) + $1$1 | $1$1 & 0, 0 | $1$0 & -1) | 0;
}
function _bitshift64Ashr(low, high, bits) {
    low = low|0; high = high|0; bits = bits|0;
    var ander = 0;
    if ((bits|0) < 32) {
      ander = ((1 << bits) - 1)|0;
      tempRet0 = high >> bits;
      return (low >>> bits) | ((high&ander) << (32 - bits));
    }
    tempRet0 = (high|0) < 0 ? -1 : 0;
    return (high >> (bits - 32))|0;
}
function _bitshift64Lshr(low, high, bits) {
    low = low|0; high = high|0; bits = bits|0;
    var ander = 0;
    if ((bits|0) < 32) {
      ander = ((1 << bits) - 1)|0;
      tempRet0 = high >>> bits;
      return (low >>> bits) | ((high&ander) << (32 - bits));
    }
    tempRet0 = 0;
    return (high >>> (bits - 32))|0;
}
function _bitshift64Shl(low, high, bits) {
    low = low|0; high = high|0; bits = bits|0;
    var ander = 0;
    if ((bits|0) < 32) {
      ander = ((1 << bits) - 1)|0;
      tempRet0 = (high << bits) | ((low&(ander << (32 - bits))) >>> (32 - bits));
      return low << bits;
    }
    tempRet0 = low << (bits - 32);
    return 0;
}
function _i64Add(a, b, c, d) {
    /*
      x = a + b*2^32
      y = c + d*2^32
      result = l + h*2^32
    */
    a = a|0; b = b|0; c = c|0; d = d|0;
    var l = 0, h = 0;
    l = (a + c)>>>0;
    h = (b + d + (((l>>>0) < (a>>>0))|0))>>>0; // Add carry from low word to high word on overflow.
    return ((tempRet0 = h,l|0)|0);
}
function _i64Subtract(a, b, c, d) {
    a = a|0; b = b|0; c = c|0; d = d|0;
    var l = 0, h = 0;
    l = (a - c)>>>0;
    h = (b - d)>>>0;
    h = (b - d - (((c>>>0) > (a>>>0))|0))>>>0; // Borrow one from high word to low word on underflow.
    return ((tempRet0 = h,l|0)|0);
}
function _memcpy(dest, src, num) {
    dest = dest|0; src = src|0; num = num|0;
    var ret = 0;
    var aligned_dest_end = 0;
    var block_aligned_dest_end = 0;
    var dest_end = 0;
    // Test against a benchmarked cutoff limit for when HEAPU8.set() becomes faster to use.
    if ((num|0) >=
      8192
    ) {
      return _emscripten_memcpy_big(dest|0, src|0, num|0)|0;
    }

    ret = dest|0;
    dest_end = (dest + num)|0;
    if ((dest&3) == (src&3)) {
      // The initial unaligned < 4-byte front.
      while (dest & 3) {
        if ((num|0) == 0) return ret|0;
        HEAP8[((dest)>>0)]=((HEAP8[((src)>>0)])|0);
        dest = (dest+1)|0;
        src = (src+1)|0;
        num = (num-1)|0;
      }
      aligned_dest_end = (dest_end & -4)|0;
      block_aligned_dest_end = (aligned_dest_end - 64)|0;
      while ((dest|0) <= (block_aligned_dest_end|0) ) {
        HEAP32[((dest)>>2)]=((HEAP32[((src)>>2)])|0);
        HEAP32[(((dest)+(4))>>2)]=((HEAP32[(((src)+(4))>>2)])|0);
        HEAP32[(((dest)+(8))>>2)]=((HEAP32[(((src)+(8))>>2)])|0);
        HEAP32[(((dest)+(12))>>2)]=((HEAP32[(((src)+(12))>>2)])|0);
        HEAP32[(((dest)+(16))>>2)]=((HEAP32[(((src)+(16))>>2)])|0);
        HEAP32[(((dest)+(20))>>2)]=((HEAP32[(((src)+(20))>>2)])|0);
        HEAP32[(((dest)+(24))>>2)]=((HEAP32[(((src)+(24))>>2)])|0);
        HEAP32[(((dest)+(28))>>2)]=((HEAP32[(((src)+(28))>>2)])|0);
        HEAP32[(((dest)+(32))>>2)]=((HEAP32[(((src)+(32))>>2)])|0);
        HEAP32[(((dest)+(36))>>2)]=((HEAP32[(((src)+(36))>>2)])|0);
        HEAP32[(((dest)+(40))>>2)]=((HEAP32[(((src)+(40))>>2)])|0);
        HEAP32[(((dest)+(44))>>2)]=((HEAP32[(((src)+(44))>>2)])|0);
        HEAP32[(((dest)+(48))>>2)]=((HEAP32[(((src)+(48))>>2)])|0);
        HEAP32[(((dest)+(52))>>2)]=((HEAP32[(((src)+(52))>>2)])|0);
        HEAP32[(((dest)+(56))>>2)]=((HEAP32[(((src)+(56))>>2)])|0);
        HEAP32[(((dest)+(60))>>2)]=((HEAP32[(((src)+(60))>>2)])|0);
        dest = (dest+64)|0;
        src = (src+64)|0;
      }
      while ((dest|0) < (aligned_dest_end|0) ) {
        HEAP32[((dest)>>2)]=((HEAP32[((src)>>2)])|0);
        dest = (dest+4)|0;
        src = (src+4)|0;
      }
    } else {
      // In the unaligned copy case, unroll a bit as well.
      aligned_dest_end = (dest_end - 4)|0;
      while ((dest|0) < (aligned_dest_end|0) ) {
        HEAP8[((dest)>>0)]=((HEAP8[((src)>>0)])|0);
        HEAP8[(((dest)+(1))>>0)]=((HEAP8[(((src)+(1))>>0)])|0);
        HEAP8[(((dest)+(2))>>0)]=((HEAP8[(((src)+(2))>>0)])|0);
        HEAP8[(((dest)+(3))>>0)]=((HEAP8[(((src)+(3))>>0)])|0);
        dest = (dest+4)|0;
        src = (src+4)|0;
      }
    }
    // The remaining unaligned < 4 byte tail.
    while ((dest|0) < (dest_end|0)) {
      HEAP8[((dest)>>0)]=((HEAP8[((src)>>0)])|0);
      dest = (dest+1)|0;
      src = (src+1)|0;
    }
    return ret|0;
}
function _memset(ptr, value, num) {
    ptr = ptr|0; value = value|0; num = num|0;
    var end = 0, aligned_end = 0, block_aligned_end = 0, value4 = 0;
    end = (ptr + num)|0;

    value = value & 0xff;
    if ((num|0) >= 67 /* 64 bytes for an unrolled loop + 3 bytes for unaligned head*/) {
      while ((ptr&3) != 0) {
        HEAP8[((ptr)>>0)]=value;
        ptr = (ptr+1)|0;
      }

      aligned_end = (end & -4)|0;
      block_aligned_end = (aligned_end - 64)|0;
      value4 = value | (value << 8) | (value << 16) | (value << 24);

      while((ptr|0) <= (block_aligned_end|0)) {
        HEAP32[((ptr)>>2)]=value4;
        HEAP32[(((ptr)+(4))>>2)]=value4;
        HEAP32[(((ptr)+(8))>>2)]=value4;
        HEAP32[(((ptr)+(12))>>2)]=value4;
        HEAP32[(((ptr)+(16))>>2)]=value4;
        HEAP32[(((ptr)+(20))>>2)]=value4;
        HEAP32[(((ptr)+(24))>>2)]=value4;
        HEAP32[(((ptr)+(28))>>2)]=value4;
        HEAP32[(((ptr)+(32))>>2)]=value4;
        HEAP32[(((ptr)+(36))>>2)]=value4;
        HEAP32[(((ptr)+(40))>>2)]=value4;
        HEAP32[(((ptr)+(44))>>2)]=value4;
        HEAP32[(((ptr)+(48))>>2)]=value4;
        HEAP32[(((ptr)+(52))>>2)]=value4;
        HEAP32[(((ptr)+(56))>>2)]=value4;
        HEAP32[(((ptr)+(60))>>2)]=value4;
        ptr = (ptr + 64)|0;
      }

      while ((ptr|0) < (aligned_end|0) ) {
        HEAP32[((ptr)>>2)]=value4;
        ptr = (ptr+4)|0;
      }
    }
    // The remaining bytes.
    while ((ptr|0) < (end|0)) {
      HEAP8[((ptr)>>0)]=value;
      ptr = (ptr+1)|0;
    }
    return (end-num)|0;
}
function _sbrk(increment) {
    increment = increment|0;
    var oldDynamicTop = 0;
    var oldDynamicTopOnChange = 0;
    var newDynamicTop = 0;
    var totalMemory = 0;
    oldDynamicTop = HEAP32[DYNAMICTOP_PTR>>2]|0;
    newDynamicTop = oldDynamicTop + increment | 0;

    if (((increment|0) > 0 & (newDynamicTop|0) < (oldDynamicTop|0)) // Detect and fail if we would wrap around signed 32-bit int.
      | (newDynamicTop|0) < 0) { // Also underflow, sbrk() should be able to be used to subtract.
      abortOnCannotGrowMemory()|0;
      ___setErrNo(12);
      return -1;
    }

    HEAP32[DYNAMICTOP_PTR>>2] = newDynamicTop;
    totalMemory = getTotalMemory()|0;
    if ((newDynamicTop|0) > (totalMemory|0)) {
      if ((enlargeMemory()|0) == 0) {
        HEAP32[DYNAMICTOP_PTR>>2] = oldDynamicTop;
        ___setErrNo(12);
        return -1;
      }
    }
    return oldDynamicTop|0;
}

  
function dynCall_ii(index,a1) {
  index = index|0;
  a1=a1|0;
  return FUNCTION_TABLE_ii[index&1](a1|0)|0;
}


function dynCall_iiii(index,a1,a2,a3) {
  index = index|0;
  a1=a1|0; a2=a2|0; a3=a3|0;
  return FUNCTION_TABLE_iiii[index&7](a1|0,a2|0,a3|0)|0;
}

function b0(p0) {
 p0 = p0|0; nullFunc_ii(0);return 0;
}
function b1(p0,p1,p2) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0; nullFunc_iiii(1);return 0;
}

// EMSCRIPTEN_END_FUNCS
var FUNCTION_TABLE_ii = [b0,___stdio_close];
var FUNCTION_TABLE_iiii = [b1,b1,___stdout_write,___stdio_seek,___stdio_write,b1,b1,b1];

  return { ___errno_location: ___errno_location, ___muldi3: ___muldi3, _bitshift64Ashr: _bitshift64Ashr, _bitshift64Lshr: _bitshift64Lshr, _bitshift64Shl: _bitshift64Shl, _fflush: _fflush, _free: _free, _i64Add: _i64Add, _i64Subtract: _i64Subtract, _malloc: _malloc, _memcpy: _memcpy, _memset: _memset, _sbrk: _sbrk, _sc_reduce32: _sc_reduce32, dynCall_ii: dynCall_ii, dynCall_iiii: dynCall_iiii, establishStackSpace: establishStackSpace, getTempRet0: getTempRet0, runPostSets: runPostSets, setTempRet0: setTempRet0, setThrew: setThrew, stackAlloc: stackAlloc, stackRestore: stackRestore, stackSave: stackSave };
})
// EMSCRIPTEN_END_ASM
(Module.asmGlobalArg, Module.asmLibraryArg, buffer);

var real____errno_location = asm["___errno_location"]; asm["___errno_location"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real____errno_location.apply(null, arguments);
};

var real____muldi3 = asm["___muldi3"]; asm["___muldi3"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real____muldi3.apply(null, arguments);
};

var real__bitshift64Ashr = asm["_bitshift64Ashr"]; asm["_bitshift64Ashr"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__bitshift64Ashr.apply(null, arguments);
};

var real__bitshift64Lshr = asm["_bitshift64Lshr"]; asm["_bitshift64Lshr"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__bitshift64Lshr.apply(null, arguments);
};

var real__bitshift64Shl = asm["_bitshift64Shl"]; asm["_bitshift64Shl"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__bitshift64Shl.apply(null, arguments);
};

var real__fflush = asm["_fflush"]; asm["_fflush"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__fflush.apply(null, arguments);
};

var real__free = asm["_free"]; asm["_free"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__free.apply(null, arguments);
};

var real__i64Add = asm["_i64Add"]; asm["_i64Add"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__i64Add.apply(null, arguments);
};

var real__i64Subtract = asm["_i64Subtract"]; asm["_i64Subtract"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__i64Subtract.apply(null, arguments);
};

var real__malloc = asm["_malloc"]; asm["_malloc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__malloc.apply(null, arguments);
};

var real__sbrk = asm["_sbrk"]; asm["_sbrk"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sbrk.apply(null, arguments);
};

var real__sc_reduce32 = asm["_sc_reduce32"]; asm["_sc_reduce32"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sc_reduce32.apply(null, arguments);
};

var real_establishStackSpace = asm["establishStackSpace"]; asm["establishStackSpace"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_establishStackSpace.apply(null, arguments);
};

var real_getTempRet0 = asm["getTempRet0"]; asm["getTempRet0"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_getTempRet0.apply(null, arguments);
};

var real_setTempRet0 = asm["setTempRet0"]; asm["setTempRet0"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_setTempRet0.apply(null, arguments);
};

var real_setThrew = asm["setThrew"]; asm["setThrew"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_setThrew.apply(null, arguments);
};

var real_stackAlloc = asm["stackAlloc"]; asm["stackAlloc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_stackAlloc.apply(null, arguments);
};

var real_stackRestore = asm["stackRestore"]; asm["stackRestore"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_stackRestore.apply(null, arguments);
};

var real_stackSave = asm["stackSave"]; asm["stackSave"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_stackSave.apply(null, arguments);
};
var ___errno_location = Module["___errno_location"] = asm["___errno_location"];
var ___muldi3 = Module["___muldi3"] = asm["___muldi3"];
var _bitshift64Ashr = Module["_bitshift64Ashr"] = asm["_bitshift64Ashr"];
var _bitshift64Lshr = Module["_bitshift64Lshr"] = asm["_bitshift64Lshr"];
var _bitshift64Shl = Module["_bitshift64Shl"] = asm["_bitshift64Shl"];
var _fflush = Module["_fflush"] = asm["_fflush"];
var _free = Module["_free"] = asm["_free"];
var _i64Add = Module["_i64Add"] = asm["_i64Add"];
var _i64Subtract = Module["_i64Subtract"] = asm["_i64Subtract"];
var _malloc = Module["_malloc"] = asm["_malloc"];
var _memcpy = Module["_memcpy"] = asm["_memcpy"];
var _memset = Module["_memset"] = asm["_memset"];
var _sbrk = Module["_sbrk"] = asm["_sbrk"];
var _sc_reduce32 = Module["_sc_reduce32"] = asm["_sc_reduce32"];
var establishStackSpace = Module["establishStackSpace"] = asm["establishStackSpace"];
var getTempRet0 = Module["getTempRet0"] = asm["getTempRet0"];
var runPostSets = Module["runPostSets"] = asm["runPostSets"];
var setTempRet0 = Module["setTempRet0"] = asm["setTempRet0"];
var setThrew = Module["setThrew"] = asm["setThrew"];
var stackAlloc = Module["stackAlloc"] = asm["stackAlloc"];
var stackRestore = Module["stackRestore"] = asm["stackRestore"];
var stackSave = Module["stackSave"] = asm["stackSave"];
var dynCall_ii = Module["dynCall_ii"] = asm["dynCall_ii"];
var dynCall_iiii = Module["dynCall_iiii"] = asm["dynCall_iiii"];
;



// === Auto-generated postamble setup entry stuff ===

Module['asm'] = asm;

if (!Module["intArrayFromString"]) Module["intArrayFromString"] = function() { abort("'intArrayFromString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["intArrayToString"]) Module["intArrayToString"] = function() { abort("'intArrayToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
Module["ccall"] = ccall;
if (!Module["cwrap"]) Module["cwrap"] = function() { abort("'cwrap' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["setValue"]) Module["setValue"] = function() { abort("'setValue' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["getValue"]) Module["getValue"] = function() { abort("'getValue' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["allocate"]) Module["allocate"] = function() { abort("'allocate' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["getMemory"]) Module["getMemory"] = function() { abort("'getMemory' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["Pointer_stringify"]) Module["Pointer_stringify"] = function() { abort("'Pointer_stringify' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["AsciiToString"]) Module["AsciiToString"] = function() { abort("'AsciiToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["stringToAscii"]) Module["stringToAscii"] = function() { abort("'stringToAscii' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["UTF8ArrayToString"]) Module["UTF8ArrayToString"] = function() { abort("'UTF8ArrayToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["UTF8ToString"]) Module["UTF8ToString"] = function() { abort("'UTF8ToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["stringToUTF8Array"]) Module["stringToUTF8Array"] = function() { abort("'stringToUTF8Array' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["stringToUTF8"]) Module["stringToUTF8"] = function() { abort("'stringToUTF8' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["lengthBytesUTF8"]) Module["lengthBytesUTF8"] = function() { abort("'lengthBytesUTF8' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["UTF16ToString"]) Module["UTF16ToString"] = function() { abort("'UTF16ToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["stringToUTF16"]) Module["stringToUTF16"] = function() { abort("'stringToUTF16' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["lengthBytesUTF16"]) Module["lengthBytesUTF16"] = function() { abort("'lengthBytesUTF16' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["UTF32ToString"]) Module["UTF32ToString"] = function() { abort("'UTF32ToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["stringToUTF32"]) Module["stringToUTF32"] = function() { abort("'stringToUTF32' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["lengthBytesUTF32"]) Module["lengthBytesUTF32"] = function() { abort("'lengthBytesUTF32' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["allocateUTF8"]) Module["allocateUTF8"] = function() { abort("'allocateUTF8' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["stackTrace"]) Module["stackTrace"] = function() { abort("'stackTrace' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["addOnPreRun"]) Module["addOnPreRun"] = function() { abort("'addOnPreRun' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["addOnInit"]) Module["addOnInit"] = function() { abort("'addOnInit' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["addOnPreMain"]) Module["addOnPreMain"] = function() { abort("'addOnPreMain' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["addOnExit"]) Module["addOnExit"] = function() { abort("'addOnExit' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["addOnPostRun"]) Module["addOnPostRun"] = function() { abort("'addOnPostRun' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["writeStringToMemory"]) Module["writeStringToMemory"] = function() { abort("'writeStringToMemory' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["writeArrayToMemory"]) Module["writeArrayToMemory"] = function() { abort("'writeArrayToMemory' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["writeAsciiToMemory"]) Module["writeAsciiToMemory"] = function() { abort("'writeAsciiToMemory' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["addRunDependency"]) Module["addRunDependency"] = function() { abort("'addRunDependency' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["removeRunDependency"]) Module["removeRunDependency"] = function() { abort("'removeRunDependency' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["ENV"]) Module["ENV"] = function() { abort("'ENV' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["FS"]) Module["FS"] = function() { abort("'FS' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["FS_createFolder"]) Module["FS_createFolder"] = function() { abort("'FS_createFolder' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["FS_createPath"]) Module["FS_createPath"] = function() { abort("'FS_createPath' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["FS_createDataFile"]) Module["FS_createDataFile"] = function() { abort("'FS_createDataFile' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["FS_createPreloadedFile"]) Module["FS_createPreloadedFile"] = function() { abort("'FS_createPreloadedFile' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["FS_createLazyFile"]) Module["FS_createLazyFile"] = function() { abort("'FS_createLazyFile' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["FS_createLink"]) Module["FS_createLink"] = function() { abort("'FS_createLink' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["FS_createDevice"]) Module["FS_createDevice"] = function() { abort("'FS_createDevice' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["FS_unlink"]) Module["FS_unlink"] = function() { abort("'FS_unlink' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["GL"]) Module["GL"] = function() { abort("'GL' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["staticAlloc"]) Module["staticAlloc"] = function() { abort("'staticAlloc' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["dynamicAlloc"]) Module["dynamicAlloc"] = function() { abort("'dynamicAlloc' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["warnOnce"]) Module["warnOnce"] = function() { abort("'warnOnce' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["loadDynamicLibrary"]) Module["loadDynamicLibrary"] = function() { abort("'loadDynamicLibrary' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["loadWebAssemblyModule"]) Module["loadWebAssemblyModule"] = function() { abort("'loadWebAssemblyModule' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["getLEB"]) Module["getLEB"] = function() { abort("'getLEB' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["getFunctionTables"]) Module["getFunctionTables"] = function() { abort("'getFunctionTables' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["alignFunctionTables"]) Module["alignFunctionTables"] = function() { abort("'alignFunctionTables' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["registerFunctions"]) Module["registerFunctions"] = function() { abort("'registerFunctions' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["addFunction"]) Module["addFunction"] = function() { abort("'addFunction' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["removeFunction"]) Module["removeFunction"] = function() { abort("'removeFunction' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["getFuncWrapper"]) Module["getFuncWrapper"] = function() { abort("'getFuncWrapper' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["prettyPrint"]) Module["prettyPrint"] = function() { abort("'prettyPrint' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["makeBigInt"]) Module["makeBigInt"] = function() { abort("'makeBigInt' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["dynCall"]) Module["dynCall"] = function() { abort("'dynCall' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["getCompilerSetting"]) Module["getCompilerSetting"] = function() { abort("'getCompilerSetting' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["stackSave"]) Module["stackSave"] = function() { abort("'stackSave' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["stackRestore"]) Module["stackRestore"] = function() { abort("'stackRestore' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["stackAlloc"]) Module["stackAlloc"] = function() { abort("'stackAlloc' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["establishStackSpace"]) Module["establishStackSpace"] = function() { abort("'establishStackSpace' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["print"]) Module["print"] = function() { abort("'print' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["printErr"]) Module["printErr"] = function() { abort("'printErr' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["intArrayFromBase64"]) Module["intArrayFromBase64"] = function() { abort("'intArrayFromBase64' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["tryParseAsDataURI"]) Module["tryParseAsDataURI"] = function() { abort("'tryParseAsDataURI' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };if (!Module["ALLOC_NORMAL"]) Object.defineProperty(Module, "ALLOC_NORMAL", { get: function() { abort("'ALLOC_NORMAL' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") } });
if (!Module["ALLOC_STACK"]) Object.defineProperty(Module, "ALLOC_STACK", { get: function() { abort("'ALLOC_STACK' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") } });
if (!Module["ALLOC_STATIC"]) Object.defineProperty(Module, "ALLOC_STATIC", { get: function() { abort("'ALLOC_STATIC' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") } });
if (!Module["ALLOC_DYNAMIC"]) Object.defineProperty(Module, "ALLOC_DYNAMIC", { get: function() { abort("'ALLOC_DYNAMIC' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") } });
if (!Module["ALLOC_NONE"]) Object.defineProperty(Module, "ALLOC_NONE", { get: function() { abort("'ALLOC_NONE' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") } });

if (memoryInitializer) {
  if (!isDataURI(memoryInitializer)) {
    memoryInitializer = locateFile(memoryInitializer);
  }
  if (ENVIRONMENT_IS_NODE || ENVIRONMENT_IS_SHELL) {
    var data = Module['readBinary'](memoryInitializer);
    HEAPU8.set(data, GLOBAL_BASE);
  } else {
    addRunDependency('memory initializer');
    var applyMemoryInitializer = function(data) {
      if (data.byteLength) data = new Uint8Array(data);
      for (var i = 0; i < data.length; i++) {
        assert(HEAPU8[GLOBAL_BASE + i] === 0, "area for memory initializer should not have been touched before it's loaded");
      }
      HEAPU8.set(data, GLOBAL_BASE);
      // Delete the typed array that contains the large blob of the memory initializer request response so that
      // we won't keep unnecessary memory lying around. However, keep the XHR object itself alive so that e.g.
      // its .status field can still be accessed later.
      if (Module['memoryInitializerRequest']) delete Module['memoryInitializerRequest'].response;
      removeRunDependency('memory initializer');
    }
    function doBrowserLoad() {
      Module['readAsync'](memoryInitializer, applyMemoryInitializer, function() {
        throw 'could not load memory initializer ' + memoryInitializer;
      });
    }
    var memoryInitializerBytes = tryParseAsDataURI(memoryInitializer);
    if (memoryInitializerBytes) {
      applyMemoryInitializer(memoryInitializerBytes.buffer);
    } else
    if (Module['memoryInitializerRequest']) {
      // a network request has already been created, just use that
      function useRequest() {
        var request = Module['memoryInitializerRequest'];
        var response = request.response;
        if (request.status !== 200 && request.status !== 0) {
          var data = tryParseAsDataURI(Module['memoryInitializerRequestURL']);
          if (data) {
            response = data.buffer;
          } else {
            // If you see this warning, the issue may be that you are using locateFile and defining it in JS. That
            // means that the HTML file doesn't know about it, and when it tries to create the mem init request early, does it to the wrong place.
            // Look in your browser's devtools network console to see what's going on.
            console.warn('a problem seems to have happened with Module.memoryInitializerRequest, status: ' + request.status + ', retrying ' + memoryInitializer);
            doBrowserLoad();
            return;
          }
        }
        applyMemoryInitializer(response);
      }
      if (Module['memoryInitializerRequest'].response) {
        setTimeout(useRequest, 0); // it's already here; but, apply it asynchronously
      } else {
        Module['memoryInitializerRequest'].addEventListener('load', useRequest); // wait for it
      }
    } else {
      // fetch it from the network ourselves
      doBrowserLoad();
    }
  }
}



/**
 * @constructor
 * @extends {Error}
 * @this {ExitStatus}
 */
function ExitStatus(status) {
  this.name = "ExitStatus";
  this.message = "Program terminated with exit(" + status + ")";
  this.status = status;
};
ExitStatus.prototype = new Error();
ExitStatus.prototype.constructor = ExitStatus;

var initialStackTop;
var calledMain = false;

dependenciesFulfilled = function runCaller() {
  // If run has never been called, and we should call run (INVOKE_RUN is true, and Module.noInitialRun is not false)
  if (!Module['calledRun']) run();
  if (!Module['calledRun']) dependenciesFulfilled = runCaller; // try this again later, after new deps are fulfilled
}





/** @type {function(Array=)} */
function run(args) {
  args = args || Module['arguments'];

  if (runDependencies > 0) {
    return;
  }

  writeStackCookie();

  preRun();

  if (runDependencies > 0) return; // a preRun added a dependency, run will be called later
  if (Module['calledRun']) return; // run may have just been called through dependencies being fulfilled just in this very frame

  function doRun() {
    if (Module['calledRun']) return; // run may have just been called while the async setStatus time below was happening
    Module['calledRun'] = true;

    if (ABORT) return;

    ensureInitRuntime();

    preMain();

    if (Module['onRuntimeInitialized']) Module['onRuntimeInitialized']();

    assert(!Module['_main'], 'compiled without a main, but one is present. if you added it from JS, use Module["onRuntimeInitialized"]');

    postRun();
  }

  if (Module['setStatus']) {
    Module['setStatus']('Running...');
    setTimeout(function() {
      setTimeout(function() {
        Module['setStatus']('');
      }, 1);
      doRun();
    }, 1);
  } else {
    doRun();
  }
  checkStackCookie();
}
Module['run'] = run;

function checkUnflushedContent() {
  // Compiler settings do not allow exiting the runtime, so flushing
  // the streams is not possible. but in ASSERTIONS mode we check
  // if there was something to flush, and if so tell the user they
  // should request that the runtime be exitable.
  // Normally we would not even include flush() at all, but in ASSERTIONS
  // builds we do so just for this check, and here we see if there is any
  // content to flush, that is, we check if there would have been
  // something a non-ASSERTIONS build would have not seen.
  // How we flush the streams depends on whether we are in FILESYSTEM=0
  // mode (which has its own special function for this; otherwise, all
  // the code is inside libc)
  var print = out;
  var printErr = err;
  var has = false;
  out = err = function(x) {
    has = true;
  }
  try { // it doesn't matter if it fails
    var flush = flush_NO_FILESYSTEM;
    if (flush) flush(0);
  } catch(e) {}
  out = print;
  err = printErr;
  if (has) {
    warnOnce('stdio streams had content in them that was not flushed. you should set EXIT_RUNTIME to 1 (see the FAQ), or make sure to emit a newline when you printf etc.');
  }
}

function exit(status, implicit) {
  checkUnflushedContent();

  // if this is just main exit-ing implicitly, and the status is 0, then we
  // don't need to do anything here and can just leave. if the status is
  // non-zero, though, then we need to report it.
  // (we may have warned about this earlier, if a situation justifies doing so)
  if (implicit && Module['noExitRuntime'] && status === 0) {
    return;
  }

  if (Module['noExitRuntime']) {
    // if exit() was called, we may warn the user if the runtime isn't actually being shut down
    if (!implicit) {
      err('exit(' + status + ') called, but EXIT_RUNTIME is not set, so halting execution but not exiting the runtime or preventing further async execution (build with EXIT_RUNTIME=1, if you want a true shutdown)');
    }
  } else {

    ABORT = true;
    EXITSTATUS = status;
    STACKTOP = initialStackTop;

    exitRuntime();

    if (Module['onExit']) Module['onExit'](status);
  }

  Module['quit'](status, new ExitStatus(status));
}

var abortDecorators = [];

function abort(what) {
  if (Module['onAbort']) {
    Module['onAbort'](what);
  }

  if (what !== undefined) {
    out(what);
    err(what);
    what = JSON.stringify(what)
  } else {
    what = '';
  }

  ABORT = true;
  EXITSTATUS = 1;

  var extra = '';
  var output = 'abort(' + what + ') at ' + stackTrace() + extra;
  if (abortDecorators) {
    abortDecorators.forEach(function(decorator) {
      output = decorator(output, what);
    });
  }
  throw output;
}
Module['abort'] = abort;

if (Module['preInit']) {
  if (typeof Module['preInit'] == 'function') Module['preInit'] = [Module['preInit']];
  while (Module['preInit'].length > 0) {
    Module['preInit'].pop()();
  }
}


Module["noExitRuntime"] = true;

run();





// {{MODULE_ADDITIONS}}




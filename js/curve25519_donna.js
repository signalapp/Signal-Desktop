// Note: For maximum-speed code, see "Optimizing Code" on the Emscripten wiki, https://github.com/kripken/emscripten/wiki/Optimizing-Code
// Note: Some Emscripten settings may limit the speed of the generated code.
try {
  this['Module'] = Module;
  Module.test;
} catch(e) {
  this['Module'] = Module = {};
}
// The environment setup code below is customized to use Module.
// *** Environment setup code ***
var ENVIRONMENT_IS_NODE = typeof process === 'object' && typeof require === 'function';
var ENVIRONMENT_IS_WEB = typeof window === 'object';
var ENVIRONMENT_IS_WORKER = typeof importScripts === 'function';
var ENVIRONMENT_IS_SHELL = !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER;
if (typeof module === "object") {
  module.exports = Module;
}
if (ENVIRONMENT_IS_NODE) {
  // Expose functionality in the same simple way that the shells work
  // Note that we pollute the global namespace here, otherwise we break in node
  Module['print'] = function(x) {
    process['stdout'].write(x + '\n');
  };
  Module['printErr'] = function(x) {
    process['stderr'].write(x + '\n');
  };
  var nodeFS = require('fs');
  var nodePath = require('path');
  Module['read'] = function(filename, binary) {
    filename = nodePath['normalize'](filename);
    var ret = nodeFS['readFileSync'](filename);
    // The path is absolute if the normalized version is the same as the resolved.
    if (!ret && filename != nodePath['resolve'](filename)) {
      filename = path.join(__dirname, '..', 'src', filename);
      ret = nodeFS['readFileSync'](filename);
    }
    if (ret && !binary) ret = ret.toString();
    return ret;
  };
  Module['readBinary'] = function(filename) { return Module['read'](filename, true) };
  Module['load'] = function(f) {
    globalEval(read(f));
  };
  if (!Module['arguments']) {
    Module['arguments'] = process['argv'].slice(2);
  }
}
if (ENVIRONMENT_IS_SHELL) {
  Module['print'] = print;
  if (typeof printErr != 'undefined') Module['printErr'] = printErr; // not present in v8 or older sm
  Module['read'] = read;
  Module['readBinary'] = function(f) {
    return read(f, 'binary');
  };
  if (!Module['arguments']) {
    if (typeof scriptArgs != 'undefined') {
      Module['arguments'] = scriptArgs;
    } else if (typeof arguments != 'undefined') {
      Module['arguments'] = arguments;
    }
  }
}
if (ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_WORKER) {
  if (!Module['print']) {
    Module['print'] = function(x) {
      console.log(x);
    };
  }
  if (!Module['printErr']) {
    Module['printErr'] = function(x) {
      console.log(x);
    };
  }
}
if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
  Module['read'] = function(url) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, false);
    xhr.send(null);
    return xhr.responseText;
  };
  if (!Module['arguments']) {
    if (typeof arguments != 'undefined') {
      Module['arguments'] = arguments;
    }
  }
}
if (ENVIRONMENT_IS_WORKER) {
  // We can do very little here...
  var TRY_USE_DUMP = false;
  if (!Module['print']) {
    Module['print'] = (TRY_USE_DUMP && (typeof(dump) !== "undefined") ? (function(x) {
      dump(x);
    }) : (function(x) {
      // self.postMessage(x); // enable this if you want stdout to be sent as messages
    }));
  }
  Module['load'] = importScripts;
}
if (!ENVIRONMENT_IS_WORKER && !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_SHELL) {
  // Unreachable because SHELL is dependant on the others
  throw 'Unknown runtime environment. Where are we?';
}
function globalEval(x) {
  eval.call(null, x);
}
if (!Module['load'] == 'undefined' && Module['read']) {
  Module['load'] = function(f) {
    globalEval(Module['read'](f));
  };
}
if (!Module['print']) {
  Module['print'] = function(){};
}
if (!Module['printErr']) {
  Module['printErr'] = Module['print'];
}
if (!Module['arguments']) {
  Module['arguments'] = [];
}
// *** Environment setup code ***
// Closure helpers
Module.print = Module['print'];
Module.printErr = Module['printErr'];
// Callbacks
if (!Module['preRun']) Module['preRun'] = [];
if (!Module['postRun']) Module['postRun'] = [];
// === Auto-generated preamble library stuff ===
//========================================
// Runtime code shared with compiler
//========================================
var Runtime = {
  stackSave: function () {
    return STACKTOP;
  },
  stackRestore: function (stackTop) {
    STACKTOP = stackTop;
  },
  forceAlign: function (target, quantum) {
    quantum = quantum || 4;
    if (quantum == 1) return target;
    if (isNumber(target) && isNumber(quantum)) {
      return Math.ceil(target/quantum)*quantum;
    } else if (isNumber(quantum) && isPowerOfTwo(quantum)) {
      var logg = log2(quantum);
      return '((((' +target + ')+' + (quantum-1) + ')>>' + logg + ')<<' + logg + ')';
    }
    return 'Math.ceil((' + target + ')/' + quantum + ')*' + quantum;
  },
  isNumberType: function (type) {
    return type in Runtime.INT_TYPES || type in Runtime.FLOAT_TYPES;
  },
  isPointerType: function isPointerType(type) {
  return type[type.length-1] == '*';
},
  isStructType: function isStructType(type) {
  if (isPointerType(type)) return false;
  if (isArrayType(type)) return true;
  if (/<?{ ?[^}]* ?}>?/.test(type)) return true; // { i32, i8 } etc. - anonymous struct types
  // See comment in isStructPointerType()
  return type[0] == '%';
},
  INT_TYPES: {"i1":0,"i8":0,"i16":0,"i32":0,"i64":0},
  FLOAT_TYPES: {"float":0,"double":0},
  or64: function (x, y) {
    var l = (x | 0) | (y | 0);
    var h = (Math.round(x / 4294967296) | Math.round(y / 4294967296)) * 4294967296;
    return l + h;
  },
  and64: function (x, y) {
    var l = (x | 0) & (y | 0);
    var h = (Math.round(x / 4294967296) & Math.round(y / 4294967296)) * 4294967296;
    return l + h;
  },
  xor64: function (x, y) {
    var l = (x | 0) ^ (y | 0);
    var h = (Math.round(x / 4294967296) ^ Math.round(y / 4294967296)) * 4294967296;
    return l + h;
  },
  getNativeTypeSize: function (type, quantumSize) {
    if (Runtime.QUANTUM_SIZE == 1) return 1;
    var size = {
      '%i1': 1,
      '%i8': 1,
      '%i16': 2,
      '%i32': 4,
      '%i64': 8,
      "%float": 4,
      "%double": 8
    }['%'+type]; // add '%' since float and double confuse Closure compiler as keys, and also spidermonkey as a compiler will remove 's from '_i8' etc
    if (!size) {
      if (type.charAt(type.length-1) == '*') {
        size = Runtime.QUANTUM_SIZE; // A pointer
      } else if (type[0] == 'i') {
        var bits = parseInt(type.substr(1));
        assert(bits % 8 == 0);
        size = bits/8;
      }
    }
    return size;
  },
  getNativeFieldSize: function (type) {
    return Math.max(Runtime.getNativeTypeSize(type), Runtime.QUANTUM_SIZE);
  },
  dedup: function dedup(items, ident) {
  var seen = {};
  if (ident) {
    return items.filter(function(item) {
      if (seen[item[ident]]) return false;
      seen[item[ident]] = true;
      return true;
    });
  } else {
    return items.filter(function(item) {
      if (seen[item]) return false;
      seen[item] = true;
      return true;
    });
  }
},
  set: function set() {
  var args = typeof arguments[0] === 'object' ? arguments[0] : arguments;
  var ret = {};
  for (var i = 0; i < args.length; i++) {
    ret[args[i]] = 0;
  }
  return ret;
},
  STACK_ALIGN: 8,
  getAlignSize: function (type, size, vararg) {
    // we align i64s and doubles on 64-bit boundaries, unlike x86
    if (type == 'i64' || type == 'double' || vararg) return 8;
    if (!type) return Math.min(size, 8); // align structures internally to 64 bits
    return Math.min(size || (type ? Runtime.getNativeFieldSize(type) : 0), Runtime.QUANTUM_SIZE);
  },
  calculateStructAlignment: function calculateStructAlignment(type) {
    type.flatSize = 0;
    type.alignSize = 0;
    var diffs = [];
    var prev = -1;
    type.flatIndexes = type.fields.map(function(field) {
      var size, alignSize;
      if (Runtime.isNumberType(field) || Runtime.isPointerType(field)) {
        size = Runtime.getNativeTypeSize(field); // pack char; char; in structs, also char[X]s.
        alignSize = Runtime.getAlignSize(field, size);
      } else if (Runtime.isStructType(field)) {
        size = Types.types[field].flatSize;
        alignSize = Runtime.getAlignSize(null, Types.types[field].alignSize);
      } else if (field[0] == 'b') {
        // bN, large number field, like a [N x i8]
        size = field.substr(1)|0;
        alignSize = 1;
      } else {
        throw 'Unclear type in struct: ' + field + ', in ' + type.name_ + ' :: ' + dump(Types.types[type.name_]);
      }
      if (type.packed) alignSize = 1;
      type.alignSize = Math.max(type.alignSize, alignSize);
      var curr = Runtime.alignMemory(type.flatSize, alignSize); // if necessary, place this on aligned memory
      type.flatSize = curr + size;
      if (prev >= 0) {
        diffs.push(curr-prev);
      }
      prev = curr;
      return curr;
    });
    type.flatSize = Runtime.alignMemory(type.flatSize, type.alignSize);
    if (diffs.length == 0) {
      type.flatFactor = type.flatSize;
    } else if (Runtime.dedup(diffs).length == 1) {
      type.flatFactor = diffs[0];
    }
    type.needsFlattening = (type.flatFactor != 1);
    return type.flatIndexes;
  },
  generateStructInfo: function (struct, typeName, offset) {
    var type, alignment;
    if (typeName) {
      offset = offset || 0;
      type = (typeof Types === 'undefined' ? Runtime.typeInfo : Types.types)[typeName];
      if (!type) return null;
      if (type.fields.length != struct.length) {
        printErr('Number of named fields must match the type for ' + typeName + ': possibly duplicate struct names. Cannot return structInfo');
        return null;
      }
      alignment = type.flatIndexes;
    } else {
      var type = { fields: struct.map(function(item) { return item[0] }) };
      alignment = Runtime.calculateStructAlignment(type);
    }
    var ret = {
      __size__: type.flatSize
    };
    if (typeName) {
      struct.forEach(function(item, i) {
        if (typeof item === 'string') {
          ret[item] = alignment[i] + offset;
        } else {
          // embedded struct
          var key;
          for (var k in item) key = k;
          ret[key] = Runtime.generateStructInfo(item[key], type.fields[i], alignment[i]);
        }
      });
    } else {
      struct.forEach(function(item, i) {
        ret[item[1]] = alignment[i];
      });
    }
    return ret;
  },
  dynCall: function (sig, ptr, args) {
    if (args && args.length) {
      if (!args.splice) args = Array.prototype.slice.call(args);
      args.splice(0, 0, ptr);
      return Module['dynCall_' + sig].apply(null, args);
    } else {
      return Module['dynCall_' + sig].call(null, ptr);
    }
  },
  functionPointers: [],
  addFunction: function (func) {
    for (var i = 0; i < Runtime.functionPointers.length; i++) {
      if (!Runtime.functionPointers[i]) {
        Runtime.functionPointers[i] = func;
        return 2 + 2*i;
      }
    }
    throw 'Finished up all reserved function pointers. Use a higher value for RESERVED_FUNCTION_POINTERS.';
  },
  removeFunction: function (index) {
    Runtime.functionPointers[(index-2)/2] = null;
  },
  warnOnce: function (text) {
    if (!Runtime.warnOnce.shown) Runtime.warnOnce.shown = {};
    if (!Runtime.warnOnce.shown[text]) {
      Runtime.warnOnce.shown[text] = 1;
      Module.printErr(text);
    }
  },
  funcWrappers: {},
  getFuncWrapper: function (func, sig) {
    assert(sig);
    if (!Runtime.funcWrappers[func]) {
      Runtime.funcWrappers[func] = function() {
        return Runtime.dynCall(sig, func, arguments);
      };
    }
    return Runtime.funcWrappers[func];
  },
  UTF8Processor: function () {
    var buffer = [];
    var needed = 0;
    this.processCChar = function (code) {
      code = code & 0xff;
      if (needed) {
        buffer.push(code);
        needed--;
      }
      if (buffer.length == 0) {
        if (code < 128) return String.fromCharCode(code);
        buffer.push(code);
        if (code > 191 && code < 224) {
          needed = 1;
        } else {
          needed = 2;
        }
        return '';
      }
      if (needed > 0) return '';
      var c1 = buffer[0];
      var c2 = buffer[1];
      var c3 = buffer[2];
      var ret;
      if (c1 > 191 && c1 < 224) {
        ret = String.fromCharCode(((c1 & 31) << 6) | (c2 & 63));
      } else {
        ret = String.fromCharCode(((c1 & 15) << 12) | ((c2 & 63) << 6) | (c3 & 63));
      }
      buffer.length = 0;
      return ret;
    }
    this.processJSString = function(string) {
      string = unescape(encodeURIComponent(string));
      var ret = [];
      for (var i = 0; i < string.length; i++) {
        ret.push(string.charCodeAt(i));
      }
      return ret;
    }
  },
  stackAlloc: function (size) { var ret = STACKTOP;STACKTOP = (STACKTOP + size)|0;STACKTOP = ((((STACKTOP)+7)>>3)<<3); return ret; },
  staticAlloc: function (size) { var ret = STATICTOP;STATICTOP = (STATICTOP + size)|0;STATICTOP = ((((STATICTOP)+7)>>3)<<3); return ret; },
  dynamicAlloc: function (size) { var ret = DYNAMICTOP;DYNAMICTOP = (DYNAMICTOP + size)|0;DYNAMICTOP = ((((DYNAMICTOP)+7)>>3)<<3); if (DYNAMICTOP >= TOTAL_MEMORY) enlargeMemory();; return ret; },
  alignMemory: function (size,quantum) { var ret = size = Math.ceil((size)/(quantum ? quantum : 8))*(quantum ? quantum : 8); return ret; },
  makeBigInt: function (low,high,unsigned) { var ret = (unsigned ? ((+(((low)>>>(0))))+((+(((high)>>>(0))))*(+(4294967296)))) : ((+(((low)>>>(0))))+((+(((high)|(0))))*(+(4294967296))))); return ret; },
  GLOBAL_BASE: 8,
  QUANTUM_SIZE: 4,
  __dummy__: 0
}
//========================================
// Runtime essentials
//========================================
var __THREW__ = 0; // Used in checking for thrown exceptions.
var ABORT = false; // whether we are quitting the application. no code should run after this. set in exit() and abort()
var undef = 0;
// tempInt is used for 32-bit signed values or smaller. tempBigInt is used
// for 32-bit unsigned values or more than 32 bits. TODO: audit all uses of tempInt
var tempValue, tempInt, tempBigInt, tempInt2, tempBigInt2, tempPair, tempBigIntI, tempBigIntR, tempBigIntS, tempBigIntP, tempBigIntD;
var tempI64, tempI64b;
var tempRet0, tempRet1, tempRet2, tempRet3, tempRet4, tempRet5, tempRet6, tempRet7, tempRet8, tempRet9;
function abort(text) {
  Module.print(text + ':\n' + (new Error).stack);
  ABORT = true;
  throw "Assertion: " + text;
}
function assert(condition, text) {
  if (!condition) {
    abort('Assertion failed: ' + text);
  }
}
var globalScope = this;
// C calling interface. A convenient way to call C functions (in C files, or
// defined with extern "C").
//
// Note: LLVM optimizations can inline and remove functions, after which you will not be
//       able to call them. Closure can also do so. To avoid that, add your function to
//       the exports using something like
//
//         -s EXPORTED_FUNCTIONS='["_main", "_myfunc"]'
//
// @param ident      The name of the C function (note that C++ functions will be name-mangled - use extern "C")
// @param returnType The return type of the function, one of the JS types 'number', 'string' or 'array' (use 'number' for any C pointer, and
//                   'array' for JavaScript arrays and typed arrays).
// @param argTypes   An array of the types of arguments for the function (if there are no arguments, this can be ommitted). Types are as in returnType,
//                   except that 'array' is not possible (there is no way for us to know the length of the array)
// @param args       An array of the arguments to the function, as native JS values (as in returnType)
//                   Note that string arguments will be stored on the stack (the JS string will become a C string on the stack).
// @return           The return value, as a native JS value (as in returnType)
function ccall(ident, returnType, argTypes, args) {
  return ccallFunc(getCFunc(ident), returnType, argTypes, args);
}
Module["ccall"] = ccall;
// Returns the C function with a specified identifier (for C++, you need to do manual name mangling)
function getCFunc(ident) {
  try {
    var func = globalScope['Module']['_' + ident]; // closure exported function
    if (!func) func = eval('_' + ident); // explicit lookup
  } catch(e) {
  }
  assert(func, 'Cannot call unknown function ' + ident + ' (perhaps LLVM optimizations or closure removed it?)');
  return func;
}
// Internal function that does a C call using a function, not an identifier
function ccallFunc(func, returnType, argTypes, args) {
  var stack = 0;
  function toC(value, type) {
    if (type == 'string') {
      if (value === null || value === undefined || value === 0) return 0; // null string
      if (!stack) stack = Runtime.stackSave();
      var ret = Runtime.stackAlloc(value.length+1);
      writeStringToMemory(value, ret);
      return ret;
    } else if (type == 'array') {
      if (!stack) stack = Runtime.stackSave();
      var ret = Runtime.stackAlloc(value.length);
      writeArrayToMemory(value, ret);
      return ret;
    }
    return value;
  }
  function fromC(value, type) {
    if (type == 'string') {
      return Pointer_stringify(value);
    }
    assert(type != 'array');
    return value;
  }
  var i = 0;
  var cArgs = args ? args.map(function(arg) {
    return toC(arg, argTypes[i++]);
  }) : [];
  var ret = fromC(func.apply(null, cArgs), returnType);
  if (stack) Runtime.stackRestore(stack);
  return ret;
}
// Returns a native JS wrapper for a C function. This is similar to ccall, but
// returns a function you can call repeatedly in a normal way. For example:
//
//   var my_function = cwrap('my_c_function', 'number', ['number', 'number']);
//   alert(my_function(5, 22));
//   alert(my_function(99, 12));
//
function cwrap(ident, returnType, argTypes) {
  var func = getCFunc(ident);
  return function() {
    return ccallFunc(func, returnType, argTypes, Array.prototype.slice.call(arguments));
  }
}
Module["cwrap"] = cwrap;
// Sets a value in memory in a dynamic way at run-time. Uses the
// type data. This is the same as makeSetValue, except that
// makeSetValue is done at compile-time and generates the needed
// code then, whereas this function picks the right code at
// run-time.
// Note that setValue and getValue only do *aligned* writes and reads!
// Note that ccall uses JS types as for defining types, while setValue and
// getValue need LLVM types ('i8', 'i32') - this is a lower-level operation
function setValue(ptr, value, type, noSafe) {
  type = type || 'i8';
  if (type.charAt(type.length-1) === '*') type = 'i32'; // pointers are 32-bit
    switch(type) {
      case 'i1': HEAP8[(ptr)]=value; break;
      case 'i8': HEAP8[(ptr)]=value; break;
      case 'i16': HEAP16[((ptr)>>1)]=value; break;
      case 'i32': HEAP32[((ptr)>>2)]=value; break;
      case 'i64': (tempI64 = [value>>>0,Math.min(Math.floor((value)/(+(4294967296))), (+(4294967295)))>>>0],HEAP32[((ptr)>>2)]=tempI64[0],HEAP32[(((ptr)+(4))>>2)]=tempI64[1]); break;
      case 'float': HEAPF32[((ptr)>>2)]=value; break;
      case 'double': HEAPF64[((ptr)>>3)]=value; break;
      default: abort('invalid type for setValue: ' + type);
    }
}
Module['setValue'] = setValue;
// Parallel to setValue.
function getValue(ptr, type, noSafe) {
  type = type || 'i8';
  if (type.charAt(type.length-1) === '*') type = 'i32'; // pointers are 32-bit
    switch(type) {
      case 'i1': return HEAP8[(ptr)];
      case 'i8': return HEAP8[(ptr)];
      case 'i16': return HEAP16[((ptr)>>1)];
      case 'i32': return HEAP32[((ptr)>>2)];
      case 'i64': return HEAP32[((ptr)>>2)];
      case 'float': return HEAPF32[((ptr)>>2)];
      case 'double': return HEAPF64[((ptr)>>3)];
      default: abort('invalid type for setValue: ' + type);
    }
  return null;
}
Module['getValue'] = getValue;
var ALLOC_NORMAL = 0; // Tries to use _malloc()
var ALLOC_STACK = 1; // Lives for the duration of the current function call
var ALLOC_STATIC = 2; // Cannot be freed
var ALLOC_DYNAMIC = 3; // Cannot be freed except through sbrk
var ALLOC_NONE = 4; // Do not allocate
Module['ALLOC_NORMAL'] = ALLOC_NORMAL;
Module['ALLOC_STACK'] = ALLOC_STACK;
Module['ALLOC_STATIC'] = ALLOC_STATIC;
Module['ALLOC_DYNAMIC'] = ALLOC_DYNAMIC;
Module['ALLOC_NONE'] = ALLOC_NONE;
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
    ret = [_malloc, Runtime.stackAlloc, Runtime.staticAlloc, Runtime.dynamicAlloc][allocator === undefined ? ALLOC_STATIC : allocator](Math.max(size, singleType ? 1 : types.length));
  }
  if (zeroinit) {
    var ptr = ret, stop;
    assert((ret & 3) == 0);
    stop = ret + (size & ~3);
    for (; ptr < stop; ptr += 4) {
      HEAP32[((ptr)>>2)]=0;
    }
    stop = ret + size;
    while (ptr < stop) {
      HEAP8[((ptr++)|0)]=0;
    }
    return ret;
  }
  if (singleType === 'i8') {
    if (slab.subarray || slab.slice) {
      HEAPU8.set(slab, ret);
    } else {
      HEAPU8.set(new Uint8Array(slab), ret);
    }
    return ret;
  }
  var i = 0, type, typeSize, previousType;
  while (i < size) {
    var curr = slab[i];
    if (typeof curr === 'function') {
      curr = Runtime.getFunctionIndex(curr);
    }
    type = singleType || types[i];
    if (type === 0) {
      i++;
      continue;
    }
    if (type == 'i64') type = 'i32'; // special case: we have one i32 here, and one i32 later
    setValue(ret+i, curr, type);
    // no need to look up size unless type changes, so cache it
    if (previousType !== type) {
      typeSize = Runtime.getNativeTypeSize(type);
      previousType = type;
    }
    i += typeSize;
  }
  return ret;
}
Module['allocate'] = allocate;
function Pointer_stringify(ptr, /* optional */ length) {
  // Find the length, and check for UTF while doing so
  var hasUtf = false;
  var t;
  var i = 0;
  while (1) {
    t = HEAPU8[(((ptr)+(i))|0)];
    if (t >= 128) hasUtf = true;
    else if (t == 0 && !length) break;
    i++;
    if (length && i == length) break;
  }
  if (!length) length = i;
  var ret = '';
  if (!hasUtf) {
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
  var utf8 = new Runtime.UTF8Processor();
  for (i = 0; i < length; i++) {
    t = HEAPU8[(((ptr)+(i))|0)];
    ret += utf8.processCChar(t);
  }
  return ret;
}
Module['Pointer_stringify'] = Pointer_stringify;
// Memory management
var PAGE_SIZE = 4096;
function alignMemoryPage(x) {
  return ((x+4095)>>12)<<12;
}
var HEAP;
var HEAP8, HEAPU8, HEAP16, HEAPU16, HEAP32, HEAPU32, HEAPF32, HEAPF64;
var STATIC_BASE = 0, STATICTOP = 0, staticSealed = false; // static area
var STACK_BASE = 0, STACKTOP = 0, STACK_MAX = 0; // stack area
var DYNAMIC_BASE = 0, DYNAMICTOP = 0; // dynamic area handled by sbrk
function enlargeMemory() {
  abort('Cannot enlarge memory arrays in asm.js. Either (1) compile with -s TOTAL_MEMORY=X with X higher than the current value, or (2) set Module.TOTAL_MEMORY before the program runs.');
}
var TOTAL_STACK = Module['TOTAL_STACK'] || 5242880;
var TOTAL_MEMORY = Module['TOTAL_MEMORY'] || 16777216;
var FAST_MEMORY = Module['FAST_MEMORY'] || 2097152;
// Initialize the runtime's memory
// check for full engine support (use string 'subarray' to avoid closure compiler confusion)
assert(!!Int32Array && !!Float64Array && !!(new Int32Array(1)['subarray']) && !!(new Int32Array(1)['set']),
       'Cannot fallback to non-typed array case: Code is too specialized');
var buffer = new ArrayBuffer(TOTAL_MEMORY);
HEAP8 = new Int8Array(buffer);
HEAP16 = new Int16Array(buffer);
HEAP32 = new Int32Array(buffer);
HEAPU8 = new Uint8Array(buffer);
HEAPU16 = new Uint16Array(buffer);
HEAPU32 = new Uint32Array(buffer);
HEAPF32 = new Float32Array(buffer);
HEAPF64 = new Float64Array(buffer);
// Endianness check (note: assumes compiler arch was little-endian)
HEAP32[0] = 255;
assert(HEAPU8[0] === 255 && HEAPU8[3] === 0, 'Typed arrays 2 must be run on a little-endian system');
Module['HEAP'] = HEAP;
Module['HEAP8'] = HEAP8;
Module['HEAP16'] = HEAP16;
Module['HEAP32'] = HEAP32;
Module['HEAPU8'] = HEAPU8;
Module['HEAPU16'] = HEAPU16;
Module['HEAPU32'] = HEAPU32;
Module['HEAPF32'] = HEAPF32;
Module['HEAPF64'] = HEAPF64;
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
        Runtime.dynCall('v', func);
      } else {
        Runtime.dynCall('vi', func, [callback.arg]);
      }
    } else {
      func(callback.arg === undefined ? null : callback.arg);
    }
  }
}
var __ATINIT__ = []; // functions called during startup
var __ATMAIN__ = []; // functions called when main() is to be run
var __ATEXIT__ = []; // functions called during shutdown
var runtimeInitialized = false;
function ensureInitRuntime() {
  if (runtimeInitialized) return;
  runtimeInitialized = true;
  callRuntimeCallbacks(__ATINIT__);
}
function preMain() {
  callRuntimeCallbacks(__ATMAIN__);
}
function exitRuntime() {
  callRuntimeCallbacks(__ATEXIT__);
}
// Tools
// This processes a JS string into a C-line array of numbers, 0-terminated.
// For LLVM-originating strings, see parser.js:parseLLVMString function
function intArrayFromString(stringy, dontAddNull, length /* optional */) {
  var ret = (new Runtime.UTF8Processor()).processJSString(stringy);
  if (length) {
    ret.length = length;
  }
  if (!dontAddNull) {
    ret.push(0);
  }
  return ret;
}
Module['intArrayFromString'] = intArrayFromString;
function intArrayToString(array) {
  var ret = [];
  for (var i = 0; i < array.length; i++) {
    var chr = array[i];
    if (chr > 0xFF) {
      chr &= 0xFF;
    }
    ret.push(String.fromCharCode(chr));
  }
  return ret.join('');
}
Module['intArrayToString'] = intArrayToString;
// Write a Javascript array to somewhere in the heap
function writeStringToMemory(string, buffer, dontAddNull) {
  var array = intArrayFromString(string, dontAddNull);
  var i = 0;
  while (i < array.length) {
    var chr = array[i];
    HEAP8[(((buffer)+(i))|0)]=chr
    i = i + 1;
  }
}
Module['writeStringToMemory'] = writeStringToMemory;
function writeArrayToMemory(array, buffer) {
  for (var i = 0; i < array.length; i++) {
    HEAP8[(((buffer)+(i))|0)]=array[i];
  }
}
Module['writeArrayToMemory'] = writeArrayToMemory;
function unSign(value, bits, ignore, sig) {
  if (value >= 0) {
    return value;
  }
  return bits <= 32 ? 2*Math.abs(1 << (bits-1)) + value // Need some trickery, since if bits == 32, we are right at the limit of the bits JS uses in bitshifts
                    : Math.pow(2, bits)         + value;
}
function reSign(value, bits, ignore, sig) {
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
if (!Math['imul']) Math['imul'] = function(a, b) {
  var ah  = a >>> 16;
  var al = a & 0xffff;
  var bh  = b >>> 16;
  var bl = b & 0xffff;
  return (al*bl + ((ah*bl + al*bh) << 16))|0;
};
// A counter of dependencies for calling run(). If we need to
// do asynchronous work before running, increment this and
// decrement it. Incrementing must happen in a place like
// PRE_RUN_ADDITIONS (used by emcc to add file preloading).
// Note that you can add dependencies in preRun, even though
// it happens right before run - run will be postponed until
// the dependencies are met.
var runDependencies = 0;
var runDependencyTracking = {};
var calledInit = false, calledRun = false;
var runDependencyWatcher = null;
function addRunDependency(id) {
  runDependencies++;
  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }
  if (id) {
    assert(!runDependencyTracking[id]);
    runDependencyTracking[id] = 1;
  } else {
    Module.printErr('warning: run dependency added without ID');
  }
}
Module['addRunDependency'] = addRunDependency;
function removeRunDependency(id) {
  runDependencies--;
  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }
  if (id) {
    assert(runDependencyTracking[id]);
    delete runDependencyTracking[id];
  } else {
    Module.printErr('warning: run dependency removed without ID');
  }
  if (runDependencies == 0) {
    if (runDependencyWatcher !== null) {
      clearInterval(runDependencyWatcher);
      runDependencyWatcher = null;
    } 
    // If run has never been called, and we should call run (INVOKE_RUN is true, and Module.noInitialRun is not false)
    if (!calledRun && shouldRunNow) run();
  }
}
Module['removeRunDependency'] = removeRunDependency;
Module["preloadedImages"] = {}; // maps url to image data
Module["preloadedAudios"] = {}; // maps url to audio data
function addPreRun(func) {
  if (!Module['preRun']) Module['preRun'] = [];
  else if (typeof Module['preRun'] == 'function') Module['preRun'] = [Module['preRun']];
  Module['preRun'].push(func);
}
var awaitingMemoryInitializer = false;
function loadMemoryInitializer(filename) {
  function applyData(data) {
    HEAPU8.set(data, STATIC_BASE);
    runPostSets();
  }
  // always do this asynchronously, to keep shell and web as similar as possible
  addPreRun(function() {
    if (ENVIRONMENT_IS_NODE || ENVIRONMENT_IS_SHELL) {
      applyData(Module['readBinary'](filename));
    } else {
      Browser.asyncLoad(filename, function(data) {
        applyData(data);
      }, function(data) {
        throw 'could not load memory initializer ' + filename;
      });
    }
  });
  awaitingMemoryInitializer = false;
}
// === Body ===
STATIC_BASE = 8;
STATICTOP = STATIC_BASE + 0;
/* no memory initializer */
function runPostSets() {
}
if (!awaitingMemoryInitializer) runPostSets();
var tempDoublePtr = Runtime.alignMemory(allocate(12, "i8", ALLOC_STATIC), 8);
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
  Module["_memcpy"] = _memcpy;var _llvm_memcpy_p0i8_p0i8_i32=_memcpy;
  Module["_memset"] = _memset;var _llvm_memset_p0i8_i32=_memset;
  function _llvm_lifetime_start() {}
  function _llvm_lifetime_end() {}
  function _malloc(bytes) {
      /* Over-allocate to make sure it is byte-aligned by 8.
       * This will leak memory, but this is only the dummy
       * implementation (replaced by dlmalloc normally) so
       * not an issue.
       */
      var ptr = Runtime.dynamicAlloc(bytes + 8);
      return (ptr+8) & 0xFFFFFFF8;
    }
  function _free() {
  }
  Module["_strlen"] = _strlen;
  var Browser={mainLoop:{scheduler:null,shouldPause:false,paused:false,queue:[],pause:function () {
          Browser.mainLoop.shouldPause = true;
        },resume:function () {
          if (Browser.mainLoop.paused) {
            Browser.mainLoop.paused = false;
            Browser.mainLoop.scheduler();
          }
          Browser.mainLoop.shouldPause = false;
        },updateStatus:function () {
          if (Module['setStatus']) {
            var message = Module['statusMessage'] || 'Please wait...';
            var remaining = Browser.mainLoop.remainingBlockers;
            var expected = Browser.mainLoop.expectedBlockers;
            if (remaining) {
              if (remaining < expected) {
                Module['setStatus'](message + ' (' + (expected - remaining) + '/' + expected + ')');
              } else {
                Module['setStatus'](message);
              }
            } else {
              Module['setStatus']('');
            }
          }
        }},isFullScreen:false,pointerLock:false,moduleContextCreatedCallbacks:[],workers:[],init:function () {
        if (Browser.initted) return;
        Browser.initted = true;
        try {
          new Blob();
          Browser.hasBlobConstructor = true;
        } catch(e) {
          Browser.hasBlobConstructor = false;
          console.log("warning: no blob constructor, cannot create blobs with mimetypes");
        }
        Browser.BlobBuilder = typeof MozBlobBuilder != "undefined" ? MozBlobBuilder : (typeof WebKitBlobBuilder != "undefined" ? WebKitBlobBuilder : (!Browser.hasBlobConstructor ? console.log("warning: no BlobBuilder") : null));
        Browser.URLObject = typeof window != "undefined" ? (window.URL ? window.URL : window.webkitURL) : console.log("warning: cannot create object URLs");
        // Support for plugins that can process preloaded files. You can add more of these to
        // your app by creating and appending to Module.preloadPlugins.
        //
        // Each plugin is asked if it can handle a file based on the file's name. If it can,
        // it is given the file's raw data. When it is done, it calls a callback with the file's
        // (possibly modified) data. For example, a plugin might decompress a file, or it
        // might create some side data structure for use later (like an Image element, etc.).
        function getMimetype(name) {
          return {
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'bmp': 'image/bmp',
            'ogg': 'audio/ogg',
            'wav': 'audio/wav',
            'mp3': 'audio/mpeg'
          }[name.substr(name.lastIndexOf('.')+1)];
        }
        if (!Module["preloadPlugins"]) Module["preloadPlugins"] = [];
        var imagePlugin = {};
        imagePlugin['canHandle'] = function(name) {
          return !Module.noImageDecoding && /\.(jpg|jpeg|png|bmp)$/.exec(name);
        };
        imagePlugin['handle'] = function(byteArray, name, onload, onerror) {
          var b = null;
          if (Browser.hasBlobConstructor) {
            try {
              b = new Blob([byteArray], { type: getMimetype(name) });
            } catch(e) {
              Runtime.warnOnce('Blob constructor present but fails: ' + e + '; falling back to blob builder');
            }
          }
          if (!b) {
            var bb = new Browser.BlobBuilder();
            bb.append((new Uint8Array(byteArray)).buffer); // we need to pass a buffer, and must copy the array to get the right data range
            b = bb.getBlob();
          }
          var url = Browser.URLObject.createObjectURL(b);
          var img = new Image();
          img.onload = function() {
            assert(img.complete, 'Image ' + name + ' could not be decoded');
            var canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            var ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            Module["preloadedImages"][name] = canvas;
            Browser.URLObject.revokeObjectURL(url);
            if (onload) onload(byteArray);
          };
          img.onerror = function(event) {
            console.log('Image ' + url + ' could not be decoded');
            if (onerror) onerror();
          };
          img.src = url;
        };
        Module['preloadPlugins'].push(imagePlugin);
        var audioPlugin = {};
        audioPlugin['canHandle'] = function(name) {
          return !Module.noAudioDecoding && name.substr(-4) in { '.ogg': 1, '.wav': 1, '.mp3': 1 };
        };
        audioPlugin['handle'] = function(byteArray, name, onload, onerror) {
          var done = false;
          function finish(audio) {
            if (done) return;
            done = true;
            Module["preloadedAudios"][name] = audio;
            if (onload) onload(byteArray);
          }
          function fail() {
            if (done) return;
            done = true;
            Module["preloadedAudios"][name] = new Audio(); // empty shim
            if (onerror) onerror();
          }
          if (Browser.hasBlobConstructor) {
            try {
              var b = new Blob([byteArray], { type: getMimetype(name) });
            } catch(e) {
              return fail();
            }
            var url = Browser.URLObject.createObjectURL(b); // XXX we never revoke this!
            var audio = new Audio();
            audio.addEventListener('canplaythrough', function() { finish(audio) }, false); // use addEventListener due to chromium bug 124926
            audio.onerror = function(event) {
              if (done) return;
              console.log('warning: browser could not fully decode audio ' + name + ', trying slower base64 approach');
              function encode64(data) {
                var BASE = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
                var PAD = '=';
                var ret = '';
                var leftchar = 0;
                var leftbits = 0;
                for (var i = 0; i < data.length; i++) {
                  leftchar = (leftchar << 8) | data[i];
                  leftbits += 8;
                  while (leftbits >= 6) {
                    var curr = (leftchar >> (leftbits-6)) & 0x3f;
                    leftbits -= 6;
                    ret += BASE[curr];
                  }
                }
                if (leftbits == 2) {
                  ret += BASE[(leftchar&3) << 4];
                  ret += PAD + PAD;
                } else if (leftbits == 4) {
                  ret += BASE[(leftchar&0xf) << 2];
                  ret += PAD;
                }
                return ret;
              }
              audio.src = 'data:audio/x-' + name.substr(-3) + ';base64,' + encode64(byteArray);
              finish(audio); // we don't wait for confirmation this worked - but it's worth trying
            };
            audio.src = url;
            // workaround for chrome bug 124926 - we do not always get oncanplaythrough or onerror
            Browser.safeSetTimeout(function() {
              finish(audio); // try to use it even though it is not necessarily ready to play
            }, 10000);
          } else {
            return fail();
          }
        };
        Module['preloadPlugins'].push(audioPlugin);
        // Canvas event setup
        var canvas = Module['canvas'];
        canvas.requestPointerLock = canvas['requestPointerLock'] ||
                                    canvas['mozRequestPointerLock'] ||
                                    canvas['webkitRequestPointerLock'];
        canvas.exitPointerLock = document['exitPointerLock'] ||
                                 document['mozExitPointerLock'] ||
                                 document['webkitExitPointerLock'] ||
                                 function(){}; // no-op if function does not exist
        canvas.exitPointerLock = canvas.exitPointerLock.bind(document);
        function pointerLockChange() {
          Browser.pointerLock = document['pointerLockElement'] === canvas ||
                                document['mozPointerLockElement'] === canvas ||
                                document['webkitPointerLockElement'] === canvas;
        }
        document.addEventListener('pointerlockchange', pointerLockChange, false);
        document.addEventListener('mozpointerlockchange', pointerLockChange, false);
        document.addEventListener('webkitpointerlockchange', pointerLockChange, false);
        if (Module['elementPointerLock']) {
          canvas.addEventListener("click", function(ev) {
            if (!Browser.pointerLock && canvas.requestPointerLock) {
              canvas.requestPointerLock();
              ev.preventDefault();
            }
          }, false);
        }
      },createContext:function (canvas, useWebGL, setInModule) {
        var ctx;
        try {
          if (useWebGL) {
            ctx = canvas.getContext('experimental-webgl', {
              alpha: false
            });
          } else {
            ctx = canvas.getContext('2d');
          }
          if (!ctx) throw ':(';
        } catch (e) {
          Module.print('Could not create canvas - ' + e);
          return null;
        }
        if (useWebGL) {
          // Set the background of the WebGL canvas to black
          canvas.style.backgroundColor = "black";
          // Warn on context loss
          canvas.addEventListener('webglcontextlost', function(event) {
            alert('WebGL context lost. You will need to reload the page.');
          }, false);
        }
        if (setInModule) {
          Module.ctx = ctx;
          Module.useWebGL = useWebGL;
          Browser.moduleContextCreatedCallbacks.forEach(function(callback) { callback() });
          Browser.init();
        }
        return ctx;
      },destroyContext:function (canvas, useWebGL, setInModule) {},fullScreenHandlersInstalled:false,lockPointer:undefined,resizeCanvas:undefined,requestFullScreen:function (lockPointer, resizeCanvas) {
        Browser.lockPointer = lockPointer;
        Browser.resizeCanvas = resizeCanvas;
        if (typeof Browser.lockPointer === 'undefined') Browser.lockPointer = true;
        if (typeof Browser.resizeCanvas === 'undefined') Browser.resizeCanvas = false;
        var canvas = Module['canvas'];
        function fullScreenChange() {
          Browser.isFullScreen = false;
          if ((document['webkitFullScreenElement'] || document['webkitFullscreenElement'] ||
               document['mozFullScreenElement'] || document['mozFullscreenElement'] ||
               document['fullScreenElement'] || document['fullscreenElement']) === canvas) {
            canvas.cancelFullScreen = document['cancelFullScreen'] ||
                                      document['mozCancelFullScreen'] ||
                                      document['webkitCancelFullScreen'];
            canvas.cancelFullScreen = canvas.cancelFullScreen.bind(document);
            if (Browser.lockPointer) canvas.requestPointerLock();
            Browser.isFullScreen = true;
            if (Browser.resizeCanvas) Browser.setFullScreenCanvasSize();
          } else if (Browser.resizeCanvas){
            Browser.setWindowedCanvasSize();
          }
          if (Module['onFullScreen']) Module['onFullScreen'](Browser.isFullScreen);
        }
        if (!Browser.fullScreenHandlersInstalled) {
          Browser.fullScreenHandlersInstalled = true;
          document.addEventListener('fullscreenchange', fullScreenChange, false);
          document.addEventListener('mozfullscreenchange', fullScreenChange, false);
          document.addEventListener('webkitfullscreenchange', fullScreenChange, false);
        }
        canvas.requestFullScreen = canvas['requestFullScreen'] ||
                                   canvas['mozRequestFullScreen'] ||
                                   (canvas['webkitRequestFullScreen'] ? function() { canvas['webkitRequestFullScreen'](Element['ALLOW_KEYBOARD_INPUT']) } : null);
        canvas.requestFullScreen();
      },requestAnimationFrame:function (func) {
        if (!window.requestAnimationFrame) {
          window.requestAnimationFrame = window['requestAnimationFrame'] ||
                                         window['mozRequestAnimationFrame'] ||
                                         window['webkitRequestAnimationFrame'] ||
                                         window['msRequestAnimationFrame'] ||
                                         window['oRequestAnimationFrame'] ||
                                         window['setTimeout'];
        }
        window.requestAnimationFrame(func);
      },safeCallback:function (func) {
        return function() {
          if (!ABORT) return func.apply(null, arguments);
        };
      },safeRequestAnimationFrame:function (func) {
        return Browser.requestAnimationFrame(function() {
          if (!ABORT) func();
        });
      },safeSetTimeout:function (func, timeout) {
        return setTimeout(function() {
          if (!ABORT) func();
        }, timeout);
      },safeSetInterval:function (func, timeout) {
        return setInterval(function() {
          if (!ABORT) func();
        }, timeout);
      },getUserMedia:function (func) {
        if(!window.getUserMedia) {
          window.getUserMedia = navigator['getUserMedia'] ||
                                navigator['mozGetUserMedia'];
        }
        window.getUserMedia(func);
      },getMovementX:function (event) {
        return event['movementX'] ||
               event['mozMovementX'] ||
               event['webkitMovementX'] ||
               0;
      },getMovementY:function (event) {
        return event['movementY'] ||
               event['mozMovementY'] ||
               event['webkitMovementY'] ||
               0;
      },mouseX:0,mouseY:0,mouseMovementX:0,mouseMovementY:0,calculateMouseEvent:function (event) { // event should be mousemove, mousedown or mouseup
        if (Browser.pointerLock) {
          // When the pointer is locked, calculate the coordinates
          // based on the movement of the mouse.
          // Workaround for Firefox bug 764498
          if (event.type != 'mousemove' &&
              ('mozMovementX' in event)) {
            Browser.mouseMovementX = Browser.mouseMovementY = 0;
          } else {
            Browser.mouseMovementX = Browser.getMovementX(event);
            Browser.mouseMovementY = Browser.getMovementY(event);
          }
          Browser.mouseX = SDL.mouseX + Browser.mouseMovementX;
          Browser.mouseY = SDL.mouseY + Browser.mouseMovementY;
        } else {
          // Otherwise, calculate the movement based on the changes
          // in the coordinates.
          var rect = Module["canvas"].getBoundingClientRect();
          var x = event.pageX - (window.scrollX + rect.left);
          var y = event.pageY - (window.scrollY + rect.top);
          // the canvas might be CSS-scaled compared to its backbuffer;
          // SDL-using content will want mouse coordinates in terms
          // of backbuffer units.
          var cw = Module["canvas"].width;
          var ch = Module["canvas"].height;
          x = x * (cw / rect.width);
          y = y * (ch / rect.height);
          Browser.mouseMovementX = x - Browser.mouseX;
          Browser.mouseMovementY = y - Browser.mouseY;
          Browser.mouseX = x;
          Browser.mouseY = y;
        }
      },xhrLoad:function (url, onload, onerror) {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.responseType = 'arraybuffer';
        xhr.onload = function() {
          if (xhr.status == 200 || (xhr.status == 0 && xhr.response)) { // file URLs can return 0
            onload(xhr.response);
          } else {
            onerror();
          }
        };
        xhr.onerror = onerror;
        xhr.send(null);
      },asyncLoad:function (url, onload, onerror, noRunDep) {
        Browser.xhrLoad(url, function(arrayBuffer) {
          assert(arrayBuffer, 'Loading data file "' + url + '" failed (no arrayBuffer).');
          onload(new Uint8Array(arrayBuffer));
          if (!noRunDep) removeRunDependency('al ' + url);
        }, function(event) {
          if (onerror) {
            onerror();
          } else {
            throw 'Loading data file "' + url + '" failed.';
          }
        });
        if (!noRunDep) addRunDependency('al ' + url);
      },resizeListeners:[],updateResizeListeners:function () {
        var canvas = Module['canvas'];
        Browser.resizeListeners.forEach(function(listener) {
          listener(canvas.width, canvas.height);
        });
      },setCanvasSize:function (width, height, noUpdates) {
        var canvas = Module['canvas'];
        canvas.width = width;
        canvas.height = height;
        if (!noUpdates) Browser.updateResizeListeners();
      },windowedWidth:0,windowedHeight:0,setFullScreenCanvasSize:function () {
        var canvas = Module['canvas'];
        this.windowedWidth = canvas.width;
        this.windowedHeight = canvas.height;
        canvas.width = screen.width;
        canvas.height = screen.height;
        var flags = HEAPU32[((SDL.screen+Runtime.QUANTUM_SIZE*0)>>2)];
        flags = flags | 0x00800000; // set SDL_FULLSCREEN flag
        HEAP32[((SDL.screen+Runtime.QUANTUM_SIZE*0)>>2)]=flags
        Browser.updateResizeListeners();
      },setWindowedCanvasSize:function () {
        var canvas = Module['canvas'];
        canvas.width = this.windowedWidth;
        canvas.height = this.windowedHeight;
        var flags = HEAPU32[((SDL.screen+Runtime.QUANTUM_SIZE*0)>>2)];
        flags = flags & ~0x00800000; // clear SDL_FULLSCREEN flag
        HEAP32[((SDL.screen+Runtime.QUANTUM_SIZE*0)>>2)]=flags
        Browser.updateResizeListeners();
      }};
Module["requestFullScreen"] = function(lockPointer, resizeCanvas) { Browser.requestFullScreen(lockPointer, resizeCanvas) };
  Module["requestAnimationFrame"] = function(func) { Browser.requestAnimationFrame(func) };
  Module["pauseMainLoop"] = function() { Browser.mainLoop.pause() };
  Module["resumeMainLoop"] = function() { Browser.mainLoop.resume() };
  Module["getUserMedia"] = function() { Browser.getUserMedia() }
STACK_BASE = STACKTOP = Runtime.alignMemory(STATICTOP);
staticSealed = true; // seal the static portion of memory
STACK_MAX = STACK_BASE + 5242880;
DYNAMIC_BASE = DYNAMICTOP = Runtime.alignMemory(STACK_MAX);
assert(DYNAMIC_BASE < TOTAL_MEMORY); // Stack must fit in TOTAL_MEMORY; allocations from here on may enlarge TOTAL_MEMORY
 var ctlz_i8 = allocate([8,7,6,6,5,5,5,5,4,4,4,4,4,4,4,4,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0], "i8", ALLOC_DYNAMIC);
 var cttz_i8 = allocate([8,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,5,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,6,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,5,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,7,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,5,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,6,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,5,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0], "i8", ALLOC_DYNAMIC);
var Math_min = Math.min;
function invoke_ii(index,a1) {
  try {
    return Module["dynCall_ii"](index,a1);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}
function invoke_v(index) {
  try {
    Module["dynCall_v"](index);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}
function invoke_iii(index,a1,a2) {
  try {
    return Module["dynCall_iii"](index,a1,a2);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}
function invoke_vi(index,a1) {
  try {
    Module["dynCall_vi"](index,a1);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    asm["setThrew"](1, 0);
  }
}
function asmPrintInt(x, y) {
  Module.print('int ' + x + ',' + y);// + ' ' + new Error().stack);
}
function asmPrintFloat(x, y) {
  Module.print('float ' + x + ',' + y);// + ' ' + new Error().stack);
}
// EMSCRIPTEN_START_ASM
var asm=(function(global,env,buffer){"use asm";var a=new global.Int8Array(buffer);var b=new global.Int16Array(buffer);var c=new global.Int32Array(buffer);var d=new global.Uint8Array(buffer);var e=new global.Uint16Array(buffer);var f=new global.Uint32Array(buffer);var g=new global.Float32Array(buffer);var h=new global.Float64Array(buffer);var i=env.STACKTOP|0;var j=env.STACK_MAX|0;var k=env.tempDoublePtr|0;var l=env.ABORT|0;var m=env.cttz_i8|0;var n=env.ctlz_i8|0;var o=+env.NaN;var p=+env.Infinity;var q=0;var r=0;var s=0;var t=0;var u=0,v=0,w=0,x=0,y=0.0,z=0,A=0,B=0,C=0.0;var D=0;var E=0;var F=0;var G=0;var H=0;var I=0;var J=0;var K=0;var L=0;var M=0;var N=global.Math.floor;var O=global.Math.abs;var P=global.Math.sqrt;var Q=global.Math.pow;var R=global.Math.cos;var S=global.Math.sin;var T=global.Math.tan;var U=global.Math.acos;var V=global.Math.asin;var W=global.Math.atan;var X=global.Math.atan2;var Y=global.Math.exp;var Z=global.Math.log;var _=global.Math.ceil;var $=global.Math.imul;var aa=env.abort;var ab=env.assert;var ac=env.asmPrintInt;var ad=env.asmPrintFloat;var ae=env.copyTempDouble;var af=env.copyTempFloat;var ag=env.min;var ah=env.invoke_ii;var ai=env.invoke_v;var aj=env.invoke_iii;var ak=env.invoke_vi;var al=env._llvm_lifetime_end;var am=env._malloc;var an=env._free;var ao=env._llvm_lifetime_start;
// EMSCRIPTEN_START_FUNCS
function at(a){a=a|0;var b=0;b=i;i=i+a|0;i=i+7>>3<<3;return b|0}function au(){return i|0}function av(a){a=a|0;i=a}function aw(a,b){a=a|0;b=b|0;if((q|0)==0){q=a;r=b}}function ax(a){a=a|0;D=a}function ay(a){a=a|0;E=a}function az(a){a=a|0;F=a}function aA(a){a=a|0;G=a}function aB(a){a=a|0;H=a}function aC(a){a=a|0;I=a}function aD(a){a=a|0;J=a}function aE(a){a=a|0;K=a}function aF(a){a=a|0;L=a}function aG(a){a=a|0;M=a}function aH(b,e,f){b=b|0;e=e|0;f=f|0;var g=0,h=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0,L=0,M=0,N=0,O=0,P=0,Q=0,R=0,S=0,T=0,U=0,V=0,W=0,X=0,Y=0,Z=0,_=0,aa=0,ab=0,ac=0,ad=0,ae=0,af=0,ag=0,ah=0,ai=0,aj=0,ak=0,al=0,am=0,an=0,ao=0,ap=0,aq=0,ar=0,as=0,at=0,au=0,av=0,aw=0,ax=0,ay=0,az=0,aA=0,aB=0,aC=0,aD=0,aE=0,aF=0,aG=0,aH=0,aN=0,aQ=0,aR=0,aS=0,aT=0,aU=0,aV=0,aW=0,aX=0,aZ=0,a_=0,a$=0,a0=0,a1=0,a2=0,a3=0,a4=0,a5=0,a6=0,a7=0,a8=0,a9=0,ba=0,bb=0,bc=0,bd=0,be=0,bf=0,bg=0,bh=0,bi=0,bj=0,bk=0,bl=0,bm=0,bn=0,bo=0,bp=0,bq=0,br=0,bs=0,bt=0,bu=0,bv=0,bw=0,bx=0,by=0,bz=0,bA=0,bB=0,bC=0,bD=0,bE=0,bF=0,bG=0,bH=0,bI=0,bJ=0,bK=0,bL=0,bM=0,bN=0,bO=0,bP=0,bQ=0,bR=0,bS=0,bT=0,bU=0,bV=0,bW=0,bX=0,bY=0,bZ=0,b_=0,b$=0,b0=0,b1=0,b2=0,b3=0,b4=0;g=i;i=i+3480|0;h=g|0;j=g+80|0;k=g+160|0;l=g+240|0;m=g+320|0;n=g+400|0;o=g+480|0;p=g+560|0;q=g+640|0;r=g+720|0;s=g+800|0;t=g+952|0;u=g+1104|0;v=g+1256|0;w=g+1560|0;x=g+1712|0;y=g+1864|0;z=g+2016|0;A=g+2168|0;B=g+2320|0;C=g+2472|0;E=g+2624|0;F=g+2776|0;G=g+2928|0;H=g+3080|0;I=g+3120|0;J=g+3200|0;K=g+3280|0;L=g+3368|0;M=g+3448|0;aL(M|0,e|0,32);e=I|0;N=d[f+1|0]|0;O=d[f+2|0]|0;P=d[f+3|0]|0;Q=0;c[e>>2]=N<<8|0>>>24|(d[f]|0)|(O<<16|0>>>16)|(P<<24|0>>>8)&50331648;c[e+4>>2]=0<<8|N>>>24|(0<<16|O>>>16)|(Q<<24|P>>>8)&0;O=d[f+4|0]|0;N=d[f+5|0]|0;R=d[f+6|0]|0;S=0;T=0<<8|O>>>24|Q|(0<<16|N>>>16)|(S<<24|R>>>8);Q=I+8|0;c[Q>>2]=((O<<8|0>>>24|P|(N<<16|0>>>16)|(R<<24|0>>>8))>>>2|T<<30)&33554431;c[Q+4>>2]=(T>>>2|0<<30)&0;T=d[f+7|0]|0;Q=d[f+8|0]|0;N=d[f+9|0]|0;P=0;O=0<<8|T>>>24|S|(0<<16|Q>>>16)|(P<<24|N>>>8);S=I+16|0;c[S>>2]=((T<<8|0>>>24|R|(Q<<16|0>>>16)|(N<<24|0>>>8))>>>3|O<<29)&67108863;c[S+4>>2]=(O>>>3|0<<29)&0;O=d[f+10|0]|0;S=d[f+11|0]|0;Q=d[f+12|0]|0;R=0;T=0<<8|O>>>24|P|(0<<16|S>>>16)|(R<<24|Q>>>8);P=I+24|0;c[P>>2]=((O<<8|0>>>24|N|(S<<16|0>>>16)|(Q<<24|0>>>8))>>>5|T<<27)&33554431;c[P+4>>2]=(T>>>5|0<<27)&0;T=d[f+13|0]|0;P=d[f+14|0]|0;S=d[f+15|0]|0;N=0<<8|T>>>24|R|(0<<16|P>>>16)|(0<<24|S>>>8);R=I+32|0;c[R>>2]=((T<<8|0>>>24|Q|(P<<16|0>>>16)|(S<<24|0>>>8))>>>6|N<<26)&67108863;c[R+4>>2]=(N>>>6|0<<26)&0;N=d[f+17|0]|0;R=d[f+18|0]|0;S=d[f+19|0]|0;P=0;Q=I+40|0;c[Q>>2]=N<<8|0>>>24|(d[f+16|0]|0)|(R<<16|0>>>16)|(S<<24|0>>>8)&16777216;c[Q+4>>2]=0<<8|N>>>24|(0<<16|R>>>16)|(P<<24|S>>>8)&0;R=d[f+20|0]|0;N=d[f+21|0]|0;Q=d[f+22|0]|0;T=0;O=0<<8|R>>>24|P|(0<<16|N>>>16)|(T<<24|Q>>>8);P=I+48|0;c[P>>2]=((R<<8|0>>>24|S|(N<<16|0>>>16)|(Q<<24|0>>>8))>>>1|O<<31)&67108863;c[P+4>>2]=(O>>>1|0<<31)&0;O=d[f+23|0]|0;P=d[f+24|0]|0;N=d[f+25|0]|0;S=0;R=0<<8|O>>>24|T|(0<<16|P>>>16)|(S<<24|N>>>8);T=I+56|0;c[T>>2]=((O<<8|0>>>24|Q|(P<<16|0>>>16)|(N<<24|0>>>8))>>>3|R<<29)&33554431;c[T+4>>2]=(R>>>3|0<<29)&0;R=d[f+26|0]|0;T=d[f+27|0]|0;P=d[f+28|0]|0;Q=0;O=0<<8|R>>>24|S|(0<<16|T>>>16)|(Q<<24|P>>>8);S=I+64|0;c[S>>2]=((R<<8|0>>>24|N|(T<<16|0>>>16)|(P<<24|0>>>8))>>>4|O<<28)&67108863;c[S+4>>2]=(O>>>4|0<<28)&0;O=d[f+29|0]|0;S=d[f+30|0]|0;T=d[f+31|0]|0;f=0<<8|O>>>24|Q|(0<<16|S>>>16)|(0<<24|T>>>8);Q=I+72|0;c[Q>>2]=((O<<8|0>>>24|P|(S<<16|0>>>16)|(T<<24|0>>>8))>>>6|f<<26)&33554431;c[Q+4>>2]=(f>>>6|0<<26)&0;f=J|0;Q=x;aM(Q|0,0,152);aM(y|0,0,152);T=y|0;c[T>>2]=1;c[T+4>>2]=0;aM(z|0,0,152);y=z|0;c[y>>2]=1;c[y+4>>2]=0;aM(A|0,0,152);aM(B|0,0,152);aM(C|0,0,152);z=C|0;c[z>>2]=1;c[z+4>>2]=0;aM(E|0,0,152);aM(F|0,0,152);C=F|0;c[C>>2]=1;c[C+4>>2]=0;aL(Q|0,I|0,80);I=G;Q=v;F=w;S=u|0;P=v|0;O=u+144|0;N=u+64|0;R=u+136|0;U=u+56|0;V=u+128|0;W=u+48|0;X=u+120|0;Y=u+40|0;Z=u+112|0;_=u+32|0;aa=u+104|0;ab=u+24|0;ac=u+96|0;ad=u+16|0;ae=u+88|0;af=u+8|0;ag=u+80|0;ah=v+144|0;ai=v+64|0;aj=v+136|0;ak=v+56|0;al=v+128|0;am=v+48|0;an=v+120|0;ao=v+40|0;ap=v+112|0;aq=v+32|0;ar=v+104|0;as=v+24|0;at=v+96|0;au=v+16|0;av=v+88|0;aw=v+8|0;ax=v+80|0;ay=u+72|0;u=v+72|0;v=w|0;w=g+1408|0;az=s|0;aA=t|0;aB=s+8|0;aC=t+8|0;aD=s+16|0;aE=t+16|0;aF=s+24|0;aG=t+24|0;aH=s+32|0;aN=t+32|0;aQ=s+40|0;aR=t+40|0;aS=s+48|0;aT=t+48|0;aU=s+56|0;aV=t+56|0;aW=s+64|0;aX=t+64|0;aZ=s+72|0;s=t+72|0;t=G|0;a_=G+80|0;a$=a_;a0=G+8|0;a1=G+16|0;a2=G+24|0;a3=G+32|0;a4=G+40|0;a5=G+48|0;a6=G+56|0;a7=G+64|0;a8=G+72|0;a9=y;y=A|0;A=T;T=B|0;B=z;z=E|0;E=C;C=0;ba=x|0;while(1){x=a9;bb=y;bc=A;bd=T;be=B;bf=z;bg=E;bh=0;bi=a[M+(31-C|0)|0]|0;bj=ba;while(1){bk=aP(0,0,(bi&255)>>>7,0)|0;bl=0;while(1){bm=x+(bl<<3)|0;bn=c[bm>>2]|0;bo=bj+(bl<<3)|0;bp=(c[bo>>2]^bn)&bk;bq=bp^bn;c[bm>>2]=bq;c[bm+4>>2]=(bq|0)<0?-1:0;bq=bp^c[bo>>2];c[bo>>2]=bq;c[bo+4>>2]=(bq|0)<0?-1:0;bq=bl+1|0;if(bq>>>0<10){bl=bq}else{br=0;break}}do{bl=bb+(br<<3)|0;bq=c[bl>>2]|0;bo=bc+(br<<3)|0;bp=(c[bo>>2]^bq)&bk;bm=bp^bq;c[bl>>2]=bm;c[bl+4>>2]=(bm|0)<0?-1:0;bm=bp^c[bo>>2];c[bo>>2]=bm;c[bo+4>>2]=(bm|0)<0?-1:0;br=br+1|0;}while(br>>>0<10);bm=c[x>>2]|0;bo=c[x+4>>2]|0;bp=x+8|0;bl=c[bp>>2]|0;bq=c[bp+4>>2]|0;bn=x+16|0;bs=c[bn>>2]|0;bt=c[bn+4>>2]|0;bu=x+24|0;bv=c[bu>>2]|0;bw=c[bu+4>>2]|0;bx=x+32|0;by=c[bx>>2]|0;bz=c[bx+4>>2]|0;bA=x+40|0;bB=c[bA>>2]|0;bC=c[bA+4>>2]|0;bD=x+48|0;bE=c[bD>>2]|0;bF=c[bD+4>>2]|0;bG=x+56|0;bH=c[bG>>2]|0;bI=c[bG+4>>2]|0;bJ=x+64|0;bK=c[bJ>>2]|0;bL=c[bJ+4>>2]|0;bM=x+72|0;bN=c[bM>>2]|0;bO=c[bM+4>>2]|0;bP=aO(c[bb>>2]|0,c[bb+4>>2]|0,bm,bo)|0;c[x>>2]=bP;c[x+4>>2]=D;bP=bb+8|0;bQ=aO(c[bP>>2]|0,c[bP+4>>2]|0,bl,bq)|0;c[bp>>2]=bQ;c[bp+4>>2]=D;bp=bb+16|0;bQ=aO(c[bp>>2]|0,c[bp+4>>2]|0,bs,bt)|0;c[bn>>2]=bQ;c[bn+4>>2]=D;bn=bb+24|0;bQ=aO(c[bn>>2]|0,c[bn+4>>2]|0,bv,bw)|0;c[bu>>2]=bQ;c[bu+4>>2]=D;bu=bb+32|0;bQ=aO(c[bu>>2]|0,c[bu+4>>2]|0,by,bz)|0;c[bx>>2]=bQ;c[bx+4>>2]=D;bx=bb+40|0;bQ=aO(c[bx>>2]|0,c[bx+4>>2]|0,bB,bC)|0;c[bA>>2]=bQ;c[bA+4>>2]=D;bA=bb+48|0;bQ=aO(c[bA>>2]|0,c[bA+4>>2]|0,bE,bF)|0;c[bD>>2]=bQ;c[bD+4>>2]=D;bD=bb+56|0;bQ=aO(c[bD>>2]|0,c[bD+4>>2]|0,bH,bI)|0;c[bG>>2]=bQ;c[bG+4>>2]=D;bG=bb+64|0;bQ=aO(c[bG>>2]|0,c[bG+4>>2]|0,bK,bL)|0;c[bJ>>2]=bQ;c[bJ+4>>2]=D;bJ=bb+72|0;bQ=aO(c[bJ>>2]|0,c[bJ+4>>2]|0,bN,bO)|0;c[bM>>2]=bQ;c[bM+4>>2]=D;bM=aP(bm,bo,c[bb>>2]|0,c[bb+4>>2]|0)|0;c[bb>>2]=bM;c[bb+4>>2]=D;bM=aP(bl,bq,c[bP>>2]|0,c[bP+4>>2]|0)|0;c[bP>>2]=bM;c[bP+4>>2]=D;bP=aP(bs,bt,c[bp>>2]|0,c[bp+4>>2]|0)|0;c[bp>>2]=bP;c[bp+4>>2]=D;bp=aP(bv,bw,c[bn>>2]|0,c[bn+4>>2]|0)|0;c[bn>>2]=bp;c[bn+4>>2]=D;bn=aP(by,bz,c[bu>>2]|0,c[bu+4>>2]|0)|0;c[bu>>2]=bn;c[bu+4>>2]=D;bu=aP(bB,bC,c[bx>>2]|0,c[bx+4>>2]|0)|0;c[bx>>2]=bu;c[bx+4>>2]=D;bx=aP(bE,bF,c[bA>>2]|0,c[bA+4>>2]|0)|0;c[bA>>2]=bx;c[bA+4>>2]=D;bA=aP(bH,bI,c[bD>>2]|0,c[bD+4>>2]|0)|0;c[bD>>2]=bA;c[bD+4>>2]=D;bD=aP(bK,bL,c[bG>>2]|0,c[bG+4>>2]|0)|0;c[bG>>2]=bD;c[bG+4>>2]=D;bG=aP(bN,bO,c[bJ>>2]|0,c[bJ+4>>2]|0)|0;c[bJ>>2]=bG;c[bJ+4>>2]=D;bJ=c[bj>>2]|0;bG=c[bj+4>>2]|0;bO=bj+8|0;bN=c[bO>>2]|0;bD=c[bO+4>>2]|0;bL=bj+16|0;bK=c[bL>>2]|0;bA=c[bL+4>>2]|0;bI=bj+24|0;bH=c[bI>>2]|0;bx=c[bI+4>>2]|0;bF=bj+32|0;bE=c[bF>>2]|0;bu=c[bF+4>>2]|0;bC=bj+40|0;bB=c[bC>>2]|0;bn=c[bC+4>>2]|0;bz=bj+48|0;by=c[bz>>2]|0;bp=c[bz+4>>2]|0;bw=bj+56|0;bv=c[bw>>2]|0;bP=c[bw+4>>2]|0;bt=bj+64|0;bs=c[bt>>2]|0;bM=c[bt+4>>2]|0;bq=bj+72|0;bl=c[bq>>2]|0;bo=c[bq+4>>2]|0;bm=aO(c[bc>>2]|0,c[bc+4>>2]|0,bJ,bG)|0;c[bj>>2]=bm;c[bj+4>>2]=D;bm=bc+8|0;bQ=aO(c[bm>>2]|0,c[bm+4>>2]|0,bN,bD)|0;c[bO>>2]=bQ;c[bO+4>>2]=D;bO=bc+16|0;bQ=aO(c[bO>>2]|0,c[bO+4>>2]|0,bK,bA)|0;c[bL>>2]=bQ;c[bL+4>>2]=D;bL=bc+24|0;bQ=aO(c[bL>>2]|0,c[bL+4>>2]|0,bH,bx)|0;c[bI>>2]=bQ;c[bI+4>>2]=D;bI=bc+32|0;bQ=aO(c[bI>>2]|0,c[bI+4>>2]|0,bE,bu)|0;c[bF>>2]=bQ;c[bF+4>>2]=D;bF=bc+40|0;bQ=aO(c[bF>>2]|0,c[bF+4>>2]|0,bB,bn)|0;c[bC>>2]=bQ;c[bC+4>>2]=D;bC=bc+48|0;bQ=aO(c[bC>>2]|0,c[bC+4>>2]|0,by,bp)|0;c[bz>>2]=bQ;c[bz+4>>2]=D;bz=bc+56|0;bQ=aO(c[bz>>2]|0,c[bz+4>>2]|0,bv,bP)|0;c[bw>>2]=bQ;c[bw+4>>2]=D;bw=bc+64|0;bQ=aO(c[bw>>2]|0,c[bw+4>>2]|0,bs,bM)|0;c[bt>>2]=bQ;c[bt+4>>2]=D;bt=bc+72|0;bQ=aO(c[bt>>2]|0,c[bt+4>>2]|0,bl,bo)|0;c[bq>>2]=bQ;c[bq+4>>2]=D;bq=aP(bJ,bG,c[bc>>2]|0,c[bc+4>>2]|0)|0;c[bc>>2]=bq;c[bc+4>>2]=D;bq=aP(bN,bD,c[bm>>2]|0,c[bm+4>>2]|0)|0;c[bm>>2]=bq;c[bm+4>>2]=D;bm=aP(bK,bA,c[bO>>2]|0,c[bO+4>>2]|0)|0;c[bO>>2]=bm;c[bO+4>>2]=D;bO=aP(bH,bx,c[bL>>2]|0,c[bL+4>>2]|0)|0;c[bL>>2]=bO;c[bL+4>>2]=D;bL=aP(bE,bu,c[bI>>2]|0,c[bI+4>>2]|0)|0;c[bI>>2]=bL;c[bI+4>>2]=D;bI=aP(bB,bn,c[bF>>2]|0,c[bF+4>>2]|0)|0;c[bF>>2]=bI;c[bF+4>>2]=D;bF=aP(by,bp,c[bC>>2]|0,c[bC+4>>2]|0)|0;c[bC>>2]=bF;c[bC+4>>2]=D;bC=aP(bv,bP,c[bz>>2]|0,c[bz+4>>2]|0)|0;c[bz>>2]=bC;c[bz+4>>2]=D;bz=aP(bs,bM,c[bw>>2]|0,c[bw+4>>2]|0)|0;c[bw>>2]=bz;c[bw+4>>2]=D;bw=aP(bl,bo,c[bt>>2]|0,c[bt+4>>2]|0)|0;c[bt>>2]=bw;c[bt+4>>2]=D;aI(S,bj,bb);aI(P,x,bc);bt=c[O>>2]|0;bw=c[O+4>>2]|0;bo=c[N>>2]|0;bl=c[N+4>>2]|0;bz=aY(bt,bw,18,0)|0;bM=D;bs=aO(bo,bl,bt,bw)|0;bw=aO(bs,D,bz,bM)|0;c[N>>2]=bw;c[N+4>>2]=D;bw=c[R>>2]|0;bM=c[R+4>>2]|0;bz=c[U>>2]|0;bs=c[U+4>>2]|0;bt=aY(bw,bM,18,0)|0;bl=D;bo=aO(bz,bs,bw,bM)|0;bM=aO(bo,D,bt,bl)|0;c[U>>2]=bM;c[U+4>>2]=D;bM=c[V>>2]|0;bl=c[V+4>>2]|0;bt=c[W>>2]|0;bo=c[W+4>>2]|0;bw=aY(bM,bl,18,0)|0;bs=D;bz=aO(bt,bo,bM,bl)|0;bl=aO(bz,D,bw,bs)|0;c[W>>2]=bl;c[W+4>>2]=D;bl=c[X>>2]|0;bs=c[X+4>>2]|0;bw=c[Y>>2]|0;bz=c[Y+4>>2]|0;bM=aY(bl,bs,18,0)|0;bo=D;bt=aO(bw,bz,bl,bs)|0;bs=aO(bt,D,bM,bo)|0;c[Y>>2]=bs;c[Y+4>>2]=D;bs=c[Z>>2]|0;bo=c[Z+4>>2]|0;bM=c[_>>2]|0;bt=c[_+4>>2]|0;bl=aY(bs,bo,18,0)|0;bz=D;bw=aO(bM,bt,bs,bo)|0;bo=aO(bw,D,bl,bz)|0;c[_>>2]=bo;c[_+4>>2]=D;bo=c[aa>>2]|0;bz=c[aa+4>>2]|0;bl=c[ab>>2]|0;bw=c[ab+4>>2]|0;bs=aY(bo,bz,18,0)|0;bt=D;bM=aO(bl,bw,bo,bz)|0;bz=aO(bM,D,bs,bt)|0;c[ab>>2]=bz;c[ab+4>>2]=D;bz=c[ac>>2]|0;bt=c[ac+4>>2]|0;bs=c[ad>>2]|0;bM=c[ad+4>>2]|0;bo=aY(bz,bt,18,0)|0;bw=D;bl=aO(bs,bM,bz,bt)|0;bt=aO(bl,D,bo,bw)|0;c[ad>>2]=bt;c[ad+4>>2]=D;bt=c[ae>>2]|0;bw=c[ae+4>>2]|0;bo=c[af>>2]|0;bl=c[af+4>>2]|0;bz=aY(bt,bw,18,0)|0;bM=D;bs=aO(bo,bl,bt,bw)|0;bw=aO(bs,D,bz,bM)|0;c[af>>2]=bw;c[af+4>>2]=D;bw=c[ag>>2]|0;bM=c[ag+4>>2]|0;bz=c[S>>2]|0;bs=c[S+4>>2]|0;bt=aY(bw,bM,18,0)|0;bl=D;bo=aO(bz,bs,bw,bM)|0;bM=aO(bo,D,bt,bl)|0;c[S>>2]=bM;c[S+4>>2]=D;aJ(S);bM=c[ah>>2]|0;bl=c[ah+4>>2]|0;bt=c[ai>>2]|0;bo=c[ai+4>>2]|0;bw=aY(bM,bl,18,0)|0;bs=D;bz=aO(bt,bo,bM,bl)|0;bl=aO(bz,D,bw,bs)|0;c[ai>>2]=bl;c[ai+4>>2]=D;bl=c[aj>>2]|0;bs=c[aj+4>>2]|0;bw=c[ak>>2]|0;bz=c[ak+4>>2]|0;bM=aY(bl,bs,18,0)|0;bo=D;bt=aO(bw,bz,bl,bs)|0;bs=aO(bt,D,bM,bo)|0;c[ak>>2]=bs;c[ak+4>>2]=D;bs=c[al>>2]|0;bo=c[al+4>>2]|0;bM=c[am>>2]|0;bt=c[am+4>>2]|0;bl=aY(bs,bo,18,0)|0;bz=D;bw=aO(bM,bt,bs,bo)|0;bo=aO(bw,D,bl,bz)|0;c[am>>2]=bo;c[am+4>>2]=D;bo=c[an>>2]|0;bz=c[an+4>>2]|0;bl=c[ao>>2]|0;bw=c[ao+4>>2]|0;bs=aY(bo,bz,18,0)|0;bt=D;bM=aO(bl,bw,bo,bz)|0;bz=aO(bM,D,bs,bt)|0;c[ao>>2]=bz;c[ao+4>>2]=D;bz=c[ap>>2]|0;bt=c[ap+4>>2]|0;bs=c[aq>>2]|0;bM=c[aq+4>>2]|0;bo=aY(bz,bt,18,0)|0;bw=D;bl=aO(bs,bM,bz,bt)|0;bt=aO(bl,D,bo,bw)|0;c[aq>>2]=bt;c[aq+4>>2]=D;bt=c[ar>>2]|0;bw=c[ar+4>>2]|0;bo=c[as>>2]|0;bl=c[as+4>>2]|0;bz=aY(bt,bw,18,0)|0;bM=D;bs=aO(bo,bl,bt,bw)|0;bw=aO(bs,D,bz,bM)|0;c[as>>2]=bw;c[as+4>>2]=D;bw=c[at>>2]|0;bM=c[at+4>>2]|0;bz=c[au>>2]|0;bs=c[au+4>>2]|0;bt=aY(bw,bM,18,0)|0;bl=D;bo=aO(bz,bs,bw,bM)|0;bM=aO(bo,D,bt,bl)|0;c[au>>2]=bM;c[au+4>>2]=D;bM=c[av>>2]|0;bl=c[av+4>>2]|0;bt=c[aw>>2]|0;bo=c[aw+4>>2]|0;bw=aY(bM,bl,18,0)|0;bs=D;bz=aO(bt,bo,bM,bl)|0;bl=aO(bz,D,bw,bs)|0;c[aw>>2]=bl;c[aw+4>>2]=D;bl=c[ax>>2]|0;bs=c[ax+4>>2]|0;bw=c[P>>2]|0;bz=c[P+4>>2]|0;bM=aY(bl,bs,18,0)|0;bo=D;bt=aO(bw,bz,bl,bs)|0;bs=aO(bt,D,bM,bo)|0;c[P>>2]=bs;c[P+4>>2]=D;aJ(P);bs=c[S>>2]|0;bo=c[S+4>>2]|0;bM=c[af>>2]|0;bt=c[af+4>>2]|0;bl=c[ad>>2]|0;bz=c[ad+4>>2]|0;bw=c[ab>>2]|0;bC=c[ab+4>>2]|0;bP=c[_>>2]|0;bv=c[_+4>>2]|0;bF=c[Y>>2]|0;bp=c[Y+4>>2]|0;by=c[W>>2]|0;bI=c[W+4>>2]|0;bn=c[U>>2]|0;bB=c[U+4>>2]|0;bL=c[N>>2]|0;bu=c[N+4>>2]|0;bE=c[ay>>2]|0;bO=c[ay+4>>2]|0;bx=c[P>>2]|0;bH=c[P+4>>2]|0;bm=aO(bx,bH,bs,bo)|0;c[S>>2]=bm;c[S+4>>2]=D;bm=c[aw>>2]|0;bA=c[aw+4>>2]|0;bK=aO(bm,bA,bM,bt)|0;c[af>>2]=bK;c[af+4>>2]=D;bK=c[au>>2]|0;bq=c[au+4>>2]|0;bD=aO(bK,bq,bl,bz)|0;c[ad>>2]=bD;c[ad+4>>2]=D;bD=c[as>>2]|0;bN=c[as+4>>2]|0;bG=aO(bD,bN,bw,bC)|0;c[ab>>2]=bG;c[ab+4>>2]=D;bG=c[aq>>2]|0;bJ=c[aq+4>>2]|0;bQ=aO(bG,bJ,bP,bv)|0;c[_>>2]=bQ;c[_+4>>2]=D;bQ=c[ao>>2]|0;bR=c[ao+4>>2]|0;bS=aO(bQ,bR,bF,bp)|0;c[Y>>2]=bS;c[Y+4>>2]=D;bS=c[am>>2]|0;bT=c[am+4>>2]|0;bU=aO(bS,bT,by,bI)|0;c[W>>2]=bU;c[W+4>>2]=D;bU=c[ak>>2]|0;bV=c[ak+4>>2]|0;bW=aO(bU,bV,bn,bB)|0;c[U>>2]=bW;c[U+4>>2]=D;bW=c[ai>>2]|0;bX=c[ai+4>>2]|0;bY=aO(bW,bX,bL,bu)|0;c[N>>2]=bY;c[N+4>>2]=D;bY=c[u>>2]|0;bZ=c[u+4>>2]|0;b_=aO(bY,bZ,bE,bO)|0;c[ay>>2]=b_;c[ay+4>>2]=D;b_=aP(bs,bo,bx,bH)|0;c[P>>2]=b_;c[P+4>>2]=D;b_=aP(bM,bt,bm,bA)|0;c[aw>>2]=b_;c[aw+4>>2]=D;b_=aP(bl,bz,bK,bq)|0;c[au>>2]=b_;c[au+4>>2]=D;b_=aP(bw,bC,bD,bN)|0;c[as>>2]=b_;c[as+4>>2]=D;b_=aP(bP,bv,bG,bJ)|0;c[aq>>2]=b_;c[aq+4>>2]=D;b_=aP(bF,bp,bQ,bR)|0;c[ao>>2]=b_;c[ao+4>>2]=D;b_=aP(by,bI,bS,bT)|0;c[am>>2]=b_;c[am+4>>2]=D;b_=aP(bn,bB,bU,bV)|0;c[ak>>2]=b_;c[ak+4>>2]=D;b_=aP(bL,bu,bW,bX)|0;c[ai>>2]=b_;c[ai+4>>2]=D;b_=aP(bE,bO,bY,bZ)|0;c[u>>2]=b_;c[u+4>>2]=D;aK(v,S);aK(w,P);aI(P,w,e);b_=c[ah>>2]|0;bZ=c[ah+4>>2]|0;bY=c[ai>>2]|0;bO=c[ai+4>>2]|0;bE=aY(b_,bZ,18,0)|0;bX=D;bW=aO(bY,bO,b_,bZ)|0;bZ=aO(bW,D,bE,bX)|0;c[ai>>2]=bZ;c[ai+4>>2]=D;bZ=c[aj>>2]|0;bX=c[aj+4>>2]|0;bE=c[ak>>2]|0;bW=c[ak+4>>2]|0;b_=aY(bZ,bX,18,0)|0;bO=D;bY=aO(bE,bW,bZ,bX)|0;bX=aO(bY,D,b_,bO)|0;c[ak>>2]=bX;c[ak+4>>2]=D;bX=c[al>>2]|0;bO=c[al+4>>2]|0;b_=c[am>>2]|0;bY=c[am+4>>2]|0;bZ=aY(bX,bO,18,0)|0;bW=D;bE=aO(b_,bY,bX,bO)|0;bO=aO(bE,D,bZ,bW)|0;c[am>>2]=bO;c[am+4>>2]=D;bO=c[an>>2]|0;bW=c[an+4>>2]|0;bZ=c[ao>>2]|0;bE=c[ao+4>>2]|0;bX=aY(bO,bW,18,0)|0;bY=D;b_=aO(bZ,bE,bO,bW)|0;bW=aO(b_,D,bX,bY)|0;c[ao>>2]=bW;c[ao+4>>2]=D;bW=c[ap>>2]|0;bY=c[ap+4>>2]|0;bX=c[aq>>2]|0;b_=c[aq+4>>2]|0;bO=aY(bW,bY,18,0)|0;bE=D;bZ=aO(bX,b_,bW,bY)|0;bY=aO(bZ,D,bO,bE)|0;c[aq>>2]=bY;c[aq+4>>2]=D;bY=c[ar>>2]|0;bE=c[ar+4>>2]|0;bO=c[as>>2]|0;bZ=c[as+4>>2]|0;bW=aY(bY,bE,18,0)|0;b_=D;bX=aO(bO,bZ,bY,bE)|0;bE=aO(bX,D,bW,b_)|0;c[as>>2]=bE;c[as+4>>2]=D;bE=c[at>>2]|0;b_=c[at+4>>2]|0;bW=c[au>>2]|0;bX=c[au+4>>2]|0;bY=aY(bE,b_,18,0)|0;bZ=D;bO=aO(bW,bX,bE,b_)|0;b_=aO(bO,D,bY,bZ)|0;c[au>>2]=b_;c[au+4>>2]=D;b_=c[av>>2]|0;bZ=c[av+4>>2]|0;bY=c[aw>>2]|0;bO=c[aw+4>>2]|0;bE=aY(b_,bZ,18,0)|0;bX=D;bW=aO(bY,bO,b_,bZ)|0;bZ=aO(bW,D,bE,bX)|0;c[aw>>2]=bZ;c[aw+4>>2]=D;bZ=c[ax>>2]|0;bX=c[ax+4>>2]|0;bE=c[P>>2]|0;bW=c[P+4>>2]|0;b_=aY(bZ,bX,18,0)|0;bO=D;bY=aO(bE,bW,bZ,bX)|0;bX=aO(bY,D,b_,bO)|0;c[P>>2]=bX;c[P+4>>2]=D;aJ(P);aL(bd|0,F|0,80);aL(be|0,Q|0,80);aK(az,x);aK(aA,bb);aI(bf,az,aA);bX=bf+144|0;bO=c[bX>>2]|0;b_=c[bX+4>>2]|0;bX=bf+64|0;bY=c[bX>>2]|0;bZ=c[bX+4>>2]|0;bW=aY(bO,b_,18,0)|0;bE=D;bu=aO(bY,bZ,bO,b_)|0;b_=aO(bu,D,bW,bE)|0;c[bX>>2]=b_;c[bX+4>>2]=D;bX=bf+136|0;b_=c[bX>>2]|0;bE=c[bX+4>>2]|0;bX=bf+56|0;bW=c[bX>>2]|0;bu=c[bX+4>>2]|0;bO=aY(b_,bE,18,0)|0;bZ=D;bY=aO(bW,bu,b_,bE)|0;bE=aO(bY,D,bO,bZ)|0;c[bX>>2]=bE;c[bX+4>>2]=D;bX=bf+128|0;bE=c[bX>>2]|0;bZ=c[bX+4>>2]|0;bX=bf+48|0;bO=c[bX>>2]|0;bY=c[bX+4>>2]|0;b_=aY(bE,bZ,18,0)|0;bu=D;bW=aO(bO,bY,bE,bZ)|0;bZ=aO(bW,D,b_,bu)|0;c[bX>>2]=bZ;c[bX+4>>2]=D;bX=bf+120|0;bZ=c[bX>>2]|0;bu=c[bX+4>>2]|0;bX=bf+40|0;b_=c[bX>>2]|0;bW=c[bX+4>>2]|0;bE=aY(bZ,bu,18,0)|0;bY=D;bO=aO(b_,bW,bZ,bu)|0;bu=aO(bO,D,bE,bY)|0;c[bX>>2]=bu;c[bX+4>>2]=D;bX=bf+112|0;bu=c[bX>>2]|0;bY=c[bX+4>>2]|0;bX=bf+32|0;bE=c[bX>>2]|0;bO=c[bX+4>>2]|0;bZ=aY(bu,bY,18,0)|0;bW=D;b_=aO(bE,bO,bu,bY)|0;bY=aO(b_,D,bZ,bW)|0;c[bX>>2]=bY;c[bX+4>>2]=D;bX=bf+104|0;bY=c[bX>>2]|0;bW=c[bX+4>>2]|0;bX=bf+24|0;bZ=c[bX>>2]|0;b_=c[bX+4>>2]|0;bu=aY(bY,bW,18,0)|0;bO=D;bE=aO(bZ,b_,bY,bW)|0;bW=aO(bE,D,bu,bO)|0;c[bX>>2]=bW;c[bX+4>>2]=D;bX=bf+96|0;bW=c[bX>>2]|0;bO=c[bX+4>>2]|0;bX=bf+16|0;bu=c[bX>>2]|0;bE=c[bX+4>>2]|0;bY=aY(bW,bO,18,0)|0;b_=D;bZ=aO(bu,bE,bW,bO)|0;bO=aO(bZ,D,bY,b_)|0;c[bX>>2]=bO;c[bX+4>>2]=D;bX=bf+88|0;bO=c[bX>>2]|0;b_=c[bX+4>>2]|0;bX=bf+8|0;bY=c[bX>>2]|0;bZ=c[bX+4>>2]|0;bW=aY(bO,b_,18,0)|0;bE=D;bu=aO(bY,bZ,bO,b_)|0;b_=aO(bu,D,bW,bE)|0;c[bX>>2]=b_;c[bX+4>>2]=D;bX=bf+80|0;b_=c[bX>>2]|0;bE=c[bX+4>>2]|0;bX=c[bf>>2]|0;bW=c[bf+4>>2]|0;bu=aY(b_,bE,18,0)|0;bO=D;bZ=aO(bX,bW,b_,bE)|0;bE=aO(bZ,D,bu,bO)|0;c[bf>>2]=bE;c[bf+4>>2]=D;aJ(bf);bE=c[az>>2]|0;bO=c[az+4>>2]|0;bu=aP(bE,bO,c[aA>>2]|0,c[aA+4>>2]|0)|0;bZ=D;c[aA>>2]=bu;c[aA+4>>2]=bZ;b_=c[aB>>2]|0;bW=c[aB+4>>2]|0;bX=aP(b_,bW,c[aC>>2]|0,c[aC+4>>2]|0)|0;bY=D;c[aC>>2]=bX;c[aC+4>>2]=bY;bL=c[aD>>2]|0;bV=c[aD+4>>2]|0;bU=aP(bL,bV,c[aE>>2]|0,c[aE+4>>2]|0)|0;bB=D;c[aE>>2]=bU;c[aE+4>>2]=bB;bn=c[aF>>2]|0;bT=c[aF+4>>2]|0;bS=aP(bn,bT,c[aG>>2]|0,c[aG+4>>2]|0)|0;bI=D;c[aG>>2]=bS;c[aG+4>>2]=bI;by=c[aH>>2]|0;bR=c[aH+4>>2]|0;bQ=aP(by,bR,c[aN>>2]|0,c[aN+4>>2]|0)|0;bp=D;c[aN>>2]=bQ;c[aN+4>>2]=bp;bF=c[aQ>>2]|0;bJ=c[aQ+4>>2]|0;bG=aP(bF,bJ,c[aR>>2]|0,c[aR+4>>2]|0)|0;bv=D;c[aR>>2]=bG;c[aR+4>>2]=bv;bP=c[aS>>2]|0;bN=c[aS+4>>2]|0;bD=aP(bP,bN,c[aT>>2]|0,c[aT+4>>2]|0)|0;bC=D;c[aT>>2]=bD;c[aT+4>>2]=bC;bw=c[aU>>2]|0;bq=c[aU+4>>2]|0;bK=aP(bw,bq,c[aV>>2]|0,c[aV+4>>2]|0)|0;bz=D;c[aV>>2]=bK;c[aV+4>>2]=bz;bl=c[aW>>2]|0;bA=c[aW+4>>2]|0;bm=aP(bl,bA,c[aX>>2]|0,c[aX+4>>2]|0)|0;bt=D;c[aX>>2]=bm;c[aX+4>>2]=bt;bM=c[aZ>>2]|0;bH=c[aZ+4>>2]|0;bx=aP(bM,bH,c[s>>2]|0,c[s+4>>2]|0)|0;bo=D;c[s>>2]=bx;c[s+4>>2]=bo;aM(a$|0,0,72);bs=aY(bu,bZ,121665,0)|0;c[t>>2]=bs;c[t+4>>2]=D;bs=aY(bX,bY,121665,0)|0;c[a0>>2]=bs;c[a0+4>>2]=D;bs=aY(bU,bB,121665,0)|0;c[a1>>2]=bs;c[a1+4>>2]=D;bs=aY(bS,bI,121665,0)|0;c[a2>>2]=bs;c[a2+4>>2]=D;bs=aY(bQ,bp,121665,0)|0;c[a3>>2]=bs;c[a3+4>>2]=D;bs=aY(bG,bv,121665,0)|0;c[a4>>2]=bs;c[a4+4>>2]=D;bs=aY(bD,bC,121665,0)|0;c[a5>>2]=bs;c[a5+4>>2]=D;bs=aY(bK,bz,121665,0)|0;c[a6>>2]=bs;c[a6+4>>2]=D;bs=aY(bm,bt,121665,0)|0;c[a7>>2]=bs;c[a7+4>>2]=D;bs=aY(bx,bo,121665,0)|0;c[a8>>2]=bs;c[a8+4>>2]=D;aJ(t);bs=aO(c[t>>2]|0,c[t+4>>2]|0,bE,bO)|0;c[t>>2]=bs;c[t+4>>2]=D;bs=aO(c[a0>>2]|0,c[a0+4>>2]|0,b_,bW)|0;c[a0>>2]=bs;c[a0+4>>2]=D;bs=aO(c[a1>>2]|0,c[a1+4>>2]|0,bL,bV)|0;c[a1>>2]=bs;c[a1+4>>2]=D;bs=aO(c[a2>>2]|0,c[a2+4>>2]|0,bn,bT)|0;c[a2>>2]=bs;c[a2+4>>2]=D;bs=aO(c[a3>>2]|0,c[a3+4>>2]|0,by,bR)|0;c[a3>>2]=bs;c[a3+4>>2]=D;bs=aO(c[a4>>2]|0,c[a4+4>>2]|0,bF,bJ)|0;c[a4>>2]=bs;c[a4+4>>2]=D;bs=aO(c[a5>>2]|0,c[a5+4>>2]|0,bP,bN)|0;c[a5>>2]=bs;c[a5+4>>2]=D;bs=aO(c[a6>>2]|0,c[a6+4>>2]|0,bw,bq)|0;c[a6>>2]=bs;c[a6+4>>2]=D;bs=aO(c[a7>>2]|0,c[a7+4>>2]|0,bl,bA)|0;c[a7>>2]=bs;c[a7+4>>2]=D;bs=aO(c[a8>>2]|0,c[a8+4>>2]|0,bM,bH)|0;c[a8>>2]=bs;c[a8+4>>2]=D;aI(bg,aA,t);bs=bg+144|0;bH=c[bs>>2]|0;bM=c[bs+4>>2]|0;bs=bg+64|0;bA=c[bs>>2]|0;bl=c[bs+4>>2]|0;bq=aY(bH,bM,18,0)|0;bw=D;bN=aO(bA,bl,bH,bM)|0;bM=aO(bN,D,bq,bw)|0;c[bs>>2]=bM;c[bs+4>>2]=D;bs=bg+136|0;bM=c[bs>>2]|0;bw=c[bs+4>>2]|0;bs=bg+56|0;bq=c[bs>>2]|0;bN=c[bs+4>>2]|0;bH=aY(bM,bw,18,0)|0;bl=D;bA=aO(bq,bN,bM,bw)|0;bw=aO(bA,D,bH,bl)|0;c[bs>>2]=bw;c[bs+4>>2]=D;bs=bg+128|0;bw=c[bs>>2]|0;bl=c[bs+4>>2]|0;bs=bg+48|0;bH=c[bs>>2]|0;bA=c[bs+4>>2]|0;bM=aY(bw,bl,18,0)|0;bN=D;bq=aO(bH,bA,bw,bl)|0;bl=aO(bq,D,bM,bN)|0;c[bs>>2]=bl;c[bs+4>>2]=D;bs=bg+120|0;bl=c[bs>>2]|0;bN=c[bs+4>>2]|0;bs=bg+40|0;bM=c[bs>>2]|0;bq=c[bs+4>>2]|0;bw=aY(bl,bN,18,0)|0;bA=D;bH=aO(bM,bq,bl,bN)|0;bN=aO(bH,D,bw,bA)|0;c[bs>>2]=bN;c[bs+4>>2]=D;bs=bg+112|0;bN=c[bs>>2]|0;bA=c[bs+4>>2]|0;bs=bg+32|0;bw=c[bs>>2]|0;bH=c[bs+4>>2]|0;bl=aY(bN,bA,18,0)|0;bq=D;bM=aO(bw,bH,bN,bA)|0;bA=aO(bM,D,bl,bq)|0;c[bs>>2]=bA;c[bs+4>>2]=D;bs=bg+104|0;bA=c[bs>>2]|0;bq=c[bs+4>>2]|0;bs=bg+24|0;bl=c[bs>>2]|0;bM=c[bs+4>>2]|0;bN=aY(bA,bq,18,0)|0;bH=D;bw=aO(bl,bM,bA,bq)|0;bq=aO(bw,D,bN,bH)|0;c[bs>>2]=bq;c[bs+4>>2]=D;bs=bg+96|0;bq=c[bs>>2]|0;bH=c[bs+4>>2]|0;bs=bg+16|0;bN=c[bs>>2]|0;bw=c[bs+4>>2]|0;bA=aY(bq,bH,18,0)|0;bM=D;bl=aO(bN,bw,bq,bH)|0;bH=aO(bl,D,bA,bM)|0;c[bs>>2]=bH;c[bs+4>>2]=D;bs=bg+88|0;bH=c[bs>>2]|0;bM=c[bs+4>>2]|0;bs=bg+8|0;bA=c[bs>>2]|0;bl=c[bs+4>>2]|0;bq=aY(bH,bM,18,0)|0;bw=D;bN=aO(bA,bl,bH,bM)|0;bM=aO(bN,D,bq,bw)|0;c[bs>>2]=bM;c[bs+4>>2]=D;bs=bg+80|0;bM=c[bs>>2]|0;bw=c[bs+4>>2]|0;bs=c[bg>>2]|0;bq=c[bg+4>>2]|0;bN=aY(bM,bw,18,0)|0;bH=D;bl=aO(bs,bq,bM,bw)|0;bw=aO(bl,D,bN,bH)|0;c[bg>>2]=bw;c[bg+4>>2]=D;aJ(bg);bw=0;while(1){bH=bf+(bw<<3)|0;bN=c[bH>>2]|0;bl=bd+(bw<<3)|0;bM=(c[bl>>2]^bN)&bk;bq=bM^bN;c[bH>>2]=bq;c[bH+4>>2]=(bq|0)<0?-1:0;bq=bM^c[bl>>2];c[bl>>2]=bq;c[bl+4>>2]=(bq|0)<0?-1:0;bq=bw+1|0;if(bq>>>0<10){bw=bq}else{b$=0;break}}do{bw=bg+(b$<<3)|0;bq=c[bw>>2]|0;bl=be+(b$<<3)|0;bM=(c[bl>>2]^bq)&bk;bH=bM^bq;c[bw>>2]=bH;c[bw+4>>2]=(bH|0)<0?-1:0;bH=bM^c[bl>>2];c[bl>>2]=bH;c[bl+4>>2]=(bH|0)<0?-1:0;b$=b$+1|0;}while(b$>>>0<10);bk=bh+1|0;if(bk>>>0<8){bH=bd;bl=bb;bM=x;bw=bc;bc=be;x=bf;bb=bg;bd=bj;bh=bk;bi=bi<<1;bj=bH;bg=bl;bf=bM;be=bw}else{break}}bi=C+1|0;if(bi>>>0<32){a9=bf;y=bg;A=be;T=bj;B=bc;z=x;E=bb;C=bi;ba=bd}else{break}}ba=K|0;aL(J|0,bf|0,80);bf=K;aL(bf|0,bg|0,80);bg=p;J=q;C=r;E=h|0;aK(E,ba);h=r|0;aK(h,E);r=q|0;aK(r,h);q=j|0;aI(t,r,ba);z=G+144|0;B=c[z>>2]|0;T=c[z+4>>2]|0;A=c[a7>>2]|0;y=c[a7+4>>2]|0;a9=aY(B,T,18,0)|0;b$=D;aA=aO(A,y,B,T)|0;T=aO(aA,D,a9,b$)|0;c[a7>>2]=T;c[a7+4>>2]=D;T=G+136|0;b$=c[T>>2]|0;a9=c[T+4>>2]|0;aA=c[a6>>2]|0;B=c[a6+4>>2]|0;y=aY(b$,a9,18,0)|0;A=D;a8=aO(aA,B,b$,a9)|0;a9=aO(a8,D,y,A)|0;c[a6>>2]=a9;c[a6+4>>2]=D;a9=G+128|0;A=c[a9>>2]|0;y=c[a9+4>>2]|0;a8=c[a5>>2]|0;b$=c[a5+4>>2]|0;B=aY(A,y,18,0)|0;aA=D;a$=aO(a8,b$,A,y)|0;y=aO(a$,D,B,aA)|0;c[a5>>2]=y;c[a5+4>>2]=D;y=G+120|0;aA=c[y>>2]|0;B=c[y+4>>2]|0;a$=c[a4>>2]|0;A=c[a4+4>>2]|0;b$=aY(aA,B,18,0)|0;a8=D;s=aO(a$,A,aA,B)|0;B=aO(s,D,b$,a8)|0;c[a4>>2]=B;c[a4+4>>2]=D;B=G+112|0;a8=c[B>>2]|0;b$=c[B+4>>2]|0;s=c[a3>>2]|0;aA=c[a3+4>>2]|0;A=aY(a8,b$,18,0)|0;a$=D;aZ=aO(s,aA,a8,b$)|0;b$=aO(aZ,D,A,a$)|0;c[a3>>2]=b$;c[a3+4>>2]=D;b$=G+104|0;a$=c[b$>>2]|0;A=c[b$+4>>2]|0;aZ=c[a2>>2]|0;a8=c[a2+4>>2]|0;aA=aY(a$,A,18,0)|0;s=D;aX=aO(aZ,a8,a$,A)|0;A=aO(aX,D,aA,s)|0;c[a2>>2]=A;c[a2+4>>2]=D;A=G+96|0;s=c[A>>2]|0;aA=c[A+4>>2]|0;aX=c[a1>>2]|0;a$=c[a1+4>>2]|0;a8=aY(s,aA,18,0)|0;aZ=D;aW=aO(aX,a$,s,aA)|0;aA=aO(aW,D,a8,aZ)|0;c[a1>>2]=aA;c[a1+4>>2]=D;aA=G+88|0;G=c[aA>>2]|0;aZ=c[aA+4>>2]|0;a8=c[a0>>2]|0;aW=c[a0+4>>2]|0;s=aY(G,aZ,18,0)|0;a$=D;aX=aO(a8,aW,G,aZ)|0;aZ=aO(aX,D,s,a$)|0;c[a0>>2]=aZ;c[a0+4>>2]=D;aZ=c[a_>>2]|0;a$=c[a_+4>>2]|0;s=c[t>>2]|0;aX=c[t+4>>2]|0;G=aY(aZ,a$,18,0)|0;aW=D;a8=aO(s,aX,aZ,a$)|0;a$=aO(a8,D,G,aW)|0;c[t>>2]=a$;c[t+4>>2]=D;aJ(t);aL(j|0,I|0,80);j=k|0;aI(t,q,E);E=c[z>>2]|0;a$=c[z+4>>2]|0;aW=c[a7>>2]|0;G=c[a7+4>>2]|0;a8=aY(E,a$,18,0)|0;aZ=D;aX=aO(aW,G,E,a$)|0;a$=aO(aX,D,a8,aZ)|0;c[a7>>2]=a$;c[a7+4>>2]=D;a$=c[T>>2]|0;aZ=c[T+4>>2]|0;a8=c[a6>>2]|0;aX=c[a6+4>>2]|0;E=aY(a$,aZ,18,0)|0;G=D;aW=aO(a8,aX,a$,aZ)|0;aZ=aO(aW,D,E,G)|0;c[a6>>2]=aZ;c[a6+4>>2]=D;aZ=c[a9>>2]|0;G=c[a9+4>>2]|0;E=c[a5>>2]|0;aW=c[a5+4>>2]|0;a$=aY(aZ,G,18,0)|0;aX=D;a8=aO(E,aW,aZ,G)|0;G=aO(a8,D,a$,aX)|0;c[a5>>2]=G;c[a5+4>>2]=D;G=c[y>>2]|0;aX=c[y+4>>2]|0;a$=c[a4>>2]|0;a8=c[a4+4>>2]|0;aZ=aY(G,aX,18,0)|0;aW=D;E=aO(a$,a8,G,aX)|0;aX=aO(E,D,aZ,aW)|0;c[a4>>2]=aX;c[a4+4>>2]=D;aX=c[B>>2]|0;aW=c[B+4>>2]|0;aZ=c[a3>>2]|0;E=c[a3+4>>2]|0;G=aY(aX,aW,18,0)|0;a8=D;a$=aO(aZ,E,aX,aW)|0;aW=aO(a$,D,G,a8)|0;c[a3>>2]=aW;c[a3+4>>2]=D;aW=c[b$>>2]|0;a8=c[b$+4>>2]|0;G=c[a2>>2]|0;a$=c[a2+4>>2]|0;aX=aY(aW,a8,18,0)|0;E=D;aZ=aO(G,a$,aW,a8)|0;a8=aO(aZ,D,aX,E)|0;c[a2>>2]=a8;c[a2+4>>2]=D;a8=c[A>>2]|0;E=c[A+4>>2]|0;aX=c[a1>>2]|0;aZ=c[a1+4>>2]|0;aW=aY(a8,E,18,0)|0;a$=D;G=aO(aX,aZ,a8,E)|0;E=aO(G,D,aW,a$)|0;c[a1>>2]=E;c[a1+4>>2]=D;E=c[aA>>2]|0;a$=c[aA+4>>2]|0;aW=c[a0>>2]|0;G=c[a0+4>>2]|0;a8=aY(E,a$,18,0)|0;aZ=D;aX=aO(aW,G,E,a$)|0;a$=aO(aX,D,a8,aZ)|0;c[a0>>2]=a$;c[a0+4>>2]=D;a$=c[a_>>2]|0;aZ=c[a_+4>>2]|0;a8=c[t>>2]|0;aX=c[t+4>>2]|0;E=aY(a$,aZ,18,0)|0;G=D;aW=aO(a8,aX,a$,aZ)|0;aZ=aO(aW,D,E,G)|0;c[t>>2]=aZ;c[t+4>>2]=D;aJ(t);aL(k|0,I|0,80);aK(r,j);k=l|0;aI(t,r,q);q=c[z>>2]|0;aZ=c[z+4>>2]|0;G=c[a7>>2]|0;E=c[a7+4>>2]|0;aW=aY(q,aZ,18,0)|0;a$=D;aX=aO(G,E,q,aZ)|0;aZ=aO(aX,D,aW,a$)|0;c[a7>>2]=aZ;c[a7+4>>2]=D;aZ=c[T>>2]|0;a$=c[T+4>>2]|0;aW=c[a6>>2]|0;aX=c[a6+4>>2]|0;q=aY(aZ,a$,18,0)|0;E=D;G=aO(aW,aX,aZ,a$)|0;a$=aO(G,D,q,E)|0;c[a6>>2]=a$;c[a6+4>>2]=D;a$=c[a9>>2]|0;E=c[a9+4>>2]|0;q=c[a5>>2]|0;G=c[a5+4>>2]|0;aZ=aY(a$,E,18,0)|0;aX=D;aW=aO(q,G,a$,E)|0;E=aO(aW,D,aZ,aX)|0;c[a5>>2]=E;c[a5+4>>2]=D;E=c[y>>2]|0;aX=c[y+4>>2]|0;aZ=c[a4>>2]|0;aW=c[a4+4>>2]|0;a$=aY(E,aX,18,0)|0;G=D;q=aO(aZ,aW,E,aX)|0;aX=aO(q,D,a$,G)|0;c[a4>>2]=aX;c[a4+4>>2]=D;aX=c[B>>2]|0;G=c[B+4>>2]|0;a$=c[a3>>2]|0;q=c[a3+4>>2]|0;E=aY(aX,G,18,0)|0;aW=D;aZ=aO(a$,q,aX,G)|0;G=aO(aZ,D,E,aW)|0;c[a3>>2]=G;c[a3+4>>2]=D;G=c[b$>>2]|0;aW=c[b$+4>>2]|0;E=c[a2>>2]|0;aZ=c[a2+4>>2]|0;aX=aY(G,aW,18,0)|0;q=D;a$=aO(E,aZ,G,aW)|0;aW=aO(a$,D,aX,q)|0;c[a2>>2]=aW;c[a2+4>>2]=D;aW=c[A>>2]|0;q=c[A+4>>2]|0;aX=c[a1>>2]|0;a$=c[a1+4>>2]|0;G=aY(aW,q,18,0)|0;aZ=D;E=aO(aX,a$,aW,q)|0;q=aO(E,D,G,aZ)|0;c[a1>>2]=q;c[a1+4>>2]=D;q=c[aA>>2]|0;aZ=c[aA+4>>2]|0;G=c[a0>>2]|0;E=c[a0+4>>2]|0;aW=aY(q,aZ,18,0)|0;a$=D;aX=aO(G,E,q,aZ)|0;aZ=aO(aX,D,aW,a$)|0;c[a0>>2]=aZ;c[a0+4>>2]=D;aZ=c[a_>>2]|0;a$=c[a_+4>>2]|0;aW=c[t>>2]|0;aX=c[t+4>>2]|0;q=aY(aZ,a$,18,0)|0;E=D;G=aO(aW,aX,aZ,a$)|0;a$=aO(G,D,q,E)|0;c[t>>2]=a$;c[t+4>>2]=D;aJ(t);aL(l|0,I|0,80);aK(r,k);aK(h,r);aK(r,h);aK(h,r);aK(r,h);l=m|0;aI(t,r,k);k=c[z>>2]|0;a$=c[z+4>>2]|0;E=c[a7>>2]|0;q=c[a7+4>>2]|0;G=aY(k,a$,18,0)|0;aZ=D;aX=aO(E,q,k,a$)|0;a$=aO(aX,D,G,aZ)|0;c[a7>>2]=a$;c[a7+4>>2]=D;a$=c[T>>2]|0;aZ=c[T+4>>2]|0;G=c[a6>>2]|0;aX=c[a6+4>>2]|0;k=aY(a$,aZ,18,0)|0;q=D;E=aO(G,aX,a$,aZ)|0;aZ=aO(E,D,k,q)|0;c[a6>>2]=aZ;c[a6+4>>2]=D;aZ=c[a9>>2]|0;q=c[a9+4>>2]|0;k=c[a5>>2]|0;E=c[a5+4>>2]|0;a$=aY(aZ,q,18,0)|0;aX=D;G=aO(k,E,aZ,q)|0;q=aO(G,D,a$,aX)|0;c[a5>>2]=q;c[a5+4>>2]=D;q=c[y>>2]|0;aX=c[y+4>>2]|0;a$=c[a4>>2]|0;G=c[a4+4>>2]|0;aZ=aY(q,aX,18,0)|0;E=D;k=aO(a$,G,q,aX)|0;aX=aO(k,D,aZ,E)|0;c[a4>>2]=aX;c[a4+4>>2]=D;aX=c[B>>2]|0;E=c[B+4>>2]|0;aZ=c[a3>>2]|0;k=c[a3+4>>2]|0;q=aY(aX,E,18,0)|0;G=D;a$=aO(aZ,k,aX,E)|0;E=aO(a$,D,q,G)|0;c[a3>>2]=E;c[a3+4>>2]=D;E=c[b$>>2]|0;G=c[b$+4>>2]|0;q=c[a2>>2]|0;a$=c[a2+4>>2]|0;aX=aY(E,G,18,0)|0;k=D;aZ=aO(q,a$,E,G)|0;G=aO(aZ,D,aX,k)|0;c[a2>>2]=G;c[a2+4>>2]=D;G=c[A>>2]|0;k=c[A+4>>2]|0;aX=c[a1>>2]|0;aZ=c[a1+4>>2]|0;E=aY(G,k,18,0)|0;a$=D;q=aO(aX,aZ,G,k)|0;k=aO(q,D,E,a$)|0;c[a1>>2]=k;c[a1+4>>2]=D;k=c[aA>>2]|0;a$=c[aA+4>>2]|0;E=c[a0>>2]|0;q=c[a0+4>>2]|0;G=aY(k,a$,18,0)|0;aZ=D;aX=aO(E,q,k,a$)|0;a$=aO(aX,D,G,aZ)|0;c[a0>>2]=a$;c[a0+4>>2]=D;a$=c[a_>>2]|0;aZ=c[a_+4>>2]|0;G=c[t>>2]|0;aX=c[t+4>>2]|0;k=aY(a$,aZ,18,0)|0;q=D;E=aO(G,aX,a$,aZ)|0;aZ=aO(E,D,k,q)|0;c[t>>2]=aZ;c[t+4>>2]=D;aJ(t);aL(m|0,I|0,80);aK(r,l);aK(h,r);aK(r,h);aK(h,r);aK(r,h);aK(h,r);aK(r,h);aK(h,r);aK(r,h);aK(h,r);m=n|0;aI(t,h,l);aZ=c[z>>2]|0;q=c[z+4>>2]|0;k=c[a7>>2]|0;E=c[a7+4>>2]|0;a$=aY(aZ,q,18,0)|0;aX=D;G=aO(k,E,aZ,q)|0;q=aO(G,D,a$,aX)|0;c[a7>>2]=q;c[a7+4>>2]=D;q=c[T>>2]|0;aX=c[T+4>>2]|0;a$=c[a6>>2]|0;G=c[a6+4>>2]|0;aZ=aY(q,aX,18,0)|0;E=D;k=aO(a$,G,q,aX)|0;aX=aO(k,D,aZ,E)|0;c[a6>>2]=aX;c[a6+4>>2]=D;aX=c[a9>>2]|0;E=c[a9+4>>2]|0;aZ=c[a5>>2]|0;k=c[a5+4>>2]|0;q=aY(aX,E,18,0)|0;G=D;a$=aO(aZ,k,aX,E)|0;E=aO(a$,D,q,G)|0;c[a5>>2]=E;c[a5+4>>2]=D;E=c[y>>2]|0;G=c[y+4>>2]|0;q=c[a4>>2]|0;a$=c[a4+4>>2]|0;aX=aY(E,G,18,0)|0;k=D;aZ=aO(q,a$,E,G)|0;G=aO(aZ,D,aX,k)|0;c[a4>>2]=G;c[a4+4>>2]=D;G=c[B>>2]|0;k=c[B+4>>2]|0;aX=c[a3>>2]|0;aZ=c[a3+4>>2]|0;E=aY(G,k,18,0)|0;a$=D;q=aO(aX,aZ,G,k)|0;k=aO(q,D,E,a$)|0;c[a3>>2]=k;c[a3+4>>2]=D;k=c[b$>>2]|0;a$=c[b$+4>>2]|0;E=c[a2>>2]|0;q=c[a2+4>>2]|0;G=aY(k,a$,18,0)|0;aZ=D;aX=aO(E,q,k,a$)|0;a$=aO(aX,D,G,aZ)|0;c[a2>>2]=a$;c[a2+4>>2]=D;a$=c[A>>2]|0;aZ=c[A+4>>2]|0;G=c[a1>>2]|0;aX=c[a1+4>>2]|0;k=aY(a$,aZ,18,0)|0;q=D;E=aO(G,aX,a$,aZ)|0;aZ=aO(E,D,k,q)|0;c[a1>>2]=aZ;c[a1+4>>2]=D;aZ=c[aA>>2]|0;q=c[aA+4>>2]|0;k=c[a0>>2]|0;E=c[a0+4>>2]|0;a$=aY(aZ,q,18,0)|0;aX=D;G=aO(k,E,aZ,q)|0;q=aO(G,D,a$,aX)|0;c[a0>>2]=q;c[a0+4>>2]=D;q=c[a_>>2]|0;aX=c[a_+4>>2]|0;a$=c[t>>2]|0;G=c[t+4>>2]|0;aZ=aY(q,aX,18,0)|0;E=D;k=aO(a$,G,q,aX)|0;aX=aO(k,D,aZ,E)|0;c[t>>2]=aX;c[t+4>>2]=D;aJ(t);aL(n|0,I|0,80);aK(r,m);aK(h,r);aK(r,h);aK(h,r);aK(r,h);aK(h,r);aK(r,h);aK(h,r);aK(r,h);aK(h,r);aK(r,h);aK(h,r);aK(r,h);aK(h,r);aK(r,h);aK(h,r);aK(r,h);aK(h,r);aK(r,h);aK(h,r);aI(t,h,m);m=c[z>>2]|0;n=c[z+4>>2]|0;aX=c[a7>>2]|0;E=c[a7+4>>2]|0;aZ=aY(m,n,18,0)|0;k=D;q=aO(aX,E,m,n)|0;n=aO(q,D,aZ,k)|0;c[a7>>2]=n;c[a7+4>>2]=D;n=c[T>>2]|0;k=c[T+4>>2]|0;aZ=c[a6>>2]|0;q=c[a6+4>>2]|0;m=aY(n,k,18,0)|0;E=D;aX=aO(aZ,q,n,k)|0;k=aO(aX,D,m,E)|0;c[a6>>2]=k;c[a6+4>>2]=D;k=c[a9>>2]|0;E=c[a9+4>>2]|0;m=c[a5>>2]|0;aX=c[a5+4>>2]|0;n=aY(k,E,18,0)|0;q=D;aZ=aO(m,aX,k,E)|0;E=aO(aZ,D,n,q)|0;c[a5>>2]=E;c[a5+4>>2]=D;E=c[y>>2]|0;q=c[y+4>>2]|0;n=c[a4>>2]|0;aZ=c[a4+4>>2]|0;k=aY(E,q,18,0)|0;aX=D;m=aO(n,aZ,E,q)|0;q=aO(m,D,k,aX)|0;c[a4>>2]=q;c[a4+4>>2]=D;q=c[B>>2]|0;aX=c[B+4>>2]|0;k=c[a3>>2]|0;m=c[a3+4>>2]|0;E=aY(q,aX,18,0)|0;aZ=D;n=aO(k,m,q,aX)|0;aX=aO(n,D,E,aZ)|0;c[a3>>2]=aX;c[a3+4>>2]=D;aX=c[b$>>2]|0;aZ=c[b$+4>>2]|0;E=c[a2>>2]|0;n=c[a2+4>>2]|0;q=aY(aX,aZ,18,0)|0;m=D;k=aO(E,n,aX,aZ)|0;aZ=aO(k,D,q,m)|0;c[a2>>2]=aZ;c[a2+4>>2]=D;aZ=c[A>>2]|0;m=c[A+4>>2]|0;q=c[a1>>2]|0;k=c[a1+4>>2]|0;aX=aY(aZ,m,18,0)|0;n=D;E=aO(q,k,aZ,m)|0;m=aO(E,D,aX,n)|0;c[a1>>2]=m;c[a1+4>>2]=D;m=c[aA>>2]|0;n=c[aA+4>>2]|0;aX=c[a0>>2]|0;E=c[a0+4>>2]|0;aZ=aY(m,n,18,0)|0;k=D;q=aO(aX,E,m,n)|0;n=aO(q,D,aZ,k)|0;c[a0>>2]=n;c[a0+4>>2]=D;n=c[a_>>2]|0;k=c[a_+4>>2]|0;aZ=c[t>>2]|0;q=c[t+4>>2]|0;m=aY(n,k,18,0)|0;E=D;aX=aO(aZ,q,n,k)|0;k=aO(aX,D,m,E)|0;c[t>>2]=k;c[t+4>>2]=D;aJ(t);aL(J|0,I|0,80);aK(h,r);aK(r,h);aK(h,r);aK(r,h);aK(h,r);aK(r,h);aK(h,r);aK(r,h);aK(h,r);aK(r,h);k=o|0;aI(t,r,l);l=c[z>>2]|0;E=c[z+4>>2]|0;m=c[a7>>2]|0;aX=c[a7+4>>2]|0;n=aY(l,E,18,0)|0;q=D;aZ=aO(m,aX,l,E)|0;E=aO(aZ,D,n,q)|0;c[a7>>2]=E;c[a7+4>>2]=D;E=c[T>>2]|0;q=c[T+4>>2]|0;n=c[a6>>2]|0;aZ=c[a6+4>>2]|0;l=aY(E,q,18,0)|0;aX=D;m=aO(n,aZ,E,q)|0;q=aO(m,D,l,aX)|0;c[a6>>2]=q;c[a6+4>>2]=D;q=c[a9>>2]|0;aX=c[a9+4>>2]|0;l=c[a5>>2]|0;m=c[a5+4>>2]|0;E=aY(q,aX,18,0)|0;aZ=D;n=aO(l,m,q,aX)|0;aX=aO(n,D,E,aZ)|0;c[a5>>2]=aX;c[a5+4>>2]=D;aX=c[y>>2]|0;aZ=c[y+4>>2]|0;E=c[a4>>2]|0;n=c[a4+4>>2]|0;q=aY(aX,aZ,18,0)|0;m=D;l=aO(E,n,aX,aZ)|0;aZ=aO(l,D,q,m)|0;c[a4>>2]=aZ;c[a4+4>>2]=D;aZ=c[B>>2]|0;m=c[B+4>>2]|0;q=c[a3>>2]|0;l=c[a3+4>>2]|0;aX=aY(aZ,m,18,0)|0;n=D;E=aO(q,l,aZ,m)|0;m=aO(E,D,aX,n)|0;c[a3>>2]=m;c[a3+4>>2]=D;m=c[b$>>2]|0;n=c[b$+4>>2]|0;aX=c[a2>>2]|0;E=c[a2+4>>2]|0;aZ=aY(m,n,18,0)|0;l=D;q=aO(aX,E,m,n)|0;n=aO(q,D,aZ,l)|0;c[a2>>2]=n;c[a2+4>>2]=D;n=c[A>>2]|0;l=c[A+4>>2]|0;aZ=c[a1>>2]|0;q=c[a1+4>>2]|0;m=aY(n,l,18,0)|0;E=D;aX=aO(aZ,q,n,l)|0;l=aO(aX,D,m,E)|0;c[a1>>2]=l;c[a1+4>>2]=D;l=c[aA>>2]|0;E=c[aA+4>>2]|0;m=c[a0>>2]|0;aX=c[a0+4>>2]|0;n=aY(l,E,18,0)|0;q=D;aZ=aO(m,aX,l,E)|0;E=aO(aZ,D,n,q)|0;c[a0>>2]=E;c[a0+4>>2]=D;E=c[a_>>2]|0;q=c[a_+4>>2]|0;n=c[t>>2]|0;aZ=c[t+4>>2]|0;l=aY(E,q,18,0)|0;aX=D;m=aO(n,aZ,E,q)|0;q=aO(m,D,l,aX)|0;c[t>>2]=q;c[t+4>>2]=D;aJ(t);aL(o|0,I|0,80);aK(r,k);aK(h,r);o=2;do{aK(r,h);aK(h,r);o=o+2|0;}while((o|0)<50);o=L|0;q=p|0;aI(t,h,k);p=c[z>>2]|0;aX=c[z+4>>2]|0;l=c[a7>>2]|0;m=c[a7+4>>2]|0;E=aY(p,aX,18,0)|0;aZ=D;n=aO(l,m,p,aX)|0;aX=aO(n,D,E,aZ)|0;c[a7>>2]=aX;c[a7+4>>2]=D;aX=c[T>>2]|0;aZ=c[T+4>>2]|0;E=c[a6>>2]|0;n=c[a6+4>>2]|0;p=aY(aX,aZ,18,0)|0;m=D;l=aO(E,n,aX,aZ)|0;aZ=aO(l,D,p,m)|0;c[a6>>2]=aZ;c[a6+4>>2]=D;aZ=c[a9>>2]|0;m=c[a9+4>>2]|0;p=c[a5>>2]|0;l=c[a5+4>>2]|0;aX=aY(aZ,m,18,0)|0;n=D;E=aO(p,l,aZ,m)|0;m=aO(E,D,aX,n)|0;c[a5>>2]=m;c[a5+4>>2]=D;m=c[y>>2]|0;n=c[y+4>>2]|0;aX=c[a4>>2]|0;E=c[a4+4>>2]|0;aZ=aY(m,n,18,0)|0;l=D;p=aO(aX,E,m,n)|0;n=aO(p,D,aZ,l)|0;c[a4>>2]=n;c[a4+4>>2]=D;n=c[B>>2]|0;l=c[B+4>>2]|0;aZ=c[a3>>2]|0;p=c[a3+4>>2]|0;m=aY(n,l,18,0)|0;E=D;aX=aO(aZ,p,n,l)|0;l=aO(aX,D,m,E)|0;c[a3>>2]=l;c[a3+4>>2]=D;l=c[b$>>2]|0;E=c[b$+4>>2]|0;m=c[a2>>2]|0;aX=c[a2+4>>2]|0;n=aY(l,E,18,0)|0;p=D;aZ=aO(m,aX,l,E)|0;E=aO(aZ,D,n,p)|0;c[a2>>2]=E;c[a2+4>>2]=D;E=c[A>>2]|0;p=c[A+4>>2]|0;n=c[a1>>2]|0;aZ=c[a1+4>>2]|0;l=aY(E,p,18,0)|0;aX=D;m=aO(n,aZ,E,p)|0;p=aO(m,D,l,aX)|0;c[a1>>2]=p;c[a1+4>>2]=D;p=c[aA>>2]|0;aX=c[aA+4>>2]|0;l=c[a0>>2]|0;m=c[a0+4>>2]|0;E=aY(p,aX,18,0)|0;aZ=D;n=aO(l,m,p,aX)|0;aX=aO(n,D,E,aZ)|0;c[a0>>2]=aX;c[a0+4>>2]=D;aX=c[a_>>2]|0;aZ=c[a_+4>>2]|0;E=c[t>>2]|0;n=c[t+4>>2]|0;p=aY(aX,aZ,18,0)|0;m=D;l=aO(E,n,aX,aZ)|0;aZ=aO(l,D,p,m)|0;c[t>>2]=aZ;c[t+4>>2]=D;aJ(t);aL(bg|0,I|0,80);aK(h,q);aK(r,h);bg=2;do{aK(h,r);aK(r,h);bg=bg+2|0;}while((bg|0)<100);aI(t,r,q);q=c[z>>2]|0;bg=c[z+4>>2]|0;aZ=c[a7>>2]|0;m=c[a7+4>>2]|0;p=aY(q,bg,18,0)|0;l=D;aX=aO(aZ,m,q,bg)|0;bg=aO(aX,D,p,l)|0;c[a7>>2]=bg;c[a7+4>>2]=D;bg=c[T>>2]|0;l=c[T+4>>2]|0;p=c[a6>>2]|0;aX=c[a6+4>>2]|0;q=aY(bg,l,18,0)|0;m=D;aZ=aO(p,aX,bg,l)|0;l=aO(aZ,D,q,m)|0;c[a6>>2]=l;c[a6+4>>2]=D;l=c[a9>>2]|0;m=c[a9+4>>2]|0;q=c[a5>>2]|0;aZ=c[a5+4>>2]|0;bg=aY(l,m,18,0)|0;aX=D;p=aO(q,aZ,l,m)|0;m=aO(p,D,bg,aX)|0;c[a5>>2]=m;c[a5+4>>2]=D;m=c[y>>2]|0;aX=c[y+4>>2]|0;bg=c[a4>>2]|0;p=c[a4+4>>2]|0;l=aY(m,aX,18,0)|0;aZ=D;q=aO(bg,p,m,aX)|0;aX=aO(q,D,l,aZ)|0;c[a4>>2]=aX;c[a4+4>>2]=D;aX=c[B>>2]|0;aZ=c[B+4>>2]|0;l=c[a3>>2]|0;q=c[a3+4>>2]|0;m=aY(aX,aZ,18,0)|0;p=D;bg=aO(l,q,aX,aZ)|0;aZ=aO(bg,D,m,p)|0;c[a3>>2]=aZ;c[a3+4>>2]=D;aZ=c[b$>>2]|0;p=c[b$+4>>2]|0;m=c[a2>>2]|0;bg=c[a2+4>>2]|0;aX=aY(aZ,p,18,0)|0;q=D;l=aO(m,bg,aZ,p)|0;p=aO(l,D,aX,q)|0;c[a2>>2]=p;c[a2+4>>2]=D;p=c[A>>2]|0;q=c[A+4>>2]|0;aX=c[a1>>2]|0;l=c[a1+4>>2]|0;aZ=aY(p,q,18,0)|0;bg=D;m=aO(aX,l,p,q)|0;q=aO(m,D,aZ,bg)|0;c[a1>>2]=q;c[a1+4>>2]=D;q=c[aA>>2]|0;bg=c[aA+4>>2]|0;aZ=c[a0>>2]|0;m=c[a0+4>>2]|0;p=aY(q,bg,18,0)|0;l=D;aX=aO(aZ,m,q,bg)|0;bg=aO(aX,D,p,l)|0;c[a0>>2]=bg;c[a0+4>>2]=D;bg=c[a_>>2]|0;l=c[a_+4>>2]|0;p=c[t>>2]|0;aX=c[t+4>>2]|0;q=aY(bg,l,18,0)|0;m=D;aZ=aO(p,aX,bg,l)|0;l=aO(aZ,D,q,m)|0;c[t>>2]=l;c[t+4>>2]=D;aJ(t);aL(C|0,I|0,80);aK(r,h);aK(h,r);C=2;do{aK(r,h);aK(h,r);C=C+2|0;}while((C|0)<50);aI(t,h,k);k=c[z>>2]|0;C=c[z+4>>2]|0;l=c[a7>>2]|0;m=c[a7+4>>2]|0;q=aY(k,C,18,0)|0;aZ=D;bg=aO(l,m,k,C)|0;C=aO(bg,D,q,aZ)|0;c[a7>>2]=C;c[a7+4>>2]=D;C=c[T>>2]|0;aZ=c[T+4>>2]|0;q=c[a6>>2]|0;bg=c[a6+4>>2]|0;k=aY(C,aZ,18,0)|0;m=D;l=aO(q,bg,C,aZ)|0;aZ=aO(l,D,k,m)|0;c[a6>>2]=aZ;c[a6+4>>2]=D;aZ=c[a9>>2]|0;m=c[a9+4>>2]|0;k=c[a5>>2]|0;l=c[a5+4>>2]|0;C=aY(aZ,m,18,0)|0;bg=D;q=aO(k,l,aZ,m)|0;m=aO(q,D,C,bg)|0;c[a5>>2]=m;c[a5+4>>2]=D;m=c[y>>2]|0;bg=c[y+4>>2]|0;C=c[a4>>2]|0;q=c[a4+4>>2]|0;aZ=aY(m,bg,18,0)|0;l=D;k=aO(C,q,m,bg)|0;bg=aO(k,D,aZ,l)|0;c[a4>>2]=bg;c[a4+4>>2]=D;bg=c[B>>2]|0;l=c[B+4>>2]|0;aZ=c[a3>>2]|0;k=c[a3+4>>2]|0;m=aY(bg,l,18,0)|0;q=D;C=aO(aZ,k,bg,l)|0;l=aO(C,D,m,q)|0;c[a3>>2]=l;c[a3+4>>2]=D;l=c[b$>>2]|0;q=c[b$+4>>2]|0;m=c[a2>>2]|0;C=c[a2+4>>2]|0;bg=aY(l,q,18,0)|0;k=D;aZ=aO(m,C,l,q)|0;q=aO(aZ,D,bg,k)|0;c[a2>>2]=q;c[a2+4>>2]=D;q=c[A>>2]|0;k=c[A+4>>2]|0;bg=c[a1>>2]|0;aZ=c[a1+4>>2]|0;l=aY(q,k,18,0)|0;C=D;m=aO(bg,aZ,q,k)|0;k=aO(m,D,l,C)|0;c[a1>>2]=k;c[a1+4>>2]=D;k=c[aA>>2]|0;C=c[aA+4>>2]|0;l=c[a0>>2]|0;m=c[a0+4>>2]|0;q=aY(k,C,18,0)|0;aZ=D;bg=aO(l,m,k,C)|0;C=aO(bg,D,q,aZ)|0;c[a0>>2]=C;c[a0+4>>2]=D;C=c[a_>>2]|0;aZ=c[a_+4>>2]|0;q=c[t>>2]|0;bg=c[t+4>>2]|0;k=aY(C,aZ,18,0)|0;m=D;l=aO(q,bg,C,aZ)|0;aZ=aO(l,D,k,m)|0;c[t>>2]=aZ;c[t+4>>2]=D;aJ(t);aL(J|0,I|0,80);aK(h,r);aK(r,h);aK(h,r);aK(r,h);aK(h,r);aI(t,h,j);j=c[z>>2]|0;h=c[z+4>>2]|0;r=c[a7>>2]|0;J=c[a7+4>>2]|0;aZ=aY(j,h,18,0)|0;m=D;k=aO(r,J,j,h)|0;h=aO(k,D,aZ,m)|0;c[a7>>2]=h;c[a7+4>>2]=D;h=c[T>>2]|0;m=c[T+4>>2]|0;aZ=c[a6>>2]|0;k=c[a6+4>>2]|0;j=aY(h,m,18,0)|0;J=D;r=aO(aZ,k,h,m)|0;m=aO(r,D,j,J)|0;c[a6>>2]=m;c[a6+4>>2]=D;m=c[a9>>2]|0;J=c[a9+4>>2]|0;j=c[a5>>2]|0;r=c[a5+4>>2]|0;h=aY(m,J,18,0)|0;k=D;aZ=aO(j,r,m,J)|0;J=aO(aZ,D,h,k)|0;c[a5>>2]=J;c[a5+4>>2]=D;J=c[y>>2]|0;k=c[y+4>>2]|0;h=c[a4>>2]|0;aZ=c[a4+4>>2]|0;m=aY(J,k,18,0)|0;r=D;j=aO(h,aZ,J,k)|0;k=aO(j,D,m,r)|0;c[a4>>2]=k;c[a4+4>>2]=D;k=c[B>>2]|0;r=c[B+4>>2]|0;m=c[a3>>2]|0;j=c[a3+4>>2]|0;J=aY(k,r,18,0)|0;aZ=D;h=aO(m,j,k,r)|0;r=aO(h,D,J,aZ)|0;c[a3>>2]=r;c[a3+4>>2]=D;r=c[b$>>2]|0;aZ=c[b$+4>>2]|0;J=c[a2>>2]|0;h=c[a2+4>>2]|0;k=aY(r,aZ,18,0)|0;j=D;m=aO(J,h,r,aZ)|0;aZ=aO(m,D,k,j)|0;c[a2>>2]=aZ;c[a2+4>>2]=D;aZ=c[A>>2]|0;j=c[A+4>>2]|0;k=c[a1>>2]|0;m=c[a1+4>>2]|0;r=aY(aZ,j,18,0)|0;h=D;J=aO(k,m,aZ,j)|0;j=aO(J,D,r,h)|0;c[a1>>2]=j;c[a1+4>>2]=D;j=c[aA>>2]|0;h=c[aA+4>>2]|0;r=c[a0>>2]|0;J=c[a0+4>>2]|0;aZ=aY(j,h,18,0)|0;m=D;k=aO(r,J,j,h)|0;h=aO(k,D,aZ,m)|0;c[a0>>2]=h;c[a0+4>>2]=D;h=c[a_>>2]|0;m=c[a_+4>>2]|0;aZ=c[t>>2]|0;k=c[t+4>>2]|0;j=aY(h,m,18,0)|0;J=D;r=aO(aZ,k,h,m)|0;m=aO(r,D,j,J)|0;c[t>>2]=m;c[t+4>>2]=D;aJ(t);aL(L|0,I|0,80);aI(t,f,o);o=c[z>>2]|0;f=c[z+4>>2]|0;z=c[a7>>2]|0;L=c[a7+4>>2]|0;m=aY(o,f,18,0)|0;J=D;j=aO(z,L,o,f)|0;f=aO(j,D,m,J)|0;c[a7>>2]=f;c[a7+4>>2]=D;a7=c[T>>2]|0;f=c[T+4>>2]|0;T=c[a6>>2]|0;J=c[a6+4>>2]|0;m=aY(a7,f,18,0)|0;j=D;o=aO(T,J,a7,f)|0;f=aO(o,D,m,j)|0;c[a6>>2]=f;c[a6+4>>2]=D;a6=c[a9>>2]|0;f=c[a9+4>>2]|0;a9=c[a5>>2]|0;j=c[a5+4>>2]|0;m=aY(a6,f,18,0)|0;o=D;a7=aO(a9,j,a6,f)|0;f=aO(a7,D,m,o)|0;c[a5>>2]=f;c[a5+4>>2]=D;a5=c[y>>2]|0;f=c[y+4>>2]|0;y=c[a4>>2]|0;o=c[a4+4>>2]|0;m=aY(a5,f,18,0)|0;a7=D;a6=aO(y,o,a5,f)|0;f=aO(a6,D,m,a7)|0;c[a4>>2]=f;c[a4+4>>2]=D;a4=c[B>>2]|0;f=c[B+4>>2]|0;B=c[a3>>2]|0;a7=c[a3+4>>2]|0;m=aY(a4,f,18,0)|0;a6=D;a5=aO(B,a7,a4,f)|0;f=aO(a5,D,m,a6)|0;c[a3>>2]=f;c[a3+4>>2]=D;a3=c[b$>>2]|0;f=c[b$+4>>2]|0;b$=c[a2>>2]|0;a6=c[a2+4>>2]|0;m=aY(a3,f,18,0)|0;a5=D;a4=aO(b$,a6,a3,f)|0;f=aO(a4,D,m,a5)|0;c[a2>>2]=f;c[a2+4>>2]=D;a2=c[A>>2]|0;f=c[A+4>>2]|0;A=c[a1>>2]|0;a5=c[a1+4>>2]|0;m=aY(a2,f,18,0)|0;a4=D;a3=aO(A,a5,a2,f)|0;f=aO(a3,D,m,a4)|0;c[a1>>2]=f;c[a1+4>>2]=D;a1=c[aA>>2]|0;f=c[aA+4>>2]|0;aA=c[a0>>2]|0;a4=c[a0+4>>2]|0;m=aY(a1,f,18,0)|0;a3=D;a2=aO(aA,a4,a1,f)|0;f=aO(a2,D,m,a3)|0;c[a0>>2]=f;c[a0+4>>2]=D;a0=c[a_>>2]|0;f=c[a_+4>>2]|0;a_=c[t>>2]|0;a3=c[t+4>>2]|0;m=aY(a0,f,18,0)|0;a2=D;a1=aO(a_,a3,a0,f)|0;f=aO(a1,D,m,a2)|0;c[t>>2]=f;c[t+4>>2]=D;aJ(t);aL(bf|0,I|0,80);I=c[ba>>2]|0;ba=H|0;c[ba>>2]=I;bf=H+4|0;c[bf>>2]=c[K+8>>2];t=H+8|0;c[t>>2]=c[K+16>>2];f=H+12|0;c[f>>2]=c[K+24>>2];a2=H+16|0;c[a2>>2]=c[K+32>>2];m=H+20|0;c[m>>2]=c[K+40>>2];a1=H+24|0;c[a1>>2]=c[K+48>>2];a0=H+28|0;c[a0>>2]=c[K+56>>2];a3=H+32|0;c[a3>>2]=c[K+64>>2];a_=H+36|0;c[a_>>2]=c[K+72>>2];K=0;a4=I;while(1){I=H+(K<<2)|0;aA=a4>>31&a4;if((K&1|0)==0){a5=aA>>26;c[I>>2]=$(a5,-67108864)+a4;A=H+(K+1<<2)|0;a6=(c[A>>2]|0)+a5|0;c[A>>2]=a6;b0=a6}else{a6=aA>>25;c[I>>2]=$(a6,-33554432)+a4;I=H+(K+1<<2)|0;aA=(c[I>>2]|0)+a6|0;c[I>>2]=aA;b0=aA}aA=K+1|0;if((aA|0)<9){K=aA;a4=b0}else{break}}b0=c[a_>>2]|0;a4=(b0>>31&b0)>>25;c[a_>>2]=$(a4,-33554432)+b0;b0=(a4*19&-1)+(c[ba>>2]|0)|0;c[ba>>2]=b0;a4=0;K=b0;while(1){b0=H+(a4<<2)|0;aA=K>>31&K;if((a4&1|0)==0){I=aA>>26;c[b0>>2]=$(I,-67108864)+K;a6=H+(a4+1<<2)|0;A=(c[a6>>2]|0)+I|0;c[a6>>2]=A;b1=A}else{A=aA>>25;c[b0>>2]=$(A,-33554432)+K;b0=H+(a4+1<<2)|0;aA=(c[b0>>2]|0)+A|0;c[b0>>2]=aA;b1=aA}aA=a4+1|0;if((aA|0)<9){a4=aA;K=b1}else{break}}b1=c[a_>>2]|0;K=(b1>>31&b1)>>25;c[a_>>2]=$(K,-33554432)+b1;b1=(K*19&-1)+(c[ba>>2]|0)|0;K=(b1>>31&b1)>>26;a4=$(K,-67108864)+b1|0;c[ba>>2]=a4;c[bf>>2]=K+(c[bf>>2]|0);K=0;b1=a4;while(1){a4=H+(K<<2)|0;if((K&1|0)==0){c[a4>>2]=b1&67108863;aA=H+(K+1<<2)|0;b0=(c[aA>>2]|0)+(b1>>26)|0;c[aA>>2]=b0;b2=b0}else{c[a4>>2]=b1&33554431;a4=H+(K+1<<2)|0;b0=(c[a4>>2]|0)+(b1>>25)|0;c[a4>>2]=b0;b2=b0}b0=K+1|0;if((b0|0)<9){K=b0;b1=b2}else{break}}b2=c[a_>>2]|0;c[a_>>2]=b2&33554431;b1=((b2>>25)*19&-1)+(c[ba>>2]|0)|0;c[ba>>2]=b1;b2=0;K=b1;while(1){b1=H+(b2<<2)|0;if((b2&1|0)==0){c[b1>>2]=K&67108863;b0=H+(b2+1<<2)|0;a4=(c[b0>>2]|0)+(K>>26)|0;c[b0>>2]=a4;b3=a4}else{c[b1>>2]=K&33554431;b1=H+(b2+1<<2)|0;a4=(c[b1>>2]|0)+(K>>25)|0;c[b1>>2]=a4;b3=a4}a4=b2+1|0;if((a4|0)<9){b2=a4;K=b3}else{break}}b3=c[a_>>2]|0;K=b3&33554431;c[a_>>2]=K;a_=((b3>>25)*19&-1)+(c[ba>>2]|0)|0;c[ba>>2]=a_;b3=a_-67108845>>31^-1;b2=1;do{a4=c[H+(b2<<2)>>2]|0;if((b2&1|0)==0){b1=a4^-67108864;b0=b1<<16&b1;b1=b0<<8&b0;b0=b1<<4&b1;b1=b0<<2&b0;b4=b1<<1&b1}else{b1=a4^-33554432;a4=b1<<16&b1;b1=a4<<8&a4;a4=b1<<4&b1;b1=a4<<2&a4;b4=b1<<1&b1}b3=b4>>31&b3;b2=b2+1|0;}while((b2|0)<10);b2=a_-(b3&67108845)|0;c[ba>>2]=b2;ba=b3&67108863;a_=b3&33554431;b4=(c[bf>>2]|0)-a_|0;bf=(c[t>>2]|0)-ba|0;t=(c[f>>2]|0)-a_|0;f=(c[a2>>2]|0)-b3|0;b3=(c[m>>2]|0)-a_|0;c[m>>2]=b3;m=(c[a1>>2]|0)-ba|0;a1=(c[a0>>2]|0)-a_|0;a0=(c[a3>>2]|0)-ba|0;ba=K-a_|0;a[b]=b2&255;a[b+1|0]=b2>>>8&255;a[b+2|0]=b2>>>16&255;a[b+3|0]=(b4<<2|b2>>>24)&255;a[b+4|0]=b4>>>6&255;a[b+5|0]=b4>>>14&255;a[b+6|0]=(bf<<3|b4>>>22)&255;a[b+7|0]=bf>>>5&255;a[b+8|0]=bf>>>13&255;a[b+9|0]=(t<<5|bf>>>21)&255;a[b+10|0]=t>>>3&255;a[b+11|0]=t>>>11&255;a[b+12|0]=(f<<6|t>>>19)&255;a[b+13|0]=f>>>2&255;a[b+14|0]=f>>>10&255;a[b+15|0]=f>>>18&255;a[b+16|0]=b3&255;a[b+17|0]=b3>>>8&255;a[b+18|0]=b3>>>16&255;a[b+19|0]=(m<<1|b3>>>24)&255;a[b+20|0]=m>>>7&255;a[b+21|0]=m>>>15&255;a[b+22|0]=(a1<<3|m>>>23)&255;a[b+23|0]=a1>>>5&255;a[b+24|0]=a1>>>13&255;a[b+25|0]=(a0<<4|a1>>>21)&255;a[b+26|0]=a0>>>4&255;a[b+27|0]=a0>>>12&255;a[b+28|0]=(a0>>>20|ba<<6)&255;a[b+29|0]=ba>>>2&255;a[b+30|0]=ba>>>10&255;a[b+31|0]=ba>>>18&255;i=g;return 0}function aI(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0;e=c[b>>2]|0;f=c[d>>2]|0;g=aY(f,(f|0)<0?-1:0,e,(e|0)<0?-1:0)|0;c[a>>2]=g;c[a+4>>2]=D;g=c[b>>2]|0;e=d+8|0;f=c[e>>2]|0;h=aY(f,(f|0)<0?-1:0,g,(g|0)<0?-1:0)|0;g=D;f=b+8|0;i=c[f>>2]|0;j=c[d>>2]|0;k=aY(j,(j|0)<0?-1:0,i,(i|0)<0?-1:0)|0;i=aO(k,D,h,g)|0;g=a+8|0;c[g>>2]=i;c[g+4>>2]=D;g=c[f>>2]|0;i=c[e>>2]|0;h=aY(i,(i|0)<0?-1:0,0>>>31|g<<1,g>>31|((g|0)<0?-1:0)<<1)|0;g=D;i=c[b>>2]|0;k=d+16|0;j=c[k>>2]|0;l=aY(j,(j|0)<0?-1:0,i,(i|0)<0?-1:0)|0;i=aO(l,D,h,g)|0;g=D;h=b+16|0;l=c[h>>2]|0;j=c[d>>2]|0;m=aY(j,(j|0)<0?-1:0,l,(l|0)<0?-1:0)|0;l=aO(i,g,m,D)|0;m=a+16|0;c[m>>2]=l;c[m+4>>2]=D;m=c[f>>2]|0;l=c[k>>2]|0;g=aY(l,(l|0)<0?-1:0,m,(m|0)<0?-1:0)|0;m=D;l=c[h>>2]|0;i=c[e>>2]|0;j=aY(i,(i|0)<0?-1:0,l,(l|0)<0?-1:0)|0;l=aO(j,D,g,m)|0;m=D;g=c[b>>2]|0;j=d+24|0;i=c[j>>2]|0;n=aY(i,(i|0)<0?-1:0,g,(g|0)<0?-1:0)|0;g=aO(l,m,n,D)|0;n=D;m=b+24|0;l=c[m>>2]|0;i=c[d>>2]|0;o=aY(i,(i|0)<0?-1:0,l,(l|0)<0?-1:0)|0;l=aO(g,n,o,D)|0;o=a+24|0;c[o>>2]=l;c[o+4>>2]=D;o=c[h>>2]|0;l=c[k>>2]|0;n=aY(l,(l|0)<0?-1:0,o,(o|0)<0?-1:0)|0;o=D;l=c[f>>2]|0;g=c[j>>2]|0;i=aY(g,(g|0)<0?-1:0,l,(l|0)<0?-1:0)|0;l=D;g=c[m>>2]|0;p=c[e>>2]|0;q=aY(p,(p|0)<0?-1:0,g,(g|0)<0?-1:0)|0;g=aO(q,D,i,l)|0;l=aO(g<<1|0>>>31,D<<1|g>>>31,n,o)|0;o=D;n=c[b>>2]|0;g=d+32|0;i=c[g>>2]|0;q=aY(i,(i|0)<0?-1:0,n,(n|0)<0?-1:0)|0;n=aO(l,o,q,D)|0;q=D;o=b+32|0;l=c[o>>2]|0;i=c[d>>2]|0;p=aY(i,(i|0)<0?-1:0,l,(l|0)<0?-1:0)|0;l=aO(n,q,p,D)|0;p=a+32|0;c[p>>2]=l;c[p+4>>2]=D;p=c[h>>2]|0;l=c[j>>2]|0;q=aY(l,(l|0)<0?-1:0,p,(p|0)<0?-1:0)|0;p=D;l=c[m>>2]|0;n=c[k>>2]|0;i=aY(n,(n|0)<0?-1:0,l,(l|0)<0?-1:0)|0;l=aO(i,D,q,p)|0;p=D;q=c[f>>2]|0;i=c[g>>2]|0;n=aY(i,(i|0)<0?-1:0,q,(q|0)<0?-1:0)|0;q=aO(l,p,n,D)|0;n=D;p=c[o>>2]|0;l=c[e>>2]|0;i=aY(l,(l|0)<0?-1:0,p,(p|0)<0?-1:0)|0;p=aO(q,n,i,D)|0;i=D;n=c[b>>2]|0;q=d+40|0;l=c[q>>2]|0;r=aY(l,(l|0)<0?-1:0,n,(n|0)<0?-1:0)|0;n=aO(p,i,r,D)|0;r=D;i=b+40|0;p=c[i>>2]|0;l=c[d>>2]|0;s=aY(l,(l|0)<0?-1:0,p,(p|0)<0?-1:0)|0;p=aO(n,r,s,D)|0;s=a+40|0;c[s>>2]=p;c[s+4>>2]=D;s=c[m>>2]|0;p=c[j>>2]|0;r=aY(p,(p|0)<0?-1:0,s,(s|0)<0?-1:0)|0;s=D;p=c[f>>2]|0;n=c[q>>2]|0;l=aY(n,(n|0)<0?-1:0,p,(p|0)<0?-1:0)|0;p=aO(l,D,r,s)|0;s=D;r=c[i>>2]|0;l=c[e>>2]|0;n=aY(l,(l|0)<0?-1:0,r,(r|0)<0?-1:0)|0;r=aO(p,s,n,D)|0;n=D<<1|r>>>31;s=c[h>>2]|0;p=c[g>>2]|0;l=aY(p,(p|0)<0?-1:0,s,(s|0)<0?-1:0)|0;s=aO(r<<1|0>>>31,n,l,D)|0;l=D;n=c[o>>2]|0;r=c[k>>2]|0;p=aY(r,(r|0)<0?-1:0,n,(n|0)<0?-1:0)|0;n=aO(s,l,p,D)|0;p=D;l=c[b>>2]|0;s=d+48|0;r=c[s>>2]|0;t=aY(r,(r|0)<0?-1:0,l,(l|0)<0?-1:0)|0;l=aO(n,p,t,D)|0;t=D;p=b+48|0;n=c[p>>2]|0;r=c[d>>2]|0;u=aY(r,(r|0)<0?-1:0,n,(n|0)<0?-1:0)|0;n=aO(l,t,u,D)|0;u=a+48|0;c[u>>2]=n;c[u+4>>2]=D;u=c[m>>2]|0;n=c[g>>2]|0;t=aY(n,(n|0)<0?-1:0,u,(u|0)<0?-1:0)|0;u=D;n=c[o>>2]|0;l=c[j>>2]|0;r=aY(l,(l|0)<0?-1:0,n,(n|0)<0?-1:0)|0;n=aO(r,D,t,u)|0;u=D;t=c[h>>2]|0;r=c[q>>2]|0;l=aY(r,(r|0)<0?-1:0,t,(t|0)<0?-1:0)|0;t=aO(n,u,l,D)|0;l=D;u=c[i>>2]|0;n=c[k>>2]|0;r=aY(n,(n|0)<0?-1:0,u,(u|0)<0?-1:0)|0;u=aO(t,l,r,D)|0;r=D;l=c[f>>2]|0;t=c[s>>2]|0;n=aY(t,(t|0)<0?-1:0,l,(l|0)<0?-1:0)|0;l=aO(u,r,n,D)|0;n=D;r=c[p>>2]|0;u=c[e>>2]|0;t=aY(u,(u|0)<0?-1:0,r,(r|0)<0?-1:0)|0;r=aO(l,n,t,D)|0;t=D;n=c[b>>2]|0;l=d+56|0;u=c[l>>2]|0;v=aY(u,(u|0)<0?-1:0,n,(n|0)<0?-1:0)|0;n=aO(r,t,v,D)|0;v=D;t=b+56|0;r=c[t>>2]|0;u=c[d>>2]|0;w=aY(u,(u|0)<0?-1:0,r,(r|0)<0?-1:0)|0;r=aO(n,v,w,D)|0;w=a+56|0;c[w>>2]=r;c[w+4>>2]=D;w=c[o>>2]|0;r=c[g>>2]|0;v=aY(r,(r|0)<0?-1:0,w,(w|0)<0?-1:0)|0;w=D;r=c[m>>2]|0;n=c[q>>2]|0;u=aY(n,(n|0)<0?-1:0,r,(r|0)<0?-1:0)|0;r=D;n=c[i>>2]|0;x=c[j>>2]|0;y=aY(x,(x|0)<0?-1:0,n,(n|0)<0?-1:0)|0;n=aO(y,D,u,r)|0;r=D;u=c[f>>2]|0;y=c[l>>2]|0;x=aY(y,(y|0)<0?-1:0,u,(u|0)<0?-1:0)|0;u=aO(n,r,x,D)|0;x=D;r=c[t>>2]|0;n=c[e>>2]|0;y=aY(n,(n|0)<0?-1:0,r,(r|0)<0?-1:0)|0;r=aO(u,x,y,D)|0;y=aO(r<<1|0>>>31,D<<1|r>>>31,v,w)|0;w=D;v=c[h>>2]|0;r=c[s>>2]|0;x=aY(r,(r|0)<0?-1:0,v,(v|0)<0?-1:0)|0;v=aO(y,w,x,D)|0;x=D;w=c[p>>2]|0;y=c[k>>2]|0;r=aY(y,(y|0)<0?-1:0,w,(w|0)<0?-1:0)|0;w=aO(v,x,r,D)|0;r=D;x=c[b>>2]|0;v=d+64|0;y=c[v>>2]|0;u=aY(y,(y|0)<0?-1:0,x,(x|0)<0?-1:0)|0;x=aO(w,r,u,D)|0;u=D;r=b+64|0;w=c[r>>2]|0;y=c[d>>2]|0;n=aY(y,(y|0)<0?-1:0,w,(w|0)<0?-1:0)|0;w=aO(x,u,n,D)|0;n=a+64|0;c[n>>2]=w;c[n+4>>2]=D;n=c[o>>2]|0;w=c[q>>2]|0;u=aY(w,(w|0)<0?-1:0,n,(n|0)<0?-1:0)|0;n=D;w=c[i>>2]|0;x=c[g>>2]|0;y=aY(x,(x|0)<0?-1:0,w,(w|0)<0?-1:0)|0;w=aO(y,D,u,n)|0;n=D;u=c[m>>2]|0;y=c[s>>2]|0;x=aY(y,(y|0)<0?-1:0,u,(u|0)<0?-1:0)|0;u=aO(w,n,x,D)|0;x=D;n=c[p>>2]|0;w=c[j>>2]|0;y=aY(w,(w|0)<0?-1:0,n,(n|0)<0?-1:0)|0;n=aO(u,x,y,D)|0;y=D;x=c[h>>2]|0;u=c[l>>2]|0;w=aY(u,(u|0)<0?-1:0,x,(x|0)<0?-1:0)|0;x=aO(n,y,w,D)|0;w=D;y=c[t>>2]|0;n=c[k>>2]|0;u=aY(n,(n|0)<0?-1:0,y,(y|0)<0?-1:0)|0;y=aO(x,w,u,D)|0;u=D;w=c[f>>2]|0;x=c[v>>2]|0;n=aY(x,(x|0)<0?-1:0,w,(w|0)<0?-1:0)|0;w=aO(y,u,n,D)|0;n=D;u=c[r>>2]|0;y=c[e>>2]|0;x=aY(y,(y|0)<0?-1:0,u,(u|0)<0?-1:0)|0;u=aO(w,n,x,D)|0;x=D;n=c[b>>2]|0;w=d+72|0;y=c[w>>2]|0;z=aY(y,(y|0)<0?-1:0,n,(n|0)<0?-1:0)|0;n=aO(u,x,z,D)|0;z=D;x=b+72|0;b=c[x>>2]|0;u=c[d>>2]|0;d=aY(u,(u|0)<0?-1:0,b,(b|0)<0?-1:0)|0;b=aO(n,z,d,D)|0;d=a+72|0;c[d>>2]=b;c[d+4>>2]=D;d=c[i>>2]|0;b=c[q>>2]|0;z=aY(b,(b|0)<0?-1:0,d,(d|0)<0?-1:0)|0;d=D;b=c[m>>2]|0;n=c[l>>2]|0;u=aY(n,(n|0)<0?-1:0,b,(b|0)<0?-1:0)|0;b=aO(u,D,z,d)|0;d=D;z=c[t>>2]|0;u=c[j>>2]|0;n=aY(u,(u|0)<0?-1:0,z,(z|0)<0?-1:0)|0;z=aO(b,d,n,D)|0;n=D;d=c[f>>2]|0;f=c[w>>2]|0;b=aY(f,(f|0)<0?-1:0,d,(d|0)<0?-1:0)|0;d=aO(z,n,b,D)|0;b=D;n=c[x>>2]|0;z=c[e>>2]|0;e=aY(z,(z|0)<0?-1:0,n,(n|0)<0?-1:0)|0;n=aO(d,b,e,D)|0;e=D<<1|n>>>31;b=c[o>>2]|0;d=c[s>>2]|0;z=aY(d,(d|0)<0?-1:0,b,(b|0)<0?-1:0)|0;b=aO(n<<1|0>>>31,e,z,D)|0;z=D;e=c[p>>2]|0;n=c[g>>2]|0;d=aY(n,(n|0)<0?-1:0,e,(e|0)<0?-1:0)|0;e=aO(b,z,d,D)|0;d=D;z=c[h>>2]|0;b=c[v>>2]|0;n=aY(b,(b|0)<0?-1:0,z,(z|0)<0?-1:0)|0;z=aO(e,d,n,D)|0;n=D;d=c[r>>2]|0;e=c[k>>2]|0;b=aY(e,(e|0)<0?-1:0,d,(d|0)<0?-1:0)|0;d=aO(z,n,b,D)|0;b=a+80|0;c[b>>2]=d;c[b+4>>2]=D;b=c[i>>2]|0;d=c[s>>2]|0;n=aY(d,(d|0)<0?-1:0,b,(b|0)<0?-1:0)|0;b=D;d=c[p>>2]|0;z=c[q>>2]|0;e=aY(z,(z|0)<0?-1:0,d,(d|0)<0?-1:0)|0;d=aO(e,D,n,b)|0;b=D;n=c[o>>2]|0;e=c[l>>2]|0;z=aY(e,(e|0)<0?-1:0,n,(n|0)<0?-1:0)|0;n=aO(d,b,z,D)|0;z=D;b=c[t>>2]|0;d=c[g>>2]|0;e=aY(d,(d|0)<0?-1:0,b,(b|0)<0?-1:0)|0;b=aO(n,z,e,D)|0;e=D;z=c[m>>2]|0;n=c[v>>2]|0;d=aY(n,(n|0)<0?-1:0,z,(z|0)<0?-1:0)|0;z=aO(b,e,d,D)|0;d=D;e=c[r>>2]|0;b=c[j>>2]|0;n=aY(b,(b|0)<0?-1:0,e,(e|0)<0?-1:0)|0;e=aO(z,d,n,D)|0;n=D;d=c[h>>2]|0;h=c[w>>2]|0;z=aY(h,(h|0)<0?-1:0,d,(d|0)<0?-1:0)|0;d=aO(e,n,z,D)|0;z=D;n=c[x>>2]|0;e=c[k>>2]|0;k=aY(e,(e|0)<0?-1:0,n,(n|0)<0?-1:0)|0;n=aO(d,z,k,D)|0;k=a+88|0;c[k>>2]=n;c[k+4>>2]=D;k=c[p>>2]|0;n=c[s>>2]|0;z=aY(n,(n|0)<0?-1:0,k,(k|0)<0?-1:0)|0;k=D;n=c[i>>2]|0;d=c[l>>2]|0;e=aY(d,(d|0)<0?-1:0,n,(n|0)<0?-1:0)|0;n=D;d=c[t>>2]|0;h=c[q>>2]|0;b=aY(h,(h|0)<0?-1:0,d,(d|0)<0?-1:0)|0;d=aO(b,D,e,n)|0;n=D;e=c[m>>2]|0;m=c[w>>2]|0;b=aY(m,(m|0)<0?-1:0,e,(e|0)<0?-1:0)|0;e=aO(d,n,b,D)|0;b=D;n=c[x>>2]|0;d=c[j>>2]|0;j=aY(d,(d|0)<0?-1:0,n,(n|0)<0?-1:0)|0;n=aO(e,b,j,D)|0;j=aO(n<<1|0>>>31,D<<1|n>>>31,z,k)|0;k=D;z=c[o>>2]|0;n=c[v>>2]|0;b=aY(n,(n|0)<0?-1:0,z,(z|0)<0?-1:0)|0;z=aO(j,k,b,D)|0;b=D;k=c[r>>2]|0;j=c[g>>2]|0;n=aY(j,(j|0)<0?-1:0,k,(k|0)<0?-1:0)|0;k=aO(z,b,n,D)|0;n=a+96|0;c[n>>2]=k;c[n+4>>2]=D;n=c[p>>2]|0;k=c[l>>2]|0;b=aY(k,(k|0)<0?-1:0,n,(n|0)<0?-1:0)|0;n=D;k=c[t>>2]|0;z=c[s>>2]|0;j=aY(z,(z|0)<0?-1:0,k,(k|0)<0?-1:0)|0;k=aO(j,D,b,n)|0;n=D;b=c[i>>2]|0;j=c[v>>2]|0;z=aY(j,(j|0)<0?-1:0,b,(b|0)<0?-1:0)|0;b=aO(k,n,z,D)|0;z=D;n=c[r>>2]|0;k=c[q>>2]|0;j=aY(k,(k|0)<0?-1:0,n,(n|0)<0?-1:0)|0;n=aO(b,z,j,D)|0;j=D;z=c[o>>2]|0;o=c[w>>2]|0;b=aY(o,(o|0)<0?-1:0,z,(z|0)<0?-1:0)|0;z=aO(n,j,b,D)|0;b=D;j=c[x>>2]|0;n=c[g>>2]|0;g=aY(n,(n|0)<0?-1:0,j,(j|0)<0?-1:0)|0;j=aO(z,b,g,D)|0;g=a+104|0;c[g>>2]=j;c[g+4>>2]=D;g=c[t>>2]|0;j=c[l>>2]|0;b=aY(j,(j|0)<0?-1:0,g,(g|0)<0?-1:0)|0;g=D;j=c[i>>2]|0;i=c[w>>2]|0;z=aY(i,(i|0)<0?-1:0,j,(j|0)<0?-1:0)|0;j=aO(z,D,b,g)|0;g=D;b=c[x>>2]|0;z=c[q>>2]|0;q=aY(z,(z|0)<0?-1:0,b,(b|0)<0?-1:0)|0;b=aO(j,g,q,D)|0;q=D<<1|b>>>31;g=c[p>>2]|0;j=c[v>>2]|0;z=aY(j,(j|0)<0?-1:0,g,(g|0)<0?-1:0)|0;g=aO(b<<1|0>>>31,q,z,D)|0;z=D;q=c[r>>2]|0;b=c[s>>2]|0;j=aY(b,(b|0)<0?-1:0,q,(q|0)<0?-1:0)|0;q=aO(g,z,j,D)|0;j=a+112|0;c[j>>2]=q;c[j+4>>2]=D;j=c[t>>2]|0;q=c[v>>2]|0;z=aY(q,(q|0)<0?-1:0,j,(j|0)<0?-1:0)|0;j=D;q=c[r>>2]|0;g=c[l>>2]|0;b=aY(g,(g|0)<0?-1:0,q,(q|0)<0?-1:0)|0;q=aO(b,D,z,j)|0;j=D;z=c[p>>2]|0;p=c[w>>2]|0;b=aY(p,(p|0)<0?-1:0,z,(z|0)<0?-1:0)|0;z=aO(q,j,b,D)|0;b=D;j=c[x>>2]|0;q=c[s>>2]|0;s=aY(q,(q|0)<0?-1:0,j,(j|0)<0?-1:0)|0;j=aO(z,b,s,D)|0;s=a+120|0;c[s>>2]=j;c[s+4>>2]=D;s=c[r>>2]|0;j=c[v>>2]|0;b=aY(j,(j|0)<0?-1:0,s,(s|0)<0?-1:0)|0;s=D;j=c[t>>2]|0;t=c[w>>2]|0;z=aY(t,(t|0)<0?-1:0,j,(j|0)<0?-1:0)|0;j=D;t=c[x>>2]|0;q=c[l>>2]|0;l=aY(q,(q|0)<0?-1:0,t,(t|0)<0?-1:0)|0;t=aO(l,D,z,j)|0;j=aO(t<<1|0>>>31,D<<1|t>>>31,b,s)|0;s=a+128|0;c[s>>2]=j;c[s+4>>2]=D;s=c[r>>2]|0;r=c[w>>2]|0;j=aY(r,(r|0)<0?-1:0,s,(s|0)<0?-1:0)|0;s=D;r=c[x>>2]|0;b=c[v>>2]|0;v=aY(b,(b|0)<0?-1:0,r,(r|0)<0?-1:0)|0;r=aO(v,D,j,s)|0;s=a+136|0;c[s>>2]=r;c[s+4>>2]=D;s=c[x>>2]|0;x=c[w>>2]|0;w=aY(x,(x|0)<0?-1:0,0>>>31|s<<1,s>>31|((s|0)<0?-1:0)<<1)|0;s=a+144|0;c[s>>2]=w;c[s+4>>2]=D;return}function aJ(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0;b=a+80|0;c[b>>2]=0;c[b+4>>2]=0;d=0;e=c[a+4>>2]|0;f=c[a>>2]|0;do{g=a+(d<<3)|0;h=aO(e>>31>>>6,0,f,e)|0;i=D;j=h>>>26|i<<6;h=i>>26|((i|0)<0?-1:0)<<6;i=aP(f,e,j<<26|0>>>6,h<<26|j>>>6)|0;c[g>>2]=i;c[g+4>>2]=D;g=a+((d|1)<<3)|0;i=aO(j,h,c[g>>2]|0,c[g+4>>2]|0)|0;h=D;j=aO(h>>31>>>7,0,i,h)|0;k=D;l=j>>>25|k<<7;j=k>>25|((k|0)<0?-1:0)<<7;k=aP(i,h,l<<25|0>>>7,j<<25|l>>>7)|0;c[g>>2]=k;c[g+4>>2]=D;d=d+2|0;g=a+(d<<3)|0;f=aO(l,j,c[g>>2]|0,c[g+4>>2]|0)|0;e=D;c[g>>2]=f;c[g+4>>2]=e;}while(d>>>0<10);d=c[b>>2]|0;e=c[b+4>>2]|0;f=aO(c[a>>2]|0,c[a+4>>2]|0,d<<4|0>>>28,e<<4|d>>>28)|0;g=aO(d<<1|0>>>31,e<<1|d>>>31,f,D)|0;f=aO(g,D,d,e)|0;e=D;c[b>>2]=0;c[b+4>>2]=0;b=aO(e>>31>>>6,0,f,e)|0;d=D;g=b>>>26|d<<6;b=d>>26|((d|0)<0?-1:0)<<6;d=aP(f,e,g<<26|0>>>6,b<<26|g>>>6)|0;c[a>>2]=d;c[a+4>>2]=D;d=a+8|0;a=aO(g,b,c[d>>2]|0,c[d+4>>2]|0)|0;c[d>>2]=a;c[d+4>>2]=D;return}function aK(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0,L=0,M=0,N=0,O=0,P=0,Q=0,R=0,S=0,T=0,U=0,V=0,W=0,X=0,Y=0,Z=0,_=0,$=0,aa=0,ab=0,ac=0,ad=0,ae=0,af=0,ag=0,ah=0,ai=0,aj=0,ak=0,al=0;d=i;i=i+152|0;e=d|0;f=e|0;g=c[b>>2]|0;h=g;j=(g|0)<0?-1:0;k=aY(h,j,h,j)|0;l=D;m=0>>>31|g<<1;n=g>>31|((g|0)<0?-1:0)<<1;g=0;o=c[b+8>>2]|0;p=o;q=(o|0)<0?-1:0;r=aY(p,q,m,n)|0;s=D;t=e+8|0;u=aY(p,q,p,q)|0;v=D;w=c[b+16>>2]|0;x=w;y=(w|0)<0?-1:0;w=aY(x,y,h,j)|0;z=aO(w,D,u,v)|0;v=D<<1|z>>>31;u=e+16|0;w=aY(x,y,p,q)|0;A=D;B=c[b+24>>2]|0;C=B;E=(B|0)<0?-1:0;B=aY(C,E,h,j)|0;F=aO(B,D,w,A)|0;A=D<<1|F>>>31;w=e+24|0;B=aY(x,y,x,y)|0;G=D;H=aY(C,E,g>>>30|o<<2,o>>30|((o|0)<0?-1:0)<<2)|0;I=aO(H,D,B,G)|0;G=D;B=c[b+32>>2]|0;H=B;J=(B|0)<0?-1:0;B=aY(H,J,m,n)|0;n=aO(I,G,B,D)|0;B=D;G=e+32|0;I=aY(C,E,x,y)|0;m=D;K=aY(H,J,p,q)|0;L=aO(K,D,I,m)|0;m=D;I=c[b+40>>2]|0;K=I;M=(I|0)<0?-1:0;N=aY(K,M,h,j)|0;O=aO(L,m,N,D)|0;N=D<<1|O>>>31;m=e+40|0;L=aY(C,E,C,E)|0;P=D;Q=aY(H,J,x,y)|0;R=aO(Q,D,L,P)|0;P=D;L=c[b+48>>2]|0;Q=L;S=(L|0)<0?-1:0;L=aY(Q,S,h,j)|0;T=aO(R,P,L,D)|0;L=D;P=aY(K,M,g>>>31|o<<1,o>>31|((o|0)<0?-1:0)<<1)|0;o=aO(T,L,P,D)|0;P=D<<1|o>>>31;L=e+48|0;T=aY(H,J,C,E)|0;g=D;R=aY(K,M,x,y)|0;U=aO(R,D,T,g)|0;g=D;T=aY(Q,S,p,q)|0;R=aO(U,g,T,D)|0;T=D;g=c[b+56>>2]|0;U=g;V=(g|0)<0?-1:0;W=aY(U,V,h,j)|0;X=aO(R,T,W,D)|0;W=D<<1|X>>>31;T=e+56|0;R=aY(H,J,H,J)|0;Y=D;Z=aY(Q,S,x,y)|0;_=D;$=c[b+64>>2]|0;aa=$;ab=($|0)<0?-1:0;ac=aY(aa,ab,h,j)|0;ad=aO(ac,D,Z,_)|0;_=D;Z=aY(U,V,p,q)|0;ac=D;ae=aY(K,M,C,E)|0;af=aO(ae,D,Z,ac)|0;ac=aO(ad,_,af<<1|0>>>31,D<<1|af>>>31)|0;af=aO(ac<<1|0>>>31,D<<1|ac>>>31,R,Y)|0;Y=D;R=e+64|0;ac=aY(K,M,H,J)|0;_=D;ad=aY(Q,S,C,E)|0;Z=aO(ad,D,ac,_)|0;_=D;ac=aY(U,V,x,y)|0;ad=aO(Z,_,ac,D)|0;ac=D;_=aY(aa,ab,p,q)|0;Z=aO(ad,ac,_,D)|0;_=D;ac=c[b+72>>2]|0;b=ac;ad=(ac|0)<0?-1:0;ae=aY(b,ad,h,j)|0;j=aO(Z,_,ae,D)|0;ae=e+72|0;c[ae>>2]=j<<1|0>>>31;c[ae+4>>2]=D<<1|j>>>31;j=aY(K,M,K,M)|0;ae=D;_=aY(Q,S,H,J)|0;Z=aO(_,D,j,ae)|0;ae=D;j=aY(aa,ab,x,y)|0;_=aO(Z,ae,j,D)|0;j=D;ae=aY(U,V,C,E)|0;Z=D;h=aY(b,ad,p,q)|0;q=aO(h,D,ae,Z)|0;Z=aO(_,j,q<<1|0>>>31,D<<1|q>>>31)|0;q=D;j=Z<<1|0>>>31;_=q<<1|Z>>>31;ae=e+80|0;c[ae>>2]=j;c[ae+4>>2]=_;ae=aY(Q,S,K,M)|0;h=D;p=aY(U,V,H,J)|0;ag=aO(p,D,ae,h)|0;h=D;ae=aY(aa,ab,C,E)|0;p=aO(ag,h,ae,D)|0;ae=D;h=aY(b,ad,x,y)|0;y=aO(p,ae,h,D)|0;h=D;ae=y<<1|0>>>31;p=h<<1|y>>>31;x=e+88|0;c[x>>2]=ae;c[x+4>>2]=p;x=aY(Q,S,Q,S)|0;ag=D;ah=aY(aa,ab,H,J)|0;ai=D;aj=aY(U,V,K,M)|0;ak=D;al=aY(b,ad,C,E)|0;E=aO(al,D,aj,ak)|0;ak=aO(E<<1|0>>>31,D<<1|E>>>31,ah,ai)|0;ai=aO(ak<<1|0>>>31,D<<1|ak>>>31,x,ag)|0;ag=D;x=e+96|0;c[x>>2]=ai;c[x+4>>2]=ag;x=aY(U,V,Q,S)|0;ak=D;ah=aY(aa,ab,K,M)|0;M=aO(ah,D,x,ak)|0;ak=D;x=aY(b,ad,H,J)|0;J=aO(M,ak,x,D)|0;x=D;ak=J<<1|0>>>31;M=x<<1|J>>>31;H=e+104|0;c[H>>2]=ak;c[H+4>>2]=M;H=aY(U,V,U,V)|0;ah=D;K=aY(aa,ab,Q,S)|0;E=aO(K,D,H,ah)|0;ah=D;H=aY(b,ad,0>>>31|I<<1,I>>31|((I|0)<0?-1:0)<<1)|0;I=aO(E,ah,H,D)|0;H=D;ah=I<<1|0>>>31;E=H<<1|I>>>31;K=e+112|0;c[K>>2]=ah;c[K+4>>2]=E;K=aY(aa,ab,U,V)|0;V=D;U=aY(b,ad,Q,S)|0;S=aO(U,D,K,V)|0;V=D;K=S<<1|0>>>31;U=V<<1|S>>>31;Q=e+120|0;c[Q>>2]=K;c[Q+4>>2]=U;Q=aY(aa,ab,aa,ab)|0;ab=D;aa=aY(b,ad,0>>>30|g<<2,g>>30|((g|0)<0?-1:0)<<2)|0;g=aO(aa,D,Q,ab)|0;ab=D;Q=e+128|0;c[Q>>2]=g;c[Q+4>>2]=ab;Q=aY(b,ad,0>>>31|$<<1,$>>31|(($|0)<0?-1:0)<<1)|0;$=D;aa=e+136|0;c[aa>>2]=Q;c[aa+4>>2]=$;aa=aY(0>>>31|ac<<1,ac>>31|((ac|0)<0?-1:0)<<1,b,ad)|0;ad=D;b=e+144|0;c[b>>2]=aa;c[b+4>>2]=ad;b=aY(aa,ad,18,0)|0;ac=D;aj=aO(aa,ad,af,Y)|0;Y=aO(aj,D,b,ac)|0;c[R>>2]=Y;c[R+4>>2]=D;R=aY(Q,$,18,0)|0;Y=D;ac=aO(X<<1|0>>>31,W,Q,$)|0;$=aO(ac,D,R,Y)|0;c[T>>2]=$;c[T+4>>2]=D;T=aY(g,ab,18,0)|0;$=D;Y=aO(o<<1|0>>>31,P,g,ab)|0;ab=aO(Y,D,T,$)|0;c[L>>2]=ab;c[L+4>>2]=D;L=aY(S,V,36,0)|0;V=D;S=aO(O<<1|0>>>31,N,K,U)|0;U=aO(S,D,L,V)|0;c[m>>2]=U;c[m+4>>2]=D;m=aY(I,H,36,0)|0;H=D;I=aO(n,B,ah,E)|0;E=aO(I,D,m,H)|0;c[G>>2]=E;c[G+4>>2]=D;G=aY(J,x,36,0)|0;x=D;J=aO(F<<1|0>>>31,A,ak,M)|0;M=aO(J,D,G,x)|0;c[w>>2]=M;c[w+4>>2]=D;w=aY(ai,ag,18,0)|0;M=D;x=aO(z<<1|0>>>31,v,ai,ag)|0;ag=aO(x,D,w,M)|0;c[u>>2]=ag;c[u+4>>2]=D;u=aY(y,h,36,0)|0;h=D;y=aO(r,s,ae,p)|0;p=aO(y,D,u,h)|0;c[t>>2]=p;c[t+4>>2]=D;t=aY(Z,q,36,0)|0;q=D;Z=aO(k,l,j,_)|0;_=aO(Z,D,t,q)|0;c[f>>2]=_;c[f+4>>2]=D;aJ(f);aL(a|0,e|0,80);i=d;return}function aL(b,d,e){b=b|0;d=d|0;e=e|0;var f=0;f=b|0;if((b&3)==(d&3)){while(b&3){if((e|0)==0)return f|0;a[b]=a[d]|0;b=b+1|0;d=d+1|0;e=e-1|0}while((e|0)>=4){c[b>>2]=c[d>>2];b=b+4|0;d=d+4|0;e=e-4|0}}while((e|0)>0){a[b]=a[d]|0;b=b+1|0;d=d+1|0;e=e-1|0}return f|0}function aM(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0;f=b+e|0;if((e|0)>=20){d=d&255;e=b&3;g=d|d<<8|d<<16|d<<24;h=f&~3;if(e){e=b+4-e|0;while((b|0)<(e|0)){a[b]=d;b=b+1|0}}while((b|0)<(h|0)){c[b>>2]=g;b=b+4|0}}while((b|0)<(f|0)){a[b]=d;b=b+1|0}}function aN(b){b=b|0;var c=0;c=b;while(a[c]|0){c=c+1|0}return c-b|0}function aO(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;var e=0;e=a+c>>>0;return(D=b+d+(e>>>0<a>>>0|0)>>>0,e|0)|0}function aP(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;var e=0;e=b-d>>>0;e=b-d-(c>>>0>a>>>0|0)>>>0;return(D=e,a-c>>>0|0)|0}function aQ(a,b,c){a=a|0;b=b|0;c=c|0;if((c|0)<32){D=b<<c|(a&(1<<c)-1<<32-c)>>>32-c;return a<<c}D=a<<c-32;return 0}function aR(a,b,c){a=a|0;b=b|0;c=c|0;if((c|0)<32){D=b>>>c;return a>>>c|(b&(1<<c)-1)<<32-c}D=0;return b>>>c-32|0}function aS(a,b,c){a=a|0;b=b|0;c=c|0;if((c|0)<32){D=b>>c;return a>>>c|(b&(1<<c)-1)<<32-c}D=(b|0)<0?-1:0;return b>>c-32|0}function aT(b){b=b|0;var c=0;c=a[n+(b>>>24)|0]|0;if((c|0)<8)return c|0;c=a[n+(b>>16&255)|0]|0;if((c|0)<8)return c+8|0;c=a[n+(b>>8&255)|0]|0;if((c|0)<8)return c+16|0;return(a[n+(b&255)|0]|0)+24|0}function aU(b){b=b|0;var c=0;c=a[m+(b&255)|0]|0;if((c|0)<8)return c|0;c=a[m+(b>>8&255)|0]|0;if((c|0)<8)return c+8|0;c=a[m+(b>>16&255)|0]|0;if((c|0)<8)return c+16|0;return(a[m+(b>>>24)|0]|0)+24|0}function aV(a,b){a=a|0;b=b|0;var c=0,d=0,e=0,f=0;c=a&65535;d=b&65535;e=$(d,c);f=a>>>16;a=(e>>>16)+$(d,f)|0;d=b>>>16;b=$(d,c);return(D=((a>>>16)+$(d,f)|0)+(((a&65535)+b|0)>>>16)|0,0|(a+b<<16|e&65535))|0}function aW(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;var e=0,f=0,g=0,h=0,i=0;e=b>>31|((b|0)<0?-1:0)<<1;f=((b|0)<0?-1:0)>>31|((b|0)<0?-1:0)<<1;g=d>>31|((d|0)<0?-1:0)<<1;h=((d|0)<0?-1:0)>>31|((d|0)<0?-1:0)<<1;i=aP(e^a,f^b,e,f)|0;b=D;a=g^e;e=h^f;f=aP(a$(i,b,aP(g^c,h^d,g,h)|0,D,0)^a,D^e,a,e)|0;return(D=D,f)|0}function aX(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,j=0,k=0,l=0,m=0;f=i;i=i+8|0;g=f|0;h=b>>31|((b|0)<0?-1:0)<<1;j=((b|0)<0?-1:0)>>31|((b|0)<0?-1:0)<<1;k=e>>31|((e|0)<0?-1:0)<<1;l=((e|0)<0?-1:0)>>31|((e|0)<0?-1:0)<<1;m=aP(h^a,j^b,h,j)|0;b=D;a$(m,b,aP(k^d,l^e,k,l)|0,D,g);l=aP(c[g>>2]^h,c[g+4>>2]^j,h,j)|0;j=D;i=f;return(D=j,l)|0}function aY(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;var e=0,f=0;e=a;a=c;c=aV(e,a)|0;f=D;return(D=($(b,a)+$(d,e)|0)+f|f&0,0|c&-1)|0}function aZ(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;var e=0;e=a$(a,b,c,d,0)|0;return(D=D,e)|0}function a_(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0;f=i;i=i+8|0;g=f|0;a$(a,b,d,e,g);i=f;return(D=c[g+4>>2]|0,c[g>>2]|0)|0}function a$(a,b,d,e,f){a=a|0;b=b|0;d=d|0;e=e|0;f=f|0;var g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0,L=0,M=0;g=a;h=b;i=h;j=d;k=e;l=k;if((i|0)==0){m=(f|0)!=0;if((l|0)==0){if(m){c[f>>2]=(g>>>0)%(j>>>0);c[f+4>>2]=0}n=0;o=(g>>>0)/(j>>>0)>>>0;return(D=n,o)|0}else{if(!m){n=0;o=0;return(D=n,o)|0}c[f>>2]=a&-1;c[f+4>>2]=b&0;n=0;o=0;return(D=n,o)|0}}m=(l|0)==0;do{if((j|0)==0){if(m){if((f|0)!=0){c[f>>2]=(i>>>0)%(j>>>0);c[f+4>>2]=0}n=0;o=(i>>>0)/(j>>>0)>>>0;return(D=n,o)|0}if((g|0)==0){if((f|0)!=0){c[f>>2]=0;c[f+4>>2]=(i>>>0)%(l>>>0)}n=0;o=(i>>>0)/(l>>>0)>>>0;return(D=n,o)|0}p=l-1|0;if((p&l|0)==0){if((f|0)!=0){c[f>>2]=a&-1;c[f+4>>2]=p&i|b&0}n=0;o=i>>>((aU(l|0)|0)>>>0);return(D=n,o)|0}p=(aT(l|0)|0)-(aT(i|0)|0)|0;if(p>>>0<=30){q=p+1|0;r=31-p|0;s=q;t=i<<r|g>>>(q>>>0);u=i>>>(q>>>0);v=0;w=g<<r;break}if((f|0)==0){n=0;o=0;return(D=n,o)|0}c[f>>2]=a&-1;c[f+4>>2]=h|b&0;n=0;o=0;return(D=n,o)|0}else{if(!m){r=(aT(l|0)|0)-(aT(i|0)|0)|0;if(r>>>0<=31){q=r+1|0;p=31-r|0;x=r-31>>31;s=q;t=g>>>(q>>>0)&x|i<<p;u=i>>>(q>>>0)&x;v=0;w=g<<p;break}if((f|0)==0){n=0;o=0;return(D=n,o)|0}c[f>>2]=a&-1;c[f+4>>2]=h|b&0;n=0;o=0;return(D=n,o)|0}p=j-1|0;if((p&j|0)!=0){x=((aT(j|0)|0)+33|0)-(aT(i|0)|0)|0;q=64-x|0;r=32-x|0;y=r>>31;z=x-32|0;A=z>>31;s=x;t=r-1>>31&i>>>(z>>>0)|(i<<r|g>>>(x>>>0))&A;u=A&i>>>(x>>>0);v=g<<q&y;w=(i<<q|g>>>(z>>>0))&y|g<<r&x-33>>31;break}if((f|0)!=0){c[f>>2]=p&g;c[f+4>>2]=0}if((j|0)==1){n=h|b&0;o=a&-1|0;return(D=n,o)|0}else{p=aU(j|0)|0;n=i>>>(p>>>0)|0;o=i<<32-p|g>>>(p>>>0)|0;return(D=n,o)|0}}}while(0);if((s|0)==0){B=w;C=v;E=u;F=t;G=0;H=0}else{g=d&-1|0;d=k|e&0;e=aO(g,d,-1,-1)|0;k=D;i=w;w=v;v=u;u=t;t=s;s=0;while(1){I=w>>>31|i<<1;J=s|w<<1;j=u<<1|i>>>31|0;a=u>>>31|v<<1|0;aP(e,k,j,a);b=D;h=b>>31|((b|0)<0?-1:0)<<1;K=h&1;L=aP(j,a,h&g,(((b|0)<0?-1:0)>>31|((b|0)<0?-1:0)<<1)&d)|0;M=D;b=t-1|0;if((b|0)==0){break}else{i=I;w=J;v=M;u=L;t=b;s=K}}B=I;C=J;E=M;F=L;G=0;H=K}K=C;C=0;if((f|0)!=0){c[f>>2]=F;c[f+4>>2]=E}n=(0|K)>>>31|(B|C)<<1|(C<<1|K>>>31)&0|G;o=(K<<1|0>>>31)&-2|H;return(D=n,o)|0}function a0(a,b){a=a|0;b=b|0;return ap[a&1](b|0)|0}function a1(a){a=a|0;aq[a&1]()}function a2(a,b,c){a=a|0;b=b|0;c=c|0;return ar[a&1](b|0,c|0)|0}function a3(a,b){a=a|0;b=b|0;as[a&1](b|0)}function a4(a){a=a|0;aa(0);return 0}function a5(){aa(1)}function a6(a,b){a=a|0;b=b|0;aa(2);return 0}function a7(a){a=a|0;aa(3)}
// EMSCRIPTEN_END_FUNCS
var ap=[a4,a4];var aq=[a5,a5];var ar=[a6,a6];var as=[a7,a7];return{_curve25519_donna:aH,_memcpy:aL,_strlen:aN,_memset:aM,stackAlloc:at,stackSave:au,stackRestore:av,setThrew:aw,setTempRet0:ax,setTempRet1:ay,setTempRet2:az,setTempRet3:aA,setTempRet4:aB,setTempRet5:aC,setTempRet6:aD,setTempRet7:aE,setTempRet8:aF,setTempRet9:aG,dynCall_ii:a0,dynCall_v:a1,dynCall_iii:a2,dynCall_vi:a3}})
// EMSCRIPTEN_END_ASM
({ "Math": Math, "Int8Array": Int8Array, "Int16Array": Int16Array, "Int32Array": Int32Array, "Uint8Array": Uint8Array, "Uint16Array": Uint16Array, "Uint32Array": Uint32Array, "Float32Array": Float32Array, "Float64Array": Float64Array }, { "abort": abort, "assert": assert, "asmPrintInt": asmPrintInt, "asmPrintFloat": asmPrintFloat, "copyTempDouble": copyTempDouble, "copyTempFloat": copyTempFloat, "min": Math_min, "invoke_ii": invoke_ii, "invoke_v": invoke_v, "invoke_iii": invoke_iii, "invoke_vi": invoke_vi, "_llvm_lifetime_end": _llvm_lifetime_end, "_malloc": _malloc, "_free": _free, "_llvm_lifetime_start": _llvm_lifetime_start, "STACKTOP": STACKTOP, "STACK_MAX": STACK_MAX, "tempDoublePtr": tempDoublePtr, "ABORT": ABORT, "cttz_i8": cttz_i8, "ctlz_i8": ctlz_i8, "NaN": NaN, "Infinity": Infinity }, buffer);
var _curve25519_donna = Module["_curve25519_donna"] = asm["_curve25519_donna"];
var _memcpy = Module["_memcpy"] = asm["_memcpy"];
var _strlen = Module["_strlen"] = asm["_strlen"];
var _memset = Module["_memset"] = asm["_memset"];
var dynCall_ii = Module["dynCall_ii"] = asm["dynCall_ii"];
var dynCall_v = Module["dynCall_v"] = asm["dynCall_v"];
var dynCall_iii = Module["dynCall_iii"] = asm["dynCall_iii"];
var dynCall_vi = Module["dynCall_vi"] = asm["dynCall_vi"];
Runtime.stackAlloc = function(size) { return asm['stackAlloc'](size) };
Runtime.stackSave = function() { return asm['stackSave']() };
Runtime.stackRestore = function(top) { asm['stackRestore'](top) };
// TODO: strip out parts of this we do not need
//======= begin closure i64 code =======
// Copyright 2009 The Closure Library Authors. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS-IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
/**
 * @fileoverview Defines a Long class for representing a 64-bit two's-complement
 * integer value, which faithfully simulates the behavior of a Java "long". This
 * implementation is derived from LongLib in GWT.
 *
 */
var i64Math = (function() { // Emscripten wrapper
  var goog = { math: {} };
  /**
   * Constructs a 64-bit two's-complement integer, given its low and high 32-bit
   * values as *signed* integers.  See the from* functions below for more
   * convenient ways of constructing Longs.
   *
   * The internal representation of a long is the two given signed, 32-bit values.
   * We use 32-bit pieces because these are the size of integers on which
   * Javascript performs bit-operations.  For operations like addition and
   * multiplication, we split each number into 16-bit pieces, which can easily be
   * multiplied within Javascript's floating-point representation without overflow
   * or change in sign.
   *
   * In the algorithms below, we frequently reduce the negative case to the
   * positive case by negating the input(s) and then post-processing the result.
   * Note that we must ALWAYS check specially whether those values are MIN_VALUE
   * (-2^63) because -MIN_VALUE == MIN_VALUE (since 2^63 cannot be represented as
   * a positive number, it overflows back into a negative).  Not handling this
   * case would often result in infinite recursion.
   *
   * @param {number} low  The low (signed) 32 bits of the long.
   * @param {number} high  The high (signed) 32 bits of the long.
   * @constructor
   */
  goog.math.Long = function(low, high) {
    /**
     * @type {number}
     * @private
     */
    this.low_ = low | 0;  // force into 32 signed bits.
    /**
     * @type {number}
     * @private
     */
    this.high_ = high | 0;  // force into 32 signed bits.
  };
  // NOTE: Common constant values ZERO, ONE, NEG_ONE, etc. are defined below the
  // from* methods on which they depend.
  /**
   * A cache of the Long representations of small integer values.
   * @type {!Object}
   * @private
   */
  goog.math.Long.IntCache_ = {};
  /**
   * Returns a Long representing the given (32-bit) integer value.
   * @param {number} value The 32-bit integer in question.
   * @return {!goog.math.Long} The corresponding Long value.
   */
  goog.math.Long.fromInt = function(value) {
    if (-128 <= value && value < 128) {
      var cachedObj = goog.math.Long.IntCache_[value];
      if (cachedObj) {
        return cachedObj;
      }
    }
    var obj = new goog.math.Long(value | 0, value < 0 ? -1 : 0);
    if (-128 <= value && value < 128) {
      goog.math.Long.IntCache_[value] = obj;
    }
    return obj;
  };
  /**
   * Returns a Long representing the given value, provided that it is a finite
   * number.  Otherwise, zero is returned.
   * @param {number} value The number in question.
   * @return {!goog.math.Long} The corresponding Long value.
   */
  goog.math.Long.fromNumber = function(value) {
    if (isNaN(value) || !isFinite(value)) {
      return goog.math.Long.ZERO;
    } else if (value <= -goog.math.Long.TWO_PWR_63_DBL_) {
      return goog.math.Long.MIN_VALUE;
    } else if (value + 1 >= goog.math.Long.TWO_PWR_63_DBL_) {
      return goog.math.Long.MAX_VALUE;
    } else if (value < 0) {
      return goog.math.Long.fromNumber(-value).negate();
    } else {
      return new goog.math.Long(
          (value % goog.math.Long.TWO_PWR_32_DBL_) | 0,
          (value / goog.math.Long.TWO_PWR_32_DBL_) | 0);
    }
  };
  /**
   * Returns a Long representing the 64-bit integer that comes by concatenating
   * the given high and low bits.  Each is assumed to use 32 bits.
   * @param {number} lowBits The low 32-bits.
   * @param {number} highBits The high 32-bits.
   * @return {!goog.math.Long} The corresponding Long value.
   */
  goog.math.Long.fromBits = function(lowBits, highBits) {
    return new goog.math.Long(lowBits, highBits);
  };
  /**
   * Returns a Long representation of the given string, written using the given
   * radix.
   * @param {string} str The textual representation of the Long.
   * @param {number=} opt_radix The radix in which the text is written.
   * @return {!goog.math.Long} The corresponding Long value.
   */
  goog.math.Long.fromString = function(str, opt_radix) {
    if (str.length == 0) {
      throw Error('number format error: empty string');
    }
    var radix = opt_radix || 10;
    if (radix < 2 || 36 < radix) {
      throw Error('radix out of range: ' + radix);
    }
    if (str.charAt(0) == '-') {
      return goog.math.Long.fromString(str.substring(1), radix).negate();
    } else if (str.indexOf('-') >= 0) {
      throw Error('number format error: interior "-" character: ' + str);
    }
    // Do several (8) digits each time through the loop, so as to
    // minimize the calls to the very expensive emulated div.
    var radixToPower = goog.math.Long.fromNumber(Math.pow(radix, 8));
    var result = goog.math.Long.ZERO;
    for (var i = 0; i < str.length; i += 8) {
      var size = Math.min(8, str.length - i);
      var value = parseInt(str.substring(i, i + size), radix);
      if (size < 8) {
        var power = goog.math.Long.fromNumber(Math.pow(radix, size));
        result = result.multiply(power).add(goog.math.Long.fromNumber(value));
      } else {
        result = result.multiply(radixToPower);
        result = result.add(goog.math.Long.fromNumber(value));
      }
    }
    return result;
  };
  // NOTE: the compiler should inline these constant values below and then remove
  // these variables, so there should be no runtime penalty for these.
  /**
   * Number used repeated below in calculations.  This must appear before the
   * first call to any from* function below.
   * @type {number}
   * @private
   */
  goog.math.Long.TWO_PWR_16_DBL_ = 1 << 16;
  /**
   * @type {number}
   * @private
   */
  goog.math.Long.TWO_PWR_24_DBL_ = 1 << 24;
  /**
   * @type {number}
   * @private
   */
  goog.math.Long.TWO_PWR_32_DBL_ =
      goog.math.Long.TWO_PWR_16_DBL_ * goog.math.Long.TWO_PWR_16_DBL_;
  /**
   * @type {number}
   * @private
   */
  goog.math.Long.TWO_PWR_31_DBL_ =
      goog.math.Long.TWO_PWR_32_DBL_ / 2;
  /**
   * @type {number}
   * @private
   */
  goog.math.Long.TWO_PWR_48_DBL_ =
      goog.math.Long.TWO_PWR_32_DBL_ * goog.math.Long.TWO_PWR_16_DBL_;
  /**
   * @type {number}
   * @private
   */
  goog.math.Long.TWO_PWR_64_DBL_ =
      goog.math.Long.TWO_PWR_32_DBL_ * goog.math.Long.TWO_PWR_32_DBL_;
  /**
   * @type {number}
   * @private
   */
  goog.math.Long.TWO_PWR_63_DBL_ =
      goog.math.Long.TWO_PWR_64_DBL_ / 2;
  /** @type {!goog.math.Long} */
  goog.math.Long.ZERO = goog.math.Long.fromInt(0);
  /** @type {!goog.math.Long} */
  goog.math.Long.ONE = goog.math.Long.fromInt(1);
  /** @type {!goog.math.Long} */
  goog.math.Long.NEG_ONE = goog.math.Long.fromInt(-1);
  /** @type {!goog.math.Long} */
  goog.math.Long.MAX_VALUE =
      goog.math.Long.fromBits(0xFFFFFFFF | 0, 0x7FFFFFFF | 0);
  /** @type {!goog.math.Long} */
  goog.math.Long.MIN_VALUE = goog.math.Long.fromBits(0, 0x80000000 | 0);
  /**
   * @type {!goog.math.Long}
   * @private
   */
  goog.math.Long.TWO_PWR_24_ = goog.math.Long.fromInt(1 << 24);
  /** @return {number} The value, assuming it is a 32-bit integer. */
  goog.math.Long.prototype.toInt = function() {
    return this.low_;
  };
  /** @return {number} The closest floating-point representation to this value. */
  goog.math.Long.prototype.toNumber = function() {
    return this.high_ * goog.math.Long.TWO_PWR_32_DBL_ +
           this.getLowBitsUnsigned();
  };
  /**
   * @param {number=} opt_radix The radix in which the text should be written.
   * @return {string} The textual representation of this value.
   */
  goog.math.Long.prototype.toString = function(opt_radix) {
    var radix = opt_radix || 10;
    if (radix < 2 || 36 < radix) {
      throw Error('radix out of range: ' + radix);
    }
    if (this.isZero()) {
      return '0';
    }
    if (this.isNegative()) {
      if (this.equals(goog.math.Long.MIN_VALUE)) {
        // We need to change the Long value before it can be negated, so we remove
        // the bottom-most digit in this base and then recurse to do the rest.
        var radixLong = goog.math.Long.fromNumber(radix);
        var div = this.div(radixLong);
        var rem = div.multiply(radixLong).subtract(this);
        return div.toString(radix) + rem.toInt().toString(radix);
      } else {
        return '-' + this.negate().toString(radix);
      }
    }
    // Do several (6) digits each time through the loop, so as to
    // minimize the calls to the very expensive emulated div.
    var radixToPower = goog.math.Long.fromNumber(Math.pow(radix, 6));
    var rem = this;
    var result = '';
    while (true) {
      var remDiv = rem.div(radixToPower);
      var intval = rem.subtract(remDiv.multiply(radixToPower)).toInt();
      var digits = intval.toString(radix);
      rem = remDiv;
      if (rem.isZero()) {
        return digits + result;
      } else {
        while (digits.length < 6) {
          digits = '0' + digits;
        }
        result = '' + digits + result;
      }
    }
  };
  /** @return {number} The high 32-bits as a signed value. */
  goog.math.Long.prototype.getHighBits = function() {
    return this.high_;
  };
  /** @return {number} The low 32-bits as a signed value. */
  goog.math.Long.prototype.getLowBits = function() {
    return this.low_;
  };
  /** @return {number} The low 32-bits as an unsigned value. */
  goog.math.Long.prototype.getLowBitsUnsigned = function() {
    return (this.low_ >= 0) ?
        this.low_ : goog.math.Long.TWO_PWR_32_DBL_ + this.low_;
  };
  /**
   * @return {number} Returns the number of bits needed to represent the absolute
   *     value of this Long.
   */
  goog.math.Long.prototype.getNumBitsAbs = function() {
    if (this.isNegative()) {
      if (this.equals(goog.math.Long.MIN_VALUE)) {
        return 64;
      } else {
        return this.negate().getNumBitsAbs();
      }
    } else {
      var val = this.high_ != 0 ? this.high_ : this.low_;
      for (var bit = 31; bit > 0; bit--) {
        if ((val & (1 << bit)) != 0) {
          break;
        }
      }
      return this.high_ != 0 ? bit + 33 : bit + 1;
    }
  };
  /** @return {boolean} Whether this value is zero. */
  goog.math.Long.prototype.isZero = function() {
    return this.high_ == 0 && this.low_ == 0;
  };
  /** @return {boolean} Whether this value is negative. */
  goog.math.Long.prototype.isNegative = function() {
    return this.high_ < 0;
  };
  /** @return {boolean} Whether this value is odd. */
  goog.math.Long.prototype.isOdd = function() {
    return (this.low_ & 1) == 1;
  };
  /**
   * @param {goog.math.Long} other Long to compare against.
   * @return {boolean} Whether this Long equals the other.
   */
  goog.math.Long.prototype.equals = function(other) {
    return (this.high_ == other.high_) && (this.low_ == other.low_);
  };
  /**
   * @param {goog.math.Long} other Long to compare against.
   * @return {boolean} Whether this Long does not equal the other.
   */
  goog.math.Long.prototype.notEquals = function(other) {
    return (this.high_ != other.high_) || (this.low_ != other.low_);
  };
  /**
   * @param {goog.math.Long} other Long to compare against.
   * @return {boolean} Whether this Long is less than the other.
   */
  goog.math.Long.prototype.lessThan = function(other) {
    return this.compare(other) < 0;
  };
  /**
   * @param {goog.math.Long} other Long to compare against.
   * @return {boolean} Whether this Long is less than or equal to the other.
   */
  goog.math.Long.prototype.lessThanOrEqual = function(other) {
    return this.compare(other) <= 0;
  };
  /**
   * @param {goog.math.Long} other Long to compare against.
   * @return {boolean} Whether this Long is greater than the other.
   */
  goog.math.Long.prototype.greaterThan = function(other) {
    return this.compare(other) > 0;
  };
  /**
   * @param {goog.math.Long} other Long to compare against.
   * @return {boolean} Whether this Long is greater than or equal to the other.
   */
  goog.math.Long.prototype.greaterThanOrEqual = function(other) {
    return this.compare(other) >= 0;
  };
  /**
   * Compares this Long with the given one.
   * @param {goog.math.Long} other Long to compare against.
   * @return {number} 0 if they are the same, 1 if the this is greater, and -1
   *     if the given one is greater.
   */
  goog.math.Long.prototype.compare = function(other) {
    if (this.equals(other)) {
      return 0;
    }
    var thisNeg = this.isNegative();
    var otherNeg = other.isNegative();
    if (thisNeg && !otherNeg) {
      return -1;
    }
    if (!thisNeg && otherNeg) {
      return 1;
    }
    // at this point, the signs are the same, so subtraction will not overflow
    if (this.subtract(other).isNegative()) {
      return -1;
    } else {
      return 1;
    }
  };
  /** @return {!goog.math.Long} The negation of this value. */
  goog.math.Long.prototype.negate = function() {
    if (this.equals(goog.math.Long.MIN_VALUE)) {
      return goog.math.Long.MIN_VALUE;
    } else {
      return this.not().add(goog.math.Long.ONE);
    }
  };
  /**
   * Returns the sum of this and the given Long.
   * @param {goog.math.Long} other Long to add to this one.
   * @return {!goog.math.Long} The sum of this and the given Long.
   */
  goog.math.Long.prototype.add = function(other) {
    // Divide each number into 4 chunks of 16 bits, and then sum the chunks.
    var a48 = this.high_ >>> 16;
    var a32 = this.high_ & 0xFFFF;
    var a16 = this.low_ >>> 16;
    var a00 = this.low_ & 0xFFFF;
    var b48 = other.high_ >>> 16;
    var b32 = other.high_ & 0xFFFF;
    var b16 = other.low_ >>> 16;
    var b00 = other.low_ & 0xFFFF;
    var c48 = 0, c32 = 0, c16 = 0, c00 = 0;
    c00 += a00 + b00;
    c16 += c00 >>> 16;
    c00 &= 0xFFFF;
    c16 += a16 + b16;
    c32 += c16 >>> 16;
    c16 &= 0xFFFF;
    c32 += a32 + b32;
    c48 += c32 >>> 16;
    c32 &= 0xFFFF;
    c48 += a48 + b48;
    c48 &= 0xFFFF;
    return goog.math.Long.fromBits((c16 << 16) | c00, (c48 << 16) | c32);
  };
  /**
   * Returns the difference of this and the given Long.
   * @param {goog.math.Long} other Long to subtract from this.
   * @return {!goog.math.Long} The difference of this and the given Long.
   */
  goog.math.Long.prototype.subtract = function(other) {
    return this.add(other.negate());
  };
  /**
   * Returns the product of this and the given long.
   * @param {goog.math.Long} other Long to multiply with this.
   * @return {!goog.math.Long} The product of this and the other.
   */
  goog.math.Long.prototype.multiply = function(other) {
    if (this.isZero()) {
      return goog.math.Long.ZERO;
    } else if (other.isZero()) {
      return goog.math.Long.ZERO;
    }
    if (this.equals(goog.math.Long.MIN_VALUE)) {
      return other.isOdd() ? goog.math.Long.MIN_VALUE : goog.math.Long.ZERO;
    } else if (other.equals(goog.math.Long.MIN_VALUE)) {
      return this.isOdd() ? goog.math.Long.MIN_VALUE : goog.math.Long.ZERO;
    }
    if (this.isNegative()) {
      if (other.isNegative()) {
        return this.negate().multiply(other.negate());
      } else {
        return this.negate().multiply(other).negate();
      }
    } else if (other.isNegative()) {
      return this.multiply(other.negate()).negate();
    }
    // If both longs are small, use float multiplication
    if (this.lessThan(goog.math.Long.TWO_PWR_24_) &&
        other.lessThan(goog.math.Long.TWO_PWR_24_)) {
      return goog.math.Long.fromNumber(this.toNumber() * other.toNumber());
    }
    // Divide each long into 4 chunks of 16 bits, and then add up 4x4 products.
    // We can skip products that would overflow.
    var a48 = this.high_ >>> 16;
    var a32 = this.high_ & 0xFFFF;
    var a16 = this.low_ >>> 16;
    var a00 = this.low_ & 0xFFFF;
    var b48 = other.high_ >>> 16;
    var b32 = other.high_ & 0xFFFF;
    var b16 = other.low_ >>> 16;
    var b00 = other.low_ & 0xFFFF;
    var c48 = 0, c32 = 0, c16 = 0, c00 = 0;
    c00 += a00 * b00;
    c16 += c00 >>> 16;
    c00 &= 0xFFFF;
    c16 += a16 * b00;
    c32 += c16 >>> 16;
    c16 &= 0xFFFF;
    c16 += a00 * b16;
    c32 += c16 >>> 16;
    c16 &= 0xFFFF;
    c32 += a32 * b00;
    c48 += c32 >>> 16;
    c32 &= 0xFFFF;
    c32 += a16 * b16;
    c48 += c32 >>> 16;
    c32 &= 0xFFFF;
    c32 += a00 * b32;
    c48 += c32 >>> 16;
    c32 &= 0xFFFF;
    c48 += a48 * b00 + a32 * b16 + a16 * b32 + a00 * b48;
    c48 &= 0xFFFF;
    return goog.math.Long.fromBits((c16 << 16) | c00, (c48 << 16) | c32);
  };
  /**
   * Returns this Long divided by the given one.
   * @param {goog.math.Long} other Long by which to divide.
   * @return {!goog.math.Long} This Long divided by the given one.
   */
  goog.math.Long.prototype.div = function(other) {
    if (other.isZero()) {
      throw Error('division by zero');
    } else if (this.isZero()) {
      return goog.math.Long.ZERO;
    }
    if (this.equals(goog.math.Long.MIN_VALUE)) {
      if (other.equals(goog.math.Long.ONE) ||
          other.equals(goog.math.Long.NEG_ONE)) {
        return goog.math.Long.MIN_VALUE;  // recall that -MIN_VALUE == MIN_VALUE
      } else if (other.equals(goog.math.Long.MIN_VALUE)) {
        return goog.math.Long.ONE;
      } else {
        // At this point, we have |other| >= 2, so |this/other| < |MIN_VALUE|.
        var halfThis = this.shiftRight(1);
        var approx = halfThis.div(other).shiftLeft(1);
        if (approx.equals(goog.math.Long.ZERO)) {
          return other.isNegative() ? goog.math.Long.ONE : goog.math.Long.NEG_ONE;
        } else {
          var rem = this.subtract(other.multiply(approx));
          var result = approx.add(rem.div(other));
          return result;
        }
      }
    } else if (other.equals(goog.math.Long.MIN_VALUE)) {
      return goog.math.Long.ZERO;
    }
    if (this.isNegative()) {
      if (other.isNegative()) {
        return this.negate().div(other.negate());
      } else {
        return this.negate().div(other).negate();
      }
    } else if (other.isNegative()) {
      return this.div(other.negate()).negate();
    }
    // Repeat the following until the remainder is less than other:  find a
    // floating-point that approximates remainder / other *from below*, add this
    // into the result, and subtract it from the remainder.  It is critical that
    // the approximate value is less than or equal to the real value so that the
    // remainder never becomes negative.
    var res = goog.math.Long.ZERO;
    var rem = this;
    while (rem.greaterThanOrEqual(other)) {
      // Approximate the result of division. This may be a little greater or
      // smaller than the actual value.
      var approx = Math.max(1, Math.floor(rem.toNumber() / other.toNumber()));
      // We will tweak the approximate result by changing it in the 48-th digit or
      // the smallest non-fractional digit, whichever is larger.
      var log2 = Math.ceil(Math.log(approx) / Math.LN2);
      var delta = (log2 <= 48) ? 1 : Math.pow(2, log2 - 48);
      // Decrease the approximation until it is smaller than the remainder.  Note
      // that if it is too large, the product overflows and is negative.
      var approxRes = goog.math.Long.fromNumber(approx);
      var approxRem = approxRes.multiply(other);
      while (approxRem.isNegative() || approxRem.greaterThan(rem)) {
        approx -= delta;
        approxRes = goog.math.Long.fromNumber(approx);
        approxRem = approxRes.multiply(other);
      }
      // We know the answer can't be zero... and actually, zero would cause
      // infinite recursion since we would make no progress.
      if (approxRes.isZero()) {
        approxRes = goog.math.Long.ONE;
      }
      res = res.add(approxRes);
      rem = rem.subtract(approxRem);
    }
    return res;
  };
  /**
   * Returns this Long modulo the given one.
   * @param {goog.math.Long} other Long by which to mod.
   * @return {!goog.math.Long} This Long modulo the given one.
   */
  goog.math.Long.prototype.modulo = function(other) {
    return this.subtract(this.div(other).multiply(other));
  };
  /** @return {!goog.math.Long} The bitwise-NOT of this value. */
  goog.math.Long.prototype.not = function() {
    return goog.math.Long.fromBits(~this.low_, ~this.high_);
  };
  /**
   * Returns the bitwise-AND of this Long and the given one.
   * @param {goog.math.Long} other The Long with which to AND.
   * @return {!goog.math.Long} The bitwise-AND of this and the other.
   */
  goog.math.Long.prototype.and = function(other) {
    return goog.math.Long.fromBits(this.low_ & other.low_,
                                   this.high_ & other.high_);
  };
  /**
   * Returns the bitwise-OR of this Long and the given one.
   * @param {goog.math.Long} other The Long with which to OR.
   * @return {!goog.math.Long} The bitwise-OR of this and the other.
   */
  goog.math.Long.prototype.or = function(other) {
    return goog.math.Long.fromBits(this.low_ | other.low_,
                                   this.high_ | other.high_);
  };
  /**
   * Returns the bitwise-XOR of this Long and the given one.
   * @param {goog.math.Long} other The Long with which to XOR.
   * @return {!goog.math.Long} The bitwise-XOR of this and the other.
   */
  goog.math.Long.prototype.xor = function(other) {
    return goog.math.Long.fromBits(this.low_ ^ other.low_,
                                   this.high_ ^ other.high_);
  };
  /**
   * Returns this Long with bits shifted to the left by the given amount.
   * @param {number} numBits The number of bits by which to shift.
   * @return {!goog.math.Long} This shifted to the left by the given amount.
   */
  goog.math.Long.prototype.shiftLeft = function(numBits) {
    numBits &= 63;
    if (numBits == 0) {
      return this;
    } else {
      var low = this.low_;
      if (numBits < 32) {
        var high = this.high_;
        return goog.math.Long.fromBits(
            low << numBits,
            (high << numBits) | (low >>> (32 - numBits)));
      } else {
        return goog.math.Long.fromBits(0, low << (numBits - 32));
      }
    }
  };
  /**
   * Returns this Long with bits shifted to the right by the given amount.
   * @param {number} numBits The number of bits by which to shift.
   * @return {!goog.math.Long} This shifted to the right by the given amount.
   */
  goog.math.Long.prototype.shiftRight = function(numBits) {
    numBits &= 63;
    if (numBits == 0) {
      return this;
    } else {
      var high = this.high_;
      if (numBits < 32) {
        var low = this.low_;
        return goog.math.Long.fromBits(
            (low >>> numBits) | (high << (32 - numBits)),
            high >> numBits);
      } else {
        return goog.math.Long.fromBits(
            high >> (numBits - 32),
            high >= 0 ? 0 : -1);
      }
    }
  };
  /**
   * Returns this Long with bits shifted to the right by the given amount, with
   * the new top bits matching the current sign bit.
   * @param {number} numBits The number of bits by which to shift.
   * @return {!goog.math.Long} This shifted to the right by the given amount, with
   *     zeros placed into the new leading bits.
   */
  goog.math.Long.prototype.shiftRightUnsigned = function(numBits) {
    numBits &= 63;
    if (numBits == 0) {
      return this;
    } else {
      var high = this.high_;
      if (numBits < 32) {
        var low = this.low_;
        return goog.math.Long.fromBits(
            (low >>> numBits) | (high << (32 - numBits)),
            high >>> numBits);
      } else if (numBits == 32) {
        return goog.math.Long.fromBits(high, 0);
      } else {
        return goog.math.Long.fromBits(high >>> (numBits - 32), 0);
      }
    }
  };
  //======= begin jsbn =======
  var navigator = { appName: 'Modern Browser' }; // polyfill a little
  // Copyright (c) 2005  Tom Wu
  // All Rights Reserved.
  // http://www-cs-students.stanford.edu/~tjw/jsbn/
  /*
   * Copyright (c) 2003-2005  Tom Wu
   * All Rights Reserved.
   *
   * Permission is hereby granted, free of charge, to any person obtaining
   * a copy of this software and associated documentation files (the
   * "Software"), to deal in the Software without restriction, including
   * without limitation the rights to use, copy, modify, merge, publish,
   * distribute, sublicense, and/or sell copies of the Software, and to
   * permit persons to whom the Software is furnished to do so, subject to
   * the following conditions:
   *
   * The above copyright notice and this permission notice shall be
   * included in all copies or substantial portions of the Software.
   *
   * THE SOFTWARE IS PROVIDED "AS-IS" AND WITHOUT WARRANTY OF ANY KIND, 
   * EXPRESS, IMPLIED OR OTHERWISE, INCLUDING WITHOUT LIMITATION, ANY 
   * WARRANTY OF MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE.  
   *
   * IN NO EVENT SHALL TOM WU BE LIABLE FOR ANY SPECIAL, INCIDENTAL,
   * INDIRECT OR CONSEQUENTIAL DAMAGES OF ANY KIND, OR ANY DAMAGES WHATSOEVER
   * RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER OR NOT ADVISED OF
   * THE POSSIBILITY OF DAMAGE, AND ON ANY THEORY OF LIABILITY, ARISING OUT
   * OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
   *
   * In addition, the following condition applies:
   *
   * All redistributions must retain an intact copy of this copyright notice
   * and disclaimer.
   */
  // Basic JavaScript BN library - subset useful for RSA encryption.
  // Bits per digit
  var dbits;
  // JavaScript engine analysis
  var canary = 0xdeadbeefcafe;
  var j_lm = ((canary&0xffffff)==0xefcafe);
  // (public) Constructor
  function BigInteger(a,b,c) {
    if(a != null)
      if("number" == typeof a) this.fromNumber(a,b,c);
      else if(b == null && "string" != typeof a) this.fromString(a,256);
      else this.fromString(a,b);
  }
  // return new, unset BigInteger
  function nbi() { return new BigInteger(null); }
  // am: Compute w_j += (x*this_i), propagate carries,
  // c is initial carry, returns final carry.
  // c < 3*dvalue, x < 2*dvalue, this_i < dvalue
  // We need to select the fastest one that works in this environment.
  // am1: use a single mult and divide to get the high bits,
  // max digit bits should be 26 because
  // max internal value = 2*dvalue^2-2*dvalue (< 2^53)
  function am1(i,x,w,j,c,n) {
    while(--n >= 0) {
      var v = x*this[i++]+w[j]+c;
      c = Math.floor(v/0x4000000);
      w[j++] = v&0x3ffffff;
    }
    return c;
  }
  // am2 avoids a big mult-and-extract completely.
  // Max digit bits should be <= 30 because we do bitwise ops
  // on values up to 2*hdvalue^2-hdvalue-1 (< 2^31)
  function am2(i,x,w,j,c,n) {
    var xl = x&0x7fff, xh = x>>15;
    while(--n >= 0) {
      var l = this[i]&0x7fff;
      var h = this[i++]>>15;
      var m = xh*l+h*xl;
      l = xl*l+((m&0x7fff)<<15)+w[j]+(c&0x3fffffff);
      c = (l>>>30)+(m>>>15)+xh*h+(c>>>30);
      w[j++] = l&0x3fffffff;
    }
    return c;
  }
  // Alternately, set max digit bits to 28 since some
  // browsers slow down when dealing with 32-bit numbers.
  function am3(i,x,w,j,c,n) {
    var xl = x&0x3fff, xh = x>>14;
    while(--n >= 0) {
      var l = this[i]&0x3fff;
      var h = this[i++]>>14;
      var m = xh*l+h*xl;
      l = xl*l+((m&0x3fff)<<14)+w[j]+c;
      c = (l>>28)+(m>>14)+xh*h;
      w[j++] = l&0xfffffff;
    }
    return c;
  }
  if(j_lm && (navigator.appName == "Microsoft Internet Explorer")) {
    BigInteger.prototype.am = am2;
    dbits = 30;
  }
  else if(j_lm && (navigator.appName != "Netscape")) {
    BigInteger.prototype.am = am1;
    dbits = 26;
  }
  else { // Mozilla/Netscape seems to prefer am3
    BigInteger.prototype.am = am3;
    dbits = 28;
  }
  BigInteger.prototype.DB = dbits;
  BigInteger.prototype.DM = ((1<<dbits)-1);
  BigInteger.prototype.DV = (1<<dbits);
  var BI_FP = 52;
  BigInteger.prototype.FV = Math.pow(2,BI_FP);
  BigInteger.prototype.F1 = BI_FP-dbits;
  BigInteger.prototype.F2 = 2*dbits-BI_FP;
  // Digit conversions
  var BI_RM = "0123456789abcdefghijklmnopqrstuvwxyz";
  var BI_RC = new Array();
  var rr,vv;
  rr = "0".charCodeAt(0);
  for(vv = 0; vv <= 9; ++vv) BI_RC[rr++] = vv;
  rr = "a".charCodeAt(0);
  for(vv = 10; vv < 36; ++vv) BI_RC[rr++] = vv;
  rr = "A".charCodeAt(0);
  for(vv = 10; vv < 36; ++vv) BI_RC[rr++] = vv;
  function int2char(n) { return BI_RM.charAt(n); }
  function intAt(s,i) {
    var c = BI_RC[s.charCodeAt(i)];
    return (c==null)?-1:c;
  }
  // (protected) copy this to r
  function bnpCopyTo(r) {
    for(var i = this.t-1; i >= 0; --i) r[i] = this[i];
    r.t = this.t;
    r.s = this.s;
  }
  // (protected) set from integer value x, -DV <= x < DV
  function bnpFromInt(x) {
    this.t = 1;
    this.s = (x<0)?-1:0;
    if(x > 0) this[0] = x;
    else if(x < -1) this[0] = x+DV;
    else this.t = 0;
  }
  // return bigint initialized to value
  function nbv(i) { var r = nbi(); r.fromInt(i); return r; }
  // (protected) set from string and radix
  function bnpFromString(s,b) {
    var k;
    if(b == 16) k = 4;
    else if(b == 8) k = 3;
    else if(b == 256) k = 8; // byte array
    else if(b == 2) k = 1;
    else if(b == 32) k = 5;
    else if(b == 4) k = 2;
    else { this.fromRadix(s,b); return; }
    this.t = 0;
    this.s = 0;
    var i = s.length, mi = false, sh = 0;
    while(--i >= 0) {
      var x = (k==8)?s[i]&0xff:intAt(s,i);
      if(x < 0) {
        if(s.charAt(i) == "-") mi = true;
        continue;
      }
      mi = false;
      if(sh == 0)
        this[this.t++] = x;
      else if(sh+k > this.DB) {
        this[this.t-1] |= (x&((1<<(this.DB-sh))-1))<<sh;
        this[this.t++] = (x>>(this.DB-sh));
      }
      else
        this[this.t-1] |= x<<sh;
      sh += k;
      if(sh >= this.DB) sh -= this.DB;
    }
    if(k == 8 && (s[0]&0x80) != 0) {
      this.s = -1;
      if(sh > 0) this[this.t-1] |= ((1<<(this.DB-sh))-1)<<sh;
    }
    this.clamp();
    if(mi) BigInteger.ZERO.subTo(this,this);
  }
  // (protected) clamp off excess high words
  function bnpClamp() {
    var c = this.s&this.DM;
    while(this.t > 0 && this[this.t-1] == c) --this.t;
  }
  // (public) return string representation in given radix
  function bnToString(b) {
    if(this.s < 0) return "-"+this.negate().toString(b);
    var k;
    if(b == 16) k = 4;
    else if(b == 8) k = 3;
    else if(b == 2) k = 1;
    else if(b == 32) k = 5;
    else if(b == 4) k = 2;
    else return this.toRadix(b);
    var km = (1<<k)-1, d, m = false, r = "", i = this.t;
    var p = this.DB-(i*this.DB)%k;
    if(i-- > 0) {
      if(p < this.DB && (d = this[i]>>p) > 0) { m = true; r = int2char(d); }
      while(i >= 0) {
        if(p < k) {
          d = (this[i]&((1<<p)-1))<<(k-p);
          d |= this[--i]>>(p+=this.DB-k);
        }
        else {
          d = (this[i]>>(p-=k))&km;
          if(p <= 0) { p += this.DB; --i; }
        }
        if(d > 0) m = true;
        if(m) r += int2char(d);
      }
    }
    return m?r:"0";
  }
  // (public) -this
  function bnNegate() { var r = nbi(); BigInteger.ZERO.subTo(this,r); return r; }
  // (public) |this|
  function bnAbs() { return (this.s<0)?this.negate():this; }
  // (public) return + if this > a, - if this < a, 0 if equal
  function bnCompareTo(a) {
    var r = this.s-a.s;
    if(r != 0) return r;
    var i = this.t;
    r = i-a.t;
    if(r != 0) return (this.s<0)?-r:r;
    while(--i >= 0) if((r=this[i]-a[i]) != 0) return r;
    return 0;
  }
  // returns bit length of the integer x
  function nbits(x) {
    var r = 1, t;
    if((t=x>>>16) != 0) { x = t; r += 16; }
    if((t=x>>8) != 0) { x = t; r += 8; }
    if((t=x>>4) != 0) { x = t; r += 4; }
    if((t=x>>2) != 0) { x = t; r += 2; }
    if((t=x>>1) != 0) { x = t; r += 1; }
    return r;
  }
  // (public) return the number of bits in "this"
  function bnBitLength() {
    if(this.t <= 0) return 0;
    return this.DB*(this.t-1)+nbits(this[this.t-1]^(this.s&this.DM));
  }
  // (protected) r = this << n*DB
  function bnpDLShiftTo(n,r) {
    var i;
    for(i = this.t-1; i >= 0; --i) r[i+n] = this[i];
    for(i = n-1; i >= 0; --i) r[i] = 0;
    r.t = this.t+n;
    r.s = this.s;
  }
  // (protected) r = this >> n*DB
  function bnpDRShiftTo(n,r) {
    for(var i = n; i < this.t; ++i) r[i-n] = this[i];
    r.t = Math.max(this.t-n,0);
    r.s = this.s;
  }
  // (protected) r = this << n
  function bnpLShiftTo(n,r) {
    var bs = n%this.DB;
    var cbs = this.DB-bs;
    var bm = (1<<cbs)-1;
    var ds = Math.floor(n/this.DB), c = (this.s<<bs)&this.DM, i;
    for(i = this.t-1; i >= 0; --i) {
      r[i+ds+1] = (this[i]>>cbs)|c;
      c = (this[i]&bm)<<bs;
    }
    for(i = ds-1; i >= 0; --i) r[i] = 0;
    r[ds] = c;
    r.t = this.t+ds+1;
    r.s = this.s;
    r.clamp();
  }
  // (protected) r = this >> n
  function bnpRShiftTo(n,r) {
    r.s = this.s;
    var ds = Math.floor(n/this.DB);
    if(ds >= this.t) { r.t = 0; return; }
    var bs = n%this.DB;
    var cbs = this.DB-bs;
    var bm = (1<<bs)-1;
    r[0] = this[ds]>>bs;
    for(var i = ds+1; i < this.t; ++i) {
      r[i-ds-1] |= (this[i]&bm)<<cbs;
      r[i-ds] = this[i]>>bs;
    }
    if(bs > 0) r[this.t-ds-1] |= (this.s&bm)<<cbs;
    r.t = this.t-ds;
    r.clamp();
  }
  // (protected) r = this - a
  function bnpSubTo(a,r) {
    var i = 0, c = 0, m = Math.min(a.t,this.t);
    while(i < m) {
      c += this[i]-a[i];
      r[i++] = c&this.DM;
      c >>= this.DB;
    }
    if(a.t < this.t) {
      c -= a.s;
      while(i < this.t) {
        c += this[i];
        r[i++] = c&this.DM;
        c >>= this.DB;
      }
      c += this.s;
    }
    else {
      c += this.s;
      while(i < a.t) {
        c -= a[i];
        r[i++] = c&this.DM;
        c >>= this.DB;
      }
      c -= a.s;
    }
    r.s = (c<0)?-1:0;
    if(c < -1) r[i++] = this.DV+c;
    else if(c > 0) r[i++] = c;
    r.t = i;
    r.clamp();
  }
  // (protected) r = this * a, r != this,a (HAC 14.12)
  // "this" should be the larger one if appropriate.
  function bnpMultiplyTo(a,r) {
    var x = this.abs(), y = a.abs();
    var i = x.t;
    r.t = i+y.t;
    while(--i >= 0) r[i] = 0;
    for(i = 0; i < y.t; ++i) r[i+x.t] = x.am(0,y[i],r,i,0,x.t);
    r.s = 0;
    r.clamp();
    if(this.s != a.s) BigInteger.ZERO.subTo(r,r);
  }
  // (protected) r = this^2, r != this (HAC 14.16)
  function bnpSquareTo(r) {
    var x = this.abs();
    var i = r.t = 2*x.t;
    while(--i >= 0) r[i] = 0;
    for(i = 0; i < x.t-1; ++i) {
      var c = x.am(i,x[i],r,2*i,0,1);
      if((r[i+x.t]+=x.am(i+1,2*x[i],r,2*i+1,c,x.t-i-1)) >= x.DV) {
        r[i+x.t] -= x.DV;
        r[i+x.t+1] = 1;
      }
    }
    if(r.t > 0) r[r.t-1] += x.am(i,x[i],r,2*i,0,1);
    r.s = 0;
    r.clamp();
  }
  // (protected) divide this by m, quotient and remainder to q, r (HAC 14.20)
  // r != q, this != m.  q or r may be null.
  function bnpDivRemTo(m,q,r) {
    var pm = m.abs();
    if(pm.t <= 0) return;
    var pt = this.abs();
    if(pt.t < pm.t) {
      if(q != null) q.fromInt(0);
      if(r != null) this.copyTo(r);
      return;
    }
    if(r == null) r = nbi();
    var y = nbi(), ts = this.s, ms = m.s;
    var nsh = this.DB-nbits(pm[pm.t-1]);	// normalize modulus
    if(nsh > 0) { pm.lShiftTo(nsh,y); pt.lShiftTo(nsh,r); }
    else { pm.copyTo(y); pt.copyTo(r); }
    var ys = y.t;
    var y0 = y[ys-1];
    if(y0 == 0) return;
    var yt = y0*(1<<this.F1)+((ys>1)?y[ys-2]>>this.F2:0);
    var d1 = this.FV/yt, d2 = (1<<this.F1)/yt, e = 1<<this.F2;
    var i = r.t, j = i-ys, t = (q==null)?nbi():q;
    y.dlShiftTo(j,t);
    if(r.compareTo(t) >= 0) {
      r[r.t++] = 1;
      r.subTo(t,r);
    }
    BigInteger.ONE.dlShiftTo(ys,t);
    t.subTo(y,y);	// "negative" y so we can replace sub with am later
    while(y.t < ys) y[y.t++] = 0;
    while(--j >= 0) {
      // Estimate quotient digit
      var qd = (r[--i]==y0)?this.DM:Math.floor(r[i]*d1+(r[i-1]+e)*d2);
      if((r[i]+=y.am(0,qd,r,j,0,ys)) < qd) {	// Try it out
        y.dlShiftTo(j,t);
        r.subTo(t,r);
        while(r[i] < --qd) r.subTo(t,r);
      }
    }
    if(q != null) {
      r.drShiftTo(ys,q);
      if(ts != ms) BigInteger.ZERO.subTo(q,q);
    }
    r.t = ys;
    r.clamp();
    if(nsh > 0) r.rShiftTo(nsh,r);	// Denormalize remainder
    if(ts < 0) BigInteger.ZERO.subTo(r,r);
  }
  // (public) this mod a
  function bnMod(a) {
    var r = nbi();
    this.abs().divRemTo(a,null,r);
    if(this.s < 0 && r.compareTo(BigInteger.ZERO) > 0) a.subTo(r,r);
    return r;
  }
  // Modular reduction using "classic" algorithm
  function Classic(m) { this.m = m; }
  function cConvert(x) {
    if(x.s < 0 || x.compareTo(this.m) >= 0) return x.mod(this.m);
    else return x;
  }
  function cRevert(x) { return x; }
  function cReduce(x) { x.divRemTo(this.m,null,x); }
  function cMulTo(x,y,r) { x.multiplyTo(y,r); this.reduce(r); }
  function cSqrTo(x,r) { x.squareTo(r); this.reduce(r); }
  Classic.prototype.convert = cConvert;
  Classic.prototype.revert = cRevert;
  Classic.prototype.reduce = cReduce;
  Classic.prototype.mulTo = cMulTo;
  Classic.prototype.sqrTo = cSqrTo;
  // (protected) return "-1/this % 2^DB"; useful for Mont. reduction
  // justification:
  //         xy == 1 (mod m)
  //         xy =  1+km
  //   xy(2-xy) = (1+km)(1-km)
  // x[y(2-xy)] = 1-k^2m^2
  // x[y(2-xy)] == 1 (mod m^2)
  // if y is 1/x mod m, then y(2-xy) is 1/x mod m^2
  // should reduce x and y(2-xy) by m^2 at each step to keep size bounded.
  // JS multiply "overflows" differently from C/C++, so care is needed here.
  function bnpInvDigit() {
    if(this.t < 1) return 0;
    var x = this[0];
    if((x&1) == 0) return 0;
    var y = x&3;		// y == 1/x mod 2^2
    y = (y*(2-(x&0xf)*y))&0xf;	// y == 1/x mod 2^4
    y = (y*(2-(x&0xff)*y))&0xff;	// y == 1/x mod 2^8
    y = (y*(2-(((x&0xffff)*y)&0xffff)))&0xffff;	// y == 1/x mod 2^16
    // last step - calculate inverse mod DV directly;
    // assumes 16 < DB <= 32 and assumes ability to handle 48-bit ints
    y = (y*(2-x*y%this.DV))%this.DV;		// y == 1/x mod 2^dbits
    // we really want the negative inverse, and -DV < y < DV
    return (y>0)?this.DV-y:-y;
  }
  // Montgomery reduction
  function Montgomery(m) {
    this.m = m;
    this.mp = m.invDigit();
    this.mpl = this.mp&0x7fff;
    this.mph = this.mp>>15;
    this.um = (1<<(m.DB-15))-1;
    this.mt2 = 2*m.t;
  }
  // xR mod m
  function montConvert(x) {
    var r = nbi();
    x.abs().dlShiftTo(this.m.t,r);
    r.divRemTo(this.m,null,r);
    if(x.s < 0 && r.compareTo(BigInteger.ZERO) > 0) this.m.subTo(r,r);
    return r;
  }
  // x/R mod m
  function montRevert(x) {
    var r = nbi();
    x.copyTo(r);
    this.reduce(r);
    return r;
  }
  // x = x/R mod m (HAC 14.32)
  function montReduce(x) {
    while(x.t <= this.mt2)	// pad x so am has enough room later
      x[x.t++] = 0;
    for(var i = 0; i < this.m.t; ++i) {
      // faster way of calculating u0 = x[i]*mp mod DV
      var j = x[i]&0x7fff;
      var u0 = (j*this.mpl+(((j*this.mph+(x[i]>>15)*this.mpl)&this.um)<<15))&x.DM;
      // use am to combine the multiply-shift-add into one call
      j = i+this.m.t;
      x[j] += this.m.am(0,u0,x,i,0,this.m.t);
      // propagate carry
      while(x[j] >= x.DV) { x[j] -= x.DV; x[++j]++; }
    }
    x.clamp();
    x.drShiftTo(this.m.t,x);
    if(x.compareTo(this.m) >= 0) x.subTo(this.m,x);
  }
  // r = "x^2/R mod m"; x != r
  function montSqrTo(x,r) { x.squareTo(r); this.reduce(r); }
  // r = "xy/R mod m"; x,y != r
  function montMulTo(x,y,r) { x.multiplyTo(y,r); this.reduce(r); }
  Montgomery.prototype.convert = montConvert;
  Montgomery.prototype.revert = montRevert;
  Montgomery.prototype.reduce = montReduce;
  Montgomery.prototype.mulTo = montMulTo;
  Montgomery.prototype.sqrTo = montSqrTo;
  // (protected) true iff this is even
  function bnpIsEven() { return ((this.t>0)?(this[0]&1):this.s) == 0; }
  // (protected) this^e, e < 2^32, doing sqr and mul with "r" (HAC 14.79)
  function bnpExp(e,z) {
    if(e > 0xffffffff || e < 1) return BigInteger.ONE;
    var r = nbi(), r2 = nbi(), g = z.convert(this), i = nbits(e)-1;
    g.copyTo(r);
    while(--i >= 0) {
      z.sqrTo(r,r2);
      if((e&(1<<i)) > 0) z.mulTo(r2,g,r);
      else { var t = r; r = r2; r2 = t; }
    }
    return z.revert(r);
  }
  // (public) this^e % m, 0 <= e < 2^32
  function bnModPowInt(e,m) {
    var z;
    if(e < 256 || m.isEven()) z = new Classic(m); else z = new Montgomery(m);
    return this.exp(e,z);
  }
  // protected
  BigInteger.prototype.copyTo = bnpCopyTo;
  BigInteger.prototype.fromInt = bnpFromInt;
  BigInteger.prototype.fromString = bnpFromString;
  BigInteger.prototype.clamp = bnpClamp;
  BigInteger.prototype.dlShiftTo = bnpDLShiftTo;
  BigInteger.prototype.drShiftTo = bnpDRShiftTo;
  BigInteger.prototype.lShiftTo = bnpLShiftTo;
  BigInteger.prototype.rShiftTo = bnpRShiftTo;
  BigInteger.prototype.subTo = bnpSubTo;
  BigInteger.prototype.multiplyTo = bnpMultiplyTo;
  BigInteger.prototype.squareTo = bnpSquareTo;
  BigInteger.prototype.divRemTo = bnpDivRemTo;
  BigInteger.prototype.invDigit = bnpInvDigit;
  BigInteger.prototype.isEven = bnpIsEven;
  BigInteger.prototype.exp = bnpExp;
  // public
  BigInteger.prototype.toString = bnToString;
  BigInteger.prototype.negate = bnNegate;
  BigInteger.prototype.abs = bnAbs;
  BigInteger.prototype.compareTo = bnCompareTo;
  BigInteger.prototype.bitLength = bnBitLength;
  BigInteger.prototype.mod = bnMod;
  BigInteger.prototype.modPowInt = bnModPowInt;
  // "constants"
  BigInteger.ZERO = nbv(0);
  BigInteger.ONE = nbv(1);
  // jsbn2 stuff
  // (protected) convert from radix string
  function bnpFromRadix(s,b) {
    this.fromInt(0);
    if(b == null) b = 10;
    var cs = this.chunkSize(b);
    var d = Math.pow(b,cs), mi = false, j = 0, w = 0;
    for(var i = 0; i < s.length; ++i) {
      var x = intAt(s,i);
      if(x < 0) {
        if(s.charAt(i) == "-" && this.signum() == 0) mi = true;
        continue;
      }
      w = b*w+x;
      if(++j >= cs) {
        this.dMultiply(d);
        this.dAddOffset(w,0);
        j = 0;
        w = 0;
      }
    }
    if(j > 0) {
      this.dMultiply(Math.pow(b,j));
      this.dAddOffset(w,0);
    }
    if(mi) BigInteger.ZERO.subTo(this,this);
  }
  // (protected) return x s.t. r^x < DV
  function bnpChunkSize(r) { return Math.floor(Math.LN2*this.DB/Math.log(r)); }
  // (public) 0 if this == 0, 1 if this > 0
  function bnSigNum() {
    if(this.s < 0) return -1;
    else if(this.t <= 0 || (this.t == 1 && this[0] <= 0)) return 0;
    else return 1;
  }
  // (protected) this *= n, this >= 0, 1 < n < DV
  function bnpDMultiply(n) {
    this[this.t] = this.am(0,n-1,this,0,0,this.t);
    ++this.t;
    this.clamp();
  }
  // (protected) this += n << w words, this >= 0
  function bnpDAddOffset(n,w) {
    if(n == 0) return;
    while(this.t <= w) this[this.t++] = 0;
    this[w] += n;
    while(this[w] >= this.DV) {
      this[w] -= this.DV;
      if(++w >= this.t) this[this.t++] = 0;
      ++this[w];
    }
  }
  // (protected) convert to radix string
  function bnpToRadix(b) {
    if(b == null) b = 10;
    if(this.signum() == 0 || b < 2 || b > 36) return "0";
    var cs = this.chunkSize(b);
    var a = Math.pow(b,cs);
    var d = nbv(a), y = nbi(), z = nbi(), r = "";
    this.divRemTo(d,y,z);
    while(y.signum() > 0) {
      r = (a+z.intValue()).toString(b).substr(1) + r;
      y.divRemTo(d,y,z);
    }
    return z.intValue().toString(b) + r;
  }
  // (public) return value as integer
  function bnIntValue() {
    if(this.s < 0) {
      if(this.t == 1) return this[0]-this.DV;
      else if(this.t == 0) return -1;
    }
    else if(this.t == 1) return this[0];
    else if(this.t == 0) return 0;
    // assumes 16 < DB < 32
    return ((this[1]&((1<<(32-this.DB))-1))<<this.DB)|this[0];
  }
  // (protected) r = this + a
  function bnpAddTo(a,r) {
    var i = 0, c = 0, m = Math.min(a.t,this.t);
    while(i < m) {
      c += this[i]+a[i];
      r[i++] = c&this.DM;
      c >>= this.DB;
    }
    if(a.t < this.t) {
      c += a.s;
      while(i < this.t) {
        c += this[i];
        r[i++] = c&this.DM;
        c >>= this.DB;
      }
      c += this.s;
    }
    else {
      c += this.s;
      while(i < a.t) {
        c += a[i];
        r[i++] = c&this.DM;
        c >>= this.DB;
      }
      c += a.s;
    }
    r.s = (c<0)?-1:0;
    if(c > 0) r[i++] = c;
    else if(c < -1) r[i++] = this.DV+c;
    r.t = i;
    r.clamp();
  }
  BigInteger.prototype.fromRadix = bnpFromRadix;
  BigInteger.prototype.chunkSize = bnpChunkSize;
  BigInteger.prototype.signum = bnSigNum;
  BigInteger.prototype.dMultiply = bnpDMultiply;
  BigInteger.prototype.dAddOffset = bnpDAddOffset;
  BigInteger.prototype.toRadix = bnpToRadix;
  BigInteger.prototype.intValue = bnIntValue;
  BigInteger.prototype.addTo = bnpAddTo;
  //======= end jsbn =======
  // Emscripten wrapper
  var Wrapper = {
    abs: function(l, h) {
      var x = new goog.math.Long(l, h);
      var ret;
      if (x.isNegative()) {
        ret = x.negate();
      } else {
        ret = x;
      }
      HEAP32[tempDoublePtr>>2] = ret.low_;
      HEAP32[tempDoublePtr+4>>2] = ret.high_;
    },
    ensureTemps: function() {
      if (Wrapper.ensuredTemps) return;
      Wrapper.ensuredTemps = true;
      Wrapper.two32 = new BigInteger();
      Wrapper.two32.fromString('4294967296', 10);
      Wrapper.two64 = new BigInteger();
      Wrapper.two64.fromString('18446744073709551616', 10);
      Wrapper.temp1 = new BigInteger();
      Wrapper.temp2 = new BigInteger();
    },
    lh2bignum: function(l, h) {
      var a = new BigInteger();
      a.fromString(h.toString(), 10);
      var b = new BigInteger();
      a.multiplyTo(Wrapper.two32, b);
      var c = new BigInteger();
      c.fromString(l.toString(), 10);
      var d = new BigInteger();
      c.addTo(b, d);
      return d;
    },
    stringify: function(l, h, unsigned) {
      var ret = new goog.math.Long(l, h).toString();
      if (unsigned && ret[0] == '-') {
        // unsign slowly using jsbn bignums
        Wrapper.ensureTemps();
        var bignum = new BigInteger();
        bignum.fromString(ret, 10);
        ret = new BigInteger();
        Wrapper.two64.addTo(bignum, ret);
        ret = ret.toString(10);
      }
      return ret;
    },
    fromString: function(str, base, min, max, unsigned) {
      Wrapper.ensureTemps();
      var bignum = new BigInteger();
      bignum.fromString(str, base);
      var bigmin = new BigInteger();
      bigmin.fromString(min, 10);
      var bigmax = new BigInteger();
      bigmax.fromString(max, 10);
      if (unsigned && bignum.compareTo(BigInteger.ZERO) < 0) {
        var temp = new BigInteger();
        bignum.addTo(Wrapper.two64, temp);
        bignum = temp;
      }
      var error = false;
      if (bignum.compareTo(bigmin) < 0) {
        bignum = bigmin;
        error = true;
      } else if (bignum.compareTo(bigmax) > 0) {
        bignum = bigmax;
        error = true;
      }
      var ret = goog.math.Long.fromString(bignum.toString()); // min-max checks should have clamped this to a range goog.math.Long can handle well
      HEAP32[tempDoublePtr>>2] = ret.low_;
      HEAP32[tempDoublePtr+4>>2] = ret.high_;
      if (error) throw 'range error';
    }
  };
  return Wrapper;
})();
//======= end closure i64 code =======
// === Auto-generated postamble setup entry stuff ===
Module['callMain'] = function callMain(args) {
  assert(runDependencies == 0, 'cannot call main when async dependencies remain! (listen on __ATMAIN__)');
  assert(!Module['preRun'] || Module['preRun'].length == 0, 'cannot call main when preRun functions remain to be called');
  args = args || [];
  ensureInitRuntime();
  var argc = args.length+1;
  function pad() {
    for (var i = 0; i < 4-1; i++) {
      argv.push(0);
    }
  }
  var argv = [allocate(intArrayFromString("/bin/this.program"), 'i8', ALLOC_NORMAL) ];
  pad();
  for (var i = 0; i < argc-1; i = i + 1) {
    argv.push(allocate(intArrayFromString(args[i]), 'i8', ALLOC_NORMAL));
    pad();
  }
  argv.push(0);
  argv = allocate(argv, 'i32', ALLOC_NORMAL);
  var ret;
  var initialStackTop = STACKTOP;
  try {
    ret = Module['_main'](argc, argv, 0);
  }
  catch(e) {
    if (e.name == 'ExitStatus') {
      return e.status;
    } else if (e == 'SimulateInfiniteLoop') {
      Module['noExitRuntime'] = true;
    } else {
      throw e;
    }
  } finally {
    STACKTOP = initialStackTop;
  }
  return ret;
}
function run(args) {
  args = args || Module['arguments'];
  if (runDependencies > 0) {
    Module.printErr('run() called, but dependencies remain, so not running');
    return 0;
  }
  if (Module['preRun']) {
    if (typeof Module['preRun'] == 'function') Module['preRun'] = [Module['preRun']];
    var toRun = Module['preRun'];
    Module['preRun'] = [];
    for (var i = toRun.length-1; i >= 0; i--) {
      toRun[i]();
    }
    if (runDependencies > 0) {
      // a preRun added a dependency, run will be called later
      return 0;
    }
  }
  function doRun() {
    ensureInitRuntime();
    preMain();
    var ret = 0;
    calledRun = true;
    if (Module['_main'] && shouldRunNow) {
      ret = Module['callMain'](args);
      if (!Module['noExitRuntime']) {
        exitRuntime();
      }
    }
    if (Module['postRun']) {
      if (typeof Module['postRun'] == 'function') Module['postRun'] = [Module['postRun']];
      while (Module['postRun'].length > 0) {
        Module['postRun'].pop()();
      }
    }
    return ret;
  }
  if (Module['setStatus']) {
    Module['setStatus']('Running...');
    setTimeout(function() {
      setTimeout(function() {
        Module['setStatus']('');
      }, 1);
      if (!ABORT) doRun();
    }, 1);
    return 0;
  } else {
    return doRun();
  }
}
Module['run'] = Module.run = run;
// {{PRE_RUN_ADDITIONS}}
if (Module['preInit']) {
  if (typeof Module['preInit'] == 'function') Module['preInit'] = [Module['preInit']];
  while (Module['preInit'].length > 0) {
    Module['preInit'].pop()();
  }
}
// shouldRunNow refers to calling main(), not run().
var shouldRunNow = true;
if (Module['noInitialRun']) {
  shouldRunNow = false;
}
run();
// {{POST_RUN_ADDITIONS}}
  // {{MODULE_ADDITIONS}}

;(function(){
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
STATICTOP = STATIC_BASE + 32536;
/* memory initializer */ allocate([0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,176,160,14,254,211,201,134,255,158,24,143,0,127,105,53,0,96,12,189,0,167,215,251,255,159,76,128,254,106,101,225,255,30,252,4,0,146,12,174,0,89,241,178,254,10,229,166,255,123,221,42,254,30,20,212,0,82,128,3,0,48,209,243,0,119,121,64,255,50,227,156,255,0,110,197,1,103,27,144,0,182,120,89,255,133,114,211,0,189,110,21,255,15,10,106,0,41,192,1,0,152,232,121,255,188,60,160,255,153,113,206,255,0,183,226,254,180,13,72,255,133,59,140,1,189,241,36,255,248,37,195,1,96,220,55,0,183,76,62,255,195,66,61,0,50,76,164,1,225,164,76,255,76,61,163,255,117,62,31,0,81,145,64,255,118,65,14,0,162,115,214,255,6,138,46,0,124,230,244,255,10,138,143,0,52,26,194,0,184,244,76,0,129,143,41,1,190,244,19,255,123,170,122,255,98,129,68,0,121,213,147,0,86,101,30,255,161,103,155,0,140,89,67,255,239,229,190,1,67,11,181,0,198,240,137,254,238,69,188,255,234,113,60,255,37,255,57,255,69,178,182,254,128,208,179,0,118,26,125,254,3,7,214,255,241,50,77,255,85,203,197,255,211,135,250,255,25,48,100,255,187,213,180,254,17,88,105,0,83,209,158,1,5,115,98,0,4,174,60,254,171,55,110,255,217,181,17,255,20,188,170,0,146,156,102,254,87,214,174,255,114,122,155,1,233,44,170,0,127,8,239,1,214,236,234,0,175,5,219,0,49,106,61,255,6,66,208,255,2,106,110,255,81,234,19,255,215,107,192,255,67,151,238,0,19,42,108,255,229,85,113,1,50,68,135,255,17,106,9,0,50,103,1,255,80,1,168,1,35,152,30,255,16,168,185,1,56,89,232,255,101,210,252,0,41,250,71,0,204,170,79,255,14,46,239,255,80,77,239,0,189,214,75,255,17,141,249,0,38,80,76,255,190,85,117,0,86,228,170,0,156,216,208,1,195,207,164,255,150,66,76,255,175,225,16,255,141,80,98,1,76,219,242,0,198,162,114,0,46,218,152,0,155,43,241,254,155,160,104,255,178,9,252,254,100,110,212,0,14,5,167,0,233,239,163,255,28,151,157,1,101,146,10,255,254,158,70,254,71,249,228,0,88,30,50,0,68,58,160,255,191,24,104,1,129,66,129,255,192,50,85,255,8,179,138,255,38,250,201,0,115,80,160,0,131,230,113,0,125,88,147,0,90,68,199,0,253,76,158,0,28,255,118,0,113,250,254,0,66,75,46,0,230,218,43,0,229,120,186,1,148,68,43,0,136,124,238,1,187,107,197,255,84,53,246,255,51,116,254,255,51,187,165,0,2,17,175,0,66,84,160,1,247,58,30,0,35,65,53,254,69,236,191,0,45,134,245,1,163,123,221,0,32,110,20,255,52,23,165,0,186,214,71,0,233,176,96,0,242,239,54,1,57,89,138,0,83,0,84,255,136,160,100,0,92,142,120,254,104,124,190,0,181,177,62,255,250,41,85,0,152,130,42,1,96,252,246,0,151,151,63,254,239,133,62,0,32,56,156,0,45,167,189,255,142,133,179,1,131,86,211,0,187,179,150,254,250,170,14,255,68,113,21,255,222,186,59,255,66,7,241,1,69,6,72,0,86,156,108,254,55,167,89,0,109,52,219,254,13,176,23,255,196,44,106,255,239,149,71,255,164,140,125,255,159,173,1,0,51,41,231,0,145,62,33,0,138,111,93,1,185,83,69,0,144,115,46,0,97,151,16,255,24,228,26,0,49,217,226,0,113,75,234,254,193,153,12,255,182,48,96,255,14,13,26,0,128,195,249,254,69,193,59,0,132,37,81,254,125,106,60,0,214,240,169,1,164,227,66,0,210,163,78,0,37,52,151,0,99,77,26,0,238,156,213,255,213,192,209,1,73,46,84,0,20,65,41,1,54,206,79,0,201,131,146,254,170,111,24,255,177,33,50,254,171,38,203,255,78,247,116,0,209,221,153,0,133,128,178,1,58,44,25,0,201,39,59,1,189,19,252,0,49,229,210,1,117,187,117,0,181,179,184,1,0,114,219,0,48,94,147,0,245,41,56,0,125,13,204,254,244,173,119,0,44,221,32,254,84,234,20,0,249,160,198,1,236,126,234,255,143,62,221,0,129,89,214,255,55,139,5,254,68,20,191,255,14,204,178,1,35,195,217,0,47,51,206,1,38,246,165,0,206,27,6,254,158,87,36,0,217,52,146,255,125,123,215,255,85,60,31,255,171,13,7,0,218,245,88,254,252,35,60,0,55,214,160,255,133,101,56,0,224,32,19,254,147,64,234,0,26,145,162,1,114,118,125,0,248,252,250,0,101,94,196,255,198,141,226,254,51,42,182,0,135,12,9,254,109,172,210,255,197,236,194,1,241,65,154,0,48,156,47,255,153,67,55,255,218,165,34,254,74,180,179,0,218,66,71,1,88,122,99,0,212,181,219,255,92,42,231,255,239,0,154,0,245,77,183,255,94,81,170,1,18,213,216,0,171,93,71,0,52,94,248,0,18,151,161,254,197,209,66,255,174,244,15,254,162,48,183,0,49,61,240,254,182,93,195,0,199,228,6,1,200,5,17,255,137,45,237,255,108,148,4,0,90,79,237,255,39,63,77,255,53,82,207,1,142,22,118,255,101,232,18,1,92,26,67,0,5,200,88,255,33,168,138,255,149,225,72,0,2,209,27,255,44,245,168,1,220,237,17,255,30,211,105,254,141,238,221,0,128,80,245,254,111,254,14,0,222,95,190,1,223,9,241,0,146,76,212,255,108,205,104,255,63,117,153,0,144,69,48,0,35,228,111,0,192,33,193,255,112,214,190,254,115,152,151,0,23,102,88,0,51,74,248,0,226,199,143,254,204,162,101,255,208,97,189,1,245,104,18,0,230,246,30,255,23,148,69,0,110,88,52,254,226,181,89,255,208,47,90,254,114,161,80,255,33,116,248,0,179,152,87,255,69,144,177,1,88,238,26,255,58,32,113,1,1,77,69,0,59,121,52,255,152,238,83,0,52,8,193,0,231,39,233,255,199,34,138,0,222,68,173,0,91,57,242,254,220,210,127,255,192,7,246,254,151,35,187,0,195,236,165,0,111,93,206,0,212,247,133,1,154,133,209,255,155,231,10,0,64,78,38,0,122,249,100,1,30,19,97,255,62,91,249,1,248,133,77,0,197,63,168,254,116,10,82,0,184,236,113,254,212,203,194,255,61,100,252,254,36,5,202,255,119,91,153,255,129,79,29,0,103,103,171,254,237,215,111,255,216,53,69,0,239,240,23,0,194,149,221,255,38,225,222,0,232,255,180,254,118,82,133,255,57,209,177,1,139,232,133,0,158,176,46,254,194,115,46,0,88,247,229,1,28,103,191,0,221,222,175,254,149,235,44,0,151,228,25,254,218,105,103,0,142,85,210,0,149,129,190,255,213,65,94,254,117,134,224,255,82,198,117,0,157,221,220,0,163,101,36,0,197,114,37,0,104,172,166,254,11,182,0,0,81,72,188,255,97,188,16,255,69,6,10,0,199,147,145,255,8,9,115,1,65,214,175,255,217,173,209,0,80,127,166,0,247,229,4,254,167,183,124,255,90,28,204,254,175,59,240,255,11,41,248,1,108,40,51,255,144,177,195,254,150,250,126,0,138,91,65,1,120,60,222,255,245,193,239,0,29,214,189,255,128,2,25,0,80,154,162,0,77,220,107,1,234,205,74,255,54,166,103,255,116,72,9,0,228,94,47,255,30,200,25,255,35,214,89,255,61,176,140,255,83,226,163,255,75,130,172,0,128,38,17,0,95,137,152,255,215,124,159,1,79,93,0,0,148,82,157,254,195,130,251,255,40,202,76,255,251,126,224,0,157,99,62,254,207,7,225,255,96,68,195,0,140,186,157,255,131,19,231,255,42,128,254,0,52,219,61,254,102,203,72,0,141,7,11,255,186,164,213,0,31,122,119,0,133,242,145,0,208,252,232,255,91,213,182,255,143,4,250,254,249,215,74,0,165,30,111,1,171,9,223,0,229,123,34,1,92,130,26,255,77,155,45,1,195,139,28,255,59,224,78,0,136,17,247,0,108,121,32,0,79,250,189,255,96,227,252,254,38,241,62,0,62,174,125,255,155,111,93,255,10,230,206,1,97,197,40,255,0,49,57,254,65,250,13,0,18,251,150,255,220,109,210,255,5,174,166,254,44,129,189,0,235,35,147,255,37,247,141,255,72,141,4,255,103,107,255,0,247,90,4,0,53,44,42,0,2,30,240,0,4,59,63,0,88,78,36,0,113,167,180,0,190,71,193,255,199,158,164,255,58,8,172,0,77,33,12,0,65,63,3,0,153,77,33,255,172,254,102,1,228,221,4,255,87,30,254,1,146,41,86,255,138,204,239,254,108,141,17,255,187,242,135,0,210,208,127,0,68,45,14,254,73,96,62,0,81,60,24,255,170,6,36,255,3,249,26,0,35,213,109,0,22,129,54,255,21,35,225,255,234,61,56,255,58,217,6,0,143,124,88,0,236,126,66,0,209,38,183,255,34,238,6,255,174,145,102,0,95,22,211,0,196,15,153,254,46,84,232,255,117,34,146,1,231,250,74,255,27,134,100,1,92,187,195,255,170,198,112,0,120,28,42,0,209,70,67,0,29,81,31,0,29,168,100,1,169,173,160,0,107,35,117,0,62,96,59,255,81,12,69,1,135,239,190,255,220,252,18,0,163,220,58,255,137,137,188,255,83,102,109,0,96,6,76,0,234,222,210,255,185,174,205,1,60,158,213,255,13,241,214,0,172,129,140,0,93,104,242,0,192,156,251,0,43,117,30,0,225,81,158,0,127,232,218,0,226,28,203,0,233,27,151,255,117,43,5,255,242,14,47,255,33,20,6,0,137,251,44,254,27,31,245,255,183,214,125,254,40,121,149,0,186,158,213,255,89,8,227,0,69,88,0,254,203,135,225,0,201,174,203,0,147,71,184,0,18,121,41,254,94,5,78,0,224,214,240,254,36,5,180,0,251,135,231,1,163,138,212,0,210,249,116,254,88,129,187,0,19,8,49,254,62,14,144,255,159,76,211,0,214,51,82,0,109,117,228,254,103,223,203,255,75,252,15,1,154,71,220,255,23,13,91,1,141,168,96,255,181,182,133,0,250,51,55,0,234,234,212,254,175,63,158,0,39,240,52,1,158,189,36,255,213,40,85,1,32,180,247,255,19,102,26,1,84,24,97,255,69,21,222,0,148,139,122,255,220,213,235,1,232,203,255,0,121,57,147,0,227,7,154,0,53,22,147,1,72,1,225,0,82,134,48,254,83,60,157,255,145,72,169,0,34,103,239,0,198,233,47,0,116,19,4,255,184,106,9,255,183,129,83,0,36,176,230,1,34,103,72,0,219,162,134,0,245,42,158,0,32,149,96,254,165,44,144,0,202,239,72,254,215,150,5,0,42,66,36,1,132,215,175,0,86,174,86,255,26,197,156,255,49,232,135,254,103,182,82,0,253,128,176,1,153,178,122,0,245,250,10,0,236,24,178,0,137,106,132,0,40,29,41,0,50,30,152,255,124,105,38,0,230,191,75,0,143,43,170,0,44,131,20,255,44,13,23,255,237,255,155,1,159,109,100,255,112,181,24,255,104,220,108,0,55,211,131,0,99,12,213,255,152,151,145,255,238,5,159,0,97,155,8,0,33,108,81,0,1,3,103,0,62,109,34,255,250,155,180,0,32,71,195,255,38,70,145,1,159,95,245,0,69,229,101,1,136,28,240,0,79,224,25,0,78,110,121,255,248,168,124,0,187,128,247,0,2,147,235,254,79,11,132,0,70,58,12,1,181,8,163,255,79,137,133,255,37,170,11,255,141,243,85,255,176,231,215,255,204,150,164,255,239,215,39,255,46,87,156,254,8,163,88,255,172,34,232,0,66,44,102,255,27,54,41,254,236,99,87,255,41,123,169,1,52,114,43,0,117,134,40,0,155,134,26,0,231,207,91,254,35,132,38,255,19,102,125,254,36,227,133,255,118,3,113,255,29,13,124,0,152,96,74,1,88,146,206,255,167,191,220,254,162,18,88,255,182,100,23,0,31,117,52,0,81,46,106,1,12,2,7,0,69,80,201,1,209,246,172,0,12,48,141,1,224,211,88,0,116,226,159,0,122,98,130,0,65,236,234,1,225,226,9,255,207,226,123,1,89,214,59,0,112,135,88,1,90,244,203,255,49,11,38,1,129,108,186,0,89,112,15,1,101,46,204,255,127,204,45,254,79,255,221,255,51,73,18,255,127,42,101,255,241,21,202,0,160,227,7,0,105,50,236,0,79,52,197,255,104,202,208,1,180,15,16,0,101,197,78,255,98,77,203,0,41,185,241,1,35,193,124,0,35,155,23,255,207,53,192,0,11,125,163,1,249,158,185,255,4,131,48,0,21,93,111,255,61,121,231,1,69,200,36,255,185,48,185,255,111,238,21,255,39,50,25,255,99,215,163,255,87,212,30,255,164,147,5,255,128,6,35,1,108,223,110,255,194,76,178,0,74,101,180,0,243,47,48,0,174,25,43,255,82,173,253,1,54,114,192,255,40,55,91,0,215,108,176,255,11,56,7,0,224,233,76,0,209,98,202,254,242,25,125,0,44,193,93,254,203,8,177,0,135,176,19,0,112,71,213,255,206,59,176,1,4,67,26,0,14,143,213,254,42,55,208,255,60,67,120,0,193,21,163,0,99,164,115,0,10,20,118,0,156,212,222,254,160,7,217,255,114,245,76,1,117,59,123,0,176,194,86,254,213,15,176,0,78,206,207,254,213,129,59,0,233,251,22,1,96,55,152,255,236,255,15,255,197,89,84,255,93,149,133,0,174,160,113,0,234,99,169,255,152,116,88,0,144,164,83,255,95,29,198,255,34,47,15,255,99,120,134,255,5,236,193,0,249,247,126,255,147,187,30,0,50,230,117,255,108,217,219,255,163,81,166,255,72,25,169,254,155,121,79,255,28,155,89,254,7,126,17,0,147,65,33,1,47,234,253,0,26,51,18,0,105,83,199,255,163,196,230,0,113,248,164,0,226,254,218,0,189,209,203,255,164,247,222,254,255,35,165,0,4,188,243,1,127,179,71,0,37,237,254,255,100,186,240,0,5,57,71,254,103,72,73,255,244,18,81,254,229,210,132,255,238,6,180,255,11,229,174,255,227,221,192,1,17,49,28,0,163,215,196,254,9,118,4,255,51,240,71,0,113,129,109,255,76,240,231,0,188,177,127,0,125,71,44,1,26,175,243,0,94,169,25,254,27,230,29,0,15,139,119,1,168,170,186,255,172,197,76,255,252,75,188,0,137,124,196,0,72,22,96,255,45,151,249,1,220,145,100,0,64,192,159,255,120,239,226,0,129,178,146,0,0,192,125,0,235,138,234,0,183,157,146,0,83,199,192,255,184,172,72,255,73,225,128,0,77,6,250,255,186,65,67,0,104,246,207,0,188,32,138,255,218,24,242,0,67,138,81,254,237,129,121,255,20,207,150,1,41,199,16,255,6,20,128,0,159,118,5,0,181,16,143,255,220,38,15,0,23,64,147,254,73,26,13,0,87,228,57,1,204,124,128,0,43,24,223,0,219,99,199,0,22,75,20,255,19,27,126,0,157,62,215,0,110,29,230,0,179,167,255,1,54,252,190,0,221,204,182,254,179,158,65,255,81,157,3,0,194,218,159,0,170,223,0,0,224,11,32,255,38,197,98,0,168,164,37,0,23,88,7,1,164,186,110,0,96,36,134,0,234,242,229,0,250,121,19,0,242,254,112,255,3,47,94,1,9,239,6,255,81,134,153,254,214,253,168,255,67,124,224,0,245,95,74,0,28,30,44,254,1,109,220,255,178,89,89,0,252,36,76,0,24,198,46,255,76,77,111,0,134,234,136,255,39,94,29,0,185,72,234,255,70,68,135,255,231,102,7,254,77,231,140,0,167,47,58,1,148,97,118,255,16,27,225,1,166,206,143,255,110,178,214,255,180,131,162,0,143,141,225,1,13,218,78,255,114,153,33,1,98,104,204,0,175,114,117,1,167,206,75,0,202,196,83,1,58,64,67,0,138,47,111,1,196,247,128,255,137,224,224,254,158,112,207,0,154,100,255,1,134,37,107,0,198,128,79,255,127,209,155,255,163,254,185,254,60,14,243,0,31,219,112,254,29,217,65,0,200,13,116,254,123,60,196,255,224,59,184,254,242,89,196,0,123,16,75,254,149,16,206,0,69,254,48,1,231,116,223,255,209,160,65,1,200,80,98,0,37,194,184,254,148,63,34,0,139,240,65,255,217,144,132,255,56,38,45,254,199,120,210,0,108,177,166,255,160,222,4,0,220,126,119,254,165,107,160,255,82,220,248,1,241,175,136,0,144,141,23,255,169,138,84,0,160,137,78,255,226,118,80,255,52,27,132,255,63,96,139,255,152,250,39,0,188,155,15,0,232,51,150,254,40,15,232,255,240,229,9,255,137,175,27,255,75,73,97,1,218,212,11,0,135,5,162,1,107,185,213,0,2,249,107,255,40,242,70,0,219,200,25,0,25,157,13,0,67,82,80,255,196,249,23,255,145,20,149,0,50,72,146,0,94,76,148,1,24,251,65,0,31,192,23,0,184,212,201,255,123,233,162,1,247,173,72,0,162,87,219,254,126,134,89,0,159,11,12,254,166,105,29,0,73,27,228,1,113,120,183,255,66,163,109,1,212,143,11,255,159,231,168,1,255,128,90,0,57,14,58,254,89,52,10,255,253,8,163,1,0,145,210,255,10,129,85,1,46,181,27,0,103,136,160,254,126,188,209,255,34,35,111,0,215,219,24,255,212,11,214,254,101,5,118,0,232,197,133,255,223,167,109,255,237,80,86,255,70,139,94,0,158,193,191,1,155,15,51,255,15,190,115,0,78,135,207,255,249,10,27,1,181,125,233,0,95,172,13,254,170,213,161,255,39,236,138,255,95,93,87,255,190,128,95,0,125,15,206,0,166,150,159,0,227,15,158,255,206,158,120,255,42,141,128,0,101,178,120,1,156,109,131,0,218,14,44,254,247,168,206,255,212,112,28,0,112,17,228,255,90,16,37,1,197,222,108,0,254,207,83,255,9,90,243,255,243,244,172,0,26,88,115,255,205,116,122,0,191,230,193,0,180,100,11,1,217,37,96,255,154,78,156,0,235,234,31,255,206,178,178,255,149,192,251,0,182,250,135,0,246,22,105,0,124,193,109,255,2,210,149,255,169,17,170,0,0,96,110,255,117,9,8,1,50,123,40,255,193,189,99,0,34,227,160,0,48,80,70,254,211,51,236,0,45,122,245,254,44,174,8,0,173,37,233,255,158,65,171,0,122,69,215,255,90,80,2,255,131,106,96,254,227,114,135,0,205,49,119,254,176,62,64,255,82,51,17,255,241,20,243,255,130,13,8,254,128,217,243,255,162,27,1,254,90,118,241,0,246,198,246,255,55,16,118,255,200,159,157,0,163,17,1,0,140,107,121,0,85,161,118,255,38,0,149,0,156,47,238,0,9,166,166,1,75,98,181,255,50,74,25,0,66,15,47,0,139,225,159,0,76,3,142,255,14,238,184,0,11,207,53,255,183,192,186,1,171,32,174,255,191,76,221,1,247,170,219,0,25,172,50,254,217,9,233,0,203,126,68,255,183,92,48,0,127,167,183,1,65,49,254,0,16,63,127,1,254,21,170,255,59,224,127,254,22,48,63,255,27,78,130,254,40,195,29,0,250,132,112,254,35,203,144,0,104,169,168,0,207,253,30,255,104,40,38,254,94,228,88,0,206,16,128,255,212,55,122,255,223,22,234,0,223,197,127,0,253,181,181,1,145,102,118,0,236,153,36,255,212,217,72,255,20,38,24,254,138,62,62,0,152,140,4,0,230,220,99,255,1,21,212,255,148,201,231,0,244,123,9,254,0,171,210,0,51,58,37,255,1,255,14,255,244,183,145,254,0,242,166,0,22,74,132,0,121,216,41,0,95,195,114,254,133,24,151,255,156,226,231,255,247,5,77,255,246,148,115,254,225,92,81,255,222,80,246,254,170,123,89,255,74,199,141,0,29,20,8,255,138,136,70,255,93,75,92,0,221,147,49,254,52,126,226,0,229,124,23,0,46,9,181,0,205,64,52,1,131,254,28,0,151,158,212,0,131,64,78,0,206,25,171,0,0,230,139,0,191,253,110,254,103,247,167,0,64,40,40,1,42,165,241,255,59,75,228,254,124,243,189,255,196,92,178,255,130,140,86,255,141,89,56,1,147,198,5,255,203,248,158,254,144,162,141,0,11,172,226,0,130,42,21,255,1,167,143,255,144,36,36,255,48,88,164,254,168,170,220,0,98,71,214,0,91,208,79,0,159,76,201,1,166,42,214,255,69,255,0,255,6,128,125,255,190,1,140,0,146,83,218,255,215,238,72,1,122,127,53,0,189,116,165,255,84,8,66,255,214,3,208,255,213,110,133,0,195,168,44,1,158,231,69,0,162,64,200,254,91,58,104,0,182,58,187,254,249,228,136,0,203,134,76,254,99,221,233,0,75,254,214,254,80,69,154,0,64,152,248,254,236,136,202,255,157,105,153,254,149,175,20,0,22,35,19,255,124,121,233,0,186,250,198,254,132,229,139,0,137,80,174,255,165,125,68,0,144,202,148,254,235,239,248,0,135,184,118,0,101,94,17,255,122,72,70,254,69,130,146,0,127,222,248,1,69,127,118,255,30,82,215,254,188,74,19,255,229,167,194,254,117,25,66,255,65,234,56,254,213,22,156,0,151,59,93,254,45,28,27,255,186,126,164,255,32,6,239,0,127,114,99,1,219,52,2,255,99,96,166,254,62,190,126,255,108,222,168,1,75,226,174,0,230,226,199,0,60,117,218,255,252,248,20,1,214,188,204,0,31,194,134,254,123,69,192,255,169,173,36,254,55,98,91,0,223,42,102,254,137,1,102,0,157,90,25,0,239,122,64,255,252,6,233,0,7,54,20,255,82,116,174,0,135,37,54,255,15,186,125,0,227,112,175,255,100,180,225,255,42,237,244,255,244,173,226,254,248,18,33,0,171,99,150,255,74,235,50,255,117,82,32,254,106,168,237,0,207,109,208,1,228,9,186,0,135,60,169,254,179,92,143,0,244,170,104,255,235,45,124,255,70,99,186,0,117,137,183,0,224,31,215,0,40,9,100,0,26,16,95,1,68,217,87,0,8,151,20,255,26,100,58,255,176,165,203,1,52,118,70,0,7,32,254,254,244,254,245,255,167,144,194,255,125,113,23,255,176,121,181,0,136,84,209,0,138,6,30,255,89,48,28,0,33,155,14,255,25,240,154,0,141,205,109,1,70,115,62,255,20,40,107,254,138,154,199,255,94,223,226,255,157,171,38,0,163,177,25,254,45,118,3,255,14,222,23,1,209,190,81,255,118,123,232,1,13,213,101,255,123,55,123,254,27,246,165,0,50,99,76,255,140,214,32,255,97,65,67,255,24,12,28,0,174,86,78,1,64,247,96,0,160,135,67,0,66,55,243,255,147,204,96,255,26,6,33,255,98,51,83,1,153,213,208,255,2,184,54,255,25,218,11,0,49,67,246,254,18,149,72,255,13,25,72,0,42,79,214,0,42,4,38,1,27,139,144,255,149,187,23,0,18,164,132,0,245,84,184,254,120,198,104,255,126,218,96,0,56,117,234,255,13,29,214,254,68,47,10,255,167,154,132,254,152,38,198,0,66,178,89,255,200,46,171,255,13,99,83,255,210,187,253,255,170,45,42,1,138,209,124,0,214,162,141,0,12,230,156,0,102,36,112,254,3,147,67,0,52,215,123,255,233,171,54,255,98,137,62,0,247,218,39,255,231,218,236,0,247,191,127,0,195,146,84,0,165,176,92,255,19,212,94,255,17,74,227,0,88,40,153,1,198,147,1,255,206,67,245,254,240,3,218,255,61,141,213,255,97,183,106,0,195,232,235,254,95,86,154,0,209,48,205,254,118,209,241,255,240,120,223,1,213,29,159,0,163,127,147,255,13,218,93,0,85,24,68,254,70,20,80,255,189,5,140,1,82,97,254,255,99,99,191,255,132,84,133,255,107,218,116,255,112,122,46,0,105,17,32,0,194,160,63,255,68,222,39,1,216,253,92,0,177,105,205,255,149,201,195,0,42,225,11,255,40,162,115,0,9,7,81,0,165,218,219,0,180,22,0,254,29,146,252,255,146,207,225,1,180,135,96,0,31,163,112,0,177,11,219,255,133,12,193,254,43,78,50,0,65,113,121,1,59,217,6,255,110,94,24,1,112,172,111,0,7,15,96,0,36,85,123,0,71,150,21,255,208,73,188,0,192,11,167,1,213,245,34,0,9,230,92,0,162,142,39,255,215,90,27,0,98,97,89,0,94,79,211,0,90,157,240,0,95,220,126,1,102,176,226,0,36,30,224,254,35,31,127,0,231,232,115,1,85,83,130,0,210,73,245,255,47,143,114,255,68,65,197,0,59,72,62,255,183,133,173,254,93,121,118,255,59,177,81,255,234,69,173,255,205,128,177,0,220,244,51,0,26,244,209,1,73,222,77,255,163,8,96,254,150,149,211,0,158,254,203,1,54,127,139,0,161,224,59,0,4,109,22,255,222,42,45,255,208,146,102,255,236,142,187,0,50,205,245,255,10,74,89,254,48,79,142,0,222,76,130,255,30,166,63,0,236,12,13,255,49,184,244,0,187,113,102,0,218,101,253,0,153,57,182,254,32,150,42,0,25,198,146,1,237,241,56,0,140,68,5,0,91,164,172,255,78,145,186,254,67,52,205,0,219,207,129,1,109,115,17,0,54,143,58,1,21,248,120,255,179,255,30,0,193,236,66,255,1,255,7,255,253,192,48,255,19,69,217,1,3,214,0,255,64,101,146,1,223,125,35,255,235,73,179,255,249,167,226,0,225,175,10,1,97,162,58,0,106,112,171,1,84,172,5,255,133,140,178,255,134,245,142,0,97,90,125,255,186,203,185,255,223,77,23,255,192,92,106,0,15,198,115,255,217,152,248,0,171,178,120,255,228,134,53,0,176,54,193,1,250,251,53,0,213,10,100,1,34,199,106,0,151,31,244,254,172,224,87,255,14,237,23,255,253,85,26,255,127,39,116,255,172,104,100,0,251,14,70,255,212,208,138,255,253,211,250,0,176,49,165,0,15,76,123,255,37,218,160,255,92,135,16,1,10,126,114,255,70,5,224,255,247,249,141,0,68,20,60,1,241,210,189,255,195,217,187,1,151,3,113,0,151,92,174,0,231,62,178,255,219,183,225,0,23,23,33,255,205,181,80,0,57,184,248,255,67,180,1,255,90,123,93,255,39,0,162,255,96,248,52,255,84,66,140,0,34,127,228,255,194,138,7,1,166,110,188,0,21,17,155,1,154,190,198,255,214,80,59,255,18,7,143,0,72,29,226,1,199,217,249,0,232,161,71,1,149,190,201,0,217,175,95,254,113,147,67,255,138,143,199,255,127,204,1,0,29,182,83,1,206,230,155,255,186,204,60,0,10,125,85,255,232,96,25,255,255,89,247,255,213,254,175,1,232,193,81,0,28,43,156,254,12,69,8,0,147,24,248,0,18,198,49,0,134,60,35,0,118,246,18,255,49,88,254,254,228,21,186,255,182,65,112,1,219,22,1,255,22,126,52,255,189,53,49,255,112,25,143,0,38,127,55,255,226,101,163,254,208,133,61,255,137,69,174,1,190,118,145,255,60,98,219,255,217,13,245,255,250,136,10,0,84,254,226,0,201,31,125,1,240,51,251,255,31,131,130,255,2,138,50,255,215,215,177,1,223,12,238,255,252,149,56,255,124,91,68,255,72,126,170,254,119,255,100,0,130,135,232,255,14,79,178,0,250,131,197,0,138,198,208,0,121,216,139,254,119,18,36,255,29,193,122,0,16,42,45,255,213,240,235,1,230,190,169,255,198,35,228,254,110,173,72,0,214,221,241,255,56,148,135,0,192,117,78,254,141,93,207,255,143,65,149,0,21,18,98,255,95,44,244,1,106,191,77,0,254,85,8,254,214,110,176,255,73,173,19,254,160,196,199,255,237,90,144,0,193,172,113,255,200,155,136,254,228,90,221,0,137,49,74,1,164,221,215,255,209,189,5,255,105,236,55,255,42,31,129,1,193,255,236,0,46,217,60,0,138,88,187,255,226,82,236,255,81,69,151,255,142,190,16,1,13,134,8,0,127,122,48,255,81,64,156,0,171,243,139,0,237,35,246,0,122,143,193,254,212,122,146,0,95,41,255,1,87,132,77,0,4,212,31,0,17,31,78,0,39,45,173,254,24,142,217,255,95,9,6,255,227,83,6,0,98,59,130,254,62,30,33,0,8,115,211,1,162,97,128,255,7,184,23,254,116,28,168,255,248,138,151,255,98,244,240,0,186,118,130,0,114,248,235,255,105,173,200,1,160,124,71,255,94,36,164,1,175,65,146,255,238,241,170,254,202,198,197,0,228,71,138,254,45,246,109,255,194,52,158,0,133,187,176,0,83,252,154,254,89,189,221,255,170,73,252,0,148,58,125,0,36,68,51,254,42,69,177,255,168,76,86,255,38,100,204,255,38,53,35,0,175,19,97,0,225,238,253,255,81,81,135,0,210,27,255,254,235,73,107,0,8,207,115,0,82,127,136,0,84,99,21,254,207,19,136,0,100,164,101,0,80,208,77,255,132,207,237,255,15,3,15,255,33,166,110,0,156,95,85,255,37,185,111,1,150,106,35,255,166,151,76,0,114,87,135,255,159,194,64,0,12,122,31,255,232,7,101,254,173,119,98,0,154,71,220,254,191,57,53,255,168,232,160,255,224,32,99,255,218,156,165,0,151,153,163,0,217,13,148,1,197,113,89,0,149,28,161,254,207,23,30,0,105,132,227,255,54,230,94,255,133,173,204,255,92,183,157,255,88,144,252,254,102,33,90,0,159,97,3,0,181,218,155,255,240,114,119,0,106,214,53,255,165,190,115,1,152,91,225,255,88,106,44,255,208,61,113,0,151,52,124,0,191,27,156,255,110,54,236,1,14,30,166,255,39,127,207,1,229,199,28,0,188,228,188,254,100,157,235,0,246,218,183,1,107,22,193,255,206,160,95,0,76,239,147,0,207,161,117,0,51,166,2,255,52,117,10,254,73,56,227,255,152,193,225,0,132,94,136,255,101,191,209,0,32,107,229,255,198,43,180,1,100,210,118,0,114,67,153,255,23,88,26,255,89,154,92,1,220,120,140,255,144,114,207,255,252,115,250,255,34,206,72,0,138,133,127,255,8,178,124,1,87,75,97,0,15,229,92,254,240,67,131,255,118,123,227,254,146,120,104,255,145,213,255,1,129,187,70,255,219,119,54,0,1,19,173,0,45,150,148,1,248,83,72,0,203,233,169,1,142,107,56,0,247,249,38,1,45,242,80,255,30,233,103,0,96,82,70,0,23,201,111,0,81,39,30,255,161,183,78,255,194,234,33,255,68,227,140,254,216,206,116,0,70,27,235,255,104,144,79,0,164,230,93,254,214,135,156,0,154,187,242,254,188,20,131,255,36,109,174,0,159,112,241,0,5,110,149,1,36,165,218,0,166,29,19,1,178,46,73,0,93,43,32,254,248,189,237,0,102,155,141,0,201,93,195,255,241,139,253,255,15,111,98,255,108,65,163,254,155,79,190,255,73,174,193,254,246,40,48,255,107,88,11,254,202,97,85,255,253,204,18,255,113,242,66,0,110,160,194,254,208,18,186,0,81,21,60,0,188,104,167,255,124,166,97,254,210,133,142,0,56,242,137,254,41,111,130,0,111,151,58,1,111,213,141,255,183,172,241,255,38,6,196,255,185,7,123,255,46,11,246,0,245,105,119,1,15,2,161,255,8,206,45,255,18,202,74,255,83,124,115,1,212,141,157,0,83,8,209,254,139,15,232,255,172,54,173,254,50,247,132,0,214,189,213,0,144,184,105,0,223,254,248,0,255,147,240,255,23,188,72,0,7,51,54,0,188,25,180,254,220,180,0,255,83,160,20,0,163,189,243,255,58,209,194,255,87,73,60,0,106,24,49,0,245,249,220,0,22,173,167,0,118,11,195,255,19,126,237,0,110,159,37,255,59,82,47,0,180,187,86,0,188,148,208,1,100,37,133,255,7,112,193,0,129,188,156,255,84,106,129,255,133,225,202,0,14,236,111,255,40,20,101,0,172,172,49,254,51,54,74,255,251,185,184,255,93,155,224,255,180,249,224,1,230,178,146,0,72,57,54,254,178,62,184,0,119,205,72,0,185,239,253,255,61,15,218,0,196,67,56,255,234,32,171,1,46,219,228,0,208,108,234,255,20,63,232,255,165,53,199,1,133,228,5,255,52,205,107,0,74,238,140,255,150,156,219,254,239,172,178,255,251,189,223,254,32,142,211,255,218,15,138,1,241,196,80,0,28,36,98,254,22,234,199,0,61,237,220,255,246,57,37,0,142,17,142,255,157,62,26,0,43,238,95,254,3,217,6,255,213,25,240,1,39,220,174,255,154,205,48,254,19,13,192,255,244,34,54,254,140,16,155,0,240,181,5,254,155,193,60,0,166,128,4,255,36,145,56,255,150,240,219,0,120,51,145,0,82,153,42,1,140,236,146,0,107,92,248,1,189,10,3,0,63,136,242,0,211,39,24,0,19,202,161,1,173,27,186,255,210,204,239,254,41,209,162,255,182,254,159,255,172,116,52,0,195,103,222,254,205,69,59,0,53,22,41,1,218,48,194,0,80,210,242,0,210,188,207,0,187,161,161,254,216,17,1,0,136,225,113,0,250,184,63,0,223,30,98,254,77,168,162,0,59,53,175,0,19,201,10,255,139,224,194,0,147,193,154,255,212,189,12,254,1,200,174,255,50,133,113,1,94,179,90,0,173,182,135,0,94,177,113,0,43,89,215,255,136,252,106,255,123,134,83,254,5,245,66,255,82,49,39,1,220,2,224,0,97,129,177,0,77,59,89,0,61,29,155,1,203,171,220,255,92,78,139,0,145,33,181,255,169,24,141,1,55,150,179,0,139,60,80,255,218,39,97,0,2,147,107,255,60,248,72,0,173,230,47,1,6,83,182,255,16,105,162,254,137,212,81,255,180,184,134,1,39,222,164,255,221,105,251,1,239,112,125,0,63,7,97,0,63,104,227,255,148,58,12,0,90,60,224,255,84,212,252,0,79,215,168,0,248,221,199,1,115,121,1,0,36,172,120,0,32,162,187,255,57,107,49,255,147,42,21,0,106,198,43,1,57,74,87,0,126,203,81,255,129,135,195,0,140,31,177,0,221,139,194,0,3,222,215,0,131,68,231,0,177,86,178,254,124,151,180,0,184,124,38,1,70,163,17,0,249,251,181,1,42,55,227,0,226,161,44,0,23,236,110,0,51,149,142,1,93,5,236,0,218,183,106,254,67,24,77,0,40,245,209,255,222,121,153,0,165,57,30,0,83,125,60,0,70,38,82,1,229,6,188,0,109,222,157,255,55,118,63,255,205,151,186,0,227,33,149,255,254,176,246,1,227,177,227,0,34,106,163,254,176,43,79,0,106,95,78,1,185,241,122,255,185,14,61,0,36,1,202,0,13,178,162,255,247,11,132,0,161,230,92,1,65,1,185,255,212,50,165,1,141,146,64,255,158,242,218,0,21,164,125,0,213,139,122,1,67,71,87,0,203,158,178,1,151,92,43,0,152,111,5,255,39,3,239,255,217,255,250,255,176,63,71,255,74,245,77,1,250,174,18,255,34,49,227,255,246,46,251,255,154,35,48,1,125,157,61,255,106,36,78,255,97,236,153,0,136,187,120,255,113,134,171,255,19,213,217,254,216,94,209,255,252,5,61,0,94,3,202,0,3,26,183,255,64,191,43,255,30,23,21,0,129,141,77,255,102,120,7,1,194,76,140,0,188,175,52,255,17,81,148,0,232,86,55,1,225,48,172,0,134,42,42,255,238,50,47,0,169,18,254,0,20,147,87,255,14,195,239,255,69,247,23,0,238,229,128,255,177,49,112,0,168,98,251,255,121,71,248,0,243,8,145,254,246,227,153,255,219,169,177,254,251,139,165,255,12,163,185,255,164,40,171,255,153,159,27,254,243,109,91,255,222,24,112,1,18,214,231,0,107,157,181,254,195,147,0,255,194,99,104,255,89,140,190,255,177,66,126,254,106,185,66,0,49,218,31,0,252,174,158,0,188,79,230,1,238,41,224,0,212,234,8,1,136,11,181,0,166,117,83,255,68,195,94,0,46,132,201,0,240,152,88,0,164,57,69,254,160,224,42,255,59,215,67,255,119,195,141,255,36,180,121,254,207,47,8,255,174,210,223,0,101,197,68,255,255,82,141,1,250,137,233,0,97,86,133,1,16,80,69,0,132,131,159,0,116,93,100,0,45,141,139,0,152,172,157,255,90,43,91,0,71,153,46,0,39,16,112,255,217,136,97,255,220,198,25,254,177,53,49,0,222,88,134,255,128,15,60,0,207,192,169,255,192,116,209,255,106,78,211,1,200,213,183,255,7,12,122,254,222,203,60,255,33,110,199,254,251,106,117,0,228,225,4,1,120,58,7,255,221,193,84,254,112,133,27,0,189,200,201,255,139,135,150,0,234,55,176,255,61,50,65,0,152,108,169,255,220,85,1,255,112,135,227,0,162,26,186,0,207,96,185,254,244,136,107,0,93,153,50,1,198,97,151,0,110,11,86,255,143,117,174,255,115,212,200,0,5,202,183,0,237,164,10,254,185,239,62,0,236,120,18,254,98,123,99,255,168,201,194,254,46,234,214,0,191,133,49,255,99,169,119,0,190,187,35,1,115,21,45,255,249,131,72,0,112,6,123,255,214,49,181,254,166,233,34,0,92,197,102,254,253,228,205,255,3,59,201,1,42,98,46,0,219,37,35,255,169,195,38,0,94,124,193,1,156,43,223,0,95,72,133,254,120,206,191,0,122,197,239,255,177,187,79,255,254,46,2,1,250,167,190,0,84,129,19,0,203,113,166,255,249,31,189,254,72,157,202,255,208,71,73,255,207,24,72,0,10,16,18,1,210,81,76,255,88,208,192,255,126,243,107,255,238,141,120,255,199,121,234,255,137,12,59,255,36,220,123,255,148,179,60,254,240,12,29,0,66,0,97,1,36,30,38,255,115,1,93,255,96,103,231,255,197,158,59,1,192,164,240,0,202,202,57,255,24,174,48,0,89,77,155,1,42,76,215,0,244,151,233,0,23,48,81,0,239,127,52,254,227,130,37,255,248,116,93,1,124,132,118,0,173,254,192,1,6,235,83,255,110,175,231,1,251,28,182,0,129,249,93,254,84,184,128,0,76,181,62,0,175,128,186,0,100,53,136,254,109,29,226,0,221,233,58,1,20,99,74,0,0,22,160,0,134,13,21,0,9,52,55,255,17,89,140,0,175,34,59,0,84,165,119,255,224,226,234,255,7,72,166,255,123,115,255,1,18,214,246,0,250,7,71,1,217,220,185,0,212,35,76,255,38,125,175,0,189,97,210,0,114,238,44,255,41,188,169,254,45,186,154,0,81,92,22,0,132,160,193,0,121,208,98,255,13,81,44,255,203,156,82,0,71,58,21,255,208,114,191,254,50,38,147,0,154,216,195,0,101,25,18,0,60,250,215,255,233,132,235,255,103,175,142,1,16,14,92,0,141,31,110,254,238,241,45,255,153,217,239,1,97,168,47,255,249,85,16,1,28,175,62,255,57,254,54,0,222,231,126,0,166,45,117,254,18,189,96,255,228,76,50,0,200,244,94,0,198,152,120,1,68,34,69,255,12,65,160,254,101,19,90,0,167,197,120,255,68,54,185,255,41,218,188,0,113,168,48,0,88,105,189,1,26,82,32,255,185,93,164,1,228,240,237,255,66,182,53,0,171,197,92,255,107,9,233,1,199,120,144,255,78,49,10,255,109,170,105,255,90,4,31,255,28,244,113,255,74,58,11,0,62,220,246,255,121,154,200,254,144,210,178,255,126,57,129,1,43,250,14,255,101,111,28,1,47,86,241,255,61,70,150,255,53,73,5,255,30,26,158,0,209,26,86,0,138,237,74,0,164,95,188,0,142,60,29,254,162,116,248,255,187,175,160,0,151,18,16,0,209,111,65,254,203,134,39,255,88,108,49,255,131,26,71,255,221,27,215,254,104,105,93,255,31,236,31,254,135,0,211,255,143,127,110,1,212,73,229,0,233,67,167,254,195,1,208,255,132,17,221,255,51,217,90,0,67,235,50,255,223,210,143,0,179,53,130,1,233,106,198,0,217,173,220,255,112,229,24,255,175,154,93,254,71,203,246,255,48,66,133,255,3,136,230,255,23,221,113,254,235,111,213,0,170,120,95,254,251,221,2,0,45,130,158,254,105,94,217,255,242,52,180,254,213,68,45,255,104,38,28,0,244,158,76,0,161,200,96,255,207,53,13,255,187,67,148,0,170,54,248,0,119,162,178,255,83,20,11,0,42,42,192,1,146,159,163,255,183,232,111,0,77,229,21,255,71,53,143,0,27,76,34,0,246,136,47,255,219,39,182,255,92,224,201,1,19,142,14,255,69,182,241,255,163,118,245,0,9,109,106,1,170,181,247,255,78,47,238,255,84,210,176,255,213,107,139,0,39,38,11,0,72,21,150,0,72,130,69,0,205,77,155,254,142,133,21,0,71,111,172,254,226,42,59,255,179,0,215,1,33,128,241,0,234,252,13,1,184,79,8,0,110,30,73,255,246,141,189,0,170,207,218,1,74,154,69,255,138,246,49,255,155,32,100,0,125,74,105,255,90,85,61,255,35,229,177,255,62,125,193,255,153,86,188,1,73,120,212,0,209,123,246,254,135,209,38,255,151,58,44,1,92,69,214,255,14,12,88,255,252,153,166,255,253,207,112,255,60,78,83,255,227,124,110,0,180,96,252,255,53,117,33,254,164,220,82,255,41,1,27,255,38,164,166,255,164,99,169,254,61,144,70,255,192,166,18,0,107,250,66,0,197,65,50,0,1,179,18,255,255,104,1,255,43,153,35,255,80,111,168,0,110,175,168,0,41,105,45,255,219,14,205,255,164,233,140,254,43,1,118,0,233,67,195,0,178,82,159,255,138,87,122,255,212,238,90,255,144,35,124,254,25,140,164,0,251,215,44,254,133,70,107,255,101,227,80,254,92,169,55,0,215,42,49,0,114,180,85,255,33,232,27,1,172,213,25,0,62,176,123,254,32,133,24,255,225,191,62,0,93,70,153,0,181,42,104,1,22,191,224,255,200,200,140,255,249,234,37,0,149,57,141,0,195,56,208,255,254,130,70,255,32,173,240,255,29,220,199,0,110,100,115,255,132,229,249,0,228,233,223,255,37,216,209,254,178,177,209,255,183,45,165,254,224,97,114,0,137,97,168,255,225,222,172,0,165,13,49,1,210,235,204,255,252,4,28,254,70,160,151,0,232,190,52,254,83,248,93,255,62,215,77,1,175,175,179,255,160,50,66,0,121,48,208,0,63,169,209,255,0,210,200,0,224,187,44,1,73,162,82,0,9,176,143,255,19,76,193,255,29,59,167,1,24,43,154,0,28,190,190,0,141,188,129,0,232,235,203,255,234,0,109,255,54,65,159,0,60,88,232,255,121,253,150,254,252,233,131,255,198,110,41,1,83,77,71,255,200,22,59,254,106,253,242,255,21,12,207,255,237,66,189,0,90,198,202,1,225,172,127,0,53,22,202,0,56,230,132,0,1,86,183,0,109,190,42,0,243,68,174,1,109,228,154,0,200,177,122,1,35,160,183,255,177,48,85,255,90,218,169,255,248,152,78,0,202,254,110,0,6,52,43,0,142,98,65,255,63,145,22,0,70,106,93,0,232,138,107,1,110,179,61,255,211,129,218,1,242,209,92,0,35,90,217,1,182,143,106,255,116,101,217,255,114,250,221,255,173,204,6,0,60,150,163,0,73,172,44,255,239,110,80,255,237,76,153,254,161,140,249,0,149,232,229,0,133,31,40,255,174,164,119,0,113,51,214,0,129,228,2,254,64,34,243,0,107,227,244,255,174,106,200,255,84,153,70,1,50,35,16,0,250,74,216,254,236,189,66,255,153,249,13,0,230,178,4,255,221,41,238,0,118,227,121,255,94,87,140,254,254,119,92,0,73,239,246,254,117,87,128,0,19,211,145,255,177,46,252,0,229,91,246,1,69,128,247,255,202,77,54,1,8,11,9,255,153,96,166,0,217,214,173,255,134,192,2,1,0,207,0,0,189,174,107,1,140,134,100,0,158,193,243,1,182,102,171,0,235,154,51,0,142,5,123,255,60,168,89,1,217,14,92,255,19,214,5,1,211,167,254,0,44,6,202,254,120,18,236,255,15,113,184,255,184,223,139,0,40,177,119,254,182,123,90,255,176,165,176,0,247,77,194,0,27,234,120,0,231,0,214,255,59,39,30,0,125,99,145,255,150,68,68,1,141,222,248,0,153,123,210,255,110,127,152,255,229,33,214,1,135,221,197,0,137,97,2,0,12,143,204,255,81,41,188,0,115,79,130,255,94,3,132,0,152,175,187,255,124,141,10,255,126,192,179,255,11,103,198,0,149,6,45,0,219,85,187,1,230,18,178,255,72,182,152,0,3,198,184,255,128,112,224,1,97,161,230,0,254,99,38,255,58,159,197,0,151,66,219,0,59,69,143,255,185,112,249,0,119,136,47,255,123,130,132,0,168,71,95,255,113,176,40,1,232,185,173,0,207,93,117,1,68,157,108,255,102,5,147,254,49,97,33,0,89,65,111,254,247,30,163,255,124,217,221,1,102,250,216,0,198,174,75,254,57,55,18,0].concat([227,5,236,1,229,213,173,0,201,109,218,1,49,233,239,0,30,55,158,1,25,178,106,0,155,111,188,1,94,126,140,0,215,31,238,1,77,240,16,0,213,242,25,1,38,71,168,0,205,186,93,254,49,211,140,255,219,0,180,255,134,118,165,0,160,147,134,255,110,186,35,255,198,243,42,0,243,146,119,0,134,235,163,1,4,241,135,255,193,46,193,254,103,180,79,255,225,4,184,254,242,118,130,0,146,135,176,1,234,111,30,0,69,66,213,254,41,96,123,0,121,94,42,255,178,191,195,255,46,130,42,0,117,84,8,255,233,49,214,254,238,122,109,0,6,71,89,1,236,211,123,0,244,13,48,254,119,148,14,0,114,28,86,255,75,237,25,255,145,229,16,254,129,100,53,255,134,150,120,254,168,157,50,0,23,72,104,255,224,49,14,0,255,123,22,255,151,185,151,255,170,80,184,1,134,182,20,0,41,100,101,1,153,33,16,0,76,154,111,1,86,206,234,255,192,160,164,254,165,123,93,255,1,216,164,254,67,17,175,255,169,11,59,255,158,41,61,255,73,188,14,255,195,6,137,255,22,147,29,255,20,103,3,255,246,130,227,255,122,40,128,0,226,47,24,254,35,36,32,0,152,186,183,255,69,202,20,0,195,133,195,0,222,51,247,0,169,171,94,1,183,0,160,255,64,205,18,1,156,83,15,255,197,58,249,254,251,89,110,255,50,10,88,254,51,43,216,0,98,242,198,1,245,151,113,0,171,236,194,1,197,31,199,255,229,81,38,1,41,59,20,0,253,104,230,0,152,93,14,255,246,242,146,254,214,169,240,255,240,102,108,254,160,167,236,0,154,218,188,0,150,233,202,255,27,19,250,1,2,71,133,255,175,12,63,1,145,183,198,0,104,120,115,255,130,251,247,0,17,212,167,255,62,123,132,255,247,100,189,0,155,223,152,0,143,197,33,0,155,59,44,255,150,93,240,1,127,3,87,255,95,71,207,1,167,85,1,255,188,152,116,255,10,23,23,0,137,195,93,1,54,98,97,0,240,0,168,255,148,188,127,0,134,107,151,0,76,253,171,0,90,132,192,0,146,22,54,0,224,66,54,254,230,186,229,255,39,182,196,0,148,251,130,255,65,131,108,254,128,1,160,0,169,49,167,254,199,254,148,255,251,6,131,0,187,254,129,255,85,82,62,0,178,23,58,255,254,132,5,0,164,213,39,0,134,252,146,254,37,53,81,255,155,134,82,0,205,167,238,255,94,45,180,255,132,40,161,0,254,111,112,1,54,75,217,0,179,230,221,1,235,94,191,255,23,243,48,1,202,145,203,255,39,118,42,255,117,141,253,0,254,0,222,0,43,251,50,0,54,169,234,1,80,68,208,0,148,203,243,254,145,7,135,0,6,254,0,0,252,185,127,0,98,8,129,255,38,35,72,255,211,36,220,1,40,26,89,0,168,64,197,254,3,222,239,255,2,83,215,254,180,159,105,0,58,115,194,0,186,116,106,255,229,247,219,255,129,118,193,0,202,174,183,1,166,161,72,0,201,107,147,254,237,136,74,0,233,230,106,1,105,111,168,0,64,224,30,1,1,229,3,0,102,151,175,255,194,238,228,255,254,250,212,0,187,237,121,0,67,251,96,1,197,30,11,0,183,95,204,0,205,89,138,0,64,221,37,1,255,223,30,255,178,48,211,255,241,200,90,255,167,209,96,255,57,130,221,0,46,114,200,255,61,184,66,0,55,182,24,254,110,182,33,0,171,190,232,255,114,94,31,0,18,221,8,0,47,231,254,0,255,112,83,0,118,15,215,255,173,25,40,254,192,193,31,255,238,21,146,255,171,193,118,255,101,234,53,254,131,212,112,0,89,192,107,1,8,208,27,0,181,217,15,255,231,149,232,0,140,236,126,0,144,9,199,255,12,79,181,254,147,182,202,255,19,109,182,255,49,212,225,0,74,163,203,0,175,233,148,0,26,112,51,0,193,193,9,255,15,135,249,0,150,227,130,0,204,0,219,1,24,242,205,0,238,208,117,255,22,244,112,0,26,229,34,0,37,80,188,255,38,45,206,254,240,90,225,255,29,3,47,255,42,224,76,0,186,243,167,0,32,132,15,255,5,51,125,0,139,135,24,0,6,241,219,0,172,229,133,255,246,214,50,0,231,11,207,255,191,126,83,1,180,163,170,255,245,56,24,1,178,164,211,255,3,16,202,1,98,57,118,255,141,131,89,254,33,51,24,0,243,149,91,255,253,52,14,0,35,169,67,254,49,30,88,255,179,27,36,255,165,140,183,0,58,189,151,0,88,31,0,0,75,169,66,0,66,101,199,255,24,216,199,1,121,196,26,255,14,79,203,254,240,226,81,255,94,28,10,255,83,193,240,255,204,193,131,255,94,15,86,0,218,40,157,0,51,193,209,0,0,242,177,0,102,185,247,0,158,109,116,0,38,135,91,0,223,175,149,0,220,66,1,255,86,60,232,0,25,96,37,255,225,122,162,1,215,187,168,255,158,157,46,0,56,171,162,0,232,240,101,1,122,22,9,0,51,9,21,255,53,25,238,255,217,30,232,254,125,169,148,0,13,232,102,0,148,9,37,0,165,97,141,1,228,131,41,0,222,15,243,255,254,18,17,0,6,60,237,1,106,3,113,0,59,132,189,0,92,112,30,0,105,208,213,0,48,84,179,255,187,121,231,254,27,216,109,255,162,221,107,254,73,239,195,255,250,31,57,255,149,135,89,255,185,23,115,1,3,163,157,255,18,112,250,0,25,57,187,255,161,96,164,0,47,16,243,0,12,141,251,254,67,234,184,255,41,18,161,0,175,6,96,255,160,172,52,254,24,176,183,255,198,193,85,1,124,121,137,255,151,50,114,255,220,203,60,255,207,239,5,1,0,38,107,255,55,238,94,254,70,152,94,0,213,220,77,1,120,17,69,255,85,164,190,255,203,234,81,0,38,49,37,254,61,144,124,0,137,78,49,254,168,247,48,0,95,164,252,0,105,169,135,0,253,228,134,0,64,166,75,0,81,73,20,255,207,210,10,0,234,106,150,255,94,34,90,255,254,159,57,254,220,133,99,0,139,147,180,254,24,23,185,0,41,57,30,255,189,97,76,0,65,187,223,255,224,172,37,255,34,62,95,1,231,144,240,0,77,106,126,254,64,152,91,0,29,98,155,0,226,251,53,255,234,211,5,255,144,203,222,255,164,176,221,254,5,231,24,0,179,122,205,0,36,1,134,255,125,70,151,254,97,228,252,0,172,129,23,254,48,90,209,255,150,224,82,1,84,134,30,0,241,196,46,0,103,113,234,255,46,101,121,254,40,124,250,255,135,45,242,254,9,249,168,255,140,108,131,255,143,163,171,0,50,173,199,255,88,222,142,255,200,95,158,0,142,192,163,255,7,117,135,0,111,124,22,0,236,12,65,254,68,38,65,255,227,174,254,0,244,245,38,0,240,50,208,255,161,63,250,0,60,209,239,0,122,35,19,0,14,33,230,254,2,159,113,0,106,20,127,255,228,205,96,0,137,210,174,254,180,212,144,255,89,98,154,1,34,88,139,0,167,162,112,1,65,110,197,0,241,37,169,0,66,56,131,255,10,201,83,254,133,253,187,255,177,112,45,254,196,251,0,0,196,250,151,255,238,232,214,255,150,209,205,0,28,240,118,0,71,76,83,1,236,99,91,0,42,250,131,1,96,18,64,255,118,222,35,0,113,214,203,255,122,119,184,255,66,19,36,0,204,64,249,0,146,89,139,0,134,62,135,1,104,233,101,0,188,84,26,0,49,249,129,0,208,214,75,255,207,130,77,255,115,175,235,0,171,2,137,255,175,145,186,1,55,245,135,255,154,86,181,1,100,58,246,255,109,199,60,255,82,204,134,255,215,49,230,1,140,229,192,255,222,193,251,255,81,136,15,255,179,149,162,255,23,39,29,255,7,95,75,254,191,81,222,0,241,81,90,255,107,49,201,255,244,211,157,0,222,140,149,255,65,219,56,254,189,246,90,255,178,59,157,1,48,219,52,0,98,34,215,0,28,17,187,255,175,169,24,0,92,79,161,255,236,200,194,1,147,143,234,0,229,225,7,1,197,168,14,0,235,51,53,1,253,120,174,0,197,6,168,255,202,117,171,0,163,21,206,0,114,85,90,255,15,41,10,255,194,19,99,0,65,55,216,254,162,146,116,0,50,206,212,255,64,146,29,255,158,158,131,1,100,165,130,255,172,23,129,255,125,53,9,255,15,193,18,1,26,49,11,255,181,174,201,1,135,201,14,255,100,19,149,0,219,98,79,0,42,99,143,254,96,0,48,255,197,249,83,254,104,149,79,255,235,110,136,254,82,128,44,255,65,41,36,254,88,211,10,0,187,121,187,0,98,134,199,0,171,188,179,254,210,11,238,255,66,123,130,254,52,234,61,0,48,113,23,254,6,86,120,255,119,178,245,0,87,129,201,0,242,141,209,0,202,114,85,0,148,22,161,0,103,195,48,0,25,49,171,255,138,67,130,0,182,73,122,254,148,24,130,0,211,229,154,0,32,155,158,0,84,105,61,0,177,194,9,255,166,89,86,1,54,83,187,0,249,40,117,255,109,3,215,255,53,146,44,1,63,47,179,0,194,216,3,254,14,84,136,0,136,177,13,255,72,243,186,255,117,17,125,255,211,58,211,255,93,79,223,0,90,88,245,255,139,209,111,255,70,222,47,0,10,246,79,255,198,217,178,0,227,225,11,1,78,126,179,255,62,43,126,0,103,148,35,0,129,8,165,254,245,240,148,0,61,51,142,0,81,208,134,0,15,137,115,255,211,119,236,255,159,245,248,255,2,134,136,255,230,139,58,1,160,164,254,0,114,85,141,255,49,166,182,255,144,70,84,1,85,182,7,0,46,53,93,0,9,166,161,255,55,162,178,255,45,184,188,0,146,28,44,254,169,90,49,0,120,178,241,1,14,123,127,255,7,241,199,1,189,66,50,255,198,143,101,254,189,243,135,255,141,24,24,254,75,97,87,0,118,251,154,1,237,54,156,0,171,146,207,255,131,196,246,255,136,64,113,1,151,232,57,0,240,218,115,0,49,61,27,255,64,129,73,1,252,169,27,255,40,132,10,1,90,201,193,255,252,121,240,1,186,206,41,0,43,198,97,0,145,100,183,0,204,216,80,254,172,150,65,0,249,229,196,254,104,123,73,255,77,104,96,254,130,180,8,0,104,123,57,0,220,202,229,255,102,249,211,0,86,14,232,255,182,78,209,0,239,225,164,0,106,13,32,255,120,73,17,255,134,67,233,0,83,254,181,0,183,236,112,1,48,64,131,255,241,216,243,255,65,193,226,0,206,241,100,254,100,134,166,255,237,202,197,0,55,13,81,0,32,124,102,255,40,228,177,0,118,181,31,1,231,160,134,255,119,187,202,0,0,142,60,255,128,38,189,255,166,201,150,0,207,120,26,1,54,184,172,0,12,242,204,254,133,66,230,0,34,38,31,1,184,112,80,0,32,51,165,254,191,243,55,0,58,73,146,254,155,167,205,255,100,104,152,255,197,254,207,255,173,19,247,0,238,10,202,0,239,151,242,0,94,59,39,255,240,29,102,255,10,92,154,255,229,84,219,255,161,129,80,0,208,90,204,1,240,219,174,255,158,102,145,1,53,178,76,255,52,108,168,1,83,222,107,0,211,36,109,0,118,58,56,0,8,29,22,0,237,160,199,0,170,209,157,0,137,71,47,0,143,86,32,0,198,242,2,0,212,48,136,1,92,172,186,0,230,151,105,1,96,191,229,0,138,80,191,254,240,216,130,255,98,43,6,254,168,196,49,0,253,18,91,1,144,73,121,0,61,146,39,1,63,104,24,255,184,165,112,254,126,235,98,0,80,213,98,255,123,60,87,255,82,140,245,1,223,120,173,255,15,198,134,1,206,60,239,0,231,234,92,255,33,238,19,255,165,113,142,1,176,119,38,0,160,43,166,254,239,91,105,0,107,61,194,1,25,4,68,0,15,139,51,0,164,132,106,255,34,116,46,254,168,95,197,0,137,212,23,0,72,156,58,0,137,112,69,254,150,105,154,255,236,201,157,0,23,212,154,255,136,82,227,254,226,59,221,255,95,149,192,0,81,118,52,255,33,43,215,1,14,147,75,255,89,156,121,254,14,18,79,0,147,208,139,1,151,218,62,255,156,88,8,1,210,184,98,255,20,175,123,255,102,83,229,0,220,65,116,1,150,250,4,255,92,142,220,255,34,247,66,255,204,225,179,254,151,81,151,0,71,40,236,255,138,63,62,0,6,79,240,255,183,185,181,0,118,50,27,0,63,227,192,0,123,99,58,1,50,224,155,255,17,225,223,254,220,224,77,255,14,44,123,1,141,128,175,0,248,212,200,0,150,59,183,255,147,97,29,0,150,204,181,0,253,37,71,0,145,85,119,0,154,200,186,0,2,128,249,255,83,24,124,0,14,87,143,0,168,51,245,1,124,151,231,255,208,240,197,1,124,190,185,0,48,58,246,0,20,233,232,0,125,18,98,255,13,254,31,255,245,177,130,255,108,142,35,0,171,125,242,254,140,12,34,255,165,161,162,0,206,205,101,0,247,25,34,1,100,145,57,0,39,70,57,0,118,204,203,255,242,0,162,0,165,244,30,0,198,116,226,0,128,111,153,255,140,54,182,1,60,122,15,255,155,58,57,1,54,50,198,0,171,211,29,255,107,138,167,255,173,107,199,255,109,161,193,0,89,72,242,255,206,115,89,255,250,254,142,254,177,202,94,255,81,89,50,0,7,105,66,255,25,254,255,254,203,64,23,255,79,222,108,255,39,249,75,0,241,124,50,0,239,152,133,0,221,241,105,0,147,151,98,0,213,161,121,254,242,49,137,0,233,37,249,254,42,183,27,0,184,119,230,255,217,32,163,255,208,251,228,1,137,62,131,255,79,64,9,254,94,48,113,0,17,138,50,254,193,255,22,0,247,18,197,1,67,55,104,0,16,205,95,255,48,37,66,0,55,156,63,1,64,82,74,255,200,53,71,254,239,67,125,0,26,224,222,0,223,137,93,255,30,224,202,255,9,220,132,0,198,38,235,1,102,141,86,0,60,43,81,1,136,28,26,0,233,36,8,254,207,242,148,0,164,162,63,0,51,46,224,255,114,48,79,255,9,175,226,0,222,3,193,255,47,160,232,255,255,93,105,254,14,42,230,0,26,138,82,1,208,43,244,0,27,39,38,255,98,208,127,255,64,149,182,255,5,250,209,0,187,60,28,254,49,25,218,255,169,116,205,255,119,18,120,0,156,116,147,255,132,53,109,255,13,10,202,0,110,83,167,0,157,219,137,255,6,3,130,255,50,167,30,255,60,159,47,255,129,128,157,254,94,3,189,0,3,166,68,0,83,223,215,0,150,90,194,1,15,168,65,0,227,83,51,255,205,171,66,255,54,187,60,1,152,102,45,255,119,154,225,0,240,247,136,0,100,197,178,255,139,71,223,255,204,82,16,1,41,206,42,255,156,192,221,255,216,123,244,255,218,218,185,255,187,186,239,255,252,172,160,255,195,52,22,0,144,174,181,254,187,100,115,255,211,78,176,255,27,7,193,0,147,213,104,255,90,201,10,255,80,123,66,1,22,33,186,0,1,7,99,254,30,206,10,0,229,234,5,0,53,30,210,0,138,8,220,254,71,55,167,0,72,225,86,1,118,190,188,0,254,193,101,1,171,249,172,255,94,158,183,254,93,2,108,255,176,93,76,255,73,99,79,255,74,64,129,254,246,46,65,0,99,241,127,254,246,151,102,255,44,53,208,254,59,102,234,0,154,175,164,255,88,242,32,0,111,38,1,0,255,182,190,255,115,176,15,254,169,60,129,0,122,237,241,0,90,76,63,0,62,74,120,255,122,195,110,0,119,4,178,0,222,242,210,0,130,33,46,254,156,40,41,0,167,146,112,1,49,163,111,255,121,176,235,0,76,207,14,255,3,25,198,1,41,235,213,0,85,36,214,1,49,92,109,255,200,24,30,254,168,236,195,0,145,39,124,1,236,195,149,0,90,36,184,255,67,85,170,255,38,35,26,254,131,124,68,255,239,155,35,255,54,201,164,0,196,22,117,255,49,15,205,0,24,224,29,1,126,113,144,0,117,21,182,0,203,159,141,0,223,135,77,0,176,230,176,255,190,229,215,255,99,37,181,255,51,21,138,255,25,189,89,255,49,48,165,254,152,45,247,0,170,108,222,0,80,202,5,0,27,69,103,254,204,22,129,255,180,252,62,254,210,1,91,255,146,110,254,255,219,162,28,0,223,252,213,1,59,8,33,0,206,16,244,0,129,211,48,0,107,160,208,0,112,59,209,0,109,77,216,254,34,21,185,255,246,99,56,255,179,139,19,255,185,29,50,255,84,89,19,0,74,250,98,255,225,42,200,255,192,217,205,255,210,16,167,0,99,132,95,1,43,230,57,0,254,11,203,255,99,188,63,255,119,193,251,254,80,105,54,0,232,181,189,1,183,69,112,255,208,171,165,255,47,109,180,255,123,83,165,0,146,162,52,255,154,11,4,255,151,227,90,255,146,137,97,254,61,233,41,255,94,42,55,255,108,164,236,0,152,68,254,0,10,140,131,255,10,106,79,254,243,158,137,0,67,178,66,254,177,123,198,255,15,62,34,0,197,88,42,255,149,95,177,255,152,0,198,255,149,254,113,255,225,90,163,255,125,217,247,0,18,17,224,0,128,66,120,254,192,25,9,255,50,221,205,0,49,212,70,0,233,255,164,0,2,209,9,0,221,52,219,254,172,224,244,255,94,56,206,1,242,179,2,255,31,91,164,1,230,46,138,255,189,230,220,0,57,47,61,255,111,11,157,0,177,91,152,0,28,230,98,0,97,87,126,0,198,89,145,255,167,79,107,0,249,77,160,1,29,233,230,255,150,21,86,254,60,11,193,0,151,37,36,254,185,150,243,255,228,212,83,1,172,151,180,0,201,169,155,0,244,60,234,0,142,235,4,1,67,218,60,0,192,113,75,1,116,243,207,255,65,172,155,0,81,30,156,255,80,72,33,254,18,231,109,255,142,107,21,254,125,26,132,255,176,16,59,255,150,201,58,0,206,169,201,0,208,121,226,0,40,172,14,255,150,61,94,255,56,57,156,255,141,60,145,255,45,108,149,255,238,145,155,255,209,85,31,254,192,12,210,0,99,98,93,254,152,16,151,0,225,185,220,0,141,235,44,255,160,172,21,254,71,26,31,255,13,64,93,254,28,56,198,0,177,62,248,1,182,8,241,0,166,101,148,255,78,81,133,255,129,222,215,1,188,169,129,255,232,7,97,0,49,112,60,255,217,229,251,0,119,108,138,0,39,19,123,254,131,49,235,0,132,84,145,0,130,230,148,255,25,74,187,0,5,245,54,255,185,219,241,1,18,194,228,255,241,202,102,0,105,113,202,0,155,235,79,0,21,9,178,255,156,1,239,0,200,148,61,0,115,247,210,255,49,221,135,0,58,189,8,1,35,46,9,0,81,65,5,255,52,158,185,255,125,116,46,255,74,140,13,255,210,92,172,254,147,23,71,0,217,224,253,254,115,108,180,255,145,58,48,254,219,177,24,255,156,255,60,1,154,147,242,0,253,134,87,0,53,75,229,0,48,195,222,255,31,175,50,255,156,210,120,255,208,35,222,255,18,248,179,1,2,10,101,255,157,194,248,255,158,204,101,255,104,254,197,255,79,62,4,0,178,172,101,1,96,146,251,255,65,10,156,0,2,137,165,255,116,4,231,0,242,215,1,0,19,35,29,255,43,161,79,0,59,149,246,1,251,66,176,0,200,33,3,255,80,110,142,255,195,161,17,1,228,56,66,255,123,47,145,254,132,4,164,0,67,174,172,0,25,253,114,0,87,97,87,1,250,220,84,0,96,91,200,255,37,125,59,0,19,65,118,0,161,52,241,255,237,172,6,255,176,191,255,255,1,65,130,254,223,190,230,0,101,253,231,255,146,35,109,0,250,29,77,1,49,0,19,0,123,90,155,1,22,86,32,255,218,213,65,0,111,93,127,0,60,93,169,255,8,127,182,0,17,186,14,254,253,137,246,255,213,25,48,254,76,238,0,255,248,92,70,255,99,224,139,0,184,9,255,1,7,164,208,0,205,131,198,1,87,214,199,0,130,214,95,0,221,149,222,0,23,38,171,254,197,110,213,0,43,115,140,254,215,177,118,0,96,52,66,1,117,158,237,0,14,64,182,255,46,63,174,255,158,95,190,255,225,205,177,255,43,5,142,255,172,99,212,255,244,187,147,0,29,51,153,255,228,116,24,254,30,101,207,0,19,246,150,255,134,231,5,0,125,134,226,1,77,65,98,0,236,130,33,255,5,110,62,0,69,108,127,255,7,113,22,0,145,20,83,254,194,161,231,255,131,181,60,0,217,209,177,255,229,148,212,254,3,131,184,0,117,177,187,1,28,14,31,255,176,102,80,0,50,84,151,255,125,31,54,255,21,157,133,255,19,179,139,1,224,232,26,0,34,117,170,255,167,252,171,255,73,141,206,254,129,250,35,0,72,79,236,1,220,229,20,255,41,202,173,255,99,76,238,255,198,22,224,255,108,198,195,255,36,141,96,1,236,158,59,255,106,100,87,0,110,226,2,0,227,234,222,0,154,93,119,255,74,112,164,255,67,91,2,255,21,145,33,255,102,214,137,255,175,230,103,254,163,246,166,0,93,247,116,254,167,224,28,255,220,2,57,1,171,206,84,0,123,228,17,255,27,120,119,0,119,11,147,1,180,47,225,255,104,200,185,254,165,2,114,0,77,78,212,0,45,154,177,255,24,196,121,254,82,157,182,0,90,16,190,1,12,147,197,0,95,239,152,255,11,235,71,0,86,146,119,255,172,134,214,0,60,131,196,0,161,225,129,0,31,130,120,254,95,200,51,0,105,231,210,255,58,9,148,255,43,168,221,255,124,237,142,0,198,211,50,254,46,245,103,0,164,248,84,0,152,70,208,255,180,117,177,0,70,79,185,0,243,74,32,0,149,156,207,0,197,196,161,1,245,53,239,0,15,93,246,254,139,240,49,255,196,88,36,255,162,38,123,0,128,200,157,1,174,76,103,255,173,169,34,254,216,1,171,255,114,51,17,0,136,228,194,0,110,150,56,254,106,246,159,0,19,184,79,255,150,77,240,255,155,80,162,0,0,53,169,255,29,151,86,0,68,94,16,0,92,7,110,254,98,117,149,255,249,77,230,255,253,10,140,0,214,124,92,254,35,118,235,0,89,48,57,1,22,53,166,0,184,144,61,255,179,255,194,0,214,248,61,254,59,110,246,0,121,21,81,254,166,3,228,0,106,64,26,255,69,232,134,255,242,220,53,254,46,220,85,0,113,149,247,255,97,179,103,255,190,127,11,0,135,209,182,0,95,52,129,1,170,144,206,255,122,200,204,255,168,100,146,0,60,144,149,254,70,60,40,0,122,52,177,255,246,211,101,255,174,237,8,0,7,51,120,0,19,31,173,0,126,239,156,255,143,189,203,0,196,128,88,255,233,133,226,255,30,125,173,255,201,108,50,0,123,100,59,255,254,163,3,1,221,148,181,255,214,136,57,254,222,180,137,255,207,88,54,255,28,33,251,255,67,214,52,1,210,208,100,0,81,170,94,0,145,40,53,0,224,111,231,254,35,28,244,255,226,199,195,254,238,17,230,0,217,217,164,254,169,157,221,0,218,46,162,1,199,207,163,255,108,115,162,1,14,96,187,255,118,60,76,0,184,159,152,0,209,231,71,254,42,164,186,255,186,153,51,254,221,171,182,255,162,142,173,0,235,47,193,0,7,139,16,1,95,164,64,255,16,221,166,0,219,197,16,0,132,29,44,255,100,69,117,255,60,235,88,254,40,81,173,0,71,190,61,255,187,88,157,0,231,11,23,0,237,117,164,0,225,168,223,255,154,114,116,255,163,152,242,1,24,32,170,0,125,98,113,254,168,19,76,0,17,157,220,254,155,52,5,0,19,111,161,255,71,90,252,255,173,110,240,0,10,198,121,255,253,255,240,255,66,123,210,0,221,194,215,254,121,163,17,255,225,7,99,0,190,49,182,0,115,9,133,1,232,26,138,255,213,68,132,0,44,119,122,255,179,98,51,0,149,90,106,0,71,50,230,255,10,153,118,255,177,70,25,0,165,87,205,0,55,138,234,0,238,30,97,0,113,155,207,0,98,153,127,0,34,107,219,254,117,114,172,255,76,180,255,254,242,57,179,255,221,34,172,254,56,162,49,255,83,3,255,255,113,221,189,255,188,25,228,254,16,88,89,255,71,28,198,254,22,17,149,255,243,121,254,255,107,202,99,255,9,206,14,1,220,47,153,0,107,137,39,1,97,49,194,255,149,51,197,254,186,58,11,255,107,43,232,1,200,6,14,255,181,133,65,254,221,228,171,255,123,62,231,1,227,234,179,255,34,189,212,254,244,187,249,0,190,13,80,1,130,89,1,0,223,133,173,0,9,222,198,255,66,127,74,0,167,216,93,255,155,168,198,1,66,145,0,0,68,102,46,1,172,90,154,0,216,128,75,255,160,40,51,0,158,17,27,1,124,240,49,0,236,202,176,255,151,124,192,255,38,193,190,0,95,182,61,0,163,147,124,255,255,165,51,255,28,40,17,254,215,96,78,0,86,145,218,254,31,36,202,255,86,9,5,0,111,41,200,255,237,108,97,0,57,62,44,0,117,184,15,1,45,241,116,0,152,1,220,255,157,165,188,0,250,15,131,1,60,44,125,255,65,220,251,255,75,50,184,0,53,90,128,255,231,80,194,255,136,129,127,1,21,18,187,255,45,58,161,255,71,147,34,0,174,249,11,254,35,141,29,0,239,68,177,255,115,110,58,0,238,190,177,1,87,245,166,255,190,49,247,255,146,83,184,255,173,14,39,255,146,215,104,0,142,223,120,0,149,200,155,255,212,207,145,1,16,181,217,0,173,32,87,255,255,35,181,0,119,223,161,1,200,223,94,255,70,6,186,255,192,67,85,255,50,169,152,0,144,26,123,255,56,243,179,254,20,68,136,0,39,140,188,254,253,208,5,255,200,115,135,1,43,172,229,255,156,104,187,0,151,251,167,0,52,135,23,0,151,153,72,0,147,197,107,254,148,158,5,255,238,143,206,0,126,153,137,255,88,152,197,254,7,68,167,0,252,159,165,255,239,78,54,255,24,63,55,255,38,222,94,0,237,183,12,255,206,204,210,0,19,39,246,254,30,74,231,0,135,108,29,1,179,115,0,0,117,118,116,1,132,6,252,255,145,129,161,1,105,67,141,0,82,37,226,255,238,226,228,255,204,214,129,254,162,123,100,255,185,121,234,0,45,108,231,0,66,8,56,255,132,136,128,0,172,224,66,254,175,157,188,0,230,223,226,254,242,219,69,0,184,14,119,1,82,162,56,0,114,123,20,0,162,103,85,255,49,239,99,254,156,135,215,0,111,255,167,254,39,196,214,0,144,38,79,1,249,168,125,0,155,97,156,255,23,52,219,255,150,22,144,0,44,149,165,255,40,127,183,0,196,77,233,255,118,129,210,255,170,135,230,255,214,119,198,0,233,240,35,0,253,52,7,255,117,102,48,255,21,204,154,255,179,136,177,255,23,2,3,1,149,130,89,255,252,17,159,1,70,60,26,0,144,107,17,0,180,190,60,255,56,182,59,255,110,71,54,255,198,18,129,255,149,224,87,255,223,21,152,255,138,22,182,255,250,156,205,0,236,45,208,255,79,148,242,1,101,70,209,0,103,78,174,0,101,144,172,255,152,136,237,1,191,194,136,0,113,80,125,1,152,4,141,0,155,150,53,255,196,116,245,0,239,114,73,254,19,82,17,255,124,125,234,255,40,52,191,0,42,210,158,255,155,132,165,0,178,5,42,1,64,92,40,255,36,85,77,255,178,228,118,0,137,66,96,254,115,226,66,0,110,240,69,254,151,111,80,0,167,174,236,255,227,108,107,255,188,242,65,255,183,81,255,0,57,206,181,255,47,34,181,255,213,240,158,1,71,75,95,0,156,40,24,255,102,210,81,0,171,199,228,255,154,34,41,0,227,175,75,0,21,239,195,0,138,229,95,1,76,192,49,0,117,123,87,1,227,225,130,0,125,62,63,255,2,198,171,0,254,36,13,254,145,186,206,0,148,255,244,255,35,0,166,0,30,150,219,1,92,228,212,0,92,198,60,254,62,133,200,255,201,41,59,0,125,238,109,255,180,163,238,1,140,122,82,0,9,22,88,255,197,157,47,255,153,94,57,0,88,30,182,0,84,161,85,0,178,146,124,0,166,166,7,255,21,208,223,0,156,182,242,0,155,121,185,0,83,156,174,254,154,16,118,255,186,83,232,1,223,58,121,255,29,23,88,0,35,125,127,255,170,5,149,254,164,12,130,255,155,196,29,0,161,96,136,0,7,35,29,1,162,37,251,0,3,46,242,255,0,217,188,0,57,174,226,1,206,233,2,0,57,187,136,254,123,189,9,255,201,117,127,255,186,36,204,0,231,25,216,0,80,78,105,0,19,134,129,255,148,203,68,0,141,81,125,254,248,165,200,255,214,144,135,0,151,55,166,255,38,235,91,0,21,46,154,0,223,254,150,255,35,153,180,255,125,176,29,1,43,98,30,255,216,122,230,255,233,160,12,0,57,185,12,254,240,113,7,255,5,9,16,254,26,91,108,0,109,198,203,0,8,147,40,0,129,134,228,255,124,186,40,255,114,98,132,254,166,132,23,0,99,69,44,0,9,242,238,255,184,53,59,0,132,129,102,255,52,32,243,254,147,223,200,255,123,83,179,254,135,144,201,255,141,37,56,1,151,60,227,255,90,73,156,1,203,172,187,0,80,151,47,255,94,137,231,255,36,191,59,255,225,209,181,255,74,215,213,254,6,118,179,255,153,54,193,1,50,0,231,0,104,157,72,1,140,227,154,255,182,226,16,254,96,225,92,255,115,20,170,254,6,250,78,0,248,75,173,255,53,89,6,255,0,180,118,0,72,173,1,0,64,8,206,1,174,133,223,0,185,62,133,255,214,11,98,0,197,31,208,0,171,167,244,255,22,231,181,1,150,218,185,0,247,169,97,1,165,139,247,255,47,120,149,1,103,248,51,0,60,69,28,254,25,179,196,0,124,7,218,254,58,107,81,0,184,233,156,255,252,74,36,0,118,188,67,0,141,95,53,255,222,94,165,254,46,61,53,0,206,59,115,255,47,236,250,255,74,5,32,1,129,154,238,255,106,32,226,0,121,187,61,255,3,166,241,254,67,170,172,255,29,216,178,255,23,201,252,0,253,110,243,0,200,125,57,0,109,192,96,255,52,115,238,0,38,121,243,255,201,56,33,0,194,118,130,0,75,96,25,255,170,30,230,254,39,63,253,0,36,45,250,255,251,1,239,0,160,212,92,1,45,209,237,0,243,33,87,254,237,84,201,255,212,18,157,254,212,99,127,255,217,98,16,254,139,172,239,0,168,201,130,255,143,193,169,255,238,151,193,1,215,104,41,0,239,61,165,254,2,3,242,0,22,203,177,254,177,204,22,0,149,129,213,254,31,11,41,255,0,159,121,254,160,25,114,255,162,80,200,0,157,151,11,0,154,134,78,1,216,54,252,0,48,103,133,0,105,220,197,0,253,168,77,254,53,179,23,0,24,121,240,1,255,46,96,255,107,60,135,254,98,205,249,255,63,249,119,255,120,59,211,255,114,180,55,254,91,85,237,0,149,212,77,1,56,73,49,0,86,198,150,0,93,209,160,0,69,205,182,255,244,90,43,0,20,36,176,0,122,116,221,0,51,167,39,1,231,1,63,255,13,197,134,0,3,209,34,255,135,59,202,0,167,100,78,0,47,223,76,0,185,60,62,0,178,166,123,1,132,12,161,255,61,174,43,0,195,69,144,0,127,47,191,1,34,44,78,0,57,234,52,1,255,22,40,255,246,94,146,0,83,228,128,0,60,78,224,255,0,96,210,255,153,175,236,0,159,21,73,0,180,115,196,254,131,225,106,0,255,167,134,0,159,8,112,255,120,68,194,255,176,196,198,255,118,48,168,255,93,169,1,0,112,200,102,1,74,24,254,0,19,141,4,254,142,62,63,0,131,179,187,255,77,156,155,255,119,86,164,0,170,208,146,255,208,133,154,255,148,155,58,255,162,120,232,254,252,213,155,0,241,13,42,0,94,50,131,0,179,170,112,0,140,83,151,255,55,119,84,1,140,35,239,255,153,45,67,1,236,175,39,0,54,151,103,255,158,42,65,255,196,239,135,254,86,53,203,0,149,97,47,254,216,35,17,255,70,3,70,1,103,36,90,255,40,26,173,0,184,48,13,0,163,219,217,255,81,6,1,255,221,170,108,254,233,208,93,0,100,201,249,254,86,36,35,255,209,154,30,1,227,201,251,255,2,189,167,254,100,57,3,0,13,128,41,0,197,100,75,0,150,204,235,255,145,174,59,0,120,248,149,255,85,55,225,0,114,210,53,254,199,204,119,0,14,247,74,1,63,251,129,0,67,104,151,1,135,130,80,0,79,89,55,255,117,230,157,255,25,96,143,0,213,145,5,0,69,241,120,1,149,243,95,255,114,42,20,0,131,72,2,0,154,53,20,255,73,62,109,0,196,102,152,0,41,12,204,255,122,38,11,1,250,10,145,0,207,125,148,0,246,244,222,255,41,32,85,1,112,213,126,0,162,249,86,1,71,198,127,255,81,9,21,1,98,39,4,255,204,71,45,1,75,111,137,0,234,59,231,0,32,48,95,255,204,31,114,1,29,196,181,255,51,241,167,254,93,109,142,0,104,144,45,0,235,12,181,255,52,112,164,0,76,254,202,255,174,14,162,0,61,235,147,255,43,64,185,254,233,125,217,0,243,88,167,254,74,49,8,0,156,204,66,0,124,214,123,0,38,221,118,1,146,112,236,0,114,98,177,0,151,89,199,0,87,197,112,0,185,149,161,0,44,96,165,0,248,179,20,255,188,219,216,254,40,62,13,0,243,142,141,0,229,227,206,255,172,202,35,255,117,176,225,255,82,110,38,1,42,245,14,255,20,83,97,0,49,171,10,0,242,119,120,0,25,232,61,0,212,240,147,255,4,115,56,255,145,17,239,254,202,17,251,255,249,18,245,255,99,117,239,0,184,4,179,255,246,237,51,255,37,239,137,255,166,112,166,255,81,188,33,255,185,250,142,255,54,187,173,0,208,112,201,0,246,43,228,1,104,184,88,255,212,52,196,255,51,117,108,255,254,117,155,0,46,91,15,255,87,14,144,255,87,227,204,0,83,26,83,1,159,76,227,0,159,27,213,1,24,151,108,0,117,144,179,254,137,209,82,0,38,159,10,0,115,133,201,0,223,182,156,1,110,196,93,255,57,60,233,0,5,167,105,255,154,197,164,0,96,34,186,255,147,133,37,1,220,99,190,0,1,167,84,255,20,145,171,0,194,197,251,254,95,78,133,255,252,248,243,255,225,93,131,255,187,134,196,255,216,153,170,0,20,118,158,254,140,1,118,0,86,158,15,1,45,211,41,255,147,1,100,254,113,116,76,255,211,127,108,1,103,15,48,0,193,16,102,1,69,51,95,255,107,128,157,0,137,171,233,0,90,124,144,1,106,161,182,0,175,76,236,1,200,141,172,255,163,58,104,0,233,180,52,255,240,253,14,255,162,113,254,255,38,239,138,254,52,46,166,0,241,101,33,254,131,186,156,0,111,208,62,255,124,94,160,255,31,172,254,0,112,174,56,255,188,99,27,255,67,138,251,0,125,58,128,1,156,152,174,255,178,12,247,255,252,84,158,0,82,197,14,254,172,200,83,255,37,39,46,1,106,207,167,0,24,189,34,0,131,178,144,0,206,213,4,0,161,226,210,0,72,51,105,255,97,45,187,255,78,184,223,255,176,29,251,0,79,160,86,255,116,37,178,0,82,77,213,1,82,84,141,255,226,101,212,1,175,88,199,255,245,94,247,1,172,118,109,255,166,185,190,0,131,181,120,0,87,254,93,255,134,240,73,255,32,245,143,255,139,162,103,255,179,98,18,254,217,204,112,0,147,223,120,255,53,10,243,0,166,140,150,0,125,80,200,255,14,109,219,255,91,218,1,255,252,252,47,254,109,156,116,255,115,49,127,1,204,87,211,255,148,202,217,255,26,85,249,255,14,245,134,1,76,89,169,255,242,45,230,0,59,98,172,255,114,73,132,254,78,155,49,255,158,126,84,0,49,175,43,255,16,182,84,255,157,103,35,0,104,193,109,255,67,221,154,0,201,172,1,254,8,162,88,0,165,1,29,255,125,155,229,255,30,154,220,1,103,239,92,0,220,1,109,255,202,198,1,0,94,2,142,1,36,54,44,0,235,226,158,255,170,251,214,255,185,77,9,0,97,74,242,0,219,163,149,255,240,35,118,255,223,114,88,254,192,199,3,0,106,37,24,255,201,161,118,255,97,89,99,1,224,58,103,255,101,199,147,254,222,60,99,0,234,25,59,1,52,135,27,0,102,3,91,254,168,216,235,0,229,232,136,0,104,60,129,0,46,168,238,0,39,191,67,0,75,163,47,0,143,97,98,255,56,216,168,1,168,233,252,255,35,111,22,255,92,84,43,0,26,200,87,1,91,253,152,0,202,56,70,0,142,8,77,0,80,10,175,1,252,199,76,0,22,110,82,255,129,1,194,0,11,128,61,1,87,14,145,255,253,222,190,1,15,72,174,0,85,163,86,254,58,99,44,255,45,24,188,254,26,205,15,0,19,229,210,254,248,67,195,0,99,71,184,0,154,199,37,255,151,243,121,255,38,51,75,255,201,85,130,254,44,65,250,0,57,147,243,254,146,43,59,255,89,28,53,0,33,84,24,255,179,51,18,254,189,70,83,0,11,156,179,1,98,134,119,0,158,111,111,0,119,154,73,255,200,63,140,254,45,13,13,255,154,192,2,254,81,72,42,0,46,160,185,254,44,112,6,0,146,215,149,1,26,176,104,0,68,28,87,1,236,50,153,255,179,128,250,254,206,193,191,255,166,92,137,254,53,40,239,0,210,1,204,254,168,173,35,0,141,243,45,1,36,50,109,255,15,242,194,255,227,159,122,255,176,175,202,254,70,57,72,0,40,223,56,0,208,162,58,255,183,98,93,0,15,111,12,0,30,8,76,255,132,127,246,255,45,242,103,0,69,181,15,255,10,209,30,0,3,179,121,0,241,232,218,1,123,199,88,255,2,210,202,1,188,130,81,255,94,101,208,1,103,36,45,0,76,193,24,1,95,26,241,255,165,162,187,0,36,114,140,0,202,66,5,255,37,56,147,0,152,11,243,1,127,85,232,255,250,135,212,1,185,177,113,0,90,220,75,255,69,248,146,0,50,111,50,0,92,22,80,0,244,36,115,254,163,100,82,255,25,193,6,1,127,61,36,0,253,67,30,254,65,236,170,255,161,17,215,254,63,175,140,0,55,127,4,0,79,112,233,0,109,160,40,0,143,83,7,255,65,26,238,255,217,169,140,255,78,94,189,255,0,147,190,255,147,71,186,254,106,77,127,255,233,157,233,1,135,87,237,255,208,13,236,1,155,109,36,255,180,100,218,0,180,163,18,0,190,110,9,1,17,63,123,255,179,136,180,255,165,123,123,255,144,188,81,254,71,240,108,255,25,112,11,255,227,218,51,255,167,50,234,255,114,79,108,255,31,19,115,255,183,240,99,0,227,87,143,255,72,217,248,255,102,169,95,1,129,149,149,0,238,133,12,1,227,204,35,0,208,115,26,1,102,8,234,0,112,88,143,1,144,249,14,0,240,158,172,254,100,112,119,0,194,141,153,254,40,56,83,255,121,176,46,0,42,53,76,255,158,191,154,0,91,209,92,0,173,13,16,1,5,72,226,255,204,254,149,0,80,184,207,0,100,9,122,254,118,101,171,255,252,203,0,254,160,207,54,0,56,72,249,1,56,140,13,255,10,64,107,254,91,101,52,255,225,181,248,1,139,255,132,0,230,145,17,0,233,56,23,0,119,1,241,255,213,169,151,255,99,99,9,254,185,15,191,255,173,103,109,1,174,13,251,255,178,88,7,254,27,59,68,255,10,33,2,255,248,97,59,0,26,30,146,1,176,147,10,0,95,121,207,1,188,88,24,0,185,94,254,254,115,55,201,0,24,50,70,0,120,53,6,0,142,66,146,0,228,226,249,255,104,192,222,1,173,68,219,0,162,184,36,255,143,102,137,255,157,11,23,0,125,45,98,0,235,93,225,254,56,112,160,255,70,116,243,1,153,249,55,255,129,39,17,1,241,80,244,0,87,69,21,1,94,228,73,255,78,66,65,255,194,227,231,0,61,146,87,255,173,155,23,255,112,116,219,254,216,38,11,255,131,186,133,0,94,212,187,0,100,47,91,0,204,254,175,255,222,18,215,254,173,68,108,255,227,228,79,255,38,221,213,0,163,227,150,254,31,190,18,0,160,179,11,1,10,90,94,255,220,174,88,0,163,211,229,255,199,136,52,0,130,95,221,255,140,188,231,254,139,113,128,255,117,171,236,254,49,220,20,255,59,20,171,255,228,109,188,0,20,225,32,254,195,16,174,0,227,254,136,1,135,39,105,0,150,77,206,255,210,238,226,0,55,212,132,254,239,57,124,0,170,194,93,255,249,16,247,255,24,151,62,255,10,151,10,0,79,139,178,255,120,242,202,0,26,219,213,0,62,125,35,255,144,2,108,255,230,33,83,255,81,45,216,1,224,62,17,0,214,217,125,0,98,153,153,255,179,176,106,254,131,93,138,255,109,62,36,255,178,121,32,255,120,252,70,0,220,248,37,0,204,88,103,1,128,220,251,255,236,227,7,1,106,49,198,255,60,56,107,0,99,114,238,0,220,204,94,1,73,187,1,0,89,154,34,0,78,217,165,255,14,195,249,255,9,230,253,255,205,135,245,0,26,252,7,255,84,205,27,1,134,2,112,0,37,158,32,0,231,91,237,255,191,170,204,255,152,7,222,0,109,192,49,0,193,166,146,255,232,19,181,255,105,142,52,255,103,16,27,1,253,200,165,0,195,217,4,255,52,189,144,255,123,155,160,254,87,130,54,255,78,120,61,255,14,56,41,0,25,41,125,255,87,168,245,0,214,165,70,0,212,169,6,255,219,211,194,254,72,93,164,255,197,33,103,255,43,142,141,0,131,225,172,0,244,105,28,0,68,68,225,0,136,84,13,255,130,57,40,254,139,77,56,0,84,150,53,0,54,95,157,0,144,13,177,254,95,115,186,0,117,23,118,255,244,166,241,255,11,186,135,0,178,106,203,255,97,218,93,0,43,253,45,0,164,152,4,0,139,118,239,0,96,1,24,254,235,153,211,255,168,110,20,255,50,239,176,0,114,41,232,0,193,250,53,0,254,160,111,254,136,122,41,255,97,108,67,0,215,152,23,255,140,209,212,0,42,189,163,0,202,42,50,255,106,106,189,255,190,68,217,255,233,58,117,0,229,220,243,1,197,3,4,0,37,120,54,254,4,156,134,255,36,61,171,254,165,136,100,255,212,232,14,0,90,174,10,0,216,198,65,255,12,3,64,0,116,113,115,255,248,103,8,0,231,125,18,255,160,28,197,0,30,184,35,1,223,73,249,255,123,20,46,254,135,56,37,255,173,13,229,1,119,161,34,255,245,61,73,0,205,125,112,0,137,104,134,0,217,246,30,255,237,142,143,0,65,159,102,255,108,164,190,0,219,117,173,255,34,37,120,254,200,69,80,0,31,124,218,254,74,27,160,255,186,154,199,255,71,199,252,0,104,81,159,1,17,200,39,0,211,61,192,1,26,238,91,0,148,217,12,0,59,91,213,255,11,81,183,255,129,230,122,255,114,203,145,1,119,180,66,255,72,138,180,0,224,149,106,0,119,82,104,255,208,140,43,0,98,9,182,255,205,101,134,255,18,101,38,0,95,197,166,255,203,241,147,0,62,208,145,255,133,246,251,0,2,169,14,0,13,247,184,0,142,7,254,0,36,200,23,255,88,205,223,0,91,129,52,255,21,186,30,0,143,228,210,1,247,234,248,255,230,69,31,254,176,186,135,255,238,205,52,1,139,79,43,0,17,176,217,254,32,243,67,0,242,111,233,0,44,35,9,255,227,114,81,1,4,71,12,255,38,105,191,0,7,117,50,255,81,79,16,0,63,68,65,255,157,36,110,255,77,241,3,255,226,45,251,1,142,25,206,0,120,123,209,1,28,254,238,255,5,128,126,255,91,222,215,255,162,15,191,0,86,240,73,0,135,185,81,254,44,241,163,0,212,219,210,255,112,162,155,0,207,101,118,0,168,72,56,255,196,5,52,0,72,172,242,255,126,22,157,255,146,96,59,255,162,121,152,254,140,16,95,0,195,254,200,254,82,150,162,0,119,43,145,254,204,172,78,255,166,224,159,0,104,19,237,255,245,126,208,255,226,59,213,0,117,217,197,0,152,72,237,0,220,31,23,254,14,90,231,255,188,212,64,1,60,101,246,255,85,24,86,0,1,177,109,0,146,83,32,1,75,182,192,0,119,241,224,0,185,237,27,255,184,101,82,1,235,37,77,255,253,134,19,0,232,246,122,0,60,106,179,0,195,11,12,0,109,66,235,1,125,113,59,0,61,40,164,0,175,104,240,0,2,47,187,255,50,12,141,0,194,139,181,255,135,250,104,0,97,92,222,255,217,149,201,255,203,241,118,255,79,151,67,0,122,142,218,255,149,245,239,0,138,42,200,254,80,37,97,255,124,112,167,255,36,138,87,255,130,29,147,255,241,87,78,255,204,97,19,1,177,209,22,255,247,227,127,254,99,119,83,255,212,25,198,1,16,179,179,0,145,77,172,254,89,153,14,255,218,189,167,0,107,233,59,255,35,33,243,254,44,112,112,255,161,127,79,1,204,175,10,0])
.concat([40,21,138,254,104,116,228,0,199,95,137,255,133,190,168,255,146,165,234,1,183,99,39,0,183,220,54,254,255,222,133,0,162,219,121,254,63,239,6,0,225,102,54,255,251,18,246,0,4,34,129,1,135,36,131,0,206,50,59,1,15,97,183,0,171,216,135,255,101,152,43,255,150,251,91,0,38,145,95,0,34,204,38,254,178,140,83,255,25,129,243,255,76,144,37,0,106,36,26,254,118,144,172,255,68,186,229,255,107,161,213,255,46,163,68,255,149,170,253,0,187,17,15,0,218,160,165,255,171,35,246,1,96,13,19,0,165,203,117,0,214,107,192,255,244,123,177,1,100,3,104,0,178,242,97,255,251,76,130,255,211,77,42,1,250,79,70,255,63,244,80,1,105,101,246,0,61,136,58,1,238,91,213,0,14,59,98,255,167,84,77,0,17,132,46,254,57,175,197,255,185,62,184,0,76,64,207,0,172,175,208,254,175,74,37,0,138,27,211,254,148,125,194,0,10,89,81,0,168,203,101,255,43,213,209,1,235,245,54,0,30,35,226,255,9,126,70,0,226,125,94,254,156,117,20,255,57,248,112,1,230,48,64,255,164,92,166,1,224,214,230,255,36,120,143,0,55,8,43,255,251,1,245,1,106,98,165,0,74,107,106,254,53,4,54,255,90,178,150,1,3,120,123,255,244,5,89,1,114,250,61,255,254,153,82,1,77,15,17,0,57,238,90,1,95,223,230,0,236,52,47,254,103,148,164,255,121,207,36,1,18,16,185,255,75,20,74,0,187,11,101,0,46,48,129,255,22,239,210,255,77,236,129,255,111,77,204,255,61,72,97,255,199,217,251,255,42,215,204,0,133,145,201,255,57,230,146,1,235,100,198,0,146,73,35,254,108,198,20,255,182,79,210,255,82,103,136,0,246,108,176,0,34,17,60,255,19,74,114,254,168,170,78,255,157,239,20,255,149,41,168,0,58,121,28,0,79,179,134,255,231,121,135,255,174,209,98,255,243,122,190,0,171,166,205,0,212,116,48,0,29,108,66,255,162,222,182,1,14,119,21,0,213,39,249,255,254,223,228,255,183,165,198,0,133,190,48,0,124,208,109,255,119,175,85,255,9,209,121,1,48,171,189,255,195,71,134,1,136,219,51,255,182,91,141,254,49,159,72,0,35,118,245,255,112,186,227,255,59,137,31,0,137,44,163,0,114,103,60,254,8,213,150,0,162,10,113,255,194,104,72,0,220,131,116,255,178,79,92,0,203,250,213,254,93,193,189,255,130,255,34,254,212,188,151,0,136,17,20,255,20,101,83,255,212,206,166,0,229,238,73,255,151,74,3,255,168,87,215,0,155,188,133,255,166,129,73,0,240,79,133,255,178,211,81,255,203,72,163,254,193,168,165,0,14,164,199,254,30,255,204,0,65,72,91,1,166,74,102,255,200,42,0,255,194,113,227,255,66,23,208,0,229,216,100,255,24,239,26,0,10,233,62,255,123,10,178,1,26,36,174,255,119,219,199,1,45,163,190,0,16,168,42,0,166,57,198,255,28,26,26,0,126,165,231,0,251,108,100,255,61,229,121,255,58,118,138,0,76,207,17,0,13,34,112,254,89,16,168,0,37,208,105,255,35,201,215,255,40,106,101,254,6,239,114,0,40,103,226,254,246,127,110,255,63,167,58,0,132,240,142,0,5,158,88,255,129,73,158,255,94,89,146,0,230,54,146,0,8,45,173,0,79,169,1,0,115,186,247,0,84,64,131,0,67,224,253,255,207,189,64,0,154,28,81,1,45,184,54,255,87,212,224,255,0,96,73,255,129,33,235,1,52,66,80,255,251,174,155,255,4,179,37,0,234,164,93,254,93,175,253,0,198,69,87,255,224,106,46,0,99,29,210,0,62,188,114,255,44,234,8,0,169,175,247,255,23,109,137,255,229,182,39,0,192,165,94,254,245,101,217,0,191,88,96,0,196,94,99,255,106,238,11,254,53,126,243,0,94,1,101,255,46,147,2,0,201,124,124,255,141,12,218,0,13,166,157,1,48,251,237,255,155,250,124,255,106,148,146,255,182,13,202,0,28,61,167,0,217,152,8,254,220,130,45,255,200,230,255,1,55,65,87,255,93,191,97,254,114,251,14,0,32,105,92,1,26,207,141,0,24,207,13,254,21,50,48,255,186,148,116,255,211,43,225,0,37,34,162,254,164,210,42,255,68,23,96,255,182,214,8,255,245,117,137,255,66,195,50,0,75,12,83,254,80,140,164,0,9,165,36,1,228,110,227,0,241,17,90,1,25,52,212,0,6,223,12,255,139,243,57,0,12,113,75,1,246,183,191,255,213,191,69,255,230,15,142,0,1,195,196,255,138,171,47,255,64,63,106,1,16,169,214,255,207,174,56,1,88,73,133,255,182,133,140,0,177,14,25,255,147,184,53,255,10,227,161,255,120,216,244,255,73,77,233,0,157,238,139,1,59,65,233,0,70,251,216,1,41,184,153,255,32,203,112,0,146,147,253,0,87,101,109,1,44,82,133,255,244,150,53,255,94,152,232,255,59,93,39,255,88,147,220,255,78,81,13,1,32,47,252,255,160,19,114,255,93,107,39,255,118,16,211,1,185,119,209,255,227,219,127,254,88,105,236,255,162,110,23,255,36,166,110,255,91,236,221,255,66,234,116,0,111,19,244,254,10,233,26,0,32,183,6,254,2,191,242,0,218,156,53,254,41,60,70,255,168,236,111,0,121,185,126,255,238,142,207,255,55,126,52,0,220,129,208,254,80,204,164,255,67,23,144,254,218,40,108,255,127,202,164,0,203,33,3,255,2,158,0,0,37,96,188,255,192,49,74,0,109,4,0,0,111,167,10,254,91,218,135,255,203,66,173,255,150,194,226,0,201,253,6,255,174,102,121,0,205,191,110,0,53,194,4,0,81,40,45,254,35,102,143,255,12,108,198,255,16,27,232,255,252,71,186,1,176,110,114,0,142,3,117,1,113,77,142,0,19,156,197,1,92,47,252,0,53,232,22,1,54,18,235,0,46,35,189,255,236,212,129,0,2,96,208,254,200,238,199,255,59,175,164,255,146,43,231,0,194,217,52,255,3,223,12,0,138,54,178,254,85,235,207,0,232,207,34,0,49,52,50,255,166,113,89,255,10,45,216,255,62,173,28,0,111,165,246,0,118,115,91,255,128,84,60,0,167,144,203,0,87,13,243,0,22,30,228,1,177,113,146,255,129,170,230,254,252,153,129,255,145,225,43,0,70,231,5,255,122,105,126,254,86,246,148,255,110,37,154,254,209,3,91,0,68,145,62,0,228,16,165,255,55,221,249,254,178,210,91,0,83,146,226,254,69,146,186,0,93,210,104,254,16,25,173,0,231,186,38,0,189,122,140,255,251,13,112,255,105,110,93,0,251,72,170,0,192,23,223,255,24,3,202,1,225,93,228,0,153,147,199,254,109,170,22,0,248,101,246,255,178,124,12,255,178,254,102,254,55,4,65,0,125,214,180,0,183,96,147,0,45,117,23,254,132,191,249,0,143,176,203,254,136,183,54,255,146,234,177,0,146,101,86,255,44,123,143,1,33,209,152,0,192,90,41,254,83,15,125,255,213,172,82,0,215,169,144,0,16,13,34,0,32,209,100,255,84,18,249,1,197,17,236,255,217,186,230,0,49,160,176,255,111,118,97,255,237,104,235,0,79,59,92,254,69,249,11,255,35,172,74,1,19,118,68,0,222,124,165,255,180,66,35,255,86,174,246,0,43,74,111,255,126,144,86,255,228,234,91,0,242,213,24,254,69,44,235,255,220,180,35,0,8,248,7,255,102,47,92,255,240,205,102,255,113,230,171,1,31,185,201,255,194,246,70,255,122,17,187,0,134,70,199,255,149,3,150,255,117,63,103,0,65,104,123,255,212,54,19,1,6,141,88,0,83,134,243,255,136,53,103,0,169,27,180,0,177,49,24,0,111,54,167,0,195,61,215,255,31,1,108,1,60,42,70,0,185,3,162,255,194,149,40,255,246,127,38,254,190,119,38,255,61,119,8,1,96,161,219,255,42,203,221,1,177,242,164,255,245,159,10,0,116,196,0,0,5,93,205,254,128,127,179,0,125,237,246,255,149,162,217,255,87,37,20,254,140,238,192,0,9,9,193,0,97,1,226,0,29,38,10,0,0,136,63,255,229,72,210,254,38,134,92,255,78,218,208,1,104,36,84,255,12,5,193,255,242,175,61,255,191,169,46,1,179,147,147,255,113,190,139,254,125,172,31,0,3,75,252,254,215,36,15,0,193,27,24,1,255,69,149,255,110,129,118,0,203,93,249,0,138,137,64,254,38,70,6,0,153,116,222,0,161,74,123,0,193,99,79,255,118,59,94,255,61,12,43,1,146,177,157,0,46,147,191,0,16,255,38,0,11,51,31,1,60,58,98,255,111,194,77,1,154,91,244,0,140,40,144,1,173,10,251,0,203,209,50,254,108,130,78,0,228,180,90,0,174,7,250,0,31,174,60,0,41,171,30,0,116,99,82,255,118,193,139,255,187,173,198,254,218,111,56,0,185,123,216,0,249,158,52,0,52,180,93,255,201,9,91,255,56,45,166,254,132,155,203,255,58,232,110,0,52,211,89,255,253,0,162,1,9,87,183,0,145,136,44,1,94,122,245,0,85,188,171,1,147,92,198,0,0,8,104,0,30,95,174,0,221,230,52,1,247,247,235,255,137,174,53,255,35,21,204,255,71,227,214,1,232,82,194,0,11,48,227,255,170,73,184,255,198,251,252,254,44,112,34,0,131,101,131,255,72,168,187,0,132,135,125,255,138,104,97,255,238,184,168,255,243,104,84,255,135,216,226,255,139,144,237,0,188,137,150,1,80,56,140,255,86,169,167,255,194,78,25,255,220,17,180,255,17,13,193,0,117,137,212,255,141,224,151,0,49,244,175,0,193,99,175,255,19,99,154,1,255,65,62,255,156,210,55,255,242,244,3,255,250,14,149,0,158,88,217,255,157,207,134,254,251,232,28,0,46,156,251,255,171,56,184,255,239,51,234,0,142,138,131,255,25,254,243,1,10,201,194,0,63,97,75,0,210,239,162,0,192,200,31,1,117,214,243,0,24,71,222,254,54,40,232,255,76,183,111,254,144,14,87,255,214,79,136,255,216,196,212,0,132,27,140,254,131,5,253,0,124,108,19,255,28,215,75,0,76,222,55,254,233,182,63,0,68,171,191,254,52,111,222,255,10,105,77,255,80,170,235,0,143,24,88,255,45,231,121,0,148,129,224,1,61,246,84,0,253,46,219,255,239,76,33,0,49,148,18,254,230,37,69,0,67,134,22,254,142,155,94,0,31,157,211,254,213,42,30,255,4,228,247,254,252,176,13,255,39,0,31,254,241,244,255,255,170,45,10,254,253,222,249,0,222,114,132,0,255,47,6,255,180,163,179,1,84,94,151,255,89,209,82,254,229,52,169,255,213,236,0,1,214,56,228,255,135,119,151,255,112,201,193,0,83,160,53,254,6,151,66,0,18,162,17,0,233,97,91,0,131,5,78,1,181,120,53,255,117,95,63,255,237,117,185,0,191,126,136,255,144,119,233,0,183,57,97,1,47,201,187,255,167,165,119,1,45,100,126,0,21,98,6,254,145,150,95,255,120,54,152,0,209,98,104,0,143,111,30,254,184,148,249,0,235,216,46,0,248,202,148,255,57,95,22,0,242,225,163,0,233,247,232,255,71,171,19,255,103,244,49,255,84,103,93,255,68,121,244,1,82,224,13,0,41,79,43,255,249,206,167,255,215,52,21,254,192,32,22,255,247,111,60,0,101,74,38,255,22,91,84,254,29,28,13,255,198,231,215,254,244,154,200,0,223,137,237,0,211,132,14,0,95,64,206,255,17,62,247,255,233,131,121,1,93,23,77,0,205,204,52,254,81,189,136,0,180,219,138,1,143,18,94,0,204,43,140,254,188,175,219,0,111,98,143,255,151,63,162,255,211,50,71,254,19,146,53,0,146,45,83,254,178,82,238,255,16,133,84,255,226,198,93,255,201,97,20,255,120,118,35,255,114,50,231,255,162,229,156,255,211,26,12,0,114,39,115,255,206,212,134,0,197,217,160,255,116,129,94,254,199,215,219,255,75,223,249,1,253,116,181,255,232,215,104,255,228,130,246,255,185,117,86,0,14,5,8,0,239,29,61,1,237,87,133,255,125,146,137,254,204,168,223,0,46,168,245,0,154,105,22,0,220,212,161,255,107,69,24,255,137,218,181,255,241,84,198,255,130,122,211,255,141,8,153,255,190,177,118,0,96,89,178,0,255,16,48,254,122,96,105,255,117,54,232,255,34,126,105,255,204,67,166,0,232,52,138,255,211,147,12,0,25,54,7,0,44,15,215,254,51,236,45,0,190,68,129,1,106,147,225,0,28,93,45,254,236,141,15,255,17,61,161,0,220,115,192,0,236,145,24,254,111,168,169,0,224,58,63,255,127,164,188,0,82,234,75,1,224,158,134,0,209,68,110,1,217,166,217,0,70,225,166,1,187,193,143,255,16,7,88,255,10,205,140,0,117,192,156,1,17,56,38,0,27,124,108,1,171,215,55,255,95,253,212,0,155,135,168,255,246,178,153,254,154,68,74,0,232,61,96,254,105,132,59,0,33,76,199,1,189,176,130,255,9,104,25,254,75,198,102,255,233,1,112,0,108,220,20,255,114,230,70,0,140,194,133,255,57,158,164,254,146,6,80,255,169,196,97,1,85,183,130,0,70,158,222,1,59,237,234,255,96,25,26,255,232,175,97,255,11,121,248,254,88,35,194,0,219,180,252,254,74,8,227,0,195,227,73,1,184,110,161,255,49,233,164,1,128,53,47,0,82,14,121,255,193,190,58,0,48,174,117,255,132,23,32,0,40,10,134,1,22,51,25,255,240,11,176,255,110,57,146,0,117,143,239,1,157,101,118,255,54,84,76,0,205,184,18,255,47,4,72,255,78,112,85,255,193,50,66,1,93,16,52,255,8,105,134,0,12,109,72,255,58,156,251,0,144,35,204,0,44,160,117,254,50,107,194,0,1,68,165,255,111,110,162,0,158,83,40,254,76,214,234,0,58,216,205,255,171,96,147,255,40,227,114,1,176,227,241,0,70,249,183,1,136,84,139,255,60,122,247,254,143,9,117,255,177,174,137,254,73,247,143,0,236,185,126,255,62,25,247,255,45,64,56,255,161,244,6,0,34,57,56,1,105,202,83,0,128,147,208,0,6,103,10,255,74,138,65,255,97,80,100,255,214,174,33,255,50,134,74,255,110,151,130,254,111,84,172,0,84,199,75,254,248,59,112,255,8,216,178,1,9,183,95,0,238,27,8,254,170,205,220,0,195,229,135,0,98,76,237,255,226,91,26,1,82,219,39,255,225,190,199,1,217,200,121,255,81,179,8,255,140,65,206,0,178,207,87,254,250,252,46,255,104,89,110,1,253,189,158,255,144,214,158,255,160,245,54,255,53,183,92,1,21,200,194,255,146,33,113,1,209,1,255,0,235,106,43,255,167,52,232,0,157,229,221,0,51,30,25,0,250,221,27,1,65,147,87,255,79,123,196,0,65,196,223,255,76,44,17,1,85,241,68,0,202,183,249,255,65,212,212,255,9,33,154,1,71,59,80,0,175,194,59,255,141,72,9,0,100,160,244,0,230,208,56,0,59,25,75,254,80,194,194,0,18,3,200,254,160,159,115,0,132,143,247,1,111,93,57,255,58,237,11,1,134,222,135,255,122,163,108,1,123,43,190,255,251,189,206,254,80,182,72,255,208,246,224,1,17,60,9,0,161,207,38,0,141,109,91,0,216,15,211,255,136,78,110,0,98,163,104,255,21,80,121,255,173,178,183,1,127,143,4,0,104,60,82,254,214,16,13,255,96,238,33,1,158,148,230,255,127,129,62,255,51,255,210,255,62,141,236,254,157,55,224,255,114,39,244,0,192,188,250,255,228,76,53,0,98,84,81,255,173,203,61,254,147,50,55,255,204,235,191,0,52,197,244,0,88,43,211,254,27,191,119,0,188,231,154,0,66,81,161,0,92,193,160,1,250,227,120,0,123,55,226,0,184,17,72,0,133,168,10,254,22,135,156,255,41,25,103,255,48,202,58,0,186,149,81,255,188,134,239,0,235,181,189,254,217,139,188,255,74,48,82,0,46,218,229,0,189,253,251,0,50,229,12,255,211,141,191,1,128,244,25,255,169,231,122,254,86,47,189,255,132,183,23,255,37,178,150,255,51,137,253,0,200,78,31,0,22,105,50,0,130,60,0,0,132,163,91,254,23,231,187,0,192,79,239,0,157,102,164,255,192,82,20,1,24,181,103,255,240,9,234,0,1,123,164,255,133,233,0,255,202,242,242,0,60,186,245,0,241,16,199,255,224,116,158,254,191,125,91,255,224,86,207,0,121,37,231,255,227,9,198,255,15,153,239,255,121,232,217,254,75,112,82,0,95,12,57,254,51,214,105,255,148,220,97,1,199,98,36,0,156,209,12,254,10,212,52,0,217,180,55,254,212,170,232,255,216,20,84,255,157,250,135,0,157,99,127,254,1,206,41,0,149,36,70,1,54,196,201,255,87,116,0,254,235,171,150,0,27,163,234,0,202,135,180,0,208,95,0,254,123,156,93,0,183,62,75,0,137,235,182,0,204,225,255,255,214,139,210,255,2,115,8,255,29,12,111,0,52,156,1,0,253,21,251,255,37,165,31,254,12,130,211,0,106,18,53,254,42,99,154,0,14,217,61,254,216,11,92,255,200,197,112,254,147,38,199,0,36,252,120,254,107,169,77,0,1,123,159,255,207,75,102,0,163,175,196,0,44,1,240,0,120,186,176,254,13,98,76,255,237,124,241,255,232,146,188,255,200,96,224,0,204,31,41,0,208,200,13,0,21,225,96,255,175,156,196,0,247,208,126,0,62,184,244,254,2,171,81,0,85,115,158,0,54,64,45,255,19,138,114,0,135,71,205,0,227,47,147,1,218,231,66,0,253,209,28,0,244,15,173,255,6,15,118,254,16,150,208,255,185,22,50,255,86,112,207,255,75,113,215,1,63,146,43,255,4,225,19,254,227,23,62,255,14,255,214,254,45,8,205,255,87,197,151,254,210,82,215,255,245,248,247,255,128,248,70,0,225,247,87,0,90,120,70,0,213,245,92,0,13,133,226,0,47,181,5,1,92,163,105,255,6,30,133,254,232,178,61,255,230,149,24,255,18,49,158,0,228,100,61,254,116,243,251,255,77,75,92,1,81,219,147,255,76,163,254,254,141,213,246,0,232,37,152,254,97,44,100,0,201,37,50,1,212,244,57,0,174,171,183,255,249,74,112,0,166,156,30,0,222,221,97,255,243,93,73,254,251,101,100,255,216,217,93,255,254,138,187,255,142,190,52,255,59,203,177,255,200,94,52,0,115,114,158,255,165,152,104,1,126,99,226,255,118,157,244,1,107,200,16,0,193,90,229,0,121,6,88,0,156,32,93,254,125,241,211,255,14,237,157,255,165,154,21,255,184,224,22,255,250,24,152,255,113,77,31,0,247,171,23,255,237,177,204,255,52,137,145,255,194,182,114,0,224,234,149,0,10,111,103,1,201,129,4,0,238,142,78,0,52,6,40,255,110,213,165,254,60,207,253,0,62,215,69,0,96,97,0,255,49,45,202,0,120,121,22,255,235,139,48,1,198,45,34,255,182,50,27,1,131,210,91,255,46,54,128,0,175,123,105,255,198,141,78,254,67,244,239,255,245,54,103,254,78,38,242,255,2,92,249,254,251,174,87,255,139,63,144,0,24,108,27,255,34,102,18,1,34,22,152,0,66,229,118,254,50,143,99,0,144,169,149,1,118,30,152,0,178,8,121,1,8,159,18,0,90,101,230,255,129,29,119,0,68,36,11,1,232,183,55,0,23,255,96,255,161,41,193,255,63,139,222,0,15,179,243,0,255,100,15,255,82,53,135,0,137,57,149,1,99,240,170,255,22,230,228,254,49,180,82,255,61,82,43,0,110,245,217,0,199,125,61,0,46,253,52,0,141,197,219,0,211,159,193,0,55,121,105,254,183,20,129,0,169,119,170,255,203,178,139,255,135,40,182,255,172,13,202,255,65,178,148,0,8,207,43,0,122,53,127,1,74,161,48,0,227,214,128,254,86,11,243,255,100,86,7,1,245,68,134,255,61,43,21,1,152,84,94,255,190,60,250,254,239,118,232,255,214,136,37,1,113,76,107,255,93,104,100,1,144,206,23,255,110,150,154,1,228,103,185,0,218,49,50,254,135,77,139,255,185,1,78,0,0,161,148,255,97,29,233,255,207,148,149,255,160,168,0,0,91,128,171,255,6,28,19,254,11,111,247,0,39,187,150,255,138,232,149,0,117,62,68,255,63,216,188,255,235,234,32,254,29,57,160,255,25,12,241,1,169,60,191,0,32,131,141,255,237,159,123,255,94,197,94,254,116,254,3,255,92,179,97,254,121,97,92,255,170,112,14,0,21,149,248,0,248,227,3,0,80,96,109,0,75,192,74,1,12,90,226,255,161,106,68,1,208,114,127,255,114,42,255,254,74,26,74,255,247,179,150,254,121,140,60,0,147,70,200,255,214,40,161,255,161,188,201,255,141,65,135,255,242,115,252,0,62,47,202,0,180,149,255,254,130,55,237,0,165,17,186,255,10,169,194,0,156,109,218,255,112,140,123,255,104,128,223,254,177,142,108,255,121,37,219,255,128,77,18,255,111,108,23,1,91,192,75,0,174,245,22,255,4,236,62,255,43,64,153,1,227,173,254,0,237,122,132,1,127,89,186,255,142,82,128,254,252,84,174,0,90,179,177,1,243,214,87,255,103,60,162,255,208,130,14,255,11,130,139,0,206,129,219,255,94,217,157,255,239,230,230,255,116,115,159,254,164,107,95,0,51,218,2,1,216,125,198,255,140,202,128,254,11,95,68,255,55,9,93,254,174,153,6,255,204,172,96,0,69,160,110,0,213,38,49,254,27,80,213,0,118,125,114,0,70,70,67,255,15,142,73,255,131,122,185,255,243,20,50,254,130,237,40,0,210,159,140,1,197,151,65,255,84,153,66,0,195,126,90,0,16,238,236,1,118,187,102,255,3,24,133,255,187,69,230,0,56,197,92,1,213,69,94,255,80,138,229,1,206,7,230,0,222,111,230,1,91,233,119,255,9,89,7,1,2,98,1,0,148,74,133,255,51,246,180,255,228,177,112,1,58,189,108,255,194,203,237,254,21,209,195,0,147,10,35,1,86,157,226,0,31,163,139,254,56,7,75,255,62,90,116,0,181,60,169,0,138,162,212,254,81,167,31,0,205,90,112,255,33,112,227,0,83,151,117,1,177,224,73,255,174,144,217,255,230,204,79,255,22,77,232,255,114,78,234,0,224,57,126,254,9,49,141,0,242,147,165,1,104,182,140,255,167,132,12,1,123,68,127,0,225,87,39,1,251,108,8,0,198,193,143,1,121,135,207,255,172,22,70,0,50,68,116,255,101,175,40,255,248,105,233,0,166,203,7,0,110,197,218,0,215,254,26,254,168,226,253,0,31,143,96,0,11,103,41,0,183,129,203,254,100,247,74,255,213,126,132,0,210,147,44,0,199,234,27,1,148,47,181,0,155,91,158,1,54,105,175,255,2,78,145,254,102,154,95,0,128,207,127,254,52,124,236,255,130,84,71,0,221,243,211,0,152,170,207,0,222,106,199,0,183,84,94,254,92,200,56,255,138,182,115,1,142,96,146,0,133,136,228,0,97,18,150,0,55,251,66,0,140,102,4,0,202,103,151,0,30,19,248,255,51,184,207,0,202,198,89,0,55,197,225,254,169,95,249,255,66,65,68,255,188,234,126,0,166,223,100,1,112,239,244,0,144,23,194,0,58,39,182,0,244,44,24,254,175,68,179,255,152,118,154,1,176,162,130,0,217,114,204,254,173,126,78,255,33,222,30,255,36,2,91,255,2,143,243,0,9,235,215,0,3,171,151,1,24,215,245,255,168,47,164,254,241,146,207,0,69,129,180,0,68,243,113,0,144,53,72,254,251,45,14,0,23,110,168,0,68,68,79,255,110,70,95,254,174,91,144,255,33,206,95,255,137,41,7,255,19,187,153,254,35,255,112,255,9,145,185,254,50,157,37,0,11,112,49,1,102,8,190,255,234,243,169,1,60,85,23,0,74,39,189,0,116,49,239,0,173,213,210,0,46,161,108,255,159,150,37,0,196,120,185,255,34,98,6,255,153,195,62,255,97,230,71,255,102,61,76,0,26,212,236,255,164,97,16,0,198,59,146,0,163,23,196,0,56,24,61,0,181,98,193,0,251,147,229,255,98,189,24,255,46,54,206,255,234,82,246,0,183,103,38,1,109,62,204,0,10,240,224,0,146,22,117,255,142,154,120,0,69,212,35,0,208,99,118,1,121,255,3,255,72,6,194,0,117,17,197,255,125,15,23,0,154,79,153,0,214,94,197,255,185,55,147,255,62,254,78,254,127,82,153,0,110,102,63,255,108,82,161,255,105,187,212,1,80,138,39,0,60,255,93,255,72,12,186,0,210,251,31,1,190,167,144,255,228,44,19,254,128,67,232,0,214,249,107,254,136,145,86,255,132,46,176,0,189,187,227,255,208,22,140,0,217,211,116,0,50,81,186,254,139,250,31,0,30,64,198,1,135,155,100,0,160,206,23,254,187,162,211,255,16,188,63,0,254,208,49,0,85,84,191,0,241,192,242,255,153,126,145,1,234,162,162,255,230,97,216,1,64,135,126,0,190,148,223,1,52,0,43,255,28,39,189,1,64,136,238,0,175,196,185,0,98,226,213,255,127,159,244,1,226,175,60,0,160,233,142,1,180,243,207,255,69,152,89,1,31,101,21,0,144,25,164,254,139,191,209,0,91,25,121,0,32,147,5,0,39,186,123,255,63,115,230,255,93,167,198,255,143,213,220,255,179,156,19,255,25,66,122,0,214,160,217,255,2,45,62,255,106,79,146,254,51,137,99,255,87,100,231,255,175,145,232,255,101,184,1,255,174,9,125,0,82,37,161,1,36,114,141,255,48,222,142,255,245,186,154,0,5,174,221,254,63,114,155,255,135,55,160,1,80,31,135,0,126,250,179,1,236,218,45,0,20,28,145,1,16,147,73,0,249,189,132,1,17,189,192,255,223,142,198,255,72,20,15,255,250,53,237,254,15,11,18,0,27,211,113,254,213,107,56,255,174,147,146,255,96,126,48,0,23,193,109,1,37,162,94,0,199,157,249,254,24,128,187,255,205,49,178,254,93,164,42,255,43,119,235,1,88,183,237,255,218,210,1,255,107,254,42,0,230,10,99,255,162,0,226,0,219,237,91,0,129,178,203,0,208,50,95,254,206,208,95,255,247,191,89,254,110,234,79,255,165,61,243,0,20,122,112,255,246,246,185,254,103,4,123,0,233,99,230,1,219,91,252,255,199,222,22,255,179,245,233,255,211,241,234,0,111,250,192,255,85,84,136,0,101,58,50,255,131,173,156,254,119,45,51,255,118,233,16,254,242,90,214,0,94,159,219,1,3,3,234,255,98,76,92,254,80,54,230,0,5,228,231,254,53,24,223,255,113,56,118,1,20,132,1,255,171,210,236,0,56,241,158,255,186,115,19,255,8,229,174,0,48,44,0,1,114,114,166,255,6,73,226,255,205,89,244,0,137,227,75,1,248,173,56,0,74,120,246,254,119,3,11,255,81,120,198,255,136,122,98,255,146,241,221,1,109,194,78,255,223,241,70,1,214,200,169,255,97,190,47,255,47,103,174,255,99,92,72,254,118,233,180,255,193,35,233,254,26,229,32,255,222,252,198,0,204,43,71,255,199,84,172,0,134,102,190,0,111,238,97,254,230,40,230,0,227,205,64,254,200,12,225,0,166,25,222,0,113,69,51,255,143,159,24,0,167,184,74,0,29,224,116,254,158,208,233,0,193,116,126,255,212,11,133,255,22,58,140,1,204,36,51,255,232,30,43,0,235,70,181,255,64,56,146,254,169,18,84,255,226,1,13,255,200,50,176,255,52,213,245,254,168,209,97,0,191,71,55,0,34,78,156,0,232,144,58,1,185,74,189,0,186,142,149,254,64,69,127,255,161,203,147,255,176,151,191,0,136,231,203,254,163,182,137,0,161,126,251,254,233,32,66,0,68,207,66,0,30,28,37,0,93,114,96,1,254,92,247,255,44,171,69,0,202,119,11,255,188,118,50,1,255,83,136,255,71,82,26,0,70,227,2,0,32,235,121,1,181,41,154,0,71,134,229,254,202,255,36,0,41,152,5,0,154,63,73,255,34,182,124,0,121,221,150,255,26,204,213,1,41,172,87,0,90,157,146,255,109,130,20,0,71,107,200,255,243,102,189,0,1,195,145,254,46,88,117,0,8,206,227,0,191,110,253,255,109,128,20,254,134,85,51,255,137,177,112,1,216,34,22,255,131,16,208,255,121,149,170,0,114,19,23,1,166,80,31,255,113,240,122,0,232,179,250,0,68,110,180,254,210,170,119,0,223,108,164,255,207,79,233,255,27,229,226,254,209,98,81,255,79,68,7,0,131,185,100,0,170,29,162,255,17,162,107,255,57,21,11,1,100,200,181,255,127,65,166,1,165,134,204,0,104,167,168,0,1,164,79,0,146,135,59,1,70,50,128,255,102,119,13,254,227,6,135,0,162,142,179,255,160,100,222,0,27,224,219,1,158,93,195,255,234,141,137,0,16,24,125,255,238,206,47,255,97,17,98,255,116,110,12,255,96,115,77,0,91,227,232,255,248,254,79,255,92,229,6,254,88,198,139,0,206,75,129,0,250,77,206,255,141,244,123,1,138,69,220,0,32,151,6,1,131,167,22,255,237,68,167,254,199,189,150,0,163,171,138,255,51,188,6,255,95,29,137,254,148,226,179,0,181,107,208,255,134,31,82,255,151,101,45,255,129,202,225,0,224,72,147,0,48,138,151,255,195,64,206,254,237,218,158,0,106,29,137,254,253,189,233,255,103,15,17,255,194,97,255,0,178,45,169,254,198,225,155,0,39,48,117,255,135,106,115,0,97,38,181,0,150,47,65,255,83,130,229,254,246,38,129,0,92,239,154,254,91,99,127,0,161,111,33,255,238,217,242,255,131,185,195,255,213,191,158,255,41,150,218,0,132,169,131,0,89,84,252,1,171,70,128,255,163,248,203,254,1,50,180,255,124,76,85,1,251,111,80,0,99,66,239,255,154,237,182,255,221,126,133,254,74,204,99,255,65,147,119,255,99,56,167,255,79,248,149,255,116,155,228,255,237,43,14,254,69,137,11,255,22,250,241,1,91,122,143,255,205,249,243,0,212,26,60,255,48,182,176,1,48,23,191,255,203,121,152,254,45,74,213,255,62,90,18,254,245,163,230,255,185,106,116,255,83,35,159,0,12,33,2,255,80,34,62,0,16,87,174,255,173,101,85,0,202,36,81,254,160,69,204,255,64,225,187,0,58,206,94,0,86,144,47,0,229,86,245,0,63,145,190,1,37,5,39,0,109,251,26,0,137,147,234,0,162,121,145,255,144,116,206,255,197,232,185,255,183,190,140,255,73,12,254,255,139,20,242,255,170,90,239,255,97,66,187,255,245,181,135,254,222,136,52,0,245,5,51,254,203,47,78,0,152,101,216,0,73,23,125,0,254,96,33,1,235,210,73,255,43,209,88,1,7,129,109,0,122,104,228,254,170,242,203,0,242,204,135,255,202,28,233,255,65,6,127,0,159,144,71,0,100,140,95,0,78,150,13,0,251,107,118,1,182,58,125,255,1,38,108,255,141,189,209,255,8,155,125,1,113,163,91,255,121,79,190,255,134,239,108,255,76,47,248,0,163,228,239,0,17,111,10,0,88,149,75,255,215,235,239,0,167,159,24,255,47,151,108,255,107,209,188,0,233,231,99,254,28,202,148,255,174,35,138,255,110,24,68,255,2,69,181,0,107,102,82,0,102,237,7,0,92,36,237,255,221,162,83,1,55,202,6,255,135,234,135,255,24,250,222,0,65,94,168,254,245,248,210,255,167,108,201,254,255,161,111,0,205,8,254,0,136,13,116,0,100,176,132,255,43,215,126,255,177,133,130,255,158,79,148,0,67,224,37,1,12,206,21,255,62,34,110,1,237,104,175,255,80,132,111,255,142,174,72,0,84,229,180,254,105,179,140,0,64,248,15,255,233,138,16,0,245,67,123,254,218,121,212,255,63,95,218,1,213,133,137,255,143,182,82,255,48,28,11,0,244,114,141,1,209,175,76,255,157,181,150,255,186,229,3,255,164,157,111,1,231,189,139,0,119,202,190,255,218,106,64,255,68,235,63,254,96,26,172,255,187,47,11,1,215,18,251,255,81,84,89,0,68,58,128,0,94,113,5,1,92,129,208,255,97,15,83,254,9,28,188,0,239,9,164,0,60,205,152,0,192,163,98,255,184,18,60,0,217,182,139,0,109,59,120,255,4,192,251,0,169,210,240,255,37,172,92,254,148,211,245,255,179,65,52,0,253,13,115,0,185,174,206,1,114,188,149,255,237,90,173,0,43,199,192,255,88,108,113,0,52,35,76,0,66,25,148,255,221,4,7,255,151,241,114,255,190,209,232,0,98,50,199,0,151,150,213,255,18,74,36,1,53,40,7,0,19,135,65,255,26,172,69,0,174,237,85,0,99,95,41,0,3,56,16,0,39,160,177,255,200,106,218,254,185,68,84,255,91,186,61,254,67,143,141,255,13,244,166,255,99,114,198,0,199,110,163,255,193,18,186,0,124,239,246,1,110,68,22,0,2,235,46,1,212,60,107,0,105,42,105,1,14,230,152,0,7,5,131,0,141,104,154,255,213,3,6,0,131,228,162,255,179,100,28,1,231,123,85,255,206,14,223,1,253,96,230,0,38,152,149,1,98,137,122,0,214,205,3,255,226,152,179,255,6,133,137,0,158,69,140,255,113,162,154,255,180,243,172,255,27,189,115,255,143,46,220,255,213,134,225,255,126,29,69,0,188,43,137,1,242,70,9,0,90,204,255,255,231,170,147,0,23,56,19,254,56,125,157,255,48,179,218,255,79,182,253,255,38,212,191,1,41,235,124,0,96,151,28,0,135,148,190,0,205,249,39,254,52,96,136,255,212,44,136,255,67,209,131,255,252,130,23,255,219,128,20,255,198,129,118,0,108,101,11,0,178,5,146,1,62,7,100,255,181,236,94,254,28,26,164,0,76,22,112,255,120,102,79,0,202,192,229,1,200,176,215,0,41,64,244,255,206,184,78,0,167,45,63,1,160,35,0,255,59,12,142,255,204,9,144,255,219,94,229,1,122,27,112,0,189,105,109,255,64,208,74,255,251,127,55,1,2,226,198,0,44,76,209,0,151,152,77,255,210,23,46,1,201,171,69,255,44,211,231,0,190,37,224,255,245,196,62,255,169,181,222,255,34,211,17,0,119,241,197,255,229,35,152,1,21,69,40,255,178,226,161,0,148,179,193,0,219,194,254,1,40,206,51,255,231,92,250,1,67,153,170,0,21,148,241,0,170,69,82,255,121,18,231,255,92,114,3,0,184,62,230,0,225,201,87,255,146,96,162,255,181,242,220,0,173,187,221,1,226,62,170,255,56,126,217,1,117,13,227,255,179,44,239,0,157,141,155,255,144,221,83,0,235,209,208,0,42,17,165,1,251,81,133,0,124,245,201,254,97,211,24,255,83,214,166,0,154,36,9,255,248,47,127,0,90,219,140,255,161,217,38,254,212,147,63,255,66,84,148,1,207,3,1,0,230,134,89,1,127,78,122,255,224,155,1,255,82,136,74,0,178,156,208,255,186,25,49,255,222,3,210,1,229,150,190,255,85,162,52,255,41,84,141,255,73,123,84,254,93,17,150,0,119,19,28,1,32,22,215,255,28,23,204,255,142,241,52,255,228,52,125,0,29,76,207,0,215,167,250,254,175,164,230,0,55,207,105,1,109,187,245,255,161,44,220,1,41,101,128,255,167,16,94,0,93,214,107,255,118,72,0,254,80,61,234,255,121,175,125,0,139,169,251,0,97,39,147,254,250,196,49,255,165,179,110,254,223,70,187,255,22,142,125,1,154,179,138,255,118,176,42,1,10,174,153,0,156,92,102,0,168,13,161,255,143,16,32,0,250,197,180,255,203,163,44,1,87,32,36,0,161,153,20,255,123,252,15,0,25,227,80,0,60,88,142,0,17,22,201,1,154,205,77,255,39,63,47,0,8,122,141,0,128,23,182,254,204,39,19,255,4,112,29,255,23,36,140,255,210,234,116,254,53,50,63,255,121,171,104,255,160,219,94,0,87,82,14,254,231,42,5,0,165,139,127,254,86,78,38,0,130,60,66,254,203,30,45,255,46,196,122,1,249,53,162,255,136,143,103,254,215,210,114,0,231,7,160,254,169,152,42,255,111,45,246,0,142,131,135,255,131,71,204,255,36,226,11,0,0,28,242,255,225,138,213,255,247,46,216,254,245,3,183,0,108,252,74,1,206,26,48,255,205,54,246,255,211,198,36,255,121,35,50,0,52,216,202,255,38,139,129,254,242,73,148,0,67,231,141,255,42,47,204,0,78,116,25,1,4,225,191,255,6,147,228,0,58,88,177,0,122,165,229,255,252,83,201,255,224,167,96,1,177,184,158,255,242,105,179,1,248,198,240,0,133,66,203,1,254,36,47,0,45,24,115,255,119,62,254,0,196,225,186,254,123,141,172,0,26,85,41,255,226,111,183,0,213,231,151,0,4,59,7,255,238,138,148,0,66,147,33,255,31,246,141,255,209,141,116,255,104,112,31,0,88,161,172,0,83,215,230,254,47,111,151,0,45,38,52,1,132,45,204,0,138,128,109,254,233,117,134,255,243,190,173,254,241,236,240,0,82,127,236,254,40,223,161,255,110,182,225,255,123,174,239,0,135,242,145,1,51,209,154,0,150,3,115,254,217,164,252,255,55,156,69,1,84,94,255,255,232,73,45,1,20,19,212,255,96,197,59,254,96,251,33,0,38,199,73,1,64,172,247,255,117,116,56,255,228,17,18,0,62,138,103,1,246,229,164,255,244,118,201,254,86,32,159,255,109,34,137,1,85,211,186,0,10,193,193,254,122,194,177,0,122,238,102,255,162,218,171,0,108,217,161,1,158,170,34,0,176,47,155,1,181,228,11,255,8,156,0,0,16,75,93,0,206,98,255,1,58,154,35,0,12,243,184,254,67,117,66,255,230,229,123,0,201,42,110,0,134,228,178,254,186,108,118,255,58,19,154,255,82,169,62,255,114,143,115,1,239,196,50,255,173,48,193,255,147,2,84,255,150,134,147,254,95,232,73,0,109,227,52,254,191,137,10,0,40,204,30,254,76,52,97,255,164,235,126,0,254,124,188,0,74,182,21,1,121,29,35,255,241,30,7,254,85,218,214,255,7,84,150,254,81,27,117,255,160,159,152,254,66,24,221,255,227,10,60,1,141,135,102,0,208,189,150,1,117,179,92,0,132,22,136,255,120,199,28,0,21,129,79,254,182,9,65,0,218,163,169,0,246,147,198,255,107,38,144,1,78,175,205,255,214,5,250,254,47,88,29,255,164,47,204,255,43,55,6,255,131,134,207,254,116,100,214,0,96,140,75,1,106,220,144,0,195,32,28,1,172,81,5,255,199,179,52,255,37,84,203,0,170,112,174,0,11,4,91,0,69,244,27,1,117,131,92,0,33,152,175,255,140,153,107,255,251,135,43,254,87,138,4,255,198,234,147,254,121,152,84,255,205,101,155,1,157,9,25,0,72,106,17,254,108,153,0,255,189,229,186,0,193,8,176,255,174,149,209,0,238,130,29,0,233,214,126,1,61,226,102,0,57,163,4,1,198,111,51,255,45,79,78,1,115,210,10,255,218,9,25,255,158,139,198,255,211,82,187,254,80,133,83,0,157,129,230,1,243,133,134,255,40,136,16,0,77,107,79,255,183,85,92,1,177,204,202,0,163,71,147,255,152,69,190,0,172,51,188,1,250,210,172,255,211,242,113,1,89,89,26,255,64,66,111,254,116,152,42,0,161,39,27,255,54,80,254,0,106,209,115,1,103,124,97,0,221,230,98,255,31,231,6,0,178,192,120,254,15,217,203,255,124,158,79,0,112,145,247,0,92,250,48,1,163,181,193,255,37,47,142,254,144,189,165,255,46,146,240,0,6,75,128,0,41,157,200,254,87,121,213,0,1,113,236,0,5,45,250,0,144,12,82,0,31,108,231,0,225,239,119,255,167,7,189,255,187,228,132,255,110,189,34,0,94,44,204,1,162,52,197,0,78,188,241,254,57,20,141,0,244,146,47,1,206,100,51,0,125,107,148,254,27,195,77,0,152,253,90,1,7,143,144,255,51,37,31,0,34,119,38,255,7,197,118,0,153,188,211,0,151,20,116,254,245,65,52,255,180,253,110,1,47,177,209,0,161,99,17,255,118,222,202,0,125,179,252,1,123,54,126,255,145,57,191,0,55,186,121,0,10,243,138,0,205,211,229,255,125,156,241,254,148,156,185,255,227,19,188,255,124,41,32,255,31,34,206,254,17,57,83,0,204,22,37,255,42,96,98,0,119,102,184,1,3,190,28,0,110,82,218,255,200,204,192,255,201,145,118,0,117,204,146,0,132,32,98,1,192,194,121,0,106,161,248,1,237,88,124,0,23,212,26,0,205,171,90,255,248,48,216,1,141,37,230,255,124,203,0,254,158,168,30,255,214,248,21,0,112,187,7,255,75,133,239,255,74,227,243,255,250,147,70,0,214,120,162,0,167,9,179,255,22,158,18,0,218,77,209,1,97,109,81,255,244,33,179,255,57,52,57,255,65,172,210,255,249,71,209,255,142,169,238,0,158,189,153,255,174,254,103,254,98,33,14,0,141,76,230,255,113,139,52,255,15,58,212,0,168,215,201,255,248,204,215,1,223,68,160,255,57,154,183,254,47,231,121,0,106,166,137,0,81,136,138,0,165,43,51,0,231,139,61,0,57,95,59,254,118,98,25,255,151,63,236,1,94,190,250,255,169,185,114,1,5,250,58,255,75,105,97,1,215,223,134,0,113,99,163,1,128,62,112,0,99,106,147,0,163,195,10,0,33,205,182,0,214,14,174,255,129,38,231,255,53,182,223,0,98,42,159,255,247,13,40,0,188,210,177,1,6,21,0,255,255,61,148,254,137,45,129,255,89,26,116,254,126,38,114,0,251,50,242,254,121,134,128,255,204,249,167,254,165,235,215,0,202,177,243,0,133,141,62,0,240,130,190,1,110,175,255,0,0,20,146,1,37,210,121,255,7,39,130,0,142,250,84,255,141,200,207,0,9,95,104,255,11,244,174,0,134,232,126,0,167,1,123,254,16,193,149,255,232,233,239,1,213,70,112,255,252,116,160,254,242,222,220,255,205,85,227,0,7,185,58,0,118,247,63,1,116,77,177,255,62,245,200,254,63,18,37,255,107,53,232,254,50,221,211,0,162,219,7,254,2,94,43,0,182,62,182,254,160,78,200,255,135,140,170,0,235,184,228,0,175,53,138,254,80,58,77,255,152,201,2,1,63,196,34,0,5,30,184,0,171,176,154,0,121,59,206,0,38,99,39,0,172,80,77,254,0,134,151,0,186,33,241,254,94,253,223,255,44,114,252,0,108,126,57,255,201,40,13,255,39,229,27,255,39,239,23,1,151,121,51,255,153,150,248,0,10,234,174,255,118,246,4,254,200,245,38,0,69,161,242,1,16,178,150,0,113,56,130,0,171,31,105,0,26,88,108,255,49,42,106,0,251,169,66,0,69,93,149,0,20,57,254,0,164,25,111,0,90,188,90,255,204,4,197,0,40,213,50,1,212,96,132,255,88,138,180,254,228,146,124,255,184,246,247,0,65,117,86,255,253,102,210,254,254,121,36,0,137,115,3,255,60,24,216,0,134,18,29,0,59,226,97,0,176,142,71,0,7,209,161,0,189,84,51,254,155,250,72,0,213,84,235,255,45,222,224,0,238,148,143,255,170,42,53,255,78,167,117,0,186,0,40,255,125,177,103,255,69,225,66,0,227,7,88,1,75,172,6,0,169,45,227,1,16,36,70,255,50,2,9,255,139,193,22,0,143,183,231,254,218,69,50,0,236,56,161,1,213,131,42,0,138,145,44,254,136,229,40,255,49,63,35,255,61,145,245,255,101,192,2,254,232,167,113,0,152,104,38,1,121,185,218,0,121,139,211,254,119,240,35,0,65,189,217,254,187,179,162,255,160,187,230,0,62,248,14,255,60,78,97,0,255,247,163,255,225,59,91,255,107,71,58,255,241,47,33,1,50,117,236,0,219,177,63,254,244,90,179,0,35,194,215,255,189,67,50,255,23,135,129,0,104,189,37,255,185,57,194,0,35,62,231,255,220,248,108,0,12,231,178,0,143,80,91,1,131,93,101,255,144,39,2,1,255,250,178,0,5,17,236,254,139,32,46,0,204,188,38,254,245,115,52,255,191,113,73,254,191,108,69,255,22,69,245,1,23,203,178,0,170,99,170,0,65,248,111,0,37,108,153,255,64,37,69,0,0,88,62,254,89,148,144,255,191,68,224,1,241,39,53,0,41,203,237,255,145,126,194,255,221,42,253,255,25,99,151,0,97,253,223,1,74,115,49,255,6,175,72,255,59,176,203,0,124,183,249,1,228,228,99,0,129,12,207,254,168,192,195,255,204,176,16,254,152,234,171,0,77,37,85,255,33,120,135,255,142,194,227,1,31,214,58,0,213,187,125,255,232,46,60,255,190,116,42,254,151,178,19,255,51,62,237,254,204,236,193,0,194,232,60,0,172,34,157,255,189,16,184,254,103,3,95,255,141,233,36,254,41,25,11,255,21,195,166,0,118,245,45,0,67,213,149,255,159,12,18,255])
.concat([187,164,227,1,160,25,5,0,12,78,195,1,43,197,225,0,48,142,41,254,196,155,60,255,223,199,18,1,145,136,156,0,252,117,169,254,145,226,238,0,239,23,107,0,109,181,188,255,230,112,49,254,73,170,237,255,231,183,227,255,80,220,20,0,194,107,127,1,127,205,101,0,46,52,197,1,210,171,36,255,88,3,90,255,56,151,141,0,96,187,255,255,42,78,200,0,254,70,70,1,244,125,168,0,204,68,138,1,124,215,70,0,102,66,200,254,17,52,228,0,117,220,143,254,203,248,123,0,56,18,174,255,186,151,164,255,51,232,208,1,160,228,43,255,249,29,25,1,68,190,63,0,34,174,40,215,152,47,138,66,205,101,239,35,145,68,55,113,47,59,77,236,207,251,192,181,188,219,137,129,165,219,181,233,56,181,72,243,91,194,86,57,25,208,5,182,241,17,241,89,155,79,25,175,164,130,63,146,24,129,109,218,213,94,28,171,66,2,3,163,152,170,7,216,190,111,112,69,1,91,131,18,140,178,228,78,190,133,49,36,226,180,255,213,195,125,12,85,111,137,123,242,116,93,190,114,177,150,22,59,254,177,222,128,53,18,199,37,167,6,220,155,148,38,105,207,116,241,155,193,210,74,241,158,193,105,155,228,227,37,79,56,134,71,190,239,181,213,140,139,198,157,193,15,101,156,172,119,204,161,12,36,117,2,43,89,111,44,233,45,131,228,166,110,170,132,116,74,212,251,65,189,220,169,176,92,181,83,17,131,218,136,249,118,171,223,102,238,82,81,62,152,16,50,180,45,109,198,49,168,63,33,251,152,200,39,3,176,228,14,239,190,199,127,89,191,194,143,168,61,243,11,224,198,37,167,10,147,71,145,167,213,111,130,3,224,81,99,202,6,112,110,14,10,103,41,41,20,252,47,210,70,133,10,183,39,38,201,38,92,56,33,27,46,237,42,196,90,252,109,44,77,223,179,149,157,19,13,56,83,222,99,175,139,84,115,10,101,168,178,119,60,187,10,106,118,230,174,237,71,46,201,194,129,59,53,130,20,133,44,114,146,100,3,241,76,161,232,191,162,1,48,66,188,75,102,26,168,145,151,248,208,112,139,75,194,48,190,84,6,163,81,108,199,24,82,239,214,25,232,146,209,16,169,101,85,36,6,153,214,42,32,113,87,133,53,14,244,184,209,187,50,112,160,106,16,200,208,210,184,22,193,164,25,83,171,65,81,8,108,55,30,153,235,142,223,76,119,72,39,168,72,155,225,181,188,176,52,99,90,201,197,179,12,28,57,203,138,65,227,74,170,216,78,115,227,99,119,79,202,156,91,163,184,178,214,243,111,46,104,252,178,239,93,238,130,143,116,96,47,23,67,111,99,165,120,114,171,240,161,20,120,200,132,236,57,100,26,8,2,199,140,40,30,99,35,250,255,190,144,233,189,130,222,235,108,80,164,21,121,198,178,247,163,249,190,43,83,114,227,242,120,113,198,156,97,38,234,206,62,39,202,7,194,192,33,199,184,134,209,30,235,224,205,214,125,218,234,120,209,110,238,127,79,125,245,186,111,23,114,170,103,240,6,166,152,200,162,197,125,99,10,174,13,249,190,4,152,63,17,27,71,28,19,53,11,113,27,132,125,4,35,245,119,219,40,147,36,199,64,123,171,202,50,188,190,201,21,10,190,158,60,76,13,16,156,196,103,29,67,182,66,62,203,190,212,197,76,42,126,101,252,156,41,127,89,236,250,214,58,171,111,203,95,23,88,71,74,140,25,68,108,8,201,188,243,103,230,9,106,59,167,202,132,133,174,103,187,43,248,148,254,114,243,110,60,241,54,29,95,58,245,79,165,209,130,230,173,127,82,14,81,31,108,62,43,140,104,5,155,107,189,65,251,171,217,131,31,121,33,126,19,25,205,224,91,133,59,140,1,189,241,36,255,248,37,195,1,96,220,55,0,183,76,62,255,195,66,61,0,50,76,164,1,225,164,76,255,76,61,163,255,117,62,31,0,81,145,64,255,118,65,14,0,162,115,214,255,6,138,46,0,124,230,244,255,10,138,143,0,52,26,194,0,184,244,76,0,129,143,41,1,190,244,19,255,123,170,122,255,98,129,68,0,121,213,147,0,86,101,30,255,161,103,155,0,140,89,67,255,239,229,190,1,67,11,181,0,198,240,137,254,238,69,188,255,67,151,238,0,19,42,108,255,229,85,113,1,50,68,135,255,17,106,9,0,50,103,1,255,80,1,168,1,35,152,30,255,16,168,185,1,56,89,232,255,101,210,252,0,41,250,71,0,204,170,79,255,14,46,239,255,80,77,239,0,189,214,75,255,17,141,249,0,38,80,76,255,190,85,117,0,86,228,170,0,156,216,208,1,195,207,164,255,150,66,76,255,175,225,16,255,141,80,98,1,76,219,242,0,198,162,114,0,46,218,152,0,155,43,241,254,155,160,104,255,51,187,165,0,2,17,175,0,66,84,160,1,247,58,30,0,35,65,53,254,69,236,191,0,45,134,245,1,163,123,221,0,32,110,20,255,52,23,165,0,186,214,71,0,233,176,96,0,242,239,54,1,57,89,138,0,83,0,84,255,136,160,100,0,92,142,120,254,104,124,190,0,181,177,62,255,250,41,85,0,152,130,42,1,96,252,246,0,151,151,63,254,239,133,62,0,32,56,156,0,45,167,189,255,142,133,179,1,131,86,211,0,187,179,150,254,250,170,14,255,210,163,78,0,37,52,151,0,99,77,26,0,238,156,213,255,213,192,209,1,73,46,84,0,20,65,41,1,54,206,79,0,201,131,146,254,170,111,24,255,177,33,50,254,171,38,203,255,78,247,116,0,209,221,153,0,133,128,178,1,58,44,25,0,201,39,59,1,189,19,252,0,49,229,210,1,117,187,117,0,181,179,184,1,0,114,219,0,48,94,147,0,245,41,56,0,125,13,204,254,244,173,119,0,44,221,32,254,84,234,20,0,249,160,198,1,236,126,234,255,47,99,168,254,170,226,153,255,102,179,216,0,226,141,122,255,122,66,153,254,182,245,134,0,227,228,25,1,214,57,235,255,216,173,56,255,181,231,210,0,119,128,157,255,129,95,136,255,110,126,51,0,2,169,183,255,7,130,98,254,69,176,94,255,116,4,227,1,217,242,145,255,202,173,31,1,105,1,39,255,46,175,69,0,228,47,58,255,215,224,69,254,207,56,69,255,16,254,139,255,23,207,212,255,202,20,126,255,95,213,96,255,9,176,33,0,200,5,207,255,241,42,128,254,35,33,192,255,248,229,196,1,129,17,120,0,251,103,151,255,7,52,112,255,140,56,66,255,40,226,245,255,217,70,37,254,172,214,9,255,72,67,134,1,146,192,214,255,44,38,112,0,68,184,75,255,206,90,251,0,149,235,141,0,181,170,58,0,116,244,239,0,92,157,2,0,102,173,98,0,233,137,96,1,127,49,203,0,5,155,148,0,23,148,9,255,211,122,12,0,34,134,26,255,219,204,136,0,134,8,41,255,224,83,43,254,85,25,247,0,109,127,0,254,169,136,48,0,238,119,219,255,231,173,213,0,206,18,254,254,8,186,7,255,126,9,7,1,111,42,72,0,111,52,236,254,96,63,141,0,147,191,127,254,205,78,192,255,14,106,237,1,187,219,76,0,175,243,187,254,105,89,173,0,85,25,89,1,162,243,148,0,2,118,209,254,33,158,9,0,139,163,46,255,93,70,40,0,108,42,142,254,111,252,142,255,155,223,144,0,51,229,167,255,73,252,155,255,94,116,12,255,152,160,218,255,156,238,37,255,179,234,207,255,197,0,179,255,154,164,141,0,225,196,104,0,10,35,25,254,209,212,242,255,97,253,222,254,184,101,229,0,222,18,127,1,164,136,135,255,30,207,140,254,146,97,243,0,129,192,26,254,201,84,33,255,111,10,78,255,147,81,178,255,4,4,24,0,161,238,215,255,6,141,33,0,53,215,14,255,41,181,208,255,231,139,157,0,179,203,221,255,255,185,113,0,189,226,172,255,113,66,214,255,202,62,45,255,102,64,8,255,78,174,16,254,133,117,68,255])
, "i8", ALLOC_NONE, Runtime.GLOBAL_BASE)
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
  Module["_memcpy"] = _memcpy; 
  Module["_memmove"] = _memmove;var _llvm_memmove_p0i8_p0i8_i32=_memmove;
  var _llvm_memcpy_p0i8_p0i8_i32=_memcpy;
  Module["_memset"] = _memset;var _llvm_memset_p0i8_i32=_memset;
  var _llvm_memset_p0i8_i64=_memset;
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
  Module["_malloc"] = _malloc;
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
function at(a){a=a|0;var b=0;b=i;i=i+a|0;i=i+7>>3<<3;return b|0}function au(){return i|0}function av(a){a=a|0;i=a}function aw(a,b){a=a|0;b=b|0;if((q|0)==0){q=a;r=b}}function ax(a){a=a|0;D=a}function ay(a){a=a|0;E=a}function az(a){a=a|0;F=a}function aA(a){a=a|0;G=a}function aB(a){a=a|0;H=a}function aC(a){a=a|0;I=a}function aD(a){a=a|0;J=a}function aE(a){a=a|0;K=a}function aF(a){a=a|0;L=a}function aG(a){a=a|0;M=a}function aH(b,c){b=b|0;c=c|0;return((((a[c+1|0]^a[b+1|0]|a[c]^a[b]|a[c+2|0]^a[b+2|0]|a[c+3|0]^a[b+3|0]|a[c+4|0]^a[b+4|0]|a[c+5|0]^a[b+5|0]|a[c+6|0]^a[b+6|0]|a[c+7|0]^a[b+7|0]|a[c+8|0]^a[b+8|0]|a[c+9|0]^a[b+9|0]|a[c+10|0]^a[b+10|0]|a[c+11|0]^a[b+11|0]|a[c+12|0]^a[b+12|0]|a[c+13|0]^a[b+13|0]|a[c+14|0]^a[b+14|0]|a[c+15|0]^a[b+15|0]|a[c+16|0]^a[b+16|0]|a[c+17|0]^a[b+17|0]|a[c+18|0]^a[b+18|0]|a[c+19|0]^a[b+19|0]|a[c+20|0]^a[b+20|0]|a[c+21|0]^a[b+21|0]|a[c+22|0]^a[b+22|0]|a[c+23|0]^a[b+23|0]|a[c+24|0]^a[b+24|0]|a[c+25|0]^a[b+25|0]|a[c+26|0]^a[b+26|0]|a[c+27|0]^a[b+27|0]|a[c+28|0]^a[b+28|0]|a[c+29|0]^a[b+29|0]|a[c+30|0]^a[b+30|0]|a[c+31|0]^a[b+31|0])&255)+511|0)>>>8&1)-1|0}function aI(b,d,e,f){b=b|0;d=d|0;e=e|0;f=f|0;var g=0,h=0,j=0,k=0,l=0,m=0,n=0,o=0;g=i;i=i+384|0;h=g+152|0;j=g+312|0;k=g+376|0;l=i;i=i+(f+64|0)|0;i=i+7>>3<<3;c[k>>2]=0;c[k+4>>2]=0;m=j|0;bb(m|0,d|0,32);a2(h,d);d=g+32|0;aR(d,h+80|0);n=g+72|0;aP(n,h|0,d);o=g+112|0;aP(o,h+40|0,d);aU(j+32|0,o);o=g|0;aU(o,n);n=j+63|0;j=a[n]^a[o]<<7;a[n]=j;aK(l,k,e,f,0,m);bb(b|0,l|0,64);l=b+63|0;a[l]=a[l]|j&-128;i=g;return}function aJ(b,d,e,f){b=b|0;d=d|0;e=e|0;f=f|0;var g=0,h=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0;g=i;i=i+240|0;h=g|0;j=g+40|0;k=g+80|0;l=g+200|0;m=f+64|0;n=i;i=i+m|0;i=i+7>>3<<3;o=i;i=i+m|0;i=i+7>>3<<3;p=h|0;aO(p,d);d=j|0;q=c[p>>2]|0;p=c[h+4>>2]|0;r=c[h+8>>2]|0;s=c[h+12>>2]|0;t=c[h+16>>2]|0;u=c[h+20>>2]|0;v=c[h+24>>2]|0;w=c[h+28>>2]|0;x=c[h+32>>2]|0;y=c[h+36>>2]|0;c[d>>2]=q-1;c[j+4>>2]=p;c[j+8>>2]=r;c[j+12>>2]=s;c[j+16>>2]=t;c[j+20>>2]=u;c[j+24>>2]=v;c[j+28>>2]=w;c[j+32>>2]=x;c[j+36>>2]=y;j=k|0;c[j>>2]=q+1;c[k+4>>2]=p;c[k+8>>2]=r;c[k+12>>2]=s;c[k+16>>2]=t;c[k+20>>2]=u;c[k+24>>2]=v;c[k+28>>2]=w;c[k+32>>2]=x;c[k+36>>2]=y;y=g+120|0;aR(y,j);j=g+160|0;aP(j,d,y);y=l|0;aU(y,j);j=b+63|0;d=a[j]|0;k=l+31|0;a[k]=a[k]|d&-128;a[j]=d&127;bb(n|0,b|0,64);bb(n+64|0,e|0,f);f=a5(o,g+232|0,n,m,0,y)|0;i=g;return f|0}function aK(b,d,e,f,g,h){b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;h=h|0;var j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0;j=i;i=i+872|0;k=j|0;l=j+200|0;m=j+232|0;n=j+272|0;o=j+312|0;p=j+352|0;q=j+648|0;r=j+712|0;s=j+552|0;bb(s|0,h+32|0,32);t=bf(f,g,64,0)|0;c[d>>2]=t;c[d+4>>2]=D;bc(b+64|0,e|0,f|0);e=b+32|0;bc(e|0,h|0,32);d=j+584|0;u=bf(f,g,32,0)|0;g=p|0;f=p+128|0;bb(f|0,31520,64);v=p+192|0;c[v>>2]=0;c[v+4>>2]=0;w=u;if((w|0)!=0){u=f;f=w;w=e;x=0;while(1){y=128-x|0;z=y>>>0>f>>>0?f:y;bb(p+x|0,w|0,z);y=z+x|0;if((y|0)==128){a9(g,u);A=0}else{A=y}y=bf(c[v>>2]|0,c[v+4>>2]|0,z,0)|0;c[v>>2]=y;c[v+4>>2]=D;if((f|0)==(z|0)){break}else{f=f-z|0;w=w+z|0;x=A}}}ba(g,0,0,d,8);bb(e|0,s|0,32);a7(d);a2(r,d);s=m|0;aR(s,r+80|0);m=n|0;aP(m,r|0,s);n=o|0;aP(n,r+40|0,s);aU(b,n);n=l|0;aU(n,m);m=b+31|0;a[m]=a[m]^a[n]<<7;n=q|0;q=k|0;m=k+128|0;bb(m|0,31520,64);l=k+192|0;c[l>>2]=0;c[l+4>>2]=0;s=t;if((s|0)==0){ba(q,0,0,n,8);a7(n);a6(e,n,h,d);i=j;return 0}t=m;m=s;s=b;b=0;while(1){r=128-b|0;o=r>>>0>m>>>0?m:r;bb(k+b|0,s|0,o);r=o+b|0;if((r|0)==128){a9(q,t);B=0}else{B=r}r=bf(c[l>>2]|0,c[l+4>>2]|0,o,0)|0;c[l>>2]=r;c[l+4>>2]=D;if((m|0)==(o|0)){break}else{m=m-o|0;s=s+o|0;b=B}}ba(q,0,0,n,8);a7(n);a6(e,n,h,d);i=j;return 0}function aL(b,e,f){b=b|0;e=e|0;f=f|0;var g=0,h=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0,L=0,M=0,N=0,O=0,P=0,Q=0,R=0,S=0,T=0,U=0,V=0,W=0,X=0,Y=0,Z=0,_=0,aa=0,ab=0,ac=0,ad=0,ae=0,af=0,ag=0,ah=0,ai=0,aj=0,ak=0,al=0,am=0,an=0,ao=0,ap=0,aq=0,ar=0,as=0,at=0,au=0,av=0,aw=0,ax=0,ay=0,az=0,aA=0,aB=0,aC=0,aD=0,aE=0,aF=0,aG=0,aH=0,aI=0,aJ=0,aK=0,aL=0,aO=0,aP=0,aR=0,aS=0,aT=0,aU=0,aV=0,aW=0,aX=0,aY=0,aZ=0,a_=0,a$=0,a0=0,a1=0,a2=0,a3=0,a4=0,a5=0,a6=0,a7=0,a8=0,a9=0,ba=0,bc=0,be=0,bh=0,bi=0,bj=0,bk=0,bl=0,bm=0,bn=0,bo=0,bq=0,br=0,bs=0,bt=0,bu=0,bv=0,bw=0,bx=0,by=0,bz=0,bA=0,bB=0,bC=0,bD=0,bE=0,bF=0,bG=0,bH=0,bI=0,bJ=0,bK=0,bL=0,bM=0,bN=0,bO=0,bP=0,bQ=0,bR=0,bS=0,bT=0,bU=0,bV=0,bW=0,bX=0,bY=0,bZ=0,b_=0,b$=0,b0=0,b1=0,b2=0,b3=0,b4=0;g=i;i=i+3480|0;h=g|0;j=g+80|0;k=g+160|0;l=g+240|0;m=g+320|0;n=g+400|0;o=g+480|0;p=g+560|0;q=g+640|0;r=g+720|0;s=g+800|0;t=g+952|0;u=g+1104|0;v=g+1256|0;w=g+1560|0;x=g+1712|0;y=g+1864|0;z=g+2016|0;A=g+2168|0;B=g+2320|0;C=g+2472|0;E=g+2624|0;F=g+2776|0;G=g+2928|0;H=g+3080|0;I=g+3120|0;J=g+3200|0;K=g+3280|0;L=g+3368|0;M=g+3448|0;bb(M|0,e|0,32);e=I|0;N=d[f+1|0]|0;O=d[f+2|0]|0;P=d[f+3|0]|0;Q=0;c[e>>2]=N<<8|0>>>24|(d[f]|0)|(O<<16|0>>>16)|(P<<24|0>>>8)&50331648;c[e+4>>2]=0<<8|N>>>24|(0<<16|O>>>16)|(Q<<24|P>>>8)&0;O=d[f+4|0]|0;N=d[f+5|0]|0;R=d[f+6|0]|0;S=0;T=0<<8|O>>>24|Q|(0<<16|N>>>16)|(S<<24|R>>>8);Q=I+8|0;c[Q>>2]=((O<<8|0>>>24|P|(N<<16|0>>>16)|(R<<24|0>>>8))>>>2|T<<30)&33554431;c[Q+4>>2]=(T>>>2|0<<30)&0;T=d[f+7|0]|0;Q=d[f+8|0]|0;N=d[f+9|0]|0;P=0;O=0<<8|T>>>24|S|(0<<16|Q>>>16)|(P<<24|N>>>8);S=I+16|0;c[S>>2]=((T<<8|0>>>24|R|(Q<<16|0>>>16)|(N<<24|0>>>8))>>>3|O<<29)&67108863;c[S+4>>2]=(O>>>3|0<<29)&0;O=d[f+10|0]|0;S=d[f+11|0]|0;Q=d[f+12|0]|0;R=0;T=0<<8|O>>>24|P|(0<<16|S>>>16)|(R<<24|Q>>>8);P=I+24|0;c[P>>2]=((O<<8|0>>>24|N|(S<<16|0>>>16)|(Q<<24|0>>>8))>>>5|T<<27)&33554431;c[P+4>>2]=(T>>>5|0<<27)&0;T=d[f+13|0]|0;P=d[f+14|0]|0;S=d[f+15|0]|0;N=0<<8|T>>>24|R|(0<<16|P>>>16)|(0<<24|S>>>8);R=I+32|0;c[R>>2]=((T<<8|0>>>24|Q|(P<<16|0>>>16)|(S<<24|0>>>8))>>>6|N<<26)&67108863;c[R+4>>2]=(N>>>6|0<<26)&0;N=d[f+17|0]|0;R=d[f+18|0]|0;S=d[f+19|0]|0;P=0;Q=I+40|0;c[Q>>2]=N<<8|0>>>24|(d[f+16|0]|0)|(R<<16|0>>>16)|(S<<24|0>>>8)&16777216;c[Q+4>>2]=0<<8|N>>>24|(0<<16|R>>>16)|(P<<24|S>>>8)&0;R=d[f+20|0]|0;N=d[f+21|0]|0;Q=d[f+22|0]|0;T=0;O=0<<8|R>>>24|P|(0<<16|N>>>16)|(T<<24|Q>>>8);P=I+48|0;c[P>>2]=((R<<8|0>>>24|S|(N<<16|0>>>16)|(Q<<24|0>>>8))>>>1|O<<31)&67108863;c[P+4>>2]=(O>>>1|0<<31)&0;O=d[f+23|0]|0;P=d[f+24|0]|0;N=d[f+25|0]|0;S=0;R=0<<8|O>>>24|T|(0<<16|P>>>16)|(S<<24|N>>>8);T=I+56|0;c[T>>2]=((O<<8|0>>>24|Q|(P<<16|0>>>16)|(N<<24|0>>>8))>>>3|R<<29)&33554431;c[T+4>>2]=(R>>>3|0<<29)&0;R=d[f+26|0]|0;T=d[f+27|0]|0;P=d[f+28|0]|0;Q=0;O=0<<8|R>>>24|S|(0<<16|T>>>16)|(Q<<24|P>>>8);S=I+64|0;c[S>>2]=((R<<8|0>>>24|N|(T<<16|0>>>16)|(P<<24|0>>>8))>>>4|O<<28)&67108863;c[S+4>>2]=(O>>>4|0<<28)&0;O=d[f+29|0]|0;S=d[f+30|0]|0;T=d[f+31|0]|0;f=0<<8|O>>>24|Q|(0<<16|S>>>16)|(0<<24|T>>>8);Q=I+72|0;c[Q>>2]=((O<<8|0>>>24|P|(S<<16|0>>>16)|(T<<24|0>>>8))>>>6|f<<26)&33554431;c[Q+4>>2]=(f>>>6|0<<26)&0;f=J|0;Q=x;bd(Q|0,0,152);bd(y|0,0,152);T=y|0;c[T>>2]=1;c[T+4>>2]=0;bd(z|0,0,152);y=z|0;c[y>>2]=1;c[y+4>>2]=0;bd(A|0,0,152);bd(B|0,0,152);bd(C|0,0,152);z=C|0;c[z>>2]=1;c[z+4>>2]=0;bd(E|0,0,152);bd(F|0,0,152);C=F|0;c[C>>2]=1;c[C+4>>2]=0;bb(Q|0,I|0,80);I=G;Q=v;F=w;S=u|0;P=v|0;O=u+144|0;N=u+64|0;R=u+136|0;U=u+56|0;V=u+128|0;W=u+48|0;X=u+120|0;Y=u+40|0;Z=u+112|0;_=u+32|0;aa=u+104|0;ab=u+24|0;ac=u+96|0;ad=u+16|0;ae=u+88|0;af=u+8|0;ag=u+80|0;ah=v+144|0;ai=v+64|0;aj=v+136|0;ak=v+56|0;al=v+128|0;am=v+48|0;an=v+120|0;ao=v+40|0;ap=v+112|0;aq=v+32|0;ar=v+104|0;as=v+24|0;at=v+96|0;au=v+16|0;av=v+88|0;aw=v+8|0;ax=v+80|0;ay=u+72|0;u=v+72|0;v=w|0;w=g+1408|0;az=s|0;aA=t|0;aB=s+8|0;aC=t+8|0;aD=s+16|0;aE=t+16|0;aF=s+24|0;aG=t+24|0;aH=s+32|0;aI=t+32|0;aJ=s+40|0;aK=t+40|0;aL=s+48|0;aO=t+48|0;aP=s+56|0;aR=t+56|0;aS=s+64|0;aT=t+64|0;aU=s+72|0;s=t+72|0;t=G|0;aV=G+80|0;aW=aV;aX=G+8|0;aY=G+16|0;aZ=G+24|0;a_=G+32|0;a$=G+40|0;a0=G+48|0;a1=G+56|0;a2=G+64|0;a3=G+72|0;a4=y;y=A|0;A=T;T=B|0;B=z;z=E|0;E=C;C=0;a5=x|0;while(1){x=a4;a6=y;a7=A;a8=T;a9=B;ba=z;bc=E;be=0;bh=a[M+(31-C|0)|0]|0;bi=a5;while(1){bj=bg(0,0,(bh&255)>>>7,0)|0;bk=0;while(1){bl=x+(bk<<3)|0;bm=c[bl>>2]|0;bn=bi+(bk<<3)|0;bo=(c[bn>>2]^bm)&bj;bq=bo^bm;c[bl>>2]=bq;c[bl+4>>2]=(bq|0)<0?-1:0;bq=bo^c[bn>>2];c[bn>>2]=bq;c[bn+4>>2]=(bq|0)<0?-1:0;bq=bk+1|0;if(bq>>>0<10){bk=bq}else{br=0;break}}do{bk=a6+(br<<3)|0;bq=c[bk>>2]|0;bn=a7+(br<<3)|0;bo=(c[bn>>2]^bq)&bj;bl=bo^bq;c[bk>>2]=bl;c[bk+4>>2]=(bl|0)<0?-1:0;bl=bo^c[bn>>2];c[bn>>2]=bl;c[bn+4>>2]=(bl|0)<0?-1:0;br=br+1|0;}while(br>>>0<10);bl=c[x>>2]|0;bn=c[x+4>>2]|0;bo=x+8|0;bk=c[bo>>2]|0;bq=c[bo+4>>2]|0;bm=x+16|0;bs=c[bm>>2]|0;bt=c[bm+4>>2]|0;bu=x+24|0;bv=c[bu>>2]|0;bw=c[bu+4>>2]|0;bx=x+32|0;by=c[bx>>2]|0;bz=c[bx+4>>2]|0;bA=x+40|0;bB=c[bA>>2]|0;bC=c[bA+4>>2]|0;bD=x+48|0;bE=c[bD>>2]|0;bF=c[bD+4>>2]|0;bG=x+56|0;bH=c[bG>>2]|0;bI=c[bG+4>>2]|0;bJ=x+64|0;bK=c[bJ>>2]|0;bL=c[bJ+4>>2]|0;bM=x+72|0;bN=c[bM>>2]|0;bO=c[bM+4>>2]|0;bP=bf(c[a6>>2]|0,c[a6+4>>2]|0,bl,bn)|0;c[x>>2]=bP;c[x+4>>2]=D;bP=a6+8|0;bQ=bf(c[bP>>2]|0,c[bP+4>>2]|0,bk,bq)|0;c[bo>>2]=bQ;c[bo+4>>2]=D;bo=a6+16|0;bQ=bf(c[bo>>2]|0,c[bo+4>>2]|0,bs,bt)|0;c[bm>>2]=bQ;c[bm+4>>2]=D;bm=a6+24|0;bQ=bf(c[bm>>2]|0,c[bm+4>>2]|0,bv,bw)|0;c[bu>>2]=bQ;c[bu+4>>2]=D;bu=a6+32|0;bQ=bf(c[bu>>2]|0,c[bu+4>>2]|0,by,bz)|0;c[bx>>2]=bQ;c[bx+4>>2]=D;bx=a6+40|0;bQ=bf(c[bx>>2]|0,c[bx+4>>2]|0,bB,bC)|0;c[bA>>2]=bQ;c[bA+4>>2]=D;bA=a6+48|0;bQ=bf(c[bA>>2]|0,c[bA+4>>2]|0,bE,bF)|0;c[bD>>2]=bQ;c[bD+4>>2]=D;bD=a6+56|0;bQ=bf(c[bD>>2]|0,c[bD+4>>2]|0,bH,bI)|0;c[bG>>2]=bQ;c[bG+4>>2]=D;bG=a6+64|0;bQ=bf(c[bG>>2]|0,c[bG+4>>2]|0,bK,bL)|0;c[bJ>>2]=bQ;c[bJ+4>>2]=D;bJ=a6+72|0;bQ=bf(c[bJ>>2]|0,c[bJ+4>>2]|0,bN,bO)|0;c[bM>>2]=bQ;c[bM+4>>2]=D;bM=bg(bl,bn,c[a6>>2]|0,c[a6+4>>2]|0)|0;c[a6>>2]=bM;c[a6+4>>2]=D;bM=bg(bk,bq,c[bP>>2]|0,c[bP+4>>2]|0)|0;c[bP>>2]=bM;c[bP+4>>2]=D;bP=bg(bs,bt,c[bo>>2]|0,c[bo+4>>2]|0)|0;c[bo>>2]=bP;c[bo+4>>2]=D;bo=bg(bv,bw,c[bm>>2]|0,c[bm+4>>2]|0)|0;c[bm>>2]=bo;c[bm+4>>2]=D;bm=bg(by,bz,c[bu>>2]|0,c[bu+4>>2]|0)|0;c[bu>>2]=bm;c[bu+4>>2]=D;bu=bg(bB,bC,c[bx>>2]|0,c[bx+4>>2]|0)|0;c[bx>>2]=bu;c[bx+4>>2]=D;bx=bg(bE,bF,c[bA>>2]|0,c[bA+4>>2]|0)|0;c[bA>>2]=bx;c[bA+4>>2]=D;bA=bg(bH,bI,c[bD>>2]|0,c[bD+4>>2]|0)|0;c[bD>>2]=bA;c[bD+4>>2]=D;bD=bg(bK,bL,c[bG>>2]|0,c[bG+4>>2]|0)|0;c[bG>>2]=bD;c[bG+4>>2]=D;bG=bg(bN,bO,c[bJ>>2]|0,c[bJ+4>>2]|0)|0;c[bJ>>2]=bG;c[bJ+4>>2]=D;bJ=c[bi>>2]|0;bG=c[bi+4>>2]|0;bO=bi+8|0;bN=c[bO>>2]|0;bD=c[bO+4>>2]|0;bL=bi+16|0;bK=c[bL>>2]|0;bA=c[bL+4>>2]|0;bI=bi+24|0;bH=c[bI>>2]|0;bx=c[bI+4>>2]|0;bF=bi+32|0;bE=c[bF>>2]|0;bu=c[bF+4>>2]|0;bC=bi+40|0;bB=c[bC>>2]|0;bm=c[bC+4>>2]|0;bz=bi+48|0;by=c[bz>>2]|0;bo=c[bz+4>>2]|0;bw=bi+56|0;bv=c[bw>>2]|0;bP=c[bw+4>>2]|0;bt=bi+64|0;bs=c[bt>>2]|0;bM=c[bt+4>>2]|0;bq=bi+72|0;bk=c[bq>>2]|0;bn=c[bq+4>>2]|0;bl=bf(c[a7>>2]|0,c[a7+4>>2]|0,bJ,bG)|0;c[bi>>2]=bl;c[bi+4>>2]=D;bl=a7+8|0;bQ=bf(c[bl>>2]|0,c[bl+4>>2]|0,bN,bD)|0;c[bO>>2]=bQ;c[bO+4>>2]=D;bO=a7+16|0;bQ=bf(c[bO>>2]|0,c[bO+4>>2]|0,bK,bA)|0;c[bL>>2]=bQ;c[bL+4>>2]=D;bL=a7+24|0;bQ=bf(c[bL>>2]|0,c[bL+4>>2]|0,bH,bx)|0;c[bI>>2]=bQ;c[bI+4>>2]=D;bI=a7+32|0;bQ=bf(c[bI>>2]|0,c[bI+4>>2]|0,bE,bu)|0;c[bF>>2]=bQ;c[bF+4>>2]=D;bF=a7+40|0;bQ=bf(c[bF>>2]|0,c[bF+4>>2]|0,bB,bm)|0;c[bC>>2]=bQ;c[bC+4>>2]=D;bC=a7+48|0;bQ=bf(c[bC>>2]|0,c[bC+4>>2]|0,by,bo)|0;c[bz>>2]=bQ;c[bz+4>>2]=D;bz=a7+56|0;bQ=bf(c[bz>>2]|0,c[bz+4>>2]|0,bv,bP)|0;c[bw>>2]=bQ;c[bw+4>>2]=D;bw=a7+64|0;bQ=bf(c[bw>>2]|0,c[bw+4>>2]|0,bs,bM)|0;c[bt>>2]=bQ;c[bt+4>>2]=D;bt=a7+72|0;bQ=bf(c[bt>>2]|0,c[bt+4>>2]|0,bk,bn)|0;c[bq>>2]=bQ;c[bq+4>>2]=D;bq=bg(bJ,bG,c[a7>>2]|0,c[a7+4>>2]|0)|0;c[a7>>2]=bq;c[a7+4>>2]=D;bq=bg(bN,bD,c[bl>>2]|0,c[bl+4>>2]|0)|0;c[bl>>2]=bq;c[bl+4>>2]=D;bl=bg(bK,bA,c[bO>>2]|0,c[bO+4>>2]|0)|0;c[bO>>2]=bl;c[bO+4>>2]=D;bO=bg(bH,bx,c[bL>>2]|0,c[bL+4>>2]|0)|0;c[bL>>2]=bO;c[bL+4>>2]=D;bL=bg(bE,bu,c[bI>>2]|0,c[bI+4>>2]|0)|0;c[bI>>2]=bL;c[bI+4>>2]=D;bI=bg(bB,bm,c[bF>>2]|0,c[bF+4>>2]|0)|0;c[bF>>2]=bI;c[bF+4>>2]=D;bF=bg(by,bo,c[bC>>2]|0,c[bC+4>>2]|0)|0;c[bC>>2]=bF;c[bC+4>>2]=D;bC=bg(bv,bP,c[bz>>2]|0,c[bz+4>>2]|0)|0;c[bz>>2]=bC;c[bz+4>>2]=D;bz=bg(bs,bM,c[bw>>2]|0,c[bw+4>>2]|0)|0;c[bw>>2]=bz;c[bw+4>>2]=D;bw=bg(bk,bn,c[bt>>2]|0,c[bt+4>>2]|0)|0;c[bt>>2]=bw;c[bt+4>>2]=D;aM(S,bi,a6);aM(P,x,a7);bt=c[O>>2]|0;bw=c[O+4>>2]|0;bn=c[N>>2]|0;bk=c[N+4>>2]|0;bz=bp(bt,bw,18,0)|0;bM=D;bs=bf(bn,bk,bt,bw)|0;bw=bf(bs,D,bz,bM)|0;c[N>>2]=bw;c[N+4>>2]=D;bw=c[R>>2]|0;bM=c[R+4>>2]|0;bz=c[U>>2]|0;bs=c[U+4>>2]|0;bt=bp(bw,bM,18,0)|0;bk=D;bn=bf(bz,bs,bw,bM)|0;bM=bf(bn,D,bt,bk)|0;c[U>>2]=bM;c[U+4>>2]=D;bM=c[V>>2]|0;bk=c[V+4>>2]|0;bt=c[W>>2]|0;bn=c[W+4>>2]|0;bw=bp(bM,bk,18,0)|0;bs=D;bz=bf(bt,bn,bM,bk)|0;bk=bf(bz,D,bw,bs)|0;c[W>>2]=bk;c[W+4>>2]=D;bk=c[X>>2]|0;bs=c[X+4>>2]|0;bw=c[Y>>2]|0;bz=c[Y+4>>2]|0;bM=bp(bk,bs,18,0)|0;bn=D;bt=bf(bw,bz,bk,bs)|0;bs=bf(bt,D,bM,bn)|0;c[Y>>2]=bs;c[Y+4>>2]=D;bs=c[Z>>2]|0;bn=c[Z+4>>2]|0;bM=c[_>>2]|0;bt=c[_+4>>2]|0;bk=bp(bs,bn,18,0)|0;bz=D;bw=bf(bM,bt,bs,bn)|0;bn=bf(bw,D,bk,bz)|0;c[_>>2]=bn;c[_+4>>2]=D;bn=c[aa>>2]|0;bz=c[aa+4>>2]|0;bk=c[ab>>2]|0;bw=c[ab+4>>2]|0;bs=bp(bn,bz,18,0)|0;bt=D;bM=bf(bk,bw,bn,bz)|0;bz=bf(bM,D,bs,bt)|0;c[ab>>2]=bz;c[ab+4>>2]=D;bz=c[ac>>2]|0;bt=c[ac+4>>2]|0;bs=c[ad>>2]|0;bM=c[ad+4>>2]|0;bn=bp(bz,bt,18,0)|0;bw=D;bk=bf(bs,bM,bz,bt)|0;bt=bf(bk,D,bn,bw)|0;c[ad>>2]=bt;c[ad+4>>2]=D;bt=c[ae>>2]|0;bw=c[ae+4>>2]|0;bn=c[af>>2]|0;bk=c[af+4>>2]|0;bz=bp(bt,bw,18,0)|0;bM=D;bs=bf(bn,bk,bt,bw)|0;bw=bf(bs,D,bz,bM)|0;c[af>>2]=bw;c[af+4>>2]=D;bw=c[ag>>2]|0;bM=c[ag+4>>2]|0;bz=c[S>>2]|0;bs=c[S+4>>2]|0;bt=bp(bw,bM,18,0)|0;bk=D;bn=bf(bz,bs,bw,bM)|0;bM=bf(bn,D,bt,bk)|0;c[S>>2]=bM;c[S+4>>2]=D;aN(S);bM=c[ah>>2]|0;bk=c[ah+4>>2]|0;bt=c[ai>>2]|0;bn=c[ai+4>>2]|0;bw=bp(bM,bk,18,0)|0;bs=D;bz=bf(bt,bn,bM,bk)|0;bk=bf(bz,D,bw,bs)|0;c[ai>>2]=bk;c[ai+4>>2]=D;bk=c[aj>>2]|0;bs=c[aj+4>>2]|0;bw=c[ak>>2]|0;bz=c[ak+4>>2]|0;bM=bp(bk,bs,18,0)|0;bn=D;bt=bf(bw,bz,bk,bs)|0;bs=bf(bt,D,bM,bn)|0;c[ak>>2]=bs;c[ak+4>>2]=D;bs=c[al>>2]|0;bn=c[al+4>>2]|0;bM=c[am>>2]|0;bt=c[am+4>>2]|0;bk=bp(bs,bn,18,0)|0;bz=D;bw=bf(bM,bt,bs,bn)|0;bn=bf(bw,D,bk,bz)|0;c[am>>2]=bn;c[am+4>>2]=D;bn=c[an>>2]|0;bz=c[an+4>>2]|0;bk=c[ao>>2]|0;bw=c[ao+4>>2]|0;bs=bp(bn,bz,18,0)|0;bt=D;bM=bf(bk,bw,bn,bz)|0;bz=bf(bM,D,bs,bt)|0;c[ao>>2]=bz;c[ao+4>>2]=D;bz=c[ap>>2]|0;bt=c[ap+4>>2]|0;bs=c[aq>>2]|0;bM=c[aq+4>>2]|0;bn=bp(bz,bt,18,0)|0;bw=D;bk=bf(bs,bM,bz,bt)|0;bt=bf(bk,D,bn,bw)|0;c[aq>>2]=bt;c[aq+4>>2]=D;bt=c[ar>>2]|0;bw=c[ar+4>>2]|0;bn=c[as>>2]|0;bk=c[as+4>>2]|0;bz=bp(bt,bw,18,0)|0;bM=D;bs=bf(bn,bk,bt,bw)|0;bw=bf(bs,D,bz,bM)|0;c[as>>2]=bw;c[as+4>>2]=D;bw=c[at>>2]|0;bM=c[at+4>>2]|0;bz=c[au>>2]|0;bs=c[au+4>>2]|0;bt=bp(bw,bM,18,0)|0;bk=D;bn=bf(bz,bs,bw,bM)|0;bM=bf(bn,D,bt,bk)|0;c[au>>2]=bM;c[au+4>>2]=D;bM=c[av>>2]|0;bk=c[av+4>>2]|0;bt=c[aw>>2]|0;bn=c[aw+4>>2]|0;bw=bp(bM,bk,18,0)|0;bs=D;bz=bf(bt,bn,bM,bk)|0;bk=bf(bz,D,bw,bs)|0;c[aw>>2]=bk;c[aw+4>>2]=D;bk=c[ax>>2]|0;bs=c[ax+4>>2]|0;bw=c[P>>2]|0;bz=c[P+4>>2]|0;bM=bp(bk,bs,18,0)|0;bn=D;bt=bf(bw,bz,bk,bs)|0;bs=bf(bt,D,bM,bn)|0;c[P>>2]=bs;c[P+4>>2]=D;aN(P);bs=c[S>>2]|0;bn=c[S+4>>2]|0;bM=c[af>>2]|0;bt=c[af+4>>2]|0;bk=c[ad>>2]|0;bz=c[ad+4>>2]|0;bw=c[ab>>2]|0;bC=c[ab+4>>2]|0;bP=c[_>>2]|0;bv=c[_+4>>2]|0;bF=c[Y>>2]|0;bo=c[Y+4>>2]|0;by=c[W>>2]|0;bI=c[W+4>>2]|0;bm=c[U>>2]|0;bB=c[U+4>>2]|0;bL=c[N>>2]|0;bu=c[N+4>>2]|0;bE=c[ay>>2]|0;bO=c[ay+4>>2]|0;bx=c[P>>2]|0;bH=c[P+4>>2]|0;bl=bf(bx,bH,bs,bn)|0;c[S>>2]=bl;c[S+4>>2]=D;bl=c[aw>>2]|0;bA=c[aw+4>>2]|0;bK=bf(bl,bA,bM,bt)|0;c[af>>2]=bK;c[af+4>>2]=D;bK=c[au>>2]|0;bq=c[au+4>>2]|0;bD=bf(bK,bq,bk,bz)|0;c[ad>>2]=bD;c[ad+4>>2]=D;bD=c[as>>2]|0;bN=c[as+4>>2]|0;bG=bf(bD,bN,bw,bC)|0;c[ab>>2]=bG;c[ab+4>>2]=D;bG=c[aq>>2]|0;bJ=c[aq+4>>2]|0;bQ=bf(bG,bJ,bP,bv)|0;c[_>>2]=bQ;c[_+4>>2]=D;bQ=c[ao>>2]|0;bR=c[ao+4>>2]|0;bS=bf(bQ,bR,bF,bo)|0;c[Y>>2]=bS;c[Y+4>>2]=D;bS=c[am>>2]|0;bT=c[am+4>>2]|0;bU=bf(bS,bT,by,bI)|0;c[W>>2]=bU;c[W+4>>2]=D;bU=c[ak>>2]|0;bV=c[ak+4>>2]|0;bW=bf(bU,bV,bm,bB)|0;c[U>>2]=bW;c[U+4>>2]=D;bW=c[ai>>2]|0;bX=c[ai+4>>2]|0;bY=bf(bW,bX,bL,bu)|0;c[N>>2]=bY;c[N+4>>2]=D;bY=c[u>>2]|0;bZ=c[u+4>>2]|0;b_=bf(bY,bZ,bE,bO)|0;c[ay>>2]=b_;c[ay+4>>2]=D;b_=bg(bs,bn,bx,bH)|0;c[P>>2]=b_;c[P+4>>2]=D;b_=bg(bM,bt,bl,bA)|0;c[aw>>2]=b_;c[aw+4>>2]=D;b_=bg(bk,bz,bK,bq)|0;c[au>>2]=b_;c[au+4>>2]=D;b_=bg(bw,bC,bD,bN)|0;c[as>>2]=b_;c[as+4>>2]=D;b_=bg(bP,bv,bG,bJ)|0;c[aq>>2]=b_;c[aq+4>>2]=D;b_=bg(bF,bo,bQ,bR)|0;c[ao>>2]=b_;c[ao+4>>2]=D;b_=bg(by,bI,bS,bT)|0;c[am>>2]=b_;c[am+4>>2]=D;b_=bg(bm,bB,bU,bV)|0;c[ak>>2]=b_;c[ak+4>>2]=D;b_=bg(bL,bu,bW,bX)|0;c[ai>>2]=b_;c[ai+4>>2]=D;b_=bg(bE,bO,bY,bZ)|0;c[u>>2]=b_;c[u+4>>2]=D;aQ(v,S);aQ(w,P);aM(P,w,e);b_=c[ah>>2]|0;bZ=c[ah+4>>2]|0;bY=c[ai>>2]|0;bO=c[ai+4>>2]|0;bE=bp(b_,bZ,18,0)|0;bX=D;bW=bf(bY,bO,b_,bZ)|0;bZ=bf(bW,D,bE,bX)|0;c[ai>>2]=bZ;c[ai+4>>2]=D;bZ=c[aj>>2]|0;bX=c[aj+4>>2]|0;bE=c[ak>>2]|0;bW=c[ak+4>>2]|0;b_=bp(bZ,bX,18,0)|0;bO=D;bY=bf(bE,bW,bZ,bX)|0;bX=bf(bY,D,b_,bO)|0;c[ak>>2]=bX;c[ak+4>>2]=D;bX=c[al>>2]|0;bO=c[al+4>>2]|0;b_=c[am>>2]|0;bY=c[am+4>>2]|0;bZ=bp(bX,bO,18,0)|0;bW=D;bE=bf(b_,bY,bX,bO)|0;bO=bf(bE,D,bZ,bW)|0;c[am>>2]=bO;c[am+4>>2]=D;bO=c[an>>2]|0;bW=c[an+4>>2]|0;bZ=c[ao>>2]|0;bE=c[ao+4>>2]|0;bX=bp(bO,bW,18,0)|0;bY=D;b_=bf(bZ,bE,bO,bW)|0;bW=bf(b_,D,bX,bY)|0;c[ao>>2]=bW;c[ao+4>>2]=D;bW=c[ap>>2]|0;bY=c[ap+4>>2]|0;bX=c[aq>>2]|0;b_=c[aq+4>>2]|0;bO=bp(bW,bY,18,0)|0;bE=D;bZ=bf(bX,b_,bW,bY)|0;bY=bf(bZ,D,bO,bE)|0;c[aq>>2]=bY;c[aq+4>>2]=D;bY=c[ar>>2]|0;bE=c[ar+4>>2]|0;bO=c[as>>2]|0;bZ=c[as+4>>2]|0;bW=bp(bY,bE,18,0)|0;b_=D;bX=bf(bO,bZ,bY,bE)|0;bE=bf(bX,D,bW,b_)|0;c[as>>2]=bE;c[as+4>>2]=D;bE=c[at>>2]|0;b_=c[at+4>>2]|0;bW=c[au>>2]|0;bX=c[au+4>>2]|0;bY=bp(bE,b_,18,0)|0;bZ=D;bO=bf(bW,bX,bE,b_)|0;b_=bf(bO,D,bY,bZ)|0;c[au>>2]=b_;c[au+4>>2]=D;b_=c[av>>2]|0;bZ=c[av+4>>2]|0;bY=c[aw>>2]|0;bO=c[aw+4>>2]|0;bE=bp(b_,bZ,18,0)|0;bX=D;bW=bf(bY,bO,b_,bZ)|0;bZ=bf(bW,D,bE,bX)|0;c[aw>>2]=bZ;c[aw+4>>2]=D;bZ=c[ax>>2]|0;bX=c[ax+4>>2]|0;bE=c[P>>2]|0;bW=c[P+4>>2]|0;b_=bp(bZ,bX,18,0)|0;bO=D;bY=bf(bE,bW,bZ,bX)|0;bX=bf(bY,D,b_,bO)|0;c[P>>2]=bX;c[P+4>>2]=D;aN(P);bb(a8|0,F|0,80);bb(a9|0,Q|0,80);aQ(az,x);aQ(aA,a6);aM(ba,az,aA);bX=ba+144|0;bO=c[bX>>2]|0;b_=c[bX+4>>2]|0;bX=ba+64|0;bY=c[bX>>2]|0;bZ=c[bX+4>>2]|0;bW=bp(bO,b_,18,0)|0;bE=D;bu=bf(bY,bZ,bO,b_)|0;b_=bf(bu,D,bW,bE)|0;c[bX>>2]=b_;c[bX+4>>2]=D;bX=ba+136|0;b_=c[bX>>2]|0;bE=c[bX+4>>2]|0;bX=ba+56|0;bW=c[bX>>2]|0;bu=c[bX+4>>2]|0;bO=bp(b_,bE,18,0)|0;bZ=D;bY=bf(bW,bu,b_,bE)|0;bE=bf(bY,D,bO,bZ)|0;c[bX>>2]=bE;c[bX+4>>2]=D;bX=ba+128|0;bE=c[bX>>2]|0;bZ=c[bX+4>>2]|0;bX=ba+48|0;bO=c[bX>>2]|0;bY=c[bX+4>>2]|0;b_=bp(bE,bZ,18,0)|0;bu=D;bW=bf(bO,bY,bE,bZ)|0;bZ=bf(bW,D,b_,bu)|0;c[bX>>2]=bZ;c[bX+4>>2]=D;bX=ba+120|0;bZ=c[bX>>2]|0;bu=c[bX+4>>2]|0;bX=ba+40|0;b_=c[bX>>2]|0;bW=c[bX+4>>2]|0;bE=bp(bZ,bu,18,0)|0;bY=D;bO=bf(b_,bW,bZ,bu)|0;bu=bf(bO,D,bE,bY)|0;c[bX>>2]=bu;c[bX+4>>2]=D;bX=ba+112|0;bu=c[bX>>2]|0;bY=c[bX+4>>2]|0;bX=ba+32|0;bE=c[bX>>2]|0;bO=c[bX+4>>2]|0;bZ=bp(bu,bY,18,0)|0;bW=D;b_=bf(bE,bO,bu,bY)|0;bY=bf(b_,D,bZ,bW)|0;c[bX>>2]=bY;c[bX+4>>2]=D;bX=ba+104|0;bY=c[bX>>2]|0;bW=c[bX+4>>2]|0;bX=ba+24|0;bZ=c[bX>>2]|0;b_=c[bX+4>>2]|0;bu=bp(bY,bW,18,0)|0;bO=D;bE=bf(bZ,b_,bY,bW)|0;bW=bf(bE,D,bu,bO)|0;c[bX>>2]=bW;c[bX+4>>2]=D;bX=ba+96|0;bW=c[bX>>2]|0;bO=c[bX+4>>2]|0;bX=ba+16|0;bu=c[bX>>2]|0;bE=c[bX+4>>2]|0;bY=bp(bW,bO,18,0)|0;b_=D;bZ=bf(bu,bE,bW,bO)|0;bO=bf(bZ,D,bY,b_)|0;c[bX>>2]=bO;c[bX+4>>2]=D;bX=ba+88|0;bO=c[bX>>2]|0;b_=c[bX+4>>2]|0;bX=ba+8|0;bY=c[bX>>2]|0;bZ=c[bX+4>>2]|0;bW=bp(bO,b_,18,0)|0;bE=D;bu=bf(bY,bZ,bO,b_)|0;b_=bf(bu,D,bW,bE)|0;c[bX>>2]=b_;c[bX+4>>2]=D;bX=ba+80|0;b_=c[bX>>2]|0;bE=c[bX+4>>2]|0;bX=c[ba>>2]|0;bW=c[ba+4>>2]|0;bu=bp(b_,bE,18,0)|0;bO=D;bZ=bf(bX,bW,b_,bE)|0;bE=bf(bZ,D,bu,bO)|0;c[ba>>2]=bE;c[ba+4>>2]=D;aN(ba);bE=c[az>>2]|0;bO=c[az+4>>2]|0;bu=bg(bE,bO,c[aA>>2]|0,c[aA+4>>2]|0)|0;bZ=D;c[aA>>2]=bu;c[aA+4>>2]=bZ;b_=c[aB>>2]|0;bW=c[aB+4>>2]|0;bX=bg(b_,bW,c[aC>>2]|0,c[aC+4>>2]|0)|0;bY=D;c[aC>>2]=bX;c[aC+4>>2]=bY;bL=c[aD>>2]|0;bV=c[aD+4>>2]|0;bU=bg(bL,bV,c[aE>>2]|0,c[aE+4>>2]|0)|0;bB=D;c[aE>>2]=bU;c[aE+4>>2]=bB;bm=c[aF>>2]|0;bT=c[aF+4>>2]|0;bS=bg(bm,bT,c[aG>>2]|0,c[aG+4>>2]|0)|0;bI=D;c[aG>>2]=bS;c[aG+4>>2]=bI;by=c[aH>>2]|0;bR=c[aH+4>>2]|0;bQ=bg(by,bR,c[aI>>2]|0,c[aI+4>>2]|0)|0;bo=D;c[aI>>2]=bQ;c[aI+4>>2]=bo;bF=c[aJ>>2]|0;bJ=c[aJ+4>>2]|0;bG=bg(bF,bJ,c[aK>>2]|0,c[aK+4>>2]|0)|0;bv=D;c[aK>>2]=bG;c[aK+4>>2]=bv;bP=c[aL>>2]|0;bN=c[aL+4>>2]|0;bD=bg(bP,bN,c[aO>>2]|0,c[aO+4>>2]|0)|0;bC=D;c[aO>>2]=bD;c[aO+4>>2]=bC;bw=c[aP>>2]|0;bq=c[aP+4>>2]|0;bK=bg(bw,bq,c[aR>>2]|0,c[aR+4>>2]|0)|0;bz=D;c[aR>>2]=bK;c[aR+4>>2]=bz;bk=c[aS>>2]|0;bA=c[aS+4>>2]|0;bl=bg(bk,bA,c[aT>>2]|0,c[aT+4>>2]|0)|0;bt=D;c[aT>>2]=bl;c[aT+4>>2]=bt;bM=c[aU>>2]|0;bH=c[aU+4>>2]|0;bx=bg(bM,bH,c[s>>2]|0,c[s+4>>2]|0)|0;bn=D;c[s>>2]=bx;c[s+4>>2]=bn;bd(aW|0,0,72);bs=bp(bu,bZ,121665,0)|0;c[t>>2]=bs;c[t+4>>2]=D;bs=bp(bX,bY,121665,0)|0;c[aX>>2]=bs;c[aX+4>>2]=D;bs=bp(bU,bB,121665,0)|0;c[aY>>2]=bs;c[aY+4>>2]=D;bs=bp(bS,bI,121665,0)|0;c[aZ>>2]=bs;c[aZ+4>>2]=D;bs=bp(bQ,bo,121665,0)|0;c[a_>>2]=bs;c[a_+4>>2]=D;bs=bp(bG,bv,121665,0)|0;c[a$>>2]=bs;c[a$+4>>2]=D;bs=bp(bD,bC,121665,0)|0;c[a0>>2]=bs;c[a0+4>>2]=D;bs=bp(bK,bz,121665,0)|0;c[a1>>2]=bs;c[a1+4>>2]=D;bs=bp(bl,bt,121665,0)|0;c[a2>>2]=bs;c[a2+4>>2]=D;bs=bp(bx,bn,121665,0)|0;c[a3>>2]=bs;c[a3+4>>2]=D;aN(t);bs=bf(c[t>>2]|0,c[t+4>>2]|0,bE,bO)|0;c[t>>2]=bs;c[t+4>>2]=D;bs=bf(c[aX>>2]|0,c[aX+4>>2]|0,b_,bW)|0;c[aX>>2]=bs;c[aX+4>>2]=D;bs=bf(c[aY>>2]|0,c[aY+4>>2]|0,bL,bV)|0;c[aY>>2]=bs;c[aY+4>>2]=D;bs=bf(c[aZ>>2]|0,c[aZ+4>>2]|0,bm,bT)|0;c[aZ>>2]=bs;c[aZ+4>>2]=D;bs=bf(c[a_>>2]|0,c[a_+4>>2]|0,by,bR)|0;c[a_>>2]=bs;c[a_+4>>2]=D;bs=bf(c[a$>>2]|0,c[a$+4>>2]|0,bF,bJ)|0;c[a$>>2]=bs;c[a$+4>>2]=D;bs=bf(c[a0>>2]|0,c[a0+4>>2]|0,bP,bN)|0;c[a0>>2]=bs;c[a0+4>>2]=D;bs=bf(c[a1>>2]|0,c[a1+4>>2]|0,bw,bq)|0;c[a1>>2]=bs;c[a1+4>>2]=D;bs=bf(c[a2>>2]|0,c[a2+4>>2]|0,bk,bA)|0;c[a2>>2]=bs;c[a2+4>>2]=D;bs=bf(c[a3>>2]|0,c[a3+4>>2]|0,bM,bH)|0;c[a3>>2]=bs;c[a3+4>>2]=D;aM(bc,aA,t);bs=bc+144|0;bH=c[bs>>2]|0;bM=c[bs+4>>2]|0;bs=bc+64|0;bA=c[bs>>2]|0;bk=c[bs+4>>2]|0;bq=bp(bH,bM,18,0)|0;bw=D;bN=bf(bA,bk,bH,bM)|0;bM=bf(bN,D,bq,bw)|0;c[bs>>2]=bM;c[bs+4>>2]=D;bs=bc+136|0;bM=c[bs>>2]|0;bw=c[bs+4>>2]|0;bs=bc+56|0;bq=c[bs>>2]|0;bN=c[bs+4>>2]|0;bH=bp(bM,bw,18,0)|0;bk=D;bA=bf(bq,bN,bM,bw)|0;bw=bf(bA,D,bH,bk)|0;c[bs>>2]=bw;c[bs+4>>2]=D;bs=bc+128|0;bw=c[bs>>2]|0;bk=c[bs+4>>2]|0;bs=bc+48|0;bH=c[bs>>2]|0;bA=c[bs+4>>2]|0;bM=bp(bw,bk,18,0)|0;bN=D;bq=bf(bH,bA,bw,bk)|0;bk=bf(bq,D,bM,bN)|0;c[bs>>2]=bk;c[bs+4>>2]=D;bs=bc+120|0;bk=c[bs>>2]|0;bN=c[bs+4>>2]|0;bs=bc+40|0;bM=c[bs>>2]|0;bq=c[bs+4>>2]|0;bw=bp(bk,bN,18,0)|0;bA=D;bH=bf(bM,bq,bk,bN)|0;bN=bf(bH,D,bw,bA)|0;c[bs>>2]=bN;c[bs+4>>2]=D;bs=bc+112|0;bN=c[bs>>2]|0;bA=c[bs+4>>2]|0;bs=bc+32|0;bw=c[bs>>2]|0;bH=c[bs+4>>2]|0;bk=bp(bN,bA,18,0)|0;bq=D;bM=bf(bw,bH,bN,bA)|0;bA=bf(bM,D,bk,bq)|0;c[bs>>2]=bA;c[bs+4>>2]=D;bs=bc+104|0;bA=c[bs>>2]|0;bq=c[bs+4>>2]|0;bs=bc+24|0;bk=c[bs>>2]|0;bM=c[bs+4>>2]|0;bN=bp(bA,bq,18,0)|0;bH=D;bw=bf(bk,bM,bA,bq)|0;bq=bf(bw,D,bN,bH)|0;c[bs>>2]=bq;c[bs+4>>2]=D;bs=bc+96|0;bq=c[bs>>2]|0;bH=c[bs+4>>2]|0;bs=bc+16|0;bN=c[bs>>2]|0;bw=c[bs+4>>2]|0;bA=bp(bq,bH,18,0)|0;bM=D;bk=bf(bN,bw,bq,bH)|0;bH=bf(bk,D,bA,bM)|0;c[bs>>2]=bH;c[bs+4>>2]=D;bs=bc+88|0;bH=c[bs>>2]|0;bM=c[bs+4>>2]|0;bs=bc+8|0;bA=c[bs>>2]|0;bk=c[bs+4>>2]|0;bq=bp(bH,bM,18,0)|0;bw=D;bN=bf(bA,bk,bH,bM)|0;bM=bf(bN,D,bq,bw)|0;c[bs>>2]=bM;c[bs+4>>2]=D;bs=bc+80|0;bM=c[bs>>2]|0;bw=c[bs+4>>2]|0;bs=c[bc>>2]|0;bq=c[bc+4>>2]|0;bN=bp(bM,bw,18,0)|0;bH=D;bk=bf(bs,bq,bM,bw)|0;bw=bf(bk,D,bN,bH)|0;c[bc>>2]=bw;c[bc+4>>2]=D;aN(bc);bw=0;while(1){bH=ba+(bw<<3)|0;bN=c[bH>>2]|0;bk=a8+(bw<<3)|0;bM=(c[bk>>2]^bN)&bj;bq=bM^bN;c[bH>>2]=bq;c[bH+4>>2]=(bq|0)<0?-1:0;bq=bM^c[bk>>2];c[bk>>2]=bq;c[bk+4>>2]=(bq|0)<0?-1:0;bq=bw+1|0;if(bq>>>0<10){bw=bq}else{b$=0;break}}do{bw=bc+(b$<<3)|0;bq=c[bw>>2]|0;bk=a9+(b$<<3)|0;bM=(c[bk>>2]^bq)&bj;bH=bM^bq;c[bw>>2]=bH;c[bw+4>>2]=(bH|0)<0?-1:0;bH=bM^c[bk>>2];c[bk>>2]=bH;c[bk+4>>2]=(bH|0)<0?-1:0;b$=b$+1|0;}while(b$>>>0<10);bj=be+1|0;if(bj>>>0<8){bH=a8;bk=a6;bM=x;bw=a7;a7=a9;x=ba;a6=bc;a8=bi;be=bj;bh=bh<<1;bi=bH;bc=bk;ba=bM;a9=bw}else{break}}bh=C+1|0;if(bh>>>0<32){a4=ba;y=bc;A=a9;T=bi;B=a7;z=x;E=a6;C=bh;a5=a8}else{break}}a5=K|0;bb(J|0,ba|0,80);ba=K;bb(ba|0,bc|0,80);bc=p;J=q;C=r;E=h|0;aQ(E,a5);h=r|0;aQ(h,E);r=q|0;aQ(r,h);q=j|0;aM(t,r,a5);z=G+144|0;B=c[z>>2]|0;T=c[z+4>>2]|0;A=c[a2>>2]|0;y=c[a2+4>>2]|0;a4=bp(B,T,18,0)|0;b$=D;aA=bf(A,y,B,T)|0;T=bf(aA,D,a4,b$)|0;c[a2>>2]=T;c[a2+4>>2]=D;T=G+136|0;b$=c[T>>2]|0;a4=c[T+4>>2]|0;aA=c[a1>>2]|0;B=c[a1+4>>2]|0;y=bp(b$,a4,18,0)|0;A=D;a3=bf(aA,B,b$,a4)|0;a4=bf(a3,D,y,A)|0;c[a1>>2]=a4;c[a1+4>>2]=D;a4=G+128|0;A=c[a4>>2]|0;y=c[a4+4>>2]|0;a3=c[a0>>2]|0;b$=c[a0+4>>2]|0;B=bp(A,y,18,0)|0;aA=D;aW=bf(a3,b$,A,y)|0;y=bf(aW,D,B,aA)|0;c[a0>>2]=y;c[a0+4>>2]=D;y=G+120|0;aA=c[y>>2]|0;B=c[y+4>>2]|0;aW=c[a$>>2]|0;A=c[a$+4>>2]|0;b$=bp(aA,B,18,0)|0;a3=D;s=bf(aW,A,aA,B)|0;B=bf(s,D,b$,a3)|0;c[a$>>2]=B;c[a$+4>>2]=D;B=G+112|0;a3=c[B>>2]|0;b$=c[B+4>>2]|0;s=c[a_>>2]|0;aA=c[a_+4>>2]|0;A=bp(a3,b$,18,0)|0;aW=D;aU=bf(s,aA,a3,b$)|0;b$=bf(aU,D,A,aW)|0;c[a_>>2]=b$;c[a_+4>>2]=D;b$=G+104|0;aW=c[b$>>2]|0;A=c[b$+4>>2]|0;aU=c[aZ>>2]|0;a3=c[aZ+4>>2]|0;aA=bp(aW,A,18,0)|0;s=D;aT=bf(aU,a3,aW,A)|0;A=bf(aT,D,aA,s)|0;c[aZ>>2]=A;c[aZ+4>>2]=D;A=G+96|0;s=c[A>>2]|0;aA=c[A+4>>2]|0;aT=c[aY>>2]|0;aW=c[aY+4>>2]|0;a3=bp(s,aA,18,0)|0;aU=D;aS=bf(aT,aW,s,aA)|0;aA=bf(aS,D,a3,aU)|0;c[aY>>2]=aA;c[aY+4>>2]=D;aA=G+88|0;G=c[aA>>2]|0;aU=c[aA+4>>2]|0;a3=c[aX>>2]|0;aS=c[aX+4>>2]|0;s=bp(G,aU,18,0)|0;aW=D;aT=bf(a3,aS,G,aU)|0;aU=bf(aT,D,s,aW)|0;c[aX>>2]=aU;c[aX+4>>2]=D;aU=c[aV>>2]|0;aW=c[aV+4>>2]|0;s=c[t>>2]|0;aT=c[t+4>>2]|0;G=bp(aU,aW,18,0)|0;aS=D;a3=bf(s,aT,aU,aW)|0;aW=bf(a3,D,G,aS)|0;c[t>>2]=aW;c[t+4>>2]=D;aN(t);bb(j|0,I|0,80);j=k|0;aM(t,q,E);E=c[z>>2]|0;aW=c[z+4>>2]|0;aS=c[a2>>2]|0;G=c[a2+4>>2]|0;a3=bp(E,aW,18,0)|0;aU=D;aT=bf(aS,G,E,aW)|0;aW=bf(aT,D,a3,aU)|0;c[a2>>2]=aW;c[a2+4>>2]=D;aW=c[T>>2]|0;aU=c[T+4>>2]|0;a3=c[a1>>2]|0;aT=c[a1+4>>2]|0;E=bp(aW,aU,18,0)|0;G=D;aS=bf(a3,aT,aW,aU)|0;aU=bf(aS,D,E,G)|0;c[a1>>2]=aU;c[a1+4>>2]=D;aU=c[a4>>2]|0;G=c[a4+4>>2]|0;E=c[a0>>2]|0;aS=c[a0+4>>2]|0;aW=bp(aU,G,18,0)|0;aT=D;a3=bf(E,aS,aU,G)|0;G=bf(a3,D,aW,aT)|0;c[a0>>2]=G;c[a0+4>>2]=D;G=c[y>>2]|0;aT=c[y+4>>2]|0;aW=c[a$>>2]|0;a3=c[a$+4>>2]|0;aU=bp(G,aT,18,0)|0;aS=D;E=bf(aW,a3,G,aT)|0;aT=bf(E,D,aU,aS)|0;c[a$>>2]=aT;c[a$+4>>2]=D;aT=c[B>>2]|0;aS=c[B+4>>2]|0;aU=c[a_>>2]|0;E=c[a_+4>>2]|0;G=bp(aT,aS,18,0)|0;a3=D;aW=bf(aU,E,aT,aS)|0;aS=bf(aW,D,G,a3)|0;c[a_>>2]=aS;c[a_+4>>2]=D;aS=c[b$>>2]|0;a3=c[b$+4>>2]|0;G=c[aZ>>2]|0;aW=c[aZ+4>>2]|0;aT=bp(aS,a3,18,0)|0;E=D;aU=bf(G,aW,aS,a3)|0;a3=bf(aU,D,aT,E)|0;c[aZ>>2]=a3;c[aZ+4>>2]=D;a3=c[A>>2]|0;E=c[A+4>>2]|0;aT=c[aY>>2]|0;aU=c[aY+4>>2]|0;aS=bp(a3,E,18,0)|0;aW=D;G=bf(aT,aU,a3,E)|0;E=bf(G,D,aS,aW)|0;c[aY>>2]=E;c[aY+4>>2]=D;E=c[aA>>2]|0;aW=c[aA+4>>2]|0;aS=c[aX>>2]|0;G=c[aX+4>>2]|0;a3=bp(E,aW,18,0)|0;aU=D;aT=bf(aS,G,E,aW)|0;aW=bf(aT,D,a3,aU)|0;c[aX>>2]=aW;c[aX+4>>2]=D;aW=c[aV>>2]|0;aU=c[aV+4>>2]|0;a3=c[t>>2]|0;aT=c[t+4>>2]|0;E=bp(aW,aU,18,0)|0;G=D;aS=bf(a3,aT,aW,aU)|0;aU=bf(aS,D,E,G)|0;c[t>>2]=aU;c[t+4>>2]=D;aN(t);bb(k|0,I|0,80);aQ(r,j);k=l|0;aM(t,r,q);q=c[z>>2]|0;aU=c[z+4>>2]|0;G=c[a2>>2]|0;E=c[a2+4>>2]|0;aS=bp(q,aU,18,0)|0;aW=D;aT=bf(G,E,q,aU)|0;aU=bf(aT,D,aS,aW)|0;c[a2>>2]=aU;c[a2+4>>2]=D;aU=c[T>>2]|0;aW=c[T+4>>2]|0;aS=c[a1>>2]|0;aT=c[a1+4>>2]|0;q=bp(aU,aW,18,0)|0;E=D;G=bf(aS,aT,aU,aW)|0;aW=bf(G,D,q,E)|0;c[a1>>2]=aW;c[a1+4>>2]=D;aW=c[a4>>2]|0;E=c[a4+4>>2]|0;q=c[a0>>2]|0;G=c[a0+4>>2]|0;aU=bp(aW,E,18,0)|0;aT=D;aS=bf(q,G,aW,E)|0;E=bf(aS,D,aU,aT)|0;c[a0>>2]=E;c[a0+4>>2]=D;E=c[y>>2]|0;aT=c[y+4>>2]|0;aU=c[a$>>2]|0;aS=c[a$+4>>2]|0;aW=bp(E,aT,18,0)|0;G=D;q=bf(aU,aS,E,aT)|0;aT=bf(q,D,aW,G)|0;c[a$>>2]=aT;c[a$+4>>2]=D;aT=c[B>>2]|0;G=c[B+4>>2]|0;aW=c[a_>>2]|0;q=c[a_+4>>2]|0;E=bp(aT,G,18,0)|0;aS=D;aU=bf(aW,q,aT,G)|0;G=bf(aU,D,E,aS)|0;c[a_>>2]=G;c[a_+4>>2]=D;G=c[b$>>2]|0;aS=c[b$+4>>2]|0;E=c[aZ>>2]|0;aU=c[aZ+4>>2]|0;aT=bp(G,aS,18,0)|0;q=D;aW=bf(E,aU,G,aS)|0;aS=bf(aW,D,aT,q)|0;c[aZ>>2]=aS;c[aZ+4>>2]=D;aS=c[A>>2]|0;q=c[A+4>>2]|0;aT=c[aY>>2]|0;aW=c[aY+4>>2]|0;G=bp(aS,q,18,0)|0;aU=D;E=bf(aT,aW,aS,q)|0;q=bf(E,D,G,aU)|0;c[aY>>2]=q;c[aY+4>>2]=D;q=c[aA>>2]|0;aU=c[aA+4>>2]|0;G=c[aX>>2]|0;E=c[aX+4>>2]|0;aS=bp(q,aU,18,0)|0;aW=D;aT=bf(G,E,q,aU)|0;aU=bf(aT,D,aS,aW)|0;c[aX>>2]=aU;c[aX+4>>2]=D;aU=c[aV>>2]|0;aW=c[aV+4>>2]|0;aS=c[t>>2]|0;aT=c[t+4>>2]|0;q=bp(aU,aW,18,0)|0;E=D;G=bf(aS,aT,aU,aW)|0;aW=bf(G,D,q,E)|0;c[t>>2]=aW;c[t+4>>2]=D;aN(t);bb(l|0,I|0,80);aQ(r,k);aQ(h,r);aQ(r,h);aQ(h,r);aQ(r,h);l=m|0;aM(t,r,k);k=c[z>>2]|0;aW=c[z+4>>2]|0;E=c[a2>>2]|0;q=c[a2+4>>2]|0;G=bp(k,aW,18,0)|0;aU=D;aT=bf(E,q,k,aW)|0;aW=bf(aT,D,G,aU)|0;c[a2>>2]=aW;c[a2+4>>2]=D;aW=c[T>>2]|0;aU=c[T+4>>2]|0;G=c[a1>>2]|0;aT=c[a1+4>>2]|0;k=bp(aW,aU,18,0)|0;q=D;E=bf(G,aT,aW,aU)|0;aU=bf(E,D,k,q)|0;c[a1>>2]=aU;c[a1+4>>2]=D;aU=c[a4>>2]|0;q=c[a4+4>>2]|0;k=c[a0>>2]|0;E=c[a0+4>>2]|0;aW=bp(aU,q,18,0)|0;aT=D;G=bf(k,E,aU,q)|0;q=bf(G,D,aW,aT)|0;c[a0>>2]=q;c[a0+4>>2]=D;q=c[y>>2]|0;aT=c[y+4>>2]|0;aW=c[a$>>2]|0;G=c[a$+4>>2]|0;aU=bp(q,aT,18,0)|0;E=D;k=bf(aW,G,q,aT)|0;aT=bf(k,D,aU,E)|0;c[a$>>2]=aT;c[a$+4>>2]=D;aT=c[B>>2]|0;E=c[B+4>>2]|0;aU=c[a_>>2]|0;k=c[a_+4>>2]|0;q=bp(aT,E,18,0)|0;G=D;aW=bf(aU,k,aT,E)|0;E=bf(aW,D,q,G)|0;c[a_>>2]=E;c[a_+4>>2]=D;E=c[b$>>2]|0;G=c[b$+4>>2]|0;q=c[aZ>>2]|0;aW=c[aZ+4>>2]|0;aT=bp(E,G,18,0)|0;k=D;aU=bf(q,aW,E,G)|0;G=bf(aU,D,aT,k)|0;c[aZ>>2]=G;c[aZ+4>>2]=D;G=c[A>>2]|0;k=c[A+4>>2]|0;aT=c[aY>>2]|0;aU=c[aY+4>>2]|0;E=bp(G,k,18,0)|0;aW=D;q=bf(aT,aU,G,k)|0;k=bf(q,D,E,aW)|0;c[aY>>2]=k;c[aY+4>>2]=D;k=c[aA>>2]|0;aW=c[aA+4>>2]|0;E=c[aX>>2]|0;q=c[aX+4>>2]|0;G=bp(k,aW,18,0)|0;aU=D;aT=bf(E,q,k,aW)|0;aW=bf(aT,D,G,aU)|0;c[aX>>2]=aW;c[aX+4>>2]=D;aW=c[aV>>2]|0;aU=c[aV+4>>2]|0;G=c[t>>2]|0;aT=c[t+4>>2]|0;k=bp(aW,aU,18,0)|0;q=D;E=bf(G,aT,aW,aU)|0;aU=bf(E,D,k,q)|0;c[t>>2]=aU;c[t+4>>2]=D;aN(t);bb(m|0,I|0,80);aQ(r,l);aQ(h,r);aQ(r,h);aQ(h,r);aQ(r,h);aQ(h,r);aQ(r,h);aQ(h,r);aQ(r,h);aQ(h,r);m=n|0;aM(t,h,l);aU=c[z>>2]|0;q=c[z+4>>2]|0;k=c[a2>>2]|0;E=c[a2+4>>2]|0;aW=bp(aU,q,18,0)|0;aT=D;G=bf(k,E,aU,q)|0;q=bf(G,D,aW,aT)|0;c[a2>>2]=q;c[a2+4>>2]=D;q=c[T>>2]|0;aT=c[T+4>>2]|0;aW=c[a1>>2]|0;G=c[a1+4>>2]|0;aU=bp(q,aT,18,0)|0;E=D;k=bf(aW,G,q,aT)|0;aT=bf(k,D,aU,E)|0;c[a1>>2]=aT;c[a1+4>>2]=D;aT=c[a4>>2]|0;E=c[a4+4>>2]|0;aU=c[a0>>2]|0;k=c[a0+4>>2]|0;q=bp(aT,E,18,0)|0;G=D;aW=bf(aU,k,aT,E)|0;E=bf(aW,D,q,G)|0;c[a0>>2]=E;c[a0+4>>2]=D;E=c[y>>2]|0;G=c[y+4>>2]|0;q=c[a$>>2]|0;aW=c[a$+4>>2]|0;aT=bp(E,G,18,0)|0;k=D;aU=bf(q,aW,E,G)|0;G=bf(aU,D,aT,k)|0;c[a$>>2]=G;c[a$+4>>2]=D;G=c[B>>2]|0;k=c[B+4>>2]|0;aT=c[a_>>2]|0;aU=c[a_+4>>2]|0;E=bp(G,k,18,0)|0;aW=D;q=bf(aT,aU,G,k)|0;k=bf(q,D,E,aW)|0;c[a_>>2]=k;c[a_+4>>2]=D;k=c[b$>>2]|0;aW=c[b$+4>>2]|0;E=c[aZ>>2]|0;q=c[aZ+4>>2]|0;G=bp(k,aW,18,0)|0;aU=D;aT=bf(E,q,k,aW)|0;aW=bf(aT,D,G,aU)|0;c[aZ>>2]=aW;c[aZ+4>>2]=D;aW=c[A>>2]|0;aU=c[A+4>>2]|0;G=c[aY>>2]|0;aT=c[aY+4>>2]|0;k=bp(aW,aU,18,0)|0;q=D;E=bf(G,aT,aW,aU)|0;aU=bf(E,D,k,q)|0;c[aY>>2]=aU;c[aY+4>>2]=D;aU=c[aA>>2]|0;q=c[aA+4>>2]|0;k=c[aX>>2]|0;E=c[aX+4>>2]|0;aW=bp(aU,q,18,0)|0;aT=D;G=bf(k,E,aU,q)|0;q=bf(G,D,aW,aT)|0;c[aX>>2]=q;c[aX+4>>2]=D;q=c[aV>>2]|0;aT=c[aV+4>>2]|0;aW=c[t>>2]|0;G=c[t+4>>2]|0;aU=bp(q,aT,18,0)|0;E=D;k=bf(aW,G,q,aT)|0;aT=bf(k,D,aU,E)|0;c[t>>2]=aT;c[t+4>>2]=D;aN(t);bb(n|0,I|0,80);aQ(r,m);aQ(h,r);aQ(r,h);aQ(h,r);aQ(r,h);aQ(h,r);aQ(r,h);aQ(h,r);aQ(r,h);aQ(h,r);aQ(r,h);aQ(h,r);aQ(r,h);aQ(h,r);aQ(r,h);aQ(h,r);aQ(r,h);aQ(h,r);aQ(r,h);aQ(h,r);aM(t,h,m);m=c[z>>2]|0;n=c[z+4>>2]|0;aT=c[a2>>2]|0;E=c[a2+4>>2]|0;aU=bp(m,n,18,0)|0;k=D;q=bf(aT,E,m,n)|0;n=bf(q,D,aU,k)|0;c[a2>>2]=n;c[a2+4>>2]=D;n=c[T>>2]|0;k=c[T+4>>2]|0;aU=c[a1>>2]|0;q=c[a1+4>>2]|0;m=bp(n,k,18,0)|0;E=D;aT=bf(aU,q,n,k)|0;k=bf(aT,D,m,E)|0;c[a1>>2]=k;c[a1+4>>2]=D;k=c[a4>>2]|0;E=c[a4+4>>2]|0;m=c[a0>>2]|0;aT=c[a0+4>>2]|0;n=bp(k,E,18,0)|0;q=D;aU=bf(m,aT,k,E)|0;E=bf(aU,D,n,q)|0;c[a0>>2]=E;c[a0+4>>2]=D;E=c[y>>2]|0;q=c[y+4>>2]|0;n=c[a$>>2]|0;aU=c[a$+4>>2]|0;k=bp(E,q,18,0)|0;aT=D;m=bf(n,aU,E,q)|0;q=bf(m,D,k,aT)|0;c[a$>>2]=q;c[a$+4>>2]=D;q=c[B>>2]|0;aT=c[B+4>>2]|0;k=c[a_>>2]|0;m=c[a_+4>>2]|0;E=bp(q,aT,18,0)|0;aU=D;n=bf(k,m,q,aT)|0;aT=bf(n,D,E,aU)|0;c[a_>>2]=aT;c[a_+4>>2]=D;aT=c[b$>>2]|0;aU=c[b$+4>>2]|0;E=c[aZ>>2]|0;n=c[aZ+4>>2]|0;q=bp(aT,aU,18,0)|0;m=D;k=bf(E,n,aT,aU)|0;aU=bf(k,D,q,m)|0;c[aZ>>2]=aU;c[aZ+4>>2]=D;aU=c[A>>2]|0;m=c[A+4>>2]|0;q=c[aY>>2]|0;k=c[aY+4>>2]|0;aT=bp(aU,m,18,0)|0;n=D;E=bf(q,k,aU,m)|0;m=bf(E,D,aT,n)|0;c[aY>>2]=m;c[aY+4>>2]=D;m=c[aA>>2]|0;n=c[aA+4>>2]|0;aT=c[aX>>2]|0;E=c[aX+4>>2]|0;aU=bp(m,n,18,0)|0;k=D;q=bf(aT,E,m,n)|0;n=bf(q,D,aU,k)|0;c[aX>>2]=n;c[aX+4>>2]=D;n=c[aV>>2]|0;k=c[aV+4>>2]|0;aU=c[t>>2]|0;q=c[t+4>>2]|0;m=bp(n,k,18,0)|0;E=D;aT=bf(aU,q,n,k)|0;k=bf(aT,D,m,E)|0;c[t>>2]=k;c[t+4>>2]=D;aN(t);bb(J|0,I|0,80);aQ(h,r);aQ(r,h);aQ(h,r);aQ(r,h);aQ(h,r);aQ(r,h);aQ(h,r);aQ(r,h);aQ(h,r);aQ(r,h);k=o|0;aM(t,r,l);l=c[z>>2]|0;E=c[z+4>>2]|0;m=c[a2>>2]|0;aT=c[a2+4>>2]|0;n=bp(l,E,18,0)|0;q=D;aU=bf(m,aT,l,E)|0;E=bf(aU,D,n,q)|0;c[a2>>2]=E;c[a2+4>>2]=D;E=c[T>>2]|0;q=c[T+4>>2]|0;n=c[a1>>2]|0;aU=c[a1+4>>2]|0;l=bp(E,q,18,0)|0;aT=D;m=bf(n,aU,E,q)|0;q=bf(m,D,l,aT)|0;c[a1>>2]=q;c[a1+4>>2]=D;q=c[a4>>2]|0;aT=c[a4+4>>2]|0;l=c[a0>>2]|0;m=c[a0+4>>2]|0;E=bp(q,aT,18,0)|0;aU=D;n=bf(l,m,q,aT)|0;aT=bf(n,D,E,aU)|0;c[a0>>2]=aT;c[a0+4>>2]=D;aT=c[y>>2]|0;aU=c[y+4>>2]|0;E=c[a$>>2]|0;n=c[a$+4>>2]|0;q=bp(aT,aU,18,0)|0;m=D;l=bf(E,n,aT,aU)|0;aU=bf(l,D,q,m)|0;c[a$>>2]=aU;c[a$+4>>2]=D;aU=c[B>>2]|0;m=c[B+4>>2]|0;q=c[a_>>2]|0;l=c[a_+4>>2]|0;aT=bp(aU,m,18,0)|0;n=D;E=bf(q,l,aU,m)|0;m=bf(E,D,aT,n)|0;c[a_>>2]=m;c[a_+4>>2]=D;m=c[b$>>2]|0;n=c[b$+4>>2]|0;aT=c[aZ>>2]|0;E=c[aZ+4>>2]|0;aU=bp(m,n,18,0)|0;l=D;q=bf(aT,E,m,n)|0;n=bf(q,D,aU,l)|0;c[aZ>>2]=n;c[aZ+4>>2]=D;n=c[A>>2]|0;l=c[A+4>>2]|0;aU=c[aY>>2]|0;q=c[aY+4>>2]|0;m=bp(n,l,18,0)|0;E=D;aT=bf(aU,q,n,l)|0;l=bf(aT,D,m,E)|0;c[aY>>2]=l;c[aY+4>>2]=D;l=c[aA>>2]|0;E=c[aA+4>>2]|0;m=c[aX>>2]|0;aT=c[aX+4>>2]|0;n=bp(l,E,18,0)|0;q=D;aU=bf(m,aT,l,E)|0;E=bf(aU,D,n,q)|0;c[aX>>2]=E;c[aX+4>>2]=D;E=c[aV>>2]|0;q=c[aV+4>>2]|0;n=c[t>>2]|0;aU=c[t+4>>2]|0;l=bp(E,q,18,0)|0;aT=D;m=bf(n,aU,E,q)|0;q=bf(m,D,l,aT)|0;c[t>>2]=q;c[t+4>>2]=D;aN(t);bb(o|0,I|0,80);aQ(r,k);aQ(h,r);o=2;do{aQ(r,h);aQ(h,r);o=o+2|0;}while((o|0)<50);o=L|0;q=p|0;aM(t,h,k);p=c[z>>2]|0;aT=c[z+4>>2]|0;l=c[a2>>2]|0;m=c[a2+4>>2]|0;E=bp(p,aT,18,0)|0;aU=D;n=bf(l,m,p,aT)|0;aT=bf(n,D,E,aU)|0;c[a2>>2]=aT;c[a2+4>>2]=D;aT=c[T>>2]|0;aU=c[T+4>>2]|0;E=c[a1>>2]|0;n=c[a1+4>>2]|0;p=bp(aT,aU,18,0)|0;m=D;l=bf(E,n,aT,aU)|0;aU=bf(l,D,p,m)|0;c[a1>>2]=aU;c[a1+4>>2]=D;aU=c[a4>>2]|0;m=c[a4+4>>2]|0;p=c[a0>>2]|0;l=c[a0+4>>2]|0;aT=bp(aU,m,18,0)|0;n=D;E=bf(p,l,aU,m)|0;m=bf(E,D,aT,n)|0;c[a0>>2]=m;c[a0+4>>2]=D;m=c[y>>2]|0;n=c[y+4>>2]|0;aT=c[a$>>2]|0;E=c[a$+4>>2]|0;aU=bp(m,n,18,0)|0;l=D;p=bf(aT,E,m,n)|0;n=bf(p,D,aU,l)|0;c[a$>>2]=n;c[a$+4>>2]=D;n=c[B>>2]|0;l=c[B+4>>2]|0;aU=c[a_>>2]|0;p=c[a_+4>>2]|0;m=bp(n,l,18,0)|0;E=D;aT=bf(aU,p,n,l)|0;l=bf(aT,D,m,E)|0;c[a_>>2]=l;c[a_+4>>2]=D;l=c[b$>>2]|0;E=c[b$+4>>2]|0;m=c[aZ>>2]|0;aT=c[aZ+4>>2]|0;n=bp(l,E,18,0)|0;p=D;aU=bf(m,aT,l,E)|0;E=bf(aU,D,n,p)|0;c[aZ>>2]=E;c[aZ+4>>2]=D;E=c[A>>2]|0;p=c[A+4>>2]|0;n=c[aY>>2]|0;aU=c[aY+4>>2]|0;l=bp(E,p,18,0)|0;aT=D;m=bf(n,aU,E,p)|0;p=bf(m,D,l,aT)|0;c[aY>>2]=p;c[aY+4>>2]=D;p=c[aA>>2]|0;aT=c[aA+4>>2]|0;l=c[aX>>2]|0;m=c[aX+4>>2]|0;E=bp(p,aT,18,0)|0;aU=D;n=bf(l,m,p,aT)|0;aT=bf(n,D,E,aU)|0;c[aX>>2]=aT;c[aX+4>>2]=D;aT=c[aV>>2]|0;aU=c[aV+4>>2]|0;E=c[t>>2]|0;n=c[t+4>>2]|0;p=bp(aT,aU,18,0)|0;m=D;l=bf(E,n,aT,aU)|0;aU=bf(l,D,p,m)|0;c[t>>2]=aU;c[t+4>>2]=D;aN(t);bb(bc|0,I|0,80);aQ(h,q);aQ(r,h);bc=2;do{aQ(h,r);aQ(r,h);bc=bc+2|0;}while((bc|0)<100);aM(t,r,q);q=c[z>>2]|0;bc=c[z+4>>2]|0;aU=c[a2>>2]|0;m=c[a2+4>>2]|0;p=bp(q,bc,18,0)|0;l=D;aT=bf(aU,m,q,bc)|0;bc=bf(aT,D,p,l)|0;c[a2>>2]=bc;c[a2+4>>2]=D;bc=c[T>>2]|0;l=c[T+4>>2]|0;p=c[a1>>2]|0;aT=c[a1+4>>2]|0;q=bp(bc,l,18,0)|0;m=D;aU=bf(p,aT,bc,l)|0;l=bf(aU,D,q,m)|0;c[a1>>2]=l;c[a1+4>>2]=D;l=c[a4>>2]|0;m=c[a4+4>>2]|0;q=c[a0>>2]|0;aU=c[a0+4>>2]|0;bc=bp(l,m,18,0)|0;aT=D;p=bf(q,aU,l,m)|0;m=bf(p,D,bc,aT)|0;c[a0>>2]=m;c[a0+4>>2]=D;m=c[y>>2]|0;aT=c[y+4>>2]|0;bc=c[a$>>2]|0;p=c[a$+4>>2]|0;l=bp(m,aT,18,0)|0;aU=D;q=bf(bc,p,m,aT)|0;aT=bf(q,D,l,aU)|0;c[a$>>2]=aT;c[a$+4>>2]=D;aT=c[B>>2]|0;aU=c[B+4>>2]|0;l=c[a_>>2]|0;q=c[a_+4>>2]|0;m=bp(aT,aU,18,0)|0;p=D;bc=bf(l,q,aT,aU)|0;aU=bf(bc,D,m,p)|0;c[a_>>2]=aU;c[a_+4>>2]=D;aU=c[b$>>2]|0;p=c[b$+4>>2]|0;m=c[aZ>>2]|0;bc=c[aZ+4>>2]|0;aT=bp(aU,p,18,0)|0;q=D;l=bf(m,bc,aU,p)|0;p=bf(l,D,aT,q)|0;c[aZ>>2]=p;c[aZ+4>>2]=D;p=c[A>>2]|0;q=c[A+4>>2]|0;aT=c[aY>>2]|0;l=c[aY+4>>2]|0;aU=bp(p,q,18,0)|0;bc=D;m=bf(aT,l,p,q)|0;q=bf(m,D,aU,bc)|0;c[aY>>2]=q;c[aY+4>>2]=D;q=c[aA>>2]|0;bc=c[aA+4>>2]|0;aU=c[aX>>2]|0;m=c[aX+4>>2]|0;p=bp(q,bc,18,0)|0;l=D;aT=bf(aU,m,q,bc)|0;bc=bf(aT,D,p,l)|0;c[aX>>2]=bc;c[aX+4>>2]=D;bc=c[aV>>2]|0;l=c[aV+4>>2]|0;p=c[t>>2]|0;aT=c[t+4>>2]|0;q=bp(bc,l,18,0)|0;m=D;aU=bf(p,aT,bc,l)|0;l=bf(aU,D,q,m)|0;c[t>>2]=l;c[t+4>>2]=D;aN(t);bb(C|0,I|0,80);aQ(r,h);aQ(h,r);C=2;do{aQ(r,h);aQ(h,r);C=C+2|0;}while((C|0)<50);aM(t,h,k);k=c[z>>2]|0;C=c[z+4>>2]|0;l=c[a2>>2]|0;m=c[a2+4>>2]|0;q=bp(k,C,18,0)|0;aU=D;bc=bf(l,m,k,C)|0;C=bf(bc,D,q,aU)|0;c[a2>>2]=C;c[a2+4>>2]=D;C=c[T>>2]|0;aU=c[T+4>>2]|0;q=c[a1>>2]|0;bc=c[a1+4>>2]|0;k=bp(C,aU,18,0)|0;m=D;l=bf(q,bc,C,aU)|0;aU=bf(l,D,k,m)|0;c[a1>>2]=aU;c[a1+4>>2]=D;aU=c[a4>>2]|0;m=c[a4+4>>2]|0;k=c[a0>>2]|0;l=c[a0+4>>2]|0;C=bp(aU,m,18,0)|0;bc=D;q=bf(k,l,aU,m)|0;m=bf(q,D,C,bc)|0;c[a0>>2]=m;c[a0+4>>2]=D;m=c[y>>2]|0;bc=c[y+4>>2]|0;C=c[a$>>2]|0;q=c[a$+4>>2]|0;aU=bp(m,bc,18,0)|0;l=D;k=bf(C,q,m,bc)|0;bc=bf(k,D,aU,l)|0;c[a$>>2]=bc;c[a$+4>>2]=D;bc=c[B>>2]|0;l=c[B+4>>2]|0;aU=c[a_>>2]|0;k=c[a_+4>>2]|0;m=bp(bc,l,18,0)|0;q=D;C=bf(aU,k,bc,l)|0;l=bf(C,D,m,q)|0;c[a_>>2]=l;c[a_+4>>2]=D;l=c[b$>>2]|0;q=c[b$+4>>2]|0;m=c[aZ>>2]|0;C=c[aZ+4>>2]|0;bc=bp(l,q,18,0)|0;k=D;aU=bf(m,C,l,q)|0;q=bf(aU,D,bc,k)|0;c[aZ>>2]=q;c[aZ+4>>2]=D;q=c[A>>2]|0;k=c[A+4>>2]|0;bc=c[aY>>2]|0;aU=c[aY+4>>2]|0;l=bp(q,k,18,0)|0;C=D;m=bf(bc,aU,q,k)|0;k=bf(m,D,l,C)|0;c[aY>>2]=k;c[aY+4>>2]=D;k=c[aA>>2]|0;C=c[aA+4>>2]|0;l=c[aX>>2]|0;m=c[aX+4>>2]|0;q=bp(k,C,18,0)|0;aU=D;bc=bf(l,m,k,C)|0;C=bf(bc,D,q,aU)|0;c[aX>>2]=C;c[aX+4>>2]=D;C=c[aV>>2]|0;aU=c[aV+4>>2]|0;q=c[t>>2]|0;bc=c[t+4>>2]|0;k=bp(C,aU,18,0)|0;m=D;l=bf(q,bc,C,aU)|0;aU=bf(l,D,k,m)|0;c[t>>2]=aU;c[t+4>>2]=D;aN(t);bb(J|0,I|0,80);aQ(h,r);aQ(r,h);aQ(h,r);aQ(r,h);aQ(h,r);aM(t,h,j);j=c[z>>2]|0;h=c[z+4>>2]|0;r=c[a2>>2]|0;J=c[a2+4>>2]|0;aU=bp(j,h,18,0)|0;m=D;k=bf(r,J,j,h)|0;h=bf(k,D,aU,m)|0;c[a2>>2]=h;c[a2+4>>2]=D;h=c[T>>2]|0;m=c[T+4>>2]|0;aU=c[a1>>2]|0;k=c[a1+4>>2]|0;j=bp(h,m,18,0)|0;J=D;r=bf(aU,k,h,m)|0;m=bf(r,D,j,J)|0;c[a1>>2]=m;c[a1+4>>2]=D;m=c[a4>>2]|0;J=c[a4+4>>2]|0;j=c[a0>>2]|0;r=c[a0+4>>2]|0;h=bp(m,J,18,0)|0;k=D;aU=bf(j,r,m,J)|0;J=bf(aU,D,h,k)|0;c[a0>>2]=J;c[a0+4>>2]=D;J=c[y>>2]|0;k=c[y+4>>2]|0;h=c[a$>>2]|0;aU=c[a$+4>>2]|0;m=bp(J,k,18,0)|0;r=D;j=bf(h,aU,J,k)|0;k=bf(j,D,m,r)|0;c[a$>>2]=k;c[a$+4>>2]=D;k=c[B>>2]|0;r=c[B+4>>2]|0;m=c[a_>>2]|0;j=c[a_+4>>2]|0;J=bp(k,r,18,0)|0;aU=D;h=bf(m,j,k,r)|0;r=bf(h,D,J,aU)|0;c[a_>>2]=r;c[a_+4>>2]=D;r=c[b$>>2]|0;aU=c[b$+4>>2]|0;J=c[aZ>>2]|0;h=c[aZ+4>>2]|0;k=bp(r,aU,18,0)|0;j=D;m=bf(J,h,r,aU)|0;aU=bf(m,D,k,j)|0;c[aZ>>2]=aU;c[aZ+4>>2]=D;aU=c[A>>2]|0;j=c[A+4>>2]|0;k=c[aY>>2]|0;m=c[aY+4>>2]|0;r=bp(aU,j,18,0)|0;h=D;J=bf(k,m,aU,j)|0;j=bf(J,D,r,h)|0;c[aY>>2]=j;c[aY+4>>2]=D;j=c[aA>>2]|0;h=c[aA+4>>2]|0;r=c[aX>>2]|0;J=c[aX+4>>2]|0;aU=bp(j,h,18,0)|0;m=D;k=bf(r,J,j,h)|0;h=bf(k,D,aU,m)|0;c[aX>>2]=h;c[aX+4>>2]=D;h=c[aV>>2]|0;m=c[aV+4>>2]|0;aU=c[t>>2]|0;k=c[t+4>>2]|0;j=bp(h,m,18,0)|0;J=D;r=bf(aU,k,h,m)|0;m=bf(r,D,j,J)|0;c[t>>2]=m;c[t+4>>2]=D;aN(t);bb(L|0,I|0,80);aM(t,f,o);o=c[z>>2]|0;f=c[z+4>>2]|0;z=c[a2>>2]|0;L=c[a2+4>>2]|0;m=bp(o,f,18,0)|0;J=D;j=bf(z,L,o,f)|0;f=bf(j,D,m,J)|0;c[a2>>2]=f;c[a2+4>>2]=D;a2=c[T>>2]|0;f=c[T+4>>2]|0;T=c[a1>>2]|0;J=c[a1+4>>2]|0;m=bp(a2,f,18,0)|0;j=D;o=bf(T,J,a2,f)|0;f=bf(o,D,m,j)|0;c[a1>>2]=f;c[a1+4>>2]=D;a1=c[a4>>2]|0;f=c[a4+4>>2]|0;a4=c[a0>>2]|0;j=c[a0+4>>2]|0;m=bp(a1,f,18,0)|0;o=D;a2=bf(a4,j,a1,f)|0;f=bf(a2,D,m,o)|0;c[a0>>2]=f;c[a0+4>>2]=D;a0=c[y>>2]|0;f=c[y+4>>2]|0;y=c[a$>>2]|0;o=c[a$+4>>2]|0;m=bp(a0,f,18,0)|0;a2=D;a1=bf(y,o,a0,f)|0;f=bf(a1,D,m,a2)|0;c[a$>>2]=f;c[a$+4>>2]=D;a$=c[B>>2]|0;f=c[B+4>>2]|0;B=c[a_>>2]|0;a2=c[a_+4>>2]|0;m=bp(a$,f,18,0)|0;a1=D;a0=bf(B,a2,a$,f)|0;f=bf(a0,D,m,a1)|0;c[a_>>2]=f;c[a_+4>>2]=D;a_=c[b$>>2]|0;f=c[b$+4>>2]|0;b$=c[aZ>>2]|0;a1=c[aZ+4>>2]|0;m=bp(a_,f,18,0)|0;a0=D;a$=bf(b$,a1,a_,f)|0;f=bf(a$,D,m,a0)|0;c[aZ>>2]=f;c[aZ+4>>2]=D;aZ=c[A>>2]|0;f=c[A+4>>2]|0;A=c[aY>>2]|0;a0=c[aY+4>>2]|0;m=bp(aZ,f,18,0)|0;a$=D;a_=bf(A,a0,aZ,f)|0;f=bf(a_,D,m,a$)|0;c[aY>>2]=f;c[aY+4>>2]=D;aY=c[aA>>2]|0;f=c[aA+4>>2]|0;aA=c[aX>>2]|0;a$=c[aX+4>>2]|0;m=bp(aY,f,18,0)|0;a_=D;aZ=bf(aA,a$,aY,f)|0;f=bf(aZ,D,m,a_)|0;c[aX>>2]=f;c[aX+4>>2]=D;aX=c[aV>>2]|0;f=c[aV+4>>2]|0;aV=c[t>>2]|0;a_=c[t+4>>2]|0;m=bp(aX,f,18,0)|0;aZ=D;aY=bf(aV,a_,aX,f)|0;f=bf(aY,D,m,aZ)|0;c[t>>2]=f;c[t+4>>2]=D;aN(t);bb(ba|0,I|0,80);I=c[a5>>2]|0;a5=H|0;c[a5>>2]=I;ba=H+4|0;c[ba>>2]=c[K+8>>2];t=H+8|0;c[t>>2]=c[K+16>>2];f=H+12|0;c[f>>2]=c[K+24>>2];aZ=H+16|0;c[aZ>>2]=c[K+32>>2];m=H+20|0;c[m>>2]=c[K+40>>2];aY=H+24|0;c[aY>>2]=c[K+48>>2];aX=H+28|0;c[aX>>2]=c[K+56>>2];a_=H+32|0;c[a_>>2]=c[K+64>>2];aV=H+36|0;c[aV>>2]=c[K+72>>2];K=0;a$=I;while(1){I=H+(K<<2)|0;aA=a$>>31&a$;if((K&1|0)==0){a0=aA>>26;c[I>>2]=$(a0,-67108864)+a$;A=H+(K+1<<2)|0;a1=(c[A>>2]|0)+a0|0;c[A>>2]=a1;b0=a1}else{a1=aA>>25;c[I>>2]=$(a1,-33554432)+a$;I=H+(K+1<<2)|0;aA=(c[I>>2]|0)+a1|0;c[I>>2]=aA;b0=aA}aA=K+1|0;if((aA|0)<9){K=aA;a$=b0}else{break}}b0=c[aV>>2]|0;a$=(b0>>31&b0)>>25;c[aV>>2]=$(a$,-33554432)+b0;b0=(a$*19&-1)+(c[a5>>2]|0)|0;c[a5>>2]=b0;a$=0;K=b0;while(1){b0=H+(a$<<2)|0;aA=K>>31&K;if((a$&1|0)==0){I=aA>>26;c[b0>>2]=$(I,-67108864)+K;a1=H+(a$+1<<2)|0;A=(c[a1>>2]|0)+I|0;c[a1>>2]=A;b1=A}else{A=aA>>25;c[b0>>2]=$(A,-33554432)+K;b0=H+(a$+1<<2)|0;aA=(c[b0>>2]|0)+A|0;c[b0>>2]=aA;b1=aA}aA=a$+1|0;if((aA|0)<9){a$=aA;K=b1}else{break}}b1=c[aV>>2]|0;K=(b1>>31&b1)>>25;c[aV>>2]=$(K,-33554432)+b1;b1=(K*19&-1)+(c[a5>>2]|0)|0;K=(b1>>31&b1)>>26;a$=$(K,-67108864)+b1|0;c[a5>>2]=a$;c[ba>>2]=K+(c[ba>>2]|0);K=0;b1=a$;while(1){a$=H+(K<<2)|0;if((K&1|0)==0){c[a$>>2]=b1&67108863;aA=H+(K+1<<2)|0;b0=(c[aA>>2]|0)+(b1>>26)|0;c[aA>>2]=b0;b2=b0}else{c[a$>>2]=b1&33554431;a$=H+(K+1<<2)|0;b0=(c[a$>>2]|0)+(b1>>25)|0;c[a$>>2]=b0;b2=b0}b0=K+1|0;if((b0|0)<9){K=b0;b1=b2}else{break}}b2=c[aV>>2]|0;c[aV>>2]=b2&33554431;b1=((b2>>25)*19&-1)+(c[a5>>2]|0)|0;c[a5>>2]=b1;b2=0;K=b1;while(1){b1=H+(b2<<2)|0;if((b2&1|0)==0){c[b1>>2]=K&67108863;b0=H+(b2+1<<2)|0;a$=(c[b0>>2]|0)+(K>>26)|0;c[b0>>2]=a$;b3=a$}else{c[b1>>2]=K&33554431;b1=H+(b2+1<<2)|0;a$=(c[b1>>2]|0)+(K>>25)|0;c[b1>>2]=a$;b3=a$}a$=b2+1|0;if((a$|0)<9){b2=a$;K=b3}else{break}}b3=c[aV>>2]|0;K=b3&33554431;c[aV>>2]=K;aV=((b3>>25)*19&-1)+(c[a5>>2]|0)|0;c[a5>>2]=aV;b3=aV-67108845>>31^-1;b2=1;do{a$=c[H+(b2<<2)>>2]|0;if((b2&1|0)==0){b1=a$^-67108864;b0=b1<<16&b1;b1=b0<<8&b0;b0=b1<<4&b1;b1=b0<<2&b0;b4=b1<<1&b1}else{b1=a$^-33554432;a$=b1<<16&b1;b1=a$<<8&a$;a$=b1<<4&b1;b1=a$<<2&a$;b4=b1<<1&b1}b3=b4>>31&b3;b2=b2+1|0;}while((b2|0)<10);b2=aV-(b3&67108845)|0;c[a5>>2]=b2;a5=b3&67108863;aV=b3&33554431;b4=(c[ba>>2]|0)-aV|0;ba=(c[t>>2]|0)-a5|0;t=(c[f>>2]|0)-aV|0;f=(c[aZ>>2]|0)-b3|0;b3=(c[m>>2]|0)-aV|0;c[m>>2]=b3;m=(c[aY>>2]|0)-a5|0;aY=(c[aX>>2]|0)-aV|0;aX=(c[a_>>2]|0)-a5|0;a5=K-aV|0;a[b]=b2&255;a[b+1|0]=b2>>>8&255;a[b+2|0]=b2>>>16&255;a[b+3|0]=(b4<<2|b2>>>24)&255;a[b+4|0]=b4>>>6&255;a[b+5|0]=b4>>>14&255;a[b+6|0]=(ba<<3|b4>>>22)&255;a[b+7|0]=ba>>>5&255;a[b+8|0]=ba>>>13&255;a[b+9|0]=(t<<5|ba>>>21)&255;a[b+10|0]=t>>>3&255;a[b+11|0]=t>>>11&255;a[b+12|0]=(f<<6|t>>>19)&255;a[b+13|0]=f>>>2&255;a[b+14|0]=f>>>10&255;a[b+15|0]=f>>>18&255;a[b+16|0]=b3&255;a[b+17|0]=b3>>>8&255;a[b+18|0]=b3>>>16&255;a[b+19|0]=(m<<1|b3>>>24)&255;a[b+20|0]=m>>>7&255;a[b+21|0]=m>>>15&255;a[b+22|0]=(aY<<3|m>>>23)&255;a[b+23|0]=aY>>>5&255;a[b+24|0]=aY>>>13&255;a[b+25|0]=(aX<<4|aY>>>21)&255;a[b+26|0]=aX>>>4&255;a[b+27|0]=aX>>>12&255;a[b+28|0]=(aX>>>20|a5<<6)&255;a[b+29|0]=a5>>>2&255;a[b+30|0]=a5>>>10&255;a[b+31|0]=a5>>>18&255;i=g;return 0}function aM(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0;e=c[b>>2]|0;f=c[d>>2]|0;g=bp(f,(f|0)<0?-1:0,e,(e|0)<0?-1:0)|0;c[a>>2]=g;c[a+4>>2]=D;g=c[b>>2]|0;e=d+8|0;f=c[e>>2]|0;h=bp(f,(f|0)<0?-1:0,g,(g|0)<0?-1:0)|0;g=D;f=b+8|0;i=c[f>>2]|0;j=c[d>>2]|0;k=bp(j,(j|0)<0?-1:0,i,(i|0)<0?-1:0)|0;i=bf(k,D,h,g)|0;g=a+8|0;c[g>>2]=i;c[g+4>>2]=D;g=c[f>>2]|0;i=c[e>>2]|0;h=bp(i,(i|0)<0?-1:0,0>>>31|g<<1,g>>31|((g|0)<0?-1:0)<<1)|0;g=D;i=c[b>>2]|0;k=d+16|0;j=c[k>>2]|0;l=bp(j,(j|0)<0?-1:0,i,(i|0)<0?-1:0)|0;i=bf(l,D,h,g)|0;g=D;h=b+16|0;l=c[h>>2]|0;j=c[d>>2]|0;m=bp(j,(j|0)<0?-1:0,l,(l|0)<0?-1:0)|0;l=bf(i,g,m,D)|0;m=a+16|0;c[m>>2]=l;c[m+4>>2]=D;m=c[f>>2]|0;l=c[k>>2]|0;g=bp(l,(l|0)<0?-1:0,m,(m|0)<0?-1:0)|0;m=D;l=c[h>>2]|0;i=c[e>>2]|0;j=bp(i,(i|0)<0?-1:0,l,(l|0)<0?-1:0)|0;l=bf(j,D,g,m)|0;m=D;g=c[b>>2]|0;j=d+24|0;i=c[j>>2]|0;n=bp(i,(i|0)<0?-1:0,g,(g|0)<0?-1:0)|0;g=bf(l,m,n,D)|0;n=D;m=b+24|0;l=c[m>>2]|0;i=c[d>>2]|0;o=bp(i,(i|0)<0?-1:0,l,(l|0)<0?-1:0)|0;l=bf(g,n,o,D)|0;o=a+24|0;c[o>>2]=l;c[o+4>>2]=D;o=c[h>>2]|0;l=c[k>>2]|0;n=bp(l,(l|0)<0?-1:0,o,(o|0)<0?-1:0)|0;o=D;l=c[f>>2]|0;g=c[j>>2]|0;i=bp(g,(g|0)<0?-1:0,l,(l|0)<0?-1:0)|0;l=D;g=c[m>>2]|0;p=c[e>>2]|0;q=bp(p,(p|0)<0?-1:0,g,(g|0)<0?-1:0)|0;g=bf(q,D,i,l)|0;l=bf(g<<1|0>>>31,D<<1|g>>>31,n,o)|0;o=D;n=c[b>>2]|0;g=d+32|0;i=c[g>>2]|0;q=bp(i,(i|0)<0?-1:0,n,(n|0)<0?-1:0)|0;n=bf(l,o,q,D)|0;q=D;o=b+32|0;l=c[o>>2]|0;i=c[d>>2]|0;p=bp(i,(i|0)<0?-1:0,l,(l|0)<0?-1:0)|0;l=bf(n,q,p,D)|0;p=a+32|0;c[p>>2]=l;c[p+4>>2]=D;p=c[h>>2]|0;l=c[j>>2]|0;q=bp(l,(l|0)<0?-1:0,p,(p|0)<0?-1:0)|0;p=D;l=c[m>>2]|0;n=c[k>>2]|0;i=bp(n,(n|0)<0?-1:0,l,(l|0)<0?-1:0)|0;l=bf(i,D,q,p)|0;p=D;q=c[f>>2]|0;i=c[g>>2]|0;n=bp(i,(i|0)<0?-1:0,q,(q|0)<0?-1:0)|0;q=bf(l,p,n,D)|0;n=D;p=c[o>>2]|0;l=c[e>>2]|0;i=bp(l,(l|0)<0?-1:0,p,(p|0)<0?-1:0)|0;p=bf(q,n,i,D)|0;i=D;n=c[b>>2]|0;q=d+40|0;l=c[q>>2]|0;r=bp(l,(l|0)<0?-1:0,n,(n|0)<0?-1:0)|0;n=bf(p,i,r,D)|0;r=D;i=b+40|0;p=c[i>>2]|0;l=c[d>>2]|0;s=bp(l,(l|0)<0?-1:0,p,(p|0)<0?-1:0)|0;p=bf(n,r,s,D)|0;s=a+40|0;c[s>>2]=p;c[s+4>>2]=D;s=c[m>>2]|0;p=c[j>>2]|0;r=bp(p,(p|0)<0?-1:0,s,(s|0)<0?-1:0)|0;s=D;p=c[f>>2]|0;n=c[q>>2]|0;l=bp(n,(n|0)<0?-1:0,p,(p|0)<0?-1:0)|0;p=bf(l,D,r,s)|0;s=D;r=c[i>>2]|0;l=c[e>>2]|0;n=bp(l,(l|0)<0?-1:0,r,(r|0)<0?-1:0)|0;r=bf(p,s,n,D)|0;n=D<<1|r>>>31;s=c[h>>2]|0;p=c[g>>2]|0;l=bp(p,(p|0)<0?-1:0,s,(s|0)<0?-1:0)|0;s=bf(r<<1|0>>>31,n,l,D)|0;l=D;n=c[o>>2]|0;r=c[k>>2]|0;p=bp(r,(r|0)<0?-1:0,n,(n|0)<0?-1:0)|0;n=bf(s,l,p,D)|0;p=D;l=c[b>>2]|0;s=d+48|0;r=c[s>>2]|0;t=bp(r,(r|0)<0?-1:0,l,(l|0)<0?-1:0)|0;l=bf(n,p,t,D)|0;t=D;p=b+48|0;n=c[p>>2]|0;r=c[d>>2]|0;u=bp(r,(r|0)<0?-1:0,n,(n|0)<0?-1:0)|0;n=bf(l,t,u,D)|0;u=a+48|0;c[u>>2]=n;c[u+4>>2]=D;u=c[m>>2]|0;n=c[g>>2]|0;t=bp(n,(n|0)<0?-1:0,u,(u|0)<0?-1:0)|0;u=D;n=c[o>>2]|0;l=c[j>>2]|0;r=bp(l,(l|0)<0?-1:0,n,(n|0)<0?-1:0)|0;n=bf(r,D,t,u)|0;u=D;t=c[h>>2]|0;r=c[q>>2]|0;l=bp(r,(r|0)<0?-1:0,t,(t|0)<0?-1:0)|0;t=bf(n,u,l,D)|0;l=D;u=c[i>>2]|0;n=c[k>>2]|0;r=bp(n,(n|0)<0?-1:0,u,(u|0)<0?-1:0)|0;u=bf(t,l,r,D)|0;r=D;l=c[f>>2]|0;t=c[s>>2]|0;n=bp(t,(t|0)<0?-1:0,l,(l|0)<0?-1:0)|0;l=bf(u,r,n,D)|0;n=D;r=c[p>>2]|0;u=c[e>>2]|0;t=bp(u,(u|0)<0?-1:0,r,(r|0)<0?-1:0)|0;r=bf(l,n,t,D)|0;t=D;n=c[b>>2]|0;l=d+56|0;u=c[l>>2]|0;v=bp(u,(u|0)<0?-1:0,n,(n|0)<0?-1:0)|0;n=bf(r,t,v,D)|0;v=D;t=b+56|0;r=c[t>>2]|0;u=c[d>>2]|0;w=bp(u,(u|0)<0?-1:0,r,(r|0)<0?-1:0)|0;r=bf(n,v,w,D)|0;w=a+56|0;c[w>>2]=r;c[w+4>>2]=D;w=c[o>>2]|0;r=c[g>>2]|0;v=bp(r,(r|0)<0?-1:0,w,(w|0)<0?-1:0)|0;w=D;r=c[m>>2]|0;n=c[q>>2]|0;u=bp(n,(n|0)<0?-1:0,r,(r|0)<0?-1:0)|0;r=D;n=c[i>>2]|0;x=c[j>>2]|0;y=bp(x,(x|0)<0?-1:0,n,(n|0)<0?-1:0)|0;n=bf(y,D,u,r)|0;r=D;u=c[f>>2]|0;y=c[l>>2]|0;x=bp(y,(y|0)<0?-1:0,u,(u|0)<0?-1:0)|0;u=bf(n,r,x,D)|0;x=D;r=c[t>>2]|0;n=c[e>>2]|0;y=bp(n,(n|0)<0?-1:0,r,(r|0)<0?-1:0)|0;r=bf(u,x,y,D)|0;y=bf(r<<1|0>>>31,D<<1|r>>>31,v,w)|0;w=D;v=c[h>>2]|0;r=c[s>>2]|0;x=bp(r,(r|0)<0?-1:0,v,(v|0)<0?-1:0)|0;v=bf(y,w,x,D)|0;x=D;w=c[p>>2]|0;y=c[k>>2]|0;r=bp(y,(y|0)<0?-1:0,w,(w|0)<0?-1:0)|0;w=bf(v,x,r,D)|0;r=D;x=c[b>>2]|0;v=d+64|0;y=c[v>>2]|0;u=bp(y,(y|0)<0?-1:0,x,(x|0)<0?-1:0)|0;x=bf(w,r,u,D)|0;u=D;r=b+64|0;w=c[r>>2]|0;y=c[d>>2]|0;n=bp(y,(y|0)<0?-1:0,w,(w|0)<0?-1:0)|0;w=bf(x,u,n,D)|0;n=a+64|0;c[n>>2]=w;c[n+4>>2]=D;n=c[o>>2]|0;w=c[q>>2]|0;u=bp(w,(w|0)<0?-1:0,n,(n|0)<0?-1:0)|0;n=D;w=c[i>>2]|0;x=c[g>>2]|0;y=bp(x,(x|0)<0?-1:0,w,(w|0)<0?-1:0)|0;w=bf(y,D,u,n)|0;n=D;u=c[m>>2]|0;y=c[s>>2]|0;x=bp(y,(y|0)<0?-1:0,u,(u|0)<0?-1:0)|0;u=bf(w,n,x,D)|0;x=D;n=c[p>>2]|0;w=c[j>>2]|0;y=bp(w,(w|0)<0?-1:0,n,(n|0)<0?-1:0)|0;n=bf(u,x,y,D)|0;y=D;x=c[h>>2]|0;u=c[l>>2]|0;w=bp(u,(u|0)<0?-1:0,x,(x|0)<0?-1:0)|0;x=bf(n,y,w,D)|0;w=D;y=c[t>>2]|0;n=c[k>>2]|0;u=bp(n,(n|0)<0?-1:0,y,(y|0)<0?-1:0)|0;y=bf(x,w,u,D)|0;u=D;w=c[f>>2]|0;x=c[v>>2]|0;n=bp(x,(x|0)<0?-1:0,w,(w|0)<0?-1:0)|0;w=bf(y,u,n,D)|0;n=D;u=c[r>>2]|0;y=c[e>>2]|0;x=bp(y,(y|0)<0?-1:0,u,(u|0)<0?-1:0)|0;u=bf(w,n,x,D)|0;x=D;n=c[b>>2]|0;w=d+72|0;y=c[w>>2]|0;z=bp(y,(y|0)<0?-1:0,n,(n|0)<0?-1:0)|0;n=bf(u,x,z,D)|0;z=D;x=b+72|0;b=c[x>>2]|0;u=c[d>>2]|0;d=bp(u,(u|0)<0?-1:0,b,(b|0)<0?-1:0)|0;b=bf(n,z,d,D)|0;d=a+72|0;c[d>>2]=b;c[d+4>>2]=D;d=c[i>>2]|0;b=c[q>>2]|0;z=bp(b,(b|0)<0?-1:0,d,(d|0)<0?-1:0)|0;d=D;b=c[m>>2]|0;n=c[l>>2]|0;u=bp(n,(n|0)<0?-1:0,b,(b|0)<0?-1:0)|0;b=bf(u,D,z,d)|0;d=D;z=c[t>>2]|0;u=c[j>>2]|0;n=bp(u,(u|0)<0?-1:0,z,(z|0)<0?-1:0)|0;z=bf(b,d,n,D)|0;n=D;d=c[f>>2]|0;f=c[w>>2]|0;b=bp(f,(f|0)<0?-1:0,d,(d|0)<0?-1:0)|0;d=bf(z,n,b,D)|0;b=D;n=c[x>>2]|0;z=c[e>>2]|0;e=bp(z,(z|0)<0?-1:0,n,(n|0)<0?-1:0)|0;n=bf(d,b,e,D)|0;e=D<<1|n>>>31;b=c[o>>2]|0;d=c[s>>2]|0;z=bp(d,(d|0)<0?-1:0,b,(b|0)<0?-1:0)|0;b=bf(n<<1|0>>>31,e,z,D)|0;z=D;e=c[p>>2]|0;n=c[g>>2]|0;d=bp(n,(n|0)<0?-1:0,e,(e|0)<0?-1:0)|0;e=bf(b,z,d,D)|0;d=D;z=c[h>>2]|0;b=c[v>>2]|0;n=bp(b,(b|0)<0?-1:0,z,(z|0)<0?-1:0)|0;z=bf(e,d,n,D)|0;n=D;d=c[r>>2]|0;e=c[k>>2]|0;b=bp(e,(e|0)<0?-1:0,d,(d|0)<0?-1:0)|0;d=bf(z,n,b,D)|0;b=a+80|0;c[b>>2]=d;c[b+4>>2]=D;b=c[i>>2]|0;d=c[s>>2]|0;n=bp(d,(d|0)<0?-1:0,b,(b|0)<0?-1:0)|0;b=D;d=c[p>>2]|0;z=c[q>>2]|0;e=bp(z,(z|0)<0?-1:0,d,(d|0)<0?-1:0)|0;d=bf(e,D,n,b)|0;b=D;n=c[o>>2]|0;e=c[l>>2]|0;z=bp(e,(e|0)<0?-1:0,n,(n|0)<0?-1:0)|0;n=bf(d,b,z,D)|0;z=D;b=c[t>>2]|0;d=c[g>>2]|0;e=bp(d,(d|0)<0?-1:0,b,(b|0)<0?-1:0)|0;b=bf(n,z,e,D)|0;e=D;z=c[m>>2]|0;n=c[v>>2]|0;d=bp(n,(n|0)<0?-1:0,z,(z|0)<0?-1:0)|0;z=bf(b,e,d,D)|0;d=D;e=c[r>>2]|0;b=c[j>>2]|0;n=bp(b,(b|0)<0?-1:0,e,(e|0)<0?-1:0)|0;e=bf(z,d,n,D)|0;n=D;d=c[h>>2]|0;h=c[w>>2]|0;z=bp(h,(h|0)<0?-1:0,d,(d|0)<0?-1:0)|0;d=bf(e,n,z,D)|0;z=D;n=c[x>>2]|0;e=c[k>>2]|0;k=bp(e,(e|0)<0?-1:0,n,(n|0)<0?-1:0)|0;n=bf(d,z,k,D)|0;k=a+88|0;c[k>>2]=n;c[k+4>>2]=D;k=c[p>>2]|0;n=c[s>>2]|0;z=bp(n,(n|0)<0?-1:0,k,(k|0)<0?-1:0)|0;k=D;n=c[i>>2]|0;d=c[l>>2]|0;e=bp(d,(d|0)<0?-1:0,n,(n|0)<0?-1:0)|0;n=D;d=c[t>>2]|0;h=c[q>>2]|0;b=bp(h,(h|0)<0?-1:0,d,(d|0)<0?-1:0)|0;d=bf(b,D,e,n)|0;n=D;e=c[m>>2]|0;m=c[w>>2]|0;b=bp(m,(m|0)<0?-1:0,e,(e|0)<0?-1:0)|0;e=bf(d,n,b,D)|0;b=D;n=c[x>>2]|0;d=c[j>>2]|0;j=bp(d,(d|0)<0?-1:0,n,(n|0)<0?-1:0)|0;n=bf(e,b,j,D)|0;j=bf(n<<1|0>>>31,D<<1|n>>>31,z,k)|0;k=D;z=c[o>>2]|0;n=c[v>>2]|0;b=bp(n,(n|0)<0?-1:0,z,(z|0)<0?-1:0)|0;z=bf(j,k,b,D)|0;b=D;k=c[r>>2]|0;j=c[g>>2]|0;n=bp(j,(j|0)<0?-1:0,k,(k|0)<0?-1:0)|0;k=bf(z,b,n,D)|0;n=a+96|0;c[n>>2]=k;c[n+4>>2]=D;n=c[p>>2]|0;k=c[l>>2]|0;b=bp(k,(k|0)<0?-1:0,n,(n|0)<0?-1:0)|0;n=D;k=c[t>>2]|0;z=c[s>>2]|0;j=bp(z,(z|0)<0?-1:0,k,(k|0)<0?-1:0)|0;k=bf(j,D,b,n)|0;n=D;b=c[i>>2]|0;j=c[v>>2]|0;z=bp(j,(j|0)<0?-1:0,b,(b|0)<0?-1:0)|0;b=bf(k,n,z,D)|0;z=D;n=c[r>>2]|0;k=c[q>>2]|0;j=bp(k,(k|0)<0?-1:0,n,(n|0)<0?-1:0)|0;n=bf(b,z,j,D)|0;j=D;z=c[o>>2]|0;o=c[w>>2]|0;b=bp(o,(o|0)<0?-1:0,z,(z|0)<0?-1:0)|0;z=bf(n,j,b,D)|0;b=D;j=c[x>>2]|0;n=c[g>>2]|0;g=bp(n,(n|0)<0?-1:0,j,(j|0)<0?-1:0)|0;j=bf(z,b,g,D)|0;g=a+104|0;c[g>>2]=j;c[g+4>>2]=D;g=c[t>>2]|0;j=c[l>>2]|0;b=bp(j,(j|0)<0?-1:0,g,(g|0)<0?-1:0)|0;g=D;j=c[i>>2]|0;i=c[w>>2]|0;z=bp(i,(i|0)<0?-1:0,j,(j|0)<0?-1:0)|0;j=bf(z,D,b,g)|0;g=D;b=c[x>>2]|0;z=c[q>>2]|0;q=bp(z,(z|0)<0?-1:0,b,(b|0)<0?-1:0)|0;b=bf(j,g,q,D)|0;q=D<<1|b>>>31;g=c[p>>2]|0;j=c[v>>2]|0;z=bp(j,(j|0)<0?-1:0,g,(g|0)<0?-1:0)|0;g=bf(b<<1|0>>>31,q,z,D)|0;z=D;q=c[r>>2]|0;b=c[s>>2]|0;j=bp(b,(b|0)<0?-1:0,q,(q|0)<0?-1:0)|0;q=bf(g,z,j,D)|0;j=a+112|0;c[j>>2]=q;c[j+4>>2]=D;j=c[t>>2]|0;q=c[v>>2]|0;z=bp(q,(q|0)<0?-1:0,j,(j|0)<0?-1:0)|0;j=D;q=c[r>>2]|0;g=c[l>>2]|0;b=bp(g,(g|0)<0?-1:0,q,(q|0)<0?-1:0)|0;q=bf(b,D,z,j)|0;j=D;z=c[p>>2]|0;p=c[w>>2]|0;b=bp(p,(p|0)<0?-1:0,z,(z|0)<0?-1:0)|0;z=bf(q,j,b,D)|0;b=D;j=c[x>>2]|0;q=c[s>>2]|0;s=bp(q,(q|0)<0?-1:0,j,(j|0)<0?-1:0)|0;j=bf(z,b,s,D)|0;s=a+120|0;c[s>>2]=j;c[s+4>>2]=D;s=c[r>>2]|0;j=c[v>>2]|0;b=bp(j,(j|0)<0?-1:0,s,(s|0)<0?-1:0)|0;s=D;j=c[t>>2]|0;t=c[w>>2]|0;z=bp(t,(t|0)<0?-1:0,j,(j|0)<0?-1:0)|0;j=D;t=c[x>>2]|0;q=c[l>>2]|0;l=bp(q,(q|0)<0?-1:0,t,(t|0)<0?-1:0)|0;t=bf(l,D,z,j)|0;j=bf(t<<1|0>>>31,D<<1|t>>>31,b,s)|0;s=a+128|0;c[s>>2]=j;c[s+4>>2]=D;s=c[r>>2]|0;r=c[w>>2]|0;j=bp(r,(r|0)<0?-1:0,s,(s|0)<0?-1:0)|0;s=D;r=c[x>>2]|0;b=c[v>>2]|0;v=bp(b,(b|0)<0?-1:0,r,(r|0)<0?-1:0)|0;r=bf(v,D,j,s)|0;s=a+136|0;c[s>>2]=r;c[s+4>>2]=D;s=c[x>>2]|0;x=c[w>>2]|0;w=bp(x,(x|0)<0?-1:0,0>>>31|s<<1,s>>31|((s|0)<0?-1:0)<<1)|0;s=a+144|0;c[s>>2]=w;c[s+4>>2]=D;return}function aN(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0;b=a+80|0;c[b>>2]=0;c[b+4>>2]=0;d=0;e=c[a+4>>2]|0;f=c[a>>2]|0;do{g=a+(d<<3)|0;h=bf(e>>31>>>6,0,f,e)|0;i=D;j=h>>>26|i<<6;h=i>>26|((i|0)<0?-1:0)<<6;i=bg(f,e,j<<26|0>>>6,h<<26|j>>>6)|0;c[g>>2]=i;c[g+4>>2]=D;g=a+((d|1)<<3)|0;i=bf(j,h,c[g>>2]|0,c[g+4>>2]|0)|0;h=D;j=bf(h>>31>>>7,0,i,h)|0;k=D;l=j>>>25|k<<7;j=k>>25|((k|0)<0?-1:0)<<7;k=bg(i,h,l<<25|0>>>7,j<<25|l>>>7)|0;c[g>>2]=k;c[g+4>>2]=D;d=d+2|0;g=a+(d<<3)|0;f=bf(l,j,c[g>>2]|0,c[g+4>>2]|0)|0;e=D;c[g>>2]=f;c[g+4>>2]=e;}while(d>>>0<10);d=c[b>>2]|0;e=c[b+4>>2]|0;f=bf(c[a>>2]|0,c[a+4>>2]|0,d<<4|0>>>28,e<<4|d>>>28)|0;g=bf(d<<1|0>>>31,e<<1|d>>>31,f,D)|0;f=bf(g,D,d,e)|0;e=D;c[b>>2]=0;c[b+4>>2]=0;b=bf(e>>31>>>6,0,f,e)|0;d=D;g=b>>>26|d<<6;b=d>>26|((d|0)<0?-1:0)<<6;d=bg(f,e,g<<26|0>>>6,b<<26|g>>>6)|0;c[a>>2]=d;c[a+4>>2]=D;d=a+8|0;a=bf(g,b,c[d>>2]|0,c[d+4>>2]|0)|0;c[d>>2]=a;c[d+4>>2]=D;return}function aO(a,b){a=a|0;b=b|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0,E=0,F=0,G=0,H=0,I=0;e=d[b+1|0]|0;f=d[b+2|0]|0;g=d[b+3|0]|0;h=e<<8|0>>>24|(d[b]|0)|(f<<16|0>>>16)|(g<<24|0>>>8);i=d[b+5|0]|0;j=d[b+6|0]|0;k=i<<8|0>>>24|(d[b+4|0]|0)|(j<<16|0>>>16);l=k<<6|0>>>26;m=(0<<8|i>>>24|(0<<16|j>>>16))<<6|k>>>26;k=d[b+8|0]|0;j=d[b+9|0]|0;i=k<<8|0>>>24|(d[b+7|0]|0)|(j<<16|0>>>16);n=d[b+11|0]|0;o=d[b+12|0]|0;p=n<<8|0>>>24|(d[b+10|0]|0)|(o<<16|0>>>16);q=p<<3|0>>>29;r=(0<<8|n>>>24|(0<<16|o>>>16))<<3|p>>>29;p=d[b+14|0]|0;o=d[b+15|0]|0;n=p<<8|0>>>24|(d[b+13|0]|0)|(o<<16|0>>>16);s=d[b+17|0]|0;t=d[b+18|0]|0;u=d[b+19|0]|0;v=s<<8|0>>>24|(d[b+16|0]|0)|(t<<16|0>>>16)|(u<<24|0>>>8);w=0<<8|s>>>24|(0<<16|t>>>16)|(0<<24|u>>>8);u=d[b+21|0]|0;t=d[b+22|0]|0;s=u<<8|0>>>24|(d[b+20|0]|0)|(t<<16|0>>>16);x=d[b+24|0]|0;y=d[b+25|0]|0;z=x<<8|0>>>24|(d[b+23|0]|0)|(y<<16|0>>>16);A=z<<5|0>>>27;B=(0<<8|x>>>24|(0<<16|y>>>16))<<5|z>>>27;z=d[b+27|0]|0;y=d[b+28|0]|0;x=z<<8|0>>>24|(d[b+26|0]|0)|(y<<16|0>>>16);C=d[b+30|0]|0;E=d[b+31|0]|0;F=C<<8|0>>>24|(d[b+29|0]|0)|(E<<16|0>>>16);b=(F<<2|0>>>30)&33554428;G=((0<<8|C>>>24|(0<<16|E>>>16))<<2|F>>>30)&0;F=bf(b,G,16777216,0)|0;E=D;C=F>>>25|E<<7;F=E>>>25|0<<7;E=bp(C,F,19,0)|0;H=bf(E,D,h,0<<8|e>>>24|(0<<16|f>>>16)|(0<<24|g>>>8))|0;g=D;f=bf(l,m,16777216,0)|0;e=D;h=f>>>25|e<<7;f=e>>>25|0<<7;e=bf(i<<5|0>>>27,(0<<8|k>>>24|(0<<16|j>>>16))<<5|i>>>27,h,f)|0;i=D;j=bg(l,m,h<<25|0>>>7,f<<25|h>>>7)|0;h=D;f=bf(q,r,16777216,0)|0;m=D;l=f>>>25|m<<7;f=m>>>25|0<<7;m=bf(n<<2|0>>>30,(0<<8|p>>>24|(0<<16|o>>>16))<<2|n>>>30,l,f)|0;n=D;o=bf(v,w,16777216,0)|0;p=D;k=o>>>25|p<<7;o=p>>>25|0<<7;p=bf(s<<7|0>>>25,(0<<8|u>>>24|(0<<16|t>>>16))<<7|s>>>25,k,o)|0;s=D;t=bf(A,B,16777216,0)|0;u=D;E=t>>>25|u<<7;t=u>>>25|0<<7;u=bf(x<<4|0>>>28,(0<<8|z>>>24|(0<<16|y>>>16))<<4|x>>>28,E,t)|0;x=D;y=bf(H,g,33554432,0)|0;z=D;I=y>>>26|z<<6;y=z>>26|((z|0)<0?-1:0)<<6;z=bf(j,h,I,y)|0;h=bg(H,g,I<<26|0>>>6,y<<26|I>>>6)|0;I=bf(e,i,33554432,0)|0;y=D;g=I>>>26|y<<6;I=y>>26|((y|0)<0?-1:0)<<6;y=bf(g,I,q,r)|0;r=bg(y,D,l<<25|0>>>7,f<<25|l>>>7)|0;l=bg(e,i,g<<26|0>>>6,I<<26|g>>>6)|0;g=bf(m,n,33554432,0)|0;I=D;i=g>>>26|I<<6;g=I>>26|((I|0)<0?-1:0)<<6;I=bf(i,g,v,w)|0;w=bg(I,D,k<<25|0>>>7,o<<25|k>>>7)|0;k=bg(m,n,i<<26|0>>>6,g<<26|i>>>6)|0;i=bf(p,s,33554432,0)|0;g=D;n=i>>>26|g<<6;i=g>>26|((g|0)<0?-1:0)<<6;g=bf(n,i,A,B)|0;B=bg(g,D,E<<25|0>>>7,t<<25|E>>>7)|0;E=bg(p,s,n<<26|0>>>6,i<<26|n>>>6)|0;n=bf(u,x,33554432,0)|0;i=D;s=n>>>26|i<<6;n=i>>26|((i|0)<0?-1:0)<<6;i=bf(b,G,s,n)|0;G=bg(i,D,C<<25|0>>>7,F<<25|C>>>7)|0;C=bg(u,x,s<<26|0>>>6,n<<26|s>>>6)|0;c[a>>2]=h;c[a+4>>2]=z;c[a+8>>2]=l;c[a+12>>2]=r;c[a+16>>2]=k;c[a+20>>2]=w;c[a+24>>2]=E;c[a+28>>2]=B;c[a+32>>2]=C;c[a+36>>2]=G;return}function aP(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0,L=0,M=0,N=0,O=0,P=0,Q=0,R=0,S=0,T=0,U=0,V=0,W=0,X=0,Y=0,Z=0,_=0,$=0,aa=0,ab=0,ac=0,ad=0,ae=0,af=0,ag=0,ah=0,ai=0,aj=0,ak=0,al=0,am=0,an=0,ao=0,ap=0,aq=0,ar=0,as=0,at=0,au=0,av=0,aw=0,ax=0,ay=0,az=0,aA=0,aB=0,aC=0,aD=0,aE=0,aF=0,aG=0,aH=0,aI=0,aJ=0,aK=0,aL=0,aM=0,aN=0,aO=0,aP=0,aQ=0,aR=0,aS=0,aT=0,aU=0,aV=0,aW=0,aX=0,aY=0,aZ=0,a_=0,a$=0,a0=0,a1=0,a2=0,a3=0,a4=0,a5=0,a6=0,a7=0,a8=0,a9=0,ba=0,bb=0,bc=0,bd=0,be=0,bh=0,bi=0,bj=0,bk=0,bl=0,bm=0,bn=0,bo=0,bq=0,br=0,bs=0,bt=0,bu=0,bv=0,bw=0,bx=0,by=0,bz=0,bA=0,bB=0,bC=0,bD=0,bE=0,bF=0,bG=0,bH=0,bI=0,bJ=0,bK=0,bL=0,bM=0,bN=0,bO=0,bP=0,bQ=0,bR=0,bS=0,bT=0,bU=0,bV=0,bW=0,bX=0,bY=0,bZ=0,b_=0,b$=0,b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0,b7=0,b8=0,b9=0,ca=0,cb=0,cc=0,cd=0,ce=0,cf=0,cg=0,ch=0,ci=0,cj=0,ck=0,cl=0,cm=0,cn=0,co=0,cp=0,cq=0,cr=0,cs=0,ct=0,cu=0,cv=0,cw=0,cx=0,cy=0,cz=0,cA=0,cB=0,cC=0;e=c[b>>2]|0;f=c[b+4>>2]|0;g=c[b+8>>2]|0;h=c[b+12>>2]|0;i=c[b+16>>2]|0;j=c[b+20>>2]|0;k=c[b+24>>2]|0;l=c[b+28>>2]|0;m=c[b+32>>2]|0;n=c[b+36>>2]|0;b=c[d>>2]|0;o=c[d+4>>2]|0;p=c[d+8>>2]|0;q=c[d+12>>2]|0;r=c[d+16>>2]|0;s=c[d+20>>2]|0;t=c[d+24>>2]|0;u=c[d+28>>2]|0;v=c[d+32>>2]|0;w=c[d+36>>2]|0;d=o*19&-1;x=p*19&-1;y=q*19&-1;z=r*19&-1;A=s*19&-1;B=t*19&-1;C=u*19&-1;E=v*19&-1;F=w*19&-1;G=f<<1;H=h<<1;I=j<<1;J=l<<1;K=n<<1;L=e;M=(e|0)<0?-1:0;e=b;N=(b|0)<0?-1:0;b=bp(e,N,L,M)|0;O=D;P=o;Q=(o|0)<0?-1:0;o=bp(P,Q,L,M)|0;R=D;S=p;T=(p|0)<0?-1:0;p=bp(S,T,L,M)|0;U=D;V=q;W=(q|0)<0?-1:0;q=bp(V,W,L,M)|0;X=D;Y=r;Z=(r|0)<0?-1:0;r=bp(Y,Z,L,M)|0;_=D;$=s;aa=(s|0)<0?-1:0;s=bp($,aa,L,M)|0;ab=D;ac=t;ad=(t|0)<0?-1:0;t=bp(ac,ad,L,M)|0;ae=D;af=u;ag=(u|0)<0?-1:0;u=bp(af,ag,L,M)|0;ah=D;ai=v;aj=(v|0)<0?-1:0;v=bp(ai,aj,L,M)|0;ak=D;al=bp(w,(w|0)<0?-1:0,L,M)|0;M=D;L=f;w=(f|0)<0?-1:0;f=bp(e,N,L,w)|0;am=D;an=G;ao=(G|0)<0?-1:0;G=bp(P,Q,an,ao)|0;ap=D;aq=bp(S,T,L,w)|0;ar=D;as=bp(V,W,an,ao)|0;at=D;au=bp(Y,Z,L,w)|0;av=D;aw=bp($,aa,an,ao)|0;ax=D;ay=bp(ac,ad,L,w)|0;az=D;aA=bp(af,ag,an,ao)|0;aB=D;aC=bp(ai,aj,L,w)|0;w=D;L=F;aj=(F|0)<0?-1:0;F=bp(L,aj,an,ao)|0;ao=D;an=g;ai=(g|0)<0?-1:0;g=bp(e,N,an,ai)|0;aD=D;aE=bp(P,Q,an,ai)|0;aF=D;aG=bp(S,T,an,ai)|0;aH=D;aI=bp(V,W,an,ai)|0;aJ=D;aK=bp(Y,Z,an,ai)|0;aL=D;aM=bp($,aa,an,ai)|0;aN=D;aO=bp(ac,ad,an,ai)|0;aP=D;aQ=bp(af,ag,an,ai)|0;ag=D;af=E;aR=(E|0)<0?-1:0;E=bp(af,aR,an,ai)|0;aS=D;aT=bp(L,aj,an,ai)|0;ai=D;an=h;aU=(h|0)<0?-1:0;h=bp(e,N,an,aU)|0;aV=D;aW=H;aX=(H|0)<0?-1:0;H=bp(P,Q,aW,aX)|0;aY=D;aZ=bp(S,T,an,aU)|0;a_=D;a$=bp(V,W,aW,aX)|0;a0=D;a1=bp(Y,Z,an,aU)|0;a2=D;a3=bp($,aa,aW,aX)|0;a4=D;a5=bp(ac,ad,an,aU)|0;ad=D;ac=C;a6=(C|0)<0?-1:0;C=bp(ac,a6,aW,aX)|0;a7=D;a8=bp(af,aR,an,aU)|0;aU=D;an=bp(L,aj,aW,aX)|0;aX=D;aW=i;a9=(i|0)<0?-1:0;i=bp(e,N,aW,a9)|0;ba=D;bb=bp(P,Q,aW,a9)|0;bc=D;bd=bp(S,T,aW,a9)|0;be=D;bh=bp(V,W,aW,a9)|0;bi=D;bj=bp(Y,Z,aW,a9)|0;bk=D;bl=bp($,aa,aW,a9)|0;aa=D;$=B;bm=(B|0)<0?-1:0;B=bp($,bm,aW,a9)|0;bn=D;bo=bp(ac,a6,aW,a9)|0;bq=D;br=bp(af,aR,aW,a9)|0;bs=D;bt=bp(L,aj,aW,a9)|0;a9=D;aW=j;bu=(j|0)<0?-1:0;j=bp(e,N,aW,bu)|0;bv=D;bw=I;bx=(I|0)<0?-1:0;I=bp(P,Q,bw,bx)|0;by=D;bz=bp(S,T,aW,bu)|0;bA=D;bB=bp(V,W,bw,bx)|0;bC=D;bD=bp(Y,Z,aW,bu)|0;Z=D;Y=A;bE=(A|0)<0?-1:0;A=bp(Y,bE,bw,bx)|0;bF=D;bG=bp($,bm,aW,bu)|0;bH=D;bI=bp(ac,a6,bw,bx)|0;bJ=D;bK=bp(af,aR,aW,bu)|0;bu=D;aW=bp(L,aj,bw,bx)|0;bx=D;bw=k;bL=(k|0)<0?-1:0;k=bp(e,N,bw,bL)|0;bM=D;bN=bp(P,Q,bw,bL)|0;bO=D;bP=bp(S,T,bw,bL)|0;bQ=D;bR=bp(V,W,bw,bL)|0;W=D;V=z;bS=(z|0)<0?-1:0;z=bp(V,bS,bw,bL)|0;bT=D;bU=bp(Y,bE,bw,bL)|0;bV=D;bW=bp($,bm,bw,bL)|0;bX=D;bY=bp(ac,a6,bw,bL)|0;bZ=D;b_=bp(af,aR,bw,bL)|0;b$=D;b0=bp(L,aj,bw,bL)|0;bL=D;bw=l;b1=(l|0)<0?-1:0;l=bp(e,N,bw,b1)|0;b2=D;b3=J;b4=(J|0)<0?-1:0;J=bp(P,Q,b3,b4)|0;b5=D;b6=bp(S,T,bw,b1)|0;T=D;S=y;b7=(y|0)<0?-1:0;y=bp(S,b7,b3,b4)|0;b8=D;b9=bp(V,bS,bw,b1)|0;ca=D;cb=bp(Y,bE,b3,b4)|0;cc=D;cd=bp($,bm,bw,b1)|0;ce=D;cf=bp(ac,a6,b3,b4)|0;cg=D;ch=bp(af,aR,bw,b1)|0;b1=D;bw=bp(L,aj,b3,b4)|0;b4=D;b3=m;ci=(m|0)<0?-1:0;m=bp(e,N,b3,ci)|0;cj=D;ck=bp(P,Q,b3,ci)|0;Q=D;P=x;cl=(x|0)<0?-1:0;x=bp(P,cl,b3,ci)|0;cm=D;cn=bp(S,b7,b3,ci)|0;co=D;cp=bp(V,bS,b3,ci)|0;cq=D;cr=bp(Y,bE,b3,ci)|0;cs=D;ct=bp($,bm,b3,ci)|0;cu=D;cv=bp(ac,a6,b3,ci)|0;cw=D;cx=bp(af,aR,b3,ci)|0;cy=D;cz=bp(L,aj,b3,ci)|0;ci=D;b3=n;cA=(n|0)<0?-1:0;n=bp(e,N,b3,cA)|0;N=D;e=K;cB=(K|0)<0?-1:0;K=bp(d,(d|0)<0?-1:0,e,cB)|0;d=D;cC=bp(P,cl,b3,cA)|0;cl=D;P=bp(S,b7,e,cB)|0;b7=D;S=bp(V,bS,b3,cA)|0;bS=D;V=bp(Y,bE,e,cB)|0;bE=D;Y=bp($,bm,b3,cA)|0;bm=D;$=bp(ac,a6,e,cB)|0;a6=D;ac=bp(af,aR,b3,cA)|0;cA=D;b3=bp(L,aj,e,cB)|0;cB=D;e=bf(K,d,b,O)|0;O=bf(e,D,x,cm)|0;cm=bf(O,D,y,b8)|0;b8=bf(cm,D,z,bT)|0;bT=bf(b8,D,A,bF)|0;bF=bf(bT,D,B,bn)|0;bn=bf(bF,D,C,a7)|0;a7=bf(bn,D,E,aS)|0;aS=bf(a7,D,F,ao)|0;ao=D;F=bf(o,R,f,am)|0;am=D;f=bf(H,aY,i,ba)|0;ba=bf(f,D,aG,aH)|0;aH=bf(ba,D,as,at)|0;at=bf(aH,D,r,_)|0;_=bf(at,D,V,bE)|0;bE=bf(_,D,ct,cu)|0;cu=bf(bE,D,cf,cg)|0;cg=bf(cu,D,b_,b$)|0;b$=bf(cg,D,aW,bx)|0;bx=D;aW=bf(aS,ao,33554432,0)|0;cg=D;b_=aW>>>26|cg<<6;aW=cg>>26|((cg|0)<0?-1:0)<<6;cg=bf(F,am,cC,cl)|0;cl=bf(cg,D,cn,co)|0;co=bf(cl,D,b9,ca)|0;ca=bf(co,D,bU,bV)|0;bV=bf(ca,D,bG,bH)|0;bH=bf(bV,D,bo,bq)|0;bq=bf(bH,D,a8,aU)|0;aU=bf(bq,D,aT,ai)|0;ai=bf(aU,D,b_,aW)|0;aU=D;aT=bg(aS,ao,b_<<26|0>>>6,aW<<26|b_>>>6)|0;b_=D;aW=bf(b$,bx,33554432,0)|0;ao=D;aS=aW>>>26|ao<<6;aW=ao>>26|((ao|0)<0?-1:0)<<6;ao=bf(bb,bc,j,bv)|0;bv=bf(ao,D,aZ,a_)|0;a_=bf(bv,D,aI,aJ)|0;aJ=bf(a_,D,au,av)|0;av=bf(aJ,D,s,ab)|0;ab=bf(av,D,Y,bm)|0;bm=bf(ab,D,cv,cw)|0;cw=bf(bm,D,ch,b1)|0;b1=bf(cw,D,b0,bL)|0;bL=bf(b1,D,aS,aW)|0;b1=D;b0=bg(b$,bx,aS<<26|0>>>6,aW<<26|aS>>>6)|0;aS=D;aW=bf(ai,aU,16777216,0)|0;bx=D;b$=aW>>>25|bx<<7;aW=bx>>25|((bx|0)<0?-1:0)<<7;bx=bf(G,ap,g,aD)|0;aD=bf(bx,D,p,U)|0;U=bf(aD,D,P,b7)|0;b7=bf(U,D,cp,cq)|0;cq=bf(b7,D,cb,cc)|0;cc=bf(cq,D,bW,bX)|0;bX=bf(cc,D,bI,bJ)|0;bJ=bf(bX,D,br,bs)|0;bs=bf(bJ,D,an,aX)|0;aX=bf(bs,D,b$,aW)|0;bs=D;an=bg(ai,aU,b$<<25|0>>>7,aW<<25|b$>>>7)|0;b$=D;aW=bf(bL,b1,16777216,0)|0;aU=D;ai=aW>>>25|aU<<7;aW=aU>>25|((aU|0)<0?-1:0)<<7;aU=bf(I,by,k,bM)|0;bM=bf(aU,D,bd,be)|0;be=bf(bM,D,a$,a0)|0;a0=bf(be,D,aK,aL)|0;aL=bf(a0,D,aw,ax)|0;ax=bf(aL,D,t,ae)|0;ae=bf(ax,D,$,a6)|0;a6=bf(ae,D,cx,cy)|0;cy=bf(a6,D,bw,b4)|0;b4=bf(cy,D,ai,aW)|0;cy=D;bw=bg(bL,b1,ai<<25|0>>>7,aW<<25|ai>>>7)|0;ai=D;aW=bf(aX,bs,33554432,0)|0;b1=D;bL=aW>>>26|b1<<6;aW=b1>>26|((b1|0)<0?-1:0)<<6;b1=bf(aE,aF,h,aV)|0;aV=bf(b1,D,aq,ar)|0;ar=bf(aV,D,q,X)|0;X=bf(ar,D,S,bS)|0;bS=bf(X,D,cr,cs)|0;cs=bf(bS,D,cd,ce)|0;ce=bf(cs,D,bY,bZ)|0;bZ=bf(ce,D,bK,bu)|0;bu=bf(bZ,D,bt,a9)|0;a9=bf(bu,D,bL,aW)|0;bu=D;bt=bg(aX,bs,bL<<26|0>>>6,aW<<26|bL>>>6)|0;bL=bf(b4,cy,33554432,0)|0;aW=D;bs=bL>>>26|aW<<6;bL=aW>>26|((aW|0)<0?-1:0)<<6;aW=bf(bN,bO,l,b2)|0;b2=bf(aW,D,bz,bA)|0;bA=bf(b2,D,bh,bi)|0;bi=bf(bA,D,a1,a2)|0;a2=bf(bi,D,aM,aN)|0;aN=bf(a2,D,ay,az)|0;az=bf(aN,D,u,ah)|0;ah=bf(az,D,ac,cA)|0;cA=bf(ah,D,cz,ci)|0;ci=bf(cA,D,bs,bL)|0;cA=D;cz=bg(b4,cy,bs<<26|0>>>6,bL<<26|bs>>>6)|0;bs=bf(a9,bu,16777216,0)|0;bL=D;cy=bs>>>25|bL<<7;bs=bL>>25|((bL|0)<0?-1:0)<<7;bL=bf(cy,bs,b0,aS)|0;aS=D;b0=bg(a9,bu,cy<<25|0>>>7,bs<<25|cy>>>7)|0;cy=bf(ci,cA,16777216,0)|0;bs=D;bu=cy>>>25|bs<<7;cy=bs>>25|((bs|0)<0?-1:0)<<7;bs=bf(J,b5,m,cj)|0;cj=bf(bs,D,bP,bQ)|0;bQ=bf(cj,D,bB,bC)|0;bC=bf(bQ,D,bj,bk)|0;bk=bf(bC,D,a3,a4)|0;a4=bf(bk,D,aO,aP)|0;aP=bf(a4,D,aA,aB)|0;aB=bf(aP,D,v,ak)|0;ak=bf(aB,D,b3,cB)|0;cB=bf(ak,D,bu,cy)|0;ak=D;b3=bg(ci,cA,bu<<25|0>>>7,cy<<25|bu>>>7)|0;bu=bf(bL,aS,33554432,0)|0;cy=D;cA=bu>>>26|cy<<6;bu=cy>>26|((cy|0)<0?-1:0)<<6;cy=bf(bw,ai,cA,bu)|0;ai=bg(bL,aS,cA<<26|0>>>6,bu<<26|cA>>>6)|0;cA=bf(cB,ak,33554432,0)|0;bu=D;aS=cA>>>26|bu<<6;cA=bu>>26|((bu|0)<0?-1:0)<<6;bu=bf(ck,Q,n,N)|0;N=bf(bu,D,b6,T)|0;T=bf(N,D,bR,W)|0;W=bf(T,D,bD,Z)|0;Z=bf(W,D,bl,aa)|0;aa=bf(Z,D,a5,ad)|0;ad=bf(aa,D,aQ,ag)|0;ag=bf(ad,D,aC,w)|0;w=bf(ag,D,al,M)|0;M=bf(w,D,aS,cA)|0;w=D;al=bg(cB,ak,aS<<26|0>>>6,cA<<26|aS>>>6)|0;aS=bf(M,w,16777216,0)|0;cA=D;ak=aS>>>25|cA<<7;aS=cA>>25|((cA|0)<0?-1:0)<<7;cA=bp(ak,aS,19,0)|0;cB=bf(cA,D,aT,b_)|0;b_=D;aT=bg(M,w,ak<<25|0>>>7,aS<<25|ak>>>7)|0;ak=bf(cB,b_,33554432,0)|0;aS=D;w=ak>>>26|aS<<6;ak=aS>>26|((aS|0)<0?-1:0)<<6;aS=bf(an,b$,w,ak)|0;b$=bg(cB,b_,w<<26|0>>>6,ak<<26|w>>>6)|0;c[a>>2]=b$;c[a+4>>2]=aS;c[a+8>>2]=bt;c[a+12>>2]=b0;c[a+16>>2]=ai;c[a+20>>2]=cy;c[a+24>>2]=cz;c[a+28>>2]=b3;c[a+32>>2]=al;c[a+36>>2]=aT;return}function aQ(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0,L=0,M=0,N=0,O=0,P=0,Q=0,R=0,S=0,T=0,U=0,V=0,W=0,X=0,Y=0,Z=0,_=0,$=0,aa=0,ab=0,ac=0,ad=0,ae=0,af=0,ag=0,ah=0,ai=0,aj=0,ak=0,al=0;d=i;i=i+152|0;e=d|0;f=e|0;g=c[b>>2]|0;h=g;j=(g|0)<0?-1:0;k=bp(h,j,h,j)|0;l=D;m=0>>>31|g<<1;n=g>>31|((g|0)<0?-1:0)<<1;g=0;o=c[b+8>>2]|0;p=o;q=(o|0)<0?-1:0;r=bp(p,q,m,n)|0;s=D;t=e+8|0;u=bp(p,q,p,q)|0;v=D;w=c[b+16>>2]|0;x=w;y=(w|0)<0?-1:0;w=bp(x,y,h,j)|0;z=bf(w,D,u,v)|0;v=D<<1|z>>>31;u=e+16|0;w=bp(x,y,p,q)|0;A=D;B=c[b+24>>2]|0;C=B;E=(B|0)<0?-1:0;B=bp(C,E,h,j)|0;F=bf(B,D,w,A)|0;A=D<<1|F>>>31;w=e+24|0;B=bp(x,y,x,y)|0;G=D;H=bp(C,E,g>>>30|o<<2,o>>30|((o|0)<0?-1:0)<<2)|0;I=bf(H,D,B,G)|0;G=D;B=c[b+32>>2]|0;H=B;J=(B|0)<0?-1:0;B=bp(H,J,m,n)|0;n=bf(I,G,B,D)|0;B=D;G=e+32|0;I=bp(C,E,x,y)|0;m=D;K=bp(H,J,p,q)|0;L=bf(K,D,I,m)|0;m=D;I=c[b+40>>2]|0;K=I;M=(I|0)<0?-1:0;N=bp(K,M,h,j)|0;O=bf(L,m,N,D)|0;N=D<<1|O>>>31;m=e+40|0;L=bp(C,E,C,E)|0;P=D;Q=bp(H,J,x,y)|0;R=bf(Q,D,L,P)|0;P=D;L=c[b+48>>2]|0;Q=L;S=(L|0)<0?-1:0;L=bp(Q,S,h,j)|0;T=bf(R,P,L,D)|0;L=D;P=bp(K,M,g>>>31|o<<1,o>>31|((o|0)<0?-1:0)<<1)|0;o=bf(T,L,P,D)|0;P=D<<1|o>>>31;L=e+48|0;T=bp(H,J,C,E)|0;g=D;R=bp(K,M,x,y)|0;U=bf(R,D,T,g)|0;g=D;T=bp(Q,S,p,q)|0;R=bf(U,g,T,D)|0;T=D;g=c[b+56>>2]|0;U=g;V=(g|0)<0?-1:0;W=bp(U,V,h,j)|0;X=bf(R,T,W,D)|0;W=D<<1|X>>>31;T=e+56|0;R=bp(H,J,H,J)|0;Y=D;Z=bp(Q,S,x,y)|0;_=D;$=c[b+64>>2]|0;aa=$;ab=($|0)<0?-1:0;ac=bp(aa,ab,h,j)|0;ad=bf(ac,D,Z,_)|0;_=D;Z=bp(U,V,p,q)|0;ac=D;ae=bp(K,M,C,E)|0;af=bf(ae,D,Z,ac)|0;ac=bf(ad,_,af<<1|0>>>31,D<<1|af>>>31)|0;af=bf(ac<<1|0>>>31,D<<1|ac>>>31,R,Y)|0;Y=D;R=e+64|0;ac=bp(K,M,H,J)|0;_=D;ad=bp(Q,S,C,E)|0;Z=bf(ad,D,ac,_)|0;_=D;ac=bp(U,V,x,y)|0;ad=bf(Z,_,ac,D)|0;ac=D;_=bp(aa,ab,p,q)|0;Z=bf(ad,ac,_,D)|0;_=D;ac=c[b+72>>2]|0;b=ac;ad=(ac|0)<0?-1:0;ae=bp(b,ad,h,j)|0;j=bf(Z,_,ae,D)|0;ae=e+72|0;c[ae>>2]=j<<1|0>>>31;c[ae+4>>2]=D<<1|j>>>31;j=bp(K,M,K,M)|0;ae=D;_=bp(Q,S,H,J)|0;Z=bf(_,D,j,ae)|0;ae=D;j=bp(aa,ab,x,y)|0;_=bf(Z,ae,j,D)|0;j=D;ae=bp(U,V,C,E)|0;Z=D;h=bp(b,ad,p,q)|0;q=bf(h,D,ae,Z)|0;Z=bf(_,j,q<<1|0>>>31,D<<1|q>>>31)|0;q=D;j=Z<<1|0>>>31;_=q<<1|Z>>>31;ae=e+80|0;c[ae>>2]=j;c[ae+4>>2]=_;ae=bp(Q,S,K,M)|0;h=D;p=bp(U,V,H,J)|0;ag=bf(p,D,ae,h)|0;h=D;ae=bp(aa,ab,C,E)|0;p=bf(ag,h,ae,D)|0;ae=D;h=bp(b,ad,x,y)|0;y=bf(p,ae,h,D)|0;h=D;ae=y<<1|0>>>31;p=h<<1|y>>>31;x=e+88|0;c[x>>2]=ae;c[x+4>>2]=p;x=bp(Q,S,Q,S)|0;ag=D;ah=bp(aa,ab,H,J)|0;ai=D;aj=bp(U,V,K,M)|0;ak=D;al=bp(b,ad,C,E)|0;E=bf(al,D,aj,ak)|0;ak=bf(E<<1|0>>>31,D<<1|E>>>31,ah,ai)|0;ai=bf(ak<<1|0>>>31,D<<1|ak>>>31,x,ag)|0;ag=D;x=e+96|0;c[x>>2]=ai;c[x+4>>2]=ag;x=bp(U,V,Q,S)|0;ak=D;ah=bp(aa,ab,K,M)|0;M=bf(ah,D,x,ak)|0;ak=D;x=bp(b,ad,H,J)|0;J=bf(M,ak,x,D)|0;x=D;ak=J<<1|0>>>31;M=x<<1|J>>>31;H=e+104|0;c[H>>2]=ak;c[H+4>>2]=M;H=bp(U,V,U,V)|0;ah=D;K=bp(aa,ab,Q,S)|0;E=bf(K,D,H,ah)|0;ah=D;H=bp(b,ad,0>>>31|I<<1,I>>31|((I|0)<0?-1:0)<<1)|0;I=bf(E,ah,H,D)|0;H=D;ah=I<<1|0>>>31;E=H<<1|I>>>31;K=e+112|0;c[K>>2]=ah;c[K+4>>2]=E;K=bp(aa,ab,U,V)|0;V=D;U=bp(b,ad,Q,S)|0;S=bf(U,D,K,V)|0;V=D;K=S<<1|0>>>31;U=V<<1|S>>>31;Q=e+120|0;c[Q>>2]=K;c[Q+4>>2]=U;Q=bp(aa,ab,aa,ab)|0;ab=D;aa=bp(b,ad,0>>>30|g<<2,g>>30|((g|0)<0?-1:0)<<2)|0;g=bf(aa,D,Q,ab)|0;ab=D;Q=e+128|0;c[Q>>2]=g;c[Q+4>>2]=ab;Q=bp(b,ad,0>>>31|$<<1,$>>31|(($|0)<0?-1:0)<<1)|0;$=D;aa=e+136|0;c[aa>>2]=Q;c[aa+4>>2]=$;aa=bp(0>>>31|ac<<1,ac>>31|((ac|0)<0?-1:0)<<1,b,ad)|0;ad=D;b=e+144|0;c[b>>2]=aa;c[b+4>>2]=ad;b=bp(aa,ad,18,0)|0;ac=D;aj=bf(aa,ad,af,Y)|0;Y=bf(aj,D,b,ac)|0;c[R>>2]=Y;c[R+4>>2]=D;R=bp(Q,$,18,0)|0;Y=D;ac=bf(X<<1|0>>>31,W,Q,$)|0;$=bf(ac,D,R,Y)|0;c[T>>2]=$;c[T+4>>2]=D;T=bp(g,ab,18,0)|0;$=D;Y=bf(o<<1|0>>>31,P,g,ab)|0;ab=bf(Y,D,T,$)|0;c[L>>2]=ab;c[L+4>>2]=D;L=bp(S,V,36,0)|0;V=D;S=bf(O<<1|0>>>31,N,K,U)|0;U=bf(S,D,L,V)|0;c[m>>2]=U;c[m+4>>2]=D;m=bp(I,H,36,0)|0;H=D;I=bf(n,B,ah,E)|0;E=bf(I,D,m,H)|0;c[G>>2]=E;c[G+4>>2]=D;G=bp(J,x,36,0)|0;x=D;J=bf(F<<1|0>>>31,A,ak,M)|0;M=bf(J,D,G,x)|0;c[w>>2]=M;c[w+4>>2]=D;w=bp(ai,ag,18,0)|0;M=D;x=bf(z<<1|0>>>31,v,ai,ag)|0;ag=bf(x,D,w,M)|0;c[u>>2]=ag;c[u+4>>2]=D;u=bp(y,h,36,0)|0;h=D;y=bf(r,s,ae,p)|0;p=bf(y,D,u,h)|0;c[t>>2]=p;c[t+4>>2]=D;t=bp(Z,q,36,0)|0;q=D;Z=bf(k,l,j,_)|0;_=bf(Z,D,t,q)|0;c[f>>2]=_;c[f+4>>2]=D;aN(f);bb(a|0,e|0,80);i=d;return}function aR(a,b){a=a|0;b=b|0;var c=0,d=0,e=0,f=0,g=0;c=i;i=i+160|0;d=c|0;aS(d,b);e=c+40|0;aS(e,d);aS(e,e);aP(e,b,e);aP(d,d,e);b=c+80|0;aS(b,d);aP(e,e,b);aS(b,e);aS(b,b);aS(b,b);aS(b,b);aS(b,b);aP(e,b,e);aS(b,e);aS(b,b);aS(b,b);aS(b,b);aS(b,b);aS(b,b);aS(b,b);aS(b,b);aS(b,b);aS(b,b);aP(b,b,e);f=c+120|0;aS(f,b);aS(f,f);aS(f,f);aS(f,f);aS(f,f);aS(f,f);aS(f,f);aS(f,f);aS(f,f);aS(f,f);aS(f,f);aS(f,f);aS(f,f);aS(f,f);aS(f,f);aS(f,f);aS(f,f);aS(f,f);aS(f,f);aS(f,f);aP(b,f,b);aS(b,b);aS(b,b);aS(b,b);aS(b,b);aS(b,b);aS(b,b);aS(b,b);aS(b,b);aS(b,b);aS(b,b);aP(e,b,e);aS(b,e);g=1;do{aS(b,b);g=g+1|0;}while((g|0)<50);aP(b,b,e);aS(f,b);g=1;do{aS(f,f);g=g+1|0;}while((g|0)<100);aP(b,f,b);aS(b,b);f=1;do{aS(b,b);f=f+1|0;}while((f|0)<50);aP(e,b,e);aS(e,e);aS(e,e);aS(e,e);aS(e,e);aS(e,e);aP(a,e,d);i=c;return}function aS(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0,L=0,M=0,N=0,O=0,P=0,Q=0,R=0,S=0,T=0,U=0,V=0,W=0,X=0,Y=0,Z=0,_=0,$=0,aa=0,ab=0,ac=0,ad=0,ae=0,af=0,ag=0,ah=0,ai=0,aj=0,ak=0,al=0,am=0,an=0,ao=0,ap=0,aq=0,ar=0,as=0,at=0,au=0,av=0,aw=0,ax=0,ay=0,az=0,aA=0,aB=0,aC=0,aD=0,aE=0,aF=0,aG=0,aH=0,aI=0,aJ=0,aK=0,aL=0,aM=0,aN=0,aO=0,aP=0,aQ=0,aR=0,aS=0,aT=0,aU=0,aV=0,aW=0,aX=0,aY=0,aZ=0,a_=0,a$=0,a0=0,a1=0,a2=0,a3=0,a4=0,a5=0,a6=0,a7=0;d=c[b>>2]|0;e=c[b+4>>2]|0;f=c[b+8>>2]|0;g=c[b+12>>2]|0;h=c[b+16>>2]|0;i=c[b+20>>2]|0;j=c[b+24>>2]|0;k=c[b+28>>2]|0;l=c[b+32>>2]|0;m=c[b+36>>2]|0;b=d<<1;n=e<<1;o=f<<1;p=g<<1;q=h<<1;r=i<<1;s=j<<1;t=k<<1;u=i*38&-1;v=j*19&-1;w=k*38&-1;x=l*19&-1;y=m*38&-1;z=d;A=(d|0)<0?-1:0;d=bp(z,A,z,A)|0;A=D;z=b;B=(b|0)<0?-1:0;b=e;C=(e|0)<0?-1:0;e=bp(z,B,b,C)|0;E=D;F=f;G=(f|0)<0?-1:0;f=bp(F,G,z,B)|0;H=D;I=g;J=(g|0)<0?-1:0;g=bp(I,J,z,B)|0;K=D;L=h;M=(h|0)<0?-1:0;h=bp(L,M,z,B)|0;N=D;O=i;P=(i|0)<0?-1:0;i=bp(O,P,z,B)|0;Q=D;R=j;S=(j|0)<0?-1:0;j=bp(R,S,z,B)|0;T=D;U=k;V=(k|0)<0?-1:0;k=bp(U,V,z,B)|0;W=D;X=l;Y=(l|0)<0?-1:0;l=bp(X,Y,z,B)|0;Z=D;_=m;$=(m|0)<0?-1:0;m=bp(_,$,z,B)|0;B=D;z=n;aa=(n|0)<0?-1:0;n=bp(z,aa,b,C)|0;C=D;b=bp(z,aa,F,G)|0;ab=D;ac=p;ad=(p|0)<0?-1:0;p=bp(ac,ad,z,aa)|0;ae=D;af=bp(L,M,z,aa)|0;ag=D;ah=r;ai=(r|0)<0?-1:0;r=bp(ah,ai,z,aa)|0;aj=D;ak=bp(R,S,z,aa)|0;al=D;am=t;an=(t|0)<0?-1:0;t=bp(am,an,z,aa)|0;ao=D;ap=bp(X,Y,z,aa)|0;aq=D;ar=y;as=(y|0)<0?-1:0;y=bp(ar,as,z,aa)|0;aa=D;z=bp(F,G,F,G)|0;at=D;au=o;av=(o|0)<0?-1:0;o=bp(au,av,I,J)|0;aw=D;ax=bp(L,M,au,av)|0;ay=D;az=bp(O,P,au,av)|0;aA=D;aB=bp(R,S,au,av)|0;aC=D;aD=bp(U,V,au,av)|0;aE=D;aF=x;aG=(x|0)<0?-1:0;x=bp(aF,aG,au,av)|0;av=D;au=bp(ar,as,F,G)|0;G=D;F=bp(ac,ad,I,J)|0;J=D;I=bp(ac,ad,L,M)|0;aH=D;aI=bp(ah,ai,ac,ad)|0;aJ=D;aK=bp(R,S,ac,ad)|0;aL=D;aM=w;aN=(w|0)<0?-1:0;w=bp(aM,aN,ac,ad)|0;aO=D;aP=bp(aF,aG,ac,ad)|0;aQ=D;aR=bp(ar,as,ac,ad)|0;ad=D;ac=bp(L,M,L,M)|0;aS=D;aT=q;aU=(q|0)<0?-1:0;q=bp(aT,aU,O,P)|0;aV=D;aW=v;aX=(v|0)<0?-1:0;v=bp(aW,aX,aT,aU)|0;aY=D;aZ=bp(aM,aN,L,M)|0;a_=D;a$=bp(aF,aG,aT,aU)|0;aU=D;aT=bp(ar,as,L,M)|0;M=D;L=bp(u,(u|0)<0?-1:0,O,P)|0;P=D;O=bp(aW,aX,ah,ai)|0;u=D;a0=bp(aM,aN,ah,ai)|0;a1=D;a2=bp(aF,aG,ah,ai)|0;a3=D;a4=bp(ar,as,ah,ai)|0;ai=D;ah=bp(aW,aX,R,S)|0;aX=D;aW=bp(aM,aN,R,S)|0;a5=D;a6=bp(aF,aG,s,(s|0)<0?-1:0)|0;s=D;a7=bp(ar,as,R,S)|0;S=D;R=bp(aM,aN,U,V)|0;V=D;U=bp(aF,aG,am,an)|0;aN=D;aM=bp(ar,as,am,an)|0;an=D;am=bp(aF,aG,X,Y)|0;aG=D;aF=bp(ar,as,X,Y)|0;Y=D;X=bp(ar,as,_,$)|0;$=D;_=bf(L,P,d,A)|0;A=bf(_,D,v,aY)|0;aY=bf(A,D,w,aO)|0;aO=bf(aY,D,x,av)|0;av=bf(aO,D,y,aa)|0;aa=D;y=bf(f,H,n,C)|0;C=D;n=bf(g,K,b,ab)|0;ab=D;b=bf(p,ae,z,at)|0;at=bf(b,D,h,N)|0;N=bf(at,D,R,V)|0;V=bf(N,D,a6,s)|0;s=bf(V,D,a4,ai)|0;ai=D;a4=bf(av,aa,33554432,0)|0;V=D;a6=a4>>>26|V<<6;a4=V>>26|((V|0)<0?-1:0)<<6;V=bf(O,u,e,E)|0;E=bf(V,D,aZ,a_)|0;a_=bf(E,D,aP,aQ)|0;aQ=bf(a_,D,au,G)|0;G=bf(aQ,D,a6,a4)|0;aQ=D;au=bg(av,aa,a6<<26|0>>>6,a4<<26|a6>>>6)|0;a6=D;a4=bf(s,ai,33554432,0)|0;aa=D;av=a4>>>26|aa<<6;a4=aa>>26|((aa|0)<0?-1:0)<<6;aa=bf(af,ag,o,aw)|0;aw=bf(aa,D,i,Q)|0;Q=bf(aw,D,U,aN)|0;aN=bf(Q,D,a7,S)|0;S=bf(aN,D,av,a4)|0;aN=D;a7=bg(s,ai,av<<26|0>>>6,a4<<26|av>>>6)|0;av=D;a4=bf(G,aQ,16777216,0)|0;ai=D;s=a4>>>25|ai<<7;a4=ai>>25|((ai|0)<0?-1:0)<<7;ai=bf(y,C,ah,aX)|0;aX=bf(ai,D,a0,a1)|0;a1=bf(aX,D,a$,aU)|0;aU=bf(a1,D,aR,ad)|0;ad=bf(aU,D,s,a4)|0;aU=D;aR=bg(G,aQ,s<<25|0>>>7,a4<<25|s>>>7)|0;s=D;a4=bf(S,aN,16777216,0)|0;aQ=D;G=a4>>>25|aQ<<7;a4=aQ>>25|((aQ|0)<0?-1:0)<<7;aQ=bf(F,J,ax,ay)|0;ay=bf(aQ,D,r,aj)|0;aj=bf(ay,D,j,T)|0;T=bf(aj,D,am,aG)|0;aG=bf(T,D,aM,an)|0;an=bf(aG,D,G,a4)|0;aG=D;aM=bg(S,aN,G<<25|0>>>7,a4<<25|G>>>7)|0;G=D;a4=bf(ad,aU,33554432,0)|0;aN=D;S=a4>>>26|aN<<6;a4=aN>>26|((aN|0)<0?-1:0)<<6;aN=bf(n,ab,aW,a5)|0;a5=bf(aN,D,a2,a3)|0;a3=bf(a5,D,aT,M)|0;M=bf(a3,D,S,a4)|0;a3=D;aT=bg(ad,aU,S<<26|0>>>6,a4<<26|S>>>6)|0;S=bf(an,aG,33554432,0)|0;a4=D;aU=S>>>26|a4<<6;S=a4>>26|((a4|0)<0?-1:0)<<6;a4=bf(az,aA,I,aH)|0;aH=bf(a4,D,ak,al)|0;al=bf(aH,D,k,W)|0;W=bf(al,D,aF,Y)|0;Y=bf(W,D,aU,S)|0;W=D;aF=bg(an,aG,aU<<26|0>>>6,S<<26|aU>>>6)|0;aU=bf(M,a3,16777216,0)|0;S=D;aG=aU>>>25|S<<7;aU=S>>25|((S|0)<0?-1:0)<<7;S=bf(aG,aU,a7,av)|0;av=D;a7=bg(M,a3,aG<<25|0>>>7,aU<<25|aG>>>7)|0;aG=bf(Y,W,16777216,0)|0;aU=D;a3=aG>>>25|aU<<7;aG=aU>>25|((aU|0)<0?-1:0)<<7;aU=bf(aB,aC,ac,aS)|0;aS=bf(aU,D,aI,aJ)|0;aJ=bf(aS,D,t,ao)|0;ao=bf(aJ,D,l,Z)|0;Z=bf(ao,D,X,$)|0;$=bf(Z,D,a3,aG)|0;Z=D;X=bg(Y,W,a3<<25|0>>>7,aG<<25|a3>>>7)|0;a3=bf(S,av,33554432,0)|0;aG=D;W=a3>>>26|aG<<6;a3=aG>>26|((aG|0)<0?-1:0)<<6;aG=bf(aM,G,W,a3)|0;G=bg(S,av,W<<26|0>>>6,a3<<26|W>>>6)|0;W=bf($,Z,33554432,0)|0;a3=D;av=W>>>26|a3<<6;W=a3>>26|((a3|0)<0?-1:0)<<6;a3=bf(aK,aL,q,aV)|0;aV=bf(a3,D,aD,aE)|0;aE=bf(aV,D,ap,aq)|0;aq=bf(aE,D,m,B)|0;B=bf(aq,D,av,W)|0;aq=D;m=bg($,Z,av<<26|0>>>6,W<<26|av>>>6)|0;av=bf(B,aq,16777216,0)|0;W=D;Z=av>>>25|W<<7;av=W>>25|((W|0)<0?-1:0)<<7;W=bp(Z,av,19,0)|0;$=bf(W,D,au,a6)|0;a6=D;au=bg(B,aq,Z<<25|0>>>7,av<<25|Z>>>7)|0;Z=bf($,a6,33554432,0)|0;av=D;aq=Z>>>26|av<<6;Z=av>>26|((av|0)<0?-1:0)<<6;av=bf(aR,s,aq,Z)|0;s=bg($,a6,aq<<26|0>>>6,Z<<26|aq>>>6)|0;c[a>>2]=s;c[a+4>>2]=av;c[a+8>>2]=aT;c[a+12>>2]=a7;c[a+16>>2]=G;c[a+20>>2]=aG;c[a+24>>2]=aF;c[a+28>>2]=X;c[a+32>>2]=m;c[a+36>>2]=au;return}function aT(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0,L=0,M=0,N=0,O=0,P=0,Q=0,R=0,S=0,T=0,U=0,V=0,W=0,X=0,Y=0,Z=0,_=0,$=0,aa=0,ab=0,ac=0,ad=0,ae=0,af=0,ag=0,ah=0,ai=0,aj=0,ak=0,al=0,am=0,an=0,ao=0,ap=0,aq=0,ar=0,as=0,at=0,au=0,av=0,aw=0,ax=0,ay=0,az=0,aA=0,aB=0,aC=0,aD=0,aE=0,aF=0,aG=0,aH=0,aI=0,aJ=0,aK=0,aL=0,aM=0,aN=0,aO=0,aP=0,aQ=0,aR=0,aS=0,aT=0,aU=0,aV=0,aW=0,aX=0,aY=0,aZ=0,a_=0,a$=0,a0=0,a1=0,a2=0,a3=0,a4=0,a5=0,a6=0,a7=0;d=c[b>>2]|0;e=c[b+4>>2]|0;f=c[b+8>>2]|0;g=c[b+12>>2]|0;h=c[b+16>>2]|0;i=c[b+20>>2]|0;j=c[b+24>>2]|0;k=c[b+28>>2]|0;l=c[b+32>>2]|0;m=c[b+36>>2]|0;b=d<<1;n=e<<1;o=f<<1;p=g<<1;q=h<<1;r=i<<1;s=j<<1;t=k<<1;u=i*38&-1;v=j*19&-1;w=k*38&-1;x=l*19&-1;y=m*38&-1;z=d;A=(d|0)<0?-1:0;d=bp(z,A,z,A)|0;A=D;z=b;B=(b|0)<0?-1:0;b=e;C=(e|0)<0?-1:0;e=bp(z,B,b,C)|0;E=D;F=f;G=(f|0)<0?-1:0;f=bp(F,G,z,B)|0;H=D;I=g;J=(g|0)<0?-1:0;g=bp(I,J,z,B)|0;K=D;L=h;M=(h|0)<0?-1:0;h=bp(L,M,z,B)|0;N=D;O=i;P=(i|0)<0?-1:0;i=bp(O,P,z,B)|0;Q=D;R=j;S=(j|0)<0?-1:0;j=bp(R,S,z,B)|0;T=D;U=k;V=(k|0)<0?-1:0;k=bp(U,V,z,B)|0;W=D;X=l;Y=(l|0)<0?-1:0;l=bp(X,Y,z,B)|0;Z=D;_=m;$=(m|0)<0?-1:0;m=bp(_,$,z,B)|0;B=D;z=n;aa=(n|0)<0?-1:0;n=bp(z,aa,b,C)|0;C=D;b=bp(z,aa,F,G)|0;ab=D;ac=p;ad=(p|0)<0?-1:0;p=bp(ac,ad,z,aa)|0;ae=D;af=bp(L,M,z,aa)|0;ag=D;ah=r;ai=(r|0)<0?-1:0;r=bp(ah,ai,z,aa)|0;aj=D;ak=bp(R,S,z,aa)|0;al=D;am=t;an=(t|0)<0?-1:0;t=bp(am,an,z,aa)|0;ao=D;ap=bp(X,Y,z,aa)|0;aq=D;ar=y;as=(y|0)<0?-1:0;y=bp(ar,as,z,aa)|0;aa=D;z=bp(F,G,F,G)|0;at=D;au=o;av=(o|0)<0?-1:0;o=bp(au,av,I,J)|0;aw=D;ax=bp(L,M,au,av)|0;ay=D;az=bp(O,P,au,av)|0;aA=D;aB=bp(R,S,au,av)|0;aC=D;aD=bp(U,V,au,av)|0;aE=D;aF=x;aG=(x|0)<0?-1:0;x=bp(aF,aG,au,av)|0;av=D;au=bp(ar,as,F,G)|0;G=D;F=bp(ac,ad,I,J)|0;J=D;I=bp(ac,ad,L,M)|0;aH=D;aI=bp(ah,ai,ac,ad)|0;aJ=D;aK=bp(R,S,ac,ad)|0;aL=D;aM=w;aN=(w|0)<0?-1:0;w=bp(aM,aN,ac,ad)|0;aO=D;aP=bp(aF,aG,ac,ad)|0;aQ=D;aR=bp(ar,as,ac,ad)|0;ad=D;ac=bp(L,M,L,M)|0;aS=D;aT=q;aU=(q|0)<0?-1:0;q=bp(aT,aU,O,P)|0;aV=D;aW=v;aX=(v|0)<0?-1:0;v=bp(aW,aX,aT,aU)|0;aY=D;aZ=bp(aM,aN,L,M)|0;a_=D;a$=bp(aF,aG,aT,aU)|0;aU=D;aT=bp(ar,as,L,M)|0;M=D;L=bp(u,(u|0)<0?-1:0,O,P)|0;P=D;O=bp(aW,aX,ah,ai)|0;u=D;a0=bp(aM,aN,ah,ai)|0;a1=D;a2=bp(aF,aG,ah,ai)|0;a3=D;a4=bp(ar,as,ah,ai)|0;ai=D;ah=bp(aW,aX,R,S)|0;aX=D;aW=bp(aM,aN,R,S)|0;a5=D;a6=bp(aF,aG,s,(s|0)<0?-1:0)|0;s=D;a7=bp(ar,as,R,S)|0;S=D;R=bp(aM,aN,U,V)|0;V=D;U=bp(aF,aG,am,an)|0;aN=D;aM=bp(ar,as,am,an)|0;an=D;am=bp(aF,aG,X,Y)|0;aG=D;aF=bp(ar,as,X,Y)|0;Y=D;X=bp(ar,as,_,$)|0;$=D;_=bf(L,P,d,A)|0;A=bf(_,D,v,aY)|0;aY=bf(A,D,w,aO)|0;aO=bf(aY,D,x,av)|0;av=bf(aO,D,y,aa)|0;aa=D;y=bf(O,u,e,E)|0;E=bf(y,D,aZ,a_)|0;a_=bf(E,D,aP,aQ)|0;aQ=bf(a_,D,au,G)|0;G=D;au=bf(f,H,n,C)|0;C=bf(au,D,ah,aX)|0;aX=bf(C,D,a0,a1)|0;a1=bf(aX,D,a$,aU)|0;aU=bf(a1,D,aR,ad)|0;ad=D;aR=bf(g,K,b,ab)|0;ab=bf(aR,D,aW,a5)|0;a5=bf(ab,D,a2,a3)|0;a3=bf(a5,D,aT,M)|0;M=D;aT=bf(p,ae,z,at)|0;at=bf(aT,D,h,N)|0;N=bf(at,D,R,V)|0;V=bf(N,D,a6,s)|0;s=bf(V,D,a4,ai)|0;ai=D;a4=bf(af,ag,o,aw)|0;aw=bf(a4,D,i,Q)|0;Q=bf(aw,D,U,aN)|0;aN=bf(Q,D,a7,S)|0;S=D;a7=bf(F,J,ax,ay)|0;ay=bf(a7,D,r,aj)|0;aj=bf(ay,D,j,T)|0;T=bf(aj,D,am,aG)|0;aG=bf(T,D,aM,an)|0;an=D;aM=bf(az,aA,I,aH)|0;aH=bf(aM,D,ak,al)|0;al=bf(aH,D,k,W)|0;W=bf(al,D,aF,Y)|0;Y=D;aF=bf(aB,aC,ac,aS)|0;aS=bf(aF,D,aI,aJ)|0;aJ=bf(aS,D,t,ao)|0;ao=bf(aJ,D,l,Z)|0;Z=bf(ao,D,X,$)|0;$=D;X=bf(aK,aL,q,aV)|0;aV=bf(X,D,aD,aE)|0;aE=bf(aV,D,ap,aq)|0;aq=bf(aE,D,m,B)|0;B=av<<1|0>>>31;m=aa<<1|av>>>31;av=s<<1|0>>>31;aa=ai<<1|s>>>31;s=D<<1|aq>>>31;ai=bf(B,m,33554432,0)|0;aE=D;ap=ai>>>26|aE<<6;ai=aE>>26|((aE|0)<0?-1:0)<<6;aE=bf(ap,ai,aQ<<1|0>>>31,G<<1|aQ>>>31)|0;aQ=D;G=bg(B,m,ap<<26|0>>>6,ai<<26|ap>>>6)|0;ap=D;ai=bf(av,aa,33554432,0)|0;m=D;B=ai>>>26|m<<6;ai=m>>26|((m|0)<0?-1:0)<<6;m=bf(B,ai,aN<<1|0>>>31,S<<1|aN>>>31)|0;aN=D;S=bg(av,aa,B<<26|0>>>6,ai<<26|B>>>6)|0;B=D;ai=bf(aE,aQ,16777216,0)|0;aa=D;av=ai>>>25|aa<<7;ai=aa>>25|((aa|0)<0?-1:0)<<7;aa=bf(av,ai,aU<<1|0>>>31,ad<<1|aU>>>31)|0;aU=D;ad=bg(aE,aQ,av<<25|0>>>7,ai<<25|av>>>7)|0;av=D;ai=bf(m,aN,16777216,0)|0;aQ=D;aE=ai>>>25|aQ<<7;ai=aQ>>25|((aQ|0)<0?-1:0)<<7;aQ=bf(aE,ai,aG<<1|0>>>31,an<<1|aG>>>31)|0;aG=D;an=bg(m,aN,aE<<25|0>>>7,ai<<25|aE>>>7)|0;aE=D;ai=bf(aa,aU,33554432,0)|0;aN=D;m=ai>>>26|aN<<6;ai=aN>>26|((aN|0)<0?-1:0)<<6;aN=bf(m,ai,a3<<1|0>>>31,M<<1|a3>>>31)|0;a3=D;M=bg(aa,aU,m<<26|0>>>6,ai<<26|m>>>6)|0;m=bf(aQ,aG,33554432,0)|0;ai=D;aU=m>>>26|ai<<6;m=ai>>26|((ai|0)<0?-1:0)<<6;ai=bf(aU,m,W<<1|0>>>31,Y<<1|W>>>31)|0;W=D;Y=bg(aQ,aG,aU<<26|0>>>6,m<<26|aU>>>6)|0;aU=bf(aN,a3,16777216,0)|0;m=D;aG=aU>>>25|m<<7;aU=m>>25|((m|0)<0?-1:0)<<7;m=bf(aG,aU,S,B)|0;B=D;S=bg(aN,a3,aG<<25|0>>>7,aU<<25|aG>>>7)|0;aG=bf(ai,W,16777216,0)|0;aU=D;a3=aG>>>25|aU<<7;aG=aU>>25|((aU|0)<0?-1:0)<<7;aU=bf(a3,aG,Z<<1|0>>>31,$<<1|Z>>>31)|0;Z=D;$=bg(ai,W,a3<<25|0>>>7,aG<<25|a3>>>7)|0;a3=bf(m,B,33554432,0)|0;aG=D;W=a3>>>26|aG<<6;a3=aG>>26|((aG|0)<0?-1:0)<<6;aG=bf(an,aE,W,a3)|0;aE=bg(m,B,W<<26|0>>>6,a3<<26|W>>>6)|0;W=bf(aU,Z,33554432,0)|0;a3=D;B=W>>>26|a3<<6;W=a3>>26|((a3|0)<0?-1:0)<<6;a3=bf(B,W,aq<<1|0>>>31,s)|0;s=D;aq=bg(aU,Z,B<<26|0>>>6,W<<26|B>>>6)|0;B=bf(a3,s,16777216,0)|0;W=D;Z=B>>>25|W<<7;B=W>>25|((W|0)<0?-1:0)<<7;W=bp(Z,B,19,0)|0;aU=bf(W,D,G,ap)|0;ap=D;G=bg(a3,s,Z<<25|0>>>7,B<<25|Z>>>7)|0;Z=bf(aU,ap,33554432,0)|0;B=D;s=Z>>>26|B<<6;Z=B>>26|((B|0)<0?-1:0)<<6;B=bf(ad,av,s,Z)|0;av=bg(aU,ap,s<<26|0>>>6,Z<<26|s>>>6)|0;c[a>>2]=av;c[a+4>>2]=B;c[a+8>>2]=M;c[a+12>>2]=S;c[a+16>>2]=aE;c[a+20>>2]=aG;c[a+24>>2]=Y;c[a+28>>2]=$;c[a+32>>2]=aq;c[a+36>>2]=G;return}function aU(b,d){b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0;e=c[d>>2]|0;f=c[d+4>>2]|0;g=c[d+8>>2]|0;h=c[d+12>>2]|0;i=c[d+16>>2]|0;j=c[d+20>>2]|0;k=c[d+24>>2]|0;l=c[d+28>>2]|0;m=c[d+32>>2]|0;n=c[d+36>>2]|0;d=(((((((((((((n*19&-1)+16777216>>25)+e>>26)+f>>25)+g>>26)+h>>25)+i>>26)+j>>25)+k>>26)+l>>25)+m>>26)+n>>25)*19&-1)+e|0;e=d>>26;o=e+f|0;f=d-(e<<26)|0;e=o>>25;d=e+g|0;g=o-(e<<25)|0;e=d>>26;o=e+h|0;h=d-(e<<26)|0;e=o>>25;d=e+i|0;i=o-(e<<25)|0;e=d>>26;o=e+j|0;j=d-(e<<26)|0;e=o>>25;d=e+k|0;k=o-(e<<25)|0;e=d>>26;o=e+l|0;l=d-(e<<26)|0;e=o>>25;d=e+m|0;m=o-(e<<25)|0;e=d>>26;o=e+n|0;n=d-(e<<26)|0;e=o&33554431;a[b]=f&255;a[b+1|0]=f>>>8&255;a[b+2|0]=f>>>16&255;a[b+3|0]=(g<<2|f>>>24)&255;a[b+4|0]=g>>>6&255;a[b+5|0]=g>>>14&255;a[b+6|0]=(h<<3|g>>>22)&255;a[b+7|0]=h>>>5&255;a[b+8|0]=h>>>13&255;a[b+9|0]=(i<<5|h>>>21)&255;a[b+10|0]=i>>>3&255;a[b+11|0]=i>>>11&255;a[b+12|0]=(j<<6|i>>>19)&255;a[b+13|0]=j>>>2&255;a[b+14|0]=j>>>10&255;a[b+15|0]=j>>>18&255;a[b+16|0]=k&255;a[b+17|0]=k>>>8&255;a[b+18|0]=k>>>16&255;a[b+19|0]=(l<<1|k>>>24)&255;a[b+20|0]=l>>>7&255;a[b+21|0]=l>>>15&255;a[b+22|0]=(m<<3|l>>>23)&255;a[b+23|0]=m>>>5&255;a[b+24|0]=m>>>13&255;a[b+25|0]=(n<<4|m>>>21)&255;a[b+26|0]=n>>>4&255;a[b+27|0]=n>>>12&255;a[b+28|0]=(n>>>20|e<<6)&255;a[b+29|0]=o>>>2&255;a[b+30|0]=o>>>10&255;a[b+31|0]=e>>>18&255;return}function aV(a,b){a=a|0;b=b|0;var c=0,d=0,e=0,f=0,g=0;c=i;i=i+120|0;d=c|0;aS(d,b);e=c+40|0;aS(e,d);aS(e,e);aP(e,b,e);aP(d,d,e);aS(d,d);aP(d,e,d);aS(e,d);aS(e,e);aS(e,e);aS(e,e);aS(e,e);aP(d,e,d);aS(e,d);aS(e,e);aS(e,e);aS(e,e);aS(e,e);aS(e,e);aS(e,e);aS(e,e);aS(e,e);aS(e,e);aP(e,e,d);f=c+80|0;aS(f,e);aS(f,f);aS(f,f);aS(f,f);aS(f,f);aS(f,f);aS(f,f);aS(f,f);aS(f,f);aS(f,f);aS(f,f);aS(f,f);aS(f,f);aS(f,f);aS(f,f);aS(f,f);aS(f,f);aS(f,f);aS(f,f);aS(f,f);aP(e,f,e);aS(e,e);aS(e,e);aS(e,e);aS(e,e);aS(e,e);aS(e,e);aS(e,e);aS(e,e);aS(e,e);aS(e,e);aP(d,e,d);aS(e,d);g=1;do{aS(e,e);g=g+1|0;}while((g|0)<50);aP(e,e,d);aS(f,e);g=1;do{aS(f,f);g=g+1|0;}while((g|0)<100);aP(e,f,e);aS(e,e);f=1;do{aS(e,e);f=f+1|0;}while((f|0)<50);aP(d,e,d);aS(d,d);aS(d,d);aP(a,d,b);i=c;return}function aW(b,c){b=b|0;c=c|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0;e=0;while(1){a[b+e|0]=(d[c+(e>>3)|0]|0)>>>((e&7)>>>0)&1;f=e+1|0;if((f|0)<256){e=f}else{g=0;break}}do{e=b+g|0;L118:do{if((a[e]|0)!=0){c=1;do{f=c+g|0;if((f|0)>=256){break L118}h=b+f|0;i=a[h]|0;L122:do{if(i<<24>>24!=0){j=a[e]|0;k=i<<24>>24<<c;l=j+k|0;if((l|0)<16){a[e]=l&255;a[h]=0;break}l=j-k|0;if((l|0)<=-16){break L118}a[e]=l&255;l=f;while(1){m=b+l|0;if((a[m]|0)==0){break}a[m]=0;l=l+1|0;if((l|0)>=256){break L122}}a[m]=1}}while(0);c=c+1|0;}while((c|0)<7)}}while(0);g=g+1|0;}while((g|0)<256);return}function aX(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0,L=0,M=0,N=0,O=0,P=0,Q=0,R=0,S=0,T=0,U=0,V=0,W=0,X=0,Y=0,Z=0,_=0,$=0,aa=0,ab=0,ac=0,ad=0,ae=0,af=0,ag=0,ah=0,ai=0;e=a|0;f=b+40|0;g=b|0;h=b+44|0;i=b+48|0;j=b+52|0;k=b+56|0;l=b+60|0;m=b+64|0;n=b+68|0;o=b+72|0;p=b+76|0;q=b+4|0;r=b+8|0;s=b+12|0;t=b+16|0;u=b+20|0;v=b+24|0;w=b+28|0;x=b+32|0;y=b+36|0;z=(c[q>>2]|0)+(c[h>>2]|0)|0;A=(c[r>>2]|0)+(c[i>>2]|0)|0;B=(c[s>>2]|0)+(c[j>>2]|0)|0;C=(c[t>>2]|0)+(c[k>>2]|0)|0;D=(c[u>>2]|0)+(c[l>>2]|0)|0;E=(c[v>>2]|0)+(c[m>>2]|0)|0;F=(c[w>>2]|0)+(c[n>>2]|0)|0;G=(c[x>>2]|0)+(c[o>>2]|0)|0;H=(c[y>>2]|0)+(c[p>>2]|0)|0;c[e>>2]=(c[g>>2]|0)+(c[f>>2]|0);I=a+4|0;c[I>>2]=z;z=a+8|0;c[z>>2]=A;A=a+12|0;c[A>>2]=B;B=a+16|0;c[B>>2]=C;C=a+20|0;c[C>>2]=D;D=a+24|0;c[D>>2]=E;E=a+28|0;c[E>>2]=F;F=a+32|0;c[F>>2]=G;G=a+36|0;c[G>>2]=H;H=a+40|0;J=(c[h>>2]|0)-(c[q>>2]|0)|0;q=(c[i>>2]|0)-(c[r>>2]|0)|0;r=(c[j>>2]|0)-(c[s>>2]|0)|0;s=(c[k>>2]|0)-(c[t>>2]|0)|0;t=(c[l>>2]|0)-(c[u>>2]|0)|0;u=(c[m>>2]|0)-(c[v>>2]|0)|0;v=(c[n>>2]|0)-(c[w>>2]|0)|0;w=(c[o>>2]|0)-(c[x>>2]|0)|0;x=(c[p>>2]|0)-(c[y>>2]|0)|0;c[H>>2]=(c[f>>2]|0)-(c[g>>2]|0);g=a+44|0;c[g>>2]=J;J=a+48|0;c[J>>2]=q;q=a+52|0;c[q>>2]=r;r=a+56|0;c[r>>2]=s;s=a+60|0;c[s>>2]=t;t=a+64|0;c[t>>2]=u;u=a+68|0;c[u>>2]=v;v=a+72|0;c[v>>2]=w;w=a+76|0;c[w>>2]=x;x=a+80|0;aP(x,e,d|0);aP(H,H,d+40|0);f=a+120|0;aP(f,d+120|0,b+120|0);aP(e,b+80|0,d+80|0);d=c[e>>2]<<1;b=c[I>>2]<<1;y=c[z>>2]<<1;p=c[A>>2]<<1;o=c[B>>2]<<1;n=c[C>>2]<<1;m=c[D>>2]<<1;l=c[E>>2]<<1;k=c[F>>2]<<1;j=c[G>>2]<<1;i=c[x>>2]|0;h=a+84|0;K=c[h>>2]|0;L=a+88|0;M=c[L>>2]|0;N=a+92|0;O=c[N>>2]|0;P=a+96|0;Q=c[P>>2]|0;R=a+100|0;S=c[R>>2]|0;T=a+104|0;U=c[T>>2]|0;V=a+108|0;W=c[V>>2]|0;X=a+112|0;Y=c[X>>2]|0;Z=a+116|0;_=c[Z>>2]|0;$=c[H>>2]|0;aa=c[g>>2]|0;ab=c[J>>2]|0;ac=c[q>>2]|0;ad=c[r>>2]|0;ae=c[s>>2]|0;af=c[t>>2]|0;ag=c[u>>2]|0;ah=c[v>>2]|0;ai=c[w>>2]|0;c[e>>2]=i-$;c[I>>2]=K-aa;c[z>>2]=M-ab;c[A>>2]=O-ac;c[B>>2]=Q-ad;c[C>>2]=S-ae;c[D>>2]=U-af;c[E>>2]=W-ag;c[F>>2]=Y-ah;c[G>>2]=_-ai;c[H>>2]=$+i;c[g>>2]=aa+K;c[J>>2]=ab+M;c[q>>2]=ac+O;c[r>>2]=ad+Q;c[s>>2]=ae+S;c[t>>2]=af+U;c[u>>2]=ag+W;c[v>>2]=ah+Y;c[w>>2]=ai+_;_=c[f>>2]|0;ai=a+124|0;w=c[ai>>2]|0;Y=a+128|0;ah=c[Y>>2]|0;v=a+132|0;W=c[v>>2]|0;ag=a+136|0;u=c[ag>>2]|0;U=a+140|0;af=c[U>>2]|0;t=a+144|0;S=c[t>>2]|0;ae=a+148|0;s=c[ae>>2]|0;Q=a+152|0;ad=c[Q>>2]|0;r=a+156|0;a=c[r>>2]|0;c[x>>2]=_+d;c[h>>2]=w+b;c[L>>2]=ah+y;c[N>>2]=W+p;c[P>>2]=u+o;c[R>>2]=af+n;c[T>>2]=S+m;c[V>>2]=s+l;c[X>>2]=ad+k;c[Z>>2]=a+j;c[f>>2]=d-_;c[ai>>2]=b-w;c[Y>>2]=y-ah;c[v>>2]=p-W;c[ag>>2]=o-u;c[U>>2]=n-af;c[t>>2]=m-S;c[ae>>2]=l-s;c[Q>>2]=k-ad;c[r>>2]=j-a;return}function aY(b,d,e,f){b=b|0;d=d|0;e=e|0;f=f|0;var g=0,h=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0;g=i;i=i+2392|0;h=g|0;j=g+120|0;k=g+376|0;l=g+632|0;m=g+1912|0;n=g+2072|0;o=g+2232|0;aW(j|0,d);aW(k|0,f);f=l|0;a1(f,e);d=c[e+4>>2]|0;p=c[e+8>>2]|0;q=c[e+12>>2]|0;r=c[e+16>>2]|0;s=c[e+20>>2]|0;t=c[e+24>>2]|0;u=c[e+28>>2]|0;v=c[e+32>>2]|0;w=c[e+36>>2]|0;c[h>>2]=c[e>>2];c[h+4>>2]=d;c[h+8>>2]=p;c[h+12>>2]=q;c[h+16>>2]=r;c[h+20>>2]=s;c[h+24>>2]=t;c[h+28>>2]=u;c[h+32>>2]=v;c[h+36>>2]=w;w=c[e+44>>2]|0;v=c[e+48>>2]|0;u=c[e+52>>2]|0;t=c[e+56>>2]|0;s=c[e+60>>2]|0;r=c[e+64>>2]|0;q=c[e+68>>2]|0;p=c[e+72>>2]|0;d=c[e+76>>2]|0;c[h+40>>2]=c[e+40>>2];c[h+44>>2]=w;c[h+48>>2]=v;c[h+52>>2]=u;c[h+56>>2]=t;c[h+60>>2]=s;c[h+64>>2]=r;c[h+68>>2]=q;c[h+72>>2]=p;c[h+76>>2]=d;d=c[e+84>>2]|0;p=c[e+88>>2]|0;q=c[e+92>>2]|0;r=c[e+96>>2]|0;s=c[e+100>>2]|0;t=c[e+104>>2]|0;u=c[e+108>>2]|0;v=c[e+112>>2]|0;w=c[e+116>>2]|0;c[h+80>>2]=c[e+80>>2];c[h+84>>2]=d;c[h+88>>2]=p;c[h+92>>2]=q;c[h+96>>2]=r;c[h+100>>2]=s;c[h+104>>2]=t;c[h+108>>2]=u;c[h+112>>2]=v;c[h+116>>2]=w;a0(m,h);h=m|0;w=m+120|0;aP(o|0,h,w);v=m+40|0;u=m+80|0;aP(o+40|0,v,u);aP(o+80|0,u,w);aP(o+120|0,h,v);aX(m,o,f);f=n|0;aP(f,h,w);t=n+40|0;aP(t,v,u);s=n+80|0;aP(s,u,w);r=n+120|0;aP(r,h,v);q=l+160|0;a1(q,n);aX(m,o,q);aP(f,h,w);aP(t,v,u);aP(s,u,w);aP(r,h,v);q=l+320|0;a1(q,n);aX(m,o,q);aP(f,h,w);aP(t,v,u);aP(s,u,w);aP(r,h,v);q=l+480|0;a1(q,n);aX(m,o,q);aP(f,h,w);aP(t,v,u);aP(s,u,w);aP(r,h,v);q=l+640|0;a1(q,n);aX(m,o,q);aP(f,h,w);aP(t,v,u);aP(s,u,w);aP(r,h,v);q=l+800|0;a1(q,n);aX(m,o,q);aP(f,h,w);aP(t,v,u);aP(s,u,w);aP(r,h,v);q=l+960|0;a1(q,n);aX(m,o,q);aP(f,h,w);aP(t,v,u);aP(s,u,w);aP(r,h,v);a1(l+1120|0,n);bd(b|0,0,40);q=b+40|0;c[q>>2]=1;bd(b+44|0,0,36);o=b+80|0;c[o>>2]=1;bd(b+84|0,0,36);p=255;while(1){if((p|0)<=-1){x=115;break}if((a[j+p|0]|0)!=0){break}if((a[k+p|0]|0)==0){p=p-1|0}else{break}}if((x|0)==115){i=g;return}x=b|0;d=p;while(1){a0(m,b);p=a[j+d|0]|0;do{if(p<<24>>24>0){aP(f,h,w);aP(t,v,u);aP(s,u,w);aP(r,h,v);aX(m,n,l+(((p<<24>>24|0)/2&-1)*160&-1)|0)}else{if(p<<24>>24>=0){break}aP(f,h,w);aP(t,v,u);aP(s,u,w);aP(r,h,v);a4(m,n,l+(((p<<24>>24|0)/-2&-1)*160&-1)|0)}}while(0);p=a[k+d|0]|0;do{if(p<<24>>24>0){aP(f,h,w);aP(t,v,u);aP(s,u,w);aP(r,h,v);a_(m,n,31584+(((p<<24>>24|0)/2&-1)*120&-1)|0)}else{if(p<<24>>24>=0){break}aP(f,h,w);aP(t,v,u);aP(s,u,w);aP(r,h,v);a$(m,n,31584+(((p<<24>>24|0)/-2&-1)*120&-1)|0)}}while(0);aP(x,h,w);aP(q,v,u);aP(o,u,w);if((d|0)<=0){break}d=d-1|0}i=g;return}function aZ(b,e){b=b|0;e=e|0;var f=0,g=0,h=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0,L=0,M=0,N=0,O=0,P=0;f=i;i=i+232|0;g=f+32|0;h=f+72|0;j=f+152|0;k=f+192|0;l=b+40|0;aO(l,e);m=b+80|0;c[m>>2]=1;n=b+84|0;bd(n|0,0,36);o=g|0;aS(o,l);p=h|0;aP(p,o,120);q=g+4|0;r=g+8|0;s=g+12|0;t=g+16|0;u=g+20|0;v=g+24|0;w=g+28|0;x=g+32|0;y=g+36|0;g=c[m>>2]|0;m=c[n>>2]|0;n=c[b+88>>2]|0;z=c[b+92>>2]|0;A=c[b+96>>2]|0;B=c[b+100>>2]|0;C=c[b+104>>2]|0;D=c[b+108>>2]|0;E=c[b+112>>2]|0;F=c[b+116>>2]|0;G=(c[q>>2]|0)-m|0;H=(c[r>>2]|0)-n|0;I=(c[s>>2]|0)-z|0;J=(c[t>>2]|0)-A|0;K=(c[u>>2]|0)-B|0;L=(c[v>>2]|0)-C|0;M=(c[w>>2]|0)-D|0;N=(c[x>>2]|0)-E|0;O=(c[y>>2]|0)-F|0;c[o>>2]=(c[o>>2]|0)-g;c[q>>2]=G;c[r>>2]=H;c[s>>2]=I;c[t>>2]=J;c[u>>2]=K;c[v>>2]=L;c[w>>2]=M;c[x>>2]=N;c[y>>2]=O;O=h+4|0;N=h+8|0;M=h+12|0;L=h+16|0;K=h+20|0;J=h+24|0;I=h+28|0;H=h+32|0;G=h+36|0;h=m+(c[O>>2]|0)|0;m=n+(c[N>>2]|0)|0;n=z+(c[M>>2]|0)|0;z=A+(c[L>>2]|0)|0;A=B+(c[K>>2]|0)|0;B=C+(c[J>>2]|0)|0;C=D+(c[I>>2]|0)|0;D=E+(c[H>>2]|0)|0;E=F+(c[G>>2]|0)|0;c[p>>2]=g+(c[p>>2]|0);c[O>>2]=h;c[N>>2]=m;c[M>>2]=n;c[L>>2]=z;c[K>>2]=A;c[J>>2]=B;c[I>>2]=C;c[H>>2]=D;c[G>>2]=E;E=f+112|0;aS(E,p);aP(E,E,p);G=b|0;aS(G,E);aP(G,G,p);aP(G,G,o);aV(G,G);aP(G,G,E);aP(G,G,o);E=j|0;aS(E,G);aP(E,E,p);p=k|0;D=c[E>>2]|0;E=c[j+4>>2]|0;H=c[j+8>>2]|0;C=c[j+12>>2]|0;I=c[j+16>>2]|0;B=c[j+20>>2]|0;J=c[j+24>>2]|0;A=c[j+28>>2]|0;K=c[j+32>>2]|0;z=c[j+36>>2]|0;j=c[o>>2]|0;o=c[q>>2]|0;q=c[r>>2]|0;r=c[s>>2]|0;s=c[t>>2]|0;t=c[u>>2]|0;u=c[v>>2]|0;v=c[w>>2]|0;w=c[x>>2]|0;x=c[y>>2]|0;c[p>>2]=D-j;y=k+4|0;c[y>>2]=E-o;L=k+8|0;c[L>>2]=H-q;n=k+12|0;c[n>>2]=C-r;M=k+16|0;c[M>>2]=I-s;m=k+20|0;c[m>>2]=B-t;N=k+24|0;c[N>>2]=J-u;h=k+28|0;c[h>>2]=A-v;O=k+32|0;c[O>>2]=K-w;g=k+36|0;c[g>>2]=z-x;k=f|0;aU(k,p);do{if((aH(k,8)|0)!=0){c[p>>2]=j+D;c[y>>2]=o+E;c[L>>2]=q+H;c[n>>2]=r+C;c[M>>2]=s+I;c[m>>2]=t+B;c[N>>2]=u+J;c[h>>2]=v+A;c[O>>2]=w+K;c[g>>2]=x+z;aU(k,p);if((aH(k,8)|0)==0){aP(G,G,40);break}else{P=-1;i=f;return P|0}}}while(0);aU(k,G);if((a[k]&1|0)==((d[e+31|0]|0)>>>7|0)){e=b+4|0;k=b+8|0;p=b+12|0;z=b+16|0;x=b+20|0;g=b+24|0;K=b+28|0;w=b+32|0;O=b+36|0;A=-(c[e>>2]|0)|0;v=-(c[k>>2]|0)|0;h=-(c[p>>2]|0)|0;J=-(c[z>>2]|0)|0;u=-(c[x>>2]|0)|0;N=-(c[g>>2]|0)|0;B=-(c[K>>2]|0)|0;t=-(c[w>>2]|0)|0;m=-(c[O>>2]|0)|0;c[G>>2]=-(c[G>>2]|0);c[e>>2]=A;c[k>>2]=v;c[p>>2]=h;c[z>>2]=J;c[x>>2]=u;c[g>>2]=N;c[K>>2]=B;c[w>>2]=t;c[O>>2]=m}aP(b+120|0,G,l);P=0;i=f;return P|0}function a_(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0,L=0,M=0,N=0,O=0,P=0,Q=0,R=0,S=0,T=0,U=0,V=0,W=0,X=0,Y=0,Z=0,_=0,$=0,aa=0,ab=0,ac=0,ad=0,ae=0,af=0,ag=0,ah=0,ai=0;e=a|0;f=b+40|0;g=b|0;h=b+44|0;i=b+48|0;j=b+52|0;k=b+56|0;l=b+60|0;m=b+64|0;n=b+68|0;o=b+72|0;p=b+76|0;q=b+4|0;r=b+8|0;s=b+12|0;t=b+16|0;u=b+20|0;v=b+24|0;w=b+28|0;x=b+32|0;y=b+36|0;z=(c[q>>2]|0)+(c[h>>2]|0)|0;A=(c[r>>2]|0)+(c[i>>2]|0)|0;B=(c[s>>2]|0)+(c[j>>2]|0)|0;C=(c[t>>2]|0)+(c[k>>2]|0)|0;D=(c[u>>2]|0)+(c[l>>2]|0)|0;E=(c[v>>2]|0)+(c[m>>2]|0)|0;F=(c[w>>2]|0)+(c[n>>2]|0)|0;G=(c[x>>2]|0)+(c[o>>2]|0)|0;H=(c[y>>2]|0)+(c[p>>2]|0)|0;c[e>>2]=(c[g>>2]|0)+(c[f>>2]|0);I=a+4|0;c[I>>2]=z;z=a+8|0;c[z>>2]=A;A=a+12|0;c[A>>2]=B;B=a+16|0;c[B>>2]=C;C=a+20|0;c[C>>2]=D;D=a+24|0;c[D>>2]=E;E=a+28|0;c[E>>2]=F;F=a+32|0;c[F>>2]=G;G=a+36|0;c[G>>2]=H;H=a+40|0;J=(c[h>>2]|0)-(c[q>>2]|0)|0;q=(c[i>>2]|0)-(c[r>>2]|0)|0;r=(c[j>>2]|0)-(c[s>>2]|0)|0;s=(c[k>>2]|0)-(c[t>>2]|0)|0;t=(c[l>>2]|0)-(c[u>>2]|0)|0;u=(c[m>>2]|0)-(c[v>>2]|0)|0;v=(c[n>>2]|0)-(c[w>>2]|0)|0;w=(c[o>>2]|0)-(c[x>>2]|0)|0;x=(c[p>>2]|0)-(c[y>>2]|0)|0;c[H>>2]=(c[f>>2]|0)-(c[g>>2]|0);g=a+44|0;c[g>>2]=J;J=a+48|0;c[J>>2]=q;q=a+52|0;c[q>>2]=r;r=a+56|0;c[r>>2]=s;s=a+60|0;c[s>>2]=t;t=a+64|0;c[t>>2]=u;u=a+68|0;c[u>>2]=v;v=a+72|0;c[v>>2]=w;w=a+76|0;c[w>>2]=x;x=a+80|0;aP(x,e,d|0);aP(H,H,d+40|0);f=a+120|0;aP(f,d+80|0,b+120|0);d=c[b+80>>2]<<1;y=c[b+84>>2]<<1;p=c[b+88>>2]<<1;o=c[b+92>>2]<<1;n=c[b+96>>2]<<1;m=c[b+100>>2]<<1;l=c[b+104>>2]<<1;k=c[b+108>>2]<<1;j=c[b+112>>2]<<1;i=c[b+116>>2]<<1;b=c[x>>2]|0;h=a+84|0;K=c[h>>2]|0;L=a+88|0;M=c[L>>2]|0;N=a+92|0;O=c[N>>2]|0;P=a+96|0;Q=c[P>>2]|0;R=a+100|0;S=c[R>>2]|0;T=a+104|0;U=c[T>>2]|0;V=a+108|0;W=c[V>>2]|0;X=a+112|0;Y=c[X>>2]|0;Z=a+116|0;_=c[Z>>2]|0;$=c[H>>2]|0;aa=c[g>>2]|0;ab=c[J>>2]|0;ac=c[q>>2]|0;ad=c[r>>2]|0;ae=c[s>>2]|0;af=c[t>>2]|0;ag=c[u>>2]|0;ah=c[v>>2]|0;ai=c[w>>2]|0;c[e>>2]=b-$;c[I>>2]=K-aa;c[z>>2]=M-ab;c[A>>2]=O-ac;c[B>>2]=Q-ad;c[C>>2]=S-ae;c[D>>2]=U-af;c[E>>2]=W-ag;c[F>>2]=Y-ah;c[G>>2]=_-ai;c[H>>2]=$+b;c[g>>2]=aa+K;c[J>>2]=ab+M;c[q>>2]=ac+O;c[r>>2]=ad+Q;c[s>>2]=ae+S;c[t>>2]=af+U;c[u>>2]=ag+W;c[v>>2]=ah+Y;c[w>>2]=ai+_;_=c[f>>2]|0;ai=a+124|0;w=c[ai>>2]|0;Y=a+128|0;ah=c[Y>>2]|0;v=a+132|0;W=c[v>>2]|0;ag=a+136|0;u=c[ag>>2]|0;U=a+140|0;af=c[U>>2]|0;t=a+144|0;S=c[t>>2]|0;ae=a+148|0;s=c[ae>>2]|0;Q=a+152|0;ad=c[Q>>2]|0;r=a+156|0;a=c[r>>2]|0;c[x>>2]=_+d;c[h>>2]=w+y;c[L>>2]=ah+p;c[N>>2]=W+o;c[P>>2]=u+n;c[R>>2]=af+m;c[T>>2]=S+l;c[V>>2]=s+k;c[X>>2]=ad+j;c[Z>>2]=a+i;c[f>>2]=d-_;c[ai>>2]=y-w;c[Y>>2]=p-ah;c[v>>2]=o-W;c[ag>>2]=n-u;c[U>>2]=m-af;c[t>>2]=l-S;c[ae>>2]=k-s;c[Q>>2]=j-ad;c[r>>2]=i-a;return}function a$(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0,L=0,M=0,N=0,O=0,P=0,Q=0,R=0,S=0,T=0,U=0,V=0,W=0,X=0,Y=0,Z=0,_=0,$=0,aa=0,ab=0,ac=0,ad=0,ae=0,af=0,ag=0,ah=0,ai=0;e=a|0;f=b+40|0;g=b|0;h=b+44|0;i=b+48|0;j=b+52|0;k=b+56|0;l=b+60|0;m=b+64|0;n=b+68|0;o=b+72|0;p=b+76|0;q=b+4|0;r=b+8|0;s=b+12|0;t=b+16|0;u=b+20|0;v=b+24|0;w=b+28|0;x=b+32|0;y=b+36|0;z=(c[q>>2]|0)+(c[h>>2]|0)|0;A=(c[r>>2]|0)+(c[i>>2]|0)|0;B=(c[s>>2]|0)+(c[j>>2]|0)|0;C=(c[t>>2]|0)+(c[k>>2]|0)|0;D=(c[u>>2]|0)+(c[l>>2]|0)|0;E=(c[v>>2]|0)+(c[m>>2]|0)|0;F=(c[w>>2]|0)+(c[n>>2]|0)|0;G=(c[x>>2]|0)+(c[o>>2]|0)|0;H=(c[y>>2]|0)+(c[p>>2]|0)|0;c[e>>2]=(c[g>>2]|0)+(c[f>>2]|0);I=a+4|0;c[I>>2]=z;z=a+8|0;c[z>>2]=A;A=a+12|0;c[A>>2]=B;B=a+16|0;c[B>>2]=C;C=a+20|0;c[C>>2]=D;D=a+24|0;c[D>>2]=E;E=a+28|0;c[E>>2]=F;F=a+32|0;c[F>>2]=G;G=a+36|0;c[G>>2]=H;H=a+40|0;J=(c[h>>2]|0)-(c[q>>2]|0)|0;q=(c[i>>2]|0)-(c[r>>2]|0)|0;r=(c[j>>2]|0)-(c[s>>2]|0)|0;s=(c[k>>2]|0)-(c[t>>2]|0)|0;t=(c[l>>2]|0)-(c[u>>2]|0)|0;u=(c[m>>2]|0)-(c[v>>2]|0)|0;v=(c[n>>2]|0)-(c[w>>2]|0)|0;w=(c[o>>2]|0)-(c[x>>2]|0)|0;x=(c[p>>2]|0)-(c[y>>2]|0)|0;c[H>>2]=(c[f>>2]|0)-(c[g>>2]|0);g=a+44|0;c[g>>2]=J;J=a+48|0;c[J>>2]=q;q=a+52|0;c[q>>2]=r;r=a+56|0;c[r>>2]=s;s=a+60|0;c[s>>2]=t;t=a+64|0;c[t>>2]=u;u=a+68|0;c[u>>2]=v;v=a+72|0;c[v>>2]=w;w=a+76|0;c[w>>2]=x;x=a+80|0;aP(x,e,d+40|0);aP(H,H,d|0);f=a+120|0;aP(f,d+80|0,b+120|0);d=c[b+80>>2]<<1;y=c[b+84>>2]<<1;p=c[b+88>>2]<<1;o=c[b+92>>2]<<1;n=c[b+96>>2]<<1;m=c[b+100>>2]<<1;l=c[b+104>>2]<<1;k=c[b+108>>2]<<1;j=c[b+112>>2]<<1;i=c[b+116>>2]<<1;b=c[x>>2]|0;h=a+84|0;K=c[h>>2]|0;L=a+88|0;M=c[L>>2]|0;N=a+92|0;O=c[N>>2]|0;P=a+96|0;Q=c[P>>2]|0;R=a+100|0;S=c[R>>2]|0;T=a+104|0;U=c[T>>2]|0;V=a+108|0;W=c[V>>2]|0;X=a+112|0;Y=c[X>>2]|0;Z=a+116|0;_=c[Z>>2]|0;$=c[H>>2]|0;aa=c[g>>2]|0;ab=c[J>>2]|0;ac=c[q>>2]|0;ad=c[r>>2]|0;ae=c[s>>2]|0;af=c[t>>2]|0;ag=c[u>>2]|0;ah=c[v>>2]|0;ai=c[w>>2]|0;c[e>>2]=b-$;c[I>>2]=K-aa;c[z>>2]=M-ab;c[A>>2]=O-ac;c[B>>2]=Q-ad;c[C>>2]=S-ae;c[D>>2]=U-af;c[E>>2]=W-ag;c[F>>2]=Y-ah;c[G>>2]=_-ai;c[H>>2]=$+b;c[g>>2]=aa+K;c[J>>2]=ab+M;c[q>>2]=ac+O;c[r>>2]=ad+Q;c[s>>2]=ae+S;c[t>>2]=af+U;c[u>>2]=ag+W;c[v>>2]=ah+Y;c[w>>2]=ai+_;_=c[f>>2]|0;ai=a+124|0;w=c[ai>>2]|0;Y=a+128|0;ah=c[Y>>2]|0;v=a+132|0;W=c[v>>2]|0;ag=a+136|0;u=c[ag>>2]|0;U=a+140|0;af=c[U>>2]|0;t=a+144|0;S=c[t>>2]|0;ae=a+148|0;s=c[ae>>2]|0;Q=a+152|0;ad=c[Q>>2]|0;r=a+156|0;a=c[r>>2]|0;c[x>>2]=d-_;c[h>>2]=y-w;c[L>>2]=p-ah;c[N>>2]=o-W;c[P>>2]=n-u;c[R>>2]=m-af;c[T>>2]=l-S;c[V>>2]=k-s;c[X>>2]=j-ad;c[Z>>2]=i-a;c[f>>2]=_+d;c[ai>>2]=w+y;c[Y>>2]=ah+p;c[v>>2]=W+o;c[ag>>2]=u+n;c[U>>2]=af+m;c[t>>2]=S+l;c[ae>>2]=s+k;c[Q>>2]=ad+j;c[r>>2]=a+i;return}function a0(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0,L=0,M=0,N=0,O=0,P=0,Q=0,R=0,S=0,T=0,U=0,V=0,W=0,X=0,Y=0,Z=0,_=0,$=0,aa=0,ab=0,ac=0,ad=0,ae=0,af=0,ag=0,ah=0,ai=0,aj=0,ak=0,al=0,am=0;d=i;i=i+40|0;e=d|0;f=a|0;g=b|0;aS(f,g);h=a+80|0;j=b+40|0;aS(h,j);k=a+120|0;aT(k,b+80|0);l=a+40|0;m=(c[b+44>>2]|0)+(c[b+4>>2]|0)|0;n=(c[b+48>>2]|0)+(c[b+8>>2]|0)|0;o=(c[b+52>>2]|0)+(c[b+12>>2]|0)|0;p=(c[b+56>>2]|0)+(c[b+16>>2]|0)|0;q=(c[b+60>>2]|0)+(c[b+20>>2]|0)|0;r=(c[b+64>>2]|0)+(c[b+24>>2]|0)|0;s=(c[b+68>>2]|0)+(c[b+28>>2]|0)|0;t=(c[b+72>>2]|0)+(c[b+32>>2]|0)|0;u=(c[b+76>>2]|0)+(c[b+36>>2]|0)|0;c[l>>2]=(c[j>>2]|0)+(c[g>>2]|0);g=a+44|0;c[g>>2]=m;m=a+48|0;c[m>>2]=n;n=a+52|0;c[n>>2]=o;o=a+56|0;c[o>>2]=p;p=a+60|0;c[p>>2]=q;q=a+64|0;c[q>>2]=r;r=a+68|0;c[r>>2]=s;s=a+72|0;c[s>>2]=t;t=a+76|0;c[t>>2]=u;u=e|0;aS(u,l);j=c[h>>2]|0;b=a+84|0;v=c[b>>2]|0;w=a+88|0;x=c[w>>2]|0;y=a+92|0;z=c[y>>2]|0;A=a+96|0;B=c[A>>2]|0;C=a+100|0;D=c[C>>2]|0;E=a+104|0;F=c[E>>2]|0;G=a+108|0;H=c[G>>2]|0;I=a+112|0;J=c[I>>2]|0;K=a+116|0;L=c[K>>2]|0;M=c[f>>2]|0;N=a+4|0;O=c[N>>2]|0;P=a+8|0;Q=c[P>>2]|0;R=a+12|0;S=c[R>>2]|0;T=a+16|0;U=c[T>>2]|0;V=a+20|0;W=c[V>>2]|0;X=a+24|0;Y=c[X>>2]|0;Z=a+28|0;_=c[Z>>2]|0;$=a+32|0;aa=c[$>>2]|0;ab=a+36|0;ac=c[ab>>2]|0;ad=M+j|0;ae=O+v|0;af=Q+x|0;ag=S+z|0;ah=U+B|0;ai=W+D|0;aj=Y+F|0;ak=_+H|0;al=aa+J|0;am=ac+L|0;c[l>>2]=ad;c[g>>2]=ae;c[m>>2]=af;c[n>>2]=ag;c[o>>2]=ah;c[p>>2]=ai;c[q>>2]=aj;c[r>>2]=ak;c[s>>2]=al;c[t>>2]=am;t=j-M|0;M=v-O|0;O=x-Q|0;Q=z-S|0;S=B-U|0;U=D-W|0;W=F-Y|0;Y=H-_|0;_=J-aa|0;aa=L-ac|0;c[h>>2]=t;c[b>>2]=M;c[w>>2]=O;c[y>>2]=Q;c[A>>2]=S;c[C>>2]=U;c[E>>2]=W;c[G>>2]=Y;c[I>>2]=_;c[K>>2]=aa;K=(c[e+4>>2]|0)-ae|0;ae=(c[e+8>>2]|0)-af|0;af=(c[e+12>>2]|0)-ag|0;ag=(c[e+16>>2]|0)-ah|0;ah=(c[e+20>>2]|0)-ai|0;ai=(c[e+24>>2]|0)-aj|0;aj=(c[e+28>>2]|0)-ak|0;ak=(c[e+32>>2]|0)-al|0;al=(c[e+36>>2]|0)-am|0;c[f>>2]=(c[u>>2]|0)-ad;c[N>>2]=K;c[P>>2]=ae;c[R>>2]=af;c[T>>2]=ag;c[V>>2]=ah;c[X>>2]=ai;c[Z>>2]=aj;c[$>>2]=ak;c[ab>>2]=al;al=a+124|0;ab=a+128|0;ak=a+132|0;$=a+136|0;aj=a+140|0;Z=a+144|0;ai=a+148|0;X=a+152|0;ah=a+156|0;a=(c[al>>2]|0)-M|0;M=(c[ab>>2]|0)-O|0;O=(c[ak>>2]|0)-Q|0;Q=(c[$>>2]|0)-S|0;S=(c[aj>>2]|0)-U|0;U=(c[Z>>2]|0)-W|0;W=(c[ai>>2]|0)-Y|0;Y=(c[X>>2]|0)-_|0;_=(c[ah>>2]|0)-aa|0;c[k>>2]=(c[k>>2]|0)-t;c[al>>2]=a;c[ab>>2]=M;c[ak>>2]=O;c[$>>2]=Q;c[aj>>2]=S;c[Z>>2]=U;c[ai>>2]=W;c[X>>2]=Y;c[ah>>2]=_;i=d;return}function a1(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0;d=b+40|0;e=b|0;f=b+44|0;g=b+48|0;h=b+52|0;i=b+56|0;j=b+60|0;k=b+64|0;l=b+68|0;m=b+72|0;n=b+76|0;o=b+4|0;p=b+8|0;q=b+12|0;r=b+16|0;s=b+20|0;t=b+24|0;u=b+28|0;v=b+32|0;w=b+36|0;x=(c[o>>2]|0)+(c[f>>2]|0)|0;y=(c[p>>2]|0)+(c[g>>2]|0)|0;z=(c[q>>2]|0)+(c[h>>2]|0)|0;A=(c[r>>2]|0)+(c[i>>2]|0)|0;B=(c[s>>2]|0)+(c[j>>2]|0)|0;C=(c[t>>2]|0)+(c[k>>2]|0)|0;D=(c[u>>2]|0)+(c[l>>2]|0)|0;E=(c[v>>2]|0)+(c[m>>2]|0)|0;F=(c[w>>2]|0)+(c[n>>2]|0)|0;c[a>>2]=(c[e>>2]|0)+(c[d>>2]|0);c[a+4>>2]=x;c[a+8>>2]=y;c[a+12>>2]=z;c[a+16>>2]=A;c[a+20>>2]=B;c[a+24>>2]=C;c[a+28>>2]=D;c[a+32>>2]=E;c[a+36>>2]=F;F=(c[f>>2]|0)-(c[o>>2]|0)|0;o=(c[g>>2]|0)-(c[p>>2]|0)|0;p=(c[h>>2]|0)-(c[q>>2]|0)|0;q=(c[i>>2]|0)-(c[r>>2]|0)|0;r=(c[j>>2]|0)-(c[s>>2]|0)|0;s=(c[k>>2]|0)-(c[t>>2]|0)|0;t=(c[l>>2]|0)-(c[u>>2]|0)|0;u=(c[m>>2]|0)-(c[v>>2]|0)|0;v=(c[n>>2]|0)-(c[w>>2]|0)|0;c[a+40>>2]=(c[d>>2]|0)-(c[e>>2]|0);c[a+44>>2]=F;c[a+48>>2]=o;c[a+52>>2]=p;c[a+56>>2]=q;c[a+60>>2]=r;c[a+64>>2]=s;c[a+68>>2]=t;c[a+72>>2]=u;c[a+76>>2]=v;v=c[b+84>>2]|0;u=c[b+88>>2]|0;t=c[b+92>>2]|0;s=c[b+96>>2]|0;r=c[b+100>>2]|0;q=c[b+104>>2]|0;p=c[b+108>>2]|0;o=c[b+112>>2]|0;F=c[b+116>>2]|0;c[a+80>>2]=c[b+80>>2];c[a+84>>2]=v;c[a+88>>2]=u;c[a+92>>2]=t;c[a+96>>2]=s;c[a+100>>2]=r;c[a+104>>2]=q;c[a+108>>2]=p;c[a+112>>2]=o;c[a+116>>2]=F;aP(a+120|0,b+120|0,80);return}function a2(b,e){b=b|0;e=e|0;var f=0,g=0,h=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0,D=0;f=i;i=i+584|0;g=f|0;h=f+120|0;j=f+184|0;k=f+344|0;l=f+464|0;m=0;while(1){n=a[e+m|0]|0;o=m<<1;a[h+o|0]=n&15;a[h+(o|1)|0]=(n&255)>>>4;n=m+1|0;if((n|0)<32){m=n}else{p=0;q=0;break}}do{m=h+q|0;e=(d[m]|0)+p|0;p=(e<<24)+134217728>>28;a[m]=e-(p<<4)&255;q=q+1|0;}while((q|0)<63);q=h+63|0;a[q]=(d[q]|0)+p&255;bd(b|0,0,40);p=b+40|0;c[p>>2]=1;q=b+44|0;bd(q|0,0,36);e=b+80|0;c[e>>2]=1;m=b+84|0;bd(m|0,0,76);n=b|0;o=j|0;r=j+120|0;s=j+40|0;t=j+80|0;u=b+120|0;v=1;do{a3(l,(v|0)/2&-1,a[h+v|0]|0);a_(j,b,l);aP(n,o,r);aP(p,s,t);aP(e,t,r);aP(u,o,s);v=v+2|0;}while((v|0)<64);v=c[b+4>>2]|0;w=c[b+8>>2]|0;x=c[b+12>>2]|0;y=c[b+16>>2]|0;z=c[b+20>>2]|0;A=c[b+24>>2]|0;B=c[b+28>>2]|0;C=c[b+32>>2]|0;D=c[b+36>>2]|0;c[g>>2]=c[n>>2];c[g+4>>2]=v;c[g+8>>2]=w;c[g+12>>2]=x;c[g+16>>2]=y;c[g+20>>2]=z;c[g+24>>2]=A;c[g+28>>2]=B;c[g+32>>2]=C;c[g+36>>2]=D;D=c[q>>2]|0;q=c[b+48>>2]|0;C=c[b+52>>2]|0;B=c[b+56>>2]|0;A=c[b+60>>2]|0;z=c[b+64>>2]|0;y=c[b+68>>2]|0;x=c[b+72>>2]|0;w=c[b+76>>2]|0;c[g+40>>2]=c[p>>2];c[g+44>>2]=D;c[g+48>>2]=q;c[g+52>>2]=C;c[g+56>>2]=B;c[g+60>>2]=A;c[g+64>>2]=z;c[g+68>>2]=y;c[g+72>>2]=x;c[g+76>>2]=w;w=c[m>>2]|0;m=c[b+88>>2]|0;x=c[b+92>>2]|0;y=c[b+96>>2]|0;z=c[b+100>>2]|0;A=c[b+104>>2]|0;B=c[b+108>>2]|0;C=c[b+112>>2]|0;q=c[b+116>>2]|0;c[g+80>>2]=c[e>>2];c[g+84>>2]=w;c[g+88>>2]=m;c[g+92>>2]=x;c[g+96>>2]=y;c[g+100>>2]=z;c[g+104>>2]=A;c[g+108>>2]=B;c[g+112>>2]=C;c[g+116>>2]=q;a0(j,g);g=k|0;aP(g,o,r);q=k+40|0;aP(q,s,t);C=k+80|0;aP(C,t,r);a0(j,k);aP(g,o,r);aP(q,s,t);aP(C,t,r);a0(j,k);aP(g,o,r);aP(q,s,t);aP(C,t,r);a0(j,k);aP(n,o,r);aP(p,s,t);aP(e,t,r);aP(u,o,s);k=0;do{a3(l,(k|0)/2&-1,a[h+k|0]|0);a_(j,b,l);aP(n,o,r);aP(p,s,t);aP(e,t,r);aP(u,o,s);k=k+2|0;}while((k|0)<64);i=f;return}function a3(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0,L=0,M=0,N=0,O=0,P=0,Q=0,R=0,S=0,T=0,U=0,V=0,W=0,X=0,Y=0,Z=0,_=0,$=0,aa=0,ab=0,ac=0,ad=0,ae=0,af=0,ag=0,ah=0,ai=0,aj=0,ak=0,al=0,am=0,an=0,ao=0,ap=0,aq=0,ar=0,as=0,at=0,au=0;e=(d<<24>>24<0?-1:0)>>>31|0<<1;f=d-((-(e&255)&255&d)<<1)&255;d=a|0;c[d>>2]=1;g=a+4|0;bd(g|0,0,36);h=a+40|0;c[h>>2]=1;i=a+44|0;bd(i|0,0,76);j=a+8|0;k=a+12|0;l=a+16|0;m=a+20|0;n=a+24|0;o=a+28|0;p=a+32|0;q=a+36|0;r=((f^1)&255)-1>>31;s=c[164+(b*960&-1)>>2]&r;t=c[168+(b*960&-1)>>2]&r;u=c[172+(b*960&-1)>>2]&r;v=c[176+(b*960&-1)>>2]&r;w=c[180+(b*960&-1)>>2]&r;x=c[184+(b*960&-1)>>2]&r;y=c[188+(b*960&-1)>>2]&r;z=c[192+(b*960&-1)>>2]&r;A=c[196+(b*960&-1)>>2]&r;B=(c[160+(b*960&-1)>>2]^1)&r^1;c[d>>2]=B;c[g>>2]=s;c[j>>2]=t;c[k>>2]=u;c[l>>2]=v;c[m>>2]=w;c[n>>2]=x;c[o>>2]=y;c[p>>2]=z;c[q>>2]=A;C=a+48|0;D=a+52|0;E=a+56|0;F=a+60|0;G=a+64|0;H=a+68|0;I=a+72|0;J=a+76|0;K=c[204+(b*960&-1)>>2]&r;L=c[208+(b*960&-1)>>2]&r;M=c[212+(b*960&-1)>>2]&r;N=c[216+(b*960&-1)>>2]&r;O=c[220+(b*960&-1)>>2]&r;P=c[224+(b*960&-1)>>2]&r;Q=c[228+(b*960&-1)>>2]&r;R=c[232+(b*960&-1)>>2]&r;S=c[236+(b*960&-1)>>2]&r;T=(c[200+(b*960&-1)>>2]^1)&r^1;c[h>>2]=T;c[i>>2]=K;c[C>>2]=L;c[D>>2]=M;c[E>>2]=N;c[F>>2]=O;c[G>>2]=P;c[H>>2]=Q;c[I>>2]=R;c[J>>2]=S;U=a+80|0;V=a+84|0;W=a+88|0;X=a+92|0;Y=a+96|0;Z=a+100|0;_=a+104|0;$=a+108|0;aa=a+112|0;ab=a+116|0;a=c[240+(b*960&-1)>>2]&r;ac=c[244+(b*960&-1)>>2]&r;ad=c[248+(b*960&-1)>>2]&r;ae=c[252+(b*960&-1)>>2]&r;af=c[256+(b*960&-1)>>2]&r;ag=c[260+(b*960&-1)>>2]&r;ah=c[264+(b*960&-1)>>2]&r;ai=c[268+(b*960&-1)>>2]&r;aj=c[272+(b*960&-1)>>2]&r;ak=c[276+(b*960&-1)>>2]&r;c[U>>2]=a;c[V>>2]=ac;c[W>>2]=ad;c[X>>2]=ae;c[Y>>2]=af;c[Z>>2]=ag;c[_>>2]=ah;c[$>>2]=ai;c[aa>>2]=aj;c[ab>>2]=ak;r=((f^2)&255)-1>>31;al=(c[284+(b*960&-1)>>2]^s)&r;am=(c[288+(b*960&-1)>>2]^t)&r;an=(c[292+(b*960&-1)>>2]^u)&r;ao=(c[296+(b*960&-1)>>2]^v)&r;ap=(c[300+(b*960&-1)>>2]^w)&r;aq=(c[304+(b*960&-1)>>2]^x)&r;ar=(c[308+(b*960&-1)>>2]^y)&r;as=(c[312+(b*960&-1)>>2]^z)&r;at=(c[316+(b*960&-1)>>2]^A)&r;au=(c[280+(b*960&-1)>>2]^B)&r^B;c[d>>2]=au;B=al^s;c[g>>2]=B;s=am^t;c[j>>2]=s;t=an^u;c[k>>2]=t;u=ao^v;c[l>>2]=u;v=ap^w;c[m>>2]=v;w=aq^x;c[n>>2]=w;x=ar^y;c[o>>2]=x;y=as^z;c[p>>2]=y;z=at^A;c[q>>2]=z;A=(c[324+(b*960&-1)>>2]^K)&r;at=(c[328+(b*960&-1)>>2]^L)&r;as=(c[332+(b*960&-1)>>2]^M)&r;ar=(c[336+(b*960&-1)>>2]^N)&r;aq=(c[340+(b*960&-1)>>2]^O)&r;ap=(c[344+(b*960&-1)>>2]^P)&r;ao=(c[348+(b*960&-1)>>2]^Q)&r;an=(c[352+(b*960&-1)>>2]^R)&r;am=(c[356+(b*960&-1)>>2]^S)&r;al=(c[320+(b*960&-1)>>2]^T)&r^T;c[h>>2]=al;T=A^K;c[i>>2]=T;K=at^L;c[C>>2]=K;L=as^M;c[D>>2]=L;M=ar^N;c[E>>2]=M;N=aq^O;c[F>>2]=N;O=ap^P;c[G>>2]=O;P=ao^Q;c[H>>2]=P;Q=an^R;c[I>>2]=Q;R=am^S;c[J>>2]=R;S=(c[364+(b*960&-1)>>2]^ac)&r;am=(c[368+(b*960&-1)>>2]^ad)&r;an=(c[372+(b*960&-1)>>2]^ae)&r;ao=(c[376+(b*960&-1)>>2]^af)&r;ap=(c[380+(b*960&-1)>>2]^ag)&r;aq=(c[384+(b*960&-1)>>2]^ah)&r;ar=(c[388+(b*960&-1)>>2]^ai)&r;as=(c[392+(b*960&-1)>>2]^aj)&r;at=(c[396+(b*960&-1)>>2]^ak)&r;A=(c[360+(b*960&-1)>>2]^a)&r^a;c[U>>2]=A;a=S^ac;c[V>>2]=a;ac=am^ad;c[W>>2]=ac;ad=an^ae;c[X>>2]=ad;ae=ao^af;c[Y>>2]=ae;af=ap^ag;c[Z>>2]=af;ag=aq^ah;c[_>>2]=ag;ah=ar^ai;c[$>>2]=ah;ai=as^aj;c[aa>>2]=ai;aj=at^ak;c[ab>>2]=aj;ak=((f^3)&255)-1>>31;at=(c[404+(b*960&-1)>>2]^B)&ak;as=(c[408+(b*960&-1)>>2]^s)&ak;ar=(c[412+(b*960&-1)>>2]^t)&ak;aq=(c[416+(b*960&-1)>>2]^u)&ak;ap=(c[420+(b*960&-1)>>2]^v)&ak;ao=(c[424+(b*960&-1)>>2]^w)&ak;an=(c[428+(b*960&-1)>>2]^x)&ak;am=(c[432+(b*960&-1)>>2]^y)&ak;S=(c[436+(b*960&-1)>>2]^z)&ak;r=(c[400+(b*960&-1)>>2]^au)&ak^au;c[d>>2]=r;au=at^B;c[g>>2]=au;B=as^s;c[j>>2]=B;s=ar^t;c[k>>2]=s;t=aq^u;c[l>>2]=t;u=ap^v;c[m>>2]=u;v=ao^w;c[n>>2]=v;w=an^x;c[o>>2]=w;x=am^y;c[p>>2]=x;y=S^z;c[q>>2]=y;z=(c[444+(b*960&-1)>>2]^T)&ak;S=(c[448+(b*960&-1)>>2]^K)&ak;am=(c[452+(b*960&-1)>>2]^L)&ak;an=(c[456+(b*960&-1)>>2]^M)&ak;ao=(c[460+(b*960&-1)>>2]^N)&ak;ap=(c[464+(b*960&-1)>>2]^O)&ak;aq=(c[468+(b*960&-1)>>2]^P)&ak;ar=(c[472+(b*960&-1)>>2]^Q)&ak;as=(c[476+(b*960&-1)>>2]^R)&ak;at=(c[440+(b*960&-1)>>2]^al)&ak^al;c[h>>2]=at;al=z^T;c[i>>2]=al;T=S^K;c[C>>2]=T;K=am^L;c[D>>2]=K;L=an^M;c[E>>2]=L;M=ao^N;c[F>>2]=M;N=ap^O;c[G>>2]=N;O=aq^P;c[H>>2]=O;P=ar^Q;c[I>>2]=P;Q=as^R;c[J>>2]=Q;R=(c[484+(b*960&-1)>>2]^a)&ak;as=(c[488+(b*960&-1)>>2]^ac)&ak;ar=(c[492+(b*960&-1)>>2]^ad)&ak;aq=(c[496+(b*960&-1)>>2]^ae)&ak;ap=(c[500+(b*960&-1)>>2]^af)&ak;ao=(c[504+(b*960&-1)>>2]^ag)&ak;an=(c[508+(b*960&-1)>>2]^ah)&ak;am=(c[512+(b*960&-1)>>2]^ai)&ak;S=(c[516+(b*960&-1)>>2]^aj)&ak;z=(c[480+(b*960&-1)>>2]^A)&ak^A;c[U>>2]=z;A=R^a;c[V>>2]=A;a=as^ac;c[W>>2]=a;ac=ar^ad;c[X>>2]=ac;ad=aq^ae;c[Y>>2]=ad;ae=ap^af;c[Z>>2]=ae;af=ao^ag;c[_>>2]=af;ag=an^ah;c[$>>2]=ag;ah=am^ai;c[aa>>2]=ah;ai=S^aj;c[ab>>2]=ai;aj=((f^4)&255)-1>>31;S=(c[524+(b*960&-1)>>2]^au)&aj;am=(c[528+(b*960&-1)>>2]^B)&aj;an=(c[532+(b*960&-1)>>2]^s)&aj;ao=(c[536+(b*960&-1)>>2]^t)&aj;ap=(c[540+(b*960&-1)>>2]^u)&aj;aq=(c[544+(b*960&-1)>>2]^v)&aj;ar=(c[548+(b*960&-1)>>2]^w)&aj;as=(c[552+(b*960&-1)>>2]^x)&aj;R=(c[556+(b*960&-1)>>2]^y)&aj;ak=(c[520+(b*960&-1)>>2]^r)&aj^r;c[d>>2]=ak;r=S^au;c[g>>2]=r;au=am^B;c[j>>2]=au;B=an^s;c[k>>2]=B;s=ao^t;c[l>>2]=s;t=ap^u;c[m>>2]=t;u=aq^v;c[n>>2]=u;v=ar^w;c[o>>2]=v;w=as^x;c[p>>2]=w;x=R^y;c[q>>2]=x;y=(c[564+(b*960&-1)>>2]^al)&aj;R=(c[568+(b*960&-1)>>2]^T)&aj;as=(c[572+(b*960&-1)>>2]^K)&aj;ar=(c[576+(b*960&-1)>>2]^L)&aj;aq=(c[580+(b*960&-1)>>2]^M)&aj;ap=(c[584+(b*960&-1)>>2]^N)&aj;ao=(c[588+(b*960&-1)>>2]^O)&aj;an=(c[592+(b*960&-1)>>2]^P)&aj;am=(c[596+(b*960&-1)>>2]^Q)&aj;S=(c[560+(b*960&-1)>>2]^at)&aj^at;c[h>>2]=S;at=y^al;c[i>>2]=at;al=R^T;c[C>>2]=al;T=as^K;c[D>>2]=T;K=ar^L;c[E>>2]=K;L=aq^M;c[F>>2]=L;M=ap^N;c[G>>2]=M;N=ao^O;c[H>>2]=N;O=an^P;c[I>>2]=O;P=am^Q;c[J>>2]=P;Q=(c[604+(b*960&-1)>>2]^A)&aj;am=(c[608+(b*960&-1)>>2]^a)&aj;an=(c[612+(b*960&-1)>>2]^ac)&aj;ao=(c[616+(b*960&-1)>>2]^ad)&aj;ap=(c[620+(b*960&-1)>>2]^ae)&aj;aq=(c[624+(b*960&-1)>>2]^af)&aj;ar=(c[628+(b*960&-1)>>2]^ag)&aj;as=(c[632+(b*960&-1)>>2]^ah)&aj;R=(c[636+(b*960&-1)>>2]^ai)&aj;y=(c[600+(b*960&-1)>>2]^z)&aj^z;c[U>>2]=y;z=Q^A;c[V>>2]=z;A=am^a;c[W>>2]=A;a=an^ac;c[X>>2]=a;ac=ao^ad;c[Y>>2]=ac;ad=ap^ae;c[Z>>2]=ad;ae=aq^af;c[_>>2]=ae;af=ar^ag;c[$>>2]=af;ag=as^ah;c[aa>>2]=ag;ah=R^ai;c[ab>>2]=ah;ai=((f^5)&255)-1>>31;R=(c[644+(b*960&-1)>>2]^r)&ai;as=(c[648+(b*960&-1)>>2]^au)&ai;ar=(c[652+(b*960&-1)>>2]^B)&ai;aq=(c[656+(b*960&-1)>>2]^s)&ai;ap=(c[660+(b*960&-1)>>2]^t)&ai;ao=(c[664+(b*960&-1)>>2]^u)&ai;an=(c[668+(b*960&-1)>>2]^v)&ai;am=(c[672+(b*960&-1)>>2]^w)&ai;Q=(c[676+(b*960&-1)>>2]^x)&ai;aj=(c[640+(b*960&-1)>>2]^ak)&ai^ak;c[d>>2]=aj;ak=R^r;c[g>>2]=ak;r=as^au;c[j>>2]=r;au=ar^B;c[k>>2]=au;B=aq^s;c[l>>2]=B;s=ap^t;c[m>>2]=s;t=ao^u;c[n>>2]=t;u=an^v;c[o>>2]=u;v=am^w;c[p>>2]=v;w=Q^x;c[q>>2]=w;x=(c[684+(b*960&-1)>>2]^at)&ai;Q=(c[688+(b*960&-1)>>2]^al)&ai;am=(c[692+(b*960&-1)>>2]^T)&ai;an=(c[696+(b*960&-1)>>2]^K)&ai;ao=(c[700+(b*960&-1)>>2]^L)&ai;ap=(c[704+(b*960&-1)>>2]^M)&ai;aq=(c[708+(b*960&-1)>>2]^N)&ai;ar=(c[712+(b*960&-1)>>2]^O)&ai;as=(c[716+(b*960&-1)>>2]^P)&ai;R=(c[680+(b*960&-1)>>2]^S)&ai^S;c[h>>2]=R;S=x^at;c[i>>2]=S;at=Q^al;c[C>>2]=at;al=am^T;c[D>>2]=al;T=an^K;c[E>>2]=T;K=ao^L;c[F>>2]=K;L=ap^M;c[G>>2]=L;M=aq^N;c[H>>2]=M;N=ar^O;c[I>>2]=N;O=as^P;c[J>>2]=O;P=(c[724+(b*960&-1)>>2]^z)&ai;as=(c[728+(b*960&-1)>>2]^A)&ai;ar=(c[732+(b*960&-1)>>2]^a)&ai;aq=(c[736+(b*960&-1)>>2]^ac)&ai;ap=(c[740+(b*960&-1)>>2]^ad)&ai;ao=(c[744+(b*960&-1)>>2]^ae)&ai;an=(c[748+(b*960&-1)>>2]^af)&ai;am=(c[752+(b*960&-1)>>2]^ag)&ai;Q=(c[756+(b*960&-1)>>2]^ah)&ai;x=(c[720+(b*960&-1)>>2]^y)&ai^y;c[U>>2]=x;y=P^z;c[V>>2]=y;z=as^A;c[W>>2]=z;A=ar^a;c[X>>2]=A;a=aq^ac;c[Y>>2]=a;ac=ap^ad;c[Z>>2]=ac;ad=ao^ae;c[_>>2]=ad;ae=an^af;c[$>>2]=ae;af=am^ag;c[aa>>2]=af;ag=Q^ah;c[ab>>2]=ag;ah=((f^6)&255)-1>>31;Q=(c[764+(b*960&-1)>>2]^ak)&ah;am=(c[768+(b*960&-1)>>2]^r)&ah;an=(c[772+(b*960&-1)>>2]^au)&ah;ao=(c[776+(b*960&-1)>>2]^B)&ah;ap=(c[780+(b*960&-1)>>2]^s)&ah;aq=(c[784+(b*960&-1)>>2]^t)&ah;ar=(c[788+(b*960&-1)>>2]^u)&ah;as=(c[792+(b*960&-1)>>2]^v)&ah;P=(c[796+(b*960&-1)>>2]^w)&ah;ai=(c[760+(b*960&-1)>>2]^aj)&ah^aj;c[d>>2]=ai;aj=Q^ak;c[g>>2]=aj;ak=am^r;c[j>>2]=ak;r=an^au;c[k>>2]=r;au=ao^B;c[l>>2]=au;B=ap^s;c[m>>2]=B;s=aq^t;c[n>>2]=s;t=ar^u;c[o>>2]=t;u=as^v;c[p>>2]=u;v=P^w;c[q>>2]=v;w=(c[804+(b*960&-1)>>2]^S)&ah;P=(c[808+(b*960&-1)>>2]^at)&ah;as=(c[812+(b*960&-1)>>2]^al)&ah;ar=(c[816+(b*960&-1)>>2]^T)&ah;aq=(c[820+(b*960&-1)>>2]^K)&ah;ap=(c[824+(b*960&-1)>>2]^L)&ah;ao=(c[828+(b*960&-1)>>2]^M)&ah;an=(c[832+(b*960&-1)>>2]^N)&ah;am=(c[836+(b*960&-1)>>2]^O)&ah;Q=(c[800+(b*960&-1)>>2]^R)&ah^R;c[h>>2]=Q;R=w^S;c[i>>2]=R;S=P^at;c[C>>2]=S;at=as^al;c[D>>2]=at;al=ar^T;c[E>>2]=al;T=aq^K;c[F>>2]=T;K=ap^L;c[G>>2]=K;L=ao^M;c[H>>2]=L;M=an^N;c[I>>2]=M;N=am^O;c[J>>2]=N;O=(c[844+(b*960&-1)>>2]^y)&ah;am=(c[848+(b*960&-1)>>2]^z)&ah;an=(c[852+(b*960&-1)>>2]^A)&ah;ao=(c[856+(b*960&-1)>>2]^a)&ah;ap=(c[860+(b*960&-1)>>2]^ac)&ah;aq=(c[864+(b*960&-1)>>2]^ad)&ah;ar=(c[868+(b*960&-1)>>2]^ae)&ah;as=(c[872+(b*960&-1)>>2]^af)&ah;P=(c[876+(b*960&-1)>>2]^ag)&ah;w=(c[840+(b*960&-1)>>2]^x)&ah^x;c[U>>2]=w;x=O^y;c[V>>2]=x;y=am^z;c[W>>2]=y;z=an^A;c[X>>2]=z;A=ao^a;c[Y>>2]=A;a=ap^ac;c[Z>>2]=a;ac=aq^ad;c[_>>2]=ac;ad=ar^ae;c[$>>2]=ad;ae=as^af;c[aa>>2]=ae;af=P^ag;c[ab>>2]=af;ag=((f^7)&255)-1>>31;P=(c[884+(b*960&-1)>>2]^aj)&ag;as=(c[888+(b*960&-1)>>2]^ak)&ag;ar=(c[892+(b*960&-1)>>2]^r)&ag;aq=(c[896+(b*960&-1)>>2]^au)&ag;ap=(c[900+(b*960&-1)>>2]^B)&ag;ao=(c[904+(b*960&-1)>>2]^s)&ag;an=(c[908+(b*960&-1)>>2]^t)&ag;am=(c[912+(b*960&-1)>>2]^u)&ag;O=(c[916+(b*960&-1)>>2]^v)&ag;ah=(c[880+(b*960&-1)>>2]^ai)&ag^ai;c[d>>2]=ah;ai=P^aj;c[g>>2]=ai;aj=as^ak;c[j>>2]=aj;ak=ar^r;c[k>>2]=ak;r=aq^au;c[l>>2]=r;au=ap^B;c[m>>2]=au;B=ao^s;c[n>>2]=B;s=an^t;c[o>>2]=s;t=am^u;c[p>>2]=t;u=O^v;c[q>>2]=u;v=(c[924+(b*960&-1)>>2]^R)&ag;O=(c[928+(b*960&-1)>>2]^S)&ag;am=(c[932+(b*960&-1)>>2]^at)&ag;an=(c[936+(b*960&-1)>>2]^al)&ag;ao=(c[940+(b*960&-1)>>2]^T)&ag;ap=(c[944+(b*960&-1)>>2]^K)&ag;aq=(c[948+(b*960&-1)>>2]^L)&ag;ar=(c[952+(b*960&-1)>>2]^M)&ag;as=(c[956+(b*960&-1)>>2]^N)&ag;P=(c[920+(b*960&-1)>>2]^Q)&ag^Q;c[h>>2]=P;Q=v^R;c[i>>2]=Q;R=O^S;c[C>>2]=R;S=am^at;c[D>>2]=S;at=an^al;c[E>>2]=at;al=ao^T;c[F>>2]=al;T=ap^K;c[G>>2]=T;K=aq^L;c[H>>2]=K;L=ar^M;c[I>>2]=L;M=as^N;c[J>>2]=M;N=(c[964+(b*960&-1)>>2]^x)&ag;as=(c[968+(b*960&-1)>>2]^y)&ag;ar=(c[972+(b*960&-1)>>2]^z)&ag;aq=(c[976+(b*960&-1)>>2]^A)&ag;ap=(c[980+(b*960&-1)>>2]^a)&ag;ao=(c[984+(b*960&-1)>>2]^ac)&ag;an=(c[988+(b*960&-1)>>2]^ad)&ag;am=(c[992+(b*960&-1)>>2]^ae)&ag;O=(c[996+(b*960&-1)>>2]^af)&ag;v=(c[960+(b*960&-1)>>2]^w)&ag^w;c[U>>2]=v;w=N^x;c[V>>2]=w;x=as^y;c[W>>2]=x;y=ar^z;c[X>>2]=y;z=aq^A;c[Y>>2]=z;A=ap^a;c[Z>>2]=A;a=ao^ac;c[_>>2]=a;ac=an^ad;c[$>>2]=ac;ad=am^ae;c[aa>>2]=ad;ae=O^af;c[ab>>2]=ae;af=((f^8)&255)-1>>31;f=(c[1004+(b*960&-1)>>2]^ai)&af;O=(c[1008+(b*960&-1)>>2]^aj)&af;am=(c[1012+(b*960&-1)>>2]^ak)&af;an=(c[1016+(b*960&-1)>>2]^r)&af;ao=(c[1020+(b*960&-1)>>2]^au)&af;ap=(c[1024+(b*960&-1)>>2]^B)&af;aq=(c[1028+(b*960&-1)>>2]^s)&af;ar=(c[1032+(b*960&-1)>>2]^t)&af;as=(c[1036+(b*960&-1)>>2]^u)&af;N=(c[1e3+(b*960&-1)>>2]^ah)&af^ah;c[d>>2]=N;ah=f^ai;c[g>>2]=ah;ai=O^aj;c[j>>2]=ai;aj=am^ak;c[k>>2]=aj;ak=an^r;c[l>>2]=ak;r=ao^au;c[m>>2]=r;au=ap^B;c[n>>2]=au;B=aq^s;c[o>>2]=B;s=ar^t;c[p>>2]=s;t=as^u;c[q>>2]=t;u=(c[1044+(b*960&-1)>>2]^Q)&af;as=(c[1048+(b*960&-1)>>2]^R)&af;ar=(c[1052+(b*960&-1)>>2]^S)&af;aq=(c[1056+(b*960&-1)>>2]^at)&af;ap=(c[1060+(b*960&-1)>>2]^al)&af;ao=(c[1064+(b*960&-1)>>2]^T)&af;an=(c[1068+(b*960&-1)>>2]^K)&af;am=(c[1072+(b*960&-1)>>2]^L)&af;O=(c[1076+(b*960&-1)>>2]^M)&af;f=(c[1040+(b*960&-1)>>2]^P)&af^P;c[h>>2]=f;P=u^Q;c[i>>2]=P;Q=as^R;c[C>>2]=Q;R=ar^S;c[D>>2]=R;S=aq^at;c[E>>2]=S;at=ap^al;c[F>>2]=at;al=ao^T;c[G>>2]=al;T=an^K;c[H>>2]=T;K=am^L;c[I>>2]=K;L=O^M;c[J>>2]=L;M=(c[1080+(b*960&-1)>>2]^v)&af^v;v=(c[1084+(b*960&-1)>>2]^w)&af^w;w=(c[1088+(b*960&-1)>>2]^x)&af^x;x=(c[1092+(b*960&-1)>>2]^y)&af^y;y=(c[1096+(b*960&-1)>>2]^z)&af^z;z=(c[1100+(b*960&-1)>>2]^A)&af^A;A=(c[1104+(b*960&-1)>>2]^a)&af^a;a=(c[1108+(b*960&-1)>>2]^ac)&af^ac;ac=(c[1112+(b*960&-1)>>2]^ad)&af^ad;ad=(c[1116+(b*960&-1)>>2]^ae)&af^ae;ae=-e|0;e=(N^f)&ae;af=(ah^P)&ae;b=(ai^Q)&ae;O=(aj^R)&ae;am=(ak^S)&ae;an=(r^at)&ae;ao=(au^al)&ae;ap=(B^T)&ae;aq=(s^K)&ae;ar=(t^L)&ae;c[d>>2]=e^N;c[g>>2]=af^ah;c[j>>2]=b^ai;c[k>>2]=O^aj;c[l>>2]=am^ak;c[m>>2]=an^r;c[n>>2]=ao^au;c[o>>2]=ap^B;c[p>>2]=aq^s;c[q>>2]=ar^t;c[h>>2]=e^f;c[i>>2]=af^P;c[C>>2]=b^Q;c[D>>2]=O^R;c[E>>2]=am^S;c[F>>2]=an^at;c[G>>2]=ao^al;c[H>>2]=ap^T;c[I>>2]=aq^K;c[J>>2]=ar^L;c[U>>2]=(M^-M)&ae^M;c[V>>2]=(v^-v)&ae^v;c[W>>2]=(w^-w)&ae^w;c[X>>2]=(x^-x)&ae^x;c[Y>>2]=(y^-y)&ae^y;c[Z>>2]=(z^-z)&ae^z;c[_>>2]=(A^-A)&ae^A;c[$>>2]=(a^-a)&ae^a;c[aa>>2]=(ac^-ac)&ae^ac;c[ab>>2]=(ad^-ad)&ae^ad;return}function a4(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0,L=0,M=0,N=0,O=0,P=0,Q=0,R=0,S=0,T=0,U=0,V=0,W=0,X=0,Y=0,Z=0,_=0,$=0,aa=0,ab=0,ac=0,ad=0,ae=0,af=0,ag=0,ah=0,ai=0;e=a|0;f=b+40|0;g=b|0;h=b+44|0;i=b+48|0;j=b+52|0;k=b+56|0;l=b+60|0;m=b+64|0;n=b+68|0;o=b+72|0;p=b+76|0;q=b+4|0;r=b+8|0;s=b+12|0;t=b+16|0;u=b+20|0;v=b+24|0;w=b+28|0;x=b+32|0;y=b+36|0;z=(c[q>>2]|0)+(c[h>>2]|0)|0;A=(c[r>>2]|0)+(c[i>>2]|0)|0;B=(c[s>>2]|0)+(c[j>>2]|0)|0;C=(c[t>>2]|0)+(c[k>>2]|0)|0;D=(c[u>>2]|0)+(c[l>>2]|0)|0;E=(c[v>>2]|0)+(c[m>>2]|0)|0;F=(c[w>>2]|0)+(c[n>>2]|0)|0;G=(c[x>>2]|0)+(c[o>>2]|0)|0;H=(c[y>>2]|0)+(c[p>>2]|0)|0;c[e>>2]=(c[g>>2]|0)+(c[f>>2]|0);I=a+4|0;c[I>>2]=z;z=a+8|0;c[z>>2]=A;A=a+12|0;c[A>>2]=B;B=a+16|0;c[B>>2]=C;C=a+20|0;c[C>>2]=D;D=a+24|0;c[D>>2]=E;E=a+28|0;c[E>>2]=F;F=a+32|0;c[F>>2]=G;G=a+36|0;c[G>>2]=H;H=a+40|0;J=(c[h>>2]|0)-(c[q>>2]|0)|0;q=(c[i>>2]|0)-(c[r>>2]|0)|0;r=(c[j>>2]|0)-(c[s>>2]|0)|0;s=(c[k>>2]|0)-(c[t>>2]|0)|0;t=(c[l>>2]|0)-(c[u>>2]|0)|0;u=(c[m>>2]|0)-(c[v>>2]|0)|0;v=(c[n>>2]|0)-(c[w>>2]|0)|0;w=(c[o>>2]|0)-(c[x>>2]|0)|0;x=(c[p>>2]|0)-(c[y>>2]|0)|0;c[H>>2]=(c[f>>2]|0)-(c[g>>2]|0);g=a+44|0;c[g>>2]=J;J=a+48|0;c[J>>2]=q;q=a+52|0;c[q>>2]=r;r=a+56|0;c[r>>2]=s;s=a+60|0;c[s>>2]=t;t=a+64|0;c[t>>2]=u;u=a+68|0;c[u>>2]=v;v=a+72|0;c[v>>2]=w;w=a+76|0;c[w>>2]=x;x=a+80|0;aP(x,e,d+40|0);aP(H,H,d|0);f=a+120|0;aP(f,d+120|0,b+120|0);aP(e,b+80|0,d+80|0);d=c[e>>2]<<1;b=c[I>>2]<<1;y=c[z>>2]<<1;p=c[A>>2]<<1;o=c[B>>2]<<1;n=c[C>>2]<<1;m=c[D>>2]<<1;l=c[E>>2]<<1;k=c[F>>2]<<1;j=c[G>>2]<<1;i=c[x>>2]|0;h=a+84|0;K=c[h>>2]|0;L=a+88|0;M=c[L>>2]|0;N=a+92|0;O=c[N>>2]|0;P=a+96|0;Q=c[P>>2]|0;R=a+100|0;S=c[R>>2]|0;T=a+104|0;U=c[T>>2]|0;V=a+108|0;W=c[V>>2]|0;X=a+112|0;Y=c[X>>2]|0;Z=a+116|0;_=c[Z>>2]|0;$=c[H>>2]|0;aa=c[g>>2]|0;ab=c[J>>2]|0;ac=c[q>>2]|0;ad=c[r>>2]|0;ae=c[s>>2]|0;af=c[t>>2]|0;ag=c[u>>2]|0;ah=c[v>>2]|0;ai=c[w>>2]|0;c[e>>2]=i-$;c[I>>2]=K-aa;c[z>>2]=M-ab;c[A>>2]=O-ac;c[B>>2]=Q-ad;c[C>>2]=S-ae;c[D>>2]=U-af;c[E>>2]=W-ag;c[F>>2]=Y-ah;c[G>>2]=_-ai;c[H>>2]=$+i;c[g>>2]=aa+K;c[J>>2]=ab+M;c[q>>2]=ac+O;c[r>>2]=ad+Q;c[s>>2]=ae+S;c[t>>2]=af+U;c[u>>2]=ag+W;c[v>>2]=ah+Y;c[w>>2]=ai+_;_=c[f>>2]|0;ai=a+124|0;w=c[ai>>2]|0;Y=a+128|0;ah=c[Y>>2]|0;v=a+132|0;W=c[v>>2]|0;ag=a+136|0;u=c[ag>>2]|0;U=a+140|0;af=c[U>>2]|0;t=a+144|0;S=c[t>>2]|0;ae=a+148|0;s=c[ae>>2]|0;Q=a+152|0;ad=c[Q>>2]|0;r=a+156|0;a=c[r>>2]|0;c[x>>2]=d-_;c[h>>2]=b-w;c[L>>2]=y-ah;c[N>>2]=p-W;c[P>>2]=o-u;c[R>>2]=n-af;c[T>>2]=m-S;c[V>>2]=l-s;c[X>>2]=k-ad;c[Z>>2]=j-a;c[f>>2]=_+d;c[ai>>2]=w+b;c[Y>>2]=ah+y;c[v>>2]=W+p;c[ag>>2]=u+o;c[U>>2]=af+n;c[t>>2]=S+m;c[ae>>2]=s+l;c[Q>>2]=ad+k;c[r>>2]=a+j;return}function a5(b,e,f,g,h,j){b=b|0;e=e|0;f=f|0;g=g|0;h=h|0;j=j|0;var k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0,L=0,M=0,N=0,O=0,P=0,Q=0,R=0,S=0,T=0,U=0,V=0,W=0,X=0,Y=0,Z=0,_=0,$=0,aa=0,ab=0,ac=0,ad=0,ae=0,af=0,ag=0,ah=0,ai=0,aj=0,ak=0,al=0,am=0,an=0,ao=0;k=i;i=i+792|0;l=k|0;m=k+32|0;n=k+72|0;o=k+112|0;p=k+152|0;q=k+384|0;r=k+416|0;s=k+480|0;t=k+512|0;u=k+672|0;v=k+352|0;w=0;do{if(!(h>>>0<w>>>0|h>>>0==w>>>0&g>>>0<64>>>0)){if((d[f+63|0]|0)>31){break}if((aZ(t,j)|0)!=0){break}bb(v|0,j|0,32);x=a[f]|0;y=a[f+1|0]|0;z=a[f+2|0]|0;A=a[f+3|0]|0;B=a[f+4|0]|0;C=a[f+5|0]|0;E=a[f+6|0]|0;F=a[f+7|0]|0;G=a[f+8|0]|0;H=a[f+9|0]|0;I=a[f+10|0]|0;J=a[f+11|0]|0;K=a[f+12|0]|0;L=a[f+13|0]|0;M=a[f+14|0]|0;N=a[f+15|0]|0;O=a[f+16|0]|0;P=a[f+17|0]|0;Q=a[f+18|0]|0;R=a[f+19|0]|0;S=a[f+20|0]|0;T=a[f+21|0]|0;U=a[f+22|0]|0;V=a[f+23|0]|0;W=a[f+24|0]|0;X=a[f+25|0]|0;Y=a[f+26|0]|0;Z=a[f+27|0]|0;_=a[f+28|0]|0;$=a[f+29|0]|0;aa=a[f+30|0]|0;ab=a[f+31|0]|0;ac=q|0;bb(ac|0,f+32|0,32);ad=g;bc(b|0,f|0,ad|0);bb(b+32|0,v|0,32);ae=r|0;af=p|0;ag=p+128|0;bb(ag|0,31520,64);ah=p+192|0;c[ah>>2]=0;c[ah+4>>2]=0;if((ad|0)!=0){ai=ag;ag=ad;aj=b;ak=0;while(1){al=128-ak|0;am=al>>>0>ag>>>0?ag:al;bb(p+ak|0,aj|0,am);al=am+ak|0;if((al|0)==128){a9(af,ai);an=0}else{an=al}al=bf(c[ah>>2]|0,c[ah+4>>2]|0,am,0)|0;c[ah>>2]=al;c[ah+4>>2]=D;if((ag|0)==(am|0)){break}else{ag=ag-am|0;aj=aj+am|0;ak=an}}}ba(af,0,0,ae,8);a7(ae);aY(u,ae,t,ac);ak=s|0;aj=m|0;aR(aj,u+80|0);ag=n|0;aP(ag,u|0,aj);ah=o|0;aP(ah,u+40|0,aj);aU(ak,ah);ah=l|0;aU(ah,ag);ag=s+31|0;aj=a[ag]^a[ah]<<7;a[ag]=aj;if((((a[s+1|0]^y|a[ak]^x|a[s+2|0]^z|a[s+3|0]^A|a[s+4|0]^B|a[s+5|0]^C|a[s+6|0]^E|a[s+7|0]^F|a[s+8|0]^G|a[s+9|0]^H|a[s+10|0]^I|a[s+11|0]^J|a[s+12|0]^K|a[s+13|0]^L|a[s+14|0]^M|a[s+15|0]^N|a[s+16|0]^O|a[s+17|0]^P|a[s+18|0]^Q|a[s+19|0]^R|a[s+20|0]^S|a[s+21|0]^T|a[s+22|0]^U|a[s+23|0]^V|a[s+24|0]^W|a[s+25|0]^X|a[s+26|0]^Y|a[s+27|0]^Z|a[s+28|0]^_|a[s+29|0]^$|a[s+30|0]^aa|aj^ab)&255)+511&256|0)==0){break}aj=bf(g,h,-64,-1)|0;ak=D;bc(b|0,b+64|0,aj|0);bd(b+(ad-64|0)|0,0,64);c[e>>2]=aj;c[e+4>>2]=ak;ao=0;i=k;return ao|0}}while(0);c[e>>2]=-1;c[e+4>>2]=-1;bd(b|0,0,g|0);ao=-1;i=k;return ao|0}function a6(b,c,e,f){b=b|0;c=c|0;e=e|0;f=f|0;var g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0,L=0,M=0,N=0,O=0,P=0,Q=0,R=0,S=0,T=0,U=0,V=0,W=0,X=0,Y=0,Z=0,_=0,$=0,aa=0,ab=0,ac=0,ad=0,ae=0,af=0,ag=0,ah=0,ai=0,aj=0,ak=0,al=0,am=0,an=0,ao=0,ap=0,aq=0,ar=0,as=0,at=0,au=0,av=0,aw=0,ax=0,ay=0,az=0,aA=0,aB=0,aC=0,aD=0,aE=0,aF=0,aG=0,aH=0,aI=0,aJ=0,aK=0,aL=0,aM=0,aN=0,aO=0,aP=0,aQ=0,aR=0,aS=0,aT=0,aU=0,aV=0,aW=0,aX=0,aY=0,aZ=0,a_=0,a$=0,a0=0,a1=0,a2=0,a3=0,a4=0,a5=0,a6=0,a7=0,a8=0,a9=0,ba=0,bb=0,bc=0,bd=0,be=0,bh=0,bi=0,bj=0,bk=0,bl=0,bm=0,bn=0,bo=0,bq=0,br=0,bs=0,bt=0,bu=0,bv=0,bw=0,bx=0,by=0,bz=0,bA=0,bB=0,bC=0,bD=0,bE=0,bF=0,bG=0,bH=0,bI=0,bJ=0,bK=0,bL=0,bM=0,bN=0,bO=0,bP=0,bQ=0,bR=0,bS=0,bT=0,bU=0,bV=0,bW=0,bX=0,bY=0,bZ=0,b_=0,b$=0,b0=0,b1=0,b2=0,b3=0,b4=0,b5=0,b6=0,b7=0,b8=0,b9=0,ca=0,cb=0,cc=0,cd=0,ce=0,cf=0,cg=0,ch=0,ci=0,cj=0,ck=0,cl=0,cm=0,cn=0,co=0,cp=0,cq=0,cr=0,cs=0,ct=0,cu=0,cv=0,cw=0,cx=0,cy=0,cz=0,cA=0,cB=0,cC=0,cD=0;g=d[c+1|0]|0;h=d[c+2|0]|0;i=0;j=g<<8|0>>>24|(d[c]|0)|(h<<16|0>>>16)&2031616;k=0<<8|g>>>24|(i<<16|h>>>16)&0;g=d[c+3|0]|0;l=d[c+4|0]|0;m=d[c+5|0]|0;n=0;o=0<<8|g>>>24|i|(0<<16|l>>>16)|(n<<24|m>>>8);i=((g<<8|0>>>24|h|(l<<16|0>>>16)|(m<<24|0>>>8))>>>5|o<<27)&2097151;l=(o>>>5|0<<27)&0;o=d[c+6|0]|0;h=d[c+7|0]|0;g=0;p=0<<8|o>>>24|n|(g<<16|h>>>16);n=((o<<8|0>>>24|m|(h<<16|0>>>16))>>>2|p<<30)&2097151;m=(p>>>2|0<<30)&0;p=d[c+8|0]|0;o=d[c+9|0]|0;q=d[c+10|0]|0;r=0;s=0<<8|p>>>24|g|(0<<16|o>>>16)|(r<<24|q>>>8);g=((p<<8|0>>>24|h|(o<<16|0>>>16)|(q<<24|0>>>8))>>>7|s<<25)&2097151;o=(s>>>7|0<<25)&0;s=d[c+11|0]|0;h=d[c+12|0]|0;p=d[c+13|0]|0;t=0;u=0<<8|s>>>24|r|(0<<16|h>>>16)|(t<<24|p>>>8);r=((s<<8|0>>>24|q|(h<<16|0>>>16)|(p<<24|0>>>8))>>>4|u<<28)&2097151;h=(u>>>4|0<<28)&0;u=d[c+14|0]|0;q=d[c+15|0]|0;s=0;v=0<<8|u>>>24|t|(s<<16|q>>>16);t=((u<<8|0>>>24|p|(q<<16|0>>>16))>>>1|v<<31)&2097151;p=(v>>>1|0<<31)&0;v=d[c+16|0]|0;u=d[c+17|0]|0;w=d[c+18|0]|0;x=0;y=0<<8|v>>>24|s|(0<<16|u>>>16)|(x<<24|w>>>8);s=((v<<8|0>>>24|q|(u<<16|0>>>16)|(w<<24|0>>>8))>>>6|y<<26)&2097151;u=(y>>>6|0<<26)&0;y=d[c+19|0]|0;q=d[c+20|0]|0;v=0<<8|y>>>24|x|(0<<16|q>>>16);x=(y<<8|0>>>24|w|(q<<16|0>>>16))>>>3|v<<29;q=v>>>3|0<<29;v=d[c+22|0]|0;w=d[c+23|0]|0;y=0;z=v<<8|0>>>24|(d[c+21|0]|0)|(w<<16|0>>>16)&2031616;A=0<<8|v>>>24|(y<<16|w>>>16)&0;v=d[c+24|0]|0;B=d[c+25|0]|0;C=d[c+26|0]|0;E=0;F=0<<8|v>>>24|y|(0<<16|B>>>16)|(E<<24|C>>>8);y=((v<<8|0>>>24|w|(B<<16|0>>>16)|(C<<24|0>>>8))>>>5|F<<27)&2097151;B=(F>>>5|0<<27)&0;F=d[c+27|0]|0;w=d[c+28|0]|0;v=0;G=0<<8|F>>>24|E|(v<<16|w>>>16);E=((F<<8|0>>>24|C|(w<<16|0>>>16))>>>2|G<<30)&2097151;C=(G>>>2|0<<30)&0;G=d[c+29|0]|0;F=d[c+30|0]|0;H=d[c+31|0]|0;c=0<<8|G>>>24|v|(0<<16|F>>>16)|(0<<24|H>>>8);v=(G<<8|0>>>24|w|(F<<16|0>>>16)|(H<<24|0>>>8))>>>7|c<<25;H=c>>>7|0<<25;c=d[e+1|0]|0;F=d[e+2|0]|0;w=0;G=c<<8|0>>>24|(d[e]|0)|(F<<16|0>>>16)&2031616;I=0<<8|c>>>24|(w<<16|F>>>16)&0;c=d[e+3|0]|0;J=d[e+4|0]|0;K=d[e+5|0]|0;L=0;M=0<<8|c>>>24|w|(0<<16|J>>>16)|(L<<24|K>>>8);w=((c<<8|0>>>24|F|(J<<16|0>>>16)|(K<<24|0>>>8))>>>5|M<<27)&2097151;J=(M>>>5|0<<27)&0;M=d[e+6|0]|0;F=d[e+7|0]|0;c=0;N=0<<8|M>>>24|L|(c<<16|F>>>16);L=((M<<8|0>>>24|K|(F<<16|0>>>16))>>>2|N<<30)&2097151;K=(N>>>2|0<<30)&0;N=d[e+8|0]|0;M=d[e+9|0]|0;O=d[e+10|0]|0;P=0;Q=0<<8|N>>>24|c|(0<<16|M>>>16)|(P<<24|O>>>8);c=((N<<8|0>>>24|F|(M<<16|0>>>16)|(O<<24|0>>>8))>>>7|Q<<25)&2097151;M=(Q>>>7|0<<25)&0;Q=d[e+11|0]|0;F=d[e+12|0]|0;N=d[e+13|0]|0;R=0;S=0<<8|Q>>>24|P|(0<<16|F>>>16)|(R<<24|N>>>8);P=((Q<<8|0>>>24|O|(F<<16|0>>>16)|(N<<24|0>>>8))>>>4|S<<28)&2097151;F=(S>>>4|0<<28)&0;S=d[e+14|0]|0;O=d[e+15|0]|0;Q=0;T=0<<8|S>>>24|R|(Q<<16|O>>>16);R=((S<<8|0>>>24|N|(O<<16|0>>>16))>>>1|T<<31)&2097151;N=(T>>>1|0<<31)&0;T=d[e+16|0]|0;S=d[e+17|0]|0;U=d[e+18|0]|0;V=0;W=0<<8|T>>>24|Q|(0<<16|S>>>16)|(V<<24|U>>>8);Q=((T<<8|0>>>24|O|(S<<16|0>>>16)|(U<<24|0>>>8))>>>6|W<<26)&2097151;S=(W>>>6|0<<26)&0;W=d[e+19|0]|0;O=d[e+20|0]|0;T=0<<8|W>>>24|V|(0<<16|O>>>16);V=(W<<8|0>>>24|U|(O<<16|0>>>16))>>>3|T<<29;O=T>>>3|0<<29;T=d[e+22|0]|0;U=d[e+23|0]|0;W=0;X=T<<8|0>>>24|(d[e+21|0]|0)|(U<<16|0>>>16)&2031616;Y=0<<8|T>>>24|(W<<16|U>>>16)&0;T=d[e+24|0]|0;Z=d[e+25|0]|0;_=d[e+26|0]|0;$=0;aa=0<<8|T>>>24|W|(0<<16|Z>>>16)|($<<24|_>>>8);W=((T<<8|0>>>24|U|(Z<<16|0>>>16)|(_<<24|0>>>8))>>>5|aa<<27)&2097151;Z=(aa>>>5|0<<27)&0;aa=d[e+27|0]|0;U=d[e+28|0]|0;T=0;ab=0<<8|aa>>>24|$|(T<<16|U>>>16);$=((aa<<8|0>>>24|_|(U<<16|0>>>16))>>>2|ab<<30)&2097151;_=(ab>>>2|0<<30)&0;ab=d[e+29|0]|0;aa=d[e+30|0]|0;ac=d[e+31|0]|0;e=0<<8|ab>>>24|T|(0<<16|aa>>>16)|(0<<24|ac>>>8);T=(ab<<8|0>>>24|U|(aa<<16|0>>>16)|(ac<<24|0>>>8))>>>7|e<<25;ac=e>>>7|0<<25;e=d[f+1|0]|0;aa=d[f+2|0]|0;U=0;ab=e<<8|0>>>24|(d[f]|0)|(aa<<16|0>>>16)&2031616;ad=d[f+3|0]|0;ae=d[f+4|0]|0;af=d[f+5|0]|0;ag=0;ah=0<<8|ad>>>24|U|(0<<16|ae>>>16)|(ag<<24|af>>>8);ai=d[f+6|0]|0;aj=d[f+7|0]|0;ak=0;al=0<<8|ai>>>24|ag|(ak<<16|aj>>>16);ag=d[f+8|0]|0;am=d[f+9|0]|0;an=d[f+10|0]|0;ao=0;ap=0<<8|ag>>>24|ak|(0<<16|am>>>16)|(ao<<24|an>>>8);ak=d[f+11|0]|0;aq=d[f+12|0]|0;ar=d[f+13|0]|0;as=0;at=0<<8|ak>>>24|ao|(0<<16|aq>>>16)|(as<<24|ar>>>8);ao=d[f+14|0]|0;au=d[f+15|0]|0;av=0;aw=0<<8|ao>>>24|as|(av<<16|au>>>16);as=d[f+16|0]|0;ax=d[f+17|0]|0;ay=d[f+18|0]|0;az=0;aA=0<<8|as>>>24|av|(0<<16|ax>>>16)|(az<<24|ay>>>8);av=d[f+19|0]|0;aB=d[f+20|0]|0;aC=0<<8|av>>>24|az|(0<<16|aB>>>16);az=d[f+22|0]|0;aD=d[f+23|0]|0;aE=0;aF=az<<8|0>>>24|(d[f+21|0]|0)|(aD<<16|0>>>16)&2031616;aG=d[f+24|0]|0;aH=d[f+25|0]|0;aI=d[f+26|0]|0;aJ=0;aK=0<<8|aG>>>24|aE|(0<<16|aH>>>16)|(aJ<<24|aI>>>8);aL=d[f+27|0]|0;aM=d[f+28|0]|0;aN=0;aO=0<<8|aL>>>24|aJ|(aN<<16|aM>>>16);aJ=d[f+29|0]|0;aP=d[f+30|0]|0;aQ=d[f+31|0]|0;f=0<<8|aJ>>>24|aN|(0<<16|aP>>>16)|(0<<24|aQ>>>8);aN=bp(G,I,j,k)|0;aR=bf(ab,0<<8|e>>>24|(U<<16|aa>>>16)&0,aN,D)|0;aN=D;U=bp(w,J,j,k)|0;e=D;ab=bp(G,I,i,l)|0;aS=D;aT=bp(L,K,j,k)|0;aU=D;aV=bp(w,J,i,l)|0;aW=D;aX=bp(G,I,n,m)|0;aY=bf(aV,aW,aX,D)|0;aX=bf(aY,D,aT,aU)|0;aU=bf(aX,D,((ai<<8|0>>>24|af|(aj<<16|0>>>16))>>>2|al<<30)&2097151,(al>>>2|0<<30)&0)|0;al=D;ai=bp(c,M,j,k)|0;aX=D;aT=bp(L,K,i,l)|0;aY=D;aW=bp(w,J,n,m)|0;aV=D;aZ=bp(G,I,g,o)|0;a_=D;a$=bp(P,F,j,k)|0;a0=D;a1=bp(c,M,i,l)|0;a2=D;a3=bp(L,K,n,m)|0;a4=D;a5=bp(w,J,g,o)|0;a6=D;a7=bp(G,I,r,h)|0;a8=bf(a5,a6,a7,D)|0;a7=bf(a8,D,a3,a4)|0;a4=bf(a7,D,a1,a2)|0;a2=bf(a4,D,a$,a0)|0;a0=bf(a2,D,((ak<<8|0>>>24|an|(aq<<16|0>>>16)|(ar<<24|0>>>8))>>>4|at<<28)&2097151,(at>>>4|0<<28)&0)|0;at=D;aq=bp(R,N,j,k)|0;ak=D;a2=bp(P,F,i,l)|0;a$=D;a4=bp(c,M,n,m)|0;a1=D;a7=bp(L,K,g,o)|0;a3=D;a8=bp(w,J,r,h)|0;a6=D;a5=bp(G,I,t,p)|0;a9=D;ba=bp(Q,S,j,k)|0;bb=D;bc=bp(R,N,i,l)|0;bd=D;be=bp(P,F,n,m)|0;bh=D;bi=bp(c,M,g,o)|0;bj=D;bk=bp(L,K,r,h)|0;bl=D;bm=bp(w,J,t,p)|0;bn=D;bo=bp(G,I,s,u)|0;bq=bf(bm,bn,bo,D)|0;bo=bf(bq,D,bk,bl)|0;bl=bf(bo,D,bi,bj)|0;bj=bf(bl,D,be,bh)|0;bh=bf(bj,D,bc,bd)|0;bd=bf(bh,D,ba,bb)|0;bb=bf(bd,D,((as<<8|0>>>24|au|(ax<<16|0>>>16)|(ay<<24|0>>>8))>>>6|aA<<26)&2097151,(aA>>>6|0<<26)&0)|0;aA=D;ax=bp(V,O,j,k)|0;as=D;bd=bp(Q,S,i,l)|0;ba=D;bh=bp(R,N,n,m)|0;bc=D;bj=bp(P,F,g,o)|0;be=D;bl=bp(c,M,r,h)|0;bi=D;bo=bp(L,K,t,p)|0;bk=D;bq=bp(w,J,s,u)|0;bn=D;bm=bp(G,I,x,q)|0;br=D;bs=bp(X,Y,j,k)|0;bt=D;bu=bp(V,O,i,l)|0;bv=D;bw=bp(Q,S,n,m)|0;bx=D;by=bp(R,N,g,o)|0;bz=D;bA=bp(P,F,r,h)|0;bB=D;bC=bp(c,M,t,p)|0;bD=D;bE=bp(L,K,s,u)|0;bF=D;bG=bp(w,J,x,q)|0;bH=D;bI=bp(G,I,z,A)|0;bJ=bf(bG,bH,bI,D)|0;bI=bf(bJ,D,bE,bF)|0;bF=bf(bI,D,bC,bD)|0;bD=bf(bF,D,bA,bB)|0;bB=bf(bD,D,by,bz)|0;bz=bf(bB,D,bw,bx)|0;bx=bf(bz,D,bu,bv)|0;bv=bf(bx,D,bs,bt)|0;bt=bf(bv,D,aF,0<<8|az>>>24|(aE<<16|aD>>>16)&0)|0;aE=D;az=bp(W,Z,j,k)|0;aF=D;bv=bp(X,Y,i,l)|0;bs=D;bx=bp(V,O,n,m)|0;bu=D;bz=bp(Q,S,g,o)|0;bw=D;bB=bp(R,N,r,h)|0;by=D;bD=bp(P,F,t,p)|0;bA=D;bF=bp(c,M,s,u)|0;bC=D;bI=bp(L,K,x,q)|0;bE=D;bJ=bp(w,J,z,A)|0;bH=D;bG=bp(G,I,y,B)|0;bK=D;bL=bp($,_,j,k)|0;bM=D;bN=bp(W,Z,i,l)|0;bO=D;bP=bp(X,Y,n,m)|0;bQ=D;bR=bp(V,O,g,o)|0;bS=D;bT=bp(Q,S,r,h)|0;bU=D;bV=bp(R,N,t,p)|0;bW=D;bX=bp(P,F,s,u)|0;bY=D;bZ=bp(c,M,x,q)|0;b_=D;b$=bp(L,K,z,A)|0;b0=D;b1=bp(w,J,y,B)|0;b2=D;b3=bp(G,I,E,C)|0;b4=bf(b1,b2,b3,D)|0;b3=bf(b4,D,b$,b0)|0;b0=bf(b3,D,bZ,b_)|0;b_=bf(b0,D,bX,bY)|0;bY=bf(b_,D,bV,bW)|0;bW=bf(bY,D,bT,bU)|0;bU=bf(bW,D,bR,bS)|0;bS=bf(bU,D,bP,bQ)|0;bQ=bf(bS,D,bN,bO)|0;bO=bf(bQ,D,bL,bM)|0;bM=bf(bO,D,((aL<<8|0>>>24|aI|(aM<<16|0>>>16))>>>2|aO<<30)&2097151,(aO>>>2|0<<30)&0)|0;aO=D;aL=bp(T,ac,j,k)|0;k=D;j=bp($,_,i,l)|0;bO=D;bL=bp(W,Z,n,m)|0;bQ=D;bN=bp(X,Y,g,o)|0;bS=D;bP=bp(V,O,r,h)|0;bU=D;bR=bp(Q,S,t,p)|0;bW=D;bT=bp(R,N,s,u)|0;bY=D;bV=bp(P,F,x,q)|0;b_=D;bX=bp(c,M,z,A)|0;b0=D;bZ=bp(L,K,y,B)|0;b3=D;b$=bp(w,J,E,C)|0;b4=D;b2=bp(G,I,v,H)|0;I=D;G=bp(T,ac,i,l)|0;l=D;i=bp($,_,n,m)|0;b1=D;b5=bp(W,Z,g,o)|0;b6=D;b7=bp(X,Y,r,h)|0;b8=D;b9=bp(V,O,t,p)|0;ca=D;cb=bp(Q,S,s,u)|0;cc=D;cd=bp(R,N,x,q)|0;ce=D;cf=bp(P,F,z,A)|0;cg=D;ch=bp(c,M,y,B)|0;ci=D;cj=bp(L,K,E,C)|0;ck=D;cl=bp(w,J,v,H)|0;J=bf(cj,ck,cl,D)|0;cl=bf(J,D,ch,ci)|0;ci=bf(cl,D,cf,cg)|0;cg=bf(ci,D,cd,ce)|0;ce=bf(cg,D,cb,cc)|0;cc=bf(ce,D,b9,ca)|0;ca=bf(cc,D,b7,b8)|0;b8=bf(ca,D,b5,b6)|0;b6=bf(b8,D,i,b1)|0;b1=bf(b6,D,G,l)|0;l=D;G=bp(T,ac,n,m)|0;m=D;n=bp($,_,g,o)|0;b6=D;i=bp(W,Z,r,h)|0;b8=D;b5=bp(X,Y,t,p)|0;ca=D;b7=bp(V,O,s,u)|0;cc=D;b9=bp(Q,S,x,q)|0;ce=D;cb=bp(R,N,z,A)|0;cg=D;cd=bp(P,F,y,B)|0;ci=D;cf=bp(c,M,E,C)|0;cl=D;ch=bp(L,K,v,H)|0;K=D;L=bp(T,ac,g,o)|0;o=D;g=bp($,_,r,h)|0;J=D;ck=bp(W,Z,t,p)|0;cj=D;w=bp(X,Y,s,u)|0;cm=D;cn=bp(V,O,x,q)|0;co=D;cp=bp(Q,S,z,A)|0;cq=D;cr=bp(R,N,y,B)|0;cs=D;ct=bp(P,F,E,C)|0;cu=D;cv=bp(c,M,v,H)|0;M=bf(ct,cu,cv,D)|0;cv=bf(M,D,cr,cs)|0;cs=bf(cv,D,cp,cq)|0;cq=bf(cs,D,cn,co)|0;co=bf(cq,D,w,cm)|0;cm=bf(co,D,ck,cj)|0;cj=bf(cm,D,g,J)|0;J=bf(cj,D,L,o)|0;o=D;L=bp(T,ac,r,h)|0;h=D;r=bp($,_,t,p)|0;cj=D;g=bp(W,Z,s,u)|0;cm=D;ck=bp(X,Y,x,q)|0;co=D;w=bp(V,O,z,A)|0;cq=D;cn=bp(Q,S,y,B)|0;cs=D;cp=bp(R,N,E,C)|0;cv=D;cr=bp(P,F,v,H)|0;F=D;P=bp(T,ac,t,p)|0;p=D;t=bp($,_,s,u)|0;M=D;cu=bp(W,Z,x,q)|0;ct=D;c=bp(X,Y,z,A)|0;cw=D;cx=bp(V,O,y,B)|0;cy=D;cz=bp(Q,S,E,C)|0;cA=D;cB=bp(R,N,v,H)|0;N=bf(cz,cA,cB,D)|0;cB=bf(N,D,cx,cy)|0;cy=bf(cB,D,c,cw)|0;cw=bf(cy,D,cu,ct)|0;ct=bf(cw,D,t,M)|0;M=bf(ct,D,P,p)|0;p=D;P=bp(T,ac,s,u)|0;u=D;s=bp($,_,x,q)|0;ct=D;t=bp(W,Z,z,A)|0;cw=D;cu=bp(X,Y,y,B)|0;cy=D;c=bp(V,O,E,C)|0;cB=D;cx=bp(Q,S,v,H)|0;S=D;Q=bp(T,ac,x,q)|0;q=D;x=bp($,_,z,A)|0;N=D;cA=bp(W,Z,y,B)|0;cz=D;R=bp(X,Y,E,C)|0;cC=D;cD=bp(V,O,v,H)|0;O=bf(R,cC,cD,D)|0;cD=bf(O,D,cA,cz)|0;cz=bf(cD,D,x,N)|0;N=bf(cz,D,Q,q)|0;q=D;Q=bp(T,ac,z,A)|0;A=D;z=bp($,_,y,B)|0;cz=D;x=bp(W,Z,E,C)|0;cD=D;cA=bp(X,Y,v,H)|0;Y=D;X=bp(T,ac,y,B)|0;B=D;y=bp($,_,E,C)|0;O=D;cC=bp(W,Z,v,H)|0;Z=bf(y,O,cC,D)|0;cC=bf(Z,D,X,B)|0;B=D;X=bp(T,ac,E,C)|0;C=D;E=bp($,_,v,H)|0;_=bf(X,C,E,D)|0;E=D;C=bp(T,ac,v,H)|0;H=D;v=bf(aR,aN,1048576,0)|0;ac=D;T=v>>>21|ac<<11;v=ac>>>21|0<<11;ac=bf(U,e,ab,aS)|0;aS=bf(ac,D,T,v)|0;ac=bf(aS,D,((ad<<8|0>>>24|aa|(ae<<16|0>>>16)|(af<<24|0>>>8))>>>5|ah<<27)&2097151,(ah>>>5|0<<27)&0)|0;ah=D;af=bg(aR,aN,T<<21|0>>>11,v<<21|T>>>11)|0;T=D;v=bf(aU,al,1048576,0)|0;aN=D;aR=v>>>21|aN<<11;v=aN>>>21|0<<11;aN=bf(aW,aV,aZ,a_)|0;a_=bf(aN,D,aT,aY)|0;aY=bf(a_,D,ai,aX)|0;aX=bf(aY,D,aR,v)|0;aY=bf(aX,D,((ag<<8|0>>>24|aj|(am<<16|0>>>16)|(an<<24|0>>>8))>>>7|ap<<25)&2097151,(ap>>>7|0<<25)&0)|0;ap=D;an=bf(a0,at,1048576,0)|0;am=D;aj=an>>>21|am<<11;an=am>>21|((am|0)<0?-1:0)<<11;am=bf(a8,a6,a5,a9)|0;a9=bf(am,D,a7,a3)|0;a3=bf(a9,D,a4,a1)|0;a1=bf(a3,D,a2,a$)|0;a$=bf(a1,D,aq,ak)|0;ak=bf(a$,D,((ao<<8|0>>>24|ar|(au<<16|0>>>16))>>>1|aw<<31)&2097151,(aw>>>1|0<<31)&0)|0;aw=bf(ak,D,aj,an)|0;ak=D;au=bf(bb,aA,1048576,0)|0;ar=D;ao=au>>>21|ar<<11;au=ar>>21|((ar|0)<0?-1:0)<<11;ar=bf(bq,bn,bm,br)|0;br=bf(ar,D,bo,bk)|0;bk=bf(br,D,bl,bi)|0;bi=bf(bk,D,bj,be)|0;be=bf(bi,D,bh,bc)|0;bc=bf(be,D,bd,ba)|0;ba=bf(bc,D,ax,as)|0;as=bf(ba,D,(av<<8|0>>>24|ay|(aB<<16|0>>>16))>>>3|aC<<29,aC>>>3|0<<29)|0;aC=bf(as,D,ao,au)|0;as=D;aB=bf(bt,aE,1048576,0)|0;ay=D;av=aB>>>21|ay<<11;aB=ay>>21|((ay|0)<0?-1:0)<<11;ay=bf(bJ,bH,bG,bK)|0;bK=bf(ay,D,bI,bE)|0;bE=bf(bK,D,bF,bC)|0;bC=bf(bE,D,bD,bA)|0;bA=bf(bC,D,bB,by)|0;by=bf(bA,D,bz,bw)|0;bw=bf(by,D,bx,bu)|0;bu=bf(bw,D,bv,bs)|0;bs=bf(bu,D,az,aF)|0;aF=bf(bs,D,av,aB)|0;bs=bf(aF,D,((aG<<8|0>>>24|aD|(aH<<16|0>>>16)|(aI<<24|0>>>8))>>>5|aK<<27)&2097151,(aK>>>5|0<<27)&0)|0;aK=D;aI=bf(bM,aO,1048576,0)|0;aH=D;aD=aI>>>21|aH<<11;aI=aH>>21|((aH|0)<0?-1:0)<<11;aH=bf(b$,b4,b2,I)|0;I=bf(aH,D,bZ,b3)|0;b3=bf(I,D,bX,b0)|0;b0=bf(b3,D,bV,b_)|0;b_=bf(b0,D,bT,bY)|0;bY=bf(b_,D,bR,bW)|0;bW=bf(bY,D,bP,bU)|0;bU=bf(bW,D,bN,bS)|0;bS=bf(bU,D,bL,bQ)|0;bQ=bf(bS,D,j,bO)|0;bO=bf(bQ,D,aL,k)|0;k=bf(bO,D,(aJ<<8|0>>>24|aM|(aP<<16|0>>>16)|(aQ<<24|0>>>8))>>>7|f<<25,f>>>7|0<<25)|0;f=bf(k,D,aD,aI)|0;k=D;aQ=bf(b1,l,1048576,0)|0;aP=D;aM=aQ>>>21|aP<<11;aQ=aP>>21|((aP|0)<0?-1:0)<<11;aP=bf(cf,cl,ch,K)|0;K=bf(aP,D,cd,ci)|0;ci=bf(K,D,cb,cg)|0;cg=bf(ci,D,b9,ce)|0;ce=bf(cg,D,b7,cc)|0;cc=bf(ce,D,b5,ca)|0;ca=bf(cc,D,i,b8)|0;b8=bf(ca,D,n,b6)|0;b6=bf(b8,D,G,m)|0;m=bf(b6,D,aM,aQ)|0;b6=D;G=bf(J,o,1048576,0)|0;b8=D;n=G>>>21|b8<<11;G=b8>>21|((b8|0)<0?-1:0)<<11;b8=bf(cp,cv,cr,F)|0;F=bf(b8,D,cn,cs)|0;cs=bf(F,D,w,cq)|0;cq=bf(cs,D,ck,co)|0;co=bf(cq,D,g,cm)|0;cm=bf(co,D,r,cj)|0;cj=bf(cm,D,L,h)|0;h=bf(cj,D,n,G)|0;cj=D;L=bf(M,p,1048576,0)|0;cm=D;r=L>>>21|cm<<11;L=cm>>21|((cm|0)<0?-1:0)<<11;cm=bf(c,cB,cx,S)|0;S=bf(cm,D,cu,cy)|0;cy=bf(S,D,t,cw)|0;cw=bf(cy,D,s,ct)|0;ct=bf(cw,D,P,u)|0;u=bf(ct,D,r,L)|0;ct=D;P=bf(N,q,1048576,0)|0;cw=D;s=P>>>21|cw<<11;P=cw>>21|((cw|0)<0?-1:0)<<11;cw=bf(x,cD,cA,Y)|0;Y=bf(cw,D,z,cz)|0;cz=bf(Y,D,Q,A)|0;A=bf(cz,D,s,P)|0;cz=D;Q=bg(N,q,s<<21|0>>>11,P<<21|s>>>11)|0;s=D;P=bf(cC,B,1048576,0)|0;q=D;N=P>>>21|q<<11;P=q>>>21|0<<11;q=bf(_,E,N,P)|0;E=D;_=bg(cC,B,N<<21|0>>>11,P<<21|N>>>11)|0;N=D;P=bf(C,H,1048576,0)|0;B=D;cC=P>>>21|B<<11;P=B>>>21|0<<11;B=bg(C,H,cC<<21|0>>>11,P<<21|cC>>>11)|0;H=D;C=bf(ac,ah,1048576,0)|0;Y=D;z=C>>>21|Y<<11;C=Y>>>21|0<<11;Y=bg(ac,ah,z<<21|0>>>11,C<<21|z>>>11)|0;ah=D;ac=bf(aY,ap,1048576,0)|0;cw=D;cA=ac>>>21|cw<<11;ac=cw>>21|((cw|0)<0?-1:0)<<11;cw=bg(aY,ap,cA<<21|0>>>11,ac<<21|cA>>>11)|0;ap=D;aY=bf(aw,ak,1048576,0)|0;cD=D;x=aY>>>21|cD<<11;aY=cD>>21|((cD|0)<0?-1:0)<<11;cD=bf(aC,as,1048576,0)|0;cy=D;t=cD>>>21|cy<<11;cD=cy>>21|((cy|0)<0?-1:0)<<11;cy=bf(bs,aK,1048576,0)|0;S=D;cu=cy>>>21|S<<11;cy=S>>21|((S|0)<0?-1:0)<<11;S=bf(f,k,1048576,0)|0;cm=D;cx=S>>>21|cm<<11;S=cm>>21|((cm|0)<0?-1:0)<<11;cm=bf(m,b6,1048576,0)|0;cB=D;c=cm>>>21|cB<<11;cm=cB>>21|((cB|0)<0?-1:0)<<11;cB=bf(h,cj,1048576,0)|0;co=D;g=cB>>>21|co<<11;cB=co>>21|((co|0)<0?-1:0)<<11;co=bf(u,ct,1048576,0)|0;cq=D;ck=co>>>21|cq<<11;co=cq>>21|((cq|0)<0?-1:0)<<11;cq=bf(ck,co,Q,s)|0;s=D;Q=bg(u,ct,ck<<21|0>>>11,co<<21|ck>>>11)|0;ck=D;co=bf(A,cz,1048576,0)|0;ct=D;u=co>>>21|ct<<11;co=ct>>21|((ct|0)<0?-1:0)<<11;ct=bf(u,co,_,N)|0;N=D;_=bg(A,cz,u<<21|0>>>11,co<<21|u>>>11)|0;u=D;co=bf(q,E,1048576,0)|0;cz=D;A=co>>>21|cz<<11;co=cz>>>21|0<<11;cz=bf(A,co,B,H)|0;H=D;B=bg(q,E,A<<21|0>>>11,co<<21|A>>>11)|0;A=D;co=bp(cC,P,666643,0)|0;E=D;q=bp(cC,P,470296,0)|0;cs=D;w=bp(cC,P,654183,0)|0;F=D;cn=bp(cC,P,-997805,-1)|0;b8=D;cr=bp(cC,P,136657,0)|0;cv=D;cp=bp(cC,P,-683901,-1)|0;P=bf(cp,D,M,p)|0;p=bg(P,D,r<<21|0>>>11,L<<21|r>>>11)|0;r=bf(p,D,g,cB)|0;p=D;L=bp(cz,H,666643,0)|0;P=D;M=bp(cz,H,470296,0)|0;cp=D;cC=bp(cz,H,654183,0)|0;ca=D;i=bp(cz,H,-997805,-1)|0;cc=D;b5=bp(cz,H,136657,0)|0;ce=D;b7=bp(cz,H,-683901,-1)|0;H=D;cz=bp(B,A,666643,0)|0;cg=D;b9=bp(B,A,470296,0)|0;ci=D;cb=bp(B,A,654183,0)|0;K=D;cd=bp(B,A,-997805,-1)|0;aP=D;ch=bp(B,A,136657,0)|0;cl=D;cf=bp(B,A,-683901,-1)|0;A=D;B=bf(cn,b8,J,o)|0;o=bg(B,D,n<<21|0>>>11,G<<21|n>>>11)|0;n=bf(o,D,c,cm)|0;o=bf(n,D,b5,ce)|0;ce=bf(o,D,cf,A)|0;A=D;cf=bp(ct,N,666643,0)|0;o=D;b5=bp(ct,N,470296,0)|0;n=D;G=bp(ct,N,654183,0)|0;B=D;J=bp(ct,N,-997805,-1)|0;b8=D;cn=bp(ct,N,136657,0)|0;aJ=D;bO=bp(ct,N,-683901,-1)|0;N=D;ct=bp(_,u,666643,0)|0;aL=D;bQ=bp(_,u,470296,0)|0;j=D;bS=bp(_,u,654183,0)|0;bL=D;bU=bp(_,u,-997805,-1)|0;bN=D;bW=bp(_,u,136657,0)|0;bP=D;bY=bp(_,u,-683901,-1)|0;u=D;_=bf(q,cs,b1,l)|0;l=bg(_,D,aM<<21|0>>>11,aQ<<21|aM>>>11)|0;aM=bf(l,D,cC,ca)|0;ca=bf(aM,D,cn,aJ)|0;aJ=bf(ca,D,cd,aP)|0;aP=bf(aJ,D,bY,u)|0;u=bf(aP,D,cx,S)|0;aP=D;bY=bp(cq,s,666643,0)|0;aJ=bf(x,aY,bY,D)|0;bY=bf(aJ,D,bb,aA)|0;aA=bg(bY,D,ao<<21|0>>>11,au<<21|ao>>>11)|0;ao=D;au=bp(cq,s,470296,0)|0;bY=D;bb=bp(cq,s,654183,0)|0;aJ=bf(bb,D,cf,o)|0;o=bf(aJ,D,bQ,j)|0;j=bf(o,D,bt,aE)|0;aE=bf(j,D,t,cD)|0;j=bg(aE,D,av<<21|0>>>11,aB<<21|av>>>11)|0;av=D;aB=bp(cq,s,-997805,-1)|0;aE=D;bt=bp(cq,s,136657,0)|0;o=D;bQ=bf(G,B,L,P)|0;P=bf(bQ,D,bt,o)|0;o=bf(P,D,b9,ci)|0;ci=bf(o,D,bU,bN)|0;bN=bf(ci,D,cu,cy)|0;ci=bf(bN,D,bM,aO)|0;aO=bg(ci,D,aD<<21|0>>>11,aI<<21|aD>>>11)|0;aD=D;aI=bp(cq,s,-683901,-1)|0;s=D;cq=bf(aA,ao,1048576,0)|0;ci=D;bM=cq>>>21|ci<<11;cq=ci>>21|((ci|0)<0?-1:0)<<11;ci=bf(ct,aL,au,bY)|0;bY=bf(ci,D,aC,as)|0;as=bg(bY,D,t<<21|0>>>11,cD<<21|t>>>11)|0;t=bf(as,D,bM,cq)|0;as=D;cD=bf(j,av,1048576,0)|0;bY=D;aC=cD>>>21|bY<<11;cD=bY>>21|((bY|0)<0?-1:0)<<11;bY=bf(aB,aE,b5,n)|0;n=bf(bY,D,cz,cg)|0;cg=bf(n,D,bS,bL)|0;bL=bf(cg,D,bs,aK)|0;aK=bf(bL,D,aC,cD)|0;bL=bg(aK,D,cu<<21|0>>>11,cy<<21|cu>>>11)|0;cu=D;cy=bf(aO,aD,1048576,0)|0;aK=D;bs=cy>>>21|aK<<11;cy=aK>>21|((aK|0)<0?-1:0)<<11;aK=bf(M,cp,co,E)|0;E=bf(aK,D,J,b8)|0;b8=bf(E,D,aI,s)|0;s=bf(b8,D,cb,K)|0;K=bf(s,D,bW,bP)|0;bP=bf(K,D,f,k)|0;k=bf(bP,D,bs,cy)|0;bP=bg(k,D,cx<<21|0>>>11,S<<21|cx>>>11)|0;cx=D;S=bf(u,aP,1048576,0)|0;k=D;f=S>>>21|k<<11;S=k>>21|((k|0)<0?-1:0)<<11;k=bf(m,b6,w,F)|0;F=bg(k,D,c<<21|0>>>11,cm<<21|c>>>11)|0;c=bf(F,D,i,cc)|0;cc=bf(c,D,bO,N)|0;N=bf(cc,D,ch,cl)|0;cl=bf(N,D,f,S)|0;N=D;ch=bg(u,aP,f<<21|0>>>11,S<<21|f>>>11)|0;f=D;S=bf(ce,A,1048576,0)|0;aP=D;u=S>>>21|aP<<11;S=aP>>21|((aP|0)<0?-1:0)<<11;aP=bf(h,cj,cr,cv)|0;cv=bg(aP,D,g<<21|0>>>11,cB<<21|g>>>11)|0;g=bf(cv,D,b7,H)|0;H=bf(g,D,u,S)|0;g=D;b7=bg(ce,A,u<<21|0>>>11,S<<21|u>>>11)|0;u=D;S=bf(r,p,1048576,0)|0;A=D;ce=S>>>21|A<<11;S=A>>21|((A|0)<0?-1:0)<<11;A=bf(ce,S,Q,ck)|0;ck=D;Q=bg(r,p,ce<<21|0>>>11,S<<21|ce>>>11)|0;ce=D;S=bf(t,as,1048576,0)|0;p=D;r=S>>>21|p<<11;S=p>>21|((p|0)<0?-1:0)<<11;p=bf(bL,cu,1048576,0)|0;cv=D;cB=p>>>21|cv<<11;p=cv>>21|((cv|0)<0?-1:0)<<11;cv=bf(bP,cx,1048576,0)|0;aP=D;cr=cv>>>21|aP<<11;cv=aP>>21|((aP|0)<0?-1:0)<<11;aP=bf(ch,f,cr,cv)|0;f=D;ch=bg(bP,cx,cr<<21|0>>>11,cv<<21|cr>>>11)|0;cr=D;cv=bf(cl,N,1048576,0)|0;cx=D;bP=cv>>>21|cx<<11;cv=cx>>21|((cx|0)<0?-1:0)<<11;cx=bf(bP,cv,b7,u)|0;u=D;b7=bg(cl,N,bP<<21|0>>>11,cv<<21|bP>>>11)|0;bP=D;cv=bf(H,g,1048576,0)|0;N=D;cl=cv>>>21|N<<11;cv=N>>21|((N|0)<0?-1:0)<<11;N=bf(cl,cv,Q,ce)|0;ce=D;Q=bg(H,g,cl<<21|0>>>11,cv<<21|cl>>>11)|0;cl=D;cv=bp(A,ck,666643,0)|0;g=D;H=bp(A,ck,470296,0)|0;cj=D;h=bp(A,ck,654183,0)|0;cc=D;bO=bp(A,ck,-997805,-1)|0;c=D;i=bp(A,ck,136657,0)|0;F=D;cm=bp(A,ck,-683901,-1)|0;ck=bf(cB,p,cm,D)|0;cm=bf(ck,D,aO,aD)|0;aD=bg(cm,D,bs<<21|0>>>11,cy<<21|bs>>>11)|0;bs=D;cy=bp(N,ce,666643,0)|0;cm=D;aO=bp(N,ce,470296,0)|0;ck=D;A=bp(N,ce,654183,0)|0;k=D;w=bp(N,ce,-997805,-1)|0;b6=D;m=bp(N,ce,136657,0)|0;K=D;bW=bp(N,ce,-683901,-1)|0;ce=D;N=bp(Q,cl,666643,0)|0;s=bf(cw,ap,N,D)|0;N=D;ap=bp(Q,cl,470296,0)|0;cw=D;cb=bp(Q,cl,654183,0)|0;b8=D;aI=bp(Q,cl,-997805,-1)|0;E=D;J=bp(Q,cl,136657,0)|0;aK=D;co=bp(Q,cl,-683901,-1)|0;cl=D;Q=bf(m,K,bO,c)|0;c=bf(Q,D,co,cl)|0;cl=bf(c,D,j,av)|0;av=bf(cl,D,r,S)|0;cl=bg(av,D,aC<<21|0>>>11,cD<<21|aC>>>11)|0;aC=D;cD=bp(cx,u,666643,0)|0;av=D;j=bp(cx,u,470296,0)|0;c=D;co=bp(cx,u,654183,0)|0;Q=D;bO=bp(cx,u,-997805,-1)|0;K=D;m=bp(cx,u,136657,0)|0;cp=D;M=bp(cx,u,-683901,-1)|0;u=D;cx=bp(b7,bP,666643,0)|0;cg=D;bS=bp(b7,bP,470296,0)|0;n=D;cz=bp(b7,bP,654183,0)|0;bY=D;b5=bp(b7,bP,-997805,-1)|0;aE=D;aB=bp(b7,bP,136657,0)|0;ci=D;au=bp(b7,bP,-683901,-1)|0;bP=D;b7=bf(A,k,H,cj)|0;cj=bf(b7,D,aI,E)|0;E=bf(cj,D,aA,ao)|0;ao=bg(E,D,bM<<21|0>>>11,cq<<21|bM>>>11)|0;bM=bf(ao,D,m,cp)|0;cp=bf(bM,D,au,bP)|0;bP=D;au=bp(aP,f,666643,0)|0;bM=bf(au,D,af,T)|0;T=D;af=bp(aP,f,470296,0)|0;au=D;m=bp(aP,f,654183,0)|0;ao=D;cq=bf(aU,al,z,C)|0;C=bg(cq,D,aR<<21|0>>>11,v<<21|aR>>>11)|0;aR=bf(C,D,m,ao)|0;ao=bf(aR,D,cD,av)|0;av=bf(ao,D,bS,n)|0;n=D;bS=bp(aP,f,-997805,-1)|0;ao=D;cD=bp(aP,f,136657,0)|0;aR=D;m=bf(cy,cm,cA,ac)|0;ac=bf(m,D,ap,cw)|0;cw=bf(ac,D,a0,at)|0;at=bg(cw,D,aj<<21|0>>>11,an<<21|aj>>>11)|0;aj=bf(at,D,cD,aR)|0;aR=bf(aj,D,co,Q)|0;Q=bf(aR,D,b5,aE)|0;aE=D;b5=bp(aP,f,-683901,-1)|0;f=D;aP=bf(bM,T,1048576,0)|0;aR=D;co=aP>>>21|aR<<11;aP=aR>>21|((aR|0)<0?-1:0)<<11;aR=bf(Y,ah,af,au)|0;au=bf(aR,D,cx,cg)|0;cg=bf(au,D,co,aP)|0;au=D;cx=bg(bM,T,co<<21|0>>>11,aP<<21|co>>>11)|0;co=D;aP=bf(av,n,1048576,0)|0;T=D;bM=aP>>>21|T<<11;aP=T>>21|((T|0)<0?-1:0)<<11;T=bf(s,N,bS,ao)|0;ao=bf(T,D,j,c)|0;c=bf(ao,D,cz,bY)|0;bY=bf(c,D,bM,aP)|0;c=D;cz=bf(Q,aE,1048576,0)|0;ao=D;j=cz>>>21|ao<<11;cz=ao>>21|((ao|0)<0?-1:0)<<11;ao=bf(aO,ck,cv,g)|0;g=bf(ao,D,cb,b8)|0;b8=bf(g,D,aw,ak)|0;ak=bg(b8,D,x<<21|0>>>11,aY<<21|x>>>11)|0;x=bf(ak,D,b5,f)|0;f=bf(x,D,bO,K)|0;K=bf(f,D,aB,ci)|0;ci=bf(K,D,j,cz)|0;K=D;aB=bf(cp,bP,1048576,0)|0;f=D;bO=aB>>>21|f<<11;aB=f>>21|((f|0)<0?-1:0)<<11;f=bf(w,b6,h,cc)|0;cc=bf(f,D,J,aK)|0;aK=bf(cc,D,t,as)|0;as=bg(aK,D,r<<21|0>>>11,S<<21|r>>>11)|0;r=bf(as,D,M,u)|0;u=bf(r,D,bO,aB)|0;r=D;M=bg(cp,bP,bO<<21|0>>>11,aB<<21|bO>>>11)|0;bO=D;aB=bf(cl,aC,1048576,0)|0;bP=D;cp=aB>>>21|bP<<11;aB=bP>>21|((bP|0)<0?-1:0)<<11;bP=bf(bW,ce,i,F)|0;F=bf(bP,D,bL,cu)|0;cu=bf(F,D,cp,aB)|0;F=bg(cu,D,cB<<21|0>>>11,p<<21|cB>>>11)|0;cB=D;p=bg(cl,aC,cp<<21|0>>>11,aB<<21|cp>>>11)|0;cp=D;aB=bf(aD,bs,1048576,0)|0;aC=D;cl=aB>>>21|aC<<11;aB=aC>>21|((aC|0)<0?-1:0)<<11;aC=bf(ch,cr,cl,aB)|0;cr=D;ch=bf(cg,au,1048576,0)|0;cu=D;bL=ch>>>21|cu<<11;ch=cu>>21|((cu|0)<0?-1:0)<<11;cu=bf(bY,c,1048576,0)|0;bP=D;i=cu>>>21|bP<<11;cu=bP>>21|((bP|0)<0?-1:0)<<11;bP=bf(ci,K,1048576,0)|0;ce=D;bW=bP>>>21|ce<<11;bP=ce>>21|((ce|0)<0?-1:0)<<11;ce=bf(M,bO,bW,bP)|0;bO=D;M=bf(u,r,1048576,0)|0;as=D;S=M>>>21|as<<11;M=as>>21|((as|0)<0?-1:0)<<11;as=bf(p,cp,S,M)|0;cp=D;p=bg(u,r,S<<21|0>>>11,M<<21|S>>>11)|0;S=D;M=bf(F,cB,1048576,0)|0;r=D;u=M>>>21|r<<11;M=r>>21|((r|0)<0?-1:0)<<11;r=bg(F,cB,u<<21|0>>>11,M<<21|u>>>11)|0;cB=D;F=bf(aC,cr,1048576,0)|0;aK=D;t=F>>>21|aK<<11;F=aK>>21|((aK|0)<0?-1:0)<<11;aK=bg(aC,cr,t<<21|0>>>11,F<<21|t>>>11)|0;cr=D;aC=bp(t,F,666643,0)|0;cc=bf(cx,co,aC,D)|0;aC=D;co=bp(t,F,470296,0)|0;cx=D;J=bp(t,F,654183,0)|0;f=D;h=bp(t,F,-997805,-1)|0;b6=D;w=bp(t,F,136657,0)|0;x=D;b5=bp(t,F,-683901,-1)|0;F=D;t=cc>>>21|aC<<11;ak=aC>>21|((aC|0)<0?-1:0)<<11;aY=bf(cg,au,co,cx)|0;cx=bg(aY,D,bL<<21|0>>>11,ch<<21|bL>>>11)|0;aY=bf(cx,D,t,ak)|0;cx=D;co=bg(cc,aC,t<<21|0>>>11,ak<<21|t>>>11)|0;t=D;ak=aY>>>21|cx<<11;aC=cx>>21|((cx|0)<0?-1:0)<<11;cc=bf(J,f,av,n)|0;n=bg(cc,D,bM<<21|0>>>11,aP<<21|bM>>>11)|0;bM=bf(n,D,bL,ch)|0;ch=bf(bM,D,ak,aC)|0;bM=D;bL=bg(aY,cx,ak<<21|0>>>11,aC<<21|ak>>>11)|0;ak=D;aC=ch>>>21|bM<<11;cx=bM>>21|((bM|0)<0?-1:0)<<11;aY=bf(bY,c,h,b6)|0;b6=bg(aY,D,i<<21|0>>>11,cu<<21|i>>>11)|0;aY=bf(b6,D,aC,cx)|0;b6=D;h=bg(ch,bM,aC<<21|0>>>11,cx<<21|aC>>>11)|0;aC=D;cx=aY>>>21|b6<<11;bM=b6>>21|((b6|0)<0?-1:0)<<11;ch=bf(w,x,Q,aE)|0;aE=bg(ch,D,j<<21|0>>>11,cz<<21|j>>>11)|0;j=bf(aE,D,i,cu)|0;cu=bf(j,D,cx,bM)|0;j=D;i=bg(aY,b6,cx<<21|0>>>11,bM<<21|cx>>>11)|0;cx=D;bM=cu>>>21|j<<11;b6=j>>21|((j|0)<0?-1:0)<<11;aY=bf(ci,K,b5,F)|0;F=bg(aY,D,bW<<21|0>>>11,bP<<21|bW>>>11)|0;bW=bf(F,D,bM,b6)|0;F=D;bP=bg(cu,j,bM<<21|0>>>11,b6<<21|bM>>>11)|0;bM=D;b6=bW>>>21|F<<11;j=F>>21|((F|0)<0?-1:0)<<11;cu=bf(ce,bO,b6,j)|0;bO=D;ce=bg(bW,F,b6<<21|0>>>11,j<<21|b6>>>11)|0;b6=D;j=cu>>>21|bO<<11;F=bO>>21|((bO|0)<0?-1:0)<<11;bW=bf(j,F,p,S)|0;S=D;p=bg(cu,bO,j<<21|0>>>11,F<<21|j>>>11)|0;j=D;F=bW>>>21|S<<11;bO=S>>21|((S|0)<0?-1:0)<<11;cu=bf(as,cp,F,bO)|0;cp=D;as=bg(bW,S,F<<21|0>>>11,bO<<21|F>>>11)|0;F=D;bO=cu>>>21|cp<<11;S=cp>>21|((cp|0)<0?-1:0)<<11;bW=bf(bO,S,r,cB)|0;cB=D;r=bg(cu,cp,bO<<21|0>>>11,S<<21|bO>>>11)|0;bO=D;S=bW>>>21|cB<<11;cp=cB>>21|((cB|0)<0?-1:0)<<11;cu=bf(aD,bs,u,M)|0;M=bg(cu,D,cl<<21|0>>>11,aB<<21|cl>>>11)|0;cl=bf(M,D,S,cp)|0;M=D;aB=bg(bW,cB,S<<21|0>>>11,cp<<21|S>>>11)|0;S=D;cp=cl>>>21|M<<11;cB=M>>21|((M|0)<0?-1:0)<<11;bW=bf(cp,cB,aK,cr)|0;cr=D;aK=bg(cl,M,cp<<21|0>>>11,cB<<21|cp>>>11)|0;cp=D;cB=bW>>>21|cr<<11;M=cr>>21|((cr|0)<0?-1:0)<<11;cl=bg(bW,cr,cB<<21|0>>>11,M<<21|cB>>>11)|0;cr=D;bW=bp(cB,M,666643,0)|0;cu=bf(bW,D,co,t)|0;t=D;co=bp(cB,M,470296,0)|0;bW=bf(bL,ak,co,D)|0;co=D;ak=bp(cB,M,654183,0)|0;bL=bf(h,aC,ak,D)|0;ak=D;aC=bp(cB,M,-997805,-1)|0;h=bf(i,cx,aC,D)|0;aC=D;cx=bp(cB,M,136657,0)|0;i=bf(bP,bM,cx,D)|0;cx=D;bM=bp(cB,M,-683901,-1)|0;M=bf(ce,b6,bM,D)|0;bM=D;b6=cu>>>21|t<<11;ce=t>>21|((t|0)<0?-1:0)<<11;cB=bf(bW,co,b6,ce)|0;co=D;bW=bg(cu,t,b6<<21|0>>>11,ce<<21|b6>>>11)|0;b6=D;ce=cB>>>21|co<<11;t=co>>21|((co|0)<0?-1:0)<<11;cu=bf(bL,ak,ce,t)|0;ak=D;bL=bg(cB,co,ce<<21|0>>>11,t<<21|ce>>>11)|0;ce=D;t=cu>>>21|ak<<11;co=ak>>21|((ak|0)<0?-1:0)<<11;cB=bf(h,aC,t,co)|0;aC=D;h=bg(cu,ak,t<<21|0>>>11,co<<21|t>>>11)|0;t=D;co=cB>>>21|aC<<11;ak=aC>>21|((aC|0)<0?-1:0)<<11;cu=bf(i,cx,co,ak)|0;cx=D;i=bg(cB,aC,co<<21|0>>>11,ak<<21|co>>>11)|0;co=D;ak=cu>>>21|cx<<11;aC=cx>>21|((cx|0)<0?-1:0)<<11;cB=bf(M,bM,ak,aC)|0;bM=D;M=bg(cu,cx,ak<<21|0>>>11,aC<<21|ak>>>11)|0;ak=D;aC=cB>>>21|bM<<11;cx=bM>>21|((bM|0)<0?-1:0)<<11;cu=bf(aC,cx,p,j)|0;j=D;p=bg(cB,bM,aC<<21|0>>>11,cx<<21|aC>>>11)|0;aC=D;cx=cu>>>21|j<<11;bM=j>>21|((j|0)<0?-1:0)<<11;cB=bf(cx,bM,as,F)|0;F=D;as=bg(cu,j,cx<<21|0>>>11,bM<<21|cx>>>11)|0;cx=D;bM=cB>>>21|F<<11;j=F>>21|((F|0)<0?-1:0)<<11;cu=bf(bM,j,r,bO)|0;bO=D;r=bg(cB,F,bM<<21|0>>>11,j<<21|bM>>>11)|0;bM=D;j=cu>>>21|bO<<11;F=bO>>21|((bO|0)<0?-1:0)<<11;cB=bf(j,F,aB,S)|0;S=D;aB=bg(cu,bO,j<<21|0>>>11,F<<21|j>>>11)|0;j=D;F=cB>>>21|S<<11;bO=S>>21|((S|0)<0?-1:0)<<11;cu=bf(F,bO,aK,cp)|0;cp=D;aK=bg(cB,S,F<<21|0>>>11,bO<<21|F>>>11)|0;F=D;bO=cu>>>21|cp<<11;S=cp>>21|((cp|0)<0?-1:0)<<11;cB=bf(bO,S,cl,cr)|0;cr=D;cl=bg(cu,cp,bO<<21|0>>>11,S<<21|bO>>>11)|0;bO=D;a[b]=bW&255;a[b+1|0]=(bW>>>8|b6<<24)&255;a[b+2|0]=(bL<<5|0>>>27|(bW>>>16|b6<<16))&255;a[b+3|0]=(bL>>>3|ce<<29)&255;a[b+4|0]=(bL>>>11|ce<<21)&255;a[b+5|0]=(h<<2|0>>>30|(bL>>>19|ce<<13))&255;a[b+6|0]=(h>>>6|t<<26)&255;a[b+7|0]=(i<<7|0>>>25|(h>>>14|t<<18))&255;a[b+8|0]=(i>>>1|co<<31)&255;a[b+9|0]=(i>>>9|co<<23)&255;a[b+10|0]=(M<<4|0>>>28|(i>>>17|co<<15))&255;a[b+11|0]=(M>>>4|ak<<28)&255;a[b+12|0]=(M>>>12|ak<<20)&255;a[b+13|0]=(p<<1|0>>>31|(M>>>20|ak<<12))&255;a[b+14|0]=(p>>>7|aC<<25)&255;a[b+15|0]=(as<<6|0>>>26|(p>>>15|aC<<17))&255;a[b+16|0]=(as>>>2|cx<<30)&255;a[b+17|0]=(as>>>10|cx<<22)&255;a[b+18|0]=(r<<3|0>>>29|(as>>>18|cx<<14))&255;a[b+19|0]=(r>>>5|bM<<27)&255;a[b+20|0]=(r>>>13|bM<<19)&255;a[b+21|0]=aB&255;a[b+22|0]=(aB>>>8|j<<24)&255;a[b+23|0]=(aK<<5|0>>>27|(aB>>>16|j<<16))&255;a[b+24|0]=(aK>>>3|F<<29)&255;a[b+25|0]=(aK>>>11|F<<21)&255;a[b+26|0]=(cl<<2|0>>>30|(aK>>>19|F<<13))&255;a[b+27|0]=(cl>>>6|bO<<26)&255;a[b+28|0]=(cl>>>14|bO<<18|(cB<<7|0>>>25))&255;a[b+29|0]=(cB>>>1|cr<<31)&255;a[b+30|0]=(cB>>>9|cr<<23)&255;a[b+31|0]=(cB>>>17|cr<<15)&255;return}function a7(b){b=b|0;var c=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0,L=0,M=0,N=0,O=0,P=0,Q=0,R=0,S=0,T=0,U=0,V=0,W=0,X=0,Y=0,Z=0,_=0,$=0,aa=0,ab=0,ac=0,ad=0,ae=0,af=0,ag=0,ah=0,ai=0,aj=0,ak=0,al=0,am=0,an=0,ao=0,ap=0,aq=0,ar=0,as=0,at=0,au=0,av=0,aw=0,ax=0,ay=0,az=0,aA=0,aB=0,aC=0,aD=0,aE=0,aF=0,aG=0,aH=0,aI=0,aJ=0,aK=0,aL=0,aM=0,aN=0,aO=0,aP=0,aQ=0,aR=0,aS=0,aT=0,aU=0,aV=0,aW=0,aX=0,aY=0,aZ=0,a_=0,a$=0,a0=0,a1=0,a2=0,a3=0,a4=0,a5=0,a6=0,a7=0,a8=0,a9=0,ba=0,bb=0,bc=0,bd=0,be=0,bh=0,bi=0,bj=0,bk=0,bl=0,bm=0,bn=0,bo=0,bq=0,br=0,bs=0,bt=0,bu=0,bv=0,bw=0,bx=0,by=0,bz=0,bA=0,bB=0,bC=0,bD=0,bE=0,bF=0,bG=0,bH=0,bI=0,bJ=0,bK=0,bL=0,bM=0;c=b+1|0;e=b+2|0;f=d[c]|0;g=d[e]|0;h=0;i=f<<8|0>>>24|(d[b]|0)|(g<<16|0>>>16)&2031616;j=b+3|0;k=d[j]|0;l=b+4|0;m=d[l]|0;n=b+5|0;o=d[n]|0;p=0;q=0<<8|k>>>24|h|(0<<16|m>>>16)|(p<<24|o>>>8);r=b+6|0;s=b+7|0;t=d[r]|0;u=d[s]|0;v=0;w=0<<8|t>>>24|p|(v<<16|u>>>16);p=b+8|0;x=d[p]|0;y=b+9|0;z=d[y]|0;A=b+10|0;B=d[A]|0;C=0;E=0<<8|x>>>24|v|(0<<16|z>>>16)|(C<<24|B>>>8);v=b+11|0;F=d[v]|0;G=b+12|0;H=d[G]|0;I=b+13|0;J=d[I]|0;K=0;L=0<<8|F>>>24|C|(0<<16|H>>>16)|(K<<24|J>>>8);C=b+14|0;M=b+15|0;N=d[C]|0;O=d[M]|0;P=0;Q=0<<8|N>>>24|K|(P<<16|O>>>16);K=b+16|0;R=d[K]|0;S=b+17|0;T=d[S]|0;U=b+18|0;V=d[U]|0;W=0;X=0<<8|R>>>24|P|(0<<16|T>>>16)|(W<<24|V>>>8);P=b+19|0;Y=b+20|0;Z=d[P]|0;_=d[Y]|0;$=0<<8|Z>>>24|W|(0<<16|_>>>16);W=b+21|0;aa=b+22|0;ab=b+23|0;ac=d[aa]|0;ad=d[ab]|0;ae=0;af=ac<<8|0>>>24|(d[W]|0)|(ad<<16|0>>>16)&2031616;ag=b+24|0;ah=d[ag]|0;ai=b+25|0;aj=d[ai]|0;ak=b+26|0;al=d[ak]|0;am=0;an=0<<8|ah>>>24|ae|(0<<16|aj>>>16)|(am<<24|al>>>8);ao=b+27|0;ap=b+28|0;aq=d[ao]|0;ar=d[ap]|0;as=0;at=0<<8|aq>>>24|am|(as<<16|ar>>>16);am=b+29|0;au=d[am]|0;av=b+30|0;aw=d[av]|0;ax=b+31|0;ay=d[ax]|0;az=0;aA=0<<8|au>>>24|as|(0<<16|aw>>>16)|(az<<24|ay>>>8);as=d[b+32|0]|0;aB=d[b+33|0]|0;aC=d[b+34|0]|0;aD=0;aE=0<<8|as>>>24|az|(0<<16|aB>>>16)|(aD<<24|aC>>>8);az=d[b+35|0]|0;aF=d[b+36|0]|0;aG=0;aH=0<<8|az>>>24|aD|(aG<<16|aF>>>16);aD=d[b+37|0]|0;aI=d[b+38|0]|0;aJ=d[b+39|0]|0;aK=0;aL=0<<8|aD>>>24|aG|(0<<16|aI>>>16)|(aK<<24|aJ>>>8);aG=d[b+40|0]|0;aM=d[b+41|0]|0;aN=0<<8|aG>>>24|aK|(0<<16|aM>>>16);aK=d[b+43|0]|0;aO=d[b+44|0]|0;aP=0;aQ=aK<<8|0>>>24|(d[b+42|0]|0)|(aO<<16|0>>>16)&2031616;aR=d[b+45|0]|0;aS=d[b+46|0]|0;aT=d[b+47|0]|0;aU=0;aV=0<<8|aR>>>24|aP|(0<<16|aS>>>16)|(aU<<24|aT>>>8);aW=d[b+48|0]|0;aX=d[b+49|0]|0;aY=0;aZ=0<<8|aW>>>24|aU|(aY<<16|aX>>>16);aU=((aW<<8|0>>>24|aT|(aX<<16|0>>>16))>>>2|aZ<<30)&2097151;aW=(aZ>>>2|0<<30)&0;aZ=d[b+50|0]|0;a_=d[b+51|0]|0;a$=d[b+52|0]|0;a0=0;a1=0<<8|aZ>>>24|aY|(0<<16|a_>>>16)|(a0<<24|a$>>>8);aY=((aZ<<8|0>>>24|aX|(a_<<16|0>>>16)|(a$<<24|0>>>8))>>>7|a1<<25)&2097151;a_=(a1>>>7|0<<25)&0;a1=d[b+53|0]|0;aX=d[b+54|0]|0;aZ=d[b+55|0]|0;a2=0;a3=0<<8|a1>>>24|a0|(0<<16|aX>>>16)|(a2<<24|aZ>>>8);a0=((a1<<8|0>>>24|a$|(aX<<16|0>>>16)|(aZ<<24|0>>>8))>>>4|a3<<28)&2097151;aX=(a3>>>4|0<<28)&0;a3=d[b+56|0]|0;a$=d[b+57|0]|0;a1=0;a4=0<<8|a3>>>24|a2|(a1<<16|a$>>>16);a2=((a3<<8|0>>>24|aZ|(a$<<16|0>>>16))>>>1|a4<<31)&2097151;aZ=(a4>>>1|0<<31)&0;a4=d[b+58|0]|0;a3=d[b+59|0]|0;a5=d[b+60|0]|0;a6=0;a7=0<<8|a4>>>24|a1|(0<<16|a3>>>16)|(a6<<24|a5>>>8);a1=((a4<<8|0>>>24|a$|(a3<<16|0>>>16)|(a5<<24|0>>>8))>>>6|a7<<26)&2097151;a3=(a7>>>6|0<<26)&0;a7=d[b+61|0]|0;a$=d[b+62|0]|0;a4=d[b+63|0]|0;a8=0<<8|a7>>>24|a6|(0<<16|a$>>>16)|(0<<24|a4>>>8);a6=(a7<<8|0>>>24|a5|(a$<<16|0>>>16)|(a4<<24|0>>>8))>>>3|a8<<29;a4=a8>>>3|0<<29;a8=bp(a6,a4,666643,0)|0;a$=D;a5=bp(a6,a4,470296,0)|0;a7=D;a9=bp(a6,a4,654183,0)|0;ba=D;bb=bp(a6,a4,-997805,-1)|0;bc=D;bd=bp(a6,a4,136657,0)|0;be=D;bh=bp(a6,a4,-683901,-1)|0;a4=bf(bh,D,aQ,0<<8|aK>>>24|(aP<<16|aO>>>16)&0)|0;aP=D;aK=bp(a1,a3,666643,0)|0;aQ=D;bh=bp(a1,a3,470296,0)|0;a6=D;bi=bp(a1,a3,654183,0)|0;bj=D;bk=bp(a1,a3,-997805,-1)|0;bl=D;bm=bp(a1,a3,136657,0)|0;bn=D;bo=bp(a1,a3,-683901,-1)|0;a3=D;a1=bp(a2,aZ,666643,0)|0;bq=D;br=bp(a2,aZ,470296,0)|0;bs=D;bt=bp(a2,aZ,654183,0)|0;bu=D;bv=bp(a2,aZ,-997805,-1)|0;bw=D;bx=bp(a2,aZ,136657,0)|0;by=D;bz=bp(a2,aZ,-683901,-1)|0;aZ=bf(bz,D,((aD<<8|0>>>24|aF|(aI<<16|0>>>16)|(aJ<<24|0>>>8))>>>6|aL<<26)&2097151,(aL>>>6|0<<26)&0)|0;aL=bf(aZ,D,bm,bn)|0;bn=bf(aL,D,bb,bc)|0;bc=D;bb=bp(a0,aX,666643,0)|0;aL=D;bm=bp(a0,aX,470296,0)|0;aZ=D;aI=bp(a0,aX,654183,0)|0;aD=D;bz=bp(a0,aX,-997805,-1)|0;a2=D;bA=bp(a0,aX,136657,0)|0;bB=D;bC=bp(a0,aX,-683901,-1)|0;aX=D;a0=bp(aY,a_,666643,0)|0;bD=D;bE=bp(aY,a_,470296,0)|0;bF=D;bG=bp(aY,a_,654183,0)|0;bH=D;bI=bp(aY,a_,-997805,-1)|0;bJ=D;bK=bp(aY,a_,136657,0)|0;bL=D;bM=bp(aY,a_,-683901,-1)|0;a_=bf(bM,D,((as<<8|0>>>24|ay|(aB<<16|0>>>16)|(aC<<24|0>>>8))>>>4|aE<<28)&2097151,(aE>>>4|0<<28)&0)|0;aE=bf(a_,D,bA,bB)|0;bB=bf(aE,D,bv,bw)|0;bw=bf(bB,D,bi,bj)|0;bj=bf(bw,D,a5,a7)|0;a7=D;a5=bp(aU,aW,666643,0)|0;bw=bf(a5,D,((R<<8|0>>>24|O|(T<<16|0>>>16)|(V<<24|0>>>8))>>>6|X<<26)&2097151,(X>>>6|0<<26)&0)|0;X=D;T=bp(aU,aW,470296,0)|0;R=D;a5=bp(aU,aW,654183,0)|0;bi=bf(a5,D,af,0<<8|ac>>>24|(ae<<16|ad>>>16)&0)|0;ae=bf(bi,D,bE,bF)|0;bF=bf(ae,D,bb,aL)|0;aL=D;bb=bp(aU,aW,-997805,-1)|0;ae=D;bE=bp(aU,aW,136657,0)|0;bi=bf(bE,D,((aq<<8|0>>>24|al|(ar<<16|0>>>16))>>>2|at<<30)&2097151,(at>>>2|0<<30)&0)|0;at=bf(bi,D,bI,bJ)|0;bJ=bf(at,D,aI,aD)|0;aD=bf(bJ,D,br,bs)|0;bs=bf(aD,D,aK,aQ)|0;aQ=D;aK=bp(aU,aW,-683901,-1)|0;aW=D;aU=bf(bw,X,1048576,0)|0;aD=D;br=aU>>>21|aD<<11;aU=aD>>>21|0<<11;aD=bf(T,R,(Z<<8|0>>>24|V|(_<<16|0>>>16))>>>3|$<<29,$>>>3|0<<29)|0;$=bf(aD,D,br,aU)|0;aD=bf($,D,a0,bD)|0;bD=D;a0=bg(bw,X,br<<21|0>>>11,aU<<21|br>>>11)|0;br=D;aU=bf(bF,aL,1048576,0)|0;X=D;bw=aU>>>21|X<<11;aU=X>>>21|0<<11;X=bf(bb,ae,((ah<<8|0>>>24|ad|(aj<<16|0>>>16)|(al<<24|0>>>8))>>>5|an<<27)&2097151,(an>>>5|0<<27)&0)|0;an=bf(X,D,bG,bH)|0;bH=bf(an,D,bm,aZ)|0;aZ=bf(bH,D,a1,bq)|0;bq=bf(aZ,D,bw,aU)|0;aZ=D;a1=bf(bs,aQ,1048576,0)|0;bH=D;bm=a1>>>21|bH<<11;a1=bH>>21|((bH|0)<0?-1:0)<<11;bH=bf(aK,aW,((au<<8|0>>>24|ar|(aw<<16|0>>>16)|(ay<<24|0>>>8))>>>7|aA<<25)&2097151,(aA>>>7|0<<25)&0)|0;aA=bf(bH,D,bK,bL)|0;bL=bf(aA,D,bz,a2)|0;a2=bf(bL,D,bt,bu)|0;bu=bf(a2,D,bh,a6)|0;a6=bf(bu,D,a8,a$)|0;a$=bf(a6,D,bm,a1)|0;a6=D;a8=bf(bj,a7,1048576,0)|0;bu=D;bh=a8>>>21|bu<<11;a8=bu>>21|((bu|0)<0?-1:0)<<11;bu=bf(bC,aX,((az<<8|0>>>24|aC|(aF<<16|0>>>16))>>>1|aH<<31)&2097151,(aH>>>1|0<<31)&0)|0;aH=bf(bu,D,bx,by)|0;by=bf(aH,D,bk,bl)|0;bl=bf(by,D,a9,ba)|0;ba=bf(bl,D,bh,a8)|0;bl=D;a9=bg(bj,a7,bh<<21|0>>>11,a8<<21|bh>>>11)|0;bh=D;a8=bf(bn,bc,1048576,0)|0;a7=D;bj=a8>>>21|a7<<11;a8=a7>>21|((a7|0)<0?-1:0)<<11;a7=bf(bo,a3,(aG<<8|0>>>24|aJ|(aM<<16|0>>>16))>>>3|aN<<29,aN>>>3|0<<29)|0;aN=bf(a7,D,bd,be)|0;be=bf(aN,D,bj,a8)|0;aN=D;bd=bg(bn,bc,bj<<21|0>>>11,a8<<21|bj>>>11)|0;bj=D;a8=bf(a4,aP,1048576,0)|0;bc=D;bn=a8>>>21|bc<<11;a8=bc>>21|((bc|0)<0?-1:0)<<11;bc=bf(bn,a8,((aR<<8|0>>>24|aO|(aS<<16|0>>>16)|(aT<<24|0>>>8))>>>5|aV<<27)&2097151,(aV>>>5|0<<27)&0)|0;aV=D;aT=bg(a4,aP,bn<<21|0>>>11,a8<<21|bn>>>11)|0;bn=D;a8=bf(aD,bD,1048576,0)|0;aP=D;a4=a8>>>21|aP<<11;a8=aP>>>21|0<<11;aP=bg(aD,bD,a4<<21|0>>>11,a8<<21|a4>>>11)|0;bD=D;aD=bf(bq,aZ,1048576,0)|0;aS=D;aO=aD>>>21|aS<<11;aD=aS>>21|((aS|0)<0?-1:0)<<11;aS=bg(bq,aZ,aO<<21|0>>>11,aD<<21|aO>>>11)|0;aZ=D;bq=bf(a$,a6,1048576,0)|0;aR=D;a7=bq>>>21|aR<<11;bq=aR>>21|((aR|0)<0?-1:0)<<11;aR=bf(a9,bh,a7,bq)|0;bh=D;a9=bg(a$,a6,a7<<21|0>>>11,bq<<21|a7>>>11)|0;a7=D;bq=bf(ba,bl,1048576,0)|0;a6=D;a$=bq>>>21|a6<<11;bq=a6>>21|((a6|0)<0?-1:0)<<11;a6=bf(a$,bq,bd,bj)|0;bj=D;bd=bg(ba,bl,a$<<21|0>>>11,bq<<21|a$>>>11)|0;a$=D;bq=bf(be,aN,1048576,0)|0;bl=D;ba=bq>>>21|bl<<11;bq=bl>>21|((bl|0)<0?-1:0)<<11;bl=bf(ba,bq,aT,bn)|0;bn=D;aT=bg(be,aN,ba<<21|0>>>11,bq<<21|ba>>>11)|0;ba=D;bq=bp(bc,aV,666643,0)|0;aN=bf(bq,D,((N<<8|0>>>24|J|(O<<16|0>>>16))>>>1|Q<<31)&2097151,(Q>>>1|0<<31)&0)|0;Q=D;O=bp(bc,aV,470296,0)|0;N=bf(a0,br,O,D)|0;O=D;br=bp(bc,aV,654183,0)|0;a0=bf(aP,bD,br,D)|0;br=D;bD=bp(bc,aV,-997805,-1)|0;aP=D;bq=bp(bc,aV,136657,0)|0;be=bf(aS,aZ,bq,D)|0;bq=D;aZ=bp(bc,aV,-683901,-1)|0;aV=D;bc=bf(bs,aQ,aO,aD)|0;aD=bg(bc,D,bm<<21|0>>>11,a1<<21|bm>>>11)|0;bm=bf(aD,D,aZ,aV)|0;aV=D;aZ=bp(bl,bn,666643,0)|0;aD=D;a1=bp(bl,bn,470296,0)|0;bc=D;aO=bp(bl,bn,654183,0)|0;aQ=bf(N,O,aO,D)|0;aO=D;O=bp(bl,bn,-997805,-1)|0;N=bf(a0,br,O,D)|0;O=D;br=bp(bl,bn,136657,0)|0;a0=D;bs=bp(bl,bn,-683901,-1)|0;bn=bf(be,bq,bs,D)|0;bs=D;bq=bp(aT,ba,666643,0)|0;be=D;bl=bp(aT,ba,470296,0)|0;aS=D;aM=bp(aT,ba,654183,0)|0;aJ=D;aG=bp(aT,ba,-997805,-1)|0;a3=D;bo=bp(aT,ba,136657,0)|0;by=D;bk=bp(aT,ba,-683901,-1)|0;ba=D;aT=bf(bF,aL,a4,a8)|0;a8=bg(aT,D,bw<<21|0>>>11,aU<<21|bw>>>11)|0;bw=bf(a8,D,bD,aP)|0;aP=bf(bw,D,br,a0)|0;a0=bf(aP,D,bk,ba)|0;ba=D;bk=bp(a6,bj,666643,0)|0;aP=D;br=bp(a6,bj,470296,0)|0;bw=D;bD=bp(a6,bj,654183,0)|0;a8=D;aU=bp(a6,bj,-997805,-1)|0;aT=D;a4=bp(a6,bj,136657,0)|0;aL=D;bF=bp(a6,bj,-683901,-1)|0;bj=D;a6=bp(bd,a$,666643,0)|0;aH=D;bx=bp(bd,a$,470296,0)|0;bu=D;aF=bp(bd,a$,654183,0)|0;aC=D;az=bp(bd,a$,-997805,-1)|0;aX=D;bC=bp(bd,a$,136657,0)|0;a2=D;bt=bp(bd,a$,-683901,-1)|0;a$=D;bd=bf(aQ,aO,a4,aL)|0;aL=bf(bd,D,aG,a3)|0;a3=bf(aL,D,bt,a$)|0;a$=D;bt=bp(aR,bh,666643,0)|0;aL=bf(bt,D,i,0<<8|f>>>24|(h<<16|g>>>16)&0)|0;h=D;f=bp(aR,bh,470296,0)|0;i=D;bt=bp(aR,bh,654183,0)|0;aG=bf(bt,D,((t<<8|0>>>24|o|(u<<16|0>>>16))>>>2|w<<30)&2097151,(w>>>2|0<<30)&0)|0;w=bf(aG,D,bk,aP)|0;aP=bf(w,D,bx,bu)|0;bu=D;bx=bp(aR,bh,-997805,-1)|0;w=D;bk=bp(aR,bh,136657,0)|0;aG=bf(bk,D,((F<<8|0>>>24|B|(H<<16|0>>>16)|(J<<24|0>>>8))>>>4|L<<28)&2097151,(L>>>4|0<<28)&0)|0;L=bf(aG,D,aZ,aD)|0;aD=bf(L,D,bD,a8)|0;a8=bf(aD,D,bl,aS)|0;aS=bf(a8,D,az,aX)|0;aX=D;az=bp(aR,bh,-683901,-1)|0;bh=D;aR=bf(aL,h,1048576,0)|0;a8=D;bl=aR>>>21|a8<<11;aR=a8>>21|((a8|0)<0?-1:0)<<11;a8=bf(f,i,((k<<8|0>>>24|g|(m<<16|0>>>16)|(o<<24|0>>>8))>>>5|q<<27)&2097151,(q>>>5|0<<27)&0)|0;q=bf(a8,D,a6,aH)|0;aH=bf(q,D,bl,aR)|0;q=D;a6=bg(aL,h,bl<<21|0>>>11,aR<<21|bl>>>11)|0;bl=D;aR=bf(aP,bu,1048576,0)|0;h=D;aL=aR>>>21|h<<11;aR=h>>21|((h|0)<0?-1:0)<<11;h=bf(bx,w,((x<<8|0>>>24|u|(z<<16|0>>>16)|(B<<24|0>>>8))>>>7|E<<25)&2097151,(E>>>7|0<<25)&0)|0;E=bf(h,D,br,bw)|0;bw=bf(E,D,bq,be)|0;be=bf(bw,D,aF,aC)|0;aC=bf(be,D,aL,aR)|0;be=D;aF=bf(aS,aX,1048576,0)|0;bw=D;bq=aF>>>21|bw<<11;aF=bw>>21|((bw|0)<0?-1:0)<<11;bw=bf(aN,Q,az,bh)|0;bh=bf(bw,D,a1,bc)|0;bc=bf(bh,D,aU,aT)|0;aT=bf(bc,D,aM,aJ)|0;aJ=bf(aT,D,bC,a2)|0;a2=bf(aJ,D,bq,aF)|0;aJ=D;bC=bf(a3,a$,1048576,0)|0;aT=D;aM=bC>>>21|aT<<11;bC=aT>>21|((aT|0)<0?-1:0)<<11;aT=bf(N,O,bF,bj)|0;bj=bf(aT,D,bo,by)|0;by=bf(bj,D,aM,bC)|0;bj=D;bo=bg(a3,a$,aM<<21|0>>>11,bC<<21|aM>>>11)|0;aM=D;bC=bf(a0,ba,1048576,0)|0;a$=D;a3=bC>>>21|a$<<11;bC=a$>>21|((a$|0)<0?-1:0)<<11;a$=bf(bn,bs,a3,bC)|0;bs=D;bn=bg(a0,ba,a3<<21|0>>>11,bC<<21|a3>>>11)|0;a3=D;bC=bf(bm,aV,1048576,0)|0;ba=D;a0=bC>>>21|ba<<11;bC=ba>>21|((ba|0)<0?-1:0)<<11;ba=bf(a0,bC,a9,a7)|0;a7=D;a9=bg(bm,aV,a0<<21|0>>>11,bC<<21|a0>>>11)|0;a0=D;bC=bf(aH,q,1048576,0)|0;aV=D;bm=bC>>>21|aV<<11;bC=aV>>21|((aV|0)<0?-1:0)<<11;aV=bf(aC,be,1048576,0)|0;aT=D;bF=aV>>>21|aT<<11;aV=aT>>21|((aT|0)<0?-1:0)<<11;aT=bf(a2,aJ,1048576,0)|0;O=D;N=aT>>>21|O<<11;aT=O>>21|((O|0)<0?-1:0)<<11;O=bf(bo,aM,N,aT)|0;aM=D;bo=bf(by,bj,1048576,0)|0;bc=D;aU=bo>>>21|bc<<11;bo=bc>>21|((bc|0)<0?-1:0)<<11;bc=bf(bn,a3,aU,bo)|0;a3=D;bn=bg(by,bj,aU<<21|0>>>11,bo<<21|aU>>>11)|0;aU=D;bo=bf(a$,bs,1048576,0)|0;bj=D;by=bo>>>21|bj<<11;bo=bj>>21|((bj|0)<0?-1:0)<<11;bj=bf(a9,a0,by,bo)|0;a0=D;a9=bg(a$,bs,by<<21|0>>>11,bo<<21|by>>>11)|0;by=D;bo=bf(ba,a7,1048576,0)|0;bs=D;a$=bo>>>21|bs<<11;bo=bs>>21|((bs|0)<0?-1:0)<<11;bs=bg(ba,a7,a$<<21|0>>>11,bo<<21|a$>>>11)|0;a7=D;ba=bp(a$,bo,666643,0)|0;bh=bf(a6,bl,ba,D)|0;ba=D;bl=bp(a$,bo,470296,0)|0;a6=D;a1=bp(a$,bo,654183,0)|0;bw=D;az=bp(a$,bo,-997805,-1)|0;Q=D;aN=bp(a$,bo,136657,0)|0;E=D;br=bp(a$,bo,-683901,-1)|0;bo=D;a$=bh>>>21|ba<<11;h=ba>>21|((ba|0)<0?-1:0)<<11;B=bf(bl,a6,aH,q)|0;q=bg(B,D,bm<<21|0>>>11,bC<<21|bm>>>11)|0;B=bf(q,D,a$,h)|0;q=D;aH=bg(bh,ba,a$<<21|0>>>11,h<<21|a$>>>11)|0;a$=D;h=B>>>21|q<<11;ba=q>>21|((q|0)<0?-1:0)<<11;bh=bf(a1,bw,aP,bu)|0;bu=bg(bh,D,aL<<21|0>>>11,aR<<21|aL>>>11)|0;aL=bf(bu,D,bm,bC)|0;bC=bf(aL,D,h,ba)|0;aL=D;bm=bg(B,q,h<<21|0>>>11,ba<<21|h>>>11)|0;h=D;ba=bC>>>21|aL<<11;q=aL>>21|((aL|0)<0?-1:0)<<11;B=bf(aC,be,az,Q)|0;Q=bg(B,D,bF<<21|0>>>11,aV<<21|bF>>>11)|0;B=bf(Q,D,ba,q)|0;Q=D;az=bg(bC,aL,ba<<21|0>>>11,q<<21|ba>>>11)|0;ba=D;q=B>>>21|Q<<11;aL=Q>>21|((Q|0)<0?-1:0)<<11;bC=bf(aN,E,aS,aX)|0;aX=bg(bC,D,bq<<21|0>>>11,aF<<21|bq>>>11)|0;bq=bf(aX,D,bF,aV)|0;aV=bf(bq,D,q,aL)|0;bq=D;bF=bg(B,Q,q<<21|0>>>11,aL<<21|q>>>11)|0;q=D;aL=aV>>>21|bq<<11;Q=bq>>21|((bq|0)<0?-1:0)<<11;B=bf(a2,aJ,br,bo)|0;bo=bg(B,D,N<<21|0>>>11,aT<<21|N>>>11)|0;N=bf(bo,D,aL,Q)|0;bo=D;aT=bg(aV,bq,aL<<21|0>>>11,Q<<21|aL>>>11)|0;aL=D;Q=N>>>21|bo<<11;bq=bo>>21|((bo|0)<0?-1:0)<<11;aV=bf(O,aM,Q,bq)|0;aM=D;O=bg(N,bo,Q<<21|0>>>11,bq<<21|Q>>>11)|0;Q=D;bq=aV>>>21|aM<<11;bo=aM>>21|((aM|0)<0?-1:0)<<11;N=bf(bq,bo,bn,aU)|0;aU=D;bn=bg(aV,aM,bq<<21|0>>>11,bo<<21|bq>>>11)|0;bq=D;bo=N>>>21|aU<<11;aM=aU>>21|((aU|0)<0?-1:0)<<11;aV=bf(bc,a3,bo,aM)|0;a3=D;bc=bg(N,aU,bo<<21|0>>>11,aM<<21|bo>>>11)|0;bo=D;aM=aV>>>21|a3<<11;aU=a3>>21|((a3|0)<0?-1:0)<<11;N=bf(aM,aU,a9,by)|0;by=D;a9=bg(aV,a3,aM<<21|0>>>11,aU<<21|aM>>>11)|0;aM=D;aU=N>>>21|by<<11;a3=by>>21|((by|0)<0?-1:0)<<11;aV=bf(bj,a0,aU,a3)|0;a0=D;bj=bg(N,by,aU<<21|0>>>11,a3<<21|aU>>>11)|0;aU=D;a3=aV>>>21|a0<<11;by=a0>>21|((a0|0)<0?-1:0)<<11;N=bf(a3,by,bs,a7)|0;a7=D;bs=bg(aV,a0,a3<<21|0>>>11,by<<21|a3>>>11)|0;a3=D;by=N>>>21|a7<<11;a0=a7>>21|((a7|0)<0?-1:0)<<11;aV=bg(N,a7,by<<21|0>>>11,a0<<21|by>>>11)|0;a7=D;N=bp(by,a0,666643,0)|0;B=bf(N,D,aH,a$)|0;a$=D;aH=bp(by,a0,470296,0)|0;N=bf(bm,h,aH,D)|0;aH=D;h=bp(by,a0,654183,0)|0;bm=bf(az,ba,h,D)|0;h=D;ba=bp(by,a0,-997805,-1)|0;az=bf(bF,q,ba,D)|0;ba=D;q=bp(by,a0,136657,0)|0;bF=bf(aT,aL,q,D)|0;q=D;aL=bp(by,a0,-683901,-1)|0;a0=bf(O,Q,aL,D)|0;aL=D;Q=B>>>21|a$<<11;O=a$>>21|((a$|0)<0?-1:0)<<11;by=bf(N,aH,Q,O)|0;aH=D;N=bg(B,a$,Q<<21|0>>>11,O<<21|Q>>>11)|0;Q=D;O=by>>>21|aH<<11;a$=aH>>21|((aH|0)<0?-1:0)<<11;B=bf(bm,h,O,a$)|0;h=D;bm=bg(by,aH,O<<21|0>>>11,a$<<21|O>>>11)|0;O=D;a$=B>>>21|h<<11;aH=h>>21|((h|0)<0?-1:0)<<11;by=bf(az,ba,a$,aH)|0;ba=D;az=bg(B,h,a$<<21|0>>>11,aH<<21|a$>>>11)|0;a$=D;aH=by>>>21|ba<<11;h=ba>>21|((ba|0)<0?-1:0)<<11;B=bf(bF,q,aH,h)|0;q=D;bF=bg(by,ba,aH<<21|0>>>11,h<<21|aH>>>11)|0;aH=D;h=B>>>21|q<<11;ba=q>>21|((q|0)<0?-1:0)<<11;by=bf(a0,aL,h,ba)|0;aL=D;a0=bg(B,q,h<<21|0>>>11,ba<<21|h>>>11)|0;h=D;ba=by>>>21|aL<<11;q=aL>>21|((aL|0)<0?-1:0)<<11;B=bf(ba,q,bn,bq)|0;bq=D;bn=bg(by,aL,ba<<21|0>>>11,q<<21|ba>>>11)|0;ba=D;q=B>>>21|bq<<11;aL=bq>>21|((bq|0)<0?-1:0)<<11;by=bf(q,aL,bc,bo)|0;bo=D;bc=bg(B,bq,q<<21|0>>>11,aL<<21|q>>>11)|0;q=D;aL=by>>>21|bo<<11;bq=bo>>21|((bo|0)<0?-1:0)<<11;B=bf(aL,bq,a9,aM)|0;aM=D;a9=bg(by,bo,aL<<21|0>>>11,bq<<21|aL>>>11)|0;aL=D;bq=B>>>21|aM<<11;bo=aM>>21|((aM|0)<0?-1:0)<<11;by=bf(bq,bo,bj,aU)|0;aU=D;bj=bg(B,aM,bq<<21|0>>>11,bo<<21|bq>>>11)|0;bq=D;bo=by>>>21|aU<<11;aM=aU>>21|((aU|0)<0?-1:0)<<11;B=bf(bo,aM,bs,a3)|0;a3=D;bs=bg(by,aU,bo<<21|0>>>11,aM<<21|bo>>>11)|0;bo=D;aM=B>>>21|a3<<11;aU=a3>>21|((a3|0)<0?-1:0)<<11;by=bf(aM,aU,aV,a7)|0;a7=D;aV=bg(B,a3,aM<<21|0>>>11,aU<<21|aM>>>11)|0;aM=D;a[b]=N&255;a[c]=(N>>>8|Q<<24)&255;a[e]=(bm<<5|0>>>27|(N>>>16|Q<<16))&255;a[j]=(bm>>>3|O<<29)&255;a[l]=(bm>>>11|O<<21)&255;a[n]=(az<<2|0>>>30|(bm>>>19|O<<13))&255;a[r]=(az>>>6|a$<<26)&255;a[s]=(bF<<7|0>>>25|(az>>>14|a$<<18))&255;a[p]=(bF>>>1|aH<<31)&255;a[y]=(bF>>>9|aH<<23)&255;a[A]=(a0<<4|0>>>28|(bF>>>17|aH<<15))&255;a[v]=(a0>>>4|h<<28)&255;a[G]=(a0>>>12|h<<20)&255;a[I]=(bn<<1|0>>>31|(a0>>>20|h<<12))&255;a[C]=(bn>>>7|ba<<25)&255;a[M]=(bc<<6|0>>>26|(bn>>>15|ba<<17))&255;a[K]=(bc>>>2|q<<30)&255;a[S]=(bc>>>10|q<<22)&255;a[U]=(a9<<3|0>>>29|(bc>>>18|q<<14))&255;a[P]=(a9>>>5|aL<<27)&255;a[Y]=(a9>>>13|aL<<19)&255;a[W]=bj&255;a[aa]=(bj>>>8|bq<<24)&255;a[ab]=(bs<<5|0>>>27|(bj>>>16|bq<<16))&255;a[ag]=(bs>>>3|bo<<29)&255;a[ai]=(bs>>>11|bo<<21)&255;a[ak]=(aV<<2|0>>>30|(bs>>>19|bo<<13))&255;a[ao]=(aV>>>6|aM<<26)&255;a[ap]=(aV>>>14|aM<<18|(by<<7|0>>>25))&255;a[am]=(by>>>1|a7<<31)&255;a[av]=(by>>>9|a7<<23)&255;a[ax]=(by>>>17|a7<<15)&255;return}function a8(a){a=a|0;var b=0;bb(a+128|0,31520,64);b=a+192|0;c[b>>2]=0;c[b+4>>2]=0;return}function a9(a,b){a=a|0;b=b|0;var e=0,f=0,g=0,h=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0,L=0,M=0,N=0,O=0,P=0,Q=0,R=0,S=0,T=0,U=0,V=0,W=0,X=0,Y=0,Z=0,_=0,$=0,aa=0,ab=0,ac=0,ad=0,ae=0,af=0,ag=0,ah=0,ai=0,aj=0,ak=0,al=0,am=0;e=i;i=i+640|0;f=e|0;g=0;do{h=g<<3;j=d[a+(h|4)|0]|0;k=d[a+(h|5)|0]|0;l=d[a+(h|6)|0]|0;m=(d[a+(h|1)|0]|0)<<16|0>>>16|((d[a+h|0]|0)<<24|0>>>8)|((d[a+(h|2)|0]|0)<<8|0>>>24)|(d[a+(h|3)|0]|0)|(0<<24|j>>>8)|(0<<16|k>>>16)|(0<<8|l>>>24)|0;n=f+(g<<3)|0;c[n>>2]=0<<16|0>>>16|(0<<24|0>>>8)|(0<<8|0>>>24)|(j<<24|0>>>8)|(k<<16|0>>>16)|(l<<8|0>>>24)|(d[a+(h|7)|0]|0);c[n+4>>2]=m;g=g+1|0;}while((g|0)<16);g=f|0;a=16;m=c[g+4>>2]|0;n=c[g>>2]|0;while(1){g=f+(a-2<<3)|0;h=c[g>>2]|0;l=c[g+4>>2]|0;g=f+(a-7<<3)|0;k=f+(a-15<<3)|0;j=c[k>>2]|0;o=c[k+4>>2]|0;k=bf(n,m,c[g>>2]|0,c[g+4>>2]|0)|0;g=bf(k,D,(h<<3|0>>>29|(l>>>29|0<<3))^(h>>>6|l<<26)^(0<<13|0>>>19|(h>>>19|l<<13)),(l<<3|h>>>29|(0>>>29|0<<3))^(l>>>6|0<<26)^(h<<13|0>>>19|(l>>>19|0<<13)))|0;l=bf(g,D,(0<<24|0>>>8|(j>>>8|o<<24))^(j>>>7|o<<25)^(0<<31|0>>>1|(j>>>1|o<<31)),(j<<24|0>>>8|(o>>>8|0<<24))^(o>>>7|0<<25)^(j<<31|0>>>1|(o>>>1|0<<31)))|0;g=f+(a<<3)|0;c[g>>2]=l;c[g+4>>2]=D;g=a+1|0;if((g|0)<80){a=g;m=o;n=j}else{break}}n=c[b>>2]|0;m=c[b+4>>2]|0;a=b+8|0;j=c[a>>2]|0;o=c[a+4>>2]|0;g=b+16|0;l=c[g>>2]|0;h=c[g+4>>2]|0;k=b+24|0;p=c[k>>2]|0;q=c[k+4>>2]|0;r=b+32|0;s=c[r>>2]|0;t=c[r+4>>2]|0;u=b+40|0;v=c[u>>2]|0;w=c[u+4>>2]|0;x=b+48|0;y=c[x>>2]|0;z=c[x+4>>2]|0;A=b+56|0;B=c[A>>2]|0;C=c[A+4>>2]|0;E=C;F=B;G=z;H=y;I=w;J=v;K=t;L=s;M=q;N=p;O=h;P=l;Q=o;R=j;S=m;T=n;U=0;do{V=30880+(U<<3)|0;W=c[V>>2]|0;X=c[V+4>>2]|0;V=f+(U<<3)|0;Y=c[V>>2]|0;Z=c[V+4>>2]|0;V=bf((J^H)&L^H,(I^G)&K^G,F,E)|0;_=bf(V,D,(0<<18|0>>>14|(L>>>14|K<<18))^(0<<14|0>>>18|(L>>>18|K<<14))^(L<<23|0>>>9|(K>>>9|0<<23)),(L<<18|0>>>14|(K>>>14|0<<18))^(L<<14|0>>>18|(K>>>18|0<<14))^(K<<23|L>>>9|(0>>>9|0<<23)))|0;V=bf(_,D,W,X)|0;X=bf(V,D,Y,Z)|0;Z=D;Y=bf((0<<4|0>>>28|(T>>>28|S<<4))^(T<<30|0>>>2|(S>>>2|0<<30))^(T<<25|0>>>7|(S>>>7|0<<25)),(T<<4|0>>>28|(S>>>28|0<<4))^(S<<30|T>>>2|(0>>>2|0<<30))^(S<<25|T>>>7|(0>>>7|0<<25)),(T|R)&P|T&R,(S|Q)&O|S&Q)|0;V=D;W=bf(X,Z,N,M)|0;_=D;$=bf(Y,V,X,Z)|0;Z=D;X=U|1;V=30880+(X<<3)|0;Y=f+(X<<3)|0;X=c[Y>>2]|0;aa=c[Y+4>>2]|0;Y=bf(c[V>>2]|0,c[V+4>>2]|0,H,G)|0;V=bf(Y,D,X,aa)|0;aa=bf(V,D,W&(L^J)^J,_&(K^I)^I)|0;V=bf(aa,D,(0<<18|0>>>14|(W>>>14|_<<18))^(0<<14|0>>>18|(W>>>18|_<<14))^(W<<23|0>>>9|(_>>>9|0<<23)),(W<<18|0>>>14|(_>>>14|0<<18))^(W<<14|0>>>18|(_>>>18|0<<14))^(_<<23|W>>>9|(0>>>9|0<<23)))|0;aa=D;X=bf((0<<4|0>>>28|($>>>28|Z<<4))^($<<30|0>>>2|(Z>>>2|0<<30))^($<<25|0>>>7|(Z>>>7|0<<25)),($<<4|0>>>28|(Z>>>28|0<<4))^(Z<<30|$>>>2|(0>>>2|0<<30))^(Z<<25|$>>>7|(0>>>7|0<<25)),($|T)&R|$&T,(Z|S)&Q|Z&S)|0;Y=D;ab=bf(V,aa,P,O)|0;ac=D;ad=bf(X,Y,V,aa)|0;aa=D;V=U|2;Y=30880+(V<<3)|0;X=f+(V<<3)|0;V=c[X>>2]|0;ae=c[X+4>>2]|0;X=bf(c[Y>>2]|0,c[Y+4>>2]|0,J,I)|0;Y=bf(X,D,V,ae)|0;ae=bf(Y,D,ab&(W^L)^L,ac&(_^K)^K)|0;Y=bf(ae,D,(0<<18|0>>>14|(ab>>>14|ac<<18))^(0<<14|0>>>18|(ab>>>18|ac<<14))^(ab<<23|0>>>9|(ac>>>9|0<<23)),(ab<<18|0>>>14|(ac>>>14|0<<18))^(ab<<14|0>>>18|(ac>>>18|0<<14))^(ac<<23|ab>>>9|(0>>>9|0<<23)))|0;ae=D;V=bf((0<<4|0>>>28|(ad>>>28|aa<<4))^(ad<<30|0>>>2|(aa>>>2|0<<30))^(ad<<25|0>>>7|(aa>>>7|0<<25)),(ad<<4|0>>>28|(aa>>>28|0<<4))^(aa<<30|ad>>>2|(0>>>2|0<<30))^(aa<<25|ad>>>7|(0>>>7|0<<25)),(ad|$)&T|ad&$,(aa|Z)&S|aa&Z)|0;X=D;af=bf(Y,ae,R,Q)|0;ag=D;ah=bf(V,X,Y,ae)|0;ae=D;Y=U|3;X=30880+(Y<<3)|0;V=f+(Y<<3)|0;Y=c[V>>2]|0;ai=c[V+4>>2]|0;V=bf(c[X>>2]|0,c[X+4>>2]|0,L,K)|0;X=bf(V,D,Y,ai)|0;ai=bf(X,D,af&(ab^W)^W,ag&(ac^_)^_)|0;X=bf(ai,D,(0<<18|0>>>14|(af>>>14|ag<<18))^(0<<14|0>>>18|(af>>>18|ag<<14))^(af<<23|0>>>9|(ag>>>9|0<<23)),(af<<18|0>>>14|(ag>>>14|0<<18))^(af<<14|0>>>18|(ag>>>18|0<<14))^(ag<<23|af>>>9|(0>>>9|0<<23)))|0;ai=D;Y=bf((0<<4|0>>>28|(ah>>>28|ae<<4))^(ah<<30|0>>>2|(ae>>>2|0<<30))^(ah<<25|0>>>7|(ae>>>7|0<<25)),(ah<<4|0>>>28|(ae>>>28|0<<4))^(ae<<30|ah>>>2|(0>>>2|0<<30))^(ae<<25|ah>>>7|(0>>>7|0<<25)),(ah|ad)&$|ah&ad,(ae|aa)&Z|ae&aa)|0;V=D;aj=bf(X,ai,T,S)|0;ak=D;al=bf(Y,V,X,ai)|0;ai=D;X=U|4;V=30880+(X<<3)|0;Y=f+(X<<3)|0;X=c[Y>>2]|0;am=c[Y+4>>2]|0;Y=bf(c[V>>2]|0,c[V+4>>2]|0,W,_)|0;_=bf(Y,D,X,am)|0;am=bf(_,D,aj&(af^ab)^ab,ak&(ag^ac)^ac)|0;_=bf(am,D,(0<<18|0>>>14|(aj>>>14|ak<<18))^(0<<14|0>>>18|(aj>>>18|ak<<14))^(aj<<23|0>>>9|(ak>>>9|0<<23)),(aj<<18|0>>>14|(ak>>>14|0<<18))^(aj<<14|0>>>18|(ak>>>18|0<<14))^(ak<<23|aj>>>9|(0>>>9|0<<23)))|0;am=D;X=bf((0<<4|0>>>28|(al>>>28|ai<<4))^(al<<30|0>>>2|(ai>>>2|0<<30))^(al<<25|0>>>7|(ai>>>7|0<<25)),(al<<4|0>>>28|(ai>>>28|0<<4))^(ai<<30|al>>>2|(0>>>2|0<<30))^(ai<<25|al>>>7|(0>>>7|0<<25)),(al|ah)&ad|al&ah,(ai|ae)&aa|ai&ae)|0;Y=D;F=bf(_,am,$,Z)|0;E=D;N=bf(X,Y,_,am)|0;M=D;am=U|5;_=30880+(am<<3)|0;Y=f+(am<<3)|0;am=c[Y>>2]|0;X=c[Y+4>>2]|0;Y=bf(c[_>>2]|0,c[_+4>>2]|0,ab,ac)|0;ac=bf(Y,D,am,X)|0;X=bf(ac,D,F&(aj^af)^af,E&(ak^ag)^ag)|0;ac=bf(X,D,(0<<18|0>>>14|(F>>>14|E<<18))^(0<<14|0>>>18|(F>>>18|E<<14))^(F<<23|0>>>9|(E>>>9|0<<23)),(F<<18|0>>>14|(E>>>14|0<<18))^(F<<14|0>>>18|(E>>>18|0<<14))^(E<<23|F>>>9|(0>>>9|0<<23)))|0;X=D;am=bf((0<<4|0>>>28|(N>>>28|M<<4))^(N<<30|0>>>2|(M>>>2|0<<30))^(N<<25|0>>>7|(M>>>7|0<<25)),(N<<4|0>>>28|(M>>>28|0<<4))^(M<<30|N>>>2|(0>>>2|0<<30))^(M<<25|N>>>7|(0>>>7|0<<25)),(N|al)&ah|N&al,(M|ai)&ae|M&ai)|0;Y=D;H=bf(ac,X,ad,aa)|0;G=D;P=bf(am,Y,ac,X)|0;O=D;X=U|6;ac=30880+(X<<3)|0;Y=f+(X<<3)|0;X=bf(c[Y>>2]|0,c[Y+4>>2]|0,c[ac>>2]|0,c[ac+4>>2]|0)|0;ac=bf(X,D,af,ag)|0;ag=bf(ac,D,H&(F^aj)^aj,G&(E^ak)^ak)|0;ac=bf(ag,D,(0<<18|0>>>14|(H>>>14|G<<18))^(0<<14|0>>>18|(H>>>18|G<<14))^(H<<23|0>>>9|(G>>>9|0<<23)),(H<<18|0>>>14|(G>>>14|0<<18))^(H<<14|0>>>18|(G>>>18|0<<14))^(G<<23|H>>>9|(0>>>9|0<<23)))|0;ag=D;af=bf((0<<4|0>>>28|(P>>>28|O<<4))^(P<<30|0>>>2|(O>>>2|0<<30))^(P<<25|0>>>7|(O>>>7|0<<25)),(P<<4|0>>>28|(O>>>28|0<<4))^(O<<30|P>>>2|(0>>>2|0<<30))^(O<<25|P>>>7|(0>>>7|0<<25)),(P|N)&al|P&N,(O|M)&ai|O&M)|0;X=D;J=bf(ac,ag,ah,ae)|0;I=D;R=bf(af,X,ac,ag)|0;Q=D;ag=U|7;ac=30880+(ag<<3)|0;X=f+(ag<<3)|0;ag=bf(c[X>>2]|0,c[X+4>>2]|0,c[ac>>2]|0,c[ac+4>>2]|0)|0;ac=bf(ag,D,aj,ak)|0;ak=bf(ac,D,J&(H^F)^F,I&(G^E)^E)|0;ac=bf(ak,D,(0<<18|0>>>14|(J>>>14|I<<18))^(0<<14|0>>>18|(J>>>18|I<<14))^(J<<23|0>>>9|(I>>>9|0<<23)),(J<<18|0>>>14|(I>>>14|0<<18))^(J<<14|0>>>18|(I>>>18|0<<14))^(I<<23|J>>>9|(0>>>9|0<<23)))|0;ak=D;aj=bf((0<<4|0>>>28|(R>>>28|Q<<4))^(R<<30|0>>>2|(Q>>>2|0<<30))^(R<<25|0>>>7|(Q>>>7|0<<25)),(R<<4|0>>>28|(Q>>>28|0<<4))^(Q<<30|R>>>2|(0>>>2|0<<30))^(Q<<25|R>>>7|(0>>>7|0<<25)),(R|P)&N|R&P,(Q|O)&M|Q&O)|0;ag=D;L=bf(ac,ak,al,ai)|0;K=D;T=bf(aj,ag,ac,ak)|0;S=D;U=U+8|0;}while((U|0)<80);U=bf(n,m,T,S)|0;c[b>>2]=U;c[b+4>>2]=D;b=bf(j,o,R,Q)|0;c[a>>2]=b;c[a+4>>2]=D;a=bf(l,h,P,O)|0;c[g>>2]=a;c[g+4>>2]=D;g=bf(p,q,N,M)|0;c[k>>2]=g;c[k+4>>2]=D;k=bf(s,t,L,K)|0;c[r>>2]=k;c[r+4>>2]=D;r=bf(v,w,J,I)|0;c[u>>2]=r;c[u+4>>2]=D;u=bf(y,z,H,G)|0;c[x>>2]=u;c[x+4>>2]=D;x=bf(B,C,F,E)|0;c[A>>2]=x;c[A+4>>2]=D;i=e;return}function ba(b,d,e,f,g){b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;var h=0,i=0,j=0,k=0,l=0,m=0,n=0;h=b+192|0;i=c[h>>2]&127;j=128>>>(e>>>0);k=i+1|0;a[b+i|0]=(-j&d|j)&255;j=b+k|0;if(k>>>0>112){bd(j|0,0,i^127|0);k=b+128|0;d=k;a9(b,d);bd(b|0,0,112);l=k;m=d}else{bd(j|0,0,111-i|0);i=b+128|0;l=i;m=i}i=c[h>>2]|0;j=c[h+4>>2]|0;bd(b+112|0,0,7);a[b+119|0]=(j>>>29|0<<3)&255;h=bf(i<<3|0>>>29,j<<3|i>>>29,e,0)|0;e=D;a[b+120|0]=(e>>>24|0<<8)&255;a[b+121|0]=(e>>>16|0<<16)&255;a[b+122|0]=(e>>>8|0<<24)&255;a[b+123|0]=e&255;a[b+124|0]=(h>>>24|e<<8)&255;a[b+125|0]=(h>>>16|e<<16)&255;a[b+126|0]=(h>>>8|e<<24)&255;a[b+127|0]=h&255;h=l;a9(b,m);if((g|0)==0){return}else{n=0}do{m=n<<3;b=h+(n<<3)|0;l=c[b>>2]|0;e=c[b+4>>2]|0;a[f+m|0]=(e>>>24|0<<8)&255;a[f+(m|1)|0]=(e>>>16|0<<16)&255;a[f+(m|2)|0]=(e>>>8|0<<24)&255;a[f+(m|3)|0]=e&255;a[f+(m|4)|0]=(l>>>24|e<<8)&255;a[f+(m|5)|0]=(l>>>16|e<<16)&255;a[f+(m|6)|0]=(l>>>8|e<<24)&255;a[f+(m|7)|0]=l&255;n=n+1|0;}while(n>>>0<g>>>0);return}function bb(b,d,e){b=b|0;d=d|0;e=e|0;var f=0;f=b|0;if((b&3)==(d&3)){while(b&3){if((e|0)==0)return f|0;a[b]=a[d]|0;b=b+1|0;d=d+1|0;e=e-1|0}while((e|0)>=4){c[b>>2]=c[d>>2];b=b+4|0;d=d+4|0;e=e-4|0}}while((e|0)>0){a[b]=a[d]|0;b=b+1|0;d=d+1|0;e=e-1|0}return f|0}function bc(b,c,d){b=b|0;c=c|0;d=d|0;if((c|0)<(b|0)&(b|0)<(c+d|0)){c=c+d|0;b=b+d|0;while((d|0)>0){b=b-1|0;c=c-1|0;d=d-1|0;a[b]=a[c]|0}}else{bb(b,c,d)}}function bd(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0;f=b+e|0;if((e|0)>=20){d=d&255;e=b&3;g=d|d<<8|d<<16|d<<24;h=f&~3;if(e){e=b+4-e|0;while((b|0)<(e|0)){a[b]=d;b=b+1|0}}while((b|0)<(h|0)){c[b>>2]=g;b=b+4|0}}while((b|0)<(f|0)){a[b]=d;b=b+1|0}}function be(b){b=b|0;var c=0;c=b;while(a[c]|0){c=c+1|0}return c-b|0}function bf(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;var e=0;e=a+c>>>0;return(D=b+d+(e>>>0<a>>>0|0)>>>0,e|0)|0}function bg(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;var e=0;e=b-d>>>0;e=b-d-(c>>>0>a>>>0|0)>>>0;return(D=e,a-c>>>0|0)|0}function bh(a,b,c){a=a|0;b=b|0;c=c|0;if((c|0)<32){D=b<<c|(a&(1<<c)-1<<32-c)>>>32-c;return a<<c}D=a<<c-32;return 0}function bi(a,b,c){a=a|0;b=b|0;c=c|0;if((c|0)<32){D=b>>>c;return a>>>c|(b&(1<<c)-1)<<32-c}D=0;return b>>>c-32|0}function bj(a,b,c){a=a|0;b=b|0;c=c|0;if((c|0)<32){D=b>>c;return a>>>c|(b&(1<<c)-1)<<32-c}D=(b|0)<0?-1:0;return b>>c-32|0}function bk(b){b=b|0;var c=0;c=a[n+(b>>>24)|0]|0;if((c|0)<8)return c|0;c=a[n+(b>>16&255)|0]|0;if((c|0)<8)return c+8|0;c=a[n+(b>>8&255)|0]|0;if((c|0)<8)return c+16|0;return(a[n+(b&255)|0]|0)+24|0}function bl(b){b=b|0;var c=0;c=a[m+(b&255)|0]|0;if((c|0)<8)return c|0;c=a[m+(b>>8&255)|0]|0;if((c|0)<8)return c+8|0;c=a[m+(b>>16&255)|0]|0;if((c|0)<8)return c+16|0;return(a[m+(b>>>24)|0]|0)+24|0}function bm(a,b){a=a|0;b=b|0;var c=0,d=0,e=0,f=0;c=a&65535;d=b&65535;e=$(d,c);f=a>>>16;a=(e>>>16)+$(d,f)|0;d=b>>>16;b=$(d,c);return(D=((a>>>16)+$(d,f)|0)+(((a&65535)+b|0)>>>16)|0,0|(a+b<<16|e&65535))|0}function bn(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;var e=0,f=0,g=0,h=0,i=0;e=b>>31|((b|0)<0?-1:0)<<1;f=((b|0)<0?-1:0)>>31|((b|0)<0?-1:0)<<1;g=d>>31|((d|0)<0?-1:0)<<1;h=((d|0)<0?-1:0)>>31|((d|0)<0?-1:0)<<1;i=bg(e^a,f^b,e,f)|0;b=D;a=g^e;e=h^f;f=bg(bs(i,b,bg(g^c,h^d,g,h)|0,D,0)^a,D^e,a,e)|0;return(D=D,f)|0}function bo(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,j=0,k=0,l=0,m=0;f=i;i=i+8|0;g=f|0;h=b>>31|((b|0)<0?-1:0)<<1;j=((b|0)<0?-1:0)>>31|((b|0)<0?-1:0)<<1;k=e>>31|((e|0)<0?-1:0)<<1;l=((e|0)<0?-1:0)>>31|((e|0)<0?-1:0)<<1;m=bg(h^a,j^b,h,j)|0;b=D;bs(m,b,bg(k^d,l^e,k,l)|0,D,g);l=bg(c[g>>2]^h,c[g+4>>2]^j,h,j)|0;j=D;i=f;return(D=j,l)|0}function bp(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;var e=0,f=0;e=a;a=c;c=bm(e,a)|0;f=D;return(D=($(b,a)+$(d,e)|0)+f|f&0,0|c&-1)|0}function bq(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;var e=0;e=bs(a,b,c,d,0)|0;return(D=D,e)|0}function br(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0;f=i;i=i+8|0;g=f|0;bs(a,b,d,e,g);i=f;return(D=c[g+4>>2]|0,c[g>>2]|0)|0}function bs(a,b,d,e,f){a=a|0;b=b|0;d=d|0;e=e|0;f=f|0;var g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0,L=0,M=0;g=a;h=b;i=h;j=d;k=e;l=k;if((i|0)==0){m=(f|0)!=0;if((l|0)==0){if(m){c[f>>2]=(g>>>0)%(j>>>0);c[f+4>>2]=0}n=0;o=(g>>>0)/(j>>>0)>>>0;return(D=n,o)|0}else{if(!m){n=0;o=0;return(D=n,o)|0}c[f>>2]=a&-1;c[f+4>>2]=b&0;n=0;o=0;return(D=n,o)|0}}m=(l|0)==0;do{if((j|0)==0){if(m){if((f|0)!=0){c[f>>2]=(i>>>0)%(j>>>0);c[f+4>>2]=0}n=0;o=(i>>>0)/(j>>>0)>>>0;return(D=n,o)|0}if((g|0)==0){if((f|0)!=0){c[f>>2]=0;c[f+4>>2]=(i>>>0)%(l>>>0)}n=0;o=(i>>>0)/(l>>>0)>>>0;return(D=n,o)|0}p=l-1|0;if((p&l|0)==0){if((f|0)!=0){c[f>>2]=a&-1;c[f+4>>2]=p&i|b&0}n=0;o=i>>>((bl(l|0)|0)>>>0);return(D=n,o)|0}p=(bk(l|0)|0)-(bk(i|0)|0)|0;if(p>>>0<=30){q=p+1|0;r=31-p|0;s=q;t=i<<r|g>>>(q>>>0);u=i>>>(q>>>0);v=0;w=g<<r;break}if((f|0)==0){n=0;o=0;return(D=n,o)|0}c[f>>2]=a&-1;c[f+4>>2]=h|b&0;n=0;o=0;return(D=n,o)|0}else{if(!m){r=(bk(l|0)|0)-(bk(i|0)|0)|0;if(r>>>0<=31){q=r+1|0;p=31-r|0;x=r-31>>31;s=q;t=g>>>(q>>>0)&x|i<<p;u=i>>>(q>>>0)&x;v=0;w=g<<p;break}if((f|0)==0){n=0;o=0;return(D=n,o)|0}c[f>>2]=a&-1;c[f+4>>2]=h|b&0;n=0;o=0;return(D=n,o)|0}p=j-1|0;if((p&j|0)!=0){x=((bk(j|0)|0)+33|0)-(bk(i|0)|0)|0;q=64-x|0;r=32-x|0;y=r>>31;z=x-32|0;A=z>>31;s=x;t=r-1>>31&i>>>(z>>>0)|(i<<r|g>>>(x>>>0))&A;u=A&i>>>(x>>>0);v=g<<q&y;w=(i<<q|g>>>(z>>>0))&y|g<<r&x-33>>31;break}if((f|0)!=0){c[f>>2]=p&g;c[f+4>>2]=0}if((j|0)==1){n=h|b&0;o=a&-1|0;return(D=n,o)|0}else{p=bl(j|0)|0;n=i>>>(p>>>0)|0;o=i<<32-p|g>>>(p>>>0)|0;return(D=n,o)|0}}}while(0);if((s|0)==0){B=w;C=v;E=u;F=t;G=0;H=0}else{g=d&-1|0;d=k|e&0;e=bf(g,d,-1,-1)|0;k=D;i=w;w=v;v=u;u=t;t=s;s=0;while(1){I=w>>>31|i<<1;J=s|w<<1;j=u<<1|i>>>31|0;a=u>>>31|v<<1|0;bg(e,k,j,a);b=D;h=b>>31|((b|0)<0?-1:0)<<1;K=h&1;L=bg(j,a,h&g,(((b|0)<0?-1:0)>>31|((b|0)<0?-1:0)<<1)&d)|0;M=D;b=t-1|0;if((b|0)==0){break}else{i=I;w=J;v=M;u=L;t=b;s=K}}B=I;C=J;E=M;F=L;G=0;H=K}K=C;C=0;if((f|0)!=0){c[f>>2]=F;c[f+4>>2]=E}n=(0|K)>>>31|(B|C)<<1|(C<<1|K>>>31)&0|G;o=(K<<1|0>>>31)&-2|H;return(D=n,o)|0}function bt(a,b){a=a|0;b=b|0;return ap[a&1](b|0)|0}function bu(a){a=a|0;aq[a&1]()}function bv(a,b,c){a=a|0;b=b|0;c=c|0;return ar[a&1](b|0,c|0)|0}function bw(a,b){a=a|0;b=b|0;as[a&1](b|0)}function bx(a){a=a|0;aa(0);return 0}function by(){aa(1)}function bz(a,b){a=a|0;b=b|0;aa(2);return 0}function bA(a){a=a|0;aa(3)}
// EMSCRIPTEN_END_FUNCS
var ap=[bx,bx];var aq=[by,by];var ar=[bz,bz];var as=[bA,bA];return{_curve25519_verify:aJ,_crypto_sign_ed25519_ref10_ge_scalarmult_base:a2,_strlen:be,_memmove:bc,_sph_sha512_init:a8,_curve25519_donna:aL,_memset:bd,_memcpy:bb,_curve25519_sign:aI,stackAlloc:at,stackSave:au,stackRestore:av,setThrew:aw,setTempRet0:ax,setTempRet1:ay,setTempRet2:az,setTempRet3:aA,setTempRet4:aB,setTempRet5:aC,setTempRet6:aD,setTempRet7:aE,setTempRet8:aF,setTempRet9:aG,dynCall_ii:bt,dynCall_v:bu,dynCall_iii:bv,dynCall_vi:bw}})
// EMSCRIPTEN_END_ASM
({ "Math": Math, "Int8Array": Int8Array, "Int16Array": Int16Array, "Int32Array": Int32Array, "Uint8Array": Uint8Array, "Uint16Array": Uint16Array, "Uint32Array": Uint32Array, "Float32Array": Float32Array, "Float64Array": Float64Array }, { "abort": abort, "assert": assert, "asmPrintInt": asmPrintInt, "asmPrintFloat": asmPrintFloat, "copyTempDouble": copyTempDouble, "copyTempFloat": copyTempFloat, "min": Math_min, "invoke_ii": invoke_ii, "invoke_v": invoke_v, "invoke_iii": invoke_iii, "invoke_vi": invoke_vi, "_llvm_lifetime_end": _llvm_lifetime_end, "_malloc": _malloc, "_free": _free, "_llvm_lifetime_start": _llvm_lifetime_start, "STACKTOP": STACKTOP, "STACK_MAX": STACK_MAX, "tempDoublePtr": tempDoublePtr, "ABORT": ABORT, "cttz_i8": cttz_i8, "ctlz_i8": ctlz_i8, "NaN": NaN, "Infinity": Infinity }, buffer);
var _curve25519_verify = Module["_curve25519_verify"] = asm["_curve25519_verify"];
var _crypto_sign_ed25519_ref10_ge_scalarmult_base = Module["_crypto_sign_ed25519_ref10_ge_scalarmult_base"] = asm["_crypto_sign_ed25519_ref10_ge_scalarmult_base"];
var _strlen = Module["_strlen"] = asm["_strlen"];
var _memmove = Module["_memmove"] = asm["_memmove"];
var _sph_sha512_init = Module["_sph_sha512_init"] = asm["_sph_sha512_init"];
var _curve25519_donna = Module["_curve25519_donna"] = asm["_curve25519_donna"];
var _memset = Module["_memset"] = asm["_memset"];
var _memcpy = Module["_memcpy"] = asm["_memcpy"];
var _curve25519_sign = Module["_curve25519_sign"] = asm["_curve25519_sign"];
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

/* vim: ts=4:sw=4:expandtab
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

    // Insert some bytes into the emscripten memory and return a pointer
    function _allocate(bytes) {
        var address = Module._malloc(bytes.length);
        Module.HEAPU8.set(bytes, address);

        return address;
    }

    function _readBytes(address, length, array) {
        array.set(Module.HEAPU8.subarray(address, address + length));
    }

    var basepoint = new Uint8Array(32);
    basepoint[0] = 9;

    window.curve25519 = {
        keyPair: function(privKey) {
            var priv = new Uint8Array(privKey);
            priv[0]  &= 248;
            priv[31] &= 127;
            priv[31] |= 64

            // Where to store the result
            var publicKey_ptr = Module._malloc(32);

            // Get a pointer to the private key
            var privateKey_ptr = _allocate(priv);

            // The basepoint for generating public keys
            var basepoint_ptr = _allocate(basepoint);

            // The return value is just 0, the operation is done in place
            var err = Module._curve25519_donna(publicKey_ptr,
                                               privateKey_ptr,
                                               basepoint_ptr);

            var res = new Uint8Array(32);
            _readBytes(publicKey_ptr, 32, res);

            return Promise.resolve({ pubKey: res.buffer, privKey: privKey });
        },
        sharedSecret: function(pubKey, privKey) {
            // Where to store the result
            var sharedKey_ptr = Module._malloc(32);

            // Get a pointer to our private key
            var privateKey_ptr = _allocate(new Uint8Array(privKey));

            // Get a pointer to their public key, the basepoint when you're
            // generating a shared secret
            var basepoint_ptr = _allocate(new Uint8Array(pubKey));

            // Return value is 0 here too of course
            var err = Module._curve25519_donna(sharedKey_ptr,
                                               privateKey_ptr,
                                               basepoint_ptr);

            var res = new Uint8Array(32);
            _readBytes(sharedKey_ptr, 32, res);
            return Promise.resolve(res.buffer);
        },
        sign: function(privKey, message) {
            // Where to store the result
            var signature_ptr = Module._malloc(32);

            // Get a pointer to our private key
            var privateKey_ptr = _allocate(new Uint8Array(privKey));

            // Get a pointer to the message
            var message_ptr = _allocate(new Uint8Array(message));

            var err = Module._curve25519_sign(signature_ptr,
                                              privateKey_ptr,
                                              message_ptr,
                                              message.byteLength);

            var res = new Uint8Array(64);
            _readBytes(signature_ptr, 64, res);
            return Promise.resolve(res.buffer);
        },
        verify: function(pubKey, message, sig) {
            // Get a pointer to their public key
            var publicKey_ptr = _allocate(new Uint8Array(pubKey));

            // Get a pointer to the signature
            var signature_ptr = _allocate(new Uint8Array(sig));

            // Get a pointer to the message
            var message_ptr = _allocate(new Uint8Array(message));

            var res = Module._curve25519_verify(signature_ptr,
                                                publicKey_ptr,
                                                message_ptr,
                                                message.byteLength);

            return new Promise(function(resolve, reject) {
                if (res !== 0) {
                    reject(new Error("Invalid signature"));
                } else {
                    resolve();
                }
            });
        }
    };
})();

})();
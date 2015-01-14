;(function(){
var Module;if(!Module)Module=(typeof Module!=="undefined"?Module:null)||{};var moduleOverrides={};for(var key in Module){if(Module.hasOwnProperty(key)){moduleOverrides[key]=Module[key]}}var ENVIRONMENT_IS_NODE=typeof process==="object"&&typeof require==="function";var ENVIRONMENT_IS_WEB=typeof window==="object";var ENVIRONMENT_IS_WORKER=typeof importScripts==="function";var ENVIRONMENT_IS_SHELL=!ENVIRONMENT_IS_WEB&&!ENVIRONMENT_IS_NODE&&!ENVIRONMENT_IS_WORKER;if(ENVIRONMENT_IS_NODE){if(!Module["print"])Module["print"]=function print(x){process["stdout"].write(x+"\n")};if(!Module["printErr"])Module["printErr"]=function printErr(x){process["stderr"].write(x+"\n")};var nodeFS=require("fs");var nodePath=require("path");Module["read"]=function read(filename,binary){filename=nodePath["normalize"](filename);var ret=nodeFS["readFileSync"](filename);if(!ret&&filename!=nodePath["resolve"](filename)){filename=path.join(__dirname,"..","src",filename);ret=nodeFS["readFileSync"](filename)}if(ret&&!binary)ret=ret.toString();return ret};Module["readBinary"]=function readBinary(filename){return Module["read"](filename,true)};Module["load"]=function load(f){globalEval(read(f))};if(process["argv"].length>1){Module["thisProgram"]=process["argv"][1].replace(/\\/g,"/")}else{Module["thisProgram"]="unknown-program"}Module["arguments"]=process["argv"].slice(2);if(typeof module!=="undefined"){module["exports"]=Module}process["on"]("uncaughtException",(function(ex){if(!(ex instanceof ExitStatus)){throw ex}}))}else if(ENVIRONMENT_IS_SHELL){if(!Module["print"])Module["print"]=print;if(typeof printErr!="undefined")Module["printErr"]=printErr;if(typeof read!="undefined"){Module["read"]=read}else{Module["read"]=function read(){throw"no read() available (jsc?)"}}Module["readBinary"]=function readBinary(f){if(typeof readbuffer==="function"){return new Uint8Array(readbuffer(f))}var data=read(f,"binary");assert(typeof data==="object");return data};if(typeof scriptArgs!="undefined"){Module["arguments"]=scriptArgs}else if(typeof arguments!="undefined"){Module["arguments"]=arguments}this["Module"]=Module}else if(ENVIRONMENT_IS_WEB||ENVIRONMENT_IS_WORKER){Module["read"]=function read(url){var xhr=new XMLHttpRequest;xhr.open("GET",url,false);xhr.send(null);return xhr.responseText};if(typeof arguments!="undefined"){Module["arguments"]=arguments}if(typeof console!=="undefined"){if(!Module["print"])Module["print"]=function print(x){console.log(x)};if(!Module["printErr"])Module["printErr"]=function printErr(x){console.log(x)}}else{var TRY_USE_DUMP=false;if(!Module["print"])Module["print"]=TRY_USE_DUMP&&typeof dump!=="undefined"?(function(x){dump(x)}):(function(x){})}if(ENVIRONMENT_IS_WEB){window["Module"]=Module}else{Module["load"]=importScripts}}else{throw"Unknown runtime environment. Where are we?"}function globalEval(x){eval.call(null,x)}if(!Module["load"]&&Module["read"]){Module["load"]=function load(f){globalEval(Module["read"](f))}}if(!Module["print"]){Module["print"]=(function(){})}if(!Module["printErr"]){Module["printErr"]=Module["print"]}if(!Module["arguments"]){Module["arguments"]=[]}if(!Module["thisProgram"]){Module["thisProgram"]="./this.program"}Module.print=Module["print"];Module.printErr=Module["printErr"];Module["preRun"]=[];Module["postRun"]=[];for(var key in moduleOverrides){if(moduleOverrides.hasOwnProperty(key)){Module[key]=moduleOverrides[key]}}var Runtime={setTempRet0:(function(value){tempRet0=value}),getTempRet0:(function(){return tempRet0}),stackSave:(function(){return STACKTOP}),stackRestore:(function(stackTop){STACKTOP=stackTop}),getNativeTypeSize:(function(type){switch(type){case"i1":case"i8":return 1;case"i16":return 2;case"i32":return 4;case"i64":return 8;case"float":return 4;case"double":return 8;default:{if(type[type.length-1]==="*"){return Runtime.QUANTUM_SIZE}else if(type[0]==="i"){var bits=parseInt(type.substr(1));assert(bits%8===0);return bits/8}else{return 0}}}}),getNativeFieldSize:(function(type){return Math.max(Runtime.getNativeTypeSize(type),Runtime.QUANTUM_SIZE)}),STACK_ALIGN:16,getAlignSize:(function(type,size,vararg){if(!vararg&&(type=="i64"||type=="double"))return 8;if(!type)return Math.min(size,8);return Math.min(size||(type?Runtime.getNativeFieldSize(type):0),Runtime.QUANTUM_SIZE)}),dynCall:(function(sig,ptr,args){if(args&&args.length){if(!args.splice)args=Array.prototype.slice.call(args);args.splice(0,0,ptr);return Module["dynCall_"+sig].apply(null,args)}else{return Module["dynCall_"+sig].call(null,ptr)}}),functionPointers:[],addFunction:(function(func){for(var i=0;i<Runtime.functionPointers.length;i++){if(!Runtime.functionPointers[i]){Runtime.functionPointers[i]=func;return 2*(1+i)}}throw"Finished up all reserved function pointers. Use a higher value for RESERVED_FUNCTION_POINTERS."}),removeFunction:(function(index){Runtime.functionPointers[(index-2)/2]=null}),getAsmConst:(function(code,numArgs){if(!Runtime.asmConstCache)Runtime.asmConstCache={};var func=Runtime.asmConstCache[code];if(func)return func;var args=[];for(var i=0;i<numArgs;i++){args.push(String.fromCharCode(36)+i)}var source=Pointer_stringify(code);if(source[0]==='"'){if(source.indexOf('"',1)===source.length-1){source=source.substr(1,source.length-2)}else{abort("invalid EM_ASM input |"+source+"|. Please use EM_ASM(..code..) (no quotes) or EM_ASM({ ..code($0).. }, input) (to input values)")}}try{var evalled=eval("(function(Module, FS) { return function("+args.join(",")+"){ "+source+" } })")(Module,typeof FS!=="undefined"?FS:null)}catch(e){Module.printErr("error in executing inline EM_ASM code: "+e+" on: \n\n"+source+"\n\nwith args |"+args+"| (make sure to use the right one out of EM_ASM, EM_ASM_ARGS, etc.)");throw e}return Runtime.asmConstCache[code]=evalled}),warnOnce:(function(text){if(!Runtime.warnOnce.shown)Runtime.warnOnce.shown={};if(!Runtime.warnOnce.shown[text]){Runtime.warnOnce.shown[text]=1;Module.printErr(text)}}),funcWrappers:{},getFuncWrapper:(function(func,sig){assert(sig);if(!Runtime.funcWrappers[sig]){Runtime.funcWrappers[sig]={}}var sigCache=Runtime.funcWrappers[sig];if(!sigCache[func]){sigCache[func]=function dynCall_wrapper(){return Runtime.dynCall(sig,func,arguments)}}return sigCache[func]}),UTF8Processor:(function(){var buffer=[];var needed=0;this.processCChar=(function(code){code=code&255;if(buffer.length==0){if((code&128)==0){return String.fromCharCode(code)}buffer.push(code);if((code&224)==192){needed=1}else if((code&240)==224){needed=2}else{needed=3}return""}if(needed){buffer.push(code);needed--;if(needed>0)return""}var c1=buffer[0];var c2=buffer[1];var c3=buffer[2];var c4=buffer[3];var ret;if(buffer.length==2){ret=String.fromCharCode((c1&31)<<6|c2&63)}else if(buffer.length==3){ret=String.fromCharCode((c1&15)<<12|(c2&63)<<6|c3&63)}else{var codePoint=(c1&7)<<18|(c2&63)<<12|(c3&63)<<6|c4&63;ret=String.fromCharCode(((codePoint-65536)/1024|0)+55296,(codePoint-65536)%1024+56320)}buffer.length=0;return ret});this.processJSString=function processJSString(string){string=unescape(encodeURIComponent(string));var ret=[];for(var i=0;i<string.length;i++){ret.push(string.charCodeAt(i))}return ret}}),getCompilerSetting:(function(name){throw"You must build with -s RETAIN_COMPILER_SETTINGS=1 for Runtime.getCompilerSetting or emscripten_get_compiler_setting to work"}),stackAlloc:(function(size){var ret=STACKTOP;STACKTOP=STACKTOP+size|0;STACKTOP=STACKTOP+15&-16;return ret}),staticAlloc:(function(size){var ret=STATICTOP;STATICTOP=STATICTOP+size|0;STATICTOP=STATICTOP+15&-16;return ret}),dynamicAlloc:(function(size){var ret=DYNAMICTOP;DYNAMICTOP=DYNAMICTOP+size|0;DYNAMICTOP=DYNAMICTOP+15&-16;if(DYNAMICTOP>=TOTAL_MEMORY)enlargeMemory();return ret}),alignMemory:(function(size,quantum){var ret=size=Math.ceil(size/(quantum?quantum:16))*(quantum?quantum:16);return ret}),makeBigInt:(function(low,high,unsigned){var ret=unsigned?+(low>>>0)+ +(high>>>0)*+4294967296:+(low>>>0)+ +(high|0)*+4294967296;return ret}),GLOBAL_BASE:8,QUANTUM_SIZE:4,__dummy__:0};Module["Runtime"]=Runtime;var __THREW__=0;var ABORT=false;var EXITSTATUS=0;var undef=0;var tempValue,tempInt,tempBigInt,tempInt2,tempBigInt2,tempPair,tempBigIntI,tempBigIntR,tempBigIntS,tempBigIntP,tempBigIntD,tempDouble,tempFloat;var tempI64,tempI64b;var tempRet0,tempRet1,tempRet2,tempRet3,tempRet4,tempRet5,tempRet6,tempRet7,tempRet8,tempRet9;function assert(condition,text){if(!condition){abort("Assertion failed: "+text)}}var globalScope=this;function getCFunc(ident){var func=Module["_"+ident];if(!func){try{func=eval("_"+ident)}catch(e){}}assert(func,"Cannot call unknown function "+ident+" (perhaps LLVM optimizations or closure removed it?)");return func}var cwrap,ccall;((function(){var JSfuncs={"stackSave":(function(){Runtime.stackSave()}),"stackRestore":(function(){Runtime.stackRestore()}),"arrayToC":(function(arr){var ret=Runtime.stackAlloc(arr.length);writeArrayToMemory(arr,ret);return ret}),"stringToC":(function(str){var ret=0;if(str!==null&&str!==undefined&&str!==0){ret=Runtime.stackAlloc((str.length<<2)+1);writeStringToMemory(str,ret)}return ret})};var toC={"string":JSfuncs["stringToC"],"array":JSfuncs["arrayToC"]};ccall=function ccallFunc(ident,returnType,argTypes,args){var func=getCFunc(ident);var cArgs=[];var stack=0;if(args){for(var i=0;i<args.length;i++){var converter=toC[argTypes[i]];if(converter){if(stack===0)stack=Runtime.stackSave();cArgs[i]=converter(args[i])}else{cArgs[i]=args[i]}}}var ret=func.apply(null,cArgs);if(returnType==="string")ret=Pointer_stringify(ret);if(stack!==0)Runtime.stackRestore(stack);return ret};var sourceRegex=/^function\s*\(([^)]*)\)\s*{\s*([^*]*?)[\s;]*(?:return\s*(.*?)[;\s]*)?}$/;function parseJSFunc(jsfunc){var parsed=jsfunc.toString().match(sourceRegex).slice(1);return{arguments:parsed[0],body:parsed[1],returnValue:parsed[2]}}var JSsource={};for(var fun in JSfuncs){if(JSfuncs.hasOwnProperty(fun)){JSsource[fun]=parseJSFunc(JSfuncs[fun])}}cwrap=function cwrap(ident,returnType,argTypes){argTypes=argTypes||[];var cfunc=getCFunc(ident);var numericArgs=argTypes.every((function(type){return type==="number"}));var numericRet=returnType!=="string";if(numericRet&&numericArgs){return cfunc}var argNames=argTypes.map((function(x,i){return"$"+i}));var funcstr="(function("+argNames.join(",")+") {";var nargs=argTypes.length;if(!numericArgs){funcstr+="var stack = "+JSsource["stackSave"].body+";";for(var i=0;i<nargs;i++){var arg=argNames[i],type=argTypes[i];if(type==="number")continue;var convertCode=JSsource[type+"ToC"];funcstr+="var "+convertCode.arguments+" = "+arg+";";funcstr+=convertCode.body+";";funcstr+=arg+"="+convertCode.returnValue+";"}}var cfuncname=parseJSFunc((function(){return cfunc})).returnValue;funcstr+="var ret = "+cfuncname+"("+argNames.join(",")+");";if(!numericRet){var strgfy=parseJSFunc((function(){return Pointer_stringify})).returnValue;funcstr+="ret = "+strgfy+"(ret);"}if(!numericArgs){funcstr+=JSsource["stackRestore"].body.replace("()","(stack)")+";"}funcstr+="return ret})";return eval(funcstr)}}))();Module["cwrap"]=cwrap;Module["ccall"]=ccall;function setValue(ptr,value,type,noSafe){type=type||"i8";if(type.charAt(type.length-1)==="*")type="i32";switch(type){case"i1":HEAP8[ptr>>0]=value;break;case"i8":HEAP8[ptr>>0]=value;break;case"i16":HEAP16[ptr>>1]=value;break;case"i32":HEAP32[ptr>>2]=value;break;case"i64":tempI64=[value>>>0,(tempDouble=value,+Math_abs(tempDouble)>=+1?tempDouble>+0?(Math_min(+Math_floor(tempDouble/+4294967296),+4294967295)|0)>>>0:~~+Math_ceil((tempDouble- +(~~tempDouble>>>0))/+4294967296)>>>0:0)],HEAP32[ptr>>2]=tempI64[0],HEAP32[ptr+4>>2]=tempI64[1];break;case"float":HEAPF32[ptr>>2]=value;break;case"double":HEAPF64[ptr>>3]=value;break;default:abort("invalid type for setValue: "+type)}}Module["setValue"]=setValue;function getValue(ptr,type,noSafe){type=type||"i8";if(type.charAt(type.length-1)==="*")type="i32";switch(type){case"i1":return HEAP8[ptr>>0];case"i8":return HEAP8[ptr>>0];case"i16":return HEAP16[ptr>>1];case"i32":return HEAP32[ptr>>2];case"i64":return HEAP32[ptr>>2];case"float":return HEAPF32[ptr>>2];case"double":return HEAPF64[ptr>>3];default:abort("invalid type for setValue: "+type)}return null}Module["getValue"]=getValue;var ALLOC_NORMAL=0;var ALLOC_STACK=1;var ALLOC_STATIC=2;var ALLOC_DYNAMIC=3;var ALLOC_NONE=4;Module["ALLOC_NORMAL"]=ALLOC_NORMAL;Module["ALLOC_STACK"]=ALLOC_STACK;Module["ALLOC_STATIC"]=ALLOC_STATIC;Module["ALLOC_DYNAMIC"]=ALLOC_DYNAMIC;Module["ALLOC_NONE"]=ALLOC_NONE;function allocate(slab,types,allocator,ptr){var zeroinit,size;if(typeof slab==="number"){zeroinit=true;size=slab}else{zeroinit=false;size=slab.length}var singleType=typeof types==="string"?types:null;var ret;if(allocator==ALLOC_NONE){ret=ptr}else{ret=[_malloc,Runtime.stackAlloc,Runtime.staticAlloc,Runtime.dynamicAlloc][allocator===undefined?ALLOC_STATIC:allocator](Math.max(size,singleType?1:types.length))}if(zeroinit){var ptr=ret,stop;assert((ret&3)==0);stop=ret+(size&~3);for(;ptr<stop;ptr+=4){HEAP32[ptr>>2]=0}stop=ret+size;while(ptr<stop){HEAP8[ptr++>>0]=0}return ret}if(singleType==="i8"){if(slab.subarray||slab.slice){HEAPU8.set(slab,ret)}else{HEAPU8.set(new Uint8Array(slab),ret)}return ret}var i=0,type,typeSize,previousType;while(i<size){var curr=slab[i];if(typeof curr==="function"){curr=Runtime.getFunctionIndex(curr)}type=singleType||types[i];if(type===0){i++;continue}if(type=="i64")type="i32";setValue(ret+i,curr,type);if(previousType!==type){typeSize=Runtime.getNativeTypeSize(type);previousType=type}i+=typeSize}return ret}Module["allocate"]=allocate;function Pointer_stringify(ptr,length){if(length===0||!ptr)return"";var hasUtf=false;var t;var i=0;while(1){t=HEAPU8[ptr+i>>0];if(t>=128)hasUtf=true;else if(t==0&&!length)break;i++;if(length&&i==length)break}if(!length)length=i;var ret="";if(!hasUtf){var MAX_CHUNK=1024;var curr;while(length>0){curr=String.fromCharCode.apply(String,HEAPU8.subarray(ptr,ptr+Math.min(length,MAX_CHUNK)));ret=ret?ret+curr:curr;ptr+=MAX_CHUNK;length-=MAX_CHUNK}return ret}var utf8=new Runtime.UTF8Processor;for(i=0;i<length;i++){t=HEAPU8[ptr+i>>0];ret+=utf8.processCChar(t)}return ret}Module["Pointer_stringify"]=Pointer_stringify;function UTF16ToString(ptr){var i=0;var str="";while(1){var codeUnit=HEAP16[ptr+i*2>>1];if(codeUnit==0)return str;++i;str+=String.fromCharCode(codeUnit)}}Module["UTF16ToString"]=UTF16ToString;function stringToUTF16(str,outPtr){for(var i=0;i<str.length;++i){var codeUnit=str.charCodeAt(i);HEAP16[outPtr+i*2>>1]=codeUnit}HEAP16[outPtr+str.length*2>>1]=0}Module["stringToUTF16"]=stringToUTF16;function UTF32ToString(ptr){var i=0;var str="";while(1){var utf32=HEAP32[ptr+i*4>>2];if(utf32==0)return str;++i;if(utf32>=65536){var ch=utf32-65536;str+=String.fromCharCode(55296|ch>>10,56320|ch&1023)}else{str+=String.fromCharCode(utf32)}}}Module["UTF32ToString"]=UTF32ToString;function stringToUTF32(str,outPtr){var iChar=0;for(var iCodeUnit=0;iCodeUnit<str.length;++iCodeUnit){var codeUnit=str.charCodeAt(iCodeUnit);if(codeUnit>=55296&&codeUnit<=57343){var trailSurrogate=str.charCodeAt(++iCodeUnit);codeUnit=65536+((codeUnit&1023)<<10)|trailSurrogate&1023}HEAP32[outPtr+iChar*4>>2]=codeUnit;++iChar}HEAP32[outPtr+iChar*4>>2]=0}Module["stringToUTF32"]=stringToUTF32;function demangle(func){var hasLibcxxabi=!!Module["___cxa_demangle"];if(hasLibcxxabi){try{var buf=_malloc(func.length);writeStringToMemory(func.substr(1),buf);var status=_malloc(4);var ret=Module["___cxa_demangle"](buf,0,0,status);if(getValue(status,"i32")===0&&ret){return Pointer_stringify(ret)}}catch(e){}finally{if(buf)_free(buf);if(status)_free(status);if(ret)_free(ret)}}var i=3;var basicTypes={"v":"void","b":"bool","c":"char","s":"short","i":"int","l":"long","f":"float","d":"double","w":"wchar_t","a":"signed char","h":"unsigned char","t":"unsigned short","j":"unsigned int","m":"unsigned long","x":"long long","y":"unsigned long long","z":"..."};var subs=[];var first=true;function dump(x){if(x)Module.print(x);Module.print(func);var pre="";for(var a=0;a<i;a++)pre+=" ";Module.print(pre+"^")}function parseNested(){i++;if(func[i]==="K")i++;var parts=[];while(func[i]!=="E"){if(func[i]==="S"){i++;var next=func.indexOf("_",i);var num=func.substring(i,next)||0;parts.push(subs[num]||"?");i=next+1;continue}if(func[i]==="C"){parts.push(parts[parts.length-1]);i+=2;continue}var size=parseInt(func.substr(i));var pre=size.toString().length;if(!size||!pre){i--;break}var curr=func.substr(i+pre,size);parts.push(curr);subs.push(curr);i+=pre+size}i++;return parts}function parse(rawList,limit,allowVoid){limit=limit||Infinity;var ret="",list=[];function flushList(){return"("+list.join(", ")+")"}var name;if(func[i]==="N"){name=parseNested().join("::");limit--;if(limit===0)return rawList?[name]:name}else{if(func[i]==="K"||first&&func[i]==="L")i++;var size=parseInt(func.substr(i));if(size){var pre=size.toString().length;name=func.substr(i+pre,size);i+=pre+size}}first=false;if(func[i]==="I"){i++;var iList=parse(true);var iRet=parse(true,1,true);ret+=iRet[0]+" "+name+"<"+iList.join(", ")+">"}else{ret=name}paramLoop:while(i<func.length&&limit-->0){var c=func[i++];if(c in basicTypes){list.push(basicTypes[c])}else{switch(c){case"P":list.push(parse(true,1,true)[0]+"*");break;case"R":list.push(parse(true,1,true)[0]+"&");break;case"L":{i++;var end=func.indexOf("E",i);var size=end-i;list.push(func.substr(i,size));i+=size+2;break};case"A":{var size=parseInt(func.substr(i));i+=size.toString().length;if(func[i]!=="_")throw"?";i++;list.push(parse(true,1,true)[0]+" ["+size+"]");break};case"E":break paramLoop;default:ret+="?"+c;break paramLoop}}}if(!allowVoid&&list.length===1&&list[0]==="void")list=[];if(rawList){if(ret){list.push(ret+"?")}return list}else{return ret+flushList()}}var parsed=func;try{if(func=="Object._main"||func=="_main"){return"main()"}if(typeof func==="number")func=Pointer_stringify(func);if(func[0]!=="_")return func;if(func[1]!=="_")return func;if(func[2]!=="Z")return func;switch(func[3]){case"n":return"operator new()";case"d":return"operator delete()"}parsed=parse()}catch(e){parsed+="?"}if(parsed.indexOf("?")>=0&&!hasLibcxxabi){Runtime.warnOnce("warning: a problem occurred in builtin C++ name demangling; build with  -s DEMANGLE_SUPPORT=1  to link in libcxxabi demangling")}return parsed}function demangleAll(text){return text.replace(/__Z[\w\d_]+/g,(function(x){var y=demangle(x);return x===y?x:x+" ["+y+"]"}))}function jsStackTrace(){var err=new Error;if(!err.stack){try{throw new Error(0)}catch(e){err=e}if(!err.stack){return"(no stack trace available)"}}return err.stack.toString()}function stackTrace(){return demangleAll(jsStackTrace())}Module["stackTrace"]=stackTrace;var PAGE_SIZE=4096;function alignMemoryPage(x){return x+4095&-4096}var HEAP;var HEAP8,HEAPU8,HEAP16,HEAPU16,HEAP32,HEAPU32,HEAPF32,HEAPF64;var STATIC_BASE=0,STATICTOP=0,staticSealed=false;var STACK_BASE=0,STACKTOP=0,STACK_MAX=0;var DYNAMIC_BASE=0,DYNAMICTOP=0;function enlargeMemory(){abort("Cannot enlarge memory arrays. Either (1) compile with -s TOTAL_MEMORY=X with X higher than the current value "+TOTAL_MEMORY+", (2) compile with ALLOW_MEMORY_GROWTH which adjusts the size at runtime but prevents some optimizations, or (3) set Module.TOTAL_MEMORY before the program runs.")}var TOTAL_STACK=Module["TOTAL_STACK"]||5242880;var TOTAL_MEMORY=Module["TOTAL_MEMORY"]||16777216;var FAST_MEMORY=Module["FAST_MEMORY"]||2097152;var totalMemory=64*1024;while(totalMemory<TOTAL_MEMORY||totalMemory<2*TOTAL_STACK){if(totalMemory<16*1024*1024){totalMemory*=2}else{totalMemory+=16*1024*1024}}if(totalMemory!==TOTAL_MEMORY){Module.printErr("increasing TOTAL_MEMORY to "+totalMemory+" to be compliant with the asm.js spec");TOTAL_MEMORY=totalMemory}assert(typeof Int32Array!=="undefined"&&typeof Float64Array!=="undefined"&&!!(new Int32Array(1))["subarray"]&&!!(new Int32Array(1))["set"],"JS engine does not provide full typed array support");var buffer=new ArrayBuffer(TOTAL_MEMORY);HEAP8=new Int8Array(buffer);HEAP16=new Int16Array(buffer);HEAP32=new Int32Array(buffer);HEAPU8=new Uint8Array(buffer);HEAPU16=new Uint16Array(buffer);HEAPU32=new Uint32Array(buffer);HEAPF32=new Float32Array(buffer);HEAPF64=new Float64Array(buffer);HEAP32[0]=255;assert(HEAPU8[0]===255&&HEAPU8[3]===0,"Typed arrays 2 must be run on a little-endian system");Module["HEAP"]=HEAP;Module["buffer"]=buffer;Module["HEAP8"]=HEAP8;Module["HEAP16"]=HEAP16;Module["HEAP32"]=HEAP32;Module["HEAPU8"]=HEAPU8;Module["HEAPU16"]=HEAPU16;Module["HEAPU32"]=HEAPU32;Module["HEAPF32"]=HEAPF32;Module["HEAPF64"]=HEAPF64;function callRuntimeCallbacks(callbacks){while(callbacks.length>0){var callback=callbacks.shift();if(typeof callback=="function"){callback();continue}var func=callback.func;if(typeof func==="number"){if(callback.arg===undefined){Runtime.dynCall("v",func)}else{Runtime.dynCall("vi",func,[callback.arg])}}else{func(callback.arg===undefined?null:callback.arg)}}}var __ATPRERUN__=[];var __ATINIT__=[];var __ATMAIN__=[];var __ATEXIT__=[];var __ATPOSTRUN__=[];var runtimeInitialized=false;var runtimeExited=false;function preRun(){if(Module["preRun"]){if(typeof Module["preRun"]=="function")Module["preRun"]=[Module["preRun"]];while(Module["preRun"].length){addOnPreRun(Module["preRun"].shift())}}callRuntimeCallbacks(__ATPRERUN__)}function ensureInitRuntime(){if(runtimeInitialized)return;runtimeInitialized=true;callRuntimeCallbacks(__ATINIT__)}function preMain(){callRuntimeCallbacks(__ATMAIN__)}function exitRuntime(){callRuntimeCallbacks(__ATEXIT__);runtimeExited=true}function postRun(){if(Module["postRun"]){if(typeof Module["postRun"]=="function")Module["postRun"]=[Module["postRun"]];while(Module["postRun"].length){addOnPostRun(Module["postRun"].shift())}}callRuntimeCallbacks(__ATPOSTRUN__)}function addOnPreRun(cb){__ATPRERUN__.unshift(cb)}Module["addOnPreRun"]=Module.addOnPreRun=addOnPreRun;function addOnInit(cb){__ATINIT__.unshift(cb)}Module["addOnInit"]=Module.addOnInit=addOnInit;function addOnPreMain(cb){__ATMAIN__.unshift(cb)}Module["addOnPreMain"]=Module.addOnPreMain=addOnPreMain;function addOnExit(cb){__ATEXIT__.unshift(cb)}Module["addOnExit"]=Module.addOnExit=addOnExit;function addOnPostRun(cb){__ATPOSTRUN__.unshift(cb)}Module["addOnPostRun"]=Module.addOnPostRun=addOnPostRun;function intArrayFromString(stringy,dontAddNull,length){var ret=(new Runtime.UTF8Processor).processJSString(stringy);if(length){ret.length=length}if(!dontAddNull){ret.push(0)}return ret}Module["intArrayFromString"]=intArrayFromString;function intArrayToString(array){var ret=[];for(var i=0;i<array.length;i++){var chr=array[i];if(chr>255){chr&=255}ret.push(String.fromCharCode(chr))}return ret.join("")}Module["intArrayToString"]=intArrayToString;function writeStringToMemory(string,buffer,dontAddNull){var array=intArrayFromString(string,dontAddNull);var i=0;while(i<array.length){var chr=array[i];HEAP8[buffer+i>>0]=chr;i=i+1}}Module["writeStringToMemory"]=writeStringToMemory;function writeArrayToMemory(array,buffer){for(var i=0;i<array.length;i++){HEAP8[buffer+i>>0]=array[i]}}Module["writeArrayToMemory"]=writeArrayToMemory;function writeAsciiToMemory(str,buffer,dontAddNull){for(var i=0;i<str.length;i++){HEAP8[buffer+i>>0]=str.charCodeAt(i)}if(!dontAddNull)HEAP8[buffer+str.length>>0]=0}Module["writeAsciiToMemory"]=writeAsciiToMemory;function unSign(value,bits,ignore){if(value>=0){return value}return bits<=32?2*Math.abs(1<<bits-1)+value:Math.pow(2,bits)+value}function reSign(value,bits,ignore){if(value<=0){return value}var half=bits<=32?Math.abs(1<<bits-1):Math.pow(2,bits-1);if(value>=half&&(bits<=32||value>half)){value=-2*half+value}return value}if(!Math["imul"]||Math["imul"](4294967295,5)!==-5)Math["imul"]=function imul(a,b){var ah=a>>>16;var al=a&65535;var bh=b>>>16;var bl=b&65535;return al*bl+(ah*bl+al*bh<<16)|0};Math.imul=Math["imul"];var Math_abs=Math.abs;var Math_cos=Math.cos;var Math_sin=Math.sin;var Math_tan=Math.tan;var Math_acos=Math.acos;var Math_asin=Math.asin;var Math_atan=Math.atan;var Math_atan2=Math.atan2;var Math_exp=Math.exp;var Math_log=Math.log;var Math_sqrt=Math.sqrt;var Math_ceil=Math.ceil;var Math_floor=Math.floor;var Math_pow=Math.pow;var Math_imul=Math.imul;var Math_fround=Math.fround;var Math_min=Math.min;var runDependencies=0;var runDependencyWatcher=null;var dependenciesFulfilled=null;function addRunDependency(id){runDependencies++;if(Module["monitorRunDependencies"]){Module["monitorRunDependencies"](runDependencies)}}Module["addRunDependency"]=addRunDependency;function removeRunDependency(id){runDependencies--;if(Module["monitorRunDependencies"]){Module["monitorRunDependencies"](runDependencies)}if(runDependencies==0){if(runDependencyWatcher!==null){clearInterval(runDependencyWatcher);runDependencyWatcher=null}if(dependenciesFulfilled){var callback=dependenciesFulfilled;dependenciesFulfilled=null;callback()}}}Module["removeRunDependency"]=removeRunDependency;Module["preloadedImages"]={};Module["preloadedAudios"]={};var memoryInitializer=null;STATIC_BASE=8;STATICTOP=STATIC_BASE+33040;__ATINIT__.push();var memoryInitializer="curve25519_compiled.js.mem";var tempDoublePtr=Runtime.alignMemory(allocate(12,"i8",ALLOC_STATIC),8);assert(tempDoublePtr%8==0);function copyTempFloat(ptr){HEAP8[tempDoublePtr]=HEAP8[ptr];HEAP8[tempDoublePtr+1]=HEAP8[ptr+1];HEAP8[tempDoublePtr+2]=HEAP8[ptr+2];HEAP8[tempDoublePtr+3]=HEAP8[ptr+3]}function copyTempDouble(ptr){HEAP8[tempDoublePtr]=HEAP8[ptr];HEAP8[tempDoublePtr+1]=HEAP8[ptr+1];HEAP8[tempDoublePtr+2]=HEAP8[ptr+2];HEAP8[tempDoublePtr+3]=HEAP8[ptr+3];HEAP8[tempDoublePtr+4]=HEAP8[ptr+4];HEAP8[tempDoublePtr+5]=HEAP8[ptr+5];HEAP8[tempDoublePtr+6]=HEAP8[ptr+6];HEAP8[tempDoublePtr+7]=HEAP8[ptr+7]}Module["_bitshift64Ashr"]=_bitshift64Ashr;Module["_i64Subtract"]=_i64Subtract;Module["_i64Add"]=_i64Add;Module["_memset"]=_memset;Module["_bitshift64Lshr"]=_bitshift64Lshr;Module["_bitshift64Shl"]=_bitshift64Shl;function _abort(){Module["abort"]()}Module["_strlen"]=_strlen;function _emscripten_memcpy_big(dest,src,num){HEAPU8.set(HEAPU8.subarray(src,src+num),dest);return dest}Module["_memcpy"]=_memcpy;var ___errno_state=0;function ___setErrNo(value){HEAP32[___errno_state>>2]=value;return value}var ERRNO_CODES={EPERM:1,ENOENT:2,ESRCH:3,EINTR:4,EIO:5,ENXIO:6,E2BIG:7,ENOEXEC:8,EBADF:9,ECHILD:10,EAGAIN:11,EWOULDBLOCK:11,ENOMEM:12,EACCES:13,EFAULT:14,ENOTBLK:15,EBUSY:16,EEXIST:17,EXDEV:18,ENODEV:19,ENOTDIR:20,EISDIR:21,EINVAL:22,ENFILE:23,EMFILE:24,ENOTTY:25,ETXTBSY:26,EFBIG:27,ENOSPC:28,ESPIPE:29,EROFS:30,EMLINK:31,EPIPE:32,EDOM:33,ERANGE:34,ENOMSG:42,EIDRM:43,ECHRNG:44,EL2NSYNC:45,EL3HLT:46,EL3RST:47,ELNRNG:48,EUNATCH:49,ENOCSI:50,EL2HLT:51,EDEADLK:35,ENOLCK:37,EBADE:52,EBADR:53,EXFULL:54,ENOANO:55,EBADRQC:56,EBADSLT:57,EDEADLOCK:35,EBFONT:59,ENOSTR:60,ENODATA:61,ETIME:62,ENOSR:63,ENONET:64,ENOPKG:65,EREMOTE:66,ENOLINK:67,EADV:68,ESRMNT:69,ECOMM:70,EPROTO:71,EMULTIHOP:72,EDOTDOT:73,EBADMSG:74,ENOTUNIQ:76,EBADFD:77,EREMCHG:78,ELIBACC:79,ELIBBAD:80,ELIBSCN:81,ELIBMAX:82,ELIBEXEC:83,ENOSYS:38,ENOTEMPTY:39,ENAMETOOLONG:36,ELOOP:40,EOPNOTSUPP:95,EPFNOSUPPORT:96,ECONNRESET:104,ENOBUFS:105,EAFNOSUPPORT:97,EPROTOTYPE:91,ENOTSOCK:88,ENOPROTOOPT:92,ESHUTDOWN:108,ECONNREFUSED:111,EADDRINUSE:98,ECONNABORTED:103,ENETUNREACH:101,ENETDOWN:100,ETIMEDOUT:110,EHOSTDOWN:112,EHOSTUNREACH:113,EINPROGRESS:115,EALREADY:114,EDESTADDRREQ:89,EMSGSIZE:90,EPROTONOSUPPORT:93,ESOCKTNOSUPPORT:94,EADDRNOTAVAIL:99,ENETRESET:102,EISCONN:106,ENOTCONN:107,ETOOMANYREFS:109,EUSERS:87,EDQUOT:122,ESTALE:116,ENOTSUP:95,ENOMEDIUM:123,EILSEQ:84,EOVERFLOW:75,ECANCELED:125,ENOTRECOVERABLE:131,EOWNERDEAD:130,ESTRPIPE:86};function _sysconf(name){switch(name){case 30:return PAGE_SIZE;case 132:case 133:case 12:case 137:case 138:case 15:case 235:case 16:case 17:case 18:case 19:case 20:case 149:case 13:case 10:case 236:case 153:case 9:case 21:case 22:case 159:case 154:case 14:case 77:case 78:case 139:case 80:case 81:case 79:case 82:case 68:case 67:case 164:case 11:case 29:case 47:case 48:case 95:case 52:case 51:case 46:return 200809;case 27:case 246:case 127:case 128:case 23:case 24:case 160:case 161:case 181:case 182:case 242:case 183:case 184:case 243:case 244:case 245:case 165:case 178:case 179:case 49:case 50:case 168:case 169:case 175:case 170:case 171:case 172:case 97:case 76:case 32:case 173:case 35:return-1;case 176:case 177:case 7:case 155:case 8:case 157:case 125:case 126:case 92:case 93:case 129:case 130:case 131:case 94:case 91:return 1;case 74:case 60:case 69:case 70:case 4:return 1024;case 31:case 42:case 72:return 32;case 87:case 26:case 33:return 2147483647;case 34:case 1:return 47839;case 38:case 36:return 99;case 43:case 37:return 2048;case 0:return 2097152;case 3:return 65536;case 28:return 32768;case 44:return 32767;case 75:return 16384;case 39:return 1e3;case 89:return 700;case 71:return 256;case 40:return 255;case 2:return 100;case 180:return 64;case 25:return 20;case 5:return 16;case 6:return 6;case 73:return 4;case 84:{if(typeof navigator==="object")return navigator["hardwareConcurrency"]||1;return 1}}___setErrNo(ERRNO_CODES.EINVAL);return-1}function _sbrk(bytes){var self=_sbrk;if(!self.called){DYNAMICTOP=alignMemoryPage(DYNAMICTOP);self.called=true;assert(Runtime.dynamicAlloc);self.alloc=Runtime.dynamicAlloc;Runtime.dynamicAlloc=(function(){abort("cannot dynamically allocate, sbrk now has control")})}var ret=DYNAMICTOP;if(bytes!=0)self.alloc(bytes);return ret}Module["_memmove"]=_memmove;function ___errno_location(){return ___errno_state}var ERRNO_MESSAGES={0:"Success",1:"Not super-user",2:"No such file or directory",3:"No such process",4:"Interrupted system call",5:"I/O error",6:"No such device or address",7:"Arg list too long",8:"Exec format error",9:"Bad file number",10:"No children",11:"No more processes",12:"Not enough core",13:"Permission denied",14:"Bad address",15:"Block device required",16:"Mount device busy",17:"File exists",18:"Cross-device link",19:"No such device",20:"Not a directory",21:"Is a directory",22:"Invalid argument",23:"Too many open files in system",24:"Too many open files",25:"Not a typewriter",26:"Text file busy",27:"File too large",28:"No space left on device",29:"Illegal seek",30:"Read only file system",31:"Too many links",32:"Broken pipe",33:"Math arg out of domain of func",34:"Math result not representable",35:"File locking deadlock error",36:"File or path name too long",37:"No record locks available",38:"Function not implemented",39:"Directory not empty",40:"Too many symbolic links",42:"No message of desired type",43:"Identifier removed",44:"Channel number out of range",45:"Level 2 not synchronized",46:"Level 3 halted",47:"Level 3 reset",48:"Link number out of range",49:"Protocol driver not attached",50:"No CSI structure available",51:"Level 2 halted",52:"Invalid exchange",53:"Invalid request descriptor",54:"Exchange full",55:"No anode",56:"Invalid request code",57:"Invalid slot",59:"Bad font file fmt",60:"Device not a stream",61:"No data (for no delay io)",62:"Timer expired",63:"Out of streams resources",64:"Machine is not on the network",65:"Package not installed",66:"The object is remote",67:"The link has been severed",68:"Advertise error",69:"Srmount error",70:"Communication error on send",71:"Protocol error",72:"Multihop attempted",73:"Cross mount point (not really error)",74:"Trying to read unreadable message",75:"Value too large for defined data type",76:"Given log. name not unique",77:"f.d. invalid for this operation",78:"Remote address changed",79:"Can   access a needed shared lib",80:"Accessing a corrupted shared lib",81:".lib section in a.out corrupted",82:"Attempting to link in too many libs",83:"Attempting to exec a shared library",84:"Illegal byte sequence",86:"Streams pipe error",87:"Too many users",88:"Socket operation on non-socket",89:"Destination address required",90:"Message too long",91:"Protocol wrong type for socket",92:"Protocol not available",93:"Unknown protocol",94:"Socket type not supported",95:"Not supported",96:"Protocol family not supported",97:"Address family not supported by protocol family",98:"Address already in use",99:"Address not available",100:"Network interface is not configured",101:"Network is unreachable",102:"Connection reset by network",103:"Connection aborted",104:"Connection reset by peer",105:"No buffer space available",106:"Socket is already connected",107:"Socket is not connected",108:"Can't send after socket shutdown",109:"Too many references",110:"Connection timed out",111:"Connection refused",112:"Host is down",113:"Host is unreachable",114:"Socket already connected",115:"Connection already in progress",116:"Stale file handle",122:"Quota exceeded",123:"No medium (in tape drive)",125:"Operation canceled",130:"Previous owner died",131:"State not recoverable"};var TTY={ttys:[],init:(function(){}),shutdown:(function(){}),register:(function(dev,ops){TTY.ttys[dev]={input:[],output:[],ops:ops};FS.registerDevice(dev,TTY.stream_ops)}),stream_ops:{open:(function(stream){var tty=TTY.ttys[stream.node.rdev];if(!tty){throw new FS.ErrnoError(ERRNO_CODES.ENODEV)}stream.tty=tty;stream.seekable=false}),close:(function(stream){stream.tty.ops.flush(stream.tty)}),flush:(function(stream){stream.tty.ops.flush(stream.tty)}),read:(function(stream,buffer,offset,length,pos){if(!stream.tty||!stream.tty.ops.get_char){throw new FS.ErrnoError(ERRNO_CODES.ENXIO)}var bytesRead=0;for(var i=0;i<length;i++){var result;try{result=stream.tty.ops.get_char(stream.tty)}catch(e){throw new FS.ErrnoError(ERRNO_CODES.EIO)}if(result===undefined&&bytesRead===0){throw new FS.ErrnoError(ERRNO_CODES.EAGAIN)}if(result===null||result===undefined)break;bytesRead++;buffer[offset+i]=result}if(bytesRead){stream.node.timestamp=Date.now()}return bytesRead}),write:(function(stream,buffer,offset,length,pos){if(!stream.tty||!stream.tty.ops.put_char){throw new FS.ErrnoError(ERRNO_CODES.ENXIO)}for(var i=0;i<length;i++){try{stream.tty.ops.put_char(stream.tty,buffer[offset+i])}catch(e){throw new FS.ErrnoError(ERRNO_CODES.EIO)}}if(length){stream.node.timestamp=Date.now()}return i})},default_tty_ops:{get_char:(function(tty){if(!tty.input.length){var result=null;if(ENVIRONMENT_IS_NODE){result=process["stdin"]["read"]();if(!result){if(process["stdin"]["_readableState"]&&process["stdin"]["_readableState"]["ended"]){return null}return undefined}}else if(typeof window!="undefined"&&typeof window.prompt=="function"){result=window.prompt("Input: ");if(result!==null){result+="\n"}}else if(typeof readline=="function"){result=readline();if(result!==null){result+="\n"}}if(!result){return null}tty.input=intArrayFromString(result,true)}return tty.input.shift()}),flush:(function(tty){if(tty.output&&tty.output.length>0){Module["print"](tty.output.join(""));tty.output=[]}}),put_char:(function(tty,val){if(val===null||val===10){Module["print"](tty.output.join(""));tty.output=[]}else{tty.output.push(TTY.utf8.processCChar(val))}})},default_tty1_ops:{put_char:(function(tty,val){if(val===null||val===10){Module["printErr"](tty.output.join(""));tty.output=[]}else{tty.output.push(TTY.utf8.processCChar(val))}}),flush:(function(tty){if(tty.output&&tty.output.length>0){Module["printErr"](tty.output.join(""));tty.output=[]}})}};var MEMFS={ops_table:null,mount:(function(mount){return MEMFS.createNode(null,"/",16384|511,0)}),createNode:(function(parent,name,mode,dev){if(FS.isBlkdev(mode)||FS.isFIFO(mode)){throw new FS.ErrnoError(ERRNO_CODES.EPERM)}if(!MEMFS.ops_table){MEMFS.ops_table={dir:{node:{getattr:MEMFS.node_ops.getattr,setattr:MEMFS.node_ops.setattr,lookup:MEMFS.node_ops.lookup,mknod:MEMFS.node_ops.mknod,rename:MEMFS.node_ops.rename,unlink:MEMFS.node_ops.unlink,rmdir:MEMFS.node_ops.rmdir,readdir:MEMFS.node_ops.readdir,symlink:MEMFS.node_ops.symlink},stream:{llseek:MEMFS.stream_ops.llseek}},file:{node:{getattr:MEMFS.node_ops.getattr,setattr:MEMFS.node_ops.setattr},stream:{llseek:MEMFS.stream_ops.llseek,read:MEMFS.stream_ops.read,write:MEMFS.stream_ops.write,allocate:MEMFS.stream_ops.allocate,mmap:MEMFS.stream_ops.mmap}},link:{node:{getattr:MEMFS.node_ops.getattr,setattr:MEMFS.node_ops.setattr,readlink:MEMFS.node_ops.readlink},stream:{}},chrdev:{node:{getattr:MEMFS.node_ops.getattr,setattr:MEMFS.node_ops.setattr},stream:FS.chrdev_stream_ops}}}var node=FS.createNode(parent,name,mode,dev);if(FS.isDir(node.mode)){node.node_ops=MEMFS.ops_table.dir.node;node.stream_ops=MEMFS.ops_table.dir.stream;node.contents={}}else if(FS.isFile(node.mode)){node.node_ops=MEMFS.ops_table.file.node;node.stream_ops=MEMFS.ops_table.file.stream;node.usedBytes=0;node.contents=null}else if(FS.isLink(node.mode)){node.node_ops=MEMFS.ops_table.link.node;node.stream_ops=MEMFS.ops_table.link.stream}else if(FS.isChrdev(node.mode)){node.node_ops=MEMFS.ops_table.chrdev.node;node.stream_ops=MEMFS.ops_table.chrdev.stream}node.timestamp=Date.now();if(parent){parent.contents[name]=node}return node}),getFileDataAsRegularArray:(function(node){if(node.contents&&node.contents.subarray){var arr=[];for(var i=0;i<node.usedBytes;++i)arr.push(node.contents[i]);return arr}return node.contents}),getFileDataAsTypedArray:(function(node){if(!node.contents)return new Uint8Array;if(node.contents.subarray)return node.contents.subarray(0,node.usedBytes);return new Uint8Array(node.contents)}),expandFileStorage:(function(node,newCapacity){if(node.contents&&node.contents.subarray&&newCapacity>node.contents.length){node.contents=MEMFS.getFileDataAsRegularArray(node);node.usedBytes=node.contents.length}if(!node.contents||node.contents.subarray){var prevCapacity=node.contents?node.contents.buffer.byteLength:0;if(prevCapacity>=newCapacity)return;var CAPACITY_DOUBLING_MAX=1024*1024;newCapacity=Math.max(newCapacity,prevCapacity*(prevCapacity<CAPACITY_DOUBLING_MAX?2:1.125)|0);if(prevCapacity!=0)newCapacity=Math.max(newCapacity,256);var oldContents=node.contents;node.contents=new Uint8Array(newCapacity);if(node.usedBytes>0)node.contents.set(oldContents.subarray(0,node.usedBytes),0);return}if(!node.contents&&newCapacity>0)node.contents=[];while(node.contents.length<newCapacity)node.contents.push(0)}),resizeFileStorage:(function(node,newSize){if(node.usedBytes==newSize)return;if(newSize==0){node.contents=null;node.usedBytes=0;return}if(!node.contents||node.contents.subarray){var oldContents=node.contents;node.contents=new Uint8Array(new ArrayBuffer(newSize));if(oldContents){node.contents.set(oldContents.subarray(0,Math.min(newSize,node.usedBytes)))}node.usedBytes=newSize;return}if(!node.contents)node.contents=[];if(node.contents.length>newSize)node.contents.length=newSize;else while(node.contents.length<newSize)node.contents.push(0);node.usedBytes=newSize}),node_ops:{getattr:(function(node){var attr={};attr.dev=FS.isChrdev(node.mode)?node.id:1;attr.ino=node.id;attr.mode=node.mode;attr.nlink=1;attr.uid=0;attr.gid=0;attr.rdev=node.rdev;if(FS.isDir(node.mode)){attr.size=4096}else if(FS.isFile(node.mode)){attr.size=node.usedBytes}else if(FS.isLink(node.mode)){attr.size=node.link.length}else{attr.size=0}attr.atime=new Date(node.timestamp);attr.mtime=new Date(node.timestamp);attr.ctime=new Date(node.timestamp);attr.blksize=4096;attr.blocks=Math.ceil(attr.size/attr.blksize);return attr}),setattr:(function(node,attr){if(attr.mode!==undefined){node.mode=attr.mode}if(attr.timestamp!==undefined){node.timestamp=attr.timestamp}if(attr.size!==undefined){MEMFS.resizeFileStorage(node,attr.size)}}),lookup:(function(parent,name){throw FS.genericErrors[ERRNO_CODES.ENOENT]}),mknod:(function(parent,name,mode,dev){return MEMFS.createNode(parent,name,mode,dev)}),rename:(function(old_node,new_dir,new_name){if(FS.isDir(old_node.mode)){var new_node;try{new_node=FS.lookupNode(new_dir,new_name)}catch(e){}if(new_node){for(var i in new_node.contents){throw new FS.ErrnoError(ERRNO_CODES.ENOTEMPTY)}}}delete old_node.parent.contents[old_node.name];old_node.name=new_name;new_dir.contents[new_name]=old_node;old_node.parent=new_dir}),unlink:(function(parent,name){delete parent.contents[name]}),rmdir:(function(parent,name){var node=FS.lookupNode(parent,name);for(var i in node.contents){throw new FS.ErrnoError(ERRNO_CODES.ENOTEMPTY)}delete parent.contents[name]}),readdir:(function(node){var entries=[".",".."];for(var key in node.contents){if(!node.contents.hasOwnProperty(key)){continue}entries.push(key)}return entries}),symlink:(function(parent,newname,oldpath){var node=MEMFS.createNode(parent,newname,511|40960,0);node.link=oldpath;return node}),readlink:(function(node){if(!FS.isLink(node.mode)){throw new FS.ErrnoError(ERRNO_CODES.EINVAL)}return node.link})},stream_ops:{read:(function(stream,buffer,offset,length,position){var contents=stream.node.contents;if(position>=stream.node.usedBytes)return 0;var size=Math.min(stream.node.usedBytes-position,length);assert(size>=0);if(size>8&&contents.subarray){buffer.set(contents.subarray(position,position+size),offset)}else{for(var i=0;i<size;i++)buffer[offset+i]=contents[position+i]}return size}),write:(function(stream,buffer,offset,length,position,canOwn){if(!length)return 0;var node=stream.node;node.timestamp=Date.now();if(buffer.subarray&&(!node.contents||node.contents.subarray)){if(canOwn){node.contents=buffer.subarray(offset,offset+length);node.usedBytes=length;return length}else if(node.usedBytes===0&&position===0){node.contents=new Uint8Array(buffer.subarray(offset,offset+length));node.usedBytes=length;return length}else if(position+length<=node.usedBytes){node.contents.set(buffer.subarray(offset,offset+length),position);return length}}MEMFS.expandFileStorage(node,position+length);if(node.contents.subarray&&buffer.subarray)node.contents.set(buffer.subarray(offset,offset+length),position);else for(var i=0;i<length;i++){node.contents[position+i]=buffer[offset+i]}node.usedBytes=Math.max(node.usedBytes,position+length);return length}),llseek:(function(stream,offset,whence){var position=offset;if(whence===1){position+=stream.position}else if(whence===2){if(FS.isFile(stream.node.mode)){position+=stream.node.usedBytes}}if(position<0){throw new FS.ErrnoError(ERRNO_CODES.EINVAL)}return position}),allocate:(function(stream,offset,length){MEMFS.expandFileStorage(stream.node,offset+length);stream.node.usedBytes=Math.max(stream.node.usedBytes,offset+length)}),mmap:(function(stream,buffer,offset,length,position,prot,flags){if(!FS.isFile(stream.node.mode)){throw new FS.ErrnoError(ERRNO_CODES.ENODEV)}var ptr;var allocated;var contents=stream.node.contents;if(!(flags&2)&&(contents.buffer===buffer||contents.buffer===buffer.buffer)){allocated=false;ptr=contents.byteOffset}else{if(position>0||position+length<stream.node.usedBytes){if(contents.subarray){contents=contents.subarray(position,position+length)}else{contents=Array.prototype.slice.call(contents,position,position+length)}}allocated=true;ptr=_malloc(length);if(!ptr){throw new FS.ErrnoError(ERRNO_CODES.ENOMEM)}buffer.set(contents,ptr)}return{ptr:ptr,allocated:allocated}})}};var IDBFS={dbs:{},indexedDB:(function(){if(typeof indexedDB!=="undefined")return indexedDB;var ret=null;if(typeof window==="object")ret=window.indexedDB||window.mozIndexedDB||window.webkitIndexedDB||window.msIndexedDB;assert(ret,"IDBFS used, but indexedDB not supported");return ret}),DB_VERSION:21,DB_STORE_NAME:"FILE_DATA",mount:(function(mount){return MEMFS.mount.apply(null,arguments)}),syncfs:(function(mount,populate,callback){IDBFS.getLocalSet(mount,(function(err,local){if(err)return callback(err);IDBFS.getRemoteSet(mount,(function(err,remote){if(err)return callback(err);var src=populate?remote:local;var dst=populate?local:remote;IDBFS.reconcile(src,dst,callback)}))}))}),getDB:(function(name,callback){var db=IDBFS.dbs[name];if(db){return callback(null,db)}var req;try{req=IDBFS.indexedDB().open(name,IDBFS.DB_VERSION)}catch(e){return callback(e)}req.onupgradeneeded=(function(e){var db=e.target.result;var transaction=e.target.transaction;var fileStore;if(db.objectStoreNames.contains(IDBFS.DB_STORE_NAME)){fileStore=transaction.objectStore(IDBFS.DB_STORE_NAME)}else{fileStore=db.createObjectStore(IDBFS.DB_STORE_NAME)}fileStore.createIndex("timestamp","timestamp",{unique:false})});req.onsuccess=(function(){db=req.result;IDBFS.dbs[name]=db;callback(null,db)});req.onerror=(function(){callback(this.error)})}),getLocalSet:(function(mount,callback){var entries={};function isRealDir(p){return p!=="."&&p!==".."}function toAbsolute(root){return(function(p){return PATH.join2(root,p)})}var check=FS.readdir(mount.mountpoint).filter(isRealDir).map(toAbsolute(mount.mountpoint));while(check.length){var path=check.pop();var stat;try{stat=FS.stat(path)}catch(e){return callback(e)}if(FS.isDir(stat.mode)){check.push.apply(check,FS.readdir(path).filter(isRealDir).map(toAbsolute(path)))}entries[path]={timestamp:stat.mtime}}return callback(null,{type:"local",entries:entries})}),getRemoteSet:(function(mount,callback){var entries={};IDBFS.getDB(mount.mountpoint,(function(err,db){if(err)return callback(err);var transaction=db.transaction([IDBFS.DB_STORE_NAME],"readonly");transaction.onerror=(function(){callback(this.error)});var store=transaction.objectStore(IDBFS.DB_STORE_NAME);var index=store.index("timestamp");index.openKeyCursor().onsuccess=(function(event){var cursor=event.target.result;if(!cursor){return callback(null,{type:"remote",db:db,entries:entries})}entries[cursor.primaryKey]={timestamp:cursor.key};cursor.continue()})}))}),loadLocalEntry:(function(path,callback){var stat,node;try{var lookup=FS.lookupPath(path);node=lookup.node;stat=FS.stat(path)}catch(e){return callback(e)}if(FS.isDir(stat.mode)){return callback(null,{timestamp:stat.mtime,mode:stat.mode})}else if(FS.isFile(stat.mode)){node.contents=MEMFS.getFileDataAsTypedArray(node);return callback(null,{timestamp:stat.mtime,mode:stat.mode,contents:node.contents})}else{return callback(new Error("node type not supported"))}}),storeLocalEntry:(function(path,entry,callback){try{if(FS.isDir(entry.mode)){FS.mkdir(path,entry.mode)}else if(FS.isFile(entry.mode)){FS.writeFile(path,entry.contents,{encoding:"binary",canOwn:true})}else{return callback(new Error("node type not supported"))}FS.chmod(path,entry.mode);FS.utime(path,entry.timestamp,entry.timestamp)}catch(e){return callback(e)}callback(null)}),removeLocalEntry:(function(path,callback){try{var lookup=FS.lookupPath(path);var stat=FS.stat(path);if(FS.isDir(stat.mode)){FS.rmdir(path)}else if(FS.isFile(stat.mode)){FS.unlink(path)}}catch(e){return callback(e)}callback(null)}),loadRemoteEntry:(function(store,path,callback){var req=store.get(path);req.onsuccess=(function(event){callback(null,event.target.result)});req.onerror=(function(){callback(this.error)})}),storeRemoteEntry:(function(store,path,entry,callback){var req=store.put(entry,path);req.onsuccess=(function(){callback(null)});req.onerror=(function(){callback(this.error)})}),removeRemoteEntry:(function(store,path,callback){var req=store.delete(path);req.onsuccess=(function(){callback(null)});req.onerror=(function(){callback(this.error)})}),reconcile:(function(src,dst,callback){var total=0;var create=[];Object.keys(src.entries).forEach((function(key){var e=src.entries[key];var e2=dst.entries[key];if(!e2||e.timestamp>e2.timestamp){create.push(key);total++}}));var remove=[];Object.keys(dst.entries).forEach((function(key){var e=dst.entries[key];var e2=src.entries[key];if(!e2){remove.push(key);total++}}));if(!total){return callback(null)}var errored=false;var completed=0;var db=src.type==="remote"?src.db:dst.db;var transaction=db.transaction([IDBFS.DB_STORE_NAME],"readwrite");var store=transaction.objectStore(IDBFS.DB_STORE_NAME);function done(err){if(err){if(!done.errored){done.errored=true;return callback(err)}return}if(++completed>=total){return callback(null)}}transaction.onerror=(function(){done(this.error)});create.sort().forEach((function(path){if(dst.type==="local"){IDBFS.loadRemoteEntry(store,path,(function(err,entry){if(err)return done(err);IDBFS.storeLocalEntry(path,entry,done)}))}else{IDBFS.loadLocalEntry(path,(function(err,entry){if(err)return done(err);IDBFS.storeRemoteEntry(store,path,entry,done)}))}}));remove.sort().reverse().forEach((function(path){if(dst.type==="local"){IDBFS.removeLocalEntry(path,done)}else{IDBFS.removeRemoteEntry(store,path,done)}}))})};var NODEFS={isWindows:false,staticInit:(function(){NODEFS.isWindows=!!process.platform.match(/^win/)}),mount:(function(mount){assert(ENVIRONMENT_IS_NODE);return NODEFS.createNode(null,"/",NODEFS.getMode(mount.opts.root),0)}),createNode:(function(parent,name,mode,dev){if(!FS.isDir(mode)&&!FS.isFile(mode)&&!FS.isLink(mode)){throw new FS.ErrnoError(ERRNO_CODES.EINVAL)}var node=FS.createNode(parent,name,mode);node.node_ops=NODEFS.node_ops;node.stream_ops=NODEFS.stream_ops;return node}),getMode:(function(path){var stat;try{stat=fs.lstatSync(path);if(NODEFS.isWindows){stat.mode=stat.mode|(stat.mode&146)>>1}}catch(e){if(!e.code)throw e;throw new FS.ErrnoError(ERRNO_CODES[e.code])}return stat.mode}),realPath:(function(node){var parts=[];while(node.parent!==node){parts.push(node.name);node=node.parent}parts.push(node.mount.opts.root);parts.reverse();return PATH.join.apply(null,parts)}),flagsToPermissionStringMap:{0:"r",1:"r+",2:"r+",64:"r",65:"r+",66:"r+",129:"rx+",193:"rx+",514:"w+",577:"w",578:"w+",705:"wx",706:"wx+",1024:"a",1025:"a",1026:"a+",1089:"a",1090:"a+",1153:"ax",1154:"ax+",1217:"ax",1218:"ax+",4096:"rs",4098:"rs+"},flagsToPermissionString:(function(flags){if(flags in NODEFS.flagsToPermissionStringMap){return NODEFS.flagsToPermissionStringMap[flags]}else{return flags}}),node_ops:{getattr:(function(node){var path=NODEFS.realPath(node);var stat;try{stat=fs.lstatSync(path)}catch(e){if(!e.code)throw e;throw new FS.ErrnoError(ERRNO_CODES[e.code])}if(NODEFS.isWindows&&!stat.blksize){stat.blksize=4096}if(NODEFS.isWindows&&!stat.blocks){stat.blocks=(stat.size+stat.blksize-1)/stat.blksize|0}return{dev:stat.dev,ino:stat.ino,mode:stat.mode,nlink:stat.nlink,uid:stat.uid,gid:stat.gid,rdev:stat.rdev,size:stat.size,atime:stat.atime,mtime:stat.mtime,ctime:stat.ctime,blksize:stat.blksize,blocks:stat.blocks}}),setattr:(function(node,attr){var path=NODEFS.realPath(node);try{if(attr.mode!==undefined){fs.chmodSync(path,attr.mode);node.mode=attr.mode}if(attr.timestamp!==undefined){var date=new Date(attr.timestamp);fs.utimesSync(path,date,date)}if(attr.size!==undefined){fs.truncateSync(path,attr.size)}}catch(e){if(!e.code)throw e;throw new FS.ErrnoError(ERRNO_CODES[e.code])}}),lookup:(function(parent,name){var path=PATH.join2(NODEFS.realPath(parent),name);var mode=NODEFS.getMode(path);return NODEFS.createNode(parent,name,mode)}),mknod:(function(parent,name,mode,dev){var node=NODEFS.createNode(parent,name,mode,dev);var path=NODEFS.realPath(node);try{if(FS.isDir(node.mode)){fs.mkdirSync(path,node.mode)}else{fs.writeFileSync(path,"",{mode:node.mode})}}catch(e){if(!e.code)throw e;throw new FS.ErrnoError(ERRNO_CODES[e.code])}return node}),rename:(function(oldNode,newDir,newName){var oldPath=NODEFS.realPath(oldNode);var newPath=PATH.join2(NODEFS.realPath(newDir),newName);try{fs.renameSync(oldPath,newPath)}catch(e){if(!e.code)throw e;throw new FS.ErrnoError(ERRNO_CODES[e.code])}}),unlink:(function(parent,name){var path=PATH.join2(NODEFS.realPath(parent),name);try{fs.unlinkSync(path)}catch(e){if(!e.code)throw e;throw new FS.ErrnoError(ERRNO_CODES[e.code])}}),rmdir:(function(parent,name){var path=PATH.join2(NODEFS.realPath(parent),name);try{fs.rmdirSync(path)}catch(e){if(!e.code)throw e;throw new FS.ErrnoError(ERRNO_CODES[e.code])}}),readdir:(function(node){var path=NODEFS.realPath(node);try{return fs.readdirSync(path)}catch(e){if(!e.code)throw e;throw new FS.ErrnoError(ERRNO_CODES[e.code])}}),symlink:(function(parent,newName,oldPath){var newPath=PATH.join2(NODEFS.realPath(parent),newName);try{fs.symlinkSync(oldPath,newPath)}catch(e){if(!e.code)throw e;throw new FS.ErrnoError(ERRNO_CODES[e.code])}}),readlink:(function(node){var path=NODEFS.realPath(node);try{return fs.readlinkSync(path)}catch(e){if(!e.code)throw e;throw new FS.ErrnoError(ERRNO_CODES[e.code])}})},stream_ops:{open:(function(stream){var path=NODEFS.realPath(stream.node);try{if(FS.isFile(stream.node.mode)){stream.nfd=fs.openSync(path,NODEFS.flagsToPermissionString(stream.flags))}}catch(e){if(!e.code)throw e;throw new FS.ErrnoError(ERRNO_CODES[e.code])}}),close:(function(stream){try{if(FS.isFile(stream.node.mode)&&stream.nfd){fs.closeSync(stream.nfd)}}catch(e){if(!e.code)throw e;throw new FS.ErrnoError(ERRNO_CODES[e.code])}}),read:(function(stream,buffer,offset,length,position){if(length===0)return 0;var nbuffer=new Buffer(length);var res;try{res=fs.readSync(stream.nfd,nbuffer,0,length,position)}catch(e){throw new FS.ErrnoError(ERRNO_CODES[e.code])}if(res>0){for(var i=0;i<res;i++){buffer[offset+i]=nbuffer[i]}}return res}),write:(function(stream,buffer,offset,length,position){var nbuffer=new Buffer(buffer.subarray(offset,offset+length));var res;try{res=fs.writeSync(stream.nfd,nbuffer,0,length,position)}catch(e){throw new FS.ErrnoError(ERRNO_CODES[e.code])}return res}),llseek:(function(stream,offset,whence){var position=offset;if(whence===1){position+=stream.position}else if(whence===2){if(FS.isFile(stream.node.mode)){try{var stat=fs.fstatSync(stream.nfd);position+=stat.size}catch(e){throw new FS.ErrnoError(ERRNO_CODES[e.code])}}}if(position<0){throw new FS.ErrnoError(ERRNO_CODES.EINVAL)}return position})}};var _stdin=allocate(1,"i32*",ALLOC_STATIC);var _stdout=allocate(1,"i32*",ALLOC_STATIC);var _stderr=allocate(1,"i32*",ALLOC_STATIC);function _fflush(stream){}var FS={root:null,mounts:[],devices:[null],streams:[],nextInode:1,nameTable:null,currentPath:"/",initialized:false,ignorePermissions:true,trackingDelegate:{},tracking:{openFlags:{READ:1,WRITE:2}},ErrnoError:null,genericErrors:{},handleFSError:(function(e){if(!(e instanceof FS.ErrnoError))throw e+" : "+stackTrace();return ___setErrNo(e.errno)}),lookupPath:(function(path,opts){path=PATH.resolve(FS.cwd(),path);opts=opts||{};if(!path)return{path:"",node:null};var defaults={follow_mount:true,recurse_count:0};for(var key in defaults){if(opts[key]===undefined){opts[key]=defaults[key]}}if(opts.recurse_count>8){throw new FS.ErrnoError(ERRNO_CODES.ELOOP)}var parts=PATH.normalizeArray(path.split("/").filter((function(p){return!!p})),false);var current=FS.root;var current_path="/";for(var i=0;i<parts.length;i++){var islast=i===parts.length-1;if(islast&&opts.parent){break}current=FS.lookupNode(current,parts[i]);current_path=PATH.join2(current_path,parts[i]);if(FS.isMountpoint(current)){if(!islast||islast&&opts.follow_mount){current=current.mounted.root}}if(!islast||opts.follow){var count=0;while(FS.isLink(current.mode)){var link=FS.readlink(current_path);current_path=PATH.resolve(PATH.dirname(current_path),link);var lookup=FS.lookupPath(current_path,{recurse_count:opts.recurse_count});current=lookup.node;if(count++>40){throw new FS.ErrnoError(ERRNO_CODES.ELOOP)}}}}return{path:current_path,node:current}}),getPath:(function(node){var path;while(true){if(FS.isRoot(node)){var mount=node.mount.mountpoint;if(!path)return mount;return mount[mount.length-1]!=="/"?mount+"/"+path:mount+path}path=path?node.name+"/"+path:node.name;node=node.parent}}),hashName:(function(parentid,name){var hash=0;for(var i=0;i<name.length;i++){hash=(hash<<5)-hash+name.charCodeAt(i)|0}return(parentid+hash>>>0)%FS.nameTable.length}),hashAddNode:(function(node){var hash=FS.hashName(node.parent.id,node.name);node.name_next=FS.nameTable[hash];FS.nameTable[hash]=node}),hashRemoveNode:(function(node){var hash=FS.hashName(node.parent.id,node.name);if(FS.nameTable[hash]===node){FS.nameTable[hash]=node.name_next}else{var current=FS.nameTable[hash];while(current){if(current.name_next===node){current.name_next=node.name_next;break}current=current.name_next}}}),lookupNode:(function(parent,name){var err=FS.mayLookup(parent);if(err){throw new FS.ErrnoError(err,parent)}var hash=FS.hashName(parent.id,name);for(var node=FS.nameTable[hash];node;node=node.name_next){var nodeName=node.name;if(node.parent.id===parent.id&&nodeName===name){return node}}return FS.lookup(parent,name)}),createNode:(function(parent,name,mode,rdev){if(!FS.FSNode){FS.FSNode=(function(parent,name,mode,rdev){if(!parent){parent=this}this.parent=parent;this.mount=parent.mount;this.mounted=null;this.id=FS.nextInode++;this.name=name;this.mode=mode;this.node_ops={};this.stream_ops={};this.rdev=rdev});FS.FSNode.prototype={};var readMode=292|73;var writeMode=146;Object.defineProperties(FS.FSNode.prototype,{read:{get:(function(){return(this.mode&readMode)===readMode}),set:(function(val){val?this.mode|=readMode:this.mode&=~readMode})},write:{get:(function(){return(this.mode&writeMode)===writeMode}),set:(function(val){val?this.mode|=writeMode:this.mode&=~writeMode})},isFolder:{get:(function(){return FS.isDir(this.mode)})},isDevice:{get:(function(){return FS.isChrdev(this.mode)})}})}var node=new FS.FSNode(parent,name,mode,rdev);FS.hashAddNode(node);return node}),destroyNode:(function(node){FS.hashRemoveNode(node)}),isRoot:(function(node){return node===node.parent}),isMountpoint:(function(node){return!!node.mounted}),isFile:(function(mode){return(mode&61440)===32768}),isDir:(function(mode){return(mode&61440)===16384}),isLink:(function(mode){return(mode&61440)===40960}),isChrdev:(function(mode){return(mode&61440)===8192}),isBlkdev:(function(mode){return(mode&61440)===24576}),isFIFO:(function(mode){return(mode&61440)===4096}),isSocket:(function(mode){return(mode&49152)===49152}),flagModes:{"r":0,"rs":1052672,"r+":2,"w":577,"wx":705,"xw":705,"w+":578,"wx+":706,"xw+":706,"a":1089,"ax":1217,"xa":1217,"a+":1090,"ax+":1218,"xa+":1218},modeStringToFlags:(function(str){var flags=FS.flagModes[str];if(typeof flags==="undefined"){throw new Error("Unknown file open mode: "+str)}return flags}),flagsToPermissionString:(function(flag){var accmode=flag&2097155;var perms=["r","w","rw"][accmode];if(flag&512){perms+="w"}return perms}),nodePermissions:(function(node,perms){if(FS.ignorePermissions){return 0}if(perms.indexOf("r")!==-1&&!(node.mode&292)){return ERRNO_CODES.EACCES}else if(perms.indexOf("w")!==-1&&!(node.mode&146)){return ERRNO_CODES.EACCES}else if(perms.indexOf("x")!==-1&&!(node.mode&73)){return ERRNO_CODES.EACCES}return 0}),mayLookup:(function(dir){var err=FS.nodePermissions(dir,"x");if(err)return err;if(!dir.node_ops.lookup)return ERRNO_CODES.EACCES;return 0}),mayCreate:(function(dir,name){try{var node=FS.lookupNode(dir,name);return ERRNO_CODES.EEXIST}catch(e){}return FS.nodePermissions(dir,"wx")}),mayDelete:(function(dir,name,isdir){var node;try{node=FS.lookupNode(dir,name)}catch(e){return e.errno}var err=FS.nodePermissions(dir,"wx");if(err){return err}if(isdir){if(!FS.isDir(node.mode)){return ERRNO_CODES.ENOTDIR}if(FS.isRoot(node)||FS.getPath(node)===FS.cwd()){return ERRNO_CODES.EBUSY}}else{if(FS.isDir(node.mode)){return ERRNO_CODES.EISDIR}}return 0}),mayOpen:(function(node,flags){if(!node){return ERRNO_CODES.ENOENT}if(FS.isLink(node.mode)){return ERRNO_CODES.ELOOP}else if(FS.isDir(node.mode)){if((flags&2097155)!==0||flags&512){return ERRNO_CODES.EISDIR}}return FS.nodePermissions(node,FS.flagsToPermissionString(flags))}),MAX_OPEN_FDS:4096,nextfd:(function(fd_start,fd_end){fd_start=fd_start||0;fd_end=fd_end||FS.MAX_OPEN_FDS;for(var fd=fd_start;fd<=fd_end;fd++){if(!FS.streams[fd]){return fd}}throw new FS.ErrnoError(ERRNO_CODES.EMFILE)}),getStream:(function(fd){return FS.streams[fd]}),createStream:(function(stream,fd_start,fd_end){if(!FS.FSStream){FS.FSStream=(function(){});FS.FSStream.prototype={};Object.defineProperties(FS.FSStream.prototype,{object:{get:(function(){return this.node}),set:(function(val){this.node=val})},isRead:{get:(function(){return(this.flags&2097155)!==1})},isWrite:{get:(function(){return(this.flags&2097155)!==0})},isAppend:{get:(function(){return this.flags&1024})}})}var newStream=new FS.FSStream;for(var p in stream){newStream[p]=stream[p]}stream=newStream;var fd=FS.nextfd(fd_start,fd_end);stream.fd=fd;FS.streams[fd]=stream;return stream}),closeStream:(function(fd){FS.streams[fd]=null}),getStreamFromPtr:(function(ptr){return FS.streams[ptr-1]}),getPtrForStream:(function(stream){return stream?stream.fd+1:0}),chrdev_stream_ops:{open:(function(stream){var device=FS.getDevice(stream.node.rdev);stream.stream_ops=device.stream_ops;if(stream.stream_ops.open){stream.stream_ops.open(stream)}}),llseek:(function(){throw new FS.ErrnoError(ERRNO_CODES.ESPIPE)})},major:(function(dev){return dev>>8}),minor:(function(dev){return dev&255}),makedev:(function(ma,mi){return ma<<8|mi}),registerDevice:(function(dev,ops){FS.devices[dev]={stream_ops:ops}}),getDevice:(function(dev){return FS.devices[dev]}),getMounts:(function(mount){var mounts=[];var check=[mount];while(check.length){var m=check.pop();mounts.push(m);check.push.apply(check,m.mounts)}return mounts}),syncfs:(function(populate,callback){if(typeof populate==="function"){callback=populate;populate=false}var mounts=FS.getMounts(FS.root.mount);var completed=0;function done(err){if(err){if(!done.errored){done.errored=true;return callback(err)}return}if(++completed>=mounts.length){callback(null)}}mounts.forEach((function(mount){if(!mount.type.syncfs){return done(null)}mount.type.syncfs(mount,populate,done)}))}),mount:(function(type,opts,mountpoint){var root=mountpoint==="/";var pseudo=!mountpoint;var node;if(root&&FS.root){throw new FS.ErrnoError(ERRNO_CODES.EBUSY)}else if(!root&&!pseudo){var lookup=FS.lookupPath(mountpoint,{follow_mount:false});mountpoint=lookup.path;node=lookup.node;if(FS.isMountpoint(node)){throw new FS.ErrnoError(ERRNO_CODES.EBUSY)}if(!FS.isDir(node.mode)){throw new FS.ErrnoError(ERRNO_CODES.ENOTDIR)}}var mount={type:type,opts:opts,mountpoint:mountpoint,mounts:[]};var mountRoot=type.mount(mount);mountRoot.mount=mount;mount.root=mountRoot;if(root){FS.root=mountRoot}else if(node){node.mounted=mount;if(node.mount){node.mount.mounts.push(mount)}}return mountRoot}),unmount:(function(mountpoint){var lookup=FS.lookupPath(mountpoint,{follow_mount:false});if(!FS.isMountpoint(lookup.node)){throw new FS.ErrnoError(ERRNO_CODES.EINVAL)}var node=lookup.node;var mount=node.mounted;var mounts=FS.getMounts(mount);Object.keys(FS.nameTable).forEach((function(hash){var current=FS.nameTable[hash];while(current){var next=current.name_next;if(mounts.indexOf(current.mount)!==-1){FS.destroyNode(current)}current=next}}));node.mounted=null;var idx=node.mount.mounts.indexOf(mount);assert(idx!==-1);node.mount.mounts.splice(idx,1)}),lookup:(function(parent,name){return parent.node_ops.lookup(parent,name)}),mknod:(function(path,mode,dev){var lookup=FS.lookupPath(path,{parent:true});var parent=lookup.node;var name=PATH.basename(path);if(!name||name==="."||name===".."){throw new FS.ErrnoError(ERRNO_CODES.EINVAL)}var err=FS.mayCreate(parent,name);if(err){throw new FS.ErrnoError(err)}if(!parent.node_ops.mknod){throw new FS.ErrnoError(ERRNO_CODES.EPERM)}return parent.node_ops.mknod(parent,name,mode,dev)}),create:(function(path,mode){mode=mode!==undefined?mode:438;mode&=4095;mode|=32768;return FS.mknod(path,mode,0)}),mkdir:(function(path,mode){mode=mode!==undefined?mode:511;mode&=511|512;mode|=16384;return FS.mknod(path,mode,0)}),mkdev:(function(path,mode,dev){if(typeof dev==="undefined"){dev=mode;mode=438}mode|=8192;return FS.mknod(path,mode,dev)}),symlink:(function(oldpath,newpath){if(!PATH.resolve(oldpath)){throw new FS.ErrnoError(ERRNO_CODES.ENOENT)}var lookup=FS.lookupPath(newpath,{parent:true});var parent=lookup.node;if(!parent){throw new FS.ErrnoError(ERRNO_CODES.ENOENT)}var newname=PATH.basename(newpath);var err=FS.mayCreate(parent,newname);if(err){throw new FS.ErrnoError(err)}if(!parent.node_ops.symlink){throw new FS.ErrnoError(ERRNO_CODES.EPERM)}return parent.node_ops.symlink(parent,newname,oldpath)}),rename:(function(old_path,new_path){var old_dirname=PATH.dirname(old_path);var new_dirname=PATH.dirname(new_path);var old_name=PATH.basename(old_path);var new_name=PATH.basename(new_path);var lookup,old_dir,new_dir;try{lookup=FS.lookupPath(old_path,{parent:true});old_dir=lookup.node;lookup=FS.lookupPath(new_path,{parent:true});new_dir=lookup.node}catch(e){throw new FS.ErrnoError(ERRNO_CODES.EBUSY)}if(!old_dir||!new_dir)throw new FS.ErrnoError(ERRNO_CODES.ENOENT);if(old_dir.mount!==new_dir.mount){throw new FS.ErrnoError(ERRNO_CODES.EXDEV)}var old_node=FS.lookupNode(old_dir,old_name);var relative=PATH.relative(old_path,new_dirname);if(relative.charAt(0)!=="."){throw new FS.ErrnoError(ERRNO_CODES.EINVAL)}relative=PATH.relative(new_path,old_dirname);if(relative.charAt(0)!=="."){throw new FS.ErrnoError(ERRNO_CODES.ENOTEMPTY)}var new_node;try{new_node=FS.lookupNode(new_dir,new_name)}catch(e){}if(old_node===new_node){return}var isdir=FS.isDir(old_node.mode);var err=FS.mayDelete(old_dir,old_name,isdir);if(err){throw new FS.ErrnoError(err)}err=new_node?FS.mayDelete(new_dir,new_name,isdir):FS.mayCreate(new_dir,new_name);if(err){throw new FS.ErrnoError(err)}if(!old_dir.node_ops.rename){throw new FS.ErrnoError(ERRNO_CODES.EPERM)}if(FS.isMountpoint(old_node)||new_node&&FS.isMountpoint(new_node)){throw new FS.ErrnoError(ERRNO_CODES.EBUSY)}if(new_dir!==old_dir){err=FS.nodePermissions(old_dir,"w");if(err){throw new FS.ErrnoError(err)}}try{if(FS.trackingDelegate["willMovePath"]){FS.trackingDelegate["willMovePath"](old_path,new_path)}}catch(e){console.log("FS.trackingDelegate['willMovePath']('"+old_path+"', '"+new_path+"') threw an exception: "+e.message)}FS.hashRemoveNode(old_node);try{old_dir.node_ops.rename(old_node,new_dir,new_name)}catch(e){throw e}finally{FS.hashAddNode(old_node)}try{if(FS.trackingDelegate["onMovePath"])FS.trackingDelegate["onMovePath"](old_path,new_path)}catch(e){console.log("FS.trackingDelegate['onMovePath']('"+old_path+"', '"+new_path+"') threw an exception: "+e.message)}}),rmdir:(function(path){var lookup=FS.lookupPath(path,{parent:true});var parent=lookup.node;var name=PATH.basename(path);var node=FS.lookupNode(parent,name);var err=FS.mayDelete(parent,name,true);if(err){throw new FS.ErrnoError(err)}if(!parent.node_ops.rmdir){throw new FS.ErrnoError(ERRNO_CODES.EPERM)}if(FS.isMountpoint(node)){throw new FS.ErrnoError(ERRNO_CODES.EBUSY)}try{if(FS.trackingDelegate["willDeletePath"]){FS.trackingDelegate["willDeletePath"](path)}}catch(e){console.log("FS.trackingDelegate['willDeletePath']('"+path+"') threw an exception: "+e.message)}parent.node_ops.rmdir(parent,name);FS.destroyNode(node);try{if(FS.trackingDelegate["onDeletePath"])FS.trackingDelegate["onDeletePath"](path)}catch(e){console.log("FS.trackingDelegate['onDeletePath']('"+path+"') threw an exception: "+e.message)}}),readdir:(function(path){var lookup=FS.lookupPath(path,{follow:true});var node=lookup.node;if(!node.node_ops.readdir){throw new FS.ErrnoError(ERRNO_CODES.ENOTDIR)}return node.node_ops.readdir(node)}),unlink:(function(path){var lookup=FS.lookupPath(path,{parent:true});var parent=lookup.node;var name=PATH.basename(path);var node=FS.lookupNode(parent,name);var err=FS.mayDelete(parent,name,false);if(err){if(err===ERRNO_CODES.EISDIR)err=ERRNO_CODES.EPERM;throw new FS.ErrnoError(err)}if(!parent.node_ops.unlink){throw new FS.ErrnoError(ERRNO_CODES.EPERM)}if(FS.isMountpoint(node)){throw new FS.ErrnoError(ERRNO_CODES.EBUSY)}try{if(FS.trackingDelegate["willDeletePath"]){FS.trackingDelegate["willDeletePath"](path)}}catch(e){console.log("FS.trackingDelegate['willDeletePath']('"+path+"') threw an exception: "+e.message)}parent.node_ops.unlink(parent,name);FS.destroyNode(node);try{if(FS.trackingDelegate["onDeletePath"])FS.trackingDelegate["onDeletePath"](path)}catch(e){console.log("FS.trackingDelegate['onDeletePath']('"+path+"') threw an exception: "+e.message)}}),readlink:(function(path){var lookup=FS.lookupPath(path);var link=lookup.node;if(!link){throw new FS.ErrnoError(ERRNO_CODES.ENOENT)}if(!link.node_ops.readlink){throw new FS.ErrnoError(ERRNO_CODES.EINVAL)}return link.node_ops.readlink(link)}),stat:(function(path,dontFollow){var lookup=FS.lookupPath(path,{follow:!dontFollow});var node=lookup.node;if(!node){throw new FS.ErrnoError(ERRNO_CODES.ENOENT)}if(!node.node_ops.getattr){throw new FS.ErrnoError(ERRNO_CODES.EPERM)}return node.node_ops.getattr(node)}),lstat:(function(path){return FS.stat(path,true)}),chmod:(function(path,mode,dontFollow){var node;if(typeof path==="string"){var lookup=FS.lookupPath(path,{follow:!dontFollow});node=lookup.node}else{node=path}if(!node.node_ops.setattr){throw new FS.ErrnoError(ERRNO_CODES.EPERM)}node.node_ops.setattr(node,{mode:mode&4095|node.mode&~4095,timestamp:Date.now()})}),lchmod:(function(path,mode){FS.chmod(path,mode,true)}),fchmod:(function(fd,mode){var stream=FS.getStream(fd);if(!stream){throw new FS.ErrnoError(ERRNO_CODES.EBADF)}FS.chmod(stream.node,mode)}),chown:(function(path,uid,gid,dontFollow){var node;if(typeof path==="string"){var lookup=FS.lookupPath(path,{follow:!dontFollow});node=lookup.node}else{node=path}if(!node.node_ops.setattr){throw new FS.ErrnoError(ERRNO_CODES.EPERM)}node.node_ops.setattr(node,{timestamp:Date.now()})}),lchown:(function(path,uid,gid){FS.chown(path,uid,gid,true)}),fchown:(function(fd,uid,gid){var stream=FS.getStream(fd);if(!stream){throw new FS.ErrnoError(ERRNO_CODES.EBADF)}FS.chown(stream.node,uid,gid)}),truncate:(function(path,len){if(len<0){throw new FS.ErrnoError(ERRNO_CODES.EINVAL)}var node;if(typeof path==="string"){var lookup=FS.lookupPath(path,{follow:true});node=lookup.node}else{node=path}if(!node.node_ops.setattr){throw new FS.ErrnoError(ERRNO_CODES.EPERM)}if(FS.isDir(node.mode)){throw new FS.ErrnoError(ERRNO_CODES.EISDIR)}if(!FS.isFile(node.mode)){throw new FS.ErrnoError(ERRNO_CODES.EINVAL)}var err=FS.nodePermissions(node,"w");if(err){throw new FS.ErrnoError(err)}node.node_ops.setattr(node,{size:len,timestamp:Date.now()})}),ftruncate:(function(fd,len){var stream=FS.getStream(fd);if(!stream){throw new FS.ErrnoError(ERRNO_CODES.EBADF)}if((stream.flags&2097155)===0){throw new FS.ErrnoError(ERRNO_CODES.EINVAL)}FS.truncate(stream.node,len)}),utime:(function(path,atime,mtime){var lookup=FS.lookupPath(path,{follow:true});var node=lookup.node;node.node_ops.setattr(node,{timestamp:Math.max(atime,mtime)})}),open:(function(path,flags,mode,fd_start,fd_end){if(path===""){throw new FS.ErrnoError(ERRNO_CODES.ENOENT)}flags=typeof flags==="string"?FS.modeStringToFlags(flags):flags;mode=typeof mode==="undefined"?438:mode;if(flags&64){mode=mode&4095|32768}else{mode=0}var node;if(typeof path==="object"){node=path}else{path=PATH.normalize(path);try{var lookup=FS.lookupPath(path,{follow:!(flags&131072)});node=lookup.node}catch(e){}}var created=false;if(flags&64){if(node){if(flags&128){throw new FS.ErrnoError(ERRNO_CODES.EEXIST)}}else{node=FS.mknod(path,mode,0);created=true}}if(!node){throw new FS.ErrnoError(ERRNO_CODES.ENOENT)}if(FS.isChrdev(node.mode)){flags&=~512}if(!created){var err=FS.mayOpen(node,flags);if(err){throw new FS.ErrnoError(err)}}if(flags&512){FS.truncate(node,0)}flags&=~(128|512);var stream=FS.createStream({node:node,path:FS.getPath(node),flags:flags,seekable:true,position:0,stream_ops:node.stream_ops,ungotten:[],error:false},fd_start,fd_end);if(stream.stream_ops.open){stream.stream_ops.open(stream)}if(Module["logReadFiles"]&&!(flags&1)){if(!FS.readFiles)FS.readFiles={};if(!(path in FS.readFiles)){FS.readFiles[path]=1;Module["printErr"]("read file: "+path)}}try{if(FS.trackingDelegate["onOpenFile"]){var trackingFlags=0;if((flags&2097155)!==1){trackingFlags|=FS.tracking.openFlags.READ}if((flags&2097155)!==0){trackingFlags|=FS.tracking.openFlags.WRITE}FS.trackingDelegate["onOpenFile"](path,trackingFlags)}}catch(e){console.log("FS.trackingDelegate['onOpenFile']('"+path+"', flags) threw an exception: "+e.message)}return stream}),close:(function(stream){try{if(stream.stream_ops.close){stream.stream_ops.close(stream)}}catch(e){throw e}finally{FS.closeStream(stream.fd)}}),llseek:(function(stream,offset,whence){if(!stream.seekable||!stream.stream_ops.llseek){throw new FS.ErrnoError(ERRNO_CODES.ESPIPE)}stream.position=stream.stream_ops.llseek(stream,offset,whence);stream.ungotten=[];return stream.position}),read:(function(stream,buffer,offset,length,position){if(length<0||position<0){throw new FS.ErrnoError(ERRNO_CODES.EINVAL)}if((stream.flags&2097155)===1){throw new FS.ErrnoError(ERRNO_CODES.EBADF)}if(FS.isDir(stream.node.mode)){throw new FS.ErrnoError(ERRNO_CODES.EISDIR)}if(!stream.stream_ops.read){throw new FS.ErrnoError(ERRNO_CODES.EINVAL)}var seeking=true;if(typeof position==="undefined"){position=stream.position;seeking=false}else if(!stream.seekable){throw new FS.ErrnoError(ERRNO_CODES.ESPIPE)}var bytesRead=stream.stream_ops.read(stream,buffer,offset,length,position);if(!seeking)stream.position+=bytesRead;return bytesRead}),write:(function(stream,buffer,offset,length,position,canOwn){if(length<0||position<0){throw new FS.ErrnoError(ERRNO_CODES.EINVAL)}if((stream.flags&2097155)===0){throw new FS.ErrnoError(ERRNO_CODES.EBADF)}if(FS.isDir(stream.node.mode)){throw new FS.ErrnoError(ERRNO_CODES.EISDIR)}if(!stream.stream_ops.write){throw new FS.ErrnoError(ERRNO_CODES.EINVAL)}if(stream.flags&1024){FS.llseek(stream,0,2)}var seeking=true;if(typeof position==="undefined"){position=stream.position;seeking=false}else if(!stream.seekable){throw new FS.ErrnoError(ERRNO_CODES.ESPIPE)}var bytesWritten=stream.stream_ops.write(stream,buffer,offset,length,position,canOwn);if(!seeking)stream.position+=bytesWritten;try{if(stream.path&&FS.trackingDelegate["onWriteToFile"])FS.trackingDelegate["onWriteToFile"](stream.path)}catch(e){console.log("FS.trackingDelegate['onWriteToFile']('"+path+"') threw an exception: "+e.message)}return bytesWritten}),allocate:(function(stream,offset,length){if(offset<0||length<=0){throw new FS.ErrnoError(ERRNO_CODES.EINVAL)}if((stream.flags&2097155)===0){throw new FS.ErrnoError(ERRNO_CODES.EBADF)}if(!FS.isFile(stream.node.mode)&&!FS.isDir(node.mode)){throw new FS.ErrnoError(ERRNO_CODES.ENODEV)}if(!stream.stream_ops.allocate){throw new FS.ErrnoError(ERRNO_CODES.EOPNOTSUPP)}stream.stream_ops.allocate(stream,offset,length)}),mmap:(function(stream,buffer,offset,length,position,prot,flags){if((stream.flags&2097155)===1){throw new FS.ErrnoError(ERRNO_CODES.EACCES)}if(!stream.stream_ops.mmap){throw new FS.ErrnoError(ERRNO_CODES.ENODEV)}return stream.stream_ops.mmap(stream,buffer,offset,length,position,prot,flags)}),ioctl:(function(stream,cmd,arg){if(!stream.stream_ops.ioctl){throw new FS.ErrnoError(ERRNO_CODES.ENOTTY)}return stream.stream_ops.ioctl(stream,cmd,arg)}),readFile:(function(path,opts){opts=opts||{};opts.flags=opts.flags||"r";opts.encoding=opts.encoding||"binary";if(opts.encoding!=="utf8"&&opts.encoding!=="binary"){throw new Error('Invalid encoding type "'+opts.encoding+'"')}var ret;var stream=FS.open(path,opts.flags);var stat=FS.stat(path);var length=stat.size;var buf=new Uint8Array(length);FS.read(stream,buf,0,length,0);if(opts.encoding==="utf8"){ret="";var utf8=new Runtime.UTF8Processor;for(var i=0;i<length;i++){ret+=utf8.processCChar(buf[i])}}else if(opts.encoding==="binary"){ret=buf}FS.close(stream);return ret}),writeFile:(function(path,data,opts){opts=opts||{};opts.flags=opts.flags||"w";opts.encoding=opts.encoding||"utf8";if(opts.encoding!=="utf8"&&opts.encoding!=="binary"){throw new Error('Invalid encoding type "'+opts.encoding+'"')}var stream=FS.open(path,opts.flags,opts.mode);if(opts.encoding==="utf8"){var utf8=new Runtime.UTF8Processor;var buf=new Uint8Array(utf8.processJSString(data));FS.write(stream,buf,0,buf.length,0,opts.canOwn)}else if(opts.encoding==="binary"){FS.write(stream,data,0,data.length,0,opts.canOwn)}FS.close(stream)}),cwd:(function(){return FS.currentPath}),chdir:(function(path){var lookup=FS.lookupPath(path,{follow:true});if(!FS.isDir(lookup.node.mode)){throw new FS.ErrnoError(ERRNO_CODES.ENOTDIR)}var err=FS.nodePermissions(lookup.node,"x");if(err){throw new FS.ErrnoError(err)}FS.currentPath=lookup.path}),createDefaultDirectories:(function(){FS.mkdir("/tmp");FS.mkdir("/home");FS.mkdir("/home/web_user")}),createDefaultDevices:(function(){FS.mkdir("/dev");FS.registerDevice(FS.makedev(1,3),{read:(function(){return 0}),write:(function(){return 0})});FS.mkdev("/dev/null",FS.makedev(1,3));TTY.register(FS.makedev(5,0),TTY.default_tty_ops);TTY.register(FS.makedev(6,0),TTY.default_tty1_ops);FS.mkdev("/dev/tty",FS.makedev(5,0));FS.mkdev("/dev/tty1",FS.makedev(6,0));var random_device;if(typeof crypto!=="undefined"){var randomBuffer=new Uint8Array(1);random_device=(function(){crypto.getRandomValues(randomBuffer);return randomBuffer[0]})}else if(ENVIRONMENT_IS_NODE){random_device=(function(){return require("crypto").randomBytes(1)[0]})}else{random_device=(function(){return Math.random()*256|0})}FS.createDevice("/dev","random",random_device);FS.createDevice("/dev","urandom",random_device);FS.mkdir("/dev/shm");FS.mkdir("/dev/shm/tmp")}),createStandardStreams:(function(){if(Module["stdin"]){FS.createDevice("/dev","stdin",Module["stdin"])}else{FS.symlink("/dev/tty","/dev/stdin")}if(Module["stdout"]){FS.createDevice("/dev","stdout",null,Module["stdout"])}else{FS.symlink("/dev/tty","/dev/stdout")}if(Module["stderr"]){FS.createDevice("/dev","stderr",null,Module["stderr"])}else{FS.symlink("/dev/tty1","/dev/stderr")}var stdin=FS.open("/dev/stdin","r");HEAP32[_stdin>>2]=FS.getPtrForStream(stdin);assert(stdin.fd===0,"invalid handle for stdin ("+stdin.fd+")");var stdout=FS.open("/dev/stdout","w");HEAP32[_stdout>>2]=FS.getPtrForStream(stdout);assert(stdout.fd===1,"invalid handle for stdout ("+stdout.fd+")");var stderr=FS.open("/dev/stderr","w");HEAP32[_stderr>>2]=FS.getPtrForStream(stderr);assert(stderr.fd===2,"invalid handle for stderr ("+stderr.fd+")")}),ensureErrnoError:(function(){if(FS.ErrnoError)return;FS.ErrnoError=function ErrnoError(errno,node){this.node=node;this.setErrno=(function(errno){this.errno=errno;for(var key in ERRNO_CODES){if(ERRNO_CODES[key]===errno){this.code=key;break}}});this.setErrno(errno);this.message=ERRNO_MESSAGES[errno]};FS.ErrnoError.prototype=new Error;FS.ErrnoError.prototype.constructor=FS.ErrnoError;[ERRNO_CODES.ENOENT].forEach((function(code){FS.genericErrors[code]=new FS.ErrnoError(code);FS.genericErrors[code].stack="<generic error, no stack>"}))}),staticInit:(function(){FS.ensureErrnoError();FS.nameTable=new Array(4096);FS.mount(MEMFS,{},"/");FS.createDefaultDirectories();FS.createDefaultDevices()}),init:(function(input,output,error){assert(!FS.init.initialized,"FS.init was previously called. If you want to initialize later with custom parameters, remove any earlier calls (note that one is automatically added to the generated code)");FS.init.initialized=true;FS.ensureErrnoError();Module["stdin"]=input||Module["stdin"];Module["stdout"]=output||Module["stdout"];Module["stderr"]=error||Module["stderr"];FS.createStandardStreams()}),quit:(function(){FS.init.initialized=false;for(var i=0;i<FS.streams.length;i++){var stream=FS.streams[i];if(!stream){continue}FS.close(stream)}}),getMode:(function(canRead,canWrite){var mode=0;if(canRead)mode|=292|73;if(canWrite)mode|=146;return mode}),joinPath:(function(parts,forceRelative){var path=PATH.join.apply(null,parts);if(forceRelative&&path[0]=="/")path=path.substr(1);return path}),absolutePath:(function(relative,base){return PATH.resolve(base,relative)}),standardizePath:(function(path){return PATH.normalize(path)}),findObject:(function(path,dontResolveLastLink){var ret=FS.analyzePath(path,dontResolveLastLink);if(ret.exists){return ret.object}else{___setErrNo(ret.error);return null}}),analyzePath:(function(path,dontResolveLastLink){try{var lookup=FS.lookupPath(path,{follow:!dontResolveLastLink});path=lookup.path}catch(e){}var ret={isRoot:false,exists:false,error:0,name:null,path:null,object:null,parentExists:false,parentPath:null,parentObject:null};try{var lookup=FS.lookupPath(path,{parent:true});ret.parentExists=true;ret.parentPath=lookup.path;ret.parentObject=lookup.node;ret.name=PATH.basename(path);lookup=FS.lookupPath(path,{follow:!dontResolveLastLink});ret.exists=true;ret.path=lookup.path;ret.object=lookup.node;ret.name=lookup.node.name;ret.isRoot=lookup.path==="/"}catch(e){ret.error=e.errno}return ret}),createFolder:(function(parent,name,canRead,canWrite){var path=PATH.join2(typeof parent==="string"?parent:FS.getPath(parent),name);var mode=FS.getMode(canRead,canWrite);return FS.mkdir(path,mode)}),createPath:(function(parent,path,canRead,canWrite){parent=typeof parent==="string"?parent:FS.getPath(parent);var parts=path.split("/").reverse();while(parts.length){var part=parts.pop();if(!part)continue;var current=PATH.join2(parent,part);try{FS.mkdir(current)}catch(e){}parent=current}return current}),createFile:(function(parent,name,properties,canRead,canWrite){var path=PATH.join2(typeof parent==="string"?parent:FS.getPath(parent),name);var mode=FS.getMode(canRead,canWrite);return FS.create(path,mode)}),createDataFile:(function(parent,name,data,canRead,canWrite,canOwn){var path=name?PATH.join2(typeof parent==="string"?parent:FS.getPath(parent),name):parent;var mode=FS.getMode(canRead,canWrite);var node=FS.create(path,mode);if(data){if(typeof data==="string"){var arr=new Array(data.length);for(var i=0,len=data.length;i<len;++i)arr[i]=data.charCodeAt(i);data=arr}FS.chmod(node,mode|146);var stream=FS.open(node,"w");FS.write(stream,data,0,data.length,0,canOwn);FS.close(stream);FS.chmod(node,mode)}return node}),createDevice:(function(parent,name,input,output){var path=PATH.join2(typeof parent==="string"?parent:FS.getPath(parent),name);var mode=FS.getMode(!!input,!!output);if(!FS.createDevice.major)FS.createDevice.major=64;var dev=FS.makedev(FS.createDevice.major++,0);FS.registerDevice(dev,{open:(function(stream){stream.seekable=false}),close:(function(stream){if(output&&output.buffer&&output.buffer.length){output(10)}}),read:(function(stream,buffer,offset,length,pos){var bytesRead=0;for(var i=0;i<length;i++){var result;try{result=input()}catch(e){throw new FS.ErrnoError(ERRNO_CODES.EIO)}if(result===undefined&&bytesRead===0){throw new FS.ErrnoError(ERRNO_CODES.EAGAIN)}if(result===null||result===undefined)break;bytesRead++;buffer[offset+i]=result}if(bytesRead){stream.node.timestamp=Date.now()}return bytesRead}),write:(function(stream,buffer,offset,length,pos){for(var i=0;i<length;i++){try{output(buffer[offset+i])}catch(e){throw new FS.ErrnoError(ERRNO_CODES.EIO)}}if(length){stream.node.timestamp=Date.now()}return i})});return FS.mkdev(path,mode,dev)}),createLink:(function(parent,name,target,canRead,canWrite){var path=PATH.join2(typeof parent==="string"?parent:FS.getPath(parent),name);return FS.symlink(target,path)}),forceLoadFile:(function(obj){if(obj.isDevice||obj.isFolder||obj.link||obj.contents)return true;var success=true;if(typeof XMLHttpRequest!=="undefined"){throw new Error("Lazy loading should have been performed (contents set) in createLazyFile, but it was not. Lazy loading only works in web workers. Use --embed-file or --preload-file in emcc on the main thread.")}else if(Module["read"]){try{obj.contents=intArrayFromString(Module["read"](obj.url),true);obj.usedBytes=obj.contents.length}catch(e){success=false}}else{throw new Error("Cannot load without read() or XMLHttpRequest.")}if(!success)___setErrNo(ERRNO_CODES.EIO);return success}),createLazyFile:(function(parent,name,url,canRead,canWrite){function LazyUint8Array(){this.lengthKnown=false;this.chunks=[]}LazyUint8Array.prototype.get=function LazyUint8Array_get(idx){if(idx>this.length-1||idx<0){return undefined}var chunkOffset=idx%this.chunkSize;var chunkNum=idx/this.chunkSize|0;return this.getter(chunkNum)[chunkOffset]};LazyUint8Array.prototype.setDataGetter=function LazyUint8Array_setDataGetter(getter){this.getter=getter};LazyUint8Array.prototype.cacheLength=function LazyUint8Array_cacheLength(){var xhr=new XMLHttpRequest;xhr.open("HEAD",url,false);xhr.send(null);if(!(xhr.status>=200&&xhr.status<300||xhr.status===304))throw new Error("Couldn't load "+url+". Status: "+xhr.status);var datalength=Number(xhr.getResponseHeader("Content-length"));var header;var hasByteServing=(header=xhr.getResponseHeader("Accept-Ranges"))&&header==="bytes";var chunkSize=1024*1024;if(!hasByteServing)chunkSize=datalength;var doXHR=(function(from,to){if(from>to)throw new Error("invalid range ("+from+", "+to+") or no bytes requested!");if(to>datalength-1)throw new Error("only "+datalength+" bytes available! programmer error!");var xhr=new XMLHttpRequest;xhr.open("GET",url,false);if(datalength!==chunkSize)xhr.setRequestHeader("Range","bytes="+from+"-"+to);if(typeof Uint8Array!="undefined")xhr.responseType="arraybuffer";if(xhr.overrideMimeType){xhr.overrideMimeType("text/plain; charset=x-user-defined")}xhr.send(null);if(!(xhr.status>=200&&xhr.status<300||xhr.status===304))throw new Error("Couldn't load "+url+". Status: "+xhr.status);if(xhr.response!==undefined){return new Uint8Array(xhr.response||[])}else{return intArrayFromString(xhr.responseText||"",true)}});var lazyArray=this;lazyArray.setDataGetter((function(chunkNum){var start=chunkNum*chunkSize;var end=(chunkNum+1)*chunkSize-1;end=Math.min(end,datalength-1);if(typeof lazyArray.chunks[chunkNum]==="undefined"){lazyArray.chunks[chunkNum]=doXHR(start,end)}if(typeof lazyArray.chunks[chunkNum]==="undefined")throw new Error("doXHR failed!");return lazyArray.chunks[chunkNum]}));this._length=datalength;this._chunkSize=chunkSize;this.lengthKnown=true};if(typeof XMLHttpRequest!=="undefined"){if(!ENVIRONMENT_IS_WORKER)throw"Cannot do synchronous binary XHRs outside webworkers in modern browsers. Use --embed-file or --preload-file in emcc";var lazyArray=new LazyUint8Array;Object.defineProperty(lazyArray,"length",{get:(function(){if(!this.lengthKnown){this.cacheLength()}return this._length})});Object.defineProperty(lazyArray,"chunkSize",{get:(function(){if(!this.lengthKnown){this.cacheLength()}return this._chunkSize})});var properties={isDevice:false,contents:lazyArray}}else{var properties={isDevice:false,url:url}}var node=FS.createFile(parent,name,properties,canRead,canWrite);if(properties.contents){node.contents=properties.contents}else if(properties.url){node.contents=null;node.url=properties.url}Object.defineProperty(node,"usedBytes",{get:(function(){return this.contents.length})});var stream_ops={};var keys=Object.keys(node.stream_ops);keys.forEach((function(key){var fn=node.stream_ops[key];stream_ops[key]=function forceLoadLazyFile(){if(!FS.forceLoadFile(node)){throw new FS.ErrnoError(ERRNO_CODES.EIO)}return fn.apply(null,arguments)}}));stream_ops.read=function stream_ops_read(stream,buffer,offset,length,position){if(!FS.forceLoadFile(node)){throw new FS.ErrnoError(ERRNO_CODES.EIO)}var contents=stream.node.contents;if(position>=contents.length)return 0;var size=Math.min(contents.length-position,length);assert(size>=0);if(contents.slice){for(var i=0;i<size;i++){buffer[offset+i]=contents[position+i]}}else{for(var i=0;i<size;i++){buffer[offset+i]=contents.get(position+i)}}return size};node.stream_ops=stream_ops;return node}),createPreloadedFile:(function(parent,name,url,canRead,canWrite,onload,onerror,dontCreateFile,canOwn){Browser.init();var fullname=name?PATH.resolve(PATH.join2(parent,name)):parent;function processData(byteArray){function finish(byteArray){if(!dontCreateFile){FS.createDataFile(parent,name,byteArray,canRead,canWrite,canOwn)}if(onload)onload();removeRunDependency("cp "+fullname)}var handled=false;Module["preloadPlugins"].forEach((function(plugin){if(handled)return;if(plugin["canHandle"](fullname)){plugin["handle"](byteArray,fullname,finish,(function(){if(onerror)onerror();removeRunDependency("cp "+fullname)}));handled=true}}));if(!handled)finish(byteArray)}addRunDependency("cp "+fullname);if(typeof url=="string"){Browser.asyncLoad(url,(function(byteArray){processData(byteArray)}),onerror)}else{processData(url)}}),indexedDB:(function(){return window.indexedDB||window.mozIndexedDB||window.webkitIndexedDB||window.msIndexedDB}),DB_NAME:(function(){return"EM_FS_"+window.location.pathname}),DB_VERSION:20,DB_STORE_NAME:"FILE_DATA",saveFilesToDB:(function(paths,onload,onerror){onload=onload||(function(){});onerror=onerror||(function(){});var indexedDB=FS.indexedDB();try{var openRequest=indexedDB.open(FS.DB_NAME(),FS.DB_VERSION)}catch(e){return onerror(e)}openRequest.onupgradeneeded=function openRequest_onupgradeneeded(){console.log("creating db");var db=openRequest.result;db.createObjectStore(FS.DB_STORE_NAME)};openRequest.onsuccess=function openRequest_onsuccess(){var db=openRequest.result;var transaction=db.transaction([FS.DB_STORE_NAME],"readwrite");var files=transaction.objectStore(FS.DB_STORE_NAME);var ok=0,fail=0,total=paths.length;function finish(){if(fail==0)onload();else onerror()}paths.forEach((function(path){var putRequest=files.put(FS.analyzePath(path).object.contents,path);putRequest.onsuccess=function putRequest_onsuccess(){ok++;if(ok+fail==total)finish()};putRequest.onerror=function putRequest_onerror(){fail++;if(ok+fail==total)finish()}}));transaction.onerror=onerror};openRequest.onerror=onerror}),loadFilesFromDB:(function(paths,onload,onerror){onload=onload||(function(){});onerror=onerror||(function(){});var indexedDB=FS.indexedDB();try{var openRequest=indexedDB.open(FS.DB_NAME(),FS.DB_VERSION)}catch(e){return onerror(e)}openRequest.onupgradeneeded=onerror;openRequest.onsuccess=function openRequest_onsuccess(){var db=openRequest.result;try{var transaction=db.transaction([FS.DB_STORE_NAME],"readonly")}catch(e){onerror(e);return}var files=transaction.objectStore(FS.DB_STORE_NAME);var ok=0,fail=0,total=paths.length;function finish(){if(fail==0)onload();else onerror()}paths.forEach((function(path){var getRequest=files.get(path);getRequest.onsuccess=function getRequest_onsuccess(){if(FS.analyzePath(path).exists){FS.unlink(path)}FS.createDataFile(PATH.dirname(path),PATH.basename(path),getRequest.result,true,true,true);ok++;if(ok+fail==total)finish()};getRequest.onerror=function getRequest_onerror(){fail++;if(ok+fail==total)finish()}}));transaction.onerror=onerror};openRequest.onerror=onerror})};var PATH={splitPath:(function(filename){var splitPathRe=/^(\/?|)([\s\S]*?)((?:\.{1,2}|[^\/]+?|)(\.[^.\/]*|))(?:[\/]*)$/;return splitPathRe.exec(filename).slice(1)}),normalizeArray:(function(parts,allowAboveRoot){var up=0;for(var i=parts.length-1;i>=0;i--){var last=parts[i];if(last==="."){parts.splice(i,1)}else if(last===".."){parts.splice(i,1);up++}else if(up){parts.splice(i,1);up--}}if(allowAboveRoot){for(;up--;up){parts.unshift("..")}}return parts}),normalize:(function(path){var isAbsolute=path.charAt(0)==="/",trailingSlash=path.substr(-1)==="/";path=PATH.normalizeArray(path.split("/").filter((function(p){return!!p})),!isAbsolute).join("/");if(!path&&!isAbsolute){path="."}if(path&&trailingSlash){path+="/"}return(isAbsolute?"/":"")+path}),dirname:(function(path){var result=PATH.splitPath(path),root=result[0],dir=result[1];if(!root&&!dir){return"."}if(dir){dir=dir.substr(0,dir.length-1)}return root+dir}),basename:(function(path){if(path==="/")return"/";var lastSlash=path.lastIndexOf("/");if(lastSlash===-1)return path;return path.substr(lastSlash+1)}),extname:(function(path){return PATH.splitPath(path)[3]}),join:(function(){var paths=Array.prototype.slice.call(arguments,0);return PATH.normalize(paths.join("/"))}),join2:(function(l,r){return PATH.normalize(l+"/"+r)}),resolve:(function(){var resolvedPath="",resolvedAbsolute=false;for(var i=arguments.length-1;i>=-1&&!resolvedAbsolute;i--){var path=i>=0?arguments[i]:FS.cwd();if(typeof path!=="string"){throw new TypeError("Arguments to path.resolve must be strings")}else if(!path){return""}resolvedPath=path+"/"+resolvedPath;resolvedAbsolute=path.charAt(0)==="/"}resolvedPath=PATH.normalizeArray(resolvedPath.split("/").filter((function(p){return!!p})),!resolvedAbsolute).join("/");return(resolvedAbsolute?"/":"")+resolvedPath||"."}),relative:(function(from,to){from=PATH.resolve(from).substr(1);to=PATH.resolve(to).substr(1);function trim(arr){var start=0;for(;start<arr.length;start++){if(arr[start]!=="")break}var end=arr.length-1;for(;end>=0;end--){if(arr[end]!=="")break}if(start>end)return[];return arr.slice(start,end-start+1)}var fromParts=trim(from.split("/"));var toParts=trim(to.split("/"));var length=Math.min(fromParts.length,toParts.length);var samePartsLength=length;for(var i=0;i<length;i++){if(fromParts[i]!==toParts[i]){samePartsLength=i;break}}var outputParts=[];for(var i=samePartsLength;i<fromParts.length;i++){outputParts.push("..")}outputParts=outputParts.concat(toParts.slice(samePartsLength));return outputParts.join("/")})};function _emscripten_set_main_loop_timing(mode,value){Browser.mainLoop.timingMode=mode;Browser.mainLoop.timingValue=value;if(!Browser.mainLoop.func){return 1}if(mode==0){Browser.mainLoop.scheduler=function Browser_mainLoop_scheduler(){setTimeout(Browser.mainLoop.runner,value)};Browser.mainLoop.method="timeout"}else if(mode==1){Browser.mainLoop.scheduler=function Browser_mainLoop_scheduler(){Browser.requestAnimationFrame(Browser.mainLoop.runner)};Browser.mainLoop.method="rAF"}return 0}function _emscripten_set_main_loop(func,fps,simulateInfiniteLoop,arg){Module["noExitRuntime"]=true;assert(!Browser.mainLoop.func,"emscripten_set_main_loop: there can only be one main loop function at once: call emscripten_cancel_main_loop to cancel the previous one before setting a new one with different parameters.");Browser.mainLoop.func=func;Browser.mainLoop.arg=arg;var thisMainLoopId=Browser.mainLoop.currentlyRunningMainloop;Browser.mainLoop.runner=function Browser_mainLoop_runner(){if(ABORT)return;if(Browser.mainLoop.queue.length>0){var start=Date.now();var blocker=Browser.mainLoop.queue.shift();blocker.func(blocker.arg);if(Browser.mainLoop.remainingBlockers){var remaining=Browser.mainLoop.remainingBlockers;var next=remaining%1==0?remaining-1:Math.floor(remaining);if(blocker.counted){Browser.mainLoop.remainingBlockers=next}else{next=next+.5;Browser.mainLoop.remainingBlockers=(8*remaining+next)/9}}console.log('main loop blocker "'+blocker.name+'" took '+(Date.now()-start)+" ms");Browser.mainLoop.updateStatus();setTimeout(Browser.mainLoop.runner,0);return}if(thisMainLoopId<Browser.mainLoop.currentlyRunningMainloop)return;Browser.mainLoop.currentFrameNumber=Browser.mainLoop.currentFrameNumber+1|0;if(Browser.mainLoop.timingMode==1&&Browser.mainLoop.timingValue>1&&Browser.mainLoop.currentFrameNumber%Browser.mainLoop.timingValue!=0){Browser.mainLoop.scheduler();return}if(Browser.mainLoop.method==="timeout"&&Module.ctx){Module.printErr("Looks like you are rendering without using requestAnimationFrame for the main loop. You should use 0 for the frame rate in emscripten_set_main_loop in order to use requestAnimationFrame, as that can greatly improve your frame rates!");Browser.mainLoop.method=""}Browser.mainLoop.runIter((function(){if(typeof arg!=="undefined"){Runtime.dynCall("vi",func,[arg])}else{Runtime.dynCall("v",func)}}));if(thisMainLoopId<Browser.mainLoop.currentlyRunningMainloop)return;if(typeof SDL==="object"&&SDL.audio&&SDL.audio.queueNewAudioData)SDL.audio.queueNewAudioData();Browser.mainLoop.scheduler()};if(fps&&fps>0)_emscripten_set_main_loop_timing(0,1e3/fps);else _emscripten_set_main_loop_timing(1,1);Browser.mainLoop.scheduler();if(simulateInfiniteLoop){throw"SimulateInfiniteLoop"}}var Browser={mainLoop:{scheduler:null,method:"",currentlyRunningMainloop:0,func:null,arg:0,timingMode:0,timingValue:0,currentFrameNumber:0,queue:[],pause:(function(){Browser.mainLoop.scheduler=null;Browser.mainLoop.currentlyRunningMainloop++}),resume:(function(){Browser.mainLoop.currentlyRunningMainloop++;var timingMode=Browser.mainLoop.timingMode;var timingValue=Browser.mainLoop.timingValue;var func=Browser.mainLoop.func;Browser.mainLoop.func=null;_emscripten_set_main_loop(func,0,false,Browser.mainLoop.arg);_emscripten_set_main_loop_timing(timingMode,timingValue)}),updateStatus:(function(){if(Module["setStatus"]){var message=Module["statusMessage"]||"Please wait...";var remaining=Browser.mainLoop.remainingBlockers;var expected=Browser.mainLoop.expectedBlockers;if(remaining){if(remaining<expected){Module["setStatus"](message+" ("+(expected-remaining)+"/"+expected+")")}else{Module["setStatus"](message)}}else{Module["setStatus"]("")}}}),runIter:(function(func){if(ABORT)return;if(Module["preMainLoop"]){var preRet=Module["preMainLoop"]();if(preRet===false){return}}try{func()}catch(e){if(e instanceof ExitStatus){return}else{if(e&&typeof e==="object"&&e.stack)Module.printErr("exception thrown: "+[e,e.stack]);throw e}}if(Module["postMainLoop"])Module["postMainLoop"]()})},isFullScreen:false,pointerLock:false,moduleContextCreatedCallbacks:[],workers:[],init:(function(){if(!Module["preloadPlugins"])Module["preloadPlugins"]=[];if(Browser.initted)return;Browser.initted=true;try{new Blob;Browser.hasBlobConstructor=true}catch(e){Browser.hasBlobConstructor=false;console.log("warning: no blob constructor, cannot create blobs with mimetypes")}Browser.BlobBuilder=typeof MozBlobBuilder!="undefined"?MozBlobBuilder:typeof WebKitBlobBuilder!="undefined"?WebKitBlobBuilder:!Browser.hasBlobConstructor?console.log("warning: no BlobBuilder"):null;Browser.URLObject=typeof window!="undefined"?window.URL?window.URL:window.webkitURL:undefined;if(!Module.noImageDecoding&&typeof Browser.URLObject==="undefined"){console.log("warning: Browser does not support creating object URLs. Built-in browser image decoding will not be available.");Module.noImageDecoding=true}var imagePlugin={};imagePlugin["canHandle"]=function imagePlugin_canHandle(name){return!Module.noImageDecoding&&/\.(jpg|jpeg|png|bmp)$/i.test(name)};imagePlugin["handle"]=function imagePlugin_handle(byteArray,name,onload,onerror){var b=null;if(Browser.hasBlobConstructor){try{b=new Blob([byteArray],{type:Browser.getMimetype(name)});if(b.size!==byteArray.length){b=new Blob([(new Uint8Array(byteArray)).buffer],{type:Browser.getMimetype(name)})}}catch(e){Runtime.warnOnce("Blob constructor present but fails: "+e+"; falling back to blob builder")}}if(!b){var bb=new Browser.BlobBuilder;bb.append((new Uint8Array(byteArray)).buffer);b=bb.getBlob()}var url=Browser.URLObject.createObjectURL(b);var img=new Image;img.onload=function img_onload(){assert(img.complete,"Image "+name+" could not be decoded");var canvas=document.createElement("canvas");canvas.width=img.width;canvas.height=img.height;var ctx=canvas.getContext("2d");ctx.drawImage(img,0,0);Module["preloadedImages"][name]=canvas;Browser.URLObject.revokeObjectURL(url);if(onload)onload(byteArray)};img.onerror=function img_onerror(event){console.log("Image "+url+" could not be decoded");if(onerror)onerror()};img.src=url};Module["preloadPlugins"].push(imagePlugin);var audioPlugin={};audioPlugin["canHandle"]=function audioPlugin_canHandle(name){return!Module.noAudioDecoding&&name.substr(-4)in{".ogg":1,".wav":1,".mp3":1}};audioPlugin["handle"]=function audioPlugin_handle(byteArray,name,onload,onerror){var done=false;function finish(audio){if(done)return;done=true;Module["preloadedAudios"][name]=audio;if(onload)onload(byteArray)}function fail(){if(done)return;done=true;Module["preloadedAudios"][name]=new Audio;if(onerror)onerror()}if(Browser.hasBlobConstructor){try{var b=new Blob([byteArray],{type:Browser.getMimetype(name)})}catch(e){return fail()}var url=Browser.URLObject.createObjectURL(b);var audio=new Audio;audio.addEventListener("canplaythrough",(function(){finish(audio)}),false);audio.onerror=function audio_onerror(event){if(done)return;console.log("warning: browser could not fully decode audio "+name+", trying slower base64 approach");function encode64(data){var BASE="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";var PAD="=";var ret="";var leftchar=0;var leftbits=0;for(var i=0;i<data.length;i++){leftchar=leftchar<<8|data[i];leftbits+=8;while(leftbits>=6){var curr=leftchar>>leftbits-6&63;leftbits-=6;ret+=BASE[curr]}}if(leftbits==2){ret+=BASE[(leftchar&3)<<4];ret+=PAD+PAD}else if(leftbits==4){ret+=BASE[(leftchar&15)<<2];ret+=PAD}return ret}audio.src="data:audio/x-"+name.substr(-3)+";base64,"+encode64(byteArray);finish(audio)};audio.src=url;Browser.safeSetTimeout((function(){finish(audio)}),1e4)}else{return fail()}};Module["preloadPlugins"].push(audioPlugin);var canvas=Module["canvas"];function pointerLockChange(){Browser.pointerLock=document["pointerLockElement"]===canvas||document["mozPointerLockElement"]===canvas||document["webkitPointerLockElement"]===canvas||document["msPointerLockElement"]===canvas}if(canvas){canvas.requestPointerLock=canvas["requestPointerLock"]||canvas["mozRequestPointerLock"]||canvas["webkitRequestPointerLock"]||canvas["msRequestPointerLock"]||(function(){});canvas.exitPointerLock=document["exitPointerLock"]||document["mozExitPointerLock"]||document["webkitExitPointerLock"]||document["msExitPointerLock"]||(function(){});canvas.exitPointerLock=canvas.exitPointerLock.bind(document);document.addEventListener("pointerlockchange",pointerLockChange,false);document.addEventListener("mozpointerlockchange",pointerLockChange,false);document.addEventListener("webkitpointerlockchange",pointerLockChange,false);document.addEventListener("mspointerlockchange",pointerLockChange,false);if(Module["elementPointerLock"]){canvas.addEventListener("click",(function(ev){if(!Browser.pointerLock&&canvas.requestPointerLock){canvas.requestPointerLock();ev.preventDefault()}}),false)}}}),createContext:(function(canvas,useWebGL,setInModule,webGLContextAttributes){if(useWebGL&&Module.ctx&&canvas==Module.canvas)return Module.ctx;var ctx;var contextHandle;if(useWebGL){var contextAttributes={antialias:false,alpha:false};if(webGLContextAttributes){for(var attribute in webGLContextAttributes){contextAttributes[attribute]=webGLContextAttributes[attribute]}}contextHandle=GL.createContext(canvas,contextAttributes);if(contextHandle){ctx=GL.getContext(contextHandle).GLctx}canvas.style.backgroundColor="black"}else{ctx=canvas.getContext("2d")}if(!ctx)return null;if(setInModule){if(!useWebGL)assert(typeof GLctx==="undefined","cannot set in module if GLctx is used, but we are a non-GL context that would replace it");Module.ctx=ctx;if(useWebGL)GL.makeContextCurrent(contextHandle);Module.useWebGL=useWebGL;Browser.moduleContextCreatedCallbacks.forEach((function(callback){callback()}));Browser.init()}return ctx}),destroyContext:(function(canvas,useWebGL,setInModule){}),fullScreenHandlersInstalled:false,lockPointer:undefined,resizeCanvas:undefined,requestFullScreen:(function(lockPointer,resizeCanvas){Browser.lockPointer=lockPointer;Browser.resizeCanvas=resizeCanvas;if(typeof Browser.lockPointer==="undefined")Browser.lockPointer=true;if(typeof Browser.resizeCanvas==="undefined")Browser.resizeCanvas=false;var canvas=Module["canvas"];function fullScreenChange(){Browser.isFullScreen=false;var canvasContainer=canvas.parentNode;if((document["webkitFullScreenElement"]||document["webkitFullscreenElement"]||document["mozFullScreenElement"]||document["mozFullscreenElement"]||document["fullScreenElement"]||document["fullscreenElement"]||document["msFullScreenElement"]||document["msFullscreenElement"]||document["webkitCurrentFullScreenElement"])===canvasContainer){canvas.cancelFullScreen=document["cancelFullScreen"]||document["mozCancelFullScreen"]||document["webkitCancelFullScreen"]||document["msExitFullscreen"]||document["exitFullscreen"]||(function(){});canvas.cancelFullScreen=canvas.cancelFullScreen.bind(document);if(Browser.lockPointer)canvas.requestPointerLock();Browser.isFullScreen=true;if(Browser.resizeCanvas)Browser.setFullScreenCanvasSize()}else{canvasContainer.parentNode.insertBefore(canvas,canvasContainer);canvasContainer.parentNode.removeChild(canvasContainer);if(Browser.resizeCanvas)Browser.setWindowedCanvasSize()}if(Module["onFullScreen"])Module["onFullScreen"](Browser.isFullScreen);Browser.updateCanvasDimensions(canvas)}if(!Browser.fullScreenHandlersInstalled){Browser.fullScreenHandlersInstalled=true;document.addEventListener("fullscreenchange",fullScreenChange,false);document.addEventListener("mozfullscreenchange",fullScreenChange,false);document.addEventListener("webkitfullscreenchange",fullScreenChange,false);document.addEventListener("MSFullscreenChange",fullScreenChange,false)}var canvasContainer=document.createElement("div");canvas.parentNode.insertBefore(canvasContainer,canvas);canvasContainer.appendChild(canvas);canvasContainer.requestFullScreen=canvasContainer["requestFullScreen"]||canvasContainer["mozRequestFullScreen"]||canvasContainer["msRequestFullscreen"]||(canvasContainer["webkitRequestFullScreen"]?(function(){canvasContainer["webkitRequestFullScreen"](Element["ALLOW_KEYBOARD_INPUT"])}):null);canvasContainer.requestFullScreen()}),nextRAF:0,fakeRequestAnimationFrame:(function(func){var now=Date.now();if(Browser.nextRAF===0){Browser.nextRAF=now+1e3/60}else{while(now+2>=Browser.nextRAF){Browser.nextRAF+=1e3/60}}var delay=Math.max(Browser.nextRAF-now,0);setTimeout(func,delay)}),requestAnimationFrame:function requestAnimationFrame(func){if(typeof window==="undefined"){Browser.fakeRequestAnimationFrame(func)}else{if(!window.requestAnimationFrame){window.requestAnimationFrame=window["requestAnimationFrame"]||window["mozRequestAnimationFrame"]||window["webkitRequestAnimationFrame"]||window["msRequestAnimationFrame"]||window["oRequestAnimationFrame"]||Browser.fakeRequestAnimationFrame}window.requestAnimationFrame(func)}},safeCallback:(function(func){return(function(){if(!ABORT)return func.apply(null,arguments)})}),safeRequestAnimationFrame:(function(func){return Browser.requestAnimationFrame((function(){if(!ABORT)func()}))}),safeSetTimeout:(function(func,timeout){Module["noExitRuntime"]=true;return setTimeout((function(){if(!ABORT)func()}),timeout)}),safeSetInterval:(function(func,timeout){Module["noExitRuntime"]=true;return setInterval((function(){if(!ABORT)func()}),timeout)}),getMimetype:(function(name){return{"jpg":"image/jpeg","jpeg":"image/jpeg","png":"image/png","bmp":"image/bmp","ogg":"audio/ogg","wav":"audio/wav","mp3":"audio/mpeg"}[name.substr(name.lastIndexOf(".")+1)]}),getUserMedia:(function(func){if(!window.getUserMedia){window.getUserMedia=navigator["getUserMedia"]||navigator["mozGetUserMedia"]}window.getUserMedia(func)}),getMovementX:(function(event){return event["movementX"]||event["mozMovementX"]||event["webkitMovementX"]||0}),getMovementY:(function(event){return event["movementY"]||event["mozMovementY"]||event["webkitMovementY"]||0}),getMouseWheelDelta:(function(event){var delta=0;switch(event.type){case"DOMMouseScroll":delta=event.detail;break;case"mousewheel":delta=event.wheelDelta;break;case"wheel":delta=event["deltaY"];break;default:throw"unrecognized mouse wheel event: "+event.type}return delta}),mouseX:0,mouseY:0,mouseMovementX:0,mouseMovementY:0,touches:{},lastTouches:{},calculateMouseEvent:(function(event){if(Browser.pointerLock){if(event.type!="mousemove"&&"mozMovementX"in event){Browser.mouseMovementX=Browser.mouseMovementY=0}else{Browser.mouseMovementX=Browser.getMovementX(event);Browser.mouseMovementY=Browser.getMovementY(event)}if(typeof SDL!="undefined"){Browser.mouseX=SDL.mouseX+Browser.mouseMovementX;Browser.mouseY=SDL.mouseY+Browser.mouseMovementY}else{Browser.mouseX+=Browser.mouseMovementX;Browser.mouseY+=Browser.mouseMovementY}}else{var rect=Module["canvas"].getBoundingClientRect();var cw=Module["canvas"].width;var ch=Module["canvas"].height;var scrollX=typeof window.scrollX!=="undefined"?window.scrollX:window.pageXOffset;var scrollY=typeof window.scrollY!=="undefined"?window.scrollY:window.pageYOffset;if(event.type==="touchstart"||event.type==="touchend"||event.type==="touchmove"){var touch=event.touch;if(touch===undefined){return}var adjustedX=touch.pageX-(scrollX+rect.left);var adjustedY=touch.pageY-(scrollY+rect.top);adjustedX=adjustedX*(cw/rect.width);adjustedY=adjustedY*(ch/rect.height);var coords={x:adjustedX,y:adjustedY};if(event.type==="touchstart"){Browser.lastTouches[touch.identifier]=coords;Browser.touches[touch.identifier]=coords}else if(event.type==="touchend"||event.type==="touchmove"){Browser.lastTouches[touch.identifier]=Browser.touches[touch.identifier];Browser.touches[touch.identifier]={x:adjustedX,y:adjustedY}}return}var x=event.pageX-(scrollX+rect.left);var y=event.pageY-(scrollY+rect.top);x=x*(cw/rect.width);y=y*(ch/rect.height);Browser.mouseMovementX=x-Browser.mouseX;Browser.mouseMovementY=y-Browser.mouseY;Browser.mouseX=x;Browser.mouseY=y}}),xhrLoad:(function(url,onload,onerror){var xhr=new XMLHttpRequest;xhr.open("GET",url,true);xhr.responseType="arraybuffer";xhr.onload=function xhr_onload(){if(xhr.status==200||xhr.status==0&&xhr.response){onload(xhr.response)}else{onerror()}};xhr.onerror=onerror;xhr.send(null)}),asyncLoad:(function(url,onload,onerror,noRunDep){Browser.xhrLoad(url,(function(arrayBuffer){assert(arrayBuffer,'Loading data file "'+url+'" failed (no arrayBuffer).');onload(new Uint8Array(arrayBuffer));if(!noRunDep)removeRunDependency("al "+url)}),(function(event){if(onerror){onerror()}else{throw'Loading data file "'+url+'" failed.'}}));if(!noRunDep)addRunDependency("al "+url)}),resizeListeners:[],updateResizeListeners:(function(){var canvas=Module["canvas"];Browser.resizeListeners.forEach((function(listener){listener(canvas.width,canvas.height)}))}),setCanvasSize:(function(width,height,noUpdates){var canvas=Module["canvas"];Browser.updateCanvasDimensions(canvas,width,height);if(!noUpdates)Browser.updateResizeListeners()}),windowedWidth:0,windowedHeight:0,setFullScreenCanvasSize:(function(){if(typeof SDL!="undefined"){var flags=HEAPU32[SDL.screen+Runtime.QUANTUM_SIZE*0>>2];flags=flags|8388608;HEAP32[SDL.screen+Runtime.QUANTUM_SIZE*0>>2]=flags}Browser.updateResizeListeners()}),setWindowedCanvasSize:(function(){if(typeof SDL!="undefined"){var flags=HEAPU32[SDL.screen+Runtime.QUANTUM_SIZE*0>>2];flags=flags&~8388608;HEAP32[SDL.screen+Runtime.QUANTUM_SIZE*0>>2]=flags}Browser.updateResizeListeners()}),updateCanvasDimensions:(function(canvas,wNative,hNative){if(wNative&&hNative){canvas.widthNative=wNative;canvas.heightNative=hNative}else{wNative=canvas.widthNative;hNative=canvas.heightNative}var w=wNative;var h=hNative;if(Module["forcedAspectRatio"]&&Module["forcedAspectRatio"]>0){if(w/h<Module["forcedAspectRatio"]){w=Math.round(h*Module["forcedAspectRatio"])}else{h=Math.round(w/Module["forcedAspectRatio"])}}if((document["webkitFullScreenElement"]||document["webkitFullscreenElement"]||document["mozFullScreenElement"]||document["mozFullscreenElement"]||document["fullScreenElement"]||document["fullscreenElement"]||document["msFullScreenElement"]||document["msFullscreenElement"]||document["webkitCurrentFullScreenElement"])===canvas.parentNode&&typeof screen!="undefined"){var factor=Math.min(screen.width/w,screen.height/h);w=Math.round(w*factor);h=Math.round(h*factor)}if(Browser.resizeCanvas){if(canvas.width!=w)canvas.width=w;if(canvas.height!=h)canvas.height=h;if(typeof canvas.style!="undefined"){canvas.style.removeProperty("width");canvas.style.removeProperty("height")}}else{if(canvas.width!=wNative)canvas.width=wNative;if(canvas.height!=hNative)canvas.height=hNative;if(typeof canvas.style!="undefined"){if(w!=wNative||h!=hNative){canvas.style.setProperty("width",w+"px","important");canvas.style.setProperty("height",h+"px","important")}else{canvas.style.removeProperty("width");canvas.style.removeProperty("height")}}}}),wgetRequests:{},nextWgetRequestHandle:0,getNextWgetRequestHandle:(function(){var handle=Browser.nextWgetRequestHandle;Browser.nextWgetRequestHandle++;return handle})};function _time(ptr){var ret=Date.now()/1e3|0;if(ptr){HEAP32[ptr>>2]=ret}return ret}___errno_state=Runtime.staticAlloc(4);HEAP32[___errno_state>>2]=0;Module["requestFullScreen"]=function Module_requestFullScreen(lockPointer,resizeCanvas){Browser.requestFullScreen(lockPointer,resizeCanvas)};Module["requestAnimationFrame"]=function Module_requestAnimationFrame(func){Browser.requestAnimationFrame(func)};Module["setCanvasSize"]=function Module_setCanvasSize(width,height,noUpdates){Browser.setCanvasSize(width,height,noUpdates)};Module["pauseMainLoop"]=function Module_pauseMainLoop(){Browser.mainLoop.pause()};Module["resumeMainLoop"]=function Module_resumeMainLoop(){Browser.mainLoop.resume()};Module["getUserMedia"]=function Module_getUserMedia(){Browser.getUserMedia()};FS.staticInit();__ATINIT__.unshift({func:(function(){if(!Module["noFSInit"]&&!FS.init.initialized)FS.init()})});__ATMAIN__.push({func:(function(){FS.ignorePermissions=false})});__ATEXIT__.push({func:(function(){FS.quit()})});Module["FS_createFolder"]=FS.createFolder;Module["FS_createPath"]=FS.createPath;Module["FS_createDataFile"]=FS.createDataFile;Module["FS_createPreloadedFile"]=FS.createPreloadedFile;Module["FS_createLazyFile"]=FS.createLazyFile;Module["FS_createLink"]=FS.createLink;Module["FS_createDevice"]=FS.createDevice;__ATINIT__.unshift({func:(function(){TTY.init()})});__ATEXIT__.push({func:(function(){TTY.shutdown()})});TTY.utf8=new Runtime.UTF8Processor;if(ENVIRONMENT_IS_NODE){var fs=require("fs");NODEFS.staticInit()}STACK_BASE=STACKTOP=Runtime.alignMemory(STATICTOP);staticSealed=true;STACK_MAX=STACK_BASE+TOTAL_STACK;DYNAMIC_BASE=DYNAMICTOP=Runtime.alignMemory(STACK_MAX);assert(DYNAMIC_BASE<TOTAL_MEMORY,"TOTAL_MEMORY not big enough for stack");var ctlz_i8=allocate([8,7,6,6,5,5,5,5,4,4,4,4,4,4,4,4,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0],"i8",ALLOC_DYNAMIC);var cttz_i8=allocate([8,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,5,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,6,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,5,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,7,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,5,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,6,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,5,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0,4,0,1,0,2,0,1,0,3,0,1,0,2,0,1,0],"i8",ALLOC_DYNAMIC);Module.asmGlobalArg={"Math":Math,"Int8Array":Int8Array,"Int16Array":Int16Array,"Int32Array":Int32Array,"Uint8Array":Uint8Array,"Uint16Array":Uint16Array,"Uint32Array":Uint32Array,"Float32Array":Float32Array,"Float64Array":Float64Array};Module.asmLibraryArg={"abort":abort,"assert":assert,"min":Math_min,"_fflush":_fflush,"_sysconf":_sysconf,"_abort":_abort,"___setErrNo":___setErrNo,"_sbrk":_sbrk,"_time":_time,"_emscripten_set_main_loop_timing":_emscripten_set_main_loop_timing,"_emscripten_memcpy_big":_emscripten_memcpy_big,"_emscripten_set_main_loop":_emscripten_set_main_loop,"___errno_location":___errno_location,"STACKTOP":STACKTOP,"STACK_MAX":STACK_MAX,"tempDoublePtr":tempDoublePtr,"ABORT":ABORT,"cttz_i8":cttz_i8,"ctlz_i8":ctlz_i8,"NaN":NaN,"Infinity":Infinity};// EMSCRIPTEN_START_ASM
var asm=(function(global,env,buffer) {
"use asm";var a=new global.Int8Array(buffer);var b=new global.Int16Array(buffer);var c=new global.Int32Array(buffer);var d=new global.Uint8Array(buffer);var e=new global.Uint16Array(buffer);var f=new global.Uint32Array(buffer);var g=new global.Float32Array(buffer);var h=new global.Float64Array(buffer);var i=env.STACKTOP|0;var j=env.STACK_MAX|0;var k=env.tempDoublePtr|0;var l=env.ABORT|0;var m=env.cttz_i8|0;var n=env.ctlz_i8|0;var o=0;var p=0;var q=0;var r=0;var s=+env.NaN,t=+env.Infinity;var u=0,v=0,w=0,x=0,y=0.0,z=0,A=0,B=0,C=0.0;var D=0;var E=0;var F=0;var G=0;var H=0;var I=0;var J=0;var K=0;var L=0;var M=0;var N=global.Math.floor;var O=global.Math.abs;var P=global.Math.sqrt;var Q=global.Math.pow;var R=global.Math.cos;var S=global.Math.sin;var T=global.Math.tan;var U=global.Math.acos;var V=global.Math.asin;var W=global.Math.atan;var X=global.Math.atan2;var Y=global.Math.exp;var Z=global.Math.log;var _=global.Math.ceil;var $=global.Math.imul;var aa=env.abort;var ba=env.assert;var ca=env.min;var da=env._fflush;var ea=env._sysconf;var fa=env._abort;var ga=env.___setErrNo;var ha=env._sbrk;var ia=env._time;var ja=env._emscripten_set_main_loop_timing;var ka=env._emscripten_memcpy_big;var la=env._emscripten_set_main_loop;var ma=env.___errno_location;var na=0.0;
// EMSCRIPTEN_START_FUNCS
function oa(a){a=a|0;var b=0;b=i;i=i+a|0;i=i+15&-16;return b|0}function pa(){return i|0}function qa(a){a=a|0;i=a}function ra(a,b){a=a|0;b=b|0;if(!o){o=a;p=b}}function sa(b){b=b|0;a[k>>0]=a[b>>0];a[k+1>>0]=a[b+1>>0];a[k+2>>0]=a[b+2>>0];a[k+3>>0]=a[b+3>>0]}function ta(b){b=b|0;a[k>>0]=a[b>>0];a[k+1>>0]=a[b+1>>0];a[k+2>>0]=a[b+2>>0];a[k+3>>0]=a[b+3>>0];a[k+4>>0]=a[b+4>>0];a[k+5>>0]=a[b+5>>0];a[k+6>>0]=a[b+6>>0];a[k+7>>0]=a[b+7>>0]}function ua(a){a=a|0;D=a}function va(){return D|0}function wa(b,c){b=b|0;c=c|0;return ((((a[c+1>>0]^a[b+1>>0]|a[c>>0]^a[b>>0]|a[c+2>>0]^a[b+2>>0]|a[c+3>>0]^a[b+3>>0]|a[c+4>>0]^a[b+4>>0]|a[c+5>>0]^a[b+5>>0]|a[c+6>>0]^a[b+6>>0]|a[c+7>>0]^a[b+7>>0]|a[c+8>>0]^a[b+8>>0]|a[c+9>>0]^a[b+9>>0]|a[c+10>>0]^a[b+10>>0]|a[c+11>>0]^a[b+11>>0]|a[c+12>>0]^a[b+12>>0]|a[c+13>>0]^a[b+13>>0]|a[c+14>>0]^a[b+14>>0]|a[c+15>>0]^a[b+15>>0]|a[c+16>>0]^a[b+16>>0]|a[c+17>>0]^a[b+17>>0]|a[c+18>>0]^a[b+18>>0]|a[c+19>>0]^a[b+19>>0]|a[c+20>>0]^a[b+20>>0]|a[c+21>>0]^a[b+21>>0]|a[c+22>>0]^a[b+22>>0]|a[c+23>>0]^a[b+23>>0]|a[c+24>>0]^a[b+24>>0]|a[c+25>>0]^a[b+25>>0]|a[c+26>>0]^a[b+26>>0]|a[c+27>>0]^a[b+27>>0]|a[c+28>>0]^a[b+28>>0]|a[c+29>>0]^a[b+29>>0]|a[c+30>>0]^a[b+30>>0]|a[c+31>>0]^a[b+31>>0])&255)+511|0)>>>8&1)+-1|0}function xa(b,e,f,g){b=b|0;e=e|0;f=f|0;g=g|0;var h=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0;h=i;i=i+240|0;j=h+8|0;k=h+168|0;l=h;m=i;i=i+((1*(g+64|0)|0)+15&-16)|0;n=l;c[n>>2]=0;c[n+4>>2]=0;n=k+0|0;o=e+0|0;p=n+32|0;do{a[n>>0]=a[o>>0]|0;n=n+1|0;o=o+1|0}while((n|0)<(p|0));jb(j,e);hb(k+32|0,j);j=(d[k+63>>0]|0)&128;Aa(m,l,f,g,0,k)|0;n=b+0|0;o=m+0|0;p=n+64|0;do{a[n>>0]=a[o>>0]|0;n=n+1|0;o=o+1|0}while((n|0)<(p|0));o=b+63|0;a[o>>0]=d[o>>0]|0|j;i=h;return}function ya(b,c,e,f){b=b|0;c=c|0;e=e|0;f=f|0;var g=0,h=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0;g=i;i=i+288|0;h=g+208|0;j=g+168|0;k=g+128|0;l=g+88|0;m=g+48|0;n=g+8|0;o=g+248|0;p=g;q=f+64|0;r=i;i=i+((1*q|0)+15&-16)|0;s=i;i=i+((1*q|0)+15&-16)|0;Ka(h,c);Ga(m);Ta(j,h,m);Ha(k,h,m);La(l,k);Oa(n,j,l);Ua(o,n);n=b+63|0;l=d[n>>0]|0;j=o+31|0;a[j>>0]=d[j>>0]|0|l&128;a[n>>0]=l&127;l=r+0|0;n=b+0|0;b=l+64|0;do{a[l>>0]=a[n>>0]|0;l=l+1|0;n=n+1|0}while((l|0)<(b|0));Fb(r+64|0,e|0,f|0)|0;f=nb(s,p,r,q,0,o)|0;i=g;return f|0}function za(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;var e=0;d=i;i=i+208|0;e=d;qb(e);rb(e,b,c);sb(e,a);i=d;return 0}function Aa(b,d,e,f,g,h){b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;h=h|0;var j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0;j=i;i=i+320|0;k=j+288|0;l=j+224|0;m=j+160|0;n=j;o=k+0|0;p=h+32|0;q=o+32|0;do{a[o>>0]=a[p>>0]|0;o=o+1|0;p=p+1|0}while((o|0)<(q|0));r=Ab(f|0,g|0,64,0)|0;s=D;t=d;c[t>>2]=r;c[t+4>>2]=s;Gb(b+64|0,e|0,f|0)|0;e=b+32|0;Gb(e|0,h|0,32)|0;t=Ab(f|0,g|0,32,0)|0;za(l,e,t,D)|0;o=e+0|0;p=k+0|0;q=o+32|0;do{a[o>>0]=a[p>>0]|0;o=o+1|0;p=p+1|0}while((o|0)<(q|0));pb(l);jb(n,l);hb(b,n);za(m,b,r,s)|0;pb(m);ob(e,m,h,l);i=j;return 0}function Ba(b,e,f){b=b|0;e=e|0;f=f|0;var g=0,h=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0,L=0,M=0,N=0,O=0,P=0,Q=0,R=0,S=0,T=0,U=0,V=0,W=0,X=0,Y=0,Z=0,_=0,aa=0,ba=0,ca=0,da=0,ea=0,fa=0,ga=0,ha=0,ia=0,ja=0,ka=0,la=0,ma=0,na=0,oa=0,pa=0,qa=0,ra=0,sa=0,ta=0,ua=0,va=0,wa=0,xa=0,ya=0,za=0,Aa=0,Ba=0,Fa=0,Ga=0,Ha=0,Ia=0,Ja=0,Ka=0,La=0,Ma=0,Na=0,Oa=0,Pa=0,Qa=0,Ra=0,Sa=0,Ta=0,Ua=0,Va=0,Wa=0,Xa=0,Ya=0,Za=0,_a=0,$a=0,ab=0,bb=0,cb=0,db=0,eb=0,fb=0,gb=0,hb=0,ib=0,jb=0,kb=0,lb=0,mb=0,nb=0,ob=0,pb=0,qb=0,rb=0,sb=0,tb=0,ub=0,vb=0,wb=0,xb=0,Eb=0,Fb=0,Gb=0,Hb=0,Ib=0,Jb=0,Kb=0,Lb=0,Nb=0,Ob=0,Pb=0,Qb=0,Rb=0,Sb=0,Tb=0,Ub=0,Vb=0,Wb=0,Xb=0,Yb=0,Zb=0,_b=0,$b=0,ac=0,bc=0,cc=0,dc=0,ec=0,fc=0,gc=0,hc=0,ic=0,jc=0,kc=0,lc=0,mc=0,nc=0,oc=0,pc=0,qc=0,rc=0,sc=0,tc=0,uc=0,vc=0,wc=0,xc=0,yc=0,zc=0,Ac=0,Bc=0,Cc=0;g=i;i=i+2640|0;h=g+2456|0;j=g+2304|0;k=g+2152|0;l=g+2e3|0;m=g+1848|0;n=g+1696|0;o=g+1544|0;p=g+1392|0;q=g+1240|0;r=g+1088|0;s=g+936|0;t=g+784|0;u=g+632|0;v=g+480|0;w=g+328|0;x=g+248|0;y=g+168|0;z=g+80|0;A=g;B=g+2608|0;C=B+0|0;E=e+0|0;e=C+32|0;do{a[C>>0]=a[E>>0]|0;C=C+1|0;E=E+1|0}while((C|0)<(e|0));F=d[f>>0]|0;G=Db(d[f+1>>0]|0|0,0,8)|0;H=D;I=Db(d[f+2>>0]|0|0,0,16)|0;J=H|D;H=d[f+3>>0]|0;K=Db(H|0,0,24)|0;L=x;c[L>>2]=G|F|I|K&50331648;c[L+4>>2]=J;J=Db(d[f+4>>0]|0|0,0,8)|0;L=D;K=Db(d[f+5>>0]|0|0,0,16)|0;I=L|D;L=d[f+6>>0]|0;F=Db(L|0,0,24)|0;G=Cb(J|H|K|F|0,I|D|0,2)|0;I=x+8|0;c[I>>2]=G&33554431;c[I+4>>2]=0;I=Db(d[f+7>>0]|0|0,0,8)|0;G=D;F=Db(d[f+8>>0]|0|0,0,16)|0;K=G|D;G=d[f+9>>0]|0;H=Db(G|0,0,24)|0;J=Cb(I|L|F|H|0,K|D|0,3)|0;K=x+16|0;c[K>>2]=J&67108863;c[K+4>>2]=0;K=Db(d[f+10>>0]|0|0,0,8)|0;J=D;H=Db(d[f+11>>0]|0|0,0,16)|0;F=J|D;J=d[f+12>>0]|0;L=Db(J|0,0,24)|0;I=Cb(K|G|H|L|0,F|D|0,5)|0;F=x+24|0;c[F>>2]=I&33554431;c[F+4>>2]=0;F=Db(d[f+13>>0]|0|0,0,8)|0;I=D;L=Db(d[f+14>>0]|0|0,0,16)|0;H=I|D;I=Db(d[f+15>>0]|0|0,0,24)|0;G=Cb(F|J|L|I|0,H|D|0,6)|0;H=x+32|0;c[H>>2]=G&67108863;c[H+4>>2]=0;H=d[f+16>>0]|0;G=Db(d[f+17>>0]|0|0,0,8)|0;I=D;L=Db(d[f+18>>0]|0|0,0,16)|0;J=I|D;I=d[f+19>>0]|0;F=Db(I|0,0,24)|0;K=x+40|0;c[K>>2]=G|H|L|F&16777216;c[K+4>>2]=J;J=Db(d[f+20>>0]|0|0,0,8)|0;K=D;F=Db(d[f+21>>0]|0|0,0,16)|0;L=K|D;K=d[f+22>>0]|0;H=Db(K|0,0,24)|0;G=Cb(J|I|F|H|0,L|D|0,1)|0;L=x+48|0;c[L>>2]=G&67108863;c[L+4>>2]=0;L=Db(d[f+23>>0]|0|0,0,8)|0;G=D;H=Db(d[f+24>>0]|0|0,0,16)|0;F=G|D;G=d[f+25>>0]|0;I=Db(G|0,0,24)|0;J=Cb(L|K|H|I|0,F|D|0,3)|0;F=x+56|0;c[F>>2]=J&33554431;c[F+4>>2]=0;F=Db(d[f+26>>0]|0|0,0,8)|0;J=D;I=Db(d[f+27>>0]|0|0,0,16)|0;H=J|D;J=d[f+28>>0]|0;K=Db(J|0,0,24)|0;L=Cb(F|G|I|K|0,H|D|0,4)|0;H=x+64|0;c[H>>2]=L&67108863;c[H+4>>2]=0;H=Db(d[f+29>>0]|0|0,0,8)|0;L=D;K=Db(d[f+30>>0]|0|0,0,16)|0;I=L|D;L=Db(d[f+31>>0]|0|0,0,24)|0;f=Cb(H|J|K|L|0,I|D|0,6)|0;I=x+72|0;c[I>>2]=f&33554431;c[I+4>>2]=0;Bb(p|0,0,152)|0;Bb(q|0,0,152)|0;I=q;c[I>>2]=1;c[I+4>>2]=0;Bb(r|0,0,152)|0;I=r;c[I>>2]=1;c[I+4>>2]=0;Bb(s|0,0,152)|0;Bb(t|0,0,152)|0;Bb(u|0,0,152)|0;I=u;c[I>>2]=1;c[I+4>>2]=0;Bb(v|0,0,152)|0;Bb(w|0,0,152)|0;I=w;c[I>>2]=1;c[I+4>>2]=0;C=p+0|0;E=x+0|0;e=C+80|0;do{c[C>>2]=c[E>>2];C=C+4|0;E=E+4|0}while((C|0)<(e|0));I=l+144|0;f=l+64|0;L=l+136|0;K=l+56|0;J=l+128|0;H=l+48|0;G=l+120|0;F=l+40|0;M=l+112|0;N=l+32|0;O=l+104|0;P=l+24|0;Q=l+96|0;R=l+16|0;S=l+88|0;T=l+8|0;U=l+80|0;V=l+72|0;W=m+144|0;X=m+64|0;Y=m+136|0;Z=m+56|0;_=m+128|0;aa=m+48|0;ba=m+120|0;ca=m+40|0;da=m+112|0;ea=m+32|0;fa=m+104|0;ga=m+24|0;ha=m+96|0;ia=m+16|0;ja=m+88|0;ka=m+8|0;la=m+80|0;ma=m+72|0;na=j+8|0;oa=k+8|0;pa=j+16|0;qa=k+16|0;ra=j+24|0;sa=k+24|0;ta=j+32|0;ua=k+32|0;va=j+40|0;wa=k+40|0;xa=j+48|0;ya=k+48|0;za=j+56|0;Aa=k+56|0;Ba=j+64|0;Fa=k+64|0;Ga=j+72|0;Ha=k+72|0;Ia=h+80|0;Ja=h+8|0;Ka=h+16|0;La=h+24|0;Ma=h+32|0;Na=h+40|0;Oa=h+48|0;Pa=h+56|0;Qa=h+64|0;Ra=h+72|0;Sa=0;Ta=p;Ua=t;t=q;Va=u;u=r;Wa=v;v=s;s=w;while(1){w=a[B+(31-Sa)>>0]|0;Xa=0;Ya=Ta;Za=Ua;_a=t;$a=Va;ab=u;bb=Wa;cb=v;db=s;while(1){eb=w&255;fb=zb(0,0,eb>>>7|0,0)|0;gb=D;hb=0;do{ib=ab+(hb<<3)|0;jb=ib;kb=c[jb>>2]|0;lb=c[jb+4>>2]|0;jb=Ya+(hb<<3)|0;mb=jb;nb=c[mb>>2]|0;ob=c[mb+4>>2]|0;mb=(nb^kb)&fb;pb=(ob^lb)&gb;lb=yb(0,mb^kb|0,32)|0;kb=ib;c[kb>>2]=lb;c[kb+4>>2]=D;kb=yb(0,mb^nb|0,32)|0;nb=jb;c[nb>>2]=kb;c[nb+4>>2]=D;hb=hb+1|0}while((hb|0)!=10);qb=0;do{hb=cb+(qb<<3)|0;nb=hb;kb=c[nb>>2]|0;jb=c[nb+4>>2]|0;nb=_a+(qb<<3)|0;mb=nb;lb=c[mb>>2]|0;ib=c[mb+4>>2]|0;mb=(lb^kb)&fb;ob=(ib^jb)&gb;jb=yb(0,mb^kb|0,32)|0;kb=hb;c[kb>>2]=jb;c[kb+4>>2]=D;kb=yb(0,mb^lb|0,32)|0;lb=nb;c[lb>>2]=kb;c[lb+4>>2]=D;qb=qb+1|0}while((qb|0)!=10);lb=ab;kb=c[lb>>2]|0;nb=c[lb+4>>2]|0;lb=ab+8|0;mb=lb;jb=c[mb>>2]|0;hb=c[mb+4>>2]|0;mb=ab+16|0;ib=mb;ob=c[ib>>2]|0;pb=c[ib+4>>2]|0;ib=ab+24|0;rb=ib;sb=c[rb>>2]|0;tb=c[rb+4>>2]|0;rb=ab+32|0;ub=rb;vb=c[ub>>2]|0;wb=c[ub+4>>2]|0;ub=ab+40|0;xb=ub;Eb=c[xb>>2]|0;Fb=c[xb+4>>2]|0;xb=ab+48|0;Gb=xb;Hb=c[Gb>>2]|0;Ib=c[Gb+4>>2]|0;Gb=ab+56|0;Jb=Gb;Kb=c[Jb>>2]|0;Lb=c[Jb+4>>2]|0;Jb=ab+64|0;Nb=Jb;Ob=c[Nb>>2]|0;Pb=c[Nb+4>>2]|0;Nb=ab+72|0;Qb=Nb;Rb=c[Qb>>2]|0;Sb=c[Qb+4>>2]|0;Qb=cb;Tb=c[Qb>>2]|0;Ub=c[Qb+4>>2]|0;Qb=Ab(Tb|0,Ub|0,kb|0,nb|0)|0;Vb=ab;c[Vb>>2]=Qb;c[Vb+4>>2]=D;Vb=cb+8|0;Qb=Vb;Wb=c[Qb>>2]|0;Xb=c[Qb+4>>2]|0;Qb=Ab(Wb|0,Xb|0,jb|0,hb|0)|0;Yb=lb;c[Yb>>2]=Qb;c[Yb+4>>2]=D;Yb=cb+16|0;Qb=Yb;lb=c[Qb>>2]|0;Zb=c[Qb+4>>2]|0;Qb=Ab(lb|0,Zb|0,ob|0,pb|0)|0;_b=mb;c[_b>>2]=Qb;c[_b+4>>2]=D;_b=cb+24|0;Qb=_b;mb=c[Qb>>2]|0;$b=c[Qb+4>>2]|0;Qb=Ab(mb|0,$b|0,sb|0,tb|0)|0;ac=ib;c[ac>>2]=Qb;c[ac+4>>2]=D;ac=cb+32|0;Qb=ac;ib=c[Qb>>2]|0;bc=c[Qb+4>>2]|0;Qb=Ab(ib|0,bc|0,vb|0,wb|0)|0;cc=rb;c[cc>>2]=Qb;c[cc+4>>2]=D;cc=cb+40|0;Qb=cc;rb=c[Qb>>2]|0;dc=c[Qb+4>>2]|0;Qb=Ab(rb|0,dc|0,Eb|0,Fb|0)|0;ec=ub;c[ec>>2]=Qb;c[ec+4>>2]=D;ec=cb+48|0;Qb=ec;ub=c[Qb>>2]|0;fc=c[Qb+4>>2]|0;Qb=Ab(ub|0,fc|0,Hb|0,Ib|0)|0;gc=xb;c[gc>>2]=Qb;c[gc+4>>2]=D;gc=cb+56|0;Qb=gc;xb=c[Qb>>2]|0;hc=c[Qb+4>>2]|0;Qb=Ab(xb|0,hc|0,Kb|0,Lb|0)|0;ic=Gb;c[ic>>2]=Qb;c[ic+4>>2]=D;ic=cb+64|0;Qb=ic;Gb=c[Qb>>2]|0;jc=c[Qb+4>>2]|0;Qb=Ab(Gb|0,jc|0,Ob|0,Pb|0)|0;kc=Jb;c[kc>>2]=Qb;c[kc+4>>2]=D;kc=cb+72|0;Qb=kc;Jb=c[Qb>>2]|0;lc=c[Qb+4>>2]|0;Qb=Ab(Jb|0,lc|0,Rb|0,Sb|0)|0;mc=Nb;c[mc>>2]=Qb;c[mc+4>>2]=D;mc=zb(kb|0,nb|0,Tb|0,Ub|0)|0;Ub=cb;c[Ub>>2]=mc;c[Ub+4>>2]=D;Ub=zb(jb|0,hb|0,Wb|0,Xb|0)|0;Xb=Vb;c[Xb>>2]=Ub;c[Xb+4>>2]=D;Xb=zb(ob|0,pb|0,lb|0,Zb|0)|0;Zb=Yb;c[Zb>>2]=Xb;c[Zb+4>>2]=D;Zb=zb(sb|0,tb|0,mb|0,$b|0)|0;$b=_b;c[$b>>2]=Zb;c[$b+4>>2]=D;$b=zb(vb|0,wb|0,ib|0,bc|0)|0;bc=ac;c[bc>>2]=$b;c[bc+4>>2]=D;bc=zb(Eb|0,Fb|0,rb|0,dc|0)|0;dc=cc;c[dc>>2]=bc;c[dc+4>>2]=D;dc=zb(Hb|0,Ib|0,ub|0,fc|0)|0;fc=ec;c[fc>>2]=dc;c[fc+4>>2]=D;fc=zb(Kb|0,Lb|0,xb|0,hc|0)|0;hc=gc;c[hc>>2]=fc;c[hc+4>>2]=D;hc=zb(Ob|0,Pb|0,Gb|0,jc|0)|0;jc=ic;c[jc>>2]=hc;c[jc+4>>2]=D;jc=zb(Rb|0,Sb|0,Jb|0,lc|0)|0;lc=kc;c[lc>>2]=jc;c[lc+4>>2]=D;lc=Ya;jc=c[lc>>2]|0;kc=c[lc+4>>2]|0;lc=Ya+8|0;Jb=lc;Sb=c[Jb>>2]|0;Rb=c[Jb+4>>2]|0;Jb=Ya+16|0;hc=Jb;ic=c[hc>>2]|0;Gb=c[hc+4>>2]|0;hc=Ya+24|0;Pb=hc;Ob=c[Pb>>2]|0;fc=c[Pb+4>>2]|0;Pb=Ya+32|0;gc=Pb;xb=c[gc>>2]|0;Lb=c[gc+4>>2]|0;gc=Ya+40|0;Kb=gc;dc=c[Kb>>2]|0;ec=c[Kb+4>>2]|0;Kb=Ya+48|0;ub=Kb;Ib=c[ub>>2]|0;Hb=c[ub+4>>2]|0;ub=Ya+56|0;bc=ub;cc=c[bc>>2]|0;rb=c[bc+4>>2]|0;bc=Ya+64|0;Fb=bc;Eb=c[Fb>>2]|0;$b=c[Fb+4>>2]|0;Fb=Ya+72|0;ac=Fb;ib=c[ac>>2]|0;wb=c[ac+4>>2]|0;ac=_a;vb=c[ac>>2]|0;Zb=c[ac+4>>2]|0;ac=Ab(vb|0,Zb|0,jc|0,kc|0)|0;_b=Ya;c[_b>>2]=ac;c[_b+4>>2]=D;_b=_a+8|0;ac=_b;mb=c[ac>>2]|0;tb=c[ac+4>>2]|0;ac=Ab(mb|0,tb|0,Sb|0,Rb|0)|0;sb=lc;c[sb>>2]=ac;c[sb+4>>2]=D;sb=_a+16|0;ac=sb;lc=c[ac>>2]|0;Xb=c[ac+4>>2]|0;ac=Ab(lc|0,Xb|0,ic|0,Gb|0)|0;Yb=Jb;c[Yb>>2]=ac;c[Yb+4>>2]=D;Yb=_a+24|0;ac=Yb;Jb=c[ac>>2]|0;lb=c[ac+4>>2]|0;ac=Ab(Jb|0,lb|0,Ob|0,fc|0)|0;pb=hc;c[pb>>2]=ac;c[pb+4>>2]=D;pb=_a+32|0;ac=pb;hc=c[ac>>2]|0;ob=c[ac+4>>2]|0;ac=Ab(hc|0,ob|0,xb|0,Lb|0)|0;Ub=Pb;c[Ub>>2]=ac;c[Ub+4>>2]=D;Ub=_a+40|0;ac=Ub;Pb=c[ac>>2]|0;Vb=c[ac+4>>2]|0;ac=Ab(Pb|0,Vb|0,dc|0,ec|0)|0;Wb=gc;c[Wb>>2]=ac;c[Wb+4>>2]=D;Wb=_a+48|0;ac=Wb;gc=c[ac>>2]|0;hb=c[ac+4>>2]|0;ac=Ab(gc|0,hb|0,Ib|0,Hb|0)|0;jb=Kb;c[jb>>2]=ac;c[jb+4>>2]=D;jb=_a+56|0;ac=jb;Kb=c[ac>>2]|0;mc=c[ac+4>>2]|0;ac=Ab(Kb|0,mc|0,cc|0,rb|0)|0;Tb=ub;c[Tb>>2]=ac;c[Tb+4>>2]=D;Tb=_a+64|0;ac=Tb;ub=c[ac>>2]|0;nb=c[ac+4>>2]|0;ac=Ab(ub|0,nb|0,Eb|0,$b|0)|0;kb=bc;c[kb>>2]=ac;c[kb+4>>2]=D;kb=_a+72|0;ac=kb;bc=c[ac>>2]|0;Qb=c[ac+4>>2]|0;ac=Ab(bc|0,Qb|0,ib|0,wb|0)|0;Nb=Fb;c[Nb>>2]=ac;c[Nb+4>>2]=D;Nb=zb(jc|0,kc|0,vb|0,Zb|0)|0;Zb=_a;c[Zb>>2]=Nb;c[Zb+4>>2]=D;Zb=zb(Sb|0,Rb|0,mb|0,tb|0)|0;tb=_b;c[tb>>2]=Zb;c[tb+4>>2]=D;tb=zb(ic|0,Gb|0,lc|0,Xb|0)|0;Xb=sb;c[Xb>>2]=tb;c[Xb+4>>2]=D;Xb=zb(Ob|0,fc|0,Jb|0,lb|0)|0;lb=Yb;c[lb>>2]=Xb;c[lb+4>>2]=D;lb=zb(xb|0,Lb|0,hc|0,ob|0)|0;ob=pb;c[ob>>2]=lb;c[ob+4>>2]=D;ob=zb(dc|0,ec|0,Pb|0,Vb|0)|0;Vb=Ub;c[Vb>>2]=ob;c[Vb+4>>2]=D;Vb=zb(Ib|0,Hb|0,gc|0,hb|0)|0;hb=Wb;c[hb>>2]=Vb;c[hb+4>>2]=D;hb=zb(cc|0,rb|0,Kb|0,mc|0)|0;mc=jb;c[mc>>2]=hb;c[mc+4>>2]=D;mc=zb(Eb|0,$b|0,ub|0,nb|0)|0;nb=Tb;c[nb>>2]=mc;c[nb+4>>2]=D;nb=zb(ib|0,wb|0,bc|0,Qb|0)|0;Qb=kb;c[Qb>>2]=nb;c[Qb+4>>2]=D;Ca(l,Ya,cb);Ca(m,ab,_a);Qb=I;nb=c[Qb>>2]|0;kb=c[Qb+4>>2]|0;Qb=f;bc=c[Qb>>2]|0;wb=c[Qb+4>>2]|0;Qb=Mb(nb|0,kb|0,18,0)|0;ib=D;mc=Ab(bc|0,wb|0,nb|0,kb|0)|0;kb=Ab(mc|0,D|0,Qb|0,ib|0)|0;ib=f;c[ib>>2]=kb;c[ib+4>>2]=D;ib=L;kb=c[ib>>2]|0;Qb=c[ib+4>>2]|0;ib=K;mc=c[ib>>2]|0;nb=c[ib+4>>2]|0;ib=Mb(kb|0,Qb|0,18,0)|0;wb=D;bc=Ab(mc|0,nb|0,kb|0,Qb|0)|0;Qb=Ab(bc|0,D|0,ib|0,wb|0)|0;wb=K;c[wb>>2]=Qb;c[wb+4>>2]=D;wb=J;Qb=c[wb>>2]|0;ib=c[wb+4>>2]|0;wb=H;bc=c[wb>>2]|0;kb=c[wb+4>>2]|0;wb=Mb(Qb|0,ib|0,18,0)|0;nb=D;mc=Ab(bc|0,kb|0,Qb|0,ib|0)|0;ib=Ab(mc|0,D|0,wb|0,nb|0)|0;nb=D;wb=H;c[wb>>2]=ib;c[wb+4>>2]=nb;wb=G;mc=c[wb>>2]|0;Qb=c[wb+4>>2]|0;wb=F;kb=c[wb>>2]|0;bc=c[wb+4>>2]|0;wb=Mb(mc|0,Qb|0,18,0)|0;Tb=D;ub=Ab(kb|0,bc|0,mc|0,Qb|0)|0;Qb=Ab(ub|0,D|0,wb|0,Tb|0)|0;Tb=D;wb=M;ub=c[wb>>2]|0;mc=c[wb+4>>2]|0;wb=N;bc=c[wb>>2]|0;kb=c[wb+4>>2]|0;wb=Mb(ub|0,mc|0,18,0)|0;$b=D;Eb=Ab(bc|0,kb|0,ub|0,mc|0)|0;mc=Ab(Eb|0,D|0,wb|0,$b|0)|0;$b=D;wb=O;Eb=c[wb>>2]|0;ub=c[wb+4>>2]|0;wb=P;kb=c[wb>>2]|0;bc=c[wb+4>>2]|0;wb=Mb(Eb|0,ub|0,18,0)|0;hb=D;jb=Ab(kb|0,bc|0,Eb|0,ub|0)|0;ub=Ab(jb|0,D|0,wb|0,hb|0)|0;hb=D;wb=Q;jb=c[wb>>2]|0;Eb=c[wb+4>>2]|0;wb=R;bc=c[wb>>2]|0;kb=c[wb+4>>2]|0;wb=Mb(jb|0,Eb|0,18,0)|0;Kb=D;rb=Ab(bc|0,kb|0,jb|0,Eb|0)|0;Eb=Ab(rb|0,D|0,wb|0,Kb|0)|0;Kb=D;wb=S;rb=c[wb>>2]|0;jb=c[wb+4>>2]|0;wb=T;kb=c[wb>>2]|0;bc=c[wb+4>>2]|0;wb=Mb(rb|0,jb|0,18,0)|0;cc=D;Vb=Ab(kb|0,bc|0,rb|0,jb|0)|0;jb=Ab(Vb|0,D|0,wb|0,cc|0)|0;cc=D;wb=U;Vb=c[wb>>2]|0;rb=c[wb+4>>2]|0;wb=l;bc=c[wb>>2]|0;kb=c[wb+4>>2]|0;wb=Mb(Vb|0,rb|0,18,0)|0;Wb=D;gc=Ab(bc|0,kb|0,Vb|0,rb|0)|0;rb=Ab(gc|0,D|0,wb|0,Wb|0)|0;Wb=D;wb=U;c[wb>>2]=0;c[wb+4>>2]=0;wb=Ab(Wb>>31>>>6|0,0,rb|0,Wb|0)|0;gc=yb(wb|0,D|0,26)|0;wb=D;Vb=Db(gc|0,wb|0,26)|0;kb=zb(rb|0,Wb|0,Vb|0,D|0)|0;Vb=l;c[Vb>>2]=kb;c[Vb+4>>2]=D;Vb=Ab(jb|0,cc|0,gc|0,wb|0)|0;wb=D;gc=Ab(wb>>31>>>7|0,0,Vb|0,wb|0)|0;cc=yb(gc|0,D|0,25)|0;gc=D;jb=Db(cc|0,gc|0,25)|0;kb=zb(Vb|0,wb|0,jb|0,D|0)|0;jb=T;c[jb>>2]=kb;c[jb+4>>2]=D;jb=Ab(Eb|0,Kb|0,cc|0,gc|0)|0;gc=D;cc=Ab(gc>>31>>>6|0,0,jb|0,gc|0)|0;Kb=yb(cc|0,D|0,26)|0;cc=D;Eb=Db(Kb|0,cc|0,26)|0;kb=zb(jb|0,gc|0,Eb|0,D|0)|0;Eb=R;c[Eb>>2]=kb;c[Eb+4>>2]=D;Eb=Ab(ub|0,hb|0,Kb|0,cc|0)|0;cc=D;Kb=Ab(cc>>31>>>7|0,0,Eb|0,cc|0)|0;hb=yb(Kb|0,D|0,25)|0;Kb=D;ub=Db(hb|0,Kb|0,25)|0;kb=zb(Eb|0,cc|0,ub|0,D|0)|0;ub=P;c[ub>>2]=kb;c[ub+4>>2]=D;ub=Ab(mc|0,$b|0,hb|0,Kb|0)|0;Kb=D;hb=Ab(Kb>>31>>>6|0,0,ub|0,Kb|0)|0;$b=yb(hb|0,D|0,26)|0;hb=D;mc=Db($b|0,hb|0,26)|0;kb=zb(ub|0,Kb|0,mc|0,D|0)|0;mc=N;c[mc>>2]=kb;c[mc+4>>2]=D;mc=Ab(Qb|0,Tb|0,$b|0,hb|0)|0;hb=D;$b=Ab(hb>>31>>>7|0,0,mc|0,hb|0)|0;Tb=yb($b|0,D|0,25)|0;$b=D;Qb=Db(Tb|0,$b|0,25)|0;kb=zb(mc|0,hb|0,Qb|0,D|0)|0;Qb=F;c[Qb>>2]=kb;c[Qb+4>>2]=D;Qb=Ab(Tb|0,$b|0,ib|0,nb|0)|0;nb=D;ib=Ab(nb>>31>>>6|0,0,Qb|0,nb|0)|0;$b=yb(ib|0,D|0,26)|0;ib=D;Tb=Db($b|0,ib|0,26)|0;kb=zb(Qb|0,nb|0,Tb|0,D|0)|0;Tb=H;c[Tb>>2]=kb;c[Tb+4>>2]=D;Tb=K;kb=Ab($b|0,ib|0,c[Tb>>2]|0,c[Tb+4>>2]|0)|0;Tb=D;ib=Ab(Tb>>31>>>7|0,0,kb|0,Tb|0)|0;$b=yb(ib|0,D|0,25)|0;ib=D;nb=Db($b|0,ib|0,25)|0;Qb=zb(kb|0,Tb|0,nb|0,D|0)|0;nb=K;c[nb>>2]=Qb;c[nb+4>>2]=D;nb=f;Qb=Ab($b|0,ib|0,c[nb>>2]|0,c[nb+4>>2]|0)|0;nb=D;ib=Ab(nb>>31>>>6|0,0,Qb|0,nb|0)|0;$b=yb(ib|0,D|0,26)|0;ib=D;Tb=Db($b|0,ib|0,26)|0;kb=zb(Qb|0,nb|0,Tb|0,D|0)|0;Tb=f;c[Tb>>2]=kb;c[Tb+4>>2]=D;Tb=V;kb=Ab($b|0,ib|0,c[Tb>>2]|0,c[Tb+4>>2]|0)|0;Tb=D;ib=Ab(Tb>>31>>>7|0,0,kb|0,Tb|0)|0;$b=yb(ib|0,D|0,25)|0;ib=D;nb=Db($b|0,ib|0,25)|0;Qb=zb(kb|0,Tb|0,nb|0,D|0)|0;nb=V;c[nb>>2]=Qb;c[nb+4>>2]=D;nb=U;Qb=Ab($b|0,ib|0,c[nb>>2]|0,c[nb+4>>2]|0)|0;nb=D;ib=l;$b=c[ib>>2]|0;Tb=c[ib+4>>2]|0;ib=Mb(Qb|0,nb|0,18,0)|0;kb=D;hb=Ab(Qb|0,nb|0,$b|0,Tb|0)|0;Tb=Ab(hb|0,D|0,ib|0,kb|0)|0;kb=D;ib=U;c[ib>>2]=0;c[ib+4>>2]=0;ib=Ab(kb>>31>>>6|0,0,Tb|0,kb|0)|0;hb=yb(ib|0,D|0,26)|0;ib=D;$b=Db(hb|0,ib|0,26)|0;nb=zb(Tb|0,kb|0,$b|0,D|0)|0;$b=l;c[$b>>2]=nb;c[$b+4>>2]=D;$b=T;nb=Ab(hb|0,ib|0,c[$b>>2]|0,c[$b+4>>2]|0)|0;$b=T;c[$b>>2]=nb;c[$b+4>>2]=D;$b=W;nb=c[$b>>2]|0;ib=c[$b+4>>2]|0;$b=X;hb=c[$b>>2]|0;kb=c[$b+4>>2]|0;$b=Mb(nb|0,ib|0,18,0)|0;Tb=D;Qb=Ab(hb|0,kb|0,nb|0,ib|0)|0;ib=Ab(Qb|0,D|0,$b|0,Tb|0)|0;Tb=X;c[Tb>>2]=ib;c[Tb+4>>2]=D;Tb=Y;ib=c[Tb>>2]|0;$b=c[Tb+4>>2]|0;Tb=Z;Qb=c[Tb>>2]|0;nb=c[Tb+4>>2]|0;Tb=Mb(ib|0,$b|0,18,0)|0;kb=D;hb=Ab(Qb|0,nb|0,ib|0,$b|0)|0;$b=Ab(hb|0,D|0,Tb|0,kb|0)|0;kb=Z;c[kb>>2]=$b;c[kb+4>>2]=D;kb=_;$b=c[kb>>2]|0;Tb=c[kb+4>>2]|0;kb=aa;hb=c[kb>>2]|0;ib=c[kb+4>>2]|0;kb=Mb($b|0,Tb|0,18,0)|0;nb=D;Qb=Ab(hb|0,ib|0,$b|0,Tb|0)|0;Tb=Ab(Qb|0,D|0,kb|0,nb|0)|0;nb=D;kb=aa;c[kb>>2]=Tb;c[kb+4>>2]=nb;kb=ba;Qb=c[kb>>2]|0;$b=c[kb+4>>2]|0;kb=ca;ib=c[kb>>2]|0;hb=c[kb+4>>2]|0;kb=Mb(Qb|0,$b|0,18,0)|0;mc=D;Kb=Ab(ib|0,hb|0,Qb|0,$b|0)|0;$b=Ab(Kb|0,D|0,kb|0,mc|0)|0;mc=D;kb=da;Kb=c[kb>>2]|0;Qb=c[kb+4>>2]|0;kb=ea;hb=c[kb>>2]|0;ib=c[kb+4>>2]|0;kb=Mb(Kb|0,Qb|0,18,0)|0;ub=D;cc=Ab(hb|0,ib|0,Kb|0,Qb|0)|0;Qb=Ab(cc|0,D|0,kb|0,ub|0)|0;ub=D;kb=fa;cc=c[kb>>2]|0;Kb=c[kb+4>>2]|0;kb=ga;ib=c[kb>>2]|0;hb=c[kb+4>>2]|0;kb=Mb(cc|0,Kb|0,18,0)|0;Eb=D;gc=Ab(ib|0,hb|0,cc|0,Kb|0)|0;Kb=Ab(gc|0,D|0,kb|0,Eb|0)|0;Eb=D;kb=ha;gc=c[kb>>2]|0;cc=c[kb+4>>2]|0;kb=ia;hb=c[kb>>2]|0;ib=c[kb+4>>2]|0;kb=Mb(gc|0,cc|0,18,0)|0;jb=D;wb=Ab(hb|0,ib|0,gc|0,cc|0)|0;cc=Ab(wb|0,D|0,kb|0,jb|0)|0;jb=D;kb=ja;wb=c[kb>>2]|0;gc=c[kb+4>>2]|0;kb=ka;ib=c[kb>>2]|0;hb=c[kb+4>>2]|0;kb=Mb(wb|0,gc|0,18,0)|0;Vb=D;Wb=Ab(ib|0,hb|0,wb|0,gc|0)|0;gc=Ab(Wb|0,D|0,kb|0,Vb|0)|0;Vb=D;kb=la;Wb=c[kb>>2]|0;wb=c[kb+4>>2]|0;kb=m;hb=c[kb>>2]|0;ib=c[kb+4>>2]|0;kb=Mb(Wb|0,wb|0,18,0)|0;rb=D;bc=Ab(hb|0,ib|0,Wb|0,wb|0)|0;wb=Ab(bc|0,D|0,kb|0,rb|0)|0;rb=D;kb=la;c[kb>>2]=0;c[kb+4>>2]=0;kb=Ab(rb>>31>>>6|0,0,wb|0,rb|0)|0;bc=yb(kb|0,D|0,26)|0;kb=D;Wb=Db(bc|0,kb|0,26)|0;ib=zb(wb|0,rb|0,Wb|0,D|0)|0;Wb=m;c[Wb>>2]=ib;c[Wb+4>>2]=D;Wb=Ab(gc|0,Vb|0,bc|0,kb|0)|0;kb=D;bc=Ab(kb>>31>>>7|0,0,Wb|0,kb|0)|0;Vb=yb(bc|0,D|0,25)|0;bc=D;gc=Db(Vb|0,bc|0,25)|0;ib=zb(Wb|0,kb|0,gc|0,D|0)|0;gc=ka;c[gc>>2]=ib;c[gc+4>>2]=D;gc=Ab(cc|0,jb|0,Vb|0,bc|0)|0;bc=D;Vb=Ab(bc>>31>>>6|0,0,gc|0,bc|0)|0;jb=yb(Vb|0,D|0,26)|0;Vb=D;cc=Db(jb|0,Vb|0,26)|0;ib=zb(gc|0,bc|0,cc|0,D|0)|0;cc=ia;c[cc>>2]=ib;c[cc+4>>2]=D;cc=Ab(Kb|0,Eb|0,jb|0,Vb|0)|0;Vb=D;jb=Ab(Vb>>31>>>7|0,0,cc|0,Vb|0)|0;Eb=yb(jb|0,D|0,25)|0;jb=D;Kb=Db(Eb|0,jb|0,25)|0;ib=zb(cc|0,Vb|0,Kb|0,D|0)|0;Kb=ga;c[Kb>>2]=ib;c[Kb+4>>2]=D;Kb=Ab(Qb|0,ub|0,Eb|0,jb|0)|0;jb=D;Eb=Ab(jb>>31>>>6|0,0,Kb|0,jb|0)|0;ub=yb(Eb|0,D|0,26)|0;Eb=D;Qb=Db(ub|0,Eb|0,26)|0;ib=zb(Kb|0,jb|0,Qb|0,D|0)|0;Qb=D;jb=ea;c[jb>>2]=ib;c[jb+4>>2]=Qb;jb=Ab($b|0,mc|0,ub|0,Eb|0)|0;Eb=D;ub=Ab(Eb>>31>>>7|0,0,jb|0,Eb|0)|0;mc=yb(ub|0,D|0,25)|0;ub=D;$b=Db(mc|0,ub|0,25)|0;Kb=zb(jb|0,Eb|0,$b|0,D|0)|0;$b=D;Eb=ca;c[Eb>>2]=Kb;c[Eb+4>>2]=$b;Eb=Ab(mc|0,ub|0,Tb|0,nb|0)|0;nb=D;Tb=Ab(nb>>31>>>6|0,0,Eb|0,nb|0)|0;ub=yb(Tb|0,D|0,26)|0;Tb=D;mc=Db(ub|0,Tb|0,26)|0;jb=zb(Eb|0,nb|0,mc|0,D|0)|0;mc=D;nb=Z;Eb=Ab(ub|0,Tb|0,c[nb>>2]|0,c[nb+4>>2]|0)|0;nb=D;Tb=Ab(nb>>31>>>7|0,0,Eb|0,nb|0)|0;ub=yb(Tb|0,D|0,25)|0;Tb=D;Vb=Db(ub|0,Tb|0,25)|0;cc=zb(Eb|0,nb|0,Vb|0,D|0)|0;Vb=D;nb=X;Eb=Ab(ub|0,Tb|0,c[nb>>2]|0,c[nb+4>>2]|0)|0;nb=D;Tb=Ab(nb>>31>>>6|0,0,Eb|0,nb|0)|0;ub=yb(Tb|0,D|0,26)|0;Tb=D;bc=Db(ub|0,Tb|0,26)|0;gc=zb(Eb|0,nb|0,bc|0,D|0)|0;bc=D;nb=ma;Eb=Ab(ub|0,Tb|0,c[nb>>2]|0,c[nb+4>>2]|0)|0;nb=D;Tb=Ab(nb>>31>>>7|0,0,Eb|0,nb|0)|0;ub=yb(Tb|0,D|0,25)|0;Tb=D;kb=Db(ub|0,Tb|0,25)|0;Wb=zb(Eb|0,nb|0,kb|0,D|0)|0;kb=D;nb=la;Eb=Ab(ub|0,Tb|0,c[nb>>2]|0,c[nb+4>>2]|0)|0;nb=D;Tb=m;ub=c[Tb>>2]|0;rb=c[Tb+4>>2]|0;Tb=Mb(Eb|0,nb|0,18,0)|0;wb=D;hb=Ab(Eb|0,nb|0,ub|0,rb|0)|0;rb=Ab(hb|0,D|0,Tb|0,wb|0)|0;wb=D;Tb=la;c[Tb>>2]=0;c[Tb+4>>2]=0;Tb=Ab(wb>>31>>>6|0,0,rb|0,wb|0)|0;hb=yb(Tb|0,D|0,26)|0;Tb=D;ub=Db(hb|0,Tb|0,26)|0;nb=zb(rb|0,wb|0,ub|0,D|0)|0;ub=D;wb=ka;rb=Ab(hb|0,Tb|0,c[wb>>2]|0,c[wb+4>>2]|0)|0;wb=D;Tb=l;hb=c[Tb>>2]|0;Eb=c[Tb+4>>2]|0;Tb=T;Hb=c[Tb>>2]|0;Ib=c[Tb+4>>2]|0;Tb=R;ob=c[Tb>>2]|0;Ub=c[Tb+4>>2]|0;Tb=P;Pb=c[Tb>>2]|0;ec=c[Tb+4>>2]|0;Tb=N;dc=c[Tb>>2]|0;lb=c[Tb+4>>2]|0;Tb=F;pb=c[Tb>>2]|0;hc=c[Tb+4>>2]|0;Tb=H;Lb=c[Tb>>2]|0;xb=c[Tb+4>>2]|0;Tb=K;Xb=c[Tb>>2]|0;Yb=c[Tb+4>>2]|0;Tb=f;Jb=c[Tb>>2]|0;fc=c[Tb+4>>2]|0;Tb=V;Ob=c[Tb>>2]|0;tb=c[Tb+4>>2]|0;Tb=Ab(nb|0,ub|0,hb|0,Eb|0)|0;sb=l;c[sb>>2]=Tb;c[sb+4>>2]=D;sb=Ab(rb|0,wb|0,Hb|0,Ib|0)|0;Tb=T;c[Tb>>2]=sb;c[Tb+4>>2]=D;Tb=ia;sb=c[Tb>>2]|0;lc=c[Tb+4>>2]|0;Tb=Ab(sb|0,lc|0,ob|0,Ub|0)|0;Gb=R;c[Gb>>2]=Tb;c[Gb+4>>2]=D;Gb=ga;Tb=c[Gb>>2]|0;ic=c[Gb+4>>2]|0;Gb=Ab(Tb|0,ic|0,Pb|0,ec|0)|0;Zb=P;c[Zb>>2]=Gb;c[Zb+4>>2]=D;Zb=Ab(ib|0,Qb|0,dc|0,lb|0)|0;Gb=N;c[Gb>>2]=Zb;c[Gb+4>>2]=D;Gb=Ab(Kb|0,$b|0,pb|0,hc|0)|0;$b=F;c[$b>>2]=Gb;c[$b+4>>2]=D;$b=Ab(jb|0,mc|0,Lb|0,xb|0)|0;Gb=H;c[Gb>>2]=$b;c[Gb+4>>2]=D;Gb=Ab(cc|0,Vb|0,Xb|0,Yb|0)|0;$b=K;c[$b>>2]=Gb;c[$b+4>>2]=D;$b=Ab(gc|0,bc|0,Jb|0,fc|0)|0;Gb=f;c[Gb>>2]=$b;c[Gb+4>>2]=D;Gb=Ab(Wb|0,kb|0,Ob|0,tb|0)|0;$b=V;c[$b>>2]=Gb;c[$b+4>>2]=D;$b=zb(hb|0,Eb|0,nb|0,ub|0)|0;ub=m;c[ub>>2]=$b;c[ub+4>>2]=D;ub=zb(Hb|0,Ib|0,rb|0,wb|0)|0;wb=ka;c[wb>>2]=ub;c[wb+4>>2]=D;wb=zb(ob|0,Ub|0,sb|0,lc|0)|0;lc=ia;c[lc>>2]=wb;c[lc+4>>2]=D;lc=zb(Pb|0,ec|0,Tb|0,ic|0)|0;ic=ga;c[ic>>2]=lc;c[ic+4>>2]=D;ic=zb(dc|0,lb|0,ib|0,Qb|0)|0;Qb=ea;c[Qb>>2]=ic;c[Qb+4>>2]=D;Qb=ca;ic=zb(pb|0,hc|0,c[Qb>>2]|0,c[Qb+4>>2]|0)|0;Qb=ca;c[Qb>>2]=ic;c[Qb+4>>2]=D;Qb=zb(Lb|0,xb|0,jb|0,mc|0)|0;mc=aa;c[mc>>2]=Qb;c[mc+4>>2]=D;mc=zb(Xb|0,Yb|0,cc|0,Vb|0)|0;Vb=Z;c[Vb>>2]=mc;c[Vb+4>>2]=D;Vb=zb(Jb|0,fc|0,gc|0,bc|0)|0;bc=X;c[bc>>2]=Vb;c[bc+4>>2]=D;bc=zb(Ob|0,tb|0,Wb|0,kb|0)|0;kb=ma;c[kb>>2]=bc;c[kb+4>>2]=D;Da(o,l);Da(n,m);Ca(m,n,x);kb=W;bc=c[kb>>2]|0;Wb=c[kb+4>>2]|0;kb=X;tb=c[kb>>2]|0;Ob=c[kb+4>>2]|0;kb=Mb(bc|0,Wb|0,18,0)|0;Vb=D;gc=Ab(tb|0,Ob|0,bc|0,Wb|0)|0;Wb=Ab(gc|0,D|0,kb|0,Vb|0)|0;Vb=X;c[Vb>>2]=Wb;c[Vb+4>>2]=D;Vb=Y;Wb=c[Vb>>2]|0;kb=c[Vb+4>>2]|0;Vb=Z;gc=c[Vb>>2]|0;bc=c[Vb+4>>2]|0;Vb=Mb(Wb|0,kb|0,18,0)|0;Ob=D;tb=Ab(gc|0,bc|0,Wb|0,kb|0)|0;kb=Ab(tb|0,D|0,Vb|0,Ob|0)|0;Ob=Z;c[Ob>>2]=kb;c[Ob+4>>2]=D;Ob=_;kb=c[Ob>>2]|0;Vb=c[Ob+4>>2]|0;Ob=aa;tb=c[Ob>>2]|0;Wb=c[Ob+4>>2]|0;Ob=Mb(kb|0,Vb|0,18,0)|0;bc=D;gc=Ab(tb|0,Wb|0,kb|0,Vb|0)|0;Vb=Ab(gc|0,D|0,Ob|0,bc|0)|0;bc=D;Ob=aa;c[Ob>>2]=Vb;c[Ob+4>>2]=bc;Ob=ba;gc=c[Ob>>2]|0;kb=c[Ob+4>>2]|0;Ob=ca;Wb=c[Ob>>2]|0;tb=c[Ob+4>>2]|0;Ob=Mb(gc|0,kb|0,18,0)|0;fc=D;Jb=Ab(Wb|0,tb|0,gc|0,kb|0)|0;kb=Ab(Jb|0,D|0,Ob|0,fc|0)|0;fc=D;Ob=da;Jb=c[Ob>>2]|0;gc=c[Ob+4>>2]|0;Ob=ea;tb=c[Ob>>2]|0;Wb=c[Ob+4>>2]|0;Ob=Mb(Jb|0,gc|0,18,0)|0;mc=D;cc=Ab(tb|0,Wb|0,Jb|0,gc|0)|0;gc=Ab(cc|0,D|0,Ob|0,mc|0)|0;mc=D;Ob=fa;cc=c[Ob>>2]|0;Jb=c[Ob+4>>2]|0;Ob=ga;Wb=c[Ob>>2]|0;tb=c[Ob+4>>2]|0;Ob=Mb(cc|0,Jb|0,18,0)|0;Yb=D;Xb=Ab(Wb|0,tb|0,cc|0,Jb|0)|0;Jb=Ab(Xb|0,D|0,Ob|0,Yb|0)|0;Yb=D;Ob=ha;Xb=c[Ob>>2]|0;cc=c[Ob+4>>2]|0;Ob=ia;tb=c[Ob>>2]|0;Wb=c[Ob+4>>2]|0;Ob=Mb(Xb|0,cc|0,18,0)|0;Qb=D;jb=Ab(tb|0,Wb|0,Xb|0,cc|0)|0;cc=Ab(jb|0,D|0,Ob|0,Qb|0)|0;Qb=D;Ob=ja;jb=c[Ob>>2]|0;Xb=c[Ob+4>>2]|0;Ob=ka;Wb=c[Ob>>2]|0;tb=c[Ob+4>>2]|0;Ob=Mb(jb|0,Xb|0,18,0)|0;xb=D;Lb=Ab(Wb|0,tb|0,jb|0,Xb|0)|0;Xb=Ab(Lb|0,D|0,Ob|0,xb|0)|0;xb=D;Ob=la;Lb=c[Ob>>2]|0;jb=c[Ob+4>>2]|0;Ob=m;tb=c[Ob>>2]|0;Wb=c[Ob+4>>2]|0;Ob=Mb(Lb|0,jb|0,18,0)|0;ic=D;hc=Ab(tb|0,Wb|0,Lb|0,jb|0)|0;jb=Ab(hc|0,D|0,Ob|0,ic|0)|0;ic=D;Ob=la;c[Ob>>2]=0;c[Ob+4>>2]=0;Ob=Ab(ic>>31>>>6|0,0,jb|0,ic|0)|0;hc=yb(Ob|0,D|0,26)|0;Ob=D;Lb=Db(hc|0,Ob|0,26)|0;Wb=zb(jb|0,ic|0,Lb|0,D|0)|0;Lb=m;c[Lb>>2]=Wb;c[Lb+4>>2]=D;Lb=Ab(Xb|0,xb|0,hc|0,Ob|0)|0;Ob=D;hc=Ab(Ob>>31>>>7|0,0,Lb|0,Ob|0)|0;xb=yb(hc|0,D|0,25)|0;hc=D;Xb=Db(xb|0,hc|0,25)|0;Wb=zb(Lb|0,Ob|0,Xb|0,D|0)|0;Xb=ka;c[Xb>>2]=Wb;c[Xb+4>>2]=D;Xb=Ab(cc|0,Qb|0,xb|0,hc|0)|0;hc=D;xb=Ab(hc>>31>>>6|0,0,Xb|0,hc|0)|0;Qb=yb(xb|0,D|0,26)|0;xb=D;cc=Db(Qb|0,xb|0,26)|0;Wb=zb(Xb|0,hc|0,cc|0,D|0)|0;cc=ia;c[cc>>2]=Wb;c[cc+4>>2]=D;cc=Ab(Jb|0,Yb|0,Qb|0,xb|0)|0;xb=D;Qb=Ab(xb>>31>>>7|0,0,cc|0,xb|0)|0;Yb=yb(Qb|0,D|0,25)|0;Qb=D;Jb=Db(Yb|0,Qb|0,25)|0;Wb=zb(cc|0,xb|0,Jb|0,D|0)|0;Jb=ga;c[Jb>>2]=Wb;c[Jb+4>>2]=D;Jb=Ab(gc|0,mc|0,Yb|0,Qb|0)|0;Qb=D;Yb=Ab(Qb>>31>>>6|0,0,Jb|0,Qb|0)|0;mc=yb(Yb|0,D|0,26)|0;Yb=D;gc=Db(mc|0,Yb|0,26)|0;Wb=zb(Jb|0,Qb|0,gc|0,D|0)|0;gc=ea;c[gc>>2]=Wb;c[gc+4>>2]=D;gc=Ab(kb|0,fc|0,mc|0,Yb|0)|0;Yb=D;mc=Ab(Yb>>31>>>7|0,0,gc|0,Yb|0)|0;fc=yb(mc|0,D|0,25)|0;mc=D;kb=Db(fc|0,mc|0,25)|0;Wb=zb(gc|0,Yb|0,kb|0,D|0)|0;kb=ca;c[kb>>2]=Wb;c[kb+4>>2]=D;kb=Ab(fc|0,mc|0,Vb|0,bc|0)|0;bc=D;Vb=Ab(bc>>31>>>6|0,0,kb|0,bc|0)|0;mc=yb(Vb|0,D|0,26)|0;Vb=D;fc=Db(mc|0,Vb|0,26)|0;Wb=zb(kb|0,bc|0,fc|0,D|0)|0;fc=aa;c[fc>>2]=Wb;c[fc+4>>2]=D;fc=Z;Wb=Ab(mc|0,Vb|0,c[fc>>2]|0,c[fc+4>>2]|0)|0;fc=D;Vb=Ab(fc>>31>>>7|0,0,Wb|0,fc|0)|0;mc=yb(Vb|0,D|0,25)|0;Vb=D;bc=Db(mc|0,Vb|0,25)|0;kb=zb(Wb|0,fc|0,bc|0,D|0)|0;bc=Z;c[bc>>2]=kb;c[bc+4>>2]=D;bc=X;kb=Ab(mc|0,Vb|0,c[bc>>2]|0,c[bc+4>>2]|0)|0;bc=D;Vb=Ab(bc>>31>>>6|0,0,kb|0,bc|0)|0;mc=yb(Vb|0,D|0,26)|0;Vb=D;fc=Db(mc|0,Vb|0,26)|0;Wb=zb(kb|0,bc|0,fc|0,D|0)|0;fc=X;c[fc>>2]=Wb;c[fc+4>>2]=D;fc=ma;Wb=Ab(mc|0,Vb|0,c[fc>>2]|0,c[fc+4>>2]|0)|0;fc=D;Vb=Ab(fc>>31>>>7|0,0,Wb|0,fc|0)|0;mc=yb(Vb|0,D|0,25)|0;Vb=D;bc=Db(mc|0,Vb|0,25)|0;kb=zb(Wb|0,fc|0,bc|0,D|0)|0;bc=ma;c[bc>>2]=kb;c[bc+4>>2]=D;bc=la;kb=Ab(mc|0,Vb|0,c[bc>>2]|0,c[bc+4>>2]|0)|0;bc=D;Vb=m;mc=c[Vb>>2]|0;fc=c[Vb+4>>2]|0;Vb=Mb(kb|0,bc|0,18,0)|0;Wb=D;Yb=Ab(kb|0,bc|0,mc|0,fc|0)|0;fc=Ab(Yb|0,D|0,Vb|0,Wb|0)|0;Wb=D;Vb=la;c[Vb>>2]=0;c[Vb+4>>2]=0;Vb=Ab(Wb>>31>>>6|0,0,fc|0,Wb|0)|0;Yb=yb(Vb|0,D|0,26)|0;Vb=D;mc=Db(Yb|0,Vb|0,26)|0;bc=zb(fc|0,Wb|0,mc|0,D|0)|0;mc=m;c[mc>>2]=bc;c[mc+4>>2]=D;mc=ka;bc=Ab(Yb|0,Vb|0,c[mc>>2]|0,c[mc+4>>2]|0)|0;mc=ka;c[mc>>2]=bc;c[mc+4>>2]=D;C=Za+0|0;E=o+0|0;e=C+80|0;do{c[C>>2]=c[E>>2];C=C+4|0;E=E+4|0}while((C|0)<(e|0));C=$a+0|0;E=m+0|0;e=C+80|0;do{c[C>>2]=c[E>>2];C=C+4|0;E=E+4|0}while((C|0)<(e|0));Da(j,ab);Da(k,cb);Ca(bb,j,k);mc=bb+144|0;bc=c[mc>>2]|0;Vb=c[mc+4>>2]|0;mc=bb+64|0;Yb=mc;Wb=c[Yb>>2]|0;fc=c[Yb+4>>2]|0;Yb=Mb(bc|0,Vb|0,18,0)|0;kb=D;gc=Ab(Wb|0,fc|0,bc|0,Vb|0)|0;Vb=Ab(gc|0,D|0,Yb|0,kb|0)|0;kb=mc;c[kb>>2]=Vb;c[kb+4>>2]=D;kb=bb+136|0;Vb=c[kb>>2]|0;Yb=c[kb+4>>2]|0;kb=bb+56|0;gc=kb;bc=c[gc>>2]|0;fc=c[gc+4>>2]|0;gc=Mb(Vb|0,Yb|0,18,0)|0;Wb=D;Qb=Ab(bc|0,fc|0,Vb|0,Yb|0)|0;Yb=Ab(Qb|0,D|0,gc|0,Wb|0)|0;Wb=kb;c[Wb>>2]=Yb;c[Wb+4>>2]=D;Wb=bb+128|0;Yb=c[Wb>>2]|0;gc=c[Wb+4>>2]|0;Wb=bb+48|0;Qb=Wb;Vb=c[Qb>>2]|0;fc=c[Qb+4>>2]|0;Qb=Mb(Yb|0,gc|0,18,0)|0;bc=D;Jb=Ab(Vb|0,fc|0,Yb|0,gc|0)|0;gc=Ab(Jb|0,D|0,Qb|0,bc|0)|0;bc=Wb;c[bc>>2]=gc;c[bc+4>>2]=D;bc=bb+120|0;gc=c[bc>>2]|0;Qb=c[bc+4>>2]|0;bc=bb+40|0;Jb=bc;Yb=c[Jb>>2]|0;fc=c[Jb+4>>2]|0;Jb=Mb(gc|0,Qb|0,18,0)|0;Vb=D;xb=Ab(Yb|0,fc|0,gc|0,Qb|0)|0;Qb=Ab(xb|0,D|0,Jb|0,Vb|0)|0;Vb=D;Jb=bc;c[Jb>>2]=Qb;c[Jb+4>>2]=Vb;Jb=bb+112|0;xb=c[Jb>>2]|0;gc=c[Jb+4>>2]|0;Jb=bb+32|0;fc=Jb;Yb=c[fc>>2]|0;cc=c[fc+4>>2]|0;fc=Mb(xb|0,gc|0,18,0)|0;hc=D;Xb=Ab(Yb|0,cc|0,xb|0,gc|0)|0;gc=Ab(Xb|0,D|0,fc|0,hc|0)|0;hc=D;fc=bb+104|0;Xb=c[fc>>2]|0;xb=c[fc+4>>2]|0;fc=bb+24|0;cc=fc;Yb=c[cc>>2]|0;Ob=c[cc+4>>2]|0;cc=Mb(Xb|0,xb|0,18,0)|0;Lb=D;ic=Ab(Yb|0,Ob|0,Xb|0,xb|0)|0;xb=Ab(ic|0,D|0,cc|0,Lb|0)|0;Lb=D;cc=bb+96|0;ic=c[cc>>2]|0;Xb=c[cc+4>>2]|0;cc=bb+16|0;Ob=cc;Yb=c[Ob>>2]|0;jb=c[Ob+4>>2]|0;Ob=Mb(ic|0,Xb|0,18,0)|0;tb=D;pb=Ab(Yb|0,jb|0,ic|0,Xb|0)|0;Xb=Ab(pb|0,D|0,Ob|0,tb|0)|0;tb=D;Ob=bb+88|0;pb=c[Ob>>2]|0;ic=c[Ob+4>>2]|0;Ob=bb+8|0;jb=Ob;Yb=c[jb>>2]|0;ib=c[jb+4>>2]|0;jb=Mb(pb|0,ic|0,18,0)|0;lb=D;dc=Ab(Yb|0,ib|0,pb|0,ic|0)|0;ic=Ab(dc|0,D|0,jb|0,lb|0)|0;lb=D;jb=bb+80|0;dc=jb;pb=c[dc>>2]|0;ib=c[dc+4>>2]|0;dc=bb;Yb=c[dc>>2]|0;lc=c[dc+4>>2]|0;dc=Mb(pb|0,ib|0,18,0)|0;Tb=D;ec=Ab(Yb|0,lc|0,pb|0,ib|0)|0;ib=Ab(ec|0,D|0,dc|0,Tb|0)|0;Tb=D;dc=jb;c[dc>>2]=0;c[dc+4>>2]=0;dc=Ab(Tb>>31>>>6|0,0,ib|0,Tb|0)|0;ec=yb(dc|0,D|0,26)|0;dc=D;pb=Db(ec|0,dc|0,26)|0;lc=zb(ib|0,Tb|0,pb|0,D|0)|0;pb=bb;c[pb>>2]=lc;c[pb+4>>2]=D;pb=Ab(ic|0,lb|0,ec|0,dc|0)|0;dc=D;ec=Ab(dc>>31>>>7|0,0,pb|0,dc|0)|0;lb=yb(ec|0,D|0,25)|0;ec=D;ic=Db(lb|0,ec|0,25)|0;lc=zb(pb|0,dc|0,ic|0,D|0)|0;ic=Ob;c[ic>>2]=lc;c[ic+4>>2]=D;ic=Ab(Xb|0,tb|0,lb|0,ec|0)|0;ec=D;lb=Ab(ec>>31>>>6|0,0,ic|0,ec|0)|0;tb=yb(lb|0,D|0,26)|0;lb=D;Xb=Db(tb|0,lb|0,26)|0;lc=zb(ic|0,ec|0,Xb|0,D|0)|0;Xb=cc;c[Xb>>2]=lc;c[Xb+4>>2]=D;Xb=Ab(xb|0,Lb|0,tb|0,lb|0)|0;lb=D;tb=Ab(lb>>31>>>7|0,0,Xb|0,lb|0)|0;Lb=yb(tb|0,D|0,25)|0;tb=D;xb=Db(Lb|0,tb|0,25)|0;lc=zb(Xb|0,lb|0,xb|0,D|0)|0;xb=fc;c[xb>>2]=lc;c[xb+4>>2]=D;xb=Ab(gc|0,hc|0,Lb|0,tb|0)|0;tb=D;Lb=Ab(tb>>31>>>6|0,0,xb|0,tb|0)|0;hc=yb(Lb|0,D|0,26)|0;Lb=D;gc=Db(hc|0,Lb|0,26)|0;lc=zb(xb|0,tb|0,gc|0,D|0)|0;gc=Jb;c[gc>>2]=lc;c[gc+4>>2]=D;gc=Ab(hc|0,Lb|0,Qb|0,Vb|0)|0;Vb=D;Qb=Ab(Vb>>31>>>7|0,0,gc|0,Vb|0)|0;Lb=yb(Qb|0,D|0,25)|0;Qb=D;hc=Db(Lb|0,Qb|0,25)|0;lc=zb(gc|0,Vb|0,hc|0,D|0)|0;hc=bc;c[hc>>2]=lc;c[hc+4>>2]=D;hc=Wb;lc=Ab(Lb|0,Qb|0,c[hc>>2]|0,c[hc+4>>2]|0)|0;hc=D;Qb=Ab(hc>>31>>>6|0,0,lc|0,hc|0)|0;Lb=yb(Qb|0,D|0,26)|0;Qb=D;bc=Db(Lb|0,Qb|0,26)|0;Vb=zb(lc|0,hc|0,bc|0,D|0)|0;bc=Wb;c[bc>>2]=Vb;c[bc+4>>2]=D;bc=kb;Vb=Ab(Lb|0,Qb|0,c[bc>>2]|0,c[bc+4>>2]|0)|0;bc=D;Qb=Ab(bc>>31>>>7|0,0,Vb|0,bc|0)|0;Lb=yb(Qb|0,D|0,25)|0;Qb=D;Wb=Db(Lb|0,Qb|0,25)|0;hc=zb(Vb|0,bc|0,Wb|0,D|0)|0;Wb=kb;c[Wb>>2]=hc;c[Wb+4>>2]=D;Wb=mc;hc=Ab(Lb|0,Qb|0,c[Wb>>2]|0,c[Wb+4>>2]|0)|0;Wb=D;Qb=Ab(Wb>>31>>>6|0,0,hc|0,Wb|0)|0;Lb=yb(Qb|0,D|0,26)|0;Qb=D;kb=Db(Lb|0,Qb|0,26)|0;bc=zb(hc|0,Wb|0,kb|0,D|0)|0;kb=mc;c[kb>>2]=bc;c[kb+4>>2]=D;kb=bb+72|0;bc=kb;mc=Ab(Lb|0,Qb|0,c[bc>>2]|0,c[bc+4>>2]|0)|0;bc=D;Qb=Ab(bc>>31>>>7|0,0,mc|0,bc|0)|0;Lb=yb(Qb|0,D|0,25)|0;Qb=D;Wb=Db(Lb|0,Qb|0,25)|0;hc=zb(mc|0,bc|0,Wb|0,D|0)|0;Wb=kb;c[Wb>>2]=hc;c[Wb+4>>2]=D;Wb=jb;hc=Ab(Lb|0,Qb|0,c[Wb>>2]|0,c[Wb+4>>2]|0)|0;Wb=D;Qb=bb;Lb=c[Qb>>2]|0;kb=c[Qb+4>>2]|0;Qb=Mb(hc|0,Wb|0,18,0)|0;bc=D;mc=Ab(hc|0,Wb|0,Lb|0,kb|0)|0;kb=Ab(mc|0,D|0,Qb|0,bc|0)|0;bc=D;Qb=jb;c[Qb>>2]=0;c[Qb+4>>2]=0;Qb=Ab(bc>>31>>>6|0,0,kb|0,bc|0)|0;jb=yb(Qb|0,D|0,26)|0;Qb=D;mc=Db(jb|0,Qb|0,26)|0;Lb=zb(kb|0,bc|0,mc|0,D|0)|0;mc=bb;c[mc>>2]=Lb;c[mc+4>>2]=D;mc=Ob;Lb=Ab(jb|0,Qb|0,c[mc>>2]|0,c[mc+4>>2]|0)|0;mc=Ob;c[mc>>2]=Lb;c[mc+4>>2]=D;mc=j;Lb=k;Ob=zb(c[mc>>2]|0,c[mc+4>>2]|0,c[Lb>>2]|0,c[Lb+4>>2]|0)|0;Lb=D;mc=k;c[mc>>2]=Ob;c[mc+4>>2]=Lb;mc=na;Qb=oa;jb=zb(c[mc>>2]|0,c[mc+4>>2]|0,c[Qb>>2]|0,c[Qb+4>>2]|0)|0;Qb=D;mc=oa;c[mc>>2]=jb;c[mc+4>>2]=Qb;mc=pa;bc=qa;kb=zb(c[mc>>2]|0,c[mc+4>>2]|0,c[bc>>2]|0,c[bc+4>>2]|0)|0;bc=D;mc=qa;c[mc>>2]=kb;c[mc+4>>2]=bc;mc=ra;Wb=sa;hc=zb(c[mc>>2]|0,c[mc+4>>2]|0,c[Wb>>2]|0,c[Wb+4>>2]|0)|0;Wb=D;mc=sa;c[mc>>2]=hc;c[mc+4>>2]=Wb;mc=ta;Vb=ua;lc=zb(c[mc>>2]|0,c[mc+4>>2]|0,c[Vb>>2]|0,c[Vb+4>>2]|0)|0;Vb=D;mc=ua;c[mc>>2]=lc;c[mc+4>>2]=Vb;mc=va;gc=wa;Jb=zb(c[mc>>2]|0,c[mc+4>>2]|0,c[gc>>2]|0,c[gc+4>>2]|0)|0;gc=D;mc=wa;c[mc>>2]=Jb;c[mc+4>>2]=gc;mc=xa;tb=ya;xb=zb(c[mc>>2]|0,c[mc+4>>2]|0,c[tb>>2]|0,c[tb+4>>2]|0)|0;tb=D;mc=ya;c[mc>>2]=xb;c[mc+4>>2]=tb;mc=za;fc=Aa;lb=zb(c[mc>>2]|0,c[mc+4>>2]|0,c[fc>>2]|0,c[fc+4>>2]|0)|0;fc=D;mc=Aa;c[mc>>2]=lb;c[mc+4>>2]=fc;mc=Ba;Xb=Fa;cc=zb(c[mc>>2]|0,c[mc+4>>2]|0,c[Xb>>2]|0,c[Xb+4>>2]|0)|0;Xb=D;mc=Fa;c[mc>>2]=cc;c[mc+4>>2]=Xb;mc=Ga;ec=Ha;ic=zb(c[mc>>2]|0,c[mc+4>>2]|0,c[ec>>2]|0,c[ec+4>>2]|0)|0;ec=D;mc=Ha;c[mc>>2]=ic;c[mc+4>>2]=ec;C=Ia+0|0;e=C+72|0;do{c[C>>2]=0;C=C+4|0}while((C|0)<(e|0));mc=Mb(Ob|0,Lb|0,121665,0)|0;dc=D;pb=Mb(jb|0,Qb|0,121665,0)|0;Tb=D;ib=Mb(kb|0,bc|0,121665,0)|0;Yb=D;Pb=Mb(hc|0,Wb|0,121665,0)|0;wb=D;sb=Mb(lc|0,Vb|0,121665,0)|0;Ub=D;ob=Mb(Jb|0,gc|0,121665,0)|0;ub=D;rb=Mb(xb|0,tb|0,121665,0)|0;Ib=D;Hb=Mb(lb|0,fc|0,121665,0)|0;$b=D;nb=Mb(cc|0,Xb|0,121665,0)|0;Eb=D;hb=Mb(ic|0,ec|0,121665,0)|0;Gb=D;Kb=Ra;c[Kb>>2]=hb;c[Kb+4>>2]=Gb;Kb=Ab(dc>>31>>>6|0,0,mc|0,dc|0)|0;Zb=yb(Kb|0,D|0,26)|0;Kb=D;_b=Db(Zb|0,Kb|0,26)|0;mb=zb(mc|0,dc|0,_b|0,D|0)|0;_b=D;dc=Ab(Zb|0,Kb|0,pb|0,Tb|0)|0;Tb=D;pb=Ab(Tb>>31>>>7|0,0,dc|0,Tb|0)|0;Kb=yb(pb|0,D|0,25)|0;pb=D;Zb=Db(Kb|0,pb|0,25)|0;mc=zb(dc|0,Tb|0,Zb|0,D|0)|0;Zb=D;Tb=Ab(Kb|0,pb|0,ib|0,Yb|0)|0;Yb=D;ib=Ab(Yb>>31>>>6|0,0,Tb|0,Yb|0)|0;pb=yb(ib|0,D|0,26)|0;ib=D;Kb=Db(pb|0,ib|0,26)|0;dc=D;Rb=Ab(pb|0,ib|0,Pb|0,wb|0)|0;wb=D;Pb=Ab(wb>>31>>>7|0,0,Rb|0,wb|0)|0;ib=yb(Pb|0,D|0,25)|0;Pb=D;pb=Db(ib|0,Pb|0,25)|0;Sb=D;Nb=Ab(ib|0,Pb|0,sb|0,Ub|0)|0;Ub=D;sb=Ab(Ub>>31>>>6|0,0,Nb|0,Ub|0)|0;Pb=yb(sb|0,D|0,26)|0;sb=D;ib=Db(Pb|0,sb|0,26)|0;vb=D;kc=Ab(Pb|0,sb|0,ob|0,ub|0)|0;ub=D;ob=Ab(ub>>31>>>7|0,0,kc|0,ub|0)|0;sb=yb(ob|0,D|0,25)|0;ob=D;Pb=Db(sb|0,ob|0,25)|0;jc=D;ac=Ab(sb|0,ob|0,rb|0,Ib|0)|0;Ib=D;rb=Ab(Ib>>31>>>6|0,0,ac|0,Ib|0)|0;ob=yb(rb|0,D|0,26)|0;rb=D;sb=Db(ob|0,rb|0,26)|0;Fb=D;nc=Ab(ob|0,rb|0,Hb|0,$b|0)|0;$b=D;Hb=Ab($b>>31>>>7|0,0,nc|0,$b|0)|0;rb=yb(Hb|0,D|0,25)|0;Hb=D;ob=Db(rb|0,Hb|0,25)|0;oc=D;pc=Ab(rb|0,Hb|0,nb|0,Eb|0)|0;Eb=D;nb=Ab(Eb>>31>>>6|0,0,pc|0,Eb|0)|0;Hb=yb(nb|0,D|0,26)|0;nb=D;rb=Db(Hb|0,nb|0,26)|0;qc=D;rc=Ab(Hb|0,nb|0,hb|0,Gb|0)|0;Gb=D;hb=Ab(Gb>>31>>>7|0,0,rc|0,Gb|0)|0;nb=yb(hb|0,D|0,25)|0;hb=D;Hb=Db(nb|0,hb|0,25)|0;sc=D;tc=Mb(nb|0,hb|0,18,0)|0;uc=D;vc=Ab(nb|0,hb|0,mb|0,_b|0)|0;_b=Ab(vc|0,D|0,tc|0,uc|0)|0;uc=D;tc=Ia;c[tc>>2]=0;c[tc+4>>2]=0;tc=Ab(uc>>31>>>6|0,0,_b|0,uc|0)|0;vc=yb(tc|0,D|0,26)|0;tc=D;mb=Db(vc|0,tc|0,26)|0;hb=D;nb=j;wc=Ab(_b|0,uc|0,c[nb>>2]|0,c[nb+4>>2]|0)|0;nb=zb(wc|0,D|0,mb|0,hb|0)|0;hb=h;c[hb>>2]=nb;c[hb+4>>2]=D;hb=na;nb=Ab(mc|0,Zb|0,c[hb>>2]|0,c[hb+4>>2]|0)|0;hb=Ab(nb|0,D|0,vc|0,tc|0)|0;tc=Ja;c[tc>>2]=hb;c[tc+4>>2]=D;tc=pa;hb=Ab(c[tc>>2]|0,c[tc+4>>2]|0,Tb|0,Yb|0)|0;Yb=zb(hb|0,D|0,Kb|0,dc|0)|0;dc=Ka;c[dc>>2]=Yb;c[dc+4>>2]=D;dc=ra;Yb=Ab(Rb|0,wb|0,c[dc>>2]|0,c[dc+4>>2]|0)|0;dc=zb(Yb|0,D|0,pb|0,Sb|0)|0;Sb=La;c[Sb>>2]=dc;c[Sb+4>>2]=D;Sb=ta;dc=Ab(Nb|0,Ub|0,c[Sb>>2]|0,c[Sb+4>>2]|0)|0;Sb=zb(dc|0,D|0,ib|0,vb|0)|0;vb=Ma;c[vb>>2]=Sb;c[vb+4>>2]=D;vb=va;Sb=Ab(kc|0,ub|0,c[vb>>2]|0,c[vb+4>>2]|0)|0;vb=zb(Sb|0,D|0,Pb|0,jc|0)|0;jc=Na;c[jc>>2]=vb;c[jc+4>>2]=D;jc=xa;vb=Ab(ac|0,Ib|0,c[jc>>2]|0,c[jc+4>>2]|0)|0;jc=zb(vb|0,D|0,sb|0,Fb|0)|0;Fb=Oa;c[Fb>>2]=jc;c[Fb+4>>2]=D;Fb=za;jc=Ab(nc|0,$b|0,c[Fb>>2]|0,c[Fb+4>>2]|0)|0;Fb=zb(jc|0,D|0,ob|0,oc|0)|0;oc=Pa;c[oc>>2]=Fb;c[oc+4>>2]=D;oc=Ba;Fb=Ab(pc|0,Eb|0,c[oc>>2]|0,c[oc+4>>2]|0)|0;oc=zb(Fb|0,D|0,rb|0,qc|0)|0;qc=Qa;c[qc>>2]=oc;c[qc+4>>2]=D;qc=Ga;oc=Ab(rc|0,Gb|0,c[qc>>2]|0,c[qc+4>>2]|0)|0;qc=zb(oc|0,D|0,Hb|0,sc|0)|0;sc=Ra;c[sc>>2]=qc;c[sc+4>>2]=D;Ca(db,k,h);sc=db+144|0;qc=c[sc>>2]|0;Hb=c[sc+4>>2]|0;sc=db+64|0;oc=sc;Gb=c[oc>>2]|0;rc=c[oc+4>>2]|0;oc=Mb(qc|0,Hb|0,18,0)|0;rb=D;Fb=Ab(Gb|0,rc|0,qc|0,Hb|0)|0;Hb=Ab(Fb|0,D|0,oc|0,rb|0)|0;rb=sc;c[rb>>2]=Hb;c[rb+4>>2]=D;rb=db+136|0;Hb=c[rb>>2]|0;oc=c[rb+4>>2]|0;rb=db+56|0;Fb=rb;qc=c[Fb>>2]|0;rc=c[Fb+4>>2]|0;Fb=Mb(Hb|0,oc|0,18,0)|0;Gb=D;Eb=Ab(qc|0,rc|0,Hb|0,oc|0)|0;oc=Ab(Eb|0,D|0,Fb|0,Gb|0)|0;Gb=rb;c[Gb>>2]=oc;c[Gb+4>>2]=D;Gb=db+128|0;oc=c[Gb>>2]|0;Fb=c[Gb+4>>2]|0;Gb=db+48|0;Eb=Gb;Hb=c[Eb>>2]|0;rc=c[Eb+4>>2]|0;Eb=Mb(oc|0,Fb|0,18,0)|0;qc=D;pc=Ab(Hb|0,rc|0,oc|0,Fb|0)|0;Fb=Ab(pc|0,D|0,Eb|0,qc|0)|0;qc=Gb;c[qc>>2]=Fb;c[qc+4>>2]=D;qc=db+120|0;Fb=c[qc>>2]|0;Eb=c[qc+4>>2]|0;qc=db+40|0;pc=qc;oc=c[pc>>2]|0;rc=c[pc+4>>2]|0;pc=Mb(Fb|0,Eb|0,18,0)|0;Hb=D;ob=Ab(oc|0,rc|0,Fb|0,Eb|0)|0;Eb=Ab(ob|0,D|0,pc|0,Hb|0)|0;Hb=D;pc=qc;c[pc>>2]=Eb;c[pc+4>>2]=Hb;pc=db+112|0;ob=c[pc>>2]|0;Fb=c[pc+4>>2]|0;pc=db+32|0;rc=pc;oc=c[rc>>2]|0;jc=c[rc+4>>2]|0;rc=Mb(ob|0,Fb|0,18,0)|0;$b=D;nc=Ab(oc|0,jc|0,ob|0,Fb|0)|0;Fb=Ab(nc|0,D|0,rc|0,$b|0)|0;$b=D;rc=db+104|0;nc=c[rc>>2]|0;ob=c[rc+4>>2]|0;rc=db+24|0;jc=rc;oc=c[jc>>2]|0;sb=c[jc+4>>2]|0;jc=Mb(nc|0,ob|0,18,0)|0;vb=D;Ib=Ab(oc|0,sb|0,nc|0,ob|0)|0;ob=Ab(Ib|0,D|0,jc|0,vb|0)|0;vb=D;jc=db+96|0;Ib=c[jc>>2]|0;nc=c[jc+4>>2]|0;jc=db+16|0;sb=jc;oc=c[sb>>2]|0;ac=c[sb+4>>2]|0;sb=Mb(Ib|0,nc|0,18,0)|0;Pb=D;Sb=Ab(oc|0,ac|0,Ib|0,nc|0)|0;nc=Ab(Sb|0,D|0,sb|0,Pb|0)|0;Pb=D;sb=db+88|0;Sb=c[sb>>2]|0;Ib=c[sb+4>>2]|0;sb=db+8|0;ac=sb;oc=c[ac>>2]|0;ub=c[ac+4>>2]|0;ac=Mb(Sb|0,Ib|0,18,0)|0;kc=D;ib=Ab(oc|0,ub|0,Sb|0,Ib|0)|0;Ib=Ab(ib|0,D|0,ac|0,kc|0)|0;kc=D;ac=db+80|0;ib=ac;Sb=c[ib>>2]|0;ub=c[ib+4>>2]|0;ib=db;oc=c[ib>>2]|0;dc=c[ib+4>>2]|0;ib=Mb(Sb|0,ub|0,18,0)|0;Ub=D;Nb=Ab(oc|0,dc|0,Sb|0,ub|0)|0;ub=Ab(Nb|0,D|0,ib|0,Ub|0)|0;Ub=D;ib=ac;c[ib>>2]=0;c[ib+4>>2]=0;ib=Ab(Ub>>31>>>6|0,0,ub|0,Ub|0)|0;Nb=yb(ib|0,D|0,26)|0;ib=D;Sb=Db(Nb|0,ib|0,26)|0;dc=zb(ub|0,Ub|0,Sb|0,D|0)|0;Sb=db;c[Sb>>2]=dc;c[Sb+4>>2]=D;Sb=Ab(Ib|0,kc|0,Nb|0,ib|0)|0;ib=D;Nb=Ab(ib>>31>>>7|0,0,Sb|0,ib|0)|0;kc=yb(Nb|0,D|0,25)|0;Nb=D;Ib=Db(kc|0,Nb|0,25)|0;dc=zb(Sb|0,ib|0,Ib|0,D|0)|0;Ib=sb;c[Ib>>2]=dc;c[Ib+4>>2]=D;Ib=Ab(nc|0,Pb|0,kc|0,Nb|0)|0;Nb=D;kc=Ab(Nb>>31>>>6|0,0,Ib|0,Nb|0)|0;Pb=yb(kc|0,D|0,26)|0;kc=D;nc=Db(Pb|0,kc|0,26)|0;dc=zb(Ib|0,Nb|0,nc|0,D|0)|0;nc=jc;c[nc>>2]=dc;c[nc+4>>2]=D;nc=Ab(ob|0,vb|0,Pb|0,kc|0)|0;kc=D;Pb=Ab(kc>>31>>>7|0,0,nc|0,kc|0)|0;vb=yb(Pb|0,D|0,25)|0;Pb=D;ob=Db(vb|0,Pb|0,25)|0;dc=zb(nc|0,kc|0,ob|0,D|0)|0;ob=rc;c[ob>>2]=dc;c[ob+4>>2]=D;ob=Ab(Fb|0,$b|0,vb|0,Pb|0)|0;Pb=D;vb=Ab(Pb>>31>>>6|0,0,ob|0,Pb|0)|0;$b=yb(vb|0,D|0,26)|0;vb=D;Fb=Db($b|0,vb|0,26)|0;dc=zb(ob|0,Pb|0,Fb|0,D|0)|0;Fb=pc;c[Fb>>2]=dc;c[Fb+4>>2]=D;Fb=Ab($b|0,vb|0,Eb|0,Hb|0)|0;Hb=D;Eb=Ab(Hb>>31>>>7|0,0,Fb|0,Hb|0)|0;vb=yb(Eb|0,D|0,25)|0;Eb=D;$b=Db(vb|0,Eb|0,25)|0;dc=zb(Fb|0,Hb|0,$b|0,D|0)|0;$b=qc;c[$b>>2]=dc;c[$b+4>>2]=D;$b=Gb;dc=Ab(vb|0,Eb|0,c[$b>>2]|0,c[$b+4>>2]|0)|0;$b=D;Eb=Ab($b>>31>>>6|0,0,dc|0,$b|0)|0;vb=yb(Eb|0,D|0,26)|0;Eb=D;qc=Db(vb|0,Eb|0,26)|0;Hb=zb(dc|0,$b|0,qc|0,D|0)|0;qc=Gb;c[qc>>2]=Hb;c[qc+4>>2]=D;qc=rb;Hb=Ab(vb|0,Eb|0,c[qc>>2]|0,c[qc+4>>2]|0)|0;qc=D;Eb=Ab(qc>>31>>>7|0,0,Hb|0,qc|0)|0;vb=yb(Eb|0,D|0,25)|0;Eb=D;Gb=Db(vb|0,Eb|0,25)|0;$b=zb(Hb|0,qc|0,Gb|0,D|0)|0;Gb=rb;c[Gb>>2]=$b;c[Gb+4>>2]=D;Gb=sc;$b=Ab(vb|0,Eb|0,c[Gb>>2]|0,c[Gb+4>>2]|0)|0;Gb=D;Eb=Ab(Gb>>31>>>6|0,0,$b|0,Gb|0)|0;vb=yb(Eb|0,D|0,26)|0;Eb=D;rb=Db(vb|0,Eb|0,26)|0;qc=zb($b|0,Gb|0,rb|0,D|0)|0;rb=sc;c[rb>>2]=qc;c[rb+4>>2]=D;rb=db+72|0;qc=rb;sc=Ab(vb|0,Eb|0,c[qc>>2]|0,c[qc+4>>2]|0)|0;qc=D;Eb=Ab(qc>>31>>>7|0,0,sc|0,qc|0)|0;vb=yb(Eb|0,D|0,25)|0;Eb=D;Gb=Db(vb|0,Eb|0,25)|0;$b=zb(sc|0,qc|0,Gb|0,D|0)|0;Gb=rb;c[Gb>>2]=$b;c[Gb+4>>2]=D;Gb=ac;$b=Ab(vb|0,Eb|0,c[Gb>>2]|0,c[Gb+4>>2]|0)|0;Gb=D;Eb=db;vb=c[Eb>>2]|0;rb=c[Eb+4>>2]|0;Eb=Mb($b|0,Gb|0,18,0)|0;qc=D;sc=Ab($b|0,Gb|0,vb|0,rb|0)|0;rb=Ab(sc|0,D|0,Eb|0,qc|0)|0;qc=D;Eb=ac;c[Eb>>2]=0;c[Eb+4>>2]=0;Eb=Ab(qc>>31>>>6|0,0,rb|0,qc|0)|0;ac=yb(Eb|0,D|0,26)|0;Eb=D;sc=Db(ac|0,Eb|0,26)|0;vb=zb(rb|0,qc|0,sc|0,D|0)|0;sc=db;c[sc>>2]=vb;c[sc+4>>2]=D;sc=sb;vb=Ab(ac|0,Eb|0,c[sc>>2]|0,c[sc+4>>2]|0)|0;sc=sb;c[sc>>2]=vb;c[sc+4>>2]=D;sc=0;do{vb=bb+(sc<<3)|0;sb=vb;Eb=c[sb>>2]|0;ac=c[sb+4>>2]|0;sb=Za+(sc<<3)|0;qc=sb;rb=c[qc>>2]|0;Gb=c[qc+4>>2]|0;qc=(rb^Eb)&fb;$b=(Gb^ac)&gb;ac=yb(0,qc^Eb|0,32)|0;Eb=vb;c[Eb>>2]=ac;c[Eb+4>>2]=D;Eb=yb(0,qc^rb|0,32)|0;rb=sb;c[rb>>2]=Eb;c[rb+4>>2]=D;sc=sc+1|0}while((sc|0)!=10);xc=0;do{sc=db+(xc<<3)|0;ec=sc;ic=c[ec>>2]|0;Xb=c[ec+4>>2]|0;ec=$a+(xc<<3)|0;cc=ec;fc=c[cc>>2]|0;lb=c[cc+4>>2]|0;cc=(fc^ic)&fb;tb=(lb^Xb)&gb;Xb=yb(0,cc^ic|0,32)|0;ic=sc;c[ic>>2]=Xb;c[ic+4>>2]=D;ic=yb(0,cc^fc|0,32)|0;fc=ec;c[fc>>2]=ic;c[fc+4>>2]=D;xc=xc+1|0}while((xc|0)!=10);Xa=Xa+1|0;if((Xa|0)==8)break;else{gb=db;fb=bb;fc=$a;ic=Za;w=eb<<1&255;db=cb;cb=gb;bb=ab;ab=fb;$a=_a;_a=fc;Za=Ya;Ya=ic}}Sa=Sa+1|0;if((Sa|0)==32)break;else{Ta=Za;Ua=Ya;t=$a;Va=_a;u=bb;Wa=ab;v=db;s=cb}}C=y+0|0;E=bb+0|0;e=C+80|0;do{c[C>>2]=c[E>>2];C=C+4|0;E=E+4|0}while((C|0)<(e|0));C=z+0|0;E=db+0|0;e=C+80|0;do{c[C>>2]=c[E>>2];C=C+4|0;E=E+4|0}while((C|0)<(e|0));Da(h,z);Da(r,h);Da(q,r);Ea(j,q,z);Ea(k,j,h);Da(q,k);Ea(l,q,j);Da(q,l);Da(r,q);Da(q,r);Da(r,q);Da(q,r);Ea(m,q,l);Da(q,m);Da(r,q);Da(q,r);Da(r,q);Da(q,r);Da(r,q);Da(q,r);Da(r,q);Da(q,r);Da(r,q);Ea(n,r,m);Da(q,n);Da(r,q);Da(q,r);Da(r,q);Da(q,r);Da(r,q);Da(q,r);Da(r,q);Da(q,r);Da(r,q);Da(q,r);Da(r,q);Da(q,r);Da(r,q);Da(q,r);Da(r,q);Da(q,r);Da(r,q);Da(q,r);Da(r,q);Ea(q,r,n);Da(r,q);Da(q,r);Da(r,q);Da(q,r);Da(r,q);Da(q,r);Da(r,q);Da(q,r);Da(r,q);Da(q,r);Ea(o,q,m);Da(q,o);Da(r,q);m=2;do{Da(q,r);Da(r,q);m=m+2|0}while((m|0)<50);Ea(p,r,o);Da(r,p);Da(q,r);m=2;do{Da(r,q);Da(q,r);m=m+2|0}while((m|0)<100);Ea(r,q,p);Da(q,r);Da(r,q);p=2;do{Da(q,r);Da(r,q);p=p+2|0}while((p|0)<50);Ea(q,r,o);Da(r,q);Da(q,r);Da(r,q);Da(q,r);Da(r,q);Ea(A,r,k);Ea(z,y,A);A=c[z>>2]|0;c[h>>2]=A;y=h+4|0;c[y>>2]=c[z+8>>2];k=h+8|0;c[k>>2]=c[z+16>>2];r=h+12|0;c[r>>2]=c[z+24>>2];q=h+16|0;c[q>>2]=c[z+32>>2];o=h+20|0;c[o>>2]=c[z+40>>2];p=h+24|0;c[p>>2]=c[z+48>>2];m=h+28|0;c[m>>2]=c[z+56>>2];n=h+32|0;c[n>>2]=c[z+64>>2];l=h+36|0;c[l>>2]=c[z+72>>2];z=A;A=0;while(1){j=h+(A<<2)|0;E=z>>31&z;if(!(A&1)){C=E>>26;c[j>>2]=($(C,-67108864)|0)+z;e=h+(A+1<<2)|0;db=(c[e>>2]|0)+C|0;c[e>>2]=db;yc=db}else{db=E>>25;c[j>>2]=($(db,-33554432)|0)+z;j=h+(A+1<<2)|0;E=(c[j>>2]|0)+db|0;c[j>>2]=E;yc=E}A=A+1|0;if((A|0)==9)break;else z=yc}yc=c[l>>2]|0;z=(yc>>31&yc)>>25;c[l>>2]=($(z,-33554432)|0)+yc;yc=(z*19|0)+(c[h>>2]|0)|0;c[h>>2]=yc;z=yc;yc=0;while(1){A=h+(yc<<2)|0;E=z>>31&z;if(!(yc&1)){j=E>>26;c[A>>2]=($(j,-67108864)|0)+z;db=h+(yc+1<<2)|0;e=(c[db>>2]|0)+j|0;c[db>>2]=e;zc=e}else{e=E>>25;c[A>>2]=($(e,-33554432)|0)+z;A=h+(yc+1<<2)|0;E=(c[A>>2]|0)+e|0;c[A>>2]=E;zc=E}yc=yc+1|0;if((yc|0)==9)break;else z=zc}zc=c[l>>2]|0;z=(zc>>31&zc)>>25;c[l>>2]=($(z,-33554432)|0)+zc;zc=(z*19|0)+(c[h>>2]|0)|0;z=(zc>>31&zc)>>26;yc=($(z,-67108864)|0)+zc|0;c[h>>2]=yc;c[y>>2]=z+(c[y>>2]|0);z=yc;yc=0;while(1){zc=h+(yc<<2)|0;if(!(yc&1)){c[zc>>2]=z&67108863;E=h+(yc+1<<2)|0;A=(c[E>>2]|0)+(z>>26)|0;c[E>>2]=A;Ac=A}else{c[zc>>2]=z&33554431;zc=h+(yc+1<<2)|0;A=(c[zc>>2]|0)+(z>>25)|0;c[zc>>2]=A;Ac=A}yc=yc+1|0;if((yc|0)==9)break;else z=Ac}Ac=c[l>>2]|0;c[l>>2]=Ac&33554431;z=((Ac>>25)*19|0)+(c[h>>2]|0)|0;c[h>>2]=z;Ac=z;z=0;while(1){yc=h+(z<<2)|0;if(!(z&1)){c[yc>>2]=Ac&67108863;A=h+(z+1<<2)|0;zc=(c[A>>2]|0)+(Ac>>26)|0;c[A>>2]=zc;Bc=zc}else{c[yc>>2]=Ac&33554431;yc=h+(z+1<<2)|0;zc=(c[yc>>2]|0)+(Ac>>25)|0;c[yc>>2]=zc;Bc=zc}z=z+1|0;if((z|0)==9)break;else Ac=Bc}Bc=c[l>>2]|0;Ac=Bc&33554431;c[l>>2]=Ac;z=((Bc>>25)*19|0)+(c[h>>2]|0)|0;c[h>>2]=z;Bc=1;zc=~(z+-67108845>>31);do{yc=c[h+(Bc<<2)>>2]|0;if(!(Bc&1)){A=yc<<16&(yc^-67108864);E=A<<8&A;A=E<<4&E;E=A<<2&A;Cc=E<<1&E}else{E=yc<<16&(yc^-33554432);yc=E<<8&E;E=yc<<4&yc;yc=E<<2&E;Cc=yc<<1&yc}zc=Cc>>31&zc;Bc=Bc+1|0}while((Bc|0)!=10);Bc=z-(zc&67108845)|0;c[h>>2]=Bc;h=zc&67108863;z=zc&33554431;Cc=(c[y>>2]|0)-z|0;yc=Cc<<2;E=(c[k>>2]|0)-h|0;A=E<<3;e=(c[r>>2]|0)-z|0;db=e<<5;j=(c[q>>2]|0)-zc|0;zc=j<<6;C=(c[o>>2]|0)-z|0;c[o>>2]=C;o=(c[p>>2]|0)-h|0;bb=o<<1;s=(c[m>>2]|0)-z|0;v=s<<3;Wa=(c[n>>2]|0)-h<<4;c[y>>2]=yc;c[k>>2]=A;c[r>>2]=db;c[q>>2]=zc;c[p>>2]=bb;c[m>>2]=v;c[n>>2]=Wa;c[l>>2]=Ac-z<<6;a[b>>0]=Bc;a[b+1>>0]=Bc>>>8;a[b+2>>0]=Bc>>>16;a[b+3>>0]=yc|Bc>>>24;a[b+4>>0]=Cc>>>6;a[b+5>>0]=Cc>>>14;a[b+6>>0]=A|Cc>>>22;a[b+7>>0]=E>>>5;a[b+8>>0]=E>>>13;a[b+9>>0]=db|E>>>21;a[b+10>>0]=e>>>3;a[b+11>>0]=e>>>11;a[b+12>>0]=zc|e>>>19;a[b+13>>0]=j>>>2;a[b+14>>0]=j>>>10;a[b+15>>0]=j>>>18;a[b+16>>0]=C;a[b+17>>0]=C>>>8;a[b+18>>0]=C>>>16;a[b+19>>0]=C>>>24|bb;a[b+20>>0]=o>>>7;a[b+21>>0]=o>>>15;a[b+22>>0]=o>>>23|v;a[b+23>>0]=s>>>5;a[b+24>>0]=s>>>13;v=c[n>>2]|0;a[b+25>>0]=s>>>21|v;a[b+26>>0]=v>>>8;a[b+27>>0]=v>>>16;s=c[l>>2]|0;a[b+28>>0]=v>>>24|s;a[b+29>>0]=s>>>8;a[b+30>>0]=s>>>16;a[b+31>>0]=s>>>24;i=g;return 0}function Ca(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0,h=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0;e=i;f=yb(0,c[b>>2]|0,32)|0;g=D;h=yb(0,c[d>>2]|0,32)|0;j=Mb(h|0,D|0,f|0,g|0)|0;g=a;c[g>>2]=j;c[g+4>>2]=D;g=yb(0,c[b>>2]|0,32)|0;j=D;f=d+8|0;h=yb(0,c[f>>2]|0,32)|0;k=Mb(h|0,D|0,g|0,j|0)|0;j=D;g=b+8|0;h=yb(0,c[g>>2]|0,32)|0;l=D;m=yb(0,c[d>>2]|0,32)|0;n=Mb(m|0,D|0,h|0,l|0)|0;l=Ab(n|0,D|0,k|0,j|0)|0;j=a+8|0;c[j>>2]=l;c[j+4>>2]=D;j=yb(0,c[g>>2]|0,31)|0;l=D;k=yb(0,c[f>>2]|0,32)|0;n=Mb(k|0,D|0,j|0,l|0)|0;l=D;j=yb(0,c[b>>2]|0,32)|0;k=D;h=d+16|0;m=yb(0,c[h>>2]|0,32)|0;o=Mb(m|0,D|0,j|0,k|0)|0;k=Ab(o|0,D|0,n|0,l|0)|0;l=D;n=b+16|0;o=yb(0,c[n>>2]|0,32)|0;j=D;m=yb(0,c[d>>2]|0,32)|0;p=Mb(m|0,D|0,o|0,j|0)|0;j=Ab(k|0,l|0,p|0,D|0)|0;p=a+16|0;c[p>>2]=j;c[p+4>>2]=D;p=yb(0,c[g>>2]|0,32)|0;j=D;l=yb(0,c[h>>2]|0,32)|0;k=Mb(l|0,D|0,p|0,j|0)|0;j=D;p=yb(0,c[n>>2]|0,32)|0;l=D;o=yb(0,c[f>>2]|0,32)|0;m=Mb(o|0,D|0,p|0,l|0)|0;l=Ab(m|0,D|0,k|0,j|0)|0;j=D;k=yb(0,c[b>>2]|0,32)|0;m=D;p=d+24|0;o=yb(0,c[p>>2]|0,32)|0;q=Mb(o|0,D|0,k|0,m|0)|0;m=Ab(l|0,j|0,q|0,D|0)|0;q=D;j=b+24|0;l=yb(0,c[j>>2]|0,32)|0;k=D;o=yb(0,c[d>>2]|0,32)|0;r=Mb(o|0,D|0,l|0,k|0)|0;k=Ab(m|0,q|0,r|0,D|0)|0;r=a+24|0;c[r>>2]=k;c[r+4>>2]=D;r=yb(0,c[n>>2]|0,32)|0;k=D;q=yb(0,c[h>>2]|0,32)|0;m=Mb(q|0,D|0,r|0,k|0)|0;k=D;r=yb(0,c[g>>2]|0,32)|0;q=D;l=yb(0,c[p>>2]|0,32)|0;o=Mb(l|0,D|0,r|0,q|0)|0;q=D;r=yb(0,c[j>>2]|0,32)|0;l=D;s=yb(0,c[f>>2]|0,32)|0;t=Mb(s|0,D|0,r|0,l|0)|0;l=Ab(t|0,D|0,o|0,q|0)|0;q=Db(l|0,D|0,1)|0;l=Ab(q|0,D|0,m|0,k|0)|0;k=D;m=yb(0,c[b>>2]|0,32)|0;q=D;o=d+32|0;t=yb(0,c[o>>2]|0,32)|0;r=Mb(t|0,D|0,m|0,q|0)|0;q=Ab(l|0,k|0,r|0,D|0)|0;r=D;k=b+32|0;l=yb(0,c[k>>2]|0,32)|0;m=D;t=yb(0,c[d>>2]|0,32)|0;s=Mb(t|0,D|0,l|0,m|0)|0;m=Ab(q|0,r|0,s|0,D|0)|0;s=a+32|0;c[s>>2]=m;c[s+4>>2]=D;s=yb(0,c[n>>2]|0,32)|0;m=D;r=yb(0,c[p>>2]|0,32)|0;q=Mb(r|0,D|0,s|0,m|0)|0;m=D;s=yb(0,c[j>>2]|0,32)|0;r=D;l=yb(0,c[h>>2]|0,32)|0;t=Mb(l|0,D|0,s|0,r|0)|0;r=Ab(t|0,D|0,q|0,m|0)|0;m=D;q=yb(0,c[g>>2]|0,32)|0;t=D;s=yb(0,c[o>>2]|0,32)|0;l=Mb(s|0,D|0,q|0,t|0)|0;t=Ab(r|0,m|0,l|0,D|0)|0;l=D;m=yb(0,c[k>>2]|0,32)|0;r=D;q=yb(0,c[f>>2]|0,32)|0;s=Mb(q|0,D|0,m|0,r|0)|0;r=Ab(t|0,l|0,s|0,D|0)|0;s=D;l=yb(0,c[b>>2]|0,32)|0;t=D;m=d+40|0;q=yb(0,c[m>>2]|0,32)|0;u=Mb(q|0,D|0,l|0,t|0)|0;t=Ab(r|0,s|0,u|0,D|0)|0;u=D;s=b+40|0;r=yb(0,c[s>>2]|0,32)|0;l=D;q=yb(0,c[d>>2]|0,32)|0;v=Mb(q|0,D|0,r|0,l|0)|0;l=Ab(t|0,u|0,v|0,D|0)|0;v=a+40|0;c[v>>2]=l;c[v+4>>2]=D;v=yb(0,c[j>>2]|0,32)|0;l=D;u=yb(0,c[p>>2]|0,32)|0;t=Mb(u|0,D|0,v|0,l|0)|0;l=D;v=yb(0,c[g>>2]|0,32)|0;u=D;r=yb(0,c[m>>2]|0,32)|0;q=Mb(r|0,D|0,v|0,u|0)|0;u=Ab(q|0,D|0,t|0,l|0)|0;l=D;t=yb(0,c[s>>2]|0,32)|0;q=D;v=yb(0,c[f>>2]|0,32)|0;r=Mb(v|0,D|0,t|0,q|0)|0;q=Ab(u|0,l|0,r|0,D|0)|0;r=Db(q|0,D|0,1)|0;q=D;l=yb(0,c[n>>2]|0,32)|0;u=D;t=yb(0,c[o>>2]|0,32)|0;v=Mb(t|0,D|0,l|0,u|0)|0;u=Ab(r|0,q|0,v|0,D|0)|0;v=D;q=yb(0,c[k>>2]|0,32)|0;r=D;l=yb(0,c[h>>2]|0,32)|0;t=Mb(l|0,D|0,q|0,r|0)|0;r=Ab(u|0,v|0,t|0,D|0)|0;t=D;v=yb(0,c[b>>2]|0,32)|0;u=D;q=d+48|0;l=yb(0,c[q>>2]|0,32)|0;w=Mb(l|0,D|0,v|0,u|0)|0;u=Ab(r|0,t|0,w|0,D|0)|0;w=D;t=b+48|0;r=yb(0,c[t>>2]|0,32)|0;v=D;l=yb(0,c[d>>2]|0,32)|0;x=Mb(l|0,D|0,r|0,v|0)|0;v=Ab(u|0,w|0,x|0,D|0)|0;x=a+48|0;c[x>>2]=v;c[x+4>>2]=D;x=yb(0,c[j>>2]|0,32)|0;v=D;w=yb(0,c[o>>2]|0,32)|0;u=Mb(w|0,D|0,x|0,v|0)|0;v=D;x=yb(0,c[k>>2]|0,32)|0;w=D;r=yb(0,c[p>>2]|0,32)|0;l=Mb(r|0,D|0,x|0,w|0)|0;w=Ab(l|0,D|0,u|0,v|0)|0;v=D;u=yb(0,c[n>>2]|0,32)|0;l=D;x=yb(0,c[m>>2]|0,32)|0;r=Mb(x|0,D|0,u|0,l|0)|0;l=Ab(w|0,v|0,r|0,D|0)|0;r=D;v=yb(0,c[s>>2]|0,32)|0;w=D;u=yb(0,c[h>>2]|0,32)|0;x=Mb(u|0,D|0,v|0,w|0)|0;w=Ab(l|0,r|0,x|0,D|0)|0;x=D;r=yb(0,c[g>>2]|0,32)|0;l=D;v=yb(0,c[q>>2]|0,32)|0;u=Mb(v|0,D|0,r|0,l|0)|0;l=Ab(w|0,x|0,u|0,D|0)|0;u=D;x=yb(0,c[t>>2]|0,32)|0;w=D;r=yb(0,c[f>>2]|0,32)|0;v=Mb(r|0,D|0,x|0,w|0)|0;w=Ab(l|0,u|0,v|0,D|0)|0;v=D;u=yb(0,c[b>>2]|0,32)|0;l=D;x=d+56|0;r=yb(0,c[x>>2]|0,32)|0;y=Mb(r|0,D|0,u|0,l|0)|0;l=Ab(w|0,v|0,y|0,D|0)|0;y=D;v=b+56|0;w=yb(0,c[v>>2]|0,32)|0;u=D;r=yb(0,c[d>>2]|0,32)|0;z=Mb(r|0,D|0,w|0,u|0)|0;u=Ab(l|0,y|0,z|0,D|0)|0;z=a+56|0;c[z>>2]=u;c[z+4>>2]=D;z=yb(0,c[k>>2]|0,32)|0;u=D;y=yb(0,c[o>>2]|0,32)|0;l=Mb(y|0,D|0,z|0,u|0)|0;u=D;z=yb(0,c[j>>2]|0,32)|0;y=D;w=yb(0,c[m>>2]|0,32)|0;r=Mb(w|0,D|0,z|0,y|0)|0;y=D;z=yb(0,c[s>>2]|0,32)|0;w=D;A=yb(0,c[p>>2]|0,32)|0;B=Mb(A|0,D|0,z|0,w|0)|0;w=Ab(B|0,D|0,r|0,y|0)|0;y=D;r=yb(0,c[g>>2]|0,32)|0;B=D;z=yb(0,c[x>>2]|0,32)|0;A=Mb(z|0,D|0,r|0,B|0)|0;B=Ab(w|0,y|0,A|0,D|0)|0;A=D;y=yb(0,c[v>>2]|0,32)|0;w=D;r=yb(0,c[f>>2]|0,32)|0;z=Mb(r|0,D|0,y|0,w|0)|0;w=Ab(B|0,A|0,z|0,D|0)|0;z=Db(w|0,D|0,1)|0;w=Ab(z|0,D|0,l|0,u|0)|0;u=D;l=yb(0,c[n>>2]|0,32)|0;z=D;A=yb(0,c[q>>2]|0,32)|0;B=Mb(A|0,D|0,l|0,z|0)|0;z=Ab(w|0,u|0,B|0,D|0)|0;B=D;u=yb(0,c[t>>2]|0,32)|0;w=D;l=yb(0,c[h>>2]|0,32)|0;A=Mb(l|0,D|0,u|0,w|0)|0;w=Ab(z|0,B|0,A|0,D|0)|0;A=D;B=yb(0,c[b>>2]|0,32)|0;z=D;u=d+64|0;l=yb(0,c[u>>2]|0,32)|0;y=Mb(l|0,D|0,B|0,z|0)|0;z=Ab(w|0,A|0,y|0,D|0)|0;y=D;A=b+64|0;w=yb(0,c[A>>2]|0,32)|0;B=D;l=yb(0,c[d>>2]|0,32)|0;r=Mb(l|0,D|0,w|0,B|0)|0;B=Ab(z|0,y|0,r|0,D|0)|0;r=a+64|0;c[r>>2]=B;c[r+4>>2]=D;r=yb(0,c[k>>2]|0,32)|0;B=D;y=yb(0,c[m>>2]|0,32)|0;z=Mb(y|0,D|0,r|0,B|0)|0;B=D;r=yb(0,c[s>>2]|0,32)|0;y=D;w=yb(0,c[o>>2]|0,32)|0;l=Mb(w|0,D|0,r|0,y|0)|0;y=Ab(l|0,D|0,z|0,B|0)|0;B=D;z=yb(0,c[j>>2]|0,32)|0;l=D;r=yb(0,c[q>>2]|0,32)|0;w=Mb(r|0,D|0,z|0,l|0)|0;l=Ab(y|0,B|0,w|0,D|0)|0;w=D;B=yb(0,c[t>>2]|0,32)|0;y=D;z=yb(0,c[p>>2]|0,32)|0;r=Mb(z|0,D|0,B|0,y|0)|0;y=Ab(l|0,w|0,r|0,D|0)|0;r=D;w=yb(0,c[n>>2]|0,32)|0;l=D;B=yb(0,c[x>>2]|0,32)|0;z=Mb(B|0,D|0,w|0,l|0)|0;l=Ab(y|0,r|0,z|0,D|0)|0;z=D;r=yb(0,c[v>>2]|0,32)|0;y=D;w=yb(0,c[h>>2]|0,32)|0;B=Mb(w|0,D|0,r|0,y|0)|0;y=Ab(l|0,z|0,B|0,D|0)|0;B=D;z=yb(0,c[g>>2]|0,32)|0;l=D;r=yb(0,c[u>>2]|0,32)|0;w=Mb(r|0,D|0,z|0,l|0)|0;l=Ab(y|0,B|0,w|0,D|0)|0;w=D;B=yb(0,c[A>>2]|0,32)|0;y=D;z=yb(0,c[f>>2]|0,32)|0;r=Mb(z|0,D|0,B|0,y|0)|0;y=Ab(l|0,w|0,r|0,D|0)|0;r=D;w=yb(0,c[b>>2]|0,32)|0;l=D;B=d+72|0;z=yb(0,c[B>>2]|0,32)|0;C=Mb(z|0,D|0,w|0,l|0)|0;l=Ab(y|0,r|0,C|0,D|0)|0;C=D;r=b+72|0;b=yb(0,c[r>>2]|0,32)|0;y=D;w=yb(0,c[d>>2]|0,32)|0;d=Mb(w|0,D|0,b|0,y|0)|0;y=Ab(l|0,C|0,d|0,D|0)|0;d=a+72|0;c[d>>2]=y;c[d+4>>2]=D;d=yb(0,c[s>>2]|0,32)|0;y=D;C=yb(0,c[m>>2]|0,32)|0;l=Mb(C|0,D|0,d|0,y|0)|0;y=D;d=yb(0,c[j>>2]|0,32)|0;C=D;b=yb(0,c[x>>2]|0,32)|0;w=Mb(b|0,D|0,d|0,C|0)|0;C=Ab(w|0,D|0,l|0,y|0)|0;y=D;l=yb(0,c[v>>2]|0,32)|0;w=D;d=yb(0,c[p>>2]|0,32)|0;b=Mb(d|0,D|0,l|0,w|0)|0;w=Ab(C|0,y|0,b|0,D|0)|0;b=D;y=yb(0,c[g>>2]|0,32)|0;g=D;C=yb(0,c[B>>2]|0,32)|0;l=Mb(C|0,D|0,y|0,g|0)|0;g=Ab(w|0,b|0,l|0,D|0)|0;l=D;b=yb(0,c[r>>2]|0,32)|0;w=D;y=yb(0,c[f>>2]|0,32)|0;f=Mb(y|0,D|0,b|0,w|0)|0;w=Ab(g|0,l|0,f|0,D|0)|0;f=Db(w|0,D|0,1)|0;w=D;l=yb(0,c[k>>2]|0,32)|0;g=D;b=yb(0,c[q>>2]|0,32)|0;y=Mb(b|0,D|0,l|0,g|0)|0;g=Ab(f|0,w|0,y|0,D|0)|0;y=D;w=yb(0,c[t>>2]|0,32)|0;f=D;l=yb(0,c[o>>2]|0,32)|0;b=Mb(l|0,D|0,w|0,f|0)|0;f=Ab(g|0,y|0,b|0,D|0)|0;b=D;y=yb(0,c[n>>2]|0,32)|0;g=D;w=yb(0,c[u>>2]|0,32)|0;l=Mb(w|0,D|0,y|0,g|0)|0;g=Ab(f|0,b|0,l|0,D|0)|0;l=D;b=yb(0,c[A>>2]|0,32)|0;f=D;y=yb(0,c[h>>2]|0,32)|0;w=Mb(y|0,D|0,b|0,f|0)|0;f=Ab(g|0,l|0,w|0,D|0)|0;w=a+80|0;c[w>>2]=f;c[w+4>>2]=D;w=yb(0,c[s>>2]|0,32)|0;f=D;l=yb(0,c[q>>2]|0,32)|0;g=Mb(l|0,D|0,w|0,f|0)|0;f=D;w=yb(0,c[t>>2]|0,32)|0;l=D;b=yb(0,c[m>>2]|0,32)|0;y=Mb(b|0,D|0,w|0,l|0)|0;l=Ab(y|0,D|0,g|0,f|0)|0;f=D;g=yb(0,c[k>>2]|0,32)|0;y=D;w=yb(0,c[x>>2]|0,32)|0;b=Mb(w|0,D|0,g|0,y|0)|0;y=Ab(l|0,f|0,b|0,D|0)|0;b=D;f=yb(0,c[v>>2]|0,32)|0;l=D;g=yb(0,c[o>>2]|0,32)|0;w=Mb(g|0,D|0,f|0,l|0)|0;l=Ab(y|0,b|0,w|0,D|0)|0;w=D;b=yb(0,c[j>>2]|0,32)|0;y=D;f=yb(0,c[u>>2]|0,32)|0;g=Mb(f|0,D|0,b|0,y|0)|0;y=Ab(l|0,w|0,g|0,D|0)|0;g=D;w=yb(0,c[A>>2]|0,32)|0;l=D;b=yb(0,c[p>>2]|0,32)|0;f=Mb(b|0,D|0,w|0,l|0)|0;l=Ab(y|0,g|0,f|0,D|0)|0;f=D;g=yb(0,c[n>>2]|0,32)|0;n=D;y=yb(0,c[B>>2]|0,32)|0;w=Mb(y|0,D|0,g|0,n|0)|0;n=Ab(l|0,f|0,w|0,D|0)|0;w=D;f=yb(0,c[r>>2]|0,32)|0;l=D;g=yb(0,c[h>>2]|0,32)|0;h=Mb(g|0,D|0,f|0,l|0)|0;l=Ab(n|0,w|0,h|0,D|0)|0;h=a+88|0;c[h>>2]=l;c[h+4>>2]=D;h=yb(0,c[t>>2]|0,32)|0;l=D;w=yb(0,c[q>>2]|0,32)|0;n=Mb(w|0,D|0,h|0,l|0)|0;l=D;h=yb(0,c[s>>2]|0,32)|0;w=D;f=yb(0,c[x>>2]|0,32)|0;g=Mb(f|0,D|0,h|0,w|0)|0;w=D;h=yb(0,c[v>>2]|0,32)|0;f=D;y=yb(0,c[m>>2]|0,32)|0;b=Mb(y|0,D|0,h|0,f|0)|0;f=Ab(b|0,D|0,g|0,w|0)|0;w=D;g=yb(0,c[j>>2]|0,32)|0;j=D;b=yb(0,c[B>>2]|0,32)|0;h=Mb(b|0,D|0,g|0,j|0)|0;j=Ab(f|0,w|0,h|0,D|0)|0;h=D;w=yb(0,c[r>>2]|0,32)|0;f=D;g=yb(0,c[p>>2]|0,32)|0;p=Mb(g|0,D|0,w|0,f|0)|0;f=Ab(j|0,h|0,p|0,D|0)|0;p=Db(f|0,D|0,1)|0;f=Ab(p|0,D|0,n|0,l|0)|0;l=D;n=yb(0,c[k>>2]|0,32)|0;p=D;h=yb(0,c[u>>2]|0,32)|0;j=Mb(h|0,D|0,n|0,p|0)|0;p=Ab(f|0,l|0,j|0,D|0)|0;j=D;l=yb(0,c[A>>2]|0,32)|0;f=D;n=yb(0,c[o>>2]|0,32)|0;h=Mb(n|0,D|0,l|0,f|0)|0;f=Ab(p|0,j|0,h|0,D|0)|0;h=a+96|0;c[h>>2]=f;c[h+4>>2]=D;h=yb(0,c[t>>2]|0,32)|0;f=D;j=yb(0,c[x>>2]|0,32)|0;p=Mb(j|0,D|0,h|0,f|0)|0;f=D;h=yb(0,c[v>>2]|0,32)|0;j=D;l=yb(0,c[q>>2]|0,32)|0;n=Mb(l|0,D|0,h|0,j|0)|0;j=Ab(n|0,D|0,p|0,f|0)|0;f=D;p=yb(0,c[s>>2]|0,32)|0;n=D;h=yb(0,c[u>>2]|0,32)|0;l=Mb(h|0,D|0,p|0,n|0)|0;n=Ab(j|0,f|0,l|0,D|0)|0;l=D;f=yb(0,c[A>>2]|0,32)|0;j=D;p=yb(0,c[m>>2]|0,32)|0;h=Mb(p|0,D|0,f|0,j|0)|0;j=Ab(n|0,l|0,h|0,D|0)|0;h=D;l=yb(0,c[k>>2]|0,32)|0;k=D;n=yb(0,c[B>>2]|0,32)|0;f=Mb(n|0,D|0,l|0,k|0)|0;k=Ab(j|0,h|0,f|0,D|0)|0;f=D;h=yb(0,c[r>>2]|0,32)|0;j=D;l=yb(0,c[o>>2]|0,32)|0;o=Mb(l|0,D|0,h|0,j|0)|0;j=Ab(k|0,f|0,o|0,D|0)|0;o=a+104|0;c[o>>2]=j;c[o+4>>2]=D;o=yb(0,c[v>>2]|0,32)|0;j=D;f=yb(0,c[x>>2]|0,32)|0;k=Mb(f|0,D|0,o|0,j|0)|0;j=D;o=yb(0,c[s>>2]|0,32)|0;s=D;f=yb(0,c[B>>2]|0,32)|0;h=Mb(f|0,D|0,o|0,s|0)|0;s=Ab(h|0,D|0,k|0,j|0)|0;j=D;k=yb(0,c[r>>2]|0,32)|0;h=D;o=yb(0,c[m>>2]|0,32)|0;m=Mb(o|0,D|0,k|0,h|0)|0;h=Ab(s|0,j|0,m|0,D|0)|0;m=Db(h|0,D|0,1)|0;h=D;j=yb(0,c[t>>2]|0,32)|0;s=D;k=yb(0,c[u>>2]|0,32)|0;o=Mb(k|0,D|0,j|0,s|0)|0;s=Ab(m|0,h|0,o|0,D|0)|0;o=D;h=yb(0,c[A>>2]|0,32)|0;m=D;j=yb(0,c[q>>2]|0,32)|0;k=Mb(j|0,D|0,h|0,m|0)|0;m=Ab(s|0,o|0,k|0,D|0)|0;k=a+112|0;c[k>>2]=m;c[k+4>>2]=D;k=yb(0,c[v>>2]|0,32)|0;m=D;o=yb(0,c[u>>2]|0,32)|0;s=Mb(o|0,D|0,k|0,m|0)|0;m=D;k=yb(0,c[A>>2]|0,32)|0;o=D;h=yb(0,c[x>>2]|0,32)|0;j=Mb(h|0,D|0,k|0,o|0)|0;o=Ab(j|0,D|0,s|0,m|0)|0;m=D;s=yb(0,c[t>>2]|0,32)|0;t=D;j=yb(0,c[B>>2]|0,32)|0;k=Mb(j|0,D|0,s|0,t|0)|0;t=Ab(o|0,m|0,k|0,D|0)|0;k=D;m=yb(0,c[r>>2]|0,32)|0;o=D;s=yb(0,c[q>>2]|0,32)|0;q=Mb(s|0,D|0,m|0,o|0)|0;o=Ab(t|0,k|0,q|0,D|0)|0;q=a+120|0;c[q>>2]=o;c[q+4>>2]=D;q=yb(0,c[A>>2]|0,32)|0;o=D;k=yb(0,c[u>>2]|0,32)|0;t=Mb(k|0,D|0,q|0,o|0)|0;o=D;q=yb(0,c[v>>2]|0,32)|0;v=D;k=yb(0,c[B>>2]|0,32)|0;m=Mb(k|0,D|0,q|0,v|0)|0;v=D;q=yb(0,c[r>>2]|0,32)|0;k=D;s=yb(0,c[x>>2]|0,32)|0;x=Mb(s|0,D|0,q|0,k|0)|0;k=Ab(x|0,D|0,m|0,v|0)|0;v=Db(k|0,D|0,1)|0;k=Ab(v|0,D|0,t|0,o|0)|0;o=a+128|0;c[o>>2]=k;c[o+4>>2]=D;o=yb(0,c[A>>2]|0,32)|0;A=D;k=yb(0,c[B>>2]|0,32)|0;t=Mb(k|0,D|0,o|0,A|0)|0;A=D;o=yb(0,c[r>>2]|0,32)|0;k=D;v=yb(0,c[u>>2]|0,32)|0;u=Mb(v|0,D|0,o|0,k|0)|0;k=Ab(u|0,D|0,t|0,A|0)|0;A=a+136|0;c[A>>2]=k;c[A+4>>2]=D;A=yb(0,c[r>>2]|0,31)|0;r=D;k=yb(0,c[B>>2]|0,32)|0;B=Mb(k|0,D|0,A|0,r|0)|0;r=a+144|0;c[r>>2]=B;c[r+4>>2]=D;i=e;return}function Da(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0,L=0,M=0,N=0,O=0,P=0,Q=0,R=0,S=0;d=i;i=i+160|0;e=d;f=c[b>>2]|0;g=yb(0,f|0,32)|0;h=D;j=Mb(g|0,h|0,g|0,h|0)|0;k=e;c[k>>2]=j;c[k+4>>2]=D;k=yb(0,f|0,31)|0;f=D;j=b+8|0;l=c[j>>2]|0;m=yb(0,l|0,32)|0;n=D;o=Mb(m|0,n|0,k|0,f|0)|0;p=e+8|0;q=p;c[q>>2]=o;c[q+4>>2]=D;q=Mb(m|0,n|0,m|0,n|0)|0;o=D;r=b+16|0;s=yb(0,c[r>>2]|0,32)|0;t=D;u=Mb(s|0,t|0,g|0,h|0)|0;v=Ab(u|0,D|0,q|0,o|0)|0;o=Db(v|0,D|0,1)|0;v=e+16|0;q=v;c[q>>2]=o;c[q+4>>2]=D;q=Mb(s|0,t|0,m|0,n|0)|0;o=D;u=b+24|0;w=yb(0,c[u>>2]|0,32)|0;x=D;y=Mb(w|0,x|0,g|0,h|0)|0;z=Ab(y|0,D|0,q|0,o|0)|0;o=Db(z|0,D|0,1)|0;z=e+24|0;q=z;c[q>>2]=o;c[q+4>>2]=D;q=Mb(s|0,t|0,s|0,t|0)|0;o=D;y=yb(0,l|0,30)|0;A=Mb(w|0,x|0,y|0,D|0)|0;y=Ab(A|0,D|0,q|0,o|0)|0;o=D;q=b+32|0;A=yb(0,c[q>>2]|0,32)|0;B=D;C=Mb(A|0,B|0,k|0,f|0)|0;f=Ab(y|0,o|0,C|0,D|0)|0;C=e+32|0;o=C;c[o>>2]=f;c[o+4>>2]=D;o=Mb(w|0,x|0,s|0,t|0)|0;f=D;y=Mb(A|0,B|0,m|0,n|0)|0;k=Ab(y|0,D|0,o|0,f|0)|0;f=D;o=b+40|0;y=yb(0,c[o>>2]|0,32)|0;E=D;F=Mb(y|0,E|0,g|0,h|0)|0;G=Ab(k|0,f|0,F|0,D|0)|0;F=Db(G|0,D|0,1)|0;G=e+40|0;f=G;c[f>>2]=F;c[f+4>>2]=D;f=Mb(w|0,x|0,w|0,x|0)|0;F=D;k=Mb(A|0,B|0,s|0,t|0)|0;H=Ab(k|0,D|0,f|0,F|0)|0;F=D;f=b+48|0;k=yb(0,c[f>>2]|0,32)|0;I=D;J=Mb(k|0,I|0,g|0,h|0)|0;K=Ab(H|0,F|0,J|0,D|0)|0;J=D;F=yb(0,l|0,31)|0;l=Mb(y|0,E|0,F|0,D|0)|0;F=Ab(K|0,J|0,l|0,D|0)|0;l=Db(F|0,D|0,1)|0;F=e+48|0;J=F;c[J>>2]=l;c[J+4>>2]=D;J=Mb(A|0,B|0,w|0,x|0)|0;l=D;K=Mb(y|0,E|0,s|0,t|0)|0;H=Ab(K|0,D|0,J|0,l|0)|0;l=D;J=Mb(k|0,I|0,m|0,n|0)|0;K=Ab(H|0,l|0,J|0,D|0)|0;J=D;l=b+56|0;H=yb(0,c[l>>2]|0,32)|0;L=D;M=Mb(H|0,L|0,g|0,h|0)|0;N=Ab(K|0,J|0,M|0,D|0)|0;M=Db(N|0,D|0,1)|0;N=e+56|0;J=N;c[J>>2]=M;c[J+4>>2]=D;J=Mb(A|0,B|0,A|0,B|0)|0;M=D;K=Mb(k|0,I|0,s|0,t|0)|0;O=D;P=b+64|0;Q=yb(0,c[P>>2]|0,32)|0;R=D;S=Mb(Q|0,R|0,g|0,h|0)|0;h=Ab(S|0,D|0,K|0,O|0)|0;O=D;K=Mb(H|0,L|0,m|0,n|0)|0;n=D;m=Mb(y|0,E|0,w|0,x|0)|0;S=Ab(m|0,D|0,K|0,n|0)|0;n=Db(S|0,D|0,1)|0;S=Ab(h|0,O|0,n|0,D|0)|0;n=Db(S|0,D|0,1)|0;S=Ab(n|0,D|0,J|0,M|0)|0;M=e+64|0;J=M;c[J>>2]=S;c[J+4>>2]=D;J=Mb(y|0,E|0,A|0,B|0)|0;S=D;n=Mb(k|0,I|0,w|0,x|0)|0;x=Ab(n|0,D|0,J|0,S|0)|0;S=D;J=Mb(H|0,L|0,s|0,t|0)|0;t=Ab(x|0,S|0,J|0,D|0)|0;J=D;S=yb(0,c[j>>2]|0,32)|0;j=D;x=Mb(Q|0,R|0,S|0,j|0)|0;s=Ab(t|0,J|0,x|0,D|0)|0;x=D;J=yb(0,c[b>>2]|0,32)|0;t=D;n=c[b+72>>2]|0;b=yb(0,n|0,32)|0;w=D;O=Mb(b|0,w|0,J|0,t|0)|0;t=Ab(s|0,x|0,O|0,D|0)|0;O=Db(t|0,D|0,1)|0;t=e+72|0;x=t;c[x>>2]=O;c[x+4>>2]=D;x=Mb(y|0,E|0,y|0,E|0)|0;O=D;s=Mb(k|0,I|0,A|0,B|0)|0;B=Ab(s|0,D|0,x|0,O|0)|0;O=D;x=yb(0,c[r>>2]|0,32)|0;r=D;s=Mb(Q|0,R|0,x|0,r|0)|0;A=Ab(B|0,O|0,s|0,D|0)|0;s=D;O=yb(0,c[u>>2]|0,32)|0;u=D;B=Mb(H|0,L|0,O|0,u|0)|0;J=D;h=Mb(b|0,w|0,S|0,j|0)|0;j=Ab(h|0,D|0,B|0,J|0)|0;J=Db(j|0,D|0,1)|0;j=Ab(A|0,s|0,J|0,D|0)|0;J=Db(j|0,D|0,1)|0;j=e+80|0;s=j;c[s>>2]=J;c[s+4>>2]=D;s=Mb(k|0,I|0,y|0,E|0)|0;E=D;y=yb(0,c[q>>2]|0,32)|0;q=D;J=Mb(H|0,L|0,y|0,q|0)|0;A=Ab(J|0,D|0,s|0,E|0)|0;E=D;s=Mb(Q|0,R|0,O|0,u|0)|0;J=Ab(A|0,E|0,s|0,D|0)|0;s=D;E=Mb(b|0,w|0,x|0,r|0)|0;r=Ab(J|0,s|0,E|0,D|0)|0;E=D;s=Db(r|0,E|0,1)|0;J=D;x=e+88|0;c[x>>2]=s;c[x+4>>2]=J;x=Mb(k|0,I|0,k|0,I|0)|0;I=D;k=Mb(Q|0,R|0,y|0,q|0)|0;A=D;B=c[o>>2]|0;o=yb(0,B|0,32)|0;h=D;S=Mb(H|0,L|0,o|0,h|0)|0;K=D;m=Mb(b|0,w|0,O|0,u|0)|0;u=Ab(m|0,D|0,S|0,K|0)|0;K=Db(u|0,D|0,1)|0;u=Ab(K|0,D|0,k|0,A|0)|0;A=Db(u|0,D|0,1)|0;u=Ab(A|0,D|0,x|0,I|0)|0;I=D;x=e+96|0;c[x>>2]=u;c[x+4>>2]=I;x=yb(0,c[f>>2]|0,32)|0;f=D;A=Mb(H|0,L|0,x|0,f|0)|0;L=D;H=Mb(Q|0,R|0,o|0,h|0)|0;h=Ab(H|0,D|0,A|0,L|0)|0;L=D;A=Mb(b|0,w|0,y|0,q|0)|0;q=Ab(h|0,L|0,A|0,D|0)|0;A=D;L=Db(q|0,A|0,1)|0;h=D;y=e+104|0;c[y>>2]=L;c[y+4>>2]=h;y=c[l>>2]|0;l=yb(0,y|0,32)|0;H=D;o=Mb(l|0,H|0,l|0,H|0)|0;k=D;K=Mb(Q|0,R|0,x|0,f|0)|0;R=Ab(K|0,D|0,o|0,k|0)|0;k=D;o=yb(0,B|0,31)|0;B=Mb(b|0,w|0,o|0,D|0)|0;o=Ab(R|0,k|0,B|0,D|0)|0;B=D;k=Db(o|0,B|0,1)|0;R=D;K=e+112|0;c[K>>2]=k;c[K+4>>2]=R;K=c[P>>2]|0;P=yb(0,K|0,32)|0;Q=D;S=Mb(P|0,Q|0,l|0,H|0)|0;H=D;l=Mb(b|0,w|0,x|0,f|0)|0;f=Ab(l|0,D|0,S|0,H|0)|0;H=D;S=Db(f|0,H|0,1)|0;l=D;x=e+120|0;c[x>>2]=S;c[x+4>>2]=l;x=Mb(P|0,Q|0,P|0,Q|0)|0;Q=D;P=yb(0,y|0,30)|0;y=Mb(b|0,w|0,P|0,D|0)|0;P=Ab(y|0,D|0,x|0,Q|0)|0;Q=D;x=e+128|0;c[x>>2]=P;c[x+4>>2]=Q;x=yb(0,K|0,31)|0;K=Mb(b|0,w|0,x|0,D|0)|0;x=D;y=e+136|0;c[y>>2]=K;c[y+4>>2]=x;y=yb(0,n|0,31)|0;n=Mb(y|0,D|0,b|0,w|0)|0;w=D;b=e+144|0;c[b>>2]=n;c[b+4>>2]=w;b=M;y=c[b>>2]|0;m=c[b+4>>2]|0;b=Mb(n|0,w|0,18,0)|0;O=D;g=Ab(n|0,w|0,y|0,m|0)|0;m=Ab(g|0,D|0,b|0,O|0)|0;O=M;c[O>>2]=m;c[O+4>>2]=D;O=N;m=c[O>>2]|0;b=c[O+4>>2]|0;O=Mb(K|0,x|0,18,0)|0;g=D;y=Ab(m|0,b|0,K|0,x|0)|0;x=Ab(y|0,D|0,O|0,g|0)|0;g=N;c[g>>2]=x;c[g+4>>2]=D;g=F;x=c[g>>2]|0;O=c[g+4>>2]|0;g=Mb(P|0,Q|0,18,0)|0;y=D;K=Ab(x|0,O|0,P|0,Q|0)|0;Q=Ab(K|0,D|0,g|0,y|0)|0;y=F;c[y>>2]=Q;c[y+4>>2]=D;y=G;Q=c[y>>2]|0;g=c[y+4>>2]|0;y=Mb(f|0,H|0,36,0)|0;H=D;f=Ab(Q|0,g|0,S|0,l|0)|0;l=Ab(f|0,D|0,y|0,H|0)|0;H=D;y=C;f=c[y>>2]|0;S=c[y+4>>2]|0;y=Mb(o|0,B|0,36,0)|0;B=D;o=Ab(f|0,S|0,k|0,R|0)|0;R=Ab(o|0,D|0,y|0,B|0)|0;B=D;y=z;o=c[y>>2]|0;k=c[y+4>>2]|0;y=Mb(q|0,A|0,36,0)|0;A=D;q=Ab(o|0,k|0,L|0,h|0)|0;h=Ab(q|0,D|0,y|0,A|0)|0;A=D;y=v;q=c[y>>2]|0;L=c[y+4>>2]|0;y=Mb(u|0,I|0,18,0)|0;k=D;o=Ab(q|0,L|0,u|0,I|0)|0;I=Ab(o|0,D|0,y|0,k|0)|0;k=D;y=p;o=c[y>>2]|0;u=c[y+4>>2]|0;y=Mb(r|0,E|0,36,0)|0;E=D;r=Ab(o|0,u|0,s|0,J|0)|0;J=Ab(r|0,D|0,y|0,E|0)|0;E=D;y=j;r=c[y>>2]|0;s=c[y+4>>2]|0;y=e;u=c[y>>2]|0;o=c[y+4>>2]|0;y=Mb(r|0,s|0,18,0)|0;L=D;q=Ab(u|0,o|0,r|0,s|0)|0;s=Ab(q|0,D|0,y|0,L|0)|0;L=D;y=j;c[y>>2]=0;c[y+4>>2]=0;y=Ab(L>>31>>>6|0,0,s|0,L|0)|0;q=yb(y|0,D|0,26)|0;y=D;r=Db(q|0,y|0,26)|0;o=zb(s|0,L|0,r|0,D|0)|0;r=e;c[r>>2]=o;c[r+4>>2]=D;r=Ab(q|0,y|0,J|0,E|0)|0;E=D;J=Ab(E>>31>>>7|0,0,r|0,E|0)|0;y=yb(J|0,D|0,25)|0;J=D;q=Db(y|0,J|0,25)|0;o=zb(r|0,E|0,q|0,D|0)|0;q=p;c[q>>2]=o;c[q+4>>2]=D;q=Ab(y|0,J|0,I|0,k|0)|0;k=D;I=Ab(k>>31>>>6|0,0,q|0,k|0)|0;J=yb(I|0,D|0,26)|0;I=D;y=Db(J|0,I|0,26)|0;o=zb(q|0,k|0,y|0,D|0)|0;y=v;c[y>>2]=o;c[y+4>>2]=D;y=Ab(J|0,I|0,h|0,A|0)|0;A=D;h=Ab(A>>31>>>7|0,0,y|0,A|0)|0;I=yb(h|0,D|0,25)|0;h=D;J=Db(I|0,h|0,25)|0;o=zb(y|0,A|0,J|0,D|0)|0;J=z;c[J>>2]=o;c[J+4>>2]=D;J=Ab(I|0,h|0,R|0,B|0)|0;B=D;R=Ab(B>>31>>>6|0,0,J|0,B|0)|0;h=yb(R|0,D|0,26)|0;R=D;I=Db(h|0,R|0,26)|0;o=zb(J|0,B|0,I|0,D|0)|0;I=C;c[I>>2]=o;c[I+4>>2]=D;I=Ab(h|0,R|0,l|0,H|0)|0;H=D;l=Ab(H>>31>>>7|0,0,I|0,H|0)|0;R=yb(l|0,D|0,25)|0;l=D;h=Db(R|0,l|0,25)|0;o=zb(I|0,H|0,h|0,D|0)|0;h=G;c[h>>2]=o;c[h+4>>2]=D;h=F;o=Ab(R|0,l|0,c[h>>2]|0,c[h+4>>2]|0)|0;h=D;l=Ab(h>>31>>>6|0,0,o|0,h|0)|0;R=yb(l|0,D|0,26)|0;l=D;G=Db(R|0,l|0,26)|0;H=zb(o|0,h|0,G|0,D|0)|0;G=F;c[G>>2]=H;c[G+4>>2]=D;G=N;H=Ab(R|0,l|0,c[G>>2]|0,c[G+4>>2]|0)|0;G=D;l=Ab(G>>31>>>7|0,0,H|0,G|0)|0;R=yb(l|0,D|0,25)|0;l=D;F=Db(R|0,l|0,25)|0;h=zb(H|0,G|0,F|0,D|0)|0;F=N;c[F>>2]=h;c[F+4>>2]=D;F=M;h=Ab(R|0,l|0,c[F>>2]|0,c[F+4>>2]|0)|0;F=D;l=Ab(F>>31>>>6|0,0,h|0,F|0)|0;R=yb(l|0,D|0,26)|0;l=D;N=Db(R|0,l|0,26)|0;G=zb(h|0,F|0,N|0,D|0)|0;N=M;c[N>>2]=G;c[N+4>>2]=D;N=t;G=Ab(R|0,l|0,c[N>>2]|0,c[N+4>>2]|0)|0;N=D;l=Ab(N>>31>>>7|0,0,G|0,N|0)|0;R=yb(l|0,D|0,25)|0;l=D;M=Db(R|0,l|0,25)|0;F=zb(G|0,N|0,M|0,D|0)|0;M=t;c[M>>2]=F;c[M+4>>2]=D;M=j;F=Ab(R|0,l|0,c[M>>2]|0,c[M+4>>2]|0)|0;M=D;l=e;R=c[l>>2]|0;t=c[l+4>>2]|0;l=Mb(F|0,M|0,18,0)|0;N=D;G=Ab(R|0,t|0,F|0,M|0)|0;M=Ab(G|0,D|0,l|0,N|0)|0;N=D;l=j;c[l>>2]=0;c[l+4>>2]=0;l=Ab(N>>31>>>6|0,0,M|0,N|0)|0;j=yb(l|0,D|0,26)|0;l=D;G=Db(j|0,l|0,26)|0;F=zb(M|0,N|0,G|0,D|0)|0;G=e;c[G>>2]=F;c[G+4>>2]=D;G=p;F=Ab(j|0,l|0,c[G>>2]|0,c[G+4>>2]|0)|0;G=p;c[G>>2]=F;c[G+4>>2]=D;G=a+0|0;a=e+0|0;e=G+80|0;do{c[G>>2]=c[a>>2];G=G+4|0;a=a+4|0}while((G|0)<(e|0));i=d;return}function Ea(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0,h=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0,E=0,F=0;e=i;i=i+160|0;f=e;Ca(f,b,d);d=f+144|0;b=c[d>>2]|0;g=c[d+4>>2]|0;d=f+64|0;h=d;j=c[h>>2]|0;k=c[h+4>>2]|0;h=Mb(b|0,g|0,18,0)|0;l=D;m=Ab(j|0,k|0,b|0,g|0)|0;g=Ab(m|0,D|0,h|0,l|0)|0;l=d;c[l>>2]=g;c[l+4>>2]=D;l=f+136|0;g=c[l>>2]|0;h=c[l+4>>2]|0;l=f+56|0;m=l;b=c[m>>2]|0;k=c[m+4>>2]|0;m=Mb(g|0,h|0,18,0)|0;j=D;n=Ab(b|0,k|0,g|0,h|0)|0;h=Ab(n|0,D|0,m|0,j|0)|0;j=l;c[j>>2]=h;c[j+4>>2]=D;j=f+128|0;h=c[j>>2]|0;m=c[j+4>>2]|0;j=f+48|0;n=j;g=c[n>>2]|0;k=c[n+4>>2]|0;n=Mb(h|0,m|0,18,0)|0;b=D;o=Ab(g|0,k|0,h|0,m|0)|0;m=Ab(o|0,D|0,n|0,b|0)|0;b=j;c[b>>2]=m;c[b+4>>2]=D;b=f+120|0;m=c[b>>2]|0;n=c[b+4>>2]|0;b=f+40|0;o=b;h=c[o>>2]|0;k=c[o+4>>2]|0;o=Mb(m|0,n|0,18,0)|0;g=D;p=Ab(h|0,k|0,m|0,n|0)|0;n=Ab(p|0,D|0,o|0,g|0)|0;g=D;o=b;c[o>>2]=n;c[o+4>>2]=g;o=f+112|0;p=c[o>>2]|0;m=c[o+4>>2]|0;o=f+32|0;k=o;h=c[k>>2]|0;q=c[k+4>>2]|0;k=Mb(p|0,m|0,18,0)|0;r=D;s=Ab(h|0,q|0,p|0,m|0)|0;m=Ab(s|0,D|0,k|0,r|0)|0;r=D;k=f+104|0;s=c[k>>2]|0;p=c[k+4>>2]|0;k=f+24|0;q=k;h=c[q>>2]|0;t=c[q+4>>2]|0;q=Mb(s|0,p|0,18,0)|0;u=D;v=Ab(h|0,t|0,s|0,p|0)|0;p=Ab(v|0,D|0,q|0,u|0)|0;u=D;q=f+96|0;v=c[q>>2]|0;s=c[q+4>>2]|0;q=f+16|0;t=q;h=c[t>>2]|0;w=c[t+4>>2]|0;t=Mb(v|0,s|0,18,0)|0;x=D;y=Ab(h|0,w|0,v|0,s|0)|0;s=Ab(y|0,D|0,t|0,x|0)|0;x=D;t=f+88|0;y=c[t>>2]|0;v=c[t+4>>2]|0;t=f+8|0;w=t;h=c[w>>2]|0;z=c[w+4>>2]|0;w=Mb(y|0,v|0,18,0)|0;A=D;B=Ab(h|0,z|0,y|0,v|0)|0;v=Ab(B|0,D|0,w|0,A|0)|0;A=D;w=f+80|0;B=w;y=c[B>>2]|0;z=c[B+4>>2]|0;B=f;h=c[B>>2]|0;C=c[B+4>>2]|0;B=Mb(y|0,z|0,18,0)|0;E=D;F=Ab(h|0,C|0,y|0,z|0)|0;z=Ab(F|0,D|0,B|0,E|0)|0;E=D;B=w;c[B>>2]=0;c[B+4>>2]=0;B=Ab(E>>31>>>6|0,0,z|0,E|0)|0;F=yb(B|0,D|0,26)|0;B=D;y=Db(F|0,B|0,26)|0;C=zb(z|0,E|0,y|0,D|0)|0;y=f;c[y>>2]=C;c[y+4>>2]=D;y=Ab(F|0,B|0,v|0,A|0)|0;A=D;v=Ab(A>>31>>>7|0,0,y|0,A|0)|0;B=yb(v|0,D|0,25)|0;v=D;F=Db(B|0,v|0,25)|0;C=zb(y|0,A|0,F|0,D|0)|0;F=t;c[F>>2]=C;c[F+4>>2]=D;F=Ab(B|0,v|0,s|0,x|0)|0;x=D;s=Ab(x>>31>>>6|0,0,F|0,x|0)|0;v=yb(s|0,D|0,26)|0;s=D;B=Db(v|0,s|0,26)|0;C=zb(F|0,x|0,B|0,D|0)|0;B=q;c[B>>2]=C;c[B+4>>2]=D;B=Ab(v|0,s|0,p|0,u|0)|0;u=D;p=Ab(u>>31>>>7|0,0,B|0,u|0)|0;s=yb(p|0,D|0,25)|0;p=D;v=Db(s|0,p|0,25)|0;C=zb(B|0,u|0,v|0,D|0)|0;v=k;c[v>>2]=C;c[v+4>>2]=D;v=Ab(s|0,p|0,m|0,r|0)|0;r=D;m=Ab(r>>31>>>6|0,0,v|0,r|0)|0;p=yb(m|0,D|0,26)|0;m=D;s=Db(p|0,m|0,26)|0;C=zb(v|0,r|0,s|0,D|0)|0;s=o;c[s>>2]=C;c[s+4>>2]=D;s=Ab(p|0,m|0,n|0,g|0)|0;g=D;n=Ab(g>>31>>>7|0,0,s|0,g|0)|0;m=yb(n|0,D|0,25)|0;n=D;p=Db(m|0,n|0,25)|0;C=zb(s|0,g|0,p|0,D|0)|0;p=b;c[p>>2]=C;c[p+4>>2]=D;p=j;C=Ab(m|0,n|0,c[p>>2]|0,c[p+4>>2]|0)|0;p=D;n=Ab(p>>31>>>6|0,0,C|0,p|0)|0;m=yb(n|0,D|0,26)|0;n=D;b=Db(m|0,n|0,26)|0;g=zb(C|0,p|0,b|0,D|0)|0;b=j;c[b>>2]=g;c[b+4>>2]=D;b=l;g=Ab(m|0,n|0,c[b>>2]|0,c[b+4>>2]|0)|0;b=D;n=Ab(b>>31>>>7|0,0,g|0,b|0)|0;m=yb(n|0,D|0,25)|0;n=D;j=Db(m|0,n|0,25)|0;p=zb(g|0,b|0,j|0,D|0)|0;j=l;c[j>>2]=p;c[j+4>>2]=D;j=d;p=Ab(m|0,n|0,c[j>>2]|0,c[j+4>>2]|0)|0;j=D;n=Ab(j>>31>>>6|0,0,p|0,j|0)|0;m=yb(n|0,D|0,26)|0;n=D;l=Db(m|0,n|0,26)|0;b=zb(p|0,j|0,l|0,D|0)|0;l=d;c[l>>2]=b;c[l+4>>2]=D;l=f+72|0;b=l;d=Ab(m|0,n|0,c[b>>2]|0,c[b+4>>2]|0)|0;b=D;n=Ab(b>>31>>>7|0,0,d|0,b|0)|0;m=yb(n|0,D|0,25)|0;n=D;j=Db(m|0,n|0,25)|0;p=zb(d|0,b|0,j|0,D|0)|0;j=l;c[j>>2]=p;c[j+4>>2]=D;j=w;p=Ab(m|0,n|0,c[j>>2]|0,c[j+4>>2]|0)|0;j=D;n=f;m=c[n>>2]|0;l=c[n+4>>2]|0;n=Mb(p|0,j|0,18,0)|0;b=D;d=Ab(m|0,l|0,p|0,j|0)|0;j=Ab(d|0,D|0,n|0,b|0)|0;b=D;n=w;c[n>>2]=0;c[n+4>>2]=0;n=Ab(b>>31>>>6|0,0,j|0,b|0)|0;w=yb(n|0,D|0,26)|0;n=D;d=Db(w|0,n|0,26)|0;p=zb(j|0,b|0,d|0,D|0)|0;d=f;c[d>>2]=p;c[d+4>>2]=D;d=t;p=Ab(w|0,n|0,c[d>>2]|0,c[d+4>>2]|0)|0;d=t;c[d>>2]=p;c[d+4>>2]=D;d=a+0|0;a=f+0|0;f=d+80|0;do{c[d>>2]=c[a>>2];d=d+4|0;a=a+4|0}while((d|0)<(f|0));i=e;return}function Fa(a){a=a|0;var b=0,d=0;b=i;d=a+0|0;a=d+40|0;do{c[d>>2]=0;d=d+4|0}while((d|0)<(a|0));i=b;return}function Ga(a){a=a|0;var b=0,d=0;b=i;c[a>>2]=1;d=a+4|0;a=d+36|0;do{c[d>>2]=0;d=d+4|0}while((d|0)<(a|0));i=b;return}function Ha(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0;e=(c[d+4>>2]|0)+(c[b+4>>2]|0)|0;f=(c[d+8>>2]|0)+(c[b+8>>2]|0)|0;g=(c[d+12>>2]|0)+(c[b+12>>2]|0)|0;h=(c[d+16>>2]|0)+(c[b+16>>2]|0)|0;i=(c[d+20>>2]|0)+(c[b+20>>2]|0)|0;j=(c[d+24>>2]|0)+(c[b+24>>2]|0)|0;k=(c[d+28>>2]|0)+(c[b+28>>2]|0)|0;l=(c[d+32>>2]|0)+(c[b+32>>2]|0)|0;m=(c[d+36>>2]|0)+(c[b+36>>2]|0)|0;c[a>>2]=(c[d>>2]|0)+(c[b>>2]|0);c[a+4>>2]=e;c[a+8>>2]=f;c[a+12>>2]=g;c[a+16>>2]=h;c[a+20>>2]=i;c[a+24>>2]=j;c[a+28>>2]=k;c[a+32>>2]=l;c[a+36>>2]=m;return}function Ia(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0;e=c[a>>2]|0;f=a+4|0;g=c[f>>2]|0;h=a+8|0;i=c[h>>2]|0;j=a+12|0;k=c[j>>2]|0;l=a+16|0;m=c[l>>2]|0;n=a+20|0;o=c[n>>2]|0;p=a+24|0;q=c[p>>2]|0;r=a+28|0;s=c[r>>2]|0;t=a+32|0;u=c[t>>2]|0;v=a+36|0;w=c[v>>2]|0;x=0-d|0;d=(c[b+4>>2]^g)&x;y=(c[b+8>>2]^i)&x;z=(c[b+12>>2]^k)&x;A=(c[b+16>>2]^m)&x;B=(c[b+20>>2]^o)&x;C=(c[b+24>>2]^q)&x;D=(c[b+28>>2]^s)&x;E=(c[b+32>>2]^u)&x;F=(c[b+36>>2]^w)&x;c[a>>2]=(c[b>>2]^e)&x^e;c[f>>2]=d^g;c[h>>2]=y^i;c[j>>2]=z^k;c[l>>2]=A^m;c[n>>2]=B^o;c[p>>2]=C^q;c[r>>2]=D^s;c[t>>2]=E^u;c[v>>2]=F^w;return}function Ja(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0;d=c[b+4>>2]|0;e=c[b+8>>2]|0;f=c[b+12>>2]|0;g=c[b+16>>2]|0;h=c[b+20>>2]|0;i=c[b+24>>2]|0;j=c[b+28>>2]|0;k=c[b+32>>2]|0;l=c[b+36>>2]|0;c[a>>2]=c[b>>2];c[a+4>>2]=d;c[a+8>>2]=e;c[a+12>>2]=f;c[a+16>>2]=g;c[a+20>>2]=h;c[a+24>>2]=i;c[a+28>>2]=j;c[a+32>>2]=k;c[a+36>>2]=l;return}function Ka(b,e){b=b|0;e=e|0;var f=0,g=0,h=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0;f=i;g=d[e>>0]|0;h=Db(d[e+1>>0]|0|0,0,8)|0;j=D;k=Db(d[e+2>>0]|0|0,0,16)|0;l=j|D;j=Db(d[e+3>>0]|0|0,0,24)|0;m=l|D;l=a[e+6>>0]|0;n=d[e+4>>0]|0;o=Db(d[e+5>>0]|0|0,0,8)|0;p=D;q=Db(l&255|0,0,16)|0;l=Db(o|n|q|0,p|D|0,6)|0;p=D;q=a[e+9>>0]|0;n=d[e+7>>0]|0;o=Db(d[e+8>>0]|0|0,0,8)|0;r=D;s=Db(q&255|0,0,16)|0;q=Db(o|n|s|0,r|D|0,5)|0;r=D;s=a[e+12>>0]|0;n=d[e+10>>0]|0;o=Db(d[e+11>>0]|0|0,0,8)|0;t=D;u=Db(s&255|0,0,16)|0;s=Db(o|n|u|0,t|D|0,3)|0;t=D;u=a[e+15>>0]|0;n=d[e+13>>0]|0;o=Db(d[e+14>>0]|0|0,0,8)|0;v=D;w=Db(u&255|0,0,16)|0;u=Db(o|n|w|0,v|D|0,2)|0;v=D;w=d[e+16>>0]|0;n=Db(d[e+17>>0]|0|0,0,8)|0;o=D;x=Db(d[e+18>>0]|0|0,0,16)|0;y=o|D;o=Db(d[e+19>>0]|0|0,0,24)|0;z=n|w|x|o;o=y|D;y=a[e+22>>0]|0;x=d[e+20>>0]|0;w=Db(d[e+21>>0]|0|0,0,8)|0;n=D;A=Db(y&255|0,0,16)|0;y=Db(w|x|A|0,n|D|0,7)|0;n=D;A=a[e+25>>0]|0;x=d[e+23>>0]|0;w=Db(d[e+24>>0]|0|0,0,8)|0;B=D;C=Db(A&255|0,0,16)|0;A=Db(w|x|C|0,B|D|0,5)|0;B=D;C=a[e+28>>0]|0;x=d[e+26>>0]|0;w=Db(d[e+27>>0]|0|0,0,8)|0;E=D;F=Db(C&255|0,0,16)|0;C=Db(w|x|F|0,E|D|0,4)|0;E=D;F=a[e+31>>0]|0;x=d[e+29>>0]|0;w=Db(d[e+30>>0]|0|0,0,8)|0;e=D;G=Db(F&255|0,0,16)|0;F=Db(w|x|G|0,e|D|0,2)|0;e=F&33554428;F=Ab(e|0,0,16777216,0)|0;G=Cb(F|0,D|0,25)|0;F=D;x=Mb(G|0,F|0,19,0)|0;w=Ab(x|0,D|0,h|g|k|j|0,m|0)|0;m=D;j=Db(G|0,F|0,25)|0;F=D;G=Ab(l|0,p|0,16777216,0)|0;k=Cb(G|0,D|0,25)|0;G=D;g=Ab(q|0,r|0,k|0,G|0)|0;r=D;q=Db(k|0,G|0,25)|0;G=zb(l|0,p|0,q|0,D|0)|0;q=D;p=Ab(s|0,t|0,16777216,0)|0;l=Cb(p|0,D|0,25)|0;p=D;k=Ab(u|0,v|0,l|0,p|0)|0;v=D;u=Db(l|0,p|0,25)|0;p=D;l=Ab(z|0,o|0,16777216,0)|0;h=Cb(l|0,D|0,25)|0;l=D;x=Ab(y|0,n|0,h|0,l|0)|0;n=D;y=Db(h|0,l|0,25)|0;l=D;h=Ab(A|0,B|0,16777216,0)|0;H=Cb(h|0,D|0,25)|0;h=D;I=Ab(C|0,E|0,H|0,h|0)|0;E=D;C=Db(H|0,h|0,25)|0;h=D;H=Ab(w|0,m|0,33554432,0)|0;J=yb(H|0,D|0,26)|0;H=D;K=Ab(G|0,q|0,J|0,H|0)|0;q=Db(J|0,H|0,26)|0;H=zb(w|0,m|0,q|0,D|0)|0;q=Ab(g|0,r|0,33554432,0)|0;m=yb(q|0,D|0,26)|0;q=D;w=Ab(m|0,q|0,s|0,t|0)|0;t=zb(w|0,D|0,u|0,p|0)|0;p=Db(m|0,q|0,26)|0;q=zb(g|0,r|0,p|0,D|0)|0;p=Ab(k|0,v|0,33554432,0)|0;r=yb(p|0,D|0,26)|0;p=D;g=Ab(r|0,p|0,z|0,o|0)|0;o=zb(g|0,D|0,y|0,l|0)|0;l=Db(r|0,p|0,26)|0;p=zb(k|0,v|0,l|0,D|0)|0;l=Ab(x|0,n|0,33554432,0)|0;v=yb(l|0,D|0,26)|0;l=D;k=Ab(v|0,l|0,A|0,B|0)|0;B=zb(k|0,D|0,C|0,h|0)|0;h=Db(v|0,l|0,26)|0;l=zb(x|0,n|0,h|0,D|0)|0;h=Ab(I|0,E|0,33554432,0)|0;n=yb(h|0,D|0,26)|0;h=D;x=Ab(e|0,0,n|0,h|0)|0;e=zb(x|0,D|0,j|0,F|0)|0;F=Db(n|0,h|0,26)|0;h=zb(I|0,E|0,F|0,D|0)|0;c[b>>2]=H;c[b+4>>2]=K;c[b+8>>2]=q;c[b+12>>2]=t;c[b+16>>2]=p;c[b+20>>2]=o;c[b+24>>2]=l;c[b+28>>2]=B;c[b+32>>2]=h;c[b+36>>2]=e;i=f;return}function La(a,b){a=a|0;b=b|0;var c=0,d=0,e=0,f=0,g=0;c=i;i=i+160|0;d=c+120|0;e=c+80|0;f=c+40|0;g=c;Ra(d,b);Ra(e,d);Ra(e,e);Oa(e,b,e);Oa(d,d,e);Ra(f,d);Oa(e,e,f);Ra(f,e);Ra(f,f);Ra(f,f);Ra(f,f);Ra(f,f);Oa(e,f,e);Ra(f,e);Ra(f,f);Ra(f,f);Ra(f,f);Ra(f,f);Ra(f,f);Ra(f,f);Ra(f,f);Ra(f,f);Ra(f,f);Oa(f,f,e);Ra(g,f);Ra(g,g);Ra(g,g);Ra(g,g);Ra(g,g);Ra(g,g);Ra(g,g);Ra(g,g);Ra(g,g);Ra(g,g);Ra(g,g);Ra(g,g);Ra(g,g);Ra(g,g);Ra(g,g);Ra(g,g);Ra(g,g);Ra(g,g);Ra(g,g);Ra(g,g);Oa(f,g,f);Ra(f,f);Ra(f,f);Ra(f,f);Ra(f,f);Ra(f,f);Ra(f,f);Ra(f,f);Ra(f,f);Ra(f,f);Ra(f,f);Oa(e,f,e);Ra(f,e);b=1;do{Ra(f,f);b=b+1|0}while((b|0)!=50);Oa(f,f,e);Ra(g,f);b=1;do{Ra(g,g);b=b+1|0}while((b|0)!=100);Oa(f,g,f);Ra(f,f);g=1;do{Ra(f,f);g=g+1|0}while((g|0)!=50);Oa(e,f,e);Ra(e,e);Ra(e,e);Ra(e,e);Ra(e,e);Ra(e,e);Oa(a,e,d);i=c;return}function Ma(a){a=a|0;var b=0,c=0;b=i;i=i+32|0;c=b;Ua(c,a);i=b;return (d[c>>0]|0)&1|0}function Na(a){a=a|0;var b=0,c=0;b=i;i=i+32|0;c=b;Ua(c,a);a=wa(c,8)|0;i=b;return a|0}function Oa(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0,h=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0,L=0,M=0,N=0,O=0,P=0,Q=0,R=0,S=0,T=0,U=0,V=0,W=0,X=0,Y=0,Z=0,_=0,$=0,aa=0,ba=0,ca=0,da=0,ea=0,fa=0,ga=0,ha=0,ia=0,ja=0,ka=0,la=0,ma=0,na=0,oa=0,pa=0,qa=0,ra=0,sa=0,ta=0,ua=0,va=0,wa=0,xa=0,ya=0,za=0,Aa=0,Ba=0,Ca=0,Da=0,Ea=0,Fa=0,Ga=0,Ha=0,Ia=0,Ja=0,Ka=0,La=0,Ma=0,Na=0,Oa=0,Pa=0,Qa=0,Ra=0,Sa=0,Ta=0,Ua=0,Va=0,Wa=0,Xa=0,Ya=0,Za=0,_a=0,$a=0,ab=0,bb=0,cb=0,db=0,eb=0,fb=0,gb=0,hb=0,ib=0,jb=0,kb=0,lb=0,mb=0,nb=0,ob=0,pb=0,qb=0,rb=0,sb=0,tb=0,ub=0,vb=0,wb=0,xb=0,Bb=0,Cb=0,Eb=0,Fb=0,Gb=0,Hb=0,Ib=0,Jb=0,Kb=0,Lb=0,Nb=0,Ob=0,Pb=0,Qb=0,Rb=0,Sb=0,Tb=0,Ub=0,Vb=0,Wb=0,Xb=0,Yb=0,Zb=0,_b=0,$b=0,ac=0,bc=0,cc=0,dc=0,ec=0,fc=0,gc=0,hc=0,ic=0,jc=0,kc=0,lc=0,mc=0,nc=0,oc=0,pc=0,qc=0,rc=0,sc=0,tc=0,uc=0,vc=0,wc=0,xc=0,yc=0,zc=0,Ac=0,Bc=0,Cc=0,Dc=0,Ec=0,Fc=0,Gc=0,Hc=0,Ic=0,Jc=0,Kc=0,Lc=0,Mc=0,Nc=0,Oc=0,Pc=0,Qc=0,Rc=0,Sc=0,Tc=0,Uc=0,Vc=0,Wc=0,Xc=0,Yc=0,Zc=0,_c=0;e=i;f=c[b>>2]|0;g=c[b+4>>2]|0;h=c[b+8>>2]|0;j=c[b+12>>2]|0;k=c[b+16>>2]|0;l=c[b+20>>2]|0;m=c[b+24>>2]|0;n=c[b+28>>2]|0;o=c[b+32>>2]|0;p=c[b+36>>2]|0;b=c[d>>2]|0;q=c[d+4>>2]|0;r=c[d+8>>2]|0;s=c[d+12>>2]|0;t=c[d+16>>2]|0;u=c[d+20>>2]|0;v=c[d+24>>2]|0;w=c[d+28>>2]|0;x=c[d+32>>2]|0;y=c[d+36>>2]|0;d=q*19|0;z=r*19|0;A=s*19|0;B=t*19|0;C=u*19|0;E=v*19|0;F=w*19|0;G=x*19|0;H=y*19|0;I=g<<1;J=j<<1;K=l<<1;L=n<<1;M=p<<1;N=((f|0)<0)<<31>>31;O=((b|0)<0)<<31>>31;P=Mb(b|0,O|0,f|0,N|0)|0;Q=D;R=((q|0)<0)<<31>>31;S=Mb(q|0,R|0,f|0,N|0)|0;T=D;U=((r|0)<0)<<31>>31;V=Mb(r|0,U|0,f|0,N|0)|0;W=D;X=((s|0)<0)<<31>>31;Y=Mb(s|0,X|0,f|0,N|0)|0;Z=D;_=((t|0)<0)<<31>>31;$=Mb(t|0,_|0,f|0,N|0)|0;aa=D;ba=((u|0)<0)<<31>>31;ca=Mb(u|0,ba|0,f|0,N|0)|0;da=D;ea=((v|0)<0)<<31>>31;fa=Mb(v|0,ea|0,f|0,N|0)|0;ga=D;ha=((w|0)<0)<<31>>31;ia=Mb(w|0,ha|0,f|0,N|0)|0;ja=D;ka=((x|0)<0)<<31>>31;la=Mb(x|0,ka|0,f|0,N|0)|0;ma=D;na=Mb(y|0,((y|0)<0)<<31>>31|0,f|0,N|0)|0;N=D;f=((g|0)<0)<<31>>31;y=Mb(b|0,O|0,g|0,f|0)|0;oa=D;pa=((I|0)<0)<<31>>31;qa=Mb(q|0,R|0,I|0,pa|0)|0;ra=D;sa=Mb(r|0,U|0,g|0,f|0)|0;ta=D;ua=Mb(s|0,X|0,I|0,pa|0)|0;va=D;wa=Mb(t|0,_|0,g|0,f|0)|0;xa=D;ya=Mb(u|0,ba|0,I|0,pa|0)|0;za=D;Aa=Mb(v|0,ea|0,g|0,f|0)|0;Ba=D;Ca=Mb(w|0,ha|0,I|0,pa|0)|0;Da=D;Ea=Mb(x|0,ka|0,g|0,f|0)|0;f=D;g=((H|0)<0)<<31>>31;ka=Mb(H|0,g|0,I|0,pa|0)|0;pa=D;I=((h|0)<0)<<31>>31;x=Mb(b|0,O|0,h|0,I|0)|0;Fa=D;Ga=Mb(q|0,R|0,h|0,I|0)|0;Ha=D;Ia=Mb(r|0,U|0,h|0,I|0)|0;Ja=D;Ka=Mb(s|0,X|0,h|0,I|0)|0;La=D;Ma=Mb(t|0,_|0,h|0,I|0)|0;Na=D;Oa=Mb(u|0,ba|0,h|0,I|0)|0;Pa=D;Qa=Mb(v|0,ea|0,h|0,I|0)|0;Ra=D;Sa=Mb(w|0,ha|0,h|0,I|0)|0;ha=D;w=((G|0)<0)<<31>>31;Ta=Mb(G|0,w|0,h|0,I|0)|0;Ua=D;Va=Mb(H|0,g|0,h|0,I|0)|0;I=D;h=((j|0)<0)<<31>>31;Wa=Mb(b|0,O|0,j|0,h|0)|0;Xa=D;Ya=((J|0)<0)<<31>>31;Za=Mb(q|0,R|0,J|0,Ya|0)|0;_a=D;$a=Mb(r|0,U|0,j|0,h|0)|0;ab=D;bb=Mb(s|0,X|0,J|0,Ya|0)|0;cb=D;db=Mb(t|0,_|0,j|0,h|0)|0;eb=D;fb=Mb(u|0,ba|0,J|0,Ya|0)|0;gb=D;hb=Mb(v|0,ea|0,j|0,h|0)|0;ea=D;v=((F|0)<0)<<31>>31;ib=Mb(F|0,v|0,J|0,Ya|0)|0;jb=D;kb=Mb(G|0,w|0,j|0,h|0)|0;h=D;j=Mb(H|0,g|0,J|0,Ya|0)|0;Ya=D;J=((k|0)<0)<<31>>31;lb=Mb(b|0,O|0,k|0,J|0)|0;mb=D;nb=Mb(q|0,R|0,k|0,J|0)|0;ob=D;pb=Mb(r|0,U|0,k|0,J|0)|0;qb=D;rb=Mb(s|0,X|0,k|0,J|0)|0;sb=D;tb=Mb(t|0,_|0,k|0,J|0)|0;ub=D;vb=Mb(u|0,ba|0,k|0,J|0)|0;ba=D;u=((E|0)<0)<<31>>31;wb=Mb(E|0,u|0,k|0,J|0)|0;xb=D;Bb=Mb(F|0,v|0,k|0,J|0)|0;Cb=D;Eb=Mb(G|0,w|0,k|0,J|0)|0;Fb=D;Gb=Mb(H|0,g|0,k|0,J|0)|0;J=D;k=((l|0)<0)<<31>>31;Hb=Mb(b|0,O|0,l|0,k|0)|0;Ib=D;Jb=((K|0)<0)<<31>>31;Kb=Mb(q|0,R|0,K|0,Jb|0)|0;Lb=D;Nb=Mb(r|0,U|0,l|0,k|0)|0;Ob=D;Pb=Mb(s|0,X|0,K|0,Jb|0)|0;Qb=D;Rb=Mb(t|0,_|0,l|0,k|0)|0;_=D;t=((C|0)<0)<<31>>31;Sb=Mb(C|0,t|0,K|0,Jb|0)|0;Tb=D;Ub=Mb(E|0,u|0,l|0,k|0)|0;Vb=D;Wb=Mb(F|0,v|0,K|0,Jb|0)|0;Xb=D;Yb=Mb(G|0,w|0,l|0,k|0)|0;k=D;l=Mb(H|0,g|0,K|0,Jb|0)|0;Jb=D;K=((m|0)<0)<<31>>31;Zb=Mb(b|0,O|0,m|0,K|0)|0;_b=D;$b=Mb(q|0,R|0,m|0,K|0)|0;ac=D;bc=Mb(r|0,U|0,m|0,K|0)|0;cc=D;dc=Mb(s|0,X|0,m|0,K|0)|0;X=D;s=((B|0)<0)<<31>>31;ec=Mb(B|0,s|0,m|0,K|0)|0;fc=D;gc=Mb(C|0,t|0,m|0,K|0)|0;hc=D;ic=Mb(E|0,u|0,m|0,K|0)|0;jc=D;kc=Mb(F|0,v|0,m|0,K|0)|0;lc=D;mc=Mb(G|0,w|0,m|0,K|0)|0;nc=D;oc=Mb(H|0,g|0,m|0,K|0)|0;K=D;m=((n|0)<0)<<31>>31;pc=Mb(b|0,O|0,n|0,m|0)|0;qc=D;rc=((L|0)<0)<<31>>31;sc=Mb(q|0,R|0,L|0,rc|0)|0;tc=D;uc=Mb(r|0,U|0,n|0,m|0)|0;U=D;r=((A|0)<0)<<31>>31;vc=Mb(A|0,r|0,L|0,rc|0)|0;wc=D;xc=Mb(B|0,s|0,n|0,m|0)|0;yc=D;zc=Mb(C|0,t|0,L|0,rc|0)|0;Ac=D;Bc=Mb(E|0,u|0,n|0,m|0)|0;Cc=D;Dc=Mb(F|0,v|0,L|0,rc|0)|0;Ec=D;Fc=Mb(G|0,w|0,n|0,m|0)|0;m=D;n=Mb(H|0,g|0,L|0,rc|0)|0;rc=D;L=((o|0)<0)<<31>>31;Gc=Mb(b|0,O|0,o|0,L|0)|0;Hc=D;Ic=Mb(q|0,R|0,o|0,L|0)|0;R=D;q=((z|0)<0)<<31>>31;Jc=Mb(z|0,q|0,o|0,L|0)|0;Kc=D;Lc=Mb(A|0,r|0,o|0,L|0)|0;Mc=D;Nc=Mb(B|0,s|0,o|0,L|0)|0;Oc=D;Pc=Mb(C|0,t|0,o|0,L|0)|0;Qc=D;Rc=Mb(E|0,u|0,o|0,L|0)|0;Sc=D;Tc=Mb(F|0,v|0,o|0,L|0)|0;Uc=D;Vc=Mb(G|0,w|0,o|0,L|0)|0;Wc=D;Xc=Mb(H|0,g|0,o|0,L|0)|0;L=D;o=((p|0)<0)<<31>>31;Yc=Mb(b|0,O|0,p|0,o|0)|0;O=D;b=((M|0)<0)<<31>>31;Zc=Mb(d|0,((d|0)<0)<<31>>31|0,M|0,b|0)|0;d=D;_c=Mb(z|0,q|0,p|0,o|0)|0;q=D;z=Mb(A|0,r|0,M|0,b|0)|0;r=D;A=Mb(B|0,s|0,p|0,o|0)|0;s=D;B=Mb(C|0,t|0,M|0,b|0)|0;t=D;C=Mb(E|0,u|0,p|0,o|0)|0;u=D;E=Mb(F|0,v|0,M|0,b|0)|0;v=D;F=Mb(G|0,w|0,p|0,o|0)|0;o=D;p=Mb(H|0,g|0,M|0,b|0)|0;b=D;M=Ab(Zc|0,d|0,P|0,Q|0)|0;Q=Ab(M|0,D|0,Jc|0,Kc|0)|0;Kc=Ab(Q|0,D|0,vc|0,wc|0)|0;wc=Ab(Kc|0,D|0,ec|0,fc|0)|0;fc=Ab(wc|0,D|0,Sb|0,Tb|0)|0;Tb=Ab(fc|0,D|0,wb|0,xb|0)|0;xb=Ab(Tb|0,D|0,ib|0,jb|0)|0;jb=Ab(xb|0,D|0,Ta|0,Ua|0)|0;Ua=Ab(jb|0,D|0,ka|0,pa|0)|0;pa=D;ka=Ab(S|0,T|0,y|0,oa|0)|0;oa=D;y=Ab(Za|0,_a|0,lb|0,mb|0)|0;mb=Ab(y|0,D|0,Ia|0,Ja|0)|0;Ja=Ab(mb|0,D|0,ua|0,va|0)|0;va=Ab(Ja|0,D|0,$|0,aa|0)|0;aa=Ab(va|0,D|0,B|0,t|0)|0;t=Ab(aa|0,D|0,Rc|0,Sc|0)|0;Sc=Ab(t|0,D|0,Dc|0,Ec|0)|0;Ec=Ab(Sc|0,D|0,mc|0,nc|0)|0;nc=Ab(Ec|0,D|0,l|0,Jb|0)|0;Jb=D;l=Ab(Ua|0,pa|0,33554432,0)|0;Ec=yb(l|0,D|0,26)|0;l=D;mc=Ab(ka|0,oa|0,_c|0,q|0)|0;q=Ab(mc|0,D|0,Lc|0,Mc|0)|0;Mc=Ab(q|0,D|0,xc|0,yc|0)|0;yc=Ab(Mc|0,D|0,gc|0,hc|0)|0;hc=Ab(yc|0,D|0,Ub|0,Vb|0)|0;Vb=Ab(hc|0,D|0,Bb|0,Cb|0)|0;Cb=Ab(Vb|0,D|0,kb|0,h|0)|0;h=Ab(Cb|0,D|0,Va|0,I|0)|0;I=Ab(h|0,D|0,Ec|0,l|0)|0;h=D;Va=Db(Ec|0,l|0,26)|0;l=zb(Ua|0,pa|0,Va|0,D|0)|0;Va=D;pa=Ab(nc|0,Jb|0,33554432,0)|0;Ua=yb(pa|0,D|0,26)|0;pa=D;Ec=Ab(nb|0,ob|0,Hb|0,Ib|0)|0;Ib=Ab(Ec|0,D|0,$a|0,ab|0)|0;ab=Ab(Ib|0,D|0,Ka|0,La|0)|0;La=Ab(ab|0,D|0,wa|0,xa|0)|0;xa=Ab(La|0,D|0,ca|0,da|0)|0;da=Ab(xa|0,D|0,C|0,u|0)|0;u=Ab(da|0,D|0,Tc|0,Uc|0)|0;Uc=Ab(u|0,D|0,Fc|0,m|0)|0;m=Ab(Uc|0,D|0,oc|0,K|0)|0;K=Ab(m|0,D|0,Ua|0,pa|0)|0;m=D;oc=Db(Ua|0,pa|0,26)|0;pa=zb(nc|0,Jb|0,oc|0,D|0)|0;oc=D;Jb=Ab(I|0,h|0,16777216,0)|0;nc=yb(Jb|0,D|0,25)|0;Jb=D;Ua=Ab(qa|0,ra|0,x|0,Fa|0)|0;Fa=Ab(Ua|0,D|0,V|0,W|0)|0;W=Ab(Fa|0,D|0,z|0,r|0)|0;r=Ab(W|0,D|0,Nc|0,Oc|0)|0;Oc=Ab(r|0,D|0,zc|0,Ac|0)|0;Ac=Ab(Oc|0,D|0,ic|0,jc|0)|0;jc=Ab(Ac|0,D|0,Wb|0,Xb|0)|0;Xb=Ab(jc|0,D|0,Eb|0,Fb|0)|0;Fb=Ab(Xb|0,D|0,j|0,Ya|0)|0;Ya=Ab(Fb|0,D|0,nc|0,Jb|0)|0;Fb=D;j=Db(nc|0,Jb|0,25)|0;Jb=zb(I|0,h|0,j|0,D|0)|0;j=D;h=Ab(K|0,m|0,16777216,0)|0;I=yb(h|0,D|0,25)|0;h=D;nc=Ab(Kb|0,Lb|0,Zb|0,_b|0)|0;_b=Ab(nc|0,D|0,pb|0,qb|0)|0;qb=Ab(_b|0,D|0,bb|0,cb|0)|0;cb=Ab(qb|0,D|0,Ma|0,Na|0)|0;Na=Ab(cb|0,D|0,ya|0,za|0)|0;za=Ab(Na|0,D|0,fa|0,ga|0)|0;ga=Ab(za|0,D|0,E|0,v|0)|0;v=Ab(ga|0,D|0,Vc|0,Wc|0)|0;Wc=Ab(v|0,D|0,n|0,rc|0)|0;rc=Ab(Wc|0,D|0,I|0,h|0)|0;Wc=D;n=Db(I|0,h|0,25)|0;h=zb(K|0,m|0,n|0,D|0)|0;n=D;m=Ab(Ya|0,Fb|0,33554432,0)|0;K=yb(m|0,D|0,26)|0;m=D;I=Ab(Ga|0,Ha|0,Wa|0,Xa|0)|0;Xa=Ab(I|0,D|0,sa|0,ta|0)|0;ta=Ab(Xa|0,D|0,Y|0,Z|0)|0;Z=Ab(ta|0,D|0,A|0,s|0)|0;s=Ab(Z|0,D|0,Pc|0,Qc|0)|0;Qc=Ab(s|0,D|0,Bc|0,Cc|0)|0;Cc=Ab(Qc|0,D|0,kc|0,lc|0)|0;lc=Ab(Cc|0,D|0,Yb|0,k|0)|0;k=Ab(lc|0,D|0,Gb|0,J|0)|0;J=Ab(k|0,D|0,K|0,m|0)|0;k=D;Gb=Db(K|0,m|0,26)|0;m=zb(Ya|0,Fb|0,Gb|0,D|0)|0;Gb=Ab(rc|0,Wc|0,33554432,0)|0;Fb=yb(Gb|0,D|0,26)|0;Gb=D;Ya=Ab($b|0,ac|0,pc|0,qc|0)|0;qc=Ab(Ya|0,D|0,Nb|0,Ob|0)|0;Ob=Ab(qc|0,D|0,rb|0,sb|0)|0;sb=Ab(Ob|0,D|0,db|0,eb|0)|0;eb=Ab(sb|0,D|0,Oa|0,Pa|0)|0;Pa=Ab(eb|0,D|0,Aa|0,Ba|0)|0;Ba=Ab(Pa|0,D|0,ia|0,ja|0)|0;ja=Ab(Ba|0,D|0,F|0,o|0)|0;o=Ab(ja|0,D|0,Xc|0,L|0)|0;L=Ab(o|0,D|0,Fb|0,Gb|0)|0;o=D;Xc=Db(Fb|0,Gb|0,26)|0;Gb=zb(rc|0,Wc|0,Xc|0,D|0)|0;Xc=Ab(J|0,k|0,16777216,0)|0;Wc=yb(Xc|0,D|0,25)|0;Xc=D;rc=Ab(Wc|0,Xc|0,pa|0,oc|0)|0;oc=D;pa=Db(Wc|0,Xc|0,25)|0;Xc=zb(J|0,k|0,pa|0,D|0)|0;pa=Ab(L|0,o|0,16777216,0)|0;k=yb(pa|0,D|0,25)|0;pa=D;J=Ab(sc|0,tc|0,Gc|0,Hc|0)|0;Hc=Ab(J|0,D|0,bc|0,cc|0)|0;cc=Ab(Hc|0,D|0,Pb|0,Qb|0)|0;Qb=Ab(cc|0,D|0,tb|0,ub|0)|0;ub=Ab(Qb|0,D|0,fb|0,gb|0)|0;gb=Ab(ub|0,D|0,Qa|0,Ra|0)|0;Ra=Ab(gb|0,D|0,Ca|0,Da|0)|0;Da=Ab(Ra|0,D|0,la|0,ma|0)|0;ma=Ab(Da|0,D|0,p|0,b|0)|0;b=Ab(ma|0,D|0,k|0,pa|0)|0;ma=D;p=Db(k|0,pa|0,25)|0;pa=zb(L|0,o|0,p|0,D|0)|0;p=Ab(rc|0,oc|0,33554432,0)|0;o=yb(p|0,D|0,26)|0;p=D;L=Ab(h|0,n|0,o|0,p|0)|0;n=Db(o|0,p|0,26)|0;p=zb(rc|0,oc|0,n|0,D|0)|0;n=Ab(b|0,ma|0,33554432,0)|0;oc=yb(n|0,D|0,26)|0;n=D;rc=Ab(Ic|0,R|0,Yc|0,O|0)|0;O=Ab(rc|0,D|0,uc|0,U|0)|0;U=Ab(O|0,D|0,dc|0,X|0)|0;X=Ab(U|0,D|0,Rb|0,_|0)|0;_=Ab(X|0,D|0,vb|0,ba|0)|0;ba=Ab(_|0,D|0,hb|0,ea|0)|0;ea=Ab(ba|0,D|0,Sa|0,ha|0)|0;ha=Ab(ea|0,D|0,Ea|0,f|0)|0;f=Ab(ha|0,D|0,na|0,N|0)|0;N=Ab(f|0,D|0,oc|0,n|0)|0;f=D;na=Db(oc|0,n|0,26)|0;n=zb(b|0,ma|0,na|0,D|0)|0;na=Ab(N|0,f|0,16777216,0)|0;ma=yb(na|0,D|0,25)|0;na=D;b=Mb(ma|0,na|0,19,0)|0;oc=Ab(b|0,D|0,l|0,Va|0)|0;Va=D;l=Db(ma|0,na|0,25)|0;na=zb(N|0,f|0,l|0,D|0)|0;l=Ab(oc|0,Va|0,33554432,0)|0;f=yb(l|0,D|0,26)|0;l=D;N=Ab(Jb|0,j|0,f|0,l|0)|0;j=Db(f|0,l|0,26)|0;l=zb(oc|0,Va|0,j|0,D|0)|0;c[a>>2]=l;c[a+4>>2]=N;c[a+8>>2]=m;c[a+12>>2]=Xc;c[a+16>>2]=p;c[a+20>>2]=L;c[a+24>>2]=Gb;c[a+28>>2]=pa;c[a+32>>2]=n;c[a+36>>2]=na;i=e;return}function Pa(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0;d=0-(c[b+4>>2]|0)|0;e=0-(c[b+8>>2]|0)|0;f=0-(c[b+12>>2]|0)|0;g=0-(c[b+16>>2]|0)|0;h=0-(c[b+20>>2]|0)|0;i=0-(c[b+24>>2]|0)|0;j=0-(c[b+28>>2]|0)|0;k=0-(c[b+32>>2]|0)|0;l=0-(c[b+36>>2]|0)|0;c[a>>2]=0-(c[b>>2]|0);c[a+4>>2]=d;c[a+8>>2]=e;c[a+12>>2]=f;c[a+16>>2]=g;c[a+20>>2]=h;c[a+24>>2]=i;c[a+28>>2]=j;c[a+32>>2]=k;c[a+36>>2]=l;return}function Qa(a,b){a=a|0;b=b|0;var c=0,d=0,e=0,f=0,g=0;c=i;i=i+128|0;d=c+80|0;e=c+40|0;f=c;Ra(d,b);Ra(e,d);Ra(e,e);Oa(e,b,e);Oa(d,d,e);Ra(d,d);Oa(d,e,d);Ra(e,d);Ra(e,e);Ra(e,e);Ra(e,e);Ra(e,e);Oa(d,e,d);Ra(e,d);Ra(e,e);Ra(e,e);Ra(e,e);Ra(e,e);Ra(e,e);Ra(e,e);Ra(e,e);Ra(e,e);Ra(e,e);Oa(e,e,d);Ra(f,e);Ra(f,f);Ra(f,f);Ra(f,f);Ra(f,f);Ra(f,f);Ra(f,f);Ra(f,f);Ra(f,f);Ra(f,f);Ra(f,f);Ra(f,f);Ra(f,f);Ra(f,f);Ra(f,f);Ra(f,f);Ra(f,f);Ra(f,f);Ra(f,f);Ra(f,f);Oa(e,f,e);Ra(e,e);Ra(e,e);Ra(e,e);Ra(e,e);Ra(e,e);Ra(e,e);Ra(e,e);Ra(e,e);Ra(e,e);Ra(e,e);Oa(d,e,d);Ra(e,d);g=1;do{Ra(e,e);g=g+1|0}while((g|0)!=50);Oa(e,e,d);Ra(f,e);g=1;do{Ra(f,f);g=g+1|0}while((g|0)!=100);Oa(e,f,e);Ra(e,e);f=1;do{Ra(e,e);f=f+1|0}while((f|0)!=50);Oa(d,e,d);Ra(d,d);Ra(d,d);Oa(a,d,b);i=c;return}function Ra(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0,L=0,M=0,N=0,O=0,P=0,Q=0,R=0,S=0,T=0,U=0,V=0,W=0,X=0,Y=0,Z=0,_=0,$=0,aa=0,ba=0,ca=0,da=0,ea=0,fa=0,ga=0,ha=0,ia=0,ja=0,ka=0,la=0,ma=0,na=0,oa=0,pa=0,qa=0,ra=0,sa=0,ta=0,ua=0,va=0,wa=0,xa=0,ya=0,za=0,Aa=0,Ba=0,Ca=0,Da=0,Ea=0,Fa=0,Ga=0,Ha=0,Ia=0,Ja=0,Ka=0,La=0,Ma=0,Na=0,Oa=0,Pa=0,Qa=0,Ra=0,Sa=0,Ta=0,Ua=0,Va=0,Wa=0,Xa=0,Ya=0,Za=0,_a=0,$a=0,ab=0,bb=0,cb=0,db=0,eb=0,fb=0,gb=0,hb=0,ib=0,jb=0;d=i;e=c[b>>2]|0;f=c[b+4>>2]|0;g=c[b+8>>2]|0;h=c[b+12>>2]|0;j=c[b+16>>2]|0;k=c[b+20>>2]|0;l=c[b+24>>2]|0;m=c[b+28>>2]|0;n=c[b+32>>2]|0;o=c[b+36>>2]|0;b=e<<1;p=f<<1;q=g<<1;r=h<<1;s=j<<1;t=k<<1;u=l<<1;v=m<<1;w=k*38|0;x=l*19|0;y=m*38|0;z=n*19|0;A=o*38|0;B=((e|0)<0)<<31>>31;C=Mb(e|0,B|0,e|0,B|0)|0;B=D;e=((b|0)<0)<<31>>31;E=((f|0)<0)<<31>>31;F=Mb(b|0,e|0,f|0,E|0)|0;G=D;H=((g|0)<0)<<31>>31;I=Mb(g|0,H|0,b|0,e|0)|0;J=D;K=((h|0)<0)<<31>>31;L=Mb(h|0,K|0,b|0,e|0)|0;M=D;N=((j|0)<0)<<31>>31;O=Mb(j|0,N|0,b|0,e|0)|0;P=D;Q=((k|0)<0)<<31>>31;R=Mb(k|0,Q|0,b|0,e|0)|0;S=D;T=((l|0)<0)<<31>>31;U=Mb(l|0,T|0,b|0,e|0)|0;V=D;W=((m|0)<0)<<31>>31;X=Mb(m|0,W|0,b|0,e|0)|0;Y=D;Z=((n|0)<0)<<31>>31;_=Mb(n|0,Z|0,b|0,e|0)|0;$=D;aa=((o|0)<0)<<31>>31;ba=Mb(o|0,aa|0,b|0,e|0)|0;e=D;b=((p|0)<0)<<31>>31;ca=Mb(p|0,b|0,f|0,E|0)|0;E=D;f=Mb(p|0,b|0,g|0,H|0)|0;da=D;ea=((r|0)<0)<<31>>31;fa=Mb(r|0,ea|0,p|0,b|0)|0;ga=D;ha=Mb(j|0,N|0,p|0,b|0)|0;ia=D;ja=((t|0)<0)<<31>>31;ka=Mb(t|0,ja|0,p|0,b|0)|0;la=D;ma=Mb(l|0,T|0,p|0,b|0)|0;na=D;oa=((v|0)<0)<<31>>31;pa=Mb(v|0,oa|0,p|0,b|0)|0;qa=D;ra=Mb(n|0,Z|0,p|0,b|0)|0;sa=D;ta=((A|0)<0)<<31>>31;ua=Mb(A|0,ta|0,p|0,b|0)|0;b=D;p=Mb(g|0,H|0,g|0,H|0)|0;va=D;wa=((q|0)<0)<<31>>31;xa=Mb(q|0,wa|0,h|0,K|0)|0;ya=D;za=Mb(j|0,N|0,q|0,wa|0)|0;Aa=D;Ba=Mb(k|0,Q|0,q|0,wa|0)|0;Ca=D;Da=Mb(l|0,T|0,q|0,wa|0)|0;Ea=D;Fa=Mb(m|0,W|0,q|0,wa|0)|0;Ga=D;Ha=((z|0)<0)<<31>>31;Ia=Mb(z|0,Ha|0,q|0,wa|0)|0;wa=D;q=Mb(A|0,ta|0,g|0,H|0)|0;H=D;g=Mb(r|0,ea|0,h|0,K|0)|0;K=D;h=Mb(r|0,ea|0,j|0,N|0)|0;Ja=D;Ka=Mb(t|0,ja|0,r|0,ea|0)|0;La=D;Ma=Mb(l|0,T|0,r|0,ea|0)|0;Na=D;Oa=((y|0)<0)<<31>>31;Pa=Mb(y|0,Oa|0,r|0,ea|0)|0;Qa=D;Ra=Mb(z|0,Ha|0,r|0,ea|0)|0;Sa=D;Ta=Mb(A|0,ta|0,r|0,ea|0)|0;ea=D;r=Mb(j|0,N|0,j|0,N|0)|0;Ua=D;Va=((s|0)<0)<<31>>31;Wa=Mb(s|0,Va|0,k|0,Q|0)|0;Xa=D;Ya=((x|0)<0)<<31>>31;Za=Mb(x|0,Ya|0,s|0,Va|0)|0;_a=D;$a=Mb(y|0,Oa|0,j|0,N|0)|0;ab=D;bb=Mb(z|0,Ha|0,s|0,Va|0)|0;Va=D;s=Mb(A|0,ta|0,j|0,N|0)|0;N=D;j=Mb(w|0,((w|0)<0)<<31>>31|0,k|0,Q|0)|0;Q=D;k=Mb(x|0,Ya|0,t|0,ja|0)|0;w=D;cb=Mb(y|0,Oa|0,t|0,ja|0)|0;db=D;eb=Mb(z|0,Ha|0,t|0,ja|0)|0;fb=D;gb=Mb(A|0,ta|0,t|0,ja|0)|0;ja=D;t=Mb(x|0,Ya|0,l|0,T|0)|0;Ya=D;x=Mb(y|0,Oa|0,l|0,T|0)|0;hb=D;ib=Mb(z|0,Ha|0,u|0,((u|0)<0)<<31>>31|0)|0;u=D;jb=Mb(A|0,ta|0,l|0,T|0)|0;T=D;l=Mb(y|0,Oa|0,m|0,W|0)|0;W=D;m=Mb(z|0,Ha|0,v|0,oa|0)|0;Oa=D;y=Mb(A|0,ta|0,v|0,oa|0)|0;oa=D;v=Mb(z|0,Ha|0,n|0,Z|0)|0;Ha=D;z=Mb(A|0,ta|0,n|0,Z|0)|0;Z=D;n=Mb(A|0,ta|0,o|0,aa|0)|0;aa=D;o=Ab(j|0,Q|0,C|0,B|0)|0;B=Ab(o|0,D|0,Za|0,_a|0)|0;_a=Ab(B|0,D|0,Pa|0,Qa|0)|0;Qa=Ab(_a|0,D|0,Ia|0,wa|0)|0;wa=Ab(Qa|0,D|0,ua|0,b|0)|0;b=D;ua=Ab(I|0,J|0,ca|0,E|0)|0;E=D;ca=Ab(L|0,M|0,f|0,da|0)|0;da=D;f=Ab(fa|0,ga|0,p|0,va|0)|0;va=Ab(f|0,D|0,O|0,P|0)|0;P=Ab(va|0,D|0,l|0,W|0)|0;W=Ab(P|0,D|0,ib|0,u|0)|0;u=Ab(W|0,D|0,gb|0,ja|0)|0;ja=D;gb=Ab(wa|0,b|0,33554432,0)|0;W=yb(gb|0,D|0,26)|0;gb=D;ib=Ab(k|0,w|0,F|0,G|0)|0;G=Ab(ib|0,D|0,$a|0,ab|0)|0;ab=Ab(G|0,D|0,Ra|0,Sa|0)|0;Sa=Ab(ab|0,D|0,q|0,H|0)|0;H=Ab(Sa|0,D|0,W|0,gb|0)|0;Sa=D;q=Db(W|0,gb|0,26)|0;gb=zb(wa|0,b|0,q|0,D|0)|0;q=D;b=Ab(u|0,ja|0,33554432,0)|0;wa=yb(b|0,D|0,26)|0;b=D;W=Ab(ha|0,ia|0,xa|0,ya|0)|0;ya=Ab(W|0,D|0,R|0,S|0)|0;S=Ab(ya|0,D|0,m|0,Oa|0)|0;Oa=Ab(S|0,D|0,jb|0,T|0)|0;T=Ab(Oa|0,D|0,wa|0,b|0)|0;Oa=D;jb=Db(wa|0,b|0,26)|0;b=zb(u|0,ja|0,jb|0,D|0)|0;jb=D;ja=Ab(H|0,Sa|0,16777216,0)|0;u=yb(ja|0,D|0,25)|0;ja=D;wa=Ab(ua|0,E|0,t|0,Ya|0)|0;Ya=Ab(wa|0,D|0,cb|0,db|0)|0;db=Ab(Ya|0,D|0,bb|0,Va|0)|0;Va=Ab(db|0,D|0,Ta|0,ea|0)|0;ea=Ab(Va|0,D|0,u|0,ja|0)|0;Va=D;Ta=Db(u|0,ja|0,25)|0;ja=zb(H|0,Sa|0,Ta|0,D|0)|0;Ta=D;Sa=Ab(T|0,Oa|0,16777216,0)|0;H=yb(Sa|0,D|0,25)|0;Sa=D;u=Ab(g|0,K|0,za|0,Aa|0)|0;Aa=Ab(u|0,D|0,ka|0,la|0)|0;la=Ab(Aa|0,D|0,U|0,V|0)|0;V=Ab(la|0,D|0,v|0,Ha|0)|0;Ha=Ab(V|0,D|0,y|0,oa|0)|0;oa=Ab(Ha|0,D|0,H|0,Sa|0)|0;Ha=D;y=Db(H|0,Sa|0,25)|0;Sa=zb(T|0,Oa|0,y|0,D|0)|0;y=D;Oa=Ab(ea|0,Va|0,33554432,0)|0;T=yb(Oa|0,D|0,26)|0;Oa=D;H=Ab(ca|0,da|0,x|0,hb|0)|0;hb=Ab(H|0,D|0,eb|0,fb|0)|0;fb=Ab(hb|0,D|0,s|0,N|0)|0;N=Ab(fb|0,D|0,T|0,Oa|0)|0;fb=D;s=Db(T|0,Oa|0,26)|0;Oa=zb(ea|0,Va|0,s|0,D|0)|0;s=Ab(oa|0,Ha|0,33554432,0)|0;Va=yb(s|0,D|0,26)|0;s=D;ea=Ab(Ba|0,Ca|0,h|0,Ja|0)|0;Ja=Ab(ea|0,D|0,ma|0,na|0)|0;na=Ab(Ja|0,D|0,X|0,Y|0)|0;Y=Ab(na|0,D|0,z|0,Z|0)|0;Z=Ab(Y|0,D|0,Va|0,s|0)|0;Y=D;z=Db(Va|0,s|0,26)|0;s=zb(oa|0,Ha|0,z|0,D|0)|0;z=Ab(N|0,fb|0,16777216,0)|0;Ha=yb(z|0,D|0,25)|0;z=D;oa=Ab(Ha|0,z|0,b|0,jb|0)|0;jb=D;b=Db(Ha|0,z|0,25)|0;z=zb(N|0,fb|0,b|0,D|0)|0;b=Ab(Z|0,Y|0,16777216,0)|0;fb=yb(b|0,D|0,25)|0;b=D;N=Ab(Da|0,Ea|0,r|0,Ua|0)|0;Ua=Ab(N|0,D|0,Ka|0,La|0)|0;La=Ab(Ua|0,D|0,pa|0,qa|0)|0;qa=Ab(La|0,D|0,_|0,$|0)|0;$=Ab(qa|0,D|0,n|0,aa|0)|0;aa=Ab($|0,D|0,fb|0,b|0)|0;$=D;n=Db(fb|0,b|0,25)|0;b=zb(Z|0,Y|0,n|0,D|0)|0;n=Ab(oa|0,jb|0,33554432,0)|0;Y=yb(n|0,D|0,26)|0;n=D;Z=Ab(Sa|0,y|0,Y|0,n|0)|0;y=Db(Y|0,n|0,26)|0;n=zb(oa|0,jb|0,y|0,D|0)|0;y=Ab(aa|0,$|0,33554432,0)|0;jb=yb(y|0,D|0,26)|0;y=D;oa=Ab(Ma|0,Na|0,Wa|0,Xa|0)|0;Xa=Ab(oa|0,D|0,Fa|0,Ga|0)|0;Ga=Ab(Xa|0,D|0,ra|0,sa|0)|0;sa=Ab(Ga|0,D|0,ba|0,e|0)|0;e=Ab(sa|0,D|0,jb|0,y|0)|0;sa=D;ba=Db(jb|0,y|0,26)|0;y=zb(aa|0,$|0,ba|0,D|0)|0;ba=Ab(e|0,sa|0,16777216,0)|0;$=yb(ba|0,D|0,25)|0;ba=D;aa=Mb($|0,ba|0,19,0)|0;jb=Ab(aa|0,D|0,gb|0,q|0)|0;q=D;gb=Db($|0,ba|0,25)|0;ba=zb(e|0,sa|0,gb|0,D|0)|0;gb=Ab(jb|0,q|0,33554432,0)|0;sa=yb(gb|0,D|0,26)|0;gb=D;e=Ab(ja|0,Ta|0,sa|0,gb|0)|0;Ta=Db(sa|0,gb|0,26)|0;gb=zb(jb|0,q|0,Ta|0,D|0)|0;c[a>>2]=gb;c[a+4>>2]=e;c[a+8>>2]=Oa;c[a+12>>2]=z;c[a+16>>2]=n;c[a+20>>2]=Z;c[a+24>>2]=s;c[a+28>>2]=b;c[a+32>>2]=y;c[a+36>>2]=ba;i=d;return}function Sa(a,b){a=a|0;b=b|0;var d=0,e=0,f=0,g=0,h=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0,L=0,M=0,N=0,O=0,P=0,Q=0,R=0,S=0,T=0,U=0,V=0,W=0,X=0,Y=0,Z=0,_=0,$=0,aa=0,ba=0,ca=0,da=0,ea=0,fa=0,ga=0,ha=0,ia=0,ja=0,ka=0,la=0,ma=0,na=0,oa=0,pa=0,qa=0,ra=0,sa=0,ta=0,ua=0,va=0,wa=0,xa=0,ya=0,za=0,Aa=0,Ba=0,Ca=0,Da=0,Ea=0,Fa=0,Ga=0,Ha=0,Ia=0,Ja=0,Ka=0,La=0,Ma=0,Na=0,Oa=0,Pa=0,Qa=0,Ra=0,Sa=0,Ta=0,Ua=0,Va=0,Wa=0,Xa=0,Ya=0,Za=0,_a=0,$a=0,ab=0,bb=0,cb=0,db=0,eb=0,fb=0,gb=0,hb=0,ib=0,jb=0;d=i;e=c[b>>2]|0;f=c[b+4>>2]|0;g=c[b+8>>2]|0;h=c[b+12>>2]|0;j=c[b+16>>2]|0;k=c[b+20>>2]|0;l=c[b+24>>2]|0;m=c[b+28>>2]|0;n=c[b+32>>2]|0;o=c[b+36>>2]|0;b=e<<1;p=f<<1;q=g<<1;r=h<<1;s=j<<1;t=k<<1;u=l<<1;v=m<<1;w=k*38|0;x=l*19|0;y=m*38|0;z=n*19|0;A=o*38|0;B=((e|0)<0)<<31>>31;C=Mb(e|0,B|0,e|0,B|0)|0;B=D;e=((b|0)<0)<<31>>31;E=((f|0)<0)<<31>>31;F=Mb(b|0,e|0,f|0,E|0)|0;G=D;H=((g|0)<0)<<31>>31;I=Mb(g|0,H|0,b|0,e|0)|0;J=D;K=((h|0)<0)<<31>>31;L=Mb(h|0,K|0,b|0,e|0)|0;M=D;N=((j|0)<0)<<31>>31;O=Mb(j|0,N|0,b|0,e|0)|0;P=D;Q=((k|0)<0)<<31>>31;R=Mb(k|0,Q|0,b|0,e|0)|0;S=D;T=((l|0)<0)<<31>>31;U=Mb(l|0,T|0,b|0,e|0)|0;V=D;W=((m|0)<0)<<31>>31;X=Mb(m|0,W|0,b|0,e|0)|0;Y=D;Z=((n|0)<0)<<31>>31;_=Mb(n|0,Z|0,b|0,e|0)|0;$=D;aa=((o|0)<0)<<31>>31;ba=Mb(o|0,aa|0,b|0,e|0)|0;e=D;b=((p|0)<0)<<31>>31;ca=Mb(p|0,b|0,f|0,E|0)|0;E=D;f=Mb(p|0,b|0,g|0,H|0)|0;da=D;ea=((r|0)<0)<<31>>31;fa=Mb(r|0,ea|0,p|0,b|0)|0;ga=D;ha=Mb(j|0,N|0,p|0,b|0)|0;ia=D;ja=((t|0)<0)<<31>>31;ka=Mb(t|0,ja|0,p|0,b|0)|0;la=D;ma=Mb(l|0,T|0,p|0,b|0)|0;na=D;oa=((v|0)<0)<<31>>31;pa=Mb(v|0,oa|0,p|0,b|0)|0;qa=D;ra=Mb(n|0,Z|0,p|0,b|0)|0;sa=D;ta=((A|0)<0)<<31>>31;ua=Mb(A|0,ta|0,p|0,b|0)|0;b=D;p=Mb(g|0,H|0,g|0,H|0)|0;va=D;wa=((q|0)<0)<<31>>31;xa=Mb(q|0,wa|0,h|0,K|0)|0;ya=D;za=Mb(j|0,N|0,q|0,wa|0)|0;Aa=D;Ba=Mb(k|0,Q|0,q|0,wa|0)|0;Ca=D;Da=Mb(l|0,T|0,q|0,wa|0)|0;Ea=D;Fa=Mb(m|0,W|0,q|0,wa|0)|0;Ga=D;Ha=((z|0)<0)<<31>>31;Ia=Mb(z|0,Ha|0,q|0,wa|0)|0;wa=D;q=Mb(A|0,ta|0,g|0,H|0)|0;H=D;g=Mb(r|0,ea|0,h|0,K|0)|0;K=D;h=Mb(r|0,ea|0,j|0,N|0)|0;Ja=D;Ka=Mb(t|0,ja|0,r|0,ea|0)|0;La=D;Ma=Mb(l|0,T|0,r|0,ea|0)|0;Na=D;Oa=((y|0)<0)<<31>>31;Pa=Mb(y|0,Oa|0,r|0,ea|0)|0;Qa=D;Ra=Mb(z|0,Ha|0,r|0,ea|0)|0;Sa=D;Ta=Mb(A|0,ta|0,r|0,ea|0)|0;ea=D;r=Mb(j|0,N|0,j|0,N|0)|0;Ua=D;Va=((s|0)<0)<<31>>31;Wa=Mb(s|0,Va|0,k|0,Q|0)|0;Xa=D;Ya=((x|0)<0)<<31>>31;Za=Mb(x|0,Ya|0,s|0,Va|0)|0;_a=D;$a=Mb(y|0,Oa|0,j|0,N|0)|0;ab=D;bb=Mb(z|0,Ha|0,s|0,Va|0)|0;Va=D;s=Mb(A|0,ta|0,j|0,N|0)|0;N=D;j=Mb(w|0,((w|0)<0)<<31>>31|0,k|0,Q|0)|0;Q=D;k=Mb(x|0,Ya|0,t|0,ja|0)|0;w=D;cb=Mb(y|0,Oa|0,t|0,ja|0)|0;db=D;eb=Mb(z|0,Ha|0,t|0,ja|0)|0;fb=D;gb=Mb(A|0,ta|0,t|0,ja|0)|0;ja=D;t=Mb(x|0,Ya|0,l|0,T|0)|0;Ya=D;x=Mb(y|0,Oa|0,l|0,T|0)|0;hb=D;ib=Mb(z|0,Ha|0,u|0,((u|0)<0)<<31>>31|0)|0;u=D;jb=Mb(A|0,ta|0,l|0,T|0)|0;T=D;l=Mb(y|0,Oa|0,m|0,W|0)|0;W=D;m=Mb(z|0,Ha|0,v|0,oa|0)|0;Oa=D;y=Mb(A|0,ta|0,v|0,oa|0)|0;oa=D;v=Mb(z|0,Ha|0,n|0,Z|0)|0;Ha=D;z=Mb(A|0,ta|0,n|0,Z|0)|0;Z=D;n=Mb(A|0,ta|0,o|0,aa|0)|0;aa=D;o=Ab(j|0,Q|0,C|0,B|0)|0;B=Ab(o|0,D|0,Za|0,_a|0)|0;_a=Ab(B|0,D|0,Pa|0,Qa|0)|0;Qa=Ab(_a|0,D|0,Ia|0,wa|0)|0;wa=Ab(Qa|0,D|0,ua|0,b|0)|0;b=D;ua=Ab(k|0,w|0,F|0,G|0)|0;G=Ab(ua|0,D|0,$a|0,ab|0)|0;ab=Ab(G|0,D|0,Ra|0,Sa|0)|0;Sa=Ab(ab|0,D|0,q|0,H|0)|0;H=D;q=Ab(I|0,J|0,ca|0,E|0)|0;E=Ab(q|0,D|0,t|0,Ya|0)|0;Ya=Ab(E|0,D|0,cb|0,db|0)|0;db=Ab(Ya|0,D|0,bb|0,Va|0)|0;Va=Ab(db|0,D|0,Ta|0,ea|0)|0;ea=D;Ta=Ab(L|0,M|0,f|0,da|0)|0;da=Ab(Ta|0,D|0,x|0,hb|0)|0;hb=Ab(da|0,D|0,eb|0,fb|0)|0;fb=Ab(hb|0,D|0,s|0,N|0)|0;N=D;s=Ab(fa|0,ga|0,p|0,va|0)|0;va=Ab(s|0,D|0,O|0,P|0)|0;P=Ab(va|0,D|0,l|0,W|0)|0;W=Ab(P|0,D|0,ib|0,u|0)|0;u=Ab(W|0,D|0,gb|0,ja|0)|0;ja=D;gb=Ab(ha|0,ia|0,xa|0,ya|0)|0;ya=Ab(gb|0,D|0,R|0,S|0)|0;S=Ab(ya|0,D|0,m|0,Oa|0)|0;Oa=Ab(S|0,D|0,jb|0,T|0)|0;T=D;jb=Ab(g|0,K|0,za|0,Aa|0)|0;Aa=Ab(jb|0,D|0,ka|0,la|0)|0;la=Ab(Aa|0,D|0,U|0,V|0)|0;V=Ab(la|0,D|0,v|0,Ha|0)|0;Ha=Ab(V|0,D|0,y|0,oa|0)|0;oa=D;y=Ab(Ba|0,Ca|0,h|0,Ja|0)|0;Ja=Ab(y|0,D|0,ma|0,na|0)|0;na=Ab(Ja|0,D|0,X|0,Y|0)|0;Y=Ab(na|0,D|0,z|0,Z|0)|0;Z=D;z=Ab(Da|0,Ea|0,r|0,Ua|0)|0;Ua=Ab(z|0,D|0,Ka|0,La|0)|0;La=Ab(Ua|0,D|0,pa|0,qa|0)|0;qa=Ab(La|0,D|0,_|0,$|0)|0;$=Ab(qa|0,D|0,n|0,aa|0)|0;aa=D;n=Ab(Ma|0,Na|0,Wa|0,Xa|0)|0;Xa=Ab(n|0,D|0,Fa|0,Ga|0)|0;Ga=Ab(Xa|0,D|0,ra|0,sa|0)|0;sa=Ab(Ga|0,D|0,ba|0,e|0)|0;e=D;ba=Db(wa|0,b|0,1)|0;b=D;wa=Db(Sa|0,H|0,1)|0;H=D;Sa=Db(Va|0,ea|0,1)|0;ea=D;Va=Db(fb|0,N|0,1)|0;N=D;fb=Db(u|0,ja|0,1)|0;ja=D;u=Db(Oa|0,T|0,1)|0;T=D;Oa=Db(Ha|0,oa|0,1)|0;oa=D;Ha=Db(Y|0,Z|0,1)|0;Z=D;Y=Db($|0,aa|0,1)|0;aa=D;$=Db(sa|0,e|0,1)|0;e=D;sa=Ab(ba|0,b|0,33554432,0)|0;Ga=yb(sa|0,D|0,26)|0;sa=D;ra=Ab(Ga|0,sa|0,wa|0,H|0)|0;H=D;wa=Db(Ga|0,sa|0,26)|0;sa=zb(ba|0,b|0,wa|0,D|0)|0;wa=D;b=Ab(fb|0,ja|0,33554432,0)|0;ba=yb(b|0,D|0,26)|0;b=D;Ga=Ab(ba|0,b|0,u|0,T|0)|0;T=D;u=Db(ba|0,b|0,26)|0;b=zb(fb|0,ja|0,u|0,D|0)|0;u=D;ja=Ab(ra|0,H|0,16777216,0)|0;fb=yb(ja|0,D|0,25)|0;ja=D;ba=Ab(fb|0,ja|0,Sa|0,ea|0)|0;ea=D;Sa=Db(fb|0,ja|0,25)|0;ja=zb(ra|0,H|0,Sa|0,D|0)|0;Sa=D;H=Ab(Ga|0,T|0,16777216,0)|0;ra=yb(H|0,D|0,25)|0;H=D;fb=Ab(ra|0,H|0,Oa|0,oa|0)|0;oa=D;Oa=Db(ra|0,H|0,25)|0;H=zb(Ga|0,T|0,Oa|0,D|0)|0;Oa=D;T=Ab(ba|0,ea|0,33554432,0)|0;Ga=yb(T|0,D|0,26)|0;T=D;ra=Ab(Ga|0,T|0,Va|0,N|0)|0;N=D;Va=Db(Ga|0,T|0,26)|0;T=zb(ba|0,ea|0,Va|0,D|0)|0;Va=Ab(fb|0,oa|0,33554432,0)|0;ea=yb(Va|0,D|0,26)|0;Va=D;ba=Ab(ea|0,Va|0,Ha|0,Z|0)|0;Z=D;Ha=Db(ea|0,Va|0,26)|0;Va=zb(fb|0,oa|0,Ha|0,D|0)|0;Ha=Ab(ra|0,N|0,16777216,0)|0;oa=yb(Ha|0,D|0,25)|0;Ha=D;fb=Ab(oa|0,Ha|0,b|0,u|0)|0;u=D;b=Db(oa|0,Ha|0,25)|0;Ha=zb(ra|0,N|0,b|0,D|0)|0;b=Ab(ba|0,Z|0,16777216,0)|0;N=yb(b|0,D|0,25)|0;b=D;ra=Ab(N|0,b|0,Y|0,aa|0)|0;aa=D;Y=Db(N|0,b|0,25)|0;b=zb(ba|0,Z|0,Y|0,D|0)|0;Y=Ab(fb|0,u|0,33554432,0)|0;Z=yb(Y|0,D|0,26)|0;Y=D;ba=Ab(H|0,Oa|0,Z|0,Y|0)|0;Oa=Db(Z|0,Y|0,26)|0;Y=zb(fb|0,u|0,Oa|0,D|0)|0;Oa=Ab(ra|0,aa|0,33554432,0)|0;u=yb(Oa|0,D|0,26)|0;Oa=D;fb=Ab(u|0,Oa|0,$|0,e|0)|0;e=D;$=Db(u|0,Oa|0,26)|0;Oa=zb(ra|0,aa|0,$|0,D|0)|0;$=Ab(fb|0,e|0,16777216,0)|0;aa=yb($|0,D|0,25)|0;$=D;ra=Mb(aa|0,$|0,19,0)|0;u=Ab(ra|0,D|0,sa|0,wa|0)|0;wa=D;sa=Db(aa|0,$|0,25)|0;$=zb(fb|0,e|0,sa|0,D|0)|0;sa=Ab(u|0,wa|0,33554432,0)|0;e=yb(sa|0,D|0,26)|0;sa=D;fb=Ab(ja|0,Sa|0,e|0,sa|0)|0;Sa=Db(e|0,sa|0,26)|0;sa=zb(u|0,wa|0,Sa|0,D|0)|0;c[a>>2]=sa;c[a+4>>2]=fb;c[a+8>>2]=T;c[a+12>>2]=Ha;c[a+16>>2]=Y;c[a+20>>2]=ba;c[a+24>>2]=Va;c[a+28>>2]=b;c[a+32>>2]=Oa;c[a+36>>2]=$;i=d;return}function Ta(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0;e=(c[b+4>>2]|0)-(c[d+4>>2]|0)|0;f=(c[b+8>>2]|0)-(c[d+8>>2]|0)|0;g=(c[b+12>>2]|0)-(c[d+12>>2]|0)|0;h=(c[b+16>>2]|0)-(c[d+16>>2]|0)|0;i=(c[b+20>>2]|0)-(c[d+20>>2]|0)|0;j=(c[b+24>>2]|0)-(c[d+24>>2]|0)|0;k=(c[b+28>>2]|0)-(c[d+28>>2]|0)|0;l=(c[b+32>>2]|0)-(c[d+32>>2]|0)|0;m=(c[b+36>>2]|0)-(c[d+36>>2]|0)|0;c[a>>2]=(c[b>>2]|0)-(c[d>>2]|0);c[a+4>>2]=e;c[a+8>>2]=f;c[a+12>>2]=g;c[a+16>>2]=h;c[a+20>>2]=i;c[a+24>>2]=j;c[a+28>>2]=k;c[a+32>>2]=l;c[a+36>>2]=m;return}function Ua(b,d){b=b|0;d=d|0;var e=0,f=0,g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0;e=c[d>>2]|0;f=c[d+4>>2]|0;g=c[d+8>>2]|0;h=c[d+12>>2]|0;i=c[d+16>>2]|0;j=c[d+20>>2]|0;k=c[d+24>>2]|0;l=c[d+28>>2]|0;m=c[d+32>>2]|0;n=c[d+36>>2]|0;d=(((((((((((((n*19|0)+16777216>>25)+e>>26)+f>>25)+g>>26)+h>>25)+i>>26)+j>>25)+k>>26)+l>>25)+m>>26)+n>>25)*19|0)+e|0;e=d>>26;o=e+f|0;f=d-(e<<26)|0;e=o>>25;d=e+g|0;g=o-(e<<25)|0;e=d>>26;o=e+h|0;h=d-(e<<26)|0;e=o>>25;d=e+i|0;i=o-(e<<25)|0;e=d>>26;o=e+j|0;j=d-(e<<26)|0;e=o>>25;d=e+k|0;k=o-(e<<25)|0;e=d>>26;o=e+l|0;l=d-(e<<26)|0;e=o>>25;d=e+m|0;m=o-(e<<25)|0;e=d>>26;o=e+n|0;n=d-(e<<26)|0;e=o&33554431;a[b>>0]=f;a[b+1>>0]=f>>>8;a[b+2>>0]=f>>>16;a[b+3>>0]=g<<2|f>>>24;a[b+4>>0]=g>>>6;a[b+5>>0]=g>>>14;a[b+6>>0]=h<<3|g>>>22;a[b+7>>0]=h>>>5;a[b+8>>0]=h>>>13;a[b+9>>0]=i<<5|h>>>21;a[b+10>>0]=i>>>3;a[b+11>>0]=i>>>11;a[b+12>>0]=j<<6|i>>>19;a[b+13>>0]=j>>>2;a[b+14>>0]=j>>>10;a[b+15>>0]=j>>>18;a[b+16>>0]=k;a[b+17>>0]=k>>>8;a[b+18>>0]=k>>>16;a[b+19>>0]=l<<1|k>>>24;a[b+20>>0]=l>>>7;a[b+21>>0]=l>>>15;a[b+22>>0]=m<<3|l>>>23;a[b+23>>0]=m>>>5;a[b+24>>0]=m>>>13;a[b+25>>0]=n<<4|m>>>21;a[b+26>>0]=n>>>4;a[b+27>>0]=n>>>12;a[b+28>>0]=n>>>20|e<<6;a[b+29>>0]=o>>>2;a[b+30>>0]=o>>>10;a[b+31>>0]=e>>>18;return}function Va(a,b,c){a=a|0;b=b|0;c=c|0;var d=0,e=0,f=0,g=0,h=0;d=i;i=i+48|0;e=d;f=b+40|0;Ha(a,f,b);g=a+40|0;Ta(g,f,b);f=a+80|0;Oa(f,a,c);Oa(g,g,c+40|0);h=a+120|0;Oa(h,c+120|0,b+120|0);Oa(a,b+80|0,c+80|0);Ha(e,a,a);Ta(a,f,g);Ha(g,f,g);Ha(f,e,h);Ta(h,e,h);i=d;return}function Wa(b,c,d,e){b=b|0;c=c|0;d=d|0;e=e|0;var f=0,g=0,h=0,j=0,k=0,l=0,m=0,n=0,o=0;f=i;i=i+2272|0;g=f+2016|0;h=f+1760|0;j=f+480|0;k=f+320|0;l=f+160|0;m=f;Xa(g,c);Xa(h,e);fb(j,d);eb(k,d);ab(m,k);Va(k,m,j);ab(l,k);d=j+160|0;fb(d,l);Va(k,m,d);ab(l,k);d=j+320|0;fb(d,l);Va(k,m,d);ab(l,k);d=j+480|0;fb(d,l);Va(k,m,d);ab(l,k);d=j+640|0;fb(d,l);Va(k,m,d);ab(l,k);d=j+800|0;fb(d,l);Va(k,m,d);ab(l,k);d=j+960|0;fb(d,l);Va(k,m,d);ab(l,k);fb(j+1120|0,l);bb(b);d=255;while(1){if(a[g+d>>0]|0){n=d;break}m=d+-1|0;if(a[h+d>>0]|0){n=d;break}if((d|0)>0)d=m;else{n=m;break}}if((n|0)>-1)o=n;else{i=f;return}while(1){cb(k,b);n=a[g+o>>0]|0;if(n<<24>>24<=0){if(n<<24>>24<0){ab(l,k);lb(k,l,j+(((n<<24>>24|0)/-2|0)*160|0)|0)}}else{ab(l,k);Va(k,l,j+(((n<<24>>24|0)/2|0)*160|0)|0)}n=a[h+o>>0]|0;if(n<<24>>24<=0){if(n<<24>>24<0){ab(l,k);_a(k,l,40+(((n<<24>>24|0)/-2|0)*120|0)|0)}}else{ab(l,k);Za(k,l,40+(((n<<24>>24|0)/2|0)*120|0)|0)}$a(b,k);if((o|0)>0)o=o+-1|0;else break}i=f;return}function Xa(b,c){b=b|0;c=c|0;var e=0,f=0,g=0,h=0,j=0,k=0,l=0,m=0,n=0,o=0;e=i;f=0;do{a[b+f>>0]=(d[c+(f>>3)>>0]|0)>>>(f&7)&1;f=f+1|0}while((f|0)!=256);g=0;do{f=b+g|0;a:do if(a[f>>0]|0){c=1;do{h=c+g|0;if((h|0)>=256)break a;j=b+h|0;k=a[j>>0]|0;b:do if(k<<24>>24){l=a[f>>0]|0;m=k<<24>>24<<c;n=l+m|0;if((n|0)<16){a[f>>0]=n;a[j>>0]=0;break}n=l-m|0;if((n|0)<=-16)break a;a[f>>0]=n;n=h;while(1){o=b+n|0;if(!(a[o>>0]|0))break;a[o>>0]=0;n=n+1|0;if((n|0)>=256)break b}a[o>>0]=1}while(0);c=c+1|0}while((c|0)<7)}while(0);g=g+1|0}while((g|0)!=256);i=e;return}function Ya(a,b){a=a|0;b=b|0;var c=0,e=0,f=0,g=0,h=0,j=0,k=0,l=0,m=0;c=i;i=i+208|0;e=c+160|0;f=c+120|0;g=c+80|0;h=c+40|0;j=c;k=a+40|0;Ka(k,b);l=a+80|0;Ga(l);Ra(e,k);Oa(f,e,1e3);Ta(e,e,l);Ha(f,f,l);Ra(g,f);Oa(g,g,f);Ra(a,g);Oa(a,a,f);Oa(a,a,e);Qa(a,a);Oa(a,a,g);Oa(a,a,e);Ra(h,a);Oa(h,h,f);Ta(j,h,e);do if(Na(j)|0){Ha(j,h,e);if(!(Na(j)|0)){Oa(a,a,1040);break}else{m=-1;i=c;return m|0}}while(0);j=Ma(a)|0;if((j|0)==((d[b+31>>0]|0)>>>7|0))Pa(a,a);Oa(a+120|0,a,k);m=0;i=c;return m|0}function Za(a,b,c){a=a|0;b=b|0;c=c|0;var d=0,e=0,f=0,g=0,h=0;d=i;i=i+48|0;e=d;f=b+40|0;Ha(a,f,b);g=a+40|0;Ta(g,f,b);f=a+80|0;Oa(f,a,c);Oa(g,g,c+40|0);h=a+120|0;Oa(h,c+80|0,b+120|0);c=b+80|0;Ha(e,c,c);Ta(a,f,g);Ha(g,f,g);Ha(f,e,h);Ta(h,e,h);i=d;return}function _a(a,b,c){a=a|0;b=b|0;c=c|0;var d=0,e=0,f=0,g=0,h=0;d=i;i=i+48|0;e=d;f=b+40|0;Ha(a,f,b);g=a+40|0;Ta(g,f,b);f=a+80|0;Oa(f,a,c+40|0);Oa(g,g,c);h=a+120|0;Oa(h,c+80|0,b+120|0);c=b+80|0;Ha(e,c,c);Ta(a,f,g);Ha(g,f,g);Ta(f,e,h);Ha(h,e,h);i=d;return}function $a(a,b){a=a|0;b=b|0;var c=0,d=0,e=0;c=i;d=b+120|0;Oa(a,b,d);e=b+80|0;Oa(a+40|0,b+40|0,e);Oa(a+80|0,e,d);i=c;return}function ab(a,b){a=a|0;b=b|0;var c=0,d=0,e=0,f=0;c=i;d=b+120|0;Oa(a,b,d);e=b+40|0;f=b+80|0;Oa(a+40|0,e,f);Oa(a+80|0,f,d);Oa(a+120|0,b,e);i=c;return}function bb(a){a=a|0;var b=0;b=i;Fa(a);Ga(a+40|0);Ga(a+80|0);i=b;return}function cb(a,b){a=a|0;b=b|0;var c=0,d=0,e=0,f=0,g=0,h=0;c=i;i=i+48|0;d=c;Ra(a,b);e=a+80|0;f=b+40|0;Ra(e,f);g=a+120|0;Sa(g,b+80|0);h=a+40|0;Ha(h,b,f);Ra(d,h);Ha(h,e,a);Ta(e,e,a);Ta(a,d,h);Ta(g,g,e);i=c;return}function db(a){a=a|0;var b=0;b=i;Fa(a);Ga(a+40|0);Ga(a+80|0);Fa(a+120|0);i=b;return}function eb(a,b){a=a|0;b=b|0;var c=0,d=0;c=i;i=i+128|0;d=c;gb(d,b);cb(a,d);i=c;return}function fb(a,b){a=a|0;b=b|0;var c=0,d=0;c=i;d=b+40|0;Ha(a,d,b);Ta(a+40|0,d,b);Ja(a+80|0,b+80|0);Oa(a+120|0,b+120|0,1080);i=c;return}function gb(a,b){a=a|0;b=b|0;var c=0;c=i;Ja(a,b);Ja(a+40|0,b+40|0);Ja(a+80|0,b+80|0);i=c;return}function hb(b,c){b=b|0;c=c|0;var e=0,f=0,g=0,h=0;e=i;i=i+128|0;f=e+80|0;g=e+40|0;h=e;La(f,c+80|0);Oa(g,c,f);Oa(h,c+40|0,f);Ua(b,h);h=(Ma(g)|0)<<7;g=b+31|0;a[g>>0]=(d[g>>0]|0)^h;i=e;return}function ib(a){a=a|0;var b=0;b=i;Ga(a);Ga(a+40|0);Fa(a+80|0);i=b;return}function jb(b,c){b=b|0;c=c|0;var e=0,f=0,g=0,h=0,j=0,k=0,l=0,m=0,n=0,o=0;e=i;i=i+464|0;f=e+400|0;g=e+240|0;h=e+120|0;j=e;k=0;do{l=a[c+k>>0]|0;m=k<<1;a[f+m>>0]=l&15;a[f+(m|1)>>0]=(l&255)>>>4;k=k+1|0}while((k|0)!=32);n=0;o=0;do{k=f+o|0;c=(d[k>>0]|0)+n|0;n=(c<<24)+134217728>>28;a[k>>0]=c-(n<<4);o=o+1|0}while((o|0)!=63);o=f+63|0;a[o>>0]=(d[o>>0]|0)+n;db(b);n=1;do{kb(j,(n|0)/2|0,a[f+n>>0]|0);Za(g,b,j);ab(b,g);n=n+2|0}while((n|0)<64);eb(g,b);$a(h,g);cb(g,h);$a(h,g);cb(g,h);$a(h,g);cb(g,h);ab(b,g);h=0;do{kb(j,(h|0)/2|0,a[f+h>>0]|0);Za(g,b,j);ab(b,g);h=h+2|0}while((h|0)<64);i=e;return}function kb(a,b,c){a=a|0;b=b|0;c=c|0;var d=0,e=0,f=0,g=0,h=0,j=0;d=i;i=i+128|0;e=d;f=c<<24>>24;g=Cb(f|0,((f|0)<0)<<31>>31|0,63)|0;f=c<<24>>24;ib(a);c=f-((f&0-g)<<1)&255;f=((c^1)+-1|0)>>>31;Ia(a,1120+(b*960|0)|0,f);h=a+40|0;Ia(h,1160+(b*960|0)|0,f);j=a+80|0;Ia(j,1200+(b*960|0)|0,f);f=((c^2)+-1|0)>>>31;Ia(a,1240+(b*960|0)|0,f);Ia(h,1280+(b*960|0)|0,f);Ia(j,1320+(b*960|0)|0,f);f=((c^3)+-1|0)>>>31;Ia(a,1360+(b*960|0)|0,f);Ia(h,1400+(b*960|0)|0,f);Ia(j,1440+(b*960|0)|0,f);f=((c^4)+-1|0)>>>31;Ia(a,1480+(b*960|0)|0,f);Ia(h,1520+(b*960|0)|0,f);Ia(j,1560+(b*960|0)|0,f);f=((c^5)+-1|0)>>>31;Ia(a,1600+(b*960|0)|0,f);Ia(h,1640+(b*960|0)|0,f);Ia(j,1680+(b*960|0)|0,f);f=((c^6)+-1|0)>>>31;Ia(a,1720+(b*960|0)|0,f);Ia(h,1760+(b*960|0)|0,f);Ia(j,1800+(b*960|0)|0,f);f=((c^7)+-1|0)>>>31;Ia(a,1840+(b*960|0)|0,f);Ia(h,1880+(b*960|0)|0,f);Ia(j,1920+(b*960|0)|0,f);f=((c^8)+-1|0)>>>31;Ia(a,1960+(b*960|0)|0,f);Ia(h,2e3+(b*960|0)|0,f);Ia(j,2040+(b*960|0)|0,f);Ja(e,h);f=e+40|0;Ja(f,a);b=e+80|0;Pa(b,j);Ia(a,e,g);Ia(h,f,g);Ia(j,b,g);i=d;return}function lb(a,b,c){a=a|0;b=b|0;c=c|0;var d=0,e=0,f=0,g=0,h=0;d=i;i=i+48|0;e=d;f=b+40|0;Ha(a,f,b);g=a+40|0;Ta(g,f,b);f=a+80|0;Oa(f,a,c+40|0);Oa(g,g,c);h=a+120|0;Oa(h,c+120|0,b+120|0);Oa(a,b+80|0,c+80|0);Ha(e,a,a);Ta(a,f,g);Ha(g,f,g);Ta(f,e,h);Ha(h,e,h);i=d;return}function mb(b,c){b=b|0;c=c|0;var e=0,f=0,g=0,h=0;e=i;i=i+128|0;f=e+80|0;g=e+40|0;h=e;La(f,c+80|0);Oa(g,c,f);Oa(h,c+40|0,f);Ua(b,h);h=(Ma(g)|0)<<7;g=b+31|0;a[g>>0]=(d[g>>0]|0)^h;i=e;return}function nb(b,e,f,g,h,j){b=b|0;e=e|0;f=f|0;g=g|0;h=h|0;j=j|0;var k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0;k=i;i=i+480|0;l=k+440|0;m=k+408|0;n=k+376|0;o=k+312|0;p=k+280|0;q=k+120|0;r=k;if((!(h>>>0<0|(h|0)==0&g>>>0<64)?(d[f+63>>0]|0)<=31:0)?(Ya(q,j)|0)==0:0){s=l+0|0;t=j+0|0;j=s+32|0;do{a[s>>0]=a[t>>0]|0;s=s+1|0;t=t+1|0}while((s|0)<(j|0));s=m+0|0;t=f+0|0;j=s+32|0;do{a[s>>0]=a[t>>0]|0;s=s+1|0;t=t+1|0}while((s|0)<(j|0));s=n+0|0;t=f+32|0;j=s+32|0;do{a[s>>0]=a[t>>0]|0;s=s+1|0;t=t+1|0}while((s|0)<(j|0));Gb(b|0,f|0,g|0)|0;s=b+32|0;t=l+0|0;j=s+32|0;do{a[s>>0]=a[t>>0]|0;s=s+1|0;t=t+1|0}while((s|0)<(j|0));za(o,b,g,h)|0;pb(o);Wa(r,o,q,n);mb(p,r);if(!(wa(p,m)|0)){m=Ab(g|0,h|0,-64,-1)|0;h=D;Gb(b|0,b+64|0,m|0)|0;s=b+(g+-64)+0|0;j=s+64|0;do{a[s>>0]=0;s=s+1|0}while((s|0)<(j|0));s=e;c[s>>2]=m;c[s+4>>2]=h;u=0;i=k;return u|0}}h=e;c[h>>2]=-1;c[h+4>>2]=-1;Bb(b|0,0,g|0)|0;u=-1;i=k;return u|0}
function ob(b,c,e,f){b=b|0;c=c|0;e=e|0;f=f|0;var g=0,h=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0,L=0,M=0,N=0,O=0,P=0,Q=0,R=0,S=0,T=0,U=0,V=0,W=0,X=0,Y=0,Z=0,_=0,$=0,aa=0,ba=0,ca=0,da=0,ea=0,fa=0,ga=0,ha=0,ia=0,ja=0,ka=0,la=0,ma=0,na=0,oa=0,pa=0,qa=0,ra=0,sa=0,ta=0,ua=0,va=0,wa=0,xa=0,ya=0,za=0,Aa=0,Ba=0,Ca=0,Da=0,Ea=0,Fa=0,Ga=0,Ha=0,Ia=0,Ja=0,Ka=0,La=0,Ma=0,Na=0,Oa=0,Pa=0,Qa=0,Ra=0,Sa=0,Ta=0,Ua=0,Va=0,Wa=0,Xa=0,Ya=0,Za=0,_a=0,$a=0,ab=0,bb=0,cb=0,db=0,eb=0,fb=0,gb=0,hb=0,ib=0,jb=0,kb=0,lb=0,mb=0,nb=0,ob=0,pb=0,qb=0,rb=0,sb=0,tb=0,ub=0,vb=0,wb=0,xb=0,Bb=0,Eb=0,Fb=0,Gb=0,Hb=0,Ib=0,Jb=0,Kb=0,Lb=0,Nb=0,Ob=0,Pb=0,Qb=0,Rb=0,Sb=0,Tb=0,Ub=0,Vb=0,Wb=0,Xb=0,Yb=0,Zb=0,_b=0,$b=0,ac=0,bc=0,cc=0,dc=0,ec=0,fc=0,gc=0,hc=0,ic=0,jc=0,kc=0,lc=0,mc=0,nc=0,oc=0,pc=0,qc=0,rc=0,sc=0,tc=0,uc=0,vc=0,wc=0,xc=0,yc=0,zc=0,Ac=0,Bc=0,Cc=0,Dc=0,Ec=0;g=i;h=a[c+2>>0]|0;j=d[c>>0]|0;k=Db(d[c+1>>0]|0|0,0,8)|0;l=D;m=h&255;h=Db(m|0,0,16)|0;n=k|j|h&2031616;h=Db(d[c+3>>0]|0|0,0,8)|0;j=D;k=Db(d[c+4>>0]|0|0,0,16)|0;o=j|D;j=d[c+5>>0]|0;p=Db(j|0,0,24)|0;q=Cb(h|m|k|p|0,o|D|0,5)|0;o=q&2097151;q=a[c+7>>0]|0;p=Db(d[c+6>>0]|0|0,0,8)|0;k=D;m=q&255;q=Db(m|0,0,16)|0;h=Cb(p|j|q|0,k|D|0,2)|0;k=h&2097151;h=Db(d[c+8>>0]|0|0,0,8)|0;q=D;j=Db(d[c+9>>0]|0|0,0,16)|0;p=q|D;q=d[c+10>>0]|0;r=Db(q|0,0,24)|0;s=Cb(h|m|j|r|0,p|D|0,7)|0;p=s&2097151;s=Db(d[c+11>>0]|0|0,0,8)|0;r=D;j=Db(d[c+12>>0]|0|0,0,16)|0;m=r|D;r=d[c+13>>0]|0;h=Db(r|0,0,24)|0;t=Cb(s|q|j|h|0,m|D|0,4)|0;m=t&2097151;t=a[c+15>>0]|0;h=Db(d[c+14>>0]|0|0,0,8)|0;j=D;q=t&255;t=Db(q|0,0,16)|0;s=Cb(h|r|t|0,j|D|0,1)|0;j=s&2097151;s=Db(d[c+16>>0]|0|0,0,8)|0;t=D;r=Db(d[c+17>>0]|0|0,0,16)|0;h=t|D;t=d[c+18>>0]|0;u=Db(t|0,0,24)|0;v=Cb(s|q|r|u|0,h|D|0,6)|0;h=v&2097151;v=a[c+20>>0]|0;u=Db(d[c+19>>0]|0|0,0,8)|0;r=D;q=Db(v&255|0,0,16)|0;v=Cb(u|t|q|0,r|D|0,3)|0;r=D;q=a[c+23>>0]|0;t=d[c+21>>0]|0;u=Db(d[c+22>>0]|0|0,0,8)|0;s=D;w=q&255;q=Db(w|0,0,16)|0;x=u|t|q&2031616;q=Db(d[c+24>>0]|0|0,0,8)|0;t=D;u=Db(d[c+25>>0]|0|0,0,16)|0;y=t|D;t=d[c+26>>0]|0;z=Db(t|0,0,24)|0;A=Cb(q|w|u|z|0,y|D|0,5)|0;y=A&2097151;A=a[c+28>>0]|0;z=Db(d[c+27>>0]|0|0,0,8)|0;u=D;w=A&255;A=Db(w|0,0,16)|0;q=Cb(z|t|A|0,u|D|0,2)|0;u=q&2097151;q=Db(d[c+29>>0]|0|0,0,8)|0;A=D;t=Db(d[c+30>>0]|0|0,0,16)|0;z=A|D;A=Db(d[c+31>>0]|0|0,0,24)|0;c=Cb(q|w|t|A|0,z|D|0,7)|0;z=D;A=a[e+2>>0]|0;t=d[e>>0]|0;w=Db(d[e+1>>0]|0|0,0,8)|0;q=D;B=A&255;A=Db(B|0,0,16)|0;C=w|t|A&2031616;A=Db(d[e+3>>0]|0|0,0,8)|0;t=D;w=Db(d[e+4>>0]|0|0,0,16)|0;E=t|D;t=d[e+5>>0]|0;F=Db(t|0,0,24)|0;G=Cb(A|B|w|F|0,E|D|0,5)|0;E=G&2097151;G=a[e+7>>0]|0;F=Db(d[e+6>>0]|0|0,0,8)|0;w=D;B=G&255;G=Db(B|0,0,16)|0;A=Cb(F|t|G|0,w|D|0,2)|0;w=A&2097151;A=Db(d[e+8>>0]|0|0,0,8)|0;G=D;t=Db(d[e+9>>0]|0|0,0,16)|0;F=G|D;G=d[e+10>>0]|0;H=Db(G|0,0,24)|0;I=Cb(A|B|t|H|0,F|D|0,7)|0;F=I&2097151;I=Db(d[e+11>>0]|0|0,0,8)|0;H=D;t=Db(d[e+12>>0]|0|0,0,16)|0;B=H|D;H=d[e+13>>0]|0;A=Db(H|0,0,24)|0;J=Cb(I|G|t|A|0,B|D|0,4)|0;B=J&2097151;J=a[e+15>>0]|0;A=Db(d[e+14>>0]|0|0,0,8)|0;t=D;G=J&255;J=Db(G|0,0,16)|0;I=Cb(A|H|J|0,t|D|0,1)|0;t=I&2097151;I=Db(d[e+16>>0]|0|0,0,8)|0;J=D;H=Db(d[e+17>>0]|0|0,0,16)|0;A=J|D;J=d[e+18>>0]|0;K=Db(J|0,0,24)|0;L=Cb(I|G|H|K|0,A|D|0,6)|0;A=L&2097151;L=a[e+20>>0]|0;K=Db(d[e+19>>0]|0|0,0,8)|0;H=D;G=Db(L&255|0,0,16)|0;L=Cb(K|J|G|0,H|D|0,3)|0;H=D;G=a[e+23>>0]|0;J=d[e+21>>0]|0;K=Db(d[e+22>>0]|0|0,0,8)|0;I=D;M=G&255;G=Db(M|0,0,16)|0;N=K|J|G&2031616;G=Db(d[e+24>>0]|0|0,0,8)|0;J=D;K=Db(d[e+25>>0]|0|0,0,16)|0;O=J|D;J=d[e+26>>0]|0;P=Db(J|0,0,24)|0;Q=Cb(G|M|K|P|0,O|D|0,5)|0;O=Q&2097151;Q=a[e+28>>0]|0;P=Db(d[e+27>>0]|0|0,0,8)|0;K=D;M=Q&255;Q=Db(M|0,0,16)|0;G=Cb(P|J|Q|0,K|D|0,2)|0;K=G&2097151;G=Db(d[e+29>>0]|0|0,0,8)|0;Q=D;J=Db(d[e+30>>0]|0|0,0,16)|0;P=Q|D;Q=Db(d[e+31>>0]|0|0,0,24)|0;e=Cb(G|M|J|Q|0,P|D|0,7)|0;P=D;Q=a[f+2>>0]|0;J=d[f>>0]|0;M=Db(d[f+1>>0]|0|0,0,8)|0;G=D;R=Q&255;Q=Db(R|0,0,16)|0;S=Db(d[f+3>>0]|0|0,0,8)|0;T=D;U=Db(d[f+4>>0]|0|0,0,16)|0;V=T|D;T=d[f+5>>0]|0;W=Db(T|0,0,24)|0;X=Cb(S|R|U|W|0,V|D|0,5)|0;V=a[f+7>>0]|0;W=Db(d[f+6>>0]|0|0,0,8)|0;U=D;R=V&255;V=Db(R|0,0,16)|0;S=Cb(W|T|V|0,U|D|0,2)|0;U=Db(d[f+8>>0]|0|0,0,8)|0;V=D;T=Db(d[f+9>>0]|0|0,0,16)|0;W=V|D;V=d[f+10>>0]|0;Y=Db(V|0,0,24)|0;Z=Cb(U|R|T|Y|0,W|D|0,7)|0;W=Db(d[f+11>>0]|0|0,0,8)|0;Y=D;T=Db(d[f+12>>0]|0|0,0,16)|0;R=Y|D;Y=d[f+13>>0]|0;U=Db(Y|0,0,24)|0;_=Cb(W|V|T|U|0,R|D|0,4)|0;R=a[f+15>>0]|0;U=Db(d[f+14>>0]|0|0,0,8)|0;T=D;V=R&255;R=Db(V|0,0,16)|0;W=Cb(U|Y|R|0,T|D|0,1)|0;T=Db(d[f+16>>0]|0|0,0,8)|0;R=D;Y=Db(d[f+17>>0]|0|0,0,16)|0;U=R|D;R=d[f+18>>0]|0;$=Db(R|0,0,24)|0;aa=Cb(T|V|Y|$|0,U|D|0,6)|0;U=a[f+20>>0]|0;$=Db(d[f+19>>0]|0|0,0,8)|0;Y=D;V=Db(U&255|0,0,16)|0;U=Cb($|R|V|0,Y|D|0,3)|0;Y=D;V=a[f+23>>0]|0;R=d[f+21>>0]|0;$=Db(d[f+22>>0]|0|0,0,8)|0;T=D;ba=V&255;V=Db(ba|0,0,16)|0;ca=Db(d[f+24>>0]|0|0,0,8)|0;da=D;ea=Db(d[f+25>>0]|0|0,0,16)|0;fa=da|D;da=d[f+26>>0]|0;ga=Db(da|0,0,24)|0;ha=Cb(ca|ba|ea|ga|0,fa|D|0,5)|0;fa=a[f+28>>0]|0;ga=Db(d[f+27>>0]|0|0,0,8)|0;ea=D;ba=fa&255;fa=Db(ba|0,0,16)|0;ca=Cb(ga|da|fa|0,ea|D|0,2)|0;ea=Db(d[f+29>>0]|0|0,0,8)|0;fa=D;da=Db(d[f+30>>0]|0|0,0,16)|0;ga=fa|D;fa=Db(d[f+31>>0]|0|0,0,24)|0;f=Cb(ea|ba|da|fa|0,ga|D|0,7)|0;ga=D;fa=Mb(C|0,q|0,n|0,l|0)|0;da=Ab(M|J|Q&2031616|0,G|0,fa|0,D|0)|0;fa=D;G=Mb(E|0,0,n|0,l|0)|0;Q=D;J=Mb(C|0,q|0,o|0,0)|0;M=D;ba=Mb(w|0,0,n|0,l|0)|0;ea=D;ia=Mb(E|0,0,o|0,0)|0;ja=D;ka=Mb(C|0,q|0,k|0,0)|0;la=Ab(ia|0,ja|0,ka|0,D|0)|0;ka=Ab(la|0,D|0,ba|0,ea|0)|0;ea=Ab(ka|0,D|0,S&2097151|0,0)|0;S=D;ka=Mb(F|0,0,n|0,l|0)|0;ba=D;la=Mb(w|0,0,o|0,0)|0;ja=D;ia=Mb(E|0,0,k|0,0)|0;ma=D;na=Mb(C|0,q|0,p|0,0)|0;oa=D;pa=Mb(B|0,0,n|0,l|0)|0;qa=D;ra=Mb(F|0,0,o|0,0)|0;sa=D;ta=Mb(w|0,0,k|0,0)|0;ua=D;va=Mb(E|0,0,p|0,0)|0;wa=D;xa=Mb(C|0,q|0,m|0,0)|0;ya=Ab(va|0,wa|0,xa|0,D|0)|0;xa=Ab(ya|0,D|0,ta|0,ua|0)|0;ua=Ab(xa|0,D|0,ra|0,sa|0)|0;sa=Ab(ua|0,D|0,pa|0,qa|0)|0;qa=Ab(sa|0,D|0,_&2097151|0,0)|0;_=D;sa=Mb(t|0,0,n|0,l|0)|0;pa=D;ua=Mb(B|0,0,o|0,0)|0;ra=D;xa=Mb(F|0,0,k|0,0)|0;ta=D;ya=Mb(w|0,0,p|0,0)|0;wa=D;va=Mb(E|0,0,m|0,0)|0;za=D;Aa=Mb(C|0,q|0,j|0,0)|0;Ba=D;Ca=Mb(A|0,0,n|0,l|0)|0;Da=D;Ea=Mb(t|0,0,o|0,0)|0;Fa=D;Ga=Mb(B|0,0,k|0,0)|0;Ha=D;Ia=Mb(F|0,0,p|0,0)|0;Ja=D;Ka=Mb(w|0,0,m|0,0)|0;La=D;Ma=Mb(E|0,0,j|0,0)|0;Na=D;Oa=Mb(C|0,q|0,h|0,0)|0;Pa=Ab(Ma|0,Na|0,Oa|0,D|0)|0;Oa=Ab(Pa|0,D|0,Ka|0,La|0)|0;La=Ab(Oa|0,D|0,Ia|0,Ja|0)|0;Ja=Ab(La|0,D|0,Ga|0,Ha|0)|0;Ha=Ab(Ja|0,D|0,Ea|0,Fa|0)|0;Fa=Ab(Ha|0,D|0,Ca|0,Da|0)|0;Da=Ab(Fa|0,D|0,aa&2097151|0,0)|0;aa=D;Fa=Mb(L|0,H|0,n|0,l|0)|0;Ca=D;Ha=Mb(A|0,0,o|0,0)|0;Ea=D;Ja=Mb(t|0,0,k|0,0)|0;Ga=D;La=Mb(B|0,0,p|0,0)|0;Ia=D;Oa=Mb(F|0,0,m|0,0)|0;Ka=D;Pa=Mb(w|0,0,j|0,0)|0;Na=D;Ma=Mb(E|0,0,h|0,0)|0;Qa=D;Ra=Mb(C|0,q|0,v|0,r|0)|0;Sa=D;Ta=Mb(N|0,I|0,n|0,l|0)|0;Ua=D;Va=Mb(L|0,H|0,o|0,0)|0;Wa=D;Xa=Mb(A|0,0,k|0,0)|0;Ya=D;Za=Mb(t|0,0,p|0,0)|0;_a=D;$a=Mb(B|0,0,m|0,0)|0;ab=D;bb=Mb(F|0,0,j|0,0)|0;cb=D;db=Mb(w|0,0,h|0,0)|0;eb=D;fb=Mb(E|0,0,v|0,r|0)|0;gb=D;hb=Mb(C|0,q|0,x|0,s|0)|0;ib=Ab(fb|0,gb|0,hb|0,D|0)|0;hb=Ab(ib|0,D|0,db|0,eb|0)|0;eb=Ab(hb|0,D|0,bb|0,cb|0)|0;cb=Ab(eb|0,D|0,$a|0,ab|0)|0;ab=Ab(cb|0,D|0,Za|0,_a|0)|0;_a=Ab(ab|0,D|0,Xa|0,Ya|0)|0;Ya=Ab(_a|0,D|0,Va|0,Wa|0)|0;Wa=Ab(Ya|0,D|0,Ta|0,Ua|0)|0;Ua=Ab(Wa|0,D|0,$|R|V&2031616|0,T|0)|0;T=D;V=Mb(O|0,0,n|0,l|0)|0;R=D;$=Mb(N|0,I|0,o|0,0)|0;Wa=D;Ta=Mb(L|0,H|0,k|0,0)|0;Ya=D;Va=Mb(A|0,0,p|0,0)|0;_a=D;Xa=Mb(t|0,0,m|0,0)|0;ab=D;Za=Mb(B|0,0,j|0,0)|0;cb=D;$a=Mb(F|0,0,h|0,0)|0;eb=D;bb=Mb(w|0,0,v|0,r|0)|0;hb=D;db=Mb(E|0,0,x|0,s|0)|0;ib=D;gb=Mb(C|0,q|0,y|0,0)|0;fb=D;jb=Mb(K|0,0,n|0,l|0)|0;kb=D;lb=Mb(O|0,0,o|0,0)|0;mb=D;nb=Mb(N|0,I|0,k|0,0)|0;ob=D;pb=Mb(L|0,H|0,p|0,0)|0;qb=D;rb=Mb(A|0,0,m|0,0)|0;sb=D;tb=Mb(t|0,0,j|0,0)|0;ub=D;vb=Mb(B|0,0,h|0,0)|0;wb=D;xb=Mb(F|0,0,v|0,r|0)|0;Bb=D;Eb=Mb(w|0,0,x|0,s|0)|0;Fb=D;Gb=Mb(E|0,0,y|0,0)|0;Hb=D;Ib=Mb(C|0,q|0,u|0,0)|0;Jb=Ab(Gb|0,Hb|0,Ib|0,D|0)|0;Ib=Ab(Jb|0,D|0,Eb|0,Fb|0)|0;Fb=Ab(Ib|0,D|0,xb|0,Bb|0)|0;Bb=Ab(Fb|0,D|0,vb|0,wb|0)|0;wb=Ab(Bb|0,D|0,tb|0,ub|0)|0;ub=Ab(wb|0,D|0,rb|0,sb|0)|0;sb=Ab(ub|0,D|0,pb|0,qb|0)|0;qb=Ab(sb|0,D|0,nb|0,ob|0)|0;ob=Ab(qb|0,D|0,lb|0,mb|0)|0;mb=Ab(ob|0,D|0,jb|0,kb|0)|0;kb=Ab(mb|0,D|0,ca&2097151|0,0)|0;ca=D;mb=Mb(e|0,P|0,n|0,l|0)|0;l=D;n=Mb(K|0,0,o|0,0)|0;jb=D;ob=Mb(O|0,0,k|0,0)|0;lb=D;qb=Mb(N|0,I|0,p|0,0)|0;nb=D;sb=Mb(L|0,H|0,m|0,0)|0;pb=D;ub=Mb(A|0,0,j|0,0)|0;rb=D;wb=Mb(t|0,0,h|0,0)|0;tb=D;Bb=Mb(B|0,0,v|0,r|0)|0;vb=D;Fb=Mb(F|0,0,x|0,s|0)|0;xb=D;Ib=Mb(w|0,0,y|0,0)|0;Eb=D;Jb=Mb(E|0,0,u|0,0)|0;Hb=D;Gb=Mb(C|0,q|0,c|0,z|0)|0;q=D;C=Mb(e|0,P|0,o|0,0)|0;o=D;Kb=Mb(K|0,0,k|0,0)|0;Lb=D;Nb=Mb(O|0,0,p|0,0)|0;Ob=D;Pb=Mb(N|0,I|0,m|0,0)|0;Qb=D;Rb=Mb(L|0,H|0,j|0,0)|0;Sb=D;Tb=Mb(A|0,0,h|0,0)|0;Ub=D;Vb=Mb(t|0,0,v|0,r|0)|0;Wb=D;Xb=Mb(B|0,0,x|0,s|0)|0;Yb=D;Zb=Mb(F|0,0,y|0,0)|0;_b=D;$b=Mb(w|0,0,u|0,0)|0;ac=D;bc=Mb(E|0,0,c|0,z|0)|0;E=Ab($b|0,ac|0,bc|0,D|0)|0;bc=Ab(E|0,D|0,Zb|0,_b|0)|0;_b=Ab(bc|0,D|0,Xb|0,Yb|0)|0;Yb=Ab(_b|0,D|0,Vb|0,Wb|0)|0;Wb=Ab(Yb|0,D|0,Tb|0,Ub|0)|0;Ub=Ab(Wb|0,D|0,Rb|0,Sb|0)|0;Sb=Ab(Ub|0,D|0,Pb|0,Qb|0)|0;Qb=Ab(Sb|0,D|0,Nb|0,Ob|0)|0;Ob=Ab(Qb|0,D|0,Kb|0,Lb|0)|0;Lb=Ab(Ob|0,D|0,C|0,o|0)|0;o=D;C=Mb(e|0,P|0,k|0,0)|0;k=D;Ob=Mb(K|0,0,p|0,0)|0;Kb=D;Qb=Mb(O|0,0,m|0,0)|0;Nb=D;Sb=Mb(N|0,I|0,j|0,0)|0;Pb=D;Ub=Mb(L|0,H|0,h|0,0)|0;Rb=D;Wb=Mb(A|0,0,v|0,r|0)|0;Tb=D;Yb=Mb(t|0,0,x|0,s|0)|0;Vb=D;_b=Mb(B|0,0,y|0,0)|0;Xb=D;bc=Mb(F|0,0,u|0,0)|0;Zb=D;E=Mb(w|0,0,c|0,z|0)|0;w=D;ac=Mb(e|0,P|0,p|0,0)|0;p=D;$b=Mb(K|0,0,m|0,0)|0;cc=D;dc=Mb(O|0,0,j|0,0)|0;ec=D;fc=Mb(N|0,I|0,h|0,0)|0;gc=D;hc=Mb(L|0,H|0,v|0,r|0)|0;ic=D;jc=Mb(A|0,0,x|0,s|0)|0;kc=D;lc=Mb(t|0,0,y|0,0)|0;mc=D;nc=Mb(B|0,0,u|0,0)|0;oc=D;pc=Mb(F|0,0,c|0,z|0)|0;F=Ab(nc|0,oc|0,pc|0,D|0)|0;pc=Ab(F|0,D|0,lc|0,mc|0)|0;mc=Ab(pc|0,D|0,jc|0,kc|0)|0;kc=Ab(mc|0,D|0,hc|0,ic|0)|0;ic=Ab(kc|0,D|0,fc|0,gc|0)|0;gc=Ab(ic|0,D|0,dc|0,ec|0)|0;ec=Ab(gc|0,D|0,$b|0,cc|0)|0;cc=Ab(ec|0,D|0,ac|0,p|0)|0;p=D;ac=Mb(e|0,P|0,m|0,0)|0;m=D;ec=Mb(K|0,0,j|0,0)|0;$b=D;gc=Mb(O|0,0,h|0,0)|0;dc=D;ic=Mb(N|0,I|0,v|0,r|0)|0;fc=D;kc=Mb(L|0,H|0,x|0,s|0)|0;hc=D;mc=Mb(A|0,0,y|0,0)|0;jc=D;pc=Mb(t|0,0,u|0,0)|0;lc=D;F=Mb(B|0,0,c|0,z|0)|0;B=D;oc=Mb(e|0,P|0,j|0,0)|0;j=D;nc=Mb(K|0,0,h|0,0)|0;qc=D;rc=Mb(O|0,0,v|0,r|0)|0;sc=D;tc=Mb(N|0,I|0,x|0,s|0)|0;uc=D;vc=Mb(L|0,H|0,y|0,0)|0;wc=D;xc=Mb(A|0,0,u|0,0)|0;yc=D;zc=Mb(t|0,0,c|0,z|0)|0;t=Ab(xc|0,yc|0,zc|0,D|0)|0;zc=Ab(t|0,D|0,vc|0,wc|0)|0;wc=Ab(zc|0,D|0,tc|0,uc|0)|0;uc=Ab(wc|0,D|0,rc|0,sc|0)|0;sc=Ab(uc|0,D|0,nc|0,qc|0)|0;qc=Ab(sc|0,D|0,oc|0,j|0)|0;j=D;oc=Mb(e|0,P|0,h|0,0)|0;h=D;sc=Mb(K|0,0,v|0,r|0)|0;nc=D;uc=Mb(O|0,0,x|0,s|0)|0;rc=D;wc=Mb(N|0,I|0,y|0,0)|0;tc=D;zc=Mb(L|0,H|0,u|0,0)|0;vc=D;t=Mb(A|0,0,c|0,z|0)|0;A=D;yc=Mb(e|0,P|0,v|0,r|0)|0;r=D;v=Mb(K|0,0,x|0,s|0)|0;xc=D;Ac=Mb(O|0,0,y|0,0)|0;Bc=D;Cc=Mb(N|0,I|0,u|0,0)|0;Dc=D;Ec=Mb(L|0,H|0,c|0,z|0)|0;H=Ab(Cc|0,Dc|0,Ec|0,D|0)|0;Ec=Ab(H|0,D|0,Ac|0,Bc|0)|0;Bc=Ab(Ec|0,D|0,v|0,xc|0)|0;xc=Ab(Bc|0,D|0,yc|0,r|0)|0;r=D;yc=Mb(e|0,P|0,x|0,s|0)|0;s=D;x=Mb(K|0,0,y|0,0)|0;Bc=D;v=Mb(O|0,0,u|0,0)|0;Ec=D;Ac=Mb(N|0,I|0,c|0,z|0)|0;I=D;N=Mb(e|0,P|0,y|0,0)|0;y=D;H=Mb(K|0,0,u|0,0)|0;Dc=D;Cc=Mb(O|0,0,c|0,z|0)|0;O=Ab(H|0,Dc|0,Cc|0,D|0)|0;Cc=Ab(O|0,D|0,N|0,y|0)|0;y=D;N=Mb(e|0,P|0,u|0,0)|0;u=D;O=Mb(K|0,0,c|0,z|0)|0;K=Ab(N|0,u|0,O|0,D|0)|0;O=D;u=Mb(e|0,P|0,c|0,z|0)|0;z=D;c=Ab(da|0,fa|0,1048576,0)|0;P=Cb(c|0,D|0,21)|0;c=D;e=Ab(G|0,Q|0,J|0,M|0)|0;M=Ab(e|0,D|0,P|0,c|0)|0;e=Ab(M|0,D|0,X&2097151|0,0)|0;X=D;M=Db(P|0,c|0,21)|0;c=zb(da|0,fa|0,M|0,D|0)|0;M=D;fa=Ab(ea|0,S|0,1048576,0)|0;da=Cb(fa|0,D|0,21)|0;fa=D;P=Ab(ia|0,ma|0,na|0,oa|0)|0;oa=Ab(P|0,D|0,la|0,ja|0)|0;ja=Ab(oa|0,D|0,ka|0,ba|0)|0;ba=Ab(ja|0,D|0,da|0,fa|0)|0;ja=Ab(ba|0,D|0,Z&2097151|0,0)|0;Z=D;ba=Db(da|0,fa|0,21)|0;fa=D;da=Ab(qa|0,_|0,1048576,0)|0;ka=yb(da|0,D|0,21)|0;da=D;oa=Ab(va|0,za|0,Aa|0,Ba|0)|0;Ba=Ab(oa|0,D|0,ya|0,wa|0)|0;wa=Ab(Ba|0,D|0,xa|0,ta|0)|0;ta=Ab(wa|0,D|0,ua|0,ra|0)|0;ra=Ab(ta|0,D|0,sa|0,pa|0)|0;pa=Ab(ra|0,D|0,W&2097151|0,0)|0;W=Ab(pa|0,D|0,ka|0,da|0)|0;pa=D;ra=Db(ka|0,da|0,21)|0;da=D;ka=Ab(Da|0,aa|0,1048576,0)|0;sa=yb(ka|0,D|0,21)|0;ka=D;ta=Ab(Ma|0,Qa|0,Ra|0,Sa|0)|0;Sa=Ab(ta|0,D|0,Pa|0,Na|0)|0;Na=Ab(Sa|0,D|0,Oa|0,Ka|0)|0;Ka=Ab(Na|0,D|0,La|0,Ia|0)|0;Ia=Ab(Ka|0,D|0,Ja|0,Ga|0)|0;Ga=Ab(Ia|0,D|0,Ha|0,Ea|0)|0;Ea=Ab(Ga|0,D|0,Fa|0,Ca|0)|0;Ca=Ab(Ea|0,D|0,U|0,Y|0)|0;Y=Ab(Ca|0,D|0,sa|0,ka|0)|0;Ca=D;U=Db(sa|0,ka|0,21)|0;ka=D;sa=Ab(Ua|0,T|0,1048576,0)|0;Ea=yb(sa|0,D|0,21)|0;sa=D;Fa=Ab(db|0,ib|0,gb|0,fb|0)|0;fb=Ab(Fa|0,D|0,bb|0,hb|0)|0;hb=Ab(fb|0,D|0,$a|0,eb|0)|0;eb=Ab(hb|0,D|0,Za|0,cb|0)|0;cb=Ab(eb|0,D|0,Xa|0,ab|0)|0;ab=Ab(cb|0,D|0,Va|0,_a|0)|0;_a=Ab(ab|0,D|0,Ta|0,Ya|0)|0;Ya=Ab(_a|0,D|0,$|0,Wa|0)|0;Wa=Ab(Ya|0,D|0,V|0,R|0)|0;R=Ab(Wa|0,D|0,Ea|0,sa|0)|0;Wa=Ab(R|0,D|0,ha&2097151|0,0)|0;ha=D;R=Db(Ea|0,sa|0,21)|0;sa=D;Ea=Ab(kb|0,ca|0,1048576,0)|0;V=yb(Ea|0,D|0,21)|0;Ea=D;Ya=Ab(Jb|0,Hb|0,Gb|0,q|0)|0;q=Ab(Ya|0,D|0,Ib|0,Eb|0)|0;Eb=Ab(q|0,D|0,Fb|0,xb|0)|0;xb=Ab(Eb|0,D|0,Bb|0,vb|0)|0;vb=Ab(xb|0,D|0,wb|0,tb|0)|0;tb=Ab(vb|0,D|0,ub|0,rb|0)|0;rb=Ab(tb|0,D|0,sb|0,pb|0)|0;pb=Ab(rb|0,D|0,qb|0,nb|0)|0;nb=Ab(pb|0,D|0,ob|0,lb|0)|0;lb=Ab(nb|0,D|0,n|0,jb|0)|0;jb=Ab(lb|0,D|0,mb|0,l|0)|0;l=Ab(jb|0,D|0,f|0,ga|0)|0;ga=Ab(l|0,D|0,V|0,Ea|0)|0;l=D;f=Db(V|0,Ea|0,21)|0;Ea=D;V=Ab(Lb|0,o|0,1048576,0)|0;jb=yb(V|0,D|0,21)|0;V=D;mb=Ab(bc|0,Zb|0,E|0,w|0)|0;w=Ab(mb|0,D|0,_b|0,Xb|0)|0;Xb=Ab(w|0,D|0,Yb|0,Vb|0)|0;Vb=Ab(Xb|0,D|0,Wb|0,Tb|0)|0;Tb=Ab(Vb|0,D|0,Ub|0,Rb|0)|0;Rb=Ab(Tb|0,D|0,Sb|0,Pb|0)|0;Pb=Ab(Rb|0,D|0,Qb|0,Nb|0)|0;Nb=Ab(Pb|0,D|0,Ob|0,Kb|0)|0;Kb=Ab(Nb|0,D|0,C|0,k|0)|0;k=Ab(Kb|0,D|0,jb|0,V|0)|0;Kb=D;C=Db(jb|0,V|0,21)|0;V=D;jb=Ab(cc|0,p|0,1048576,0)|0;Nb=yb(jb|0,D|0,21)|0;jb=D;Ob=Ab(pc|0,lc|0,F|0,B|0)|0;B=Ab(Ob|0,D|0,mc|0,jc|0)|0;jc=Ab(B|0,D|0,kc|0,hc|0)|0;hc=Ab(jc|0,D|0,ic|0,fc|0)|0;fc=Ab(hc|0,D|0,gc|0,dc|0)|0;dc=Ab(fc|0,D|0,ec|0,$b|0)|0;$b=Ab(dc|0,D|0,ac|0,m|0)|0;m=Ab($b|0,D|0,Nb|0,jb|0)|0;$b=D;ac=Db(Nb|0,jb|0,21)|0;jb=D;Nb=Ab(qc|0,j|0,1048576,0)|0;dc=yb(Nb|0,D|0,21)|0;Nb=D;ec=Ab(zc|0,vc|0,t|0,A|0)|0;A=Ab(ec|0,D|0,wc|0,tc|0)|0;tc=Ab(A|0,D|0,uc|0,rc|0)|0;rc=Ab(tc|0,D|0,sc|0,nc|0)|0;nc=Ab(rc|0,D|0,oc|0,h|0)|0;h=Ab(nc|0,D|0,dc|0,Nb|0)|0;nc=D;oc=Db(dc|0,Nb|0,21)|0;Nb=D;dc=Ab(xc|0,r|0,1048576,0)|0;rc=yb(dc|0,D|0,21)|0;dc=D;sc=Ab(v|0,Ec|0,Ac|0,I|0)|0;I=Ab(sc|0,D|0,x|0,Bc|0)|0;Bc=Ab(I|0,D|0,yc|0,s|0)|0;s=Ab(Bc|0,D|0,rc|0,dc|0)|0;Bc=D;yc=Db(rc|0,dc|0,21)|0;dc=zb(xc|0,r|0,yc|0,D|0)|0;yc=D;r=Ab(Cc|0,y|0,1048576,0)|0;xc=Cb(r|0,D|0,21)|0;r=D;rc=Ab(K|0,O|0,xc|0,r|0)|0;O=D;K=Db(xc|0,r|0,21)|0;r=zb(Cc|0,y|0,K|0,D|0)|0;K=D;y=Ab(u|0,z|0,1048576,0)|0;Cc=Cb(y|0,D|0,21)|0;y=D;xc=Db(Cc|0,y|0,21)|0;I=zb(u|0,z|0,xc|0,D|0)|0;xc=D;z=Ab(e|0,X|0,1048576,0)|0;u=Cb(z|0,D|0,21)|0;z=D;x=Db(u|0,z|0,21)|0;sc=zb(e|0,X|0,x|0,D|0)|0;x=D;X=Ab(ja|0,Z|0,1048576,0)|0;e=yb(X|0,D|0,21)|0;X=D;Ac=Db(e|0,X|0,21)|0;Ec=zb(ja|0,Z|0,Ac|0,D|0)|0;Ac=D;Z=Ab(W|0,pa|0,1048576,0)|0;ja=yb(Z|0,D|0,21)|0;Z=D;v=Db(ja|0,Z|0,21)|0;tc=D;uc=Ab(Y|0,Ca|0,1048576,0)|0;A=yb(uc|0,D|0,21)|0;uc=D;wc=Db(A|0,uc|0,21)|0;ec=D;t=Ab(Wa|0,ha|0,1048576,0)|0;vc=yb(t|0,D|0,21)|0;t=D;zc=Db(vc|0,t|0,21)|0;fc=D;gc=Ab(ga|0,l|0,1048576,0)|0;hc=yb(gc|0,D|0,21)|0;gc=D;ic=Db(hc|0,gc|0,21)|0;jc=D;kc=Ab(k|0,Kb|0,1048576,0)|0;B=yb(kc|0,D|0,21)|0;kc=D;mc=Db(B|0,kc|0,21)|0;Ob=D;F=Ab(m|0,$b|0,1048576,0)|0;lc=yb(F|0,D|0,21)|0;F=D;pc=Db(lc|0,F|0,21)|0;Pb=D;Qb=Ab(h|0,nc|0,1048576,0)|0;Rb=yb(Qb|0,D|0,21)|0;Qb=D;Sb=Ab(Rb|0,Qb|0,dc|0,yc|0)|0;yc=D;dc=Db(Rb|0,Qb|0,21)|0;Qb=zb(h|0,nc|0,dc|0,D|0)|0;dc=D;nc=Ab(s|0,Bc|0,1048576,0)|0;h=yb(nc|0,D|0,21)|0;nc=D;Rb=Ab(h|0,nc|0,r|0,K|0)|0;K=D;r=Db(h|0,nc|0,21)|0;nc=zb(s|0,Bc|0,r|0,D|0)|0;r=D;Bc=Ab(rc|0,O|0,1048576,0)|0;s=Cb(Bc|0,D|0,21)|0;Bc=D;h=Ab(s|0,Bc|0,I|0,xc|0)|0;xc=D;I=Db(s|0,Bc|0,21)|0;Bc=zb(rc|0,O|0,I|0,D|0)|0;I=D;O=Mb(Cc|0,y|0,666643,0)|0;rc=D;s=Mb(Cc|0,y|0,470296,0)|0;Tb=D;Ub=Mb(Cc|0,y|0,654183,0)|0;Vb=D;Wb=Mb(Cc|0,y|0,-997805,-1)|0;Xb=D;Yb=Mb(Cc|0,y|0,136657,0)|0;w=D;_b=Mb(Cc|0,y|0,-683901,-1)|0;y=Ab(_b|0,D|0,qc|0,j|0)|0;j=zb(y|0,D|0,oc|0,Nb|0)|0;Nb=Ab(j|0,D|0,lc|0,F|0)|0;F=D;lc=Mb(h|0,xc|0,666643,0)|0;j=D;oc=Mb(h|0,xc|0,470296,0)|0;y=D;qc=Mb(h|0,xc|0,654183,0)|0;_b=D;Cc=Mb(h|0,xc|0,-997805,-1)|0;mb=D;E=Mb(h|0,xc|0,136657,0)|0;Zb=D;bc=Mb(h|0,xc|0,-683901,-1)|0;xc=D;h=Mb(Bc|0,I|0,666643,0)|0;lb=D;n=Mb(Bc|0,I|0,470296,0)|0;nb=D;ob=Mb(Bc|0,I|0,654183,0)|0;pb=D;qb=Mb(Bc|0,I|0,-997805,-1)|0;rb=D;sb=Mb(Bc|0,I|0,136657,0)|0;tb=D;ub=Mb(Bc|0,I|0,-683901,-1)|0;I=D;Bc=Ab(Wb|0,Xb|0,cc|0,p|0)|0;p=zb(Bc|0,D|0,ac|0,jb|0)|0;jb=Ab(p|0,D|0,B|0,kc|0)|0;kc=Ab(jb|0,D|0,E|0,Zb|0)|0;Zb=Ab(kc|0,D|0,ub|0,I|0)|0;I=D;ub=Mb(Rb|0,K|0,666643,0)|0;kc=D;E=Mb(Rb|0,K|0,470296,0)|0;jb=D;B=Mb(Rb|0,K|0,654183,0)|0;p=D;ac=Mb(Rb|0,K|0,-997805,-1)|0;Bc=D;cc=Mb(Rb|0,K|0,136657,0)|0;Xb=D;Wb=Mb(Rb|0,K|0,-683901,-1)|0;K=D;Rb=Mb(nc|0,r|0,666643,0)|0;vb=D;wb=Mb(nc|0,r|0,470296,0)|0;xb=D;Bb=Mb(nc|0,r|0,654183,0)|0;Eb=D;Fb=Mb(nc|0,r|0,-997805,-1)|0;q=D;Ib=Mb(nc|0,r|0,136657,0)|0;Ya=D;Gb=Mb(nc|0,r|0,-683901,-1)|0;r=D;nc=Ab(s|0,Tb|0,Lb|0,o|0)|0;o=zb(nc|0,D|0,C|0,V|0)|0;V=Ab(o|0,D|0,qc|0,_b|0)|0;_b=Ab(V|0,D|0,cc|0,Xb|0)|0;Xb=Ab(_b|0,D|0,qb|0,rb|0)|0;rb=Ab(Xb|0,D|0,Gb|0,r|0)|0;r=Ab(rb|0,D|0,hc|0,gc|0)|0;gc=D;hc=Mb(Sb|0,yc|0,666643,0)|0;rb=Ab(ja|0,Z|0,hc|0,D|0)|0;hc=Ab(rb|0,D|0,Da|0,aa|0)|0;aa=zb(hc|0,D|0,U|0,ka|0)|0;ka=D;U=Mb(Sb|0,yc|0,470296,0)|0;hc=D;Da=Mb(Sb|0,yc|0,654183,0)|0;rb=Ab(Da|0,D|0,ub|0,kc|0)|0;kc=Ab(rb|0,D|0,wb|0,xb|0)|0;xb=Ab(kc|0,D|0,Ua|0,T|0)|0;T=Ab(xb|0,D|0,A|0,uc|0)|0;uc=zb(T|0,D|0,R|0,sa|0)|0;sa=D;R=Mb(Sb|0,yc|0,-997805,-1)|0;T=D;A=Mb(Sb|0,yc|0,136657,0)|0;xb=D;Ua=Ab(B|0,p|0,lc|0,j|0)|0;j=Ab(Ua|0,D|0,A|0,xb|0)|0;xb=Ab(j|0,D|0,n|0,nb|0)|0;nb=Ab(xb|0,D|0,Fb|0,q|0)|0;q=Ab(nb|0,D|0,vc|0,t|0)|0;t=Ab(q|0,D|0,kb|0,ca|0)|0;ca=zb(t|0,D|0,f|0,Ea|0)|0;Ea=D;f=Mb(Sb|0,yc|0,-683901,-1)|0;yc=D;Sb=Ab(aa|0,ka|0,1048576,0)|0;t=yb(Sb|0,D|0,21)|0;Sb=D;kb=Ab(Rb|0,vb|0,U|0,hc|0)|0;hc=Ab(kb|0,D|0,Y|0,Ca|0)|0;Ca=zb(hc|0,D|0,wc|0,ec|0)|0;ec=Ab(Ca|0,D|0,t|0,Sb|0)|0;Ca=D;wc=Db(t|0,Sb|0,21)|0;Sb=D;t=Ab(uc|0,sa|0,1048576,0)|0;hc=yb(t|0,D|0,21)|0;t=D;Y=Ab(R|0,T|0,E|0,jb|0)|0;jb=Ab(Y|0,D|0,h|0,lb|0)|0;lb=Ab(jb|0,D|0,Bb|0,Eb|0)|0;Eb=Ab(lb|0,D|0,Wa|0,ha|0)|0;ha=Ab(Eb|0,D|0,hc|0,t|0)|0;Eb=zb(ha|0,D|0,zc|0,fc|0)|0;fc=D;zc=Db(hc|0,t|0,21)|0;t=D;hc=Ab(ca|0,Ea|0,1048576,0)|0;ha=yb(hc|0,D|0,21)|0;hc=D;Wa=Ab(oc|0,y|0,O|0,rc|0)|0;rc=Ab(Wa|0,D|0,ac|0,Bc|0)|0;Bc=Ab(rc|0,D|0,f|0,yc|0)|0;yc=Ab(Bc|0,D|0,ob|0,pb|0)|0;pb=Ab(yc|0,D|0,Ib|0,Ya|0)|0;Ya=Ab(pb|0,D|0,ga|0,l|0)|0;l=Ab(Ya|0,D|0,ha|0,hc|0)|0;Ya=zb(l|0,D|0,ic|0,jc|0)|0;jc=D;ic=Db(ha|0,hc|0,21)|0;hc=D;ha=Ab(r|0,gc|0,1048576,0)|0;l=yb(ha|0,D|0,21)|0;ha=D;ga=Ab(k|0,Kb|0,Ub|0,Vb|0)|0;Vb=zb(ga|0,D|0,mc|0,Ob|0)|0;Ob=Ab(Vb|0,D|0,Cc|0,mb|0)|0;mb=Ab(Ob|0,D|0,Wb|0,K|0)|0;K=Ab(mb|0,D|0,sb|0,tb|0)|0;tb=Ab(K|0,D|0,l|0,ha|0)|0;K=D;sb=Db(l|0,ha|0,21)|0;ha=zb(r|0,gc|0,sb|0,D|0)|0;sb=D;gc=Ab(Zb|0,I|0,1048576,0)|0;r=yb(gc|0,D|0,21)|0;gc=D;l=Ab(m|0,$b|0,Yb|0,w|0)|0;w=zb(l|0,D|0,pc|0,Pb|0)|0;Pb=Ab(w|0,D|0,bc|0,xc|0)|0;xc=Ab(Pb|0,D|0,r|0,gc|0)|0;Pb=D;bc=Db(r|0,gc|0,21)|0;gc=zb(Zb|0,I|0,bc|0,D|0)|0;bc=D;I=Ab(Nb|0,F|0,1048576,0)|0;Zb=yb(I|0,D|0,21)|0;I=D;r=Ab(Zb|0,I|0,Qb|0,dc|0)|0;dc=D;Qb=Db(Zb|0,I|0,21)|0;I=zb(Nb|0,F|0,Qb|0,D|0)|0;Qb=D;F=Ab(ec|0,Ca|0,1048576,0)|0;Nb=yb(F|0,D|0,21)|0;F=D;Zb=Db(Nb|0,F|0,21)|0;w=D;pc=Ab(Eb|0,fc|0,1048576,0)|0;l=yb(pc|0,D|0,21)|0;pc=D;Yb=Db(l|0,pc|0,21)|0;$b=D;m=Ab(Ya|0,jc|0,1048576,0)|0;mb=yb(m|0,D|0,21)|0;m=D;Wb=Ab(ha|0,sb|0,mb|0,m|0)|0;sb=D;ha=Db(mb|0,m|0,21)|0;m=zb(Ya|0,jc|0,ha|0,D|0)|0;ha=D;jc=Ab(tb|0,K|0,1048576,0)|0;Ya=yb(jc|0,D|0,21)|0;jc=D;mb=Ab(Ya|0,jc|0,gc|0,bc|0)|0;bc=D;gc=Db(Ya|0,jc|0,21)|0;jc=zb(tb|0,K|0,gc|0,D|0)|0;gc=D;K=Ab(xc|0,Pb|0,1048576,0)|0;tb=yb(K|0,D|0,21)|0;K=D;Ya=Ab(tb|0,K|0,I|0,Qb|0)|0;Qb=D;I=Db(tb|0,K|0,21)|0;K=zb(xc|0,Pb|0,I|0,D|0)|0;I=D;Pb=Mb(r|0,dc|0,666643,0)|0;xc=D;tb=Mb(r|0,dc|0,470296,0)|0;Ob=D;Cc=Mb(r|0,dc|0,654183,0)|0;Vb=D;mc=Mb(r|0,dc|0,-997805,-1)|0;ga=D;Ub=Mb(r|0,dc|0,136657,0)|0;Kb=D;k=Mb(r|0,dc|0,-683901,-1)|0;dc=Ab(l|0,pc|0,k|0,D|0)|0;k=Ab(dc|0,D|0,ca|0,Ea|0)|0;Ea=zb(k|0,D|0,ic|0,hc|0)|0;hc=D;ic=Mb(Ya|0,Qb|0,666643,0)|0;k=D;ca=Mb(Ya|0,Qb|0,470296,0)|0;dc=D;pc=Mb(Ya|0,Qb|0,654183,0)|0;l=D;r=Mb(Ya|0,Qb|0,-997805,-1)|0;pb=D;Ib=Mb(Ya|0,Qb|0,136657,0)|0;yc=D;ob=Mb(Ya|0,Qb|0,-683901,-1)|0;Qb=D;Ya=Mb(K|0,I|0,666643,0)|0;Bc=Ab(Ec|0,Ac|0,Ya|0,D|0)|0;Ya=D;Ac=Mb(K|0,I|0,470296,0)|0;Ec=D;f=Mb(K|0,I|0,654183,0)|0;rc=D;ac=Mb(K|0,I|0,-997805,-1)|0;Wa=D;O=Mb(K|0,I|0,136657,0)|0;y=D;oc=Mb(K|0,I|0,-683901,-1)|0;I=D;K=Ab(Ib|0,yc|0,mc|0,ga|0)|0;ga=Ab(K|0,D|0,oc|0,I|0)|0;I=Ab(ga|0,D|0,uc|0,sa|0)|0;sa=Ab(I|0,D|0,Nb|0,F|0)|0;F=zb(sa|0,D|0,zc|0,t|0)|0;t=D;zc=Mb(mb|0,bc|0,666643,0)|0;sa=D;Nb=Mb(mb|0,bc|0,470296,0)|0;I=D;uc=Mb(mb|0,bc|0,654183,0)|0;ga=D;oc=Mb(mb|0,bc|0,-997805,-1)|0;K=D;mc=Mb(mb|0,bc|0,136657,0)|0;yc=D;Ib=Mb(mb|0,bc|0,-683901,-1)|0;bc=D;mb=Mb(jc|0,gc|0,666643,0)|0;lb=D;Bb=Mb(jc|0,gc|0,470296,0)|0;jb=D;h=Mb(jc|0,gc|0,654183,0)|0;Y=D;E=Mb(jc|0,gc|0,-997805,-1)|0;T=D;R=Mb(jc|0,gc|0,136657,0)|0;kb=D;U=Mb(jc|0,gc|0,-683901,-1)|0;gc=D;jc=Ab(pc|0,l|0,tb|0,Ob|0)|0;Ob=Ab(jc|0,D|0,ac|0,Wa|0)|0;Wa=Ab(Ob|0,D|0,aa|0,ka|0)|0;ka=zb(Wa|0,D|0,wc|0,Sb|0)|0;Sb=Ab(ka|0,D|0,mc|0,yc|0)|0;yc=Ab(Sb|0,D|0,U|0,gc|0)|0;gc=D;U=Mb(Wb|0,sb|0,666643,0)|0;Sb=Ab(U|0,D|0,c|0,M|0)|0;M=D;c=Mb(Wb|0,sb|0,470296,0)|0;U=D;mc=Mb(Wb|0,sb|0,654183,0)|0;ka=D;wc=Ab(ea|0,S|0,u|0,z|0)|0;z=zb(wc|0,D|0,ba|0,fa|0)|0;fa=Ab(z|0,D|0,mc|0,ka|0)|0;ka=Ab(fa|0,D|0,zc|0,sa|0)|0;sa=Ab(ka|0,D|0,Bb|0,jb|0)|0;jb=D;Bb=Mb(Wb|0,sb|0,-997805,-1)|0;ka=D;zc=Mb(Wb|0,sb|0,136657,0)|0;fa=D;mc=Ab(ic|0,k|0,e|0,X|0)|0;X=Ab(mc|0,D|0,Ac|0,Ec|0)|0;Ec=Ab(X|0,D|0,qa|0,_|0)|0;_=zb(Ec|0,D|0,ra|0,da|0)|0;da=Ab(_|0,D|0,zc|0,fa|0)|0;fa=Ab(da|0,D|0,uc|0,ga|0)|0;ga=Ab(fa|0,D|0,E|0,T|0)|0;T=D;E=Mb(Wb|0,sb|0,-683901,-1)|0;sb=D;Wb=Ab(Sb|0,M|0,1048576,0)|0;fa=yb(Wb|0,D|0,21)|0;Wb=D;uc=Ab(sc|0,x|0,c|0,U|0)|0;U=Ab(uc|0,D|0,mb|0,lb|0)|0;lb=Ab(U|0,D|0,fa|0,Wb|0)|0;U=D;mb=Db(fa|0,Wb|0,21)|0;Wb=zb(Sb|0,M|0,mb|0,D|0)|0;mb=D;M=Ab(sa|0,jb|0,1048576,0)|0;Sb=yb(M|0,D|0,21)|0;M=D;fa=Ab(Bc|0,Ya|0,Bb|0,ka|0)|0;ka=Ab(fa|0,D|0,Nb|0,I|0)|0;I=Ab(ka|0,D|0,h|0,Y|0)|0;Y=Ab(I|0,D|0,Sb|0,M|0)|0;I=D;h=Db(Sb|0,M|0,21)|0;M=D;Sb=Ab(ga|0,T|0,1048576,0)|0;ka=yb(Sb|0,D|0,21)|0;Sb=D;Nb=Ab(ca|0,dc|0,Pb|0,xc|0)|0;xc=Ab(Nb|0,D|0,f|0,rc|0)|0;rc=Ab(xc|0,D|0,W|0,pa|0)|0;pa=zb(rc|0,D|0,v|0,tc|0)|0;tc=Ab(pa|0,D|0,E|0,sb|0)|0;sb=Ab(tc|0,D|0,oc|0,K|0)|0;K=Ab(sb|0,D|0,R|0,kb|0)|0;kb=Ab(K|0,D|0,ka|0,Sb|0)|0;K=D;R=Db(ka|0,Sb|0,21)|0;Sb=D;ka=Ab(yc|0,gc|0,1048576,0)|0;sb=yb(ka|0,D|0,21)|0;ka=D;oc=Ab(r|0,pb|0,Cc|0,Vb|0)|0;Vb=Ab(oc|0,D|0,O|0,y|0)|0;y=Ab(Vb|0,D|0,ec|0,Ca|0)|0;Ca=zb(y|0,D|0,Zb|0,w|0)|0;w=Ab(Ca|0,D|0,Ib|0,bc|0)|0;bc=Ab(w|0,D|0,sb|0,ka|0)|0;w=D;Ib=Db(sb|0,ka|0,21)|0;ka=zb(yc|0,gc|0,Ib|0,D|0)|0;Ib=D;gc=Ab(F|0,t|0,1048576,0)|0;yc=yb(gc|0,D|0,21)|0;gc=D;sb=Ab(ob|0,Qb|0,Ub|0,Kb|0)|0;Kb=Ab(sb|0,D|0,Eb|0,fc|0)|0;fc=Ab(Kb|0,D|0,yc|0,gc|0)|0;Kb=zb(fc|0,D|0,Yb|0,$b|0)|0;$b=D;Yb=Db(yc|0,gc|0,21)|0;gc=zb(F|0,t|0,Yb|0,D|0)|0;Yb=D;t=Ab(Ea|0,hc|0,1048576,0)|0;F=yb(t|0,D|0,21)|0;t=D;yc=Ab(m|0,ha|0,F|0,t|0)|0;ha=D;m=Db(F|0,t|0,21)|0;t=D;F=Ab(lb|0,U|0,1048576,0)|0;fc=yb(F|0,D|0,21)|0;F=D;Eb=Db(fc|0,F|0,21)|0;sb=D;Ub=Ab(Y|0,I|0,1048576,0)|0;Qb=yb(Ub|0,D|0,21)|0;Ub=D;ob=Db(Qb|0,Ub|0,21)|0;Ca=D;Zb=Ab(kb|0,K|0,1048576,0)|0;y=yb(Zb|0,D|0,21)|0;Zb=D;ec=Ab(ka|0,Ib|0,y|0,Zb|0)|0;Ib=D;ka=Db(y|0,Zb|0,21)|0;Zb=D;y=Ab(bc|0,w|0,1048576,0)|0;Vb=yb(y|0,D|0,21)|0;y=D;O=Ab(gc|0,Yb|0,Vb|0,y|0)|0;Yb=D;gc=Db(Vb|0,y|0,21)|0;y=zb(bc|0,w|0,gc|0,D|0)|0;gc=D;w=Ab(Kb|0,$b|0,1048576,0)|0;bc=yb(w|0,D|0,21)|0;w=D;Vb=Db(bc|0,w|0,21)|0;oc=zb(Kb|0,$b|0,Vb|0,D|0)|0;Vb=D;$b=Ab(yc|0,ha|0,1048576,0)|0;Kb=yb($b|0,D|0,21)|0;$b=D;Cc=Db(Kb|0,$b|0,21)|0;pb=zb(yc|0,ha|0,Cc|0,D|0)|0;Cc=D;ha=Mb(Kb|0,$b|0,666643,0)|0;yc=Ab(Wb|0,mb|0,ha|0,D|0)|0;ha=D;mb=Mb(Kb|0,$b|0,470296,0)|0;Wb=D;r=Mb(Kb|0,$b|0,654183,0)|0;tc=D;E=Mb(Kb|0,$b|0,-997805,-1)|0;pa=D;v=Mb(Kb|0,$b|0,136657,0)|0;rc=D;W=Mb(Kb|0,$b|0,-683901,-1)|0;$b=D;Kb=yb(yc|0,ha|0,21)|0;xc=D;f=Ab(lb|0,U|0,mb|0,Wb|0)|0;Wb=zb(f|0,D|0,Eb|0,sb|0)|0;sb=Ab(Wb|0,D|0,Kb|0,xc|0)|0;Wb=D;Eb=Db(Kb|0,xc|0,21)|0;xc=zb(yc|0,ha|0,Eb|0,D|0)|0;Eb=D;ha=yb(sb|0,Wb|0,21)|0;yc=D;Kb=Ab(r|0,tc|0,sa|0,jb|0)|0;jb=zb(Kb|0,D|0,h|0,M|0)|0;M=Ab(jb|0,D|0,fc|0,F|0)|0;F=Ab(M|0,D|0,ha|0,yc|0)|0;M=D;fc=Db(ha|0,yc|0,21)|0;yc=zb(sb|0,Wb|0,fc|0,D|0)|0;fc=D;Wb=yb(F|0,M|0,21)|0;sb=D;ha=Ab(Y|0,I|0,E|0,pa|0)|0;pa=zb(ha|0,D|0,ob|0,Ca|0)|0;Ca=Ab(pa|0,D|0,Wb|0,sb|0)|0;pa=D;ob=Db(Wb|0,sb|0,21)|0;sb=zb(F|0,M|0,ob|0,D|0)|0;ob=D;M=yb(Ca|0,pa|0,21)|0;F=D;Wb=Ab(v|0,rc|0,ga|0,T|0)|0;T=zb(Wb|0,D|0,R|0,Sb|0)|0;Sb=Ab(T|0,D|0,Qb|0,Ub|0)|0;Ub=Ab(Sb|0,D|0,M|0,F|0)|0;Sb=D;Qb=Db(M|0,F|0,21)|0;F=zb(Ca|0,pa|0,Qb|0,D|0)|0;Qb=D;pa=yb(Ub|0,Sb|0,21)|0;Ca=D;M=Ab(kb|0,K|0,W|0,$b|0)|0;$b=zb(M|0,D|0,ka|0,Zb|0)|0;Zb=Ab($b|0,D|0,pa|0,Ca|0)|0;$b=D;ka=Db(pa|0,Ca|0,21)|0;Ca=zb(Ub|0,Sb|0,ka|0,D|0)|0;ka=D;Sb=yb(Zb|0,$b|0,21)|0;Ub=D;pa=Ab(ec|0,Ib|0,Sb|0,Ub|0)|0;Ib=D;ec=Db(Sb|0,Ub|0,21)|0;Ub=zb(Zb|0,$b|0,ec|0,D|0)|0;ec=D;$b=yb(pa|0,Ib|0,21)|0;Zb=D;Sb=Ab($b|0,Zb|0,y|0,gc|0)|0;gc=D;y=Db($b|0,Zb|0,21)|0;Zb=zb(pa|0,Ib|0,y|0,D|0)|0;y=D;Ib=yb(Sb|0,gc|0,21)|0;pa=D;$b=Ab(O|0,Yb|0,Ib|0,pa|0)|0;Yb=D;O=Db(Ib|0,pa|0,21)|0;pa=zb(Sb|0,gc|0,O|0,D|0)|0;O=D;gc=yb($b|0,Yb|0,21)|0;Sb=D;Ib=Ab(gc|0,Sb|0,oc|0,Vb|0)|0;Vb=D;oc=Db(gc|0,Sb|0,21)|0;Sb=zb($b|0,Yb|0,oc|0,D|0)|0;oc=D;Yb=yb(Ib|0,Vb|0,21)|0;$b=D;gc=Ab(Ea|0,hc|0,bc|0,w|0)|0;w=zb(gc|0,D|0,m|0,t|0)|0;t=Ab(w|0,D|0,Yb|0,$b|0)|0;w=D;m=Db(Yb|0,$b|0,21)|0;$b=zb(Ib|0,Vb|0,m|0,D|0)|0;m=D;Vb=yb(t|0,w|0,21)|0;Ib=D;Yb=Ab(Vb|0,Ib|0,pb|0,Cc|0)|0;Cc=D;pb=Db(Vb|0,Ib|0,21)|0;Ib=zb(t|0,w|0,pb|0,D|0)|0;pb=D;w=yb(Yb|0,Cc|0,21)|0;t=D;Vb=Db(w|0,t|0,21)|0;gc=zb(Yb|0,Cc|0,Vb|0,D|0)|0;Vb=D;Cc=Mb(w|0,t|0,666643,0)|0;Yb=Ab(Cc|0,D|0,xc|0,Eb|0)|0;Eb=D;xc=Mb(w|0,t|0,470296,0)|0;Cc=Ab(yc|0,fc|0,xc|0,D|0)|0;xc=D;fc=Mb(w|0,t|0,654183,0)|0;yc=Ab(sb|0,ob|0,fc|0,D|0)|0;fc=D;ob=Mb(w|0,t|0,-997805,-1)|0;sb=Ab(F|0,Qb|0,ob|0,D|0)|0;ob=D;Qb=Mb(w|0,t|0,136657,0)|0;F=Ab(Ca|0,ka|0,Qb|0,D|0)|0;Qb=D;ka=Mb(w|0,t|0,-683901,-1)|0;t=Ab(Ub|0,ec|0,ka|0,D|0)|0;ka=D;ec=yb(Yb|0,Eb|0,21)|0;Ub=D;w=Ab(Cc|0,xc|0,ec|0,Ub|0)|0;xc=D;Cc=Db(ec|0,Ub|0,21)|0;Ub=zb(Yb|0,Eb|0,Cc|0,D|0)|0;Cc=D;Eb=yb(w|0,xc|0,21)|0;Yb=D;ec=Ab(yc|0,fc|0,Eb|0,Yb|0)|0;fc=D;yc=Db(Eb|0,Yb|0,21)|0;Yb=zb(w|0,xc|0,yc|0,D|0)|0;yc=D;xc=yb(ec|0,fc|0,21)|0;w=D;Eb=Ab(sb|0,ob|0,xc|0,w|0)|0;ob=D;sb=Db(xc|0,w|0,21)|0;w=zb(ec|0,fc|0,sb|0,D|0)|0;sb=D;fc=yb(Eb|0,ob|0,21)|0;ec=D;xc=Ab(F|0,Qb|0,fc|0,ec|0)|0;Qb=D;F=Db(fc|0,ec|0,21)|0;ec=zb(Eb|0,ob|0,F|0,D|0)|0;F=D;ob=yb(xc|0,Qb|0,21)|0;Eb=D;fc=Ab(t|0,ka|0,ob|0,Eb|0)|0;ka=D;t=Db(ob|0,Eb|0,21)|0;Eb=zb(xc|0,Qb|0,t|0,D|0)|0;t=D;Qb=yb(fc|0,ka|0,21)|0;xc=D;ob=Ab(Qb|0,xc|0,Zb|0,y|0)|0;y=D;Zb=Db(Qb|0,xc|0,21)|0;xc=zb(fc|0,ka|0,Zb|0,D|0)|0;Zb=D;ka=yb(ob|0,y|0,21)|0;fc=D;Qb=Ab(ka|0,fc|0,pa|0,O|0)|0;O=D;pa=Db(ka|0,fc|0,21)|0;fc=zb(ob|0,y|0,pa|0,D|0)|0;pa=D;y=yb(Qb|0,O|0,21)|0;ob=D;ka=Ab(y|0,ob|0,Sb|0,oc|0)|0;oc=D;Sb=Db(y|0,ob|0,21)|0;ob=zb(Qb|0,O|0,Sb|0,D|0)|0;Sb=D;O=yb(ka|0,oc|0,21)|0;Qb=D;y=Ab(O|0,Qb|0,$b|0,m|0)|0;m=D;$b=Db(O|0,Qb|0,21)|0;Qb=zb(ka|0,oc|0,$b|0,D|0)|0;$b=D;oc=yb(y|0,m|0,21)|0;ka=D;O=Ab(oc|0,ka|0,Ib|0,pb|0)|0;pb=D;Ib=Db(oc|0,ka|0,21)|0;ka=zb(y|0,m|0,Ib|0,D|0)|0;Ib=D;m=yb(O|0,pb|0,21)|0;y=D;oc=Ab(m|0,y|0,gc|0,Vb|0)|0;Vb=D;gc=Db(m|0,y|0,21)|0;y=zb(O|0,pb|0,gc|0,D|0)|0;gc=D;a[b>>0]=Ub;pb=Cb(Ub|0,Cc|0,8)|0;a[b+1>>0]=pb;pb=Cb(Ub|0,Cc|0,16)|0;Cc=D;Cc=Db(Yb|0,yc|0,5)|0;a[b+2>>0]=Cc|pb;pb=Cb(Yb|0,yc|0,3)|0;a[b+3>>0]=pb;pb=Cb(Yb|0,yc|0,11)|0;a[b+4>>0]=pb;pb=Cb(Yb|0,yc|0,19)|0;yc=D;yc=Db(w|0,sb|0,2)|0;a[b+5>>0]=yc|pb;pb=Cb(w|0,sb|0,6)|0;a[b+6>>0]=pb;pb=Cb(w|0,sb|0,14)|0;sb=D;sb=Db(ec|0,F|0,7)|0;a[b+7>>0]=sb|pb;pb=Cb(ec|0,F|0,1)|0;a[b+8>>0]=pb;pb=Cb(ec|0,F|0,9)|0;a[b+9>>0]=pb;pb=Cb(ec|0,F|0,17)|0;F=D;F=Db(Eb|0,t|0,4)|0;a[b+10>>0]=F|pb;pb=Cb(Eb|0,t|0,4)|0;a[b+11>>0]=pb;pb=Cb(Eb|0,t|0,12)|0;a[b+12>>0]=pb;pb=Cb(Eb|0,t|0,20)|0;t=D;t=Db(xc|0,Zb|0,1)|0;a[b+13>>0]=t|pb;pb=Cb(xc|0,Zb|0,7)|0;a[b+14>>0]=pb;pb=Cb(xc|0,Zb|0,15)|0;Zb=D;Zb=Db(fc|0,pa|0,6)|0;a[b+15>>0]=Zb|pb;pb=Cb(fc|0,pa|0,2)|0;a[b+16>>0]=pb;pb=Cb(fc|0,pa|0,10)|0;a[b+17>>0]=pb;pb=Cb(fc|0,pa|0,18)|0;pa=D;pa=Db(ob|0,Sb|0,3)|0;a[b+18>>0]=pa|pb;pb=Cb(ob|0,Sb|0,5)|0;a[b+19>>0]=pb;pb=Cb(ob|0,Sb|0,13)|0;a[b+20>>0]=pb;a[b+21>>0]=Qb;pb=Cb(Qb|0,$b|0,8)|0;a[b+22>>0]=pb;pb=Cb(Qb|0,$b|0,16)|0;$b=D;$b=Db(ka|0,Ib|0,5)|0;a[b+23>>0]=$b|pb;pb=Cb(ka|0,Ib|0,3)|0;a[b+24>>0]=pb;pb=Cb(ka|0,Ib|0,11)|0;a[b+25>>0]=pb;pb=Cb(ka|0,Ib|0,19)|0;Ib=D;Ib=Db(y|0,gc|0,2)|0;a[b+26>>0]=Ib|pb;pb=Cb(y|0,gc|0,6)|0;a[b+27>>0]=pb;pb=Cb(y|0,gc|0,14)|0;gc=D;gc=Db(oc|0,Vb|0,7)|0;a[b+28>>0]=pb|gc;gc=Cb(oc|0,Vb|0,1)|0;a[b+29>>0]=gc;gc=Cb(oc|0,Vb|0,9)|0;a[b+30>>0]=gc;gc=Cb(oc|0,Vb|0,17)|0;a[b+31>>0]=gc;i=g;return}function pb(b){b=b|0;var c=0,e=0,f=0,g=0,h=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0,L=0,M=0,N=0,O=0,P=0,Q=0,R=0,S=0,T=0,U=0,V=0,W=0,X=0,Y=0,Z=0,_=0,$=0,aa=0,ba=0,ca=0,da=0,ea=0,fa=0,ga=0,ha=0,ia=0,ja=0,ka=0,la=0,ma=0,na=0,oa=0,pa=0,qa=0,ra=0,sa=0,ta=0,ua=0,va=0,wa=0,xa=0,ya=0,za=0,Aa=0,Ba=0,Ca=0,Da=0,Ea=0,Fa=0,Ga=0,Ha=0,Ia=0,Ja=0,Ka=0,La=0,Ma=0,Na=0,Oa=0,Pa=0,Qa=0,Ra=0,Sa=0,Ta=0,Ua=0,Va=0,Wa=0,Xa=0,Ya=0,Za=0,_a=0,$a=0,ab=0,bb=0,cb=0,db=0,eb=0,fb=0,gb=0,hb=0,ib=0,jb=0;c=i;e=b+1|0;f=b+2|0;g=a[f>>0]|0;h=d[b>>0]|0;j=Db(d[e>>0]|0|0,0,8)|0;k=D;l=g&255;g=Db(l|0,0,16)|0;m=b+3|0;n=Db(d[m>>0]|0|0,0,8)|0;o=D;p=b+4|0;q=Db(d[p>>0]|0|0,0,16)|0;r=o|D;o=b+5|0;s=d[o>>0]|0;t=Db(s|0,0,24)|0;u=Cb(n|l|q|t|0,r|D|0,5)|0;r=b+6|0;t=b+7|0;q=a[t>>0]|0;l=Db(d[r>>0]|0|0,0,8)|0;n=D;v=q&255;q=Db(v|0,0,16)|0;w=Cb(l|s|q|0,n|D|0,2)|0;n=b+8|0;q=Db(d[n>>0]|0|0,0,8)|0;s=D;l=b+9|0;x=Db(d[l>>0]|0|0,0,16)|0;y=s|D;s=b+10|0;z=d[s>>0]|0;A=Db(z|0,0,24)|0;B=Cb(q|v|x|A|0,y|D|0,7)|0;y=b+11|0;A=Db(d[y>>0]|0|0,0,8)|0;x=D;v=b+12|0;q=Db(d[v>>0]|0|0,0,16)|0;C=x|D;x=b+13|0;E=d[x>>0]|0;F=Db(E|0,0,24)|0;G=Cb(A|z|q|F|0,C|D|0,4)|0;C=b+14|0;F=b+15|0;q=a[F>>0]|0;z=Db(d[C>>0]|0|0,0,8)|0;A=D;H=q&255;q=Db(H|0,0,16)|0;I=Cb(z|E|q|0,A|D|0,1)|0;A=b+16|0;q=Db(d[A>>0]|0|0,0,8)|0;E=D;z=b+17|0;J=Db(d[z>>0]|0|0,0,16)|0;K=E|D;E=b+18|0;L=d[E>>0]|0;M=Db(L|0,0,24)|0;N=Cb(q|H|J|M|0,K|D|0,6)|0;K=b+19|0;M=b+20|0;J=a[M>>0]|0;H=Db(d[K>>0]|0|0,0,8)|0;q=D;O=Db(J&255|0,0,16)|0;J=Cb(H|L|O|0,q|D|0,3)|0;q=D;O=b+21|0;L=b+22|0;H=b+23|0;P=a[H>>0]|0;Q=d[O>>0]|0;R=Db(d[L>>0]|0|0,0,8)|0;S=D;T=P&255;P=Db(T|0,0,16)|0;U=b+24|0;V=Db(d[U>>0]|0|0,0,8)|0;W=D;X=b+25|0;Y=Db(d[X>>0]|0|0,0,16)|0;Z=W|D;W=b+26|0;_=d[W>>0]|0;$=Db(_|0,0,24)|0;aa=Cb(V|T|Y|$|0,Z|D|0,5)|0;Z=b+27|0;$=b+28|0;Y=a[$>>0]|0;T=Db(d[Z>>0]|0|0,0,8)|0;V=D;ba=Y&255;Y=Db(ba|0,0,16)|0;ca=Cb(T|_|Y|0,V|D|0,2)|0;V=b+29|0;Y=Db(d[V>>0]|0|0,0,8)|0;_=D;T=b+30|0;da=Db(d[T>>0]|0|0,0,16)|0;ea=_|D;_=b+31|0;fa=d[_>>0]|0;ga=Db(fa|0,0,24)|0;ha=Cb(Y|ba|da|ga|0,ea|D|0,7)|0;ea=Db(d[b+32>>0]|0|0,0,8)|0;ga=D;da=Db(d[b+33>>0]|0|0,0,16)|0;ba=ga|D;ga=d[b+34>>0]|0;Y=Db(ga|0,0,24)|0;ia=Cb(ea|fa|da|Y|0,ba|D|0,4)|0;ba=a[b+36>>0]|0;Y=Db(d[b+35>>0]|0|0,0,8)|0;da=D;fa=ba&255;ba=Db(fa|0,0,16)|0;ea=Cb(Y|ga|ba|0,da|D|0,1)|0;da=Db(d[b+37>>0]|0|0,0,8)|0;ba=D;ga=Db(d[b+38>>0]|0|0,0,16)|0;Y=ba|D;ba=d[b+39>>0]|0;ja=Db(ba|0,0,24)|0;ka=Cb(da|fa|ga|ja|0,Y|D|0,6)|0;Y=a[b+41>>0]|0;ja=Db(d[b+40>>0]|0|0,0,8)|0;ga=D;fa=Db(Y&255|0,0,16)|0;Y=Cb(ja|ba|fa|0,ga|D|0,3)|0;ga=D;fa=a[b+44>>0]|0;ba=d[b+42>>0]|0;ja=Db(d[b+43>>0]|0|0,0,8)|0;da=D;la=fa&255;fa=Db(la|0,0,16)|0;ma=Db(d[b+45>>0]|0|0,0,8)|0;na=D;oa=Db(d[b+46>>0]|0|0,0,16)|0;pa=na|D;na=d[b+47>>0]|0;qa=Db(na|0,0,24)|0;ra=Cb(ma|la|oa|qa|0,pa|D|0,5)|0;pa=a[b+49>>0]|0;qa=Db(d[b+48>>0]|0|0,0,8)|0;oa=D;la=pa&255;pa=Db(la|0,0,16)|0;ma=Cb(qa|na|pa|0,oa|D|0,2)|0;oa=ma&2097151;ma=Db(d[b+50>>0]|0|0,0,8)|0;pa=D;na=Db(d[b+51>>0]|0|0,0,16)|0;qa=pa|D;pa=d[b+52>>0]|0;sa=Db(pa|0,0,24)|0;ta=Cb(ma|la|na|sa|0,qa|D|0,7)|0;qa=ta&2097151;ta=Db(d[b+53>>0]|0|0,0,8)|0;sa=D;na=Db(d[b+54>>0]|0|0,0,16)|0;la=sa|D;sa=d[b+55>>0]|0;ma=Db(sa|0,0,24)|0;ua=Cb(ta|pa|na|ma|0,la|D|0,4)|0;la=ua&2097151;ua=a[b+57>>0]|0;ma=Db(d[b+56>>0]|0|0,0,8)|0;na=D;pa=ua&255;ua=Db(pa|0,0,16)|0;ta=Cb(ma|sa|ua|0,na|D|0,1)|0;na=ta&2097151;ta=Db(d[b+58>>0]|0|0,0,8)|0;ua=D;sa=Db(d[b+59>>0]|0|0,0,16)|0;ma=ua|D;ua=d[b+60>>0]|0;va=Db(ua|0,0,24)|0;wa=Cb(ta|pa|sa|va|0,ma|D|0,6)|0;ma=wa&2097151;wa=Db(d[b+61>>0]|0|0,0,8)|0;va=D;sa=Db(d[b+62>>0]|0|0,0,16)|0;pa=va|D;va=Db(d[b+63>>0]|0|0,0,24)|0;ta=Cb(wa|ua|sa|va|0,pa|D|0,3)|0;pa=D;va=Mb(ta|0,pa|0,666643,0)|0;sa=D;ua=Mb(ta|0,pa|0,470296,0)|0;wa=D;xa=Mb(ta|0,pa|0,654183,0)|0;ya=D;za=Mb(ta|0,pa|0,-997805,-1)|0;Aa=D;Ba=Mb(ta|0,pa|0,136657,0)|0;Ca=D;Da=Mb(ta|0,pa|0,-683901,-1)|0;pa=Ab(Da|0,D|0,ja|ba|fa&2031616|0,da|0)|0;da=D;fa=Mb(ma|0,0,666643,0)|0;ba=D;ja=Mb(ma|0,0,470296,0)|0;Da=D;ta=Mb(ma|0,0,654183,0)|0;Ea=D;Fa=Mb(ma|0,0,-997805,-1)|0;Ga=D;Ha=Mb(ma|0,0,136657,0)|0;Ia=D;Ja=Mb(ma|0,0,-683901,-1)|0;ma=D;Ka=Mb(na|0,0,666643,0)|0;La=D;Ma=Mb(na|0,0,470296,0)|0;Na=D;Oa=Mb(na|0,0,654183,0)|0;Pa=D;Qa=Mb(na|0,0,-997805,-1)|0;Ra=D;Sa=Mb(na|0,0,136657,0)|0;Ta=D;Ua=Mb(na|0,0,-683901,-1)|0;na=Ab(Ua|0,D|0,ka&2097151|0,0)|0;ka=Ab(na|0,D|0,Ha|0,Ia|0)|0;Ia=Ab(ka|0,D|0,za|0,Aa|0)|0;Aa=D;za=Mb(la|0,0,666643,0)|0;ka=D;Ha=Mb(la|0,0,470296,0)|0;na=D;Ua=Mb(la|0,0,654183,0)|0;Va=D;Wa=Mb(la|0,0,-997805,-1)|0;Xa=D;Ya=Mb(la|0,0,136657,0)|0;Za=D;_a=Mb(la|0,0,-683901,-1)|0;la=D;$a=Mb(qa|0,0,666643,0)|0;ab=D;bb=Mb(qa|0,0,470296,0)|0;cb=D;db=Mb(qa|0,0,654183,0)|0;eb=D;fb=Mb(qa|0,0,-997805,-1)|0;gb=D;hb=Mb(qa|0,0,136657,0)|0;ib=D;jb=Mb(qa|0,0,-683901,-1)|0;qa=Ab(jb|0,D|0,ia&2097151|0,0)|0;ia=Ab(qa|0,D|0,Ya|0,Za|0)|0;Za=Ab(ia|0,D|0,Qa|0,Ra|0)|0;Ra=Ab(Za|0,D|0,ta|0,Ea|0)|0;Ea=Ab(Ra|0,D|0,ua|0,wa|0)|0;wa=D;ua=Mb(oa|0,0,666643,0)|0;Ra=Ab(ua|0,D|0,N&2097151|0,0)|0;N=D;ua=Mb(oa|0,0,470296,0)|0;ta=D;Za=Mb(oa|0,0,654183,0)|0;Qa=Ab(Za|0,D|0,R|Q|P&2031616|0,S|0)|0;S=Ab(Qa|0,D|0,bb|0,cb|0)|0;cb=Ab(S|0,D|0,za|0,ka|0)|0;ka=D;za=Mb(oa|0,0,-997805,-1)|0;S=D;bb=Mb(oa|0,0,136657,0)|0;Qa=Ab(bb|0,D|0,ca&2097151|0,0)|0;ca=Ab(Qa|0,D|0,fb|0,gb|0)|0;gb=Ab(ca|0,D|0,Ua|0,Va|0)|0;Va=Ab(gb|0,D|0,Ma|0,Na|0)|0;Na=Ab(Va|0,D|0,fa|0,ba|0)|0;ba=D;fa=Mb(oa|0,0,-683901,-1)|0;oa=D;Va=Ab(Ra|0,N|0,1048576,0)|0;Ma=Cb(Va|0,D|0,21)|0;Va=D;gb=Ab(ua|0,ta|0,J|0,q|0)|0;q=Ab(gb|0,D|0,Ma|0,Va|0)|0;gb=Ab(q|0,D|0,$a|0,ab|0)|0;ab=D;$a=Db(Ma|0,Va|0,21)|0;Va=zb(Ra|0,N|0,$a|0,D|0)|0;$a=D;N=Ab(cb|0,ka|0,1048576,0)|0;Ra=Cb(N|0,D|0,21)|0;N=D;Ma=Ab(za|0,S|0,aa&2097151|0,0)|0;aa=Ab(Ma|0,D|0,db|0,eb|0)|0;eb=Ab(aa|0,D|0,Ha|0,na|0)|0;na=Ab(eb|0,D|0,Ka|0,La|0)|0;La=Ab(na|0,D|0,Ra|0,N|0)|0;na=D;Ka=Db(Ra|0,N|0,21)|0;N=D;Ra=Ab(Na|0,ba|0,1048576,0)|0;eb=yb(Ra|0,D|0,21)|0;Ra=D;Ha=Ab(fa|0,oa|0,ha&2097151|0,0)|0;ha=Ab(Ha|0,D|0,hb|0,ib|0)|0;ib=Ab(ha|0,D|0,Wa|0,Xa|0)|0;Xa=Ab(ib|0,D|0,Oa|0,Pa|0)|0;Pa=Ab(Xa|0,D|0,ja|0,Da|0)|0;Da=Ab(Pa|0,D|0,va|0,sa|0)|0;sa=Ab(Da|0,D|0,eb|0,Ra|0)|0;Da=D;va=Db(eb|0,Ra|0,21)|0;Ra=D;eb=Ab(Ea|0,wa|0,1048576,0)|0;Pa=yb(eb|0,D|0,21)|0;eb=D;ja=Ab(_a|0,la|0,ea&2097151|0,0)|0;ea=Ab(ja|0,D|0,Sa|0,Ta|0)|0;Ta=Ab(ea|0,D|0,Fa|0,Ga|0)|0;Ga=Ab(Ta|0,D|0,xa|0,ya|0)|0;ya=Ab(Ga|0,D|0,Pa|0,eb|0)|0;Ga=D;xa=Db(Pa|0,eb|0,21)|0;eb=zb(Ea|0,wa|0,xa|0,D|0)|0;xa=D;wa=Ab(Ia|0,Aa|0,1048576,0)|0;Ea=yb(wa|0,D|0,21)|0;wa=D;Pa=Ab(Ja|0,ma|0,Y|0,ga|0)|0;ga=Ab(Pa|0,D|0,Ba|0,Ca|0)|0;Ca=Ab(ga|0,D|0,Ea|0,wa|0)|0;ga=D;Ba=Db(Ea|0,wa|0,21)|0;wa=zb(Ia|0,Aa|0,Ba|0,D|0)|0;Ba=D;Aa=Ab(pa|0,da|0,1048576,0)|0;Ia=yb(Aa|0,D|0,21)|0;Aa=D;Ea=Ab(Ia|0,Aa|0,ra&2097151|0,0)|0;ra=D;Pa=Db(Ia|0,Aa|0,21)|0;Aa=zb(pa|0,da|0,Pa|0,D|0)|0;Pa=D;da=Ab(gb|0,ab|0,1048576,0)|0;pa=Cb(da|0,D|0,21)|0;da=D;Ia=Db(pa|0,da|0,21)|0;Y=zb(gb|0,ab|0,Ia|0,D|0)|0;Ia=D;ab=Ab(La|0,na|0,1048576,0)|0;gb=yb(ab|0,D|0,21)|0;ab=D;ma=Db(gb|0,ab|0,21)|0;Ja=zb(La|0,na|0,ma|0,D|0)|0;ma=D;na=Ab(sa|0,Da|0,1048576,0)|0;La=yb(na|0,D|0,21)|0;na=D;Ta=Ab(eb|0,xa|0,La|0,na|0)|0;xa=D;eb=Db(La|0,na|0,21)|0;na=zb(sa|0,Da|0,eb|0,D|0)|0;eb=D;Da=Ab(ya|0,Ga|0,1048576,0)|0;sa=yb(Da|0,D|0,21)|0;Da=D;La=Ab(sa|0,Da|0,wa|0,Ba|0)|0;Ba=D;wa=Db(sa|0,Da|0,21)|0;Da=zb(ya|0,Ga|0,wa|0,D|0)|0;wa=D;Ga=Ab(Ca|0,ga|0,1048576,0)|0;ya=yb(Ga|0,D|0,21)|0;Ga=D;sa=Ab(ya|0,Ga|0,Aa|0,Pa|0)|0;Pa=D;Aa=Db(ya|0,Ga|0,21)|0;Ga=zb(Ca|0,ga|0,Aa|0,D|0)|0;Aa=D;ga=Mb(Ea|0,ra|0,666643,0)|0;Ca=Ab(ga|0,D|0,I&2097151|0,0)|0;I=D;ga=Mb(Ea|0,ra|0,470296,0)|0;ya=Ab(Va|0,$a|0,ga|0,D|0)|0;ga=D;$a=Mb(Ea|0,ra|0,654183,0)|0;Va=Ab(Y|0,Ia|0,$a|0,D|0)|0;$a=D;Ia=Mb(Ea|0,ra|0,-997805,-1)|0;Y=D;Fa=Mb(Ea|0,ra|0,136657,0)|0;ea=Ab(Ja|0,ma|0,Fa|0,D|0)|0;Fa=D;ma=Mb(Ea|0,ra|0,-683901,-1)|0;ra=D;Ea=Ab(Na|0,ba|0,gb|0,ab|0)|0;ab=zb(Ea|0,D|0,va|0,Ra|0)|0;Ra=Ab(ab|0,D|0,ma|0,ra|0)|0;ra=D;ma=Mb(sa|0,Pa|0,666643,0)|0;ab=D;va=Mb(sa|0,Pa|0,470296,0)|0;Ea=D;gb=Mb(sa|0,Pa|0,654183,0)|0;ba=Ab(ya|0,ga|0,gb|0,D|0)|0;gb=D;ga=Mb(sa|0,Pa|0,-997805,-1)|0;ya=Ab(Va|0,$a|0,ga|0,D|0)|0;ga=D;$a=Mb(sa|0,Pa|0,136657,0)|0;Va=D;Na=Mb(sa|0,Pa|0,-683901,-1)|0;Pa=Ab(ea|0,Fa|0,Na|0,D|0)|0;Na=D;Fa=Mb(Ga|0,Aa|0,666643,0)|0;ea=D;sa=Mb(Ga|0,Aa|0,470296,0)|0;Ja=D;Sa=Mb(Ga|0,Aa|0,654183,0)|0;ja=D;la=Mb(Ga|0,Aa|0,-997805,-1)|0;_a=D;Xa=Mb(Ga|0,Aa|0,136657,0)|0;Oa=D;ib=Mb(Ga|0,Aa|0,-683901,-1)|0;Aa=D;Ga=Ab(cb|0,ka|0,pa|0,da|0)|0;da=zb(Ga|0,D|0,Ka|0,N|0)|0;N=Ab(da|0,D|0,Ia|0,Y|0)|0;Y=Ab(N|0,D|0,$a|0,Va|0)|0;Va=Ab(Y|0,D|0,ib|0,Aa|0)|0;Aa=D;ib=Mb(La|0,Ba|0,666643,0)|0;Y=D;$a=Mb(La|0,Ba|0,470296,0)|0;N=D;Ia=Mb(La|0,Ba|0,654183,0)|0;da=D;Ka=Mb(La|0,Ba|0,-997805,-1)|0;Ga=D;pa=Mb(La|0,Ba|0,136657,0)|0;ka=D;cb=Mb(La|0,Ba|0,-683901,-1)|0;Ba=D;La=Mb(Da|0,wa|0,666643,0)|0;Wa=D;ha=Mb(Da|0,wa|0,470296,0)|0;hb=D;Ha=Mb(Da|0,wa|0,654183,0)|0;oa=D;fa=Mb(Da|0,wa|0,-997805,-1)|0;aa=D;db=Mb(Da|0,wa|0,136657,0)|0;Ma=D;S=Mb(Da|0,wa|0,-683901,-1)|0;wa=D;Da=Ab(ba|0,gb|0,pa|0,ka|0)|0;ka=Ab(Da|0,D|0,la|0,_a|0)|0;_a=Ab(ka|0,D|0,S|0,wa|0)|0;wa=D;S=Mb(Ta|0,xa|0,666643,0)|0;ka=Ab(S|0,D|0,j|h|g&2031616|0,k|0)|0;k=D;g=Mb(Ta|0,xa|0,470296,0)|0;h=D;j=Mb(Ta|0,xa|0,654183,0)|0;S=Ab(j|0,D|0,w&2097151|0,0)|0;w=Ab(S|0,D|0,ib|0,Y|0)|0;Y=Ab(w|0,D|0,ha|0,hb|0)|0;hb=D;ha=Mb(Ta|0,xa|0,-997805,-1)|0;w=D;ib=Mb(Ta|0,xa|0,136657,0)|0;S=Ab(ib|0,D|0,G&2097151|0,0)|0;G=Ab(S|0,D|0,ma|0,ab|0)|0;ab=Ab(G|0,D|0,Ia|0,da|0)|0;da=Ab(ab|0,D|0,sa|0,Ja|0)|0;Ja=Ab(da|0,D|0,fa|0,aa|0)|0;aa=D;fa=Mb(Ta|0,xa|0,-683901,-1)|0;xa=D;Ta=Ab(ka|0,k|0,1048576,0)|0;da=yb(Ta|0,D|0,21)|0;Ta=D;sa=Ab(g|0,h|0,u&2097151|0,0)|0;u=Ab(sa|0,D|0,La|0,Wa|0)|0;Wa=Ab(u|0,D|0,da|0,Ta|0)|0;u=D;La=Db(da|0,Ta|0,21)|0;Ta=zb(ka|0,k|0,La|0,D|0)|0;La=D;k=Ab(Y|0,hb|0,1048576,0)|0;ka=yb(k|0,D|0,21)|0;k=D;da=Ab(ha|0,w|0,B&2097151|0,0)|0;B=Ab(da|0,D|0,$a|0,N|0)|0;N=Ab(B|0,D|0,Fa|0,ea|0)|0;ea=Ab(N|0,D|0,Ha|0,oa|0)|0;oa=Ab(ea|0,D|0,ka|0,k|0)|0;ea=D;Ha=Db(ka|0,k|0,21)|0;k=D;ka=Ab(Ja|0,aa|0,1048576,0)|0;N=yb(ka|0,D|0,21)|0;ka=D;Fa=Ab(Ca|0,I|0,fa|0,xa|0)|0;xa=Ab(Fa|0,D|0,va|0,Ea|0)|0;Ea=Ab(xa|0,D|0,Ka|0,Ga|0)|0;Ga=Ab(Ea|0,D|0,Sa|0,ja|0)|0;ja=Ab(Ga|0,D|0,db|0,Ma|0)|0;Ma=Ab(ja|0,D|0,N|0,ka|0)|0;ja=D;db=Db(N|0,ka|0,21)|0;ka=D;N=Ab(_a|0,wa|0,1048576,0)|0;Ga=yb(N|0,D|0,21)|0;N=D;Sa=Ab(ya|0,ga|0,cb|0,Ba|0)|0;Ba=Ab(Sa|0,D|0,Xa|0,Oa|0)|0;Oa=Ab(Ba|0,D|0,Ga|0,N|0)|0;Ba=D;Xa=Db(Ga|0,N|0,21)|0;N=zb(_a|0,wa|0,Xa|0,D|0)|0;Xa=D;wa=Ab(Va|0,Aa|0,1048576,0)|0;_a=yb(wa|0,D|0,21)|0;wa=D;Ga=Ab(Pa|0,Na|0,_a|0,wa|0)|0;Na=D;Pa=Db(_a|0,wa|0,21)|0;wa=zb(Va|0,Aa|0,Pa|0,D|0)|0;Pa=D;Aa=Ab(Ra|0,ra|0,1048576,0)|0;Va=yb(Aa|0,D|0,21)|0;Aa=D;_a=Ab(Va|0,Aa|0,na|0,eb|0)|0;eb=D;na=Db(Va|0,Aa|0,21)|0;Aa=zb(Ra|0,ra|0,na|0,D|0)|0;na=D;ra=Ab(Wa|0,u|0,1048576,0)|0;Ra=yb(ra|0,D|0,21)|0;ra=D;Va=Db(Ra|0,ra|0,21)|0;Sa=D;cb=Ab(oa|0,ea|0,1048576,0)|0;ga=yb(cb|0,D|0,21)|0;cb=D;ya=Db(ga|0,cb|0,21)|0;Ea=D;Ka=Ab(Ma|0,ja|0,1048576,0)|0;xa=yb(Ka|0,D|0,21)|0;Ka=D;va=Ab(N|0,Xa|0,xa|0,Ka|0)|0;Xa=D;N=Db(xa|0,Ka|0,21)|0;Ka=D;xa=Ab(Oa|0,Ba|0,1048576,0)|0;Fa=yb(xa|0,D|0,21)|0;xa=D;fa=Ab(wa|0,Pa|0,Fa|0,xa|0)|0;Pa=D;wa=Db(Fa|0,xa|0,21)|0;xa=zb(Oa|0,Ba|0,wa|0,D|0)|0;wa=D;Ba=Ab(Ga|0,Na|0,1048576,0)|0;Oa=yb(Ba|0,D|0,21)|0;Ba=D;Fa=Ab(Aa|0,na|0,Oa|0,Ba|0)|0;na=D;Aa=Db(Oa|0,Ba|0,21)|0;Ba=zb(Ga|0,Na|0,Aa|0,D|0)|0;Aa=D;Na=Ab(_a|0,eb|0,1048576,0)|0;Ga=yb(Na|0,D|0,21)|0;Na=D;Oa=Db(Ga|0,Na|0,21)|0;I=zb(_a|0,eb|0,Oa|0,D|0)|0;Oa=D;eb=Mb(Ga|0,Na|0,666643,0)|0;_a=Ab(Ta|0,La|0,eb|0,D|0)|0;eb=D;La=Mb(Ga|0,Na|0,470296,0)|0;Ta=D;Ca=Mb(Ga|0,Na|0,654183,0)|0;B=D;$a=Mb(Ga|0,Na|0,-997805,-1)|0;da=D;w=Mb(Ga|0,Na|0,136657,0)|0;ha=D;sa=Mb(Ga|0,Na|0,-683901,-1)|0;Na=D;Ga=yb(_a|0,eb|0,21)|0;h=D;g=Ab(La|0,Ta|0,Wa|0,u|0)|0;u=zb(g|0,D|0,Va|0,Sa|0)|0;Sa=Ab(u|0,D|0,Ga|0,h|0)|0;u=D;Va=Db(Ga|0,h|0,21)|0;h=zb(_a|0,eb|0,Va|0,D|0)|0;Va=D;eb=yb(Sa|0,u|0,21)|0;_a=D;Ga=Ab(Ca|0,B|0,Y|0,hb|0)|0;hb=zb(Ga|0,D|0,Ha|0,k|0)|0;k=Ab(hb|0,D|0,Ra|0,ra|0)|0;ra=Ab(k|0,D|0,eb|0,_a|0)|0;k=D;Ra=Db(eb|0,_a|0,21)|0;_a=zb(Sa|0,u|0,Ra|0,D|0)|0;Ra=D;u=yb(ra|0,k|0,21)|0;Sa=D;eb=Ab(oa|0,ea|0,$a|0,da|0)|0;da=zb(eb|0,D|0,ya|0,Ea|0)|0;Ea=Ab(da|0,D|0,u|0,Sa|0)|0;da=D;ya=Db(u|0,Sa|0,21)|0;Sa=zb(ra|0,k|0,ya|0,D|0)|0;ya=D;k=yb(Ea|0,da|0,21)|0;ra=D;u=Ab(w|0,ha|0,Ja|0,aa|0)|0;aa=zb(u|0,D|0,db|0,ka|0)|0;ka=Ab(aa|0,D|0,ga|0,cb|0)|0;cb=Ab(ka|0,D|0,k|0,ra|0)|0;ka=D;ga=Db(k|0,ra|0,21)|0;ra=zb(Ea|0,da|0,ga|0,D|0)|0;ga=D;da=yb(cb|0,ka|0,21)|0;Ea=D;k=Ab(Ma|0,ja|0,sa|0,Na|0)|0;Na=zb(k|0,D|0,N|0,Ka|0)|0;Ka=Ab(Na|0,D|0,da|0,Ea|0)|0;Na=D;N=Db(da|0,Ea|0,21)|0;Ea=zb(cb|0,ka|0,N|0,D|0)|0;N=D;ka=yb(Ka|0,Na|0,21)|0;cb=D;da=Ab(va|0,Xa|0,ka|0,cb|0)|0;Xa=D;va=Db(ka|0,cb|0,21)|0;cb=zb(Ka|0,Na|0,va|0,D|0)|0;va=D;Na=yb(da|0,Xa|0,21)|0;Ka=D;ka=Ab(Na|0,Ka|0,xa|0,wa|0)|0;wa=D;xa=Db(Na|0,Ka|0,21)|0;Ka=zb(da|0,Xa|0,xa|0,D|0)|0;xa=D;Xa=yb(ka|0,wa|0,21)|0;da=D;Na=Ab(fa|0,Pa|0,Xa|0,da|0)|0;Pa=D;fa=Db(Xa|0,da|0,21)|0;da=zb(ka|0,wa|0,fa|0,D|0)|0;fa=D;wa=yb(Na|0,Pa|0,21)|0;ka=D;Xa=Ab(wa|0,ka|0,Ba|0,Aa|0)|0;Aa=D;Ba=Db(wa|0,ka|0,21)|0;ka=zb(Na|0,Pa|0,Ba|0,D|0)|0;Ba=D;Pa=yb(Xa|0,Aa|0,21)|0;Na=D;wa=Ab(Fa|0,na|0,Pa|0,Na|0)|0;na=D;Fa=Db(Pa|0,Na|0,21)|0;Na=zb(Xa|0,Aa|0,Fa|0,D|0)|0;Fa=D;Aa=yb(wa|0,na|0,21)|0;Xa=D;Pa=Ab(Aa|0,Xa|0,I|0,Oa|0)|0;Oa=D;I=Db(Aa|0,Xa|0,21)|0;Xa=zb(wa|0,na|0,I|0,D|0)|0;I=D;na=yb(Pa|0,Oa|0,21)|0;wa=D;Aa=Db(na|0,wa|0,21)|0;k=zb(Pa|0,Oa|0,Aa|0,D|0)|0;Aa=D;Oa=Mb(na|0,wa|0,666643,0)|0;Pa=Ab(Oa|0,D|0,h|0,Va|0)|0;Va=D;h=Mb(na|0,wa|0,470296,0)|0;Oa=Ab(_a|0,Ra|0,h|0,D|0)|0;h=D;Ra=Mb(na|0,wa|0,654183,0)|0;_a=Ab(Sa|0,ya|0,Ra|0,D|0)|0;Ra=D;ya=Mb(na|0,wa|0,-997805,-1)|0;Sa=Ab(ra|0,ga|0,ya|0,D|0)|0;ya=D;ga=Mb(na|0,wa|0,136657,0)|0;ra=Ab(Ea|0,N|0,ga|0,D|0)|0;ga=D;N=Mb(na|0,wa|0,-683901,-1)|0;wa=Ab(cb|0,va|0,N|0,D|0)|0;N=D;va=yb(Pa|0,Va|0,21)|0;cb=D;na=Ab(Oa|0,h|0,va|0,cb|0)|0;h=D;Oa=Db(va|0,cb|0,21)|0;cb=zb(Pa|0,Va|0,Oa|0,D|0)|0;Oa=D;Va=yb(na|0,h|0,21)|0;Pa=D;va=Ab(_a|0,Ra|0,Va|0,Pa|0)|0;Ra=D;_a=Db(Va|0,Pa|0,21)|0;Pa=zb(na|0,h|0,_a|0,D|0)|0;_a=D;h=yb(va|0,Ra|0,21)|0;na=D;Va=Ab(Sa|0,ya|0,h|0,na|0)|0;ya=D;Sa=Db(h|0,na|0,21)|0;na=zb(va|0,Ra|0,Sa|0,D|0)|0;Sa=D;Ra=yb(Va|0,ya|0,21)|0;va=D;h=Ab(ra|0,ga|0,Ra|0,va|0)|0;ga=D;ra=Db(Ra|0,va|0,21)|0;va=zb(Va|0,ya|0,ra|0,D|0)|0;ra=D;ya=yb(h|0,ga|0,21)|0;Va=D;Ra=Ab(wa|0,N|0,ya|0,Va|0)|0;N=D;wa=Db(ya|0,Va|0,21)|0;Va=zb(h|0,ga|0,wa|0,D|0)|0;wa=D;ga=yb(Ra|0,N|0,21)|0;h=D;ya=Ab(ga|0,h|0,Ka|0,xa|0)|0;xa=D;Ka=Db(ga|0,h|0,21)|0;h=zb(Ra|0,N|0,Ka|0,D|0)|0;Ka=D;N=yb(ya|0,xa|0,21)|0;Ra=D;ga=Ab(N|0,Ra|0,da|0,fa|0)|0;fa=D;da=Db(N|0,Ra|0,21)|0;Ra=zb(ya|0,xa|0,da|0,D|0)|0;da=D;xa=yb(ga|0,fa|0,21)|0;ya=D;N=Ab(xa|0,ya|0,ka|0,Ba|0)|0;Ba=D;ka=Db(xa|0,ya|0,21)|0;ya=zb(ga|0,fa|0,ka|0,D|0)|0;ka=D;fa=yb(N|0,Ba|0,21)|0;ga=D;xa=Ab(fa|0,ga|0,Na|0,Fa|0)|0;Fa=D;Na=Db(fa|0,ga|0,21)|0;ga=zb(N|0,Ba|0,Na|0,D|0)|0;Na=D;Ba=yb(xa|0,Fa|0,21)|0;N=D;fa=Ab(Ba|0,N|0,Xa|0,I|0)|0;I=D;Xa=Db(Ba|0,N|0,21)|0;N=zb(xa|0,Fa|0,Xa|0,D|0)|0;Xa=D;Fa=yb(fa|0,I|0,21)|0;xa=D;Ba=Ab(Fa|0,xa|0,k|0,Aa|0)|0;Aa=D;k=Db(Fa|0,xa|0,21)|0;xa=zb(fa|0,I|0,k|0,D|0)|0;k=D;a[b>>0]=cb;b=Cb(cb|0,Oa|0,8)|0;a[e>>0]=b;b=Cb(cb|0,Oa|0,16)|0;Oa=D;Oa=Db(Pa|0,_a|0,5)|0;a[f>>0]=Oa|b;b=Cb(Pa|0,_a|0,3)|0;a[m>>0]=b;b=Cb(Pa|0,_a|0,11)|0;a[p>>0]=b;b=Cb(Pa|0,_a|0,19)|0;_a=D;_a=Db(na|0,Sa|0,2)|0;a[o>>0]=_a|b;b=Cb(na|0,Sa|0,6)|0;a[r>>0]=b;b=Cb(na|0,Sa|0,14)|0;Sa=D;Sa=Db(va|0,ra|0,7)|0;a[t>>0]=Sa|b;b=Cb(va|0,ra|0,1)|0;a[n>>0]=b;b=Cb(va|0,ra|0,9)|0;a[l>>0]=b;b=Cb(va|0,ra|0,17)|0;ra=D;ra=Db(Va|0,wa|0,4)|0;a[s>>0]=ra|b;b=Cb(Va|0,wa|0,4)|0;a[y>>0]=b;b=Cb(Va|0,wa|0,12)|0;a[v>>0]=b;b=Cb(Va|0,wa|0,20)|0;wa=D;wa=Db(h|0,Ka|0,1)|0;a[x>>0]=wa|b;b=Cb(h|0,Ka|0,7)|0;a[C>>0]=b;b=Cb(h|0,Ka|0,15)|0;Ka=D;Ka=Db(Ra|0,da|0,6)|0;a[F>>0]=Ka|b;b=Cb(Ra|0,da|0,2)|0;a[A>>0]=b;b=Cb(Ra|0,da|0,10)|0;a[z>>0]=b;b=Cb(Ra|0,da|0,18)|0;da=D;da=Db(ya|0,ka|0,3)|0;a[E>>0]=da|b;b=Cb(ya|0,ka|0,5)|0;a[K>>0]=b;b=Cb(ya|0,ka|0,13)|0;a[M>>0]=b;a[O>>0]=ga;O=Cb(ga|0,Na|0,8)|0;a[L>>0]=O;O=Cb(ga|0,Na|0,16)|0;Na=D;Na=Db(N|0,Xa|0,5)|0;a[H>>0]=Na|O;O=Cb(N|0,Xa|0,3)|0;a[U>>0]=O;O=Cb(N|0,Xa|0,11)|0;a[X>>0]=O;O=Cb(N|0,Xa|0,19)|0;Xa=D;Xa=Db(xa|0,k|0,2)|0;a[W>>0]=Xa|O;O=Cb(xa|0,k|0,6)|0;a[Z>>0]=O;O=Cb(xa|0,k|0,14)|0;k=D;k=Db(Ba|0,Aa|0,7)|0;a[$>>0]=O|k;k=Cb(Ba|0,Aa|0,1)|0;a[V>>0]=k;k=Cb(Ba|0,Aa|0,9)|0;a[T>>0]=k;k=Cb(Ba|0,Aa|0,17)|0;a[_>>0]=k;i=c;return}function qb(a){a=a|0;var b=0,d=0,e=0,f=0;b=i;d=a+128|0;e=31840|0;f=d+64|0;do{c[d>>2]=c[e>>2];d=d+4|0;e=e+4|0}while((d|0)<(f|0));e=a+192|0;c[e>>2]=0;c[e+4>>2]=0;i=b;return}function rb(a,b,d){a=a|0;b=b|0;d=d|0;var e=0,f=0,g=0,h=0,j=0,k=0,l=0,m=0;e=i;f=a+192|0;if(!d){i=e;return}g=a+128|0;h=d;d=b;b=c[f>>2]&127;while(1){j=128-b|0;k=j>>>0>h>>>0?h:j;Fb(a+b|0,d|0,k|0)|0;j=k+b|0;if((j|0)==128){tb(a,g);l=0}else l=j;j=f;m=Ab(c[j>>2]|0,c[j+4>>2]|0,k|0,0)|0;j=f;c[j>>2]=m;c[j+4>>2]=D;if((h|0)==(k|0))break;else{h=h-k|0;d=d+k|0;b=l}}i=e;return}function sb(a,b){a=a|0;b=b|0;var d=0,e=0,f=0;d=i;ub(a,0,0,b,8);b=a+128|0;e=31840|0;f=b+64|0;do{c[b>>2]=c[e>>2];b=b+4|0;e=e+4|0}while((b|0)<(f|0));e=a+192|0;c[e>>2]=0;c[e+4>>2]=0;i=d;return}function tb(a,b){a=a|0;b=b|0;var e=0,f=0,g=0,h=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0,L=0,M=0,N=0,O=0,P=0,Q=0,R=0,S=0,T=0,U=0,V=0,W=0,X=0,Y=0,Z=0,_=0,$=0,aa=0,ba=0,ca=0,da=0;e=i;i=i+640|0;f=e;g=0;do{h=g<<3;j=Db(d[a+h>>0]|0|0,0,56)|0;k=D;l=Db(d[a+(h|1)>>0]|0|0,0,48)|0;m=D|k;k=Db(d[a+(h|2)>>0]|0|0,0,40)|0;n=m|D|(d[a+(h|3)>>0]|0);m=Db(d[a+(h|4)>>0]|0|0,0,24)|0;o=n|D;n=Db(d[a+(h|5)>>0]|0|0,0,16)|0;p=o|D;o=Db(d[a+(h|6)>>0]|0|0,0,8)|0;q=f+(g<<3)|0;c[q>>2]=l|j|k|m|n|o|(d[a+(h|7)>>0]|0);c[q+4>>2]=p|D;g=g+1|0}while((g|0)!=16);g=f;a=c[g>>2]|0;p=c[g+4>>2]|0;g=16;do{q=f+(g+-2<<3)|0;h=c[q>>2]|0;o=c[q+4>>2]|0;q=Db(h|0,o|0,45)|0;n=D;m=Cb(h|0,o|0,19)|0;k=n|D;n=Db(h|0,o|0,3)|0;j=D;l=Cb(h|0,o|0,61)|0;r=j|D;j=Cb(h|0,o|0,6)|0;o=r^D^k;k=f+(g+-7<<3)|0;r=c[k>>2]|0;h=c[k+4>>2]|0;k=f+(g+-15<<3)|0;s=a;a=c[k>>2]|0;t=p;p=c[k+4>>2]|0;k=Db(a|0,p|0,63)|0;u=D;v=Cb(a|0,p|0,1)|0;w=u|D;u=Db(a|0,p|0,56)|0;x=D;y=Cb(a|0,p|0,8)|0;z=x|D;x=Cb(a|0,p|0,7)|0;A=z^D^w;w=Ab(s|0,t|0,r|0,h|0)|0;h=Ab(w|0,D|0,(n|l)^j^(q|m)|0,o|0)|0;o=Ab(h|0,D|0,(u|y)^x^(k|v)|0,A|0)|0;A=f+(g<<3)|0;c[A>>2]=o;c[A+4>>2]=D;g=g+1|0}while((g|0)!=80);g=b;p=b+8|0;a=p;A=b+16|0;o=A;v=b+24|0;k=v;x=b+32|0;y=x;u=b+40|0;h=u;m=b+48|0;q=m;j=b+56|0;l=j;n=c[y>>2]|0;w=c[y+4>>2]|0;y=c[q>>2]|0;r=c[h>>2]|0;t=c[q+4>>2]|0;q=c[h+4>>2]|0;h=c[l>>2]|0;s=c[l+4>>2]|0;l=c[g>>2]|0;z=c[g+4>>2]|0;g=c[a>>2]|0;B=c[a+4>>2]|0;a=c[o>>2]|0;C=c[o+4>>2]|0;o=c[k>>2]|0;E=c[k+4>>2]|0;k=0;do{F=Db(n|0,w|0,50)|0;G=D;H=Cb(n|0,w|0,14)|0;I=G|D;G=Db(n|0,w|0,46)|0;J=D;K=Cb(n|0,w|0,18)|0;L=I^(J|D);J=Db(n|0,w|0,23)|0;I=D;M=Cb(n|0,w|0,41)|0;N=L^(I|D);I=31904+(k<<3)|0;L=c[I>>2]|0;O=c[I+4>>2]|0;I=f+(k<<3)|0;P=c[I>>2]|0;Q=c[I+4>>2]|0;I=Ab((r^y)&n^y|0,(q^t)&w^t|0,h|0,s|0)|0;R=Ab(I|0,D|0,(F|H)^(G|K)^(J|M)|0,N|0)|0;N=Ab(R|0,D|0,L|0,O|0)|0;O=Ab(N|0,D|0,P|0,Q|0)|0;Q=D;P=Db(l|0,z|0,36)|0;N=D;L=Cb(l|0,z|0,28)|0;R=N|D;N=Db(l|0,z|0,30)|0;M=D;J=Cb(l|0,z|0,34)|0;K=R^(M|D);M=Db(l|0,z|0,25)|0;R=D;G=Cb(l|0,z|0,39)|0;H=Ab((P|L)^(N|J)^(M|G)|0,K^(R|D)|0,(l|g)&a|l&g|0,(z|B)&C|z&B|0)|0;R=D;K=Ab(O|0,Q|0,o|0,E|0)|0;G=D;M=Ab(H|0,R|0,O|0,Q|0)|0;Q=D;O=Db(K|0,G|0,50)|0;R=D;H=Cb(K|0,G|0,14)|0;J=R|D;R=Db(K|0,G|0,46)|0;N=D;L=Cb(K|0,G|0,18)|0;P=J^(N|D);N=Db(K|0,G|0,23)|0;J=D;F=Cb(K|0,G|0,41)|0;I=P^(J|D);J=k|1;P=31904+(J<<3)|0;S=f+(J<<3)|0;J=c[S>>2]|0;T=c[S+4>>2]|0;S=Ab(c[P>>2]|0,c[P+4>>2]|0,y|0,t|0)|0;P=Ab(S|0,D|0,J|0,T|0)|0;T=Ab(P|0,D|0,K&(n^r)^r|0,G&(w^q)^q|0)|0;P=Ab(T|0,D|0,(O|H)^(R|L)^(N|F)|0,I|0)|0;I=D;F=Db(M|0,Q|0,36)|0;N=D;L=Cb(M|0,Q|0,28)|0;R=N|D;N=Db(M|0,Q|0,30)|0;H=D;O=Cb(M|0,Q|0,34)|0;T=R^(H|D);H=Db(M|0,Q|0,25)|0;R=D;J=Cb(M|0,Q|0,39)|0;S=Ab((F|L)^(N|O)^(H|J)|0,T^(R|D)|0,(M|l)&g|M&l|0,(Q|z)&B|Q&z|0)|0;R=D;T=Ab(P|0,I|0,a|0,C|0)|0;J=D;H=Ab(S|0,R|0,P|0,I|0)|0;I=D;P=Db(T|0,J|0,50)|0;R=D;S=Cb(T|0,J|0,14)|0;O=R|D;R=Db(T|0,J|0,46)|0;N=D;L=Cb(T|0,J|0,18)|0;F=O^(N|D);N=Db(T|0,J|0,23)|0;O=D;U=Cb(T|0,J|0,41)|0;V=F^(O|D);O=k|2;F=31904+(O<<3)|0;W=f+(O<<3)|0;O=c[W>>2]|0;X=c[W+4>>2]|0;W=Ab(c[F>>2]|0,c[F+4>>2]|0,r|0,q|0)|0;F=Ab(W|0,D|0,O|0,X|0)|0;X=Ab(F|0,D|0,T&(K^n)^n|0,J&(G^w)^w|0)|0;F=Ab(X|0,D|0,(P|S)^(R|L)^(N|U)|0,V|0)|0;V=D;U=Db(H|0,I|0,36)|0;N=D;L=Cb(H|0,I|0,28)|0;R=N|D;N=Db(H|0,I|0,30)|0;S=D;P=Cb(H|0,I|0,34)|0;X=R^(S|D);S=Db(H|0,I|0,25)|0;R=D;O=Cb(H|0,I|0,39)|0;W=Ab((U|L)^(N|P)^(S|O)|0,X^(R|D)|0,(H|M)&l|H&M|0,(I|Q)&z|I&Q|0)|0;R=D;X=Ab(F|0,V|0,g|0,B|0)|0;O=D;S=Ab(W|0,R|0,F|0,V|0)|0;V=D;F=Db(X|0,O|0,50)|0;R=D;W=Cb(X|0,O|0,14)|0;P=R|D;R=Db(X|0,O|0,46)|0;N=D;L=Cb(X|0,O|0,18)|0;U=P^(N|D);N=Db(X|0,O|0,23)|0;P=D;Y=Cb(X|0,O|0,41)|0;Z=U^(P|D);P=k|3;U=31904+(P<<3)|0;_=f+(P<<3)|0;P=c[_>>2]|0;$=c[_+4>>2]|0;_=Ab(c[U>>2]|0,c[U+4>>2]|0,n|0,w|0)|0;U=Ab(_|0,D|0,P|0,$|0)|0;$=Ab(U|0,D|0,X&(T^K)^K|0,O&(J^G)^G|0)|0;U=Ab($|0,D|0,(F|W)^(R|L)^(N|Y)|0,Z|0)|0;Z=D;Y=Db(S|0,V|0,36)|0;N=D;L=Cb(S|0,V|0,28)|0;R=N|D;N=Db(S|0,V|0,30)|0;W=D;F=Cb(S|0,V|0,34)|0;$=R^(W|D);W=Db(S|0,V|0,25)|0;R=D;P=Cb(S|0,V|0,39)|0;_=Ab((Y|L)^(N|F)^(W|P)|0,$^(R|D)|0,(S|H)&M|S&H|0,(V|I)&Q|V&I|0)|0;R=D;$=Ab(U|0,Z|0,l|0,z|0)|0;P=D;W=Ab(_|0,R|0,U|0,Z|0)|0;Z=D;U=Db($|0,P|0,50)|0;R=D;_=Cb($|0,P|0,14)|0;F=R|D;R=Db($|0,P|0,46)|0;N=D;L=Cb($|0,P|0,18)|0;Y=F^(N|D);N=Db($|0,P|0,23)|0;F=D;aa=Cb($|0,P|0,41)|0;ba=Y^(F|D);F=k|4;Y=31904+(F<<3)|0;ca=f+(F<<3)|0;F=c[ca>>2]|0;da=c[ca+4>>2]|0;ca=Ab(c[Y>>2]|0,c[Y+4>>2]|0,K|0,G|0)|0;G=Ab(ca|0,D|0,F|0,da|0)|0;da=Ab(G|0,D|0,$&(X^T)^T|0,P&(O^J)^J|0)|0;G=Ab(da|0,D|0,(U|_)^(R|L)^(N|aa)|0,ba|0)|0;ba=D;aa=Db(W|0,Z|0,36)|0;N=D;L=Cb(W|0,Z|0,28)|0;R=N|D;N=Db(W|0,Z|0,30)|0;_=D;U=Cb(W|0,Z|0,34)|0;da=R^(_|D);_=Db(W|0,Z|0,25)|0;R=D;F=Cb(W|0,Z|0,39)|0;ca=Ab((aa|L)^(N|U)^(_|F)|0,da^(R|D)|0,(W|S)&H|W&S|0,(Z|V)&I|Z&V|0)|0;R=D;h=Ab(G|0,ba|0,M|0,Q|0)|0;s=D;o=Ab(ca|0,R|0,G|0,ba|0)|0;E=D;ba=Db(h|0,s|0,50)|0;G=D;R=Cb(h|0,s|0,14)|0;ca=G|D;G=Db(h|0,s|0,46)|0;Q=D;M=Cb(h|0,s|0,18)|0;da=ca^(Q|D);Q=Db(h|0,s|0,23)|0;ca=D;F=Cb(h|0,s|0,41)|0;_=da^(ca|D);ca=k|5;da=31904+(ca<<3)|0;U=f+(ca<<3)|0;ca=c[U>>2]|0;N=c[U+4>>2]|0;U=Ab(c[da>>2]|0,c[da+4>>2]|0,T|0,J|0)|0;J=Ab(U|0,D|0,ca|0,N|0)|0;N=Ab(J|0,D|0,h&($^X)^X|0,s&(P^O)^O|0)|0;J=Ab(N|0,D|0,(ba|R)^(G|M)^(Q|F)|0,_|0)|0;_=D;F=Db(o|0,E|0,36)|0;Q=D;M=Cb(o|0,E|0,28)|0;G=Q|D;Q=Db(o|0,E|0,30)|0;R=D;ba=Cb(o|0,E|0,34)|0;N=G^(R|D);R=Db(o|0,E|0,25)|0;G=D;ca=Cb(o|0,E|0,39)|0;U=Ab((F|M)^(Q|ba)^(R|ca)|0,N^(G|D)|0,(o|W)&S|o&W|0,(E|Z)&V|E&Z|0)|0;G=D;y=Ab(J|0,_|0,H|0,I|0)|0;t=D;a=Ab(U|0,G|0,J|0,_|0)|0;C=D;_=Db(y|0,t|0,50)|0;J=D;G=Cb(y|0,t|0,14)|0;U=J|D;J=Db(y|0,t|0,46)|0;I=D;H=Cb(y|0,t|0,18)|0;N=U^(I|D);I=Db(y|0,t|0,23)|0;U=D;ca=Cb(y|0,t|0,41)|0;R=N^(U|D);U=k|6;N=31904+(U<<3)|0;ba=f+(U<<3)|0;U=Ab(c[ba>>2]|0,c[ba+4>>2]|0,c[N>>2]|0,c[N+4>>2]|0)|0;N=Ab(U|0,D|0,X|0,O|0)|0;O=Ab(N|0,D|0,y&(h^$)^$|0,t&(s^P)^P|0)|0;N=Ab(O|0,D|0,(_|G)^(J|H)^(I|ca)|0,R|0)|0;R=D;ca=Db(a|0,C|0,36)|0;I=D;H=Cb(a|0,C|0,28)|0;J=I|D;I=Db(a|0,C|0,30)|0;G=D;_=Cb(a|0,C|0,34)|0;O=J^(G|D);G=Db(a|0,C|0,25)|0;J=D;X=Cb(a|0,C|0,39)|0;U=Ab((ca|H)^(I|_)^(G|X)|0,O^(J|D)|0,(a|o)&W|a&o|0,(C|E)&Z|C&E|0)|0;J=D;r=Ab(N|0,R|0,S|0,V|0)|0;q=D;g=Ab(U|0,J|0,N|0,R|0)|0;B=D;R=Db(r|0,q|0,50)|0;N=D;J=Cb(r|0,q|0,14)|0;U=N|D;N=Db(r|0,q|0,46)|0;V=D;S=Cb(r|0,q|0,18)|0;O=U^(V|D);V=Db(r|0,q|0,23)|0;U=D;X=Cb(r|0,q|0,41)|0;G=O^(U|D);U=k|7;O=31904+(U<<3)|0;_=f+(U<<3)|0;U=Ab(c[_>>2]|0,c[_+4>>2]|0,c[O>>2]|0,c[O+4>>2]|0)|0;O=Ab(U|0,D|0,$|0,P|0)|0;P=Ab(O|0,D|0,r&(y^h)^h|0,q&(t^s)^s|0)|0;O=Ab(P|0,D|0,(R|J)^(N|S)^(V|X)|0,G|0)|0;G=D;X=Db(g|0,B|0,36)|0;V=D;S=Cb(g|0,B|0,28)|0;N=V|D;V=Db(g|0,B|0,30)|0;J=D;R=Cb(g|0,B|0,34)|0;P=N^(J|D);J=Db(g|0,B|0,25)|0;N=D;$=Cb(g|0,B|0,39)|0;U=Ab((X|S)^(V|R)^(J|$)|0,P^(N|D)|0,(g|a)&o|g&a|0,(B|C)&E|B&C|0)|0;N=D;n=Ab(O|0,G|0,W|0,Z|0)|0;w=D;l=Ab(U|0,N|0,O|0,G|0)|0;z=D;k=k+8|0}while((k|0)<80);k=b;f=Ab(c[k>>2]|0,c[k+4>>2]|0,l|0,z|0)|0;z=b;c[z>>2]=f;c[z+4>>2]=D;z=p;f=Ab(c[z>>2]|0,c[z+4>>2]|0,g|0,B|0)|0;B=p;c[B>>2]=f;c[B+4>>2]=D;B=A;f=Ab(c[B>>2]|0,c[B+4>>2]|0,a|0,C|0)|0;C=A;c[C>>2]=f;c[C+4>>2]=D;C=v;f=Ab(c[C>>2]|0,c[C+4>>2]|0,o|0,E|0)|0;E=v;c[E>>2]=f;c[E+4>>2]=D;E=x;f=Ab(c[E>>2]|0,c[E+4>>2]|0,n|0,w|0)|0;w=x;c[w>>2]=f;c[w+4>>2]=D;w=u;f=Ab(c[w>>2]|0,c[w+4>>2]|0,r|0,q|0)|0;q=u;c[q>>2]=f;c[q+4>>2]=D;q=m;f=Ab(c[q>>2]|0,c[q+4>>2]|0,y|0,t|0)|0;t=m;c[t>>2]=f;c[t+4>>2]=D;t=j;f=Ab(c[t>>2]|0,c[t+4>>2]|0,h|0,s|0)|0;s=j;c[s>>2]=f;c[s+4>>2]=D;i=e;return}function ub(b,d,e,f,g){b=b|0;d=d|0;e=e|0;f=f|0;g=g|0;var h=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0;h=i;j=b+192|0;k=c[j>>2]&127;l=128>>>e;m=k+1|0;a[b+k>>0]=0-l&d|l;l=b+m|0;if(m>>>0>112){Bb(l|0,0,k^127|0)|0;m=b+128|0;tb(b,m);d=b+0|0;n=d+112|0;do{a[d>>0]=0;d=d+1|0}while((d|0)<(n|0));o=m;p=m}else{Bb(l|0,0,111-k|0)|0;k=b+128|0;o=k;p=k}k=b+112|0;l=j;j=c[l>>2]|0;m=c[l+4>>2]|0;l=Cb(j|0,m|0,61)|0;a[k+0>>0]=0;a[k+1>>0]=0;a[k+2>>0]=0;a[k+3>>0]=0;a[k+4>>0]=0;a[k+5>>0]=0;a[k+6>>0]=0;a[b+119>>0]=l;l=Db(j|0,m|0,3)|0;m=Ab(l|0,D|0,e|0,0)|0;e=D;l=Cb(m|0,e|0,56)|0;a[b+120>>0]=l;l=Cb(m|0,e|0,48)|0;a[b+121>>0]=l;l=Cb(m|0,e|0,40)|0;a[b+122>>0]=l;a[b+123>>0]=e;l=Cb(m|0,e|0,24)|0;a[b+124>>0]=l;l=Cb(m|0,e|0,16)|0;a[b+125>>0]=l;l=Cb(m|0,e|0,8)|0;a[b+126>>0]=l;a[b+127>>0]=m;tb(b,o);if(!g){i=h;return}else q=0;do{o=q<<3;b=p+(q<<3)|0;m=c[b>>2]|0;l=c[b+4>>2]|0;b=Cb(m|0,l|0,56)|0;a[f+o>>0]=b;b=Cb(m|0,l|0,48)|0;a[f+(o|1)>>0]=b;b=Cb(m|0,l|0,40)|0;a[f+(o|2)>>0]=b;a[f+(o|3)>>0]=l;b=Cb(m|0,l|0,24)|0;a[f+(o|4)>>0]=b;b=Cb(m|0,l|0,16)|0;a[f+(o|5)>>0]=b;b=Cb(m|0,l|0,8)|0;a[f+(o|6)>>0]=b;a[f+(o|7)>>0]=m;q=q+1|0}while((q|0)!=(g|0));i=h;return}function vb(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0,L=0,M=0,N=0,O=0,P=0,Q=0,R=0,S=0,T=0,U=0,V=0,W=0,X=0,Y=0,Z=0,_=0,$=0,aa=0,ba=0,ca=0,da=0,ga=0,ja=0,ka=0,la=0,na=0,oa=0,pa=0,qa=0,ra=0,sa=0,ta=0,ua=0,va=0,wa=0,xa=0,ya=0,za=0,Aa=0,Ba=0,Ca=0,Da=0,Ea=0,Fa=0,Ga=0,Ha=0,Ia=0,Ja=0,Ka=0,La=0,Ma=0,Na=0,Oa=0,Pa=0,Qa=0;b=i;do if(a>>>0<245){if(a>>>0<11)d=16;else d=a+11&-8;e=d>>>3;f=c[8136]|0;g=f>>>e;if(g&3){h=(g&1^1)+e|0;j=h<<1;k=32584+(j<<2)|0;l=32584+(j+2<<2)|0;j=c[l>>2]|0;m=j+8|0;n=c[m>>2]|0;do if((k|0)!=(n|0)){if(n>>>0<(c[8140]|0)>>>0)fa();o=n+12|0;if((c[o>>2]|0)==(j|0)){c[o>>2]=k;c[l>>2]=n;break}else fa()}else c[8136]=f&~(1<<h);while(0);n=h<<3;c[j+4>>2]=n|3;l=j+(n|4)|0;c[l>>2]=c[l>>2]|1;p=m;i=b;return p|0}l=c[8138]|0;if(d>>>0>l>>>0){if(g){n=2<<e;k=g<<e&(n|0-n);n=(k&0-k)+-1|0;k=n>>>12&16;o=n>>>k;n=o>>>5&8;q=o>>>n;o=q>>>2&4;r=q>>>o;q=r>>>1&2;s=r>>>q;r=s>>>1&1;t=(n|k|o|q|r)+(s>>>r)|0;r=t<<1;s=32584+(r<<2)|0;q=32584+(r+2<<2)|0;r=c[q>>2]|0;o=r+8|0;k=c[o>>2]|0;do if((s|0)!=(k|0)){if(k>>>0<(c[8140]|0)>>>0)fa();n=k+12|0;if((c[n>>2]|0)==(r|0)){c[n>>2]=s;c[q>>2]=k;u=c[8138]|0;break}else fa()}else{c[8136]=f&~(1<<t);u=l}while(0);l=t<<3;f=l-d|0;c[r+4>>2]=d|3;k=r+d|0;c[r+(d|4)>>2]=f|1;c[r+l>>2]=f;if(u){l=c[8141]|0;q=u>>>3;s=q<<1;e=32584+(s<<2)|0;g=c[8136]|0;m=1<<q;if(g&m){q=32584+(s+2<<2)|0;j=c[q>>2]|0;if(j>>>0<(c[8140]|0)>>>0)fa();else{v=q;w=j}}else{c[8136]=g|m;v=32584+(s+2<<2)|0;w=e}c[v>>2]=l;c[w+12>>2]=l;c[l+8>>2]=w;c[l+12>>2]=e}c[8138]=f;c[8141]=k;p=o;i=b;return p|0}k=c[8137]|0;if(k){f=(k&0-k)+-1|0;k=f>>>12&16;e=f>>>k;f=e>>>5&8;l=e>>>f;e=l>>>2&4;s=l>>>e;l=s>>>1&2;m=s>>>l;s=m>>>1&1;g=c[32848+((f|k|e|l|s)+(m>>>s)<<2)>>2]|0;s=(c[g+4>>2]&-8)-d|0;m=g;l=g;while(1){g=c[m+16>>2]|0;if(!g){e=c[m+20>>2]|0;if(!e)break;else x=e}else x=g;g=(c[x+4>>2]&-8)-d|0;e=g>>>0<s>>>0;s=e?g:s;m=x;l=e?x:l}m=c[8140]|0;if(l>>>0<m>>>0)fa();o=l+d|0;if(l>>>0>=o>>>0)fa();r=c[l+24>>2]|0;t=c[l+12>>2]|0;do if((t|0)==(l|0)){e=l+20|0;g=c[e>>2]|0;if(!g){k=l+16|0;f=c[k>>2]|0;if(!f){y=0;break}else{z=f;A=k}}else{z=g;A=e}while(1){e=z+20|0;g=c[e>>2]|0;if(g){z=g;A=e;continue}e=z+16|0;g=c[e>>2]|0;if(!g)break;else{z=g;A=e}}if(A>>>0<m>>>0)fa();else{c[A>>2]=0;y=z;break}}else{e=c[l+8>>2]|0;if(e>>>0<m>>>0)fa();g=e+12|0;if((c[g>>2]|0)!=(l|0))fa();k=t+8|0;if((c[k>>2]|0)==(l|0)){c[g>>2]=t;c[k>>2]=e;y=t;break}else fa()}while(0);do if(r){t=c[l+28>>2]|0;m=32848+(t<<2)|0;if((l|0)==(c[m>>2]|0)){c[m>>2]=y;if(!y){c[8137]=c[8137]&~(1<<t);break}}else{if(r>>>0<(c[8140]|0)>>>0)fa();t=r+16|0;if((c[t>>2]|0)==(l|0))c[t>>2]=y;else c[r+20>>2]=y;if(!y)break}t=c[8140]|0;if(y>>>0<t>>>0)fa();c[y+24>>2]=r;m=c[l+16>>2]|0;do if(m)if(m>>>0<t>>>0)fa();else{c[y+16>>2]=m;c[m+24>>2]=y;break}while(0);m=c[l+20>>2]|0;if(m)if(m>>>0<(c[8140]|0)>>>0)fa();else{c[y+20>>2]=m;c[m+24>>2]=y;break}}while(0);if(s>>>0<16){r=s+d|0;c[l+4>>2]=r|3;m=l+(r+4)|0;c[m>>2]=c[m>>2]|1}else{c[l+4>>2]=d|3;c[l+(d|4)>>2]=s|1;c[l+(s+d)>>2]=s;m=c[8138]|0;if(m){r=c[8141]|0;t=m>>>3;m=t<<1;e=32584+(m<<2)|0;k=c[8136]|0;g=1<<t;if(k&g){t=32584+(m+2<<2)|0;f=c[t>>2]|0;if(f>>>0<(c[8140]|0)>>>0)fa();else{B=t;C=f}}else{c[8136]=k|g;B=32584+(m+2<<2)|0;C=e}c[B>>2]=r;c[C+12>>2]=r;c[r+8>>2]=C;c[r+12>>2]=e}c[8138]=s;c[8141]=o}p=l+8|0;i=b;return p|0}else D=d}else D=d}else if(a>>>0<=4294967231){e=a+11|0;r=e&-8;m=c[8137]|0;if(m){g=0-r|0;k=e>>>8;if(k)if(r>>>0>16777215)E=31;else{e=(k+1048320|0)>>>16&8;f=k<<e;k=(f+520192|0)>>>16&4;t=f<<k;f=(t+245760|0)>>>16&2;j=14-(k|e|f)+(t<<f>>>15)|0;E=r>>>(j+7|0)&1|j<<1}else E=0;j=c[32848+(E<<2)>>2]|0;a:do if(!j){F=g;G=0;H=0}else{if((E|0)==31)I=0;else I=25-(E>>>1)|0;f=g;t=0;e=r<<I;k=j;q=0;while(1){h=c[k+4>>2]&-8;n=h-r|0;if(n>>>0<f>>>0)if((h|0)==(r|0)){F=n;G=k;H=k;break a}else{J=n;K=k}else{J=f;K=q}n=c[k+20>>2]|0;k=c[k+(e>>>31<<2)+16>>2]|0;h=(n|0)==0|(n|0)==(k|0)?t:n;if(!k){F=J;G=h;H=K;break}else{f=J;t=h;e=e<<1;q=K}}}while(0);if((G|0)==0&(H|0)==0){j=2<<E;g=m&(j|0-j);if(!g){D=r;break}j=(g&0-g)+-1|0;g=j>>>12&16;l=j>>>g;j=l>>>5&8;o=l>>>j;l=o>>>2&4;s=o>>>l;o=s>>>1&2;q=s>>>o;s=q>>>1&1;L=c[32848+((j|g|l|o|s)+(q>>>s)<<2)>>2]|0}else L=G;if(!L){M=F;N=H}else{s=F;q=L;o=H;while(1){l=(c[q+4>>2]&-8)-r|0;g=l>>>0<s>>>0;j=g?l:s;l=g?q:o;g=c[q+16>>2]|0;if(g){s=j;q=g;o=l;continue}q=c[q+20>>2]|0;if(!q){M=j;N=l;break}else{s=j;o=l}}}if((N|0)!=0?M>>>0<((c[8138]|0)-r|0)>>>0:0){o=c[8140]|0;if(N>>>0<o>>>0)fa();s=N+r|0;if(N>>>0>=s>>>0)fa();q=c[N+24>>2]|0;m=c[N+12>>2]|0;do if((m|0)==(N|0)){l=N+20|0;j=c[l>>2]|0;if(!j){g=N+16|0;e=c[g>>2]|0;if(!e){O=0;break}else{P=e;Q=g}}else{P=j;Q=l}while(1){l=P+20|0;j=c[l>>2]|0;if(j){P=j;Q=l;continue}l=P+16|0;j=c[l>>2]|0;if(!j)break;else{P=j;Q=l}}if(Q>>>0<o>>>0)fa();else{c[Q>>2]=0;O=P;break}}else{l=c[N+8>>2]|0;if(l>>>0<o>>>0)fa();j=l+12|0;if((c[j>>2]|0)!=(N|0))fa();g=m+8|0;if((c[g>>2]|0)==(N|0)){c[j>>2]=m;c[g>>2]=l;O=m;break}else fa()}while(0);do if(q){m=c[N+28>>2]|0;o=32848+(m<<2)|0;if((N|0)==(c[o>>2]|0)){c[o>>2]=O;if(!O){c[8137]=c[8137]&~(1<<m);break}}else{if(q>>>0<(c[8140]|0)>>>0)fa();m=q+16|0;if((c[m>>2]|0)==(N|0))c[m>>2]=O;else c[q+20>>2]=O;if(!O)break}m=c[8140]|0;if(O>>>0<m>>>0)fa();c[O+24>>2]=q;o=c[N+16>>2]|0;do if(o)if(o>>>0<m>>>0)fa();else{c[O+16>>2]=o;c[o+24>>2]=O;break}while(0);o=c[N+20>>2]|0;if(o)if(o>>>0<(c[8140]|0)>>>0)fa();else{c[O+20>>2]=o;c[o+24>>2]=O;break}}while(0);b:do if(M>>>0>=16){c[N+4>>2]=r|3;c[N+(r|4)>>2]=M|1;c[N+(M+r)>>2]=M;q=M>>>3;if(M>>>0<256){o=q<<1;m=32584+(o<<2)|0;l=c[8136]|0;g=1<<q;do if(!(l&g)){c[8136]=l|g;R=32584+(o+2<<2)|0;S=m}else{q=32584+(o+2<<2)|0;j=c[q>>2]|0;if(j>>>0>=(c[8140]|0)>>>0){R=q;S=j;break}fa()}while(0);c[R>>2]=s;c[S+12>>2]=s;c[N+(r+8)>>2]=S;c[N+(r+12)>>2]=m;break}o=M>>>8;if(o)if(M>>>0>16777215)T=31;else{g=(o+1048320|0)>>>16&8;l=o<<g;o=(l+520192|0)>>>16&4;j=l<<o;l=(j+245760|0)>>>16&2;q=14-(o|g|l)+(j<<l>>>15)|0;T=M>>>(q+7|0)&1|q<<1}else T=0;q=32848+(T<<2)|0;c[N+(r+28)>>2]=T;c[N+(r+20)>>2]=0;c[N+(r+16)>>2]=0;l=c[8137]|0;j=1<<T;if(!(l&j)){c[8137]=l|j;c[q>>2]=s;c[N+(r+24)>>2]=q;c[N+(r+12)>>2]=s;c[N+(r+8)>>2]=s;break}j=c[q>>2]|0;if((T|0)==31)U=0;else U=25-(T>>>1)|0;c:do if((c[j+4>>2]&-8|0)!=(M|0)){q=M<<U;l=j;while(1){V=l+(q>>>31<<2)+16|0;g=c[V>>2]|0;if(!g)break;if((c[g+4>>2]&-8|0)==(M|0)){W=g;break c}else{q=q<<1;l=g}}if(V>>>0<(c[8140]|0)>>>0)fa();else{c[V>>2]=s;c[N+(r+24)>>2]=l;c[N+(r+12)>>2]=s;c[N+(r+8)>>2]=s;break b}}else W=j;while(0);j=W+8|0;m=c[j>>2]|0;q=c[8140]|0;if(W>>>0>=q>>>0&m>>>0>=q>>>0){c[m+12>>2]=s;c[j>>2]=s;c[N+(r+8)>>2]=m;c[N+(r+12)>>2]=W;c[N+(r+24)>>2]=0;break}else fa()}else{m=M+r|0;c[N+4>>2]=m|3;j=N+(m+4)|0;c[j>>2]=c[j>>2]|1}while(0);p=N+8|0;i=b;return p|0}else D=r}else D=r}else D=-1;while(0);N=c[8138]|0;if(N>>>0>=D>>>0){M=N-D|0;W=c[8141]|0;if(M>>>0>15){c[8141]=W+D;c[8138]=M;c[W+(D+4)>>2]=M|1;c[W+N>>2]=M;c[W+4>>2]=D|3}else{c[8138]=0;c[8141]=0;c[W+4>>2]=N|3;M=W+(N+4)|0;c[M>>2]=c[M>>2]|1}p=W+8|0;i=b;return p|0}W=c[8139]|0;if(W>>>0>D>>>0){M=W-D|0;c[8139]=M;W=c[8142]|0;c[8142]=W+D;c[W+(D+4)>>2]=M|1;c[W+4>>2]=D|3;p=W+8|0;i=b;return p|0}do if(!(c[8254]|0)){W=ea(30)|0;if(!(W+-1&W)){c[8256]=W;c[8255]=W;c[8257]=-1;c[8258]=-1;c[8259]=0;c[8247]=0;c[8254]=(ia(0)|0)&-16^1431655768;break}else fa()}while(0);W=D+48|0;M=c[8256]|0;N=D+47|0;V=M+N|0;U=0-M|0;M=V&U;if(M>>>0<=D>>>0){p=0;i=b;return p|0}T=c[8246]|0;if((T|0)!=0?(S=c[8244]|0,R=S+M|0,R>>>0<=S>>>0|R>>>0>T>>>0):0){p=0;i=b;return p|0}d:do if(!(c[8247]&4)){T=c[8142]|0;e:do if(T){R=32992|0;while(1){S=c[R>>2]|0;if(S>>>0<=T>>>0?(X=R+4|0,(S+(c[X>>2]|0)|0)>>>0>T>>>0):0)break;S=c[R+8>>2]|0;if(!S){Y=181;break e}else R=S}if(R){S=V-(c[8139]|0)&U;if(S>>>0<2147483647){O=ha(S|0)|0;if((O|0)==((c[R>>2]|0)+(c[X>>2]|0)|0)){Z=O;_=S;Y=190}else{$=O;aa=S;Y=191}}else ba=0}else Y=181}else Y=181;while(0);do if((Y|0)==181){T=ha(0)|0;if((T|0)!=(-1|0)){r=T;S=c[8255]|0;O=S+-1|0;if(!(O&r))ca=M;else ca=M-r+(O+r&0-S)|0;S=c[8244]|0;r=S+ca|0;if(ca>>>0>D>>>0&ca>>>0<2147483647){O=c[8246]|0;if((O|0)!=0?r>>>0<=S>>>0|r>>>0>O>>>0:0){ba=0;break}O=ha(ca|0)|0;if((O|0)==(T|0)){Z=T;_=ca;Y=190}else{$=O;aa=ca;Y=191}}else ba=0}else ba=0}while(0);f:do if((Y|0)==190)if((Z|0)==(-1|0))ba=_;else{da=Z;ga=_;Y=201;break d}else if((Y|0)==191){O=0-aa|0;do if(($|0)!=(-1|0)&aa>>>0<2147483647&W>>>0>aa>>>0?(T=c[8256]|0,r=N-aa+T&0-T,r>>>0<2147483647):0)if((ha(r|0)|0)==(-1|0)){ha(O|0)|0;ba=0;break f}else{ja=r+aa|0;break}else ja=aa;while(0);if(($|0)==(-1|0))ba=0;else{da=$;ga=ja;Y=201;break d}}while(0);c[8247]=c[8247]|4;ka=ba;Y=198}else{ka=0;Y=198}while(0);if((((Y|0)==198?M>>>0<2147483647:0)?(ba=ha(M|0)|0,M=ha(0)|0,(ba|0)!=(-1|0)&(M|0)!=(-1|0)&ba>>>0<M>>>0):0)?(ja=M-ba|0,M=ja>>>0>(D+40|0)>>>0,M):0){da=ba;ga=M?ja:ka;Y=201}if((Y|0)==201){ka=(c[8244]|0)+ga|0;c[8244]=ka;if(ka>>>0>(c[8245]|0)>>>0)c[8245]=ka;ka=c[8142]|0;g:do if(ka){ja=32992|0;while(1){la=c[ja>>2]|0;na=ja+4|0;oa=c[na>>2]|0;if((da|0)==(la+oa|0)){Y=213;break}M=c[ja+8>>2]|0;if(!M)break;else ja=M}if(((Y|0)==213?(c[ja+12>>2]&8|0)==0:0)?ka>>>0>=la>>>0&ka>>>0<da>>>0:0){c[na>>2]=oa+ga;M=(c[8139]|0)+ga|0;ba=ka+8|0;if(!(ba&7))pa=0;else pa=0-ba&7;ba=M-pa|0;c[8142]=ka+pa;c[8139]=ba;c[ka+(pa+4)>>2]=ba|1;c[ka+(M+4)>>2]=40;c[8143]=c[8258];break}M=c[8140]|0;if(da>>>0<M>>>0){c[8140]=da;qa=da}else qa=M;M=da+ga|0;ba=32992|0;while(1){if((c[ba>>2]|0)==(M|0)){Y=223;break}$=c[ba+8>>2]|0;if(!$)break;else ba=$}if((Y|0)==223?(c[ba+12>>2]&8|0)==0:0){c[ba>>2]=da;M=ba+4|0;c[M>>2]=(c[M>>2]|0)+ga;M=da+8|0;if(!(M&7))ra=0;else ra=0-M&7;M=da+(ga+8)|0;if(!(M&7))sa=0;else sa=0-M&7;M=da+(sa+ga)|0;ja=ra+D|0;$=da+ja|0;aa=M-(da+ra)-D|0;c[da+(ra+4)>>2]=D|3;h:do if((M|0)!=(ka|0)){if((M|0)==(c[8141]|0)){N=(c[8138]|0)+aa|0;c[8138]=N;c[8141]=$;c[da+(ja+4)>>2]=N|1;c[da+(N+ja)>>2]=N;break}N=ga+4|0;W=c[da+(N+sa)>>2]|0;if((W&3|0)==1){_=W&-8;Z=W>>>3;i:do if(W>>>0>=256){ca=c[da+((sa|24)+ga)>>2]|0;X=c[da+(ga+12+sa)>>2]|0;do if((X|0)==(M|0)){U=sa|16;V=da+(N+U)|0;O=c[V>>2]|0;if(!O){R=da+(U+ga)|0;U=c[R>>2]|0;if(!U){ta=0;break}else{ua=U;va=R}}else{ua=O;va=V}while(1){V=ua+20|0;O=c[V>>2]|0;if(O){ua=O;va=V;continue}V=ua+16|0;O=c[V>>2]|0;if(!O)break;else{ua=O;va=V}}if(va>>>0<qa>>>0)fa();else{c[va>>2]=0;ta=ua;break}}else{V=c[da+((sa|8)+ga)>>2]|0;if(V>>>0<qa>>>0)fa();O=V+12|0;if((c[O>>2]|0)!=(M|0))fa();R=X+8|0;if((c[R>>2]|0)==(M|0)){c[O>>2]=X;c[R>>2]=V;ta=X;break}else fa()}while(0);if(!ca)break;X=c[da+(ga+28+sa)>>2]|0;l=32848+(X<<2)|0;do if((M|0)!=(c[l>>2]|0)){if(ca>>>0<(c[8140]|0)>>>0)fa();V=ca+16|0;if((c[V>>2]|0)==(M|0))c[V>>2]=ta;else c[ca+20>>2]=ta;if(!ta)break i}else{c[l>>2]=ta;if(ta)break;c[8137]=c[8137]&~(1<<X);break i}while(0);X=c[8140]|0;if(ta>>>0<X>>>0)fa();c[ta+24>>2]=ca;l=sa|16;V=c[da+(l+ga)>>2]|0;do if(V)if(V>>>0<X>>>0)fa();else{c[ta+16>>2]=V;c[V+24>>2]=ta;break}while(0);V=c[da+(N+l)>>2]|0;if(!V)break;if(V>>>0<(c[8140]|0)>>>0)fa();else{c[ta+20>>2]=V;c[V+24>>2]=ta;break}}else{V=c[da+((sa|8)+ga)>>2]|0;X=c[da+(ga+12+sa)>>2]|0;ca=32584+(Z<<1<<2)|0;do if((V|0)!=(ca|0)){if(V>>>0<qa>>>0)fa();if((c[V+12>>2]|0)==(M|0))break;fa()}while(0);if((X|0)==(V|0)){c[8136]=c[8136]&~(1<<Z);break}do if((X|0)==(ca|0))wa=X+8|0;else{if(X>>>0<qa>>>0)fa();l=X+8|0;if((c[l>>2]|0)==(M|0)){wa=l;break}fa()}while(0);c[V+12>>2]=X;c[wa>>2]=V}while(0);xa=da+((_|sa)+ga)|0;ya=_+aa|0}else{xa=M;ya=aa}Z=xa+4|0;c[Z>>2]=c[Z>>2]&-2;c[da+(ja+4)>>2]=ya|1;c[da+(ya+ja)>>2]=ya;Z=ya>>>3;if(ya>>>0<256){N=Z<<1;W=32584+(N<<2)|0;ca=c[8136]|0;l=1<<Z;do if(!(ca&l)){c[8136]=ca|l;za=32584+(N+2<<2)|0;Aa=W}else{Z=32584+(N+2<<2)|0;R=c[Z>>2]|0;if(R>>>0>=(c[8140]|0)>>>0){za=Z;Aa=R;break}fa()}while(0);c[za>>2]=$;c[Aa+12>>2]=$;c[da+(ja+8)>>2]=Aa;c[da+(ja+12)>>2]=W;break}N=ya>>>8;do if(!N)Ba=0;else{if(ya>>>0>16777215){Ba=31;break}l=(N+1048320|0)>>>16&8;ca=N<<l;_=(ca+520192|0)>>>16&4;R=ca<<_;ca=(R+245760|0)>>>16&2;Z=14-(_|l|ca)+(R<<ca>>>15)|0;Ba=ya>>>(Z+7|0)&1|Z<<1}while(0);N=32848+(Ba<<2)|0;c[da+(ja+28)>>2]=Ba;c[da+(ja+20)>>2]=0;c[da+(ja+16)>>2]=0;W=c[8137]|0;Z=1<<Ba;if(!(W&Z)){c[8137]=W|Z;c[N>>2]=$;c[da+(ja+24)>>2]=N;c[da+(ja+12)>>2]=$;c[da+(ja+8)>>2]=$;break}Z=c[N>>2]|0;if((Ba|0)==31)Ca=0;else Ca=25-(Ba>>>1)|0;j:do if((c[Z+4>>2]&-8|0)!=(ya|0)){N=ya<<Ca;W=Z;while(1){Da=W+(N>>>31<<2)+16|0;ca=c[Da>>2]|0;if(!ca)break;if((c[ca+4>>2]&-8|0)==(ya|0)){Ea=ca;break j}else{N=N<<1;W=ca}}if(Da>>>0<(c[8140]|0)>>>0)fa();else{c[Da>>2]=$;c[da+(ja+24)>>2]=W;c[da+(ja+12)>>2]=$;c[da+(ja+8)>>2]=$;break h}}else Ea=Z;while(0);Z=Ea+8|0;N=c[Z>>2]|0;V=c[8140]|0;if(Ea>>>0>=V>>>0&N>>>0>=V>>>0){c[N+12>>2]=$;c[Z>>2]=$;c[da+(ja+8)>>2]=N;c[da+(ja+12)>>2]=Ea;c[da+(ja+24)>>2]=0;break}else fa()}else{N=(c[8139]|0)+aa|0;c[8139]=N;c[8142]=$;c[da+(ja+4)>>2]=N|1}while(0);p=da+(ra|8)|0;i=b;return p|0}ja=32992|0;while(1){Fa=c[ja>>2]|0;if(Fa>>>0<=ka>>>0?(Ga=c[ja+4>>2]|0,Ha=Fa+Ga|0,Ha>>>0>ka>>>0):0)break;ja=c[ja+8>>2]|0}ja=Fa+(Ga+-39)|0;if(!(ja&7))Ia=0;else Ia=0-ja&7;ja=Fa+(Ga+-47+Ia)|0;$=ja>>>0<(ka+16|0)>>>0?ka:ja;ja=$+8|0;aa=da+8|0;if(!(aa&7))Ja=0;else Ja=0-aa&7;aa=ga+-40-Ja|0;c[8142]=da+Ja;c[8139]=aa;c[da+(Ja+4)>>2]=aa|1;c[da+(ga+-36)>>2]=40;c[8143]=c[8258];c[$+4>>2]=27;c[ja+0>>2]=c[8248];c[ja+4>>2]=c[8249];c[ja+8>>2]=c[8250];c[ja+12>>2]=c[8251];c[8248]=da;c[8249]=ga;c[8251]=0;c[8250]=ja;ja=$+28|0;c[ja>>2]=7;if(($+32|0)>>>0<Ha>>>0){aa=ja;do{ja=aa;aa=aa+4|0;c[aa>>2]=7}while((ja+8|0)>>>0<Ha>>>0)}if(($|0)!=(ka|0)){aa=$-ka|0;ja=ka+(aa+4)|0;c[ja>>2]=c[ja>>2]&-2;c[ka+4>>2]=aa|1;c[ka+aa>>2]=aa;ja=aa>>>3;if(aa>>>0<256){M=ja<<1;ba=32584+(M<<2)|0;N=c[8136]|0;Z=1<<ja;do if(!(N&Z)){c[8136]=N|Z;Ka=32584+(M+2<<2)|0;La=ba}else{ja=32584+(M+2<<2)|0;V=c[ja>>2]|0;if(V>>>0>=(c[8140]|0)>>>0){Ka=ja;La=V;break}fa()}while(0);c[Ka>>2]=ka;c[La+12>>2]=ka;c[ka+8>>2]=La;c[ka+12>>2]=ba;break}M=aa>>>8;if(M)if(aa>>>0>16777215)Ma=31;else{Z=(M+1048320|0)>>>16&8;N=M<<Z;M=(N+520192|0)>>>16&4;$=N<<M;N=($+245760|0)>>>16&2;V=14-(M|Z|N)+($<<N>>>15)|0;Ma=aa>>>(V+7|0)&1|V<<1}else Ma=0;V=32848+(Ma<<2)|0;c[ka+28>>2]=Ma;c[ka+20>>2]=0;c[ka+16>>2]=0;N=c[8137]|0;$=1<<Ma;if(!(N&$)){c[8137]=N|$;c[V>>2]=ka;c[ka+24>>2]=V;c[ka+12>>2]=ka;c[ka+8>>2]=ka;break}$=c[V>>2]|0;if((Ma|0)==31)Na=0;else Na=25-(Ma>>>1)|0;k:do if((c[$+4>>2]&-8|0)!=(aa|0)){V=aa<<Na;N=$;while(1){Oa=N+(V>>>31<<2)+16|0;Z=c[Oa>>2]|0;if(!Z)break;if((c[Z+4>>2]&-8|0)==(aa|0)){Pa=Z;break k}else{V=V<<1;N=Z}}if(Oa>>>0<(c[8140]|0)>>>0)fa();else{c[Oa>>2]=ka;c[ka+24>>2]=N;c[ka+12>>2]=ka;c[ka+8>>2]=ka;break g}}else Pa=$;while(0);$=Pa+8|0;aa=c[$>>2]|0;ba=c[8140]|0;if(Pa>>>0>=ba>>>0&aa>>>0>=ba>>>0){c[aa+12>>2]=ka;c[$>>2]=ka;c[ka+8>>2]=aa;c[ka+12>>2]=Pa;c[ka+24>>2]=0;break}else fa()}}else{aa=c[8140]|0;if((aa|0)==0|da>>>0<aa>>>0)c[8140]=da;c[8248]=da;c[8249]=ga;c[8251]=0;c[8145]=c[8254];c[8144]=-1;aa=0;do{$=aa<<1;ba=32584+($<<2)|0;c[32584+($+3<<2)>>2]=ba;c[32584+($+2<<2)>>2]=ba;aa=aa+1|0}while((aa|0)!=32);aa=da+8|0;if(!(aa&7))Qa=0;else Qa=0-aa&7;aa=ga+-40-Qa|0;c[8142]=da+Qa;c[8139]=aa;c[da+(Qa+4)>>2]=aa|1;c[da+(ga+-36)>>2]=40;c[8143]=c[8258]}while(0);ga=c[8139]|0;if(ga>>>0>D>>>0){da=ga-D|0;c[8139]=da;ga=c[8142]|0;c[8142]=ga+D;c[ga+(D+4)>>2]=da|1;c[ga+4>>2]=D|3;p=ga+8|0;i=b;return p|0}}c[(ma()|0)>>2]=12;p=0;i=b;return p|0}function wb(a){a=a|0;var b=0,d=0,e=0,f=0,g=0,h=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0,D=0,E=0,F=0,G=0,H=0,I=0,J=0,K=0;b=i;if(!a){i=b;return}d=a+-8|0;e=c[8140]|0;if(d>>>0<e>>>0)fa();f=c[a+-4>>2]|0;g=f&3;if((g|0)==1)fa();h=f&-8;j=a+(h+-8)|0;do if(!(f&1)){k=c[d>>2]|0;if(!g){i=b;return}l=-8-k|0;m=a+l|0;n=k+h|0;if(m>>>0<e>>>0)fa();if((m|0)==(c[8141]|0)){o=a+(h+-4)|0;p=c[o>>2]|0;if((p&3|0)!=3){q=m;r=n;break}c[8138]=n;c[o>>2]=p&-2;c[a+(l+4)>>2]=n|1;c[j>>2]=n;i=b;return}p=k>>>3;if(k>>>0<256){k=c[a+(l+8)>>2]|0;o=c[a+(l+12)>>2]|0;s=32584+(p<<1<<2)|0;if((k|0)!=(s|0)){if(k>>>0<e>>>0)fa();if((c[k+12>>2]|0)!=(m|0))fa()}if((o|0)==(k|0)){c[8136]=c[8136]&~(1<<p);q=m;r=n;break}if((o|0)!=(s|0)){if(o>>>0<e>>>0)fa();s=o+8|0;if((c[s>>2]|0)==(m|0))t=s;else fa()}else t=o+8|0;c[k+12>>2]=o;c[t>>2]=k;q=m;r=n;break}k=c[a+(l+24)>>2]|0;o=c[a+(l+12)>>2]|0;do if((o|0)==(m|0)){s=a+(l+20)|0;p=c[s>>2]|0;if(!p){u=a+(l+16)|0;v=c[u>>2]|0;if(!v){w=0;break}else{x=v;y=u}}else{x=p;y=s}while(1){s=x+20|0;p=c[s>>2]|0;if(p){x=p;y=s;continue}s=x+16|0;p=c[s>>2]|0;if(!p)break;else{x=p;y=s}}if(y>>>0<e>>>0)fa();else{c[y>>2]=0;w=x;break}}else{s=c[a+(l+8)>>2]|0;if(s>>>0<e>>>0)fa();p=s+12|0;if((c[p>>2]|0)!=(m|0))fa();u=o+8|0;if((c[u>>2]|0)==(m|0)){c[p>>2]=o;c[u>>2]=s;w=o;break}else fa()}while(0);if(k){o=c[a+(l+28)>>2]|0;s=32848+(o<<2)|0;if((m|0)==(c[s>>2]|0)){c[s>>2]=w;if(!w){c[8137]=c[8137]&~(1<<o);q=m;r=n;break}}else{if(k>>>0<(c[8140]|0)>>>0)fa();o=k+16|0;if((c[o>>2]|0)==(m|0))c[o>>2]=w;else c[k+20>>2]=w;if(!w){q=m;r=n;break}}o=c[8140]|0;if(w>>>0<o>>>0)fa();c[w+24>>2]=k;s=c[a+(l+16)>>2]|0;do if(s)if(s>>>0<o>>>0)fa();else{c[w+16>>2]=s;c[s+24>>2]=w;break}while(0);s=c[a+(l+20)>>2]|0;if(s)if(s>>>0<(c[8140]|0)>>>0)fa();else{c[w+20>>2]=s;c[s+24>>2]=w;q=m;r=n;break}else{q=m;r=n}}else{q=m;r=n}}else{q=d;r=h}while(0);if(q>>>0>=j>>>0)fa();d=a+(h+-4)|0;w=c[d>>2]|0;if(!(w&1))fa();if(!(w&2)){if((j|0)==(c[8142]|0)){e=(c[8139]|0)+r|0;c[8139]=e;c[8142]=q;c[q+4>>2]=e|1;if((q|0)!=(c[8141]|0)){i=b;return}c[8141]=0;c[8138]=0;i=b;return}if((j|0)==(c[8141]|0)){e=(c[8138]|0)+r|0;c[8138]=e;c[8141]=q;c[q+4>>2]=e|1;c[q+e>>2]=e;i=b;return}e=(w&-8)+r|0;x=w>>>3;do if(w>>>0>=256){y=c[a+(h+16)>>2]|0;t=c[a+(h|4)>>2]|0;do if((t|0)==(j|0)){g=a+(h+12)|0;f=c[g>>2]|0;if(!f){s=a+(h+8)|0;o=c[s>>2]|0;if(!o){z=0;break}else{A=o;B=s}}else{A=f;B=g}while(1){g=A+20|0;f=c[g>>2]|0;if(f){A=f;B=g;continue}g=A+16|0;f=c[g>>2]|0;if(!f)break;else{A=f;B=g}}if(B>>>0<(c[8140]|0)>>>0)fa();else{c[B>>2]=0;z=A;break}}else{g=c[a+h>>2]|0;if(g>>>0<(c[8140]|0)>>>0)fa();f=g+12|0;if((c[f>>2]|0)!=(j|0))fa();s=t+8|0;if((c[s>>2]|0)==(j|0)){c[f>>2]=t;c[s>>2]=g;z=t;break}else fa()}while(0);if(y){t=c[a+(h+20)>>2]|0;n=32848+(t<<2)|0;if((j|0)==(c[n>>2]|0)){c[n>>2]=z;if(!z){c[8137]=c[8137]&~(1<<t);break}}else{if(y>>>0<(c[8140]|0)>>>0)fa();t=y+16|0;if((c[t>>2]|0)==(j|0))c[t>>2]=z;else c[y+20>>2]=z;if(!z)break}t=c[8140]|0;if(z>>>0<t>>>0)fa();c[z+24>>2]=y;n=c[a+(h+8)>>2]|0;do if(n)if(n>>>0<t>>>0)fa();else{c[z+16>>2]=n;c[n+24>>2]=z;break}while(0);n=c[a+(h+12)>>2]|0;if(n)if(n>>>0<(c[8140]|0)>>>0)fa();else{c[z+20>>2]=n;c[n+24>>2]=z;break}}}else{n=c[a+h>>2]|0;t=c[a+(h|4)>>2]|0;y=32584+(x<<1<<2)|0;if((n|0)!=(y|0)){if(n>>>0<(c[8140]|0)>>>0)fa();if((c[n+12>>2]|0)!=(j|0))fa()}if((t|0)==(n|0)){c[8136]=c[8136]&~(1<<x);break}if((t|0)!=(y|0)){if(t>>>0<(c[8140]|0)>>>0)fa();y=t+8|0;if((c[y>>2]|0)==(j|0))C=y;else fa()}else C=t+8|0;c[n+12>>2]=t;c[C>>2]=n}while(0);c[q+4>>2]=e|1;c[q+e>>2]=e;if((q|0)==(c[8141]|0)){c[8138]=e;i=b;return}else D=e}else{c[d>>2]=w&-2;c[q+4>>2]=r|1;c[q+r>>2]=r;D=r}r=D>>>3;if(D>>>0<256){w=r<<1;d=32584+(w<<2)|0;e=c[8136]|0;C=1<<r;if(e&C){r=32584+(w+2<<2)|0;j=c[r>>2]|0;if(j>>>0<(c[8140]|0)>>>0)fa();else{E=r;F=j}}else{c[8136]=e|C;E=32584+(w+2<<2)|0;F=d}c[E>>2]=q;c[F+12>>2]=q;c[q+8>>2]=F;c[q+12>>2]=d;i=b;return}d=D>>>8;if(d)if(D>>>0>16777215)G=31;else{F=(d+1048320|0)>>>16&8;E=d<<F;d=(E+520192|0)>>>16&4;w=E<<d;E=(w+245760|0)>>>16&2;C=14-(d|F|E)+(w<<E>>>15)|0;G=D>>>(C+7|0)&1|C<<1}else G=0;C=32848+(G<<2)|0;c[q+28>>2]=G;c[q+20>>2]=0;c[q+16>>2]=0;E=c[8137]|0;w=1<<G;a:do if(E&w){F=c[C>>2]|0;if((G|0)==31)H=0;else H=25-(G>>>1)|0;b:do if((c[F+4>>2]&-8|0)!=(D|0)){d=D<<H;e=F;while(1){I=e+(d>>>31<<2)+16|0;j=c[I>>2]|0;if(!j)break;if((c[j+4>>2]&-8|0)==(D|0)){J=j;break b}else{d=d<<1;e=j}}if(I>>>0<(c[8140]|0)>>>0)fa();else{c[I>>2]=q;c[q+24>>2]=e;c[q+12>>2]=q;c[q+8>>2]=q;break a}}else J=F;while(0);F=J+8|0;d=c[F>>2]|0;j=c[8140]|0;if(J>>>0>=j>>>0&d>>>0>=j>>>0){c[d+12>>2]=q;c[F>>2]=q;c[q+8>>2]=d;c[q+12>>2]=J;c[q+24>>2]=0;break}else fa()}else{c[8137]=E|w;c[C>>2]=q;c[q+24>>2]=C;c[q+12>>2]=q;c[q+8>>2]=q}while(0);q=(c[8144]|0)+-1|0;c[8144]=q;if(!q)K=33e3|0;else{i=b;return}while(1){q=c[K>>2]|0;if(!q)break;else K=q+8|0}c[8144]=-1;i=b;return}function xb(){}function yb(a,b,c){a=a|0;b=b|0;c=c|0;if((c|0)<32){D=b>>c;return a>>>c|(b&(1<<c)-1)<<32-c}D=(b|0)<0?-1:0;return b>>c-32|0}function zb(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;var e=0;e=b-d>>>0;e=b-d-(c>>>0>a>>>0|0)>>>0;return (D=e,a-c>>>0|0)|0}function Ab(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;var e=0;e=a+c>>>0;return (D=b+d+(e>>>0<a>>>0|0)>>>0,e|0)|0}function Bb(b,d,e){b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,i=0;f=b+e|0;if((e|0)>=20){d=d&255;g=b&3;h=d|d<<8|d<<16|d<<24;i=f&~3;if(g){g=b+4-g|0;while((b|0)<(g|0)){a[b>>0]=d;b=b+1|0}}while((b|0)<(i|0)){c[b>>2]=h;b=b+4|0}}while((b|0)<(f|0)){a[b>>0]=d;b=b+1|0}return b-e|0}function Cb(a,b,c){a=a|0;b=b|0;c=c|0;if((c|0)<32){D=b>>>c;return a>>>c|(b&(1<<c)-1)<<32-c}D=0;return b>>>c-32|0}function Db(a,b,c){a=a|0;b=b|0;c=c|0;if((c|0)<32){D=b<<c|(a&(1<<c)-1<<32-c)>>>32-c;return a<<c}D=a<<c-32;return 0}function Eb(b){b=b|0;var c=0;c=b;while(a[c>>0]|0)c=c+1|0;return c-b|0}function Fb(b,d,e){b=b|0;d=d|0;e=e|0;var f=0;if((e|0)>=4096)return ka(b|0,d|0,e|0)|0;f=b|0;if((b&3)==(d&3)){while(b&3){if(!e)return f|0;a[b>>0]=a[d>>0]|0;b=b+1|0;d=d+1|0;e=e-1|0}while((e|0)>=4){c[b>>2]=c[d>>2];b=b+4|0;d=d+4|0;e=e-4|0}}while((e|0)>0){a[b>>0]=a[d>>0]|0;b=b+1|0;d=d+1|0;e=e-1|0}return f|0}function Gb(b,c,d){b=b|0;c=c|0;d=d|0;var e=0;if((c|0)<(b|0)&(b|0)<(c+d|0)){e=b;c=c+d|0;b=b+d|0;while((d|0)>0){b=b-1|0;c=c-1|0;d=d-1|0;a[b>>0]=a[c>>0]|0}b=e}else Fb(b,c,d)|0;return b|0}function Hb(b){b=b|0;var c=0;c=a[n+(b>>>24)>>0]|0;if((c|0)<8)return c|0;c=a[n+(b>>16&255)>>0]|0;if((c|0)<8)return c+8|0;c=a[n+(b>>8&255)>>0]|0;if((c|0)<8)return c+16|0;return (a[n+(b&255)>>0]|0)+24|0}function Ib(b){b=b|0;var c=0;c=a[m+(b&255)>>0]|0;if((c|0)<8)return c|0;c=a[m+(b>>8&255)>>0]|0;if((c|0)<8)return c+8|0;c=a[m+(b>>16&255)>>0]|0;if((c|0)<8)return c+16|0;return (a[m+(b>>>24)>>0]|0)+24|0}function Jb(a,b){a=a|0;b=b|0;var c=0,d=0,e=0,f=0;c=a&65535;d=b&65535;e=$(d,c)|0;f=a>>>16;a=(e>>>16)+($(d,f)|0)|0;d=b>>>16;b=$(d,c)|0;return (D=(a>>>16)+($(d,f)|0)+(((a&65535)+b|0)>>>16)|0,a+b<<16|e&65535|0)|0}function Kb(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;var e=0,f=0,g=0,h=0,i=0;e=b>>31|((b|0)<0?-1:0)<<1;f=((b|0)<0?-1:0)>>31|((b|0)<0?-1:0)<<1;g=d>>31|((d|0)<0?-1:0)<<1;h=((d|0)<0?-1:0)>>31|((d|0)<0?-1:0)<<1;i=zb(e^a,f^b,e,f)|0;b=D;a=g^e;e=h^f;f=zb((Pb(i,b,zb(g^c,h^d,g,h)|0,D,0)|0)^a,D^e,a,e)|0;return f|0}function Lb(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0,h=0,j=0,k=0,l=0,m=0;f=i;i=i+8|0;g=f|0;h=b>>31|((b|0)<0?-1:0)<<1;j=((b|0)<0?-1:0)>>31|((b|0)<0?-1:0)<<1;k=e>>31|((e|0)<0?-1:0)<<1;l=((e|0)<0?-1:0)>>31|((e|0)<0?-1:0)<<1;m=zb(h^a,j^b,h,j)|0;b=D;Pb(m,b,zb(k^d,l^e,k,l)|0,D,g)|0;l=zb(c[g>>2]^h,c[g+4>>2]^j,h,j)|0;j=D;i=f;return (D=j,l)|0}function Mb(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;var e=0,f=0;e=a;a=c;c=Jb(e,a)|0;f=D;return (D=($(b,a)|0)+($(d,e)|0)+f|f&0,c|0|0)|0}function Nb(a,b,c,d){a=a|0;b=b|0;c=c|0;d=d|0;var e=0;e=Pb(a,b,c,d,0)|0;return e|0}function Ob(a,b,d,e){a=a|0;b=b|0;d=d|0;e=e|0;var f=0,g=0;f=i;i=i+8|0;g=f|0;Pb(a,b,d,e,g)|0;i=f;return (D=c[g+4>>2]|0,c[g>>2]|0)|0}function Pb(a,b,d,e,f){a=a|0;b=b|0;d=d|0;e=e|0;f=f|0;var g=0,h=0,i=0,j=0,k=0,l=0,m=0,n=0,o=0,p=0,q=0,r=0,s=0,t=0,u=0,v=0,w=0,x=0,y=0,z=0,A=0,B=0,C=0,E=0,F=0,G=0,H=0;g=a;h=b;i=h;j=d;k=e;l=k;if(!i){m=(f|0)!=0;if(!l){if(m){c[f>>2]=(g>>>0)%(j>>>0);c[f+4>>2]=0}n=0;o=(g>>>0)/(j>>>0)>>>0;return (D=n,o)|0}else{if(!m){n=0;o=0;return (D=n,o)|0}c[f>>2]=a|0;c[f+4>>2]=b&0;n=0;o=0;return (D=n,o)|0}}m=(l|0)==0;do if(j){if(!m){p=(Hb(l|0)|0)-(Hb(i|0)|0)|0;if(p>>>0<=31){q=p+1|0;r=31-p|0;s=p-31>>31;t=q;u=g>>>(q>>>0)&s|i<<r;v=i>>>(q>>>0)&s;w=0;x=g<<r;break}if(!f){n=0;o=0;return (D=n,o)|0}c[f>>2]=a|0;c[f+4>>2]=h|b&0;n=0;o=0;return (D=n,o)|0}r=j-1|0;if(r&j){s=(Hb(j|0)|0)+33-(Hb(i|0)|0)|0;q=64-s|0;p=32-s|0;y=p>>31;z=s-32|0;A=z>>31;t=s;u=p-1>>31&i>>>(z>>>0)|(i<<p|g>>>(s>>>0))&A;v=A&i>>>(s>>>0);w=g<<q&y;x=(i<<q|g>>>(z>>>0))&y|g<<p&s-33>>31;break}if(f){c[f>>2]=r&g;c[f+4>>2]=0}if((j|0)==1){n=h|b&0;o=a|0|0;return (D=n,o)|0}else{r=Ib(j|0)|0;n=i>>>(r>>>0)|0;o=i<<32-r|g>>>(r>>>0)|0;return (D=n,o)|0}}else{if(m){if(f){c[f>>2]=(i>>>0)%(j>>>0);c[f+4>>2]=0}n=0;o=(i>>>0)/(j>>>0)>>>0;return (D=n,o)|0}if(!g){if(f){c[f>>2]=0;c[f+4>>2]=(i>>>0)%(l>>>0)}n=0;o=(i>>>0)/(l>>>0)>>>0;return (D=n,o)|0}r=l-1|0;if(!(r&l)){if(f){c[f>>2]=a|0;c[f+4>>2]=r&i|b&0}n=0;o=i>>>((Ib(l|0)|0)>>>0);return (D=n,o)|0}r=(Hb(l|0)|0)-(Hb(i|0)|0)|0;if(r>>>0<=30){s=r+1|0;p=31-r|0;t=s;u=i<<p|g>>>(s>>>0);v=i>>>(s>>>0);w=0;x=g<<p;break}if(!f){n=0;o=0;return (D=n,o)|0}c[f>>2]=a|0;c[f+4>>2]=h|b&0;n=0;o=0;return (D=n,o)|0}while(0);if(!t){B=x;C=w;E=v;F=u;G=0;H=0}else{b=d|0|0;d=k|e&0;e=Ab(b,d,-1,-1)|0;k=D;h=x;x=w;w=v;v=u;u=t;t=0;do{a=h;h=x>>>31|h<<1;x=t|x<<1;g=v<<1|a>>>31|0;a=v>>>31|w<<1|0;zb(e,k,g,a)|0;i=D;l=i>>31|((i|0)<0?-1:0)<<1;t=l&1;v=zb(g,a,l&b,(((i|0)<0?-1:0)>>31|((i|0)<0?-1:0)<<1)&d)|0;w=D;u=u-1|0}while((u|0)!=0);B=h;C=x;E=w;F=v;G=0;H=t}t=C;C=0;if(f){c[f>>2]=F;c[f+4>>2]=E}n=(t|0)>>>31|(B|C)<<1|(C<<1|t>>>31)&0|G;o=(t<<1|0>>>31)&-2|H;return (D=n,o)|0}

// EMSCRIPTEN_END_FUNCS
return{_curve25519_verify:ya,_crypto_sign_ed25519_ref10_ge_scalarmult_base:jb,_curve25519_sign:xa,_free:wb,_i64Add:Ab,_memmove:Gb,_bitshift64Ashr:yb,_sph_sha512_init:qb,_curve25519_donna:Ba,_memset:Bb,_malloc:vb,_memcpy:Fb,_strlen:Eb,_bitshift64Lshr:Cb,_i64Subtract:zb,_bitshift64Shl:Db,runPostSets:xb,stackAlloc:oa,stackSave:pa,stackRestore:qa,setThrew:ra,setTempRet0:ua,getTempRet0:va}})


// EMSCRIPTEN_END_ASM
(Module.asmGlobalArg,Module.asmLibraryArg,buffer);var _curve25519_verify=Module["_curve25519_verify"]=asm["_curve25519_verify"];var _crypto_sign_ed25519_ref10_ge_scalarmult_base=Module["_crypto_sign_ed25519_ref10_ge_scalarmult_base"]=asm["_crypto_sign_ed25519_ref10_ge_scalarmult_base"];var _curve25519_sign=Module["_curve25519_sign"]=asm["_curve25519_sign"];var _free=Module["_free"]=asm["_free"];var _i64Add=Module["_i64Add"]=asm["_i64Add"];var _memmove=Module["_memmove"]=asm["_memmove"];var _bitshift64Ashr=Module["_bitshift64Ashr"]=asm["_bitshift64Ashr"];var _sph_sha512_init=Module["_sph_sha512_init"]=asm["_sph_sha512_init"];var _curve25519_donna=Module["_curve25519_donna"]=asm["_curve25519_donna"];var _memset=Module["_memset"]=asm["_memset"];var _malloc=Module["_malloc"]=asm["_malloc"];var _memcpy=Module["_memcpy"]=asm["_memcpy"];var _strlen=Module["_strlen"]=asm["_strlen"];var _bitshift64Lshr=Module["_bitshift64Lshr"]=asm["_bitshift64Lshr"];var _i64Subtract=Module["_i64Subtract"]=asm["_i64Subtract"];var _bitshift64Shl=Module["_bitshift64Shl"]=asm["_bitshift64Shl"];var runPostSets=Module["runPostSets"]=asm["runPostSets"];Runtime.stackAlloc=asm["stackAlloc"];Runtime.stackSave=asm["stackSave"];Runtime.stackRestore=asm["stackRestore"];Runtime.setTempRet0=asm["setTempRet0"];Runtime.getTempRet0=asm["getTempRet0"];var i64Math=(function(){var goog={math:{}};goog.math.Long=(function(low,high){this.low_=low|0;this.high_=high|0});goog.math.Long.IntCache_={};goog.math.Long.fromInt=(function(value){if(-128<=value&&value<128){var cachedObj=goog.math.Long.IntCache_[value];if(cachedObj){return cachedObj}}var obj=new goog.math.Long(value|0,value<0?-1:0);if(-128<=value&&value<128){goog.math.Long.IntCache_[value]=obj}return obj});goog.math.Long.fromNumber=(function(value){if(isNaN(value)||!isFinite(value)){return goog.math.Long.ZERO}else if(value<=-goog.math.Long.TWO_PWR_63_DBL_){return goog.math.Long.MIN_VALUE}else if(value+1>=goog.math.Long.TWO_PWR_63_DBL_){return goog.math.Long.MAX_VALUE}else if(value<0){return goog.math.Long.fromNumber(-value).negate()}else{return new goog.math.Long(value%goog.math.Long.TWO_PWR_32_DBL_|0,value/goog.math.Long.TWO_PWR_32_DBL_|0)}});goog.math.Long.fromBits=(function(lowBits,highBits){return new goog.math.Long(lowBits,highBits)});goog.math.Long.fromString=(function(str,opt_radix){if(str.length==0){throw Error("number format error: empty string")}var radix=opt_radix||10;if(radix<2||36<radix){throw Error("radix out of range: "+radix)}if(str.charAt(0)=="-"){return goog.math.Long.fromString(str.substring(1),radix).negate()}else if(str.indexOf("-")>=0){throw Error('number format error: interior "-" character: '+str)}var radixToPower=goog.math.Long.fromNumber(Math.pow(radix,8));var result=goog.math.Long.ZERO;for(var i=0;i<str.length;i+=8){var size=Math.min(8,str.length-i);var value=parseInt(str.substring(i,i+size),radix);if(size<8){var power=goog.math.Long.fromNumber(Math.pow(radix,size));result=result.multiply(power).add(goog.math.Long.fromNumber(value))}else{result=result.multiply(radixToPower);result=result.add(goog.math.Long.fromNumber(value))}}return result});goog.math.Long.TWO_PWR_16_DBL_=1<<16;goog.math.Long.TWO_PWR_24_DBL_=1<<24;goog.math.Long.TWO_PWR_32_DBL_=goog.math.Long.TWO_PWR_16_DBL_*goog.math.Long.TWO_PWR_16_DBL_;goog.math.Long.TWO_PWR_31_DBL_=goog.math.Long.TWO_PWR_32_DBL_/2;goog.math.Long.TWO_PWR_48_DBL_=goog.math.Long.TWO_PWR_32_DBL_*goog.math.Long.TWO_PWR_16_DBL_;goog.math.Long.TWO_PWR_64_DBL_=goog.math.Long.TWO_PWR_32_DBL_*goog.math.Long.TWO_PWR_32_DBL_;goog.math.Long.TWO_PWR_63_DBL_=goog.math.Long.TWO_PWR_64_DBL_/2;goog.math.Long.ZERO=goog.math.Long.fromInt(0);goog.math.Long.ONE=goog.math.Long.fromInt(1);goog.math.Long.NEG_ONE=goog.math.Long.fromInt(-1);goog.math.Long.MAX_VALUE=goog.math.Long.fromBits(4294967295|0,2147483647|0);goog.math.Long.MIN_VALUE=goog.math.Long.fromBits(0,2147483648|0);goog.math.Long.TWO_PWR_24_=goog.math.Long.fromInt(1<<24);goog.math.Long.prototype.toInt=(function(){return this.low_});goog.math.Long.prototype.toNumber=(function(){return this.high_*goog.math.Long.TWO_PWR_32_DBL_+this.getLowBitsUnsigned()});goog.math.Long.prototype.toString=(function(opt_radix){var radix=opt_radix||10;if(radix<2||36<radix){throw Error("radix out of range: "+radix)}if(this.isZero()){return"0"}if(this.isNegative()){if(this.equals(goog.math.Long.MIN_VALUE)){var radixLong=goog.math.Long.fromNumber(radix);var div=this.div(radixLong);var rem=div.multiply(radixLong).subtract(this);return div.toString(radix)+rem.toInt().toString(radix)}else{return"-"+this.negate().toString(radix)}}var radixToPower=goog.math.Long.fromNumber(Math.pow(radix,6));var rem=this;var result="";while(true){var remDiv=rem.div(radixToPower);var intval=rem.subtract(remDiv.multiply(radixToPower)).toInt();var digits=intval.toString(radix);rem=remDiv;if(rem.isZero()){return digits+result}else{while(digits.length<6){digits="0"+digits}result=""+digits+result}}});goog.math.Long.prototype.getHighBits=(function(){return this.high_});goog.math.Long.prototype.getLowBits=(function(){return this.low_});goog.math.Long.prototype.getLowBitsUnsigned=(function(){return this.low_>=0?this.low_:goog.math.Long.TWO_PWR_32_DBL_+this.low_});goog.math.Long.prototype.getNumBitsAbs=(function(){if(this.isNegative()){if(this.equals(goog.math.Long.MIN_VALUE)){return 64}else{return this.negate().getNumBitsAbs()}}else{var val=this.high_!=0?this.high_:this.low_;for(var bit=31;bit>0;bit--){if((val&1<<bit)!=0){break}}return this.high_!=0?bit+33:bit+1}});goog.math.Long.prototype.isZero=(function(){return this.high_==0&&this.low_==0});goog.math.Long.prototype.isNegative=(function(){return this.high_<0});goog.math.Long.prototype.isOdd=(function(){return(this.low_&1)==1});goog.math.Long.prototype.equals=(function(other){return this.high_==other.high_&&this.low_==other.low_});goog.math.Long.prototype.notEquals=(function(other){return this.high_!=other.high_||this.low_!=other.low_});goog.math.Long.prototype.lessThan=(function(other){return this.compare(other)<0});goog.math.Long.prototype.lessThanOrEqual=(function(other){return this.compare(other)<=0});goog.math.Long.prototype.greaterThan=(function(other){return this.compare(other)>0});goog.math.Long.prototype.greaterThanOrEqual=(function(other){return this.compare(other)>=0});goog.math.Long.prototype.compare=(function(other){if(this.equals(other)){return 0}var thisNeg=this.isNegative();var otherNeg=other.isNegative();if(thisNeg&&!otherNeg){return-1}if(!thisNeg&&otherNeg){return 1}if(this.subtract(other).isNegative()){return-1}else{return 1}});goog.math.Long.prototype.negate=(function(){if(this.equals(goog.math.Long.MIN_VALUE)){return goog.math.Long.MIN_VALUE}else{return this.not().add(goog.math.Long.ONE)}});goog.math.Long.prototype.add=(function(other){var a48=this.high_>>>16;var a32=this.high_&65535;var a16=this.low_>>>16;var a00=this.low_&65535;var b48=other.high_>>>16;var b32=other.high_&65535;var b16=other.low_>>>16;var b00=other.low_&65535;var c48=0,c32=0,c16=0,c00=0;c00+=a00+b00;c16+=c00>>>16;c00&=65535;c16+=a16+b16;c32+=c16>>>16;c16&=65535;c32+=a32+b32;c48+=c32>>>16;c32&=65535;c48+=a48+b48;c48&=65535;return goog.math.Long.fromBits(c16<<16|c00,c48<<16|c32)});goog.math.Long.prototype.subtract=(function(other){return this.add(other.negate())});goog.math.Long.prototype.multiply=(function(other){if(this.isZero()){return goog.math.Long.ZERO}else if(other.isZero()){return goog.math.Long.ZERO}if(this.equals(goog.math.Long.MIN_VALUE)){return other.isOdd()?goog.math.Long.MIN_VALUE:goog.math.Long.ZERO}else if(other.equals(goog.math.Long.MIN_VALUE)){return this.isOdd()?goog.math.Long.MIN_VALUE:goog.math.Long.ZERO}if(this.isNegative()){if(other.isNegative()){return this.negate().multiply(other.negate())}else{return this.negate().multiply(other).negate()}}else if(other.isNegative()){return this.multiply(other.negate()).negate()}if(this.lessThan(goog.math.Long.TWO_PWR_24_)&&other.lessThan(goog.math.Long.TWO_PWR_24_)){return goog.math.Long.fromNumber(this.toNumber()*other.toNumber())}var a48=this.high_>>>16;var a32=this.high_&65535;var a16=this.low_>>>16;var a00=this.low_&65535;var b48=other.high_>>>16;var b32=other.high_&65535;var b16=other.low_>>>16;var b00=other.low_&65535;var c48=0,c32=0,c16=0,c00=0;c00+=a00*b00;c16+=c00>>>16;c00&=65535;c16+=a16*b00;c32+=c16>>>16;c16&=65535;c16+=a00*b16;c32+=c16>>>16;c16&=65535;c32+=a32*b00;c48+=c32>>>16;c32&=65535;c32+=a16*b16;c48+=c32>>>16;c32&=65535;c32+=a00*b32;c48+=c32>>>16;c32&=65535;c48+=a48*b00+a32*b16+a16*b32+a00*b48;c48&=65535;return goog.math.Long.fromBits(c16<<16|c00,c48<<16|c32)});goog.math.Long.prototype.div=(function(other){if(other.isZero()){throw Error("division by zero")}else if(this.isZero()){return goog.math.Long.ZERO}if(this.equals(goog.math.Long.MIN_VALUE)){if(other.equals(goog.math.Long.ONE)||other.equals(goog.math.Long.NEG_ONE)){return goog.math.Long.MIN_VALUE}else if(other.equals(goog.math.Long.MIN_VALUE)){return goog.math.Long.ONE}else{var halfThis=this.shiftRight(1);var approx=halfThis.div(other).shiftLeft(1);if(approx.equals(goog.math.Long.ZERO)){return other.isNegative()?goog.math.Long.ONE:goog.math.Long.NEG_ONE}else{var rem=this.subtract(other.multiply(approx));var result=approx.add(rem.div(other));return result}}}else if(other.equals(goog.math.Long.MIN_VALUE)){return goog.math.Long.ZERO}if(this.isNegative()){if(other.isNegative()){return this.negate().div(other.negate())}else{return this.negate().div(other).negate()}}else if(other.isNegative()){return this.div(other.negate()).negate()}var res=goog.math.Long.ZERO;var rem=this;while(rem.greaterThanOrEqual(other)){var approx=Math.max(1,Math.floor(rem.toNumber()/other.toNumber()));var log2=Math.ceil(Math.log(approx)/Math.LN2);var delta=log2<=48?1:Math.pow(2,log2-48);var approxRes=goog.math.Long.fromNumber(approx);var approxRem=approxRes.multiply(other);while(approxRem.isNegative()||approxRem.greaterThan(rem)){approx-=delta;approxRes=goog.math.Long.fromNumber(approx);approxRem=approxRes.multiply(other)}if(approxRes.isZero()){approxRes=goog.math.Long.ONE}res=res.add(approxRes);rem=rem.subtract(approxRem)}return res});goog.math.Long.prototype.modulo=(function(other){return this.subtract(this.div(other).multiply(other))});goog.math.Long.prototype.not=(function(){return goog.math.Long.fromBits(~this.low_,~this.high_)});goog.math.Long.prototype.and=(function(other){return goog.math.Long.fromBits(this.low_&other.low_,this.high_&other.high_)});goog.math.Long.prototype.or=(function(other){return goog.math.Long.fromBits(this.low_|other.low_,this.high_|other.high_)});goog.math.Long.prototype.xor=(function(other){return goog.math.Long.fromBits(this.low_^other.low_,this.high_^other.high_)});goog.math.Long.prototype.shiftLeft=(function(numBits){numBits&=63;if(numBits==0){return this}else{var low=this.low_;if(numBits<32){var high=this.high_;return goog.math.Long.fromBits(low<<numBits,high<<numBits|low>>>32-numBits)}else{return goog.math.Long.fromBits(0,low<<numBits-32)}}});goog.math.Long.prototype.shiftRight=(function(numBits){numBits&=63;if(numBits==0){return this}else{var high=this.high_;if(numBits<32){var low=this.low_;return goog.math.Long.fromBits(low>>>numBits|high<<32-numBits,high>>numBits)}else{return goog.math.Long.fromBits(high>>numBits-32,high>=0?0:-1)}}});goog.math.Long.prototype.shiftRightUnsigned=(function(numBits){numBits&=63;if(numBits==0){return this}else{var high=this.high_;if(numBits<32){var low=this.low_;return goog.math.Long.fromBits(low>>>numBits|high<<32-numBits,high>>>numBits)}else if(numBits==32){return goog.math.Long.fromBits(high,0)}else{return goog.math.Long.fromBits(high>>>numBits-32,0)}}});var navigator={appName:"Modern Browser"};var dbits;var canary=0xdeadbeefcafe;var j_lm=(canary&16777215)==15715070;function BigInteger(a,b,c){if(a!=null)if("number"==typeof a)this.fromNumber(a,b,c);else if(b==null&&"string"!=typeof a)this.fromString(a,256);else this.fromString(a,b)}function nbi(){return new BigInteger(null)}function am1(i,x,w,j,c,n){while(--n>=0){var v=x*this[i++]+w[j]+c;c=Math.floor(v/67108864);w[j++]=v&67108863}return c}function am2(i,x,w,j,c,n){var xl=x&32767,xh=x>>15;while(--n>=0){var l=this[i]&32767;var h=this[i++]>>15;var m=xh*l+h*xl;l=xl*l+((m&32767)<<15)+w[j]+(c&1073741823);c=(l>>>30)+(m>>>15)+xh*h+(c>>>30);w[j++]=l&1073741823}return c}function am3(i,x,w,j,c,n){var xl=x&16383,xh=x>>14;while(--n>=0){var l=this[i]&16383;var h=this[i++]>>14;var m=xh*l+h*xl;l=xl*l+((m&16383)<<14)+w[j]+c;c=(l>>28)+(m>>14)+xh*h;w[j++]=l&268435455}return c}if(j_lm&&navigator.appName=="Microsoft Internet Explorer"){BigInteger.prototype.am=am2;dbits=30}else if(j_lm&&navigator.appName!="Netscape"){BigInteger.prototype.am=am1;dbits=26}else{BigInteger.prototype.am=am3;dbits=28}BigInteger.prototype.DB=dbits;BigInteger.prototype.DM=(1<<dbits)-1;BigInteger.prototype.DV=1<<dbits;var BI_FP=52;BigInteger.prototype.FV=Math.pow(2,BI_FP);BigInteger.prototype.F1=BI_FP-dbits;BigInteger.prototype.F2=2*dbits-BI_FP;var BI_RM="0123456789abcdefghijklmnopqrstuvwxyz";var BI_RC=new Array;var rr,vv;rr="0".charCodeAt(0);for(vv=0;vv<=9;++vv)BI_RC[rr++]=vv;rr="a".charCodeAt(0);for(vv=10;vv<36;++vv)BI_RC[rr++]=vv;rr="A".charCodeAt(0);for(vv=10;vv<36;++vv)BI_RC[rr++]=vv;function int2char(n){return BI_RM.charAt(n)}function intAt(s,i){var c=BI_RC[s.charCodeAt(i)];return c==null?-1:c}function bnpCopyTo(r){for(var i=this.t-1;i>=0;--i)r[i]=this[i];r.t=this.t;r.s=this.s}function bnpFromInt(x){this.t=1;this.s=x<0?-1:0;if(x>0)this[0]=x;else if(x<-1)this[0]=x+DV;else this.t=0}function nbv(i){var r=nbi();r.fromInt(i);return r}function bnpFromString(s,b){var k;if(b==16)k=4;else if(b==8)k=3;else if(b==256)k=8;else if(b==2)k=1;else if(b==32)k=5;else if(b==4)k=2;else{this.fromRadix(s,b);return}this.t=0;this.s=0;var i=s.length,mi=false,sh=0;while(--i>=0){var x=k==8?s[i]&255:intAt(s,i);if(x<0){if(s.charAt(i)=="-")mi=true;continue}mi=false;if(sh==0)this[this.t++]=x;else if(sh+k>this.DB){this[this.t-1]|=(x&(1<<this.DB-sh)-1)<<sh;this[this.t++]=x>>this.DB-sh}else this[this.t-1]|=x<<sh;sh+=k;if(sh>=this.DB)sh-=this.DB}if(k==8&&(s[0]&128)!=0){this.s=-1;if(sh>0)this[this.t-1]|=(1<<this.DB-sh)-1<<sh}this.clamp();if(mi)BigInteger.ZERO.subTo(this,this)}function bnpClamp(){var c=this.s&this.DM;while(this.t>0&&this[this.t-1]==c)--this.t}function bnToString(b){if(this.s<0)return"-"+this.negate().toString(b);var k;if(b==16)k=4;else if(b==8)k=3;else if(b==2)k=1;else if(b==32)k=5;else if(b==4)k=2;else return this.toRadix(b);var km=(1<<k)-1,d,m=false,r="",i=this.t;var p=this.DB-i*this.DB%k;if(i-->0){if(p<this.DB&&(d=this[i]>>p)>0){m=true;r=int2char(d)}while(i>=0){if(p<k){d=(this[i]&(1<<p)-1)<<k-p;d|=this[--i]>>(p+=this.DB-k)}else{d=this[i]>>(p-=k)&km;if(p<=0){p+=this.DB;--i}}if(d>0)m=true;if(m)r+=int2char(d)}}return m?r:"0"}function bnNegate(){var r=nbi();BigInteger.ZERO.subTo(this,r);return r}function bnAbs(){return this.s<0?this.negate():this}function bnCompareTo(a){var r=this.s-a.s;if(r!=0)return r;var i=this.t;r=i-a.t;if(r!=0)return this.s<0?-r:r;while(--i>=0)if((r=this[i]-a[i])!=0)return r;return 0}function nbits(x){var r=1,t;if((t=x>>>16)!=0){x=t;r+=16}if((t=x>>8)!=0){x=t;r+=8}if((t=x>>4)!=0){x=t;r+=4}if((t=x>>2)!=0){x=t;r+=2}if((t=x>>1)!=0){x=t;r+=1}return r}function bnBitLength(){if(this.t<=0)return 0;return this.DB*(this.t-1)+nbits(this[this.t-1]^this.s&this.DM)}function bnpDLShiftTo(n,r){var i;for(i=this.t-1;i>=0;--i)r[i+n]=this[i];for(i=n-1;i>=0;--i)r[i]=0;r.t=this.t+n;r.s=this.s}function bnpDRShiftTo(n,r){for(var i=n;i<this.t;++i)r[i-n]=this[i];r.t=Math.max(this.t-n,0);r.s=this.s}function bnpLShiftTo(n,r){var bs=n%this.DB;var cbs=this.DB-bs;var bm=(1<<cbs)-1;var ds=Math.floor(n/this.DB),c=this.s<<bs&this.DM,i;for(i=this.t-1;i>=0;--i){r[i+ds+1]=this[i]>>cbs|c;c=(this[i]&bm)<<bs}for(i=ds-1;i>=0;--i)r[i]=0;r[ds]=c;r.t=this.t+ds+1;r.s=this.s;r.clamp()}function bnpRShiftTo(n,r){r.s=this.s;var ds=Math.floor(n/this.DB);if(ds>=this.t){r.t=0;return}var bs=n%this.DB;var cbs=this.DB-bs;var bm=(1<<bs)-1;r[0]=this[ds]>>bs;for(var i=ds+1;i<this.t;++i){r[i-ds-1]|=(this[i]&bm)<<cbs;r[i-ds]=this[i]>>bs}if(bs>0)r[this.t-ds-1]|=(this.s&bm)<<cbs;r.t=this.t-ds;r.clamp()}function bnpSubTo(a,r){var i=0,c=0,m=Math.min(a.t,this.t);while(i<m){c+=this[i]-a[i];r[i++]=c&this.DM;c>>=this.DB}if(a.t<this.t){c-=a.s;while(i<this.t){c+=this[i];r[i++]=c&this.DM;c>>=this.DB}c+=this.s}else{c+=this.s;while(i<a.t){c-=a[i];r[i++]=c&this.DM;c>>=this.DB}c-=a.s}r.s=c<0?-1:0;if(c<-1)r[i++]=this.DV+c;else if(c>0)r[i++]=c;r.t=i;r.clamp()}function bnpMultiplyTo(a,r){var x=this.abs(),y=a.abs();var i=x.t;r.t=i+y.t;while(--i>=0)r[i]=0;for(i=0;i<y.t;++i)r[i+x.t]=x.am(0,y[i],r,i,0,x.t);r.s=0;r.clamp();if(this.s!=a.s)BigInteger.ZERO.subTo(r,r)}function bnpSquareTo(r){var x=this.abs();var i=r.t=2*x.t;while(--i>=0)r[i]=0;for(i=0;i<x.t-1;++i){var c=x.am(i,x[i],r,2*i,0,1);if((r[i+x.t]+=x.am(i+1,2*x[i],r,2*i+1,c,x.t-i-1))>=x.DV){r[i+x.t]-=x.DV;r[i+x.t+1]=1}}if(r.t>0)r[r.t-1]+=x.am(i,x[i],r,2*i,0,1);r.s=0;r.clamp()}function bnpDivRemTo(m,q,r){var pm=m.abs();if(pm.t<=0)return;var pt=this.abs();if(pt.t<pm.t){if(q!=null)q.fromInt(0);if(r!=null)this.copyTo(r);return}if(r==null)r=nbi();var y=nbi(),ts=this.s,ms=m.s;var nsh=this.DB-nbits(pm[pm.t-1]);if(nsh>0){pm.lShiftTo(nsh,y);pt.lShiftTo(nsh,r)}else{pm.copyTo(y);pt.copyTo(r)}var ys=y.t;var y0=y[ys-1];if(y0==0)return;var yt=y0*(1<<this.F1)+(ys>1?y[ys-2]>>this.F2:0);var d1=this.FV/yt,d2=(1<<this.F1)/yt,e=1<<this.F2;var i=r.t,j=i-ys,t=q==null?nbi():q;y.dlShiftTo(j,t);if(r.compareTo(t)>=0){r[r.t++]=1;r.subTo(t,r)}BigInteger.ONE.dlShiftTo(ys,t);t.subTo(y,y);while(y.t<ys)y[y.t++]=0;while(--j>=0){var qd=r[--i]==y0?this.DM:Math.floor(r[i]*d1+(r[i-1]+e)*d2);if((r[i]+=y.am(0,qd,r,j,0,ys))<qd){y.dlShiftTo(j,t);r.subTo(t,r);while(r[i]<--qd)r.subTo(t,r)}}if(q!=null){r.drShiftTo(ys,q);if(ts!=ms)BigInteger.ZERO.subTo(q,q)}r.t=ys;r.clamp();if(nsh>0)r.rShiftTo(nsh,r);if(ts<0)BigInteger.ZERO.subTo(r,r)}function bnMod(a){var r=nbi();this.abs().divRemTo(a,null,r);if(this.s<0&&r.compareTo(BigInteger.ZERO)>0)a.subTo(r,r);return r}function Classic(m){this.m=m}function cConvert(x){if(x.s<0||x.compareTo(this.m)>=0)return x.mod(this.m);else return x}function cRevert(x){return x}function cReduce(x){x.divRemTo(this.m,null,x)}function cMulTo(x,y,r){x.multiplyTo(y,r);this.reduce(r)}function cSqrTo(x,r){x.squareTo(r);this.reduce(r)}Classic.prototype.convert=cConvert;Classic.prototype.revert=cRevert;Classic.prototype.reduce=cReduce;Classic.prototype.mulTo=cMulTo;Classic.prototype.sqrTo=cSqrTo;function bnpInvDigit(){if(this.t<1)return 0;var x=this[0];if((x&1)==0)return 0;var y=x&3;y=y*(2-(x&15)*y)&15;y=y*(2-(x&255)*y)&255;y=y*(2-((x&65535)*y&65535))&65535;y=y*(2-x*y%this.DV)%this.DV;return y>0?this.DV-y:-y}function Montgomery(m){this.m=m;this.mp=m.invDigit();this.mpl=this.mp&32767;this.mph=this.mp>>15;this.um=(1<<m.DB-15)-1;this.mt2=2*m.t}function montConvert(x){var r=nbi();x.abs().dlShiftTo(this.m.t,r);r.divRemTo(this.m,null,r);if(x.s<0&&r.compareTo(BigInteger.ZERO)>0)this.m.subTo(r,r);return r}function montRevert(x){var r=nbi();x.copyTo(r);this.reduce(r);return r}function montReduce(x){while(x.t<=this.mt2)x[x.t++]=0;for(var i=0;i<this.m.t;++i){var j=x[i]&32767;var u0=j*this.mpl+((j*this.mph+(x[i]>>15)*this.mpl&this.um)<<15)&x.DM;j=i+this.m.t;x[j]+=this.m.am(0,u0,x,i,0,this.m.t);while(x[j]>=x.DV){x[j]-=x.DV;x[++j]++}}x.clamp();x.drShiftTo(this.m.t,x);if(x.compareTo(this.m)>=0)x.subTo(this.m,x)}function montSqrTo(x,r){x.squareTo(r);this.reduce(r)}function montMulTo(x,y,r){x.multiplyTo(y,r);this.reduce(r)}Montgomery.prototype.convert=montConvert;Montgomery.prototype.revert=montRevert;Montgomery.prototype.reduce=montReduce;Montgomery.prototype.mulTo=montMulTo;Montgomery.prototype.sqrTo=montSqrTo;function bnpIsEven(){return(this.t>0?this[0]&1:this.s)==0}function bnpExp(e,z){if(e>4294967295||e<1)return BigInteger.ONE;var r=nbi(),r2=nbi(),g=z.convert(this),i=nbits(e)-1;g.copyTo(r);while(--i>=0){z.sqrTo(r,r2);if((e&1<<i)>0)z.mulTo(r2,g,r);else{var t=r;r=r2;r2=t}}return z.revert(r)}function bnModPowInt(e,m){var z;if(e<256||m.isEven())z=new Classic(m);else z=new Montgomery(m);return this.exp(e,z)}BigInteger.prototype.copyTo=bnpCopyTo;BigInteger.prototype.fromInt=bnpFromInt;BigInteger.prototype.fromString=bnpFromString;BigInteger.prototype.clamp=bnpClamp;BigInteger.prototype.dlShiftTo=bnpDLShiftTo;BigInteger.prototype.drShiftTo=bnpDRShiftTo;BigInteger.prototype.lShiftTo=bnpLShiftTo;BigInteger.prototype.rShiftTo=bnpRShiftTo;BigInteger.prototype.subTo=bnpSubTo;BigInteger.prototype.multiplyTo=bnpMultiplyTo;BigInteger.prototype.squareTo=bnpSquareTo;BigInteger.prototype.divRemTo=bnpDivRemTo;BigInteger.prototype.invDigit=bnpInvDigit;BigInteger.prototype.isEven=bnpIsEven;BigInteger.prototype.exp=bnpExp;BigInteger.prototype.toString=bnToString;BigInteger.prototype.negate=bnNegate;BigInteger.prototype.abs=bnAbs;BigInteger.prototype.compareTo=bnCompareTo;BigInteger.prototype.bitLength=bnBitLength;BigInteger.prototype.mod=bnMod;BigInteger.prototype.modPowInt=bnModPowInt;BigInteger.ZERO=nbv(0);BigInteger.ONE=nbv(1);function bnpFromRadix(s,b){this.fromInt(0);if(b==null)b=10;var cs=this.chunkSize(b);var d=Math.pow(b,cs),mi=false,j=0,w=0;for(var i=0;i<s.length;++i){var x=intAt(s,i);if(x<0){if(s.charAt(i)=="-"&&this.signum()==0)mi=true;continue}w=b*w+x;if(++j>=cs){this.dMultiply(d);this.dAddOffset(w,0);j=0;w=0}}if(j>0){this.dMultiply(Math.pow(b,j));this.dAddOffset(w,0)}if(mi)BigInteger.ZERO.subTo(this,this)}function bnpChunkSize(r){return Math.floor(Math.LN2*this.DB/Math.log(r))}function bnSigNum(){if(this.s<0)return-1;else if(this.t<=0||this.t==1&&this[0]<=0)return 0;else return 1}function bnpDMultiply(n){this[this.t]=this.am(0,n-1,this,0,0,this.t);++this.t;this.clamp()}function bnpDAddOffset(n,w){if(n==0)return;while(this.t<=w)this[this.t++]=0;this[w]+=n;while(this[w]>=this.DV){this[w]-=this.DV;if(++w>=this.t)this[this.t++]=0;++this[w]}}function bnpToRadix(b){if(b==null)b=10;if(this.signum()==0||b<2||b>36)return"0";var cs=this.chunkSize(b);var a=Math.pow(b,cs);var d=nbv(a),y=nbi(),z=nbi(),r="";this.divRemTo(d,y,z);while(y.signum()>0){r=(a+z.intValue()).toString(b).substr(1)+r;y.divRemTo(d,y,z)}return z.intValue().toString(b)+r}function bnIntValue(){if(this.s<0){if(this.t==1)return this[0]-this.DV;else if(this.t==0)return-1}else if(this.t==1)return this[0];else if(this.t==0)return 0;return(this[1]&(1<<32-this.DB)-1)<<this.DB|this[0]}function bnpAddTo(a,r){var i=0,c=0,m=Math.min(a.t,this.t);while(i<m){c+=this[i]+a[i];r[i++]=c&this.DM;c>>=this.DB}if(a.t<this.t){c+=a.s;while(i<this.t){c+=this[i];r[i++]=c&this.DM;c>>=this.DB}c+=this.s}else{c+=this.s;while(i<a.t){c+=a[i];r[i++]=c&this.DM;c>>=this.DB}c+=a.s}r.s=c<0?-1:0;if(c>0)r[i++]=c;else if(c<-1)r[i++]=this.DV+c;r.t=i;r.clamp()}BigInteger.prototype.fromRadix=bnpFromRadix;BigInteger.prototype.chunkSize=bnpChunkSize;BigInteger.prototype.signum=bnSigNum;BigInteger.prototype.dMultiply=bnpDMultiply;BigInteger.prototype.dAddOffset=bnpDAddOffset;BigInteger.prototype.toRadix=bnpToRadix;BigInteger.prototype.intValue=bnIntValue;BigInteger.prototype.addTo=bnpAddTo;var Wrapper={abs:(function(l,h){var x=new goog.math.Long(l,h);var ret;if(x.isNegative()){ret=x.negate()}else{ret=x}HEAP32[tempDoublePtr>>2]=ret.low_;HEAP32[tempDoublePtr+4>>2]=ret.high_}),ensureTemps:(function(){if(Wrapper.ensuredTemps)return;Wrapper.ensuredTemps=true;Wrapper.two32=new BigInteger;Wrapper.two32.fromString("4294967296",10);Wrapper.two64=new BigInteger;Wrapper.two64.fromString("18446744073709551616",10);Wrapper.temp1=new BigInteger;Wrapper.temp2=new BigInteger}),lh2bignum:(function(l,h){var a=new BigInteger;a.fromString(h.toString(),10);var b=new BigInteger;a.multiplyTo(Wrapper.two32,b);var c=new BigInteger;c.fromString(l.toString(),10);var d=new BigInteger;c.addTo(b,d);return d}),stringify:(function(l,h,unsigned){var ret=(new goog.math.Long(l,h)).toString();if(unsigned&&ret[0]=="-"){Wrapper.ensureTemps();var bignum=new BigInteger;bignum.fromString(ret,10);ret=new BigInteger;Wrapper.two64.addTo(bignum,ret);ret=ret.toString(10)}return ret}),fromString:(function(str,base,min,max,unsigned){Wrapper.ensureTemps();var bignum=new BigInteger;bignum.fromString(str,base);var bigmin=new BigInteger;bigmin.fromString(min,10);var bigmax=new BigInteger;bigmax.fromString(max,10);if(unsigned&&bignum.compareTo(BigInteger.ZERO)<0){var temp=new BigInteger;bignum.addTo(Wrapper.two64,temp);bignum=temp}var error=false;if(bignum.compareTo(bigmin)<0){bignum=bigmin;error=true}else if(bignum.compareTo(bigmax)>0){bignum=bigmax;error=true}var ret=goog.math.Long.fromString(bignum.toString());HEAP32[tempDoublePtr>>2]=ret.low_;HEAP32[tempDoublePtr+4>>2]=ret.high_;if(error)throw"range error"})};return Wrapper})();if(memoryInitializer){if(typeof Module["locateFile"]==="function"){memoryInitializer=Module["locateFile"](memoryInitializer)}else if(Module["memoryInitializerPrefixURL"]){memoryInitializer=Module["memoryInitializerPrefixURL"]+memoryInitializer}if(ENVIRONMENT_IS_NODE||ENVIRONMENT_IS_SHELL){var data=Module["readBinary"](memoryInitializer);HEAPU8.set(data,STATIC_BASE)}else{addRunDependency("memory initializer");Browser.asyncLoad(memoryInitializer,(function(data){HEAPU8.set(data,STATIC_BASE);removeRunDependency("memory initializer")}),(function(data){throw"could not load memory initializer "+memoryInitializer}))}}function ExitStatus(status){this.name="ExitStatus";this.message="Program terminated with exit("+status+")";this.status=status}ExitStatus.prototype=new Error;ExitStatus.prototype.constructor=ExitStatus;var initialStackTop;var preloadStartTime=null;var calledMain=false;dependenciesFulfilled=function runCaller(){if(!Module["calledRun"]&&shouldRunNow)run();if(!Module["calledRun"])dependenciesFulfilled=runCaller};Module["callMain"]=Module.callMain=function callMain(args){assert(runDependencies==0,"cannot call main when async dependencies remain! (listen on __ATMAIN__)");assert(__ATPRERUN__.length==0,"cannot call main when preRun functions remain to be called");args=args||[];ensureInitRuntime();var argc=args.length+1;function pad(){for(var i=0;i<4-1;i++){argv.push(0)}}var argv=[allocate(intArrayFromString(Module["thisProgram"]),"i8",ALLOC_NORMAL)];pad();for(var i=0;i<argc-1;i=i+1){argv.push(allocate(intArrayFromString(args[i]),"i8",ALLOC_NORMAL));pad()}argv.push(0);argv=allocate(argv,"i32",ALLOC_NORMAL);initialStackTop=STACKTOP;try{var ret=Module["_main"](argc,argv,0);exit(ret)}catch(e){if(e instanceof ExitStatus){return}else if(e=="SimulateInfiniteLoop"){Module["noExitRuntime"]=true;return}else{if(e&&typeof e==="object"&&e.stack)Module.printErr("exception thrown: "+[e,e.stack]);throw e}}finally{calledMain=true}};function run(args){args=args||Module["arguments"];if(preloadStartTime===null)preloadStartTime=Date.now();if(runDependencies>0){return}preRun();if(runDependencies>0)return;if(Module["calledRun"])return;function doRun(){if(Module["calledRun"])return;Module["calledRun"]=true;if(ABORT)return;ensureInitRuntime();preMain();if(ENVIRONMENT_IS_WEB&&preloadStartTime!==null){Module.printErr("pre-main prep time: "+(Date.now()-preloadStartTime)+" ms")}if(Module["_main"]&&shouldRunNow){Module["callMain"](args)}postRun()}if(Module["setStatus"]){Module["setStatus"]("Running...");setTimeout((function(){setTimeout((function(){Module["setStatus"]("")}),1);doRun()}),1)}else{doRun()}}Module["run"]=Module.run=run;function exit(status){if(Module["noExitRuntime"]){return}ABORT=true;EXITSTATUS=status;STACKTOP=initialStackTop;exitRuntime();if(ENVIRONMENT_IS_NODE){process["stdout"]["once"]("drain",(function(){process["exit"](status)}));console.log(" ");setTimeout((function(){process["exit"](status)}),500)}else if(ENVIRONMENT_IS_SHELL&&typeof quit==="function"){quit(status)}throw new ExitStatus(status)}Module["exit"]=Module.exit=exit;function abort(text){if(text){Module.print(text);Module.printErr(text)}ABORT=true;EXITSTATUS=1;var extra="\nIf this abort() is unexpected, build with -s ASSERTIONS=1 which can give more information.";throw"abort() at "+stackTrace()+extra}Module["abort"]=Module.abort=abort;if(Module["preInit"]){if(typeof Module["preInit"]=="function")Module["preInit"]=[Module["preInit"]];while(Module["preInit"].length>0){Module["preInit"].pop()()}}var shouldRunNow=true;if(Module["noInitialRun"]){shouldRunNow=false}run()





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
    window.textsecure = window.textsecure || {};

    if (navigator.mimeTypes['application/x-nacl'] === undefined &&
        navigator.mimeTypes['application/x-pnacl'] === undefined) {
            // browser does not support native client.
            return;
    }

    var naclMessageNextId = 0;
    var naclMessageIdCallbackMap = {};
    window.handleMessage = function(message) {
        naclMessageIdCallbackMap[message.data.call_id](message.data);
    }

    function postMessage(message) {
        return new Promise(function(resolve) {
            return registerOnLoadFunction(function() {
                naclMessageIdCallbackMap[naclMessageNextId] = resolve;
                message.call_id = naclMessageNextId++;
                common.naclModule.postMessage(message);
            });
        });
    };

    var onLoadCallbacks = [];
    var naclLoaded = false;
    window.moduleDidLoad = function() {
        common.hideModule();
        naclLoaded = true;
        for (var i = 0; i < onLoadCallbacks.length; i++) {
            try {
                onLoadCallbacks[i][1](onLoadCallbacks[i][0]());
            } catch (e) {
                onLoadCallbacks[i][2](e);
            }
        }
        onLoadCallbacks = [];
    };

    function registerOnLoadFunction(func) {
        return new Promise(function(resolve, reject) {
            if (naclLoaded) {
                return resolve(func());
            } else {
                onLoadCallbacks[onLoadCallbacks.length] = [ func, resolve, reject ];
            }
        });
    };

    window.textsecure.nativeclient = {
        keyPair: function(priv) {
            return postMessage({command: "bytesToPriv", priv: priv}).then(function(message) {
                var priv = message.res.slice(0, 32);
                return postMessage({command: "privToPub", priv: priv}).then(function(message) {
                    return { pubKey: message.res.slice(0, 32), privKey: priv };
                });
            });
        },
        sharedSecret: function(pub, priv) {
            return postMessage({command: "ECDHE", pub: pub, priv: priv}).then(function(message) {
                return message.res.slice(0, 32);
            });
        },
        sign: function(priv, msg) {
            return postMessage({command: "Ed25519Sign", priv: priv, msg: msg}).then(function(message) {
                return message.res;
            });
        },
        verify: function(pub, msg, sig) {
            return postMessage({command: "Ed25519Verify", pub: pub, msg: msg, sig: sig}).then(function(message) {
                if (!message.res)
                    throw new Error("Invalid signature");
            });
        }
    };
})();

;(function(){
/**
 * CryptoJS core components.
 */
var CryptoJS = CryptoJS || (function (Math, undefined) {
    /**
     * CryptoJS namespace.
     */
    var C = {};

    /**
     * Library namespace.
     */
    var C_lib = C.lib = {};

    /**
     * Base object for prototypal inheritance.
     */
    var Base = C_lib.Base = (function () {
        function F() {}

        return {
            /**
             * Creates a new object that inherits from this object.
             *
             * @param {Object} overrides Properties to copy into the new object.
             *
             * @return {Object} The new object.
             *
             * @static
             *
             * @example
             *
             *     var MyType = CryptoJS.lib.Base.extend({
             *         field: 'value',
             *
             *         method: function () {
             *         }
             *     });
             */
            extend: function (overrides) {
                // Spawn
                F.prototype = this;
                var subtype = new F();

                // Augment
                if (overrides) {
                    subtype.mixIn(overrides);
                }

                // Create default initializer
                if (!subtype.hasOwnProperty('init')) {
                    subtype.init = function () {
                        subtype.$super.init.apply(this, arguments);
                    };
                }

                // Initializer's prototype is the subtype object
                subtype.init.prototype = subtype;

                // Reference supertype
                subtype.$super = this;

                return subtype;
            },

            /**
             * Extends this object and runs the init method.
             * Arguments to create() will be passed to init().
             *
             * @return {Object} The new object.
             *
             * @static
             *
             * @example
             *
             *     var instance = MyType.create();
             */
            create: function () {
                var instance = this.extend();
                instance.init.apply(instance, arguments);

                return instance;
            },

            /**
             * Initializes a newly created object.
             * Override this method to add some logic when your objects are created.
             *
             * @example
             *
             *     var MyType = CryptoJS.lib.Base.extend({
             *         init: function () {
             *             // ...
             *         }
             *     });
             */
            init: function () {
            },

            /**
             * Copies properties into this object.
             *
             * @param {Object} properties The properties to mix in.
             *
             * @example
             *
             *     MyType.mixIn({
             *         field: 'value'
             *     });
             */
            mixIn: function (properties) {
                for (var propertyName in properties) {
                    if (properties.hasOwnProperty(propertyName)) {
                        this[propertyName] = properties[propertyName];
                    }
                }

                // IE won't copy toString using the loop above
                if (properties.hasOwnProperty('toString')) {
                    this.toString = properties.toString;
                }
            },

            /**
             * Creates a copy of this object.
             *
             * @return {Object} The clone.
             *
             * @example
             *
             *     var clone = instance.clone();
             */
            clone: function () {
                return this.init.prototype.extend(this);
            }
        };
    }());

    /**
     * An array of 32-bit words.
     *
     * @property {Array} words The array of 32-bit words.
     * @property {number} sigBytes The number of significant bytes in this word array.
     */
    var WordArray = C_lib.WordArray = Base.extend({
        /**
         * Initializes a newly created word array.
         *
         * @param {Array} words (Optional) An array of 32-bit words.
         * @param {number} sigBytes (Optional) The number of significant bytes in the words.
         *
         * @example
         *
         *     var wordArray = CryptoJS.lib.WordArray.create();
         *     var wordArray = CryptoJS.lib.WordArray.create([0x00010203, 0x04050607]);
         *     var wordArray = CryptoJS.lib.WordArray.create([0x00010203, 0x04050607], 6);
         */
        init: function (words, sigBytes) {
            words = this.words = words || [];

            if (sigBytes != undefined) {
                this.sigBytes = sigBytes;
            } else {
                this.sigBytes = words.length * 4;
            }
        },

        /**
         * Converts this word array to a string.
         *
         * @param {Encoder} encoder (Optional) The encoding strategy to use. Default: CryptoJS.enc.Hex
         *
         * @return {string} The stringified word array.
         *
         * @example
         *
         *     var string = wordArray + '';
         *     var string = wordArray.toString();
         *     var string = wordArray.toString(CryptoJS.enc.Utf8);
         */
        toString: function (encoder) {
            return (encoder || Hex).stringify(this);
        },

        /**
         * Concatenates a word array to this word array.
         *
         * @param {WordArray} wordArray The word array to append.
         *
         * @return {WordArray} This word array.
         *
         * @example
         *
         *     wordArray1.concat(wordArray2);
         */
        concat: function (wordArray) {
            // Shortcuts
            var thisWords = this.words;
            var thatWords = wordArray.words;
            var thisSigBytes = this.sigBytes;
            var thatSigBytes = wordArray.sigBytes;

            // Clamp excess bits
            this.clamp();

            // Concat
            if (thisSigBytes % 4) {
                // Copy one byte at a time
                for (var i = 0; i < thatSigBytes; i++) {
                    var thatByte = (thatWords[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
                    thisWords[(thisSigBytes + i) >>> 2] |= thatByte << (24 - ((thisSigBytes + i) % 4) * 8);
                }
            } else if (thatWords.length > 0xffff) {
                // Copy one word at a time
                for (var i = 0; i < thatSigBytes; i += 4) {
                    thisWords[(thisSigBytes + i) >>> 2] = thatWords[i >>> 2];
                }
            } else {
                // Copy all words at once
                thisWords.push.apply(thisWords, thatWords);
            }
            this.sigBytes += thatSigBytes;

            // Chainable
            return this;
        },

        /**
         * Removes insignificant bits.
         *
         * @example
         *
         *     wordArray.clamp();
         */
        clamp: function () {
            // Shortcuts
            var words = this.words;
            var sigBytes = this.sigBytes;

            // Clamp
            words[sigBytes >>> 2] &= 0xffffffff << (32 - (sigBytes % 4) * 8);
            words.length = Math.ceil(sigBytes / 4);
        },

        /**
         * Creates a copy of this word array.
         *
         * @return {WordArray} The clone.
         *
         * @example
         *
         *     var clone = wordArray.clone();
         */
        clone: function () {
            var clone = Base.clone.call(this);
            clone.words = this.words.slice(0);

            return clone;
        },

        /**
         * Creates a word array filled with random bytes.
         *
         * @param {number} nBytes The number of random bytes to generate.
         *
         * @return {WordArray} The random word array.
         *
         * @static
         *
         * @example
         *
         *     var wordArray = CryptoJS.lib.WordArray.random(16);
         */
        random: function (nBytes) {
            var words = [];
            for (var i = 0; i < nBytes; i += 4) {
                words.push((Math.random() * 0x100000000) | 0);
            }

            return new WordArray.init(words, nBytes);
        }
    });

    /**
     * Encoder namespace.
     */
    var C_enc = C.enc = {};

    /**
     * Hex encoding strategy.
     */
    var Hex = C_enc.Hex = {
        /**
         * Converts a word array to a hex string.
         *
         * @param {WordArray} wordArray The word array.
         *
         * @return {string} The hex string.
         *
         * @static
         *
         * @example
         *
         *     var hexString = CryptoJS.enc.Hex.stringify(wordArray);
         */
        stringify: function (wordArray) {
            // Shortcuts
            var words = wordArray.words;
            var sigBytes = wordArray.sigBytes;

            // Convert
            var hexChars = [];
            for (var i = 0; i < sigBytes; i++) {
                var bite = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
                hexChars.push((bite >>> 4).toString(16));
                hexChars.push((bite & 0x0f).toString(16));
            }

            return hexChars.join('');
        },

        /**
         * Converts a hex string to a word array.
         *
         * @param {string} hexStr The hex string.
         *
         * @return {WordArray} The word array.
         *
         * @static
         *
         * @example
         *
         *     var wordArray = CryptoJS.enc.Hex.parse(hexString);
         */
        parse: function (hexStr) {
            // Shortcut
            var hexStrLength = hexStr.length;

            // Convert
            var words = [];
            for (var i = 0; i < hexStrLength; i += 2) {
                words[i >>> 3] |= parseInt(hexStr.substr(i, 2), 16) << (24 - (i % 8) * 4);
            }

            return new WordArray.init(words, hexStrLength / 2);
        }
    };

    /**
     * Latin1 encoding strategy.
     */
    var Latin1 = C_enc.Latin1 = {
        /**
         * Converts a word array to a Latin1 string.
         *
         * @param {WordArray} wordArray The word array.
         *
         * @return {string} The Latin1 string.
         *
         * @static
         *
         * @example
         *
         *     var latin1String = CryptoJS.enc.Latin1.stringify(wordArray);
         */
        stringify: function (wordArray) {
            // Shortcuts
            var words = wordArray.words;
            var sigBytes = wordArray.sigBytes;

            // Convert
            var latin1Chars = [];
            for (var i = 0; i < sigBytes; i++) {
                var bite = (words[i >>> 2] >>> (24 - (i % 4) * 8)) & 0xff;
                latin1Chars.push(String.fromCharCode(bite));
            }

            return latin1Chars.join('');
        },

        /**
         * Converts a Latin1 string to a word array.
         *
         * @param {string} latin1Str The Latin1 string.
         *
         * @return {WordArray} The word array.
         *
         * @static
         *
         * @example
         *
         *     var wordArray = CryptoJS.enc.Latin1.parse(latin1String);
         */
        parse: function (latin1Str) {
            // Shortcut
            var latin1StrLength = latin1Str.length;

            // Convert
            var words = [];
            for (var i = 0; i < latin1StrLength; i++) {
                words[i >>> 2] |= (latin1Str.charCodeAt(i) & 0xff) << (24 - (i % 4) * 8);
            }

            return new WordArray.init(words, latin1StrLength);
        }
    };

    /**
     * UTF-8 encoding strategy.
     */
    var Utf8 = C_enc.Utf8 = {
        /**
         * Converts a word array to a UTF-8 string.
         *
         * @param {WordArray} wordArray The word array.
         *
         * @return {string} The UTF-8 string.
         *
         * @static
         *
         * @example
         *
         *     var utf8String = CryptoJS.enc.Utf8.stringify(wordArray);
         */
        stringify: function (wordArray) {
            try {
                return decodeURIComponent(escape(Latin1.stringify(wordArray)));
            } catch (e) {
                throw new Error('Malformed UTF-8 data');
            }
        },

        /**
         * Converts a UTF-8 string to a word array.
         *
         * @param {string} utf8Str The UTF-8 string.
         *
         * @return {WordArray} The word array.
         *
         * @static
         *
         * @example
         *
         *     var wordArray = CryptoJS.enc.Utf8.parse(utf8String);
         */
        parse: function (utf8Str) {
            return Latin1.parse(unescape(encodeURIComponent(utf8Str)));
        }
    };

    /**
     * Abstract buffered block algorithm template.
     *
     * The property blockSize must be implemented in a concrete subtype.
     *
     * @property {number} _minBufferSize The number of blocks that should be kept unprocessed in the buffer. Default: 0
     */
    var BufferedBlockAlgorithm = C_lib.BufferedBlockAlgorithm = Base.extend({
        /**
         * Resets this block algorithm's data buffer to its initial state.
         *
         * @example
         *
         *     bufferedBlockAlgorithm.reset();
         */
        reset: function () {
            // Initial values
            this._data = new WordArray.init();
            this._nDataBytes = 0;
        },

        /**
         * Adds new data to this block algorithm's buffer.
         *
         * @param {WordArray|string} data The data to append. Strings are converted to a WordArray using UTF-8.
         *
         * @example
         *
         *     bufferedBlockAlgorithm._append('data');
         *     bufferedBlockAlgorithm._append(wordArray);
         */
        _append: function (data) {
            // Convert string to WordArray, else assume WordArray already
            if (typeof data == 'string') {
                data = Utf8.parse(data);
            }

            // Append
            this._data.concat(data);
            this._nDataBytes += data.sigBytes;
        },

        /**
         * Processes available data blocks.
         *
         * This method invokes _doProcessBlock(offset), which must be implemented by a concrete subtype.
         *
         * @param {boolean} doFlush Whether all blocks and partial blocks should be processed.
         *
         * @return {WordArray} The processed data.
         *
         * @example
         *
         *     var processedData = bufferedBlockAlgorithm._process();
         *     var processedData = bufferedBlockAlgorithm._process(!!'flush');
         */
        _process: function (doFlush) {
            // Shortcuts
            var data = this._data;
            var dataWords = data.words;
            var dataSigBytes = data.sigBytes;
            var blockSize = this.blockSize;
            var blockSizeBytes = blockSize * 4;

            // Count blocks ready
            var nBlocksReady = dataSigBytes / blockSizeBytes;
            if (doFlush) {
                // Round up to include partial blocks
                nBlocksReady = Math.ceil(nBlocksReady);
            } else {
                // Round down to include only full blocks,
                // less the number of blocks that must remain in the buffer
                nBlocksReady = Math.max((nBlocksReady | 0) - this._minBufferSize, 0);
            }

            // Count words ready
            var nWordsReady = nBlocksReady * blockSize;

            // Count bytes ready
            var nBytesReady = Math.min(nWordsReady * 4, dataSigBytes);

            // Process blocks
            if (nWordsReady) {
                for (var offset = 0; offset < nWordsReady; offset += blockSize) {
                    // Perform concrete-algorithm logic
                    this._doProcessBlock(dataWords, offset);
                }

                // Remove processed words
                var processedWords = dataWords.splice(0, nWordsReady);
                data.sigBytes -= nBytesReady;
            }

            // Return processed words
            return new WordArray.init(processedWords, nBytesReady);
        },

        /**
         * Creates a copy of this object.
         *
         * @return {Object} The clone.
         *
         * @example
         *
         *     var clone = bufferedBlockAlgorithm.clone();
         */
        clone: function () {
            var clone = Base.clone.call(this);
            clone._data = this._data.clone();

            return clone;
        },

        _minBufferSize: 0
    });

    /**
     * Abstract hasher template.
     *
     * @property {number} blockSize The number of 32-bit words this hasher operates on. Default: 16 (512 bits)
     */
    var Hasher = C_lib.Hasher = BufferedBlockAlgorithm.extend({
        /**
         * Configuration options.
         */
        cfg: Base.extend(),

        /**
         * Initializes a newly created hasher.
         *
         * @param {Object} cfg (Optional) The configuration options to use for this hash computation.
         *
         * @example
         *
         *     var hasher = CryptoJS.algo.SHA256.create();
         */
        init: function (cfg) {
            // Apply config defaults
            this.cfg = this.cfg.extend(cfg);

            // Set initial values
            this.reset();
        },

        /**
         * Resets this hasher to its initial state.
         *
         * @example
         *
         *     hasher.reset();
         */
        reset: function () {
            // Reset data buffer
            BufferedBlockAlgorithm.reset.call(this);

            // Perform concrete-hasher logic
            this._doReset();
        },

        /**
         * Updates this hasher with a message.
         *
         * @param {WordArray|string} messageUpdate The message to append.
         *
         * @return {Hasher} This hasher.
         *
         * @example
         *
         *     hasher.update('message');
         *     hasher.update(wordArray);
         */
        update: function (messageUpdate) {
            // Append
            this._append(messageUpdate);

            // Update the hash
            this._process();

            // Chainable
            return this;
        },

        /**
         * Finalizes the hash computation.
         * Note that the finalize operation is effectively a destructive, read-once operation.
         *
         * @param {WordArray|string} messageUpdate (Optional) A final message update.
         *
         * @return {WordArray} The hash.
         *
         * @example
         *
         *     var hash = hasher.finalize();
         *     var hash = hasher.finalize('message');
         *     var hash = hasher.finalize(wordArray);
         */
        finalize: function (messageUpdate) {
            // Final message update
            if (messageUpdate) {
                this._append(messageUpdate);
            }

            // Perform concrete-hasher logic
            var hash = this._doFinalize();

            return hash;
        },

        blockSize: 512/32,

        /**
         * Creates a shortcut function to a hasher's object interface.
         *
         * @param {Hasher} hasher The hasher to create a helper for.
         *
         * @return {Function} The shortcut function.
         *
         * @static
         *
         * @example
         *
         *     var SHA256 = CryptoJS.lib.Hasher._createHelper(CryptoJS.algo.SHA256);
         */
        _createHelper: function (hasher) {
            return function (message, cfg) {
                return new hasher.init(cfg).finalize(message);
            };
        },

        /**
         * Creates a shortcut function to the HMAC's object interface.
         *
         * @param {Hasher} hasher The hasher to use in this HMAC helper.
         *
         * @return {Function} The shortcut function.
         *
         * @static
         *
         * @example
         *
         *     var HmacSHA256 = CryptoJS.lib.Hasher._createHmacHelper(CryptoJS.algo.SHA256);
         */
        _createHmacHelper: function (hasher) {
            return function (message, key) {
                return new C_algo.HMAC.init(hasher, key).finalize(message);
            };
        }
    });

    /**
     * Algorithm namespace.
     */
    var C_algo = C.algo = {};

    return C;
}(Math));

(function (Math) {
    // Shortcuts
    var C = CryptoJS;
    var C_lib = C.lib;
    var WordArray = C_lib.WordArray;
    var Hasher = C_lib.Hasher;
    var C_algo = C.algo;

    // Initialization and round constants tables
    var H = [];
    var K = [];

    // Compute constants
    (function () {
        function isPrime(n) {
            var sqrtN = Math.sqrt(n);
            for (var factor = 2; factor <= sqrtN; factor++) {
                if (!(n % factor)) {
                    return false;
                }
            }

            return true;
        }

        function getFractionalBits(n) {
            return ((n - (n | 0)) * 0x100000000) | 0;
        }

        var n = 2;
        var nPrime = 0;
        while (nPrime < 64) {
            if (isPrime(n)) {
                if (nPrime < 8) {
                    H[nPrime] = getFractionalBits(Math.pow(n, 1 / 2));
                }
                K[nPrime] = getFractionalBits(Math.pow(n, 1 / 3));

                nPrime++;
            }

            n++;
        }
    }());

    // Reusable object
    var W = [];

    /**
     * SHA-256 hash algorithm.
     */
    var SHA256 = C_algo.SHA256 = Hasher.extend({
        _doReset: function () {
            this._hash = new WordArray.init(H.slice(0));
        },

        _doProcessBlock: function (M, offset) {
            // Shortcut
            var H = this._hash.words;

            // Working variables
            var a = H[0];
            var b = H[1];
            var c = H[2];
            var d = H[3];
            var e = H[4];
            var f = H[5];
            var g = H[6];
            var h = H[7];

            // Computation
            for (var i = 0; i < 64; i++) {
                if (i < 16) {
                    W[i] = M[offset + i] | 0;
                } else {
                    var gamma0x = W[i - 15];
                    var gamma0  = ((gamma0x << 25) | (gamma0x >>> 7))  ^
                                  ((gamma0x << 14) | (gamma0x >>> 18)) ^
                                   (gamma0x >>> 3);

                    var gamma1x = W[i - 2];
                    var gamma1  = ((gamma1x << 15) | (gamma1x >>> 17)) ^
                                  ((gamma1x << 13) | (gamma1x >>> 19)) ^
                                   (gamma1x >>> 10);

                    W[i] = gamma0 + W[i - 7] + gamma1 + W[i - 16];
                }

                var ch  = (e & f) ^ (~e & g);
                var maj = (a & b) ^ (a & c) ^ (b & c);

                var sigma0 = ((a << 30) | (a >>> 2)) ^ ((a << 19) | (a >>> 13)) ^ ((a << 10) | (a >>> 22));
                var sigma1 = ((e << 26) | (e >>> 6)) ^ ((e << 21) | (e >>> 11)) ^ ((e << 7)  | (e >>> 25));

                var t1 = h + sigma1 + ch + K[i] + W[i];
                var t2 = sigma0 + maj;

                h = g;
                g = f;
                f = e;
                e = (d + t1) | 0;
                d = c;
                c = b;
                b = a;
                a = (t1 + t2) | 0;
            }

            // Intermediate hash value
            H[0] = (H[0] + a) | 0;
            H[1] = (H[1] + b) | 0;
            H[2] = (H[2] + c) | 0;
            H[3] = (H[3] + d) | 0;
            H[4] = (H[4] + e) | 0;
            H[5] = (H[5] + f) | 0;
            H[6] = (H[6] + g) | 0;
            H[7] = (H[7] + h) | 0;
        },

        _doFinalize: function () {
            // Shortcuts
            var data = this._data;
            var dataWords = data.words;

            var nBitsTotal = this._nDataBytes * 8;
            var nBitsLeft = data.sigBytes * 8;

            // Add padding
            dataWords[nBitsLeft >>> 5] |= 0x80 << (24 - nBitsLeft % 32);
            dataWords[(((nBitsLeft + 64) >>> 9) << 4) + 14] = Math.floor(nBitsTotal / 0x100000000);
            dataWords[(((nBitsLeft + 64) >>> 9) << 4) + 15] = nBitsTotal;
            data.sigBytes = dataWords.length * 4;

            // Hash final blocks
            this._process();

            // Return final computed hash
            return this._hash;
        },

        clone: function () {
            var clone = Hasher.clone.call(this);
            clone._hash = this._hash.clone();

            return clone;
        }
    });

    /**
     * Shortcut function to the hasher's object interface.
     *
     * @param {WordArray|string} message The message to hash.
     *
     * @return {WordArray} The hash.
     *
     * @static
     *
     * @example
     *
     *     var hash = CryptoJS.SHA256('message');
     *     var hash = CryptoJS.SHA256(wordArray);
     */
    C.SHA256 = Hasher._createHelper(SHA256);

    /**
     * Shortcut function to the HMAC's object interface.
     *
     * @param {WordArray|string} message The message to hash.
     * @param {WordArray|string} key The secret key.
     *
     * @return {WordArray} The HMAC.
     *
     * @static
     *
     * @example
     *
     *     var hmac = CryptoJS.HmacSHA256(message, key);
     */
    C.HmacSHA256 = Hasher._createHmacHelper(SHA256);
}(Math));

(function () {
    // Shortcuts
    var C = CryptoJS;
    var C_lib = C.lib;
    var Base = C_lib.Base;
    var C_enc = C.enc;
    var Utf8 = C_enc.Utf8;
    var C_algo = C.algo;

    /**
     * HMAC algorithm.
     */
    var HMAC = C_algo.HMAC = Base.extend({
        /**
         * Initializes a newly created HMAC.
         *
         * @param {Hasher} hasher The hash algorithm to use.
         * @param {WordArray|string} key The secret key.
         *
         * @example
         *
         *     var hmacHasher = CryptoJS.algo.HMAC.create(CryptoJS.algo.SHA256, key);
         */
        init: function (hasher, key) {
            // Init hasher
            hasher = this._hasher = new hasher.init();

            // Convert string to WordArray, else assume WordArray already
            if (typeof key == 'string') {
                key = Utf8.parse(key);
            }

            // Shortcuts
            var hasherBlockSize = hasher.blockSize;
            var hasherBlockSizeBytes = hasherBlockSize * 4;

            // Allow arbitrary length keys
            if (key.sigBytes > hasherBlockSizeBytes) {
                key = hasher.finalize(key);
            }

            // Clamp excess bits
            key.clamp();

            // Clone key for inner and outer pads
            var oKey = this._oKey = key.clone();
            var iKey = this._iKey = key.clone();

            // Shortcuts
            var oKeyWords = oKey.words;
            var iKeyWords = iKey.words;

            // XOR keys with pad constants
            for (var i = 0; i < hasherBlockSize; i++) {
                oKeyWords[i] ^= 0x5c5c5c5c;
                iKeyWords[i] ^= 0x36363636;
            }
            oKey.sigBytes = iKey.sigBytes = hasherBlockSizeBytes;

            // Set initial values
            this.reset();
        },

        /**
         * Resets this HMAC to its initial state.
         *
         * @example
         *
         *     hmacHasher.reset();
         */
        reset: function () {
            // Shortcut
            var hasher = this._hasher;

            // Reset
            hasher.reset();
            hasher.update(this._iKey);
        },

        /**
         * Updates this HMAC with a message.
         *
         * @param {WordArray|string} messageUpdate The message to append.
         *
         * @return {HMAC} This HMAC instance.
         *
         * @example
         *
         *     hmacHasher.update('message');
         *     hmacHasher.update(wordArray);
         */
        update: function (messageUpdate) {
            this._hasher.update(messageUpdate);

            // Chainable
            return this;
        },

        /**
         * Finalizes the HMAC computation.
         * Note that the finalize operation is effectively a destructive, read-once operation.
         *
         * @param {WordArray|string} messageUpdate (Optional) A final message update.
         *
         * @return {WordArray} The HMAC.
         *
         * @example
         *
         *     var hmac = hmacHasher.finalize();
         *     var hmac = hmacHasher.finalize('message');
         *     var hmac = hmacHasher.finalize(wordArray);
         */
        finalize: function (messageUpdate) {
            // Shortcut
            var hasher = this._hasher;

            // Compute HMAC
            var innerHash = hasher.finalize(messageUpdate);
            hasher.reset();
            var hmac = hasher.finalize(this._oKey.clone().concat(innerHash));

            return hmac;
        }
    });
}());

(function () {
    // Shortcuts
    var C = CryptoJS;
    var C_lib = C.lib;
    var WordArray = C_lib.WordArray;
    var C_enc = C.enc;

    /**
     * Base64 encoding strategy.
     */
    var Base64 = C_enc.Base64 = {
        /**
         * Converts a word array to a Base64 string.
         *
         * @param {WordArray} wordArray The word array.
         *
         * @return {string} The Base64 string.
         *
         * @static
         *
         * @example
         *
         *     var base64String = CryptoJS.enc.Base64.stringify(wordArray);
         */
        stringify: function (wordArray) {
            // Shortcuts
            var words = wordArray.words;
            var sigBytes = wordArray.sigBytes;
            var map = this._map;

            // Clamp excess bits
            wordArray.clamp();

            // Convert
            var base64Chars = [];
            for (var i = 0; i < sigBytes; i += 3) {
                var byte1 = (words[i >>> 2]       >>> (24 - (i % 4) * 8))       & 0xff;
                var byte2 = (words[(i + 1) >>> 2] >>> (24 - ((i + 1) % 4) * 8)) & 0xff;
                var byte3 = (words[(i + 2) >>> 2] >>> (24 - ((i + 2) % 4) * 8)) & 0xff;

                var triplet = (byte1 << 16) | (byte2 << 8) | byte3;

                for (var j = 0; (j < 4) && (i + j * 0.75 < sigBytes); j++) {
                    base64Chars.push(map.charAt((triplet >>> (6 * (3 - j))) & 0x3f));
                }
            }

            // Add padding
            var paddingChar = map.charAt(64);
            if (paddingChar) {
                while (base64Chars.length % 4) {
                    base64Chars.push(paddingChar);
                }
            }

            return base64Chars.join('');
        },

        /**
         * Converts a Base64 string to a word array.
         *
         * @param {string} base64Str The Base64 string.
         *
         * @return {WordArray} The word array.
         *
         * @static
         *
         * @example
         *
         *     var wordArray = CryptoJS.enc.Base64.parse(base64String);
         */
        parse: function (base64Str) {
            // Shortcuts
            var base64StrLength = base64Str.length;
            var map = this._map;

            // Ignore padding
            var paddingChar = map.charAt(64);
            if (paddingChar) {
                var paddingIndex = base64Str.indexOf(paddingChar);
                if (paddingIndex != -1) {
                    base64StrLength = paddingIndex;
                }
            }

            // Convert
            var words = [];
            var nBytes = 0;
            for (var i = 0; i < base64StrLength; i++) {
                if (i % 4) {
                    var bits1 = map.indexOf(base64Str.charAt(i - 1)) << ((i % 4) * 2);
                    var bits2 = map.indexOf(base64Str.charAt(i)) >>> (6 - (i % 4) * 2);
                    words[nBytes >>> 2] |= (bits1 | bits2) << (24 - (nBytes % 4) * 8);
                    nBytes++;
                }
            }

            return WordArray.create(words, nBytes);
        },

        _map: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/='
    };
}());

(function (Math) {
    // Shortcuts
    var C = CryptoJS;
    var C_lib = C.lib;
    var WordArray = C_lib.WordArray;
    var Hasher = C_lib.Hasher;
    var C_algo = C.algo;

    // Constants table
    var T = [];

    // Compute constants
    (function () {
        for (var i = 0; i < 64; i++) {
            T[i] = (Math.abs(Math.sin(i + 1)) * 0x100000000) | 0;
        }
    }());

    /**
     * MD5 hash algorithm.
     */
    var MD5 = C_algo.MD5 = Hasher.extend({
        _doReset: function () {
            this._hash = new WordArray.init([
                0x67452301, 0xefcdab89,
                0x98badcfe, 0x10325476
            ]);
        },

        _doProcessBlock: function (M, offset) {
            // Swap endian
            for (var i = 0; i < 16; i++) {
                // Shortcuts
                var offset_i = offset + i;
                var M_offset_i = M[offset_i];

                M[offset_i] = (
                    (((M_offset_i << 8)  | (M_offset_i >>> 24)) & 0x00ff00ff) |
                    (((M_offset_i << 24) | (M_offset_i >>> 8))  & 0xff00ff00)
                );
            }

            // Shortcuts
            var H = this._hash.words;

            var M_offset_0  = M[offset + 0];
            var M_offset_1  = M[offset + 1];
            var M_offset_2  = M[offset + 2];
            var M_offset_3  = M[offset + 3];
            var M_offset_4  = M[offset + 4];
            var M_offset_5  = M[offset + 5];
            var M_offset_6  = M[offset + 6];
            var M_offset_7  = M[offset + 7];
            var M_offset_8  = M[offset + 8];
            var M_offset_9  = M[offset + 9];
            var M_offset_10 = M[offset + 10];
            var M_offset_11 = M[offset + 11];
            var M_offset_12 = M[offset + 12];
            var M_offset_13 = M[offset + 13];
            var M_offset_14 = M[offset + 14];
            var M_offset_15 = M[offset + 15];

            // Working varialbes
            var a = H[0];
            var b = H[1];
            var c = H[2];
            var d = H[3];

            // Computation
            a = FF(a, b, c, d, M_offset_0,  7,  T[0]);
            d = FF(d, a, b, c, M_offset_1,  12, T[1]);
            c = FF(c, d, a, b, M_offset_2,  17, T[2]);
            b = FF(b, c, d, a, M_offset_3,  22, T[3]);
            a = FF(a, b, c, d, M_offset_4,  7,  T[4]);
            d = FF(d, a, b, c, M_offset_5,  12, T[5]);
            c = FF(c, d, a, b, M_offset_6,  17, T[6]);
            b = FF(b, c, d, a, M_offset_7,  22, T[7]);
            a = FF(a, b, c, d, M_offset_8,  7,  T[8]);
            d = FF(d, a, b, c, M_offset_9,  12, T[9]);
            c = FF(c, d, a, b, M_offset_10, 17, T[10]);
            b = FF(b, c, d, a, M_offset_11, 22, T[11]);
            a = FF(a, b, c, d, M_offset_12, 7,  T[12]);
            d = FF(d, a, b, c, M_offset_13, 12, T[13]);
            c = FF(c, d, a, b, M_offset_14, 17, T[14]);
            b = FF(b, c, d, a, M_offset_15, 22, T[15]);

            a = GG(a, b, c, d, M_offset_1,  5,  T[16]);
            d = GG(d, a, b, c, M_offset_6,  9,  T[17]);
            c = GG(c, d, a, b, M_offset_11, 14, T[18]);
            b = GG(b, c, d, a, M_offset_0,  20, T[19]);
            a = GG(a, b, c, d, M_offset_5,  5,  T[20]);
            d = GG(d, a, b, c, M_offset_10, 9,  T[21]);
            c = GG(c, d, a, b, M_offset_15, 14, T[22]);
            b = GG(b, c, d, a, M_offset_4,  20, T[23]);
            a = GG(a, b, c, d, M_offset_9,  5,  T[24]);
            d = GG(d, a, b, c, M_offset_14, 9,  T[25]);
            c = GG(c, d, a, b, M_offset_3,  14, T[26]);
            b = GG(b, c, d, a, M_offset_8,  20, T[27]);
            a = GG(a, b, c, d, M_offset_13, 5,  T[28]);
            d = GG(d, a, b, c, M_offset_2,  9,  T[29]);
            c = GG(c, d, a, b, M_offset_7,  14, T[30]);
            b = GG(b, c, d, a, M_offset_12, 20, T[31]);

            a = HH(a, b, c, d, M_offset_5,  4,  T[32]);
            d = HH(d, a, b, c, M_offset_8,  11, T[33]);
            c = HH(c, d, a, b, M_offset_11, 16, T[34]);
            b = HH(b, c, d, a, M_offset_14, 23, T[35]);
            a = HH(a, b, c, d, M_offset_1,  4,  T[36]);
            d = HH(d, a, b, c, M_offset_4,  11, T[37]);
            c = HH(c, d, a, b, M_offset_7,  16, T[38]);
            b = HH(b, c, d, a, M_offset_10, 23, T[39]);
            a = HH(a, b, c, d, M_offset_13, 4,  T[40]);
            d = HH(d, a, b, c, M_offset_0,  11, T[41]);
            c = HH(c, d, a, b, M_offset_3,  16, T[42]);
            b = HH(b, c, d, a, M_offset_6,  23, T[43]);
            a = HH(a, b, c, d, M_offset_9,  4,  T[44]);
            d = HH(d, a, b, c, M_offset_12, 11, T[45]);
            c = HH(c, d, a, b, M_offset_15, 16, T[46]);
            b = HH(b, c, d, a, M_offset_2,  23, T[47]);

            a = II(a, b, c, d, M_offset_0,  6,  T[48]);
            d = II(d, a, b, c, M_offset_7,  10, T[49]);
            c = II(c, d, a, b, M_offset_14, 15, T[50]);
            b = II(b, c, d, a, M_offset_5,  21, T[51]);
            a = II(a, b, c, d, M_offset_12, 6,  T[52]);
            d = II(d, a, b, c, M_offset_3,  10, T[53]);
            c = II(c, d, a, b, M_offset_10, 15, T[54]);
            b = II(b, c, d, a, M_offset_1,  21, T[55]);
            a = II(a, b, c, d, M_offset_8,  6,  T[56]);
            d = II(d, a, b, c, M_offset_15, 10, T[57]);
            c = II(c, d, a, b, M_offset_6,  15, T[58]);
            b = II(b, c, d, a, M_offset_13, 21, T[59]);
            a = II(a, b, c, d, M_offset_4,  6,  T[60]);
            d = II(d, a, b, c, M_offset_11, 10, T[61]);
            c = II(c, d, a, b, M_offset_2,  15, T[62]);
            b = II(b, c, d, a, M_offset_9,  21, T[63]);

            // Intermediate hash value
            H[0] = (H[0] + a) | 0;
            H[1] = (H[1] + b) | 0;
            H[2] = (H[2] + c) | 0;
            H[3] = (H[3] + d) | 0;
        },

        _doFinalize: function () {
            // Shortcuts
            var data = this._data;
            var dataWords = data.words;

            var nBitsTotal = this._nDataBytes * 8;
            var nBitsLeft = data.sigBytes * 8;

            // Add padding
            dataWords[nBitsLeft >>> 5] |= 0x80 << (24 - nBitsLeft % 32);

            var nBitsTotalH = Math.floor(nBitsTotal / 0x100000000);
            var nBitsTotalL = nBitsTotal;
            dataWords[(((nBitsLeft + 64) >>> 9) << 4) + 15] = (
                (((nBitsTotalH << 8)  | (nBitsTotalH >>> 24)) & 0x00ff00ff) |
                (((nBitsTotalH << 24) | (nBitsTotalH >>> 8))  & 0xff00ff00)
            );
            dataWords[(((nBitsLeft + 64) >>> 9) << 4) + 14] = (
                (((nBitsTotalL << 8)  | (nBitsTotalL >>> 24)) & 0x00ff00ff) |
                (((nBitsTotalL << 24) | (nBitsTotalL >>> 8))  & 0xff00ff00)
            );

            data.sigBytes = (dataWords.length + 1) * 4;

            // Hash final blocks
            this._process();

            // Shortcuts
            var hash = this._hash;
            var H = hash.words;

            // Swap endian
            for (var i = 0; i < 4; i++) {
                // Shortcut
                var H_i = H[i];

                H[i] = (((H_i << 8)  | (H_i >>> 24)) & 0x00ff00ff) |
                       (((H_i << 24) | (H_i >>> 8))  & 0xff00ff00);
            }

            // Return final computed hash
            return hash;
        },

        clone: function () {
            var clone = Hasher.clone.call(this);
            clone._hash = this._hash.clone();

            return clone;
        }
    });

    function FF(a, b, c, d, x, s, t) {
        var n = a + ((b & c) | (~b & d)) + x + t;
        return ((n << s) | (n >>> (32 - s))) + b;
    }

    function GG(a, b, c, d, x, s, t) {
        var n = a + ((b & d) | (c & ~d)) + x + t;
        return ((n << s) | (n >>> (32 - s))) + b;
    }

    function HH(a, b, c, d, x, s, t) {
        var n = a + (b ^ c ^ d) + x + t;
        return ((n << s) | (n >>> (32 - s))) + b;
    }

    function II(a, b, c, d, x, s, t) {
        var n = a + (c ^ (b | ~d)) + x + t;
        return ((n << s) | (n >>> (32 - s))) + b;
    }

    /**
     * Shortcut function to the hasher's object interface.
     *
     * @param {WordArray|string} message The message to hash.
     *
     * @return {WordArray} The hash.
     *
     * @static
     *
     * @example
     *
     *     var hash = CryptoJS.MD5('message');
     *     var hash = CryptoJS.MD5(wordArray);
     */
    C.MD5 = Hasher._createHelper(MD5);

    /**
     * Shortcut function to the HMAC's object interface.
     *
     * @param {WordArray|string} message The message to hash.
     * @param {WordArray|string} key The secret key.
     *
     * @return {WordArray} The HMAC.
     *
     * @static
     *
     * @example
     *
     *     var hmac = CryptoJS.HmacMD5(message, key);
     */
    C.HmacMD5 = Hasher._createHmacHelper(MD5);
}(Math));

(function () {
    // Shortcuts
    var C = CryptoJS;
    var C_lib = C.lib;
    var Base = C_lib.Base;
    var WordArray = C_lib.WordArray;
    var C_algo = C.algo;
    var MD5 = C_algo.MD5;

    /**
     * This key derivation function is meant to conform with EVP_BytesToKey.
     * www.openssl.org/docs/crypto/EVP_BytesToKey.html
     */
    var EvpKDF = C_algo.EvpKDF = Base.extend({
        /**
         * Configuration options.
         *
         * @property {number} keySize The key size in words to generate. Default: 4 (128 bits)
         * @property {Hasher} hasher The hash algorithm to use. Default: MD5
         * @property {number} iterations The number of iterations to perform. Default: 1
         */
        cfg: Base.extend({
            keySize: 128/32,
            hasher: MD5,
            iterations: 1
        }),

        /**
         * Initializes a newly created key derivation function.
         *
         * @param {Object} cfg (Optional) The configuration options to use for the derivation.
         *
         * @example
         *
         *     var kdf = CryptoJS.algo.EvpKDF.create();
         *     var kdf = CryptoJS.algo.EvpKDF.create({ keySize: 8 });
         *     var kdf = CryptoJS.algo.EvpKDF.create({ keySize: 8, iterations: 1000 });
         */
        init: function (cfg) {
            this.cfg = this.cfg.extend(cfg);
        },

        /**
         * Derives a key from a password.
         *
         * @param {WordArray|string} password The password.
         * @param {WordArray|string} salt A salt.
         *
         * @return {WordArray} The derived key.
         *
         * @example
         *
         *     var key = kdf.compute(password, salt);
         */
        compute: function (password, salt) {
            // Shortcut
            var cfg = this.cfg;

            // Init hasher
            var hasher = cfg.hasher.create();

            // Initial values
            var derivedKey = WordArray.create();

            // Shortcuts
            var derivedKeyWords = derivedKey.words;
            var keySize = cfg.keySize;
            var iterations = cfg.iterations;

            // Generate key
            while (derivedKeyWords.length < keySize) {
                if (block) {
                    hasher.update(block);
                }
                var block = hasher.update(password).finalize(salt);
                hasher.reset();

                // Iterations
                for (var i = 1; i < iterations; i++) {
                    block = hasher.finalize(block);
                    hasher.reset();
                }

                derivedKey.concat(block);
            }
            derivedKey.sigBytes = keySize * 4;

            return derivedKey;
        }
    });

    /**
     * Derives a key from a password.
     *
     * @param {WordArray|string} password The password.
     * @param {WordArray|string} salt A salt.
     * @param {Object} cfg (Optional) The configuration options to use for this computation.
     *
     * @return {WordArray} The derived key.
     *
     * @static
     *
     * @example
     *
     *     var key = CryptoJS.EvpKDF(password, salt);
     *     var key = CryptoJS.EvpKDF(password, salt, { keySize: 8 });
     *     var key = CryptoJS.EvpKDF(password, salt, { keySize: 8, iterations: 1000 });
     */
    C.EvpKDF = function (password, salt, cfg) {
        return EvpKDF.create(cfg).compute(password, salt);
    };
}());

/**
 * Cipher core components.
 */
CryptoJS.lib.Cipher || (function (undefined) {
    // Shortcuts
    var C = CryptoJS;
    var C_lib = C.lib;
    var Base = C_lib.Base;
    var WordArray = C_lib.WordArray;
    var BufferedBlockAlgorithm = C_lib.BufferedBlockAlgorithm;
    var C_enc = C.enc;
    var Utf8 = C_enc.Utf8;
    var Base64 = C_enc.Base64;
    var C_algo = C.algo;
    var EvpKDF = C_algo.EvpKDF;

    /**
     * Abstract base cipher template.
     *
     * @property {number} keySize This cipher's key size. Default: 4 (128 bits)
     * @property {number} ivSize This cipher's IV size. Default: 4 (128 bits)
     * @property {number} _ENC_XFORM_MODE A constant representing encryption mode.
     * @property {number} _DEC_XFORM_MODE A constant representing decryption mode.
     */
    var Cipher = C_lib.Cipher = BufferedBlockAlgorithm.extend({
        /**
         * Configuration options.
         *
         * @property {WordArray} iv The IV to use for this operation.
         */
        cfg: Base.extend(),

        /**
         * Creates this cipher in encryption mode.
         *
         * @param {WordArray} key The key.
         * @param {Object} cfg (Optional) The configuration options to use for this operation.
         *
         * @return {Cipher} A cipher instance.
         *
         * @static
         *
         * @example
         *
         *     var cipher = CryptoJS.algo.AES.createEncryptor(keyWordArray, { iv: ivWordArray });
         */
        createEncryptor: function (key, cfg) {
            return this.create(this._ENC_XFORM_MODE, key, cfg);
        },

        /**
         * Creates this cipher in decryption mode.
         *
         * @param {WordArray} key The key.
         * @param {Object} cfg (Optional) The configuration options to use for this operation.
         *
         * @return {Cipher} A cipher instance.
         *
         * @static
         *
         * @example
         *
         *     var cipher = CryptoJS.algo.AES.createDecryptor(keyWordArray, { iv: ivWordArray });
         */
        createDecryptor: function (key, cfg) {
            return this.create(this._DEC_XFORM_MODE, key, cfg);
        },

        /**
         * Initializes a newly created cipher.
         *
         * @param {number} xformMode Either the encryption or decryption transormation mode constant.
         * @param {WordArray} key The key.
         * @param {Object} cfg (Optional) The configuration options to use for this operation.
         *
         * @example
         *
         *     var cipher = CryptoJS.algo.AES.create(CryptoJS.algo.AES._ENC_XFORM_MODE, keyWordArray, { iv: ivWordArray });
         */
        init: function (xformMode, key, cfg) {
            // Apply config defaults
            this.cfg = this.cfg.extend(cfg);

            // Store transform mode and key
            this._xformMode = xformMode;
            this._key = key;

            // Set initial values
            this.reset();
        },

        /**
         * Resets this cipher to its initial state.
         *
         * @example
         *
         *     cipher.reset();
         */
        reset: function () {
            // Reset data buffer
            BufferedBlockAlgorithm.reset.call(this);

            // Perform concrete-cipher logic
            this._doReset();
        },

        /**
         * Adds data to be encrypted or decrypted.
         *
         * @param {WordArray|string} dataUpdate The data to encrypt or decrypt.
         *
         * @return {WordArray} The data after processing.
         *
         * @example
         *
         *     var encrypted = cipher.process('data');
         *     var encrypted = cipher.process(wordArray);
         */
        process: function (dataUpdate) {
            // Append
            this._append(dataUpdate);

            // Process available blocks
            return this._process();
        },

        /**
         * Finalizes the encryption or decryption process.
         * Note that the finalize operation is effectively a destructive, read-once operation.
         *
         * @param {WordArray|string} dataUpdate The final data to encrypt or decrypt.
         *
         * @return {WordArray} The data after final processing.
         *
         * @example
         *
         *     var encrypted = cipher.finalize();
         *     var encrypted = cipher.finalize('data');
         *     var encrypted = cipher.finalize(wordArray);
         */
        finalize: function (dataUpdate) {
            // Final data update
            if (dataUpdate) {
                this._append(dataUpdate);
            }

            // Perform concrete-cipher logic
            var finalProcessedData = this._doFinalize();

            return finalProcessedData;
        },

        keySize: 128/32,

        ivSize: 128/32,

        _ENC_XFORM_MODE: 1,

        _DEC_XFORM_MODE: 2,

        /**
         * Creates shortcut functions to a cipher's object interface.
         *
         * @param {Cipher} cipher The cipher to create a helper for.
         *
         * @return {Object} An object with encrypt and decrypt shortcut functions.
         *
         * @static
         *
         * @example
         *
         *     var AES = CryptoJS.lib.Cipher._createHelper(CryptoJS.algo.AES);
         */
        _createHelper: (function () {
            function selectCipherStrategy(key) {
                if (typeof key == 'string') {
                    return PasswordBasedCipher;
                } else {
                    return SerializableCipher;
                }
            }

            return function (cipher) {
                return {
                    encrypt: function (message, key, cfg) {
                        return selectCipherStrategy(key).encrypt(cipher, message, key, cfg);
                    },

                    decrypt: function (ciphertext, key, cfg) {
                        return selectCipherStrategy(key).decrypt(cipher, ciphertext, key, cfg);
                    }
                };
            };
        }())
    });

    /**
     * Abstract base stream cipher template.
     *
     * @property {number} blockSize The number of 32-bit words this cipher operates on. Default: 1 (32 bits)
     */
    var StreamCipher = C_lib.StreamCipher = Cipher.extend({
        _doFinalize: function () {
            // Process partial blocks
            var finalProcessedBlocks = this._process(!!'flush');

            return finalProcessedBlocks;
        },

        blockSize: 1
    });

    /**
     * Mode namespace.
     */
    var C_mode = C.mode = {};

    /**
     * Abstract base block cipher mode template.
     */
    var BlockCipherMode = C_lib.BlockCipherMode = Base.extend({
        /**
         * Creates this mode for encryption.
         *
         * @param {Cipher} cipher A block cipher instance.
         * @param {Array} iv The IV words.
         *
         * @static
         *
         * @example
         *
         *     var mode = CryptoJS.mode.CBC.createEncryptor(cipher, iv.words);
         */
        createEncryptor: function (cipher, iv) {
            return this.Encryptor.create(cipher, iv);
        },

        /**
         * Creates this mode for decryption.
         *
         * @param {Cipher} cipher A block cipher instance.
         * @param {Array} iv The IV words.
         *
         * @static
         *
         * @example
         *
         *     var mode = CryptoJS.mode.CBC.createDecryptor(cipher, iv.words);
         */
        createDecryptor: function (cipher, iv) {
            return this.Decryptor.create(cipher, iv);
        },

        /**
         * Initializes a newly created mode.
         *
         * @param {Cipher} cipher A block cipher instance.
         * @param {Array} iv The IV words.
         *
         * @example
         *
         *     var mode = CryptoJS.mode.CBC.Encryptor.create(cipher, iv.words);
         */
        init: function (cipher, iv) {
            this._cipher = cipher;
            this._iv = iv;
        }
    });

    /**
     * Cipher Block Chaining mode.
     */
    var CBC = C_mode.CBC = (function () {
        /**
         * Abstract base CBC mode.
         */
        var CBC = BlockCipherMode.extend();

        /**
         * CBC encryptor.
         */
        CBC.Encryptor = CBC.extend({
            /**
             * Processes the data block at offset.
             *
             * @param {Array} words The data words to operate on.
             * @param {number} offset The offset where the block starts.
             *
             * @example
             *
             *     mode.processBlock(data.words, offset);
             */
            processBlock: function (words, offset) {
                // Shortcuts
                var cipher = this._cipher;
                var blockSize = cipher.blockSize;

                // XOR and encrypt
                xorBlock.call(this, words, offset, blockSize);
                cipher.encryptBlock(words, offset);

                // Remember this block to use with next block
                this._prevBlock = words.slice(offset, offset + blockSize);
            }
        });

        /**
         * CBC decryptor.
         */
        CBC.Decryptor = CBC.extend({
            /**
             * Processes the data block at offset.
             *
             * @param {Array} words The data words to operate on.
             * @param {number} offset The offset where the block starts.
             *
             * @example
             *
             *     mode.processBlock(data.words, offset);
             */
            processBlock: function (words, offset) {
                // Shortcuts
                var cipher = this._cipher;
                var blockSize = cipher.blockSize;

                // Remember this block to use with next block
                var thisBlock = words.slice(offset, offset + blockSize);

                // Decrypt and XOR
                cipher.decryptBlock(words, offset);
                xorBlock.call(this, words, offset, blockSize);

                // This block becomes the previous block
                this._prevBlock = thisBlock;
            }
        });

        function xorBlock(words, offset, blockSize) {
            // Shortcut
            var iv = this._iv;

            // Choose mixing block
            if (iv) {
                var block = iv;

                // Remove IV for subsequent blocks
                this._iv = undefined;
            } else {
                var block = this._prevBlock;
            }

            // XOR blocks
            for (var i = 0; i < blockSize; i++) {
                words[offset + i] ^= block[i];
            }
        }

        return CBC;
    }());

    /**
     * Padding namespace.
     */
    var C_pad = C.pad = {};

    /**
     * PKCS #5/7 padding strategy.
     */
    var Pkcs7 = C_pad.Pkcs7 = {
        /**
         * Pads data using the algorithm defined in PKCS #5/7.
         *
         * @param {WordArray} data The data to pad.
         * @param {number} blockSize The multiple that the data should be padded to.
         *
         * @static
         *
         * @example
         *
         *     CryptoJS.pad.Pkcs7.pad(wordArray, 4);
         */
        pad: function (data, blockSize) {
            // Shortcut
            var blockSizeBytes = blockSize * 4;

            // Count padding bytes
            var nPaddingBytes = blockSizeBytes - data.sigBytes % blockSizeBytes;

            // Create padding word
            var paddingWord = (nPaddingBytes << 24) | (nPaddingBytes << 16) | (nPaddingBytes << 8) | nPaddingBytes;

            // Create padding
            var paddingWords = [];
            for (var i = 0; i < nPaddingBytes; i += 4) {
                paddingWords.push(paddingWord);
            }
            var padding = WordArray.create(paddingWords, nPaddingBytes);

            // Add padding
            data.concat(padding);
        },

        /**
         * Unpads data that had been padded using the algorithm defined in PKCS #5/7.
         *
         * @param {WordArray} data The data to unpad.
         *
         * @static
         *
         * @example
         *
         *     CryptoJS.pad.Pkcs7.unpad(wordArray);
         */
        unpad: function (data) {
            // Get number of padding bytes from last byte
            var nPaddingBytes = data.words[(data.sigBytes - 1) >>> 2] & 0xff;

            // Remove padding
            data.sigBytes -= nPaddingBytes;
        }
    };

    /**
     * Abstract base block cipher template.
     *
     * @property {number} blockSize The number of 32-bit words this cipher operates on. Default: 4 (128 bits)
     */
    var BlockCipher = C_lib.BlockCipher = Cipher.extend({
        /**
         * Configuration options.
         *
         * @property {Mode} mode The block mode to use. Default: CBC
         * @property {Padding} padding The padding strategy to use. Default: Pkcs7
         */
        cfg: Cipher.cfg.extend({
            mode: CBC,
            padding: Pkcs7
        }),

        reset: function () {
            // Reset cipher
            Cipher.reset.call(this);

            // Shortcuts
            var cfg = this.cfg;
            var iv = cfg.iv;
            var mode = cfg.mode;

            // Reset block mode
            if (this._xformMode == this._ENC_XFORM_MODE) {
                var modeCreator = mode.createEncryptor;
            } else /* if (this._xformMode == this._DEC_XFORM_MODE) */ {
                var modeCreator = mode.createDecryptor;

                // Keep at least one block in the buffer for unpadding
                this._minBufferSize = 1;
            }
            this._mode = modeCreator.call(mode, this, iv && iv.words);
        },

        _doProcessBlock: function (words, offset) {
            this._mode.processBlock(words, offset);
        },

        _doFinalize: function () {
            // Shortcut
            var padding = this.cfg.padding;

            // Finalize
            if (this._xformMode == this._ENC_XFORM_MODE) {
                // Pad data
                padding.pad(this._data, this.blockSize);

                // Process final blocks
                var finalProcessedBlocks = this._process(!!'flush');
            } else /* if (this._xformMode == this._DEC_XFORM_MODE) */ {
                // Process final blocks
                var finalProcessedBlocks = this._process(!!'flush');

                // Unpad data
                padding.unpad(finalProcessedBlocks);
            }

            return finalProcessedBlocks;
        },

        blockSize: 128/32
    });

    /**
     * A collection of cipher parameters.
     *
     * @property {WordArray} ciphertext The raw ciphertext.
     * @property {WordArray} key The key to this ciphertext.
     * @property {WordArray} iv The IV used in the ciphering operation.
     * @property {WordArray} salt The salt used with a key derivation function.
     * @property {Cipher} algorithm The cipher algorithm.
     * @property {Mode} mode The block mode used in the ciphering operation.
     * @property {Padding} padding The padding scheme used in the ciphering operation.
     * @property {number} blockSize The block size of the cipher.
     * @property {Format} formatter The default formatting strategy to convert this cipher params object to a string.
     */
    var CipherParams = C_lib.CipherParams = Base.extend({
        /**
         * Initializes a newly created cipher params object.
         *
         * @param {Object} cipherParams An object with any of the possible cipher parameters.
         *
         * @example
         *
         *     var cipherParams = CryptoJS.lib.CipherParams.create({
         *         ciphertext: ciphertextWordArray,
         *         key: keyWordArray,
         *         iv: ivWordArray,
         *         salt: saltWordArray,
         *         algorithm: CryptoJS.algo.AES,
         *         mode: CryptoJS.mode.CBC,
         *         padding: CryptoJS.pad.PKCS7,
         *         blockSize: 4,
         *         formatter: CryptoJS.format.OpenSSL
         *     });
         */
        init: function (cipherParams) {
            this.mixIn(cipherParams);
        },

        /**
         * Converts this cipher params object to a string.
         *
         * @param {Format} formatter (Optional) The formatting strategy to use.
         *
         * @return {string} The stringified cipher params.
         *
         * @throws Error If neither the formatter nor the default formatter is set.
         *
         * @example
         *
         *     var string = cipherParams + '';
         *     var string = cipherParams.toString();
         *     var string = cipherParams.toString(CryptoJS.format.OpenSSL);
         */
        toString: function (formatter) {
            return (formatter || this.formatter).stringify(this);
        }
    });

    /**
     * Format namespace.
     */
    var C_format = C.format = {};

    /**
     * OpenSSL formatting strategy.
     */
    var OpenSSLFormatter = C_format.OpenSSL = {
        /**
         * Converts a cipher params object to an OpenSSL-compatible string.
         *
         * @param {CipherParams} cipherParams The cipher params object.
         *
         * @return {string} The OpenSSL-compatible string.
         *
         * @static
         *
         * @example
         *
         *     var openSSLString = CryptoJS.format.OpenSSL.stringify(cipherParams);
         */
        stringify: function (cipherParams) {
            // Shortcuts
            var ciphertext = cipherParams.ciphertext;
            var salt = cipherParams.salt;

            // Format
            if (salt) {
                var wordArray = WordArray.create([0x53616c74, 0x65645f5f]).concat(salt).concat(ciphertext);
            } else {
                var wordArray = ciphertext;
            }

            return wordArray.toString(Base64);
        },

        /**
         * Converts an OpenSSL-compatible string to a cipher params object.
         *
         * @param {string} openSSLStr The OpenSSL-compatible string.
         *
         * @return {CipherParams} The cipher params object.
         *
         * @static
         *
         * @example
         *
         *     var cipherParams = CryptoJS.format.OpenSSL.parse(openSSLString);
         */
        parse: function (openSSLStr) {
            // Parse base64
            var ciphertext = Base64.parse(openSSLStr);

            // Shortcut
            var ciphertextWords = ciphertext.words;

            // Test for salt
            if (ciphertextWords[0] == 0x53616c74 && ciphertextWords[1] == 0x65645f5f) {
                // Extract salt
                var salt = WordArray.create(ciphertextWords.slice(2, 4));

                // Remove salt from ciphertext
                ciphertextWords.splice(0, 4);
                ciphertext.sigBytes -= 16;
            }

            return CipherParams.create({ ciphertext: ciphertext, salt: salt });
        }
    };

    /**
     * A cipher wrapper that returns ciphertext as a serializable cipher params object.
     */
    var SerializableCipher = C_lib.SerializableCipher = Base.extend({
        /**
         * Configuration options.
         *
         * @property {Formatter} format The formatting strategy to convert cipher param objects to and from a string. Default: OpenSSL
         */
        cfg: Base.extend({
            format: OpenSSLFormatter
        }),

        /**
         * Encrypts a message.
         *
         * @param {Cipher} cipher The cipher algorithm to use.
         * @param {WordArray|string} message The message to encrypt.
         * @param {WordArray} key The key.
         * @param {Object} cfg (Optional) The configuration options to use for this operation.
         *
         * @return {CipherParams} A cipher params object.
         *
         * @static
         *
         * @example
         *
         *     var ciphertextParams = CryptoJS.lib.SerializableCipher.encrypt(CryptoJS.algo.AES, message, key);
         *     var ciphertextParams = CryptoJS.lib.SerializableCipher.encrypt(CryptoJS.algo.AES, message, key, { iv: iv });
         *     var ciphertextParams = CryptoJS.lib.SerializableCipher.encrypt(CryptoJS.algo.AES, message, key, { iv: iv, format: CryptoJS.format.OpenSSL });
         */
        encrypt: function (cipher, message, key, cfg) {
            // Apply config defaults
            cfg = this.cfg.extend(cfg);

            // Encrypt
            var encryptor = cipher.createEncryptor(key, cfg);
            var ciphertext = encryptor.finalize(message);

            // Shortcut
            var cipherCfg = encryptor.cfg;

            // Create and return serializable cipher params
            return CipherParams.create({
                ciphertext: ciphertext,
                key: key,
                iv: cipherCfg.iv,
                algorithm: cipher,
                mode: cipherCfg.mode,
                padding: cipherCfg.padding,
                blockSize: cipher.blockSize,
                formatter: cfg.format
            });
        },

        /**
         * Decrypts serialized ciphertext.
         *
         * @param {Cipher} cipher The cipher algorithm to use.
         * @param {CipherParams|string} ciphertext The ciphertext to decrypt.
         * @param {WordArray} key The key.
         * @param {Object} cfg (Optional) The configuration options to use for this operation.
         *
         * @return {WordArray} The plaintext.
         *
         * @static
         *
         * @example
         *
         *     var plaintext = CryptoJS.lib.SerializableCipher.decrypt(CryptoJS.algo.AES, formattedCiphertext, key, { iv: iv, format: CryptoJS.format.OpenSSL });
         *     var plaintext = CryptoJS.lib.SerializableCipher.decrypt(CryptoJS.algo.AES, ciphertextParams, key, { iv: iv, format: CryptoJS.format.OpenSSL });
         */
        decrypt: function (cipher, ciphertext, key, cfg) {
            // Apply config defaults
            cfg = this.cfg.extend(cfg);

            // Convert string to CipherParams
            ciphertext = this._parse(ciphertext, cfg.format);

            // Decrypt
            var plaintext = cipher.createDecryptor(key, cfg).finalize(ciphertext.ciphertext);

            return plaintext;
        },

        /**
         * Converts serialized ciphertext to CipherParams,
         * else assumed CipherParams already and returns ciphertext unchanged.
         *
         * @param {CipherParams|string} ciphertext The ciphertext.
         * @param {Formatter} format The formatting strategy to use to parse serialized ciphertext.
         *
         * @return {CipherParams} The unserialized ciphertext.
         *
         * @static
         *
         * @example
         *
         *     var ciphertextParams = CryptoJS.lib.SerializableCipher._parse(ciphertextStringOrParams, format);
         */
        _parse: function (ciphertext, format) {
            if (typeof ciphertext == 'string') {
                return format.parse(ciphertext, this);
            } else {
                return ciphertext;
            }
        }
    });

    /**
     * Key derivation function namespace.
     */
    var C_kdf = C.kdf = {};

    /**
     * OpenSSL key derivation function.
     */
    var OpenSSLKdf = C_kdf.OpenSSL = {
        /**
         * Derives a key and IV from a password.
         *
         * @param {string} password The password to derive from.
         * @param {number} keySize The size in words of the key to generate.
         * @param {number} ivSize The size in words of the IV to generate.
         * @param {WordArray|string} salt (Optional) A 64-bit salt to use. If omitted, a salt will be generated randomly.
         *
         * @return {CipherParams} A cipher params object with the key, IV, and salt.
         *
         * @static
         *
         * @example
         *
         *     var derivedParams = CryptoJS.kdf.OpenSSL.execute('Password', 256/32, 128/32);
         *     var derivedParams = CryptoJS.kdf.OpenSSL.execute('Password', 256/32, 128/32, 'saltsalt');
         */
        execute: function (password, keySize, ivSize, salt) {
            // Generate random salt
            if (!salt) {
                salt = WordArray.random(64/8);
            }

            // Derive key and IV
            var key = EvpKDF.create({ keySize: keySize + ivSize }).compute(password, salt);

            // Separate key and IV
            var iv = WordArray.create(key.words.slice(keySize), ivSize * 4);
            key.sigBytes = keySize * 4;

            // Return params
            return CipherParams.create({ key: key, iv: iv, salt: salt });
        }
    };

    /**
     * A serializable cipher wrapper that derives the key from a password,
     * and returns ciphertext as a serializable cipher params object.
     */
    var PasswordBasedCipher = C_lib.PasswordBasedCipher = SerializableCipher.extend({
        /**
         * Configuration options.
         *
         * @property {KDF} kdf The key derivation function to use to generate a key and IV from a password. Default: OpenSSL
         */
        cfg: SerializableCipher.cfg.extend({
            kdf: OpenSSLKdf
        }),

        /**
         * Encrypts a message using a password.
         *
         * @param {Cipher} cipher The cipher algorithm to use.
         * @param {WordArray|string} message The message to encrypt.
         * @param {string} password The password.
         * @param {Object} cfg (Optional) The configuration options to use for this operation.
         *
         * @return {CipherParams} A cipher params object.
         *
         * @static
         *
         * @example
         *
         *     var ciphertextParams = CryptoJS.lib.PasswordBasedCipher.encrypt(CryptoJS.algo.AES, message, 'password');
         *     var ciphertextParams = CryptoJS.lib.PasswordBasedCipher.encrypt(CryptoJS.algo.AES, message, 'password', { format: CryptoJS.format.OpenSSL });
         */
        encrypt: function (cipher, message, password, cfg) {
            // Apply config defaults
            cfg = this.cfg.extend(cfg);

            // Derive key and other params
            var derivedParams = cfg.kdf.execute(password, cipher.keySize, cipher.ivSize);

            // Add IV to config
            cfg.iv = derivedParams.iv;

            // Encrypt
            var ciphertext = SerializableCipher.encrypt.call(this, cipher, message, derivedParams.key, cfg);

            // Mix in derived params
            ciphertext.mixIn(derivedParams);

            return ciphertext;
        },

        /**
         * Decrypts serialized ciphertext using a password.
         *
         * @param {Cipher} cipher The cipher algorithm to use.
         * @param {CipherParams|string} ciphertext The ciphertext to decrypt.
         * @param {string} password The password.
         * @param {Object} cfg (Optional) The configuration options to use for this operation.
         *
         * @return {WordArray} The plaintext.
         *
         * @static
         *
         * @example
         *
         *     var plaintext = CryptoJS.lib.PasswordBasedCipher.decrypt(CryptoJS.algo.AES, formattedCiphertext, 'password', { format: CryptoJS.format.OpenSSL });
         *     var plaintext = CryptoJS.lib.PasswordBasedCipher.decrypt(CryptoJS.algo.AES, ciphertextParams, 'password', { format: CryptoJS.format.OpenSSL });
         */
        decrypt: function (cipher, ciphertext, password, cfg) {
            // Apply config defaults
            cfg = this.cfg.extend(cfg);

            // Convert string to CipherParams
            ciphertext = this._parse(ciphertext, cfg.format);

            // Derive key and other params
            var derivedParams = cfg.kdf.execute(password, cipher.keySize, cipher.ivSize, ciphertext.salt);

            // Add IV to config
            cfg.iv = derivedParams.iv;

            // Decrypt
            var plaintext = SerializableCipher.decrypt.call(this, cipher, ciphertext, derivedParams.key, cfg);

            return plaintext;
        }
    });
}());

(function () {
    // Shortcuts
    var C = CryptoJS;
    var C_lib = C.lib;
    var BlockCipher = C_lib.BlockCipher;
    var C_algo = C.algo;

    // Lookup tables
    var SBOX = [];
    var INV_SBOX = [];
    var SUB_MIX_0 = [];
    var SUB_MIX_1 = [];
    var SUB_MIX_2 = [];
    var SUB_MIX_3 = [];
    var INV_SUB_MIX_0 = [];
    var INV_SUB_MIX_1 = [];
    var INV_SUB_MIX_2 = [];
    var INV_SUB_MIX_3 = [];

    // Compute lookup tables
    (function () {
        // Compute double table
        var d = [];
        for (var i = 0; i < 256; i++) {
            if (i < 128) {
                d[i] = i << 1;
            } else {
                d[i] = (i << 1) ^ 0x11b;
            }
        }

        // Walk GF(2^8)
        var x = 0;
        var xi = 0;
        for (var i = 0; i < 256; i++) {
            // Compute sbox
            var sx = xi ^ (xi << 1) ^ (xi << 2) ^ (xi << 3) ^ (xi << 4);
            sx = (sx >>> 8) ^ (sx & 0xff) ^ 0x63;
            SBOX[x] = sx;
            INV_SBOX[sx] = x;

            // Compute multiplication
            var x2 = d[x];
            var x4 = d[x2];
            var x8 = d[x4];

            // Compute sub bytes, mix columns tables
            var t = (d[sx] * 0x101) ^ (sx * 0x1010100);
            SUB_MIX_0[x] = (t << 24) | (t >>> 8);
            SUB_MIX_1[x] = (t << 16) | (t >>> 16);
            SUB_MIX_2[x] = (t << 8)  | (t >>> 24);
            SUB_MIX_3[x] = t;

            // Compute inv sub bytes, inv mix columns tables
            var t = (x8 * 0x1010101) ^ (x4 * 0x10001) ^ (x2 * 0x101) ^ (x * 0x1010100);
            INV_SUB_MIX_0[sx] = (t << 24) | (t >>> 8);
            INV_SUB_MIX_1[sx] = (t << 16) | (t >>> 16);
            INV_SUB_MIX_2[sx] = (t << 8)  | (t >>> 24);
            INV_SUB_MIX_3[sx] = t;

            // Compute next counter
            if (!x) {
                x = xi = 1;
            } else {
                x = x2 ^ d[d[d[x8 ^ x2]]];
                xi ^= d[d[xi]];
            }
        }
    }());

    // Precomputed Rcon lookup
    var RCON = [0x00, 0x01, 0x02, 0x04, 0x08, 0x10, 0x20, 0x40, 0x80, 0x1b, 0x36];

    /**
     * AES block cipher algorithm.
     */
    var AES = C_algo.AES = BlockCipher.extend({
        _doReset: function () {
            // Shortcuts
            var key = this._key;
            var keyWords = key.words;
            var keySize = key.sigBytes / 4;

            // Compute number of rounds
            var nRounds = this._nRounds = keySize + 6

            // Compute number of key schedule rows
            var ksRows = (nRounds + 1) * 4;

            // Compute key schedule
            var keySchedule = this._keySchedule = [];
            for (var ksRow = 0; ksRow < ksRows; ksRow++) {
                if (ksRow < keySize) {
                    keySchedule[ksRow] = keyWords[ksRow];
                } else {
                    var t = keySchedule[ksRow - 1];

                    if (!(ksRow % keySize)) {
                        // Rot word
                        t = (t << 8) | (t >>> 24);

                        // Sub word
                        t = (SBOX[t >>> 24] << 24) | (SBOX[(t >>> 16) & 0xff] << 16) | (SBOX[(t >>> 8) & 0xff] << 8) | SBOX[t & 0xff];

                        // Mix Rcon
                        t ^= RCON[(ksRow / keySize) | 0] << 24;
                    } else if (keySize > 6 && ksRow % keySize == 4) {
                        // Sub word
                        t = (SBOX[t >>> 24] << 24) | (SBOX[(t >>> 16) & 0xff] << 16) | (SBOX[(t >>> 8) & 0xff] << 8) | SBOX[t & 0xff];
                    }

                    keySchedule[ksRow] = keySchedule[ksRow - keySize] ^ t;
                }
            }

            // Compute inv key schedule
            var invKeySchedule = this._invKeySchedule = [];
            for (var invKsRow = 0; invKsRow < ksRows; invKsRow++) {
                var ksRow = ksRows - invKsRow;

                if (invKsRow % 4) {
                    var t = keySchedule[ksRow];
                } else {
                    var t = keySchedule[ksRow - 4];
                }

                if (invKsRow < 4 || ksRow <= 4) {
                    invKeySchedule[invKsRow] = t;
                } else {
                    invKeySchedule[invKsRow] = INV_SUB_MIX_0[SBOX[t >>> 24]] ^ INV_SUB_MIX_1[SBOX[(t >>> 16) & 0xff]] ^
                                               INV_SUB_MIX_2[SBOX[(t >>> 8) & 0xff]] ^ INV_SUB_MIX_3[SBOX[t & 0xff]];
                }
            }
        },

        encryptBlock: function (M, offset) {
            this._doCryptBlock(M, offset, this._keySchedule, SUB_MIX_0, SUB_MIX_1, SUB_MIX_2, SUB_MIX_3, SBOX);
        },

        decryptBlock: function (M, offset) {
            // Swap 2nd and 4th rows
            var t = M[offset + 1];
            M[offset + 1] = M[offset + 3];
            M[offset + 3] = t;

            this._doCryptBlock(M, offset, this._invKeySchedule, INV_SUB_MIX_0, INV_SUB_MIX_1, INV_SUB_MIX_2, INV_SUB_MIX_3, INV_SBOX);

            // Inv swap 2nd and 4th rows
            var t = M[offset + 1];
            M[offset + 1] = M[offset + 3];
            M[offset + 3] = t;
        },

        _doCryptBlock: function (M, offset, keySchedule, SUB_MIX_0, SUB_MIX_1, SUB_MIX_2, SUB_MIX_3, SBOX) {
            // Shortcut
            var nRounds = this._nRounds;

            // Get input, add round key
            var s0 = M[offset]     ^ keySchedule[0];
            var s1 = M[offset + 1] ^ keySchedule[1];
            var s2 = M[offset + 2] ^ keySchedule[2];
            var s3 = M[offset + 3] ^ keySchedule[3];

            // Key schedule row counter
            var ksRow = 4;

            // Rounds
            for (var round = 1; round < nRounds; round++) {
                // Shift rows, sub bytes, mix columns, add round key
                var t0 = SUB_MIX_0[s0 >>> 24] ^ SUB_MIX_1[(s1 >>> 16) & 0xff] ^ SUB_MIX_2[(s2 >>> 8) & 0xff] ^ SUB_MIX_3[s3 & 0xff] ^ keySchedule[ksRow++];
                var t1 = SUB_MIX_0[s1 >>> 24] ^ SUB_MIX_1[(s2 >>> 16) & 0xff] ^ SUB_MIX_2[(s3 >>> 8) & 0xff] ^ SUB_MIX_3[s0 & 0xff] ^ keySchedule[ksRow++];
                var t2 = SUB_MIX_0[s2 >>> 24] ^ SUB_MIX_1[(s3 >>> 16) & 0xff] ^ SUB_MIX_2[(s0 >>> 8) & 0xff] ^ SUB_MIX_3[s1 & 0xff] ^ keySchedule[ksRow++];
                var t3 = SUB_MIX_0[s3 >>> 24] ^ SUB_MIX_1[(s0 >>> 16) & 0xff] ^ SUB_MIX_2[(s1 >>> 8) & 0xff] ^ SUB_MIX_3[s2 & 0xff] ^ keySchedule[ksRow++];

                // Update state
                s0 = t0;
                s1 = t1;
                s2 = t2;
                s3 = t3;
            }

            // Shift rows, sub bytes, add round key
            var t0 = ((SBOX[s0 >>> 24] << 24) | (SBOX[(s1 >>> 16) & 0xff] << 16) | (SBOX[(s2 >>> 8) & 0xff] << 8) | SBOX[s3 & 0xff]) ^ keySchedule[ksRow++];
            var t1 = ((SBOX[s1 >>> 24] << 24) | (SBOX[(s2 >>> 16) & 0xff] << 16) | (SBOX[(s3 >>> 8) & 0xff] << 8) | SBOX[s0 & 0xff]) ^ keySchedule[ksRow++];
            var t2 = ((SBOX[s2 >>> 24] << 24) | (SBOX[(s3 >>> 16) & 0xff] << 16) | (SBOX[(s0 >>> 8) & 0xff] << 8) | SBOX[s1 & 0xff]) ^ keySchedule[ksRow++];
            var t3 = ((SBOX[s3 >>> 24] << 24) | (SBOX[(s0 >>> 16) & 0xff] << 16) | (SBOX[(s1 >>> 8) & 0xff] << 8) | SBOX[s2 & 0xff]) ^ keySchedule[ksRow++];

            // Set output
            M[offset]     = t0;
            M[offset + 1] = t1;
            M[offset + 2] = t2;
            M[offset + 3] = t3;
        },

        keySize: 256/32
    });

    /**
     * Shortcut functions to the cipher's object interface.
     *
     * @example
     *
     *     var ciphertext = CryptoJS.AES.encrypt(message, key, cfg);
     *     var plaintext  = CryptoJS.AES.decrypt(ciphertext, key, cfg);
     */
    C.AES = BlockCipher._createHelper(AES);
}());

/*
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
    // Test for webcrypto support, polyfill if needed.
    if (window.crypto.subtle === undefined || window.crypto.subtle === null) {
        window.crypto.subtle = (function () {
            var StaticArrayBufferProto = new ArrayBuffer().__proto__;
            function assertIsArrayBuffer(thing) {
                if (thing !== Object(thing) || thing.__proto__ != StaticArrayBufferProto)
                    throw new Error("Needed a ArrayBuffer");
            }

            // Synchronous implementation functions for polyfilling webcrypto
            // All inputs/outputs are arraybuffers!
            function HmacSHA256(key, input) {
                assertIsArrayBuffer(key);
                assertIsArrayBuffer(input);
                return CryptoJS.HmacSHA256(
                    CryptoJS.enc.Latin1.parse(getString(input)),
                    CryptoJS.enc.Latin1.parse(getString(key))
                );
            };

            function encryptAESCBC(plaintext, key, iv) {
                assertIsArrayBuffer(plaintext);
                assertIsArrayBuffer(key);
                assertIsArrayBuffer(iv);
                return CryptoJS.AES.encrypt(
                        CryptoJS.enc.Latin1.parse(getString(plaintext)),
                        CryptoJS.enc.Latin1.parse(getString(key)),
                        { iv: CryptoJS.enc.Latin1.parse(getString(iv)) }
                ).ciphertext;
            };

            function decryptAESCBC(ciphertext, key, iv) {
                assertIsArrayBuffer(ciphertext);
                assertIsArrayBuffer(key);
                assertIsArrayBuffer(iv);
                return CryptoJS.AES.decrypt(
                        btoa(getString(ciphertext)),
                        CryptoJS.enc.Latin1.parse(getString(key)),
                        { iv: CryptoJS.enc.Latin1.parse(getString(iv)) }
                );
            };

            // utility function for connecting front and back ends via promises
            // Takes an implementation function and 0 or more arguments
            function promise(implementation) {
                var args = Array.prototype.slice.call(arguments);
                args.shift();
                return new Promise(function(resolve) {
                    var wordArray = implementation.apply(this, args);
                    // convert 32bit WordArray to array buffer
                    var buffer = new ArrayBuffer(wordArray.sigBytes);
                    var view =  new DataView(buffer);
                    for(var i = 0; i*4 < buffer.byteLength; i++) {
                      view.setInt32(i*4, wordArray.words[i]);
                    }
                    resolve(buffer);
                });
            };

            return {
                encrypt: function(algorithm, key, data) {
                    if (algorithm.name === "AES-CBC")
                        return promise(encryptAESCBC, data, key, algorithm.iv.buffer || algorithm.iv);
                },

                decrypt: function(algorithm, key, data) {
                    if (algorithm.name === "AES-CBC")
                        return promise(decryptAESCBC, data, key, algorithm.iv.buffer || algorithm.iv);
                },

                sign: function(algorithm, key, data) {
                    if (algorithm.name === "HMAC" && algorithm.hash === "SHA-256")
                        return promise(HmacSHA256, key, data);
                },

                importKey: function(format, key, algorithm, extractable, usages) {
                    return new Promise(function(resolve,reject){ resolve(key); });
                }
            };
        })();
    } // if !window.crypto.subtle
})();

})();
;(function() {

    function loadProtoBufs(filename) {
        return dcodeIO.ProtoBuf.loadProtoFile({root: 'protos', file: filename}).build('textsecure');
    };

    var pushMessages     = loadProtoBufs('IncomingPushMessageSignal.proto');
    var protocolMessages = loadProtoBufs('WhisperTextProtocol.proto');
    var subProtocolMessages = loadProtoBufs('SubProtocol.proto');
    var deviceMessages   = loadProtoBufs('DeviceMessages.proto');

    window.textsecure = window.textsecure || {};
    window.textsecure.protobuf = {
        IncomingPushMessageSignal : pushMessages.IncomingPushMessageSignal,
        PushMessageContent        : pushMessages.PushMessageContent,
        WhisperMessage            : protocolMessages.WhisperMessage,
        PreKeyWhisperMessage      : protocolMessages.PreKeyWhisperMessage,
        DeviceInit                : deviceMessages.DeviceInit,
        IdentityKey               : deviceMessages.IdentityKey,
        DeviceControl             : deviceMessages.DeviceControl,
        WebSocketResponseMessage  : subProtocolMessages.WebSocketResponseMessage,
        WebSocketRequestMessage   : subProtocolMessages.WebSocketRequestMessage,
        WebSocketMessage          : subProtocolMessages.WebSocketMessage
    };
})();

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
;(function(){
    'use strict';

    /*
     * var socket = textsecure.websocket(url);
     *
     * Returns an adamantium-reinforced super socket, capable of sending
     * app-level keep alives and automatically reconnecting.
     *
     */

    window.textsecure.websocket = function (url) {
        var socketWrapper = {
            onmessage    : function() {},
            ondisconnect : function() {},
        };
        var socket;
        var keepAliveTimer;
        var reconnectSemaphore = 0;
        var reconnectTimeout = 1000;

        function resetKeepAliveTimer() {
            clearTimeout(keepAliveTimer);
            keepAliveTimer = setTimeout(function() {
                socket.send(
                    new textsecure.protobuf.WebSocketMessage({
                        type: textsecure.protobuf.WebSocketMessage.Type.REQUEST,
                        request: { verb: 'GET', path: '/v1/keepalive' }
                    }).encode().toArrayBuffer()
                );

                resetKeepAliveTimer();
            }, 15000);
        };

        function reconnect(e) {
            reconnectSemaphore--;
            setTimeout(connect, reconnectTimeout);
            socketWrapper.ondisconnect(e);
        };

        function connect() {
            clearTimeout(keepAliveTimer);
            if (++reconnectSemaphore <= 0) { return; }

            if (socket) { socket.close(); }
            socket = new WebSocket(url);

            socket.onerror = reconnect;
            socket.onclose = reconnect;
            socket.onopen  = resetKeepAliveTimer;

            socket.onmessage = function(response) {
                socketWrapper.onmessage(response);
                resetKeepAliveTimer();
            };

            socketWrapper.send = function(msg) {
                socket.send(msg);
            }
        }

        connect();
        return socketWrapper;
    };
})();

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
;(function(){
    'use strict';

    /*
     * WebSocket-Resources
     *
     * Create a request-response interface over websockets using the
     * WebSocket-Resources sub-protocol[1].
     *
     * var client = new WebSocketResource(socket, function(request) {
     *    request.respond(200, 'OK');
     * });
     *
     * client.sendRequest({
     *    verb: 'PUT',
     *    path: '/v1/messages',
     *    body: '{ some: "json" }',
     *    success: function(message, status, request) {...},
     *    error: function(message, status, request) {...}
     * });
     *
     * 1. https://github.com/WhisperSystems/WebSocket-Resources
     *
     */

    var Request = function(options) {
        this.verb    = options.verb || options.type;
        this.path    = options.path || options.url;
        this.body    = options.body || options.data;
        this.success = options.success
        this.error   = options.error
        this.id      = options.id;

        if (this.id === undefined) {
            var bits = new Uint32Array(2);
            window.crypto.getRandomValues(bits);
            this.id = dcodeIO.Long.fromBits(bits[0], bits[1], true);
        }
    };

    var IncomingWebSocketRequest = function(options) {
        var request = new Request(options);
        var socket = options.socket;

        this.verb = request.verb;
        this.path = request.path;
        this.body = request.body;

        this.respond = function(status, message) {
            socket.send(
                new textsecure.protobuf.WebSocketMessage({
                    type: textsecure.protobuf.WebSocketMessage.Type.RESPONSE,
                    response: { id: request.id, message: message, status: status }
                }).encode().toArrayBuffer()
            );
        };
    };

    var outgoing = {};
    var OutgoingWebSocketRequest = function(options, socket) {
        var request = new Request(options);
        outgoing[request.id] = request;
        socket.send(
            new textsecure.protobuf.WebSocketMessage({
                type: textsecure.protobuf.WebSocketMessage.Type.REQUEST,
                request: {
                    verb : request.verb,
                    path : request.path,
                    body : request.body,
                    id   : request.id
                }
            }).encode().toArrayBuffer()
        );
    };

    window.WebSocketResource = function(socket, handleRequest) {
        this.sendRequest = function(options) {
            return new OutgoingWebSocketRequest(options, socket);
        };

        socket.onmessage = function(socketMessage) {
            var blob = socketMessage.data;
            var reader = new FileReader();
            reader.onload = function() {
                var message = textsecure.protobuf.WebSocketMessage.decode(reader.result);
                if (message.type === textsecure.protobuf.WebSocketMessage.Type.REQUEST ) {
                    handleRequest(
                        new IncomingWebSocketRequest({
                            verb   : message.request.verb,
                            path   : message.request.path,
                            body   : message.request.body,
                            id     : message.request.id,
                            socket : socket
                        })
                    );
                }
                else if (message.type === textsecure.protobuf.WebSocketMessage.Type.RESPONSE ) {
                    var response = message.response;
                    var request = outgoing[response.id];
                    if (request) {
                        request.response = response;
                        var callback = request.error;
                        if (response.status >= 200 && response.status < 300) {
                            callback = request.success;
                        }

                        if (typeof callback === 'function') {
                            callback(response.message, response.status, request);
                        }
                    } else {
                        throw 'Received response for unknown request ' + message.response.id;
                    }
                }
            };
            reader.readAsArrayBuffer(blob);
        };
    };

}());

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

window.textsecure = window.textsecure || {};

/*********************************
 *** Type conversion utilities ***
 *********************************/
// Strings/arrays
//TODO: Throw all this shit in favor of consistent types
//TODO: Namespace
var StaticByteBufferProto = new dcodeIO.ByteBuffer().__proto__;
var StaticArrayBufferProto = new ArrayBuffer().__proto__;
var StaticUint8ArrayProto = new Uint8Array().__proto__;
function getString(thing) {
    if (thing === Object(thing)) {
        if (thing.__proto__ == StaticUint8ArrayProto)
            return String.fromCharCode.apply(null, thing);
        if (thing.__proto__ == StaticArrayBufferProto)
            return getString(new Uint8Array(thing));
        if (thing.__proto__ == StaticByteBufferProto)
            return thing.toString("binary");
    }
    return thing;
}

function getStringable(thing) {
    return (typeof thing == "string" || typeof thing == "number" || typeof thing == "boolean" ||
            (thing === Object(thing) &&
                (thing.__proto__ == StaticArrayBufferProto ||
                thing.__proto__ == StaticUint8ArrayProto ||
                thing.__proto__ == StaticByteBufferProto)));
}

function isEqual(a, b, mayBeShort) {
    // TODO: Special-case arraybuffers, etc
    if (a === undefined || b === undefined)
        return false;
    a = getString(a);
    b = getString(b);
    var maxLength = mayBeShort ? Math.min(a.length, b.length) : Math.max(a.length, b.length);
    if (maxLength < 5)
        throw new Error("a/b compare too short");
    return a.substring(0, Math.min(maxLength, a.length)) == b.substring(0, Math.min(maxLength, b.length));
}

function toArrayBuffer(thing) {
    //TODO: Optimize this for specific cases
    if (thing === undefined)
        return undefined;
    if (thing === Object(thing) && thing.__proto__ == StaticArrayBufferProto)
        return thing;

    if (thing instanceof Array) {
        // Assuming Uint16Array from curve25519
        var res = new ArrayBuffer(thing.length * 2);
        var uint = new Uint16Array(res);
        for (var i = 0; i < thing.length; i++)
            uint[i] = thing[i];
        return res;
    }

    if (!getStringable(thing))
        throw new Error("Tried to convert a non-stringable thing of type " + typeof thing + " to an array buffer");
    var str = getString(thing);
    var res = new ArrayBuffer(str.length);
    var uint = new Uint8Array(res);
    for (var i = 0; i < str.length; i++)
        uint[i] = str.charCodeAt(i);
    return res;
}

// Number formatting utils
window.textsecure.utils = function() {
    var self = {};
    self.unencodeNumber = function(number) {
        return number.split(".");
    };

    self.isNumberSane = function(number) {
        return number[0] == "+" &&
            /^[0-9]+$/.test(number.substring(1));
    }

    /**************************
     *** JSON'ing Utilities ***
     **************************/
    function ensureStringed(thing) {
        if (getStringable(thing))
            return getString(thing);
        else if (thing instanceof Array) {
            var res = [];
            for (var i = 0; i < thing.length; i++)
                res[i] = ensureStringed(thing[i]);
            return res;
        } else if (thing === Object(thing)) {
            var res = {};
            for (var key in thing)
                res[key] = ensureStringed(thing[key]);
            return res;
        }
        throw new Error("unsure of how to jsonify object of type " + typeof thing);

    }

    self.jsonThing = function(thing) {
        return JSON.stringify(ensureStringed(thing));
    }

    return self;
}();

window.textsecure.throwHumanError = function(error, type, humanError) {
    var e = new Error(error);
    if (type !== undefined)
        e.name = type;
    e.humanError = humanError;
    throw e;
}

var handleAttachment = function(attachment) {
    function getAttachment() {
        return textsecure.api.getAttachment(attachment.id.toString());
    }

    function decryptAttachment(encrypted) {
        return textsecure.protocol.decryptAttachment(
            encrypted,
            attachment.key.toArrayBuffer()
        );
    }

    function updateAttachment(data) {
        attachment.data = data;
    }

    return getAttachment().
      then(decryptAttachment).
      then(updateAttachment);
};

textsecure.processDecrypted = function(decrypted, source) {

    // Now that its decrypted, validate the message and clean it up for consumer processing
    // Note that messages may (generally) only perform one action and we ignore remaining fields
    // after the first action.

    if (decrypted.flags == null)
        decrypted.flags = 0;

    if ((decrypted.flags & textsecure.protobuf.PushMessageContent.Flags.END_SESSION)
                == textsecure.protobuf.PushMessageContent.Flags.END_SESSION)
        return;
    if (decrypted.flags != 0) {
        throw new Error("Unknown flags in message");
    }

    var promises = [];

    if (decrypted.group !== null) {
        decrypted.group.id = getString(decrypted.group.id);
        var existingGroup = textsecure.storage.groups.getNumbers(decrypted.group.id);
        if (existingGroup === undefined) {
            if (decrypted.group.type != textsecure.protobuf.PushMessageContent.GroupContext.Type.UPDATE) {
                throw new Error("Got message for unknown group");
            }
            textsecure.storage.groups.createNewGroup(decrypted.group.members, decrypted.group.id);
            if (decrypted.group.avatar !== null) {
                promises.push(handleAttachment(decrypted.group.avatar));
            }
        } else {
            var fromIndex = existingGroup.indexOf(source);

            if (fromIndex < 0) {
                //TODO: This could be indication of a race...
                throw new Error("Sender was not a member of the group they were sending from");
            }

            switch(decrypted.group.type) {
            case textsecure.protobuf.PushMessageContent.GroupContext.Type.UPDATE:
                if (decrypted.group.avatar !== null)
                    promises.push(handleAttachment(decrypted.group.avatar));

                if (decrypted.group.members.filter(function(number) { return !textsecure.utils.isNumberSane(number); }).length != 0)
                    throw new Error("Invalid number in new group members");

                if (existingGroup.filter(function(number) { decrypted.group.members.indexOf(number) < 0 }).length != 0)
                    throw new Error("Attempted to remove numbers from group with an UPDATE");
                decrypted.group.added = decrypted.group.members.filter(function(number) { return existingGroup.indexOf(number) < 0; });

                var newGroup = textsecure.storage.groups.addNumbers(decrypted.group.id, decrypted.group.added);
                if (newGroup.length != decrypted.group.members.length ||
                    newGroup.filter(function(number) { return decrypted.group.members.indexOf(number) < 0; }).length != 0) {
                    throw new Error("Error calculating group member difference");
                }

                //TODO: Also follow this path if avatar + name haven't changed (ie we should start storing those)
                if (decrypted.group.avatar === null && decrypted.group.added.length == 0 && decrypted.group.name === null) {
                    return;
                }

                decrypted.body = null;
                decrypted.attachments = [];

                break;
            case textsecure.protobuf.PushMessageContent.GroupContext.Type.QUIT:
                textsecure.storage.groups.removeNumber(decrypted.group.id, source);

                decrypted.body = null;
                decrypted.attachments = [];
            case textsecure.protobuf.PushMessageContent.GroupContext.Type.DELIVER:
                decrypted.group.name = null;
                decrypted.group.members = [];
                decrypted.group.avatar = null;

                break;
            default:
                throw new Error("Unknown group message type");
            }
        }
    }

    for (var i in decrypted.attachments) {
        promises.push(handleAttachment(decrypted.attachments[i]));
    }
    return Promise.all(promises).then(function() {
        return decrypted;
    });
}

window.textsecure.registerSingleDevice = function(number, verificationCode, stepDone) {
    var signalingKey = textsecure.crypto.getRandomBytes(32 + 20);
    textsecure.storage.putEncrypted('signaling_key', signalingKey);

    var password = btoa(getString(textsecure.crypto.getRandomBytes(16)));
    password = password.substring(0, password.length - 2);
    textsecure.storage.putEncrypted("password", password);

    var registrationId = new Uint16Array(textsecure.crypto.getRandomBytes(2))[0];
    registrationId = registrationId & 0x3fff;
    textsecure.storage.putUnencrypted("registrationId", registrationId);

    return textsecure.api.confirmCode(number, verificationCode, password, signalingKey, registrationId, true).then(function() {
        var numberId = number + ".1";
        textsecure.storage.putUnencrypted("number_id", numberId);
        textsecure.storage.putUnencrypted("regionCode", libphonenumber.util.getRegionCodeForNumber(number));
        stepDone(1);

        return textsecure.protocol.generateKeys().then(function(keys) {
            stepDone(2);
            return textsecure.api.registerKeys(keys).then(function() {
                stepDone(3);
            });
        });
    });
}

window.textsecure.registerSecondDevice = function(encodedDeviceInit, cryptoInfo, stepDone) {
    var deviceInit = textsecure.protobuf.DeviceInit.decode(encodedDeviceInit, 'binary');
    return cryptoInfo.decryptAndHandleDeviceInit(deviceInit).then(function(identityKey) {
        if (identityKey.server != textsecure.api.relay)
            throw new Error("Unknown relay used by master");
        var number = identityKey.phoneNumber;

        stepDone(1);

        var signalingKey = textsecure.crypto.getRandomBytes(32 + 20);
        textsecure.storage.putEncrypted('signaling_key', signalingKey);

        var password = btoa(getString(textsecure.crypto.getRandomBytes(16)));
        password = password.substring(0, password.length - 2);
        textsecure.storage.putEncrypted("password", password);

        var registrationId = new Uint16Array(textsecure.crypto.getRandomBytes(2))[0];
        registrationId = registrationId & 0x3fff;
        textsecure.storage.putUnencrypted("registrationId", registrationId);

        return textsecure.api.confirmCode(number, identityKey.provisioningCode, password, signalingKey, registrationId, false).then(function(result) {
            var numberId = number + "." + result;
            textsecure.storage.putUnencrypted("number_id", numberId);
            textsecure.storage.putUnencrypted("regionCode", libphonenumber.util.getRegion(number));
            stepDone(2);

            return textsecure.protocol.generateKeys().then(function(keys) {
                stepDone(3);
                return textsecure.api.registerKeys(keys).then(function() {
                    stepDone(4);
                    //TODO: Send DeviceControl.NEW_DEVICE_REGISTERED to all other devices
                });
            });
        });
    });
};

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

    var registeredFunctions = {};
    var Type = {
        SEND_MESSAGE: 1,
        INIT_SESSION: 2,
    };
    window.textsecure = window.textsecure || {};
    window.textsecure.replay = {
        Type: Type,
        registerFunction: function(func, functionCode) {
            registeredFunctions[functionCode] = func;
        }
    };

    function ReplayableError(options) {
        options = options || {};
        this.name         = options.name || 'ReplayableError';
        this.functionCode = options.functionCode;
        this.args         = options.args;
    }
    ReplayableError.prototype = new Error();
    ReplayableError.prototype.constructor = ReplayableError;

    ReplayableError.prototype.replay = function() {
        var args = Array.prototype.slice.call(arguments);
        args.shift();
        args = this.args.concat(args);

        registeredFunctions[this.functionCode].apply(window, args);
    };

    function IncomingIdentityKeyError(number, message) {
        ReplayableError.call(this, {
            functionCode : Type.INIT_SESSION,
            args         : [number, message]
        });
        this.name = 'IncomingIdentityKeyError';
        this.message = "The identity of the sender has changed. This may be malicious, or the sender may have simply reinstalled TextSecure.";
    }
    IncomingIdentityKeyError.prototype = new ReplayableError();
    IncomingIdentityKeyError.prototype.constructor = IncomingIdentityKeyError;

    function OutgoingIdentityKeyError(number, message) {
        ReplayableError.call(this, {
            functionCode : Type.SEND_MESSAGE,
            args         : [number, message]
        });
        this.name = 'OutgoingIdentityKeyError';
        this.message = "The identity of the destination has changed. This may be malicious, or the destination may have simply reinstalled TextSecure.";
    }
    OutgoingIdentityKeyError.prototype = new ReplayableError();
    OutgoingIdentityKeyError.prototype.constructor = OutgoingIdentityKeyError;

    window.textsecure.IncomingIdentityKeyError = IncomingIdentityKeyError;
    window.textsecure.OutgoingIdentityKeyError = OutgoingIdentityKeyError;
    window.textsecure.ReplayableError = ReplayableError;

})();

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
    "use strict";

    window.StringView = {

      /*
      * These functions from the Mozilla Developer Network
      * and have been placed in the public domain.
      * https://developer.mozilla.org/en-US/docs/Web/API/WindowBase64/Base64_encoding_and_decoding
      * https://developer.mozilla.org/en-US/docs/MDN/About#Copyrights_and_licenses
      */

      b64ToUint6: function(nChr) {
        return nChr > 64 && nChr < 91 ?
            nChr - 65
          : nChr > 96 && nChr < 123 ?
            nChr - 71
          : nChr > 47 && nChr < 58 ?
            nChr + 4
          : nChr === 43 ?
            62
          : nChr === 47 ?
            63
          :
            0;
      },

      base64ToBytes: function(sBase64, nBlocksSize) {
        var
          sB64Enc = sBase64.replace(/[^A-Za-z0-9\+\/]/g, ""), nInLen = sB64Enc.length,
          nOutLen = nBlocksSize ? Math.ceil((nInLen * 3 + 1 >> 2) / nBlocksSize) * nBlocksSize : nInLen * 3 + 1 >> 2;
        var aBBytes = new ArrayBuffer(nOutLen);
        var taBytes = new Uint8Array(aBBytes);

        for (var nMod3, nMod4, nUint24 = 0, nOutIdx = 0, nInIdx = 0; nInIdx < nInLen; nInIdx++) {
          nMod4 = nInIdx & 3;
          nUint24 |= StringView.b64ToUint6(sB64Enc.charCodeAt(nInIdx)) << 18 - 6 * nMod4;
          if (nMod4 === 3 || nInLen - nInIdx === 1) {
            for (nMod3 = 0; nMod3 < 3 && nOutIdx < nOutLen; nMod3++, nOutIdx++) {
              taBytes[nOutIdx] = nUint24 >>> (16 >>> nMod3 & 24) & 255;
            }
            nUint24 = 0;
          }
        }
        return aBBytes;
      },

      uint6ToB64: function(nUint6) {
        return nUint6 < 26 ?
            nUint6 + 65
          : nUint6 < 52 ?
            nUint6 + 71
          : nUint6 < 62 ?
            nUint6 - 4
          : nUint6 === 62 ?
            43
          : nUint6 === 63 ?
            47
          :
            65;
      },

      bytesToBase64: function(aBytes) {
        var nMod3, sB64Enc = "";
        for (var nLen = aBytes.length, nUint24 = 0, nIdx = 0; nIdx < nLen; nIdx++) {
          nMod3 = nIdx % 3;
          if (nIdx > 0 && (nIdx * 4 / 3) % 76 === 0) { sB64Enc += "\r\n"; }
          nUint24 |= aBytes[nIdx] << (16 >>> nMod3 & 24);
          if (nMod3 === 2 || aBytes.length - nIdx === 1) {
            sB64Enc += String.fromCharCode(
                            StringView.uint6ToB64(nUint24 >>> 18 & 63),
                            StringView.uint6ToB64(nUint24 >>> 12 & 63),
                            StringView.uint6ToB64(nUint24 >>> 6 & 63),
                            StringView.uint6ToB64(nUint24 & 63)
                      );
            nUint24 = 0;
          }
        }
        return sB64Enc.replace(/A(?=A$|$)/g, "=");
      }
    };
}());

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

'use strict';

;(function() {

    /************************************************
    *** Utilities to store data in local storage ***
    ************************************************/
    window.textsecure = window.textsecure || {};
    window.textsecure.storage = window.textsecure.storage || {};

    window.textsecure.storage = {

        /*****************************
        *** Base Storage Routines ***
        *****************************/
        putEncrypted: function(key, value) {
            //TODO
            if (value === undefined)
                throw new Error("Tried to store undefined");
            localStorage.setItem("e" + key, textsecure.utils.jsonThing(value));
        },

        getEncrypted: function(key, defaultValue) {
            //TODO
            var value = localStorage.getItem("e" + key);
            if (value === null)
                return defaultValue;
            return JSON.parse(value);
        },

        removeEncrypted: function(key) {
            localStorage.removeItem("e" + key);
        },

        putUnencrypted: function(key, value) {
            if (value === undefined)
                throw new Error("Tried to store undefined");
            localStorage.setItem("u" + key, textsecure.utils.jsonThing(value));
        },

        getUnencrypted: function(key, defaultValue) {
            var value = localStorage.getItem("u" + key);
            if (value === null)
                return defaultValue;
            return JSON.parse(value);
        },

        removeUnencrypted: function(key) {
            localStorage.removeItem("u" + key);
        }
    };
})();


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

'use strict';

;(function() {
    /**********************
    *** Device Storage ***
    **********************/
    window.textsecure = window.textsecure || {};
    window.textsecure.storage = window.textsecure.storage || {};

    window.textsecure.storage.devices = {
        saveDeviceObject: function(deviceObject) {
            return internalSaveDeviceObject(deviceObject, false);
        },

        saveKeysToDeviceObject: function(deviceObject) {
            return internalSaveDeviceObject(deviceObject, true);
        },

        getDeviceObjectsForNumber: function(number) {
            var map = textsecure.storage.getEncrypted("devices" + number);
            return map === undefined ? [] : map.devices;
        },

        getDeviceObject: function(encodedNumber) {
            var number = textsecure.utils.unencodeNumber(encodedNumber);
            var devices = textsecure.storage.devices.getDeviceObjectsForNumber(number[0]);
            if (devices === undefined)
                return undefined;

            for (var i in devices)
                if (devices[i].encodedNumber == encodedNumber)
                    return devices[i];

            return undefined;
        },

        removeDeviceIdsForNumber: function(number, deviceIdsToRemove) {
            var map = textsecure.storage.getEncrypted("devices" + number);
            if (map === undefined)
                throw new Error("Tried to remove device for unknown number");

            var newDevices = [];
            var devicesRemoved = 0;
            for (var i in map.devices) {
                var keep = true;
                for (var j in deviceIdsToRemove)
                    if (map.devices[i].encodedNumber == number + "." + deviceIdsToRemove[j])
                        keep = false;

                if (keep)
                    newDevices.push(map.devices[i]);
                else
                    devicesRemoved++;
            }

            if (devicesRemoved != deviceIdsToRemove.length)
                throw new Error("Tried to remove unknown device");
        }
    };

    var internalSaveDeviceObject = function(deviceObject, onlyKeys) {
        if (deviceObject.identityKey === undefined || deviceObject.encodedNumber === undefined)
            throw new Error("Tried to store invalid deviceObject");

        var number = textsecure.utils.unencodeNumber(deviceObject.encodedNumber)[0];
        var map = textsecure.storage.getEncrypted("devices" + number);

        if (map === undefined)
            map = { devices: [deviceObject], identityKey: deviceObject.identityKey };
        else if (map.identityKey != getString(deviceObject.identityKey))
            throw new Error("Identity key changed");
        else {
            var updated = false;
            for (var i in map.devices) {
                if (map.devices[i].encodedNumber == deviceObject.encodedNumber) {
                    if (!onlyKeys)
                        map.devices[i] = deviceObject;
                    else {
                        map.devices[i].preKey = deviceObject.preKey;
                        map.devices[i].preKeyId = deviceObject.preKeyId;
                        map.devices[i].signedKey = deviceObject.signedKey;
                        map.devices[i].signedKeyId = deviceObject.signedKeyId;
                        map.devices[i].registrationId = deviceObject.registrationId;
                    }
                    updated = true;
                }
            }

            if (!updated)
                map.devices.push(deviceObject);
        }

        textsecure.storage.putEncrypted("devices" + number, map);
    };
})();

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

'use strict';

;(function() {
    /*********************
     *** Group Storage ***
     *********************/
    window.textsecure = window.textsecure || {};
    window.textsecure.storage = window.textsecure.storage || {};

    window.textsecure.storage.groups = {
        getGroupListForNumber: function(number) {
            return textsecure.storage.getEncrypted("groupMembership" + number, []);
        },

        createNewGroup: function(numbers, groupId) {
            if (groupId !== undefined && textsecure.storage.getEncrypted("group" + groupId) !== undefined) {
                throw new Error("Tried to recreate group");
            }

            while (groupId === undefined || textsecure.storage.getEncrypted("group" + groupId) !== undefined) {
                groupId = getString(textsecure.crypto.getRandomBytes(16));
            }

            var me = textsecure.utils.unencodeNumber(textsecure.storage.getUnencrypted("number_id"))[0];
            var haveMe = false;
            var finalNumbers = [];
            for (var i in numbers) {
                var number = numbers[i];
                if (!textsecure.utils.isNumberSane(number))
                    throw new Error("Invalid number in group");
                if (number == me)
                    haveMe = true;
                if (finalNumbers.indexOf(number) < 0) {
                    finalNumbers.push(number);
                    addGroupToNumber(groupId, number);
                }
            }

            if (!haveMe)
                finalNumbers.push(me);

            textsecure.storage.putEncrypted("group" + groupId, {numbers: finalNumbers});

            return {id: groupId, numbers: finalNumbers};
        },

        getNumbers: function(groupId) {
            var group = textsecure.storage.getEncrypted("group" + groupId);
            if (group === undefined)
                return undefined;

            return group.numbers;
        },

        removeNumber: function(groupId, number) {
            var group = textsecure.storage.getEncrypted("group" + groupId);
            if (group === undefined)
                return undefined;

            var me = textsecure.utils.unencodeNumber(textsecure.storage.getUnencrypted("number_id"))[0];
            if (number == me)
                throw new Error("Cannot remove ourselves from a group, leave the group instead");

            var i = group.numbers.indexOf(number);
            if (i > -1) {
                group.numbers.slice(i, 1);
                textsecure.storage.putEncrypted("group" + groupId, group);
                removeGroupFromNumber(groupId, number);
            }

            return group.numbers;
        },

        addNumbers: function(groupId, numbers) {
            var group = textsecure.storage.getEncrypted("group" + groupId);
            if (group === undefined)
                return undefined;

            for (var i in numbers) {
                var number = numbers[i];
                if (!textsecure.utils.isNumberSane(number))
                    throw new Error("Invalid number in set to add to group");
                if (group.numbers.indexOf(number) < 0) {
                    group.numbers.push(number);
                    addGroupToNumber(groupId, number);
                }
            }

            textsecure.storage.putEncrypted("group" + groupId, group);
            return group.numbers;
        },

        deleteGroup: function(groupId) {
            textsecure.storage.removeEncrypted("group" + groupId);
        },

        getGroup: function(groupId) {
            var group = textsecure.storage.getEncrypted("group" + groupId);
            if (group === undefined)
                return undefined;

            return { id: groupId, numbers: group.numbers }; //TODO: avatar/name tracking
        }
    };

    var addGroupToNumber = function(groupId, number) {
        var membership = textsecure.storage.getEncrypted("groupMembership" + number, [groupId]);
        if (membership.indexOf(groupId) < 0)
            membership.push(groupId);
        textsecure.storage.putEncrypted("groupMembership" + number, membership);
    }

    var removeGroupFromNumber = function(groupId, number) {
        var membership = textsecure.storage.getEncrypted("groupMembership" + number, [groupId]);
        membership = membership.filter(function(group) { return group != groupId; });
        if (membership.length == 0)
            textsecure.storage.removeEncrypted("groupMembership" + number);
        else
            textsecure.storage.putEncrypted("groupMembership" + number, membership);
    }

})();

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

window.textsecure = window.textsecure || {};

window.textsecure.api = function () {
    'use strict';

    var self = {};

    /************************************************
     *** Utilities to communicate with the server ***
     ************************************************/
    // Staging server
    var URL_BASE    = "https://textsecure-service-staging.whispersystems.org";
    self.relay      = "textsecure-service-staging.whispersystems.org";
    var ATTACHMENT_HOST = "whispersystems-textsecure-attachments-staging.s3.amazonaws.com";

    // This is the real server
    //var URL_BASE  = "https://textsecure-service.whispersystems.org";

    var URL_CALLS = {};
    URL_CALLS.accounts   = "/v1/accounts";
    URL_CALLS.devices    = "/v1/devices";
    URL_CALLS.keys       = "/v2/keys";
    URL_CALLS.push       = "/v1/websocket";
    URL_CALLS.temp_push  = "/v1/temp_websocket";
    URL_CALLS.messages   = "/v1/messages";
    URL_CALLS.attachment = "/v1/attachments";

    /**
        * REQUIRED PARAMS:
        *   call:               URL_CALLS entry
        *   httpType:           POST/GET/PUT/etc
        * OPTIONAL PARAMS:
        *   success_callback:   function(response object) called on success
        *   error_callback:     function(http status code = -1 or != 200) called on failure
        *   urlParameters:      crap appended to the url (probably including a leading /)
        *   user:               user name to be sent in a basic auth header
        *   password:           password to be sent in a basic auth headerA
        *   do_auth:            alternative to user/password where user/password are figured out automagically
        *   jsonData:           JSON data sent in the request body
        */
    var doAjax = function (param) {
        if (param.urlParameters === undefined) {
            param.urlParameters = "";
        }

        if (param.do_auth) {
            param.user      = textsecure.storage.getUnencrypted("number_id");
            param.password  = textsecure.storage.getEncrypted("password");
        }

        return new Promise(function (resolve, reject) {
            $.ajax(URL_BASE + URL_CALLS[param.call] + param.urlParameters, {
                type        : param.httpType,
                data        : param.jsonData && textsecure.utils.jsonThing(param.jsonData),
                contentType : 'application/json; charset=utf-8',
                dataType    : 'json',

                beforeSend  : function (xhr) {
                                if (param.user       !== undefined &&
                                    param.password !== undefined)
                                        xhr.setRequestHeader("Authorization", "Basic " + btoa(getString(param.user) + ":" + getString(param.password)));
                                },

                success     : function(response, textStatus, jqXHR) {
                                    resolve(response);
                                },

                error       : function(jqXHR, textStatus, errorThrown) {
                    var code = jqXHR.status;
                    if (code === 200) {
                        // happens sometimes when we get no response
                        // (TODO: Fix server to return 204? instead)
                        resolve(null);
                        return;
                    }
                    if (code > 999 || code < 100)
                        code = -1;
                    try {
                        switch (code) {
                        case -1:
                            textsecure.throwHumanError(code, "HTTPError",
                                "Failed to connect to the server, please check your network connection.");
                        case 413:
                            textsecure.throwHumanError(code, "HTTPError",
                                "Rate limit exceeded, please try again later.");
                        case 403:
                            textsecure.throwHumanError(code, "HTTPError",
                                "Invalid code, please try again.");
                        case 417:
                            // TODO: This shouldn't be a thing?, but its in the API doc?
                            textsecure.throwHumanError(code, "HTTPError",
                                "Number already registered.");
                        case 401:
                            textsecure.throwHumanError(code, "HTTPError",
                                "Invalid authentication, most likely someone re-registered and invalidated our registration.");
                        case 404:
                            textsecure.throwHumanError(code, "HTTPError",
                                "Number is not registered with TextSecure.");
                        default:
                            textsecure.throwHumanError(code, "HTTPError",
                                "The server rejected our query, please file a bug report.");
                        }
                    } catch (e) {
                        if (jqXHR.responseJSON)
                            e.response = jqXHR.responseJSON;
                        reject(e);
                    }
                }
            });
        });
    };

    function requestVerificationCode(number, transport) {
        return doAjax({
            call                : 'accounts',
            httpType            : 'GET',
            urlParameters       : '/' + transport + '/code/' + number,
        });
    };
    self.requestVerificationSMS = function(number) {
        return requestVerificationCode(number, 'sms');
    };
    self.requestVerificationVoice = function(number) {
        return requestVerificationCode(number, 'voice');
    };

    self.confirmCode = function(number, code, password,
                                signaling_key, registrationId, single_device) {
            var call = single_device ? 'accounts' : 'devices';
            var urlPrefix = single_device ? '/code/' : '/';

            return doAjax({
                call                : call,
                httpType            : 'PUT',
                urlParameters       : urlPrefix + code,
                user                : number,
                password            : password,
                jsonData            : { signalingKey        : btoa(getString(signaling_key)),
                                            supportsSms     : false,
                                            fetchesMessages : true,
                                            registrationId  : registrationId}
            });
    };

    self.registerKeys = function(genKeys) {
        var keys = {};
        keys.identityKey = btoa(getString(genKeys.identityKey));
        keys.signedPreKey = {keyId: genKeys.signedPreKey.keyId, publicKey: btoa(getString(genKeys.signedPreKey.publicKey)),
                            signature: btoa(getString(genKeys.signedPreKey.signature))};

        keys.preKeys = [];
        var j = 0;
        for (var i in genKeys.preKeys)
            keys.preKeys[j++] = {keyId: i, publicKey: btoa(getString(genKeys.preKeys[i].publicKey))};

        //TODO: This is just to make the server happy (v2 clients should choke on publicKey),
        // it needs removed before release
        keys.lastResortKey = {keyId: 0x7fffFFFF, publicKey: btoa("42")};

        return doAjax({
            call                : 'keys',
            httpType            : 'PUT',
            do_auth             : true,
            jsonData            : keys,
        });
    };

    self.getKeysForNumber = function(number, deviceId) {
        if (deviceId === undefined)
            deviceId = "*";

        return doAjax({
            call                : 'keys',
            httpType            : 'GET',
            do_auth             : true,
            urlParameters       : "/" + number + "/" + deviceId,
        }).then(function(res) {
            var promises = [];
            res.identityKey = StringView.base64ToBytes(res.identityKey);
            for (var i = 0; i < res.devices.length; i++) {
                res.devices[i].signedPreKey.publicKey = StringView.base64ToBytes(res.devices[i].signedPreKey.publicKey);
                res.devices[i].signedPreKey.signature = StringView.base64ToBytes(res.devices[i].signedPreKey.signature);
                promises[i] = window.textsecure.crypto.Ed25519Verify(res.identityKey, res.devices[i].signedPreKey.publicKey, res.devices[i].signedPreKey.signature);
                res.devices[i].preKey.publicKey = StringView.base64ToBytes(res.devices[i].preKey.publicKey);
                //TODO: Is this still needed?
                //if (res.devices[i].keyId === undefined)
                //  res.devices[i].keyId = 0;
            }
            return Promise.all(promises).then(function() {
                return res;
            });
        });
    };

    self.sendMessages = function(destination, messageArray) {
        //TODO: Do this conversion somewhere else?
        for (var i = 0; i < messageArray.length; i++)
            messageArray[i].body = btoa(messageArray[i].body);
        var jsonData = { messages: messageArray };
        if (messageArray[0].relay !== undefined)
            jsonData.relay = messageArray[0].relay;
        jsonData.timestamp = messageArray[0].timestamp;

        return doAjax({
            call                : 'messages',
            httpType            : 'PUT',
            urlParameters       : '/' + destination,
            do_auth             : true,
            jsonData            : jsonData,
        });
    };

    self.getAttachment = function(id) {
        return doAjax({
            call                : 'attachment',
            httpType            : 'GET',
            urlParameters       : '/' + id,
            do_auth             : true,
        }).then(function(response) {
            return new Promise(function(resolve, reject) {
                $.ajax(response.location, {
                    type        : "GET",
                    xhrFields: {
                        responseType: "arraybuffer"
                    },
                    headers: {
                        "Content-Type": "application/octet-stream"
                    },

                    success     : function(response, textStatus, jqXHR) {
                                        resolve(response);
                                    },

                    error       : function(jqXHR, textStatus, errorThrown) {
                                        var code = jqXHR.status;
                                        if (code > 999 || code < 100)
                                            code = -1;

                                        var e = new Error(code);
                                        e.name = "HTTPError";
                                        if (jqXHR.responseJSON)
                                            e.response = jqXHR.responseJSON;
                                        reject(e);
                                    }
                });
            });
        });
    };

    var id_regex = RegExp( "^https:\/\/" + ATTACHMENT_HOST + "\/(\\d+)\?");
    self.putAttachment = function(encryptedBin) {
        return doAjax({
            call     : 'attachment',
            httpType : 'GET',
            do_auth  : true,
        }).then(function(response) {
            return new Promise(function(resolve, reject) {
                $.ajax(response.location, {
                    type        : "PUT",
                    headers     : {"Content-Type" : "application/octet-stream"},
                    data        : encryptedBin,
                    processData : false,
                    success     : function() {
                        try {
                            // Parse the id as a string from the location url
                            // (workaround for ids too large for Javascript numbers)
                            var id = response.location.match(id_regex)[1];
                            resolve(id);
                        } catch(e) {
                            reject(e);
                        }
                    },
                    error   : function(jqXHR, textStatus, errorThrown) {
                        var code = jqXHR.status;
                        if (code > 999 || code < 100)
                            code = -1;

                        var e = new Error(code);
                        e.name = "HTTPError";
                        if (jqXHR.responseJSON)
                            e.response = jqXHR.responseJSON;
                        reject(e);
                    }
                });
            });
        });
    };

    var getWebsocket = function(url, auth, reconnectTimeout) {
        var URL = URL_BASE.replace(/^http/g, 'ws') + url + '/?';
        var params = '';
        if (auth) {
            var user = textsecure.storage.getUnencrypted("number_id");
            var password = textsecure.storage.getEncrypted("password");
            var params = $.param({
                login: '+' + user.substring(1),
                password: password
            });
        }
        return window.textsecure.websocket(URL+params)
    }

    self.getMessageWebsocket = function() {
        return getWebsocket(URL_CALLS['push'], true, 1000);
    }

    self.getTempWebsocket = function() {
        //XXX
        var socketWrapper = { onmessage: function() {}, ondisconnect: function() {}, onconnect: function() {} };
        setTimeout(function() {
            socketWrapper.onmessage({uuid: "404-42-magic"});
        }, 1000);
        return socketWrapper;
        //return getWebsocket(URL_CALLS['temp_push'], false, 5000);
    }

    return self;
}();

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
    window.textsecure = window.textsecure || {};

    /*
     *  textsecure.crypto
     *    glues together various implementations into a single interface
     *    for all low-level crypto operations,
     */

    function curve25519() {
        // use native client opportunistically, since it's faster
        return textsecure.nativeclient || window.curve25519;
    }

    window.textsecure.crypto = {
        getRandomBytes: function(size) {
            // At some point we might consider XORing in hashes of random
            // UI events to strengthen ourselves against RNG flaws in crypto.getRandomValues
            // ie maybe take a look at how Gibson does it at https://www.grc.com/r&d/js.htm
            var array = new Uint8Array(size);
            window.crypto.getRandomValues(array);
            return array.buffer;
        },
        encrypt: function(key, data, iv) {
            return window.crypto.subtle.importKey('raw', key, {name: 'AES-CBC'}, false, ['encrypt']).then(function(key) {
                return window.crypto.subtle.encrypt({name: 'AES-CBC', iv: new Uint8Array(iv)}, key, data);
            });
        },
        decrypt: function(key, data, iv) {
            return window.crypto.subtle.importKey('raw', key, {name: 'AES-CBC'}, false, ['decrypt']).then(function(key) {
                return window.crypto.subtle.decrypt({name: 'AES-CBC', iv: new Uint8Array(iv)}, key, data);
            });
        },
        sign: function(key, data) {
            return window.crypto.subtle.importKey('raw', key, {name: 'HMAC', hash: {name: 'SHA-256'}}, false, ['sign']).then(function(key) {
                return window.crypto.subtle.sign( {name: 'HMAC', hash: 'SHA-256'}, key, data);
            });
        },

        HKDF: function(input, salt, info) {
            // Specific implementation of RFC 5869 that only returns the first 3 32-byte chunks
            // TODO: We dont always need the third chunk, we might skip it
            return window.textsecure.crypto.sign(salt, input).then(function(PRK) {
                var infoBuffer = new ArrayBuffer(info.byteLength + 1 + 32);
                var infoArray = new Uint8Array(infoBuffer);
                infoArray.set(new Uint8Array(info), 32);
                infoArray[infoArray.length - 1] = 1;
                return window.textsecure.crypto.sign(PRK, infoBuffer.slice(32)).then(function(T1) {
                    infoArray.set(new Uint8Array(T1));
                    infoArray[infoArray.length - 1] = 2;
                    return window.textsecure.crypto.sign(PRK, infoBuffer).then(function(T2) {
                        infoArray.set(new Uint8Array(T2));
                        infoArray[infoArray.length - 1] = 3;
                        return window.textsecure.crypto.sign(PRK, infoBuffer).then(function(T3) {
                            return [ T1, T2, T3 ];
                        });
                    });
                });
            });
        },

        // Curve 25519 crypto
        createKeyPair: function(privKey) {
            if (privKey === undefined) {
                privKey = textsecure.crypto.getRandomBytes(32);
            }
            if (privKey.byteLength != 32) {
                throw new Error("Invalid private key");
            }

            return curve25519().keyPair(privKey).then(function(raw_keys) {
                // prepend version byte
                var origPub = new Uint8Array(raw_keys.pubKey);
                var pub = new Uint8Array(33);
                pub.set(origPub, 1);
                pub[0] = 5;

                return { pubKey: pub.buffer, privKey: raw_keys.privKey };
            });
        },
        ECDHE: function(pubKey, privKey) {
            pubKey = validatePubKeyFormat(pubKey);
            if (privKey === undefined || privKey.byteLength != 32)
                throw new Error("Invalid private key");

            if (pubKey === undefined || pubKey.byteLength != 32)
                throw new Error("Invalid public key");

            return curve25519().sharedSecret(pubKey, privKey);
        },
        Ed25519Sign: function(privKey, message) {
            if (privKey === undefined || privKey.byteLength != 32)
                throw new Error("Invalid private key");

            if (message === undefined)
                throw new Error("Invalid message");

            return curve25519().sign(privKey, message);
        },
        Ed25519Verify: function(pubKey, msg, sig) {
            pubKey = validatePubKeyFormat(pubKey);

            if (pubKey === undefined || pubKey.byteLength != 32)
                throw new Error("Invalid public key");

            if (msg === undefined)
                throw new Error("Invalid message");

            if (sig === undefined || sig.byteLength != 64)
                throw new Error("Invalid signature");

            return curve25519().verify(pubKey, msg, sig);
        }
    };

    var validatePubKeyFormat = function(pubKey) {
        if (pubKey === undefined || ((pubKey.byteLength != 33 || new Uint8Array(pubKey)[0] != 5) && pubKey.byteLength != 32))
            throw new Error("Invalid public key");
        if (pubKey.byteLength == 33) {
            return pubKey.slice(1);
        } else {
            console.error("WARNING: Expected pubkey of length 33, please report the ST and client that generated the pubkey");
            return pubKey;
        }
    };

})();

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
window.textsecure = window.textsecure || {};

window.textsecure.protocol = function() {
    var self = {};

    /******************************
    *** Random constants/utils ***
    ******************************/
    // We consider messages lost after a week and might throw away keys at that point
    // (also the time between signedPreKey regenerations)
    var MESSAGE_LOST_THRESHOLD_MS = 1000*60*60*24*7;

    function objectContainsKeys(object) {
        var count = 0;
        for (var key in object) {
            count++;
            break;
        }
        return count != 0;
    }

    /***************************
    *** Key/session storage ***
    ***************************/
    var crypto_storage = {};

    crypto_storage.putKeyPair = function(keyName, keyPair) {
        textsecure.storage.putEncrypted("25519Key" + keyName, keyPair);
    }

    crypto_storage.getNewStoredKeyPair = function(keyName) {
        return textsecure.crypto.createKeyPair().then(function(keyPair) {
            crypto_storage.putKeyPair(keyName, keyPair);
            return keyPair;
        });
    }

    crypto_storage.getStoredKeyPair = function(keyName) {
        var res = textsecure.storage.getEncrypted("25519Key" + keyName);
        if (res === undefined)
            return undefined;
        return { pubKey: toArrayBuffer(res.pubKey), privKey: toArrayBuffer(res.privKey) };
    }

    crypto_storage.removeStoredKeyPair = function(keyName) {
        textsecure.storage.removeEncrypted("25519Key" + keyName);
    }

    crypto_storage.getIdentityKey = function() {
        return this.getStoredKeyPair("identityKey");
    }

    crypto_storage.saveSession = function(encodedNumber, session, registrationId) {
        var device = textsecure.storage.devices.getDeviceObject(encodedNumber);
        if (device === undefined)
            device = { sessions: {}, encodedNumber: encodedNumber };

        if (registrationId !== undefined)
            device.registrationId = registrationId;

        crypto_storage.saveSessionAndDevice(device, session);
    }

    crypto_storage.saveSessionAndDevice = function(device, session) {
        if (device.sessions === undefined)
            device.sessions = {};
        var sessions = device.sessions;

        var doDeleteSession = false;
        if (session.indexInfo.closed == -1 || device.identityKey === undefined)
            device.identityKey = session.indexInfo.remoteIdentityKey;

        if (session.indexInfo.closed != -1) {
            doDeleteSession = (session.indexInfo.closed < (new Date().getTime() - MESSAGE_LOST_THRESHOLD_MS));

            if (!doDeleteSession) {
                var keysLeft = false;
                for (var key in session) {
                    if (key != "indexInfo" && key != "oldRatchetList" && key != "currentRatchet") {
                        keysLeft = true;
                        break;
                    }
                }
                doDeleteSession = !keysLeft;
                console.log((doDeleteSession ? "Deleting " : "Not deleting ") + "closed session which has not yet timed out");
            } else
                console.log("Deleting closed session due to timeout (created at " + session.indexInfo.closed + ")");
        }

        if (doDeleteSession)
            delete sessions[getString(session.indexInfo.baseKey)];
        else
            sessions[getString(session.indexInfo.baseKey)] = session;

        var openSessionRemaining = false;
        for (var key in sessions)
            if (sessions[key].indexInfo.closed == -1)
                openSessionRemaining = true;
        if (!openSessionRemaining)
            try {
                delete device['registrationId'];
            } catch(_) {}

        textsecure.storage.devices.saveDeviceObject(device);
    }

    var getSessions = function(encodedNumber) {
        var device = textsecure.storage.devices.getDeviceObject(encodedNumber);
        if (device === undefined || device.sessions === undefined)
            return undefined;
        return device.sessions;
    }

    crypto_storage.getOpenSession = function(encodedNumber) {
        var sessions = getSessions(encodedNumber);
        if (sessions === undefined)
            return undefined;

        for (var key in sessions)
            if (sessions[key].indexInfo.closed == -1)
                return sessions[key];
        return undefined;
    }

    crypto_storage.getSessionByRemoteEphemeralKey = function(encodedNumber, remoteEphemeralKey) {
        var sessions = getSessions(encodedNumber);
        if (sessions === undefined)
            return undefined;

        var searchKey = getString(remoteEphemeralKey);

        var openSession = undefined;
        for (var key in sessions) {
            if (sessions[key].indexInfo.closed == -1) {
                if (openSession !== undefined)
                    throw new Error("Datastore inconsistensy: multiple open sessions for " + encodedNumber);
                openSession = sessions[key];
            }
            if (sessions[key][searchKey] !== undefined)
                return sessions[key];
        }
        if (openSession !== undefined)
            return openSession;

        return undefined;
    }

    crypto_storage.getSessionOrIdentityKeyByBaseKey = function(encodedNumber, baseKey) {
        var sessions = getSessions(encodedNumber);
        var device = textsecure.storage.devices.getDeviceObject(encodedNumber);
        if (device === undefined)
            return undefined;

        var preferredSession = device.sessions && device.sessions[getString(baseKey)];
        if (preferredSession !== undefined)
            return preferredSession;

        if (device.identityKey !== undefined)
            return { indexInfo: { remoteIdentityKey: device.identityKey } };

        throw new Error("Datastore inconsistency: device was stored without identity key");
    }

    /*****************************
    *** Internal Crypto stuff ***
    *****************************/
    var HKDF = function(input, salt, info) {
        // HKDF for TextSecure has a bit of additional handling - salts always end up being 32 bytes
        if (salt == '')
            salt = new ArrayBuffer(32);
        if (salt.byteLength != 32)
            throw new Error("Got salt of incorrect length");

        info = toArrayBuffer(info); // TODO: maybe convert calls?

        return textsecure.crypto.HKDF(input, salt, info);
    }

    var verifyMAC = function(data, key, mac) {
        return textsecure.crypto.sign(key, data).then(function(calculated_mac) {
            if (!isEqual(calculated_mac, mac, true))
                throw new Error("Bad MAC");
        });
    }

    /******************************
    *** Ratchet implementation ***
    ******************************/
    var calculateRatchet = function(session, remoteKey, sending) {
        var ratchet = session.currentRatchet;

        return textsecure.crypto.ECDHE(remoteKey, toArrayBuffer(ratchet.ephemeralKeyPair.privKey)).then(function(sharedSecret) {
            return HKDF(sharedSecret, toArrayBuffer(ratchet.rootKey), "WhisperRatchet").then(function(masterKey) {
                if (sending)
                    session[getString(ratchet.ephemeralKeyPair.pubKey)] = { messageKeys: {}, chainKey: { counter: -1, key: masterKey[1] } };
                else
                    session[getString(remoteKey)]                       = { messageKeys: {}, chainKey: { counter: -1, key: masterKey[1] } };
                ratchet.rootKey = masterKey[0];
            });
        });
    }

    var initSession = function(isInitiator, ourEphemeralKey, ourSignedKey, encodedNumber, theirIdentityPubKey, theirEphemeralPubKey, theirSignedPubKey) {
        var ourIdentityKey = crypto_storage.getIdentityKey();

        if (isInitiator) {
            if (ourSignedKey !== undefined)
                throw new Error("Invalid call to initSession");
            ourSignedKey = ourEphemeralKey;
        } else {
            if (theirSignedPubKey !== undefined)
                throw new Error("Invalid call to initSession");
            theirSignedPubKey = theirEphemeralPubKey;
        }

        var sharedSecret;
        if (ourEphemeralKey === undefined || theirEphemeralPubKey === undefined)
            sharedSecret = new Uint8Array(32 * 4);
        else
            sharedSecret = new Uint8Array(32 * 5);

        for (var i = 0; i < 32; i++)
            sharedSecret[i] = 0xff;

        return textsecure.crypto.ECDHE(theirSignedPubKey, ourIdentityKey.privKey).then(function(ecRes1) {
            function finishInit() {
                return textsecure.crypto.ECDHE(theirSignedPubKey, ourSignedKey.privKey).then(function(ecRes) {
                    sharedSecret.set(new Uint8Array(ecRes), 32 * 3);

                    return HKDF(sharedSecret.buffer, '', "WhisperText").then(function(masterKey) {
                        var session = {currentRatchet: { rootKey: masterKey[0], lastRemoteEphemeralKey: theirSignedPubKey, previousCounter: 0 },
                                        indexInfo: { remoteIdentityKey: theirIdentityPubKey, closed: -1 },
                                        oldRatchetList: []
                                    };
                        if (!isInitiator)
                            session.indexInfo.baseKey = theirEphemeralPubKey;
                        else
                            session.indexInfo.baseKey = ourEphemeralKey.pubKey;

                        // If we're initiating we go ahead and set our first sending ephemeral key now,
                        // otherwise we figure it out when we first maybeStepRatchet with the remote's ephemeral key
                        if (isInitiator) {
                            return textsecure.crypto.createKeyPair().then(function(ourSendingEphemeralKey) {
                                session.currentRatchet.ephemeralKeyPair = ourSendingEphemeralKey;
                                return calculateRatchet(session, theirSignedPubKey, true).then(function() {
                                    return session;
                                });
                            });
                        } else {
                            session.currentRatchet.ephemeralKeyPair = ourSignedKey;
                            return session;
                        }
                    });
                });
            }

            var promise;
            if (ourEphemeralKey === undefined || theirEphemeralPubKey === undefined)
                promise = Promise.resolve(new ArrayBuffer(0));
            else
                promise = textsecure.crypto.ECDHE(theirEphemeralPubKey, ourEphemeralKey.privKey);
            return promise.then(function(ecRes4) {
                sharedSecret.set(new Uint8Array(ecRes4), 32 * 4);

                if (isInitiator)
                    return textsecure.crypto.ECDHE(theirIdentityPubKey, ourSignedKey.privKey).then(function(ecRes2) {
                        sharedSecret.set(new Uint8Array(ecRes1), 32);
                        sharedSecret.set(new Uint8Array(ecRes2), 32 * 2);
                    }).then(finishInit);
                else
                    return textsecure.crypto.ECDHE(theirIdentityPubKey, ourSignedKey.privKey).then(function(ecRes2) {
                        sharedSecret.set(new Uint8Array(ecRes1), 32 * 2);
                        sharedSecret.set(new Uint8Array(ecRes2), 32)
                    }).then(finishInit);
            });
        });
    }

    var removeOldChains = function(session) {
        // Sending ratchets are always removed when we step because we never need them again
        // Receiving ratchets are either removed if we step with all keys used up to previousCounter
        // and are otherwise added to the oldRatchetList, which we parse here and remove ratchets
        // older than a week (we assume the message was lost and move on with our lives at that point)
        var newList = [];
        for (var i = 0; i < session.oldRatchetList.length; i++) {
            var entry = session.oldRatchetList[i];
            var ratchet = getString(entry.ephemeralKey);
            console.log("Checking old chain with added time " + (entry.added/1000));
            if ((!objectContainsKeys(session[ratchet].messageKeys) && (session[ratchet].chainKey === undefined || session[ratchet].chainKey.key === undefined))
                    || entry.added < new Date().getTime() - MESSAGE_LOST_THRESHOLD_MS) {
                delete session[ratchet];
                console.log("...deleted");
            } else
                newList[newList.length] = entry;
        }
        session.oldRatchetList = newList;
    }

    var closeSession = function(session, sessionClosedByRemote) {
        if (session.indexInfo.closed > -1)
            return;

        // After this has run, we can still receive messages on ratchet chains which
        // were already open (unless we know we dont need them),
        // but we cannot send messages or step the ratchet

        // Delete current sending ratchet
        delete session[getString(session.currentRatchet.ephemeralKeyPair.pubKey)];
        // Move all receive ratchets to the oldRatchetList to mark them for deletion
        for (var i in session) {
            if (session[i].chainKey !== undefined && session[i].chainKey.key !== undefined) {
                if (!sessionClosedByRemote)
                    session.oldRatchetList[session.oldRatchetList.length] = { added: new Date().getTime(), ephemeralKey: i };
                else
                    delete session[i].chainKey.key;
            }
        }
        // Delete current root key and our ephemeral key pair to disallow ratchet stepping
        delete session.currentRatchet['rootKey'];
        delete session.currentRatchet['ephemeralKeyPair'];
        session.indexInfo.closed = new Date().getTime();
        removeOldChains(session);
    }

    self.closeOpenSessionForDevice = function(encodedNumber) {
        var session = crypto_storage.getOpenSession(encodedNumber);
        if (session === undefined)
            return;

        closeSession(session);
        crypto_storage.saveSession(encodedNumber, session);
    }

    var initSessionFromPreKeyWhisperMessage;
    var decryptWhisperMessage;
    var handlePreKeyWhisperMessage = function(from, encodedMessage) {
        var preKeyProto = textsecure.protobuf.PreKeyWhisperMessage.decode(encodedMessage, 'binary');
        return initSessionFromPreKeyWhisperMessage(from, preKeyProto).then(function(sessions) {
            return decryptWhisperMessage(from, getString(preKeyProto.message), sessions[0], preKeyProto.registrationId).then(function(result) {
                if (sessions[1] !== undefined)
                    sessions[1]();
                return result;
            });
        });
    }

    var wipeIdentityAndTryMessageAgain = function(from, encodedMessage, message_id) {
        // Wipe identity key!
        textsecure.storage.removeEncrypted("devices" + from.split('.')[0]);
        return handlePreKeyWhisperMessage(from, encodedMessage).then(
            function(pushMessageContent) {
                extension.trigger('message:decrypted', {
                    message_id : message_id,
                    data       : pushMessageContent
                });
            }
        );
    }
    textsecure.replay.registerFunction(wipeIdentityAndTryMessageAgain, textsecure.replay.Type.INIT_SESSION);

    initSessionFromPreKeyWhisperMessage = function(encodedNumber, message) {
        var preKeyPair = crypto_storage.getStoredKeyPair("preKey" + message.preKeyId);
        var signedPreKeyPair = crypto_storage.getStoredKeyPair("signedKey" + message.signedPreKeyId);

        var session = crypto_storage.getSessionOrIdentityKeyByBaseKey(encodedNumber, toArrayBuffer(message.baseKey));
        var open_session = crypto_storage.getOpenSession(encodedNumber);
        if (signedPreKeyPair === undefined) {
            // Session may or may not be the right one, but if its not, we can't do anything about it
            // ...fall through and let decryptWhisperMessage handle that case
            if (session !== undefined && session.currentRatchet !== undefined)
                return Promise.resolve([session, undefined]);
            else
                throw new Error("Missing Signed PreKey for PreKeyWhisperMessage");
        }
        if (session !== undefined) {
            // Duplicate PreKeyMessage for session:
            if (isEqual(session.indexInfo.baseKey, message.baseKey, false))
                return Promise.resolve([session, undefined]);

            // We already had a session/known identity key:
            if (isEqual(session.indexInfo.remoteIdentityKey, message.identityKey, false)) {
                // If the identity key matches the previous one, close the previous one and use the new one
                if (open_session !== undefined)
                    closeSession(open_session); // To be returned and saved later
            } else {
                // ...otherwise create an error that the UI will pick up and ask the user if they want to re-negotiate
                throw new textsecure.IncomingIdentityKeyError(encodedNumber, getString(message.encode()));
            }
        }
        return initSession(false, preKeyPair, signedPreKeyPair, encodedNumber, toArrayBuffer(message.identityKey), toArrayBuffer(message.baseKey), undefined)
                        .then(function(new_session) {
            // Note that the session is not actually saved until the very end of decryptWhisperMessage
            // ... to ensure that the sender actually holds the private keys for all reported pubkeys
            return [new_session, function() {
                if (open_session !== undefined)
                    crypto_storage.saveSession(encodedNumber, open_session);
                crypto_storage.removeStoredKeyPair("preKey" + message.preKeyId);
            }];
        });;
    }

    var fillMessageKeys = function(chain, counter) {
        if (chain.chainKey.counter + 1000 < counter) //TODO: maybe 1000 is too low/high in some cases?
            return Promise.resolve(); // Stalker, much?

        if (chain.chainKey.counter >= counter)
            return Promise.resolve(); // Already calculated

        if (chain.chainKey.key === undefined)
            throw new Error("Got invalid request to extend chain after it was already closed");

        var key = toArrayBuffer(chain.chainKey.key);
        var byteArray = new Uint8Array(1);
        byteArray[0] = 1;
        return textsecure.crypto.sign(key, byteArray.buffer).then(function(mac) {
            byteArray[0] = 2;
            return textsecure.crypto.sign(key, byteArray.buffer).then(function(key) {
                chain.messageKeys[chain.chainKey.counter + 1] = mac;
                chain.chainKey.key = key
                chain.chainKey.counter += 1;
                return fillMessageKeys(chain, counter);
            });
        });
    }

    var maybeStepRatchet = function(session, remoteKey, previousCounter) {
        if (session[getString(remoteKey)] !== undefined)
            return Promise.resolve();

        var ratchet = session.currentRatchet;

        var finish = function() {
            return calculateRatchet(session, remoteKey, false).then(function() {
                // Now swap the ephemeral key and calculate the new sending chain
                var previousRatchet = getString(ratchet.ephemeralKeyPair.pubKey);
                if (session[previousRatchet] !== undefined) {
                    ratchet.previousCounter = session[previousRatchet].chainKey.counter;
                    delete session[previousRatchet];
                }

                return textsecure.crypto.createKeyPair().then(function(keyPair) {
                    ratchet.ephemeralKeyPair = keyPair;
                    return calculateRatchet(session, remoteKey, true).then(function() {
                        ratchet.lastRemoteEphemeralKey = remoteKey;
                    });
                });
            });
        }

        var previousRatchet = session[getString(ratchet.lastRemoteEphemeralKey)];
        if (previousRatchet !== undefined) {
            return fillMessageKeys(previousRatchet, previousCounter).then(function() {
                delete previousRatchet.chainKey.key;
                if (!objectContainsKeys(previousRatchet.messageKeys))
                    delete session[getString(ratchet.lastRemoteEphemeralKey)];
                else
                    session.oldRatchetList[session.oldRatchetList.length] = { added: new Date().getTime(), ephemeralKey: ratchet.lastRemoteEphemeralKey };
            }).then(finish);
        } else
            return finish();
    }

    // returns decrypted protobuf
    decryptWhisperMessage = function(encodedNumber, messageBytes, session, registrationId) {
        if (messageBytes[0] != String.fromCharCode((3 << 4) | 3))
            throw new Error("Bad version number on WhisperMessage");

        var messageProto = messageBytes.substring(1, messageBytes.length - 8);
        var mac = messageBytes.substring(messageBytes.length - 8, messageBytes.length);

        var message = textsecure.protobuf.WhisperMessage.decode(messageProto, 'binary');
        var remoteEphemeralKey = toArrayBuffer(message.ephemeralKey);

        if (session === undefined) {
            var session = crypto_storage.getSessionByRemoteEphemeralKey(encodedNumber, remoteEphemeralKey);
            if (session === undefined)
                throw new Error("No session found to decrypt message from " + encodedNumber);
        }

        return maybeStepRatchet(session, remoteEphemeralKey, message.previousCounter).then(function() {
            var chain = session[getString(message.ephemeralKey)];

            return fillMessageKeys(chain, message.counter).then(function() {
                return HKDF(toArrayBuffer(chain.messageKeys[message.counter]), '', "WhisperMessageKeys").then(function(keys) {
                    delete chain.messageKeys[message.counter];

                    var messageProtoArray = toArrayBuffer(messageProto);
                    var macInput = new Uint8Array(messageProtoArray.byteLength + 33*2 + 1);
                    macInput.set(new Uint8Array(toArrayBuffer(session.indexInfo.remoteIdentityKey)));
                    macInput.set(new Uint8Array(toArrayBuffer(crypto_storage.getIdentityKey().pubKey)), 33);
                    macInput[33*2] = (3 << 4) | 3;
                    macInput.set(new Uint8Array(messageProtoArray), 33*2 + 1);

                    return verifyMAC(macInput.buffer, keys[1], mac).then(function() {
                        return window.textsecure.crypto.decrypt(keys[0], toArrayBuffer(message.ciphertext), keys[2].slice(0, 16))
                                    .then(function(paddedPlaintext) {

                            paddedPlaintext = new Uint8Array(paddedPlaintext);
                            var plaintext;
                            for (var i = paddedPlaintext.length - 1; i >= 0; i--) {
                                if (paddedPlaintext[i] == 0x80) {
                                    plaintext = new Uint8Array(i);
                                    plaintext.set(paddedPlaintext.subarray(0, i));
                                    plaintext = plaintext.buffer;
                                    break;
                                } else if (paddedPlaintext[i] != 0x00)
                                    throw new Error('Invalid padding');
                            }

                            delete session['pendingPreKey'];

                            var finalMessage = textsecure.protobuf.PushMessageContent.decode(plaintext);

                            if ((finalMessage.flags & textsecure.protobuf.PushMessageContent.Flags.END_SESSION)
                                    == textsecure.protobuf.PushMessageContent.Flags.END_SESSION)
                                closeSession(session, true);

                            removeOldChains(session);

                            crypto_storage.saveSession(encodedNumber, session, registrationId);
                            return finalMessage;
                        });
                    });
                });
            });
        });
    }

    /*************************
    *** Public crypto API ***
    *************************/
    // Decrypts message into a raw string
    self.decryptWebsocketMessage = function(message) {
        var signaling_key = textsecure.storage.getEncrypted("signaling_key"); //TODO: in crypto_storage
        var aes_key = toArrayBuffer(signaling_key.substring(0, 32));
        var mac_key = toArrayBuffer(signaling_key.substring(32, 32 + 20));

        var decodedMessage = message.toArrayBuffer();
        if (new Uint8Array(decodedMessage)[0] != 1)
            throw new Error("Got bad version number: " + decodedMessage[0]);

        var iv = decodedMessage.slice(1, 1 + 16);
        var ciphertext = decodedMessage.slice(1 + 16, decodedMessage.byteLength - 10);
        var ivAndCiphertext = decodedMessage.slice(0, decodedMessage.byteLength - 10);
        var mac = decodedMessage.slice(decodedMessage.byteLength - 10, decodedMessage.byteLength);

        return verifyMAC(ivAndCiphertext, mac_key, mac).then(function() {
            return window.textsecure.crypto.decrypt(aes_key, ciphertext, iv);
        });
    };

    self.decryptAttachment = function(encryptedBin, keys) {
        var aes_key = keys.slice(0, 32);
        var mac_key = keys.slice(32, 64);

        var iv = encryptedBin.slice(0, 16);
        var ciphertext = encryptedBin.slice(16, encryptedBin.byteLength - 32);
        var ivAndCiphertext = encryptedBin.slice(0, encryptedBin.byteLength - 32);
        var mac = encryptedBin.slice(encryptedBin.byteLength - 32, encryptedBin.byteLength);

        return verifyMAC(ivAndCiphertext, mac_key, mac).then(function() {
            return window.textsecure.crypto.decrypt(aes_key, ciphertext, iv);
        });
    };

    self.encryptAttachment = function(plaintext, keys, iv) {
        var aes_key = keys.slice(0, 32);
        var mac_key = keys.slice(32, 64);

        return window.textsecure.crypto.encrypt(aes_key, plaintext, iv).then(function(ciphertext) {
            var ivAndCiphertext = new Uint8Array(16 + ciphertext.byteLength);
            ivAndCiphertext.set(new Uint8Array(iv));
            ivAndCiphertext.set(new Uint8Array(ciphertext), 16);

            return textsecure.crypto.sign(mac_key, ivAndCiphertext.buffer).then(function(mac) {
                var encryptedBin = new Uint8Array(16 + ciphertext.byteLength + 32);
                encryptedBin.set(ivAndCiphertext);
                encryptedBin.set(new Uint8Array(mac), 16 + ciphertext.byteLength);
                return encryptedBin.buffer;
            });
        });
    };

    self.handleIncomingPushMessageProto = function(proto) {
        switch(proto.type) {
        case textsecure.protobuf.IncomingPushMessageSignal.Type.PLAINTEXT:
            return Promise.resolve(textsecure.protobuf.PushMessageContent.decode(proto.message));
        case textsecure.protobuf.IncomingPushMessageSignal.Type.CIPHERTEXT:
            var from = proto.source + "." + (proto.sourceDevice == null ? 0 : proto.sourceDevice);
            return decryptWhisperMessage(from, getString(proto.message));
        case textsecure.protobuf.IncomingPushMessageSignal.Type.PREKEY_BUNDLE:
            if (proto.message.readUint8() != ((3 << 4) | 3))
                throw new Error("Bad version byte");
            var from = proto.source + "." + (proto.sourceDevice == null ? 0 : proto.sourceDevice);
            return handlePreKeyWhisperMessage(from, getString(proto.message));
        case textsecure.protobuf.IncomingPushMessageSignal.Type.RECEIPT:
            return Promise.resolve(null);
        default:
            return new Promise(function(resolve, reject) { reject(new Error("Unknown message type")); });
        }
    }

    // return Promise(encoded [PreKey]WhisperMessage)
    self.encryptMessageFor = function(deviceObject, pushMessageContent) {
        var session = crypto_storage.getOpenSession(deviceObject.encodedNumber);

        var doEncryptPushMessageContent = function() {
            var msg = new textsecure.protobuf.WhisperMessage();
            var plaintext = toArrayBuffer(pushMessageContent.encode());

            var paddedPlaintext = new Uint8Array(Math.ceil((plaintext.byteLength + 1) / 160.0) * 160 - 1);
            paddedPlaintext.set(new Uint8Array(plaintext));
            paddedPlaintext[plaintext.byteLength] = 0x80;

            msg.ephemeralKey = toArrayBuffer(session.currentRatchet.ephemeralKeyPair.pubKey);
            var chain = session[getString(msg.ephemeralKey)];

            return fillMessageKeys(chain, chain.chainKey.counter + 1).then(function() {
                return HKDF(toArrayBuffer(chain.messageKeys[chain.chainKey.counter]), '', "WhisperMessageKeys").then(function(keys) {
                    delete chain.messageKeys[chain.chainKey.counter];
                    msg.counter = chain.chainKey.counter;
                    msg.previousCounter = session.currentRatchet.previousCounter;

                    return window.textsecure.crypto.encrypt(keys[0], paddedPlaintext.buffer, keys[2].slice(0, 16)).then(function(ciphertext) {
                        msg.ciphertext = ciphertext;
                        var encodedMsg = toArrayBuffer(msg.encode());

                        var macInput = new Uint8Array(encodedMsg.byteLength + 33*2 + 1);
                        macInput.set(new Uint8Array(toArrayBuffer(crypto_storage.getIdentityKey().pubKey)));
                        macInput.set(new Uint8Array(toArrayBuffer(session.indexInfo.remoteIdentityKey)), 33);
                        macInput[33*2] = (3 << 4) | 3;
                        macInput.set(new Uint8Array(encodedMsg), 33*2 + 1);

                        return textsecure.crypto.sign(keys[1], macInput.buffer).then(function(mac) {
                            var result = new Uint8Array(encodedMsg.byteLength + 9);
                            result[0] = (3 << 4) | 3;
                            result.set(new Uint8Array(encodedMsg), 1);
                            result.set(new Uint8Array(mac, 0, 8), encodedMsg.byteLength + 1);

                            try {
                                delete deviceObject['signedKey'];
                                delete deviceObject['signedKeyId'];
                                delete deviceObject['preKey'];
                                delete deviceObject['preKeyId'];
                            } catch(_) {}

                            removeOldChains(session);

                            crypto_storage.saveSessionAndDevice(deviceObject, session);
                            return result;
                        });
                    });
                });
            });
        }

        var preKeyMsg = new textsecure.protobuf.PreKeyWhisperMessage();
        preKeyMsg.identityKey = toArrayBuffer(crypto_storage.getIdentityKey().pubKey);
        preKeyMsg.registrationId = textsecure.storage.getUnencrypted("registrationId");

        if (session === undefined) {
            return textsecure.crypto.createKeyPair().then(function(baseKey) {
                preKeyMsg.preKeyId = deviceObject.preKeyId;
                preKeyMsg.signedPreKeyId = deviceObject.signedKeyId;
                preKeyMsg.baseKey = toArrayBuffer(baseKey.pubKey);
                return initSession(true, baseKey, undefined, deviceObject.encodedNumber,
                                    toArrayBuffer(deviceObject.identityKey), toArrayBuffer(deviceObject.preKey), toArrayBuffer(deviceObject.signedKey))
                            .then(function(new_session) {
                    session = new_session;
                    session.pendingPreKey = { preKeyId: deviceObject.preKeyId, signedKeyId: deviceObject.signedKeyId, baseKey: baseKey.pubKey };
                    return doEncryptPushMessageContent().then(function(message) {
                        preKeyMsg.message = message;
                        var result = String.fromCharCode((3 << 4) | 3) + getString(preKeyMsg.encode());
                        return {type: 3, body: result};
                    });
                });
            });
        } else
            return doEncryptPushMessageContent().then(function(message) {
                if (session.pendingPreKey !== undefined) {
                    preKeyMsg.baseKey = toArrayBuffer(session.pendingPreKey.baseKey);
                    preKeyMsg.preKeyId = session.pendingPreKey.preKeyId;
                    preKeyMsg.signedPreKeyId = session.pendingPreKey.signedKeyId;
                    preKeyMsg.message = message;

                    var result = String.fromCharCode((3 << 4) | 3) + getString(preKeyMsg.encode());
                    return {type: 3, body: result};
                } else
                    return {type: 1, body: getString(message)};
            });
    }

    var GENERATE_KEYS_KEYS_GENERATED = 100;
    self.generateKeys = function() {
        var identityKeyPair = crypto_storage.getIdentityKey();
        var identityKeyCalculated = function(identityKeyPair) {
            var firstPreKeyId = textsecure.storage.getEncrypted("maxPreKeyId", 0);
            textsecure.storage.putEncrypted("maxPreKeyId", firstPreKeyId + GENERATE_KEYS_KEYS_GENERATED);

            var signedKeyId = textsecure.storage.getEncrypted("signedKeyId", 0);
            textsecure.storage.putEncrypted("signedKeyId", signedKeyId + 1);

            var keys = {};
            keys.identityKey = identityKeyPair.pubKey;
            keys.preKeys = [];

            var generateKey = function(keyId) {
                return crypto_storage.getNewStoredKeyPair("preKey" + keyId, false).then(function(keyPair) {
                    keys.preKeys[keyId] = {keyId: keyId, publicKey: keyPair.pubKey};
                });
            };

            var promises = [];
            for (var i = firstPreKeyId; i < firstPreKeyId + GENERATE_KEYS_KEYS_GENERATED; i++)
                promises[i] = generateKey(i);

            promises[firstPreKeyId + GENERATE_KEYS_KEYS_GENERATED] = crypto_storage.getNewStoredKeyPair("signedKey" + signedKeyId).then(function(keyPair) {
                return textsecure.crypto.Ed25519Sign(identityKeyPair.privKey, keyPair.pubKey).then(function(sig) {
                    keys.signedPreKey = {keyId: signedKeyId, publicKey: keyPair.pubKey, signature: sig};
                });
            });

            //TODO: Process by date added and agressively call generateKeys when we get near maxPreKeyId in a message
            crypto_storage.removeStoredKeyPair("signedKey" + (signedKeyId - 2));

            return Promise.all(promises).then(function() {
                return keys;
            });
        }
        if (identityKeyPair === undefined)
            return crypto_storage.getNewStoredKeyPair("identityKey").then(function(keyPair) { return identityKeyCalculated(keyPair); });
        else
            return identityKeyCalculated(identityKeyPair);
    }

    //TODO: Dont always update prekeys here
    if (textsecure.storage.getEncrypted("lastSignedKeyUpdate", Date.now()) < Date.now() - MESSAGE_LOST_THRESHOLD_MS) {
        new Promise(function(resolve) { resolve(self.generateKeys()); });
    }


    self.prepareTempWebsocket = function() {
        var socketInfo = {};
        var keyPair;

        socketInfo.decryptAndHandleDeviceInit = function(deviceInit) {
            var masterEphemeral = toArrayBuffer(deviceInit.masterEphemeralPubKey);
            var message = toArrayBuffer(deviceInit.identityKeyMessage);

            return textsecure.crypto.ECDHE(masterEphemeral, keyPair.privKey).then(function(ecRes) {
                return HKDF(ecRes, masterEphemeral, "WhisperDeviceInit").then(function(keys) {
                    if (new Uint8Array(message)[0] != (3 << 4) | 3)
                        throw new Error("Bad version number on IdentityKeyMessage");

                    var iv = message.slice(1, 16 + 1);
                    var mac = message.slice(message.length - 32, message.length);
                    var ivAndCiphertext = message.slice(0, message.length - 32);
                    var ciphertext = message.slice(16 + 1, message.length - 32);

                    return verifyMAC(ivAndCiphertext, ecRes[1], mac).then(function() {
                        window.textsecure.crypto.decrypt(ecRes[0], ciphertext, iv).then(function(plaintext) {
                            var identityKeyMsg = textsecure.protobuf.IdentityKey.decode(plaintext);

                            textsecure.crypto.createKeyPair(toArrayBuffer(identityKeyMsg.identityKey)).then(function(identityKeyPair) {
                                crypto_storage.putKeyPair("identityKey", identityKeyPair);
                                identityKeyMsg.identityKey = null;

                                return identityKeyMsg;
                            });
                        });
                    });
                });
            });
        }

        return textsecure.crypto.createKeyPair().then(function(newKeyPair) {
            keyPair = newKeyPair;
            socketInfo.pubKey = keyPair.pubKey;
            return socketInfo;
        });
    }

    return self;
}();

})();

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
// sendMessage(numbers = [], message = PushMessageContentProto, callback(success/failure map))
window.textsecure.messaging = function() {
    'use strict';

    var self = {};

    function getKeysForNumber(number, updateDevices) {
        var handleResult = function(response) {
            for (var i in response.devices) {
                if (updateDevices === undefined || updateDevices.indexOf(response.devices[i].deviceId) > -1)
                    textsecure.storage.devices.saveKeysToDeviceObject({
                        encodedNumber: number + "." + response.devices[i].deviceId,
                        identityKey: response.identityKey,
                        preKey: response.devices[i].preKey.publicKey,
                        preKeyId: response.devices[i].preKey.keyId,
                        signedKey: response.devices[i].signedPreKey.publicKey,
                        signedKeyId: response.devices[i].signedPreKey.keyId,
                        registrationId: response.devices[i].registrationId
                    });
            }
        };

        var promises = [];
        if (updateDevices !== undefined)
            for (var i in updateDevices)
                promises[promises.length] = textsecure.api.getKeysForNumber(number, updateDevices[i]).then(handleResult);
        else
            return textsecure.api.getKeysForNumber(number).then(handleResult);

        return Promise.all(promises);
    }

    // success_callback(server success/failure map), error_callback(error_msg)
    // message == PushMessageContentProto (NOT STRING)
    function sendMessageToDevices(timestamp, number, deviceObjectList, message, success_callback, error_callback) {
        var jsonData = [];
        var relay = undefined;
        var promises = [];

        var addEncryptionFor = function(i) {
            if (deviceObjectList[i].relay !== undefined) {
                if (relay === undefined)
                    relay = deviceObjectList[i].relay;
                else if (relay != deviceObjectList[i].relay)
                    return new Promise(function() { throw new Error("Mismatched relays for number " + number); });
            } else {
                if (relay === undefined)
                    relay = "";
                else if (relay != "")
                    return new Promise(function() { throw new Error("Mismatched relays for number " + number); });
            }

            return textsecure.protocol.encryptMessageFor(deviceObjectList[i], message).then(function(encryptedMsg) {
                jsonData[i] = {
                    type: encryptedMsg.type,
                    destinationDeviceId: textsecure.utils.unencodeNumber(deviceObjectList[i].encodedNumber)[1],
                    destinationRegistrationId: deviceObjectList[i].registrationId,
                    body: encryptedMsg.body,
                    timestamp: timestamp
                };

                if (deviceObjectList[i].relay !== undefined)
                    jsonData[i].relay = deviceObjectList[i].relay;
            });
        }

        for (var i = 0; i < deviceObjectList.length; i++)
            promises[i] = addEncryptionFor(i);
        return Promise.all(promises).then(function() {
            return textsecure.api.sendMessages(number, jsonData);
        });
    }

    var sendGroupProto;
    var makeAttachmentPointer;
    var refreshGroups = function(number) {
        var groups = textsecure.storage.groups.getGroupListForNumber(number);
        var promises = [];
        for (var i in groups) {
            var group = textsecure.storage.groups.getGroup(groups[i]);

            var proto = new textsecure.protobuf.PushMessageContent();
            proto.group = new textsecure.protobuf.PushMessageContent.GroupContext();

            proto.group.id = toArrayBuffer(group.id);
            proto.group.type = textsecure.protobuf.PushMessageContent.GroupContext.Type.UPDATE;
            proto.group.members = group.numbers;
            proto.group.name = group.name === undefined ? null : group.name;

            if (group.avatar !== undefined) {
                return makeAttachmentPointer(group.avatar).then(function(attachment) {
                    proto.group.avatar = attachment;
                    promises.push(sendGroupProto([number], proto));
                });
            } else {
                promises.push(sendGroupProto([number], proto));
            }
        }
        return Promise.all(promises);
    }

    var tryMessageAgain = function(number, encodedMessage, message_id) {
        var message = new Whisper.MessageCollection().add({id: message_id});
        message.fetch().then(function() {
            textsecure.storage.removeEncrypted("devices" + number);
            var proto = textsecure.protobuf.PushMessageContent.decode(encodedMessage, 'binary');
            sendMessageProto(message.get('sent_at'), [number], proto, function(res) {
                if (res.failure.length > 0) {
                    message.set('errors', res.failure);
                }
                else {
                    message.set('errors', []);
                }
                message.save().then(function(){
                    extension.trigger('message', message); // notify frontend listeners
                });
            });
        });
    };
    textsecure.replay.registerFunction(tryMessageAgain, textsecure.replay.Type.SEND_MESSAGE);

    var sendMessageProto = function(timestamp, numbers, message, callback) {
        var numbersCompleted = 0;
        var errors = [];
        var successfulNumbers = [];

        var numberCompleted = function() {
            numbersCompleted++;
            if (numbersCompleted >= numbers.length)
                callback({success: successfulNumbers, failure: errors});
        }

        var registerError = function(number, message, error) {
            if (error) {
                if (error.humanError)
                    message = error.humanError;
            } else
                error = new Error(message);
            errors[errors.length] = { number: number, reason: message, error: error };
            numberCompleted();
        }

        var doSendMessage;
        var reloadDevicesAndSend = function(number, recurse) {
            return function() {
                var devicesForNumber = textsecure.storage.devices.getDeviceObjectsForNumber(number);
                if (devicesForNumber.length == 0)
                    return registerError(number, "Got empty device list when loading device keys", null);
                refreshGroups(number).then(function() {
                    doSendMessage(number, devicesForNumber, recurse);
                });
            }
        }

        doSendMessage = function(number, devicesForNumber, recurse) {
            return sendMessageToDevices(timestamp, number, devicesForNumber, message).then(function(result) {
                successfulNumbers[successfulNumbers.length] = number;
                numberCompleted();
            }).catch(function(error) {
                if (error instanceof Error && error.name == "HTTPError" && (error.message == 410 || error.message == 409)) {
                    if (!recurse)
                        return registerError(number, "Hit retry limit attempting to reload device list", error);

                    if (error.message == 409)
                        textsecure.storage.devices.removeDeviceIdsForNumber(number, error.response.extraDevices);

                    var resetDevices = ((error.message == 410) ? error.response.staleDevices : error.response.missingDevices);
                    getKeysForNumber(number, resetDevices)
                        .then(reloadDevicesAndSend(number, false))
                        .catch(function(error) {
                            if (error.message !== "Identity key changed")
                                registerError(number, "Failed to reload device keys", error);
                            else {
                                error = new textsecure.OutgoingIdentityKeyError(number, getString(message.encode()));
                                registerError(number, "Identity key changed", error);
                            }
                        });
                } else
                    registerError(number, "Failed to create or send message", error);
            });
        }

        for (var i in numbers) {
            var number = numbers[i];
            var devicesForNumber = textsecure.storage.devices.getDeviceObjectsForNumber(number);

            var promises = [];
            for (var j in devicesForNumber)
                if (devicesForNumber[j].registrationId === undefined)
                    promises[promises.length] = getKeysForNumber(number, [parseInt(textsecure.utils.unencodeNumber(devicesForNumber[j].encodedNumber)[1])]);

            Promise.all(promises).then(function() {
                devicesForNumber = textsecure.storage.devices.getDeviceObjectsForNumber(number);

                if (devicesForNumber.length == 0) {
                    getKeysForNumber(number)
                        .then(reloadDevicesAndSend(number, true))
                        .catch(function(error) {
                            registerError(number, "Failed to retreive new device keys for number " + number, error);
                        });
                } else
                    doSendMessage(number, devicesForNumber, true);
            });
        }
    }

    makeAttachmentPointer = function(attachment) {
        var proto = new textsecure.protobuf.PushMessageContent.AttachmentPointer();
        proto.key = textsecure.crypto.getRandomBytes(64);

        var iv = textsecure.crypto.getRandomBytes(16);
        return textsecure.protocol.encryptAttachment(attachment.data, proto.key, iv).then(function(encryptedBin) {
            return textsecure.api.putAttachment(encryptedBin).then(function(id) {
                proto.id = id;
                proto.contentType = attachment.contentType;
                return proto;
            });
        });
    }

    var sendIndividualProto = function(number, proto, timestamp) {
        return new Promise(function(resolve, reject) {
            sendMessageProto(timestamp, [number], proto, function(res) {
                if (res.failure.length > 0)
                    reject(res.failure);
                else
                    resolve();
            });
        });
    }

    sendGroupProto = function(numbers, proto, timestamp) {
        timestamp = timestamp || Date.now();
        var me = textsecure.utils.unencodeNumber(textsecure.storage.getUnencrypted("number_id"))[0];
        numbers = numbers.filter(function(number) { return number != me; });

        return new Promise(function(resolve, reject) {
            sendMessageProto(timestamp, numbers, proto, function(res) {
                if (res.failure.length > 0)
                    reject(res.failure);
                else
                    resolve();
            });
        });
    }

    self.sendMessageToNumber = function(number, messageText, attachments, timestamp) {
        var proto = new textsecure.protobuf.PushMessageContent();
        proto.body = messageText;

        var promises = [];
        for (var i in attachments)
            promises.push(makeAttachmentPointer(attachments[i]));
        return Promise.all(promises).then(function(attachmentsArray) {
            proto.attachments = attachmentsArray;
            return sendIndividualProto(number, proto, timestamp);
        });
    }

    self.closeSession = function(number) {
        var proto = new textsecure.protobuf.PushMessageContent();
        proto.body = "TERMINATE";
        proto.flags = textsecure.protobuf.PushMessageContent.Flags.END_SESSION;
        return sendIndividualProto(number, proto).then(function(res) {
            var devices = textsecure.storage.devices.getDeviceObjectsForNumber(number);
            for (var i in devices)
                textsecure.protocol.closeOpenSessionForDevice(devices[i].encodedNumber);

            return res;
        });
    }

    self.sendMessageToGroup = function(groupId, messageText, attachments, timestamp) {
        var proto = new textsecure.protobuf.PushMessageContent();
        proto.body = messageText;
        proto.group = new textsecure.protobuf.PushMessageContent.GroupContext();
        proto.group.id = toArrayBuffer(groupId);
        proto.group.type = textsecure.protobuf.PushMessageContent.GroupContext.Type.DELIVER;

        var numbers = textsecure.storage.groups.getNumbers(groupId);
        if (numbers === undefined)
            return new Promise(function(resolve, reject) { reject(new Error("Unknown Group")); });

        var promises = [];
        for (var i in attachments)
            promises.push(makeAttachmentPointer(attachments[i]));
        return Promise.all(promises).then(function(attachmentsArray) {
            proto.attachments = attachmentsArray;
            return sendGroupProto(numbers, proto, timestamp);
        });
    }

    self.createGroup = function(numbers, name, avatar) {
        var proto = new textsecure.protobuf.PushMessageContent();
        proto.group = new textsecure.protobuf.PushMessageContent.GroupContext();

        var group = textsecure.storage.groups.createNewGroup(numbers);
        proto.group.id = toArrayBuffer(group.id);
        var numbers = group.numbers;

        proto.group.type = textsecure.protobuf.PushMessageContent.GroupContext.Type.UPDATE;
        proto.group.members = numbers;
        proto.group.name = name;

        if (avatar !== undefined) {
            return makeAttachmentPointer(avatar).then(function(attachment) {
                proto.group.avatar = attachment;
                return sendGroupProto(numbers, proto).then(function() {
                    return proto.group.id;
                });
            });
        } else {
            return sendGroupProto(numbers, proto).then(function() {
                return proto.group.id;
            });
        }
    }

    self.addNumberToGroup = function(groupId, number) {
        var proto = new textsecure.protobuf.PushMessageContent();
        proto.group = new textsecure.protobuf.PushMessageContent.GroupContext();
        proto.group.id = toArrayBuffer(groupId);
        proto.group.type = textsecure.protobuf.PushMessageContent.GroupContext.Type.UPDATE;

        var numbers = textsecure.storage.groups.addNumbers(groupId, [number]);
        if (numbers === undefined)
            return new Promise(function(resolve, reject) { reject(new Error("Unknown Group")); });
        proto.group.members = numbers;

        return sendGroupProto(numbers, proto);
    }

    self.setGroupName = function(groupId, name) {
        var proto = new textsecure.protobuf.PushMessageContent();
        proto.group = new textsecure.protobuf.PushMessageContent.GroupContext();
        proto.group.id = toArrayBuffer(groupId);
        proto.group.type = textsecure.protobuf.PushMessageContent.GroupContext.Type.UPDATE;
        proto.group.name = name;

        var numbers = textsecure.storage.groups.getNumbers(groupId);
        if (numbers === undefined)
            return new Promise(function(resolve, reject) { reject(new Error("Unknown Group")); });
        proto.group.members = numbers;

        return sendGroupProto(numbers, proto);
    }

    self.setGroupAvatar = function(groupId, avatar) {
        var proto = new textsecure.protobuf.PushMessageContent();
        proto.group = new textsecure.protobuf.PushMessageContent.GroupContext();
        proto.group.id = toArrayBuffer(groupId);
        proto.group.type = textsecure.protobuf.PushMessageContent.GroupContext.Type.UPDATE;

        var numbers = textsecure.storage.groups.getNumbers(groupId);
        if (numbers === undefined)
            return new Promise(function(resolve, reject) { reject(new Error("Unknown Group")); });
        proto.group.members = numbers;

        return makeAttachmentPointer(avatar).then(function(attachment) {
            proto.group.avatar = attachment;
            return sendGroupProto(numbers, proto);
        });
    }

    self.leaveGroup = function(groupId) {
        var proto = new textsecure.protobuf.PushMessageContent();
        proto.group = new textsecure.protobuf.PushMessageContent.GroupContext();
        proto.group.id = toArrayBuffer(groupId);
        proto.group.type = textsecure.protobuf.PushMessageContent.GroupContext.Type.QUIT;

        var numbers = textsecure.storage.groups.getNumbers(groupId);
        if (numbers === undefined)
            return new Promise(function(resolve, reject) { reject(new Error("Unknown Group")); });
        textsecure.storage.groups.deleteGroup(groupId);

        return sendGroupProto(numbers, proto);
    }

    return self;
}();

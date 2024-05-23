// Derived from Chromium WebRTC Internals Dashboard - see Acknowledgements for full license details

import {assert} from "./assert.js";
export function $(id) {
    const el = document.querySelector(`#${id}`);
    if (el) {
        assert(el instanceof HTMLElement);
        return el
    }
    return null
}
export function getRequiredElement(id) {
    const el = document.querySelector(`#${id}`);
    assert(el);
    assert(el instanceof HTMLElement);
    return el
}
export function getDeepActiveElement() {
    let a = document.activeElement;
    while (a && a.shadowRoot && a.shadowRoot.activeElement) {
        a = a.shadowRoot.activeElement
    }
    return a
}
export function isRTL() {
    return document.documentElement.dir === "rtl"
}
export function appendParam(url, key, value) {
    const param = encodeURIComponent(key) + "=" + encodeURIComponent(value);
    if (url.indexOf("?") === -1) {
        return url + "?" + param
    }
    return url + "&" + param
}
export function ensureTransitionEndEvent(el, timeOut) {
    if (timeOut === undefined) {
        const style = getComputedStyle(el);
        timeOut = parseFloat(style.transitionDuration) * 1e3;
        timeOut += 50
    }
    let fired = false;
    el.addEventListener("transitionend", (function f() {
        el.removeEventListener("transitionend", f);
        fired = true
    }
    ));
    window.setTimeout((function() {
        if (!fired) {
            el.dispatchEvent(new CustomEvent("transitionend",{
                bubbles: true,
                composed: true
            }))
        }
    }
    ), timeOut)
}
export function htmlEscape(original) {
    return original.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;")
}
export function quoteString(str) {
    return str.replace(/([\\\.\+\*\?\[\^\]\$\(\)\{\}\=\!\<\>\|\:])/g, "\\$1")
}
export function listenOnce(target, eventNames, callback) {
    const eventNamesArray = Array.isArray(eventNames) ? eventNames : eventNames.split(/ +/);
    const removeAllAndCallCallback = function(event) {
        eventNamesArray.forEach((function(eventName) {
            target.removeEventListener(eventName, removeAllAndCallCallback, false)
        }
        ));
        return callback(event)
    };
    eventNamesArray.forEach((function(eventName) {
        target.addEventListener(eventName, removeAllAndCallCallback, false)
    }
    ))
}
export function hasKeyModifiers(e) {
    return !!(e.altKey || e.ctrlKey || e.metaKey || e.shiftKey)
}
export function isUndoKeyboardEvent(event) {
    if (event.key !== "z") {
        return false
    }
    const excludedModifiers = [event.altKey, event.shiftKey, event.ctrlKey];
    let targetModifier = event.ctrlKey;
    targetModifier = event.metaKey;
    return targetModifier && !excludedModifiers.some((modifier=>modifier))
}

// Copyright 2015 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * @fileoverview Wrap chrome API calls in Promises.
 */


/**
 * Make a function which is a Promise based version of a chrome API method.
 * It takes the same arguments as the original method except the callback
 * and it returns a Promise for the result (i.e. the args passed to the
 * original method's callback).
 * @param {!Object} api The chrome API with the method to wrap.
 * @param {string} method The name of the method to wrap.
 * @return {function(...?): Promise} A Promise based API method.
 */
function wrapInPromise(api, method) {
  return function() {
    let args = new Array(arguments.length);
    for (let i = 0; i < args.length; ++i) {
      args[i] = arguments[i];
    }

    return new Promise(function(resolve, reject) {
      args.push(resolveWithArgsOrReject.bind(null, resolve, reject));

      api[method].apply(api, args);
    });
  }
}


/**
 * Use as an API method callback for API calls within a Promise.
 * To use, bind the resolve and reject functions of the Promise
 * and use that as the callback.
 * If there is an error, reject with the error message.
 * Otherwise, resolve with arguments from the API call.
 * @param {Function} resolve A Promise's resolve function.
 * @param {Function} reject A Promise's reject function.
 */
function resolveWithArgsOrReject(resolve, reject) {
  if (chrome.runtime.lastError) {
    reject(chrome.runtime.lastError.message);
  } else {
    // Offset 2 into the arguments to get just the args from the API,
    // not the resolve and reject functions.
    let args = new Array(arguments.length - 2);
    for (let i = 0; i < args.length; ++i) {
      args[i] = arguments[i + 2];
    }
    resolve.apply(null, args);
  }
}


var doGetTab = wrapInPromise(chrome.tabs, 'get');
var doGetZoom = wrapInPromise(chrome.tabs, 'getZoom');
var doGetZoomSettings = wrapInPromise(chrome.tabs, 'getZoomSettings');
var doSetZoom = wrapInPromise(chrome.tabs, 'setZoom');
var doSetZoomSettings = wrapInPromise(chrome.tabs, 'setZoomSettings');
var doExecuteScript = wrapInPromise(chrome.tabs, 'executeScript');
var doGetBackgroundPage = wrapInPromise(chrome.runtime, 'getBackgroundPage');
var doStorageLocalGet = wrapInPromise(chrome.storage.local, 'get');
var doStorageLocalSet = wrapInPromise(chrome.storage.local, 'set');
var doStorageLocalRemove = wrapInPromise(chrome.storage.local, 'remove');

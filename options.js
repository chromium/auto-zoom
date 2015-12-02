// Copyright 2015 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';


/**
 * The default values for the options.
 */
var OPTION_DEFAULTS = {
  ignoreOverrides: false,
  idealFontSize: 16,
  metricWeights: {
    fontSize: 8,
    margin: 4,
  },
};


/**
 * Gets the options.
 * @param {string|Array<string>} optionNames The names of the options.
 * @return {Promise<Object>} A promise that will resolve to the options.
 */
function doGetOptions(optionNames) {
  if (typeof optionNames === 'string') {
    optionNames = [optionNames];
  }

  let data = {};
  for (let i = 0, len = optionNames.length; i < len; ++i) {
    data[optionNames[i]] = OPTION_DEFAULTS[optionNames[i]];
  }

  return doStorageLocalGet(data);
}


/**
 * Sets the options.
 * @param {Object} items The options to store.
 * @return {Promise} A promise that will resolve when the settings are stored.
 */
function doSetOptions(items) {
  return doStorageLocalSet(items);
}

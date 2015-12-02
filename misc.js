// Copyright 2015 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';


/**
 * Get the hostname part of a URL.
 * @param {string} url The URL to parse.
 * @return {string} The hostname.
 */
function urlToHostname(url) {
  // TODO(mcnee) okay to use (new URL(url)).hostname ?
  // Use a temporary anchor object to have it parse
  // the url and get the resulting hostname.
  let anchor = document.createElement('a');
  anchor.href = url;
  return anchor.hostname;
}


/**
 * Get the protocol scheme part of a URL.
 * @param {string} url The URL to parse.
 * @return {string} The protocol.
 */
function urlToProtocol(url) {
  // TODO(mcnee) okay to use (new URL(url)).protocol ?
  // Use a temporary anchor object to have it parse
  // the url and get the resulting protocol.
  let anchor = document.createElement('a');
  anchor.href = url;
  return anchor.protocol;
}


/**
 * Returns whether two zoom values are approximately equal.
 * @param {number} a The first zoom value.
 * @param {number} b The second zoom value.
 * @return {boolean} Whether the values are approximately equal.
 */
function zoomValuesEqual(a, b) {
  let ZOOM_EPSILON = 0.01;
  return Math.abs(a - b) <= ZOOM_EPSILON;
}

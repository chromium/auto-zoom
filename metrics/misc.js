// Copyright 2015 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';


/**
 * Add the value to distribution[key].
 * Initialize if the key doesn't already exist.
 * @param {Object} distribution The distribution.
 * @param {number} key The key.
 * @param {number} value The value.
 */
function addToDistribution(distribution, key, value) {
  if (!distribution.hasOwnProperty(key)) {
    distribution[key] = 0;
  }

  distribution[key] += value;
}


/**
 * Compute the area of an element.
 * @param {Object} el The element.
 * @return {number} The computed area.
 */
function elementArea(el) {
  let boundingRect = el.getBoundingClientRect();
  return boundingRect.height * boundingRect.width;
}


/**
 * Compute the width of the content of an element.
 * @param {Object} el The element.
 * @param {Object} computedStyle The result of window.getComputedStyle(el).
 * @return {number} The content width.
 */
function elementContentWidth(el, computedStyle) {
  let width = parseFloat(computedStyle.width);

  if (isNaN(width)) {
    // Fallback to clientWidth, if width is not computed.
    width = el.clientWidth;
    width -= parseFloat(computedStyle.paddingLeft);
    width -= parseFloat(computedStyle.paddingRight);
  } else {
    if (computedStyle.boxSizing === 'border-box') {
      width -= parseFloat(computedStyle.borderLeftWidth);
      width -= parseFloat(computedStyle.paddingLeft);
      width -= parseFloat(computedStyle.paddingRight);
      width -= parseFloat(computedStyle.borderRightWidth);
    }
  }

  return width;
}


/**
 * Compute the total width of an element.
 * @param {Object} el The element.
 * @param {Object} computedStyle The result of window.getComputedStyle(el).
 * @return {number} The total width.
 */
function elementTotalWidth(el, computedStyle) {
  let totalWidth = parseFloat(computedStyle.width);

  if (isNaN(totalWidth)) {
    // Fallback to offsetWidth, if width is not computed.
    totalWidth = el.offsetWidth;
    totalWidth += parseFloat(computedStyle.marginLeft);
    totalWidth += parseFloat(computedStyle.marginRight);
  } else {
    if (computedStyle.boxSizing === 'content-box') {
      totalWidth += parseFloat(computedStyle.paddingLeft);
      totalWidth += parseFloat(computedStyle.paddingRight);
      totalWidth += parseFloat(computedStyle.borderLeftWidth);
      totalWidth += parseFloat(computedStyle.borderRightWidth);
    }

    totalWidth += parseFloat(computedStyle.marginLeft);
    totalWidth += parseFloat(computedStyle.marginRight);
  }

  return totalWidth;
}


/**
 * Compute the height of the content of an element.
 * @param {Object} el The element.
 * @param {Object} computedStyle The result of window.getComputedStyle(el).
 * @return {number} The content height.
 */
function elementContentHeight(el, computedStyle) {
  let height = parseFloat(computedStyle.height);

  if (isNaN(height)) {
    // Fallback to clientHeight, if height is not computed.
    height = el.clientHeight;
    height -= parseFloat(computedStyle.paddingTop);
    height -= parseFloat(computedStyle.paddingBottom);
  } else {
    if (computedStyle.boxSizing === 'border-box') {
      height -= parseFloat(computedStyle.borderTopWidth);
      height -= parseFloat(computedStyle.paddingTop);
      height -= parseFloat(computedStyle.paddingBottom);
      height -= parseFloat(computedStyle.borderBottomWidth);
    }
  }

  return height;
}


/**
 * Compute the total height of an element.
 * @param {Object} el The element.
 * @param {Object} computedStyle The result of window.getComputedStyle(el).
 * @return {number} The total height.
 */
function elementTotalHeight(el, computedStyle) {
  let totalHeight = parseFloat(computedStyle.height);

  if (isNaN(totalHeight)) {
    // Fallback to offsetHeight, if height is not computed.
    totalHeight = el.offsetHeight;
    totalHeight += parseFloat(computedStyle.marginTop);
    totalHeight += parseFloat(computedStyle.marginBottom);
  } else {
    if (computedStyle.boxSizing === 'content-box') {
      totalHeight += parseFloat(computedStyle.paddingTop);
      totalHeight += parseFloat(computedStyle.paddingBottom);
      totalHeight += parseFloat(computedStyle.borderTopWidth);
      totalHeight += parseFloat(computedStyle.borderBottomWidth);
    }

    totalHeight += parseFloat(computedStyle.marginTop);
    totalHeight += parseFloat(computedStyle.marginBottom);
  }

  return totalHeight;
}

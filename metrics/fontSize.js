// Copyright 2015 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';


var metrics = metrics || {};


/**
 * A metric based on the distribution of font sizes in a page.
 */
metrics.fontSize = {

  processTextNode: function(message, textNode) {
    let el = textNode.parentElement;
    let fontSize = parseInt(window.getComputedStyle(el).fontSize, 10);

    addToDistribution(
        message.fontSizeDistribution, fontSize, textNode.textContent.length);

    message.textArea += elementArea(el);
  },

  processButtonElement: function(message, el) {
    let fontSize = parseInt(window.getComputedStyle(el).fontSize, 10);

    // If value is not provided for submit or reset types, then the text shown
    // is Submit and Reset respectively.
    let length = el.value ? el.value.length : el.type.length;

    addToDistribution(message.fontSizeDistribution, fontSize, length);

    message.textArea += elementArea(el);
  },

  processObject: function(message, el) {
    message.objectArea += elementArea(el);
  },

  /**
   * Return the ideal zoom factor given font size information.
   * @param {Object} fontSizeDistribution The font size distribution.
   * @param {number} idealFontSize The target font size.
   * @param {number} textArea The area of text content on the page.
   * @param {number} objectArea The area of non-text content on the page.
   * @return {Object} The computed zoom factor and confidence.
   */
  compute: function(fontSizeDistribution, idealFontSize, textArea, objectArea) {
    /**
     * We pick a representative font of the page and pick a zoom factor
     * such that the representative font will appear to be the same size
     * as the ideal font size.
     */
    let firstQuartile = fontSizeFirstQuartile(fontSizeDistribution);
    let percentTextual = textArea / (textArea + objectArea);
    let confidence = percentTextual > 0.5 ? 1.0 : percentTextual;
    if (firstQuartile && confidence) {
      return {
        zoom: idealFontSize / firstQuartile,
        confidence: confidence
      };
    } else {
      return {zoom: 0, confidence: 0};
    }
  }
};


/**
 * Return the smallest font size that is above the first
 * quartile of font sizes in the given distribution.
 * @param {Object} fontSizeDistribution The font size distribution.
 * @return {number} The smallest font size above the first quartile.
 */
function fontSizeFirstQuartile(fontSizeDistribution) {
  let total = 0;
  for (let fontSize in fontSizeDistribution) {
    total += fontSizeDistribution[fontSize];
  }

  // We don't care about averaging if position is not an integer
  // as there's no need to be that accurate.
  let position = Math.floor((total + 1) / 4);

  let sizesInOrder = Object.keys(fontSizeDistribution).sort(function(a, b) {
    return a - b;
  });

  for (let i = 0, len = sizesInOrder.length; i < len; ++i) {
    let fontSize = sizesInOrder[i];

    if (position < fontSizeDistribution[fontSize]) {
      return fontSize;
    } else {
      position -= fontSizeDistribution[fontSize];
    }
  }
}

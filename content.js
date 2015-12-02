// Copyright 2015 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

let message = {
  // Map font sizes to number of characters of that size found in page.
  fontSizeDistribution: {},
  // Area of page covered in text content.
  textArea: 0.0,
  // Area of page covered in non-text objects (e.g. videos, images).
  objectArea: 0.0,
  // Dimensions of the content of either the body or documentElement.
  contentDimensions: {
    height: 0.0,
    width: 0.0
  },
  // The dimentions of each of the containers centered in the page.
  centeredContainers: [],
};

let textNodeIterator = document.createNodeIterator(
    document.body,
    NodeFilter.SHOW_TEXT,
    function(node) {
      let el = node.parentElement;
      return (!el ||
              node.textContent.trim() === '' ||
              el.tagName === 'SCRIPT' ||
              el.tagName === 'STYLE') ?
          NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
    });

// Button text is not defined in a text node
// so we have to check this separately.
let buttonIterator = document.createNodeIterator(
    document.body,
    NodeFilter.SHOW_ELEMENT,
    function(el) {
      return el.tagName === 'INPUT' &&
          (el.type === 'button' ||
           el.type === 'submit' ||
           el.type === 'reset') ?
          NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    });

let objectIterator = document.createNodeIterator(
    document.body,
    NodeFilter.SHOW_ELEMENT,
    function(el) {
      return (el.tagName === 'AUDIO' ||
              el.tagName === 'CANVAS' ||
              el.tagName === 'EMBED' ||
              el.tagName === 'IFRAME' ||
              el.tagName === 'IMG' ||
              el.tagName === 'OBJECT' ||
              el.tagName === 'VIDEO') ?
          NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    });

/**
 * TODO(mcnee) Don't hog the main thread when analysing the DOM.
 * We could divide up the tasks and occasionally yield like in this example:
 * https://developers.google.com/web/fundamentals/performance/rendering/optimize-javascript-execution?hl=en#reduce-complexity-or-use-web-workers
 */

let currentNode;

while (currentNode = textNodeIterator.nextNode()) {
  metrics.fontSize.processTextNode(message, currentNode);
}

while (currentNode = buttonIterator.nextNode()) {
  metrics.fontSize.processButtonElement(message, currentNode);
}

while (currentNode = objectIterator.nextNode()) {
  metrics.fontSize.processObject(message, currentNode);
}

metrics.margin.findMargins(message);

chrome.runtime.sendMessage(message);

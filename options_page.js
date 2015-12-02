// Copyright 2015 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';


/**
 * Alias for document.getElementById.
 * @param {string} id The ID of the element to find.
 * @return {HTMLElement} The found element or null if not found.
 */
function $(id) {
  return document.getElementById(id);
}


/**
 * Saves the options in storage.
 */
function saveOptions() {
  let ignoreOverrides = $('ignoreOverrides').checked;
  let idealFontSize = $('idealFontSize').value;

  let fontSizeWeight = $('fontSizeWeight').value;
  let marginWeight = $('marginWeight').value;

  doGetZoom(undefined).then(function(currentZoom) {
    return doSetOptions({
      ignoreOverrides: ignoreOverrides,
      idealFontSize: idealFontSize,
      metricWeights: {
        fontSize: fontSizeWeight,
        margin: marginWeight,
      },
    });
  }).then(function() {
    let status = $('status');
    status.textContent = 'Options saved.';
    setTimeout(function() {
      status.textContent = '';
    }, 2000);
  });
}


/**
 * Restores the options from storage.
 */
function restoreOptions() {
  Promise.all([
    doGetOptions([
      'ignoreOverrides',
      'idealFontSize',
      'metricWeights',
    ]),
    doGetZoom(undefined)
  ]).then(function(values) {
    let items = values[0];
    let currentZoom = values[1];

    $('ignoreOverrides').checked = items.ignoreOverrides;
    $('idealFontSize').value = items.idealFontSize;

    $('fontSizeWeight').value = items.metricWeights.fontSize;
    $('marginWeight').value = items.metricWeights.margin;
  }).then(setSampleTextSize);
}


/**
 * Set the font size of the sample text for the ideal font size option.
 */
function setSampleTextSize() {
  doGetZoom(undefined).then(function(currentZoom) {
    // Set the font size to how the idealFontSize would look at 100% zoom.
    $('sampleText').style.fontSize =
        ($('idealFontSize').value / currentZoom) + 'px';
  });
}

chrome.tabs.onZoomChange.addListener(setSampleTextSize);
$('idealFontSize').addEventListener('change', setSampleTextSize);


document.addEventListener('DOMContentLoaded', restoreOptions);
$('save').addEventListener('click', saveOptions);

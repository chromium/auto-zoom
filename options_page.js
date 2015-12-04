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
  let idealFontSize = parseInt($('idealFontSize').value, 10);

  // Validate font size.
  if (isNaN(idealFontSize) || idealFontSize < 6 || idealFontSize > 99) {
    idealFontSize = undefined;
  }

  let fontSizeWeight = parseInt($('fontSizeWeight').value, 10);
  let marginWeight = parseInt($('marginWeight').value, 10);

  doGetZoom(undefined).then(function(currentZoom) {
    return doSetOptions({
      ignoreOverrides: ignoreOverrides,
      idealFontSize: idealFontSize,
      metricWeights: {
        fontSize: fontSizeWeight,
        margin: marginWeight,
      },
    });
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


/**
 * Toggle whether the advanced settings are visible.
 */
function toggleAdvancedSettings() {
  let wasVisible = $('advancedSettings').classList.toggle('hidden');
  $('advancedSettingsToggle').textContent =
      (wasVisible ? 'Show' : 'Hide') + ' advanced settings...';
}


chrome.tabs.onZoomChange.addListener(setSampleTextSize);
$('idealFontSize').addEventListener('change', setSampleTextSize);

$('ignoreOverrides').addEventListener('change', saveOptions);
$('idealFontSize').addEventListener('change', saveOptions);
$('fontSizeWeight').addEventListener('change', saveOptions);
$('marginWeight').addEventListener('change', saveOptions);

$('advancedSettingsToggle').addEventListener('click', toggleAdvancedSettings);

document.addEventListener('DOMContentLoaded', restoreOptions);

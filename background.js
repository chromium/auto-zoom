// Copyright 2015 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * @fileoverview Manage zoom levels of tabs.
 */

// The tabs whose zoom events we're interested in.
var activeListeners = new PersistentSet('activeListeners');

// The origins whose zoom factors have been overridden by the user.
var overriddenOrigins = new PersistentSet('overriddenOrigins');


/**
 * Compute the weighted average of zoom factors from the metric results.
 * @param {Array<Object>} metricResults An array of metric results.
 * @return {number} The resulting zoom factor.
 */
function metricsWeightedAverage(metricResults) {
  let totalWeight = 0.0;
  for (let i = 0, len = metricResults.length; i < len; ++i) {
    totalWeight += metricResults[i].weight * metricResults[i].confidence;
  }

  let zoomFactor = 0.0;
  for (let i = 0, len = metricResults.length; i < len; ++i) {
    zoomFactor += metricResults[i].zoom *
                  metricResults[i].weight *
                  metricResults[i].confidence;
  }
  zoomFactor /= totalWeight;

  return zoomFactor;
}


/**
 * Returns a promise that resolves to the computed zoom factor
 * based on the content of the page.
 * @param {Tab} tab The tab for which we're computing the zoom factor.
 * @param {!Object} pageInfo Information about the page content.
 * @param {number} currentZoom The current zoom factor.
 * @return {Promise<number>} The computed zoom factor.
 */
function computeZoom(tab, pageInfo, currentZoom) {
  return Promise.all([
    doGetZoomSettings(tab.id),
    doGetOptions(['idealFontSize', 'idealPageWidth', 'metricWeights'])
  ]).then(function(values) {
    let zoomSettings = values[0];
    let items = values[1];

    // Prior belief: the page is fine at the default zoom factor
    let defaultMetric = {
      zoom: zoomSettings.defaultZoomFactor,
      confidence: 1,
      weight: 1
    };

    let fontSizeMetric = metrics.fontSize.compute(pageInfo.fontSizeDistribution,
        items.idealFontSize, pageInfo.textArea, pageInfo.objectArea);
    fontSizeMetric.weight = items.metricWeights.fontSize;

    let marginMetric = metrics.margin.compute(pageInfo.contentDimensions,
        pageInfo.centeredContainers, items.idealPageWidth, currentZoom);
    marginMetric.weight = items.metricWeights.margin;

    let metricResults = [
      defaultMetric,
      fontSizeMetric,
      marginMetric,
    ];

    return metricsWeightedAverage(metricResults);
  });
}


/**
 * Returns a promise that, when resolved, indicates whether
 * we may auto zoom the page
 * @param {Tab} tab The tab which we determine if we can auto zoom.
 * @return {Promise<boolean>} A promise that will resolve to whether
 *    we may auto zoom.
 */
function determineAllowedToAutoZoom(tab) {
  // Check the url is one we're permitted to access.
  // See manifest.json.
  let protocol = urlToProtocol(tab.url);
  if (protocol !== 'http:' && protocol !== 'https:') {
    return Promise.resolve(false);
  }

  return Promise.all([
    doGetZoom(tab.id),
    doGetZoomSettings(tab.id),
    overriddenOrigins.has(urlToHostname(tab.url)),
    doGetOptions('ignoreOverrides')
  ]).then(function(values) {
    let currentZoom = values[0];
    let zoomSettings = values[1];
    let overridden = values[2];
    let options = values[3];

    return zoomSettings.mode === 'automatic' &&
        zoomSettings.scope === 'per-origin' &&
        (options.ignoreOverrides ||
         (!overridden &&
          zoomValuesEqual(currentZoom, zoomSettings.defaultZoomFactor)));
  }).catch(function() {
    return false;
  });
}

// Stay informed of zoom changes to tabs we've auto zoomed.
chrome.tabs.onZoomChange.addListener(function(zoomChangeInfo) {
  activeListeners.has(zoomChangeInfo.tabId).then(function(listening) {
    if (!listening) {
      return;
    }

    doGetZoomSettings(zoomChangeInfo.tabId).then(function(zoomSettings) {
      if (zoomChangeInfo.zoomSettings.scope === 'per-origin') {
        // Ignoring reset.
        return;
      }

      if (zoomChangeInfo.zoomSettings.scope !== 'per-tab' ||
          zoomChangeInfo.zoomSettings.mode !== 'automatic') {
        // Something changed the zoom settings.
        // We won't try and control this tab's zoom anymore.
        activeListeners.delete(zoomChangeInfo.tabId);
        return;
      }

      if (zoomValuesEqual(zoomChangeInfo.newZoomFactor,
                          zoomChangeInfo.oldZoomFactor)) {
        // Ignoring spurious zoom change.
        return;
      }

      // User has explicitly zoomed.
      // TODO(mcnee) Record why user overrode our choice.
      activeListeners.delete(zoomChangeInfo.tabId).then(function() {
        doGetOptions('ignoreOverrides').then(function(options) {
          /**
           * If we ignore overrides, then there's no point in resetting the
           * scope to per-origin, as we are going to ignore any changes
           * the next time we auto zoom.
           * Also, if we ignored a zoom level exception when we did our last
           * auto zoom, resetting to per-origin would case the zoom level to
           * jump to that of the exception, which may be jarring to the user.
           */
          if (!options.ignoreOverrides) {
            doSetZoomSettings(zoomChangeInfo.tabId, {scope: 'per-origin'});
          }
        });

        doGetTab(zoomChangeInfo.tabId).then(function(tab) {
          overriddenOrigins.add(urlToHostname(tab.url));
        });
      });
    });
  });
});

// Handle messages containing page information from content scripts.
chrome.runtime.onMessage.addListener(function(request, sender) {
  if (sender.tab) {
    activeListeners.delete(sender.tab.id).then(function() {
      return doSetZoomSettings(sender.tab.id, {scope: 'per-tab'});
    }).then(function() {
      return doGetZoom(sender.tab.id);
    }).then(function(currentZoom) {
      return computeZoom(
          sender.tab, request, currentZoom).then(function(newZoom) {
        if (!zoomValuesEqual(newZoom, currentZoom)) {
          return doSetZoom(sender.tab.id, newZoom);
        }
      });
    }).then(function() {
      return activeListeners.add(sender.tab.id);
    });
  }
});


/**
 * Insert content script into the tab, if we are allowed to.
 * @param {Tab} tab The tab into which we intend to insert the content script.
 * @return {Promise} A promise that will resolve when the script has
 *    been inserted or once we determine that we are not allowed.
 */
function insertContentScript(tab) {
  return determineAllowedToAutoZoom(tab).then(function(allowed) {
    // TODO(mcnee) Handle iframes.
    if (allowed) {
      let deps = [
        'metrics/misc.js',
        'metrics/fontSize.js',
        'metrics/margin.js',
      ];
      let loadDeps = new Array(deps.length);
      for (let i = 0, len = deps.length; i < len; ++i) {
        loadDeps[i] = doExecuteScript(
            tab.id, {file: deps[i], runAt: 'document_end'});
      }

      return Promise.all(loadDeps).then(function() {
        return doExecuteScript(
            tab.id, {file: 'content.js', runAt: 'document_end'});
      });
    }
  });
}


chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  if (changeInfo.status === 'loading') {
    insertContentScript(tab);
  }
});

chrome.tabs.onReplaced.addListener(function(addedTabId, removedTabId) {
  activeListeners.delete(removedTabId);

  doGetTab(addedTabId).then(function(addedTab) {
    return insertContentScript(addedTab);
  });
});

chrome.tabs.onRemoved.addListener(function(tabId, removeInfo) {
  activeListeners.delete(tabId);
});

chrome.runtime.onStartup.addListener(function() {
  activeListeners.clear();
});

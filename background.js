// Copyright 2015 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

/**
 * @fileoverview Manage zoom levels of tabs.
 */

// The tabs whose zoom events we're interested in.
var activeListeners = new PersistentSet('activeListeners');

// The origins whose zoom factors have been overriden by the user.
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
 * Hold an election among the predefined zoom factors to
 * determine which is most appropriate given the metric results.
 * @param {Array<Object>} metricResults An array of metric results.
 * @param {number} defaultZoomFactor The default zoom factor.
 * @return {number} The winning zoom factor.
 */
function electZoomFactor(metricResults, defaultZoomFactor) {
  let totalWeight = 0.0;
  for (let i = 0, len = metricResults.length; i < len; ++i) {
    totalWeight += metricResults[i].weight * metricResults[i].confidence;
  }

  /**
   * Predefined zoom factors.
   * See components/ui/zoom/page_zoom_constants.h
   */
  let ZOOM_FACTORS = [0.25, 0.333, 0.5, 0.666, 0.75, 0.9, 1,
                      1.1, 1.25, 1.5, 1.75, 2, 2.5, 3, 4, 5];

  /**
   * Return the predefined zoom factor that's closest to the given zoom factor.
   * @param {number} targetZoomFactor The zoom factor to round.
   * @return {number} The rounded zoom factor.
   */
  function closestZoomFactor(targetZoomFactor) {
    if (ZOOM_FACTORS[0] >= targetZoomFactor) {
      return ZOOM_FACTORS[0];
    } else if (ZOOM_FACTORS[ZOOM_FACTORS.length - 1] <= targetZoomFactor) {
      return ZOOM_FACTORS[ZOOM_FACTORS.length - 1];
    } else {
      for (let i = 0, len = ZOOM_FACTORS.length; i + 1 < len; ++i) {
        let below = ZOOM_FACTORS[i];
        let above = ZOOM_FACTORS[i + 1];
        if (targetZoomFactor >= below && targetZoomFactor <= above) {
          return (Math.abs(targetZoomFactor - below) <
                  Math.abs(targetZoomFactor - above)) ? below : above;
        }
      }
    }
  }

  // votes[i] stores the number of votes given to ZOOM_FACTORS[i].
  let votes = new Array(ZOOM_FACTORS.length);
  for (let i = 0, len = votes.length; i < len; ++i) {
    votes[i] = 0;
  }

  // Initial voting.
  for (let i = 0, len = metricResults.length; i < len; ++i) {
    let zoomFactor = closestZoomFactor(metricResults[i].zoom);
    votes[ZOOM_FACTORS.indexOf(zoomFactor)] +=
        metricResults[i].weight * metricResults[i].confidence / totalWeight;
  }

  while (true) {
    let leader = null;
    let loser = null;

    for (let i = 0, len = votes.length; i < len; ++i) {
      if (votes[i] < Number.EPSILON) {
        continue; // Zoom factors that are eliminated are ignored.
      }

      if (leader === null || votes[i] > votes[leader]) {
        leader = i;
      }

      if ((loser === null || votes[i] < votes[loser]) &&
          !zoomValuesEqual(ZOOM_FACTORS[i], defaultZoomFactor)) {
        loser = i;
      }
    }

    // A zoom factor has a majority, so it wins the election.
    if (votes[leader] >= 0.5) {
      return ZOOM_FACTORS[leader];
    }

    // Eliminate last place zoom factor
    // and transfer its votes to the next best zoom factor
    // (the first zoom factor closer to the default zoom factor
    // that has not already been eliminated).
    let nextFactor = loser;
    do {
      if (ZOOM_FACTORS[nextFactor] > defaultZoomFactor) {
        nextFactor -= 1;
      } else {
        nextFactor += 1;
      }
    } while (votes[nextFactor] < Number.EPSILON);

    votes[nextFactor] += votes[loser];
    votes[loser] = 0;
  }
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
    doGetOptions(['idealFontSize', 'metricWeights'])
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
        pageInfo.centeredContainers, currentZoom);
    marginMetric.weight = items.metricWeights.margin;

    let metricResults = [
      defaultMetric,
      fontSizeMetric,
      marginMetric,
    ];

    // TODO(mcnee) Decide on a method of combining metrics.
    // return electZoomFactor(metricResults, zoomSettings.defaultZoomFactor);
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

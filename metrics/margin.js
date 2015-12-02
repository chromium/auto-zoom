// Copyright 2015 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';

var metrics = metrics || {};


/**
 * A metric based on the empty space in the margins of a page.
 */
metrics.margin = {

  /**
   * Find the outermost containers which are centered in the page.
   * @param {Object} message The message that we fill with margin information.
   */
  findMargins: function(message) {
    let bodyComputedStyle = window.getComputedStyle(document.body);
    let bodyContentHeight = elementContentHeight(
        document.body, bodyComputedStyle);
    let bodyContentWidth = elementContentWidth(
        document.body, bodyComputedStyle);

    // The elements in the body are centered with respect to the body.
    message.contentDimensions.height = bodyContentHeight;
    message.contentDimensions.width = bodyContentWidth;

    let widthDeclarations = getWidthDeclarations();

    /**
     * Determine if the element is centered with margins.
     * @param {Object} el The element.
     * @param {Object} computedStyle The result of window.getComputedStyle(el).
     * @param {Object} parentComputedStyle The result of window.getComputedStyle
     *    of el's parent.
     * @param {boolean} parentCenters Whether the parent element causes the
     *    element to be centered.
     * @return {boolean} Whether the element is a centered container.
     */
    function isCenteredContainer(
        el, computedStyle, parentComputedStyle, parentCenters) {
      let marginLeft = parseFloat(computedStyle.marginLeft);
      let marginRight = parseFloat(computedStyle.marginRight);

      /**
       * Since the CSS rule specifying width may have been filtered out,
       * use the element not taking up the full width of its parent as
       * a fallback.
       */
      let widthSpecified = isWidthSpecified(el, widthDeclarations) ||
          el.offsetWidth < elementContentWidth(el.parentElement,
                                               parentComputedStyle);
      let centered = (Math.abs(marginLeft - marginRight) <= 1) || parentCenters;

      return widthSpecified && centered;
    }

    /**
     * Recurse to find the outermost containers which are centered in the page.
     * @param {Object} el The element.
     * @param {Object} parentComputedStyle The result of window.getComputedStyle
     *    of el's parent.
     * @return {boolean} Whether the element or one of its descendants is
     *    a centered container.
     */
    function traverse(el, parentComputedStyle) {
      let computedStyle = window.getComputedStyle(el);
      let totalWidth = elementTotalWidth(el, computedStyle);

      /**
       * The parent element may cause the child to be centered (e.g. using a
       * <center> tag). The child element may not have information about its
       * own margins, so we need to check if the parent is doing this.
       */
      let parentCenters = el.parentElement.align === 'center' ||
          parentComputedStyle.textAlign === 'center' ||
          parentComputedStyle.textAlign === '-webkit-center';

      let spansPage = (Math.abs(totalWidth - bodyContentWidth) <= 1) ||
          (parentCenters && (Math.abs(elementTotalWidth(el.parentElement,
                                                        parentComputedStyle) -
                                      bodyContentWidth) <= 1));
      if (!spansPage) {
        /**
         * Early out if the element does not cover the width of the page.
         * Technically, a descendant could span the width of the page even if
         * its ancestor does not. But I've never encountered a site that does
         * this and checking for this case would require us to traverse the
         * entire DOM for sites that don't have margins.
         */
        return false;
      }

      if (isCenteredContainer(el, computedStyle, parentComputedStyle,
                              parentCenters)) {
        if (el.offsetWidth > 0 && el.offsetHeight > 0) {
          let totalHeight = elementTotalHeight(el, computedStyle);
          let cssWidth = parseFloat(computedStyle.width);
          let relative = isWidthRelativeToViewport(
              el, widthDeclarations, cssWidth, bodyContentWidth);

          message.centeredContainers.push({
            width: el.offsetWidth,
            height: totalHeight,
            relative: relative,
          });

          return true;
        }
      } else {
        let found = false;
        let children = el.children;
        for (let i = 0, len = children.length; i < len; ++i) {
          found = traverse(children[i], computedStyle) || found;
        }
        return found;
      }
    }

    let found = false;
    let children = document.body.children;
    for (let i = 0, len = children.length; i < len; ++i) {
      found = traverse(children[i], bodyComputedStyle) || found;
    }

    /**
     * The body can also be a centered container.
     * In fact, it is by default.
     * So we check the body last so that the body is ignored
     * if there are explicit centered containers in the body.
     */
    if (!found) {
      let documentComputedStyle =
          window.getComputedStyle(document.documentElement);

      if (isCenteredContainer(document.body, bodyComputedStyle,
                              documentComputedStyle, false)) {
        if (document.body.offsetWidth > 0 && document.body.offsetHeight > 0) {
          let bodyTotalHeight = elementTotalHeight(
              document.body, bodyComputedStyle);
          let documentContentHeight = elementContentHeight(
              document.documentElement, documentComputedStyle);
          let documentContentWidth = elementContentWidth(
              document.documentElement, documentComputedStyle);

          let bodyCssWidth = parseFloat(bodyComputedStyle.width);
          let relative = isWidthRelativeToViewport(
              document.body, widthDeclarations,
              bodyCssWidth,
              documentContentWidth);

          message.centeredContainers.push({
            width: document.body.offsetWidth,
            height: bodyTotalHeight,
            relative: relative,
          });

          // The body is centered with respect to the document.
          message.contentDimensions.height = documentContentHeight;
          message.contentDimensions.width = documentContentWidth;
        }
      }
    }
  },

  /**
   * Return the ideal zoom factor given margin information.
   * @param {Object} contentDimensions The dimensions of the body content.
   * @param {Array<Object>} centeredContainers The sizes of each of
   *    the centered containers.
   * @param {number} currentZoom The current zoom factor.
   * @return {Object} The computed zoom factor and confidence.
   */
  compute: function(contentDimensions, centeredContainers, currentZoom) {
    /**
     * TODO(mcnee) Zooming when the width is defined relative to the viewport
     * does not affect the size of the margins. If we had access to the page
     * scale factor, we could address this problem by scaling the page instead.
     * It is currently not available to extensions, so for now we ignore
     * containers with relative widths.
     */
    let maxContainerWidth;
    let totalHeight = 0.0;
    for (let i = 0, len = centeredContainers.length; i < len; ++i) {
      if (!centeredContainers[i].relative) {
        let width = centeredContainers[i].width;
        width /= currentZoom;

        if (!maxContainerWidth || width > maxContainerWidth) {
          maxContainerWidth = width;
        }

        totalHeight += centeredContainers[i].height;
      }
    }

    if (!maxContainerWidth || !contentDimensions.height) {
      return {zoom: 0, confidence: 0};
    }

    // TODO(mcnee) Add an option for the amount of margin space desired.
    return {
      zoom: contentDimensions.width / maxContainerWidth,
      confidence: totalHeight / contentDimensions.height
    };
  }
};


/**
 * Return whether there is a CSS declaration which sets the element's width.
 * @param {Object} el The element.
 * @param {Object<string, Array<string>>} widthDeclarations The width
 *    declarations for each selector.
 * @return {boolean} Whether the width is specified.
 */
function isWidthSpecified(el, widthDeclarations) {
  function isSpecified(declaration) {
    return !isNaN(parseFloat(declaration)) && declaration !== '100%';
  }

  return checkWidthDeclarations_(el, widthDeclarations, isSpecified);
}


/**
 * Return whether there is a CSS declaration which sets the element's width
 * as a percentage of the viewport.
 * @param {Object} el The element.
 * @param {Object<string, Array<string>>} widthDeclarations The width
 *    declarations for each selector.
 * @param {number} cssWidth The computed style for el's width.
 * @param {number} viewportContentWidth The content width of the body
 *    or if el is the body, then the content width of the document.
 * @return {boolean} Whether the width is specified.
 */
function isWidthRelativeToViewport(
    el, widthDeclarations, cssWidth, viewportContentWidth) {
  function isRelative(declaration) {
    let isPercent = declaration.indexOf('%') !== -1;
    let percentWidth = parseFloat(declaration);
    return (isPercent &&
        !isNaN(percentWidth) &&
        (Math.abs(viewportContentWidth * (percentWidth / 100) -
                  cssWidth) <= 1));
  }

  return checkWidthDeclarations_(el, widthDeclarations, isRelative);
}


/**
 * Return whether there is a CSS declaration which satisfies predicate.
 * @param {Object} el The element.
 * @param {Object<string, Array<string>>} widthDeclarations The width
 *    declarations for each selector.
 * @param {function(string): boolean} predicate The function which
 *    checks each declaration.
 * @return {boolean} Whether the width is specified.
 */
function checkWidthDeclarations_(el, widthDeclarations, predicate) {
  for (let selector in widthDeclarations) {
    if (el.matches(selector)) {
      let declarations = widthDeclarations[selector];
      for (let i = 0, len = declarations.length; i < len; ++i) {
        if (predicate(declarations[i])) {
          return true;
        }
      }
    }
  }

  // Also check any widths defined on the element.
  if ((el.style.width && predicate(el.style.width)) ||
      (el.width && predicate(el.width.toString()))) {
    return true;
  }

  return false;
}


/**
 * Return a mapping of selectors to the CSS width declarations that
 * apply to them.
 * Note that the style sheets we can access via document.styleSheets
 * are filtered (e.g. no cross origin rules), so this not reliable.
 * @return {Object<string, Array<string>>} The width declarations
 *    for each selector.
 */
function getWidthDeclarations() {
  let declarations = {};

  function processRuleList(rules) {
    if (!rules) {
      return;
    }

    for (let j = 0, rulesLen = rules.length; j < rulesLen; ++j) {
      if (rules[j].type === CSSRule.STYLE_RULE) {
        let selectorText = rules[j].selectorText;
        let width = rules[j].style.getPropertyValue('width');
        let maxWidth = rules[j].style.getPropertyValue('max-width');

        if ((width || maxWidth) && !declarations.hasOwnProperty(selectorText)) {
          declarations[selectorText] = [];
        }
        if (width) {
          declarations[selectorText].push(width);
        }
        if (maxWidth) {
          declarations[selectorText].push(maxWidth);
        }
      } else if (rules[j].type === CSSRule.MEDIA_RULE &&
                 window.matchMedia(rules[j].media.mediaText).matches) {
        processRuleList(rules[j].cssRules);
      }
    }
  }

  let sheets = document.styleSheets;
  for (let i = 0, sheetsLen = sheets.length; i < sheetsLen; ++i) {
    processRuleList(sheets[i].cssRules);
  }

  return declarations;
}

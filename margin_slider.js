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
 * Saves the option in storage.
 */
function saveOption() {
  let idealPageWidth = $('idealPageWidth').value / 100;

  doSetOptions({idealPageWidth: idealPageWidth});
}


/**
 * Restores the option from storage.
 */
function restoreOption() {
  doGetOptions('idealPageWidth').then(function(items) {
    $('idealPageWidth').value = items.idealPageWidth * 100;
  }).then(adjustContainerWidth);
}


/**
 * Change the width of the container to reflect the value of the option.
 */
function adjustContainerWidth() {
  $('container').style.width = $('idealPageWidth').value + '%';
}


$('idealPageWidth').addEventListener('input', adjustContainerWidth);
$('idealPageWidth').addEventListener('input', saveOption);

document.addEventListener('DOMContentLoaded', restoreOption);

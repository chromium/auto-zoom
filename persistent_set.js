// Copyright 2015 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

'use strict';


/**
 * A set of values that are kept in persistent storage.
 */
class PersistentSet {
  /**
   * @param {string} storageKey The key to use to store the set.
   */
  constructor(storageKey) {
    this.storageKey_ = storageKey;
  }

  /**
   * Adds a value to the set.
   * @param {*} value The value to add.
   * @return {Promise} A promise that will resolve when the value is added.
   */
  add(value) {
    return this.getStorage_().then(function(persistentSet) {
      persistentSet.add(value);
      return this.setStorage_(persistentSet);
    }.bind(this));
  }

  /**
   * Deletes a value from the set.
   * @param {*} value The value to delete.
   * @return {Promise} A promise that will resolve when the value is deleted.
   */
  delete(value) {
    return this.getStorage_().then(function(persistentSet) {
      if (persistentSet.has(value)) {
        persistentSet.delete(value);
        return this.setStorage_(persistentSet);
      }
    }.bind(this));
  }

  /**
   * Determine if a value is in the set.
   * @param {*} value The value to check.
   * @return {Promise<boolean>} A promise that will resolve
   *    to whether the value is in the set.
   */
  has(value) {
    return this.getStorage_().then(function(persistentSet) {
      return persistentSet.has(value);
    });
  }

  /**
   * Deletes all elements from the set.
   * @return {Promise} A promise that will resolve when the set is cleared.
   */
  clear() {
    return doStorageLocalRemove(this.storageKey_);
  }

  /**
   * Gets the set from persistent storage.
   * @private
   * @return {Promise<Set>} A promise that will resolve to a Set with the
   *    persisted values.
   */
  getStorage_() {
    return doStorageLocalGet(this.storageKey_).then(function(data) {
      return new Set(data[this.storageKey_] || []);
    }.bind(this));
  }

  /**
   * Store the set into persistent storage.
   * @private
   * @param {Set} persistentSet The Set to store in persistent storage.
   * @return {Promise} A promise that will resolve when the set is stored.
   */
  setStorage_(persistentSet) {
    let data = {};
    data[this.storageKey_] = Array.from(persistentSet);

    return doStorageLocalSet(data);
  }
};

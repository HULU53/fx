'use strict'

const storage = require('@system.storage')

const SETTINGS_KEY = 'fx.settings.v1'
const DEFAULTS = {
  studentMode: false,
  logEnabled: true
}

let cached = {
  studentMode: DEFAULTS.studentMode,
  logEnabled: DEFAULTS.logEnabled
}
let loaded = false

function normalize(value) {
  const source = value || {}
  return {
    studentMode: source.studentMode === true,
    logEnabled: source.logEnabled !== false
  }
}

function current() {
  return normalize(cached)
}

function unpackStorageValue(data) {
  if (data && typeof data === 'object' && Object.prototype.hasOwnProperty.call(data, 'data')) {
    return data.data
  }
  return data
}

function load(callback) {
  const done = typeof callback === 'function' ? callback : function () {}
  storage.get({
    key: SETTINGS_KEY,
    success: function (data) {
      const raw = unpackStorageValue(data)
      let parsed = {}
      try {
        if (raw) {
          parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
        }
      } catch (error) {
        parsed = {}
      }
      cached = normalize(parsed)
      loaded = true
      done(current())
    },
    fail: function () {
      cached = normalize(DEFAULTS)
      loaded = true
      done(current())
    }
  })
}

function save(value, callback) {
  cached = normalize(value)
  loaded = true
  storage.set({
    key: SETTINGS_KEY,
    value: JSON.stringify(cached),
    success: function () {
      if (callback) {
        callback(true, current())
      }
    },
    fail: function () {
      if (callback) {
        callback(false, current())
      }
    }
  })
}

function update(partial, callback) {
  const next = normalize(Object.assign({}, current(), partial || {}))
  save(next, callback)
}

module.exports = {
  SETTINGS_KEY: SETTINGS_KEY,
  DEFAULTS: DEFAULTS,
  normalize: normalize,
  current: current,
  isLoaded: function () {
    return loaded
  },
  load: load,
  save: save,
  update: update
}

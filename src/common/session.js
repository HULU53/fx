'use strict'

const storage = require('@system.storage')

const RESULT_KEY = 'fx.session.result.v1'
const MODULE_KEY = 'fx.session.module.v1'
const drafts = {}
const results = {}

let activeModuleId = ''

function draftKey(moduleId, modeId) {
  return String(moduleId) + '::' + String(modeId)
}

function createDraft(mode) {
  return {
    lines: [''],
    activeLine: 0,
    multiLine: Boolean(mode && mode.multiLine)
  }
}

function unpackStorageValue(data) {
  if (data && typeof data === 'object' && Object.prototype.hasOwnProperty.call(data, 'data')) {
    return data.data
  }
  return data
}

function openModule(moduleId) {
  const callback = arguments.length > 1 && typeof arguments[1] === 'function'
    ? arguments[1]
    : function () {}
  activeModuleId = moduleId
  storage.set({
    key: MODULE_KEY,
    value: moduleId,
    success: function () {
      callback(true)
    },
    fail: function () {
      callback(false)
    }
  })
}

function getActiveModuleId() {
  return activeModuleId
}

function loadActiveModule(callback) {
  if (activeModuleId) {
    callback(activeModuleId)
    return
  }
  storage.get({
    key: MODULE_KEY,
    success: function (data) {
      const raw = unpackStorageValue(data)
      const value = raw ? String(raw) : ''
      activeModuleId = value
      callback(value)
    },
    fail: function () {
      callback('')
    }
  })
}

function getDraft(moduleId, mode) {
  const key = draftKey(moduleId, mode.id)
  if (!drafts[key]) {
    drafts[key] = createDraft(mode)
  }
  return drafts[key]
}

function setDraft(moduleId, modeId, value) {
  drafts[draftKey(moduleId, modeId)] = value
}

function setResult(moduleId, modeId, inputs, result) {
  const callback = arguments.length > 4 && typeof arguments[4] === 'function'
    ? arguments[4]
    : function () {}
  const record = {
    moduleId: moduleId,
    modeId: modeId,
    inputs: inputs.slice(),
    result: result
  }
  results.current = record
  storage.set({
    key: RESULT_KEY,
    value: JSON.stringify(record),
    success: function () {
      callback(true)
    },
    fail: function () {
      callback(false)
    }
  })
}

function getResult() {
  return results.current || null
}

function loadResult(callback) {
  if (results.current) {
    callback(results.current)
    return
  }
  storage.get({
    key: RESULT_KEY,
    success: function (data) {
      const raw = unpackStorageValue(data)
      if (!raw) {
        callback(null)
        return
      }
      try {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
        if (!parsed || !parsed.result) {
          callback(null)
          return
        }
        results.current = parsed
        callback(parsed)
      } catch (error) {
        callback(null)
      }
    },
    fail: function () {
      callback(null)
    }
  })
}

function clearResult() {
  results.current = null
  clearPersistedResult()
}

function clearPersistedResult() {
  storage.set({
    key: RESULT_KEY,
    value: '',
    success: function () {},
    fail: function () {}
  })
}

function clearPersistedModule() {
  storage.set({
    key: MODULE_KEY,
    value: '',
    success: function () {},
    fail: function () {}
  })
}

module.exports = {
  RESULT_KEY: RESULT_KEY,
  MODULE_KEY: MODULE_KEY,
  openModule: openModule,
  getActiveModuleId: getActiveModuleId,
  loadActiveModule: loadActiveModule,
  getDraft: getDraft,
  setDraft: setDraft,
  setResult: setResult,
  getResult: getResult,
  loadResult: loadResult,
  clearResult: clearResult,
  clearPersistedResult: clearPersistedResult,
  clearPersistedModule: clearPersistedModule
}

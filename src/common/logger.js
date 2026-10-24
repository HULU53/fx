'use strict'

const LOG_DIR = 'internal://files/logs/'
const LOG_URI = LOG_DIR + 'fX.log.txt'
const LOG_BACKUP_URI = LOG_DIR + 'fX.log.1.txt'
const MAX_LOG_BYTES = 256 * 1024
const MAX_PENDING = 200

function pad(value, length) {
  let text = String(value)
  while (text.length < length) {
    text = '0' + text
  }
  return text
}

function timestamp() {
  const now = new Date()
  return now.getFullYear() + '-' +
    pad(now.getMonth() + 1, 2) + '-' +
    pad(now.getDate(), 2) + ' ' +
    pad(now.getHours(), 2) + ':' +
    pad(now.getMinutes(), 2) + ':' +
    pad(now.getSeconds(), 2) + '.' +
    pad(now.getMilliseconds(), 3)
}

function serialize(value) {
  if (typeof value === 'string') {
    return value
  }
  if (value instanceof Error) {
    return value.name + ': ' + value.message + (value.stack ? '\n' + value.stack : '')
  }
  if (typeof value === 'undefined') {
    return 'undefined'
  }
  try {
    return JSON.stringify(value)
  } catch (error) {
    try {
      return String(value)
    } catch (nestedError) {
      return '[unserializable]'
    }
  }
}

function safeConsole(level, message) {
  try {
    const target = console[level] || console.log
    if (target) {
      target.call(console, '[fX][LOGGER] ' + message)
    }
  } catch (error) {
  }
}

function callFile(adapter, method, options) {
  return new Promise(function (resolve, reject) {
    if (!adapter || typeof adapter[method] !== 'function') {
      reject({ message: 'file method unavailable: ' + method })
      return
    }
    const next = Object.assign({}, options || {}, {
      success: function (result) {
        resolve(result || {})
      },
      fail: function (data, code) {
        reject({ data: data, code: code, method: method })
      }
    })
    try {
      adapter[method](next)
    } catch (error) {
      reject(error)
    }
  })
}

function createLogger(adapter) {
  const state = {
    enabled: false,
    ready: false,
    initializing: null,
    writing: false,
    pending: [],
    failureReported: false
  }

  function fallback(message) {
    if (!state.failureReported) {
      state.failureReported = true
      safeConsole('warn', 'file logging unavailable; ' + message)
    }
  }

  function enqueue(line) {
    if (!state.enabled) {
      return
    }
    state.pending.push(line)
    if (state.pending.length > MAX_PENDING) {
      state.pending.splice(0, state.pending.length - MAX_PENDING)
    }
    flush()
  }

  function flush() {
    if (!state.enabled || !state.ready || state.writing || !state.pending.length) {
      return
    }
    state.writing = true
    const line = state.pending.shift() + '\n'
    callFile(adapter, 'writeText', {
      uri: LOG_URI,
      text: line,
      append: true
    }).then(function () {
      state.writing = false
      flush()
    }).catch(function (error) {
      state.writing = false
      fallback(serialize(error))
      if (state.pending.length > MAX_PENDING) {
        state.pending.splice(0, state.pending.length - MAX_PENDING)
      }
    })
  }

  function ensureDirectory() {
    return callFile(adapter, 'access', { uri: LOG_DIR })
      .then(function () {
        return true
      })
      .catch(function () {
        return callFile(adapter, 'mkdir', {
          uri: LOG_DIR,
          recursive: true
        }).catch(function (error) {
          return callFile(adapter, 'access', { uri: LOG_DIR }).then(function () {
            return true
          })
        })
      })
  }

  function getLogSize() {
    return callFile(adapter, 'get', { uri: LOG_URI })
      .then(function (info) {
        const direct = Number(info.size || info.length || 0)
        if (direct > 0) {
          return direct
        }
        if (info && info.file && Number(info.file.size)) {
          return Number(info.file.size)
        }
        return 0
      })
      .catch(function () {
        return 0
      })
  }

  function rotateIfNeeded() {
    return getLogSize().then(function (size) {
      if (size < MAX_LOG_BYTES) {
        return true
      }
      return callFile(adapter, 'delete', { uri: LOG_BACKUP_URI })
        .catch(function () {
          return null
        })
        .then(function () {
          return callFile(adapter, 'move', {
            srcUri: LOG_URI,
            dstUri: LOG_BACKUP_URI
          })
        })
        .catch(function (error) {
          fallback('rotation failed: ' + serialize(error))
          return true
        })
    })
  }

  function initialize(enabled, options) {
    const showHeader = !options || options.showHeader !== false
    state.enabled = enabled !== false
    if (!state.enabled) {
      return Promise.resolve(false)
    }
    if (state.initializing) {
      return state.initializing
    }
    state.initializing = ensureDirectory()
      .then(rotateIfNeeded)
      .then(function () {
        state.ready = true
        if (showHeader) {
          state.pending.unshift(
            '============================================================\n' +
            '[' + timestamp() + '] [INFO] [LOGGER] file=' + LOG_URI
          )
        }
        flush()
        return true
      })
      .catch(function (error) {
        state.ready = false
        state.initializing = null
        fallback(serialize(error))
        return false
      })
    return state.initializing
  }

  function configure(enabled) {
    state.enabled = enabled !== false
    if (!state.enabled) {
      state.pending = []
    }
    if (state.enabled && !state.ready) {
      return initialize(true)
    }
    return Promise.resolve(state.enabled)
  }

  function write(level, area, values) {
    if (!state.enabled) {
      return
    }
    const body = values.map(serialize).join(' ')
    enqueue('[' + timestamp() + '] [' + level + '] [' + area + '] ' + body)
  }

  function info(area) {
    write('INFO', area, Array.prototype.slice.call(arguments, 1))
  }

  function warn(area) {
    write('WARN', area, Array.prototype.slice.call(arguments, 1))
  }

  function error(area) {
    write('ERROR', area, Array.prototype.slice.call(arguments, 1))
  }

  function captureError(area, err) {
    write('ERROR', area, [err])
  }

  function truncateInput(text) {
    const value = String(text || '')
    return value.length > 60 ? value.slice(0, 60) + '...' : value
  }

  function stateSnapshot() {
    return {
      enabled: state.enabled,
      ready: state.ready,
      pending: state.pending.length,
      writing: state.writing
    }
  }

  return {
    LOG_URI: LOG_URI,
    LOG_BACKUP_URI: LOG_BACKUP_URI,
    initialize: initialize,
    configure: configure,
    info: info,
    warn: warn,
    error: error,
    captureError: captureError,
    truncateInput: truncateInput,
    state: stateSnapshot
  }
}

let systemFile = null
try {
  systemFile = require('@system.file')
} catch (error) {
  systemFile = null
}

const defaultLogger = createLogger(systemFile)

defaultLogger.LOG_DIR = LOG_DIR
defaultLogger.MAX_LOG_BYTES = MAX_LOG_BYTES
defaultLogger.create = createLogger

module.exports = defaultLogger

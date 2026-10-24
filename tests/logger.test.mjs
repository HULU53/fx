import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const loggerModule = require('../src/common/logger.js')

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function createFakeFile() {
  const files = new Map()
  const calls = []
  const adapter = {
    access(options) {
      calls.push(['access', options.uri])
      if (files.has(options.uri) || options.uri.endsWith('/')) {
        options.success({})
      } else {
        options.fail({ message: 'missing' }, 404)
      }
    },
    mkdir(options) {
      calls.push(['mkdir', options.uri])
      files.set(options.uri, '')
      options.success({})
    },
    get(options) {
      calls.push(['get', options.uri])
      options.success({ size: files.get(options.uri)?.length || 0 })
    },
    writeText(options) {
      calls.push(['writeText', options.uri, options.text, options.append])
      const previous = options.append ? (files.get(options.uri) || '') : ''
      files.set(options.uri, previous + options.text)
      options.success({})
    },
    delete(options) {
      calls.push(['delete', options.uri])
      files.delete(options.uri)
      options.success({})
    },
    move(options) {
      calls.push(['move', options.srcUri, options.dstUri])
      files.set(options.dstUri, files.get(options.srcUri) || '')
      files.delete(options.srcUri)
      options.success({})
    }
  }
  return { adapter, files, calls }
}

test('logger stays silent while disabled', async () => {
  const fake = createFakeFile()
  const logger = loggerModule.create(fake.adapter)
  await logger.initialize(false)
  logger.info('TEST', 'ignored')
  await wait(10)
  assert.equal(fake.calls.length, 0)
  assert.equal(logger.state().enabled, false)
})

test('logger appends serialized lines to the sandbox log', async () => {
  const fake = createFakeFile()
  const logger = loggerModule.create(fake.adapter)
  await logger.initialize(true)
  logger.info('TEST', 'value', { answer: 42 })
  logger.warn('TEST', 'warning')
  await wait(20)
  const content = fake.files.get(logger.LOG_URI)
  assert.match(content, /\[INFO\] \[TEST\] value \{"answer":42\}/)
  assert.match(content, /\[WARN\] \[TEST\] warning/)
  assert.equal(logger.LOG_URI, 'internal://files/logs/fX.log.txt')
})

test('logger disables further writes and can resume', async () => {
  const fake = createFakeFile()
  const logger = loggerModule.create(fake.adapter)
  await logger.initialize(true)
  logger.info('TEST', 'before')
  await logger.configure(false)
  logger.info('TEST', 'while-off')
  await wait(10)
  assert.doesNotMatch(fake.files.get(logger.LOG_URI), /while-off/)
  await logger.configure(true)
  logger.info('TEST', 'after')
  await wait(20)
  assert.match(fake.files.get(logger.LOG_URI), /after/)
})

test('logger rotates a file larger than 256 KB before new writes', async () => {
  const fake = createFakeFile()
  const logger = loggerModule.create(fake.adapter)
  fake.files.set(logger.LOG_URI, 'x'.repeat(256 * 1024))
  await logger.initialize(true)
  logger.info('TEST', 'fresh')
  await wait(20)
  assert.equal(fake.files.get(logger.LOG_BACKUP_URI).length, 256 * 1024)
  assert.match(fake.files.get(logger.LOG_URI), /fresh/)
  assert.equal(fake.calls.some(call => call[0] === 'move'), true)
})

test('input logging truncates long expressions', () => {
  const logger = loggerModule.create(createFakeFile().adapter)
  assert.equal(logger.truncateInput('x'.repeat(80)).length, 63)
  assert.match(logger.truncateInput('x'.repeat(80)), /\.\.\.$/)
})

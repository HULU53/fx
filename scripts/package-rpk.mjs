import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const mode = process.argv[2]
if (mode !== 'build' && mode !== 'release') {
  throw new Error('Expected build or release mode')
}

const modulePath = path.join(
  root,
  'node_modules',
  '@aiot-toolkit',
  'aiotpack',
  'lib',
  'compiler',
  'javascript',
  'vela',
  'utils',
  'ZipUtil.js'
)
const ZipUtil = require(modulePath).default
const params = {
  projectPath: root,
  sourceRoot: './src',
  outputPath: './build',
  releasePath: './dist',
  signRoot: './sign',
  mode: mode === 'release' ? 'production' : 'development',
  buildNameFormat: 1
}

const buildPath = path.join(root, 'build')
const fileName = await ZipUtil.createRpk(buildPath, params)
if (!fileName) {
  throw new Error('RPK packaging produced no fileName')
}
const artifactPath = path.join(root, 'dist', fileName)
process.stdout.write('RPK ready: ' + artifactPath + '\n')

'use strict'

const WIDTH = 384
const HEIGHT = 260
const PADDING = 26

function createCanvasBuffer(width, height, background) {
  const pixels = new Uint8Array(width * height * 4)
  for (let index = 0; index < width * height; index += 1) {
    const offset = index * 4
    pixels[offset] = background[0]
    pixels[offset + 1] = background[1]
    pixels[offset + 2] = background[2]
    pixels[offset + 3] = 255
  }
  return {
    width: width,
    height: height,
    pixels: pixels
  }
}

function setPixel(canvas, x, y, color) {
  const px = Math.round(x)
  const py = Math.round(y)
  if (px < 0 || px >= canvas.width || py < 0 || py >= canvas.height) {
    return
  }
  const offset = (py * canvas.width + px) * 4
  canvas.pixels[offset] = color[0]
  canvas.pixels[offset + 1] = color[1]
  canvas.pixels[offset + 2] = color[2]
  canvas.pixels[offset + 3] = 255
}

function drawLine(canvas, x0, y0, x1, y1, color, width) {
  let left = Math.round(x0)
  let top = Math.round(y0)
  const right = Math.round(x1)
  const bottom = Math.round(y1)
  const dx = Math.abs(right - left)
  const sx = left < right ? 1 : -1
  const dy = -Math.abs(bottom - top)
  const sy = top < bottom ? 1 : -1
  let error = dx + dy
  const thickness = Math.max(1, width || 1)
  while (true) {
    for (let ox = 0; ox < thickness; ox += 1) {
      for (let oy = 0; oy < thickness; oy += 1) {
        setPixel(canvas, left + ox, top + oy, color)
      }
    }
    if (left === right && top === bottom) {
      break
    }
    const twice = 2 * error
    if (twice >= dy) {
      error += dy
      left += sx
    }
    if (twice <= dx) {
      error += dx
      top += sy
    }
  }
}

function drawDot(canvas, x, y, radius, color) {
  const size = Math.max(1, radius)
  for (let ox = -size; ox <= size; ox += 1) {
    for (let oy = -size; oy <= size; oy += 1) {
      if (ox * ox + oy * oy <= size * size) {
        setPixel(canvas, Math.round(x) + ox, Math.round(y) + oy, color)
      }
    }
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function renderGraph(graph, width, height) {
  const canvas = createCanvasBuffer(width || WIDTH, height || HEIGHT, [17, 25, 22])
  const plotWidth = canvas.width - PADDING * 2
  const plotHeight = canvas.height - PADDING * 2
  const xMin = graph.xMin
  const xMax = graph.xMax
  const yMin = graph.yMin
  const yMax = graph.yMax
  const toX = function (x) {
    return PADDING + (x - xMin) / (xMax - xMin) * plotWidth
  }
  const toY = function (y) {
    return PADDING + (yMax - y) / (yMax - yMin) * plotHeight
  }

  const gridColor = [43, 61, 53]
  const axisColor = [137, 164, 153]
  for (let x = Math.ceil(xMin); x <= Math.floor(xMax); x += 1) {
    const px = toX(x)
    drawLine(canvas, px, PADDING, px, canvas.height - PADDING, gridColor, 1)
  }
  for (let y = Math.ceil(yMin); y <= Math.floor(yMax); y += 1) {
    const py = toY(y)
    drawLine(canvas, PADDING, py, canvas.width - PADDING, py, gridColor, 1)
  }
  if (yMin <= 0 && yMax >= 0) {
    drawLine(canvas, PADDING, toY(0), canvas.width - PADDING, toY(0), axisColor, 2)
  }
  if (xMin <= 0 && xMax >= 0) {
    drawLine(canvas, toX(0), PADDING, toX(0), canvas.height - PADDING, axisColor, 2)
  }

  const asymptotes = graph.asymptotes || []
  for (let index = 0; index < asymptotes.length; index += 1) {
    if (typeof asymptotes[index].x === 'number') {
      drawLine(canvas, toX(asymptotes[index].x), PADDING, toX(asymptotes[index].x), canvas.height - PADDING, [214, 171, 86], 1)
    }
    if (typeof asymptotes[index].y === 'number') {
      drawLine(canvas, PADDING, toY(asymptotes[index].y), canvas.width - PADDING, toY(asymptotes[index].y), [214, 171, 86], 1)
    }
  }

  const lines = graph.lines || []
  const curveColor = [77, 224, 175]
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const points = lines[lineIndex].points || []
    let previous = null
    for (let pointIndex = 0; pointIndex < points.length; pointIndex += 1) {
      const point = points[pointIndex]
      if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
        previous = null
        continue
      }
      const current = {
        x: clamp(toX(point.x), PADDING, canvas.width - PADDING),
        y: clamp(toY(point.y), PADDING, canvas.height - PADDING)
      }
      if (previous) {
        drawLine(canvas, previous.x, previous.y, current.x, current.y, curveColor, 2)
      }
      previous = current
    }
  }

  const keyPoints = graph.keyPoints || []
  for (let index = 0; index < keyPoints.length; index += 1) {
    const point = keyPoints[index]
    if (Number.isFinite(point.x) && Number.isFinite(point.y)) {
      drawDot(
        canvas,
        clamp(toX(point.x), PADDING, canvas.width - PADDING),
        clamp(toY(point.y), PADDING, canvas.height - PADDING),
        3,
        [240, 190, 91]
      )
    }
  }
  return canvas
}

const CRC_TABLE = (function () {
  const table = new Uint32Array(256)
  for (let index = 0; index < 256; index += 1) {
    let value = index
    for (let bit = 0; bit < 8; bit += 1) {
      value = (value & 1) ? (0xedb88320 ^ (value >>> 1)) : (value >>> 1)
    }
    table[index] = value >>> 0
  }
  return table
})()

function crc32(bytes) {
  let crc = 0xffffffff
  for (let index = 0; index < bytes.length; index += 1) {
    crc = CRC_TABLE[(crc ^ bytes[index]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function adler32(bytes) {
  let a = 1
  let b = 0
  for (let index = 0; index < bytes.length; index += 1) {
    a = (a + bytes[index]) % 65521
    b = (b + a) % 65521
  }
  return ((b << 16) | a) >>> 0
}

function writeUint32(array, offset, value) {
  array[offset] = (value >>> 24) & 0xff
  array[offset + 1] = (value >>> 16) & 0xff
  array[offset + 2] = (value >>> 8) & 0xff
  array[offset + 3] = value & 0xff
}

function ascii(text) {
  const result = new Uint8Array(text.length)
  for (let index = 0; index < text.length; index += 1) {
    result[index] = text.charCodeAt(index)
  }
  return result
}

function joinChunks(chunks) {
  let length = 0
  for (let index = 0; index < chunks.length; index += 1) {
    length += chunks[index].length
  }
  const result = new Uint8Array(length)
  let offset = 0
  for (let index = 0; index < chunks.length; index += 1) {
    result.set(chunks[index], offset)
    offset += chunks[index].length
  }
  return result
}

function pngChunk(type, data) {
  const typeBytes = ascii(type)
  const output = new Uint8Array(12 + data.length)
  writeUint32(output, 0, data.length)
  output.set(typeBytes, 4)
  output.set(data, 8)
  const crcInput = new Uint8Array(typeBytes.length + data.length)
  crcInput.set(typeBytes, 0)
  crcInput.set(data, typeBytes.length)
  writeUint32(output, 8 + data.length, crc32(crcInput))
  return output
}

function zlibStore(bytes) {
  const blockSize = 65535
  const blocks = Math.ceil(bytes.length / blockSize)
  const output = new Uint8Array(2 + bytes.length + blocks * 5 + 4)
  output[0] = 0x78
  output[1] = 0x01
  let inputOffset = 0
  let outputOffset = 2
  for (let block = 0; block < blocks; block += 1) {
    const length = Math.min(blockSize, bytes.length - inputOffset)
    output[outputOffset] = block === blocks - 1 ? 1 : 0
    outputOffset += 1
    output[outputOffset] = length & 0xff
    output[outputOffset + 1] = (length >>> 8) & 0xff
    output[outputOffset + 2] = (~length) & 0xff
    output[outputOffset + 3] = ((~length) >>> 8) & 0xff
    outputOffset += 4
    output.set(bytes.subarray(inputOffset, inputOffset + length), outputOffset)
    outputOffset += length
    inputOffset += length
  }
  writeUint32(output, outputOffset, adler32(bytes))
  return output
}

function encodePng(canvas) {
  const rowLength = canvas.width * 4
  const raw = new Uint8Array((rowLength + 1) * canvas.height)
  for (let y = 0; y < canvas.height; y += 1) {
    const target = y * (rowLength + 1)
    raw[target] = 0
    raw.set(canvas.pixels.subarray(y * rowLength, (y + 1) * rowLength), target + 1)
  }
  const header = new Uint8Array(13)
  writeUint32(header, 0, canvas.width)
  writeUint32(header, 4, canvas.height)
  header[8] = 8
  header[9] = 6
  header[10] = 0
  header[11] = 0
  header[12] = 0
  return joinChunks([
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', header),
    pngChunk('IDAT', zlibStore(raw)),
    pngChunk('IEND', new Uint8Array(0))
  ])
}

function createGraphPng(graph) {
  return encodePng(renderGraph(graph))
}

module.exports = {
  WIDTH: WIDTH,
  HEIGHT: HEIGHT,
  createGraphPng: createGraphPng,
  encodePng: encodePng,
  renderGraph: renderGraph
}

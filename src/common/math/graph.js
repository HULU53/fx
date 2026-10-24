'use strict'

function numericPoint(x, y, label) {
  return {
    x: Number(x),
    y: Number(y),
    label: label || ''
  }
}

function sampleBranch(min, max, count, evaluate) {
  const points = []
  for (let index = 0; index <= count; index += 1) {
    const x = min + (max - min) * index / count
    const y = evaluate(x)
    if (Number.isFinite(y) && Math.abs(y) < 1e6) {
      points.push({ x: x, y: y })
    }
  }
  return points
}

function paddedRange(values, fallback, padding) {
  let min = fallback[0]
  let max = fallback[1]
  let seen = false
  for (let index = 0; index < values.length; index += 1) {
    const value = Number(values[index])
    if (!Number.isFinite(value)) {
      continue
    }
    if (!seen) {
      min = value
      max = value
      seen = true
    } else {
      min = Math.min(min, value)
      max = Math.max(max, value)
    }
  }
  if (max - min < 0.5) {
    min -= 1
    max += 1
  }
  const margin = Math.max(0.5, (max - min) * (padding || 0.12))
  return [min - margin, max + margin]
}

function buildLinearGraph(k, b) {
  const lines = []
  const points = sampleBranch(-6, 6, 80, function (x) {
    return k * x + b
  })
  lines.push({ points: points })
  const range = paddedRange([k * -6 + b, k * 6 + b, b], [-6, 6], 0.16)
  const keyPoints = [numericPoint(0, b, '与 y 轴交点')]
  if (k !== 0) {
    keyPoints.push(numericPoint(-b / k, 0, '与 x 轴交点'))
  }
  return {
    type: 'linear',
    xMin: -6,
    xMax: 6,
    yMin: range[0],
    yMax: range[1],
    grid: 1,
    lines: lines,
    keyPoints: keyPoints,
    asymptotes: []
  }
}

function buildInverseGraph(k) {
  const left = sampleBranch(-6, -0.08, 60, function (x) {
    return k / x
  })
  const right = sampleBranch(0.08, 6, 60, function (x) {
    return k / x
  })
  return {
    type: 'inverse',
    xMin: -6,
    xMax: 6,
    yMin: -6,
    yMax: 6,
    grid: 1,
    lines: [{ points: left }, { points: right }],
    keyPoints: [],
    asymptotes: [{ x: 0 }, { y: 0 }]
  }
}

function buildQuadraticGraph(a, b, c, vertex, roots) {
  const center = vertex.x
  const xMin = center - 6
  const xMax = center + 6
  const points = sampleBranch(xMin, xMax, 100, function (x) {
    return a * x * x + b * x + c
  })
  const values = [vertex.y, c, a * xMin * xMin + b * xMin + c, a * xMax * xMax + b * xMax + c]
  for (let index = 0; index < roots.length; index += 1) {
    values.push(0)
  }
  const range = paddedRange(values, [-6, 6], 0.12)
  const keyPoints = [numericPoint(vertex.x, vertex.y, '顶点'), numericPoint(0, c, '与 y 轴交点')]
  for (let index = 0; index < roots.length; index += 1) {
    keyPoints.push(numericPoint(roots[index], 0, '与 x 轴交点'))
  }
  return {
    type: 'quadratic',
    xMin: xMin,
    xMax: xMax,
    yMin: range[0],
    yMax: range[1],
    grid: 1,
    lines: [{ points: points }],
    keyPoints: keyPoints,
    asymptotes: []
  }
}

module.exports = {
  buildLinearGraph: buildLinearGraph,
  buildInverseGraph: buildInverseGraph,
  buildQuadraticGraph: buildQuadraticGraph
}

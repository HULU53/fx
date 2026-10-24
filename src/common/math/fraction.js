'use strict'

function gcd(a, b) {
  let x = Math.abs(Math.trunc(a))
  let y = Math.abs(Math.trunc(b))
  while (y) {
    const next = x % y
    x = y
    y = next
  }
  return x
}

function lcm(a, b) {
  if (!a || !b) {
    return 0
  }
  return Math.abs(a * b) / gcd(a, b)
}

function assertSafeInteger(value, label) {
  if (!Number.isFinite(value) || Math.abs(value) > 9007199254740991) {
    throw new Error((label || '数值') + '过大，无法精确计算')
  }
}

class Fraction {
  constructor(numerator, denominator) {
    const n = Number(numerator)
    const d = denominator === undefined ? 1 : Number(denominator)
    if (!Number.isFinite(n) || !Number.isFinite(d)) {
      throw new Error('分数含有无效数值')
    }
    if (d === 0) {
      throw new Error('除数不能为 0')
    }
    assertSafeInteger(n, '分子')
    assertSafeInteger(d, '分母')
    const sign = d < 0 ? -1 : 1
    const divisor = gcd(n, d)
    this.n = sign * Math.trunc(n / divisor)
    this.d = Math.abs(Math.trunc(d / divisor))
  }

  add(other) {
    const value = Fraction.from(other)
    return new Fraction(
      this.n * value.d + value.n * this.d,
      this.d * value.d
    )
  }

  sub(other) {
    const value = Fraction.from(other)
    return new Fraction(
      this.n * value.d - value.n * this.d,
      this.d * value.d
    )
  }

  mul(other) {
    const value = Fraction.from(other)
    return new Fraction(this.n * value.n, this.d * value.d)
  }

  div(other) {
    const value = Fraction.from(other)
    if (value.isZero()) {
      throw new Error('除数不能为 0')
    }
    return new Fraction(this.n * value.d, this.d * value.n)
  }

  neg() {
    return new Fraction(-this.n, this.d)
  }

  inv() {
    return new Fraction(this.d, this.n)
  }

  pow(exponent) {
    const power = Number(exponent)
    if (!Number.isInteger(power)) {
      throw new Error('指数必须是整数')
    }
    if (power < 0) {
      return this.inv().pow(-power)
    }
    let result = Fraction.ONE
    let base = this
    let count = power
    while (count > 0) {
      if (count % 2 === 1) {
        result = result.mul(base)
      }
      count = Math.floor(count / 2)
      if (count) {
        base = base.mul(base)
      }
    }
    return result
  }

  abs() {
    return this.n < 0 ? this.neg() : this
  }

  isZero() {
    return this.n === 0
  }

  isOne() {
    return this.n === 1 && this.d === 1
  }

  isInteger() {
    return this.d === 1
  }

  sign() {
    return this.n === 0 ? 0 : (this.n > 0 ? 1 : -1)
  }

  equals(other) {
    const value = Fraction.from(other)
    return this.n === value.n && this.d === value.d
  }

  compare(other) {
    const value = Fraction.from(other)
    const left = this.n * value.d
    const right = value.n * this.d
    return left === right ? 0 : (left < right ? -1 : 1)
  }

  toNumber() {
    return this.n / this.d
  }

  toString() {
    return this.d === 1 ? String(this.n) : this.n + '/' + this.d
  }

  static from(value) {
    if (value instanceof Fraction) {
      return value
    }
    if (typeof value === 'number') {
      return new Fraction(value, 1)
    }
    if (typeof value === 'string') {
      return parseFraction(value)
    }
    if (value && typeof value.n === 'number' && typeof value.d === 'number') {
      return new Fraction(value.n, value.d)
    }
    throw new Error('无法转换为分数')
  }
}

const ZERO = new Fraction(0, 1)
const ONE = new Fraction(1, 1)
const TWO = new Fraction(2, 1)
Fraction.ZERO = ZERO
Fraction.ONE = ONE
Fraction.TWO = TWO

function parseFraction(text) {
  const source = String(text).trim()
  if (!source) {
    return ZERO
  }
  if (source.indexOf('/') >= 0) {
    const parts = source.split('/')
    if (parts.length !== 2) {
      throw new Error('分数格式无效')
    }
    return new Fraction(Number(parts[0]), Number(parts[1]))
  }
  if (source.indexOf('.') >= 0) {
    const sign = source.charAt(0) === '-' ? -1 : 1
    const normalized = source.replace(/^[+-]/, '')
    const parts = normalized.split('.')
    const scale = Math.pow(10, parts[1].length)
    const numerator = Number(parts[0] || '0') * scale + Number(parts[1] || '0')
    assertSafeInteger(numerator, '小数')
    return new Fraction(sign * numerator, scale)
  }
  return new Fraction(Number(source), 1)
}

function isPerfectSquareInteger(value) {
  if (value < 0 || Math.abs(value) > 9007199254740991) {
    return false
  }
  const root = Math.round(Math.sqrt(value))
  return root * root === value
}

module.exports = {
  Fraction: Fraction,
  ZERO: ZERO,
  ONE: ONE,
  TWO: TWO,
  gcd: gcd,
  lcm: lcm,
  parseFraction: parseFraction,
  isPerfectSquareInteger: isPerfectSquareInteger
}

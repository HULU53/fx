'use strict'

const Fraction = require('./fraction').Fraction
const Polynomial = require('./polynomial').Polynomial
const ZERO = require('./fraction').ZERO
const ONE = require('./fraction').ONE
const RationalExpression = require('./rational-expression').RationalExpression
const RadicalSum = require('./radical').RadicalSum
const fractionSquareRoot = require('./radical').fractionSquareRoot
const rationalSquareRoot = require('./radical').rationalSquareRoot

function normalizeText(text) {
  return String(text || '')
    .replace(/[−–—]/g, '-')
    .replace(/[×·]/g, '*')
    .replace(/÷/g, '/')
    .replace(/≤/g, '<=')
    .replace(/≥/g, '>=')
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/⁴/g, '^4')
    .replace(/⁵/g, '^5')
    .replace(/⁶/g, '^6')
    .replace(/√/g, 'sqrt')
    .replace(/，/g, ',')
    .replace(/＝/g, '=')
}

function tokenize(text) {
  const source = normalizeText(text)
  const tokens = []
  let index = 0
  while (index < source.length) {
    const char = source.charAt(index)
    if (/\s/.test(char)) {
      index += 1
      continue
    }
    if (/[0-9.]/.test(char)) {
      let start = index
      let dots = 0
      while (index < source.length && /[0-9.]/.test(source.charAt(index))) {
        if (source.charAt(index) === '.') {
          dots += 1
        }
        index += 1
      }
      const value = source.slice(start, index)
      if (dots > 1 || value === '.') {
        throw new Error('小数格式无效：' + value)
      }
      tokens.push({ type: 'number', value: value })
      continue
    }
    if (/[A-Za-z]/.test(char)) {
      let start = index
      while (index < source.length && /[A-Za-z]/.test(source.charAt(index))) {
        index += 1
      }
      tokens.push({ type: 'identifier', value: source.slice(start, index) })
      continue
    }
    const pair = source.slice(index, index + 2)
    if (pair === '<=' || pair === '>=') {
      tokens.push({ type: 'relation', value: pair })
      index += 2
      continue
    }
    if ('+-*/^()=<>,'.indexOf(char) >= 0) {
      tokens.push({
        type: char === '=' || char === '<' || char === '>' ? 'relation' : 'symbol',
        value: char
      })
      index += 1
      continue
    }
    throw new Error('不支持的字符：' + char)
  }
  return tokens
}

class Parser {
  constructor(tokens) {
    this.tokens = tokens
    this.index = 0
  }

  peek() {
    return this.tokens[this.index] || null
  }

  take() {
    const token = this.peek()
    if (!token) {
      throw new Error('表达式不完整')
    }
    this.index += 1
    return token
  }

  match(value) {
    const token = this.peek()
    if (token && token.value === value) {
      this.index += 1
      return true
    }
    return false
  }

  parseRelation() {
    const left = this.parseExpression()
    const token = this.peek()
    if (!token) {
      return { type: 'expression', value: left }
    }
    if (token.type !== 'relation') {
      throw new Error('无法识别的关系符：' + token.value)
    }
    this.take()
    const right = this.parseExpression()
    if (this.peek()) {
      throw new Error('表达式末尾有多余内容')
    }
    return {
      type: token.value === '=' ? 'equation' : 'inequality',
      operator: token.value,
      left: left,
      right: right
    }
  }

  parseExpression() {
    return this.parseAdditive()
  }

  parseAdditive() {
    let node = this.parseMultiplicative()
    while (this.peek() && (this.peek().value === '+' || this.peek().value === '-')) {
      const operator = this.take().value
      node = {
        type: 'binary',
        operator: operator,
        left: node,
        right: this.parseMultiplicative()
      }
    }
    return node
  }

  parseMultiplicative() {
    let node = this.parseUnary()
    while (this.peek()) {
      const token = this.peek()
      if (token.value === '*' || token.value === '/') {
        this.take()
        node = {
          type: 'binary',
          operator: token.value,
          left: node,
          right: this.parseUnary()
        }
        continue
      }
      if (this.startsPrimary(token)) {
        node = {
          type: 'binary',
          operator: '*',
          left: node,
          right: this.parseUnary()
        }
        continue
      }
      break
    }
    return node
  }

  parseUnary() {
    if (this.peek() && this.peek().value === '-') {
      this.take()
      return { type: 'unary', operator: '-', value: this.parseUnary() }
    }
    if (this.peek() && this.peek().value === '+') {
      this.take()
      return this.parseUnary()
    }
    return this.parsePower()
  }

  parsePower() {
    const base = this.parsePrimary()
    if (this.peek() && this.peek().value === '^') {
      this.take()
      return {
        type: 'binary',
        operator: '^',
        left: base,
        right: this.parseUnary()
      }
    }
    return base
  }

  parsePrimary() {
    const token = this.take()
    if (token.type === 'number') {
      return { type: 'number', value: token.value }
    }
    if (token.type === 'identifier') {
      const name = token.value.toLowerCase()
      if (name === 'sqrt') {
        let argument
        if (this.peek() && this.peek().value === '(') {
          this.take()
          argument = this.parseExpression()
          if (!this.match(')')) {
            throw new Error('根号缺少右括号')
          }
        } else {
          argument = this.parseUnary()
        }
        return { type: 'call', name: 'sqrt', argument: argument }
      }
      if (/^[A-Za-z]$/.test(token.value)) {
        return { type: 'variable', name: token.value }
      }
      throw new Error('暂不支持符号：' + token.value)
    }
    if (token.value === '(') {
      const node = this.parseExpression()
      if (!this.match(')')) {
        throw new Error('缺少右括号')
      }
      return node
    }
    throw new Error('无法解析的符号：' + token.value)
  }

  startsPrimary(token) {
    return Boolean(token) &&
      (token.type === 'number' || token.type === 'identifier' || token.value === '(')
  }
}

function parseExpression(text) {
  const source = String(text || '').trim()
  if (!source) {
    throw new Error('请输入表达式')
  }
  if (source.length > 120) {
    throw new Error('输入不能超过 120 个字符')
  }
  const parser = new Parser(tokenize(source))
  const node = parser.parseRelation()
  if (node.type !== 'expression') {
    throw new Error('这里需要表达式，不需要等号或不等号')
  }
  return node.value
}

function parseRelation(text) {
  const source = String(text || '').trim()
  if (!source) {
    throw new Error('请输入等式或不等式')
  }
  if (source.length > 120) {
    throw new Error('输入不能超过 120 个字符')
  }
  const parser = new Parser(tokenize(source))
  return parser.parseRelation()
}

function expressionToPolynomial(node) {
  if (!node) {
    return Polynomial.ZERO
  }
  if (node.type === 'number') {
    return Polynomial.constant(Fraction.from(node.value))
  }
  if (node.type === 'variable') {
    return new Polynomial({ 1: ONE }, node.name)
  }
  if (node.type === 'unary') {
    return expressionToPolynomial(node.value).neg()
  }
  if (node.type === 'binary') {
    const left = expressionToPolynomial(node.left)
    const right = expressionToPolynomial(node.right)
    if (node.operator === '+') {
      return left.add(right)
    }
    if (node.operator === '-') {
      return left.sub(right)
    }
    if (node.operator === '*') {
      return left.mul(right)
    }
    if (node.operator === '/') {
      if (right.degree() !== 0) {
        throw new Error('该式含有字母分母，请使用分式运算')
      }
      return left.scale(right.coefficient(0).inv())
    }
    if (node.operator === '^') {
      if (right.degree() !== 0) {
        throw new Error('指数不能含字母')
      }
      const exponent = right.coefficient(0)
      if (!exponent.isInteger()) {
        throw new Error('指数必须是整数')
      }
      return left.pow(exponent.n)
    }
  }
  if (node.type === 'call' && node.name === 'sqrt') {
    const value = expressionToPolynomial(node.argument)
    if (value.degree() > 0) {
      throw new Error('多项式中的根号内不能含 x')
    }
    const root = rationalSquareRoot(value.coefficient(0))
    if (!root) {
      throw new Error('多项式系数含有非完全平方根式')
    }
    return Polynomial.constant(root)
  }
  throw new Error('无法转换为整式')
}

function expressionToRational(node) {
  if (node.type === 'number') {
    return new RationalExpression(Polynomial.constant(Fraction.from(node.value)), Polynomial.ONE)
  }
  if (node.type === 'variable') {
    return new RationalExpression(new Polynomial({ 1: ONE }, node.name), Polynomial.ONE)
  }
  if (node.type === 'unary') {
    return expressionToRational(node.value).neg()
  }
  if (node.type === 'binary') {
    const left = expressionToRational(node.left)
    const right = expressionToRational(node.right)
    if (node.operator === '+') {
      return left.add(right)
    }
    if (node.operator === '-') {
      return left.sub(right)
    }
    if (node.operator === '*') {
      return left.mul(right)
    }
    if (node.operator === '/') {
      return left.div(right)
    }
    if (node.operator === '^') {
      if (right.numerator.degree() !== 0 || right.denominator.degree() !== 0) {
        throw new Error('指数必须是非负整数')
      }
      const exponent = right.numerator.coefficient(0).div(right.denominator.coefficient(0))
      if (!exponent.isInteger() || exponent.n < 0) {
        throw new Error('指数必须是非负整数')
      }
      let result = RationalExpression.from(1)
      for (let count = 0; count < exponent.n; count += 1) {
        result = result.mul(left)
      }
      return result
    }
  }
  if (node.type === 'call' && node.name === 'sqrt') {
    const value = expressionToPolynomial(node.argument)
    if (value.degree() > 0) {
      throw new Error('分式分子或分母中的根号内不能含 x')
    }
    const root = rationalSquareRoot(value.coefficient(0))
    if (!root) {
      throw new Error('分式中的根式不是有理数')
    }
    return RationalExpression.from(root)
  }
  throw new Error('无法转换为分式')
}

function expressionToRadical(node) {
  if (node.type === 'number') {
    return RadicalSum.fromFraction(Fraction.from(node.value))
  }
  if (node.type === 'variable') {
    throw new Error('二次根式运算的根号外暂不支持字母')
  }
  if (node.type === 'unary') {
    return expressionToRadical(node.value).neg()
  }
  if (node.type === 'binary') {
    const left = expressionToRadical(node.left)
    const right = expressionToRadical(node.right)
    if (node.operator === '+') {
      return left.add(right)
    }
    if (node.operator === '-') {
      return left.sub(right)
    }
    if (node.operator === '*') {
      return left.mul(right)
    }
    if (node.operator === '/') {
      return left.div(right)
    }
    if (node.operator === '^') {
      if (!right.isRational()) {
        throw new Error('根式指数必须是整数')
      }
      const exponent = right.toFraction()
      if (!exponent.isInteger() || exponent.n < 0 || exponent.n > 6) {
        throw new Error('根式指数必须是 0 至 6 的整数')
      }
      let result = RadicalSum.fromFraction(ONE)
      for (let count = 0; count < exponent.n; count += 1) {
        result = result.mul(left)
      }
      return result
    }
  }
  if (node.type === 'call' && node.name === 'sqrt') {
    const value = expressionToRadical(node.argument)
    if (!value.isRational()) {
      throw new Error('暂不支持根号内嵌套根式')
    }
    return fractionSquareRoot(value.toFraction())
  }
  throw new Error('无法计算二次根式')
}

function expressionToLinearXY(node) {
  if (node.type === 'number') {
    return { x: ZERO, y: ZERO, c: Fraction.from(node.value) }
  }
  if (node.type === 'variable') {
    if (node.name !== 'x' && node.name !== 'y') {
      throw new Error('二元一次方程组只支持未知数 x 和 y')
    }
    return {
      x: node.name === 'x' ? ONE : ZERO,
      y: node.name === 'y' ? ONE : ZERO,
      c: ZERO
    }
  }
  if (node.type === 'unary') {
    return scaleLinear(expressionToLinearXY(node.value), Fraction.from(-1))
  }
  if (node.type === 'binary') {
    const left = expressionToLinearXY(node.left)
    const right = expressionToLinearXY(node.right)
    if (node.operator === '+') {
      return combineLinear(left, right, false)
    }
    if (node.operator === '-') {
      return combineLinear(left, right, true)
    }
    if (node.operator === '*') {
      if (isConstantLinear(left)) {
        return scaleLinear(right, left.c)
      }
      if (isConstantLinear(right)) {
        return scaleLinear(left, right.c)
      }
      throw new Error('二元一次方程组不支持字母相乘')
    }
    if (node.operator === '/') {
      if (!isConstantLinear(right) || right.c.isZero()) {
        throw new Error('二元一次方程组的除数必须是常数')
      }
      return scaleLinear(left, right.c.inv())
    }
    if (node.operator === '^') {
      if (!isConstantLinear(right)) {
        throw new Error('指数必须是常数')
      }
      const exponent = right.c
      if (!exponent.isInteger() || exponent.n < 0 || exponent.n > 1) {
        throw new Error('二元一次方程组中的次数不能超过 1')
      }
      return exponent.n === 0 ? { x: ZERO, y: ZERO, c: ONE } : left
    }
  }
  throw new Error('无法转换为二元一次式')
}

function isConstantLinear(value) {
  return value.x.isZero() && value.y.isZero()
}

function scaleLinear(value, scale) {
  return {
    x: value.x.mul(scale),
    y: value.y.mul(scale),
    c: value.c.mul(scale)
  }
}

function combineLinear(left, right, subtract) {
  return {
    x: subtract ? left.x.sub(right.x) : left.x.add(right.x),
    y: subtract ? left.y.sub(right.y) : left.y.add(right.y),
    c: subtract ? left.c.sub(right.c) : left.c.add(right.c)
  }
}

function splitTopLevel(text, separators) {
  const source = String(text || '')
  const parts = []
  let depth = 0
  let start = 0
  for (let index = 0; index < source.length; index += 1) {
    const char = source.charAt(index)
    if (char === '(') {
      depth += 1
    } else if (char === ')') {
      depth -= 1
    } else if (depth === 0 && separators.indexOf(char) >= 0) {
      const part = source.slice(start, index).trim()
      if (part) {
        parts.push(part)
      }
      start = index + 1
    }
  }
  const tail = source.slice(start).trim()
  if (tail) {
    parts.push(tail)
  }
  return parts
}

module.exports = {
  tokenize: tokenize,
  normalizeText: normalizeText,
  parseExpression: parseExpression,
  parseRelation: parseRelation,
  expressionToPolynomial: expressionToPolynomial,
  expressionToRational: expressionToRational,
  expressionToRadical: expressionToRadical,
  expressionToLinearXY: expressionToLinearXY,
  splitTopLevel: splitTopLevel
}

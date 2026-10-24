'use strict'

const MODULES = [
  {
    id: 'polynomial',
    title: '整式运算',
    summary: '展开 · 化简 · 因式分解',
    modes: [
      { id: 'simplify', label: '化简/展开', placeholder: '例如：(x+2)(x-3)' },
      { id: 'factor', label: '因式分解', placeholder: '例如：x^2-9' }
    ]
  },
  {
    id: 'rational',
    title: '分式运算',
    summary: '约分 · 通分 · 分式方程',
    modes: [
      { id: 'simplify', label: '化简/运算', placeholder: '例如：(x^2-1)/(x+1)' },
      { id: 'solve', label: '解分式方程', placeholder: '例如：1/(x-1)=2' }
    ]
  },
  {
    id: 'equations',
    title: '方程与不等式',
    summary: '一元方程 · 方程组 · 不等式',
    modes: [
      { id: 'linear', label: '一元一次方程', placeholder: '例如：2x+3=11' },
      { id: 'quadratic', label: '一元二次方程', placeholder: '例如：x^2-5x+6=0' },
      { id: 'rational', label: '分式方程', placeholder: '例如：1/(x-1)=2' },
      { id: 'system', label: '二元一次方程组', placeholder: '每行一个等式，例如：x+y=5', multiLine: true },
      { id: 'inequality', label: '一元一次不等式(组)', placeholder: '例如：-2x+3<=5', multiLine: true }
    ]
  },
  {
    id: 'radical',
    title: '二次根式',
    summary: '化简 · 加减乘除 · 有理化',
    modes: [
      { id: 'simplify', label: '根式运算', placeholder: '例如：√18-√8' }
    ]
  },
  {
    id: 'linear',
    title: '一次函数',
    summary: 'y=kx+b · 关键点 · 图像',
    modes: [
      { id: 'graph', label: '函数图像', placeholder: '例如：y=2x+1' }
    ]
  },
  {
    id: 'inverse',
    title: '反比例函数',
    summary: 'y=k/x · 渐近线 · 图像',
    modes: [
      { id: 'graph', label: '函数图像', placeholder: '例如：y=-6/x' }
    ]
  },
  {
    id: 'quadratic',
    title: '二次函数',
    summary: '三种形式互化 · 关键点 · 图像',
    modes: [
      { id: 'graph', label: '三式互化与图像', placeholder: '例如：y=x^2-4x+3' }
    ]
  }
]

function findModule(id) {
  for (let index = 0; index < MODULES.length; index += 1) {
    if (MODULES[index].id === id) {
      return MODULES[index]
    }
  }
  return null
}

function findMode(moduleId, modeId) {
  const module = findModule(moduleId)
  if (!module) {
    return null
  }
  for (let index = 0; index < module.modes.length; index += 1) {
    if (module.modes[index].id === modeId) {
      return module.modes[index]
    }
  }
  return module.modes[0]
}

module.exports = {
  MODULES: MODULES,
  findModule: findModule,
  findMode: findMode
}

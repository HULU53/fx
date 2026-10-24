# fX

面向 Redmi Watch 6（432×514）的离线 Xiaomi Vela 数学计算工具。

## 参数

- 包 ID：`com.codex.vela.fx`
- 显示名：`fX`
- 版本：`1.0.12 / versionCode 13`
- 设计宽度：`432`
- 能力：`system.router`、`system.storage`、`system.file`

## 功能

- 整式展开、化简、提公因式、平方差、完全平方和常规二次三项式分解。
- 分式约分、通分、四则运算、分式方程与增根检查。
- 一元一次/二次方程、二元一次方程组、一元一次/一元二次不等式组。
- 二次根式化简、加减乘除和简单分母有理化。
- 一次函数、反比例函数、二次函数分析与 Canvas 图像。
- 个人计算器模式与学生自学模式，后者增加关键步骤。
- 内置数字/符号/A-Z 三页数学软键盘、方程组双行编辑、帮助页与沙箱文件日志。
- 函数图像使用独立页面按需生成，结果页默认只显示转换后的算式。

## 构建

```powershell
npm test
npm run build
npm run release
```

项目使用 `aiot-toolkit 2.0.5` 和 `@aiot-toolkit/jsc 1.0.9`。构建脚本先完成 Vela
打包，再直接调用 `win32_aiotjsc.exe` 生成字节码，最后重新封装带
`META-INF/CERT` 的 RPK。`build` 和 `release` 会保留彼此的产物。

输出：

```text
dist/com.codex.vela.fx.debug.1.0.12.rpk
dist/com.codex.vela.fx.release.1.0.12.rpk
```

## 日志

设置中的日志记录默认开启。

应用沙箱 URI：

```text
internal://files/logs/fX.log.txt
```

设备实际路径：

```text
/data/quickapp/files/com.codex.vela.fx/logs/fX.log.txt
```

日志约 256 KB 时，下次启动会滚动为 `fX.log.1.txt`。关闭日志开关后不会创建
目录或写入新内容，已有文件保留。

## 测试

`npm test` 使用 Node 内置测试接口，覆盖精确分数、根式、解析优先级、整式与
分式、方程/不等式、函数图像模型、日志追加、开关、截断和滚动备份。

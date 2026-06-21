# DNSSwitch

DNSSwitch 是一款基于 Tauri、Rust 和 React 的轻量级桌面 DNS 切换与智能调度工具。

## 特性

- 切换系统 DNS 与自定义 DNS 服务器
- 支持最小化到系统托盘
- 支持 DNS 切换通知
- 支持候选 DNS 服务器管理
- 跨平台桌面应用（Windows、macOS、Linux）

## 目录结构

- `src/`：前端 React + TypeScript 源码
- `src-tauri/`：Tauri 后端 Rust 源码
- `public/`：静态资源
- `package.json`：前端依赖与脚本
- `src-tauri/Cargo.toml`：Rust 依赖与 Tauri 配置

## 依赖要求

- Node.js 18+ / npm
- Rust 工具链（`cargo`）
- Tauri CLI（项目依赖中已声明）

## 本地开发

```bash
npm install
npm run dev
```

如果要直接运行 Tauri 开发模式：

```bash
npm run tauri dev
```

## 生产构建

```bash
npm run build
npm run tauri build
```

## 代码质量

- `npm run lint`
- `npm run lint:fix`
- `npm run format`
- `npm run format:check`

## 配置与数据

应用数据目录默认存放于用户主目录下的 `.dnsswitch`。

## 贡献

欢迎提交 issue 与 PR，建议先在本地运行项目并确保所有测试、格式化与 lint 检查通过。

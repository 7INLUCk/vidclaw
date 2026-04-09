# VidClaw E2E 测试指南

## 前置条件

1. 安装 Playwright：
```bash
# 如果遇到权限问题，先修复：
sudo chown -R 501:20 "/Users/yuchuyang/.npm"

# 然后安装：
npm install -D @playwright/test playwright-core
```

2. 构建 renderer（如果尚未构建）：
```bash
npm run build
```

## 运行测试

```bash
# 运行所有 E2E 测试
npm run test:e2e

# 使用 UI 模式调试
npm run test:e2e:ui

# 单独运行某个测试
npx playwright test e2e/launch.spec.ts
```

## 测试文件说明

| 文件 | 测试内容 |
|------|----------|
| `app.spec.ts` | 应用启动、侧边栏导航 |
| `chat-panel.spec.ts` | 聊天面板交互 |
| `settings-panel.spec.ts` | 设置面板 |
| `onboarding.spec.ts` | 新手引导流程 |
| `sidebar.spec.ts` | 侧边栏详细测试 |
| `task-panel.spec.ts` | 任务面板 |
| `launch.spec.ts` | 快速启动验证 |
| `navigation.spec.ts` | 导航切换 |
| `settings.spec.ts` | 设置页输入 |
| `input.spec.ts` | 聊天输入框 |
| `mode-switch.spec.ts` | 批量模式切换 |
| `full-flow.spec.ts` | 全流程综合测试 |

## 截图位置

测试截图保存在 `e2e/screenshots/` 目录。

## 注意

- 测试使用 `electron/test-main.js` 作为入口，它 stub 了所有 IPC handlers
- 不需要真实的即梦 CLI 或登录状态
- 测试只验证 UI 交互逻辑
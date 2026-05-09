# AGENTS.md — kubevirt-console

本文件为 Coding Agent（Claude Code、Codex、Cursor 等）在此仓库工作时提供约束。

---

## 项目结构

```
kubevirt-console/
├── ui/              # kubevirt-dashboard 前端（本文件约束范围）
│   └── src/
│       ├── components/ui/   # shadcn/ui 组件，勿直接修改组件本体
│       ├── assets/fonts/    # Maple Mono / JetBrains Mono 字体文件
│       └── index.css        # OKLCH 色彩 token + 字体定义
└── internal/        # Go 后端
```

---

## UI 主题规范（强制约束）

以下规则强制执行，所有 UI 改动必须遵守。

### 1. 字体

- 全局 UI 字体：Maple Mono（`--app-font-sans: 'Maple Mono', var(--font-sans)`）
- 等宽字体（代码、终端）：Maple Mono / JetBrains Mono（`--font-mono`）
- 字体文件在 `ui/src/assets/fonts/`，禁止引入其他外部字体

### 2. 色彩系统

只使用语义化 Tailwind token，禁止硬编码颜色。

禁止使用的 class：`bg-white`、`text-zinc-*`、`bg-zinc-*`、`border-zinc-*`、`text-gray-*`、`bg-gray-*`

允许且必须使用的 token：

| 用途 | Token |
|------|-------|
| 主文字 | `text-foreground` |
| 次要文字 | `text-muted-foreground` |
| 页面背景 | `bg-background` |
| 卡片背景 | `bg-card` |
| 静音背景 | `bg-muted` |
| 边框 | `border` / `border-border` |
| 主色 | `text-primary` / `bg-primary` |
| 交互悬停 | `hover:text-primary` / `hover:bg-muted/50` |

色彩变量定义在 `ui/src/index.css`，使用 OKLCH 色彩空间。

### 3. 组件库

- 使用 shadcn/ui（new-york 风格），组件位于 `ui/src/components/ui/`
- 新增 UI 组件优先复用已有的 shadcn 组件，不手写原生 HTML 替代品

### 4. 设计模式

**页面标题：**
```tsx
<div className="flex flex-col gap-1">
  <h1 className="text-2xl font-bold">{title}</h1>
  <p className="text-sm text-muted-foreground">{subtitle}</p>
</div>
```

**统计卡片：**
```tsx
<Card>
  <CardHeader>
    <div className="flex items-center gap-3">
      <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/50">
        <Icon className="size-5 text-blue-600 dark:text-blue-400" />
      </div>
      <div>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl font-semibold tabular-nums">{value}</CardTitle>
      </div>
    </div>
  </CardHeader>
</Card>
```
图标颜色分配：nodes=blue，vms=green，storage=purple，infra=orange。

**表格行：**
```tsx
<TableRow className="hover:bg-muted/50">
  <TableCell>
    <Link to={...} className="font-medium hover:text-primary transition-colors">{name}</Link>
  </TableCell>
  <TableCell className="text-muted-foreground text-sm">{secondary}</TableCell>
</TableRow>
```

**Tab 导航（URL 路由驱动）：**
```tsx
<Link className={cn(
  "flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
  active
    ? "border-primary text-foreground"
    : "border-transparent text-muted-foreground hover:text-foreground"
)}>
```

**加载状态：**
```tsx
<div className="flex items-center justify-center h-64 gap-2">
  <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted border-t-primary" />
  <span className="text-sm text-muted-foreground">Loading...</span>
</div>
```

**YAML / 代码块：**
```tsx
<Card>
  <CardContent className="p-0">
    <pre className="p-6 text-sm font-mono text-foreground bg-muted/30 rounded-lg overflow-x-auto min-h-[400px] whitespace-pre">
      {content}
    </pre>
  </CardContent>
</Card>
```

### 5. 圆角与排版

- 圆角：`rounded-lg`（禁止 `rounded-2xl`、`rounded-3xl`）
- 字重：`font-bold` / `font-semibold`（禁止 `font-black`）
- 排版：正常大小写（禁止滥用 `uppercase tracking-widest` 等过度强调写法）

### 6. 暗色模式

- 所有颜色 class 必须同时覆盖 light/dark
- 彩色图标背景格式：`bg-blue-50 dark:bg-blue-950/50`
- 暗色模式通过 `next-themes`（`ThemeProvider`）管理，在 `main.tsx` 配置

---

## 依赖规范

`ui/` 使用 **bun** 作为包管理器（`bun.lock` 是唯一 lock 文件）。

当前核心依赖：
- 构建：Vite + `@vitejs/plugin-react-swc` + `@tailwindcss/vite`（无需 postcss/autoprefixer）
- 样式：Tailwind CSS v4 + `tw-animate-css`（不使用 `tailwindcss-animate`）
- 组件：shadcn/ui（Radix UI 原语）+ `class-variance-authority`
- 主题：`next-themes`
- Toast：`sonner`

禁止引入：
- `tailwindcss-animate`（已被 `tw-animate-css` 替代）
- `postcss` / `autoprefixer`（Tailwind v4 不需要）
- `@vitejs/plugin-react`（使用 swc 版本）
- `@types/react-router-dom`（v7 自带类型）

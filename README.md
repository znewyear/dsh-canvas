# 协作画布（Collaborative Canvas）· DSH 插件项目

在 DeepSeek Harness 的会话里嵌一块**人与 AI 共用的画布**：文档由双方共同编辑、操作有版本与历史、AI 通过 `canvas_read` / `canvas_apply` 读写同一份数据。

这个目录就是插件的**源码工程**，可以独立开发、跑测试、安装到 DSH 配置（profile `desktop`）。

---

## 1. 功能概览

**画布**
- 无限画布（Canvas 2D 绘制），支持缩放 / 平移 / 自适应
- 画笔、橡皮（按涂擦除 / 整块清除）、文字、矩形、椭圆、箭头、便签、圈选、半圆
- 画笔 5 种笔型：普通 / 马克笔 / 铅笔 / 水彩笔 / 钢笔（`pen` 字段）
- 形状填充色、描边色/线宽、文字字号与颜色
- 选择、8 向缩放、旋转（360°）、编组/取消编组、对齐、分布、层级
- 右键菜单：复制（PNG + JSON 双格式到系统剪贴板）、粘贴、导出白底/透明 PNG
- 图元序号徽章（可开关）、底部暗色模糊渐变、左侧竖排工具栏

**与 AI 协作**
- `canvas_read`：读取文档（元素、批注、待确认项、历史版本）
- `canvas_apply`：原子提交一组操作（create/update/delete/move/resize/erasePath/group/…/undo/redo）
- 版本号 + 历史 + 冲突检测（`VERSION_CONFLICT`），两个作者同时改不会互相覆盖
- 「发给 AI」按钮：直接发送当前画布摘要；「填入」按钮：只填进对话输入框不发送

**宿主集成**
- 会话级文档：`s-<sessionId>`，每个会话一块画布
- 入口：会话视图标签「画布」、右侧栏「协作画布」、会话头部按钮
- 侧栏内容与宿主 React 树隔离（缓存元素，宿主重渲染不会重绘画布）

---

## 2. 目录结构

```
collab-canvas/
├── index.js            Host 半：工具注册、HTTP 路由、系统提示词、活动标记
├── host.js             Host 入口（导出 index 的 plugin）
├── store.js            持久化存储适配（storageDomain）
├── engine.js           文档引擎：操作语义、历史、擦除、校验（无 UI 依赖）
├── client.js           Web 半：画布 UI、绘制、手势、右键菜单、注册到 Slot
├── locale/{en,zh}.json 界面文案
├── icon.svg            侧栏图标
├── cordis.patch.yml    插件挂载补丁
├── package.json        DSH 插件清单（dsh.client / dsh.bundle）
├── docs/intent-canvas.md  设计 + 每一轮迭代记录（含未验证项）
└── *.test.js           5 个测试文件，node --test 运行
```

**分层**：`engine.js` 纯函数式操作（可单测） → `store.js` 落盘 → `index.js` 暴露工具/路由 → `client.js` 渲染与交互。

---

## 3. 开发与测试

需要 Node 22+（用 DSH 自带运行时即可）：

```powershell
$node = 'C:\Users\Administrator\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe'
& $node --test engine.test.js store.test.js client.test.js client.transport.test.js client.interaction.test.js
```

当前状态：**46 个断言全部通过**。

- `engine.test.js`：操作语义、历史、擦除几何、形状擦除、线宽补偿
- `store.test.js`：持久化、并发提交、冲突
- `client.test.js`：Slot 注册、会话绑定、侧栏标签
- `client.transport.test.js`：Host 路由与响应包装
- `client.interaction.test.js`：手势（画笔/橡皮/圈选/缩放/旋转）、右键菜单、文字编辑、导出按钮、填充、编号开关

---

## 4. 安装到 DSH

在本目录执行 `plugin_manager`（或让 AI 会话里执行）：

```
install_bundle  target = F:\projects\AI\plugins\collab-canvas
```

更新流程：先 `remove_bundle @local/intent-canvas`，再 `install_bundle` 上面的路径；客户端改动需要 `Ctrl+R`。

安装后：会话里会出现「画布」标签；右侧栏「协作画布」；会话头部有画布按钮。

---

## 5. 数据模型（要点）

```js
// 文档
{ id, version, elements: [], annotations: [], pending: [], history: [], future: [] }

// 图元（rect 均为世界坐标）
{ id, kind: 'path'|'rect'|'ellipse'|'arrow'|'text'|'note'|'group',
  rect: [x, y, w, h], stroke, strokeWidth, fill, text,
  rotation,          // 度，绕自身中心
  pen: 'plain'|'marker'|'pencil'|'watercolor'|'fountain',
  fontSize, textColor,
  rx,                // 圆角半径
  points,            // path/arrow 的本地坐标
  parent }           // 组内成员
```

操作列表见 `engine.js` 顶部的 switch 分支，或 `docs/intent-canvas.md` §13 的迭代记录。

---

## 6. 已知限制 / 待办

- 旋转后的缩放仍按未旋转矩形计算，可能有轻微跳变
- 多选（≥2）不提供旋转柄
- 半圆只画上半弧（不按拖拽方向翻转）
- 文字不自动折行（按输入换行）
- 画布数据未做数量上限，历史上限 100 步
- 斜杠命令 / 图片粘贴未实现

---

## 7. 文档

完整的**设计决策、每一轮迭代记录、验证与未验证项**都在 [docs/intent-canvas.md](docs/intent-canvas.md)。改功能时请追加一节 §13.x，写明：改了什么、为什么、测试是否覆盖、哪些还没目视验证。

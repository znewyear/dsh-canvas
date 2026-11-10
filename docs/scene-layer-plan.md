# 场景层重构计划（B 方案，零第三方依赖）

状态：进行中（2026-11-10）
基线：`main` @ `33f82d6`，标签 `baseline-1.0.97`
分支：`feat/scene-layer`
参考：TempCanvas 的操作体感，不复制其代码，不引入 Fabric / p5.brush 等第三方运行时。

## 1. 目标

把画布从“React 面板里的一张位图 + DOM 浮层”改成一个自研的场景系统，让**任何操作**（起笔、绘制、框选、移动、缩放、旋转、平移、缩放视图、文字、橡皮、空闲）都走同一套指针管线、同一个视口变换和同一个渲染时钟。

保留：

- `engine.js` / `store.js` 的文档与操作模型、版本冲突、撤销、AI `canvas_read` / `canvas_apply`。
- 现有工具语义（按涂擦除、整块擦除、编组、咨询、导出）。
- 单文件客户端形态（DSH 的 `client.js` 模块加载方式不变）。

不追求：

- 协作、演示、二维码、连接线、流程图模板。
- 像素级橡皮（Fabric 的 `destination-out`）；继续使用引擎的矢量碎片擦除。它是否“更强”不是本计划的论据，只作为既有数据语义保留。

## 2. 已确认的根因

1. **画布不是独立场景系统**：每个操作要穿过 React 渲染、Flex 布局、DOM 浮层、合成四层。
2. **双时钟**：canvas 用 `live.current.view` 立即重绘；选择框、把手、工具条用 React state，`syncView` 防抖 150ms。停手后 UI 晚到，看起来像“没操作也抖”。
3. **无分层**：每帧全量重绘网格、图元、编号、选择框、预览；操作越多越黏。
4. **控件在 DOM**：把手位置来自 React state，缩放时不跟手；命中与绘制两套坐标。
5. **浮层合成开销**：画布上方的 `backdrop-filter` 会随画布重绘反复重采样。

## 3. 目标架构

### 3.1 三层

```text
<div class="ic-surface">           单一指针入口（pointerdown/move/up/cancel/wheel）
  <canvas class="ic-scene">        背景 + 网格 + 已提交图元（缓存位图）
  <canvas class="ic-overlay">      选择框、8+1 把手、手势预览、编号、吸附线、橡皮光标
  <div class="ic-editor">          文字编辑 DOM（仅编辑时存在）
</div>
```

- `scene`：按 `doc.version + view + dpr + 主题` 缓存。平移只 `drawImage` 偏移，不重画图元；缩放手势期间可先缩放缓存，settle 后用新比例重画。
- `overlay`：透明层，每帧从 `live` 重绘；尺寸与 scene 完全一致，共用同一 `view`。
- 指针只绑在 `ic-surface` 上；不再有 `.ic-handles` DOM 层。

### 3.2 单一状态机

```text
idle → pan | draw | erase | box | lasso | move | resize | rotate | text
```

- 进入手势时确定目标与起始场景点；move 只更新 `live.current`；up 时提交一条既有 op。
- 所有工具用同一个 `toScene(clientX, clientY)`；不再有 DOM 把手分支。
- 把手的命中测试与绘制用同一组屏幕坐标函数（`handleScreenRect`）。

### 3.3 单一时钟

- 手势期零 `setState`；`scene`/`overlay` 都由 `requestAnimationFrame` 调度。
- `view` 不再驱动 React 渲染；缩放百分比直接写 DOM 文本，或用 150ms state 只更新文字、不参与画布几何。
- 选择框、把手、编号、预览全部在 overlay，无延迟差。

### 3.4 空闲

- 无持续 rAF；只有脏标记触发一次绘制。
- 验收：空闲 10s 内两层的 `clearRect` 调用为 0，连续截帧像素差为 0。
- 画布上方浮条改为不透明背景，去掉 `backdrop-filter`。

## 4. 里程碑

| 里程碑 | 内容 | 验收 |
|---|---|---|
| M0 基线 | 提交 1.0.97，打 tag，开分支 | `npm test` 73/73；`baseline-1.0.97` 可回退 |
| M1 双画布骨架 | 加 `scene`/`overlay`；scene 缓存已提交图元；overlay 画选择框与把手（位置先用 live view） | 视觉与 1.0.97 一致；空闲 0 重绘 |
| M2 指针管线 | 统一 `ic-surface` 指针；移除 DOM 把手；命中/绘制同一坐标 | 选择、移动、缩放、旋转、框选、套索回归 |
| M3 同一时钟 | 缩放/平移立即更新两层；去掉视觉上的 `syncView` 依赖；百分比文本分离 | 连续滚轮缩放无晚到、无跳变 |
| M4 变换手感 | 把手尺寸随缩放钳制、旋转柄、光标、修饰键、命中余量；提交 op 不变 | 与参考工具逐项对照截图 |
| M5 笔迹/橡皮 | 实时预览只画 overlay；提交后进 scene；橡皮预览与既有矢量擦除 | 画/擦 60fps，提交结果不变 |
| M6 回归 | 文字编辑、图片、编号、导出、AI 操作、撤销/重做 | 全量测试 + 真机 GUI |
| M7 收尾 | 性能基准、空闲验收、文档、版本 1.1.0 | 记录数字与未验证项 |

## 5. 回退

- 任何阶段出问题：`git switch main`（指向 `baseline-1.0.97` 的提交）即可回到 1.0.97。
- 每个里程碑单独提交；分支内也可 `git revert` 单个里程碑。
- 插件目录是工作区的 junction，切换分支后刷新页面即可加载对应 `client.js`。
- 已知限制：现有 73 条测试有几条直接查 `.ic-handles` DOM；M2 需要同步改测试为“画布内把手”的命中路径。

## 6. 风险

1. scene 缓存失效（图片解码、主题、DPR、撤销）→ 用显式 `sceneKey` 与强制失效入口，先做保守全量重绘。
2. 缩放期间的缓存缩放会糊一帧；settle 后重绘，接受为过渡。
3. 测试从 DOM 把手迁移到画布命中，需重写约 3–5 条用例。
4. 单文件客户端继续变大；本轮不拆分模块，避免改变 DSH 加载方式。

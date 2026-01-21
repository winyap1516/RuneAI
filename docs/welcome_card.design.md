# Welcome Card 设计与实现说明（前端实现 + Mock）

## Props Schema
```ts
type Status = 'loading'|'ready'|'error'|'empty'
interface WelcomeProps {
  nickname: string | null
  avatarUrl: string | null
  savedLinksCount: number | null
  savedPlacesCount: number | null
  runesCount: number | null
  trackedCardsCount: number | null
  todayDigest: string | null
  lastSyncedAt: string | null
  status?: Status
  onClickStat?: (name: 'links'|'places'|'runes'|'trackedCards') => void
  onReadMoreDigest?: () => void
  onRetryFetch?: () => void
}
```

## Events
- `onClickStat(statName)`：statName ∈ `links | places | runes | trackedCards`
- `onReadMoreDigest()`：点击摘要卡片
- `onRetryFetch()`：错误视图点击重试

## 状态机
- `loading`：全部主要字段为 `null` 时显示骨架屏
- `ready`：字段有值（0 正常显示）
- `empty`：四项统计为 0，摘要为空，显示引导文案
- `error`：显示错误条与重试按钮

## 可访问性（A11y）
- 容器：`role="region"` + `aria-label="Welcome panel"`
- 文案：重要文本 `aria-live="polite"`
- 错误：`role="alert"` + `aria-live="assertive"`
- 可键盘操作：统计与摘要 `tabindex=0`，`Enter` 触发点击

## 前端集成
1. 样式：`css/components/welcome_card.css`
2. 组件：`js/components/welcome_card.js`
   - `renderWelcomeCard(container, props)`
   - `navigateToWelcome()`
3. 原型：`prototypes/welcome_card.prototype.html`

## Mock 使用
- 静态数据：`data/welcome_mock.json`
- 模块：`mock/welcome.mock.js`
```js
import { getWelcomePropsMock } from '/mock/welcome.mock.js'
const container = document.querySelector('#userWelcomeCard')
const mode = window.__MOCK_MODE__ || 'ready'
const delay = window.__MOCK_DELAY__ || 600
getWelcomePropsMock(mode, delay).then(props => renderWelcomeCard(container, props))
```
- 开关：在控制台设置：
```js
window.__USE_MOCK__ = true
window.__MOCK_MODE__ = 'loading' // ready|empty|loading|error
window.__MOCK_DELAY__ = 1000
```

## QA Checklist
- 登录/刷新/Logo 点击三种情况下均显示欢迎卡或对应状态
- 统计数字显示正确（0 正常显示，null 显示骨架）
- 摘要两行截断与“阅读更多”点击事件生效
- 错误状态显示重试条并触发回调
- 支持暗色主题、键盘可操作、ARIA 区域标签合理
- Mock 能覆盖四种模式并正常渲染


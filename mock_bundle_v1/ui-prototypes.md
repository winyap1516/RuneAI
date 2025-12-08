# UI Prototypes & Interaction Specs

## 1. 卡片列表页 (Card List View)
**场景**: 用户浏览主要内容流。
*   **Initial State**: 显示 Skeleton 骨架屏 (Header + 3x4 Grid placeholders)。持续 200-700ms。
*   **Loaded State**:
    *   **Layout**: 响应式 Grid。Desktop 4列, Tablet 2-3列, Mobile 1列。
    *   **Animation**: 卡片按顺序淡入 (Staggered fade-in, 50ms interval)。
*   **Scroll**: 无限滚动 (Infinite scroll) 或 分页加载。底部显示 "Loading more..." spinner。
*   **Empty State**: 若无数据，中心显示插画 + "Create your first card" 按钮。

## 2. 分类侧栏 (Category Sidebar)
**场景**: 左侧导航。
*   **Structure**: 树形结构。顶级分类粗体，子分类缩进。
*   **Interaction**:
    *   **Hover**: 背景变浅灰 (Light Gray)。
    *   **Active**: 背景高亮 (Primary Color 10% opacity) + 左侧指示条。
    *   **Expand/Collapse**: 点击箭头图标切换子菜单显隐，带 200ms 高度过渡动画。
*   **Add Category**:
    *   点击 "+" 按钮，输入框原地展开 (Inline input)。
    *   Enter 确认，Esc 取消。
    *   Loading: 输入框右侧显示微型 Spinner。

## 3. 卡片详情侧板 (Detail Drawer)
**场景**: 点击卡片查看详情。
*   **Entry Animation**: 从右侧屏幕边缘滑入 (Slide-in right, 300ms cubic-bezier)。同时背景显示半透明遮罩 (Backdrop blur 2px, opacity 0.5)。
*   **Content**:
    *   顶部: Cover Image (如果有) + Title + Actions (Edit, Delete, Share)。
    *   中部: Meta info (Tags, Owner, Date) + Content Preview (Rendered Markdown)。
    *   底部: Stats (Views, Likes)。
*   **Exit**: 点击遮罩或 "X" 按钮，向右滑出。

## 4. 订阅交互 (Subscribe Flow)
**场景**: 用户订阅某张卡片。
*   **Button State**:
    *   **Default**: Outline Button, Text "Subscribe", Icon (+).
    *   **Hover**: Fill Background (Primary Color).
    *   **Active/Loading**: Button 变为 disabled，显示 Spinner。
    *   **Subscribed**: Solid Button (Green/Success Color), Text "Subscribed", Icon (Check).
*   **Feedback**: 
    *   点击后立即通过 Optimistic UI 切换状态。
    *   顶部弹出 Toast: "Successfully subscribed to [Card Name]" (3s auto-dismiss)。

## 5. 删除确认 (Delete Confirmation)
**场景**: 删除 Published 卡片。
*   **Trigger**: 点击详情页或卡片菜单中的 "Delete"。
*   **Modal**:
    *   居中弹窗。
    *   Title: "Delete this card?"
    *   Body: "This card is published. Deleting it requires unpublish confirmation. This action cannot be undone."
    *   **Actions**: "Cancel" (Gray), "Delete" (Red/Destructive).
*   **Loading**: 点击 Delete 后，按钮变 Loading 态。
*   **Success**: Modal 关闭，列表中的该卡片执行 "Shrink & Fade out" 动画消失。

## 6. 错误状态处理 (Global Error State)
**场景**: 全局网络断开或 500 错误。
*   **Visual**: 覆盖主要内容区域。
*   **Icon**: 断网图标或警告符号。
*   **Message**: "Something went wrong. Please check your connection."
*   **Action**: "Retry" 按钮 (Primary style)。
*   **Retry Logic**: 点击后按钮转圈，重新发起最近一次的数据请求。若成功，恢复列表视图；若失败，Shake 动画提示。

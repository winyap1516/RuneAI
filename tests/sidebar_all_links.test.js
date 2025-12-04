/* @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as linksView from '../js/views/linksView.js'

// 中文注释：侧栏“All Links”点击切换视图与事件绑定自动化测试

function mkDelegate() {
  return (root, selector, event, handler) => {
    root.addEventListener(event, (e) => {
      const target = e.target.closest(selector)
      if (target && root.contains(target)) handler(e, target)
    })
  }
}

function setupDOM() {
  document.body.innerHTML = `
    <aside>
      <div id="linksGroupList"></div>
    </aside>
    <main></main>
  `
  const list = document.getElementById('linksGroupList')
  const item = document.createElement('div')
  item.setAttribute('data-name', '')
  item.innerHTML = `<button class="category-filter">All Links</button>`
  list.appendChild(item)
}

beforeEach(() => {
  // 清理并重建 DOM
  document.body.innerHTML = ''
  setupDOM()
  // 注入 navigateToLinks 以模拟切换到 Links 视图
  window.navigateToLinks = vi.fn()
})

describe('Sidebar All Links click', () => {
  it('should call navigateToLinks when not in Links view', async () => {
    linksView.initLinksView({
      containerEl: null,
      controllers: { linkController: {}, digestController: {} },
      templates: {},
      utils: { dom: { delegate: mkDelegate(), on: () => {}, openModal: () => {}, closeModal: () => {}, openTextPrompt: () => {}, openConfirm: () => {}, openInfoModal: () => {} }, storageAdapter: { getCategories: () => [] } }
    })
    linksView.bindLinksEvents()
    const btn = document.querySelector('.category-filter')
    btn.click()
    expect(window.navigateToLinks).toHaveBeenCalled()
  })
})

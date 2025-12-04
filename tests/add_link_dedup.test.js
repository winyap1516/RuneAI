/* @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as linksView from '../js/views/linksView.js'

// 中文注释：Add Link 重复卡片问题修复的自动化测试

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
    <header>
      <button id="addLinkBtn">Add Link</button>
    </header>
    <div id="addLinkModal">
      <input id="inpUrl" />
      <button id="saveLinkBtn">Save</button>
      <button id="cancelAddLinkBtn">Cancel</button>
      <button id="closeModalX">X</button>
    </div>
    <main>
      <div id="cardsContainer"></div>
    </main>
  `
}

beforeEach(() => {
  document.body.innerHTML = ''
  setupDOM()
})

describe('Add Link duplicate prevention', () => {
  it('inserts only one card even on double click', async () => {
    const containerEl = document.getElementById('cardsContainer')
    const added = { id: 123, title: 'Test', url: 'https://example.com', description: 'd', category: 'All Links', tags: ['bookmark'] }

    const linkController = {
      async addLink(url) {
        // 模拟控制器调用视图插入
        linksView.addSingleCardUI(added)
        return added
      }
    }

    const templates = {
      createCard(data) {
        return `<div class="rune-card" data-card-id="${data.id}"><div class="rune-card-title">${data.title}</div></div>`
      }
    }

    linksView.initLinksView({
      containerEl,
      controllers: { linkController },
      templates,
      utils: { dom: { delegate: mkDelegate(), on: (el, evt, fn) => el.addEventListener(evt, fn), openModal: () => {}, closeModal: () => {}, openTextPrompt: () => {}, openConfirm: () => {}, openInfoModal: () => {} }, storageAdapter: { getCategories: () => [] } }
    })

    linksView.bindLinksEvents()
    const saveBtn = document.getElementById('saveLinkBtn')
    const inp = document.getElementById('inpUrl')
    inp.value = 'https://example.com'

    // 双击模拟
    saveBtn.click()
    saveBtn.click()

    // 等异步微任务
    await new Promise(r => setTimeout(r, 10))

    const cards = containerEl.querySelectorAll('.rune-card')
    expect(cards.length).toBe(1)
    expect(cards[0].getAttribute('data-card-id')).toBe('123')
  })
})

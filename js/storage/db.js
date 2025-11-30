// IndexedDB 数据封装（不依赖外部库），用于统一本地数据层
// 说明：
// - 本模块创建并管理 4 个对象仓库（stores）：websites、digests、subscriptions、locations
// - 每条记录自动补齐 user_id（默认 local-dev）与 created_at（ISO 字符串）
// - 提供 Promise 风格的 CRUD 接口，供适配层与业务层调用
// - 未来如需替换为 Dexie，仅需在此模块保持同名方法，实现内部迁移即可

const DB_NAME = 'runeai-db'
const DB_VERSION = 1
const DEFAULT_USER_ID = 'local-dev'

// 打开数据库（带版本升级）
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = function (event) {
      const db = request.result
      // websites：用户收藏的网站
      if (!db.objectStoreNames.contains('websites')) {
        const store = db.createObjectStore('websites', { keyPath: 'website_id', autoIncrement: true })
        store.createIndex('by_user', 'user_id', { unique: false })
        store.createIndex('by_url_user', ['url', 'user_id'], { unique: true })
        store.createIndex('by_created', 'created_at', { unique: false })
      }
      // digests：AI 摘要与日报
      if (!db.objectStoreNames.contains('digests')) {
        const store = db.createObjectStore('digests', { keyPath: 'digest_id', autoIncrement: true })
        store.createIndex('by_user', 'user_id', { unique: false })
        store.createIndex('by_website', 'website_id', { unique: false })
        store.createIndex('by_type', 'type', { unique: false })
        store.createIndex('by_website_type_created', ['website_id', 'type', 'created_at'], { unique: false })
      }
      // subscriptions：日报订阅设置
      if (!db.objectStoreNames.contains('subscriptions')) {
        const store = db.createObjectStore('subscriptions', { keyPath: 'subscription_id', autoIncrement: true })
        store.createIndex('by_user', 'user_id', { unique: false })
        store.createIndex('by_website_user', ['website_id', 'user_id'], { unique: true })
      }
      // locations：收藏地点（未来功能）
      if (!db.objectStoreNames.contains('locations')) {
        const store = db.createObjectStore('locations', { keyPath: 'location_id', autoIncrement: true })
        store.createIndex('by_user', 'user_id', { unique: false })
        store.createIndex('by_created', 'created_at', { unique: false })
      }
    }

    request.onsuccess = function () {
      resolve(request.result)
    }
    request.onerror = function () {
      reject(request.error)
    }
  })
}

// 统一事务创建
function withStore(storeName, mode, handler) {
  return openDB().then(db => new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode)
    const store = tx.objectStore(storeName)
    let finished = false
    // 事务完成回调
    tx.oncomplete = function () {
      if (!finished) resolve(undefined)
    }
    tx.onerror = function () {
      reject(tx.error)
    }
    // 执行 handler
    Promise.resolve(handler(store)).then(result => {
      finished = true
      resolve(result)
    }).catch(reject)
  }))
}

// 工具：补齐公共字段
function normalizeRecord(input, extra = {}) {
  const now = new Date().toISOString()
  return {
    user_id: input.user_id || DEFAULT_USER_ID,
    created_at: input.created_at || now,
    ...input,
    ...extra,
  }
}

// Websites 表接口
export const websites = {
  // 获取当前用户的所有网站
  async getAll(userId = DEFAULT_USER_ID) {
    return withStore('websites', 'readonly', store => new Promise((resolve, reject) => {
      const idx = store.index('by_user')
      const req = idx.getAll(userId)
      req.onsuccess = () => resolve(req.result || [])
      req.onerror = () => reject(req.error)
    }))
  },
  // 通过主键获取
  async getById(website_id) {
    return withStore('websites', 'readonly', store => new Promise((resolve, reject) => {
      const req = store.get(website_id)
      req.onsuccess = () => resolve(req.result || null)
      req.onerror = () => reject(req.error)
    }))
  },
  // 根据 url+user 唯一查询
  async getByUrl(url, userId = DEFAULT_USER_ID) {
    return withStore('websites', 'readonly', store => new Promise((resolve, reject) => {
      const idx = store.index('by_url_user')
      const req = idx.get([url, userId])
      req.onsuccess = () => resolve(req.result || null)
      req.onerror = () => reject(req.error)
    }))
  },
  // 创建网站记录（自动去重）
  async create(data) {
    const record = normalizeRecord(data)
    const existed = await websites.getByUrl(record.url, record.user_id)
    if (existed) return existed
    return withStore('websites', 'readwrite', store => new Promise((resolve, reject) => {
      const req = store.add(record)
      req.onsuccess = () => resolve({ ...record, website_id: req.result })
      req.onerror = () => reject(req.error)
    }))
  },
  // 更新网站记录
  async update(website_id, patch) {
    const current = await websites.getById(website_id)
    if (!current) throw new Error('Website not found')
    const record = { ...current, ...patch }
    return withStore('websites', 'readwrite', store => new Promise((resolve, reject) => {
      const req = store.put(record)
      req.onsuccess = () => resolve(record)
      req.onerror = () => reject(req.error)
    }))
  },
  // 删除网站（不含级联，级联由适配器层处理）
  async delete(website_id) {
    return withStore('websites', 'readwrite', store => new Promise((resolve, reject) => {
      const req = store.delete(website_id)
      req.onsuccess = () => resolve(true)
      req.onerror = () => reject(req.error)
    }))
  },
}

// Digests 表接口
export const digests = {
  // 获取某网站的摘要（可按类型过滤）
  async getByWebsite(website_id, type = null) {
    return withStore('digests', 'readonly', store => new Promise((resolve, reject) => {
      const idx = store.index('by_website')
      const req = idx.getAll(website_id)
      req.onsuccess = () => {
        let list = req.result || []
        if (type) list = list.filter(d => d.type === type)
        resolve(list)
      }
      req.onerror = () => reject(req.error)
    }))
  },
  // 创建摘要（type 必须为 'manual' 或 'daily'）
  async create(data) {
    const record = normalizeRecord(data)
    if (record.type !== 'manual' && record.type !== 'daily') {
      throw new Error('Invalid digest type')
    }
    return withStore('digests', 'readwrite', store => new Promise((resolve, reject) => {
      const req = store.add(record)
      req.onsuccess = () => resolve({ ...record, digest_id: req.result })
      req.onerror = () => reject(req.error)
    }))
  },
  // 更新摘要
  async update(digest_id, patch) {
    return withStore('digests', 'readwrite', store => new Promise((resolve, reject) => {
      const getReq = store.get(digest_id)
      getReq.onsuccess = () => {
        const current = getReq.result
        if (!current) return reject(new Error('Digest not found'))
        const record = { ...current, ...patch }
        const putReq = store.put(record)
        putReq.onsuccess = () => resolve(record)
        putReq.onerror = () => reject(putReq.error)
      }
      getReq.onerror = () => reject(getReq.error)
    }))
  },
  // 删除摘要（按主键）
  async delete(digest_id) {
    return withStore('digests', 'readwrite', store => new Promise((resolve, reject) => {
      const req = store.delete(digest_id)
      req.onsuccess = () => resolve(true)
      req.onerror = () => reject(req.error)
    }))
  },
  // 删除某网站的所有摘要
  async deleteByWebsite(website_id) {
    const list = await digests.getByWebsite(website_id)
    await Promise.all(list.map(d => digests.delete(d.digest_id)))
    return true
  },
}

// Subscriptions 表接口
export const subscriptions = {
  // 获取用户全部订阅
  async getAll(userId = DEFAULT_USER_ID) {
    return withStore('subscriptions', 'readonly', store => new Promise((resolve, reject) => {
      const idx = store.index('by_user')
      const req = idx.getAll(userId)
      req.onsuccess = () => resolve(req.result || [])
      req.onerror = () => reject(req.error)
    }))
  },
  // 获取指定网站的订阅记录
  async getByWebsite(website_id, userId = DEFAULT_USER_ID) {
    return withStore('subscriptions', 'readonly', store => new Promise((resolve, reject) => {
      const idx = store.index('by_website_user')
      const req = idx.get([website_id, userId])
      req.onsuccess = () => resolve(req.result || null)
      req.onerror = () => reject(req.error)
    }))
  },
  // 创建或更新订阅（按 website+user 唯一）
  async upsert(data) {
    const record = normalizeRecord(data, { last_generated_at: data.last_generated_at || null })
    const existed = await subscriptions.getByWebsite(record.website_id, record.user_id)
    if (existed) {
      const merged = { ...existed, ...record }
      return withStore('subscriptions', 'readwrite', store => new Promise((resolve, reject) => {
        const req = store.put(merged)
        req.onsuccess = () => resolve(merged)
        req.onerror = () => reject(req.error)
      }))
    }
    return withStore('subscriptions', 'readwrite', store => new Promise((resolve, reject) => {
      const req = store.add(record)
      req.onsuccess = () => resolve({ ...record, subscription_id: req.result })
      req.onerror = () => reject(req.error)
    }))
  },
  // 删除订阅（按主键）
  async delete(subscription_id) {
    return withStore('subscriptions', 'readwrite', store => new Promise((resolve, reject) => {
      const req = store.delete(subscription_id)
      req.onsuccess = () => resolve(true)
      req.onerror = () => reject(req.error)
    }))
  },
  // 删除网站的订阅
  async deleteByWebsite(website_id, userId = DEFAULT_USER_ID) {
    const sub = await subscriptions.getByWebsite(website_id, userId)
    if (!sub) return true
    return subscriptions.delete(sub.subscription_id)
  },
}

// Locations 表接口（预留未来使用）
export const locations = {
  async getAll(userId = DEFAULT_USER_ID) {
    return withStore('locations', 'readonly', store => new Promise((resolve, reject) => {
      const idx = store.index('by_user')
      const req = idx.getAll(userId)
      req.onsuccess = () => resolve(req.result || [])
      req.onerror = () => reject(req.error)
    }))
  },
  async create(data) {
    const record = normalizeRecord(data)
    return withStore('locations', 'readwrite', store => new Promise((resolve, reject) => {
      const req = store.add(record)
      req.onsuccess = () => resolve({ ...record, location_id: req.result })
      req.onerror = () => reject(req.error)
    }))
  },
  async update(location_id, patch) {
    return withStore('locations', 'readwrite', store => new Promise((resolve, reject) => {
      const getReq = store.get(location_id)
      getReq.onsuccess = () => {
        const current = getReq.result
        if (!current) return reject(new Error('Location not found'))
        const record = { ...current, ...patch }
        const putReq = store.put(record)
        putReq.onsuccess = () => resolve(record)
        putReq.onerror = () => reject(putReq.error)
      }
      getReq.onerror = () => reject(getReq.error)
    }))
  },
  async delete(location_id) {
    return withStore('locations', 'readwrite', store => new Promise((resolve, reject) => {
      const req = store.delete(location_id)
      req.onsuccess = () => resolve(true)
      req.onerror = () => reject(req.error)
    }))
  },
}

// 导出默认对象，便于按需注入与替换
const db = { websites, digests, subscriptions, locations, openDB }
export default db


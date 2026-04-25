export const BINS = [
  { key: 'phone', name: '手机仓' },
  { key: 'mouse', name: '数码配件仓' },
  { key: 'battery', name: '电池仓' }
]

export const AI_CATEGORY_RULES = [
  { key: 'phone', aliases: ['MobilePhone', 'Phone', '手机'] },
  { key: 'mouse', aliases: ['Charger', 'Earphone', 'Accessory', 'Mouse', '数码配件', '配件', '充电器', '耳机'] },
  { key: 'battery', aliases: ['Battery', '电池'] }
]

export function normalizeAliasToken(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '')
}

export function mapAiLabelToCategory(label) {
  const token = normalizeAliasToken(label)
  if (!token) return null

  for (const rule of AI_CATEGORY_RULES) {
    if (rule.aliases.some((alias) => normalizeAliasToken(alias) === token)) {
      return rule.key
    }
  }

  return null
}

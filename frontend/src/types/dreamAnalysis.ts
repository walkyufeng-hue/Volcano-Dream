export interface DreamSymbol {
  name: string
  meaning: string
  evidence: string
}

export type DreamMood =
  | '平静'
  | '喜悦'
  | '害怕'
  | '焦虑'
  | '悲伤'
  | '愤怒'
  | '困惑'
  | '孤独'
  | '惊讶'
  | '压迫'
  | '期待'
  | '安心'
  | '释然'
  | '怀念'
  | '复杂'
  | '说不清'

export type DreamTrait =
  | '清晰'
  | '零碎'
  | '重复出现'
  | '清醒梦'
  | '噩梦'
  | '情节完整'

interface DreamAnalysisBase {
  title: string
  summary: string
  moods: DreamMood[]
  symbols: DreamSymbol[]
  people: string[]
  scenes: string[]
  traits: DreamTrait[]
  reflection_questions: string[]
  image_prompt: string
}

export interface LegacyDreamAnalysis extends DreamAnalysisBase {
  schema_version: 2
  interpretation: string
}

export interface DreamAnalysisV3 extends DreamAnalysisBase {
  schema_version: 3
  essence: string
  psychological_view: string
  cultural_view: string
}

export type DreamAnalysis = LegacyDreamAnalysis | DreamAnalysisV3

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

const DREAM_MOODS: DreamMood[] = [
  '平静', '喜悦', '害怕', '焦虑', '悲伤', '愤怒', '困惑', '孤独',
  '惊讶', '压迫', '期待', '安心', '释然', '怀念', '复杂', '说不清',
]

const DREAM_TRAITS: DreamTrait[] = [
  '清晰', '零碎', '重复出现', '清醒梦', '噩梦', '情节完整',
]

function isDreamMoodArray(value: unknown): value is DreamMood[] {
  return isStringArray(value) && value.every(
    (item) => DREAM_MOODS.includes(item as DreamMood),
  )
}

function isDreamTraitArray(value: unknown): value is DreamTrait[] {
  return isStringArray(value) && value.every(
    (item) => DREAM_TRAITS.includes(item as DreamTrait),
  )
}

export function isDreamAnalysis(value: unknown): value is DreamAnalysis {
  if (!value || typeof value !== 'object') return false

  const candidate = value as Record<string, unknown>
  const symbols = candidate.symbols
  const validSymbols = Array.isArray(symbols) && symbols.every((symbol) => {
    if (!symbol || typeof symbol !== 'object') return false
    const item = symbol as Record<string, unknown>
    return (
      typeof item.name === 'string'
      && typeof item.meaning === 'string'
      && typeof item.evidence === 'string'
    )
  })

  const validSharedFields = (
    typeof candidate.title === 'string'
    && typeof candidate.summary === 'string'
    && isDreamMoodArray(candidate.moods)
    && validSymbols
    && isStringArray(candidate.people)
    && isStringArray(candidate.scenes)
    && isDreamTraitArray(candidate.traits)
    && isStringArray(candidate.reflection_questions)
    && typeof candidate.image_prompt === 'string'
  )

  if (!validSharedFields) return false

  if (candidate.schema_version === 2) {
    return typeof candidate.interpretation === 'string'
  }

  return (
    candidate.schema_version === 3
    && typeof candidate.essence === 'string'
    && typeof candidate.psychological_view === 'string'
    && typeof candidate.cultural_view === 'string'
  )
}

export function dreamAnalysisToMarkdown(analysis: DreamAnalysis): string {
  const essence = analysis.schema_version === 3
    ? analysis.essence
    : analysis.summary
  const psychologicalView = analysis.schema_version === 3
    ? analysis.psychological_view
    : analysis.interpretation
  const culturalView = analysis.schema_version === 3
    ? analysis.cultural_view
    : ''
  const metadata = [
    analysis.moods.length > 0
      ? `**核心情绪**：${analysis.moods.join('、')}`
      : '',
    analysis.traits.length > 0
      ? `**梦境状态**：${analysis.traits.join('、')}`
      : '',
  ].filter(Boolean).join('\n\n')

  const symbols = analysis.symbols
    .map((symbol) => `- **${symbol.name}**：${symbol.meaning}（来自：${symbol.evidence}）`)
    .join('\n')

  const contextItems = [
    analysis.people.length > 0 ? `**人物**：${analysis.people.join('、')}` : '',
    analysis.scenes.length > 0 ? `**场景**：${analysis.scenes.join('、')}` : '',
  ].filter(Boolean).join('\n\n')

  const questions = analysis.reflection_questions
    .map((question, index) => `${index + 1}. ${question}`)
    .join('\n')

  return [
    `# ${analysis.title}`,
    analysis.schema_version === 3 ? `> **精华**：${essence}` : '',
    `## 摘要\n\n${analysis.summary}`,
    metadata,
    symbols ? `## 关键符号\n\n${symbols}` : '',
    contextItems ? `## 人物与场景\n\n${contextItems}` : '',
    '## 心理视角',
    psychologicalView,
    culturalView ? `## 文化象征\n\n${culturalView}` : '',
    '## 可以继续想想',
    questions,
    '*梦境解读仅供娱乐与自我反思，不替代专业心理或医疗建议。*',
  ].filter(Boolean).join('\n\n')
}

export function dreamAnalysisToPlainText(analysis: DreamAnalysis): string {
  const essence = analysis.schema_version === 3
    ? analysis.essence
    : analysis.summary
  const psychologicalView = analysis.schema_version === 3
    ? analysis.psychological_view
    : analysis.interpretation
  const culturalView = analysis.schema_version === 3
    ? analysis.cultural_view
    : ''
  const lines = [
    analysis.title,
    ...(analysis.schema_version === 3 ? ['精华', essence, ''] : []),
    '摘要',
    analysis.summary,
    `核心情绪：${analysis.moods.join('、')}`,
    analysis.traits.length > 0 ? `梦境状态：${analysis.traits.join('、')}` : '',
    '',
    analysis.symbols.length > 0 ? '关键符号' : '',
    ...analysis.symbols.map(
      (symbol) => `${symbol.name}：${symbol.meaning}（来自：${symbol.evidence}）`,
    ),
    analysis.people.length > 0 ? `人物：${analysis.people.join('、')}` : '',
    analysis.scenes.length > 0 ? `场景：${analysis.scenes.join('、')}` : '',
    '',
    '心理视角',
    psychologicalView,
    ...(culturalView ? ['', '文化象征', culturalView] : []),
    '',
    '可以继续想想',
    ...analysis.reflection_questions.map(
      (question, index) => `${index + 1}. ${question}`,
    ),
    '',
    '梦境解读仅供娱乐与自我反思，不替代专业心理或医疗建议。',
  ]

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

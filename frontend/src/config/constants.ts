import { Heart, Moon, type LucideIcon } from 'lucide-react'

export interface DivinationOption {
  key: string
  label: string
  title: string
  description: string
  icon: LucideIcon
}

export const DIVINATION_OPTIONS: DivinationOption[] = [
  {
    key: 'dream',
    label: '火山梦绘AI',
    title: '火山梦绘AI',
    description: '记录梦中意象，探索潜意识传递的信息',
    icon: Moon,
  },
  {
    key: 'emotion_journal',
    label: '情绪日记',
    title: '情绪日记',
    description: '记录此刻发生的事，看见情绪背后的需要',
    icon: Heart,
  },
] as const

export function getDivinationOption(key: string): DivinationOption | undefined {
  return DIVINATION_OPTIONS.find((option) => option.key === key)
}

export const ABOUT = `# 关于火山梦绘AI

火山梦绘AI由开发者“火山”创建，是一款面向梦境记录、情绪表达与自我探索的泛情感AI产品。目前提供“梦境解读”和“情绪日记”两个场景，帮助你从经历与感受中发现值得关注的线索，并生成一幅属于当下的画面。

## 梦境解读

梦境常常由近期经历、情绪、记忆和想象共同构成。这里会结合中国传统梦文化与现代心理学视角，帮助你梳理梦中的人物、场景、情绪和象征。

## 怎样描述梦境

- 写下最清晰的人物、动物、物品或场景
- 描述梦中最强烈的情绪，例如害怕、轻松、焦虑或喜悦
- 补充最近是否发生了令你印象深刻的事情
- 不必追求完整，零散的片段也可以成为线索

## 如何看待解梦结果

梦没有唯一、确定的解释，同一种意象对不同的人也可能代表完全不同的体验。解梦结果适合用来启发思考和觉察情绪，不应被视为对未来的预言，也不能替代医学、心理或其他专业建议。

请保持开放和轻松的心态，把每一次解读当作一次与内心的对话。

## 情绪日记

你可以写下今天发生的事情、当时的感受和仍然留在心里的想法。系统会帮助你区分事件与感受、梳理主要情绪、理解可能的内在需要，并给出低压力的小行动建议。情绪回应不进行心理诊断，也不会替你做重大决定。

## 隐私说明

- 你提交的梦境或情绪日记会发送给第三方 AI 服务，用于生成文字回应和配图，请不要填写身份证号、住址、账号密码等敏感信息
- 每个场景最近 10 条记录和配图默认保存在当前浏览器中，清除浏览器数据后将无法恢复，也不会自动同步到其他设备
- 如果你主动提交意见反馈，反馈内容和你自愿填写的联系方式会保存在服务端，仅用于处理建议和问题
- 火山梦绘AI不会在网页上公开展示你的梦境、历史记录或反馈内容

如有建议或遇到问题，可以通过页面右上角的“意见反馈”告诉我们。
`

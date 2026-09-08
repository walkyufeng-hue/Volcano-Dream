import { useRef, useState } from 'react'
import { fetchEventSource, EventStreamContentType } from '@microsoft/fetch-event-source'
import MarkdownIt from 'markdown-it'
import { useGlobalState } from '@/store'
import { markHistoryImageSaved, saveHistory } from '@/utils/divinationHistory'
import { saveHistoryImage } from '@/utils/divinationImageStore'
import { getDivinationOption } from '@/config/constants'
import type { DreamAnalysis } from '@/types/dreamAnalysis'
import {
  dreamAnalysisToMarkdown,
  isDreamAnalysis,
} from '@/types/dreamAnalysis'

const API_BASE = import.meta.env.VITE_API_BASE || ''
const md = new MarkdownIt()

export function useDivination(promptType: string) {
  const { jwt } = useGlobalState()
  const [result, setResult] = useState('')
  const [loading, setLoading] = useState(false)
  const [resultLoading, setResultLoading] = useState(false)
  const [streaming, setStreaming] = useState(false)
  const [started, setStarted] = useState(false)
  const [image, setImage] = useState('')
  const [imageLoading, setImageLoading] = useState(false)
  const [imageError, setImageError] = useState('')
  const [imageToken, setImageToken] = useState('')
  const [historyId, setHistoryId] = useState('')
  const [textCompleted, setTextCompleted] = useState(false)
  const [analysis, setAnalysis] = useState<DreamAnalysis | null>(null)
  const [loadingMessage, setLoadingMessage] = useState('正在理解你的梦境')
  const submittingRef = useRef(false)
  const cancelledRef = useRef(false)
  const textAbortRef = useRef<AbortController | null>(null)
  const imageAbortRef = useRef<AbortController | null>(null)
  const activePromptRef = useRef('')
  const resultBufferRef = useRef('')
  const analysisRef = useRef<DreamAnalysis | null>(null)
  const imageTokenRef = useRef('')
  const historySavedRef = useRef(false)
  const generationIdRef = useRef(0)

  const saveActiveResult = (status: 'complete' | 'interrupted') => {
    if (
      historySavedRef.current
      || !resultBufferRef.current
      || !activePromptRef.current
    ) return null

    const config = getDivinationOption(promptType)
    if (!config) return null
    const savedItem = saveHistory({
      type: promptType,
      prompt: activePromptRef.current,
      result: resultBufferRef.current,
      status,
      analysis: analysisRef.current || undefined,
      title: analysisRef.current?.title || config.title,
      summary: analysisRef.current?.summary,
      mood: analysisRef.current?.moods[0],
      symbols: analysisRef.current?.symbols.map((symbol) => symbol.name),
    })
    if (savedItem) {
      historySavedRef.current = true
      setHistoryId(savedItem.id)
    }
    return savedItem
  }

  const generateDreamImage = async (
    token: string = imageToken,
    itemId: string = historyId,
    generationId: number = generationIdRef.current,
  ) => {
    if (!token) return

    const controller = new AbortController()
    const isCurrentGeneration = () => generationId === generationIdRef.current
    if (isCurrentGeneration()) {
      imageAbortRef.current = controller
      setImageLoading(true)
      setImageError('')
    }
    try {
      const response = await fetch(`${API_BASE}/api/dream-image`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${jwt || 'xxx'}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
        signal: controller.signal,
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(data?.detail || '梦境配图生成失败')
      }

      const data = await response.json()
      if (controller.signal.aborted) return
      if (itemId) {
        try {
          await saveHistoryImage(itemId, data.image)
          markHistoryImageSaved(itemId, promptType)
        } catch (storageError) {
          console.error('Failed to save dream image:', storageError)
        }
      }
      if (isCurrentGeneration()) setImage(data.image)
    } catch (error) {
      if (!controller.signal.aborted && isCurrentGeneration()) {
        setImageError(error instanceof Error ? error.message : '梦境配图生成失败')
      }
    } finally {
      if (isCurrentGeneration()) {
        if (imageAbortRef.current === controller) imageAbortRef.current = null
        setImageLoading(false)
      }
    }
  }

  const cancelGeneration = () => {
    saveActiveResult('interrupted')
    cancelledRef.current = true
    textAbortRef.current?.abort()
    imageAbortRef.current?.abort()
    textAbortRef.current = null
    imageAbortRef.current = null
    generationIdRef.current += 1
    submittingRef.current = false
    setLoading(false)
    setResultLoading(false)
    setStreaming(false)
    setImageLoading(false)
    setResult((current) => current || md.render('生成已停止。'))
  }

  const onSubmit = async (params: { prompt: string }) => {
    if (submittingRef.current) return

    const generationId = generationIdRef.current + 1
    generationIdRef.current = generationId
    // An older image may finish in the background and save to its own history
    // item, but it must not lock or overwrite this new result.
    imageAbortRef.current = null
    submittingRef.current = true
    cancelledRef.current = false
    const controller = new AbortController()
    textAbortRef.current = controller

    try {
      setStarted(true)
      setLoading(true)
      setResultLoading(true)
      setStreaming(false)
      setResult('')
      setImage('')
      setImageLoading(false)
      setImageError('')
      setImageToken('')
      setHistoryId('')
      setTextCompleted(false)
      setAnalysis(null)
      setLoadingMessage('正在理解你的梦境')
      activePromptRef.current = params.prompt
      resultBufferRef.current = ''
      analysisRef.current = null
      imageTokenRef.current = ''
      historySavedRef.current = false

      let tmpResultBuffer = ''
      let firstChunk = true

      const headers: Record<string, string> = {
        Authorization: `Bearer ${jwt || 'xxx'}`,
        'Content-Type': 'application/json',
      }

      await fetchEventSource(`${API_BASE}/api/divination`, {
        method: 'POST',
        body: JSON.stringify({
          ...params,
          prompt_type: promptType,
        }),
        headers,
        signal: controller.signal,
        async onopen(response) {
          const contentType = response.headers.get('content-type') || ''
          if (response.ok && contentType.startsWith(EventStreamContentType)) {
            setStreaming(true)
            return
          }
          if (response.status >= 400) {
            const data = await response.json().catch(() => null)
            throw new Error(data?.detail || `${response.status} 解梦失败`)
          }
          throw new Error('解梦服务返回了无法识别的内容')
        },
        onmessage(message) {
          if (cancelledRef.current) return
          if (message.event === 'image_token') {
            const data = JSON.parse(message.data)
            imageTokenRef.current = data.token
            setImageToken(data.token)
            return
          }
          if (message.event === 'phase') {
            const data: unknown = JSON.parse(message.data)
            if (
              data
              && typeof data === 'object'
              && typeof (data as Record<string, unknown>).message === 'string'
            ) {
              setLoadingMessage((data as { message: string }).message)
            }
            return
          }
          if (message.event === 'analysis') {
            const parsedAnalysis: unknown = JSON.parse(message.data)
            if (!isDreamAnalysis(parsedAnalysis)) {
              throw new Error('解梦结果格式异常，请稍后重试')
            }

            const markdownResult = dreamAnalysisToMarkdown(parsedAnalysis)
            analysisRef.current = parsedAnalysis
            resultBufferRef.current = markdownResult
            setAnalysis(parsedAnalysis)
            setResult(md.render(markdownResult))
            setResultLoading(false)
            setLoading(false)
            firstChunk = false
            return
          }
          if (message.event === 'legacy_result') {
            // The backend emits this for one release window so cached older
            // clients can still render a result. The structured client already has
            // the validated analysis and must not duplicate it.
            if (analysisRef.current) return
          }
          if (message.event === 'image_error') {
            const errorMessage: unknown = JSON.parse(message.data)
            setImageError(
              typeof errorMessage === 'string'
                ? errorMessage
                : '梦境画面暂时无法生成',
            )
            return
          }
          if (message.event === 'done') return
          if (message.event === 'FatalError') {
            let errorMessage = message.data
            try {
              errorMessage = JSON.parse(message.data)
            } catch {
              // Keep plain-text server errors readable.
            }
            throw new Error(errorMessage)
          }
          if (!message.data) return

          try {
            const newContent = JSON.parse(message.data)
            if (typeof newContent !== 'string') return
            tmpResultBuffer += newContent
            resultBufferRef.current = tmpResultBuffer
            setResult(md.render(tmpResultBuffer))

            if (firstChunk) {
              firstChunk = false
              setResultLoading(false)
              setLoading(false)
            }
          } catch (error) {
            console.error(error)
          }
        },
        onclose() {
          setStreaming(false)
          if (cancelledRef.current || !resultBufferRef.current || !promptType) return

          const savedItem = saveActiveResult('complete')
          setTextCompleted(Boolean(savedItem))
          if (savedItem) {
            if (imageTokenRef.current) {
              void generateDreamImage(imageTokenRef.current, savedItem.id, generationId)
            }
          } else if (imageTokenRef.current) {
            void generateDreamImage(imageTokenRef.current, '', generationId)
          }
        },
        onerror(error) {
          setStreaming(false)
          throw error
        },
      })
    } catch (error) {
      const partialItem = saveActiveResult('interrupted')
      if (!controller.signal.aborted && !cancelledRef.current) {
        const message = error instanceof Error ? error.message : '解梦失败'
        const partialNotice = partialItem
          ? `${resultBufferRef.current}\n\n> 解读中断，已保存当前内容。${message}`
          : `解梦失败：${message}`
        setResult(md.render(partialNotice))
      }
      setStreaming(false)
    } finally {
      if (textAbortRef.current === controller) textAbortRef.current = null
      submittingRef.current = false
      setLoading(false)
      setResultLoading(false)
      setStreaming(false)
    }
  }

  return {
    result,
    loading,
    resultLoading,
    streaming,
    started,
    image,
    imageLoading,
    imageError,
    textCompleted,
    analysis,
    loadingMessage,
    onSubmit,
    cancelGeneration,
    retryImage: () => {
      cancelledRef.current = false
      return generateDreamImage()
    },
  }
}

import { useRef, useState } from 'react'
import { fetchEventSource, EventStreamContentType } from '@microsoft/fetch-event-source'
import MarkdownIt from 'markdown-it'
import { useGlobalState } from '@/store'
import { markHistoryImageSaved, saveHistory } from '@/utils/divinationHistory'
import { saveHistoryImage } from '@/utils/divinationImageStore'
import { getDivinationOption } from '@/config/constants'

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
  const submittingRef = useRef(false)
  const cancelledRef = useRef(false)
  const textAbortRef = useRef<AbortController | null>(null)
  const imageAbortRef = useRef<AbortController | null>(null)

  const generateDreamImage = async (
    token: string = imageToken,
    itemId: string = historyId,
  ) => {
    if (!token || imageAbortRef.current) return

    const controller = new AbortController()
    imageAbortRef.current = controller
    setImageLoading(true)
    setImageError('')
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
      if (cancelledRef.current) return
      setImage(data.image)
      if (itemId) {
        try {
          await saveHistoryImage(itemId, data.image)
          markHistoryImageSaved(itemId, promptType)
        } catch (storageError) {
          console.error('Failed to save dream image:', storageError)
        }
      }
    } catch (error) {
      if (!controller.signal.aborted && !cancelledRef.current) {
        setImageError(error instanceof Error ? error.message : '梦境配图生成失败')
      }
    } finally {
      if (imageAbortRef.current === controller) imageAbortRef.current = null
      setImageLoading(false)
    }
  }

  const cancelGeneration = () => {
    cancelledRef.current = true
    textAbortRef.current?.abort()
    imageAbortRef.current?.abort()
    textAbortRef.current = null
    imageAbortRef.current = null
    submittingRef.current = false
    setLoading(false)
    setResultLoading(false)
    setStreaming(false)
    setImageLoading(false)
    setResult((current) => current || md.render('生成已停止。'))
  }

  const onSubmit = async (params: { prompt: string }) => {
    if (submittingRef.current) return

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
      setImageError('')
      setImageToken('')
      setHistoryId('')

      let tmpResultBuffer = ''
      let firstChunk = true
      let receivedImageToken = ''

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
          if (response.ok && response.headers.get('content-type') === EventStreamContentType) {
            setStreaming(true)
            return
          }
          if (response.status >= 400) {
            const data = await response.json().catch(() => null)
            throw new Error(data?.detail || `${response.status} 解梦失败`)
          }
        },
        onmessage(message) {
          if (cancelledRef.current) return
          if (message.event === 'image_token') {
            const data = JSON.parse(message.data)
            receivedImageToken = data.token
            setImageToken(data.token)
            return
          }
          if (message.event === 'FatalError') {
            throw new Error(message.data)
          }
          if (!message.data) return

          try {
            const newContent = JSON.parse(message.data)
            if (typeof newContent !== 'string') return
            tmpResultBuffer += newContent
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
          if (cancelledRef.current || !tmpResultBuffer || !promptType) return

          const config = getDivinationOption(promptType)
          if (!config) return
          const savedItem = saveHistory({
            type: promptType,
            title: config.title,
            prompt: params.prompt,
            result: tmpResultBuffer,
          })
          if (savedItem) {
            setHistoryId(savedItem.id)
            if (receivedImageToken) {
              void generateDreamImage(receivedImageToken, savedItem.id)
            }
          } else if (receivedImageToken) {
            void generateDreamImage(receivedImageToken)
          }
        },
        onerror(error) {
          setStreaming(false)
          throw error
        },
      })
    } catch (error) {
      if (!controller.signal.aborted && !cancelledRef.current) {
        const message = error instanceof Error ? error.message : '解梦失败'
        setResult(md.render(`解梦失败：${message}`))
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
    onSubmit,
    cancelGeneration,
    retryImage: generateDreamImage,
  }
}

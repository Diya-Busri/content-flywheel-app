'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useContentStudio } from '../ContentStudioContext'

interface Script {
  angle: string
  duration: string
  platforms: string[]
  hook: string
  body: string
  cta: string
  hook_strength: number
  engagement: string
  compliance: {
    tiktok: string
    instagram: string
    youtube: string
  }
  word_count?: number
  estimated_watch_time?: string
}

/** YouTube long-form API script item shape (nested or flat format) */
type YoutubeScriptItem = {
  angle?: string
  duration?: string
  word_count?: number
  estimated_watch_time?: string
  hook?: string | { text?: string }
  intro?: { text?: string }
  main_sections?: Array<{ text?: string }>
  recap?: { text?: string }
  body?: string
  cta?: string | { text?: string }
  platforms?: string[]
  performance_estimate?: { hook_strength?: number; retention_potential?: string }
  hook_strength?: number
  engagement?: string
  compliance?: { tiktok?: string; instagram?: string; youtube?: string }
}

/** Map YouTube long-form API response to UI Script shape */
function mapYoutubeScriptToScript(item: YoutubeScriptItem): Script {
  const hook =
    typeof item.hook === "string"
      ? item.hook
      : (item.hook as { text?: string } | undefined)?.text ?? "";
  const body =
    typeof item.body === "string"
      ? item.body
      : (() => {
          const intro = (item.intro as { text?: string } | undefined)?.text ?? "";
          const main = (item.main_sections ?? [])
            .map((s) => (s as { text?: string }).text ?? "")
            .filter(Boolean)
            .join("\n\n");
          const recap = (item.recap as { text?: string } | undefined)?.text ?? "";
          return [intro, main, recap].filter(Boolean).join("\n\n");
        })();
  const cta =
    typeof item.cta === "string"
      ? item.cta
      : (item.cta as { text?: string } | undefined)?.text ?? "";
  const strength =
    typeof item.hook_strength === "number"
      ? item.hook_strength
      : typeof (item.performance_estimate as { hook_strength?: number } | undefined)?.hook_strength === "number"
        ? Math.round((item.performance_estimate as { hook_strength: number }).hook_strength)
        : 4;
  return {
    angle: item.angle ?? "Script",
    duration: item.duration ?? "10 min",
    platforms: Array.isArray(item.platforms) ? item.platforms : ["YouTube"],
    hook,
    body,
    cta,
    hook_strength: strength,
    engagement: (item.engagement ?? (item.performance_estimate as { retention_potential?: string } | undefined)?.retention_potential) ?? "High",
    compliance: {
      tiktok: (item.compliance as { tiktok?: string } | undefined)?.tiktok ?? "N/A",
      instagram: (item.compliance as { instagram?: string } | undefined)?.instagram ?? "N/A",
      youtube: (item.compliance as { youtube?: string } | undefined)?.youtube ?? "Approved",
    },
    word_count: item.word_count,
    estimated_watch_time: item.estimated_watch_time,
  };
}

export default function ScriptsPage() {
  const { wizardData, loading: contextLoading } = useContentStudio()
  const router = useRouter()
  const [scripts, setScripts] = useState<Script[]>([])
  const [loading, setLoading] = useState(true)
  const [creatingGuide, setCreatingGuide] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedScripts, setSelectedScripts] = useState<Set<number>>(new Set())
  const [videoDuration, setVideoDuration] = useState('30') // fallback; primary from script_config

  const DURATION_OPTIONS = [
    { value: '5', label: '5 min', desc: 'Quick tips', words: '~750 words' },
    { value: '10', label: '10 min', desc: 'Standard', words: '~1,500 words' },
    { value: '15', label: '15 min', desc: 'Deep dive', words: '~2,250 words' },
    { value: '20', label: '20 min', desc: 'Comprehensive', words: '~3,000 words' },
    { value: '25', label: '25 min', desc: 'Tutorial', words: '~3,750 words' },
    { value: '30', label: '30 min', desc: 'Masterclass', words: '~4,500 words' },
    { value: '35', label: '35 min', desc: 'In-depth', words: '~5,250 words' },
    { value: '40', label: '40 min', desc: 'Full course', words: '~6,000 words' },
    { value: '45', label: '45 min', desc: 'Documentary', words: '~6,750 words' },
    { value: '50', label: '50 min', desc: 'Extended', words: '~7,500 words' },
    { value: '55', label: '55 min', desc: 'Analysis', words: '~8,250 words' },
    { value: '60', label: '60 min', desc: 'Workshop', words: '~9,000 words' },
  ]

  useEffect(() => {
    if (!contextLoading) {
      generateScripts()
    }
  }, [contextLoading])

  async function generateScripts() {
    const topic = wizardData.selected_topic ?? (wizardData.script_strategy as { selected_topic?: { title?: string } } | undefined)?.selected_topic
    const topicTitle = typeof topic === "string" ? (() => { try { return (JSON.parse(topic) as { title?: string }).title } catch { return "" } })() : (topic as { title?: string })?.title
    const hasTopic = Boolean(topicTitle || (topic && (typeof topic === "object" ? (topic as { title?: string }).title : true)))
    const hasNiche = Boolean(wizardData.selected_niche ?? (wizardData as { selectedNiche?: string }).selectedNiche ?? "")

    if (!hasTopic || !hasNiche) {
      setError("Missing required data. Please go back and select a topic and niche.")
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    const scriptConfig = wizardData.script_config ?? { duration: '10', angles: ['story', 'problem-solution'] }
    const duration = scriptConfig.duration ?? videoDuration ?? '10'
    const angles = Array.isArray(scriptConfig.angles) && scriptConfig.angles.length > 0
      ? scriptConfig.angles
      : ['story', 'problem-solution']

    const topicForRequest = typeof topic === "string" ? (() => { try { return JSON.parse(topic) as { title?: string } } catch { return { title: topic } } })() : (topic as { title?: string }) ?? { title: topicTitle }
    const requestBody = {
      topic: topicForRequest?.title ?? topicTitle ?? "",
      niche: wizardData.selected_niche ?? (wizardData as { selectedNiche?: string }).selectedNiche ?? "",
      contentStyle: wizardData.content_style ?? (wizardData as { contentStyle?: string }).contentStyle ?? "",
      videoDuration: duration,
      angles,
    }

    console.log("=== CALLING YOUTUBE SCRIPTS API ===")
    console.log("Using script config:", scriptConfig)
    console.log("Request:", requestBody)
    console.log("API URL: /api/content-studio/generate-youtube-scripts")

    try {
      const response = await fetch("/api/content-studio/generate-youtube-scripts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      })

      console.log("Response status:", response.status)

      if (!response.ok) {
        const errorText = await response.text()
        console.error("API Error:", errorText)
        throw new Error(`API failed: ${response.status} - ${errorText}`)
      }

      const data = await response.json()
      console.log("=== RECEIVED SCRIPTS ===")
      console.log("Scripts count:", data.scripts?.length)
      console.log("First script duration:", data.scripts?.[0]?.duration)
      console.log("First script word count:", data.scripts?.[0]?.word_count)

      const raw = data.scripts ?? []
      setScripts(raw.map((s: YoutubeScriptItem) => mapYoutubeScriptToScript(s)))
    } catch (err) {
      console.error("=== GENERATION FAILED ===")
      console.error(err)
      setError(`Failed: ${err instanceof Error ? err.message : "Unknown error"}`)
    } finally {
      setLoading(false)
    }
  }

  function toggleScript(index: number) {
    const newSelected = new Set(selectedScripts)
    if (newSelected.has(index)) {
      newSelected.delete(index)
    } else {
      newSelected.add(index)
    }
    setSelectedScripts(newSelected)
  }

  async function createVideoGuides() {
    if (selectedScripts.size === 0) return

    const scriptsToProcess = scripts.filter((_, index) => selectedScripts.has(index))
    const selectedScript = scriptsToProcess[0]

    const topic = wizardData.selected_topic ?? (wizardData.script_strategy as { selected_topic?: { title?: string } } | undefined)?.selected_topic
    const topicTitle = typeof topic === 'string'
      ? (() => { try { return (JSON.parse(topic) as { title?: string }).title } catch { return '' } })()
      : (topic as { title?: string })?.title
    const productName = topicTitle || 'Content Studio Video'

    const wordCount = selectedScript.word_count ?? (() => {
      const text = [selectedScript.hook, selectedScript.body, selectedScript.cta].filter(Boolean).join(' ')
      return text ? text.split(/\s+/).filter(Boolean).length : 0
    })()
    const durationSeconds = wordCount > 0
      ? Math.round((wordCount / 150) * 60)
      : (() => {
          const d = selectedScript.duration ?? selectedScript.estimated_watch_time ?? ''
          const match = String(d).match(/(\d+)\s*min|(\d+):(\d+)/i)
          if (match) {
            if (match[1]) return parseInt(match[1], 10) * 60
            return (parseInt(match[2], 10) || 0) * 60 + (parseInt(match[3], 10) || 0)
          }
          return 600
        })()
    // Align scene count with script length: ~1 scene per minute for long-form (so script sections match scenes)
    const targetSceneCount = durationSeconds >= 120
      ? Math.min(20, Math.max(8, Math.round(durationSeconds / 60)))
      : undefined

    setCreatingGuide(true)
    setError(null)

    try {
      const response = await fetch('/api/video-guide/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          hook: selectedScript.hook,
          body: selectedScript.body,
          cta: selectedScript.cta,
          productName,
          productDescription: wizardData.selected_niche
            ? `YouTube long-form content in niche: ${wizardData.selected_niche}. Style: ${wizardData.content_style ?? 'general'}.`
            : undefined,
          platforms: ['tiktok', 'instagram_reels', 'youtube_shorts', 'youtube_longform'],
          durationSeconds: durationSeconds >= 120 ? durationSeconds : undefined,
          targetSceneCount,
          source: 'content-studio',
        }),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error((data.error as string) || 'Failed to generate video guide')
      }

      const data = await response.json()
      const libraryScriptId = data.libraryScriptId

      if (libraryScriptId) {
        router.push(`/dashboard/digital-products/video-guide?source=content-studio&libraryScriptId=${encodeURIComponent(libraryScriptId)}`)
      } else {
        sessionStorage.setItem('videoCreationGuide', JSON.stringify({
          ...data,
          scriptTitle: selectedScript.angle || productName,
          libraryScriptId: null,
        }))
        router.push('/dashboard/digital-products/video-guide?source=content-studio')
      }
    } catch (err) {
      console.error('Error creating video guide:', err)
      setError(err instanceof Error ? err.message : 'Failed to create video guide. Please try again.')
    } finally {
      setCreatingGuide(false)
    }
  }

  if (contextLoading || loading) {
    return (
      <div className="max-w-6xl mx-auto p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-lg font-medium">Generating long-form YouTube scripts...</p>
          <p className="text-gray-600 mt-2">
            Creating {wizardData.script_config?.angles?.length ?? 4} script{wizardData.script_config?.angles?.length !== 1 ? 's' : ''} (config from previous step). This may take a minute.
          </p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-800 font-medium mb-4">{error}</p>
          <button
            onClick={() => router.push('/dashboard/content-studio/create/script-config')}
            className="bg-orange-500 text-white px-6 py-3 rounded-lg hover:bg-orange-600"
          >
            ← Back to Script Config
          </button>
        </div>
      </div>
    )
  }

  const topic = wizardData.selected_topic ?? (wizardData.script_strategy as { selected_topic?: { title?: string } } | undefined)?.selected_topic
  const topicDisplay = typeof topic === 'string'
    ? (() => { try { return (JSON.parse(topic) as { title?: string }).title } catch { return 'Selected Topic' } })()
    : topic?.title ?? 'Selected Topic'

  return (
    <div className="max-w-6xl mx-auto p-8">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => router.push('/dashboard/content-studio')}
          className="text-gray-600 hover:text-gray-900 mb-4"
        >
          ← Back to Content Studio
        </button>

        <h1 className="text-3xl font-bold mb-2">Step 5 of 7 — Video Scripts</h1>
        <p className="text-gray-600">
          For: <span className="font-medium">{topicDisplay}</span>
        </p>
      </div>

      {/* Video Duration Selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">
          Video length (controls all scripts)
        </label>
        <p className="text-sm text-gray-600 mb-3">
          Longer videos = better monetization & authority. Changing duration regenerates all scripts.
        </p>

        <select
          value={videoDuration}
          onChange={(e) => setVideoDuration(e.target.value)}
          className="w-full md:w-auto min-w-[280px] px-4 py-3 border-2 border-gray-200 rounded-lg focus:border-orange-500 focus:outline-none"
        >
          {DURATION_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label} - {option.desc} ({option.words})
            </option>
          ))}
          {videoDuration && !DURATION_OPTIONS.some((o) => o.value === videoDuration) && (
            <option value={videoDuration}>
              {videoDuration} min - Custom (~{Number(videoDuration) * 150} words)
            </option>
          )}
        </select>

        <div className="mt-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            💡 <strong>Monetization tip:</strong> Videos over 8 minutes qualify for mid-roll ads.
            {parseInt(videoDuration, 10) >= 8
              ? ' ✅ Mid-roll ads enabled for this duration!'
              : ' Videos under 8 min only show pre-roll ads.'}
          </p>
        </div>

        {parseInt(videoDuration, 10) >= 30 && (
          <div className="mt-2 text-xs text-blue-700 bg-blue-50 p-2 rounded border border-blue-200">
            💰 Long-form content = higher CPM (typically $12-25 vs $5-10 for short videos)
          </div>
        )}

        <div className="mt-4">
          <details className="text-sm">
            <summary className="cursor-pointer text-gray-600 hover:text-gray-900">
              Need a custom duration?
            </summary>
            <div className="mt-3 flex gap-2 items-center flex-wrap">
              <input
                type="number"
                min={5}
                max={120}
                placeholder="Custom minutes"
                className="px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-orange-500 focus:outline-none"
                onBlur={(e) => {
                  const mins = parseInt(e.target.value, 10)
                  if (mins >= 5 && mins <= 120) {
                    setVideoDuration(String(mins))
                  }
                }}
              />
              <span className="text-gray-600">minutes (5-120 range)</span>
            </div>
          </details>
        </div>
      </div>

      {/* Script Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {scripts.map((script, index) => (
          <div
            key={index}
            className={`border-2 rounded-lg p-6 ${
              selectedScripts.has(index)
                ? 'border-orange-500 bg-orange-50'
                : 'border-gray-200'
            }`}
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="font-bold text-lg">{script.angle}</h3>
                <p className="text-sm text-gray-600">{script.duration} • same for all scripts</p>
              </div>
              {selectedScripts.has(index) && (
                <span className="bg-orange-500 text-white text-xs px-2 py-1 rounded">
                  ✓ Selected
                </span>
              )}
            </div>

            {/* Script Stats */}
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-sm font-medium text-gray-700">Script Stats</p>
              <div className="grid grid-cols-3 gap-2 mt-2 text-xs">
                <div>
                  <span className="text-gray-600">Duration:</span>
                  <span className="font-medium ml-1">{script.duration}</span>
                </div>
                <div>
                  <span className="text-gray-600">Word count:</span>
                  <span className="font-medium ml-1">{script.word_count != null ? script.word_count.toLocaleString() : '—'}</span>
                </div>
                <div>
                  <span className="text-gray-600">Speaking time:</span>
                  <span className="font-medium ml-1">{script.estimated_watch_time ?? '—'}</span>
                </div>
              </div>
            </div>

            {/* Platforms */}
            <div className="mb-4">
              <p className="text-xs font-medium text-gray-500 mb-1">PLATFORM</p>
              <div className="flex gap-2">
                {script.platforms?.map((platform) => (
                  <span key={platform} className="text-xs">
                    ☑ {platform}
                  </span>
                ))}
              </div>
            </div>

            {/* Hook */}
            <div className="mb-3">
              <p className="text-xs font-medium text-gray-500 mb-1">HOOK (0:00-0:30)</p>
              <p className="text-sm">{script.hook}</p>
              <p className="text-xs text-gray-500 mt-1">Words: ~{script.hook.split(/\s+/).filter(Boolean).length}</p>
            </div>

            {/* Body */}
            <div className="mb-3">
              <p className="text-xs font-medium text-gray-500 mb-1">BODY (intro + main + recap)</p>
              <p className="text-sm line-clamp-4">{script.body}</p>
              <p className="text-xs text-gray-500 mt-1">Words: ~{script.body.split(/\s+/).filter(Boolean).length}</p>
            </div>

            {/* CTA */}
            <div className="mb-4">
              <p className="text-xs font-medium text-gray-500 mb-1">CTA (13:00-14:00)</p>
              <p className="text-sm">{script.cta}</p>
              <p className="text-xs text-gray-500 mt-1">Words: ~{script.cta.split(/\s+/).filter(Boolean).length}</p>
            </div>

            {/* Performance */}
            <div className="mb-4 pb-4 border-b border-gray-200">
              <p className="text-xs font-medium text-gray-500 mb-1">ESTIMATED PERFORMANCE</p>
              <p className="text-sm">
                Hook strength: {'⭐'.repeat(script.hook_strength || 4)} ({script.hook_strength === 5 ? 'Strong' : 'Good'})
              </p>
              <p className="text-sm">Engagement: {script.engagement}</p>
            </div>

            {/* Compliance */}
            <div className="mb-4">
              <p className="text-xs font-medium text-gray-500 mb-1">PLATFORM</p>
              <p className="text-xs">YouTube long-form: {script.compliance?.youtube || 'Approved'}</p>
            </div>

            {/* Actions */}
            <button
              onClick={() => toggleScript(index)}
              className={`w-full py-2 rounded-lg font-medium ${
                selectedScripts.has(index)
                  ? 'bg-orange-500 text-white'
                  : 'bg-white border-2 border-orange-500 text-orange-500'
              }`}
            >
              {selectedScripts.has(index) ? '✓ Selected' : 'Select This Script'}
            </button>
          </div>
        ))}
      </div>

      {/* Bottom Actions */}
      <div className="flex justify-between items-center border-t pt-6">
        <button
          onClick={() => router.back()}
          className="text-gray-600 hover:text-gray-900"
        >
          ← Back
        </button>

        <div className="text-center">
          <p className="text-sm text-gray-600 mb-2">
            {selectedScripts.size} script{selectedScripts.size !== 1 ? 's' : ''} selected
            {selectedScripts.size > 0 && ' • Each video costs 1 credit'}
          </p>
          <button
            onClick={createVideoGuides}
            disabled={selectedScripts.size === 0 || creatingGuide}
            className={`px-8 py-3 rounded-lg font-semibold ${
              selectedScripts.size > 0 && !creatingGuide
                ? 'bg-orange-500 text-white hover:bg-orange-600'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {creatingGuide ? 'Creating Video Guide...' : 'Create Video Guide →'}
          </button>
        </div>
      </div>
    </div>
  )
}

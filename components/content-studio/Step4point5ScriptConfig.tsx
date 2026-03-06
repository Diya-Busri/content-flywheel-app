'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useContentStudio } from '@/app/dashboard/content-studio/create/ContentStudioContext'

const DURATION_OPTIONS = [
  { value: '5', label: '5 min', desc: 'Quick tips', words: '~750 words', cost: 1 },
  { value: '8', label: '8 min', desc: 'Short tutorial', words: '~1,200 words', cost: 1 },
  { value: '10', label: '10 min', desc: 'Standard YouTube', words: '~1,500 words', cost: 1 },
  { value: '12', label: '12 min', desc: 'Standard+', words: '~1,800 words', cost: 2 },
  { value: '15', label: '15 min', desc: 'Deep dive', words: '~2,250 words', cost: 2 },
  { value: '20', label: '20 min', desc: 'Comprehensive', words: '~3,000 words', cost: 3 },
  { value: '25', label: '25 min', desc: 'Detailed tutorial', words: '~3,750 words', cost: 3 },
  { value: '30', label: '30 min', desc: 'Masterclass', words: '~4,500 words', cost: 4 },
  { value: '40', label: '40 min', desc: 'Full course', words: '~6,000 words', cost: 5 },
  { value: '50', label: '50 min', desc: 'Extended', words: '~7,500 words', cost: 6 },
  { value: '60', label: '60 min', desc: 'Full workshop', words: '~9,000 words', cost: 7 },
]

const SCRIPT_ANGLES = [
  {
    id: 'story',
    name: 'Story Angle',
    description: 'Personal narrative and transformation journey',
    icon: '📖',
    bestFor: 'Building connection, emotional engagement',
  },
  {
    id: 'problem-solution',
    name: 'Problem/Solution Angle',
    description: 'Identify pain points and provide clear solutions',
    icon: '🎯',
    bestFor: 'High retention, actionable content',
  },
  {
    id: 'educational',
    name: 'Educational Deep-Dive',
    description: 'Step-by-step teaching format',
    icon: '🎓',
    bestFor: 'Authority building, comprehensive guides',
  },
  {
    id: 'results',
    name: 'Results/Case Study',
    description: 'Show real examples and proven outcomes',
    icon: '📊',
    bestFor: 'Credibility, social proof',
  },
]

function getTopicTitle(wizardData: { selected_topic?: unknown }): string {
  const raw = wizardData.selected_topic
  if (raw == null) return 'Selected Topic'
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as { title?: string }
      return parsed?.title ?? 'Selected Topic'
    } catch {
      return 'Selected Topic'
    }
  }
  const obj = raw as { title?: string }
  return obj?.title ?? 'Selected Topic'
}

export default function Step4point5ScriptConfig() {
  const { wizardData, updateWizardData } = useContentStudio()
  const router = useRouter()

  const [selectedDuration, setSelectedDuration] = useState(
    () => (wizardData.script_config?.duration as string) || '10'
  )
  const [selectedAngles, setSelectedAngles] = useState<string[]>(
    () => wizardData.script_config?.angles ?? ['story', 'problem-solution']
  )

  const selectedDurationOption = DURATION_OPTIONS.find((d) => d.value === selectedDuration)
  const totalCost = selectedDurationOption ? selectedDurationOption.cost * selectedAngles.length : 0

  function toggleAngle(angleId: string) {
    if (selectedAngles.includes(angleId)) {
      if (selectedAngles.length > 1) {
        setSelectedAngles(selectedAngles.filter((id) => id !== angleId))
      }
    } else {
      setSelectedAngles([...selectedAngles, angleId])
    }
  }

  async function handleGenerate() {
    await updateWizardData({
      script_config: {
        duration: selectedDuration,
        angles: selectedAngles,
        estimated_cost: totalCost,
      },
      current_step: 5,
    })

    router.push('/dashboard/content-studio/create/scripts')
  }

  const topicTitle = getTopicTitle(wizardData)

  return (
    <div className="max-w-5xl mx-auto p-8">
      <div className="mb-8">
        <button
          onClick={() => router.push('/dashboard/content-studio/create?step=4')}
          className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white mb-4"
        >
          ← Back
        </button>

        <h1 className="text-3xl font-bold mb-2 dark:text-white">Step 5 of 7 — Configure Your Scripts</h1>
        <p className="text-gray-600 dark:text-gray-400">
          For: <span className="font-medium">{topicTitle}</span>
        </p>
      </div>

      {/* Video Duration Selection */}
      <div className="mb-10">
        <h2 className="text-xl font-semibold mb-2 dark:text-white">1. Choose Video Duration</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          How long should your video be? Longer videos = better monetization.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {DURATION_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => setSelectedDuration(option.value)}
              className={`p-4 rounded-lg border-2 text-left transition ${
                selectedDuration === option.value
                  ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/30 dark:border-orange-600'
                  : 'border-gray-200 dark:border-gray-700 hover:border-orange-300 dark:hover:border-orange-600'
              }`}
            >
              <div className="font-bold text-lg dark:text-white">{option.label}</div>
              <div className="text-xs text-gray-600 dark:text-gray-400">{option.desc}</div>
              <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">{option.words}</div>
              <div className="text-xs text-orange-600 dark:text-orange-400 mt-2">
                {option.cost} credit{option.cost > 1 ? 's' : ''} per script
              </div>
            </button>
          ))}
        </div>

        {parseInt(selectedDuration, 10) >= 8 && (
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              ✅ <strong>Mid-roll ads enabled!</strong> Videos 8+ minutes qualify for additional ad breaks.
            </p>
          </div>
        )}

        {parseInt(selectedDuration, 10) >= 30 && (
          <div className="mt-2 p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg">
            <p className="text-sm text-green-800 dark:text-green-200">
              💰 <strong>Higher CPM potential!</strong> Long-form content typically earns $12-25 CPM vs $5-10 for short videos.
            </p>
          </div>
        )}
      </div>

      {/* Script Angle Selection */}
      <div className="mb-10">
        <h2 className="text-xl font-semibold mb-2 dark:text-white">2. Choose Script Angles</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Select 1-4 different approaches. Each gives you a unique script to choose from.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {SCRIPT_ANGLES.map((angle) => (
            <button
              key={angle.id}
              onClick={() => toggleAngle(angle.id)}
              className={`p-5 rounded-lg border-2 text-left transition ${
                selectedAngles.includes(angle.id)
                  ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/30 dark:border-orange-600'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="text-3xl">{angle.icon}</div>
                <div className="flex-1">
                  <h3 className="font-bold text-lg mb-1 dark:text-white">{angle.name}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">{angle.description}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-500">
                    <strong>Best for:</strong> {angle.bestFor}
                  </p>
                  {selectedAngles.includes(angle.id) && (
                    <div className="mt-2 text-xs text-orange-600 dark:text-orange-400 font-medium">✓ Selected</div>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>

        <p className="text-sm text-gray-500 dark:text-gray-500 mt-3">
          💡 Tip: Generate 2-3 angles to compare different approaches, then pick your favorite.
        </p>
      </div>

      {/* Summary & Generate */}
      <div className="border-t dark:border-gray-700 pt-6">
        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-6 mb-6">
          <h3 className="font-semibold text-lg mb-3 dark:text-white">Generation Summary</h3>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Video Duration</p>
              <p className="font-medium dark:text-white">{selectedDuration} minutes</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Word Count</p>
              <p className="font-medium dark:text-white">{selectedDurationOption?.words}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Script Variations</p>
              <p className="font-medium dark:text-white">
                {selectedAngles.length} angle{selectedAngles.length > 1 ? 's' : ''}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Cost</p>
              <p className="font-medium text-orange-600 dark:text-orange-400">
                {totalCost} credit{totalCost > 1 ? 's' : ''}
              </p>
            </div>
          </div>

          <div className="text-xs text-gray-500 dark:text-gray-500">
            Estimated generation time: {selectedAngles.length * 30} - {selectedAngles.length * 45} seconds
          </div>
        </div>

        <div className="flex justify-between items-center">
          <button
            onClick={() => router.push('/dashboard/content-studio/create?step=4')}
            className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
          >
            ← Back
          </button>

          <button
            onClick={handleGenerate}
            className="bg-orange-500 text-white px-8 py-3 rounded-lg font-semibold hover:bg-orange-600 flex items-center gap-2"
          >
            Generate {selectedAngles.length} Script{selectedAngles.length > 1 ? 's' : ''} →
          </button>
        </div>
      </div>
    </div>
  )
}

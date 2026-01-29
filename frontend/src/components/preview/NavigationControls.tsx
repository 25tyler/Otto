import { ChevronLeft, ChevronRight } from 'lucide-react'

interface NavigationControlsProps {
  currentIndex: number
  totalCount: number
  onPrevious: () => void
  onNext: () => void
  onJumpTo: (index: number) => void
}

export function NavigationControls({
  currentIndex,
  totalCount,
  onPrevious,
  onNext,
  onJumpTo,
}: NavigationControlsProps) {
  return (
    <div className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3">
      <button
        onClick={onPrevious}
        disabled={currentIndex === 0}
        className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-700
                   bg-white border border-gray-200 rounded-lg hover:bg-gray-50
                   disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        Previous
      </button>

      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-500">Email</span>
        <input
          type="number"
          min={1}
          max={totalCount}
          value={currentIndex + 1}
          onChange={(e) => {
            const val = parseInt(e.target.value, 10)
            if (val >= 1 && val <= totalCount) {
              onJumpTo(val - 1)
            }
          }}
          className="w-16 px-2 py-1 text-center text-sm border border-gray-300
                     rounded-md focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
        <span className="text-sm text-gray-500">of {totalCount}</span>
      </div>

      <button
        onClick={onNext}
        disabled={currentIndex === totalCount - 1}
        className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-700
                   bg-white border border-gray-200 rounded-lg hover:bg-gray-50
                   disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        Next
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  )
}

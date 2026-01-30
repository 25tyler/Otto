import { useEffect, useState, useCallback } from 'react'
import { Loader2 } from 'lucide-react'

declare global {
  interface Window {
    gapi: {
      load: (api: string, callback: () => void) => void
    }
    google: {
      picker: {
        PickerBuilder: new () => PickerBuilder
        DocsView: new (viewId?: ViewId) => DocsView
        ViewId: {
          DOCS: ViewId
          SPREADSHEETS: ViewId
        }
        DocsViewMode: {
          LIST: DocsViewMode
        }
        Action: {
          PICKED: string
          CANCEL: string
        }
      }
    }
  }
}

interface ViewId {
  toString(): string
}

interface DocsViewMode {
  toString(): string
}

interface DocsView {
  setMimeTypes(mimeTypes: string): DocsView
  setMode(mode: DocsViewMode): DocsView
}

interface PickerBuilder {
  addView(view: DocsView | ViewId): PickerBuilder
  setOAuthToken(token: string): PickerBuilder
  setDeveloperKey(key: string): PickerBuilder
  setCallback(callback: (data: PickerResponse) => void): PickerBuilder
  build(): Picker
}

interface Picker {
  setVisible(visible: boolean): void
}

interface PickerResponse {
  action: string
  docs?: PickerDocument[]
}

interface PickerDocument {
  id: string
  name: string
  mimeType: string
}

interface GooglePickerProps {
  onSelect: (file: { id: string; name: string; mimeType: string }) => void
  mimeTypes: string[]
  buttonText: string
  buttonIcon?: React.ReactNode
  disabled?: boolean
  className?: string
}

const GOOGLE_API_SCRIPT = 'https://apis.google.com/js/api.js'
const GOOGLE_GSI_SCRIPT = 'https://accounts.google.com/gsi/client'

export function GooglePicker({
  onSelect,
  mimeTypes,
  buttonText,
  buttonIcon,
  disabled,
  className,
}: GooglePickerProps) {
  const [pickerLoaded, setPickerLoaded] = useState(false)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Load Google Picker API
  useEffect(() => {
    const loadScript = (src: string): Promise<void> => {
      return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) {
          resolve()
          return
        }
        const script = document.createElement('script')
        script.src = src
        script.async = true
        script.defer = true
        script.onload = () => resolve()
        script.onerror = () => reject(new Error(`Failed to load ${src}`))
        document.head.appendChild(script)
      })
    }

    const init = async () => {
      try {
        await loadScript(GOOGLE_API_SCRIPT)
        await loadScript(GOOGLE_GSI_SCRIPT)

        window.gapi.load('picker', () => {
          setPickerLoaded(true)
        })
      } catch (error) {
        console.error('Failed to load Google Picker:', error)
      }
    }

    init()
  }, [])

  // Get access token from session
  useEffect(() => {
    fetch('/api/auth/session')
      .then((r) => r.json())
      .then((data) => {
        if (data.accessToken) {
          setAccessToken(data.accessToken)
        }
      })
      .catch((error) => {
        console.error('Failed to get session:', error)
      })
  }, [])

  const openPicker = useCallback(() => {
    if (!pickerLoaded || !accessToken) {
      console.error('Picker not ready:', { pickerLoaded, hasToken: !!accessToken })
      return
    }

    setIsLoading(true)

    try {
      const google = window.google

      // Create the appropriate view based on mime types
      let view: DocsView
      if (mimeTypes.includes('application/vnd.google-apps.spreadsheet')) {
        view = new google.picker.DocsView(google.picker.ViewId.SPREADSHEETS)
      } else {
        view = new google.picker.DocsView(google.picker.ViewId.DOCS)
      }

      view.setMimeTypes(mimeTypes.join(','))
      view.setMode(google.picker.DocsViewMode.LIST)

      const picker = new google.picker.PickerBuilder()
        .addView(view)
        .setOAuthToken(accessToken)
        .setCallback((data: PickerResponse) => {
          setIsLoading(false)

          if (data.action === google.picker.Action.PICKED && data.docs && data.docs.length > 0) {
            const file = data.docs[0]
            onSelect({
              id: file.id,
              name: file.name,
              mimeType: file.mimeType,
            })
          }
        })
        .build()

      picker.setVisible(true)
    } catch (error) {
      console.error('Failed to open picker:', error)
      setIsLoading(false)
    }
  }, [pickerLoaded, accessToken, mimeTypes, onSelect])

  const isReady = pickerLoaded && accessToken && !disabled

  return (
    <button
      onClick={openPicker}
      disabled={!isReady || isLoading}
      className={
        className ||
        `flex items-center justify-center gap-2 w-full px-4 py-3 rounded-lg border-2 border-dashed
        ${
          isReady
            ? 'border-gray-300 hover:border-primary-400 hover:bg-primary-50 text-gray-600 hover:text-primary-600'
            : 'border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed'
        }
        transition-colors`
      }
    >
      {isLoading ? (
        <>
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Opening picker...</span>
        </>
      ) : (
        <>
          {buttonIcon}
          <span>{buttonText}</span>
        </>
      )}
    </button>
  )
}

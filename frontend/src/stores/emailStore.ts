import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ParsedTemplate, ExcelData, PlaceholderMapping, SendResult } from '../types'

interface EmailState {
  // Template data
  template: ParsedTemplate | null
  templateFileName: string | null
  templateDocId: string | null

  // Excel/Sheet data
  excelData: ExcelData | null
  excelFileName: string | null
  dataSheetId: string | null

  // Mappings
  mappings: PlaceholderMapping[]

  // Send results
  sendResults: SendResult[]
  isSending: boolean
  sendProgress: { sent: number; total: number }

  // User info
  user: { email: string; name: string; picture: string } | null

  // Actions
  setTemplate: (template: ParsedTemplate | null, fileName?: string, docId?: string) => void
  setExcelData: (data: ExcelData | null, fileName?: string, sheetId?: string) => void
  setMappings: (mappings: PlaceholderMapping[]) => void
  updateMapping: (placeholder: string, excelColumn: string | null) => void
  setSendResults: (results: SendResult[]) => void
  updateSendResult: (rowIndex: number, result: Partial<SendResult>) => void
  setUser: (user: EmailState['user']) => void
  setIsSending: (isSending: boolean) => void
  setSendProgress: (progress: { sent: number; total: number }) => void
  getFailedEmails: () => SendResult[]
  getPendingEmails: () => SendResult[]
  reset: () => void
  resetSendState: () => void
}

export const useEmailStore = create<EmailState>()(
  persist(
    (set, get) => ({
      template: null,
      templateFileName: null,
      templateDocId: null,
      excelData: null,
      excelFileName: null,
      dataSheetId: null,
      mappings: [],
      sendResults: [],
      isSending: false,
      sendProgress: { sent: 0, total: 0 },
      user: null,

      setTemplate: (template, fileName, docId) =>
        set({ template, templateFileName: fileName || null, templateDocId: docId || null }),

      setExcelData: (data, fileName, sheetId) =>
        set({ excelData: data, excelFileName: fileName || null, dataSheetId: sheetId || null }),

      setMappings: (mappings) => set({ mappings }),

      updateMapping: (placeholder, excelColumn) =>
        set((state) => ({
          mappings: state.mappings.map((m) =>
            m.placeholder === placeholder
              ? { ...m, excelColumn, status: excelColumn ? 'mapped' : 'unmapped' }
              : m
          ),
        })),

      setSendResults: (results) => set({ sendResults: results }),

      updateSendResult: (rowIndex, result) =>
        set((state) => ({
          sendResults: state.sendResults.map((r) =>
            r.rowIndex === rowIndex ? { ...r, ...result } : r
          ),
        })),

      setUser: (user) => set({ user }),

      setIsSending: (isSending) => set({ isSending }),

      setSendProgress: (progress) => set({ sendProgress: progress }),

      getFailedEmails: () => get().sendResults.filter((r) => r.status === 'failed'),

      getPendingEmails: () => get().sendResults.filter((r) => r.status === 'pending'),

      reset: () =>
        set({
          template: null,
          templateFileName: null,
          templateDocId: null,
          excelData: null,
          excelFileName: null,
          dataSheetId: null,
          mappings: [],
          sendResults: [],
          isSending: false,
          sendProgress: { sent: 0, total: 0 },
        }),

      resetSendState: () =>
        set({
          sendResults: [],
          isSending: false,
          sendProgress: { sent: 0, total: 0 },
        }),
    }),
    {
      name: 'otto-email-store',
      partialize: (state) => ({
        // Only persist send results and user for recovery
        sendResults: state.sendResults,
        user: state.user,
      }),
    }
  )
)

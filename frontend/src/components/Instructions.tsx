import { useState } from 'react'
import { ChevronDown, ChevronUp, FileText, Table, Mail, HelpCircle } from 'lucide-react'

export function Instructions() {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-6 py-4 flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-3">
          <HelpCircle className="w-5 h-5 text-primary-600" />
          <span className="font-medium text-gray-900">How to Use Otto</span>
        </div>
        {isExpanded ? (
          <ChevronUp className="w-5 h-5 text-gray-500" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-500" />
        )}
      </button>

      {isExpanded && (
        <div className="px-6 pb-6 space-y-6">
          {/* Template Format */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-4 h-4 text-primary-600" />
              <h4 className="font-semibold text-gray-900">1. Create Your Email Template</h4>
            </div>
            <div className="bg-white rounded-lg p-4 text-sm">
              <p className="text-gray-600 mb-3">
                Create a Google Doc or Word document (.docx) with this format:
              </p>
              <pre className="bg-gray-50 rounded-lg p-4 text-xs overflow-x-auto border border-gray-200">
{`Subject: Your [Type] Report is Ready
CC: manager@company.com, backup@company.com
---
Dear [Name],

Your **[Type]** report for **[Company]** is now ready.

Please review it at your earliest convenience.

Best regards,
Your Team`}
              </pre>
              <ul className="mt-3 space-y-1.5 text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="text-primary-600 font-bold">•</span>
                  <span><code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">Subject:</code> defines your email subject line</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary-600 font-bold">•</span>
                  <span><code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">CC:</code> (optional) comma-separated CC recipients</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary-600 font-bold">•</span>
                  <span><code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">---</code> separates the header from the email body</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary-600 font-bold">•</span>
                  <span><code className="bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded text-xs">[Placeholders]</code> will be replaced with your data</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Excel Format */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Table className="w-4 h-4 text-primary-600" />
              <h4 className="font-semibold text-gray-900">2. Prepare Your Excel Data</h4>
            </div>
            <div className="bg-white rounded-lg p-4 text-sm">
              <p className="text-gray-600 mb-3">
                Create an Excel file (.xlsx) with your recipient data:
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs border border-gray-200 rounded-lg overflow-hidden">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="px-3 py-2 text-left font-semibold text-gray-700 border-b">Email</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700 border-b">Name</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700 border-b">Company</th>
                      <th className="px-3 py-2 text-left font-semibold text-gray-700 border-b">Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="px-3 py-2 border-b text-gray-600">john@example.com</td>
                      <td className="px-3 py-2 border-b text-gray-600">John Smith</td>
                      <td className="px-3 py-2 border-b text-gray-600">Acme Corp</td>
                      <td className="px-3 py-2 border-b text-gray-600">Monthly</td>
                    </tr>
                    <tr>
                      <td className="px-3 py-2 text-gray-600">jane@example.com</td>
                      <td className="px-3 py-2 text-gray-600">Jane Doe</td>
                      <td className="px-3 py-2 text-gray-600">Tech Inc</td>
                      <td className="px-3 py-2 text-gray-600">Weekly</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <ul className="mt-3 space-y-1.5 text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="text-primary-600 font-bold">•</span>
                  <span>First row must be column headers</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary-600 font-bold">•</span>
                  <span>Must include an <strong>Email</strong> column</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary-600 font-bold">•</span>
                  <span>Column names should match your <code className="bg-yellow-100 text-yellow-800 px-1 rounded text-xs">[Placeholders]</code></span>
                </li>
              </ul>
            </div>
          </div>

          {/* Send Flow */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Mail className="w-4 h-4 text-primary-600" />
              <h4 className="font-semibold text-gray-900">3. Preview and Send</h4>
            </div>
            <div className="bg-white rounded-lg p-4 text-sm">
              <ol className="space-y-2 text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold flex-shrink-0">1</span>
                  <span>Upload your template and Excel file</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold flex-shrink-0">2</span>
                  <span>Review the placeholder mappings (auto-matched when names are similar)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold flex-shrink-0">3</span>
                  <span>Use the preview to check each email looks correct</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold flex-shrink-0">4</span>
                  <span>Click "Send Test to Myself" to verify formatting</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="w-5 h-5 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-bold flex-shrink-0">5</span>
                  <span>Click "Send All" when ready</span>
                </li>
              </ol>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

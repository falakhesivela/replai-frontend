'use client'

import { useRef, useState } from 'react'
import { FileText, Trash2, Upload, Loader2, FolderOpen } from 'lucide-react'
import type { KnowledgeFile } from '@/lib/types'
import { clearKnowledgeAction, uploadKnowledgeAction } from '../actions'
import { Toast, type ToastData } from './toast'

function formatBytes(bytes?: number) {
  if (!bytes) return null
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function KnowledgeCard({
  clientId,
  initialFiles,
}: {
  clientId: string
  initialFiles: KnowledgeFile[]
}) {
  const [files, setFiles] = useState<KnowledgeFile[]>(initialFiles)
  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [clearingAll, setClearingAll] = useState(false)
  const [toast, setToast] = useState<ToastData | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function showToast(message: string, type: ToastData['type']) {
    setToast({ message, type })
  }

  async function handleUpload(file: File) {
    if (!/\.(pdf|txt)$/i.test(file.name)) {
      showToast('Only .pdf and .txt files are accepted.', 'error')
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const result = await uploadKnowledgeAction(clientId, formData)
      if (result.error) {
        showToast(result.error, 'error')
      } else {
        setFiles(result.files)
        showToast(`"${file.name}" uploaded.`, 'success')
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Upload failed.', 'error')
    } finally {
      setUploading(false)
    }
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleUpload(file)
    e.target.value = ''
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleUpload(file)
  }

  async function handleClearAll() {
    setClearingAll(true)
    try {
      const result = await clearKnowledgeAction(clientId)
      if (result.ok) {
        setFiles([])
        showToast('All files cleared.', 'success')
      } else {
        showToast(result.error ?? 'Failed to clear files.', 'error')
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to clear files.', 'error')
    } finally {
      setClearingAll(false)
    }
  }

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-6">
      {/* Card header */}
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Knowledge base</h3>
          <p className="mt-0.5 text-xs text-gray-500">
            Files the AI agent can reference when answering questions.
          </p>
        </div>
        {files.length > 0 && (
          <button
            onClick={handleClearAll}
            disabled={clearingAll}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {clearingAll ? (
              <Loader2 size={11} className="animate-spin" />
            ) : (
              <Trash2 size={11} />
            )}
            Clear all
          </button>
        )}
      </div>

      {/* File list */}
      {files.length > 0 ? (
        <ul className="mb-4 divide-y divide-gray-100 rounded-md border border-gray-200 overflow-hidden">
          {files.map((file) => {
            const size = formatBytes(file.size)
            return (
              <li
                key={file.filename}
                className="flex items-center bg-white px-4 py-2.5 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <FileText size={14} className="shrink-0 text-gray-400" strokeWidth={1.75} />
                  <div className="min-w-0">
                    <p className="truncate text-sm text-gray-800">{file.filename}</p>
                    {size && <p className="text-xs text-gray-400">{size}</p>}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      ) : (
        <div className="mb-4 flex flex-col items-center justify-center rounded-md border border-dashed border-gray-200 bg-gray-50 py-8 text-center">
          <FolderOpen size={24} className="mb-2 text-gray-300" strokeWidth={1.5} />
          <p className="text-sm text-gray-400">No files uploaded yet</p>
        </div>
      )}

      {/* Upload zone */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => !uploading && inputRef.current?.click()}
        onKeyDown={(e) => e.key === 'Enter' && !uploading && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragEnter={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-8 text-center transition-colors ${
          uploading
            ? 'cursor-not-allowed border-gray-200 bg-gray-50'
            : isDragging
            ? 'border-gray-400 bg-gray-50'
            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.txt"
          className="hidden"
          onChange={onInputChange}
        />

        {uploading ? (
          <>
            <Loader2 size={20} className="animate-spin text-gray-400" />
            <p className="text-sm text-gray-500">Uploading…</p>
          </>
        ) : (
          <>
            <Upload
              size={20}
              className={`transition-colors ${isDragging ? 'text-gray-600' : 'text-gray-400'}`}
              strokeWidth={1.75}
            />
            <div>
              <p className="text-sm text-gray-600">
                <span className="font-medium">Click to upload</span> or drag and drop
              </p>
              <p className="mt-0.5 text-xs text-gray-400">PDF or TXT files only</p>
            </div>
          </>
        )}
      </div>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onDismiss={() => setToast(null)}
        />
      )}
    </section>
  )
}

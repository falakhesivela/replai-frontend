'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  FileText,
  Globe,
  Upload,
  Trash2,
  Loader2,
  FolderOpen,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { getMyKnowledgeFiles, deleteMyKnowledge, deleteMyKnowledgeFile, scrapeWebsiteKnowledge } from '@/lib/api'
import { useToast } from '@/components/toast'
import type { KnowledgeFile } from '@/lib/types'
import { Card, ConfirmDialog } from '@/components/ui'

const API_URL = process.env.NEXT_PUBLIC_API_URL!

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatBytes(bytes?: number) {
  if (!bytes) return null
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(dateStr?: string) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

async function getToken(): Promise<string> {
  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  return session?.access_token ?? ''
}

function uploadWithProgress(
  token: string,
  file: File,
  onProgress: (pct: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    const form = new FormData()
    form.append('file', file)

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
    })
    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve()
      else reject(new Error(`Upload failed (${xhr.status})`))
    })
    xhr.addEventListener('error', () => reject(new Error('Upload failed.')))

    xhr.open('POST', `${API_URL}/portal/me/knowledge`)
    xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    xhr.send(form)
  })
}

// ── Tips card ─────────────────────────────────────────────────────────────────

function TipsCard() {
  const good = [
    'FAQ documents',
    'Product catalogues',
    'Return / refund policies',
    'Pricing information',
  ]
  const bad = ['Confidential documents', 'Files over 10 MB']

  return (
    <Card padding="sm" className="h-fit">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-3 mb-4">
        What to upload
      </p>
      <ul className="space-y-2">
        {good.map((item) => (
          <li key={item} className="flex items-start gap-2 text-sm text-ink-2">
            <CheckCircle2 size={14} strokeWidth={2} className="mt-px shrink-0 text-success" />
            {item}
          </li>
        ))}
        <li className="pt-1" />
        {bad.map((item) => (
          <li key={item} className="flex items-start gap-2 text-sm text-ink-3">
            <XCircle size={14} strokeWidth={2} className="mt-px shrink-0 text-danger" />
            {item}
          </li>
        ))}
      </ul>
      <div className="mt-5 rounded-md bg-surface-2 p-3">
        <p className="text-xs text-ink-2 leading-relaxed">
          <span className="font-medium text-ink-2">Tip:</span> The more specific your documents,
          the better your agent's answers. Include real questions your customers ask.
        </p>
      </div>
    </Card>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function KnowledgeBasePage() {
  const { toast } = useToast()
  const inputRef = useRef<HTMLInputElement>(null)

  const [files, setFiles] = useState<KnowledgeFile[]>([])
  const [loading, setLoading] = useState(true)

  const [isDragging, setIsDragging] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)

  const [confirm, setConfirm] = useState<
    | { kind: 'file'; filename: string }
    | { kind: 'all' }
    | null
  >(null)
  const [deletingFile, setDeletingFile] = useState<string | null>(null)
  const [clearingAll, setClearingAll] = useState(false)

  const [websiteUrl, setWebsiteUrl] = useState('')
  const [isCrawling, setIsCrawling] = useState(false)

  // Load files on mount
  useEffect(() => {
    getToken()
      .then((token) => (token ? getMyKnowledgeFiles(token) : []))
      .then(setFiles)
      .catch(() => toast.error('Failed to load files.'))
      .finally(() => setLoading(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Upload ─────────────────────────────────────────────────────────────────

  const handleUpload = useCallback(
    async (file: File) => {
      if (!/\.(pdf|txt)$/i.test(file.name)) {
        toast.error('Only .pdf and .txt files are accepted.')
        setSelectedFile(null)
        return
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File must be under 10 MB.')
        setSelectedFile(null)
        return
      }

      setSelectedFile(file)
      setUploadProgress(0)

      try {
        const token = await getToken()
        if (!token) throw new Error('Not authenticated.')
        await uploadWithProgress(token, file, setUploadProgress)
        const updated = await getMyKnowledgeFiles(token)
        setFiles(updated)
        toast.success(`"${file.name}" uploaded.`)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Upload failed.')
      } finally {
        setSelectedFile(null)
        setUploadProgress(null)
        if (inputRef.current) inputRef.current.value = ''
      }
    },
    [toast]
  )

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleUpload(file)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleUpload(file)
  }

  // ── Delete single ──────────────────────────────────────────────────────────

  async function handleDeleteFile(filename: string) {
    setConfirm(null)
    setDeletingFile(filename)
    try {
      const token = await getToken()
      await deleteMyKnowledgeFile(token, filename)
      setFiles((prev) => prev.filter((f) => f.filename !== filename))
      toast.success(`"${filename}" removed.`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete file.')
    } finally {
      setDeletingFile(null)
    }
  }

  // ── Clear all ──────────────────────────────────────────────────────────────

  async function handleClearAll() {
    setConfirm(null)
    setClearingAll(true)
    try {
      const token = await getToken()
      await deleteMyKnowledge(token)
      setFiles([])
      toast.success('All documents cleared.')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to clear documents.')
    } finally {
      setClearingAll(false)
    }
  }

  async function handleCrawl(e: React.FormEvent) {
    e.preventDefault()
    const url = websiteUrl.trim()
    if (!url) return
    setIsCrawling(true)
    try {
      const token = await getToken()
      if (!token) throw new Error('Not authenticated.')
      const result = await scrapeWebsiteKnowledge(token, url)
      const updated = await getMyKnowledgeFiles(token)
      setFiles(updated)
      toast.success(`Indexed ${result.chunks} chunks from ${result.pages_crawled} pages.`)
      setWebsiteUrl('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to crawl website.')
    } finally {
      setIsCrawling(false)
    }
  }

  const isUploading = uploadProgress !== null

  return (
    <>
      {confirm?.kind === 'file' && (
        <ConfirmDialog
          title="Remove document?"
          description={`"${confirm.filename}" will be removed from your knowledge base.`}
          confirmLabel="Remove"
          onConfirm={() => handleDeleteFile(confirm.filename)}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm?.kind === 'all' && (
        <ConfirmDialog
          title="Clear all documents?"
          description="All uploaded documents will be permanently removed. Your agent will lose access to this knowledge."
          confirmLabel="Clear all"
          onConfirm={handleClearAll}
          onCancel={() => setConfirm(null)}
        />
      )}

      <div className="mx-auto max-w-5xl">
        <div className="mb-5">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Knowledge Base</h1>
          <p className="mt-0.5 text-sm text-ink-2">
            Upload documents your AI agent can reference when answering customer questions.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_220px] gap-5 items-start">
          {/* ── Left column ── */}
          <div className="space-y-4">

            {/* Section 1 — Upload zone */}
            <Card>
              <h3 className="mb-4 text-sm font-semibold text-ink">Upload document</h3>

              {/* Drop zone */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => !isUploading && inputRef.current?.click()}
                onKeyDown={(e) => e.key === 'Enter' && !isUploading && inputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); if (!isUploading) setIsDragging(true) }}
                onDragEnter={(e) => { e.preventDefault(); if (!isUploading) setIsDragging(true) }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={onDrop}
                className={`flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors ${
                  isUploading
                    ? 'cursor-not-allowed border-line bg-surface-2'
                    : isDragging
                    ? 'cursor-copy border-accent/60 bg-surface-2'
                    : 'cursor-pointer border-line hover:border-line-strong hover:bg-surface-2'
                }`}
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept=".pdf,.txt"
                  className="hidden"
                  onChange={onInputChange}
                  disabled={isUploading}
                />

                <div className={`rounded-full p-3 ${isDragging ? 'bg-surface-2' : 'bg-surface-2'}`}>
                  <Upload
                    size={22}
                    strokeWidth={1.75}
                    className={isDragging ? 'text-ink-2' : 'text-ink-3'}
                  />
                </div>

                {selectedFile ? (
                  <div className="text-center">
                    <p className="text-sm font-medium text-ink-2">{selectedFile.name}</p>
                    <p className="text-xs text-ink-3">{formatBytes(selectedFile.size)}</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm text-ink-2">
                      Drag &amp; drop your file here,{' '}
                      <span className="font-medium text-ink">or click to browse</span>
                    </p>
                    <p className="mt-1 text-xs text-ink-3">PDF and TXT files only · Max 10 MB</p>
                  </div>
                )}
              </div>

              {/* Progress bar */}
              {isUploading && (
                <div className="mt-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-ink-2">Uploading…</span>
                    <span className="text-xs text-ink-3">{uploadProgress}%</span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full bg-accent transition-all duration-150"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </Card>

            {/* Section 2 — Website crawl */}
            <Card>
              <h3 className="mb-1 text-sm font-semibold text-ink">Crawl your website</h3>
              <p className="mb-4 text-xs text-ink-3">
                We'll visit your site, follow internal links, and index the content automatically.
              </p>
              <form onSubmit={handleCrawl} className="flex gap-2">
                <input
                  type="url"
                  placeholder="https://your-site.com"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  disabled={isCrawling}
                  required
                  className="flex-1 rounded-md border border-line px-3 py-2 text-sm text-ink placeholder:text-ink-3 focus:border-accent/50 focus:outline-none disabled:bg-surface-2 disabled:text-ink-3"
                />
                <button
                  type="submit"
                  disabled={isCrawling || !websiteUrl.trim()}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-accent shadow-sm shadow-accent/25 px-4 py-2 text-sm font-medium text-on-solid hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isCrawling ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Crawling…
                    </>
                  ) : (
                    <>
                      <Globe size={14} />
                      Crawl
                    </>
                  )}
                </button>
              </form>
              {isCrawling && (
                <p className="mt-2 text-xs text-ink-3">
                  This may take a minute for larger sites…
                </p>
              )}
            </Card>

            {/* Section 3 — Files table */}
            <section className="rounded-xl border border-line bg-surface shadow-card">
              <div className="flex items-center justify-between px-6 py-4 border-b border-line">
                <h3 className="text-sm font-semibold text-ink">
                  Knowledge sources
                  {files.length > 0 && (
                    <span className="ml-2 text-xs font-normal text-ink-3">({files.length})</span>
                  )}
                </h3>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 size={18} className="animate-spin text-ink-3" />
                </div>
              ) : files.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
                  <FolderOpen size={28} strokeWidth={1.5} className="text-ink-3/50 mb-3" />
                  <p className="text-sm font-medium text-ink-2">No documents yet</p>
                  <p className="mt-1 text-xs text-ink-3 max-w-xs leading-relaxed">
                    Upload your FAQs, product info, or policies to teach your AI agent.
                  </p>
                </div>
              ) : (
                <>
                  <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-line bg-surface-2">
                        <th className="px-6 py-2.5 text-left text-xs font-medium text-ink-3">
                          Filename
                        </th>
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-ink-3">
                          Chunks
                        </th>
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-ink-3">
                          Uploaded
                        </th>
                        <th className="px-4 py-2.5" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line/60">
                      {files.map((file) => {
                        const isWebsite = file.filename.startsWith('website:')
                        const displayName = isWebsite
                          ? file.filename.slice('website:'.length)
                          : file.filename
                        return (
                        <tr key={file.filename} className="hover:bg-surface-2 transition-colors">
                          <td className="px-6 py-3">
                            <div className="flex items-center gap-2.5 min-w-0">
                              {isWebsite ? (
                                <Globe
                                  size={14}
                                  strokeWidth={1.75}
                                  className="shrink-0 text-info"
                                />
                              ) : (
                                <FileText
                                  size={14}
                                  strokeWidth={1.75}
                                  className="shrink-0 text-ink-3"
                                />
                              )}
                              <div className="min-w-0">
                                <p className="truncate font-medium text-ink">
                                  {displayName}
                                </p>
                                {!isWebsite && file.size && (
                                  <p className="text-xs text-ink-3">{formatBytes(file.size)}</p>
                                )}
                                {isWebsite && (
                                  <p className="text-xs text-ink-3">Website</p>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-ink-2">
                            {file.chunks ?? '—'}
                          </td>
                          <td className="px-4 py-3 text-ink-2">
                            {formatDate(file.created_at)}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() =>
                                setConfirm({ kind: 'file', filename: file.filename })
                              }
                              disabled={deletingFile === file.filename || clearingAll}
                              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-ink-3 hover:bg-danger-soft hover:text-danger disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                            >
                              {deletingFile === file.filename ? (
                                <Loader2 size={12} className="animate-spin" />
                              ) : (
                                <Trash2 size={12} strokeWidth={1.75} />
                              )}
                              Delete
                            </button>
                          </td>
                        </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  </div>

                  <div className="flex justify-end px-6 py-3 border-t border-line">
                    <button
                      onClick={() => setConfirm({ kind: 'all' })}
                      disabled={clearingAll || isUploading}
                      className="inline-flex items-center gap-1.5 rounded-md border border-line px-3 py-1.5 text-xs font-medium text-ink-2 hover:border-danger/30 hover:bg-danger-soft hover:text-danger disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      {clearingAll ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Trash2 size={12} strokeWidth={1.75} />
                      )}
                      Clear all documents
                    </button>
                  </div>
                </>
              )}
            </section>
          </div>

          {/* ── Right column — Tips ── */}
          <TipsCard />
        </div>
      </div>
    </>
  )
}

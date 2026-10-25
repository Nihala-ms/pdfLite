
import { useEffect, useRef, useState } from 'react'
import {
  ArrowDownToLine,
  CheckCircle2,
  FileText,
  Gauge,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  XCircle,
} from 'lucide-react'

import Header from './components/Header.jsx'
import UploadZone from './components/UploadZone.jsx'
import AnalyticsConsent from './components/AnalyticsConsent.jsx'
import { compressPdf } from './utils/compressPdf.js'
import { trackEvent } from './utils/analytics.js'

const MAX_FILE_SIZE = 100 * 1024 * 1024

const COMPRESSION_SETTINGS = {
  smaller: { quality: 0.4, scale: 0.9 },
  balanced: { quality: 0.6, scale: 1.25 },
  clearer: { quality: 0.82, scale: 1.6 },
}

function formatKB(bytes) {
  return `${(bytes / 1024).toFixed(2)} KB`
}

function formatMB(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function formatFileSize(bytes) {
  if (bytes < 1024 * 1024) {
    return formatKB(bytes)
  }

  return formatMB(bytes)
}

function getResultCategory(result) {
  if (result.compressedSize >= result.originalSize) {
    return 'not_smaller'
  }

  if (result.savedPercentage >= 50) {
    return 'excellent'
  }

  if (result.savedPercentage >= 15) {
    return 'good'
  }

  return 'small'
}

export default function App() {
  const [selectedFile, setSelectedFile] = useState(null)
  const [qualityMode, setQualityMode] = useState('balanced')
  const [isProcessing, setIsProcessing] = useState(false)
  const [progress, setProgress] = useState(null)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [dragHint, setDragHint] = useState(false)

  const downloadUrlRef = useRef(null)

  useEffect(() => {
    return () => {
      if (downloadUrlRef.current) {
        URL.revokeObjectURL(downloadUrlRef.current)
      }
    }
  }, [])

  function clearPreviousResult() {
    if (downloadUrlRef.current) {
      URL.revokeObjectURL(downloadUrlRef.current)
      downloadUrlRef.current = null
    }

    setResult(null)
    setProgress(null)
    setError('')
  }

  function handleFileSelected(file) {
    clearPreviousResult()

    if (!file) return

    const isPdf =
      file.type === 'application/pdf' ||
      file.name.toLowerCase().endsWith('.pdf')

    if (!isPdf) {
      setSelectedFile(null)
      setError('Please choose a PDF file.')
      return
    }

    if (file.size === 0) {
      setSelectedFile(null)
      setError('This file is empty. Please choose another PDF.')
      return
    }

    if (file.size > MAX_FILE_SIZE) {
      setSelectedFile(null)
      setError('The maximum supported file size is 100 MB.')
      return
    }

    setSelectedFile(file)
  }

  async function handleCompress() {
    if (!selectedFile || isProcessing) return

    clearPreviousResult()
    setIsProcessing(true)

    trackEvent('tool_started', {
      compression_mode: qualityMode,
    })

    try {
      const settings = COMPRESSION_SETTINGS[qualityMode]

      const compressionResult = await compressPdf(selectedFile, {
        ...settings,
        onProgress: (pageProgress) => {
          setProgress(pageProgress)
        },
      })

      const url = URL.createObjectURL(compressionResult.blob)
      downloadUrlRef.current = url

      setResult({
        ...compressionResult,
        url,
      })

      trackEvent('optimization_completed', {
        result_category: getResultCategory(compressionResult),
        compression_mode: qualityMode,
      })
    } catch (err) {
      console.error('Compression failed:', err)

      const message =
        err instanceof Error
          ? err.message
          : 'An unexpected error occurred while processing the PDF.'

      setError(message)

      trackEvent('optimization_error', {
        error_type: 'processing_failed',
      })
    } finally {
      setIsProcessing(false)
      setProgress(null)
    }
  }

  function handleDownload() {
    if (!result?.url) return

    const link = document.createElement('a')
    link.href = result.url
    link.download = result.fileName

    document.body.appendChild(link)
    link.click()
    link.remove()

    trackEvent('download_completed', {
      result_category: getResultCategory(result),
    })
  }

  function handleReset() {
    clearPreviousResult()
    setSelectedFile(null)
    setIsProcessing(false)
    setDragHint(false)
  }

  const savedBytes = result
    ? result.originalSize - result.compressedSize
    : 0

  const isSmaller = result
    ? result.compressedSize < result.originalSize
    : false

  const progressPercentage =
    progress && progress.total > 0
      ? Math.round((progress.current / progress.total) * 100)
      : 0

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <Header />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
        <section className="mx-auto max-w-3xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-violet-100 bg-white px-4 py-2 text-sm font-medium text-violet-700 shadow-sm">
            <Sparkles size={16} />
            Free online PDF compressor
          </div>

          <h1 className="text-3xl font-extrabold tracking-tight text-slate-950 sm:text-5xl">
            Compress PDF files
            <span className="block text-violet-600">
              quickly and privately
            </span>
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
            Reduce PDF file size directly in your browser. Optimize
            storybooks, ebooks, scanned documents, and other PDFs
            without uploading your documents to our server.
          </p>

          <div className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-slate-500">
            <span className="flex items-center gap-1.5">
              <ShieldCheck size={16} className="text-emerald-600" />
              Browser-based processing
            </span>
            <span className="flex items-center gap-1.5">
              <LockKeyhole size={16} className="text-emerald-600" />
              Your files stay on your device
            </span>
          </div>
        </section>

        <section className="mx-auto mt-9 max-w-3xl rounded-3xl border border-slate-200 bg-white p-4 shadow-xl shadow-slate-200/60 sm:mt-12 sm:p-8">
          <UploadZone
            onFileSelected={handleFileSelected}
            disabled={isProcessing}
            error={error}
          />

          {selectedFile && (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
                  <FileText size={25} />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="break-words font-semibold text-slate-900">
                    {selectedFile.name}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Original size: {formatFileSize(selectedFile.size)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Processing takes place in your browser. Large PDFs
                    may take longer on mobile devices.
                  </p>
                </div>

                {!isProcessing && (
                  <button
                    type="button"
                    onClick={handleReset}
                    aria-label="Remove selected PDF"
                    className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
                  >
                    <XCircle size={20} />
                  </button>
                )}
              </div>

              <div className="mt-6">
                <h2 className="font-bold text-slate-900">
                  Compression level
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Smaller files may have lower image quality.
                </p>

                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {[
                    {
                      value: 'smaller',
                      title: 'Smaller file',
                      description: 'Prioritize file size',
                    },
                    {
                      value: 'balanced',
                      title: 'Balanced',
                      description: 'Balance size and quality',
                    },
                    {
                      value: 'clearer',
                      title: 'Clearer pages',
                      description: 'Prioritize image quality',
                    },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      disabled={isProcessing}
                      onClick={() => setQualityMode(option.value)}
                      aria-pressed={qualityMode === option.value}
                      className={`rounded-xl border p-3 text-left transition ${
                        qualityMode === option.value
                          ? 'border-violet-500 bg-violet-50 ring-2 ring-violet-100'
                          : 'border-slate-200 bg-white hover:border-violet-300'
                      } disabled:cursor-not-allowed disabled:opacity-60`}
                    >
                      <span className="block font-semibold text-slate-900">
                        {option.title}
                      </span>
                      <span className="mt-1 block text-xs leading-5 text-slate-500">
                        {option.description}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                disabled={isProcessing}
                onClick={handleCompress}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-4 font-bold text-white shadow-lg shadow-violet-200 transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw size={19} className="animate-spin" />
                    Processing PDF...
                  </>
                ) : (
                  <>
                    <Gauge size={20} />
                    Compress PDF
                  </>
                )}
              </button>
            </div>
          )}

          {isProcessing && (
            <div
              className="mt-5 rounded-2xl border border-violet-100 bg-violet-50 p-4"
              aria-live="polite"
            >
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="font-semibold text-violet-900">
                  Processing your PDF
                </span>
                <span className="shrink-0 font-medium text-violet-700">
                  {progress
                    ? `${progress.current} / ${progress.total} pages`
                    : 'Preparing...'}
                </span>
              </div>

              <div
                className="mt-3 h-2.5 overflow-hidden rounded-full bg-violet-100"
                role="progressbar"
                aria-label="PDF processing progress"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={progressPercentage}
              >
                <div
                  className="h-full rounded-full bg-violet-600 transition-all duration-200"
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>

              <p className="mt-3 text-sm leading-6 text-violet-800">
                Keep this tab open while the PDF is processing.
                Large documents can take several minutes on a phone.
              </p>
            </div>
          )}

          {result && (
            <section
              className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6"
              aria-live="polite"
            >
              <div className="flex items-start gap-3">
                {isSmaller ? (
                  <CheckCircle2
                    size={27}
                    className="shrink-0 text-emerald-600"
                  />
                ) : (
                  <XCircle
                    size={27}
                    className="shrink-0 text-amber-600"
                  />
                )}

                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    {isSmaller
                      ? 'Compression complete!'
                      : 'No file size reduction'}
                  </h2>

                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    {isSmaller
                      ? `Your file is ${result.savedPercentage.toFixed(2)}% smaller.`
                      : 'The generated PDF is not smaller than the original. Your original file may already be optimized.'}
                  </p>
                </div>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs font-medium text-slate-500">
                    Original size
                  </p>
                  <p className="mt-1 break-words text-lg font-bold text-slate-900">
                    {formatFileSize(result.originalSize)}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs font-medium text-slate-500">
                    Result size
                  </p>
                  <p className="mt-1 break-words text-lg font-bold text-slate-900">
                    {formatFileSize(result.compressedSize)}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs font-medium text-slate-500">
                    {isSmaller ? 'Space saved' : 'Size difference'}
                  </p>
                  <p
                    className={`mt-1 break-words text-lg font-bold ${
                      isSmaller ? 'text-emerald-700' : 'text-amber-700'
                    }`}
                  >
                    {isSmaller
                      ? formatFileSize(savedBytes)
                      : `+${formatFileSize(Math.abs(savedBytes))}`}
                  </p>
                </div>
              </div>

              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={handleDownload}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-3.5 font-semibold text-white transition hover:bg-violet-700"
                >
                  <ArrowDownToLine size={19} />
                  Download PDF
                </button>

                <button
                  type="button"
                  onClick={handleReset}
                  className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 py-3.5 font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  <RefreshCw size={18} />
                  Compress another
                </button>
              </div>

              <p className="mt-4 text-xs leading-5 text-slate-500">
                This version converts PDF pages into images. Text
                selection, hyperlinks, forms, and other interactive
                elements may not be preserved. Check the downloaded
                file before relying on it.
              </p>
            </section>
          )}
        </section>

        <section
          id="how-it-works"
          className="mx-auto mt-14 max-w-4xl"
        >
          <div className="text-center">
            <h2 className="text-2xl font-extrabold text-slate-950 sm:text-3xl">
              How to compress a PDF
            </h2>
            <p className="mt-3 text-slate-600">
              Three simple steps to optimize your document.
            </p>
          </div>

          <div className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {[
              {
                number: '01',
                title: 'Choose a PDF',
                description:
                  'Select your PDF from your phone, tablet, or computer.',
              },
              {
                number: '02',
                title: 'Choose quality',
                description:
                  'Select smaller file, balanced, or clearer pages.',
              },
              {
                number: '03',
                title: 'Download',
                description:
                  'Compare the file sizes and download your result.',
              },
            ].map((step) => (
              <article
                key={step.number}
                className="rounded-2xl border border-slate-200 bg-white p-5"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 font-bold text-violet-700">
                  {step.number}
                </span>

                <h3 className="mt-4 font-bold text-slate-900">
                  {step.title}
                </h3>

                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {step.description}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="mx-auto mt-12 max-w-4xl rounded-2xl border border-emerald-100 bg-emerald-50/70 p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <ShieldCheck
              size={24}
              className="shrink-0 text-emerald-700"
            />

            <div>
              <h2 className="font-bold text-slate-900">
                Your privacy matters
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                PDFLite processes document pages locally in your
                browser. Your PDF contents and filenames are not
                intentionally sent to our analytics service.
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto mt-12 max-w-4xl">
          <h2 className="text-2xl font-extrabold text-slate-950">
            Frequently asked questions
          </h2>

          <div className="mt-5 space-y-4">
            <article className="rounded-xl border border-slate-200 bg-white p-5">
              <h3 className="font-bold text-slate-900">
                Can I compress a 300-page PDF?
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                PDFLite no longer applies a fixed 100-page limit.
                Longer documents can be attempted, but performance
                depends on the PDF and your device's available memory.
              </p>
            </article>

            <article className="rounded-xl border border-slate-200 bg-white p-5">
              <h3 className="font-bold text-slate-900">
                Why is my compressed PDF larger?
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Some PDFs already contain optimized images and text.
                Converting pages into images can increase file size,
                so PDFLite compares the actual result with the original.
              </p>
            </article>

            <article className="rounded-xl border border-slate-200 bg-white p-5">
              <h3 className="font-bold text-slate-900">
                Does PDFLite upload my PDF?
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                PDF processing runs in your browser. Analytics, if
                enabled with consent, measures general usage events
                rather than intentionally transmitting your document
                or its filename.
              </p>
            </article>

            <article className="rounded-xl border border-slate-200 bg-white p-5">
              <h3 className="font-bold text-slate-900">
                Will the text remain selectable?
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Not with the current image-based compression method.
                It is best suited to documents where reducing page
                image size matters more than preserving text selection.
              </p>
            </article>
          </div>
        </section>
      </main>

      <footer className="mt-14 border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-7 text-center text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:text-left">
          <p>
            © {new Date().getFullYear()} PDFLite. Free online PDF tools.
          </p>
          <p>Simple. Private. Online.</p>
        </div>
      </footer>

      <AnalyticsConsent />
    </div>
  )
}

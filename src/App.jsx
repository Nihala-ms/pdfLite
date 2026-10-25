
import { useState } from 'react'
import {
  ArrowDownToLine,
  CheckCircle2,
  FileText,
  Gauge,
  LockKeyhole,
  RefreshCw,
  Sparkles,
  Upload,
  RotateCcw,
} from 'lucide-react'

import Header from './components/Header.jsx'
import UploadZone from './components/UploadZone.jsx'
import AnalyticsConsent from './components/AnalyticsConsent.jsx'
import { compressPdf } from './utils/compressPdf.js'
import { trackEvent } from './utils/analytics.js'

const MAX_FILE_SIZE = 100 * 1024 * 1024

const COMPRESSION_SETTINGS = {
  smaller: {
    quality: 0.4,
    scale: 0.9,
  },
  balanced: {
    quality: 0.6,
    scale: 1.25,
  },
  clearer: {
    quality: 0.82,
    scale: 1.6,
  },
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

export default function App() {
  const [file, setFile] = useState(null)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)
  const [qualityMode, setQualityMode] = useState('balanced')
  const [progress, setProgress] = useState(null)

  function handleFileSelected(selectedFile) {
    setError('')
    setResult(null)
    setProgress(null)

    const isPdf =
      selectedFile.type === 'application/pdf' ||
      selectedFile.name.toLowerCase().endsWith('.pdf')

    if (!isPdf) {
      setFile(null)
      setError('Please select a PDF file.')
      return
    }

    if (selectedFile.size === 0) {
      setFile(null)
      setError('The selected file is empty.')
      return
    }

    if (selectedFile.size > MAX_FILE_SIZE) {
      setFile(null)
      setError('The maximum supported file size is 100 MB.')
      return
    }

    setFile(selectedFile)
  }

  async function handleOptimize() {
    if (!file || isProcessing) return

    setError('')
    setResult(null)
    setProgress(null)
    setIsProcessing(true)

    trackEvent('tool_started', {
      compression_mode: qualityMode,
    })

    try {
      const settings = COMPRESSION_SETTINGS[qualityMode]

      const optimized = await compressPdf(file, {
        ...settings,
        onProgress: setProgress,
      })

      setResult(optimized)

      const resultCategory =
        optimized.compressedSize < optimized.originalSize
          ? 'smaller'
          : optimized.compressedSize === optimized.originalSize
            ? 'same_size'
            : 'larger'

      trackEvent('optimization_completed', {
        result_category: resultCategory,
        compression_mode: qualityMode,
      })
    } catch (err) {
      setError(
        err?.message ||
          'Unable to process this PDF. Please try another file.',
      )

      trackEvent('optimization_error', {
        error_type: 'processing_failed',
      })
    } finally {
      setIsProcessing(false)
      setProgress(null)
    }
  }

  function handleDownload() {
    if (!result) return

    const url = URL.createObjectURL(result.blob)
    const link = document.createElement('a')

    link.href = url
    link.download = result.fileName

    document.body.appendChild(link)
    link.click()
    link.remove()

    window.setTimeout(() => URL.revokeObjectURL(url), 1000)

    trackEvent('download_completed', {
      result_category:
        result.compressedSize < result.originalSize
          ? 'smaller'
          : result.compressedSize === result.originalSize
            ? 'same_size'
            : 'larger',
    })
  }

  function handleReset() {
    setFile(null)
    setResult(null)
    setError('')
    setIsProcessing(false)
    setProgress(null)
    setQualityMode('balanced')
  }

  const savedBytes = result
    ? result.originalSize - result.compressedSize
    : 0

  const savedPercentage = result
    ? ((result.originalSize - result.compressedSize) /
        result.originalSize) *
      100
    : 0

  return (
    <div className="min-h-screen bg-[#faf9ff] text-slate-800">
      <Header />

      <main>
        {/* Hero and PDF compressor */}
        <section className="px-5 pb-16 pt-14 sm:pb-24 sm:pt-20">
          <div className="mx-auto max-w-4xl">
            <div className="mb-5 flex justify-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-violet-100 bg-white px-4 py-2 text-sm font-medium text-violet-700 shadow-sm">
                <Sparkles size={16} />
                Smart PDF compression
              </span>
            </div>

            <h1 className="mx-auto max-w-3xl text-center text-4xl font-extrabold leading-tight tracking-tight text-slate-950 sm:text-6xl">
              Compress PDF files
              <span className="block text-violet-600">
                to a smaller size
              </span>
            </h1>

            <p className="mx-auto mt-5 max-w-2xl text-center text-base leading-7 text-slate-600 sm:text-lg">
              Reduce the size of image-heavy PDFs in your browser.
              Choose your compression level, compare the results,
              and download the optimized document.
            </p>

            <div className="mt-10 rounded-[2rem] border border-violet-100 bg-white p-5 shadow-xl shadow-violet-100/60 sm:p-8">
              {!result ? (
                <>
                  <UploadZone
                    onFileSelected={handleFileSelected}
                    disabled={isProcessing}
                    error={error}
                  />

                  {file && (
                    <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
                          <FileText size={24} />
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold text-slate-900">
                            {file.name}
                          </p>

                          <p className="mt-1 text-sm text-slate-500">
                            Original size: {formatFileSize(file.size)}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={handleReset}
                          disabled={isProcessing}
                          className="rounded-lg px-3 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-200 disabled:opacity-50"
                        >
                          Remove
                        </button>
                      </div>

                      {/* Compression settings */}
                      <div className="mt-5">
                        <label
                          htmlFor="compression-quality"
                          className="mb-2 block text-sm font-semibold text-slate-800"
                        >
                          Compression level
                        </label>

                        <select
                          id="compression-quality"
                          value={qualityMode}
                          onChange={(event) =>
                            setQualityMode(event.target.value)
                          }
                          disabled={isProcessing}
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-100 disabled:opacity-60"
                        >
                          <option value="smaller">
                            Smaller file — lower image quality
                          </option>

                          <option value="balanced">
                            Balanced — recommended starting point
                          </option>

                          <option value="clearer">
                            Clearer images — larger file
                          </option>
                        </select>

                        <p className="mt-2 text-xs leading-5 text-slate-500">
                          Smaller mode uses lower image quality and
                          resolution. Results depend on the PDF content.
                        </p>
                      </div>

                      {/* Processing progress */}
                      {isProcessing && progress && (
                        <div
                          className="mt-5"
                          role="status"
                          aria-live="polite"
                        >
                          <div className="mb-2 flex items-center justify-between text-sm">
                            <span className="font-medium text-violet-700">
                              Processing PDF pages...
                            </span>

                            <span className="text-slate-500">
                              {progress.current} / {progress.total}
                            </span>
                          </div>

                          <div className="h-2 overflow-hidden rounded-full bg-violet-100">
                            <div
                              className="h-full rounded-full bg-violet-600 transition-all duration-200"
                              style={{
                                width: `${
                                  (progress.current / progress.total) * 100
                                }%`,
                              }}
                            />
                          </div>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={handleOptimize}
                        disabled={isProcessing}
                        className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-3.5 font-bold text-white shadow-lg shadow-violet-200 transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isProcessing ? (
                          <>
                            <RefreshCw
                              size={19}
                              className="animate-spin"
                            />
                            Compressing PDF...
                          </>
                        ) : (
                          <>
                            <Sparkles size={19} />
                            Compress PDF
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  <p className="mt-5 text-center text-xs leading-5 text-slate-400">
                    Files are processed in your browser. Large PDFs
                    may require additional memory.
                  </p>
                </>
              ) : (
                /* Compression results */
                <div className="py-4">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
                    <CheckCircle2 size={34} />
                  </div>

                  <h2 className="mt-5 text-center text-2xl font-bold text-slate-900">
                    PDF compression complete
                  </h2>

                  <p className="mt-2 text-center text-sm text-slate-500">
                    Here is the actual size comparison for your file.
                  </p>

                  <div className="mt-7 grid gap-4 sm:grid-cols-2">
                    <div className="rounded-2xl border border-slate-200 p-5">
                      <p className="text-sm text-slate-500">
                        Original size
                      </p>

                      <p className="mt-2 break-words text-2xl font-bold text-slate-900">
                        {formatKB(result.originalSize)}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-violet-200 bg-violet-50 p-5">
                      <p className="text-sm text-violet-700">
                        Compressed size
                      </p>

                      <p className="mt-2 break-words text-2xl font-bold text-slate-900">
                        {formatKB(result.compressedSize)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 rounded-2xl bg-slate-50 p-5 text-center">
                    {savedBytes > 0 ? (
                      <>
                        <p className="text-3xl font-extrabold text-emerald-700">
                          {savedPercentage.toFixed(2)}%
                        </p>

                        <p className="mt-1 text-sm text-slate-600">
                          Space saved: {formatKB(savedBytes)}
                        </p>
                      </>
                    ) : savedBytes === 0 ? (
                      <>
                        <p className="font-bold text-slate-800">
                          No size reduction
                        </p>

                        <p className="mt-1 text-sm text-slate-600">
                          The output file is the same size as the original.
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="font-bold text-amber-700">
                          The file became larger
                        </p>

                        <p className="mt-1 text-sm text-slate-600">
                          The output is {formatKB(Math.abs(savedBytes))}{' '}
                          larger than the original. You may prefer
                          to keep your original PDF.
                        </p>
                      </>
                    )}
                  </div>

                  {result.compressedSize > result.originalSize && (
                    <p className="mt-3 text-center text-sm text-amber-700">
                      Tip: Try the Smaller file preset and compare again.
                    </p>
                  )}

                  <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                    <button
                      type="button"
                      onClick={handleDownload}
                      className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-3.5 font-bold text-white transition hover:bg-violet-700"
                    >
                      <ArrowDownToLine size={19} />
                      Download compressed PDF
                    </button>

                    <button
                      type="button"
                      onClick={handleReset}
                      className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-5 py-3.5 font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      <RotateCcw size={18} />
                      Compress another
                    </button>
                  </div>

                  <p className="mt-4 text-center text-xs leading-5 text-slate-400">
                    This version converts pages to images. Text selection,
                    searchable text, links, forms, and some other PDF
                    features will not be preserved.
                  </p>
                </div>
              )}
            </div>

            {/* Features */}
            <div className="mt-8 grid gap-4 sm:grid-cols-3">
              <Feature
                icon={<LockKeyhole size={21} />}
                title="Browser-based processing"
                description="The PDF is processed locally instead of being uploaded to your app server."
              />

              <Feature
                icon={<Gauge size={21} />}
                title="Choose your quality"
                description="Select smaller output, balanced quality, or clearer images."
              />

              <Feature
                icon={<Upload size={21} />}
                title="Compare actual sizes"
                description="See the output size and how many KB were saved."
              />
            </div>

            <p className="mx-auto mt-5 max-w-3xl text-center text-xs leading-5 text-slate-400">
              Compression results depend on page count, images, fonts,
              and the original PDF. No specific output size is guaranteed.
            </p>
          </div>
        </section>

        {/* How it works */}
        <section
          id="how-it-works"
          className="border-y border-violet-100 bg-white px-5 py-16 sm:py-20"
        >
          <div className="mx-auto max-w-5xl">
            <h2 className="text-center text-3xl font-extrabold tracking-tight text-slate-950">
              How to compress a PDF online
            </h2>

            <p className="mx-auto mt-3 max-w-2xl text-center leading-7 text-slate-600">
              Reduce PDF size in three steps without uploading the
              document to your application server.
            </p>

            <div className="mt-10 grid gap-6 sm:grid-cols-3">
              <Step
                number="01"
                title="Upload a PDF"
                description="Choose a PDF document from your device."
              />

              <Step
                number="02"
                title="Choose compression"
                description="Select a quality preset and process your PDF."
              />

              <Step
                number="03"
                title="Download your result"
                description="Compare the actual file sizes before downloading."
              />
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="px-5 py-16 sm:py-20">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-center text-3xl font-extrabold tracking-tight text-slate-950">
              Frequently asked questions
            </h2>

            <div className="mt-8 space-y-4">
              <FAQ
                question="Can a 5 MB PDF become 800 KB?"
                answer="It is possible for some PDFs, especially image-heavy documents, but it depends on the original content, page count, image quality, and resolution. This tool cannot guarantee a specific output size."
              />

              <FAQ
                question="Why does my PDF become blurry?"
                answer="The smaller-file preset uses lower image quality and resolution. Try the balanced or clearer preset if the text, signatures, or images are difficult to read."
              />

              <FAQ
                question="Can I search or select text in the compressed PDF?"
                answer="Not in this version. Each page is converted into an image, so text is no longer selectable or searchable. Links, forms, and other interactive elements are also not preserved."
              />

              <FAQ
                question="Are my PDF files uploaded to a server?"
                answer="The PDF processing code runs in your browser. This application does not intentionally upload the selected document to its application server. Optional website analytics should not receive PDF contents or filenames."
              />

              <FAQ
                question="Which compression preset should I use?"
                answer="Try Smaller file when the output size matters most, Balanced for a compromise, and Clearer images when readability matters more. Always check the output before using or submitting it."
              />
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-violet-100 bg-white px-5 py-7">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 text-center sm:flex-row sm:text-left">
          <p className="text-sm font-semibold text-slate-700">
            © {new Date().getFullYear()} PDFLite
          </p>

          <p className="text-xs text-slate-500">
            A browser-based PDF compression tool.
          </p>
        </div>
      </footer>

      <AnalyticsConsent />
    </div>
  )
}

function Feature({ icon, title, description }) {
  return (
    <div className="rounded-2xl border border-violet-100 bg-white p-5">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
        {icon}
      </div>

      <h3 className="mt-4 font-bold text-slate-900">{title}</h3>

      <p className="mt-2 text-sm leading-6 text-slate-600">
        {description}
      </p>
    </div>
  )
}

function Step({ number, title, description }) {
  return (
    <div className="rounded-2xl border border-violet-100 bg-[#faf9ff] p-6">
      <p className="text-sm font-extrabold tracking-widest text-violet-600">
        {number}
      </p>

      <h3 className="mt-3 text-lg font-bold text-slate-900">{title}</h3>

      <p className="mt-2 text-sm leading-6 text-slate-600">
        {description}
      </p>
    </div>
  )
}

function FAQ({ question, answer }) {
  return (
    <details className="group rounded-2xl border border-slate-200 bg-white p-5">
      <summary className="cursor-pointer list-none font-semibold text-slate-900">
        <span className="flex items-center justify-between gap-4">
          {question}

          <span className="text-xl text-violet-600 transition group-open:rotate-45">
            +
          </span>
        </span>
      </summary>

      <p className="mt-3 text-sm leading-7 text-slate-600">
        {answer}
      </p>
    </details>
  )
}

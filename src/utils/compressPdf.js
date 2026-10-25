
import { PDFDocument } from 'pdf-lib'
import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker

const MAX_FILE_SIZE = 100 * 1024 * 1024
const MAX_PAGES = 100

function canvasToJpeg(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob)
        } else {
          reject(new Error('Could not convert a PDF page to an image.'))
        }
      },
      'image/jpeg',
      quality,
    )
  })
}

function getSafeSettings(requestedQuality, requestedScale, pageCount) {
  const isMobile =
    typeof window !== 'undefined' &&
    window.matchMedia('(max-width: 768px)').matches

  let quality = requestedQuality
  let scale = requestedScale

  // Reduce rendering workload on mobile devices.
  if (isMobile) {
    scale = Math.min(scale, 1)
    quality = Math.min(quality, 0.6)
  }

  // Reduce memory usage for longer documents.
  if (pageCount > 30) {
    scale = Math.min(scale, 0.8)
    quality = Math.min(quality, 0.5)
  }

  if (pageCount > 60) {
    scale = Math.min(scale, 0.65)
    quality = Math.min(quality, 0.4)
  }

  return { quality, scale }
}

export async function compressPdf(
  file,
  { quality = 0.6, scale = 1.25, onProgress } = {},
) {
  if (!(file instanceof File)) {
    throw new Error('Please select a PDF file.')
  }

  const isPdf =
    file.type === 'application/pdf' ||
    file.name.toLowerCase().endsWith('.pdf')

  if (!isPdf) {
    throw new Error('Please select a PDF file.')
  }

  if (file.size === 0) {
    throw new Error('The selected file is empty.')
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error('The maximum supported file size is 100 MB.')
  }

  if (quality < 0.1 || quality > 1) {
    throw new Error('Image quality must be between 0.1 and 1.')
  }

  if (scale < 0.5 || scale > 2) {
    throw new Error('Rendering scale must be between 0.5 and 2.')
  }

  let loadingTask

  try {
    const buffer = await file.arrayBuffer()

    loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(buffer),
    })

    const pdf = await loadingTask.promise

    if (pdf.numPages > MAX_PAGES) {
      throw new Error(
        `This PDF contains ${pdf.numPages} pages. The current version supports up to ${MAX_PAGES} pages. Please split the PDF into smaller files.`,
      )
    }

    const settings = getSafeSettings(
      quality,
      scale,
      pdf.numPages,
    )

    const outputPdf = await PDFDocument.create()

    for (
      let pageNumber = 1;
      pageNumber <= pdf.numPages;
      pageNumber++
    ) {
      onProgress?.({
        current: pageNumber,
        total: pdf.numPages,
      })

      const page = await pdf.getPage(pageNumber)

      const originalViewport = page.getViewport({ scale: 1 })
      const renderViewport = page.getViewport({
        scale: settings.scale,
      })

      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d', {
        alpha: false,
      })

      if (!context) {
        throw new Error(
          'Your browser could not create the canvas needed to process this PDF.',
        )
      }

      canvas.width = Math.ceil(renderViewport.width)
      canvas.height = Math.ceil(renderViewport.height)

      try {
        await page.render({
          canvas,
          canvasContext: context,
          viewport: renderViewport,
          background: 'rgb(255, 255, 255)',
        }).promise

        const jpegBlob = await canvasToJpeg(
          canvas,
          settings.quality,
        )

        const jpegBytes = await jpegBlob.arrayBuffer()
        const embeddedImage = await outputPdf.embedJpg(jpegBytes)

        const outputPage = outputPdf.addPage([
          originalViewport.width,
          originalViewport.height,
        ])

        outputPage.drawImage(embeddedImage, {
          x: 0,
          y: 0,
          width: originalViewport.width,
          height: originalViewport.height,
        })
      } finally {
        canvas.width = 0
        canvas.height = 0
        page.cleanup()
      }
    }

    onProgress?.({
      current: pdf.numPages,
      total: pdf.numPages,
    })

    const outputBytes = await outputPdf.save({
      useObjectStreams: true,
    })

    const blob = new Blob([outputBytes], {
      type: 'application/pdf',
    })

    return {
      blob,
      originalSize: file.size,
      compressedSize: blob.size,
      savedBytes: file.size - blob.size,
      savedPercentage:
        ((file.size - blob.size) / file.size) * 100,
      fileName:
        file.name.replace(/\.pdf$/i, '') + '-compressed.pdf',
    }
  } catch (error) {
    console.error('PDF compression error:', error)

    if (
      error?.name === 'PasswordException' ||
      error?.name === 'EncryptedPDFException'
    ) {
      throw new Error(
        'This PDF is password-protected. Please unlock it before compressing.',
      )
    }

    if (
      error?.message?.includes('supports up to') ||
      error?.message?.includes('contains')
    ) {
      throw error
    }

    if (
      error?.name === 'AbortException' ||
      /memory|allocation|out of memory/i.test(error?.message || '')
    ) {
      throw new Error(
        'Your device ran out of memory while processing this PDF. Try a smaller PDF or split it into smaller files.',
      )
    }

    throw new Error(
      'PDF processing failed. Please try a smaller PDF or another file. If the problem continues, check the browser console for the original error.',
    )
  } finally {
    if (loadingTask) {
      await loadingTask.destroy().catch(() => {})
    }
  }
}

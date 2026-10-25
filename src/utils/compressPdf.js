
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
          reject(new Error('Could not compress a PDF page.'))
        }
      },
      'image/jpeg',
      quality,
    )
  })
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
    throw new Error('Only PDF files are supported.')
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

  let loadingTask = null

  try {
    const buffer = await file.arrayBuffer()

    loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(buffer),
    })

    const pdf = await loadingTask.promise

    if (pdf.numPages > MAX_PAGES) {
      throw new Error(
        `This version supports up to ${MAX_PAGES} pages per PDF.`,
      )
    }

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
      const renderViewport = page.getViewport({ scale })

      const canvas = document.createElement('canvas')
      const context = canvas.getContext('2d', {
        alpha: false,
      })

      if (!context) {
        throw new Error('Your browser could not create a canvas.')
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

        const jpegBlob = await canvasToJpeg(canvas, quality)
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
    if (
      error?.name === 'PasswordException' ||
      error?.name === 'EncryptedPDFException'
    ) {
      throw new Error(
        'This PDF is password-protected. Please use an unlocked PDF.',
      )
    }

    if (
      error?.message?.includes('supports up to') ||
      error?.message?.includes('must be between')
    ) {
      throw error
    }

    console.error('PDF compression failed:', error)

    throw new Error(
      'Could not process this PDF. It may be damaged, encrypted, or too complex for your browser.',
    )
  } finally {
    if (loadingTask) {
      await loadingTask.destroy().catch(() => {})
    }
  }
}

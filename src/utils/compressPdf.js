
import { PDFDocument } from 'pdf-lib'
import * as pdfjsLib from 'pdfjs-dist'
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker

const MAX_FILE_SIZE = 100 * 1024 * 1024

function canvasToJpeg(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob)
        } else {
          reject(
            new Error('Could not convert a PDF page to an image.')
          )
        }
      },
      'image/jpeg',
      quality,
    )
  })
}

function getDeviceSettings(pageCount, quality, scale) {
  const isMobile =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(max-width: 768px)').matches

  let finalQuality = quality
  let finalScale = scale

  // Reduce memory usage on mobile devices.
  if (isMobile) {
    finalScale = Math.min(finalScale, 0.85)
    finalQuality = Math.min(finalQuality, 0.55)
  }

  // Adapt rendering settings for larger documents.
  if (pageCount > 50) {
    finalScale = Math.min(finalScale, 0.8)
    finalQuality = Math.min(finalQuality, 0.5)
  }

  if (pageCount > 100) {
    finalScale = Math.min(finalScale, 0.65)
    finalQuality = Math.min(finalQuality, 0.45)
  }

  if (pageCount > 200) {
    finalScale = Math.min(finalScale, 0.5)
    finalQuality = Math.min(finalQuality, 0.4)
  }

  return {
    quality: finalQuality,
    scale: finalScale,
    maxPixels: isMobile ? 4_000_000 : 8_000_000,
    maxDimension: isMobile ? 2560 : 3500,
  }
}

function getSafeRenderScale(viewport, settings) {
  const width = viewport.width
  const height = viewport.height

  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    throw new Error(
      'This PDF contains a page with invalid dimensions.'
    )
  }

  const dimensionScale =
    settings.maxDimension / Math.max(width, height)

  const pixelScale = Math.sqrt(
    settings.maxPixels / (width * height),
  )

  const safeScale = Math.min(
    settings.scale,
    dimensionScale,
    pixelScale,
  )

  if (!Number.isFinite(safeScale) || safeScale <= 0) {
    throw new Error(
      'This PDF page is too large to process on your device.'
    )
  }

  return safeScale
}

function validatePdfFile(file) {
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
    throw new Error('The selected PDF is empty.')
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error(
      'The maximum supported file size is 100 MB.'
    )
  }
}

function validateCompressionSettings(quality, scale) {
  if (
    !Number.isFinite(quality) ||
    quality < 0.1 ||
    quality > 1
  ) {
    throw new Error(
      'Image quality must be between 0.1 and 1.'
    )
  }

  if (
    !Number.isFinite(scale) ||
    scale < 0.5 ||
    scale > 2
  ) {
    throw new Error(
      'Rendering scale must be between 0.5 and 2.'
    )
  }
}

function getCompressedFileName(fileName) {
  const nameWithoutExtension = fileName.replace(/\.pdf$/i, '')

  return `${nameWithoutExtension || 'document'}-compressed.pdf`
}

function getProcessingError(error) {
  if (
    error?.name === 'PasswordException' ||
    error?.name === 'EncryptedPDFException'
  ) {
    return new Error(
      'This PDF is password-protected. Please unlock it first.'
    )
  }

  const message =
    typeof error?.message === 'string'
      ? error.message
      : ''

  if (
    /memory|allocation|out of memory/i.test(message)
  ) {
    return new Error(
      'Your device ran out of memory. Close other tabs and try again, or use a smaller PDF.'
    )
  }

  if (
    /worker|canvas|invalid dimensions|too large to process/i.test(
      message
    )
  ) {
    return error
  }

  return new Error(
    'PDF processing failed. Please try again with another PDF. If the problem continues, the file may be unsupported or too complex for this browser.'
  )
}

export async function compressPdf(
  file,
  {
    quality = 0.6,
    scale = 1.25,
    onProgress,
  } = {},
) {
  validatePdfFile(file)
  validateCompressionSettings(quality, scale)

  let loadingTask

  try {
    const buffer = await file.arrayBuffer()

    loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(buffer),
    })

    const pdf = await loadingTask.promise
    const pageCount = pdf.numPages

    if (!pageCount) {
      throw new Error(
        'This PDF does not contain any pages.'
      )
    }

    const settings = getDeviceSettings(
      pageCount,
      quality,
      scale,
    )

    const outputPdf = await PDFDocument.create()

    for (
      let pageNumber = 1;
      pageNumber <= pageCount;
      pageNumber++
    ) {
      onProgress?.({
        current: pageNumber,
        total: pageCount,
      })

      const page = await pdf.getPage(pageNumber)

      const originalViewport = page.getViewport({
        scale: 1,
      })

      const renderScale = getSafeRenderScale(
        originalViewport,
        settings,
      )

      const renderViewport = page.getViewport({
        scale: renderScale,
      })

      const canvas = document.createElement('canvas')

      const context = canvas.getContext('2d', {
        alpha: false,
      })

      if (!context) {
        throw new Error(
          'Your browser could not create a canvas. Try another browser.'
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

        const embeddedImage = await outputPdf.embedJpg(
          jpegBytes
        )

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
        // Release page canvas memory after each page.
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

    const savedBytes = file.size - blob.size

    onProgress?.({
      current: pageCount,
      total: pageCount,
    })

    return {
      blob,
      originalSize: file.size,
      compressedSize: blob.size,
      savedBytes,
      savedPercentage: (savedBytes / file.size) * 100,
      isSmaller: blob.size < file.size,
      fileName: getCompressedFileName(file.name),
    }
  } catch (error) {
    console.error('PDF compression failed:', error)

    throw getProcessingError(error)
  } finally {
    if (loadingTask) {
      await loadingTask.destroy().catch(() => {})
    }
  }
}

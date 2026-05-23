/**
 * Image compression utility for OCR.space
 * Resizes and compresses images to stay under the 1MB limit
 */

const MAX_FILE_SIZE = 1024 * 1024; // 1MB limit for OCR.space free tier
const MAX_DIMENSION = 1400; // Max longest side in pixels
const INITIAL_QUALITY = 0.85;
const MIN_QUALITY = 0.4;
const QUALITY_STEP = 0.1;

export interface CompressionResult {
  file: File;
  originalSize: number;
  compressedSize: number;
  wasCompressed: boolean;
}

export class CompressionError extends Error {
  type: 'compression_failed' | 'still_too_large';
  
  constructor(type: 'compression_failed' | 'still_too_large', message: string) {
    super(message);
    this.type = type;
    this.name = 'CompressionError';
  }
}

/**
 * Compress an image file to fit within the OCR.space size limit
 */
export async function compressImageForOCR(file: File): Promise<CompressionResult> {
  const originalSize = file.size;
  
  // If already under limit and is JPEG, return as-is
  if (file.size <= MAX_FILE_SIZE && file.type === 'image/jpeg') {
    return {
      file,
      originalSize,
      compressedSize: file.size,
      wasCompressed: false,
    };
  }
  
  // Load image into canvas
  const img = await loadImage(file);
  
  // Calculate new dimensions (maintain aspect ratio)
  const { width, height } = calculateDimensions(img.width, img.height, MAX_DIMENSION);
  
  // Create canvas and draw resized image
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new CompressionError('compression_failed', 'Could not create canvas context');
  }
  
  // Use high-quality image rendering
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, width, height);
  
  // Try progressively lower quality until under size limit
  let quality = INITIAL_QUALITY;
  let blob: Blob | null = null;
  
  while (quality >= MIN_QUALITY) {
    blob = await canvasToBlob(canvas, 'image/jpeg', quality);
    
    if (blob.size <= MAX_FILE_SIZE) {
      break;
    }
    
    quality -= QUALITY_STEP;
  }
  
  if (!blob || blob.size > MAX_FILE_SIZE) {
    throw new CompressionError(
      'still_too_large',
      'This photo is too large for the scanner. Please retake the photo a bit further away or crop it.'
    );
  }
  
  // Create new file from blob
  const compressedFile = new File(
    [blob],
    file.name.replace(/\.[^.]+$/, '.jpg'),
    { type: 'image/jpeg' }
  );
  
  return {
    file: compressedFile,
    originalSize,
    compressedSize: compressedFile.size,
    wasCompressed: true,
  };
}

/**
 * Load an image file into an HTMLImageElement
 */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new CompressionError('compression_failed', 'Could not load image'));
    };
    
    img.src = url;
  });
}

/**
 * Calculate new dimensions maintaining aspect ratio
 */
function calculateDimensions(
  originalWidth: number,
  originalHeight: number,
  maxDimension: number
): { width: number; height: number } {
  const aspectRatio = originalWidth / originalHeight;
  
  let width = originalWidth;
  let height = originalHeight;
  
  // Only resize if larger than max dimension
  if (originalWidth > maxDimension || originalHeight > maxDimension) {
    if (originalWidth > originalHeight) {
      width = maxDimension;
      height = Math.round(maxDimension / aspectRatio);
    } else {
      height = maxDimension;
      width = Math.round(maxDimension * aspectRatio);
    }
  }
  
  return { width, height };
}

/**
 * Convert canvas to blob with specified quality
 */
function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new CompressionError('compression_failed', 'Could not convert canvas to blob'));
        }
      },
      type,
      quality
    );
  });
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

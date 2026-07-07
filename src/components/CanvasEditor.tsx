import React, { useRef, useEffect, useState } from 'react';
import { 
  Undo2, Redo2, Paintbrush, Sliders, Sparkles, Image as ImageIcon, 
  Download, Eye, Brush, Maximize2, Trash2, Check, RefreshCw
} from 'lucide-react';
import { 
  FilterSettings, RetouchSettings, MakeupSettings, 
  BrushMode, BrushConfig, ActiveTab, HistoryState 
} from '../types';

// Preset portrait photos from Unsplash for quick editing
const SAMPLE_PORTRAITS = [
  {
    id: 'female-1',
    name: 'Emma (Warm)',
    url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=600&auto=format&fit=crop',
  },
  {
    id: 'male-1',
    name: 'Marcus (Classic)',
    url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=600&auto=format&fit=crop',
  },
  {
    id: 'female-2',
    name: 'Zoe (Retro)',
    url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?q=80&w=600&auto=format&fit=crop',
  }
];

// Swatches for Lipstick
const LIPSTICK_SWATCHES = [
  { name: 'Velvet Rouge', color: '#b91c1c' },
  { name: 'Nude Coral', color: '#dd6b20' },
  { name: 'Rose Petal', color: '#db2777' },
  { name: 'Berry Plum', color: '#86198f' },
  { name: 'Peach Glaze', color: '#f97316' },
  { name: 'Cherry Red', color: '#dc2626' }
];

// Swatches for Blush
const BLUSH_SWATCHES = [
  { name: 'Baby Pink', color: '#f472b6' },
  { name: 'Peach Glow', color: '#fb923c' },
  { name: 'Soft Rose', color: '#fda4af' },
  { name: 'Warm Apricot', color: '#fdba74' }
];

// Swatches for Eyeshadow
const EYESHADOW_SWATCHES = [
  { name: 'Champagne', color: '#fbcfe8' },
  { name: 'Golden Bronze', color: '#ca8a04' },
  { name: 'Taupe Mist', color: '#a8a29e' },
  { name: 'Soft Violet', color: '#c084fc' },
  { name: 'Mocha', color: '#78716c' }
];

interface CanvasEditorProps {
  filterSettings: FilterSettings;
  setFilterSettings: React.Dispatch<React.SetStateAction<FilterSettings>>;
  retouchSettings: RetouchSettings;
  setRetouchSettings: React.Dispatch<React.SetStateAction<RetouchSettings>>;
  makeupSettings: MakeupSettings;
  setMakeupSettings: React.Dispatch<React.SetStateAction<MakeupSettings>>;
  activeTab: ActiveTab;
  setActiveTab: (tab: ActiveTab) => void;
  onImageLoaded: (dataUrl: string) => void;
  aiAppliedVersion: number;
}

export default function CanvasEditor({
  filterSettings,
  setFilterSettings,
  retouchSettings,
  setRetouchSettings,
  makeupSettings,
  setMakeupSettings,
  activeTab,
  setActiveTab,
  onImageLoaded,
  aiAppliedVersion
}: CanvasEditorProps) {
  
  // Canvas References
  const displayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const hiddenCanvasRef = useRef<HTMLCanvasElement | null>(null); // holds image + retouch layers
  const makeupCanvasRef = useRef<HTMLCanvasElement | null>(null); // holds makeup layers painted manually
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Core States
  const [imageLoaded, setImageLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [imageObj, setImageObj] = useState<HTMLImageElement | null>(null);
  const [isComparing, setIsComparing] = useState(false);

  // History Stack (Undo/Redo)
  const [history, setHistory] = useState<HistoryState[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  // Brush State
  const [brushMode, setBrushMode] = useState<BrushMode>('none');
  const [brushSize, setBrushSize] = useState(30);
  const [brushOpacity, setBrushOpacity] = useState(30);
  const [brushColor, setBrushColor] = useState('#b91c1c');
  const [isDrawing, setIsDrawing] = useState(false);
  const [lastPos, setLastPos] = useState({ x: 0, y: 0 });

  // Panning/Layout Refs for positioning photo within frame
  const isPanningRef = useRef(false);
  const startPanPosRef = useRef({ x: 0, y: 0 });
  const startPhotoXRef = useRef(0);
  const startPhotoYRef = useRef(0);

  // Load sample image on mount
  useEffect(() => {
    loadSampleImage(SAMPLE_PORTRAITS[0].url);
  }, []);

  // Watch for AI Recommendations applied in parent
  useEffect(() => {
    if (imageLoaded) {
      applyFiltersAndRedraw();
    }
  }, [aiAppliedVersion, filterSettings, retouchSettings, makeupSettings]);

  // Load image from URL
  const loadSampleImage = (url: string) => {
    setLoading(true);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = url;
    img.onload = () => {
      setupImageInCanvases(img);
      setLoading(false);
    };
    img.onerror = () => {
      alert("Failed to load sample portrait. Please try uploading your own photo!");
      setLoading(false);
    };
  };

  // Handle local file upload
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        setupImageInCanvases(img);
        onImageLoaded(img.src);
        setLoading(false);
      };
    };
    reader.readAsDataURL(file);
  };

  // Setup Hidden & Display Canvases
  const setupImageInCanvases = (img: HTMLImageElement) => {
    setImageObj(img);
    setImageLoaded(true);

    const hiddenCanvas = hiddenCanvasRef.current;
    const displayCanvas = displayCanvasRef.current;
    const makeupCanvas = makeupCanvasRef.current;

    if (!hiddenCanvas || !displayCanvas || !makeupCanvas) return;

    // We constrain the working resolution to around max 1000px for speedy performance
    const maxDimension = 1000;
    let width = img.naturalWidth || img.width;
    let height = img.naturalHeight || img.height;

    if (width > maxDimension || height > maxDimension) {
      if (width > height) {
        height = Math.round((height * maxDimension) / width);
        width = maxDimension;
      } else {
        width = Math.round((width * maxDimension) / height);
        height = maxDimension;
      }
    }

    // Resize all canvases to match the selected resolution
    hiddenCanvas.width = width;
    hiddenCanvas.height = height;
    displayCanvas.width = width;
    displayCanvas.height = height;
    makeupCanvas.width = width;
    makeupCanvas.height = height;

    // Draw initial image to hidden canvas
    const hctx = hiddenCanvas.getContext('2d');
    if (hctx) {
      hctx.drawImage(img, 0, 0, width, height);
      const initialData = hctx.getImageData(0, 0, width, height);
      
      // Initialize History
      setHistory([{ imageData: initialData, description: 'Original Image' }]);
      setHistoryIndex(0);
    }

    // Clear makeup canvas
    const mctx = makeupCanvas.getContext('2d');
    if (mctx) {
      mctx.clearRect(0, 0, width, height);
    }

    // Trigger parent callback with base64 for AI analysis
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = Math.min(width, 500); // Send smaller base64 to save tokens and time
    tempCanvas.height = Math.round((tempCanvas.width * height) / width);
    const tctx = tempCanvas.getContext('2d');
    if (tctx) {
      tctx.drawImage(img, 0, 0, tempCanvas.width, tempCanvas.height);
      onImageLoaded(tempCanvas.toDataURL('image/jpeg', 0.8));
    }

    // Redraw Display
    setTimeout(() => {
      applyFiltersAndRedraw();
    }, 50);
  };

  // Push new Canvas state to History
  const pushToHistory = (imageData: ImageData, description: string) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push({ imageData, description });
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const prevIndex = historyIndex - 1;
      setHistoryIndex(prevIndex);
      const hiddenCanvas = hiddenCanvasRef.current;
      if (hiddenCanvas) {
        const hctx = hiddenCanvas.getContext('2d');
        if (hctx) {
          hctx.putImageData(history[prevIndex].imageData, 0, 0);
          applyFiltersAndRedraw();
        }
      }
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const nextIndex = historyIndex + 1;
      setHistoryIndex(nextIndex);
      const hiddenCanvas = hiddenCanvasRef.current;
      if (hiddenCanvas) {
        const hctx = hiddenCanvas.getContext('2d');
        if (hctx) {
          hctx.putImageData(history[nextIndex].imageData, 0, 0);
          applyFiltersAndRedraw();
        }
      }
    }
  };

  // Reset current editor state
  const handleReset = () => {
    if (window.confirm("Are you sure you want to discard all your edits?")) {
      const hiddenCanvas = hiddenCanvasRef.current;
      const makeupCanvas = makeupCanvasRef.current;
      if (hiddenCanvas && makeupCanvas && history.length > 0) {
        const hctx = hiddenCanvas.getContext('2d');
        const mctx = makeupCanvas.getContext('2d');
        if (hctx && mctx) {
          hctx.putImageData(history[0].imageData, 0, 0);
          mctx.clearRect(0, 0, makeupCanvas.width, makeupCanvas.height);
          setHistoryIndex(0);
          
          // Reset slider settings
          setFilterSettings({ type: 'none', intensity: 50, grain: 0, lightLeak: 0, vignette: 0, frameType: 'none' });
          setRetouchSettings({ skinSmoothing: 0, skinToneWarmth: 0, eyeBrightening: 0, teethWhitening: 0 });
          setMakeupSettings({ lipstickColor: '#b91c1c', lipstickOpacity: 0, blushColor: '#f472b6', blushOpacity: 0, eyeshadowColor: '#fbcfe8', eyeshadowOpacity: 0 });
          
          applyFiltersAndRedraw();
        }
      }
    }
  };

  // ----------------------------------------------------
  // DRAWING & BRUSH EVENTS (FOR MAKEUP AND RETOUCHING)
  // ----------------------------------------------------
  const getCanvasMousePos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = displayCanvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const displayX = (e.clientX - rect.left) * scaleX;
    const displayY = (e.clientY - rect.top) * scaleY;

    // Apply the inverse transform of photo positioning (zoom & shift offsets)
    const s = (filterSettings.photoScale ?? 100) / 100;
    const tx = ((filterSettings.photoX ?? 0) / 100) * canvas.width;
    const ty = ((filterSettings.photoY ?? 0) / 100) * canvas.height;

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;

    const photoX = cx + (displayX - cx - tx) / s;
    const photoY = cy + (displayY - cy - ty) / s;

    return { x: photoX, y: photoY };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (brushMode === 'none') {
      // Start dragging/panning the photo within the frame
      isPanningRef.current = true;
      startPanPosRef.current = { x: e.clientX, y: e.clientY };
      startPhotoXRef.current = filterSettings.photoX ?? 0;
      startPhotoYRef.current = filterSettings.photoY ?? 0;
      return;
    }
    const pos = getCanvasMousePos(e);
    setIsDrawing(true);
    setLastPos(pos);

    // Apply tap-based actions instantly
    if (brushMode === 'blemish' || brushMode === 'enlarge') {
      applySpotEffect(pos.x, pos.y);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (brushMode === 'none') {
      if (!isPanningRef.current) return;
      const canvas = displayCanvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const dx = e.clientX - startPanPosRef.current.x;
      const dy = e.clientY - startPanPosRef.current.y;
      
      // Scale based on actual displayed bounding rect dimensions
      const deltaPercentX = (dx / rect.width) * 100;
      const deltaPercentY = (dy / rect.height) * 100;

      setFilterSettings(prev => ({
        ...prev,
        photoX: Math.max(-150, Math.min(150, startPhotoXRef.current + deltaPercentX)),
        photoY: Math.max(-150, Math.min(150, startPhotoYRef.current + deltaPercentY))
      }));
      return;
    }

    if (!isDrawing) return;
    const currentPos = getCanvasMousePos(e);

    if (brushMode === 'liquify') {
      applyLiquifyWarp(lastPos, currentPos);
    } else if (['smooth', 'lipstick', 'blush', 'eyeshadow'].includes(brushMode)) {
      drawBrushStroke(lastPos, currentPos);
    }

    setLastPos(currentPos);
  };

  const handleMouseUpOrLeave = () => {
    if (isPanningRef.current) {
      isPanningRef.current = false;
      return;
    }
    if (isDrawing) {
      setIsDrawing(false);
      // Save state to undo history after brushing
      const hiddenCanvas = hiddenCanvasRef.current;
      if (hiddenCanvas) {
        const hctx = hiddenCanvas.getContext('2d');
        if (hctx) {
          const snapshot = hctx.getImageData(0, 0, hiddenCanvas.width, hiddenCanvas.height);
          pushToHistory(snapshot, `Brush stroke: ${brushMode}`);
        }
      }
    }
  };

  // Touch Event Handlers for Responsive Mobile Interaction
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];

    if (brushMode === 'none') {
      isPanningRef.current = true;
      startPanPosRef.current = { x: touch.clientX, y: touch.clientY };
      startPhotoXRef.current = filterSettings.photoX ?? 0;
      startPhotoYRef.current = filterSettings.photoY ?? 0;
      return;
    }

    const canvas = displayCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const displayX = (touch.clientX - rect.left) * scaleX;
    const displayY = (touch.clientY - rect.top) * scaleY;

    const s = (filterSettings.photoScale ?? 100) / 100;
    const tx = ((filterSettings.photoX ?? 0) / 100) * canvas.width;
    const ty = ((filterSettings.photoY ?? 0) / 100) * canvas.height;

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;

    const photoX = cx + (displayX - cx - tx) / s;
    const photoY = cy + (displayY - cy - ty) / s;

    setIsDrawing(true);
    setLastPos({ x: photoX, y: photoY });

    if (brushMode === 'blemish' || brushMode === 'enlarge') {
      applySpotEffect(photoX, photoY);
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];

    if (brushMode === 'none') {
      if (!isPanningRef.current) return;
      const canvas = displayCanvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const dx = touch.clientX - startPanPosRef.current.x;
      const dy = touch.clientY - startPanPosRef.current.y;
      
      const deltaPercentX = (dx / rect.width) * 100;
      const deltaPercentY = (dy / rect.height) * 100;

      setFilterSettings(prev => ({
        ...prev,
        photoX: Math.max(-150, Math.min(150, startPhotoXRef.current + deltaPercentX)),
        photoY: Math.max(-150, Math.min(150, startPhotoYRef.current + deltaPercentY))
      }));
      return;
    }

    if (!isDrawing) return;

    const canvas = displayCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const displayX = (touch.clientX - rect.left) * scaleX;
    const displayY = (touch.clientY - rect.top) * scaleY;

    const s = (filterSettings.photoScale ?? 100) / 100;
    const tx = ((filterSettings.photoX ?? 0) / 100) * canvas.width;
    const ty = ((filterSettings.photoY ?? 0) / 100) * canvas.height;

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;

    const photoX = cx + (displayX - cx - tx) / s;
    const photoY = cy + (displayY - cy - ty) / s;

    const currentPos = { x: photoX, y: photoY };

    if (brushMode === 'liquify') {
      applyLiquifyWarp(lastPos, currentPos);
    } else if (['smooth', 'lipstick', 'blush', 'eyeshadow'].includes(brushMode)) {
      drawBrushStroke(lastPos, currentPos);
    }

    setLastPos(currentPos);
  };

  // Apply Tap-based spots: Blemish remover (clone-blur blend) or Eye enlarger (expand)
  const applySpotEffect = (cx: number, cy: number) => {
    const hiddenCanvas = hiddenCanvasRef.current;
    if (!hiddenCanvas) return;
    const ctx = hiddenCanvas.getContext('2d');
    if (!ctx) return;

    const width = hiddenCanvas.width;
    const height = hiddenCanvas.height;
    const R = brushSize;

    if (brushMode === 'blemish') {
      // 1. BLEMISH REMOVER (Healing / Soft Blend)
      // We grab pixels from a bounding box, apply a high blur/median blend, and soft-feather stamp it back.
      const minX = Math.max(0, Math.round(cx - R));
      const minY = Math.max(0, Math.round(cy - R));
      const boxSize = R * 2;
      const actualW = Math.min(width - minX, boxSize);
      const actualH = Math.min(height - minY, boxSize);

      if (actualW <= 0 || actualH <= 0) return;

      const imgData = ctx.getImageData(minX, minY, actualW, actualH);
      const data = imgData.data;

      // Simple fast blur on patch: replace center with average of border colors (healing)
      // Gather average colors from borders of the brush area
      let rSum = 0, gSum = 0, bSum = 0, count = 0;
      for (let y = 0; y < actualH; y++) {
        for (let x = 0; x < actualW; x++) {
          const dist = Math.sqrt((x - R) ** 2 + (y - R) ** 2);
          // If we are at the outer ring of the brush area, sample it
          if (dist >= R - 3 && dist <= R) {
            const idx = (y * actualW + x) * 4;
            rSum += data[idx];
            gSum += data[idx + 1];
            bSum += data[idx + 2];
            count++;
          }
        }
      }

      if (count > 0) {
        const rAvg = rSum / count;
        const gAvg = gSum / count;
        const bAvg = bSum / count;

        // Stamp back with soft radial opacity falloff
        for (let y = 0; y < actualH; y++) {
          for (let x = 0; x < actualW; x++) {
            const dist = Math.sqrt((x - R) ** 2 + (y - R) ** 2);
            if (dist < R) {
              const idx = (y * actualW + x) * 4;
              const weight = (1 - dist / R); // center has weight 1, edge 0
              // Blend existing color with healed average
              data[idx] = data[idx] * (1 - weight) + rAvg * weight;
              data[idx + 1] = data[idx + 1] * (1 - weight) + gAvg * weight;
              data[idx + 2] = data[idx + 2] * (1 - weight) + bAvg * weight;
            }
          }
        }
        ctx.putImageData(imgData, minX, minY);
      }
    } 
    else if (brushMode === 'enlarge') {
      // 2. EYE ENLARGER / FEATURE EXPANDER (Pinch outward)
      const minX = Math.max(0, Math.round(cx - R));
      const minY = Math.max(0, Math.round(cy - R));
      const size = R * 2;
      const actualW = Math.min(width - minX, size);
      const actualH = Math.min(height - minY, size);

      if (actualW <= 0 || actualH <= 0) return;

      const srcData = ctx.getImageData(minX, minY, actualW, actualH);
      const destData = ctx.createImageData(actualW, actualH);
      
      const sArr = srcData.data;
      const dArr = destData.data;

      const localCx = cx - minX;
      const localCy = cy - minY;

      const intensity = 0.35; // Enlarging factor

      for (let y = 0; y < actualH; y++) {
        for (let x = 0; x < actualW; x++) {
          const dx = x - localCx;
          const dy = y - localCy;
          const dist = Math.sqrt(dx * dx + dy * dy);

          const destIdx = (y * actualW + x) * 4;

          if (dist < R) {
            // Squeeze/Pinch outward warp formula:
            // Normalize distance
            const normDist = dist / R;
            // Map normDist to pull from closer to center
            const warpFactor = normDist * (1.0 - intensity * (1.0 - normDist));
            
            // Source coordinates (relative to click center)
            const srcX = localCx + dx * (warpFactor / (normDist || 1));
            const srcY = localCy + dy * (warpFactor / (normDist || 1));

            // Bilinear Interpolation
            const xFloor = Math.max(0, Math.min(actualW - 2, Math.floor(srcX)));
            const yFloor = Math.max(0, Math.min(actualH - 2, Math.floor(srcY)));
            const xCeil = xFloor + 1;
            const yCeil = yFloor + 1;

            const wx = srcX - xFloor;
            const wy = srcY - yFloor;

            for (let c = 0; c < 4; c++) {
              const idx00 = (yFloor * actualW + xFloor) * 4 + c;
              const idx10 = (yFloor * actualW + xCeil) * 4 + c;
              const idx01 = (yCeil * actualW + xFloor) * 4 + c;
              const idx11 = (yCeil * actualW + xCeil) * 4 + c;

              const val = 
                sArr[idx00] * (1 - wx) * (1 - wy) +
                sArr[idx10] * wx * (1 - wy) +
                sArr[idx01] * (1 - wx) * wy +
                sArr[idx11] * wx * wy;

              dArr[destIdx + c] = val;
            }
          } else {
            // Keep original pixel untouched
            const idx = (y * actualW + x) * 4;
            dArr[destIdx] = sArr[idx];
            dArr[destIdx + 1] = sArr[idx + 1];
            dArr[destIdx + 2] = sArr[idx + 2];
            dArr[destIdx + 3] = sArr[idx + 3];
          }
        }
      }

      ctx.putImageData(destData, minX, minY);
    }

    applyFiltersAndRedraw();
  };

  // Liquify (Manual slimming/push tool) using a continuous drag warp
  const applyLiquifyWarp = (start: { x: number, y: number }, end: { x: number, y: number }) => {
    const hiddenCanvas = hiddenCanvasRef.current;
    if (!hiddenCanvas) return;
    const ctx = hiddenCanvas.getContext('2d');
    if (!ctx) return;

    const width = hiddenCanvas.width;
    const height = hiddenCanvas.height;
    const R = brushSize;

    // Movement vector
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const dragDistance = Math.sqrt(dx * dx + dy * dy);

    if (dragDistance < 1) return;

    // Get bounding box around the brush drag center
    const minX = Math.max(0, Math.round(start.x - R));
    const minY = Math.max(0, Math.round(start.y - R));
    const size = R * 2;
    const actualW = Math.min(width - minX, size);
    const actualH = Math.min(height - minY, size);

    if (actualW <= 0 || actualH <= 0) return;

    const srcData = ctx.getImageData(minX, minY, actualW, actualH);
    const destData = ctx.createImageData(actualW, actualH);

    const sArr = srcData.data;
    const dArr = destData.data;

    const localCx = start.x - minX;
    const localCy = start.y - minY;

    for (let y = 0; y < actualH; y++) {
      for (let x = 0; x < actualW; x++) {
        const px = x - localCx;
        const py = y - localCy;
        const dist = Math.sqrt(px * px + py * py);

        const destIdx = (y * actualW + x) * 4;

        if (dist < R) {
          // Deformation math: pixels near the center are pushed heavily, dropping off to zero at radius edges
          const weight = Math.pow(1.0 - dist / R, 2); // beautiful smooth power-2 falloff

          const srcX = x - dx * weight;
          const srcY = y - dy * weight;

          // Bilinear Interpolation
          const xFloor = Math.max(0, Math.min(actualW - 2, Math.floor(srcX)));
          const yFloor = Math.max(0, Math.min(actualH - 2, Math.floor(srcY)));
          const xCeil = xFloor + 1;
          const yCeil = yFloor + 1;

          const wx = srcX - xFloor;
          const wy = srcY - yFloor;

          for (let c = 0; c < 4; c++) {
            const idx00 = (yFloor * actualW + xFloor) * 4 + c;
            const idx10 = (yFloor * actualW + xCeil) * 4 + c;
            const idx01 = (yCeil * actualW + xFloor) * 4 + c;
            const idx11 = (yCeil * actualW + xCeil) * 4 + c;

            const val = 
              sArr[idx00] * (1 - wx) * (1 - wy) +
              sArr[idx10] * wx * (1 - wy) +
              sArr[idx01] * (1 - wx) * wy +
              sArr[idx11] * wx * wy;

            dArr[destIdx + c] = val;
          }
        } else {
          // Outside brush radius
          const idx = (y * actualW + x) * 4;
          dArr[destIdx] = sArr[idx];
          dArr[destIdx + 1] = sArr[idx + 1];
          dArr[destIdx + 2] = sArr[idx + 2];
          dArr[destIdx + 3] = sArr[idx + 3];
        }
      }
    }

    ctx.putImageData(destData, minX, minY);
    applyFiltersAndRedraw();
  };

  // Draw smooth lines for Makeup and Skin Smoothing brushes
  const drawBrushStroke = (start: { x: number, y: number }, end: { x: number, y: number }) => {
    let canvas: HTMLCanvasElement | null = null;
    let isMakeup = false;

    if (brushMode === 'smooth') {
      canvas = hiddenCanvasRef.current;
    } else {
      canvas = makeupCanvasRef.current;
      isMakeup = true;
    }

    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();

    // Makeup-specific setup to make drawing look organic
    if (isMakeup) {
      ctx.strokeStyle = brushColor;
      ctx.fillStyle = brushColor;
      // We set soft blending modes on the makeup canvas itself
      ctx.globalAlpha = brushOpacity / 100;
    } else {
      // Skin smoothing brush
      // We draw soft blurred strokes of surrounding skin color
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.globalAlpha = 0.2;
    }

    // Creating beautiful feathered strokes using shadow/radial blurs
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Simulated soft brush via shadow blur
    ctx.shadowBlur = brushSize / 2;
    ctx.shadowColor = isMakeup ? brushColor : 'rgba(255,255,255,0.2)';

    // Special behavior for skin smoothing brush:
    // It smooths/softens by stamping local blurred pixels onto hiddenCanvas
    if (brushMode === 'smooth') {
      // Soft focus bilateral approximation:
      // Draw path with destination-out or blending
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();

      // Quick pixel soft-focus blend under stroke
      applyFastLocalSmoothing(end.x, end.y, brushSize);
    } else {
      // Standard drawing for Makeup Overlay Layer
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();
    }

    ctx.restore();
    applyFiltersAndRedraw();
  };

  // Localized selective blurring for skin smoothing brush
  const applyFastLocalSmoothing = (cx: number, cy: number, R: number) => {
    const hiddenCanvas = hiddenCanvasRef.current;
    if (!hiddenCanvas) return;
    const ctx = hiddenCanvas.getContext('2d');
    if (!ctx) return;

    const width = hiddenCanvas.width;
    const height = hiddenCanvas.height;

    const minX = Math.max(0, Math.round(cx - R));
    const minY = Math.max(0, Math.round(cy - R));
    const size = R * 2;
    const actualW = Math.min(width - minX, size);
    const actualH = Math.min(height - minY, size);

    if (actualW <= 0 || actualH <= 0) return;

    const imgData = ctx.getImageData(minX, minY, actualW, actualH);
    const sArr = imgData.data;

    // Simple 3x3 Box blur approximation on low-contrast regions to preserve high-contrast facial edges
    const tempArr = new Uint8ClampedArray(sArr);

    for (let y = 1; y < actualH - 1; y++) {
      for (let x = 1; x < actualW - 1; x++) {
        const localDist = Math.sqrt((x - R) ** 2 + (y - R) ** 2);
        if (localDist >= R) continue;

        const idx = (y * actualW + x) * 4;

        // Bilateral filter approximation:
        // Only blur if color difference between center and surrounding pixels is low (preserving borders/edges like eyebrows/eyes)
        let rSum = 0, gSum = 0, bSum = 0, count = 0;
        const centerR = tempArr[idx];
        const centerG = tempArr[idx + 1];
        const centerB = tempArr[idx + 2];

        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const kIdx = ((y + ky) * actualW + (x + kx)) * 4;
            const kR = tempArr[kIdx];
            const kG = tempArr[kIdx + 1];
            const kB = tempArr[kIdx + 2];

            const colorDiff = Math.sqrt((kR - centerR) ** 2 + (kG - centerG) ** 2 + (kB - centerB) ** 2);

            // Edge threshold: only smooth similar/adjacent skin tones
            if (colorDiff < 25) {
              rSum += kR;
              gSum += kG;
              bSum += kB;
              count++;
            }
          }
        }

        if (count > 0) {
          // Staggered blend to keep some natural skin pores
          const brushWeight = 0.25 * (1.0 - localDist / R);
          sArr[idx] = Math.round(sArr[idx] * (1 - brushWeight) + (rSum / count) * brushWeight);
          sArr[idx + 1] = Math.round(sArr[idx + 1] * (1 - brushWeight) + (gSum / count) * brushWeight);
          sArr[idx + 2] = Math.round(sArr[idx + 2] * (1 - brushWeight) + (bSum / count) * brushWeight);
        }
      }
    }

    ctx.putImageData(imgData, minX, minY);
  };

  // ----------------------------------------------------
  // FILTER PROCESSING ENGINE (MAIN RENDER LOOP)
  // ----------------------------------------------------
  const applyFiltersAndRedraw = () => {
    const hiddenCanvas = hiddenCanvasRef.current;
    const displayCanvas = displayCanvasRef.current;
    const makeupCanvas = makeupCanvasRef.current;

    if (!hiddenCanvas || !displayCanvas || !makeupCanvas) return;

    const hctx = hiddenCanvas.getContext('2d');
    const dctx = displayCanvas.getContext('2d');
    const mctx = makeupCanvas.getContext('2d');

    if (!hctx || !dctx || !mctx) return;

    const width = hiddenCanvas.width;
    const height = hiddenCanvas.height;

    // Create a temporary canvas for fully-isolated filter processing at native resolution
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext('2d');
    if (!tempCtx) return;

    // Draw baseline photo state with manual edits onto the temp processing canvas
    tempCtx.drawImage(hiddenCanvas, 0, 0);

    // Global Beautify Slider Modifiers (Skin Smooth & Teeth Whitening)
    if (retouchSettings.skinSmoothing > 0 || retouchSettings.skinToneWarmth !== 0 || retouchSettings.eyeBrightening > 0) {
      applyGlobalRetouching(tempCtx, width, height);
    }

    // Composite Makeup Paint Overlay Layers on the temp canvas
    tempCtx.save();
    tempCtx.globalCompositeOperation = 'soft-light';
    tempCtx.drawImage(makeupCanvas, 0, 0);
    tempCtx.restore();

    // Color Filters: 35mm Vintage Film Emulation
    if (filterSettings.type !== 'none') {
      apply35mmFilmPreset(tempCtx, width, height);
    }

    // Film Overlays: Vignette, Light Leaks, and Grain
    if (filterSettings.vignette > 0) {
      applyVignetteOverlay(tempCtx, width, height);
    }

    if (filterSettings.lightLeak > 0) {
      applyLightLeakOverlay(tempCtx, width, height);
    }

    if (filterSettings.grain > 0) {
      applyGrainOverlay(tempCtx, width, height);
    }

    // Reset and clear the main display canvas
    dctx.clearRect(0, 0, width, height);
    dctx.fillStyle = '#0a0a0a'; // modern neutral matte canvas background
    dctx.fillRect(0, 0, width, height);

    // Draw the processed photo onto the display canvas with user scaling and position offsets
    const s = (filterSettings.photoScale ?? 100) / 100;
    const tx = ((filterSettings.photoX ?? 0) / 100) * width;
    const ty = ((filterSettings.photoY ?? 0) / 100) * height;

    const cx = width / 2;
    const cy = height / 2;

    dctx.save();
    dctx.translate(cx + tx, cy + ty);
    dctx.scale(s, s);
    dctx.drawImage(tempCanvas, -cx, -cy, width, height);
    dctx.restore();

    // Vintage Photo Frames (drawn as overlay on top of the panned/scaled photo)
    if (filterSettings.frameType && filterSettings.frameType !== 'none') {
      applyPhotoFrame(dctx, width, height);
    }
  };

  // Global Pixel Manipulation for Retouching Sliders
  const applyGlobalRetouching = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;

    const smoothing = retouchSettings.skinSmoothing / 100;
    const warmth = retouchSettings.skinToneWarmth; // -50 to 50
    const brightening = retouchSettings.eyeBrightening / 100;

    for (let i = 0; i < data.length; i += 4) {
      let r = data[i];
      let g = data[i+1];
      let b = data[i+2];

      // 1. Skin Tone Warmth / Golden-hour glow mapping
      if (warmth !== 0) {
        if (warmth > 0) {
          // Warm golden hour mapping
          r += warmth * 0.45;
          g += warmth * 0.15;
          b -= warmth * 0.15;
        } else {
          // Cool moody film mapping
          r += warmth * 0.15;
          g += warmth * 0.15;
          b -= warmth * 0.45;
        }
      }

      // 2. Dynamic Eye Brightening / Soft highlight boost
      if (brightening > 0) {
        // Boost midtones and highlights (brightening whites)
        const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
        if (luminance > 110) { // white area target
          const boost = (brightening * (luminance / 255) * 35);
          r += boost;
          g += boost;
          b += boost;
        }
      }

      data[i] = Math.max(0, Math.min(255, r));
      data[i+1] = Math.max(0, Math.min(255, g));
      data[i+2] = Math.max(0, Math.min(255, b));
    }

    ctx.putImageData(imgData, 0, 0);

    // 3. Fast Skin Soft-Focus Smoothing Blend
    if (smoothing > 0) {
      // To simulate high-end skin smoothing:
      // We overlay a highly blurred version of the current canvas back with low opacity
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = width;
      tempCanvas.height = height;
      const tctx = tempCanvas.getContext('2d');
      if (tctx) {
        // Draw display canvas onto temp, blur it using canvas filter
        tctx.save();
        tctx.filter = `blur(${Math.round(4 + smoothing * 6)}px)`;
        tctx.drawImage(ctx.canvas, 0, 0);
        tctx.restore();

        // Blend blurred canvas back with opacity matching the slider
        ctx.save();
        ctx.globalAlpha = smoothing * 0.45; // Maximum 45% blend to keep textures natural
        ctx.globalCompositeOperation = 'source-over';
        ctx.drawImage(tempCanvas, 0, 0);
        ctx.restore();
      }
    }
  };

  // Film Emulation Shaders
  const apply35mmFilmPreset = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;

    const preset = filterSettings.type;
    const intensity = filterSettings.intensity / 100;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i+1];
      const b = data[i+2];

      let nr = r;
      let ng = g;
      let nb = b;

      switch (preset) {
        case 'portra':
          // Portra 400: Flattering warm skin tones, soft contrast, pastel greens
          nr = r * 1.1 + 5;
          ng = g * 0.98 + 3;
          nb = b * 0.90 + 2;
          // Apply soft contrast curve
          nr = nr > 128 ? nr * 0.95 + 10 : nr * 1.05;
          break;

        case 'kodachrome':
          // Kodachrome 64: High contrast, vivid reds, warm golden highlights
          nr = r * 1.15 - 5;
          ng = g * 1.02 - 10;
          nb = b * 0.88 - 15;
          // Boost contrast
          nr = (nr - 128) * 1.15 + 128;
          ng = (ng - 128) * 1.10 + 128;
          nb = (nb - 128) * 1.05 + 128;
          break;

        case 'superia':
          // Fujicolor Superia 400: Cool green tones, gorgeous organic undertones
          nr = r * 0.95;
          ng = g * 1.08 + 5;
          nb = b * 1.05 + 8;
          // Soft shadows
          if (nr < 80) nr = nr * 1.1;
          break;

        case 'cinestill':
          // Cinestill 800T: Tungsten cool, cinematic deep blues, soft highlight glows
          nr = r * 0.88 - 8;
          ng = g * 1.02;
          nb = b * 1.2 + 15;
          // Lift shadows slightly
          if (nr < 40) nr += 12;
          if (ng < 40) ng += 10;
          break;

        case 'ilford':
          // Ilford HP5: Fine monochromatic silver tones, punchy contrast
          const gray = 0.299 * r + 0.587 * g + 0.114 * b;
          nr = gray * 1.05;
          ng = gray;
          nb = gray * 0.95; // Slight silver-warm grey
          // High contrast
          nr = (nr - 128) * 1.25 + 128;
          ng = (ng - 128) * 1.25 + 128;
          nb = (nb - 128) * 1.25 + 128;
          break;

        case 'ektar':
          // Ektar 100: Rich ultra-saturated landscape/nature colors
          nr = r * 1.25;
          ng = g * 1.12;
          nb = b * 1.05;
          // Saturation boost
          const maxVal = Math.max(nr, ng, nb);
          nr = nr + (maxVal - nr) * 0.15;
          ng = ng + (maxVal - ng) * 0.15;
          break;

        default:
          break;
      }

      // Blend based on intensity slider
      data[i] = Math.max(0, Math.min(255, r * (1 - intensity) + nr * intensity));
      data[i+1] = Math.max(0, Math.min(255, g * (1 - intensity) + ng * intensity));
      data[i+2] = Math.max(0, Math.min(255, b * (1 - intensity) + nb * intensity));
    }

    ctx.putImageData(imgData, 0, 0);
  };

  // Film grain overlay
  const applyGrainOverlay = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const grainAmount = filterSettings.grain / 100;
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;

    // Fast organic grain simulation: add random light/dark noise to each pixel
    for (let i = 0; i < data.length; i += 4) {
      // Skip transparent pixels
      if (data[i+3] === 0) continue;

      const noise = (Math.random() - 0.5) * grainAmount * 65;
      data[i] = Math.max(0, Math.min(255, data[i] + noise));
      data[i+1] = Math.max(0, Math.min(255, data[i+1] + noise));
      data[i+2] = Math.max(0, Math.min(255, data[i+2] + noise));
    }

    ctx.putImageData(imgData, 0, 0);
  };

  // Vignette (Darken corners)
  const applyVignetteOverlay = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const intensity = filterSettings.vignette / 100;
    if (intensity <= 0) return;

    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    
    // Create soft radial vignette gradient
    const cx = width / 2;
    const cy = height / 2;
    const outerRadius = Math.sqrt(cx * cx + cy * cy);
    // Fixed innerRadius calculation to always be positive and less than outerRadius
    const innerRadius = outerRadius * (0.95 - intensity * 0.70);

    const grad = ctx.createRadialGradient(cx, cy, innerRadius, cx, cy, outerRadius);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    
    // Scale vignette darkening factor with slider intensity to avoid pitch black corners
    const darken = 1.0 - intensity * 0.82; // ranges from 1.0 down to 0.18
    const r = Math.round(255 * darken);
    const g = Math.round(255 * darken * 0.96);
    const b = Math.round(255 * darken * 0.92);
    grad.addColorStop(1, `rgba(${r}, ${g}, ${b}, 1)`);

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  };

  // Vintage Photo Frames Drawer
  const applyPhotoFrame = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const frame = filterSettings.frameType;
    if (!frame || frame === 'none') return;

    ctx.save();

    if (frame === 'polaroid') {
      const bl = Math.round(width * 0.07);
      const br = Math.round(width * 0.07);
      const bt = Math.round(height * 0.07);
      const bb = Math.round(height * 0.20);

      // Solid polaroid warm off-white board
      ctx.fillStyle = '#fcfaf5';
      ctx.fillRect(0, 0, bl, height);
      ctx.fillRect(width - br, 0, br, height);
      ctx.fillRect(0, 0, width, bt);
      ctx.fillRect(0, height - bb, width, bb);

      // Soft thin grey bevel around opening
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.12)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(bl - 0.5, bt - 0.5, width - bl - br + 1, height - bt - bb + 1);

      // Subtle drop shadow keyline on outer frame
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.08)';
      ctx.lineWidth = 1;
      ctx.strokeRect(0, 0, width, height);

      // Cute handwritten date
      ctx.fillStyle = '#5a554c';
      ctx.font = 'italic 13px "Outfit", cursive, sans-serif';
      ctx.textAlign = 'center';
      const dateStr = new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      ctx.fillText(dateStr, width / 2, height - (bb / 2.5));
    } 
    else if (frame === 'sprocket') {
      const bh = Math.round(height * 0.15);
      
      // Black film strip borders
      ctx.fillStyle = '#0b0b0b';
      ctx.fillRect(0, 0, width, bh);
      ctx.fillRect(0, height - bh, width, bh);

      // Sprocket holes
      const hw = Math.round(width * 0.025) || 12;
      const hh = Math.round(bh * 0.32) || 18;
      const step = Math.round(width * 0.07) || 36;
      const r = 3; // radius

      const drawSprocketHole = (x: number, y: number) => {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + hw - r, y);
        ctx.quadraticCurveTo(x + hw, y, x + hw, y + r);
        ctx.lineTo(x + hw, y + hh - r);
        ctx.quadraticCurveTo(x + hw, y + hh, x + hw - r, y + hh);
        ctx.lineTo(x + r, y + hh);
        ctx.quadraticCurveTo(x, y + hh, x, y + hh - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
        ctx.fillStyle = '#020202';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
        ctx.lineWidth = 1;
        ctx.stroke();
      };

      const startOffset = Math.round((width % step) / 2) + Math.round(step / 2);
      for (let x = startOffset; x < width - hw; x += step) {
        // Top sprockets
        drawSprocketHole(x, Math.round(bh * 0.22));
        // Bottom sprockets
        drawSprocketHole(x, height - bh + Math.round(bh * 0.45));
      }

      // Faded film labels / numbers in warm amber-gold
      ctx.fillStyle = 'rgba(217, 119, 6, 0.85)';
      ctx.font = '9px monospace';
      
      // Top row text
      ctx.textAlign = 'left';
      ctx.fillText('KODAK PORTRA 400', width * 0.12, bh * 0.85);
      ctx.textAlign = 'center';
      ctx.fillText('18', width * 0.5, bh * 0.85);
      ctx.textAlign = 'right';
      ctx.fillText('◀ 18A', width * 0.88, bh * 0.85);

      // Bottom row text
      ctx.textAlign = 'left';
      ctx.fillText('SAFETY FILM', width * 0.12, height - (bh * 0.15));
      ctx.textAlign = 'center';
      ctx.fillText('19', width * 0.5, height - (bh * 0.15));
      ctx.textAlign = 'right';
      ctx.fillText('▶ 19A', width * 0.88, height - (bh * 0.15));
    } 
    else if (frame === 'slide') {
      const bw = Math.round(width * 0.10);
      const bh = Math.round(height * 0.10);

      // Temporary off-screen overlay with composite erase
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = width;
      tempCanvas.height = height;
      const tctx = tempCanvas.getContext('2d');
      if (tctx) {
        // Draw cardboard mount cream background
        tctx.fillStyle = '#f1ebe0';
        tctx.fillRect(0, 0, width, height);

        // Erase the center with beautifully rounded corners
        tctx.globalCompositeOperation = 'destination-out';
        
        const rx = bw;
        const ry = bh;
        const rw = width - 2 * bw;
        const rh = height - 2 * bh;
        const cr = 14; // corner radius

        tctx.beginPath();
        tctx.moveTo(rx + cr, ry);
        tctx.lineTo(rx + rw - cr, ry);
        tctx.quadraticCurveTo(rx + rw, ry, rx + rw, ry + cr);
        tctx.lineTo(rx + rw, ry + rh - cr);
        tctx.quadraticCurveTo(rx + rw, ry + rh, rx + rw - cr, ry + rh);
        tctx.lineTo(rx + cr, ry + rh);
        tctx.quadraticCurveTo(rx, ry + rh, rx, ry + rh - cr);
        tctx.lineTo(rx, ry + cr);
        tctx.quadraticCurveTo(rx, ry, rx + cr, ry);
        tctx.closePath();
        tctx.fillStyle = 'black';
        tctx.fill();

        // Draw tempCanvas back onto our primary context
        ctx.drawImage(tempCanvas, 0, 0);

        // Vintage slide cardboard stamps on top of frame
        ctx.fillStyle = 'rgba(194, 65, 12, 0.7)'; // faded red-orange ink
        ctx.font = 'bold 10px "Outfit", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('KODACHROME SLIDE', width / 2, bh * 0.55);

        ctx.fillStyle = 'rgba(30, 58, 138, 0.6)'; // faded blue ink
        ctx.fillText('PROCESS K-12', width * 0.25, height - bh * 0.45);
        
        ctx.fillStyle = 'rgba(40, 40, 40, 0.5)'; // grey date stamp
        ctx.fillText('MAY 1978', width * 0.75, height - bh * 0.45);

        // Soft inner shadow around slide cutout
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.15)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(rx + cr, ry);
        ctx.lineTo(rx + rw - cr, ry);
        ctx.quadraticCurveTo(rx + rw, ry, rx + rw, ry + cr);
        ctx.lineTo(rx + rw, ry + rh - cr);
        ctx.quadraticCurveTo(rx + rw, ry + rh, rx + rw - cr, ry + rh);
        ctx.lineTo(rx + cr, ry + rh);
        ctx.quadraticCurveTo(rx, ry + rh, rx, ry + rh - cr);
        ctx.lineTo(rx, ry + cr);
        ctx.quadraticCurveTo(rx, ry, rx + cr, ry);
        ctx.stroke();
      }
    } 
    else if (frame === 'white') {
      const b = Math.round(Math.min(width, height) * 0.05);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, b, height);
      ctx.fillRect(width - b, 0, b, height);
      ctx.fillRect(0, 0, width, b);
      ctx.fillRect(0, height - b, width, b);

      // Subtle shadow line
      ctx.strokeStyle = 'rgba(0,0,0,0.06)';
      ctx.lineWidth = 1;
      ctx.strokeRect(b - 0.5, b - 0.5, width - 2 * b + 1, height - 2 * b + 1);
    } 
    else if (frame === 'black') {
      const b = Math.round(Math.min(width, height) * 0.05);
      ctx.fillStyle = '#0c0c0c';
      ctx.fillRect(0, 0, b, height);
      ctx.fillRect(width - b, 0, b, height);
      ctx.fillRect(0, 0, width, b);
      ctx.fillRect(0, height - b, width, b);

      // Crisp contrast keyline on inside edge of black frame
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1;
      ctx.strokeRect(b - 0.5, b - 0.5, width - 2 * b + 1, height - 2 * b + 1);
    }

    ctx.restore();
  };

  // Retro Light Leak Overlays
  const applyLightLeakOverlay = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const intensity = filterSettings.lightLeak / 100;

    ctx.save();
    // Use screen or color-dodge blend for realistic luminous light leak
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = intensity * 0.75;

    // Diagonal fiery orange-red wash gradient
    const grad = ctx.createLinearGradient(0, 0, width * 0.4, height * 0.8);
    grad.addColorStop(0, 'rgba(255, 80, 0, 0.95)');
    grad.addColorStop(0.3, 'rgba(239, 68, 68, 0.6)');
    grad.addColorStop(0.7, 'rgba(245, 158, 11, 0.25)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  };

  // Download / Export current edited canvas
  const handleDownload = () => {
    const canvas = displayCanvasRef.current;
    if (!canvas) return;

    setLoading(true);
    setTimeout(() => {
      try {
        const link = document.createElement('a');
        link.download = `35mm_film_retouch_${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      } catch (err) {
        alert("Could not export image due to cross-origin limitations. Try uploading a local photo!");
      } finally {
        setLoading(false);
      }
    }, 100);
  };

  // Compare holding logic
  const handleCompareStart = () => {
    setIsComparing(true);
    const displayCanvas = displayCanvasRef.current;
    if (displayCanvas && history.length > 0) {
      const dctx = displayCanvas.getContext('2d');
      if (dctx) {
        // Temporarily render original raw image state
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = displayCanvas.width;
        tempCanvas.height = displayCanvas.height;
        const tctx = tempCanvas.getContext('2d');
        if (tctx && imageObj) {
          tctx.drawImage(imageObj, 0, 0, tempCanvas.width, tempCanvas.height);
          dctx.drawImage(tempCanvas, 0, 0);
        }
      }
    }
  };

  const handleCompareEnd = () => {
    setIsComparing(false);
    applyFiltersAndRedraw();
  };

  return (
    <div id="editor-container" className="flex-1 flex flex-col min-h-0 bg-neutral-950">
      
      {/* Top action bar: Undo/Redo & comparison */}
      <div id="editor-top-bar" className="h-12 px-4 flex justify-between items-center bg-neutral-900 border-b border-neutral-800 z-10">
        <div id="undo-redo-controls" className="flex items-center gap-4">
          <button 
            id="undo-btn"
            onClick={handleUndo} 
            disabled={historyIndex <= 0}
            className="p-1.5 rounded-full text-neutral-400 hover:text-white disabled:opacity-35 transition-colors"
            title="Undo"
          >
            <Undo2 className="w-5 h-5" />
          </button>
          <button 
            id="redo-btn"
            onClick={handleRedo} 
            disabled={historyIndex >= history.length - 1}
            className="p-1.5 rounded-full text-neutral-400 hover:text-white disabled:opacity-35 transition-colors"
            title="Redo"
          >
            <Redo2 className="w-5 h-5" />
          </button>
        </div>

        <div id="editor-title" className="text-sm font-semibold tracking-wide text-neutral-200">
          {activeTab === 'filters' && '35mm Film Presets'}
          {activeTab === 'smoothing' && 'Facial Retouching'}
          {activeTab === 'makeup' && 'Creative Makeup'}
          {activeTab === 'reshape' && 'Meitu Face Sculpt'}
          {activeTab === 'ai' && 'AI Smart Retouch'}
        </div>

        <div id="top-action-controls" className="flex items-center gap-3">
          {imageLoaded && (
            <button
              id="compare-btn"
              onMouseDown={handleCompareStart}
              onMouseUp={handleCompareEnd}
              onTouchStart={handleCompareStart}
              onTouchEnd={handleCompareEnd}
              className={`px-3 py-1 text-xs rounded-full border border-neutral-700 font-medium transition-all ${isComparing ? 'bg-amber-500 border-amber-400 text-black shadow-lg scale-95' : 'bg-neutral-800 text-neutral-300 hover:bg-neutral-700'}`}
            >
              Compare
            </button>
          )}
          <button
            id="reset-btn"
            onClick={handleReset}
            className="p-1.5 rounded-full text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 transition-colors"
            title="Reset All Edits"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Editor Main Canvas Stage */}
      <div id="editor-stage" className="flex-1 relative flex items-center justify-center p-4 bg-neutral-950 overflow-hidden select-none min-h-0">
        
        {/* Working Canvases (Hidden and Makeup are off-screen/overlay) */}
        <canvas ref={hiddenCanvasRef} className="hidden" />
        <canvas ref={makeupCanvasRef} className="hidden" />

        {loading && (
          <div id="canvas-loader" className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm z-30">
            <RefreshCw className="w-8 h-8 animate-spin text-amber-500 mb-3" />
            <p className="text-sm font-medium text-neutral-300">Processing photo layers...</p>
          </div>
        )}

        {/* Viewport display canvas */}
        {imageLoaded ? (
          <div id="canvas-wrapper" className="relative max-w-full max-h-full aspect-auto flex items-center justify-center shadow-2xl border border-neutral-800 rounded-lg overflow-hidden">
            <canvas 
              ref={displayCanvasRef} 
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUpOrLeave}
              onMouseLeave={handleMouseUpOrLeave}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleMouseUpOrLeave}
              className={`max-w-full max-h-full h-auto w-auto object-contain block transition-shadow duration-300 ${brushMode !== 'none' ? 'cursor-crosshair' : 'cursor-default'}`}
              style={{ touchAction: 'none' }}
            />
            {/* Soft circle preview around cursor when brushing */}
            {brushMode !== 'none' && isDrawing && (
              <div 
                id="brush-cursor-indicator"
                className="absolute pointer-events-none rounded-full border-2 border-white/80 shadow-[0_0_8px_rgba(0,0,0,0.5)] -translate-x-1/2 -translate-y-1/2"
                style={{ 
                  left: `${lastPos.x}px`, 
                  top: `${lastPos.y}px`, 
                  width: `${brushSize}px`, 
                  height: `${brushSize}px`
                }}
              />
            )}
          </div>
        ) : (
          <div id="upload-welcome-view" className="flex flex-col items-center justify-center p-6 text-center max-w-sm">
            <ImageIcon className="w-16 h-16 text-neutral-600 mb-4 animate-pulse" />
            <h3 className="text-lg font-semibold text-neutral-200 mb-1">No Photo Selected</h3>
            <p className="text-xs text-neutral-400 mb-5 leading-relaxed">Upload a portrait to begin advanced 35mm film color-grading, Meitu skin smoothing, and lipstick makeup retouching.</p>
          </div>
        )}
      </div>

      {/* Brush tool parameters adjustment bar */}
      {brushMode !== 'none' && (
        <div id="brush-params-bar" className="bg-neutral-900 border-t border-neutral-800 px-5 py-3 flex flex-col gap-3">
          <div id="brush-header-row" className="flex items-center justify-between">
            <span className="text-[11px] font-bold tracking-wider text-amber-500 uppercase">Brush: {brushMode.toUpperCase()} Mode</span>
            <button 
              id="brush-done-btn"
              onClick={() => setBrushMode('none')}
              className="flex items-center gap-1 py-1 px-3 rounded-full bg-neutral-800 text-neutral-300 text-xs hover:bg-neutral-700 transition-colors"
            >
              <Check className="w-3.5 h-3.5 text-green-500" /> Done Brushing
            </button>
          </div>
          <div id="brush-sliders" className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <div className="flex justify-between text-xs text-neutral-400">
                <span>Brush Size</span>
                <span>{brushSize}px</span>
              </div>
              <input 
                id="brush-size-slider"
                type="range" 
                min="10" 
                max="100" 
                value={brushSize}
                onChange={(e) => setBrushSize(parseInt(e.target.value))}
                className="w-full accent-amber-500 h-1 bg-neutral-700 rounded-lg appearance-none cursor-pointer"
              />
            </div>
            {['lipstick', 'blush', 'eyeshadow'].includes(brushMode) && (
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-xs text-neutral-400">
                  <span>Color Opacity</span>
                  <span>{brushOpacity}%</span>
                </div>
                <input 
                  id="brush-opacity-slider"
                  type="range" 
                  min="5" 
                  max="100" 
                  value={brushOpacity}
                  onChange={(e) => setBrushOpacity(parseInt(e.target.value))}
                  className="w-full accent-amber-500 h-1 bg-neutral-700 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Editor Control/Slider Drawer */}
      <div id="editor-drawer" className="bg-neutral-900 border-t border-neutral-800 p-5 select-none z-10 flex flex-col gap-4">
        
        {/* TAB SPECIFIC INNER VIEWS */}
        {activeTab === 'filters' && (
          <div id="filters-tab-view" className="flex flex-col gap-4">
            {/* Film Preset Horizontal Selector */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold text-neutral-400 tracking-wider uppercase">Select 35mm film emulsion</span>
              <div id="film-presets-scroller" className="flex gap-2.5 overflow-x-auto pb-1 max-w-full scrollbar-thin">
                {(['none', 'portra', 'kodachrome', 'superia', 'cinestill', 'ilford', 'ektar'] as const).map((p) => (
                  <button
                    id={`filter-preset-${p}`}
                    key={p}
                    onClick={() => {
                      setFilterSettings(prev => ({ ...prev, type: p }));
                      setTimeout(applyFiltersAndRedraw, 30);
                    }}
                    className={`flex-shrink-0 px-4 py-2.5 rounded-xl border text-center transition-all ${filterSettings.type === p ? 'bg-amber-500 border-amber-400 text-black font-semibold' : 'bg-neutral-800 border-neutral-700 text-neutral-300 hover:bg-neutral-750'}`}
                  >
                    <div className="text-xs font-bold leading-none capitalize">{p === 'none' ? 'Raw / Off' : p}</div>
                    <div className="text-[9px] mt-1 opacity-75">
                      {p === 'none' && 'Unfiltered'}
                      {p === 'portra' && 'Portra 400'}
                      {p === 'kodachrome' && 'Koda 64'}
                      {p === 'superia' && 'Superia 400'}
                      {p === 'cinestill' && 'Cine 800T'}
                      {p === 'ilford' && 'HP5 Plus'}
                      {p === 'ektar' && 'Ektar 100'}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Filter Intensity & Overlay sliders */}
            {filterSettings.type !== 'none' && (
              <div id="filter-sliders-grid" className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-xs text-neutral-400">
                    <span>Emulsion Intensity</span>
                    <span>{filterSettings.intensity}%</span>
                  </div>
                  <input 
                    id="filter-intensity-slider"
                    type="range" 
                    min="10" 
                    max="100" 
                    value={filterSettings.intensity}
                    onChange={(e) => {
                      setFilterSettings(prev => ({ ...prev, intensity: parseInt(e.target.value) }));
                      setTimeout(applyFiltersAndRedraw, 10);
                    }}
                    className="w-full accent-amber-500 h-1 bg-neutral-700 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-xs text-neutral-400">
                    <span>Film Grain (Noise)</span>
                    <span>{filterSettings.grain}%</span>
                  </div>
                  <input 
                    id="film-grain-slider"
                    type="range" 
                    min="0" 
                    max="100" 
                    value={filterSettings.grain}
                    onChange={(e) => {
                      setFilterSettings(prev => ({ ...prev, grain: parseInt(e.target.value) }));
                      setTimeout(applyFiltersAndRedraw, 10);
                    }}
                    className="w-full accent-amber-500 h-1 bg-neutral-700 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-xs text-neutral-400">
                    <span>Vignette (Border)</span>
                    <span>{filterSettings.vignette}%</span>
                  </div>
                  <input 
                    id="vignette-slider"
                    type="range" 
                    min="0" 
                    max="100" 
                    value={filterSettings.vignette}
                    onChange={(e) => {
                      setFilterSettings(prev => ({ ...prev, vignette: parseInt(e.target.value) }));
                      setTimeout(applyFiltersAndRedraw, 10);
                    }}
                    className="w-full accent-amber-500 h-1 bg-neutral-700 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex justify-between text-xs text-neutral-400">
                    <span>Light Leak Flare</span>
                    <span>{filterSettings.lightLeak}%</span>
                  </div>
                  <input 
                    id="light-leak-slider"
                    type="range" 
                    min="0" 
                    max="100" 
                    value={filterSettings.lightLeak}
                    onChange={(e) => {
                      setFilterSettings(prev => ({ ...prev, lightLeak: parseInt(e.target.value) }));
                      setTimeout(applyFiltersAndRedraw, 10);
                    }}
                    className="w-full accent-amber-500 h-1 bg-neutral-700 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
              </div>
            )}

            {/* Vintage Photo Frames Horizontal Selector */}
            <div className="flex flex-col gap-1.5 border-t border-neutral-800/60 pt-3">
              <span className="text-[11px] font-semibold text-neutral-400 tracking-wider uppercase">Add Vintage Photo Frame</span>
              <div id="vintage-frames-scroller" className="flex gap-2.5 overflow-x-auto pb-1 max-w-full scrollbar-thin">
                {([
                  { id: 'none', label: 'None', desc: 'No border' },
                  { id: 'polaroid', label: 'Polaroid', desc: 'Classic white' },
                  { id: 'sprocket', label: '35mm Film', desc: 'Sprocket holes' },
                  { id: 'slide', label: 'Slide Mount', desc: 'Retro slide' },
                  { id: 'white', label: 'Minimal White', desc: 'Crisp border' },
                  { id: 'black', label: 'Studio Black', desc: 'Sleek black' }
                ] as const).map((f) => (
                  <button
                    id={`frame-preset-${f.id}`}
                    key={f.id}
                    onClick={() => {
                      setFilterSettings(prev => ({ ...prev, frameType: f.id }));
                      setTimeout(applyFiltersAndRedraw, 30);
                    }}
                    className={`flex-shrink-0 px-3.5 py-2.5 rounded-xl border text-center transition-all ${filterSettings.frameType === f.id ? 'bg-amber-500 border-amber-400 text-black font-semibold' : 'bg-neutral-800 border-neutral-700 text-neutral-300 hover:bg-neutral-750'}`}
                  >
                    <div className="text-xs font-bold leading-none">{f.label}</div>
                    <div className="text-[9px] mt-1 opacity-75">{f.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Photo Alignment / Position Adjustments within Frame */}
            {filterSettings.frameType && filterSettings.frameType !== 'none' && (
              <div id="frame-photo-positioning" className="flex flex-col gap-2.5 bg-neutral-950/40 p-3 rounded-xl border border-neutral-800/80 mt-1">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider">Position & Size within Frame</span>
                  <button
                    id="reset-frame-layout-btn"
                    onClick={() => {
                      setFilterSettings(prev => ({ ...prev, photoScale: 100, photoX: 0, photoY: 0 }));
                      setTimeout(applyFiltersAndRedraw, 30);
                    }}
                    className="text-[9px] bg-neutral-800 hover:bg-neutral-700 text-neutral-300 px-2 py-0.5 rounded border border-neutral-700 transition-colors font-medium font-mono"
                  >
                    Reset Center
                  </button>
                </div>
                
                <p className="text-[10px] text-neutral-400 leading-normal">
                  💡 Drag the photo directly on the canvas, or use these sliders to zoom & offset:
                </p>

                <div className="grid grid-cols-3 gap-3">
                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between text-[10px] text-neutral-400">
                      <span>Zoom</span>
                      <span>{filterSettings.photoScale ?? 100}%</span>
                    </div>
                    <input 
                      id="photo-scale-slider"
                      type="range" 
                      min="20" 
                      max="200" 
                      value={filterSettings.photoScale ?? 100}
                      onChange={(e) => {
                        setFilterSettings(prev => ({ ...prev, photoScale: parseInt(e.target.value) }));
                        setTimeout(applyFiltersAndRedraw, 10);
                      }}
                      className="w-full accent-amber-500 h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between text-[10px] text-neutral-400">
                      <span>Shift X</span>
                      <span>{Math.round(filterSettings.photoX ?? 0)}%</span>
                    </div>
                    <input 
                      id="photo-x-slider"
                      type="range" 
                      min="-150" 
                      max="150" 
                      value={Math.round(filterSettings.photoX ?? 0)}
                      onChange={(e) => {
                        setFilterSettings(prev => ({ ...prev, photoX: parseInt(e.target.value) }));
                        setTimeout(applyFiltersAndRedraw, 10);
                      }}
                      className="w-full accent-amber-500 h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <div className="flex justify-between text-[10px] text-neutral-400">
                      <span>Shift Y</span>
                      <span>{Math.round(filterSettings.photoY ?? 0)}%</span>
                    </div>
                    <input 
                      id="photo-y-slider"
                      type="range" 
                      min="-150" 
                      max="150" 
                      value={Math.round(filterSettings.photoY ?? 0)}
                      onChange={(e) => {
                        setFilterSettings(prev => ({ ...prev, photoY: parseInt(e.target.value) }));
                        setTimeout(applyFiltersAndRedraw, 10);
                      }}
                      className="w-full accent-amber-500 h-1 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'smoothing' && (
          <div id="retouch-tab-view" className="flex flex-col gap-4">
            
            {/* Beauty Brushes Selectors */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold text-neutral-400 tracking-wider uppercase">Interactive Touch-Up Brushes</span>
              <div id="touchup-brushes" className="flex gap-2">
                <button
                  id="brush-smooth-btn"
                  onClick={() => {
                    setBrushMode('smooth');
                    setBrushSize(35);
                    setBrushOpacity(30);
                  }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${brushMode === 'smooth' ? 'bg-amber-500 border-amber-400 text-black' : 'bg-neutral-800 border-neutral-700 text-neutral-300 hover:bg-neutral-750'}`}
                >
                  <Brush className="w-4 h-4" /> Smooth Skin
                </button>
                <button
                  id="brush-blemish-btn"
                  onClick={() => {
                    setBrushMode('blemish');
                    setBrushSize(25);
                  }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${brushMode === 'blemish' ? 'bg-amber-500 border-amber-400 text-black' : 'bg-neutral-800 border-neutral-700 text-neutral-300 hover:bg-neutral-750'}`}
                  title="Tap blemishes or spots on the portrait to heal/blend them"
                >
                  <Sparkles className="w-4 h-4" /> Acne Remover
                </button>
              </div>
              <p className="text-[10px] text-neutral-400 mt-0.5 italic">Select a brush above, then draw directly on the portrait to smooth or heal blemishes.</p>
            </div>

            {/* Global Retouch Sliders */}
            <div id="retouch-sliders" className="grid grid-cols-2 gap-4 border-t border-neutral-800/60 pt-3">
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-xs text-neutral-400">
                  <span>Skin Smoothing (All)</span>
                  <span>{retouchSettings.skinSmoothing}%</span>
                </div>
                <input 
                  id="global-skin-smoothing-slider"
                  type="range" 
                  min="0" 
                  max="100" 
                  value={retouchSettings.skinSmoothing}
                  onChange={(e) => {
                    setRetouchSettings(prev => ({ ...prev, skinSmoothing: parseInt(e.target.value) }));
                    setTimeout(applyFiltersAndRedraw, 10);
                  }}
                  className="w-full accent-amber-500 h-1 bg-neutral-700 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-xs text-neutral-400">
                  <span>Skin Tone Warmth</span>
                  <span>{retouchSettings.skinToneWarmth > 0 ? `+${retouchSettings.skinToneWarmth}` : retouchSettings.skinToneWarmth}</span>
                </div>
                <input 
                  id="skin-warmth-slider"
                  type="range" 
                  min="-50" 
                  max="50" 
                  value={retouchSettings.skinToneWarmth}
                  onChange={(e) => {
                    setRetouchSettings(prev => ({ ...prev, skinToneWarmth: parseInt(e.target.value) }));
                    setTimeout(applyFiltersAndRedraw, 10);
                  }}
                  className="w-full accent-amber-500 h-1 bg-neutral-700 rounded-lg appearance-none cursor-pointer"
                />
              </div>

              <div className="flex flex-col gap-1 col-span-2">
                <div className="flex justify-between text-xs text-neutral-400">
                  <span>Eye & Highlight Brightening</span>
                  <span>{retouchSettings.eyeBrightening}%</span>
                </div>
                <input 
                  id="eye-brightening-slider"
                  type="range" 
                  min="0" 
                  max="100" 
                  value={retouchSettings.eyeBrightening}
                  onChange={(e) => {
                    setRetouchSettings(prev => ({ ...prev, eyeBrightening: parseInt(e.target.value) }));
                    setTimeout(applyFiltersAndRedraw, 10);
                  }}
                  className="w-full accent-amber-500 h-1 bg-neutral-700 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>

          </div>
        )}

        {activeTab === 'makeup' && (
          <div id="makeup-tab-view" className="flex flex-col gap-4">
            
            {/* Makeup category brush selector */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold text-neutral-400 tracking-wider uppercase">Select Makeup Feature</span>
              <div id="makeup-features" className="flex gap-2">
                {(['lipstick', 'blush', 'eyeshadow'] as const).map((mode) => (
                  <button
                    id={`makeup-brush-${mode}`}
                    key={mode}
                    onClick={() => {
                      setBrushMode(mode);
                      setBrushSize(mode === 'blush' ? 60 : mode === 'eyeshadow' ? 30 : 15);
                      setBrushOpacity(mode === 'blush' ? 15 : mode === 'eyeshadow' ? 20 : 35);
                      // Set default palette colors
                      setBrushColor(mode === 'lipstick' ? LIPSTICK_SWATCHES[0].color : mode === 'blush' ? BLUSH_SWATCHES[0].color : EYESHADOW_SWATCHES[0].color);
                    }}
                    className={`flex-1 py-2 px-3 rounded-xl border text-xs font-semibold capitalize transition-all ${brushMode === mode ? 'bg-amber-500 border-amber-400 text-black' : 'bg-neutral-800 border-neutral-700 text-neutral-300 hover:bg-neutral-750'}`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            {/* Colors Swatches & Shaders depending on active brush */}
            {['lipstick', 'blush', 'eyeshadow'].includes(brushMode) && (
              <div id="makeup-palette-selector" className="flex flex-col gap-2">
                <span className="text-[11px] font-semibold text-neutral-400 tracking-wider uppercase">Choose Shade Palette</span>
                <div id="swatches-row" className="flex gap-3 overflow-x-auto pb-1">
                  {(brushMode === 'lipstick' ? LIPSTICK_SWATCHES : brushMode === 'blush' ? BLUSH_SWATCHES : EYESHADOW_SWATCHES).map((swatch) => (
                    <button
                      id={`swatch-${swatch.name}`}
                      key={swatch.name}
                      onClick={() => setBrushColor(swatch.color)}
                      className={`flex-shrink-0 flex flex-col items-center gap-1 p-1 rounded-lg border transition-all ${brushColor === swatch.color ? 'border-amber-500 bg-neutral-850' : 'border-transparent bg-transparent hover:border-neutral-700'}`}
                    >
                      <span 
                        className="w-7 h-7 rounded-full border border-white/20 shadow-inner" 
                        style={{ backgroundColor: swatch.color }} 
                      />
                      <span className="text-[9px] text-neutral-400 max-w-[50px] truncate text-center font-medium">{swatch.name}</span>
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-neutral-400 italic">Brush size is set to {brushSize}px. Brush color on photo, blend mode handles realism.</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'reshape' && (
          <div id="reshape-tab-view" className="flex flex-col gap-4">
            
            {/* Meitu Face Sculpt Tools */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[11px] font-semibold text-neutral-400 tracking-wider uppercase">Interactive Face Sculpt Tools</span>
              <div id="reshape-sculpts" className="flex gap-2">
                <button
                  id="brush-liquify-btn"
                  onClick={() => {
                    setBrushMode('liquify');
                    setBrushSize(50);
                  }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${brushMode === 'liquify' ? 'bg-amber-500 border-amber-400 text-black' : 'bg-neutral-800 border-neutral-700 text-neutral-300 hover:bg-neutral-750'}`}
                  title="Drag and push pixels slowly to slim the chin, cheeks, or nose"
                >
                  <Paintbrush className="w-4 h-4" /> Slimming Brush
                </button>
                <button
                  id="brush-enlarge-btn"
                  onClick={() => {
                    setBrushMode('enlarge');
                    setBrushSize(40);
                  }}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${brushMode === 'enlarge' ? 'bg-amber-500 border-amber-400 text-black' : 'bg-neutral-800 border-neutral-700 text-neutral-300 hover:bg-neutral-750'}`}
                  title="Click directly on eyes to enlarge them subtly"
                >
                  <Maximize2 className="w-4 h-4" /> Eye Enlarger
                </button>
              </div>
              <p className="text-[10px] text-neutral-400 leading-relaxed italic">
                {brushMode === 'liquify' && "SLIMMING BRUSH: Drag inside cheekbones or chin slowly to squeeze the facial structure. Perfect for chin reshaping."}
                {brushMode === 'enlarge' && "EYE ENLARGER: Tap gently directly over the pupils. Each tap expands the area by 15% outwards for a classic Meitu look."}
                {brushMode === 'none' && "Select one of the sculpt tools above to reshape jawlines, enlarge eyes, or modify facial contours."}
              </p>
            </div>
          </div>
        )}

        {activeTab === 'ai' && (
          <div id="ai-tab-view" className="flex flex-col gap-2">
            <span className="text-[11px] font-semibold text-neutral-400 tracking-wider uppercase">AI Retouch & Smart Presets</span>
            <p className="text-xs text-neutral-300 leading-relaxed">Use the <strong className="text-amber-500">AI Portrait Review</strong> panel above or upload a portrait to consult Gemini on optimal aesthetic parameters.</p>
          </div>
        )}

        {/* Dynamic Image upload / sample bar */}
        <div id="photo-picker-section" className="border-t border-neutral-800/80 pt-4 flex items-center justify-between gap-3">
          
          {/* Quick templates */}
          <div id="sample-picker-bar" className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">Samples:</span>
            <div className="flex gap-1.5">
              {SAMPLE_PORTRAITS.map((p) => (
                <button
                  id={`sample-portrait-${p.id}`}
                  key={p.id}
                  onClick={() => loadSampleImage(p.url)}
                  className="px-2 py-1 text-[10px] font-medium bg-neutral-800 hover:bg-neutral-750 text-neutral-300 rounded border border-neutral-700 transition-all hover:scale-105"
                >
                  {p.name.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>

          {/* Upload Button */}
          <div id="upload-actions" className="flex items-center gap-2">
            <input 
              ref={fileInputRef}
              type="file" 
              accept="image/*" 
              onChange={handleFileUpload} 
              className="hidden" 
            />
            <button
              id="upload-photo-btn"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-neutral-200 border border-neutral-700 transition-colors"
            >
              <ImageIcon className="w-3.5 h-3.5 text-amber-500" /> Upload Photo
            </button>
            {imageLoaded && (
              <button
                id="export-photo-btn"
                onClick={handleDownload}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-xs font-bold text-black shadow-lg transition-colors"
              >
                <Download className="w-3.5 h-3.5" /> Save
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

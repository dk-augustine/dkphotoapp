export type FilterType = 'none' | 'portra' | 'kodachrome' | 'superia' | 'cinestill' | 'ilford' | 'ektar';
export type FrameType = 'none' | 'polaroid' | 'sprocket' | 'slide' | 'white' | 'black';

export interface FilterSettings {
  type: FilterType;
  intensity: number; // 0 to 100
  grain: number; // 0 to 100
  lightLeak: number; // 0 to 100
  vignette: number; // 0 to 100
  frameType: FrameType;
  photoScale: number; // 10 to 200, default 100
  photoX: number; // -100 to 100, default 0
  photoY: number; // -100 to 100, default 0
}

export interface RetouchSettings {
  skinSmoothing: number; // 0 to 100
  skinToneWarmth: number; // -50 to 50
  eyeBrightening: number; // 0 to 100
  teethWhitening: number; // 0 to 100
}

export interface MakeupSettings {
  lipstickColor: string;
  lipstickOpacity: number; // 0 to 100
  blushColor: string;
  blushOpacity: number; // 0 to 100
  eyeshadowColor: string;
  eyeshadowOpacity: number; // 0 to 100
}

export type BrushMode = 
  | 'none'
  | 'smooth' // brush on areas to smooth skin
  | 'blemish' // tap to heal/blemish remove
  | 'lipstick' // brush on lipstick
  | 'blush' // brush on blush
  | 'eyeshadow' // brush on eyeshadow
  | 'liquify' // drag to push facial features
  | 'enlarge'; // click to enlarge features (eyes)

export interface BrushConfig {
  mode: BrushMode;
  size: number; // 10 to 100
  opacity: number; // 0 to 100
  color: string; // for makeup brushes
}

export type ActiveTab = 'filters' | 'smoothing' | 'makeup' | 'reshape' | 'ai';

export interface HistoryState {
  imageData: ImageData;
  description: string;
}

export interface AIRecommendation {
  analysis: string;
  recommendations: {
    filmPreset: FilterType;
    presetReason: string;
    skinSmoothing: number;
    skinToneWarmth: number;
    eyeBrightening: number;
    teethWhitening: number;
    makeup: {
      lipstickColor: string;
      lipstickOpacity: number;
      blushColor: string;
      blushOpacity: number;
      eyeshadowColor: string;
      eyeshadowOpacity: number;
    };
  };
}

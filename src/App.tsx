/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Sliders, Sparkles, Paintbrush, Maximize2, Sparkle } from 'lucide-react';
import PhoneFrame from './components/PhoneFrame';
import CanvasEditor from './components/CanvasEditor';
import AIReviewPanel from './components/AIReviewPanel';
import { FilterSettings, RetouchSettings, MakeupSettings, ActiveTab } from './types';

export default function App() {
  // Global States holding selected configurations
  const [filterSettings, setFilterSettings] = useState<FilterSettings>({
    type: 'none',
    intensity: 50,
    grain: 15,
    vignette: 10,
    lightLeak: 0,
    frameType: 'none',
    photoScale: 100,
    photoX: 0,
    photoY: 0,
  });

  const [retouchSettings, setRetouchSettings] = useState<RetouchSettings>({
    skinSmoothing: 25,
    skinToneWarmth: 0,
    eyeBrightening: 15,
    teethWhitening: 10,
  });

  const [makeupSettings, setMakeupSettings] = useState<MakeupSettings>({
    lipstickColor: '#b91c1c',
    lipstickOpacity: 0,
    blushColor: '#f472b6',
    blushOpacity: 0,
    eyeshadowColor: '#fbcfe8',
    eyeshadowOpacity: 0,
  });

  const [activeTab, setActiveTab] = useState<ActiveTab>('filters');
  const [uploadedImageSrc, setUploadedImageSrc] = useState<string | null>(null);
  
  // Incremented on every AI Apply to trigger re-renders inside the CanvasEditor
  const [aiAppliedVersion, setAiAppliedVersion] = useState(0);

  // Apply values recommended by AI Portrait analysis
  const handleApplyAIRecommendations = (
    filter: FilterSettings,
    retouch: RetouchSettings,
    makeup: MakeupSettings
  ) => {
    setFilterSettings(filter);
    setRetouchSettings(retouch);
    setMakeupSettings(makeup);
    setAiAppliedVersion((v) => v + 1);
  };

  return (
    <PhoneFrame>
      <div id="meitu-app-root" className="flex-1 flex flex-col min-h-0 bg-neutral-950">
        
        {/* iOS-style Top Title Header */}
        <div id="app-header" className="h-14 px-5 flex items-center justify-between bg-neutral-900/60 backdrop-blur-md border-b border-neutral-800/80 select-none">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-amber-500 to-rose-500 flex items-center justify-center text-black font-extrabold text-sm shadow-md shadow-amber-500/10">
              D
            </div>
            <div>
              <h1 className="text-sm font-extrabold text-neutral-100 tracking-tight">DKPhoto</h1>
              <p className="text-[9px] text-neutral-400 font-medium tracking-wide">35mm Film & Advanced Retouching</p>
            </div>
          </div>
          
          <div className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full">
            <Sparkle className="w-3 h-3 text-amber-500 fill-amber-500" />
            <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">PRO</span>
          </div>
        </div>

        {/* AI Portrait review panel (Shown always at the top when AI tab is active, or collapsible) */}
        {activeTab === 'ai' && (
          <AIReviewPanel 
            imageSrc={uploadedImageSrc} 
            onApplyRecommendation={handleApplyAIRecommendations} 
          />
        )}

        {/* Central Portrait Canvas Editor */}
        <CanvasEditor 
          filterSettings={filterSettings}
          setFilterSettings={setFilterSettings}
          retouchSettings={retouchSettings}
          setRetouchSettings={setRetouchSettings}
          makeupSettings={makeupSettings}
          setMakeupSettings={setMakeupSettings}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          onImageLoaded={setUploadedImageSrc}
          aiAppliedVersion={aiAppliedVersion}
        />

        {/* Bottom Tab Bar (iOS style) */}
        <div id="app-tab-bar" className="h-[76px] bg-neutral-900 border-t border-neutral-800/80 px-4 pb-4 flex justify-around items-center select-none z-10">
          
          <button
            id="tab-filters"
            onClick={() => setActiveTab('filters')}
            className={`flex flex-col items-center justify-center gap-1 py-1.5 px-3 rounded-xl transition-all ${activeTab === 'filters' ? 'text-amber-500 scale-105' : 'text-neutral-400 hover:text-neutral-200'}`}
          >
            <Sliders className="w-5 h-5" />
            <span className="text-[10px] font-bold tracking-wide">35mm Film</span>
          </button>

          <button
            id="tab-smoothing"
            onClick={() => setActiveTab('smoothing')}
            className={`flex flex-col items-center justify-center gap-1 py-1.5 px-3 rounded-xl transition-all ${activeTab === 'smoothing' ? 'text-amber-500 scale-105' : 'text-neutral-400 hover:text-neutral-200'}`}
          >
            <Sparkles className="w-5 h-5" />
            <span className="text-[10px] font-bold tracking-wide">Retouching</span>
          </button>

          <button
            id="tab-makeup"
            onClick={() => setActiveTab('makeup')}
            className={`flex flex-col items-center justify-center gap-1 py-1.5 px-3 rounded-xl transition-all ${activeTab === 'makeup' ? 'text-amber-500 scale-105' : 'text-neutral-400 hover:text-neutral-200'}`}
          >
            <Paintbrush className="w-5 h-5" />
            <span className="text-[10px] font-bold tracking-wide">Makeup</span>
          </button>

          <button
            id="tab-reshape"
            onClick={() => setActiveTab('reshape')}
            className={`flex flex-col items-center justify-center gap-1 py-1.5 px-3 rounded-xl transition-all ${activeTab === 'reshape' ? 'text-amber-500 scale-105' : 'text-neutral-400 hover:text-neutral-200'}`}
          >
            <Maximize2 className="w-5 h-5 rotate-45" />
            <span className="text-[10px] font-bold tracking-wide">Sculpt</span>
          </button>

          <button
            id="tab-ai"
            onClick={() => setActiveTab('ai')}
            className={`flex flex-col items-center justify-center gap-1 py-1.5 px-3 rounded-xl transition-all ${activeTab === 'ai' ? 'text-amber-500 scale-105' : 'text-neutral-400 hover:text-neutral-200'}`}
          >
            <div className="relative">
              <Sparkles className="w-5 h-5 text-amber-400 animate-pulse" />
              <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-orange-500" />
            </div>
            <span className="text-[10px] font-bold tracking-wide">AI Suggest</span>
          </button>

        </div>

      </div>
    </PhoneFrame>
  );
}

import React, { useEffect, useState } from 'react';
import { Wifi, Battery, Signal } from 'lucide-react';

interface PhoneFrameProps {
  children: React.ReactNode;
}

export default function PhoneFrame({ children }: PhoneFrameProps) {
  const [time, setTime] = useState('09:41');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      let hours = now.getHours();
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12; // the hour '0' should be '12'
      setTime(`${hours}:${minutes} ${ampm}`);
    };

    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div id="ios-phone-wrapper" className="flex items-center justify-center min-h-[100dvh] bg-slate-950 p-0 md:p-6 text-white font-sans overflow-hidden">
      {/* Phone container - rendered as borderless mobile app on mobile screens, and as a beautiful iPhone chassis on md+ screens */}
      <div 
        id="ios-phone-chassis" 
        className="relative w-full h-[100dvh] md:w-[412px] md:h-[840px] md:max-h-[90vh] md:rounded-[50px] md:border-[12px] md:border-neutral-800 md:shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] bg-neutral-900 flex flex-col overflow-hidden md:ring-4 md:ring-neutral-900/50"
      >
        {/* iOS Top Status Bar (Only on Chassis) */}
        <div id="ios-status-bar" className="h-11 px-6 pt-3 flex justify-between items-center bg-neutral-950/80 backdrop-blur-md select-none text-[13px] font-semibold z-50 text-neutral-100">
          <div id="ios-clock" className="flex-1 text-left select-none">{time}</div>
          
          {/* Dynamic Island / Camera Notch (Only on md+ screen widths, otherwise simple notch) */}
          <div id="ios-dynamic-island" className="hidden md:block absolute left-1/2 -translate-x-1/2 top-2.5 w-24 h-6 bg-black rounded-full shadow-inner z-50 transition-all duration-300 hover:w-28 hover:h-7" />

          <div id="ios-status-icons" className="flex-1 flex justify-end items-center gap-1.5">
            <Signal className="w-3.5 h-3.5 text-neutral-100" />
            <Wifi className="w-3.5 h-3.5 text-neutral-100" />
            <div className="flex items-center gap-0.5">
              <span className="text-[10px] mr-0.5">85%</span>
              <Battery className="w-4 h-4 text-neutral-100 rotate-0" />
            </div>
          </div>
        </div>

        {/* Core App Viewport */}
        <div id="ios-viewport" className="flex-1 relative flex flex-col bg-neutral-950 overflow-hidden h-full">
          {children}
        </div>

        {/* iOS Home Indicator (Only visible on md+ screen widths or as absolute bottom line) */}
        <div id="ios-home-indicator-container" className="absolute bottom-0 left-0 right-0 h-5 bg-gradient-to-t from-neutral-950/90 to-transparent flex items-center justify-center pointer-events-none z-50">
          <div id="ios-home-indicator-bar" className="w-32 h-1 bg-white/40 rounded-full mb-1" />
        </div>
      </div>
    </div>
  );
}

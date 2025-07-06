import React, { createContext, useContext, useEffect, useState } from 'react';
import type { FrameContext } from '../types';
import { STORAGE_KEYS } from '../config';

const FrameContextContext = createContext<FrameContext>({
  isFrame: false,
});

interface FrameProviderProps {
  children: React.ReactNode;
  isFrame: boolean;
}

export function FrameProvider({ children, isFrame }: FrameProviderProps) {
  const [frameData, setFrameData] = useState<FrameContext['frameData']>();

  useEffect(() => {
    if (isFrame) {
      // Extract frame data from URL parameters or postMessage
      const urlParams = new URLSearchParams(window.location.search);
      
      const extractedFrameData = {
        fid: urlParams.get('fid') ? parseInt(urlParams.get('fid')!) : undefined,
        castId: urlParams.get('castId') ? JSON.parse(urlParams.get('castId')!) : undefined,
        messageBytes: urlParams.get('messageBytes') || undefined,
      };
      
      setFrameData(extractedFrameData);
      
      // Store frame context
      sessionStorage.setItem(STORAGE_KEYS.SESSION_ID, `frame_${Date.now()}`);
      
      // Listen for postMessages from parent frame
      const handleMessage = (event: MessageEvent) => {
        if (event.origin !== window.location.origin && !isValidFrameOrigin(event.origin)) {
          return;
        }
        
        if (event.data.type === 'frame-action') {
          setFrameData(prev => ({
            ...prev,
            ...event.data.payload,
          }));
        }
      };
      
      window.addEventListener('message', handleMessage);
      
      return () => {
        window.removeEventListener('message', handleMessage);
      };
    }
  }, [isFrame]);

  const contextValue: FrameContext = {
    isFrame,
    frameData,
  };

  return (
    <FrameContextContext.Provider value={contextValue}>
      {children}
    </FrameContextContext.Provider>
  );
}

export function useFrame() {
  const context = useContext(FrameContextContext);
  if (!context) {
    throw new Error('useFrame must be used within a FrameProvider');
  }
  return context;
}

function isValidFrameOrigin(origin: string): boolean {
  const allowedOrigins = [
    'https://warpcast.com',
    'https://frames.warpcast.com',
    'https://frame.warpcast.com',
    'https://farcaster.xyz',
  ];
  
  return allowedOrigins.includes(origin);
}
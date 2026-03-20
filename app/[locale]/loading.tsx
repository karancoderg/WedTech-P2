"use client";

import { useEffect, useState } from "react";

const sayings = [
  "Preparing your digital workspace...",
  "Arranging the seating plans...",
  "Polishing the silverware...",
  "Syncing your guest lists...",
  "Redirecting to dashboard..."
];

export default function Loading() {
  const [textIndex, setTextIndex] = useState(0);

  useEffect(() => {
    // Cycle every 2 seconds until the final "Redirecting" message
    const interval = setInterval(() => {
      setTextIndex((current) => (current < sayings.length - 1 ? current + 1 : current));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-transparent font-sans text-stone-800 relative z-50">
      <div className="w-full max-w-md space-y-6 px-4 flex flex-col items-center">
        {/* Logo matching the Auth page */}
        <div className="text-center">
          <h1 className="text-4xl md:text-5xl font-serif tracking-widest text-center mx-auto text-stone-800">
            WED<span className="italic font-light">SYNC</span>
          </h1>
        </div>

        {/* Minimal Animated Spinner */}
        <div className="w-12 h-12 relative flex items-center justify-center mb-4">
          <div className="absolute inset-0 border-t border-stone-800 rounded-full animate-spin opacity-40 duration-1000"></div>
          <div className="absolute inset-1 border-r border-stone-500 rounded-full animate-spin opacity-30 duration-700 reverse"></div>
        </div>

        {/* AI Loading Sayings instead of the old static text */}
        <div className="h-8 overflow-hidden relative w-full flex justify-center mt-2">
          <p
            key={textIndex}
            className="text-xs font-light tracking-widest uppercase text-stone-500 animate-fade-in-up absolute text-center"
            style={{
              animation: "fadeInUp 0.6s ease-out forwards",
            }}
          >
            {sayings[textIndex]}
          </p>
        </div>

        {/* Keyframe styles */}
        <style dangerouslySetInnerHTML={{
          __html: `
            @keyframes fadeInUp {
              from {
                opacity: 0;
                transform: translateY(8px);
              }
              to {
                opacity: 1;
                transform: translateY(0);
              }
            }
          `
        }} />
      </div>
    </div>
  );
}

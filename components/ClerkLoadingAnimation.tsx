"use client";

import { useEffect, useState } from "react";
import { ClerkLoading } from "@clerk/nextjs";

const sayings = [
  "Preparing your digital workspace...",
  "Arranging the seating plans...",
  "Polishing the silverware...",
  "Syncing your guest lists...",
  "Redirecting to dashboard..."
];

export function ClerkLoadingAnimation() {
  const [textIndex, setTextIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTextIndex((current) => (current < sayings.length - 1 ? current + 1 : current));
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <ClerkLoading>
      <div className="flex flex-col items-center justify-center mt-4">
        {/* Minimal Animated Spinner */}
        <div className="w-8 h-8 relative flex items-center justify-center mb-4">
          <div className="absolute inset-0 border-t border-stone-800 rounded-full animate-spin opacity-40 duration-1000"></div>
          <div className="absolute inset-1 border-r border-stone-500 rounded-full animate-spin opacity-30 duration-700 reverse"></div>
        </div>

        {/* AI Loading Sayings */}
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
    </ClerkLoading>
  );
}

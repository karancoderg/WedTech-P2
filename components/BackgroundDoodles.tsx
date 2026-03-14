"use client";

import React, { useEffect, useState } from "react";

const doodles = [
  // Interlocking Rings
  <svg key="rings" xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="opacity-[0.08] text-amber-950">
    <path d="M8.5 15.5a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11z"/>
    <path d="M15.5 19.5a5.5 5.5 0 1 0 0-11 5.5 5.5 0 0 0 0 11z"/>
    <path d="m5 5 2.5-2.5"/>
    <path d="m11 5-2.5-2.5"/>
    <path d="M6 3h4"/>
  </svg>,
  // Formal Tiered Wedding Cake
  <svg key="wedding-cake" xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="opacity-[0.08] text-amber-950">
    <path d="M20 21v-6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v6"/>
    <path d="M16 13v-4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v4"/>
    <path d="M12 7V3"/>
    <path d="M12 3h.01"/>
    <path d="M2 21h20"/>
    <path d="M4 16s1.5 1 4 1 4-1 4-1 1.5 1 4 1 4-1 4-1"/>
  </svg>,
  // Interlocking Hearts
  <svg key="hearts" xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="opacity-[0.08] text-amber-950">
    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>
    <path d="M12 5 9.04 9.2a3.1 3.1 0 0 0-1 2.2V19l4-4 4 4v-7.6a3.1 3.1 0 0 0-1-2.2Z"/>
  </svg>,
  // Champagne Flutes
  <svg key="flutes" xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="opacity-[0.08] text-amber-950">
    <path d="M14 2 9.5 7.5A6 6 0 0 0 8 12c0 3.3 2.7 6 6 6s6-2.7 6-6a6 6 0 0 0-1.5-4.5L14 2Z"/>
    <path d="M14 18v4"/>
    <path d="M10 22h8"/>
    <path d="m5 2 4.5 5.5A6 6 0 0 1 11 12"/>
    <path d="M15 15s1.5-1.5 2.5 0"/>
    <path d="M13 13s1.5-1.5 2.5 0"/>
  </svg>,
  // Floral Arch / Laurel
  <svg key="laurel" xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="opacity-[0.08] text-amber-950">
    <path d="M4 20c1.5-1.5 5.5-4 16-16-1.5 1.5-4 5.5-16 16Z"/>
    <path d="M14 6s-2-2-4-2c-2 0-2 4 0 6s4 2 4-2"/>
    <path d="M18 10s-2-2-4-2c-2 0-2 4 0 6s4 2 4-2"/>
    <path d="M10 14s-2-2-4-2c-2 0-2 4 0 6s4 2 4-2"/>
    <path d="M14 18s-2-2-4-2c-2 0-2 4 0 6s4 2 4-2"/>
  </svg>,
  // Love Letter
  <svg key="love-letter" xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="opacity-[0.08] text-amber-950">
    <rect width="20" height="16" x="2" y="4" rx="2"/>
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
    <path d="M12 11c1.1-1.1 2.5-1.1 3.2 0 .6.6.6 1.6 0 2.2l-3.2 3.2-3.2-3.2c-.6-.6-.6-1.6 0-2.2.7-1.1 2.1-1.1 3.2 0Z" fill="currentColor" fillOpacity="0.2"/>
  </svg>,
];

export function BackgroundDoodles() {
  const [items, setItems] = useState<{ id: number; icon: React.ReactNode; top: number; left: number; rotation: number; scale: number }[]>([]);

  useEffect(() => {
    // Generate scattered doodles on mount
    const newItems = [];
    const count = 18; // Number of doodles to spread around
    
    for (let i = 0; i < count; i++) {
        // distribute them somewhat evenly across rows and columns
        const col = i % 6;
        const row = Math.floor(i / 6);
        const xBase = (col / 6) * 100;
        const yBase = (row / 3) * 100;
        
        // Randomize the exact position
        const xOffset = Math.random() * 15;
        const yOffset = Math.random() * 25;

      newItems.push({
        id: i,
        icon: doodles[Math.floor(Math.random() * doodles.length)],
        top: Math.min(Math.max(yBase + yOffset, 5), 95), 
        left: Math.min(Math.max(xBase + xOffset, 5), 95),
        rotation: (Math.random() - 0.5) * 45, // Slight rotation between -22 and 22 deg
        scale: 0.8 + Math.random() * 0.5,
      });
    }
    setItems(newItems);
  }, []);

  return (
    <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
      {items.map((item) => (
        <div
          key={item.id}
          className="absolute transform -translate-x-1/2 -translate-y-1/2"
          style={{
            top: `${item.top}%`,
            left: `${item.left}%`,
            transform: `rotate(${item.rotation}deg) scale(${item.scale})`,
          }}
        >
          {item.icon}
        </div>
      ))}
    </div>
  );
}

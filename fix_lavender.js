import fs from 'fs';

function updateFile(path, replacer) {
  let content = fs.readFileSync(path, 'utf8');
  content = replacer(content);
  fs.writeFileSync(path, content, 'utf8');
  console.log('Updated ' + path);
}

// 1. Update page.tsx
updateFile('app/[locale]/invite/[token]/page.tsx', (content) => {
  // Remove laptop outer background for minimal
  content = content.replace(
    /\{\/\* Extra Laptop Corners Background \(Hidden on Mobile\) \*\/\}\s*<div className="absolute inset-0 pointer-events-none hidden md:block select-none pointer-events-none">\s*\{\/\* Top Left Corner Floral \*\/\}\s*<img src="\/images\/blush_floral_top.png"[\s\S]*?<\/div>/,
    ''
  );

  // Replace background container for minimal
  const oldBg = `<div className="fixed inset-0 z-0 pointer-events-none flex justify-center">
            <div className="w-full max-w-[430px] relative h-full overflow-hidden">
               <div className="absolute top-0 right-0 w-64 h-64 bg-purple-200/50 rounded-full blur-[70px] mix-blend-multiply" />
               <div className="absolute bottom-0 left-0 w-64 h-64 bg-fuchsia-100/60 rounded-full blur-[70px] mix-blend-multiply" />
               <div className="absolute top-1/2 left-0 w-48 h-48 bg-blue-100/40 rounded-full blur-[80px] mix-blend-multiply" />
               
               {/* Transformed Florals for the Mobile Card Borders */}
               <img src="/images/blush_floral_top.png" alt="" className="absolute top-0 inset-x-0 w-full opacity-90 mix-blend-multiply object-cover" style={{ filter: 'hue-rotate(280deg) saturate(1.3) brightness(0.95)', maxHeight: '250px', objectPosition: 'top center' }} />
               <img src="/images/blush_floral_bottom.png" alt="" className="absolute bottom-0 inset-x-0 w-full opacity-90 mix-blend-multiply object-cover" style={{ filter: 'hue-rotate(280deg) saturate(1.3) brightness(0.95)', maxHeight: '250px', objectPosition: 'bottom center' }} />
            </div>
          </div>`;
          
  const newBg = `<div className="fixed inset-0 z-0 pointer-events-none flex justify-center">
            <div className="w-full max-w-[430px] relative h-full overflow-hidden bg-[#f8f0f2]">
               <img src="/images/wisteria_top.png" alt="" className="absolute top-0 inset-x-0 w-full opacity-100 mix-blend-multiply object-cover" style={{ maxHeight: '220px', objectPosition: 'top center' }} />
               <img src="/images/eucalyptus_bottom.png" alt="" className="absolute bottom-0 inset-x-0 w-full opacity-100 mix-blend-multiply object-cover" style={{ maxHeight: '220px', objectPosition: 'bottom center' }} />
            </div>
          </div>`;
  content = content.replace(oldBg, newBg);
  
  // Replace text section for minimal
  const oldContent = `{/* Content */}
          <div className="relative z-10 flex flex-col items-center flex-1 px-8 pt-12 pb-20 text-center">
            
            {/* Very Elegant Arabic Calligraphy / Swirl placeholder */}
            <div className="mb-6 opacity-60">
              <span className="material-symbols-outlined text-purple-900 text-5xl">diversity_2</span>
            </div>

            <p className="font-sans text-sm tracking-[0.15em] text-slate-700 uppercase leading-relaxed mb-6 font-medium">
              Please join us to celebrate the<br/>wedding of:
            </p>

            {/* Crest / Names */}
            <div className="relative w-72 h-72 mb-8 mx-auto flex flex-col items-center justify-center">
              {/* Optional Ring image */}
              <img src="/images/lavender_gold_ring.png" alt="" className="absolute inset-0 w-full h-full object-contain mix-blend-multiply" onError={(e) => {
                e.currentTarget.style.display='none';
                e.currentTarget.parentElement!.insertAdjacentHTML('afterbegin', '<div class="absolute inset-4 rounded-full border border-amber-400/50"></div><div class="absolute inset-3 rounded-full border border-amber-300/30"></div>');
              }} />

              <div className="relative z-10 flex flex-col items-center select-none pt-4">
                <span className={\`\${greatVibes.className} text-5xl text-slate-800 transform -rotate-6\`}>{wedding.bride_name}</span>
                <span className={\`\${greatVibes.className} text-3xl text-purple-800/60 my-2\`}>&amp;</span>
                <span className={\`\${greatVibes.className} text-5xl text-slate-800 transform -rotate-2\`}>{wedding.groom_name}</span>
              </div>
            </div>`;
            
  const newContent = `{/* Content */}
          <div className="relative z-10 flex flex-col items-center flex-1 px-8 pt-[140px] pb-20 text-center">
            
            <div className="mb-2 w-full text-center mt-6">
              <p className="font-serif text-[8px] sm:text-[10px] tracking-[0.1em] text-[#4a2e6b] font-bold">MARRIAGE IS A SUNNAH OF PROPHET MUHAMMAD S.A.W</p>
              <p className="font-serif text-[8px] sm:text-[10px] tracking-[0.1em] text-[#4a2e6b] font-bold">(SUNAN IBN MAJAH)</p>
            </div>

            <p className="font-serif text-xs md:text-sm tracking-[0.2em] text-[#4a2e6b] uppercase leading-relaxed mt-4 mb-4">
              Y O U  A R E  C O R D I A L L Y<br/>I N V I T E D  T O  T H E<br/>W E D D I N G  O F
            </p>

            <div className="relative w-full flex flex-col items-center select-none pt-4 pb-6 mt-4">
              <span className={\`\${greatVibes.className} text-6xl text-[#4a2e6b] mb-1\`}>{wedding.bride_name}</span>
              <span className={\`\${greatVibes.className} text-4xl text-[#2a173d] my-1\`}>With</span>
              <span className={\`\${greatVibes.className} text-6xl text-[#4a2e6b] mt-1\`}>{wedding.groom_name}</span>
            </div>`;
            
  content = content.replace(oldContent, newContent);
  return content;
});

// 2. rsvp/page.tsx
updateFile('app/[locale]/invite/[token]/rsvp/page.tsx', (content) => {
  // Minimal theme string replacements
  const oldMinimal = `        ) : wedding.template_id === 'minimal' ? (
          <>
            <div className="absolute inset-0 bg-[#ffffff]" />
            <div className="absolute top-0 right-0 w-64 h-64 bg-purple-200/50 rounded-full blur-[70px] mix-blend-multiply" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-fuchsia-100/60 rounded-full blur-[70px] mix-blend-multiply" />
            <img src="/images/blush_floral_top.png" alt="" className="absolute top-0 inset-x-0 w-full opacity-90 mix-blend-multiply object-cover" style={{ filter: 'hue-rotate(280deg) saturate(1.3) brightness(0.95)', maxHeight: '250px', objectPosition: 'top center' }} />
            <img src="/images/blush_floral_bottom.png" alt="" className="absolute bottom-0 inset-x-0 w-full opacity-90 mix-blend-multiply object-cover" style={{ filter: 'hue-rotate(280deg) saturate(1.3) brightness(0.95)', maxHeight: '250px', objectPosition: 'bottom center' }} />
          </>`;
  const newMinimal = `        ) : wedding.template_id === 'minimal' ? (
          <>
            <div className="absolute inset-0 bg-[#f8f0f2]" />
            <img src="/images/wisteria_top.png" alt="" className="absolute top-0 inset-x-0 w-full opacity-100 mix-blend-multiply object-cover" style={{ maxHeight: '250px', objectPosition: 'top center' }} />
            <img src="/images/eucalyptus_bottom.png" alt="" className="absolute bottom-0 inset-x-0 w-full opacity-100 mix-blend-multiply object-cover" style={{ maxHeight: '250px', objectPosition: 'bottom center' }} />
          </>`;
  content = content.replace(oldMinimal, newMinimal);
  return content;
});

// 3. confirmed/page.tsx
updateFile('app/[locale]/invite/[token]/confirmed/page.tsx', (content) => {
  const oldMinimal = `        ) : wedding.template_id === 'minimal' ? (
          <>
            <div className="absolute inset-0 bg-[#ffffff]" />
            <div className="absolute top-0 right-0 w-64 h-64 bg-purple-200/50 rounded-full blur-[70px] mix-blend-multiply" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-fuchsia-100/60 rounded-full blur-[70px] mix-blend-multiply" />
            <img src="/images/blush_floral_top.png" alt="" className="absolute top-0 inset-x-0 w-full opacity-90 mix-blend-multiply object-cover" style={{ filter: 'hue-rotate(280deg) saturate(1.3) brightness(0.95)', maxHeight: '250px', objectPosition: 'top center' }} />
            <img src="/images/blush_floral_bottom.png" alt="" className="absolute bottom-0 inset-x-0 w-full opacity-90 mix-blend-multiply object-cover" style={{ filter: 'hue-rotate(280deg) saturate(1.3) brightness(0.95)', maxHeight: '250px', objectPosition: 'bottom center' }} />
          </>`;
  const newMinimal = `        ) : wedding.template_id === 'minimal' ? (
          <>
            <div className="absolute inset-0 bg-[#f8f0f2]" />
            <img src="/images/wisteria_top.png" alt="" className="absolute top-0 inset-x-0 w-full opacity-100 mix-blend-multiply object-cover" style={{ maxHeight: '250px', objectPosition: 'top center' }} />
            <img src="/images/eucalyptus_bottom.png" alt="" className="absolute bottom-0 inset-x-0 w-full opacity-100 mix-blend-multiply object-cover" style={{ maxHeight: '250px', objectPosition: 'bottom center' }} />
          </>`;
  content = content.replace(oldMinimal, newMinimal);
  return content;
});

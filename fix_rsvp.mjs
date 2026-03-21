import fs from 'fs';
const path = 'app/[locale]/invite/[token]/rsvp/page.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Find the background block
const bgStartMatch = content.indexOf('{/* Dynamic Backgrounds based on Theme */}');
const bgEndStr = '        )}\\n      </div>';
const bgEndMatch = content.indexOf(bgEndStr, bgStartMatch);
if (bgStartMatch === -1 || bgEndMatch === -1) {
    console.log('Could not find background block');
    process.exit(1);
}

const bgBlock = content.substring(bgStartMatch, bgEndMatch + bgEndStr.length);
// Remove it from the original spot
content = content.replace(bgBlock, '');

// 2. Find main
const mainStr = '<main className={`flex-1 overflow-y-auto pb-32 ${wedding.template_id === \\'floral\\' ? \\'pt-40\\' : \\'pt-4\\'}`}>';
const mainReplacement = `<main className={\`relative flex-1 overflow-y-auto pb-32 \${wedding.template_id === 'floral' ? 'pt-[240px]' : 'pt-4'}\`}>

        {/* Dynamic Backgrounds based on Theme */}
        <div className="absolute inset-x-0 top-0 bottom-0 z-0 pointer-events-none">
          {wedding.template_id === 'floral' ? (
            <>
              <div className="absolute inset-0 bg-[#fffdfa]" />
              <img src="/images/blush_floral_top.png" alt="" className="absolute top-0 inset-x-0 w-full opacity-95 mix-blend-multiply object-cover" style={{ maxHeight: '300px', objectPosition: 'top center' }} />
              <img src="/images/blush_floral_bottom.png" alt="" className="absolute bottom-0 inset-x-0 w-full opacity-90 mix-blend-multiply object-cover" style={{ maxHeight: '350px', objectPosition: 'bottom center' }} />
            </>
          ) : wedding.template_id === 'royal' ? (
            <>
              <div className="absolute inset-0 bg-[#6e1616]" />
              <div className="absolute inset-x-4 inset-y-0 opacity-[0.03] mix-blend-color-burn" style={{ backgroundImage: 'repeating-linear-gradient(45deg, #000 25%, transparent 25%, transparent 75%, #000 75%, #000), repeating-linear-gradient(45deg, #000 25%, #6e1616 25%, #6e1616 75%, #000 75%, #000)', backgroundPosition: '0 0, 10px 10px', backgroundSize: '20px 20px' }} />
              <div className="absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-[#420a0a] to-transparent z-0" />
              <div className="absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-[#420a0a] to-transparent z-0" />
              <img src="/images/royal_top_lace.png" alt="" className="absolute top-0 inset-x-0 w-full opacity-40 mix-blend-multiply h-auto" style={{ maxHeight: '150px', objectPosition: 'top center' }} />
              <img src="/images/royal_bottom_lace.png" alt="" className="absolute bottom-0 inset-x-0 w-full opacity-40 mix-blend-multiply h-auto" style={{ maxHeight: '150px', objectPosition: 'bottom center' }} />
            </>
          ) : wedding.template_id === 'minimal' ? (
            <>
              <div className="absolute inset-0 bg-[#ffffff]" />
              <div className="absolute top-0 right-0 w-64 h-64 bg-purple-200/50 rounded-full blur-[70px] mix-blend-multiply" />
              <div className="absolute bottom-0 left-0 w-64 h-64 bg-fuchsia-100/60 rounded-full blur-[70px] mix-blend-multiply" />
              <img src="/images/blush_floral_top.png" alt="" className="absolute top-0 inset-x-0 w-full opacity-90 mix-blend-multiply object-cover" style={{ filter: 'hue-rotate(280deg) saturate(1.3) brightness(0.95)', maxHeight: '250px', objectPosition: 'top center' }} />
              <img src="/images/blush_floral_bottom.png" alt="" className="absolute bottom-0 inset-x-0 w-full opacity-90 mix-blend-multiply object-cover" style={{ filter: 'hue-rotate(280deg) saturate(1.3) brightness(0.95)', maxHeight: '250px', objectPosition: 'bottom center' }} />
            </>
          ) : wedding.template_id === 'dark' ? (
            <>
              {/* Inner Thin Gold Rectangular Broken Border */}
              <div className="absolute inset-0 pointer-events-none z-10">
                <div className="absolute top-[24px] left-[110px] right-[24px] h-[0.5px] bg-[#cfab68]/50 ring-0" />
                <div className="absolute top-[24px] bottom-[110px] right-[24px] w-[0.5px] bg-[#cfab68]/50 ring-0" />
                <div className="absolute bottom-[24px] left-[24px] right-[110px] h-[0.5px] bg-[#cfab68]/50 ring-0" />
                <div className="absolute top-[110px] bottom-[24px] left-[24px] w-[0.5px] bg-[#cfab68]/50 ring-0" />
              </div>
              
              {/* Intricate Hand-drawn Gold Vector Line Art Florals */}
              <div className="absolute top-0 left-0 z-20 pointer-events-none opacity-80 select-none overflow-hidden w-full h-full">
                 <svg viewBox="0 0 200 200" className="absolute top-[6px] left-[6px] w-[140px] h-[140px] stroke-[#cfab68] stroke-[0.8px] fill-transparent transform rotate-6">
                    <path d="M120,180 Q100,100 80,40" strokeLinecap="round" />
                    <path d="M120,180 Q130,120 160,80" strokeLinecap="round" />
                    <path d="M100,150 Q70,160 50,130 Q80,110 100,150 Z" />
                    <path d="M110,120 Q140,130 150,100 Q120,90 110,120 Z" />
                    <path d="M90,80 C60,90 20,60 50,20 C80,30 100,60 90,80 Z" />
                    <path d="M50,20 C30,30 30,60 50,50" />
                    <path d="M50,20 C70,30 70,60 50,50" />
                    <path d="M150,80 C180,90 190,40 160,20 C130,10 120,70 150,80 Z" />
                    <path d="M160,20 C140,30 140,60 160,50" />
                    <circle cx="85" cy="165" r="2" fill="#cfab68" />
                    <circle cx="100" cy="180" r="2" fill="#cfab68" />
                    <circle cx="140" cy="135" r="1.5" fill="#cfab68" />
                 </svg>
                 
                 <svg viewBox="0 0 200 200" className="absolute bottom-[6px] right-[6px] w-[150px] h-[150px] stroke-[#cfab68] stroke-[0.8px] fill-transparent transform origin-center rotate-[190deg]">
                    <path d="M120,180 Q100,100 80,40" strokeLinecap="round" />
                    <path d="M120,180 Q130,120 160,80" strokeLinecap="round" />
                    <path d="M100,150 Q70,160 50,130 Q80,110 100,150 Z" />
                    <path d="M110,120 Q140,130 150,100 Q120,90 110,120 Z" />
                    <path d="M90,80 C60,90 20,60 50,20 C80,30 100,60 90,80 Z" />
                    <path d="M50,20 C30,30 30,60 50,50" />
                    <path d="M50,20 C70,30 70,60 50,50" />
                    <path d="M150,80 C180,90 190,40 160,20 C130,10 120,70 150,80 Z" />
                    <path d="M160,20 C140,30 140,60 160,50" />
                    <circle cx="85" cy="165" r="2" fill="#cfab68" />
                    <circle cx="100" cy="180" r="2" fill="#cfab68" />
                    <circle cx="140" cy="135" r="1.5" fill="#cfab68" />
                 </svg>
              </div>
            </>
          ) : (
            <img src="/images/watercolor_bg.png" alt="background" className="w-full h-full object-cover opacity-40" />
          )}
        </div>
        
        <div className="relative z-10">`;

content = content.replace(mainStr, mainReplacement);

const endMainStr = '      </main>';
const endMainReplacement = '        </div>\n      </main>';
content = content.replace(endMainStr, endMainReplacement);

fs.writeFileSync(path, content, 'utf8');
console.log('Fixed RSVP page');

import fs from 'fs';

function fixFile(path) {
  let content = fs.readFileSync(path, 'utf8');

  // Change fixed to absolute for background container in Minimal (and in general if it uses fixed inset-0 z-0 pointer-events-none flex justify-center, wait, only specific minimal lines)
  
  if (path.includes('page.tsx') && !path.includes('rsvp') && !path.includes('confirmed')) {
    // page.tsx
    content = content.replace(
      `<div className="fixed inset-0 z-0 pointer-events-none flex justify-center">
            <div className="w-full max-w-[430px] relative h-full overflow-hidden bg-[#f8f0f2]">
               <img src="/images/wisteria_top.png" alt="" className="absolute top-0 inset-x-0 w-full opacity-100 mix-blend-multiply object-cover" style={{ maxHeight: '220px', objectPosition: 'top center' }} />
               <img src="/images/eucalyptus_bottom.png" alt="" className="absolute bottom-0 inset-x-0 w-full opacity-100 mix-blend-multiply object-cover" style={{ maxHeight: '220px', objectPosition: 'bottom center' }} />
            </div>
          </div>`,
      `<div className="absolute inset-x-0 top-0 bottom-0 z-0 pointer-events-none flex justify-center">
            <div className="w-full max-w-[430px] relative h-full overflow-hidden bg-[#f8f0f2]">
               <img src="/images/wisteria_top.png" alt="" className="absolute top-0 inset-x-0 w-full opacity-100 mix-blend-multiply object-contain object-top" />
               <img src="/images/eucalyptus_bottom.png" alt="" className="absolute bottom-0 inset-x-0 w-full opacity-100 mix-blend-multiply object-contain object-bottom" />
            </div>
          </div>`
    );
    // Add pt-[250px] or pt-[200px] instead of pt-[140px] if we need to push couple text completely below
    content = content.replace(
      `px-8 pt-[140px] pb-20`,
      `px-8 pt-[220px] pb-32`
    );
  }

  if (path.includes('confirmed/page.tsx')) {
    content = content.replace(
      `<div className="fixed inset-0 z-0 flex justify-center pointer-events-none">
          <div className="w-full max-w-[430px] relative h-full">`,
      `<div className="absolute inset-x-0 top-0 bottom-0 z-0 flex justify-center pointer-events-none">
          <div className="w-full max-w-[430px] relative h-full">`
    );
    content = content.replace(
      `<img src="/images/wisteria_top.png" alt="" className="absolute top-0 inset-x-0 w-full opacity-100 mix-blend-multiply object-cover" style={{ maxHeight: '220px', objectPosition: 'top center' }} />`,
      `<img src="/images/wisteria_top.png" alt="" className="absolute top-0 inset-x-0 w-full opacity-100 mix-blend-multiply object-contain object-top" />`
    );
    content = content.replace(
      `<img src="/images/eucalyptus_bottom.png" alt="" className="absolute bottom-0 inset-x-0 w-full opacity-100 mix-blend-multiply object-cover" style={{ maxHeight: '220px', objectPosition: 'bottom center' }} />`,
      `<img src="/images/eucalyptus_bottom.png" alt="" className="absolute bottom-0 inset-x-0 w-full opacity-100 mix-blend-multiply object-contain object-bottom" />`
    );
  }

  if (path.includes('rsvp/page.tsx')) {
    content = content.replace(
      `<img src="/images/wisteria_top.png" alt="" className="absolute top-0 inset-x-0 w-full opacity-100 mix-blend-multiply object-cover" style={{ maxHeight: '250px', objectPosition: 'top center' }} />`,
      `<img src="/images/wisteria_top.png" alt="" className="absolute top-0 inset-x-0 w-full opacity-100 mix-blend-multiply object-contain object-top" />`
    );
    content = content.replace(
      `<img src="/images/eucalyptus_bottom.png" alt="" className="absolute bottom-0 inset-x-0 w-full opacity-100 mix-blend-multiply object-cover" style={{ maxHeight: '250px', objectPosition: 'bottom center' }} />`,
      `<img src="/images/eucalyptus_bottom.png" alt="" className="absolute bottom-0 inset-x-0 w-full opacity-100 mix-blend-multiply object-contain object-bottom" />`
    );
  }

  fs.writeFileSync(path, content, 'utf8');
}

fixFile('app/[locale]/invite/[token]/page.tsx');
fixFile('app/[locale]/invite/[token]/confirmed/page.tsx');
fixFile('app/[locale]/invite/[token]/rsvp/page.tsx');
console.log('Done fixing flowers');

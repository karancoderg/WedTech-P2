import fs from 'fs';

// --- RSVP PAGE ---
let content = fs.readFileSync('app/[locale]/invite/[token]/rsvp/page.tsx', 'utf8');

content = content.replace(
  /\$\{wedding\.template_id === 'floral' \? 'absolute/g,
  "${(wedding.template_id === 'floral' || wedding.template_id === 'minimal') ? 'absolute"
);
content = content.replace(
  /\$\{wedding\.template_id === 'floral' \? 'bg-\[\#fffdfa\]\\/60/g,
  "${(wedding.template_id === 'floral' || wedding.template_id === 'minimal') ? 'bg-[#fffdfa]/60"
);
content = content.replace(
  /\{wedding\.template_id !== 'floral' && \(/g,
  "{(wedding.template_id !== 'floral' && wedding.template_id !== 'minimal') && ("
);

content = content.replace(
  /\{wedding\.template_id === 'floral' \? 'pt-\[220px\] pb-\[380px\]' : 'pt-4 pb-32'\}/g,
  "{(wedding.template_id === 'floral' || wedding.template_id === 'minimal') ? 'pt-[220px] pb-[380px]' : 'pt-4 pb-32'}"
);

const floralNamesStr = `{wedding.template_id === 'floral' && (`;
const minimalNamesToAdd = `{wedding.template_id === 'minimal' && (
          <div className="flex flex-col items-center mb-10 text-center animate-fade-in relative z-20">
            <h1 className={\`\${greatVibes.className} text-7xl text-[#4a2e6b] leading-[1.1] pt-2\`}>
              {wedding.bride_name}
            </h1>
            <span className={\`\${greatVibes.className} text-4xl text-[#2a173d]\`}>&amp;</span>
            <h1 className={\`\${greatVibes.className} text-7xl text-[#4a2e6b] leading-[1] mb-4 pb-2\`}>
              {wedding.groom_name}
            </h1>
          </div>
        )}\n        `;
content = content.replace(floralNamesStr, minimalNamesToAdd + floralNamesStr);

content = content.replace(
  /\$\{wedding\.template_id === 'floral' \? 'bg-transparent pointer-events-none pb-8' :/g,
  "${(wedding.template_id === 'floral' || wedding.template_id === 'minimal') ? 'bg-transparent pointer-events-none pb-8' :"
);

fs.writeFileSync('app/[locale]/invite/[token]/rsvp/page.tsx', content, 'utf8');

// --- CONFIRMED PAGE ---
let confContent = fs.readFileSync('app/[locale]/invite/[token]/confirmed/page.tsx', 'utf8');

confContent = confContent.replace(
  /wedding\.template_id === 'floral' \? 'pt-40'/g,
  "(wedding.template_id === 'floral' || wedding.template_id === 'minimal') ? 'pt-40'"
);

fs.writeFileSync('app/[locale]/invite/[token]/confirmed/page.tsx', confContent, 'utf8');

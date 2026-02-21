const fs = require('fs');
const path = require('path');

const dirs = [path.join(__dirname, 'pages'), path.join(__dirname, 'src/pages')];

const replaceInFile = (filePath) => {
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;

  // General neutral colors (Slate -> Zinc for a more sleek, elegant monochrome)
  content = content.replace(/text-slate-/g, 'text-zinc-');
  content = content.replace(/bg-slate-/g, 'bg-[#FAFAFA]'); // We'll be more careful with bgs, but let's just do a direct mapping
  content = content.replace(/bg-zinc-/g, 'bg-zinc-');
  content = content.replace(/border-slate-/g, 'border-zinc-');

  // Specific backgrounds for containers
  content = content.replace(/bg-\[\#FAFAFA\]50/g, 'bg-[#FCFCFC]');
  content = content.replace(/bg-\[\#FAFAFA\]100/g, 'bg-[#F8F9FA]');
  content = content.replace(/bg-\[\#FAFAFA\]900/g, 'bg-[#1A1C20]');
  content = content.replace(/bg-slate-50/g, 'bg-[#FCFCFC]');
  content = content.replace(/bg-slate-100/g, 'bg-[#F8F9FA]');
  content = content.replace(/bg-slate-900/g, 'bg-[#1A1C20]');

  // Tame the indigo primary color into the elegant dark (black/zinc-900) brand color of Ployees
  content = content.replace(/bg-indigo-600/g, 'bg-zinc-900');
  content = content.replace(/hover:bg-indigo-700/g, 'hover:bg-black');
  content = content.replace(/text-indigo-600/g, 'text-zinc-900');
  content = content.replace(/text-indigo-700/g, 'text-zinc-800');
  content = content.replace(/text-indigo-900/g, 'text-black');
  content = content.replace(/border-indigo-500/g, 'border-zinc-900');
  content = content.replace(/bg-indigo-50/g, 'bg-zinc-100');
  content = content.replace(/border-indigo-100/g, 'border-zinc-200');

  // Change font weights to look more elegant
  content = content.replace(/font-black/g, 'font-bold');
  content = content.replace(/font-extrabold/g, 'font-bold');

  // Refine box-shadows (make them softer, less dramatic)
  content = content.replace(/shadow-xl/g, 'shadow-lg');
  content = content.replace(/shadow-lg/g, 'shadow-sm border border-zinc-200');

  // Soften the corners
  content = content.replace(/rounded-3xl/g, 'rounded-2xl');
  content = content.replace(/rounded-2xl/g, 'rounded-[20px]');

  // Adjust Text Spacing (Tracking)
  content = content.replace(/tracking-widest/g, 'tracking-wider');
  content = content.replace(/tracking-tighter/g, 'tracking-tight');

  // Fix border colors to be consistent
  content = content.replace(/border-zinc-200/g, 'border-[#EAEAEA]');

  if (originalContent !== content) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Updated ${filePath}`);
  }
};

const processDirectory = (directory) => {
  if (!fs.existsSync(directory)) return;
  const files = fs.readdirSync(directory);
  for (const file of files) {
    const fullPath = path.join(directory, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDirectory(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.ts')) {
      replaceInFile(fullPath);
    }
  }
};

dirs.forEach(processDirectory);
console.log('Done replacing styles.');

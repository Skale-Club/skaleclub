import fs from 'fs';

const filePath = 'c:\\Users\\Vanildo\\Dev\\skaleclub\\client\\src\\components\\layout\\Navbar.tsx';
let content = fs.readFileSync(filePath, 'utf8');

const phoneLinkRegex = /\{\s*displayPhone && \(\s*<a href=\{`tel:\$\{telPhone\}`\} className="px-4 py-2 bg-\[#406EF1\] hover:bg-\[#355CD0\] text-white font-bold rounded-full hover-elevate transition-all text-sm flex items-center gap-2">\s*<Phone className="w-4 h-4 fill-current" \/>\s*\{displayPhone\}\s*<\/a>\s*\)\s*\}/;

content = content.replace(phoneLinkRegex, "{/* Language Toggle */}\n            <LanguageToggle />");

fs.writeFileSync(filePath, content, 'utf8');
console.log("Done");

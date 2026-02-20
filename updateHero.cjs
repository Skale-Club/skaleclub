const fs = require('fs');
const file = 'client/src/components/admin/HeroSettingsSection.tsx';
let content = fs.readFileSync(file, 'utf8');

// translations
content = content.replace('Seção Quem Somos', 'About Us Section');
content = content.replace('<Label>Título</Label>', '<Label>Title</Label>');
content = content.replace('<Label>Descrição</Label>', '<Label>Description</Label>');
content = content.replace('<Label>Imagem de Quem Somos</Label>', '<Label>About Us Image</Label>');
content = content.replace('<p className="text-xs text-muted-foreground">Imagem da Seção</p>', '<p className="text-xs text-muted-foreground">Section Image</p>');

// remove the photo url input field
const regex = /<div className="relative max-w-md">[\s\S]*?<Input\s+value={aboutImageUrl}[\s\S]*?onChange={\(e\) => {[\s\S]*?setAboutImageUrl\(e\.target\.value\);[\s\S]*?triggerAutoSave\({ aboutImageUrl: e\.target\.value }, \['aboutImageUrl'\]\);[\s\S]*?}}[\s\S]*?placeholder="Ou cole a URL da imagem \(https:\/\/...\)"[\s\S]*?data-testid="input-about-image"\s+\/>[\s\S]*?<SavedIndicator field="aboutImageUrl" \/>[\s\S]*?<\/div>/;
content = content.replace(regex, '');

fs.writeFileSync(file, content);
console.log('done');

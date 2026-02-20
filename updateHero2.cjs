const fs = require('fs');
const file = 'client/src/components/admin/HeroSettingsSection.tsx';
let content = fs.readFileSync(file, 'utf8');

const replacements = [
    ['Consultoria - Como Funciona', 'Consulting - How It Works'],
    ['Edite o passo a passo exibido na landing.', 'Edit the step-by-step displayed on the landing page.'],
    ['<Label>Título</Label>', '<Label>Title</Label>'],
    ['<Label>Subtítulo</Label>', '<Label>Subtitle</Label>'],
    ['Slug/ID da seção', 'Section Slug/ID'],
    ['placeholder="como-funciona"', 'placeholder="how-it-works"'],
    ['Texto auxiliar (opcional)', 'Helper Text (optional)'],
    ['Texto curto abaixo do CTA', 'Short text below CTA'],
    ['CTA - Texto do botão', 'CTA - Button Text'],
    ['CTA - Link/ação', 'CTA - Link/Action'],
    ['Sem bullets cadastrados.', 'No bullets registered.'],
    ['Etapas (cards)', 'Stages (cards)'],
    ['Reordene pelas setas ou ajustando o campo Ordem.', 'Reorder using the arrows or adjusting the Order field.'],
    ["|| 'Etapa'", "|| 'Stage'"],
    ['Ordem {step.order ?? index + 1}', 'Order {step.order ?? index + 1}'],
    ['<Label>Ordem</Label>', '<Label>Order</Label>'],
    ['<Label>O que fazemos</Label>', '<Label>What we do</Label>'],
    ['<Label>Você sai com</Label>', '<Label>You leave with</Label>'],
    ['Nenhuma etapa cadastrada.', 'No stages registered.'],
    ["title: 'Nova Etapa'", "title: 'New Stage'"]
];

replacements.forEach(([pt, en]) => {
    content = content.split(pt).join(en);
});

fs.writeFileSync(file, content);
console.log('Done translations');

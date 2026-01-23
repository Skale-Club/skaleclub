# Design System - Skale Club Admin

Sistema de design unificado com suporte completo a light/dark mode.

---

## Cores

### Light Mode

#### Brand Colors
- **Primary Blue**: `#1C53A3` (215 71% 37%)
- **Brand Yellow**: `#FFFF01` (60 100% 50%)

#### Backgrounds
- **Background**: `#FFFFFF` - Background principal
- **Card**: `#FFFFFF` - Fundo de cards
- **Section**: `#F8FAFC` (slate-50) - Fundo de seções agrupadas
- **Muted**: `#F1F5F9` (slate-100) - Backgrounds secundários
- **Sidebar**: `#FFFFFF` - Fundo da sidebar

#### Text
- **Foreground**: `#1D1D1D` - Texto principal
- **Muted Foreground**: `#64748B` - Texto secundário

#### Status
- **Success**: `#059669` (142 76% 36%) - Verde para ações bem-sucedidas
- **Warning**: `#F59E0B` (38 92% 50%) - Amarelo para avisos
- **Destructive**: `#DC2626` (0 84% 60%) - Vermelho para ações destrutivas

#### UI Elements
- **Border**: `#E2E8F0` - Bordas padrão
- **Input**: `#E2E8F0` - Background de inputs

---

### Dark Mode

#### Brand Colors
- **Primary Blue**: `#3B82F6` (217 91% 60%) - Azul mais claro para contraste
- **Brand Yellow**: `#FFFF01` (60 100% 50%) - Mantém o amarelo

#### Backgrounds
- **Background**: `#0F172A` (slate-900) - Background principal
- **Card**: `#1E293B` (slate-800) - Fundo de cards
- **Section**: `#0F172A` (slate-900) - Fundo de seções
- **Muted**: `#1E293B` (slate-800) - Backgrounds secundários
- **Sidebar**: `#1E293B` (slate-800) - Fundo da sidebar

#### Text
- **Foreground**: `#F1F5F9` (slate-50) - Texto principal
- **Muted Foreground**: `#94A3B8` (slate-400) - Texto secundário

#### Status
- **Success**: `#10B981` (142 71% 45%) - Verde ajustado para dark mode
- **Warning**: `#F59E0B` (38 92% 50%) - Mantém o amarelo
- **Destructive**: `#EF4444` (0 62% 50%) - Vermelho ajustado

#### UI Elements
- **Border**: `#334155` (slate-700) - Bordas padrão
- **Input**: `#1E293B` (slate-800) - Background de inputs

---

## Tipografia

### Fontes
- **Display/Headings**: `Outfit` - Títulos e headings
- **Body**: `Inter` - Texto do corpo

### Escala
- **H1**: 2rem (32px) - `text-2xl font-bold`
- **H2**: 1.5rem (24px) - `text-xl font-semibold`
- **H3**: 1.25rem (20px) - `text-lg font-semibold`
- **Body**: 0.875rem (14px) - `text-sm`
- **Small**: 0.75rem (12px) - `text-xs`

---

## Espaçamento

### Padrões
- **Padding de Cards**: `p-6` (24px)
- **Padding de Sections**: `p-6` (24px)
- **Spacing entre elementos**: `space-y-4` (16px)
- **Spacing em forms**: `space-y-4` (16px)
- **Gap em grids**: `gap-4` (16px)

---

## Classes Utilitárias

### Cards
```css
.admin-card
/* bg-card text-card-foreground rounded-lg border border-border p-6 */
```

Uso:
```jsx
<div className="admin-card">Conteúdo do card</div>
```

### Sections
```css
.admin-section
/* bg-muted rounded-lg p-6 space-y-4 */
```

Uso:
```jsx
<div className="admin-section">
  <h2>Título da Seção</h2>
  {/* conteúdo */}
</div>
```

### Forms

#### Form Group
```css
.admin-form-group
/* space-y-4 */
```

#### Form Field
```css
.admin-form-field
/* space-y-2 */
```

#### Form Grid (2 colunas)
```css
.admin-form-grid
/* grid gap-4 sm:grid-cols-2 */
```

Exemplo:
```jsx
<form className="admin-form-group">
  <div className="admin-form-grid">
    <div className="admin-form-field">
      <Label>Nome</Label>
      <Input />
    </div>
    <div className="admin-form-field">
      <Label>Email</Label>
      <Input />
    </div>
  </div>
</form>
```

### Page Headers
```css
.admin-page-header  /* mb-6 */
.admin-page-title   /* text-2xl font-bold text-foreground */
.admin-page-subtitle /* text-muted-foreground mt-1 */
```

Exemplo:
```jsx
<div className="admin-page-header">
  <h1 className="admin-page-title">Dashboard</h1>
  <p className="admin-page-subtitle">Visão geral do sistema</p>
</div>
```

### Stat Cards
```css
.admin-stat-card
/* bg-card rounded-lg p-6 border border-border */
```

### Actions
```css
.admin-actions
/* flex items-center gap-2 */
```

Exemplo:
```jsx
<div className="admin-actions">
  <Button variant="outline" size="sm">Editar</Button>
  <Button variant="destructive" size="sm">Deletar</Button>
</div>
```

### Badges de Status
```css
.admin-badge-success   /* bg-success/10 text-success border-success/20 */
.admin-badge-warning   /* bg-warning/10 text-warning border-warning/20 */
.admin-badge-error     /* bg-destructive/10 text-destructive border-destructive/20 */
```

---

## Componentes

### Button

Variantes:
- `default` - Azul primário
- `destructive` - Vermelho destrutivo
- `outline` - Borda com fundo transparente
- `secondary` - Amarelo marca
- `ghost` - Sem borda ou fundo

Tamanhos:
- `sm` - Pequeno (32px)
- `default` - Padrão (36px)
- `lg` - Grande (40px)
- `icon` - Quadrado (36px)

```jsx
<Button variant="default" size="default">Salvar</Button>
<Button variant="destructive" size="sm">Deletar</Button>
<Button variant="outline">Cancelar</Button>
```

### Badge

Variantes:
- `default` - Azul primário
- `secondary` - Amarelo marca
- `destructive` - Vermelho destrutivo
- `success` - Verde de sucesso ✨ Novo
- `warning` - Amarelo de aviso ✨ Novo
- `outline` - Borda com fundo transparente

```jsx
<Badge variant="success">Ativo</Badge>
<Badge variant="warning">Pendente</Badge>
<Badge variant="destructive">Cancelado</Badge>
```

### Input / Textarea / Select

Todos os inputs seguem o mesmo padrão:
- `bg-background` - Fundo adaptável ao tema
- `border-input` - Borda adaptável
- `text-foreground` - Texto adaptável
- `placeholder:text-muted-foreground` - Placeholder secundário

```jsx
<Input placeholder="Digite aqui..." />
<Textarea placeholder="Descrição..." />
<Select>
  <SelectTrigger>
    <SelectValue placeholder="Selecione..." />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="1">Opção 1</SelectItem>
  </SelectContent>
</Select>
```

### Card

```jsx
<Card>
  <CardHeader>
    <CardTitle>Título</CardTitle>
    <CardDescription>Descrição opcional</CardDescription>
  </CardHeader>
  <CardContent>
    {/* Conteúdo */}
  </CardContent>
  <CardFooter>
    {/* Ações */}
  </CardFooter>
</Card>
```

### Dialog / AlertDialog

```jsx
<Dialog>
  <DialogTrigger asChild>
    <Button>Abrir</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Título</DialogTitle>
    </DialogHeader>
    {/* Conteúdo */}
    <DialogFooter>
      <Button variant="outline">Cancelar</Button>
      <Button>Confirmar</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>

<AlertDialog>
  <AlertDialogTrigger asChild>
    <Button variant="destructive">Deletar</Button>
  </AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
      <AlertDialogDescription>
        Esta ação não pode ser desfeita.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Cancelar</AlertDialogCancel>
      <AlertDialogAction variant="destructive">Deletar</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

---

## Border Radius

- `rounded-sm` - 3px
- `rounded-md` - 6px
- `rounded-lg` - 9px
- `rounded-xl` - 12px
- `rounded-full` - Círculo/Pill

---

## Theme Toggle

O sistema inclui um componente `ThemeToggle` com 3 variantes:

### Icon (padrão)
```jsx
<ThemeToggle variant="icon" />
```

### Switch com labels
```jsx
<ThemeToggle variant="switch" />
```

### Dropdown com opções (light/dark/system)
```jsx
<ThemeToggle variant="dropdown" />
```

---

## Uso do Hook

```jsx
import { useTheme } from '@/context/ThemeContext';

function MyComponent() {
  const { theme, resolvedTheme, setTheme, toggleTheme } = useTheme();

  // theme: 'light' | 'dark' | 'system'
  // resolvedTheme: 'light' | 'dark' (sem 'system')

  return (
    <div>
      <p>Tema atual: {resolvedTheme}</p>
      <button onClick={toggleTheme}>Alternar tema</button>
      <button onClick={() => setTheme('dark')}>Modo escuro</button>
    </div>
  );
}
```

---

## Variáveis CSS Customizadas

Todas as cores do sistema estão disponíveis como variáveis CSS:

```css
/* Usar em arquivos CSS */
.custom-element {
  background: hsl(var(--card));
  color: hsl(var(--card-foreground));
  border: 1px solid hsl(var(--border));
}
```

```jsx
/* Ou via Tailwind */
<div className="bg-card text-card-foreground border border-border">
  Conteúdo
</div>
```

---

## Transições

Todos os elementos que mudam de cor com o tema incluem transições suaves:

```css
transition: background-color 0.2s ease-in-out, color 0.2s ease-in-out;
```

Aplique com: `transition-colors duration-200`

---

## Boas Práticas

### ✅ Fazer
- Usar variáveis de tema (`bg-card`, `text-foreground`, etc.)
- Usar classes utilitárias `admin-*` para consistência
- Aplicar transições em elementos que mudam com o tema
- Testar UI em ambos os temas antes de fazer commit

### ❌ Evitar
- Cores hardcoded (`bg-white`, `bg-slate-100`, etc.)
- Ignorar o modo escuro em novos componentes
- Criar variações de espaçamento fora do padrão
- Remover focus states (acessibilidade)

---

## Checklist para Novos Componentes

- [ ] Usa variáveis de tema para cores
- [ ] Testado em light e dark mode
- [ ] Inclui transições suaves
- [ ] Segue padrões de espaçamento
- [ ] Responsivo (mobile/tablet/desktop)
- [ ] Acessível (keyboard navigation, ARIA labels)

---

**Atualizado**: Janeiro 2026

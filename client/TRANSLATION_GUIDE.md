# Sistema de Tradução - Guia de Uso

## Visão Geral

O sistema de tradução foi implementado com suporte para Inglês (padrão) e Português. O conteúdo no banco de dados deve ser cadastrado em **inglês**, e a tradução para português acontece dinamicamente no frontend.

## Como Usar

### 1. Importar o Hook

```tsx
import { useTranslation } from '@/hooks/useTranslation';
```

### 2. Usar no Componente

```tsx
function MyComponent() {
  const { t, language, setLanguage } = useTranslation();

  return (
    <div>
      <h1>{t("Welcome")}</h1>
      <button onClick={() => setLanguage('pt')}>
        {t("Change to Portuguese")}
      </button>
    </div>
  );
}
```

### 3. Função `t()`

A função `t()` traduz automaticamente strings:
- Se o idioma for Inglês: retorna o texto original
- Se o idioma for Português: retorna a tradução do arquivo `translations.ts`
- Se não houver tradução: retorna o texto original em inglês

## Adicionar Novas Traduções

Edite o arquivo `client/src/lib/translations.ts`:

```typescript
export const translations = {
  pt: {
    // Adicione suas traduções aqui
    'My New Text': 'Meu Novo Texto',
    'Another phrase': 'Outra frase',
    // ...
  }
}
```

## Seletor de Idioma

O seletor de idioma está disponível no Navbar:
- **Desktop**: Bandeirinhas 🇺🇸 🇧🇷 no canto superior direito
- **Mobile**: Botões com bandeiras e texto no menu hamburguer

## Persistência

O idioma selecionado é salvo no `localStorage` e mantido entre sessões.

## Exemplo Completo

```tsx
import { useTranslation } from '@/hooks/useTranslation';
import { Button } from '@/components/ui/button';

export function ContactForm() {
  const { t } = useTranslation();

  return (
    <form>
      <h2>{t("Contact Us")}</h2>
      
      <label>{t("Name")}</label>
      <input placeholder={t("Enter your name")} />
      
      <label>{t("Email")}</label>
      <input placeholder={t("Enter your email")} />
      
      <label>{t("Message")}</label>
      <textarea placeholder={t("Type your message")} />
      
      <Button>{t("Submit")}</Button>
    </form>
  );
}
```

## Estrutura de Arquivos

```
client/src/
├── context/
│   └── LanguageContext.tsx    # Contexto de idioma
├── hooks/
│   └── useTranslation.ts      # Hook customizado
└── lib/
    └── translations.ts         # Dicionário de traduções
```

## Notas Importantes

1. **Sempre use inglês** como texto padrão nas chamadas `t()`
2. **Mantenha consistência** nos textos para facilitar traduções
3. **Adicione traduções** para todos os textos visíveis ao usuário
4. **Teste ambos os idiomas** após adicionar novos recursos

# Contract CRM — Pacote pronto para deploy (testado)

## O que mudou nesta versão
Este pacote já é um projeto Next.js **completo e funcional** — não é mais só
os arquivos de código soltos. Eu gerei o projeto de verdade (com
`create-next-app`), colei nosso código dentro, instalei todas as
dependências e **rodei o build real várias vezes até compilar sem erros**.
Isso significa que você não precisa instalar Node.js nem rodar nenhum
comando no seu computador — só subir isto no GitHub.

## Erros reais que encontrei e corrigi ao testar
Para ser transparente sobre o que foi verificado de verdade (não suposição):

1. **`middleware.ts` → `proxy.ts`**: o Next.js 16 renomeou essa convenção.
   O arquivo já está corrigido (`src/proxy.ts`).
2. **Next.js 16.2.9 + React 19.2.4**: confirmei rodando `npm install` de
   verdade. O `useActionState` que uso no código é nativo do React 19 (não é
   mais experimental), e `params`/`searchParams` como `Promise` é o padrão
   nessa versão — as duas dúvidas que eu tinha antes se confirmaram corretas.
3. **Tailwind CSS v4**: essa versão do `create-next-app` já vem com Tailwind
   v4 (sem `tailwind.config.js`). As classes que usei no código são
   compatíveis.
4. Corrigi 3 erros reais de TypeScript que só apareceram ao compilar de
   verdade (tipagem de status, formatação do gráfico, e o formato real do
   "embedding" de relacionamentos do Supabase — que vem como array, não como
   objeto único, diferente do que eu tinha assumido).
5. Troquei a fonte do Google (Geist) por uma fonte de sistema — não porque
   desse erro real no seu ambiente de deploy (na Vercel funcionaria
   normalmente), mas para reduzir uma dependência de rede a menos no
   processo de build.

## O que eu NÃO consegui testar
Não tenho acesso a um projeto Supabase real com dados, então não testei:
- Login/cadastro de usuário de verdade
- Se as políticas de RLS (que estão só como esboço comentado no
  `schema.sql`) realmente protegem os dados como deveriam
- O comportamento visual em um navegador de verdade

## Como subir para o GitHub (sem instalar nada)

1. Extraia este `.zip` no seu computador
2. Acesse **github.com** → **New repository** → dê um nome (ex:
   `contract-crm`) → **não** marque para criar README (você já tem um) →
   Create repository
3. Na tela do repositório recém-criado, clique em **"uploading an existing
   file"** (ou vá em **Add file → Upload files**)
4. Arraste **todo o conteúdo de dentro da pasta** `contract-crm-full`
   (não a pasta em si — o conteúdo dela: `src`, `supabase`, `public`,
   `package.json`, etc.) para a área de upload
5. Role para baixo, escreva uma mensagem tipo "Checkpoint inicial testado"
   e clique em **Commit changes**

⚠️ **Não suba o `.env.local`** (se você tiver criado um) — ele não deveria
nem aparecer na lista de upload, porque o `.gitignore` já está configurado
para isso, mas confira visualmente antes de confirmar o upload.

## Como conectar na Vercel

1. **vercel.com/new** → Import Git Repository → selecione o repositório
   que você acabou de criar
2. A Vercel detecta Next.js automaticamente — não precisa mexer em nada
3. **Antes de clicar em Deploy**, adicione as variáveis de ambiente
   (Environment Variables): as mesmas três do `.env.example`
   (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`)
4. Clique em **Deploy**

Se o deploy falhar, vá em **Deployments** no painel da Vercel, clique no
deploy que falhou, e me cole o log de erro — com isso eu consigo corrigir
com precisão.

## Pendências reais (não testadas, cuidado ao usar em produção)
- Políticas de RLS ainda são só esboço — sem elas ativas de verdade,
  qualquer usuário autenticado pode acessar/editar dados de outros
- Sem testes automatizados
- O modelo de dados ainda reflete "funil comercial" nos dados de exemplo do
  `schema.sql`, não o cenário real de renovação de contratos que você
  descreveu — combinado para ajustar depois que a base estiver rodando

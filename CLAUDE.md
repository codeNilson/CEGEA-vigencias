# CLAUDE.md

Guia para agentes (Claude Code e similares) trabalharem neste repositório.

## O que é

Vigências: sistema da Célula de Gestão Administrativa da SEINF (Prefeitura de Fortaleza) para acompanhar a vigência de ARPs (Atas de Registro de Preços da SEPOG) e contratos, com saldos, aditivos e OF/OS. O objetivo central é não perder prazo de renovação.

O produto entregue é **um único arquivo HTML** (`dist/Vigencias.html`) que fica numa pasta de rede e é aberto no Google Chrome. Não há servidor, login nem internet. Os dados são arquivos JSON numa subpasta `dados/` ao lado do HTML, lidos e gravados pela File System Access API. Usam 3 ou 4 pessoas ao mesmo tempo, e há uma TV com o visor ligado o dia todo.

Documentos de referência, em português:
- `docs/requisitos.md`: requisitos funcionais (RFxx) com critérios de aceite (CAxx.y) e fora do escopo. É a fonte da verdade sobre comportamento.
- `docs/design.md`: arquitetura, modelo de dados e decisões técnicas (Dxx).
- `CHANGELOG.md`: o que mudou em cada revisão.

## Comandos

```
npm install
npm run dev        # Vite, abre /index.html?demo (dados fictícios em memória)
npm test           # Vitest
npm run typecheck  # tsc --noEmit
npm run build      # typecheck + build + renomeia dist/index.html para dist/Vigencias.html
```

Antes de dar uma tarefa por concluída: `npm run typecheck && npm test && npm run build`. Mudança de interface: conferir no navegador com `?demo` (ver "Conferir no navegador").

## Arquitetura

```
src/dominio/        regras puras, sem React nem I/O. Toda regra de negócio fica aqui.
  tipos.ts          schemas zod (formato dos arquivos) e tipos derivados
  calculos.ts       vigência, situação, faixa de prazo, saldos, valores, reequilíbrio
  validacoes.ts     validação de cadastro (devolve lista de mensagens em português)
  mesclagem.ts      mesclagem em três vias para edição concorrente
  texto.ts          busca sem acento, ordenação NÚMERO/ANO, nomes parecidos, CNPJ, objeto da ARP
  numeros.ts        inteiros escalados, formatação pt-BR, máscara de moeda
  datas.ts, feriados.ts, prazos.ts, dependencias.ts, fabrica.ts
src/armazenamento/  Repositorio: PastaRede (File System Access API) e Memoria (testes e demo)
src/estado/         loja Zustand (carregar, salvar com versão e mesclagem, excluir), seletores, demo
src/exportacao/     planilhas .xlsx (SheetJS). PDF é a impressão do Chrome (CSS @media print)
src/ui/             React: App (rotas por hash), telas/, componentes/, estilos.css, preferencias.ts
```

Fluxo de gravação: tela monta o registro inteiro, chama `gravar(reg, validar)` (em `src/ui/contexto.ts`), que chama `loja.salvar`. A loja confere a versão no disco; se outro usuário gravou antes, faz a mesclagem em três vias e, havendo conflito, abre a tela de conflito. Nunca grave arquivo fora desse caminho.

## Regras do domínio que não podem quebrar

- **Números escalados, nunca float.** Quantidade = inteiro × 1000. Valor unitário = inteiro × 10000. Total em centavos via `totalCentavos` (BigInt). Use `lerQuantidade`, `lerValor`, `textoQuantidade`, `textoValor`, `formatarCentavos`. Não faça conta com `Number` decimal.
- **Datas são texto `AAAA-MM-DD`**, sem hora nem fuso. Compare como string. Use `src/dominio/datas.ts`; não use `new Date()` para lógica de negócio (só `hojeISO()`).
- **Valores derivados nunca são gravados.** Saldo, situação, vencimento vigente, valor em vigor: tudo calculado em `calculos.ts`.
- **Situação e prazo são coisas separadas.** `Situacao` = vigente | vencido | encerrado. `FaixaPrazo` = critico (até 30 dias) | atencao (até 90) | normal. Não reintroduza "a vencer" como situação.
- **Só a quantidade original do item do contrato consome saldo da ARP** (D02).
- **Reequilíbrio da ARP só vale para contratos novos.** Item de contrato copia `valorParcelaEm(ata, parcela, contrato.dataInicio)` no vínculo. Contratos existentes recebem só um aviso.
- **ARP não tem data de início obrigatória** (`dataInicio` pode ser ""). Contrato tem.
- **Objeto da ARP**: o campo no arquivo se chama `tema`; na interface é "Objeto", em maiúsculas (`objetoAta`, `formatarObjetoAta`).

## Formato dos arquivos e compatibilidade

Os usuários já têm dados reais na pasta de rede. Toda mudança de schema precisa ler os arquivos antigos sem erro e sem migração:
- Campo novo: `.default(...)` no schema zod. Exemplos: `email`, `telefone`, `inicioEfeitos`, `valores`.
- Não renomeie nem remova campos gravados. Para mudar o nome na tela, mude só o rótulo.
- Não aumente `FORMATO_ATUAL` sem plano de migração aprovado.
- Escreva um teste com um objeto no formato antigo passando por `validarArquivo` (há exemplos em `src/exportacao/planilha.test.ts` e `src/dominio/revisao5.test.ts`).
- Ao adicionar campo, atualize também `src/ui/componentes/Conflito.tsx` (rótulos), `src/estado/demo.ts` e a exportação completa em `src/exportacao/planilha.ts`, se fizer sentido.

## Restrições técnicas

- Saída em arquivo único (`vite-plugin-singlefile`). Nada de CDN, fonte externa, `fetch` para a internet ou import dinâmico que gere outro arquivo.
- Só Chrome desktop (File System Access API). Não precisa de compatibilidade com outros navegadores.
- Sem servidor, sem e-mail, sem notificações fora da tela (fora do escopo, ver `docs/requisitos.md` seção 6).
- `localStorage` só para preferência por computador (`usePreferencia`); dado compartilhado vai para a pasta.
- O visor de TV (`src/ui/telas/Visor.tsx`) usa unidades `vh` e não pode ter conteúdo cortado em 1366x768 nem em 1920x1080.

## Interface e textos

- Todo texto de interface, mensagem de erro, comentário de domínio e documentação em **português do Brasil**. Datas dd/mm/aaaa, valores "R$ 1.234,56".
- Terminologia: "ARP" (nunca "SRP" nem "ata" na interface), "OF/OS", "Vigente/Vencido/Encerrado" ("Vencida" para ARP). Colunas com nomes claros: "Quantidade contratada", "Já solicitada em OF/OS", "Saldo disponível".
- Textos sem travessão (—). Tom direto.
- Identidade visual da PMF (manual 2025-2028): use as variáveis de cor de `src/ui/estilos.css` (`--laranja`, `--verde`, `--azul`, `--creme`, `--petroleo`, `--grafite`). Fonte Raleway com algarismos tabulares. Não reproduza o brasão.
- Campos de valor em R$: `EntradaMoeda`. Quantidade: `EntradaQuantidade`. Empresa: `EscolhaEmpresa` (nunca `<select>` com todas as empresas).
- Modais: `ModalForm` (devolve lista de erros; vazia fecha). Confirmação: `useConfirmacao`.

## Testes

Vitest, em `src/**/*.test.ts`. Teste regra de domínio com funções puras; loja e mesclagem com `RepositorioMemoria` e `fake-indexeddb`. Cada CA novo ou alterado em `docs/requisitos.md` ganha teste, citando o código do CA no nome quando possível.

## Conferir no navegador

`npm run dev` e abrir `http://localhost:5173/?demo`. A demonstração tem ARPs, contratos, OF/OS em várias situações, um reequilíbrio na ARP 018/2026 e 51 empresas. Nada é gravado. O visor fica em `#/visor`.

## Ao mudar requisitos

1. Atualize `docs/requisitos.md` (nova linha de revisão no topo, CA novos ou alterados).
2. Se mudar dados ou arquitetura, atualize `docs/design.md`.
3. Registre em `CHANGELOG.md`.
4. Atualize `README.md` se mudar algo que o usuário final faz (instalação, visor, exportação).

## Não faça

- Não grave dados de exemplo ou reais no repositório. A pasta `dados/` está no `.gitignore`.
- Não troque a pasta de rede por servidor, banco ou serviço em nuvem.
- Não adicione dependência que precise de rede em tempo de execução.
- Não edite `dist/`: é gerado pelo build.

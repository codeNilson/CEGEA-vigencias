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
npm run publicar   # (CI) monta publicacao/ a partir do dist e do CHANGELOG
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

## Fluxo de trabalho

Todas as alterações são feitas por agente, a pedido do Denilson. Alterar e publicar são etapas separadas: juntar uma mudança na `main` não instala nada no setor. Só uma tag `vX.Y.Z` publica.

### Branches

| Branch | Uso |
|---|---|
| `main` | sempre funcionando (CI verde). Acumula mudanças ainda não publicadas. Nunca receba commit direto. |
| `claude/<assunto-curto>` | uma por pedido (ex.: `claude/filtro-por-empresa`). Sai da `main` atualizada. |
| `publicacao` | gerada pelo CI. Não mexa. |

### A cada pedido de alteração

1. `git checkout main && git pull`, depois `git checkout -b claude/<assunto>`.
2. Implemente, com testes. Rode `npm run typecheck && npm test && npm run build` e confira no navegador se mexeu em tela.
3. Se a mudança for perceptível para quem usa o sistema, acrescente um item na seção `## [Não publicado]` do `CHANGELOG.md` (ver "Como escrever o CHANGELOG"). Mudança só interna (testes, refatoração, docs) não entra.
4. Atualize `docs/requisitos.md`, `docs/design.md` e `README.md` conforme "Ao mudar requisitos".
5. Commits pequenos, mensagem em português no imperativo ("Adiciona filtro por empresa na lista de contratos").
6. `git push -u origin claude/<assunto>` e abra o PR com `gh pr create` (título curto, corpo com o que mudou e como foi verificado). Onde o `gh` não tiver GraphQL (sessões na nuvem), use a API REST: `gh api repos/codeNilson/CEGEA-vigencias/pulls -f title=... -f head=claude/<assunto> -f base=main -f body=...`.
7. Espere o CI passar. **Só junte na `main` quando o Denilson aprovar** ("pode juntar", "aprovado"). Junte com `gh pr merge --squash --delete-branch` (ou, via REST, `gh api -X PUT repos/codeNilson/CEGEA-vigencias/pulls/<n>/merge -f merge_method=squash` e apague a branch).
8. Diga ao Denilson o que ficou acumulado para a próxima versão (itens de `[Não publicado]`).

Pedido pequeno e sem risco, com o Denilson dizendo que pode ir direto: ainda assim use branch e PR, mas pode juntar assim que o CI passar.

### Publicar uma versão (só quando o Denilson pedir: "publica", "lança a versão")

1. Parta da `main` atualizada, numa branch `claude/versao-X.Y.Z`.
2. Escolha o número pelo conteúdo de `[Não publicado]` e diga qual escolheu:
   - correção apenas: X.Y.**Z+1**
   - funcionalidade nova ou mudança visível: X.**Y+1**.0
   - mudança que exige ação de todos ou quebra compatibilidade de dados: **X+1**.0.0 (evite; os dados precisam continuar compatíveis)
3. No `CHANGELOG.md`, troque `## [Não publicado]` por `## [X.Y.Z] - AAAA-MM-DD (revisão N)` e crie uma nova `## [Não publicado]` vazia acima. Revise o texto das notas.
4. Atualize `version` no `package.json` (e o `package-lock.json` com `npm install --package-lock-only`).
5. PR, CI verde, junte na `main`.
6. Na `main` atualizada: `git tag vX.Y.Z && git push origin vX.Y.Z`. O workflow "Publicar versão" faz o resto e recusa tag fora da `main`, sem seção no CHANGELOG ou diferente do `package.json`.
   - Se o envio da tag for recusado (sessões na nuvem não podem criar tags; erro 403), não insista nem procure outro caminho. Peça ao Denilson para publicar pelo botão: GitHub, aba **Actions** → **Publicar versão** → **Run workflow** → branch `main` → **Run workflow**. O workflow lê a versão do `package.json` da `main`, cria a tag e publica; recusa se a versão já foi publicada.
7. Confira com `gh run list` que a publicação passou e informe ao Denilson.

Se `[Não publicado]` estiver vazio, não há o que publicar: avise em vez de criar versão.

### Como escrever o CHANGELOG

É o texto que as pessoas do setor leem em "O que há de novo". Escreva para elas, não para desenvolvedores.
- Seções: `### Adicionado`, `### Alterado`, `### Corrigido`, `### Removido`.
- Um item por mudança, uma ou duas frases, dizendo o que a pessoa vê ou passa a poder fazer. Nomeie telas e botões como aparecem na interface.
- Sem nomes de arquivo, função ou biblioteca. Sem travessão.
- Bom: "A lista de contratos pode ser filtrada por empresa." Ruim: "Adiciona prop `empresaId` em ListaDocumentos."

## Versões e atualização automática

O sistema se atualiza sozinho a partir da branch `publicacao` deste repositório público (RF22, `src/atualizacao/`, `docs/design.md` seção 10).
- Versão = `version` do `package.json`, embutida no build como `__VERSAO_APP__`. Na `main`, entre publicações, o número ainda é o da última versão: builds da `main` não devem ser copiados para a pasta de rede.
- Não mude `FONTE_ATUALIZACAO`, o formato de `versao.json` (`PublicacaoSchema`) nem o nome da branch `publicacao` sem manter compatibilidade: versões já instaladas leem desse endereço e desse formato.
- Toda versão nova bloqueia gravação das anteriores (`versaoMinima`). Não remova isso.

## Ao mudar requisitos

1. Atualize `docs/requisitos.md` (nova linha de revisão no topo, CA novos ou alterados).
2. Se mudar dados ou arquitetura, atualize `docs/design.md`.
3. Registre em `CHANGELOG.md`.
4. Atualize `README.md` se mudar algo que o usuário final faz (instalação, visor, exportação).

## Não faça

- Não grave dados de exemplo ou reais no repositório. A pasta `dados/` está no `.gitignore`.
- Não troque a pasta de rede por servidor, banco ou serviço em nuvem.
- Não adicione dependência que precise de rede em tempo de execução.
- Não edite `dist/` nem a branch `publicacao`: são gerados pelo build e pelo CI.

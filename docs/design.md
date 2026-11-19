# Design: Sistema de Acompanhamento de Vigência de Atas e Contratos

Referência: `requisitos.md`. Este documento define como o sistema atende aos requisitos. Não contém implementação.

## 1. Restrições que guiam o design

| Restrição (requisitos.md) | Consequência no design |
|---|---|
| Um arquivo .html em pasta de rede, aberto no Chrome | Aplicação inteira empacotada em um único arquivo, sem dependências externas em tempo de execução |
| Sem servidor e sem serviço em segundo plano | Toda a lógica roda no navegador. Os dados são arquivos na pasta de rede |
| 3 a 4 usuários editando ao mesmo tempo (RF16) | Dados divididos em vários arquivos pequenos, com controle de versão e mesclagem ao salvar |
| Sem internet obrigatória (RNF02) | Nenhum recurso carregado de CDN |
| Alertas só na tela, recalculados ao abrir (RF12, RF13) | Situações e saldos são sempre calculados, nunca gravados |

## 2. Estrutura geral

### 2.1 Arquivos na pasta de rede

```
\\servidor\setor\Vigencias\
  Vigencias.html              aplicação (substituída a cada nova versão)
  dados\
    _vigencias.json           marcador da pasta e versão do formato
    empresas\<id>.json        uma empresa por arquivo
    atas\<id>.json            uma ata por arquivo (com itens, parcelas e aditivos)
    contratos\<id>.json       um contrato por arquivo (com itens, aditivos, OF/OS e encerramento)
```

### 2.2 Primeiro acesso e acessos seguintes

1. O usuário abre `Vigencias.html` pela pasta de rede.
2. No primeiro acesso, clica em "Conectar pasta de dados" e escolhe a pasta `dados`. O sistema confere o arquivo `_vigencias.json` para garantir que é a pasta certa (ou cria a estrutura, se a pasta estiver vazia).
3. A referência à pasta fica guardada no navegador daquele computador. Nos acessos seguintes, o Chrome pede só um clique de confirmação de permissão.
4. O sistema carrega todos os arquivos, calcula situações e saldos e abre o painel (RF13).

### 2.3 Camadas da aplicação

```
ui/            telas e componentes (painel, ata, contrato, OF/OS, conflito, conexão)
estado/        dados carregados em memória, versões-base para mesclagem, seleção e filtros
dominio/       regras puras, sem acesso a tela nem a arquivo:
                 situacao, saldo, prazos, feriados, valores, validacoes, mesclagem
armazenamento/ interface Repositorio com duas implementações:
                 PastaRede (arquivos reais) e Memoria (testes)
exportacao/    planilha e layout de impressão para PDF
```

Regra de dependência: `ui` usa `estado` e `dominio`; `estado` usa `dominio` e `armazenamento`; `dominio` não depende de nada. Assim, todos os critérios de aceite de cálculo (CA03, CA07, CA08.5, CA10, CA11, CA12) são testáveis sem navegador e sem pasta de rede.

### 2.4 Telas

| Tela | Requisitos |
|---|---|
| Conexão da pasta | 2.2, RF16.4 |
| Painel de prazos (inicial) com contadores, filtros, busca e área de OF/OS | RF12, RF13, RF14.1, RF14.2 |
| Ata: dados, itens/parcelas com saldos, aditivos, contratos vinculados | RF01 a RF04, RF14.3, RF15 |
| Contrato: dados, itens com saldo e histórico de valores, aditivos, OF/OS, encerramento | RF05 a RF10, RF14.3, RF15 |
| Empresas: lista e cadastro simples | RF05, P01 |
| Resolução de conflito | RF16.2 |

## 3. Modelo de dados

### 3.1 Convenções

- **Identificadores**: UUID gerado no navegador. Números de ata, contrato e OF/OS são campos de negócio, não chaves, porque podem ser corrigidos.
- **Datas**: texto `AAAA-MM-DD`, sem hora e sem fuso. Evita o erro clássico de datas que "voltam um dia" por conversão de fuso.
- **Valores monetários**: inteiro em décimos de milésimo de real (valor x 10000). Atas às vezes trazem preços com 3 ou 4 casas. Totais são arredondados para centavos só na exibição e na exportação.
- **Quantidades**: inteiro em milésimos (quantidade x 1000), para aceitar unidades fracionadas (kg, m) sem erro de arredondamento em somas de saldo.
- **Controle de versão**: cada arquivo tem `versao` (inteiro, incrementado a cada gravação) e `atualizadoEm`.
- **Formato**: `formato` em cada arquivo indica a versão do esquema, para migrar dados antigos quando o sistema evoluir.

### 3.2 Por que agrupar em "agregados"

Cada arquivo guarda uma entidade principal e tudo que só existe dentro dela (uma ata leva seus itens, parcelas e aditivos; um contrato leva seus itens, aditivos, OF/OS e encerramento).

- Um arquivo por registro miúdo geraria milhares de arquivos e deixaria a abertura lenta na rede (RNF04).
- Um arquivo único para tudo faria quase toda gravação simultânea virar conflito (RF16.1).
- Com agregados, dois usuários só disputam o mesmo arquivo se estiverem mexendo na mesma ata ou no mesmo contrato. Mesmo assim, a mesclagem (seção 4) resolve sozinha os casos sem choque.

Volume previsto em RNF04: cerca de 700 a 800 arquivos.

### 3.3 Empresa (`empresas/<id>.json`)

```
id, formato, versao, atualizadoEm
nome            texto, obrigatório
cnpj            texto, opcional, único quando informado, dígitos verificadores válidos (rev. 5)
email           texto, opcional, vários separados por vírgula (rev. 3, default "")
telefone        texto, opcional (rev. 3, default "")
```

Empresa é cadastro separado para que fornecedor da parcela e empresa do contrato sejam o mesmo registro (P01), e não dois textos digitados de formas diferentes.

### 3.4 Ata (`atas/<id>.json`)

```
id, formato, versao, atualizadoEm
numero          texto, obrigatório, único entre atas
tema            texto; na interface "Objeto", sempre em maiúsculas (rev. 5)
dataInicio      data ou "" (rev. 4: opcional, fora da interface; não entra em cálculo)
dataFim         data, obrigatória   (data fim original)
observacoes     texto

itens[]
  id
  descricao     texto, obrigatório
  unidade       texto
  parcelas[]
    id
    empresaId           referência a Empresa
    tipoCota            "ampla" | "cota_me"
    quantidade          quantidade original, > 0
    valorUnitario       valor, > 0

aditivos[]
  id
  identificacao         texto
  data                  data
  tipo                  "prazo" | "quantidade" | "prazo_quantidade" | "reequilibrio" (rev. 5)
  novaDataFim           data, quando o tipo inclui prazo
  quantidades[]         quando o tipo inclui quantidade
    parcelaId
    novaQuantidade
  inicioEfeitos         data ou "", reequilíbrio (rev. 5, default "")
  valores[]             reequilíbrio (rev. 5, default [])
    parcelaId
    novoValorUnitario
  observacoes
```

### 3.5 Contrato (`contratos/<id>.json`)

```
id, formato, versao, atualizadoEm
numero          texto, obrigatório, único entre contratos
empresaId       referência a Empresa, obrigatória
tipo            "material" | "servico"
objeto          texto
ataId           referência a Ata, ou nulo
dataInicio      data, obrigatória
dataFim         data, obrigatória, >= dataInicio   (data fim original)
gestor          texto
fiscal          texto
observacoes     texto

itens[]
  id
  parcelaId             referência à parcela da ata, ou nulo em contrato sem ata
  descricao             cópia da ata no momento do vínculo, ou digitada
  unidade               idem
  quantidade            quantidade original do contrato, > 0
  valorUnitario         valor original, > 0

aditivos[]
  id
  identificacao         texto
  tipo                  "prazo" | "valor" | "reequilibrio"
  dataAssinatura        data
  inicioEfeitos         data
  novaDataFim           data, só no tipo "prazo"
  alteracoes[]          tipos "valor" e "reequilibrio"
    itemId
    novaQuantidade      só no tipo "valor"
    novoValorUnitario   "valor" e "reequilibrio"
  observacoes

ordens[]                (OF quando tipo = material, OS quando tipo = servico)
  id
  numero                texto, obrigatório, único dentro do contrato
  dataEmissao           data
  prazoDias             inteiro > 0
  tipoPrazo             "uteis" | "corridos"
  dataEntrega           data, ou nulo
  itens[]
    itemId
    quantidade          > 0
  observacoes

encerramento            nulo, ou:
  data                  data, obrigatória
  termo                 texto (identificação do termo de encerramento)
```

Descrição, unidade e valor da parcela são copiados para o item do contrato no momento do vínculo. Um ajuste posterior na ata não altera silenciosamente um contrato já assinado.

### 3.6 Valores derivados (calculados, nunca gravados)

| Derivado | Regra | Requisito |
|---|---|---|
| Data fim vigente (ata, contrato) | `novaDataFim` do aditivo de prazo mais recente; senão `dataFim` | CA04.1, CA08.1 |
| Dias restantes | data fim vigente - hoje, em dias de calendário | RF12 |
| Situação | encerramento preenchido -> encerrado; dias < 0 -> vencido; dias <= 90 -> a vencer; senão vigente | RF12 |
| Quantidade vigente da parcela | última `novaQuantidade` de aditivo de ata; senão `quantidade` | CA04.2 |
| Contratado da parcela | soma de `itens[].quantidade` de todos os contratos com aquela `parcelaId` | CA03.1 |
| Saldo da parcela | quantidade vigente - contratado | CA03.1 |
| Períodos do contrato | começam em `dataInicio` e em cada `inicioEfeitos` de aditivo de prazo | CA08.1 |
| Quantidade do item numa data | última `novaQuantidade` com `inicioEfeitos` <= data; senão `quantidade` | CA08.2 |
| Valor unitário do item numa data | último `novoValorUnitario` com `inicioEfeitos` <= data; senão `valorUnitario` | CA08.4, CA08.5 |
| Saldo do item no período vigente | quantidade do item hoje - soma das quantidades de OF/OS com `dataEmissao` no período vigente | CA07.1, CA08.1 |
| Data limite da OF/OS | ver 3.7 | CA10.3 a CA10.5 |
| Situação da OF/OS | `dataEntrega` preenchida -> entregue; hoje > data limite -> atrasada; senão pendente | CA10.6 |
| Valor da OF/OS | soma de quantidade x valor unitário do item na `dataEmissao` | CA08.5 |

Gravar só os fatos (datas, quantidades, aditivos) e calcular o resto elimina a classe de erro "saldo gravado não bate com as OF", e faz a situação mudar sozinha com a passagem dos dias (CA12.1).

### 3.7 Prazos e feriados

- Contagem a partir do dia seguinte à emissão, incluindo o dia do vencimento.
- Dias corridos: data limite = emissão + N (CA10.4).
- Dias úteis: avança dia a dia, contando só segunda a sexta que não estejam no conjunto de feriados do ano (CA10.5).
- Feriados: função pura `feriados(ano)` que junta a lista fixa do RF11 com os móveis calculados a partir da Páscoa (algoritmo de Meeus/Jones/Butcher): Carnaval = Páscoa - 48 e - 47 dias, Sexta-feira Santa = Páscoa - 2, Corpus Christi = Páscoa + 60. Sem tabela por ano, funciona para qualquer ano (CA11.2).

## 4. Edição concorrente (RF16)

### 4.1 Gravação

Para cada agregado em memória, o sistema guarda a **versão-base**, ou seja, o conteúdo como estava quando foi lido. Ao salvar:

1. Relê o arquivo da pasta.
2. Se a `versao` do arquivo for igual à da base, ninguém mexeu: grava com `versao + 1`.
3. Se for maior, alguém salvou antes: faz a mesclagem em três vias (base, minha versão, versão do disco).
4. Sem conflito: grava o resultado mesclado com `versao` do disco + 1 e avisa "alterações de outro usuário foram incorporadas".
5. Com conflito: abre a tela de resolução, mostrando campo a campo as duas versões. O usuário escolhe e o sistema volta ao passo 1.
6. Depois de gravar, relê o arquivo e confere se a versão gravada é a sua. Se não for (alguém gravou no mesmo instante), repete a partir do passo 1.

A gravação usa arquivo temporário substituído ao final. O arquivo nunca fica pela metade se a rede cair no meio. Se a pasta estiver inacessível, os dados digitados continuam na tela e o usuário pode tentar de novo (CA16.4).

### 4.2 Regras de mesclagem

- Campos simples (número, datas, gestor...): se só um lado mudou, vale esse lado. Se os dois mudaram para valores diferentes, é conflito.
- Listas internas (itens, parcelas, aditivos, OF/OS): comparadas por `id`. Adicionado em um lado entra. Removido em um lado e intocado no outro sai. Alterado nos dois lados vira conflito naquele elemento.
- Arquivo excluído por outro usuário enquanto eu editava: conflito com as opções "recriar com minhas alterações" ou "descartar".

Exemplo: Priscila lança uma OF no contrato 12 enquanto Ednaldo registra um aditivo no mesmo contrato. As duas alterações entram, sem pergunta.

### 4.3 Regras que atravessam arquivos

O saldo da parcela da ata depende de vários contratos (CA03.3). Antes de gravar um contrato vinculado a ata, o sistema relê todos os contratos daquela ata e valida o saldo com dados frescos. Fica um risco residual de milissegundos (dois usuários contratando a última quantidade da mesma parcela no mesmo instante). Se acontecer, a ata mostra saldo negativo em destaque, que é visível e corrigível.

### 4.4 Ver o que os outros salvaram

- Botão "Recarregar" relê só os arquivos cuja data de modificação mudou (CA16.3).
- A cada 2 minutos, o sistema confere as datas de modificação e, se houver novidade, mostra o aviso "há alterações de outros usuários". Não recarrega sozinho para não atrapalhar quem está digitando.
- Um cache no navegador guarda o conteúdo já lido de cada arquivo. Na abertura, só os arquivos alterados desde o último acesso são lidos de novo pela rede, o que sustenta o tempo de abertura do RNF04.

### 4.5 Exclusão (RF15)

Excluir uma ata, contrato ou empresa apaga o arquivo. Excluir um item, aditivo ou OF/OS é uma alteração gravada no agregado. Antes de excluir, o sistema verifica dependentes em memória (contratos que usam a ata ou a parcela, OF/OS que usam o item, contratos ou parcelas da empresa) e bloqueia se houver (CA15.2).

## 5. Tecnologias escolhidas

| Tecnologia | Uso | Motivo |
|---|---|---|
| **TypeScript** | toda a aplicação | O modelo tem muitas referências entre entidades e unidades escaladas (valor x 10000, quantidade x 1000). Tipos pegam em tempo de escrita a troca de um campo pelo outro. |
| **React** | interface | Você já domina. O sistema tem muitas telas de formulário com estado derivado (saldos atualizando ao digitar a quantidade da OF), que é o caso típico do React. |
| **Vite + vite-plugin-singlefile** | empacotamento | Gera um único `Vigencias.html` com todo o JS e CSS embutidos. É o que permite abrir por `file://` no Chrome sem servidor e sem internet (RNF01, RNF02). Atualizar o sistema é só substituir esse arquivo na pasta. |
| **File System Access API (Chrome)** | ler e gravar os arquivos da pasta de rede | É a única forma de uma página aberta no Chrome, sem servidor e sem instalação, ler e gravar arquivos numa pasta escolhida pelo usuário. A gravação via arquivo temporário evita arquivo corrompido. O Chrome é o navegador do setor, e essa API é justamente a que o Firefox não tem. |
| **IndexedDB** | guardar a referência à pasta e o cache de leitura | Nativo do navegador. Guarda a autorização da pasta entre acessos e o cache que acelera a abertura. Não guarda dados oficiais: a fonte da verdade é sempre a pasta de rede. |
| **Zod** | validar cada arquivo lido | Os arquivos ficam numa pasta que qualquer pessoa pode abrir e alterar. Validar na leitura impede que um arquivo corrompido ou editado à mão derrube o sistema: ele é listado como "arquivo com problema" e o resto carrega normalmente. Também é onde ficam as migrações de formato. |
| **Zustand** | estado em memória | Estado global pequeno e direto, sem a cerimônia de Redux. Guarda agregados carregados, versões-base para mesclagem e filtros do painel. |
| **SheetJS (xlsx)** | exportação para planilha | Gera .xlsx real no navegador, que abre no Excel e no LibreOffice (CA14.1). Datas e valores saem como tipos de planilha, não como texto. |
| **CSS de impressão + impressão do Chrome** | exportação para PDF | O Chrome já gera PDF fiel ao que está na tela ("Salvar como PDF"), com acentos, tabelas longas quebrando página e cabeçalho repetido. Evita uma biblioteca de PDF pesada e garante que o PDF é idêntico ao exibido (CA14.4). Custo: um clique a mais no diálogo de impressão. |
| **Vitest** | testes do domínio | Cada critério de aceite de cálculo vira teste automatizado da camada `dominio`, inclusive os exemplos numéricos dos requisitos (1000 - 400 - 450 = 150; reequilíbrio de R$ 10,00 para R$ 12,00; Sexta-feira Santa de 2027 em 26/03). |
| **Playwright** | testes de ponta a ponta | Roda as telas com o repositório em memória, cobrindo fluxos do painel, cadastro e conflito simulado, sem depender da pasta de rede. |
| **CSS próprio, sem biblioteca de componentes** | visual | Poucas telas, uso interno. Uma biblioteca de componentes aumentaria o arquivo único sem ganho real. |

Funções de data são próprias, pequenas e testadas. Com datas guardadas como texto `AAAA-MM-DD`, só são necessárias soma de dias, diferença em dias e dia da semana.

### 5.1 Alternativas descartadas

| Alternativa | Por que não |
|---|---|
| Guardar dados só no navegador (localStorage, IndexedDB) | Cada computador teria seus próprios dados. Viola a exigência de dados compartilhados. |
| Um único arquivo JSON com todos os dados | Qualquer gravação simultânea vira conflito no arquivo inteiro. |
| Banco SQLite dentro do navegador, salvo na pasta | O arquivo do banco é regravado inteiro a cada salvamento, com o mesmo problema do JSON único, e a mesclagem fica muito mais difícil. |
| Planilha Excel como base de dados | Leitura e escrita frágeis, sem controle de versão por registro, e o Excel trava o arquivo para quem abre por último. |
| Servidor local, serviço em nuvem ou Google Sheets | Fora do escopo: sem servidor e sem serviço externo. |
| jsPDF ou pdfmake | Aumentam o arquivo e exigem refazer o layout em código. A impressão do Chrome já resolve. |

## 6. Riscos e validação antes de construir

| Risco | Mitigação |
|---|---|
| Política de TI do órgão bloquear a gravação em pasta pelo Chrome | Prova de conceito antes de tudo (abaixo). |
| Chrome pedir confirmação de permissão a cada abertura | Aceitável (um clique). A tela de conexão explica o que fazer. |
| Lentidão da pasta de rede na abertura | Cache por data de modificação (4.4) e leitura em paralelo. Medir na prova de conceito. |
| Gravação exatamente simultânea no mesmo arquivo | Releitura após gravar e repetição (4.1, passo 6). |
| Alguém mover ou renomear arquivos na pasta `dados` | Arquivo `_vigencias.json` como marcador e validação de cada arquivo na leitura. |

**Prova de conceito recomendada** (um .html mínimo, descartável): abrir a partir da pasta de rede em dois computadores do setor, conectar a mesma pasta, gravar e ler arquivos dos dois lados ao mesmo tempo e medir o tempo de leitura de 800 arquivos pequenos. Se a política do órgão bloquear a API, todo o resto do design precisa ser revisto. Por isso esse teste vem primeiro.

## 7. Decisões que complementam os requisitos (confirmar)

- D01: Prazo de OF/OS conta a partir do dia seguinte à emissão (seção 3.7). Se o vencimento em dias corridos cair em fim de semana ou feriado, o sistema não prorroga, conforme CA10.4.
- D02: Só a quantidade original dos itens do contrato consome saldo da ata. Acréscimo de quantidade por aditivo de valor no contrato não desconta da ata.
- D03: Empresa é um cadastro próprio, com CNPJ opcional e único.
- D04: Descrição, unidade e valor da parcela são copiados para o contrato no vínculo (seção 3.5).
- D05: Quantidades aceitam até 3 casas decimais. Valores unitários são guardados com até 4 casas, mas desde a revisão 5 a digitação usa máscara de 2 casas.

## 8. Revisão 2 (18/11/2026)

### 8.1 Situação e prazo separados

`situacao` passa a ter três valores: `vigente`, `vencido`, `encerrado`. O alerta de prazo é um derivado à parte, `faixaPrazo`:

| faixaPrazo | Regra (documento vigente) |
|---|---|
| `critico` | 0 a 30 dias |
| `atencao` | 31 a 90 dias |
| `normal` | mais de 90 dias |

Vencidos (RF18): `precisaAtencao(documento)` = vigente e faixa diferente de `normal`. Contrato vencido sem encerramento = `aguardandoEncerramento`.

### 8.2 Navegação

| Rota | Tela |
|---|---|
| `#/` | Início: contadores, vencimentos por mês, entregas próximas, vencidos aguardando encerramento (recolhido) |
| `#/atas`, `#/contratos` | Listas com filtro, padrão "vigentes" |
| `#/ordens` | Todas as OF/OS, com itens e quantidades |
| `#/ata/<id>`, `#/contrato/<id>` | Detalhe |
| `#/visor` | Visor de TV, tela cheia, sem cabeçalho de navegação |
| `#/empresas` | Empresas |

O detalhe de OF/OS é um painel lateral aberto por cima da tela atual (`?of=<contrato>:<ordem>` no hash), para não tirar o usuário do contexto.

### 8.3 Visor de TV

- Tamanhos em unidades relativas à altura da tela (`vh`), para funcionar de 1366x768 a 3840x2160.
- `loja.carregar()` a cada 5 minutos. O cache local evita reler arquivos que não mudaram.
- Paginação automática: colunas de mês com mais cartões do que cabem, e lista de entregas, alternam a cada 15 s.
- Relógio a cada segundo; `hoje` atualizado na virada do dia.

### 8.4 Identidade visual

- Paleta do manual PMF 2025-2028: laranja `#F15A22` (marca e alerta), verde `#009889` (vigente, ok), azul `#00A0DC` (informação), creme `#FFE6CB` (faixas e fundos de destaque), petróleo `#325565` (texto principal e cabeçalhos), grafite `#414042` (texto secundário, vencidos).
- Tipografia: Raleway variável com algarismos alinhados e tabulares (`lnum`, `tnum`), que equivale à Rawline citada no manual. Sem fonte monoespaçada.
- Motivo gráfico do manual: blocos retangulares de cor nos cantos e títulos de seção sobre linha fina.
- Fox Grotesque e Aribau Grotesk são fontes pagas e não estão embutidas.

## 9. Revisões 3 a 5 (18 e 19/11/2026)

### 9.1 Evolução do formato sem migração

Campos novos entram no schema zod com `.default(...)`. Arquivos gravados antes continuam válidos e ganham o valor padrão na leitura; o arquivo só é regravado quando alguém edita o registro. `FORMATO_ATUAL` continua 1. Regra para mudanças futuras: campo novo sempre com default; renomear campo exige trocar só o rótulo da interface (como `tema`, exibido como "Objeto").

### 9.2 Reequilíbrio da ARP

- `valorParcelaEm(ata, parcela, data)`: valor original, substituído pelo do último reequilíbrio com `inicioEfeitos` (ou `data`, se vazio) até a data.
- Item de contrato vindo da ARP copia `valorParcelaEm(ata, parcela, contrato.dataInicio)` no vínculo (D04 continua: o valor é copiado, não referenciado).
- Contratos existentes não mudam. `reequilibriosPosterioresAoContrato` alimenta só um aviso na ficha do contrato.
- Reequilíbrio não altera vencimento nem quantidade (`dataFimVigenteAta` e `quantidadeVigenteParcela` ignoram o tipo).

### 9.3 Interface

- Ordenação das listas (`compararNumeroDoc`, em `src/dominio/texto.ts`): NÚMERO/ANO decrescente; fora do padrão no fim. Preferência por computador em `localStorage` (`usePreferencia`), igual ao modo lista/mês.
- `EscolhaEmpresa`: combobox com busca sem acento, lista renderizada em portal (`position: fixed`) para não ser cortada pelo modal, até 50 resultados visíveis.
- Empresa repetida: `nomesParecidos` compara o nome sem acentos, pontuação e sufixos societários. Aviso, não bloqueio; CNPJ igual continua bloqueado.
- `EntradaMoeda`: máscara de centavos preenchida da direita; o texto resultante é lido por `lerValor`, sem mudar o formato gravado.


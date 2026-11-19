# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/). Cada versão corresponde a uma revisão de `docs/requisitos.md`. As notas são o que aparece para o setor em "O que há de novo". Mudanças já na `main` e ainda não publicadas ficam em `[Não publicado]`.

## [Não publicado]

## [1.6.0] - 2026-11-19 (revisão 7)

### Adicionado
- Filtro por empresa nas listas de contratos e de OF/OS.
- Busca por item ou fornecedor e filtro por fornecedor na tabela de itens da tela da ARP, e busca na tabela de itens da tela do contrato, quando há muitos itens.
- Nas janelas de nova OF/OS e de aditivo, quando há muitos itens: busca por item, opção "Só os preenchidos" e contagem do que já foi preenchido. O que foi digitado continua valendo mesmo com o filtro.
- No aditivo de ARP, filtro por fornecedor, o que facilita o reequilíbrio de uma empresa só.

### Alterado
- No cadastro do contrato, a ARP é escolhida num campo de busca por número ou objeto. Aparecem primeiro as ARPs vigentes que têm itens da empresa do contrato, depois as outras vigentes e, por último, as vencidas.
- No item do contrato, o item da ARP é escolhido num campo de busca pela descrição, com unidade, cota, saldo e valor à vista. Itens sem saldo ficam no fim.
- As listas de ARPs, contratos e OF/OS, e as tabelas de itens e de OF/OS das telas da ARP e do contrato, mostram 20 linhas por página. Planilha e PDF continuam saindo completos.
- Os números nos botões de situação das listas passam a considerar a empresa e a busca escolhidas.
- No aditivo de ARP, os fornecedores aparecem agrupados por item.
- Na tela da ARP, os contratos encerrados ficam recolhidos em "Mostrar encerrados". Na tela do contrato, as OF/OS de vigências anteriores ficam recolhidas em "Mostrar de vigências anteriores".
- No Início, cada mês mostra até 6 vencimentos, com "Mostrar mais", e a área de entregas mostra até 12 OF/OS, com "Mostrar todas". O modo lista mostra 20 por página.

### Corrigido
- A busca na lista de OF/OS passa a ignorar acentos, como nas outras listas.

## [1.5.0] - 2026-11-19 (revisão 6)

### Adicionado
- Atualização pelo próprio sistema: ao abrir, ele verifica se há versão nova, mostra as novidades e instala com um clique, para todos de uma vez. Sem internet, segue funcionando e tenta de novo depois.
- Antes de instalar, o arquivo baixado é conferido (tamanho e assinatura SHA-256) e uma cópia da versão atual fica na pasta `versoes-anteriores`.
- Janela "O que há de novo" na primeira abertura depois de cada atualização.
- Versão do sistema na faixa de status, com consulta manual de atualizações.

### Alterado
- Quem estiver com uma versão antiga aberta recebe um aviso para recarregar e não consegue salvar até recarregar. Isso evita que a versão antiga apague campos novos dos registros.
- O visor da TV recarrega sozinho quando o sistema é atualizado.

## [1.4.0] - 2026-11-19 (revisão 5)

### Adicionado
- Reequilíbrio econômico-financeiro como tipo de aditivo da ARP, com início dos efeitos e novo valor por fornecedor. Vale para contratos novos; contratos existentes mantêm o valor e mostram um aviso.
- Ordenação escolhível nas listas de ARPs e contratos: por vencimento (padrão) ou por número (NÚMERO/ANO, mais recentes primeiro).
- Busca e paginação (20 por página) na aba Empresas.
- Campo de escolha de empresa com busca por nome ou CNPJ, no lugar da lista suspensa.
- Aviso de empresa já cadastrada com nome parecido, com "Usar esta" e "É outra empresa".
- Conferência dos dígitos verificadores do CNPJ e formatação automática.
- Máscara nos campos de valor em R$ (500 vira 5,00) e separador de milhar nas quantidades.

### Alterado
- "Tema" da ARP passa a se chamar "Objeto" e é exibido em maiúsculas.
- Exportações trazem valor unitário original e atual dos itens das ARPs.

## [1.3.0] - 2026-11-19 (revisão 4)

### Alterado
- Data de início da vigência deixou de ser pedida no cadastro da ARP. ARPs antigas mantêm a data gravada.

## [1.2.0] - 2026-11-18 (revisão 3)

### Adicionado
- Modo lista no Início e no visor, além da visão por mês.
- E-mail e telefone das empresas, exibidos na ficha do contrato e no detalhe da OF/OS.
- Exportação completa dos dados em uma planilha com abas independentes.

## [1.1.0] - 2026-11-18 (revisão 2)

### Adicionado
- Visor para TV com atualização automática e paginação.
- Painel lateral de detalhe da OF/OS, com itens e quantidades.

### Alterado
- Situação (vigente, vencido, encerrado) separada do alerta de prazo.
- "SRP" renomeado para "ARP". Nomes de colunas mais claros.
- Vencidos fora da tela inicial; contratos vencidos ficam em seção recolhida até o encerramento.
- Identidade visual da Prefeitura de Fortaleza.

## [1.0.0] - 2026-11-18 (revisão 1)

### Adicionado
- Cadastro de ARPs, itens, parcelas por fornecedor, contratos, aditivos e OF/OS.
- Saldos da ARP e do contrato, prazos de entrega com dias úteis e feriados.
- Edição concorrente segura na pasta de rede, com mesclagem em três vias e tela de conflito.
- Exportação em planilha e PDF.

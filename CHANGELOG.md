# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/). Cada versão corresponde a uma revisão de `docs/requisitos.md`.

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

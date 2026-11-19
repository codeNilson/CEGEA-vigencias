# Requisitos: Sistema de Acompanhamento de Vigência de Atas e Contratos

Órgão: Secretaria Municipal da Infraestrutura (SEINF), Prefeitura de Fortaleza. Setor: Célula de Gestão Administrativa.

Revisão 2 (18/11/2026): termos de situação, regra para vencidos, visor de TV, detalhe de OF/OS e identidade visual da PMF.
Revisão 3 (18/11/2026): modo lista no Início e no visor, contato das empresas, exportação completa dos dados.
Revisão 4 (19/11/2026): data de início da vigência deixou de ser obrigatória no cadastro da ARP.
Revisão 5 (19/11/2026): reequilíbrio na ARP, máscara de valores, ordenação escolhível, objeto da ARP em maiúsculas, busca e paginação de empresas, escolha de empresa com busca e aviso de empresa repetida.

## 1. Objetivo

Evitar a perda de prazo de renovação de atas de registro de preço e contratos do setor, centralizando em um único lugar as vigências, os saldos, os aditivos e as ordens de fornecimento/serviço, com destaque visual para o que está perto de vencer.

## 2. Glossário

| Termo | Definição |
|---|---|
| Ata (ARP) | Ata de Registro de Preço da SEPOG à qual o órgão aderiu. Tem número, objeto e vigência. Na interface, "ARP". |
| Item da ata | Item aderido pelo órgão, com a quantidade que o órgão registrou. Itens não aderidos não existem no sistema. |
| Parcela | Fatia de um item da ata atribuída a um fornecedor (ampla concorrência ou cota ME/EPP), com quantidade e valor unitário próprios. Um item tem uma ou mais parcelas. |
| Contrato | Contrato com uma empresa, de material ou de serviço, vinculado a no máximo uma ata, ou a nenhuma. |
| OF / OS | Ordem de Fornecimento (material) ou Ordem de Serviço (serviço). Consome saldo do contrato e tem prazo de entrega. |
| Aditivo | Alteração formal de ata ou contrato (prazo, quantidade, valor, reequilíbrio). |
| Saldo | Quantidade ainda disponível para contratar (na ata) ou para emitir OF/OS (no contrato). |
| Vencimento | Data fim original ou a do último aditivo de prazo. |
| Vigência atual | Período desde o início do contrato, ou desde a última prorrogação. O saldo do contrato é contado nele. |

## 3. Usuários e ambiente

- 3 a 4 usuários do setor, todos com o mesmo nível de acesso.
- Sem login e sem registro de quem fez cada alteração.
- O sistema é um arquivo .html aberto a partir de uma pasta de rede do setor, no Google Chrome.
- Não há servidor próprio nem serviço rodando em segundo plano.
- Os dados ficam na mesma pasta de rede e são compartilhados: o que um usuário salva fica visível para os outros.

## 4. Requisitos funcionais

### RF01. Cadastro de ata

Campos: número, objeto, data fim, observações. Não há campo de data de início: a vigência da ARP só é controlada pelo vencimento, e o início não entra em nenhum cálculo do sistema.

- CA01.1: É possível criar, editar e excluir uma ata.
- CA01.2: Não é possível salvar uma ata sem número e sem data fim.
- CA01.4: Não é possível salvar duas atas com o mesmo número.
- CA01.5: O objeto da ARP é gravado e exibido em letras maiúsculas, sem espaços repetidos. ARPs antigas aparecem em maiúsculas sem precisar editar.

### RF02. Itens e parcelas da ata

Item: descrição, unidade de medida. Parcela: fornecedor, tipo (ampla ou cota ME/EPP), quantidade registrada, valor unitário.

- CA02.1: Um item pode ter uma ou mais parcelas, cada uma com fornecedor, quantidade e valor unitário próprios.
- CA02.2: A quantidade total do item é a soma das quantidades das suas parcelas e é exibida no item.
- CA02.3: O mesmo fornecedor pode ter parcelas em vários itens da mesma ata.
- CA02.4: Quantidade e valor unitário só aceitam números maiores que zero.
- CA02.5: Campos de valor em R$ (em qualquer tela) têm máscara de 2 casas: o usuário digita só números e os centavos se preenchem da direita (5 vira 0,05; 500 vira 5,00; 123456 vira 1.234,56). Apagar remove o último dígito. Colar um valor pronto ("R$ 1.234,56") também funciona.
- CA02.6: Campos de quantidade ganham separador de milhar ao sair do campo (1500 vira 1.500).

### RF03. Saldo da ata

- CA03.1: O saldo de cada parcela é: quantidade registrada + aditivos de quantidade da ata - soma das quantidades contratadas a partir dela.
- CA03.2: Exemplo: parcela com 1000 unidades, contrato de 400 e depois contrato de 450, saldo exibido = 150.
- CA03.3: O sistema impede vincular a um contrato quantidade maior que o saldo da parcela, exibindo o saldo disponível.
- CA03.4: A tela da ata mostra, por item e por parcela: quantidade registrada, quantidade contratada e saldo.

### RF04. Aditivo de ata

Tipos: prazo, quantidade, prazo e quantidade, reequilíbrio econômico-financeiro. Campos: número/identificação, data, nova data fim (se prazo), novas quantidades por parcela (se quantidade), início dos efeitos e novos valores unitários por parcela (se reequilíbrio), observações.

- CA04.1: Após um aditivo de prazo, a data fim vigente da ata passa a ser a nova data fim, e a situação e o alerta são recalculados com ela.
- CA04.2: Após um aditivo de quantidade, o saldo da parcela afetada é recalculado com a nova quantidade.
- CA04.3: A ata exibe o histórico de aditivos em ordem cronológica, mantendo a data fim e as quantidades originais visíveis.
- CA04.4 (reequilíbrio): A partir do início dos efeitos, o valor unitário registrado da parcela passa a ser o novo valor. A ficha mostra o valor em vigor e o original ("era R$ ...") e o valor registrado da ARP usa os valores em vigor.
- CA04.5: O reequilíbrio da ARP vale só para contratos novos: um item de contrato vindo da ARP pega o valor em vigor na data de início do contrato. Contratos que já existiam mantêm o próprio valor e mostram o aviso "A ARP teve reequilíbrio a partir de dd/mm/aaaa"; se o contrato também mudar, registra-se o reequilíbrio no próprio contrato (RF08).
- CA04.6: Uma parcela citada em reequilíbrio não pode ser removida do item enquanto o aditivo existir.

### RF05. Cadastro de contrato

Campos: número, empresa, tipo (material ou serviço), objeto, ata vinculada (opcional), data de início, data fim, gestor, fiscal, observações.

Empresa: nome, CNPJ (opcional), e-mail (opcional, aceita mais de um separado por vírgula) e telefone (opcional). O contato aparece na ficha do contrato e no detalhe da OF/OS.

- CA05.6: A escolha da empresa (no contrato e no fornecedor do item da ARP) é um campo de busca: digita-se parte do nome ou do CNPJ, sem acento e sem diferenciar maiúsculas, e escolhe-se com o mouse ou com setas e Enter. A última opção cadastra uma nova empresa já com o texto digitado.
- CA05.7: Ao cadastrar empresa, o sistema confere se ela já existe: CNPJ igual é bloqueado; nome parecido (ignorando acentos, pontuação e sufixos como LTDA, ME, EPP, EIRELI, S/A) gera um aviso com as empresas encontradas, a opção "Usar esta" (quando o cadastro veio de dentro da ARP ou do contrato) e a opção "É outra empresa, cadastrar mesmo assim". Sem uma das duas, não salva.
- CA05.8: O CNPJ, quando informado, precisa ter dígitos verificadores válidos e é gravado no formato 00.000.000/0000-00.
- CA05.9: A aba Empresas tem busca por nome, CNPJ ou e-mail e mostra 20 empresas por página.

- CA05.1: É possível criar, editar e excluir um contrato.
- CA05.2: Não é possível salvar sem número, empresa, tipo, data de início e data fim.
- CA05.3: Não é possível salvar data fim anterior à data de início.
- CA05.4: Não é possível salvar dois contratos com o mesmo número.
- CA05.5: Um contrato se vincula a no máximo uma ata.

### RF06. Itens do contrato

- CA06.1: Em contrato vinculado a ata, os itens são escolhidos entre as parcelas da ata cujo fornecedor é a empresa do contrato. Valor unitário vem da parcela.
- CA06.2: Em contrato sem ata, os itens são cadastrados no próprio contrato (descrição, unidade, quantidade, valor unitário).
- CA06.3: O contrato exibe o valor total (soma de quantidade x valor unitário vigente de cada item).

### RF07. Saldo do contrato

- CA07.1: O saldo de cada item do contrato é: quantidade do período vigente - soma das quantidades das OF/OS emitidas no período vigente.
- CA07.2: Exemplo: item com 400 unidades e OF de 150, saldo exibido = 250.
- CA07.3: O sistema impede emitir OF/OS com quantidade maior que o saldo do item, exibindo o saldo disponível.

### RF08. Aditivos de contrato

Tipos: prazo, valor, reequilíbrio econômico-financeiro. Campos comuns: número/identificação, data de assinatura, data de início dos efeitos, observações.

- CA08.1 (prazo): Informa a nova data fim. A data fim vigente passa a ser a nova data, e o saldo de cada item volta à quantidade do contrato, iniciando um novo período. OF/OS do período anterior continuam visíveis no histórico e não consomem o novo saldo.
- CA08.2 (valor): Pode alterar a quantidade e/ou o valor unitário de itens, a partir da data de início dos efeitos.
- CA08.3 (reequilíbrio): Altera o valor unitário de itens a partir da data de início dos efeitos.
- CA08.4: O contrato exibe o histórico de valores unitários de cada item, com a data a partir da qual cada valor vale.
- CA08.5: OF/OS usa o valor unitário vigente na sua data de emissão. Exemplo: reequilíbrio de R$ 10,00 para R$ 12,00 a partir de 01/06; OF emitida em 15/05 é valorada a R$ 10,00 e OF emitida em 10/06 a R$ 12,00.
- CA08.6: O contrato exibe o histórico de aditivos em ordem cronológica.

### RF09. Encerramento de contrato

Campos: data de encerramento, número/identificação do termo de encerramento.

- CA09.1: O usuário pode marcar um contrato como encerrado, antes ou depois da data fim vigente.
- CA09.2: Não é possível encerrar sem informar a data de encerramento.
- CA09.3: Contrato encerrado não pode receber nova OF/OS nem aditivo.
- CA09.4: É possível desfazer o encerramento (para correção de cadastro errado).

### RF10. Ordem de Fornecimento / Ordem de Serviço

Campos: número, contrato, data de emissão, itens e quantidades, prazo de entrega (quantidade de dias e tipo: úteis ou corridos), data de entrega, observações.

- CA10.1: A OF/OS consome saldo do contrato conforme RF07.
- CA10.2: Contrato de serviço pode existir sem nenhuma OS.
- CA10.3: A data limite de entrega é calculada automaticamente a partir da data de emissão, da quantidade de dias e do tipo.
- CA10.4: Em dias corridos, a data limite = data de emissão + N dias.
- CA10.5: Em dias úteis, contam-se apenas dias de segunda a sexta que não sejam feriado da lista do RF11.
- CA10.6: Situação: "pendente" (sem data de entrega e dentro do prazo), "entregue" (com data de entrega), "atrasada" (sem data de entrega e hoje após a data limite).
- CA10.7: A entrega é única: uma data de entrega por OF/OS, sem entregas parciais.
- CA10.8: As listas de OF/OS mostram itens e quantidades sem abrir edição.
- CA10.9: Clicar numa OF/OS (em qualquer tela) abre o detalhe da própria OF/OS: itens, quantidades, valores, prazo, situação, contrato e empresa, com ações de registrar entrega e editar.
- CA10.10: Existe uma lista de todas as OF/OS, com filtro por situação (pendente, atrasada, entregue).

### RF11. Feriados

- CA11.1: O sistema traz embutida uma lista de feriados usada no cálculo de dias úteis, sem tela de cadastro:
  - Nacionais fixos: 01/01, 21/04, 01/05, 07/09, 12/10, 02/11, 15/11, 20/11, 25/12.
  - Móveis, calculados a partir da Páscoa: Carnaval (segunda e terça), Sexta-feira Santa, Corpus Christi.
  - Estaduais (CE): 19/03 (São José), 25/03 (Data Magna).
  - Municipais (Fortaleza): 15/08 (Nossa Senhora da Assunção).
- CA11.2: Os feriados móveis são calculados corretamente para qualquer ano. Exemplo: em 2027, Sexta-feira Santa cai em 26/03.
- CA11.3: Pontos facultativos decretados no ano não são considerados.

### RF12. Situação e prazo de atas e contratos

Dias restantes = vencimento - data de hoje.

Situação (o estado do documento):

| Situação | Regra | Aplica a |
|---|---|---|
| Vigente | dias restantes >= 0 | ata e contrato |
| Vencida / Vencido | dias restantes < 0 | ata e contrato |
| Encerrado | marcado manualmente (RF09), prevalece sobre as demais | só contrato |

Prazo (o alerta, separado da situação): um documento vigente com dias restantes <= 90 está "vencendo", e o prazo aparece como "vence em N dias" com destaque. Com dias restantes <= 30 o destaque é mais forte.

- CA12.1: Situação e prazo são recalculados automaticamente a cada abertura e a cada atualização, sem ação do usuário.
- CA12.2: Com vencimento 90 dias após hoje, a situação é "Vigente" e o prazo tem destaque. Com 91 dias, "Vigente" sem destaque.
- CA12.3: Com vencimento igual a hoje, "Vigente" e "vence hoje". Com vencimento ontem, "Vencida/Vencido".
- CA12.4: Um aditivo de prazo que leva o vencimento para além de 90 dias remove o destaque imediatamente após salvar.
- CA12.5: O termo "a vencer" não aparece na interface.

### RF13. Início (tela principal de trabalho)

- CA13.1: A tela inicial mostra os vencimentos dos próximos 90 dias agrupados por mês, cada um identificado (tipo, número, objeto ou empresa, data e dias restantes) sem precisar passar o mouse ou clicar.
- CA13.2: Contadores: ARPs vencendo em até 90 dias, contratos vencendo em até 90 dias, OF/OS com entrega em até 3 dias, OF/OS atrasadas.
- CA13.3: Uma área lista as OF/OS pendentes com data limite a 3 dias corridos ou menos de hoje e as atrasadas, com itens e quantidades.
- CA13.4: Vencidos não aparecem nos contadores nem na lista de vencimentos (ver RF18).
- CA13.5: Telas de lista de ARPs e de contratos com filtros: situação (vigente, vencendo em 90 dias, vencida, encerrado), tipo de contrato e busca por número. Por padrão, mostram só os vigentes.
- CA13.6: Clicar em qualquer documento abre seu detalhe.

### RF14. Exportação

- CA14.1: A lista do painel, com os filtros aplicados, pode ser exportada para planilha que abre no Excel e no LibreOffice.
- CA14.2: A mesma lista pode ser exportada para PDF.
- CA14.3: O detalhe de uma ata e de um contrato (itens, saldos, aditivos, OF/OS) pode ser exportado para planilha e PDF.
- CA14.4: Valores e datas exportados são idênticos aos exibidos na tela.

### RF15. Exclusão

- CA15.1: Qualquer registro (ata, item, parcela, contrato, aditivo, OF/OS) pode ser excluído de forma definitiva, após confirmação explícita.
- CA15.2: Registro com dependentes (ex.: ata com contrato vinculado, contrato com OF/OS) não pode ser excluído. O sistema lista os dependentes que precisam ser removidos antes.
- CA15.3: Após excluir uma OF/OS ou desvincular um contrato, os saldos afetados são recalculados.

### RF16. Edição concorrente segura

- CA16.1: Dois usuários com o sistema aberto ao mesmo tempo, editando registros diferentes, salvam e nenhuma alteração é perdida.
- CA16.2: Se dois usuários alteram o mesmo registro, quem salva por último é avisado do conflito, vê as duas versões e escolhe qual manter. Nada é sobrescrito sem aviso.
- CA16.3: O usuário consegue recarregar os dados para ver o que os outros salvaram sem fechar o sistema.
- CA16.4: Se a pasta de rede estiver inacessível no momento de salvar, o sistema avisa e não descarta o que foi digitado.

### RF17. Visor para TV

Tela separada, para ficar aberta numa TV do setor, sem interação.

- CA17.1: Mostra contadores, vencimentos dos próximos 90 dias agrupados por mês e OF/OS com entrega em até 3 dias ou atrasadas, com itens e quantidades.
- CA17.2: Legível a 3 metros numa TV Full HD: números principais com pelo menos 5% da altura da tela, textos de identificação com pelo menos 2,2% da altura.
- CA17.3: Recarrega os dados da pasta a cada 5 minutos e mostra o horário da última atualização.
- CA17.4: Se o conteúdo não couber, alterna páginas automaticamente a cada 15 segundos, indicando a página atual.
- CA17.5: Mostra data e hora atuais e vira o dia sozinho (situações e prazos recalculados após a meia-noite).
- CA17.6: Exibe o nome do órgão e do setor.

### RF18. Vencidos

- CA18.1: ARP vencida sai automaticamente dos contadores, do Início e do visor. Continua consultável na lista de ARPs pelo filtro "Vencidas".
- CA18.2: Contrato vencido sem encerramento sai dos contadores principais e da lista de vencimentos, e fica numa área discreta "Vencidos aguardando encerramento" no Início, recolhida por padrão, com a quantidade visível.
- CA18.3: Ao registrar o encerramento, o contrato sai dessa área e fica consultável na lista de contratos pelo filtro "Encerrados".
- CA18.4: Nada é apagado automaticamente.

### RF19. Exportação completa dos dados

Para garantir que os dados possam ser levados para fora do sistema a qualquer momento.

- CA19.1: Um botão disponível em todas as telas gera uma única planilha .xlsx com as abas: ARPs, Itens das ARPs, Contratos, Itens dos contratos, Empresas.
- CA19.2: ARPs: número, objeto, vencimento original e atual, situação, quantidade de itens, valor registrado, contratos vinculados, aditivos (texto), observações.
- CA19.3: Itens das ARPs: número da ARP, vencimento, item, unidade, fornecedor, CNPJ, cota, quantidade registrada original e atual, já contratada, saldo, valor unitário original e atual.
- CA19.4: Contratos: número, tipo, objeto, número da ARP, empresa, CNPJ, início, vencimento original e atual, situação, encerramento, valor, gestor, fiscal, aditivos (texto), observações.
- CA19.5: Itens dos contratos: número do contrato, número da ARP, empresa, item, unidade, quantidade contratada original e atual, já solicitada em OF/OS, saldo, valor unitário atual, valor total. Sem detalhe de OF/OS.
- CA19.6: Empresas: nome, CNPJ, e-mail, telefone.
- CA19.7: As abas não têm fórmulas nem vínculos entre si. Cada aba repete as colunas de identificação necessárias para ser lida sozinha.

### RF20. Modo de visualização dos vencimentos

- CA20.1: No Início e no visor, os vencimentos dos próximos 90 dias podem ser vistos por mês (colunas) ou em lista (tabela ordenada por data).
- CA20.2: A escolha fica guardada no computador onde foi feita, separada para o Início e para o visor.
- CA20.3: No visor, a lista alterna páginas automaticamente quando não cabe.

### RF21. Ordenação das listas de ARPs e contratos

- CA21.1: As listas de ARPs e de contratos podem ser ordenadas por vencimento (padrão, mais próximo primeiro) ou por número.
- CA21.2: Por número, o formato NÚMERO/ANO é lido como número (9/2026 antes de 10/2026), com os mais recentes primeiro (ano maior, depois número maior). Prefixos como "ARP" e "Nº" são ignorados. Números fora desse formato vão para o fim, em ordem alfabética.
- CA21.3: A escolha fica guardada no computador, separada para ARPs e contratos.
- CA21.4: A escolha da ARP no cadastro do contrato e a exportação completa usam a ordem por número.

## 5. Requisitos não funcionais

- RNF01: Funciona no Google Chrome, aberto a partir da pasta de rede, sem instalar nada nas máquinas.
- RNF02: Funciona sem internet, desde que a pasta de rede esteja acessível.
- RNF03: Interface, mensagens e exportações em português, datas no formato dd/mm/aaaa e valores em R$.
- RNF04: Painel abre em até 3 segundos com 200 atas, 500 contratos e 2000 OF/OS.
- RNF05: Os dados ficam em arquivo dentro da pasta de rede, coberto pela cópia de segurança que a rede já faz.
- RNF06: Identidade visual conforme o Manual de Identidade Visual da Prefeitura de Fortaleza 2025-2028: paleta oficial (F15A22, 009889, 00A0DC, FFE6CB, 325565, 414042) e tipografia da família Rawline/Raleway.

## 6. Fora do escopo

- Envio ou preparação de e-mail, de qualquer forma.
- Notificação fora do sistema (os alertas aparecem só na tela, ao abrir).
- Login, perfis de acesso e registro de autoria das alterações.
- Edição em tempo real (ver alterações dos outros sem recarregar).
- Servidor próprio ou serviço rodando em segundo plano.
- Navegadores diferentes do Chrome e uso em celular.
- Importação das planilhas existentes (cadastro começa do zero).
- Itens de ata não aderidos pelo órgão.
- Validação de limites legais de prorrogação ou de acréscimo de aditivos.
- Entregas parciais de OF/OS.
- Registro de decisão de "não renovar" e opção de silenciar alertas de documentos vigentes.
- Relatórios ou visões por empresa.
- Cadastro de feriados e consideração de pontos facultativos.
- Situação "encerrado" para ata.
- Lixeira ou recuperação de registros excluídos.

## 7. Premissas adotadas (confirmar)

- P01: Um contrato é sempre com uma única empresa, e em contrato com ata só usa parcelas dessa empresa.
- P02: O aditivo de prazo do contrato não consome saldo da ata.
- P03: Os 3 dias de antecedência do alerta de OF/OS são corridos, mesmo quando o prazo de entrega é em dias úteis.
- P04: Carnaval e Corpus Christi entram como não úteis, por serem tratados assim pelo órgão.
- P05: A lista de feriados do RF11 deve ser validada pelo setor antes da implementação.

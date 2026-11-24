import { utils, writeFile, type WorkBook, type WorkSheet } from 'xlsx';
import {
  contratadoParcela,
  dataFimVigenteAta,
  dataFimVigenteContrato,
  emitidoNoPeriodo,
  quantidadeItemEm,
  quantidadeVigenteParcela,
  saldoItem,
  saldoParcela,
  situacaoAta,
  situacaoContrato,
  valorOrdem,
  valorTotalAta,
  valorTotalContrato,
  valorUnitarioEm,
  efeitoReequilibrioAta,
  valorParcelaEm,
} from '../dominio/calculos';
import { formatarData } from '../dominio/datas';
import { formatarQuantidade, centavosParaReais, quantidadeParaNumero, totalCentavos, valorParaReais } from '../dominio/numeros';
import { dataLimiteOrdem, situacaoOrdem } from '../dominio/prazos';
import { ROTULO_ADITIVO_ATA, ROTULO_ADITIVO_CONTRATO, ehSoRegistro, ROTULO_SITUACAO_ORDEM, rotuloSituacao, type Ata, type Contrato, type Empresa } from '../dominio/tipos';
import type { ItemEncontrado, LinhaDoc } from '../estado/seletores';
import { compararNumeroDoc, objetoAta } from '../dominio/texto';

/** Tipos de coluna: datas e valores saem como tipos de planilha, não como texto (design.md 5). */
type Fmt = 'texto' | 'data' | 'inteiro' | 'qtd' | 'moeda' | 'unitario';
type Coluna = [titulo: string, fmt: Fmt, largura?: number];
type Celula = string | number | null;

const FORMATOS: Record<Fmt, string | undefined> = {
  texto: undefined,
  data: 'dd/mm/yyyy',
  inteiro: '0',
  qtd: '#,##0.###',
  moeda: '"R$" #,##0.00',
  unitario: '"R$" #,##0.00##',
};

const data = (iso: string | null | undefined): Celula => iso || null;

function folha(colunas: Coluna[], linhas: Celula[][]): WorkSheet {
  const conv = linhas.map((l) =>
    l.map((v, i) => {
      if (colunas[i][1] === 'data' && typeof v === 'string') {
        const [a, m, d] = v.split('-').map(Number);
        return new Date(a, m - 1, d);
      }
      return v;
    }),
  );
  const ws = utils.aoa_to_sheet([colunas.map((c) => c[0]), ...conv], { cellDates: true });
  ws['!cols'] = colunas.map((c) => ({ wch: c[2] ?? Math.max(12, c[0].length + 2) }));
  const ref = utils.decode_range(ws['!ref'] ?? 'A1');
  for (let r = 1; r <= ref.e.r; r++)
    colunas.forEach((c, i) => {
      const cel = ws[utils.encode_cell({ r, c: i })];
      const z = FORMATOS[c[1]];
      if (cel && z) cel.z = z;
    });
  return ws;
}

function nomeArquivo(base: string) {
  const limpo = base.replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim();
  return `${limpo}.xlsx`;
}

function baixar(wb: WorkBook, nome: string) {
  writeFile(wb, nomeArquivo(nome), { compression: true });
}

export function exportarLista(linhas: LinhaDoc[], titulo: string, hoje: string) {
  const wb = utils.book_new();
  utils.book_append_sheet(
    wb,
    folha(
      [
        ['Tipo', 'texto', 10],
        ['Número', 'texto', 16],
        ['Objeto', 'texto', 48],
        ['Empresa', 'texto', 34],
        ['Material/Serviço', 'texto', 16],
        ['Início', 'data'],
        ['Vencimento', 'data'],
        ['Dias até o vencimento', 'inteiro', 20],
        ['Situação', 'texto'],
      ],
      linhas.map((l) => [
        l.tipo === 'ata' ? 'ARP' : 'Contrato',
        l.numero,
        l.objeto,
        l.empresa,
        l.tipoContrato === 'material' ? 'Material' : l.tipoContrato === 'servico' ? 'Serviço' : '',
        data(l.inicio),
        data(l.vencimento),
        l.dias,
        rotuloSituacao(l.situacao, l.tipo),
      ]),
    ),
    'Lista',
  );
  baixar(wb, `${titulo} ${hoje}`);
}

/** Resultado da busca de itens em todas as ARPs (revisão 9): uma linha por fornecedor do item. */
export function exportarItensEncontrados(itens: ItemEncontrado[], hoje: string) {
  const wb = utils.book_new();
  utils.book_append_sheet(
    wb,
    folha(
      [
        ['ARP', 'texto', 16],
        ['Objeto da ARP', 'texto', 40],
        ['Vencimento da ARP', 'data', 18],
        ['Situação da ARP', 'texto', 16],
        ['Item', 'texto', 44],
        ['Unidade', 'texto'],
        ['Fornecedor', 'texto', 34],
        ['Cota', 'texto'],
        ['Valor unitário (R$)', 'unitario', 18],
        ['Quantidade registrada', 'qtd', 20],
        ['Já contratada', 'qtd', 16],
        ['Saldo disponível', 'qtd', 16],
      ],
      itens.flatMap((it) =>
        it.parcelas.map((p) => [
          it.ataNumero,
          it.ataObjeto,
          data(it.vencimento),
          rotuloSituacao(it.situacao, 'ata'),
          it.item.descricao,
          it.item.unidade,
          p.empresa,
          p.parcela.tipoCota === 'ampla' ? 'Ampla' : 'Cota ME/EPP',
          valorParaReais(p.valor),
          quantidadeParaNumero(p.registrada),
          quantidadeParaNumero(p.contratada),
          quantidadeParaNumero(p.saldo),
        ]),
      ),
    ),
    'Itens',
  );
  baixar(wb, `Itens das ARPs ${hoje}`);
}

export function exportarAta(ata: Ata, empresas: Map<string, Empresa>, contratos: Contrato[], hoje: string) {
  const wb = utils.book_new();
  const nomeEmp = (id: string) => empresas.get(id)?.nome ?? '';
  utils.book_append_sheet(
    wb,
    folha(
      [['Campo', 'texto', 22], ['Valor', 'texto', 60]],
      [
        ['Número', ata.numero],
        ['Objeto', objetoAta(ata)],
        ['Vencimento original', formatarData(ata.dataFim)],
        ['Vencimento', formatarData(dataFimVigenteAta(ata))],
        ['Situação', rotuloSituacao(situacaoAta(ata, hoje), 'ata')],
        ['Valor registrado (R$)', centavosParaReais(valorTotalAta(ata, hoje))],
        ['Observações', ata.observacoes],
      ],
    ),
    'Ata',
  );
  utils.book_append_sheet(
    wb,
    folha(
      [
        ['Item', 'texto', 44],
        ['Unidade', 'texto'],
        ['Fornecedor', 'texto', 34],
        ['Cota', 'texto'],
        ['Qtd. registrada original', 'qtd', 20],
        ['Qtd. registrada', 'qtd'],
        ['Já contratada', 'qtd'],
        ['Saldo disponível', 'qtd'],
        ['Valor unitário original', 'unitario', 18],
        ['Valor unitário atual', 'unitario', 18],
      ],
      ata.itens.flatMap((it) =>
        it.parcelas.map((p) => [
          it.descricao,
          it.unidade,
          nomeEmp(p.empresaId),
          p.tipoCota === 'ampla' ? 'Ampla' : 'Cota ME/EPP',
          quantidadeParaNumero(p.quantidade),
          quantidadeParaNumero(quantidadeVigenteParcela(ata, p)),
          quantidadeParaNumero(contratadoParcela(p.id, contratos)),
          quantidadeParaNumero(saldoParcela(ata, p, contratos)),
          valorParaReais(p.valorUnitario),
          valorParaReais(valorParcelaEm(ata, p, hoje)),
        ]),
      ),
    ),
    'Itens e saldos',
  );
  utils.book_append_sheet(
    wb,
    folha(
      [['Aditivo', 'texto', 24], ['Data', 'data'], ['Tipo', 'texto', 18], ['Nova data fim', 'data'], ['Início dos efeitos', 'data', 16], ['Observações', 'texto', 40]],
      ata.aditivos.map((a) => [a.identificacao, a.data, ROTULO_ADITIVO_ATA[a.tipo], a.novaDataFim, a.tipo === 'reequilibrio' ? efeitoReequilibrioAta(a) : null, a.observacoes]),
    ),
    'Aditivos',
  );
  baixar(wb, `Ata ${ata.numero}`);
}

export function exportarContrato(c: Contrato, empresa: Empresa | undefined, ata: Ata | undefined, hoje: string) {
  const wb = utils.book_new();
  utils.book_append_sheet(
    wb,
    folha(
      [['Campo', 'texto', 22], ['Valor', 'texto', 60]],
      [
        ['Número', c.numero],
        ['Empresa', empresa?.nome ?? ''],
        ['CNPJ', empresa?.cnpj ?? ''],
        ['Tipo', c.tipo === 'material' ? 'Material' : 'Serviço'],
        ['Objeto', c.objeto],
        ['Ata', ata?.numero ?? 'Sem ata'],
        ['Início', formatarData(c.dataInicio)],
        ['Vencimento original', formatarData(c.dataFim)],
        ['Vencimento', formatarData(dataFimVigenteContrato(c))],
        ['Situação', rotuloSituacao(situacaoContrato(c, hoje), 'contrato')],
        ['Valor do contrato (R$)', centavosParaReais(valorTotalContrato(c, hoje))],
        ['Gestor', c.gestor],
        ['Fiscal', c.fiscal],
        ['Encerramento', c.encerramento ? `${formatarData(c.encerramento.data)} ${c.encerramento.termo}` : ''],
        ['Observações', c.observacoes],
      ],
    ),
    'Contrato',
  );
  utils.book_append_sheet(
    wb,
    folha(
      [
        ['Item', 'texto', 44],
        ['Unidade', 'texto'],
        ['Qtd. contratada original', 'qtd', 20],
        ['Qtd. contratada', 'qtd'],
        ['Já solicitada em OF/OS', 'qtd', 20],
        ['Saldo disponível', 'qtd', 16],
        ['Valor unitário atual', 'unitario', 18],
        ['Valor total', 'moeda', 16],
      ],
      c.itens.map((it) => [
        it.descricao,
        it.unidade,
        quantidadeParaNumero(it.quantidade),
        quantidadeParaNumero(quantidadeItemEm(c, it.id, hoje)),
        quantidadeParaNumero(emitidoNoPeriodo(c, it.id, hoje)),
        quantidadeParaNumero(saldoItem(c, it.id, hoje)),
        valorParaReais(valorUnitarioEm(c, it.id, hoje)),
        centavosParaReais(totalCentavos(quantidadeItemEm(c, it.id, hoje), valorUnitarioEm(c, it.id, hoje))),
      ]),
    ),
    'Itens e saldos',
  );
  utils.book_append_sheet(
    wb,
    folha(
      [['Aditivo', 'texto', 24], ['Tipo', 'texto', 16], ['Assinatura', 'data'], ['Início dos efeitos', 'data', 16], ['Nova data fim', 'data', 14], ['Observações', 'texto', 40]],
      c.aditivos.map((a) => [a.identificacao, ROTULO_ADITIVO_CONTRATO[a.tipo], a.dataAssinatura, a.inicioEfeitos, a.novaDataFim, a.observacoes]),
    ),
    'Aditivos',
  );
  utils.book_append_sheet(
    wb,
    folha(
      [['Número', 'texto', 16], ['Itens', 'texto', 50], ['Emissão', 'data'], ['Prazo', 'texto'], ['Data limite', 'data'], ['Entrega', 'data'], ['Situação', 'texto'], ['Valor', 'moeda', 16], ['Observações', 'texto', 30]],
      c.ordens.map((o) => [
        o.numero,
        o.itens.map((it) => { const item = c.itens.find((x) => x.id === it.itemId); return `${formatarQuantidade(it.quantidade)} ${item?.unidade ?? ''} ${item?.descricao ?? ''}`.replace(/\s+/g, ' ').trim(); }).join('; '),
        o.dataEmissao,
        `${o.prazoDias} ${o.tipoPrazo === 'uteis' ? 'úteis' : 'corridos'}`,
        dataLimiteOrdem(o),
        o.dataEntrega,
        ROTULO_SITUACAO_ORDEM[situacaoOrdem(o, hoje)],
        centavosParaReais(valorOrdem(c, o)),
        o.observacoes,
      ]),
    ),
    c.tipo === 'material' ? 'Ordens de fornecimento' : 'Ordens de serviço',
  );
  baixar(wb, `Contrato ${c.numero}`);
}

// ---------- Exportação completa (RF19): uma planilha, abas independentes, só valores ----------

/**
 * Todos os dados de ARPs, contratos e empresas, para guardar fora do sistema.
 * Cada aba repete as colunas de identificação (número da ARP, do contrato, empresa)
 * para ser lida sozinha, sem fórmulas nem vínculos entre abas.
 */
export function montarExportacaoCompleta(atas: Ata[], contratos: Contrato[], empresas: Map<string, Empresa>, hoje: string): WorkBook {
  const wb = utils.book_new();
  const emp = (id: string) => empresas.get(id);
  const atasPorId = new Map(atas.map((a) => [a.id, a]));
  const ordAtas = [...atas].sort((a, b) => compararNumeroDoc(a.numero, b.numero));
  const ordContratos = [...contratos].sort((a, b) => compararNumeroDoc(a.numero, b.numero));

  utils.book_append_sheet(
    wb,
    folha(
      [
        ['Número da ARP', 'texto', 16],
        ['Objeto', 'texto', 44],
        ['Vencimento original', 'data', 18],
        ['Vencimento atual', 'data', 16],
        ['Situação', 'texto'],
        ['Qtd. de itens', 'inteiro'],
        ['Valor registrado', 'moeda', 18],
        ['Contratos vinculados', 'texto', 30],
        ['Aditivos', 'texto', 50],
        ['Observações', 'texto', 40],
      ],
      ordAtas.map((a) => [
        a.numero,
        objetoAta(a),
        data(a.dataFim),
        data(dataFimVigenteAta(a)),
        rotuloSituacao(situacaoAta(a, hoje), 'ata'),
        a.itens.length,
        centavosParaReais(valorTotalAta(a, hoje)),
        ordContratos.filter((c) => c.ataId === a.id).map((c) => c.numero).join(', '),
        [...a.aditivos]
          .sort((x, y) => x.data.localeCompare(y.data))
          .map((x) => `${x.identificacao || 'Aditivo'} (${ROTULO_ADITIVO_ATA[x.tipo]}, ${formatarData(x.data)}${x.novaDataFim ? `, vence ${formatarData(x.novaDataFim)}` : ''}${x.tipo === 'reequilibrio' ? `, valores a partir de ${formatarData(efeitoReequilibrioAta(x))}` : ''})`)
          .join('; '),
        a.observacoes,
      ]),
    ),
    'ARPs',
  );

  utils.book_append_sheet(
    wb,
    folha(
      [
        ['Número da ARP', 'texto', 16],
        ['Vencimento da ARP', 'data', 18],
        ['Item', 'texto', 44],
        ['Unidade', 'texto'],
        ['Fornecedor', 'texto', 34],
        ['CNPJ do fornecedor', 'texto', 20],
        ['Cota', 'texto'],
        ['Qtd. registrada original', 'qtd', 22],
        ['Qtd. registrada atual', 'qtd', 20],
        ['Já contratada', 'qtd', 14],
        ['Saldo disponível', 'qtd', 16],
        ['Valor unitário original', 'unitario', 18],
        ['Valor unitário atual', 'unitario', 18],
      ],
      ordAtas.flatMap((a) =>
        a.itens.flatMap((it) =>
          it.parcelas.map((p) => [
            a.numero,
            data(dataFimVigenteAta(a)),
            it.descricao,
            it.unidade,
            emp(p.empresaId)?.nome ?? '',
            emp(p.empresaId)?.cnpj ?? '',
            p.tipoCota === 'ampla' ? 'Ampla' : 'Cota ME/EPP',
            quantidadeParaNumero(p.quantidade),
            quantidadeParaNumero(quantidadeVigenteParcela(a, p)),
            quantidadeParaNumero(contratadoParcela(p.id, contratos)),
            quantidadeParaNumero(saldoParcela(a, p, contratos)),
            valorParaReais(p.valorUnitario),
            valorParaReais(valorParcelaEm(a, p, hoje)),
          ]),
        ),
      ),
    ),
    'Itens das ARPs',
  );

  utils.book_append_sheet(
    wb,
    folha(
      [
        ['Número do contrato', 'texto', 18],
        ['Tipo', 'texto'],
        ['Objeto', 'texto', 44],
        ['Número da ARP', 'texto', 16],
        ['Empresa', 'texto', 34],
        ['CNPJ', 'texto', 20],
        ['Início', 'data'],
        ['Vencimento original', 'data', 18],
        ['Vencimento atual', 'data', 16],
        ['Situação', 'texto'],
        ['Encerrado em', 'data', 14],
        ['Termo de encerramento', 'texto', 28],
        ['Valor do contrato', 'moeda', 18],
        ['Gestor', 'texto', 24],
        ['Fiscal', 'texto', 24],
        ['Aditivos', 'texto', 50],
        ['Observações', 'texto', 40],
      ],
      ordContratos.map((c) => [
        c.numero,
        c.tipo === 'material' ? 'Material' : 'Serviço',
        c.objeto,
        c.ataId ? atasPorId.get(c.ataId)?.numero ?? '' : 'Sem ARP',
        emp(c.empresaId)?.nome ?? '',
        emp(c.empresaId)?.cnpj ?? '',
        data(c.dataInicio),
        data(c.dataFim),
        data(dataFimVigenteContrato(c)),
        rotuloSituacao(situacaoContrato(c, hoje), 'contrato'),
        data(c.encerramento?.data),
        c.encerramento?.termo ?? '',
        centavosParaReais(valorTotalContrato(c, hoje)),
        c.gestor,
        c.fiscal,
        [...c.aditivos]
          .sort((x, y) => x.inicioEfeitos.localeCompare(y.inicioEfeitos))
          .map((x) => `${x.identificacao || 'Aditivo'} (${ROTULO_ADITIVO_CONTRATO[x.tipo]}, ${ehSoRegistro(x.tipo) ? formatarData(x.dataAssinatura) : `a partir de ${formatarData(x.inicioEfeitos)}`}${x.novaDataFim ? `, vence ${formatarData(x.novaDataFim)}` : ''})`)
          .join('; '),
        c.observacoes,
      ]),
    ),
    'Contratos',
  );

  utils.book_append_sheet(
    wb,
    folha(
      [
        ['Número do contrato', 'texto', 18],
        ['Número da ARP', 'texto', 16],
        ['Empresa', 'texto', 34],
        ['Item', 'texto', 44],
        ['Unidade', 'texto'],
        ['Qtd. contratada original', 'qtd', 22],
        ['Qtd. contratada atual', 'qtd', 20],
        ['Já solicitada em OF/OS', 'qtd', 20],
        ['Saldo disponível', 'qtd', 16],
        ['Valor unitário atual', 'unitario', 18],
        ['Valor total', 'moeda', 16],
      ],
      ordContratos.flatMap((c) =>
        c.itens.map((it) => {
          const q = quantidadeItemEm(c, it.id, hoje);
          const v = valorUnitarioEm(c, it.id, hoje);
          return [
            c.numero,
            c.ataId ? atasPorId.get(c.ataId)?.numero ?? '' : 'Sem ARP',
            emp(c.empresaId)?.nome ?? '',
            it.descricao,
            it.unidade,
            quantidadeParaNumero(it.quantidade),
            quantidadeParaNumero(q),
            quantidadeParaNumero(emitidoNoPeriodo(c, it.id, hoje)),
            quantidadeParaNumero(saldoItem(c, it.id, hoje)),
            valorParaReais(v),
            centavosParaReais(totalCentavos(q, v)),
          ];
        }),
      ),
    ),
    'Itens dos contratos',
  );

  utils.book_append_sheet(
    wb,
    folha(
      [
        ['Empresa', 'texto', 38],
        ['CNPJ', 'texto', 20],
        ['E-mail', 'texto', 36],
        ['Telefone', 'texto', 18],
      ],
      [...empresas.values()]
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
        .map((e) => [e.nome, e.cnpj ?? '', e.email, e.telefone]),
    ),
    'Empresas',
  );

  return wb;
}

export function exportarTudo(atas: Ata[], contratos: Contrato[], empresas: Map<string, Empresa>, hoje: string) {
  baixar(montarExportacaoCompleta(atas, contratos, empresas, hoje), `Vigencias - todos os dados ${hoje}`);
}

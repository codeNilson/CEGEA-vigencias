import { describe, expect, it } from 'vitest';
import { novaAta, novaEmpresa, novoContrato } from '../dominio/fabrica';
import {
  atasParaContrato,
  buscarItensAtas,
  contratosDaAta,
  filtrarDocumentos,
  filtrarItensAta,
  filtrarItensContrato,
  filtrarLancamento,
  filtrarOrdens,
  limitar,
  linhasDocumentos,
  paginar,
  parcelasParaItemContrato,
  separarOrdensPorVigencia,
  todasOrdens,
} from './seletores';
import { repositorioDemonstracao } from './demo';
import { validarArquivo, type Ata, type Colecao, type Contrato } from '../dominio/tipos';
import { validarContrato } from '../dominio/validacoes';

const Q = (n: number) => n * 1000;
const V = (n: number) => Math.round(n * 10000);
const HOJE = '2026-11-19';

describe('CA03.5 e CA07.4 fichas da ARP e do contrato', () => {
  const emp = new Map([
    ['f1', 'Papelaria Ribeira'],
    ['f2', 'Mucuripe ME'],
  ]);
  const nome = (id: string) => emp.get(id) ?? '';
  const parcela = (id: string, empresaId: string) => ({ id, empresaId, tipoCota: 'ampla' as const, quantidade: Q(10), valorUnitario: V(1) });
  const ata = novaAta({
    numero: '001/2026',
    dataFim: '2027-01-01',
    itens: [
      { id: 'i1', descricao: 'Papel A4', unidade: 'resma', parcelas: [parcela('p1', 'f1'), parcela('p2', 'f2')] },
      { id: 'i2', descricao: 'Caneta', unidade: 'cx', parcelas: [parcela('p3', 'f1')] },
    ],
  });
  const resumo = (r: ReturnType<typeof filtrarItensAta>) => r.map((x) => [x.item.id, x.parcelas.map((p) => p.id)]);

  it('itens da ARP: busca no item mostra todos os fornecedores; busca ou filtro de fornecedor mostra só ele', () => {
    expect(resumo(filtrarItensAta(ata, { busca: '', empresaId: '' }, nome))).toEqual([['i1', ['p1', 'p2']], ['i2', ['p3']]]);
    expect(resumo(filtrarItensAta(ata, { busca: 'a4', empresaId: '' }, nome))).toEqual([['i1', ['p1', 'p2']]]);
    expect(resumo(filtrarItensAta(ata, { busca: 'mucuripe', empresaId: '' }, nome))).toEqual([['i1', ['p2']]]);
    expect(resumo(filtrarItensAta(ata, { busca: '', empresaId: 'f1' }, nome))).toEqual([['i1', ['p1']], ['i2', ['p3']]]);
    expect(resumo(filtrarItensAta(ata, { busca: 'caneta', empresaId: 'f2' }, nome))).toEqual([]);
  });

  it('contratos da ARP: não encerrados por vencimento, encerrados à parte', () => {
    const c1 = novoContrato({ numero: '2/2026', ataId: ata.id, dataFim: '2027-05-01' });
    const c2 = novoContrato({ numero: '1/2026', ataId: ata.id, dataFim: '2026-12-01' });
    const c3 = novoContrato({ numero: '3/2025', ataId: ata.id, dataFim: '2026-01-01', encerramento: { data: '2026-01-05', termo: '' } });
    const outro = novoContrato({ numero: '9/2026', ataId: 'outra' });
    const r = contratosDaAta(ata.id, [c1, c2, c3, outro]);
    expect(r.ativos.map((c) => c.numero)).toEqual(['1/2026', '2/2026']);
    expect(r.encerrados.map((c) => c.numero)).toEqual(['3/2025']);
  });

  it('OF/OS do contrato: vigência atual separada das anteriores, mais recentes primeiro', () => {
    const ordem = (id: string, dataEmissao: string) => ({ id, numero: id, dataEmissao, prazoDias: 5, tipoPrazo: 'corridos' as const, dataEntrega: dataEmissao, itens: [], observacoes: '' });
    const c = novoContrato({
      dataInicio: '2025-01-01',
      dataFim: '2025-12-31',
      aditivos: [{ id: 'ad', identificacao: '', tipo: 'prazo', dataAssinatura: '2025-12-01', inicioEfeitos: '2026-01-01', novaDataFim: '2026-12-31', alteracoes: [], observacoes: '' }],
      ordens: [ordem('a', '2025-03-01'), ordem('b', '2026-02-01'), ordem('c', '2025-10-01'), ordem('d', '2026-06-01')],
    });
    const r = separarOrdensPorVigencia(c, HOJE);
    expect(r.atuais.map((o) => o.id)).toEqual(['d', 'b']);
    expect(r.anteriores.map((o) => o.id)).toEqual(['c', 'a']);
  });

  it('itens do contrato: busca sem acento pela descrição ou unidade', () => {
    const itens = [
      { id: '1', parcelaId: null, descricao: 'Água mineral', unidade: 'garrafão', quantidade: Q(1), valorUnitario: V(1) },
      { id: '2', parcelaId: null, descricao: 'Copo descartável', unidade: 'pct', quantidade: Q(1), valorUnitario: V(1) },
    ];
    expect(filtrarItensContrato(itens, 'agua').map((i) => i.id)).toEqual(['1']);
    expect(filtrarItensContrato(itens, 'pct').map((i) => i.id)).toEqual(['2']);
    expect(filtrarItensContrato(itens, ' ')).toHaveLength(2);
  });
});

describe('CA21.5 e CA10.12 filtros das listas de contratos e OF/OS', () => {
  const a = novaEmpresa({ nome: 'Água Pura Ltda' });
  const b = novaEmpresa({ nome: 'Beta ME' });
  const ordem = (id: string, numero: string, dataEmissao: string, dataEntrega: string | null) => ({ id, numero, dataEmissao, prazoDias: 5, tipoPrazo: 'corridos' as const, dataEntrega, itens: [], observacoes: '' });
  const c1 = novoContrato({ numero: '010/2026', empresaId: a.id, tipo: 'material', objeto: 'Água mineral', dataInicio: '2026-01-01', dataFim: '2027-01-01', ordens: [ordem('o1', 'OF 001/2026', '2026-11-18', null), ordem('o2', 'OF 002/2026', '2026-02-01', '2026-02-03')] });
  const c2 = novoContrato({ numero: '005/2025', empresaId: b.id, tipo: 'servico', objeto: 'Limpeza', dataInicio: '2025-01-01', dataFim: '2026-01-01', ordens: [ordem('o3', 'OS 003/2025', '2025-11-01', null)] });
  const c3 = novoContrato({ numero: '020/2026', empresaId: a.id, tipo: 'servico', objeto: 'Manutenção', dataInicio: '2026-03-01', dataFim: '2027-06-01' });
  const estado = { atas: new Map(), contratos: new Map([c1, c2, c3].map((c) => [c.id, c])), empresas: new Map([a, b].map((e) => [e.id, e])), hoje: HOJE };
  const docs = linhasDocumentos(estado);
  const nums = (r: Array<{ numero: string }>) => r.map((l) => l.numero);

  it('contratos: empresa, modalidade e situação se combinam; busca ignora acento', () => {
    expect(nums(filtrarDocumentos(docs, { filtro: 'todos', empresaId: a.id }))).toEqual(['010/2026', '020/2026']);
    expect(nums(filtrarDocumentos(docs, { filtro: 'todos', empresaId: a.id, modalidade: 'servico' }))).toEqual(['020/2026']);
    expect(nums(filtrarDocumentos(docs, { filtro: 'vigentes' }))).toEqual(['010/2026', '020/2026']);
    expect(nums(filtrarDocumentos(docs, { filtro: 'todos', busca: 'agua mineral' }))).toEqual(['010/2026']);
    expect(nums(filtrarDocumentos(docs, { filtro: 'todos', ordem: 'numero' }))).toEqual(['020/2026', '010/2026', '005/2025']);
  });
  it('OF/OS: empresa e busca sem acento', () => {
    const ordens = todasOrdens(estado);
    const ids = (r: typeof ordens) => r.map((o) => o.ordem.id).sort();
    expect(ids(filtrarOrdens(ordens, { filtro: 'todas', empresaId: a.id }))).toEqual(['o1', 'o2']);
    expect(ids(filtrarOrdens(ordens, { filtro: 'abertas' }))).toEqual(['o1', 'o3']);
    expect(ids(filtrarOrdens(ordens, { filtro: 'atrasada' }))).toEqual(['o3']);
    expect(ids(filtrarOrdens(ordens, { filtro: 'todas', busca: 'agua pura' }))).toEqual(['o1', 'o2']);
  });
});

describe('CA10.11 filtro das tabelas de lançamento', () => {
  const linhas = [
    { id: 'a', desc: 'Papel A4', forn: 'f1' },
    { id: 'b', desc: 'Caneta azul', forn: 'f2' },
    { id: 'c', desc: 'Pápel ofício', forn: 'f2' },
  ];
  const qtds: Record<string, string> = { b: '3', c: '' };
  const base = { busca: '', soPreenchidas: false, textoBusca: (l: (typeof linhas)[number]) => l.desc, preenchida: (l: (typeof linhas)[number]) => !!qtds[l.id]?.trim() };
  const ids = (r: typeof linhas) => r.map((l) => l.id);
  it('sem filtro mostra tudo; busca ignora acento', () => {
    expect(ids(filtrarLancamento(linhas, base))).toEqual(['a', 'b', 'c']);
    expect(ids(filtrarLancamento(linhas, { ...base, busca: 'papel' }))).toEqual(['a', 'c']);
  });
  it('só preenchidas e filtro extra se combinam com a busca', () => {
    expect(ids(filtrarLancamento(linhas, { ...base, soPreenchidas: true }))).toEqual(['b']);
    expect(ids(filtrarLancamento(linhas, { ...base, filtroExtra: (l) => l.forn === 'f2', busca: 'papel' }))).toEqual(['c']);
  });
});

describe('CA13.7 limite de cartões no Início', () => {
  const lista = Array.from({ length: 10 }, (_, i) => i);
  it('mostra os primeiros e conta os ocultos', () => {
    expect(limitar(lista, 6, false)).toEqual({ visiveis: [0, 1, 2, 3, 4, 5], ocultos: 4 });
  });
  it('com "ver todos", ou sobrando só um, mostra tudo sem botão', () => {
    expect(limitar(lista, 6, true)).toEqual({ visiveis: lista, ocultos: 0 });
    expect(limitar(lista.slice(0, 7), 6, false)).toEqual({ visiveis: lista.slice(0, 7), ocultos: 0 });
    expect(limitar([], 6, false)).toEqual({ visiveis: [], ocultos: 0 });
  });
});

describe('paginação', () => {
  const lista = Array.from({ length: 45 }, (_, i) => i + 1);
  it('recorta a página pedida', () => {
    const p = paginar(lista, 2, 20);
    expect(p.itens[0]).toBe(21);
    expect(p.itens).toHaveLength(20);
    expect(p.paginas).toBe(3);
    expect(p.total).toBe(45);
  });
  it('página além do fim vai para a última; lista vazia tem uma página', () => {
    expect(paginar(lista, 9, 20)).toMatchObject({ pagina: 3, itens: [41, 42, 43, 44, 45] });
    expect(paginar([], 3, 20)).toMatchObject({ pagina: 1, paginas: 1, itens: [] });
    expect(paginar(lista, 0, 20).pagina).toBe(1);
  });
});

describe('CA05.10 escolha da ARP no contrato', () => {
  const emp = novaEmpresa({ nome: 'Papelaria' });
  const outra = novaEmpresa({ nome: 'Outra' });
  const parcela = (id: string, empresaId: string) => ({ id, empresaId, tipoCota: 'ampla' as const, quantidade: Q(10), valorUnitario: V(1) });
  const daEmpresa = novaAta({ numero: '005/2026', dataFim: '2027-03-01', itens: [{ id: 'i1', descricao: 'Papel', unidade: 'resma', parcelas: [parcela('p1', emp.id)] }] });
  const vigenteOutra = novaAta({ numero: '009/2026', dataFim: '2027-05-01', itens: [{ id: 'i2', descricao: 'Caneta', unidade: 'cx', parcelas: [parcela('p2', outra.id)] }] });
  const vigenteOutra2 = novaAta({ numero: '010/2026', dataFim: '2027-05-01' });
  const vencidaDaEmpresa = novaAta({ numero: '020/2025', dataFim: '2026-01-10', itens: [{ id: 'i3', descricao: 'Clipe', unidade: 'cx', parcelas: [parcela('p3', emp.id)] }] });
  const atas = [vencidaDaEmpresa, vigenteOutra, daEmpresa, vigenteOutra2];

  it('vigentes da empresa primeiro, depois outras vigentes por número, vencidas no fim', () => {
    const r = atasParaContrato(atas, emp.id, HOJE);
    expect(r.map((o) => [o.ata.numero, o.grupo])).toEqual([
      ['005/2026', 'empresa'],
      ['010/2026', 'vigentes'],
      ['009/2026', 'vigentes'],
      ['020/2025', 'vencidas'],
    ]);
    expect(r[0].itensDaEmpresa).toBe(1);
    expect(r[3].situacao).toBe('vencido');
  });
  it('sem empresa escolhida: vigentes e depois vencidas', () => {
    expect(atasParaContrato(atas, '', HOJE).map((o) => o.grupo)).toEqual(['vigentes', 'vigentes', 'vigentes', 'vencidas']);
  });
});

describe('CA06.4 escolha do item da ARP no item do contrato', () => {
  const emp = novaEmpresa({ nome: 'Papelaria' });
  const ata = novaAta({
    numero: '005/2026',
    dataFim: '2027-03-01',
    itens: [
      { id: 'i1', descricao: 'Papel', unidade: 'resma', parcelas: [{ id: 'p1', empresaId: emp.id, tipoCota: 'ampla', quantidade: Q(10), valorUnitario: V(1) }] },
      { id: 'i2', descricao: 'Caneta', unidade: 'cx', parcelas: [{ id: 'p2', empresaId: emp.id, tipoCota: 'ampla', quantidade: Q(5), valorUnitario: V(2) }, { id: 'p2x', empresaId: 'outra', tipoCota: 'cota_me', quantidade: Q(5), valorUnitario: V(2) }] },
      { id: 'i3', descricao: 'Clipe', unidade: 'cx', parcelas: [{ id: 'p3', empresaId: emp.id, tipoCota: 'ampla', quantidade: Q(8), valorUnitario: V(3) }] },
    ],
  });
  const outroContrato = novoContrato({ empresaId: emp.id, ataId: ata.id, itens: [{ id: 'x1', parcelaId: 'p1', descricao: 'Papel', unidade: 'resma', quantidade: Q(10), valorUnitario: V(1) }] });
  const contrato = novoContrato({ empresaId: emp.id, ataId: ata.id, itens: [{ id: 'c3', parcelaId: 'p3', descricao: 'Clipe', unidade: 'cx', quantidade: Q(3), valorUnitario: V(3) }] });

  it('só parcelas da empresa; sem saldo vão para o fim; desconta outros itens do mesmo contrato', () => {
    const r = parcelasParaItemContrato(ata, contrato, [outroContrato, contrato]);
    expect(r.map((o) => [o.parcela.id, o.saldo])).toEqual([
      ['p2', Q(5)],
      ['p3', Q(5)],
      ['p1', 0],
    ]);
  });
  it('na edição, o próprio item não desconta o saldo', () => {
    const r = parcelasParaItemContrato(ata, contrato, [outroContrato, contrato], 'c3');
    expect(r.find((o) => o.parcela.id === 'p3')?.saldo).toBe(Q(8));
  });
});

describe('demonstração grande', () => {
  it('gera volume para conferir busca e paginação', async () => {
    const repo = await repositorioDemonstracao({ grande: true });
    const atas = await repo.listar('atas');
    const contratos = await repo.listar('contratos');
    expect(atas.length).toBeGreaterThanOrEqual(40);
    expect(contratos.length).toBeGreaterThanOrEqual(150);
    const ler = async (c: Colecao) =>
      Promise.all(
        (await repo.listar(c)).map(async (e) => {
          const v = validarArquivo(c, (await repo.ler(c, e.id))!.dados);
          if (!v.ok) throw new Error(`${c}/${e.id}: ${v.erro}`);
          return v.valor;
        }),
      );
    const mapaAtas = new Map(((await ler('atas')) as Ata[]).map((a) => [a.id, a]));
    const todos = (await ler('contratos')) as Contrato[];
    await ler('empresas');
    for (const c of todos) expect(validarContrato(c, todos, mapaAtas, c), c.numero).toEqual([]);
  });
});

describe('CA23 busca de itens em todas as ARPs (revisão 9)', () => {
  const HOJE9 = '2026-11-24';
  const f1 = novaEmpresa({ id: 'f1', nome: 'Papelaria Ribeira' });
  const f2 = novaEmpresa({ id: 'f2', nome: 'Mucuripe ME' });
  const empresas = new Map([[f1.id, f1], [f2.id, f2]]);
  const parcela = (id: string, empresaId: string, q = 10, v = 2) => ({ id, empresaId, tipoCota: 'ampla' as const, quantidade: Q(q), valorUnitario: V(v) });
  const vigente = novaAta({
    id: 'a1', numero: '010/2026', dataFim: '2027-06-01',
    itens: [
      { id: 'i1', descricao: 'Cimento CP II', unidade: 'saco', parcelas: [parcela('p1', 'f1'), parcela('p2', 'f2')] },
      { id: 'i2', descricao: 'Areia média', unidade: 'm³', parcelas: [parcela('p3', 'f1')] },
    ],
    aditivos: [{ id: 'ad1', identificacao: '1º', data: '2026-10-01', tipo: 'reequilibrio', novaDataFim: null, quantidades: [], inicioEfeitos: '2026-10-01', valores: [{ parcelaId: 'p1', novoValorUnitario: V(3) }], observacoes: '' }],
  });
  const vencida = novaAta({
    id: 'a2', numero: '002/2025', dataFim: '2026-01-01',
    itens: [{ id: 'i3', descricao: 'CIMENTO branco', unidade: 'kg', parcelas: [parcela('p4', 'f2')] }],
  });
  const contrato = novoContrato({ id: 'c1', ataId: 'a1', empresaId: 'f2', itens: [{ id: 'ci', parcelaId: 'p2', descricao: 'Cimento CP II', unidade: 'saco', quantidade: Q(10), valorUnitario: V(2) }] });
  const base = { atas: new Map([[vigente.id, vigente], [vencida.id, vencida]]), contratos: new Map([[contrato.id, contrato]]), empresas, hoje: HOJE9 };

  it('CA23.1 busca sem acento em todas as ARPs, por descrição ou fornecedor', () => {
    const r = buscarItensAtas(base, { busca: 'cimento', filtro: 'todos' });
    expect(r.map((x) => x.item.id)).toEqual(['i3', 'i1']);
    expect(buscarItensAtas(base, { busca: 'areia media', filtro: 'todos' }).map((x) => x.item.id)).toEqual(['i2']);
    const porFornecedor = buscarItensAtas(base, { busca: 'mucuripe', filtro: 'todos' });
    expect(porFornecedor.flatMap((x) => x.parcelas.map((p) => p.parcela.id))).toEqual(['p4', 'p2']);
  });

  it('CA23.2 sem busca nem fornecedor não lista nada; fornecedor sozinho lista os itens dele', () => {
    expect(buscarItensAtas(base, { busca: '  ', filtro: 'todos' })).toEqual([]);
    expect(buscarItensAtas(base, { busca: '', empresaId: 'f1', filtro: 'todos' }).map((x) => x.item.id)).toEqual(['i1', 'i2']);
  });

  it('CA23.3 filtro por situação da ARP e "só com saldo"', () => {
    expect(buscarItensAtas(base, { busca: 'cimento', filtro: 'vigentes' }).map((x) => x.ataId)).toEqual(['a1']);
    expect(buscarItensAtas(base, { busca: 'cimento', filtro: 'vencidos' }).map((x) => x.ataId)).toEqual(['a2']);
    const comSaldo = buscarItensAtas(base, { busca: 'cimento cp', filtro: 'vigentes', soComSaldo: true });
    expect(comSaldo[0].parcelas.map((p) => p.parcela.id)).toEqual(['p1']);
  });

  it('CA23.4 saldo desconta a quantidade contratada e o valor é o vigente hoje', () => {
    const [it1] = buscarItensAtas(base, { busca: 'cimento cp', filtro: 'vigentes' });
    const p1 = it1.parcelas.find((p) => p.parcela.id === 'p1')!;
    const p2 = it1.parcelas.find((p) => p.parcela.id === 'p2')!;
    expect(p1.valor).toBe(V(3));
    expect(p2).toMatchObject({ registrada: Q(10), contratada: Q(10), saldo: 0, valor: V(2) });
  });
});

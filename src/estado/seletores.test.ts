import { describe, expect, it } from 'vitest';
import { novaAta, novaEmpresa, novoContrato } from '../dominio/fabrica';
import { atasParaContrato, paginar, parcelasParaItemContrato } from './seletores';
import { repositorioDemonstracao } from './demo';
import { validarArquivo, type Ata, type Colecao, type Contrato } from '../dominio/tipos';
import { validarContrato } from '../dominio/validacoes';

const Q = (n: number) => n * 1000;
const V = (n: number) => Math.round(n * 10000);
const HOJE = '2026-11-19';

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

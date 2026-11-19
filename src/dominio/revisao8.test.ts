import { describe, expect, it } from 'vitest';
import {
  dataFimVigenteAta,
  dataFimVigenteContrato,
  historicoValores,
  iniciosDePeriodo,
  quantidadeItemEm,
  quantidadeVigenteParcela,
  valorParcelaEm,
  valorUnitarioEm,
} from './calculos';
import { validarAditivoAta, validarAditivoContrato } from './validacoes';
import { novaAta, novoContrato } from './fabrica';
import { ehSoRegistro, validarArquivo, type AditivoAta, type AditivoContrato } from './tipos';

const V = (n: number) => Math.round(n * 10000);
const Q = (n: number) => n * 1000;

const adAta = (p: Partial<AditivoAta> = {}): AditivoAta => ({
  id: 'ad1', identificacao: '1º Termo Aditivo', data: '2026-06-01', tipo: 'prazo', novaDataFim: '2027-06-01', quantidades: [],
  inicioEfeitos: '', valores: [], observacoes: '', ...p,
});
const ata = (aditivos: AditivoAta[]) =>
  novaAta({
    id: 'a1', numero: '012/2026', dataFim: '2027-01-09',
    itens: [{ id: 'i1', descricao: 'Notebook', unidade: 'un', parcelas: [{ id: 'p1', empresaId: 'e1', tipoCota: 'ampla', quantidade: Q(100), valorUnitario: V(25) }] }],
    aditivos,
  });

const adContrato = (p: Partial<AditivoContrato> = {}): AditivoContrato => ({
  id: 'ac1', identificacao: '1º Termo Aditivo', tipo: 'prazo', dataAssinatura: '2026-12-20', inicioEfeitos: '2027-01-01',
  novaDataFim: '2027-12-31', alteracoes: [], observacoes: '', ...p,
});
const contrato = (aditivos: AditivoContrato[]) =>
  novoContrato({
    id: 'c1', numero: '1/2026', empresaId: 'e1', dataInicio: '2026-01-01', dataFim: '2026-12-31',
    itens: [{ id: 'it1', parcelaId: null, descricao: 'Notebook', unidade: 'un', quantidade: Q(10), valorUnitario: V(5000) }],
    aditivos,
  });

describe('edição de aditivo (CA04.7, CA08.7)', () => {
  it('CA04.7: trocar o tipo de prazo para outra alteração desfaz a prorrogação da ARP', () => {
    const antes = ata([adAta()]);
    expect(dataFimVigenteAta(antes)).toBe('2027-06-01');
    const editado = { ...antes, aditivos: antes.aditivos.map((a) => ({ ...a, tipo: 'outro' as const, novaDataFim: null, observacoes: 'Troca de equipamento' })) };
    expect(dataFimVigenteAta(editado)).toBe('2027-01-09');
    expect(validarAditivoAta(editado.aditivos[0], editado)).toEqual([]);
  });
  it('CA08.7: trocar o tipo de prazo para outra alteração desfaz a nova vigência do contrato', () => {
    const antes = contrato([adContrato()]);
    expect(iniciosDePeriodo(antes)).toEqual(['2026-01-01', '2027-01-01']);
    const ad = adContrato({ tipo: 'outro', novaDataFim: null, inicioEfeitos: '2026-12-20', observacoes: 'Troca de dois equipamentos' });
    const depois = { ...antes, aditivos: [ad] };
    expect(dataFimVigenteContrato(depois)).toBe('2026-12-31');
    expect(iniciosDePeriodo(depois)).toEqual(['2026-01-01']);
    expect(validarAditivoContrato(ad, depois)).toEqual([]);
  });
});

describe('errata e outra alteração só registram (CA04.8, CA08.8)', () => {
  it('são os dois tipos só de registro', () => {
    expect(['errata', 'outro'].every(ehSoRegistro)).toBe(true);
    expect(['prazo', 'quantidade', 'prazo_quantidade', 'reequilibrio', 'valor'].some(ehSoRegistro)).toBe(false);
  });

  it('CA04.8: na ARP não mudam vencimento, quantidade nem valor, mesmo com dados indevidos no arquivo', () => {
    for (const tipo of ['errata', 'outro'] as const) {
      const a = ata([
        adAta({ tipo, novaDataFim: '2030-01-01', quantidades: [{ parcelaId: 'p1', novaQuantidade: Q(999) }], valores: [{ parcelaId: 'p1', novoValorUnitario: V(99) }] }),
      ]);
      const p = a.itens[0].parcelas[0];
      expect(dataFimVigenteAta(a)).toBe('2027-01-09');
      expect(quantidadeVigenteParcela(a, p)).toBe(Q(100));
      expect(valorParcelaEm(a, p)).toBe(V(25));
    }
  });

  it('CA08.8: no contrato não mudam vencimento, período, quantidade nem valor', () => {
    for (const tipo of ['errata', 'outro'] as const) {
      const c = contrato([
        adContrato({ tipo, novaDataFim: '2030-01-01', inicioEfeitos: '2026-06-01', alteracoes: [{ itemId: 'it1', novaQuantidade: Q(99), novoValorUnitario: V(1) }] }),
      ]);
      expect(dataFimVigenteContrato(c)).toBe('2026-12-31');
      expect(iniciosDePeriodo(c)).toEqual(['2026-01-01']);
      expect(quantidadeItemEm(c, 'it1', '2026-07-01')).toBe(Q(10));
      expect(valorUnitarioEm(c, 'it1', '2026-07-01')).toBe(V(5000));
      expect(historicoValores(c, 'it1')).toHaveLength(1);
    }
  });

  it('CA04.8: exige descrição e recusa prazo, quantidade ou valor', () => {
    const a = ata([]);
    expect(validarAditivoAta(adAta({ tipo: 'errata', novaDataFim: null }), a).join(' ')).toMatch(/o que a errata corrige/);
    expect(validarAditivoAta(adAta({ tipo: 'outro', novaDataFim: null }), a).join(' ')).toMatch(/o que o aditivo altera/);
    expect(validarAditivoAta(adAta({ tipo: 'errata', observacoes: 'x' }), a).join(' ')).toMatch(/não mudam vencimento/);
    expect(validarAditivoAta(adAta({ tipo: 'errata', novaDataFim: null, observacoes: 'Onde se lê 10, leia-se 12' }), a)).toEqual([]);
  });

  it('CA08.8: exige descrição e não pede início dos efeitos', () => {
    const c = contrato([]);
    expect(validarAditivoContrato(adContrato({ tipo: 'errata', novaDataFim: null }), c).join(' ')).toMatch(/o que a errata corrige/);
    const ok = adContrato({ tipo: 'outro', novaDataFim: null, inicioEfeitos: '2026-12-20', observacoes: 'Troca do item 3 pelo modelo X' });
    expect(validarAditivoContrato(ok, c)).toEqual([]);
    expect(validarAditivoContrato({ ...ok, alteracoes: [{ itemId: 'it1', novaQuantidade: null, novoValorUnitario: V(1) }] }, c).join(' ')).toMatch(/não mudam/);
  });

  it('arquivos antigos e arquivos com os tipos novos são lidos', () => {
    const base = { id: 'x', formato: 1, versao: 1, atualizadoEm: '', registro: 'ata', numero: '1/2026', tema: '', dataFim: '2027-01-01', observacoes: '', itens: [] };
    const antigo = { ...base, aditivos: [{ id: 'ad', identificacao: '', data: '2026-01-01', tipo: 'prazo', novaDataFim: '2027-06-01', quantidades: [], observacoes: '' }] };
    expect(validarArquivo('atas', antigo).ok).toBe(true);
    const novo = { ...base, aditivos: [{ id: 'ad', identificacao: 'Errata', data: '2026-01-01', tipo: 'errata', novaDataFim: null, quantidades: [], observacoes: 'Corrige CNPJ' }] };
    expect(validarArquivo('atas', novo).ok).toBe(true);
  });
});

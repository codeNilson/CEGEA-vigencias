import { describe, expect, it } from 'vitest';
import { diferencaDias, formatarData, hojeISO, somarDias } from './datas';
import { ehDiaUtil, feriados, pascoa } from './feriados';
import { formatarCentavos, formatarQuantidade, lerQuantidade, lerValor, totalCentavos } from './numeros';
import { dataLimite, ordemEmAlerta, situacaoOrdem } from './prazos';
import {
  contratadoParcela,
  dataFimVigenteAta,
  dataFimVigenteContrato,
  historicoValores,
  quantidadeVigenteParcela,
  saldoItem,
  saldoParcela,
  situacaoAta,
  situacaoContrato,
  situacaoPorData,
  faixaPrazo,
  valorOrdem,
  valorTotalContrato,
} from './calculos';
import { validarAditivoContrato, validarAta, validarContrato, validarOrdem } from './validacoes';
import { dependentesDaAta, dependentesDoContrato, dependentesDoItemContrato } from './dependencias';
import { mesclar } from './mesclagem';
import { novaAta, novoContrato } from './fabrica';
import type { Ata, Contrato, Ordem } from './tipos';

const Q = (n: number) => n * 1000; // quantidade
const V = (n: number) => Math.round(n * 10000); // valor unitário

function ataBase(): Ata {
  return novaAta({
    id: 'ata1',
    numero: '012/2026',
    tema: 'Material de expediente',
    dataInicio: '2026-01-10',
    dataFim: '2027-01-09',
    itens: [
      {
        id: 'it1',
        descricao: 'Papel A4',
        unidade: 'resma',
        parcelas: [
          { id: 'p1', empresaId: 'emp1', tipoCota: 'ampla', quantidade: Q(1000), valorUnitario: V(25) },
          { id: 'p2', empresaId: 'emp2', tipoCota: 'cota_me', quantidade: Q(250), valorUnitario: V(24.5) },
        ],
      },
    ],
  });
}

function contrato(p: Partial<Contrato> = {}): Contrato {
  return novoContrato({
    id: 'c1',
    numero: '045/2026',
    empresaId: 'emp1',
    ataId: 'ata1',
    dataInicio: '2026-02-01',
    dataFim: '2027-01-31',
    itens: [{ id: 'ci1', parcelaId: 'p1', descricao: 'Papel A4', unidade: 'resma', quantidade: Q(400), valorUnitario: V(25) }],
    ...p,
  });
}

function ordem(p: Partial<Ordem> = {}): Ordem {
  return {
    id: 'o1',
    numero: 'OF 1',
    dataEmissao: '2026-03-02',
    prazoDias: 10,
    tipoPrazo: 'corridos',
    dataEntrega: null,
    itens: [{ itemId: 'ci1', quantidade: Q(150) }],
    observacoes: '',
    ...p,
  };
}

describe('datas e números', () => {
  it('soma e diferença de dias atravessando o ano', () => {
    expect(somarDias('2026-12-30', 3)).toBe('2027-01-02');
    expect(diferencaDias('2026-12-30', '2027-01-02')).toBe(3);
    expect(formatarData('2026-03-05')).toBe('05/03/2026');
  });
  it('hoje usa o relógio local', () => {
    expect(hojeISO(new Date(2026, 10, 18, 23, 59))).toBe('2026-11-18');
  });
  it('lê números no padrão brasileiro', () => {
    expect(lerQuantidade('1.234,5')).toBe(1_234_500);
    expect(lerQuantidade('10')).toBe(10_000);
    expect(lerValor('R$ 0,0345')).toBe(345);
    expect(lerValor('12,34567')).toBeNull();
    expect(lerQuantidade('abc')).toBeNull();
  });
  it('total em centavos com arredondamento', () => {
    expect(totalCentavos(Q(3), V(0.3333))).toBe(100); // 0,9999 -> R$ 1,00
    expect(totalCentavos(Q(400), V(25))).toBe(1_000_000);
    expect(formatarCentavos(123456789)).toBe('R$ 1.234.567,89');
    expect(formatarQuantidade(Q(1250.5))).toBe('1.250,5');
  });
});

describe('RF11 feriados', () => {
  it('CA11.2: Páscoa e feriados móveis de 2027', () => {
    expect(pascoa(2027)).toBe('2027-03-28');
    const f = feriados(2027);
    expect(f.get('2027-03-26')).toBe('Sexta-feira Santa');
    expect(f.has('2027-02-08') && f.has('2027-02-09')).toBe(true);
    expect(f.get('2027-05-27')).toBe('Corpus Christi');
  });
  it('Páscoa em anos conhecidos', () => {
    expect(pascoa(2026)).toBe('2026-04-05');
    expect(pascoa(2030)).toBe('2030-04-21');
  });
  it('fixos estaduais e municipais', () => {
    expect(ehDiaUtil('2027-03-19')).toBe(false); // São José, sexta
    expect(ehDiaUtil('2026-08-14')).toBe(true);
  });
});

describe('RF10 prazos de OF/OS', () => {
  it('CA10.4: dias corridos', () => {
    expect(dataLimite('2026-03-02', 10, 'corridos')).toBe('2026-03-12');
  });
  it('CA10.5: dias úteis pulam fim de semana', () => {
    // emissão sexta 06/03/2026; 5 úteis: 09,10,11,12,13
    expect(dataLimite('2026-03-06', 5, 'uteis')).toBe('2026-03-13');
  });
  it('CA10.5: dias úteis pulam feriado (São José + Data Magna 2026)', () => {
    // emissão 18/03 (qua); 19 feriado, 20 sex, 23 seg, 24 ter, 25 feriado, 26 qui
    expect(dataLimite('2026-03-18', 4, 'uteis')).toBe('2026-03-26');
  });
  it('CA10.6: situação da ordem', () => {
    const o = ordem({ dataEmissao: '2026-03-02', prazoDias: 10, tipoPrazo: 'corridos' });
    expect(situacaoOrdem(o, '2026-03-12')).toBe('pendente');
    expect(situacaoOrdem(o, '2026-03-13')).toBe('atrasada');
    expect(situacaoOrdem({ ...o, dataEntrega: '2026-03-20' }, '2026-04-01')).toBe('entregue');
  });
  it('CA13.7: alerta 3 dias corridos antes ou atrasada', () => {
    const o = ordem({ dataEmissao: '2026-03-02', prazoDias: 10, tipoPrazo: 'corridos' });
    expect(ordemEmAlerta(o, '2026-03-08')).toBe(false);
    expect(ordemEmAlerta(o, '2026-03-09')).toBe(true);
    expect(ordemEmAlerta(o, '2026-03-20')).toBe(true);
    expect(ordemEmAlerta({ ...o, dataEntrega: '2026-03-10' }, '2026-03-11')).toBe(false);
  });
});

describe('RF12 situação', () => {
  const hoje = '2026-11-18';
  it('CA12.2: 90 dias = vigente com alerta, 91 = vigente sem alerta', () => {
    expect(situacaoPorData(somarDias(hoje, 90), hoje)).toBe('vigente');
    expect(faixaPrazo(90, 'vigente')).toBe('atencao');
    expect(faixaPrazo(91, 'vigente')).toBe('normal');
    expect(faixaPrazo(30, 'vigente')).toBe('critico');
    expect(faixaPrazo(31, 'vigente')).toBe('atencao');
  });
  it('CA12.3: hoje = vigente (vence hoje), ontem = vencido', () => {
    expect(situacaoPorData(hoje, hoje)).toBe('vigente');
    expect(faixaPrazo(0, 'vigente')).toBe('critico');
    expect(situacaoPorData(somarDias(hoje, -1), hoje)).toBe('vencido');
  });
  it('vencido e encerrado não alertam', () => {
    expect(faixaPrazo(-5, 'vencido')).toBe('normal');
    expect(faixaPrazo(10, 'encerrado')).toBe('normal');
  });
  it('encerrado prevalece', () => {
    expect(situacaoPorData('2030-01-01', hoje, true)).toBe('encerrado');
  });
  it('CA12.4 / CA04.1: aditivo de prazo muda a situação', () => {
    const ata = ataBase(); // fim 2027-01-09, 52 dias -> vigente com alerta
    expect(situacaoAta(ata, hoje)).toBe('vigente');
    ata.aditivos.push({ id: 'ad', identificacao: '1º', data: '2026-11-18', tipo: 'prazo', novaDataFim: '2028-01-09', quantidades: [], inicioEfeitos: '', valores: [], observacoes: '' });
    expect(dataFimVigenteAta(ata)).toBe('2028-01-09');
    expect(situacaoAta(ata, hoje)).toBe('vigente');
  });
  it('contrato encerrado e vencido', () => {
    const c = contrato({ dataFim: '2026-11-01' });
    expect(situacaoContrato(c, hoje)).toBe('vencido');
    expect(situacaoContrato({ ...c, encerramento: { data: '2026-11-10', termo: 'TE 1' } }, hoje)).toBe('encerrado');
  });
});

describe('RF03 saldo da ata', () => {
  it('CA03.2: 1000 - 400 - 450 = 150', () => {
    const ata = ataBase();
    const contratos = [contrato(), contrato({ id: 'c2', numero: '090/2026', itens: [{ id: 'x', parcelaId: 'p1', descricao: 'Papel A4', unidade: 'resma', quantidade: Q(450), valorUnitario: V(25) }] })];
    expect(contratadoParcela('p1', contratos)).toBe(Q(850));
    expect(saldoParcela(ata, ata.itens[0].parcelas[0], contratos)).toBe(Q(150));
    expect(saldoParcela(ata, ata.itens[0].parcelas[1], contratos)).toBe(Q(250));
  });
  it('CA04.2: aditivo de quantidade recalcula saldo', () => {
    const ata = ataBase();
    ata.aditivos.push({ id: 'ad', identificacao: '1º', data: '2026-06-01', tipo: 'quantidade', novaDataFim: null, quantidades: [{ parcelaId: 'p1', novaQuantidade: Q(1250) }], inicioEfeitos: '', valores: [], observacoes: '' });
    expect(quantidadeVigenteParcela(ata, ata.itens[0].parcelas[0])).toBe(Q(1250));
    expect(saldoParcela(ata, ata.itens[0].parcelas[0], [contrato()])).toBe(Q(850));
  });
  it('CA03.3: impede contratar acima do saldo', () => {
    const ata = ataBase();
    const atas = new Map([[ata.id, ata]]);
    const existente = contrato({ id: 'c0', numero: '001/2026', itens: [{ id: 'y', parcelaId: 'p1', descricao: 'Papel A4', unidade: 'resma', quantidade: Q(700), valorUnitario: V(25) }] });
    const novo = contrato();
    const erros = validarContrato(novo, [existente], atas);
    expect(erros.join(' ')).toMatch(/Saldo insuficiente.*disponível 300/);
  });
  it('CA06.1: item da ata deve ser da empresa do contrato', () => {
    const ata = ataBase();
    const c = contrato({ itens: [{ id: 'z', parcelaId: 'p2', descricao: 'Papel A4', unidade: 'resma', quantidade: Q(10), valorUnitario: V(24.5) }] });
    expect(validarContrato(c, [], new Map([[ata.id, ata]])).join(' ')).toMatch(/outra empresa/);
  });
});

describe('RF07/RF08 saldo e valores do contrato', () => {
  it('CA07.2: 400 - 150 = 250', () => {
    const c = contrato({ ordens: [ordem()] });
    expect(saldoItem(c, 'ci1', '2026-04-01')).toBe(Q(250));
  });
  it('CA07.3: impede OF acima do saldo', () => {
    const c = contrato({ ordens: [ordem()] });
    const nova = ordem({ id: 'o2', numero: 'OF 2', itens: [{ itemId: 'ci1', quantidade: Q(251) }] });
    expect(validarOrdem(nova, c).join(' ')).toMatch(/disponível 250/);
  });
  it('CA08.1: aditivo de prazo restaura o saldo num novo período', () => {
    const c = contrato({
      ordens: [ordem()],
      aditivos: [{ id: 'a1', identificacao: '1º TA', tipo: 'prazo', dataAssinatura: '2027-01-20', inicioEfeitos: '2027-02-01', novaDataFim: '2028-01-31', alteracoes: [], observacoes: '' }],
    });
    expect(dataFimVigenteContrato(c)).toBe('2028-01-31');
    expect(saldoItem(c, 'ci1', '2026-12-01')).toBe(Q(250));
    expect(saldoItem(c, 'ci1', '2027-03-01')).toBe(Q(400));
  });
  it('CA08.5: reequilíbrio de R$ 10,00 para R$ 12,00 a partir de 01/06', () => {
    const c = contrato({
      itens: [{ id: 'ci1', parcelaId: null, descricao: 'Toner', unidade: 'un', quantidade: Q(100), valorUnitario: V(10) }],
      ataId: null,
      aditivos: [{ id: 'r1', identificacao: 'Reeq. 1', tipo: 'reequilibrio', dataAssinatura: '2026-05-20', inicioEfeitos: '2026-06-01', novaDataFim: null, alteracoes: [{ itemId: 'ci1', novaQuantidade: null, novoValorUnitario: V(12) }], observacoes: '' }],
    });
    const antes = ordem({ dataEmissao: '2026-05-15', itens: [{ itemId: 'ci1', quantidade: Q(1) }] });
    const depois = ordem({ id: 'o2', dataEmissao: '2026-06-10', itens: [{ itemId: 'ci1', quantidade: Q(1) }] });
    expect(valorOrdem(c, antes)).toBe(1000);
    expect(valorOrdem(c, depois)).toBe(1200);
    expect(historicoValores(c, 'ci1').map((h) => h.valor)).toEqual([V(10), V(12)]);
  });
  it('CA08.2: aditivo de valor altera quantidade e valor a partir da data', () => {
    const c = contrato({
      aditivos: [{ id: 'v1', identificacao: '2º TA', tipo: 'valor', dataAssinatura: '2026-07-01', inicioEfeitos: '2026-07-01', novaDataFim: null, alteracoes: [{ itemId: 'ci1', novaQuantidade: Q(500), novoValorUnitario: V(26) }], observacoes: '' }],
    });
    expect(valorTotalContrato(c, '2026-06-30')).toBe(1_000_000);
    expect(valorTotalContrato(c, '2026-07-01')).toBe(1_300_000);
    expect(saldoItem(c, 'ci1', '2026-08-01')).toBe(Q(500));
  });
  it('reequilíbrio não aceita quantidade', () => {
    const c = contrato();
    const erros = validarAditivoContrato({ id: 'r', identificacao: '', tipo: 'reequilibrio', dataAssinatura: '2026-05-01', inicioEfeitos: '2026-05-01', novaDataFim: null, alteracoes: [{ itemId: 'ci1', novaQuantidade: Q(1), novoValorUnitario: null }], observacoes: '' }, c);
    expect(erros.join(' ')).toMatch(/apenas valor unitário/);
  });
  it('CA09.3: encerrado não recebe OF', () => {
    const c = contrato({ encerramento: { data: '2026-10-01', termo: '' } });
    expect(validarOrdem(ordem(), c).join(' ')).toMatch(/encerrado/);
  });
});

describe('RF01/RF05 validações de cadastro', () => {
  it('CA01.2/01.4', () => {
    const outra = ataBase();
    const a = novaAta({ numero: '012/2026', dataInicio: '2026-05-01', dataFim: '2026-04-01' });
    const erros = validarAta(a, [outra]).join(' ');
    expect(erros).toMatch(/anterior/);
    expect(erros).toMatch(/Já existe uma ARP/);
    expect(validarAta(novaAta(), []).length).toBeGreaterThanOrEqual(2);
    // Data de início vazia não é erro: não é obrigatória.
    expect(validarAta(novaAta({ numero: '099/2026', dataFim: '2027-01-01' }), [])).toEqual([]);
  });
  it('CA05.4: número de contrato único', () => {
    expect(validarContrato(contrato({ id: 'c9' }), [contrato()], new Map([['ata1', ataBase()]])).join(' ')).toMatch(/Já existe um contrato/);
  });
});

describe('RF15 dependências', () => {
  it('CA15.2: ata com contrato e contrato com OF', () => {
    expect(dependentesDaAta('ata1', [contrato()])).toEqual(['Contrato 045/2026']);
    const c = contrato({ ordens: [ordem()] });
    expect(dependentesDoContrato(c)).toEqual(['Ordem OF 1']);
    expect(dependentesDoItemContrato(c, 'ci1')).toEqual(['Ordem OF 1']);
  });
});

describe('RF16 mesclagem', () => {
  const base = contrato({ versao: 3 });
  it('CA16.1: alterações em partes diferentes do mesmo contrato entram juntas', () => {
    const minha = { ...base, ordens: [ordem()] };
    const deles = { ...base, versao: 4, aditivos: [{ id: 'a1', identificacao: '1º', tipo: 'prazo' as const, dataAssinatura: '2027-01-01', inicioEfeitos: '2027-02-01', novaDataFim: '2028-01-31', alteracoes: [], observacoes: '' }] };
    const { resultado, conflitos } = mesclar(base, minha, deles);
    expect(conflitos).toHaveLength(0);
    expect(resultado.ordens).toHaveLength(1);
    expect(resultado.aditivos).toHaveLength(1);
  });
  it('CA16.2: mesmo campo alterado nos dois lados vira conflito e respeita a escolha', () => {
    const minha = { ...base, gestor: 'Priscila' };
    const deles = { ...base, gestor: 'Ednaldo' };
    const r1 = mesclar(base, minha, deles);
    expect(r1.conflitos.map((c) => c.chave)).toEqual(['gestor']);
    const r2 = mesclar(base, minha, deles, { gestor: 'deles' });
    expect(r2.conflitos).toHaveLength(0);
    expect(r2.resultado.gestor).toBe('Ednaldo');
  });
  it('item removido de um lado e intocado no outro sai', () => {
    const b = contrato({ ordens: [ordem(), ordem({ id: 'o2', numero: 'OF 2' })] });
    const minha = { ...b, ordens: [b.ordens[0]] };
    const deles = { ...b, gestor: 'X' };
    const { resultado, conflitos } = mesclar(b, minha, deles);
    expect(conflitos).toHaveLength(0);
    expect(resultado.ordens.map((o) => o.id)).toEqual(['o1']);
    expect(resultado.gestor).toBe('X');
  });
  it('alterado de um lado e removido do outro vira conflito', () => {
    const b = contrato({ ordens: [ordem()] });
    const minha = { ...b, ordens: [{ ...b.ordens[0], dataEntrega: '2026-03-10' }] };
    const deles = { ...b, ordens: [] };
    const { conflitos } = mesclar(b, minha, deles);
    expect(conflitos).toHaveLength(1);
    expect(conflitos[0].deles).toBeUndefined();
  });
  it('campo alterado igual nos dois lados não é conflito', () => {
    const { conflitos } = mesclar(base, { ...base, fiscal: 'A' }, { ...base, fiscal: 'A' });
    expect(conflitos).toHaveLength(0);
  });
});

import { contadores, linhasDocumentos, vencimentosPorMes } from '../estado/seletores';

describe('RF13/RF18 seletores', () => {
  const hoje = '2026-11-18';
  const empresas = new Map();
  const ata = ataBase(); // vence 2027-01-09 (52 dias)
  const vencida = { ...ataBase(), id: 'ata2', numero: 'ARP 2', dataFim: '2026-11-01' };
  const cVencido = contrato({ id: 'cv', numero: 'CV', dataFim: '2026-11-10' });
  const cEncerrado = contrato({ id: 'ce', numero: 'CE', dataFim: '2026-11-10', encerramento: { data: '2026-11-12', termo: '' } });
  const cCritico = contrato({ id: 'cc', numero: 'CC', dataFim: '2026-12-01' });
  const linhas = linhasDocumentos({ atas: new Map([[ata.id, ata], [vencida.id, vencida]]), contratos: new Map([[cVencido.id, cVencido], [cEncerrado.id, cEncerrado], [cCritico.id, cCritico]]), empresas, hoje });
  it('CA18.1/18.2: vencidos fora dos contadores; contrato vencido aguarda encerramento', () => {
    const k = contadores(linhas, []);
    expect(k.atasVencendo).toBe(1);
    expect(k.contratosVencendo).toBe(1);
    expect(k.contratosCriticos).toBe(1);
    expect(k.aguardandoEncerramento).toBe(1);
  });
  it('CA13.1: agrupa por mês, com meses vazios, só vigentes em até 90 dias', () => {
    const g = vencimentosPorMes(linhas, hoje);
    expect(g.map((x) => x.chave)).toEqual(['2026-11', '2026-12', '2027-01', '2027-02']);
    expect(g[1].itens.map((l) => l.numero)).toEqual(['CC']);
    expect(g[2].itens.map((l) => l.numero)).toEqual(['012/2026']);
    expect(g[0].itens).toHaveLength(0);
  });
});

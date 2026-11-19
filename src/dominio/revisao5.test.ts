import { describe, expect, it } from 'vitest';
import { casaBusca, cnpjValido, compararNumeroDoc, formatarCnpj, formatarObjetoAta, nomesParecidos } from './texto';
import { colarMoeda, lerValor, mascaraMoeda } from './numeros';
import { reequilibriosPosterioresAoContrato, saldoParcela, valorParcelaEm, valorTotalAta, dataFimVigenteAta } from './calculos';
import { validarAditivoAta, validarEmpresa } from './validacoes';
import { aditivosDaParcela } from './dependencias';
import { novaAta, novaEmpresa, novoContrato } from './fabrica';
import { validarArquivo, type AditivoAta } from './tipos';

const V = (n: number) => Math.round(n * 10000);
const Q = (n: number) => n * 1000;

describe('ordenação por número (NÚMERO/ANO)', () => {
  it('mais recentes primeiro, número comparado como número, fora do padrão no fim', () => {
    const lista = ['9/2026', '012/2025', 'Contrato especial', '10/2026', 'ARP 045/2025', '001/2026', 'abc 2'];
    expect([...lista].sort(compararNumeroDoc)).toEqual(['10/2026', '9/2026', '001/2026', 'ARP 045/2025', '012/2025', 'abc 2', 'Contrato especial']);
  });
});

describe('busca e empresas repetidas', () => {
  it('busca ignora acento e maiúsculas, todas as palavras', () => {
    expect(casaBusca('Climatiza Nordeste Serviços Ltda', 'servicos clima')).toBe(true);
    expect(casaBusca('Climatiza Nordeste', 'sul')).toBe(false);
  });
  it('nomes parecidos ignoram sufixos e pontuação', () => {
    expect(nomesParecidos('Papelaria Ribeira Ltda', 'PAPELARIA RIBEIRA LTDA - ME')).toBe(true);
    expect(nomesParecidos('Papelaria Ribeira', 'Papelaria Ribeira Comércio e Serviços EIRELI')).toBe(true);
    expect(nomesParecidos('Papelaria Ribeira', 'Papelaria Aldeota')).toBe(false);
  });
  it('CNPJ: dígitos verificadores e formatação', () => {
    expect(cnpjValido('11.222.333/0001-81')).toBe(true);
    expect(cnpjValido('11.222.333/0001-44')).toBe(false);
    expect(cnpjValido('')).toBe(true);
    expect(formatarCnpj('11222333000181')).toBe('11.222.333/0001-81');
    expect(validarEmpresa(novaEmpresa({ nome: 'X', cnpj: '11.111.111/1111-11' }), []).join(' ')).toMatch(/CNPJ inválido/);
  });
});

describe('máscara de valor', () => {
  it('preenche da direita com 2 casas', () => {
    expect(mascaraMoeda('5')).toBe('0,05');
    expect(mascaraMoeda('500')).toBe('5,00');
    expect(mascaraMoeda('123456')).toBe('1.234,56');
    expect(mascaraMoeda('5,000')).toBe('50,00'); // digitou mais um 0 depois de 5,00
    expect(mascaraMoeda('5,0')).toBe('0,50'); // apagou o último dígito de 5,00
    expect(mascaraMoeda('')).toBe('');
    expect(lerValor(mascaraMoeda('2490'))).toBe(V(24.9));
  });
  it('colar valor pronto', () => {
    expect(colarMoeda('R$ 1.234,5')).toBe('1.234,50');
    expect(colarMoeda('10')).toBe('10,00');
    expect(colarMoeda('texto')).toBeNull();
  });
});

it('objeto da ARP em maiúsculas', () => {
  expect(formatarObjetoAta('material  de expediente')).toBe('MATERIAL DE EXPEDIENTE');
  expect(formatarObjetoAta('água mineral')).toBe('ÁGUA MINERAL');
});

describe('reequilíbrio da ARP', () => {
  const reeq = (p: Partial<AditivoAta> = {}): AditivoAta => ({
    id: 'r1', identificacao: '1º Reequilíbrio', data: '2026-06-01', tipo: 'reequilibrio', novaDataFim: null, quantidades: [],
    inicioEfeitos: '2026-06-10', valores: [{ parcelaId: 'p1', novoValorUnitario: V(30) }], observacoes: '', ...p,
  });
  const ata = () =>
    novaAta({
      id: 'a1', numero: '012/2026', dataFim: '2027-01-09',
      itens: [{ id: 'i1', descricao: 'Papel', unidade: 'resma', parcelas: [
        { id: 'p1', empresaId: 'e1', tipoCota: 'ampla', quantidade: Q(100), valorUnitario: V(25) },
        { id: 'p2', empresaId: 'e2', tipoCota: 'cota_me', quantidade: Q(10), valorUnitario: V(24) },
      ] }],
      aditivos: [reeq()],
    });

  it('valor da parcela muda só a partir do início dos efeitos', () => {
    const a = ata();
    const p1 = a.itens[0].parcelas[0];
    expect(valorParcelaEm(a, p1, '2026-06-09')).toBe(V(25));
    expect(valorParcelaEm(a, p1, '2026-06-10')).toBe(V(30));
    expect(valorParcelaEm(a, a.itens[0].parcelas[1], '2026-12-01')).toBe(V(24));
    expect(valorTotalAta(a, '2026-07-01')).toBe(100 * 3000 + 10 * 2400);
  });
  it('segundo reequilíbrio vale depois do primeiro', () => {
    const a = ata();
    a.aditivos.push(reeq({ id: 'r2', data: '2026-09-01', inicioEfeitos: '2026-09-01', valores: [{ parcelaId: 'p1', novoValorUnitario: V(32) }] }));
    expect(valorParcelaEm(a, a.itens[0].parcelas[0], '2026-08-01')).toBe(V(30));
    expect(valorParcelaEm(a, a.itens[0].parcelas[0])).toBe(V(32));
  });
  it('não mexe em vencimento nem em quantidade', () => {
    const a = ata();
    expect(dataFimVigenteAta(a)).toBe('2027-01-09');
    expect(saldoParcela(a, a.itens[0].parcelas[0], [])).toBe(Q(100));
  });
  it('contrato antigo recebe só o aviso; contrato novo não', () => {
    const a = ata();
    const item = { id: 'ci', parcelaId: 'p1', descricao: 'Papel', unidade: 'resma', quantidade: Q(10), valorUnitario: V(25) };
    const antigo = novoContrato({ id: 'c1', numero: '1/2026', dataInicio: '2026-02-01', dataFim: '2027-01-01', ataId: 'a1', itens: [item] });
    const novo = novoContrato({ id: 'c2', numero: '2/2026', dataInicio: '2026-07-01', dataFim: '2027-01-01', ataId: 'a1', itens: [{ ...item, valorUnitario: V(30) }] });
    expect(reequilibriosPosterioresAoContrato(a, antigo).map((r) => r.id)).toEqual(['r1']);
    expect(reequilibriosPosterioresAoContrato(a, novo)).toEqual([]);
    expect(antigo.itens[0].valorUnitario).toBe(V(25));
  });
  it('validação', () => {
    expect(validarAditivoAta(reeq({ valores: [] }), ata()).join(' ')).toMatch(/novo valor unitário/);
    expect(validarAditivoAta(reeq(), ata())).toEqual([]);
  });
  it('parcela citada em reequilíbrio não pode ser removida', () => {
    expect(aditivosDaParcela(ata(), 'p1')).toHaveLength(1);
  });
  it('aditivo gravado antes do reequilíbrio existir continua válido', () => {
    const arq = {
      id: 'x', formato: 1, versao: 1, atualizadoEm: '', registro: 'ata', numero: '1/2026', tema: '', dataFim: '2027-01-01', observacoes: '', itens: [],
      aditivos: [{ id: 'ad', identificacao: '', data: '2026-01-01', tipo: 'prazo', novaDataFim: '2027-06-01', quantidades: [], observacoes: '' }],
    };
    const r = validarArquivo('atas', arq);
    expect(r.ok && r.valor.registro === 'ata' && [r.valor.aditivos[0].inicioEfeitos, r.valor.aditivos[0].valores]).toEqual(['', []]);
  });
});

import { ehDataValida } from './datas';
import { cnpjValido } from './texto';
import { acharParcela, saldoItem, saldoParcela, dataFimVigenteContrato } from './calculos';
import { formatarQuantidade } from './numeros';
import { ehSoRegistro, type AditivoAta, type AditivoContrato, type Ata, type Contrato, type Empresa, type Ordem } from './tipos';

export type Erros = string[];

const normal = (s: string) => s.trim().toLowerCase();
const soDigitos = (s: string) => s.replace(/\D/g, '');

function datas(erros: Erros, inicio: string, fim: string) {
  if (!inicio || !ehDataValida(inicio)) erros.push('Informe a data de início.');
  if (!fim || !ehDataValida(fim)) erros.push('Informe o vencimento.');
  if (inicio && fim && ehDataValida(inicio) && ehDataValida(fim) && fim < inicio)
    erros.push('O vencimento não pode ser anterior à data de início.');
}

/** Vencimento é obrigatório; início é opcional (não usado em nenhum cálculo). */
function dataFimObrigatoria(erros: Erros, inicio: string, fim: string) {
  if (!fim || !ehDataValida(fim)) erros.push('Informe o vencimento.');
  if (inicio && !ehDataValida(inicio)) erros.push('Data de início inválida.');
  if (inicio && fim && ehDataValida(inicio) && ehDataValida(fim) && fim < inicio)
    erros.push('O vencimento não pode ser anterior à data de início.');
}

export function validarEmpresa(e: Empresa, todas: Iterable<Empresa>): Erros {
  const erros: Erros = [];
  if (!e.nome.trim()) erros.push('Informe o nome da empresa.');
  for (const em of e.email.split(/[;,\s]+/).filter(Boolean))
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) erros.push(`E-mail inválido: ${em}`);
  if (e.cnpj && !cnpjValido(e.cnpj)) erros.push('CNPJ inválido: confira os dígitos.');
  if (e.cnpj && soDigitos(e.cnpj)) {
    for (const o of todas)
      if (o.id !== e.id && o.cnpj && soDigitos(o.cnpj) === soDigitos(e.cnpj))
        erros.push(`CNPJ já cadastrado para ${o.nome}.`);
  }
  return erros;
}

/** CA01.2 a CA01.4, CA02.4 */
export function validarAta(a: Ata, todas: Iterable<Ata>): Erros {
  const erros: Erros = [];
  if (!a.numero.trim()) erros.push('Informe o número da ARP.');
  dataFimObrigatoria(erros, a.dataInicio, a.dataFim);
  for (const o of todas)
    if (o.id !== a.id && normal(o.numero) === normal(a.numero) && a.numero.trim())
      erros.push(`Já existe uma ARP com o número ${a.numero}.`);
  for (const it of a.itens) {
    if (!it.descricao.trim()) erros.push('Todo item precisa de descrição.');
    for (const p of it.parcelas) {
      if (!(p.quantidade > 0)) erros.push(`Quantidade inválida em "${it.descricao}".`);
      if (!(p.valorUnitario > 0)) erros.push(`Valor unitário inválido em "${it.descricao}".`);
      if (!p.empresaId) erros.push(`Fornecedor não informado em "${it.descricao}".`);
    }
  }
  return erros;
}

/** Revisão 8: errata e "outra alteração" só guardam o texto. Não podem carregar prazo, quantidade nem valor. */
function soRegistro(erros: Erros, tipo: string, observacoes: string, novaDataFim: string | null, alteracoes: number) {
  if (!observacoes.trim()) erros.push(tipo === 'errata' ? 'Descreva o que a errata corrige.' : 'Descreva o que o aditivo altera.');
  if (novaDataFim || alteracoes > 0) erros.push('Errata e outra alteração não mudam vencimento, quantidade nem valor.');
}

export function validarAditivoAta(ad: AditivoAta, ata: Ata): Erros {
  const erros: Erros = [];
  if (!ehDataValida(ad.data)) erros.push('Informe a data do aditivo.');
  if (ehSoRegistro(ad.tipo)) {
    soRegistro(erros, ad.tipo, ad.observacoes, ad.novaDataFim, ad.quantidades.length + ad.valores.length);
    return erros;
  }
  if (ad.tipo === 'reequilibrio') {
    if (ad.inicioEfeitos && !ehDataValida(ad.inicioEfeitos)) erros.push('Informe o início dos efeitos.');
    if (ad.valores.length === 0) erros.push('Informe o novo valor unitário de pelo menos um fornecedor.');
    for (const v of ad.valores) if (!(v.novoValorUnitario > 0)) erros.push('Valor unitário inválido em um dos fornecedores.');
    return erros;
  }
  const prazo = ad.tipo === 'prazo' || ad.tipo === 'prazo_quantidade';
  const qtd = ad.tipo === 'quantidade' || ad.tipo === 'prazo_quantidade';
  if (prazo) {
    if (!ad.novaDataFim || !ehDataValida(ad.novaDataFim)) erros.push('Informe o novo vencimento.');
    else if (ata.dataInicio && ad.novaDataFim < ata.dataInicio) erros.push('O novo vencimento não pode ser anterior ao início da ARP.');
  }
  if (qtd && ad.quantidades.length === 0) erros.push('Informe a nova quantidade de pelo menos um fornecedor.');
  return erros;
}

/**
 * CA05.2 a CA05.5, CA06.1, CA03.3.
 * `anterior` é a versão salva do contrato: o saldo da ata só é conferido para parcelas
 * cuja quantidade aumentou, para não travar edições de contratos antigos.
 */
export function validarContrato(c: Contrato, todos: Iterable<Contrato>, atas: Map<string, Ata>, anterior?: Contrato): Erros {
  const erros: Erros = [];
  const lista = [...todos];
  if (!c.numero.trim()) erros.push('Informe o número do contrato.');
  if (!c.empresaId) erros.push('Informe a empresa.');
  datas(erros, c.dataInicio, c.dataFim);
  for (const o of lista)
    if (o.id !== c.id && c.numero.trim() && normal(o.numero) === normal(c.numero))
      erros.push(`Já existe um contrato com o número ${c.numero}.`);

  const ata = c.ataId ? atas.get(c.ataId) : undefined;
  if (c.ataId && !ata) erros.push('A ARP vinculada não foi encontrada.');

  const porParcela = new Map<string, number>();
  for (const it of c.itens) {
    if (!it.descricao.trim()) erros.push('Todo item precisa de descrição.');
    if (!(it.quantidade > 0)) erros.push(`Quantidade inválida em "${it.descricao}".`);
    if (!(it.valorUnitario > 0)) erros.push(`Valor unitário inválido em "${it.descricao}".`);
    if (it.parcelaId) {
      if (!ata) {
        erros.push(`O item "${it.descricao}" aponta para uma ARP, mas o contrato não tem ARP vinculada.`);
        continue;
      }
      const achado = acharParcela(ata, it.parcelaId);
      if (!achado) erros.push(`O item "${it.descricao}" não pertence à ARP ${ata.numero}.`);
      else if (achado.parcela.empresaId !== c.empresaId)
        erros.push(`O item "${it.descricao}" é de outra empresa na ARP.`);
      porParcela.set(it.parcelaId, (porParcela.get(it.parcelaId) ?? 0) + it.quantidade);
    }
  }

  if (ata) {
    for (const [parcelaId, qtd] of porParcela) {
      const antes = anterior?.itens.filter((i) => i.parcelaId === parcelaId).reduce((s, i) => s + i.quantidade, 0) ?? 0;
      if (qtd <= antes) continue;
      const achado = acharParcela(ata, parcelaId);
      if (!achado) continue;
      const disponivel = saldoParcela(ata, achado.parcela, lista, c.id);
      if (qtd > disponivel)
        erros.push(`Saldo insuficiente na ARP para "${achado.item.descricao}": disponível ${formatarQuantidade(disponivel)}.`);
    }
  }
  return erros;
}

export function validarAditivoContrato(ad: AditivoContrato, c: Contrato): Erros {
  const erros: Erros = [];
  if (c.encerramento) erros.push('Contrato encerrado não pode receber aditivo.');
  if (!ehDataValida(ad.dataAssinatura)) erros.push('Informe a data de assinatura.');
  if (ehSoRegistro(ad.tipo)) {
    soRegistro(erros, ad.tipo, ad.observacoes, ad.novaDataFim, ad.alteracoes.length);
    return erros;
  }
  if (!ehDataValida(ad.inicioEfeitos)) erros.push('Informe o início dos efeitos.');
  if (ad.tipo === 'prazo') {
    if (!ad.novaDataFim || !ehDataValida(ad.novaDataFim)) erros.push('Informe o novo vencimento.');
    else if (ad.novaDataFim < ad.inicioEfeitos) erros.push('O novo vencimento não pode ser anterior ao início dos efeitos.');
  } else {
    const uteis = ad.alteracoes.filter((a) => a.novaQuantidade != null || a.novoValorUnitario != null);
    if (uteis.length === 0) erros.push('Informe a alteração de pelo menos um item.');
    if (ad.tipo === 'reequilibrio' && ad.alteracoes.some((a) => a.novaQuantidade != null))
      erros.push('Reequilíbrio altera apenas valor unitário.');
  }
  return erros;
}

/** CA10.1, CA07.3, CA09.3 */
export function validarOrdem(o: Ordem, c: Contrato): Erros {
  const erros: Erros = [];
  if (c.encerramento) erros.push('Contrato encerrado não pode receber OF/OS.');
  if (!o.numero.trim()) erros.push('Informe o número.');
  else if (c.ordens.some((x) => x.id !== o.id && normal(x.numero) === normal(o.numero)))
    erros.push(`Já existe a ordem ${o.numero} neste contrato.`);
  if (!ehDataValida(o.dataEmissao)) erros.push('Informe a data de emissão.');
  if (!(o.prazoDias > 0)) erros.push('Informe o prazo de entrega em dias.');
  if (o.dataEntrega && !ehDataValida(o.dataEntrega)) erros.push('Data de entrega inválida.');
  if (o.dataEntrega && ehDataValida(o.dataEmissao) && o.dataEntrega < o.dataEmissao)
    erros.push('A entrega não pode ser anterior à emissão.');
  if (o.itens.length === 0) erros.push('Informe a quantidade de pelo menos um item.');
  if (ehDataValida(o.dataEmissao)) {
    if (o.dataEmissao < c.dataInicio || o.dataEmissao > dataFimVigenteContrato(c))
      erros.push('A data de emissão está fora da vigência do contrato.');
    for (const it of o.itens) {
      const item = c.itens.find((i) => i.id === it.itemId);
      if (!item) continue;
      const saldo = saldoItem(c, it.itemId, o.dataEmissao, o.id);
      if (it.quantidade > saldo)
        erros.push(`Saldo insuficiente para "${item.descricao}": disponível ${formatarQuantidade(saldo)}.`);
    }
  }
  return erros;
}

export function validarEncerramento(dataEnc: string): Erros {
  return ehDataValida(dataEnc) ? [] : ['Informe a data de encerramento.'];
}

import { useState } from 'react';
import type { Lado, Escolhas, Caminho } from '../../dominio/mesclagem';
import type { Agregado } from '../../dominio/tipos';
import { formatarData } from '../../dominio/datas';
import { useLoja } from '../contexto';
import { Modal } from './base';

const ROTULOS: Record<string, string> = {
  numero: 'Número', tema: 'Objeto', objeto: 'Objeto', dataInicio: 'Início', dataFim: 'Data fim', observacoes: 'Observações',
  gestor: 'Gestor', fiscal: 'Fiscal', empresaId: 'Empresa', ataId: 'ARP', tipo: 'Tipo', nome: 'Nome', cnpj: 'CNPJ',
  itens: 'Item', parcelas: 'Parcela', aditivos: 'Aditivo', ordens: 'Ordem', encerramento: 'Encerramento',
  descricao: 'Descrição', unidade: 'Unidade', quantidade: 'Quantidade', valorUnitario: 'Valor unitário',
  dataEmissao: 'Emissão', dataEntrega: 'Data de entrega', prazoDias: 'Prazo (dias)', tipoPrazo: 'Tipo de prazo',
  identificacao: 'Identificação', data: 'Data', novaDataFim: 'Nova data fim', inicioEfeitos: 'Início dos efeitos',
  dataAssinatura: 'Assinatura', alteracoes: 'Alterações', quantidades: 'Quantidades', termo: 'Termo', tipoCota: 'Cota',
  valores: 'Novos valores', email: 'E-mail', telefone: 'Telefone',
};

function nomeElemento(o: unknown): string {
  if (!o || typeof o !== 'object') return '';
  const r = o as Record<string, unknown>;
  return String(r.numero ?? r.identificacao ?? r.descricao ?? r.nome ?? '');
}

function rotular(caminho: Caminho, minha: Agregado, deles: Agregado | null): string {
  const partes: string[] = [];
  let a: unknown = minha;
  let b: unknown = deles;
  caminho.forEach((s) => {
    if (typeof s === 'string') {
      partes.push(ROTULOS[s] ?? s);
      a = (a as Record<string, unknown> | undefined)?.[s];
      b = (b as Record<string, unknown> | undefined)?.[s];
    } else {
      const achar = (lista: unknown) => (Array.isArray(lista) ? lista.find((e) => e?.id === s.id) : undefined);
      a = achar(a);
      b = achar(b);
      const n = nomeElemento(a ?? b);
      if (n) partes[partes.length - 1] += ` ${n}`;
    }
  });
  return partes.join(' › ');
}

function mostrar(v: unknown): string {
  if (v === undefined) return '(excluído)';
  if (v === null || v === '') return '(vazio)';
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return formatarData(v);
  if (typeof v === 'object') {
    const n = nomeElemento(v);
    return n ? `${n} (com alterações)` : JSON.stringify(v).slice(0, 120);
  }
  return String(v);
}

/** RF16.2: mostra as duas versões campo a campo e deixa o usuário escolher. */
export function ModalConflito() {
  const conflito = useLoja((e) => e.conflito);
  const [escolhas, setEscolhas] = useState<Escolhas>({});
  if (!conflito) return null;
  const { minha, deles, conflitos, responder } = conflito;

  if (!deles) {
    return (
      <Modal
        titulo="Registro excluído por outro usuário"
        aoFechar={() => responder({ tipo: 'cancelar' })}
        rodape={
          <>
            <button className="btn" onClick={() => responder({ tipo: 'cancelar' })}>
              Descartar minhas alterações
            </button>
            <button className="btn btn-primario" onClick={() => responder({ tipo: 'recriar' })}>
              Recriar com minhas alterações
            </button>
          </>
        }
      >
        <p>Enquanto você editava, outra pessoa excluiu este registro da pasta de dados.</p>
      </Modal>
    );
  }

  const completo = conflitos.every((c) => escolhas[c.chave]);
  const todos = (l: Lado) => setEscolhas(Object.fromEntries(conflitos.map((c) => [c.chave, l])));

  return (
    <Modal
      titulo="Outra pessoa alterou o mesmo registro"
      largo
      aoFechar={() => {
        setEscolhas({});
        responder({ tipo: 'cancelar' });
      }}
      rodape={
        <>
          <button className="btn btn-leve" onClick={() => todos('minha')}>
            Manter todas as minhas
          </button>
          <button className="btn btn-leve" onClick={() => todos('deles')}>
            Manter todas as do outro usuário
          </button>
          <span style={{ flex: 1 }} />
          <button
            className="btn"
            onClick={() => {
              setEscolhas({});
              responder({ tipo: 'cancelar' });
            }}
          >
            Cancelar gravação
          </button>
          <button
            className="btn btn-primario"
            disabled={!completo}
            onClick={() => {
              const e = escolhas;
              setEscolhas({});
              responder({ tipo: 'escolhas', escolhas: e });
            }}
          >
            Gravar com estas escolhas
          </button>
        </>
      }
    >
      <p className="nota">
        As alterações que não se chocam já foram juntadas. Escolha qual versão manter em cada campo abaixo ({conflitos.length}{' '}
        {conflitos.length === 1 ? 'conflito' : 'conflitos'}).
      </p>
      {conflitos.map((c) => (
        <div className="conflito" key={c.chave}>
          <div className="conflito-campo">{rotular(c.caminho, minha, deles)}</div>
          <div className="conflito-opcoes">
            {(['minha', 'deles'] as Lado[]).map((lado) => (
              <button
                key={lado}
                className="conflito-opcao"
                aria-pressed={escolhas[c.chave] === lado}
                onClick={() => setEscolhas({ ...escolhas, [c.chave]: lado })}
              >
                <div className="qual">{lado === 'minha' ? 'Minha versão' : 'Versão gravada por outro usuário'}</div>
                <div className="valor">{mostrar(lado === 'minha' ? c.minha : c.deles)}</div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </Modal>
  );
}

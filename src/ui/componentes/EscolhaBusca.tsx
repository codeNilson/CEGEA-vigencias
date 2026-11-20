import { Fragment, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { casaBusca } from '../../dominio/texto';
import { cls } from './base';

export interface OpcaoBusca {
  id: string;
  /** Texto principal; é o que aparece no campo depois de escolhido. */
  rotulo: string;
  /** Linha secundária (CNPJ, vencimento, saldo...). */
  sub?: string;
  /** Texto usado na busca. Padrão: rótulo + sub. */
  busca?: string;
  /** Título do grupo. Opções do mesmo grupo devem vir juntas. */
  grupo?: string;
}

const MAX_VISIVEIS = 50;

/**
 * Campo de escolha com busca, para listas que podem ficar longas (empresas, ARPs, itens da ARP).
 * Busca sem acento por todas as palavras; setas e Enter escolhem; Esc fecha.
 * Mostra no máximo 50 opções e avisa quantas ficaram de fora.
 */
export function EscolhaBusca({
  valor,
  muda,
  opcoes,
  placeholder = 'Digite para buscar…',
  semEscolha,
  nova,
  desabilitado,
  autoFocus,
  detalheEscolhida,
  duasLinhas,
  nomePlural = 'opções',
}: {
  valor: string;
  muda: (id: string) => void;
  opcoes: OpcaoBusca[];
  placeholder?: string;
  /** Opção que limpa a escolha (ex.: "Sem ARP"). Também vira o texto do campo vazio. */
  semEscolha?: string;
  /** Última opção, para cadastrar com o texto digitado. */
  nova?: { rotulo: (texto: string) => string; acao: (texto: string) => void };
  desabilitado?: boolean;
  autoFocus?: boolean;
  /** Linha abaixo do campo quando fechado (ex.: CNPJ da empresa escolhida). */
  detalheEscolhida?: string;
  /** Rótulo e linha secundária um embaixo do outro, para textos longos. */
  duasLinhas?: boolean;
  /** Para o aviso "Mais N ...". */
  nomePlural?: string;
}) {
  const listaId = useId();
  const entrada = useRef<HTMLInputElement>(null);
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState('');
  const [ativo, setAtivo] = useState(0);
  const [pos, setPos] = useState<{ left: number; width: number; top?: number; bottom?: number; maxHeight: number } | null>(null);

  const escolhida = valor ? opcoes.find((o) => o.id === valor) : undefined;
  const achadas = useMemo(() => (texto.trim() ? opcoes.filter((o) => casaBusca(o.busca ?? `${o.rotulo} ${o.sub ?? ''}`, texto)) : opcoes), [opcoes, texto]);
  const visiveis = achadas.slice(0, MAX_VISIVEIS);
  const comLimpar = semEscolha !== undefined && !texto.trim();

  // Entradas escolhíveis, na ordem da lista: [limpar] + opções + [nova].
  type Entrada = { tipo: 'limpar' } | { tipo: 'opcao'; o: OpcaoBusca } | { tipo: 'nova' };
  const entradas: Entrada[] = [...(comLimpar ? [{ tipo: 'limpar' } as const] : []), ...visiveis.map((o) => ({ tipo: 'opcao', o }) as const), ...(nova ? [{ tipo: 'nova' } as const] : [])];

  function posicionar() {
    const r = entrada.current?.getBoundingClientRect();
    if (!r) return;
    const abaixo = window.innerHeight - r.bottom - 12;
    const acima = r.top - 12;
    const largura = Math.max(r.width, duasLinhas ? 420 : 320);
    const left = Math.max(8, Math.min(r.left, window.innerWidth - largura - 8));
    if (abaixo >= 220 || abaixo >= acima) setPos({ left, width: largura, top: r.bottom + 4, maxHeight: Math.min(360, abaixo) });
    else setPos({ left, width: largura, bottom: window.innerHeight - r.top + 4, maxHeight: Math.min(360, acima) });
  }

  useLayoutEffect(() => {
    if (!aberto) return;
    posicionar();
    const f = () => posicionar();
    window.addEventListener('resize', f);
    window.addEventListener('scroll', f, true);
    return () => {
      window.removeEventListener('resize', f);
      window.removeEventListener('scroll', f, true);
    };
  }, [aberto]);

  useEffect(() => {
    if (!aberto) return;
    document.getElementById(`${listaId}-${ativo}`)?.scrollIntoView({ block: 'nearest' });
  }, [ativo, aberto, listaId]);

  function abrir() {
    if (desabilitado) return;
    setTexto('');
    const base = semEscolha !== undefined ? 1 : 0;
    const i = escolhida ? opcoes.findIndex((o) => o.id === escolhida.id) : -1;
    setAtivo(i >= 0 && i < MAX_VISIVEIS ? i + base : 0);
    setAberto(true);
  }
  function fechar() {
    setAberto(false);
    setTexto('');
  }
  function escolher(i: number) {
    const e = entradas[i];
    if (!e) return;
    if (e.tipo === 'nova') {
      const t = texto.trim();
      fechar();
      nova!.acao(t);
      return;
    }
    muda(e.tipo === 'limpar' ? '' : e.o.id);
    fechar();
    entrada.current?.blur();
  }

  let grupoAnterior: string | undefined;

  return (
    <div className={cls('escolha-busca', aberto && 'aberta')}>
      <input
        ref={entrada}
        className="entrada"
        role="combobox"
        aria-expanded={aberto}
        aria-controls={listaId}
        aria-autocomplete="list"
        aria-activedescendant={aberto ? `${listaId}-${ativo}` : undefined}
        autoComplete="off"
        autoFocus={autoFocus}
        disabled={desabilitado}
        placeholder={escolhida ? escolhida.rotulo : semEscolha ?? placeholder}
        title={escolhida?.rotulo}
        value={aberto ? texto : escolhida?.rotulo ?? ''}
        onFocus={abrir}
        onMouseDown={() => !aberto && document.activeElement === entrada.current && abrir()}
        onBlur={fechar}
        onChange={(e) => {
          setTexto(e.target.value);
          setAtivo(0);
          if (!aberto) setAberto(true);
        }}
        onKeyDown={(e) => {
          if (!aberto) {
            if (e.key === 'ArrowDown' || e.key === 'Enter') {
              e.preventDefault();
              abrir();
            }
            return;
          }
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setAtivo((a) => Math.min(entradas.length - 1, a + 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setAtivo((a) => Math.max(0, a - 1));
          } else if (e.key === 'Enter') {
            e.preventDefault();
            if (entradas.length) escolher(ativo);
          } else if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            fechar();
          } else if (e.key === 'Tab') {
            fechar();
          }
        }}
      />
      {detalheEscolhida && escolhida && !aberto && <span className="escolha-detalhe num">{detalheEscolhida}</span>}
      {aberto &&
        pos &&
        createPortal(
          <ul
            id={listaId}
            role="listbox"
            className="escolha-lista"
            style={{ left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom, maxHeight: pos.maxHeight }}
            onMouseDown={(e) => e.preventDefault() /* não tira o foco do campo */}
          >
            {entradas.map((e, i) => {
              const comum = {
                id: `${listaId}-${i}`,
                role: 'option',
                'aria-selected': i === ativo,
                onMouseEnter: () => setAtivo(i),
                onClick: () => escolher(i),
              };
              if (e.tipo === 'limpar')
                return (
                  <li key="__limpar" {...comum} className={cls('escolha-limpar', i === ativo && 'ativa', !valor && 'escolhida')}>
                    <span className="escolha-nome">{semEscolha}</span>
                  </li>
                );
              if (e.tipo === 'nova')
                return (
                  <Fragment key="__nova">
                    {achadas.length > visiveis.length && <AvisoMais n={achadas.length - visiveis.length} nome={nomePlural} />}
                    <li {...comum} className={cls('escolha-nova', i === ativo && 'ativa')}>
                      {nova!.rotulo(texto.trim())}
                    </li>
                  </Fragment>
                );
              const o = e.o;
              const titulo = o.grupo && o.grupo !== grupoAnterior ? o.grupo : null;
              grupoAnterior = o.grupo;
              return (
                <Fragment key={o.id}>
                  {titulo && (
                    <li className="escolha-grupo" role="presentation">
                      {titulo}
                    </li>
                  )}
                  <li {...comum} className={cls(i === ativo && 'ativa', o.id === valor && 'escolhida', duasLinhas && 'duas-linhas')}>
                    <span className="escolha-nome">{o.rotulo}</span>
                    {o.sub && <span className="escolha-sub num">{o.sub}</span>}
                  </li>
                </Fragment>
              );
            })}
            {visiveis.length === 0 && <li className="escolha-vazio">{texto.trim() ? `Nada encontrado com “${texto.trim()}”.` : 'Nenhuma opção.'}</li>}
            {!nova && achadas.length > visiveis.length && <AvisoMais n={achadas.length - visiveis.length} nome={nomePlural} />}
          </ul>,
          document.body,
        )}
    </div>
  );
}

const AvisoMais = ({ n, nome }: { n: number; nome: string }) => (
  <li className="escolha-vazio">
    Mais {n} {nome}. Digite mais letras para filtrar.
  </li>
);

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Empresa } from '../../dominio/tipos';
import { casaBusca } from '../../dominio/texto';
import { cls } from './base';

const MAX_VISIVEIS = 50;

/**
 * Campo de escolha de empresa com busca (revisão 5). Substitui a lista suspensa,
 * que fica inutilizável com dezenas de fornecedores. Busca por nome ou CNPJ, sem acento;
 * setas e Enter escolhem; a última opção cadastra uma nova empresa com o texto digitado.
 */
export function EscolhaEmpresa({
  valor,
  muda,
  empresas,
  aoNova,
  desabilitado,
  autoFocus,
}: {
  valor: string;
  muda: (id: string) => void;
  empresas: Map<string, Empresa>;
  aoNova?: (texto: string) => void;
  desabilitado?: boolean;
  autoFocus?: boolean;
}) {
  const listaId = useId();
  const entrada = useRef<HTMLInputElement>(null);
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState('');
  const [ativo, setAtivo] = useState(0);
  const [pos, setPos] = useState<{ left: number; width: number; top?: number; bottom?: number; maxHeight: number } | null>(null);

  const escolhida = valor ? empresas.get(valor) : undefined;
  const todas = useMemo(() => [...empresas.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')), [empresas]);
  const achadas = useMemo(
    () => (texto.trim() ? todas.filter((e) => casaBusca(`${e.nome} ${e.cnpj ?? ''} ${(e.cnpj ?? '').replace(/\D/g, '')}`, texto)) : todas),
    [todas, texto],
  );
  const visiveis = achadas.slice(0, MAX_VISIVEIS);
  const temNova = !!aoNova;
  const totalOpcoes = visiveis.length + (temNova ? 1 : 0);

  function posicionar() {
    const r = entrada.current?.getBoundingClientRect();
    if (!r) return;
    const abaixo = window.innerHeight - r.bottom - 12;
    const acima = r.top - 12;
    if (abaixo >= 220 || abaixo >= acima) setPos({ left: r.left, width: Math.max(r.width, 320), top: r.bottom + 4, maxHeight: Math.min(340, abaixo) });
    else setPos({ left: r.left, width: Math.max(r.width, 320), bottom: window.innerHeight - r.top + 4, maxHeight: Math.min(340, acima) });
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
    const i = escolhida ? todas.findIndex((e) => e.id === escolhida.id) : 0;
    setAtivo(i >= 0 && i < MAX_VISIVEIS ? i : 0);
    setAberto(true);
  }
  function fechar() {
    setAberto(false);
    setTexto('');
  }
  function escolher(i: number) {
    if (i < visiveis.length) {
      muda(visiveis[i].id);
      fechar();
      entrada.current?.blur();
    } else if (temNova) {
      const t = texto.trim();
      fechar();
      aoNova!(t);
    }
  }

  return (
    <div className={cls('escolha-empresa', aberto && 'aberta')}>
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
        placeholder={escolhida ? escolhida.nome : 'Digite o nome ou CNPJ…'}
        value={aberto ? texto : escolhida?.nome ?? ''}
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
            setAtivo((a) => Math.min(totalOpcoes - 1, a + 1));
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setAtivo((a) => Math.max(0, a - 1));
          } else if (e.key === 'Enter') {
            e.preventDefault();
            if (totalOpcoes) escolher(ativo);
          } else if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            fechar();
          } else if (e.key === 'Tab') {
            fechar();
          }
        }}
      />
      {escolhida?.cnpj && !aberto && <span className="escolha-cnpj num">{escolhida.cnpj}</span>}
      {aberto && pos && createPortal(
        <ul
          id={listaId}
          role="listbox"
          className="escolha-lista"
          style={{ left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom, maxHeight: pos.maxHeight }}
          onMouseDown={(e) => e.preventDefault() /* não tira o foco do campo */}
        >
          {visiveis.length === 0 && <li className="escolha-vazio">Nenhuma empresa com “{texto.trim()}”.</li>}
          {visiveis.map((e, i) => (
            <li
              key={e.id}
              id={`${listaId}-${i}`}
              role="option"
              aria-selected={i === ativo}
              className={cls(i === ativo && 'ativa', e.id === valor && 'escolhida')}
              onMouseEnter={() => setAtivo(i)}
              onClick={() => escolher(i)}
            >
              <span className="escolha-nome">{e.nome}</span>
              <span className="escolha-sub num">{e.cnpj || 'sem CNPJ'}</span>
            </li>
          ))}
          {achadas.length > visiveis.length && (
            <li className="escolha-vazio">
              Mais {achadas.length - visiveis.length} empresas. Digite mais letras para filtrar.
            </li>
          )}
          {temNova && (
            <li
              id={`${listaId}-${visiveis.length}`}
              role="option"
              aria-selected={ativo === visiveis.length}
              className={cls('escolha-nova', ativo === visiveis.length && 'ativa')}
              onMouseEnter={() => setAtivo(visiveis.length)}
              onClick={() => escolher(visiveis.length)}
            >
              + Cadastrar nova empresa{texto.trim() ? ` “${texto.trim()}”` : ''}
            </li>
          )}
        </ul>,
        document.body,
      )}
    </div>
  );
}

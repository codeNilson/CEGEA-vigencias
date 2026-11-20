import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { paginar } from '../../estado/seletores';
import { ROTULO_SITUACAO_ORDEM, rotuloSituacao, type Situacao as SituacaoT, type SituacaoOrdem } from '../../dominio/tipos';
import { faixaPrazo } from '../../dominio/calculos';
import { ORGAO } from '../orgao';
import { formatarData } from '../../dominio/datas';
import { colarMoeda, lerQuantidade, mascaraMoeda, textoQuantidade } from '../../dominio/numeros';

export const cls = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(' ');

/** Situação do documento: Vigente, Vencida/Vencido, Encerrado. */
export function Situacao({ s, tipo }: { s: SituacaoT; tipo: 'ata' | 'contrato' }) {
  return <span className={cls('situacao', `situacao-${s}`)}>{rotuloSituacao(s, tipo)}</span>;
}

/** Prazo até o vencimento, com destaque conforme a faixa (separado da situação). */
export function Prazo({ dias, s, encerradoEm }: { dias: number; s: SituacaoT; encerradoEm?: string }) {
  if (s === 'encerrado') return <span className="prazo prazo-normal">{encerradoEm ? `encerrado em ${formatarData(encerradoEm)}` : 'encerrado'}</span>;
  if (s === 'vencido') return <span className="prazo prazo-vencido">{textoDias(dias)}</span>;
  return <span className={cls('prazo', `prazo-${faixaPrazo(dias, s)}`)}>{textoDias(dias)}</span>;
}

export function SituacaoOrdemTag({ s }: { s: SituacaoOrdem }) {
  return <span className={cls('ordem-situacao', `ordem-${s}`)}>{ROTULO_SITUACAO_ORDEM[s]}</span>;
}

export function TagTipo({ tipo }: { tipo: 'ata' | 'contrato' }) {
  return <span className={cls('tag', `tag-${tipo}`)}>{tipo === 'ata' ? 'ARP' : 'Contrato'}</span>;
}

export function textoDias(dias: number): string {
  if (dias === 0) return 'vence hoje';
  if (dias === 1) return 'vence amanhã';
  if (dias > 0) return `vence em ${dias} dias`;
  if (dias === -1) return 'venceu ontem';
  return `venceu há ${-dias} dias`;
}

export const Data = ({ v }: { v: string | null | undefined }) => <span className="num">{v ? formatarData(v) : '-'}</span>;

// ---------- Modal ----------

export function Modal({
  titulo,
  aoFechar,
  children,
  rodape,
  largo,
}: {
  titulo: string;
  aoFechar: () => void;
  children: ReactNode;
  rodape?: ReactNode;
  largo?: boolean;
}) {
  const veu = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Só o modal de cima responde ao Esc.
    const f = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      const todos = document.querySelectorAll('.veu');
      if (todos[todos.length - 1] === veu.current) aoFechar();
    };
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, [aoFechar]);
  return (
    <div ref={veu} className="veu nao-imprimir" onMouseDown={(e) => e.target === e.currentTarget && aoFechar()}>
      <div className={cls('modal', largo && 'largo')} role="dialog" aria-modal="true" aria-label={titulo}>
        <div className="modal-cab">
          <h3>{titulo}</h3>
          <button className="btn btn-leve" onClick={aoFechar} aria-label="Fechar">
            ✕
          </button>
        </div>
        <div className="modal-corpo">{children}</div>
        {rodape && <div className="modal-rodape">{rodape}</div>}
      </div>
    </div>
  );
}

export function Erros({ erros }: { erros: string[] }) {
  if (!erros.length) return null;
  return (
    <ul className="erros" role="alert">
      {erros.map((e, i) => (
        <li key={i}>{e}</li>
      ))}
    </ul>
  );
}

/**
 * Formulário em modal: chama `aoSalvar`, que devolve erros (vazio = sucesso e fecha).
 */
export function ModalForm({
  titulo,
  aoFechar,
  aoSalvar,
  children,
  rotuloSalvar = 'Salvar',
  largo,
  extraRodape,
}: {
  titulo: string;
  aoFechar: () => void;
  aoSalvar: () => Promise<string[]> | string[];
  children: ReactNode;
  rotuloSalvar?: string;
  largo?: boolean;
  extraRodape?: ReactNode;
}) {
  const [erros, setErros] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);
  const formId = useId();
  async function enviar(e?: React.FormEvent) {
    e?.preventDefault();
    e?.stopPropagation();
    setSalvando(true);
    try {
      const r = await aoSalvar();
      if (r.length) setErros(r);
      else aoFechar();
    } finally {
      setSalvando(false);
    }
  }
  return (
    <Modal
      titulo={titulo}
      aoFechar={aoFechar}
      largo={largo}
      rodape={
        <>
          {extraRodape}
          <span style={{ flex: 1 }} />
          <button className="btn" type="button" onClick={aoFechar}>
            Cancelar
          </button>
          <button className="btn btn-primario" type="submit" form={formId} disabled={salvando}>
            {salvando ? 'Gravando…' : rotuloSalvar}
          </button>
        </>
      }
    >
      <form id={formId} onSubmit={enviar} noValidate>
        <Erros erros={erros} />
        {children}
      </form>
    </Modal>
  );
}

// ---------- Confirmação ----------

export function useConfirmacao() {
  const [pedido, setPedido] = useState<null | {
    titulo: string;
    texto: ReactNode;
    rotulo: string;
    acao: () => Promise<string[]>;
  }>(null);
  const [erros, setErros] = useState<string[]>([]);
  const [ocupado, setOcupado] = useState(false);

  const pedir = (titulo: string, texto: ReactNode, acao: () => Promise<string[]>, rotulo = 'Excluir definitivamente') => {
    setErros([]);
    setPedido({ titulo, texto, acao, rotulo });
  };

  const elemento = pedido && (
    <Modal
      titulo={pedido.titulo}
      aoFechar={() => setPedido(null)}
      rodape={
        <>
          <button className="btn" onClick={() => setPedido(null)}>
            Cancelar
          </button>
          <button
            className="btn btn-perigo"
            disabled={ocupado}
            onClick={async () => {
              setOcupado(true);
              const r = await pedido.acao();
              setOcupado(false);
              if (r.length) setErros(r);
              else setPedido(null);
            }}
          >
            {pedido.rotulo}
          </button>
        </>
      }
    >
      {erros.length > 0 && (
        <>
          <p className="nota">Não é possível excluir. Remova antes:</p>
          <Erros erros={erros} />
        </>
      )}
      <div>{pedido.texto}</div>
    </Modal>
  );
  return { pedir, elemento };
}

// ---------- Campos ----------

export function Campo({ rotulo, dica, className, children }: { rotulo: string; dica?: string; className?: string; children: ReactNode }) {
  return (
    <label className={cls('campo', className)}>
      <span>{rotulo}</span>
      {children}
      {dica && <small>{dica}</small>}
    </label>
  );
}

type PropsEntrada = Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> & {
  valor: string;
  muda: (v: string) => void;
};

export function Entrada({ valor, muda, className, ...p }: PropsEntrada) {
  return <input className={cls('entrada', className)} value={valor} onChange={(e) => muda(e.target.value)} {...p} />;
}

export function EntradaNumero({ valor, muda, ...p }: PropsEntrada) {
  return <Entrada className="num" inputMode="decimal" valor={valor} muda={muda} autoComplete="off" {...p} />;
}

/** Quantidade: ao sair do campo, ganha separador de milhar (1500 -> 1.500). Até 3 casas decimais. */
export function EntradaQuantidade({ valor, muda, ...p }: PropsEntrada) {
  return (
    <EntradaNumero
      valor={valor}
      muda={muda}
      onBlur={() => {
        const q = lerQuantidade(valor);
        if (q !== null) muda(textoQuantidade(q));
      }}
      {...p}
    />
  );
}

/** Valor em R$ com máscara: digite só números, os centavos se preenchem da direita (500 -> 5,00). */
export function EntradaMoeda({ valor, muda, className, ...p }: PropsEntrada) {
  return (
    <span className={cls('entrada-moeda', className)}>
      <span className="prefixo">R$</span>
      <input
        className="entrada num"
        inputMode="numeric"
        autoComplete="off"
        value={valor}
        onChange={(e) => muda(mascaraMoeda(e.target.value))}
        onPaste={(e) => {
          const t = colarMoeda(e.clipboardData.getData('text'));
          if (t !== null) {
            e.preventDefault();
            muda(t);
          }
        }}
        {...p}
      />
    </span>
  );
}

export function EntradaData({ valor, muda, ...p }: PropsEntrada) {
  return <Entrada type="date" valor={valor} muda={muda} {...p} />;
}

export function Escolha<T extends string>({
  valor,
  muda,
  opcoes,
  vazio,
}: {
  valor: T | '';
  muda: (v: T) => void;
  opcoes: Array<[T, string]>;
  vazio?: string;
}) {
  return (
    <select className="entrada" value={valor} onChange={(e) => muda(e.target.value as T)}>
      {vazio !== undefined && <option value="">{vazio}</option>}
      {opcoes.map(([v, r]) => (
        <option key={v} value={v}>
          {r}
        </option>
      ))}
    </select>
  );
}

export function Segmentado<T extends string>({ valor, muda, opcoes }: { valor: T; muda: (v: T) => void; opcoes: Array<[T, string] | [T, string, number]> }) {
  return (
    <div className="segmentado" role="group">
      {opcoes.map(([v, r, n]) => (
        <button key={v} type="button" aria-pressed={valor === v} onClick={() => muda(v)}>
          {r}
          {n !== undefined && <span className="qtd">{n}</span>}
        </button>
      ))}
    </div>
  );
}

export function Dado({ rotulo, children, num }: { rotulo: string; children: ReactNode; num?: boolean }) {
  return (
    <div className="dado">
      <dt>{rotulo}</dt>
      <dd className={num ? 'num' : undefined}>{children || <span className="fraco">-</span>}</dd>
    </div>
  );
}

export function CabecalhoImpressao({ titulo, hoje }: { titulo: string; hoje: string }) {
  return (
    <div className="so-impressao cabecalho-impressao">
      <strong>{titulo}</strong>
      <span>
        {ORGAO.sigla} · {ORGAO.setor} · emitido em {formatarData(hoje)} às {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
      </span>
    </div>
  );
}

// ---------- Paginação (revisão 5; revisão 7: comum a todas as listas) ----------

/** true enquanto o Chrome prepara a impressão (botão PDF ou Ctrl+P). */
export function useImprimindo(): boolean {
  const [imprimindo, setImprimindo] = useState(false);
  useEffect(() => {
    // flushSync: a lista inteira precisa estar na tela antes de o Chrome montar a impressão.
    const antes = () => flushSync(() => setImprimindo(true));
    const depois = () => setImprimindo(false);
    window.addEventListener('beforeprint', antes);
    window.addEventListener('afterprint', depois);
    return () => {
      window.removeEventListener('beforeprint', antes);
      window.removeEventListener('afterprint', depois);
    };
  }, []);
  return imprimindo;
}

/**
 * Página atual de uma lista. Volta para a primeira página quando `chave` muda (busca, filtro).
 * Na impressão, devolve a lista inteira.
 */
export function usePaginacao<T>(lista: readonly T[], porPagina: number, chave = '') {
  const [estado, setEstado] = useState({ pagina: 1, chave });
  const imprimindo = useImprimindo();
  const pagina = estado.chave === chave ? estado.pagina : 1;
  const p = paginar(lista, pagina, porPagina);
  return {
    itens: imprimindo ? [...lista] : p.itens,
    paginacao: { pagina: p.pagina, total: p.total, porPagina, muda: (n: number) => setEstado({ pagina: n, chave }) },
  };
}

export function Paginacao({
  pagina,
  total,
  porPagina,
  muda,
  soComVariasPaginas,
}: {
  pagina: number;
  total: number;
  porPagina: number;
  muda: (p: number) => void;
  /** Não mostra nada quando tudo cabe numa página (fichas da ARP e do contrato). */
  soComVariasPaginas?: boolean;
}) {
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  if (total === 0 || (soComVariasPaginas && paginas === 1)) return null;
  const ini = (pagina - 1) * porPagina + 1;
  const fim = Math.min(total, pagina * porPagina);
  return (
    <div className="paginacao">
      <span className="num">
        Mostrando {ini} a {fim} de {total}
      </span>
      {paginas > 1 && (
        <span className="paginacao-botoes">
          <button type="button" className="btn btn-mini" disabled={pagina <= 1} onClick={() => muda(pagina - 1)}>
            ‹ Anterior
          </button>
          <span className="num">
            Página {pagina} de {paginas}
          </span>
          <button type="button" className="btn btn-mini" disabled={pagina >= paginas} onClick={() => muda(pagina + 1)}>
            Próxima ›
          </button>
        </span>
      )}
    </div>
  );
}

import { hojeISO, somarDias } from '../dominio/datas';
import { novaAta, novaEmpresa, novoContrato } from '../dominio/fabrica';
import type { Agregado, Ata, Contrato, Empresa, ItemAta, ItemContrato, Ordem } from '../dominio/tipos';
import { RepositorioMemoria } from '../armazenamento/memoria';

/**
 * Dados fictícios para conhecer o sistema sem tocar na pasta de rede. Datas relativas a hoje.
 * Com `grande`, acrescenta volume (dezenas de ARPs, centenas de contratos e OF/OS) para conferir
 * busca e paginação: abra com `?demo=grande`.
 */
export async function repositorioDemonstracao(opcoes: { grande?: boolean } = {}): Promise<RepositorioMemoria> {
  const repo = new RepositorioMemoria('Demonstração (dados fictícios, nada é gravado na rede)');
  const h = hojeISO();
  const d = (n: number) => somarDias(h, n);
  const Q = (n: number) => n * 1000;
  const V = (n: number) => Math.round(n * 10000);

  const alfa = novaEmpresa({ nome: 'Papelaria Ribeira Ltda', cnpj: '11.222.333/0001-81', email: 'licitacoes@papelariaribeira.exemplo', telefone: '(85) 3000-1111' });
  const beta = novaEmpresa({ nome: 'Mucuripe Suprimentos ME', cnpj: '22.333.444/0001-81', email: 'vendas@mucuripe.exemplo', telefone: '(85) 98888-2222' });
  const clima = novaEmpresa({ nome: 'Climatiza Nordeste Serviços Ltda', cnpj: '33.444.555/0001-81', telefone: '(85) 3000-3333' });
  const luz = novaEmpresa({ nome: 'Jangada Materiais Elétricos Ltda', cnpj: '44.555.666/0001-81' });
  const limpa = novaEmpresa({ nome: 'Iracema Facilities Ltda', cnpj: null });

  const ataPapel = novaAta({
    numero: '018/2026',
    tema: 'Material de expediente',
    dataInicio: d(-313),
    dataFim: d(52),
    itens: [
      {
        id: 'demo-it-papel',
        descricao: 'Papel A4 75 g/m², resma 500 folhas',
        unidade: 'resma',
        parcelas: [
          { id: 'demo-p-papel-a', empresaId: alfa.id, tipoCota: 'ampla', quantidade: Q(1000), valorUnitario: V(24.9) },
          { id: 'demo-p-papel-b', empresaId: beta.id, tipoCota: 'cota_me', quantidade: Q(250), valorUnitario: V(25.4) },
        ],
      },
      {
        id: 'demo-it-caneta',
        descricao: 'Caneta esferográfica azul, caixa com 50',
        unidade: 'caixa',
        parcelas: [{ id: 'demo-p-caneta', empresaId: alfa.id, tipoCota: 'ampla', quantidade: Q(120), valorUnitario: V(38.75) }],
      },
    ],
    aditivos: [
      {
        id: 'demo-ad-reeq',
        identificacao: '1º Termo de Reequilíbrio',
        data: d(-35),
        tipo: 'reequilibrio',
        novaDataFim: null,
        quantidades: [],
        inicioEfeitos: d(-30),
        valores: [{ parcelaId: 'demo-p-papel-a', novoValorUnitario: V(26.5) }],
        observacoes: 'Reajuste do preço da celulose',
      },
    ],
  });

  const ataClima = novaAta({
    numero: '007/2026',
    tema: 'Manutenção preventiva e corretiva de ar-condicionado',
    dataInicio: d(-160),
    dataFim: d(205),
    itens: [
      {
        id: 'demo-it-split',
        descricao: 'Manutenção preventiva split até 24.000 BTU',
        unidade: 'serviço',
        parcelas: [{ id: 'demo-p-split', empresaId: clima.id, tipoCota: 'ampla', quantidade: Q(480), valorUnitario: V(145) }],
      },
    ],
  });

  const ataEletrica = novaAta({
    numero: '031/2025',
    tema: 'Material elétrico',
    dataInicio: d(-376),
    dataFim: d(-11),
    itens: [
      {
        id: 'demo-it-lampada',
        descricao: 'Lâmpada LED tubular 18 W',
        unidade: 'un',
        parcelas: [{ id: 'demo-p-lampada', empresaId: luz.id, tipoCota: 'ampla', quantidade: Q(2000), valorUnitario: V(13.9) }],
      },
    ],
    aditivos: [
      { id: 'demo-ad-el', identificacao: '1º Termo Aditivo', data: d(-200), tipo: 'quantidade', novaDataFim: null, quantidades: [{ parcelaId: 'demo-p-lampada', novaQuantidade: Q(2500) }], inicioEfeitos: '', valores: [], observacoes: 'Acréscimo de 25%' },
    ],
  });

  const cPapel = novoContrato({
    numero: '045/2026',
    empresaId: alfa.id,
    tipo: 'material',
    objeto: 'Aquisição de material de expediente',
    ataId: ataPapel.id,
    dataInicio: d(-290),
    dataFim: d(75),
    gestor: 'Ana Lúcia Moreira',
    fiscal: 'Rafael Nogueira',
    itens: [
      { id: 'demo-ci-papel', parcelaId: 'demo-p-papel-a', descricao: 'Papel A4 75 g/m², resma 500 folhas', unidade: 'resma', quantidade: Q(400), valorUnitario: V(24.9) },
      { id: 'demo-ci-caneta', parcelaId: 'demo-p-caneta', descricao: 'Caneta esferográfica azul, caixa com 50', unidade: 'caixa', quantidade: Q(60), valorUnitario: V(38.75) },
    ],
    aditivos: [
      { id: 'demo-ad-reeq', identificacao: '1º Apostilamento', tipo: 'reequilibrio', dataAssinatura: d(-100), inicioEfeitos: d(-95), novaDataFim: null, alteracoes: [{ itemId: 'demo-ci-papel', novaQuantidade: null, novoValorUnitario: V(26.3) }], observacoes: 'Reajuste do preço da celulose' },
    ],
    ordens: [
      { id: 'demo-of-1', numero: 'OF 112/2026', dataEmissao: d(-250), prazoDias: 10, tipoPrazo: 'uteis', dataEntrega: d(-240), itens: [{ itemId: 'demo-ci-papel', quantidade: Q(150) }, { itemId: 'demo-ci-caneta', quantidade: Q(20) }], observacoes: '' },
      { id: 'demo-of-2', numero: 'OF 287/2026', dataEmissao: d(-6), prazoDias: 5, tipoPrazo: 'uteis', dataEntrega: null, itens: [{ itemId: 'demo-ci-papel', quantidade: Q(120) }], observacoes: '' },
    ],
  });

  const cPapel2 = novoContrato({
    numero: '102/2026',
    empresaId: beta.id,
    tipo: 'material',
    objeto: 'Aquisição de papel A4 (cota ME)',
    ataId: ataPapel.id,
    dataInicio: d(-120),
    dataFim: d(245),
    gestor: 'Tereza Damasceno',
    fiscal: 'Ana Lúcia Moreira',
    itens: [{ id: 'demo-ci-papel-me', parcelaId: 'demo-p-papel-b', descricao: 'Papel A4 75 g/m², resma 500 folhas', unidade: 'resma', quantidade: Q(250), valorUnitario: V(25.4) }],
    ordens: [{ id: 'demo-of-3', numero: 'OF 301/2026', dataEmissao: d(-12), prazoDias: 10, tipoPrazo: 'corridos', dataEntrega: null, itens: [{ itemId: 'demo-ci-papel-me', quantidade: Q(80) }], observacoes: 'Cobrar fornecedor' }],
  });

  const cClima = novoContrato({
    numero: '019/2026',
    empresaId: clima.id,
    tipo: 'servico',
    objeto: 'Manutenção de condicionadores de ar da sede',
    ataId: ataClima.id,
    dataInicio: d(-140),
    dataFim: d(225),
    gestor: 'Rafael Nogueira',
    fiscal: 'Tereza Damasceno',
    itens: [{ id: 'demo-ci-split', parcelaId: 'demo-p-split', descricao: 'Manutenção preventiva split até 24.000 BTU', unidade: 'serviço', quantidade: Q(240), valorUnitario: V(145) }],
    ordens: [{ id: 'demo-os-1', numero: 'OS 014/2026', dataEmissao: d(-1), prazoDias: 3, tipoPrazo: 'corridos', dataEntrega: null, itens: [{ itemId: 'demo-ci-split', quantidade: Q(40) }], observacoes: '' }],
  });

  const cLimpeza = novoContrato({
    numero: '088/2025',
    empresaId: limpa.id,
    tipo: 'servico',
    objeto: 'Limpeza e conservação predial (dispensa)',
    ataId: null,
    dataInicio: d(-400),
    dataFim: d(-35),
    gestor: 'Ana Lúcia Moreira',
    fiscal: 'Rafael Nogueira',
    itens: [{ id: 'demo-ci-limpeza', parcelaId: null, descricao: 'Posto de limpeza 44 h semanais', unidade: 'posto/mês', quantidade: Q(48), valorUnitario: V(4890.5) }],
    aditivos: [{ id: 'demo-ad-limp', identificacao: '1º Termo Aditivo', tipo: 'prazo', dataAssinatura: d(-50), inicioEfeitos: d(-34), novaDataFim: d(18), alteracoes: [], observacoes: 'Prorrogação excepcional' }],
  });

  const cEletrica = novoContrato({
    numero: '063/2025',
    empresaId: luz.id,
    tipo: 'material',
    objeto: 'Aquisição de lâmpadas LED',
    ataId: ataEletrica.id,
    dataInicio: d(-360),
    dataFim: d(-6),
    gestor: 'Tereza Damasceno',
    fiscal: 'Rafael Nogueira',
    itens: [{ id: 'demo-ci-lamp', parcelaId: 'demo-p-lampada', descricao: 'Lâmpada LED tubular 18 W', unidade: 'un', quantidade: Q(1500), valorUnitario: V(13.9) }],
    ordens: [{ id: 'demo-of-4', numero: 'OF 077/2025', dataEmissao: d(-330), prazoDias: 15, tipoPrazo: 'corridos', dataEntrega: d(-318), itens: [{ itemId: 'demo-ci-lamp', quantidade: Q(1500) }], observacoes: '' }],
  });

  const cEncerrado = novoContrato({
    numero: '011/2025',
    empresaId: luz.id,
    tipo: 'material',
    objeto: 'Aquisição de reatores',
    ataId: null,
    dataInicio: d(-500),
    dataFim: d(-135),
    gestor: 'Tereza Damasceno',
    fiscal: 'Ana Lúcia Moreira',
    itens: [{ id: 'demo-ci-reator', parcelaId: null, descricao: 'Reator eletrônico 2x32 W', unidade: 'un', quantidade: Q(200), valorUnitario: V(42) }],
    encerramento: { data: d(-120), termo: 'Termo de Encerramento 004/2025' },
  });

  const agua = novaEmpresa({ nome: 'Fonte Pajeú Distribuidora Ltda', cnpj: '55.666.777/0001-81' });
  const ataLimpeza = novaAta({
    numero: '022/2026',
    tema: 'Material de limpeza e higiene',
    dataInicio: d(-353),
    dataFim: d(12),
    itens: [
      {
        id: 'demo-it-sabao',
        descricao: 'Sabão em pó 1 kg',
        unidade: 'pacote',
        parcelas: [{ id: 'demo-p-sabao', empresaId: beta.id, tipoCota: 'cota_me', quantidade: Q(300), valorUnitario: V(11.2) }],
      },
    ],
  });
  const ataAgua = novaAta({
    numero: '041/2026',
    tema: 'Água mineral em garrafão de 20 L',
    dataInicio: d(-290),
    dataFim: d(75),
    itens: [
      {
        id: 'demo-it-agua',
        descricao: 'Água mineral, garrafão 20 L',
        unidade: 'garrafão',
        parcelas: [{ id: 'demo-p-agua', empresaId: agua.id, tipoCota: 'ampla', quantidade: Q(2400), valorUnitario: V(9.5) }],
      },
    ],
  });
  const cAgua = novoContrato({
    numero: '077/2026',
    empresaId: agua.id,
    tipo: 'material',
    objeto: 'Fornecimento de água mineral',
    ataId: ataAgua.id,
    dataInicio: d(-280),
    dataFim: d(85),
    gestor: 'Rafael Nogueira',
    fiscal: 'Ana Lúcia Moreira',
    itens: [{ id: 'demo-ci-agua', parcelaId: 'demo-p-agua', descricao: 'Água mineral, garrafão 20 L', unidade: 'garrafão', quantidade: Q(1200), valorUnitario: V(9.5) }],
    ordens: [
      { id: 'demo-of-5', numero: 'OF 310/2026', dataEmissao: d(-3), prazoDias: 5, tipoPrazo: 'corridos', dataEntrega: null, itens: [{ itemId: 'demo-ci-agua', quantidade: Q(100) }], observacoes: '' },
      { id: 'demo-of-6', numero: 'OF 255/2026', dataEmissao: d(-40), prazoDias: 5, tipoPrazo: 'corridos', dataEntrega: d(-36), itens: [{ itemId: 'demo-ci-agua', quantidade: Q(100) }], observacoes: '' },
    ],
  });

  // Mais fornecedores, para ver busca e paginação com volume realista.
  const ramos = ['Comercial', 'Distribuidora', 'Construções', 'Serviços Gerais', 'Informática', 'Gráfica', 'Engenharia', 'Suprimentos', 'Ferragens'];
  const lugares = ['Aldeota', 'Benfica', 'Parangaba', 'Messejana', 'Meireles', 'Montese', 'Cocó', 'Fátima', 'Varjota', 'Itaperi'];
  const extras = Array.from({ length: 45 }, (_, i) =>
    novaEmpresa({ nome: `${ramos[i % ramos.length]} ${lugares[Math.floor(i / ramos.length) % lugares.length]} ${['Ltda', 'ME', 'EPP', 'Eireli', 'S/A'][i % 5]}`, cnpj: null }),
  );

  const todos: Agregado[] = [...extras, alfa, beta, clima, luz, limpa, agua, ataPapel, ataClima, ataEletrica, ataLimpeza, ataAgua, cPapel, cPapel2, cClima, cLimpeza, cEletrica, cEncerrado, cAgua];
  if (opcoes.grande) todos.push(...volumeDemonstracao(extras, d));
  for (const r of todos) {
    const col = r.registro === 'empresa' ? 'empresas' : r.registro === 'ata' ? 'atas' : 'contratos';
    await repo.gravar(col, r.id, { ...r, versao: 1, atualizadoEm: new Date().toISOString() });
  }
  return repo;
}

/** Volume extra e determinístico para a demonstração grande. */
function volumeDemonstracao(empresas: Empresa[], d: (n: number) => string): Agregado[] {
  let semente = 7;
  const sorteio = (n: number) => {
    semente = (semente * 1103515245 + 12345) % 2147483648;
    return (semente >> 16) % n;
  };
  const Q = (n: number) => n * 1000;
  const V = (n: number) => Math.round(n * 10000);
  const objetos = ['Material de expediente', 'Material de limpeza', 'Material elétrico', 'Material hidráulico', 'Equipamentos de informática', 'Mobiliário', 'Gêneros alimentícios', 'Uniformes', 'Ferramentas', 'Material gráfico', 'EPI', 'Material de construção'];
  const produtos = ['Cabo flexível', 'Tomada 2P+T', 'Disjuntor', 'Tubo PVC', 'Joelho 90°', 'Registro de gaveta', 'Cadeira giratória', 'Mesa de reunião', 'Toner', 'Mouse óptico', 'Teclado ABNT2', 'Detergente', 'Desinfetante', 'Saco de lixo', 'Luva nitrílica', 'Capacete', 'Cimento CP II', 'Areia média', 'Tinta acrílica', 'Envelope ofício'];
  const variantes = ['pequeno', 'médio', 'grande', '1,5 mm', '2,5 mm', '10 A', '20 A', '25 mm', '50 mm', 'azul', 'branco', 'preto', '5 L', '100 L', 'tamanho M', 'tamanho G'];
  const atas: Ata[] = [];
  for (let k = 0; k < 40; k++) {
    const fim = d(-240 + k * 14);
    const nItens = k === 0 ? 120 : 3 + sorteio(12);
    const itens: ItemAta[] = Array.from({ length: nItens }, (_, i) => {
      const fornecedores = 1 + sorteio(2);
      return {
        id: `dg-a${k}-i${i}`,
        descricao: `${produtos[(i + k) % produtos.length]} ${variantes[(Math.floor(i / produtos.length) + k) % variantes.length]}`,
        unidade: ['un', 'cx', 'pct', 'm', 'kg'][i % 5],
        parcelas: Array.from({ length: fornecedores }, (_, f) => ({
          id: `dg-a${k}-i${i}-p${f}`,
          empresaId: empresas[(k * 3 + i % 4 + f * 11) % empresas.length].id,
          tipoCota: f === 0 ? ('ampla' as const) : ('cota_me' as const),
          quantidade: Q(500 + sorteio(20) * 50),
          valorUnitario: V(5 + sorteio(400) + sorteio(100) / 100),
        })),
      };
    });
    atas.push(novaAta({ numero: `${String(100 + k).padStart(3, '0')}/${k < 20 ? 2025 : 2026}`, tema: objetos[k % objetos.length], dataInicio: somarDias(fim, -365), dataFim: fim, itens }));
  }
  const contratos: Contrato[] = [];
  for (let i = 0; i < 150; i++) {
    const ata = atas[i % atas.length];
    const empresaId = ata.itens[i % ata.itens.length].parcelas[0].empresaId;
    const parcelas = ata.itens.flatMap((it) => it.parcelas.filter((p) => p.empresaId === empresaId).map((p) => ({ it, p })));
    const escolhidas = ata === atas[0] ? parcelas.slice(0, 40) : parcelas.slice(0, 1 + sorteio(5));
    const inicio = somarDias(ata.dataInicio, 10 + sorteio(200));
    const itens: ItemContrato[] = escolhidas.map(({ it, p }, j) => ({ id: `dg-c${i}-i${j}`, parcelaId: p.id, descricao: it.descricao, unidade: it.unidade, quantidade: Q(50), valorUnitario: p.valorUnitario }));
    const ordens: Ordem[] = [];
    const prorrogado = i % 10 === 0;
    const nOrdens = prorrogado ? 8 : sorteio(7);
    for (let o = 0; o < nOrdens; o++) {
      const emissao = somarDias(inicio, 5 + o * (prorrogado ? 45 : 30));
      if (emissao > d(0)) break;
      ordens.push({
        id: `dg-c${i}-o${o}`,
        numero: `${i % 3 ? 'OF' : 'OS'} ${String(500 + i * 7 + o).padStart(3, '0')}/2026`,
        dataEmissao: emissao,
        prazoDias: 5 + sorteio(10),
        tipoPrazo: sorteio(2) ? 'uteis' : 'corridos',
        dataEntrega: sorteio(4) ? somarDias(emissao, 3 + sorteio(8)) : null,
        itens: itens.slice(0, 1 + sorteio(Math.max(1, itens.length))).map((x) => ({ itemId: x.id, quantidade: Q(1 + sorteio(3)) })),
        observacoes: '',
      });
    }
    contratos.push(
      novoContrato({
        numero: `${String(200 + i).padStart(3, '0')}/2026`,
        empresaId,
        tipo: 'material',
        objeto: `Aquisição de ${ata.tema.toLowerCase()}`,
        ataId: ata.id,
        dataInicio: inicio,
        // Um em cada dez foi prorrogado: OF/OS ficam divididas entre a vigência atual e a anterior.
        dataFim: somarDias(inicio, prorrogado ? 180 : 365),
        aditivos:
          prorrogado
            ? [{ id: `dg-c${i}-ad`, identificacao: '1º Termo Aditivo', tipo: 'prazo' as const, dataAssinatura: somarDias(inicio, 170), inicioEfeitos: somarDias(inicio, 181), novaDataFim: somarDias(inicio, 545), alteracoes: [], observacoes: '' }]
            : [],
        gestor: 'Ana Lúcia Moreira',
        fiscal: 'Rafael Nogueira',
        itens,
        ordens,
      }),
    );
  }
  return [...atas, ...contratos];
}

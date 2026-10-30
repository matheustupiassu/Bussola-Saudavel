// js/funcionalidades/busca-filtros.js
import {
  listarOpcoesFiltros,
  pesquisarUnidades,
  obterAvisoArmazenamento
} from '../repositorios/repositorio-local.js';
import { AdaptadorGoogleMaps } from '../integracoes/google-maps.js';

const NAV_STATE_KEY = 'bussola_nav_busca_state_v1';
const ITENS_POR_PAGINA = 4;

// Pontos de referência ilustrativos em Belém para teste de distância sem exigir GPS real
const PONTOS_REFERENCIA_BELEM = {
  MARCO_PRAÇA: { rotulo: 'Marco (Centro-Sul — Ilustrativo)', lat: -1.4375, lng: -48.4612 },
  NAZARE_CENTRO: { rotulo: 'Nazaré / Umarizal (Centro — Ilustrativo)', lat: -1.4521, lng: -48.4810 },
  ICOARACI_DISTRITO: { rotulo: 'Icoaraci (Distrito Norte — Ilustrativo)', lat: -1.3055, lng: -48.4790 }
};

let estadoBusca = {
  termo: '',
  modo: 'todos',
  redes: [],
  bairros: [],
  distanciaMaxKm: '',
  coordReferencia: null,
  rotuloReferencia: '',
  especialidadesIds: [],
  disponibilidades: [],
  tiposUnidade: [],
  diasTurnos: [],
  convenios: [],
  acessibilidades: [],
  confiabilidades: [],
  limitesMapa: null,
  ordenacao: 'relevancia',
  visaoMobile: 'lista', // 'lista' | 'mapa'
  limitePaginacao: ITENS_POR_PAGINA,
  unidadeSelecionadaId: null
};

let adaptadorMapa = null;
let ultimosResultados = [];

export function inicializarPaginaBuscaCompleta() {
  const aviso = obterAvisoArmazenamento();
  const avisoEl = document.getElementById('aviso-armazenamento');
  if (aviso && avisoEl) {
    avisoEl.hidden = false;
    avisoEl.textContent = aviso;
  }

  popularControlesDosDezFiltros();
  restaurarEstadoDaUrlOuSessao();

  adaptadorMapa = new AdaptadorGoogleMaps({
    containerId: 'mapa-container',
    statusId: 'mapa-status-bar',
    btnPesquisarAreaId: 'btn-pesquisar-nesta-area',
    onSelecionarUnidade: (unidadeId) => selecionarUnidadeNaInterface(unidadeId, false),
    onPesquisarNestaArea: () => aplicarPesquisaNestaArea()
  });

  configurarEventosBuscaEFiltros();
  executarConsultaEAtualizarTela(true);
}

function popularControlesDosDezFiltros() {
  const opcoes = listarOpcoesFiltros();

  renderizarCheckboxesFiltro('filtro-redes', 'redes', opcoes.redes.map((r) => ({ valor: r, rotulo: r })));
  renderizarCheckboxesFiltro('filtro-bairros', 'bairros', opcoes.bairros.map((b) => ({ valor: b, rotulo: b })));
  renderizarCheckboxesFiltro(
    'filtro-especialidades',
    'especialidadesIds',
    opcoes.especialidades.map((e) => ({ valor: e.id, rotulo: e.nome }))
  );
  renderizarCheckboxesFiltro(
    'filtro-disponibilidades',
    'disponibilidades',
    opcoes.estadosDisponibilidade.map((d) => ({ valor: d.codigo, rotulo: `${d.icone} ${d.rotulo}` }))
  );
  renderizarCheckboxesFiltro('filtro-tipos', 'tiposUnidade', opcoes.tiposUnidade.map((t) => ({ valor: t, rotulo: t })));
  renderizarCheckboxesFiltro('filtro-turnos', 'diasTurnos', opcoes.diasTurnos.map((dt) => ({ valor: dt, rotulo: dt })));
  renderizarCheckboxesFiltro('filtro-convenios', 'convenios', opcoes.convenios.map((c) => ({ valor: c, rotulo: c })));
  renderizarCheckboxesFiltro(
    'filtro-acessibilidades',
    'acessibilidades',
    opcoes.acessibilidades.map((a) => ({ valor: a, rotulo: a }))
  );
  renderizarCheckboxesFiltro(
    'filtro-confiabilidades',
    'confiabilidades',
    opcoes.confiabilidades.map((c) => ({ valor: c.codigo, rotulo: `${c.icone} ${c.rotulo}` }))
  );
}

function renderizarCheckboxesFiltro(containerId, chaveEstado, itens) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';

  itens.forEach((item, idx) => {
    const label = document.createElement('label');
    label.className = 'filter-check-label';

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.name = chaveEstado;
    input.value = item.valor;
    input.id = `chk-${chaveEstado}-${idx}`;
    input.addEventListener('change', () => {
      sincronizarArrayDeCheckboxes(chaveEstado);
      estadoBusca.limitePaginacao = ITENS_POR_PAGINA;
      executarConsultaEAtualizarTela();
    });

    const span = document.createElement('span');
    span.textContent = item.rotulo;

    label.appendChild(input);
    label.appendChild(span);
    container.appendChild(label);
  });
}

function sincronizarArrayDeCheckboxes(chaveEstado) {
  const marcados = Array.from(document.querySelectorAll(`input[name="${chaveEstado}"]:checked`)).map((el) => el.value);
  estadoBusca[chaveEstado] = marcados;
}

function marcarCheckboxesPeloEstado() {
  const chaves = [
    'redes',
    'bairros',
    'especialidadesIds',
    'disponibilidades',
    'tiposUnidade',
    'diasTurnos',
    'convenios',
    'acessibilidades',
    'confiabilidades'
  ];
  chaves.forEach((chave) => {
    const valores = estadoBusca[chave] || [];
    document.querySelectorAll(`input[name="${chave}"]`).forEach((chk) => {
      chk.checked = valores.includes(chk.value);
    });
  });

  const inputTermo = document.getElementById('busca-termo');
  const selectModo = document.getElementById('busca-modo');
  const selectOrdenacao = document.getElementById('select-ordenacao');
  const selectDistancia = document.getElementById('select-distancia-max');

  if (inputTermo) inputTermo.value = estadoBusca.termo;
  if (selectModo) selectModo.value = estadoBusca.modo;
  if (selectOrdenacao) selectOrdenacao.value = estadoBusca.ordenacao;
  if (selectDistancia) {
    selectDistancia.disabled = !estadoBusca.coordReferencia;
    selectDistancia.value = estadoBusca.distanciaMaxKm || '';
  }

  atualizarStatusReferenciaDistancia();
  aplicarVisaoMobile(estadoBusca.visaoMobile);
}

/**
 * Restaura pesquisa/filtros da URL ou do sessionStorage ao voltar dos detalhes (RF-006 / RF-010 / CA-304)
 */
function restaurarEstadoDaUrlOuSessao() {
  const params = new URLSearchParams(window.location.search);
  const temParametrosUrl = Array.from(params.keys()).length > 0;

  if (!temParametrosUrl) {
    try {
      const salvo = sessionStorage.getItem(NAV_STATE_KEY);
      if (salvo) {
        const parsed = JSON.parse(salvo);
        estadoBusca = { ...estadoBusca, ...parsed };
        marcarCheckboxesPeloEstado();
        return;
      }
    } catch (e) {
      console.warn('Não foi possível restaurar estado de sessão da busca:', e);
    }
  }

  const lerLista = (chave) => {
    const val = params.get(chave);
    return val ? val.split(',').filter(Boolean) : [];
  };

  estadoBusca.termo = params.get('q') || '';
  estadoBusca.modo = params.get('modo') || 'todos';
  estadoBusca.ordenacao = params.get('ord') || 'relevancia';
  estadoBusca.redes = lerLista('redes');
  if (params.get('rede') && params.get('rede') !== 'TODAS' && estadoBusca.redes.length === 0) {
    estadoBusca.redes = [params.get('rede')];
  }
  estadoBusca.bairros = lerLista('bairros');
  estadoBusca.especialidadesIds = lerLista('esp');
  estadoBusca.disponibilidades = lerLista('disp');
  estadoBusca.tiposUnidade = lerLista('tipos');
  estadoBusca.diasTurnos = lerLista('turnos');
  estadoBusca.convenios = lerLista('conv');
  estadoBusca.acessibilidades = lerLista('acess');
  estadoBusca.confiabilidades = lerLista('conf');

  marcarCheckboxesPeloEstado();
}

function salvarEstadoNaUrlESessao() {
  const params = new URLSearchParams();
  if (estadoBusca.termo.trim()) params.set('q', estadoBusca.termo.trim());
  if (estadoBusca.modo !== 'todos') params.set('modo', estadoBusca.modo);
  if (estadoBusca.ordenacao !== 'relevancia') params.set('ord', estadoBusca.ordenacao);

  const gravarLista = (paramName, arr) => {
    if (Array.isArray(arr) && arr.length > 0) params.set(paramName, arr.join(','));
  };

  gravarLista('redes', estadoBusca.redes);
  gravarLista('bairros', estadoBusca.bairros);
  gravarLista('esp', estadoBusca.especialidadesIds);
  gravarLista('disp', estadoBusca.disponibilidades);
  gravarLista('tipos', estadoBusca.tiposUnidade);
  gravarLista('turnos', estadoBusca.diasTurnos);
  gravarLista('conv', estadoBusca.convenios);
  gravarLista('acess', estadoBusca.acessibilidades);
  gravarLista('conf', estadoBusca.confiabilidades);

  const queryStr = params.toString();
  const novaUrl = queryStr ? `${window.location.pathname}?${queryStr}` : window.location.pathname;
  window.history.replaceState({}, '', novaUrl);

  try {
    sessionStorage.setItem(NAV_STATE_KEY, JSON.stringify(estadoBusca));
  } catch (e) {
    console.warn('Falha ao salvar estado de navegação em sessionStorage:', e);
  }
}

function configurarEventosBuscaEFiltros() {
  const form = document.getElementById('form-pagina-busca');
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    estadoBusca.termo = document.getElementById('busca-termo')?.value || '';
    estadoBusca.modo = document.getElementById('busca-modo')?.value || 'todos';
    estadoBusca.limitePaginacao = ITENS_POR_PAGINA;
    executarConsultaEAtualizarTela();
  });

  document.getElementById('busca-modo')?.addEventListener('change', (e) => {
    estadoBusca.modo = e.target.value;
    estadoBusca.limitePaginacao = ITENS_POR_PAGINA;
    executarConsultaEAtualizarTela();
  });

  document.getElementById('select-ordenacao')?.addEventListener('change', (e) => {
    estadoBusca.ordenacao = e.target.value;
    executarConsultaEAtualizarTela();
  });

  document.getElementById('select-distancia-max')?.addEventListener('change', (e) => {
    estadoBusca.distanciaMaxKm = e.target.value;
    estadoBusca.limitePaginacao = ITENS_POR_PAGINA;
    executarConsultaEAtualizarTela();
  });

  // Referência geográfica opcional para o Filtro 3 (Distância) — RF-007
  document.getElementById('select-ponto-referencia')?.addEventListener('change', (e) => {
    const chave = e.target.value;
    if (!chave) {
      estadoBusca.coordReferencia = null;
      estadoBusca.rotuloReferencia = '';
      estadoBusca.distanciaMaxKm = '';
    } else if (PONTOS_REFERENCIA_BELEM[chave]) {
      estadoBusca.coordReferencia = {
        lat: PONTOS_REFERENCIA_BELEM[chave].lat,
        lng: PONTOS_REFERENCIA_BELEM[chave].lng
      };
      estadoBusca.rotuloReferencia = PONTOS_REFERENCIA_BELEM[chave].rotulo;
    }
    marcarCheckboxesPeloEstado();
    executarConsultaEAtualizarTela();
  });

  document.getElementById('btn-usar-geolocalizacao')?.addEventListener('click', () => {
    if (!navigator.geolocation) {
      alert('Geolocalização não suportada neste navegador. Utilize um ponto de referência ilustrativo de Belém.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        estadoBusca.coordReferencia = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        };
        estadoBusca.rotuloReferencia = 'Sua localização atual (Consentida — não persistida)';
        marcarCheckboxesPeloEstado();
        executarConsultaEAtualizarTela();
      },
      () => {
        alert('Permissão de localização negada ou indisponível. Você pode escolher um ponto de referência ilustrativo em Belém ao lado.');
      }
    );
  });

  document.getElementById('btn-limpar-tudo')?.addEventListener('click', limparTodosOsFiltros);
  document.getElementById('btn-limpar-busca')?.addEventListener('click', limparTodosOsFiltros);

  // Botão "Pesquisar nesta área" do Mapa (RF-015 / CA-402)
  document.getElementById('btn-pesquisar-nesta-area')?.addEventListener('click', () => {
    aplicarPesquisaNestaArea();
  });

  // Alternância Mobile Lista | Mapa (Cap. 4.1 / CA-404 / T-07)
  document.getElementById('btn-view-lista')?.addEventListener('click', () => aplicarVisaoMobile('lista'));
  document.getElementById('btn-view-mapa')?.addEventListener('click', () => aplicarVisaoMobile('mapa'));

  // Paginação "Carregar mais" (RF-016)
  document.getElementById('btn-carregar-mais')?.addEventListener('click', () => {
    estadoBusca.limitePaginacao += ITENS_POR_PAGINA;
    renderizarResultadosPaginados();
  });
}

function aplicarVisaoMobile(visao) {
  estadoBusca.visaoMobile = visao === 'mapa' ? 'mapa' : 'lista';
  const layout = document.getElementById('layout-resultados-mapa');
  const btnLista = document.getElementById('btn-view-lista');
  const btnMapa = document.getElementById('btn-view-mapa');

  if (layout) layout.setAttribute('data-mobile-view', estadoBusca.visaoMobile);
  if (btnLista) btnLista.setAttribute('aria-pressed', String(estadoBusca.visaoMobile === 'lista'));
  if (btnMapa) btnMapa.setAttribute('aria-pressed', String(estadoBusca.visaoMobile === 'mapa'));
}

function aplicarPesquisaNestaArea() {
  if (!adaptadorMapa) return;
  estadoBusca.limitesMapa = adaptadorMapa.obterLimitesVisiveis();
  estadoBusca.limitePaginacao = ITENS_POR_PAGINA;
  adaptadorMapa.ocultarBotaoPesquisarArea();
  executarConsultaEAtualizarTela();
}

function atualizarStatusReferenciaDistancia() {
  const msgEl = document.getElementById('status-referencia-distancia');
  if (!msgEl) return;
  if (estadoBusca.coordReferencia) {
    msgEl.textContent = `Referência ativa: ${estadoBusca.rotuloReferencia}. Filtro de distância habilitado.`;
  } else {
    msgEl.textContent = 'Sem ponto de referência ativo: escolha um ponto em Belém ou autorize geolocalização para habilitar o filtro de distância (RF-007).';
  }
}

export function limparTodosOsFiltros() {
  estadoBusca = {
    ...estadoBusca,
    termo: '',
    modo: 'todos',
    redes: [],
    bairros: [],
    distanciaMaxKm: '',
    coordReferencia: null,
    rotuloReferencia: '',
    especialidadesIds: [],
    disponibilidades: [],
    tiposUnidade: [],
    diasTurnos: [],
    convenios: [],
    acessibilidades: [],
    confiabilidades: [],
    limitesMapa: null,
    ordenacao: 'relevancia',
    limitePaginacao: ITENS_POR_PAGINA,
    unidadeSelecionadaId: null
  };

  const selectRef = document.getElementById('select-ponto-referencia');
  if (selectRef) selectRef.value = '';
  const selectRecorte = document.getElementById('select-recorte-mapa');
  if (selectRecorte) selectRecorte.value = 'TODAS';

  adaptadorMapa?.ocultarBotaoPesquisarArea();
  marcarCheckboxesPeloEstado();
  executarConsultaEAtualizarTela();
}

function executarConsultaEAtualizarTela(primeiraCarga = false) {
  salvarEstadoNaUrlESessao();

  const resposta = pesquisarUnidades(estadoBusca);
  ultimosResultados = resposta.unidades;

  renderizarChipsFiltrosAtivos();
  renderizarBannerCondicaoOrientativa(resposta);
  renderizarResultadosPaginados();

  if (primeiraCarga) {
    adaptadorMapa?.inicializar(ultimosResultados);
  } else {
    adaptadorMapa?.atualizarMarcadores(ultimosResultados);
  }
}

/**
 * Renderiza os chips de filtros ativos com remoção individual (RF-007)
 */
function renderizarChipsFiltrosAtivos() {
  const container = document.getElementById('barra-filtros-ativos');
  if (!container) return;
  container.innerHTML = '';

  const chips = [];
  const opcoes = listarOpcoesFiltros();

  if (estadoBusca.termo.trim()) {
    chips.push({
      rotulo: `Termo: "${estadoBusca.termo.trim()}" (${estadoBusca.modo})`,
      remover: () => {
        estadoBusca.termo = '';
        marcarCheckboxesPeloEstado();
      }
    });
  }

  const adicionarChipsGrupo = (chave, prefixo, formatador = (v) => v) => {
    (estadoBusca[chave] || []).forEach((valor) => {
      chips.push({
        rotulo: `${prefixo}: ${formatador(valor)}`,
        remover: () => {
          estadoBusca[chave] = estadoBusca[chave].filter((item) => item !== valor);
          marcarCheckboxesPeloEstado();
        }
      });
    });
  };

  adicionarChipsGrupo('redes', 'Rede');
  adicionarChipsGrupo('bairros', 'Bairro');
  adicionarChipsGrupo('especialidadesIds', 'Especialidade', (id) => {
    const esp = opcoes.especialidades.find((e) => e.id === id);
    return esp ? esp.nome : id;
  });
  adicionarChipsGrupo('disponibilidades', 'Disponibilidade');
  adicionarChipsGrupo('tiposUnidade', 'Tipo');
  adicionarChipsGrupo('diasTurnos', 'Horário/Dia');
  adicionarChipsGrupo('convenios', 'Convênio');
  adicionarChipsGrupo('acessibilidades', 'Acessibilidade');
  adicionarChipsGrupo('confiabilidades', 'Confiabilidade');

  if (estadoBusca.distanciaMaxKm && estadoBusca.coordReferencia) {
    chips.push({
      rotulo: `Distância: até ${estadoBusca.distanciaMaxKm} km`,
      remover: () => {
        estadoBusca.distanciaMaxKm = '';
        marcarCheckboxesPeloEstado();
      }
    });
  }

  if (estadoBusca.limitesMapa) {
    chips.push({
      rotulo: 'Área recortada no mapa',
      remover: () => {
        estadoBusca.limitesMapa = null;
        const selectRecorte = document.getElementById('select-recorte-mapa');
        if (selectRecorte) selectRecorte.value = 'TODAS';
      }
    });
  }

  if (chips.length === 0) {
    const vazio = document.createElement('span');
    vazio.className = 'form-hint';
    vazio.textContent = 'Nenhum filtro restritivo ativo (exibindo catálogo completo).';
    container.appendChild(vazio);
    return;
  }

  chips.forEach((chip) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'active-filter-chip';
    btn.setAttribute('aria-label', `Remover filtro ${chip.rotulo}`);
    btn.textContent = `${chip.rotulo} ✕`;
    btn.addEventListener('click', () => {
      chip.remover();
      executarConsultaEAtualizarTela();
    });
    container.appendChild(btn);
  });
}

function renderizarBannerCondicaoOrientativa(resposta) {
  const box = document.getElementById('aviso-orientacao-condicao');
  if (!box) return;

  if (resposta.especialidadesOrientadas.length > 0 && resposta.termoOriginal) {
    box.hidden = false;
    box.innerHTML = '';
    const strong = document.createElement('strong');
    strong.textContent = 'Orientação Editorial (Não constitui diagnóstico clínico): ';
    box.appendChild(strong);

    const span = document.createElement('span');
    const nomes = resposta.especialidadesOrientadas.map((e) => e.nome).join(', ');
    span.textContent = `Para o termo "${resposta.termoOriginal}", listamos unidades associadas a: ${nomes}. Sempre consulte um profissional de saúde.`;
    box.appendChild(span);
  } else {
    box.hidden = true;
  }
}

function renderizarResultadosPaginados() {
  const container = document.getElementById('contentor-resultados-busca');
  const contadorEl = document.getElementById('contador-resultados');
  const paginacaoBox = document.getElementById('box-paginacao');
  const statusPaginacao = document.getElementById('status-paginacao');
  const btnCarregarMais = document.getElementById('btn-carregar-mais');

  if (!container) return;
  container.innerHTML = '';

  const total = ultimosResultados.length;
  const visiveis = ultimosResultados.slice(0, estadoBusca.limitePaginacao);

  if (contadorEl) {
    contadorEl.textContent = `Exibindo ${visiveis.length} de ${total} ${total === 1 ? 'unidade fictícia encontrada' : 'unidades fictícias encontradas'}.`;
  }

  // Estado vazio acessível com filtros ativos e botão de limpar (RF-009 / CA-303 / T-05)
  if (total === 0) {
    if (paginacaoBox) paginacaoBox.hidden = true;

    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.setAttribute('role', 'status');

    const h3 = document.createElement('h3');
    h3.textContent = 'Nenhum estabelecimento fictício corresponde aos filtros selecionados';
    empty.appendChild(h3);

    const p = document.createElement('p');
    p.textContent = 'Experimente remover alguns filtros individuais acima ou clique no botão abaixo para restaurar a pesquisa.';
    empty.appendChild(p);

    const btnReset = document.createElement('button');
    btnReset.type = 'button';
    btnReset.className = 'btn btn--primary';
    btnReset.textContent = 'Limpar todos os filtros';
    btnReset.addEventListener('click', limparTodosOsFiltros);
    empty.appendChild(btnReset);

    container.appendChild(empty);
    return;
  }

  const lista = document.createElement('div');
  lista.className = 'results-stack';

  visiveis.forEach((unidade) => {
    const card = criarCartaoCompletoUnidade(unidade);
    lista.appendChild(card);
  });

  container.appendChild(lista);

  // Controle de paginação (RF-016)
  if (paginacaoBox && statusPaginacao && btnCarregarMais) {
    paginacaoBox.hidden = false;
    if (visiveis.length < total) {
      statusPaginacao.textContent = `Mostrando ${visiveis.length} de ${total} unidades.`;
      btnCarregarMais.hidden = false;
    } else {
      statusPaginacao.textContent = `Fim da lista (${total} de ${total} unidades carregadas).`;
      btnCarregarMais.hidden = true;
    }
  }
}

/**
 * Cartão completo conforme RF-011 e RN-004 (disponibilidade separada da confiabilidade)
 */
function criarCartaoCompletoUnidade(unidade) {
  const artigo = document.createElement('article');
  artigo.className = 'unit-card';
  artigo.id = `card-unidade-${unidade.id}`;
  artigo.setAttribute('data-unit-id', unidade.id);
  if (unidade.id === estadoBusca.unidadeSelecionadaId) {
    artigo.classList.add('unit-card--selected');
  }

  // Topo: Selo Demo + Selo Confiabilidade
  const topo = document.createElement('div');
  topo.className = 'unit-card__top';

  const badgeDemo = document.createElement('span');
  badgeDemo.className = 'demo-badge';
  badgeDemo.textContent = 'UNIDADE FICTÍCIA — DEMONSTRAÇÃO';
  topo.appendChild(badgeDemo);

  const badgeConf = document.createElement('span');
  badgeConf.className = `status-pill status-pill--${unidade.metaConfiabilidadeUnidade.classe}`;
  badgeConf.textContent = `${unidade.metaConfiabilidadeUnidade.icone} Fonte/Confiabilidade: ${unidade.metaConfiabilidadeUnidade.rotulo}`;
  topo.appendChild(badgeConf);

  artigo.appendChild(topo);

  // Cabeçalho do Cartão
  const h3 = document.createElement('h3');
  h3.className = 'unit-card__title';
  h3.textContent = `${unidade.nome} (${unidade.tipo})`;
  artigo.appendChild(h3);

  // Endereço, Bairro e Distância (quando ativa)
  const pLoc = document.createElement('p');
  pLoc.className = 'unit-card__meta';
  const strDist = typeof unidade.distanciaKm === 'number' ? ` • 📏 ~${unidade.distanciaKm} km da referência` : '';
  const strCoord =
    typeof unidade.latitude !== 'number' ? ' • ⚠ Coordenadas não informadas (apenas na lista)' : '';
  pLoc.textContent = `📍 Bairro: ${unidade.bairro} (${unidade.regiao}) — ${unidade.enderecoDemonstrativo}${strDist}${strCoord}`;
  artigo.appendChild(pLoc);

  // Horários, Modalidades, Convênios e Acessibilidade
  const pInfo = document.createElement('p');
  pInfo.className = 'unit-card__meta';
  const convTexto =
    unidade.conveniosAceitos && unidade.conveniosAceitos.length > 0
      ? ` | Convênios demo: ${unidade.conveniosAceitos.join(', ')}`
      : '';
  pInfo.textContent = `🕒 ${unidade.horarioGeral} | Modalidades: ${unidade.modalidades.join(', ')}${convTexto}`;
  artigo.appendChild(pInfo);

  const pAcess = document.createElement('p');
  pAcess.className = 'unit-card__meta';
  pAcess.textContent = `♿ Acessibilidade informada: ${(unidade.acessibilidade || []).join(', ') || 'Não informado'}`;
  artigo.appendChild(pAcess);

  // Especialidades, Serviços, Requisitos Resumidos e Estados de Disponibilidade Datados (RF-011)
  const secSrv = document.createElement('div');
  secSrv.className = 'unit-card__services';

  const h4Srv = document.createElement('h4');
  h4Srv.textContent = 'Especialidades, Serviços, Requisitos e Disponibilidade Informada:';
  secSrv.appendChild(h4Srv);

  const ul = document.createElement('ul');
  ul.className = 'service-list';

  unidade.servicos.forEach((srv) => {
    const li = document.createElement('li');
    li.className = 'service-list__item';

    const linhaTitulo = document.createElement('div');
    const strong = document.createElement('strong');
    strong.textContent = `${srv.nome} `;
    const spanEsp = document.createElement('span');
    spanEsp.className = 'form-hint';
    spanEsp.textContent = `[Especialidade: ${srv.especialidadeNome} • Horário: ${srv.horarios}]`;
    linhaTitulo.appendChild(strong);
    linhaTitulo.appendChild(spanEsp);
    li.appendChild(linhaTitulo);

    const reqResumo = document.createElement('div');
    reqResumo.className = 'form-hint';
    reqResumo.textContent = `📋 Requisitos resumidos: ${srv.requisitos}`;
    li.appendChild(reqResumo);

    const badges = document.createElement('div');
    badges.className = 'service-list__badges';

    srv.disponibilidades.forEach((d) => {
      const pill = document.createElement('span');
      pill.className = `status-pill status-pill--${d.metaEstado.classe}`;
      const dataFmt = d.informadoEm ? d.informadoEm.slice(0, 10).split('-').reverse().join('/') : 'S/D';
      pill.textContent = `${d.metaEstado.icone} ${d.modalidade}: ${d.metaEstado.rotulo} (Inf.: ${dataFmt})`;
      badges.appendChild(pill);
    });

    li.appendChild(badges);
    ul.appendChild(li);
  });

  secSrv.appendChild(ul);
  artigo.appendChild(secSrv);

  // Rodapé do Cartão: Fonte, Contato e Botões (Sincronizar com Mapa + Abrir Detalhes)
  const footer = document.createElement('div');
  footer.className = 'unit-card__footer';

  const small = document.createElement('small');
  small.textContent = `Fonte: ${unidade.fonte} • Contato demonstrativo: ${unidade.contatoDemonstrativo}`;
  footer.appendChild(small);

  const acoes = document.createElement('div');
  acoes.style.display = 'flex';
  acoes.style.gap = 'var(--space-2)';
  acoes.style.flexWrap = 'wrap';

  if (typeof unidade.latitude === 'number' && typeof unidade.longitude === 'number') {
    const btnMapa = document.createElement('button');
    btnMapa.type = 'button';
    btnMapa.className = 'btn-a11y';
    btnMapa.textContent = '📍 Destacar no mapa';
    btnMapa.addEventListener('click', () => {
      selecionarUnidadeNaInterface(unidade.id, true);
    });
    acoes.appendChild(btnMapa);
  }

  const linkDetalhes = document.createElement('a');
  linkDetalhes.href = `unidade.html?id=${encodeURIComponent(unidade.id)}`;
  linkDetalhes.className = 'btn btn--primary';
  linkDetalhes.textContent = 'Ver ficha completa';
  linkDetalhes.addEventListener('click', () => {
    estadoBusca.unidadeSelecionadaId = unidade.id;
    salvarEstadoNaUrlESessao();
  });
  acoes.appendChild(linkDetalhes);

  footer.appendChild(acoes);
  artigo.appendChild(footer);

  return artigo;
}

/**
 * Sincroniza seleção entre cartão da lista e marcador do mapa (RF-013 e RF-014)
 */
function selecionarUnidadeNaInterface(unidadeId, veioDaLista = true) {
  estadoBusca.unidadeSelecionadaId = unidadeId;
  salvarEstadoNaUrlESessao();

  // Caso a unidade selecionada no mapa esteja além da página visível, expande a paginação
  const idx = ultimosResultados.findIndex((u) => u.id === unidadeId);
  if (idx >= estadoBusca.limitePaginacao) {
    estadoBusca.limitePaginacao = idx + 1;
    renderizarResultadosPaginados();
  }

  document.querySelectorAll('.unit-card').forEach((card) => {
    const ativo = card.getAttribute('data-unit-id') === unidadeId;
    card.classList.toggle('unit-card--selected', ativo);
    if (ativo && !veioDaLista) {
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  });

  const unidadeObj = ultimosResultados.find((u) => u.id === unidadeId) || null;
  adaptadorMapa?.destacarUnidade(unidadeId, unidadeObj, veioDaLista);
}
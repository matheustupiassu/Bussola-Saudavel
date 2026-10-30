// js/funcionalidades/home-pesquisa.js
import {
  listarEspecialidades,
  listarBairrosDistintos,
  pesquisarUnidades,
  obterAvisoArmazenamento,
  restaurarDemonstracao
} from '../repositorios/repositorio-local.js';

/**
 * Inicializa a experiência de pesquisa direta e guiada na Home (Cap. 3.1–3.6 e Cap. 12.3)
 */
export function inicializarHomePesquisa() {
  exibirAvisoArmazenamentoSeNecessario();
  renderizarAtalhosGuiadosHome();
  configurarFormularioPesquisaHome();
  executarPreviaResultadosHome({ termo: '', modo: 'todos', rede: 'TODAS' });
}

/**
 * Inicializa a receção dos parâmetros de URL na página de busca (paginas/busca.html)
 */
export function inicializarPaginaBuscaBase() {
  exibirAvisoArmazenamentoSeNecessario();
  const params = new URLSearchParams(window.location.search);
  const termo = params.get('q') || '';
  const modo = params.get('modo') || 'todos';
  const rede = params.get('rede') || 'TODAS';

  const inputTermo = document.getElementById('busca-termo');
  const selectModo = document.getElementById('busca-modo');
  const selectRede = document.getElementById('busca-rede');

  if (inputTermo) inputTermo.value = termo;
  if (selectModo) selectModo.value = modo;
  if (selectRede) selectRede.value = rede;

  const form = document.getElementById('form-pagina-busca');
  form?.addEventListener('submit', (e) => {
    e.preventDefault();
    atualizarBuscaNaPagina();
  });

  document.getElementById('btn-limpar-busca')?.addEventListener('click', () => {
    if (inputTermo) inputTermo.value = '';
    if (selectModo) selectModo.value = 'todos';
    if (selectRede) selectRede.value = 'TODAS';
    window.history.replaceState({}, '', window.location.pathname);
    atualizarBuscaNaPagina();
  });

  atualizarBuscaNaPagina();
}

function atualizarBuscaNaPagina() {
  const termo = document.getElementById('busca-termo')?.value || '';
  const modo = document.getElementById('busca-modo')?.value || 'todos';
  const rede = document.getElementById('busca-rede')?.value || 'TODAS';

  // Preserva consulta na URL (RF-006)
  const params = new URLSearchParams();
  if (termo.trim()) params.set('q', termo.trim());
  if (modo && modo !== 'todos') params.set('modo', modo);
  if (rede && rede !== 'TODAS') params.set('rede', rede);
  const novaUrl = params.toString() ? `${window.location.pathname}?${params.toString()}` : window.location.pathname;
  window.history.replaceState({}, '', novaUrl);

  const resposta = pesquisarUnidades({ termo, modo, rede });
  renderizarListaUnidades(resposta, 'contentor-resultados-busca', true);
}

function exibirAvisoArmazenamentoSeNecessario() {
  const aviso = obterAvisoArmazenamento();
  const container = document.getElementById('aviso-armazenamento');
  if (aviso && container) {
    container.hidden = false;
    container.textContent = aviso;
  }
}

function configurarFormularioPesquisaHome() {
  const form = document.getElementById('form-pesquisa-home');
  const inputTermo = document.getElementById('home-input-termo');
  const selectModo = document.getElementById('home-select-modo');
  const selectRede = document.getElementById('home-select-rede');
  const btnVerNaBusca = document.getElementById('btn-abrir-pagina-busca');
  const btnLimpar = document.getElementById('btn-home-limpar');
  const btnRestaurar = document.getElementById('btn-home-restaurar');

  if (!form) return;

  const atualizarPrevia = () => {
    const termo = inputTermo ? inputTermo.value : '';
    const modo = selectModo ? selectModo.value : 'todos';
    const rede = selectRede ? selectRede.value : 'TODAS';
    executarPreviaResultadosHome({ termo, modo, rede });
  };

  form.addEventListener('submit', (evento) => {
    evento.preventDefault();
    atualizarPrevia();
    document.getElementById('sec-previa-resultados')?.scrollIntoView({ behavior: 'smooth' });
  });

  selectModo?.addEventListener('change', atualizarPrevia);
  selectRede?.addEventListener('change', atualizarPrevia);

  btnLimpar?.addEventListener('click', () => {
    if (inputTermo) inputTermo.value = '';
    if (selectModo) selectModo.value = 'todos';
    if (selectRede) selectRede.value = 'TODAS';
    atualizarPrevia();
    inputTermo?.focus();
  });

  btnVerNaBusca?.addEventListener('click', () => {
    const params = new URLSearchParams();
    if (inputTermo?.value.trim()) params.set('q', inputTermo.value.trim());
    if (selectModo?.value && selectModo.value !== 'todos') params.set('modo', selectModo.value);
    if (selectRede?.value && selectRede.value !== 'TODAS') params.set('rede', selectRede.value);
    const query = params.toString();
    window.location.href = query ? `paginas/busca.html?${query}` : 'paginas/busca.html';
  });

  btnRestaurar?.addEventListener('click', () => {
    const confirmar = window.confirm('Deseja restaurar os dados demonstrativos originais (10 unidades seed)?');
    if (confirmar) {
      restaurarDemonstracao();
      atualizarPrevia();
    }
  });
}

/**
 * Renderiza os cartões e pílulas de Pesquisa Guiada na Home (RF-006 / Cap. 12.3)
 */
function renderizarAtalhosGuiadosHome() {
  const contEspecialidades = document.getElementById('guiada-especialidades');
  const contCondicoes = document.getElementById('guiada-condicoes');
  const contBairros = document.getElementById('guiada-bairros');

  const aplicarAtalho = (termo, modo) => {
    const inputTermo = document.getElementById('home-input-termo');
    const selectModo = document.getElementById('home-select-modo');
    if (inputTermo) inputTermo.value = termo;
    if (selectModo) selectModo.value = modo;
    executarPreviaResultadosHome({
      termo,
      modo,
      rede: document.getElementById('home-select-rede')?.value || 'TODAS'
    });
    document.getElementById('sec-previa-resultados')?.scrollIntoView({ behavior: 'smooth' });
  };

  if (contEspecialidades) {
    contEspecialidades.innerHTML = '';
    listarEspecialidades().forEach((esp) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chip-guiado';
      btn.textContent = esp.nome;
      btn.addEventListener('click', () => aplicarAtalho(esp.nome, 'especialidade'));
      contEspecialidades.appendChild(btn);
    });
  }

  if (contCondicoes) {
    contCondicoes.innerHTML = '';
    const exemplosCondicoes = [
      { rotulo: 'Pressão alta / Hipertensão', termo: 'pressao alta' },
      { rotulo: 'Febre ou mal-estar geral', termo: 'febre' },
      { rotulo: 'Gravidez / Pré-natal', termo: 'gravidez' },
      { rotulo: 'Mancha ou alergia na pele', termo: 'mancha na pele' },
      { rotulo: 'Dor nas costas / Articulações', termo: 'dor nas costas' },
      { rotulo: 'Visão turva / Exame de vista', termo: 'visao turva' },
      { rotulo: 'Dor de dente / Saúde oral', termo: 'dor de dente' }
    ];
    exemplosCondicoes.forEach((item) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chip-guiado chip-guiado--orientativo';
      btn.textContent = item.rotulo;
      btn.addEventListener('click', () => aplicarAtalho(item.termo, 'condicao'));
      contCondicoes.appendChild(btn);
    });
  }

  if (contBairros) {
    contBairros.innerHTML = '';
    listarBairrosDistintos().forEach((bairro) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'chip-guiado';
      btn.textContent = bairro;
      btn.addEventListener('click', () => aplicarAtalho(bairro, 'bairro'));
      contBairros.appendChild(btn);
    });
  }
}

function executarPreviaResultadosHome(criterios) {
  const resposta = pesquisarUnidades(criterios);
  renderizarListaUnidades(resposta, 'home-resultados-container', false);
}

/**
 * Renderiza os cartões de unidades de forma segura (RT-003) e separa Disponibilidade de Confiabilidade (RN-004)
 */
function renderizarListaUnidades(resposta, containerId, emSubpasta) {
  const container = document.getElementById(containerId);
  const contadorEl = document.getElementById('contador-resultados');
  const boxOrientacaoCondicao = document.getElementById('aviso-orientacao-condicao');

  if (!container) return;
  container.innerHTML = '';

  // Se houve mapeamento orientativo por condição/doença, exibe aviso clínico obrigatório (RF-002 / Cap. 1.7)
  if (boxOrientacaoCondicao) {
    if (resposta.especialidadesOrientadas.length > 0 && resposta.termoOriginal) {
      boxOrientacaoCondicao.hidden = false;
      boxOrientacaoCondicao.innerHTML = '';

      const titulo = document.createElement('strong');
      titulo.textContent = 'Orientação Editorial (Isto não é um diagnóstico médico): ';
      boxOrientacaoCondicao.appendChild(titulo);

      const nomesEsp = resposta.especialidadesOrientadas.map((e) => e.nome).join(', ');
      const texto = document.createElement('span');
      texto.textContent = `Para a pesquisa "${resposta.termoOriginal}", apresentamos unidades que contam com: ${nomesEsp}. Avaliações de sintomas devem ser feitas presencialmente por um profissional de saúde.`;
      boxOrientacaoCondicao.appendChild(texto);
    } else {
      boxOrientacaoCondicao.hidden = true;
    }
  }

  if (contadorEl) {
    const sufixoTermo = resposta.termoOriginal ? ` para "${resposta.termoOriginal}"` : '';
    const sufixoRede = resposta.redeAplicada !== 'TODAS' ? ` na rede ${resposta.redeAplicada}` : '';
    contadorEl.textContent = `${resposta.total} ${resposta.total === 1 ? 'unidade fictícia encontrada' : 'unidades fictícias encontradas'}${sufixoTermo}${sufixoRede}.`;
  }

  // Estado vazio acessível (RF-009 / CA-303 / T-05)
  if (resposta.unidades.length === 0) {
    const emptyBox = document.createElement('div');
    emptyBox.className = 'empty-state';
    emptyBox.setAttribute('role', 'status');

    const h3 = document.createElement('h3');
    h3.textContent = 'Nenhuma unidade fictícia encontrada para estes critérios';
    emptyBox.appendChild(h3);

    const p = document.createElement('p');
    p.textContent = 'Verifique a grafia do termo pesquisado, altere o modo de pesquisa para "Todos os campos" ou limpe os filtros ativos.';
    emptyBox.appendChild(p);

    const sugestoes = document.createElement('p');
    sugestoes.innerHTML = '<strong>Sugestões de teste:</strong> experimente pesquisar por <em>Cardiologia</em>, <em>Pediatria</em>, <em>Pressão alta</em>, <em>Marco</em> ou <em>UPA</em>.';
    emptyBox.appendChild(sugestoes);

    container.appendChild(emptyBox);
    return;
  }

  const grid = document.createElement('div');
  grid.className = 'grid-unidades';

  resposta.unidades.forEach((unidade) => {
    const artigo = document.createElement('article');
    artigo.className = 'unit-card';
    artigo.setAttribute('aria-labelledby', `unit-title-${unidade.id}`);

    // Topo: Selo de Demonstração + Selo de Confiabilidade da Fonte (RN-001 / RN-004)
    const topo = document.createElement('div');
    topo.className = 'unit-card__top';

    const badgeDemo = document.createElement('span');
    badgeDemo.className = 'demo-badge';
    badgeDemo.textContent = 'UNIDADE FICTÍCIA — DEMONSTRAÇÃO';
    topo.appendChild(badgeDemo);

    const badgeConf = document.createElement('span');
    badgeConf.className = `status-pill status-pill--${unidade.metaConfiabilidadeUnidade.classe}`;
    badgeConf.textContent = `${unidade.metaConfiabilidadeUnidade.icone} Confiabilidade: ${unidade.metaConfiabilidadeUnidade.rotulo}`;
    topo.appendChild(badgeConf);

    artigo.appendChild(topo);

    // Título e Tipo
    const h3 = document.createElement('h3');
    h3.id = `unit-title-${unidade.id}`;
    h3.className = 'unit-card__title';
    h3.textContent = `${unidade.nome} (${unidade.tipo})`;
    artigo.appendChild(h3);

    // Localização e Modalidades
    const metaLoc = document.createElement('p');
    metaLoc.className = 'unit-card__meta';
    metaLoc.textContent = `📍 Bairro: ${unidade.bairro} (${unidade.cidade}/${unidade.uf}) • Endereço ilustrativo: ${unidade.enderecoDemonstrativo}`;
    artigo.appendChild(metaLoc);

    const metaRede = document.createElement('p');
    metaRede.className = 'unit-card__meta';
    metaRede.innerHTML = `<strong>Modalidades atendidas:</strong> ${unidade.modalidades.join(', ')} | <strong>Horário:</strong> ${unidade.horarioGeral}`;
    artigo.appendChild(metaRede);

    // Lista de Serviços e Estados de Disponibilidade por Modalidade (RN-002, RN-004)
    const secServicos = document.createElement('div');
    secServicos.className = 'unit-card__services';

    const tituloServicos = document.createElement('h4');
    tituloServicos.textContent = 'Serviços e Disponibilidade Informada (Sem garantia de vaga):';
    secServicos.appendChild(tituloServicos);

    const ulServicos = document.createElement('ul');
    ulServicos.className = 'service-list';

    unidade.servicos.forEach((servico) => {
      const li = document.createElement('li');
      li.className = 'service-list__item';

      const nomeSrv = document.createElement('div');
      nomeSrv.innerHTML = `<strong>${servico.nome}</strong> <span class="text-muted">(${servico.especialidadeNome})</span>`;
      li.appendChild(nomeSrv);

      const dispWrapper = document.createElement('div');
      dispWrapper.className = 'service-list__badges';

      servico.disponibilidades.forEach((disp) => {
        const pillDisp = document.createElement('span');
        pillDisp.className = `status-pill status-pill--${disp.metaEstado.classe}`;
        const dataCurta = disp.informadoEm ? disp.informadoEm.slice(0, 10).split('-').reverse().join('/') : 'S/D';
        pillDisp.textContent = `${disp.metaEstado.icone} [${disp.modalidade}] ${disp.metaEstado.rotulo} (Inf.: ${dataCurta})`;
        dispWrapper.appendChild(pillDisp);
      });

      li.appendChild(dispWrapper);
      ulServicos.appendChild(li);
    });

    secServicos.appendChild(ulServicos);
    artigo.appendChild(secServicos);

    // Rodapé do Cartão: Fonte, Contato Demonstrativo e Link para Detalhes
    const rodapeCard = document.createElement('div');
    rodapeCard.className = 'unit-card__footer';

    const infoFonte = document.createElement('small');
    infoFonte.textContent = `Fonte declarada: ${unidade.fonte} • Contato demo: ${unidade.contatoDemonstrativo}`;
    rodapeCard.appendChild(infoFonte);

    const linkDetalhes = document.createElement('a');
    const prefixo = emSubpasta ? 'unidade.html' : 'paginas/unidade.html';
    linkDetalhes.href = `${prefixo}?id=${encodeURIComponent(unidade.id)}`;
    linkDetalhes.className = 'btn btn--secondary';
    linkDetalhes.textContent = 'Ver detalhes e requisitos';
    rodapeCard.appendChild(linkDetalhes);

    artigo.appendChild(rodapeCard);
    grid.appendChild(artigo);
  });

  container.appendChild(grid);
}
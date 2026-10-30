// js/funcionalidades/detalhes-unidade.js
import {
  obterEstadoRepositorio,
  listarUnidadesCompletas,
  persistirEstadoRepositorio
} from '../repositorios/repositorio-local.js';

let unidadeAtual = null;

export function inicializarPaginaDetalhesUnidade() {
  const params = new URLSearchParams(window.location.search);
  const unidadeId = params.get('id');

  if (!unidadeId) {
    renderizarErroUnidadeNaoEncontrada('Nenhum identificador de unidade foi fornecido na URL.');
    return;
  }

  const unidades = listarUnidadesCompletas();
  unidadeAtual = unidades.find((u) => u.id === unidadeId) || null;

  if (!unidadeAtual) {
    renderizarErroUnidadeNaoEncontrada(`A unidade com identificador "${unidadeId}" não foi encontrada no repositório de demonstração.`);
    return;
  }

  document.title = `${unidadeAtual.nome} (${unidadeAtual.tipo}) — Detalhes (Demo) • Bússola Saudável`;
  renderizarCabecalhoDetalhes(unidadeAtual);
  renderizarAbasEConteudo(unidadeAtual);
  configurarDezAcoesObrigatorias(unidadeAtual);
}

function renderizarErroUnidadeNaoEncontrada(mensagem) {
  const container = document.getElementById('detalhes-conteudo-principal');
  if (!container) return;
  container.innerHTML = `
    <div class="empty-state" role="status">
      <h3>Unidade Fictícia não encontrada</h3>
      <p>${mensagem}</p>
      <a href="busca.html" class="btn btn--primary" style="margin-top: var(--space-3);">Voltar para a Busca</a>
    </div>
  `;
}

function renderizarCabecalhoDetalhes(u) {
  const topoEl = document.getElementById('detalhes-cabecalho-topo');
  const nomeEl = document.getElementById('detalhes-unidade-nome');
  const metaEl = document.getElementById('detalhes-unidade-meta');

  if (topoEl) {
    topoEl.innerHTML = `
      <span class="demo-badge">UNIDADE FICTÍCIA — DEMONSTRAÇÃO</span>
      <span class="status-pill status-pill--${u.metaConfiabilidadeUnidade.classe}">
        ${u.metaConfiabilidadeUnidade.icone} Confiabilidade da Fonte: ${u.metaConfiabilidadeUnidade.rotulo}
      </span>
    `;
  }

  if (nomeEl) {
    nomeEl.textContent = `${u.nome} (${u.tipo})`;
  }

  if (metaEl) {
    const dataFmt = u.ultimaAtualizacao ? new Date(u.ultimaAtualizacao).toLocaleString('pt-BR') : 'Não informada';
    metaEl.textContent = `📍 Bairro: ${u.bairro} (${u.regiao} — Belém/PA) • Endereço ilustrativo: ${u.enderecoDemonstrativo} • Última revisão simulada: ${dataFmt}`;
  }
}

function renderizarAbasEConteudo(u) {
  const secoesContainer = document.getElementById('detalhes-secoes-container');
  if (!secoesContainer) return;
  secoesContainer.innerHTML = '';

  // 1. Serviços e Disponibilidade Informada por Modalidade (RF-017 / RN-002)
  const cardServicos = document.createElement('section');
  cardServicos.className = 'card';
  cardServicos.setAttribute('aria-labelledby', 'sec-servicos-titulo');
  cardServicos.innerHTML = `
    <h2 id="sec-servicos-titulo">1. Serviços, Especialidades e Disponibilidade Informada</h2>
    <p class="form-hint">A disponibilidade informada é uma indicação declarada e <strong>não constitui garantia de vaga ou atendimento imediato</strong>.</p>
  `;

  const listaSrv = document.createElement('div');
  listaSrv.className = 'results-stack';

  if (!u.servicos || u.servicos.length === 0) {
    listaSrv.innerHTML = '<p class="form-hint">Nenhum serviço cadastrado para esta unidade.</p>';
  } else {
    u.servicos.forEach((srv) => {
      const itemSrv = document.createElement('div');
      itemSrv.className = 'unit-card';
      itemSrv.style.boxShadow = 'none';

      const h4 = document.createElement('h4');
      h4.textContent = srv.nome;
      itemSrv.appendChild(h4);

      const pEsp = document.createElement('p');
      pEsp.className = 'form-hint';
      pEsp.textContent = `Especialidade: ${srv.especialidadeNome} • Horário específico: ${srv.horarios || 'Não informado'}`;
      itemSrv.appendChild(pEsp);

      const pReq = document.createElement('p');
      pReq.innerHTML = `<strong>Requisitos e Documentos (RF-017):</strong> ${srv.requisitos || 'Não informado'}`;
      itemSrv.appendChild(pReq);

      const divDisp = document.createElement('div');
      divDisp.className = 'service-list__badges';
      divDisp.style.marginTop = 'var(--space-2)';

      if (!srv.disponibilidades || srv.disponibilidades.length === 0) {
        divDisp.innerHTML = '<span class="status-pill status-pill--neutral">? [Geral] Não confirmado</span>';
      } else {
        srv.disponibilidades.forEach((d) => {
          const pill = document.createElement('span');
          pill.className = `status-pill status-pill--${d.metaEstado.classe}`;
          const dataFmt = d.informadoEm ? d.informadoEm.slice(0, 10).split('-').reverse().join('/') : 'S/D';
          pill.textContent = `${d.metaEstado.icone} [${d.modalidade}] ${d.metaEstado.rotulo} (Inf.: ${dataFmt} — Fonte: ${d.fonte})`;
          divDisp.appendChild(pill);
        });
      }

      itemSrv.appendChild(divDisp);
      listaSrv.appendChild(itemSrv);
    });
  }
  cardServicos.appendChild(listaSrv);
  secoesContainer.appendChild(cardServicos);

  // 2. Horários, Modalidades e Convênios
  const cardHorarios = document.createElement('section');
  cardHorarios.className = 'card';
  cardHorarios.setAttribute('aria-labelledby', 'sec-horarios-titulo');
  cardHorarios.innerHTML = `
    <h2 id="sec-horarios-titulo">2. Horários, Modalidades e Convênios</h2>
    <p><strong>Dias e turnos de funcionamento:</strong> ${(u.diasFuncionamento || []).join(', ')} (${(u.turnos || []).join(', ')})</p>
    <p><strong>Horário geral:</strong> ${u.horarioGeral || 'Não informado'}</p>
    <p><strong>Modalidades ativas:</strong> ${u.modalidades.join(', ')}</p>
    <p><strong>Convênios aceitos (se aplicável):</strong> ${u.conveniosAceitos && u.conveniosAceitos.length > 0 ? u.conveniosAceitos.join(', ') : 'Nenhum convênio particular informado (Atendimento exclusivo SUS ou Particular).'}</p>
  `;
  secoesContainer.appendChild(cardHorarios);

  // 3. Acessibilidade e Como Chegar
  const cardAcess = document.createElement('section');
  cardAcess.className = 'card';
  cardAcess.setAttribute('aria-labelledby', 'sec-acess-titulo');
  cardAcess.innerHTML = `
    <h2 id="sec-acess-titulo">3. Acessibilidade e Orientações de Acesso</h2>
    <p><strong>Recursos de acessibilidade informados:</strong> ${(u.acessibilidade || []).join(', ') || 'Nenhum recurso específico informado.'}</p>
    <p><strong>Canal ou procedimento de agendamento:</strong> ${u.canalAgendamentoDemo || 'Não informado'}</p>
    <p><strong>Endereço de referência (Ilustrativo em Belém/PA):</strong> ${u.enderecoDemonstrativo}</p>
    ${typeof u.latitude === 'number' ? `<p class="form-hint">📍 Coordenadas ilustrativas para mapa: Latitude ${u.latitude}, Longitude ${u.longitude}</p>` : '<p class="form-hint">⚠ Unidade sem coordenadas cadastradas (exibida apenas na lista).</p>'}
  `;
  secoesContainer.appendChild(cardAcess);

  // 4. Histórico Público de Alterações (RF-017 / RF-030)
  const cardHistorico = document.createElement('section');
  cardHistorico.className = 'card';
  cardHistorico.setAttribute('aria-labelledby', 'sec-hist-titulo');
  cardHistorico.innerHTML = `
    <h2 id="sec-hist-titulo">4. Histórico Público de Atualizações (Transparência)</h2>
    <p class="form-hint">Registo demonstrativo de alterações e revisões realizadas nesta unidade.</p>
  `;

  const estadoRepo = obterEstadoRepositorio();
  const logsUnidade = (estadoRepo.historicoAuditoria || []).filter((h) => h.entidadeId === u.id);
  const listaLogs = document.createElement('div');
  listaLogs.className = 'results-stack';

  if (logsUnidade.length === 0) {
    // Adiciona log padrão demonstrativo se o histórico estiver vazio
    listaLogs.innerHTML = `
      <div class="service-list__item">
        <strong>Revisão Inicial do Protótipo (Seed v1)</strong>
        <p class="form-hint" style="margin: 2px 0 0;">Instante: ${u.ultimaAtualizacao ? new Date(u.ultimaAtualizacao).toLocaleString('pt-BR') : 'Recente'} • Ator: ${u.fonte}</p>
      </div>
    `;
  } else {
    logsUnidade.forEach((log) => {
      const divLog = document.createElement('div');
      divLog.className = 'service-list__item';
      divLog.innerHTML = `
        <strong>${log.campo} — Modificação em ${new Date(log.instante).toLocaleString('pt-BR')}</strong>
        <p class="form-hint" style="margin: 2px 0 0;">De: "${log.antes}" → Para: "${log.depois}" • Ator: ${log.atorDemo}</p>
      `;
      listaLogs.appendChild(divLog);
    });
  }
  cardHistorico.appendChild(listaLogs);
  secoesContainer.appendChild(cardHistorico);
}

/**
 * Implementa as 10 Ações Obrigatórias da Página de Detalhes (RF-018)
 */
function configurarDezAcoesObrigatorias(u) {
  const estadoRepo = obterEstadoRepositorio();

  // (1) Contatar (Simulado)
  document.getElementById('acao-contatar')?.addEventListener('click', () => {
    alert(`[Ação 1 — Contatar]\n\nContato demonstrativo da unidade ${u.nome}:\n${u.contatoDemonstrativo}\n\nAviso: O número acima é fictício para testes e não realiza chamadas reais.`);
  });

  // (2) Obter Direções (Simulado)
  document.getElementById('acao-direcoes')?.addEventListener('click', () => {
    if (typeof u.latitude === 'number' && typeof u.longitude === 'number') {
      window.open(`https://www.google.com/maps/search/?api=1&query=${u.latitude},${u.longitude}`, '_blank');
    } else {
      alert(`[Ação 2 — Obter Direções]\n\nA unidade "${u.nome}" localiza-se em ${u.bairro}, Belém (PA). Endereço ilustrativo: ${u.enderecoDemonstrativo} (Coordenadas não cadastradas para mapa externo).`);
    }
  });

  // (3) Consultar Agendamento / Link (Simulado)
  document.getElementById('acao-agendamento')?.addEventListener('click', () => {
    alert(`[Ação 3 — Canal de Agendamento]\n\nProcedimento informado pela unidade:\n${u.canalAgendamentoDemo}\n\nAviso: A Bússola Saudável não realiza reservas nem agendamentos diretos.`);
  });

  // (4) Favoritar (Persistido localmente)
  const btnFavoritar = document.getElementById('acao-favoritar');
  const atualizarBotaoFavorito = () => {
    const jaFavorito = estadoRepo.favoritos.some((f) => f.unidadeId === u.id);
    if (btnFavoritar) {
      btnFavoritar.textContent = jaFavorito ? '★ Remover dos Favoritos' : '☆ Favoritar Unidade';
      btnFavoritar.setAttribute('aria-pressed', String(jaFavorito));
    }
  };
  atualizarBotaoFavorito();

  btnFavoritar?.addEventListener('click', () => {
    const idx = estadoRepo.favoritos.findIndex((f) => f.unidadeId === u.id);
    if (idx >= 0) {
      estadoRepo.favoritos.splice(idx, 1);
      alert('Unidade removida dos seus favoritos locais.');
    } else {
      estadoRepo.favoritos.push({ personaId: estadoRepo.personaAtivaId, unidadeId: u.id, criadoEm: new Date().toISOString() });
      alert('Unidade adicionada aos seus favoritos locais com sucesso!');
    }
    persistirEstadoRepositorio(estadoRepo);
    atualizarBotaoFavorito();
  });

  // (5) Compartilhar (Simulado via clipboard)
  document.getElementById('acao-compartilhar')?.addEventListener('click', () => {
    const urlAtual = window.location.href;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(urlAtual).then(() => {
        alert(`[Ação 5 — Compartilhar]\n\nLink da ficha copiado para a área de transferência:\n${urlAtual}`);
      });
    } else {
      prompt('Copie o link abaixo para compartilhar:', urlAtual);
    }
  });

  // (6) Ver Disponibilidade Detalhada
  document.getElementById('acao-disp-detalhada')?.addEventListener('click', () => {
    const resumo = u.servicos.map((s) => {
      const st = s.disponibilidades.map((d) => `[${d.modalidade}] ${d.metaEstado.rotulo}`).join(' | ');
      return `• ${s.nome}: ${st || 'Não informado'}`;
    }).join('\n');
    alert(`[Ação 6 — Disponibilidade Detalhada]\nUnidade: ${u.nome}\n\n${resumo}\n\nLembre-se: disponibilidade informada não é garantia de vaga.`);
  });

  // (7) Consultar Documentos e Requisitos
  document.getElementById('acao-requisitos')?.addEventListener('click', () => {
    const requisitosGerais = u.servicos.map((s) => `• ${s.nome}:\n  ${s.requisitos}`).join('\n\n');
    alert(`[Ação 7 — Requisitos e Documentos]\n\n${requisitosGerais || 'Nenhum requisito específico listado.'}`);
  });

  // (8) Ver Histórico Público
  document.getElementById('acao-historico')?.addEventListener('click', () => {
    document.getElementById('sec-hist-titulo')?.scrollIntoView({ behavior: 'smooth' });
  });

  // (9) Relatar Erro (Cria relato demonstrativo no repositório)
  document.getElementById('acao-relatar')?.addEventListener('click', () => {
    const campo = prompt('Qual campo ou informação desta unidade apresenta incorreção? (Ex.: Horário, Telefone, Endereço, Disponibilidade)');
    if (!campo) return;
    const desc = prompt('Descreva brevemente o erro observado (Registro demonstrativo local):');
    if (!desc) return;

    if (!estadoRepo.relatos) estadoRepo.relatos = [];
    estadoRepo.relatos.push({
      id: `rel-${Date.now()}`,
      unidadeId: u.id,
      campo,
      descricaoDemo: desc,
      estado: 'PENDENTE',
      criadoEm: new Date().toISOString()
    });
    persistirEstadoRepositorio(estadoRepo);
    alert('Obrigado! Seu relato foi registado no painel demonstrativo da administração para fins de teste.');
  });

  // (10) Criar Alerta para a Unidade (Simulado)
  document.getElementById('acao-alerta')?.addEventListener('click', () => {
    const criar = confirm(`[Ação 10 — Criar Alerta Demonstrativo]\n\nDeseja configurar um alerta local para receber avisos quando houver alteração de disponibilidade nesta unidade (${u.nome})?`);
    if (criar) {
      if (!estadoRepo.alertas) estadoRepo.alertas = [];
      estadoRepo.alertas.push({
        id: `alt-${Date.now()}`,
        personaId: estadoRepo.personaAtivaId,
        alvo: u.id,
        tipoAlvo: 'UNIDADE',
        modalidade: 'SUS',
        canais: ['email', 'whatsapp'],
        frequencia: 'imediata',
        ativo: true,
        criadoEm: new Date().toISOString()
      });
      persistirEstadoRepositorio(estadoRepo);
      alert('Alerta demonstrativo criado com sucesso! Você pode visualizá-lo na Área Pessoal do Paciente.');
    }
  });
}
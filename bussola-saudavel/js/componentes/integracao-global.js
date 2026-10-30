// js/componentes/integracao-global.js
import {
  obterEstadoRepositorio,
  persistirEstadoRepositorio,
  restaurarDemonstracao,
  registrarSincronizacaoEntreAbas,
  auditarPrivacidadeArmazenamento
} from '../repositorios/repositorio-local.js';

const FORM_DRAFT_KEY = 'bussola_form_drafts_v1';

export function inicializarIntegracaoTransversal(recarregarPaginaAtivaCallback) {
  renderizarBarraGlobalSimulacao(recarregarPaginaAtivaCallback);
  configurarPreservacaoFormulariosLongos();
  configurarMonitorConexao();

  // Atualiza a barra global sempre que o repositório local sofrer alterações na mesma aba
  window.addEventListener('bussola:estado-atualizado', () => {
    atualizarContadoresBarraGlobal();
  });

  // Sincroniza imediatamente se outra aba alterar o localStorage (Etapa 8)
  registrarSincronizacaoEntreAbas(() => {
    atualizarContadoresBarraGlobal();
    exibirToastSincronizacao('Dados atualizados noutra aba foram sincronizados automaticamente.');
    if (typeof recarregarPaginaAtivaCallback === 'function') {
      recarregarPaginaAtivaCallback();
    }
  });
}

function renderizarBarraGlobalSimulacao(recarregarPaginaAtivaCallback) {
  const container = document.getElementById('global-sim-bar');
  if (!container) return;

  const estado = obterEstadoRepositorio();
  const opcoesPersona = estado.personas
    .map(
      (p) =>
        `<option value="${p.id}" ${p.id === estado.personaAtivaId ? 'selected' : ''}>${p.nome} [${p.papel}]</option>`
    )
    .join('');

  container.innerHTML = `
    <div class="sim-bar" role="region" aria-label="Painel global de integração e controlo da simulação">
      <div class="container sim-bar__inner">
        <div class="sim-bar__persona">
          <label for="global-select-persona" class="sim-bar__label">🎭 Persona Ativa:</label>
          <select id="global-select-persona" class="sim-bar__select" aria-label="Alternar persona demonstrativa em qualquer página">
            ${opcoesPersona}
          </select>
        </div>

        <div class="sim-bar__Counters" id="global-sim-counters" aria-live="polite"></div>

        <div class="sim-bar__actions">
          <button type="button" id="btn-global-auditar-storage" class="btn-a11y" title="Inspecionar conformidade e ausência de dados sensíveis no localStorage (T-26)">
            🔍 Auditar Storage (T-26)
          </button>
          <button type="button" id="btn-global-restaurar-seed" class="btn-a11y" title="Restaurar todo o protótipo para as 10 unidades originais (T-19)">
            ↺ Restaurar Seed (T-19)
          </button>
        </div>
      </div>
      <div id="global-toast-sincronizacao" class="sim-bar__toast" role="status" aria-live="polite" hidden></div>
    </div>
  `;

  atualizarContadoresBarraGlobal();

  document.getElementById('global-select-persona')?.addEventListener('change', (e) => {
    const st = obterEstadoRepositorio();
    st.personaAtivaId = e.target.value;
    persistirEstadoRepositorio(st, 'TROCA_PERSONA_GLOBAL');
    if (typeof recarregarPaginaAtivaCallback === 'function') {
      recarregarPaginaAtivaCallback();
    }
  });

  document.getElementById('btn-global-restaurar-seed')?.addEventListener('click', () => {
    const confirmar = window.confirm(
      '[Restauração Global do Protótipo — T-19]\n\nDeseja apagar todas as edições locais, favoritos, alertas, relatos e auditoria, regressando ao catálogo inicial das 10 unidades fictícias?'
    );
    if (!confirmar) return;
    restaurarDemonstracao();
    atualizarContadoresBarraGlobal();
    exibirToastSincronizacao('Catálogo e estado local restaurados para o seed inicial (T-19).');
    if (typeof recarregarPaginaAtivaCallback === 'function') {
      recarregarPaginaAtivaCallback();
    }
  });

  document.getElementById('btn-global-auditar-storage')?.addEventListener('click', () => {
    const relatorio = auditarPrivacidadeArmazenamento();
    alert(
      `[Inspeção de Armazenamento Local — Teste T-26]\n\n` +
        `• Chave versionada: ${relatorio.chave}\n` +
        `• Tamanho ocupado: ${relatorio.tamanhoBytes} bytes\n` +
        `• Unidades / Serviços: ${relatorio.totalUnidades} / ${relatorio.totalServicos}\n` +
        `• Registos na trilha de auditoria: ${relatorio.totalAuditoria}\n` +
        `• Ausência de senhas/CPF/prontuários reais: ${relatorio.semDadosSensiveisReais ? 'APROVADO (Nenhum dado sensível)' : 'REPROVADO'}`
    );
  });
}

export function atualizarContadoresBarraGlobal() {
  const estado = obterEstadoRepositorio();
  const contEl = document.getElementById('global-sim-counters');
  const selPersona = document.getElementById('global-select-persona');

  if (selPersona && selPersona.value !== estado.personaAtivaId) {
    selPersona.value = estado.personaAtivaId;
  }

  if (!contEl) return;

  const qtdFav = (estado.favoritos || []).filter((f) => f.personaId === estado.personaAtivaId).length;
  const qtdEventos = (estado.eventosAlertaDemo || []).length;
  const qtdRelatosPend = (estado.relatos || []).filter((r) => r.estado === 'PENDENTE').length;
  const qtdVerifPend = (estado.verificacoes || []).filter((v) => v.estado === 'PENDENTE').length;
  const qtdAuditoria = (estado.historicoAuditoria || []).length;

  contEl.innerHTML = `
    <a href="/paginas/paciente.html" class="sim-pill" title="Meus Favoritos Locais">★ Fav: <strong>${qtdFav}</strong></a>
    <a href="/paginas/paciente.html#titulo-sistema-alertas" class="sim-pill ${qtdEventos > 0 ? 'sim-pill--highlight' : ''}" title="Avisos de alerta disparados localmente">🔔 Avisos: <strong>${qtdEventos}</strong></a>
    <a href="/paginas/administracao.html#mod-relatos" class="sim-pill ${qtdRelatosPend > 0 ? 'sim-pill--warn' : ''}" title="Relatos de erro pendentes">⚠ Relatos: <strong>${qtdRelatosPend}</strong></a>
    <a href="/paginas/administracao.html#mod-verificacoes" class="sim-pill ${qtdVerifPend > 0 ? 'sim-pill--warn' : ''}" title="Pedidos de selo de verificação pendentes">🛡 Verif.: <strong>${qtdVerifPend}</strong></a>
    <a href="/paginas/administracao.html#mod-auditoria" class="sim-pill" title="Total de registos na trilha de auditoria">🕒 Logs: <strong>${qtdAuditoria}</strong></a>
  `;
}

function exibirToastSincronizacao(mensagem) {
  const toast = document.getElementById('global-toast-sincronizacao');
  if (!toast) return;
  toast.hidden = false;
  toast.textContent = `🔄 ${mensagem}`;
  setTimeout(() => {
    toast.hidden = true;
  }, 4500);
}

/**
 * Preservação temporária de formulários longos em sessionStorage (Cap. 12.10)
 */
function configurarPreservacaoFormulariosLongos() {
  const idsMonitorizados = [
    'pesq-nome',
    'pesq-termo',
    'verif-justificativa',
    'vinc-observacao',
    'form-srv-nome',
    'form-srv-horarios',
    'form-srv-requisitos'
  ];

  let rascunhos = {};
  try {
    rascunhos = JSON.parse(sessionStorage.getItem(FORM_DRAFT_KEY) || '{}');
  } catch {
    rascunhos = {};
  }

  idsMonitorizados.forEach((id) => {
    const input = document.getElementById(id);
    if (!input) return;

    if (rascunhos[id] && !input.value) {
      input.value = rascunhos[id];
    }

    input.addEventListener('input', () => {
      try {
        rascunhos[id] = input.value;
        sessionStorage.setItem(FORM_DRAFT_KEY, JSON.stringify(rascunhos));
      } catch {
        // Ignora se sessionStorage indisponível
      }
    });

    input.form?.addEventListener('submit', () => {
      delete rascunhos[id];
      try {
        sessionStorage.setItem(FORM_DRAFT_KEY, JSON.stringify(rascunhos));
      } catch {
        // Ignora
      }
    });
  });
}

/**
 * Feedback de falha ou restauro de conexão (Cap. 12.10)
 */
function configurarMonitorConexao() {
  window.addEventListener('offline', () => {
    exibirToastSincronizacao(
      'Modo offline detetado: o catálogo local continua funcional, mas recursos externos estão indisponíveis.'
    );
  });
  window.addEventListener('online', () => {
    exibirToastSincronizacao('Conexão restabelecida.');
  });
}
// js/componentes/layout-base.js

const STORAGE_PREFS_KEY = 'bussola_ui_prefs_v1';

export function carregarPreferenciasVisuais() {
  const padraoSistemaEscuro =
    window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const padrao = {
    theme: padraoSistemaEscuro ? 'dark' : 'light',
    contrast: 'normal',
    fontScale: '100'
  };

  try {
    const salvo = localStorage.getItem(STORAGE_PREFS_KEY);
    if (!salvo) return padrao;
    const parsed = JSON.parse(salvo);
    return {
      theme: parsed.theme === 'dark' ? 'dark' : 'light',
      contrast: parsed.contrast === 'high' ? 'high' : 'normal',
      fontScale: ['100', '115', '130'].includes(parsed.fontScale) ? parsed.fontScale : '100'
    };
  } catch (erro) {
    console.warn('Armazenamento local indisponível para preferências visuais:', erro);
    return padrao;
  }
}

export function salvarPreferenciasVisuais(prefs) {
  try {
    localStorage.setItem(STORAGE_PREFS_KEY, JSON.stringify(prefs));
  } catch (erro) {
    console.warn('Não foi possível persistir preferências visuais no localStorage:', erro);
  }
}

export function aplicarPreferenciasNoDOM(prefs) {
  const root = document.documentElement;
  root.setAttribute('data-theme', prefs.theme);
  root.setAttribute('data-contrast', prefs.contrast);
  root.setAttribute('data-font-scale', prefs.fontScale);
}

export function inicializarLayoutBase(paginaAtivaId = 'inicio') {
  const prefs = carregarPreferenciasVisuais();
  aplicarPreferenciasNoDOM(prefs);

  renderizarTopo(paginaAtivaId, prefs);
  renderizarRodape();
  configurarEventosAcessibilidade(prefs);
}

function renderizarTopo(paginaAtivaId, prefs) {
  const headerContainer = document.getElementById('app-header');
  if (!headerContainer) return;

  const linkInicio = '/index.html';
  const linkBusca = '/paginas/busca.html';
  const linkComoFunciona = '/index.html#como-funciona';
  const linkAjuda = '/index.html#ajuda-faq';
  const linkEntrar = '/paginas/paciente.html';

  headerContainer.innerHTML = `
    <a href="#conteudo-principal" class="skip-link">Pular para o conteúdo principal</a>

    <!-- Banner Permanente de Demonstração (Cap. 1 / RN-001 / CA-1004) -->
    <div class="demo-banner" role="region" aria-label="Aviso de ambiente de demonstração">
      <div class="container demo-banner__inner">
        <div>
          <span class="demo-badge" aria-hidden="true">⚠ DEMONSTRAÇÃO</span>
          <strong>Protótipo Bússola Saudável (Belém/PA):</strong>
          Dados, estabelecimentos, disponibilidades e alertas são <strong>integralmente fictícios</strong>. Não utilize para decisões reais de saúde.
        </div>
        <span class="demo-badge">Versão 1.0 — Simulação Local</span>
      </div>
    </div>

    <!-- Barra de Acessibilidade e Tema (RA-001, RA-002, Cap. 11.7) -->
    <div class="a11y-bar" role="region" aria-label="Controles de acessibilidade e aparência">
      <div class="container a11y-bar__inner">
        <span><strong>Acessibilidade e Leitura:</strong></span>
        <div class="a11y-controls">
          <button type="button" class="btn-a11y" id="btn-font-100" aria-pressed="${prefs.fontScale === '100'}" aria-label="Tamanho de texto padrão (100%)">A (100%)</button>
          <button type="button" class="btn-a11y" id="btn-font-115" aria-pressed="${prefs.fontScale === '115'}" aria-label="Aumentar texto para 115%">A+ (115%)</button>
          <button type="button" class="btn-a11y" id="btn-font-130" aria-pressed="${prefs.fontScale === '130'}" aria-label="Aumentar texto para 130%">A++ (130%)</button>
          <button type="button" class="btn-a11y" id="btn-contrast" aria-pressed="${prefs.contrast === 'high'}">
            <span aria-hidden="true">◐</span> Alto Contraste
          </button>
          <button type="button" class="btn-a11y" id="btn-theme" aria-pressed="${prefs.theme === 'dark'}">
            <span aria-hidden="true">${prefs.theme === 'dark' ? '☀' : '☾'}</span>
            <span id="label-theme">${prefs.theme === 'dark' ? 'Tema Claro' : 'Tema Escuro'}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Contentor da Barra Global de Integração e Estado da Simulação (Etapa 8) -->
    <div id="global-sim-bar"></div>

    <!-- Cabeçalho Principal Compacto (Cap. 12.1) -->
    <header class="site-header">
      <div class="container site-header__inner">
        <a href="${linkInicio}" class="brand-logo" aria-label="Bússola Saudável — Ir para página inicial (Protótipo Demonstrativo)">
          <svg class="brand-logo__svg" viewBox="0 0 48 48" role="img" aria-hidden="true" focusable="false">
            <rect x="4" y="4" width="40" height="40" rx="14" fill="var(--brand-primary)" />
            <circle cx="24" cy="24" r="14" fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-dasharray="4 2" />
            <path d="M24 10 L27 17 L24 15 L21 17 Z" fill="var(--brand-secondary)" />
            <path d="M24 31.5 C24 31.5 16.5 26.2 16.5 21.2 C16.5 18.8 18.4 17 20.7 17 C22.1 17 23.4 17.7 24 18.8 C24.6 17.7 25.9 17 27.3 17 C29.6 17 31.5 18.8 31.5 21.2 C31.5 26.2 24 31.5 24 31.5 Z" fill="var(--brand-accent)" stroke="#FFFFFF" stroke-width="1.2" />
          </svg>
          <div>
            <span>Bússola Saudável</span>
            <span class="brand-logo__subtitle">Orientação em Saúde • Belém (PA) [Demo]</span>
          </div>
        </a>

        <button type="button" class="nav-toggle" id="btn-nav-toggle" aria-expanded="false" aria-controls="menu-principal">
          <span aria-hidden="true">☰</span> Menu
        </button>

        <nav class="site-nav" id="menu-principal" aria-label="Navegação principal">
          <ul class="site-nav__list">
            <li>
              <a href="${linkInicio}" class="site-nav__link" ${paginaAtivaId === 'inicio' ? 'aria-current="page"' : ''}>Início</a>
            </li>
            <li>
              <a href="${linkBusca}" class="site-nav__link" ${paginaAtivaId === 'busca' ? 'aria-current="page"' : ''}>Buscar unidades</a>
            </li>
            <li>
              <a href="${linkComoFunciona}" class="site-nav__link">Como funciona</a>
            </li>
            <li>
              <a href="${linkAjuda}" class="site-nav__link">Ajuda</a>
            </li>
            <li>
              <a href="${linkEntrar}" class="site-nav__link site-nav__link--cta" ${['paciente', 'instituicao', 'administracao'].includes(paginaAtivaId) ? 'aria-current="page"' : ''}>
                <span aria-hidden="true">👤</span> Painéis Demo
              </a>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  `;
}

function renderizarRodape() {
  const footerContainer = document.getElementById('app-footer');
  if (!footerContainer) return;

  footerContainer.innerHTML = `
    <footer class="site-footer">
      <div class="container">
        <div class="site-footer__grid">
          <div>
            <h3>Bússola Saudável</h3>
            <p>Plataforma demonstrativa de orientação e descoberta de serviços de saúde em Belém (PA).</p>
            <p><span class="demo-badge">Arte e Paleta Provisórias</span></p>
          </div>

          <div>
            <h4>Navegação Rápida</h4>
            <ul class="site-footer__list">
              <li><a href="/index.html">Página Inicial</a></li>
              <li><a href="/paginas/busca.html">Buscar Unidades Fictícias</a></li>
              <li><a href="/index.html#como-funciona">Como Funciona</a></li>
              <li><a href="/index.html#ajuda-faq">Ajuda, FAQ e Contato</a></li>
            </ul>
          </div>

          <div>
            <h4>Perfis Demonstrativos (Sem Senha)</h4>
            <ul class="site-footer__list">
              <li><a href="/paginas/paciente.html">Área Pessoal do Paciente</a></li>
              <li><a href="/paginas/instituicao.html">Painel Institucional</a></li>
              <li><a href="/paginas/administracao.html">Painel Administrativo</a></li>
            </ul>
          </div>

          <div id="transparencia-fontes">
            <h4>Transparência, Privacidade e Termos</h4>
            <ul class="site-footer__list">
              <li><a href="/index.html#transparencia-info">Fontes e Níveis de Confiabilidade</a></li>
              <li><a href="/index.html#privacidade-termos">Privacidade e Armazenamento Local</a></li>
              <li><a href="/index.html#privacidade-termos">Termos de Uso do Protótipo</a></li>
            </ul>
          </div>
        </div>

        <div class="site-footer__disclaimer">
          <p><strong>AVISO ESSENCIAL DE SEGURANÇA INFORMACIONAL:</strong> Esta aplicação é um protótipo de validação funcional e técnica. As 10 unidades de saúde listadas são <strong>integralmente fictícias</strong>. A plataforma não realiza diagnóstico médico, triagem clínica, agendamento real ou garantia de vagas. Em caso de urgência ou emergência médica, procure imediatamente a unidade de pronto atendimento mais próxima ou acione os serviços públicos de emergência (como SAMU 192).</p>
        </div>
      </div>
    </footer>
  `;
}

function configurarEventosAcessibilidade(prefs) {
  const atualizarEstado = () => {
    aplicarPreferenciasNoDOM(prefs);
    salvarPreferenciasVisuais(prefs);

    const btn100 = document.getElementById('btn-font-100');
    const btn115 = document.getElementById('btn-font-115');
    const btn130 = document.getElementById('btn-font-130');
    const btnContrast = document.getElementById('btn-contrast');
    const btnTheme = document.getElementById('btn-theme');
    const labelTheme = document.getElementById('label-theme');

    if (btn100) btn100.setAttribute('aria-pressed', String(prefs.fontScale === '100'));
    if (btn115) btn115.setAttribute('aria-pressed', String(prefs.fontScale === '115'));
    if (btn130) btn130.setAttribute('aria-pressed', String(prefs.fontScale === '130'));
    if (btnContrast) btnContrast.setAttribute('aria-pressed', String(prefs.contrast === 'high'));
    if (btnTheme) {
      btnTheme.setAttribute('aria-pressed', String(prefs.theme === 'dark'));
      if (labelTheme) labelTheme.textContent = prefs.theme === 'dark' ? 'Tema Claro' : 'Tema Escuro';
    }
  };

  document.getElementById('btn-font-100')?.addEventListener('click', () => {
    prefs.fontScale = '100';
    atualizarEstado();
  });

  document.getElementById('btn-font-115')?.addEventListener('click', () => {
    prefs.fontScale = '115';
    atualizarEstado();
  });

  document.getElementById('btn-font-130')?.addEventListener('click', () => {
    prefs.fontScale = '130';
    atualizarEstado();
  });

  document.getElementById('btn-contrast')?.addEventListener('click', () => {
    prefs.contrast = prefs.contrast === 'high' ? 'normal' : 'high';
    atualizarEstado();
  });

  document.getElementById('btn-theme')?.addEventListener('click', () => {
    prefs.theme = prefs.theme === 'dark' ? 'light' : 'dark';
    atualizarEstado();
  });

  const btnMenu = document.getElementById('btn-nav-toggle');
  const navMenu = document.getElementById('menu-principal');
  if (btnMenu && navMenu) {
    btnMenu.addEventListener('click', () => {
      const aberto = navMenu.classList.toggle('is-open');
      btnMenu.setAttribute('aria-expanded', String(aberto));
    });
  }
}
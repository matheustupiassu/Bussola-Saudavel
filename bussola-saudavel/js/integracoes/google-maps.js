// js/integracoes/google-maps.js

const MAPS_CONFIG_KEY = 'bussola_gmaps_config_v1';

/**
 * Adaptador isolado do Google Maps (Cap. 4.3 e 13.9)
 * Estados possíveis: 'nao_configurado' | 'carregando' | 'pronto' | 'erro'
 */
export class AdaptadorGoogleMaps {
  constructor({ containerId, statusId, btnPesquisarAreaId, onSelecionarUnidade, onPesquisarNestaArea }) {
    this.containerId = containerId;
    this.statusId = statusId;
    this.btnPesquisarAreaId = btnPesquisarAreaId;
    this.onSelecionarUnidade = onSelecionarUnidade;
    this.onPesquisarNestaArea = onPesquisarNestaArea;

    this.estado = 'nao_configurado';
    this.mapa = null;
    this.marcadores = new Map();
    this.infoWindow = null;
    this.unidadeDestacadaId = null;
    this.boundsAtuais = null;
    this.ignorandoEventoIdle = false;
  }

  obterChaveConfigurada() {
    if (window.BUSSOLA_GOOGLE_MAPS_API_KEY && typeof window.BUSSOLA_GOOGLE_MAPS_API_KEY === 'string') {
      return window.BUSSOLA_GOOGLE_MAPS_API_KEY.trim();
    }
    try {
      return (sessionStorage.getItem(MAPS_CONFIG_KEY) || '').trim();
    } catch {
      return '';
    }
  }

  definirChaveSessao(chave) {
    try {
      if (!chave) {
        sessionStorage.removeItem(MAPS_CONFIG_KEY);
      } else {
        sessionStorage.setItem(MAPS_CONFIG_KEY, chave.trim());
      }
    } catch (e) {
      console.warn('Não foi possível salvar chave de sessão do Google Maps:', e);
    }
  }

  async inicializar(unidadesIniciais = []) {
    const chave = this.obterChaveConfigurada();
    if (!chave) {
      this.estado = 'nao_configurado';
      this.renderizarEstadoFallback(unidadesIniciais);
      return;
    }

    this.estado = 'carregando';
    this.renderizarEstadoCarregando();

    try {
      await this.carregarScriptGoogleMaps(chave);
      this.criarInstanciaMapa();
      this.estado = 'pronto';
      this.atualizarMarcadores(unidadesIniciais);
    } catch (erro) {
      console.warn('Falha ao inicializar Google Maps API:', erro);
      this.estado = 'erro';
      this.renderizarEstadoErro(erro.message, unidadesIniciais);
    }
  }

  carregarScriptGoogleMaps(apiKey) {
    return new Promise((resolve, reject) => {
      if (window.google && window.google.maps) {
        resolve();
        return;
      }

      const existingScript = document.getElementById('script-google-maps-sdk');
      if (existingScript) {
        existingScript.remove();
      }

      window.gm_authFailure = () => {
        reject(new Error('Falha de autenticação da chave da API do Google Maps (gm_authFailure).'));
      };

      const script = document.createElement('script');
      script.id = 'script-google-maps-sdk';
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}`;
      script.async = true;
      script.defer = true;
      script.onload = () => {
        if (window.google && window.google.maps) {
          resolve();
        } else {
          reject(new Error('SDK do Google Maps carregado, mas objeto google.maps indisponível.'));
        }
      };
      script.onerror = () => reject(new Error('Não foi possível carregar o script do Google Maps. Verifique a conexão ou a chave.'));
      document.head.appendChild(script);
    });
  }

  criarInstanciaMapa() {
    const container = document.getElementById(this.containerId);
    if (!container) return;
    container.innerHTML = '';

    const canvas = document.createElement('div');
    canvas.id = 'gmaps-canvas-interno';
    canvas.style.width = '100%';
    canvas.style.height = '520px';
    canvas.style.borderRadius = 'var(--radius-md)';
    container.appendChild(canvas);

    // Centro ilustrativo em Belém (PA)
    this.mapa = new window.google.maps.Map(canvas, {
      center: { lat: -1.445, lng: -48.475 },
      zoom: 12,
      mapTypeControl: false,
      streetViewControl: false
    });

    this.infoWindow = new window.google.maps.InfoWindow();

    // RF-015 / CA-402: Movimentar mapa não refaz busca automaticamente; exibe botão "Pesquisar nesta área"
    this.mapa.addListener('dragend', () => this.exibirBotaoPesquisarArea());
    this.mapa.addListener('zoom_changed', () => {
      if (!this.ignorandoEventoIdle) {
        this.exibirBotaoPesquisarArea();
      }
    });
  }

  exibirBotaoPesquisarArea() {
    const btn = document.getElementById(this.btnPesquisarAreaId);
    if (btn) {
      btn.hidden = false;
    }
  }

  ocultarBotaoPesquisarArea() {
    const btn = document.getElementById(this.btnPesquisarAreaId);
    if (btn) {
      btn.hidden = true;
    }
  }

  obterLimitesVisiveis() {
    if (this.estado === 'pronto' && this.mapa) {
      const b = this.mapa.getBounds();
      if (b) {
        const ne = b.getNorthEast();
        const sw = b.getSouthWest();
        return {
          norte: ne.lat(),
          sul: sw.lat(),
          leste: ne.lng(),
          oeste: sw.lng()
        };
      }
    }
    return this.boundsAtuais;
  }

  atualizarMarcadores(unidades = []) {
    if (this.estado !== 'pronto' || !this.mapa) {
      if (this.estado === 'erro') {
        this.renderizarEstadoErro('Falha anterior na API do Google Maps.', unidades);
      } else {
        this.renderizarEstadoFallback(unidades);
      }
      return;
    }

    // Limpa marcadores anteriores
    this.marcadores.forEach((marker) => marker.setMap(null));
    this.marcadores.clear();

    const bounds = new window.google.maps.LatLngBounds();
    let comCoordenadas = 0;

    unidades.forEach((u) => {
      // Cap. 4.8 / T-09: Sem coordenadas, nunca inventar marcador
      if (typeof u.latitude !== 'number' || typeof u.longitude !== 'number') return;

      comCoordenadas++;
      const pos = { lat: u.latitude, lng: u.longitude };
      const selecionado = u.id === this.unidadeDestacadaId;

      const marker = new window.google.maps.Marker({
        position: pos,
        map: this.mapa,
        title: `${u.nome} (${u.tipo}) — Ponto ilustrativo [Demo]`,
        label: selecionado ? '★' : undefined
      });

      marker.addListener('click', () => {
        this.destacarUnidade(u.id, u, false);
        if (typeof this.onSelecionarUnidade === 'function') {
          this.onSelecionarUnidade(u.id);
        }
      });

      this.marcadores.set(u.id, marker);
      bounds.extend(pos);
    });

    if (comCoordenadas > 0) {
      this.ignorandoEventoIdle = true;
      this.mapa.fitBounds(bounds);
      setTimeout(() => {
        this.ignorandoEventoIdle = false;
      }, 400);
    }

    this.atualizarStatusBar(unidades);
  }

  destacarUnidade(unidadeId, dadosUnidade = null, centralizar = true) {
    this.unidadeDestacadaId = unidadeId;

    if (this.estado === 'pronto' && this.mapa) {
      this.marcadores.forEach((marker, id) => {
        marker.setLabel(id === unidadeId ? '★' : null);
      });

      const markerAlvo = this.marcadores.get(unidadeId);
      if (markerAlvo && centralizar) {
        this.ignorandoEventoIdle = true;
        this.mapa.panTo(markerAlvo.getPosition());
        this.mapa.setZoom(15);
        setTimeout(() => {
          this.ignorandoEventoIdle = false;
        }, 300);

        if (this.infoWindow && dadosUnidade) {
          const box = document.createElement('div');
          const strong = document.createElement('strong');
          strong.textContent = `${dadosUnidade.nome} [FICTÍCIA]`;
          const p = document.createElement('p');
          p.style.margin = '4px 0 0';
          p.style.fontSize = '12px';
          p.textContent = `${dadosUnidade.bairro} • Ponto meramente ilustrativo`;
          box.appendChild(strong);
          box.appendChild(p);
          this.infoWindow.setContent(box);
          this.infoWindow.open(this.mapa, markerAlvo);
        }
      }
    } else {
      // Destaca item na visão fallback
      const itens = document.querySelectorAll('[data-map-marker-id]');
      itens.forEach((el) => {
        const ativo = el.getAttribute('data-map-marker-id') === unidadeId;
        el.classList.toggle('is-highlighted', ativo);
        if (ativo && centralizar) {
          el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      });
    }
  }

  atualizarStatusBar(unidades) {
    const statusEl = document.getElementById(this.statusId);
    if (!statusEl) return;
    const comCoord = unidades.filter((u) => typeof u.latitude === 'number' && typeof u.longitude === 'number').length;
    const semCoord = unidades.length - comCoord;
    statusEl.textContent = `Estado do Mapa: ${this.estado.toUpperCase()} • ${comCoord} unidade(s) com coordenadas ilustrativas no mapa${semCoord > 0 ? ` • ${semCoord} unidade(s) sem coordenadas (exibida apenas na lista)` : ''}.`;
  }

  renderizarEstadoCarregando() {
    const container = document.getElementById(this.containerId);
    if (!container) return;
    container.innerHTML = `<div class="map-fallback-box"><p><strong>Carregando Google Maps...</strong> Aguarde a inicialização do adaptador.</p></div>`;
  }

  renderizarEstadoErro(mensagemErro, unidades = []) {
    const container = document.getElementById(this.containerId);
    if (!container) return;
    this.renderizarPainelAlternativo(container, unidades, {
      titulo: '⚠ Falha ao carregar o Google Maps (Estado: ERRO)',
      detalhe: `${mensagemErro} A lista de resultados permanece 100% funcional ao lado.`
    });
  }

  renderizarEstadoFallback(unidades = []) {
    const container = document.getElementById(this.containerId);
    if (!container) return;
    this.renderizarPainelAlternativo(container, unidades, {
      titulo: '🗺 Google Maps não configurado (Estado: NÃO CONFIGURADO)',
      detalhe: 'Conforme RF-012 e Cap. 4.3, nenhuma chave privada ou fictícia foi embutida no código. A pesquisa e a lista funcionam integralmente sem o mapa ativo.'
    });
  }

  renderizarPainelAlternativo(container, unidades, info) {
    container.innerHTML = '';
    this.atualizarStatusBar(unidades);

    const wrapper = document.createElement('div');
    wrapper.className = 'map-fallback-box';

    const h4 = document.createElement('h4');
    h4.textContent = info.titulo;
    wrapper.appendChild(h4);

    const p = document.createElement('p');
    p.className = 'form-hint';
    p.textContent = info.detalhe;
    wrapper.appendChild(p);

    // Simulador de recorte geográfico para testar "Pesquisar nesta área" (RF-015 / CA-402) mesmo sem chave externa
    const areaControles = document.createElement('div');
    areaControles.className = 'map-area-sim';

    const labelArea = document.createElement('label');
    labelArea.className = 'form-label';
    labelArea.setAttribute('for', 'select-recorte-mapa');
    labelArea.textContent = 'Enquadramento geográfico em Belém (simulação de deslocamento do mapa):';
    areaControles.appendChild(labelArea);

    const selectArea = document.createElement('select');
    selectArea.id = 'select-recorte-mapa';
    selectArea.className = 'form-select';
    selectArea.innerHTML = `
      <option value="TODAS">Belém Completa (Todas as coordenadas visíveis)</option>
      <option value="CENTRO_SUL">Quadrante Centro-Sul (Nazaré, Umarizal, Batista Campos, Marco, Guamá, São Brás, Pedreira)</option>
      <option value="NORTE_ICOARACI">Quadrante Norte / Icoaraci (Marambaia e Distrito de Icoaraci)</option>
    `;
    selectArea.addEventListener('change', () => {
      const val = selectArea.value;
      if (val === 'CENTRO_SUL') {
        this.boundsAtuais = { norte: -1.415, sul: -1.480, leste: -48.445, oeste: -48.505 };
      } else if (val === 'NORTE_ICOARACI') {
        this.boundsAtuais = { norte: -1.280, sul: -1.415, leste: -48.430, oeste: -48.500 };
      } else {
        this.boundsAtuais = null;
      }
      // RF-015: Mudar a área não filtra sozinho; habilita o botão "Pesquisar nesta área"
      this.exibirBotaoPesquisarArea();
    });
    areaControles.appendChild(selectArea);
    wrapper.appendChild(areaControles);

    // Lista de marcadores ilustrativos sincronizados com os cartões (RF-013 / T-09)
    const listaMarcadores = document.createElement('div');
    listaMarcadores.className = 'map-pins-list';
    listaMarcadores.setAttribute('role', 'list');
    listaMarcadores.setAttribute('aria-label', 'Coordenadas ilustrativas das unidades da consulta atual');

    unidades.forEach((u) => {
      const item = document.createElement('div');
      item.setAttribute('role', 'listitem');
      item.className = 'map-pin-item';
      item.setAttribute('data-map-marker-id', u.id);
      if (u.id === this.unidadeDestacadaId) item.classList.add('is-highlighted');

      if (typeof u.latitude === 'number' && typeof u.longitude === 'number') {
        const btnPin = document.createElement('button');
        btnPin.type = 'button';
        btnPin.className = 'map-pin-btn';
        btnPin.textContent = `📍 [${u.id}] ${u.nome} (${u.bairro}) — Coord. ilustrativa: ${u.latitude.toFixed(4)}, ${u.longitude.toFixed(4)}`;
        btnPin.addEventListener('click', () => {
          this.destacarUnidade(u.id, u, false);
          if (typeof this.onSelecionarUnidade === 'function') {
            this.onSelecionarUnidade(u.id);
          }
        });
        item.appendChild(btnPin);
      } else {
        const spanSemCoord = document.createElement('div');
        spanSemCoord.className = 'map-pin-missing';
        spanSemCoord.textContent = `⚠ [${u.id}] ${u.nome} (${u.bairro}) — Sem coordenadas cadastradas (permanece na lista sem marcador inventado - T-09).`;
        item.appendChild(spanSemCoord);
      }

      listaMarcadores.appendChild(item);
    });

    wrapper.appendChild(listaMarcadores);

    // Configuração opcional de API Key para desenvolvedor/avaliador
    const detailsConfig = document.createElement('details');
    detailsConfig.style.marginTop = 'var(--space-3)';
    const summary = document.createElement('summary');
    summary.style.cursor = 'pointer';
    summary.style.fontWeight = '600';
    summary.style.fontSize = 'var(--fs-xs)';
    summary.textContent = 'Configurar chave de navegador do Google Maps (Opcional — apenas sessão)';
    detailsConfig.appendChild(summary);

    const boxChave = document.createElement('div');
    boxChave.style.marginTop = 'var(--space-2)';
    boxChave.style.display = 'flex';
    boxChave.style.gap = 'var(--space-2)';
    boxChave.style.flexWrap = 'wrap';

    const inputKey = document.createElement('input');
    inputKey.type = 'text';
    inputKey.className = 'form-input';
    inputKey.placeholder = 'Cole sua API Key restrita por HTTP Referrer...';
    inputKey.value = this.obterChaveConfigurada();
    inputKey.setAttribute('aria-label', 'Chave da API do Google Maps para teste na sessão');

    const btnAtivar = document.createElement('button');
    btnAtivar.type = 'button';
    btnAtivar.className = 'btn btn--secondary';
    btnAtivar.textContent = 'Testar Mapa';
    btnAtivar.addEventListener('click', () => {
      this.definirChaveSessao(inputKey.value);
      this.inicializar(unidades);
    });

    const btnRemover = document.createElement('button');
    btnRemover.type = 'button';
    btnRemover.className = 'btn-a11y';
    btnRemover.textContent = 'Remover Chave';
    btnRemover.addEventListener('click', () => {
      this.definirChaveSessao('');
      this.inicializar(unidades);
    });

    boxChave.appendChild(inputKey);
    boxChave.appendChild(btnAtivar);
    boxChave.appendChild(btnRemover);
    detailsConfig.appendChild(boxChave);

    wrapper.appendChild(detailsConfig);
    container.appendChild(wrapper);
  }
}
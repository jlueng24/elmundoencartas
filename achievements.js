
// achievements.js — Vitrina de logros en MODAL (como el Álbum)
(function () {
  const LS = {
    achievements: 'pro_achievements',
    achCatalog: 'pro_ach_catalog'
  };
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));

const catEmoji = {
  Progreso:'📈', Modos:'🎮', Velocidad:'⚡',
  Rachas:'🔥', 'Reto del día':'📆', Supervivencia:'💀',
  Dificultad:'🥵', Colección:'🗂️', Exploración:'🧭', General:'🏅'
};
  const tierBg = { 'oro': 'bg-amber-100', 'plata': 'bg-slate-100', 'bronce': 'bg-emerald-50' };

  function lsGet(k, def) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch { return def; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { } }

async function loadCatalog() {
  try {
    const res = await fetch('./achievements.json', { cache: 'no-store' });
    const data = await res.json();
    const raw = Array.isArray(data.achievements) ? data.achievements : [];
    const seen = new Set();
    const list = raw
      .filter(a => a && typeof a.id === 'string' && a.id !== 'ID') // quita cabecera
      .filter(a => { if (seen.has(a.id)) return false; seen.add(a.id); return true; }) // sin duplicados
      .map(a => ({ ...a, tier: (['oro','plata','bronce'].includes(a.tier) ? a.tier : 'bronce') }));
    lsSet(LS.achCatalog, list);
    return list;
  } catch (e) {
    console.warn('No se pudo cargar achievements.json', e);
    return [];
  }
}

  function listUnlocked() {
    const map = lsGet(LS.achievements, {});
    return map || {};
  }

  function pct(part, total) { return total ? Math.round((part / total) * 100) : 0; }

  // ---- Modal skeleton ------------------------------------------------------
  function ensureModal() {
    if ($('#achModal')) return $('#achModal');

    // Oculta la sección inline si existe
    const inline = $('#achievementsSection');
    if (inline) inline.classList.add('hidden');

    const div = document.createElement('div');
    div.id = 'achModal';
    div.className = 'fixed inset-0 z-[100] hidden';
    div.innerHTML = `
      <div id="achBackdrop" class="absolute inset-0 bg-black/40"></div>
      <div class="absolute inset-0 overflow-y-auto">
        <div class="mx-auto max-w-6xl p-4 md:p-6">
          <div class="rounded-2xl bg-white shadow-xl ring-1 ring-black/5">
            <div class="flex items-center justify-between p-4 md:p-5 border-b">
              <h3 class="text-xl md:text-2xl font-bold flex items-center gap-2">
                🏆 Sala de logros
              </h3>
              <button id="achClose" class="px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200">Cerrar ✕</button>
            </div>

            <div class="p-4 md:p-6 space-y-5">
              <section>
                <div class="flex items-center justify-between">
                  <div class="text-sm text-slate-600">Tu historia en medallas</div>
                  <div id="achPct" class="font-semibold">0%</div>
                </div>
                <div class="w-full h-2 bg-slate-100 rounded-full overflow-hidden mt-2">
                  <div id="achBar" class="h-2 bg-emerald-500 w-0"></div>
                </div>
              </section>

              <section>
                <div id="achGrid" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4"></div>
              </section>
            </div>
          </div>
        </div>
      </div>

      <!-- Drawer detalle -->
      <div id="achDrawer" class="fixed right-0 top-0 h-full w-full sm:w-[420px] bg-white shadow-2xl translate-x-full transition-transform duration-200 z-[110]">
        <div class="p-4 md:p-5 border-b flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div id="achArt" class="w-10 h-10 rounded-xl bg-slate-100 grid place-items-center text-xl">🏅</div>
            <div>
              <div id="achName" class="font-bold"></div>
              <div id="achCat" class="text-xs text-slate-500"></div>
            </div>
          </div>
          <button id="achCloseDrawer" class="px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200">Cerrar</button>
        </div>
        <div class="p-4 space-y-3">
          <p id="achDesc" class="text-slate-700"></p>
          <div id="achStages" class="hidden grid grid-cols-4 gap-2 text-center text-xs"></div>
          <p class="text-xs text-slate-500">Fecha: <span id="achDate">Aún bloqueado</span></p>
        </div>
      </div>
    `;
    document.body.appendChild(div);

    // Cierre
    $('#achBackdrop').addEventListener('click', closeModal);
    $('#achClose').addEventListener('click', closeModal);
    $('#achCloseDrawer').addEventListener('click', closeDrawer);
    document.addEventListener('keydown', (e) => {
      if (!div.classList.contains('hidden') && e.key === 'Escape') {
        // Si drawer abierto, ciérralo primero
        const dr = $('#achDrawer');
        if (dr && !dr.classList.contains('translate-x-full')) {
          closeDrawer();
        } else {
          closeModal();
        }
      }
    });

    return div;
  }

  function openModal() {
    ensureModal();
    $('#achModal').classList.remove('hidden');
    document.body.classList.add('overflow-hidden');
  }
  function closeModal() {
    $('#achModal')?.classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
  }
  function openDrawer(meta, unlockedInfo, stages=[], unlocked={}) {
    if (meta.art && meta.art.trim()){
  $('#achArt').innerHTML = `<img src="${meta.art}" alt="${meta.name}" class="w-10 h-10 rounded-xl object-cover" />`;
} else {
  $('#achArt').textContent = (catEmoji[meta.category] || '🏅');
}
    $('#achName').textContent = meta.name;
    $('#achCat').textContent = meta.category || 'General';
    $('#achDesc').textContent = meta.desc || meta.idea || '';
    const stagesEl = $('#achStages');
    stagesEl.classList.toggle('hidden', !stages.length);
    stagesEl.replaceChildren();
    for (const stage of stages) {
      const earned = unlocked[stage.id];
      const badge = document.createElement('div');
      badge.className = `rounded-xl border px-1 py-2 ${earned ? 'bg-amber-50 border-amber-300 text-amber-900' : 'bg-slate-50 text-slate-500'}`;
      badge.textContent = `${earned ? '✓' : '○'} ${stage.stage} %`;
      badge.title = earned?.date ? new Date(earned.date).toLocaleString('es-ES') : 'Aún bloqueado';
      stagesEl.appendChild(badge);
    }
    const dt = unlockedInfo?.date ? new Date(unlockedInfo.date).toLocaleString('es-ES') : 'Aún bloqueado';
    $('#achDate').textContent = dt;
    $('#achDrawer')?.classList.remove('translate-x-full');
  }
  function closeDrawer() {
    $('#achDrawer')?.classList.add('translate-x-full');
  }

  // API principal que usa el botón "Logros" de la app
  window.renderAchievements = async function renderAchievements() {
    const modal = ensureModal();
    const grid = $('#achGrid');
    const catalog = await loadCatalog();
    const unlocked = listUnlocked();
    const total = catalog.length;
    let unlockedCount = 0;

    const groups = new Map();
    const cards = [];
    for (const meta of catalog) {
      if (unlocked[meta.id]) unlockedCount++;
      if (meta.series) {
        if (!groups.has(meta.series)) {
          const stages = [];
          groups.set(meta.series, stages);
          cards.push({series:meta.series, stages});
        }
        groups.get(meta.series).push(meta);
      } else cards.push({meta});
    }
    const cardMeta = new Map();
    grid.innerHTML = cards.map(card => {
      const meta = card.meta || card.stages.find(stage=>stage.stage===100);
      cardMeta.set(meta.id, card);
      const earnedStages = card.stages?.filter(stage=>unlocked[stage.id]).length || 0;
      const isUnlocked = card.stages ? earnedStages > 0 : !!unlocked[meta.id];
      const victorious = !!unlocked[meta.id];
      const cls = isUnlocked ? 'opacity-100' : 'opacity-60';
      const aura = victorious ? 'ring-2 ring-amber-400/70' : isUnlocked ? 'ring-2 ring-emerald-400/50' : 'ring-1 ring-slate-200';
      const hasArt = meta.art && String(meta.art).trim().length > 0;
      const tier = tierBg[meta.tier] || 'bg-slate-100';
      const iconNode = hasArt
        ? `<img src="${meta.art}" alt="${meta.name}" class="w-16 h-16 mx-auto rounded-xl object-cover ${cls}" />`
        : `<div class="w-16 h-16 mx-auto rounded-xl grid place-items-center text-2xl ${tier} ${cls}">${catEmoji[meta.category] || '🏅'}</div>`;

      return `
        <article class="rounded-2xl ${aura} p-3 bg-white hover:shadow transition cursor-pointer ach-card" data-id="${meta.id}">
          ${iconNode}
          <h4 class="mt-2 text-sm text-center font-medium">${meta.name}</h4>
          <div class="text-[11px] text-slate-500 text-center">${card.stages ? `Supervivencia · ${earnedStages}/4 hitos` : `${meta.category || 'General'} · ${meta.tier || 'bronce'}`}</div>
          ${card.stages ? `<div class="flex justify-center gap-1 mt-2" aria-label="Hitos conseguidos">${card.stages.map(stage=>`<span class="rounded px-1 text-[10px] ${unlocked[stage.id] ? 'bg-amber-200 text-amber-900' : 'bg-slate-100 text-slate-400'}">${stage.stage}</span>`).join('')}</div>` : ''}
        </article>`;

    }).join('');

    // Progreso
    const p = pct(unlockedCount, total);
    $('#achBar').style.width = p + '%';
    $('#achPct').textContent = p + '%';

    // Click -> detalle
    $$('#achGrid .ach-card').forEach(card => {
      card.addEventListener('click', () => {
        const id = card.getAttribute('data-id');
        const card = cardMeta.get(id);
        const meta = card.meta || card.stages.find(stage=>stage.stage===100);
        const info = unlocked[id];
        openDrawer(meta, info, card.stages || [], unlocked);
      });
    });

    openModal();
  };

  // Conecta el botón "Logros" si existe (mejor UX)
  document.addEventListener('DOMContentLoaded', () => {
    // Si la app ya tiene botón con data-role o id comunes, lo enganchamos
    const candidates = [
      '#btnLogros',
      '[data-role="open-achievements"]',
      'button',
      'a'
    ];
    for (const sel of candidates) {
      $$(sel).forEach(el => {
        const txt = (el.textContent || '').trim().toLowerCase();
        if (txt === 'logros' || txt.includes('🏅') || txt.includes('medallas')) {
          // Evita duplicar listener
          if (!el.dataset.achBound) {
            el.addEventListener('click', (ev) => {
              // Deja pasar si la app ya llama a renderAchievements; en cualquier caso lo forzamos
              setTimeout(() => window.renderAchievements(), 0);
            });
            el.dataset.achBound = '1';
          }
        }
      });
    }
  });
})();

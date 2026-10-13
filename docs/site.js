const reduceMotion = window.matchMedia(
  '(prefers-reduced-motion: reduce)',
).matches;

for (const swipe of document.querySelectorAll('.swipe')) {
  const input = swipe.querySelector('input[type="range"]');
  const set = () => {
    const v = Number(input.value);
    swipe.style.setProperty('--x', `${v}%`);
    // The input is transparent, so give it a spoken value the knob's
    // position implies: how much of each skin is showing.
    input.setAttribute(
      'aria-valuetext',
      `${v}% GitHub default, ${100 - v}% GitLab skin`,
    );
  };
  input.addEventListener('input', set);
  set();

  // Click anywhere on the capture to swap sides. A drag is left to the
  // range input, so a click that moved is ignored.
  let down = null;
  swipe.addEventListener('pointerdown', (e) => {
    down = { x: e.clientX, y: e.clientY };
  });
  swipe.addEventListener('click', (e) => {
    if (
      down &&
      (Math.abs(e.clientX - down.x) > 6 || Math.abs(e.clientY - down.y) > 6)
    ) {
      return;
    }
    input.value = Number(input.value) < 50 ? '100' : '0';
    set();
  });
}

// The hero capture sweeps itself so the before/after is obvious without
// interaction. It stops for good the moment the visitor touches it, and
// never starts under prefers-reduced-motion.
const hero = document.querySelector('.swipe--hero');
if (hero && !reduceMotion) {
  const input = hero.querySelector('input[type="range"]');
  let raf = 0;
  let t0 = 0;
  let stopped = false;
  const stop = () => {
    stopped = true;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  };
  const tick = (t) => {
    if (stopped) return;
    if (!t0) t0 = t;
    const v = 50 + 42 * Math.sin(((t - t0) / 1000) * 0.55 * Math.PI);
    input.value = String(v);
    hero.style.setProperty('--x', `${v}%`);
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  for (const ev of ['pointerdown', 'input', 'keydown', 'focusin']) {
    hero.addEventListener(ev, stop, { once: true });
  }
  // Pause while the hero is scrolled out of view.
  new IntersectionObserver((entries) => {
    if (stopped) return;
    if (entries[0].isIntersecting) {
      if (!raf) raf = requestAnimationFrame(tick);
    } else if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  }).observe(hero);
}

// Multi-skin comparison: the base capture plus one clipped layer per skin,
// with a draggable (and keyboard-operable) divider for each skin. Layer i
// shows between divider i-1 and divider i; the last skin runs to the edge.
let multiSeen = 0;
for (const multi of document.querySelectorAll('.multi')) {
  const stage = multi.querySelector('.multi-stage');
  const layers = [...multi.querySelectorAll('.multi-layer')];
  const handles = [...multi.querySelectorAll('.multi-handle')];
  if (!handles.length) continue;
  const isFirst = multiSeen === 0;
  multiSeen += 1;
  const n = handles.length;
  const pos = handles.map((_, i) => ((i + 1) * 100) / (n + 1));
  const MIN_GAP = 5;

  // A name pill per divider, riding its position.
  const tags = handles.map((handle) => {
    const tag = document.createElement('span');
    tag.className = 'multi-tag';
    tag.textContent = handle.dataset.name || '';
    stage.appendChild(tag);
    return tag;
  });

  const apply = () => {
    layers.forEach((img, i) => {
      if (i === 0) {
        img.style.clipPath = '';
        return;
      }
      const left = pos[i - 1];
      const right = i < n ? pos[i] : 100;
      img.style.clipPath = `inset(0 ${100 - right}% 0 ${left}%)`;
    });
    handles.forEach((handle, i) => {
      handle.style.left = `${pos[i]}%`;
      const value = Math.round(pos[i]);
      handle.setAttribute('aria-valuenow', String(value));
      if (handle.dataset.name) {
        handle.setAttribute(
          'aria-valuetext',
          `${handle.dataset.name}, ${value}%`,
        );
      }
      if (tags[i]) {
        tags[i].style.left = `${pos[i]}%`;
        tags[i].classList.toggle('is-flipped', pos[i] > 68);
      }
    });
  };
  const setPos = (i, value) => {
    const lo = i === 0 ? 0 : pos[i - 1] + MIN_GAP;
    const hi = i === n - 1 ? 100 : pos[i + 1] - MIN_GAP;
    pos[i] = Math.max(lo, Math.min(hi, value));
  };

  handles.forEach((handle, i) => {
    handle.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      handle.classList.add('is-dragging');
      const rect = stage.getBoundingClientRect();
      const move = (e) => {
        setPos(i, ((e.clientX - rect.left) / rect.width) * 100);
        apply();
      };
      const up = () => {
        handle.classList.remove('is-dragging');
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
      };
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
    });
    handle.addEventListener('keydown', (event) => {
      const step = event.shiftKey ? 10 : 2;
      const moves = { ArrowLeft: -step, ArrowRight: step };
      if (event.key in moves) {
        event.preventDefault();
        setPos(i, pos[i] + moves[event.key]);
      } else if (event.key === 'Home') {
        event.preventDefault();
        setPos(i, 0);
      } else if (event.key === 'End') {
        event.preventDefault();
        setPos(i, 100);
      } else {
        return;
      }
      apply();
    });
  });

  // Back to even spacing: the button, or a double-click on a divider.
  const reset = () => {
    handles.forEach((_, i) => {
      pos[i] = ((i + 1) * 100) / (n + 1);
    });
    apply();
  };
  const resetButton = multi.querySelector('.multi-reset');
  if (resetButton) resetButton.addEventListener('click', reset);
  for (const handle of handles) handle.addEventListener('dblclick', reset);

  // "Open full size" follows whichever capture the tabs are showing.
  const openLink = multi.querySelector('.multi-open');
  if (openLink) {
    for (const radio of multi.querySelectorAll('.multi-radio')) {
      radio.addEventListener('change', () => {
        const layer = layers[Number(radio.dataset.i)];
        const src = layer && layer.getAttribute('src');
        if (src) openLink.setAttribute('href', src);
      });
    }
  }
  apply();

  // Signal that the dividers move: a one-time nudge plus a hint pill, on
  // first scroll-in. Both respect prefers-reduced-motion.
  const hint = document.createElement('span');
  hint.className = 'multi-hint';
  hint.textContent = 'Drag to compare';
  stage.appendChild(hint);
  const dismiss = () => hint.classList.add('is-gone');
  let hinted = false;
  const hintObserver = new IntersectionObserver(
    (entries) => {
      if (hinted || !entries[0].isIntersecting) return;
      hinted = true;
      hintObserver.disconnect();
      // Teach the interaction once, on the first widget only.
      if (!reduceMotion && isFirst) {
        handles.forEach((h) => h.classList.add('is-nudging'));
        setTimeout(
          () => handles.forEach((h) => h.classList.remove('is-nudging')),
          2600,
        );
        setTimeout(dismiss, 3400);
      } else {
        setTimeout(dismiss, 5000);
      }
    },
    { threshold: 0.4 },
  );
  hintObserver.observe(stage);
  handles.forEach((handle) =>
    handle.addEventListener(
      'pointerdown',
      () => {
        handles.forEach((h) => h.classList.remove('is-nudging'));
        dismiss();
      },
      { once: true },
    ),
  );
}

// Highlight the nav link for the section currently in view.
const navLinks = [...document.querySelectorAll('.site nav a[href^="#"]')];
const linkFor = new Map(
  navLinks.map((a) => [a.getAttribute('href').slice(1), a]),
);
const spy = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const link = linkFor.get(entry.target.id);
      if (!link) continue;
      navLinks.forEach((a) => a.classList.toggle('is-active', a === link));
    }
  },
  { rootMargin: '-45% 0px -50% 0px', threshold: 0 },
);
for (const id of linkFor.keys()) {
  const section = document.getElementById(id);
  if (section) spy.observe(section);
}

// One comparison at a time: the two tab rows pick a source forge and a
// page kind, and only the matching card is shown. Every forge has a
// card for both kinds; a deep link (#gitlab-profile) still opens the card
// it names.
const seeDemos = document.getElementById('see-demos');
const seeTabs = [...document.querySelectorAll('.see-tab')];
if (seeDemos && seeTabs.length) {
  const cards = [...seeDemos.querySelectorAll('.card')];
  const kindTabs = seeTabs.filter((tab) => tab.dataset.kind);
  const forgeTabs = seeTabs.filter((tab) => tab.dataset.forge);
  const state = { kind: 'project', forge: 'github' };

  const show = (kind, forge) => {
    state.kind = kind;
    state.forge = forge;
    for (const tab of kindTabs) {
      tab.setAttribute('aria-pressed', String(tab.dataset.kind === kind));
    }
    for (const tab of forgeTabs) {
      tab.setAttribute('aria-pressed', String(tab.dataset.forge === forge));
    }
    for (const card of cards) {
      card.hidden = !(
        card.dataset.kind === kind && card.dataset.forge === forge
      );
    }
  };

  for (const tab of seeTabs) {
    tab.addEventListener('click', () => {
      if (tab.dataset.kind) {
        // Keep the forge across a kind switch.
        show(tab.dataset.kind, state.forge);
      } else {
        show(state.kind, tab.dataset.forge);
      }
    });
  }

  const fromHash = () => {
    const card = cards.find((c) => `#${c.id}` === location.hash);
    if (card) show(card.dataset.kind, card.dataset.forge);
  };
  fromHash();
  window.addEventListener('hashchange', fromHash);
}

// The demo video stands in for the hero swipe on a phone: play it only
// where it is shown and motion is welcome, otherwise leave the poster
// with controls so the visitor can start it.
const demoVideo = document.querySelector('.demo-video');
if (demoVideo) {
  const narrow = window.matchMedia('(max-width: 640px)');
  const syncVideo = () => {
    if (narrow.matches && !reduceMotion) {
      demoVideo.removeAttribute('controls');
      demoVideo.play().catch(() => {});
    } else {
      demoVideo.pause();
      demoVideo.setAttribute('controls', '');
    }
  };
  syncVideo();
  narrow.addEventListener('change', syncVideo);
}

// The phone header collapses its links behind a toggle.
const menuBtn = document.getElementById('menu-btn');
const siteBar = document.querySelector('.site');
if (menuBtn && siteBar) {
  menuBtn.addEventListener('click', () => {
    const open = siteBar.classList.toggle('nav-open');
    menuBtn.setAttribute('aria-expanded', String(open));
  });
  // A link tap closes the list so the target section is not covered.
  siteBar.addEventListener('click', (event) => {
    if (!event.target.closest('.site nav a')) return;
    siteBar.classList.remove('nav-open');
    menuBtn.setAttribute('aria-expanded', 'false');
  });
}

// Back-to-top, once the hero is behind you.
const toTop = document.querySelector('.to-top');
if (toTop) {
  const onScroll = () => {
    toTop.hidden = window.scrollY < 600;
  };
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
}

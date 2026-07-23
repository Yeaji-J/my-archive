'use strict';

/* ---------------- Archive history router ---------------- */

let applyingArchiveRoute = false;

function normalizeArchiveRoute(route) {
  const value = String(route || '/home');
  return value.startsWith('/') ? value : `/${value}`;
}

function currentArchiveRoute() {
  const hash = location.hash.replace(/^#/, '');
  return normalizeArchiveRoute(hash || '/home');
}

function archiveHash(route) {
  return `#${normalizeArchiveRoute(route)}`;
}

function routeForView(view) {
  if (view === 'home') return '/home';
  if (view === 'all') return '/notes';
  if (view === 'starred') return '/starred';
  if (view === 'calendar') return '/calendar';
  if (view === 'chat') return '/chat';
  return `/folder/${encodeURIComponent(view)}`;
}

function pushArchiveRoute(route, replace = false) {
  if (applyingArchiveRoute) return;
  const normalized = normalizeArchiveRoute(route);
  const targetHash = archiveHash(normalized);

  if (location.hash === targetHash) return;

  const currentDepth = Number(history.state?.archiveDepth || 0);
  const state = {
    archive: true,
    archiveDepth: replace ? currentDepth : currentDepth + 1,
    route: normalized
  };

  if (replace) {
    history.replaceState(state, '', targetHash);
  } else {
    history.pushState(state, '', targetHash);
  }
}

function replaceArchiveRoute(route) {
  pushArchiveRoute(route, true);
}

function applyArchiveRoute(route = currentArchiveRoute()) {
  const normalized = normalizeArchiveRoute(route);
  const parts = normalized.split('/').filter(Boolean);
  applyingArchiveRoute = true;

  try {
    if (parts[0] === 'note' && parts[1]) {
      const noteId = decodeURIComponent(parts[1]);
      const exists = state.notes.some(note => note.id === noteId);
      if (!exists) return false;

      if (parts[2] === 'edit') {
        openEditor(noteId, true, false);
      } else {
        openNoteView(noteId, false);
      }
      return true;
    }

    if (parts[0] === 'folder' && parts[1]) {
      const folderId = decodeURIComponent(parts[1]);
      if (!state.folders.some(folder => folder.id === folderId)) return false;
      setView(folderId, false);
      return true;
    }

    const viewRoutes = {
      home: 'home',
      notes: 'all',
      starred: 'starred',
      calendar: 'calendar',
      chat: 'chat'
    };

    setView(viewRoutes[parts[0]] || 'home', false);
    return true;
  } finally {
    applyingArchiveRoute = false;
  }
}

function syncArchiveRouteFromLocation() {
  return applyArchiveRoute(currentArchiveRoute());
}

function goBackInArchive() {
  const depth = Number(history.state?.archiveDepth || 0);
  if (depth > 0) {
    history.back();
    return;
  }

  replaceArchiveRoute('/home');
  applyArchiveRoute('/home');
}

function initializeArchiveRouter() {
  const route = currentArchiveRoute();
  const existingState = history.state;

  if (!existingState?.archive) {
    history.replaceState(
      { archive: true, archiveDepth: 0, route },
      '',
      archiveHash(route)
    );
  }

  if (!applyArchiveRoute(route) && route !== '/home') {
    /* Cloud data may not be loaded yet. applySession retries this route. */
    setView('home', false);
  }
}

window.addEventListener('popstate', () => {
  if (!syncArchiveRouteFromLocation()) {
    replaceArchiveRoute('/home');
    applyArchiveRoute('/home');
  }
});

window.addEventListener('hashchange', () => {
  if (history.state?.route !== currentArchiveRoute()) {
    history.replaceState(
      {
        archive: true,
        archiveDepth: Number(history.state?.archiveDepth || 0),
        route: currentArchiveRoute()
      },
      '',
      location.href
    );
    syncArchiveRouteFromLocation();
  }
});

queueMicrotask(initializeArchiveRouter);

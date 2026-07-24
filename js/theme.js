'use strict';

(() => {
  const SKIN_KEY = 'archive.skin.v1';
  const button =
    document.getElementById(
      'skinToggleBtn'
    );

  if (!button) return;

  function applySkin(skin) {
    const nextSkin =
      skin === 'paper'
        ? 'paper'
        : 'pastel';

    document.documentElement
      .dataset.skin = nextSkin;

    const paperActive =
      nextSkin === 'paper';

    button.classList.toggle(
      'paper-active',
      paperActive
    );

    button.setAttribute(
      'aria-pressed',
      String(paperActive)
    );

    button.title =
      paperActive
        ? '파스텔 스킨으로 변경'
        : '빈티지 페이퍼 스킨으로 변경';
  }

  applySkin(
    document.documentElement
      .dataset.skin
  );

  button.addEventListener(
    'click',
    () => {
      const nextSkin =
        document.documentElement
          .dataset.skin === 'paper'
          ? 'pastel'
          : 'paper';

      applySkin(nextSkin);

      try {
        localStorage.setItem(
          SKIN_KEY,
          nextSkin
        );
      } catch (error) {
        console.warn(
          'Could not save skin',
          error
        );
      }
    }
  );
})();

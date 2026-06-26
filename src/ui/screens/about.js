/**
 * Экран «О приложении» — общая информация, описание, лицензии и атрибуция.
 * Соответствует прототипу (readerRenderAbout) и дополнен актуальными данными.
 */
export async function mount(container, _ctx) {
  const version = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev';

  container.innerHTML = `
    <div class="about-page">
      <div class="about-hero">
        <h2 class="about-title">О приложении</h2>
        <p class="about-version">Версия ${version} · работает офлайн (PWA)</p>
      </div>

      <section class="about-section">
        <h3>Греческая читалка Нового Завета</h3>
        <p>Спокойная читалка с регулируемым греческим слоем: от русского текста —
           к оригиналу. Греческий постепенно проступает сквозь русский Синодальный
           перевод в темпе, который вы задаёте сами.</p>
        <p>Нажмите на любое подчёркнутое слово или греческую букву — увидите
           перевод, разбор и словарную информацию.</p>
      </section>

      <section class="about-section">
        <h3>Лицензии и атрибуция</h3>

        <h4>Греческий текст (SBLGNT + MACULA)</h4>
        <p>SBLGNT + MACULA Greek morphology — <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>.
           MACULA Greek Linguistic Datasets доступны на
           <a href="https://github.com/Clear-Bible/macula-greek/" target="_blank" rel="noopener">github.com/Clear-Bible/macula-greek/</a></p>

        <h4>Cherith Glosses</h4>
        <p>Cherith Glosses for the Greek New Testament, © 2023 Cherith Analytics —
           <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>.</p>

        <h4>Berean Standard Bible (BSB)</h4>
        <p>Berean Standard Bible — public domain.
           <a href="https://berean.bible/" target="_blank" rel="noopener">berean.bible</a></p>

        <h4>Синодальный перевод</h4>
        <p>Русский Синодальный перевод Библии — public domain.</p>

        <h4>Выравнивание греческий ↔ русский / английский</h4>
        <p>Строится алгоритмически по подстрочным глоссам (Berean, Cherith) при сборке данных.</p>

        <h4>Шрифт Gentium Plus</h4>
        <p>Шрифт Gentium Plus распространяется под лицензией
           <a href="https://scripts.sil.org/OFL" target="_blank" rel="noopener">SIL Open Font License (OFL)</a>.
           Copyright © 2003–2022 SIL International.</p>
      </section>

      <section class="about-section">
        <h3>Контакты</h3>
        <p><a href="https://github.com/stkotok/ru2agr_reading" target="_blank" rel="noopener">Проект на GitHub</a></p>
      </section>
    </div>
  `;
}

export function unmount() {}

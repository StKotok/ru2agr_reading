/**
 * Экран «О приложении» — лицензии и атрибуция (v2 с BSB и CC-BY).
 */
export async function mount(container, _ctx) {
  container.innerHTML = `
    <div class="about-page">
      <h2>О приложении</h2>

      <section class="progress-section">
        <h3>Греческая читалка Нового Завета</h3>
        <p>Спокойная читалка с регулируемым греческим слоем: от английского текста BSB — к оригиналу.</p>
        <p>Версия: ${typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev'}</p>
      </section>

      <section class="progress-section">
        <h3>Лицензии и атрибуция</h3>

        <h4>Греческий текст (SBLGNT + MACULA)</h4>
        <p>SBLGNT + MACULA Greek morphology — CC BY 4.0.
           MACULA Greek Linguistic Datasets, available at
           <a href="https://github.com/Clear-Bible/macula-greek/" target="_blank" rel="noopener">github.com/Clear-Bible/macula-greek/</a></p>

        <h4>Cherith Glosses</h4>
        <p>Cherith Glosses for the Greek New Testament, © 2023 Cherith Analytics — CC BY 4.0.</p>

        <h4>Berean Standard Bible (BSB)</h4>
        <p>Berean Standard Bible — public domain.
           <a href="https://berean.bible/" target="_blank" rel="noopener">berean.bible</a></p>

        <h4>Выравнивание греческий ↔ английский</h4>
        <p>Строится алгоритмически по подстрочным глоссам (Berean, Cherith) при сборке данных.</p>

        <h4>Шрифт Gentium Plus</h4>
        <p>Шрифт Gentium Plus распространяется под лицензией SIL Open Font License (OFL).
        Copyright © 2003–2022 SIL International.</p>
      </section>

      <section class="progress-section">
        <h3>Контакты</h3>
        <p><a href="https://github.com/stkotok/ru2agr_reading" target="_blank" rel="noopener">Проект на GitHub</a></p>
      </section>
    </div>
  `;
}

export function unmount() {}

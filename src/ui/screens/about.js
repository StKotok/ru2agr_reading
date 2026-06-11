/**
 * Экран «О приложении» — лицензии и атрибуция.
 */
export async function mount(container, _ctx) {
  container.innerHTML = `
    <div class="about-page">
      <h2>О приложении</h2>

      <section class="progress-section">
        <h3>Греческая читалка Нового Завета</h3>
        <p>Спокойная читалка с регулируемым греческим слоем: от знакомого
        Синодального текста — к оригиналу.</p>
        <p>Версия: 0.1.0</p>
      </section>

      <section class="progress-section">
        <h3>Лицензии и атрибуция</h3>

        <h4>Греческий текст (SBLGNT)</h4>
        <p>Scripture quotations marked SBLGNT are from the SBL Greek New Testament.
        Copyright © 2010 Society of Biblical Literature. Used by permission.</p>

        <h4>Синодальный перевод</h4>
        <p>Русский Синодальный перевод Библии — общественное достояние (public domain).</p>

        <h4>Выравнивание (Clear-Bible Alignments)</h4>
        <p>Используются данные Clear-Bible Alignments под лицензией CC-BY-SA 4.0.
        <a href="https://github.com/Clear-Bible/macula-greek/tree/main/Nestle1904/alignments" target="_blank" rel="noopener">Источник на GitHub</a>.</p>

        <h4>Шрифт Gentium Plus</h4>
        <p>Шрифт Gentium Plus распространяется под лицензией SIL Open Font License (OFL).
        Copyright © 2003–2022 SIL International.</p>

        <h4>Данные bolls.life</h4>
        <p>Данные Синодального перевода получены через открытый API bolls.life.</p>
      </section>

      <section class="progress-section">
        <h3>Контакты</h3>
        <p><a href="https://github.com/stkotok/ru2agr_reading" target="_blank" rel="noopener">Проект на GitHub</a></p>
      </section>
    </div>
  `;
}

export function unmount() {}

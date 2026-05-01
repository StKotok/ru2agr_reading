import { TextConverter } from './text-converter.js';
import { languageConfig } from './config.js';
import { Storage } from './storage.js';

let highlight = true;
let converter = new TextConverter();
let activeRules = [];
let typeTimeout;

async function init() {
  // Load rules
  let savedRules = await Storage.get('rulesState');
  if (!savedRules) {
    savedRules = languageConfig.substitutions.map(r => ({
      ...r,
      enabled: true,
      always: false
    }));
    await Storage.set('rulesState', savedRules);
  }
  activeRules = savedRules;
  renderRules();

  // Load text
  const savedText = await Storage.get('text');
  if (savedText) {
    document.getElementById("inputText").value = savedText;
  }
  
  // Initial output render
  updateOutput();

  // Load scroll position
  const savedScroll = await Storage.get('scrollPos');
  if (savedScroll) {
    const outWrap = document.getElementById("outputWrapper");
    if(outWrap) {
      setTimeout(() => outWrap.scrollTop = savedScroll, 100);
    }
  }
}

function renderRules() {
  const list = document.getElementById('rulesList');
  list.innerHTML = '';
  activeRules.forEach((rule, index) => {
    const item = document.createElement('div');
    item.className = 'rule-item';
    item.innerHTML = `
      <div class="rule-text">${rule.ru} &rarr; ${rule.gr}</div>
      <div class="rule-checkboxes">
        <label title="Включено"><input type="checkbox" data-index="${index}" class="rule-enabled" ${rule.enabled ? 'checked' : ''}></label>
        <label title="Всегда (100%)"><input type="checkbox" data-index="${index}" class="rule-always" ${rule.always ? 'checked' : ''}></label>
        <button class="delete-rule-btn" data-index="${index}" title="Удалить">🗑</button>
      </div>
    `;
    list.appendChild(item);
  });
  
  list.querySelectorAll('.rule-enabled').forEach(cb => {
    cb.addEventListener('change', async (e) => {
      activeRules[e.target.dataset.index].enabled = e.target.checked;
      await saveRules();
      updateOutput();
    });
  });
  list.querySelectorAll('.rule-always').forEach(cb => {
    cb.addEventListener('change', async (e) => {
      activeRules[e.target.dataset.index].always = e.target.checked;
      await saveRules();
      updateOutput();
    });
  });
  list.querySelectorAll('.delete-rule-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      activeRules.splice(e.target.dataset.index, 1);
      await saveRules();
      renderRules();
      updateOutput();
    });
  });
}

async function saveRules() {
  await Storage.set('rulesState', activeRules);
}

function updateOutput() {
  const inputElem = document.getElementById("inputText");
  const intensity = parseInt(document.getElementById("intensity").value);
  
  const enabledRules = activeRules
    .filter(r => r.enabled)
    .sort((a, b) => b.ru.length - a.ru.length);

  const result = converter.convert(inputElem.value, enabledRules, intensity, highlight);
  document.getElementById("output").innerHTML = result;
  
  clearTimeout(typeTimeout);
  typeTimeout = setTimeout(() => {
    Storage.set('text', inputElem.value);
  }, 500);
}

function toggleHighlight() {
  highlight = !highlight;
  updateOutput();
}

function copyOutput() {
  const output = document.getElementById("output").innerText;
  navigator.clipboard.writeText(output).then(() => {
    alert("Результат скопирован!");
  }).catch(err => {
    console.error("Copy failed", err);
  });
}

function toggleTheme() {
  const isDark = document.body.classList.toggle('dark-mode');
  document.getElementById("themeToggle").textContent = isDark ? '☀️' : '🌙';
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

function toggleInput() {
  const wrapper = document.getElementById("inputWrapper");
  const button = document.getElementById("collapseInputBtn");

  const collapsed = wrapper.classList.toggle("collapsed");
  button.textContent = collapsed ? "▶️" : "🔽";
}

function clearInput() {
  document.getElementById("inputText").value = '';
  updateOutput();
}

function handleFileUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    document.getElementById("inputText").value = ev.target.result;
    updateOutput();
  };
  reader.readAsText(file);
}

window.addEventListener('DOMContentLoaded', () => {
  const inputElem = document.getElementById("inputText");
  const intensityElem = document.getElementById("intensity");
  const themeToggle = document.getElementById("themeToggle");
  const highlightBtn = document.querySelector(".highlight-button");
  const copyBtn = document.querySelector(".copy-button");
  const collapseInputBtn = document.getElementById("collapseInputBtn");
  const clearBtn = document.querySelector(".clear-button");
  const fileInput = document.getElementById("fileInput");
  const settingsToggle = document.getElementById("settingsToggle");
  const closeSidebarBtn = document.getElementById("closeSidebarBtn");
  const addRuleBtn = document.getElementById("addRuleBtn");
  const outWrap = document.getElementById("outputWrapper");

  document.querySelector("header h1").innerText = languageConfig.title;
  inputElem.placeholder = languageConfig.inputPlaceholder;
  document.getElementById("output").setAttribute("aria-label", languageConfig.outputLabel);

  if (localStorage.getItem('theme') === 'dark') {
    document.body.classList.add('dark-mode');
    themeToggle.textContent = '☀️';
  }

  // Bind Events
  inputElem.addEventListener('input', updateOutput);
  intensityElem.addEventListener('input', updateOutput);
  themeToggle.addEventListener('click', toggleTheme);
  highlightBtn.addEventListener('click', toggleHighlight);
  copyBtn.addEventListener('click', copyOutput);
  collapseInputBtn.addEventListener('click', toggleInput);
  clearBtn.addEventListener('click', clearInput);
  fileInput.addEventListener('change', handleFileUpload);
  
  settingsToggle.addEventListener('click', () => {
    document.getElementById("sidebar").classList.toggle("open");
  });
  closeSidebarBtn.addEventListener('click', () => {
    document.getElementById("sidebar").classList.remove("open");
  });
  
  addRuleBtn.addEventListener('click', async () => {
    const ru = document.getElementById('newRuleRu').value.toLowerCase();
    const gr = document.getElementById('newRuleGr').value.toLowerCase();
    if(ru && gr) {
      activeRules.push({ ru, gr, enabled: true, always: true });
      await saveRules();
      renderRules();
      updateOutput();
      document.getElementById('newRuleRu').value = '';
      document.getElementById('newRuleGr').value = '';
    }
  });

  // Scroll position tracking
  let scrollTimeout;
  outWrap.addEventListener('scroll', () => {
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      Storage.set('scrollPos', outWrap.scrollTop);
    }, 500);
  });

  setupResizers();
  init();
});

function setupResizers() {
  const verticalResizer = document.getElementById("verticalResizer");
  const leftPane = document.querySelector(".input-container");
  const rightPane = document.querySelector(".output-container");
  const container = document.querySelector(".main-container");
  const horizontalResizer = document.getElementById("horizontalResizer");

  let isDragging = false;
  let isDraggingHeight = false;

  const startDrag = (e) => {
    isDragging = true;
    document.body.style.cursor = "col-resize";
    if(e.type !== 'touchstart') e.preventDefault();
  };

  const startDragHeight = (e) => {
    isDraggingHeight = true;
    document.body.style.cursor = "row-resize";
    if(e.type !== 'touchstart') e.preventDefault();
  };

  verticalResizer.addEventListener("mousedown", startDrag);
  verticalResizer.addEventListener("touchstart", startDrag, {passive: true});

  horizontalResizer.addEventListener("mousedown", startDragHeight);
  horizontalResizer.addEventListener("touchstart", startDragHeight, {passive: true});

  const onMove = (e) => {
    if (isDragging) {
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const containerRect = container.getBoundingClientRect();
      const offset = clientX - containerRect.left;
      const percent = (offset / containerRect.width) * 100;

      if (percent > 10 && percent < 90) {
        leftPane.style.flexBasis = \`calc(\${percent}% - 5px)\`;
        rightPane.style.flexBasis = \`calc(\${100 - percent}% - 5px)\`;
      }
    }

    if (isDraggingHeight) {
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const containerTop = container.getBoundingClientRect().top;
      const newHeight = clientY - containerTop;
      if (newHeight > 100) container.style.height = \`\${newHeight}px\`;
    }
  };

  document.addEventListener("mousemove", onMove);
  document.addEventListener("touchmove", onMove, {passive: true});

  const onEnd = () => {
    if (isDragging || isDraggingHeight) {
      isDragging = false;
      isDraggingHeight = false;
      document.body.style.cursor = "default";
    }
  };

  document.addEventListener("mouseup", onEnd);
  document.addEventListener("touchend", onEnd);
}

import { TextConverter } from './text-converter.js';
import { languageConfig } from './config.js';

let highlight = true;
let originalText = '';
const converter = new TextConverter(languageConfig.substitutions);

function updateOutput() {
  const inputElem = document.getElementById("inputText");
  const intensity = parseInt(document.getElementById("intensity").value);
  originalText = inputElem.value;
  const result = converter.convert(inputElem.value, intensity, highlight);
  document.getElementById("output").innerHTML = result;
  localStorage.setItem('savedInput', inputElem.value);
}

function toggleHighlight() {
  highlight = !highlight;
  updateOutput();
}

function copyOutput() {
  const output = document.getElementById("output");
  const temp = document.createElement("textarea");
  temp.value = output.innerText;
  document.body.appendChild(temp);
  temp.select();
  document.execCommand("copy");
  document.body.removeChild(temp);
  alert("Результат скопирован!");
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

// Event Listeners Setup
window.addEventListener('DOMContentLoaded', () => {
  const inputElem = document.getElementById("inputText");
  const intensityElem = document.getElementById("intensity");
  const themeToggle = document.getElementById("themeToggle");
  const highlightBtn = document.querySelector(".highlight-button");
  const copyBtn = document.querySelector(".copy-button");
  const collapseInputBtn = document.getElementById("collapseInputBtn");
  const clearBtn = document.querySelector(".clear-button");

  // Initial UI state from config
  document.querySelector("header h1").innerText = languageConfig.title;
  inputElem.placeholder = languageConfig.inputPlaceholder;
  document.getElementById("output").setAttribute("aria-label", languageConfig.outputLabel);

  // Initial data from storage
  inputElem.value = localStorage.getItem('savedInput') || '';
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

  updateOutput();

  // Resizer logic
  setupResizers();
});

function setupResizers() {
  const resizer = document.getElementById("verticalResizer");
  const leftPane = document.querySelector(".input-container");
  const rightPane = document.querySelector(".output-container");
  const container = document.querySelector(".main-container");
  const horizontalResizer = document.getElementById("horizontalResizer");

  let isDragging = false;
  let isDraggingHeight = false;

  resizer.addEventListener("mousedown", e => {
    isDragging = true;
    document.body.style.cursor = "col-resize";
    e.preventDefault();
  });

  horizontalResizer.addEventListener("mousedown", e => {
    isDraggingHeight = true;
    document.body.style.cursor = "row-resize";
    e.preventDefault();
  });

  document.addEventListener("mousemove", e => {
    if (isDragging) {
      const containerRect = container.getBoundingClientRect();
      const offset = e.clientX - containerRect.left;
      const percent = (offset / containerRect.width) * 100;

      if (percent > 10 && percent < 90) {
        leftPane.style.flexBasis = `calc(${percent}% - 5px)`;
        rightPane.style.flexBasis = `calc(${100 - percent}% - 5px)`;
      }
    }

    if (isDraggingHeight) {
      const containerTop = container.getBoundingClientRect().top;
      const newHeight = e.clientY - containerTop;
      if (newHeight > 100) container.style.height = `${newHeight}px`;
    }
  });

  document.addEventListener("mouseup", () => {
    if (isDragging || isDraggingHeight) {
      isDragging = false;
      isDraggingHeight = false;
      document.body.style.cursor = "default";
    }
  });
}

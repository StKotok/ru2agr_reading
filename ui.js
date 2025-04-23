let highlight = true;
let originalText = '';

function updateOutput() {
  const inputElem = document.getElementById("inputText");
  const intensityElem = document.getElementById("intensity");
  const intensity = parseInt(intensityElem.value);

  if (!originalText) originalText = inputElem.value;

  const result = converter.convert(inputElem.value, intensity, highlight);
  document.getElementById("output").innerHTML = result;
}

function toggleHighlight() {
  highlight = !highlight;
  updateOutput();
}

function resetText() {
  document.getElementById("inputText").value = originalText;
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

window.addEventListener('DOMContentLoaded', () => {
  originalText = document.getElementById("inputText").value;
  updateOutput();
});

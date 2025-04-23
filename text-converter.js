class TextConverter {
  constructor(substitutions) {
    this.substitutions = substitutions.sort((a, b) => b.ru.length - a.ru.length);
  }

  convert(input, intensity = 100, highlight = true) {
    let result = '';
    let index = 0;

    while (index < input.length) {
      let matched = false;

      for (let rule of this.substitutions) {
        const part = input.slice(index);
        let match = null;

        if (rule.regex) {
          match = new RegExp('^' + rule.ru, 'i').exec(part);
        } else if (part.toLowerCase().startsWith(rule.ru)) {
          match = [part.slice(0, rule.ru.length)];
        }

        if (match) {
          const original = match[0];
          const isUpper = original[0] === original[0].toUpperCase();
          const isAllUpper = original.toUpperCase() === original;
          const replacement = isAllUpper
            ? rule.gr.toUpperCase()
            : isUpper ? rule.gr[0].toUpperCase() + rule.gr.slice(1) : rule.gr;

          const useReplacement = Math.random() * 100 <= intensity;

          result += useReplacement
            ? `<span data-original="${original}"${highlight ? ' class="highlight"' : ''}>${replacement}</span>`
            : original;

          index += original.length;
          matched = true;
          break;
        }
      }

      if (!matched) {
        result += input[index];
        index++;
      }
    }

    return result;
  }
}

// Глобальная переменная для использования в ui.js
const converter = new TextConverter([
  { ru: "ф", gr: "φ" }, { ru: "т", gr: "τ" }, { ru: "п", gr: "π" },
  { ru: "з", gr: "ζ" }, { ru: "г(?=[еи])", gr: "γ", regex: true },
  { ru: "г", gr: "γ" }, { ru: "х", gr: "χ" }, { ru: "в", gr: "β" },
  { ru: "д", gr: "δ" }, { ru: "к", gr: "κ" }, { ru: "л", gr: "λ" },
  { ru: "м", gr: "μ" }, { ru: "н", gr: "ν" }, { ru: "р", gr: "ρ" },
  { ru: "с", gr: "σ" }, { ru: "у", gr: "υ" }, { ru: "а", gr: "α" },
  { ru: "е", gr: "ε" }, { ru: "и", gr: "ι" }, { ru: "о", gr: "ο" },
  { ru: "э", gr: "η" }, { ru: "я", gr: "ια" }, { ru: "ю", gr: "ιυ" },
  { ru: "й", gr: "ι" }, { ru: "ё", gr: "ιο" }, { ru: "кс", gr: "ξ" },
  { ru: "пс", gr: "ψ" }, { ru: "тх", gr: "θ" }, { ru: "дж", gr: "τζ" },
  { ru: "йо", gr: "ιο" }, { ru: "иян", gr: "ιαν" }, { ru: "ия", gr: "ια" },
  { ru: "ai", gr: "αι" }, { ru: "ei", gr: "ει" }, { ru: "oi", gr: "οι" },
  { ru: "ou", gr: "ου" }, { ru: "eu", gr: "ευ" }, { ru: "au", gr: "αυ" }
]);

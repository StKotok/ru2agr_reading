export class TextConverter {
  constructor(substitutions) {
    this.substitutions = [...substitutions].sort((a, b) => b.ru.length - a.ru.length);
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

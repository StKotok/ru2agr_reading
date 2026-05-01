export class TextConverter {
  constructor() {
    this.escapeHTML = (str) => {
      return str.replace(/[&<>"']/g, function(m) {
        switch (m) {
          case '&': return '&amp;';
          case '<': return '&lt;';
          case '>': return '&gt;';
          case '"': return '&quot;';
          case "'": return '&#039;';
        }
      });
    };
  }

  convert(input, rules, intensity = 100, highlight = true) {
    let result = '';
    let index = 0;

    const isPunctuationOrSpace = (char) => {
      if (!char) return true;
      return /[\s.,!?;:()\[\]{}"'\-]/.test(char);
    };

    while (index < input.length) {
      let matched = false;

      for (let rule of rules) {
        let matchLen = 0;
        let original = '';

        if (rule.regex) {
          const part = input.substring(index);
          const match = new RegExp('^' + rule.ru, 'i').exec(part);
          if (match) {
            matchLen = match[0].length;
            original = match[0];
          }
        } else {
          const part = input.substring(index, index + rule.ru.length);
          if (part.toLowerCase() === rule.ru) {
            matchLen = rule.ru.length;
            original = part;
          }
        }

        if (matchLen > 0) {
          const isUpper = original[0] === original[0].toUpperCase();
          const isAllUpper = original.toUpperCase() === original;
          
          let replacement = rule.gr;
          
          // Final Sigma logic
          if (rule.ru === 'с' && isPunctuationOrSpace(input[index + matchLen])) {
             replacement = 'ς';
          }
          
          replacement = isAllUpper && original.length > 1
            ? replacement.toUpperCase()
            : isUpper ? replacement[0].toUpperCase() + replacement.slice(1) : replacement;

          // If single char and isUpper, it should be upper
          if (original.length === 1 && isUpper) {
            replacement = replacement.toUpperCase();
          }

          const useReplacement = rule.always || (Math.random() * 100 <= intensity);

          if (useReplacement) {
            const safeOriginal = this.escapeHTML(original);
            result += `<span data-original="${safeOriginal}"${highlight ? ' class="highlight"' : ''}>${replacement}</span>`;
          } else {
            result += this.escapeHTML(original);
          }

          index += matchLen;
          matched = true;
          break;
        }
      }

      if (!matched) {
        result += this.escapeHTML(input[index]);
        index++;
      }
    }

    return result;
  }
}

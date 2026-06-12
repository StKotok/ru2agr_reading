# CLAUDE.md

Этот файл — мостик. Все правила ИИ-кодинга живут в [AGENTS.md](AGENTS.md) —
прочитай и соблюдай его до любого изменения кода. Продукт и архитектура — в
[docs/development/DEVELOPMENT_1.md](docs/development/DEVELOPMENT_1.md)
(разделы 3–4; roadmap'ы выполнены и лежат в `docs/development/` как архив).

Быстрый гейт после каждого изменения:

```bash
npm test
```

Полный гейт перед «готово» и перед коммитом:

```bash
npm run build
```

Если менялись данные или пайплайн — дополнительно:

```bash
npm run build:data
```

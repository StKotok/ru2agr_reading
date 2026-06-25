# CLAUDE.md

Этот файл — мостик. Все правила ИИ-кодинга живут в [AGENTS.md](AGENTS.md) —
прочитай и соблюдай его до любого изменения кода. Продукт, архитектура и текущее
состояние — в [docs/PROJECT.md](docs/PROJECT.md) (точка входа). Технические
справочники: [docs/PIPELINE.md](docs/PIPELINE.md) (сборка данных),
[docs/RUNTIME.md](docs/RUNTIME.md) (приложение),
[docs/ALIGNMENT.md](docs/ALIGNMENT.md) (выравнивание: план + история + шпаргалка).

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

# Сборка и страницы прототипа (состояние на 2026-07-14)

Этот файл — практический слепок того, что уже собрано и КАК оно устроено/пересобирается.
Дополняет `02-tech-approach.md` (общие принципы) и `04-content-reference.md` (контент/структура блоков с прода).
Источники истины по контенту — прежнему: живой прод + репозиторий (см. `01`).

---

## 1. Структура папки

```
subsub_front_prototype_14.07.26/
  home.html                     <- страница Home (собрана)
  media-library-files.html      <- Media Library → Files (собрана)
  css/
    tokens.css                  <- цвета/типографика 1:1 из main.css (@theme)
    styles.css                  <- все классы прототипа (header, sidebar, submenu,
                                   home-секции, media-library, модалки превью, меню действий)
  js/
    nav.js                      <- механика сайдбара (radio → саб-меню, collapse/expand)
    media.js                    <- Media Library: меню действий (⋮) + модалки-превью
  icons/                        <- реальные webp иконки сайдбара (8) + subsublogo.webp
  images/                       <- фон баннера + картинки карточек Home (Digital products, Network)
  files/                        <- РЕАЛЬНЫЕ файлы-примеры для Media Library (см. §6)
  build/                        <- node-скрипты-генераторы (НЕ часть отдаваемого прототипа; см. §7)
  instructions/                 <- эти md-файлы
```

Страницы открываются напрямую в браузере (`file://`) — без сборки/сервера. Все пути относительные.

---

## 2. Общий каркас (шапка + сайдбар) — один на все страницы

Прототип статический, шаблонов нет: **каркас физически дублируется в каждом `*.html`**.
Базовый каркас живёт в `home.html`; страницы разделов собираются из него скриптом (см. §7).

Каркас включает:
- **SVG-спрайт меню** сразу после `<body>` (`<svg style="display:none">` с `<symbol id="ic-…">`), иконки пунктов вставляются через `<use href="#ic-…">`.
- **`<header class="header">`** — лого, «Leave feedback», чип баланса `$0.50`, колокольчик, юзер-чип «Yevhenii Zemskov / Personal». Мелкие иконки — inline SVG.
- **`<aside class="sidebar">`** — узкая колонка (Home + radio-группа пространств) + саб-панель (`.submenu`).
- **`<main class="main">`** — контент конкретной страницы.
- `<script src="js/nav.js">` перед `</body>`.

---

## 3. Механика сайдбара (`js/nav.js`)

- Пункты пространств — **одна radio-группа** `name="spaces-menu-type"` (скрытый `input` + `label`), как на проде. Навигации по клику нет.
- Активный пункт — CSS `:has(.sidebar-radio:checked)` → inset-тень слева (`.sidebar__list .sidebar-item:has(...)`).
- Клик по пункту (change/click) → `openSpace(value)`: ставит класс `is-open` + `data-space` на `<body>`, показывает готовый статичный блок нужного пространства (`.submenu__menu[data-space=…]`), прячет остальные (атрибут `hidden`), подставляет заголовок. **Никаких innerHTML-шаблонов** — только переключение готовой разметки.
- Кнопки collapse/expand:
  - `.toggle--expand` (›) — на узкой колонке (`top:131px; left:57px`), видна в исходном/свёрнутом состоянии.
  - `.toggle--collapse` (‹) — у верх-правого края раскрытой панели (`top:58px; right:-17px`).
- При открытой панели `.main` сдвигается вправо (`body.is-open:not(.is-collapsed) .main { margin-left:306px }`).
- Home — отдельная ссылка (не radio), активен фиолетовым только на самом Home.
- **Admin** временно убран из меню (см. `04`).
- Иконки пунктов саб-меню — реальные inline-SVG из спрайта; соответствие пункт→иконка снято с прода (`data-id`) и сопоставлено с `MenuIcon.vue`. Вложенные пункты 1-го уровня — без иконки, но с пустым слотом (текст выровнен по верхнеуровневым); отступ только со 2-го уровня.
- Пункт **Files** (саб-меню Media Library) ведёт на `media-library-files.html` — единственная пока рабочая межстраничная ссылка.

---

## 4. Home (`home.html`)

Баннер → Digital products (6 карточек) → SubSub Network services (7 карточек, 4 с бейджем «Network member») → FAQ (10 вопросов, `<details>/<summary>`). Тексты 1:1 из i18n (см. `04`).

---

## 5. Media Library → Files (`media-library-files.html`)

- Каркас: сайдбар с активным Media Library, открытым саб-меню и подсвеченным Files (`.m-item.is-current` = `bg-purple-100 text-purple-900`).
- Тулбар: Upload / Create folder, поиск, табы All/My/Shared media; строка «All media» + пагинация.
- Таблица: чекбокс, drag-хендл, **NAME / CREATED / STORAGE / AUTHOR / SHARED WITH / ⋮** (колонка Access скрыта — как на проде). Превью 70×48, «You», «Not shared».
- Строки покрывают **все типы `FILE_CATEGORY`** + папку (детали и имена файлов — `04`).
- **Overview для Media Library сознательно НЕ делаем.**

### Превью (`js/media.js`) — нативный рендер браузера + ЕДИНЫЙ СВЕТЛЫЙ хедер
Клик по миниатюре/имени превьюабельного файла → модалка. Реальные файлы из `files/`:
- video → `<video controls>`, image → `<img>`, audio → `<audio controls>`, pdf → `<iframe>` (встроенная читалка), code → реальное содержимое (встроено на сборке).
- docx/xlsx браузер нативно не рендерит → статичная заглушка (файлы есть в `files/` для скачивания).
- Все 7 модалок — **один светлый паттерн шапки** (`.ml-viewer__head`, хелпер `head(kind, publish)`): белый фон + `border-shade-200`, цветной icon-badge по типу, чёрное имя, единый close, **action-bar** (Share/Download; у видео ещё красная «Publish to YouTube»). Детали и палитра — `04-content-reference.md`.
- Закрытие: ×, подложка, Esc; медиа останавливается, у iframe сбрасывается `src`.

### Меню действий (⋮) — попап `#mlActions`
Состав по типу (из `ActionsCell.vue`): видео — Download/Copy file link/Move to folder/Rename/**Publish to YouTube**/Convert/Share/Delete; не-видео файл — то же без Publish/Convert; папка — только Move/Rename/Delete. «Delete» красный. Пункты-заглушки закрывают меню; «Publish to YouTube» открывает мок-флоу паблишинга (`#mlModal-publish`, 3 шага — см. `04`).

---

## 6. Реальные файлы-примеры (`files/`)

Сгенерированы `build/gen-files.js` (см. таблицу в `04-content-reference.md`):
`sample-video.mp4` (копия репозиторного `blank.mp4`), `cover-photo.png`, `podcast-episode-04.wav`,
`portfolio.pdf` (3 стр.), `upload-script.js`, `contract-draft.docx`, `revenue-report.xlsx`, `project-archive.zip`.

---

## 7. Скрипты сборки (`build/`) и как пересобрать

Разметка страниц собирается детерминированно node-скриптами (надёжнее ручной правки гигантских
HTML). **Скрипты — dev-инструмент, не часть отдаваемого прототипа.** Внутри используют абсолютные
пути к этой папке (`E:/Dev SubSub/subsub_front_prototype_14.07.26/`), запускать можно из любого места.
Требуется Node (в системе есть; Python отсутствует).

| Скрипт | Что делает |
|---|---|
| `gen-icons.js` | Собирает SVG-спрайт иконок **меню** (`ic-…`) из `layers/core/components/base/icons/*.vue` репозитория → пишет временный `icons-sprite.html` в корень проекта |
| `build-menus.js` | Читает `home.html`, перегенерирует блоки саб-меню всех пространств (с иконками через `<use>`), вставляет/заменяет спрайт меню |
| `gen-media-icons.js` | Спрайт иконок **Media Library** (`ml-…`: типы файлов, действия, контролы) → временный `ml-sprite.html`. У outline-иконок ставит `fill="none"` (иначе заливаются чёрным); PDF делает themeable (красный) |
| `build-mlfiles.js` | Собирает `media-library-files.html` из каркаса `home.html` + контент таблицы + модалки + меню действий + спрайт `ml-…`. Код-превью встраивает из реального `files/upload-script.js` |
| `gen-files.js` | Генерирует реальные файлы-примеры в `files/` (PNG/WAV/PDF/zip/docx/xlsx своими руками; mp4 — копия из репозитория) |
| `serve.js` | Локальный статический сервер с правильными MIME (mp4/wav/pdf/…) — только для проверки через `http://localhost` (порт задаётся в файле). Для просмотра прототипа не нужен |

**Порядок пересборки Media Library → Files** (промежуточные спрайты удаляются после):
```
node build/gen-media-icons.js      # создаёт ml-sprite.html
node build/build-mlfiles.js        # читает home.html + ml-sprite.html → media-library-files.html
del ml-sprite.html                 # (rm) убрать временный спрайт
```
**Пересборка Home / саб-меню:**
```
node build/gen-icons.js            # создаёт icons-sprite.html
node build/build-menus.js          # перегенерирует саб-меню в home.html
del icons-sprite.html
```
> Важно: `build-mlfiles.js` берёт каркас (шапку/сайдбар/спрайт меню) из **готового `home.html`**.
> Значит `home.html` собираем/правим первым, затем — страницы разделов.

---

## 8. Конвенции и грабли

- **Обычный CSS**, без Tailwind CDN и сборки. Токены — `css/tokens.css`.
- **Иконки** — реальные: webp-файлы (сайдбар/карточки) или inline-SVG из репозитория, собранные в спрайты `<symbol>`+`<use>`. При переносе SVG в `<symbol>` **обязателен `fill="none"`** для outline-иконок.
- **JS — только показать/скрыть** готовую статичную разметку (сайдбар, модалки, меню). Никакого рендера контента через `innerHTML`-шаблоны (см. `03-known-pitfalls.md`).
- Код-превью встраивается на этапе сборки (без runtime `fetch`) — чтобы работать и через `file://`.
- Серверные данные (баланс, размеры файлов, «You» и т.п.) — примерные, выглядят как прототип.
- Проверка — вручную в реальном Chrome (при необходимости через `build/serve.js`); headless в песочнице ненадёжен (см. `03`).

---

## 9. Что дальше по плану

Порядок изменён: после Home собрана **Media Library → Files**. Дальше (по подтверждению):
Live → Overview, Live → Streams, Analytics, Fan Funding, Wallet, Network, Content Export.
Overview для Media Library и пункт Admin — пропущены осознанно. Актуальный чек-лист — в `05-progress.md`.

# Уже подтверждённый контент и данные (прод + репозиторий)

Собрано в предыдущей сессии напрямую с https://app.subsub.io/home (через DevTools/JS) и из `E:\Dev SubSub\subsub_platform_front`. **Перепроверить на живом проде перед финальным использованием** — что-то могло измениться, и не всё было проверено до конца (например правая часть хэдера — баланс/колокольчик/аватар — проверена только на глаз, не через DevTools).

## Дизайн-токены

Источник: `layers/core/assets/css/main.css`, блок `@theme`. Взять как CSS-переменные (`:root { ... }`) без изменений:

```css
--color-black: #19191a;
--color-shade-90: #fafafa;
--color-shade-100: #f3f3f3;
--color-shade-200: #e6e6e6;
--color-shade-300: #cfcfcf;
--color-shade-500: #a9a9a9;
--color-shade-600: #8c8c8c;
--color-shade-700: #707070;
--color-shade-800: #424242;
--color-lemon: #d6fc00;
--color-lavender: #edd1ff;
--color-purple-900: #b351f6;
--color-purple-100: #f7eefe;
--color-purple-200: #edd5ff;
--color-dark-blue: #12141e;
--color-green-dark: #389838;
--color-green: #1bbc40;
--color-green-20: #dcf1e1;
--color-red: #e92929;
--color-red-shade-100: #ffebeb;
--color-yellow: #edb627;
--color-yellow-20: #fdf7d5;
--color-indigo: #5766f0;
--color-violet: #786df2;
--color-accent: #6c5ce7;
```

Шрифт: **Inter** (основной), **Mulish** (вторичный, встречается реже) — подключать через Google Fonts.

Типографика (имя токена → размер/line-height/вес), из реального `main.css` — использовать как классы или переменные:

| Токен | size | line-height | weight |
|---|---|---|---|
| title-semi-32 | 32px | 130% | 500 |
| title-semi-20 | 20px | 26px | 500 |
| title-semi-18 | 18px | 130% | 500 |
| body-reg-16 | 16px | 130% | 300 |
| body-reg-14 | 14px | 130% | 300 |
| body-med-14 | 14px | 140% | 400 |
| callout-reg-16 | 16px | 24px | 300 |

(Полный список токенов — в самом `main.css` в репозитории, если понадобятся другие размеры.)

Баннер (градиент): `linear-gradient(to right, var(--color-lavender), var(--color-indigo), var(--color-violet))` — используется как 1px рамка вокруг баннера (padding-box/border-box трюк) на Home.

## Хэдер (верхняя панель, общая для всех страниц app.subsub.io)

- Слева: логотип "SubSub" (зелёно-чёрный блоб + текст), кнопка **"✎ Leave feedback"** — реальные классы: `bg-shade-100 rounded-full p-2 px-3` (пилюля, без border), ведёт на внешнюю Google Form.
- Справа: чип баланса **"💰 $0.50"** (`bg-shade-100 rounded-full`), кнопка-колокольчик (уведомления), блок пользователя — аватар (круглый, инициал), имя **"Yevhenii Zemskov"**, подпись **"Personal"** под именем, стрелка раскрытия справа. *(Не до конца сверено через DevTools — при повторной проверке уточнить точные классы.)*

## Сайдбар (навигация, общая для всех страниц)

Реальная структура (подтверждено через `javascript_tool` на живом проде):

```
<aside class="border-shade-200 fixed ... h-screen border border-t-0 border-l-0 bg-white">   <!-- ширина по внутреннему div: w-18 (72px) -->
  <div>                                              <!-- пиновый пункт Home -->
    <a>
      <span class="chip">                            <!-- bg-purple-100 rounded, активен когда открыт Home -->
        <svg>...</svg>                                <!-- см. путь ниже -->
      </span>
      <span>Home</span>
    </a>
  </div>
  <hr />
  <ul>                                                <!-- остальные 8 пунктов, radio-группа -->
    <li><label>
      <input type="radio" name="space-nav" />         <!-- скрытый, для CSS :has() -->
      <img src=".../product_analytics.webp" />
      <span>Analytics</span>
    </label></li>
    ... (ещё 7 пунктов)
  </ul>
</aside>
```

**Порядок пунктов** (подтверждён и на проде, и в коде — `useSpacesDictionary.ts`): Home (закреплён сверху, отдельно) → Analytics → Fan Funding → Wallet → Network → Live (разворачивается в подменю: Overview, Streams) → Media Library → Content Export → Admin.

**Активное состояние:**
- Для Home: фон иконки становится `bg-purple-100`, сам SVG — `color: var(--color-purple-900)`.
- Для остальных 8 (radio-группа): **не фон**, а `box-shadow: inset 3px 0 0 0 var(--color-purple-900)` на `<label>` через `:has(input:checked)`.

**Иконка Home** (единственная inline SVG в сайдбаре, остальные — растровые картинки), путь (`viewBox="0 0 24 24"`, домик):
```
M4 18.96V9.92057C4 9.65434 4.06552 9.40232 4.19657 9.16451C4.32762 8.9267 4.50819 8.73084 4.73829 8.57693L10.8926 4.33591C11.2149 4.11197 11.5829 4 11.9966 4C12.4103 4 12.7806 4.11197 13.1074 4.33591L19.2617 8.57589C19.4926 8.7298 19.6731 8.92601 19.8034 9.16451C19.9345 9.40232 20 9.65434 20 9.92057V18.96C20 19.2387 19.8861 19.4817 19.6583 19.689C19.4305 19.8963 19.1634 20 18.8571 20H14.9897C14.7276 20 14.5082 19.9196 14.3314 19.7587C14.1547 19.5972 14.0663 19.3975 14.0663 19.1597V14.2001C14.0663 13.9623 13.9779 13.7629 13.8011 13.6021C13.6236 13.4405 13.4042 13.3598 13.1429 13.3598H10.8571C10.5958 13.3598 10.3768 13.4405 10.2 13.6021C10.0225 13.7629 9.93371 13.9623 9.93371 14.2001V19.1607C9.93371 19.3985 9.84533 19.5979 9.66857 19.7587C9.49181 19.9196 9.27276 20 9.01143 20H5.14286C4.83657 20 4.56952 19.8963 4.34171 19.689C4.1139 19.4817 4 19.2387 4 18.96Z
```

**Иконки остальных 8 пунктов** — реальные `.webp`-файлы, скопировать как есть из репозитория:

| Пункт | Файл в репозитории |
|---|---|
| Analytics | `layers/core/assets/images/product_analytics.webp` |
| Fan Funding | `layers/core/assets/images/product_fanfunding.webp` |
| Wallet | `layers/core/assets/images/product_wallet.webp` |
| Network | `layers/core/assets/images/product_network.webp` |
| Live | `layers/core/assets/images/product_live.webp` |
| Media Library | `layers/core/assets/images/product_media_library.webp` |
| Content Export | `layers/core/assets/images/product_contentexport.webp` |
| Admin | `layers/core/assets/images/space_admin.webp` |

(Ещё есть `product_ai_tools.webp` и `product_commentoss.webp` в той же папке — не используются в текущем видимом меню данного аккаунта, но могут понадобиться, если у пользователя включены AI Tools/Commentoss.)

## Саб-меню разделов (второе меню сайдбара)

Структура снята с живого прода (app.subsub.io) через DevTools для аккаунта Yevhenii Zemskov (2026-07-14). Отступ = вложенность; **жирным** — группы-заголовки (аккордеоны, не ссылки). В прототипе отрендерены статично, ссылки-заглушки `href="#"` (страницы-назначения ещё не собраны). У данного аккаунта расширенный доступ (Analytics plan «enterprise», полный Admin) — у других аккаунтов набор пунктов может быть уже.

### Analytics (бейдж плана «enterprise» рядом с заголовком)
- Overview
- **Market insights**: Basic data · Deep data · Real-time trends
- **My performance**: Linked channels · **Data** (By channels · By videos · By tags) · Tag collections
- Reports
- My collections
- Metrics glossary (отдельная ссылка внизу)
- промо-блок «Starter guide»

### Fan Funding
- секция **PAGES** + переключатель страницы (в прототипе — заглушка «Your page», т.к. это персональные данные аккаунта)
- Overview · Public page · Account · Support · Membership · Audience · Graphic widgets · Content
- кнопка «Create» (фиолетовая)
- промо-блок «Starter guide»

### Wallet
- Balance
- Payment methods

### Network
- Overview

### Live
- Overview
- Streams
- промо-блок «Starter guide»

### Media Library
- Overview
- Files

### Content Export
- Overview

### Admin (внутренняя админ-панель, много групп; список длинный — саб-панель прокручивается)

> Пункт **Admin временно убран** из сайдбара прототипа (по просьбе, 2026-07-14). Структура ниже сохранена как справка (в генераторе `build-menus.js` конфиг `M.admin` тоже оставлен) — чтобы вернуть, добавить `admin` обратно в массив `order` и вернуть `<li>` пункта в `home.html`.
- Prevention · Channels · MCNs · Orders · Contracts · Transactions
- **Details**: Charges · Shorts · YouTube Shop Details · AFP
- **Adjustment**: Adjustments · US Tax
- **Withdrawals**: Withdrawal · WCommissions
- **Transfer finances**: Commission
- **Paid Services**: Test Form · Products · Groups · Prices · Orders · Subscriptions
- Users · Channel-Manager · Sms
- **Help Center**: Help Center · Categories · Questions
- Translations · Marketing Analytics
- **Notification**: Notification User · Notification System
- **Prevention**: Groups · Words
- **Reports**: importScv · forAlisa
- **Statistics**: locale.statisticsOrder *(на проде реально показывается непереведённый i18n-ключ — артефакт прода, воспроизведён как есть)*
- Index/Follow YouTube Channels · YT Sourcing
- **YouTube Comment**: Credentials · Tasks
- AdsPower Profiles

> Иконки пунктов: у верхнеуровневых пунктов и заголовков групп — реальные иконки (inline-SVG). Соответствие пункт→иконка снято с прода (атрибут `data-id` у иконки) и сопоставлено с таблицей `apps/app.subsub/app/components/spacesMenu/components/MenuIcon.vue` (id → иконка из `layers/core/components/base/icons/*.vue`). В прототипе иконки собраны в SVG-спрайт (`<symbol>`) в начале `home.html`, пункты ссылаются на них через `<use href="#ic-…">`. Вложенные пункты (2-й уровень и глубже) иконок не имеют — простой текст с отступом (как на проде). Группы отрендерены статично в развёрнутом виде (без аккордеон-поведения).

## Media Library → Files (`https://app.subsub.io/media-library/files`)

Собрано с прода + репозитория 2026-07-14. Файл прототипа: `media-library-files.html`. **Overview для Media Library сознательно НЕ делаем** (лендинг с баннером/калькулятором пропущен). Источники: `apps/app.subsub/app/pages/media-library/files/index.vue` + `components/**`, i18n-ключ `mediaLibrary` в `layers/core/i18n/locales/en/mediaLibrary.ts`, типы `layers/core/utils/fileCategory.ts`.

### Шапка и тулбар
- Заголовок **"Media Library"** (`title-semi-32`).
- Справа две кнопки: **"Upload"** (primary/чёрная, иконка `OutlineIconUpload`), **"Create folder"** (secondary/серая, иконка `OutlineFolderIcon`). Размер normal (h-48).
- Поле поиска **"Search..."** (иконка `OutlineIconSearch` слева) + **фильтр по типу** (`.ml-filter`, кнопка «Type ⌄» → дропдаун с чекбоксами: Folders + все FILE_CATEGORY: Video/Image/Audio/Document/Spreadsheet/PDF/Code/Other). При применённом фильтре у иконки фильтра — **точка-индикатор** (`.ml-filter__dot`, `--color-purple-900`; тоггл в `applyFilter`). Внизу дропдауна — кнопка **«✕ Reset filter»** (`[data-filter-clear]`): снимает все чекбоксы и применяет (меню остаётся открытым). Справа таб-переключатель: **All media** (активен) / **My media** / **Shared media**.
  - **Фильтр** (`applyFilter` в `media.js`) — чисто фронтовый: отмеченные типы оставляют видимыми только строки с этим `data-kind` (пусто → показываются все); применяется и к динамически подгруженным строкам. Меню закрывается кликом вне.
- Ниже: подпись **"All media"** + **счётчик объектов** («4 folders · 353 files», `.ml-subrow__count`).
- **Пагинации нет — инфинайт-скролл** (`media.js`, IntersectionObserver на `[data-infinite-sentinel]`): при подходе к низу списка подгружается следующая порция мок-строк (по 25) с задержкой ~700мс, на время подгрузки — спиннер `.ml-loadmore`. Стоп по достижении конца мок-данных (`done` + `disconnect`, без повторных триггеров). Внутри папки инфинайт выключен (`pauseInfinite`).
- **Вход в папку + хлебные крошки:** клик по имени папки (`tr[data-enter-folder]`) «проваливает» внутрь — корневой `<tbody data-level="root">` скрывается, показывается `<tbody data-folder="…">` с содержимым; появляются **хлебные крошки** `Media Library / <Папка>` (`.ml-crumbs`, клик по «Media Library» → назад в корень), счётчик меняется на число файлов папки, инфинайт-скролл ставится на паузу. Папки: **Analytics** → 3 файла (pdf/xlsx/png), **Music** → 4 аудиофайла (`js/media.js`: `enterFolder`/`exitToRoot`, каждая папка — отдельный `<tbody data-folder="…">`).

### Таблица (колонки)
Список обёрнут в **серфейс по дизайн-системе (BaseTable)**: плоская карточка (`.ml-table-wrap` — рамка `shade-200` + скругление 12px, **без тени**), шапка колонок `bg-shade-90` / `text-shade-700` (uppercase 12px, высота 48px), разделители строк `border-shade-200`, у последней строки линии нет, hover строки `bg-shade-90`.

Слева у каждой строки: чекбокс + drag-хендл (иконка `DragNDropIcon`, ⠿). Далее колонки (колонка Access скрыта, `hideAccessColumn=true`):
- **NAME** — **слот превью фиксированный 70×48 у ВСЕХ типов** (`.ml-preview`, `flex-shrink:0`) — чтобы колонки не «ехали» по горизонтали от строки к строке. Внутри слота: **video** — прямоугольный кадр на весь слот (реальная миниатюра — `object-fit:cover`); **все остальные типы** (folder, audio, pdf, docx, spreadsheet, code, other, image без миниатюры) — иконка 32×32 в **квадратном сером бейдже 48×48** (`.ml-preview__badge`, `shade-100`, rounded) по центру слота; сам слот прозрачный (серый фон КВАДРАТНЫЙ, не на весь 70×48). Далее — имя (у папки + мелкая подпись "N file(s) · N folder(s)"). Заголовок «NAME» с отступом слева (94px), выровнен по началу имени.
- **CREATED** — дата `DD.MM.YYYY`, сортируемая.
- **STORAGE** — размер ("13.56 MB", "341.24 KB", "0 B"), сортируемая.
- **AUTHOR** — владелец; для своих файлов текст **"You"** (серый, `text-shade-400`). (i18n-ключ колонки — `table.owner` = "Author".)
- **SHARED WITH** — если не расшарено: иконка `FilledIconEyeSlash` + серый текст **"Not shared"** (`table.noSharedWith`).
- **(actions)** — иконка `OutlineIconMore` (⋮), без подписи.
Заголовки колонок отображаются капсом. Размеры (из `constants.ts` `COLUMN_SIZES`): checkbox 33, drag 28, name grow(min 200), created 150, storage 150, author 180, sharedWith 150, actions 80.

### Превью файла (блок 70×48, скруглённый, `FilePreviewer.vue`)
Если есть `thumbnail_path` — показывается сам кадр/картинка (`object-cover`); иначе — иконка-заглушка по типу (`FilePreviewerIcon.vue`, иконка `size-8` на фоне `shade-100`). Поверх видео — кнопка play (кружок `bg-black/40` + `FilledIconPlay`).

Типы файлов (`FILE_CATEGORY`) и их иконка-заглушка:
| Тип | Иконка-заглушка | Превью в прототипе |
|---|---|---|
| video | (есть thumbnail) / `OutlineIconVideo` | тёмный градиент-«кадр» + play |
| image | (есть thumbnail) / `OutlineIconImage` | цветной градиент-миниатюра |
| audio | `OutlineIconAudio` | иконка на `shade-100` |
| document (docx) | `OutlineIconFile` (отдельной иконки document НЕТ — общий file) | иконка |
| spreadsheet (xlsx/csv) | `OutlineIconSpreadsheet` | иконка |
| pdf | `OutlineIconPdf` (**красная**, `text-red-400`) | иконка (красная) |
| code | `OutlineIconCode` | иконка |
| other/неизвестный | `OutlineIconFile` | иконка |

### Данные в прототипе (все типы представлены хотя бы одной строкой)
Реальные примеры с прода сохранены: папка **"Analytics"** (1 file · 0 folders, 0 B), видео **"video_2026-07-10_12-44-13_original.mp4"** (341.24 KB), видео **"Hunt Showdown 2025.02.26 - 21.04.40.06.противник убит.DVR.mp4"** (293.73 MB), **"Yevhenii Z. Portfolio PDF.pdf"** (13.56 MB, красная PDF-иконка). Плюс правдоподобные примеры для остальных типов: `cover-photo.jpg` (image), `podcast-episode-04.mp3` (audio), `contract-draft.docx` (document), `revenue-report.xlsx` (spreadsheet), `upload-script.js` (code), `project-archive.zip` (other). Все — автор "You", "Not shared". Это черновой первый проход по превью (видео/картинка — CSS-градиенты-заглушки вместо реальных кадров) — дальше донастраиваем.

Активный пункт саб-меню (текущая страница) на проде: `bg-purple-100 text-purple-900` (класс `.m-item.is-current` в прототипе). В саб-меню Media Library пункт **Files** ведёт на `media-library-files.html`.

### Реальные файлы-примеры (`files/`)
В прототип подтянуты **настоящие файлы** каждого типа (сгенерированы скриптом `build/gen-files.js`, лежат в `files/`). Каждая строка таблицы ссылается на файл через `data-src`:
| Тип | Файл в `files/` | Отображаемое имя | Как создан |
|---|---|---|---|
| video | `sample-video.webm` | video_2026-07-10_12-44-13_original.mp4 / Hunt Showdown…DVR.mp4 | реальный `guide.en.webm` из репозитория (`public.subsub/app/assets`, 5 МБ). Раньше был `blank.mp4` — валидный контейнер, но БЕЗ кадров, браузером не декодируется |
| image | `cover-photo.png` | cover-photo.png | сгенерирован PNG (градиент) |
| audio | `podcast-episode-04.wav` | podcast-episode-04.wav | сгенерирован WAV (тон 440 Гц) |
| pdf | `portfolio.pdf` | Yevhenii Z. Portfolio PDF.pdf | сгенерирован 3-страничный PDF |
| code | `upload-script.js` | upload-script.js | реальный .js-файл |
| document | `contract-draft.docx` | contract-draft.docx | сгенерирован минимальный docx (OOXML zip) |
| spreadsheet | `revenue-report.xlsx` | revenue-report.xlsx | сгенерирован минимальный xlsx (OOXML zip) |
| other | `project-archive.zip` | project-archive.zip | сгенерирован zip |

### Превью файлов (модалки) — `js/media.js`, нативный рендер браузера
Клик по миниатюре/имени превьюабельного файла открывает модалку. Превьюабельны 7 категорий (все, кроме `other`; папки — нет), как в `useFilePreviewer.ts` (`canPreview`). Рендер — средствами браузера (реальные файлы из `files/`):
- **video** — **кастомная панель управления в стиле прода (Plyr)** над `<video>` (нативные `controls` отключены): play/pause, rewind −10с, forward +10с, прогресс-трек с бегунком (клик = перемотка), время `тек / общее`, громкость (mute + ползунок), fullscreen — фрост-стеклянная плашка снизу над **нижним градиент-скримом** (`.ml-video::after`, чтобы белые контролы читались на любом кадре, как в Plyr); тело модалки тёмное. **Окно видео = соотношению сторон видео** (без чёрных полей): дефолт CSS `3584/1740` (пример), а `js/player.js` на `loadedmetadata` подставляет реальные `videoWidth/videoHeight`. Обвязка вынесена в **`js/player.js`** (переиспользуется и на публичной странице `shared-file.html` — работает для любого блока `.ml-video`). Файл `sample-video.webm` (реальное видео 3584×1740). ⚠️ Медиа декодируется только в обычном браузере (file:///реальный Chrome); браузер автоматизации медиа не воспроизводит.
- **pdf** — `<iframe>` со встроенной читалкой браузера (реальный PDF: миниатюры страниц, тулбар, зум — как у pdf.js на проде).
- **image** — `<img>` с реальной картинкой по центру на нейтральном светлом фоне.
- **audio** — `<audio controls>` (реальный wav) + обложка.
- **code** — реальное содержимое файла встроено на этапе сборки (номера строк + моноширинный текст); без runtime-fetch, работает и через `file://`.
- **document (docx)** и **spreadsheet (xlsx)** — браузер их не рендерит нативно, поэтому **статичная UI-заглушка** (страница с плейсхолдер-текстом / таблица-сетка). Сами файлы существуют в `files/` (для скачивания).
Закрытие: «×», клик по подложке, Esc; при закрытии видео/аудио останавливаются, `src` у iframe сбрасывается.

### ЕДИНЫЙ СВЕТЛЫЙ ХЕДЕР модалок (дизайн-эксперимент, 2026-07-14)
> Эксперимент на макете (не в реальном репозитории): в проде шапки модалок несогласованы (video — голая рамка; audio/pdf/docx/table/code — ТЁМНАЯ панель `#0f172a` со своим close; image — сторонний PhotoSwipe). В прототипе приведены к ОДНОМУ **светлому** паттерну.

Все 7 модалок (`.ml-viewer__head`, генерится хелпером `head(kind, publish)` в `build/build-mlfiles.js`):
- Белый фон, нижняя граница `border-shade-200` — консистентно с остальным UI (не тёмная панель).
- Слева — **цветной icon-badge под тип файла** (`.ml-viewer__badge--<kind>`: скруглённый квадрат, тонированный фон + акцентная иконка; palette: pdf=red, video=indigo, audio=violet, image=green, document=blue, spreadsheet=green-dark, code=purple). Чтобы иконки красились, в спрайте `ml-*` жёсткий чёрный заменён на `currentColor`.
- Имя файла — обычным чёрным текстом.
- Единый стиль кнопки закрытия (`.ml-viewer__close`, светлая, как в диалогах апки).
- **Action-bar в шапке** (`.ml-viewer__actions`) — чтобы не закрывать превью ради «⋮»: кнопки **Share** и **Download** во всех типах; у **video** дополнительно единственный акцентный CTA — красная **«Send to YouTube Studio»** (`data-action="send"`). Share/Download — заглушки (`console.log`). «Generate metadata» в action-bar **не дублируется** — только в «⋮».

### YouTube-флоу разделён на два независимых действия (модалка `#mlModal-publish`, `js/media.js`)
> Раньше было одно действие «Publish to YouTube» (генерация метаданных + прямая публикация). Теперь **два самостоятельных экшна** на одной модалке с двумя режимами (`data-pub-mode` = `send` | `metadata`). Одна и та же генерация внутри; отличаются шаг канала, футер и финал. Оба можно запускать на одном видео в любом порядке (артефакт метаданных перезаписывается по имени, конфликтов нет).

**Общая генерация (оба режима), у каждого поля своя `Copy`** (реальный буфер, «Copied» на 1.3с):
- **Шапка:** заголовок (`data-pub-title`; «Send to YouTube Studio» или «Generate metadata» по режиму) + **«↻ Regenerate»** (loading→форма, виден только на форме) + close.
- **Флоу:** `data-step=1` **Generating metadata…** (~1.5с) → `data-step=2` форма → (только send) `data-step=3` успех.
- **Поля:** Title (переключатель `1 / N` ← →, `TITLE_VARIANTS`), Description, Tags, Hashtags (`--color-violet`), Timecodes (время `--color-violet`).

**1) Send to YouTube Studio** (`data-action="send"` — в «⋮» видео **и** красной кнопкой в action-bar превью):
- В форме есть блок **«Send to»** (`[data-pub-channel]`) — **дропдаун каналов** (`.ml-chan`: Zems Racing / Big Air Racing / GenTech Studio + «**+ Connect another channel**» → мок «Sign in with Google» `.ml-gsignin`; меню раскрывается вверх). Empty-state «**No connected channels yet**» + «Connect channel» (`?channels=empty`), CTA задизейблен.
- Футер: **Cancel** + красная **«Send to YouTube Studio»** (`data-pub-send`, `.ml-pbtn--yt`).
- Финал (шаг 3): **«Sent to YouTube Studio»** + единственная кнопка **«Open in YouTube Studio»** (кнопки «View on YouTube» больше нет — это отправка черновика в Studio, не публикация вживую).
- **Синхронизация:** при достижении финала метаданные **также сохраняются** в папку Metadata (тем же способом, что в п.2).

**2) Generate metadata** (`data-action="metadata"`, пункт «⋮» **«Generate metadata»** — только у видео, БЕЗ дубля в action-bar):
- Та же генерация, но **без блока канала** (`[data-pub-channel]` скрыт) и без отправки.
- Футер: **Cancel** + **«Save metadata»** (`data-pub-save`, `.ml-pbtn--primary`).
- По «Save metadata»: в папку **«Metadata»** в корне кладётся `<база видео> - metadata.txt` с секциями Title (все варианты) / Description / Tags / Hashtags / Timecodes — простым текстом. Повтор — **перезапись** того же файла. После сохранения модалка закрывается и происходит **переход в папку Metadata** с подсветкой сохранённого файла (`.ml-row--flash`).
- Папка **«Metadata»** видима по умолчанию и содержит один **предзаполненный семпл** `.txt` (`video_2026-06-30_intro-teaser - metadata.txt`; контент засидан в `metadataFiles`); новые сохранения добавляются/перезаписываются поверх.

> **Позиционирование модалок:** меню действий и все модалки вынесены на уровень `body` (после `</main>`) — `position: fixed` центрируется относительно всего окна, а не области `.main` (у которой `margin-left` под сайдбар).
- **`.txt`-артефакт:** категория `document` (иконка `ml-file`), обычное меню «⋮» (Share/Download/Copy link/Rename/Move/Delete). Превью `#mlModal-metatxt` (`.ml-metatxt`) — читаемый текст + **Copy** (буфер) и **Download .txt** (реальный blob). Открывается по маркеру `data-metatxt` на строке.

> Модалка шеринга **не трогалась**.

> Примечание по серверу: при просмотре через локальный HTTP нужны правильные MIME-типы (mp4/wav/pdf) — в `build/serve.js` они прописаны (порт 8778); при открытии `media-library-files.html` напрямую (`file://`) типы даёт ОС, всё работает.

### Меню действий (⋮) — попап `#mlActions`, сгруппировано с разделителями
Открывается по клику на ⋮. Пункты сгруппированы, между группами — горизонтальные разделители (`.ml-actions__sep`). Порядок групп:
1. **Распространение**: Share · Download · Copy file link (иконка — **цепочка `IC.link`**, та же, что «Copy link» в модалке шеринга)
2. **Организация**: Rename · Move to folder
3. **Медиа-действия**: Publish to YouTube (`data-when="video"`) · Convert (`data-when="video"`, заглушка) · **Transcribe** (`data-when="av"` — видео **и** аудио). После завершения транскрибации этого файла пункт **меняется на «Review transcription»** (`openActions` сверяется с `transcribedFiles[имя]`) и открывает `.srt` напрямую (`openTranscript`), минуя модалку выбора языка. Состояние пофайловое: у не транскрибированных файлов — по-прежнему «Transcribe».
4. **Деструктив**: Delete (красный)

Видимость по типу (`data-when`): группа 1 и (Share/Download/Copy) — только для файлов; в группе 3 Publish/Convert — только видео, **Transcribe — видео и аудио**; Rename/Move/Delete — для файлов и папок. Итог:
- **видео** — все 4 группы (Publish · Convert · Transcribe), 3 разделителя;
- **аудио** — группы 1,2,3 (только Transcribe в гр.3),4, 3 разделителя;
- **файл (не видео/аудио, в т.ч. `.srt`)** — группы 1,2,4 (без медиа-группы), 2 разделителя;
- **папка** — группы 2,4 (Rename/Move · Delete), 1 разделитель.

**Правило разделителей** (`js/media.js`, `openActions`): разделитель после группы `i` виден, только если сама группа `i` видима И есть видимая группа после неё. Значит вокруг скрытой группы (например видео-группа для не-видео) не рисуются две линии подряд и нет «висящих» разделителей. `«Publish to YouTube»` → мок-флоу паблишинга; `«Share»` → модалка шеринга; остальные пункты-заглушки закрывают меню.

### Модалка шеринга — `#mlModal-share` (структура по референсу, стили СВЕТЛЫЕ)
Открывается по клику на **Share** (кнопка в шапке превью ИЛИ пункт «Share» в «⋮»). **Светлая** (`.ml-share`, белый фон) — стили как у остальных модалок; структура (поиск+подсказки) — по референсу дизайнера. **Ролей (can view/can edit) нет** — доступ можно только отозвать (**Revoke**, как раньше).
- **Шапка:** заголовок **«Share this file»** + справа **«🔗 Copy link»** (индиго, иконка-цепочка; реально копирует `data-link`, на 1.5с ярлык «Copied!») + close.
- **Строка добавления:** **поле поиска** `Add people by name or email` + кнопка **Invite** (активна, когда введён валидный email).
  - При вводе — **выпадающий список подсказок** (`[data-share-results]`): участники организации (аватар-портрет + имя + email), фильтр по имени/email. У тех, кто уже в списке доступа, — надпись **«Already added»** (не кликабельно). Клик по подсказке добавляет человека в список.
  - Валидный email + **Invite** → добавляет внешнего получателя строкой в список.
- **Список доступа** (`[data-share-list]`): аватар + **имя, под ним email** (серый, мельче — `.ml-share__acc-email`, тот же стиль, что в подсказках поиска); справа у каждого, кроме владельца, **«Revoke»**; у владельца — **«owner»**. Revoke открывает **маленькое подтверждение** `#mlRevokeConfirm` («Remove {имя}?» + Cancel · **красная Remove**); Remove удаляет строку.
  - 🌐 **Anyone with the link** — Revoke
  - **Arthur Verbetskyi** — Revoke
  - **Mariia** — owner
  - **Oleg Kravets** / **Vlad** — Revoke
- **Аватары** — цветные кружки с портрет-силуэтом (как было; реальных фото в прототипе нет).
- При каждом открытии список сбрасывается к дефолтному снимку (добавленные убираются, удалённые возвращаются). Логика — `js/media.js` (`shareSearch`/`sharePick`/`shareInviteEmail`), живой поиск — на `input`.

## Нотификации — поповер по колокольчику в шапке (`js/nav.js`)

Разметка в `home.html` (шапка), автоматически попадает и в `media-library-files.html` (сборщик копирует шелл). Открывается кликом по колокольчику; закрытие — клик вне / Esc / повторный клик.

**Ориентир из репозитория** (`apps/app.subsub/app/components/notifications/*`): поповер **370px**, `rounded`, тень `0 4px 24px rgba(34,41,47,.1)`; шапка «Notifications» + «Close all»; список `space-y-2` (белые зазоры между карточками `bg-shade-90`); пустое состояние — **«No notifications»**. Индикатор непрочитанного в приложении — **только бейдж-счётчик на колокольчике** (`bg-red #e92929`, белый, кружок, у items отдельного read/unread-состояния нет).

- **Бейдж на колокольчике** (`[data-notif-count]`) — красный кружок со счётчиком (= число нотификаций). При dismiss уменьшается, при пустом списке скрывается.
- **Обычная нотификация** (как в проде, `NotificationItem`): заголовок (16px/500), описание (14px/300, `shade-800`), таймстемп (12px, `shade-700`), крестик закрытия. Без иконки/аватара/кнопки. Примеры: «Payout completed», «Content Export is ready».
- **ТИП «поделился файлом»** (`.notif-item--file`, net-new; структура по референсу): слева **иконка типа файла — та же, что в Media Library** (`ml-spreadsheet`/`ml-pdf` и т.д., инлайн, т.к. на home.html нет ml-спрайта), **фиолетовая** (глиф `--color-purple-900` на бейдже `--color-purple-100`) + текст **«[Имя] shared [файл] with you.»** (имя и имя файла — жирным) + крестик; ниже — **время** (`17 mins ago`); действия **«Dismiss»** (plain) и **«View»** (фиолетовая, `--color-violet`). Примеры: «Jon Card → Team-Roster.xls», «Katherine Moss → Brand-Guidelines.pdf».
  - **«View»** ведёт на `media-library-files.html?open=shared` → deep-link (`js/media.js`) активирует вкладку **Shared media** и **сразу открывает превью видео**.
- **Табы** All / My / **Shared media** переключаются по клику (`setActiveTab` в `media.js`, обновляет и подпись `.ml-subrow__label`); фильтрации таблицы нет (прототип), переключение визуальное.
- **«Close all»** — очищает список → показывается «No notifications», бейдж скрывается. Dismiss (крестик или кнопка «Dismiss») удаляет карточку и уменьшает счётчик.

## Транскрибация (NET-NEW; в проде пункта Transcribe нет — построено по образцу прод-конвертации)

**В реальном продукте на момент проверки Transcribe нет** (меню `⋮` у видео на проде: Download · Copy file link · Move to folder · Rename · Create metadata · Convert · Share · Delete). Флоу транскрибации сделан как net-new **по визуальному образцу прод-конвертации** (топбар-бейдж `⟳ Converting 1` + попап `File conversion` с прогресс-баром и `MP4 › MP4`). Отдельная фича, **не** связана с полем Timecodes в модалке Metadata/Publish. Конвертацию в прототипе **намеренно не реализовывали** (по решению пользователя) — Convert остаётся заглушкой; состояние транскрибации изолировано (`#jobsTranscribe`, свои счётчики), так что параллельному запуску конвертации ничего не мешало бы.

Запуск: `⋮` → **Transcribe** (видео/аудио) → модалка **`#mlModal-transcribe`** «Transcribe file»:
- имя файла;
- **один** мультиселект **«Transcription language»** (`.ml-multi`, `data-tr-multi`) — целевой(ые) язык(и) готового транскрипта; **поиск по языкам** + **чекбоксы** (мультивыбор; выбранные — чипами в тоггле). Исходный язык модель определяет сама и при необходимости переводит — **отдельного селекта источника и опции `Auto-detect` больше нет**; отдельной опции «Translate transcription to» тоже нет (схлопнуто в один шаг/один выбор). Список `LANGS` = 9 языков; каждый выбранный = **отдельный транскрипт-файл**;
- капшн: «Pick the language(s) you want the transcript in — the model auto-detects the spoken language and translates as needed» + хинт «Each language is saved as a separate transcript in a folder named after your video, inside Transcriptions»;
- **Cancel** / **Start transcription** (чёрная primary). Кнопка **заблокирована, пока не выбран ни один язык** (`trSyncStart`). Без реальной логики.

**Бейдж + попап (топбар, `home.html`, `#jobsTranscribe`, скрыт по умолчанию):**
- Бейдж-пилюля — **два состояния** (как прод-конвертация «Converting» → «Converted»):
  - **идёт** (`activeJobs > 0`): **`⟳ Transcribing N`**, indigo (`--color-blue-20` фон + `--color-indigo` текст/иконка + счётчик в indigo-кружке), крутящаяся иконка. Цвет намеренно **не оранжевый**, чтобы отличать от конвертации.
  - **завершено** (активных нет, но карточки в списке, класс `.jobs.is-done`): **`✓ Transcribed`** — **та же indigo-пилюля**, меняется только иконка (спиннер → галочка), счётчик скрыт (цвет НЕ зелёный — по правке пользователя). Бейдж **не скрывается**, держится, пока есть карточки.
- Попап **«File transcription»** + **«Clear all»**; карточка задачи: шеврон (раскрывает под-строки) + имя видео + `just now` + статус **«Processing…»** (при завершении → зелёная галочка `.job__check` + серый крестик-dismiss `.job__dismiss`, убирающий карточку); общий прогресс-бар — компонент дизайн-системы **`BaseGradientProgressBar`** (трек `bg-shade-100` h-3px, бар `linear-gradient(purple-900 → transparent)`); строка **«N of M done · {язык +K}»** (M = число языков; вместо `MP4 › MP4` — язык).
- **Под-строки — по одной на каждый языковой файл** (как файлы в прод-конверсии): имя `<код>_<база>.srt` + бейдж языка + свой прогресс-бар; **при завершении** у каждой бар → галочка + кнопка **«Go to file ›»** (`.job__goto`), открывающая под-папку видео и превью **именно этого** `.srt` (`goToTranscriptFile` по `data-file`; подсветка строки `.ml-row--flash`).
- Мок-длительность `TRANSCRIBE_MS = 3800` (`js/media.js`). По завершении бейдж → зелёный «Transcribed». **Clear all** гасит таймеры активных задач и очищает список; крестик у карточки удаляет её. Когда карточек не осталось (Clear all / все dismissed) — бейдж скрывается.

**Нотификация о завершении** (обычный тип, `js/media.js` добавляет в список): заголовок **«Transcription ready»** + описание **«Transcription for {имя файла} is ready.»** + `just now` + **Dismiss** / **View**. Бейдж-счётчик на колокольчике инкрементируется. **View** открывает превью `.srt` напрямую (`openTranscript`), независимо от текущей папки (прямой слушатель на кнопке — nav.js гасит всплытие внутри панели).

**Результат — вложенные папки + `.srt` по языкам; вход через «Go to file» / «Review» (обновлено 2026-07-23):**
- Модалка результата по завершении **НЕ открывается автоматически**. Юзер заходит в неё через **клик по `.srt`-файлу**, **«Go to file»** в карточке задания или **«View»** в нотификации. («Review transcription» в `⋮` ведёт только в папку — см. ниже.)
- Папка **«Transcriptions»** в корне → под-папка с именем видео (id `tx-N`, реестр `folderInfo`) → по одному **`.srt` на язык**, имя `<код>_<база>.srt` (`eng_`, `ukr_`, …); первый — primary. Размер `4.2 KB`, категория `transcript`.
- **Модалка результата `#mlModal-transcript`** (открывается по клику на `.srt`-файл / «Go to file» / «View» в нотификации) — единый светлый паттерн (реплики с indigo-таймкодами, строка таймкода и текста выровнены по базовой линии); action-bar: **Copy** (`data-transcript-copy`, «Copied») · **Regenerate** · **Save as…** (`[data-dlas]` дропдаун) → **SRT / PDF / TXT**. `buildSrt(maxWords)`/`buildTxt`/`buildPdf` — реальные blob с верным MIME (PDF — минимальный валидный однослойный, ASCII-нормализация → корректный `/Length`). Regenerate/Save as… есть только в этой модалке.
- **Regenerate (обновлено):** запускает **реальный бейдж транскрибации в топбаре** («Transcribing 1») и по завершении (`TRANSCRIBE_MS`) **создаёт новую версию файла** в той же папке — `<root> (v2).srt`, `(v3)`… (счётчик по числу файлов серии; `startRegeneration`/`completeRegeneration`/`nextRegenName`), плюс job-карточка с «Go to file» и нотификация «Transcript regenerated». В самой модалке — краткий оверлей-отклик (~1.4 с). Т.е. это не просто локальная перерисовка, а полноценная перегенерация с артефактом.
- **«Save as → SRT»** открывает **отдельную модалку `#mlModal-srtwords` «Save as SRT»** (поверх модалки результата): степпер **Max words per segment** (`data-mw`, дефолт 8) + Cancel / **Export SRT**. Export → пост-форматирование готового транскрипта (сегменты ≤ N слов, в стиле TurboScribe) + загрузка `.srt`; модалка Max Words закрывается, модалка результата остаётся. PDF/TXT из «Save as…» скачиваются сразу (без модалки).
- **«Review transcription»** (`⋮` у транскрибированного видео, `openActions` по `transcribedFiles[name]`) — **ведёт только в под-папку видео, файл НЕ открывает** (`reviewTranscription` = `enterFolder` + подсветка primary-строки, без `openTranscript`). Модалку результата открывают клик по файлу / «Go to file» / «View». У прочих файлов пункт — «Transcribe».
- **Вложенная навигация** (крошки `renderCrumbs`/`folderInfo`) и счётчики — без изменений.

## Публичная страница получателя шаренной ссылки — `shared-file.html` (NET-NEW)

**В реальном продукте такой страницы НЕТ** (проверено в репозитории: шеринг там — внутренний, между залогиненными пользователями/по email, есть таб «Shared with me» внутри апки, но публичного гостевого лендинга по ссылке нет). Это чистый net-new — ориентир на общий визуальный язык апки. Одна страница: как выглядит открытая ссылка на файл человеком **без аккаунта**.

- **Лёгкий брендированный шелл** (без сайдбара/меню): только **лого SubSub** слева + чёрная пилюля **«Sign up free»** справа (`rounded-full`, как публичные CTA прода).
- **Атрибуция**: «Shared by **[аватар] Yevhenii Zemskov** from GenTech».
- **Карточка превью — отдельный HTML-файл на каждый тип** (шелл/атрибуция/промо общие, меняется только центральная карточка). Раньше был один `shared-file.html` с переключением `?type=` инлайн-скриптом; теперь **разнесено на файлы** (по одному типу на страницу, без `?type=`-скрипта):
  - `shared-file-video.html` — светлая шапка превьюера (badge + имя + Download) + кастомный видеоплеер (`js/player.js`, окно по соотношению сторон видео).
  - `shared-file-audio.html` — светлая шапка + арт-кружок с нотой + нативный `<audio controls>` (`podcast-episode-04.wav`).
  - `shared-file-pdf.html` — светлая шапка + нативная читалка `<iframe src=portfolio.pdf>`.
  - `shared-file-spreadsheet.html` — светлая шапка + статичная сетка `.ml-sheet` (браузер xlsx не рендерит).
  - `shared-file-archive.html` — **без превью**: иконка файла + имя + «No preview available · размер» + Download.
  - Старый `shared-file.html` (с `?type=`) оставлен как есть для обратной совместимости; ни на что в прототипе не ссылается.
- **Кнопка Download — фиолетовая** (`.pub-download`, `background: var(--color-purple-900)` = `#b351f6`). Осознанное разовое исключение: в реальной системе у BaseButton такого мода нет (primary — чёрный).
- **Промо-баннер** внизу: чёрный `rounded`, «Want your own creator tools? Get started with SubSub for free» + белая кнопка **«Sign up»**.
- Подключают только `css/tokens.css`, `css/styles.css` (+ `js/player.js` в video-версии; без nav.js/media.js). Классы `.pub-*`.

## Home (`https://app.subsub.io/home`) — полный реальный текст

Источник: `layers/core/i18n/locales/en/home.overview.ts` + `apps/app.subsub/app/pages/home/components/*.vue`.

### Баннер
- Заголовок: **"Welcome to SubSub!"**
- Подзаголовок: **"Your all-in-one hub for creators to grow, monetize, and protect"**

### Секция "Digital products" (6 карточек, каждая: иконка+заголовок, описание, 2–3 пункта с чекмарком, кнопка)

1. **Analytics** — "Know your numbers before your competitors do." / "2M+ channels: benchmark yourself against anyone in your niche" · "Spot trends and content ideas that actually perform" · "One dashboard for all your channels, reports in one click" / кнопка **"Get Data & Insights"**
2. **Live** — "Stream 24/7 — your channel grows while you sleep." / "Monetize your video library through non-stop live streams" · "Automate your schedule and forget about manual launches" / кнопка **"Try for Free"**
3. **Fan Funding** — "Let your audience pay you directly — no middlemen." / "Just 5% service fee — one of the lowest on the market" · "Build community beyond YouTube: subscriptions, donations, exclusives" · "New revenue streams that don't depend on the algorithm" / кнопка **"Try for Free"**
4. **Wallet** — "All your money in one place. Withdraw whenever you want." / "Banks, cards, e-wallets, crypto — pick what works for you" · "Track your cash flow in real time" · "Access lending and early payouts" / кнопка **"Explore Features"**
5. **Content Export** — "Your content, understood in every country." / "Professional dubbing and editing by our team" · "Reach new audiences without learning new languages" · "Monetize in regions where no one knows you yet" / кнопка **"Learn More"**
6. **Media Library** — "Upload once — earn on repeat." / "Auto-generated transcripts, timecodes, titles, tags" · "Turn old content into new formats and publications" · "Every report and generation saved in your library" / кнопка **"Try Now"**

Картинки для каждой карточки — `apps/app.subsub/app/assets/images/overviews/home/home-<product>-desktop-x1.webp` (и x2/mobile-варианты) — скопировать нужные при сборке этой секции.

### Секция "SubSub Network services" (карточки, часть с бейджем "Network member")

1. **Channel Security** (бейдж) — "Protect your channel from hijacking — before it's too late." / **"Learn More"**
2. **YouTube Experts — Direct Support** (бейдж) — "A direct line to YouTube when standard support goes silent." / **"Learn More"**
3. **Geo-Blocking** (бейдж) — "Decide where your content is available — and where it isn't." / **"Learn More"**
4. **Multi-Language Audio** (бейдж) — "Add voiceover in your viewer's native language — YouTube handles the rest." / **"Learn More"**
5. **SubSub Expert Consultation** (без бейджа) — "1-on-1 with someone who's worked inside YouTube for 10+ years." / **"Apply"**
6. **Content ID** (без бейджа) — "Someone used your content? You get the money — not them." / **"Apply"**
7. **Troubleshooting** (без бейджа) — "Strike, claim, demonetization — we know how to fix it." / **"Apply"**

Текст бейджа: **"Network member"**, тултип: "You are a SubSub Network member — you receive privileged services, enhanced security, and support from YouTube specialists."

### FAQ (10 вопросов, `<details>/<summary>` — аккордеон без JS)

1. **How much does SubSub cost? Is there a free tier?** — "Registration and basic tools are free. Individual products have their own pricing, visible before you activate anything. No hidden fees, no billing surprises."
2. **Is this an MCN? Am I signing a contract and losing control of my channel?** — "No. SubSub is a tools platform, not a traditional MCN. You don't transfer channel rights or sign an exclusive contract. Want to leave? Walk away anytime with no penalties."
3. **Is it safe to connect my YouTube channel?** — "Yes. We use the official YouTube API and never ask for your Google account password. SubSub is YouTube-certified. You can revoke access in your Google settings at any time."
4. **Will SubSub affect my AdSense or YouTube monetization?** — "No. SubSub works alongside YouTube and doesn't touch your AdSense revenue. We don't take a cut from it. Fan Funding, Content ID, and other services are additional income streams on top of what you already earn."
5. **I have a small channel. Is this for me?** — "Yes. Analytics, Live, Media Library, and other tools are available with no channel size restrictions. Some Network services (Content ID, YouTube experts) have minimum requirements — you'll see them on each service page."
6. **I manage multiple channels / I'm an agency. Is there multi-channel access?** — "Yes. You can add multiple channels to one account and switch between them. For agencies and media companies, we offer Organizations with roles, team analytics, and a shared wallet."
7. **How fast do I get my money?** — "Withdrawals are available daily. Bank, card, e-wallet, crypto — pick your method. Funds arrive within minutes to 3 business days depending on the option."
8. **How is SubSub different from other creator platforms?** — "We're not just one tool — we combine analytics, streaming, funding, media library, localization, protection, and finances into a single ecosystem. You don't need 7 separate services — everything works together under one roof."
9. **I'm already in another MCN. Can I still use SubSub?** — "Yes, most SubSub tools work regardless of your MCN status. Some Network services may have limitations — reach out to support and we'll advise what's available for your situation."
10. **How do I contact support?** — "Message us in the on-site chat, at creators@subsub.io, or on Telegram @subsub_admin — we respond within hours. Network members get priority 24/7 support."

## Live → Overview (`https://app.subsub.io/live`) — частично собрано

Источник: `apps/app.subsub/app/pages/live/index.vue` + `layers/core/i18n/locales/en/live.ts` (ключ `liveOverview`).

- Баннер: заголовок **"Your content never stop working"**, подзаголовок **"Turn your existing catalog into a 24/7 live streaming channel. Your videos earn views, watch hours, and revenue — around the clock"**, кнопки **"Create new stream"** / **"Create free stream"**.
- Далее на странице (компоненты, текст не до конца собран — нужно доснять с прода при сборке этой страницы): `LaunchSection`, `LiveCostSection` (калькулятор, `id="calculator"`), `CustomTermsSection` (заголовок **"Running streams at scale? Let's build your custom plan"**), `FaqSection` (10 вопросов, ключи `liveOverview.faq.q1..q10` — брать текст из `live.ts` при сборке).

## Live → Streams (`https://app.subsub.io/live/streams`) — СОБРАНО (`live-streams.html`)

Собирается `build/build-livestreams.js` из шелла `home.html` (space Live = `data-space="streams"` активен, submenu «Live» → Overview/Streams, пункт **Streams** = current → `live-streams.html`). Интерактив — `js/livestreams.js` (косметика: тоггл стрелки сортировки). Классы `.ls-*`. Источник правды — `apps/app.subsub/app/pages/live/streams/index.vue` + таблица `useTableColumns.ts` + i18n `live.ts`/`index.ts`.

- **Заголовок** «Streams» + кнопки **«(((•))) New stream»** (чёрная primary, иконка stream) и **«Top up balance»** (secondary, иконка кредитки).
- **Тулбар** (справа): **Search** (`Search...`) + **Export** (иконка save/download) + **Filters** (иконка filter). *(Кнопка Columns в проде закомментирована — не переносим.)*
- **Счётчик** «Streams • N» + **пагинация** справа: ‹ [1] › + per-page «10 ⌄».
- **Таблица** (`.ls-table`, горизонтальный скролл; **ACTIONS закреплён справа**). Заголовки — UPPERCASE через CSS (в i18n они строчные). Колонки (desktop, не-орг контекст): **Video** (thumb+play+размер, имя, платформа, ключ 9 симв.+4 точки) · **Status** · **Channel** (аватар+имя+On/Off) · **Cost** · **Spent** · **Rev** · **Start** · **End** · **Duration** · **Active users** · **Views** · **Likes** · **Comments** · **Actions**. Сортируемые (со стрелками): video, status, channel, rev, duration, active users, views, likes, comments. Сверху — строка **«Totals ⌄»** (агрегаты по числовым, «—» по остальным).
- **Статус-бейджи** (`.ls-status--{gray|green|orange|red}`, по `StreamStatus.vue`): live/conversion_failed=red, created/ready=green, stopped/archived=gray, processing/downloading/preparing/scheduled/starting/stopping/needs_conversion/converting=orange. Тексты: Live/Created/Processing/Downloading/Ready/Preparing/Scheduled/Starting/Stopping/Stopped/Needs conversion/Converting/Conversion failed.
- **Actions** (`ActionsCell.vue`): для play-able статусов — Start/Stop (в прототипе: Live→Stop, ready/created→Start), затем icon-кнопки analytics (chart) + delete (trash).
- **Данные-примеры** (5 строк): первая — реальная с прода (**Forza Motorsport Chill Ride**, Stopped, Zems Racing, `$0.02/h`, 09.07.2026 12:30, 00:05:07); остальные добавлены для демонстрации статусов (Live/Scheduled/Converting/Ready) — это демо-значения, не персональные данные. Панель фильтров (side) в прототип не переносилась.

### Live → Streams → New stream (`/live/streams/create`) — СОБРАНО (`live-stream-create.html`)

Собирается тем же `build/build-livestreams.js` (общий хелпер `buildPage`, шелл Live, submenu Streams=current). Открывается по кнопке **«New stream»** со страницы Streams; **← Back** и **Create stream** ведут назад на `live-streams.html`. Источник — `pages/live/streams/create/index.vue` + `components/StreamForm.vue` + i18n `live.ts`. Классы `.lsc-*`.

- **← Back** (в список стримов) + заголовок **«New stream»** + текст-кнопка **«🚀 Launch tutorial»** (`tertiary`).
- **Жёлтый bonus-баннер** (`BaseAlert mode=attention`): «You can set up your first stream with **$0.50** in bonus funds… This stream will last for 2 hours after you start…» (иконка `FilledIconAttention`, `{bonus}` = `$0.50`).
- **Форма** (`StreamForm.vue`, вертикальные поля, gap 24–32):
  - **Platform** — селект-дропдаун (красная YT-иконка + «YouTube» + шеврон).
  - **Stream link** — input, placeholder `https://youtube.com/live/....`.
  - **Stream key** — input, placeholder `e.g. abcd-1234-efgh-5678`.
  - **Start date (optional)** + **Start time (optional)** и **End date (optional)** + **End time (optional)** — 2×2 сетка (у date-инпутов иконка календаря; time-инпуты приглушены/заблокированы до выбора даты).
  - **Videos** — empty-state (`form.uploadFile`): иконка «хлопушка» + **«No videos»** + «Build a broadcast queue by selecting a single video or a full playlist to stream in a continuous sequence» + кнопка **«⬆ Choose video file»**.
  - **Create stream** — чёрная кнопка справа внизу (`form.createBtn`).
- Мок (без бэкенда): поля/дропдаун/выбор файла — статичные; submit не отправляет (`onsubmit=return false`). Не переносились: медиа-диалог выбора файлов, состояние с загруженными видео + прайс-саммари, конверсия/auto-start, low-balance-баннеры.

## Что ещё не собрано (нужно доснять с прода при сборке соответствующих страниц)

Analytics, Fan Funding (кроме того что на Home), Wallet (кроме баланса "$1,340.30" замеченного один раз), Network (кроме карточек на Home), Media Library, Content Export, Admin — для всех этих разделов ничего, кроме заголовка/иконки, не подтверждено. Собирать по методологии из `01-source-of-truth-and-workflow.md`, по одному разделу за раз.

## Analytics → Reports (`analytics-reports.html`)

Прод: `/analytics/reports/market` и `/analytics/reports/performance`. Пункт `Reports` в саб-панели Analytics — рабочий, остальные пункты остаются статичными.

- **Шапка:** `Reports` + чёрная кнопка `Create report` (иконка «+»).
- **Баннер** (синий, иконка info, крестик): «All saved reports are also available in Media Library — find them there for easy access and download.» Закрытие запоминается (`subsub_rep_note`).
- **Табы:** `Market insights` (отчёты по коллекциям) и `My performance` (по своим каналам), у каждого своя таблица; активный таб в `?tab=market|performance`.
- **Таблица Market insights:** `NAME · CREATED · PERIOD · COLLECTION · TYPE · STATUS · ACTIONS`. `TYPE` — просто текст `Basic`/`Deep`, без пилюли. Затравка: `Crypto Report 2026 July / 13.07.2026 / July 2026 - July 2026 / Crypto / Basic / ✓ Created`.
- **Таблица My performance:** `NAME · CREATED · PERIOD · CHANNEL · STATUS · ACTIONS` — колонки `TYPE` здесь нет (на проде так же, хотя тип запрашивается при создании; несоответствие повторено осознанно). Затравка: `Eugene Zemskov / 07.08.2026 / January 2026 - August 2026 / Zems Racing / ⧖ In progress`.
- **Статусы:** `In progress` — оранжевая пилюля с иконкой, `Created` — зелёная с галочкой (те же пилюли, что у статусов коллекций).
- **Actions:** `Download` (заглушка + тост), «показать в Media Library» (папка; для `In progress` заблокирована — файла ещё нет), `Delete` (красная, с подтверждением).
- **Пагинация** под таблицей — обычная: `‹ [1] ›` + размер страницы (по умолчанию 30), без инфинайт-скролла.
- **Модалка `New report`:** `Select report type` (дропдаун, у каждой опции «i» с тултипом — `Basic report`: «Includes basic metrics like subs, subs+ views, views+», `Deep report`: «Includes basic metrics plus extended metrics (VIDS, PVN, PVC etc.)»), `Report name` (обязательное), `Collection` (на табе My performance — `Channel`) с поиском, `Period` — заблокирован до выбора коллекции/канала.
- **Календарь периода:** слева быстрый переход по месяцам двух лет, справа сетка дней с выбором диапазона (первый клик — начало, второй — конец), снизу строка «The 1st channel in this collection was added on 19.05.2023. Therefore growth period is available by year and month starting from 19.05.2023.» и кнопки `Clear` / `Apply`. После Apply поле показывает `DD.MM.YYYY - DD.MM.YYYY`. `Create report` активна только когда заполнено всё.
- **После создания:** модалка закрывается, строка добавляется со статусом `In progress`, через 4 с статус меняется на `Created`, появляется карточка-уведомление `Report ready` с `Dismiss` / `View`.
- **Media Library:** ровно в момент перехода в `Created` в папке `Analytics` появляется файл `<slug>-<basic|deep>-report-<n>.xlsx` (категория spreadsheet). Мост односторонний: аналитика пишет запись в `subsub_ml_files`, `js/media.js` дорисовывает строку при загрузке. `View` и иконка папки ведут на `media-library-files.html?folder=analytics&file=<имя>` — папка открывается сразу, строка подсвечивается.

## Страница коллекции (`analytics-collection-edit.html`) — обновлено

Страница перестала быть «одной большой формой с сохранением»: имя правится в модалке, всё остальное — мгновенные действия с автосохранением.

- **H1 — имя коллекции** (как имя канала на странице канала), рядом бейдж `AI collection` у коллекций автоподбора. Поля `Name collection` в теле страницы больше нет.
- **Тулбар в шапке:** `Add channels` (чёрная) · `Shared with N` (открывает попап шеринга) · `⋮`.
- **`⋮`-меню:** `Rename collection` — разделитель — `Deactivate` · `Delete` (красный, внизу).
  - `Rename collection` → модалка `Rename collection`: поле с текущим именем + `Cancel` / `Save`.
  - `Deactivate` и `Delete` → подтверждения (`Deactivate collection?` / `Delete collection?` с текстом «This action cannot be undone»).
- **Попап `Shared with`** — композиция как в шеринге Media Library, но без строки «Anyone with the link» (у коллекций нет публичной ссылки): поиск участников организации с подсказками (аватар + имя + email, `Already added` у уже добавленных), кнопка `Invite` для email вне организации, список доступа (аватар, имя, email, `owner` у владельца, `Revoke` у остальных с подтверждением `Remove {имя}?`).
- **Автосохранение:** после каждого действия (rename, add/remove channel, share/revoke) — тост `Changes saved automatically`. Общей кнопки сохранения нет.
- **Удаление канала из строки** — подтверждение `Remove {channel} from collection?` (`Cancel` / `Remove`), затем тост об удалении и автосохранении.
- **Выбор чекбоксами** — контекстная плашка снизу: `N selected` + `Remove selected` (то же подтверждение, что у одиночного удаления).
- **Колонка `LINK`** — текстовая ссылка `View channel` на страницу канала (`analytics-channel.html`). Внешняя ссылка на YouTube осталась вторичной строкой под именем канала в колонке `CHANNEL` вместе с иконкой копирования.
- **Поиск `Search by channel title, link`** — фильтр по уже добавленным каналам (добавление — только через `Add channels`), при нулевом результате пустое состояние `No channels found`.
- Блок `Sourcing query` / `Applied filters` у коллекций автоподбора — без изменений.

## My collections — действия в строке (обновлено)

- В строке коллекции две иконки: **Share** и **`⋮`**. Share вынесен из меню и открывает тот же попап шеринга, что кнопка `Share` на странице коллекции (поиск участников организации с подсказками, инвайт по email, список доступа с email, `owner` и `Revoke`); заголовок попапа — `Share «{название}»`.
- **`⋮`-меню** сгруппировано разделителями, как меню файла в Media Library:
  1. `View collection` · `View deep data`
  2. `Edit collection` · `Duplicate collection`
  3. `Deactivate collection` · `Delete collection` (красный)
- Видимость пунктов по состоянию строки не изменилась: `View deep data` и `Deactivate collection` — только у активированной коллекции; у чужой (владелец `SubSub`) остаются просмотр и `Duplicate collection` плюс подсказка «You cannot edit this collection…». Разделитель перед деструктивной группой скрывается, если группа пуста.
- Иконки пунктов те же, что были.

## Страница коллекции — плашка выбора (обновлено)

- Кнопка шеринга в шапке подписана просто `Share` (количество видно в самом попапе), кнопка `⋮` — квадратная 40×40.
- В плашке выбора каналов: `N selected` · `Create new collection` · `Find similar channels` · `Remove selected`.
  - `Create new collection` открывает обычную модалку создания с подставленным именем по первому выбранному каналу; новая коллекция создаётся сразу с выбранными каналами (тост с количеством + автосохранение).
  - `Find similar channels` открывает модалку sourcing в режиме референсов с выбранными каналами (тот же вход, что из футера Basic data).

## Меню коллекции и модалка Add channels (обновлено)

- **`⋮` на странице коллекции** — тот же набор, что в строке списка, без пунктов, которые на этой странице не нужны (`View collection`, `Share` — он отдельной кнопкой):
  1. `View deep data`
  2. `Rename collection` · `Duplicate collection`
  3. `Deactivate collection` · `Delete collection` (красный)
  - `Duplicate collection` создаёт `{название} (copy)` с теми же каналами и тостом `Collection duplicated as «…»`.
- **В строке My collections** пункт называется `Rename collection` (не `Edit collection`): правится только имя, поэтому открывается модалка `Rename collection` с текущим именем и кнопкой `Save`, а не переход на страницу коллекции. Переименование меняет имя в строке и в состоянии, тост — `Collection renamed`.
- **Модалка `Add channels` / `New channels`:**
  - в списках мультивыбора (`Find in base`, `Add to collection`) — обычные чекбоксы DS вместо иконок-закладок;
  - футер как в остальных модалках: `Cancel` + основная кнопка, слева счётчик `Selected: N` (только на вкладке `Find in base` — у `Paste links` свой счётчик `One-time addition of channels: N/30`);
  - заголовок на странице коллекции — `Add channels to {название}`.

## Reports — иконки, статус и ширина колонок (обновлено)

- **Действия в строке** — прод-иконки (`ActionsCell.vue`): `OutlineIconSave` (скачать), `OutlineFolderIcon` (показать в Media Library), `OutlineIconDelete` (удалить, красная). Пока репорт `In progress`, все три неактивны — как в проде.
- **Бейдж статуса** — `BaseStatus` mode green/orange: 32px, скругление полное, текст 14px medium, иконка в квадрате 16×16.
- **Колонки** обеих таблиц (`Market insights`, `My performance`) ужимаются по содержимому и добирают ширину страницы; горизонтальный скролл появляется только когда содержимое реально не влезает (узкое окно).

## Add channels — подписчики бейджем

- В списке `Find in base` число подписчиков — мелкий серый бейдж (`BaseStatus` size sm, 24px), а не второй текст в строке.

## Add channels — три входа (обновлено)

- Переключатель входов — сегмент, как табы в Media Library (серая дорожка, активный — белая плашка).
- **`Paste links`** и **`Find in base`** — без изменений.
- **`Expand with AI`** (только на странице коллекции) — расширение коллекции ИИ-поиском:
  - плашка-подсказка: промпт собран из этой коллекции;
  - `Describe the channels you're looking for` — промпт уже заполнен по текущему состоянию коллекции (первые каналы + сколько ещё + исходная заявка sourcing, если она была), рядом `Rebuild from collection` (пересобирает с короткой паузой «Reading the collection…»);
  - `Reference channels N` — чипы каналов коллекции (первые 8 + `+N more`), пояснение, что уже добавленные каналы в результатах пропускаются;
  - `Advanced filters` — те же числовые фильтры, что в модалке AI-коллекции (min subs / videos / total views / avg views / max days since last video);
  - основная кнопка становится `Start AI search` и запускает обычную очередь sourcing в режиме «дописать в коллекцию»: тост `AI search started…`, пилюля `Sourcing channels…` в топбаре, по завершении каналы дописываются в коллекцию (открытая страница дорисовывает строки сама).

## Reports — таблица (обновлено)

- Иконки действий 20px — как действия в строке My collections.
- Имя репорта — medium 500; коллекция — ссылка на страницу коллекции.
- Все текстовые колонки добирают ширину страницы, колонка `Actions` остаётся по содержимому; если ширины не хватает, ужимаются только текстовые колонки (`Name`, `Period`, `Collection`) с обрезкой многоточием — дата, тип и статус не обрезаются, горизонтального скролла нет.
- Затравка: 6 репортов в `Market insights` (последний — `In progress`) и 5 в `My performance`; счётчик в строке пагинации считает строки.

## Расшаренная коллекция — выход

- В строке чужой коллекции (владелец не «You») из управляющих пунктов остаётся `Duplicate collection`, а вместо деструктивных пунктов владельца появляется `Leave collection` (красный). Просмотр (`View collection`, `View deep data`) и подсказка «You cannot edit this collection…» остаются.
- `Leave collection` спрашивает подтверждение `Leave collection?` — «You will lose access to «{название}». The owner can invite you again.» (`Cancel` / `Leave`). После выхода строка исчезает из списка, счётчики в сегменте пересчитываются, тост `You left «…»`.
- Страница коллекции узнаёт о чужой коллекции по `shared=1` в ссылке (её проставляет переход из строки списка): в `⋮` остаются `View deep data`, `Duplicate collection` и `Leave collection`, пункты владельца скрыты. После подтверждения выхода — тост и возврат к списку коллекций.

## Add channels — геометрия и порядок табов (обновлено)

- Порядок сегментов: **`Expand with AI`** (первый, на нём модалка и открывается на странице коллекции) · `Paste links` · `Find in base`. В модалке Basic data ИИ-сегмента нет.
- Размеры взяты из модалки AI collection: шапка `32/32/20` с разделителем и заголовком 32px semibold, тело `24/32/32` с шагом 24, футер `20/32`, кнопки `huge` (`Cancel` — plain, основная — чёрная), лейблы полей 14px medium, описание 16px light с минимальной высотой 96px.

## Страница коллекции — колонка LINK (обновлено)

- Колонка `LINK` снова содержит настоящую ссылку на канал (`youtube.com/@handle`, открывается в новой вкладке) и кнопку копирования — вторичной строки под именем канала больше нет.
- Переход на страницу канала теперь по самому имени канала (`analytics-channel.html?name=…`), подчёркивание по ховеру.
- Поиск в коллекции ищет и по имени, и по ссылке.

## Страница коллекции — колонка топиков

- После `CHANNEL` добавлена колонка `YOUTUBE TOPICS` — те же баджи, что в Basic data: первый топик и `+N` с поповером остальных.
- Колонки: чекбокс 40, канал (тянется, минимум 180), топики 150, Views 110, Subs 110, Link 220, корзина 60 — таблица влезает в серфейс без горизонтального скролла.
- В панели `Expand with AI` больше воздуха между блоками (28px) и нет разделителя перед `Advanced filters`.

## Страница коллекции — лимит, дата добавления, сортировка (обновлено)

- Под названием коллекции — блок лимита: `Channels in collection — N of 30`, полоса заполнения (зелёная, красная при 100%). При достижении лимита появляется плашка `Collection limit reached` с кнопкой `Upgrade plan`, а `Add channels` становится неактивной. Догрузка каналов при скролле тоже упирается в лимит; удаление канала снова освобождает место.
- Порядок колонок: чекбокс · `CHANNEL` · `YOUTUBE TOPICS` · `SUBS` · `VIEWS` · `LINK` · `ADDED` · корзина — как в Basic data (метрики после топиков, дата последней).
- `ADDED` — дата попадания канала в коллекцию; у каналов, добавленных вручную, ставится сегодняшняя.
- Сортировка по `SUBS`, `VIEWS` и `ADDED`: первый клик — по убыванию, активная колонка подсвечивается фиолетовым со стрелкой направления. Догруженные строки встают в текущий порядок.
- Блок `Sourcing query / Applied filters` и бейдж `AI collection` со страницы убраны.

## Reports — модалка нового отчёта (обновлено)

- Поля: `Select report type` · `Collection`/`Channel` · `Period`, все одного размера (48px).
- Типы отчёта: `Basic report` · `Deep report` · `Videos report` (per-video метрики).
- Поля `Report name` больше нет: имя складывается из выбранного и показывается перед созданием — `{коллекция/канал} — {Basic|Deep|Videos} report, {период}` (период месяцами: `July 2026`, `January – June 2026`).
- `Period` открывает тот же календарь, что на страницах данных (пресеты + два месяца + поля from/to + `Cancel`/`Apply`). Модалка шире (760px), поповер раскрывается вверх, чтобы календарь целиком влезал в экран.

## Страница коллекции (обновлено)

- Шапка: `H1` + серый серфейс с лимитом (`14 of 30 channels`, полоса, светло-фиолетовая кнопка `Upgrade` с ракетой) в одну строку; под названием — владелец (`Owner · You` / имя владельца из ссылки).
- Кнопки: `Add channels` · `View deep data` (вынесена из `⋮`) · `Share` · `⋮`.
- `⋮`-меню оформлено как меню строки в списке коллекций; у своей коллекции `Rename` / `Duplicate` / `Deactivate` / `Delete`, у расшаренной — `Duplicate` / `Leave collection`.
- Порядок колонок: `CHANNEL` · `ADDED` · `SUBS` · `VIEWS` · `LINK` · `YOUTUBE TOPICS` · корзина. По умолчанию таблица отсортирована по `ADDED`, свежие сверху.
- Попап шеринга совпадает по размерам с шерингом Media Library (заголовок 17/600, поле и `Invite` 44px, аватары 34px, `Revoke` с красным ховером).

## My collections — действия в строке (обновлено)

- У неактивированной своей коллекции в `⋮` появился `Activate deep data` — то же подтверждение, что по ссылке в статусе.
- У расшаренной коллекции: `View collection` · `View deep data` · `Duplicate collection` · `Leave collection`; пункты владельца скрыты.

## Reports — действия в строке и сортировка (обновлено)

- В строке остаются иконки `Download` и `Show in Media Library`, остальное — под `⋮` (меню как у файла в Media Library): `Share` · `Copy file link` — `Create similar report` — `Delete report` (красный). Пока отчёт `In progress`, все три кнопки неактивны.
  - `Share` уводит к файлу в Media Library и сразу открывает его шеринг (`?folder=analytics&share=1&file=…`) — у отчётов нет своего шеринга, файл живёт в библиотеке.
  - `Create similar report` открывает модалку с тем же типом и коллекцией/каналом, период выбирается заново.
- Строки и отступы как в таблице коллекций (56px, первая ячейка 16px), бейджи статусов того же размера.
- Сортировка по статусу — по смыслу, а не по алфавиту: сверху то, что в работе (`Collecting data` / `In progress` / `Sourcing…`), затем `Activated`, `Created`, `Inactive`.

## Меню и клики в таблицах (обновлено)

- Меню действий (`⋮`) в Analytics — по метрикам меню файла в Media Library: 210px, паддинг 12/8, рамка 1px, скругление 12, пункты 8/12 со скруглением 8.
- Иконка `Deactivate collection` — перечёркнутый круг (`OutlineIconOff`) вместо архивной коробки.
- В списке коллекций клик по любому месту ячейки названия открывает страницу коллекции; подчёркивания на ховере нет.
- У ссылок в бейджах статуса (`View deep data` / `Activate deep data`) подчёркивание снимается при наведении на всю пилюлю, а не только на текст.

## Reports — табы (обновлено)

- Табы `Market insights` / `My performance` стали сегментом того же размера, что переключатель типа в My collections, и переехали в шапку рядом с заголовком.
- У каждого таба бейдж с числом отчётов; число пересчитывается при создании и удалении отчёта.

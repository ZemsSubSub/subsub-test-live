// Сборка страниц Analytics из шелла home.html (space=analytics, сабменю Analytics).
// Первая страница — Basic data (по образцу build-livestreams.js). Данные — примеры с прода.
const fs = require("fs");
const DIR = "E:/Dev SubSub/subsub_front_prototype_31.07.26/";
let html = fs.readFileSync(DIR + "home.html", "utf8");

function esc(s){ return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

// ---- AI-коллекция (глубокий автоподбор) ----------------------------------------
// РАБОЧЕЕ НАЗВАНИЕ действия — правится в одном месте (кнопка + бейдж в представлении).
// Единый нарратив фичи — «sourcing» (мы находим и собираем каналы), результат — AI collection.
// Слова Research / Processing data здесь не используем; тексты Deep Data — это ДРУГОЙ флоу, их не трогаем.
const AI_LABEL = "AI collection";        // кнопка на Basic data / My collections
const AI_BADGE = "AI collection";        // бейдж в представлении коллекции (результат)
const AI_MODAL_TITLE = "Set up collection sourcing";
const AI_MODAL_SUB = "Describe the channels you want — we'll find and collect them for you.";
const AI_SUBMIT_LABEL = "Start sourcing";

// ---- иконки (inline SVG, стиль дизайн-системы) ----
const IC = {
  // OutlineAiIconSearch — режим «AI semantic search» (градиент), viewBox 20
  aiSearch: '<svg viewBox="0 0 20 20" fill="none"><path d="M12.6942 2.0786C12.8359 1.38525 13.8269 1.38527 13.9686 2.0786C14.2036 3.22868 15.1028 4.12706 16.2529 4.36213C16.9459 4.50402 16.9458 5.49458 16.2529 5.63654C15.1028 5.87161 14.2036 6.77081 13.9686 7.92089C13.8266 8.61378 12.8361 8.61383 12.6942 7.92089C12.4591 6.77081 11.5607 5.87161 10.4106 5.63654C9.71728 5.49483 9.7173 4.50384 10.4106 4.36213C11.5606 4.12704 12.4591 3.22861 12.6942 2.0786ZM13.3314 3.76398C13.0112 4.25803 12.5901 4.67915 12.096 4.99934C12.59 5.31947 13.0112 5.7407 13.3314 6.23469C13.6515 5.74072 14.0728 5.31949 14.5667 4.99934C14.0727 4.67913 13.6515 4.25802 13.3314 3.76398Z" fill="url(#aiS0)"/><path d="M10.1813 8.23039C10.2334 7.97529 10.5979 7.97529 10.6501 8.23039C10.7652 8.7938 11.2055 9.2341 11.7689 9.34926C12.024 9.4014 12.024 9.76589 11.7689 9.81803C11.2055 9.93319 10.7652 10.3735 10.6501 10.9369C10.5979 11.192 10.2334 11.192 10.1813 10.9369C10.0661 10.3735 9.62583 9.93319 9.06242 9.81803C8.80732 9.76589 8.80732 9.4014 9.06242 9.34926C9.62583 9.2341 10.0661 8.7938 10.1813 8.23039Z" fill="url(#aiS1)"/><path d="M4.20229 4.20494C5.57202 2.83521 7.35293 2.12356 9.14708 2.07177C9.49212 2.06181 9.7799 2.33383 9.78986 2.67886C9.79974 3.02383 9.52775 3.31168 9.18276 3.32163C7.69493 3.36468 6.22136 3.95363 5.08617 5.08882C2.72719 7.44819 2.7271 11.2737 5.08617 13.633C7.4456 15.9923 11.2716 15.9918 13.631 13.6325C14.8551 12.4082 15.4438 10.7905 15.3976 9.18542C15.3876 8.84053 15.6593 8.55226 16.0041 8.54207C16.349 8.53211 16.6368 8.80424 16.6469 9.14916C16.697 10.8888 16.1249 12.6426 14.9355 14.0531L17.4605 16.5793C17.7044 16.8234 17.7046 17.2192 17.4605 17.4632C17.2165 17.7069 16.8206 17.707 16.5767 17.4632L14.0516 14.9381C11.1868 17.3541 6.90139 17.2147 4.20286 14.5163C1.35564 11.6689 1.35515 7.05246 4.20229 4.20494Z" fill="url(#aiS2)"/><defs><linearGradient id="aiS0" x1="10.1774" y1="3.27909" x2="15.9543" y2="3.65889" gradientUnits="userSpaceOnUse"><stop stop-color="#F567FF"/><stop offset="0.403337" stop-color="#B351F6"/><stop offset="0.889423" stop-color="#5951F6"/></linearGradient><linearGradient id="aiS1" x1="8.99981" y1="8.81135" x2="11.5929" y2="8.98184" gradientUnits="userSpaceOnUse"><stop stop-color="#F567FF"/><stop offset="0.403337" stop-color="#B351F6"/><stop offset="0.889423" stop-color="#5951F6"/></linearGradient><linearGradient id="aiS2" x1="2.73753" y1="12.2988" x2="10.6718" y2="5.04437" gradientUnits="userSpaceOnUse"><stop stop-color="#F567FF"/><stop offset="0.403337" stop-color="#B351F6"/><stop offset="0.889423" stop-color="#5951F6"/></linearGradient></defs></svg>',
  // FilledAiStarsIcon — опция «AI semantic search» (градиент), viewBox 16
  aiStars: '<svg viewBox="0 0 16 16" fill="none"><path d="M6.65952 6.11513L7.24284 4.07484C7.46142 3.31113 8.54378 3.31113 8.76236 4.07484L9.34502 6.11513C9.38191 6.2442 9.45108 6.36173 9.54599 6.45665C9.64091 6.55157 9.75845 6.62074 9.88751 6.65763L11.9278 7.24029C12.6915 7.45887 12.6915 8.54123 11.9278 8.75981L9.88751 9.34246C9.75845 9.37935 9.64091 9.44852 9.54599 9.54344C9.45108 9.63836 9.38191 9.7559 9.34502 9.88496L8.76236 11.9253C8.54378 12.689 7.46142 12.689 7.24284 11.9253L6.66018 9.88496C6.62329 9.7559 6.55412 9.63836 6.4592 9.54344C6.36429 9.44852 6.24675 9.37935 6.11768 9.34246L4.07739 8.75981C3.31368 8.54123 3.31368 7.45887 4.07739 7.24029L6.11768 6.65763C6.24675 6.62074 6.36429 6.55157 6.4592 6.45665C6.55412 6.36173 6.62329 6.2442 6.66018 6.11513M12.0213 10.9673C12.2116 10.4123 13.0115 10.4117 13.2011 10.9673L13.2182 11.0246L13.4131 11.8067L14.1952 12.0023C14.8273 12.1603 14.8273 13.057 14.1952 13.215L13.4131 13.4105L13.2182 14.1927C13.0602 14.8241 12.1628 14.8241 12.0048 14.1927L11.8093 13.4105L11.0272 13.215C10.3951 13.057 10.3951 12.1596 11.0272 12.0023L11.8093 11.8067L12.0048 11.0246L12.0213 10.9673ZM12.6112 12.475C12.5733 12.5257 12.5283 12.5708 12.4775 12.6086C12.5283 12.6465 12.5733 12.6915 12.6112 12.7423C12.6491 12.6915 12.6941 12.6465 12.7448 12.6086C12.6941 12.5706 12.649 12.5253 12.6112 12.4743M2.8041 1.74947C3.0003 1.17603 3.84762 1.19513 4.00102 1.80675L4.1959 2.5889L4.97804 2.78443C5.61008 2.94244 5.61008 3.83914 4.97804 3.99715L4.1959 4.19269L4.00102 4.97483C3.84301 5.60621 2.94565 5.60621 2.78764 4.97483L2.59211 4.19269L1.80996 3.99715C1.17793 3.83914 1.17793 2.94178 1.80996 2.78443L2.59211 2.5889L2.78764 1.80675L2.8041 1.74947ZM3.394 3.2578C3.35607 3.30831 3.31105 3.3531 3.26036 3.39079C3.31115 3.42888 3.35616 3.47412 3.394 3.5251C3.43185 3.47412 3.47686 3.42888 3.52765 3.39079C3.47691 3.3529 3.43189 3.30855 3.394 3.2578Z" fill="url(#aiStar0)"/><defs><linearGradient id="aiStar0" x1="1.89149" y1="4.66649" x2="18.9317" y2="7.11893" gradientUnits="userSpaceOnUse"><stop stop-color="#F567FF"/><stop offset="0.403337" stop-color="#B351F6"/><stop offset="0.889423" stop-color="#5951F6"/></linearGradient></defs></svg>',
  // FilledIconLink — иконка ссылки в поле «Paste Channel Reference Link»
  // плюс — «Create new collection» (кнопка и пункт списка)
  plus: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 5V19M5 12H19" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  link: '<svg viewBox="0 0 24 24" fill="none"><path fill-rule="evenodd" clip-rule="evenodd" d="M13.0552 5.30971L11.5397 6.82533C10.9261 7.43904 9.93107 7.43911 9.31734 6.82546C8.70363 6.2118 8.70356 5.21681 9.31721 4.60308L10.8327 3.08747C13.6161 0.304056 18.1289 0.303993 20.9124 3.08741C23.6958 5.8708 23.6958 10.3836 20.9124 13.167L19.3969 14.6826C18.7832 15.2963 17.7884 15.2964 17.1746 14.6827C16.5609 14.069 16.5608 13.0741 17.1746 12.4603L18.6899 10.9447C20.246 9.3887 20.246 6.86581 18.6899 5.30977C17.134 3.75377 14.6112 3.75374 13.0552 5.30971ZM6.82506 9.31731C7.43878 9.93096 7.43884 10.926 6.82519 11.5397L5.30974 13.0553C3.75371 14.6113 3.75365 17.1343 5.30968 18.6903C6.8657 20.2462 9.38846 20.2462 10.9445 18.6903L12.4599 17.1746C13.0736 16.561 14.0686 16.5609 14.6823 17.1746C15.296 17.7883 15.2961 18.7832 14.6824 19.397L13.167 20.9125C10.3836 23.6959 5.87072 23.696 3.08732 20.9127C0.303922 18.1291 0.303902 13.6165 3.08726 10.8331L4.60269 9.31743C5.21634 8.70372 6.21133 8.70365 6.82506 9.31731ZM15.4683 10.754C16.082 10.1403 16.082 9.14534 15.4683 8.53164C14.8546 7.91796 13.8596 7.91796 13.2459 8.53164L8.53155 13.246C7.91787 13.8597 7.91787 14.8547 8.53155 15.4684C9.14525 16.0821 10.1402 16.0821 10.7539 15.4684L15.4683 10.754Z" fill="currentColor"/></svg>',
  // FilledAiToolsIcon (currentColor) — «Auto Description»
  aiTools: '<svg viewBox="0 0 20 20" fill="none"><path d="M8.32147 7.6441L9.05062 5.09373C9.32384 4.1391 10.6768 4.1391 10.95 5.09373L11.6783 7.6441C11.7245 7.80543 11.8109 7.95235 11.9296 8.071C12.0482 8.18964 12.1951 8.2761 12.3565 8.32222L14.9068 9.05054C15.8615 9.32376 15.8615 10.6767 14.9068 10.9499L12.3565 11.6783C12.1951 11.7244 12.0482 11.8108 11.9296 11.9295C11.8109 12.0481 11.7245 12.1951 11.6783 12.3564L10.95 14.9067C10.6768 15.8614 9.32384 15.8614 9.05062 14.9067L8.3223 12.3564C8.27618 12.1951 8.18972 12.0481 8.07108 11.9295C7.95243 11.8108 7.80551 11.7244 7.64418 11.6783L5.09381 10.9499C4.13917 10.6767 4.13917 9.32376 5.09381 9.05054L7.64418 8.32222C7.80551 8.2761 7.95243 8.18964 8.07108 8.071C8.18972 7.95235 8.27536 7.80543 8.32147 7.6441ZM15.0237 13.7093C15.2615 13.0156 16.2614 13.0148 16.4984 13.7093L16.5198 13.7809L16.7634 14.7586L17.7411 15.003C18.5312 15.2005 18.5312 16.3214 17.7411 16.5189L16.7634 16.7634L16.5198 17.741C16.3223 18.5303 15.2006 18.5303 15.0031 17.741L14.7587 16.7634L13.781 16.5189C12.991 16.3214 12.991 15.1997 13.781 15.003L14.7587 14.7586L15.0031 13.7809L15.0237 13.7093ZM15.7611 15.5939C15.7137 15.6574 15.6574 15.7136 15.594 15.761C15.6574 15.8083 15.7137 15.8646 15.7611 15.928C15.8084 15.8646 15.8647 15.8083 15.9281 15.761C15.8646 15.7134 15.8084 15.6576 15.7611 15.5939ZM3.5022 2.18703C3.74744 1.47023 4.8066 1.49409 4.99835 2.25862L5.24195 3.2363L6.21963 3.48072C7.00967 3.67824 7.00967 4.79911 6.21963 4.99662L5.24195 5.24104L4.99835 6.21872C4.80084 7.00795 3.67914 7.00795 3.48163 6.21872L3.23721 5.24104L2.25953 4.99662C1.46948 4.79911 1.46948 3.67741 2.25953 3.48072L3.23721 3.2363L3.48163 2.25862L3.5022 2.18703ZM4.23958 4.07244C4.19215 4.13558 4.13589 4.19156 4.07251 4.23867C4.136 4.28629 4.19227 4.34283 4.23958 4.40656C4.28688 4.34283 4.34315 4.28629 4.40664 4.23867C4.34321 4.19131 4.28694 4.13587 4.23958 4.07244Z" fill="currentColor"/></svg>',
  // FilledAiStarsIcon в одноцветном варианте (currentColor) — для акцентной кнопки/бейджа
  aiStarsSolid: '<svg viewBox="0 0 16 16" fill="none"><path d="M6.65952 6.11513L7.24284 4.07484C7.46142 3.31113 8.54378 3.31113 8.76236 4.07484L9.34502 6.11513C9.38191 6.2442 9.45108 6.36173 9.54599 6.45665C9.64091 6.55157 9.75845 6.62074 9.88751 6.65763L11.9278 7.24029C12.6915 7.45887 12.6915 8.54123 11.9278 8.75981L9.88751 9.34246C9.75845 9.37935 9.64091 9.44852 9.54599 9.54344C9.45108 9.63836 9.38191 9.7559 9.34502 9.88496L8.76236 11.9253C8.54378 12.689 7.46142 12.689 7.24284 11.9253L6.66018 9.88496C6.62329 9.7559 6.55412 9.63836 6.4592 9.54344C6.36429 9.44852 6.24675 9.37935 6.11768 9.34246L4.07739 8.75981C3.31368 8.54123 3.31368 7.45887 4.07739 7.24029L6.11768 6.65763C6.24675 6.62074 6.36429 6.55157 6.4592 6.45665C6.55412 6.36173 6.62329 6.2442 6.66018 6.11513M12.0213 10.9673C12.2116 10.4123 13.0115 10.4117 13.2011 10.9673L13.2182 11.0246L13.4131 11.8067L14.1952 12.0023C14.8273 12.1603 14.8273 13.057 14.1952 13.215L13.4131 13.4105L13.2182 14.1927C13.0602 14.8241 12.1628 14.8241 12.0048 14.1927L11.8093 13.4105L11.0272 13.215C10.3951 13.057 10.3951 12.1596 11.0272 12.0023L11.8093 11.8067L12.0048 11.0246L12.0213 10.9673ZM2.8041 1.74947C3.0003 1.17603 3.84762 1.19513 4.00102 1.80675L4.1959 2.5889L4.97804 2.78443C5.61008 2.94244 5.61008 3.83914 4.97804 3.99715L4.1959 4.19269L4.00102 4.97483C3.84301 5.60621 2.94565 5.60621 2.78764 4.97483L2.59211 4.19269L1.80996 3.99715C1.17793 3.83914 1.17793 2.94178 1.80996 2.78443L2.59211 2.5889L2.78764 1.80675L2.8041 1.74947Z" fill="currentColor"/></svg>',
  // FilledDefaultBadgeIcon — бейдж «Default», viewBox 66x22
  defaultBadge: '<svg viewBox="0 0 66 22" fill="none"><rect x="0.5" y="0.5" width="65" height="21" rx="2.5" fill="#FAFAFA"/><rect x="0.5" y="0.5" width="65" height="21" rx="2.5" stroke="#E6E6E6"/><path d="M9.81818 15H6.8608V6.27273H9.87784C10.7443 6.27273 11.4886 6.44744 12.1108 6.79688C12.7358 7.14347 13.2159 7.64205 13.5511 8.29261C13.8864 8.94318 14.054 9.72159 14.054 10.6278C14.054 11.5369 13.8849 12.3182 13.5469 12.9716C13.2116 13.625 12.7273 14.1264 12.0938 14.4759C11.4631 14.8253 10.7045 15 9.81818 15ZM8.44176 13.6321H9.74148C10.3494 13.6321 10.8565 13.5213 11.2628 13.2997C11.669 13.0753 11.9744 12.7415 12.179 12.2983C12.3835 11.8523 12.4858 11.2955 12.4858 10.6278C12.4858 9.96023 12.3835 9.40625 12.179 8.96591C11.9744 8.52273 11.6719 8.19176 11.2713 7.97301C10.8736 7.75142 10.3793 7.64062 9.78835 7.64062H8.44176V13.6321ZM15.5561 15V6.27273H21.2322V7.59801H17.1371V9.96733H20.9382V11.2926H17.1371V13.6747H21.2663V15H15.5561ZM22.8452 15V6.27273H28.4361V7.59801H24.4261V9.96733H28.0526V11.2926H24.4261V15H22.8452ZM29.9073 15H28.2198L31.2923 6.27273H33.244L36.3207 15H34.6332L32.3022 8.0625H32.234L29.9073 15ZM29.9627 11.5781H34.565V12.848H29.9627V11.5781ZM42.9716 6.27273H44.5526V11.9744C44.5526 12.5994 44.4048 13.1491 44.1094 13.6236C43.8168 14.098 43.4048 14.4687 42.8736 14.7358C42.3423 15 41.7216 15.1321 41.0114 15.1321C40.2983 15.1321 39.6761 15 39.1449 14.7358C38.6136 14.4687 38.2017 14.098 37.9091 13.6236C37.6165 13.1491 37.4702 12.5994 37.4702 11.9744V6.27273H39.0511V11.8423C39.0511 12.206 39.1307 12.5298 39.2898 12.8139C39.4517 13.098 39.679 13.321 39.9716 13.483C40.2642 13.642 40.6108 13.7216 41.0114 13.7216C41.4119 13.7216 41.7585 13.642 42.0511 13.483C42.3466 13.321 42.5739 13.098 42.733 12.8139C42.892 12.5298 42.9716 12.206 42.9716 11.8423V6.27273ZM46.271 15V6.27273H47.8519V13.6747H51.6957V15H46.271ZM51.571 7.59801V6.27273H58.5341V7.59801H55.8366V15H54.2685V7.59801H51.571Z" fill="#B351F6"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none"><path d="M10.6154 18.2307C14.8212 18.2307 18.2307 14.8212 18.2307 10.6154C18.2307 6.40951 14.8212 3 10.6154 3C6.40951 3 3 6.40951 3 10.6154C3 14.8212 6.40951 18.2307 10.6154 18.2307Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M21.0004 20.9985L16.1543 16.1523" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  filter: '<svg viewBox="0 0 24 24" fill="none"><path d="M3 7H21" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M6 12H18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M10 17H14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  // OutlineIconChevronDown — сплошной шеврон, viewBox 16x8 (триггер режима)
  chevDown: '<svg viewBox="0 0 16 8" fill="none"><path fill-rule="evenodd" clip-rule="evenodd" d="M0.180571 0.26192C0.450138 -0.0525743 0.923613 -0.0889955 1.23811 0.180571L7.75001 5.76221L14.2619 0.180572C14.5764 -0.0889949 15.0499 -0.0525737 15.3195 0.261921C15.589 0.576415 15.5526 1.04989 15.2381 1.31946L8.23811 7.31946C7.95724 7.5602 7.54279 7.5602 7.26192 7.31946L0.26192 1.31946C-0.0525743 1.04989 -0.0889955 0.576414 0.180571 0.26192Z" fill="currentColor"/></svg>',
  // шеврон селекта коллекции, viewBox 24 (тонкий rounded)
  chevSelect: '<svg viewBox="0 0 24 24" fill="none"><path fill-rule="evenodd" clip-rule="evenodd" d="M4.43057 8.51191C4.70014 8.19741 5.17361 8.16099 5.48811 8.43056L12 14.0122L18.5119 8.43056C18.8264 8.16099 19.2999 8.19741 19.5695 8.51191C19.839 8.8264 19.8026 9.29988 19.4881 9.56944L12.4881 15.5694C12.2072 15.8102 11.7928 15.8102 11.5119 15.5694L4.51192 9.56944C4.19743 9.29988 4.161 8.8264 4.43057 8.51191Z" fill="currentColor"/></svg>',
  // BoldOutlineIconShortArrowLeft / Right / Down — жирные короткие стрелки, viewBox 24
  arrowL: '<svg viewBox="0 0 24 24" fill="none"><path fill-rule="evenodd" clip-rule="evenodd" d="M14.8 3L6 12L14.8 21L17 18.75L10.4 12L17 5.25L14.8 3Z" fill="currentColor"/></svg>',
  arrowR: '<svg viewBox="0 0 24 24" fill="none"><path fill-rule="evenodd" clip-rule="evenodd" d="M9.2 3L18 12L9.2 21L7 18.75L13.6 12L7 5.25L9.2 3Z" fill="currentColor"/></svg>',
  arrowDown: '<svg viewBox="0 0 24 24" fill="none"><path fill-rule="evenodd" clip-rule="evenodd" d="M21.5 8.7L12.5 17.5L3.5 8.7L5.75 6.5L12.5 13.1L19.25 6.5L21.5 8.7Z" fill="currentColor"/></svg>',
  // FilledIconSort — две сплошные треугольные стрелки, viewBox 24
  sort: '<svg viewBox="0 0 24 24" fill="none"><path fill-rule="evenodd" clip-rule="evenodd" d="M7.16062 14.8278C7.05266 14.6774 7.00368 14.5079 7.00368 14.3416C7.00368 13.9268 7.30956 13.5366 7.7524 13.5366H16.2503C16.6951 13.5366 17 13.9279 17 14.3416C17 14.509 16.95 14.6785 16.8411 14.8288C15.6385 16.4857 13.5903 19.3058 12.5846 20.6908C12.4427 20.887 12.2248 21 11.9928 21C11.7629 21 11.544 20.8859 11.4021 20.6897C10.4004 19.3047 8.35918 16.4836 7.16062 14.8278Z" fill="currentColor"/><path fill-rule="evenodd" clip-rule="evenodd" d="M16.8394 9.17222C16.9473 9.32256 16.9963 9.49208 16.9963 9.65841C16.9963 10.0732 16.6904 10.4634 16.2476 10.4634H7.74972C7.30489 10.4634 7 10.0721 7 9.65841C7 9.49102 7.04998 9.32149 7.15894 9.17116C8.3615 7.51428 10.4097 4.69419 11.4154 3.3092C11.5573 3.11302 11.7752 3 12.0072 3C12.2371 3 12.456 3.11408 12.5979 3.31026C13.5996 4.69526 15.6408 7.51642 16.8394 9.17222Z" fill="currentColor"/></svg>',
  // FilledIconClose — круг с X (очистка поиска)
  close: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 2C6.49 2 2 6.49 2 12C2 17.51 6.49 22 12 22C17.51 22 22 17.51 22 12C22 6.49 17.51 2 12 2ZM15.36 14.3C15.65 14.59 15.65 15.07 15.36 15.36C15.21 15.51 15.02 15.58 14.83 15.58C14.64 15.58 14.45 15.51 14.3 15.36L12 13.06L9.7 15.36C9.55 15.51 9.36 15.58 9.17 15.58C8.98 15.58 8.79 15.51 8.64 15.36C8.35 15.07 8.35 14.59 8.64 14.3L10.94 12L8.64 9.7C8.35 9.41 8.35 8.93 8.64 8.64C8.93 8.35 9.41 8.35 9.7 8.64L12 10.94L14.3 8.64C14.59 8.35 15.07 8.35 15.36 8.64C15.65 8.93 15.65 9.41 15.36 9.7L13.06 12L15.36 14.3Z" fill="currentColor"/></svg>',
  // BoldOutlineIconClose — жирный X (закрытие футера / remove-колонки)
  closeBold: '<svg viewBox="0 0 24 24" fill="none"><path d="M19.172 6.42187C19.6126 5.98124 19.6126 5.26874 19.172 4.83281C18.7314 4.39687 18.0189 4.39218 17.583 4.83281L12.0048 10.4109L6.42202 4.82812C5.9814 4.38749 5.2689 4.38749 4.83296 4.82812C4.39702 5.26874 4.39233 5.98124 4.83296 6.41718L10.4111 11.9953L4.82827 17.5781C4.38765 18.0187 4.38765 18.7312 4.82827 19.1672C5.2689 19.6031 5.9814 19.6078 6.41733 19.1672L11.9955 13.5891L17.5783 19.1719C18.0189 19.6125 18.7314 19.6125 19.1673 19.1719C19.6033 18.7312 19.608 18.0187 19.1673 17.5828L13.5892 12.0047L19.172 6.42187Z" fill="currentColor"/></svg>',
  // BoldOutlineIconChannelPage — «открыть канал» (синяя pill / row open)
  channelPage: '<svg viewBox="0 0 24 24" fill="none"><path d="M20 2C20.7956 2 21.5587 2.31607 22.1213 2.87868C22.6839 3.44129 23 4.20435 23 5V6.2C23 6.64183 22.6418 7 22.2 7H21V19C21 19.7956 20.6839 20.5587 20.1213 21.1213C19.5587 21.6839 18.7956 22 18 22H4C3.20435 22 2.44129 21.6839 1.87868 21.1213C1.31607 20.5587 1 19.7956 1 19V17.8C1 17.3582 1.35817 17 1.8 17H16.2C16.6418 17 17 17.3582 17 17.8V19C17 19.2449 17.09 19.4813 17.2527 19.6644C17.4155 19.8474 17.6397 19.9643 17.883 19.993L18 20C18.2449 20 18.4813 19.91 18.6644 19.7473C18.8474 19.5845 18.9643 19.3603 18.993 19.117L19 19V4H6C5.75507 4.00003 5.51866 4.08996 5.33563 4.25272C5.15259 4.41547 5.03566 4.63975 5.007 4.883L5 5V14.5C5 14.7761 4.77614 15 4.5 15H3.5C3.22386 15 3 14.7761 3 14.5V5C3 4.20435 3.31607 3.44129 3.87868 2.87868C4.44129 2.31607 5.20435 2 6 2H20Z" fill="currentColor"/></svg>',
  // OutlineIconColumns
  columns: '<svg viewBox="0 0 24 24" fill="none"><path d="M18.7693 4H5.23077C4.55104 4 4 4.55104 4 5.23077V18.7693C4 19.449 4.55104 20.0001 5.23077 20.0001H18.7693C19.449 20.0001 20.0001 19.449 20.0001 18.7693V5.23077C20.0001 4.55104 19.449 4 18.7693 4Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 7.69229H20.0001" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 7.69229V20" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 13.8462H20.0001" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  // OutlineIconSave — «Export» (стрелка вниз в лоток)
  export: '<svg viewBox="0 0 24 24" fill="none"><path d="M6 8.33333L12 15M12 15L18 8.33333M12 15L12 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 17L3 18.3333C3 19.8061 4.15127 21 5.57143 21L18.4286 21C19.8487 21 21 19.8061 21 18.3333V17" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  // «unpin» — перечёркнутая кнопка-пин (строки deep-data)
  pin: '<svg viewBox="0 0 24 24" fill="none"><path d="M9.5 4h5l-.6 5.6 2.6 2.6v1.3H7.5v-1.3l2.6-2.6L9.5 4z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M12 13.5v6.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M4 4l16 16" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  // OutlineIconSaveOutline — bookmark (строки deep-data)
  bookmark: '<svg viewBox="0 0 24 24" fill="none"><path d="M17.9999 22L12 16.1538L6 22V4.46154C6 4.07391 6.15804 3.70217 6.43933 3.42807C6.72064 3.15398 7.10216 3 7.49999 3H16.4999C16.8977 3 17.2793 3.15398 17.5606 3.42807C17.8418 3.70217 17.9999 4.07391 17.9999 4.46154V22Z" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  // BoldOutlineIconThumbUp — статус «Activated»
  thumbUp: '<svg viewBox="0 0 24 24" fill="none"><path fill-rule="evenodd" clip-rule="evenodd" d="M10.3601 3.53447C10.5044 3.20946 10.8263 3 11.1817 3C13.0189 3 14.5083 4.49088 14.5083 6.32998V8.66996H18.4597C19.1962 8.66324 19.8988 8.97979 20.3822 9.53629C20.8668 10.0942 21.0823 10.837 20.9715 11.568L19.8548 18.8579C19.6669 20.0984 18.596 21.0113 17.3431 20.9999L5.79161 20.9997C4.39147 21.0201 3.19594 19.9903 3.00811 18.6004C3.00271 18.5604 3 18.5201 3 18.4797V12.8098C3 12.7694 3.00271 12.7291 3.00811 12.6891C3.18783 11.3591 4.33367 10.179 5.7916 10.2H7.40059L10.3601 3.53447ZM8.84404 11.3809L11.7222 4.89844C12.2996 5.11701 12.7101 5.67551 12.7101 6.32998V9.56996C12.7101 10.067 13.1126 10.47 13.6092 10.47H18.4642L18.4744 10.4699C18.6854 10.4675 18.8868 10.558 19.0253 10.7174C19.1638 10.8768 19.2253 11.0891 19.1937 11.2979L18.0772 18.5865L18.077 18.5879C18.0232 18.9429 17.7164 19.204 17.3577 19.2L8.84404 19.1999V11.3809ZM7.04587 19.1998L5.78453 19.1997L5.76856 19.1999C5.29361 19.2083 4.88522 18.8718 4.79817 18.4093V12.8794C4.89358 12.3581 5.34836 11.9924 5.76856 11.9999L5.78446 12H7.04587V19.1998Z" fill="currentColor"/></svg>',
  // FilledIconCollections — кнопка Create Collection + сабменю
  collections: '<svg viewBox="0 0 24 24" fill="none"><path d="M6 4.5H18" stroke="currentColor" stroke-width="1.5" stroke-miterlimit="10" stroke-linecap="round" stroke-linejoin="round"/><path d="M9 2H15" stroke="currentColor" stroke-width="1.5" stroke-miterlimit="10" stroke-linecap="round" stroke-linejoin="round"/><path fill-rule="evenodd" clip-rule="evenodd" d="M7 22H17C20 22 22 20.5 22 17V12C22 8.5 20 7 17 7H7C4 7 2 8.5 2 12V17C2 20.5 4 22 7 22ZM9.75 13.2501V14.4501V15.6501C9.75 17.1901 10.84 17.8201 12.17 17.0501L13.21 16.4501L14.25 15.8501C15.58 15.0801 15.58 13.8201 14.25 13.0501L13.21 12.4501L12.17 11.8501C10.84 11.0801 9.75 11.7101 9.75 13.2501Z" fill="currentColor"/></svg>',
  // 3 точки (действия строки) — OutlineIconMore
  dots: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="12" cy="19" r="1.8"/></svg>',
  // статусы: песочные часы (Collecting data) + галочка (Created)
  progress: '<svg viewBox="0 0 24 24" fill="none"><path d="M14.8356 3.24829H9.16564C5.87564 3.24829 5.62189 6.20579 7.39814 7.81579L16.6031 16.1808C18.3794 17.7908 18.1256 20.7483 14.8356 20.7483H9.16564C5.87564 20.7483 5.62189 17.7908 7.39814 16.1808L16.6031 7.81579C18.3794 6.20579 18.1256 3.24829 14.8356 3.24829Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none"><path fill-rule="evenodd" clip-rule="evenodd" d="M20.5334 4.285C21.0807 4.72253 21.1578 5.50641 20.7054 6.03585L10.3685 18.1353C10.1302 18.412 9.83512 18.631 9.50152 18.7798C9.1679 18.9288 8.80418 19.0039 8.43679 18.9998C8.06339 18.9954 7.69473 18.9091 7.36071 18.7475C7.02782 18.5866 6.73682 18.3549 6.50939 18.07L3.27113 14.0428C2.83519 13.5007 2.93616 12.7193 3.49666 12.2977C4.05716 11.876 4.86493 11.9737 5.30087 12.5158L8.46828 16.4549L18.7232 4.45145C19.1756 3.92201 19.9861 3.84749 20.5334 4.285Z" fill="currentColor"/></svg>',
  // OutlineIconGraph — View deep data
  graph: '<svg viewBox="0 0 24 24" fill="none"><path d="M4 4V19.9999H19.9999" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M7.69238 11.3846L10.7693 14.4615L15.6923 7.07693L20 10.1538" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  // OutlineIconEdit — Edit collection (карандаш)
  edit: '<svg viewBox="0 0 24 24" fill="none"><path fill-rule="evenodd" clip-rule="evenodd" d="M15.9268 1.96627C17.0637 1.82561 18.2138 2.27541 19.3825 3.33935L19.3838 3.34058C20.5564 4.41352 21.0902 5.50192 21.0101 6.61048C20.9327 7.68168 20.2909 8.58834 19.5591 9.33646L11.5635 17.5249C11.3381 17.7624 11.0346 17.9635 10.7469 18.1124C10.4555 18.2631 10.1184 18.3922 9.80192 18.4466L9.79706 18.4474L6.66074 18.9657C5.90019 19.0926 5.17088 18.9087 4.65135 18.432C4.13255 17.956 3.9033 17.2618 3.98823 16.5222L3.98848 16.5201L4.35055 13.4523C4.3926 13.1472 4.50974 12.8169 4.64781 12.5305C4.78539 12.245 4.9731 11.9423 5.19524 11.7135L5.19667 11.7121L13.1962 3.51957C13.9284 2.77115 14.8283 2.10219 15.9268 1.96627ZM14.258 4.49124L6.26048 12.6818C6.18061 12.7642 6.07089 12.9238 5.9724 13.1281C5.87568 13.3288 5.81759 13.5144 5.80018 13.6338L5.44083 16.6784C5.39941 17.0413 5.51586 17.2764 5.65706 17.4059C5.79766 17.5349 6.04271 17.6339 6.41242 17.5722L9.54816 17.0539C9.67022 17.0326 9.85829 16.9685 10.0578 16.8653C10.2601 16.7607 10.4122 16.6478 10.4884 16.567L10.4971 16.5577L18.4967 8.36531C19.1482 7.69941 19.5102 7.0926 19.5521 6.51188C19.5914 5.96842 19.3605 5.26583 18.3804 4.36876C17.4057 3.48164 16.6707 3.29988 16.1122 3.36897C15.5155 3.4428 14.9092 3.82577 14.258 4.49124Z" fill="currentColor"/></svg>',
  // OutlineIconShare — Share collection
  share: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 3V17M12 3L19 9.42857M12 3L5 9.42857" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M20 18V19.8C20 20.4627 19.3488 21 18.5455 21H5.45455C4.65122 21 4 20.4627 4 19.8V18" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  // FilledIconArchive — Deactivate collection
  archive: '<svg viewBox="0 0 24 24" fill="none"><path d="M2.375 2.375H21.625C22.3855 2.375 23 2.98945 23 3.75V5.125C23 5.88555 22.3855 6.5 21.625 6.5H2.375C1.61445 6.5 1 5.88555 1 5.125V3.75C1 2.98945 1.61445 2.375 2.375 2.375ZM2.375 7.875H21.625V18.875C21.625 20.3918 20.3918 21.625 18.875 21.625H5.125C3.6082 21.625 2.375 20.3918 2.375 18.875V7.875ZM7.875 11.3125C7.875 11.6906 8.18437 12 8.5625 12H15.4375C15.8156 12 16.125 11.6906 16.125 11.3125C16.125 10.9344 15.8156 10.625 15.4375 10.625H8.5625C8.18437 10.625 7.875 10.9344 7.875 11.3125Z" fill="currentColor"/></svg>',
  // OutlineIconDelete — Delete collection (корзина)
  trash: '<svg viewBox="0 0 24 24" fill="none"><path d="M3.00146 6.75033H21.0003" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M5.25098 6.75033H18.7501V20.2495C18.7501 20.6473 18.592 21.0288 18.3108 21.3101C18.0296 21.5913 17.648 21.7494 17.2502 21.7494H6.75088C6.35308 21.7494 5.97158 21.5913 5.69028 21.3101C5.40901 21.0288 5.25098 20.6473 5.25098 20.2495V6.75033Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M8.25098 6.75033V6.00038C8.25098 5.00588 8.64604 4.0521 9.34925 3.34889C10.0525 2.64567 11.0062 2.25061 12.0007 2.25061C12.9952 2.25061 13.949 2.64567 14.6522 3.34889C15.3555 4.0521 15.7505 5.00588 15.7505 6.00038V6.75033" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M9.75049 11.2523V17.2542" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M14.251 11.2523V17.2542" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

// ---- колонки paid-таблицы (enterprise): порядок и ширины из useChannelsTable ----
const COLS = [
  { id:"check",  w:40,  pin:"check" },
  { id:"name",   w:280, pin:"name", label:"Channel", sort:true },
  { id:"stub",   w:20,  stub:true },
  { id:"topics", w:140, label:"Youtube topics" },
  { id:"created",w:120, label:"Created" },
  { id:"lastupd",w:150, label:"Last upd" },
  { id:"added",  w:150, label:"Added to base" },
  { id:"subs",   w:110, label:"Subs", sort:true },
  { id:"views",  w:100, label:"Views", sort:true },
  { id:"vids",   w:110, label:"Vids", sort:true },
  { id:"subsg",  w:110, label:"Subs+", sort:true },
  { id:"viewsg", w:120, label:"Views+", sort:true },
  { id:"avv",    w:80,  label:"AVV", sort:true },
  { id:"vps",    w:150, label:"Views+/Subs+", sort:true },
];

// ---- данные-примеры (реальные каналы/значения с прода app.subsub.io/analytics/basic-data) ----
const AVA = ["--color-avatar-1","--color-avatar-3","--color-avatar-5","--color-avatar-1","--color-avatar-3"];
const ROWS = [
  ["T-Series","T","Music","13.03.2006","27.07.2026","14.07.2024","314m","349.6bn","26.8k","+1m","+3.4bn","13.1m","3.4k"],
  ["Cocomelon - Nursery Rhymes","C","Entertainment","01.09.2006","27.07.2026","23.05.2023","202m","224.9bn","2.1k","+1m","+1.3bn","108.5m","1.3k"],
  ["SET India","S","Entertainment","20.09.2006","27.07.2026","14.07.2024","189m","190.6bn","173.8k","+900k","+1bn","1.1m","1.1k"],
  ["김프로KIMPRO","김","Music of Asia","11.11.2017","26.07.2026","12.09.2024","134m","150.5bn","4.3k","+500k","+2.7bn","34.9m","5.4k"],
  ["Sony SAB","S","Entertainment","04.08.2007","27.07.2026","13.09.2024","106m","146bn","113.8k","+1m","+1.2bn","1.3m","1.2k"],
  ["MrBeast","M","Lifestyle (sociology)","20.02.2012","25.07.2026","29.06.2023","510m","134.7bn","994","+6m","+3.6bn","135.5m","596"],
  ["✿ Kids Diana Show","K","Lifestyle (sociology)","12.05.2015","26.07.2026","06.04.2023","138m","125.3bn","1.7k","+200k","+403.7m","74.3m","2k"],
  ["Vlad and Niki","V","Lifestyle (sociology)","23.04.2018","25.07.2026","06.04.2023","150m","122.3bn","764","+300k","+603.8m","117.4m","2k"],
  ["Like Nastya","L","Lifestyle (sociology)","06.12.2016","25.07.2026","23.05.2023","133m","122.2bn","1.1k","+1m","+580.6m","111.9m","581"],
  ["Toys and Colors","T","Lifestyle (sociology)","17.03.2016","26.07.2026","17.07.2024","82.8m","120.6bn","1.9k","+100k","+817.6m","63.6m","8.2k"],
  ["Zee TV","Z","Entertainment","11.12.2005","27.07.2026","31.10.2023","98.5m","119.3bn","241.2k","+300k","+1.2bn","494.9k","4k"],
  ["WWE","W","Professional wrestling","11.05.2007","26.07.2026","29.06.2023","113m","105.8bn","95.2k","+400k","+690.3m","1.1m","1.7k"],
];

function headCell(c){
  let cls = "an-th";
  let style = "width:" + c.w + "px";
  if (c.pin === "check") { cls += " an-th--pin an-th--check"; style += ";left:0"; }
  if (c.pin === "name")  { cls += " an-th--pin an-th--name";  style += ";left:40px"; }
  if (c.stub) cls += " an-th--stub";
  let inner = "";
  if (c.pin === "check") inner = '<button class="an-check" type="button" data-an-check-all aria-label="Select all"></button>';
  else if (c.stub) inner = "";
  else if (c.sort) inner = '<span class="an-sort" role="button" tabindex="0">' + c.label + IC.sort + '</span>';
  else inner = c.label;
  return '<div class="' + cls + '" style="' + style + '">' + inner + '</div>';
}

function delta(v){
  if (!v || v === "–") return '<span class="an-muted">–</span>';
  const cls = v[0] === "+" ? "an-delta--pos" : (v[0] === "-" ? "an-delta--neg" : "");
  return '<span class="' + cls + '">' + esc(v) + '</span>';
}
// delta-ячейка с цветным чипом (как на проде: Subs+/Views+): + → зелёный, +0 → оранжевый, − → красный
function deltaCell(v, w){
  if (!v || v === "–") return '<div class="an-td" style="width:' + w + 'px"><span class="an-muted">–</span></div>';
  const t = String(v).replace("+", "").trim();
  const c = v[0] === "-" ? "neg" : (/^0(\D|$)/.test(t) ? "zero" : "pos");
  return '<div class="an-td an-td--metric" style="width:' + w + 'px"><span class="an-heat an-heat--' + c + '"><span class="an-delta--' + c + '">' + esc(v) + '</span></span></div>';
}

function bodyRow(r, i){
  const color = AVA[i % AVA.length];
  const cells = [];
  cells.push('<div class="an-td an-td--pin an-td--check" style="width:40px;left:0"><button class="an-check" type="button" data-an-check aria-label="Select"></button></div>');
  cells.push('<div class="an-td an-td--pin an-td--name" style="width:280px;left:40px">' +
      '<a class="an-chan" href="#" tabindex="-1">' +
        '<span class="an-chan__left"><span class="an-chan__ava" style="background:var(' + color + ')">' + esc(r[1]) + '</span>' +
        '<span class="an-chan__name">' + esc(r[0]) + '</span></span>' +
        '<span class="an-chan__fade"></span>' +
        '<span class="an-chan__open" aria-hidden="true">' + IC.channelPage + '</span>' +
      '</a></div>');
  cells.push('<div class="an-td an-td--stub" style="width:20px"></div>');
  cells.push('<div class="an-td" style="width:140px"><span class="an-topic">' + esc(r[2]) + '</span></div>');
  cells.push('<div class="an-td" style="width:120px">' + esc(r[3]) + '</div>');
  cells.push('<div class="an-td" style="width:150px">' + esc(r[4]) + '</div>');
  cells.push('<div class="an-td" style="width:150px">' + esc(r[5]) + '</div>');
  cells.push('<div class="an-td" style="width:110px">' + esc(r[6]) + '</div>');
  cells.push('<div class="an-td" style="width:100px">' + esc(r[7]) + '</div>');
  cells.push('<div class="an-td" style="width:110px">' + esc(r[8]) + '</div>');
  cells.push(deltaCell(r[9], 110));
  cells.push(deltaCell(r[10], 120));
  cells.push('<div class="an-td" style="width:80px">' + esc(r[11]) + '</div>');
  cells.push('<div class="an-td" style="width:150px">' + esc(r[12]) + '</div>');
  return '<div class="an-tr">' + cells.join("") + '</div>';
}

const headHtml = '<div class="an-tr an-tr--head">' + COLS.map(headCell).join("") + '</div>';
const rowsHtml = ROWS.map(bodyRow).join("\n          ");

// Модалка «Create collection» — общий фрагмент: используется и как самостоятельный флоу
// на My collections, и как ВЛОЖЕННАЯ модалка поверх sourcing (создание коллекции-назначения).
const mcCreateModalHtml = `
    <div class="an-modal an-modal--nested" id="mcModal-create"><div class="an-modal__overlay" data-mc-close></div>
      <div class="an-modal__dialog">
        <div class="an-modal__head">
          <h2 class="an-modal__title" data-mc-create-title>Create collection</h2>
          <button class="an-modal__x" type="button" data-mc-close aria-label="Close">${IC.closeBold}</button>
        </div>
        <div class="an-modal__body">
          <label class="an-label" for="mcName">Name collection</label>
          <input class="an-input" id="mcName" type="text" placeholder="Name collection" data-mc-name />
        </div>
        <div class="an-modal__foot">
          <button class="an-btn an-btn--secondary an-btn--small" type="button" data-mc-close>Cancel</button>
          <button class="an-btn an-btn--primary an-btn--small" type="button" data-mc-create-submit>Create</button>
        </div>
      </div>
    </div>`;

// Модалка AI-коллекции — общий фрагмент (Basic data + My collections).
// Вёрстка по референсу «Setup Collection Sourcing»: заголовок с подзаголовком, имя коллекции,
// составное поле описания (textarea + вложенная строка reference-link и «Auto Description»)
// и свёрнутая секция «Advanced Research Settings» с числовыми фильтрами.
const aiModalHtml = `
    <div class="an-modal" id="aiModal" data-ai-mode="single"><div class="an-modal__overlay" data-ai-close></div>
      <div class="an-modal__dialog an-modal__dialog--lg">
        <!-- шапка вне скроллящегося тела: не уезжает при прокрутке, отделена разделителем -->
        <header class="ai-head">
          <h2 class="ai-title">${AI_MODAL_TITLE}</h2>
          <p class="ai-sub">${AI_MODAL_SUB}</p>
        </header>
        <div class="an-modal__body ai-form">
          <!-- Назначение: куда попадут найденные каналы.
               Случай 1 (коллекций ещё нет) — только поле имени новой коллекции.
               Случай 2 (коллекции есть) — дропдаун выбора + чёрная кнопка «+». -->
          <div class="ai-field" data-ai-dest-new hidden>
            <label class="ai-lbl" for="aiName">Collection name *</label>
            <input class="an-input" id="aiName" type="text" placeholder="e.g. Fortnite gamers — US" data-ai-name />
          </div>

          <div class="ai-field" data-ai-dest-pick hidden>
            <label class="ai-lbl" for="aiCollTrig">Collection</label>
            <div class="ai-destrow">
              <div class="ai-select" data-ai-select>
                <button class="ai-select__trig" id="aiCollTrig" type="button" data-ai-select-trig aria-haspopup="listbox" aria-expanded="false">
                  <span class="ai-select__val" data-ai-select-val>Select collection</span>
                  <span class="ai-select__chev" aria-hidden="true">${IC.chevSelect}</span>
                </button>
                <div class="ai-select__menu" data-ai-select-menu hidden role="listbox" aria-label="Destination collection">
                  <div class="ai-select__list" data-ai-select-list></div>
                  <div class="ai-select__foot">
                    <button class="ai-select__new" type="button" data-ai-newcoll>${IC.plus}Create new collection</button>
                  </div>
                </div>
              </div>
              <button class="ai-plus" type="button" data-ai-newcoll aria-label="Create new collection">${IC.plus}</button>
            </div>
          </div>

          <!-- Референс-каналы: единый контейнер примеров. Сценарий 1 (кнопка AI collection) —
               пустой, канал добавляется ссылкой; сценарий 2 (Find similar channels) —
               предзаполнен выбранными в таблице. Любое изменение набора перезапускает подбор описания. -->
          <div class="ai-field" data-ai-refs-field>
            <label class="ai-lbl">Reference channels</label>
            <div class="ai-refs" data-ai-refs>
              <div class="ai-refs__list" data-ai-refs-list></div>
              <p class="ai-refs__empty" data-ai-refs-empty>No reference channels yet — add one to draft the description automatically.</p>
              <div class="ai-refs__addrow">
                <!-- в покое — только кнопка; поле ввода раскрывается по клику -->
                <button class="ai-refs__addbtn" type="button" data-ai-ref-open>${IC.link}Add channel</button>
                <div class="ai-refs__form" data-ai-ref-form hidden>
                  <!-- комбобокс: поле + прикреплённый снизу список подсказок -->
                  <div class="ai-seedwrap">
                    <label class="ai-seed">
                      <span class="ai-seed__ico" aria-hidden="true">${IC.link}</span>
                      <input class="ai-seed__inp" type="text" placeholder="Paste a channel link or type a name" data-ai-refseed aria-label="Add a reference channel" role="combobox" aria-expanded="false" aria-autocomplete="list" />
                    </label>
                    <div class="ai-refs__sug" data-ai-ref-sug hidden role="listbox"></div>
                  </div>
                  <button class="ai-auto" type="button" data-ai-ref-add disabled>${IC.plus}Add</button>
                </div>
              </div>
            </div>
          </div>

          <div class="ai-field">
            <label class="ai-lbl" for="aiQuery">Describe the channels you're looking for</label>
            <div class="ai-desc">
              <textarea class="ai-desc__ta" id="aiQuery" rows="3" placeholder="e.g. Fortnite gamers with a US audience" data-ai-query></textarea>
              <div class="ai-desc__foot" data-ai-foot>
                <!-- режим single: строка «вставь ссылку» + Auto-fill (в режиме refs скрыта) -->
                <div class="ai-desc__row">
                  <label class="ai-seed">
                    <span class="ai-seed__ico" aria-hidden="true">${IC.link}</span>
                    <input class="ai-seed__inp" type="url" placeholder="Paste a channel link to autofill" data-ai-seed aria-label="Paste a channel link to autofill" />
                  </label>
                  <button class="ai-auto" type="button" data-ai-detect disabled>${IC.aiTools}<span data-ai-detect-label>Auto-fill</span></button>
                </div>
                <!-- строка-лоадер: в single кросс-фейдом на месте строки, в refs — только на время подбора -->
                <div class="ai-genrow" data-ai-genrow hidden aria-live="polite" aria-busy="false">
                  <span class="ai-genrow__spin" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8" stroke="#CB7E3959" stroke-width="2"/><path d="M12 3C14.3869 3 16.6761 3.94821 18.364 5.63604C20.0518 7.32387 21 9.61305 21 12H19C19 10.1435 18.2625 8.36301 16.9497 7.05025C15.637 5.7375 13.8565 5 12 5V3Z" fill="#BD6414"/></svg>
                  </span>
                  <span class="ai-genrow__txt" data-ai-genstatus>Reading the channel…</span>
                </div>
              </div>
            </div>
            <p class="ai-help">We turn this into real YouTube search queries in your audience's language and use it to judge whether a channel fits.</p>
          </div>

          <details class="ai-adv">
            <summary class="ai-adv__sum"><span class="ai-adv__chev" aria-hidden="true">${IC.chevSelect}</span>Advanced filters<span class="ai-adv__sumry" data-ai-advsum hidden></span></summary>
            <div class="ai-adv__body">
              <div class="ai-grid">
                <div class="ai-field">
                  <label class="ai-lbl" for="aiSubs">Min subscribers</label>
                  <input class="an-input" id="aiSubs" type="number" min="0" value="10000" data-ai-subs />
                </div>
                <div class="ai-field">
                  <label class="ai-lbl" for="aiVideos">Min videos</label>
                  <input class="an-input" id="aiVideos" type="number" min="0" value="0" data-ai-videos />
                </div>
                <div class="ai-field">
                  <label class="ai-lbl" for="aiViews">Min total views</label>
                  <input class="an-input" id="aiViews" type="number" min="0" value="0" data-ai-views />
                </div>
              </div>
              <div class="ai-grid ai-grid--2">
                <div class="ai-field">
                  <label class="ai-lbl" for="aiAvg">Min avg views (last 3 videos)</label>
                  <input class="an-input" id="aiAvg" type="number" min="0" value="0" data-ai-avg />
                </div>
                <div class="ai-field">
                  <label class="ai-lbl" for="aiLast">Max days since last video</label>
                  <input class="an-input" id="aiLast" type="number" min="0" value="0" data-ai-last />
                </div>
              </div>
            </div>
          </details>
        </div>
        <div class="an-modal__foot">
          <button class="an-btn an-btn--plain an-btn--huge" type="button" data-ai-close>Cancel</button>
          <button class="an-btn an-btn--ai an-btn--huge" type="button" data-ai-submit disabled>${AI_SUBMIT_LABEL}</button>
        </div>
      </div>
    </div>`;

const mainInner = `
    <section class="an-page">
      <header class="an-head"><h1 class="an-title">Basic data</h1></header>

      <section class="an-searchrow">
        <div class="an-search">
          <div class="an-mode" data-an-mode>
            <button class="an-mode__trig" type="button" data-an-mode-toggle>${IC.aiSearch}<span class="an-mode__label">AI semantic search</span><span class="an-mode__chev">${IC.chevDown}</span></button>
            <div class="an-mode__menu" data-an-mode-menu hidden>
              <div class="an-mode__title">Search mode</div>
              <div class="an-mode__opts">
                <button class="an-mode__opt is-selected" type="button" data-an-mode-opt="semantic">
                  <div class="an-mode__optrow">${IC.aiStars}<span>AI semantic search</span><span class="an-mode__badge">${IC.defaultBadge}</span></div>
                  <div class="an-mode__desc">Search by meaning and topic. Example: "travel" find travel channels even without the word in titles.</div>
                </button>
                <button class="an-mode__opt" type="button" data-an-mode-opt="traditional">
                  <div class="an-mode__optrow">${IC.search}<span>Traditional search</span></div>
                  <div class="an-mode__desc">Exact match by channel name, link or UC id.</div>
                </button>
              </div>
            </div>
          </div>
          <span class="an-search__divider"></span>
          <input class="an-search__input" type="text" placeholder="Describe what you are looking for (e.g. travel, cooking, tech)" data-an-search />
          <button class="an-search__clear" type="button" data-an-search-clear hidden>${IC.close}</button>
        </div>
        <div class="an-searchbtns">
          <button class="an-btn an-btn--secondary" type="button">Add to base</button>
          <button class="an-btn an-btn--secondary" type="button">${IC.filter}Filters</button>
          <button class="an-btn an-btn--ai" type="button" data-ai-open>${IC.aiStarsSolid}${AI_LABEL}</button>
        </div>
      </section>

      <section class="an-pagi">
        <div class="an-pagi__label">
          <span class="an-pagi__name">Channels</span>
          <button class="an-collsel" type="button"><span class="an-collsel__txt an-collsel__txt--ph">Select colleciton</span>${IC.chevSelect}</button>
          <span class="an-pagi__dot"></span>
          <span class="an-pagi__total">2.2m</span>
        </div>
        <div class="an-pagi__ctrls">
          <span class="an-pagi__pages">Pages: 74,046</span>
          <div class="an-pagi__nav">
            <button class="an-pagi__arrow" type="button" aria-label="Previous Page">${IC.arrowL}</button>
            <input class="an-pagi__page" type="text" value="1" aria-label="Page number" />
            <button class="an-pagi__arrow" type="button" aria-label="Next Page">${IC.arrowR}</button>
          </div>
          <button class="an-perpage" type="button">30 ${IC.arrowDown}</button>
        </div>
      </section>

      <section class="an-tablewrap">
        <div class="an-table">
          <div class="an-thead">${headHtml}</div>
          <div class="an-tbody">
          ${rowsHtml}
          </div>
        </div>
      </section>
    </section>

    <div class="an-footer" data-an-footer hidden>
      <div class="an-footer__inner">
        <button class="an-btn an-btn--primary an-btn--small" type="button" data-an-footer-btn>Add 1 channel to collection</button>
        <!-- второй вход в тот же флоу автоподбора: выбранные каналы становятся референсами -->
        <button class="an-btn an-btn--secondary an-btn--small" type="button" data-ai-similar>${IC.aiStarsSolid}Find similar channels</button>
        <button class="an-footer__close" type="button" data-an-footer-close aria-label="Clear channels selection">${IC.closeBold}</button>
      </div>
    </div>

    ${aiModalHtml}

    ${mcCreateModalHtml}

    <div class="an-toast" data-an-toast hidden></div>`;

// ================= DEEP DATA =================
// Видимые по умолчанию колонки (Channels tab); остальные скрыты (управляются «Columns»).
const DEEP_COLS = [
  { id:"name", w:280, label:"Channel", pin:true, sort:true, kind:"channel" },
  { id:"stub", w:20, stub:true },
  { id:"subs", w:120, label:"Subs", sort:true },
  { id:"views", w:120, label:"Views", sort:true },
  { id:"subsg", w:120, label:"Subs+", sort:true, delta:true },
  { id:"viewsg", w:120, label:"Views+", sort:true, delta:true },
  { id:"pvco", w:160, label:"PVCO", sort:true, delta:true },
  { id:"pvn", w:150, label:"PVN all", metric:true },
  { id:"pvc", w:150, label:"PVC all", metric:true },
  { id:"pec", w:150, label:"PEC all", metric:true },
  { id:"mev", w:150, label:"MEV all", metric:true },
  { id:"meer", w:160, label:"MEER all", metric:true },
];
// средние по коллекции (пороги для хитмапа); порядок = метрики после Channel/stub
const DEEP_AVG = ["3.5m","4.6bn","9.1k","54.1m","9.6m","1k","44.5m","1.1m","16.1k","964.7k"];
// строки: [имя, инициал, subs, views, subs+, views+, pvco, pvn, pvc, pec, mev, meer] — реальная коллекция «News UA - Big Media» с прода
const DEEP_ROWS = [
  ["24 Канал","24","9m","17.5bn","+30k","+283.5m","+41.5m","2.8k","242m","5.6m","41.4k","1.1m"],
  ["Новини.LIVE","Н","2.9m","3.9bn","+20k","+117.7m","+30.1m","1.9k","87.7m","1.3m","8.9k","760k"],
  ["ТСН","Т","5.9m","8.7bn","+15.9k","+114.8m","+19.4m","2.4k","95.4m","1.7m","13.1k","900k"],
  ["Телеканал 1+1","1","5.5m","5.8bn","+20k","+70m","+18.1m","788","51.9m","1.4m","14.5k","700k"],
  ["Фабрика новин","Ф","4.3m","6.6bn","+4.3k","+42.1m","+139.5k","1.1k","42m","1.5m","23.2k","850k"],
  ["Факти ICTV","Ф","3.7m","4.2bn","+10k","+30.7m","+7.5m","1.1k","23.2m","503k","8.7k","600k"],
  ["5 канал","5","3.5m","3.8bn","+5.7k","+29.2m","+5.4m","1.1k","23.8m","934.6k","8.6k","620k"],
];
function toNum(v){ v=String(v).replace("+","").trim(); var m=v.match(/^([\d.]+)\s*(bn|m|k|%)?/); if(!m) return 0; var n=parseFloat(m[1])||0, u=m[2]; if(u==="bn")n*=1e9; else if(u==="m")n*=1e6; else if(u==="k")n*=1e3; return n; }

function deepHeadCell(c){
  let cls = "an-th";
  let style = "width:" + c.w + "px";
  if (c.pin) { cls += " an-th--pin an-th--name"; style += ";left:0"; }
  if (c.stub) cls += " an-th--stub";
  let inner = "";
  if (c.stub) inner = "";
  else if (c.kind === "channel") inner = '<span class="an-sort" role="button" tabindex="0">' + c.label + IC.sort + '</span>';
  else if (c.metric) inner = '<span class="an-sort an-sort--metric" role="button" tabindex="0">' + c.label + IC.sort + '<span class="and-colx" aria-hidden="true">' + IC.closeBold + '</span></span>';
  else if (c.sort) inner = '<span class="an-sort" role="button" tabindex="0">' + c.label + IC.sort + '</span>';
  else inner = c.label;
  return '<div class="' + cls + '" style="' + style + '">' + inner + '</div>';
}
function deepMetricCell(val, avg, isDelta){
  const tint = toNum(val) >= toNum(avg) ? "pos" : "neg";
  const txt = isDelta && String(val)[0] === "+" ? '<span class="an-delta--pos">' + esc(val) + '</span>' : esc(val);
  return txt;
}
function deepAvgRow(){
  const cells = [];
  cells.push('<div class="an-td an-td--pin an-td--name" style="width:280px;left:0"><button class="an-collsel and-avg" type="button">Average ' + IC.chevDown + '</button></div>');
  cells.push('<div class="an-td an-td--stub" style="width:20px"></div>');
  let ai = 0;
  DEEP_COLS.forEach(function(c){
    if (c.kind === "channel" || c.stub) return;
    cells.push('<div class="an-td" style="width:' + c.w + 'px">' + esc(DEEP_AVG[ai]) + '</div>');
    ai++;
  });
  return '<div class="an-tr an-tr--avg">' + cells.join("") + '</div>';
}
function deepBodyRow(r, i){
  const color = AVA[i % AVA.length];
  const cells = [];
  cells.push('<div class="an-td an-td--pin an-td--name" style="width:280px;left:0">' +
    '<div class="and-chan">' +
      '<button class="and-rowact" type="button" aria-label="Pin">' + IC.pin + '</button>' +
      '<button class="and-rowact" type="button" aria-label="Bookmark">' + IC.bookmark + '</button>' +
      '<a class="and-chan__link" href="#" tabindex="-1"><span class="an-chan__ava" style="background:var(' + color + ')">' + esc(r[1]) + '</span>' +
      '<span class="an-chan__name">' + esc(r[0]) + '</span></a>' +
      '<span class="an-chan__fade"></span>' +
      '<button class="and-open" type="button" aria-label="Open channel">' + IC.channelPage + '</button>' +
    '</div></div>');
  cells.push('<div class="an-td an-td--stub" style="width:20px"></div>');
  let ai = 0;
  DEEP_COLS.forEach(function(c){
    if (c.kind === "channel" || c.stub) return;
    const val = r[2 + ai];
    const tint = toNum(val) >= toNum(DEEP_AVG[ai]) ? "pos" : "neg";
    cells.push('<div class="an-td an-td--metric" style="width:' + c.w + 'px"><span class="an-heat an-heat--' + tint + '">' + deepMetricCell(val, DEEP_AVG[ai], !!c.delta) + '</span></div>');
    ai++;
  });
  return '<div class="an-tr">' + cells.join("") + '</div>';
}

const deepHead = '<div class="an-tr an-tr--head">' + DEEP_COLS.map(deepHeadCell).join("") + '</div>';
const deepBody = deepAvgRow() + "\n          " + DEEP_ROWS.map(deepBodyRow).join("\n          ");

const deepInner = `
    <section class="an-page">
      <header class="an-head"><h1 class="an-title">Deep data</h1></header>

      <nav class="an-tabs">
        <button class="an-tab is-active" type="button">Channels</button>
        <button class="an-tab" type="button">Videos</button>
      </nav>

      <section class="an-toolbar">
        <button class="an-btn an-btn--secondary" type="button">${IC.columns}Columns</button>
        <button class="an-btn an-btn--secondary" type="button">${IC.filter}Filters</button>
        <button class="an-btn an-btn--secondary" type="button">${IC.export}Export</button>
      </section>

      <section class="an-pagi">
        <div class="an-pagi__label">
          <span class="an-pagi__name">Channels in collection</span>
          <button class="an-collsel" type="button"><span class="an-collsel__txt" data-ai-collname>News UA - Big Media</span>${IC.chevSelect}</button>
          <span class="ai-badge" data-ai-badge hidden>${IC.aiStarsSolid}${AI_BADGE}</span>
          <span class="an-pagi__dot"></span>
          <span class="an-pagi__total">15</span>
        </div>
        <div class="an-pagi__ctrls">
          <span class="an-pagi__pages">Pages: 1</span>
          <div class="an-pagi__nav">
            <button class="an-pagi__arrow" type="button" aria-label="Previous Page">${IC.arrowL}</button>
            <input class="an-pagi__page" type="text" value="1" aria-label="Page number" />
            <button class="an-pagi__arrow" type="button" aria-label="Next Page">${IC.arrowR}</button>
          </div>
          <button class="an-perpage" type="button">30 ${IC.arrowDown}</button>
        </div>
      </section>

      <!-- Блок AI-коллекции: Query + применённые фильтры (только для AI-коллекций) -->
      <section class="ai-block" data-ai-block hidden>
        <div class="ai-block__line">
          <span class="ai-block__k">Sourcing query</span>
          <span class="ai-block__q" data-ai-block-query></span>
        </div>
        <div class="ai-block__line">
          <span class="ai-block__k">Applied filters</span>
          <span class="ai-chips" data-ai-block-chips></span>
        </div>
      </section>

      <section class="an-tablewrap">
        <div class="an-table">
          <div class="an-thead">${deepHead}</div>
          <div class="an-tbody">
          ${deepBody}
          </div>
        </div>
      </section>
    </section>

    <div class="an-toast" data-an-toast hidden></div>`;

// ================= MY COLLECTIONS =================
const COLL_COLS = [
  { id:"name", w:240, label:"Name", sort:true },
  { id:"status", w:320, label:"Status", sort:true },
  { id:"quantity", w:120, label:"Quantity", sort:true },
  { id:"includes", w:350, label:"Includes", grow:true },
  { id:"created", w:140, label:"Created on", sort:true },
  { id:"owner", w:160, label:"Owner" },
  { id:"shared", w:120, label:"Shared with" },
  { id:"actions", w:120, label:"" },
];
const COLL_ROWS = [
  { name:"News UA - Big Media", status:"activated", qty:15, includes:["24 Канал","Телеканал Прямий"], more:13,
    created:"19.05.2023", owner:{ name:"Oleh", c:"--color-avatar-1", i:"O" },
    shared:[{c:"--color-avatar-3",i:"N"},{c:"--color-avatar-1",i:"O"}] },
  { name:"Crypto", status:"activated", qty:35, includes:["Crypto Moon","Smart Risk"], more:33,
    created:"27.06.2025", owner:{ name:"Olena Bakhtii", c:"--color-avatar-5", i:"O" },
    shared:[{c:"--color-avatar-3",i:"O"}] },
  // остальные статусы (created / pending / inactive) — как на проде у новых коллекций
  { name:"Gaming UA", status:"created", qty:8, includes:["Zems Racing","Hunt Squad"], more:6,
    created:"12.07.2026", owner:{ name:"You", c:"--color-avatar-1", i:"Y" }, shared:[] },
  { name:"Tech Reviews", status:"pending", qty:22, includes:["GadgetLab","TechNova"], more:20,
    created:"20.07.2026", owner:{ name:"You", c:"--color-avatar-1", i:"Y" }, shared:[{c:"--color-avatar-5",i:"A"}] },
];

function collHeadCell(c){
  let cls = "an-th" + (c.grow ? " an-th--grow" : "");
  let inner = c.sort ? '<span class="an-sort" role="button" tabindex="0">' + c.label + IC.sort + '</span>' : c.label;
  return '<div class="' + cls + '" style="width:' + c.w + 'px">' + inner + '</div>';
}
function ava(a, cls){ return '<span class="' + (cls || "mc-ava") + '" style="background:var(' + a.c + ')">' + esc(a.i) + '</span>'; }
function collRow(r){
  const cells = [];
  cells.push('<div class="an-td" style="width:240px"><span class="mc-name">' + esc(r.name) + '</span></div>');
  // статус — ОДНА пилюля: иконка + подпись + разделитель + ссылка внутри (как на проде)
  let st = '';
  if (r.status === "activated") {
    st = '<span class="mc-status mc-status--green">' + IC.thumbUp + '<span class="mc-status__t">Activated</span>' +
         '<span class="mc-status__sep"></span><a class="mc-status__link" href="analytics-deep-data.html">View deep data</a></span>';
  } else if (r.status === "pending") {
    st = '<span class="mc-status mc-status--orange">' + IC.progress + '<span class="mc-status__t">Collecting data</span></span>';
  } else if (r.status === "created") {
    st = '<span class="mc-status mc-status--gray">' + IC.check + '<span class="mc-status__t">Created</span>' +
         '<span class="mc-status__sep"></span><button class="mc-status__link" type="button" data-mc-activate>Activate deep data</button></span>';
  } else if (r.status === "inactive") {
    st = '<span class="mc-status mc-status--gray">' + IC.archive + '<span class="mc-status__t">Deactivated</span>' +
         '<span class="mc-status__sep"></span><button class="mc-status__link" type="button" data-mc-activate>Activate deep data</button></span>';
  }
  cells.push('<div class="an-td" style="width:320px"><div class="mc-statuscell">' + st + '</div></div>');
  cells.push('<div class="an-td" style="width:120px">' + r.qty + '</div>');
  // includes (grow)
  let chips = r.includes.map(function (n) { return '<span class="mc-chip">' + esc(n) + '</span>'; }).join("");
  if (r.more) chips += '<span class="mc-chip">+' + r.more + '</span>';
  cells.push('<div class="an-td an-td--grow" style="width:350px"><div class="mc-chips">' + chips + '</div></div>');
  cells.push('<div class="an-td" style="width:140px">' + esc(r.created) + '</div>');
  cells.push('<div class="an-td" style="width:160px"><span class="mc-owner">' + ava(r.owner) + '<span class="mc-owner__name">' + esc(r.owner.name) + '</span></span></div>');
  cells.push('<div class="an-td" style="width:120px"><span class="mc-shared">' + r.shared.map(function (a) { return ava(a); }).join("") + '</span></div>');
  cells.push('<div class="an-td" style="width:120px"><button class="mc-more" type="button" aria-label="Actions" data-mc-more data-status="' + r.status + '" data-name="' + esc(r.name) + '">' + IC.dots + '</button></div>');
  return '<div class="an-tr" data-mc-row data-name="' + esc(r.name) + '">' + cells.join("") + '</div>';
}
const collHead = '<div class="an-tr an-tr--head">' + COLL_COLS.map(collHeadCell).join("") + '</div>';
const collBody = COLL_ROWS.map(collRow).join("\n          ");

const collInner = `
    <section class="an-page">
      <header class="an-head an-head--between">
        <h1 class="an-title">My collections</h1>
        <div class="an-head__btns">
          <button class="an-btn an-btn--ai" type="button" data-ai-open>${IC.aiStarsSolid}${AI_LABEL}</button>
          <button class="an-btn an-btn--primary" type="button" data-mc-create-open>${IC.collections}Create Collection</button>
        </div>
      </header>

      <section class="an-toolbar">
        <div class="mc-search">${IC.search}<input type="text" placeholder="Search..." /></div>
        <button class="an-btn an-btn--secondary" type="button">${IC.filter}Filters</button>
      </section>

      <section class="an-pagi">
        <div class="an-pagi__label">
          <span class="an-pagi__name">Collections</span>
          <span class="an-pagi__dot"></span>
          <span class="an-pagi__total">${COLL_ROWS.length}</span>
        </div>
        <div class="an-pagi__ctrls">
          <span class="an-pagi__pages">Pages: 1</span>
          <div class="an-pagi__nav">
            <button class="an-pagi__arrow" type="button" aria-label="Previous Page">${IC.arrowL}</button>
            <input class="an-pagi__page" type="text" value="1" aria-label="Page number" />
            <button class="an-pagi__arrow" type="button" aria-label="Next Page">${IC.arrowR}</button>
          </div>
          <button class="an-perpage" type="button">15 ${IC.arrowDown}</button>
        </div>
      </section>

      <section class="an-tablewrap an-tablewrap--surface">
        <div class="an-table an-table--fill">
          <div class="an-thead">${collHead}</div>
          <div class="an-tbody" data-mc-tbody>
          ${collBody}
          </div>
        </div>
      </section>
    </section>

    <!-- меню действий строки (⋮) -->
    <div class="mc-menu" id="mcMenu" hidden>
      <button class="mc-menu__item" type="button" data-mc-act="view">${IC.graph}View deep data</button>
      <button class="mc-menu__item" type="button" data-mc-act="edit">${IC.edit}Edit collection</button>
      <button class="mc-menu__item" type="button" data-mc-act="share">${IC.share}Share collection</button>
      <button class="mc-menu__item mc-menu__item--danger" type="button" data-mc-act="deactivate">${IC.archive}Deactivate collection</button>
      <button class="mc-menu__item mc-menu__item--danger" type="button" data-mc-act="delete">${IC.trash}Delete collection</button>
    </div>

    ${mcCreateModalHtml}

    <!-- Delete confirm -->
    <div class="an-modal" id="mcModal-delete"><div class="an-modal__overlay" data-mc-close></div>
      <div class="an-modal__dialog an-modal__dialog--sm">
        <div class="an-modal__head">
          <h2 class="an-modal__title">Delete collection?</h2>
          <button class="an-modal__x" type="button" data-mc-close aria-label="Close">${IC.closeBold}</button>
        </div>
        <div class="an-modal__body">
          <p class="an-modal__text">This action cannot be undone. The collection will be permanently deleted.</p>
        </div>
        <div class="an-modal__foot">
          <button class="an-btn an-btn--secondary an-btn--small" type="button" data-mc-close>Cancel</button>
          <button class="an-btn an-btn--danger an-btn--small" type="button" data-mc-delete-confirm>Delete</button>
        </div>
      </div>
    </div>

    <!-- Deactivate confirm -->
    <div class="an-modal" id="mcModal-deactivate"><div class="an-modal__overlay" data-mc-close></div>
      <div class="an-modal__dialog an-modal__dialog--sm">
        <div class="an-modal__head">
          <h2 class="an-modal__title">Deactivate collection?</h2>
          <button class="an-modal__x" type="button" data-mc-close aria-label="Close">${IC.closeBold}</button>
        </div>
        <div class="an-modal__body">
          <p class="an-modal__text">Deep data of the collection will be deactivated and no longer available.</p>
        </div>
        <div class="an-modal__foot">
          <button class="an-btn an-btn--secondary an-btn--small" type="button" data-mc-close>Cancel</button>
          <button class="an-btn an-btn--danger an-btn--small" type="button" data-mc-deactivate-confirm>Deactivate</button>
        </div>
      </div>
    </div>

    <!-- Share collection -->
    <div class="an-modal" id="mcModal-share"><div class="an-modal__overlay" data-mc-close></div>
      <div class="an-modal__dialog an-modal__dialog--sm">
        <div class="an-modal__head">
          <h2 class="an-modal__title">Share collection</h2>
          <button class="an-modal__x" type="button" data-mc-close aria-label="Close">${IC.closeBold}</button>
        </div>
        <div class="an-modal__body">
          <label class="an-label">Shared with</label>
          <div class="mc-search mc-search--full">${IC.search}<input type="text" placeholder="Select user" /></div>
          <div class="mc-sharelist">
            <div class="mc-shareitem"><span class="mc-ava" style="background:var(--color-avatar-3)">N</span><span class="mc-owner__name">Nick Rohynets</span><button class="mc-more" type="button" aria-label="Remove">${IC.closeBold}</button></div>
            <div class="mc-shareitem"><span class="mc-ava" style="background:var(--color-avatar-1)">O</span><span class="mc-owner__name">Oleh</span><button class="mc-more" type="button" aria-label="Remove">${IC.closeBold}</button></div>
          </div>
        </div>
        <div class="an-modal__foot">
          <button class="an-btn an-btn--secondary an-btn--small" type="button" data-mc-close>Cancel</button>
          <button class="an-btn an-btn--primary an-btn--small" type="button" data-mc-close>Save</button>
        </div>
      </div>
    </div>

    ${aiModalHtml}

    <div class="an-toast" data-an-toast hidden></div>`;

// ================= COLLECTION (открытая коллекция = «Editing collection») =================
// Перенос app.subsub.io/analytics/collections/channels/<id>: форма (Name/Shared with/поиск),
// таблица каналов коллекции и фиксированный футер с действиями.
const CE_COLS = [
  { w: 240, label: "Channel" },
  { w: 120, label: "Views" },
  { w: 120, label: "Subs" },
  { w: 200, label: "Link" },
  { w: 100, label: "" },
];
const CE_ROWS = [
  ["Cocomelon - Nursery Rhymes", "C", "--color-avatar-3", "225bn", "202m"],
  ["김프로KIMPRO", "김", "--color-avatar-1", "150.7bn", "134m"],
  ["T-Series", "T", "--color-avatar-1", "349.6bn", "314m"],
  ["MrBeast", "M", "--color-avatar-5", "134.7bn", "510m"],
  ["SET India", "S", "--color-avatar-3", "190.6bn", "189m"],
];
const ceHead = '<div class="an-tr an-tr--head">' + CE_COLS.map(function (c) {
  return '<div class="an-th" style="width:' + c.w + 'px">' + c.label + '</div>';
}).join("") + '</div>';
const ceBody = CE_ROWS.map(function (r) {
  return '<div class="an-tr" data-ce-row>' +
    '<div class="an-td" style="width:240px"><span class="ce-chan"><span class="mc-ava ce-ava" style="background:var(' + r[2] + ')">' + esc(r[1]) + '</span>' +
      '<span class="ce-chan__name">' + esc(r[0]) + '</span></span></div>' +
    '<div class="an-td ce-num" style="width:120px">' + esc(r[3]) + '</div>' +
    '<div class="an-td ce-num" style="width:120px">' + esc(r[4]) + '</div>' +
    '<div class="an-td" style="width:200px"><a class="ce-view" href="#" tabindex="-1">View channel</a></div>' +
    '<div class="an-td" style="width:100px"><button class="ce-trash" type="button" aria-label="Remove channel" data-ce-remove>' + IC.trash + '</button></div>' +
  '</div>';
}).join("\n          ");

const editInner = `
    <section class="an-page ce-page">
      <a class="ce-back" href="analytics-collections.html">${IC.arrowL}Back</a>
      <header class="an-head"><h1 class="an-title">Editing collection</h1><span class="ai-badge ce-badge" data-ai-badge hidden>${IC.aiStarsSolid}${AI_BADGE}</span></header>

      <div class="ce-form">
        <div class="ce-field">
          <label class="ce-lbl" for="ceName">Name collection</label>
          <input class="an-input" id="ceName" type="text" value="Test Collection" data-ce-name />
        </div>

        <div class="ce-field">
          <label class="ce-lbl">Shared with</label>
          <button class="ce-select" type="button">
            <span class="ce-select__ph">Select user</span>
            <span class="ce-select__chev">${IC.chevSelect}</span>
          </button>
        </div>

        <div class="mc-search ce-search">${IC.search}<input type="text" placeholder="Search by channel title, link" /></div>

        <section class="ai-block ce-aiblock" data-ai-block hidden>
          <div class="ai-block__line">
            <span class="ai-block__k">Sourcing query</span>
            <span class="ai-block__q" data-ai-block-query></span>
          </div>
          <div class="ai-block__line">
            <span class="ai-block__k">Applied filters</span>
            <span class="ai-chips" data-ai-block-chips></span>
          </div>
        </section>

        <div class="an-table an-table--fill ce-table">
          <div class="an-thead">${ceHead}</div>
          <div class="an-tbody">
          ${ceBody}
          </div>
        </div>
      </div>
    </section>

    <div class="ce-footer">
      <div class="ce-footer__inner">
        <button class="an-btn an-btn--danger an-btn--huge" type="button">${IC.trash}Delete</button>
        <button class="an-btn an-btn--danger an-btn--huge" type="button">Deactivate</button>
        <span class="ce-footer__spacer"></span>
        <button class="an-btn an-btn--secondary an-btn--huge" type="button">Add channels</button>
        <button class="an-btn an-btn--secondary an-btn--huge" type="button">Save</button>
      </div>
    </div>

    <div class="an-toast" data-an-toast hidden></div>`;

function buildPage(src, title, inner, current){
  let h = src;
  h = h.replace("<title>Home — SubSub</title>", "<title>" + title + " — SubSub</title>");
  h = h.replace('class="sidebar-item sidebar-item--home is-active"', 'class="sidebar-item sidebar-item--home"');
  h = h.replace('id="space-analytics" value="analytics" />', 'id="space-analytics" value="analytics" checked />');
  h = h.replace("<body>", '<body class="is-open" data-space="analytics">');
  h = h.replace('<p class="submenu__title" id="submenuTitle"></p>', '<p class="submenu__title" id="submenuTitle">Analytics</p>');
  h = h.replace('<div class="submenu__menu" data-space="analytics" hidden>', '<div class="submenu__menu" data-space="analytics">');
  // подсветка активного подпункта (ссылки уже проставлены генератором меню)
  const markCurrent = (url, isCur) => {
    if (!isCur) return;
    h = h.replace('<a class="m-item" href="' + url + '"', '<a class="m-item is-current" href="' + url + '"');
  };
  markCurrent("analytics-basic-data.html", current === "basic");
  markCurrent("analytics-deep-data.html", current === "deep");
  markCurrent("analytics-collections.html", current === "collections");
  // базовые коллекции (те же, что в списке My collections) — единый источник для дропдауна
  // назначения в модалке sourcing; страницы Basic data / My collections читают их из window
  const seed = JSON.stringify(COLL_ROWS.map(function (r) {
    return { name: r.name, status: r.status, qty: r.qty, channels: r.includes.slice() };
  }));
  // каналы для подсказок в поле «Add channel» (референсы) — те же, что в таблице Basic data
  const chSeed = JSON.stringify(ROWS.map(function (r, i) {
    return { name: r[0], initial: r[1], color: AVA[i % AVA.length] };
  }));
  h = h.replace('<script src="js/nav.js"></script>',
    '<script src="js/nav.js"></script>\n  <script>window.SUBSUB_BASE_COLLECTIONS = ' + seed + ';' +
    'window.SUBSUB_CHANNELS = ' + chSeed + ';</script>' +
    '\n  <script src="js/analytics.js"></script>');
  const ms = h.indexOf('<main class="main">');
  const me = h.indexOf("</main>", ms);
  return h.slice(0, ms + '<main class="main">'.length) + inner + "\n  " + h.slice(me);
}

fs.writeFileSync(DIR + "analytics-basic-data.html", buildPage(html, "Basic data", mainInner, "basic"));
fs.writeFileSync(DIR + "analytics-deep-data.html", buildPage(html, "Deep data", deepInner, "deep"));
fs.writeFileSync(DIR + "analytics-collections.html", buildPage(html, "My collections", collInner, "collections"));
fs.writeFileSync(DIR + "analytics-collection-edit.html", buildPage(html, "Editing collection", editInner, "collections"));
console.log("written: basic-data (" + ROWS.length + "), deep-data (" + DEEP_ROWS.length + "), collections (" + COLL_ROWS.length + "), collection-edit (" + CE_ROWS.length + ")");

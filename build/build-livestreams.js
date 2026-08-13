const fs = require("fs");
const DIR = "E:/Dev SubSub/subsub_front_prototype_31.07.26/";
let html = fs.readFileSync(DIR + "home.html", "utf8");

function esc(s){ return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

// ---- inline icons — ТОЧНЫЕ SVG из дизайн-системы (layers/core/.../icons/*.vue) --------
const IC = {
  stream: '<svg viewBox="0 0 24 24" fill="none"><path d="M19.1414 5C20.9097 6.80375 22 9.27455 22 12C22 14.7578 20.8836 17.2549 19.0782 19.064M5 19.1414C3.14864 17.3265 2 14.7974 2 12C2 9.23497 3.12222 6.73205 4.93603 4.92184" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M16.2849 8.04397C17.3458 9.05877 18 10.4488 18 11.9822C18 13.5338 17.3302 14.9386 16.2469 15.9564M7.8 16C6.68918 14.9789 6 13.556 6 11.9822C6 10.4266 6.67333 9.01843 7.76162 8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M13.6563 10.4511C14.5521 11.1088 15 11.4376 15 12C15 12.5624 14.5521 12.8913 13.6563 13.5489C13.4091 13.7305 13.1638 13.9014 12.9384 14.0438C12.7407 14.1688 12.5168 14.298 12.2849 14.4249C11.3913 14.914 10.9444 15.1586 10.5437 14.8878C10.1429 14.6171 10.1065 14.0503 10.0337 12.9166C10.0131 12.596 10 12.2818 10 12C10 11.7183 10.0131 11.404 10.0337 11.0834C10.1065 9.94979 10.1429 9.38298 10.5437 9.11222C10.9444 8.84146 11.3913 9.08602 12.2849 9.57512C12.5168 9.702 12.7407 9.83125 12.9384 9.95621C13.1638 10.0986 13.4091 10.2696 13.6563 10.4511Z" stroke="currentColor" stroke-width="1.5"/></svg>',
  card: '<svg viewBox="0 0 24 24" fill="none"><path d="M19 20V14M19 14L21 16M19 14L17 16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M22 12C22 8.22876 22 6.34315 20.8284 5.17157C19.6569 4 17.7712 4 14 4H10C6.22876 4 4.34315 4 3.17157 5.17157C2 6.34315 2 8.22876 2 12C2 15.7712 2 17.6569 3.17157 18.8284C4.34315 20 6.22876 20 10 20H14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M10 16H6" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M13 16H12.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M2 10L22 10" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none"><path d="M10.6154 18.2307C14.8212 18.2307 18.2307 14.8212 18.2307 10.6154C18.2307 6.40951 14.8212 3 10.6154 3C6.40951 3 3 6.40951 3 10.6154C3 14.8212 6.40951 18.2307 10.6154 18.2307Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M21.0004 20.9985L16.1543 16.1523" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  save: '<svg viewBox="0 0 24 24" fill="none"><path d="M6 8.33333L12 15M12 15L18 8.33333M12 15L12 3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M3 17L3 18.3333C3 19.8061 4.15127 21 5.57143 21L18.4286 21C19.8487 21 21 19.8061 21 18.3333V17" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  filter: '<svg viewBox="0 0 24 24" fill="none"><path d="M3 7H21" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M6 12H18" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M10 17H14" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  sort: '<svg class="ls-sort" viewBox="0 0 16 16" fill="none"><path d="M5 6.5L8 3.5L11 6.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 9.5L8 12.5L11 9.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  chevDown: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>',
  arrowBack: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>',
  chevLeft: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M15 6l-6 6 6 6"/></svg>',
  chevRight: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>',
  youtube: '<svg viewBox="0 0 23 16" fill="none"><path d="M22.3523 2.50551C22.2212 2.02123 21.9655 1.57974 21.6106 1.22498C21.2557 0.870223 20.814 0.614585 20.3295 0.483521C18.5557 0 11.417 0 11.417 0C11.417 0 4.27787 0.0146359 2.50412 0.498157C2.01962 0.629228 1.57791 0.88488 1.223 1.23965C0.868092 1.59443 0.612358 2.03594 0.481267 2.52023C-0.0552507 5.67035 -0.263376 10.4704 0.495999 13.4945C0.627104 13.9788 0.882844 14.4203 1.23775 14.775C1.59266 15.1298 2.03436 15.3854 2.51886 15.5165C4.29261 16 11.4315 16 11.4315 16C11.4315 16 18.5704 16 20.344 15.5165C20.8285 15.3854 21.2703 15.1298 21.6252 14.775C21.9801 14.4203 22.2359 13.9788 22.367 13.4945C22.9329 10.3399 23.1072 5.54282 22.3523 2.50551Z" fill="currentColor"/><path d="M9.14478 11.4284L15.0669 7.99984L9.14478 4.57129V11.4284Z" fill="#fff"/></svg>',
  key: '<svg viewBox="0 0 24 24" fill="none"><path d="M8.7375 11.5125C8.41238 10.7149 8.24676 9.86131 8.25 9C8.25 7.66498 8.64588 6.35994 9.38758 5.2499C10.1293 4.13987 11.1835 3.27471 12.4169 2.76382C13.6503 2.25292 15.0075 2.11925 16.3169 2.3797C17.6262 2.64015 18.829 3.28303 19.773 4.22703C20.717 5.17104 21.3599 6.37377 21.6203 7.68314C21.8808 8.99252 21.7471 10.3497 21.2362 11.5831C20.7253 12.8165 19.8601 13.8707 18.7501 14.6124C17.6401 15.3541 16.335 15.75 15 15.75C14.1387 15.7532 13.2851 15.5876 12.4875 15.2625L11.25 16.5H9V18.75H6.75V21H3V17.25L8.7375 11.5125Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M16.875 8.625C17.7034 8.625 18.375 7.95343 18.375 7.125C18.375 6.29657 17.7034 5.625 16.875 5.625C16.0466 5.625 15.375 6.29657 15.375 7.125C15.375 7.95343 16.0466 8.625 16.875 8.625Z" fill="currentColor"/></svg>',
  inbox: '<svg viewBox="0 0 16 16" fill="none"><path d="M14.6654 8H10.6654L9.33203 10H6.66536L5.33203 8H1.33203" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M3.63203 3.40663L1.33203 7.99996V12C1.33203 12.3536 1.47251 12.6927 1.72256 12.9428C1.9726 13.1928 2.31174 13.3333 2.66536 13.3333H13.332C13.6857 13.3333 14.0248 13.1928 14.2748 12.9428C14.5249 12.6927 14.6654 12.3536 14.6654 12V7.99996L12.3654 3.40663C12.255 3.18448 12.0848 2.99754 11.874 2.86681C11.6632 2.73608 11.4201 2.66676 11.172 2.66663H4.82536C4.57731 2.66676 4.33421 2.73608 4.12339 2.86681C3.91258 2.99754 3.74242 3.18448 3.63203 3.40663V3.40663Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  chart: '<svg viewBox="0 0 24 24" fill="none"><path d="M4 4V19.9999H19.9999" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M7.69238 11.3838L10.7693 14.4608L15.6923 7.07617L20 10.1531" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none"><path d="M3.00146 6.75033H21.0003" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M5.25098 6.75033H18.7501V20.2495C18.7501 20.6473 18.592 21.0288 18.3108 21.3101C18.0296 21.5913 17.648 21.7494 17.2502 21.7494H6.75088C6.35308 21.7494 5.97158 21.5913 5.69028 21.3101C5.40901 21.0288 5.25098 20.6473 5.25098 20.2495V6.75033Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M8.25098 6.75033V6.00038C8.25098 5.00588 8.64604 4.0521 9.34925 3.34889C10.0525 2.64567 11.0062 2.25061 12.0007 2.25061C12.9952 2.25061 13.949 2.64567 14.6522 3.34889C15.3555 4.0521 15.7505 5.00588 15.7505 6.00038V6.75033" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M9.75049 11.2523V17.2542" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M14.251 11.2523V17.2542" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
  stopSq: '<svg viewBox="0 0 24 24" fill="none"><path d="M5 8.2002V15.8002C5 16.9203 5 17.4796 5.21799 17.9074C5.40973 18.2837 5.71547 18.5905 6.0918 18.7822C6.5192 19 7.07899 19 8.19691 19H15.8036C16.9215 19 17.4805 19 17.9079 18.7822C18.2842 18.5905 18.5905 18.2837 18.7822 17.9074C19 17.48 19 16.921 19 15.8031V8.19691C19 7.07899 19 6.5192 18.7822 6.0918C18.5905 5.71547 18.2842 5.40973 17.9079 5.21799C17.4801 5 16.9203 5 15.8002 5H8.2002C7.08009 5 6.51962 5 6.0918 5.21799C5.71547 5.40973 5.40973 5.71547 5.21799 6.0918C5 6.51962 5 7.08009 5 8.2002Z" fill="currentColor"/></svg>',
  live: '<svg viewBox="0 0 16 16" fill="none"><path d="M12.761 3.33333C13.9398 4.53583 14.6667 6.18303 14.6667 8C14.6667 9.83854 13.9224 11.5033 12.7188 12.7093M3.33334 12.761C2.0991 11.551 1.33334 9.86493 1.33334 8C1.33334 6.15665 2.08149 4.48803 3.2907 3.28123" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M10.8566 5.36265C11.5639 6.03918 12 6.9659 12 7.98813C12 9.02251 11.5535 9.95908 10.8313 10.6376M5.2 10.6667C4.45946 9.98595 4 9.03735 4 7.98813C4 6.95106 4.44889 6.01229 5.17441 5.33333" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M9.10422 6.96742C9.7014 7.40586 9.99999 7.62508 9.99999 8.00002C9.99999 8.37496 9.7014 8.59418 9.10422 9.03261C8.93936 9.15365 8.77586 9.2676 8.62561 9.36256C8.49379 9.44586 8.34451 9.53203 8.18995 9.61662C7.59417 9.94269 7.29628 10.1057 7.02911 9.92522C6.76193 9.74471 6.73765 9.36684 6.68909 8.61109C6.67536 8.39737 6.66666 8.18785 6.66666 8.00002C6.66666 7.81219 6.67536 7.60267 6.68909 7.38894C6.73765 6.63319 6.76193 6.25532 7.02911 6.07481C7.29628 5.89431 7.59417 6.05734 8.18995 6.38341C8.34451 6.468 8.49379 6.55417 8.62561 6.63747C8.77586 6.73243 8.93936 6.84638 9.10422 6.96742Z" fill="currentColor"/></svg>',
  progress: '<svg viewBox="0 0 24 24" fill="none"><path d="M14.8356 3.24829H9.16564C5.87564 3.24829 5.62189 6.20579 7.39814 7.81579L16.6031 16.1808C18.3794 17.7908 18.1256 20.7483 14.8356 20.7483H9.16564C5.87564 20.7483 5.62189 17.7908 7.39814 16.1808L16.6031 7.81579C18.3794 6.20579 18.1256 3.24829 14.8356 3.24829Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none"><path fill-rule="evenodd" clip-rule="evenodd" d="M20.5334 4.285C21.0807 4.72253 21.1578 5.50641 20.7054 6.03585L10.3685 18.1353L10.3653 18.1389C10.1302 18.412 9.83512 18.631 9.50152 18.7798C9.1679 18.9288 8.80418 19.0039 8.43679 18.9998C8.06339 18.9954 7.69473 18.9091 7.36071 18.7475C7.02782 18.5866 6.73682 18.3549 6.50939 18.07C6.50862 18.069 6.50786 18.0681 6.50709 18.0671L3.27113 14.0428C2.83519 13.5007 2.93616 12.7193 3.49666 12.2977C4.05716 11.876 4.86493 11.9737 5.30087 12.5158L8.46828 16.4549L18.7232 4.45145C19.1756 3.92201 19.9861 3.84749 20.5334 4.285Z" fill="currentColor"/></svg>',
  alert: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 9V14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M11.9999 21.41H5.93993C2.46993 21.41 1.01993 18.93 2.69993 15.9L5.81993 10.28L8.75993 5C10.5399 1.79 13.4599 1.79 15.2399 5L18.1799 10.29L21.2999 15.91C22.9799 18.94 21.5199 21.42 18.0599 21.42H11.9999V21.41Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M11.9946 17H12.0036" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  rocket: '<svg viewBox="0 0 24 24" fill="none"><path d="M17.2792 12.7837L16.7293 12.2737L17.2792 12.7837ZM11.2163 6.72082L11.7263 7.27072L11.2163 6.72082ZM20.1579 5.46426L20.9015 5.56153L20.1579 5.46426ZM18.5357 3.84214L18.633 4.58581L18.633 4.58581L18.5357 3.84214ZM7.15375 12.648L7.82718 12.9781L7.15375 12.648ZM11.352 16.8463L11.0219 16.1728L11.352 16.8463ZM8.71522 10.4345C8.42232 10.1416 7.94745 10.1416 7.65456 10.4345C7.36166 10.7274 7.36166 11.2022 7.65456 11.4951L8.71522 10.4345ZM12.5049 16.3454C12.7978 16.6383 13.2726 16.6383 13.5655 16.3454C13.8584 16.0525 13.8584 15.5777 13.5655 15.2848L12.5049 16.3454ZM7.1995 17.8612C7.49239 17.5683 7.49239 17.0934 7.1995 16.8005C6.9066 16.5076 6.43173 16.5076 6.13884 16.8005L7.1995 17.8612ZM3.71368 19.2257C3.42079 19.5185 3.42079 19.9934 3.71368 20.2863C4.00658 20.5792 4.48145 20.5792 4.77434 20.2863L3.71368 19.2257ZM5.38063 16.0423C5.67353 15.7494 5.67353 15.2745 5.38063 14.9816C5.08774 14.6887 4.61286 14.6887 4.31997 14.9816L5.38063 16.0423ZM3.1074 16.1942C2.8145 16.4871 2.8145 16.962 3.1074 17.2549C3.40029 17.5478 3.87516 17.5478 4.16806 17.2549L3.1074 16.1942ZM9.01836 19.68C9.31125 19.3871 9.31125 18.9123 9.01836 18.6194C8.72547 18.3265 8.25059 18.3265 7.9577 18.6194L9.01836 19.68ZM6.74512 19.8319C6.45223 20.1248 6.45223 20.5997 6.74512 20.8926C7.03802 21.1855 7.51289 21.1855 7.80578 20.8926L6.74512 19.8319ZM10.6707 19.8772L11.4131 19.7712L10.6707 19.8772ZM15.0966 16.9064L15.839 16.8004L15.0966 16.9064ZM4.12274 13.3293L4.2288 12.5869L4.2288 12.5869L4.12274 13.3293ZM7.09355 8.90344L6.98748 9.64591L6.98748 9.64591L7.09355 8.90344ZM10.021 15.9844L8.01564 13.979L6.95498 15.0396L8.96036 17.045L10.021 15.9844ZM16.7293 12.2737C15.1201 14.0087 12.4996 15.4484 11.0219 16.1728L11.6822 17.5197C13.1754 16.7876 16.0169 15.2476 17.8291 13.2937L16.7293 12.2737ZM7.82718 12.9781C8.55161 11.5004 9.99129 8.8799 11.7263 7.27072L10.7063 6.17093C8.75238 7.98311 7.21236 10.8246 6.48032 12.3178L7.82718 12.9781ZM19.4142 5.367C19.154 7.35655 18.4646 10.4027 16.7293 12.2737L17.8291 13.2937C19.9075 11.0528 20.6367 7.58673 20.9015 5.56153L19.4142 5.367ZM11.7263 7.27072C13.5973 5.5354 16.6435 4.84602 18.633 4.58581L18.4385 3.09848C16.4133 3.36335 12.9472 4.09251 10.7063 6.17093L11.7263 7.27072ZM20.9015 5.56153C21.0916 4.10811 19.8919 2.90839 18.4385 3.09848L18.633 4.58581C19.1095 4.52349 19.4765 4.8905 19.4142 5.367L20.9015 5.56153ZM8.01564 13.979C7.73451 13.6979 7.66993 13.2989 7.82718 12.9781L6.48032 12.3178C6.02321 13.2502 6.24924 14.3339 6.95498 15.0396L8.01564 13.979ZM8.96036 17.045C9.6661 17.7508 10.7498 17.9768 11.6822 17.5197L11.0219 16.1728C10.7011 16.3301 10.3021 16.2655 10.021 15.9844L8.96036 17.045ZM7.65456 11.4951L12.5049 16.3454L13.5655 15.2848L8.71522 10.4345L7.65456 11.4951ZM6.13884 16.8005L3.71368 19.2257L4.77434 20.2863L7.1995 17.8612L6.13884 16.8005ZM4.31997 14.9816L3.1074 16.1942L4.16806 17.2549L5.38063 16.0423L4.31997 14.9816ZM7.9577 18.6194L6.74512 19.8319L7.80578 20.8926L9.01836 19.68L7.9577 18.6194ZM12.808 7.70618C11.8454 8.66876 11.8454 10.2294 12.808 11.192L13.8687 10.1313C13.4919 9.75454 13.4919 9.14363 13.8687 8.76684L12.808 7.70618ZM12.808 11.192C13.7706 12.1546 15.3312 12.1546 16.2938 11.192L15.2332 10.1313C14.8564 10.5081 14.2455 10.5081 13.8687 10.1313L12.808 11.192ZM16.2938 11.192C17.2564 10.2294 17.2564 8.66876 16.2938 7.70618L15.2332 8.76684C15.61 9.14363 15.61 9.75454 15.2332 10.1313L16.2938 11.192ZM16.2938 7.70618C15.3312 6.7436 13.7706 6.7436 12.808 7.70618L13.8687 8.76684C14.2455 8.39005 14.8564 8.39005 15.2332 8.76684L16.2938 7.70618ZM14.3237 17.1036L11.5954 19.8319L12.6561 20.8926L15.3844 18.1643L14.3237 17.1036ZM11.4131 19.7712L11.0494 17.2248L9.56443 17.4369L9.92821 19.9833L11.4131 19.7712ZM14.1116 15.3149L14.3541 17.0125L15.839 16.8004L15.5965 15.1028L14.1116 15.3149ZM11.5954 19.8319C11.5743 19.853 11.5574 19.8595 11.5445 19.8623C11.5286 19.8657 11.5078 19.8653 11.4855 19.8579C11.4632 19.8505 11.4464 19.8383 11.4357 19.826C11.427 19.8161 11.4174 19.8007 11.4131 19.7712L9.92821 19.9833C10.1155 21.2946 11.7195 21.8292 12.6561 20.8926L11.5954 19.8319ZM15.3844 18.1643C15.7421 17.8065 15.9106 17.3012 15.839 16.8004L14.3541 17.0125C14.3589 17.046 14.3476 17.0797 14.3237 17.1036L15.3844 18.1643ZM5.83567 8.61563L3.10738 11.3439L4.16804 12.4046L6.89633 9.67629L5.83567 8.61563ZM4.01667 14.0718L6.56308 14.4356L6.77521 12.9507L4.2288 12.5869L4.01667 14.0718ZM8.89722 8.4035L7.19962 8.16098L6.98748 9.64591L8.68509 9.88842L8.89722 8.4035ZM3.10738 11.3439C2.17075 12.2806 2.7054 13.8845 4.01667 14.0718L4.2288 12.5869C4.19926 12.5827 4.18391 12.573 4.17395 12.5643C4.16171 12.5537 4.14952 12.5368 4.14209 12.5145C4.13465 12.4922 4.13429 12.4714 4.1377 12.4556C4.14046 12.4426 4.14693 12.4257 4.16804 12.4046L3.10738 11.3439ZM6.89633 9.67629C6.92024 9.65238 6.95401 9.64112 6.98748 9.64591L7.19962 8.16098C6.69875 8.08943 6.19343 8.25787 5.83567 8.61563L6.89633 9.67629Z" fill="currentColor"/></svg>',
  attention: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm-1 5h2v7h-2V7zm0 9h2v2h-2v-2z"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" fill="none"><path d="M8 2V5" stroke="currentColor" stroke-width="1.5" stroke-miterlimit="10" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 2V5" stroke="currentColor" stroke-width="1.5" stroke-miterlimit="10" stroke-linecap="round" stroke-linejoin="round"/><path d="M3.5 9.09H20.5" stroke="currentColor" stroke-width="1.5" stroke-miterlimit="10" stroke-linecap="round" stroke-linejoin="round"/><path d="M21 8.5V17C21 20 19.5 22 16 22H8C4.5 22 3 20 3 17V8.5C3 5.5 4.5 3.5 8 3.5H16C19.5 3.5 21 5.5 21 8.5Z" stroke="currentColor" stroke-width="1.5" stroke-miterlimit="10" stroke-linecap="round" stroke-linejoin="round"/><path d="M15.6947 13.7H15.7037" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M15.6947 16.7H15.7037" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M11.9955 13.7H12.0045" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M11.9955 16.7H12.0045" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M8.29431 13.7H8.30329" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M8.29431 16.7H8.30329" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  film: '<svg viewBox="0 0 24 24" fill="none"><path fill-rule="evenodd" clip-rule="evenodd" d="M4.70552 10.7824L7.57942 9.96802C7.58236 9.94817 7.586 9.92828 7.59037 9.9084L8.55377 5.51833L10.2672 5.03281L10.2634 5.05115L9.29083 9.48308L12.8898 8.4633L12.8932 8.44736L13.8907 4.00609L15.609 3.51919L15.6062 3.53219L14.6081 7.97643L19.4772 6.59673L18.8147 3.98197C18.6356 3.27543 17.9489 2.85614 17.2808 3.04546L4.92857 6.54552C4.26046 6.73483 3.86396 7.46107 4.04299 8.1676L4.70552 10.7824ZM4.70723 10.7824H20V19.6756C20 20.4069 19.4393 21 18.7476 21H5.95965C5.26797 21 4.70723 20.4069 4.70723 19.6756V10.7824ZM7.43008 17.4087C7.43008 16.9516 7.78054 16.5809 8.21284 16.5809H9.92177C10.3541 16.5809 10.7045 16.9516 10.7045 17.4087C10.7045 17.8659 10.3541 18.2365 9.92177 18.2365H8.21284C7.78054 18.2365 7.43008 17.8659 7.43008 17.4087Z" fill="currentColor"/></svg>',
  upload: '<svg viewBox="0 0 24 24" fill="none"><path d="M16 16L12 12L8 16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 12V21" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M20.39 18.3905C21.3653 17.8587 22.1358 17.0174 22.5798 15.9991C23.0239 14.9808 23.1162 13.8437 22.8422 12.7672C22.5682 11.6906 21.9434 10.736 21.0666 10.0539C20.1898 9.37185 19.1108 9.00121 18 9.00047H16.74C16.4373 7.82971 15.8731 6.74281 15.0899 5.82147C14.3067 4.90012 13.3248 4.16832 12.2181 3.68108C11.1113 3.19384 9.90851 2.96383 8.70008 3.00835C7.49164 3.05288 6.30903 3.37077 5.24114 3.93814C4.17325 4.5055 3.24787 5.30757 2.53458 6.28405C1.82129 7.26053 1.33865 8.38601 1.12294 9.57587C0.90723 10.7657 0.964065 11.989 1.28917 13.1537C1.61428 14.3185 2.1992 15.3943 2.99996 16.3005" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M16 16L12 12L8 16" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
};

// статус-бейдж: mode (gray|green|orange|red) + иконка + подпись (как BaseStatus)
const STATUS = {
  live:              { mode:"red",    ic:IC.live,     label:"Live" },
  created:           { mode:"green",  ic:IC.check,    label:"Created" },
  processing:        { mode:"orange", ic:IC.progress, label:"Processing" },
  downloading:       { mode:"orange", ic:IC.progress, label:"Downloading" },
  ready:             { mode:"green",  ic:IC.check,    label:"Ready" },
  preparing:         { mode:"orange", ic:IC.progress, label:"Preparing" },
  scheduled:         { mode:"orange", ic:IC.progress, label:"Scheduled" },
  starting:          { mode:"orange", ic:IC.progress, label:"Starting" },
  stopping:          { mode:"orange", ic:IC.progress, label:"Stopping" },
  stopped:           { mode:"gray",   ic:IC.stopSq,   label:"Stopped" },
  needs_conversion:  { mode:"orange", ic:IC.alert,    label:"Needs conversion" },
  converting:        { mode:"orange", ic:IC.progress, label:"Converting" },
  conversion_failed: { mode:"red",    ic:IC.alert,    label:"Conversion failed" },
};
function statusBadge(st){
  const s = STATUS[st] || STATUS.stopped;
  return `<span class="ls-status ls-status--${s.mode}"><span class="ls-status__ic">${s.ic}</span>${s.label}</span>`;
}

// аватар канала (цветной кружок с инициалом — реальных фото в прототипе нет)
function chanAva(color, initial){ return `<span class="ls-chan__ava" style="background:${color}">${initial}</span>`; }

// ячейка Video: thumb (кадр + YT-play + размер) + имя + платформа + ключ (9 символов + 4 точки)
function videoCell(r){
  return `<div class="ls-video">
        <a class="ls-thumb" href="#" tabindex="-1">
          <span class="ls-thumb__play">${IC.youtube}</span>
          <span class="ls-thumb__size">${IC.inbox}${r.size}</span>
        </a>
        <div class="ls-video__meta">
          <span class="ls-video__name">${esc(r.name)}</span>
          <span class="ls-video__key"><span class="ls-yt">${IC.youtube}</span><span class="ls-video__keytxt">${IC.key}${esc(r.key)}<span class="ls-dots"><i></i><i></i><i></i><i></i></span></span></span>
        </div>
      </div>`;
}
function channelCell(r){
  if (!r.channel) return `<span class="ls-muted">—</span>`;
  const on = r.connected !== false;
  return `<span class="ls-chan">${chanAva(r.channel.color, r.channel.initial)}<span class="ls-chan__name">${esc(r.channel.name)}</span><span class="ls-onoff ls-onoff--${on?"on":"off"}"><i class="ls-onoff__dot"></i>${on?"On":"Off"}</span></span>`;
}
function dtCell(v){ return v ? `<span class="ls-dt"><span>${v.d}</span><span>${v.t}</span></span>` : `<span class="ls-muted">—</span>`; }
function txt(v){ return (v === null || v === undefined || v === "") ? `<span class="ls-muted">—</span>` : esc(v); }
function actionsCell(r){
  let primary = "";
  if (r.status === "live") primary = `<button class="ls-abtn ls-abtn--stop" type="button">${IC.stopSq}Stop</button>`;
  else if (r.status === "ready" || r.status === "created") primary = `<button class="ls-abtn ls-abtn--start" type="button">${IC.play}Start</button>`;
  return `<div class="ls-actions">${primary}<button class="ls-iconbtn" type="button" aria-label="Analytics">${IC.chart}</button><button class="ls-iconbtn" type="button" aria-label="Delete">${IC.trash}</button></div>`;
}

// ---- данные-примеры (первая строка — реальная с прода; остальные — демонстрируют статусы) ----
const ZEMS = { color:"var(--color-avatar-1)", initial:"Z", name:"Zems Racing" };
const BIG  = { color:"var(--color-avatar-3)", initial:"B", name:"Big Air Racing" };
const GEN  = { color:"var(--color-avatar-5)", initial:"G", name:"GenTech Studio" };

const ROWS = [
  { name:"Forza Motorsport Chill Ride", key:"bqya-twmx", size:"2.7 GB", status:"stopped", channel:ZEMS, connected:true,
    cost:"$0.02/h", spent:"$0", rev:"$0", start:{d:"09.07.2026",t:"12:30"}, end:null, duration:"00:05:07", users:"1", views:"2", likes:"1", comments:"0" },
  { name:"Retro Racing Marathon", key:"kf20-xa9c", size:"5.1 GB", status:"live", channel:BIG, connected:true,
    cost:"$0.05/h", spent:"$1.20", rev:"$3.40", start:{d:"20.07.2026",t:"09:00"}, end:null, duration:"02:14:33", users:"128", views:"842", likes:"91", comments:"12" },
  { name:"Sunday Chill Stream", key:"qw83-mn1p", size:"3.9 GB", status:"scheduled", channel:GEN, connected:true,
    cost:"$0.03/h", spent:"$0", rev:"$0", start:{d:"25.07.2026",t:"18:00"}, end:{d:"25.07.2026",t:"22:00"}, duration:null, users:null, views:null, likes:null, comments:null },
  { name:"Hunt Showdown Highlights", key:"zx41-pl7q", size:"12.4 GB", status:"converting", channel:ZEMS, connected:true,
    cost:null, spent:"$0", rev:"$0", start:null, end:null, duration:null, users:null, views:null, likes:null, comments:null },
  { name:"Weekend Warm-up", key:"ht66-vb2d", size:"1.8 GB", status:"ready", channel:BIG, connected:false,
    cost:"$0.02/h", spent:"$0", rev:"$0", start:null, end:null, duration:null, users:null, views:null, likes:null, comments:null },
];

function row(r){
  return `<tr class="ls-row">
        <td class="c-video">${videoCell(r)}</td>
        <td class="c-status">${statusBadge(r.status)}</td>
        <td class="c-channel">${channelCell(r)}</td>
        <td class="c-cost">${txt(r.cost)}</td>
        <td class="c-spent">${txt(r.spent)}</td>
        <td class="c-rev">${txt(r.rev)}</td>
        <td class="c-start">${dtCell(r.start)}</td>
        <td class="c-end">${dtCell(r.end)}</td>
        <td class="c-duration">${txt(r.duration)}</td>
        <td class="c-users">${txt(r.users)}</td>
        <td class="c-views">${txt(r.views)}</td>
        <td class="c-likes">${txt(r.likes)}</td>
        <td class="c-comments">${txt(r.comments)}</td>
        <td class="c-actions">${actionsCell(r)}</td>
      </tr>`;
}

// заголовок: sortable (со стрелками) / обычный. Лейблы в проде — верхним регистром (CSS uppercase).
function th(cls, label, sortable){
  return `<th class="${cls}"><span class="ls-th${sortable?" ls-th--sort":""}">${label}${sortable?IC.sort:""}</span></th>`;
}

const totals = `<tr class="ls-totals">
        <td class="c-video"><button class="ls-totals__toggle" type="button">Totals ${IC.chevDown}</button></td>
        <td class="c-status"><span class="ls-muted">—</span></td>
        <td class="c-channel"><span class="ls-muted">—</span></td>
        <td class="c-cost"><span class="ls-muted">—</span></td>
        <td class="c-spent">1.20</td>
        <td class="c-rev">6.80</td>
        <td class="c-start"><span class="ls-muted">—</span></td>
        <td class="c-end"><span class="ls-muted">—</span></td>
        <td class="c-duration"><span class="ls-muted">—</span></td>
        <td class="c-users">129</td>
        <td class="c-views">846</td>
        <td class="c-likes">93</td>
        <td class="c-comments">12</td>
        <td class="c-actions"><span class="ls-muted">—</span></td>
      </tr>`;

const mainInner = `
    <section class="ls-page">
      <header class="ls-header">
        <h1 class="ls-title">Streams</h1>
        <div class="ls-header__actions">
          <a class="ls-btn ls-btn--primary" href="live-stream-create.html">${IC.stream}<span>New stream</span></a>
          <button class="ls-btn ls-btn--secondary" type="button">${IC.card}<span>Top up balance</span></button>
        </div>
      </header>

      <div class="ls-toolbar">
        <div class="ls-search">${IC.search}<input type="text" placeholder="Search..." /></div>
        <button class="ls-btn ls-btn--secondary" type="button">${IC.save}<span>Export</span></button>
        <button class="ls-btn ls-btn--secondary" type="button">${IC.filter}<span>Filters</span></button>
      </div>

      <div class="ls-subrow">
        <div class="ls-count">Streams <span class="ls-count__dot">•</span> <span>${ROWS.length}</span></div>
        <div class="ls-pager">
          <button class="ls-pager__nav" type="button" aria-label="Previous" disabled>${IC.chevLeft}</button>
          <span class="ls-pager__page">1</span>
          <button class="ls-pager__nav" type="button" aria-label="Next" disabled>${IC.chevRight}</button>
          <button class="ls-perpage" type="button" data-perpage>10 ${IC.chevDown}</button>
        </div>
      </div>

      <div class="ls-table-wrap">
        <table class="ls-table">
          <thead>
            <tr>
              ${th("c-video","video",true)}
              ${th("c-status","status",true)}
              ${th("c-channel","channel",true)}
              ${th("c-cost","cost",false)}
              ${th("c-spent","spent",false)}
              ${th("c-rev","rev",true)}
              ${th("c-start","start",false)}
              ${th("c-end","end",false)}
              ${th("c-duration","duration",true)}
              ${th("c-users","active users",true)}
              ${th("c-views","views",true)}
              ${th("c-likes","likes",true)}
              ${th("c-comments","comments",true)}
              ${th("c-actions","actions",false)}
            </tr>
            ${totals}
          </thead>
          <tbody>
            ${ROWS.map(row).join("\n            ")}
          </tbody>
        </table>
      </div>
    </section>
  `;

// ---- страница создания стрима (New stream) --------------------------------
const createInner = `
    <section class="lsc-page">
      <a class="an-back lsc-back" href="live-streams.html">${IC.arrowBack}<span>Back to streams</span></a>
      <header class="lsc-header">
        <h1 class="ls-title">New stream</h1>
        <button class="lsc-tutorial" type="button">${IC.rocket}<span>Launch tutorial</span></button>
      </header>
      <div class="lsc-alert">
        <span class="lsc-alert__ic">${IC.attention}</span>
        <p>You can set up your first stream with <strong>$0.50</strong> in bonus funds, which will be used when you start streaming. This stream will last for 2 hours after you start. Familiarize yourself with the platform and top up your wallet later to continue streaming!</p>
      </div>
      <form class="lsc-form" onsubmit="return false">
        <div class="lsc-field">
          <label class="lsc-label">Platform</label>
          <button class="lsc-select" type="button"><span class="lsc-select__val"><span class="lsc-select__yt">${IC.youtube}</span>YouTube</span>${IC.chevDown}</button>
        </div>
        <div class="lsc-field">
          <label class="lsc-label">Stream link</label>
          <input class="lsc-input" type="text" placeholder="https://youtube.com/live/...." />
        </div>
        <div class="lsc-field">
          <label class="lsc-label">Stream key</label>
          <input class="lsc-input" type="text" placeholder="e.g. abcd-1234-efgh-5678" />
        </div>
        <div class="lsc-grid2">
          <div class="lsc-field"><label class="lsc-label">Start date <span class="lsc-opt">(optional)</span></label><div class="lsc-input-ic"><input class="lsc-input" type="text" placeholder="Select date" /><span class="lsc-input-ic__ic">${IC.calendar}</span></div></div>
          <div class="lsc-field"><label class="lsc-label">Start time <span class="lsc-opt">(optional)</span></label><input class="lsc-input lsc-input--muted" type="text" placeholder="Select time" /></div>
          <div class="lsc-field"><label class="lsc-label">End date <span class="lsc-opt">(optional)</span></label><div class="lsc-input-ic"><input class="lsc-input" type="text" placeholder="Select date" /><span class="lsc-input-ic__ic">${IC.calendar}</span></div></div>
          <div class="lsc-field"><label class="lsc-label">End time <span class="lsc-opt">(optional)</span></label><input class="lsc-input lsc-input--muted" type="text" placeholder="Select time" /></div>
        </div>
        <div class="lsc-field">
          <label class="lsc-label">Videos</label>
          <div class="lsc-upload">
            <span class="lsc-upload__ic">${IC.film}</span>
            <p class="lsc-upload__title">No videos</p>
            <p class="lsc-upload__desc">Build a broadcast queue by selecting a single video or a full playlist to stream in a continuous sequence</p>
            <button class="lsc-upload__btn" type="button">${IC.upload}<span>Choose video file</span></button>
          </div>
        </div>
        <button class="ls-btn ls-btn--primary lsc-submit" type="submit">Create stream</button>
      </form>
    </section>
  `;

// ---- общий шелл home.html → страница Live (space=streams, submenu Streams=current) ----
function buildPage(src, title, inner) {
  let h = src;
  h = h.replace("<title>Home — SubSub</title>", "<title>" + title + " — SubSub</title>");
  h = h.replace('class="sidebar-item sidebar-item--home is-active"', 'class="sidebar-item sidebar-item--home"');
  h = h.replace('id="space-streams" value="streams" />', 'id="space-streams" value="streams" checked />');
  h = h.replace("<body>", '<body class="is-open" data-space="streams">');
  h = h.replace('<p class="submenu__title" id="submenuTitle"></p>', '<p class="submenu__title" id="submenuTitle">Live</p>');
  h = h.replace('<div class="submenu__menu" data-space="streams" hidden>', '<div class="submenu__menu" data-space="streams">');
  h = h.replace('<a class="m-item" href="live-streams.html"><span class="m-ico"><svg><use href="#ic-stream"></use></svg></span>Streams</a>',
    '<a class="m-item is-current" href="live-streams.html"><span class="m-ico"><svg><use href="#ic-stream"></use></svg></span>Streams</a>');
  h = h.replace('<script src="js/nav.js"></script>',
    '<script src="js/nav.js"></script>\n  <script src="js/livestreams.js"></script>');
  const ms = h.indexOf('<main class="main">');
  const me = h.indexOf("</main>", ms);
  return h.slice(0, ms + '<main class="main">'.length) + inner + "\n  " + h.slice(me);
}

fs.writeFileSync(DIR + "live-streams.html", buildPage(html, "Streams", mainInner));
fs.writeFileSync(DIR + "live-stream-create.html", buildPage(html, "New stream", createInner));
console.log("written live-streams.html + live-stream-create.html; rows:", ROWS.length);

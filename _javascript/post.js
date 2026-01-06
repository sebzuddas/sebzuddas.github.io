import { basic, initSidebar, initTopbar } from './modules/layouts';
import {
  loadImg,
  imgPopup,
  initLocaleDatetime,
  initClipboard,
  toc,
  initEntranceAnimations,
  initReadingProgress,
  initScrollAnimations
} from './modules/plugins';

loadImg();
toc();
imgPopup();
initSidebar();
initLocaleDatetime();
initClipboard();
initTopbar();
initEntranceAnimations();
initReadingProgress();
initScrollAnimations();
basic();

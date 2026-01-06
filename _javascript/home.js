import { basic, initSidebar, initTopbar } from './modules/layouts';
import { initLocaleDatetime, loadImg, initEntranceAnimations } from './modules/plugins';

loadImg();
initLocaleDatetime();
initSidebar();
initTopbar();
initEntranceAnimations();
basic();

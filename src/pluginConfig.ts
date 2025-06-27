import type { ExternalPluginConfig } from '@windy/interfaces';

const config: ExternalPluginConfig = {
    name: 'windy-plugin-daynight',
    version: '0.0.7',
    icon: '🌅',
    title: 'Day Night',
    description:
        'Display different terminator lines, and shows the times in the picker.<br>The plugin can be opened with <u>www.windy.com/plugin/day-night/lat/lon/yyyy-mm-ddThh:mm</u>',
    author: 'Rittels',
    repository: 'https://www.github.com/rittels-windy-plugins/windy-plugin-day-night',
    desktopUI: 'embedded',
    mobileUI: 'small',
    listenToSingleclick: true,
    routerPath: '/day-night/:lat?/:lon?/:time?',
    addToContextmenu: true,
};

export default config;

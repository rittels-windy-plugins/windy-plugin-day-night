const config = {
    name: 'windy-plugin-demo',
    version: '0.0.2',
    icon: 'i',
    title: 'Demo plugin',
    description: 'This is a demo plugin',
    author: 'Rittels',
    repository: 'https://www.github.com/rittels-windy-plugins/windy-plugin-demo',
    desktopUI: 'embedded',
    mobileUI: 'small',
    listenToSingleclick: true,
    routerPath: '/elevation/:lat?/:lon?',
    addToContextmenu: true,
};
export default config;

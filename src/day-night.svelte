<div class="embed-window">
    <span class="checkbox" class:checkbox--off={!thisPlugin.isFocused} data-tooltip={`Picker focuses on the ${title} plugin.`} on:click={focus}
        >&nbsp;</span
    >
    <span
        on:click={() => {
            showInfo(name);
            focus(); // not sure if opening the info,  should focus the picker,  but seems to make sense intuitively
        }}
        style:cursor="pointer">Day-Night Menu</span
    >
    <!--plugin icon-->
    <!--<span data-icon=""></span>-->
    <div data-ref="messageDiv" class="hidden"></div>
</div>

<div bind:this={mainDiv} id={`${name}-info`} class="bg-transparent dark-content">
    <div
        class="closing-x"
        on:click={() => {
            document.body.classList.remove(`on${name}-info`);
        }}
    ></div>
    <div bind:this={cornerHandle} data-ref="cornerHandle" class="corner-handle"></div>
    <div bind:this={cornerHandleTop} data-ref="cornerHandleTop" class="corner-handle-top"></div>

    <div class="flex-container">
        <div class="plugin__title">Day Night</div>
        <div class="scrollable" data-ref="scrollable">
            <div class="toggle-section checkbox open size-l" data-ref="toggleLines">Select lines</div>
            <div class="section">
                <table id="day-night-sun-table" data-ref="dayNightSunTable"><tbody></tbody></table>
                <table>
                    <tbody>
                        <tr>
                            <td>Custom:</td>
                            <td><input data-ref="customAlt" type="range" class="myrange" min="-89" max="89" /> </td>
                        </tr>
                        <tr>
                            <td>Opacity:</td>
                            <td><input data-ref="opacity" type="range" class="myrange" step="0.01" min="0" max="1" /> </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <div class="toggle-section checkbox open size-l" data-ref="toggleTimes">Sun Times:</div>
            <div class="section">
                <table data-ref="dayNightTimesTable">
                    <tbody>
                        <tr
                            ><td colspan="4" class="comment"
                                >Select time-pair to display in the picker, or <span data-ref="clearPicker"><u>clear picker</u></span></td
                            ></tr
                        >
                    </tbody>
                </table>
            </div>

            <div class="toggle-section checkbox open size-l" data-ref="toggleTz">Time zone detail:</div>
            <div data-ref="tzSection" class="section tz-section collapsed">
                <table id="day-night-tz-detail">
                    <tbody>
                        <tr><td colspan="2" class="comment">Time zone detail of the picker position.</td></tr>
                        <tr><td>Time zone:</td><td data-ref="tzName"></td></tr>
                        <tr><td>Offset:</td><td data-ref="tzOffsetDST"></td></tr>
                        <tr class="hideable"><td>Base offset:</td><td data-ref="tzOffset"></td></tr>
                        <tr><td>DST Rule:</td><td data-ref="tzRule"></td></tr>
                        <tr class="hideable"><td>Begin:</td><td data-ref="tzBeg"></td></tr>
                        <tr class="hideable"><td>End:</td><td data-ref="tzEnd"></td></tr>
                    </tbody>
                </table>
            </div>

            <div class="toggle-section checkbox open size-l" data-ref="toggleSettings">Settings:</div>
            <div class="section">
                <table data-ref="dayNightSettings">
                    <tbody>
                        <colgroup>
                            <col style="width:30%" />
                            <col style="width:35%" />
                            <col style="width:35%" />
                        </colgroup>
                        <tr data-ref="select-time">
                            <td>Time span:</td>
                            <td data-do="windy" class="select-setting">Windy Calendar</td>
                            <td data-do="own" class="select-setting">Full year</td>
                        </tr>
                        <tr data-ref="day-night-utc-local">
                            <td>Picker time:</td>
                            <td data-do="utc" class="select-setting">UTC</td>
                            <td data-do="local" class="select-setting">Local</td>
                        </tr>
                        <tr data-ref="day-night-picker-side">
                            <td>Picker side:</td>
                            <td data-do="left" class="select-setting">Left</td>
                            <td data-do="right" class="select-setting">Right</td>
                        </tr>
                        <tr data-ref="show-timezones">
                            <td class="checkbox" style="white-space:nowrap" colspan="2">Show time zones.</td>
                            <!--  <td data-do="show" class="select-setting">Show</td>
                        <td data-do="hide" class="select-setting">Hide</td>
                    -->
                        </tr>
                        <tr data-ref="show-picker-timezone">
                            <td class="checkbox" style="white-space:nowrap" colspan="2">Show tz at picker.</td>
                            <!--  <td data-do="show" class="select-setting">Show</td>
                        <td data-do="hide" class="select-setting">Hide</td>  -->
                        </tr>

                        <table>
                            <tbody>
                                <tr>
                                    <td>Tz opacity:</td>
                                    <td colspan="2"><input data-ref="tzOpacity" type="range" class="myrange" min="0" max="1" step="0.01" /> </td>
                                </tr>
                            </tbody>
                        </table>
                    </tbody>
                </table>
            </div>
            <div data-ref="full-year" class:hidden={!useOwnTime}>
                <div class="toggle-section checkbox open size-l">Select date:</div>
                <div>
                    <table>
                        <tbody>
                            <tr>
                                <td>Time:</td>
                                <td data-ref="valFullyearTime"></td>
                                <td><input data-ref="fullyearTime" type="range" class="myrange" min="0" max="1440" /> </td>
                            </tr>
                            <tr>
                                <td>Date:</td>
                                <td data-ref="valFullyearDate"></td>
                                <td
                                    ><input
                                        data-ref="fullyearDate"
                                        type="range"
                                        class="myrange"
                                        step="1"
                                        min="0"
                                        max={new Date().getUTCFullYear() % 4 == 0 ? '365' : '364'}
                                    />
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
        <Footer onFooterClick={onFooter} />
    </div>
</div>

<script lang="ts">
    // @ts-nocheck

    import { onDestroy, onMount } from 'svelte';
    import plugins from '@windy/plugins';
    import { map } from '@windy/map';
    import store from '@windy/store';

    import Footer from './utils/Footer.svelte';
    import { init, closeCompletely } from './day-night_main.js';
    import { addDrag, showInfo, getWrapDiv, makeBottomRightHandle, makeTopLeftHandle, embedForTablet } from './utils/infoWinUtils.js';
    import { getPickerMarker } from 'custom-windy-picker';

    import config from './pluginConfig.js';
    const { title, name } = config;
    const { log } = console;

    const thisPlugin = plugins[name];
    let node;
    let mainDiv;
    let cornerHandle, cornerHandleTop;
    let closeButtonClicked;
    let marker;
    let useOwnTime = false;

    store.insert('day-night-picker-side', { def: 'right', allowed: ['left', 'right'], save: true });

    // the checkbox on the left of the embed-window allows the user to activate the picker for this plugin (focus).
    // The picker will then display info in the left or right picker divs for this plugin.
    function focus() {
        for (let p in plugins) {
            if (p.includes('windy-plugin') && p !== name && plugins[p].defocus) {
                plugins[p].defocus();
            }
        }
        thisPlugin.isFocused = true;

        let pickerSide = store.get('day-night-picker-side');
        log('Picker SIDE', pickerSide);

        // The pickerCtrl module maintains a list of plugins (LIFO) which uses either the left or right divs.
        // If you plan to use the left or right div,  add the name of this plugin to the picker,  with the following function:
        marker = getPickerMarker();
        marker[pickerSide == 'right' ? 'addRightPlugin' : 'addLeftPlugin'](name);
        if (marker?.getParams()) {
            marker.openMarker(marker.getParams());
        }
    }

    function defocus() {
        thisPlugin.isFocused = false;
    }

    const onFooter = open => {
        if (open) log('Footer open');
        else log('footer closed');
    };

    /** set by main program */
    function setUseOwnTime(uot) {
        useOwnTime = uot;
    }

    onMount(() => {
        init(thisPlugin, setUseOwnTime);
        node = thisPlugin.window.node;

        //  Info for this plugin is placed in a div appended to document.body,  get wrapDiv gets this div and creates it if needed.
        const wrapDiv = getWrapDiv();
        wrapDiv.appendChild(mainDiv);

        // Add handles to the Info div,  can be resized.
        makeBottomRightHandle(cornerHandle, mainDiv);
        makeTopLeftHandle(cornerHandleTop, mainDiv);

        // At the moment,  tablets do not show embedded plugins correctly,  this is a fix
        embedForTablet(thisPlugin);

        //// Should not be needed later
        // register if the user closed the plugin with button.  This will allow the plugin to be closed completely.
        // if the plugin is closed programatically by another plugin,  it will be reopened.
        node.querySelector(':scope > .closing-x').addEventListener('click', () => (closeButtonClicked = true));
        //

        focus();
        thisPlugin.focus = focus;
        thisPlugin.defocus = defocus;
    });

    export const onopen = _params => {
        if (_params && 'lon' in _params && !isNaN(_params.lat) && !isNaN(_params.lon)) {
            // Important:  onopen may actually occur before onmount (race condition).   So getPickerMarker here also.
            marker = getPickerMarker();
            marker.openMarker(_params);
            map.setView(_params);

            // if _params from context menu,  will not contain time.
            if (_params.time && new Date(_params.time)) {
                store.set('timestamp', new Date(_params.time).getTime());
            }
        }
    };

    onDestroy(() => {
        mainDiv.remove();
        document.body.classList.remove(`on${name}-info`);

        //// This reopens the plugin if it is closed by another embedded plugin.
        //   It should not be needed later,   then the whole plugin can then be moved into svelte,
        //   open() requires an object
        if (!closeButtonClicked) setTimeout(() => thisPlugin.open({}));
        else closeCompletely();
        ////
    });
</script>

<style lang="less">
    @import 'day-night.less?1751018905308';
</style>

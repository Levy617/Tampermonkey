// ==UserScript==
// @name         iFrame Test
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  try to take over the world!
// @author       xedx [2100735]
// @match        https://www.torn.com/*
// @connect      api.torn.com
// @require      https://raw.githubusercontent.com/edlau2/Tampermonkey/master/helpers/Torn-JS-Helpers.js
// @grant        GM_addStyle
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        unsafeWindow
// ==/UserScript==

/*eslint no-unused-vars: 0*/
/*eslint no-undef: 0*/
/*eslint no-multi-spaces: 0*/

(function() {
    'use strict';

    const myFrame = "<iframe id='ivault' class='iframes' scrolling='no'" +
                    "style='display:none; position:fixed; width:850px; height:326px; left:34%; top:13%;" +
                    "z-index:99; border:10px solid #1a0029 ; outline:1px solid #f50'" +
                    "src= 'https://www.torn.com/properties.php#/p=options&tab=vault' </iframe>";
    var iFrame = null;


    // MouseHover Money Value
    $('#user-money').mouseenter(function(){
        log('[mouseenter]');
        setTimeout(function() {
            $('#ivault ').show();
        }, 1000);
    });

    // Click OutSide to Hide iFrame
    $('body').click(function() {
        log('[body.click]');
        $('#ivault').hide(); // Changed from .iframes class to #ivault ID
                             // Prob gonna have issues referencing individual things inside the frame
                             // Since they are same ID's, classes, etc - but in diff window
    });

    $("#ivault").contents().find("#header-root").hide();

    function hideHeader() {
        if (iFrame) {
            let header = $("#ivault").contents().find("#header-root");
            if (header.length)
                header.hide();
            else
                setTimeout(hideHeader, 250);
        }

        // Can re-write, without variables, as:
        /*
        if (document.querySelector('#ivault')) { // Or, if ($('#ivault').length) {
            if ($("#ivault").contents().find("#header-root").length)
                $("#ivault").contents().find("#header-root").hide();
            else
                setTimeout(hideHeader, 250);
        }
        */
    }

    function handlePageLoad() {
        // Vault iFrame
        if (window.top === window.self) {     // Run Script if the Focus is Main Window (Don't also put inside the iFrame!)
            log('Prepending iFrame');
            $('body').prepend(myFrame);

            // Just for convenience, not really used
            iFrame = document.querySelector('#ivault');
            log('[iFrame]: ', iFrame);

            hideHeader();

            // Not the best way to do this, just need time to make sure contents are loaded.
            //setTimeout(function () {$("#ivault").contents().find("#header-root").hide()}, 500);
        }
    }

    //////////////////////////////////////////////////////////////////////
    // Main.
    //////////////////////////////////////////////////////////////////////

    logScriptStart();

    callOnContentLoaded(handlePageLoad);

})();
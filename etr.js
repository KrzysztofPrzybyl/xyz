function getPageLangFromHtml() {
    const el = document.documentElement;
    return el?.getAttribute('lang') || null;
}
function getUserIdFromMeta() {
    const meta = document.querySelector('meta[name="userId"]');
    return meta?.content || null;
}
function clearTopWindowStorage() {
    try { sessionStorage.clear(); } catch (_) {}
    try { localStorage.clear(); } catch (_) {}
}
(function () {
    const CLOSE_ON_CANCEL = false;
    const CLOSE_ON_SAVE = false;
    const INACTIVITY_MINUTES = 15;
    const SAVE_SUPPRESS_CLOSE_MS = 5000;
    const userId = getUserIdFromMeta();
    const PAGE_LANG = getPageLangFromHtml();
    // CONF
    const ENV_URL = `https://hcm55.sapsf.eu`;
    const ENV_URI_REDIRECT = `${ENV_URL}/sf/home`;
    const PROCCESS_PATH = `/sf/liveprofile?#mobileViewBlock/${userId}`;
    const BLOCK_ID = '/block14718';
    const IFRAME_URL = ENV_URL + PROCCESS_PATH + BLOCK_ID;

    const CHECK_INTERVAL_MS = 300;
    const DIALOG_CHECK_INTERVAL_MS = 200;
    const MAX_DIALOG_CHECKS = 1500;
    const globalWatchdogs = new Set();
    const globalObservers = new Set();
    const intervals = { buttonCheck: null, dialogVisibility: null, contentContainer: null, __layout11: null };
    let teardownIdle = null;

    function createModal() {
        const existingModal = document.getElementById('myModal');
        if (existingModal) existingModal.parentNode.removeChild(existingModal);
    
        const background = document.createElement('div');
        background.id = 'myModal';
        background.style.cssText = 'position: fixed; z-index: 1; left: 0; top: 0; width: 100%; height: 100%; overflow: auto; background-color: rgba(0, 0, 0, 0.5); display: block;';
    
        const modalContent = document.createElement('div');
        modalContent.style.cssText = 'background-color: #ff5a00; margin: 4% auto; padding: 20px; border: 1px solid #888; width: 840px; border-radius: 2rem;';
    
        const closeModal = document.createElement('span');
        closeModal.innerHTML = '&times;';
        closeModal.style.cssText = 'cursor: pointer; float: right; font-size: 28px; font-weight: bold; padding: 0 10px; z-index: 100; position: relative;';
        closeModal.setAttribute('role', 'button');
        closeModal.setAttribute('tabindex', '0');
        closeModal.setAttribute('aria-label', 'Zamknij');
    
        const iframeContainer = document.createElement('div');
        iframeContainer.id = 'iframeContainer';
        iframeContainer.style.position = 'relative';
    
        const iframe = document.createElement('iframe');
        iframe.id = 'iframe';
        iframe.src = IFRAME_URL;
        iframe.style.cssText = 'width: 100%; height: 800px; border: none; border-radius: 1.5rem;';
    
        const iframeOverlay = document.createElement('div');
        iframeOverlay.id = 'iframeOverlay';
        iframeOverlay.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: white; z-index: 999; transition: opacity 0.5s ease; border-radius: 2rem;';
    
        const spinnerWrapper = document.createElement('div');
        spinnerWrapper.style.cssText = 'display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; width: 100%; position: absolute; top: 0; left: 0;';
        const isSupportedLang = (PAGE_LANG === 'en-US' || PAGE_LANG === 'pl-PL' || PAGE_LANG === 'cs-CZ');
        const spinnerText = isSupportedLang ? 'Loading of External Training Request (ETR)' : 'Your language is not supported.';
        spinnerWrapper.innerHTML = '<div style="width: 30px; height: 30px; border: 6px solid #ccc; border-top-color: #333; border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 15px;"></div><div style="font-family: sans-serif; font-size: 16px; color: #333;">' + spinnerText + '</div>';
    
        iframeOverlay.appendChild(spinnerWrapper);
        const style = document.createElement('style');
        style.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
        document.head.appendChild(style);
        document.body.appendChild(background);
        background.appendChild(modalContent);
        modalContent.appendChild(closeModal);
        modalContent.appendChild(iframeContainer);
        iframeContainer.appendChild(iframe);
        iframeContainer.appendChild(iframeOverlay);
    
        closeModal.addEventListener('click', function (e) {
            e.preventDefault(); e.stopPropagation();
            closeModalAndCleanup(background, iframeContainer);
        }, false);
        closeModal.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                closeModalAndCleanup(background, iframeContainer);
            }
        });
        closeModal.addEventListener('mouseover', function () {
            this.style.color = 'red'; this.style.transform = 'scale(1.2)'; this.style.transition = 'all 0.2s';
        });
        closeModal.addEventListener('mouseout', function () {
            this.style.color = ''; this.style.transform = '';
        });
    
        if (!isSupportedLang) {
            setTimeout(() => { closeModalAndCleanup(background, iframeContainer); }, 5000);
            return;
        }
    
        iframe.onload = () => {
            checkContentContainerStyle(iframe);
            setTimeout(() => startClickSequence(iframe), 800);
            check__layout11Style(iframe);
            waitForFinalDialogRender(iframe);
            overrideSapCancelButton(iframe);
            installLangSpecificSaveBehavior(iframe, PAGE_LANG, CLOSE_ON_SAVE);
            installLangSpecificDiscardClose(iframe, PAGE_LANG);
            installHideSaveInAlertDialog(iframe, PAGE_LANG);
            installAutoScrollOnRerender(iframe);
            if (typeof teardownIdle === 'function') { try { teardownIdle(); } catch(_) {} }
            teardownIdle = installInactivityAutoClose(iframe, INACTIVITY_MINUTES);
            try {
              const idoc = iframe.contentDocument || iframe.contentWindow.document;
              if (idoc && !idoc.getElementById('orange-dont-save-css')) {
                const st = idoc.createElement('style');
                st.id = 'orange-dont-save-css';
                st.textContent =
'div[role="alertdialog"] .orange-danger .sapMBtnInner{ background:#ff5a00 !important; border-color:#ff7b33 !important; color:#fff !important; } div[role="alertdialog"] .orange-danger:hover .sapMBtnInner{ background:#ff7b33 !important; border-color:#ff7b33 !important; color:#fff !important; }';
                (idoc.head || idoc.documentElement).appendChild(st);
              }
            } catch (_) {}
        };
    }    

    function installInactivityAutoClose(iframe, minutes = 15) {
        const IDLE_MS = Math.max(1, minutes) * 60 * 1000;
        const evts = ['mousemove','mousedown','click','keydown','wheel','scroll','touchstart','pointerdown'];
        let idleTimer = null;
        const removeFns = [];
        const reset = () => {
            if (idleTimer) clearTimeout(idleTimer);
            idleTimer = setTimeout(() => {
                const bg = document.getElementById('myModal');
                const cont = document.getElementById('iframeContainer');
                if (bg && cont) closeModalAndCleanup(bg, cont, 'idle');
            }, IDLE_MS);
        };
        const addL = (target, type, handler, opts) => {
            try {
                if (!target || !target.addEventListener) return;
                target.addEventListener(type, handler, opts);
                removeFns.push(() => { try { target.removeEventListener(type, handler, opts); } catch(_) {} });
            } catch(_) {}
        };
        evts.forEach(t => { addL(window, t, reset, true); addL(document, t, reset, true); });
        try {
            const idoc = getIframeDocument(iframe);
            const iwin = iframe.contentWindow;
            if (idoc) evts.forEach(t => addL(idoc, t, reset, true));
            if (iwin) evts.forEach(t => addL(iwin, t, reset, true));
            try {
                const core = iwin?.sap?.ui?.getCore?.();
                if (core && typeof core.attachEvent === 'function') {
                    const onUIUpdated = () => reset();
                    core.attachEvent('UIUpdated', onUIUpdated);
                    removeFns.push(() => { try { core.detachEvent('UIUpdated', onUIUpdated); } catch(_) {} });
                }
            } catch(_) {}
        } catch(_) {}
        reset();
        return function teardown() {
            if (idleTimer) clearTimeout(idleTimer);
            while (removeFns.length) {
                const fn = removeFns.pop();
                try { fn(); } catch(_) {}
            }
        };
    }

    function installLangSpecificDiscardClose(iframe, pageLang) {
        const doc = getIframeDocument(iframe);
        if (!doc) return;

        const map = {
          'en-US': { key: 'd', labels: ["Don't Save"] },
          'pl-PL': { key: 'n', labels: ["Nie zapisuj"] },
          'cs-CZ': { key: 'n', labels: ["NeuklĂĄdat"] }
        };
        const conf = map[pageLang];
        if (!conf) return;

        const ATTACH_FLAG = '__discardCloseAttachedStrict';
        const normalize = (s) => (s || '').replace(/\u2019/g, "'").trim();
        const getBtnLabel = (btn) => (btn.querySelector('bdi')?.textContent || btn.textContent || '');
        const isTarget = (btn) => {
          if (!btn || btn[ATTACH_FLAG]) return false;
          if (!btn.closest('div[role="alertdialog"]')) return false;
          const keyOk   = ((btn.getAttribute('data-ui5-accesskey') || '').toLowerCase() === conf.key);
          const labelOk = conf.labels.includes(normalize(getBtnLabel(btn)));
          return keyOk && labelOk;
        };

        const handleClick = () => {
          setTimeout(() => {
            const bg = document.getElementById('myModal');
            const cont = document.getElementById('iframeContainer');
            if (bg && cont) closeModalAndCleanup(bg, cont);
          }, 0);
        };

        const tryAttach = (btn) => {
          if (!isTarget(btn)) return;
          btn.addEventListener('click', handleClick, true);
          btn.classList.add('orange-danger');
          btn[ATTACH_FLAG] = true;
        };

        const scan = () => {
          doc.querySelectorAll('div[role="alertdialog"] button, div[role="alertdialog"] [role="button"]').forEach(tryAttach);
        };
        scan();
        const mo = new MutationObserver(scan);
        mo.observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-ui5-accesskey', 'class', 'id', 'style'] });
        globalObservers.add(mo);
    }

    function isDialogGoneOrHidden(el) {
        try {
            if (!el || !el.isConnected) return true;
            const cs = el.ownerDocument.defaultView.getComputedStyle(el);
            if (cs.display === 'none' || cs.visibility === 'hidden') return true;
            if (!el.classList.contains('sapMDialogOpen') && (el.offsetWidth === 0 || el.offsetHeight === 0)) return true;
            return false;
        } catch (_) { return true; }
    }

    function watchSaveCompletion(doc, originDialog, closeOnSave) {
        let done = false;
        const finish = () => {
            if (done) return; done = true;
            if (closeOnSave) {
                const bg = document.getElementById('myModal');
                const cont = document.getElementById('iframeContainer');
                if (bg && cont) closeModalAndCleanup(bg, cont);
                stopAllWatchdogs();
                disconnectAllObservers();
            }
            cleanup();
        };
        const ATTACH_OK = '__okAfterSaveAttachedUnified';
        const tryAttachOK = () => {
            const okBtn = doc.querySelector('[data-ui5-accesskey="o"]');
            if (okBtn && !okBtn[ATTACH_OK]) {
                okBtn.addEventListener('click', () => setTimeout(finish, 0), true);
                okBtn[ATTACH_OK] = true;
            }
        };
        const moOK = new MutationObserver(tryAttachOK);
        tryAttachOK();
        moOK.observe(doc.body, { childList: true, subtree: true });
        let moDlg = null;
        if (originDialog) {
            moDlg = new MutationObserver(() => { if (isDialogGoneOrHidden(originDialog)) finish(); });
            moDlg.observe(originDialog, { attributes: true, attributeFilter: ['class','style'] });
        }
        const moBody = new MutationObserver(() => { if (!originDialog?.isConnected) finish(); });
        moBody.observe(doc.body, { childList: true, subtree: true });
        const fallback = setTimeout(() => {
            const anyOpen = doc.querySelector('.sapMDialog.sapMDialogOpen');
            if (!anyOpen) finish();
            cleanup();
        }, 15000);
        function cleanup() {
            try { moOK.disconnect(); } catch {}
            try { moDlg && moDlg.disconnect(); } catch {}
            try { moBody.disconnect(); } catch {}
            clearTimeout(fallback);
        }
        return cleanup;
    }

    function installLangSpecificSaveBehavior(iframe, pageLang, closeOnSave) {
        const doc = getIframeDocument(iframe);
        if (!doc) return;
        const map = {
            'en-US': { key: 's', label: 'Save' },
            'pl-PL': { key: 'z', label: 'Zapisz' },
            'cs-CZ': { key: 'u', label: 'UloĹžit' }
        };
        const conf = map[pageLang];
        if (!conf) return;
        const ATTACH_FLAG = '__langSaveAttachedUnified';
        const getBtnLabel = (btn) => (btn.querySelector('bdi')?.textContent || btn.textContent || '').trim();
        const isExactSaveBtn = (btn) => {
            if (!btn || btn[ATTACH_FLAG]) return false;
            const keyOk   = ((btn.getAttribute('data-ui5-accesskey') || '').toLowerCase() === conf.key);
            const labelOk = (getBtnLabel(btn) === conf.label);
            return keyOk && labelOk;
        };
        const onSaveClick = (e) => {
            if (!closeOnSave) window.__suppressDialogDisappearCloseUntil = Date.now() + SAVE_SUPPRESS_CLOSE_MS;
            const originDialog = e?.currentTarget?.closest?.('.sapMDialog') || doc.querySelector('.sapMDialog.sapMDialogOpen');
            watchSaveCompletion(doc, originDialog, closeOnSave);
        };
        const tryAttach = (btn) => {
            if (!isExactSaveBtn(btn)) return;
            btn.addEventListener('click', onSaveClick, true);
            btn[ATTACH_FLAG] = true;
            startWatchdog(btn, onSaveClick, ATTACH_FLAG);
        };
        doc.querySelectorAll(`[data-ui5-accesskey="${conf.key}"]`).forEach(tryAttach);
        const mo = new MutationObserver(() => {
            doc.querySelectorAll(`[data-ui5-accesskey="${conf.key}"]`).forEach(tryAttach);
        });
        mo.observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-ui5-accesskey','class','id','style'] });
        globalObservers.add(mo);
    }

    function installHideSaveInAlertDialog(iframe, pageLang) {
        const doc = getIframeDocument(iframe);
        if (!doc) return;
    
        const map = {
            'en-US': { key: 's', label: 'Save' },
            'pl-PL': { key: 'z', label: 'Zapisz' },
            'cs-CZ': { key: 'u', label: 'UloĹžit' }
        };
        const conf = map[pageLang];
        if (!conf) return;
    
        const HIDDEN_FLAG = '__saveHiddenStrict';
        const getBtnLabel = (btn) => (btn.querySelector('bdi')?.textContent || btn.textContent || '').trim();
    
        const isExactTarget = (btn) => {
            if (!btn || btn[HIDDEN_FLAG]) return false;
            const key = btn.getAttribute('data-ui5-accesskey') || '';
            const label = getBtnLabel(btn);
            return key === conf.key && label === conf.label;
        };
    
        const hideBtn = (btn) => {
            if (!btn || btn[HIDDEN_FLAG]) return;
            btn.style.setProperty('display', 'none', 'important');
            btn.setAttribute('aria-hidden', 'true');
            btn.setAttribute('tabindex', '-1');
            btn[HIDDEN_FLAG] = true;
        };
    
        const scan = () => {
            doc.querySelectorAll('div[role="alertdialog"]').forEach(dlg => {
                dlg.querySelectorAll('button, [role="button"]').forEach(b => { if (isExactTarget(b)) hideBtn(b); });
            });
        };
    
        scan();
    
        const mo = new MutationObserver(scan);
        mo.observe(doc.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class','style','id','data-ui5-accesskey'] });
        globalObservers.add(mo);
    }        

    function waitForFinalDialogRender(iframe) {
        const MAX_WAIT = 12000;
        const expectedId = "__dialog2";
        const iframeDoc = getIframeDocument(iframe);
        if (!iframeDoc) return;
        const runId = Symbol('dialogRenderRun');
        iframe.contentWindow._currentWaitRunId = runId;
        const observer = new MutationObserver((mutations, obs) => {
            if (iframe.contentWindow._currentWaitRunId !== runId) { obs.disconnect(); return; }
            const dialogs = iframeDoc.querySelectorAll(".sapMDialog.sapMDialogOpen");
            for (const dialog of dialogs) {
                if (dialog.id.trim() === expectedId) {
                    const visible = getComputedStyle(dialog).display !== 'none' && getComputedStyle(dialog).visibility !== 'hidden' && dialog.offsetWidth > 0 && dialog.offsetHeight > 0;
                    if (visible) {
                        obs.disconnect();
                        const overlay = document.getElementById('iframeOverlay');
                        if (overlay) { overlay.style.opacity = '0'; setTimeout(() => overlay.remove(), 500); }
                        return;
                    }
                }
            }
        });
        observer.observe(iframeDoc.body, { childList: true, subtree: true });
        globalObservers.add(observer);
        setTimeout(() => {
            if (iframe.contentWindow._currentWaitRunId !== runId) return;
            observer.disconnect();
            const overlay = document.getElementById('iframeOverlay');
            if (overlay) overlay.remove();
        }, MAX_WAIT);
    }

    function checkContentContainerStyle(iframe) {
        intervals.contentContainer = setInterval(() => {
            try {
                const iframeDocument = getIframeDocument(iframe);
                if (!iframeDocument) return;
                const contentContainer = iframeDocument.getElementById('contentContainer');
                if (contentContainer) {
                    contentContainer.style.cssText = 'margin: 20px; border: 0px; background: none;';
                    clearInterval(intervals.contentContainer);
                    intervals.contentContainer = null;
                }
            } catch (_) {
                clearInterval(intervals.contentContainer);
                intervals.contentContainer = null;
            }
        }, CHECK_INTERVAL_MS);
    }

    function startClickSequence(iframe) {
        intervals.buttonCheck = setInterval(() => {
            try {
                const iframeDocument = getIframeDocument(iframe);
                if (!iframeDocument) return;
                const firstButton = findButtonInDocument(iframeDocument, "__button2");
                if (firstButton) {
                    clearInterval(intervals.buttonCheck);
                    intervals.buttonCheck = null;
                    clickButton(firstButton);
                    setTimeout(() => {
                        const secondInterval = setInterval(() => {
                            try {
                                const updatedDoc = getIframeDocument(iframe);
                                if (!updatedDoc) return;
                                const secondButton = findButtonInDocument(updatedDoc, "__button11");
                                if (secondButton) {
                                    clearInterval(secondInterval);
                                    clickButton(secondButton);
                                    startDialogMonitoring(iframe);
                                }
                            } catch (_) {}
                        }, CHECK_INTERVAL_MS);
                        setTimeout(() => { clearInterval(secondInterval); }, 10000);
                    }, 800);
                }
            } catch (_) {}
        }, CHECK_INTERVAL_MS);
        setTimeout(() => {
            if (intervals.buttonCheck) {
                clearInterval(intervals.buttonCheck);
                intervals.buttonCheck = null;
            }
        }, 10000);
    }

    function isElementVisible(element) {
        const style = getComputedStyle(element);
        return style.display !== 'none' && style.visibility !== 'hidden';
    }
    function isSuppressedNow() {
        return (window.__suppressDialogDisappearCloseUntil || 0) > Date.now();
    }
    function isVisibleInTree(el) {
        if (!el) return false;
        const cs = el.ownerDocument.defaultView.getComputedStyle(el);
        return cs.display !== 'none' && cs.visibility !== 'hidden' && el.offsetWidth > 0 && el.offsetHeight > 0;
    }
    function anyUi5DialogVisible(doc) {
        if (!doc) return false;
        const dialogs = doc.querySelectorAll('.sapMDialog.sapMDialogOpen, div[role="alertdialog"], div[role="dialog"]');
        for (const d of dialogs) if (isVisibleInTree(d)) return true;
        const okBtn = doc.querySelector('button[data-ui5-accesskey="o"], button[aria-keyshortcuts="o"]');
        if (okBtn && isVisibleInTree(okBtn)) return true;
        return false;
    }

    function startDialogMonitoring(iframe) {
        let dialogFound = false;
        let checkCount = 0;
        intervals.dialogVisibility = setInterval(() => {
            checkCount++;
            try {
                const isVisible = checkDocumentForDialog(iframe);
                if (isVisible && !dialogFound) dialogFound = true;
                if (dialogFound && !isVisible) {
                    const idoc = getIframeDocument(iframe);
                    if (isSuppressedNow()) return;
                    if (anyUi5DialogVisible(idoc)) return;
                    const bg = document.getElementById('myModal');
                    const cont = document.getElementById('iframeContainer');
                    if (bg && cont) closeModalAndCleanup(bg, cont);
                    return;
                }
                if (checkCount >= MAX_DIALOG_CHECKS) cleanupIntervals();
            } catch (_) {
                if (checkCount >= MAX_DIALOG_CHECKS) cleanupIntervals();
            }
        }, DIALOG_CHECK_INTERVAL_MS);
    }

    function checkDocumentForDialog(iframe, depth = 0) {
        if (depth > 2) return false;
        try {
            const doc = getIframeDocument(iframe);
            if (!doc) return false;
            if (isDialogVisible(doc)) return true;
            const frames = doc.querySelectorAll('iframe');
            for (const frame of frames) {
                try { if (checkDocumentForDialog(frame, depth + 1)) return true; }
                catch (_) {}
            }
        } catch (_) {}
        return false;
    }

	function isDialogVisible(doc) {
        try {
            const dialogs = Array.from(doc.querySelectorAll('[id^="__dialog"]'))
                .filter(dlg => dlg.id !== '__dialog1');
            for (const dlg of dialogs) {
                const cs = dlg.ownerDocument.defaultView.getComputedStyle(dlg);
                const visible =
                    dlg.classList.contains('sapMDialogOpen') &&
                    cs.display !== 'none' &&
                    cs.visibility !== 'hidden' &&
                    dlg.offsetWidth > 0 &&
                    dlg.offsetHeight > 0;
                if (visible) return true;
            }
            return false;
        } catch (_) {
            return false;
        }
    }

    function findButtonInDocument(doc, buttonId) {
        let button = doc.getElementById(buttonId) || doc.querySelector(`button[id="${buttonId}"]`) || doc.querySelector(`button[data-sap-ui="${buttonId}"]`);
        if (button) return button;
        return findButtonInIframes(doc, buttonId);
    }
    function findButtonInIframes(doc, buttonId) {
        const frames = doc.querySelectorAll('iframe');
        for (const frame of frames) {
            try {
                const frameDoc = getIframeDocument(frame);
                if (!frameDoc) continue;
                let button = frameDoc.getElementById(buttonId) || frameDoc.querySelector(`button[id="${buttonId}"]`) || frameDoc.querySelector(`button[data-sap-ui="${buttonId}"]`);
                if (button) return button;
                button = findButtonInIframes(frameDoc, buttonId);
                if (button) return button;
            } catch (_) {}
        }
        return null;
    }

    function clickButton(button) {
        try {
            button.click();
            const mouseEvent = new MouseEvent('click', { bubbles: true, cancelable: true, view: button.ownerDocument.defaultView });
            button.dispatchEvent(mouseEvent);
            const innerElement = button.querySelector('[id$="-inner"]');
            if (innerElement) innerElement.click();
            executeClickScript(button);
        } catch (_) {}
    }

    function executeClickScript(button) {
        try {
            const doc = button.ownerDocument;
            const buttonId = button.id;
            const script = doc.createElement('script');
            script.textContent = '(function(){try{var btn=document.getElementById("' + buttonId + '");if(btn){btn.click();if(window.sap&&window.sap.ui){var control=sap.ui.getCore().byId("' + buttonId + '");if(control&&typeof control.firePress==="function"){control.firePress();}}}}catch(e){}})();';
            doc.body.appendChild(script);
            doc.body.removeChild(script);
        } catch (_) {}
    }

    function getIframeDocument(iframe) {
        try { return iframe.contentDocument || (iframe.contentWindow?.contentWindow.document); }
        catch (_) { return null; }
    }

    function closeModalAndCleanup(background, iframeContainer, reason) {
        background.style.display = 'none';
        iframeContainer.innerHTML = '';
        if (background.parentNode) background.parentNode.removeChild(background);
        try { delete window.__suppressDialogDisappearCloseUntil; } catch(_) {}
        if (typeof teardownIdle === 'function') { try { teardownIdle(); } catch(_) {} teardownIdle = null; }
        cleanupIntervals();
        stopAllWatchdogs();
        disconnectAllObservers();
        if (reason === 'idle') {
            clearTopWindowStorage();
            try { window.location.replace(ENV_URI_REDIRECT); } catch(_) { window.location.href = ENV_URI_REDIRECT; }
        }
    }

    function cleanupIntervals() {
        Object.keys(intervals).forEach(key => {
            if (intervals[key]) { clearInterval(intervals[key]); intervals[key] = null; }
        });
    }

    function stopAllWatchdogs() {
        for (const id of Array.from(globalWatchdogs)) {
            try { clearInterval(id); } catch(_) {}
            globalWatchdogs.delete(id);
        }
    }

    function disconnectAllObservers() {
        for (const mo of Array.from(globalObservers)) {
            try { mo.disconnect(); } catch(_) {}
            globalObservers.delete(mo);
        }
    }

    function check__layout11Style(iframe) {
        intervals.__layout11 = setInterval(() => {
            try {
                const iframeDocument = getIframeDocument(iframe);
                if (!iframeDocument) return;
                const __layout11 = iframeDocument.getElementById('__layout11');
                if (__layout11) {
                    __layout11.style.display = 'none';
                    clearInterval(intervals.__layout11);
                    intervals.__layout11 = null;
                }
            } catch (_) {
                clearInterval(intervals.__layout11);
                intervals.__layout11 = null;
            }
        }, CHECK_INTERVAL_MS);
    }

    function startWatchdog(btn, handlerFn, flagKey, interval = 100) {
        if (!btn || typeof btn !== 'object') return;
        const intervalId = setInterval(() => {
            if (!btn.isConnected) { clearInterval(intervalId); return; }
            if (!btn[flagKey]) {
                btn.addEventListener('click', handlerFn, true);
                btn[flagKey] = true;
            }
        }, interval);
        globalWatchdogs.add(intervalId);
    }

    function overrideSapCancelButton(iframe) {
        const MAX_WAIT = 30000;
        const TARGET_ID = '__button14';
        const ATTACH_FLAG = '__customIframeClose';
        const iframeDoc = getIframeDocument(iframe);
        if (!iframeDoc) return;
        const isActuallyVisible = (el) => {
            if (!el) return false;
            const cs = el.ownerDocument?.defaultView?.getComputedStyle(el);
            return cs && cs.display !== 'none' && cs.visibility !== 'hidden' && el.offsetWidth > 0 && el.offsetHeight > 0;
        };
        const shouldCloseAfterCancel = () => {
            try {
                const idoc = iframeDoc;
                const otherVisible = Array.from(idoc.querySelectorAll('.sapMDialog')).filter(d => d.id !== '__dialog2').filter(isActuallyVisible);
                if (otherVisible.length > 0) return false;
                const base = idoc.getElementById('__dialog2');
                const hasPage2Inside = !!idoc.querySelector('#__dialog2 #__page2');
                if (!hasPage2Inside) return true;
                if (!isActuallyVisible(base)) return true;
                return false;
            } catch (_) { return false; }
        };
        const runBlankCloseProbe = () => {
            if (isSuppressedNow()) return;
            const bg = document.getElementById('myModal');
            const cont = document.getElementById('iframeContainer');
            if (!bg || !cont) return;
            const STEP = 150;
            const MAX = 2000;
            let elapsed = 0;
            const t = setInterval(() => {
                elapsed += STEP;
                if (shouldCloseAfterCancel()) {
                    clearInterval(t);
                    closeModalAndCleanup(bg, cont);
                } else if (elapsed >= MAX) {
                    clearInterval(t);
                }
            }, STEP);
        };
        const onCancelClick = () => {
            if (CLOSE_ON_CANCEL) {
                setTimeout(() => {
                    const background = document.getElementById('myModal');
                    const iframeContainer = document.getElementById('iframeContainer');
                    if (background && iframeContainer) closeModalAndCleanup(background, iframeContainer);
                }, 0);
            } else {
                setTimeout(runBlankCloseProbe, 50);
            }
        };
        const attachHandler = (btn) => {
            if (btn[ATTACH_FLAG]) return;
            btn.addEventListener('click', onCancelClick, true);
            btn[ATTACH_FLAG] = true;
            startWatchdog(btn, onCancelClick, ATTACH_FLAG);
        };
        const observer = new MutationObserver(() => {
            const btn = iframeDoc.getElementById(TARGET_ID);
            const isVisible = btn && btn.offsetWidth > 0 && btn.offsetHeight > 0;
            if (isVisible) attachHandler(btn);
        });
        observer.observe(iframeDoc.body, { childList: true, subtree: true });
        globalObservers.add(observer);
        setTimeout(() => { observer.disconnect(); }, MAX_WAIT);
    }

    function installAutoScrollOnRerender(iframe) {
        const doc = getIframeDocument(iframe);
        if (!doc) return;
        const win = iframe.contentWindow;
        const NET_ALLOW = ['configUIControllerProxy.onChange.dwr'];
        const urlMatches = (url, arr) => arr.some(s => url.includes(s));
        let gateArmed = false;
        let armTimeout = null;
        const armGate = () => {
            gateArmed = true;
            clearTimeout(armTimeout);
            armTimeout = setTimeout(() => { gateArmed = false; }, 1500);
        };
        const tryScroll = () => {
            if (!gateArmed) return;
            gateArmed = false;
            clearTimeout(armTimeout);
            debouncedScroll();
        };
        const debouncedScroll = debounce(() => {
            afterNextPaint(() => {
                const target = findScrollableContainer(doc, win);
                if (target) smoothScrollToBottom(target);
            });
        }, 120);
        try {
            const core = win?.sap?.ui?.getCore?.();
            if (core && typeof core.attachEvent === 'function') {
                core.attachEvent('UIUpdated', () => tryScroll());
            }
        } catch (_) {}
        try {
            if (!win.__autoScrollXHRPatched) {
                const XHRp = win.XMLHttpRequest && win.XMLHttpRequest.prototype;
                if (XHRp && XHRp.open && XHRp.send) {
                    const _open = XHRp.open;
                    const _send = XHRp.send;
                    XHRp.open = function(method, url, ...rest) {
                        this.__monitoredUrl = url;
                        return _open.apply(this, arguments);
                    };
                    XHRp.send = function(body) {
                        try {
                            this.addEventListener('load', () => {
                                const url = String(this.__monitoredUrl || '');
                                if (urlMatches(url, NET_ALLOW)) {
                                    armGate();
                                    setTimeout(() => tryScroll(), 700);
                                }
                            }, { once: true });
                        } catch (_) {}
                        return _send.apply(this, arguments);
                    };
                    win.__autoScrollXHRPatched = true;
                }
            }
        } catch (_) {}
        try {
            if (win.fetch && !win.__autoScrollFetchPatched) {
                const _fetch = win.fetch.bind(win);
                win.fetch = function(input, init) {
                    const url = (typeof input === 'string') ? input : (input && input.url) || '';
                    return _fetch(input, init).then(resp => {
                        try {
                            if (urlMatches(url, NET_ALLOW)) {
                                armGate();
                                setTimeout(() => tryScroll(), 700);
                            }
                        } catch (_) {}
                        return resp;
                    });
                };
                win.__autoScrollFetchPatched = true;
            }
        } catch (_) {}
    }

    function findScrollableContainer(doc, win) {
        const candidates = [
            doc.querySelector('#__dialog2 .sapMDialogScrollCont'),
            doc.querySelector('.sapMDialogOpen .sapMDialogScrollCont'),
            doc.querySelector('.sapMPageEnableScrolling .sapMPageScroll'),
            doc.querySelector('#contentContainer'),
            doc.scrollingElement,
            doc.documentElement,
            doc.body
        ].filter(Boolean);
        for (const el of candidates) {
            const cs = win.getComputedStyle(el);
            const canScroll = (cs.overflowY === 'auto' || cs.overflowY === 'scroll') && el.scrollHeight > el.clientHeight;
            if (canScroll) return el;
        }
        const any = Array.from(doc.querySelectorAll('*')).find(el => {
            const cs = win.getComputedStyle(el);
            return (cs.overflowY === 'auto' || cs.overflowY === 'scroll') && el.scrollHeight > el.clientHeight;
        });
        return any || doc.scrollingElement || doc.body;
    }
    function smoothScrollToBottom(el) {
        try { el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' }); }
        catch { el.scrollTop = el.scrollHeight; }
    }
    function afterNextPaint(fn) {
        requestAnimationFrame(() => requestAnimationFrame(fn));
    }
    function debounce(fn, ms) {
        let t;
        return (...args) => { clearTimeout(t); t = setTimeout(() => fn.apply(this, args), ms); };
    }

    function stretchModalOnIframeLoad() {
        const iframeId = 'iframe';
        const styleElementId = 'refined-injected-iframe-styles';
        const cssToInjectIntoIframe = '#__layout11 { display: none !important; } #__container0 { opacity: 0; } #__page2 { opacity: 1; } #__dialog2 { visibility: hidden !important; } #__dialog2:has(#__page2) { visibility: visible !important; } body #__dialog2 { width: 100vw !important; height: 100vh !important; max-width: none !important; max-height: none !important; }';
        function injectStyles(iframeElement) {
            try {
                const iframeDoc = iframeElement.contentDocument || iframeElement.contentWindow.document;
                if (!iframeDoc) return;
                const iframeHead = iframeDoc.head || iframeDoc.getElementsByTagName('head')[0];
                if (!iframeHead) return;
                if (iframeDoc.getElementById(styleElementId)) return;
                const styleElement = iframeDoc.createElement('style');
                styleElement.type = 'text/css';
                styleElement.id = styleElementId;
                styleElement.textContent = cssToInjectIntoIframe;
                iframeHead.appendChild(styleElement);
            } catch (_) {}
        }
        function setupIframeListener(iframeElement) {
            iframeElement.addEventListener('load', () => { injectStyles(iframeElement); });
            if (iframeElement.contentDocument && iframeElement.contentDocument.readyState === 'complete') {
                setTimeout(() => injectStyles(iframeElement), 100);
            }
        }
        const observer = new MutationObserver((mutationsList, observer) => {
            for (const mutation of mutationsList) {
                if (mutation.type === 'childList') {
                    for (const node of mutation.addedNodes) {
                        if (node.nodeType === 1) {
                            if (node.id === iframeId || node.querySelector?.(`#${iframeId}`)) {
                                const targetIframe = node.id === iframeId ? node : node.querySelector(`#${iframeId}`);
                                if (targetIframe && targetIframe.tagName === 'IFRAME') {
                                    setupIframeListener(targetIframe);
                                    return;
                                }
                            }
                        }
                    }
                }
            }
        });
        const targetNode = document.body;
        const config = { childList: true, subtree: true };
        if (targetNode) observer.observe(targetNode, config);
        else document.addEventListener('DOMContentLoaded', () => observer.observe(document.body, config));
        const existingIframe = document.getElementById(iframeId);
        if (existingIframe && existingIframe.tagName === 'IFRAME') {
            setupIframeListener(existingIframe);
        }
    }

    stretchModalOnIframeLoad();
    createModal();
})();

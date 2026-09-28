(function () {
    'use strict';

    var VOTED_KEY = 'sonepur_poll_voted';
    var REFRESH_MS = 10000;

    var radios = document.querySelectorAll('input[name="choice"]');
    var signin = document.getElementById('signin');
    var gsiButton = document.getElementById('gsi-button');
    var statusEl = document.getElementById('poll-status');

    var config = {};
    var turnstileToken = null;
    var turnstileWidget = null;
    var submitting = false;
    var refreshTimer = null;

    /* ---------- helpers ---------- */

    function setStatus(message, kind) {
        statusEl.textContent = message || '';
        statusEl.className = 'poll-status' + (kind ? ' ' + kind : '');
    }

    function val(id) { return document.getElementById(id).value; }
    var form = document.getElementById('vote-form');
    function refreshSignin() {
        var ok = form.checkValidity() && /^(\+?91|0)?[6-9]\d{9}$/.test(val('f-phone').replace(/[\s-]/g, ''));
        signin.hidden = !ok;
        document.getElementById('signin-hint').hidden = ok;
    }
    function selectedChoice() {
        var checked = document.querySelector('input[name="choice"]:checked');
        return checked ? checked.value : null;
    }

    function loadScript(src) {
        return new Promise(function (resolve, reject) {
            var s = document.createElement('script');
            s.src = src;
            s.async = true;
            s.defer = true;
            s.onload = resolve;
            s.onerror = reject;
            document.head.appendChild(s);
        });
    }

    function lockForm() {
        form.querySelectorAll('input,textarea').forEach(function (r) { r.disabled = true; });
        signin.hidden = true;
        document.getElementById('signin-hint').hidden = true;
    }

    function errorMessage(code) {
        switch (code) {
            case 'bad_details': return 'Please check your details. The mobile number must be a valid 10-digit number.';
            case 'bad_token': return 'Google sign-in could not be verified. Please try again.';
            case 'turnstile_failed': return 'The security check failed. Refresh the page and try again.';
            case 'rate_limited': return 'Too many attempts. Please try again later.';
            case 'not_configured': return 'Voting is not open yet.';
            default: return 'Something went wrong. Please try again.';
        }
    }

    /* ---------- live results ---------- */

    function formatNumber(n) {
        return Number(n).toLocaleString('en-IN');
    }

    function percent(part, total) {
        return total ? (part / total) * 100 : 0;
    }

    function renderResults(data) {
        var total = data.total || 0;
        var yesPct = percent(data.yes, total);
        var noPct = percent(data.no, total);

        document.getElementById('count-yes').textContent = formatNumber(data.yes);
        document.getElementById('count-no').textContent = formatNumber(data.no);
        document.getElementById('count-total').textContent = formatNumber(total);
        document.getElementById('pct-yes').textContent = yesPct.toFixed(1) + '%';
        document.getElementById('pct-no').textContent = noPct.toFixed(1) + '%';
        document.getElementById('bar-yes').style.height = yesPct + '%';
        document.getElementById('bar-no').style.height = noPct + '%';

        var now = new Date();
        document.getElementById('updated').textContent =
            'Updated ' + now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + '.';
    }

    function loadResults() {
        return fetch('/api/results', { cache: 'no-store' })
            .then(function (r) { if (!r.ok) throw new Error('bad response'); return r.json(); })
            .then(renderResults)
            .catch(function () {
                document.getElementById('updated').textContent = 'Live results are unavailable right now.';
            });
    }

    function startRefreshing() {
        loadResults();
        refreshTimer = setInterval(loadResults, REFRESH_MS);
        document.addEventListener('visibilitychange', function () {
            if (document.hidden) {
                clearInterval(refreshTimer);
                refreshTimer = null;
            } else if (!refreshTimer) {
                loadResults();
                refreshTimer = setInterval(loadResults, REFRESH_MS);
            }
        });
    }

    /* ---------- voting ---------- */

    function resetTurnstile() {
        turnstileToken = null;
        if (window.turnstile && turnstileWidget !== null) {
            try { window.turnstile.reset(turnstileWidget); } catch (e) { /* ignore */ }
        }
    }

    function onGoogleCredential(response) {
        var choice = selectedChoice();
        if (!choice) {
            setStatus('Select an option first, then sign in.', 'error');
            return;
        }
        if (config.turnstileSiteKey && !turnstileToken) {
            setStatus('Please wait for the security check to finish, then sign in again.', 'error');
            return;
        }
        if (submitting) return;
        submitting = true;
        setStatus('Submitting your vote…');

        fetch('/api/vote', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                credential: response.credential,
                choice: choice,
                turnstileToken: turnstileToken,
                name: val('f-name'), phone: val('f-phone'), address: val('f-address'),
                occupation: val('f-occupation'), consent: document.getElementById('f-consent').checked
            })
        })
            .then(function (r) {
                return r.json().catch(function () { return {}; }).then(function (data) {
                    return { status: r.status, ok: r.ok, data: data };
                });
            })
            .then(function (res) {
                if (res.ok) {
                    lockForm();
                    try { localStorage.setItem(VOTED_KEY, '1'); } catch (e) { /* ignore */ }
                    setStatus('Your vote has been recorded. Thank you.', 'ok');
                    loadResults();
                } else if (res.status === 409) {
                    lockForm();
                    try { localStorage.setItem(VOTED_KEY, '1'); } catch (e) { /* ignore */ }
                    setStatus('This Google account has already voted. Each account can vote once.', 'error');
                } else {
                    setStatus(errorMessage(res.data && res.data.error), 'error');
                }
            })
            .catch(function () {
                setStatus('Network problem. Check your connection and try again.', 'error');
            })
            .then(function () {
                submitting = false;
                resetTurnstile();
            });
    }

    function setUpGoogle() {
        return loadScript('https://accounts.google.com/gsi/client').then(function () {
            window.google.accounts.id.initialize({
                client_id: config.googleClientId,
                callback: onGoogleCredential
            });
            window.google.accounts.id.renderButton(gsiButton, {
                theme: 'outline',
                size: 'large',
                text: 'signin_with',
                shape: 'rectangular',
                width: 280
            });
        });
    }

    function setUpTurnstile() {
        if (!config.turnstileSiteKey) return Promise.resolve();
        return loadScript('https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit').then(function () {
            turnstileWidget = window.turnstile.render('#turnstile', {
                sitekey: config.turnstileSiteKey,
                callback: function (token) { turnstileToken = token; },
                'expired-callback': function () { turnstileToken = null; },
                'error-callback': function () { turnstileToken = null; }
            });
        });
    }

    function disableVoting(message) {
        radios.forEach(function (r) { r.disabled = true; });
        setStatus(message, 'error');
    }

    function init() {
        startRefreshing();

        var alreadyVoted = false;
        try { alreadyVoted = localStorage.getItem(VOTED_KEY) === '1'; } catch (e) { /* ignore */ }
        if (alreadyVoted) {
            lockForm();
            setStatus('You have already voted from this browser. Thank you.', 'ok');
            return;
        }

        form.addEventListener('input', function () { setStatus(''); refreshSignin(); });
        form.addEventListener('change', refreshSignin);

        fetch('/api/config')
            .then(function (r) { if (!r.ok) throw new Error('config'); return r.json(); })
            .then(function (cfg) {
                config = cfg;
                if (!cfg.googleClientId) {
                    disableVoting('Voting is not open yet.');
                    return;
                }
                return Promise.all([setUpGoogle(), setUpTurnstile()]);
            })
            .catch(function () {
                disableVoting('Voting could not be loaded. Please refresh the page.');
            });
    }

    init();
})();

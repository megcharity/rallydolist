// ─── Rally Portal — shared real-auth gate ───────────────────────────────────
// Loaded (as a script tag, src="/shared/auth.js") after the
// @supabase/supabase-js CDN script and shared/config.js, in that order.
//
// NOTE: this file must never contain the literal five-character sequence
// "<" + "/script>" — even inside a comment or string — because some
// deployments inline this entire file's text directly into another page's
// <script> block (see the standalone rallydolist repo's build process),
// and a browser's HTML parser ends a <script> element at the first literal
// occurrence of that closing-tag text, regardless of JS comment/string
// context. Keep any illustrative markup in comments split across lines or
// otherwise broken up so this substring never appears intact.
//
// Injects a full-screen email-code sign-in overlay in front of whatever's
// already on the page (the existing PIN screen / app content, untouched).
// Once a session is established AND the signed-in email passes the
// rally_allowed_staff roster check (via the rally_am_i_allowed() RPC —
// see supabase/migrations/0001_auth_allowlist.sql), the overlay removes
// itself and the page underneath proceeds exactly as it did before this
// file existed.
//
// Exposes window.RallyAuth = { token(), email(), signOut(), whenReady(cb) }
// for the rest of each app's existing fetch() calls to grab a live session
// token — NOT a frozen anon-key constant, since RLS needs to see a real
// authenticated user, not the anon role.
(function () {
  const client = window.supabase.createClient(
    window.RALLY_SUPABASE_URL,
    window.RALLY_SUPABASE_ANON_KEY
  );

  // ── Local dev bypass ──────────────────────────────────────────────────
  // Gated on the literal hostname so it can NEVER fire on a deployed site,
  // even if this file were pushed as-is — real users always go through
  // real OTP sign-in. Exists purely so local UI changes can be eyeballed
  // without waiting on Supabase's OTP rate limit / inbox round-trip.
  // Data still goes through the anon key (no real session), so RLS-gated
  // reads/writes behave exactly as an unauthenticated request would —
  // this only skips the client-side overlay, not any server-side check.
  const isLocalDev = ['localhost', '127.0.0.1'].includes(location.hostname);

  let currentSession = null;
  let currentEmail = null;
  const readyCallbacks = [];
  let isReady = false;

  function fireReady() {
    isReady = true;
    readyCallbacks.splice(0).forEach(cb => cb());
  }

  // ── Public API ──────────────────────────────────────────────────────────
  window.RallyAuth = {
    // Current session's access token, or the anon key if signed out — so
    // any fetch() built with this never sends a literal "undefined".
    token() {
      return (currentSession && currentSession.access_token) || window.RALLY_SUPABASE_ANON_KEY;
    },
    email() {
      return currentEmail;
    },
    async signOut() {
      await client.auth.signOut();
      currentSession = null;
      currentEmail = null;
      showGate();
    },
    // Runs cb immediately if the gate has already resolved once, otherwise
    // queues it — lets each app's own init code wait for auth without
    // needing to know whether it's still loading.
    whenReady(cb) {
      if (isReady) cb();
      else readyCallbacks.push(cb);
    },
  };

  // ── Overlay markup/styles, injected once ────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    #rally-auth-gate { position:fixed; inset:0; z-index:99999; background:#fbf6ed;
      display:flex; align-items:center; justify-content:center; font-family:'DM Sans',-apple-system,sans-serif; }
    #rally-auth-gate.hidden { display:none; }
    .rag-card { width:340px; max-width:90vw; background:#fff; border-radius:14px;
      border:1px solid rgba(23,72,84,.15); box-shadow:0 20px 60px rgba(23,72,84,.12);
      padding:32px 28px; text-align:center; }
    .rag-title { font-family:'Cormorant Garamond',Georgia,serif; font-size:28px;
      font-weight:500; color:#174854; margin-bottom:6px; }
    .rag-sub { font-size:13px; color:rgba(23,72,84,.55); margin-bottom:22px; line-height:1.4; }
    .rag-input { width:100%; box-sizing:border-box; padding:12px 14px; font-size:15px;
      border:1.5px solid rgba(23,72,84,.2); border-radius:8px; font-family:inherit;
      color:#174854; background:#fbf6ed; margin-bottom:10px; text-align:center;
      letter-spacing:.02em; }
    .rag-input:focus { outline:none; border-color:#174854; }
    .rag-btn { width:100%; padding:13px; border:none; border-radius:8px;
      background:#174854; color:#fbf6ed; font-family:inherit; font-size:14px;
      font-weight:700; cursor:pointer; margin-top:4px; }
    .rag-btn:disabled { opacity:.5; cursor:default; }
    .rag-link { background:none; border:none; color:#174854; font-family:inherit;
      font-size:12px; text-decoration:underline; cursor:pointer; margin-top:14px;
      opacity:.6; }
    .rag-err { font-size:12px; color:#e13228; min-height:16px; margin-top:8px; }
    .rag-denied { font-size:14px; color:#174854; line-height:1.5; margin-top:8px; }
  `;
  document.head.appendChild(style);

  const gate = document.createElement('div');
  gate.id = 'rally-auth-gate';
  gate.innerHTML = `
    <div class="rag-card">
      <div id="rag-step-email">
        <div class="rag-title">Rally Portal</div>
        <div class="rag-sub">Enter your email to sign in.</div>
        <input id="rag-email" class="rag-input" type="email" placeholder="you@example.com" autocomplete="email">
        <button id="rag-send" class="rag-btn">Send Code</button>
        <div id="rag-email-err" class="rag-err"></div>
      </div>
      <div id="rag-step-code" style="display:none;">
        <div class="rag-title">Check your email</div>
        <div class="rag-sub">Enter the code we just sent you.</div>
        <input id="rag-code" class="rag-input" type="text" inputmode="numeric" maxlength="10" placeholder="000000">
        <button id="rag-verify" class="rag-btn">Verify &amp; Sign In</button>
        <button id="rag-resend" class="rag-link">Use a different email</button>
        <div id="rag-code-err" class="rag-err"></div>
      </div>
      <div id="rag-step-denied" style="display:none;">
        <div class="rag-title">Not approved yet</div>
        <div class="rag-denied">This email isn't on the approved staff list. Ask a manager to add you in the Team Portal, then try again.</div>
        <button id="rag-back" class="rag-btn" style="margin-top:18px;">Try a Different Email</button>
      </div>
    </div>
  `;
  document.addEventListener('DOMContentLoaded', () => document.body.appendChild(gate));
  // If DOMContentLoaded already fired (script loaded late), append immediately.
  if (document.readyState !== 'loading') document.body.appendChild(gate);

  function showGate() {
    gate.classList.remove('hidden');
    showStep('email');
  }
  function hideGate() {
    gate.classList.add('hidden');
  }
  function showStep(step) {
    ['email', 'code', 'denied'].forEach(s => {
      document.getElementById(`rag-step-${s}`).style.display = s === step ? 'block' : 'none';
    });
  }

  let pendingEmail = '';

  async function sendCode() {
    const emailInput = document.getElementById('rag-email');
    const err = document.getElementById('rag-email-err');
    const email = emailInput.value.trim();
    err.textContent = '';
    if (!email || !email.includes('@')) { err.textContent = 'Enter a valid email address.'; return; }
    document.getElementById('rag-send').disabled = true;
    document.getElementById('rag-send').textContent = 'Sending…';
    try {
      const { error } = await client.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
      if (error) throw error;
      pendingEmail = email;
      showStep('code');
      document.getElementById('rag-code').focus();
    } catch (e) {
      err.textContent = 'Could not send code — check the email and try again.';
      console.warn('signInWithOtp failed', e);
    } finally {
      document.getElementById('rag-send').disabled = false;
      document.getElementById('rag-send').textContent = 'Send Code';
    }
  }

  async function verifyCode() {
    const codeInput = document.getElementById('rag-code');
    const err = document.getElementById('rag-code-err');
    const token = codeInput.value.trim();
    err.textContent = '';
    // Supabase's OTP length is a project-level setting, not something this
    // client controls — accept any all-digit code rather than assuming 6.
    if (!/^\d{4,10}$/.test(token)) { err.textContent = 'Enter the code from your email.'; return; }
    document.getElementById('rag-verify').disabled = true;
    document.getElementById('rag-verify').textContent = 'Verifying…';
    try {
      const { data, error } = await client.auth.verifyOtp({ email: pendingEmail, token, type: 'email' });
      if (error) throw error;
      await handleSession(data.session);
    } catch (e) {
      err.textContent = 'Incorrect or expired code — try again.';
      console.warn('verifyOtp failed', e);
    } finally {
      document.getElementById('rag-verify').disabled = false;
      document.getElementById('rag-verify').textContent = 'Verify & Sign In';
    }
  }

  // Runs for both a freshly-verified session AND a restored one on page
  // load — re-checks the roster every time so a deactivated staff member
  // gets blocked even if their browser still has a lingering session.
  async function handleSession(session) {
    if (!session) {
      if (isLocalDev) { hideGate(); fireReady(); return; }
      showGate();
      return;
    }
    currentSession = session;
    currentEmail = session.user && session.user.email;
    try {
      const { data, error } = await client.rpc('rally_am_i_allowed');
      const row = Array.isArray(data) ? data[0] : data;
      if (error || !row || !row.allowed) {
        console.warn('rally_am_i_allowed denied this sign-in', { email: currentEmail, error, row });
        await client.auth.signOut();
        currentSession = null;
        currentEmail = null;
        showStep('denied');
        gate.classList.remove('hidden');
        return;
      }
      console.log('Signed in as', currentEmail, '— pin_role:', row.pin_role);
    } catch (e) {
      // If the RPC itself is unreachable (network blip), fail closed —
      // keep the gate up rather than silently letting an unverified
      // session through.
      console.warn('rally_am_i_allowed check failed', e);
      showGate();
      return;
    }
    hideGate();
    fireReady();
  }

  gate.addEventListener('click', e => {
    if (e.target.id === 'rag-send') sendCode();
    if (e.target.id === 'rag-verify') verifyCode();
    if (e.target.id === 'rag-resend' || e.target.id === 'rag-back') showStep('email');
  });
  gate.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    if (e.target.id === 'rag-email') sendCode();
    if (e.target.id === 'rag-code') verifyCode();
  });

  // ── Boot: restore an existing session if there is one ─────────────────
  if (!isLocalDev) {
    showGate(); // shown by default until getSession() resolves, to avoid a
                // flash of the app underneath for a brand-new device.
  }
  client.auth.getSession().then(({ data }) => handleSession(data.session));

  // Keep RallyAuth.token() live across silent background refreshes.
  client.auth.onAuthStateChange((_event, session) => {
    currentSession = session;
    currentEmail = session && session.user && session.user.email;
  });
})();

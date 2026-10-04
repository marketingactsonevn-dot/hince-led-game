/* Sound engine (v2.1 item 1). Every SFX is synthesised here with WebAudio (original, offline, no licence needed).
   Buses: SFX (master gain -> compressor -> limiter -> out) and BGM (bgm gain -> limiter -> out; music.js plays into it).
   The AudioContext is created only by Sfx.unlock() (first touch on ATTRACT); before that every call is a silent no-op.
   Optional file override: src/assets/audio/<key>.mp3|.wav|.ogg, probed at boot with HTMLAudioElement (no fetch/XHR). */
(function () {
  'use strict';
  var ctx = null, master = null, vbus = null, vsend = null, bgm = null, echo = null, noiseBuf = null;
  var enabled = true, volume = 0.8, bgmOn = true, bgmVol = 0.35;
  var scheduled = [], unlockFns = [], unlocked = false, lastTick = 0, hum = null, loops = {};
  var SFX_KEYS = ['ui_tap', 'start', 'select', 'count', 'go', 'um_hold', 'pah', 'tube_fly', 'kiss_color', 'perfect', 'good', 'miss',
    'tap_lane_0', 'tap_lane_1', 'tap_lane_2', 'tap_lane_3', 'tap_gold', 'tap_empty', 'tap_miss', 'combo_up', 'count_tick',
    'win_t1', 'win_t2', 'no_tier', 'key', 'submit', 'staff_ok',
    'kiss_pick', 'kiss_wrong', 'kiss_this', 'time_up', // v2.2 Um-Pah! 2 (kiss_color is v2.1's)
    'grab_move', 'grab_drop', 'grab_close', 'grab_got', 'grab_slip', 'grab_miss', 'grab_shuffle', // v2.2 Tap-Tap! 2 (grab_move = loop)
    'peek', 'card_flip', 'card_nomatch', 'clear']; // v2.3 Um-Pah! 1 memory (+ pah, kiss_color, combo_up, time_up)
  var BGM_KEYS = ['bgm_lobby', 'bgm_umpah', 'bgm_taptap', 'bgm_umpah2', 'bgm_taptap2'];
  var ALIAS = { tap: 'ui_tap', gold: 'tap_gold', empty: 'tap_empty', win: 'win_t1' }; // v2 names ('lane' and 'um' below)
  var files = {}; // key -> { src, pool: [HTMLAudioElement], i }
  // C-major pentatonic, C5 .. G7
  var P = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.51, 1567.98, 1760, 2093, 2349.32, 2637.02, 3135.96];
  var HUM_LO = 180, HUM_HI = 420;

  function ensure() {
    if (ctx) return ctx;
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      var comp = ctx.createDynamicsCompressor(); // overlapping SFX never clip
      comp.threshold.value = -10; comp.knee.value = 6; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.15;
      // final safety limiter shared by SFX and BGM: loud SFX over BGM at 100 % never clip at the output
      var lim = ctx.createDynamicsCompressor();
      lim.threshold.value = -1; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.001; lim.release.value = 0.1;
      lim.connect(ctx.destination);
      master = ctx.createGain(); master.connect(comp); comp.connect(lim);
      bgm = ctx.createGain(); bgm.connect(lim);
      // shared glitter echo: 90 ms delay, feedback .3, wet only
      var d = ctx.createDelay(1), fb = ctx.createGain();
      echo = ctx.createGain(); echo.gain.value = 0.5; d.delayTime.value = 0.09; fb.gain.value = 0.3;
      echo.connect(d); d.connect(fb); fb.connect(d); d.connect(master);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      var nd = noiseBuf.getChannelData(0);
      for (var i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
      newBus(); levels();
    } catch (e) { ctx = null; }
    return ctx;
  }
  // one-shot voices go through vbus (and their echo sends through vsend) so stopAll() can cut them all at once (hum and BGM are separate)
  function newBus() { vbus = ctx.createGain(); vbus.connect(master); vsend = ctx.createGain(); vsend.connect(echo); }
  function levels() {
    if (!ctx) return;
    master.gain.value = enabled ? volume : 0;
    bgm.gain.value = enabled && bgmOn ? bgmVol : 0; // master "Âm thanh" OFF mutes the music too
  }

  // enveloped oscillator. o: f (Hz), f2 (glide target), gl (glide s, default d), t, d (s), type, g (peak), a (attack s), det (cents), send (echo), to,
  // mid (held body: gain g*mid at the end of the glide, then the decay)
  function tone(o) {
    var osc = ctx.createOscillator(), g = ctx.createGain(), t = o.t;
    osc.type = o.type || 'sine';
    osc.frequency.setValueAtTime(o.f, t);
    if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t + (o.gl || o.d));
    if (o.det) osc.detune.value = o.det;
    g.gain.value = 0; g.gain.setValueAtTime(0.0001, t); // silent before t (a GainNode is 1 until its first event: 1-sample onset spike)
    g.gain.exponentialRampToValueAtTime(o.g, t + (o.a || 0.008));
    if (o.mid) g.gain.exponentialRampToValueAtTime(o.g * o.mid, t + o.gl);
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.d);
    osc.connect(g); g.connect(o.to || vbus); if (o.send) g.connect(vsend);
    osc.start(t); osc.stop(t + o.d + 0.02);
    return osc;
  }
  // filtered noise burst. o: t, d, g, type (biquad type), f, f2 (sweep target), q, a (attack s)
  function noise(o) {
    var s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(), t = o.t;
    s.buffer = noiseBuf;
    f.type = o.type || 'highpass'; f.frequency.setValueAtTime(o.f, t); if (o.q) f.Q.value = o.q;
    if (o.f2) f.frequency.exponentialRampToValueAtTime(o.f2, t + o.d);
    g.gain.value = 0; g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(o.g, t + (o.a || 0.002));
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.d);
    s.connect(f); f.connect(g); g.connect(vbus);
    s.start(t, Math.random() * 0.5); s.stop(t + o.d + 0.02);
    return s;
  }
  function arp(t, notes, step, d, g, type, send) {
    notes.forEach(function (f, i) { tone({ f: f, t: t + i * step, d: d, g: g, type: type || 'triangle', send: send }); });
  }
  function chime(t, f, d, g) { // bell: sine + quiet inharmonic partial, into the echo
    tone({ f: f, t: t, d: d, g: g, a: 0.003, send: true });
    tone({ f: f * 2.76, t: t, d: d * 0.45, g: g * 0.22, a: 0.002 });
  }
  function shimmer(t, d, g) { noise({ t: t, d: d, g: g, f: 8000, a: 0.01 }); }
  function pluck(lane) { // glassy pluck: sine + detuned triangle (fast decay) + quiet 2nd harmonic; octave up from combo 10
    return function (t, oct) {
      var f = P[lane] * (oct ? 2 : 1);
      tone({ f: f, t: t, d: 0.35, g: 0.2, a: 0.002 });
      tone({ f: f, t: t, d: 0.22, g: 0.09, a: 0.002, type: 'triangle', det: 7 });
      tone({ f: f * 2, t: t, d: 0.1, g: 0.04, a: 0.002 });
    };
  }

  // key -> synth(t, arg). Peaks per voice <= .35; the compressor catches overlaps.
  var SYN = {
    ui_tap: function (t) { tone({ f: P[7], f2: P[8], t: t, d: 0.06, g: 0.16, a: 0.004, type: 'triangle' }); tone({ f: P[2], t: t, d: 0.05, g: 0.035, a: 0.003, type: 'square' }); },
    start: function (t) {
      arp(t, [P[5], P[7], P[8]], 0.07, 0.22, 0.16);
      arp(t, [P[10], P[12], P[13]], 0.07, 0.18, 0.04, 'sine', true);
      tone({ f: P[10], t: t + 0.21, d: 0.35, g: 0.1, send: true }); shimmer(t + 0.2, 0.3, 0.03);
    },
    select: function (t) {
      noise({ t: t, d: 0.16, g: 0.2, type: 'bandpass', f: 500, f2: 3500, q: 1.5, a: 0.12 });
      tone({ f: 500, f2: 1500, gl: 0.04, t: t + 0.15, d: 0.08, g: 0.25, a: 0.003 });
    },
    count: function (t) { tone({ f: P[2], t: t, d: 0.14, g: 0.14, a: 0.003, type: 'triangle' }); tone({ f: P[2], t: t, d: 0.12, g: 0.06, a: 0.003, type: 'square' }); },
    go: function (t) {
      [P[5], P[7], P[8]].forEach(function (f) { tone({ f: f, t: t, d: 0.45, g: 0.09, type: 'triangle' }); tone({ f: f, t: t, d: 0.3, g: 0.03, type: 'square' }); });
      tone({ f: P[10], t: t, d: 0.5, g: 0.08, send: true });
    },
    pah: function (t) { // lip pop: 8 ms band-passed click + sine drop 900 -> 200 Hz in 70 ms (held body so the low end is heard)
      noise({ t: t, d: 0.008, g: 0.3, type: 'bandpass', f: 1750, q: 1.3, a: 0.001 });
      tone({ f: 900, f2: 200, gl: 0.07, t: t, d: 0.09, g: 0.3, a: 0.003, mid: 0.3 });
    },
    tube_fly: function (t) { noise({ t: t, d: 0.25, g: 0.32, type: 'bandpass', f: 400, f2: 3200, q: 1.2, a: 0.17 }); },
    kiss_color: function (t) { // "mwah": smack pop + opening pop, then 4-note high pentatonic glitter with echo
      noise({ t: t, d: 0.006, g: 0.22, type: 'bandpass', f: 2200, q: 2 });
      tone({ f: 1100, f2: 420, t: t, d: 0.05, g: 0.2, a: 0.003 });
      noise({ t: t + 0.085, d: 0.006, g: 0.18, type: 'bandpass', f: 1800, q: 2 });
      tone({ f: 500, f2: 950, gl: 0.05, t: t + 0.085, d: 0.12, g: 0.22, a: 0.004 });
      arp(t + 0.16, [P[10], P[11], P[12], P[13]], 0.045, 0.22, 0.08, 'sine', true);
    },
    perfect: function (t) { // fires with kiss_color: peak <= kiss_color, octaves dry and quiet, chime on G6 (off the kiss glitter's C7..G7)
      [P[5], P[7], P[8]].forEach(function (f) { tone({ f: f, t: t, d: 0.5, g: 0.07, type: 'triangle' }); tone({ f: f * 2, t: t, d: 0.3, g: 0.015 }); });
      chime(t + 0.08, P[8], 0.6, 0.1); shimmer(t, 0.35, 0.03);
    },
    good: function (t) { tone({ f: P[7], t: t, d: 0.35, g: 0.12 }); chime(t + 0.07, P[8], 0.35, 0.1); },
    miss: function (t) { // "bwomp"
      tone({ f: 330, f2: 262, t: t, d: 0.16, g: 0.18, type: 'triangle' });
      tone({ f: 247, f2: 165, t: t + 0.15, d: 0.35, g: 0.18, type: 'triangle' });
    },
    tap_lane_0: pluck(0), tap_lane_1: pluck(1), tap_lane_2: pluck(2), tap_lane_3: pluck(3),
    tap_gold: function (t) { // "tap-tap" + sparkle tail
      chime(t, P[8], 0.25, 0.16); chime(t + 0.11, P[10], 0.35, 0.16);
      arp(t + 0.2, [P[11], P[12], P[13]], 0.05, 0.18, 0.05, 'sine', true); shimmer(t + 0.2, 0.35, 0.03);
    },
    tap_empty: function (t) { tone({ f: 150, f2: 70, t: t, d: 0.1, g: 0.25, a: 0.003 }); noise({ t: t, d: 0.04, g: 0.1, type: 'lowpass', f: 400 }); },
    tap_miss: function (t) { tone({ f: 233, f2: 196, t: t, d: 0.09, g: 0.12, type: 'triangle' }); },
    combo_up: function (t) { // starts after and above the combo >= 10 octave pluck (C6..G6) so it is not masked
      arp(t + 0.06, [P[9], P[10], P[11], P[12]], 0.035, 0.1, 0.15); tone({ f: P[13], t: t + 0.2, d: 0.3, g: 0.12, type: 'triangle', send: true });
    },
    count_tick: function (t) { tone({ f: 1800, t: t, d: 0.018, g: 0.03, a: 0.001, type: 'square' }); },
    win_t1: function (t) {
      arp(t, [P[5], P[7], P[8]], 0.1, 0.16, 0.12);
      tone({ f: P[10], t: t + 0.3, d: 0.5, g: 0.12, type: 'triangle', send: true });
      tone({ f: P[7], t: t + 0.3, d: 0.5, g: 0.06, type: 'triangle' }); tone({ f: P[8], t: t + 0.3, d: 0.5, g: 0.06, type: 'triangle' });
    },
    win_t2: function (t) {
      arp(t, [P[5], P[7], P[8], P[10]], 0.09, 0.15, 0.12);
      [P[5], P[7], P[8], P[10]].forEach(function (f) { tone({ f: f, t: t + 0.38, d: 0.9, g: 0.07, type: 'triangle' }); });
      chime(t + 0.38, P[12], 0.6, 0.06); shimmer(t + 0.38, 0.6, 0.03);
      arp(t + 0.5, [P[10], P[12], P[13]], 0.06, 0.2, 0.04, 'sine', true);
    },
    no_tier: function (t) { // gentle descending "aww"
      tone({ f: 392, f2: 370, t: t, d: 0.28, g: 0.13, type: 'triangle' });
      tone({ f: 330, f2: 262, gl: 0.5, t: t + 0.24, d: 0.55, g: 0.13, type: 'triangle' });
    },
    key: function (t) { noise({ t: t, d: 0.012, g: 0.12, type: 'bandpass', f: 3000, q: 1 }); tone({ f: 1500, t: t, d: 0.03, g: 0.05, a: 0.002 }); },
    submit: function (t) { tone({ f: P[8], t: t, d: 0.2, g: 0.13 }); chime(t + 0.09, P[10], 0.45, 0.13); },
    staff_ok: function (t) {
      arp(t, [P[5], P[7], P[8], P[10], P[12]], 0.07, 0.14, 0.1);
      [P[5], P[7], P[8]].forEach(function (f) { tone({ f: f, t: t + 0.38, d: 0.6, g: 0.07, type: 'triangle' }); });
      chime(t + 0.38, P[10], 0.7, 0.08); shimmer(t + 0.38, 0.4, 0.03);
    },
    end: function (t) { tone({ f: 523, t: t, d: 0.3, g: 0.2, type: 'triangle' }); tone({ f: 392, t: t + 0.15, d: 0.5, g: 0.2, type: 'triangle' }); }, // v2 sting (unused)
    // ---- v2.2 Um-Pah! 2 ----
    kiss_pick: function (t) { // soft rising pop
      noise({ t: t, d: 0.006, g: 0.1, type: 'bandpass', f: 1800, q: 2 });
      tone({ f: 380, f2: 950, gl: 0.07, t: t, d: 0.12, g: 0.2, a: 0.004, mid: 0.6 });
      tone({ f: P[7], t: t + 0.05, d: 0.1, g: 0.05, a: 0.003, type: 'triangle' });
    },
    kiss_wrong: function (t) { // playful boing (two detuned glides beat = wobble) + low blip, all triangle/sine, nothing harsh
      tone({ f: 700, f2: 260, gl: 0.16, t: t, d: 0.24, g: 0.14, type: 'triangle', mid: 0.6 });
      tone({ f: 700, f2: 260, gl: 0.16, t: t, d: 0.24, g: 0.1, det: 45, mid: 0.6 });
      tone({ f: 196, t: t + 0.24, d: 0.12, g: 0.18, a: 0.004, type: 'triangle' });
      tone({ f: 98, t: t + 0.24, d: 0.1, g: 0.1, a: 0.004 });
    },
    kiss_this: function (t) { chime(t, P[8], 0.45, 0.11); chime(t + 0.16, P[7], 0.7, 0.11); }, // gentle 2-note "this one"
    time_up: function (t) { // short descending arpeggio, landing on a soft low C
      arp(t, [P[10], P[8], P[7], P[5]], 0.075, 0.2, 0.12);
      tone({ f: P[0], t: t + 0.3, d: 0.4, g: 0.12, type: 'triangle' }); tone({ f: P[0] / 2, t: t + 0.3, d: 0.35, g: 0.08 });
    },
    // ---- v2.2 Tap-Tap! 2 ----
    grab_drop: function (t) { // descending zip
      tone({ f: 1500, f2: 260, t: t, d: 0.3, g: 0.12, a: 0.01, type: 'triangle' });
      noise({ t: t, d: 0.3, g: 0.12, type: 'bandpass', f: 3200, f2: 500, q: 3, a: 0.02 });
    },
    grab_close: function (t) { // metal clack: click + two inharmonic rings + low thud
      noise({ t: t, d: 0.03, g: 0.28, type: 'bandpass', f: 2600, q: 4, a: 0.001 });
      tone({ f: 1870, t: t, d: 0.14, g: 0.08, a: 0.001 }); tone({ f: 2950, t: t, d: 0.09, g: 0.05, a: 0.001 });
      tone({ f: 170, f2: 90, t: t, d: 0.07, g: 0.16, a: 0.002 });
    },
    grab_got: function (t) { // claw-machine win jingle (da-da-da DAA) + sparkle
      arp(t, [P[7], P[8], P[10]], 0.08, 0.14, 0.13);
      [P[12], P[10], P[8]].forEach(function (f) { tone({ f: f, t: t + 0.24, d: 0.55, g: 0.07, type: 'triangle' }); });
      tone({ f: P[12], t: t + 0.24, d: 0.3, g: 0.025, type: 'square' });
      arp(t + 0.36, [P[11], P[12], P[13], P[12], P[13]], 0.05, 0.16, 0.05, 'sine', true); shimmer(t + 0.3, 0.45, 0.03);
    },
    grab_slip: function (t) { // wobble (beating pair) then a drop and a soft landing
      tone({ f: 523, t: t, d: 0.24, g: 0.1, type: 'triangle' }); tone({ f: 547, t: t, d: 0.24, g: 0.08 });
      tone({ f: 620, f2: 150, t: t + 0.22, d: 0.26, g: 0.15, type: 'triangle' });
      noise({ t: t + 0.47, d: 0.05, g: 0.1, type: 'lowpass', f: 350 });
    },
    grab_miss: function (t) { // soft "bwomp"
      tone({ f: 294, f2: 233, t: t, d: 0.13, g: 0.13, type: 'triangle' });
      tone({ f: 220, f2: 147, t: t + 0.12, d: 0.3, g: 0.13, type: 'triangle' });
    },
    grab_shuffle: function (t) { // 7 quick bouncy hops (the 450 ms shuffle)
      [P[3], P[5], P[4], P[6], P[5], P[7], P[8]].forEach(function (f, i) { tone({ f: f * 0.6, f2: f, gl: 0.03, t: t + i * 0.065, d: 0.055, g: 0.12, a: 0.003 }); });
    },
    // ---- v2.3 Um-Pah! 1 (memory) ----
    peek: function (t) { // soft sparkle whoosh: rising band-passed air + a quiet high glitter run with echo
      noise({ t: t, d: 0.45, g: 0.1, type: 'bandpass', f: 900, f2: 6000, q: 1.2, a: 0.2 });
      arp(t + 0.12, [P[9], P[10], P[11], P[12], P[13]], 0.05, 0.2, 0.045, 'sine', true);
    },
    card_flip: function (t) { // 40 ms paper flick: short band-passed tick + tiny blip, pitch +-5 % random
      var k = 0.95 + Math.random() * 0.1;
      noise({ t: t, d: 0.025, g: 0.16, type: 'bandpass', f: 2600 * k, q: 1.4, a: 0.001 });
      tone({ f: 1250 * k, f2: 1650 * k, t: t, d: 0.04, g: 0.08, a: 0.002, type: 'triangle' });
    },
    card_nomatch: function (t) { // soft descending 2-note (triangle, quiet)
      tone({ f: P[4], t: t, d: 0.16, g: 0.12, type: 'triangle' });
      tone({ f: P[2], f2: P[2] * 0.97, t: t + 0.13, d: 0.26, g: 0.12, type: 'triangle' });
    },
    clear: function (t) { // short bright fanfare: C-E-G-C run, held major chord, chime + sparkle
      arp(t, [P[5], P[7], P[8], P[10]], 0.08, 0.16, 0.12);
      [P[5], P[7], P[8], P[10]].forEach(function (f) { tone({ f: f, t: t + 0.32, d: 0.7, g: 0.06, type: 'triangle' }); });
      chime(t + 0.32, P[12], 0.6, 0.07); shimmer(t + 0.32, 0.45, 0.03);
    }
  };
  // looping synth voices (start/stop API): key -> function() returning { o: [sources], g: gain }
  var LOOP = {
    grab_move: function () { // very quiet motor hum: saw 110 Hz + sine sub -> low-pass -> 8 Hz ripple, + a faint gear whir
      var t = ctx.currentTime, a = ctx.createOscillator(), b = ctx.createOscillator(), lp = ctx.createBiquadFilter(), lfo = ctx.createOscillator(),
        depth = ctx.createGain(), trem = ctx.createGain(), g = ctx.createGain(), n = ctx.createBufferSource(), bp = ctx.createBiquadFilter(), ng = ctx.createGain();
      a.type = 'sawtooth'; a.frequency.value = 110; b.type = 'sine'; b.frequency.value = 55; // harmonic pair: no beating
      lp.type = 'lowpass'; lp.frequency.value = 700; lp.Q.value = 2;
      lfo.frequency.value = 8; depth.gain.value = 0.2; lfo.connect(depth); depth.connect(trem.gain);
      n.buffer = noiseBuf; n.loop = true; bp.type = 'bandpass'; bp.frequency.value = 1200; bp.Q.value = 1; ng.gain.value = 0.25;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.01, t + 0.06);
      a.connect(lp); b.connect(lp); n.connect(bp); bp.connect(ng); ng.connect(lp); lp.connect(trem); trem.connect(g); g.connect(master);
      a.start(t); b.start(t); lfo.start(t); n.start(t);
      return { o: [a, b, lfo, n], g: g };
    }
  };

  // ---------- file overrides (HTMLAudioElement only) ----------
  function playEl(el) { try { var p = el.play(); if (p && p.catch) p.catch(function () { }); } catch (e) { } }
  function playFile(f, rate) {
    var el = f.pool[f.i = (f.i + 1) % f.pool.length];
    try { el.pause(); el.currentTime = 0; el.volume = volume; el.playbackRate = rate; } catch (e) { }
    playEl(el);
  }
  function found(key, src, el) {
    var pool = [el], bgmKey = key.indexOf('bgm_') === 0;
    if (bgmKey) el.loop = true;
    else for (var i = 0; i < 2; i++) { var a = new Audio(src); a.preload = 'auto'; pool.push(a); } // 3 per SFX key so sounds overlap
    pool.forEach(function (a) { a.preservesPitch = false; }); // playbackRate 2 = octave up, the hum glides by rate
    files[key] = { src: src, pool: pool, i: 0 };
  }
  // one probe at a time (mp3 -> wav -> ogg per key); a missing file is a console ERR_FILE_NOT_FOUND and falls back to synth
  function probe(keys) {
    var list = [];
    (keys || BGM_KEYS.concat(SFX_KEYS)).forEach(function (k) { ['mp3', 'wav', 'ogg'].forEach(function (x) { list.push([k, x]); }); });
    (function next() {
      var it = list.shift(); if (!it) return;
      if (files[it[0]]) return next();
      var src = 'assets/audio/' + it[0] + '.' + it[1], el = new Audio(), to = 0;
      function done(ok) { clearTimeout(to); el.oncanplaythrough = el.onerror = null; if (ok) found(it[0], src, el); next(); }
      el.oncanplaythrough = function () { done(true); };
      el.onerror = function () { done(false); };
      to = setTimeout(function () { done(el.readyState >= 1); }, 4000); // slow big file: metadata is enough; a stuck load never blocks the rest
      el.preload = 'auto'; el.src = src;
    })();
  }

  // ---------- signature hum (Um-Pah! hold) ----------
  function humStart() {
    if (!ctx || !enabled) return;
    humStop();
    try { humVoice(); } catch (e) { hum = null; }
  }
  function humVoice() {
    var fl = files.um_hold;
    if (fl) { var el = fl.pool[0]; el.loop = true; try { el.currentTime = 0; el.volume = volume; el.playbackRate = 1; } catch (e) { } playEl(el); hum = { el: el }; return; }
    var t = ctx.currentTime, a = ctx.createOscillator(), b = ctx.createOscillator(), bg = ctx.createGain(), lfo = ctx.createOscillator(),
      depth = ctx.createGain(), lp = ctx.createBiquadFilter(), trem = ctx.createGain(), g = ctx.createGain();
    a.type = 'sine'; b.type = 'triangle'; b.detune.value = 6; bg.gain.value = 0.6;
    a.frequency.value = b.frequency.value = HUM_LO;
    lp.type = 'lowpass'; lp.frequency.value = 800; lp.Q.value = 1; // "closed mouth"
    lfo.frequency.value = 6; depth.gain.value = 0.12; lfo.connect(depth); depth.connect(trem.gain); // tremolo 1 +- .12
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.16, t + 0.04);
    a.connect(lp); b.connect(bg); bg.connect(lp); lp.connect(trem); trem.connect(g); g.connect(master);
    a.start(t); b.start(t); lfo.start(t);
    hum = { o: [a, b, lfo], g: g, f: HUM_LO };
  }
  function humUpdate(p) { // p = hold / periodMs: 180 -> 420 Hz (exponential) over one ring loop
    if (!hum) return;
    p = p < 0 ? 0 : p > 1 ? 1 : p;
    var f = HUM_LO * Math.pow(HUM_HI / HUM_LO, p);
    if (Math.abs(f - hum.f) < 0.5) return;
    hum.f = f;
    if (hum.el) { try { hum.el.playbackRate = f / HUM_LO; } catch (e) { } return; }
    var t = ctx.currentTime;
    hum.o[0].frequency.setTargetAtTime(f, t, 0.015); hum.o[1].frequency.setTargetAtTime(f, t, 0.015);
  }
  function humStop() { var h = hum; hum = null; cut(h); }
  function cut(h) { // instant, click-free: 12 ms ramp
    if (!h) return;
    if (h.el) { try { h.el.pause(); } catch (e) { } return; }
    try {
      var t = ctx.currentTime, v = h.g.gain.value;
      h.g.gain.cancelScheduledValues(t); h.g.gain.setValueAtTime(v, t); h.g.gain.linearRampToValueAtTime(0, t + 0.012);
      h.o.forEach(function (o) { o.stop(t + 0.03); });
    } catch (e) { }
  }

  // ---------- loops (Tap-Tap! 2 grab_move): start/stop like the hum; a file override loops its HTMLAudioElement ----------
  function loopStart(key) {
    if (!ctx || !enabled || !LOOP[key]) return;
    loopStop(key);
    var fl = files[key];
    try {
      if (fl) { var el = fl.pool[0]; el.loop = true; try { el.currentTime = 0; el.volume = volume; el.playbackRate = 1; } catch (e) { } playEl(el); loops[key] = { el: el }; }
      else loops[key] = LOOP[key]();
    } catch (e) { loops[key] = null; }
  }
  function loopStop(key) { var h = loops[key]; loops[key] = null; cut(h); }
  function loopsStop() { Object.keys(loops).forEach(loopStop); }

  var Sfx = {
    unlock: function () {
      if (!ensure()) return;
      if (ctx.state === 'suspended') { try { var p = ctx.resume(); if (p && p.catch) p.catch(function () { }); } catch (e) { } }
      if (!unlocked) { unlocked = true; unlockFns.forEach(function (fn) { try { fn(); } catch (e) { } }); }
    },
    onUnlock: function (fn) { if (unlocked) fn(); else unlockFns.push(fn); },
    setEnabled: function (on) { enabled = !!on; levels(); if (!enabled) { humStop(); loopsStop(); } },
    setVolume: function (v) { volume = v; levels(); },
    setBgmEnabled: function (on) { bgmOn = !!on; levels(); },
    setBgmVolume: function (v) { bgmVol = v; levels(); },
    bgmLevel: function () { return enabled && bgmOn ? bgmVol : 0; }, // for BGM file elements (.volume)
    ctx: function () { return ctx; },
    bgmBus: function () { return bgm; },
    now: function () { return ctx ? ctx.currentTime : 0; },
    probe: probe,
    fileEl: function (key) { return files[key] ? files[key].pool[0] : null; }, // e.g. Sfx.fileEl('bgm_lobby')
    sources: function () {
      var o = {};
      SFX_KEYS.concat(BGM_KEYS).forEach(function (k) { o[k] = files[k] ? 'file:' + files[k].src : 'synth'; });
      return o;
    },
    // play(key) for every key in SFX_KEYS; play('tap_lane_<0..3>', octaveUp); v2 names still work
    play: function (name, arg) {
      if (!ctx || !enabled) return;
      var key = ALIAS[name] || name;
      if (key === 'lane') { key = 'tap_lane_' + ((arg | 0) & 3); arg = false; }
      if (key === 'um') return;
      if (key === 'um_hold') return humStart();
      if (LOOP[key]) return loopStart(key);
      if (key === 'count_tick') { var now = performance.now(); if (now - lastTick < 60) return; lastTick = now; }
      var f = files[key];
      if (f) return playFile(f, key.indexOf('tap_lane') === 0 && arg ? 2 : 1);
      if (SYN[key]) { try { SYN[key](ctx.currentTime + 0.005, arg); } catch (e) { } }
    },
    humStart: humStart,
    humUpdate: humUpdate,
    humStop: humStop,
    loopStart: loopStart, // Sfx.loopStart('grab_move') / Sfx.loopStop('grab_move')
    loopStop: loopStop,
    // App.home: cut the hum, the loops, the Tap-Tap beats and every one-shot still ringing or scheduled (BGM keeps playing)
    stopAll: function () {
      humStop(); loopsStop(); Sfx.stopBeats();
      Object.keys(files).forEach(function (k) { if (k.indexOf('bgm_') !== 0) files[k].pool.forEach(function (el) { try { el.pause(); } catch (e) { } }); });
      if (!ctx) return;
      var old = vbus, oldS = vsend; newBus();
      old.gain.setTargetAtTime(0, ctx.currentTime, 0.008); oldS.gain.setTargetAtTime(0, ctx.currentTime, 0.008);
      setTimeout(function () { try { old.disconnect(); oldS.disconnect(); } catch (e) { } }, 80);
    },
    // soft beat for Tap-Tap!; times in ms relative to startAtCtx (ctx seconds)
    scheduleBeats: function (timesMs, startAtCtx) {
      Sfx.stopBeats();
      if (!ctx || !enabled) return;
      var seen = {};
      try {
        timesMs.forEach(function (ms) {
          if (seen[ms]) return; seen[ms] = 1;
          var t = startAtCtx + ms / 1000;
          scheduled.push(tone({ f: 110, f2: 55, t: t, d: 0.18, g: 0.22 }));
          scheduled.push(noise({ t: t, d: 0.04, g: 0.035, f: 7000 }));
        });
      } catch (e) { }
    },
    stopBeats: function () {
      scheduled.forEach(function (n) { try { n.stop(); } catch (e) { } });
      scheduled = [];
    }
  };
  window.Sfx = Sfx;
})();

/* Background music (v2.1 item 1, v2.2 item 4): 5 ORIGINAL chiptune loops composed here (no licence needed), played by a small
   lookahead step sequencer on Sfx.ctx() into Sfx.bgmBus(). Starts only after Sfx.unlock (first touch); 600 ms crossfade
   between tracks; Um-Pah! ducks to 25 % while the player holds.
   Optional file override: assets/audio/bgm_lobby|bgm_umpah|bgm_taptap|bgm_umpah2|bgm_taptap2 .mp3/.wav/.ogg (probed by Sfx.probe), played by its
   looping HTMLAudioElement; the crossfade/duck then step its .volume. */
(function () {
  'use strict';
  var LOOK = 0.12, FADE = 0.6, DUCK = 0.25, PENT = [0, 2, 4, 7, 9];

  function hz(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  // pattern: one char = one 16th. '.' rest, '-' holds the previous note, 0-9/a-f = C-major pentatonic degree above
  // the base MIDI note (5 = one octave up), 'x' = drum hit. Spaces and '|' only separate beats/bars.
  function part(str, base, v, g) {
    var out = [], last = null;
    str = str.replace(/[ |]/g, '');
    for (var i = 0; i < str.length; i++) {
      var c = str.charAt(i), n = null;
      if (c === '-') { if (last) last.n++; out.push(null); continue; }
      if (c === 'x') n = { f: 0, n: 1, v: v, g: g };
      else if (c !== '.') { var k = parseInt(c, 16); n = { f: hz(base + 12 * Math.floor(k / 5) + PENT[k % 5]), n: 1, v: v, g: g }; }
      out.push(last = n);
    }
    return out;
  }
  // track = per-step event lists (built once; the scheduler only reads them)
  function track(bpm, lvl, parts) {
    var ev = [];
    parts.forEach(function (p) {
      part(p[0], p[1], p[2], p[3]).forEach(function (n, s) { ev[s] = ev[s] || []; if (n) ev[s].push(n); });
    });
    return { bpm: bpm, lvl: lvl, ev: ev, step: 60 / bpm / 4 };
  }
  function bars(list) { return list.join('|'); }

  // ---------- the music (8 bars each; C-major pentatonic: C D E G A) ----------
  // lobby, 112 BPM, chords C Am Dsus G | C C/E Am G: square 16th arpeggios, triangle tune, bouncy bass, offbeat hats
  var LOBBY = track(112, 1, [
    [bars(['578a 878a 578a 878a', '4579 7579 4579 7579', '689b 989b 689b 989b', '3689 8689 3689 8689',
      '578a 878a 578a 878a', '78ac a8ac 78ac a8ac', '4579 7579 4579 7579', '3689 8689 3689 9864']), 48, 'sq', 0.07],
    [bars(['2-3- 5--- 3-2- 0---', '4--- 5-4- 2--- ----', '1-3- 4--- 6-4- 3---', '3--- ---- 1-2- 3---',
      '5-7- 5-3- 2-3- 5---', '7--- 5--- 3-2- 3---', '4-5- 4-2- 0-2- 4---', '3--- 1--- 3-2- 1---']), 72, 'tri', 0.18],
    [bars(['5-.5 ..a. 5-.5 ..a.', '4-.4 ..9. 4-.4 ..9.', '6-.6 ..b. 6-.6 ..b.', '3-.3 ..8. 3-.3 ..8.',
      '5-.5 ..a. 5-.5 ..a.', '7-.7 ..c. 7-.7 ..c.', '4-.4 ..9. 4-.4 ..9.', '3-.3 ..8. 3-.3 ..8.']), 36, 'tri', 0.3],
    [bars(['..x. ..x. ..x. ..x.', '..x. ..x. ..x. ..x.', '..x. ..x. ..x. ..x.', '..x. ..x. ..x. ..x.',
      '..x. ..x. ..x. ..x.', '..x. ..x. ..x. ..x.', '..x. ..x. ..x. ..x.', '..x. ..x. ..x. ..x.']), 0, 'hat', 0.06]
  ]);
  // umpah, 90 BPM, same colours slower: soft triangle pad (3 voices), um-pah bass, sparse sine bells
  var PAD = function (a) { return bars(a.map(function (c) { return c + '--- ---- ---- ----'; })); };
  var UMPAH = track(90, 0.65, [ // 'lighter' (TASK §1.3): the continuous pad sits level with lobby
    [PAD(['5', '4', '6', '3', '5', '7', '4', '3']), 48, 'pad', 0.06],
    [PAD(['7', '5', '8', '6', '7', '8', '5', '6']), 48, 'pad', 0.06],
    [PAD(['8', '7', '9', '8', '8', 'a', '7', '8']), 48, 'pad', 0.06],
    [bars(['5--. .... 8--. ....', '4--. .... 7--. ....', '6--. .... 9--. ....', '3--. .... 6--. ..5.',
      '5--. .... 8--. ....', '7--. .... 5--. ....', '4--. .... 7--. ....', '3--. .... 6--. ....']), 36, 'tri', 0.3],
    [bars(['4--- 2--- 3--- ----', '2--- 0--- ---- ----', '1--- 3--- 4--- ----', '3--- ---- ---- ----',
      '5--- 4--- 3--- 2---', '3--- ---- ---- ----', '4--- 2--- 0--- 2---', '1--- ---- ---- ----']), 72, 'bell', 0.14]
  ]);
  // taptap, 100 BPM free-running, at 50 %: light kick, hats, bass. In game Music.lock() bends its grid onto the chart
  // (1 beat per note-beat, 600 -> 460 -> 380 ms) so the tile beats stay the main rhythm.
  var KICKS = [], HATS = [];
  for (var b = 0; b < 8; b++) { KICKS.push('x... .... x... ....'); HATS.push('..x. ..x. ..x. ..xx'); }
  var TAPTAP = track(100, 0.5, [
    [bars(KICKS), 0, 'kick', 0.44],
    [bars(HATS), 0, 'hat', 0.1],
    [bars(['5-.5 ..5. 5-.5 ..a.', '4-.4 ..4. 4-.4 ..9.', '6-.6 ..6. 6-.6 ..b.', '3-.3 ..3. 3-.3 ..8.',
      '5-.5 ..5. 5-.5 ..a.', '7-.7 ..7. 7-.7 ..c.', '4-.4 ..4. 4-.4 ..9.', '3-.3 ..3. 3-.3 ..8.']), 36, 'tri', 0.4]
  ]);
  // umpah2 (Um-Pah! 2), 118 BPM, bubbly and pink, chords C Am G C | C E D G: bouncy octave bass, light kick, offbeat hats,
  // 'bub' bubbles (rising sine blips) in pairs on the off-16ths, bell tune on top
  var UMPAH2 = track(118, 0.6, [
    [bars(['5-.a ..5. 5-.a ..a.', '4-.9 ..4. 4-.9 ..9.', '3-.8 ..3. 3-.8 ..8.', '5-.a ..5. 5-.a ..a.',
      '5-.a ..5. 5-.a ..a.', '7-.c ..7. 7-.c ..c.', '6-.b ..6. 6-.b ..b.', '3-.8 ..3. 3-.8 .8a.']), 36, 'tri', 0.28],
    [bars(['x... .... x... ....', 'x... .... x... ....', 'x... .... x... ....', 'x... .... x... ....',
      'x... .... x... ....', 'x... .... x... ....', 'x... .... x... ....', 'x... .... x... x.x.']), 0, 'kick', 0.22],
    [bars(['..x. ..x. ..x. ..x.', '..x. ..x. ..x. ..x.', '..x. ..x. ..x. ..x.', '..x. ..x. ..x. ..x.',
      '..x. ..x. ..x. ..x.', '..x. ..x. ..x. ..x.', '..x. ..x. ..x. ..x.', '..x. ..x. ..x. ..xx']), 0, 'hat', 0.05],
    [bars(['..02 ..35 ..23 ..5.', '..24 ..57 ..45 ..7.', '..13 ..36 ..13 ..6.', '..35 ..58 ..57 .8a.',
      '..02 ..35 ..23 ..5.', '..23 ..27 ..37 ..8.', '..14 ..46 ..16 ..9.', '..36 ..68 ..8a .b..']), 60, 'bub', 0.1],
    [bars(['2-3- 5-3- 2--- 0---', '4-5- 4-2- 4--- ----', '3-4- 3-1- 3--- 1-3-', '5--- 3--- 2--- ----',
      '2-3- 5-3- 2-3- 5-7-', '7--- 5-7- 8--- 7---', '6-4- 6-4- 3-1- ----', '3--- 4-3- 1--- ----']), 72, 'bell', 0.14]
  ]);
  // taptap2 (Tap-Tap! 2), 100 BPM, arcade claw-machine tune: oom-pah (triangle bass on 1 and 3, square stabs on 2 and 4),
  // offbeat hats, music-box lead ('box': sine that rings ~0.6 s like a comb tooth). Chords C Am D G | C E Am-D G
  var TAPTAP2 = track(100, 0.6, [
    [bars(['5--. .... 3--. ....', '4--. .... 2--. ....', '6--. .... 4--. ....', '3--. .... 1--. ..3.',
      '5--. .... 3--. ....', '7--. .... 3--. ....', '4--. .... 6--. ....', '3--. .... 1--. 2.3.']), 36, 'tri', 0.3],
    [bars(['.... 2... .... 2...', '.... 2... .... 2...', '.... 1... .... 1...', '.... 1... .... 1...',
      '.... 2... .... 2...', '.... 2... .... 2...', '.... 2... .... 1...', '.... 1... .... 1...']), 60, 'sq', 0.035],
    [bars(['.... 3... .... 3...', '.... 4... .... 4...', '.... 4... .... 4...', '.... 3... .... 3...',
      '.... 3... .... 3...', '.... 3... .... 3...', '.... 4... .... 4...', '.... 3... .... 3...']), 60, 'sq', 0.035],
    [bars(['..x. ..x. ..x. ..x.', '..x. ..x. ..x. ..x.', '..x. ..x. ..x. ..x.', '..x. ..x. ..x. ..x.',
      '..x. ..x. ..x. ..x.', '..x. ..x. ..x. ..x.', '..x. ..x. ..x. ..x.', '..x. ..x. ..x. ..x.']), 0, 'hat', 0.04],
    [bars(['8.8. a.8. 7.5. 7...', '9.9. a.9. 7... ....', '6.6. 9.6. b.9. 6...', '8... 6.8. 9.8. 6...',
      '8.8. a.8. c.a. 8...', 'c.a. c.d. c... a...', '9.a. 9.7. 6.9. b...', 'a... 8... 6... ....']), 72, 'box', 0.11]
  ]);
  var T = { lobby: LOBBY, umpah: UMPAH, umpah2: UMPAH2, taptap: TAPTAP, taptap2: TAPTAP2 };

  // ---------- voices ----------
  var noiseBuf = null;
  function voice(ac, out, n, t, d) {
    var g = ac.createGain(), src, end;
    g.gain.value = 0; // silent before t (no 1-sample onset spike)
    if (n.v === 'hat') {
      if (!noiseBuf) { // fixed noise = identical hats every loop (like a chip noise channel)
        noiseBuf = ac.createBuffer(1, 2048, ac.sampleRate);
        for (var i = 0, nd = noiseBuf.getChannelData(0); i < nd.length; i++) nd[i] = Math.random() * 2 - 1;
      }
      var hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7000;
      src = ac.createBufferSource(); src.buffer = noiseBuf; src.connect(hp); hp.connect(g); d = 0.035;
    } else {
      src = ac.createOscillator(); src.connect(g);
      src.type = n.v === 'sq' ? 'square' : n.v === 'tri' || n.v === 'pad' ? 'triangle' : 'sine';
      if (n.v === 'kick') { src.frequency.setValueAtTime(140, t); src.frequency.exponentialRampToValueAtTime(45, t + 0.12); d = 0.14; }
      else if (n.v === 'bub') { src.frequency.setValueAtTime(n.f * 0.6, t); src.frequency.exponentialRampToValueAtTime(n.f, t + 0.05); } // bubble: rising blip
      else src.frequency.setValueAtTime(n.f, t);
      if (n.v === 'box') d = 0.6; // music box: every note rings out the same
    }
    if (n.v === 'pad') { // slow swell, release overlaps the next chord
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(n.g, t + 0.3);
      g.gain.setValueAtTime(n.g, t + d); g.gain.linearRampToValueAtTime(0, end = t + d + 0.3);
    } else {
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(n.g, t + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, end = t + d);
    }
    g.connect(out); src.start(t); src.stop(end + 0.02);
  }

  // ---------- sequencer ----------
  var live = [], cur = null, want = null, paused = false, ready = false, timer = 0, duckG = null, ducked = false;
  function clamp01(k) { return k < 0 ? 0 : k > 1 ? 1 : k; }
  function ramp(param, to, t, d) { param.cancelScheduledValues(t); param.setValueAtTime(param.value, t); param.linearRampToValueAtTime(to, t + d); }
  function drop(p) { try { p.g.disconnect(); } catch (e) { } if (p.el) { try { p.el.pause(); } catch (e) { } } }

  // every 25 ms: schedule each live track's steps up to LOOK s ahead; steps already in the past are skipped (throttled tab), not bunched
  function tick() {
    var ac = Sfx.ctx(); if (!ac) return;
    var now = ac.currentTime, mute = Sfx.bgmLevel() === 0;
    for (var i = live.length - 1; i >= 0; i--) {
      var p = live[i], tr = p.tr;
      if (p.end && now > p.end + 0.2) { drop(p); live.splice(i, 1); continue; }
      if (p.el) { // file override: crossfade and duck by .volume
        var k = p.end ? clamp01((p.end - now) / FADE) : clamp01((now - p.t0) / FADE);
        try { p.el.volume = clamp01(Sfx.bgmLevel() * tr.lvl * k * (ducked ? DUCK : 1)); } catch (e) { }
        continue;
      }
      while (p.next < now + LOOK) {
        var ev = tr.ev[p.s], st = p.beats ? (p.beats[p.bi + 1] - p.beats[p.bi]) / 4 : tr.step; // locked: 4 steps per note-beat
        if (!mute && p.next >= now - 0.01 && (!p.end || p.next < p.end)) for (var j = 0; j < ev.length; j++) voice(ac, p.g, ev[j], p.next, ev[j].n * st * 0.9);
        p.next += st; if (p.beats && p.s % 4 === 3 && p.bi < p.beats.length - 2) p.bi++; // after the last note: keep its spacing
        p.s = (p.s + 1) % tr.ev.length;
      }
    }
    if (!live.length && timer) { clearInterval(timer); timer = 0; }
  }

  // crossfade to track name (null = fade out). Same track keeps playing.
  function set(name) {
    if (!ready || name === cur) return;
    var ac = Sfx.ctx(), t = ac.currentTime;
    if (!duckG) { duckG = ac.createGain(); duckG.gain.value = ducked ? DUCK : 1; duckG.connect(Sfx.bgmBus()); }
    live.forEach(function (p) { if (!p.end) { p.end = t + FADE; ramp(p.g.gain, 0, t, FADE); } });
    cur = name;
    if (name) {
      // a file track coming back while it still fades out: hand its one <audio> element to the new instance
      live = live.filter(function (q) { if (q.name !== name || !q.el) return true; try { q.g.disconnect(); } catch (e) { } return false; });
      var p ={ name: name, tr: T[name], g: ac.createGain(), s: 0, next: t + 0.05, end: 0, t0: t, el: Sfx.fileEl('bgm_' + name) };
      p.g.gain.value = 0; p.g.connect(duckG); ramp(p.g.gain, p.tr.lvl, t, FADE);
      if (p.el) { try { p.el.volume = 0; p.el.currentTime = 0; var pr = p.el.play(); if (pr && pr.catch) pr.catch(function () { }); } catch (e) { } }
      live.push(p);
    }
    if (!timer && live.length) timer = setInterval(tick, 25);
    tick();
  }

  window.Music = {
    play: function (name) { want = T[name] ? name : null; paused = false; set(want); },
    stop: function () { want = null; set(null); }, // 600 ms fade; the interval clears once nothing is left
    pause: function () { paused = true; set(null); }, // promo video (item 6); remembers the wanted track
    resume: function () { paused = false; set(want); },
    duck: function (on) { // Um-Pah! hold: 25 % in 80 ms, back in 80 ms
      ducked = !!on;
      var ac = Sfx.ctx(); if (duckG && ac) ramp(duckG.gain, ducked ? DUCK : 1, ac.currentTime, 0.08);
    },
    // Tap-Tap!: lock the playing taptap groove to the chart (t0 = ctx time of chart 0, ms = note times): one beat per distinct
    // note time, pre-rolled back to now at the first spacing, so kick/hats/bass follow 600 -> 460 -> 380 ms. Chart timing untouched.
    lock: function (t0, ms) {
      var p = live[live.length - 1], b = [], ac = Sfx.ctx();
      if (!p || p.name !== 'taptap' || p.end || p.el || !ac) return;
      ms.forEach(function (m) { var s = t0 + m / 1000; if (s !== b[b.length - 1]) b.push(s); });
      if (b.length < 2) return;
      while (b[0] - (b[1] - b[0]) >= p.next) b.unshift(b[0] - (b[1] - b[0])); // steps before p.next are already scheduled
      p.beats = b; p.bi = 0; p.s = 0; p.next = b[0];
    },
    current: function () { return cur; },
    loopSec: function (name) { return T[name].ev.length * T[name].step; }, // for the audio QA
    tick: tick // the audio QA drives it on an OfflineAudioContext
  };
  Sfx.onUnlock(function () { ready = true; if (!paused) set(want); });
})();

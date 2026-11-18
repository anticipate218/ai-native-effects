import '../../src/effects/decrypt-text';
import type { DecryptTextElement } from '../../src/effects/decrypt-text';
import { timeline, type Scene } from '../shared/scene';

/** A product hero built from decrypting text (fictional product, original copy). */
export const HERO = `
  <div style="position:absolute;inset:0;background:
      radial-gradient(60% 55% at 50% 38%, rgba(94,242,255,.10), transparent 70%),
      linear-gradient(rgba(255,255,255,.045) 1px, transparent 1px) 0 0 / 32px 32px,
      linear-gradient(90deg, rgba(255,255,255,.045) 1px, transparent 1px) 0 0 / 32px 32px,
      #05070d"></div>
  <div style="position:absolute;inset:0;background:radial-gradient(75% 70% at 50% 45%, transparent 40%, #05070d 100%)"></div>
  <nav style="position:absolute;left:34px;right:34px;top:22px;display:flex;align-items:center;justify-content:space-between;font:500 13px/1 ui-sans-serif,system-ui,'Segoe UI',sans-serif;color:rgba(232,240,255,.78)">
    <span style="display:inline-flex;align-items:center;gap:8px;color:#fff;font-weight:650"><span style="width:16px;height:16px;border-radius:4px;background:linear-gradient(135deg,#5ef2ff,#7c5cff)"></span>Cipherline</span>
    <span style="display:flex;gap:24px"><span>Platform</span><span>Docs</span><span>Changelog</span></span>
    <span style="padding:8px 14px;border-radius:8px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.18);color:#fff">Log in</span>
  </nav>
  <div style="position:absolute;inset:0;display:grid;align-content:center;justify-items:center;text-align:center;gap:0;padding-top:12px;font-family:ui-sans-serif,system-ui,'Segoe UI',sans-serif">
    <span style="display:inline-flex;align-items:center;gap:8px;font:600 11.5px/1 ui-monospace,'Cascadia Mono',Consolas,monospace;letter-spacing:.14em;color:#5ef2ff">
      <i style="width:6px;height:6px;border-radius:50%;background:#5ef2ff;box-shadow:0 0 10px #5ef2ff"></i>
      <ane-decrypt-text class="eyebrow" trigger="manual" charset="hex" stagger="500" scramble="420" seed="3" text="SECURE CHANNEL // ONLINE"></ane-decrypt-text>
    </span>
    <h1 style="margin:16px 0 0;font-size:54px;line-height:1.04;font-weight:680;letter-spacing:-.035em;color:#fff">
      <ane-decrypt-text class="h1" trigger="manual" charset="latin" stagger="520" scramble="380" seed="5" text="Interfaces that"></ane-decrypt-text><br>
      <span style="background:linear-gradient(90deg,#5ef2ff,#9b7bff);-webkit-background-clip:text;background-clip:text;color:transparent">
        <ane-decrypt-text class="word" trigger="manual" charset="latin" stagger="300" scramble="420" seed="9" accent="#ffffff" text="remember."></ane-decrypt-text>
      </span>
    </h1>
    <p style="margin:16px 0 0;max-width:430px;font-size:15px;line-height:1.55;color:rgba(232,240,255,.66)">
      <ane-decrypt-text class="sub" trigger="manual" charset="latin" order="random" stagger="700" scramble="260" seed="11" accent="#7c8cff" text="Encrypted state, instant sync and a UI that answers in milliseconds."></ane-decrypt-text>
    </p>
    <div style="display:flex;gap:10px;margin-top:22px;font-size:14px;font-weight:600">
      <span style="padding:11px 18px;border-radius:9px;background:#5ef2ff;color:#04121a;box-shadow:0 8px 30px rgba(94,242,255,.28)">Start building</span>
      <span style="padding:11px 16px;border-radius:9px;color:#fff;box-shadow:inset 0 0 0 1px rgba(255,255,255,.18)">Read the docs</span>
    </div>
    <div style="display:flex;gap:44px;margin-top:30px;font:500 11px/1.4 ui-sans-serif,system-ui,sans-serif;color:rgba(232,240,255,.5);letter-spacing:.06em;text-transform:uppercase">
      <span><b style="display:block;font:600 22px/1.2 ui-monospace,'Cascadia Mono',Consolas,monospace;letter-spacing:0;color:#fff;text-transform:none"><ane-decrypt-text class="stat" trigger="manual" charset="digits" stagger="300" scramble="700" seed="21" text="99.98%"></ane-decrypt-text></b>uptime</span>
      <span><b style="display:block;font:600 22px/1.2 ui-monospace,'Cascadia Mono',Consolas,monospace;letter-spacing:0;color:#fff;text-transform:none"><ane-decrypt-text class="stat" trigger="manual" charset="digits" stagger="300" scramble="800" seed="22" text="12 ms"></ane-decrypt-text></b>p50 latency</span>
      <span><b style="display:block;font:600 22px/1.2 ui-monospace,'Cascadia Mono',Consolas,monospace;letter-spacing:0;color:#fff;text-transform:none"><ane-decrypt-text class="stat" trigger="manual" charset="digits" stagger="300" scramble="900" seed="23" text="4,200"></ane-decrypt-text></b>teams</span>
    </div>
  </div>`;

const scene: Scene = {
  width: 800,
  height: 450,
  duration: 9600,
  poster: 2600,
  play(stage) {
    stage.innerHTML = HERO;
    const $ = (s: string): DecryptTextElement => stage.querySelector<DecryptTextElement>(s)!;
    const word = $('.word');
    return timeline([
      [200, () => $('.eyebrow').decode()],
      [500, () => $('.h1').decode()],
      [900, () => word.decode()],
      [1300, () => $('.sub').decode()],
      [1700, () => stage.querySelectorAll<DecryptTextElement>('.stat').forEach((s) => s.decode())],
      [4200, () => (word.text = 'react.')],
      [6400, () => (word.text = 'feel alive.')],
    ]);
  },
};

export default scene;

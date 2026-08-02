// node_modules/driver.js/dist/driver.js.mjs
var e = [`pointerdown`, `mousedown`, `pointerup`, `mouseup`, `click`];
var t = /* @__PURE__ */ new WeakMap();
function n(n2, i2, a2) {
  r(n2);
  let o2 = (e2) => {
    let t2 = e2.target;
    n2.contains(t2) && ((!a2 || a2(t2)) && (e2.preventDefault(), e2.stopPropagation(), e2.stopImmediatePropagation()), e2.type === `click` && i2?.(e2));
  };
  for (let t2 of e) document.addEventListener(t2, o2, true);
  t.set(n2, o2);
}
function r(n2) {
  let r2 = t.get(n2);
  if (r2) {
    for (let t2 of e) document.removeEventListener(t2, r2, true);
    t.delete(n2);
  }
}
function i(e2, t2) {
  let n2 = e2.wrapper.getBoundingClientRect();
  return { width: n2.width + t2, height: n2.height + t2, realWidth: n2.width, realHeight: n2.height };
}
function a(e2, t2) {
  let { elementDimensions: n2, popoverDimensions: r2, popoverPadding: i2, popoverArrowDimensions: a2 } = t2;
  return e2 === `start` ? Math.max(Math.min(n2.top - i2, window.innerHeight - r2.realHeight - a2.width), a2.width) : e2 === `end` ? Math.max(Math.min(n2.top - r2?.realHeight + n2.height + i2, window.innerHeight - r2?.realHeight - a2.width), a2.width) : e2 === `center` ? Math.max(Math.min(n2.top + n2.height / 2 - r2?.realHeight / 2, window.innerHeight - r2?.realHeight - a2.width), a2.width) : 0;
}
function o(e2, t2) {
  let { elementDimensions: n2, popoverDimensions: r2, popoverPadding: i2, popoverArrowDimensions: a2 } = t2;
  return e2 === `start` ? Math.max(Math.min(n2.left - i2, window.innerWidth - r2.realWidth - a2.width), a2.width) : e2 === `end` ? Math.max(Math.min(n2.left - r2?.realWidth + n2.width + i2, window.innerWidth - r2?.realWidth - a2.width), a2.width) : e2 === `center` ? Math.max(Math.min(n2.left + n2.width / 2 - r2?.realWidth / 2, window.innerWidth - r2?.realWidth - a2.width), a2.width) : 0;
}
function s(e2, t2, n2) {
  let { align: r2, side: s2 } = n2, c2 = n2.centered ? `over` : s2, l2 = n2.padding, u2 = i(e2, n2.offset), f2 = e2.arrow.getBoundingClientRect(), p2 = t2.getBoundingClientRect(), m2 = p2.top - u2.height, h2 = m2 >= 0, g2 = window.innerHeight - (p2.bottom + u2.height), _2 = g2 >= 0, v2 = p2.left - u2.width, y2 = v2 >= 0, b2 = window.innerWidth - (p2.right + u2.width), x2 = b2 >= 0, S2 = !h2 && !_2 && !y2 && !x2, C2 = c2;
  if (c2 === `top` && h2 ? x2 = y2 = _2 = false : c2 === `bottom` && _2 ? x2 = y2 = h2 = false : c2 === `left` && y2 ? x2 = h2 = _2 = false : c2 === `right` && x2 && (y2 = h2 = _2 = false), c2 === `over`) {
    let t3 = window.innerWidth / 2 - u2.realWidth / 2, n3 = window.innerHeight / 2 - u2.realHeight / 2;
    e2.wrapper.style.left = `${t3}px`, e2.wrapper.style.right = `auto`, e2.wrapper.style.top = `${n3}px`, e2.wrapper.style.bottom = `auto`;
  } else if (S2) {
    let t3 = window.innerWidth / 2 - u2?.realWidth / 2;
    e2.wrapper.style.left = `${t3}px`, e2.wrapper.style.right = `auto`, e2.wrapper.style.bottom = `10px`, e2.wrapper.style.top = `auto`;
  } else if (y2) {
    let t3 = Math.min(v2, window.innerWidth - u2?.realWidth - f2.width), n3 = a(r2, { elementDimensions: p2, popoverDimensions: u2, popoverPadding: l2, popoverArrowDimensions: f2 });
    e2.wrapper.style.left = `${t3}px`, e2.wrapper.style.top = `${n3}px`, e2.wrapper.style.bottom = `auto`, e2.wrapper.style.right = `auto`, C2 = `left`;
  } else if (x2) {
    let t3 = Math.min(b2, window.innerWidth - u2?.realWidth - f2.width), n3 = a(r2, { elementDimensions: p2, popoverDimensions: u2, popoverPadding: l2, popoverArrowDimensions: f2 });
    e2.wrapper.style.right = `${t3}px`, e2.wrapper.style.top = `${n3}px`, e2.wrapper.style.bottom = `auto`, e2.wrapper.style.left = `auto`, C2 = `right`;
  } else if (h2) {
    let t3 = Math.min(m2, window.innerHeight - u2.realHeight - f2.width), n3 = o(r2, { elementDimensions: p2, popoverDimensions: u2, popoverPadding: l2, popoverArrowDimensions: f2 });
    e2.wrapper.style.top = `${t3}px`, e2.wrapper.style.left = `${n3}px`, e2.wrapper.style.bottom = `auto`, e2.wrapper.style.right = `auto`, C2 = `top`;
  } else if (_2) {
    let t3 = Math.min(g2, window.innerHeight - u2?.realHeight - f2.width), n3 = o(r2, { elementDimensions: p2, popoverDimensions: u2, popoverPadding: l2, popoverArrowDimensions: f2 });
    e2.wrapper.style.left = `${n3}px`, e2.wrapper.style.bottom = `${t3}px`, e2.wrapper.style.top = `auto`, e2.wrapper.style.right = `auto`, C2 = `bottom`;
  }
  d(e2, S2 ? `over` : C2, r2, t2), [...e2.wrapper.classList].filter((e3) => e3.startsWith(`driver-popover-side-`) || e3.startsWith(`driver-popover-align-`)).forEach((t3) => e2.wrapper.classList.remove(t3)), e2.wrapper.classList.add(`driver-popover-side-${C2}`), e2.wrapper.classList.add(`driver-popover-align-${r2}`);
}
function c(e2, t2, n2, r2, i2, a2 = 10) {
  let o2 = r2 - n2;
  return e2 <= n2 && t2 >= r2 ? i2 === `start` ? 15 + a2 / 2 : i2 === `end` ? o2 - 15 - a2 / 2 : o2 / 2 : (Math.min(Math.max(e2, n2), r2) + Math.min(Math.max(t2, n2), r2)) / 2 - n2;
}
function l(e2, t2, n2 = 10) {
  let r2 = t2 - 15 - n2;
  if (r2 < 15) return Math.max(0, (t2 - n2) / 2);
  let i2 = e2 - n2 / 2;
  return Math.min(Math.max(i2, 15), r2);
}
function u(e2, t2, n2) {
  return e2 === `left` || e2 === `right` ? t2.bottom > n2.top && t2.top < n2.bottom ? e2 : t2.bottom <= n2.top ? `bottom` : `top` : t2.right > n2.left && t2.left < n2.right ? e2 : t2.right <= n2.left ? `right` : `left`;
}
function d(e2, t2, n2, r2) {
  let i2 = e2.arrow;
  if (i2.className = `driver-popover-arrow`, i2.style.top = ``, i2.style.right = ``, i2.style.bottom = ``, i2.style.left = ``, t2 === `over`) {
    i2.classList.add(`driver-popover-arrow-none`);
    return;
  }
  let a2 = r2.getBoundingClientRect(), o2 = e2.wrapper.getBoundingClientRect(), s2 = u(t2, a2, o2);
  i2.classList.add(`driver-popover-arrow-side-${s2}`);
  let d2 = i2.getBoundingClientRect().width || 10;
  if (s2 === `left` || s2 === `right`) {
    let e3 = c(a2.top, a2.bottom, o2.top, o2.bottom, n2, d2);
    i2.style.top = `${l(e3, o2.height, d2)}px`;
  } else {
    let e3 = c(a2.left, a2.right, o2.left, o2.right, n2, d2);
    i2.style.left = `${l(e3, o2.width, d2)}px`;
  }
}
function f(e2) {
  return typeof e2 == `function` ? e2() : typeof e2 == `string` ? document.querySelector(e2) : e2;
}
function p(e2) {
  let t2 = window.getComputedStyle(e2);
  return [t2.overflow, t2.overflowX, t2.overflowY].some((e3) => e3 === `auto` || e3 === `scroll`);
}
function m(e2, t2, n2, r2) {
  return (e2 /= r2 / 2) < 1 ? n2 / 2 * e2 * e2 + t2 : -n2 / 2 * (--e2 * (e2 - 2) - 1) + t2;
}
function h(e2) {
  let t2 = `a[href]:not([disabled]), button:not([disabled]), textarea:not([disabled]), input[type="text"]:not([disabled]), input[type="radio"]:not([disabled]), input[type="checkbox"]:not([disabled]), select:not([disabled])`;
  return e2.flatMap((e3) => {
    let n2 = e3.matches(t2), r2 = Array.from(e3.querySelectorAll(t2));
    return [...n2 ? [e3] : [], ...r2];
  }).filter((e3) => getComputedStyle(e3).pointerEvents !== `none` && y(e3));
}
function g(e2, t2) {
  if (!e2 || v(e2)) return;
  let n2 = e2.offsetHeight > window.innerHeight;
  e2.scrollIntoView({ behavior: !t2 || _(e2) ? `auto` : `smooth`, inline: `center`, block: n2 ? `start` : `center` });
}
function _(e2) {
  if (!e2 || !e2.parentElement) return;
  let t2 = e2.parentElement;
  return t2.scrollHeight > t2.clientHeight;
}
function v(e2) {
  let t2 = e2.getBoundingClientRect();
  return t2.top >= 0 && t2.left >= 0 && t2.bottom <= (window.innerHeight || document.documentElement.clientHeight) && t2.right <= (window.innerWidth || document.documentElement.clientWidth);
}
function y(e2) {
  return !!(e2.offsetWidth || e2.offsetHeight || e2.getClientRects().length);
}
function b(e2) {
  e2 && (e2.wrapper.style.display = `none`);
}
function x(e2, t2) {
  let r2 = C();
  document.body.appendChild(r2.wrapper);
  let { title: i2, description: a2, showButtons: o2, disableButtons: c2, showProgress: l2, nextBtnText: u2, prevBtnText: d2, progressText: f2 } = t2;
  r2.nextButton.innerHTML = u2, r2.previousButton.innerHTML = d2, r2.progress.innerHTML = f2, t2.doneButton && r2.nextButton.classList.add(`driver-popover-done-btn`), i2 ? (r2.title.innerHTML = i2, r2.title.style.display = `block`) : r2.title.style.display = `none`, a2 ? (r2.description.innerHTML = a2, r2.description.style.display = `block`) : r2.description.style.display = `none`;
  let p2 = o2.includes(`next`) || o2.includes(`previous`) || l2;
  r2.closeButton.style.display = o2.includes(`close`) ? `block` : `none`, p2 ? (r2.footer.style.display = `flex`, r2.progress.style.display = l2 ? `block` : `none`, r2.nextButton.style.display = o2.includes(`next`) ? `block` : `none`, r2.previousButton.style.display = o2.includes(`previous`) ? `block` : `none`) : r2.footer.style.display = `none`, c2.includes(`next`) && (r2.nextButton.disabled = true, r2.nextButton.classList.add(`driver-popover-btn-disabled`)), c2.includes(`previous`) && (r2.previousButton.disabled = true, r2.previousButton.classList.add(`driver-popover-btn-disabled`)), c2.includes(`close`) && (r2.closeButton.disabled = true, r2.closeButton.classList.add(`driver-popover-btn-disabled`));
  let m2 = r2.wrapper;
  m2.style.display = `block`, m2.style.left = ``, m2.style.top = ``, m2.style.bottom = ``, m2.style.right = ``, m2.id = `driver-popover-content`, m2.setAttribute(`role`, `dialog`), m2.setAttribute(`aria-labelledby`, `driver-popover-title`), m2.setAttribute(`aria-describedby`, `driver-popover-description`);
  let _2 = r2.arrow;
  _2.className = `driver-popover-arrow`, m2.className = `driver-popover ${t2.popoverClass || ``}`.trim(), n(r2.wrapper, (e3) => {
    let n2 = e3.target;
    if (n2.closest(`.driver-popover-next-btn`)) return t2.onNextClick?.();
    if (n2.closest(`.driver-popover-prev-btn`)) return t2.onPrevClick?.();
    if (n2.closest(`.driver-popover-close-btn`)) return t2.onCloseClick?.();
  }, (e3) => r2.description.contains(e3) || r2.title.contains(e3) ? false : !!e3.closest(`.driver-popover-prev-btn, .driver-popover-next-btn, .driver-popover-close-btn`)), t2.onRender?.(r2), s(r2, e2, t2.position), S(r2, e2, t2.position), g(m2, t2.smoothScroll);
  let v2 = h([m2, e2]);
  return v2.length > 0 && v2[0].focus(), r2;
}
function S(e2, t2, n2) {
  e2.wrapper.querySelectorAll(`img`).forEach((r2) => {
    if (r2.complete) return;
    let i2 = () => s(e2, t2, n2);
    r2.addEventListener(`load`, i2, { once: true }), r2.addEventListener(`error`, i2, { once: true });
  });
}
function C() {
  let e2 = document.createElement(`div`);
  e2.classList.add(`driver-popover`);
  let t2 = document.createElement(`div`);
  t2.classList.add(`driver-popover-arrow`);
  let n2 = document.createElement(`header`);
  n2.id = `driver-popover-title`, n2.classList.add(`driver-popover-title`), n2.style.display = `none`, n2.innerText = `Popover Title`;
  let r2 = document.createElement(`div`);
  r2.id = `driver-popover-description`, r2.classList.add(`driver-popover-description`), r2.style.display = `none`, r2.innerText = `Popover description is here`;
  let i2 = document.createElement(`button`);
  i2.type = `button`, i2.classList.add(`driver-popover-close-btn`), i2.setAttribute(`aria-label`, `Close`), i2.innerHTML = `&times;`;
  let a2 = document.createElement(`footer`);
  a2.classList.add(`driver-popover-footer`);
  let o2 = document.createElement(`span`);
  o2.classList.add(`driver-popover-progress-text`), o2.innerText = ``;
  let s2 = document.createElement(`span`);
  s2.classList.add(`driver-popover-navigation-btns`);
  let c2 = document.createElement(`button`);
  c2.type = `button`, c2.classList.add(`driver-popover-prev-btn`, `driver-popover-footer-btn`), c2.innerHTML = `Previous`;
  let l2 = document.createElement(`button`);
  return l2.type = `button`, l2.classList.add(`driver-popover-next-btn`, `driver-popover-footer-btn`), l2.innerHTML = `Next`, s2.appendChild(c2), s2.appendChild(l2), a2.appendChild(o2), a2.appendChild(s2), e2.appendChild(i2), e2.appendChild(t2), e2.appendChild(n2), e2.appendChild(r2), e2.appendChild(a2), { wrapper: e2, arrow: t2, title: n2, description: r2, footer: a2, previousButton: c2, nextButton: l2, closeButton: i2, footerButtons: s2, progress: o2 };
}
function w(e2) {
  e2 && (r(e2.wrapper), e2.wrapper.parentElement?.removeChild(e2.wrapper));
}
function T(e2, t2) {
  let n2 = window.innerWidth, r2 = window.innerHeight, i2 = t2.padding, a2 = t2.radius, o2 = e2.width + i2 * 2, s2 = e2.height + i2 * 2, c2 = Math.min(a2, o2 / 2, s2 / 2), l2 = Math.floor(Math.max(c2, 0)), u2 = e2.x - i2 + l2, d2 = e2.y - i2, f2 = o2 - l2 * 2, p2 = s2 - l2 * 2;
  return `M${n2},0L0,0L0,${r2}L${n2},${r2}L${n2},0Z
    M${u2},${d2} h${f2} a${l2},${l2} 0 0 1 ${l2},${l2} v${p2} a${l2},${l2} 0 0 1 -${l2},${l2} h-${f2} a${l2},${l2} 0 0 1 -${l2},-${l2} v-${p2} a${l2},${l2} 0 0 1 ${l2},-${l2} z`;
}
function E(e2, t2, n2, r2, i2) {
  let a2 = e2.getState(`__activeStagePosition`), o2 = a2 || r2.getBoundingClientRect(), s2 = i2.getBoundingClientRect();
  a2 = { x: m(t2, o2.x, s2.x - o2.x, n2), y: m(t2, o2.y, s2.y - o2.y, n2), width: m(t2, o2.width, s2.width - o2.width, n2), height: m(t2, o2.height, s2.height - o2.height, n2) }, A(e2, a2), e2.setState(`__activeStagePosition`, a2);
}
function D(e2, t2) {
  if (!t2) return;
  let n2 = t2.getBoundingClientRect(), r2 = { x: n2.x, y: n2.y, width: n2.width, height: n2.height };
  e2.setState(`__activeStagePosition`, r2), A(e2, r2);
}
function O(e2) {
  let t2 = e2.getState(`__activeStagePosition`), n2 = e2.getState(`__overlaySvg`);
  if (!t2) return;
  if (!n2) {
    console.warn(`No stage svg found.`);
    return;
  }
  let r2 = window.innerWidth, i2 = window.innerHeight;
  n2.setAttribute(`viewBox`, `0 0 ${r2} ${i2}`);
}
function k(e2, t2) {
  let r2 = M(e2, t2);
  document.body.appendChild(r2), n(r2, (t3) => {
    t3.target.tagName === `path` && e2.emit(`overlayClick`);
  }), e2.setState(`__overlaySvg`, r2);
}
function A(e2, t2) {
  let n2 = e2.getState(`__overlaySvg`);
  if (!n2) {
    k(e2, t2);
    return;
  }
  let r2 = n2.firstElementChild;
  if (r2?.tagName !== `path`) throw Error(`no path element found in stage svg`);
  r2.setAttribute(`d`, T(t2, j(e2)));
}
function j(e2) {
  return { padding: e2.getConfig(`stagePadding`) || 0, radius: e2.getConfig(`stageRadius`) || 0 };
}
function M(e2, t2) {
  let n2 = window.innerWidth, r2 = window.innerHeight, i2 = document.createElementNS(`http://www.w3.org/2000/svg`, `svg`);
  i2.classList.add(`driver-overlay`, `driver-overlay-animated`), i2.setAttribute(`viewBox`, `0 0 ${n2} ${r2}`), i2.setAttribute(`xmlSpace`, `preserve`), i2.setAttribute(`xmlnsXlink`, `http://www.w3.org/1999/xlink`), i2.setAttribute(`version`, `1.1`), i2.setAttribute(`preserveAspectRatio`, `xMinYMin slice`), i2.style.fillRule = `evenodd`, i2.style.clipRule = `evenodd`, i2.style.strokeLinejoin = `round`, i2.style.strokeMiterlimit = `2`, i2.style.zIndex = `10000`, i2.style.position = `fixed`, i2.style.top = `0`, i2.style.left = `0`, i2.style.width = `100%`, i2.style.height = `100%`;
  let a2 = document.createElementNS(`http://www.w3.org/2000/svg`, `path`);
  return a2.setAttribute(`d`, T(t2, j(e2))), a2.style.fill = e2.getConfig(`overlayColor`) || `rgb(0,0,0)`, a2.style.opacity = `${e2.getConfig(`overlayOpacity`)}`, a2.style.pointerEvents = `auto`, a2.style.cursor = `auto`, i2.appendChild(a2), i2;
}
function N(e2) {
  let t2 = e2.getState(`__overlaySvg`);
  t2 && (r(t2), t2.remove());
}
var P = `{{current}} of {{total}}`;
function F(e2, t2) {
  return !(t2.skipMissingElement ?? e2.getConfig(`skipMissingElement`)) || !t2.element ? false : !f(t2.element);
}
function I(e2, t2, n2) {
  let r2 = e2.getConfig(`steps`) || [];
  for (let i2 = t2; i2 >= 0 && i2 < r2.length; i2 += n2) if (!F(e2, r2[i2])) return i2;
}
function L(e2, t2) {
  let n2 = e2.getState(`activeIndex`), r2 = n2 !== void 0 && I(e2, n2 + 1, 1) === void 0, i2 = t2?.popover?.onDoneClick || e2.getConfig(`onDoneClick`);
  return r2 && i2 ? i2 : t2?.popover?.onNextClick || e2.getConfig(`onNextClick`);
}
function R(e2, t2) {
  return t2?.popover?.onPrevClick || e2.getConfig(`onPrevClick`);
}
function z(e2, t2) {
  return t2?.popover?.onCloseClick || e2.getConfig(`onCloseClick`);
}
function B(e2, t2, n2) {
  let r2 = e2.getConfig(`steps`) || [], i2 = r2[t2], a2 = i2.popover || {}, o2 = I(e2, t2 + 1, 1) !== void 0, s2 = I(e2, t2 - 1, -1) !== void 0, c2 = a2.doneBtnText || e2.getConfig(`doneBtnText`) || `Done`, l2 = e2.getConfig(`allowClose`), u2 = a2.showProgress === void 0 ? e2.getConfig(`showProgress`) : a2.showProgress, d2 = (a2.progressText || e2.getConfig(`progressText`) || P).replace(`{{current}}`, `${t2 + 1}`).replace(`{{total}}`, `${r2.length}`), f2 = a2.showButtons || e2.getConfig(`showButtons`), p2 = [`next`, `previous`, ...l2 ? [`close`] : []].filter((e3) => !f2?.length || f2.includes(e3)), m2 = a2.onNextClick || e2.getConfig(`onNextClick`), h2 = a2.onPrevClick || e2.getConfig(`onPrevClick`), g2 = a2.onCloseClick || e2.getConfig(`onCloseClick`);
  return { ...i2, popover: { showButtons: p2, nextBtnText: o2 ? void 0 : c2, disableButtons: [...s2 ? [] : [`previous`]], showProgress: u2, onNextClick: m2 || n2.onNextClick, onPrevClick: h2 || n2.onPrevClick, onCloseClick: g2 || n2.onCloseClick, ...a2, progressText: d2 } };
}
function V(e2, t2, n2) {
  let r2 = e2.getConfig(`stagePadding`) || 0;
  return { side: n2.popover?.side || `bottom`, align: n2.popover?.align || `start`, offset: r2 + (e2.getConfig(`popoverOffset`) || 0), padding: r2, centered: t2.id === `driver-dummy-element` };
}
function H(e2, t2, n2) {
  let r2 = n2.popover || {}, i2 = e2.getState(`activeIndex`), a2 = i2 !== void 0 && I(e2, i2 + 1, 1) === void 0;
  return { title: r2.title, description: r2.description, showButtons: r2.showButtons || e2.getConfig(`showButtons`), disableButtons: r2.disableButtons || e2.getConfig(`disableButtons`) || [], showProgress: r2.showProgress || e2.getConfig(`showProgress`) || false, progressText: r2.progressText ?? (e2.getConfig(`progressText`) || P), nextBtnText: r2.nextBtnText ?? (e2.getConfig(`nextBtnText`) || `Next`), prevBtnText: r2.prevBtnText ?? (e2.getConfig(`prevBtnText`) || `Previous`), doneButton: a2, popoverClass: r2.popoverClass || e2.getConfig(`popoverClass`) || ``, smoothScroll: e2.getConfig(`smoothScroll`), onNextClick: () => {
    let r3 = L(e2, n2);
    return r3 ? r3(t2, n2, e2.getHookOpts()) : e2.emit(`nextClick`);
  }, onPrevClick: () => {
    let r3 = R(e2, n2);
    return r3 ? r3(t2, n2, e2.getHookOpts()) : e2.emit(`prevClick`);
  }, onCloseClick: () => {
    let r3 = z(e2, n2);
    return r3 ? r3(t2, n2, e2.getHookOpts()) : e2.emit(`closeClick`);
  }, onRender: (t3) => {
    e2.setState(`popover`, t3), (r2.onPopoverRender || e2.getConfig(`onPopoverRender`))?.(t3, e2.getHookOpts());
  }, position: V(e2, t2, n2) };
}
function U(e2, t2, n2) {
  w(e2.getState(`popover`)), x(t2, H(e2, t2, n2));
}
function W(e2, t2, n2) {
  let r2 = e2.getState(`popover`);
  r2 && s(r2, t2, V(e2, t2, n2));
}
function G() {
  let e2 = document.getElementById(`driver-dummy-element`);
  if (e2) return e2;
  let t2 = document.createElement(`div`);
  return t2.id = `driver-dummy-element`, t2.style.width = `0`, t2.style.height = `0`, t2.style.pointerEvents = `none`, t2.style.opacity = `0`, t2.style.position = `fixed`, t2.style.top = `50%`, t2.style.left = `50%`, document.body.appendChild(t2), t2;
}
function K(e2, t2) {
  let n2 = f(t2.element);
  n2 || (n2 = G()), J(e2, n2, t2);
}
function q(e2) {
  let t2 = e2.getState(`__activeElement`), n2 = e2.getState(`__activeStep`);
  t2 && (D(e2, t2), O(e2), W(e2, t2, n2));
}
function J(e2, t2, n2) {
  let r2 = e2.getConfig(`duration`) || 400, i2 = Date.now(), a2 = e2.getState(`__activeStep`), o2 = e2.getState(`__activeElement`) || t2, s2 = !o2 || o2 === t2, c2 = t2.id === `driver-dummy-element`, l2 = o2.id === `driver-dummy-element`, u2 = e2.getConfig(`animate`), d2 = n2.onHighlightStarted || e2.getConfig(`onHighlightStarted`), f2 = n2?.onHighlighted || e2.getConfig(`onHighlighted`), m2 = a2?.onDeselected || e2.getConfig(`onDeselected`), h2 = e2.getHookOpts();
  !s2 && m2 && m2(l2 ? void 0 : o2, a2, h2), d2 && d2(c2 ? void 0 : t2, n2, h2);
  let _2 = !s2 && u2, v2 = false;
  b(e2.getState(`popover`)), e2.setState(`previousStep`, a2), e2.setState(`previousElement`, o2), e2.setState(`activeStep`, n2), e2.setState(`activeElement`, t2);
  let y2 = () => {
    if (e2.getState(`__transitionCallback`) !== y2) return;
    let s3 = Date.now() - i2, l3 = r2 - s3 <= r2 / 2;
    n2.popover && l3 && !v2 && _2 && (U(e2, t2, n2), v2 = true), e2.getConfig(`animate`) && s3 < r2 ? E(e2, s3, r2, o2, t2) : (D(e2, t2), f2 && f2(c2 ? void 0 : t2, n2, e2.getHookOpts()), e2.setState(`__transitionCallback`, void 0), e2.setState(`__previousStep`, a2), e2.setState(`__previousElement`, o2), e2.setState(`__activeStep`, n2), e2.setState(`__activeElement`, t2)), window.requestAnimationFrame(y2);
  };
  e2.setState(`__transitionCallback`, y2), window.requestAnimationFrame(y2), g(t2, e2.getConfig(`smoothScroll`)), !_2 && n2.popover && U(e2, t2, n2), document.querySelectorAll(`.driver-active-element-parent`).forEach((e3) => {
    e3.classList.remove(`driver-active-element-parent`, `driver-active-element-parent-no-scroll`);
  }), o2.classList.remove(`driver-active-element`, `driver-no-interaction`), o2.removeAttribute(`aria-haspopup`), o2.removeAttribute(`aria-expanded`), o2.removeAttribute(`aria-controls`), (n2.disableActiveInteraction ?? e2.getConfig(`disableActiveInteraction`)) && t2.classList.add(`driver-no-interaction`);
  let x2 = t2.parentElement;
  x2 && x2 !== document.body && (x2.classList.add(`driver-active-element-parent`), p(x2) && x2.classList.add(`driver-active-element-parent-no-scroll`)), t2.classList.add(`driver-active-element`), t2.setAttribute(`aria-haspopup`, `dialog`), t2.setAttribute(`aria-expanded`, `true`), t2.setAttribute(`aria-controls`, `driver-popover-content`);
}
function Y() {
  document.getElementById(`driver-dummy-element`)?.remove(), document.querySelectorAll(`.driver-active-element`).forEach((e2) => {
    let t2 = e2.parentElement;
    t2 && t2 !== document.body && t2.classList.remove(`driver-active-element-parent`, `driver-active-element-parent-no-scroll`), e2.classList.remove(`driver-active-element`, `driver-no-interaction`), e2.removeAttribute(`aria-haspopup`), e2.removeAttribute(`aria-expanded`), e2.removeAttribute(`aria-controls`);
  });
}
function X(e2) {
  let t2 = e2.getState(`__resizeTimeout`);
  t2 && window.cancelAnimationFrame(t2), e2.setState(`__resizeTimeout`, window.requestAnimationFrame(() => q(e2)));
}
function Z(e2, t2) {
  if (!e2.getState(`isInitialized`) || !(t2.key === `Tab` || t2.keyCode === 9)) return;
  let n2 = e2.getState(`__activeElement`), r2 = e2.getState(`popover`)?.wrapper, i2 = h([...r2 ? [r2] : [], ...n2 ? [n2] : []]), a2 = i2[0], o2 = i2[i2.length - 1];
  t2.preventDefault(), t2.shiftKey ? (i2[i2.indexOf(document.activeElement) - 1] || o2)?.focus() : (i2[i2.indexOf(document.activeElement) + 1] || a2)?.focus();
}
function Q(e2, t2) {
  (e2.getConfig(`allowKeyboardControl`) ?? true) && (t2.key === `Escape` ? e2.emit(`escapePress`) : t2.key === `ArrowRight` ? e2.emit(`arrowRightPress`) : t2.key === `ArrowLeft` && e2.emit(`arrowLeftPress`));
}
function $(e2, t2) {
  let n2 = e2.getState(`__activeElement`), r2 = t2.target;
  !n2 || !r2 || !n2.contains(r2) || e2.emit(`activeElementClick`);
}
function ee(e2) {
  let t2 = (t3) => Q(e2, t3), n2 = (t3) => Z(e2, t3), r2 = () => X(e2), i2 = () => X(e2), a2 = (t3) => $(e2, t3);
  e2.setState(`__events`, { onKeyup: t2, onKeydown: n2, onResize: r2, onScroll: i2, onClick: a2 }), window.addEventListener(`keyup`, t2, false), window.addEventListener(`keydown`, n2, false), window.addEventListener(`resize`, r2), window.addEventListener(`scroll`, i2), document.addEventListener(`click`, a2, false);
}
function te(e2) {
  let t2 = e2.getState(`__events`);
  t2 && (window.removeEventListener(`keyup`, t2.onKeyup), window.removeEventListener(`keydown`, t2.onKeydown), window.removeEventListener(`resize`, t2.onResize), window.removeEventListener(`scroll`, t2.onScroll), document.removeEventListener(`click`, t2.onClick, false));
}
function ne() {
  let e2 = {};
  function t2(t3 = {}) {
    e2 = { animate: true, duration: 400, allowClose: true, allowScroll: true, overlayClickBehavior: `close`, overlayOpacity: 0.7, smoothScroll: false, disableActiveInteraction: false, advanceOnClick: false, skipMissingElement: false, waitForElement: 0, showProgress: false, stagePadding: 10, stageRadius: 5, popoverOffset: 10, showButtons: [`next`, `previous`, `close`], disableButtons: [], overlayColor: `#000`, ...t3 };
  }
  return t2(), { getConfig: ((t3) => t3 ? e2[t3] : e2), configure: t2 };
}
function re() {
  let e2 = {}, t2 = ((t3) => t3 ? e2[t3] : e2), n2 = (t3, n3) => {
    e2[t3] = n3;
  };
  function r2() {
    e2 = {};
  }
  return { getState: t2, setState: n2, resetState: r2 };
}
function ie() {
  let e2 = {};
  function t2(t3, n3) {
    e2[t3] = n3;
  }
  function n2(t3) {
    e2[t3]?.();
  }
  function r2() {
    e2 = {};
  }
  return { listen: t2, emit: n2, reset: r2 };
}
function ae(e2 = {}) {
  let t2 = ne();
  t2.configure(e2);
  let n2 = re(), r2 = ie(), i2;
  return { getConfig: t2.getConfig, setConfig: t2.configure, getState: n2.getState, setState: n2.setState, resetState: n2.resetState, listen: r2.listen, emit: r2.emit, resetEmitter: r2.reset, getDriver: () => i2, setDriver: (e3) => {
    i2 = e3;
  }, getHookOpts: (e3) => {
    let r3 = e3 || n2.getState();
    return { config: t2.getConfig(), state: r3, driver: i2, index: r3.activeIndex };
  } };
}
function oe(e2 = {}) {
  let t2 = ae(e2);
  function n2() {
    t2.getConfig(`allowClose`) && h2();
  }
  function r2() {
    let e3 = t2.getConfig(`overlayClickBehavior`);
    if (t2.getConfig(`allowClose`) && e3 === `close`) {
      h2();
      return;
    }
    if (typeof e3 == `function`) {
      let n3 = t2.getState(`__activeStep`);
      e3(t2.getState(`__activeElement`), n3, t2.getHookOpts());
      return;
    }
    if (e3 === `nextStep`) {
      let e4 = t2.getState(`activeStep`), n3 = t2.getState(`activeElement`), r3 = L(t2, e4);
      if (r3) {
        r3(n3, e4, t2.getHookOpts());
        return;
      }
      i2();
    }
  }
  function i2() {
    let e3 = t2.getState(`activeIndex`), n3 = t2.getConfig(`steps`) || [];
    if (e3 === void 0) return;
    let r3 = e3 + 1;
    n3[r3] ? m2(r3) : h2();
  }
  function a2() {
    let e3 = t2.getState(`activeIndex`), n3 = t2.getConfig(`steps`) || [];
    if (e3 === void 0) return;
    let r3 = e3 - 1;
    n3[r3] ? m2(r3) : h2();
  }
  function o2(e3) {
    (t2.getConfig(`steps`) || [])[e3] ? m2(e3) : h2();
  }
  function s2() {
    if (t2.getState(`__transitionCallback`)) return;
    let e3 = t2.getState(`__activeStep`);
    if (!e3 || !(e3.advanceOnClick ?? t2.getConfig(`advanceOnClick`))) return;
    let n3 = t2.getState(`__activeElement`), r3 = L(t2, e3);
    if (r3) {
      r3(n3, e3, t2.getHookOpts());
      return;
    }
    i2();
  }
  function c2() {
    if (t2.getState(`__transitionCallback`)) return;
    let e3 = t2.getState(`activeIndex`), n3 = t2.getState(`__activeStep`), r3 = t2.getState(`__activeElement`);
    if (e3 === void 0 || n3 === void 0 || !(t2.getConfig(`steps`) || [])[e3 - 1]) return;
    let i3 = R(t2, n3);
    if (i3) return i3(r3, n3, t2.getHookOpts());
    a2();
  }
  function l2() {
    if (t2.getState(`__transitionCallback`)) return;
    let e3 = t2.getState(`activeIndex`), n3 = t2.getState(`__activeStep`), r3 = t2.getState(`__activeElement`);
    if (e3 === void 0 || n3 === void 0) return;
    let a3 = L(t2, n3);
    if (a3) return a3(r3, n3, t2.getHookOpts());
    i2();
  }
  function u2() {
    t2.getState(`isInitialized`) || (t2.setState(`isInitialized`, true), document.body.classList.add(`driver-active`, t2.getConfig(`animate`) ? `driver-fade` : `driver-simple`), t2.getConfig(`allowScroll`) || document.body.classList.add(`driver-no-scroll`), document.body.style.setProperty(`--driver-animation-duration`, `${t2.getConfig(`duration`) || 400}ms`), ee(t2), t2.listen(`overlayClick`, r2), t2.listen(`activeElementClick`, s2), t2.listen(`escapePress`, n2), t2.listen(`closeClick`, n2), t2.listen(`arrowLeftPress`, c2), t2.listen(`arrowRightPress`, l2));
  }
  function d2() {
    let e3 = t2.getState(`__pendingWaitCancel`);
    e3 && (t2.setState(`__pendingWaitCancel`, void 0), e3());
  }
  function p2(e3, n3, r3) {
    let i3 = () => {
      a3.disconnect(), window.clearTimeout(o3), t2.setState(`__pendingWaitCancel`, void 0), r3();
    }, a3 = new MutationObserver(() => {
      f(e3.element) && i3();
    }), o3 = window.setTimeout(i3, n3);
    t2.setState(`__pendingWaitCancel`, () => {
      a3.disconnect(), window.clearTimeout(o3);
    }), a3.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
  }
  function m2(e3 = 0, n3 = false) {
    d2();
    let r3 = t2.getConfig(`steps`);
    if (!r3) {
      console.error(`No steps to drive through`), h2();
      return;
    }
    if (!r3[e3]) {
      h2();
      return;
    }
    let i3 = r3[e3], a3 = i3.waitForElement ?? t2.getConfig(`waitForElement`) ?? 0;
    if (!n3 && a3 > 0 && i3.element && !f(i3.element)) {
      p2(i3, a3, () => m2(e3, true));
      return;
    }
    if (F(t2, i3)) {
      let n4 = t2.getState(`activeIndex`), i4 = typeof n4 == `number` && e3 < n4 ? -1 : 1;
      r3[e3 + i4] ? m2(e3 + i4) : i4 === 1 && h2();
      return;
    }
    t2.setState(`__activeOnDestroyed`, document.activeElement), t2.setState(`activeIndex`, e3);
    let o3 = r3[e3 + 1];
    K(t2, B(t2, e3, { onNextClick: () => {
      o3 ? m2(e3 + 1) : h2();
    }, onPrevClick: () => {
      m2(e3 - 1);
    }, onCloseClick: () => {
      h2();
    } }));
  }
  function h2(e3 = true) {
    let n3 = t2.getState(`__activeElement`), r3 = t2.getState(`__activeStep`), i3 = t2.getState(`__activeOnDestroyed`), a3 = t2.getConfig(`onDestroyStarted`);
    if (e3 && a3) {
      a3(!n3 || n3?.id === `driver-dummy-element` ? void 0 : n3, r3, t2.getHookOpts());
      return;
    }
    let o3 = r3?.onDeselected || t2.getConfig(`onDeselected`), s3 = t2.getConfig(`onDestroyed`);
    document.body.classList.remove(`driver-active`, `driver-fade`, `driver-simple`, `driver-no-scroll`), document.body.style.removeProperty(`--driver-animation-duration`), d2(), te(t2), w(t2.getState(`popover`)), Y(), N(t2), t2.resetEmitter();
    let c3 = t2.getState();
    if (t2.resetState(), n3 && r3) {
      let e4 = n3.id === `driver-dummy-element`;
      o3 && o3(e4 ? void 0 : n3, r3, t2.getHookOpts(c3)), s3 && s3(e4 ? void 0 : n3, r3, t2.getHookOpts(c3));
    }
    i3 && i3.focus();
  }
  let g2 = { isActive: () => t2.getState(`isInitialized`) || false, refresh: () => X(t2), drive: (e3 = 0) => {
    u2(), m2(e3);
  }, setConfig: t2.setConfig, setSteps: (e3) => {
    d2(), t2.resetState(), t2.setConfig({ ...t2.getConfig(), steps: e3 });
  }, getConfig: t2.getConfig, getState: t2.getState, getActiveIndex: () => t2.getState(`activeIndex`), isFirstStep: () => {
    let e3 = t2.getState(`activeIndex`);
    return e3 !== void 0 && I(t2, e3 - 1, -1) === void 0;
  }, isLastStep: () => {
    let e3 = t2.getState(`activeIndex`);
    return e3 !== void 0 && I(t2, e3 + 1, 1) === void 0;
  }, getActiveStep: () => t2.getState(`activeStep`), getActiveElement: () => t2.getState(`activeElement`), getPreviousElement: () => t2.getState(`previousElement`), getPreviousStep: () => t2.getState(`previousStep`), getNextStep: () => {
    let e3 = t2.getConfig(`steps`) || [], n3 = t2.getState(`activeIndex`);
    if (n3 === void 0) return;
    let r3 = I(t2, n3 + 1, 1);
    return r3 === void 0 ? void 0 : e3[r3];
  }, moveNext: i2, movePrevious: a2, moveTo: o2, hasNextStep: () => {
    let e3 = t2.getState(`activeIndex`);
    return e3 !== void 0 && I(t2, e3 + 1, 1) !== void 0;
  }, hasPreviousStep: () => {
    let e3 = t2.getState(`activeIndex`);
    return e3 !== void 0 && I(t2, e3 - 1, -1) !== void 0;
  }, highlight: (e3) => {
    u2(), K(t2, { ...e3, popover: e3.popover ? { showButtons: [], showProgress: false, progressText: ``, ...e3.popover } : void 0 });
  }, destroy: () => {
    h2(false);
  } };
  return t2.setDriver(g2), g2;
}

// auth.js
var ITERATIONS = 1e5;
var HASH = "SHA-256";
var KEY_BITS = 256;
var enc = new TextEncoder();
var toHex = (buf) => [...new Uint8Array(buf)].map((b2) => b2.toString(16).padStart(2, "0")).join("");
var fromHex = (hex) => new Uint8Array(hex.match(/.{1,2}/g).map((b2) => parseInt(b2, 16)));
async function derive(pin, salt, iterations = ITERATIONS) {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(String(pin)),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: HASH },
    key,
    KEY_BITS
  );
  return toHex(bits);
}
async function createPinRecord(pin) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return {
    salt: toHex(salt),
    hash: await derive(pin, salt),
    iterations: ITERATIONS,
    createdAt: Date.now()
  };
}
async function verifyPin(pin, record) {
  if (!record?.salt || !record?.hash) return false;
  const hash = await derive(pin, fromHex(record.salt), record.iterations || ITERATIONS);
  if (hash.length !== record.hash.length) return false;
  let diff = 0;
  for (let i2 = 0; i2 < hash.length; i2++) diff |= hash.charCodeAt(i2) ^ record.hash.charCodeAt(i2);
  return diff === 0;
}
function validatePinFormat(pin) {
  const s2 = String(pin ?? "");
  if (!/^\d+$/.test(s2)) return "PIN must be digits only.";
  if (s2.length < 4) return "PIN must be at least 4 digits.";
  if (s2.length > 8) return "PIN must be at most 8 digits.";
  return null;
}
function lockoutMs(failedAttempts) {
  if (failedAttempts < 3) return 0;
  return Math.min(2 ** (failedAttempts - 2) * 1e3, 5 * 60 * 1e3);
}
function remainingLockout(state, now = Date.now()) {
  const until = (state?.lastFailedAt || 0) + lockoutMs(state?.failedAttempts || 0);
  return Math.max(0, until - now);
}

// store.js
var DEFAULTS = {
  autoScan: true,
  blockFlagged: true,
  tourDone: false
};
function normalizeDomain(input) {
  let s2 = String(input || "").trim().toLowerCase();
  if (!s2) return null;
  s2 = s2.replace(/^[a-z]+:\/\//, "").split("/")[0].split(":")[0].replace(/^www\./, "").replace(/\.$/, "");
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(s2)) return null;
  return s2;
}
async function getSettings() {
  const got = await chrome.storage.local.get(Object.keys(DEFAULTS));
  return { ...DEFAULTS, ...got };
}
var setSettings = (patch) => chrome.storage.local.set(patch);
async function getAllowList() {
  const { allowList = [] } = await chrome.storage.local.get("allowList");
  return allowList;
}
var setAllowList = (allowList) => chrome.storage.local.set({ allowList });
async function getHistory() {
  const { history = [] } = await chrome.storage.local.get("history");
  return history;
}
var clearHistory = () => chrome.storage.local.set({ history: [] });
async function getPinRecord() {
  const { pinRecord = null } = await chrome.storage.local.get("pinRecord");
  return pinRecord;
}
var setPinRecord = (pinRecord) => chrome.storage.local.set({ pinRecord });
async function getLockState() {
  const { lockState = { failedAttempts: 0, lastFailedAt: 0 } } = await chrome.storage.local.get("lockState");
  return lockState;
}
var setLockState = (lockState) => chrome.storage.local.set({ lockState });

// options.js
var $2 = (id) => document.getElementById(id);
var el = (tag, cls, text) => {
  const n2 = document.createElement(tag);
  if (cls) n2.className = cls;
  if (text != null) n2.textContent = text;
  return n2;
};
var isFirstRun = false;
async function initLock() {
  const record = await getPinRecord();
  isFirstRun = !record;
  if (isFirstRun) {
    $2("lockTitle").textContent = "Create a PIN";
    $2("lockSub").textContent = "Choose 4\u20138 digits. You will need it to change Guardian\u2019s settings.";
    $2("pin2").hidden = false;
    $2("lockBtn").textContent = "Create PIN";
    $2("forgot").hidden = true;
  }
  $2("pin1").focus();
}
async function attemptUnlock() {
  const err = $2("lockError");
  err.textContent = "";
  const pin = $2("pin1").value;
  if (isFirstRun) {
    const bad = validatePinFormat(pin);
    if (bad) return void (err.textContent = bad);
    if (pin !== $2("pin2").value) return void (err.textContent = "The two PINs do not match.");
    await setPinRecord(await createPinRecord(pin));
    return unlock();
  }
  const lock = await getLockState();
  const waitMs = remainingLockout(lock);
  if (waitMs > 0) {
    return void (err.textContent = `Too many attempts. Try again in ${Math.ceil(waitMs / 1e3)}s.`);
  }
  if (await verifyPin(pin, await getPinRecord())) {
    await setLockState({ failedAttempts: 0, lastFailedAt: 0 });
    return unlock();
  }
  const failedAttempts = (lock.failedAttempts || 0) + 1;
  await setLockState({ failedAttempts, lastFailedAt: Date.now() });
  $2("pin1").value = "";
  const next = remainingLockout({ failedAttempts, lastFailedAt: Date.now() });
  err.textContent = next > 0 ? `Incorrect PIN. Locked for ${Math.ceil(next / 1e3)}s.` : "Incorrect PIN.";
}
async function unlock() {
  $2("lock").hidden = true;
  $2("app").hidden = false;
  await render();
  const { tourDone } = await getSettings();
  if (!tourDone) {
    await setSettings({ tourDone: true });
    setTimeout(runTour, 400);
  }
}
async function render() {
  const s2 = await getSettings();
  $2("autoScan").checked = s2.autoScan;
  $2("blockFlagged").checked = s2.blockFlagged;
  await renderAllow();
  await renderHistory();
  renderModelInfo();
}
async function renderModelInfo() {
  try {
    const cfg = await (await fetch(chrome.runtime.getURL("model/vocab.json"))).json();
    $2("modelInfo").textContent = `${cfg.backbone} \xB7 ${cfg.class_names.join(" / ")} \xB7 runs on this device`;
  } catch {
    $2("modelInfo").textContent = "model files missing from model/";
  }
}
async function renderAllow() {
  const list = await getAllowList();
  const ul = $2("allowList");
  ul.replaceChildren();
  if (!list.length) {
    ul.append(el("li", "empty", "No sites allowed yet."));
    return;
  }
  list.forEach((entry, i2) => {
    const li = el("li");
    const box = el("div", "grow");
    box.append(el("div", "mono", entry.domain));
    box.append(el("div", "sub", entry.includeSubdomains ? "including subdomains" : "this domain only"));
    const toggle = el(
      "button",
      "ghost",
      entry.includeSubdomains ? "Subdomains: on" : "Subdomains: off"
    );
    toggle.onclick = async () => {
      const l2 = await getAllowList();
      l2[i2].includeSubdomains = !l2[i2].includeSubdomains;
      await setAllowList(l2);
      renderAllow();
    };
    const del = el("button", "danger", "Remove");
    del.onclick = async () => {
      const l2 = await getAllowList();
      l2.splice(i2, 1);
      await setAllowList(l2);
      renderAllow();
    };
    li.append(box, toggle, del);
    ul.append(li);
  });
}
async function renderHistory() {
  const hist = await getHistory();
  const ul = $2("historyList");
  ul.replaceChildren();
  if (!hist.length) {
    ul.append(el("li", "empty", "Nothing has been blocked yet."));
    return;
  }
  for (const h2 of hist.slice(0, 100)) {
    const li = el("li");
    li.append(el("span", `pill ${h2.label}`, h2.label));
    const box = el("div", "grow");
    box.append(el("div", "mono", h2.host + (h2.path || "")));
    box.append(el(
      "div",
      "sub",
      `${new Date(h2.ts).toLocaleString()} \xB7 ${Math.round(h2.confidence * 100)}% confident`
    ));
    const allow = el("button", "ghost", "Allow site");
    allow.onclick = async () => {
      const d2 = normalizeDomain(h2.host);
      if (!d2) return;
      const l2 = await getAllowList();
      if (!l2.some((e2) => e2.domain === d2)) l2.push({ domain: d2, includeSubdomains: true });
      await setAllowList(l2);
      renderAllow();
      allow.textContent = "Allowed";
      allow.disabled = true;
    };
    li.append(box, allow);
    ul.append(li);
  }
}
function runTour() {
  oe({
    showProgress: true,
    nextBtnText: "Next",
    prevBtnText: "Back",
    doneBtnText: "Got it",
    steps: [
      { element: "#secProtection", popover: {
        title: "Protection",
        description: "Guardian checks every page as it loads, on this computer. Turn scanning off here if you ever need to."
      } },
      { element: "#secAllow", popover: {
        title: "Allowed sites",
        description: "If a safe site is blocked by mistake, add it here and Guardian will skip it from then on."
      } },
      { element: "#secActivity", popover: {
        title: "Activity",
        description: "Pages that were blocked show up here. Ordinary browsing is never recorded. You can allow a site straight from this list."
      } },
      { element: "#secSecurity", popover: {
        title: "Your PIN",
        description: "Change your PIN here. Read the note underneath \u2014 it explains what the PIN can and cannot protect against."
      } }
    ]
  }).drive();
}
$2("lockBtn").addEventListener("click", attemptUnlock);
[$2("pin1"), $2("pin2")].forEach((i2) => i2.addEventListener("keydown", (e2) => {
  if (e2.key === "Enter") attemptUnlock();
}));
$2("forgot").addEventListener("click", () => {
  $2("lockError").textContent = "There is no recovery. Remove Guardian at chrome://extensions and add it again \u2014 that clears the PIN, the allowed sites and the history.";
});
$2("autoScan").addEventListener("change", (e2) => setSettings({ autoScan: e2.target.checked }));
$2("blockFlagged").addEventListener("change", (e2) => setSettings({ blockFlagged: e2.target.checked }));
$2("allowAdd").addEventListener("click", async () => {
  const msg = $2("allowError");
  msg.textContent = "";
  const domain = normalizeDomain($2("allowInput").value);
  if (!domain) return void (msg.textContent = "Enter a site like example.com");
  const list = await getAllowList();
  if (list.some((e2) => e2.domain === domain)) {
    return void (msg.textContent = "That site is already allowed.");
  }
  list.push({ domain, includeSubdomains: $2("allowSubs").checked });
  await setAllowList(list);
  $2("allowInput").value = "";
  renderAllow();
});
$2("allowInput").addEventListener("keydown", (e2) => {
  if (e2.key === "Enter") $2("allowAdd").click();
});
$2("clearHistory").addEventListener("click", async () => {
  await clearHistory();
  renderHistory();
});
$2("changePin").addEventListener("click", async () => {
  const msg = $2("pinMsg");
  const pin = $2("newPin").value;
  const bad = validatePinFormat(pin);
  if (bad) return void (msg.textContent = bad);
  await setPinRecord(await createPinRecord(pin));
  $2("newPin").value = "";
  msg.textContent = "PIN updated.";
});
$2("startTour").addEventListener("click", runTour);
$2("lockNow").addEventListener("click", () => location.reload());
(async () => {
  await initLock();
})();

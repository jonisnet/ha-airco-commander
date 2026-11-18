/*
 * Airco Commander card
 *
 * A self-contained web component: its own shadow root holds the styles, the
 * SVG dial and every button, so nothing is stripped or looked up in the wrong
 * DOM. Controls the climate entity directly; the timers come from the
 * Airco Commander integration this file ships with.
 *
 * Fonts: Unbounded and Manrope (SIL Open Font License), served by the
 * integration itself - no request leaves the house.
 */
(() => {
  const CARD_VERSION = "0.0.1-beta.1";
  const CARD_TAG = "airco-commander-card";
  const DOMAIN = "airco_commander";
  const DEFINE_FALLBACK_DELAY_MS = 5000;
  const SEND_DELAY_MS = 700;
  const OPTIMISTIC_MS = 10000;
  const FONT_BASE = window.AIRCO_COMMANDER_FONT_BASE || "/airco_commander_static/fonts/";

  // ---------------------------------------------------------------------------
  // HA 2026.8 scoped-custom-element-registry race (frontend#52960): define now,
  // and again through whichever registry won once the frontend has booted.
  function healElementDefine(name, ctor) {
    if (customElements.get(name)) return;
    try {
      customElements.define(name, ctor);
    } catch (e) {
      console.warn(`Airco Commander: re-defining ${name} failed`, e);
    }
  }

  function defineElement(name, ctor) {
    const registryAtLoad = customElements;
    if (!registryAtLoad.get(name)) registryAtLoad.define(name, ctor);
    registryAtLoad.whenDefined("home-assistant").then(() => healElementDefine(name, ctor));
    setTimeout(() => healElementDefine(name, ctor), DEFINE_FALLBACK_DELAY_MS);
  }

  // @font-face only works when declared in the document, not in a shadow root.
  function ensureFonts() {
    if (document.getElementById("airco-commander-fonts")) return;
    const style = document.createElement("style");
    style.id = "airco-commander-fonts";
    style.textContent = `
      @font-face { font-family: "AC Unbounded"; src: url("${FONT_BASE}unbounded-latin-wght-normal.woff2?v=${CARD_VERSION}") format("woff2"); font-weight: 200 900; font-display: swap; }
      @font-face { font-family: "AC Manrope"; src: url("${FONT_BASE}manrope-latin-wght-normal.woff2?v=${CARD_VERSION}") format("woff2"); font-weight: 200 800; font-display: swap; }`;
    document.head.appendChild(style);
  }

  // Phosphor Icons (duotone), MIT licence - see LICENSE-phosphor-icons.txt.
  const ICON_PATHS = {
    "alarm": "<path d=\"M216,136a88,88,0,1,1-88-88A88,88,0,0,1,216,136Z\" opacity=\"0.2\"/><path d=\"M128,40a96,96,0,1,0,96,96A96.11,96.11,0,0,0,128,40Zm0,176a80,80,0,1,1,80-80A80.09,80.09,0,0,1,128,216ZM61.66,37.66l-32,32A8,8,0,0,1,18.34,58.34l32-32A8,8,0,0,1,61.66,37.66Zm176,32a8,8,0,0,1-11.32,0l-32-32a8,8,0,0,1,11.32-11.32l32,32A8,8,0,0,1,237.66,69.66ZM184,128a8,8,0,0,1,0,16H128a8,8,0,0,1-8-8V80a8,8,0,0,1,16,0v48Z\"/>",
    "arrows-down-up": "<path d=\"M176,48V208H80V48Z\" opacity=\"0.2\"/><path d=\"M117.66,170.34a8,8,0,0,1,0,11.32l-32,32a8,8,0,0,1-11.32,0l-32-32a8,8,0,0,1,11.32-11.32L72,188.69V48a8,8,0,0,1,16,0V188.69l18.34-18.35A8,8,0,0,1,117.66,170.34Zm96-96-32-32a8,8,0,0,0-11.32,0l-32,32a8,8,0,0,0,11.32,11.32L168,67.31V208a8,8,0,0,0,16,0V67.31l18.34,18.35a8,8,0,0,0,11.32-11.32Z\"/>",
    "arrows-left-right": "<path d=\"M208,80v96H48V80Z\" opacity=\"0.2\"/><path d=\"M213.66,181.66l-32,32a8,8,0,0,1-11.32-11.32L188.69,184H48a8,8,0,0,1,0-16H188.69l-18.35-18.34a8,8,0,0,1,11.32-11.32l32,32A8,8,0,0,1,213.66,181.66Zm-139.32-64a8,8,0,0,0,11.32-11.32L67.31,88H208a8,8,0,0,0,0-16H67.31L85.66,53.66A8,8,0,0,0,74.34,42.34l-32,32a8,8,0,0,0,0,11.32Z\"/>",
    "caret-down": "<path d=\"M208,96l-80,80L48,96Z\" opacity=\"0.2\"/><path d=\"M215.39,92.94A8,8,0,0,0,208,88H48a8,8,0,0,0-5.66,13.66l80,80a8,8,0,0,0,11.32,0l80-80A8,8,0,0,0,215.39,92.94ZM128,164.69,67.31,104H188.69Z\"/>",
    "caret-left": "<path d=\"M160,48V208L80,128Z\" opacity=\"0.2\"/><path d=\"M163.06,40.61a8,8,0,0,0-8.72,1.73l-80,80a8,8,0,0,0,0,11.32l80,80A8,8,0,0,0,168,208V48A8,8,0,0,0,163.06,40.61ZM152,188.69,91.31,128,152,67.31Z\"/>",
    "caret-right": "<path d=\"M176,128,96,208V48Z\" opacity=\"0.2\"/><path d=\"M181.66,122.34l-80-80A8,8,0,0,0,88,48V208a8,8,0,0,0,13.66,5.66l80-80A8,8,0,0,0,181.66,122.34ZM104,188.69V67.31L164.69,128Z\"/>",
    "check-circle": "<path d=\"M224,128a96,96,0,1,1-96-96A96,96,0,0,1,224,128Z\" opacity=\"0.2\"/><path d=\"M173.66,98.34a8,8,0,0,1,0,11.32l-56,56a8,8,0,0,1-11.32,0l-24-24a8,8,0,0,1,11.32-11.32L112,148.69l50.34-50.35A8,8,0,0,1,173.66,98.34ZM232,128A104,104,0,1,1,128,24,104.11,104.11,0,0,1,232,128Zm-16,0a88,88,0,1,0-88,88A88.1,88.1,0,0,0,216,128Z\"/>",
    "cube-focus": "<path d=\"M184,96v64l-56,32L72,160V96l56-32Z\" opacity=\"0.2\"/><path d=\"M232,48V88a8,8,0,0,1-16,0V56H184a8,8,0,0,1,0-16h40A8,8,0,0,1,232,48ZM72,200H40V168a8,8,0,0,0-16,0v40a8,8,0,0,0,8,8H72a8,8,0,0,0,0-16Zm152-40a8,8,0,0,0-8,8v32H184a8,8,0,0,0,0,16h40a8,8,0,0,0,8-8V168A8,8,0,0,0,224,160ZM32,96a8,8,0,0,0,8-8V56H72a8,8,0,0,0,0-16H32a8,8,0,0,0-8,8V88A8,8,0,0,0,32,96ZM188,167l-56,32a8,8,0,0,1-7.94,0L68,167A8,8,0,0,1,64,160V96a8,8,0,0,1,4-7l56-32a8,8,0,0,1,7.94,0l56,32a8,8,0,0,1,4,7v64A8,8,0,0,1,188,167ZM88.12,96,128,118.79,167.88,96,128,73.21ZM80,155.36l40,22.85V132.64L80,109.79Zm96,0V109.79l-40,22.85v45.57Z\"/>",
    "drop": "<path d=\"M208,144a80,80,0,0,1-160,0c0-72,80-128,80-128S208,72,208,144Z\" opacity=\"0.2\"/><path d=\"M174,47.75a254.19,254.19,0,0,0-41.45-38.3,8,8,0,0,0-9.18,0A254.19,254.19,0,0,0,82,47.75C54.51,79.32,40,112.6,40,144a88,88,0,0,0,176,0C216,112.6,201.49,79.32,174,47.75ZM128,216a72.08,72.08,0,0,1-72-72c0-57.23,55.47-105,72-118,16.53,13,72,60.75,72,118A72.08,72.08,0,0,1,128,216Zm55.89-62.66a57.6,57.6,0,0,1-46.56,46.55A8.75,8.75,0,0,1,136,200a8,8,0,0,1-1.32-15.89c16.57-2.79,30.63-16.85,33.44-33.45a8,8,0,0,1,15.78,2.68Z\"/>",
    "fan": "<path d=\"M136.5,150.45A52,52,0,1,1,33,155.13l71.91-20.54h0A24,24,0,0,0,128,152a23.75,23.75,0,0,0,8.5-1.56Zm-32.19-26.31h0a24,24,0,0,1,29.52-19.42h0L152,32.17a52,52,0,1,0-47.69,92ZM201,105.5a52,52,0,0,0-57.84,3.91h0a24,24,0,0,1,2.06,35.26h0l53.74,52a52,52,0,0,0,2-91.2Z\" opacity=\"0.2\"/><path d=\"M233,135a60,60,0,0,0-89.62-35.45l16.39-65.44a8,8,0,0,0-3.45-8.68A60,60,0,1,0,95.69,128.91L30.82,147.44a8,8,0,0,0-5.8,7.32,60,60,0,0,0,44.42,60.66,60.52,60.52,0,0,0,15.62,2.07,60.07,60.07,0,0,0,59.88-62l48.48,46.92a8,8,0,0,0,9.25,1.35A60,60,0,0,0,233,135Zm-121-7a16,16,0,1,1,16,16A16,16,0,0,1,112,128ZM80,76a44,44,0,0,1,62.75-39.82L127.77,96A32,32,0,0,0,99.85,112.8,43.85,43.85,0,0,1,80,76Zm27,119.57a44,44,0,0,1-65.86-34.43l59.31-16.94A32,32,0,0,0,128,160l.91,0A43.82,43.82,0,0,1,107,195.57Zm106.17-23a43.92,43.92,0,0,1-13,14.14l-44.32-42.89a31.91,31.91,0,0,0-.59-32.57,44,44,0,0,1,57.91,61.32Z\"/>",
    "fire": "<path d=\"M208,144a80,80,0,0,1-160,0c0-30.57,14.42-58.26,31-80l33,32,26.27-72C159.86,41.92,208,88.15,208,144Z\" opacity=\"0.2\"/><path d=\"M183.89,153.34a57.6,57.6,0,0,1-46.56,46.55A8.75,8.75,0,0,1,136,200a8,8,0,0,1-1.32-15.89c16.57-2.79,30.63-16.85,33.44-33.45a8,8,0,0,1,15.78,2.68ZM216,144a88,88,0,0,1-176,0c0-27.92,11-56.47,32.66-84.85a8,8,0,0,1,11.93-.89l24.12,23.41,22-60.41a8,8,0,0,1,12.63-3.41C165.21,36,216,84.55,216,144Zm-16,0c0-46.09-35.79-85.92-58.21-106.33L119.52,98.74a8,8,0,0,1-13.09,3L80.06,76.16C64.09,99.21,56,122,56,144a72,72,0,0,0,144,0Z\"/>",
    "heart": "<path d=\"M232,102c0,66-104,122-104,122S24,168,24,102A54,54,0,0,1,78,48c22.59,0,41.94,12.31,50,32,8.06-19.69,27.41-32,50-32A54,54,0,0,1,232,102Z\" opacity=\"0.2\"/><path d=\"M178,40c-20.65,0-38.73,8.88-50,23.89C116.73,48.88,98.65,40,78,40a62.07,62.07,0,0,0-62,62c0,70,103.79,126.66,108.21,129a8,8,0,0,0,7.58,0C136.21,228.66,240,172,240,102A62.07,62.07,0,0,0,178,40ZM128,214.8C109.74,204.16,32,155.69,32,102A46.06,46.06,0,0,1,78,56c19.45,0,35.78,10.36,42.6,27a8,8,0,0,0,14.8,0c6.82-16.67,23.15-27,42.6-27a46.06,46.06,0,0,1,46,46C224,155.61,146.24,204.15,128,214.8Z\"/>",
    "lightning": "<path d=\"M96,240l16-80L48,136,160,16,144,96l64,24Z\" opacity=\"0.2\"/><path d=\"M215.79,118.17a8,8,0,0,0-5-5.66L153.18,90.9l14.66-73.33a8,8,0,0,0-13.69-7l-112,120a8,8,0,0,0,3,13l57.63,21.61L88.16,238.43a8,8,0,0,0,13.69,7l112-120A8,8,0,0,0,215.79,118.17ZM109.37,214l10.47-52.38a8,8,0,0,0-5-9.06L62,132.71l84.62-90.66L136.16,94.43a8,8,0,0,0,5,9.06l52.8,19.8Z\"/>",
    "moon-stars": "<path d=\"M210.69,158.18A88,88,0,1,1,97.82,45.31,96.08,96.08,0,0,0,192,160,96.78,96.78,0,0,0,210.69,158.18Z\" opacity=\"0.2\"/><path d=\"M240,96a8,8,0,0,1-8,8H216v16a8,8,0,0,1-16,0V104H184a8,8,0,0,1,0-16h16V72a8,8,0,0,1,16,0V88h16A8,8,0,0,1,240,96ZM144,56h8v8a8,8,0,0,0,16,0V56h8a8,8,0,0,0,0-16h-8V32a8,8,0,0,0-16,0v8h-8a8,8,0,0,0,0,16Zm72.77,97a8,8,0,0,1,1.43,8A96,96,0,1,1,95.07,37.8a8,8,0,0,1,10.6,9.06A88.07,88.07,0,0,0,209.14,150.33,8,8,0,0,1,216.77,153Zm-19.39,14.88c-1.79.09-3.59.14-5.38.14A104.11,104.11,0,0,1,88,64c0-1.79,0-3.59.14-5.38A80,80,0,1,0,197.38,167.86Z\"/>",
    "power": "<path d=\"M216,128a88,88,0,1,1-88-88A88,88,0,0,1,216,128Z\" opacity=\"0.2\"/><path d=\"M120,128V48a8,8,0,0,1,16,0v80a8,8,0,0,1-16,0Zm60.37-78.7a8,8,0,0,0-8.74,13.4C194.74,77.77,208,101.57,208,128a80,80,0,0,1-160,0c0-26.43,13.26-50.23,36.37-65.3a8,8,0,0,0-8.74-13.4C47.9,67.38,32,96.06,32,128a96,96,0,0,0,192,0C224,96.06,208.1,67.38,180.37,49.3Z\"/>",
    "snowflake": "<path d=\"M220,128a92,92,0,1,1-92-92A92.1,92.1,0,0,1,220,128Z\" opacity=\"0.2\"/><path d=\"M223.77,150.09a8,8,0,0,1-5.86,9.68l-24.64,6,6.46,24.11a8,8,0,0,1-5.66,9.8A8.25,8.25,0,0,1,192,200a8,8,0,0,1-7.72-5.93l-7.72-28.8L136,141.86v46.83l21.66,21.65a8,8,0,0,1-11.32,11.32L128,203.31l-18.34,18.35a8,8,0,0,1-11.32-11.32L120,188.69V141.86L79.45,165.27l-7.72,28.8A8,8,0,0,1,64,200a8.25,8.25,0,0,1-2.08-.27,8,8,0,0,1-5.66-9.8l6.46-24.11-24.64-6a8,8,0,0,1,3.82-15.54l29.45,7.23L112,128,71.36,104.54l-29.45,7.23A7.85,7.85,0,0,1,40,112a8,8,0,0,1-1.91-15.77l24.64-6L56.27,66.07a8,8,0,0,1,15.46-4.14l7.72,28.8L120,114.14V67.31L98.34,45.66a8,8,0,0,1,11.32-11.32L128,52.69l18.34-18.35a8,8,0,0,1,11.32,11.32L136,67.31v46.83l40.55-23.41,7.72-28.8a8,8,0,0,1,15.46,4.14l-6.46,24.11,24.64,6A8,8,0,0,1,216,112a7.85,7.85,0,0,1-1.91-.23l-29.45-7.23L144,128l40.64,23.46,29.45-7.23A8,8,0,0,1,223.77,150.09Z\"/>",
    "sparkle": "<path d=\"M194.82,151.43l-55.09,20.3-20.3,55.09a7.92,7.92,0,0,1-14.86,0l-20.3-55.09-55.09-20.3a7.92,7.92,0,0,1,0-14.86l55.09-20.3,20.3-55.09a7.92,7.92,0,0,1,14.86,0l20.3,55.09,55.09,20.3A7.92,7.92,0,0,1,194.82,151.43Z\" opacity=\"0.2\"/><path d=\"M197.58,129.06,146,110l-19-51.62a15.92,15.92,0,0,0-29.88,0L78,110l-51.62,19a15.92,15.92,0,0,0,0,29.88L78,178l19,51.62a15.92,15.92,0,0,0,29.88,0L146,178l51.62-19a15.92,15.92,0,0,0,0-29.88ZM137,164.22a8,8,0,0,0-4.74,4.74L112,223.85,91.78,169A8,8,0,0,0,87,164.22L32.15,144,87,123.78A8,8,0,0,0,91.78,119L112,64.15,132.22,119a8,8,0,0,0,4.74,4.74L191.85,144ZM144,40a8,8,0,0,1,8-8h16V16a8,8,0,0,1,16,0V32h16a8,8,0,0,1,0,16H184V64a8,8,0,0,1-16,0V48H152A8,8,0,0,1,144,40ZM248,88a8,8,0,0,1-8,8h-8v8a8,8,0,0,1-16,0V96h-8a8,8,0,0,1,0-16h8V72a8,8,0,0,1,16,0v8h8A8,8,0,0,1,248,88Z\"/>",
    "suitcase-rolling": "<path d=\"M200,64V208a8,8,0,0,1-8,8H64a8,8,0,0,1-8-8V64a8,8,0,0,1,8-8H192A8,8,0,0,1,200,64Z\" opacity=\"0.2\"/><path d=\"M104,88v96a8,8,0,0,1-16,0V88a8,8,0,0,1,16,0Zm24-8a8,8,0,0,0-8,8v96a8,8,0,0,0,16,0V88A8,8,0,0,0,128,80Zm32,0a8,8,0,0,0-8,8v96a8,8,0,0,0,16,0V88A8,8,0,0,0,160,80Zm48-16V208a16,16,0,0,1-16,16H176v16a8,8,0,0,1-16,0V224H96v16a8,8,0,0,1-16,0V224H64a16,16,0,0,1-16-16V64A16,16,0,0,1,64,48H88V24A24,24,0,0,1,112,0h32a24,24,0,0,1,24,24V48h24A16,16,0,0,1,208,64ZM104,48h48V24a8,8,0,0,0-8-8H112a8,8,0,0,0-8,8Zm88,160V64H64V208H192Z\"/>",
    "sun-horizon": "<path d=\"M192,144a64.33,64.33,0,0,1-2,16H66a64,64,0,1,1,126-16Z\" opacity=\"0.2\"/><path d=\"M240,152H199.55a73.54,73.54,0,0,0,.45-8,72,72,0,0,0-144,0,73.54,73.54,0,0,0,.45,8H16a8,8,0,0,0,0,16H240a8,8,0,0,0,0-16ZM72,144a56,56,0,1,1,111.41,8H72.59A56.13,56.13,0,0,1,72,144Zm144,56a8,8,0,0,1-8,8H48a8,8,0,0,1,0-16H208A8,8,0,0,1,216,200ZM72.84,43.58a8,8,0,0,1,14.32-7.16l8,16a8,8,0,0,1-14.32,7.16Zm-56,48.84a8,8,0,0,1,10.74-3.57l16,8a8,8,0,0,1-7.16,14.31l-16-8A8,8,0,0,1,16.84,92.42Zm192,15.16a8,8,0,0,1,3.58-10.73l16-8a8,8,0,1,1,7.16,14.31l-16,8a8,8,0,0,1-10.74-3.58Zm-48-55.16,8-16a8,8,0,0,1,14.32,7.16l-8,16a8,8,0,1,1-14.32-7.16Z\"/>",
    "thermometer-simple": "<path d=\"M160,138V48a32,32,0,0,0-64,0v90a56,56,0,1,0,64,0Zm-32,70a24,24,0,1,1,24-24A24,24,0,0,1,128,208Z\" opacity=\"0.2\"/><path d=\"M136,153V88a8,8,0,0,0-16,0v65a32,32,0,1,0,16,0Zm-8,47a16,16,0,1,1,16-16A16,16,0,0,1,128,200Zm40-66V48a40,40,0,0,0-80,0v86a64,64,0,1,0,80,0Zm-40,98a48,48,0,0,1-27.42-87.4A8,8,0,0,0,104,138V48a24,24,0,0,1,48,0v90a8,8,0,0,0,3.42,6.56A48,48,0,0,1,128,232Z\"/>",
    "thermometer": "<path d=\"M152,138V48a32,32,0,0,0-64,0v90a56,56,0,1,0,64,0Zm-32,70a24,24,0,1,1,24-24A24,24,0,0,1,120,208Z\" opacity=\"0.2\"/><path d=\"M212,56a28,28,0,1,0,28,28A28,28,0,0,0,212,56Zm0,40a12,12,0,1,1,12-12A12,12,0,0,1,212,96Zm-84,57V88a8,8,0,0,0-16,0v65a32,32,0,1,0,16,0Zm-8,47a16,16,0,1,1,16-16A16,16,0,0,1,120,200Zm40-66V48a40,40,0,0,0-80,0v86a64,64,0,1,0,80,0Zm-40,98a48,48,0,0,1-27.42-87.4A8,8,0,0,0,96,138V48a24,24,0,0,1,48,0v90a8,8,0,0,0,3.42,6.56A48,48,0,0,1,120,232Z\"/>",
    "wind": "<path d=\"M120,96a24,24,0,1,1,24-24A24,24,0,0,1,120,96Zm88-16a24,24,0,1,0,24,24A24,24,0,0,0,208,80Zm-56,80a24,24,0,1,0,24,24A24,24,0,0,0,152,160Z\" opacity=\"0.2\"/><path d=\"M184,184a32,32,0,0,1-32,32c-13.7,0-26.95-8.93-31.5-21.22a8,8,0,0,1,15-5.56C137.74,195.27,145,200,152,200a16,16,0,0,0,0-32H40a8,8,0,0,1,0-16H152A32,32,0,0,1,184,184Zm-64-80a32,32,0,0,0,0-64c-13.7,0-26.95,8.93-31.5,21.22a8,8,0,0,0,15,5.56C105.74,60.73,113,56,120,56a16,16,0,0,1,0,32H24a8,8,0,0,0,0,16Zm88-32c-13.7,0-26.95,8.93-31.5,21.22a8,8,0,0,0,15,5.56C193.74,92.73,201,88,208,88a16,16,0,0,1,0,32H32a8,8,0,0,0,0,16H208a32,32,0,0,0,0-64Z\"/>",
    "x": "<path d=\"M216,56V200a16,16,0,0,1-16,16H56a16,16,0,0,1-16-16V56A16,16,0,0,1,56,40H200A16,16,0,0,1,216,56Z\" opacity=\"0.2\"/><path d=\"M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66a8,8,0,0,1-11.32-11.32L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z\"/>",
  };

  const icon = (name, cls = "") =>
    `<svg class="i ${cls}" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">${ICON_PATHS[name] || ""}</svg>`;

  // ---------------------------------------------------------------------------
  // Texts

  const I18N = {
    nl: {
      modes: { auto: "Auto", heat_cool: "Auto", cool: "Koelen", heat: "Verwarmen", fan_only: "Ventileren", dry: "Drogen", off: "Uit" },
      targetLabel: { auto: "Auto rond", heat_cool: "Auto rond", cool: "Koelen tot", heat: "Verwarmen tot", fan_only: "Ventileren", dry: "Drogen bij", off: "Uit" },
      actions: {
        idle: "Op temperatuur", cooling: "Koelt", heating: "Verwarmt", preheating: "Warmt voor",
        defrosting: "Ontdooit", drying: "Droogt", fan: "Ventileert",
      },
      fan: { auto: "Auto", quiet: "Stil", low: "Laag", medium: "Gemiddeld", high: "Hoog", middle: "Gemiddeld", top: "Hoogste" },
      swing: {
        up_down_auto: "Op en neer", highest: "Hoogste", middle: "Midden", normal: "Normaal", lowest: "Laagste", "3d_auto": "3D Auto",
        on: "Aan", off: "Uit", vertical: "Verticaal", horizontal: "Horizontaal", both: "Beide",
      },
      swingH: {
        left_right_auto: "Links en rechts", left_left: "Links-links", left_center: "Links-midden", center_center: "Midden-midden",
        center_right: "Midden-rechts", right_right: "Rechts-rechts", left_right: "Links-rechts", right_left: "Rechts-links", "3d_auto": "3D Auto",
        on: "Aan", off: "Uit",
      },
      outside: "Buiten",
      inside: "Binnen",
      fanLabel: "Ventilator",
      vertical: "Verticaal",
      horizontal: "Horizontaal",
      auto3d: "3D Auto",
      auto3dOn: "Lamellen volgen de ruimte",
      vacant: "Leegstaand",
      vacantOn: (t) => `Vorstbeveiliging ${t}`,
      on: "Aan",
      off: "Uit",
      favorite: (n) => `Favoriet ${n}`,
      favoriteApplied: (name) => `${name} toegepast`,
      favoriteEmpty: "Stel deze favoriet in via de kaart-editor",
      favoriteHint: "Nog niet ingesteld",
      timers: "Timers",
      timersNone: "Geen timer actief",
      secControls: "Ventilator en lamellen",
      secToggles: "3D Auto en Leegstaand",
      secFavorites: "Favorieten",
      allOff: "Alles uit",
      allOffDone: "Alle airco's gaan uit",
      offTimer: "Elke dag uit om",
      offChip: (t) => `Uit om ${t}`,
      sleepTimer: "Slaaptimer",
      stop: "Stop",
      hours: (m) => (m % 60 === 0 ? `${m / 60} uur` : `${String(m / 60).replace(".", ",")} uur`),
      noTimers: "Voeg deze airco toe aan de Airco Commander-integratie voor de timers.",
      unavailable: "Niet bereikbaar",
      notFound: (e) => `Entity ${e} niet gevonden`,
      failed: "Opdracht mislukt",
      powerOn: "Aanzetten",
      powerOff: "Uitzetten",
    },
    en: {
      modes: { auto: "Auto", heat_cool: "Auto", cool: "Cool", heat: "Heat", fan_only: "Fan", dry: "Dry", off: "Off" },
      targetLabel: { auto: "Auto around", heat_cool: "Auto around", cool: "Cooling to", heat: "Heating to", fan_only: "Fan only", dry: "Drying at", off: "Off" },
      actions: {
        idle: "At temperature", cooling: "Cooling", heating: "Heating", preheating: "Preheating",
        defrosting: "Defrosting", drying: "Drying", fan: "Fan",
      },
      fan: { auto: "Auto", quiet: "Quiet", low: "Low", medium: "Medium", high: "High", middle: "Medium", top: "Top" },
      swing: {
        up_down_auto: "Up and down", highest: "Highest", middle: "Middle", normal: "Normal", lowest: "Lowest", "3d_auto": "3D Auto",
        on: "On", off: "Off", vertical: "Vertical", horizontal: "Horizontal", both: "Both",
      },
      swingH: {
        left_right_auto: "Left and right", left_left: "Left-left", left_center: "Left-center", center_center: "Center-center",
        center_right: "Center-right", right_right: "Right-right", left_right: "Left-right", right_left: "Right-left", "3d_auto": "3D Auto",
        on: "On", off: "Off",
      },
      outside: "Outside",
      inside: "Inside",
      fanLabel: "Fan",
      vertical: "Vertical",
      horizontal: "Horizontal",
      auto3d: "3D Auto",
      auto3dOn: "Louvres follow the room",
      vacant: "Vacant",
      vacantOn: (t) => `Frost protection ${t}`,
      on: "On",
      off: "Off",
      favorite: (n) => `Favourite ${n}`,
      favoriteApplied: (name) => `${name} applied`,
      favoriteEmpty: "Set up this favourite in the card editor",
      favoriteHint: "Not set up yet",
      timers: "Timers",
      timersNone: "No timer running",
      secControls: "Fan and louvres",
      secToggles: "3D Auto and Vacant",
      secFavorites: "Favourites",
      allOff: "All off",
      allOffDone: "Turning every airco off",
      offTimer: "Every day off at",
      offChip: (t) => `Off at ${t}`,
      sleepTimer: "Sleep timer",
      stop: "Stop",
      hours: (m) => `${m / 60} h`,
      noTimers: "Add this airco to the Airco Commander integration for the timers.",
      unavailable: "Unavailable",
      notFound: (e) => `Entity ${e} not found`,
      failed: "Command failed",
      powerOn: "Turn on",
      powerOff: "Turn off",
    },
  };

  function lang(hass) {
    const l = (hass && (hass.locale?.language || hass.language)) || "en";
    return l.startsWith("nl") ? I18N.nl : I18N.en;
  }

  function label(map, key) {
    if (key == null) return "";
    return map[key] || String(key).replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function decimalSep(hass) {
    try {
      return (1.5).toLocaleString(hass?.locale?.language || hass?.language || "en").includes(",") ? "," : ".";
    } catch (e) {
      return ".";
    }
  }

  const num = (v, hass, digits = 1) =>
    typeof v === "number" && isFinite(v) ? v.toFixed(digits).replace(".", decimalSep(hass)) : "--";

  // ---------------------------------------------------------------------------
  // Louvre and fan drawings (from the original hand-built design), driven by
  // the real option values.

  const ACTIVE = "var(--accent)";
  const DIM = "var(--dim)";
  const V_INDEX = { up_down_auto: 0, highest: 1, middle: 2, normal: 3, lowest: 4, "3d_auto": 5 };
  const H_CONFIGS = {
    left_right_auto: { left: "ALL", right: "ALL", isAuto: true },
    left_left: { left: "L", right: "L" },
    left_center: { left: "L", right: "M" },
    center_center: { left: "M", right: "M" },
    center_right: { left: "M", right: "R" },
    right_right: { left: "R", right: "R" },
    left_right: { left: "L", right: "R" },
    right_left: { left: "R", right: "L" },
  };

  const textGraphic = (text) => `<span class="pill-text">${escapeHtml(text)}</span>`;

  function fanGraphic(value, modes, tx) {
    if (value === "auto") return textGraphic("AUTO");
    const levels = (modes || []).filter((m) => m !== "auto");
    const i = levels.indexOf(value);
    if (i < 0) return textGraphic(label(tx.fan, value));
    const lit = Math.max(1, Math.round(((i + 1) / levels.length) * 4));
    let svg = `<svg width="46" height="18" viewBox="0 0 46 18" aria-hidden="true">`;
    for (let b = 0; b < 4; b++) {
      const h = 5 + b * 3;
      svg += `<rect x="${b * 10 + 4}" y="${16 - h}" width="6" height="${h}" rx="2" fill="${b < lit ? ACTIVE : DIM}" />`;
    }
    return svg + `</svg>`;
  }

  function verticalGraphic(value, tx) {
    const index = V_INDEX[value];
    if (index === undefined) return textGraphic(label(tx.swing, value));
    if (index === 5) return textGraphic("3D AUTO");
    const c = (n) => (index === 0 || index === n + 1 ? ACTIVE : DIM);
    return `
      <svg width="64" height="28" viewBox="0 0 68 28" aria-hidden="true">
        <path d="M 8 4 L 22 4 L 18 14 L 8 14 Z" fill="var(--unit)" />
        <polygon points="24,6 54,4 53,9 24,8" fill="${c(0)}" />
        <polygon points="24,9 52,11 49,16 23,11" fill="${c(1)}" />
        <polygon points="23,12 47,18 42,22 21,13" fill="${c(2)}" />
        <polygon points="20,14 39,23 33,26 18,15" fill="${c(3)}" />
        ${index === 0 ? `<path d="M 11 16 Q 11 24 22 24" stroke="${ACTIVE}" stroke-width="1.8" fill="none" stroke-linecap="round"/><polygon points="24,24 20,22 20,26" fill="${ACTIVE}"/>` : ""}
      </svg>`;
  }

  function fanGroup(cx, dir) {
    const col = (d) => (dir === "ALL" || dir === d ? ACTIVE : DIM);
    return `
      <line x1="${cx - 3}" y1="10" x2="${cx - 9}" y2="19" stroke="${col("L")}" stroke-width="2.4" stroke-linecap="round" />
      <line x1="${cx}" y1="10" x2="${cx}" y2="20" stroke="${col("M")}" stroke-width="2.4" stroke-linecap="round" />
      <line x1="${cx + 3}" y1="10" x2="${cx + 9}" y2="19" stroke="${col("R")}" stroke-width="2.4" stroke-linecap="round" />`;
  }

  function horizontalGraphic(value, tx) {
    if (value === "3d_auto") return textGraphic("3D AUTO");
    const cfg = H_CONFIGS[value];
    if (!cfg) return textGraphic(label(tx.swingH, value));
    return `
      <svg width="68" height="30" viewBox="0 0 72 30" aria-hidden="true">
        <rect x="10" y="2" width="52" height="6" rx="2" fill="var(--unit)" />
        <line x1="36" y1="2" x2="36" y2="8" stroke="var(--surface-2)" stroke-width="1.5" />
        ${fanGroup(23, cfg.left)}
        ${fanGroup(49, cfg.right)}
        ${cfg.isAuto ? `
          <path d="M 14 25 Q 36 29 58 25" stroke="${ACTIVE}" stroke-width="1.6" fill="none" stroke-linecap="round"/>
          <polygon points="12,24 16,23 15,27" fill="${ACTIVE}"/>
          <polygon points="60,24 56,23 57,27" fill="${ACTIVE}"/>` : ""}
      </svg>`;
  }

  // ---------------------------------------------------------------------------
  // Dial geometry (viewBox 0 0 240 216, centre 120,116, r 92, 270° sweep).

  const CX = 120;
  const CY = 116;
  const R = 92;
  const START_DEG = 135;
  const SWEEP = 270;
  const ARC_LEN = 2 * Math.PI * R * (SWEEP / 360);
  const polar = (deg, r = R) => {
    const rad = (deg * Math.PI) / 180;
    return [CX + r * Math.cos(rad), CY + r * Math.sin(rad)];
  };
  const [AX, AY] = polar(START_DEG);
  const [BX, BY] = polar(START_DEG + SWEEP);
  const ARC_PATH = `M ${AX.toFixed(2)} ${AY.toFixed(2)} A ${R} ${R} 0 1 1 ${BX.toFixed(2)} ${BY.toFixed(2)}`;

  const MODE_ORDER = ["auto", "cool", "heat", "dry", "fan_only"];
  // Ring layout: angle on the dial (SVG degrees, 270 = top) and label side.
  const RING_SLOTS = [
    { slot: "auto", deg: 180, side: "left" },
    { slot: "cool", deg: 225, side: "left" },
    { slot: "heat", deg: 270, side: "top" },
    { slot: "fan_only", deg: 315, side: "right" },
    { slot: "dry", deg: 0, side: "right" },
  ];
  const RING_R = 132;
  // Pick-sheet keys: [options attribute, value attribute, climate service].
  const SHEET_KEYS = {
    fan: ["fan_modes", "fan_mode", "set_fan_mode"],
    vertical: ["swing_modes", "swing_mode", "set_swing_mode"],
    horizontal: ["swing_horizontal_modes", "swing_horizontal_mode", "set_swing_horizontal_mode"],
  };
  const MODE_ICON = { auto: "sparkle", heat_cool: "sparkle", cool: "snowflake", heat: "fire", dry: "drop", fan_only: "wind" };
  const ACTION_ICON = { heating: "fire", preheating: "fire", cooling: "snowflake", defrosting: "snowflake", drying: "drop", fan: "fan", idle: "check-circle" };

  function formatCountdown(ms) {
    if (!(ms > 0)) return "0:00:00";
    const s = Math.floor(ms / 1000);
    const pad = (n) => String(n).padStart(2, "0");
    return `${Math.floor(s / 3600)}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
  }

  const minutesToHHMM = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

  function parseList(value, fallback) {
    if (Array.isArray(value)) return value;
    if (typeof value === "string" && value.trim()) return value.split(",").map((s) => s.trim()).filter(Boolean);
    return fallback;
  }

  // ---------------------------------------------------------------------------
  // Styles

  const STYLES = `
    :host {
      display: block;
      container-type: inline-size;
      container-name: accard;
      --font-display: "AC Unbounded", "Avenir Next", "Futura", system-ui, sans-serif;
      --font-text: "AC Manrope", "Avenir Next", "Segoe UI", system-ui, sans-serif;
      --bg: #f5f1ea;
      --surface: #ffffff;
      --surface-2: #efe9df;
      --text: #1b2230;
      --muted: #7b8291;
      --line: rgba(27, 34, 48, 0.08);
      --dim: #d3d6dd;
      --unit: #9aa3b2;
      --track: #e6e0d6;
      --shadow: 0 1px 2px rgba(27,34,48,.04), 0 12px 32px -12px rgba(27,34,48,.18);
      --mode-a: #c9ccd3;
      --mode-b: #9aa0ab;
      --accent: #6b7383;
      --danger: #e5484d;
      --radius: 30px;
    }
    :host(.dark) {
      --bg: #13161c;
      --surface: #1c2129;
      --surface-2: #252c37;
      --text: #eef1f6;
      --muted: #8d96a6;
      --line: rgba(255, 255, 255, 0.07);
      --dim: #3b4350;
      --unit: #7d8798;
      --track: #262d38;
      --shadow: 0 1px 2px rgba(0,0,0,.3), 0 16px 40px -16px rgba(0,0,0,.6);
      --mode-a: #4b525e;
      --mode-b: #6b7383;
      --accent: #a3acbb;
    }
    :host([data-mode="heat"]) { --mode-a: #ffb347; --mode-b: #ff5a4e; --accent: #ff6a3d; }
    :host([data-mode="cool"]) { --mode-a: #43e0ff; --mode-b: #2f6bff; --accent: #2f86ff; }
    :host([data-mode="auto"]), :host([data-mode="heat_cool"]) { --mode-a: #3fd0ff; --mode-b: #ff6a5e; --accent: #8a6cff; }
    :host([data-mode="dry"]) { --mode-a: #4fe3c1; --mode-b: #129c9c; --accent: #14a6a0; }
    :host([data-mode="fan_only"]) { --mode-a: #b7c6dc; --mode-b: #5d7396; --accent: #5f7aa3; }
    :host(.dark[data-mode="fan_only"]) { --accent: #93a9cc; }

    * { box-sizing: border-box; }
    ha-card {
      display: block;
      position: relative;
      overflow: hidden;
      background: var(--bg);
      color: var(--text);
      border-radius: var(--radius);
      border: 1px solid var(--line);
      box-shadow: var(--shadow);
      padding: 22px;
      font-family: var(--font-text);
      max-width: var(--max-width, 480px);
      margin: 0 auto;
      -webkit-font-smoothing: antialiased;
    }
    ha-card::before {
      content: ""; position: absolute; inset: -40% -20% auto; height: 70%; pointer-events: none;
      background: radial-gradient(closest-side, color-mix(in srgb, var(--mode-b) 22%, transparent), transparent);
      opacity: .55; transition: background .6s;
    }
    .is-off ha-card::before, ha-card.is-off::before { opacity: 0; }
    button { font-family: inherit; color: inherit; border: 0; background: none; padding: 0; cursor: pointer; -webkit-tap-highlight-color: transparent; }
    button:focus-visible, input:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
    .i { width: 1em; height: 1em; display: block; flex: none; }
    .layout { position: relative; display: grid; gap: 14px; }
    .side { display: grid; gap: 12px; align-content: start; }

    /* Header */
    .head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; }
    .titles { min-width: 0; }
    .eyebrow { display: flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; color: var(--muted); }
    .eyebrow .i { font-size: 15px; }
    .room {
      font-family: var(--font-display); font-weight: 600; font-size: 22px; letter-spacing: -0.01em; line-height: 1.15;
      margin: 4px 0 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .chip {
      display: inline-flex; align-items: center; gap: 6px; height: 26px; padding: 0 10px 0 8px; border-radius: 13px;
      background: var(--surface); border: 1px solid var(--line); font-size: 12px; font-weight: 700; white-space: nowrap;
    }
    .chip .i { font-size: 15px; color: var(--accent); }
    .chip.tchip { font-variant-numeric: tabular-nums; }
    .chip[hidden] { display: none; }
    .power {
      width: 54px; height: 54px; border-radius: 50%; flex: none; display: grid; place-items: center; font-size: 24px;
      background: var(--surface); color: var(--muted); border: 1px solid var(--line); box-shadow: var(--shadow);
      transition: transform .15s, background .4s, color .3s, box-shadow .4s;
    }
    .power.on {
      color: #fff; border-color: transparent;
      background: linear-gradient(140deg, var(--mode-a), var(--mode-b));
      box-shadow: 0 10px 24px -8px color-mix(in srgb, var(--mode-b) 70%, transparent);
    }
    .power:active { transform: scale(.94); }

    /* Dial */
    .dial { position: relative; width: min(100%, 330px); margin: 0 auto; aspect-ratio: 240 / 216; container-type: inline-size; }
    .dial > svg { width: 100%; height: 100%; display: block; overflow: visible; }
    .track { fill: none; stroke: var(--track); stroke-width: 14; stroke-linecap: round; }
    .progress { fill: none; stroke: url(#ac-grad); stroke-width: 14; stroke-linecap: round; transition: stroke-dasharray .35s ease; }
    .is-off .progress { stroke: var(--dim); }
    .running .progress { animation: glow 2.6s ease-in-out infinite; }
    @keyframes glow {
      0%, 100% { filter: drop-shadow(0 0 0 transparent); }
      50% { filter: drop-shadow(0 0 7px color-mix(in srgb, var(--mode-b) 75%, transparent)); }
    }
    .tick { stroke: var(--dim); stroke-width: 1.6; stroke-linecap: round; }
    .tick.major { stroke-width: 2.2; }
    .tick.on { stroke: var(--accent); }
    .is-off .tick.on { stroke: var(--dim); }
    .scale-label { font-family: var(--font-text); font-size: 9px; font-weight: 700; fill: var(--muted); }
    .hit { fill: none; stroke: transparent; stroke-width: 44; cursor: pointer; touch-action: none; }
    .knob { cursor: grab; touch-action: none; transition: transform .25s ease; }
    .dragging .knob { transition: none; cursor: grabbing; }
    .knob-outer { fill: var(--surface); filter: drop-shadow(0 3px 6px rgba(0,0,0,.25)); }
    .knob-inner { fill: var(--mode-b); }
    .is-off .knob-inner { fill: var(--dim); }
    .current-mark { fill: var(--text); }
    .dial-center {
      position: absolute; left: 0; right: 0; top: 27%; display: flex; flex-direction: column; align-items: center; pointer-events: none;
    }
    .target-label { font-size: max(11px, 4.4cqw); font-weight: 700; color: var(--muted); letter-spacing: .02em; }
    .big {
      font-family: var(--font-display); font-weight: 500; line-height: 1; margin: 4px 0 6px; display: flex; align-items: flex-start;
      font-variant-numeric: tabular-nums; transition: color .3s;
    }
    .big .int { font-size: 22cqw; letter-spacing: -0.04em; }
    .big .dec { font-size: 9cqw; margin-top: 2.2cqw; color: var(--muted); }
    .big .deg { font-size: 9cqw; margin-top: 2.2cqw; color: var(--accent); }
    .big.pending .int { color: var(--accent); }
    .is-off .big { opacity: .45; }
    .inside { display: flex; align-items: center; gap: 4px; font-size: max(12px, 4.6cqw); font-weight: 700; color: var(--muted); }
    .inside .i { font-size: 1.2em; }
    .steps { position: absolute; left: 50%; bottom: 3%; transform: translateX(-50%); display: flex; gap: 18cqw; }
    .step {
      width: 46px; height: 46px; border-radius: 50%; display: grid; place-items: center; font-size: 22px; font-weight: 500;
      background: var(--surface); border: 1px solid var(--line); box-shadow: var(--shadow); transition: transform .12s;
    }
    .step:active { transform: scale(.92); }
    .pair { display: flex; align-items: center; gap: 6px; }
    .step.coarse { width: 38px; height: 38px; font-size: 11px; font-weight: 800; font-family: var(--font-text); color: var(--accent); }
    .step[hidden] { display: none; }
    .step svg { width: 16px; height: 16px; }

    /* Modes */
    .modes { display: grid; grid-template-columns: repeat(var(--mode-count, 5), 1fr); gap: 6px; padding: 5px; border-radius: 22px; background: var(--surface-2); }
    .mode {
      display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 9px 2px 8px; border-radius: 17px;
      font-size: 11px; font-weight: 700; color: var(--muted); transition: background .3s, color .3s, box-shadow .3s;
    }
    .mode .i { font-size: 22px; }
    .mode[hidden] { display: none; }
    .mode.active {
      color: #fff; background: linear-gradient(150deg, var(--mode-a), var(--mode-b));
      box-shadow: 0 8px 18px -8px color-mix(in srgb, var(--mode-b) 80%, transparent);
    }

    /* Mode buttons round the ring (mode_style: ring), as in the Smart M-Air app */
    .ring-modes { position: absolute; inset: 0; pointer-events: none; display: none; }
    .mode-ring .ring-modes { display: block; }
    .mode-ring .modes { display: none !important; }
    .mode-ring .dial { width: min(calc(100% - 120px), 280px); margin-top: 52px; margin-bottom: 4px; }
    .wide.mode-ring .dial { width: min(calc(100% - 120px), 320px); }
    .rmode {
      position: absolute; transform: translate(-50%, -50%); width: 40px; height: 40px; border-radius: 50%;
      display: grid; place-items: center; font-size: 20px; pointer-events: auto;
      background: var(--surface); color: var(--muted); border: 1px solid var(--line); box-shadow: var(--shadow);
      transition: background .3s, color .3s, transform .15s;
    }
    .rmode:active { transform: translate(-50%, -50%) scale(.92); }
    .rmode[hidden] { display: none; }
    .rmode.active { color: #fff; border-color: transparent; background: linear-gradient(150deg, var(--mode-a), var(--mode-b)); box-shadow: 0 8px 18px -8px color-mix(in srgb, var(--mode-b) 80%, transparent); }
    .rmode span { position: absolute; white-space: nowrap; font-size: 11px; font-weight: 800; color: var(--muted); line-height: 1; }
    .rmode.active span { color: var(--text); }
    .rmode span { bottom: calc(100% + 6px); left: 50%; transform: translateX(-50%); }
    @container accard (max-width: 419px) {
      .mode-ring .dial { width: min(calc(100% - 72px), 280px); margin-top: 34px; }
      .rmode span { display: none; }
    }

    /* Tabs for more than one airco */
    .tabs { position: relative; z-index: 1; display: flex; gap: 6px; overflow-x: auto; scrollbar-width: none; margin: -4px -4px 14px; padding: 4px; }
    .tabs::-webkit-scrollbar { display: none; }
    .tabs[hidden] { display: none; }
    .tab {
      flex: none; display: inline-flex; align-items: center; gap: 7px; height: 34px; padding: 0 12px; border-radius: 17px;
      background: var(--surface-2); font-size: 12px; font-weight: 800; color: var(--muted); transition: background .25s, color .25s, box-shadow .25s;
    }
    .tab.active { background: var(--surface); color: var(--text); box-shadow: var(--shadow); }
    .tab .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--dot); box-shadow: 0 0 0 3px color-mix(in srgb, var(--dot) 22%, transparent); }
    .tab .ttemp { font-family: var(--font-display); font-weight: 500; font-size: 11px; color: var(--muted); font-variant-numeric: tabular-nums; }
    .tab.alloff { margin-left: auto; width: 34px; padding: 0; justify-content: center; position: sticky; right: 0; color: var(--danger); background: color-mix(in srgb, var(--danger) 12%, var(--surface)); }
    .tab.alloff .i { font-size: 17px; }

    /* Collapsible sections (collapsible: [...]) */
    .sec-head { display: flex; align-items: center; gap: 10px; width: 100%; text-align: left; padding: 12px 14px; }
    .sec-head[hidden] { display: none; }
    .sec-head .grow { flex: 1; min-width: 0; }
    .sec-head.open .caret { transform: rotate(180deg); }
    .sec-head.open { border-bottom-left-radius: 14px; border-bottom-right-radius: 14px; }

    /* Panels */
    .panel { background: var(--surface); border: 1px solid var(--line); border-radius: 22px; padding: 14px; }
    .row { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 6px 0; }
    .row[hidden] { display: none; }
    .row + .row { border-top: 1px solid var(--line); }
    .row-label { display: flex; align-items: center; gap: 10px; min-width: 0; }
    .badge {
      width: 34px; height: 34px; border-radius: 11px; display: grid; place-items: center; font-size: 19px; flex: none;
      color: var(--accent); background: color-mix(in srgb, var(--accent) 12%, transparent);
    }
    .row-title { font-size: 13px; font-weight: 800; }
    .row-sub { font-size: 11px; font-weight: 600; color: var(--muted); margin-top: 1px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .pill {
      display: flex; align-items: center; height: 42px; width: 176px; max-width: 52%; flex: none; border-radius: 14px;
      background: var(--surface-2); padding: 0 2px;
    }
    .pill-arrow { width: 34px; height: 100%; display: grid; place-items: center; color: var(--accent); font-size: 16px; border-radius: 12px; }
    .pill-arrow:active { background: color-mix(in srgb, var(--accent) 14%, transparent); }
    .pill-content { flex: 1; display: grid; place-items: center; min-width: 0; height: 100%; }
    .pill-text { font-size: 11px; font-weight: 800; letter-spacing: .04em; color: var(--accent); white-space: nowrap; }
    .spin .i { animation: spin var(--spin, 2.4s) linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    .tiles { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .tiles[hidden] { display: none; }
    .tile {
      display: flex; align-items: center; gap: 10px; padding: 12px; border-radius: 18px; text-align: left; min-width: 0;
      background: var(--surface); border: 1px solid var(--line); transition: background .3s, border-color .3s;
    }
    .tile[hidden] { display: none; }
    .tile .badge { color: var(--muted); background: var(--surface-2); }
    .tile.on { border-color: color-mix(in srgb, var(--accent) 45%, transparent); background: color-mix(in srgb, var(--accent) 8%, var(--surface)); }
    .tile.on .badge { color: #fff; background: linear-gradient(150deg, var(--mode-a), var(--mode-b)); }
    .tile .txt { min-width: 0; }
    .fav .badge { color: var(--danger); background: color-mix(in srgb, var(--danger) 12%, transparent); }
    .fav.empty { opacity: .6; }
    .fav.on { border-color: color-mix(in srgb, var(--danger) 45%, transparent); background: color-mix(in srgb, var(--danger) 6%, var(--surface)); }
    .fav.on .badge { color: #fff; background: linear-gradient(150deg, #ff8a8a, var(--danger)); }

    /* Timers */
    .timers { padding: 0; overflow: hidden; }
    .timers-head { width: 100%; display: flex; align-items: center; gap: 10px; padding: 12px 14px; text-align: left; }
    .timers-head .grow { flex: 1; min-width: 0; }
    .caret { font-size: 16px; color: var(--muted); transition: transform .25s; }
    .open .caret { transform: rotate(180deg); }
    .timers-body { display: none; padding: 0 14px 14px; gap: 14px; }
    .open .timers-body { display: grid; }
    .timer { display: grid; gap: 8px; padding-top: 12px; border-top: 1px solid var(--line); }
    .timer-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .timer-title { display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 800; }
    .timer-title .i { font-size: 18px; color: var(--accent); }
    .readout {
      font-family: var(--font-display); font-size: 13px; font-weight: 500; font-variant-numeric: tabular-nums;
      padding: 4px 10px; border-radius: 10px; background: var(--surface-2); color: var(--muted);
    }
    .readout.running { color: #fff; background: linear-gradient(150deg, var(--mode-a), var(--mode-b)); }
    .timer-row { display: flex; gap: 6px; }
    .timer-input {
      width: 92px; flex: none; height: 38px; border-radius: 12px; border: 1px solid var(--line); background: var(--surface-2);
      color: var(--text); font: 700 13px var(--font-text); text-align: center; color-scheme: light dark; padding: 0 6px;
    }
    .preset {
      flex: 1; min-width: 0; height: 38px; border-radius: 12px; background: var(--surface-2); font-size: 12px; font-weight: 800;
      transition: background .25s, color .25s;
    }
    .preset.active { color: #fff; background: linear-gradient(150deg, var(--mode-a), var(--mode-b)); }
    .preset.stop { color: var(--danger); background: color-mix(in srgb, var(--danger) 11%, transparent); }
    .preset.stop.idle { opacity: .45; }
    .hint { font-size: 12px; color: var(--muted); text-align: center; padding: 4px 8px; }
    .hint[hidden] { display: none; }

    .overlay {
      position: absolute; inset: 0; z-index: 3; display: none; align-items: center; justify-content: center; text-align: center;
      font-weight: 800; color: var(--muted); background: color-mix(in srgb, var(--bg) 78%, transparent); border-radius: var(--radius);
    }
    .unavailable .overlay { display: flex; }

    @media (prefers-reduced-motion: reduce) {
      .running .progress, .spin .i { animation: none; }
    }

    /* Tablet / wide: dial left, controls right (set from a ResizeObserver,
       or forced with layout: wide / stacked). */
    ha-card.wide { max-width: var(--max-width, 980px); padding: 28px; }
    .wide .layout { grid-template-columns: minmax(300px, 1fr) minmax(320px, 1fr); gap: 24px; align-items: start; }
    .wide .dial { width: min(100%, 380px); }
    .wide .timers .caret { display: none; }
    .wide .timers .timers-body { display: grid; }

    /* Pick sheet */
    .sheet-wrap { position: absolute; inset: 0; z-index: 4; display: flex; align-items: flex-end; }
    .sheet-wrap[hidden] { display: none; }
    .sheet-backdrop { position: absolute; inset: 0; background: color-mix(in srgb, var(--bg) 55%, transparent); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px); animation: fade .2s ease; }
    .sheet {
      position: relative; width: 100%; max-height: 82%; overflow: auto; background: var(--surface); border-top: 1px solid var(--line);
      border-radius: 26px 26px var(--radius) var(--radius); padding: 16px; box-shadow: 0 -18px 40px -20px rgba(0,0,0,.35); animation: rise .25s cubic-bezier(.2,.8,.2,1);
    }
    .wide .sheet { width: min(560px, 100%); margin: 0 auto; }
    .sheet-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
    .sheet-title { font-family: var(--font-display); font-weight: 600; font-size: 16px; }
    .sheet-close { width: 34px; height: 34px; border-radius: 50%; display: grid; place-items: center; font-size: 18px; background: var(--surface-2); color: var(--muted); }
    .sheet-grid { display: grid; grid-template-columns: repeat(var(--cols, 3), 1fr); gap: 8px; }
    .opt {
      display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px; min-height: 76px; padding: 10px 6px;
      border-radius: 16px; background: var(--surface-2); font-size: 11px; font-weight: 800; text-align: center; transition: transform .12s;
    }
    .opt:active { transform: scale(.96); }
    .opt .g { height: 30px; display: grid; place-items: center; }
    .opt.temp { min-height: 52px; font-family: var(--font-display); font-size: 17px; font-weight: 500; }
    .opt.active { color: #fff; background: linear-gradient(150deg, var(--mode-a), var(--mode-b)); --accent: #fff; --dim: rgba(255,255,255,.35); --unit: rgba(255,255,255,.75); }
    .opt.active .pill-text { color: #fff; }
    @keyframes rise { from { transform: translateY(30px); opacity: 0; } }
    @keyframes fade { from { opacity: 0; } }
    button.pill-content, button.big { cursor: pointer; }
    button.big { pointer-events: auto; color: inherit; border-radius: 16px; padding: 0 6px; }
    .row-label[data-action] { cursor: pointer; }
    @container (max-width: 420px) {
      .timer-input { width: 70px; padding: 0 2px; }
      .timer-input::-webkit-calendar-picker-indicator { display: none; }
      .preset { font-size: 11px; }
    }
    @container (max-width: 360px) {
      ha-card { padding: 16px; }
      .pill { width: 150px; }
      .room { font-size: 19px; }
    }
  `;

  // ---------------------------------------------------------------------------

  class AircoCommanderCard extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: "open" });
      this._optimistic = {};
      this._sendTimers = {};
      this._els = null;
      this._cache = {};
      this._timersOpen = false;
      this._dragging = false;
      this._open = {};
      // Listeners live on the shadow root, which survives every re-render
      // (setConfig from the editor re-renders): attach them exactly once.
      this.shadowRoot.addEventListener("click", (ev) => this._els && this._onClick(ev));
      this.shadowRoot.addEventListener("change", (ev) => this._els && this._onChange(ev));
      this.shadowRoot.addEventListener("keydown", (ev) => {
        if (ev.key === "Escape") this._closeSheet();
      });
    }

    static getStubConfig(hass) {
      const climate = Object.keys(hass?.states || {}).find((e) => e.startsWith("climate."));
      return { entity: climate || "", theme: "auto", layout: "auto", mode_style: "bar" };
    }

    static getConfigForm() {
      const nl = (document.querySelector("home-assistant")?.hass?.language || navigator.language || "en").startsWith("nl");
      const T = (n, e) => (nl ? n : e);
      const opt = (value, n, e) => ({ value, label: T(n, e) });

      const favSchema = [
        { name: "name", selector: { text: {} } },
        {
          type: "grid",
          name: "",
          schema: [
            {
              name: "hvac_mode",
              selector: {
                select: {
                  mode: "dropdown",
                  options: [
                    opt("heat", "Verwarmen", "Heat"),
                    opt("cool", "Koelen", "Cool"),
                    opt("auto", "Auto", "Auto"),
                    opt("dry", "Drogen", "Dry"),
                    opt("fan_only", "Ventileren", "Fan"),
                    opt("off", "Uit", "Off"),
                  ],
                },
              },
            },
            { name: "temperature", selector: { number: { min: 10, max: 31, step: 0.5, mode: "box", unit_of_measurement: "°C" } } },
          ],
        },
        {
          name: "fan_mode",
          selector: {
            select: {
              mode: "dropdown",
              custom_value: true,
              options: [opt("auto", "Auto", "Auto"), opt("quiet", "Stil", "Quiet"), opt("low", "Laag", "Low"), opt("medium", "Gemiddeld", "Medium"), opt("high", "Hoog", "High")],
            },
          },
        },
        {
          type: "grid",
          name: "",
          schema: [
            {
              name: "swing_mode",
              selector: {
                select: {
                  mode: "dropdown",
                  custom_value: true,
                  options: [
                    opt("up_down_auto", "Op en neer", "Up and down"),
                    opt("highest", "Hoogste", "Highest"),
                    opt("middle", "Midden", "Middle"),
                    opt("normal", "Normaal", "Normal"),
                    opt("lowest", "Laagste", "Lowest"),
                    opt("3d_auto", "3D Auto", "3D Auto"),
                  ],
                },
              },
            },
            {
              name: "swing_horizontal_mode",
              selector: {
                select: {
                  mode: "dropdown",
                  custom_value: true,
                  options: [
                    opt("left_right_auto", "Links en rechts", "Left and right"),
                    opt("left_left", "Links-links", "Left-left"),
                    opt("left_center", "Links-midden", "Left-center"),
                    opt("center_center", "Midden-midden", "Center-center"),
                    opt("center_right", "Midden-rechts", "Center-right"),
                    opt("right_right", "Rechts-rechts", "Right-right"),
                    opt("left_right", "Links-rechts", "Left-right"),
                    opt("right_left", "Rechts-links", "Right-left"),
                    opt("3d_auto", "3D Auto", "3D Auto"),
                  ],
                },
              },
            },
          ],
        },
      ];

      const labels = {
        entity: T("Airco", "Airco"),
        entities: T("Extra airco's (tabbladen)", "More aircos (tabs)"),
        name: T("Naam", "Name"),
        theme: T("Thema", "Theme"),
        layout: T("Indeling", "Layout"),
        mode_style: T("Modusknoppen", "Mode buttons"),
        temp_step: T("Stap van − en +", "Step of − and +"),
        hide: T("Verbergen", "Hide"),
        collapsible: T("Inklapbaar", "Collapsible"),
        outdoor_sensor: T("Andere buitensensor", "Other outdoor sensor"),
        hvac_mode: T("Modus", "Mode"),
        temperature: T("Temperatuur", "Temperature"),
        fan_mode: T("Ventilator", "Fan"),
        swing_mode: T("Verticaal", "Vertical"),
        swing_horizontal_mode: T("Horizontaal", "Horizontal"),
        off_presets: T("Knoppen vaste uitschakeltijd", "Daily turn-off buttons"),
        sleep_presets: T("Knoppen slaaptimer (minuten)", "Sleep timer buttons (minutes)"),
      };
      const helpers = {
        entity: T(
          "De koppelingen (buitentemperatuur, leegstaand pand, energie) komen uit de Airco Commander-integratie.",
          "Linked entities (outdoor temperature, vacant, energy) come from the Airco Commander integration."
        ),
        name: T("Leeg = naam van de airco.", "Empty = the airco's name."),
        entities: T(
          "Optioneel. Elke extra airco krijgt een tabblad bovenin de kaart, met een knop Alles uit.",
          "Optional. Every extra airco gets a tab at the top of the card, with an All off button."
        ),
        layout: T("Automatisch: naast elkaar vanaf tabletbreedte.", "Automatic: side by side from tablet width."),
        temp_step: T(
          "Standaard de stap van de airco zelf (WF-RAC: 0,5°). Bij een stap kleiner dan 0,5° komen er ook knoppen voor hele graden bij.",
          "Defaults to the airco's own step (WF-RAC: 0.5°). Below 0.5° extra whole-degree buttons appear."
        ),
        collapsible: T("Deze onderdelen krijgen een kop om ze in en uit te klappen; de browser onthoudt de stand.", "These sections get a header to fold them; the browser remembers the state."),
        outdoor_sensor: T("Alleen invullen om de gekoppelde sensor te overschrijven.", "Only to override the linked sensor."),
        off_presets: T("Tijden, gescheiden door komma's: 22:00, 23:00", "Times, comma separated: 22:00, 23:00"),
        sleep_presets: T("Minuten, gescheiden door komma's: 60, 90", "Minutes, comma separated: 60, 90"),
        name_fav: T("Leeg laten wat niet mag veranderen.", "Leave empty what should not change."),
      };

      return {
        schema: [
          { name: "entity", required: true, selector: { entity: { domain: "climate" } } },
          { name: "entities", selector: { entity: { domain: "climate", multiple: true } } },
          { name: "name", selector: { text: {} } },
          {
            type: "grid",
            name: "",
            schema: [
              {
                name: "theme",
                selector: { select: { mode: "dropdown", options: [opt("auto", "Volgt Home Assistant", "Follow Home Assistant"), opt("light", "Licht", "Light"), opt("dark", "Donker", "Dark")] } },
              },
              {
                name: "layout",
                selector: { select: { mode: "dropdown", options: [opt("auto", "Automatisch", "Automatic"), opt("stacked", "Onder elkaar", "Stacked"), opt("wide", "Naast elkaar", "Side by side")] } },
              },
            ],
          },
          {
            name: "temp_step",
            selector: {
              select: {
                mode: "dropdown",
                options: [opt("", "Van de airco", "From the airco"), opt("0.1", "0,1°", "0.1°"), opt("0.5", "0,5°", "0.5°"), opt("1", "1°", "1°")],
              },
            },
          },
          {
            name: "mode_style",
            selector: {
              select: {
                mode: "list",
                options: [opt("bar", "Als balk onder de ring", "As a bar below the ring"), opt("ring", "Rond de ring, zoals in de app", "Round the ring, like the app")],
              },
            },
          },
          {
            type: "expandable",
            name: "",
            flatten: true,
            title: T("Onderdelen", "Sections"),
            icon: "mdi:view-dashboard-edit-outline",
            schema: [
              {
                name: "hide",
                selector: {
                  select: {
                    multiple: true,
                    mode: "list",
                    options: [
                      opt("modes", "Modusbalk", "Mode bar"),
                      opt("controls", "Ventilator en lamellen", "Fan and louvres"),
                      opt("toggles", "3D Auto en Leegstaand", "3D Auto and Vacant"),
                      opt("favorites", "Favorieten", "Favourites"),
                      opt("timers", "Timers", "Timers"),
                      opt("energy", "Energieverbruik", "Energy usage"),
                      opt("outdoor", "Buitentemperatuur", "Outdoor temperature"),
                    ],
                  },
                },
              },
              {
                name: "collapsible",
                selector: {
                  select: {
                    multiple: true,
                    mode: "list",
                    options: [
                      opt("controls", "Ventilator en lamellen", "Fan and louvres"),
                      opt("toggles", "3D Auto en Leegstaand", "3D Auto and Vacant"),
                      opt("favorites", "Favorieten", "Favourites"),
                    ],
                  },
                },
              },
              { name: "outdoor_sensor", selector: { entity: { domain: "sensor", device_class: "temperature" } } },
            ],
          },
          { type: "expandable", name: "favorite_1", title: T("Favoriet 1", "Favourite 1"), icon: "mdi:heart-outline", schema: favSchema },
          { type: "expandable", name: "favorite_2", title: T("Favoriet 2", "Favourite 2"), icon: "mdi:heart-outline", schema: favSchema },
          {
            type: "expandable",
            name: "",
            flatten: true,
            title: T("Timerknoppen", "Timer buttons"),
            icon: "mdi:timer-outline",
            schema: [
              { name: "off_presets", selector: { text: {} } },
              { name: "sleep_presets", selector: { text: {} } },
            ],
          },
        ],
        computeLabel: (s) => labels[s.name],
        computeHelper: (s) => helpers[s.name],
      };
    }

    setConfig(config) {
      if (!config || !config.entity) throw new Error("Kies een airco (climate-entity) / pick a climate entity");
      this._config = { theme: "auto", layout: "auto", mode_style: "bar", ...config };
      const extra = Array.isArray(config.entities) ? config.entities : config.entities ? [config.entities] : [];
      this._list = [config.entity, ...extra.filter((e) => e && e !== config.entity)];
      this._list = this._list.filter((e, i) => this._list.indexOf(e) === i);
      this._sel = 0;
      try {
        const saved = localStorage.getItem(`airco-commander:tab:${config.entity}`);
        if (saved && this._list.includes(saved)) this._sel = this._list.indexOf(saved);
      } catch (e) {
        /* no storage: start on the first airco */
      }
      this._els = null;
      this._cache = {};
      if (this._hass) this._render();
    }

    set hass(hass) {
      const prev = this._hass;
      this._hass = hass;
      if (!this._config) return;
      if (!this._els) {
        this._render();
        return;
      }
      const ids = this._watchedIds();
      if (!prev || ids.some((id) => prev.states[id] !== hass.states[id]) || prev.themes?.darkMode !== hass.themes?.darkMode) {
        this._update();
      }
    }

    get hass() {
      return this._hass;
    }

    _eid() {
      return (this._list && this._list[this._sel]) || this._config.entity;
    }

    getCardSize() {
      return 10;
    }

    getGridOptions() {
      return { columns: 12, min_columns: 6, rows: "auto" };
    }

    connectedCallback() {
      ensureFonts();
      if (!this._ro && window.ResizeObserver) {
        this._ro = new ResizeObserver(() => this._applyLayout());
        this._ro.observe(this);
      }
      clearInterval(this._tick);
      this._tick = setInterval(() => this._updateCountdowns(), 1000);
    }

    disconnectedCallback() {
      clearInterval(this._tick);
      if (this._ro) {
        this._ro.disconnect();
        this._ro = null;
      }
    }

    _applyLayout() {
      if (!this._els) return;
      const layout = this._config.layout || "auto";
      const wide = layout === "wide" || (layout === "auto" && this.clientWidth >= 720);
      this._els.card.classList.toggle("wide", wide);
    }

    // ------------------------------------------------------------- discovery

    _related() {
      const hass = this._hass;
      const climateId = this._eid();
      const out = { climate: climateId, outdoor: null, homeLeave: null, energy: null, sleep: null, nextOff: null, linked: false };
      const entities = hass.entities || {};
      const deviceId = entities[climateId]?.device_id;
      for (const st of Object.values(hass.states)) {
        const a = st.attributes;
        if (a.airco_commander_climate !== climateId) continue;
        if (a.airco_commander_role === "sleep_timer") out.sleep = st.entity_id;
        if (a.airco_commander_role === "next_off") out.nextOff = st.entity_id;
        // The integration's links are the source of truth, including a link
        // that was deliberately cleared there.
        if (!out.linked && "airco_commander_outdoor_sensor" in a) {
          out.linked = true;
          out.outdoor = a.airco_commander_outdoor_sensor || null;
          out.homeLeave = a.airco_commander_home_leave_select || null;
          out.energy = a.airco_commander_energy_sensor || null;
        }
      }
      if (!out.linked && deviceId) {
        // Card used without the integration: look on the airco's own device.
        for (const e of Object.values(entities)) {
          if (e.device_id !== deviceId) continue;
          if (e.translation_key === "outdoor") out.outdoor = e.entity_id;
          if (e.translation_key === "home_leave_mode" && e.entity_id.startsWith("select.")) out.homeLeave = e.entity_id;
          if (e.translation_key === "energy_usage_total") out.energy = e.entity_id;
        }
      }
      if (this._config.outdoor_sensor) out.outdoor = this._config.outdoor_sensor;
      this._rel = out;
      return out;
    }

    _watchedIds() {
      const r = this._rel || this._related();
      return [...(this._list || []), r.outdoor, r.homeLeave, r.energy, r.sleep, r.nextOff].filter(Boolean);
    }

    // ------------------------------------------------------------ optimistic

    _value(key, actual) {
      const o = this._optimistic[key];
      if (!o) return actual;
      if (Date.now() > o.until || o.value === actual) {
        delete this._optimistic[key];
        return actual;
      }
      return o.value;
    }

    _setOptimistic(key, value) {
      this._optimistic[key] = { value, until: Date.now() + OPTIMISTIC_MS };
    }

    _sendLater(key, fn, delay = SEND_DELAY_MS) {
      clearTimeout(this._sendTimers[key]);
      this._sendTimers[key] = setTimeout(() => {
        delete this._sendTimers[key];
        fn();
      }, delay);
    }

    async _call(domain, service, data) {
      try {
        await this._hass.callService(domain, service, data);
      } catch (err) {
        this._toast(`${lang(this._hass).failed}: ${err?.message || err}`);
        this._optimistic = {};
        this._update();
      }
    }

    _toast(message) {
      this.dispatchEvent(new CustomEvent("hass-notification", { detail: { message }, bubbles: true, composed: true }));
    }

    // ---------------------------------------------------------------- render

    _render() {
      ensureFonts();
      const tx = lang(this._hass);
      const cfg = this._config;
      const offPresets = parseList(cfg.off_presets, ["22:00", "23:00"]).slice(0, 3);
      const sleepPresets = parseList(cfg.sleep_presets, [60, 90]).map(Number).filter((n) => n > 0).slice(0, 3);

      const ticks = [];
      for (let i = 0; i <= 28; i++) {
        const deg = START_DEG + (SWEEP * i) / 28;
        const major = i % 4 === 0;
        const [x1, y1] = polar(deg, R - 17);
        const [x2, y2] = polar(deg, R - (major ? 24 : 21));
        ticks.push(`<line class="tick${major ? " major" : ""}" data-t="${i / 28}" x1="${x1.toFixed(2)}" y1="${y1.toFixed(2)}" x2="${x2.toFixed(2)}" y2="${y2.toFixed(2)}" />`);
      }

      const pillRow = (key, iconName, title) => `
        <div class="row" data-row="${key}">
          <div class="row-label" data-action="pick" data-key="${key}">
            <span class="badge" data-badge="${key}">${icon(iconName)}</span>
            <div style="min-width:0"><div class="row-title">${escapeHtml(title)}</div><div class="row-sub" data-sub="${key}"></div></div>
          </div>
          <div class="pill">
            <button class="pill-arrow" data-action="step" data-key="${key}" data-dir="-1" aria-label="-">${icon("caret-left")}</button>
            <button class="pill-content" data-action="pick" data-key="${key}" data-pill="${key}"></button>
            <button class="pill-arrow" data-action="step" data-key="${key}" data-dir="1" aria-label="+">${icon("caret-right")}</button>
          </div>
        </div>`;

      const tile = (action, iconName, title, cls = "") => `
        <button class="tile ${cls}" data-action="${action}" data-tile="${action}">
          <span class="badge">${icon(iconName)}</span>
          <span class="txt"><div class="row-title">${escapeHtml(title)}</div><div class="row-sub" data-sub="${action}"></div></span>
        </button>`;

      const secHead = (sec, iconName, title) => `
        <button class="panel sec-head" data-action="toggleSection" data-sec="${sec}" data-el="head_${sec}" hidden>
          <span class="badge">${icon(iconName)}</span>
          <span class="grow"><div class="row-title">${escapeHtml(title)}</div><div class="row-sub" data-el="sum_${sec}"></div></span>
          <span class="caret">${icon("caret-down")}</span>
        </button>`;

      const favTile = (n) => `
        <button class="tile fav" data-action="favorite" data-fav="${n}">
          <span class="badge">${icon("heart")}</span>
          <span class="txt"><div class="row-title" data-favname="${n}"></div><div class="row-sub" data-favsum="${n}"></div></span>
        </button>`;

      this.shadowRoot.innerHTML = `
        <style>${STYLES}</style>
        <ha-card>
          <div class="overlay"><span data-el="overlayText"></span></div>
          <nav class="tabs" data-el="tabs" hidden></nav>
          <div class="layout">
            <section class="main" style="display:grid;gap:14px">
              <header class="head">
                <div class="titles">
                  <div class="eyebrow" data-el="eyebrow">${icon("sun-horizon")}<span data-el="outside"></span></div>
                  <div class="room" data-el="title"></div>
                  <div class="chips">
                    <span class="chip" data-el="actionChip"><span data-el="actionIcon"></span><span data-el="actionText"></span></span>
                    <span class="chip" data-el="energyChip">${icon("lightning")}<span data-el="energyText"></span></span>
                    <button class="chip tchip" data-action="openTimers" data-el="sleepChip">${icon("moon-stars")}<span data-el="sleepChipText"></span></button>
                    <button class="chip tchip" data-action="openTimers" data-el="offChip">${icon("alarm")}<span data-el="offChipText"></span></button>
                  </div>
                </div>
                <button class="power" data-action="power" data-el="power">${icon("power")}</button>
              </header>

              <div class="dial" data-el="dial">
                <svg viewBox="0 0 240 216" data-el="svg">
                  <defs>
                    <linearGradient id="ac-grad" x1="0" y1="1" x2="1" y2="0">
                      <stop offset="0" stop-color="var(--mode-a)" />
                      <stop offset="1" stop-color="var(--mode-b)" />
                    </linearGradient>
                  </defs>
                  <path class="track" d="${ARC_PATH}" />
                  ${ticks.join("")}
                  <path class="progress" data-el="progress" d="${ARC_PATH}" stroke-dasharray="0 ${ARC_LEN}" />
                  <text class="scale-label" data-el="minLabel" x="${(AX - 2).toFixed(1)}" y="${(AY + 20).toFixed(1)}" text-anchor="middle"></text>
                  <text class="scale-label" data-el="maxLabel" x="${(BX + 2).toFixed(1)}" y="${(BY + 20).toFixed(1)}" text-anchor="middle"></text>
                  <path class="current-mark" data-el="currentMark" d="M 0 -6 L 5 2 L -5 2 Z" />
                  <path class="hit" data-el="hit" d="${ARC_PATH}" />
                  <g class="knob" data-el="knob">
                    <circle class="knob-outer" r="13" />
                    <circle class="knob-inner" r="6" />
                  </g>
                </svg>
                <div class="dial-center">
                  <div class="target-label" data-el="targetLabel"></div>
                  <button class="big" data-el="big" data-action="pick" data-key="temp"><span class="int" data-el="int"></span><span class="dec" data-el="dec"></span><span class="deg">°</span></button>
                  <div class="inside">${icon("thermometer-simple")}<span data-el="inside"></span></div>
                </div>
                <div class="ring-modes">
                  ${RING_SLOTS.map((m) => {
                    const [x, y] = polar(m.deg, RING_R);
                    return `<button class="rmode" data-action="mode" data-slot="${m.slot}" data-side="${m.side}" style="left:${((x / 240) * 100).toFixed(2)}%;top:${((y / 216) * 100).toFixed(2)}%">${icon(MODE_ICON[m.slot])}<span></span></button>`;
                  }).join("")}
                </div>
                <div class="steps">
                  <div class="pair">
                    <button class="step coarse" data-action="temp" data-dir="-1" data-coarse="1" aria-label="-1°" hidden>−1°</button>
                    <button class="step" data-action="temp" data-dir="-1" aria-label="-"><svg viewBox="0 0 16 16"><path d="M3 8h10" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg></button>
                  </div>
                  <div class="pair">
                    <button class="step" data-action="temp" data-dir="1" aria-label="+"><svg viewBox="0 0 16 16"><path d="M3 8h10M8 3v10" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg></button>
                    <button class="step coarse" data-action="temp" data-dir="1" data-coarse="1" aria-label="+1°" hidden>+1°</button>
                  </div>
                </div>
              </div>

              <nav class="modes" data-el="modes">
                ${MODE_ORDER.map(
                  (m) => `<button class="mode" data-action="mode" data-slot="${m}">${icon(MODE_ICON[m])}<span></span></button>`
                ).join("")}
              </nav>
            </section>

            <section class="side">
              ${secHead("controls", "fan", tx.secControls)}
              <div class="panel" data-el="controls">
                ${pillRow("fan", "fan", tx.fanLabel)}
                ${pillRow("vertical", "arrows-down-up", tx.vertical)}
                ${pillRow("horizontal", "arrows-left-right", tx.horizontal)}
              </div>
              ${secHead("toggles", "cube-focus", tx.secToggles)}
              <div class="tiles" data-el="toggleTiles">
                ${tile("auto3d", "cube-focus", tx.auto3d)}
                ${tile("vacant", "suitcase-rolling", tx.vacant)}
              </div>
              ${secHead("favorites", "heart", tx.secFavorites)}
              <div class="tiles" data-el="favTiles">${favTile(1)}${favTile(2)}</div>

              <div class="panel timers" data-el="timers">
                <button class="timers-head" data-action="toggleTimers">
                  <span class="badge">${icon("alarm")}</span>
                  <span class="grow"><div class="row-title">${escapeHtml(tx.timers)}</div><div class="row-sub" data-el="timersSummary"></div></span>
                  <span class="caret">${icon("caret-down")}</span>
                </button>
                <div class="timers-body">
                  <div class="timer">
                    <div class="timer-top">
                      <span class="timer-title">${icon("alarm")}${escapeHtml(tx.offTimer)}</span>
                      <span class="readout" data-el="offReadout">0:00:00</span>
                    </div>
                    <div class="timer-row">
                      <input type="time" class="timer-input" data-action="offInput" value="22:00">
                      ${offPresets.map((p) => `<button class="preset" data-action="offPreset" data-value="${escapeHtml(p)}">${escapeHtml(p)}</button>`).join("")}
                      <button class="preset stop" data-action="offStop">${escapeHtml(tx.stop)}</button>
                    </div>
                  </div>
                  <div class="timer">
                    <div class="timer-top">
                      <span class="timer-title">${icon("moon-stars")}${escapeHtml(tx.sleepTimer)}</span>
                      <span class="readout" data-el="sleepReadout">0:00:00</span>
                    </div>
                    <div class="timer-row">
                      <input type="time" class="timer-input" data-action="sleepInput" value="01:00">
                      ${sleepPresets.map((m) => `<button class="preset" data-action="sleepPreset" data-value="${m}">${escapeHtml(tx.hours(m))}</button>`).join("")}
                      <button class="preset stop" data-action="sleepStop">${escapeHtml(tx.stop)}</button>
                    </div>
                  </div>
                </div>
              </div>
              <div class="hint" data-el="noTimers" hidden>${escapeHtml(tx.noTimers)}</div>
            </section>
          </div>
          <div class="sheet-wrap" data-el="sheetWrap" hidden>
            <div class="sheet-backdrop" data-action="closeSheet"></div>
            <div class="sheet" role="dialog" aria-modal="true">
              <div class="sheet-head"><span class="sheet-title" data-el="sheetTitle"></span><button class="sheet-close" data-action="closeSheet" aria-label="sluiten">${icon("x")}</button></div>
              <div class="sheet-grid" data-el="sheetGrid"></div>
            </div>
          </div>
        </ha-card>
      `;

      const root = this.shadowRoot;
      const els = {};
      root.querySelectorAll("[data-el]").forEach((el) => (els[el.dataset.el] = el));
      els.card = root.querySelector("ha-card");
      els.ticks = root.querySelectorAll(".tick");
      els.modeBtns = root.querySelectorAll('[data-action="mode"]');
      els.pills = {};
      root.querySelectorAll("[data-pill]").forEach((el) => (els.pills[el.dataset.pill] = el));
      els.subs = {};
      root.querySelectorAll("[data-sub]").forEach((el) => (els.subs[el.dataset.sub] = el));
      els.rows = {};
      root.querySelectorAll("[data-row]").forEach((el) => (els.rows[el.dataset.row] = el));
      els.badges = {};
      root.querySelectorAll("[data-badge]").forEach((el) => (els.badges[el.dataset.badge] = el));
      els.tiles = {};
      root.querySelectorAll("[data-tile]").forEach((el) => (els.tiles[el.dataset.tile] = el));
      els.favs = root.querySelectorAll(".fav");
      els.offInput = root.querySelector('[data-action="offInput"]');
      els.sleepInput = root.querySelector('[data-action="sleepInput"]');
      els.offPresets = root.querySelectorAll('[data-action="offPreset"]');
      els.sleepPresets = root.querySelectorAll('[data-action="sleepPreset"]');
      els.offStop = root.querySelector('[data-action="offStop"]');
      els.sleepStop = root.querySelector('[data-action="sleepStop"]');
      this._els = els;

      this._attachDrag();
      this._applyLayout();
      this._related();
      this._update();
    }

    // ------------------------------------------------------------------ drag

    _attachDrag() {
      const { svg, hit, knob } = this._els;
      const start = (ev) => {
        const st = this._hass?.states[this._eid()];
        if (!st || st.state === "unavailable") return;
        if (!this._onArc(ev)) return;
        ev.preventDefault();
        this._dragging = true;
        this._els.card.classList.add("dragging");
        try {
          ev.target.setPointerCapture(ev.pointerId);
        } catch (e) {
          /* not all targets support capture */
        }
        this._dragTo(ev);
      };
      const move = (ev) => {
        if (!this._dragging) return;
        ev.preventDefault();
        this._dragTo(ev);
      };
      const end = () => {
        if (!this._dragging) return;
        this._dragging = false;
        this._els.card.classList.remove("dragging");
        const value = this._optimistic.temp?.value;
        if (typeof value === "number") {
          this._sendLater("temp", () => this._call("climate", "set_temperature", { entity_id: this._eid(), temperature: value }), 250);
        }
      };
      for (const el of [hit, knob]) {
        el.addEventListener("pointerdown", start);
        el.addEventListener("pointermove", move);
        el.addEventListener("pointerup", end);
        el.addEventListener("pointercancel", end);
      }
      svg.addEventListener("pointermove", move);
    }

    _arcPos(ev) {
      const rect = this._els.svg.getBoundingClientRect();
      const x = ((ev.clientX - rect.left) / rect.width) * 240;
      const y = ((ev.clientY - rect.top) / rect.height) * 216;
      const deg = (Math.atan2(y - CY, x - CX) * 180) / Math.PI;
      return { rel: (deg - START_DEG + 720) % 360, dist: Math.hypot(x - CX, y - CY) };
    }

    // A press counts as a drag only on the arc itself - never in the open
    // gap at the bottom where the - and + buttons sit.
    _onArc(ev) {
      const { rel, dist } = this._arcPos(ev);
      return rel <= SWEEP && dist > R - 28 && dist < R + 26;
    }

    _step(a) {
      const own = Number(this._config.temp_step);
      return own > 0 ? own : a.target_temp_step || 0.5;
    }

    _dragTo(ev) {
      const st = this._hass.states[this._eid()];
      const a = st.attributes;
      const { rel } = this._arcPos(ev);
      // In the gap: keep the last value instead of jumping to 16 or 30.
      if (rel > SWEEP) return;
      const { min, max } = this._range(a);
      const step = this._step(a);
      const value = Number((Math.round((min + (rel / SWEEP) * (max - min)) / step) * step).toFixed(2));
      if (this._optimistic.temp?.value !== value) {
        this._setOptimistic("temp", value);
        this._update();
      }
    }

    _range(a) {
      return {
        min: typeof a.min_temp === "number" ? a.min_temp : 16,
        max: typeof a.max_temp === "number" ? a.max_temp : 30,
      };
    }

    // ---------------------------------------------------------------- update

    _update() {
      const hass = this._hass;
      const els = this._els;
      if (!hass || !els) return;
      const tx = lang(hass);
      const rel = this._related();
      const st = hass.states[rel.climate];

      const dark = this._config.theme === "dark" || (this._config.theme !== "light" && !!hass.themes?.darkMode);
      this.classList.toggle("dark", dark);

      if (!st) {
        els.card.classList.add("unavailable");
        els.overlayText.textContent = tx.notFound(rel.climate);
        return;
      }
      const a = st.attributes;
      els.card.classList.toggle("unavailable", st.state === "unavailable" || st.state === "unknown");
      els.overlayText.textContent = tx.unavailable;

      const hvac = this._value("hvac", st.state);
      const isOff = hvac === "off";
      const action = isOff ? "" : a.hvac_action || "";
      this.dataset.mode = isOff ? "off" : hvac;
      els.card.classList.toggle("is-off", isOff);
      els.card.classList.toggle("running", ["heating", "cooling", "drying", "preheating"].includes(action));
      els.power.classList.toggle("on", !isOff);
      els.power.setAttribute("aria-label", isOff ? tx.powerOn : tx.powerOff);

      // Header
      els.title.textContent = (this._sel === 0 && this._config.name) || a.friendly_name || rel.climate;
      this._renderTabs(hass, tx);
      const out = rel.outdoor ? hass.states[rel.outdoor] : null;
      const outVal = out ? parseFloat(out.state) : NaN;
      els.eyebrow.hidden = !isFinite(outVal);
      els.outside.textContent = isFinite(outVal) ? `${tx.outside} ${num(outVal, hass)}°` : "";
      const en = rel.energy ? hass.states[rel.energy] : null;
      const enVal = en ? parseFloat(en.state) : NaN;
      els.energyChip.hidden = !isFinite(enVal);
      els.energyText.textContent = isFinite(enVal) ? `${num(enVal, hass, enVal >= 100 ? 0 : 2)} kWh` : "";
      els.actionChip.hidden = !action || action === "off";
      if (action) {
        const iconHtml = icon(ACTION_ICON[action] || "fan");
        if (this._cache.actionIcon !== iconHtml) {
          els.actionIcon.innerHTML = iconHtml;
          this._cache.actionIcon = iconHtml;
        }
        els.actionText.textContent = label(tx.actions, action);
        els.actionChip.classList.toggle("spin", action === "fan");
      }

      // Modes
      const supported = a.hvac_modes || [];
      const autoKey = supported.includes("auto") ? "auto" : supported.includes("heat_cool") ? "heat_cool" : "auto";
      let shown = 0;
      els.card.classList.toggle("mode-ring", this._config.mode_style === "ring");
      els.modeBtns.forEach((btn) => {
        const key = btn.dataset.slot === "auto" ? autoKey : btn.dataset.slot;
        btn.dataset.mode = key;
        btn.hidden = !supported.includes(key);
        if (!btn.hidden && btn.classList.contains("mode")) shown++;
        btn.classList.toggle("active", !isOff && hvac === key);
        btn.querySelector("span").textContent = label(tx.modes, key);
      });
      els.modes.style.setProperty("--mode-count", String(Math.max(shown, 1)));

      // Dial
      const { min, max } = this._range(a);
      const target = this._value("temp", a.temperature);
      const current = a.current_temperature;
      els.minLabel.textContent = `${Math.round(min)}°`;
      els.maxLabel.textContent = `${Math.round(max)}°`;
      els.targetLabel.textContent = label(tx.targetLabel, isOff ? "off" : hvac);
      if (typeof target === "number") {
        const [i, d] = target.toFixed(1).split(".");
        els.int.textContent = i;
        els.dec.textContent = `${decimalSep(hass)}${d}`;
        const pct = Math.max(0, Math.min(1, (target - min) / (max - min)));
        els.progress.style.strokeDasharray = `${(pct * ARC_LEN).toFixed(1)} ${ARC_LEN.toFixed(1)}`;
        const [kx, ky] = polar(START_DEG + pct * SWEEP);
        els.knob.setAttribute("transform", `translate(${kx.toFixed(2)} ${ky.toFixed(2)})`);
        els.ticks.forEach((t) => t.classList.toggle("on", Number(t.dataset.t) <= pct + 1e-6));
      } else {
        els.int.textContent = "--";
        els.dec.textContent = "";
      }
      els.big.classList.toggle("pending", !!this._optimistic.temp);
      const smallStep = this._step(a) < 0.5;
      els.card.querySelectorAll(".step.coarse").forEach((b) => (b.hidden = !smallStep));
      els.inside.textContent = typeof current === "number" ? `${tx.inside} ${num(current, hass)}°` : "";
      if (typeof current === "number") {
        const cp = Math.max(0, Math.min(1, (current - min) / (max - min)));
        const deg = START_DEG + cp * SWEEP;
        const [mx, my] = polar(deg, R + 15);
        els.currentMark.setAttribute("transform", `translate(${mx.toFixed(2)} ${my.toFixed(2)}) rotate(${(deg - 90).toFixed(1)})`);
        els.currentMark.style.display = "";
      } else {
        els.currentMark.style.display = "none";
      }

      // Fan / louvres
      const fan = this._value("fan", a.fan_mode);
      const v = this._value("vertical", a.swing_mode);
      const h = this._value("horizontal", a.swing_horizontal_mode);
      this._setRow("fan", a.fan_modes, fanGraphic(fan, a.fan_modes, tx), label(tx.fan, fan));
      this._setRow("vertical", a.swing_modes, verticalGraphic(v, tx), label(tx.swing, v));
      this._setRow("horizontal", a.swing_horizontal_modes, horizontalGraphic(h, tx), label(tx.swingH, h));
      const fanLevels = (a.fan_modes || []).filter((m) => m !== "auto");
      const fanIdx = fanLevels.indexOf(fan);
      const spinning = !isOff && action && action !== "idle";
      els.badges.fan.classList.toggle("spin", !!spinning);
      els.badges.fan.style.setProperty("--spin", fanIdx >= 0 ? `${(2.8 - fanIdx * 0.5).toFixed(1)}s` : "1.8s");
      els.controls.hidden = !["fan", "vertical", "horizontal"].some((k) => !els.rows[k].hidden);

      // Toggle tiles
      const has3d = (a.swing_modes || []).includes("3d_auto") || (a.swing_horizontal_modes || []).includes("3d_auto");
      const on3d = v === "3d_auto" || h === "3d_auto";
      els.tiles.auto3d.hidden = !has3d;
      els.tiles.auto3d.classList.toggle("on", on3d);
      els.subs.auto3d.textContent = on3d ? tx.auto3dOn : tx.off;
      const hl = rel.homeLeave ? hass.states[rel.homeLeave] : null;
      els.tiles.vacant.hidden = !hl;
      if (hl) {
        const vac = this._value("vacant", hl.state);
        const on = !!vac && vac !== "off";
        els.tiles.vacant.classList.toggle("on", on);
        els.subs.vacant.textContent = on ? tx.vacantOn(vac === "away_cool" ? "31°" : "10°") : tx.off;
      }
      els.toggleTiles.hidden = els.tiles.auto3d.hidden && els.tiles.vacant.hidden;
      els.toggleTiles.style.gridTemplateColumns = els.tiles.auto3d.hidden || els.tiles.vacant.hidden ? "1fr" : "";

      // Favourites
      els.favTiles.hidden = false;
      els.favTiles.style.display = "";
      [1, 2].forEach((n, i) => {
        const fav = this._config[`favorite_${n}`];
        const configured = this._favConfigured(fav);
        const btn = els.favs[i];
        btn.classList.toggle("empty", !configured);
        btn.classList.toggle("on", configured && this._favMatches(fav, st));
        btn.querySelector(`[data-favname="${n}"]`).textContent = (fav && fav.name) || tx.favorite(n);
        btn.querySelector(`[data-favsum="${n}"]`).textContent = configured ? this._favSummary(fav, tx) : tx.favoriteHint;
      });

      // Timers
      const hasTimers = !!(rel.sleep || rel.nextOff);
      els.timers.hidden = !hasTimers;
      els.noTimers.hidden = hasTimers;
      els.timers.classList.toggle("open", this._timersOpen);
      if (hasTimers) {
        const next = rel.nextOff ? hass.states[rel.nextOff] : null;
        const offTime = this._value("offTime", next?.attributes.off_time);
        const offEnabled = this._value("offEnabled", !!next?.attributes.enabled);
        if (offTime && this.shadowRoot.activeElement !== els.offInput) els.offInput.value = offTime;
        els.offPresets.forEach((b) => b.classList.toggle("active", offEnabled && b.dataset.value === offTime));
        els.offStop.classList.toggle("idle", !offEnabled);
        els.offChip.hidden = !offEnabled;
        els.offChipText.textContent = offEnabled && offTime ? tx.offChip(offTime) : "";

        const sleep = rel.sleep ? hass.states[rel.sleep] : null;
        const sleepMinutes = sleep?.attributes.duration_minutes;
        const sleepRunning = this._value("sleepRunning", !!(sleep && !["unknown", "unavailable", ""].includes(sleep.state)));
        els.sleepPresets.forEach((b) => b.classList.toggle("active", sleepRunning && Number(b.dataset.value) === sleepMinutes));
        els.sleepStop.classList.toggle("idle", !sleepRunning);
        els.sleepChip.hidden = !sleepRunning;
        if (sleepMinutes && this.shadowRoot.activeElement !== els.sleepInput) els.sleepInput.value = minutesToHHMM(sleepMinutes);
        this._offEnabled = offEnabled;
        this._offTime = offTime;
        this._sleepRunning = sleepRunning;
      } else {
        els.offChip.hidden = true;
        els.sleepChip.hidden = true;
      }

      const collapsible = new Set(Array.isArray(this._config.collapsible) ? this._config.collapsible : []);
      const sections = { controls: els.controls, toggles: els.toggleTiles, favorites: els.favTiles };
      const summaries = {
        controls: [label(tx.fan, fan), label(tx.swing, v), label(tx.swingH, h)].filter((x, i) => x && !els.rows[["fan", "vertical", "horizontal"][i]].hidden).join(" · "),
        toggles: [
          !els.tiles.auto3d.hidden ? `${tx.auto3d} ${on3d ? tx.on.toLowerCase() : tx.off.toLowerCase()}` : "",
          !els.tiles.vacant.hidden ? `${tx.vacant} ${els.tiles.vacant.classList.contains("on") ? tx.on.toLowerCase() : tx.off.toLowerCase()}` : "",
        ].filter(Boolean).join(" · "),
        favorites: [1, 2].map((n) => (this._config[`favorite_${n}`] || {}).name || tx.favorite(n)).join(" · "),
      };
      for (const [sec, el] of Object.entries(sections)) {
        const head = els[`head_${sec}`];
        const available = !el.hidden;
        head.hidden = !collapsible.has(sec) || !available;
        if (head.hidden) continue;
        const open = this._isOpen(sec);
        head.classList.toggle("open", open);
        els[`sum_${sec}`].textContent = summaries[sec];
        if (!open) el.hidden = true;
        if (sec === "favorites") el.style.display = open ? "" : "none";
      }

      const hide = new Set(Array.isArray(this._config.hide) ? this._config.hide : []);
      if (hide.has("controls")) els.head_controls.hidden = true;
      if (hide.has("toggles")) els.head_toggles.hidden = true;
      if (hide.has("favorites")) els.head_favorites.hidden = true;
      if (hide.has("modes")) els.modes.hidden = true;
      if (hide.has("controls")) els.controls.hidden = true;
      if (hide.has("toggles")) els.toggleTiles.hidden = true;
      if (hide.has("favorites")) els.favTiles.hidden = true;
      if (hide.has("timers")) {
        els.timers.hidden = true;
        els.noTimers.hidden = true;
        els.offChip.hidden = true;
        els.sleepChip.hidden = true;
      }
      if (hide.has("energy")) els.energyChip.hidden = true;
      if (hide.has("outdoor")) els.eyebrow.hidden = true;
      els.modes.style.display = hide.has("modes") ? "none" : "";
      if (hide.has("favorites")) els.favTiles.style.display = "none";
      if (this._sheetKey) this._renderSheet();
      this._updateCountdowns();
    }

    _setRow(key, options, graphic, caption) {
      const row = this._els.rows[key];
      row.hidden = !(Array.isArray(options) && options.length);
      if (row.hidden) return;
      if (this._cache[key] !== graphic) {
        this._els.pills[key].innerHTML = graphic;
        this._cache[key] = graphic;
      }
      this._els.pills[key].title = caption;
      this._els.subs[key].textContent = caption;
    }

    _favConfigured(fav) {
      return !!fav && ["hvac_mode", "temperature", "fan_mode", "swing_mode", "swing_horizontal_mode"].some((k) => fav[k] !== undefined && fav[k] !== null && fav[k] !== "");
    }

    _favSummary(fav, tx) {
      const parts = [];
      if (fav.hvac_mode) parts.push(label(tx.modes, fav.hvac_mode));
      if (fav.temperature !== undefined && fav.temperature !== "") parts.push(`${num(Number(fav.temperature), this._hass)}°`);
      if (fav.fan_mode) parts.push(label(tx.fan, fav.fan_mode).toLowerCase());
      return parts.join(" · ");
    }

    _favMatches(fav, st) {
      const a = st.attributes;
      const checks = [
        ["hvac_mode", st.state],
        ["temperature", a.temperature],
        ["fan_mode", a.fan_mode],
        ["swing_mode", a.swing_mode],
        ["swing_horizontal_mode", a.swing_horizontal_mode],
      ];
      for (const [k, actual] of checks) {
        if (fav[k] === undefined || fav[k] === "" || fav[k] === null) continue;
        if (k === "temperature" ? Number(fav[k]) !== actual : fav[k] !== actual) return false;
      }
      return true;
    }

    _updateCountdowns() {
      const els = this._els;
      const hass = this._hass;
      if (!els || !hass || !this._rel) return;
      const tx = lang(hass);
      const now = Date.now();
      const remaining = (entityId) => {
        const s = entityId ? hass.states[entityId] : null;
        const end = s && !["unknown", "unavailable", ""].includes(s.state) ? Date.parse(s.state) : NaN;
        return isFinite(end) && end > now ? end - now : 0;
      };
      const offMs = remaining(this._rel.nextOff);
      const sleepMs = remaining(this._rel.sleep);
      els.offReadout.textContent = formatCountdown(offMs);
      els.offReadout.classList.toggle("running", offMs > 0);
      els.sleepReadout.textContent = formatCountdown(sleepMs);
      els.sleepReadout.classList.toggle("running", sleepMs > 0);
      els.sleepChipText.textContent = formatCountdown(sleepMs);
      const parts = [];
      if (sleepMs > 0) parts.push(`${tx.sleepTimer} ${formatCountdown(sleepMs)}`);
      if (offMs > 0 && this._offTime) parts.push(tx.offChip(this._offTime));
      els.timersSummary.textContent = parts.length ? parts.join(" · ") : tx.timersNone;
    }

    // --------------------------------------------------------------- actions

    _onClick(ev) {
      const target = ev.composedPath().find((el) => el.dataset && el.dataset.action);
      if (!target) return;
      const action = target.dataset.action;
      if (action === "toggleTimers" || action === "openTimers") {
        this._timersOpen = action === "openTimers" ? true : !this._timersOpen;
        this._els.timers.classList.toggle("open", this._timersOpen);
        if (action === "openTimers") this._els.timers.scrollIntoView({ behavior: "smooth", block: "nearest" });
        return;
      }
      if (action === "tab") {
        this._sel = Number(target.dataset.idx);
        try {
          localStorage.setItem(`airco-commander:tab:${this._config.entity}`, this._eid());
        } catch (e) {
          /* not remembered */
        }
        this._optimistic = {};
        this._cache = {};
        this._closeSheet();
        this._update();
        return;
      }
      if (action === "allOff") {
        const tx = lang(this._hass);
        for (const id of this._list) {
          const st = this._hass.states[id];
          if (st && !["off", "unavailable", "unknown"].includes(st.state)) {
            if (id === this._eid()) this._setOptimistic("hvac", "off");
            this._call("climate", "turn_off", { entity_id: id });
          }
        }
        this._toast(tx.allOffDone);
        this._update();
        return;
      }
      if (action === "toggleSection") {
        const sec = target.dataset.sec;
        this._setOpen(sec, !this._isOpen(sec));
        this._update();
        return;
      }
      if (action === "closeSheet") {
        this._closeSheet();
        return;
      }
      if (action === "pick") {
        this._openSheet(target.dataset.key);
        return;
      }
      const st = this._hass.states[this._eid()];
      if (!st) return;
      const entity_id = this._eid();
      const a = st.attributes;

      switch (action) {
        case "choose": {
          const key = target.dataset.key;
          if (key === "temp") {
            const value = Number(target.dataset.value);
            this._setOptimistic("temp", value);
            this._call("climate", "set_temperature", { entity_id, temperature: value });
          } else {
            const [, attr, service] = SHEET_KEYS[key];
            const value = target.dataset.value;
            this._setOptimistic(key, value);
            this._call("climate", service, { entity_id, [attr]: value });
          }
          this._closeSheet();
          this._update();
          break;
        }
        case "power": {
          const turnOn = this._value("hvac", st.state) === "off";
          if (!turnOn) this._setOptimistic("hvac", "off");
          else delete this._optimistic.hvac;
          this._update();
          this._call("climate", turnOn ? "turn_on" : "turn_off", { entity_id });
          break;
        }
        case "mode": {
          const mode = target.dataset.mode;
          if (!mode) return;
          this._setOptimistic("hvac", mode);
          this._update();
          this._call("climate", "set_hvac_mode", { entity_id, hvac_mode: mode });
          break;
        }
        case "temp": {
          const fine = this._step(a);
          const step = target.dataset.coarse ? Math.max(1, fine) : fine;
          const { min, max } = this._range(a);
          const base = this._value("temp", a.temperature);
          const startVal = typeof base === "number" ? base : min;
          const raw = Math.max(min, Math.min(max, startVal + Number(target.dataset.dir) * step));
          const next = Number((Math.round(raw / fine) * fine).toFixed(2));
          this._setOptimistic("temp", next);
          this._update();
          this._sendLater("temp", () => this._call("climate", "set_temperature", { entity_id, temperature: next }));
          break;
        }
        case "step": {
          const key = target.dataset.key;
          const map = {
            fan: ["fan_modes", "fan_mode", "set_fan_mode"],
            vertical: ["swing_modes", "swing_mode", "set_swing_mode"],
            horizontal: ["swing_horizontal_modes", "swing_horizontal_mode", "set_swing_horizontal_mode"],
          }[key];
          const options = a[map[0]] || [];
          if (!options.length) return;
          const current = this._value(key, a[map[1]]);
          const next = options[(options.indexOf(current) + Number(target.dataset.dir) + options.length) % options.length];
          this._setOptimistic(key, next);
          this._update();
          this._sendLater(key, () => this._call("climate", map[2], { entity_id, [map[1]]: next }));
          break;
        }
        case "auto3d": {
          const v = this._value("vertical", a.swing_mode);
          const h = this._value("horizontal", a.swing_horizontal_mode);
          const on = !(v === "3d_auto" || h === "3d_auto");
          const nv = on ? "3d_auto" : (a.swing_modes || []).find((m) => m !== "3d_auto") || "up_down_auto";
          const nh = on ? "3d_auto" : (a.swing_horizontal_modes || []).find((m) => m !== "3d_auto") || "left_right_auto";
          const hasH = (a.swing_horizontal_modes || []).length > 0;
          this._setOptimistic("vertical", nv);
          if (hasH) this._setOptimistic("horizontal", nh);
          this._update();
          (async () => {
            await this._call("climate", "set_swing_mode", { entity_id, swing_mode: nv });
            if (hasH) await this._call("climate", "set_swing_horizontal_mode", { entity_id, swing_horizontal_mode: nh });
          })();
          break;
        }
        case "vacant": {
          const sel = this._rel.homeLeave;
          const hl = sel ? this._hass.states[sel] : null;
          if (!hl) return;
          const current = this._value("vacant", hl.state);
          const option = current && current !== "off" ? "off" : st.state === "cool" ? "away_cool" : "away_heat";
          this._setOptimistic("vacant", option);
          this._update();
          this._call("select", "select_option", { entity_id: sel, option });
          break;
        }
        case "favorite":
          this._applyFavorite(Number(target.dataset.fav), st);
          break;
        case "offPreset":
          this._setOffTimer(target.dataset.value, true);
          break;
        case "offStop":
          this._setOffTimer(null, false);
          break;
        case "sleepPreset":
          this._startSleep(Number(target.dataset.value));
          break;
        case "sleepStop":
          this._setOptimistic("sleepRunning", false);
          this._update();
          this._call(DOMAIN, "cancel_sleep_timer", { entity_id });
          break;
        default:
          break;
      }
    }

    _onChange(ev) {
      const target = ev.composedPath().find((el) => el.dataset && el.dataset.action);
      if (!target) return;
      if (target.dataset.action === "offInput" && target.value) this._setOffTimer(target.value, true);
      if (target.dataset.action === "sleepInput") {
        const [hh, mm] = (target.value || "").split(":").map(Number);
        const minutes = (hh || 0) * 60 + (mm || 0);
        if (minutes > 0) this._startSleep(minutes);
      }
    }

    _renderTabs(hass, tx) {
      const els = this._els;
      if (!this._list || this._list.length < 2) {
        els.tabs.hidden = true;
        return;
      }
      const DOT = { heat: "#ff6a3d", cool: "#2f86ff", auto: "#8a6cff", heat_cool: "#8a6cff", dry: "#14a6a0", fan_only: "#5f7aa3" };
      let anyOn = false;
      const tabs = this._list.map((id, i) => {
        const st = hass.states[id];
        const state = i === this._sel ? this._value("hvac", st?.state) : st?.state;
        const on = !!st && !["off", "unavailable", "unknown"].includes(state);
        if (on) anyOn = true;
        let name = (i === 0 && this._config.name) || st?.attributes.friendly_name || id;
        name = name.replace(/^(airco|ac|aircon|air conditioner)\s+/i, "");
        const cur = st?.attributes.current_temperature;
        const temp = typeof cur === "number" ? `${num(cur, hass)}°` : "";
        return `<button class="tab${i === this._sel ? " active" : ""}" data-action="tab" data-idx="${i}" title="${escapeHtml(id)}">
          <i class="dot" style="--dot:${on ? DOT[state] || "var(--accent)" : "var(--dim)"}"></i>
          <span>${escapeHtml(name)}</span><span class="ttemp">${temp}</span></button>`;
      });
      if (anyOn) tabs.push(`<button class="tab alloff" data-action="allOff" title="${escapeHtml(tx.allOff)}" aria-label="${escapeHtml(tx.allOff)}">${icon("power")}</button>`);
      const html = tabs.join("");
      if (this._cache.tabs !== html) {
        els.tabs.innerHTML = html;
        this._cache.tabs = html;
      }
      els.tabs.hidden = false;
    }

    _storeKey(sec) {
      return `airco-commander:${this._eid()}:${sec}`;
    }

    _isOpen(sec) {
      if (sec in this._open) return this._open[sec];
      try {
        this._open[sec] = localStorage.getItem(this._storeKey(sec)) === "1";
      } catch (e) {
        this._open[sec] = false;
      }
      return this._open[sec];
    }

    _setOpen(sec, open) {
      this._open[sec] = open;
      try {
        localStorage.setItem(this._storeKey(sec), open ? "1" : "0");
      } catch (e) {
        /* private mode: remembered for this page only */
      }
    }

    _openSheet(key) {
      const st = this._hass?.states[this._eid()];
      if (!st) return;
      if (key !== "temp" && !(st.attributes[SHEET_KEYS[key][0]] || []).length) return;
      this._sheetKey = key;
      this._renderSheet();
      this._els.sheetWrap.hidden = false;
      const first = this._els.sheetGrid.querySelector(".opt.active") || this._els.sheetGrid.querySelector(".opt");
      if (first) first.focus({ preventScroll: true });
    }

    _closeSheet() {
      this._sheetKey = null;
      if (this._els) this._els.sheetWrap.hidden = true;
    }

    _renderSheet() {
      const key = this._sheetKey;
      const st = this._hass.states[this._eid()];
      if (!key || !st) return;
      const tx = lang(this._hass);
      const a = st.attributes;
      let html = "";
      let cols = 3;
      if (key === "temp") {
        const { min, max } = this._range(a);
        const target = this._value("temp", a.temperature);
        const values = [];
        for (let t = Math.ceil(min); t <= Math.floor(max); t++) values.push(t);
        if (typeof target === "number" && !values.includes(target)) values.push(target);
        values.sort((x, y) => x - y);
        cols = 5;
        html = values
          .map((t) => `<button class="opt temp${t === target ? " active" : ""}" data-action="choose" data-key="temp" data-value="${t}">${num(t, this._hass, t % 1 ? 1 : 0)}°</button>`)
          .join("");
        this._els.sheetTitle.textContent = label(tx.targetLabel, st.state === "off" ? "heat" : st.state);
      } else {
        const [optsAttr, attr] = SHEET_KEYS[key];
        const current = this._value(key, a[attr]);
        const draw = {
          fan: (v) => fanGraphic(v, a.fan_modes, tx),
          vertical: (v) => verticalGraphic(v, tx),
          horizontal: (v) => horizontalGraphic(v, tx),
        }[key];
        const names = { fan: tx.fan, vertical: tx.swing, horizontal: tx.swingH }[key];
        html = (a[optsAttr] || [])
          .map(
            (v) => `<button class="opt${v === current ? " active" : ""}" data-action="choose" data-key="${key}" data-value="${escapeHtml(v)}">
              <span class="g">${draw(v)}</span><span>${escapeHtml(label(names, v))}</span></button>`
          )
          .join("");
        this._els.sheetTitle.textContent = { fan: tx.fanLabel, vertical: tx.vertical, horizontal: tx.horizontal }[key];
      }
      this._els.sheetGrid.style.setProperty("--cols", String(cols));
      this._els.sheetGrid.innerHTML = html;
    }

    _setOffTimer(time, enabled) {
      const data = { entity_id: this._eid(), enabled };
      if (time) {
        data.time = time;
        this._setOptimistic("offTime", time);
      }
      this._setOptimistic("offEnabled", enabled);
      this._update();
      this._call(DOMAIN, "set_off_timer", data);
    }

    _startSleep(minutes) {
      this._setOptimistic("sleepRunning", true);
      this._update();
      this._call(DOMAIN, "start_sleep_timer", { entity_id: this._eid(), duration: minutes });
    }

    async _applyFavorite(n, st) {
      const tx = lang(this._hass);
      const fav = this._config[`favorite_${n}`];
      if (!this._favConfigured(fav)) {
        this._toast(tx.favoriteEmpty);
        return;
      }
      const set = (k) => fav[k] !== undefined && fav[k] !== null && fav[k] !== "";
      const entity_id = this._eid();
      const a = st.attributes;
      if (set("hvac_mode") && fav.hvac_mode === "off") {
        await this._call("climate", "turn_off", { entity_id });
      } else {
        const data = { entity_id };
        if (set("temperature")) data.temperature = Number(fav.temperature);
        if (set("hvac_mode") && fav.hvac_mode !== st.state) data.hvac_mode = fav.hvac_mode;
        if (data.temperature !== undefined) await this._call("climate", "set_temperature", data);
        else if (data.hvac_mode) await this._call("climate", "set_hvac_mode", { entity_id, hvac_mode: data.hvac_mode });
        if (set("fan_mode") && fav.fan_mode !== a.fan_mode) await this._call("climate", "set_fan_mode", { entity_id, fan_mode: fav.fan_mode });
        if (set("swing_mode") && fav.swing_mode !== a.swing_mode) await this._call("climate", "set_swing_mode", { entity_id, swing_mode: fav.swing_mode });
        if (set("swing_horizontal_mode") && fav.swing_horizontal_mode !== a.swing_horizontal_mode) {
          await this._call("climate", "set_swing_horizontal_mode", { entity_id, swing_horizontal_mode: fav.swing_horizontal_mode });
        }
      }
      this._toast(tx.favoriteApplied(fav.name || tx.favorite(n)));
    }
  }

  defineElement(CARD_TAG, AircoCommanderCard);

  window.customCards = window.customCards || [];
  if (!window.customCards.some((c) => c.type === CARD_TAG)) {
    window.customCards.push({
      type: CARD_TAG,
      name: "Airco Commander",
      description: "Airco-bediening met modusring, lamellen, favorieten en timers.",
      preview: true,
      documentationURL: "https://github.com/jonisnet/ha-airco-commander",
    });
  }
  console.info(`%c AIRCO-COMMANDER %c ${CARD_VERSION} `, "background:#ff5a4e;color:#fff;font-weight:700", "background:#13161c;color:#fff");
})();

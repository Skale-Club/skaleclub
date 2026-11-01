import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ASSETS = join(HERE, "assets");
const OUTPUT = HERE;
const DESIGNCRAFT = "C:\\Program Files\\DesignCraft\\designcraft-cli.exe";

const W = 841.89;
const H = 595.28;
const HALF = W / 2;
const BLEED = 8.504;
const M = 28.35;

const C = {
  navy: "#10151E",
  deep: "#0D121A",
  band: "#141B27",
  card: "#161D28",
  border: "#303846",
  grid: "#1B2431",
  blue: "#5173D6",
  blueDeep: "#294AA5",
  bluePale: "#E9EEFF",
  paper: "#F5F7FB",
  paperCard: "#FFFFFF",
  ink: "#111827",
  body: "#526071",
  rule: "#D9E1EC",
  soft: "#8FA9EE",
  white: "#F3F5F8",
  light: "#E3E7EE",
  muted: "#A7AFBC",
};

const SWATCH = new Map([
  [C.navy, "Skale Navy"],
  [C.deep, "Skale Deep"],
  [C.band, "Skale Band"],
  [C.card, "Skale Card"],
  [C.border, "Skale Border"],
  [C.grid, "Skale Grid"],
  [C.blue, "Skale Blue"],
  [C.blueDeep, "Skale Deep Blue"],
  [C.bluePale, "Skale Pale Blue"],
  [C.paper, "Skale Paper"],
  [C.paperCard, "Skale Paper Card"],
  [C.ink, "Skale Ink"],
  [C.body, "Skale Body"],
  [C.rule, "Skale Rule"],
  [C.soft, "Skale Soft Blue"],
  [C.white, "Skale White"],
  [C.light, "Skale Light"],
  [C.muted, "Skale Muted"],
]);

const apps = [
  { title: "Xkedule", category: "SYSTEMS & BOOKING", price: "$89", label: "/month", headline: "Never miss a booking", image: "xkedule-home.webp" },
  { title: "Xtimator", category: "SYSTEMS & BOOKING", price: "$49", label: "/month", headline: "Send the estimate before you leave the site", image: "xtimator-home.webp" },
  { title: "Xphere", category: "CRM & SALES", price: "$597", label: "one-time", headline: "Every lead followed up automatically", image: "xphere-home.webp" },
  { title: "Xareable", category: "AI & AUTOMATION", price: "$49", label: "/month", headline: "Your social media on autopilot", image: "xareable-home.webp" },
  { title: "Xsites", category: "WEBSITES", price: "$299", label: "starting", headline: "A professional website live in 3 days", image: "xsites-home.webp" },
  { title: "Xcraper", category: "CRM & SALES", price: "$9.90", label: "/month", headline: "Thousands of leads from Google Maps", image: "xcraper-home.webp" },
  { title: "Xpot", category: "CRM & SALES", price: "", label: "", headline: "Every field visit logged and synced", image: "xpot-home.webp" },
  { title: "XmartMenu", category: "SYSTEMS & BOOKING", price: "$29", label: "/month", headline: "Your menu on the customer's phone", image: "xmartmenu-home.webp" },
];

const services = [
  { title: "Digital Marketing Consultation", category: "MARKETING", description: "One-on-one guidance to grow and operate your business.", image: "digital-marketing-consultation.webp" },
  { title: "Website Design & Development", category: "WEBSITES", description: "Custom sites, landing pages, booking, e-commerce and redesigns.", image: "website-design-development.webp" },
  { title: "Paid Advertising", category: "MARKETING", description: "Google, Meta and TikTok ads, retargeting and optimization.", image: "paid-advertising.webp" },
  { title: "Content Creation", category: "MARKETING", description: "Social, video, blog, website, ad and product content.", image: "content-creation.webp" },
  { title: "Branding & Graphic Design", category: "BRANDING", description: "Logos, identity, business cards, templates and banners.", image: "branding-graphic-design.webp" },
  { title: "Lead Generation", category: "CRM & SALES", description: "Lead pages, forms, funnels, appointments and B2B outreach.", image: "lead-generation.webp" },
  { title: "CRM and Marketing Automation", category: "CRM & SALES", description: "Leads, automated messages, reminders, pipelines and AI.", image: "crm-marketing-automation.webp" },
  { title: "3D Printing", category: "BRANDING", description: "Custom parts and branded pieces", image: "3d-printing.webp" },
];

class McpClient {
  constructor() {
    this.child = spawn(DESIGNCRAFT, ["mcp"], { stdio: ["pipe", "pipe", "pipe"] });
    this.nextId = 1;
    this.pending = new Map();
    createInterface({ input: this.child.stdout }).on("line", (line) => {
      let message;
      try { message = JSON.parse(line); } catch { return; }
      if (message.id == null) return;
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(JSON.stringify(message.error)));
      else pending.resolve(message.result);
    });
    this.child.stderr.setEncoding("utf8");
    this.child.stderr.on("data", (chunk) => process.stderr.write(chunk));
  }

  request(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", id, method, params })}\n`);
    });
  }

  notify(method, params = {}) {
    this.child.stdin.write(`${JSON.stringify({ jsonrpc: "2.0", method, params })}\n`);
  }

  async tool(name, args = {}) {
    const result = await this.request("tools/call", { name, arguments: args });
    if (result?.isError) throw new Error(result.content?.map((x) => x.text).join("\n") || `${name} failed`);
    const text = result?.content?.find((x) => x.type === "text")?.text;
    if (!text) return result;
    try { return JSON.parse(text); } catch { return text; }
  }

  async close() {
    this.child.stdin.end();
    await new Promise((resolve) => this.child.once("close", resolve));
  }
}

const client = new McpClient();

async function command(command, params = {}) {
  return client.tool("execute", { command, params });
}

async function shape(spread, rect, fill, { stroke = null, weight = 0.5, radius = 0 } = {}) {
  const made = await command("frame.create", { spread, rect, content: "graphic" });
  await command("object.color", { color: fill, target: "fill", ids: [made.id] });
  if (stroke) {
    await command("object.color", { color: stroke, target: "stroke", ids: [made.id] });
    await command("object.stroke", { weight, align: "inside", ids: [made.id] });
  }
  if (radius) await command("object.cornerOptions", { shape: "rounded", size: radius, ids: [made.id] });
  return made.id;
}

async function text(spread, rect, value, {
  size = 10,
  leading = size * 1.22,
  color = C.white,
  style = "Regular",
  tracking = 0,
  align = "left",
  vj = "top",
  inset = 0,
} = {}) {
  const made = await command("frame.create", { spread, rect, content: "text", text: value });
  await command("object.textFrameOptions", { inset, verticalJustification: vj, ids: [made.id] });
  await command("text.select", { story: made.story, anchor: 0, focus: Buffer.byteLength(value, "utf8") });
  await command("type.char", { attrs: { fontFamily: "Inter", fontStyle: style, size, leading: { kind: "points", value: leading }, tracking, fill: SWATCH.get(color) ?? color } });
  await command("type.para", { attrs: { align, hyphenate: false } });
  return made.id;
}

async function image(spread, rect, file, fitting = "fillProportionally", align = 4) {
  const frame = await command("frame.create", { spread, rect, content: "graphic" });
  await client.tool("place_image", { frame: frame.id, path: join(ASSETS, file) });
  await command("object.fittingOptions", { fitting, align, ids: [frame.id] });
  return frame.id;
}

async function rule(spread, x0, y0, x1, y1, color = C.border) {
  return shape(spread, [x0, y0, x1, y1], color);
}

async function buildOutside() {
  // Back cover: a light editorial product showcase with a high-contrast close.
  await shape(0, [-BLEED, -BLEED, HALF, H + BLEED], C.paper);
  await shape(0, [-BLEED, -BLEED, 10, H + BLEED], C.blue);
  await text(0, [300, 8, 396, 116], "03", { size: 62, leading: 62, style: "Bold", color: C.bluePale, align: "right" });
  await text(0, [32, 28, 280, 43], "03 / PHYSICAL PRODUCTS", { size: 7.2, style: "Bold", tracking: 145, color: C.blue });
  await text(0, [32, 50, 390, 86], "Built for your counter.", { size: 27, leading: 29, style: "ExtraBold", color: C.ink });
  await text(0, [32, 91, 372, 120], "Three custom-made pieces that turn walk-in traffic into reviews, shares and extra sales.", { size: 8.7, leading: 11, color: C.body });

  const products = [
    {
      y: 130,
      image: "nfc-stands-barbershop.webp",
      title: "NFC stands and table plates",
      desc: "Choose a counter stand or a flat table plate. One tap opens Google reviews or Instagram.",
      features: "GOOGLE REVIEWS  /  INSTAGRAM",
    },
    {
      y: 213,
      image: "custom-keychains-barbershop.webp",
      title: "Custom keychains",
      desc: "NFC keychains with your own branding. The tap opens the link you choose.",
      features: "CUSTOM BRANDING  /  YOUR LINK",
    },
    {
      y: 296,
      image: "keychain-display.webp",
      title: "Keychain display",
      desc: "A display for your counter so you can sell the keychains yourself. Extra money for the shop.",
      features: "COUNTER SALES  /  EXTRA REVENUE",
    },
  ];

  for (const p of products) {
    await shape(0, [32, p.y, 389, p.y + 76], C.paperCard, { stroke: C.rule, weight: 0.65, radius: 5 });
    const productImage = await image(0, [33, p.y + 1, 130, p.y + 75], p.image, "fillProportionally");
    await command("object.cornerOptions", { shape: "rounded", size: 4, ids: [productImage] });
    await text(0, [143, p.y + 8, 374, p.y + 25], p.title, { size: 10.7, leading: 13, style: "ExtraBold", color: C.ink });
    await text(0, [143, p.y + 30, 374, p.y + 52], p.desc, { size: 6.9, leading: 8.6, color: C.body });
    await text(0, [143, p.y + 59, 374, p.y + 71], p.features, { size: 5.6, leading: 7, style: "Bold", tracking: 55, color: C.blue });
  }

  await shape(0, [10, 392, HALF, H + BLEED], C.deep);
  await shape(0, [10, 392, HALF, 401], C.blue);
  await text(0, [32, 418, 260, 434], "READY WHEN YOU ARE", { size: 7, style: "Bold", tracking: 150, color: C.soft });
  await text(0, [32, 444, 300, 499], "Let's find the work\nthat can run itself.", { size: 22.5, leading: 24.5, style: "ExtraBold", color: C.white });
  await text(0, [32, 512, 280, 556], "(508) 801-8190\ninfo@skale.club  ·  skale.club\n36 South St, Framingham", { size: 7.8, leading: 12.2, color: C.light });
  await shape(0, [319, 429, 388, 498], C.paperCard, { radius: 4 });
  await command("object.qrCode", { type: "url", content: "https://skale.club", rect: [326, 436, 381, 491], spread: 0 });
  await text(0, [307, 506, 400, 522], "SCAN TO START", { size: 6.1, style: "Bold", tracking: 105, align: "center", color: C.soft });
  await text(0, [304, 547, 389, 560], "SKALE.CLUB / 2026", { size: 5.6, tracking: 75, align: "right", color: C.muted });

  // Front cover: oversized type, a confident blue field and founder portrait.
  await shape(0, [HALF, -BLEED, W + BLEED, H + BLEED], C.deep);
  await shape(0, [HALF, -BLEED, HALF + 9, H + BLEED], C.blue);

  await image(0, [462, 28, 521, 76], "logo-dark.png", "fitProportionally");
  await text(0, [462, 103, 814, 120], "THE SKALE CLUB CAPABILITIES EDITION", { size: 6.8, style: "Bold", tracking: 135, color: C.soft });
  await text(0, [462, 128, 826, 190], "Stop doing", { size: 38, leading: 40, style: "ExtraBold", color: C.white });
  await text(0, [462, 171, 826, 236], "repetitive work.", { size: 38, leading: 40, style: "ExtraBold", color: C.white });
  await text(0, [462, 214, 826, 280], "Automate it.", { size: 38, leading: 40, style: "ExtraBold", color: C.soft });
  await text(0, [462, 291, 662, 323], "AI, websites and systems\ndesigned to give your team time back.", { size: 10.3, leading: 13.7, color: C.muted });
  await shape(0, [462, 335, 598, 367], C.blue, { radius: 16 });
  await text(0, [468, 340, 592, 364], "CALL (508) 801-8190", { size: 8.2, style: "Bold", align: "center", vj: "center" });
  await image(0, [600, 245, 842, 596], "hero-founder.webp", "fitProportionally", 8);

  const proofs = [
    ["01", "LIVE IN WEEKS", "Fast implementation"],
    ["02", "SECURE BY DESIGN", "Enterprise standards"],
    ["03", "50+ LAUNCHES", "Proven delivery"],
  ];
  for (let i = 0; i < proofs.length; i++) {
    const y = 415 + i * 43;
    await text(0, [462, y, 482, y + 15], proofs[i][0], { size: 6.8, style: "Bold", color: C.soft });
    await text(0, [489, y, 598, y + 15], proofs[i][1], { size: 6.4, style: "Bold", tracking: 55, color: C.white });
    await text(0, [489, y + 17, 598, y + 32], proofs[i][2], { size: 6.4, color: C.muted });
    if (i < proofs.length - 1) await rule(0, 462, y + 36, 594, y + 36.6, C.border);
  }
  await text(0, [462, 564, 552, 580], "skale.club", { size: 6.8, style: "Bold", color: C.white });
}

async function buildInside() {
  // Inside left: light, highly readable product index.
  await shape(1, [-BLEED, -BLEED, HALF, H + BLEED], C.paper);
  await shape(1, [-BLEED, -BLEED, HALF, 9], C.blue);
  await text(1, [330, 16, 394, 83], "01", { size: 50, leading: 50, style: "Bold", color: C.bluePale, align: "right" });
  await text(1, [M, 26, 220, 42], "01 / APPS", { size: 7, style: "Bold", tracking: 150, color: C.blue });
  await text(1, [M, 42, 392, 116], "Tools to sell more.\nTime to do more.", { size: 26, leading: 27.5, style: "ExtraBold", color: C.ink });
  await text(1, [M, 116, 392, 135], "Eight focused products. One goal: remove friction from the workday.", { size: 8.2, leading: 10.5, color: C.body });

  const rowY = 139;
  const rowH = 50;
  const rowGap = 3;
  for (let i = 0; i < apps.length; i++) {
    const item = apps[i];
    const y = rowY + i * (rowH + rowGap);
    await shape(1, [M, y, HALF - M, y + rowH], i % 2 === 0 ? C.paperCard : C.bluePale, { stroke: C.rule, weight: 0.45, radius: 3 });
    await image(1, [M + 3, y + 3, M + 81, y + rowH - 3], item.image, "fillProportionally", 1);
    await text(1, [M + 88, y + 6, M + 106, y + 20], String(i + 1).padStart(2, "0"), { size: 5.8, style: "Bold", color: C.blue });
    await text(1, [M + 108, y + 5, M + 238, y + 21], item.title, { size: 9.8, leading: 11.7, style: "ExtraBold", color: C.ink });
    await text(1, [M + 108, y + 22, M + 246, y + 32], item.category, { size: 5.7, leading: 6.9, style: "Bold", tracking: 70, color: C.blue });
    await text(1, [M + 108, y + 35, M + 276, y + 48], item.headline, { size: 6.5, leading: 8, color: C.body });
    if (item.price) await text(1, [M + 270, y + 6, HALF - M - 8, y + 22], `${item.price} ${item.label}`, { size: 7.5, leading: 9.2, style: "Bold", align: "right", color: C.blueDeep });
  }

  // Inside right: dark, image-led service portfolio.
  await shape(1, [HALF, -BLEED, W + BLEED, H + BLEED], C.deep);
  await shape(1, [HALF, -BLEED, W + BLEED, 9], C.blue);
  await text(1, [748, 16, 814, 83], "02", { size: 50, leading: 50, style: "Bold", color: C.band, align: "right" });
  const sx = HALF + M;
  await text(1, [sx, 26, sx + 220, 42], "02 / SERVICES", { size: 7, style: "Bold", tracking: 150, color: C.soft });
  await text(1, [sx, 42, W - M, 116], "Built around\nyour business.", { size: 26, leading: 27.5, style: "ExtraBold", color: C.white });
  await text(1, [sx, 116, W - M, 135], "Strategy, production and systems—quoted for the result you need.", { size: 8.2, leading: 10.5, color: C.muted });

  const startY = 139;
  const gap = 5;
  const cardW = 178;
  const cardH = 101;
  for (let i = 0; i < services.length; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = sx + col * (cardW + gap);
    const y = startY + row * (cardH + gap);
    const item = services[i];
    await shape(1, [x, y, x + cardW, y + cardH], C.card, { stroke: C.border, weight: 0.5, radius: 3 });
    await image(1, [x + 1, y + 1, x + cardW - 1, y + 40], item.image, "fillProportionally", 4);
    await shape(1, [x + 1, y + 40, x + 5, y + cardH - 1], i % 3 === 0 ? C.blue : C.blueDeep);
    await text(1, [x + 12, y + 44, x + cardW - 8, y + 53], item.category, { size: 5.8, leading: 7, style: "Bold", tracking: 75, color: C.soft });
    await text(1, [x + 12, y + 55, x + cardW - 8, y + 76], item.title, { size: 9.5, leading: 10.5, style: "ExtraBold", color: C.white });
    await text(1, [x + 12, y + 78, x + cardW - 8, y + 99], item.description, { size: 6.6, leading: 7.7, color: C.muted });
  }
  await text(1, [sx, 566, sx + 150, 580], "SKALE.CLUB", { size: 5.9, style: "Bold", tracking: 85, color: C.soft });
  await text(1, [W - 230, 566, W - M, 580], "APPS / SERVICES / PRODUCTS", { size: 5.4, tracking: 65, align: "right", color: C.muted });
}

async function main() {
  await client.request("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "skale-folder-builder", version: "1.0" } });
  client.notify("notifications/initialized");
  await client.tool("new_document", { width: W, height: H, pages: 2, facingPages: false, bleed: BLEED, margins: M, title: "Skale Club — Editorial Folder" });
  for (const [color, name] of SWATCH) await command("swatch.create", { name, color });
  await buildOutside();
  await buildInside();
  const inspection = await client.tool("inspect_document");
  const overset = inspection.stories?.filter((story) => story.overset) ?? [];
  if (overset.length) {
    console.error(JSON.stringify({ overset }, null, 2));
    throw new Error(`Overset stories: ${overset.map((story) => story.id).join(", ")}`);
  }
  const documentPath = join(OUTPUT, "skale-club-folder.designcraft");
  await client.tool("save_document", { path: documentPath });
  await client.tool("open_document", { path: documentPath });
  const verified = await client.tool("inspect_document");
  const verifiedOverset = verified.stories?.filter((story) => story.overset) ?? [];
  if (verified.pageCount !== 2 || verifiedOverset.length) {
    throw new Error(`Reopen verification failed: pages=${verified.pageCount}, overset=${verifiedOverset.length}`);
  }
  await client.tool("render_page", { page: 0, bleed: true, scale: 1.4, path: join(OUTPUT, "skale-club-folder-outside-proof.png") });
  await client.tool("render_page", { page: 1, bleed: true, scale: 1.4, path: join(OUTPUT, "skale-club-folder-inside-proof.png") });
  await client.tool("export_png", { page: 0, scale: 2, path: join(OUTPUT, "skale-club-folder-outside.png") });
  await client.tool("export_png", { page: 1, scale: 2, path: join(OUTPUT, "skale-club-folder-inside.png") });
  console.log(JSON.stringify({ document: documentPath, pages: verified.pageCount, stories: verified.stories?.length, overset: verifiedOverset.length, warnings: verified.warnings?.length ?? 0 }, null, 2));
}

try {
  await main();
  await client.close();
} catch (error) {
  console.error(error);
  client.child.kill();
  process.exitCode = 1;
}


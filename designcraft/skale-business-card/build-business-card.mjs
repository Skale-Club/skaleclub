import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUTPUT = HERE;
const ASSETS = join(HERE, "..", "skale-folder", "assets");
const DESIGNCRAFT = "C:\\Program Files\\DesignCraft\\designcraft-cli.exe";

// US business card: 3.5 × 2 in, plus 0.125 in bleed on every edge.
const W = 252;
const H = 144;
const BLEED = 9;

const C = {
  black: "#0B0D12",
  deep: "#0D121A",
  navy: "#10151E",
  card: "#161D28",
  grid: "#202A39",
  blue: "#5173D6",
  blueDeep: "#294AA5",
  soft: "#8FA9EE",
  white: "#F7F8FA",
  light: "#D6DAE2",
  muted: "#8C95A3",
};

const SWATCH = new Map([
  [C.black, { name: "Skale Black", cmyk: { c: 39, m: 28, y: 0, k: 93 } }],
  [C.deep, { name: "Skale Deep", cmyk: { c: 50, m: 31, y: 0, k: 90 } }],
  [C.navy, { name: "Skale Navy", cmyk: { c: 47, m: 30, y: 0, k: 88 } }],
  [C.card, { name: "Skale Card", cmyk: { c: 45, m: 28, y: 0, k: 84 } }],
  [C.grid, { name: "Skale Grid", cmyk: { c: 44, m: 26, y: 0, k: 78 } }],
  [C.blue, { name: "Skale Blue", cmyk: { c: 62, m: 46, y: 0, k: 16 } }],
  [C.blueDeep, { name: "Skale Deep Blue", cmyk: { c: 75, m: 55, y: 0, k: 35 } }],
  [C.soft, { name: "Skale Soft Blue", cmyk: { c: 40, m: 29, y: 0, k: 7 } }],
  [C.white, { name: "Skale White", cmyk: { c: 1, m: 1, y: 0, k: 2 } }],
  [C.light, { name: "Skale Light", cmyk: { c: 5, m: 4, y: 0, k: 11 } }],
  [C.muted, { name: "Skale Muted", cmyk: { c: 14, m: 9, y: 0, k: 36 } }],
  ["#5E7DE0", { name: "Skale Grid Blue", cmyk: { c: 58, m: 44, y: 0, k: 12 } }],
]);

const paint = (color) => SWATCH.get(color)?.cmyk ?? color;
const textPaint = (color) => SWATCH.get(color)?.name ?? color;

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
    if (result?.isError) throw new Error(result.content?.map((item) => item.text).join("\n") || `${name} failed`);
    const content = result?.content?.find((item) => item.type === "text")?.text;
    if (!content) return result;
    try { return JSON.parse(content); } catch { return content; }
  }

  async close() {
    this.child.stdin.end();
    await new Promise((resolve) => this.child.once("close", resolve));
  }
}

const client = new McpClient();

async function command(commandId, params = {}) {
  return client.tool("execute", { command: commandId, params });
}

async function shape(spread, rect, fill, { stroke = null, weight = 0.5, radius = 0, opacity = 1 } = {}) {
  const made = await command("frame.create", { spread, rect, content: "graphic" });
  await command("object.color", { color: paint(fill), target: "fill", ids: [made.id] });
  if (stroke) {
    await command("object.color", { color: paint(stroke), target: "stroke", ids: [made.id] });
    await command("object.stroke", { weight, align: "inside", ids: [made.id] });
  }
  if (radius) await command("object.cornerOptions", { shape: "rounded", size: radius, ids: [made.id] });
  if (opacity !== 1) await command("object.opacity", { opacity, ids: [made.id] });
  return made.id;
}

async function text(spread, rect, value, {
  size = 8,
  leading = size * 1.2,
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
  await command("type.char", {
    attrs: {
      fontFamily: "Segoe UI",
      fontStyle: style,
      size,
      leading: { kind: "points", value: leading },
      tracking,
      fill: textPaint(color),
    },
  });
  await command("type.para", { attrs: { align, hyphenate: false } });
  return made.id;
}

async function image(spread, rect, filename, fitting = "fitProportionally") {
  const frame = await command("frame.create", { spread, rect, content: "graphic" });
  await client.tool("place_image", { frame: frame.id, path: join(ASSETS, filename) });
  await command("object.fittingOptions", { fitting, align: 4, ids: [frame.id] });
  return frame.id;
}

async function line(spread, rect, color = C.grid) {
  return shape(spread, rect, color);
}

async function buildFront() {
  await shape(0, [-BLEED, -BLEED, W + BLEED, H + BLEED], C.black);
  await shape(0, [177, -BLEED, W + BLEED, H + BLEED], C.blueDeep);
  await shape(0, [189, -BLEED, W + BLEED, H + BLEED], C.blue, { opacity: 0.42 });

  await image(0, [18, 16, 72, 59], "logo-dark.png");
  await text(0, [18, 70, 169, 92], "VANILDO DE SOUZA JR", {
    size: 13.6,
    leading: 14,
    style: "Bold",
    tracking: -8,
  });
  await text(0, [19, 94, 169, 105], "SKALE CLUB", {
    size: 5.6,
    leading: 6.2,
    style: "Bold",
    tracking: 160,
    color: C.soft,
  });
  await line(0, [18, 109, 55, 110.4], C.blue);
  await text(0, [18, 117, 170, 133], "We help businesses grow smarter.", {
    size: 6.7,
    leading: 8,
    color: C.light,
  });
  await text(0, [208, 108, 240, 137], "01", {
    size: 17,
    leading: 17,
    style: "Bold",
    align: "right",
    color: C.soft,
  });
}

async function buildBack() {
  await shape(1, [-BLEED, -BLEED, W + BLEED, H + BLEED], C.deep);
  await shape(1, [-BLEED, -BLEED, 9, H + BLEED], C.blue);

  await text(1, [22, 17, 146, 30], "VANILDO DE SOUZA JR", {
    size: 9.7,
    leading: 10.5,
    style: "Bold",
    tracking: -5,
  });
  await text(1, [22, 33, 146, 43], "SKALE CLUB", {
    size: 5.1,
    leading: 5.7,
    style: "Bold",
    tracking: 150,
    color: C.soft,
  });
  await line(1, [22, 51, 137, 51.7], C.grid);

  await text(1, [22, 61, 48, 69], "PHONE", { size: 4.5, style: "Bold", tracking: 125, color: C.muted });
  await text(1, [56, 59, 141, 71], "(508) 801-8190", { size: 6.7, style: "Bold", color: C.white });

  await text(1, [22, 79, 48, 87], "EMAIL", { size: 4.5, style: "Bold", tracking: 125, color: C.muted });
  await text(1, [56, 77, 141, 89], "vanildo@skale.club", { size: 6.5, color: C.white });

  await text(1, [22, 97, 48, 105], "WEB", { size: 4.5, style: "Bold", tracking: 125, color: C.muted });
  await text(1, [56, 95, 141, 107], "skale.club", { size: 6.5, color: C.white });

  await line(1, [22, 116, 137, 116.7], C.grid);
  await text(1, [22, 124, 137, 135], "AI · WEBSITES · AUTOMATION", {
    size: 4.6,
    leading: 5.4,
    style: "Bold",
    tracking: 105,
    color: C.soft,
  });

  await shape(1, [165, 28, 230, 93], C.white, { radius: 3 });
  await command("object.qrCode", {
    type: "url",
    content: "https://skale.club/vcard/vanildo",
    rect: [171, 34, 224, 87],
    spread: 1,
  });
  await text(1, [158, 101, 237, 111], "SCAN TO SAVE CONTACT", {
    size: 4.4,
    leading: 5,
    style: "Bold",
    tracking: 90,
    align: "center",
    color: C.soft,
  });
  await text(1, [158, 116, 237, 128], "skale.club/vcard/vanildo", {
    size: 4.6,
    leading: 5.4,
    align: "center",
    color: C.light,
  });
}

async function main() {
  await client.request("initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "skale-business-card-builder", version: "1.0" },
  });
  client.notify("notifications/initialized");

  await client.tool("new_document", {
    width: W,
    height: H,
    pages: 2,
    facingPages: false,
    bleed: BLEED,
    margins: 11,
    title: "Skale Club — Vanildo de Souza Jr Business Card",
  });

  for (const { name, cmyk } of SWATCH.values()) await command("swatch.create", { name, color: cmyk });
  await buildFront();
  await buildBack();

  const inspection = await client.tool("inspect_document");
  const overset = inspection.stories?.filter((story) => story.overset) ?? [];
  if (overset.length) {
    console.error(JSON.stringify({ overset }, null, 2));
    throw new Error(`Overset stories: ${overset.map((story) => story.id).join(", ")}`);
  }

  const documentPath = join(OUTPUT, "skale-club-business-card.designcraft");
  const pdfPath = join(OUTPUT, "skale-club-business-card-print.pdf");
  await client.tool("save_document", { path: documentPath });
  await client.tool("open_document", { path: documentPath });

  const verified = await client.tool("inspect_document");
  const verifiedOverset = verified.stories?.filter((story) => story.overset) ?? [];
  if (verified.pageCount !== 2 || verifiedOverset.length) {
    throw new Error(`Reopen verification failed: pages=${verified.pageCount}, overset=${verifiedOverset.length}`);
  }

  await client.tool("render_page", { page: 0, bleed: true, scale: 4, path: join(OUTPUT, "front-proof.png") });
  await client.tool("render_page", { page: 1, bleed: true, scale: 4, path: join(OUTPUT, "back-proof.png") });
  await command("file.exportPdf", {
    path: pdfPath,
    pages: [1, 2],
    bleed: true,
    marks: { crop: true, bleed: true, pageInfo: false, weight: 0.25, offset: 6 },
    standard: "x4",
    compressImages: true,
    title: "Skale Club — Vanildo de Souza Jr Business Card",
    author: "Skale Club",
  });

  console.log(JSON.stringify({
    document: documentPath,
    pdf: pdfPath,
    pages: verified.pageCount,
    stories: verified.stories?.length,
    overset: verifiedOverset.length,
    warnings: verified.warnings ?? [],
  }, null, 2));
}

try {
  await main();
  await client.close();
} catch (error) {
  console.error(error);
  client.child.kill();
  process.exitCode = 1;
}

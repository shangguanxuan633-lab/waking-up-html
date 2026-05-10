import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const root = "D:/code";
const sourceRoot = path.join(root, "temp", "waking-up-source");
const outDir = path.join(root, "waking-up-html");
const sourceRepo = "https://github.com/wolverinn/Waking-Up";

const pages = [
  {
    source: "generated technical index",
    output: "index.html",
    title: "技术复习资料总览",
    short: "技术索引",
    domain: "overview",
    accent: "blue",
    promise: "把计算机基础、后端面试和开发工具模块整理成可检索、可离线阅读的入口页。",
  },
  {
    source: "Computer Network.md",
    output: "computer-network.html",
    title: "计算机网络面试复习",
    short: "计算机网络",
    domain: "network",
    accent: "teal",
    promise: "围绕 TCP/UDP、HTTP/HTTPS、DNS、IP、ARP、NAT、路由与版本演进做面试化梳理。",
  },
  {
    source: "Operating Systems.md",
    output: "operating-systems.html",
    title: "操作系统面试复习",
    short: "操作系统",
    domain: "os",
    accent: "amber",
    promise: "覆盖进程线程、IPC、调度、死锁、内存、虚拟内存、I/O 与磁盘调度。",
  },
  {
    source: "Database.md",
    output: "database.html",
    title: "数据库面试复习",
    short: "数据库",
    domain: "database",
    accent: "blue",
    promise: "围绕事务、隔离级别、锁、MVCC、索引、存储引擎、优化与复制展开。",
  },
  {
    source: "Design Pattern.md",
    output: "design-pattern.html",
    title: "设计模式复习",
    short: "设计模式",
    domain: "design",
    accent: "teal",
    promise: "把 GoF 设计模式按创建型、结构型、行为型整理成可检索的学习手册。",
  },
  {
    source: "Git-ComdLine-REST.md",
    output: "git-commandline-rest.html",
    title: "Git / RESTful API / 命令行复习",
    short: "Git/REST/命令行",
    domain: "tools",
    accent: "amber",
    promise: "沉淀 Git 常用操作、撤销回滚、分支标签、REST 设计原则和 Linux 命令。",
  },
  {
    source: "Python Handbook.md",
    output: "python-handbook.html",
    title: "Python 面试复习",
    short: "Python",
    domain: "python",
    accent: "blue",
    promise: "覆盖生成器、迭代器、容器、GIL、装饰器、垃圾回收、拷贝与基础语法。",
  },
];

const outputBySource = new Map(pages.map((page) => [page.source, page.output]));
const sourceByOutput = new Map(pages.map((page) => [page.output, page.source]));
const technicalPages = pages.filter((page) => page.domain !== "overview");

function esc(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[ch]));
}

function attr(value) {
  return esc(value).replace(/`/g, "&#96;");
}

function slug(value) {
  const plain = stripMarkdown(value)
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[^\w\u4e00-\u9fff]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return plain || "section";
}

function uniqueSlug(base, used) {
  const rootSlug = slug(base);
  let id = rootSlug;
  let index = 2;
  while (used.has(id)) {
    id = `${rootSlug}-${index}`;
    index += 1;
  }
  used.add(id);
  return id;
}

function stripMarkdown(value) {
  return String(value)
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/<\/?[^>]+>/g, "")
    .replace(/[`*_~#>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function readSource(page) {
  return fs.readFileSync(path.join(sourceRoot, page.source), "utf8");
}

function sourceCommit() {
  try {
    return execSync("git rev-parse --short HEAD", {
      cwd: sourceRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return "unknown";
  }
}

function generatedAt() {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date());
}

function transformHref(href) {
  const raw = String(href || "").trim();
  if (!raw) return "#";
  if (/^(https?:|mailto:|tel:)/i.test(raw)) return raw;
  if (raw.startsWith("#")) return `#${slug(decodeText(raw.slice(1)))}`;

  const [base, hash] = raw.split("#");
  const decoded = decodeText(base).replace(/\\/g, "/").replace(/^\.\//, "");
  const mapped = outputBySource.get(decoded);
  if (mapped) return hash ? `${mapped}#${slug(decodeText(hash))}` : mapped;
  return raw;
}

function decodeText(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function assetSrc(src) {
  const raw = String(src || "").trim();
  if (!raw) return "";
  if (/^(https?:|data:)/i.test(raw)) return raw;
  return raw.replace(/\\/g, "/").replace(/^\.\//, "");
}

function makeTokens() {
  const tokens = [];
  return {
    stash(html) {
      const key = `@@HTML_TOKEN_${tokens.length}@@`;
      tokens.push([key, html]);
      return key;
    },
    restore(text) {
      return tokens.reduce((acc, [key, html]) => acc.replaceAll(key, html), text);
    },
  };
}

function renderInline(text) {
  const token = makeTokens();
  let value = String(text);

  value = value.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, src) => {
    const cleanSrc = assetSrc(src.split(/\s+/)[0]);
    return token.stash(`<img class="inline-img" src="${attr(cleanSrc)}" alt="${attr(alt)}">`);
  });

  value = value.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => {
    const cleanHref = transformHref(href);
    const target = /^(https?:)/i.test(cleanHref) ? ' target="_blank" rel="noreferrer"' : "";
    return token.stash(`<a href="${attr(cleanHref)}"${target}>${esc(stripMarkdown(label) || label)}</a>`);
  });

  value = value.replace(/```([^`]+)```/g, (_, code) => token.stash(`<code>${esc(code.trim())}</code>`));
  value = value.replace(/`([^`]+)`/g, (_, code) => token.stash(`<code>${esc(code)}</code>`));

  value = esc(value)
    .replace(/&amp;(nbsp|ensp|emsp|thinsp);/g, "&$1;")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/~~([^~]+)~~/g, "<del>$1</del>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");

  return token.restore(value);
}

function extractHeadings(markdown) {
  const used = new Set();
  return [...markdown.matchAll(/^(#{1,6})\s+(.+?)\s*#*\s*$/gm)].map((match) => {
    const title = stripMarkdown(match[2]);
    return {
      level: match[1].length,
      raw: match[2],
      title,
      id: uniqueSlug(title, used),
    };
  });
}

function statsFor(markdown) {
  const lines = markdown.split(/\r?\n/);
  return {
    chars: markdown.length,
    lines: lines.length,
    headings: extractHeadings(markdown).length,
    details: (markdown.match(/<details\b/gi) || []).length,
    images: (markdown.match(/!\[[^\]]*]\([^)]+\)|<img\b/gi) || []).length,
    codeBlocks: Math.floor((markdown.match(/```/g) || []).length / 2),
    listRows: lines.filter((line) => /^\s*(?:[-*+]|\d+[.)])\s+/.test(line)).length,
  };
}

function renderMarkdown(markdown) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const used = new Set();
  const html = [];
  const toc = [];
  let paragraph = [];
  let listOpen = false;
  let inFence = false;
  let fenceLang = "";
  let fenceRows = [];
  let tableRows = [];

  function closeParagraph() {
    if (!paragraph.length) return;
    html.push(`<p>${renderInline(paragraph.join(" "))}</p>`);
    paragraph = [];
  }

  function closeList() {
    if (!listOpen) return;
    html.push("</div>");
    listOpen = false;
  }

  function renderCode(lang, rows) {
    const className = lang ? ` class="language-${attr(lang)}"` : "";
    html.push(`<pre class="code-block"><code${className}>${esc(rows.join("\n"))}</code></pre>`);
  }

  function flushTable() {
    if (!tableRows.length) return;
    const rows = tableRows.map((row) => row.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim()));
    tableRows = [];
    let header = [];
    let body = rows;
    if (rows.length > 1 && rows[1].every((cell) => /^:?-{3,}:?$/.test(cell))) {
      header = rows[0];
      body = rows.slice(2);
    }
    const thead = header.length
      ? `<thead><tr>${header.map((cell) => `<th>${renderInline(cell)}</th>`).join("")}</tr></thead>`
      : "";
    const tbody = `<tbody>${body.map((row) => `<tr>${row.map((cell) => `<td>${renderInline(cell)}</td>`).join("")}</tr>`).join("")}</tbody>`;
    html.push(`<div class="table-wrap"><table>${thead}${tbody}</table></div>`);
  }

  for (const line of lines) {
    const trimmed = line.trim();

    if (inFence) {
      if (trimmed.startsWith("```")) {
        renderCode(fenceLang, fenceRows);
        inFence = false;
        fenceLang = "";
        fenceRows = [];
      } else {
        fenceRows.push(line);
      }
      continue;
    }

    const singleFence = trimmed.match(/^```([\s\S]+)```$/);
    if (singleFence) {
      closeParagraph();
      closeList();
      flushTable();
      renderCode("", [singleFence[1].trim()]);
      continue;
    }

    const fenceStart = trimmed.match(/^```([\w-]*)\s*$/);
    if (fenceStart) {
      closeParagraph();
      closeList();
      flushTable();
      inFence = true;
      fenceLang = fenceStart[1] || "";
      fenceRows = [];
      continue;
    }

    if (!trimmed) {
      closeParagraph();
      closeList();
      flushTable();
      continue;
    }

    if (/^<!--/.test(trimmed)) continue;

    if (/^[-*_]{3,}$/.test(trimmed)) {
      closeParagraph();
      closeList();
      flushTable();
      html.push("<hr>");
      continue;
    }

    if (/^\|.+\|\s*$/.test(line)) {
      closeParagraph();
      closeList();
      tableRows.push(line);
      continue;
    }
    flushTable();

    const heading = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (heading) {
      closeParagraph();
      closeList();
      const level = heading[1].length;
      const title = stripMarkdown(heading[2]);
      const id = uniqueSlug(title, used);
      toc.push({ level, title, id });
      html.push(`<h${level} id="${attr(id)}">${renderInline(heading[2])}</h${level}>`);
      continue;
    }

    const list = line.match(/^(\s*)([-*+]|\d+[.)])\s+(.+)$/);
    if (list) {
      closeParagraph();
      const depth = Math.min(5, Math.floor((list[1] || "").replace(/\t/g, "    ").length / 2));
      if (!listOpen) {
        html.push('<div class="md-list">');
        listOpen = true;
      }
      html.push(`<div class="md-list-row depth-${depth}"><span class="md-marker">${esc(list[2])}</span><div>${renderInline(list[3])}</div></div>`);
      continue;
    }

    const quote = line.match(/^>\s?(.*)$/);
    if (quote) {
      closeParagraph();
      closeList();
      html.push(`<blockquote>${renderInline(quote[1])}</blockquote>`);
      continue;
    }

    if (trimmed.startsWith("<details")) {
      closeParagraph();
      closeList();
      html.push(trimmed.includes("class=") ? trimmed : trimmed.replace("<details", '<details class="source-detail"'));
      continue;
    }

    if (/^<\/?summary\b/i.test(trimmed) || /^<\/details/i.test(trimmed)) {
      closeParagraph();
      closeList();
      html.push(trimmed);
      continue;
    }

    if (/^<div\b/i.test(trimmed)) {
      closeParagraph();
      closeList();
      html.push('<div class="source-html-center">');
      continue;
    }

    if (/^<\/div>/i.test(trimmed)) {
      closeParagraph();
      closeList();
      html.push("</div>");
      continue;
    }

    if (/^<a\b/i.test(trimmed)) {
      closeParagraph();
      closeList();
      const href = trimmed.match(/href=["']([^"']+)["']/i)?.[1] || "#";
      html.push(`<a class="source-link-wrap" href="${attr(transformHref(href))}">`);
      continue;
    }

    if (/^<\/a>/i.test(trimmed)) {
      closeParagraph();
      closeList();
      html.push("</a>");
      continue;
    }

    if (/^<img\b/i.test(trimmed)) {
      closeParagraph();
      closeList();
      html.push(renderHtmlImage(trimmed));
      continue;
    }

    if (/^!\[[^\]]*]\([^)]+\)\s*$/.test(trimmed)) {
      closeParagraph();
      closeList();
      html.push(renderMarkdownImage(trimmed));
      continue;
    }

    paragraph.push(line);
  }

  closeParagraph();
  closeList();
  flushTable();
  if (inFence) renderCode(fenceLang, fenceRows);
  return { html: html.join("\n"), toc };
}

function renderMarkdownImage(line) {
  const match = line.match(/^!\[([^\]]*)]\(([^)]+)\)\s*$/);
  if (!match) return `<p>${renderInline(line)}</p>`;
  const src = assetSrc(match[2].split(/\s+/)[0]);
  const alt = stripMarkdown(match[1]);
  return `<figure class="source-figure"><img src="${attr(src)}" alt="${attr(alt)}"><figcaption>${esc(alt || src)}</figcaption></figure>`;
}

function renderHtmlImage(line) {
  const srcs = [...line.matchAll(/\bsrc=["']([^"']+)["']/gi)].map((match) => match[1]);
  const local = srcs.find((src) => /^_v_images[\\/]/.test(src));
  const src = assetSrc(local || srcs[0] || "");
  const alt = line.match(/\b(?:alt|name)=["']([^"']+)["']/i)?.[1] || src.split("/").pop() || "image";
  const width = line.match(/\bwidth=["']?([^"'\s>]+)["']?/i)?.[1];
  const style = width ? ` style="max-width:${attr(width)}"` : "";
  return `<figure class="source-figure"><img src="${attr(src)}" alt="${attr(alt)}"${style}><figcaption>${esc(alt)}</figcaption></figure>`;
}

function domainAnnotation(title, domain) {
  const text = `${title} ${domain}`;
  const rules = [
    [/三次握手|四次挥手|TCP|UDP|拥塞|流量控制|可靠|粘包/i, "答题时别只背流程，要补上序列号/确认号的目的、失败重传、队列与线上状态证据，例如 ss、tcpdump、连接池日志。"],
    [/HTTP|HTTPS|Cookie|Session|GET|POST|状态码|DNS|ARP|NAT|RIP|IP地址/i, "用“语义 -> 报文/状态 -> 缓存/安全 -> 代理/CDN -> 排障证据”展开，能自然接住版本演进和线上慢请求追问。"],
    [/进程|线程|协程|IPC|同步|调度|僵尸|IO多路复用/i, "先区分资源边界和调度边界，再说内核对象、上下文切换成本、常见阻塞点和 Linux 命令证据。"],
    [/死锁|虚拟内存|分页|分段|页面置换|缓冲区|磁盘/i, "从必要条件或数据结构出发，补上失效场景、性能指标和排查命令，避免停留在教材定义。"],
    [/事务|隔离|锁|MVCC|范式|连接|索引|InnoDB|MyISAM|复制|优化|NoSQL|Redis/i, "数据库题要把一致性、并发、索引访问路径、执行计划、锁等待和主从延迟连起来说，最好带 EXPLAIN 或监控指标。"],
    [/工厂|单例|原型|适配器|装饰|代理|观察者|策略|状态|模板|访问者|模式/i, "设计模式题先讲意图和适用变化点，再讲参与角色、类关系、优缺点和过度设计风险。"],
    [/Git|tag|标签|回滚|分支|REST|API|Linux|命令/i, "工具题重在可操作：说清楚命令影响的区域、是否改历史、如何回滚，以及团队协作中的安全边界。"],
    [/生成器|迭代器|list|dict|GIL|装饰器|垃圾回收|lambda|拷贝|tuple|is/i, "Python 题要从对象模型、协议、内存、引用计数/GC、运行时限制和工程替代方案展开。"],
  ];
  const hit = rules.find(([pattern]) => pattern.test(text));
  return hit ? hit[1] : "按“定义 -> 为什么存在 -> 核心机制 -> 生产场景 -> 可验证证据 -> 取舍边界 -> 追问”准备，答案会比单纯背诵稳定很多。";
}

function buildKnowledgeCards(headings, page) {
  const candidates = headings.filter((heading) => heading.level > 1 && heading.level <= 4);
  const selected = candidates.length ? candidates : headings.slice(1);
  return selected.map((heading, index) => `
    <li class="knowledge-card" data-search="${attr(`${heading.title} ${page.domain}`)}">
      <b class="knowledge-title">${esc(index + 1)}. ${esc(heading.title)}</b>
      <p>原文对应章节：<a href="#${attr(heading.id)}">${esc(heading.title)}</a>。复习时先用一两句话讲清概念，再回到原文里的展开、追问或示例。</p>
      <p class="knowledge-note">注释：${esc(domainAnnotation(heading.title, page.domain))}</p>
    </li>
  `).join("");
}

function indexHeadings() {
  return technicalPages.map((topic, index) => ({
    level: 2,
    raw: topic.title,
    title: `${index + 1}. ${topic.short}`,
    id: slug(topic.short),
  }));
}

function buildIndexKnowledgeCards() {
  return technicalPages.map((topic, index) => `
    <li class="knowledge-card" data-search="${attr(`${topic.title} ${topic.promise}`)}">
      <b class="knowledge-title">${index + 1}. <a href="${attr(topic.output)}">${esc(topic.title)}</a></b>
      <p>${esc(topic.promise)}</p>
      <p class="knowledge-note">注释：该专题已整理为独立 HTML，包含图谱、原文转写和复习卡，方便直接按知识模块复习。</p>
    </li>
  `).join("");
}

function aggregateIndexStats() {
  const base = { chars: 0, lines: 0, headings: 0, details: 0, images: 0, codeBlocks: 0, listRows: 0 };
  for (const topic of technicalPages) {
    const stats = statsFor(readSource(topic));
    for (const key of Object.keys(base)) base[key] += stats[key];
  }
  return base;
}

function diagramCard(title, source, caption = "", tags = []) {
  return `
    <article class="diagram-card" data-search="${attr([title, caption, ...tags].join(" "))}">
      <h3>${esc(title)}</h3>
      <pre class="mermaid-source"><code class="language-mermaid">${esc(source.trim())}</code></pre>
      ${caption ? `<p class="diagram-caption">${esc(caption)}</p>` : ""}
    </article>
  `;
}

function mermaidLabel(value) {
  return String(value).replace(/"/g, "'").replace(/\r?\n/g, "<br/>").slice(0, 42);
}

function roadmapDiagram(page, headings) {
  const nodes = headings.filter((heading) => heading.level > 1 && heading.level <= 3).slice(0, 12);
  if (!nodes.length) {
    return `flowchart LR
      A["源资料"] --> B["模块入口"] --> C["复习路线"] --> D["面试追问"]`;
  }
  const lines = ["flowchart LR"];
  nodes.forEach((heading, index) => {
    const id = `n${index + 1}`;
    lines.push(`  ${id}["${index + 1}. ${mermaidLabel(heading.title)}"]`);
    if (index > 0) lines.push(`  n${index} --> ${id}`);
  });
  return lines.join("\n");
}

function domainDiagrams(page, headings) {
  const common = [
    diagramCard(`${page.short} 章节路线`, roadmapDiagram(page, headings), "从原始 Markdown 标题提取，保留一对一章节顺序。", ["roadmap", page.domain]),
    diagramCard("面试回答闭环", `flowchart LR
      A["一句话定义"] --> B["为什么存在"]
      B --> C["核心机制"]
      C --> D["生产场景"]
      D --> E["指标/命令/证据"]
      E --> F["取舍与边界"]
      F --> G["高频追问"]`, "每个知识点都按这个闭环复习，能从背诵切到工程表达。", ["answer", "interview"]),
  ];

  const extra = {
    overview: [
      diagramCard("Waking-Up 资料版图", `flowchart LR
        R["技术索引"] --> N["计算机网络"]
        R --> O["操作系统"]
        R --> D["数据库"]
        R --> P["设计模式"]
        R --> T["Git / REST / 命令行"]
        R --> Y["Python"]
        N --> I["后端校招/社招面试"]
        O --> I
        D --> I
        P --> I`, "入口页按技术模块组织，并补上 HTML 版目录。", ["overview"]),
    ],
    network: [
      diagramCard("一次请求的网络链路", `flowchart LR
        A["输入 URL"] --> B["DNS 解析"]
        B --> C["TCP/QUIC 建连"]
        C --> D["TLS/HTTPS"]
        D --> E["HTTP 请求"]
        E --> F["网关/CDN/服务端"]
        F --> G["响应/缓存/渲染"]`, "把网络题串成请求链路，适合回答“从输入 URL 到页面展示”。", ["network"]),
      diagramCard("TCP 可靠传输核心", `flowchart TB
        SYN["三次握手<br/>同步序列号"] --> EST["ESTABLISHED<br/>全双工传输"]
        EST --> WIN["滑动窗口<br/>流量控制"]
        EST --> RETRY["ACK/重传<br/>可靠性"]
        EST --> CC["拥塞控制<br/>慢启动/避免/恢复"]
        EST --> FIN["四次挥手<br/>半关闭与 TIME_WAIT"]`, "TCP 不只是握手流程，还包括可靠、有序、限速和释放。", ["tcp"]),
    ],
    os: [
      diagramCard("OS 核心对象关系", `flowchart LR
        P["进程<br/>地址空间/资源"] --> T["线程<br/>调度单位"]
        T --> S["调度器<br/>时间片/优先级"]
        P --> M["虚拟内存<br/>页表/TLB/缺页"]
        P --> F["文件描述符<br/>VFS/page cache"]
        T --> L["同步原语<br/>锁/信号量/futex"]`, "用对象关系解释进程、线程、内存、文件和同步。", ["os"]),
      diagramCard("IO 多路复用定位", `flowchart LR
        A["大量连接"] --> B["select/poll<br/>线性扫描"]
        B --> C["epoll<br/>事件通知"]
        C --> D["Reactor<br/>事件循环"]
        D --> E["业务处理<br/>线程池/协程/背压"]`, "epoll 解决等待通知效率，但业务慢仍需要线程模型和背压。", ["io"]),
    ],
    database: [
      diagramCard("事务与并发控制", `flowchart LR
        A["事务 ACID"] --> B["隔离级别"]
        B --> C["锁/两段锁"]
        B --> D["MVCC<br/>版本链/ReadView"]
        C --> E["阻塞/死锁"]
        D --> F["快照读/当前读"]
        E --> G["监控与优化"]`, "数据库面试的主线是并发一致性如何落地。", ["database"]),
      diagramCard("索引访问路径", `flowchart LR
        Q["SQL 条件"] --> O["优化器"]
        O --> I["B+Tree 索引"]
        I --> R["回表/覆盖索引"]
        R --> S["排序/分组/连接"]
        S --> E["EXPLAIN 验证"]`, "索引题必须能落到执行计划和访问路径。", ["index"]),
    ],
    design: [
      diagramCard("GoF 设计模式分类", `flowchart TB
        G["GoF 23 种设计模式"] --> C["创建型<br/>对象如何创建"]
        G --> S["结构型<br/>对象如何组合"]
        G --> B["行为型<br/>对象如何协作"]
        C --> C1["工厂/抽象工厂/单例/原型/生成器"]
        S --> S1["适配器/桥接/组合/装饰/外观/享元/代理"]
        B --> B1["策略/观察者/命令/模板/状态/责任链等"]`, "先记分类和变化点，再记具体模式。", ["design"]),
      diagramCard("模式选择路径", `flowchart LR
        A["变化点是什么?"] --> B{"创建变化?"}
        B -- 是 --> C["创建型"]
        B -- 否 --> D{"结构组合变化?"}
        D -- 是 --> E["结构型"]
        D -- 否 --> F["行为型"]
        F --> G["比较职责/状态/算法/通知/访问流程"]`, "设计模式不是套模板，而是识别变化点后的取舍。", ["pattern"]),
    ],
    tools: [
      diagramCard("Git 工作区流转", `flowchart LR
        W["工作区"] --> A["暂存区<br/>git add"]
        A --> L["本地仓库<br/>git commit"]
        L --> R["远程仓库<br/>git push"]
        R --> L2["同步<br/>git fetch/pull"]
        L2 --> W`, "撤销与回滚题先定位改动在哪个区域。", ["git"]),
      diagramCard("REST 资源设计", `flowchart LR
        Res["资源 URI"] --> Verb["HTTP 动词"]
        Verb --> Status["状态码"]
        Status --> Rep["表述 JSON/XML"]
        Rep --> Link["分页/过滤/缓存/幂等"]`, "REST 题用资源、动作、状态码、表述和幂等解释。", ["rest"]),
    ],
    python: [
      diagramCard("Python 运行时重点", `flowchart LR
        Obj["对象模型"] --> Iter["迭代协议"]
        Iter --> Gen["生成器/yield"]
        Obj --> Mem["引用计数/GC"]
        Mem --> Copy["深浅拷贝"]
        Obj --> GIL["GIL/多线程限制"]
        GIL --> MP["多进程/异步/扩展"]`, "Python 面试主线是对象、协议、内存和运行时限制。", ["python"]),
      diagramCard("生成器执行模型", `sequenceDiagram
        participant C as 调用方
        participant G as generator
        C->>G: next()
        G-->>C: yield value
        C->>G: next()
        G-->>C: yield next
        C->>G: next()
        G-->>C: StopIteration`, "用暂停/恢复解释 generator，比只说“节省内存”更稳。", ["generator"]),
    ],
  };

  return [...common, ...(extra[page.domain] || [])];
}

function abilityCards(page) {
  const base = [
    ["P4/P5", "能准确复述概念、常见流程、基本优缺点，回答不混淆术语。"],
    ["P6", "能把概念和机制连起来，说明常见失败场景、复杂度、边界条件。"],
    ["P7", "能结合生产指标、命令、日志、容量和取舍，主动补充排障证据。"],
    ["P8/P9", "能从系统设计、平台治理、风险控制和团队规范层面讲清可落地方案。"],
  ];
  return base.map(([level, text]) => `
    <li class="knowledge-card compact-card">
      <b class="knowledge-title">${level}</b>
      <p>${esc(text)}</p>
      <p class="knowledge-note">注释：复习 ${esc(page.short)} 时，把每个章节都至少提升到 P6 表达；重点章节准备 P7+ 的证据链。</p>
    </li>
  `).join("");
}

function pageCardLinks(current) {
  return pages.map((page) => {
    const active = page.output === current.output ? " active" : "";
    return `<a class="toc-pill${active}" href="${attr(page.output)}">${esc(page.short)}</a>`;
  }).join("");
}

function sourceLinks(current) {
  return pages
    .filter((page) => page.output !== current.output)
    .map((page) => `<a href="${attr(page.output)}">${esc(page.short)}</a>`)
    .join("");
}

function renderPage(page, commit, dateText) {
  const isIndex = page.output === "index.html";
  const markdown = isIndex ? "" : readSource(page);
  const headings = isIndex ? indexHeadings() : extractHeadings(markdown);
  const stats = isIndex ? aggregateIndexStats() : statsFor(markdown);
  const rendered = isIndex ? { html: "", toc: [] } : renderMarkdown(markdown);
  const title = isIndex ? "技术复习资料总览" : page.title;
  const pagePromise = isIndex
    ? "计算机网络、操作系统、数据库、设计模式、Git/REST/Linux 与 Python 的可检索离线复习入口。"
    : page.promise;
  const allPagesLinks = pageCardLinks(page);
  const related = sourceLinks(page);
  const diagrams = domainDiagrams(page, headings).join("");
  const body = rendered.html;
  const toc = (isIndex ? headings : rendered.toc)
    .filter((item) => item.level <= 3)
    .slice(0, 80)
    .map((item) => isIndex
      ? `<a class="toc-pill level-${item.level}" href="${attr(technicalPages.find((topic) => item.title.includes(topic.short))?.output ?? "#")}">${esc(item.title)}</a>`
      : `<a class="toc-pill level-${item.level}" href="#${attr(item.id)}">${esc(item.title)}</a>`)
    .join("");
  const reviewCards = isIndex ? buildIndexKnowledgeCards() : buildKnowledgeCards(headings, page);
  const originalUrl = isIndex ? sourceRepo : `${sourceRepo}/blob/${commit}/${encodeURIComponent(page.source).replace(/%2F/g, "/")}`;
  const localSource = isIndex ? "generated technical index" : page.source;
  const sourceSection = isIndex ? "" : `    <section id="source-material" class="section source-material" data-search-section>
      <h2>原文资料转写</h2>
      <p>以下内容从原始 Markdown 转为 HTML，并保留原有目录、图片、折叠追问、代码与参考链接。</p>
      <div class="source-body">${body}</div>
    </section>`;
  const attribution = isIndex
    ? `<p>本页是基于 <a href="${attr(sourceRepo)}" target="_blank" rel="noreferrer">wolverinn/Waking-Up</a> 的 GPLv3 授权技术资料生成的本地 HTML 技术索引；源提交：<code>${esc(commit)}</code>。</p>`
    : `<p>本页是基于 <a href="${attr(sourceRepo)}" target="_blank" rel="noreferrer">wolverinn/Waking-Up</a> 的 GPLv3 授权资料生成的本地 HTML 改编版。源文件：<a href="${attr(originalUrl)}" target="_blank" rel="noreferrer">${esc(page.source)}</a>，源提交：<code>${esc(commit)}</code>。</p>`;

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <style>
    :root {
      --bg: #f7f7f5;
      --paper: #ffffff;
      --book: #fbfaf7;
      --ink: #242424;
      --muted: #686868;
      --line: #e5e3dc;
      --line-strong: #d8d5cb;
      --blue: #315fbc;
      --teal: #0f766e;
      --amber: #9a6700;
      --soft-blue: #f0f5ff;
      --soft-teal: #ecfdf5;
      --soft-amber: #fff8e7;
      --soft-rose: #fff1f2;
      --shadow: 0 10px 28px rgba(36, 36, 36, .06);
      --book-shadow: 0 22px 70px rgba(36, 36, 36, .08);
      --accent: var(--${page.accent});
    }
    * { box-sizing: border-box; }
    html { scroll-behavior: smooth; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--ink);
      font-family: "Microsoft YaHei", "Noto Sans SC", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      line-height: 1.74;
      letter-spacing: 0;
    }
    a { color: var(--blue); text-decoration: none; }
    a:hover { text-decoration: underline; }
    .topbar {
      position: sticky;
      top: 0;
      z-index: 30;
      border-bottom: 1px solid var(--line);
      background: rgba(251, 250, 247, .94);
      backdrop-filter: blur(12px);
    }
    .topbar-inner {
      max-width: 1440px;
      margin: 0 auto;
      padding: 10px 18px;
      display: grid;
      grid-template-columns: minmax(180px, 1fr) minmax(220px, 420px);
      gap: 14px;
      align-items: center;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      min-width: 0;
      font-weight: 800;
      color: var(--ink);
    }
    .brand-mark {
      width: 30px;
      height: 30px;
      display: grid;
      place-items: center;
      border-radius: 8px;
      background: var(--soft-blue);
      border: 1px solid var(--line-strong);
      color: var(--blue);
      flex: none;
      font-size: 14px;
    }
    .brand span:last-child {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .searchbox {
      width: 100%;
      border: 1px solid var(--line-strong);
      border-radius: 8px;
      background: #fff;
      padding: 10px 12px;
      font-size: 14px;
      color: var(--ink);
      outline: none;
    }
    .searchbox:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px rgba(49, 95, 188, .12);
    }
    .layout {
      max-width: 1440px;
      margin: 0 auto;
      padding: 28px 18px 52px;
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 18px;
    }
    .hero {
      min-height: 360px;
      padding: 34px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background:
        linear-gradient(135deg, rgba(240, 245, 255, .86), rgba(236, 253, 245, .54) 48%, rgba(255, 248, 231, .82)),
        var(--book);
      box-shadow: var(--book-shadow);
      display: grid;
      gap: 22px;
      align-content: end;
    }
    .eyebrow {
      margin: 0;
      color: var(--accent);
      font-weight: 800;
      text-transform: uppercase;
      font-size: 13px;
    }
    h1 {
      margin: 0;
      font-size: clamp(32px, 5vw, 64px);
      line-height: 1.08;
      letter-spacing: 0;
      max-width: 980px;
    }
    .hero-copy {
      max-width: 980px;
      margin: 0;
      font-size: 18px;
      color: #3e3e3e;
    }
    .meta-grid,
    .stat-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 10px;
    }
    .meta-item,
    .stat-item {
      border: 1px solid var(--line);
      border-radius: 8px;
      background: rgba(255, 255, 255, .74);
      padding: 12px;
      min-width: 0;
    }
    .meta-item b,
    .stat-item b {
      display: block;
      font-size: 12px;
      color: var(--muted);
      margin-bottom: 4px;
    }
    .meta-item span,
    .stat-item span {
      font-weight: 800;
      overflow-wrap: anywhere;
    }
    .section {
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--paper);
      box-shadow: var(--shadow);
      padding: 26px;
    }
    .section h2 {
      margin: 0 0 14px;
      font-size: 25px;
      line-height: 1.25;
      letter-spacing: 0;
    }
    .section > p {
      margin: 8px 0 14px;
      color: #424242;
    }
    .toc-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .toc-pill {
      display: inline-flex;
      align-items: center;
      min-height: 34px;
      padding: 6px 10px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--book);
      color: var(--ink);
      font-size: 14px;
      max-width: 100%;
    }
    .toc-pill:hover,
    .toc-pill.active {
      border-color: var(--accent);
      color: var(--accent);
      text-decoration: none;
    }
    .level-3 { background: #fff; }
    .knowledge-list,
    .diagram-grid,
    .qa-grid,
    .case-grid,
    .code-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      gap: 12px;
      padding: 0;
      margin: 0;
      list-style: none;
    }
    .knowledge-card,
    .diagram-card {
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--book);
      padding: 16px;
      min-width: 0;
    }
    .compact-card { background: #fff; }
    .knowledge-title {
      display: block;
      color: var(--ink);
      font-size: 17px;
      line-height: 1.42;
      margin-bottom: 8px;
    }
    .knowledge-card p {
      margin: 8px 0 0;
      color: #3f3f3f;
    }
    .knowledge-note {
      border-left: 3px solid var(--accent);
      padding-left: 10px;
      color: #555;
      background: rgba(255, 255, 255, .58);
    }
    .diagram-card h3 {
      margin: 0 0 12px;
      font-size: 18px;
    }
    .diagram-caption {
      margin: 10px 0 0;
      color: var(--muted);
    }
    .mermaid-figure {
      margin: 0;
      padding: 12px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #fff;
      overflow-x: auto;
    }
    .mermaid {
      min-width: 620px;
    }
    .mermaid svg {
      max-width: none;
      height: auto;
    }
    .mermaid-raw {
      margin-top: 10px;
    }
    .mermaid-raw summary {
      cursor: pointer;
      color: var(--muted);
      font-size: 13px;
    }
    .mermaid-error {
      margin-top: 10px;
      border: 1px solid #fecdd3;
      border-radius: 8px;
      background: var(--soft-rose);
      color: #9f1239;
      padding: 10px;
    }
    .source-material {
      background: var(--paper);
    }
    .source-body {
      max-width: 1060px;
    }
    .source-body h1,
    .source-body h2,
    .source-body h3,
    .source-body h4 {
      scroll-margin-top: 82px;
      letter-spacing: 0;
    }
    .source-body h1 {
      font-size: 34px;
      margin: 4px 0 18px;
    }
    .source-body h2 {
      font-size: 27px;
      margin: 30px 0 12px;
    }
    .source-body h3 {
      font-size: 22px;
      margin: 28px 0 10px;
      padding-top: 6px;
      border-top: 1px solid var(--line);
    }
    .source-body h4,
    .source-body h5,
    .source-body h6 {
      font-size: 18px;
      margin: 22px 0 8px;
    }
    .source-body p {
      margin: 10px 0;
    }
    .md-list {
      display: grid;
      gap: 6px;
      margin: 10px 0 14px;
    }
    .md-list-row {
      display: grid;
      grid-template-columns: 30px minmax(0, 1fr);
      gap: 7px;
      align-items: start;
    }
    .md-list-row.depth-1 { padding-left: 20px; }
    .md-list-row.depth-2 { padding-left: 40px; }
    .md-list-row.depth-3 { padding-left: 60px; }
    .md-list-row.depth-4 { padding-left: 80px; }
    .md-list-row.depth-5 { padding-left: 100px; }
    .md-marker {
      color: var(--accent);
      font-weight: 800;
      text-align: right;
    }
    code {
      font-family: Consolas, "Cascadia Code", "SFMono-Regular", monospace;
      background: #f3f1ea;
      border: 1px solid var(--line);
      border-radius: 6px;
      padding: 1px 5px;
      font-size: .92em;
    }
    .code-block,
    .mermaid-source,
    .mermaid-raw pre {
      margin: 12px 0;
      padding: 14px;
      overflow-x: auto;
      background: #1f2937;
      color: #f8fafc;
      border-radius: 8px;
      border: 1px solid #111827;
      font-size: 13px;
      line-height: 1.62;
    }
    .code-block code,
    .mermaid-source code,
    .mermaid-raw code {
      background: transparent;
      border: 0;
      padding: 0;
      color: inherit;
    }
    blockquote {
      margin: 12px 0;
      padding: 10px 14px;
      border-left: 4px solid var(--accent);
      background: var(--soft-amber);
      color: #4b4638;
    }
    .source-detail {
      margin: 12px 0;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #fff;
      padding: 10px 12px;
    }
    .source-detail summary {
      cursor: pointer;
      color: var(--accent);
      font-weight: 800;
    }
    .source-figure,
    .source-html-center {
      margin: 16px 0;
      text-align: center;
    }
    .source-figure img,
    .inline-img {
      max-width: 100%;
      height: auto;
      border-radius: 8px;
      border: 1px solid var(--line);
      background: #fff;
    }
    .source-figure figcaption {
      margin-top: 6px;
      color: var(--muted);
      font-size: 13px;
    }
    .source-link-wrap {
      display: inline-block;
      max-width: 100%;
    }
    .table-wrap {
      overflow-x: auto;
      margin: 12px 0;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      background: #fff;
      border: 1px solid var(--line);
    }
    th,
    td {
      border: 1px solid var(--line);
      padding: 9px 10px;
      vertical-align: top;
      min-width: 110px;
    }
    th {
      background: var(--soft-blue);
      text-align: left;
    }
    .license-note {
      border: 1px solid var(--line-strong);
      background: var(--soft-amber);
      border-radius: 8px;
      padding: 14px;
    }
    .hidden-by-search { display: none !important; }
    .no-results {
      display: none;
      border: 1px solid #fecdd3;
      background: var(--soft-rose);
      color: #9f1239;
      border-radius: 8px;
      padding: 12px;
    }
    .no-results.visible { display: block; }
    @media (max-width: 720px) {
      .topbar-inner {
        grid-template-columns: minmax(0, 1fr);
      }
      .layout {
        padding: 18px 12px 36px;
      }
      .hero,
      .section {
        padding: 18px;
      }
      h1 {
        font-size: 34px;
      }
      .hero-copy {
        font-size: 16px;
      }
      .md-list-row.depth-3,
      .md-list-row.depth-4,
      .md-list-row.depth-5 {
        padding-left: 24px;
      }
      .mermaid {
        min-width: 520px;
      }
    }
  </style>
</head>
<body>
  <header class="topbar">
    <div class="topbar-inner">
      <a class="brand" href="index.html" aria-label="返回总览">
        <span class="brand-mark">WU</span>
        <span>${esc(title)}</span>
      </a>
      <input id="search" class="searchbox" type="search" placeholder="搜索本页知识点、追问、命令或章节">
    </div>
  </header>
  <main class="layout">
    <section class="hero" data-search-section>
      <div>
        <p class="eyebrow">Waking-Up HTML · GPLv3 Derived Review</p>
        <h1>${esc(title)}</h1>
      </div>
      <p class="hero-copy">${esc(pagePromise)}</p>
      <div class="meta-grid">
        <div class="meta-item"><b>源文件</b><span>${esc(localSource)}</span></div>
        <div class="meta-item"><b>源提交</b><span>${esc(commit)}</span></div>
        <div class="meta-item"><b>生成时间</b><span>${esc(dateText)} Asia/Shanghai</span></div>
        <div class="meta-item"><b>授权</b><span>GPLv3，保留原作者与来源</span></div>
      </div>
    </section>

    <section class="section" data-search-section>
      <h2>资料入口</h2>
      <div class="toc-row">${allPagesLinks}</div>
      ${related ? `<p>相关页：${related}</p>` : ""}
    </section>

    <section class="section" data-search-section>
      <h2>本页统计</h2>
      <div class="stat-grid">
        <div class="stat-item"><b>原文行数</b><span>${stats.lines}</span></div>
        <div class="stat-item"><b>标题节点</b><span>${stats.headings}</span></div>
        <div class="stat-item"><b>折叠追问</b><span>${stats.details}</span></div>
        <div class="stat-item"><b>图片</b><span>${stats.images}</span></div>
        <div class="stat-item"><b>代码块</b><span>${stats.codeBlocks}</span></div>
        <div class="stat-item"><b>列表行</b><span>${stats.listRows}</span></div>
      </div>
    </section>

    <section class="section" data-search-section>
      <h2>页内目录</h2>
      <div class="toc-row">
        <a class="toc-pill" href="#review-cards">逐章复习卡</a>
        <a class="toc-pill" href="#visual-atlas">Mermaid 图谱</a>
        <a class="toc-pill" href="#source-material">原文资料转写</a>
        <a class="toc-pill" href="#review-plan">复习计划</a>
        ${toc}
      </div>
    </section>

    ${isIndex ? renderIndexSection(commit) : ""}

    <section class="section" data-search-section>
      <h2>能力地图</h2>
      <ul class="knowledge-list">${abilityCards(page)}</ul>
    </section>

    <section id="review-cards" class="section" data-search-section>
      <h2>逐章复习卡</h2>
      <p>下面按原文标题一对一生成复习卡，不替代原文，而是帮你把每个章节转成面试表达路径。</p>
      <ul class="knowledge-list">${reviewCards}</ul>
    </section>

    <section id="visual-atlas" class="section" data-search-section>
      <h2>Mermaid 图谱</h2>
      <div class="diagram-grid">${diagrams}</div>
    </section>

    <section class="section" data-search-section>
      <h2>Mermaid 渲染说明</h2>
      <ul class="knowledge-list">
        <li class="knowledge-card">
          <b class="knowledge-title">离线阅读与源码保底</b>
          <p>页面会尝试从 jsDelivr 和 unpkg 加载 Mermaid，并使用 <code>mermaid.initialize</code> 与 <code>mermaid.run</code> 渲染图谱。</p>
          <p class="knowledge-note">注释：如果网络不可用，原始 Mermaid 源码仍然保留在 <code>mermaid-raw</code> 折叠块里，不会影响正文阅读。</p>
        </li>
      </ul>
    </section>

${sourceSection}

    <section id="review-plan" class="section" data-search-section>
      <h2>3 / 5 / 7 天复习计划</h2>
      <ul class="knowledge-list">
        <li class="knowledge-card">
          <b class="knowledge-title">3 天：先过主干</b>
          <p>第一遍只看目录、逐章复习卡和 Mermaid 图谱，把每个章节整理成一句话定义与一个典型追问。</p>
          <p class="knowledge-note">注释：这一轮不要陷入细枝末节，目标是建立完整地图。</p>
        </li>
        <li class="knowledge-card">
          <b class="knowledge-title">5 天：补齐追问</b>
          <p>第二遍打开原文折叠块，按“机制、边界、故障、指标、命令”补答案，遇到不会的地方回到原文或权威资料。</p>
          <p class="knowledge-note">注释：能讲清追问，才算从“看过”变成“能答”。</p>
        </li>
        <li class="knowledge-card">
          <b class="knowledge-title">7 天：模拟面试</b>
          <p>第三遍用页内搜索随机抽题，强迫自己 2 分钟内回答，再对照原文和复习卡补证据链。</p>
          <p class="knowledge-note">注释：最后一天只修表达，不再大面积新增材料，保证临场稳定。</p>
        </li>
      </ul>
    </section>

    <section class="section" data-search-section>
      <h2>来源与授权</h2>
      <div class="license-note">
        ${attribution}
        <p>输出目录内已复制 <code>LICENSE</code>。如果这些 HTML 被公开分发，应继续保留 GPLv3 授权、原始来源、修改说明与对应源码/生成脚本。</p>
      </div>
    </section>

    <div id="noResults" class="no-results">没有找到匹配内容。换一个关键词试试。</div>
  </main>
  <script>
    const searchInput = document.getElementById("search");
    const noResults = document.getElementById("noResults");
    const searchable = [...document.querySelectorAll("[data-search-section]")];
    searchInput.addEventListener("input", () => {
      const query = searchInput.value.trim().toLowerCase();
      let visible = 0;
      searchable.forEach((section) => {
        const haystack = section.textContent.toLowerCase();
        const match = !query || haystack.includes(query);
        section.classList.toggle("hidden-by-search", !match);
        if (match) visible += 1;
      });
      noResults.classList.toggle("visible", query && visible === 0);
    });

    async function loadMermaid() {
      const urls = [
        "https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js",
        "https://unpkg.com/mermaid@10/dist/mermaid.min.js"
      ];
      for (const url of urls) {
        try {
          await new Promise((resolve, reject) => {
            const script = document.createElement("script");
            script.src = url;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
          });
          if (window.mermaid) return window.mermaid;
        } catch {}
      }
      return null;
    }

    async function renderMermaid() {
      const blocks = [...document.querySelectorAll(".mermaid-source")];
      if (!blocks.length) return;
      const mermaidLib = await loadMermaid();
      blocks.forEach((block, index) => {
        const code = block.textContent;
        const figure = document.createElement("figure");
        figure.className = "mermaid-figure";
        const diagram = document.createElement("div");
        diagram.className = "mermaid";
        diagram.id = "mermaid-diagram-" + index;
        diagram.textContent = code;
        const raw = document.createElement("details");
        raw.className = "mermaid-raw";
        raw.innerHTML = "<summary>查看 Mermaid 源码</summary><pre><code></code></pre>";
        raw.querySelector("code").textContent = code;
        figure.appendChild(diagram);
        figure.appendChild(raw);
        block.replaceWith(figure);
      });
      if (!mermaidLib) {
        document.querySelectorAll(".mermaid-figure").forEach((figure) => {
          const error = document.createElement("div");
          error.className = "mermaid-error";
          error.textContent = "Mermaid CDN 加载失败，已保留源码。";
          figure.appendChild(error);
        });
        return;
      }
      mermaidLib.initialize({
        startOnLoad: false,
        securityLevel: "loose",
        theme: "base",
        themeVariables: {
          fontFamily: "Microsoft YaHei, Noto Sans SC, system-ui, sans-serif",
          fontSize: "15px",
          primaryColor: "#f6f5f2",
          primaryTextColor: "#242424",
          primaryBorderColor: "#d8d5cb",
          lineColor: "#6f6f6f",
          secondaryColor: "#f0f5ff",
          tertiaryColor: "#eef7f5",
          noteBkgColor: "#fff8e7",
          noteTextColor: "#242424"
        },
        flowchart: {
          htmlLabels: true,
          useMaxWidth: false,
          curve: "basis",
          nodeSpacing: 42,
          rankSpacing: 54,
          padding: 12
        },
        sequence: {
          mirrorActors: false,
          useMaxWidth: true
        }
      });
      try {
        await mermaidLib.run({ querySelector: ".mermaid" });
      } catch (error) {
        document.querySelectorAll(".mermaid-figure").forEach((figure) => {
          if (figure.querySelector("svg")) return;
          const box = document.createElement("div");
          box.className = "mermaid-error";
          box.textContent = "Mermaid 渲染失败：" + (error && error.message ? error.message : String(error));
          figure.appendChild(box);
        });
      }
    }
    renderMermaid();
  </script>
</body>
</html>`;
}

function renderIndexSection(commit) {
  const cards = technicalPages.map((page) => `
    <li class="knowledge-card" data-search="${attr(`${page.title} ${page.promise}`)}">
      <b class="knowledge-title"><a href="${attr(page.output)}">${esc(page.title)}</a></b>
      <p>${esc(page.promise)}</p>
      <p class="knowledge-note">注释：源文件 <code>${esc(page.source)}</code> 已生成一对一 HTML：<a href="${attr(page.output)}">${esc(page.output)}</a>。</p>
    </li>
  `).join("");
  return `
    <section class="section" data-search-section>
      <h2>技术 HTML 资料包</h2>
      <p>本目录将 Waking-Up 仓库当前提交 <code>${esc(commit)}</code> 中的 6 个技术 Markdown 文件转换成独立 HTML。</p>
      <ul class="knowledge-list">${cards}</ul>
    </section>
  `;
}

function pruneUnusedImages() {
  const assetDir = path.join(outDir, "_v_images");
  if (!fs.existsSync(assetDir)) return [];
  const used = new Set();
  for (const htmlFile of fs.readdirSync(outDir).filter((file) => file.endsWith(".html"))) {
    const html = fs.readFileSync(path.join(outDir, htmlFile), "utf8");
    for (const match of html.matchAll(/(?:src|href)="(_v_images\/[^"#?]+)[^"]*"/g)) {
      used.add(match[1].replace(/\//g, path.sep));
    }
  }

  const removed = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        if (fs.readdirSync(full).length === 0) fs.rmdirSync(full);
        continue;
      }
      const rel = path.relative(outDir, full);
      if (!used.has(rel)) {
        fs.rmSync(full);
        removed.push(rel.replace(/\\/g, "/"));
      }
    }
  };
  walk(assetDir);
  return removed;
}

function writeOutputs() {
  if (!fs.existsSync(sourceRoot)) {
    throw new Error(`Source repo not found: ${sourceRoot}`);
  }
  fs.mkdirSync(outDir, { recursive: true });

  const images = path.join(sourceRoot, "_v_images");
  if (fs.existsSync(images)) {
    fs.cpSync(images, path.join(outDir, "_v_images"), { recursive: true, force: true });
  }

  const license = path.join(sourceRoot, "LICENSE");
  if (fs.existsSync(license)) {
    fs.copyFileSync(license, path.join(outDir, "LICENSE"));
  }

  const commit = sourceCommit();
  const dateText = generatedAt();
  const manifest = {
    generatedAt: dateText,
    timezone: "Asia/Shanghai",
    sourceRepo,
    sourceCommit: commit,
    files: [],
  };

  for (const page of pages) {
    const output = path.join(outDir, page.output);
    const html = renderPage(page, commit, dateText);
    fs.writeFileSync(output, html, "utf8");
    manifest.files.push({
      source: page.output === "index.html" ? "generated technical index" : page.source,
      output: page.output,
      title: page.output === "index.html" ? "技术复习资料总览" : page.title,
      sourceUrl: page.output === "index.html"
        ? sourceRepo
        : `${sourceRepo}/blob/${commit}/${encodeURIComponent(page.source).replace(/%2F/g, "/")}`,
    });
  }

  const removedImages = pruneUnusedImages();
  manifest.removedUnusedAssets = removedImages;

  fs.writeFileSync(path.join(outDir, "source-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  const notice = [
    "# Waking-Up Technical HTML Review Pack",
    "",
    `Generated at: ${dateText} Asia/Shanghai`,
    `Source: ${sourceRepo}`,
    `Source commit: ${commit}`,
    "",
    "This directory contains GPLv3-derived local HTML versions of the technical Waking-Up review materials.",
    "Keep LICENSE, attribution, source links, and this generator script when distributing modified versions.",
    "",
    "Technical mapping:",
    ...manifest.files.map((file) => `- ${file.source} -> ${file.output}`),
    "",
  ].join("\n");
  fs.writeFileSync(path.join(outDir, "README.md"), notice, "utf8");

  return manifest;
}

const manifest = writeOutputs();
console.log(JSON.stringify({
  ok: true,
  outDir,
  files: manifest.files.map((file) => file.output),
}, null, 2));

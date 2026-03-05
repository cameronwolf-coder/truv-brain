// Pipedream Step: parse_notion_page
// Queries Notion DB for latest "Ready" entry, fetches page blocks,
// parses into SendGrid template variables
// Requires: Notion app connected

export default defineComponent({
  props: {
    notion: {
      type: "app",
      app: "notion",
    },
  },
  async run({ steps, $ }) {
    const pages = steps.query_a_database.$return_value?.results;

    if (!pages || pages.length === 0) {
      $.flow.exit("No Notion pages with Status = 'Ready' found. Mark the entry as Ready first.");
    }

    const page = pages[0];
    const props = page.properties;

    function getProp(name) {
      const prop = props[name];
      if (!prop) return "";
      if (prop.type === "rich_text") return prop.rich_text?.map(t => t.plain_text).join("") || "";
      if (prop.type === "title") return prop.title?.map(t => t.plain_text).join("") || "";
      if (prop.type === "url") return prop.url || "";
      return "";
    }

    function richTextToHtml(richTextArray) {
      if (!richTextArray || richTextArray.length === 0) return "";
      return richTextArray.map(rt => {
        let text = rt.plain_text || "";
        text = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        if (rt.annotations?.bold) text = `<strong>${text}</strong>`;
        if (rt.annotations?.italic) text = `<em>${text}</em>`;
        if (rt.annotations?.underline) text = `<u>${text}</u>`;
        if (rt.annotations?.strikethrough) text = `<s>${text}</s>`;
        if (rt.annotations?.code) text = `<code>${text}</code>`;
        if (rt.href) text = `<a href="${rt.href}" style="color:#2c64e3;">${text}</a>`;
        return text;
      }).join("");
    }

    const headers = {
      "Authorization": `Bearer ${this.notion.$auth.oauth_access_token}`,
      "Notion-Version": "2022-06-28",
    };

    let allBlocks = [];
    let nextCursor = undefined;
    let hasMore = true;

    while (hasMore) {
      const url = new URL(`https://api.notion.com/v1/blocks/${page.id}/children`);
      url.searchParams.set("page_size", "100");
      if (nextCursor) url.searchParams.set("start_cursor", nextCursor);

      const resp = await fetch(url.toString(), { headers });
      const data = await resp.json();

      if (!resp.ok) {
        $.flow.exit(`Failed to fetch page blocks: ${data.message || resp.statusText}`);
      }

      allBlocks = allBlocks.concat(data.results || []);
      hasMore = data.has_more;
      nextCursor = data.next_cursor;
    }

    let intro_parts = [];
    let highlights = [];
    let sections = [];
    let outro_parts = [];
    let currentSection = null;
    let foundFirstHeading = false;
    let foundFirstBullet = false;

    let lastHeadingIdx = -1;
    for (let i = allBlocks.length - 1; i >= 0; i--) {
      if (allBlocks[i].type?.startsWith("heading_")) {
        lastHeadingIdx = i;
        break;
      }
    }

    for (let i = 0; i < allBlocks.length; i++) {
      const block = allBlocks[i];
      const type = block.type;

      if (type?.startsWith("heading_")) {
        foundFirstHeading = true;
        if (currentSection) sections.push(currentSection);
        currentSection = { title: richTextToHtml(block[type].rich_text), bullets: [], image: null };

      } else if (type === "bulleted_list_item") {
        foundFirstBullet = true;
        if (!foundFirstHeading) {
          highlights.push(richTextToHtml(block.bulleted_list_item.rich_text));
        } else if (currentSection) {
          currentSection.bullets.push(richTextToHtml(block.bulleted_list_item.rich_text));
        }

      } else if (type === "image") {
        if (currentSection) {
          const imgUrl = block.image.type === "external"
            ? block.image.external?.url
            : block.image.file?.url;
          if (imgUrl) currentSection.image = imgUrl;
        }

      } else if (type === "paragraph") {
        const html = richTextToHtml(block.paragraph?.rich_text);
        if (!html.trim()) continue;
        if (!foundFirstBullet && !foundFirstHeading) {
          intro_parts.push(html);
        } else if (foundFirstHeading && i > lastHeadingIdx) {
          outro_parts.push(html);
        }
      }
    }

    if (currentSection) sections.push(currentSection);

    const templateData = {
      subject: getProp("subject"),
      preview_text: getProp("preview_text"),
      hero_date: getProp("hero_date"),
      hero_button_text: getProp("hero_button_text"),
      cta_url: getProp("cta_url"),
      cta_button_text: getProp("cta_button_text"),
    };

    if (intro_parts.length > 0) templateData.intro_text = intro_parts.join("<br>");

    highlights.slice(0, 5).forEach((h, i) => { templateData[`highlight_${i + 1}`] = h; });

    sections.slice(0, 5).forEach((s, i) => {
      const n = i + 1;
      templateData[`section_${n}_title`] = s.title;
      if (s.image) templateData[`section_${n}_image`] = s.image;
      s.bullets.slice(0, 5).forEach((b, j) => { templateData[`section_${n}_bullet_${j + 1}`] = b; });
    });

    if (outro_parts.length > 0) templateData.outro_text = outro_parts.join("<br>");

    const required = ["subject", "preview_text", "hero_date"];
    const missing = required.filter(f => !templateData[f]);
    if (missing.length > 0) $.flow.exit(`Missing required properties: ${missing.join(", ")}`);
    if (highlights.length === 0) $.flow.exit("No highlights found. Add a bullet list before the first heading.");
    if (!templateData.intro_text) $.flow.exit("No intro text found. Add a paragraph before the bullet list.");

    const cleanedData = {};
    for (const [key, value] of Object.entries(templateData)) {
      if (value && String(value).trim() !== "") cleanedData[key] = value;
    }

    return {
      templateData: cleanedData,
      notionPageId: page.id,
      emailSubject: cleanedData.subject,
      fieldCount: Object.keys(cleanedData).length,
      highlightCount: highlights.length,
      sectionCount: sections.length,
    };
  },
});

import "dotenv/config";
import { pool } from "../server/db.js";
import { getPlainTextLength, sanitizeBlogHtml } from "../server/blog/content-validator.js";
import { insertBlogPostSchema } from "../shared/schema.js";

const DAY_MS = 24 * 60 * 60 * 1000;

const examples = [
  {
    title: "5 Repetitive Tasks Every Small Business Should Automate",
    slug: "5-repetitive-tasks-small-business-should-automate",
    excerpt: "Five practical automations that save time, improve response speed, and keep everyday work from falling through the cracks.",
    metaDescription: "Discover five repetitive small-business tasks worth automating, from lead follow-up and scheduling to estimates and customer reminders.",
    focusKeyword: "small business automation",
    tags: "Automation,Small Business,AI",
    daysAgo: 2,
    content: `
      <p>Small business owners rarely run out of ideas. What they run out of is time. The same tasks appear every day: answering familiar questions, confirming appointments, preparing estimates, following up with leads, and copying information between tools. Each task looks small, but together they can consume hours every week.</p>
      <p>Automation does not mean replacing the human side of your business. It means letting software handle predictable steps so your team can focus on conversations, decisions, and customer experience.</p>
      <h2>1. Lead response and follow-up</h2>
      <p>A potential customer is most interested right after reaching out. An automated response can confirm that the message was received, ask a few qualifying questions, and notify the right person. Follow-up reminders can continue until the lead replies, books, or asks to stop.</p>
      <h2>2. Appointment scheduling</h2>
      <p>Back-and-forth scheduling creates unnecessary delays. A booking page can show real availability, collect the information you need, send confirmations, and remind customers before the appointment. Your team still controls the calendar without manually coordinating every time slot.</p>
      <h2>3. Estimates and proposals</h2>
      <p>If pricing follows a repeatable structure, an estimate should not start from a blank document. A digital price book lets you select services, adjust quantities, and generate a professional proposal in minutes. Consistent estimates also reduce pricing mistakes.</p>
      <h2>4. Customer reminders</h2>
      <p>Payment reminders, renewal notices, review requests, and post-service check-ins are ideal automation candidates. The message can still sound personal while the system makes sure it is sent at the right moment.</p>
      <h2>5. Moving information between systems</h2>
      <p>A website form should not require someone to retype the same lead into a CRM, spreadsheet, and email list. Connecting the tools creates one reliable flow and gives the team a clearer view of every opportunity.</p>
      <h2>Start with one bottleneck</h2>
      <p>The best first automation is not necessarily the most impressive one. Choose the repetitive task that causes the most delays or missed opportunities. Document the current process, simplify it, and automate one step at a time. A useful automation should make work easier to understand, not add another complicated system to manage.</p>
    `,
  },
  {
    title: "What Makes a Service Business Website Actually Convert?",
    slug: "service-business-website-that-converts",
    excerpt: "A high-converting website makes the next step obvious, builds trust quickly, and works just as well on a phone as it does on a desktop.",
    metaDescription: "Learn the essential elements of a service business website that turns visitors into calls, messages, and booked appointments.",
    focusKeyword: "service business website",
    tags: "Websites,Lead Generation,Small Business",
    daysAgo: 1,
    content: `
      <p>A good-looking website is valuable, but appearance alone does not produce leads. A service business website has a specific job: help the right visitor understand the offer, trust the company, and take the next step without confusion.</p>
      <p>The strongest sites are usually not the most complicated. They are clear, fast, credible, and focused on the customer's decision.</p>
      <h2>Lead with the outcome</h2>
      <p>Your homepage should quickly answer three questions: what do you do, who do you help, and what should the visitor do next? A headline such as “Professional home cleaning in Framingham” is more useful than a vague slogan because it gives the visitor immediate context.</p>
      <h2>Make one primary action obvious</h2>
      <p>Do not make visitors search for the contact button. Choose the most important action—call, request an estimate, send a message, or book an appointment—and make it visible throughout the page. Secondary options are helpful, but they should not compete with the main goal.</p>
      <h2>Show proof near the decision</h2>
      <p>Reviews, project photos, certifications, service areas, and clear guarantees reduce uncertainty. Place proof close to calls to action instead of hiding everything on a separate page. Visitors often decide whether to contact you within a few moments.</p>
      <h2>Design for mobile first</h2>
      <p>Many local-service customers arrive from Google Maps, social media, or a text message. They are already on a phone. Buttons should be easy to tap, forms should be short, and essential information should load quickly without oversized images or distracting animation.</p>
      <h2>Answer the questions that block action</h2>
      <p>Customers hesitate when pricing, timing, service areas, or the process feels unclear. A useful website explains what happens after someone reaches out. Even when exact prices vary, you can describe starting points, the factors that affect cost, and how estimates work.</p>
      <h2>Measure real conversions</h2>
      <p>Page views do not tell the whole story. Track calls, form submissions, booking clicks, and qualified leads. These signals show which pages and offers contribute to revenue. A website becomes more valuable when it is treated as an operating tool that can be improved over time.</p>
    `,
  },
  {
    title: "How to Stop Losing Leads After the First Message",
    slug: "stop-losing-leads-after-first-message",
    excerpt: "A simple lead-management process can prevent slow replies, forgotten follow-ups, and valuable opportunities disappearing between tools.",
    metaDescription: "Build a practical lead follow-up process that improves response time, keeps conversations organized, and prevents missed opportunities.",
    focusKeyword: "lead follow-up process",
    tags: "CRM,Lead Generation,Automation",
    daysAgo: 0,
    content: `
      <p>Most businesses do not lose every lead because of price or competition. Many opportunities disappear for simpler reasons: the first reply took too long, the conversation stayed in one person's inbox, or nobody knew who should follow up next.</p>
      <p>A reliable lead process does not need to be complicated. It needs clear ownership, consistent stages, and enough automation to keep important conversations visible.</p>
      <h2>Respond while interest is high</h2>
      <p>The first response should be immediate, even when a team member is not available. A confirmation message can set expectations, collect missing details, and offer a booking link. The goal is not to pretend that a robot is a person; it is to keep the customer moving forward.</p>
      <h2>Keep every lead in one place</h2>
      <p>When website forms, calls, social messages, and referrals live in separate tools, follow-up becomes inconsistent. A CRM creates a shared record of the contact, the source, the conversation, and the next action. Anyone on the team can see what has already happened.</p>
      <h2>Use simple pipeline stages</h2>
      <p>Stages should describe meaningful progress: new lead, contacted, qualified, estimate sent, won, or lost. Too many stages create busywork. Too few make it difficult to understand the pipeline. Every open lead should have both an owner and a next step.</p>
      <h2>Automate reminders without sounding robotic</h2>
      <p>A lead may be busy, comparing options, or waiting for the right time. Thoughtful follow-up can include a short reminder, a helpful answer, or a clear invitation to book. Space messages appropriately and stop the sequence when the person replies.</p>
      <h2>Review the leaks every week</h2>
      <p>Look for leads with no response, estimates with no follow-up, and opportunities sitting in the same stage for too long. A short weekly review reveals where the process needs attention. Over time, response time, appointment rate, and close rate become useful signals for improvement.</p>
      <blockquote>A CRM is most valuable when it helps people take the next action, not when it simply stores contact information.</blockquote>
      <p>The result is a calmer sales process: customers receive faster answers, the team knows what to do next, and fewer opportunities are lost because someone forgot to follow up.</p>
    `,
  },
] as const;

async function main() {
  const created: Array<{ id: number; title: string; slug: string }> = [];
  const skipped: string[] = [];
  const client = await pool.connect();

  try {
    await client.query("begin");

    // Production carries a legacy tenant_id column that predates the current
    // single-site TypeScript schema. Resolve it instead of hard-coding an id.
    const tenants = await client.query<{ id: number }>(
      "select id from tenants where status = 'live' order by id limit 2",
    );
    if (tenants.rowCount !== 1) {
      throw new Error(`Expected exactly one live tenant, found ${tenants.rowCount}`);
    }
    const tenantId = tenants.rows[0].id;

    for (const example of examples) {
      const existing = await client.query<{ id: number }>(
        "select id from blog_posts where slug = $1 limit 1",
        [example.slug],
      );

      if (existing.rowCount) {
        skipped.push(example.slug);
        continue;
      }

      const content = sanitizeBlogHtml(example.content.trim());
      const textLength = getPlainTextLength(content);
      if (textLength < 600 || textLength > 4000) {
        throw new Error(`${example.slug} has an invalid plain-text length: ${textLength}`);
      }

      const values = insertBlogPostSchema.parse({
        title: example.title,
        slug: example.slug,
        content,
        excerpt: example.excerpt,
        metaDescription: example.metaDescription,
        focusKeyword: example.focusKeyword,
        tags: example.tags,
        featureImageUrl: null,
        status: "published",
        authorName: "Skale Club",
        publishedAt: new Date(Date.now() - example.daysAgo * DAY_MS),
      });

      const result = await client.query<{ id: number; title: string; slug: string }>(
        `insert into blog_posts (
          title, slug, content, excerpt, meta_description, focus_keyword, tags,
          feature_image_url, status, author_name, published_at, tenant_id
        ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        returning id, title, slug`,
        [
          values.title,
          values.slug,
          values.content,
          values.excerpt,
          values.metaDescription,
          values.focusKeyword,
          values.tags,
          values.featureImageUrl,
          values.status,
          values.authorName,
          values.publishedAt,
          tenantId,
        ],
      );
      created.push(result.rows[0]);
    }

    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }

  console.log(JSON.stringify({ created, skipped }, null, 2));
}

main()
  .catch((error) => {
    console.error("Example blog seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });

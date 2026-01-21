
export const ICP_TEMPLATE = `
<h1>Ideal Customer Profile (ICP)</h1>

<h2>1. Demographics</h2>
<table class="border-collapse w-full my-4">
    <thead>
        <tr>
            <th class="border border-zinc-300 p-2 bg-zinc-50 text-left">Attribute</th>
            <th class="border border-zinc-300 p-2 bg-zinc-50 text-left">Description</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td class="border border-zinc-300 p-2"><strong>Job Title</strong></td>
            <td class="border border-zinc-300 p-2">Founder, CEO, VP of Marketing</td>
        </tr>
        <tr>
            <td class="border border-zinc-300 p-2"><strong>Industry</strong></td>
            <td class="border border-zinc-300 p-2">B2B SaaS, Fintech</td>
        </tr>
        <tr>
            <td class="border border-zinc-300 p-2"><strong>Company Size</strong></td>
            <td class="border border-zinc-300 p-2">10-50 Employees ($1M - $10M ARR)</td>
        </tr>
        <tr>
            <td class="border border-zinc-300 p-2"><strong>Location</strong></td>
            <td class="border border-zinc-300 p-2">North America, Europe (Remote-first)</td>
        </tr>
    </tbody>
</table>

<h2>2. Psychographics</h2>
<ul>
    <li><strong>Goals:</strong> Wants to scale revenue without hiring a massive sales team.</li>
    <li><strong>Fears:</strong> Wasting budget on ads that don't convert; "Burnout" from manual outreach.</li>
    <li><strong>Values:</strong> Speed, Automation, Data-driven decisions.</li>
</ul>

<h2>3. Pain Points Analysis</h2>
<h3>Primary Pain: Lack of Predictable Pipeline</h3>
<p>They rely on referrals and founder-led sales. They don't have a systematic way to generate leads every month.</p>

<h3>Secondary Pain: Fragmented Tools</h3>
<p>They use 5 different tools for email, CRM, and data, making the process messy and expensive.</p>

<h2>4. The Solution Mapping</h2>
<p>How our product solves these specific pains...</p>
`;

export const EMAIL_SEQUENCE_TEMPLATE = `
<h1>Cold Email Sequence (3-Step)</h1>

<h2>Email 1: The Value Hook</h2>
<p><strong>Subject:</strong> Quick question about {{Company}}'s growth</p>
<p>Hi {{FirstName}},</p>
<p>I saw that {{Company}} recently [Personalization Trigger]. Congrats on the momentum.</p>
<p>Most founders I talk to at this stage struggle with [Pain Point]. We built a system that helps you [Value Proposition] without [Common Objection].</p>
<p>Is this a priority for Q4?</p>
<p>Best,<br>[Your Name]</p>

<hr />

<h2>Email 2: The Social Proof (Follow-up + 3 Days)</h2>
<p><strong>Subject:</strong> Re: Quick question</p>
<p>Hi {{FirstName}},</p>
<p>Just floating this to the top of your inbox.</p>
<p>We recently helped [Competitor/Peer] achieve [Specific Result] in just 30 days using this exact framework.</p>
<p>Here is a link to the case study: [Link]</p>
<p>Worth a 5-minute chat?</p>

<hr />

<h2>Email 3: The Breakup (Follow-up + 7 Days)</h2>
<p><strong>Subject:</strong> Timing?</p>
<p>Hi {{FirstName}},</p>
<p>I assume getting [Result] isn't a priority right now, so I'll stop reaching out.</p>
<p>Here is a resource on [Topic] if you ever want to revisit this strategy later.</p>
<p>Best,<br>[Your Name]</p>
`;

export const LINKEDIN_POST_TEMPLATE = `
<h1>LinkedIn Post Framework</h1>

<h2>1. The Hook (First 2 Lines)</h2>
<p><strong>Goal:</strong> Stop the scroll. Make a bold claim or ask a counter-intuitive question.</p>
<p><em>Example: "Most founders execute sales completely backwards."</em></p>
<p><br/></p>

<h2>2. The Meat (Value/Insight)</h2>
<p>Expand on the hook. Provide 3 specific actionable tips or a story.</p>
<ul>
    <li>Point 1: ...</li>
    <li>Point 2: ...</li>
    <li>Point 3: ...</li>
</ul>

<h2>3. The Call to Action (CTA)</h2>
<p>Ask for engagement (comment) or direct them to a link in comments.</p>
<p><em>"PS. I wrote a full guide on this. Comment 'GUIDE' and I'll send it over."</em></p>

<hr />

<p><strong>Constraints:</strong> Keep under 1300 characters. Use short paragraphs.</p>
`;

export const REDDIT_POST_TEMPLATE = `
<h1>Reddit Community Post</h1>

<h2>Title</h2>
<p><strong>Format:</strong> [Result] in [Timeframe] without [Pain Point]</p>
<p><em>Example: "How we hit $10k MRR in 60 days without spending $1 on ads"</em></p>

<h2>Body</h2>
<p><strong>Context:</strong> Briefly explain who you are (establish authority without selling).</p>
<p><strong>The Story/Process:</strong> Break down exactly how you did it. Give away the "secret sauce" for free. Reddit hates gatekeepers.</p>
<ol>
    <li>Step 1: ...</li>
    <li>Step 2: ...</li>
    <li>Step 3: ...</li>
</ol>

<h2>The "First Comment" Strategy</h2>
<p><strong>Plan:</strong> Post a comment immediately after publishing with a link to the tool/resource mentioned, but only if the post gains traction or people ask.</p>
`;

export const POSITIONING_MATRIX_TEMPLATE = `
<h1>Positioning Matrix: Us vs. Them</h1>

<table class="border-collapse w-full my-4">
    <thead>
        <tr>
            <th class="border border-zinc-300 p-2 bg-zinc-50 text-left">Feature / Benefit</th>
            <th class="border border-zinc-300 p-2 bg-indigo-50 text-left">Our Solution</th>
            <th class="border border-zinc-300 p-2 bg-zinc-50 text-left">Competitor A (Enterprise)</th>
            <th class="border border-zinc-300 p-2 bg-zinc-50 text-left">Competitor B (Low Cost)</th>
        </tr>
    </thead>
    <tbody>
        <tr>
            <td class="border border-zinc-300 p-2"><strong>Core Value Prop</strong></td>
            <td class="border border-zinc-300 p-2">All-in-one GTM OS</td>
            <td class="border border-zinc-300 p-2">Complex ERP</td>
            <td class="border border-zinc-300 p-2">Simple Task List</td>
        </tr>
        <tr>
            <td class="border border-zinc-300 p-2"><strong>Pricing Model</strong></td>
            <td class="border border-zinc-300 p-2">Flat Monthly</td>
            <td class="border border-zinc-300 p-2">Expensive Annual Contracts</td>
            <td class="border border-zinc-300 p-2">Freemium / Per User</td>
        </tr>
        <tr>
            <td class="border border-zinc-300 p-2"><strong>Time to Value</strong></td>
            <td class="border border-zinc-300 p-2">Hours</td>
            <td class="border border-zinc-300 p-2">Months</td>
            <td class="border border-zinc-300 p-2">Minutes</td>
        </tr>
        <tr>
            <td class="border border-zinc-300 p-2"><strong>Key Differentiator</strong></td>
            <td class="border border-zinc-300 p-2">Strategy + Execution Linked</td>
            <td class="border border-zinc-300 p-2">Deep Reporting</td>
            <td class="border border-zinc-300 p-2">Ease of Use</td>
        </tr>
    </tbody>
</table>
`;

export const SEO_BLOG_POST_TEMPLATE = `
<h1>SEO Blog Post Outline</h1>

<p><strong>Target Keyword:</strong> [Enter Keyword]</p>
<p><strong>Meta Description:</strong> [155 characters max]</p>

<h2>H1: [Engaging Title containing Keyword]</h2>

<h3>Introduction</h3>
<p>Hook the reader. Define the problem. State the thesis.</p>

<h3>H2: What is [Topic]?</h3>
<p>Definition and context.</p>

<h3>H2: Why [Topic] Matters in 2024</h3>
<p>Industry trends and urgency.</p>

<h3>H2: Step-by-Step Guide</h3>
<ul>
    <li><strong>Step 1:</strong> Detail...</li>
    <li><strong>Step 2:</strong> Detail...</li>
</ul>

<h3>Conclusion</h3>
<p>Summary and CTA.</p>
`;

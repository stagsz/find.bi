export default function HelpPage() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-10 text-gray-100">
      <h1 className="text-3xl font-bold mb-2">How find.bi works</h1>
      <p className="text-gray-400 mb-8">
        find.bi is a self-serve BI tool. Upload your data, explore it with SQL
        or AI, build dashboards, and get notified when something changes.
      </p>

      {/* ── Upload ── */}
      <Section title="1. Upload your data" icon="⬆️">
        <p>
          Go to <strong>Upload</strong> in the sidebar. Drag and drop a CSV,
          Excel, or JSON file — or connect a live database under{" "}
          <strong>Connections</strong>. Your data is stored in-browser using
          DuckDB-WASM, so nothing leaves your machine unless you push it to a
          connected source.
        </p>
      </Section>

      {/* ── SQL Editor ── */}
      <Section title="2. Query with SQL" icon="🖥️">
        <p>
          Open the <strong>SQL Editor</strong>. Write any DuckDB-compatible SQL
          against your uploaded tables. Results appear in a table below. You can
          export results as CSV, Excel, or JSON using the export buttons.
        </p>
        <Code>{`SELECT region, SUM(revenue) AS total
FROM sales
GROUP BY region
ORDER BY total DESC;`}</Code>
      </Section>

      {/* ── AI Chat ── */}
      <Section title="3. Ask the AI assistant" icon="🤖">
        <p>
          Click the <strong>chat icon</strong> in the top bar to open the AI
          panel. Type a question in plain English — the assistant translates it
          to SQL, runs it, and explains the result. You can also use{" "}
          <strong>voice</strong>: hold the microphone button, speak your
          question, and release.
        </p>
        <ul className="list-disc list-inside mt-2 space-y-1 text-gray-300">
          <li>"Show me the top 10 customers by revenue"</li>
          <li>"Which products had negative growth last month?"</li>
          <li>"Compare this week vs last week"</li>
        </ul>
      </Section>

      {/* ── Dashboards ── */}
      <Section title="4. Build dashboards" icon="📊">
        <p>
          Go to <strong>Dashboards</strong> and click <em>New dashboard</em>.
          Add cards — each card runs a SQL query and renders as a chart (bar,
          line, pie, map) or a table. Drag cards to rearrange. Charts can be
          exported as PNG.
        </p>
      </Section>

      {/* ── Connections ── */}
      <Section title="5. Connect a database" icon="🔌">
        <p>
          Under <strong>Connections</strong> you can add PostgreSQL, MySQL, or
          SQLite sources. Credentials are encrypted with Fernet before being
          stored. Once connected, tables from that source are available in the
          SQL Editor just like uploaded files.
        </p>
      </Section>

      {/* ── Webhooks ── */}
      <Section title="6. Ingest data via webhooks" icon="🔗">
        <p>
          Go to <strong>Webhooks</strong> and create a webhook endpoint. You'll
          get a URL and an API key. POST JSON to that URL from any external
          system (e.g. a form, a Zapier zap, a cron job) and the data lands
          directly in your workspace.
        </p>
        <Code>{`curl -X POST https://your-findbi-url/api/webhooks/MY_WS/ingest \\
  -H "X-API-Key: YOUR_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"event":"sale","amount":199}'`}</Code>
      </Section>

      {/* ── Schedules ── */}
      <Section title="7. Schedule queries" icon="🕐">
        <p>
          Under <strong>Schedules</strong> you can run any SQL query
          automatically on a cron schedule (e.g. every hour, every morning).
          Results are stored so you can track changes over time or feed them
          into alerts.
        </p>
      </Section>

      {/* ── Alerts ── */}
      <Section title="8. Set up alerts" icon="🔔">
        <p>
          Go to <strong>Alerts</strong> to create a condition on any query — for
          example "notify me when revenue drops below 10 000". Notifications are
          sent via email (SMTP) or as a webhook POST to a URL of your choice.
        </p>
      </Section>

      {/* ── Tips ── */}
      <Section title="Tips & shortcuts" icon="💡">
        <ul className="list-disc list-inside space-y-1 text-gray-300">
          <li>Collapse the sidebar with the arrow button to get more screen space.</li>
          <li>The AI chat remembers context within a session — follow-up questions work.</li>
          <li>Voice history is saved per session — reopen the transcript panel (bottom-right) to re-run a past query.</li>
          <li>All exports (CSV, Excel, JSON, PNG) are available per table and per chart.</li>
        </ul>
      </Section>
    </div>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-8">
      <h2 className="text-xl font-semibold mb-2 flex items-center gap-2">
        <span>{icon}</span>
        <span>{title}</span>
      </h2>
      <div className="text-gray-300 leading-relaxed">{children}</div>
    </div>
  );
}

function Code({ children }: { children: string }) {
  return (
    <pre className="mt-3 bg-[#1A1A1A] border border-[#2A2A2A] rounded p-3 text-sm text-green-400 overflow-x-auto whitespace-pre-wrap">
      {children}
    </pre>
  );
}

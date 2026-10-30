import React, { useState } from "react";

/**
 * PerformanceConcurrency.jsx
 *
 * A self-contained React component inspired by the GitHub Projects issue shown
 * in the reference screenshot. It includes working status/priority controls,
 * issue editing, comments, sub-issue/artifact actions, and project fields.
 *
 * Usage:
 *   import PerformanceConcurrency from "./PerformanceConcurrency";
 *   export default function App() {
 *     return <PerformanceConcurrency />;
 *   }
 *
 * No external UI library is required.
 */

const initialComments = [];

export default function PerformanceConcurrency() {
  const [title, setTitle] = useState("Performance & Concurrency");
  const [description, setDescription] = useState(
    "The system must support multiple concurrent Student sessions without significant performance degradation"
  );
  const [status, setStatus] = useState("In progress");
  const [priority, setPriority] = useState("P1");
  const [estimate, setEstimate] = useState("5");
  const [assignee, setAssignee] = useState("keertikeshaveswaran2006");
  const [labels, setLabels] = useState([]);
  const [sprint, setSprint] = useState("sprint 2");
  const [commentText, setCommentText] = useState("");
  const [comments, setComments] = useState(initialComments);
  const [showEdit, setShowEdit] = useState(false);
  const [draftTitle, setDraftTitle] = useState(title);
  const [draftDescription, setDraftDescription] = useState(description);
  const [showSubIssue, setShowSubIssue] = useState(false);
  const [subIssues, setSubIssues] = useState([]);
  const [subIssueTitle, setSubIssueTitle] = useState("");
  const [showArtifact, setShowArtifact] = useState(false);
  const [artifactUrl, setArtifactUrl] = useState("");
  const [artifacts, setArtifacts] = useState([]);
  const [activity, setActivity] = useState([
    "github-project-automation added this to @kaushikk311's online-quiz-system",
    "kaushikk311 assigned keertikeshaveswaran2006",
    "kaushikk311 added this to sprint 2 milestone",
    "kaushikk311 moved this from Backlog to Ready",
    "keertikeshaveswaran2006 moved this from Ready to In progress",
  ]);

  const addActivity = (message) => {
    setActivity((items) => [message, ...items]);
  };

  const saveIssue = (event) => {
    event.preventDefault();
    setTitle(draftTitle.trim() || title);
    setDescription(draftDescription.trim() || description);
    setShowEdit(false);
    addActivity("You edited the issue details");
  };

  const addComment = (event) => {
    event.preventDefault();
    const body = commentText.trim();
    if (!body) return;
    setComments((items) => [
      ...items,
      { id: Date.now(), body, date: new Date().toLocaleString() },
    ]);
    setCommentText("");
    addActivity("you added a comment");
  };

  const addSubIssue = (event) => {
    event.preventDefault();
    const value = subIssueTitle.trim();
    if (!value) return;
    setSubIssues((items) => [...items, { id: Date.now(), title: value, done: false }]);
    setSubIssueTitle("");
    setShowSubIssue(false);
    addActivity(`You created sub-issue: ${value}`);
  };

  const addArtifact = (event) => {
    event.preventDefault();
    const value = artifactUrl.trim();
    if (!value) return;
    setArtifacts((items) => [...items, { id: Date.now(), url: value }]);
    setArtifactUrl("");
    setShowArtifact(false);
    addActivity("You added an artifact");
  };

  const changeStatus = (value) => {
    if (value !== status) {
      addActivity(`You changed status from ${status} to ${value}`);
      setStatus(value);
    }
  };

  const toggleSubIssue = (id) => {
    setSubIssues((items) =>
      items.map((item) => item.id === id ? { ...item, done: !item.done } : item)
    );
  };

  const toggleLabel = (label) => {
    setLabels((items) =>
      items.includes(label) ? items.filter((item) => item !== label) : [...items, label]
    );
  };

  return (
    <div className="pc-app">
      <style>{`
        * { box-sizing: border-box; }
        .pc-app { min-height: 100vh; background: #0d1117; color: #e6edf3; font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
        .pc-topbar { height: 58px; display:flex; align-items:center; gap:18px; padding:0 22px; border-bottom:1px solid #30363d; background:#010409; }
        .pc-mark { width:30px;height:30px;border-radius:50%;background:#f0f6fc;color:#0d1117;display:grid;place-items:center;font-weight:800;font-size:17px; }
        .pc-crumbs { display:flex; align-items:center; gap:10px; flex:1; color:#8b949e; min-width:0; }
        .pc-crumbs strong { color:#e6edf3; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
        .pc-search { width:min(240px,25vw); border:1px solid #30363d; border-radius:7px; padding:8px 11px; color:#8b949e; background:#0d1117; }
        .pc-layout { display:grid; grid-template-columns:220px minmax(0,1fr); min-height:calc(100vh - 58px); }
        .pc-sidebar { border-right:1px solid #30363d; padding:22px 14px; color:#8b949e; }
        .pc-sidehead { font-weight:700;color:#e6edf3;margin:0 0 20px;font-size:15px; }
        .pc-nav { padding:9px 10px;border-radius:6px;margin-bottom:6px; }
        .pc-nav.active { background:#21262d;color:#e6edf3; }
        .pc-mini-card { margin-top:24px;border:1px solid #30363d;border-radius:8px;padding:12px;color:#e6edf3;font-size:12px; }
        .pc-main { padding:28px clamp(18px,4vw,44px) 50px; min-width:0; max-width:1500px; width:100%; margin:0 auto; }
        .pc-heading-row { display:flex;gap:12px;align-items:center;flex-wrap:wrap; }
        .pc-heading { font-size:29px;line-height:1.2;letter-spacing:-.7px;margin:0;font-weight:600; }
        .pc-number { color:#8b949e;text-decoration:underline;text-decoration-style:dotted; }
        .pc-lock { color:#8b949e;font-size:12px; }
        .pc-pills { display:flex;gap:8px;align-items:center;margin:14px 0 22px;flex-wrap:wrap; }
        .pc-pill { border:1px solid #30363d;border-radius:20px;padding:5px 11px;background:#161b22;color:#c9d1d9;font-size:12px; }
        .pc-pill.open { background:#238636;color:white;border-color:#238636;font-weight:600; }
        .pc-columns { display:grid;grid-template-columns:minmax(0,1fr) 290px;gap:32px;align-items:start; }
        .pc-card { border:1px solid #30363d;border-radius:8px;overflow:hidden;background:#0d1117; }
        .pc-card-head { background:#161b22;padding:11px 15px;border-bottom:1px solid #30363d;color:#8b949e;display:flex;align-items:center;gap:10px; }
        .pc-avatar { width:23px;height:23px;border-radius:50%;display:inline-grid;place-items:center;background:#f0883e;color:#0d1117;font-weight:800;flex-shrink:0; }
        .pc-body { padding:17px 17px 20px; }
        .pc-body p { margin:0;white-space:pre-wrap; }
        .pc-actions { display:flex;gap:8px;flex-wrap:wrap;margin-top:24px; }
        .pc-btn { background:#21262d;border:1px solid #30363d;color:#e6edf3;padding:7px 11px;border-radius:6px;cursor:pointer;font:inherit; }
        .pc-btn:hover { background:#30363d; }
        .pc-btn.primary { background:#238636;border-color:#238636;color:white; }
        .pc-btn.danger { color:#ff7b72; }
        .pc-timeline { margin:22px 0 32px 19px;border-left:2px solid #30363d;padding:0 0 0 23px; }
        .pc-event { position:relative;padding:0 0 22px;color:#c9d1d9; }
        .pc-event:before { content:"";position:absolute;left:-32px;top:2px;width:16px;height:16px;border-radius:50%;background:#21262d;border:2px solid #6e7681; }
        .pc-event small { color:#8b949e; }
        .pc-section-title { font-size:15px;margin:0 0 12px;font-weight:600; }
        .pc-comment { display:flex;gap:10px;margin:12px 0; }
        .pc-comment-box { flex:1;border:1px solid #30363d;border-radius:7px;overflow:hidden; }
        .pc-comment textarea,.pc-field { width:100%;background:#010409;border:1px solid #30363d;color:#e6edf3;padding:10px 11px;border-radius:6px;font:inherit; }
        .pc-comment textarea { border:0;resize:vertical;min-height:95px;display:block; }
        .pc-comment-footer { border-top:1px solid #30363d;background:#161b22;padding:9px;display:flex;justify-content:flex-end; }
        .pc-meta-section { margin-bottom:25px; }
        .pc-meta-title { color:#8b949e;font-weight:600;margin:0 0 9px;font-size:13px; }
        .pc-meta-value { margin:0;color:#c9d1d9; }
        .pc-meta-select { width:100%;background:transparent;border:0;color:#c9d1d9;font:inherit;padding:5px 0;outline-offset:3px; }
        .pc-meta-select option { background:#161b22; }
        .pc-meta-row { display:grid;grid-template-columns:100px minmax(0,1fr);gap:12px;margin:14px 0;align-items:center;color:#8b949e; }
        .pc-meta-row label { font-size:12px; }
        .pc-meta-row select,.pc-meta-row input { min-width:0;width:100%;background:transparent;color:#c9d1d9;border:0;padding:4px 0;font:inherit; }
        .pc-meta-row select option { background:#161b22; }
        .pc-labels { display:flex;flex-wrap:wrap;gap:6px;margin-top:8px; }
        .pc-label { border:1px solid #30363d;background:#161b22;color:#c9d1d9;border-radius:15px;padding:3px 8px;cursor:pointer;font-size:12px; }
        .pc-label.selected { background:#1f3a5f;border-color:#388bfd;color:#79c0ff; }
        .pc-modal-backdrop { position:fixed;inset:0;background:#0009;display:grid;place-items:center;padding:20px;z-index:10; }
        .pc-modal { width:min(520px,100%);background:#161b22;border:1px solid #30363d;border-radius:10px;padding:20px;box-shadow:0 15px 60px #0008; }
        .pc-modal h3 { margin:0 0 16px;font-size:18px; }
        .pc-modal label { display:block;color:#8b949e;margin:12px 0 5px; }
        .pc-modal .pc-field { margin-bottom:8px; }
        .pc-modal-actions { display:flex;justify-content:flex-end;gap:8px;margin-top:14px; }
        .pc-list-item { border:1px solid #30363d;border-radius:6px;padding:10px;margin:8px 0;display:flex;gap:9px;align-items:center; }
        .pc-muted { color:#8b949e; }
        @media (max-width:900px) { .pc-layout{grid-template-columns:1fr}.pc-sidebar{display:none}.pc-columns{grid-template-columns:1fr}.pc-meta{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.pc-meta-section{margin:0} }
        @media (max-width:560px) { .pc-topbar{padding:0 12px}.pc-search{display:none}.pc-main{padding:22px 13px}.pc-heading{font-size:23px}.pc-meta{grid-template-columns:1fr} }
      `}</style>

      <header className="pc-topbar">
        <div className="pc-mark">●</div>
        <div className="pc-crumbs">
          <span>kaushikk311</span><span>/</span><span>Projects</span><span>/</span>
          <strong>@kaushikk311's online-quiz-system</strong><span className="pc-lock">🔒</span>
        </div>
        <div className="pc-search">⌕ &nbsp; Type / to search</div>
        <button className="pc-btn" aria-label="Create">＋</button>
      </header>

      <div className="pc-layout">
        <aside className="pc-sidebar">
          <div className="pc-sidehead">▣ &nbsp; Project board</div>
          <div className="pc-nav active">▤ &nbsp; Backlog</div>
          <div className="pc-nav">▦ &nbsp; Board</div>
          <div className="pc-nav">▦ &nbsp; Table</div>
          <div className="pc-mini-card">
            <div className="pc-muted">● Backlog</div>
            <p><strong>Online-Quiz-System</strong></p>
            <p>Answer review</p>
            <span className="pc-pill">P1</span>
          </div>
        </aside>

        <main className="pc-main">
          <div className="pc-heading-row">
            <h1 className="pc-heading">{title} <span className="pc-number">#18</span></h1>
            <button className="pc-btn" title="Edit issue" onClick={() => {
              setDraftTitle(title); setDraftDescription(description); setShowEdit(true);
            }}>✎</button>
          </div>
          <div className="pc-pills">
            <span className="pc-pill open">● Open</span>
            <span className="pc-pill">▣ &nbsp; kaushikk311/Online-Quiz-System &nbsp; <strong>Public</strong></span>
          </div>

          <div className="pc-columns">
            <section>
              <article className="pc-card">
                <div className="pc-card-head">
                  <span className="pc-avatar">▦</span>
                  <span><strong style={{color:"#e6edf3"}}>kaushikk311</strong> opened 2w ago</span>
                  <span style={{marginLeft:"auto"}} className="pc-muted">Owner ·•••</span>
                </div>
                <div className="pc-body">
                  <p>{description}</p>
                  <div className="pc-actions">
                    <button className="pc-btn" onClick={() => setShowSubIssue(true)}>Create sub-issue ▾</button>
                    <button className="pc-btn" onClick={() => setShowArtifact(true)}>Add artifact</button>
                    <button className="pc-btn" title="Add a reaction" onClick={() => {
                      addActivity("You reacted 👍 to the issue");
                    }}>☻</button>
                  </div>
                </div>
              </article>

              {subIssues.length > 0 && (
                <section style={{marginTop:20}}>
                  <h2 className="pc-section-title">Sub-issues ({subIssues.filter(x => x.done).length}/{subIssues.length})</h2>
                  {subIssues.map((item) => (
                    <label className="pc-list-item" key={item.id}>
                      <input type="checkbox" checked={item.done} onChange={() => toggleSubIssue(item.id)} />
                      <span style={{textDecoration:item.done ? "line-through" : "none"}}>{item.title}</span>
                    </label>
                  ))}
                </section>
              )}

              {artifacts.length > 0 && (
                <section style={{marginTop:20}}>
                  <h2 className="pc-section-title">Artifacts</h2>
                  {artifacts.map((item) => <div className="pc-list-item" key={item.id}>
                    <span>🔗</span><a href={item.url} target="_blank" rel="noreferrer" style={{color:"#58a6ff",overflowWrap:"anywhere"}}>{item.url}</a>
                    <button className="pc-btn danger" onClick={() => setArtifacts(xs => xs.filter(x => x.id !== item.id))}>Remove</button>
                  </div>)}
                </section>
              )}

              <div className="pc-timeline" aria-label="Issue activity">
                {activity.map((item, index) => (
                  <div className="pc-event" key={`${item}-${index}`}>
                    <strong>{item.split(" ")[0]}</strong> {item.substring(item.indexOf(" ") + 1)}
                    <br /><small>{index === 0 ? "just now" : `${index + 1}w ago`}</small>
                  </div>
                ))}
              </div>

              <section>
                <h2 className="pc-section-title">Add a comment</h2>
                <form className="pc-comment" onSubmit={addComment}>
                  <span className="pc-avatar" style={{background:"#3fb950"}}>●</span>
                  <div className="pc-comment-box">
                    <textarea value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="Leave a comment..." />
                    <div className="pc-comment-footer">
                      <button className="pc-btn primary" type="submit" disabled={!commentText.trim()}>Comment</button>
                    </div>
                  </div>
                </form>
                {comments.map((comment) => (
                  <article className="pc-card" style={{marginTop:12}} key={comment.id}>
                    <div className="pc-card-head"><span className="pc-avatar" style={{background:"#3fb950"}}>●</span> You commented · {comment.date}</div>
                    <div className="pc-body"><p>{comment.body}</p></div>
                  </article>
                ))}
              </section>
            </section>

            <aside className="pc-meta">
              <section className="pc-meta-section">
                <h3 className="pc-meta-title">Assignees</h3>
                <select className="pc-meta-select" value={assignee} onChange={(e) => {
                  setAssignee(e.target.value); addActivity(`You assigned ${e.target.value}`);
                }}>
                  <option value="keertikesha veswaran2006">keertikesha veswaran2006</option>
                  <option value="keertikeshaveswaran2006">keertikeshaveswaran2006</option>
                  <option value="kaushikk311">kaushikk311</option>
                  <option value="Unassigned">Unassigned</option>
                </select>
              </section>
              <hr style={{border:0,borderTop:"1px solid #30363d",margin:"20px 0"}} />
              <section className="pc-meta-section">
                <h3 className="pc-meta-title">Labels</h3>
                <p className="pc-muted" style={{margin:"0 0 8px"}}>{labels.length ? "Selected labels:" : "No labels"}</p>
                <div className="pc-labels">
                  {["bug", "enhancement", "performance", "documentation"].map(label => (
                    <button key={label} className={`pc-label ${labels.includes(label) ? "selected" : ""}`} onClick={() => toggleLabel(label)}>{label}</button>
                  ))}
                </div>
              </section>
              <hr style={{border:0,borderTop:"1px solid #30363d",margin:"20px 0"}} />
              <section className="pc-meta-section">
                <h3 className="pc-meta-title">Projects</h3>
                <div className="pc-card" style={{padding:12}}>
                  <strong>▦ &nbsp; @kaushikk311's online-quiz-system</strong>
                  <div className="pc-meta-row"><label>Status</label><select value={status} onChange={e => changeStatus(e.target.value)}><option>Backlog</option><option>Ready</option><option>In progress</option><option>In review</option><option>Done</option></select></div>
                  <div className="pc-meta-row"><label>Priority</label><select value={priority} onChange={e => {setPriority(e.target.value);addActivity(`You changed priority to ${e.target.value}`)}}><option>P0</option><option>P1</option><option>P2</option><option>P3</option></select></div>
                  <div className="pc-meta-row"><label>Size</label><select defaultValue=""><option value="">Choose an option</option><option>XS</option><option>S</option><option>M</option><option>L</option><option>XL</option></select></div>
                  <div className="pc-meta-row"><label>Estimate</label><select value={estimate} onChange={e => setEstimate(e.target.value)}><option>1</option><option>2</option><option>3</option><option>5</option><option>8</option><option>13</option></select></div>
                  <div className="pc-meta-row"><label>Start date</label><span className="pc-muted">No date</span></div>
                  <div className="pc-meta-row"><label>Target date</label><span className="pc-muted">No date</span></div>
                  <div className="pc-meta-row"><label>Sprint 1</label><span className="pc-muted">Choose an iteration</span></div>
                  <div className="pc-meta-row"><label>Sprint 2</label><select value={sprint} onChange={e => {setSprint(e.target.value);addActivity(`You changed sprint to ${e.target.value}`)}}><option>sprint 1</option><option>sprint 2</option><option>sprint 3</option><option>None</option></select></div>
                </div>
              </section>
            </aside>
          </div>
        </main>
      </div>

      {showEdit && <div className="pc-modal-backdrop" role="presentation">
        <form className="pc-modal" onSubmit={saveIssue}>
          <h3>Edit issue</h3>
          <label htmlFor="pc-title">Title</label>
          <input id="pc-title" className="pc-field" value={draftTitle} onChange={e => setDraftTitle(e.target.value)} required />
          <label htmlFor="pc-description">Description</label>
          <textarea id="pc-description" className="pc-field" rows={4} value={draftDescription} onChange={e => setDraftDescription(e.target.value)} required />
          <div className="pc-modal-actions"><button type="button" className="pc-btn" onClick={() => setShowEdit(false)}>Cancel</button><button className="pc-btn primary" type="submit">Save changes</button></div>
        </form>
      </div>}

      {showSubIssue && <div className="pc-modal-backdrop" role="presentation">
        <form className="pc-modal" onSubmit={addSubIssue}>
          <h3>Create sub-issue</h3>
          <label htmlFor="pc-subissue">Sub-issue title</label>
          <input id="pc-subissue" className="pc-field" value={subIssueTitle} onChange={e => setSubIssueTitle(e.target.value)} placeholder="e.g. Load-test concurrent student sessions" autoFocus required />
          <div className="pc-modal-actions"><button type="button" className="pc-btn" onClick={() => setShowSubIssue(false)}>Cancel</button><button className="pc-btn primary" type="submit">Create sub-issue</button></div>
        </form>
      </div>}

      {showArtifact && <div className="pc-modal-backdrop" role="presentation">
        <form className="pc-modal" onSubmit={addArtifact}>
          <h3>Add artifact</h3>
          <label htmlFor="pc-artifact">Artifact URL</label>
          <input id="pc-artifact" className="pc-field" type="url" value={artifactUrl} onChange={e => setArtifactUrl(e.target.value)} placeholder="https://..." autoFocus required />
          <div className="pc-modal-actions"><button type="button" className="pc-btn" onClick={() => setShowArtifact(false)}>Cancel</button><button className="pc-btn primary" type="submit">Add artifact</button></div>
        </form>
      </div>}
    </div>
  );
}

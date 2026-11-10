import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { askChatbot } from '../../services/chatbot.js';

/** Extra feature – a small rule-based assistant. Hidden during a quiz attempt so it can’t be used to look things up. */
export default function QuizChatbot() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [input, setInput] = useState('');
  const ctx = useRef({});
  const logRef = useRef(null);

  const ask = (text) => {
    const t = text.trim();
    if (!t) return;
    setMessages((m) => [...m, { from: 'me', text: t }]);
    const r = askChatbot(user, t, ctx.current);
    if (r.ok) {
      ctx.current = { quizId: r.data.quizId };
      setMessages((m) => [...m, { from: 'bot', text: r.data.text }]);
      setSuggestions(r.data.suggestions);
    } else setMessages((m) => [...m, { from: 'bot', text: r.error }]);
    setInput('');
  };

  useEffect(() => { if (open && messages.length === 0) ask('help'); /* eslint-disable-next-line */ }, [open]);
  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [messages, open]);

  return (
    <div className="chatbot">
      {open && (
        <section className="chat-panel" role="dialog" aria-label="Quiz assistant">
          <header><strong>Tickmark assistant</strong><button className="icon-btn" aria-label="Close assistant" onClick={() => setOpen(false)}>×</button></header>
          <div className="chat-log" role="log" aria-live="polite" ref={logRef}>
            {messages.filter((m) => !(m.from === 'me' && m.text === 'help' && messages.indexOf(m) === 0)).map((m, i) => <p key={i} className={`msg msg-${m.from}`}>{m.text}</p>)}
          </div>
          {suggestions.length > 0 && <div className="chips chat-chips">{suggestions.map((s) => <button key={s} type="button" className="chip" onClick={() => ask(s)}>{s}</button>)}</div>}
          <form onSubmit={(e) => { e.preventDefault(); ask(input); }}>
            <input type="text" value={input} maxLength={300} onChange={(e) => setInput(e.target.value)} placeholder="Ask about a quiz…" aria-label="Your question" />
            <button className="btn btn-primary btn-sm" type="submit">Send</button>
          </form>
        </section>
      )}
      <button className="chat-toggle" onClick={() => setOpen(!open)} aria-expanded={open}>{open ? 'Close' : 'Ask Tickmark'}</button>
    </div>
  );
}

import React, {useEffect, useMemo, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {motion, AnimatePresence} from 'framer-motion';
import {AreaChart, Area, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis} from 'recharts';
import {
  Activity,
  BrainCircuit,
  Command,
  Cpu,
  Database,
  Gauge,
  LayoutDashboard,
  MemoryStick,
  Network,
  Play,
  Plus,
  RotateCcw,
  Search,
  Settings,
  ShieldCheck,
  Trash2,
  Zap,
  X,
  Pause,
  ArrowRight,
} from 'lucide-react';
import './styles.css';

type State = 'READY' | 'RUNNING' | 'WAITING' | 'BLOCKED' | 'TERMINATED';
type Proc = {
  id: string;
  name: string;
  priority: number;
  burst: number;
  arrival: number;
  state: State;
  cpu: number;
  mem: number;
  remaining?: number;
};
type Slice = { id: string; start: number; end: number };

const initial: Proc[] = [
  { id: 'P1', name: 'Chrome', priority: 2, burst: 6, arrival: 0, state: 'RUNNING', cpu: 27, mem: 1420 },
  { id: 'P2', name: 'VS Code', priority: 1, burst: 4, arrival: 1, state: 'READY', cpu: 18, mem: 780 },
  { id: 'P3', name: 'Database', priority: 3, burst: 8, arrival: 2, state: 'WAITING', cpu: 12, mem: 1160 },
  { id: 'P4', name: 'Compiler', priority: 2, burst: 3, arrival: 3, state: 'READY', cpu: 9, mem: 520 },
  { id: 'P5', name: 'Spotify', priority: 4, burst: 5, arrival: 0, state: 'BLOCKED', cpu: 4, mem: 330 },
];

const colors = ['#d98a68', '#b46e62', '#8ca078', '#b6765b', '#9d7a65', '#7c6f78'];

function schedule(p: Proc[], algo: string, q: number) {
  const list = p.filter((x) => x.state !== 'TERMINATED').map((x) => ({ ...x, remaining: x.burst }));
  let t = 0;
  const slices: Slice[] = [];
  const done: any[] = [];

  if (algo === 'SJF') list.sort((a, b) => a.burst - b.burst || a.arrival - b.arrival);
  if (algo === 'Priority') list.sort((a, b) => a.priority - b.priority || a.arrival - b.arrival);

  if (algo === 'Round Robin') {
    const ready: any[] = [];
    const pending = [...list].sort((a, b) => a.arrival - b.arrival);

    while (ready.length || pending.length) {
      if (!ready.length) t = Math.max(t, pending[0].arrival);
      while (pending[0]?.arrival <= t) ready.push(pending.shift());

      const x = ready.shift()!;
      const run = Math.min(q, x.remaining);
      slices.push({ id: x.id, start: t, end: t + run });
      t += run;
      x.remaining -= run;

      while (pending[0]?.arrival <= t) ready.push(pending.shift());
      if (x.remaining) ready.push(x);
      else done.push({ ...x, finish: t });
    }
  } else {
    for (const x of list) {
      t = Math.max(t, x.arrival);
      slices.push({ id: x.id, start: t, end: t + x.burst });
      t += x.burst;
      done.push({ ...x, finish: t });
    }
  }

  const avg = (f: (arg: any) => number) => done.reduce((s, x) => s + f(x), 0) / Math.max(1, done.length);

  return {
    slices,
    total: t,
    wait: avg((x) => x.finish - x.arrival - x.burst),
    turn: avg((x) => x.finish - x.arrival),
    response:
      algo === 'Round Robin'
        ? avg((x) => slices.find((s) => s.id === x.id)!.start - x.arrival)
        : avg((x) => x.finish - x.arrival - x.burst),
  };
}

function replace(ref: number[], framesN: number, algo: string) {
  const frames: Array<number | null> = Array(framesN).fill(null);
  let faults = 0;
  let hits = 0;
  const history: { page: number; hit: boolean; frames: Array<number | null> }[] = [];
  const last = new Map<number, number>();
  const use = new Map<number, number>();

  ref.forEach((page, i) => {
    const hit = frames.includes(page);
    if (hit) hits++;
    else {
      faults++;
      let n = frames.indexOf(null);

      if (n < 0) {
        if (algo === 'FIFO') n = i % framesN;
        else if (algo === 'LRU')
          n = frames.reduce<number>((best, v, j) => {
            const current = v ?? Number.NEGATIVE_INFINITY;
            const bestValue = frames[best] ?? Number.NEGATIVE_INFINITY;
            const currentLast = last.get(current) ?? Number.MAX_SAFE_INTEGER;
            const bestLast = last.get(bestValue) ?? Number.MAX_SAFE_INTEGER;
            return currentLast < bestLast ? j : best;
          }, 0);
        else
          n = frames.reduce<number>((best, v, j) => {
            const current = v ?? Number.NEGATIVE_INFINITY;
            const bestValue = frames[best] ?? Number.NEGATIVE_INFINITY;
            const currentUse = use.get(current) ?? Number.MAX_SAFE_INTEGER;
            const bestUse = use.get(bestValue) ?? Number.MAX_SAFE_INTEGER;
            return currentUse < bestUse ? j : best;
          }, 0);
      }

      frames[n] = page;
    }

    last.set(page, i);
    use.set(page, (use.get(page) || 0) + 1);
    history.push({ page, hit, frames: [...frames] });
  });

  return { history, faults, hits };
}

const nav = [
  ['Overview', LayoutDashboard],
  ['Process Monitor', Activity],
  ['CPU Scheduling', Cpu],
  ['Memory Manager', MemoryStick],
  ['Page Replacement', Database],
  ['Deadlock Detection', Network],
  ['Prediction Center', BrainCircuit],
  ['Analytics', Gauge],
] as const;

function App() {
  const [page, setPage] = useState<typeof nav[number][0]>('Overview');
  const [procs, setProcs] = useState(initial);
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [onboard, setOnboard] = useState(true);
  const [cmd, setCmd] = useState(false);
  const [assistant, setAssistant] = useState(false);
  const [toast, setToast] = useState('');
  const [algorithm, setAlgorithm] = useState('Round Robin');
  const [quantum, setQuantum] = useState(2);
  const [memory, setMemory] = useState([1420, 780, 1160, 520, 330]);
  const [ref, setRef] = useState('7 0 1 2 0 3 0 4 2 3');
  const [frames, setFrames] = useState(3);
  const [repAlgo, setRepAlgo] = useState('LRU');
  const [step, setStep] = useState(0);
  const [cycle, setCycle] = useState(false);

  const totalMem = 16000;
  const used = memory.reduce((a, b) => a + b, 0);
  const cpu = Math.min(96, Math.round(procs.filter((p) => p.state !== 'TERMINATED').reduce((a, p) => a + p.cpu, 0) * 1.05));
  const active = procs.filter((p) => p.state !== 'TERMINATED').length;

  const result = useMemo(() => schedule(procs, algorithm, quantum), [procs, algorithm, quantum]);
  const replacement = useMemo(
    () => replace(ref.split(/[ ,]+/).filter(Boolean).map(Number).filter((n) => !isNaN(n)), frames, repAlgo),
    [ref, frames, repAlgo],
  );
  const risk = Math.min(99, Math.round(cpu * 0.42 + (used / totalMem) * 35 + replacement.faults * 1.2 + (cycle ? 24 : 0)));
  const health = Math.max(10, 100 - risk);

  const notify = (s: string) => {
    setToast(s);
    setTimeout(() => setToast(''), 2600);
  };

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCmd(true);
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);

  useEffect(() => {
    if (!running) return;
    const x = setInterval(
      () =>
        setProcs((ps) =>
          ps.map((p, i) =>
            p.state === 'TERMINATED'
              ? p
              : {
                  ...p,
                  cpu: Math.max(2, Math.min(45, p.cpu + (Math.random() > 0.5 ? 3 : -2) * speed)),
                  state: i === Math.floor(Date.now() / 900) % Math.max(1, ps.length) ? 'RUNNING' : p.state === 'RUNNING' ? 'READY' : p.state,
                },
          ),
        ),
      900 / speed,
    );
    return () => clearInterval(x);
  }, [running, speed]);

  const add = () => {
    const n = procs.length + 1;
    setProcs([...procs, { id: 'P' + n, name: 'Worker ' + n, priority: 3, burst: 3, arrival: n, state: 'READY', cpu: 7, mem: 400 }]);
    setMemory((m) => [...m, 400]);
    notify('Process added to ready queue');
  };

  const update = (id: string, change: Partial<Proc>) => setProcs((ps) => ps.map((p) => (p.id === id ? { ...p, ...change } : p)));

  const insight = cycle
    ? 'Deadlock cycle detected. Recover by terminating P2 or preempting R2.'
    : cpu > 78
      ? 'CPU utilization is approaching 80%. Round Robin may improve response time.'
      : used / totalMem > 0.8
        ? 'Memory pressure is rising. Free idle allocations.'
        : procs.some((p) => p.state === 'WAITING')
          ? 'P3 has been waiting longer than its peers.'
          : 'System resources are balanced. Prediction engine is monitoring trends.';

  const go = (x: typeof page) => {
    setPage(x);
    setCmd(false);
  };

  return (
    <div className="app-shell">
      <div className="paper-noise" />

      <header className="masthead">
        <div className="brand-block">
          <div className="brand-main">OS GUARDIAN</div>
          <div className="brand-sub">PREDICTIVE OS RESOURCE INTELLIGENCE</div>
        </div>
        <div className="masthead-meta">
          <span className="meta-chip">SYSTEM / 2026</span>
        </div>
      </header>

      <nav className="topnav">
        {nav.map(([n, I]) => (
          <button key={n} className={page === n ? 'active' : ''} onClick={() => go(n)}>
            <I size={16} />
            <span>{n}</span>
          </button>
        ))}
      </nav>

      <main className="content-shell">
        <AnimatePresence mode="wait">
          <motion.section
            key={page}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.28 }}
          >
            {page === 'Overview' && <Overview cpu={cpu} used={used} active={active} health={health} procs={procs} running={running} />}
            {page === 'Process Monitor' && <ProcessPage procs={procs} add={add} update={update} notify={notify} />}
            {page === 'CPU Scheduling' && <Scheduling procs={procs} algo={algorithm} setAlgo={setAlgorithm} q={quantum} setQ={setQuantum} res={result} />}
            {page === 'Memory Manager' && <MemoryPage memory={memory} used={used} setMemory={setMemory} notify={notify} />}
            {page === 'Page Replacement' && (
              <PagePage
                ref={ref}
                setRef={setRef}
                frames={frames}
                setFrames={setFrames}
                algo={repAlgo}
                setAlgo={setRepAlgo}
                data={replacement}
                step={step}
                setStep={setStep}
              />
            )}
            {page === 'Deadlock Detection' && <Deadlock cycle={cycle} setCycle={setCycle} />}
            {page === 'Prediction Center' && <Predictions risk={risk} cpu={cpu} cycle={cycle} go={go} />}
            {page === 'Analytics' && <Analytics procs={procs} cpu={cpu} used={used} result={result} />}
          </motion.section>
        </AnimatePresence>
      </main>

      <div className="controlbar">
        <button className={running ? 'running' : ''} onClick={() => setRunning(!running)}>
          {running ? <Pause /> : <Play />}
          {running ? 'Pause' : 'Run Simulation'}
        </button>
        <button
          onClick={() => {
            setProcs(initial);
            setMemory([1420, 780, 1160, 520, 330]);
            setRunning(false);
            notify('Simulation reset');
          }}
        >
          <RotateCcw /> Reset
        </button>
        <button onClick={() => setSpeed(speed === 3 ? 1 : 3)}>
          <Zap /> {speed === 3 ? 'Normal' : 'Accelerate'}
        </button>
      </div>

      <button className="orb" onClick={() => setAssistant(!assistant)}>
        <BrainCircuit />
      </button>

      <AnimatePresence>
        {assistant && (
          <motion.div className="assistant" initial={{ opacity: 0, scale: 0.9, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }}>
            <button className="close" onClick={() => setAssistant(false)}>
              <X />
            </button>
            <div className="aorb">
              <BrainCircuit />
            </div>
            <b>Guardian AI</b>
            <p>{insight}</p>
            <button onClick={() => go(cycle ? 'Deadlock Detection' : cpu > 78 ? 'CPU Scheduling' : 'Prediction Center')}>
              Explore insight <ArrowRight size={15} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>{toast && <motion.div className="toast" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}><ShieldCheck /> {toast}</motion.div>}</AnimatePresence>

      <AnimatePresence>
        {cmd && (
          <CommandPalette
            go={go}
            close={() => setCmd(false)}
            reset={() => {
              setProcs(initial);
              setCmd(false);
              notify('Simulation reset');
            }}
          />
        )}
        {onboard && <Onboard close={() => setOnboard(false)} />}
      </AnimatePresence>
    </div>
  );
}

function Overview({ cpu, used, active, health, procs, running }: { cpu: number; used: number; active: number; health: number; procs: Proc[]; running: boolean }) {
  const data = Array.from({ length: 10 }, (_, i) => ({ v: Math.max(20, cpu - 20 + ((i * 13) % 27)) }));

  return (
    <>
      <div className="overview-hero">
        <div className="hero-copy">
          <span className="eyebrow accented">OBSERVE / SIMULATE / PREDICT</span>
          <h1>
            THE SYSTEM
            <br />
            IS ALIVE.
          </h1>
          <p>Observe processes. Understand resources. Predict system behaviour.</p>
        </div>

        <div className="hero-figure">
          <div className="core-illustration">
            <div className="node cpu-node">
              <Cpu />
              <b>CPU</b>
              <small>{cpu}% LOAD</small>
            </div>
            <div className="node process-node">
              <Activity />
              <b>PROCESS</b>
              <small>{active} ACTIVE</small>
            </div>
            <div className="node mem-node">
              <MemoryStick />
              <b>MEMORY</b>
              <small>{(used / 1000).toFixed(1)} GB</small>
            </div>
            <div className="node resource-node">
              <Database />
              <b>RESOURCE</b>
              <small>STABLE</small>
            </div>

            <svg viewBox="0 0 620 320">
              <path d="M150 160 C220 70 270 70 310 160 S410 250 470 160" />
              <path d="M150 160 C238 250 330 250 470 160" />
              <circle className="signal" r="5">
                <animateMotion dur="3s" repeatCount="indefinite" path="M150 160 C220 70 270 70 310 160 S410 250 470 160" />
              </circle>
            </svg>
          </div>
        </div>
      </div>

      <div className="metrics">
        <Metric label="CPU" value={cpu + '%'} icon={<Cpu />} trend="UTILIZATION" chart={data} />
        <Metric label="MEMORY" value={(used / 1000).toFixed(1) + ' GB'} icon={<MemoryStick />} trend="OF 16 GB" />
        <Metric label="PROCESSES" value={String(active)} icon={<Activity />} trend="ACTIVE" />
        <Metric label="SYSTEM HEALTH" value={health + ' / 100'} icon={<ShieldCheck />} trend="HEALTH" />
      </div>

      <div className="overview-grid">
        <div className="panel story-panel">
          <span className="eyebrow">PROCESS SIGNAL</span>
          <h2>
            PROCESSES
            <br />
            IN MOTION
          </h2>
          <div className="event-list">
            {procs.slice(0, 4).map((p, i) => (
              <div className="event" key={p.id}>
                <i className={'dot ' + (i === 0 ? 'blue' : 'teal')} />
                <div>
                  <b>{p.name}</b>
                  <small>
                    {p.state} · {p.cpu}% CPU
                  </small>
                </div>
                <span>now</span>
              </div>
            ))}
          </div>
        </div>

        <div className="panel insight-panel">
          <span className="eyebrow">SYSTEM NOTE</span>
          <h3>Resource orchestration remains stable and predictive.</h3>
          <p>
            Process states are clustering into a healthy pattern with the scheduler holding latency low while memory pressure stays within a manageable range.
          </p>
          <span className={running ? 'status-chip live' : 'status-chip pending'}>
            {running ? 'SIMULATING' : 'STANDING BY'}
          </span>
        </div>
      </div>
    </>
  );
}

function Metric({ label, value, icon, trend, chart }: { label: string; value: string; icon: any; trend: string; chart?: any[] }) {
  return (
    <motion.div className="metric panel" whileHover={{ y: -4 }}>
      <div className="metric-icon">{icon}</div>
      <span className="eyebrow">{label}</span>
      <strong>{value}</strong>
      <small>{trend}</small>
      {chart && (
        <div className="mini">
          <ResponsiveContainer>
            <AreaChart data={chart}>
              <Area dataKey="v" stroke="#b5745f" fill="url(#a)" strokeWidth={2} />
              <defs>
                <linearGradient id="a" x1="0" x2="0" y1="0" y2="1">
                  <stop stopColor="#d08769" stopOpacity=".48" />
                  <stop offset="1" stopColor="#d08769" stopOpacity="0" />
                </linearGradient>
              </defs>
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </motion.div>
  );
}

function ProcessPage({ procs, add, update, notify }: { procs: Proc[]; add: () => void; update: (x: string, c: Partial<Proc>) => void; notify: (x: string) => void }) {
  const [sort, setSort] = useState<'name' | 'cpu'>('cpu');
  const rows = [...procs].sort((a, b) => (sort === 'cpu' ? b.cpu - a.cpu : a.name.localeCompare(b.name)));

  return (
    <div className="panel table-panel">
      <div className="panel-head">
        <div>
          <span className="eyebrow">PROCESS MONITOR / 01</span>
          <h2>
            PROCESSES
            <br />
            IN MOTION
          </h2>
        </div>
        <div className="actions">
          <button onClick={() => setSort(sort === 'cpu' ? 'name' : 'cpu')}>
            <Search /> Sort: {sort}
          </button>
          <button className="primary" onClick={add}>
            <Plus /> Add process
          </button>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>PID</th>
              <th>PROCESS</th>
              <th>STATE</th>
              <th>PRIORITY</th>
              <th>CPU</th>
              <th>MEMORY</th>
              <th>ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className={p.state === 'TERMINATED' ? 'terminated' : ''}>
                <td>
                  <b>{p.id}</b>
                </td>
                <td>
                  <span>{p.name}</span>
                </td>
                <td>
                  <span className={'state ' + p.state.toLowerCase()}>{p.state}</span>
                </td>
                <td>
                  <button className="number" onClick={() => update(p.id, { priority: p.priority === 1 ? 4 : p.priority - 1 })}>P{p.priority}</button>
                </td>
                <td>
                  <div className="cpubar">
                    <i style={{ width: p.cpu + '%' }} />
                    {p.cpu}%
                  </div>
                </td>
                <td>{p.mem} MB</td>
                <td>
                  <div className="row-actions">
                    {p.state === 'TERMINATED' ? (
                      <button onClick={() => update(p.id, { state: 'READY' })}>Restore</button>
                    ) : (
                      <>
                        <button
                          onClick={() => {
                            update(p.id, { state: p.state === 'BLOCKED' ? 'READY' : 'BLOCKED' });
                            notify(p.state === 'BLOCKED' ? 'Process resumed' : 'Process paused');
                          }}
                        >
                          {p.state === 'BLOCKED' ? 'Resume' : 'Pause'}
                        </button>
                        <button
                          title="Kill"
                          onClick={() => {
                            update(p.id, { state: 'TERMINATED', cpu: 0 });
                            notify(p.name + ' terminated');
                          }}
                        >
                          <Trash2 />
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Scheduling({ procs, algo, setAlgo, q, setQ, res }: { procs: Proc[]; algo: string; setAlgo: (x: string) => void; q: number; setQ: (x: number) => void; res: ReturnType<typeof schedule> }) {
  const compare = ['FCFS', 'SJF', 'Round Robin', 'Priority'].map((a) => ({ a, r: schedule(procs, a, q) }));

  return (
    <div className="schedule-layout">
      <div className="panel config-panel">
        <span className="eyebrow">CPU SCHEDULER / 02</span>
        <h2>
          WHO GETS
          <br />
          THE CPU?
        </h2>
        <div className="segmented">
          {['FCFS', 'SJF', 'Round Robin', 'Priority'].map((a) => (
            <button className={a === algo ? 'selected' : ''} onClick={() => setAlgo(a)} key={a}>
              {a}
            </button>
          ))}
        </div>
        {algo === 'Round Robin' && (
          <label>
            TIME QUANTUM
            <input type="number" min="1" max="10" value={q} onChange={(e) => setQ(Math.max(1, +e.target.value))} />
            <small>Process rotation remains active throughout the cycle.</small>
          </label>
        )}
      </div>

      <div className="panel gantt-panel">
        <div className="panel-head">
          <div>
            <span className="eyebrow">ALGORITHM / {algo.toUpperCase()}</span>
            <h2>{algo} GANTT</h2>
          </div>
          <span className="meta-tag">{res.total} MS</span>
        </div>

        <div className="gantt-bar">
          {res.slices.map((s, i) => (
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: i * 0.07 }}
              style={{ flex: s.end - s.start, background: colors[(+s.id.slice(1) - 1) % colors.length] }}
              key={i}
            >
              <b>{s.id}</b>
              <small>
                {s.start}—{s.end}
              </small>
            </motion.div>
          ))}
        </div>

        <div className="result-stats">
          <Stat n={res.wait.toFixed(1) + ' ms'} l="WAITING" />
          <Stat n={res.turn.toFixed(1) + ' ms'} l="TURNAROUND" />
          <Stat n={res.response.toFixed(1) + ' ms'} l="RESPONSE" />
          <Stat n="72%" l="UTILIZATION" />
        </div>
      </div>

      <div className="panel compare-panel">
        <span className="eyebrow">ALGORITHM NOTE</span>
        <h2>Round Robin / Time quantum 2</h2>
        <div className="compare-grid">
          <b>ALGORITHM</b>
          <b>WAIT</b>
          <b>TURN</b>
          <b>RESPONSE</b>
          {compare.map((x) => (
            <React.Fragment key={x.a}>
              <span className={x.a === algo ? 'chosen' : ''}>{x.a}</span>
              <span>{x.r.wait.toFixed(1)} ms</span>
              <span>{x.r.turn.toFixed(1)} ms</span>
              <span>{x.r.response.toFixed(1)} ms</span>
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}

const Stat = ({ n, l }: { n: string; l: string }) => (
  <div>
    <strong>{n}</strong>
    <small>{l}</small>
  </div>
);

function MemoryPage({ memory, used, setMemory, notify }: { memory: number[]; used: number; setMemory: (x: number[]) => void; notify: (x: string) => void }) {
  const [amount, setAmount] = useState(500);
  const free = 16000 - used;

  return (
    <div className="memory-layout">
      <div className="memory-stats">
        <Stat n="16 GB" l="TOTAL MEMORY" />
        <Stat n={(used / 1000).toFixed(2) + ' GB'} l="USED" />
        <Stat n={(free / 1000).toFixed(2) + ' GB'} l="FREE" />
        <Stat n="38%" l="FRAGMENTATION" />
      </div>

      <div className="panel ram-panel">
        <div className="panel-head">
          <div>
            <span className="eyebrow">MEMORY / 03</span>
            <h2>
              RAM
              <br />
              TOPOLOGY
            </h2>
          </div>
          <button
            className="primary"
            onClick={() => {
              if (amount <= free) {
                setMemory([...memory, amount]);
                notify(amount + ' MB allocated');
              } else notify('Allocation exceeds available memory');
            }}
          >
            <Plus /> Allocate
          </button>
        </div>

        <div className="ram-stack">
          {memory.map((m, i) => (
            <motion.div layout className="mem-block" style={{ height: Math.max(42, m / 20), background: colors[i % colors.length] }} key={i}>
              <b>P{i + 1}</b>
              <span>{m} MB</span>
              <button
                onClick={() => {
                  setMemory(memory.filter((_, j) => j !== i));
                  notify('Memory block released');
                }}
              >
                <Trash2 />
              </button>
            </motion.div>
          ))}

          <div className="free-block">
            <span>FREE SPACE · {free} MB</span>
          </div>
        </div>

        <div className="allocation">
          <label>
            REQUEST (MB)
            <input type="number" value={amount} min="50" step="50" onChange={(e) => setAmount(+e.target.value)} />
          </label>
          <div>
            <small>FRAGMENTATION INDEX</small>
            <div className="progress">
              <i style={{ width: memory.length * 8 + '%' }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PagePage({ ref, setRef, frames, setFrames, algo, setAlgo, data, step, setStep }: { ref: string; setRef: (x: string) => void; frames: number; setFrames: (x: number) => void; algo: string; setAlgo: (x: string) => void; data: ReturnType<typeof replace>; step: number; setStep: (x: number) => void }) {
  const current = data.history[Math.min(step, data.history.length - 1)];

  return (
    <div className="page-layout">
      <div className="panel page-config">
        <span className="eyebrow">PAGE REPLACEMENT / 05</span>
        <h2>PAGE → FRAME → REPLACEMENT</h2>
        <label>
          REFERENCE STRING
          <input value={ref} onChange={(e) => { setRef(e.target.value); setStep(0); }} />
        </label>
        <div className="form-row">
          <label>
            FRAMES
            <input type="number" min="1" max="8" value={frames} onChange={(e) => { setFrames(Math.max(1, +e.target.value)); setStep(0); }} />
          </label>
          <label>
            POLICY
            <select value={algo} onChange={(e) => { setAlgo(e.target.value); setStep(0); }}>
              <option>FIFO</option>
              <option>LRU</option>
              <option>LFU</option>
            </select>
          </label>
        </div>
      </div>

      <div className="panel frame-panel">
        <div className="panel-head">
          <div>
            <span className="eyebrow">
              STEP {Math.min(step + 1, data.history.length)} / {data.history.length}
            </span>
            <h2>{current?.hit ? 'PAGE HIT' : 'PAGE FAULT'}</h2>
          </div>
          <button className="primary" onClick={() => setStep((step + 1) % Math.max(1, data.history.length))}>
            Next reference <ArrowRight />
          </button>
        </div>

        <div className="frame-grid">
          {current?.frames.map((x, i) => (
            <motion.div className={x === current?.page ? 'frame new' : 'frame'} key={i} animate={{ scale: x === current?.page ? [1, 1.06, 1] : 1 }}>
              <small>FRAME {i + 1}</small>
              <b>{x ?? '—'}</b>
            </motion.div>
          ))}
        </div>

        <input className="timeline" type="range" min="0" max={Math.max(0, data.history.length - 1)} value={Math.min(step, Math.max(0, data.history.length - 1))} onChange={(e) => setStep(+e.target.value)} />

        <div className="result-stats">
          <Stat n={String(data.faults)} l="FAULTS" />
          <Stat n={String(data.hits)} l="HITS" />
          <Stat n={(data.hits / Math.max(1, data.hits + data.faults) * 100).toFixed(0) + '%'} l="HIT RATIO" />
          <Stat n={(data.faults / Math.max(1, data.hits + data.faults) * 100).toFixed(0) + '%'} l="FAULT RATIO" />
        </div>
      </div>
    </div>
  );
}

function Deadlock({ cycle, setCycle }: { cycle: boolean; setCycle: (x: boolean) => void }) {
  return (
    <div className="deadlock-layout">
      <div className={'dead-alert ' + (cycle ? 'danger' : 'safe')}>
        <ShieldCheck />
        <div>
          <b>{cycle ? 'DEADLOCK DETECTED' : 'SYSTEM SAFE — NO DEADLOCK DETECTED'}</b>
          <small>{cycle ? 'Circular wait detected across P1 → R1 → P2 → R2 → P1.' : 'Resource allocation graph has no cycles.'}</small>
        </div>
      </div>

      <div className="panel graph-panel">
        <div className="panel-head">
          <div>
            <span className="eyebrow">DEADLOCK / 04</span>
            <h2>
              WHEN SYSTEMS
              <br />
              STOP MOVING
            </h2>
          </div>
          <button className={cycle ? 'danger-button' : 'primary'} onClick={() => setCycle(!cycle)}>
            {cycle ? 'Resolve cycle' : 'Simulate deadlock'}
          </button>
        </div>

        <div className="graph-map">
          <svg viewBox="0 0 700 280">
            <defs>
              <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
                <path d="M0,0 L0,6 L7,3 z" fill="#7d5d55" />
              </marker>
            </defs>
            <path className={cycle ? 'cycle-line' : ''} markerEnd="url(#arrow)" d="M160 90 C260 45 300 45 350 90 M430 90 C500 130 510 165 430 190 M350 190 C290 245 230 230 160 190 M80 190 C15 150 35 110 80 90" />
          </svg>

          {[
            ['P1', 'p', 80, 60],
            ['R1', 'r', 330, 60],
            ['P2', 'p', 410, 160],
            ['R2', 'r', 80, 160],
          ].map(([n, c, x, y]) => (
            <motion.div
              animate={cycle ? { boxShadow: ['0 0 0 rgba(176,82,65,0)', '0 0 18px rgba(176,82,65,.45)', '0 0 0 rgba(176,82,65,0)'] } : {}}
              transition={{ repeat: Infinity, duration: 1.5 }}
              className={'graph-node ' + c}
              style={{ left: x as number, top: y as number }}
              key={n as string}
            >
              {n}
            </motion.div>
          ))}
        </div>

        <div className="graph-legend">
          <span>
            <i className="dot blue" /> Process
          </span>
          <span>
            <i className="dot purple" /> Resource
          </span>
          <span>→ request / allocation</span>
        </div>
      </div>

      {cycle && (
        <div className="panel recovery-panel">
          <span className="eyebrow">RECOVERY PLAN</span>
          <h3>Break the circular wait by preempting R2 or terminating P2.</h3>
          <p>P1 → R1 → P2 → R2 → P1</p>
        </div>
      )}
    </div>
  );
}

function Predictions({ risk, cpu, cycle, go }: { risk: number; cpu: number; cycle: boolean; go: (x: any) => void }) {
  const items = [
    ['CPU contention is increasing', Math.min(95, cpu + 16), 'Monitor scheduler', 'CPU Scheduling'],
    ['Memory utilization is approaching the warning threshold', 76, 'Inspect allocations', 'Memory Manager'],
    [cycle ? 'Resource contention requires immediate recovery' : 'Process latency remains contained', cycle ? 98 : 82, cycle ? 'Run deadlock check' : 'Run Round Robin', cycle ? 'Deadlock Detection' : 'CPU Scheduling'],
  ];

  return (
    <div className="prediction-layout">
      <div className="panel risk-panel">
        <span className="eyebrow">PREDICTION CENTER / 06</span>
        <div className="risk-line">
          <div className="gauge" style={{ '--p': risk + '%' } as React.CSSProperties}>
            <b>{risk}</b>
            <small>/100</small>
          </div>
          <div>
            <h2>
              WHAT HAPPENS
              <br />
              NEXT?
            </h2>
            <p>Calculated from CPU workload, memory demand, page faults and resource contention.</p>
            <span className={risk > 65 ? 'state blocked' : 'state ready'}>{risk > 65 ? 'ELEVATED RISK' : 'LOW RISK'}</span>
          </div>
        </div>
      </div>

      <div className="prediction-cards">
        {items.map(([title, conf, action, target], i) => (
          <motion.div className="panel prediction-card" whileHover={{ y: -4 }} key={title as string}>
            <div className="pred-icon">{i === 0 ? <Cpu /> : i === 1 ? <MemoryStick /> : <Network />}</div>
            <span className="eyebrow">{i === 0 ? 'CPU RISK' : i === 1 ? 'MEMORY RISK' : 'PROCESS CONTENTION'}</span>
            <h3>{title}</h3>
            <div className="confidence">
              <i style={{ width: conf + '%' }} />
              <span>{conf}% confidence</span>
            </div>
            <button onClick={() => go(target)}>
              {action}
              <ArrowRight />
            </button>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function Analytics({ procs, cpu, used, result }: { procs: Proc[]; cpu: number; used: number; result: ReturnType<typeof schedule> }) {
  const dat = Array.from({ length: 12 }, (_, i) => ({
    t: 'T+' + i,
    cpu: Math.max(20, cpu - 24 + ((i * 7) % 31)),
    memory: Math.round(used / 1000 - 1 + (((i * 3) % 10) / 10)),
    wait: Math.max(1, result.wait - 2 + ((i * 5) % 7)),
  }));

  return (
    <div className="analytics-layout">
      <div className="panel chart-panel">
        <div className="panel-head">
          <div>
            <span className="eyebrow">SYSTEM ANALYTICS</span>
            <h2>CPU & MEMORY</h2>
          </div>
          <span className="meta-tag">LAST 12 CYCLES</span>
        </div>

        <ResponsiveContainer width="100%" height={260}>
          <AreaChart data={dat}>
            <XAxis dataKey="t" stroke="#7b817d" />
            <YAxis stroke="#7b817d" />
            <Tooltip />
            <Area type="monotone" dataKey="cpu" stroke="#c6734f" fill="#de9b7e" fillOpacity={0.18} />
            <Area type="monotone" dataKey="memory" stroke="#7e8d6d" fill="#9aa67a" fillOpacity={0.14} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="panel chart-panel">
        <span className="eyebrow">SCHEDULING PERFORMANCE</span>
        <h2>WAITING TIME</h2>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={procs}>
            <XAxis dataKey="id" stroke="#7b817d" />
            <YAxis stroke="#7b817d" />
            <Tooltip />
            <Bar dataKey="burst" fill="#d28b6e" radius={[5, 5, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="panel timeline-panel">
        <span className="eyebrow">OBSERVATION</span>
        <h2>Replay a previous system state.</h2>
        <input className="timeline" type="range" min="0" max="100" defaultValue="78" />
        <div>
          <small>t-12 min</small>
          <small>NOW</small>
        </div>
      </div>
    </div>
  );
}

function Onboard({ close }: { close: () => void }) {
  return (
    <motion.div className="overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div className="onboard" initial={{ y: 25, scale: 0.96 }} animate={{ y: 0, scale: 1 }}>
        <div className="onboard-logo">
          <ShieldCheck />
        </div>
        <span className="eyebrow">OS GUARDIAN / INITIALIZATION</span>
        <h1>Meet your OS Guardian.</h1>
        <p>Simulate, visualize and understand how an operating system manages processes, memory and resources.</p>
        <div className="steps">
          <span>
            <b>01</b> Monitor
          </span>
          <span>
            <b>02</b> Simulate
          </span>
          <span>
            <b>03</b> Predict
          </span>
        </div>
        <button className="primary enter" onClick={close}>
          Enter system <ArrowRight />
        </button>
        <button className="skip" onClick={close}>
          Skip introduction
        </button>
      </motion.div>
    </motion.div>
  );
}

function CommandPalette({ go, close, reset }: { go: (x: any) => void; close: () => void; reset: () => void }) {
  const cmds: [string, () => void][] = [
    ['Open Process Monitor', () => go('Process Monitor')],
    ['Run FCFS', () => go('CPU Scheduling')],
    ['Run Round Robin', () => go('CPU Scheduling')],
    ['Open Memory Manager', () => go('Memory Manager')],
    ['Detect Deadlock', () => go('Deadlock Detection')],
    ['Open Prediction Center', () => go('Prediction Center')],
    ['Reset Simulation', reset],
  ];

  return (
    <div className="overlay command-overlay" onMouseDown={close}>
      <motion.div className="command-box" initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} onMouseDown={(e) => e.stopPropagation()}>
        <div>
          <Search />
          <input autoFocus placeholder="Type a command…" />
          <kbd>ESC</kbd>
        </div>
        {cmds.map(([n, f]) => (
          <button key={n} onClick={f}>
            <Command /> {n}
            <ArrowRight />
          </button>
        ))}
      </motion.div>
    </div>
  );
}

createRoot(document.getElementById('root')!).render(<App />);

import { useState, useEffect, useMemo, useRef } from "react";
import { BrowserRouter, Routes, Route, Link, useLocation, useParams, useNavigate } from "react-router-dom";
import { 
  LayoutDashboard, 
  Cpu, 
  Terminal,
  Activity,
  Box,
  Search,
  ChevronLeft,
  FileCode,
  Info,
  Network,
  HardDrive,
  Filter,
  Layers,
  ShieldCheck,
  Zap,
  Copy,
  Check,
  Monitor,
  Maximize2,
  Minimize2,
  RefreshCw,
  AlertCircle,
  Globe,
  Server,
  Database,
  Hash
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Terminal as XTerm } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";

// --- Types ---

interface ResourceMetadata {
  name: string;
  namespace: string;
  uid: string;
  creationTimestamp: string;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

interface VM {
  metadata: ResourceMetadata;
  spec: {
    running?: boolean;
    runStrategy?: string;
    template?: {
      metadata?: { labels?: Record<string, string>; annotations?: Record<string, string>; };
      spec?: {
        architecture?: string;
        domain?: {
          machine?: { type?: string };
          cpu?: { cores?: number, sockets?: number, threads?: number };
          resources?: { requests?: { cpu?: string, memory?: string } };
          devices?: { interfaces?: Array<{ name: string, model?: string }> };
        };
        networks?: Array<{ name: string, pod?: any }>;
        volumes?: Array<{ name: string, dataVolume?: { name: string } }>;
      };
    };
  };
  status?: { printableStatus?: string; conditions?: Array<{ type: string; status: string; message?: string; reason?: string }>; };
}

interface VMI {
  metadata: ResourceMetadata;
  status: { phase: string; interfaces?: Array<{ ipAddress?: string; name: string }>; nodeName?: string };
}

interface DV {
  metadata: ResourceMetadata;
  status?: { phase: string; progress?: string; conditions?: Array<{ type: string; status: string; message?: string; reason?: string }>; };
  spec: { storage?: { resources?: { requests?: { storage?: string } } }; pvc?: { resources?: { requests?: { storage?: string } } }; source?: Record<string, any>; };
}

interface K8sNode {
  metadata: ResourceMetadata;
  status: { capacity: Record<string, string>; allocatable: Record<string, string>; conditions: Array<{ type: string; status: string }>; };
  spec: { unschedulable?: boolean };
}

interface K8sPod {
  metadata: ResourceMetadata;
  status: { phase: string; containerStatuses?: Array<{ ready: boolean; restartCount: number }>; };
}

// --- Utils ---

const parseStorage = (s?: string): number => {
  if (!s) return 0;
  const num = parseFloat(s);
  if (s.endsWith("Ti")) return num * 1024;
  if (s.endsWith("Gi")) return num;
  if (s.endsWith("Mi")) return num / 1024;
  if (s.endsWith("Ki")) return num / (1024 * 1024);
  return num / (1024 * 1024 * 1024); // Default bytes to Gi
};

const formatStorage = (gi: number): string => {
  if (gi >= 1024) return `${(gi / 1024).toFixed(1)}Ti`;
  return `${gi.toFixed(1)}Gi`;
};

// --- Context / API Wrapper ---

const getContext = () => localStorage.getItem("kube-context") || "";
const setContext = (ctx: string) => localStorage.setItem("kube-context", ctx);

const apiFetch = (url: string, options: RequestInit = {}) => {
  const ctx = getContext();
  const headers = new Headers(options.headers || {});
  if (ctx) headers.set("X-Kube-Context", ctx);
  return fetch(url, { ...options, headers });
};

// --- Components ---

function StatusBadge({ status }: { status?: string }) {
  if (!status) return <Badge variant="outline">Unknown</Badge>;
  const lower = status.toLowerCase();
  let variant = "outline";
  if (lower.includes("running") || lower.includes("succeeded") || lower.includes("ready") || lower.includes("true")) variant = "success";
  else if (lower.includes("error") || lower.includes("fail") || lower.includes("crash") || lower.includes("false")) variant = "danger";
  else if (lower.includes("start") || lower.includes("progress") || lower.includes("migrat") || lower.includes("import") || lower.includes("pending")) variant = "warning";
  return <Badge variant={variant}>{status}</Badge>;
}

function Badge({ children, variant = "default", className }: { children: React.ReactNode, variant?: string, className?: string }) {
  const variants: Record<string, string> = {
    default: "bg-zinc-950 text-white",
    success: "bg-green-100 text-green-700 border-green-200",
    warning: "bg-yellow-100 text-yellow-700 border-yellow-200",
    danger: "bg-red-100 text-red-700 border-red-200",
    outline: "border border-zinc-200 bg-white text-zinc-600"
  };
  return <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold border transition-colors tracking-tight", variants[variant], className)}>{children}</span>;
}

function Card({ children, title, description, footer, icon: Icon, className }: { children?: React.ReactNode, title?: string, description?: string, footer?: string, icon?: any, className?: string }) {
  return (
    <div className={cn("rounded-2xl border bg-white shadow-sm overflow-hidden flex flex-col", className)}>
      <div className="p-6 flex-1">
        <div className="flex items-center justify-between pb-3">
          <h3 className="text-[10px] font-black uppercase tracking-[0.1em] text-zinc-400">{title}</h3>
          {Icon && <Icon className="h-4 w-4 text-zinc-300" />}
        </div>
        {description && <p className="text-3xl font-black tracking-tighter text-zinc-900 leading-none">{description}</p>}
        {children && <div className="mt-2">{children}</div>}
      </div>
      {footer && <div className="bg-zinc-50/50 px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-400 border-t border-zinc-100/50">{footer}</div>}
    </div>
  );
}

function CopyableText({ text, label }: { text: string, label?: string }) {
  const [copied, setCopied] = useState(false);
  const onCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="group relative flex flex-col gap-1 w-full bg-zinc-50/50 p-2.5 rounded-xl border border-zinc-100 hover:border-zinc-200 transition-all">
      {label && <div className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">{label}</div>}
      <div className="flex items-start justify-between gap-4">
        <div className="text-[11px] font-mono font-bold text-zinc-800 break-all leading-relaxed flex-1">{text}</div>
        <button onClick={onCopy} className="p-1 hover:bg-white rounded-lg border border-transparent hover:border-zinc-200 transition-all text-zinc-400 hover:text-zinc-900 shrink-0 mt-0.5 shadow-sm">{copied ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}</button>
      </div>
    </div>
  );
}

const decoder = new TextDecoder();

function SerialConsole({ namespace, name, active }: { namespace: string, name: string, active: boolean }) {
  const termRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [isTheaterMode, setIsTheaterMode] = useState(false);
  const [connStatus, setConnStatus] = useState<"connecting" | "connected" | "error" | "closed">("connecting");

  const syncSize = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN && xtermRef.current && fitAddonRef.current) {
      fitAddonRef.current.fit();
      const term = xtermRef.current;
      wsRef.current.send(`\x15export TERM=xterm-256color LANG=C.UTF-8; stty cols ${term.cols} rows ${term.rows}\r`);
      term.focus();
    }
  };

  const toggleTheaterMode = () => setIsTheaterMode(!isTheaterMode);

  useEffect(() => {
    if (isTheaterMode) {
      const handleEsc = (e: KeyboardEvent) => { if (e.key === "Escape") setIsTheaterMode(false); };
      window.addEventListener("keydown", handleEsc);
      return () => window.removeEventListener("keydown", handleEsc);
    }
  }, [isTheaterMode]);

  useEffect(() => {
    if (fitAddonRef.current) {
      setTimeout(() => { fitAddonRef.current?.fit(); }, 200);
    }
  }, [isTheaterMode]);

  useEffect(() => {
    if (!active || !termRef.current) return;

    const term = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Consolas, "Liberation Mono", monospace',
      theme: { background: "#09090b" },
      convertEol: true,
      scrollback: 10000
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(termRef.current);
    fitAddon.fit();
    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const ctx = getContext();
    const wsUrl = `${protocol}//${window.location.host}/api/v1/ws?namespace=${namespace}&vmi=${name}&context=${ctx}`;
    const ws = new WebSocket(wsUrl);
    ws.binaryType = 'arraybuffer';
    wsRef.current = ws;

    ws.onopen = () => {
      setConnStatus("connected");
      term.clear();
      term.focus();
    };

    ws.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        term.write(decoder.decode(event.data));
      } else if (typeof event.data === "string") {
        if (event.data.startsWith("serial console error")) {
          setConnStatus("error");
          term.write(`\r\n\x1b[31m${event.data}\x1b[0m\r\n`);
        }
      }
    };

    ws.onclose = () => setConnStatus("closed");
    ws.onerror = () => setConnStatus("error");

    term.onData((data) => { if (ws.readyState === WebSocket.OPEN) ws.send(data); });

    const handleResize = () => fitAddon.fit();
    window.addEventListener("resize", handleResize);

    return () => {
      ws.close();
      term.dispose();
      window.removeEventListener("resize", handleResize);
    };
  }, [active, namespace, name]);

  return (
    <div className={cn(
      "bg-zinc-950 shadow-2xl overflow-hidden flex flex-col transition-all duration-300",
      isTheaterMode 
        ? "fixed inset-0 z-[100] h-screen w-screen rounded-none" 
        : "rounded-2xl border border-zinc-800 h-[calc(100vh-280px)] min-h-[600px] w-full"
    )}>
      <div className="flex items-center justify-between gap-2 bg-zinc-900 border-b border-zinc-800 p-3 px-5">
         <div className="flex items-center gap-3">
            <div className={cn(
              "w-2.5 h-2.5 rounded-full",
              connStatus === "connected" ? "bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.5)]" :
              connStatus === "error" ? "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" : "bg-zinc-600"
            )} />
            <div className="flex flex-col">
               <span className="text-[10px] font-black uppercase text-zinc-400 tracking-widest">
                 {connStatus === "connected" ? (isTheaterMode ? `Live: ${namespace}/${name}` : "Serial Console") : "Offline"}
               </span>
               {connStatus === "connected" && (
                 <div className="flex items-center gap-1.5 text-blue-400 animate-in slide-in-from-top-1">
                    <AlertCircle size={10} />
                    <span className="text-[9px] font-bold uppercase tracking-tight text-blue-300">进入 Shell 后点击 Sync Size 同步</span>
                 </div>
               )}
            </div>
         </div>
         <div className="flex gap-2">
            <button onClick={syncSize} className="flex items-center gap-2 px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-md text-[10px] font-bold uppercase transition-all border border-zinc-700 shadow-sm active:scale-95">
               <RefreshCw size={12} /> Sync Size
            </button>
            <button onClick={toggleTheaterMode} className="flex items-center gap-2 px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-md text-[10px] font-bold uppercase transition-all border border-zinc-700 shadow-sm">
               {isTheaterMode ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
               {isTheaterMode ? "Exit" : "Theater"}
            </button>
         </div>
      </div>
      <div ref={termRef} className="flex-1 p-2" />
    </div>
  );
}

// --- Views ---

function DashboardOverview() {
  const [data, setData] = useState<{ 
    vms: VM[], vmis: VMI[], dvs: DV[], nodes: K8sNode[], kvPods: K8sPod[], loading: boolean 
  }>({ vms: [], vmis: [], dvs: [], nodes: [], kvPods: [], loading: true });

  useEffect(() => {
    const load = async () => {
      try {
        const [vmsR, vmisR, dvsR, nodesR, podsR] = await Promise.all([ 
          apiFetch("/api/v1/vms").then(r => r.json()), 
          apiFetch("/apis/kubevirt.io/v1/virtualmachineinstances").then(r => r.json()), 
          apiFetch("/apis/cdi.kubevirt.io/v1beta1/datavolumes").then(r => r.json()),
          apiFetch("/api/v1/nodes").then(r => r.json()),
          apiFetch("/api/v1/namespaces/kubevirt/pods").then(r => r.json())
        ]);
        setData({ 
          vms: vmsR.items || [], 
          vmis: vmisR.items || [], 
          dvs: dvsR.items || [], 
          nodes: nodesR.items || [], 
          kvPods: podsR.items || [],
          loading: false 
        });
      } catch (e) { setData(prev => ({ ...prev, loading: false })); }
    }; load();
  }, []);

  const nodeStats = useMemo(() => {
    const total = data.nodes.length;
    const unschedulable = data.nodes.filter(n => n.spec.unschedulable).length;
    const ready = data.nodes.filter(n => n.status.conditions.some(c => c.type === "Ready" && c.status === "True")).length;
    return { total, unschedulable, ready };
  }, [data.nodes]);

  const nsAnalysis = useMemo(() => {
    const analysis: Record<string, { vmCount: number, storageGi: number }> = {};
    data.vms.forEach(vm => {
      const ns = vm.metadata.namespace;
      if (!analysis[ns]) analysis[ns] = { vmCount: 0, storageGi: 0 };
      analysis[ns].vmCount++;
    });
    data.dvs.forEach(dv => {
      const ns = dv.metadata.namespace;
      if (!analysis[ns]) analysis[ns] = { vmCount: 0, storageGi: 0 };
      const requested = dv.spec.storage?.resources?.requests?.storage || dv.spec.pvc?.resources?.requests?.storage;
      analysis[ns].storageGi += parseStorage(requested);
    });
    return Object.entries(analysis).sort((a, b) => b[1].vmCount - a[1].vmCount).map(([name, stats]) => ({ name, ...stats }));
  }, [data.vms, data.dvs]);

  const infraHealth = useMemo(() => {
    const components = ["virt-api", "virt-controller", "virt-handler"];
    return components.map(c => {
      const pods = data.kvPods.filter(p => p.metadata.name.startsWith(c));
      const healthy = pods.length > 0 && pods.every(p => p.status.phase === "Running");
      return { name: c, healthy, count: pods.length };
    });
  }, [data.kvPods]);

  if (data.loading) return <div className="p-24 text-center font-bold text-zinc-400 tracking-widest uppercase animate-pulse">Initializing Command Center...</div>;

  const totalStorageGi = nsAnalysis.reduce((acc, curr) => acc + curr.storageGi, 0);

  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      <div>
        <h2 className="text-3xl font-black tracking-tighter uppercase text-zinc-900 leading-none">Cluster Dashboard</h2>
        <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mt-2">Fabric Infrastructure Overview</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card title="Compute Nodes" description={nodeStats.total.toString()} icon={Server} footer={`${nodeStats.ready} Ready / ${nodeStats.unschedulable} Cordoned`} />
        <Card title="Virtual Units" description={data.vms.length.toString()} icon={Cpu} footer={`${data.vmis.length} Streams Active`} />
        <Card title="Disk Allocation" description={formatStorage(totalStorageGi)} icon={Database} footer={`${data.dvs.length} Active Blocks`} />
        <Card title="Infrastructure" description={infraHealth.every(i => i.healthy) ? "Stable" : "Degraded"} icon={ShieldCheck} className={infraHealth.every(i => i.healthy) ? "" : "border-red-200"}>
           <div className="flex gap-2 mt-2">
              {infraHealth.map(i => (
                <div key={i.name} title={i.name} className={cn("w-2.5 h-2.5 rounded-full border border-white/20", i.healthy ? "bg-green-500" : "bg-red-500 animate-pulse")} />
              ))}
           </div>
        </Card>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Namespace Analytics */}
        <Card title="Namespace Analysis" className="lg:col-span-1">
           <div className="space-y-5 mt-4">
              {nsAnalysis.slice(0, 8).map(ns => (
                <div key={ns.name} className="group flex flex-col gap-2">
                   <div className="flex justify-between items-start px-1 gap-4">
                      <span className="text-[11px] font-black uppercase text-zinc-700 break-all leading-tight">{ns.name}</span>
                      <div className="flex gap-3 text-[9px] font-bold text-zinc-400 shrink-0">
                         <span className="flex items-center gap-1 whitespace-nowrap"><Cpu size={10}/> {ns.vmCount}</span>
                         <span className="flex items-center gap-1 whitespace-nowrap"><Database size={10}/> {formatStorage(ns.storageGi)}</span>
                      </div>
                   </div>
                   <div className="h-1.5 w-full bg-zinc-100 rounded-full overflow-hidden">
                      <div className="h-full bg-zinc-950 transition-all duration-1000 ease-out group-hover:bg-blue-600" style={{ width: `${(ns.vmCount / (data.vms.length || 1)) * 100}%` }} />
                   </div>
                </div>
              ))}
              {nsAnalysis.length === 0 && <p className="text-zinc-300 text-[10px] font-black uppercase tracking-widest text-center py-8">Empty Mesh</p>}
           </div>
        </Card>

        {/* Node Performance */}
        <Card title="Node Distribution" className="lg:col-span-2">
           <div className="grid sm:grid-cols-2 gap-4 mt-2">
              {data.nodes.slice(0, 10).map(node => {
                const nodeVmis = data.vmis.filter(v => v.status.nodeName === node.metadata.name);
                const isReady = node.status.conditions.some(c => c.type === "Ready" && c.status === "True");
                
                return (
                  <div key={node.metadata.uid} className="flex items-start justify-between p-4 rounded-2xl border border-zinc-100 hover:border-zinc-200 transition-all bg-zinc-50/20">
                     <div className="flex items-center gap-4">
                        <div className={cn("p-2.5 rounded-xl border", isReady ? "bg-white text-zinc-600 border-zinc-100" : "bg-red-50 text-red-600 border-red-100")}>
                           <Server size={18} />
                        </div>
                        <div>
                           <div className="text-[11px] font-black text-zinc-900 break-all leading-tight">{node.metadata.name}</div>
                           <div className="text-[9px] font-bold text-zinc-400 uppercase tracking-tighter mt-0.5">{node.status.capacity.cpu} cores / {node.status.capacity.memory}</div>
                        </div>
                     </div>
                     <div className="flex flex-col items-end gap-1">
                        <Badge variant="outline" className="px-1.5 py-0 border-zinc-300">
                           <Hash size={8} className="mr-1" /> {nodeVmis.length} VMs
                        </Badge>
                        <div className="text-[9px] font-black text-zinc-400 uppercase">{isReady ? "Ready" : "Offline"}</div>
                     </div>
                  </div>
                );
              })}
              {data.nodes.length === 0 && <div className="col-span-2 py-12 text-center text-zinc-300 font-black uppercase tracking-widest italic">No Cluster Nodes</div>}
           </div>
        </Card>
      </div>

      {/* Control Plane Integrity */}
      <div className="grid gap-8 lg:grid-cols-3">
         <Card title="Infrastructure Integrity" className="lg:col-span-1">
            <div className="space-y-3 mt-2">
               {infraHealth.map(i => (
                 <div key={i.name} className="flex items-center justify-between p-3.5 rounded-2xl border border-zinc-100 bg-zinc-50/30">
                    <div className="flex items-center gap-3">
                       <div className={cn("p-2 rounded-xl", i.healthy ? "bg-green-100 text-green-600" : "bg-red-100 text-red-600")}>
                          <ShieldCheck size={16}/>
                       </div>
                       <span className="text-[11px] font-black uppercase text-zinc-700 tracking-tight">{i.name.replace('virt-', '')}</span>
                    </div>
                    <Badge variant={i.healthy ? "success" : "danger"} className="rounded-full px-3">{i.count} Instance</Badge>
                 </div>
               ))}
            </div>
         </Card>

         <Card title="Recent Provisioning" className="lg:col-span-2">
            <div className="space-y-2 mt-2">
               {[...data.vms].sort((a,b) => new Date(b.metadata.creationTimestamp).getTime() - new Date(a.metadata.creationTimestamp).getTime()).slice(0, 5).map(vm => (
                 <div key={vm.metadata.uid} className="flex items-center justify-between p-3.5 hover:bg-zinc-50 rounded-2xl transition-all border border-transparent hover:border-zinc-100">
                    <div className="flex items-center gap-4">
                       <div className="w-10 h-10 bg-zinc-100 text-zinc-500 rounded-xl flex items-center justify-center font-black text-sm uppercase shadow-inner border border-zinc-200/50">{vm.metadata.name[0]}</div>
                       <div>
                          <Link to={`/vms/${vm.metadata.namespace}/${vm.metadata.name}`} className="text-xs font-black text-zinc-900 hover:text-blue-700 transition-colors tracking-tight">{vm.metadata.name}</Link>
                          <div className="text-[9px] text-zinc-400 font-bold uppercase tracking-tight">{new Date(vm.metadata.creationTimestamp).toLocaleDateString()} · {vm.metadata.namespace}</div>
                       </div>
                    </div>
                    <StatusBadge status={vm.status?.printableStatus} />
                 </div>
               ))}
            </div>
         </Card>
      </div>
    </div>
  );
}

function DVDetail() {
  const { namespace, name } = useParams();
  const navigate = useNavigate();
  const [dv, setDv] = useState<DV | null>(null);
  const [dvYaml, setDvYaml] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [res, yamlRes] = await Promise.all([
          apiFetch(`/apis/cdi.kubevirt.io/v1beta1/namespaces/${namespace}/datavolumes/${name}`),
          apiFetch(`/api/v1/yaml/datavolumes/${namespace}/${name}`)
        ]);
        if (res.ok) setDv(await res.json());
        if (yamlRes.ok) setDvYaml(await yamlRes.text());
      } finally { setLoading(false); }
    };
    fetchData();
  }, [namespace, name]);

  if (loading) return <div className="p-12 text-center animate-pulse text-zinc-500 font-bold uppercase text-xs tracking-widest">Accessing Storage...</div>;
  if (!dv) return <div className="p-12 text-center text-red-600 font-bold border-2 border-dashed border-red-100 rounded-xl mt-8">Storage Block Not Found</div>;

  const sourceType = dv.spec.source ? Object.keys(dv.spec.source)[0] : "manual";
  const sourceDetails = dv.spec.source ? dv.spec.source[sourceType] : {};

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between border-b pb-6 border-zinc-100">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 hover:bg-zinc-100 rounded-lg border border-zinc-200 transition-all bg-white shadow-sm"><ChevronLeft size={18} /></button>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-zinc-900">{dv.metadata.name}</h2>
            <div className="flex items-center gap-3 mt-1 text-xs">
              <span className="font-bold text-zinc-600">{dv.metadata.namespace}</span>
              <StatusBadge status={dv.status?.phase}/>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-8">
        {[ { id: "overview", name: "Overview", icon: Info }, { id: "yaml", name: "Manifest", icon: FileCode } ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={cn("flex items-center gap-2 pb-3 px-1 text-xs font-bold uppercase tracking-wider transition-all border-b-2 -mb-px", activeTab === tab.id ? "border-zinc-950 text-zinc-950" : "border-transparent text-zinc-500 hover:text-zinc-800")}><tab.icon size={14} /> {tab.name}</button>
        ))}
      </div>

      <div className="mt-4">
        {activeTab === "overview" && (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card title="Capacity" icon={HardDrive}>
               <div className="mt-1">
                  <div className="text-2xl font-bold tracking-tight text-zinc-900">{dv.spec.storage?.resources?.requests?.storage || dv.spec.pvc?.resources?.requests?.storage || "N/A"}</div>
                  <div className="text-[10px] font-bold text-zinc-600 uppercase mt-1">Total Requested</div>
               </div>
            </Card>
            <Card title="Transfer Progress" icon={Activity}>
               <div className="mt-1">
                  <div className="text-2xl font-bold tracking-tight text-zinc-900">{dv.status?.progress || "100%"}</div>
                  <div className="h-2 w-full bg-zinc-100 rounded-full overflow-hidden mt-3">
                     <div className="h-full bg-zinc-950 transition-all duration-700 ease-out" style={{ width: dv.status?.progress || '100%' }} />
                  </div>
               </div>
            </Card>
            <Card title="Source Specification" icon={Zap}>
               <div className="mt-1 space-y-3">
                  <div className="flex justify-between items-center text-xs">
                     <span className="text-zinc-600 font-bold uppercase">Type</span>
                     <Badge variant="outline" className="border-zinc-400">{sourceType}</Badge>
                  </div>
                  {Object.entries(sourceDetails).map(([key, value]) => (
                    <CopyableText key={key} label={key} text={String(value)} />
                  ))}
               </div>
            </Card>
            <Card title="Annotations" icon={Layers} className="lg:col-span-3">
               <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-1 text-xs">
                  {Object.entries(dv.metadata.annotations || {}).map(([k, v]) => (
                    <CopyableText key={k} label={k} text={String(v)} />
                  ))}
                  {Object.keys(dv.metadata.annotations || {}).length === 0 && <p className="text-zinc-500 text-xs py-2">No annotations present</p>}
               </div>
            </Card>
            <Card title="Conditions" icon={ShieldCheck} className="lg:col-span-3">
               <div className="space-y-3 mt-1 text-zinc-800 font-medium">
                  {dv.status?.conditions?.map((c: any) => (
                    <div key={c.type} className="flex items-start gap-4 p-3 rounded-xl border border-zinc-100 bg-zinc-50/50">
                       <Badge variant={c.status === "True" ? "success" : "danger"}>{c.type}</Badge>
                       <div className="flex-1">
                          <div className="font-bold text-zinc-900">{c.reason}</div>
                          <div className="text-zinc-700 mt-1 text-[11px] leading-relaxed font-medium">{c.message}</div>
                       </div>
                    </div>
                  ))}
                  {(!dv.status?.conditions || dv.status.conditions.length === 0) && <p className="text-zinc-500 py-4 text-center text-xs font-bold uppercase tracking-widest">Stable State</p>}
               </div>
            </Card>
          </div>
        )}
        {activeTab === "yaml" && (
          <div className="bg-zinc-950 p-8 rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl">
            <pre className="text-zinc-400 text-[13px] overflow-x-auto leading-relaxed font-mono whitespace-pre min-h-[400px]">{dvYaml || "Loading Manifest..."}</pre>
          </div>
        )}
      </div>
    </div>
  );
}

function VMDetail() {
  const { namespace, name } = useParams();
  const navigate = useNavigate();
  const [vm, setVm] = useState<VM | null>(null);
  const [vmi, setVmi] = useState<VMI | null>(null);
  const [vmYaml, setVmYaml] = useState<string>("");
  const [associatedDVs, setAssociatedDVs] = useState<DV[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  const fetchData = async () => {
    try {
      const [vmRes, vmiRes, yamlRes] = await Promise.all([
        apiFetch(`/apis/kubevirt.io/v1/namespaces/${namespace}/virtualmachines/${name}`),
        apiFetch(`/apis/kubevirt.io/v1/namespaces/${namespace}/virtualmachineinstances/${name}`),
        apiFetch(`/api/v1/yaml/virtualmachines/${namespace}/${name}`)
      ]);
      const vmData = vmRes.ok ? await vmRes.json() : null;
      setVm(vmData);
      if (vmiRes.ok) setVmi(await vmiRes.json()); else setVmi(null);
      if (yamlRes.ok) setVmYaml(await yamlRes.text());
      if (vmData?.spec.template?.spec?.volumes) {
        const dvNames = vmData.spec.template.spec.volumes.filter((v: any) => v.dataVolume).map((v: any) => v.dataVolume.name);
        if (dvNames.length > 0) {
          const dvs = await Promise.all(dvNames.map((dvName: string) => apiFetch(`/apis/cdi.kubevirt.io/v1beta1/namespaces/${namespace}/datavolumes/${dvName}`).then(r => r.ok ? r.json() : null)));
          setAssociatedDVs(dvs.filter(d => d !== null));
        }
      }
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, [namespace, name]);

  const handleAction = async (action: string) => {
    await apiFetch(`/apis/subresources.kubevirt.io/v1/namespaces/${namespace}/virtualmachines/${name}/${action}`, { method: 'PUT', body: '{}' });
    fetchData();
  };

  if (loading) return <div className="p-12 text-center animate-pulse text-zinc-500 font-bold uppercase tracking-widest text-xs">Accessing Fabric...</div>;
  if (!vm) return <div className="p-12 text-center text-red-600 font-bold border-2 border-dashed border-red-100 rounded-xl mt-8">Unit Sync Error</div>;

  const cpuConfig = vm.spec.template?.spec?.domain?.cpu;
  const resources = vm.spec.template?.spec?.domain?.resources;
  const interfaces = vm.spec.template?.spec?.domain?.devices?.interfaces || [];
  const architecture = vm.spec.template?.spec?.architecture || "amd64";
  const machineType = vm.spec.template?.spec?.domain?.machine?.type || "q35";

  return (
    <div className={cn("space-y-6 animate-in fade-in duration-500", activeTab === "console" ? "max-w-full" : "")}>
      <div className="flex items-center justify-between border-b pb-6 border-zinc-100">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate("/vms")} className="p-2 hover:bg-zinc-100 rounded-lg border border-zinc-200 transition-all bg-white shadow-sm"><ChevronLeft size={18} /></button>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-zinc-900">{vm.metadata.name}</h2>
            <div className="flex items-center gap-3 mt-1 text-xs">
              <span className="font-bold text-zinc-600">{vm.metadata.namespace}</span>
              <StatusBadge status={vm.status?.printableStatus}/>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
           <button onClick={() => handleAction('start')} className="flex items-center gap-2 px-4 py-2 bg-zinc-950 text-white rounded-lg text-xs font-bold transition-all hover:bg-zinc-800 shadow-md">Start</button>
           <button onClick={() => handleAction('stop')} className="flex items-center gap-2 px-4 py-2 bg-white border border-red-100 rounded-lg text-xs font-bold hover:bg-red-50 transition-all text-red-600 shadow-sm">Stop</button>
           <button onClick={() => handleAction('restart')} className="flex items-center gap-2 px-4 py-2 bg-white border border-zinc-200 rounded-lg text-xs font-bold hover:bg-zinc-50 transition-all shadow-sm">Restart</button>
        </div>
      </div>

      <div className="flex gap-10">
        {[ 
          { id: "overview", name: "Overview", icon: Info }, 
          { id: "console", name: "Console", icon: Monitor }, 
          { id: "yaml", name: "Specification", icon: FileCode } 
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={cn("flex items-center gap-2 pb-3 px-1 text-xs font-bold uppercase tracking-wider transition-all border-b-2 -mb-px", activeTab === tab.id ? "border-zinc-950 text-zinc-950" : "border-transparent text-zinc-500 hover:text-zinc-800")}><tab.icon size={14} /> {tab.name}</button>
        ))}
      </div>

      <div className="mt-4">
        {activeTab === "overview" && (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card title="Lifecycle Strategy" icon={ShieldCheck}>
               <div className="space-y-3 mt-1 text-zinc-900 font-medium">
                  <div className="flex justify-between items-center text-xs"><span className="text-zinc-600 font-bold uppercase">Run Strategy</span><Badge variant="outline" className="border-zinc-400">{vm.spec.runStrategy || "Default"}</Badge></div>
                  <div className="flex justify-between items-center text-xs border-t pt-2.5 border-zinc-50"><span className="text-zinc-600 font-bold uppercase">Desired State</span><span className="font-bold text-zinc-950">{vm.spec.running ? "Active" : "Halted"}</span></div>
               </div>
            </Card>
            <Card title="Compute" icon={Cpu}>
              <div className="grid grid-cols-2 gap-4 mt-1 font-medium">
                <div><div className="text-2xl font-bold tracking-tight text-zinc-900">{cpuConfig?.cores || 1}</div><div className="text-[10px] font-bold text-zinc-600 uppercase">Cores</div></div>
                <div><div className="text-2xl font-bold tracking-tight text-zinc-900">{resources?.requests?.memory || "1Gi"}</div><div className="text-[10px] font-bold text-zinc-600 uppercase">Memory</div></div>
              </div>
              <div className="flex gap-4 mt-3.5 pt-3 border-t border-zinc-50 text-[10px] font-mono font-bold text-zinc-500 uppercase"><span>{architecture}</span><span>{machineType}</span></div>
            </Card>
            <Card title="Status" icon={Activity}>
              {vmi ? (
                <div className="mt-1 font-medium">
                  <div className="flex justify-between items-center"><span className="text-xs font-bold text-green-600 uppercase tracking-tighter">{vmi.status.phase}</span><span className="text-[10px] font-mono font-bold text-zinc-600 bg-zinc-100 px-2 py-0.5 rounded">{vmi.status.nodeName}</span></div>
                  <div className="text-lg font-mono mt-2 font-bold tracking-tight text-zinc-900">{vmi.status.interfaces?.[0]?.ipAddress || "Pending IP..."}</div>
                </div>
              ) : ( <div className="text-[11px] text-zinc-500 font-bold uppercase mt-4 italic">No Active stream</div> )}
            </Card>
            <Card title="Metadata" icon={Layers} className="lg:col-span-3">
               <div className="grid md:grid-cols-2 gap-8 mt-1 text-zinc-900">
                  <div className="space-y-3">
                     <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Labels</div>
                     <div className="flex flex-wrap gap-2">
                        {Object.entries(vm.spec.template?.metadata?.labels || {}).map(([k, v]) => (
                          <span key={k} className="px-2 py-1 bg-zinc-50 text-zinc-700 rounded-lg text-[10px] font-bold border border-zinc-200">{k}: {v}</span>
                        ))}
                        {Object.keys(vm.spec.template?.metadata?.labels || {}).length === 0 && <span className="text-zinc-500 text-xs">None</span>}
                     </div>
                  </div>
                  <div className="space-y-3">
                     <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Annotations</div>
                     <div className="grid grid-cols-1 gap-2">
                        {Object.entries(vm.spec.template?.metadata?.annotations || {}).slice(0, 8).map(([k, v]) => (
                          <CopyableText key={k} label={k} text={String(v)} />
                        ))}
                        {Object.keys(vm.spec.template?.metadata?.annotations || {}).length === 0 && <span className="text-zinc-500 text-xs">None</span>}
                     </div>
                  </div>
               </div>
            </Card>
            <Card title="Storage" icon={HardDrive}>
               <div className="space-y-2.5 mt-1">
                 {associatedDVs.map(dv => (
                   <div key={dv.metadata.uid} className="flex items-center justify-between text-xs p-2 bg-zinc-50/50 rounded-lg border border-zinc-100 font-medium gap-4">
                      <Link to={`/dvs/${dv.metadata.namespace}/${dv.metadata.name}`} className="font-bold break-all text-blue-700 hover:underline leading-tight flex-1">{dv.metadata.name}</Link>
                      <div className="flex items-center gap-3 shrink-0"><span className="text-[10px] font-bold text-zinc-600 font-mono">{dv.spec.storage?.resources?.requests?.storage || "N/A"}</span><StatusBadge status={dv.status?.phase}/></div>
                   </div>
                 ))}
                 {associatedDVs.length === 0 && <p className="text-zinc-500 text-[11px] py-2 font-bold uppercase tracking-widest opacity-30 text-center">Empty</p>}
               </div>
            </Card>
            <Card title="Networking" icon={Network} className="lg:col-span-2">
              <div className="space-y-2.5 mt-1 text-zinc-900 font-medium">
                {interfaces.map((iface: any) => (
                  <div key={iface.name} className="flex items-center justify-between text-sm p-3.5 bg-zinc-50 rounded-xl border border-zinc-100">
                    <div className="space-y-1"><div className="font-bold text-zinc-900">{iface.name}</div><div className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest">Interface Node</div></div>
                    <div className="flex gap-8 font-mono text-[11px]"><span className="text-zinc-600 font-medium uppercase">{iface.model || "virtio"}</span><span className="font-bold text-zinc-950">{vmi?.status.interfaces?.[0]?.ipAddress || "DISCONNECTED"}</span></div>
                  </div>
                ))}
              </div>
            </Card>
            <Card title="Conditions" icon={ShieldCheck} className="lg:col-span-3">
               <div className="space-y-3 mt-1 text-zinc-800 font-medium">
                  {vm.status?.conditions?.map((c: any) => (
                    <div key={c.type} className="flex items-start gap-4 p-3 rounded-xl border border-zinc-100 bg-zinc-50/50">
                       <Badge variant={c.status === "True" ? "success" : "danger"}>{c.type}</Badge>
                       <div className="flex-1"><div className="font-bold text-zinc-900">{c.reason}</div><div className="text-zinc-700 mt-1 text-[11px] leading-relaxed font-medium">{c.message}</div></div>
                    </div>
                  ))}
                  {(!vm.status?.conditions || vm.status.conditions.length === 0) && <p className="text-zinc-500 py-4 text-center text-xs font-bold uppercase tracking-widest opacity-40">Healthy</p>}
               </div>
            </Card>
          </div>
        )}
        {activeTab === "console" && (
          <div className="animate-in zoom-in-95 duration-300">
             <SerialConsole namespace={namespace!} name={name!} active={true} />
          </div>
        )}
        {activeTab === "yaml" && ( <div className="bg-zinc-950 p-8 rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl"><pre className="text-zinc-400 text-[13px] overflow-x-auto leading-relaxed font-mono whitespace-pre min-h-[400px]">{vmYaml || "Fetching..."}</pre></div> )}
      </div>
    </div>
  );
}

function DVList() {
  const [dvs, setDvs] = useState<DV[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  useEffect(() => { apiFetch("/apis/cdi.kubevirt.io/v1beta1/datavolumes").then(r => r.json()).then(data => { setDvs(data.items || []); setLoading(false); }); }, []);
  const filtered = dvs.filter(dv => dv.metadata.name.toLowerCase().includes(searchTerm.toLowerCase()));
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div><h2 className="text-3xl font-bold tracking-tight text-zinc-900 uppercase leading-none">Storage</h2><p className="text-zinc-600 text-[11px] font-bold uppercase tracking-widest mt-2">Data Volumes</p></div>
      <div className="bg-white p-3 rounded-xl border border-zinc-200 flex items-center gap-4 shadow-sm max-w-2xl"><Search size={18} className="text-zinc-500" /><input type="text" placeholder="Search storage..." className="flex-1 bg-transparent border-none outline-none text-sm font-bold text-zinc-900" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/></div>
      <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden"><table className="w-full text-sm text-left font-medium"><thead className="bg-zinc-50/50 border-b text-zinc-600 font-bold uppercase text-[10px] tracking-[0.15em]"><tr><th className="h-12 px-6 text-zinc-700">Name</th><th className="h-12 px-6 text-center text-zinc-700">Status</th><th className="h-12 px-6 text-zinc-700">Capacity</th><th className="h-12 px-6 text-right text-zinc-700">Source</th></tr></thead><tbody className="divide-y divide-zinc-100 font-medium text-zinc-800">{loading ? ( <tr><td colSpan={4} className="h-32 text-center text-zinc-400 font-bold uppercase animate-pulse">Syncing...</td></tr> ) : filtered.map(dv => ( <tr key={dv.metadata.uid} className="hover:bg-zinc-50 transition-colors"><td className="px-6 py-4"><Link to={`/dvs/${dv.metadata.namespace}/${dv.metadata.name}`} className="font-bold text-zinc-950 hover:text-blue-700 transition-colors block">{dv.metadata.name}</Link><div className="text-[10px] font-bold text-zinc-500 tracking-tight">{dv.metadata.namespace}</div></td><td className="px-6 py-4 text-center"><StatusBadge status={dv.status?.phase}/></td><td className="px-6 py-4 font-mono font-bold text-zinc-800">{dv.spec.storage?.resources?.requests?.storage || dv.spec.pvc?.resources?.requests?.storage || "N/A"}</td><td className="px-6 py-4 text-right text-[10px] font-bold text-zinc-600 uppercase">{dv.spec.source ? Object.keys(dv.spec.source)[0] : "manual"}</td></tr> ))}</tbody></table></div>
    </div>
  );
}

function VMList() {
  const [vms, setVms] = useState<VM[]>([]);
  const [loading, setLoading] = useState(true);
  const [namespaces, setNamespaces] = useState<string[]>(["all"]);
  const [availableStatuses, setAvailableStatuses] = useState<string[]>(["all"]);
  const [searchTerm, setSearchTerm] = useState("");
  const [nsFilter, setNsFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const fetchVms = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ name: searchTerm, status: statusFilter, namespace: nsFilter });
      const res = await apiFetch(`/api/v1/vms?${params}`);
      const data = await res.json();
      setVms(data.items || []);
    } finally { setLoading(false); }
  };
  useEffect(() => { apiFetch("/api/v1/namespaces-list").then(r => r.json()).then(setNamespaces); apiFetch("/api/v1/vm-statuses").then(r => r.json()).then(setAvailableStatuses); }, []);
  useEffect(() => { const timer = setTimeout(() => fetchVms(), 300); return () => clearTimeout(timer); }, [searchTerm, nsFilter, statusFilter]);
  return (
    <div className="space-y-8 animate-in fade-in duration-500 font-medium">
      <div className="flex justify-between items-end"><div><h2 className="text-3xl font-bold uppercase tracking-tight text-zinc-900 leading-none">Virtual Machines</h2><p className="text-zinc-600 text-xs font-bold uppercase tracking-widest mt-2">Compute Units</p></div><div className="text-[11px] font-bold text-zinc-600 bg-zinc-100 px-3 py-1.5 rounded-lg border uppercase tracking-tighter shadow-sm border-zinc-200">{vms.length} TOTAL</div></div>
      <div className="flex flex-wrap gap-4 items-end bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm"><div className="space-y-1.5 flex-[2] min-w-[250px]"><label className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 flex items-center gap-2"><Search size={14}/> Filter Name</label><input type="text" placeholder="Search..." className="w-full h-10 rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-sm font-bold focus:bg-white text-zinc-900 outline-none transition-all shadow-inner" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}/></div><div className="space-y-1.5 flex-1 min-w-[180px]"><label className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 flex items-center gap-2"><Box size={14}/> Namespace</label><select className="w-full h-10 rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-xs font-bold outline-none focus:bg-white text-zinc-900 transition-all shadow-inner" value={nsFilter} onChange={(e) => setNsFilter(e.target.value)}>{namespaces.map(ns => <option key={ns} value={ns}>{ns}</option>)}</select></div><div className="space-y-1.5 flex-1 min-w-[180px]"><label className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 flex items-center gap-2"><Filter size={14}/> Status</label><select className="w-full h-10 rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-xs font-bold outline-none focus:bg-white text-zinc-900 transition-all shadow-inner" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>{availableStatuses.map(s => <option key={s} value={s.toLowerCase()}>{s}</option>)}</select></div></div>
      <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden"><table className="w-full text-sm text-left"><thead className="bg-zinc-50/50 border-b text-zinc-600 font-bold uppercase text-[10px] tracking-[0.15em]"><tr><th className="h-12 px-4 w-[45%] text-zinc-700">Identity</th><th className="h-12 px-2 text-zinc-700">Namespace</th><th className="h-12 px-2 text-center text-zinc-700">Status</th><th className="h-12 px-2 text-right text-zinc-700">Created</th></tr></thead><tbody className="divide-y divide-zinc-100 font-medium text-zinc-800">{loading ? ( <tr><td colSpan={4} className="h-32 text-center text-zinc-400 font-bold uppercase animate-pulse">Scanning...</td></tr> ) : vms.length === 0 ? ( <tr><td colSpan={4} className="h-32 text-center text-zinc-500 font-bold uppercase tracking-widest">No units found</td></tr> ) : vms.map((vm) => ( <tr key={vm.metadata.uid} className="hover:bg-zinc-50 transition-all group"><td className="px-2 py-4"><Link to={`/vms/${vm.metadata.namespace}/${vm.metadata.name}`} className="font-bold text-zinc-950 group-hover:text-blue-700 transition-colors block text-base tracking-tight">{vm.metadata.name}</Link></td><td className="px-2 py-4 font-bold text-zinc-700 text-[11px] tracking-tight">{vm.metadata.namespace}</td><td className="px-2 py-4 text-center"><StatusBadge status={vm.status?.printableStatus}/></td><td className="px-2 py-4 text-right text-zinc-600 font-bold tabular-nums text-[11px]">{new Date(vm.metadata.creationTimestamp).toLocaleDateString()}</td></tr> ))}</tbody></table></div>
    </div>
  );
}

// --- Layout ---

function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const [contexts, setContexts] = useState<string[]>([]);
  const [currentCtx, setCurrentCtx] = useState(getContext());

  useEffect(() => {
    fetch("/api/v1/contexts").then(r => r.json()).then(data => {
      setContexts(data.contexts || []);
      if (!getContext() && data.default) {
        setContext(data.default);
        setCurrentCtx(data.default);
      }
    });
  }, []);

  const handleCtxChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setContext(val);
    setCurrentCtx(val);
    window.location.reload(); // Refresh to re-initialize all clients
  };

  const menuItems = [ { name: "Overview", path: "/", icon: LayoutDashboard }, { name: "Machines", path: "/vms", icon: Cpu }, { name: "Storage", path: "/dvs", icon: HardDrive } ];
  return (
    <div className="flex min-h-screen bg-zinc-50/20">
      <aside className="w-72 border-r bg-white flex flex-col fixed inset-y-0 z-50 shadow-sm">
        <div className="h-16 border-b flex items-center px-8 gap-4">
          <div className="bg-zinc-900 p-1.5 rounded-lg shadow-xl shadow-zinc-200"><Terminal className="text-white h-4 w-4" /></div>
          <span className="font-black text-lg tracking-tighter uppercase text-zinc-900 leading-none">Virt<br/><span className="text-zinc-400">Dashboard</span></span>
        </div>
        
        <div className="p-6 pb-2">
           <div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3">
              <label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block mb-2 px-1">Selected Cluster</label>
              <div className="relative">
                 <select 
                   value={currentCtx} 
                   onChange={handleCtxChange}
                   className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-[11px] font-bold text-zinc-800 outline-none appearance-none focus:ring-2 focus:ring-zinc-900/5 transition-all cursor-pointer shadow-sm pr-8"
                 >
                   {contexts.map(c => <option key={c} value={c}>{c}</option>)}
                   {contexts.length === 0 && <option value="">Loading Cluster...</option>}
                 </select>
                 <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400">
                    <Globe size={12} />
                 </div>
              </div>
           </div>
        </div>

        <nav className="flex-1 p-6 pt-2 space-y-1.5 overflow-y-auto">
          {menuItems.map((item) => { 
            const Icon = item.icon; 
            const isActive = location.pathname === item.path || (item.path !== "/" && location.pathname.startsWith(item.path)); 
            return ( 
              <Link key={item.path} to={item.path} className={cn("flex items-center gap-4 px-5 py-3.5 rounded-2xl transition-all text-[11px] font-bold uppercase tracking-wider", isActive ? "bg-zinc-900 text-white shadow-xl translate-x-1" : "text-zinc-400 hover:bg-zinc-50 hover:text-zinc-900")}>
                <Icon size={18} /> {item.name}
              </Link> 
            ); 
          })}
        </nav>
        
        <div className="p-8 border-t"><div className="text-[10px] font-black text-zinc-400 uppercase tracking-widest tracking-[0.3em]">Stable v1.3.0</div></div>
      </aside>
      <main className="flex-1 pl-72"><div className="p-12 max-w-[100rem] mx-auto">{children}</div></main>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter><Layout><Routes><Route path="/" element={<DashboardOverview />} /><Route path="/vms" element={<VMList />} /><Route path="/vms/:namespace/:name" element={<VMDetail />} /><Route path="/dvs" element={<DVList />} /><Route path="/dvs/:namespace/:name" element={<DVDetail />} /><Route path="*" element={<div className="p-20 text-center font-bold text-zinc-300 uppercase tracking-widest italic border-4 border-dashed rounded-3xl mt-12 bg-white/50">Not Found</div>} /></Routes></Layout></BrowserRouter>
  );
}

export default App;

import { useState, useEffect, useMemo } from "react";
import { BrowserRouter, Routes, Route, Link, useLocation, useParams, useNavigate, Navigate } from "react-router-dom";
import { 
  LayoutDashboard, Cpu, Terminal, Activity, ChevronLeft, FileCode, Info, Network, HardDrive, 
  Layers, ShieldCheck, Zap, Globe, Server, Database, Hash, Bell, Clock, TrendingUp, BarChart3, 
  Search, Box, Filter, Check, Copy, MousePointer2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";

import { VncConsole } from "./components/VncConsole";
import { SerialConsole } from "./components/SerialConsole";

// --- Types ---
interface ResourceMetadata { name: string; namespace: string; uid: string; creationTimestamp: string; labels?: Record<string, string>; annotations?: Record<string, string>; }
interface VM { metadata: ResourceMetadata; spec: { running?: boolean; runStrategy?: string; template?: { metadata?: { labels?: Record<string, string>; annotations?: Record<string, string>; }; spec?: { architecture?: string; domain?: { machine?: { type?: string }; cpu?: { cores?: number, sockets?: number, threads?: number }; resources?: { requests?: { cpu?: string, memory?: string } }; devices?: { interfaces?: Array<{ name: string, model?: string }> }; }; networks?: Array<{ name: string, pod?: any }>; volumes?: Array<{ name: string, dataVolume?: { name: string } }>; }; }; }; status?: { printableStatus?: string; conditions?: Array<{ type: string; status: string; message?: string; reason?: string }>; }; }
interface VMI { metadata: ResourceMetadata; status: { phase: string; interfaces?: Array<{ ipAddress?: string; name: string }>; nodeName?: string }; }
interface DV { metadata: ResourceMetadata; status?: { phase: string; progress?: string; conditions?: Array<{ type: string; status: string; message?: string; reason?: string }>; }; spec: { storage?: { resources?: { requests?: { storage?: string } } }; pvc?: { resources?: { requests?: { storage?: string } } }; source?: Record<string, any>; }; }
interface K8sNode { metadata: ResourceMetadata; status: { capacity: Record<string, string>; allocatable: Record<string, string>; conditions: Array<{ type: string; status: string }>; }; spec: { unschedulable?: boolean }; }
interface K8sPod { metadata: ResourceMetadata; status: { phase: string; containerStatuses?: Array<{ ready: boolean; restartCount: number }>; }; }
interface K8sEvent { metadata: ResourceMetadata; involvedObject: { kind: string; name: string; namespace: string; uid: string; }; reason: string; message: string; type: string; lastTimestamp: string; count: number; }
interface MetricPoint { time: string; timestamp: number; cpuUsage: number; memoryUsage: number; }

// --- Utils ---
const getContext = () => localStorage.getItem("kube-context") || "";
const setContext = (ctx: string) => localStorage.setItem("kube-context", ctx);
const apiFetch = (url: string, options: RequestInit = {}) => {
  const ctx = getContext(); const headers = new Headers(options.headers || {});
  if (ctx) headers.set("X-Kube-Context", ctx);
  return fetch(url, { ...options, headers });
};
const parseStorage = (s?: string): number => { if (!s) return 0; const num = parseFloat(s); if (s.endsWith("Ti")) return num * 1024; if (s.endsWith("Gi")) return num; if (s.endsWith("Mi")) return num / 1024; return num / (1024 * 1024); };
const formatStorage = (gi: number): string => gi >= 1024 ? `${(gi / 1024).toFixed(1)}Ti` : `${gi.toFixed(1)}Gi`;

// --- Shared Components ---
function StatusBadge({ status }: { status?: string }) {
  if (!status) return <Badge variant="outline">Unknown</Badge>;
  const lower = status.toLowerCase(); let variant = "outline";
  if (lower.includes("running") || lower.includes("succeeded") || lower.includes("ready") || lower.includes("true")) variant = "success";
  else if (lower.includes("error") || lower.includes("fail") || lower.includes("crash") || lower.includes("false")) variant = "danger";
  else if (lower.includes("start") || lower.includes("progress") || lower.includes("migrat") || lower.includes("import") || lower.includes("pending")) variant = "warning";
  return <Badge variant={variant}>{status}</Badge>;
}
function Badge({ children, variant = "default", className }: { children: React.ReactNode, variant?: string, className?: string }) {
  const variants: Record<string, string> = { default: "bg-zinc-950 text-white", success: "bg-green-100 text-green-700 border-green-200", warning: "bg-yellow-100 text-yellow-700 border-yellow-200", danger: "bg-red-100 text-red-700 border-red-200", outline: "border border-zinc-200 bg-white text-zinc-600" };
  return <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold border transition-colors tracking-tight", variants[variant], className)}>{children}</span>;
}
function Card({ children, title, description, footer, icon: Icon, className }: { children?: React.ReactNode, title?: string, description?: string, footer?: string, icon?: any, className?: string }) {
  return (
    <div className={cn("rounded-2xl border bg-white shadow-sm overflow-hidden flex flex-col", className)}>
      <div className="p-6 flex-1"><div className="flex items-center justify-between pb-3"><h3 className="text-[10px] font-black uppercase tracking-[0.1em] text-zinc-400">{title}</h3>{Icon && <Icon className="h-4 w-4 text-zinc-300" />}</div>{description && <p className="text-3xl font-black tracking-tighter text-zinc-900 leading-none">{description}</p>}{children && <div className="mt-2">{children}</div>}</div>
      {footer && <div className="bg-zinc-50/50 px-6 py-3 text-[10px] font-bold uppercase tracking-widest text-zinc-400 border-t border-zinc-100/50">{footer}</div>}
    </div>
  );
}
function CopyableText({ text, label }: { text: string, label?: string }) {
  const [copied, setCopied] = useState(false); const onCopy = () => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <div className="group relative flex flex-col gap-1 w-full bg-zinc-50/50 p-2.5 rounded-xl border border-zinc-100 hover:border-zinc-200 transition-all">
      {label && <div className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">{label}</div>}
      <div className="flex items-start justify-between gap-4"><div className="text-[11px] font-mono font-bold text-zinc-900 break-all leading-relaxed flex-1">{text}</div><button onClick={onCopy} className="p-1 hover:bg-white rounded-lg border border-transparent hover:border-zinc-200 transition-all text-zinc-400 hover:text-zinc-900 shrink-0 mt-0.5 shadow-sm">{copied ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}</button></div>
    </div>
  );
}

// --- Main Views ---
function VMList() {
  const [vms, setVms] = useState<VM[]>([]); const [loading, setLoading] = useState(true); const [nss, setNss] = useState<string[]>(["all"]); const [availableS, setAvailableS] = useState<string[]>(["all"]); const [sT, setST] = useState(""); const [nF, setNF] = useState("all"); const [sF, setSF] = useState("all");
  const fetchVms = async () => { setLoading(true); try { const res = await apiFetch(`/api/v1/vms?name=${sT}&status=${sF}&namespace=${nF}`); const data = await res.json(); setVms(data.items || []); } finally { setLoading(false); } };
  useEffect(() => { apiFetch("/api/v1/namespaces-list").then(r => r.json()).then(setNss); apiFetch("/api/v1/vm-statuses").then(r => r.json()).then(setAvailableS); }, []);
  useEffect(() => { const timer = setTimeout(fetchVms, 300); return () => clearTimeout(timer); }, [sT, nF, sF]);
  return (
    <div className="space-y-8 animate-in fade-in duration-500 font-medium">
      <div className="flex justify-between items-end"><div><h2 className="text-3xl font-bold uppercase tracking-tight text-zinc-900 leading-none">Virtual Machines</h2><p className="text-zinc-600 text-xs font-bold uppercase tracking-widest mt-2">Compute Units</p></div><div className="text-[11px] font-bold text-zinc-600 bg-zinc-100 px-3 py-1.5 rounded-lg border uppercase tracking-tighter shadow-sm border-zinc-200">{vms.length} TOTAL</div></div>
      <div className="flex flex-wrap gap-4 items-end bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm"><div className="space-y-1.5 flex-[2] min-w-[250px]"><label className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 flex items-center gap-2"><Search size={14}/> Filter Name</label><input type="text" placeholder="Search..." className="w-full h-10 rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-sm font-bold focus:bg-white text-zinc-900 outline-none transition-all shadow-inner" value={sT} onChange={(e) => setST(e.target.value)}/></div><div className="space-y-1.5 flex-1 min-w-[180px]"><label className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 flex items-center gap-2"><Box size={14}/> Namespace</label><select className="w-full h-10 rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-xs font-bold outline-none focus:bg-white text-zinc-900 transition-all shadow-inner" value={nF} onChange={(e) => setNF(e.target.value)}>{nss.map(ns => <option key={ns} value={ns}>{ns}</option>)}</select></div><div className="space-y-1.5 flex-1 min-w-[180px]"><label className="text-[10px] font-bold uppercase tracking-widest text-zinc-600 flex items-center gap-2"><Filter size={14}/> Status</label><select className="w-full h-10 rounded-xl border border-zinc-200 bg-zinc-50 px-4 text-xs font-bold outline-none focus:bg-white text-zinc-900 transition-all shadow-inner" value={sF} onChange={(e) => setSF(e.target.value)}>{availableS.map(s => <option key={s} value={s.toLowerCase()}>{s}</option>)}</select></div></div>
      <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden"><table className="w-full text-sm text-left"><thead className="bg-zinc-50/50 border-b text-zinc-600 font-bold uppercase text-[10px] tracking-[0.15em]"><tr><th className="h-12 px-4 w-[45%] text-zinc-700">Identity</th><th className="h-12 px-2 text-zinc-700">Namespace</th><th className="h-12 px-2 text-center text-zinc-700">Status</th><th className="h-12 px-2 text-right text-zinc-700">Created</th></tr></thead><tbody className="divide-y divide-zinc-100 font-medium text-zinc-900">{loading ? ( <tr><td colSpan={4} className="h-32 text-center text-zinc-400 font-bold uppercase animate-pulse">Scanning...</td></tr> ) : vms.length === 0 ? ( <tr><td colSpan={4} className="h-32 text-center text-zinc-500 font-bold uppercase tracking-widest">No units found</td></tr> ) : vms.map((vm) => ( <tr key={vm.metadata.uid} className="hover:bg-zinc-50 transition-all group"><td className="px-2 py-4"><Link to={`/vms/${vm.metadata.namespace}/${vm.metadata.name}/overview`} className="font-bold text-zinc-950 group-hover:text-blue-700 transition-colors block text-base tracking-tight">{vm.metadata.name}</Link></td><td className="px-2 py-4 font-bold text-zinc-700 text-[11px] tracking-tight">{vm.metadata.namespace}</td><td className="px-2 py-4 text-center"><StatusBadge status={vm.status?.printableStatus}/></td><td className="px-2 py-4 text-right text-zinc-600 font-bold tabular-nums text-[11px]">{new Date(vm.metadata.creationTimestamp).toLocaleDateString()}</td></tr> ))}</tbody></table></div>
    </div>
  );
}

function DVList() {
  const [dvs, setDvs] = useState<DV[]>([]); const [loading, setLoading] = useState(true); const [searchTerm, setSearchTerm] = useState("");
  useEffect(() => { apiFetch("/apis/cdi.kubevirt.io/v1beta1/datavolumes").then(r => r.json()).then(data => { setDvs(data.items || []); setLoading(false); }); }, []);
  const filtered = dvs.filter(dv => dv.metadata.name.toLowerCase().includes(searchTerm.toLowerCase()));
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div><h2 className="text-3xl font-bold tracking-tight text-zinc-900 uppercase leading-none">Storage</h2><p className="text-zinc-600 text-[11px] font-bold uppercase tracking-widest mt-2">Data Volumes</p></div>
      <div className="bg-white p-3 rounded-xl border border-zinc-200 flex items-center gap-4 shadow-sm max-w-2xl"><Search size={18} className="text-zinc-500" /><input type="text" placeholder="Search storage..." className="flex-1 bg-transparent border-none outline-none text-sm font-bold text-zinc-900" value={searchTerm} onChange={e => setSearchTerm(e.target.value)}/></div>
      <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden"><table className="w-full text-sm text-left font-medium"><thead className="bg-zinc-50/50 border-b text-zinc-600 font-bold uppercase text-[10px] tracking-[0.15em]"><tr><th className="h-12 px-6 text-zinc-700">Name</th><th className="h-12 px-6 text-center text-zinc-700">Status</th><th className="h-12 px-6 text-zinc-700">Capacity</th><th className="h-12 px-6 text-right text-zinc-700">Source</th></tr></thead><tbody className="divide-y divide-zinc-100 font-medium text-zinc-800">{loading ? ( <tr><td colSpan={4} className="h-32 text-center text-zinc-400 font-bold uppercase animate-pulse">Syncing...</td></tr> ) : filtered.map(dv => ( <tr key={dv.metadata.uid} className="hover:bg-zinc-50 transition-colors"><td className="px-6 py-4"><Link to={`/dvs/${dv.metadata.namespace}/${dv.metadata.name}/overview`} className="font-bold text-zinc-950 hover:text-blue-700 transition-colors block">{dv.metadata.name}</Link><div className="text-[10px] font-bold text-zinc-500 tracking-tight">{dv.metadata.namespace}</div></td><td className="px-6 py-4 text-center"><StatusBadge status={dv.status?.phase}/></td><td className="px-6 py-4 font-mono font-bold text-zinc-800">{dv.spec.storage?.resources?.requests?.storage || dv.spec.pvc?.resources?.requests?.storage || "N/A"}</td><td className="px-6 py-4 text-right text-[10px] font-bold text-zinc-600 uppercase">{dv.spec.source ? Object.keys(dv.spec.source)[0] : "manual"}</td></tr> ))}</tbody></table></div>
    </div>
  );
}

function DashboardOverview() {
  const [data, setData] = useState<{ vms: VM[], vmis: VMI[], dvs: DV[], nodes: K8sNode[], kvPods: K8sPod[], loading: boolean }>({ vms: [], vmis: [], dvs: [], nodes: [], kvPods: [], loading: true });
  useEffect(() => {
    const load = async () => {
      try {
        const [vmsR, vmisR, dvsR, nodesR, podsR] = await Promise.all([ apiFetch("/api/v1/vms").then(r => r.json()), apiFetch("/apis/kubevirt.io/v1/virtualmachineinstances").then(r => r.json()), apiFetch("/apis/cdi.kubevirt.io/v1beta1/datavolumes").then(r => r.json()), apiFetch("/api/v1/nodes").then(r => r.json()), apiFetch("/api/v1/namespaces/kubevirt/pods").then(r => r.json()) ]);
        setData({ vms: vmsR.items || [], vmis: vmisR.items || [], dvs: dvsR.items || [], nodes: nodesR.items || [], kvPods: podsR.items || [], loading: false });
      } catch (e) { setData(prev => ({ ...prev, loading: false })); }
    }; load();
  }, []);
  const nodeStats = useMemo(() => { const total = data.nodes.length; const unschedulable = data.nodes.filter(n => n.spec.unschedulable).length; const ready = data.nodes.filter(n => n.status.conditions.some(c => c.type === "Ready" && c.status === "True")).length; return { total, unschedulable, ready }; }, [data.nodes]);
  const nsAnalysis = useMemo(() => { const analysis: Record<string, { vmCount: number, storageGi: number }> = {}; data.vms.forEach(vm => { const ns = vm.metadata.namespace; if (!analysis[ns]) analysis[ns] = { vmCount: 0, storageGi: 0 }; analysis[ns].vmCount++; }); data.dvs.forEach(dv => { const ns = dv.metadata.namespace; if (!analysis[ns]) analysis[ns] = { vmCount: 0, storageGi: 0 }; const requested = dv.spec.storage?.resources?.requests?.storage || dv.spec.pvc?.resources?.requests?.storage; analysis[ns].storageGi += parseStorage(requested); }); return Object.entries(analysis).sort((a, b) => b[1].vmCount - a[1].vmCount).map(([name, stats]) => ({ name, ...stats })); }, [data.vms, data.dvs]);
  const infraHealth = useMemo(() => { const components = ["virt-api", "virt-controller", "virt-handler"]; return components.map(c => { const pods = data.kvPods.filter(p => p.metadata.name.startsWith(c)); const healthy = pods.length > 0 && pods.every(p => p.status.phase === "Running"); return { name: c, healthy, count: pods.length }; }); }, [data.kvPods]);
  if (data.loading) return <div className="p-24 text-center font-bold text-zinc-400 tracking-widest uppercase animate-pulse">Initializing Command Center...</div>;
  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      <div><h2 className="text-3xl font-black tracking-tighter uppercase text-zinc-900 leading-none">Cluster Dashboard</h2><p className="text-zinc-500 text-xs font-bold uppercase tracking-widest mt-2">Fabric Infrastructure Overview</p></div>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4"><Card title="Compute Nodes" description={nodeStats.total.toString()} icon={Server} footer={`${nodeStats.ready} Ready / ${nodeStats.unschedulable} Cordoned`} /><Card title="Virtual Units" description={data.vms.length.toString()} icon={Cpu} footer={`${data.vmis.length} Streams Active`} /><Card title="Disk Allocation" description={formatStorage(nsAnalysis.reduce((acc, curr) => acc + curr.storageGi, 0))} icon={Database} footer={`${data.dvs.length} Active Blocks`} /><Card title="Infrastructure" description={infraHealth.every(i => i.healthy) ? "Stable" : "Degraded"} icon={ShieldCheck} className={infraHealth.every(i => i.healthy) ? "" : "border-red-200"}><div className="flex gap-2 mt-2">{infraHealth.map(i => ( <div key={i.name} title={i.name} className={cn("w-2.5 h-2.5 rounded-full border border-white/20", i.healthy ? "bg-green-500" : "bg-red-500 animate-pulse")} /> ))}</div></Card></div>
      <div className="grid gap-8 lg:grid-cols-3">
        <Card title="Namespace Analysis" className="lg:col-span-1"><div className="space-y-5 mt-4">{nsAnalysis.slice(0, 8).map(ns => ( <div key={ns.name} className="group flex flex-col gap-2"><div className="flex justify-between items-start px-1 gap-4"><span className="text-[11px] font-black uppercase text-zinc-700 break-all leading-tight">{ns.name}</span><div className="flex gap-3 text-[9px] font-bold text-zinc-400 shrink-0"><span className="flex items-center gap-1 whitespace-nowrap"><Cpu size={10}/> {ns.vmCount}</span><span className="flex items-center gap-1 whitespace-nowrap"><Database size={10}/> {formatStorage(ns.storageGi)}</span></div></div><div className="h-1.5 w-full bg-zinc-100 rounded-full overflow-hidden"><div className="h-full bg-zinc-950 transition-all duration-1000 ease-out group-hover:bg-blue-600" style={{ width: `${(ns.vmCount / (data.vms.length || 1)) * 100}%` }} /></div></div> ))}</div></Card>
        <Card title="Node Distribution" className="lg:col-span-2"><div className="grid sm:grid-cols-2 gap-4 mt-2">{data.nodes.slice(0, 10).map(node => { const nodeVmis = data.vmis.filter(v => v.status.nodeName === node.metadata.name); const isReady = node.status.conditions.some(c => c.type === "Ready" && c.status === "True"); return ( <div key={node.metadata.uid} className="flex items-start justify-between p-4 rounded-2xl border border-zinc-100 bg-zinc-50/20"><div className="flex items-center gap-4"><div className={cn("p-2.5 rounded-xl border", isReady ? "bg-white text-zinc-600 border-zinc-100" : "bg-red-50 text-red-600 border-red-100")}><Server size={18} /></div><div><div className="text-[11px] font-black text-zinc-900 break-all leading-tight">{node.metadata.name}</div><div className="text-[9px] font-bold text-zinc-400 uppercase tracking-tighter mt-0.5">{node.status.capacity.cpu} cores / {node.status.capacity.memory}</div></div></div><div className="flex flex-col items-end gap-1"><Badge variant="outline" className="px-1.5 py-0 border-zinc-300"><Hash size={8} className="mr-1" /> {nodeVmis.length} VMs</Badge><div className="text-[9px] font-black text-zinc-400 uppercase">{isReady ? "Ready" : "Offline"}</div></div></div> ); })}{data.nodes.length === 0 && <div className="col-span-2 py-12 text-center text-zinc-300 font-black uppercase tracking-widest italic">No Cluster Nodes</div>}</div></Card>
      </div>
    </div>
  );
}

function VMDetailContent() {
  const { namespace, name, tab } = useParams(); const navigate = useNavigate(); const [vm, setVm] = useState<VM | null>(null); const [vmi, setVmi] = useState<VMI | null>(null); const [vmYaml, setVmYaml] = useState(""); const [associatedDVs, setAssociatedDVs] = useState<DV[]>([]); const [events, setEvents] = useState<K8sEvent[]>([]); const [metrics, setMetrics] = useState<MetricPoint[]>([]); const [loading, setLoading] = useState(true); const [mStrategy, setMStrategy] = useState<string | null>(null);
  const activeTab = tab || "overview";
  const fetchData = async () => {
    try {
      const [vmRes, vmiRes, yamlRes, eventsRes] = await Promise.all([ apiFetch(`/apis/kubevirt.io/v1/namespaces/${namespace}/virtualmachines/${name}`), apiFetch(`/apis/kubevirt.io/v1/namespaces/${namespace}/virtualmachineinstances/${name}`), apiFetch(`/api/v1/yaml/virtualmachines/${namespace}/${name}`), apiFetch(`/api/v1/namespaces/${namespace}/events?fieldSelector=involvedObject.name=${name}`) ]);
      const vmData = vmRes.ok ? await vmRes.json() : null; setVm(vmData); if (vmiRes.ok) setVmi(await vmiRes.json()); if (yamlRes.ok) setVmYaml(await yamlRes.text()); if (eventsRes.ok) setEvents((await eventsRes.json()).items || []);
      let strat = mStrategy; if (strat === null) { const apisRes = await apiFetch("/apis"); if (apisRes.ok) { strat = (await apisRes.json()).groups?.some((g:any) => g.name === "metrics.kubevirt.io") ? "vmi" : "pod"; setMStrategy(strat); } }
      if (strat === "vmi") { const m = await apiFetch(`/apis/metrics.kubevirt.io/v1beta1/namespaces/${namespace}/virtualmachineinstances/${name}`); if (m.ok) { const d = await m.json(); setMetrics(p => [...p.slice(-19), { timestamp: Date.now(), time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }), cpuUsage: d.status?.cpu?.usageCores || 0, memoryUsage: (d.status?.memory?.usageBytes || 0) / (1024 * 1024) }]); } }
      else if (strat === "pod") { const ps = await apiFetch(`/api/v1/namespaces/${namespace}/pods?labelSelector=kubevirt.io/domain=${name}`); if (ps.ok) { const pod = (await ps.json()).items?.[0]; if (pod) { const pm = await apiFetch(`/apis/metrics.k8s.io/v1beta1/namespaces/${namespace}/pods/${pod.metadata.name}`); if (pm.ok) { const d = await pm.json(); const cpu = d.containers?.[0]?.usage?.cpu || "0n"; const mem = d.containers?.[0]?.usage?.memory || "0Ki"; const pCpu = (c:string) => c.endsWith("n") ? parseInt(c)/1e9 : c.endsWith("u") ? parseInt(c)/1e6 : c.endsWith("m") ? parseInt(c)/1e3 : parseInt(c); const pMem = (m:string) => m.endsWith("Ki") ? parseInt(m)/1024 : m.endsWith("Mi") ? parseInt(m) : m.endsWith("Gi") ? parseInt(m)*1024 : parseInt(m)/(1024*1024); setMetrics(p => [...p.slice(-19), { timestamp: Date.now(), time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }), cpuUsage: pCpu(cpu), memoryUsage: pMem(mem) }]); } } } }
      if (vmData?.spec.template?.spec?.volumes) { const dns = vmData.spec.template.spec.volumes.filter((v:any) => v.dataVolume).map((v:any) => v.dataVolume.name); if (dns.length > 0) { const ds = await Promise.all(dns.map((dn:string) => apiFetch(`/apis/cdi.kubevirt.io/v1beta1/namespaces/${namespace}/datavolumes/${dn}`).then(r => r.ok ? r.json() : null))); setAssociatedDVs(ds.filter(d => d !== null)); } }
    } finally { setLoading(false); }
  };
  useEffect(() => { fetchData(); const t = setInterval(fetchData, 5000); return () => clearInterval(t); }, [namespace, name]);
  const handleAction = async (a:string) => { await apiFetch(`/apis/subresources.kubevirt.io/v1/namespaces/${namespace}/virtualmachines/${name}/${a}`, { method: 'PUT', body: '{}' }); fetchData(); };
  if (loading && !vm) return <div className="p-12 text-center animate-pulse text-zinc-500 font-bold uppercase tracking-widest text-xs">Accessing Fabric...</div>;
  if (!vm) return <div className="p-12 text-center text-red-600 font-bold border-2 border-dashed border-red-100 rounded-xl mt-8">Unit Sync Error</div>;
  return (
    <div className={cn("space-y-6 animate-in fade-in duration-500", activeTab === "console" || activeTab === "vnc" ? "max-w-full" : "")}>
      <div className="flex items-center justify-between border-b pb-6 border-zinc-100"><div className="flex items-center gap-4"><button onClick={() => navigate("/vms")} className="p-2 hover:bg-zinc-100 rounded-lg border border-zinc-200 transition-all bg-white shadow-sm"><ChevronLeft size={18} /></button><div><h2 className="text-2xl font-bold tracking-tight text-zinc-900">{vm.metadata.name}</h2><div className="flex items-center gap-3 mt-1 text-xs"><span className="font-bold text-zinc-600">{vm.metadata.namespace}</span><StatusBadge status={vm.status?.printableStatus}/></div></div></div><div className="flex gap-2"><button onClick={() => handleAction('start')} className="px-4 py-2 bg-zinc-950 text-white rounded-lg text-xs font-bold transition-all hover:bg-zinc-800 shadow-md">Start</button><button onClick={() => handleAction('stop')} className="px-4 py-2 bg-white border border-red-100 rounded-lg text-xs font-bold hover:bg-red-50 text-red-600 shadow-sm">Stop</button><button onClick={() => handleAction('restart')} className="px-4 py-2 bg-white border border-zinc-200 rounded-lg text-xs font-bold hover:bg-zinc-50 shadow-sm">Restart</button></div></div>
      <div className="flex gap-8 overflow-x-auto pb-1">{[ { id: "overview", name: "Overview", icon: Info }, { id: "events", name: "Events", icon: Bell }, { id: "console", name: "Console", icon: Terminal }, { id: "vnc", name: "VNC", icon: MousePointer2 }, { id: "yaml", name: "Specification", icon: FileCode } ].map(t => ( <Link key={t.id} to={`/vms/${namespace}/${name}/${t.id}`} className={cn("flex items-center gap-2 pb-3 px-1 text-xs font-bold uppercase tracking-wider transition-all border-b-2 -mb-px whitespace-nowrap", activeTab === t.id ? "border-zinc-950 text-zinc-950" : "border-transparent text-zinc-500 hover:text-zinc-800")}><t.icon size={14} /> {t.name}</Link> ))}</div>
      <div className="mt-4">
        {activeTab === "overview" && ( <div className="space-y-6"><div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3"><Card title="Lifecycle Strategy" icon={ShieldCheck}><div className="space-y-3 mt-1 text-zinc-900 font-medium"><div className="flex justify-between items-center text-xs"><span className="text-zinc-600 font-bold uppercase">Run Strategy</span><Badge variant="outline" className="border-zinc-400">{vm.spec.runStrategy || "Default"}</Badge></div><div className="flex justify-between items-center text-xs border-t pt-2.5 border-zinc-50"><span className="text-zinc-600 font-bold uppercase">Desired State</span><span className="font-bold text-zinc-950">{vm.spec.running ? "Active" : "Halted"}</span></div></div></Card><Card title="Compute" icon={Cpu}><div className="grid grid-cols-2 gap-4 mt-1 font-medium"><div><div className="text-2xl font-bold tracking-tight text-zinc-900">{vm.spec.template?.spec?.domain?.cpu?.cores || 1}</div><div className="text-[10px] font-bold text-zinc-600 uppercase">Cores</div></div><div><div className="text-2xl font-bold tracking-tight text-zinc-900">{vm.spec.template?.spec?.domain?.resources?.requests?.memory || "1Gi"}</div><div className="text-[10px] font-bold text-zinc-600 uppercase">Memory</div></div></div></Card><Card title="Status" icon={Activity}>{vmi ? ( <div className="mt-1 font-medium"><div className="flex justify-between items-center"><span className="text-xs font-bold text-green-600 uppercase tracking-tighter">{vmi.status.phase}</span><span className="text-[10px] font-mono font-bold text-zinc-600 bg-zinc-100 px-2 py-0.5 rounded">{vmi.status.nodeName}</span></div><div className="text-lg font-mono mt-2 font-bold tracking-tight text-zinc-950">{vmi.status.interfaces?.[0]?.ipAddress || "Pending IP..."}</div></div> ) : ( <div className="text-[11px] text-zinc-500 font-bold uppercase mt-4 italic">No Active stream</div> )}</Card></div>{vmi && metrics.length > 0 && ( <div className="grid gap-6 md:grid-cols-2"><Card title="CPU Usage" icon={TrendingUp}><div className="h-[180px] w-full mt-4"><ResponsiveContainer><AreaChart data={metrics}><defs><linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#09090b" stopOpacity={0.1}/><stop offset="95%" stopColor="#09090b" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" /><XAxis dataKey="time" hide /><YAxis fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v)=>`${v.toFixed(2)}`} /><Tooltip contentStyle={{borderRadius:'12px',border:'none',boxShadow:'0 10px 15px -3px rgb(0 0 0/0.1)',fontSize:'10px'}} /><Area type="monotone" dataKey="cpuUsage" stroke="#09090b" fill="url(#colorCpu)" animationDuration={300} /></AreaChart></ResponsiveContainer></div></Card><Card title="Memory Usage" icon={BarChart3}><div className="h-[180px] w-full mt-4"><ResponsiveContainer><AreaChart data={metrics}><defs><linearGradient id="colorMem" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#2563eb" stopOpacity={0.1}/><stop offset="95%" stopColor="#2563eb" stopOpacity={0}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" /><XAxis dataKey="time" hide /><YAxis fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v)=>`${Math.round(v)}`} /><Tooltip contentStyle={{borderRadius:'12px',border:'none',boxShadow:'0 10px 15px -3px rgb(0 0 0/0.1)',fontSize:'10px'}} /><Area type="monotone" dataKey="memoryUsage" stroke="#2563eb" fill="url(#colorMem)" animationDuration={300} /></AreaChart></ResponsiveContainer></div></Card></div> )}<div className="grid gap-6 lg:grid-cols-3"><Card title="Metadata" icon={Layers} className="lg:col-span-3"><div className="grid md:grid-cols-2 gap-8 mt-1 text-zinc-900"><div className="space-y-3"><div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Labels</div><div className="flex flex-wrap gap-2">{Object.entries(vm.spec.template?.metadata?.labels || {}).map(([k,v])=>( <span key={k} className="px-2 py-1 bg-zinc-50 text-zinc-700 rounded-lg text-[10px] font-bold border border-zinc-200">{k}: {v}</span> ))}</div></div><div className="space-y-3"><div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Annotations</div><div className="grid grid-cols-1 gap-2">{Object.entries(vm.spec.template?.metadata?.annotations || {}).slice(0,8).map(([k,v])=>( <CopyableText key={k} label={k} text={String(v)}/> ))}</div></div></div></Card><Card title="Storage" icon={HardDrive}><div className="space-y-2.5 mt-1">{associatedDVs.map(d=>( <div key={d.metadata.uid} className="flex items-center justify-between text-xs p-2 bg-zinc-50/50 rounded-lg border border-zinc-100 font-medium gap-4"><Link to={`/dvs/${d.metadata.namespace}/${d.metadata.name}/overview`} className="font-bold text-blue-700 hover:underline leading-tight flex-1">{d.metadata.name}</Link><StatusBadge status={d.status?.phase}/></div> ))}</div></Card><Card title="Networking" icon={Network} className="lg:col-span-2"><div className="space-y-2.5 mt-1 text-zinc-900 font-medium">{ (vm.spec.template?.spec?.domain?.devices?.interfaces || []).map((i:any)=>( <div key={i.name} className="flex items-center justify-between text-sm p-3.5 bg-zinc-50 rounded-xl border border-zinc-100"><div className="font-bold text-zinc-900">{i.name}</div><div className="font-mono text-[11px] font-bold">{vmi?.status.interfaces?.[0]?.ipAddress || "DISCONNECTED"}</div></div> ))}</div></Card></div></div> )}
        {activeTab === "events" && ( <div className="bg-white rounded-2xl border border-zinc-100 overflow-hidden shadow-sm"><table className="w-full text-sm text-left"><thead className="bg-zinc-50 border-b text-zinc-500 font-black uppercase text-[10px]"><tr><th className="px-6 py-4">Type</th><th className="px-6 py-4">Reason</th><th className="px-6 py-4">Message</th><th className="px-6 py-4 text-right">Time</th></tr></thead><tbody className="divide-y divide-zinc-50">{events.sort((a,b)=>new Date(b.lastTimestamp).getTime()-new Date(a.lastTimestamp).getTime()).map(e=>( <tr key={e.metadata.uid} className="hover:bg-zinc-50/50 transition-colors"><td className="px-6 py-4"><Badge variant={e.type==="Normal"?"outline":"danger"}>{e.type}</Badge></td><td className="px-6 py-4 font-black text-zinc-900 text-xs">{e.reason}</td><td className="px-6 py-4 text-zinc-600 text-xs max-w-md">{e.message}</td><td className="px-6 py-4 text-right text-zinc-400 font-bold text-[10px]"><Clock size={10} className="inline mr-1"/>{new Date(e.lastTimestamp).toLocaleString()}</td></tr> ))}</tbody></table></div> )}
        {activeTab === "console" && ( <SerialConsole namespace={namespace!} name={name!} /> )}
        {activeTab === "vnc" && ( <VncConsole namespace={namespace!} name={name!} /> )}
        {activeTab === "yaml" && ( <div className="bg-zinc-950 p-8 rounded-2xl border border-zinc-800 shadow-2xl"><pre className="text-zinc-400 text-[13px] overflow-x-auto font-mono whitespace-pre min-h-[400px]">{vmYaml || "Fetching..."}</pre></div> )}
      </div>
    </div>
  );
}

function DVDetailContent() {
  const { namespace, name, tab } = useParams(); const navigate = useNavigate(); const [dv, setDv] = useState<DV|null>(null); const [dvYaml, setDvYaml] = useState(""); const [loading, setLoading] = useState(true); const activeTab = tab || "overview";
  useEffect(() => { const f = async () => { try { const [r, y] = await Promise.all([apiFetch(`/apis/cdi.kubevirt.io/v1beta1/namespaces/${namespace}/datavolumes/${name}`), apiFetch(`/api/v1/yaml/datavolumes/${namespace}/${name}`)]); if (r.ok) setDv(await r.json()); if (y.ok) setDvYaml(await y.text()); } finally { setLoading(false); } }; f(); }, [namespace, name]);
  if (loading) return <div className="p-12 text-center animate-pulse text-zinc-500 font-bold uppercase tracking-widest text-xs">Accessing Storage...</div>;
  if (!dv) return <div className="p-12 text-center text-red-600 font-bold border-2 border-dashed border-red-100 rounded-xl mt-8">Storage Not Found</div>;
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between border-b pb-6 border-zinc-100"><div className="flex items-center gap-4"><button onClick={() => navigate(-1)} className="p-2 hover:bg-zinc-100 rounded-lg border border-zinc-200 transition-all bg-white shadow-sm"><ChevronLeft size={18} /></button><div><h2 className="text-2xl font-bold tracking-tight text-zinc-900">{dv.metadata.name}</h2><div className="flex items-center gap-3 mt-1 text-xs"><span className="font-bold text-zinc-600">{dv.metadata.namespace}</span><StatusBadge status={dv.status?.phase}/></div></div></div></div>
      <div className="flex gap-8">{[ { id: "overview", name: "Overview", icon: Info }, { id: "yaml", name: "Manifest", icon: FileCode } ].map(t => ( <Link key={t.id} to={`/dvs/${namespace}/${name}/${t.id}`} className={cn("flex items-center gap-2 pb-3 px-1 text-xs font-bold uppercase transition-all border-b-2 -mb-px", activeTab === t.id ? "border-zinc-950 text-zinc-950" : "border-transparent text-zinc-500 hover:text-zinc-800")}><t.icon size={14} /> {t.name}</Link> ))}</div>
      <div className="mt-4">
        {activeTab === "overview" ? ( 
          <div className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <Card title="Capacity" icon={HardDrive} description={dv.spec.storage?.resources?.requests?.storage || dv.spec.pvc?.resources?.requests?.storage || "N/A"} />
              <Card title="Transfer" icon={Activity} description={dv.status?.progress || "100%"} />
              <Card title="Source" icon={Zap} description={dv.spec.source ? Object.keys(dv.spec.source)[0] : "manual"} />
            </div>
            <div className="grid gap-6 lg:grid-cols-3">
              <Card title="Metadata" icon={Layers} className="lg:col-span-3">
                <div className="grid md:grid-cols-2 gap-8 mt-1 text-zinc-900">
                  <div className="space-y-3">
                    <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Labels</div>
                    <div className="flex flex-wrap gap-2">{Object.entries(dv.metadata.labels || {}).map(([k,v])=>( <span key={k} className="px-2 py-1 bg-zinc-50 text-zinc-700 rounded-lg text-[10px] font-bold border border-zinc-200">{k}: {v}</span> ))}</div>
                  </div>
                  <div className="space-y-3">
                    <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Annotations</div>
                    <div className="grid grid-cols-1 gap-2">{Object.entries(dv.metadata.annotations || {}).slice(0,12).map(([k,v])=>( <CopyableText key={k} label={k} text={String(v)}/> ))}</div>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        ) : ( <div className="bg-zinc-950 p-8 rounded-2xl border border-zinc-800 shadow-2xl"><pre className="text-zinc-400 text-[13px] font-mono whitespace-pre min-h-[400px]">{dvYaml || "Loading..."}</pre></div> )}
      </div>
    </div>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation(); const [contexts, setContexts] = useState<string[]>([]); const [currentCtx, setCurrentCtx] = useState(getContext());
  useEffect(() => { fetch("/api/v1/contexts").then(r => r.json()).then(d => { setContexts(d.contexts || []); if (!getContext() && d.default) { setContext(d.default); setCurrentCtx(d.default); } }); }, []);
  const hCC = (e:any) => { const v = e.target.value; setContext(v); setCurrentCtx(v); window.location.reload(); };
  const mIs = [ { name: "Overview", path: "/", icon: LayoutDashboard }, { name: "Machines", path: "/vms", icon: Cpu }, { name: "Storage", path: "/dvs", icon: HardDrive } ];
  return (
    <div className="flex min-h-screen bg-zinc-50/20">
      <aside className="w-72 border-r bg-white flex flex-col fixed inset-y-0 z-50 shadow-sm"><div className="h-16 border-b flex items-center px-8 gap-4"><div className="bg-zinc-900 p-1.5 rounded-lg shadow-xl shadow-zinc-200"><Terminal className="text-white h-4 w-4" /></div><span className="font-black text-lg tracking-tighter uppercase text-zinc-900 leading-none">Virt<br/><span className="text-zinc-400">Dashboard</span></span></div><div className="p-6 pb-2"><div className="bg-zinc-50 border border-zinc-200 rounded-xl p-3"><label className="text-[9px] font-black text-zinc-400 uppercase tracking-widest block mb-2 px-1">Cluster</label><div className="relative"><select value={currentCtx} onChange={hCC} className="w-full bg-white border border-zinc-200 rounded-lg px-3 py-2 text-[11px] font-bold outline-none appearance-none focus:ring-2 focus:ring-zinc-900/5 transition-all cursor-pointer shadow-sm pr-8">{contexts.map(c => <option key={c} value={c}>{c}</option>)}{contexts.length === 0 && <option value="">Loading Cluster...</option>}</select><div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-400"><Globe size={12} /></div></div></div></div><nav className="flex-1 p-6 pt-2 space-y-1.5 overflow-y-auto">{mIs.map((item) => ( <Link key={item.path} to={item.path} className={cn("flex items-center gap-4 px-5 py-3.5 rounded-2xl transition-all text-[11px] font-bold uppercase tracking-wider", (item.path==="/"?location.pathname==="/":location.pathname.startsWith(item.path)) ? "bg-zinc-900 text-white shadow-xl translate-x-1" : "text-zinc-400 hover:bg-zinc-50 hover:text-zinc-900")}><item.icon size={18} /> {item.name}</Link> ))}</nav><div className="p-8 border-t"><div className="text-[10px] font-black text-zinc-400 uppercase tracking-widest tracking-[0.3em]">Stable v1.6.0</div></div></aside>
      <main className="flex-1 pl-72"><div className="p-12 max-w-[100rem] mx-auto">{children}</div></main>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter><Layout><Routes><Route path="/" element={<DashboardOverview />} /><Route path="/vms" element={<VMList />} /><Route path="/vms/:namespace/:name" element={<Navigate to="overview" replace />} /><Route path="/vms/:namespace/:name/:tab" element={<VMDetailContent />} /><Route path="/dvs" element={<DVList />} /><Route path="/dvs/:namespace/:name" element={<Navigate to="overview" replace />} /><Route path="/dvs/:namespace/:name/:tab" element={<DVDetailContent />} /><Route path="*" element={<div className="p-20 text-center font-bold text-zinc-300 uppercase tracking-widest italic border-4 border-dashed rounded-3xl mt-12 bg-white/50">Not Found</div>} /></Routes></Layout></BrowserRouter>
  );
}

export default App;

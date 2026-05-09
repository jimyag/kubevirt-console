import { useState, useEffect, useMemo } from "react";
import { BrowserRouter, Routes, Route, Link, useParams, useNavigate, Navigate } from "react-router-dom";
import {
  Cpu, Terminal, ChevronLeft, FileCode, Info, Network, HardDrive,
  Layers, ShieldCheck, Server, Database, Hash, Bell, Clock, TrendingUp, BarChart3,
  Search, Box, Filter, Check, Copy, MousePointer2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";

import { VncConsole } from "./components/VncConsole";
import { SerialConsole } from "./components/SerialConsole";
import { AppSidebar } from "./components/app-sidebar";
import { SiteHeader } from "./components/site-header";
import { SidebarInset, SidebarProvider } from "./components/ui/sidebar";
import { Toaster } from "./components/ui/sonner";
import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import { Card as ShadCard, CardContent, CardDescription, CardHeader, CardTitle } from "./components/ui/card";
import { Input } from "./components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./components/ui/table";

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
const apiFetch = (url: string, options: RequestInit = {}) => {
  const ctx = getContext(); const headers = new Headers(options.headers || {});
  if (ctx) headers.set("X-Kube-Context", ctx);
  return fetch(url, { ...options, headers });
};
const parseStorage = (s?: string): number => { if (!s) return 0; const num = parseFloat(s); if (s.endsWith("Ti")) return num * 1024; if (s.endsWith("Gi")) return num; if (s.endsWith("Mi")) return num / 1024; return num / (1024 * 1024); };
const formatStorage = (gi: number): string => gi >= 1024 ? `${(gi / 1024).toFixed(1)}Ti` : `${gi.toFixed(1)}Gi`;

// --- Shared Components ---
type StatusVariant = "outline" | "success" | "warning" | "danger";
function StatusBadge({ status }: { status?: string }) {
  if (!status) return <Badge variant="outline" className="text-muted-foreground">Unknown</Badge>;
  const lower = status.toLowerCase();
  let variant: StatusVariant = "outline";
  if (lower.includes("running") || lower.includes("succeeded") || lower.includes("ready") || lower.includes("true")) variant = "success";
  else if (lower.includes("error") || lower.includes("fail") || lower.includes("crash") || lower.includes("false")) variant = "danger";
  else if (lower.includes("start") || lower.includes("progress") || lower.includes("migrat") || lower.includes("import") || lower.includes("pending")) variant = "warning";
  return <Badge variant={variant}>{status}</Badge>;
}

function CopyableText({ text, label }: { text: string, label?: string }) {
  const [copied, setCopied] = useState(false);
  const onCopy = () => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <div className="group relative flex flex-col gap-1 w-full bg-muted/30 p-2.5 rounded-lg border hover:border-border transition-all">
      {label && <div className="text-[9px] font-medium text-muted-foreground uppercase tracking-widest">{label}</div>}
      <div className="flex items-start justify-between gap-4">
        <div className="text-[11px] font-mono text-foreground break-all leading-relaxed flex-1">{text}</div>
        <button onClick={onCopy} className="p-1 hover:bg-background rounded-lg border border-transparent hover:border-border transition-all text-muted-foreground hover:text-foreground shrink-0 mt-0.5">
          {copied ? <Check size={12} className="text-green-600" /> : <Copy size={12} />}
        </button>
      </div>
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
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex justify-between items-end">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold">Virtual Machines</h1>
          <p className="text-sm text-muted-foreground">Manage your virtual machine workloads</p>
        </div>
        <div className="text-sm text-muted-foreground bg-muted px-3 py-1.5 rounded-lg border">{vms.length} total</div>
      </div>
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search VMs..." value={sT} onChange={e => setST(e.target.value)} />
        </div>
        <div className="flex items-center gap-2">
          <Box className="h-4 w-4 text-muted-foreground" />
          <select className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring text-foreground min-w-[140px]" value={nF} onChange={e => setNF(e.target.value)}>
            {nss.map(ns => <option key={ns} value={ns}>{ns}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <select className="h-9 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring text-foreground min-w-[140px]" value={sF} onChange={e => setSF(e.target.value)}>
            {availableS.map(s => <option key={s} value={s.toLowerCase()}>{s}</option>)}
          </select>
        </div>
      </div>
      <ShadCard className="p-0 gap-0">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Namespace</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Created</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4}>
                    <div className="flex items-center justify-center h-32 gap-2">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted border-t-primary" />
                      <span className="text-sm text-muted-foreground">Loading...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : vms.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="h-32 text-center text-muted-foreground">No virtual machines found</TableCell></TableRow>
              ) : vms.map((vm) => (
                <TableRow key={vm.metadata.uid} className="hover:bg-muted/50">
                  <TableCell>
                    <Link to={`/vms/${vm.metadata.namespace}/${vm.metadata.name}/overview`} className="font-medium hover:text-primary transition-colors">{vm.metadata.name}</Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{vm.metadata.namespace}</TableCell>
                  <TableCell><StatusBadge status={vm.status?.printableStatus} /></TableCell>
                  <TableCell className="text-right text-muted-foreground text-sm tabular-nums">{new Date(vm.metadata.creationTimestamp).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </ShadCard>
    </div>
  );
}

function DVList() {
  const [dvs, setDvs] = useState<DV[]>([]); const [loading, setLoading] = useState(true); const [searchTerm, setSearchTerm] = useState("");
  useEffect(() => { apiFetch("/apis/cdi.kubevirt.io/v1beta1/datavolumes").then(r => r.json()).then(data => { setDvs(data.items || []); setLoading(false); }); }, []);
  const filtered = dvs.filter(dv => dv.metadata.name.toLowerCase().includes(searchTerm.toLowerCase()));
  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">Storage</h1>
        <p className="text-sm text-muted-foreground">Manage your DataVolume storage resources</p>
      </div>
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search storage..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
      </div>
      <ShadCard className="p-0 gap-0">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Capacity</TableHead>
                <TableHead className="text-right">Source</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={4}>
                    <div className="flex items-center justify-center h-32 gap-2">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted border-t-primary" />
                      <span className="text-sm text-muted-foreground">Loading...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filtered.map(dv => (
                <TableRow key={dv.metadata.uid} className="hover:bg-muted/50">
                  <TableCell>
                    <Link to={`/dvs/${dv.metadata.namespace}/${dv.metadata.name}/overview`} className="font-medium hover:text-primary transition-colors">{dv.metadata.name}</Link>
                    <div className="text-xs text-muted-foreground">{dv.metadata.namespace}</div>
                  </TableCell>
                  <TableCell><StatusBadge status={dv.status?.phase} /></TableCell>
                  <TableCell className="font-mono text-sm">{dv.spec.storage?.resources?.requests?.storage || dv.spec.pvc?.resources?.requests?.storage || "N/A"}</TableCell>
                  <TableCell className="text-right text-muted-foreground text-sm">{dv.spec.source ? Object.keys(dv.spec.source)[0] : "manual"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </ShadCard>
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
  const totalStorage = nsAnalysis.reduce((acc, curr) => acc + curr.storageGi, 0);

  if (data.loading) return (
    <div className="flex items-center justify-center h-64 gap-2">
      <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted border-t-primary" />
      <span className="text-sm text-muted-foreground">Loading dashboard...</span>
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">Cluster Dashboard</h1>
        <p className="text-sm text-muted-foreground">KubeVirt infrastructure overview</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <ShadCard>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/50">
                <Server className="size-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <CardDescription>Compute Nodes</CardDescription>
                <CardTitle className="text-2xl font-semibold tabular-nums">{nodeStats.total}</CardTitle>
                <div className="text-sm text-muted-foreground">{nodeStats.ready} Ready{nodeStats.unschedulable > 0 && ` / ${nodeStats.unschedulable} Cordoned`}</div>
              </div>
            </div>
          </CardHeader>
        </ShadCard>

        <ShadCard>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-50 dark:bg-green-950/50">
                <Cpu className="size-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <CardDescription>Virtual Machines</CardDescription>
                <CardTitle className="text-2xl font-semibold tabular-nums">{data.vms.length}</CardTitle>
                <div className="text-sm text-muted-foreground">{data.vmis.length} running</div>
              </div>
            </div>
          </CardHeader>
        </ShadCard>

        <ShadCard>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-950/50">
                <Database className="size-5 text-purple-600 dark:text-purple-400" />
              </div>
              <div>
                <CardDescription>Disk Allocation</CardDescription>
                <CardTitle className="text-2xl font-semibold tabular-nums">{formatStorage(totalStorage)}</CardTitle>
                <div className="text-sm text-muted-foreground">{data.dvs.length} data volumes</div>
              </div>
            </div>
          </CardHeader>
        </ShadCard>

        <ShadCard className={!infraHealth.every(i => i.healthy) ? "border-red-200 dark:border-red-900" : ""}>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-50 dark:bg-orange-950/50">
                <ShieldCheck className="size-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <CardDescription>Infrastructure</CardDescription>
                <CardTitle className="text-2xl font-semibold tabular-nums">{infraHealth.every(i => i.healthy) ? "Stable" : "Degraded"}</CardTitle>
                <div className="flex gap-1.5 mt-1">
                  {infraHealth.map(i => (
                    <div key={i.name} title={i.name} className={cn("w-2 h-2 rounded-full", i.healthy ? "bg-green-500" : "bg-red-500 animate-pulse")} />
                  ))}
                </div>
              </div>
            </div>
          </CardHeader>
        </ShadCard>
      </div>

      {/* Namespace Analysis + Node Distribution */}
      <div className="grid gap-6 lg:grid-cols-3">
        <ShadCard className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base">Namespace Analysis</CardTitle>
            <CardDescription>VM and storage distribution by namespace</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {nsAnalysis.slice(0, 8).map(ns => (
                <div key={ns.name} className="flex items-center justify-between py-1 border-b last:border-0">
                  <span className="text-sm font-medium text-foreground truncate flex-1">{ns.name}</span>
                  <div className="flex items-center gap-3 shrink-0">
                    <Badge variant="outline" className="gap-1"><Cpu className="size-3" />{ns.vmCount}</Badge>
                    <span className="text-xs text-muted-foreground tabular-nums">{formatStorage(ns.storageGi)}</span>
                  </div>
                </div>
              ))}
              {nsAnalysis.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No namespaces found</p>}
            </div>
          </CardContent>
        </ShadCard>

        <ShadCard className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Node Distribution</CardTitle>
            <CardDescription>VM placement across cluster nodes</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 gap-3">
              {data.nodes.slice(0, 10).map(node => {
                const nodeVmis = data.vmis.filter(v => v.status.nodeName === node.metadata.name);
                const isReady = node.status.conditions.some(c => c.type === "Ready" && c.status === "True");
                return (
                  <div key={node.metadata.uid} className="flex items-start justify-between p-3 rounded-lg border bg-muted/30">
                    <div className="flex items-center gap-3">
                      <div className={cn("p-2 rounded-lg", isReady ? "bg-green-50 dark:bg-green-950/50 text-green-600 dark:text-green-400" : "bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400")}>
                        <Server className="size-4" />
                      </div>
                      <div>
                        <div className="text-sm font-medium text-foreground break-all leading-tight">{node.metadata.name}</div>
                        <div className="text-xs text-muted-foreground">{node.status.capacity.cpu} cores / {node.status.capacity.memory}</div>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <Badge variant="outline" className="gap-1"><Hash className="size-3" />{nodeVmis.length}</Badge>
                      <StatusBadge status={isReady ? "Ready" : "NotReady"} />
                    </div>
                  </div>
                );
              })}
              {data.nodes.length === 0 && <div className="col-span-2 py-8 text-center text-muted-foreground text-sm">No cluster nodes found</div>}
            </div>
          </CardContent>
        </ShadCard>
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

  if (loading && !vm) return (
    <div className="flex items-center justify-center h-64 gap-2">
      <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted border-t-primary" />
      <span className="text-sm text-muted-foreground">Loading...</span>
    </div>
  );
  if (!vm) return (
    <div className="p-12 text-center text-muted-foreground border-2 border-dashed rounded-lg mt-8">
      Virtual machine not found
    </div>
  );

  const tabs = [
    { id: "overview", name: "Overview", icon: Info },
    { id: "events", name: "Events", icon: Bell },
    { id: "console", name: "Console", icon: Terminal },
    { id: "vnc", name: "VNC", icon: MousePointer2 },
    { id: "yaml", name: "Specification", icon: FileCode },
  ];

  return (
    <div className={cn("space-y-6 animate-in fade-in duration-500", activeTab === "console" || activeTab === "vnc" ? "max-w-full" : "")}>
      {/* Header */}
      <div className="flex items-center gap-4 mb-2">
        <Button variant="ghost" size="icon" onClick={() => navigate("/vms")}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{vm.metadata.name}</h1>
            <StatusBadge status={vm.status?.printableStatus} />
          </div>
          <p className="text-sm text-muted-foreground">{vm.metadata.namespace}</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => handleAction('start')}>Start</Button>
          <Button size="sm" variant="outline" onClick={() => handleAction('stop')}>Stop</Button>
          <Button size="sm" variant="outline" onClick={() => handleAction('restart')}>Restart</Button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 border-b">
        {tabs.map(t => (
          <Link
            key={t.id}
            to={`/vms/${namespace}/${name}/${t.id}`}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              activeTab === t.id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
            )}
          >
            <t.icon className="h-4 w-4" />
            {t.name}
          </Link>
        ))}
      </div>

      {/* Tab Content */}
      <div className="mt-4">
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* Info cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <ShadCard>
                <CardHeader className="pb-2">
                  <CardDescription>Run Strategy</CardDescription>
                  <CardTitle className="text-sm font-medium">{vm.spec.runStrategy || "Default"}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Desired State</span>
                    <span className="font-medium">{vm.spec.running ? "Active" : "Halted"}</span>
                  </div>
                </CardContent>
              </ShadCard>

              <ShadCard>
                <CardHeader className="pb-2">
                  <CardDescription>Compute</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-2xl font-semibold tabular-nums">{vm.spec.template?.spec?.domain?.cpu?.cores || 1}</div>
                      <div className="text-xs text-muted-foreground">CPU Cores</div>
                    </div>
                    <div>
                      <div className="text-2xl font-semibold">{vm.spec.template?.spec?.domain?.resources?.requests?.memory || "1Gi"}</div>
                      <div className="text-xs text-muted-foreground">Memory</div>
                    </div>
                  </div>
                </CardContent>
              </ShadCard>

              <ShadCard>
                <CardHeader className="pb-2">
                  <CardDescription>Runtime Status</CardDescription>
                </CardHeader>
                <CardContent>
                  {vmi ? (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Phase</span>
                        <span className="font-medium">{vmi.status.phase}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Node</span>
                        <span className="font-mono text-xs">{vmi.status.nodeName}</span>
                      </div>
                      <div className="text-base font-mono mt-1">{vmi.status.interfaces?.[0]?.ipAddress || "Pending IP..."}</div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No active instance</p>
                  )}
                </CardContent>
              </ShadCard>
            </div>

            {/* Metrics charts */}
            {vmi && metrics.length > 0 && (
              <div className="grid gap-4 md:grid-cols-2">
                <ShadCard>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                      <CardTitle className="text-sm">CPU Usage</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[160px] w-full">
                      <ResponsiveContainer>
                        <AreaChart data={metrics}>
                          <defs>
                            <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.1} />
                              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                          <XAxis dataKey="time" hide />
                          <YAxis fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `${v.toFixed(2)}`} />
                          <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', fontSize: '11px' }} />
                          <Area type="monotone" dataKey="cpuUsage" stroke="hsl(var(--primary))" fill="url(#colorCpu)" animationDuration={300} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </ShadCard>

                <ShadCard>
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-muted-foreground" />
                      <CardTitle className="text-sm">Memory Usage (MB)</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[160px] w-full">
                      <ResponsiveContainer>
                        <AreaChart data={metrics}>
                          <defs>
                            <linearGradient id="colorMem" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#2563eb" stopOpacity={0.1} />
                              <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-muted" />
                          <XAxis dataKey="time" hide />
                          <YAxis fontSize={10} tickLine={false} axisLine={false} tickFormatter={(v) => `${Math.round(v)}`} />
                          <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid hsl(var(--border))', fontSize: '11px' }} />
                          <Area type="monotone" dataKey="memoryUsage" stroke="#2563eb" fill="url(#colorMem)" animationDuration={300} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </ShadCard>
              </div>
            )}

            {/* Metadata, Storage, Networking */}
            <div className="grid gap-4 lg:grid-cols-3">
              <ShadCard className="lg:col-span-3">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Layers className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-sm">Metadata</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Labels</div>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(vm.spec.template?.metadata?.labels || {}).map(([k, v]) => (
                          <span key={k} className="px-2 py-1 bg-muted text-foreground rounded-md text-xs border">{k}: {v}</span>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Annotations</div>
                      <div className="grid grid-cols-1 gap-2">
                        {Object.entries(vm.spec.template?.metadata?.annotations || {}).slice(0, 8).map(([k, v]) => (
                          <CopyableText key={k} label={k} text={String(v)} />
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </ShadCard>

              <ShadCard>
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <HardDrive className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-sm">Storage</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {associatedDVs.map(d => (
                      <div key={d.metadata.uid} className="flex items-center justify-between text-sm p-2 bg-muted/30 rounded-lg border gap-4">
                        <Link to={`/dvs/${d.metadata.namespace}/${d.metadata.name}/overview`} className="font-medium hover:text-primary transition-colors flex-1">{d.metadata.name}</Link>
                        <StatusBadge status={d.status?.phase} />
                      </div>
                    ))}
                    {associatedDVs.length === 0 && <p className="text-sm text-muted-foreground">No storage volumes</p>}
                  </div>
                </CardContent>
              </ShadCard>

              <ShadCard className="lg:col-span-2">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Network className="h-4 w-4 text-muted-foreground" />
                    <CardTitle className="text-sm">Networking</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {(vm.spec.template?.spec?.domain?.devices?.interfaces || []).map((i: any) => (
                      <div key={i.name} className="flex items-center justify-between text-sm p-3 bg-muted/30 rounded-lg border">
                        <span className="font-medium">{i.name}</span>
                        <span className="font-mono text-xs text-muted-foreground">{vmi?.status.interfaces?.[0]?.ipAddress || "disconnected"}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </ShadCard>
            </div>
          </div>
        )}

        {activeTab === "events" && (
          <ShadCard className="p-0 gap-0">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Message</TableHead>
                    <TableHead className="text-right">Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {events.sort((a, b) => new Date(b.lastTimestamp).getTime() - new Date(a.lastTimestamp).getTime()).map(e => (
                    <TableRow key={e.metadata.uid} className="hover:bg-muted/50">
                      <TableCell><Badge variant={e.type === "Normal" ? "outline" : "danger"}>{e.type}</Badge></TableCell>
                      <TableCell className="font-medium text-sm">{e.reason}</TableCell>
                      <TableCell className="text-muted-foreground text-sm max-w-md">{e.message}</TableCell>
                      <TableCell className="text-right text-muted-foreground text-sm tabular-nums">
                        <span className="flex items-center justify-end gap-1"><Clock className="h-3 w-3" />{new Date(e.lastTimestamp).toLocaleString()}</span>
                      </TableCell>
                    </TableRow>
                  ))}
                  {events.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="h-24 text-center text-muted-foreground">No events found</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </ShadCard>
        )}

        {activeTab === "console" && <SerialConsole namespace={namespace!} name={name!} />}
        {activeTab === "vnc" && <VncConsole namespace={namespace!} name={name!} />}

        {activeTab === "yaml" && (
          <ShadCard>
            <CardContent className="p-0">
              <pre className="p-6 text-sm font-mono text-foreground bg-muted/30 rounded-xl overflow-x-auto min-h-[400px] whitespace-pre">{vmYaml || "Fetching..."}</pre>
            </CardContent>
          </ShadCard>
        )}
      </div>
    </div>
  );
}

function DVDetailContent() {
  const { namespace, name, tab } = useParams(); const navigate = useNavigate(); const [dv, setDv] = useState<DV | null>(null); const [dvYaml, setDvYaml] = useState(""); const [loading, setLoading] = useState(true); const activeTab = tab || "overview";
  useEffect(() => {
    const f = async () => {
      try {
        const [r, y] = await Promise.all([apiFetch(`/apis/cdi.kubevirt.io/v1beta1/namespaces/${namespace}/datavolumes/${name}`), apiFetch(`/api/v1/yaml/datavolumes/${namespace}/${name}`)]);
        if (r.ok) setDv(await r.json()); if (y.ok) setDvYaml(await y.text());
      } finally { setLoading(false); }
    }; f();
  }, [namespace, name]);

  if (loading) return (
    <div className="flex items-center justify-center h-64 gap-2">
      <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted border-t-primary" />
      <span className="text-sm text-muted-foreground">Loading...</span>
    </div>
  );
  if (!dv) return (
    <div className="p-12 text-center text-muted-foreground border-2 border-dashed rounded-lg mt-8">
      DataVolume not found
    </div>
  );

  const tabs = [
    { id: "overview", name: "Overview", icon: Info },
    { id: "yaml", name: "Manifest", icon: FileCode },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex items-center gap-4 mb-2">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{dv.metadata.name}</h1>
            <StatusBadge status={dv.status?.phase} />
          </div>
          <p className="text-sm text-muted-foreground">{dv.metadata.namespace}</p>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 border-b">
        {tabs.map(t => (
          <Link
            key={t.id}
            to={`/dvs/${namespace}/${name}/${t.id}`}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
              activeTab === t.id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
            )}
          >
            <t.icon className="h-4 w-4" />
            {t.name}
          </Link>
        ))}
      </div>

      {/* Tab Content */}
      <div className="mt-4">
        {activeTab === "overview" ? (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <ShadCard>
                <CardHeader className="pb-2">
                  <CardDescription>Capacity</CardDescription>
                  <CardTitle className="text-2xl font-semibold tabular-nums">
                    {dv.spec.storage?.resources?.requests?.storage || dv.spec.pvc?.resources?.requests?.storage || "N/A"}
                  </CardTitle>
                </CardHeader>
              </ShadCard>
              <ShadCard>
                <CardHeader className="pb-2">
                  <CardDescription>Transfer Progress</CardDescription>
                  <CardTitle className="text-2xl font-semibold tabular-nums">{dv.status?.progress || "100%"}</CardTitle>
                </CardHeader>
              </ShadCard>
              <ShadCard>
                <CardHeader className="pb-2">
                  <CardDescription>Source</CardDescription>
                  <CardTitle className="text-sm font-medium">{dv.spec.source ? Object.keys(dv.spec.source)[0] : "manual"}</CardTitle>
                </CardHeader>
              </ShadCard>
            </div>

            <ShadCard>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-sm">Metadata</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Labels</div>
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(dv.metadata.labels || {}).map(([k, v]) => (
                        <span key={k} className="px-2 py-1 bg-muted text-foreground rounded-md text-xs border">{k}: {v}</span>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Annotations</div>
                    <div className="grid grid-cols-1 gap-2">
                      {Object.entries(dv.metadata.annotations || {}).slice(0, 12).map(([k, v]) => (
                        <CopyableText key={k} label={k} text={String(v)} />
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </ShadCard>
          </div>
        ) : (
          <ShadCard>
            <CardContent className="p-0">
              <pre className="p-6 text-sm font-mono text-foreground bg-muted/30 rounded-xl overflow-x-auto min-h-[400px] whitespace-pre">{dvYaml || "Loading..."}</pre>
            </CardContent>
          </ShadCard>
        )}
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <SiteHeader />
          <div className="flex flex-1 flex-col p-4 lg:p-8 max-w-[100rem] mx-auto w-full">
            <Routes>
              <Route path="/" element={<DashboardOverview />} />
              <Route path="/vms" element={<VMList />} />
              <Route path="/vms/:namespace/:name" element={<Navigate to="overview" replace />} />
              <Route path="/vms/:namespace/:name/:tab" element={<VMDetailContent />} />
              <Route path="/dvs" element={<DVList />} />
              <Route path="/dvs/:namespace/:name" element={<Navigate to="overview" replace />} />
              <Route path="/dvs/:namespace/:name/:tab" element={<DVDetailContent />} />
              <Route path="*" element={<div className="p-20 text-center text-muted-foreground border-2 border-dashed rounded-lg mt-12">Page not found</div>} />
            </Routes>
          </div>
        </SidebarInset>
        <Toaster />
      </SidebarProvider>
    </BrowserRouter>
  );
}

export default App;
